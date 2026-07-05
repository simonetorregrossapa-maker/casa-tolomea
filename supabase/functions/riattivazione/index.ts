// WIN-BACK / RIATTIVAZIONE OSPITI — Edge Function su cron (settimanale).
// Ricontatta gli ospiti che hanno già soggiornato ma non tornano da un po'
// ("dormienti"), offrendo lo sconto della prenotazione diretta. Un ritorno è la
// prenotazione più redditizia: zero commissione OTA e zero costo di acquisizione.
//
// Regole di correttezza:
//   • solo ospiti con almeno un soggiorno CONFERMATO concluso da più di
//     "giorni_dormiente" giorni;
//   • esclude chi ha già una prenotazione futura (non ha senso il win-back);
//   • cooldown: non ricontatta lo stesso ospite prima di "cooldown_riattivazione"
//     giorni (log in tabella riattivazioni).
//
// Cron consigliato (pg_cron), una volta a settimana:
//   select cron.schedule('winback-casa', '0 10 * * 1',
//     $$ select net.http_post(
//          url:='https://<project-ref>.functions.supabase.co/riattivazione',
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

function template(s: Record<string, string>, nome: string): { subject: string; html: string } {
  const casa = s.nome_casa || "Casa Tolomea";
  const site = s.site_url || "";
  const pct = s.incentivo_pct || "10";
  const primo = nome ? nome.split(" ")[0] : "";
  const subject = `${casa} ti aspetta di nuovo — ${pct}% sul diretto`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Ci manchi${primo ? ", " + primo : ""} 🌅</h2>
      <p>È passato un po' dal tuo soggiorno a <strong>${casa}</strong>, e Mondello è sempre lì che aspetta:
         il mare a due passi, la casa pronta per te.</p>
      <p>Se hai voglia di tornare, prenotando <strong>direttamente dal nostro sito</strong> hai il
         <strong>${pct}% di sconto</strong> rispetto ai portali — nessuna commissione, miglior prezzo garantito.</p>
      ${site ? `<p style="text-align:center;margin:26px 0">
        <a href="${site}" style="background:#b5654a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:100px;font-family:Arial,sans-serif">Guarda le date libere</a>
      </p>` : ""}
      <p style="color:#8a8172;font-size:.92em">A presto,<br>${casa}${site ? `<br><a href="${site}" style="color:#b5654a">${site.replace(/^https?:\/\//, "")}</a>` : ""}</p>
    </div>`;
  return { subject, html };
}

Deno.serve(async () => {
  try {
    const s = await getSettings();
    const giorniDorm = parseInt(s.giorni_dormiente || "300", 10);
    const cooldown = parseInt(s.cooldown_riattivazione || "180", 10);
    const oggi = isoPlusDays(0);
    const sogliaDormiente = isoPlusDays(-giorniDorm);
    const mittente = `${s.nome_casa || "Casa Tolomea"} <${s.email_mittente || "onboarding@resend.dev"}>`;

    // Tutte le prenotazioni confermate con email, per aggregare per ospite.
    const res = await rest(`richieste?select=nome,email,checkout&confermata=eq.true&email=not.is.null`);
    if (!res.ok) throw new Error(`Query richieste fallita (HTTP ${res.status})`);
    const righe = await res.json();

    // Aggrega per email: ultimo check-out e ha prenotazioni future?
    const perOspite = new Map<string, { nome: string; ultimo: string; futura: boolean }>();
    for (const r of righe) {
      const email = String(r.email).toLowerCase().trim();
      if (!email) continue;
      const cur = perOspite.get(email) || { nome: r.nome || "", ultimo: r.checkout, futura: false };
      if (r.checkout > cur.ultimo) { cur.ultimo = r.checkout; cur.nome = r.nome || cur.nome; }
      if (r.checkout >= oggi) cur.futura = true;
      perOspite.set(email, cur);
    }

    // Chi è stato già ricontattato entro il cooldown va escluso.
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - cooldown);
    const rres = await rest(`riattivazioni?select=email&inviato=gte.${cutoff.toISOString()}`);
    const contattatiRecenti = new Set<string>(
      rres.ok ? (await rres.json()).map((x: any) => String(x.email).toLowerCase().trim()) : [],
    );

    let inviati = 0;
    for (const [email, info] of perOspite) {
      if (info.futura) continue;                    // ha già una prenotazione futura
      if (info.ultimo > sogliaDormiente) continue;  // non ancora "dormiente"
      if (contattatiRecenti.has(email)) continue;   // cooldown attivo
      const { subject, html } = template(s, info.nome);
      const ok = await sendEmail(mittente, email, subject, html);
      if (ok) {
        await rest(`riattivazioni`, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ email }),
        });
        inviati++;
      }
    }
    return new Response(JSON.stringify({ inviati, ospiti_valutati: perOspite.size }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
