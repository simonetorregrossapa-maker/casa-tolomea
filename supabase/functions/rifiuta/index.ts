// RICHIESTA NON ACCOLTA — Edge Function innescata da un Database Webhook su
// UPDATE di "richieste", quando `rifiutata` passa da false a true.
//
// Perché esiste: l'email automatica di "richiesta ricevuta" promette all'ospite
// una risposta ENTRO 24 ORE. Finora, se il periodo veniva dato a un altro, la
// richiesta persa restava semplicemente "Da confermare" e l'ospite non riceveva
// niente: silenzio dopo una promessa esplicita. Qui gli si risponde, e invece
// di un "no" secco gli si propongono LE PRIME DATE ANCORA LIBERE: un ospite
// spostato vale molto più di un ospite perso.
//
// Le date libere arrivano dalla stessa fonte unica del sito (hyper-responder:
// Booking + Airbnb + Vrbo + confermate del sito + blocchi), così non possono
// contraddire quello che l'ospite vede sul calendario.
//
// Deploy con Verify JWT OFF; protezione x-webhook-secret (come "conferma").

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
function fmtIt(iso: string | null): string {
  if (!iso) return "—";
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
}
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

/* ── date ancora libere ─────────────────────────────────────────────────── */
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// Stessa logica di freeWindows() nel sito (src/booking.js): sequenze di almeno
// `minNights` notti libere consecutive, a partire da domani.
function freeWindows(busy: Set<string>, minNights: number, limit: number, horizonDays = 400) {
  const out: { start: string; end: string; nights: number }[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  let runStart: Date | null = null, run = 0;
  for (let i = 0; i < horizonDays && out.length < limit; i++) {
    const iso = isoOf(d);
    if (busy.has(iso)) {
      if (run >= minNights && runStart) out.push({ start: isoOf(runStart), end: iso, nights: run });
      runStart = null; run = 0;
    } else {
      if (!runStart) runStart = new Date(d);
      run++;
    }
    d.setDate(d.getDate() + 1);
  }
  if (run >= minNights && runStart && out.length < limit) out.push({ start: isoOf(runStart), end: isoOf(d), nights: run });
  return out;
}

// Prime finestre libere lunghe quanto il soggiorno che l'ospite aveva chiesto
// (se possibile): proporgli 2 notti quando ne voleva 7 non serve a niente.
async function dateAlternative(nottiVolute: number): Promise<{ start: string; end: string; nights: number }[]> {
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/hyper-responder`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const busy = new Set<string>();
    for (const { start, end } of (data.busy || [])) {
      if (!start || !end) continue;
      const last = parseIso(end);
      for (const d = parseIso(start); d < last; d.setDate(d.getDate() + 1)) busy.add(isoOf(d));
    }
    const target = Math.max(2, Math.min(nottiVolute || 2, 14));
    const esatte = freeWindows(busy, target, 2);
    // Se non c'è nulla di abbastanza lungo, ripiega su finestre più corte
    // invece di non proporre niente.
    return esatte.length ? esatte : freeWindows(busy, 2, 2);
  } catch (_) {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const r = body.record || {};
    const old = body.old_record || {};
    // Reagisce SOLO al rifiuto: prima non rifiutata, ora rifiutata.
    if (!(old.rifiutata !== true && r.rifiutata === true)) {
      return new Response(JSON.stringify({ ignored: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (!r.email) return new Response(JSON.stringify({ inviate: 0 }), { headers: { "Content-Type": "application/json" } });

    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;
    const titolare = s.email_titolare || "";
    const nome1 = String(r.nome || "").split(" ")[0];
    const date = `${fmtIt(r.checkin)} → ${fmtIt(r.checkout)}`;
    const notti = r.checkin && r.checkout
      ? Math.round((parseIso(r.checkout).getTime() - parseIso(r.checkin).getTime()) / 86400000)
      : 0;

    const alt = await dateAlternative(notti);
    const altHtml = alt.length
      ? `<p style="margin:16px 0 8px;font-size:15px;line-height:1.62;color:#3a352d"><b>Se puoi spostarti di qualche giorno</b>, queste date sono ancora libere:</p>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7dccd;border-radius:9px;font-size:14px">
         ${alt.map((w, i) => `<tr><td style="padding:10px 16px;${i < alt.length - 1 ? "border-bottom:1px solid #f0e7d9;" : ""}color:#3a352d"><b>${fmtIt(w.start)} → ${fmtIt(w.end)}</b></td><td style="padding:10px 16px;text-align:right;color:#6d685d;${i < alt.length - 1 ? "border-bottom:1px solid #f0e7d9;" : ""}">${w.nights} nott${w.nights === 1 ? "e" : "i"}</td></tr>`).join("")}
         </table>
         <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#6d685d">Rispondi a questa email e te le teniamo da parte.</p>`
      : `<p style="margin:16px 0 0;font-size:15px;line-height:1.62;color:#3a352d">Se hai un po' di flessibilità sulle date, rispondi a questa email: vediamo insieme cosa possiamo liberare.</p>`;

    const inner = `
      <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:23px;color:#a8472f">Ciao ${esc(nome1)}, purtroppo quelle date sono andate</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:#3a352d">Ci dispiace davvero: il periodo <b>${date}</b> è appena stato prenotato e non possiamo più tenerlo. Volevamo dirtelo subito, come promesso, invece di lasciarti in attesa.</p>
      ${altHtml}
      <p style="margin:18px 0 2px;font-size:15px;color:#3a352d">Grazie per aver pensato a noi, speriamo di ospitarti presto,</p>
      <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · ${esc(casa)}</p>
      <div style="border-top:1px solid #e7dccd;margin:22px 0 18px"></div>
      <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:20px;color:#a8472f">Sorry, those dates are gone</h2>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.62;color:#3a352d">Hi ${esc(nome1)}, we're sorry: <b>${date}</b> has just been booked. ${alt.length ? `These dates are still free: ${alt.map((w) => `<b>${fmtIt(w.start)} → ${fmtIt(w.end)}</b>`).join(", ")}. Just reply to this email and we'll hold them for you.` : "If your dates are flexible, reply to this email and we'll see what we can do."}</p>
      <p style="margin:16px 0 2px;font-size:15px;color:#3a352d">Hope to host you soon,</p>
      <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">Alessandro · ${esc(casa)}</p>`;

    const foot = `${casa} · Mondello (PA) · ${titolare} · ${s.telefono || ""}`;
    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1f1d18">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#faf6f0;border:1px solid #e7dccd;border-radius:10px;overflow:hidden">
<tr><td style="background:#a8472f;padding:16px 26px;color:#f6e7df;font-family:Georgia,serif;font-size:18px">${esc(casa)}<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9c9bb;margin-top:2px">Mondello · Sicilia</div></td></tr>
<tr><td style="padding:24px 26px 20px">${inner}</td></tr>
<tr><td style="border-top:1px solid #e7dccd;background:#f4ede2;padding:15px 26px;font-size:12px;color:#8a8478">${foot}</td></tr>
</table></td></tr></table>`;

    const ok = await sendEmail(mittente, r.email, `${casa}: le date ${date} non sono più disponibili`, html, titolare || undefined);
    return new Response(JSON.stringify({ inviate: ok ? 1 : 0, alternative: alt.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
