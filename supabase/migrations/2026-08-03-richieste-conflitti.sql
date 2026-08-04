-- ═══════════════════════════════════════════════════════════════════════
-- RICHIESTE SOVRAPPOSTE — rete di sicurezza lato database (3 ago 2026)
--
-- Contesto: una richiesta in attesa non occupa la data (voluto: una richiesta
-- spam non deve bloccare il calendario). Conseguenza: due ospiti possono
-- chiedere le stesse date, e finora NIENTE impediva di confermarle entrambe →
-- due email con IBAN per lo stesso soggiorno. Questi vincoli lo rendono
-- impossibile anche se si sbaglia dal pannello o dalla dashboard Supabase.
--
-- Sicuro da eseguire: al 3/08/2026 la tabella è vuota (0 righe), quindi i
-- vincoli si applicano senza dover sistemare dati storici.
-- Esegui nel SQL Editor di Supabase (Database → SQL Editor).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Stato "rifiutata": chiude la richiesta persa e fa partire l'email di
--    scuse (Edge Function "rifiuta"). Serve perché prima esisteva solo il
--    booleano `confermata`: la richiesta esclusa restava "Da confermare" per
--    sempre e l'ospite non riceveva nulla, pur avendogli promesso una
--    risposta entro 24 ore.
alter table public.richieste
  add column if not exists rifiutata boolean not null default false;
alter table public.richieste
  add column if not exists rifiutata_il timestamptz;

-- Una richiesta non può essere insieme confermata e rifiutata.
alter table public.richieste
  drop constraint if exists richieste_stato_coerente;
alter table public.richieste
  add constraint richieste_stato_coerente
  check (not (confermata and rifiutata));

-- 2. Date coerenti. Oltre a essere giusto in sé, serve al vincolo 3:
--    daterange() va in errore se il limite inferiore supera il superiore.
alter table public.richieste
  drop constraint if exists richieste_date_valide;
alter table public.richieste
  add constraint richieste_date_valide
  check (checkin is null or checkout is null or checkout > checkin);

-- 3. IL VINCOLO CHIAVE: due soggiorni CONFERMATI non possono sovrapporsi.
--    '[)' = check-out escluso, stessa convenzione di tutto il resto del
--    sistema (chi parte il 10 non è in conflitto con chi arriva il 10).
--    Il predicato WHERE limita il vincolo alle sole righe confermate: le
--    richieste in attesa restano libere di sovrapporsi quanto vogliono.
alter table public.richieste
  drop constraint if exists richieste_no_overlap_confermate;
alter table public.richieste
  add constraint richieste_no_overlap_confermate
  exclude using gist (daterange(checkin, checkout, '[)') with &&)
  where (confermata and checkin is not null and checkout is not null);

-- 4. Webhook: l'email di scuse parte quando `rifiutata` passa a true.
--    La funzione trigger si genera COPIANDO quella già collaudata di
--    "conferma" e cambiando solo l'URL: così il secret x-webhook-secret non
--    va riscritto a mano da nessuna parte (resta solo dentro il database).
do $genera$
declare src text;
begin
  select prosrc into src from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'notifica_conferma' and n.nspname = 'public';
  if src is null then
    raise exception 'notifica_conferma non trovata: crea il webhook di "rifiuta" a mano dal dashboard';
  end if;
  src := replace(src, '/conferma', '/rifiuta');
  execute format(
    'create or replace function public.notifica_rifiuto() returns trigger language plpgsql security definer as %L', src);
end
$genera$;

drop trigger if exists rifiuto_email on public.richieste;
create trigger rifiuto_email
  after update on public.richieste
  for each row
  when (old.rifiutata is distinct from true and new.rifiutata is true)
  execute function public.notifica_rifiuto();

-- ── Verifica (facoltativa): deve fallire con "conflicting key value" ────
-- insert into public.richieste (casa,checkin,checkout,nome,email,confermata)
--   values ('Casa Tolomea','2027-08-10','2027-08-15','Test A','a@x.it',true);
-- insert into public.richieste (casa,checkin,checkout,nome,email,confermata)
--   values ('Casa Tolomea','2027-08-12','2027-08-18','Test B','b@x.it',true);
-- delete from public.richieste where nome in ('Test A','Test B');
