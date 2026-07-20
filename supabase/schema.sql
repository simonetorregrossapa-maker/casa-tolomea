-- Tabella per le richieste di prenotazione inviate dal form del sito.
-- Esegui questo script nel SQL Editor di Supabase (Database → SQL Editor).

create table if not exists public.richieste (
  id bigint generated always as identity primary key,
  casa text,
  checkin date,
  checkout date,
  ospiti int,
  nome text,
  email text,
  telefono text,
  note text,
  totale_stimato numeric,
  creato timestamptz default now(),
  -- true solo dopo che il proprietario ha verificato la disponibilità e
  -- incassato la caparra: solo le righe confermate bloccano le date su
  -- Booking (vedi supabase/functions/site-availability-ical), così una
  -- richiesta spam o non ancora verificata non blocca il calendario.
  confermata boolean not null default false
);

alter table public.richieste enable row level security;

-- Il form pubblico può SOLO inserire righe (mai leggerle): la lettura
-- resta riservata al proprietario tramite la dashboard Supabase o un
-- accesso autenticato. Senza questa policy l'insert dal sito fallirebbe.
create policy "richieste_insert_pubblico" on public.richieste
  for insert
  to anon
  with check (true);

-- Il proprietario, una volta autenticato via Supabase Auth (login dal
-- pannello gestione.html), può LEGGERE e AGGIORNARE le richieste — serve per
-- vedere l'elenco e premere "Conferma" (che imposta confermata = true). Il
-- pubblico (anon) resta limitato al solo insert: non legge dati degli ospiti.
drop policy if exists "richieste_select_titolare" on public.richieste;
create policy "richieste_select_titolare" on public.richieste
  for select
  to authenticated
  using (true);

drop policy if exists "richieste_update_titolare" on public.richieste;
create policy "richieste_update_titolare" on public.richieste
  for update
  to authenticated
  using (true)
  with check (true);

-- Migrazione: se la tabella esisteva già senza questa colonna (es. sito
-- del cliente già in produzione), esegui solo questa riga nel SQL Editor.
alter table public.richieste add column if not exists confermata boolean not null default false;


-- ════════════════════════════════════════════════════════════════════════
-- BLOCCHI MANUALI — date chiuse a mano dal proprietario dal pannello
-- gestione.html (manutenzione, uso personale, oppure per bloccare all'istante
-- una data appena prenotata su Booking senza aspettare la sync automatica).
-- "al" è il giorno di check-out ESCLUSIVO, stessa convenzione di richieste e
-- del feed iCal: le notti bloccate sono [dal, al).
-- Questi blocchi vengono sia mostrati sul sito (date non selezionabili) sia
-- inseriti nel feed iCal verso Booking, così valgono su entrambi i canali.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.blocchi (
  id bigint generated always as identity primary key,
  dal date not null,
  al date not null,
  motivo text,
  creato timestamptz default now()
);

alter table public.blocchi enable row level security;

-- Solo il proprietario autenticato gestisce i blocchi (crea/legge/cancella).
-- Il pubblico NON accede a questa tabella: le date bloccate arrivano al sito
-- già aggregate tramite la Edge Function "disponibilita" (service role).
drop policy if exists "blocchi_titolare_all" on public.blocchi;
create policy "blocchi_titolare_all" on public.blocchi
  for all
  to authenticated
  using (true)
  with check (true);


-- ════════════════════════════════════════════════════════════════════════
-- AUTOMAZIONI EMAIL (promemoria pre-check-in, richiesta recensione, win-back)
-- Aggiunte per il direct booking. Idempotente: si può rieseguire senza danni.
-- Le email agli ospiti partono da Edge Function server-side (Resend), su cron.
-- ════════════════════════════════════════════════════════════════════════

-- Flag anti-doppio-invio sulle prenotazioni confermate.
alter table public.richieste add column if not exists promemoria_inviato boolean not null default false;        -- promemoria della vigilia (1 giorno prima)
alter table public.richieste add column if not exists promemoria_arrivo_inviato boolean not null default false; -- promemoria dell'arrivo (giorno stesso, ~3h prima)
alter table public.richieste add column if not exists recensione_inviata boolean not null default false;

-- Parametri regolabili senza toccare il codice (chiave/valore).
create table if not exists public.settings (
  chiave text primary key,
  valore text
);
alter table public.settings enable row level security;
-- Solo il proprietario autenticato legge/scrive i settings dal pannello.
drop policy if exists "settings_titolare_all" on public.settings;
create policy "settings_titolare_all" on public.settings
  for all to authenticated using (true) with check (true);
-- Le Edge Function leggono i settings con la service role (bypassa RLS).

-- Valori di default (non sovrascrive quelli già presenti).
insert into public.settings (chiave, valore) values
  ('nome_casa',            'Casa Tolomea'),
  ('email_mittente',       'onboarding@resend.dev'),   -- finché il dominio non è verificato su Resend
  ('email_titolare',       'casa.tolomea@tiscali.it'),
  ('site_url',             'https://www.casatolomea.it'),
  ('telefono',             '+39 339 429 0856'),
  ('giorni_promemoria',    '3'),    -- (non più usato: i promemoria sono a giorno fisso, vigilia + arrivo)
  ('giorni_recensione',    '1'),    -- giorni DOPO il check-out per la richiesta recensione (email la sera dopo)
  ('recensioni_url',       ''),     -- link dove lasciare la recensione (Google/Booking)
  ('incentivo_pct',        '10'),   -- sconto prenotazione diretta (win-back)
  ('giorni_dormiente',     '300'),  -- un ospite è "dormiente" dopo N giorni dall'ultimo soggiorno
  ('cooldown_riattivazione','180')  -- non ricontattare lo stesso ospite prima di N giorni
on conflict (chiave) do nothing;

-- Log dei win-back inviati: evita di ricontattare lo stesso ospite troppo spesso.
create table if not exists public.riattivazioni (
  id bigint generated always as identity primary key,
  email text not null,
  inviato timestamptz default now()
);
alter table public.riattivazioni enable row level security;
drop policy if exists "riattivazioni_titolare_all" on public.riattivazioni;
create policy "riattivazioni_titolare_all" on public.riattivazioni
  for all to authenticated using (true) with check (true);

-- Lista d'attesa / last-minute: chi vuole essere avvisato se si libera un periodo.
create table if not exists public.liste_attesa (
  id bigint generated always as identity primary key,
  nome text,
  email text,
  telefono text,
  dal date,
  al date,
  ospiti int,
  avvisato boolean not null default false,
  creato timestamptz default now()
);
alter table public.liste_attesa enable row level security;
-- Il pubblico può SOLO iscriversi (insert); la lettura resta al proprietario.
drop policy if exists "liste_attesa_insert_pubblico" on public.liste_attesa;
create policy "liste_attesa_insert_pubblico" on public.liste_attesa
  for insert to anon with check (true);
drop policy if exists "liste_attesa_titolare_all" on public.liste_attesa;
create policy "liste_attesa_titolare_all" on public.liste_attesa
  for all to authenticated using (true) with check (true);
