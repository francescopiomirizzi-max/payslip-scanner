-- Migration 006: Crea il bucket Storage 'legal-corpus' (PDF + DOCX).
-- Le migration precedenti (002-005) creano tabelle + policy, ma il bucket
-- va inserito esplicitamente in storage.buckets. Senza bucket l'upload
-- fallisce con "Bucket not found".
--
-- ID/name 'legal-corpus' coincide con la costante STORAGE_BUCKET di
-- lib/ragRepository.ts e con le policy 'legal_corpus_*' di 005.
--
-- Idempotente: ON CONFLICT DO NOTHING permette di rilanciare la migration
-- senza errori se il bucket fosse già stato creato via Dashboard.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'legal-corpus',
  'legal-corpus',
  false,                                 -- bucket privato; signed URL per il download
  52428800,                              -- 50 MB max per file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET allowed_mime_types = EXCLUDED.allowed_mime_types,
      file_size_limit    = EXCLUDED.file_size_limit;

-- Verifica post-migration:
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'legal-corpus';
-- Atteso: 1 riga, public=false, mime PDF + DOCX.
