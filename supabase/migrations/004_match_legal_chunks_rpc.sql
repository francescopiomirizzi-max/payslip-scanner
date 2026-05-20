-- Migration 004: RPC per similarity search
-- Esposta al client via `supabase.rpc('match_legal_chunks', { ... })`.
-- Pattern Supabase standard per non esporre SQL crudo al frontend.
-- Operatore <=> = cosine distance pgvector (0 = identico, 2 = opposto).
-- Similarity = 1 - distance (in [-1, 1], tipicamente [0, 1] su modelli normalizzati).

CREATE OR REPLACE FUNCTION match_legal_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  ccnl_filter text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id        uuid,
  document_id     uuid,
  content         text,
  section_ref     text,
  doc_title       text,
  doc_source_ref  text,
  doc_type        text,
  similarity      float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id            AS chunk_id,
    c.document_id,
    c.content,
    c.section_ref,
    d.title         AS doc_title,
    d.source_ref    AS doc_source_ref,
    d.doc_type,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM legal_chunks c
  JOIN legal_documents d ON c.document_id = d.id
  WHERE
    (ccnl_filter IS NULL OR d.ccnl_ref = ccnl_filter)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding  -- ASC distance = DESC similarity
  LIMIT match_count;
$$;

-- Permesso di esecuzione per utenti autenticati
GRANT EXECUTE ON FUNCTION match_legal_chunks TO authenticated;

-- Esempio chiamata client (TypeScript):
--   const { data, error } = await supabase.rpc('match_legal_chunks', {
--     query_embedding: embedding,        // number[768]
--     match_threshold: 0.7,
--     match_count: 5,
--     ccnl_filter: 'Multiservizi'        // o null per cercare in tutto il corpus
--   });
