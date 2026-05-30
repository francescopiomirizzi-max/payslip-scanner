-- Migration 012: rimuove la policy legacy permissiva su scan_sessions.
--
-- Bug rilevato il 2026-05-30 (review pre-deploy). Sulla tabella scan_sessions
-- sopravviveva la policy "Permetti accesso anonimo per QR" (FOR ALL, role public,
-- USING true / WITH CHECK true), creata a mano dalla dashboard prima della 008.
--
-- Le policy RLS permissive sono OR-combinate: questa singola policy ANNULLAVA tutto
-- l'owner-scoping introdotto dalla migration 008 (scan_sessions_select/insert/delete_owner
-- + update vincolato a expires_at). Effetto: un anonimo poteva SELECT/INSERT/UPDATE/DELETE
-- qualunque sessione QR di qualunque owner.
--
-- La 008 droppava i vecchi nomi inglesi (scan_sessions_open_all, ecc.) ma non questo nome
-- italiano. Il drop è SICURO: l'accesso anon legittimo del telefono resta coperto da
-- "scan_sessions_update_any" (anon, expires_at > now()) e da "scan_results_insert_anyone".
-- scan_results non ha policy blanket equivalenti (già verificato).

DROP POLICY IF EXISTS "Permetti accesso anonimo per QR" ON public.scan_sessions;

-- Verifica post-migration (atteso: NESSUNA riga con qual='true' per role public):
--   SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies WHERE schemaname='public' AND tablename='scan_sessions';
