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
      it: "Una casa indipendente al piano terra di una villa a Mondello, a 700 metri dalla spiaggia. " +
          "Due camere matrimoniali e un ampio soggiorno con divano letto matrimoniale: fino a 6 ospiti. Cucina attrezzata " +
          "e una grande veranda con giardino, patio e barbecue per stare all'aperto. Aria condizionata, " +
          "parcheggio gratuito e animali ammessi. Alessandro e Marcella abitano nella stessa villa e vi " +
          "accolgono di persona; davanti casa c'è una navetta che porta al mare.",
      en: "A detached ground-floor home in a villa in Mondello, 700 metres from the beach. Two double bedrooms " +
          "and a large living room with a double sofa bed: up to 6 guests. Fully equipped kitchen and a big veranda with " +
          "garden, patio and barbecue for outdoor living. Air conditioning, free parking and pets allowed. " +
          "Alessandro and Marcella live in the same villa and welcome you in person; a shuttle to the sea stops " +
          "right in front of the house.",
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
    { icon: "washer",   label: { it: "Lavatrice",             en: "Washing machine" } },
    { icon: "tv",       label: { it: "3 TV via cavo",          en: "3 cable TVs" } },
    { icon: "parking",  label: { it: "Parcheggio gratuito",   en: "Free parking" } },
    { icon: "pets",     label: { it: "Animali ammessi",       en: "Pets allowed" } },
    { icon: "garden",   label: { it: "Giardino e patio",      en: "Garden and patio" } },
    { icon: "bbq",      label: { it: "Barbecue",              en: "Barbecue" } },
    { icon: "heating",  label: { it: "Riscaldamento",         en: "Heating" } },
    { icon: "crib",     label: { it: "Culla su richiesta",    en: "Cot on request" } },
    { icon: "plane",    label: { it: "Navetta aeroportuale",  en: "Airport shuttle" } },
    { icon: "sea",      label: { it: "Spiaggia a 700 m",      en: "Beach 700 m away" } },
  ],

  /* ── SPAZI / CAMERE ────────────────────────────────────────────────── */
  spazi: [
    { nome: { it: "Camera matrimoniale", en: "Double bedroom" },
      descr: { it: "Letto matrimoniale, armadio e TV via cavo.", en: "Double bed, wardrobe and cable TV." } },
    { nome: { it: "Seconda camera", en: "Second bedroom" },
      descr: { it: "Letto matrimoniale, armadio e TV via cavo.", en: "Double bed, wardrobe and cable TV." } },
    { nome: { it: "Soggiorno", en: "Living room" },
      descr: { it: "Ampio e luminoso, con un divano letto matrimoniale e TV: qui dormono il 5° e 6° ospite.", en: "Bright and spacious, with a double sofa bed and TV: sleeps guests 5 and 6." } },
    { nome: { it: "Cucina", en: "Kitchen" },
      descr: { it: "Angolo cottura, forno, piano cottura, frigo e freezer, macchina da caffè, tostapane, tavolo e stoviglie complete.", en: "Kitchenette, oven, hob, fridge-freezer, coffee machine, toaster, dining table and full cookware." } },
    { nome: { it: "Bagno", en: "Bathroom" },
      descr: { it: "Doccia, bidet, WC, lavatrice, asciugacapelli e prodotti da bagno in omaggio.", en: "Shower, bidet, WC, washing machine, hairdryer and complimentary toiletries." } },
    { nome: { it: "Veranda, patio e giardino", en: "Veranda, patio and garden" },
      descr: { it: "Tavolo da pranzo all'aperto, barbecue e zona relax, con giardino indipendente.", en: "Outdoor dining table, barbecue and lounge area, with an independent garden." } },
  ],

  /* ── TUTTI I SERVIZI (lista completa, per categoria) ───────────────────
     Elenco integrale dei servizi/dotazioni (fonte: annuncio Booking). Mostrato
     nella sezione servizi come dettaglio esteso, così non manca nulla. */
  serviziCompleti: [
    { cat: { it: "Cucina", en: "Kitchen" },
      voci: { it: "Angolo cottura · Forno · Piano cottura · Frigorifero e freezer · Macchina da caffè · Bollitore · Tostapane · Utensili e stoviglie complete · Tavolo da pranzo · Prodotti per le pulizie",
              en: "Kitchenette · Oven · Hob · Fridge & freezer · Coffee machine · Kettle · Toaster · Full cookware & tableware · Dining table · Cleaning products" } },
    { cat: { it: "Camere e riposo", en: "Bedrooms & sleeping" },
      voci: { it: "2 camere matrimoniali · 1 divano letto matrimoniale in soggiorno (6 posti letto) · Biancheria da letto inclusa · Armadi e guardaroba · 3 TV via cavo · Presa elettrica vicino al letto",
              en: "2 double bedrooms · 1 double sofa bed in the living room (sleeps 6) · Bed linen provided · Wardrobes · 3 cable TVs · Power socket by the bed" } },
    { cat: { it: "Bagno", en: "Bathroom" },
      voci: { it: "Doccia · Bidet · WC · Asciugamani inclusi · Prodotti da bagno in omaggio · Asciugacapelli · Carta igienica",
              en: "Shower · Bidet · WC · Towels provided · Complimentary toiletries · Hairdryer · Toilet paper" } },
    { cat: { it: "Comfort", en: "Comfort" },
      voci: { it: "Aria condizionata · Riscaldamento · Lavatrice · Ferro da stiro · Stendibiancheria · Wi-Fi gratuito",
              en: "Air conditioning · Heating · Washing machine · Iron · Drying rack · Free Wi-Fi" } },
    { cat: { it: "Spazi all'aperto", en: "Outdoor" },
      voci: { it: "Giardino · Veranda · Patio · Zona pranzo all'aperto · Barbecue · Area picnic · Arredamento da esterni · Vista giardino e cortile",
              en: "Garden · Veranda · Patio · Outdoor dining area · Barbecue · Picnic area · Outdoor furniture · Garden & courtyard view" } },
    { cat: { it: "Accesso e famiglie", en: "Access & families" },
      voci: { it: "Ingresso indipendente · Intera unità al piano terra · Culla e lettino su richiesta (gratis) · Animali ammessi gratis · Accesso con chiavi",
              en: "Independent entrance · Entire unit on the ground floor · Cot & child bed on request (free) · Pets allowed free · Key access" } },
    { cat: { it: "Servizi", en: "Services" },
      voci: { it: "Navetta per il mare davanti casa · Transfer aeroporto su richiesta · Parcheggio gratuito lungo la via · Reception 24h e concierge · Deposito bagagli · Fattura su richiesta",
              en: "Beach shuttle in front of the house · Airport transfer on request · Free street parking · 24h reception & concierge · Luggage storage · Invoice on request" } },
    { cat: { it: "Buono a sapersi", en: "Good to know" },
      voci: { it: "Struttura interamente non fumatori · Lingue parlate: italiano e inglese · Host residenti che vi accolgono di persona",
              en: "Entirely non-smoking · Languages: Italian and English · Resident hosts who welcome you in person" } },
  ],

  /* ── ZONA / DINTORNI ───────────────────────────────────────────────── */
  zona: {
    intro: {
      it: "A Mondello, a 700 metri dalla spiaggia e a pochi chilometri dal centro di Palermo.",
      en: "In Mondello, 700 metres from the beach and a few kilometres from Palermo's city centre.",
    },
    // Distanze dall'annuncio Booking del cliente.
    punti: [
      { nome: { it: "Spiaggia di Mondello",      en: "Mondello Beach" },        distanza: "700 m",  icon: "sea" },
      { nome: { it: "Ristoranti e locali",       en: "Restaurants & cafés" },   distanza: "550 m",  icon: "cart" },
      { nome: { it: "Parco della Favorita",      en: "Favorita Park" },         distanza: "6 km",   icon: "garden" },
      { nome: { it: "Centro di Palermo",         en: "Palermo city centre" },   distanza: "20 min", icon: "town" },
      { nome: { it: "San Vito Lo Capo, Scopello", en: "San Vito Lo Capo, Scopello" }, distanza: "1 h", icon: "camera" },
      { nome: { it: "Aeroporto di Palermo",      en: "Palermo Airport" },       distanza: "21 km",  icon: "plane" },
    ],
  },

  /* ── INCENTIVO PRENOTAZIONE DIRETTA ────────────────────────────────── */
  // Vantaggio mostrato all'OSPITE (non al proprietario) per convincerlo a
  // prenotare diretto invece che da un portale. Prezzi indicativi €/notte
  // per lo stesso periodo, mostrati come confronto nel badge del form.
  incentivo: {
    percentuale:    21,    // % di risparmio dichiarato prenotando diretto (240 vs 306)
    prezzoPortale:  306,   // €/notte su Booking in alta stagione (dato reale annuncio)
    prezzoDiretto:  240,   // €/notte prenotando diretto in alta stagione (Lug–Ago)
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
    { nome: { it: "Bassa stagione", en: "Low season" },  periodo: { it: "Ott – Mar", en: "Oct – Mar" }, prezzoNotte: 150, minNotti: 2, dal: "10-01", al: "03-31" },
    { nome: { it: "Media stagione", en: "Mid season" },  periodo: { it: "Apr – Giu, Set", en: "Apr – Jun, Sep" }, prezzoNotte: 160, minNotti: 3, dal: "04-01", al: "06-30" },
    { nome: { it: "Alta stagione",  en: "High season" }, periodo: { it: "Lug – Ago", en: "Jul – Aug" }, prezzoNotte: 240, minNotti: 7, dal: "07-01", al: "08-31" },
  ],
  // Costi extra mostrati nella stima. Nessun costo aggiuntivo: pulizia finale e
  // tassa di soggiorno sono già incluse nel prezzo; nessuna cauzione.
  extra: {
    tassaSoggiorno: 4, // a persona a notte, GIÀ INCLUSA nel prezzo (mostrata solo come nota)
  },

  /* ── RECENSIONI ────────────────────────────────────────────────────── */
  // Recensioni reali (es. raccolte da ospiti precedenti o importate da Booking/Airbnb).
  // Vuoto finché non ci sono recensioni vere: la sezione si nasconde da sola
  // (vedi renderReviews in app.js). Riempire solo con recensioni reali di
  // ospiti reali (raccolte a mano o importate da Booking/Airbnb).
  recensioni: [
    { stelle: 5, nome: "Antonina", luogo: "Regno Unito",
      testo: "Spaziosa e con tutto il necessario per una vacanza al mare. Ma la cosa migliore sono i proprietari: Alessandro e Marcella hanno fatto di tutto per farci stare bene, ci hanno perfino organizzato due transfer per l'aeroporto. 7 minuti a piedi dalla spiaggia." },
    { stelle: 5, nome: "Fulvia", luogo: "Italia",
      testo: "Appartamento perfetto, in ottima posizione. Dotato di tutto il necessario, silenzioso e molto confortevole. I proprietari sono stati eccezionali: accoglienti e pronti a dare consigli utili sulla zona." },
    { stelle: 5, nome: "Luisella", luogo: "Italia",
      testo: "Marcella ed Alessandro molto gentili: ci hanno atteso in tarda serata accogliendoci con un cocktail di benvenuto. La casa è grande, comoda e in una posizione strategica ma molto tranquilla." },
    { stelle: 5, nome: "Salvador", luogo: "Italia",
      testo: "Struttura luminosa e confortevole. L'accoglienza è familiare, con uno stuzzichino di benvenuto e del buon vino. Il parcheggio è vicinissimo e la spiaggia poco distante. Consiglio vivamente." },
    { stelle: 5, nome: "Yulnawati", luogo: "Germania",
      testo: "Host gentilissimi: ci hanno perfino portato la cena! Ci hanno dato informazioni utili su cosa visitare e sul parcheggio. Posizione strategica, vicino alla spiaggia di Mondello e ai negozi." },
    { stelle: 5, nome: "Elena", luogo: "Italia",
      testo: "Casa bellissima e molto accogliente. Proprietari gentili e disponibili, posizione perfetta. Veranda e cortile ampi: stare seduti al sole di prima mattina è una carezza." },
  ],
  // Punteggio ospiti (sintesi Booking) mostrato accanto alle recensioni.
  recensioniRating: {
    voto: "9,3", max: 10, count: 60,
    etichetta: { it: "Eccellente", en: "Excellent" },
    categorie: [
      { n: { it: "Personale",       en: "Staff" },     v: "9,9" },
      { n: { it: "Posizione",       en: "Location" },  v: "9,7" },
      { n: { it: "Servizi",         en: "Facilities" }, v: "9,4" },
      { n: { it: "Pulizia",         en: "Cleanliness" }, v: "9,2" },
      { n: { it: "Qualità-prezzo",  en: "Value" },     v: "9,2" },
      { n: { it: "Comfort",         en: "Comfort" },   v: "9,1" },
    ],
  },
  // Link al profilo Booking del proprietario, per verificabilità delle recensioni.
  // Se vuoto, il link "Vedi tutte le recensioni su Booking" non viene mostrato.
  recensioniBookingUrl: "https://www.booking.com/hotel/it/casa-tolomea-palermo.it.html",

  /* ── ORARI SOGGIORNO ───────────────────────────────────────────────────
     Usati nella FAQ (e riutilizzabili nelle email). check-in reale = 16:00
     (come su Booking). check-out: valore standard, MODIFICALO se diverso. */
  soggiorno: {
    checkIn:  { it: "dalle 16:00", en: "from 4:00 PM" },
    checkOut: { it: "entro le 10:00", en: "by 10:00 AM" },
  },

  /* ── FAQ ───────────────────────────────────────────────────────────────
     Domande che, se restano senza risposta, rimandano l'ospite a prenotare
     sulla OTA "dove si sente protetto". Risposte basate sui dati REALI della
     casa (caparra, animali, parcheggio, transfer, servizi inclusi). Bilingue.
     Vengono anche pubblicate come structured data FAQPage (rich snippet su
     Google). Modifica/aggiungi voci liberamente: la sezione si popola da qui. */
  faq: [
    {
      q: { it: "Come funziona la prenotazione? Devo pagare online?",
           en: "How does booking work? Do I pay online?" },
      a: { it: "Nessun pagamento online. Ci invii la richiesta con le tue date dal sito e ti rispondiamo entro 24 ore. Alla conferma versi una caparra del 30% con bonifico; il saldo lo paghi comodamente all'arrivo. Semplice e diretto, senza intermediari.",
           en: "No online payment. You send us your dates through the site and we reply within 24 hours. On confirmation you pay a 30% deposit by bank transfer; the balance is paid on arrival. Simple and direct, with no middleman." },
    },
    {
      q: { it: "Perché conviene prenotare qui invece che su Booking?",
           en: "Why book here instead of on Booking?" },
      a: { it: "Perché prenotando diretto salti le commissioni del portale: paghi meno (fino a circa il 20% in meno rispetto a Booking) e parli direttamente con Alessandro e Marcella, che vivono nella stessa villa e ti accolgono di persona. Stessa casa, miglior prezzo, contatto umano immediato.",
           en: "Because booking direct skips the platform's commissions: you pay less (up to about 20% less than Booking) and you speak directly with Alessandro and Marcella, who live in the same villa and welcome you in person. Same house, best price, immediate human contact." },
    },
    {
      q: { it: "A che ora sono il check-in e il check-out?",
           en: "What are the check-in and check-out times?" },
      a: { it: "Check-in dalle 16:00, check-out entro le 10:00. Sono host residenti: se hai un aereo a orari scomodi scrivici, cerchiamo sempre di venirti incontro con l'arrivo e la partenza.",
           en: "Check-in from 4:00 PM, check-out by 10:00 AM. We're resident hosts: if your flight times are awkward just write to us — we always try to accommodate your arrival and departure." },
    },
    {
      q: { it: "Come arrivo alla casa e dove parcheggio?",
           en: "How do I get to the house and where do I park?" },
      a: { it: "La casa è a Mondello, a 700 m dalla spiaggia; davanti c'è la navetta che porta al mare. Il parcheggio lungo la via è gratuito. Dall'aeroporto di Palermo (21 km) puoi organizzare con noi un transfer privato a 50 € a tratta: lo prenoti insieme al soggiorno.",
           en: "The house is in Mondello, 700 m from the beach; the shuttle to the sea stops right in front. Street parking is free. From Palermo airport (21 km) we can arrange a private transfer at €50 each way: you book it together with your stay." },
    },
    {
      q: { it: "Sono ammessi gli animali?",
           en: "Are pets allowed?" },
      a: { it: "Sì, gli animali domestici sono i benvenuti, gratuitamente. Faccelo sapere nella richiesta così prepariamo tutto.",
           en: "Yes, pets are welcome, free of charge. Just let us know in your request so we can get everything ready." },
    },
    {
      q: { it: "La casa è adatta alle famiglie con bambini?",
           en: "Is the house suitable for families with children?" },
      a: { it: "Assolutamente. La casa ospita fino a 6 persone, è tutta al piano terra con ingresso indipendente, giardino e patio; culla e lettino per bambini sono gratuiti su richiesta. La spiaggia di Mondello, con acqua bassa e sabbia, è a pochi minuti.",
           en: "Absolutely. The house sleeps up to 6, it's all on the ground floor with an independent entrance, garden and patio; a cot and child bed are free on request. Mondello beach, with shallow water and sand, is a few minutes away." },
    },
    {
      q: { it: "Cosa è incluso nel prezzo? Ci sono costi nascosti o cauzione?",
           en: "What's included in the price? Any hidden costs or deposit?" },
      a: { it: "Il prezzo è tutto compreso: pulizia finale, tassa di soggiorno, biancheria e asciugamani, Wi-Fi e aria condizionata sono già inclusi. Nessun costo extra e nessuna cauzione da lasciare.",
           en: "The price is all-inclusive: final cleaning, tourist tax, bed linen and towels, Wi-Fi and air conditioning are all included. No extra fees and no security deposit to leave." },
    },
    {
      q: { it: "E se devo cancellare o cambiare le date?",
           en: "What if I need to cancel or change my dates?" },
      a: { it: "Trattando direttamente con noi siamo molto più flessibili di un portale: scrivici e troviamo una soluzione per spostare le date o gestire la cancellazione nel modo più giusto per te. Le condizioni te le confermiamo per iscritto alla prenotazione.",
           en: "Dealing directly with us, we're far more flexible than a platform: write to us and we'll find a way to move your dates or handle the cancellation in the fairest way for you. We confirm the terms in writing when you book." },
    },
  ],

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
