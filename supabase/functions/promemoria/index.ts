// PROMEMORIA PRE-CHECK-IN — Edge Function su cron (giornaliero).
// Manda all'ospite un'email qualche giorno prima dell'arrivo con le info utili
// e un piccolo upsell (richieste speciali, arrivo anticipato). Riduce i no-show
// e migliora l'esperienza → più recensioni positive e più prenotazioni dirette.
//
// Invia SOLO per prenotazioni CONFERMATE non ancora "promemoria_inviato", con
// check-in tra oggi e oggi+giorni_promemoria. Marca il flag dopo l'invio, così
// non parte due volte. È idempotente: se gira più volte nello stesso giorno non
// duplica gli invii.
//
// Cron consigliato (SQL Editor Supabase, pg_cron): una volta al giorno.
//   select cron.schedule('promemoria-casa', '0 9 * * *',
//     $$ select net.http_post(
//          url:='https://<project-ref>.functions.supabase.co/promemoria',
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

function template(s: Record<string, string>, r: any): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const tel = s.telefono || "";
  const site = s.site_url || "";
  const nome = r.nome ? r.nome.split(" ")[0] : "";
  const subject = `${casa} · il tuo arrivo si avvicina 🌿`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Ci siamo quasi${nome ? ", " + nome : ""}!</h2>
      <p>Manca poco al tuo soggiorno a <strong>${casa}</strong>. Ecco il riepilogo:</p>
      <table style="border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Check-in</td><td><strong>${fmtIt(r.checkin)}</strong> (dalle 15:00)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Check-out</td><td><strong>${fmtIt(r.checkout)}</strong> (entro le 10:00)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8172">Ospiti</td><td>${r.ospiti || "—"}</td></tr>
      </table>
      <p>Hai <strong>richieste speciali</strong>? Arrivo anticipato, culla, consigli su spiagge e ristoranti,
         o il transfer dall'aeroporto: rispondi a questa email o scrivici${tel ? ` su WhatsApp al <strong>${tel}</strong>` : ""}, faremo il possibile.</p>
      <p style="color:#8a8172;font-size:.92em">A presto,<br>${casa}${site ? `<br><a href="${site}" style="color:#b5654a">${site.replace(/^https?:\/\//, "")}</a>` : ""}</p>
    </div>`;
  return { subject, html };
}

Deno.serve(async () => {
  try {
    const s = await getSettings();
    const giorni = parseInt(s.giorni_promemoria || "3", 10);
    const oggi = isoPlusDays(0);
    const limite = isoPlusDays(giorni);
    const mittente = `${s.nome_casa || "Casa Tolomea"} <${s.email_mittente || "onboarding@resend.dev"}>`;

    // Confermate, non ancora avvisate, con check-in nella finestra [oggi, oggi+giorni].
    const res = await rest(
      `richieste?select=id,nome,email,checkin,checkout,ospiti&confermata=eq.true&promemoria_inviato=eq.false&checkin=gte.${oggi}&checkin=lte.${limite}`,
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
          body: JSON.stringify({ promemoria_inviato: true }),
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
