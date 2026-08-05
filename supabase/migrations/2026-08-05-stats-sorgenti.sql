-- ============================================================
-- Casa Tolomea — Ripartizione visite per provenienza (sola lettura)
-- Incollare nel SQL Editor di Supabase (progetto wbooxigzhkjljkkroibn)
-- ed eseguire una sola volta.
--
-- Perché: stats_riepilogo() dice quante visite ci sono, non da dove
-- arrivano. Questa funzione risponde a "da dove viene il traffico"
-- (Google, Google Business, QR del biglietto Booking→diretto, OTA,
-- social, diretto...) così si può decidere su quale canale investire
-- senza indovinare.
--
-- Stesso pattern di stats_riepilogo/stats_visite_source già in uso
-- (vedi ~/setup-tolomea-stats.sql): SOLO conteggi aggregati, nessuna
-- riga della tabella `visite`, nessun dato personale. Le righe
-- source='selftest' restano escluse. Nessuna policy RLS toccata: il
-- SELECT diretto ad anon resta negato, questa RPC è l'unica porta.
--
-- La colonna `source` in tabella arriva già classificata dal tracciamento
-- lato client (pagine/traccia.js e l'equivalente nel bundle React):
-- diretto / interno / qr / google / google-gbp / booking / airbnb /
-- social / altri-motori / whatsapp / oppure il dominio grezzo del
-- referrer quando non riconosciuto. Qui si raggruppano quei valori in
-- poche categorie leggibili. Il dominio del referrer viene riportato
-- SOLO per il bucket "altro", per capire cosa c'è dentro senza
-- disperdere righe per le sorgenti già note.
-- ============================================================

create or replace function public.stats_sorgenti(days int default 30)
returns table(categoria text, referrer_dominio text, visite bigint)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      case lower(coalesce(source, ''))
        when 'diretto'      then 'diretto'
        when 'interno'      then 'interno'
        when 'qr'           then 'qr'
        when 'google'       then 'google'
        when 'google-gbp'   then 'google_business'
        when 'booking'      then 'booking'
        when 'airbnb'       then 'airbnb'
        when 'social'       then 'social'
        when 'whatsapp'     then 'whatsapp'
        when 'altri-motori' then 'altro'
        else 'altro'
      end as categoria,
      nullif(
        regexp_replace(lower(coalesce(referrer, '')), '^https?://(www\.)?([^/]+).*$', '\2'),
        ''
      ) as referrer_dominio
    from public.visite
    where created_at > now() - make_interval(days => days)
      and coalesce(source, '') <> 'selftest'
  )
  select
    categoria,
    case when categoria = 'altro' then referrer_dominio else null end as referrer_dominio,
    count(*)::bigint as visite
  from base
  group by 1, 2
  order by 3 desc;
$$;

-- Permessi: solo ESECUZIONE (non lettura tabella) alla chiave pubblica,
-- identico a come sono già concesse stats_riepilogo/stats_visite_*.
grant execute on function public.stats_sorgenti(int) to anon, authenticated;
