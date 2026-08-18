// RECUPERO ABBANDONO — Edge Function su cron.
//
// Manda un'email di recupero a chi ha lasciato l'email (nel form di
// prenotazione, nel widget "avvisami se si libera" o nel popup exit-intent)
// ma non ha completato NÉ una richiesta di prenotazione NÉ un'iscrizione
// alla lista d'attesa. L'interesse va ripreso a CALDO: qualche ora dopo,
// non giorni dopo (vedi soglie sotto).
//
// ── COSA DEVE MANTENERE (rifatta il 17/08/2026) ────────────────────────────
// Il popup promette all'ospite "dicci le date e ti rispondiamo con
// disponibilità e prezzo". Questa email è la risposta, quindi:
//   • la DISPONIBILITÀ si verifica adesso, chiamando hyper-responder (la
//     stessa fonte del calendario del sito). Se quelle notti nel frattempo
//     sono state prese su Booking, glielo si dice e si propongono le prime
//     libere, invece di invitarlo a prenotare qualcosa che non c'è più;
//   • il PREZZO arriva dalla riga in `contatti_parziali` (colonna `totale`),
//     calcolato dal sito quando l'ospite ha lasciato l'email: il listino vive
//     in src/data.js e non nel database, e così la cifra citata è esattamente
//     quella che quella persona ha visto;
//   • se il calendario non risponde non si afferma niente sulle date.
// Il testo cambia anche in base a `origine`: a chi arriva dal popup non si può
// dire "non hai completato la richiesta", perché non ne ha mai iniziata una.
//
// Legge dalla tabella `contatti_parziali` (vedi
// supabase/migrations/2026-08-12-contatti-parziali.sql), popolata dal
// salvataggio progressivo lato client (src/analytics.js
// salvaContattoParziale, invocata da BookForm/Waitlist/ExitIntentPopup in
// src/App.jsx).
//
// Idempotente: ogni riga ha un flag anti-doppio-invio (followup_inviato).
// Se nel frattempo la stessa persona (stessa email) ha completato una
// richiesta o si è iscritta alla lista d'attesa, NON le manda nulla: ha già
// convertito, non ricontattarla la spamma inutilmente.
//
// Cron consigliato (SQL Editor Supabase, pg_cron). ATTENZIONE: pg_cron gira
// in UTC. Ogni 30 minuti è sufficiente: la finestra "qualche ora" sotto
// assorbe lo scarto.
//   select cron.schedule('recupero-abbandono-tolomea', '*/30 * * * *',
//     $$ select net.http_post(
//          url:='https://wbooxigzhkjljkkroibn.functions.supabase.co/recupero-abbandono',
//          headers:='{"Content-Type":"application/json"}'::jsonb) $$);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// Non troppo presto (l'utente potrebbe solo essere passato a un altro campo
// del form) e non troppo tardi (l'interesse si raffredda, e i portali sono
// lì pronti a intercettarlo). Tra 3 e 72 ore dalla cattura.
const ORE_MIN = 3;
const ORE_MAX = 72;

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

const eur = (n: number) => `€ ${n.toLocaleString("it-IT")}`;

type Riga = {
  id: number; origine: string; email: string; telefono: string | null; nome: string | null;
  checkin: string | null; checkout: string | null; creato: string;
  totale: number | null; notti: number | null;
};

/* ── Disponibilità, verificata nel momento in cui si scrive ───────────────
   Il popup promette "ti rispondiamo con disponibilità e prezzo": la
   disponibilità va guardata ADESSO, non quando l'ospite ha lasciato l'email,
   perché nel frattempo quelle notti possono essere state prese su Booking.
   Fonte: hyper-responder, la stessa che usa il calendario del sito.        */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

