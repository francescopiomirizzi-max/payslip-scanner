-- Migration 028: canale di stato del telefono via RPC whitelistata + hardening.
--
-- Sostituisce l'approccio della 027 (review Codex, 16/07/2026): una policy SELECT
-- anon con USING is_active_scan_session(id) è valutata PER RIGA e non prova che il
-- chiamante conosca l'id → rendeva enumerabili tutte le sessioni vive e, con la
-- UPDATE policy anon, alterabili in massa. Stesso difetto nella
-- scan_results_anon_select_active della 010: esponeva ad anon i payload (cedolini)
-- di TUTTE le sessioni attive. Qui si chiude tutto:
--
-- 1. Il telefono (anon) scrive status/progress/mode SOLO via touch_scan_session():
--    SECURITY DEFINER, p_id esplicito (serve conoscere l'id, nessuna enumerazione),
--    status e mode whitelistati, ritorna FOUND → fa anche da sentinella
--    sessione-viva in un'unica chiamata.
-- 2. Revocati SELECT e UPDATE diretti di anon su scan_sessions (la 008 lasciava
--    l'UPDATE blanket possibile; la lettura per-riga richiesta dall'UPDATE con
--    WHERE resta comunque soddisfatta SOLO dentro la RPC).
-- 3. La UPDATE policy resta per authenticated (il PC resetta a 'waiting'):
--    l'owner-scoping è garantito dalla regola di Postgres per cui l'UPDATE con
--    WHERE deve vedere le righe via SELECT policy (qui owner-scoped, 008).
-- 4. DROP di scan_results_anon_select_active (010): serviva al client v1
--    (return=representation); supabase-js v2 fa INSERT return=minimal.
--    scan_results resta: INSERT anon gated da is_active_scan_session, SELECT solo
--    owner authenticated.

-- 1) RPC whitelistata per il telefono
CREATE OR REPLACE FUNCTION public.touch_scan_session(
    p_id     TEXT,
    p_status TEXT,
    p_data   JSONB DEFAULT NULL,
    p_mode   TEXT  DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_status IS NULL OR p_status NOT IN ('processing', 'all_done', 'error') THEN
        RAISE EXCEPTION 'touch_scan_session: status non consentito';
    END IF;
    IF p_mode IS NOT NULL AND p_mode NOT IN ('ai', 'archive', 'onboarding') THEN
        RAISE EXCEPTION 'touch_scan_session: mode non consentito';
    END IF;

    UPDATE public.scan_sessions
       SET status = p_status,
           data   = p_data,
           mode   = COALESCE(p_mode, mode)
     WHERE id = p_id
       AND expires_at > now();

    RETURN FOUND;  -- false = sessione inesistente/scaduta/chiusa → il telefono lo sa subito
END;
$$;

REVOKE ALL ON FUNCTION public.touch_scan_session(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_scan_session(TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- 2) Rollback superficie 027 + chiusura scritture dirette anon
DROP POLICY IF EXISTS "scan_sessions_anon_select_active" ON public.scan_sessions;
REVOKE SELECT ON public.scan_sessions FROM anon;
REVOKE UPDATE ON public.scan_sessions FROM anon;

-- 3) UPDATE policy solo authenticated (per il PC); quals invariati rispetto alla 008
DROP POLICY IF EXISTS "scan_sessions_update_any" ON public.scan_sessions;
DROP POLICY IF EXISTS "scan_sessions_update_owner_visible" ON public.scan_sessions;
CREATE POLICY "scan_sessions_update_owner_visible"
    ON public.scan_sessions FOR UPDATE
    TO authenticated
    USING  (expires_at > now())
    WITH CHECK (expires_at > now());

-- 4) Chiusura enumerazione payload (superficie 010 non più necessaria con js v2)
DROP POLICY IF EXISTS "scan_results_anon_select_active" ON public.scan_results;
REVOKE SELECT ON public.scan_results FROM anon;

-- Verifiche post-migration attese (da client anon):
--   rpc touch_scan_session(id vivo, 'processing', ...)  -> true, riga aggiornata
--   rpc touch_scan_session(id morto, 'processing')      -> false
--   UPDATE/SELECT diretti su scan_sessions              -> 42501 permission denied
--   SELECT su scan_results                              -> 42501 permission denied
--   INSERT su scan_results (sessione viva)              -> ok
