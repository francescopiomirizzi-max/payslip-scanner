// ============================================================
// lib/ragRepository.ts
// Wrapper Supabase per il dominio RAG: documenti legali, chunks, query log.
// Usa il client `supabase` esistente (anon key, browser-side).
//
// NOTA Phase 1: il bootstrap iniziale del corpus dovrà avvenire via service_role
// key (RLS bypass) tramite uno script Node separato — vedi rag-architecture.md §9.3.
// Questo file assume policy RLS soddisfatta lato server (es. JWT admin) oppure
// bootstrap via script con service_role. In dev locale è normale che gli insert
// falliscano per RLS finché non si configura il role; il flusso retrieval funziona
// in lettura per qualsiasi utente authenticated.
// ============================================================

import { supabase } from '../supabaseClient';

const STORAGE_BUCKET = 'legal-corpus';

// ============================================================
// Tipi pubblici
// ============================================================

export type DocType = 'ccnl' | 'sentenza' | 'interpello' | 'circolare' | 'dottrina' | 'altro';

export interface LegalDocumentInput {
  title: string;
  doc_type: DocType;
  source_ref?: string;
  storage_path?: string;
  ccnl_ref?: string;
  doc_date?: string;          // 'YYYY-MM-DD'
  metadata?: Record<string, any>;
  embedding_model?: string;   // default 'nomic-embed-text' lato DDL
}

export interface LegalChunkInput {
  chunk_index: number;
  content: string;
  section_ref?: string;
  token_count?: number;
  embedding: number[];        // length = 768 per nomic-embed-text
  metadata?: Record<string, any>;
}

export interface MatchedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  section_ref: string | null;
  doc_title: string;
  doc_source_ref: string | null;
  doc_type: DocType;
  similarity: number;         // [0, 1] tipicamente
}

export interface MatchOptions {
  threshold?: number;         // default 0.7
  k?: number;                 // default 5
  ccnl_filter?: string | null;
}

export interface LegalQueryLog {
  query_text: string;
  query_embedding: number[];
  retrieved_chunk_ids: string[];
  llm_answer: string;
  worker_id?: string;
}

// ============================================================
// Storage: upload documento in bucket legal-corpus (PDF o DOCX)
// ============================================================

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Deriva MIME + estensione corretti dal file (con fallback su PDF se sconosciuto). */
function getMimeAndExtension(file: File | Blob): { mime: string; ext: string } {
  const declaredMime = (file as File).type ?? '';
  const name = ((file as File).name ?? '').toLowerCase();
  if (declaredMime === DOCX_MIME || name.endsWith('.docx')) return { mime: DOCX_MIME, ext: 'docx' };
  if (declaredMime === PDF_MIME || name.endsWith('.pdf')) return { mime: PDF_MIME, ext: 'pdf' };
  // Fallback conservativo (non bloccante): mantiene il MIME dichiarato dal browser
  return { mime: declaredMime || PDF_MIME, ext: 'bin' };
}

/**
 * Upload generico di un documento legale (PDF o DOCX) nel bucket Supabase.
 * Il nome del file viene normalizzato (slugify) e l'estensione derivata dal MIME/nome.
 */
