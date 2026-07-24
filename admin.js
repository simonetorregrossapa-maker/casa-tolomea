/* ══════════════════════════════════════════════════════════════════════
   PANNELLO GESTIONE — Casa Tolomea (gestione.html)
   Area riservata al proprietario. Login via Supabase Auth (email + password).
   Due viste:
     • Richieste  — elenco prenotazioni dal sito, con bottone "Conferma".
                    "Conferma" imposta richieste.confermata = true: da quel
                    momento la data viene esposta nel feed iCal e Booking la
                    blocca in automatico (function site-availability-ical).
     • Calendario — vista mese che unisce le date occupate da Booking (lette
                    via booking-availability) e quelle confermate sul sito,
                    così il proprietario vede tutto in un colpo d'occhio.
   Nessuna dipendenza esterna oltre a supabase-js (UMD) e config.js.
   Se Supabase non è configurato, la pagina gira in modalità DEMO con dati
   finti, così è mostrabile anche senza backend.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const CFG = (window.SITE || {});
  const IG = CFG.integrazioni || {};
  // ?demo forza l'anteprima con dati di esempio (utile per mostrare il pannello).
  const FORCE_DEMO = /[?&]demo\b/.test(location.search);
  const HAS_SB = !FORCE_DEMO && !!(IG.supabaseUrl && IG.supabaseAnonKey);

  let sb = null;
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ── utilità date ──────────────────────────────────────────────────── */
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const WD = ["Lu", "Ma", "Me", "Gio", "Ve", "Sa", "Do"];

  function fmtItaliano(iso) {
    if (!iso) return "—";
    const d = parseIso(iso);
    return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
  }
  function euro(n) {
    if (n == null || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("it-IT") + "€";
  }
  // Espande un intervallo [checkin, checkout) in set di notti occupate.
  function addRange(set, start, end) {
    if (!start || !end) return;
    const last = parseIso(end);
    for (let d = parseIso(start); d < last; d.setDate(d.getDate() + 1)) set.add(isoOf(d));
  }

  function toast(msg, kind) {
    const t = document.createElement("div");
    t.className = "adm-toast " + (kind || "");
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
  }

  /* ── dati demo (nessun Supabase) ───────────────────────────────────── */
  function demoRows() {
    const base = new Date(); base.setDate(base.getDate() + 5);
    const mk = (offset, notti, nome, email, tel, ospiti, tot, conf) => {
      const ci = new Date(base); ci.setDate(ci.getDate() + offset);
      const co = new Date(ci); co.setDate(co.getDate() + notti);
      return { id: offset + 100, nome, email, telefono: tel, ospiti, checkin: isoOf(ci), checkout: isoOf(co), totale_stimato: tot, note: "", confermata: conf, creato: new Date().toISOString() };
    };
    return [
      mk(0, 4, "Marco Bianchi", "marco@example.com", "333 1112223", 4, 620, false),
      mk(10, 7, "Giulia Verdi", "giulia@example.com", "347 9998887", 2, 980, true),
      mk(22, 3, "Luca Neri", "luca@example.com", "", 6, 540, false),
    ];
  }
  function demoBookingBusy() {
    // qualche data occupata "da Booking" per far vedere il calendario unito
    const set = new Set();
    const t = new Date(); t.setDate(t.getDate() + 2);
    const a = isoOf(t); const b = new Date(t); b.setDate(b.getDate() + 3);
    addRange(set, a, isoOf(b));
    return set;
  }
  function demoBlocchi() {
    const d1 = new Date(); d1.setDate(d1.getDate() + 14);
    const d2 = new Date(d1); d2.setDate(d2.getDate() + 2);
    return [{ id: 1, dal: isoOf(d1), al: isoOf(d2), motivo: "Uso personale" }];
  }

  /* ── accesso Supabase ──────────────────────────────────────────────── */
  async function waitForSupabase() {
    if (!HAS_SB) return;
    if (window.supabase) return;
    await new Promise((res) => { let n = 0; const iv = setInterval(() => { if (window.supabase || n++ > 60) { clearInterval(iv); res(); } }, 50); });
  }

  async function fetchRichieste() {
    if (!sb) return demoRows();
    const { data, error } = await sb.from("richieste")
      .select("id,nome,email,telefono,ospiti,checkin,checkout,totale_stimato,note,confermata,creato")
      .order("checkin", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Occupazione esterna completa, dalla STESSA fonte unica del sito
  // (hyper-responder): Booking + Airbnb + VRBO + richieste-sito confermate +
  // blocchi manuali. Prima leggeva booking-availability (solo Booking), perciò
  // il pannello ignorava Airbnb/VRBO e risultava "non aggiornato". In
  // renderCalendario si ricava l'occupato-OTA sottraendo sito e blocchi, che il
  // pannello colora già a parte.
  async function fetchBookingBusy() {
    const set = new Set();
    if (!sb) return demoBookingBusy();
    if (!IG.supabaseUrl) return set;
    try {
      const url = `${IG.supabaseUrl.replace(/\/$/, "")}/functions/v1/hyper-responder`;
      const r = await fetch(url, { headers: { apikey: IG.supabaseAnonKey, Authorization: `Bearer ${IG.supabaseAnonKey}` } });
      if (!r.ok) return set;
      const data = await r.json();
      (data.busy || []).forEach(({ start, end }) => addRange(set, start, end));
    } catch (_) { /* fonte non raggiungibile: il calendario mostra solo il sito */ }
    return set;
  }

  async function fetchBlocchi() {
    if (!sb) return demoBlocchi();
    const { data, error } = await sb.from("blocchi").select("id,dal,al,motivo").order("dal", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /* ══ STATO APP ══ */
  const state = { rows: [], bookingBusy: new Set(), blocchi: [], listeAttesa: [], calMonth: new Date(), tab: "richieste", filtro: "tutte" };

  function demoAttesa() {
    const d1 = new Date(); d1.setDate(d1.getDate() + 8);
    const d2 = new Date(d1); d2.setDate(d2.getDate() + 5);
    return [{ id: 1, nome: "Elena Russo", email: "elena@example.com", telefono: "348 5552211", dal: isoOf(d1), al: isoOf(d2), ospiti: 4, avvisato: false, creato: new Date().toISOString() }];
  }
  async function fetchListeAttesa() {
    if (!sb) return demoAttesa();
    const { data, error } = await sb.from("liste_attesa").select("id,nome,email,telefono,dal,al,ospiti,avvisato,creato").order("creato", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ── LOGIN ─────────────────────────────────────────────────────────── */
  function renderLogin() {
    const root = $("#admRoot");
    root.innerHTML = `
      <div class="adm-login">
        <h2>Accesso proprietario</h2>
        <p class="adm-muted">Area riservata alla gestione delle prenotazioni.</p>
        <label>Email</label>
        <input id="admEmail" type="email" autocomplete="username" placeholder="tua@email.it">
        <label>Password</label>
        <input id="admPass" type="password" autocomplete="current-password" placeholder="••••••••">
        <button class="adm-btn adm-btn-primary" id="admLoginBtn">Entra</button>
      </div>`;
    const doLogin = async () => {
      const email = $("#admEmail").value.trim();
      const password = $("#admPass").value;
      if (!email || !password) return toast("Inserisci email e password", "warn");
      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        boot();
      } catch (_) { toast("Credenziali non valide", "err"); }
    };
    $("#admLoginBtn").onclick = doLogin;
    $("#admPass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  }

  /* ── SHELL (tab + contenuto) ───────────────────────────────────────── */
  function renderShell() {
    const root = $("#admRoot");
    root.innerHTML = `
      <div class="adm-bar">
        <div class="adm-tabs">
          <button class="adm-tab" data-tab="richieste">Richieste</button>
          <button class="adm-tab" data-tab="calendario">Calendario</button>
          <button class="adm-tab" data-tab="incassi">Incassi</button>
          <button class="adm-tab" data-tab="attesa">Lista d'attesa</button>
          <button class="adm-tab" data-tab="messaggi">Messaggi</button>
        </div>
        <div class="adm-bar-right">
          <button class="adm-btn adm-btn-ghost" id="admRefresh">Aggiorna</button>
          ${sb ? `<button class="adm-btn adm-btn-ghost" id="admLogout">Esci</button>` : `<span class="adm-demo-pill">Anteprima demo</span>`}
        </div>
      </div>
      <div id="admView"></div>`;

    root.querySelectorAll(".adm-tab").forEach((t) => {
      t.onclick = () => { state.tab = t.dataset.tab; syncTabs(); renderView(); };
    });
    $("#admRefresh").onclick = () => reload();
    const lo = $("#admLogout"); if (lo) lo.onclick = logout;
    syncTabs();
    renderView();
  }

  function syncTabs() {
    document.querySelectorAll(".adm-tab").forEach((t) => t.classList.toggle("sel", t.dataset.tab === state.tab));
  }

  function renderView() {
    if (state.tab === "richieste") renderRichieste();
    else if (state.tab === "incassi") renderIncassi();
    else if (state.tab === "attesa") renderAttesa();
    else if (state.tab === "messaggi") renderMessaggi();
    else renderCalendario();
  }

  /* ── VISTA RICHIESTE ───────────────────────────────────────────────── */
  function renderRichieste() {
    const view = $("#admView");
    const rows = state.rows.slice();
    const inAttesa = rows.filter((r) => !r.confermata).length;
    const confermate = rows.filter((r) => r.confermata).length;

    const filtered = rows.filter((r) =>
      state.filtro === "tutte" ? true :
      state.filtro === "attesa" ? !r.confermata : r.confermata);

    view.innerHTML = `
      <div class="adm-stats">
        <div class="adm-stat"><b>${rows.length}</b><span>Richieste totali</span></div>
        <div class="adm-stat"><b>${inAttesa}</b><span>Da confermare</span></div>
        <div class="adm-stat"><b>${confermate}</b><span>Confermate (bloccano Booking)</span></div>
      </div>
      <div class="adm-filters">
        <button class="adm-chip ${state.filtro === "tutte" ? "sel" : ""}" data-f="tutte">Tutte</button>
        <button class="adm-chip ${state.filtro === "attesa" ? "sel" : ""}" data-f="attesa">Da confermare</button>
        <button class="adm-chip ${state.filtro === "confermate" ? "sel" : ""}" data-f="confermate">Confermate</button>
      </div>
      <div class="adm-list">${filtered.length ? filtered.map(rowCard).join("") : `<p class="adm-empty">Nessuna richiesta in questa vista.</p>`}</div>`;

    view.querySelectorAll(".adm-chip").forEach((c) => c.onclick = () => { state.filtro = c.dataset.f; renderRichieste(); });
    view.querySelectorAll("[data-conf]").forEach((b) => b.onclick = () => setConfermata(Number(b.dataset.conf), true));
    view.querySelectorAll("[data-unconf]").forEach((b) => b.onclick = () => setConfermata(Number(b.dataset.unconf), false));
  }

  function rowCard(r) {
    const notti = (() => { try { return Math.round((parseIso(r.checkout) - parseIso(r.checkin)) / 86400000); } catch { return "—"; } })();
    const stato = r.confermata
      ? `<span class="adm-badge ok">Confermata</span>`
      : `<span class="adm-badge wait">Da confermare</span>`;
    const contatti = [
      r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : "",
      r.telefono ? `<a href="tel:${r.telefono.replace(/\s/g, "")}">${r.telefono}</a>` : "",
    ].filter(Boolean).join(" · ") || "—";
    const azione = r.confermata
      ? `<button class="adm-btn adm-btn-ghost adm-btn-sm" data-unconf="${r.id}">Annulla conferma</button>`
      : `<button class="adm-btn adm-btn-primary adm-btn-sm" data-conf="${r.id}">Conferma</button>`;
    return `
      <div class="adm-card">
        <div class="adm-card-main">
          <div class="adm-card-head">
            <strong>${r.nome || "Ospite"}</strong> ${stato}
          </div>
          <div class="adm-card-dates">
            ${fmtItaliano(r.checkin)} → ${fmtItaliano(r.checkout)}
            <span class="adm-dot">·</span> ${notti} nott${notti === 1 ? "e" : "i"}
            <span class="adm-dot">·</span> ${r.ospiti || "—"} osp.
            ${r.totale_stimato != null ? `<span class="adm-dot">·</span> ${euro(r.totale_stimato)}` : ""}
          </div>
          <div class="adm-card-contacts">${contatti}</div>
          ${r.note ? `<div class="adm-card-note">${r.note}</div>` : ""}
        </div>
        <div class="adm-card-actions">${azione}</div>
      </div>`;
  }

  async function setConfermata(id, value) {
    const row = state.rows.find((r) => r.id === id);
    if (!sb) { if (row) row.confermata = value; renderRichieste(); toast(value ? "Confermata (demo)" : "Conferma annullata (demo)"); return; }
    try {
      const { error } = await sb.from("richieste").update({ confermata: value }).eq("id", id);
      if (error) throw error;
      if (row) row.confermata = value;
      state.bookingBusy = state.bookingBusy; // invariato
      renderRichieste();
      toast(value ? "Confermata — la data verrà bloccata su Booking" : "Conferma annullata");
      // L'email di conferma (con IBAN) all'ospite parte server-side: l'UPDATE di
      // confermata → true innesca la Edge Function "conferma" (Resend, via webhook).
    } catch (_) { toast("Operazione non riuscita", "err"); }
  }

  /* ── VISTA INCASSI / PROVVIGIONE ───────────────────────────────────── */
  function nottiOf(r) {
    try { return Math.max(0, Math.round((parseIso(r.checkout) - parseIso(r.checkin)) / 86400000)); }
    catch { return 0; }
  }

  function renderIncassi() {
    const view = $("#admView");
    const pct = Number(CFG.gestione?.provvigionePct ?? 10);
    const oggi = isoOf(new Date());

    const conf = state.rows.filter((r) => r.confermata);
    const attesa = state.rows.filter((r) => !r.confermata);

    const somma = (arr) => arr.reduce((s, r) => s + (Number(r.totale_stimato) || 0), 0);
    const incassato = somma(conf);
    const provvigione = incassato * pct / 100;
    const notti = conf.reduce((s, r) => s + nottiOf(r), 0);

    const valoreAttesa = somma(attesa);
    const provvAttesa = valoreAttesa * pct / 100;

    // Confermate ordinate per check-in; separo "in arrivo/future" da "concluse".
    const confOrd = conf.slice().sort((a, b) => (a.checkin < b.checkin ? 1 : -1));
    const rigaIncasso = (r) => {
      const p = (Number(r.totale_stimato) || 0) * pct / 100;
      const passata = r.checkout < oggi;
      return `
        <div class="adm-inc-row">
          <div class="adm-inc-when">
            <strong>${r.nome || "Ospite"}</strong>
            <span class="adm-muted">${fmtItaliano(r.checkin)} → ${fmtItaliano(r.checkout)} · ${nottiOf(r)} nott${nottiOf(r) === 1 ? "e" : "i"}</span>
            ${passata ? `<span class="adm-badge ok">Conclusa</span>` : `<span class="adm-badge wait">In arrivo</span>`}
          </div>
          <div class="adm-inc-money">
            <span>${euro(r.totale_stimato)}</span>
            <b>${euro(p)}</b>
          </div>
        </div>`;
    };

    view.innerHTML = `
      <div class="adm-stats adm-stats-4">
        <div class="adm-stat"><b>${conf.length}</b><span>Prenotazioni dirette</span></div>
        <div class="adm-stat"><b>${notti}</b><span>Notti vendute</span></div>
        <div class="adm-stat"><b>${euro(incassato)}</b><span>Incassato stimato</span></div>
        <div class="adm-stat adm-stat-accent"><b>${euro(provvigione)}</b><span>Provvigione ${pct}%</span></div>
      </div>

      <div class="adm-inc-pipeline">
        In attesa di conferma: <strong>${attesa.length}</strong> richiest${attesa.length === 1 ? "a" : "e"}
        · valore <strong>${euro(valoreAttesa)}</strong>
        <span class="adm-muted">(provvigione potenziale ${euro(provvAttesa)})</span>
      </div>

      <div class="adm-inc-head">
        <span>Prenotazione</span>
        <span class="adm-inc-cols"><span>Totale</span><b>Provv. ${pct}%</b></span>
      </div>
      <div class="adm-inc-list">
        ${confOrd.length ? confOrd.map(rigaIncasso).join("") : `<p class="adm-empty">Nessuna prenotazione diretta confermata. La provvigione si calcola sulle richieste che confermi nella tab "Richieste".</p>`}
      </div>
      <p class="adm-muted adm-cal-foot">Gli importi usano il totale stimato di ogni prenotazione (config prezzi). La provvigione è calcolata al ${pct}% sulle sole prenotazioni dirette confermate.</p>`;
  }

  /* ── VISTA LISTA D'ATTESA ──────────────────────────────────────────── */
  function renderAttesa() {
    const view = $("#admView");
    const rows = (state.listeAttesa || []).slice();
    const attivi = rows.filter((r) => !r.avvisato).length;

    const card = (r) => {
      const periodo = r.dal && r.al ? `${fmtItaliano(r.dal)} → ${fmtItaliano(r.al)}` : "Date flessibili";
      const contatti = [
        r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : "",
        r.telefono ? `<a href="tel:${String(r.telefono).replace(/\s/g, "")}">${r.telefono}</a>` : "",
      ].filter(Boolean).join(" · ") || "—";
      const badge = r.avvisato ? `<span class="adm-badge ok">Avvisato</span>` : `<span class="adm-badge wait">In attesa</span>`;
      const azione = r.avvisato
        ? `<button class="adm-btn adm-btn-ghost adm-btn-sm" data-unavv="${r.id}">Segna in attesa</button>`
        : `<button class="adm-btn adm-btn-primary adm-btn-sm" data-avv="${r.id}">Segna avvisato</button>`;
      return `
        <div class="adm-card">
          <div class="adm-card-main">
            <div class="adm-card-head"><strong>${r.nome || "Ospite"}</strong> ${badge}</div>
            <div class="adm-card-dates">${periodo}${r.ospiti ? `<span class="adm-dot">·</span> ${r.ospiti} osp.` : ""}</div>
            <div class="adm-card-contacts">${contatti}</div>
          </div>
          <div class="adm-card-actions">
            ${azione}
            <button class="adm-btn adm-btn-ghost adm-btn-sm" data-delattesa="${r.id}">Rimuovi</button>
          </div>
        </div>`;
    };

    view.innerHTML = `
      <div class="adm-stats">
        <div class="adm-stat"><b>${rows.length}</b><span>In lista d'attesa</span></div>
        <div class="adm-stat"><b>${attivi}</b><span>Ancora da avvisare</span></div>
        <div class="adm-stat"><b>${rows.length - attivi}</b><span>Già avvisati</span></div>
      </div>
      <p class="adm-muted" style="margin:0 0 14px">Chi ti ha lasciato un contatto per essere avvisato se si libera un periodo. Quando una data si libera, l'automazione <em>posto-libero</em> avvisa da sola chi combacia; qui puoi gestirli anche a mano.</p>
      <div class="adm-list">${rows.length ? rows.map(card).join("") : `<p class="adm-empty">Nessuno in lista d'attesa.</p>`}</div>`;

    view.querySelectorAll("[data-avv]").forEach((b) => b.onclick = () => setAvvisato(Number(b.dataset.avv), true));
    view.querySelectorAll("[data-unavv]").forEach((b) => b.onclick = () => setAvvisato(Number(b.dataset.unavv), false));
    view.querySelectorAll("[data-delattesa]").forEach((b) => b.onclick = () => removeAttesa(Number(b.dataset.delattesa)));
  }

  async function setAvvisato(id, value) {
    const row = (state.listeAttesa || []).find((r) => r.id === id);
    if (!sb) { if (row) row.avvisato = value; renderAttesa(); toast(value ? "Segnato avvisato (demo)" : "Rimesso in attesa (demo)"); return; }
    try {
      const { error } = await sb.from("liste_attesa").update({ avvisato: value }).eq("id", id);
      if (error) throw error;
      if (row) row.avvisato = value;
      renderAttesa();
      toast(value ? "Segnato come avvisato" : "Rimesso in attesa");
    } catch (_) { toast("Operazione non riuscita", "err"); }
  }

  async function removeAttesa(id) {
    if (!sb) { state.listeAttesa = state.listeAttesa.filter((r) => r.id !== id); renderAttesa(); toast("Rimosso (demo)"); return; }
    try {
      const { error } = await sb.from("liste_attesa").delete().eq("id", id);
      if (error) throw error;
      state.listeAttesa = state.listeAttesa.filter((r) => r.id !== id);
      renderAttesa();
      toast("Rimosso dalla lista");
    } catch (_) { toast("Rimozione non riuscita", "err"); }
  }

  /* ── VISTA CALENDARIO UNICO ────────────────────────────────────────── */
  function siteBusySet() {
    const set = new Set();
    state.rows.filter((r) => r.confermata).forEach((r) => addRange(set, r.checkin, r.checkout));
    return set;
  }

  function blockSet() {
    const set = new Set();
    (state.blocchi || []).forEach((b) => addRange(set, b.dal, b.al));
    return set;
  }

  function renderCalendario() {
    const view = $("#admView");
    const site = siteBusySet();
    const external = state.bookingBusy; // fonte unica: OTA + sito + blocchi
    const blocked = blockSet();
    const m = state.calMonth;
    const year = m.getFullYear(), month = m.getMonth();
    const first = new Date(year, month, 1);
    const startWd = (first.getDay() + 6) % 7; // lun=0
    const days = new Date(year, month + 1, 0).getDate();
    const todayIso = isoOf(new Date());
    const oggi = isoOf(new Date());

    let cells = "";
    for (let i = 0; i < startWd; i++) cells += `<div class="adm-cell empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(new Date(year, month, d));
      const onSite = site.has(iso), onBlock = blocked.has(iso);
      // Occupato-OTA (Booking/Airbnb/VRBO) = nella fonte unica ma NON già
      // contato come richiesta-sito o blocco manuale (che hanno colore proprio).
      const onOTA = external.has(iso) && !onSite && !onBlock;
      let cls = "adm-cell";
      // priorità visiva: blocco manuale (scelta esplicita) > sito > OTA
      if (onBlock) cls += " blocco";
      else if (onSite) cls += " site";
      else if (onOTA) cls += " booking";
      if (iso === todayIso) cls += " today";
      cells += `<div class="${cls}"><span>${d}</span></div>`;
    }

    const listaBlocchi = (state.blocchi || []).filter((b) => b.al >= oggi);
    const blocchiHtml = listaBlocchi.length
      ? listaBlocchi.map((b) => `
          <div class="adm-blocco-row">
            <span>${fmtItaliano(b.dal)} → ${fmtItaliano(b.al)}${b.motivo ? ` · <em>${b.motivo}</em>` : ""}</span>
            <button class="adm-btn adm-btn-ghost adm-btn-sm" data-delblock="${b.id}">Rimuovi</button>
          </div>`).join("")
      : `<p class="adm-muted" style="margin:.3rem 0">Nessun blocco manuale attivo.</p>`;

    view.innerHTML = `
      <div class="adm-cal-head">
        <button class="adm-nav" id="admPrev" aria-label="Mese precedente">‹</button>
        <h3>${MESI[month]} ${year}</h3>
        <button class="adm-nav" id="admNext" aria-label="Mese successivo">›</button>
      </div>
      <div class="adm-legend">
        <span><i class="lg site"></i> Prenotato sul sito</span>
        <span><i class="lg booking"></i> Occupato su OTA (Booking/Airbnb/VRBO)</span>
        <span><i class="lg blocco"></i> Bloccato a mano</span>
      </div>
      <div class="adm-cal">
        ${WD.map((w) => `<div class="adm-wd">${w}</div>`).join("")}
        ${cells}
      </div>
      <p class="adm-muted adm-cal-foot">Le date "sul sito" sono le richieste che hai confermato; quelle "su OTA" arrivano dai calendari di Booking, Airbnb e VRBO (aggiornati ogni poche ore).</p>

      <div class="adm-block-box">
        <h3>Blocca date a mano</h3>
        <p class="adm-muted" style="margin:.2rem 0 .9rem">Chiudi un periodo su sito e Booking insieme — per uso personale, manutenzione, o per bloccare subito una data appena presa su Booking.</p>
        <div class="adm-block-form">
          <label>Arrivo<input id="blkDal" type="date" value="${oggi}"></label>
          <label>Partenza<input id="blkAl" type="date" value="${oggi}"></label>
          <label>Motivo (facoltativo)<input id="blkMotivo" type="text" placeholder="Es. uso personale"></label>
          <button class="adm-btn adm-btn-primary" id="blkAdd">Blocca periodo</button>
        </div>
        <div class="adm-blocco-list">${blocchiHtml}</div>
      </div>`;

    $("#admPrev").onclick = () => { state.calMonth = new Date(year, month - 1, 1); renderCalendario(); };
    $("#admNext").onclick = () => { state.calMonth = new Date(year, month + 1, 1); renderCalendario(); };
    $("#blkAdd").onclick = () => addBlocco($("#blkDal").value, $("#blkAl").value, $("#blkMotivo").value.trim());
    view.querySelectorAll("[data-delblock]").forEach((b) => b.onclick = () => removeBlocco(Number(b.dataset.delblock)));
  }

  async function addBlocco(dal, al, motivo) {
    if (!dal || !al) return toast("Inserisci arrivo e partenza", "warn");
    if (al <= dal) return toast("La partenza dev'essere dopo l'arrivo", "warn");
    if (!sb) {
      const id = Math.max(0, ...state.blocchi.map((b) => b.id)) + 1;
      state.blocchi.push({ id, dal, al, motivo });
      renderCalendario(); toast("Periodo bloccato (demo)"); return;
    }
    try {
      const { error } = await sb.from("blocchi").insert({ dal, al, motivo: motivo || null });
      if (error) throw error;
      state.blocchi = await fetchBlocchi();
      renderCalendario(); toast("Periodo bloccato — vale su sito e Booking");
    } catch (_) { toast("Blocco non riuscito", "err"); }
  }

  async function removeBlocco(id) {
    if (!sb) { state.blocchi = state.blocchi.filter((b) => b.id !== id); renderCalendario(); toast("Blocco rimosso (demo)"); return; }
    try {
      const { error } = await sb.from("blocchi").delete().eq("id", id);
      if (error) throw error;
      state.blocchi = state.blocchi.filter((b) => b.id !== id);
      renderCalendario(); toast("Blocco rimosso");
    } catch (_) { toast("Rimozione non riuscita", "err"); }
  }

  /* ── caricamento dati ──────────────────────────────────────────────── */
  async function reload() {
    const view = $("#admView");
    if (view) view.innerHTML = `<p class="adm-muted">Caricamento…</p>`;
    try {
      const [rows, busy, blocchi, attesa] = await Promise.all([fetchRichieste(), fetchBookingBusy(), fetchBlocchi(), fetchListeAttesa()]);
      state.rows = rows;
      state.bookingBusy = busy;
      state.blocchi = blocchi;
      state.listeAttesa = attesa;
      renderView();
    } catch (_) {
      if (view) view.innerHTML = `<p class="adm-empty">Impossibile caricare i dati. Riprova con "Aggiorna".</p>`;
    }
  }

  /* ── VISTA MESSAGGI (email ai clienti) ─────────────────────────────────
     Il proprietario scrive un messaggio e lo invia ai suoi clienti (ospiti
     con almeno un soggiorno confermato). Può scegliere un segmento pronto
     (tutti / ospiti di ritorno / dormienti) o selezionare a mano. L'invio
     passa dalla Edge Function `messaggio-ospiti` (Resend), protetta dal login
     del proprietario: la chiave email resta lato server. */
  const escH = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function clientiFromRows() {
    const map = new Map();
    const today = isoOf(new Date());
    (state.rows || []).forEach((r) => {
      if (!r.confermata || !r.email) return;
      const email = String(r.email).toLowerCase().trim();
      if (!email) return;
      const c = map.get(email) || { email, nome: r.nome || "", soggiorni: 0, ultimo: "", futura: false };
      c.soggiorni += 1;
      if (r.nome) c.nome = r.nome;
      if (r.checkout && r.checkout > c.ultimo) c.ultimo = r.checkout;
      if (r.checkout && r.checkout >= today) c.futura = true;
      map.set(email, c);
    });
    return [...map.values()].sort((a, b) => (b.ultimo || "").localeCompare(a.ultimo || ""));
  }

  function inSegmento(c, seg) {
    if (seg === "ritorno") return c.soggiorni >= 2;
    if (seg === "dormienti") {
      const soglia = new Date(); soglia.setDate(soglia.getDate() - 180);
      return !c.futura && c.ultimo && parseIso(c.ultimo) < soglia;
    }
    return true;
  }

  function renderMessaggi() {
    const view = $("#admView");
    if (!state.msgSel) state.msgSel = new Set();
    const clienti = clientiFromRows();

    if (!clienti.length) {
      view.innerHTML = `<p class="adm-empty">Non ci sono ancora clienti con un soggiorno confermato.<br>
        Appena confermi le prime richieste, potrai scrivere ai tuoi ospiti da qui.</p>`;
      return;
    }

    const tag = (c) => c.futura ? "In arrivo" : (c.soggiorni >= 2 ? "Ritorno"
      : (inSegmento(c, "dormienti") ? "Dormiente" : ""));

    const rowsHtml = clienti.map((c, i) => `
      <label class="adm-recip-row">
        <input type="checkbox" data-email="${escH(c.email)}" ${state.msgSel.has(c.email) ? "checked" : ""}>
        <span class="adm-recip-main">
          <b>${escH(c.nome || "Ospite")}</b>
          <span>${escH(c.email)}${c.ultimo ? " · ultimo soggiorno " + fmtItaliano(c.ultimo) : ""}</span>
        </span>
        ${tag(c) ? `<span class="adm-recip-tag">${tag(c)}</span>` : ""}
      </label>`).join("");

    view.innerHTML = `
      <div class="adm-msg">
        <div class="adm-msg-box">
          <h3>A chi scrivere</h3>
          <p class="adm-muted">${clienti.length} client${clienti.length === 1 ? "e" : "i"} con soggiorno confermato. Scegli un gruppo o seleziona a mano.</p>
          <div class="adm-seg">
            <button class="adm-chip" data-seg="tutti">Tutti</button>
            <button class="adm-chip" data-seg="ritorno">Ospiti di ritorno</button>
            <button class="adm-chip" data-seg="dormienti">Dormienti (6+ mesi)</button>
            <button class="adm-chip" data-seg="nessuno">Deseleziona</button>
          </div>
          <div class="adm-recipients" id="admRecipients">${rowsHtml}</div>
          <p class="adm-msg-count"><b id="admMsgCount">${state.msgSel.size}</b> destinatari selezionati</p>
        </div>

        <div class="adm-msg-box">
          <h3>Il messaggio</h3>
          <p class="adm-muted">Scrivi come parleresti ai tuoi ospiti: lo impaginiamo noi con l'intestazione di ${escH((CFG.casa && CFG.casa.nome) || "Casa Tolomea")}.</p>
          <div class="adm-msg-form">
            <label for="admMsgSubject">Oggetto</label>
            <input id="admMsgSubject" type="text" maxlength="120" placeholder="Es. Un saluto e le date libere di settembre">
            <label for="admMsgBody">Testo</label>
            <textarea id="admMsgBody" placeholder="Ciao! Ti scriviamo per…"></textarea>
          </div>
          <div class="adm-msg-preview" id="admMsgPreview" hidden></div>
          <div class="adm-msg-send">
            <button class="adm-btn adm-btn-primary" id="admMsgSend">Invia ai selezionati</button>
            <button class="adm-btn adm-btn-ghost adm-btn-sm" id="admMsgPreviewBtn">Anteprima</button>
          </div>
        </div>
      </div>`;

    const countEl = $("#admMsgCount");
    const updCount = () => { countEl.textContent = String(state.msgSel.size); };

    // checkbox singola
    view.querySelectorAll("#admRecipients input[type=checkbox]").forEach((cb) => {
      cb.onchange = () => {
        const em = cb.dataset.email;
        if (cb.checked) state.msgSel.add(em); else state.msgSel.delete(em);
        updCount();
      };
    });

    // segmenti
    view.querySelectorAll(".adm-seg .adm-chip").forEach((chip) => {
      chip.onclick = () => {
        const seg = chip.dataset.seg;
        state.msgSel = new Set();
        if (seg !== "nessuno") clienti.forEach((c) => { if (inSegmento(c, seg)) state.msgSel.add(c.email); });
        view.querySelectorAll("#admRecipients input[type=checkbox]").forEach((cb) => {
          cb.checked = state.msgSel.has(cb.dataset.email);
        });
        updCount();
      };
    });

    // anteprima
    const previewEl = $("#admMsgPreview");
    $("#admMsgPreviewBtn").onclick = () => {
      const casa = (CFG.casa && CFG.casa.nome) || "Casa Tolomea";
      const body = ($("#admMsgBody").value || "").trim();
      if (!body) { previewEl.hidden = true; return toast("Scrivi prima il testo", "warn"); }
      const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 10px">${escH(p).replace(/\n/g, "<br>")}</p>`).join("");
      previewEl.innerHTML = `<div class="pv-h">Ciao [nome ospite],</div>${paras}<div class="pv-sign">Un caro saluto,<br>${escH(casa)}</div>`;
      previewEl.hidden = false;
    };

    // invio
    $("#admMsgSend").onclick = () => {
      const subject = ($("#admMsgSubject").value || "").trim();
      const messaggio = ($("#admMsgBody").value || "").trim();
      if (!subject) return toast("Aggiungi un oggetto", "warn");
      if (!messaggio) return toast("Scrivi il messaggio", "warn");
      const destinatari = clienti.filter((c) => state.msgSel.has(c.email)).map((c) => ({ email: c.email, nome: c.nome }));
      if (!destinatari.length) return toast("Seleziona almeno un cliente", "warn");
      if (!confirm(`Inviare questa email a ${destinatari.length} client${destinatari.length === 1 ? "e" : "i"}?`)) return;
      inviaMessaggio(subject, messaggio, destinatari, $("#admMsgSend"));
    };
  }

  async function inviaMessaggio(subject, messaggio, destinatari, btn) {
    if (!sb) { toast(`Inviato a ${destinatari.length} clienti (demo)`, ""); state.msgSel = new Set(); renderMessaggi(); return; }
    const old = btn.textContent; btn.disabled = true; btn.textContent = "Invio in corso…";
    try {
      const { data: sess } = await sb.auth.getSession();
      const token = sess && sess.session ? sess.session.access_token : null;
      if (!token) throw new Error("sessione scaduta");
      const url = `${IG.supabaseUrl.replace(/\/$/, "")}/functions/v1/messaggio-ospiti`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: IG.supabaseAnonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, messaggio, destinatari }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || `HTTP ${r.status}`);
      toast(`Email inviata a ${out.inviate != null ? out.inviate : destinatari.length} clienti`, "");
      state.msgSel = new Set(); renderMessaggi();
    } catch (_) {
      toast("Invio non riuscito. Riprova.", "err");
    } finally { btn.disabled = false; btn.textContent = old; }
  }

  async function logout() {
    try { await sb.auth.signOut(); } catch (_) {}
    renderLogin();
  }

  async function boot() {
    renderShell();
    reload();
  }

  /* ── avvio ─────────────────────────────────────────────────────────── */
  async function init() {
    const banner = $("#admDemoBanner");
    if (banner) banner.hidden = HAS_SB;

    if (!HAS_SB) { renderShell(); reload(); return; } // demo senza backend

    await waitForSupabase();
    if (!window.supabase) { renderShell(); reload(); return; }
    sb = window.supabase.createClient(IG.supabaseUrl, IG.supabaseAnonKey);
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) boot();
      else renderLogin();
    } catch (_) { renderLogin(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
