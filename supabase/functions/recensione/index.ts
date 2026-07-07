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

async function sendEmail(from: string, to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY non configurata");
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

// Email di richiesta recensione. Gentile ma diretta all'obiettivo (la recensione),
// con "review gating": chi è soddisfatto va al bottone pubblico (recensioni_url),
// chi ha avuto problemi risponde in privato (Reply-To = titolare) così il
// feedback negativo arriva ai proprietari invece che finire in una recensione
// pubblica. Bilingue IT/EN, brand terracotta.
function template(s: Record<string, string>, r: any): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const site = s.site_url || "";
  const url = s.recensioni_url || "";
  const titolare = s.email_titolare || "";
  const nome = r.nome ? String(r.nome).split(" ")[0] : "";
  const subject = `${nome ? nome + ", com" : "Com"}'è andata a ${casa}?`;
  const foot = `${casa} · Mondello (PA)${titolare ? " · " + titolare : ""}`;

  const btn = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 2px"><tr><td style="background:#a8472f;border-radius:100px">
         <a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:bold">★ Lascia una recensione</a>
       </td></tr></table>
       <p style="text-align:center;margin:8px 0 0;font-size:12.5px;color:#8a8478">Ti bastano 30 secondi</p>`
    : `<p style="text-align:center;margin:16px 0;font-size:15px;line-height:1.6;color:#3a352d">Ti basta <b>rispondere a questa email</b> con la tua impressione: anche due righe ci aiutano tantissimo.</p>`;

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1f1d18">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#faf6f0;border:1px solid #e7dccd;border-radius:10px;overflow:hidden">
<tr><td style="background:#a8472f;padding:16px 26px;color:#f6e7df;font-family:Georgia,serif;font-size:18px">${casa}<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9c9bb;margin-top:2px">Mondello · Sicilia</div></td></tr>
<tr><td style="padding:24px 26px 20px">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:23px;color:#a8472f">Com'è andata${nome ? ", " + nome : ""}?</h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:#3a352d">Grazie per aver scelto <b>${casa}</b>. Speriamo che Mondello ti abbia regalato giorni belli, con il mare a due passi.</p>
  <p style="margin:0 0 4px;font-size:15px;line-height:1.62;color:#3a352d"><b>Ci lasceresti una recensione?</b> Siamo una casa gestita da una famiglia: il tuo giudizio fa una differenza enorme e aiuta altri ospiti a sceglierci con fiducia.</p>
  ${btn}
  <div style="border-top:1px solid #e7dccd;margin:22px 0 16px"></div>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#6d685d">C'è qualcosa che non è andato come speravi? <b>Rispondi a questa email</b>: ci teniamo a sistemarlo di persona.</p>
  <p style="margin:0 0 2px;font-size:14px;line-height:1.6;color:#4d5340">E se vorrai tornare, prenotando <b>diretto dal nostro sito</b> hai sempre il miglior prezzo, senza commissioni.</p>
  <p style="margin:16px 0 2px;font-size:15px;color:#3a352d">Un caro saluto,</p><p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro e Marcella · ${casa}</p>
  <div style="border-top:1px solid #e7dccd;margin:22px 0 16px"></div>
  <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:19px;color:#a8472f">How was your stay${nome ? ", " + nome : ""}?</h2>
  <p style="margin:0 0 12px;font-size:14.5px;line-height:1.6;color:#3a352d">Thank you for choosing ${casa}. If you enjoyed it, <b>would you leave us a review?</b> ${url ? "Just tap the button above — it takes 30 seconds and means the world to a family-run home." : "Simply reply to this email with a few words."} Something not quite right? <b>Reply to this email</b> and we'll make it right.</p>
  <p style="margin:12px 0 2px;font-size:14.5px;color:#3a352d">Warm regards,</p><p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#a8472f">Alessandro &amp; Marcella · ${casa}</p>
</td></tr>
<tr><td style="border-top:1px solid #e7dccd;background:#f4ede2;padding:15px 26px;font-size:12px;color:#8a8478">${foot}${site ? ` · <a href="${site}" style="color:#a8472f">${site.replace(/^https?:\/\//, "")}</a>` : ""}</td></tr>
</table></td></tr></table>`;
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
      const ok = await sendEmail(mittente, r.email, subject, html, s.email_titolare || undefined);
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
