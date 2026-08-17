-- ============================================================
-- Casa Tolomea — Recupero abbandono: cattura PROGRESSIVA del contatto
-- Incollare nel SQL Editor di Supabase (progetto wbooxigzhkjljkkroibn)
-- ed eseguire UNA volta, tutto insieme.
--
-- PERCHÉ: oggi chi entra sul sito, guarda le date e NON completa la
-- richiesta di prenotazione resta uno sconosciuto (limite #4 dichiarato
-- nell'inventario dell'offerta). Questa tabella raccoglie l'email (perno
-- del follow-up automatico via Resend) non appena l'utente la scrive,
-- PRIMA del submit finale, da tre punti del sito:
--   • "prenota"      → form di prenotazione, campo email, salvataggio
--                       progressivo su blur/debounce (src/App.jsx BookForm)
--   • "lista_attesa" → widget "avvisami se si libera" (src/App.jsx Waitlist)
--   • "popup"        → popup exit-intent (desktop) / permanenza (mobile)
--
-- Il telefono, se già scritto nello stesso form, viene allegato come dato
-- in più utile ad Alessandro, ma NON aziona nulla da solo: senza email non
-- esiste automazione possibile con l'infrastruttura Resend attuale (niente
-- WhatsApp Business API ad oggi). Vedi supabase/functions/recupero-abbandono.
--
-- PRIVACY: dichiarato all'utente con una riga di testo accanto al campo
-- email (chiave i18n "contattoParziale"/"popup.hint") e nell'informativa
-- privacy (public/privacy.html) — niente di silenzioso. Stesso principio
-- delle altre tabelle: la chiave pubblica del sito può SOLO inserire.
-- ============================================================

create table if not exists public.contatti_parziali (
  id                 bigint generated always as identity primary key,
  origine            text not null,   -- 'prenota' | 'lista_attesa' | 'popup'
  email              text not null,
  telefono           text,            -- opzionale, se già scritto insieme all'email
  nome               text,
  checkin            date,
  checkout           date,
  ospiti             int,
  creato             timestamptz not null default now(),
  -- Anti-doppio-invio del follow-up automatico (edge function
  -- recupero-abbandono, che gira su cron come promemoria/riattivazione).
  followup_inviato   boolean not null default false
);

create index if not exists contatti_parziali_creato_idx   on public.contatti_parziali (creato);
create index if not exists contatti_parziali_email_idx    on public.contatti_parziali (email);
create index if not exists contatti_parziali_followup_idx on public.contatti_parziali (followup_inviato) where followup_inviato = false;

alter table public.contatti_parziali enable row level security;

-- Il sito pubblico può SOLO inserire righe (mai leggerle): stesso principio
-- di richieste/liste_attesa. La lettura resta riservata al proprietario
-- autenticato o alla service role (edge function, bypassa RLS).
drop policy if exists "contatti_parziali_insert_pubblico" on public.contatti_parziali;
create policy "contatti_parziali_insert_pubblico" on public.contatti_parziali
  for insert to anon with check (true);

drop policy if exists "contatti_parziali_titolare_all" on public.contatti_parziali;
create policy "contatti_parziali_titolare_all" on public.contatti_parziali
  for all to authenticated using (true) with check (true);

-- ============================================================
-- VERIFICA (facoltativa, da lanciare dopo)
--   select id, origine, email, telefono, checkin, checkout, creato, followup_inviato
--   from public.contatti_parziali order by creato desc limit 20;
-- ============================================================
