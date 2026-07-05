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
  const HAS_SB = !!(IG.supabaseUrl && IG.supabaseAnonKey);

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

  // Date occupate su Booking, lette dalla stessa Edge Function usata dal sito.
  async function fetchBookingBusy() {
    const set = new Set();
    if (!sb) return demoBookingBusy();
    if (!IG.supabaseUrl) return set;
    try {
      const url = `${IG.supabaseUrl.replace(/\/$/, "")}/functions/v1/booking-availability`;
      const r = await fetch(url, { headers: { apikey: IG.supabaseAnonKey, Authorization: `Bearer ${IG.supabaseAnonKey}` } });
      if (!r.ok) return set;
      const data = await r.json();
      (data.busy || []).forEach(({ start, end }) => addRange(set, start, end));
    } catch (_) { /* Booking non raggiungibile: il calendario mostra solo il sito */ }
    return set;
  }

  async function fetchBlocchi() {
    if (!sb) return demoBlocchi();
    const { data, error } = await sb.from("blocchi").select("id,dal,al,motivo").order("dal", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /* ══ STATO APP ══ */
  const state = { rows: [], bookingBusy: new Set(), blocchi: [], calMonth: new Date(), tab: "richieste", filtro: "tutte" };

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
    if (!sb) { if (row) row.confermata = value; renderRichieste(); if (value) sendGuestConfirmation(row); toast(value ? "Confermata (demo)" : "Conferma annullata (demo)"); return; }
    try {
      const { error } = await sb.from("richieste").update({ confermata: value }).eq("id", id);
      if (error) throw error;
      if (row) row.confermata = value;
      state.bookingBusy = state.bookingBusy; // invariato
      renderRichieste();
      toast(value ? "Confermata — la data verrà bloccata su Booking" : "Conferma annullata");
      // Email di conferma all'ospite: solo quando si conferma (non nell'annulla),
      // best-effort — un errore di invio non deve invalidare la conferma già salvata.
      if (value) sendGuestConfirmation(row);
    } catch (_) { toast("Operazione non riuscita", "err"); }
  }

  // Invia all'ospite l'email di conferma prenotazione via EmailJS. Non fa nulla
  // (in silenzio) se manca la libreria, la config emailjsOspite o l'email ospite:
  // in quei casi il proprietario avvisa l'ospite a mano, come prima.
  async function sendGuestConfirmation(row) {
    const cfg = IG.emailjsOspite || {};
    if (!row || !row.email || !window.emailjs || !cfg.serviceId || !cfg.templateId || !cfg.publicKey) return;
    try {
      await window.emailjs.send(cfg.serviceId, cfg.templateId, {
        to_email: row.email,
        to_name: row.nome || "",
        casa: CFG.casa?.nome || "",
        checkin: fmtItaliano(row.checkin),
        checkout: fmtItaliano(row.checkout),
        ospiti: row.ospiti || "",
        totale_stimato: euro(row.totale_stimato),
      }, { publicKey: cfg.publicKey });
      toast("Email di conferma inviata all'ospite");
    } catch (_) { toast("Conferma salvata, ma email all'ospite non inviata", "warn"); }
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
    const booking = state.bookingBusy;
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
      const onSite = site.has(iso), onBooking = booking.has(iso), onBlock = blocked.has(iso);
      let cls = "adm-cell";
      // priorità visiva: blocco manuale (scelta esplicita) > entrambi > singola sorgente
      if (onBlock) cls += " blocco";
      else if (onSite && onBooking) cls += " both";
      else if (onSite) cls += " site";
      else if (onBooking) cls += " booking";
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
        <span><i class="lg booking"></i> Occupato su Booking</span>
        <span><i class="lg both"></i> Su entrambi</span>
        <span><i class="lg blocco"></i> Bloccato a mano</span>
      </div>
      <div class="adm-cal">
        ${WD.map((w) => `<div class="adm-wd">${w}</div>`).join("")}
        ${cells}
      </div>
      <p class="adm-muted adm-cal-foot">Le date "sul sito" sono le richieste che hai confermato; quelle "su Booking" arrivano dal calendario Booking (aggiornato ogni poche ore).</p>

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
      const [rows, busy, blocchi] = await Promise.all([fetchRichieste(), fetchBookingBusy(), fetchBlocchi()]);
      state.rows = rows;
      state.bookingBusy = busy;
      state.blocchi = blocchi;
      renderView();
    } catch (_) {
      if (view) view.innerHTML = `<p class="adm-empty">Impossibile caricare i dati. Riprova con "Aggiorna".</p>`;
    }
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
