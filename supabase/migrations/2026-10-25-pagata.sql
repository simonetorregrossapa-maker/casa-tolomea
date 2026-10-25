-- 25 ott 2026: le date si bloccano solo a pagamento ricevuto.
-- `confermata` = Alessandro ha verificato la disponibilità e mandato l'IBAN.
-- `pagata`     = caparra incassata. SOLO le righe pagate bloccano il calendario
--                (sito, feed iCal verso Booking/Airbnb, pannello).
alter table public.richieste add column if not exists pagata boolean not null default false;
alter table public.richieste add column if not exists pagata_il timestamptz;
alter table public.richieste drop constraint if exists richieste_pagata_implica_confermata;
alter table public.richieste add constraint richieste_pagata_implica_confermata check (not pagata or confermata);
-- Storico: i soggiorni già conclusi risultano pagati (sono stati svolti).
update public.richieste set pagata = true, pagata_il = coalesce(pagata_il, now())
  where confermata and checkout < current_date and not pagata;
