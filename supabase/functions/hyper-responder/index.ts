// Fonte UNICA di disponibilità per il sito. Unisce in un solo elenco di date
// occupate:
//   1) le prenotazioni di Booking.com (feed iCal dell'extranet)
//   2) le prenotazioni di Airbnb (feed iCal, se AIRBNB_ICAL_URL è impostato)
//   3) le prenotazioni di Vrbo (feed iCal, se VRBO_ICAL_URL è impostato)
//   4) le prenotazioni ricevute dal sito e CONFERMATE dal proprietario
//   5) i blocchi manuali inseriti dal proprietario dal pannello
// Restituisce { busy: [{start, end}], updatedAt, stale } — stessa forma della
// vecchia booking-availability (campo `busy`), così il sito (app.js) resta
// invariato. "end" è il check-out ESCLUSIVO: le notti occupate sono [start, end).
//
// Perché una function e non far leggere le tabelle al sito: così il pubblico
// (anon) non accede mai ai dati degli ospiti né alla tabella blocchi. La
// function usa la SERVICE ROLE (iniettata da Supabase) e restituisce solo date.
//
// ── ANTI-DOPPIA-PRENOTAZIONE (fix 24 lug 2026) ─────────────────────────────
// Prima i 3 feed OTA venivano uniti con Promise.all: se anche un solo canale
// (Airbnb/VRBO) non rispondeva — o rispondeva con una pagina non-iCal (rate
// limit) — TUTTI i suoi blocchi sparivano e le sue date già prenotate tornavano
// libere sul sito. Ora ogni canale OTA ha uno SNAPSHOT PERSISTENTE dell'ultimo
// dato buono (tabella `ota_snapshot`): se il feed cade, si riusa lo snapshot
// invece di azzerare. Regola d'oro: un canale non libera MAI una data già presa
// per un semplice blip di rete. Sopravvive anche ai cold-start (lo snapshot sta
// in DB, non in memoria).

const ICAL_URL = Deno.env.get("BOOKING_ICAL_URL") ?? "";
const AIRBNB_ICAL_URL = Deno.env.get("AIRBNB_ICAL_URL") ?? "";
const VRBO_ICAL_URL = Deno.env.get("VRBO_ICAL_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minuti
const ICAL_TIMEOUT_MS = 5000; // un feed OTA lento non deve bloccare la risposta

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type BusyRange = { start: string; end: string };
type Payload = { busy: BusyRange[]; updatedAt: string; stale: string[] };

let cache: Payload | null = null;
let cacheTime = 0;

/* ── parsing iCal (identico a booking-availability) ────────────────────── */
function unfold(ics: string): string[] {
  const raw = ics.split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}
function toIsoDate(v: string): string | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function parseIcs(ics: string): BusyRange[] {
  const lines = unfold(ics);
  const events: BusyRange[] = [];
  let inEvent = false, start: string | null = null, end: string | null = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) { inEvent = true; start = end = null; continue; }
    if (line.startsWith("END:VEVENT")) { if (inEvent && start && end) events.push({ start, end }); inEvent = false; continue; }
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx), value = line.slice(idx + 1).trim();
    if (key.startsWith("DTSTART")) start = toIsoDate(value);
    if (key.startsWith("DTEND")) end = toIsoDate(value);
  }
  return events;
}

// Scarta i periodi già finiti (end <= oggi): tiene il payload pulito ed elimina
// il residuo storico che alcuni feed trascinano (es. eventi 2025 su VRBO).
function dropPast(ranges: BusyRange[], today: string): BusyRange[] {
  return ranges.filter((r) => r.end && r.end > today);
}

/* ── snapshot persistente per canale OTA (tabella ota_snapshot) ─────────── */
// Sopravvive a cold-start e riavvii: l'ultimo dato buono di ogni canale resta
// in DB, non solo in memoria. Solo la service role (bypassa RLS) vi accede.
async function loadSnapshot(canale: string): Promise<BusyRange[] | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/ota_snapshot?canale=eq.${canale}&select=busy`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length ? (rows[0].busy as BusyRange[]) : null;
  } catch { return null; }
}
async function saveSnapshot(canale: string, busy: BusyRange[]): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/ota_snapshot`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ canale, busy, updated: new Date().toISOString() }),
    });
  } catch { /* best-effort: se il salvataggio fallisce, lo rifaremo al giro dopo */ }
}

