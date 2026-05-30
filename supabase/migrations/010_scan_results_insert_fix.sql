-- Migration 010: fix INSERT scan_results da anon.
--
-- BUG 1: la policy scan_results_insert_anyone (migration 008) usava una subquery
-- EXISTS su scan_sessions, ma le subquery in RLS vengono valutate SOTTO la RLS
-- dell'utente corrente. Per anon, scan_sessions_select_owner richiede
-- owner_id = auth.uid() (null per anon) → la subquery tornava 0 righe → INSERT
-- bloccata silenziosamente con 42501. Il telefono mostrava "Errore fascicolo X"
-- ma il PC non riceveva nulla.
--
-- FIX 1: una funzione SECURITY DEFINER (LANGUAGE plpgsql, NON sql — le SQL
-- functions vengono inlinate da Postgres ignorando SECURITY DEFINER) che fa la
-- SELECT col privilegio del definer (postgres ha BYPASSRLS). Ritorna solo un
-- boolean, niente esposizione di righe.
--
-- BUG 2: anche col fix 1, la INSERT da PostgREST con `Prefer: return=representation`
-- (default del Supabase JS client v1, e usato per .insert(...).select()) faceva
-- una SELECT post-INSERT sulla riga inserita, che ricadeva sulla policy
-- scan_results_select_owner (authenticated-only) → 42501.
--
-- FIX 2: policy SELECT per anon vincolata a is_active_scan_session(session_id).
-- Stessa superficie di attacco della INSERT/UPDATE (serve già conoscere il
-- session_id).

CREATE OR REPLACE FUNCTION public.is_active_scan_session(p_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.scan_sessions
    WHERE id = p_id AND expires_at > now()
  ) INTO v_ok;
  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_scan_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_scan_session(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "scan_results_insert_anyone" ON public.scan_results;
CREATE POLICY "scan_results_insert_anyone"
    ON public.scan_results FOR INSERT
    TO anon, authenticated
    WITH CHECK (public.is_active_scan_session(session_id));

DROP POLICY IF EXISTS "scan_results_anon_select_active" ON public.scan_results;
CREATE POLICY "scan_results_anon_select_active"
    ON public.scan_results FOR SELECT
    TO anon
    USING (public.is_active_scan_session(session_id));
