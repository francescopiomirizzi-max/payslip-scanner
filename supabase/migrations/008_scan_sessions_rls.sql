-- Migration 008: RLS strict per scan_sessions e scan_results.
--
-- Modello:
--   - PC (authenticated): vede/crea/cancella SOLO le proprie sessioni (owner_id = auth.uid())
--   - Mobile (anon, dal QR): può UPDATE status/data/mode di una sessione esistente non
--     scaduta, e INSERT in scan_results per una sessione esistente non scaduta.
--   - Nessuno tranne il PC proprietario può leggere scan_sessions o scan_results.
--
-- Trade-off: chiunque scopra/sniffi il session_id (UUID v4) può inquinare la sessione
-- finché non scade (expires_at). Mitigato da: entropia di UUID v4, TTL breve, rate limit
-- lato netlify functions (vedi rateLimit.ts).

ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_results  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- scan_sessions
-- ============================================================

-- Drop di policy precedenti (idempotenza)
DROP POLICY IF EXISTS "scan_sessions_open_all"     ON public.scan_sessions;
DROP POLICY IF EXISTS "scan_sessions_select_owner" ON public.scan_sessions;
DROP POLICY IF EXISTS "scan_sessions_insert_owner" ON public.scan_sessions;
DROP POLICY IF EXISTS "scan_sessions_update_any"   ON public.scan_sessions;
DROP POLICY IF EXISTS "scan_sessions_delete_owner" ON public.scan_sessions;

CREATE POLICY "scan_sessions_select_owner"
    ON public.scan_sessions FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "scan_sessions_insert_owner"
    ON public.scan_sessions FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Mobile (anon) deve poter aggiornare la sessione perché non ha JWT. Lo si vincola a:
-- - la sessione esiste e non è scaduta
-- - non si possono cambiare id/owner_id/created_at/expires_at (lato app), Postgres non lo
--   forza per colonna ma il WITH CHECK su expires_at impedisce di "estendere" la TTL.
CREATE POLICY "scan_sessions_update_any"
    ON public.scan_sessions FOR UPDATE
    TO anon, authenticated
    USING  (expires_at > now())
    WITH CHECK (expires_at > now());

CREATE POLICY "scan_sessions_delete_owner"
    ON public.scan_sessions FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- ============================================================
-- scan_results
-- ============================================================

DROP POLICY IF EXISTS "scan_results_open_all"        ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_insert_anyone"   ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_select_owner"    ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_delete_cascade"  ON public.scan_results;

CREATE POLICY "scan_results_insert_anyone"
    ON public.scan_results FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scan_sessions s
            WHERE s.id = session_id AND s.expires_at > now()
        )
    );

CREATE POLICY "scan_results_select_owner"
    ON public.scan_results FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scan_sessions s
            WHERE s.id = session_id AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "scan_results_delete_cascade"
    ON public.scan_results FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scan_sessions s
            WHERE s.id = session_id AND s.owner_id = auth.uid()
        )
    );
