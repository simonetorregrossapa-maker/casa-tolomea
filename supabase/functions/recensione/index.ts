// RICHIESTA RECENSIONE — Edge Function su cron (giornaliero).
// Qualche giorno dopo il check-out chiede all'ospite una recensione. Le
// recensioni migliorano il ranking sulle OTA e la fiducia di chi valuta la
// prenotazione diretta → più prenotazioni. Se è impostato "recensioni_url"
// (Google/Booking) il bottone porta lì; altrimenti invita a rispondere via email.
//
// Invia SOLO per prenotazioni CONFERMATE non ancora "recensione_inviata", con
// check-out tra (oggi - 30) e (oggi - giorni_recensione). Marca il flag dopo
// l'invio. Idempotente.
//
// Cron consigliato (pg_cron), una volta al giorno:
//   select cron.schedule('recensione-casa', '30 10 * * *',
//     $$ select net.http_post(
//          url:='https://<project-ref>.functions.supabase.co/recensione',
//          headers:='{"Content-Type":"application/json"}'::jsonb) $$);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const pad2 = (n: number) => String(n).padStart(2, "0");
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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
  const rows = await res.json();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.chiave] = r.valore ?? "";
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

function template(s: Record<string, string>, r: any): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const site = s.site_url || "";
  const url = s.recensioni_url || "";
  const nome = r.nome ? r.nome.split(" ")[0] : "";
  const subject = `Com'è andata a ${casa}? 🌊`;
  const cta = url
    ? `<p style="text-align:center;margin:26px 0">
         <a href="${url}" style="background:#b5654a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:100px;font-family:Arial,sans-serif">Lascia una recensione</a>
       </p>`
    : `<p>Ci basta una tua risposta a questa email: anche due righe ci aiutano tantissimo, e ci fa piacere sapere com'è andata.</p>`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Grazie di essere stato con noi${nome ? ", " + nome : ""}!</h2>
      <p>Speriamo tu abbia trascorso giorni sereni a <strong>${casa}</strong>, a due passi dal mare di Mondello.</p>
      <p>Se ti va, ci lasceresti una recensione? Aiuta chi cerca una casa come la nostra a sceglierla con fiducia — e a noi a migliorare ancora.</p>
      ${cta}
      <p>E ricorda: la prossima volta, prenotando <strong>direttamente dal nostro sito</strong>, hai il miglior prezzo e nessuna commissione. Ci farebbe piacere riaverti.</p>
      <p style="color:#8a8172;font-size:.92em">Un caro saluto,<br>${casa}${site ? `<br><a href="${site}" style="color:#b5654a">${site.replace(/^https?:\/\//, "")}</a>` : ""}</p>
    </div>`;
  return { subject, html };
}

Deno.serve(async () => {
  try {
    const s = await getSettings();
    const giorni = parseInt(s.giorni_recensione || "1", 10);
    const finePeriodo = isoPlusDays(-giorni); // check-out avvenuto almeno "giorni" fa
    const inizioPeriodo = isoPlusDays(-30);   // ma non più vecchio di 30 giorni
    const mittente = `${s.nome_casa || "Casa Tolomea"} <${s.email_mittente || "onboarding@resend.dev"}>`;

    const res = await rest(
      `richieste?select=id,nome,email,checkout&confermata=eq.true&recensione_inviata=eq.false&checkout=lte.${finePeriodo}&checkout=gte.${inizioPeriodo}`,
    );
    if (!res.ok) throw new Error(`Query richieste fallita (HTTP ${res.status})`);
    const righe = await res.json();

    let inviati = 0;
    for (const r of righe) {
      if (!r.email) continue;
      const { subject, html } = template(s, r);
      const ok = await sendEmail(mittente, r.email, subject, html);
      if (ok) {
        await rest(`richieste?id=eq.${r.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ recensione_inviata: true }),
        });
        inviati++;
      }
    }
    return new Response(JSON.stringify({ inviati, candidati: righe.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
