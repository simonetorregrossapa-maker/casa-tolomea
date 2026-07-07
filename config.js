/* ============================================================================
   CONFIGURAZIONE CENTRALE — Casa Vacanze (template affitti brevi)
   ----------------------------------------------------------------------------
   Questo è L'UNICO file da modificare per ribrandizzare il sito su una nuova
   casa/cliente: nome, foto, prezzi, dotazioni, zona, contatti e integrazioni.
   Tutte le sezioni di index.html leggono da qui tramite window.SITE.
   ============================================================================ */

window.SITE = {

  /* ── LA CASA ───────────────────────────────────────────────────────── */
  casa: {
    nome:       "Casa Tolomea",
    // Testi bilingue: { it, en }. Le stringhe semplici restano valide (usate
    // identiche in entrambe le lingue) grazie all'helper t() in app.js.
    claim: {
      it: "Casa vacanze a Mondello, a 700 m dal mare",
      en: "Vacation home in Mondello, 700 m from the sea",
    },
    localita:   "Mondello",
    provincia:  "PA",
    regione:    "Sicilia",
    // Numeri mostrati come "chip" sotto il titolo (hero)
    ospiti:     6,
    camere:     2,
    bagni:      1,
    mq:         85,
    // Frase di benvenuto (sezione "La casa")
    intro: {
      it: "Una casa indipendente a Mondello, a 700 metri dalla spiaggia. Due camere da letto, " +
          "soggiorno, cucina attrezzata e una grande veranda con giardino e patio per stare all'aperto. " +
          "Aria condizionata, parcheggio gratuito e animali ammessi. Il posto giusto per una vacanza in Sicilia.",
      en: "A detached house in Mondello, 700 metres from the beach. Two bedrooms, a living room, " +
          "a fully equipped kitchen and a large veranda with garden and patio for outdoor living. " +
          "Air conditioning, free parking and pets allowed. The right place for a holiday in Sicily.",
    },
    cin:        "IT082053C2RJGS9XGX",   // Codice Identificativo Nazionale (obbligatorio dal 2024, va esposto)
    cir:        "19082053C226757",      // Codice Identificativo Regionale (Sicilia)
    // Coordinate GPS reali della casa (da Google Maps, annuncio "Casa Tolomea").
    geo:        { lat: 38.2067673, lng: 13.3184001 },
  },

  /* ── PROPRIETARIO / CONTATTI ───────────────────────────────────────── */
  contatti: {
    proprietario: "Alessandro Li Brizzi",
    telDisplay:   "+39 339 429 0856",
    telHref:      "+393394290856",
    whatsapp:     "393394290856",        // solo cifre, con prefisso internazionale
    email:        "casa.tolomea@tiscali.it",
    // Tempo di risposta dichiarato (mostrato vicino al form)
    rispostaEntro: { it: "24 ore", en: "24 hours" },
    // Mappa: query indirizzo (fallback) oppure URL embed diretto (pb=...)
    mapsQuery:    "Casa Tolomea, Mondello, Palermo",
    mapsEmbed:    "",
  },

  /* ── PAGAMENTO (caparra via bonifico, saldo all'arrivo) ────────────────
     Usato nell'email di conferma prenotazione. La caparra è un bonifico
     SEPA all'IBAN qui sotto; nessun pagamento online. */
  pagamento: {
    intestatario: "Alessandro Li Brizzi",
    iban:         "BE77 9058 0657 7942",
    bic:          "TRWIBEB1XXX",
    caparraPct:   30,   // % di caparra da versare con bonifico alla conferma
    tassaInclusa: true, // le tariffe includono già la tassa di soggiorno
    transferAeroporto: 50, // € a tratta, transfer da/per l'aeroporto di Palermo
  },

  /* ── TEMA (colori + font) ──────────────────────────────────────────── */
  // Palette mediterranea calda: sabbia/crema + terracotta + oliva. NIENTE oro.
  // I valori sono iniettati come CSS custom properties (--c-nome) da app.js.
  tema: {
    colori: {
      "bg":          "#faf6f0",   // sabbia chiarissima — sfondo principale
      "bg-2":        "#f3ece1",   // crema calda — sezioni alternate
      "surface":     "#ffffff",   // bianco — card
      "ink":         "#1f1d18",   // bruno quasi nero — testo (AA su bg)
      "muted":       "#6d685d",   // grigio caldo — testo tenue (AA su bg)
      "line":        "#e7dccd",   // sabbia — bordi e divisori
      "accent":      "#a8472f",   // terracotta profonda — CTA (testo bianco AA ~5:1)
      "accent-soft": "#c46a4d",   // terracotta chiara — decori/hover
      "accent-bg":   "#f6e7df",   // terracotta pallida — sfondi morbidi/badge
      "olive":       "#4d5340",   // oliva scura — accento secondario/sezioni scure
      "olive-soft":  "#7c8466",   // oliva tenue
    },
    fontTitoli: "'Playfair Display', Georgia, serif",
    fontTesto:  "'Karla', system-ui, sans-serif",
  },

  /* ── GALLERIA ──────────────────────────────────────────────────────── */
  // Foto reali. `u` = id foto Unsplash (https://images.unsplash.com/photo-<id>).
  // Sostituibili con foto reali della casa: usa /assets/galleria/*.webp e metti il
  // percorso in `src` al posto di `u`.
  // Tutte le foto reali della casa (dall'annuncio Booking del cliente).
  galleria: [
    { src: "assets/galleria/g01.webp", ar: "3/2", alt: "La veranda vista dall'ingresso ad arco" },
    { src: "assets/galleria/g02.webp", ar: "3/2", alt: "Veranda luminosa con tavolo da pranzo" },
    { src: "assets/galleria/g03.webp", ar: "3/2", alt: "Zona pranzo in veranda con divano" },
    { src: "assets/galleria/g04.webp", ar: "3/2", alt: "Soggiorno affacciato sulla veranda" },
    { src: "assets/galleria/g05.webp", ar: "3/2", alt: "Soggiorno con divano" },
    { src: "assets/galleria/g06.webp", ar: "3/2", alt: "Cucina attrezzata con forno e piano cottura" },
    { src: "assets/galleria/g07.webp", ar: "3/2", alt: "Camera matrimoniale con TV" },
    { src: "assets/galleria/g08.webp", ar: "3/2", alt: "Camera matrimoniale" },
    { src: "assets/galleria/g09.webp", ar: "3/2", alt: "Camera con armadio e TV" },
    { src: "assets/galleria/g10.webp", ar: "3/2", alt: "Camera da letto" },
    { src: "assets/galleria/g11.webp", ar: "3/2", alt: "Seconda camera matrimoniale" },
    { src: "assets/galleria/g12.webp", ar: "3/2", alt: "Seconda camera da letto" },
    { src: "assets/galleria/g13.webp", ar: "3/2", alt: "Bagno con doccia" },
    { src: "assets/galleria/g14.webp", ar: "3/2", alt: "Bagno con doccia e bidet" },
    { src: "assets/galleria/g15.webp", ar: "3/2", alt: "Terrazza con lettini e ombrellone" },
    { src: "assets/galleria/g16.webp", ar: "3/2", alt: "Angolo relax in terrazza" },
    { src: "assets/galleria/g17.webp", ar: "3/2", alt: "L'esterno della villa" },
    { src: "assets/galleria/g18.webp", ar: "3/2", alt: "L'ingresso e il cancello" },
    { src: "assets/galleria/g19.webp", ar: "3/2", alt: "La spiaggia di Mondello, a 700 m dalla casa" },
  ],

  /* ── DOTAZIONI / SERVIZI ───────────────────────────────────────────── */
  // `icon` = chiave icona SVG (vedi ICONS in app.js): wifi, ac, kitchen, parking,
  // washer, tv, pool, garden, pets, bbq, heating, crib, dishwasher, sea.
  dotazioni: [
    { icon: "wifi",     label: { it: "Wi-Fi gratuito",        en: "Free Wi-Fi" } },
    { icon: "ac",       label: { it: "Aria condizionata",     en: "Air conditioning" } },
    { icon: "kitchen",  label: { it: "Cucina attrezzata",     en: "Fully equipped kitchen" } },
    { icon: "tv",       label: { it: "TV",                    en: "TV" } },
    { icon: "parking",  label: { it: "Parcheggio gratuito",   en: "Free parking" } },
    { icon: "pets",     label: { it: "Animali ammessi",       en: "Pets allowed" } },
    { icon: "garden",   label: { it: "Giardino e patio",      en: "Garden and patio" } },
    { icon: "heating",  label: { it: "Riscaldamento",         en: "Heating" } },
    { icon: "plane",    label: { it: "Navetta aeroportuale",  en: "Airport shuttle" } },
    { icon: "sea",      label: { it: "Spiaggia a 700 m",      en: "Beach 700 m away" } },
  ],

  /* ── SPAZI / CAMERE ────────────────────────────────────────────────── */
  spazi: [
    { nome: { it: "Camera matrimoniale", en: "Double bedroom" },
      descr: { it: "Letto matrimoniale, armadio e TV.", en: "Double bed, wardrobe and TV." } },
    { nome: { it: "Seconda camera", en: "Second bedroom" },
      descr: { it: "Letto matrimoniale e armadio.", en: "Double bed and wardrobe." } },
    { nome: { it: "Soggiorno", en: "Living room" },
      descr: { it: "Divano e TV.", en: "Sofa and TV." } },
    { nome: { it: "Cucina", en: "Kitchen" },
      descr: { it: "Angolo cottura, forno, frigorifero e macchina da caffè.", en: "Hob, oven, fridge and coffee machine." } },
    { nome: { it: "Bagno", en: "Bathroom" },
      descr: { it: "Con doccia e bidet.", en: "With shower and bidet." } },
    { nome: { it: "Veranda e patio", en: "Veranda and patio" },
      descr: { it: "Tavolo da pranzo e zona relax all'aperto, con giardino.", en: "Outdoor dining table and lounge area, with garden." } },
  ],

  /* ── ZONA / DINTORNI ───────────────────────────────────────────────── */
  zona: {
    intro: {
      it: "A Mondello, a 700 metri dalla spiaggia e a pochi chilometri dal centro di Palermo.",
      en: "In Mondello, 700 metres from the beach and a few kilometres from Palermo's city centre.",
    },
    // Distanze dall'annuncio Booking del cliente.
    punti: [
      { nome: { it: "Spiaggia di Mondello",   en: "Mondello Beach" },       distanza: "700 m", icon: "sea" },
      { nome: { it: "Cattedrale di Palermo",  en: "Palermo Cathedral" },    distanza: "14 km", icon: "town" },
      { nome: { it: "Fontana Pretoria",       en: "Pretoria Fountain" },    distanza: "16 km", icon: "camera" },
      { nome: { it: "Aeroporto di Palermo",   en: "Palermo Airport" },      distanza: "21 km", icon: "plane" },
    ],
  },

  /* ── INCENTIVO PRENOTAZIONE DIRETTA ────────────────────────────────── */
  // Vantaggio mostrato all'OSPITE (non al proprietario) per convincerlo a
  // prenotare diretto invece che da un portale. Prezzi indicativi €/notte
  // per lo stesso periodo, mostrati come confronto nel badge del form.
  incentivo: {
    percentuale:    18,    // % di risparmio dichiarato prenotando diretto (250 vs 306)
    prezzoPortale:  306,   // €/notte su Booking in alta stagione (dato reale annuncio)
    prezzoDiretto:  250,   // €/notte prenotando diretto in alta stagione (Lug–Ago)
  },

  /* ── GESTIONE (solo pannello, non mostrato sul sito pubblico) ───────── */
  gestione: {
    // Provvigione applicata sulle prenotazioni dirette confermate, mostrata
    // nella tab "Incassi" del pannello (trasparenza col proprietario).
    provvigionePct: 10,
  },

  /* ── PREZZI PER STAGIONE ───────────────────────────────────────────── */
  // prezzoNotte in € (intera casa). minNotti = soggiorno minimo.
  // Il primo periodo che "contiene" il check-in determina la stima nel form.
  valuta: "€",
  stagioni: [
    { nome: { it: "Bassa stagione", en: "Low season" },  periodo: { it: "Ott – Mar", en: "Oct – Mar" }, prezzoNotte: 162, minNotti: 2, dal: "10-01", al: "03-31" },
    { nome: { it: "Media stagione", en: "Mid season" },  periodo: { it: "Apr – Giu, Set", en: "Apr – Jun, Sep" }, prezzoNotte: 172, minNotti: 3, dal: "04-01", al: "06-30" },
    { nome: { it: "Alta stagione",  en: "High season" }, periodo: { it: "Lug – Ago", en: "Jul – Aug" }, prezzoNotte: 250, minNotti: 7, dal: "07-01", al: "08-31" },
  ],
  // Costi extra mostrati nella stima
  extra: {
    pulizie:   60,   // una tantum
    tassaSoggiorno: 2, // a persona a notte (mostrata come nota, non sempre dovuta)
    cauzione:  200,  // mostrata come nota
  },

  /* ── RECENSIONI ────────────────────────────────────────────────────── */
  // Recensioni reali (es. raccolte da ospiti precedenti o importate da Booking/Airbnb).
  // Vuoto finché non ci sono recensioni vere: la sezione si nasconde da sola
  // (vedi renderReviews in app.js). Riempire solo con recensioni reali di
  // ospiti reali (raccolte a mano o importate da Booking/Airbnb).
  recensioni: [],
  // Link al profilo Booking del proprietario, per verificabilità delle recensioni.
  // Se vuoto, il link "Vedi tutte le recensioni su Booking" non viene mostrato.
  recensioniBookingUrl: "",

  /* ── INTEGRAZIONI (backend opzionale) ──────────────────────────────── */
  // Il sito funziona come demo navigabile anche senza queste chiavi:
  // la richiesta apre WhatsApp / email precompilata come fallback.
  integrazioni: {
    // Supabase: salva le richieste di prenotazione (tabella "richieste").
    supabaseUrl:     "https://wbooxigzhkjljkkroibn.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib294aWd6aGtqbGpra3JvaWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjIxNjYsImV4cCI6MjA5ODYzODE2Nn0.kIAXPhDIo2ZgEmtvkQDApi9ZPtt1s1e-6tg1CwaY9rE",
    // EmailJS: notifica al proprietario ad ogni richiesta (template scritto a
    // mano nella dashboard EmailJS, niente testo automatico in inglese).
    // Il template deve usare: {{nome}} {{email}} {{telefono}} {{note}}
    // {{checkin}} {{checkout}} {{ospiti}} {{totale}}. "To Email" è impostato
    // nel template stesso (l'email del proprietario), non passato da qui.
    emailjsProprietario: { serviceId: "service_hxsbg4d", templateId: "template_x22wouw", publicKey: "DxD0grIPLsew2VUP3" },
    // EmailJS: email di CONFERMA all'ospite (con IBAN per la caparra), inviata
    // dal pannello gestione quando il proprietario clicca "Conferma". Piano
    // gratuito = 2 template, quindi questo slot è dedicato alla conferma (non
    // all'auto-risposta d'invio, che è disattivata in app.js). Incolla il
    // contenuto di email-templates/3-ospite-prenotazione-confermata.html.
    // Variabili: {{to_name}} {{casa}} {{checkin}} {{checkout}} {{ospiti}}
    // {{totale_stimato}} {{caparra}}. "To Email" = {{to_email}}.
    emailjsOspite: { serviceId: "service_hxsbg4d", templateId: "template_0j880i1", publicKey: "DxD0grIPLsew2VUP3" },
  },

  /* ── SEO ───────────────────────────────────────────────────────────── */
  seo: {
    titolo: {
      it: "Casa Tolomea — Casa vacanze a Mondello",
      en: "Casa Tolomea — Vacation home in Mondello",
    },
    descrizione: {
      it: "Casa vacanze per 6 persone a Mondello, a 700 m dal mare. Prenota direttamente col proprietario: nessuna commissione, miglior prezzo.",
      en: "Vacation home for 6 guests in Mondello, 700 m from the sea. Book directly with the owner: no commission, best price.",
    },
    dominio:     "https://www.casatolomea.it",
  },
};
