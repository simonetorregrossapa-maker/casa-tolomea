// Legge il feed iCal (.ics) esportato dall'extranet Booking.com per Casa Li
// Brizzi, estrae gli intervalli di date occupate e li restituisce come JSON.
// Cache in-memory (per istanza) per non richiamare Booking a ogni visita del
// sito: rivalidazione ogni CACHE_TTL_MS. Se la revalidazione fallisce ma
// esiste una cache precedente, quella viene servita comunque (stale) invece
// di rompere il form di prenotazione.

const ICAL_URL = Deno.env.get("BOOKING_ICAL_URL") ?? "";
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minuti (range richiesto: 30-60)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type BusyRange = { start: string; end: string };
type AvailabilityPayload = { busy: BusyRange[]; updatedAt: string };

let cache: AvailabilityPayload | null = null;
let cacheTime = 0;

// Le righe iCal più lunghe di 75 ottetti sono "foldate" su più righe: quelle
// di continuazione iniziano con uno spazio o un tab e vanno riunite.
function unfold(ics: string): string[] {
  const rawLines = ics.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

// Formati attesi per DTSTART/DTEND: "20260710" (VALUE=DATE) oppure
// "20260710T000000Z" (DATE-TIME). Ci interessa solo la parte data.
function toIsoDate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseIcs(ics: string): BusyRange[] {
  const lines = unfold(ics);
  const events: BusyRange[] = [];
  let inEvent = false;
  let start: string | null = null;
  let end: string | null = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      start = null;
      end = null;
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (inEvent && start && end) events.push({ start, end });
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    if (key.startsWith("DTSTART")) start = toIsoDate(value);
    if (key.startsWith("DTEND")) end = toIsoDate(value);
  }

  return events;
}

async function fetchAvailability(): Promise<AvailabilityPayload> {
  if (!ICAL_URL) throw new Error("BOOKING_ICAL_URL non configurato come secret della function");
  const res = await fetch(ICAL_URL, {
    headers: { "User-Agent": "CasaLiBrizzi-Availability/1.0" },
  });
  if (!res.ok) throw new Error(`Feed iCal non raggiungibile (HTTP ${res.status})`);
  const text = await res.text();
  return { busy: parseIcs(text), updatedAt: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const isFresh = cache && Date.now() - cacheTime < CACHE_TTL_MS;
  if (isFresh) {
    return new Response(JSON.stringify(cache), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    });
  }

  try {
    cache = await fetchAvailability();
    cacheTime = Date.now();
    return new Response(JSON.stringify(cache), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    });
  } catch (err) {
    // Revalidazione fallita: se abbiamo una cache precedente la serviamo
    // comunque stale, così il calendario del sito resta usabile.
    if (cache) {
      return new Response(JSON.stringify(cache), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    }
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
