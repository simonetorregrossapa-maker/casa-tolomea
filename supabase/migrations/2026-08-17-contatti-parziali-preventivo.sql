-- ============================================================
-- Contatti parziali: preventivo catturato insieme all'email.
--
-- PERCHÉ: il popup promette all'ospite "ti rispondiamo con disponibilità e
-- prezzo", e l'email automatica (edge function recupero-abbandono) deve
-- mantenerla. La DISPONIBILITÀ la verifica il server nel momento in cui scrive
-- (fonte: edge function hyper-responder). Il PREZZO invece si cattura qui, nel
-- momento in cui l'ospite lascia l'email, perché il listino vive nel sito
-- (src/data.js → stagioni) e non nel database: così l'email cita esattamente
-- la cifra che quella persona ha visto, e non c'è modo che le due divergano.
--
-- Da eseguire nel SQL Editor di Supabase PRIMA di pubblicare il sito nuovo.
-- (Il sito è comunque scritto per non perdere il contatto se queste colonne
-- non esistono ancora: riprova l'inserimento senza di esse.)
-- ============================================================

alter table public.contatti_parziali
  add column if not exists totale numeric,   -- preventivo in euro per le notti indicate
  add column if not exists notti  int;       -- numero di notti (checkout - checkin)

comment on column public.contatti_parziali.totale is
  'Preventivo calcolato dal sito al momento della cattura, sulle fasce mensili allora pubblicate. Nullo se l''ospite non ha indicato le date.';
comment on column public.contatti_parziali.notti is
  'Notti fra checkin e checkout. Nullo se le date non ci sono.';

-- Verifica:
--   select id, origine, email, checkin, checkout, notti, totale, creato
--     from public.contatti_parziali order by creato desc limit 20;
