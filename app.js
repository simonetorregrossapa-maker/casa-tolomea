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
  function bind() {
    const map = {
      brand: S.casa?.nome,
      claim: S.casa?.claim,
      intro: S.casa?.intro,
      ospiti: S.casa?.ospiti,
      camere: S.casa?.camere,
      bagni: S.casa?.bagni,
      mq: S.casa?.mq,
      cir: S.casa?.cir,
      rispostaEntro: S.contatti?.rispostaEntro,
      zonaIntro: S.zona?.intro,
      localitaFull: `${S.casa?.localita} (${S.casa?.provincia}), ${S.casa?.regione}`,
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
    $$("[data-whatsapp]").forEach((el) => { el.href = waLink(); el.target = "_blank"; el.rel = "noopener"; });
    document.title = S.seo?.titolo || document.title;
    const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }

  /* ── Render sezioni ────────────────────────────────────────────────── */
  function renderTrustbar() {
    const items = [
      [svg("check"), "Senza commissioni"],
      [svg("key"),   "Prenotazione diretta"],
      [svg("sea"),   "A 1,5 km dal mare"],
      [svg("check"), "Miglior prezzo garantito"],
      [svg("garden"),"Giardino e terrazza"],
      [svg("key"),   "Contatto col proprietario"],
    ];
    const one = items.map(([i, t]) => `<span>${i}${t}</span>`).join("");
    const el = $("#trustTrack"); if (el) el.innerHTML = one + one; // duplicato per loop
  }

  function renderGallery() {
    const track = $("#galleryTrack"); if (!track) return;
    track.innerHTML = (S.galleria || []).map((g, i) => `
      <figure class="gallery__item" style="aspect-ratio:${g.ar || "3/2"}" data-lb="${i}">
        <img src="${photo(g, 1400)}" alt="${g.alt || ""}" loading="${i < 2 ? "eager" : "lazy"}">
        <figcaption>${g.alt || ""}</figcaption>
      </figure>`).join("");
  }

  function renderAmenities() {
    const el = $("#amenitiesGrid"); if (!el) return;
    el.innerHTML = (S.dotazioni || []).map((d) =>
      `<div class="amenity" data-reveal="up">${svg(d.icon)}<span>${d.label}</span></div>`).join("");
  }

  function renderSpaces() {
    const el = $("#spacesGrid"); if (!el) return;
    el.innerHTML = (S.spazi || []).map((s, i) =>
      `<div class="space" data-reveal="up"><span class="idx num">0${i + 1}</span><b>${s.nome}</b><p>${s.descr}</p></div>`).join("");
  }

  function renderZona() {
    const el = $("#zonaList"); if (el) {
      el.innerHTML = (S.zona?.punti || []).map((p) =>
        `<div class="zona-row">${svg(p.icon)}<span class="name">${p.nome}</span><span class="dist num">${p.distanza}</span></div>`).join("");
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
    el.innerHTML = (S.stagioni || []).map((s) => `
      <div class="season ${s.prezzoNotte === max ? "is-high" : ""}" data-reveal="up">
        <div class="s-name">${s.nome}</div>
        <div class="s-period">${s.periodo}</div>
        <div class="s-price">${cur}${s.prezzoNotte}<small> / notte</small></div>
        <div class="s-min">Soggiorno minimo ${s.minNotti} notti</div>
      </div>`).join("");
    const note = $("#priceNote");
    if (note && S.extra) {
      note.textContent = `Pulizia finale ${cur}${S.extra.pulizie} una tantum · Cauzione ${cur}${S.extra.cauzione} (restituita) · Tassa di soggiorno ${cur}${S.extra.tassaSoggiorno}/persona a notte ove prevista.`;
    }
  }

  function renderReviews() {
    const el = $("#reviewsGrid"); if (!el) return;
    el.innerHTML = (S.recensioni || []).map((r) => `
      <article class="review" data-reveal="up">
        <div class="stars" aria-label="${r.stelle} su 5">${star.repeat(r.stelle)}</div>
        <p>“${r.testo}”</p>
        <div class="who">${r.nome}<small>${r.luogo}</small></div>
      </article>`).join("");
  }

  function fillGuests() {
    const sel = $("#ospiti"); if (!sel) return;
    const max = S.casa?.ospiti || 6;
    sel.innerHTML = Array.from({ length: max }, (_, i) =>
      `<option value="${i + 1}">${i + 1} ospite${i ? "i" : ""}</option>`).join("");
    sel.value = Math.min(2, max);
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

  function updateEstimate() {
    const box = $("#estimate");
    const ci = $("#checkin").value, co = $("#checkout").value;
    if (!ci || !co) { box.className = "estimate empty"; box.textContent = "Inserisci le date per vedere il preventivo."; return null; }
    const a = new Date(ci), b = new Date(co);
    const n = nightsBetween(a, b);
    if (n <= 0) { box.className = "estimate empty"; box.textContent = "Il check-out deve essere dopo il check-in."; return null; }
    const st = seasonFor(a);
    const nightly = st.prezzoNotte;
    const subtotal = nightly * n;
    const pulizie = S.extra?.pulizie || 0;
    const total = subtotal + pulizie;
    let warn = "";
    if (st.minNotti && n < st.minNotti) warn = `<div class="est-row" style="color:var(--c-accent)">Soggiorno minimo ${st.minNotti} notti in ${st.nome.toLowerCase()}</div>`;
    box.className = "estimate";
    box.innerHTML = `
      <div class="est-row"><span>${st.nome} · ${cur}${nightly} × ${n} nott${n === 1 ? "e" : "i"}</span><span>${cur}${subtotal}</span></div>
      <div class="est-row"><span>Pulizia finale</span><span>${cur}${pulizie}</span></div>
      ${warn}
      <div class="est-total"><span>Totale stimato</span><b>${cur}${total}</b></div>`;
    return { n, st, total, nightly };
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
      msg.className = "form-msg err"; msg.textContent = "Compila date, nome ed email per inviare la richiesta.";
      return;
    }
    const est = updateEstimate();
    if (est && est.st.minNotti && est.n < est.st.minNotti) {
      msg.className = "form-msg err"; msg.textContent = `In ${est.st.nome.toLowerCase()} il soggiorno minimo è di ${est.st.minNotti} notti.`;
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; const prev = btn.textContent; btn.textContent = "Invio in corso…";

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
      // 2) Web3Forms (notifica email al proprietario)
      if (ig.web3formsKey) {
        const r = await fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: ig.web3formsKey, subject: `Nuova richiesta — ${S.casa?.nome}`, ...payload }),
        });
        if (r.ok) saved = true;
      }
    } catch (_) { /* rete assente → fallback sotto */ }

    btn.disabled = false; btn.textContent = prev;

    if (saved) {
      msg.className = "form-msg ok";
      msg.innerHTML = `Richiesta inviata! Ti rispondiamo entro <b>${S.contatti?.rispostaEntro || "24 ore"}</b>. Per risposta immediata puoi anche scriverci su <a href="${waLink(bookingSummary())}" target="_blank" rel="noopener"><b>WhatsApp</b></a>.`;
      form.reset(); updateEstimate();
    } else {
      // 3) Fallback demo: apri WhatsApp precompilato (e link mailto)
      const wa = waLink(bookingSummary());
      msg.className = "form-msg ok";
      msg.innerHTML = `Apri la richiesta precompilata su <a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp</b></a> oppure inviala via <a href="mailto:${S.contatti?.email}?subject=${encodeURIComponent("Richiesta prenotazione " + S.casa?.nome)}&body=${encodeURIComponent(bookingSummary())}"><b>email</b></a>.`;
      window.open(wa, "_blank", "noopener");
    }
  }

  /* ── Lightbox ──────────────────────────────────────────────────────── */
  function initLightbox() {
    const lb = $("#lightbox"), img = $("#lbImg");
    if (!lb) return;
    let idx = 0; const items = S.galleria || [];
    const show = (i) => { idx = (i + items.length) % items.length; img.src = photo(items[idx], 1800); img.alt = items[idx].alt || ""; };
    const open = (i) => { show(i); lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); };
    const close = () => { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); };
    document.addEventListener("click", (e) => {
      const fig = e.target.closest("[data-lb]");
      if (fig) open(+fig.getAttribute("data-lb"));
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

    // Galleria orizzontale (pin + scrub)
    const track = $("#galleryTrack"), vp = $("#galleryViewport");
    if (track && vp && window.innerWidth > 760) {
      const getX = () => track.scrollWidth - vp.clientWidth + parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gutter") || 40);
      gsap.to(track, {
        x: () => -getX(), ease: "none",
        scrollTrigger: {
          trigger: "#galleria", start: "top top", end: () => "+=" + getX(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
    }

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
    renderZona();
    renderSeasons();
    renderReviews();
    fillGuests();
    bind();

    // form
    ["#checkin", "#checkout", "#ospiti"].forEach((s) => { const el = $(s); if (el) el.addEventListener("change", updateEstimate); });
    const ci = $("#checkin"); if (ci) ci.min = new Date().toISOString().split("T")[0];
    const form = $("#bookForm"); if (form) form.addEventListener("submit", submitForm);

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
