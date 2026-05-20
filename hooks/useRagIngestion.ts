// ============================================================
// hooks/useRagIngestion.ts
// Orchestra la pipeline di ingestion documenti legali Phase 1 RAG.
// Tutto client-side: upload Supabase Storage → parse PDF (pdfjs-dist) →
// chunking sliding window → embedding parallelo via Ollama → bulk insert.
// ============================================================

import { useCallback, useRef, useState } from 'react';
import { ollamaEmbedBatch, ollamaHealthCheck } from '../lib/ollama';
import {
  extractDocumentText,
  detectDocumentFormat,
  chunkDocument,
  type DocType,
} from '../lib/pdfChunker';
import {
  uploadLegalDocument,
  insertLegalDocument,
  insertLegalChunks,
  getExistingChunkIndices,
  type LegalChunkInput,
} from '../lib/ragRepository';

export type IngestionPhase =
  | 'idle'
  | 'health-check'
  | 'uploading'
  | 'creating-record'
  | 'parsing-pdf'
  | 'chunking'
  | 'embedding'
  | 'saving-chunks'
  | 'done'
  | 'error';

export interface IngestionProgress {
  phase: IngestionPhase;
  /** % 0-100, dove rilevante (embedding/saving) */
  percent: number;
  /** numero di chunk processati / totale (durante embedding/saving) */
  chunksDone: number;
  chunksTotal: number;
  /** messaggio human-readable per UI */
  message: string;
}

export interface IngestionInput {
  title: string;
  doc_type: DocType;
  source_ref?: string;
  ccnl_ref?: string;
  doc_date?: string;          // 'YYYY-MM-DD'
}

export interface IngestionResult {
  document_id: string;
  storage_path: string;
  chunks_inserted: number;
  took_ms: number;
}

const INITIAL_PROGRESS: IngestionProgress = {
  phase: 'idle',
  percent: 0,
  chunksDone: 0,
  chunksTotal: 0,
  message: '',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâã]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõ]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'doc';
}

