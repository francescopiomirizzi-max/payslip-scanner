-- Migration 014: persistenza di `coefficiente` e `tariffe_per_anno` su `pratiche_riposi`.
--
-- Contesto (area Turni & Riposi):
--  * coefficiente danno = fattore × sul valore del riposo perso. L'avvocato ha confermato
--    «quantificare le violazioni × 20%» → 0.20. Prima era solo in memoria (seed/runtime),
--    ora va persistito per applicarsi alle pratiche già in archivio.
--  * tariffe_per_anno = override €/h per anno (mappa 'YYYY'→€/h). Se NULL, il motore ricava
--    la curva dalla fonte (cresce per anzianità). Predisposto per la tabella CCNL futura.
--
-- Additivo e retrocompatibile: colonne nullable, nessun default che alteri i conteggi
-- (coefficiente NULL → il motore usa 1 = valore pieno; tariffe_per_anno NULL → deriva).

ALTER TABLE public.pratiche_riposi
    ADD COLUMN IF NOT EXISTS coefficiente      numeric,
    ADD COLUMN IF NOT EXISTS tariffe_per_anno  jsonb;
