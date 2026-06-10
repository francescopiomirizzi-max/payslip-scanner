-- Strategia B (assenze retribuite nel divisore) era una preferenza solo-localStorage:
-- il viewer readonly (sindacalista) non la vedeva mai e calcolava i distaccati in
-- Strategia A (~0). Persistita per-lavoratore come le altre preferenze di calcolo.
-- NULL = nessuna scelta esplicita → il client applica il default di profilo.
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS include_paid_leave boolean;
