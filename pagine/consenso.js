/* ============================================================
   Casa Tolomea · consenso cookie + Microsoft Clarity
   Un solo file per la pagina principale (React) e le pagine statiche.

   Cosa fa:
   - Mostra un banner piccolo in basso con "Accetta" e "Rifiuta" grandi
     uguali (regola del Garante). La X chiude e vale come rifiuto.
   - Solo con "Accetta" carica Microsoft Clarity (registrazioni delle
     visite, mappe dei click) e gli manda il consenso. Con "Rifiuta"
     Clarity non viene nemmeno scaricato.
   - Ricorda la scelta per 6 mesi (localStorage, consentito: serve solo a
     non richiedere). Poi la richiede.
   - window.ctConsenso.apri() riapre il banner (link "Preferenze cookie").

   Il conteggio visite e percorso su Supabase NON dipende da qui: non usa
   cookie e funziona per tutti.
   ============================================================ */
(function () {
  "use strict";

  // ID del progetto Clarity (clarity.microsoft.com → Impostazioni → Installazione).
  // Vuoto = niente banner e niente Clarity: il sito resta come prima.
  var CLARITY_ID = "";

  var CHIAVE = "ct_consenso";
  var VERSIONE = 1;
  var SEI_MESI = 182 * 24 * 60 * 60 * 1000;

  if (window.ctConsenso) return; // già caricato (doppio tag)
  var soloDominio = /(^|\.)casatolomea\.it$/.test(location.hostname);

  var TESTI = {
    it: {
      titolo: "Questo sito usa i cookie",
      testo: "Usiamo i cookie per offrirti la migliore esperienza sul sito.",
      accetta: "Accetta", rifiuta: "Rifiuta", chiudi: "Chiudi e rifiuta", info: "Informativa privacy"
    },
    en: {
      titolo: "This site uses cookies",
      testo: "We use cookies to give you the best experience on our site.",
      accetta: "Accept", rifiuta: "Decline", chiudi: "Close and decline", info: "Privacy policy"
    },
    de: {
      titolo: "Diese Website verwendet Cookies",
      testo: "Wir verwenden Cookies, um Ihnen das beste Erlebnis auf unserer Website zu bieten.",
      accetta: "Akzeptieren", rifiuta: "Ablehnen", chiudi: "Schließen und ablehnen", info: "Datenschutz"
    },
    fr: {
      titolo: "Ce site utilise des cookies",
      testo: "Nous utilisons des cookies pour vous offrir la meilleure expérience sur notre site.",
      accetta: "Accepter", rifiuta: "Refuser", chiudi: "Fermer et refuser", info: "Confidentialité"
    }
  };
  function testi() {
    var l = (document.documentElement.lang || "it").slice(0, 2).toLowerCase();
    if (/^\/en(\/|$)/.test(location.pathname)) l = "en";
    return TESTI[l] || TESTI.it;
  }

  function leggi() {
    try {
      var s = JSON.parse(localStorage.getItem(CHIAVE) || "null");
      if (!s || s.v !== VERSIONE || Date.now() - s.t > SEI_MESI) return null;
      return s;
    } catch (e) { return null; }
  }
  function salva(ok) {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ v: VERSIONE, clarity: ok, t: Date.now() })); } catch (e) { /* storage bloccato: richiederà alla prossima visita */ }
  }

  var claritaCaricata = false;
  function caricaClarity() {
    if (claritaCaricata || !CLARITY_ID || !soloDominio) return;
    claritaCaricata = true;
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.clarity.ms/tag/" + encodeURIComponent(CLARITY_ID);
    document.head.appendChild(s);
  }
  function revocaClarity() {
    if (!window.clarity) return;
    try {
      window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
      window.clarity("consent", false); // cancella i cookie di Clarity
    } catch (e) { /* ignora */ }
  }

  /* ── Stile (variabili del sito, con riserva se la pagina non le ha) ── */
  var css = [
    ".ctc{position:fixed;z-index:120;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(400px,calc(100vw - 32px));",
    "background:var(--surface,#fffdf9);color:var(--ink,#211d16);border:1px solid var(--line,#e2d4c0);border-radius:18px;",
    "box-shadow:0 24px 60px -24px rgba(33,29,22,.34),0 2px 6px rgba(33,29,22,.06);padding:18px 18px 16px;",
    "font-family:var(--font-body,'Karla',system-ui,sans-serif);font-size:.94rem;line-height:1.5;",
    "opacity:0;transform:translateY(14px);transition:opacity 320ms cubic-bezier(.23,1,.32,1),transform 320ms cubic-bezier(.23,1,.32,1)}",
    ".ctc.is-in{opacity:1;transform:none}",
    ".ctc.is-out{opacity:0;transform:translateY(10px);transition-duration:180ms}",
    ".ctc h2{font-family:var(--font-display,'Fraunces',Georgia,serif);font-weight:500;font-size:1.12rem;line-height:1.25;margin:0 34px 6px 0;letter-spacing:-.01em}",
    ".ctc p{margin:0;color:var(--muted,#6f695c)}",
    ".ctc p a{color:var(--accent,#a8472f);text-underline-offset:2px}",
    ".ctc-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}",
    ".ctc-btn{appearance:none;border:0;border-radius:999px;min-height:44px;padding:.7em 1em;font:inherit;font-weight:700;cursor:pointer;",
    "transition:transform 160ms cubic-bezier(.23,1,.32,1),background-color 160ms ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    ".ctc-btn:active{transform:scale(.97)}",
    ".ctc-btn:focus-visible,.ctc-x:focus-visible{outline:2px solid var(--accent,#a8472f);outline-offset:2px}",
    ".ctc-si{background:var(--accent,#a8472f);color:#fff}",
    ".ctc-no{background:var(--ink,#211d16);color:#fff}",
    "@media (hover:hover) and (pointer:fine){.ctc-si:hover{background:#953d27}.ctc-no:hover{background:#3a342a}}",
    ".ctc-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--muted,#6f695c);",
    "cursor:pointer;display:grid;place-items:center;transition:background-color 160ms ease,transform 160ms cubic-bezier(.23,1,.32,1)}",
    ".ctc-x:active{transform:scale(.94)}",
    "@media (hover:hover) and (pointer:fine){.ctc-x:hover{background:var(--bg-2,#efe4d3)}}",
    ".ctc-x svg{width:16px;height:16px}",
    /* Il bottone WhatsApp fisso sale sopra il banner su mobile, poi torna giù. */
    ".fab{transition:transform .4s cubic-bezier(.22,1,.36,1)}",
    "html.ctc-aperto .fab{transform:translateY(calc(-1 * var(--ctc-h,0px) - 8px))}",
    "@media (min-width:821px){html.ctc-aperto .fab{transform:none}}",
    "@media (max-width:820px){.ctc{left:12px;right:12px;width:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px))}}",
    "@media (prefers-reduced-motion:reduce){.ctc,.ctc.is-out{transform:none!important;transition:opacity 200ms ease}}"
  ].join("");

  var box = null, ro = null;

  function chiudi(ok) {
    salva(ok);
    if (ok) caricaClarity(); else revocaClarity();
    if (!box) return;
    var b = box; box = null;
    if (ro) { ro.disconnect(); ro = null; }
    b.classList.remove("is-in");
    b.classList.add("is-out");
    document.documentElement.classList.remove("ctc-aperto");
    setTimeout(function () { b.remove(); }, 200);
  }

  function apri() {
    if (!CLARITY_ID || box) return;
    if (!document.getElementById("ctc-css")) {
      var st = document.createElement("style");
      st.id = "ctc-css";
      st.textContent = css;
      document.head.appendChild(st);
    }
    var T = testi();
    box = document.createElement("section");
    box.className = "ctc";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-labelledby", "ctc-t");
    box.setAttribute("aria-describedby", "ctc-d");
    box.innerHTML =
      '<button type="button" class="ctc-x" aria-label="' + T.chiudi + '">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>' +
      '</button>' +
      '<h2 id="ctc-t">' + T.titolo + '</h2>' +
      '<p id="ctc-d">' + T.testo + ' <a href="/privacy.html#cookie" target="_blank" rel="noopener">' + T.info + '</a></p>' +
      '<div class="ctc-row">' +
        '<button type="button" class="ctc-btn ctc-no">' + T.rifiuta + '</button>' +
        '<button type="button" class="ctc-btn ctc-si">' + T.accetta + '</button>' +
      '</div>';
    box.querySelector(".ctc-x").onclick = function () { chiudi(false); };
    box.querySelector(".ctc-no").onclick = function () { chiudi(false); };
    box.querySelector(".ctc-si").onclick = function () { chiudi(true); };
    document.body.appendChild(box);

    // Altezza del banner per spostare il bottone WhatsApp quanto basta.
    var root = document.documentElement;
    var misura = function () { if (box) root.style.setProperty("--ctc-h", box.offsetHeight + "px"); };
    misura();
    if ("ResizeObserver" in window) { ro = new ResizeObserver(misura); ro.observe(box); }
    root.classList.add("ctc-aperto");

    // Due frame: il primo fissa lo stato di partenza, il secondo anima.
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add("is-in"); }); });
  }

  function avvia() {
    if (!CLARITY_ID) return;
    document.documentElement.classList.add("ctc-attivo"); // mostra "Preferenze cookie" nel piè di pagina
    var s = leggi();
    if (s) { if (s.clarity) caricaClarity(); return; }
    // Un attimo di respiro: il banner non deve coprire il primo colpo d'occhio.
    setTimeout(apri, 1200);
  }

  window.ctConsenso = { apri: apri, stato: leggi };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
  else avvia();
})();
