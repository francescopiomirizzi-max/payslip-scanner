-- 026: categoria per gli annunci di bacheca.
-- Consente una sezione dedicata "in evidenza" (es. 'buste_mancanti') distinta dalle
-- comunicazioni generiche. Colonna additiva e nullable: nessun impatto sui messaggi
-- esistenti (category = NULL = comunicazione generica). RLS invariata (SELECT aperto
-- agli autenticati, scrittura solo service role — migration 016/017).

alter table public.messages add column if not exists category text;

comment on column public.messages.category is
  'Categoria annuncio: NULL = comunicazione generica; ''buste_mancanti'' = sezione dedicata in evidenza.';
