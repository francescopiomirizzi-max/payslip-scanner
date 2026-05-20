-- Migration 001: Enable pgvector extension
-- Prerequisito per tutte le altre migration RAG.
-- pgvector >= 0.5 richiesto per indice HNSW (Supabase Postgres 15+ supporta pgvector 0.7+).

CREATE EXTENSION IF NOT EXISTS vector;

-- Verifica versione installata (eseguire manualmente dopo la migration):
--   SELECT extversion FROM pg_extension WHERE extname = 'vector';
-- Atteso: 0.7.x o superiore.
