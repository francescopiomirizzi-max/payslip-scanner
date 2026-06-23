-- 020: flag "buste paga da sistemare" sui lavoratori.
-- Audit mese/anno (file archiviato col nome di un periodo ma contenente un altro):
-- array di mesi da correggere, mostrato come badge rosso in UI e cella rossa in archivio.
-- NULL o [] = nessuna busta da sistemare. Si svuota quando l'utente sistema la busta.
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS fix_targets jsonb;

COMMENT ON COLUMN public.worker_profiles.fix_targets IS
  'Buste paga da sistemare: array di {year, monthIndex(0-11)} archiviate col file di un altro periodo. NULL/[] = nessuna.';