export function useRagIngestion() {
  const [progress, setProgress] = useState<IngestionProgress>(INITIAL_PROGRESS);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
    setError(null);
    setIsIngesting(false);
    abortRef.current = null;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const ingestDocument = useCallback(
    async (file: File, input: IngestionInput): Promise<IngestionResult> => {
      if (isIngesting) throw new Error('Ingestion già in corso');
      const startTime = performance.now();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsIngesting(true);
      setError(null);

      try {
        // ── Phase 1: Health check Ollama ─────────────────────
        setProgress({
          phase: 'health-check',
          percent: 0,
          chunksDone: 0,
          chunksTotal: 0,
          message: 'Verifica Ollama in locale...',
        });
        const health = await ollamaHealthCheck();
        if (!health.ok) {
          throw new Error(
            'Ollama non raggiungibile. Avvialo con `ollama serve` e ricarica.'
          );
        }
        if (!health.hasEmbedding) {
          throw new Error(
            'Modello "nomic-embed-text" non installato. Esegui: ollama pull nomic-embed-text'
          );
        }

        // ── Phase 2: Upload PDF a Storage ────────────────────
        const slug = slugify(input.title);
        setProgress({
          phase: 'uploading',
          percent: 5,
          chunksDone: 0,
          chunksTotal: 0,
          message: 'Caricamento PDF su Supabase Storage...',
        });
        const { storage_path } = await uploadLegalDocument(file, input.doc_type, slug);

        // ── Phase 3: Insert record documento ─────────────────
        setProgress({
          phase: 'creating-record',
          percent: 10,
          chunksDone: 0,
          chunksTotal: 0,
          message: 'Registrazione metadati...',
        });
        const document_id = await insertLegalDocument({
          title: input.title,
          doc_type: input.doc_type,
          source_ref: input.source_ref,
          storage_path,
          ccnl_ref: input.ccnl_ref,
          doc_date: input.doc_date,
          embedding_model: 'nomic-embed-text',
        });

        // ── Phase 4: Parse documento (PDF o DOCX) ────────────
        const docFormat = detectDocumentFormat(file);
        if (!docFormat) {
          throw new Error(
            'Formato non supportato. Accettati: PDF (.pdf) o Word (.docx).'
          );
        }
        setProgress({
          phase: 'parsing-pdf',
          percent: 15,
          chunksDone: 0,
          chunksTotal: 0,
          message: docFormat === 'pdf' ? 'Estrazione testo dal PDF...' : 'Estrazione testo dal Word...',
        });
        const pages = await extractDocumentText(file);
        const hasText = pages.some(p => p.text.length > 0);
        if (!hasText) {
          throw new Error(
            docFormat === 'pdf'
              ? 'PDF senza layer testo (probabile scansione). Esegui OCR prima dell\'upload.'
              : 'Il documento Word è vuoto o privo di contenuto testuale.'
          );
        }

        // ── Phase 5: Chunking ────────────────────────────────
        setProgress({
          phase: 'chunking',
          percent: 20,
          chunksDone: 0,
          chunksTotal: 0,
          message: 'Suddivisione in chunks...',
        });
        const chunks = chunkDocument(pages, input.doc_type);
        if (chunks.length === 0) {
          throw new Error('Nessun chunk generato (documento vuoto?)');
        }

        // ── Phase 6: Resume support ──────────────────────────
        const existingIndices = await getExistingChunkIndices(document_id);
        const existingSet = new Set(existingIndices);
        const toEmbed = chunks.filter(c => !existingSet.has(c.chunk_index));
        const total = chunks.length;

        // ── Phase 7: Embedding batch parallelo ───────────────
        setProgress({
          phase: 'embedding',
          percent: 25,
          chunksDone: 0,
          chunksTotal: total,
          message: `Embedding ${toEmbed.length} chunks via Ollama...`,
        });

        const embeddings = await ollamaEmbedBatch(
          toEmbed.map(c => c.content),
          {
            concurrency: 6,
            signal: ctrl.signal,
            onProgress: (done, count) => {
              const baseDone = existingSet.size + done;
              const percent = 25 + Math.floor((baseDone / total) * 60); // 25-85%
              setProgress({
                phase: 'embedding',
                percent,
                chunksDone: baseDone,
                chunksTotal: total,
                message: `Embedding ${baseDone}/${total}...`,
              });
            },
          }
        );

        // ── Phase 8: Bulk insert chunks ──────────────────────
        const chunksToInsert: LegalChunkInput[] = toEmbed.map((c, i) => ({
          chunk_index: c.chunk_index,
          content: c.content,
          section_ref: c.section_ref,
          token_count: c.token_count,
          embedding: embeddings[i],
          metadata: c.metadata,
        }));

        setProgress({
          phase: 'saving-chunks',
          percent: 90,
          chunksDone: total,
          chunksTotal: total,
          message: 'Salvataggio chunks su Supabase...',
        });
        await insertLegalChunks(document_id, chunksToInsert);

        // ── Phase 9: Done ────────────────────────────────────
        const took_ms = Math.round(performance.now() - startTime);
        setProgress({
          phase: 'done',
          percent: 100,
          chunksDone: total,
          chunksTotal: total,
          message: `✅ Indicizzato: ${chunksToInsert.length} nuovi chunks in ${(took_ms / 1000).toFixed(1)}s`,
        });

        return {
          document_id,
          storage_path,
          chunks_inserted: chunksToInsert.length,
          took_ms,
        };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setError(msg);
        setProgress(p => ({ ...p, phase: 'error', message: msg }));
        throw e;
      } finally {
        setIsIngesting(false);
        abortRef.current = null;
      }
    },
    [isIngesting]
  );

  return { ingestDocument, progress, isIngesting, error, reset, abort };
}
