// POSTO LIBERO — Edge Function innescata da un Database Webhook su UPDATE di
// "richieste". Quando una prenotazione CONFERMATA viene annullata (confermata
// passa da true a false) quel periodo torna libero: avvisa via email chi è in
// lista d'attesa (liste_attesa) con date che si sovrappongono e non è ancora
// stato avvisato, poi lo marca avvisato. Riempie i buchi da cancellazione con
// prenotazioni dirette → notti altrimenti perse.
//
// Setup (Supabase Dashboard):
//   • Database → Webhooks → Create: tabella "richieste", evento UPDATE,
//     tipo HTTP Request → questa function, header
//     "x-webhook-secret: <valore di WEBHOOK_SECRET>".
//   • Deploy con Verify JWT OFF (la protezione è il secret nell'header).

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

function fmtIt(iso: string | null): string {
  if (!iso) return "";
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
}

// Due periodi [aIn, aOut) e [bIn, bOut) si sovrappongono se aIn < bOut && bIn < aOut.
// Un'iscrizione senza date (dal/al null) è "flessibile": combacia sempre.
function overlaps(dal: string | null, al: string | null, ci: string, co: string): boolean {
  if (!dal || !al) return true;
  return dal < co && ci < al;
}

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const record = body.record || {};
    const old = body.old_record || {};

    // Reagisce SOLO alle cancellazioni: era confermata, ora non lo è più.
    const eraConfermata = old.confermata === true;
    const oraAnnullata = record.confermata === false;
    if (!(eraConfermata && oraAnnullata)) {
      return new Response(JSON.stringify({ ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    const ci = record.checkin, co = record.checkout;
    if (!ci || !co) return new Response(JSON.stringify({ avvisati: 0 }), { headers: { "Content-Type": "application/json" } });

    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const site = s.site_url || "";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;

    // Candidati: in lista d'attesa, non ancora avvisati.
    const res = await rest(`liste_attesa?select=id,nome,email,dal,al&avvisato=eq.false`);
    if (!res.ok) throw new Error(`Query liste_attesa fallita (HTTP ${res.status})`);
    const lista = await res.json();

    let avvisati = 0;
    for (const w of lista) {
      if (!w.email) continue;
      if (!overlaps(w.dal, w.al, ci, co)) continue;
      const primo = w.nome ? String(w.nome).split(" ")[0] : "";
      const periodo = fmtIt(ci) ? ` (${fmtIt(ci)} → ${fmtIt(co)})` : "";
      const subject = `Si è liberato un periodo a ${casa}${periodo}! 🌊`;
      const html = `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
          <h2 style="color:#b5654a;font-weight:normal">Buone notizie${primo ? ", " + primo : ""}!</h2>
          <p>Si è appena liberato un periodo${periodo} a <strong>${casa}</strong>, che combacia con le date che ci avevi segnalato.</p>
          <p>Va velocissimo: se ti interessa, prenota <strong>direttamente dal nostro sito</strong> — miglior prezzo e nessuna commissione.</p>
          ${site ? `<p style="text-align:center;margin:26px 0">
            <a href="${site}" style="background:#b5654a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:100px;font-family:Arial,sans-serif">Prenota ora</a>
          </p>` : ""}
          <p style="color:#8a8172;font-size:.92em">A presto,<br>${casa}</p>
        </div>`;
      const ok = await sendEmail(mittente, w.email, subject, html);
      if (ok) {
        await rest(`liste_attesa?id=eq.${w.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ avvisato: true }),
        });
        avvisati++;
      }
    }
    return new Response(JSON.stringify({ avvisati, valutati: lista.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
