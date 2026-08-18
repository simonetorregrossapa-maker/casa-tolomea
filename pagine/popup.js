/* ============================================================================
   Popup di recupero abbandono per le pagine di contenuto statiche.
   Stessa promessa, stessa tabella e stesso comportamento del popup React della
   home (src/App.jsx → ExitIntentPopup), riscritto senza framework perché
   queste pagine non caricano il bundle.

   PERCHÉ ESISTE: chi arriva da Google atterra quasi sempre qui, non sulla home.
   Fino ad agosto 2026 il popup viveva solo dentro l'app React, quindi su queste
   pagine non compariva mai e il visitatore usciva senza lasciare niente.

   Regole: una sola volta a sessione (chiave condivisa con la home, così non lo
   vede due volte cambiando pagina), chiusura sempre visibile, nessun countdown
   finto, niente cookie. Le date sono facoltative ma chieste: senza quelle la
   promessa "ti rispondiamo con disponibilità e prezzo" resterebbe a vuoto.
============================================================================ */
(function () {
  var URL_SB = "https://wbooxigzhkjljkkroibn.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib294aWd6aGtqbGpra3JvaWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjIxNjYsImV4cCI6MjA5ODYzODE2Nn0.kIAXPhDIo2ZgEmtvkQDApi9ZPtt1s1e-6tg1CwaY9rE";
  var WA = "393394290856";

  var T = {
    title: "Prima di chiudere, ti scriviamo noi",
    lead: "Dicci le date che hai in mente e ti rispondiamo con disponibilità e prezzo. Niente carta di credito, niente registrazione.",
    checkin: "Arrivo", checkout: "Partenza", email: "La tua email",
    submit: "Mandami disponibilità e prezzo", sending: "Invio…",
    or: "oppure", waBtn: "Scrivici su WhatsApp", close: "Chiudi",
    msgFill: "Inserisci un'email valida.",
    msgOk: "Fatto! Ti scriviamo noi con disponibilità e prezzo.",
    hint: "La usiamo solo per risponderti su Casa Tolomea.",
    privacy: "informativa privacy",
  };

  function giaLasciato() {
    try {
      return sessionStorage.getItem("ct_contatto") === "1" || sessionStorage.getItem("ct_popup") === "1";
    } catch (e) { return false; } // storage bloccato: procede come se non l'avesse visto
  }
  function segna(chiave) { try { sessionStorage.setItem(chiave, "1"); } catch (e) { /* ignora */ } }

  function stile() {
    var css = ''
      + '.ct-pop{position:fixed;inset:0;z-index:220;display:grid;place-items:center;padding:4vw;font-family:var(--font-body)}'
      + '.ct-pop__bd{position:absolute;inset:0;background:rgba(15,12,9,.5);animation:ctFade .3s ease}'
      + '.ct-pop__card{position:relative;width:min(420px,100%);background:var(--surface);border:1.5px solid var(--line);'
      + 'border-radius:var(--radius);box-shadow:var(--shadow-md);padding:32px 28px 26px;animation:ctPop .35s ease;max-height:92vh;overflow:auto}'
      + '.ct-pop__card h3{font-family:var(--font-display);font-size:1.35rem;line-height:1.25;margin-bottom:.5rem;font-weight:500}'
      + '.ct-pop__card p.ct-lead{color:var(--muted);font-size:.92rem;line-height:1.5;margin-bottom:1.1rem}'
      + '.ct-pop__x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;background:none;border-radius:50%;'
      + 'font-size:1.5rem;line-height:1;color:var(--muted);cursor:pointer}'
      + '.ct-pop__x:hover{background:var(--accent-bg);color:var(--accent)}'
      // min-width:0 sulle colonne: gli input type=date hanno una larghezza
      // minima propria e senza questo sfondano la card fuori dallo schermo.
      + '.ct-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
      + '.ct-row>.ct-f{min-width:0}'
      + '.ct-f input[type=date]{min-width:0;padding:12px 10px}'
      + '.ct-f{margin-bottom:1rem}'
      + '.ct-f label{display:block;font-size:.82rem;font-weight:600;margin-bottom:.4rem}'
      + '.ct-f input{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);'
      + 'font-family:inherit;font-size:.95rem;color:var(--ink)}'
      + '.ct-f input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-bg)}'
      + '.ct-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 18px;'
      + 'border-radius:999px;font-family:inherit;font-size:.95rem;font-weight:600;cursor:pointer;border:1.5px solid var(--accent);text-decoration:none}'
      + '.ct-btn--p{background:var(--accent);color:#fff}'
      + '.ct-btn--g{background:transparent;color:var(--accent)}'
      + '.ct-or{display:flex;align-items:center;gap:12px;margin:.9rem 0;font-size:.8rem;color:var(--muted)}'
      + '.ct-or::before,.ct-or::after{content:"";flex:1;height:1px;background:var(--line)}'
      + '.ct-hint{font-size:.76rem;color:var(--muted);line-height:1.4;margin-top:.8rem;text-align:center}'
      + '.ct-msg{font-size:.86rem;margin-bottom:.7rem}.ct-msg.err{color:var(--accent)}.ct-msg.ok{color:var(--olive)}'
      + '@keyframes ctFade{from{opacity:0}to{opacity:1}}'
      + '@keyframes ctPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}'
      + '@media(max-width:520px){.ct-pop__card{padding:26px 20px 22px}}';
    var el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  }

  function gg(iso) { return iso.split("-").reverse().join("/"); } // 2026-09-10 → 10/09/2026

  /* ── Preventivo ────────────────────────────────────────────────────────
     Stesso calcolo del form di prenotazione (src/booking.js: seasonFor +
     computeEstimate), sulle fasce di /pagine/listino.js, che è generato da
     src/data.js e quindi non può divergere dai prezzi pubblicati.
     Se il listino non è caricato si va avanti lo stesso, semplicemente senza
     cifra: il contatto vale più del preventivo.                            */
  function due(n) { return String(n).padStart(2, "0"); }
  function dataDa(iso) { var p = iso.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  function fasciaPer(d) {
    var fasce = window.CT_FASCE || [];
    var iso = d.getFullYear() + "-" + due(d.getMonth() + 1) + "-" + due(d.getDate());
    var mg = due(d.getMonth() + 1) + "-" + due(d.getDate());
    function combacia(f) {
      return (f.periodi || []).some(function (p) {
        var dal = p[0], al = p[1];
        if (dal.length > 5) return iso >= dal && iso <= al;         // fascia datata
        return dal <= al ? mg >= dal && mg <= al : mg >= dal || mg <= al; // ricorrente
      });
    }
    // Le fasce datate vincono sempre sulle generiche di sicurezza.
    var datata = fasce.filter(function (f) {
      return (f.periodi || []).some(function (p) { return p[0].length > 5; });
    }).filter(combacia)[0];
    return datata || fasce.filter(combacia)[0] || null;
  }

  function preventivo(ci, co) {
    if (!ci || !co || !(window.CT_FASCE || []).length) return null;
    var a = dataDa(ci), b = dataDa(co);
    var notti = Math.round((b - a) / 86400000);
    if (notti <= 0) return null;
    var totale = 0, primaFascia = null;
    for (var d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
      var f = fasciaPer(d);
      if (!f) return null; // periodo scoperto: meglio nessuna cifra che una sbagliata
      if (!primaFascia) primaFascia = f;
      totale += f.prezzo;
    }
    // Sotto il soggiorno minimo quelle notti non sono prenotabili: si tiene il
    // numero di notti ma non la cifra, per non promettere un prezzo che non c'è.
    if (notti < (primaFascia.min || 1)) return { notti: notti, totale: null };
    return { notti: notti, totale: totale };
  }

  // Scrittura della riga su Supabase. Se il database non ha ancora le colonne
  // nuove PostgREST rifiuta tutto: si riprova con i soli campi storici, così
  // il contatto non si perde se il sito viene pubblicato prima della migrazione.
  function salva(riga, ripiego) {
    try {
      fetch(URL_SB + "/rest/v1/contatti_parziali", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: KEY, Authorization: "Bearer " + KEY, Prefer: "return=minimal",
        },
        body: JSON.stringify(riga),
        keepalive: true,
      }).then(function (r) { if (!r.ok && ripiego) salva(ripiego, null); }).catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  function waLink(ci, co) {
    var t = "Ciao! Vorrei sapere disponibilità e prezzo per Casa Tolomea";
    t += ci ? " dal " + gg(ci) + (co ? " al " + gg(co) : "") + "." : ".";
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(t);
  }

  function mostra() {
    if (giaLasciato()) return; // ricontrollato qui: è il momento che conta
    segna("ct_popup");
    stile();

    var oggi = new Date().toISOString().slice(0, 10);
    var box = document.createElement("div");
    box.className = "ct-pop";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", T.title);
    box.innerHTML = ''
      + '<div class="ct-pop__bd" data-chiudi></div>'
      + '<div class="ct-pop__card">'
      + '<button type="button" class="ct-pop__x" aria-label="' + T.close + '" data-chiudi>&times;</button>'
      + '<h3>' + T.title + '</h3>'
      + '<p class="ct-lead">' + T.lead + '</p>'
      + '<form novalidate>'
      + '<div class="ct-row">'
      + '<div class="ct-f"><label for="ct-ci">' + T.checkin + '</label><input id="ct-ci" type="date" min="' + oggi + '"></div>'
      + '<div class="ct-f"><label for="ct-co">' + T.checkout + '</label><input id="ct-co" type="date" min="' + oggi + '"></div>'
      + '</div>'
      + '<div class="ct-f"><input id="ct-em" type="email" placeholder="' + T.email + '" autocomplete="email"></div>'
      + '<p class="ct-msg" role="status" hidden></p>'
      + '<button type="submit" class="ct-btn ct-btn--p">' + T.submit + '</button>'
      + '<p class="ct-or"><span>' + T.or + '</span></p>'
      + '<a class="ct-btn ct-btn--g" id="ct-wa" target="_blank" rel="noopener" data-contatto="whatsapp|popup-guida" href="' + waLink("", "") + '">' + T.waBtn + '</a>'
      + '<p class="ct-hint">' + T.hint + ' <a href="/privacy.html" target="_blank" rel="noopener">' + T.privacy + '</a></p>'
      + '</form></div>';
    document.body.appendChild(box);

    var ci = box.querySelector("#ct-ci"), co = box.querySelector("#ct-co");
    var em = box.querySelector("#ct-em"), msg = box.querySelector(".ct-msg");
    var wa = box.querySelector("#ct-wa"), form = box.querySelector("form");

    function chiudi() { box.remove(); document.removeEventListener("keydown", onEsc); }
    function onEsc(e) { if (e.key === "Escape") chiudi(); }
    document.addEventListener("keydown", onEsc);
    box.addEventListener("click", function (e) { if (e.target.hasAttribute("data-chiudi")) chiudi(); });

    // Il check-out non può precedere il check-in, e le date scelte finiscono
    // anche nel messaggio WhatsApp già scritto.
    function sync() {
      if (ci.value) co.min = ci.value;
      if (co.value && ci.value && co.value < ci.value) co.value = "";
      wa.href = waLink(ci.value, co.value);
    }
    ci.addEventListener("change", sync);
    co.addEventListener("change", sync);
    wa.addEventListener("click", function () { segna("ct_contatto"); setTimeout(chiudi, 300); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mail = (em.value || "").trim();
      msg.hidden = false;
      if (!mail || !/\S+@\S+\.\S+/.test(mail)) { msg.className = "ct-msg err"; msg.textContent = T.msgFill; return; }
      // Invio best-effort: non deve mai bloccare l'utente. Dal dominio pubblico
      // soltanto, per non sporcare i numeri con le verifiche in locale.
      if (/(^|\.)casatolomea\.it$/.test(location.hostname)) {
        var base = {
          origine: "popup-guida",
          email: mail,
          checkin: ci.value || null,
          checkout: co.value || null,
        };
        var p = preventivo(ci.value, co.value);
        var riga = JSON.parse(JSON.stringify(base));
        riga.totale = p ? p.totale : null;
        riga.notti = p ? p.notti : null;
        salva(riga, base); // base = ripiego senza le colonne nuove
      }
      segna("ct_contatto");
      msg.className = "ct-msg ok"; msg.textContent = T.msgOk;
      setTimeout(chiudi, 1800);
    });
  }

  /* ── Quando compare ────────────────────────────────────────────────────
     Desktop: il mouse esce dal bordo alto della finestra (sta per chiudere la
     scheda o tornare a Google), armato solo dopo 6 secondi.
     Mobile: l'exit-intent del mouse non esiste. Il segnale equivalente è la
     risalita rapida verso l'alto dopo aver letto un pezzo di pagina, cioè il
     pollice che torna alla barra degli indirizzi o al tasto indietro. Rete di
     sicurezza a 50 secondi per chi resta fermo a leggere.                  */
  function avvia() {
    if (giaLasciato()) return;
    var fatto = false;
    function show() { if (!fatto) { fatto = true; mostra(); } }

    if (window.matchMedia("(min-width: 821px)").matches) {
      setTimeout(function () {
        document.addEventListener("mouseout", function (e) {
          if (e.clientY <= 0 && !e.relatedTarget) show();
        });
      }, 6000);
    } else {
      // La posizione si campiona a intervalli invece di ascoltare l'evento
      // "scroll": sulla home scorre il body (Lenis) e quell'evento su window
      // non arriva mai. Il campionamento funziona con qualunque scroller, e
      // così le due versioni si comportano allo stesso modo.
      var poll;
      setTimeout(function () {
        var lastY = window.scrollY, risalita = 0, inizio = 0;
        poll = setInterval(function () {
          var y = window.scrollY;
          var doc = document.documentElement.scrollHeight - window.innerHeight;
          var letto = doc > 0 ? (y + window.innerHeight * 0.5) / doc : 1;
          if (y < lastY) {
            if (!risalita) inizio = Date.now();
            risalita += lastY - y;
            // Oltre un secondo e mezzo non è una risalita di uscita: sta solo
            // tornando indietro a rileggere un pezzo.
            if (Date.now() - inizio > 1500) risalita = 0;
            else if (risalita > 400 && letto > 0.2) { clearInterval(poll); show(); }
          } else risalita = 0;
          lastY = y;
        }, 150);
      }, 8000);
      setTimeout(function () { clearInterval(poll); show(); }, 50000);
    }
  }

  // Aggancio per vederlo a comando senza aspettare il trigger: dalla console
  // del browser, ctPopupProva(). Serve a controllare testi e impaginazione
  // dopo una modifica, non cambia il comportamento normale.
  window.ctPopupProva = function () { try { sessionStorage.removeItem("ct_popup"); } catch (e) { /* ignora */ } mostra(); };
  // Anche il calcolo del preventivo è ispezionabile, per confrontarlo con
  // quello del form della home: ctPopupProva.preventivo("2026-10-02","2026-10-05").
  window.ctPopupProva.preventivo = preventivo;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
  else avvia();
})();
