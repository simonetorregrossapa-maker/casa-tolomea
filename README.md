# Casa Tolomea

Sito vetrina della casa vacanze (statico, GitHub Pages) con prenotazione diretta
e **sincronizzazione calendario a due vie con Booking.com** per evitare doppie
prenotazioni.

Per personalizzare i contenuti: modifica solo `config.js`.

---

## Come funziona la sincronizzazione con Booking

Due Edge Function Supabase tengono allineati i due calendari:

- **Booking → sito** (`disponibilita`): il form del sito legge da qui la fonte
  UNICA delle date occupate — unione di (1) prenotazioni Booking (feed iCal
  dell'extranet), (2) prenotazioni del sito confermate, (3) blocchi manuali del
  proprietario. Così l'ospite non può selezionare una data presa su nessuno dei
  canali, né una già confermata sul sito stesso.
- **Sito → Booking** (`site-availability-ical`): pubblica come feed iCal le
  prenotazioni del sito **confermate** e i **blocchi manuali**, che Booking
  importa e blocca.

(`booking-availability` resta disponibile e viene usata dal pannello per
mostrare, nel calendario, quali date arrivano *specificamente* da Booking.)

Una prenotazione dal sito blocca Booking **solo dopo che il proprietario la
conferma** dal pannello (`gestione.html` → bottone "Conferma"), cioè dopo aver
verificato la disponibilità e incassato la caparra. Le richieste non confermate
non occupano il calendario.

> ⚠️ La sincronizzazione iCal **non è in tempo reale**: Booking ricontrolla i
> calendari importati ogni poche ore. È lo stesso meccanismo usato tra Airbnb e
> Booking — per una singola casa il rischio residuo è minimo, ma esiste. Per
> zero rischio in tempo reale serve un channel manager a pagamento.

---

## Pannello di gestione (`gestione.html`)

Area riservata al proprietario, protetta da login (Supabase Auth). Contiene:

- **Richieste** — elenco delle prenotazioni dal sito con bottone **Conferma /
  Annulla conferma**. Confermare imposta `richieste.confermata = true`, che fa
  bloccare la data su Booking.
- **Calendario** — vista mese che unisce, in un colpo d'occhio, le date occupate
  su Booking, quelle confermate sul sito e i blocchi manuali (colori distinti).
- **Blocca date a mano** — dal calendario il proprietario può chiudere un
  periodo (uso personale, manutenzione, o per bloccare all'istante una data
  appena presa su Booking senza aspettare la sync). Il blocco vale sia sul sito
  sia su Booking (finisce nel feed iCal).

La pagina è `noindex` e gira in **modalità demo** (dati finti) finché Supabase
non è configurato in `config.js`, così è mostrabile anche senza backend.

---

## Setup una tantum (da fare una volta sola)

1. **Database** — nel SQL Editor di Supabase esegui `supabase/schema.sql`
   (crea le tabelle `richieste` e `blocchi`, la colonna `confermata` e le regole
   di accesso). Se le tabelle esistono già, basta rieseguire le righe `alter
   table … add column …`, `create table if not exists blocchi …` e le policy.
2. **Utente proprietario** — Supabase → Authentication → Add user: crea
   l'account (email + password) con cui il proprietario farà login al pannello.
3. **Deploy delle Edge Function:**
   ```
   supabase functions deploy disponibilita
   supabase functions deploy site-availability-ical
   supabase functions deploy booking-availability
   ```
4. **Secret per leggere Booking** — imposta l'URL iCal esportato dall'extranet
   Booking (Calendario → Sincronizza calendari → Esporta) come secret:
   ```
   supabase secrets set BOOKING_ICAL_URL="https://ical.booking.com/…"
   ```
   Il secret è a livello di progetto: lo usano sia `disponibilita` sia
   `booking-availability`. (`site-availability-ical` non richiede secret: usa le
   variabili `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` iniettate in automatico.)
5. **Import in Booking** — nell'extranet Booking, Calendario → Sincronizza
   calendari → Importa calendario, incolla l'URL pubblico della function:
   `https://<project-ref>.functions.supabase.co/site-availability-ical`
6. **Chiavi nel sito** — in `config.js → integrazioni` inserisci `supabaseUrl` e
   `supabaseAnonKey`.

Fatto tutto questo, l'unica operazione ricorrente è: quando arriva una richiesta,
il proprietario apre `gestione.html`, verifica, e clicca **Conferma**.

---

## Automazioni email (direct booking)

Tre Edge Function inviano email agli ospiti in automatico (server-side via
**Resend**), per aumentare le prenotazioni dirette e le recensioni:

| Function | Quando | A chi | Scopo |
|---|---|---|---|
| `promemoria` | cron giornaliero | ospiti con check-in tra N giorni | riduce no-show, upsell (transfer, arrivo anticipato) |
| `recensione` | cron giornaliero | ospiti dopo il check-out | più recensioni = ranking OTA + fiducia sul diretto |
| `riattivazione` | cron settimanale | ospiti "dormienti" senza prenotazioni future | win-back con sconto diretto |

I parametri (giorni, testi, mittente, link recensioni) stanno nella tabella
`settings` — modificabili senza toccare il codice.

### Setup automazioni (una tantum)
1. **Schema** — riesegui `supabase/schema.sql` nel SQL Editor (idempotente:
   aggiunge i flag `promemoria_inviato`/`recensione_inviata`, le tabelle
   `settings`, `riattivazioni`, `liste_attesa` e i valori di default).
2. **Resend** — crea un account su resend.com, genera una API key e impostala:
   ```
   supabase secrets set RESEND_API_KEY="re_..."
   ```
   Finché il dominio non è verificato su Resend, il mittente resta
   `onboarding@resend.dev` e Resend consegna **solo all'email dell'account**
   (utile per i test). Quando `casatolomea.it` è attivo: verifica il dominio su
   Resend e aggiorna `settings.email_mittente` a `info@casatolomea.it`.
3. **Deploy:**
   ```
   supabase functions deploy promemoria
   supabase functions deploy recensione
   supabase functions deploy riattivazione
   ```
   (tutte con Verify JWT OFF: sono innescate da cron, non dal pubblico.)
4. **Cron** (SQL Editor, richiede `pg_cron` + `pg_net` attivi):
   ```sql
   select cron.schedule('promemoria-casa','0 9 * * *',
     $$ select net.http_post(url:='https://<project-ref>.functions.supabase.co/promemoria',
        headers:='{"Content-Type":"application/json"}'::jsonb) $$);
   select cron.schedule('recensione-casa','30 10 * * *',
     $$ select net.http_post(url:='https://<project-ref>.functions.supabase.co/recensione',
        headers:='{"Content-Type":"application/json"}'::jsonb) $$);
   select cron.schedule('winback-casa','0 10 * * 1',
     $$ select net.http_post(url:='https://<project-ref>.functions.supabase.co/riattivazione',
        headers:='{"Content-Type":"application/json"}'::jsonb) $$);
   ```
5. **Link recensioni** — imposta `settings.recensioni_url` con il link Google/Booking
   dove far lasciare la recensione (se vuoto, l'email invita a rispondere).

### Sincronizzazione multi-canale (Booking + Airbnb + VRBO)
La function `disponibilita` legge già i tre feed OTA. Imposta i secret:
```
supabase secrets set BOOKING_ICAL_URL="https://ical.booking.com/…"
supabase secrets set AIRBNB_ICAL_URL="https://www.airbnb.it/calendar/ical/…"
supabase secrets set VRBO_ICAL_URL="https://www.vrbo.com/icalendar/…"
```
Poi incolla l'URL di `site-availability-ical` nell'import calendario di **tutti e
tre** gli OTA. Consigliato: fai importare a ogni OTA anche i feed export degli
altri due (Booking↔Airbnb↔VRBO), così il sync OTA-OTA non dipende solo dal sito.

## Pannello — tab "Incassi"
`gestione.html` ha una terza tab **Incassi**: prenotazioni dirette confermate,
notti vendute, incassato stimato e **provvigione** (default 10%, in
`config.js → gestione.provvigionePct`), più il valore delle richieste ancora da
confermare (pipeline).
