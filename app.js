/* ============================================================================
   Casa Vacanze — orchestrazione: binding da config, render, animazioni GSAP
   + Lenis, galleria orizzontale, preventivo e richiesta di prenotazione.
   Degrada con eleganza: senza GSAP/CDN i contenuti restano visibili; senza
   backend la richiesta apre WhatsApp / email precompilata.
   ============================================================================ */
(function () {
  "use strict";
  const S = window.SITE || {};
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || /[?&]static\b/.test(location.search);

  /* ── i18n (IT/EN) ─────────────────────────────────────────────────── */
  let currentLang = localStorage.getItem("lang") === "en" ? "en" : "it";
  const tIt = (v) => (v && typeof v === "object") ? (v.it ?? v.en ?? "") : (v ?? "");
  const tEn = (v) => (v && typeof v === "object") ? (v.en ?? v.it ?? "") : (v ?? "");
  const t = (v) => (currentLang === "en" ? tEn(v) : tIt(v));
  const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // Span/label con testo in entrambe le lingue: applyLang() li aggiorna in-place
  // (senza rigenerare il markup) così le animazioni GSAP non vengono perse.
  const bi = (v) => `data-it="${escAttr(tIt(v))}" data-en="${escAttr(tEn(v))}"`;

  /* ── Icone SVG (line, stroke 1.5) ──────────────────────────────────── */
  const ICONS = {
    wifi:    '<path d="M5 12.5a10 10 0 0114 0M8 16a5 5 0 018 0"/><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none"/>',
    ac:      '<rect x="3" y="5" width="18" height="9" rx="2"/><path d="M7 18s0 2 2 2m4-2s0 2 2 2m-9-6h14"/>',
    kitchen: '<path d="M5 3v6a3 3 0 006 0V3M8 3v18M16 3c-1.5 0-2 2-2 4s.5 4 2 4 2-2 2-4-.5-4-2-4zM16 15v6"/>',
    parking: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 16V8h3.5a2.5 2.5 0 010 5H9"/>',
    washer:  '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M7 6h.01M10 6h.01"/>',
    dishwasher: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M8 5h6"/><path d="M9 12c1 1 1 4 0 5M13 12c1 1 1 4 0 5"/>',
    tv:      '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    garden:  '<path d="M12 21V11M12 11c0-3 2-5 5-5 0 3-2 5-5 5zM12 13c0-3-2-5-5-5 0 3 2 5 5 5z"/>',
    bbq:     '<path d="M6 7h12l-1.5 7a5 5 0 01-9 0L6 7z"/><path d="M9 18l-1 3M15 18l1 3M9 4s1-1 0-2M13 4s1-1 0-2"/>',
    heating: '<path d="M9 4s1.5 2 0 4-0 4 0 4M15 4s1.5 2 0 4 0 4 0 4M5 20h14"/>',
    crib:    '<path d="M3 8v10M21 8v10M3 12h18M7 12v6M11 12v6M15 12v6M19 12v6M3 8h18"/>',
    sea:     '<path d="M3 16c2 0 2 2 4.5 2S10 16 12 16s2 2 4.5 2S19 16 21 16M3 20c2 0 2 2 4.5 2S10 20 12 20s2 2 4.5 2S19 20 21 20M12 4l3 6H9l3-6z"/>',
    town:    '<path d="M3 21V9l6-4 6 4v12M9 21v-5h4v5M19 21V11l-4-2.5M15 12h.01M9 11h.01M9 14h.01"/>',
    camera:  '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
    cart:    '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.5 12h10l2-8H6"/>',
    plane:   '<path d="M10 18l2 3 1-4 5-3 3 1V9l-4-1-3-5-1 1v5l-4 2-1-2-2 1 2 4-2 1 1 2 3-2z"/>',
    check:   '<path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>',
    key:     '<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8m-3-3l2-2m-4 0l2-2"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.check}</svg>`;
  const star = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.2 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.2l1.4-6.7-5-4.6 6.8-.7z"/></svg>';

  const photo = (item, w = 1200) =>
    item.src ? item.src : `https://images.unsplash.com/photo-${item.u}?auto=format&fit=crop&w=${w}&q=80`;

  /* ── Tema + font da config ─────────────────────────────────────────── */
  function applyTheme() {
    const t = S.tema || {};
    const r = document.documentElement.style;
    Object.entries(t.colori || {}).forEach(([k, v]) => r.setProperty(`--c-${k}`, v));
    if (t.fontTitoli) r.setProperty("--font-display", t.fontTitoli);
    if (t.fontTesto)  r.setProperty("--font-body", t.fontTesto);
  }

  /* ── Binding testo / href / whatsapp ───────────────────────────────── */
  function waLink(prefill) {
    const num = (S.contatti && S.contatti.whatsapp) || "";
    const txt = encodeURIComponent(prefill || `Salve, sono interessato a ${S.casa?.nome || "la casa"}. Vorrei informazioni sulla disponibilità.`);
    return `https://wa.me/${num}?text=${txt}`;
  }
  // Il messaggio WhatsApp/email è sempre in italiano: arriva al proprietario,
  // non all'ospite, indipendentemente dalla lingua scelta sul sito.
  function fmtDateIt(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${DP_MESI.it[m - 1].toLowerCase()} ${y}`;
  }
  // Riflette in tempo reale le date/ospiti scelti nel form in tutti i bottoni
  // WhatsApp della pagina; se il form è vuoto usa il messaggio generico.
  function updateWhatsAppLinks() {
    const ci = $("#checkin")?.value, co = $("#checkout")?.value, g = $("#ospiti")?.value;
    let msg;
    if (ci && co) {
      const ospiti = g ? ` per ${g} ospit${g === "1" ? "e" : "i"}` : "";
      msg = `Ciao! Vorrei informazioni per ${S.casa?.nome || "la casa"} dal ${fmtDateIt(ci)} al ${fmtDateIt(co)}${ospiti}.`;
    }
    $$("[data-whatsapp]").forEach((el) => { el.href = waLink(msg); el.target = "_blank"; el.rel = "noopener"; });
  }

  // Cambia lingua senza reload: aggiorna in-place ogni nodo [data-it]/[data-en]
  // (testo statico e contenuti da config), i meta SEO e ricalcola preventivo e
  // link WhatsApp. Non tocca il DOM dei blocchi già rivelati da GSAP.
  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    $$("[data-it]").forEach((el) => {
      const val = lang === "en" ? (el.dataset.en || el.dataset.it) : el.dataset.it;
      if (el.hasAttribute("data-html")) el.innerHTML = val; else el.textContent = val;
    });
    $$("[data-it-ph]").forEach((el) => { el.placeholder = lang === "en" ? (el.dataset.enPh || el.dataset.itPh) : el.dataset.itPh; });
    document.title = t(S.seo?.titolo) || document.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && S.seo?.descrizione) metaDesc.setAttribute("content", t(S.seo.descrizione));
    bind();
    renderPriceNote();
    renderJsonLd();
    updateEstimate();
    updateWhatsAppLinks();
    const toggle = $("#langToggle");
    if (toggle) {
      toggle.textContent = lang === "it" ? "EN" : "IT";
      toggle.setAttribute("aria-label", lang === "it" ? "Switch to English" : "Passa all'italiano");
    }
  }

  function bind() {
    const map = {
      brand: S.casa?.nome,
      claim: t(S.casa?.claim),
      intro: t(S.casa?.intro),
      ospiti: S.casa?.ospiti,
      camere: S.casa?.camere,
      bagni: S.casa?.bagni,
      mq: S.casa?.mq,
      cin: S.casa?.cin,
      cir: S.casa?.cir,
      rispostaEntro: t(S.contatti?.rispostaEntro),
      zonaIntro: t(S.zona?.intro),
      localitaFull: `${S.casa?.localita} (${S.casa?.provincia}), ${S.casa?.regione}`,
      incentivoPct: S.incentivo?.percentuale,
      incentivoPortale: `${S.valuta || "€"}${S.incentivo?.prezzoPortale}`,
      incentivoDiretto: `${S.valuta || "€"}${S.incentivo?.prezzoDiretto}`,
    };
    $$("[data-bind]").forEach((el) => {
      const v = map[el.getAttribute("data-bind")];
      if (v !== undefined && v !== null) el.textContent = v;
    });
    $$("[data-bind-href]").forEach((el) => {
      const k = el.getAttribute("data-bind-href");
      if (k === "tel")   { el.href = `tel:${S.contatti?.telHref}`; el.textContent = S.contatti?.telDisplay; }
      if (k === "email") { el.href = `mailto:${S.contatti?.email}`; el.textContent = S.contatti?.email; }
    });
    document.title = t(S.seo?.titolo) || document.title;
    const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }

  /* ── Render sezioni ────────────────────────────────────────────────── */
  function renderTrustbar() {
    const items = [
      [svg("check"), { it: "Senza commissioni",         en: "No commissions" }],
      [svg("key"),   { it: "Prenotazione diretta",       en: "Direct booking" }],
      [svg("sea"),   { it: "A 700 m dal mare",            en: "700 m from the sea" }],
      [svg("check"), { it: "Miglior prezzo garantito",   en: "Best price guaranteed" }],
      [svg("garden"),{ it: "Giardino e patio",           en: "Garden and patio" }],
      [svg("key"),   { it: "Contatto col proprietario",  en: "Direct contact with the owner" }],
    ];
    const one = items.map(([icon, label]) => `<span>${icon}<span ${bi(label)}>${escAttr(t(label))}</span></span>`).join("");
    const el = $("#trustTrack"); if (el) el.innerHTML = one + one; // duplicato per loop
  }

  function renderGallery() {
    const track = $("#galleryTrack"); if (!track) return;
    const tot = (S.galleria || []).length;
    track.innerHTML = (S.galleria || []).map((g, i) => `
      <figure class="gallery__item" style="aspect-ratio:${g.ar || "3/2"}" data-lb="${i}" role="button" tabindex="0" aria-label="${escAttr(g.alt || "")} — foto ${i + 1} di ${tot}">
        <img src="${photo(g, 1400)}" alt="${g.alt || ""}" loading="${i < 3 ? "eager" : "lazy"}">
        <span class="gallery__num">${i + 1} / ${tot}</span>
      </figure>`).join("");
  }

  function renderAmenities() {
    const el = $("#amenitiesGrid"); if (!el) return;
    el.innerHTML = (S.dotazioni || []).map((d) =>
      `<div class="amenity" data-reveal="up">${svg(d.icon)}<span ${bi(d.label)}>${escAttr(t(d.label))}</span></div>`).join("");
  }

  function renderSpaces() {
    const el = $("#spacesGrid"); if (!el) return;
    el.innerHTML = (S.spazi || []).map((s, i) =>
      `<div class="space" data-reveal="up"><span class="idx num">0${i + 1}</span><b ${bi(s.nome)}>${escAttr(t(s.nome))}</b><p ${bi(s.descr)}>${escAttr(t(s.descr))}</p></div>`).join("");
  }

  // Lista servizi completa, per categoria (S.serviziCompleti). Card con titolo
  // categoria + elenco voci. Stile inline sui token del tema, così non serve CSS.
  function renderServizi() {
    const el = $("#serviziFull"); if (!el) return;
    const cats = S.serviziCompleti || [];
    if (!cats.length) { el.style.display = "none"; return; }
    el.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:16px";
    el.innerHTML = cats.map((c) => `
      <div class="servizio-cat" data-reveal="up" style="background:var(--c-surface);border:1px solid var(--c-line);border-radius:14px;padding:20px 22px">
        <b ${bi(c.cat)} style="display:block;font-family:var(--font-display);font-size:1.06rem;color:var(--c-accent);margin-bottom:8px">${escAttr(t(c.cat))}</b>
        <p ${bi(c.voci)} style="margin:0;font-size:.92rem;line-height:1.62;color:var(--c-muted)">${escAttr(t(c.voci))}</p>
      </div>`).join("");
  }

  function renderZona() {
    const el = $("#zonaList"); if (el) {
      el.innerHTML = (S.zona?.punti || []).map((p) =>
        `<div class="zona-row">${svg(p.icon)}<span class="name" ${bi(p.nome)}>${escAttr(t(p.nome))}</span><span class="dist num">${p.distanza}</span></div>`).join("");
    }
    const map = $("#mapFrame");
    if (map) {
      const q = encodeURIComponent(S.contatti?.mapsQuery || S.casa?.localita || "Italia");
      map.src = S.contatti?.mapsEmbed || `https://maps.google.com/maps?q=${q}&z=12&output=embed`;
    }
  }

  function renderSeasons() {
    const el = $("#seasonsGrid"); if (!el) return;
    const cur = S.valuta || "€";
    const max = Math.max(...(S.stagioni || []).map((s) => s.prezzoNotte));
    el.innerHTML = (S.stagioni || []).map((s) => {
      const minStay = { it: `Soggiorno minimo ${s.minNotti} notti`, en: `Minimum stay ${s.minNotti} nights` };
      return `
      <div class="season ${s.prezzoNotte === max ? "is-high" : ""}" data-reveal="up">
        <div class="s-name" ${bi(s.nome)}>${escAttr(t(s.nome))}</div>
        <div class="s-period" ${bi(s.periodo)}>${escAttr(t(s.periodo))}</div>
        <div class="s-price">${cur}${s.prezzoNotte}<small data-it="/ notte" data-en="/ night"> / notte</small></div>
        <div class="s-min" ${bi(minStay)}>${escAttr(t(minStay))}</div>
      </div>`;
    }).join("");
    renderPriceNote();
  }

  function renderPriceNote() {
    const note = $("#priceNote");
    if (!note || !S.extra) return;
    const cur = S.valuta || "€";
    const it = `Pulizia finale ${cur}${S.extra.pulizie} una tantum · Cauzione ${cur}${S.extra.cauzione} (restituita) · Tassa di soggiorno ${cur}${S.extra.tassaSoggiorno}/persona a notte ove prevista.`;
    const en = `Final cleaning ${cur}${S.extra.pulizie} one-time fee · Security deposit ${cur}${S.extra.cauzione} (refunded) · Tourist tax ${cur}${S.extra.tassaSoggiorno}/person per night where applicable.`;
    note.dataset.it = it; note.dataset.en = en;
    note.textContent = currentLang === "en" ? en : it;
  }

  function renderJsonLd() {
    const dominio = (S.seo?.dominio || "").replace(/\/$/, "");
    const data = {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name: S.casa?.nome,
      description: t(S.casa?.intro),
      url: dominio || undefined,
      image: dominio ? [`${dominio}/assets/social/social.jpg`] : undefined,
      telephone: S.contatti?.telHref,
      priceRange: `${S.valuta || "€"}${Math.min(...(S.stagioni || []).map((s) => s.prezzoNotte))}–${S.valuta || "€"}${Math.max(...(S.stagioni || []).map((s) => s.prezzoNotte))}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: S.casa?.localita,
        addressRegion: S.casa?.regione,
        addressCountry: "IT",
      },
      geo: S.casa?.geo ? { "@type": "GeoCoordinates", latitude: S.casa.geo.lat, longitude: S.casa.geo.lng } : undefined,
      numberOfRooms: S.casa?.camere,
      amenityFeature: (S.dotazioni || []).map((d) => ({ "@type": "LocationFeatureSpecification", name: t(d.label), value: true })),
    };
    let el = document.getElementById("ldJson");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "ldJson";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data); // JSON.stringify omette da sé le chiavi undefined
  }

  function renderReviews() {
    const el = $("#reviewsGrid"); if (!el) return;
    // Badge punteggio ospiti (S.recensioniRating), sintesi Booking.
    const scoreEl = $("#reviewScore");
    const rt = S.recensioniRating;
    if (scoreEl) {
      if (rt && rt.voto && (S.recensioni || []).length) {
        scoreEl.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:16px 26px;justify-content:center;background:var(--c-surface);border:1px solid var(--c-line);border-radius:16px;padding:18px 24px;max-width:780px;margin:0 auto clamp(28px,4vw,44px)";
        const cats = (rt.categorie || []).map((c) =>
          `<span style="white-space:nowrap;font-size:.84rem;color:var(--c-muted)" ${bi(c.n)}>${escAttr(t(c.n))}</span>&nbsp;<b style="font-size:.84rem;color:var(--c-ink)">${c.v}</b>`).join('<span style="opacity:.35;padding:0 2px">·</span>');
        scoreEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px">
            <span style="background:var(--c-accent);color:#fff;font-family:var(--font-display);font-size:1.5rem;font-weight:600;border-radius:12px;padding:7px 14px;line-height:1">${rt.voto}</span>
            <span style="text-align:left"><b style="display:block;font-size:1rem;color:var(--c-ink)" ${bi(rt.etichetta)}>${escAttr(t(rt.etichetta))}</b><small style="color:var(--c-muted)">${rt.count} ${escAttr(t({ it: "recensioni", en: "reviews" }))} · Booking.com</small></span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center">${cats}</div>`;
      } else { scoreEl.style.display = "none"; }
    }
    const recensioni = S.recensioni || [];
    const section = document.getElementById("recensioni");
    const navLink = document.querySelector('a[href="#recensioni"]');
    if (!recensioni.length) {
      if (section) section.style.display = "none";
      if (navLink) navLink.style.display = "none";
      return;
    }
    el.innerHTML = recensioni.map((r) => `
      <article class="review" data-reveal="up">
        <div class="stars" aria-label="${r.stelle} su 5">${star.repeat(r.stelle)}</div>
        <p>“${r.testo}”</p>
        <div class="who">${r.nome}<small>${r.luogo}</small></div>
      </article>`).join("");
    const more = $("#reviewsMore");
    if (more) {
      more.innerHTML = S.recensioniBookingUrl
        ? `<a href="${S.recensioniBookingUrl}" target="_blank" rel="noopener" ${bi({ it: "Vedi tutte le recensioni su Booking", en: "See all reviews on Booking" })}>${escAttr(t({ it: "Vedi tutte le recensioni su Booking", en: "See all reviews on Booking" }))}</a>`
        : "";
    }
  }

  function fillGuests() {
    const sel = $("#ospiti"); if (!sel) return;
    const max = S.casa?.ospiti || 6;
    sel.innerHTML = Array.from({ length: max }, (_, i) =>
      `<option value="${i + 1}">${i + 1} ${i ? "ospiti" : "ospite"}</option>`).join("");
    sel.value = Math.min(2, max);
  }

  /* ── Disponibilità (Booking iCal via Supabase Edge Function) ────────── */
  const DP_WD = {
    it: ["Lu", "Ma", "Me", "Gio", "Ve", "Sa", "Do"],
    en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  };
  const DP_MESI = {
    it: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

  const availability = { busySet: new Set(), ok: false, loaded: false };
  async function loadAvailability() {
    const ig = S.integrazioni || {};
    if (!ig.supabaseUrl) { availability.loaded = true; return availability; }
    // Fonte unica: Booking + prenotazioni-sito confermate + blocchi manuali.
    // NB: lo slug URL è "hyper-responder" (assegnato dal dashboard al deploy),
    // non "disponibilita" che è solo l'etichetta mostrata in Edge Functions.
    const url = `${ig.supabaseUrl.replace(/\/$/, "")}/functions/v1/hyper-responder`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(url, {
        headers: ig.supabaseAnonKey ? { apikey: ig.supabaseAnonKey, Authorization: `Bearer ${ig.supabaseAnonKey}` } : {},
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error("status " + r.status);
      const data = await r.json();
      // DTEND è il giorno di check-out (esclusivo): le notti occupate sono [start, end).
      (data.busy || []).forEach(({ start, end }) => {
        const last = parseIso(end);
        for (let d = parseIso(start); d < last; d.setDate(d.getDate() + 1)) availability.busySet.add(isoDate(d));
      });
      availability.ok = true;
    } catch (_) {
      availability.ok = false; // fallback: calendario resta usabile in modalità "richiesta libera"
    }
    availability.loaded = true;
    return availability;
  }

  function initDatePicker() {
    const ciEl = $("#checkin"), coEl = $("#checkout"), pop = $("#datePicker");
    if (!ciEl || !coEl || !pop) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let viewYear = today.getFullYear(), viewMonth = today.getMonth();
    let sel = { start: null, end: null };
    let hoverEnd = null;

    function monthCells(y, m) {
      const first = new Date(y, m, 1);
      const startOffset = (first.getDay() + 6) % 7; // settimana che inizia di lunedì
      const days = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startOffset; i++) cells.push(null);
      for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
      return cells;
    }
    function inSelRange(d) {
      if (!sel.start) return false;
      const end = sel.end || hoverEnd;
      return !!end && d > sel.start && d < end;
    }
    // Aggiorna SOLO le classi delle celle esistenti per l'anteprima del range,
    // senza ricostruire il calendario: rifarlo a ogni mouseenter distruggeva i
    // bottoni durante il click e impediva di selezionare il check-out.
    function paintHover() {
      $$(".dp-cell[data-date]", pop).forEach((btn) => {
        btn.classList.toggle("is-range", inSelRange(parseIso(btn.dataset.date)));
      });
    }
    function hasBusyBetween(a, b) {
      for (const d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
        if (d > a && availability.busySet.has(isoDate(d))) return true;
      }
      return false;
    }
    function renderMonth(y, m) {
      const cells = monthCells(y, m).map((d) => {
        if (!d) return `<span class="dp-cell dp-empty"></span>`;
        const iso = isoDate(d);
        const disabled = d < today || availability.busySet.has(iso);
        const cls = ["dp-cell"];
        if (disabled) cls.push("is-disabled");
        if (availability.busySet.has(iso)) cls.push("is-busy");
        if (sel.start && iso === isoDate(sel.start)) cls.push("is-start");
        if (sel.end && iso === isoDate(sel.end)) cls.push("is-end");
        if (inSelRange(d)) cls.push("is-range");
        if (iso === isoDate(today)) cls.push("is-today");
        return `<button type="button" class="${cls.join(" ")}" data-date="${iso}" ${disabled ? "disabled" : ""}>${d.getDate()}</button>`;
      }).join("");
      return `<div class="dp-month">
        <div class="dp-month-name">${DP_MESI[currentLang][m]} ${y}</div>
        <div class="dp-weekdays">${DP_WD[currentLang].map((w) => `<span>${w}</span>`).join("")}</div>
        <div class="dp-grid">${cells}</div>
      </div>`;
    }
    function onPick(d) {
      const invalid = !sel.start || sel.end || d <= sel.start || hasBusyBetween(sel.start, d);
      if (invalid) { sel = { start: d, end: null }; hoverEnd = null; render(); return; }
      sel.end = d;
      ciEl.value = isoDate(sel.start); coEl.value = isoDate(sel.end);
      ciEl.dispatchEvent(new Event("change"));
      coEl.dispatchEvent(new Event("change"));
      close();
    }
    function render() {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const notice = availability.loaded && !availability.ok
        ? `<p class="dp-notice">${currentLang === "en"
            ? "Real-time availability is temporarily unreachable: we'll verify the date manually after you submit."
            : "Disponibilità in tempo reale non raggiungibile al momento: verificheremo la data manualmente dopo l'invio."}</p>` : "";
      pop.innerHTML = `
        <div class="dp-head">
          <button type="button" class="dp-nav" id="dpPrev" aria-label="${currentLang === "en" ? "Previous month" : "Mese precedente"}">‹</button>
          <span>${currentLang === "en" ? "Check-in and check-out" : "Check-in e check-out"}</span>
          <button type="button" class="dp-nav" id="dpNext" aria-label="${currentLang === "en" ? "Next month" : "Mese successivo"}">›</button>
        </div>
        <div class="dp-months">${renderMonth(viewYear, viewMonth)}${renderMonth(nextYear, nextMonth)}</div>
        <div class="dp-legend"><span class="dp-dot is-busy"></span>${currentLang === "en" ? "Booked" : "Occupato"} <span class="dp-dot is-range"></span>${currentLang === "en" ? "Selected" : "Selezione"}</div>
        ${notice}`;
      $("#dpPrev").onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); };
      $("#dpNext").onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); };
      $$(".dp-cell:not(.dp-empty):not([disabled])", pop).forEach((btn) => {
        btn.addEventListener("click", () => onPick(parseIso(btn.dataset.date)));
        btn.addEventListener("mouseenter", () => { if (sel.start && !sel.end) { hoverEnd = parseIso(btn.dataset.date); paintHover(); } });
      });
    }
    function open() { pop.classList.add("open"); pop.setAttribute("aria-hidden", "false"); render(); }
    function close() { pop.classList.remove("open"); pop.setAttribute("aria-hidden", "true"); }

    [ciEl, coEl].forEach((el) => el.addEventListener("click", () => { pop.classList.contains("open") ? close() : open(); }));
    document.addEventListener("click", (e) => {
      if (!pop.classList.contains("open")) return;
      // composedPath riflette la gerarchia al momento del click, non dopo un
      // eventuale re-render del popover (che staccherebbe e.target dal DOM).
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (!path.includes(pop) && e.target !== ciEl && e.target !== coEl) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  /* ── Preventivo + form ─────────────────────────────────────────────── */
  const cur = S.valuta || "€";
  function seasonFor(date) {
    const md = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const key = md(date);
    const found = (S.stagioni || []).find((s) => {
      if (!s.dal || !s.al) return false;
      return s.dal <= s.al ? (key >= s.dal && key <= s.al) : (key >= s.dal || key <= s.al);
    });
    return found || (S.stagioni || [])[0];
  }
  function nightsBetween(a, b) { return Math.round((b - a) / 86400000); }

  // Raggruppa le notti del soggiorno per stagione (nel caso il range attraversi
  // più stagioni, es. fine giugno → inizio luglio), mantenendo l'ordine cronologico.
  function nightsBreakdown(a, b) {
    const segments = [];
    for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
      const st = seasonFor(d);
      const last = segments[segments.length - 1];
      if (last && last.st === st) last.nights++;
      else segments.push({ st, nights: 1 });
    }
    return segments;
  }

  function nightsWord(n) { return currentLang === "en" ? `night${n === 1 ? "" : "s"}` : `nott${n === 1 ? "e" : "i"}`; }

  function updateEstimate() {
    const box = $("#estimate");
    const ci = $("#checkin").value, co = $("#checkout").value;
    if (!ci || !co) {
      box.className = "estimate empty";
      box.textContent = currentLang === "en" ? "Enter dates to see the estimate." : "Inserisci le date per vedere il preventivo.";
      return null;
    }
    const a = new Date(ci), b = new Date(co);
    const n = nightsBetween(a, b);
    if (n <= 0) {
      box.className = "estimate empty";
      box.textContent = currentLang === "en" ? "Check-out must be after check-in." : "Il check-out deve essere dopo il check-in.";
      return null;
    }
    const segments = nightsBreakdown(a, b);
    const subtotal = segments.reduce((sum, seg) => sum + seg.st.prezzoNotte * seg.nights, 0);
    const pulizie = S.extra?.pulizie || 0;
    const total = subtotal + pulizie;
    // Il soggiorno minimo si verifica sulla stagione del check-in, che regola l'intera richiesta.
    const st = segments[0].st;
    let warn = "";
    if (st.minNotti && n < st.minNotti) {
      const msg = currentLang === "en"
        ? `Minimum stay ${st.minNotti} nights in ${t(st.nome).toLowerCase()}`
        : `Soggiorno minimo ${st.minNotti} notti in ${t(st.nome).toLowerCase()}`;
      warn = `<div class="est-row" style="color:var(--c-accent)">${msg}</div>`;
    }
    box.className = "estimate";
    const rows = segments.map((seg) =>
      `<div class="est-row"><span>${t(seg.st.nome)} · ${cur}${seg.st.prezzoNotte} × ${seg.nights} ${nightsWord(seg.nights)}</span><span>${cur}${seg.st.prezzoNotte * seg.nights}</span></div>`
    ).join("");
    box.innerHTML = `
      ${rows}
      <div class="est-row"><span>${currentLang === "en" ? "Final cleaning" : "Pulizia finale"}</span><span>${cur}${pulizie}</span></div>
      ${warn}
      <div class="est-total"><span>${currentLang === "en" ? "Estimated total" : "Totale stimato"}</span><b>${cur}${total}</b></div>`;
    return { n, st, total, segments };
  }

  function bookingSummary() {
    const ci = $("#checkin").value, co = $("#checkout").value, g = $("#ospiti").value;
    const est = updateEstimate();
    let s = `Richiesta prenotazione — ${S.casa?.nome}\n`;
    s += `Check-in: ${ci || "—"}\nCheck-out: ${co || "—"}\nOspiti: ${g}\n`;
    if (est) s += `Totale stimato: ${cur}${est.total} (${est.n} notti)\n`;
    const nome = $("#nome").value, email = $("#email").value, tel = $("#tel").value, note = $("#note").value;
    if (nome)  s += `Nome: ${nome}\n`;
    if (email) s += `Email: ${email}\n`;
    if (tel)   s += `Telefono: ${tel}\n`;
    if (note)  s += `Note: ${note}\n`;
    return s;
  }

  async function submitForm(e) {
    e.preventDefault();
    const form = e.target, msg = $("#formMsg");
    const ci = $("#checkin").value, co = $("#checkout").value;
    const nome = $("#nome").value.trim(), email = $("#email").value.trim();
    if (!ci || !co || !nome || !email) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en" ? "Fill in dates, name and email to send the request." : "Compila date, nome ed email per inviare la richiesta.";
      return;
    }
    if (!$("#privacy")?.checked) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en" ? "Please accept the privacy policy to continue." : "Devi accettare l'informativa privacy per continuare.";
      return;
    }
    const est = updateEstimate();
    if (est && est.st.minNotti && est.n < est.st.minNotti) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en"
        ? `In ${t(est.st.nome).toLowerCase()} the minimum stay is ${est.st.minNotti} nights.`
        : `In ${t(est.st.nome).toLowerCase()} il soggiorno minimo è di ${est.st.minNotti} notti.`;
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; const prev = btn.textContent; btn.textContent = currentLang === "en" ? "Sending…" : "Invio in corso…";

    const payload = {
      casa: S.casa?.nome, checkin: ci, checkout: co, ospiti: $("#ospiti").value,
      nome, email, telefono: $("#tel").value.trim(), note: $("#note").value.trim(),
      totale_stimato: est ? est.total : null, creato: new Date().toISOString(),
    };

    let saved = false;
    const ig = S.integrazioni || {};
    try {
      // 1) Supabase (se configurato)
      if (ig.supabaseUrl && ig.supabaseAnonKey) {
        const r = await fetch(`${ig.supabaseUrl}/rest/v1/richieste`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ig.supabaseAnonKey, Authorization: `Bearer ${ig.supabaseAnonKey}`, Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
        if (r.ok) saved = true;
      }
      // Email gestite server-side: l'INSERT in "richieste" innesca la Edge
      // Function "nuova-richiesta" (Resend) che manda la notifica al proprietario
      // e la conferma di ricezione all'ospite. Niente EmailJS lato client.
    } catch (_) { /* rete assente → fallback sotto */ }

    btn.disabled = false; btn.textContent = prev;

    const rispostaEntro = t(S.contatti?.rispostaEntro) || (currentLang === "en" ? "24 hours" : "24 ore");
    // Nessun pagamento online: alla conferma il proprietario invia via email i
    // dati per il bonifico della caparra (30%); il saldo si versa all'arrivo.
    const depositNote = currentLang === "en"
      ? "Once we confirm availability, we'll email you the details to pay the 30% deposit by bank transfer; the balance is paid on arrival, tourist tax included."
      : "Alla conferma della disponibilità ti invieremo via email i dati per versare la caparra del 30% con bonifico; il saldo si paga all'arrivo, tassa di soggiorno inclusa.";
    if (saved) {
      msg.className = "form-msg ok";
      msg.innerHTML = currentLang === "en"
        ? `Request sent! We'll reply within <b>${rispostaEntro}</b>. ${depositNote} For an immediate reply you can also write to us on <a href="${waLink(bookingSummary())}" target="_blank" rel="noopener"><b>WhatsApp</b></a>.`
        : `Richiesta inviata! Ti rispondiamo entro <b>${rispostaEntro}</b>. ${depositNote} Per risposta immediata puoi anche scriverci su <a href="${waLink(bookingSummary())}" target="_blank" rel="noopener"><b>WhatsApp</b></a>.`;
      form.reset(); updateEstimate();
    } else {
      // 3) Fallback demo: apri WhatsApp precompilato (e link mailto)
      const wa = waLink(bookingSummary());
      msg.className = "form-msg ok";
      msg.innerHTML = currentLang === "en"
        ? `Open the pre-filled request on <a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp</b></a> or send it via <a href="mailto:${S.contatti?.email}?subject=${encodeURIComponent("Richiesta prenotazione " + S.casa?.nome)}&body=${encodeURIComponent(bookingSummary())}"><b>email</b></a>. ${depositNote}`
        : `Apri la richiesta precompilata su <a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp</b></a> oppure inviala via <a href="mailto:${S.contatti?.email}?subject=${encodeURIComponent("Richiesta prenotazione " + S.casa?.nome)}&body=${encodeURIComponent(bookingSummary())}"><b>email</b></a>. ${depositNote}`;
      window.open(wa, "_blank", "noopener");
    }
  }

  /* ── Lista d'attesa / last-minute ──────────────────────────────────── */
  async function submitWaitlist(e) {
    e.preventDefault();
    const form = e.target, msg = $("#waitMsg");
    const nome = $("#waitNome").value.trim(), email = $("#waitEmail").value.trim();
    // Se l'utente ha già scelto delle date nel form principale, le eredito.
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    let dal = $("#waitDal").value, al = $("#waitAl").value;
    if (!dal && isoRe.test($("#checkin")?.value || "")) dal = $("#checkin").value;
    if (!al && isoRe.test($("#checkout")?.value || "")) al = $("#checkout").value;

    if (!nome || !email) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en" ? "Enter name and email." : "Inserisci nome ed email.";
      return;
    }
    if (!$("#waitPrivacy")?.checked) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en" ? "Please accept the privacy policy." : "Devi accettare l'informativa privacy.";
      return;
    }
    if (dal && al && al <= dal) {
      msg.className = "form-msg err";
      msg.textContent = currentLang === "en" ? "The end date must be after the start date." : "La data 'Al' deve essere dopo 'Dal'.";
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; const prev = btn.textContent; btn.textContent = currentLang === "en" ? "Sending…" : "Invio in corso…";

    const payload = {
      nome, email, telefono: $("#waitTel").value.trim() || null,
      dal: dal || null, al: al || null,
      ospiti: $("#ospiti")?.value ? Number($("#ospiti").value) : null,
      creato: new Date().toISOString(),
    };

    let saved = false;
    const ig = S.integrazioni || {};
    try {
      if (ig.supabaseUrl && ig.supabaseAnonKey) {
        const r = await fetch(`${ig.supabaseUrl}/rest/v1/liste_attesa`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ig.supabaseAnonKey, Authorization: `Bearer ${ig.supabaseAnonKey}`, Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
        if (r.ok) saved = true;
      }
    } catch (_) { /* rete assente → fallback WhatsApp sotto */ }

    btn.disabled = false; btn.textContent = prev;

    if (saved) {
      msg.className = "form-msg ok";
      msg.textContent = currentLang === "en"
        ? "You're on the list! We'll write to you the moment those dates free up."
        : "Sei in lista! Ti scriviamo appena quelle date si liberano.";
      form.reset();
    } else {
      const periodo = dal && al ? ` dal ${dal} al ${al}` : "";
      const wa = waLink(`Salve, vorrei essere avvisato se si libera un periodo${periodo} a ${S.casa?.nome || "la casa"}. Nome: ${nome}`);
      msg.className = "form-msg ok";
      msg.innerHTML = currentLang === "en"
        ? `Send your request on <a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp</b></a> and we'll add you to the waitlist.`
        : `Inviaci la richiesta su <a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp</b></a> e ti mettiamo in lista d'attesa.`;
      window.open(wa, "_blank", "noopener");
    }
  }

  /* ── Lightbox ──────────────────────────────────────────────────────── */
  function initLightbox() {
    const lb = $("#lightbox"), img = $("#lbImg");
    if (!lb) return;
    let idx = 0; const items = S.galleria || [];
    const counter = $("#lbCount"), caption = $("#lbCaption");
    const show = (i) => {
      idx = (i + items.length) % items.length;
      img.src = photo(items[idx], 1800); img.alt = items[idx].alt || "";
      if (counter) counter.textContent = `${idx + 1} / ${items.length}`;
      if (caption) caption.textContent = "";
    };
    const open = (i) => { show(i); lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); };
    const close = () => { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); };
    document.addEventListener("click", (e) => {
      const fig = e.target.closest("[data-lb]");
      if (fig) open(+fig.getAttribute("data-lb"));
    });
    document.addEventListener("keydown", (e) => {
      const fig = e.target.closest?.("[data-lb]");
      if (fig && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(+fig.getAttribute("data-lb")); }
    });
    $("#lbClose").onclick = close;
    $("#lbPrev").onclick = () => show(idx - 1);
    $("#lbNext").onclick = () => show(idx + 1);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(idx + 1);
      if (e.key === "ArrowLeft") show(idx - 1);
    });
  }

  /* ── Menu mobile ───────────────────────────────────────────────────── */
  function initMenu() {
    const burger = $("#burger");
    if (!burger) return;
    const toggle = (open) => {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    };
    burger.addEventListener("click", () => toggle(!document.body.classList.contains("menu-open")));
    $$("#navLinks a").forEach((a) => a.addEventListener("click", () => toggle(false)));
  }

  /* ── Header scrolled ───────────────────────────────────────────────── */
  function initHeader() {
    const h = $("#header");
    const trustH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--trust-h")) || 40;
    const upd = () => {
      h.classList.toggle("lifted", window.scrollY > trustH);
      h.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.7);
    };
    upd(); window.addEventListener("scroll", upd, { passive: true });
  }

  /* ── Animazioni (GSAP + Lenis) ─────────────────────────────────────── */
  function initMotion() {
    if (reduce || !window.gsap) return;
    document.documentElement.classList.add("gsap-ready");
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // Lenis smooth scroll
    let lenis;
    if (window.Lenis) {
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
      lenis.on("scroll", () => window.ScrollTrigger && window.ScrollTrigger.update());
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      // ancore interne via Lenis
      $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length > 1) { const t = $(id); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -10 }); } }
      }));
    }

    // Hero entrance
    const heroTl = gsap.timeline({ defaults: { ease: "expo.out" } });
    const title = $("[data-hero-title]");
    if (title) {
      const words = title.textContent.trim().split(" ");
      title.innerHTML = words.map((w) => `<span style="display:inline-block;overflow:hidden;padding-bottom:.08em"><span class="hw" style="display:inline-block">${w}</span></span>`).join(" ");
      heroTl.from(".hw", { yPercent: 115, duration: 1.2, stagger: 0.08 }, 0.1);
    }
    heroTl.from("[data-hero-rise]", { y: 30, opacity: 0, duration: 1, stagger: 0.12 }, 0.5);

    // Ken Burns hero
    gsap.to("#heroImg", { scale: 1, duration: 2.4, ease: "power2.out" });
    if (window.ScrollTrigger) {
      gsap.to("#heroImg", { yPercent: 18, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });
    }

    if (!window.ScrollTrigger) return;
    const ST = window.ScrollTrigger;

    // Reveal generici
    $$("[data-reveal]").forEach((el) => {
      const mode = el.getAttribute("data-reveal");
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
      if (mode === "up") gsap.set(el, { y: 40 });
    });
    // Stagger nelle griglie
    [".amenities", ".spaces", ".seasons", ".reviews"].forEach((sel) => {
      const grid = $(sel); if (!grid) return;
      const kids = $$("[data-reveal]", grid);
      ST.create({
        trigger: grid, start: "top 82%",
        onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: .9, stagger: .08, ease: "power3.out" }),
      });
    });

    // Contatori
    $$("[data-count]").forEach((el) => {
      const end = parseFloat(el.textContent) || 0;
      const obj = { v: 0 };
      ST.create({
        trigger: el, start: "top 88%", once: true,
        onEnter: () => gsap.to(obj, { v: end, duration: 1.6, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.v); } }),
      });
    });

    // Galleria: griglia semplice (niente pin orizzontale, più intuitiva).
    // Le foto compaiono con un leggero reveal quando entrano nel viewport.
    $$("#galleryTrack .gallery__item").forEach((it, i) => {
      gsap.from(it, {
        y: 24, autoAlpha: 0, duration: .7, ease: "power2.out",
        scrollTrigger: { trigger: it, start: "top 92%" },
      });
    });

    // Titoli: reveal "a tendina" parola per parola
    $$(".section-head h2, .section-head .display, .final .display, .book-copy .display, .intro-copy .display").forEach((h) => {
      if (h.dataset.wm || /<br/i.test(h.innerHTML)) return;
      h.dataset.wm = "1";
      const words = h.textContent.trim().split(/\s+/);
      h.innerHTML = words.map((w) => `<span class="wm"><span class="wi">${w}</span></span>`).join(" ");
      gsap.from(h.querySelectorAll(".wi"), {
        yPercent: 120, duration: 1, ease: "expo.out", stagger: 0.06,
        scrollTrigger: { trigger: h, start: "top 90%" },
      });
    });

    // Immagini figura: scala d'ingresso + parallasse leggera
    $$(".intro-figure img").forEach((img) => {
      gsap.from(img, { scale: 1.26, duration: 1.6, ease: "power3.out",
        scrollTrigger: { trigger: img, start: "top 90%" } });
      gsap.to(img, { yPercent: -7, ease: "none",
        scrollTrigger: { trigger: img.closest(".intro-grid") || img, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Mappa: rivelo a tendina dal basso
    const zmap = $(".zona-map");
    if (zmap) gsap.fromTo(zmap, { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.out",
        scrollTrigger: { trigger: zmap, start: "top 86%" } });

    // Hero: parallasse leggera al mouse (2D, niente WebGL)
    const hImg = $("#heroImg");
    if (hImg && matchMedia("(pointer:fine)").matches) {
      window.addEventListener("pointermove", (e) => {
        gsap.to(hImg, {
          x: (e.clientX / window.innerWidth - 0.5) * -22,
          y: (e.clientY / window.innerHeight - 0.5) * -18,
          duration: 1, ease: "power2.out", overwrite: "auto",
        });
      }, { passive: true });
    }

    // Bottoni "magnetici"
    if (matchMedia("(pointer:fine)").matches) {
      $$(".btn").forEach((b) => {
        b.addEventListener("pointermove", (e) => {
          const r = b.getBoundingClientRect();
          gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.28, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.4, ease: "power2.out", overwrite: "auto" });
        });
        b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.45)" }));
      });
    }

    ST.refresh();
  }

  /* ── Init ──────────────────────────────────────────────────────────── */
  function init() {
    if (/[?&]static\b/.test(location.search)) document.documentElement.classList.add("cap-hero");
    applyTheme();
    renderTrustbar();
    renderGallery();
    renderAmenities();
    renderSpaces();
    renderServizi();
    renderZona();
    renderSeasons();
    renderReviews();
    fillGuests();
    bind();

    // form
    ["#checkin", "#checkout", "#ospiti"].forEach((s) => {
      const el = $(s); if (!el) return;
      el.addEventListener("change", updateEstimate);
      el.addEventListener("change", updateWhatsAppLinks);
    });
    updateWhatsAppLinks();
    const form = $("#bookForm"); if (form) form.addEventListener("submit", submitForm);
    const wform = $("#waitForm"); if (wform) wform.addEventListener("submit", submitWaitlist);
    loadAvailability().then(initDatePicker);

    const langBtn = $("#langToggle");
    if (langBtn) langBtn.addEventListener("click", () => applyLang(currentLang === "it" ? "en" : "it"));
    applyLang(currentLang);

    initLightbox();
    initMenu();
    initHeader();
    // breve attesa perché le altezze siano pronte (setTimeout scatta anche in tab
    // in background, dove requestAnimationFrame resta sospeso)
    setTimeout(initMotion, 80);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
