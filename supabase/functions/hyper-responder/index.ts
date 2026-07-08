// Fonte UNICA di disponibilità per il sito. Unisce in un solo elenco di date
// occupate:
//   1) le prenotazioni di Booking.com (feed iCal dell'extranet)
//   2) le prenotazioni di Airbnb (feed iCal, se AIRBNB_ICAL_URL è impostato)
//   3) le prenotazioni di Vrbo (feed iCal, se VRBO_ICAL_URL è impostato)
//   4) le prenotazioni ricevute dal sito e CONFERMATE dal proprietario
//   5) i blocchi manuali inseriti dal proprietario dal pannello
// Restituisce { busy: [{start, end}], updatedAt } — stessa forma della vecchia
// function booking-availability, così il sito (app.js) deve solo puntare qui.
// "end" è il check-out ESCLUSIVO: le notti occupate sono [start, end).
//
// Perché una function e non far leggere le tabelle al sito: così il pubblico
// (anon) non accede mai ai dati degli ospiti né alla tabella blocchi. La
// function usa la SERVICE ROLE (iniettata da Supabase) e restituisce solo date.

const ICAL_URL = Deno.env.get("BOOKING_ICAL_URL") ?? "";
const AIRBNB_ICAL_URL = Deno.env.get("AIRBNB_ICAL_URL") ?? "";
const VRBO_ICAL_URL = Deno.env.get("VRBO_ICAL_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minuti

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type BusyRange = { start: string; end: string };
type Payload = { busy: BusyRange[]; updatedAt: string };

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

/* ── sorgenti ──────────────────────────────────────────────────────────── */
// Legge un feed iCal esterno (Booking, Airbnb, …). URL vuoto = sorgente non
// configurata: viene semplicemente saltata, senza errore.
async function fromIcal(url: string, nome: string): Promise<BusyRange[]> {
  if (!url) return [];
  const res = await fetch(url, { headers: { "User-Agent": "CasaTolomea-Disponibilita/1.0" } });
  if (!res.ok) throw new Error(`Feed iCal ${nome} non raggiungibile (HTTP ${res.status})`);
  return parseIcs(await res.text());
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
  // Le sorgenti in parallelo. Se un feed iCal (Booking/Airbnb) fallisce,
  // propaghiamo l'errore per servire semmai la cache stale; sito e blocchi
  // vengono comunque inclusi.
  const [booking, airbnb, vrbo, sito, blocchi] = await Promise.all([
    fromIcal(ICAL_URL, "Booking"),
    fromIcal(AIRBNB_ICAL_URL, "Airbnb"),
    fromIcal(VRBO_ICAL_URL, "Vrbo"),
    fromTable(`richieste?select=checkin,checkout&confermata=eq.true&checkout=gte.${today}`,
      (r) => ({ start: r.checkin, end: r.checkout })),
    fromTable(`blocchi?select=dal,al&al=gte.${today}`,
      (r) => ({ start: r.dal, end: r.al })),
  ]);
  return { busy: [...booking, ...airbnb, ...vrbo, ...sito, ...blocchi], updatedAt: new Date().toISOString() };
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
