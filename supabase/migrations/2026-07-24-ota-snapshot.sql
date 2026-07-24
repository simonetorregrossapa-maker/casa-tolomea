-- Fix anti-doppia-prenotazione (24 lug 2026).
-- Snapshot dell'ultimo dato buono per ogni canale OTA (booking/airbnb/vrbo).
-- Se un feed iCal cade o risponde con una pagina non-iCal, hyper-responder
-- riusa questo snapshot invece di liberare le date già prenotate su quel canale.
-- La function lo popola/aggiorna da sola (service role) a ogni fetch riuscito.
-- Idempotente: si può rieseguire senza danni.

create table if not exists public.ota_snapshot (
  canale  text primary key,
  busy    jsonb not null default '[]'::jsonb,
  updated timestamptz not null default now()
);

-- RLS attiva SENZA policy: nessun accesso anon; solo la service role
-- (che bypassa RLS, ed è l'unica usata da hyper-responder) legge/scrive.
alter table public.ota_snapshot enable row level security;
