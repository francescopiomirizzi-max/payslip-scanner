-- Migration 002: Schema corpus legale per RAG
-- Crea le 3 tabelle del corpus: legal_documents, legal_chunks (con embedding 768-dim), legal_queries.
-- Embedding model di riferimento: nomic-embed-text (768 dim) servito via Ollama locale.
-- Index HNSW su cosine distance per similarity search performante.

-- ============================================================
-- Tabella 1: legal_documents (1 record per documento sorgente)
-- ============================================================
CREATE TABLE legal_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  doc_type        text NOT NULL CHECK (doc_type IN ('ccnl', 'sentenza', 'interpello', 'circolare', 'dottrina', 'altro')),
  source_ref      text,                       -- es. 'Cass. Sez. Lav. 20216/2022'
  storage_path    text,                       -- path nel bucket Supabase 'legal-corpus/...'
  ccnl_ref        text,                       -- 'Multiservizi', 'Mobilità/Ferroviari', NULL se non CCNL
  doc_date        date,                       -- data pubblicazione/sentenza
  metadata        jsonb DEFAULT '{}'::jsonb,
  embedding_model text NOT NULL DEFAULT 'nomic-embed-text',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_legal_documents_doc_type ON legal_documents (doc_type);
CREATE INDEX idx_legal_documents_ccnl_ref ON legal_documents (ccnl_ref) WHERE ccnl_ref IS NOT NULL;
CREATE INDEX idx_legal_documents_metadata ON legal_documents USING GIN (metadata);

-- ============================================================
-- Tabella 2: legal_chunks (N record per documento)
-- vector(768) = dimensione embedding nomic-embed-text
-- ============================================================
CREATE TABLE legal_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  chunk_index     int NOT NULL,
  content         text NOT NULL,
  section_ref     text,                       -- es. 'Art. 36 c.4', 'pag. 7 par. 3'
  token_count     int,
  embedding       vector(768) NOT NULL,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_legal_chunks_document_id ON legal_chunks (document_id);

-- Indice HNSW per cosine distance (operatore <=> di pgvector)
-- m = 16: numero di connessioni per nodo (default raccomandato)
-- ef_construction = 64: precisione costruzione indice (più alto = più lento ma più accurato)
CREATE INDEX idx_legal_chunks_embedding_hnsw
  ON legal_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- Tabella 3: legal_queries (log + analytics)
-- ============================================================
CREATE TABLE legal_queries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  worker_id            uuid REFERENCES workers(id) ON DELETE SET NULL,  -- opzionale: contesto worker
  query_text           text NOT NULL,
  query_embedding      vector(768),
  retrieved_chunk_ids  uuid[],                 -- array degli id chunk usati come contesto
  llm_answer           text,
  feedback_score       smallint,               -- -1, 0, +1 (thumbs)
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_legal_queries_user_id ON legal_queries (user_id);
CREATE INDEX idx_legal_queries_created_at ON legal_queries (created_at DESC);
CREATE INDEX idx_legal_queries_worker_id ON legal_queries (worker_id) WHERE worker_id IS NOT NULL;

-- ============================================================
-- Trigger: updated_at automatico su legal_documents
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
