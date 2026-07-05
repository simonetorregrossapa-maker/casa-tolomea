// Espone come feed iCal (.ics) le date da bloccare su Booking.com:
//   • le prenotazioni ricevute dal sito e CONFERMATE (richieste.confermata = true)
//   • i blocchi manuali inseriti dal proprietario (tabella "blocchi")
// Da importare nell'extranet di Booking (Calendario → Sincronizza calendari →
// Importa calendario) così Booking blocca automaticamente quelle date. È il
// verso opposto della function "disponibilita" (Booking → sito): insieme
// coprono la sincronizzazione a due vie e riducono il rischio di doppie
// prenotazioni sullo stesso giorno.
//
// Solo le richieste confermate bloccano Booking: una richiesta non ancora
// verificata (o spam) non deve occupare inutilmente il calendario.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono iniettate automaticamente da
// Supabase in ogni Edge Function: non serve configurarle come secret.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minuti: qui la freschezza conta di più (blocca Booking)

// Evento con UID stabile: prefisso diverso per prenotazioni-sito e blocchi
// manuali, così Booking non confonde due sorgenti con lo stesso id numerico.
type Evento = { uid: string; start: string; end: string; summary: string };

let cache: string | null = null;
let cacheTime = 0;

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

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
  const [righe, blocchi] = await Promise.all([
    query(`richieste?select=id,checkin,checkout&confermata=eq.true&checkout=gte.${oggi}`),
    query(`blocchi?select=id,dal,al&al=gte.${oggi}`),
  ]);
  return [
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

// DTEND è il giorno di check-out (esclusivo), stessa convenzione usata da
// disponibilita per interpretare il feed di Booking.
function toIcsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function buildIcs(eventi: Evento[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Casa Li Brizzi//Disponibilita Sito//IT",
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
