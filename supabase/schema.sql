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
