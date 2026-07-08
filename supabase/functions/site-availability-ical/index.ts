// Feed iCal (.ics) HUB della casa: espone in UN SOLO calendario TUTTE le date
// occupate, da qualunque canale:
//   • prenotazioni di Booking.com   (feed iCal extranet, BOOKING_ICAL_URL)
//   • prenotazioni di Airbnb        (feed iCal, AIRBNB_ICAL_URL)
//   • prenotazioni di Vrbo          (feed iCal, VRBO_ICAL_URL)
//   • prenotazioni ricevute dal sito e CONFERMATE (richieste.confermata = true)
//   • blocchi manuali del proprietario (tabella "blocchi")
//
// Va importato UNA VOLTA nell'extranet di OGNI OTA (Calendario → Importa /
// Sincronizza calendari): così ciascuna piattaforma vede le prenotazioni di
// TUTTE le altre passando dal sito come unica fonte di verità (hub & spoke),
// senza dover collegare a mano ogni OTA con ogni altra. Reimportare in Booking
// anche le proprie date è innocuo (blocco idempotente).
//
// IMPORTANTE (sicurezza anti-overbooking): questo feed viene importato da altri
// sistemi per BLOCCARE date. Se una sorgente OTA è momentaneamente irraggiungibile
// NON serviamo un feed parziale (farebbe "liberare" date in realtà occupate):
// propaghiamo l'errore e serviamo semmai l'ultima cache buona (stale).
//
// I nomi degli ospiti NON vengono esposti: ogni evento è etichettato in modo
// generico "Non disponibile".
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono iniettate automaticamente da
// Supabase; BOOKING_ICAL_URL / AIRBNB_ICAL_URL / VRBO_ICAL_URL sono secret.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOOKING_ICAL_URL = Deno.env.get("BOOKING_ICAL_URL") ?? "";
const AIRBNB_ICAL_URL = Deno.env.get("AIRBNB_ICAL_URL") ?? "";
const VRBO_ICAL_URL = Deno.env.get("VRBO_ICAL_URL") ?? "";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minuti: qui la freschezza conta (blocca le OTA)

type Evento = { uid: string; start: string; end: string; summary: string };

let cache: string | null = null;
let cacheTime = 0;

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/* ── parsing iCal in ingresso (identico a hyper-responder) ─────────────── */
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
function parseIcs(ics: string): { start: string; end: string }[] {
  const lines = unfold(ics);
  const events: { start: string; end: string }[] = [];
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

/* ── sorgenti ──────────────────────────────────────────────────────────── */
// Feed OTA esterno. URL vuoto = sorgente non configurata → saltata senza errore.
// Se l'URL è impostato ma la fetch fallisce, PROPAGHIAMO l'errore (vedi nota
// anti-overbooking in testa): meglio servire stale che un feed monco.
async function fromIcal(url: string, nome: string, oggi: string): Promise<Evento[]> {
  if (!url) return [];
  const res = await fetch(url, { headers: { "User-Agent": "CasaTolomea-Hub/1.0" } });
  if (!res.ok) throw new Error(`Feed iCal ${nome} non raggiungibile (HTTP ${res.status})`);
  return parseIcs(await res.text())
    .filter((e) => e.end >= oggi)
    .map((e) => ({
      uid: `ota-${nome.toLowerCase()}-${e.start}-${e.end}@casalibrizzi`,
      start: e.start, end: e.end, summary: "Non disponibile",
    }));
}

async function query(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Query Supabase fallita (HTTP ${res.status})`);
  return await res.json();
}

async function fetchEventi(): Promise<Evento[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti");
  }
  const oggi = todayIso();
  // In parallelo. Se un feed OTA impostato fallisce, Promise.all rigetta e il
  // chiamante serve la cache stale (non un feed parziale).
  const [booking, airbnb, vrbo, righe, blocchi] = await Promise.all([
    fromIcal(BOOKING_ICAL_URL, "Booking", oggi),
    fromIcal(AIRBNB_ICAL_URL, "Airbnb", oggi),
    fromIcal(VRBO_ICAL_URL, "Vrbo", oggi),
    query(`richieste?select=id,checkin,checkout&confermata=eq.true&checkout=gte.${oggi}`),
    query(`blocchi?select=id,dal,al&al=gte.${oggi}`),
  ]);
  return [
    ...booking, ...airbnb, ...vrbo,
    ...righe.map((r: any) => ({
      uid: `sito-${r.id}@casalibrizzi`, start: r.checkin, end: r.checkout,
      summary: "Non disponibile (prenotato sul sito diretto)",
    })),
    ...blocchi.map((b: any) => ({
      uid: `blocco-${b.id}@casalibrizzi`, start: b.dal, end: b.al,
      summary: "Non disponibile (bloccato dal proprietario)",
    })),
  ];
}

// DTEND è il giorno di check-out (esclusivo), stessa convenzione dei feed OTA.
function toIcsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function buildIcs(eventi: Evento[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Casa Tolomea//Disponibilita Hub//IT",
    "METHOD:PUBLISH",
    "CALSCALE:GREGORIAN",
  ];
  eventi.forEach((e) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toIcsDate(e.start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(e.end)}`,
      `SUMMARY:${e.summary}`,
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" },
    });
  }

  const isFresh = cache && Date.now() - cacheTime < CACHE_TTL_MS;
  if (!isFresh) {
    try {
      cache = buildIcs(await fetchEventi());
      cacheTime = Date.now();
    } catch (err) {
      if (!cache) {
        return new Response(String(err instanceof Error ? err.message : err), { status: 502 });
      }
      // revalidazione fallita ma esiste una cache precedente: la serviamo comunque (stale)
    }
  }

  return new Response(cache, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});
