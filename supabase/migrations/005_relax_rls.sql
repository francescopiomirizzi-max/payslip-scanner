-- Migration 005: Rilassa policy admin_write per setup single-user Phase 1.
-- Sostituisce le policy 'admin_write_*' di 003 con policy aperte a tutti gli authenticated.
-- Razionale: in Phase 1 c'è un solo utente (lo sviluppatore) che gestisce sia il corpus
-- legale sia le proprie query. Niente JWT role custom da configurare.
-- ATTENZIONE: in Phase 2 (multi-user / team) ripristinare il check su JWT 'role = admin'.

-- ============================================================
-- legal_documents
-- ============================================================
DROP POLICY IF EXISTS "admin_write_docs" ON legal_documents;

CREATE POLICY "authenticated_write_docs"
  ON legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_docs"
  ON legal_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_delete_docs"
  ON legal_documents FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- legal_chunks
-- ============================================================
DROP POLICY IF EXISTS "admin_write_chunks" ON legal_chunks;

CREATE POLICY "authenticated_write_chunks"
  ON legal_chunks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_chunks"
  ON legal_chunks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_delete_chunks"
  ON legal_chunks FOR DELETE
  TO authenticated
  USING (true);

-- legal_queries restano per-user (policy di 003 invariate).

-- ============================================================
-- Storage bucket: policy upload/delete su 'legal-corpus'
-- ATTENZIONE: queste policy lavorano sulla tabella storage.objects.
-- Eseguire DOPO aver creato il bucket 'legal-corpus' dalla Dashboard.
-- ============================================================

-- Read libero per authenticated (signed URL anche per non-auth se serve, gestito lato client)
DROP POLICY IF EXISTS "legal_corpus_read" ON storage.objects;
CREATE POLICY "legal_corpus_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'legal-corpus');

-- Insert/Update/Delete aperti per Phase 1 (single-user)
DROP POLICY IF EXISTS "legal_corpus_insert" ON storage.objects;
CREATE POLICY "legal_corpus_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'legal-corpus');

DROP POLICY IF EXISTS "legal_corpus_update" ON storage.objects;
CREATE POLICY "legal_corpus_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'legal-corpus')
  WITH CHECK (bucket_id = 'legal-corpus');

DROP POLICY IF EXISTS "legal_corpus_delete" ON storage.objects;
CREATE POLICY "legal_corpus_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'legal-corpus');
