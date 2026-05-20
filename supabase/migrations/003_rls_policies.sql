-- Migration 003: Row Level Security per corpus legale
-- Policy:
--   legal_documents/chunks: read libero per authenticated, write solo admin
--   legal_queries: ogni utente vede/scrive solo le proprie
-- NOTA Phase 1: il bootstrap iniziale del corpus avviene via service_role key (bypassa RLS).
-- L'admin role JWT claim verrà introdotto in Phase 2 (vedi rag-architecture.md §9.3).

-- ============================================================
-- legal_documents
-- ============================================================
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all_authenticated_docs"
  ON legal_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_write_docs"
  ON legal_documents FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- legal_chunks
-- ============================================================
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all_authenticated_chunks"
  ON legal_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_write_chunks"
  ON legal_chunks FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- legal_queries (per-user)
-- ============================================================
ALTER TABLE legal_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_queries_select"
  ON legal_queries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_own_queries_insert"
  ON legal_queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update/delete delle proprie query (es. cancellare cronologia, dare feedback dopo)
CREATE POLICY "user_own_queries_update"
  ON legal_queries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_queries_delete"
  ON legal_queries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
