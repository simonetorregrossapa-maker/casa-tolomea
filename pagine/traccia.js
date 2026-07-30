/* ============================================================================
   Tracciamento per le pagine di contenuto statiche.
   Stessa logica e stesse tabelle di src/analytics.js (visite + eventi_contatto),
   riscritta senza import perché queste pagine non caricano il bundle React.
   Cookieless: nessun cookie, nessun dato personale, solo path/sorgente/device.
============================================================================ */
(function () {
  // Si traccia SOLO dal dominio pubblico: le anteprime locali e i server di
  // verifica non devono finire nei numeri (è già successo di ritrovarsi righe
  // di test da ripulire a mano nel database).
  if (!/(^|\.)casatolomea\.it$/.test(location.hostname)) return;

  var URL_SB = "https://wbooxigzhkjljkkroibn.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib294aWd6aGtqbGpra3JvaWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjIxNjYsImV4cCI6MjA5ODYzODE2Nn0.kIAXPhDIo2ZgEmtvkQDApi9ZPtt1s1e-6tg1CwaY9rE";

  var UTM = { qr: "qr", gbp: "google-gbp", "google-business": "google-gbp", selftest: "selftest" };

  function classifica(ref, utm) {
    if (utm) { var k = utm.toLowerCase().trim(); return UTM[k] || k; }
    if (!ref) return "diretto";
    var host = "";
    try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch (e) { return "altro"; }
    if (host.indexOf(location.hostname.replace(/^www\./, "")) >= 0) return "interno";
    if (/google\./.test(host)) return "google";
    if (/booking\.com|letsbookhotel|planetofhotels/.test(host)) return "booking";
    if (/airbnb\./.test(host)) return "airbnb";
    if (/facebook\.|fb\.|instagram\.|l\.instagram|lm\.facebook/.test(host)) return "social";
    if (/bing\.|duckduckgo\.|ecosia\.|yahoo\./.test(host)) return "altri-motori";
    return host;
  }

  function sorgente() {
    var utm = new URLSearchParams(location.search).get("utm_source") || "";
    return classifica(document.referrer || "", utm);
  }

  function device() {
    return window.matchMedia("(max-width: 820px)").matches ? "mobile" : "desktop";
  }

  function invia(tabella, row) {
    try {
      fetch(URL_SB + "/rest/v1/" + tabella, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: KEY,
          Authorization: "Bearer " + KEY,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
        keepalive: true,
      }).catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  // Visita: una riga per caricamento, deduplicata nella sessione di navigazione.
  try {
    if (!sessionStorage.getItem("v_sent_" + location.pathname)) {
      sessionStorage.setItem("v_sent_" + location.pathname, "1");
      invia("visite", {
        path: (location.pathname + location.search + location.hash).slice(0, 300),
        referrer: (document.referrer || "").slice(0, 300),
        source: sorgente(),
        device: device(),
        lang: (navigator.language || "").slice(0, 5),
      });
    }
  } catch (e) { /* sessionStorage bloccato: si procede comunque */ }

  // Click sui canali di contatto: [data-contatto="canale|posizione"].
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-contatto]") : null;
    if (!el) return;
    var parti = (el.getAttribute("data-contatto") || "").split("|");
    invia("eventi_contatto", {
      canale: parti[0] || "sconosciuto",
      posizione: parti[1] || "pagina-seo",
      source: sorgente(),
      path: (location.pathname + location.search).slice(0, 300),
      device: device(),
    });
  }, true);
})();
