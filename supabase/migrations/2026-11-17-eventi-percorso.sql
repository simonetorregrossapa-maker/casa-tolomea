-- ============================================================
-- Casa Tolomea — Percorso dei visitatori sulla pagina
-- Incollare nel SQL Editor di Supabase (progetto wbooxigzhkjljkkroibn)
-- ed eseguire una sola volta. Si può rieseguire senza danni.
--
-- Perché: `visite` dice quante persone entrano e da dove, `richieste`
-- quante scrivono. In mezzo non si vedeva niente: 200 visite al mese e
-- 0 richieste senza sapere dove si fermano. Questa tabella registra i
-- passi (sezioni viste, calendario aperto, date scelte, form iniziato,
-- errori all'invio, uscita) e le funzioni stats_* li contano.
--
-- Privacy: nessun cookie e niente salvato sul dispositivo. `visita` è un
-- numero casuale che vive solo in memoria finché la pagina è aperta
-- (ricaricando ne nasce uno nuovo). Nessun nome, email, IP o data scelta
-- dalla persona: solo il nome del passo e un dettaglio corto.
--
-- Stesso schema di `visite` / `eventi_contatto`: la chiave pubblica può
-- solo INSERIRE; leggere si fa solo dalle funzioni stats_* che
-- restituiscono conteggi aggregati.
-- ============================================================

create table if not exists public.eventi_percorso (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visita     uuid not null,
  passo      text not null check (char_length(passo) between 1 and 40),
  dettaglio  text check (char_length(dettaglio) <= 80),
  source     text check (char_length(source) <= 60),
  device     text check (device in ('mobile', 'desktop')),
  lang       text check (char_length(lang) <= 5)
);

comment on table public.eventi_percorso is
  'Passi dei visitatori su casatolomea.it (sezioni viste, calendario, form, uscita). Nessun dato personale. Scritta dal sito con la chiave anon, letta solo dalle funzioni stats_percorso*.';

create index if not exists eventi_percorso_created_at_idx on public.eventi_percorso (created_at);

alter table public.eventi_percorso enable row level security;

drop policy if exists "anon inserisce eventi percorso" on public.eventi_percorso;
create policy "anon inserisce eventi percorso"
  on public.eventi_percorso for insert
  to anon, authenticated
  with check (true);

-- Solo INSERT alla chiave pubblica: niente select/update/delete.
revoke all on public.eventi_percorso from anon, authenticated;
grant insert on public.eventi_percorso to anon, authenticated;

-- ------------------------------------------------------------
-- 1) Il percorso: per ogni passo, quante visite (distinte) ci arrivano.
--    `dettaglio` è riportato solo per i passi dove dice qualcosa
--    (errori, avvisi, lingua, domande FAQ, foto); per gli altri è null
--    e i conteggi si sommano.
-- ------------------------------------------------------------
create or replace function public.stats_percorso(days int default 30)
returns table(passo text, dettaglio text, visite bigint)
language sql stable security definer set search_path = public as $$
  select
    e.passo,
    case when e.passo in ('invio_errore', 'avviso', 'lingua', 'faq_aperta', 'invio_fallito',
                          'ritorno', 'richiesta_da', 'contatto_da')
         then e.dettaglio end as dettaglio,
    count(distinct e.visita)::bigint as visite
  from public.eventi_percorso e
  where e.created_at > now() - make_interval(days => days)
    and coalesce(e.source, '') <> 'selftest'
  group by 1, 2
  order by 3 desc, 1;
$$;

-- ------------------------------------------------------------
-- 2) Quanto restano e quanto scendono, per mobile e desktop.
--    L'evento `uscita` porta "s=<secondi>;scroll=<percentuale>".
-- ------------------------------------------------------------
create or replace function public.stats_permanenza(days int default 30)
returns table(device text, visite bigint, secondi_mediana int, scroll_mediana int, sotto_10s bigint)
language sql stable security definer set search_path = public as $$
  with u as (
    select distinct on (e.visita)
      e.device,
      nullif(substring(e.dettaglio from 's=(\d+)'), '')::int      as secondi,
      nullif(substring(e.dettaglio from 'scroll=(\d+)'), '')::int as scroll
    from public.eventi_percorso e
    where e.passo = 'uscita'
      and e.created_at > now() - make_interval(days => days)
      and coalesce(e.source, '') <> 'selftest'
    order by e.visita, e.created_at desc
  )
  select
    coalesce(u.device, 'n/d'),
    count(*)::bigint,
    (percentile_cont(0.5) within group (order by u.secondi))::int,
    (percentile_cont(0.5) within group (order by u.scroll))::int,
    count(*) filter (where u.secondi < 10)::bigint
  from u
  group by 1
  order by 2 desc;
$$;

grant execute on function public.stats_percorso(int)   to anon, authenticated;
grant execute on function public.stats_permanenza(int) to anon, authenticated;