/* ── sorgenti ──────────────────────────────────────────────────────────── */
// Scarica un feed iCal con timeout. Fallisce (throw) se HTTP non-OK o se la
// risposta NON è un vero iCal (una pagina d'errore con status 200 conta come
// fallimento, così non svuotiamo lo snapshot con dati fasulli).
async function fetchIcal(url: string, nome: string): Promise<BusyRange[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ICAL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CasaTolomea-Disponibilita/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${nome} non raggiungibile (HTTP ${res.status})`);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error(`${nome}: risposta non iCal (feed protetto o errore)`);
    return parseIcs(text);
  } finally {
    clearTimeout(timer);
  }
}

// Un canale OTA resiliente: non lancia MAI. Se il feed risponde con un iCal
// valido, aggiorna lo snapshot e usa i dati freschi. Se fallisce (rete, rate
// limit, pagina non-iCal), ripiega sull'ultimo snapshot buono e segnala `stale`.
// URL vuoto = canale non configurato: saltato senza rumore.
async function otaSource(
  url: string, nome: string, canale: string,
): Promise<{ busy: BusyRange[]; stale: boolean }> {
  if (!url) return { busy: [], stale: false };
  try {
    const busy = await fetchIcal(url, nome);
    await saveSnapshot(canale, busy);
    return { busy, stale: false };
  } catch (_) {
    const snap = await loadSnapshot(canale);
    // Nessuno snapshot ancora: meglio [] che bloccare tutto; ma se lo snapshot
    // esiste lo riusiamo, così le date già prenotate NON tornano libere.
    return { busy: snap ?? [], stale: true };
  }
}

async function fromTable(path: string, map: (r: any) => BusyRange): Promise<BusyRange[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return [];
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Query Supabase fallita (HTTP ${res.status})`);
  return (await res.json()).map(map);
}

async function build(): Promise<Payload> {
  const today = new Date().toISOString().slice(0, 10);
  // Feed OTA: resilienti, non lanciano mai (snapshot di riserva per canale).
  // Tabelle sito/blocchi: stessa infra dello snapshot store — se il DB è giù
  // qui lanciano e il chiamante serve la cache piena precedente (rete di
  // sicurezza), così non liberiamo comunque nulla.
  const [booking, airbnb, vrbo, sito, blocchi] = await Promise.all([
    otaSource(ICAL_URL, "Booking", "booking"),
    otaSource(AIRBNB_ICAL_URL, "Airbnb", "airbnb"),
    otaSource(VRBO_ICAL_URL, "Vrbo", "vrbo"),
    fromTable(`richieste?select=checkin,checkout&confermata=eq.true&checkout=gte.${today}`,
      (r) => ({ start: r.checkin, end: r.checkout })),
    fromTable(`blocchi?select=dal,al&al=gte.${today}`,
      (r) => ({ start: r.dal, end: r.al })),
  ]);

  const stale = [
    booking.stale ? "booking" : null,
    airbnb.stale ? "airbnb" : null,
    vrbo.stale ? "vrbo" : null,
  ].filter(Boolean) as string[];

  const busy = dropPast(
    [...booking.busy, ...airbnb.busy, ...vrbo.busy, ...sito, ...blocchi],
    today,
  );
  return { busy, updatedAt: new Date().toISOString(), stale };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const isFresh = cache && Date.now() - cacheTime < CACHE_TTL_MS;
  if (isFresh) {
    return new Response(JSON.stringify(cache), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }
  try {
    cache = await build();
    cacheTime = Date.now();
    return new Response(JSON.stringify(cache), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    if (cache) {
      return new Response(JSON.stringify(cache), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
      });
    }
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