async function dateOccupate(): Promise<Set<string> | null> {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/hyper-responder`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    const set = new Set<string>();
    for (const b of data.busy || []) {
      const fine = daIso(b.end); // check-out escluso: le notti prese sono [start, end)
      for (const d = daIso(b.start); d < fine; d.setDate(d.getDate() + 1)) set.add(iso(d));
    }
    return set;
  } catch {
    return null; // non raggiungibile: meglio non affermare niente sulle date
  }
}

function rangeLibero(ci: string, co: string, occupate: Set<string>): boolean {
  const fine = daIso(co);
  for (const d = daIso(ci); d < fine; d.setDate(d.getDate() + 1)) if (occupate.has(iso(d))) return false;
  return true;
}

// Prima finestra libera di almeno `min` notti a partire da domani: serve a non
// lasciare a mani vuote chi ha chiesto date ormai prese.
function primaFinestra(occupate: Set<string>, min = 3, giorni = 240): { dal: string; al: string } | null {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
  let inizio: Date | null = null, run = 0;
  for (let i = 0; i < giorni; i++) {
    if (occupate.has(iso(d))) { inizio = null; run = 0; }
    else { if (!inizio) inizio = new Date(d); run++; if (run >= min) break; }
    d.setDate(d.getDate() + 1);
  }
  if (!inizio || run < min) return null;
  const al = new Date(inizio); al.setDate(al.getDate() + run);
  return { dal: iso(inizio), al: iso(al) };
}

// Ha già convertito? Stessa email, riga più recente della cattura parziale,
// in richieste O in liste_attesa. Se sì, non le manda nulla: ha già agito.
async function giaConvertito(email: string, dopo: string): Promise<boolean> {
  const q = `select=id&email=eq.${encodeURIComponent(email)}&creato=gte.${encodeURIComponent(dopo)}&limit=1`;
  const [r1, r2] = await Promise.all([rest(`richieste?${q}`), rest(`liste_attesa?${q}`)]);
  const [j1, j2] = await Promise.all([
    r1.ok ? r1.json() : Promise.resolve([]),
    r2.ok ? r2.json() : Promise.resolve([]),
  ]);
  return (Array.isArray(j1) && j1.length > 0) || (Array.isArray(j2) && j2.length > 0);
}

/* ── Il testo dell'email ──────────────────────────────────────────────────
   Deve dire esattamente quello che il popup ha promesso: disponibilità e
   prezzo. Quattro situazioni, quattro testi diversi, mai una parola più di
   quello che sappiamo davvero.
     1. date + calendario libero  → "sono libere", con il totale se ce l'abbiamo
     2. date + notti già prese    → lo diciamo subito e proponiamo le prime libere
     3. calendario non raggiungibile → nessuna affermazione, verifica entro 24 ore
     4. nessuna data              → chiediamo le date
   L'attacco cambia anche in base a DOVE è arrivato il contatto: chi ha
   lasciato l'email nel popup non ha mai iniziato nessuna richiesta, e dirgli
   "non hai completato la richiesta" sarebbe falso.                        */
function componiEmail(
  r: Riga,
  { casa, site, occupate }: { casa: string; site: string; occupate: Set<string> | null },
): { subject: string; html: string } {
  const primo = r.nome ? String(r.nome).split(" ")[0] : "";
  const daPopup = r.origine === "popup" || r.origine === "popup-guida";
  const haDate = Boolean(r.checkin && r.checkout);
  const periodo = haDate ? `dal ${fmtIt(r.checkin)} al ${fmtIt(r.checkout)}` : "";
  const link = `${site}/#prenota`;

  const libere = haDate && occupate ? rangeLibero(r.checkin!, r.checkout!, occupate) : null;
  const alternativa = libere === false && occupate ? primaFinestra(occupate) : null;

  // "Abbiamo controllato il calendario" si può dire soltanto se il calendario
  // è stato davvero letto: altrimenti è una frase di comodo.
  const verificato = haDate && occupate !== null;
  const apertura = (daPopup
    ? `Ci hai lasciato la tua email su <strong>${casa}</strong> a Mondello${haDate ? ` chiedendo le date ${periodo}` : ""}.`
    : `Stavi guardando <strong>${casa}</strong> a Mondello${haDate ? ` ${periodo}` : ""} ma la richiesta non è arrivata fino in fondo. Capita, magari sei stato interrotto.`)
    + (verificato ? " Abbiamo controllato il calendario." : "");

  let subject: string;
  let corpo: string;
  let corpoEn: string;
  let cta = "Invia la richiesta";
  let ctaEn = "Send your request";

  const periodoCap = periodo.charAt(0).toUpperCase() + periodo.slice(1);

  if (haDate && libere === true) {
    subject = `${periodoCap}: la casa è libera`;
    const prezzo = r.totale
      ? `<p>Per ${r.notti ?? ""} notti il totale è <strong>${eur(r.totale)}</strong>, alle stesse condizioni del sito: pulizia finale e tassa di soggiorno già incluse, nessun costo aggiunto.</p>`
      : `<p>Il totale per quelle notti te lo confermiamo entro 24 ore.</p>`;
    corpo = `<p><strong>Quelle notti sono ancora libere.</strong></p>${prezzo}
      <p>Se le vuoi, mandaci la richiesta dal sito: rispondiamo entro 24 ore, non si paga niente adesso e non passi da nessun portale.</p>`;
    corpoEn = `<p><strong>Those nights are still available.</strong></p>
      ${r.totale ? `<p>The total for ${r.notti ?? ""} nights is <strong>${eur(r.totale)}</strong>, final cleaning and city tax included.</p>` : ""}
      <p>Send us your request from the site: we reply within 24 hours, nothing to pay now.</p>`;
    cta = "Blocca queste date";
    ctaEn = "Book these dates";
  } else if (haDate && libere === false) {
    subject = `${periodoCap}: purtroppo è già preso`;
    corpo = `<p><strong>Purtroppo quelle notti risultano già prenotate.</strong> Ci dispiace, ma preferiamo dirtelo subito invece di farti aspettare.</p>
      ${alternativa
        ? `<p>Il primo periodo libero è <strong>dal ${fmtIt(alternativa.dal)} al ${fmtIt(alternativa.al)}</strong>. Se ti torna, scrivici e te lo teniamo.</p>`
        : `<p>Scrivici le date che potresti spostare e ti diciamo subito cosa c'è di libero.</p>`}`;
    corpoEn = `<p>We checked the calendar: <strong>those nights are already booked.</strong> We would rather tell you straight away.</p>
      ${alternativa ? `<p>The first free period is <strong>${fmtIt(alternativa.dal)} to ${fmtIt(alternativa.al)}</strong>.</p>` : ""}`;
    cta = "Guarda le date libere";
    ctaEn = "See available dates";
  } else if (haDate) {
    // Calendario non raggiungibile: nessuna promessa sulle date.
    subject = `Le tue date a ${casa}`;
    corpo = `<p>Stiamo verificando il calendario per quelle notti e ti confermiamo la disponibilità entro 24 ore.</p>
      ${r.totale ? `<p>Il prezzo per quelle ${r.notti ?? ""} notti è <strong>${eur(r.totale)}</strong>, pulizia finale e tassa di soggiorno incluse.</p>` : ""}`;
    corpoEn = `<p>We are checking the calendar for those dates and will confirm availability within 24 hours.</p>
      ${r.totale ? `<p>The price for those nights is <strong>${eur(r.totale)}</strong>, cleaning and city tax included.</p>` : ""}`;
  } else {
    subject = `Che date hai in mente per ${casa}?`;
    corpo = `<p>Dicci le date che hai in mente e ti rispondiamo con disponibilità e prezzo, senza impegno e senza registrazione.</p>
      <p>Prenotando direttamente da noi paghi meno che sui portali, perché in mezzo non c'è nessuna commissione.</p>`;
    corpoEn = `<p>Tell us the dates you have in mind and we will reply with availability and price, no strings attached.</p>`;
  }

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2b28;line-height:1.6">
      <h2 style="color:#b5654a;font-weight:normal">Ciao${primo ? ", " + primo : ""}!</h2>
      <p>${apertura}</p>
      ${corpo}
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="background:#b5654a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:100px;font-family:Arial,sans-serif">${cta}</a>
      </p>
      <p style="color:#8a8172;font-size:.92em">A presto,<br>${casa}</p>
      <hr style="border:none;border-top:1px solid #e7dccd;margin:22px 0">
      <h3 style="color:#b5654a;font-weight:normal;font-size:1.05em">Hi${primo ? ", " + primo : ""}!</h3>
      ${corpoEn}
      <p style="text-align:center;margin:20px 0">
        <a href="${link}" style="color:#b5654a">${ctaEn}</a>
      </p>
      <p style="color:#8a8172;font-size:.85em">If you'd rather not hear from us again about this, just ignore this email.</p>
    </div>`;

  return { subject, html };
}

Deno.serve(async (_req) => {
  try {
    const s = await getSettings();
    const casa = s.nome_casa || "Casa Tolomea";
    const site = s.site_url || "https://www.casatolomea.it";
    const mittente = `${casa} <${s.email_mittente || "onboarding@resend.dev"}>`;

    const now = Date.now();
    const min = new Date(now - ORE_MIN * 3600_000).toISOString();
    const max = new Date(now - ORE_MAX * 3600_000).toISOString();

    const res = await rest(
      `contatti_parziali?select=id,origine,email,telefono,nome,checkin,checkout,totale,notti,creato` +
      `&followup_inviato=eq.false&creato=lte.${encodeURIComponent(min)}&creato=gte.${encodeURIComponent(max)}` +
      `&order=creato.desc`,
    );
    if (!res.ok) throw new Error(`Query contatti_parziali fallita (HTTP ${res.status})`);
    const righe: Riga[] = await res.json();

    // Una sola email a persona per giro: tiene la riga più recente (già in
    // testa grazie all'order=creato.desc) e più avanti marca inviato tutte
    // le sorelle con la stessa email, per non doppio-processarle ai giri dopo.
    const perEmail = new Map<string, Riga>();
    for (const r of righe) if (!perEmail.has(r.email)) perEmail.set(r.email, r);

    // Una sola verifica del calendario per giro, non una per persona.
    const occupate = await dateOccupate();

    let inviati = 0, saltati = 0;
    for (const r of perEmail.values()) {
      const convertito = await giaConvertito(r.email, r.creato);
      if (!convertito) {
        const { subject, html } = componiEmail(r, { casa, site, occupate });
        const ok = await sendEmail(mittente, r.email, subject, html);
        if (ok) inviati++;
      } else {
        saltati++;
      }
      // Marca inviato ANCHE le eventuali righe sorelle con la stessa email
      // rimaste indietro (più tentativi di scrittura dello stesso contatto),
      // convertito o no: in entrambi i casi non c'è più nulla da fare per loro.
      await rest(`contatti_parziali?email=eq.${encodeURIComponent(r.email)}&followup_inviato=eq.false`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ followup_inviato: true }),
      });
    }

    return new Response(JSON.stringify({ candidati: righe.length, contatti_unici: perEmail.size, inviati, saltati_perche_convertiti: saltati }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