export async function uploadLegalDocument(
  file: File | Blob,
  docType: DocType,
  slug: string
): Promise<{ storage_path: string }> {
  const { mime, ext } = getMimeAndExtension(file);
  const filename = slug.toLowerCase().replace(/[^a-z0-9-_]+/g, '-') + `.${ext}`;
  const path = `${docType}/${filename}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: mime,
      upsert: false,            // niente overwrite silenziosi
    });

  if (error) {
    throw new Error(`Upload documento a ${STORAGE_BUCKET}/${path} fallito: ${error.message}`);
  }
  return { storage_path: path };
}


/**
 * Ottiene un signed URL per aprire il PDF lato UI (deep-link da citazioni).
 * Validità default 1 ora.
 */
export async function getLegalPdfSignedUrl(
  storage_path: string,
  expiresInSec = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storage_path, expiresInSec);
  if (error || !data) throw new Error(`Signed URL fallito: ${error?.message}`);
  return data.signedUrl;
}

/**
 * Lookup storage_path partendo dal document_id (usato dai click sulle citazioni).
 */
export async function getLegalDocumentStoragePath(document_id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('storage_path')
    .eq('id', document_id)
    .single();
  if (error || !data) return null;
  return (data.storage_path as string | null) ?? null;
}

/**
 * Helper one-shot per UI citazioni: dato document_id, apre il PDF in nuovo tab.
 * Lazy lookup → signed URL → window.open. Niente cache (uso sporadico).
 */
export async function openLegalDocumentInTab(document_id: string): Promise<void> {
  const path = await getLegalDocumentStoragePath(document_id);
  if (!path) {
    console.warn('Nessuno storage_path per document_id', document_id);
    return;
  }
  const url = await getLegalPdfSignedUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================================
// CRUD legal_documents
// ============================================================

export async function insertLegalDocument(input: LegalDocumentInput): Promise<string> {
  const { data, error } = await supabase
    .from('legal_documents')
    .insert({
      title: input.title,
      doc_type: input.doc_type,
      source_ref: input.source_ref ?? null,
      storage_path: input.storage_path ?? null,
      ccnl_ref: input.ccnl_ref ?? null,
      doc_date: input.doc_date ?? null,
      metadata: input.metadata ?? {},
      embedding_model: input.embedding_model ?? 'nomic-embed-text',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Insert legal_documents fallito: ${error?.message}`);
  }
  return data.id as string;
}

export async function listLegalDocuments(): Promise<Array<{
  id: string;
  title: string;
  doc_type: DocType;
  source_ref: string | null;
  ccnl_ref: string | null;
  doc_date: string | null;
  embedding_model: string;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('id, title, doc_type, source_ref, ccnl_ref, doc_date, embedding_model, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`List legal_documents fallito: ${error.message}`);
  return data ?? [];
}

// ============================================================
// CRUD legal_chunks
// ============================================================

/**
 * Insert bulk di chunks in batch da BATCH_SIZE per non saturare payload HTTP.
 * Ogni chunk ~ 6 KB con embedding 768 float → 50 chunks = ~300 KB safe.
 */
export async function insertLegalChunks(
  document_id: string,
  chunks: LegalChunkInput[]
): Promise<void> {
  const BATCH_SIZE = 50;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const slice = chunks.slice(i, i + BATCH_SIZE);
    const rows = slice.map(c => ({
      document_id,
      chunk_index: c.chunk_index,
      content: c.content,
      section_ref: c.section_ref ?? null,
      token_count: c.token_count ?? null,
      embedding: c.embedding,
      metadata: c.metadata ?? {},
    }));

    const { error } = await supabase.from('legal_chunks').insert(rows);
    if (error) {
      throw new Error(`Insert legal_chunks batch ${i / BATCH_SIZE} fallito: ${error.message}`);
    }
  }
}

/**
 * Resume support: ritorna l'array degli chunk_index già presenti per document_id.
 * Utile per saltare chunks già embedded su retry.
 */
export async function getExistingChunkIndices(document_id: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('legal_chunks')
    .select('chunk_index')
    .eq('document_id', document_id);
  if (error) throw new Error(`Query existing chunks fallito: ${error.message}`);
  return (data ?? []).map(r => r.chunk_index as number);
}

// ============================================================
// Similarity search via RPC (migration 004)
// ============================================================

export async function matchLegalChunks(
  query_embedding: number[],
  options: MatchOptions = {}
): Promise<MatchedChunk[]> {
  const { threshold = 0.7, k = 5, ccnl_filter = null } = options;

  const { data, error } = await supabase.rpc('match_legal_chunks', {
    query_embedding,
    match_threshold: threshold,
    match_count: k,
    ccnl_filter,
  });

  if (error) throw new Error(`RPC match_legal_chunks fallito: ${error.message}`);
  return (data ?? []) as MatchedChunk[];
}

// ============================================================
// Logging query per analytics + audit
// ============================================================

export async function logLegalQuery(log: LegalQueryLog): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('legal_queries').insert({
    user_id: user?.id ?? null,
    worker_id: log.worker_id ?? null,
    query_text: log.query_text,
    query_embedding: log.query_embedding,
    retrieved_chunk_ids: log.retrieved_chunk_ids,
    llm_answer: log.llm_answer,
  });

  // Non-bloccante: il logging non deve mai far fallire la risposta utente
  if (error) console.warn('Log legal_queries fallito (non-bloccante):', error.message);
}
