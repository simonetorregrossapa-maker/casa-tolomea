// NUOVA RICHIESTA — Edge Function innescata da un Database Webhook su INSERT di
// "richieste". Manda due email via Resend:
//   1) al PROPRIETARIO (email_titolare): notifica con i dettagli, Reply-To = ospite
//   2) all'OSPITE: "richiesta ricevuta", Reply-To = proprietario
// Sostituisce l'invio EmailJS lato sito. Deploy con Verify JWT OFF; protezione
// tramite header x-webhook-secret.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

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

const WRAP = (band: string, inner: string, foot: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1f1d18">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#faf6f0;border:1px solid #e7dccd;border-radius:10px;overflow:hidden">
<tr><td style="background:#a8472f;padding:16px 26px;color:#f6e7df;font-family:Georgia,serif;font-size:18px">Casa Tolomea<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9c9bb;margin-top:2px">${band}</div></td></tr>
<tr><td style="padding:24px 26px 20px">${inner}</td></tr>
<tr><td style="border-top:1px solid #e7dccd;background:#f4ede2;padding:15px 26px;font-size:12px;color:#8a8478">${foot}</td></tr>
</table></td></tr></table>`;

const row = (k: string, v: string, price = false) =>
  `<tr><td style="padding:10px 16px;color:#6d685d;border-bottom:1px solid #f0e7d9">${k}</td><td style="padding:10px 16px;text-align:right;${price ? "font-family:Georgia,serif;font-size:18px;color:#a8472f" : "font-weight:bold"};border-bottom:1px solid #f0e7d9">${v}</td></tr>`;

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const r = body.record || {};
    if (!r.email && !r.checkin) return new Response(JSON.stringify({ ignored: true }), { headers: { "Content-Type": "application/json" } });

    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const titolare = s.email_titolare || "";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;
    const foot = `${casa} · Mondello (PA) · ${s.email_titolare || ""} · ${s.telefono || ""}`;
    const date = `${fmtIt(r.checkin)} → ${fmtIt(r.checkout)}`;
    let inviate = 0;

    // 1) Notifica al proprietario
    if (titolare) {
      const inner = `
        <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:23px;color:#a8472f">Nuova richiesta di prenotazione</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a352d">Hai ricevuto una richiesta diretta dal sito. Ecco i dettagli per rispondere.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7dccd;border-radius:9px;font-size:14px">
        ${row("Ospite", esc(r.nome))}${row("Date", date)}${row("Ospiti", esc(r.ospiti))}${row("Totale stimato", euro(r.totale_stimato), true)}${row("Email", esc(r.email))}${row("Telefono", esc(r.telefono) || "—")}
        <tr><td style="padding:10px 16px;color:#6d685d">Note</td><td style="padding:10px 16px;text-align:right;font-weight:bold">${esc(r.note) || "—"}</td></tr></table>
        <div style="background:#f6e7df;border-radius:9px;padding:14px 16px;margin:18px 0 6px;font-size:13.5px;line-height:1.55;color:#7a3b28"><b>Rispondi entro 24 ore</b> per non perdere la prenotazione. Puoi rispondere direttamente a questa email (arriva all'ospite), poi segna la richiesta come <b>confermata</b> nel pannello.</div>`;
      if (await sendEmail(mittente, titolare, `Nuova richiesta di prenotazione — ${esc(r.nome)}`, WRAP("Notifica dal sito", inner, foot), r.email || undefined)) inviate++;
    }

    // 2) Conferma ricezione all'ospite
    if (r.email) {
      const inner = `
        <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:23px;color:#a8472f">Ciao ${esc(String(r.nome || "").split(" ")[0])},</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:#3a352d">grazie per aver scelto di prenotare <b>direttamente con noi</b>. Abbiamo ricevuto la tua richiesta per Casa Tolomea, a 700 m dal mare di Mondello, e la stiamo verificando.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7dccd;border-radius:9px;font-size:14px">
        ${row("Il tuo soggiorno", date)}${row("Ospiti", esc(r.ospiti))}<tr><td style="padding:10px 16px;color:#6d685d">Totale stimato</td><td style="padding:10px 16px;text-align:right;font-family:Georgia,serif;font-size:18px;color:#a8472f">${euro(r.totale_stimato)}</td></tr></table>
        <p style="margin:16px 0 14px;font-size:15px;line-height:1.62;color:#3a352d">Ti rispondiamo <b>entro 24 ore</b> con la conferma della disponibilità. Alla conferma ti invieremo i dati per versare la <b>caparra del 30% con bonifico</b>; il saldo lo paghi comodamente all'arrivo, tassa di soggiorno inclusa.</p>
        <p style="margin:0 0 6px;font-size:15px;line-height:1.62;color:#4d5340">Prenotando direttamente hai il <b>miglior prezzo, senza commissioni</b>, e parli sempre con chi conosce davvero la casa.</p>
        <p style="margin:18px 0 2px;font-size:15px;color:#3a352d">A presto,</p><p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · Casa Tolomea</p>
        <div style="border-top:1px solid #e7dccd;margin:22px 0 18px"></div>
        <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:20px;color:#a8472f">Hi ${esc(String(r.nome || "").split(" ")[0])},</h2>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:#3a352d">thank you for booking <b>directly with us</b>. We've received your request for Casa Tolomea and we're checking availability. We'll reply <b>within 24 hours</b>; on confirmation we'll send the details to pay the <b>30% deposit by bank transfer</b>, balance on arrival, tourist tax included.</p>
        <p style="margin:16px 0 2px;font-size:15px;color:#3a352d">See you soon,</p><p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · Casa Tolomea</p>`;
      if (await sendEmail(mittente, r.email, `Abbiamo ricevuto la tua richiesta — ${casa}`, WRAP("Mondello · Sicilia", inner, foot), titolare || undefined)) inviate++;
    }

    return new Response(JSON.stringify({ inviate }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
