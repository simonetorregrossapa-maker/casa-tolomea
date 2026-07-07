// CONFERMA PRENOTAZIONE — Edge Function innescata da un Database Webhook su
// UPDATE di "richieste", quando confermata passa da false a true. Manda
// all'ospite l'email di conferma con i dati per il bonifico della caparra.
// Reply-To = proprietario. Deploy con Verify JWT OFF; protezione x-webhook-secret.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}
async function getSettings(): Promise<Record<string, string>> {
  const res = await rest("settings?select=chiave,valore");
  if (!res.ok) return {};
  const map: Record<string, string> = {};
  for (const r of await res.json()) map[r.chiave] = r.valore ?? "";
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
const euro = (n: unknown) => "€" + Math.round(Number(n) || 0).toLocaleString("it-IT");
function fmtIt(iso: string | null): string {
  if (!iso) return "—";
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
}
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const r = body.record || {};
    const old = body.old_record || {};
    // Reagisce SOLO alla conferma: prima non confermata, ora confermata.
    if (!(old.confermata !== true && r.confermata === true)) {
      return new Response(JSON.stringify({ ignored: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (!r.email) return new Response(JSON.stringify({ inviate: 0 }), { headers: { "Content-Type": "application/json" } });

    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;
    const titolare = s.email_titolare || "";
    const pct = Number(s.caparra_pct || "30") || 30;
    const caparra = Math.round((Number(r.totale_stimato) || 0) * pct / 100);
    const nome1 = String(r.nome || "").split(" ")[0];
    const date = `${fmtIt(r.checkin)} → ${fmtIt(r.checkout)}`;
    const iban = s.iban || "";
    const bic = s.bic || "";
    const intest = s.intestatario || "";
    const ora = s.checkin_ora || "16:00";
    const transfer = s.transfer_prezzo ? `${s.transfer_prezzo} €` : "";

    const inner = `
      <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:23px;color:#a8472f">La tua prenotazione è confermata</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:#3a352d">Ciao ${esc(nome1)}, ottime notizie: le date sono disponibili e Casa Tolomea è tua. Ecco come bloccarla.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7dccd;border-radius:9px;font-size:14px">
      <tr><td style="padding:10px 16px;color:#6d685d;border-bottom:1px solid #f0e7d9">Soggiorno</td><td style="padding:10px 16px;text-align:right;font-weight:bold;border-bottom:1px solid #f0e7d9">${date}</td></tr>
      <tr><td style="padding:10px 16px;color:#6d685d;border-bottom:1px solid #f0e7d9">Ospiti</td><td style="padding:10px 16px;text-align:right;font-weight:bold;border-bottom:1px solid #f0e7d9">${esc(r.ospiti)}</td></tr>
      <tr><td style="padding:10px 16px;color:#6d685d;border-bottom:1px solid #f0e7d9">Totale</td><td style="padding:10px 16px;text-align:right;font-family:Georgia,serif;font-size:18px;color:#a8472f;border-bottom:1px solid #f0e7d9">${euro(r.totale_stimato)}</td></tr>
      <tr><td style="padding:10px 16px;color:#6d685d">Caparra da versare (${pct}%)</td><td style="padding:10px 16px;text-align:right;font-family:Georgia,serif;font-size:18px;color:#a8472f">${euro(caparra)}</td></tr></table>
      <p style="margin:16px 0 6px;font-size:15px;line-height:1.62;color:#3a352d"><b>Per bloccare le date</b>, versa la caparra con un bonifico:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#4d5340;border-radius:9px;color:#eef0e8"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.5">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c3cbb2">Intestatario</div><div style="font-size:16px;font-weight:bold;margin-bottom:10px">${esc(intest)}</div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c3cbb2">IBAN</div><div style="font-size:16px;font-weight:bold;letter-spacing:.03em;margin-bottom:10px">${esc(iban)}</div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c3cbb2">BIC / SWIFT</div><div style="font-size:16px;font-weight:bold;margin-bottom:10px">${esc(bic)}</div>
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c3cbb2">Causale</div><div style="font-size:14px;font-weight:bold">Caparra ${esc(casa)} – ${esc(r.nome)} – ${fmtIt(r.checkin)}</div>
      </td></tr></table>
      <p style="margin:16px 0 14px;font-size:15px;line-height:1.62;color:#3a352d">Il <b>saldo</b> lo versi il giorno dell'arrivo. Le tariffe includono già la <b>tassa di soggiorno</b>. Il check-in è dalle <b>${esc(ora)}</b>: <b>ti accogliamo noi di persona</b> per consegnarti le chiavi e mostrarti la casa. Qualche giorno prima ti mandiamo un promemoria con gli ultimi dettagli.</p>
      ${transfer ? `<p style="margin:0 0 2px;font-size:15px;line-height:1.62;color:#4d5340">Vuoi arrivare senza pensieri? Organizziamo il <b>transfer da/per l'aeroporto di Palermo a ${esc(transfer)} a tratta</b> — chiedici pure.</p>` : ""}
      <p style="margin:18px 0 2px;font-size:15px;color:#3a352d">Non vediamo l'ora di ospitarti,</p><p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · Casa Tolomea</p>
      <div style="border-top:1px solid #e7dccd;margin:22px 0 18px"></div>
      <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:20px;color:#a8472f">Your booking is confirmed</h2>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.62;color:#3a352d"><b>To lock the dates</b>, pay the ${pct}% deposit (${euro(caparra)}) by bank transfer — holder: ${esc(intest)} · IBAN ${esc(iban)} · BIC ${esc(bic)}. Reference: <i>Deposit ${esc(casa)} – ${esc(r.nome)} – ${fmtIt(r.checkin)}</i>. The balance is paid on arrival, tourist tax included. Check-in from ${esc(ora)}: <b>we'll welcome you in person</b> to hand over the keys and show you around.</p>
      <p style="margin:16px 0 2px;font-size:15px;color:#3a352d">We can't wait to host you,</p><p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · Casa Tolomea</p>`;

    const foot = `${casa} · Mondello (PA) · ${titolare} · ${s.telefono || ""}`;
    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1f1d18">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#faf6f0;border:1px solid #e7dccd;border-radius:10px;overflow:hidden">
<tr><td style="background:#a8472f;padding:16px 26px;color:#f6e7df;font-family:Georgia,serif;font-size:18px">Casa Tolomea<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9c9bb;margin-top:2px">Mondello · Sicilia</div></td></tr>
<tr><td style="padding:24px 26px 20px">${inner}</td></tr>
<tr><td style="border-top:1px solid #e7dccd;background:#f4ede2;padding:15px 26px;font-size:12px;color:#8a8478">${foot}</td></tr>
</table></td></tr></table>`;

    const ok = await sendEmail(mittente, r.email, `La tua prenotazione a ${casa} è confermata`, html, titolare || undefined);
    return new Response(JSON.stringify({ inviate: ok ? 1 : 0 }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
