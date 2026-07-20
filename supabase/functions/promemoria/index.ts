// PROMEMORIA PRE-CHECK-IN — Edge Function su cron.
// Manda all'ospite due promemoria prima dell'arrivo, secondo il parametro ?tipo:
//   • tipo=vigilia (default) → 1 GIORNO PRIMA: riepilogo + upsell (richieste
//     speciali, arrivo anticipato, transfer). Riduce i no-show, migliora
//     l'esperienza → più recensioni positive e più prenotazioni dirette.
//   • tipo=arrivo → il GIORNO STESSO del check-in (cron ~3h prima dell'orario di
//     arrivo): messaggio breve "oggi ti aspettiamo" con l'ora del check-in.
//
// Invia SOLO per prenotazioni CONFERMATE non ancora avvisate per quel tipo, con
// il check-in nel giorno preciso (domani per la vigilia, oggi per l'arrivo).
// Ogni tipo ha il suo flag anti-doppio-invio, quindi i due promemoria non si
// escludono a vicenda. Idempotente: rigirando lo stesso giorno non duplica.
//
// Cron consigliato (SQL Editor Supabase, pg_cron). ATTENZIONE: pg_cron gira in
// UTC. D'estate l'Italia è UTC+2, quindi togli 2 ore all'orario italiano.
//   -- vigilia: ~18:00 IT (16:00 UTC), un giorno prima
//   select cron.schedule('promemoria-vigilia-tolomea', '0 16 * * *',
//     $$ select net.http_post(
//          url:='https://<project-ref>.functions.supabase.co/promemoria?tipo=vigilia',
//          headers:='{"Content-Type":"application/json"}'::jsonb) $$);
//   -- arrivo: ~13:00 IT (11:00 UTC), 3h prima del check-in delle 16:00
//   select cron.schedule('promemoria-arrivo-tolomea', '0 11 * * *',
//     $$ select net.http_post(
//          url:='https://<project-ref>.functions.supabase.co/promemoria?tipo=arrivo',
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
function fmtIt(iso: string): string {
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
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

// Promemoria della VIGILIA (1 giorno prima): riepilogo completo + upsell.
function templateVigilia(s: Record<string, string>, r: any): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const tel = s.telefono || "";
  const site = s.site_url || "";
  const nome = r.nome ? r.nome.split(" ")[0] : "";
  const subject = `${casa} · domani si arriva 🌿`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Ci siamo${nome ? ", " + nome : ""} — si parte domani!</h2>
      <p>Manca un giorno al tuo soggiorno a <strong>${casa}</strong>. Ecco il riepilogo:</p>
      <table style="border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Check-in</td><td><strong>${fmtIt(r.checkin)}</strong> (dalle ${s.checkin_ora || "16:00"})</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Check-out</td><td><strong>${fmtIt(r.checkout)}</strong> (entro le 10:00)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Ospiti</td><td>${r.ospiti || "—"}</td></tr>
      </table>
      <p>Hai <strong>richieste speciali</strong>? Arrivo anticipato, culla, consigli su spiagge e ristoranti,
         o il transfer dall'aeroporto: rispondi a questa email o scrivici${tel ? ` su WhatsApp al <strong>${tel}</strong>` : ""}, faremo il possibile.</p>
      <p style="color:#8a8172;font-size:.92em">A domani,<br>${casa}${site ? `<br><a href="${site}" style="color:#b5654a">${site.replace(/^https?:\/\//, "")}</a>` : ""}</p>
    </div>`;
  return { subject, html };
}

// Promemoria dell'ARRIVO (giorno stesso, ~3h prima): breve e caloroso.
function templateArrivo(s: Record<string, string>, r: any): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const tel = s.telefono || "";
  const ora = s.checkin_ora || "16:00";
  const nome = r.nome ? r.nome.split(" ")[0] : "";
  const subject = `${casa} · ti aspettiamo oggi 🔑`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Oggi ti aspettiamo${nome ? ", " + nome : ""}!</h2>
      <p>Tra poche ore ci vediamo a <strong>${casa}</strong>. Il <strong>check-in è dalle ${ora}</strong>:
         ti accogliamo noi di persona per consegnarti le chiavi e mostrarti la casa.</p>
      <p>Se sei in ritardo, in anticipo o hai bisogno di indicazioni, scrivici pure${tel ? ` su WhatsApp al <strong>${tel}</strong>` : " rispondendo a questa email"} — restiamo in contatto.</p>
      <p style="color:#8a8172;font-size:.92em">A tra poco,<br>${casa}</p>
    </div>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  try {
    const tipo = new URL(req.url).searchParams.get("tipo") === "arrivo" ? "arrivo" : "vigilia";
    const s = await getSettings();
    const mittente = `${s.nome_casa || "Casa Tolomea"} <${s.email_mittente || "onboarding@resend.dev"}>`;

    // vigilia → check-in di DOMANI, flag promemoria_inviato.
    // arrivo  → check-in di OGGI,   flag promemoria_arrivo_inviato.
    const giorno = tipo === "arrivo" ? isoPlusDays(0) : isoPlusDays(1);
    const flag = tipo === "arrivo" ? "promemoria_arrivo_inviato" : "promemoria_inviato";
    const tmpl = tipo === "arrivo" ? templateArrivo : templateVigilia;

    const res = await rest(
      `richieste?select=id,nome,email,checkin,checkout,ospiti&confermata=eq.true&${flag}=eq.false&checkin=eq.${giorno}`,
    );
    if (!res.ok) throw new Error(`Query richieste fallita (HTTP ${res.status})`);
    const righe = await res.json();

    let inviati = 0;
    for (const r of righe) {
      if (!r.email) continue;
      const { subject, html } = tmpl(s, r);
      const ok = await sendEmail(mittente, r.email, subject, html);
      if (ok) {
        await rest(`richieste?id=eq.${r.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ [flag]: true }),
        });
        inviati++;
      }
    }
    return new Response(JSON.stringify({ tipo, inviati, candidati: righe.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
