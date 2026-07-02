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
    nome:       "Casa Li Brizzi",
    claim:      "Casa vacanze tra gli ulivi, a due passi dal mare",
    localita:   "Castellammare del Golfo",
    provincia:  "TP",
    regione:    "Sicilia",
    // Numeri mostrati come "chip" sotto il titolo (hero)
    ospiti:     6,
    camere:     3,
    bagni:      2,
    mq:         110,
    // Frase di benvenuto (sezione "La casa")
    intro:      "Una casa di famiglia ristrutturata con cura, immersa nel verde e affacciata sul golfo. " +
                "Spazi luminosi, una grande terrazza per le cene d'estate e la spiaggia raggiungibile in pochi minuti. " +
                "Il posto giusto per una vacanza lenta, in Sicilia.",
    cir:        "TP-00000-LOC-00000",   // Codice Identificativo Regionale (obbligatorio in molte regioni)
  },

  /* ── PROPRIETARIO / CONTATTI ───────────────────────────────────────── */
  contatti: {
    proprietario: "Famiglia Rossi",
    telDisplay:   "+39 333 123 4567",
    telHref:      "+393331234567",
    whatsapp:     "393331234567",        // solo cifre, con prefisso internazionale
    email:        "info@casalibrizzi.it",
    // Tempo di risposta dichiarato (mostrato vicino al form)
    rispostaEntro: "24 ore",
    // Mappa: query indirizzo (fallback) oppure URL embed diretto (pb=...)
    mapsQuery:    "Castellammare del Golfo, TP",
    mapsEmbed:    "",
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
  // Sostituibili con foto reali della casa: usa /assets/galleria/*.jpg e metti il
  // percorso in `src` al posto di `u`.
  galleria: [
    { src: "assets/galleria/hero.jpg",              ar: "16/10", alt: "La villa tra gli ulivi al tramonto" },
    { src: "assets/galleria/soggiorno.jpg",         ar: "4/3",   alt: "Soggiorno luminoso" },
    { src: "assets/galleria/esterno-dettaglio.jpg", ar: "4/3",   alt: "Facciata in pietra con bouganville" },
    { src: "assets/galleria/cucina.jpg",            ar: "4/3",   alt: "Cucina con ceramiche siciliane" },
    { src: "assets/galleria/cucina-dettaglio.jpg",  ar: "4/3",   alt: "Dettaglio della cucina" },
    { src: "assets/galleria/camera.jpg",            ar: "4/3",   alt: "Camera matrimoniale" },
    { src: "assets/galleria/terrazza.jpg",          ar: "16/10", alt: "Terrazza con vista sul golfo" },
    { src: "assets/galleria/terrazza-dettaglio.jpg",ar: "16/10", alt: "La tavola in terrazza al tramonto" },
  ],

  /* ── DOTAZIONI / SERVIZI ───────────────────────────────────────────── */
  // `icon` = chiave icona SVG (vedi ICONS in app.js): wifi, ac, kitchen, parking,
  // washer, tv, pool, garden, pets, bbq, heating, crib, dishwasher, sea.
  dotazioni: [
    { icon: "wifi",       label: "Wi-Fi gratuito" },
    { icon: "ac",         label: "Aria condizionata" },
    { icon: "kitchen",    label: "Cucina attrezzata" },
    { icon: "parking",    label: "Parcheggio privato" },
    { icon: "washer",     label: "Lavatrice" },
    { icon: "dishwasher", label: "Lavastoviglie" },
    { icon: "tv",         label: "Smart TV" },
    { icon: "garden",     label: "Giardino e terrazza" },
    { icon: "bbq",        label: "Barbecue" },
    { icon: "heating",    label: "Riscaldamento" },
    { icon: "crib",       label: "Culla su richiesta" },
    { icon: "sea",        label: "Spiaggia a 1,5 km" },
  ],

  /* ── SPAZI / CAMERE ────────────────────────────────────────────────── */
  spazi: [
    { nome: "Camera matrimoniale", descr: "Letto king size, armadio e affaccio sul giardino." },
    { nome: "Camera doppia",       descr: "Due letti singoli (unibili), ideale per ragazzi." },
    { nome: "Cameretta",           descr: "Letto singolo più letto a castello." },
    { nome: "Soggiorno",           descr: "Divano-letto, angolo lettura e Smart TV." },
    { nome: "Cucina",              descr: "Forno, lavastoviglie, macchina del caffè e tutto il necessario." },
    { nome: "Terrazza",            descr: "Tavolo da pranzo per 8, barbecue e zona relax." },
  ],

  /* ── ZONA / DINTORNI ───────────────────────────────────────────────── */
  zona: {
    intro: "Tra mare e collina, con la Riserva dello Zingaro e i borghi del golfo a portata di mano.",
    punti: [
      { nome: "Spiaggia della Playa",      distanza: "1,5 km", icon: "sea" },
      { nome: "Centro storico e porto",    distanza: "3 km",   icon: "town" },
      { nome: "Riserva dello Zingaro",     distanza: "12 km",  icon: "garden" },
      { nome: "Scopello e Tonnara",        distanza: "10 km",  icon: "camera" },
      { nome: "Supermercato",              distanza: "800 m",  icon: "cart" },
      { nome: "Aeroporto di Palermo",      distanza: "55 km",  icon: "plane" },
    ],
  },

  /* ── PREZZI PER STAGIONE ───────────────────────────────────────────── */
  // prezzoNotte in € (intera casa). minNotti = soggiorno minimo.
  // Il primo periodo che "contiene" il check-in determina la stima nel form.
  valuta: "€",
  stagioni: [
    { nome: "Bassa stagione",  periodo: "Ott – Mar", prezzoNotte: 90,  minNotti: 2, dal: "10-01", al: "03-31" },
    { nome: "Media stagione",  periodo: "Apr – Giu, Set", prezzoNotte: 130, minNotti: 3, dal: "04-01", al: "06-30" },
    { nome: "Alta stagione",   periodo: "Lug – Ago", prezzoNotte: 180, minNotti: 7, dal: "07-01", al: "08-31" },
  ],
  // Costi extra mostrati nella stima
  extra: {
    pulizie:   60,   // una tantum
    tassaSoggiorno: 2, // a persona a notte (mostrata come nota, non sempre dovuta)
    cauzione:  200,  // mostrata come nota
  },

  /* ── RECENSIONI ────────────────────────────────────────────────────── */
  // Recensioni reali (es. raccolte da ospiti precedenti o importate da Booking/Airbnb).
  recensioni: [
    { nome: "Giulia & Marco", luogo: "Milano",  stelle: 5, testo: "Casa bellissima e curata, la terrazza al tramonto è un sogno. Proprietari gentilissimi e disponibili." },
    { nome: "Famiglia Bauer", luogo: "Monaco",  stelle: 5, testo: "Perfetta per la famiglia: spaziosa, pulita e a pochi minuti dal mare. Torneremo sicuramente." },
    { nome: "Chiara",         luogo: "Torino",  stelle: 5, testo: "Posizione strategica per girare il golfo. Prenotare direttamente è stato comodo e conveniente." },
  ],

  /* ── INTEGRAZIONI (backend opzionale) ──────────────────────────────── */
  // Il sito funziona come demo navigabile anche senza queste chiavi:
  // la richiesta apre WhatsApp / email precompilata come fallback.
  integrazioni: {
    // Supabase: salva le richieste di prenotazione (tabella "richieste").
    supabaseUrl:     "",
    supabaseAnonKey: "",
    // Web3Forms: notifica via email al proprietario (access key gratuita).
    web3formsKey:    "",
    // EmailJS: email di conferma all'ospite (opzionale).
    emailjs: { serviceId: "", templateId: "", publicKey: "" },
  },

  /* ── SEO ───────────────────────────────────────────────────────────── */
  seo: {
    titolo:      "Casa Li Brizzi — Casa vacanze a Castellammare del Golfo",
    descrizione: "Casa vacanze per 6 persone tra gli ulivi, a 1,5 km dal mare. Prenota direttamente col proprietario: nessuna commissione, miglior prezzo.",
    dominio:     "https://www.casalibrizzi.it",
  },
};
