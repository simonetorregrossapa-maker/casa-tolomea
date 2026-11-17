-- ═══════════════════════════════════════════════════════════════════════
-- CAPARRA PAGATA — stato del pagamento della caparra (19 ott 2026)
--
-- Contesto: finora la caparra si versava solo con bonifico e nel database non
-- c'era modo di sapere se era arrivata. Ora l'ospite può pagarla anche con
-- carta (Stripe Checkout, Edge Function "paga-caparra"); quando Stripe
-- conferma il pagamento, la Edge Function "stripe-webhook" segna la riga come
-- pagata. Per i bonifici la segna il proprietario dal pannello, col bottone
-- "Bonifico ricevuto".
--
-- Da eseguire nel SQL Editor di Supabase PRIMA di pubblicare il pannello e di
-- fare il deploy delle Edge Function. (Il pannello è comunque scritto per
-- funzionare anche se queste colonne non esistono ancora.)
-- ═══════════════════════════════════════════════════════════════════════

alter table public.richieste
  add column if not exists caparra_pagata    boolean not null default false,
  add column if not exists caparra_pagata_il timestamptz,
  add column if not exists caparra_metodo    text,
  add column if not exists caparra_importo   numeric,
  add column if not exists stripe_session_id text;

alter table public.richieste
  drop constraint if exists richieste_caparra_metodo_valido;
alter table public.richieste
  add constraint richieste_caparra_metodo_valido
  check (caparra_metodo is null or caparra_metodo in ('bonifico', 'carta'));

comment on column public.richieste.caparra_pagata is
  'true quando la caparra è arrivata: con carta lo segna stripe-webhook, con bonifico il proprietario dal pannello.';
comment on column public.richieste.caparra_metodo is
  '''carta'' (Stripe) oppure ''bonifico''. Nullo finché la caparra non è pagata.';
comment on column public.richieste.caparra_importo is
  'Importo in euro effettivamente incassato come caparra.';
comment on column public.richieste.stripe_session_id is
  'Id della sessione Stripe Checkout che ha pagato la caparra (per ritrovarla nella dashboard Stripe).';

-- Verifica:
--   select id, nome, checkin, confermata, caparra_pagata, caparra_metodo,
--          caparra_importo, caparra_pagata_il
--     from public.richieste order by checkin desc limit 20;
