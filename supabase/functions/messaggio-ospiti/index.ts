// MESSAGGIO AI CLIENTI — Edge Function chiamata dal pannello di gestione.
// Il proprietario scrive un messaggio e lo invia via Resend a un elenco di
// clienti (ospiti con soggiorno confermato) scelti nell'admin.
//
// SICUREZZA: la funzione verifica DA SÉ il token di accesso Supabase del
// proprietario (chiamando /auth/v1/user). Così resta protetta anche se venisse
// deployata con "verify JWT" OFF come le altre function a webhook. Solo un
// utente autenticato (l'unico account è il proprietario) può inviare.
//
// Body atteso (JSON):
//   { subject: string, messaggio: string,
//     destinatari: [{ email: string, nome?: string }] }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const MAX_DESTINATARI = 500;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function rest(path: string): Promise<Response> {
  return fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
}

async function getSettings(): Promise<Record<string, string>> {
  const res = await rest("settings?select=chiave,valore");
  if (!res.ok) return {};
  const map: Record<string, string> = {};
  for (const r of await res.json()) map[r.chiave] = r.valore ?? "";
  return map;
}

// Verifica il token del proprietario: /auth/v1/user risponde 200 solo con un
// access_token valido e non scaduto.
async function utenteValido(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !/^Bearer\s+.+/i.test(authHeader)) return false;
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: authHeader },
    });
    if (!res.ok) return false;
    const u = await res.json().catch(() => null);
    return !!(u && u.id);
  } catch {
    return false;
  }
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

const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
const isEmail = (s: unknown) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Testo libero → paragrafi HTML (righe vuote separano i paragrafi).
function testoAHtml(t: string): string {
  return t.trim().split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.62;color:#3a352d">${esc(p).replace(/\n/g, "<br>")}</p>`
  ).join("");
}

const WRAP = (casa: string, band: string, inner: string, foot: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1f1d18">
<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#faf6f0;border:1px solid #e7dccd;border-radius:10px;overflow:hidden">
<tr><td style="background:#a8472f;padding:16px 26px;color:#f6e7df;font-family:Georgia,serif;font-size:18px">${esc(casa)}<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e9c9bb;margin-top:2px">${esc(band)}</div></td></tr>
<tr><td style="padding:24px 26px 20px">${inner}</td></tr>
<tr><td style="border-top:1px solid #e7dccd;background:#f4ede2;padding:15px 26px;font-size:12px;color:#8a8478">${esc(foot)}</td></tr>
</table></td></tr></table>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Solo il proprietario autenticato può inviare.
  if (!(await utenteValido(req.headers.get("Authorization")))) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject ?? "").trim();
    const messaggio = String(body.messaggio ?? "").trim();
    const destinatariIn = Array.isArray(body.destinatari) ? body.destinatari : [];

    if (!subject) return json({ error: "oggetto mancante" }, 400);
    if (!messaggio) return json({ error: "messaggio mancante" }, 400);

    // Dedup + validazione email.
    const visti = new Set<string>();
    const destinatari = destinatariIn
      .map((d: { email?: string; nome?: string }) => ({ email: String(d?.email ?? "").toLowerCase().trim(), nome: String(d?.nome ?? "").trim() }))
      .filter((d: { email: string }) => {
        if (!isEmail(d.email) || visti.has(d.email)) return false;
        visti.add(d.email);
        return true;
      });

    if (!destinatari.length) return json({ error: "nessun destinatario valido" }, 400);
    if (destinatari.length > MAX_DESTINATARI) return json({ error: `troppi destinatari (max ${MAX_DESTINATARI})` }, 400);

    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const titolare = s.email_titolare || "";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;
    const foot = `${casa} · Mondello (PA)${titolare ? " · " + titolare : ""}${s.telefono ? " · " + s.telefono : ""}`;
    const corpo = testoAHtml(messaggio);

    let inviate = 0;
    const errori: string[] = [];
    for (const d of destinatari) {
      const primo = d.nome ? d.nome.split(" ")[0] : "";
      const inner = `
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:22px;color:#a8472f">Ciao${primo ? " " + esc(primo) : ""},</h1>
        ${corpo}
        <p style="margin:18px 0 2px;font-size:15px;color:#3a352d">Un caro saluto,</p>
        <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#a8472f">${esc(casa)}</p>`;
      try {
        // Reply-To al proprietario: se il cliente risponde, scrive a lui.
        const ok = await sendEmail(mittente, d.email, subject, WRAP(casa, "Un messaggio per te", inner, foot), titolare || undefined);
        if (ok) inviate++; else errori.push(d.email);
      } catch {
        errori.push(d.email);
      }
      // piccola pausa per non superare i limiti di rate di Resend
      await new Promise((r) => setTimeout(r, 260));
    }

    return json({ inviate, totale: destinatari.length, errori });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
