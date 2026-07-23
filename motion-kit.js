/* ============================================================================
   MOTION KIT — interazioni "stile 21st.dev" in vanilla JS.
   Additivo e isolato: nessuna dipendenza, nessun conflitto con app.js.
   1) Spotlight: aggiorna --mx/--my sulle card in base al cursore.
   2) Magnetico: i CTA grandi seguono lievemente il puntatore.
   Tutto disattivato sotto prefers-reduced-motion e su dispositivi touch/coarse.
============================================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (reduce || coarse) return;

  /* --- 1) Spotlight sulle card chiave ---------------------------------- */
  var cards = document.querySelectorAll(".book-card, .review, .season");
  cards.forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* --- 2) CTA grandi magnetici ---------------------------------------- */
  var STRENGTH = 0.16;   // quanto segue il cursore
  var LIFT = -3;         // sollevamento verticale (px), come l'hover originale
  var buttons = document.querySelectorAll(".btn--primary.btn--lg");
  buttons.forEach(function (btn) {
    btn.classList.add("is-magnetic");
    var raf = null, tx = 0, ty = 0;
    function apply() {
      btn.style.transform = "translate(" + tx.toFixed(1) + "px," + (ty + LIFT).toFixed(1) + "px)";
      raf = null;
    }
    btn.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * STRENGTH;
      ty = (e.clientY - r.top - r.height / 2) * STRENGTH;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    btn.addEventListener("pointerleave", function () {
      tx = ty = 0;
      btn.style.transform = "";
    });
  });
})();
