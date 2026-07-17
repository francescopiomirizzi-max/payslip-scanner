-- Migration 027: ripristina il canale di stato del telefono anon (QR scanner).
--
-- BUG (scoperto 16/07/2026 durante la review Fase 2 mobile, provato empiricamente
-- sul DB live): in Postgres un UPDATE con WHERE legge le righe esistenti, quindi
-- le righe devono passare ANCHE una policy SELECT oltre alla USING della policy
-- UPDATE (documentazione di CREATE POLICY). anon non ha più alcuna policy SELECT
-- su scan_sessions dalla migration 012 (drop della policy permissiva legacy):
-- da allora gli UPDATE anon di status/progress/mode dal telefono toccano 0 righe
-- IN SILENZIO (PostgREST risponde 204, nessun errore). I payload arrivavano
-- comunque (INSERT su scan_results, policy con RPC is_active_scan_session), ma il
-- PC non riceveva processing/all_done/error dai telefoni non loggati. Un telefono
-- con la sessione dell'owner non era affetto (la SELECT owner-scoped passa) — per
-- questo il bug è rimasto invisibile.
--
-- FIX: policy SELECT per anon gated da is_active_scan_session(id) — stesso
-- pattern e stessa superficie di attacco della migration 010 su scan_results
-- (serve già conoscere il session id, TTL 2h, rate limit). In più il GRANT SELECT
-- di anon viene ristretto alle sole colonne necessarie: NIENTE owner_id, così un
-- session id sniffato non espone l'uuid del proprietario.

REVOKE SELECT ON public.scan_sessions FROM anon;
GRANT SELECT (id, status, data, mode, created_at, expires_at) ON public.scan_sessions TO anon;

DROP POLICY IF EXISTS "scan_sessions_anon_select_active" ON public.scan_sessions;
CREATE POLICY "scan_sessions_anon_select_active"
    ON public.scan_sessions FOR SELECT
    TO anon
    USING (public.is_active_scan_session(id));

-- Verifica post-migration (attesa: UPDATE anon su sessione viva = 1 riga):
--   BEGIN; SET LOCAL ROLE anon;
--   WITH u AS (UPDATE public.scan_sessions SET status = status
--              WHERE expires_at > now() RETURNING 1)
--   SELECT count(*) FROM u; ROLLBACK;
