-- Migration 007: scan_sessions + scan_results (Realtime + outbox + TTL).
--
-- Contesto: il flusso QR-code (PC mostra QR, telefono uppa la busta paga) prima girava
-- su polling Supabase ogni 400ms e su un array JSONB cumulativo che il telefono
-- riscriveva intero ad ogni upload. Lento, costoso, soggetto a race condition e a
-- saturazione della riga per batch grandi. Questa migration prepara il terreno per:
--   1) Realtime push (channel su scan_sessions e scan_results) — niente più polling.
--   2) Outbox: 1 riga per file in scan_results, niente più array che cresce.
--   3) TTL (expires_at) per il cleanup opportunistico delle sessioni morte.
--   4) Colonne mode/owner_id per gli step successivi (switch coerente + sicurezza).
--
-- NOTA TIPI: scan_sessions.id è TEXT (legacy), non UUID. scan_results.session_id deve
-- combaciare → TEXT.

-- ============================================================
-- 1. scan_sessions (estende la tabella esistente, oppure la crea se manca)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scan_sessions (
    id          TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'waiting',
    data        JSONB
);

ALTER TABLE public.scan_sessions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.scan_sessions
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours');

-- mode: lo decide il telefono al primo upload (Step 4). Valori previsti: 'ai' | 'archive' | 'onboarding'.
ALTER TABLE public.scan_sessions
    ADD COLUMN IF NOT EXISTS mode TEXT;

-- owner_id: l'utente PC che ha aperto la sessione (Step 5 — RLS).
ALTER TABLE public.scan_sessions
    ADD COLUMN IF NOT EXISTS owner_id UUID;

CREATE INDEX IF NOT EXISTS scan_sessions_expires_at_idx ON public.scan_sessions (expires_at);

-- ============================================================
-- 2. scan_results — outbox: una riga per file processato
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scan_results (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
    batch_id    TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, batch_id)
);

CREATE INDEX IF NOT EXISTS scan_results_session_idx ON public.scan_results (session_id);

-- RLS aperta come scan_sessions oggi (la sicurezza vera è in Step 5).
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_results_open_all" ON public.scan_results;
CREATE POLICY "scan_results_open_all"
    ON public.scan_results
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 3. Realtime: pubblica le due tabelle (idempotente)
-- ============================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_results;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ============================================================
-- 4. Cleanup opportunistico (chiamata dal client all'apertura del modale)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_scan_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.scan_sessions WHERE expires_at < now();
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_scan_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_scan_sessions() TO authenticated, anon;
