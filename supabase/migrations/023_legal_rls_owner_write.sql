-- Migration 023: P1 — scrittura sul corpus legale ristretta all'OWNER.
-- Chiude il "relax Phase 1" della 005: INSERT/UPDATE/DELETE su legal_documents,
-- legal_chunks e sul bucket storage 'legal-corpus' erano aperti a QUALSIASI
-- authenticated (viewer incluso) — non più accettabile col multi-organizzazione (022).
-- Lettura invariata (authenticated). Pattern (select auth.uid()) come 019 (initplan).
-- Owner = 7fec036e-d081-4a8f-9da7-5d9c6e7cfc70 (stesso UID owner di app_settings, 018).

-- ============================================================
-- legal_documents
-- ============================================================
DROP POLICY IF EXISTS "authenticated_write_docs" ON legal_documents;
DROP POLICY IF EXISTS "authenticated_update_docs" ON legal_documents;
DROP POLICY IF EXISTS "authenticated_delete_docs" ON legal_documents;

CREATE POLICY "owner_write_docs"
  ON legal_documents FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

CREATE POLICY "owner_update_docs"
  ON legal_documents FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid)
  WITH CHECK ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

CREATE POLICY "owner_delete_docs"
  ON legal_documents FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

-- ============================================================
-- legal_chunks
-- ============================================================
DROP POLICY IF EXISTS "authenticated_write_chunks" ON legal_chunks;
DROP POLICY IF EXISTS "authenticated_update_chunks" ON legal_chunks;
DROP POLICY IF EXISTS "authenticated_delete_chunks" ON legal_chunks;

CREATE POLICY "owner_write_chunks"
  ON legal_chunks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

CREATE POLICY "owner_update_chunks"
  ON legal_chunks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid)
  WITH CHECK ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

CREATE POLICY "owner_delete_chunks"
  ON legal_chunks FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

-- ============================================================
-- Storage bucket 'legal-corpus' — stessa falla della 005, stessa cura.
-- Read invariata (legal_corpus_read). Stessi nomi policy, condizione + owner.
-- ============================================================
DROP POLICY IF EXISTS "legal_corpus_insert" ON storage.objects;
CREATE POLICY "legal_corpus_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'legal-corpus'
    AND (select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

DROP POLICY IF EXISTS "legal_corpus_update" ON storage.objects;
CREATE POLICY "legal_corpus_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'legal-corpus'
    AND (select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid)
  WITH CHECK (bucket_id = 'legal-corpus'
    AND (select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

DROP POLICY IF EXISTS "legal_corpus_delete" ON storage.objects;
CREATE POLICY "legal_corpus_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'legal-corpus'
    AND (select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);
