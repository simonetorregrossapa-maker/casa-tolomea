// RECUPERO ABBANDONO — Edge Function su cron.
//
// Manda un'email di recupero a chi ha lasciato l'email (nel form di
// prenotazione, nel widget "avvisami se si libera" o nel popup exit-intent)
// ma non ha completato NÉ una richiesta di prenotazione NÉ un'iscrizione
// alla lista d'attesa. L'interesse va ripreso a CALDO: qualche ora dopo,
// non giorni dopo (vedi soglie sotto).
//
// Legge dalla tabella `contatti_parziali` (vedi
// supabase/migrations/2026-08-12-contatti-parziali.sql), popolata dal
// salvataggio progressivo lato client (src/analytics.js
// salvaContattoParziale, invocata da BookForm/Waitlist/ExitIntentPopup in
// src/App.jsx).
//
// Idempotente: ogni riga ha un flag anti-doppio-invio (followup_inviato).
// Se nel frattempo la stessa persona (stessa email) ha completato una
// richiesta o si è iscritta alla lista d'attesa, NON le manda nulla: ha già
// convertito, non ricontattarla la spamma inutilmente.
//
// Cron consigliato (SQL Editor Supabase, pg_cron). ATTENZIONE: pg_cron gira
// in UTC. Ogni 30 minuti è sufficiente: la finestra "qualche ora" sotto
// assorbe lo scarto.
//   select cron.schedule('recupero-abbandono-tolomea', '*/30 * * * *',
//     $$ select net.http_post(
//          url:='https://wbooxigzhkjljkkroibn.functions.supabase.co/recupero-abbandono',
//          headers:='{"Content-Type":"application/json"}'::jsonb) $$);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// Non troppo presto (l'utente potrebbe solo essere passato a un altro campo
// del form) e non troppo tardi (l'interesse si raffredda, e i portali sono
// lì pronti a intercettarlo). Tra 3 e 72 ore dalla cattura.
const ORE_MIN = 3;
const ORE_MAX = 72;

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function getSettings(): Promise<Record<string, string>> {
  const res = await rest("settings?select=chiave,valore");
  if (!res.ok) return {};
  const map: Record<string, string> = {};
  for (const r of await res.json()) map[r.chiave] = r.valore ?? "";
  return map;
}

async function sendEmail(from: string, to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY non configurata");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  return res.ok;
}

function fmtIt(iso: string | null): string {
  if (!iso) return "";
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
}

type Riga = {
  id: number; origine: string; email: string; telefono: string | null; nome: string | null;
  checkin: string | null; checkout: string | null; creato: string;
};

// Ha già convertito? Stessa email, riga più recente della cattura parziale,
// in richieste O in liste_attesa. Se sì, non le manda nulla: ha già agito.
async function giaConvertito(email: string, dopo: string): Promise<boolean> {
  const q = `select=id&email=eq.${encodeURIComponent(email)}&creato=gte.${encodeURIComponent(dopo)}&limit=1`;
  const [r1, r2] = await Promise.all([rest(`richieste?${q}`), rest(`liste_attesa?${q}`)]);
  const [j1, j2] = await Promise.all([
    r1.ok ? r1.json() : Promise.resolve([]),
    r2.ok ? r2.json() : Promise.resolve([]),
  ]);
  return (Array.isArray(j1) && j1.length > 0) || (Array.isArray(j2) && j2.length > 0);
}

Deno.serve(async (_req) => {
  try {
    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const site = s.site_url || "https://www.casatolomea.it";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;

    const now = Date.now();
    const min = new Date(now - ORE_MIN * 3600_000).toISOString();
    const max = new Date(now - ORE_MAX * 3600_000).toISOString();

    const res = await rest(
      `contatti_parziali?select=id,origine,email,telefono,nome,checkin,checkout,creato` +
      `&followup_inviato=eq.false&creato=lte.${encodeURIComponent(min)}&creato=gte.${encodeURIComponent(max)}` +
      `&order=creato.desc`,
    );
    if (!res.ok) throw new Error(`Query contatti_parziali fallita (HTTP ${res.status})`);
    const righe: Riga[] = await res.json();

    // Una sola email a persona per giro: tiene la riga più recente (già in
    // testa grazie all'order=creato.desc) e più avanti marca inviato tutte
    // le sorelle con la stessa email, per non doppio-processarle ai giri dopo.
    const perEmail = new Map<string, Riga>();
    for (const r of righe) if (!perEmail.has(r.email)) perEmail.set(r.email, r);

    let inviati = 0, saltati = 0;
    for (const r of perEmail.values()) {
      const convertito = await giaConvertito(r.email, r.creato);
      if (!convertito) {
        const primo = r.nome ? String(r.nome).split(" ")[0] : "";
        const periodo = r.checkin ? ` per il ${fmtIt(r.checkin)}${r.checkout ? " → " + fmtIt(r.checkout) : ""}` : "";
        const subject = `Le tue date a ${casa} sono ancora lì`;
        const html = `
          <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
            <h2 style="color:#b5654a;font-weight:normal">Ciao${primo ? ", " + primo : ""}!</h2>
            <p>Abbiamo visto che stavi guardando <strong>${casa}</strong> a Mondello${periodo}, ma la richiesta non è arrivata fino in fondo — capita, magari sei stato interrotto.</p>
            <p>Le date sono ancora lì: prenotando <strong>direttamente dal sito</strong> hai il miglior prezzo, nessuna commissione, e rispondiamo entro 24 ore.</p>
            <p style="text-align:center;margin:26px 0">
              <a href="${site}/#prenota" style="background:#b5654a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:100px;font-family:Arial,sans-serif">Completa la richiesta</a>
            </p>
            <p style="color:#8a8172;font-size:.92em">A presto,<br>${casa}</p>
            <hr style="border:none;border-top:1px solid #e7dccd;margin:22px 0">
            <h3 style="color:#b5654a;font-weight:normal;font-size:1.05em">Hi${primo ? ", " + primo : ""}!</h3>
            <p>We noticed you were checking ${casa} in Mondello${periodo ? " for " + periodo.replace(" per il ", "") : ""} but didn't finish your request — no worries, it happens.</p>
            <p>The dates are still there: booking <strong>directly on our site</strong> gets you the best price, no commission, and a reply within 24 hours.</p>
            <p style="color:#8a8172;font-size:.85em">If you'd rather not hear from us again about this, just ignore this email.</p>
          </div>`;
        const ok = await sendEmail(mittente, r.email, subject, html);
        if (ok) inviati++;
      } else {
        saltati++;
      }
      // Marca inviato ANCHE le eventuali righe sorelle con la stessa email
      // rimaste indietro (più tentativi di scrittura dello stesso contatto),
      // convertito o no: in entrambi i casi non c'è più nulla da fare per loro.
      await rest(`contatti_parziali?email=eq.${encodeURIComponent(r.email)}&followup_inviato=eq.false`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ followup_inviato: true }),
      });
    }

    return new Response(JSON.stringify({ candidati: righe.length, contatti_unici: perEmail.size, inviati, saltati_perche_convertiti: saltati }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
