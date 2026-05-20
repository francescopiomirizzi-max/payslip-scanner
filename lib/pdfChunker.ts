// ============================================================
// lib/pdfChunker.ts
// Parser documenti (PDF + DOCX) + chunking strategy per ingestion RAG.
// Phase 1: sliding window 800 token / overlap 100 per tutti i doc_type.
// Phase 2: strategie specifiche per CCNL (per-articolo) e sentenze (per-paragrafo).
//
// Formati supportati:
//   - PDF (.pdf) via pdfjs-dist → preserva pagine
//   - DOCX (.docx) via mammoth.js → singolo blocco testuale (no pagine native)
//   - DOC (.doc) NON supportato (formato binario legacy pre-2007)
// ============================================================

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
// pdfjs-dist 5.x: il worker va caricato come asset URL Vite (?url ottiene la URL del file emesso da Vite)
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// MIME types accettati per l'ingestion
export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type DocumentFormat = 'pdf' | 'docx';

/**
 * Determina il formato del file in base a MIME type o estensione.
 * Ritorna null se il formato non è supportato.
 */
export function detectDocumentFormat(file: File | { type?: string; name?: string }): DocumentFormat | null {
  const mime = file.type ?? '';
  const name = (file.name ?? '').toLowerCase();
  if (mime === PDF_MIME || name.endsWith('.pdf')) return 'pdf';
  if (mime === DOCX_MIME || name.endsWith('.docx')) return 'docx';
  return null;
}

// ============================================================
// Stima conteggio token
// Rule of thumb italiano: ~4 caratteri per token (più conservativo
// dell'inglese che è ~3.5). Non serve precisione perfetta, è solo
// per il budget del prompt e il sizing dei chunk.
// ============================================================
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================
// Estrazione testo da PDF
// Ritorna array { page, text } per ogni pagina (1-indexed come da convenzione PDF).
// I PDF scansionati senza layer testo restituiranno pagine con text='' — il caller gestisce.
// ============================================================

export interface PageText {
  page: number;
  text: string;
}

export async function extractPdfText(file: File | Blob | ArrayBuffer): Promise<PageText[]> {
  const data = file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;

  const pages: PageText[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // I "items" hanno { str, transform, ... }. Concatena con spazio dove serve.
    const text = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: pageNum, text });
  }

  await pdf.cleanup();
  return pages;
}

// ============================================================
// Estrazione testo da DOCX via mammoth
// I .docx non hanno pagine intrinseche (la paginazione è del printer),
// quindi ritorniamo l'intero contenuto come un unico "blocco" page=1.
// Il chunking sliding window successivo segmenta correttamente.
// Per `section_ref` ci affideremo al numero di paragrafo (Phase 2).
// ============================================================

export async function extractDocxText(file: File | Blob | ArrayBuffer): Promise<PageText[]> {
  const arrayBuffer = file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = (result.value ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  return [{ page: 1, text }];
}

// ============================================================
// Dispatcher generico: parsing in base al formato del file.
// ============================================================

export async function extractDocumentText(file: File | Blob): Promise<PageText[]> {
  // Le Blob raw non hanno `name`; cadiamo su MIME solo
  const fmt = detectDocumentFormat(file as File);
  if (fmt === 'pdf') return extractPdfText(file);
  if (fmt === 'docx') return extractDocxText(file);
  throw new Error(
    'Formato non supportato. Accettati: PDF (.pdf) o Word (.docx). I file .doc legacy non sono supportati.'
  );
}

// ============================================================
// Chunking sliding window (Phase 1 — strategia unica per tutti i doc_type)
// ============================================================

export interface Chunk {
  chunk_index: number;
  content: string;
  section_ref: string;       // es. "pag. 3" oppure "pag. 3-4" se attraversa
  token_count: number;
  metadata: { page_start: number; page_end: number };
}

export interface ChunkOptions {
  targetTokens?: number;     // size target di un chunk (default 800)
  overlapTokens?: number;    // overlap tra chunk consecutivi (default 100)
}

const DEFAULT_TARGET = 800;
const DEFAULT_OVERLAP = 100;

/**
 * Costruisce chunks da un array di pagine.
 * Usa sliding window su parole: accumula parole fino a raggiungere targetTokens,
 * poi inizia un nuovo chunk includendo overlapTokens dell'ultimo come prefisso.
 * Traccia da quale pagina/e proviene ogni chunk per popolare `section_ref`.
 */
function slidingWindowChunks(pages: PageText[], opts: ChunkOptions = {}): Chunk[] {
  const targetTok = opts.targetTokens ?? DEFAULT_TARGET;
  const overlapTok = opts.overlapTokens ?? DEFAULT_OVERLAP;

  // Build array di "tokens" approssimativi (parole) con tracking della pagina.
  // Ogni elemento: { word, page }
  const tokens: Array<{ word: string; page: number }> = [];
  for (const p of pages) {
    if (!p.text) continue;
    for (const word of p.text.split(/\s+/)) {
      if (word) tokens.push({ word, page: p.page });
    }
  }

  if (tokens.length === 0) return [];

  const chunks: Chunk[] = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < tokens.length) {
    // Riempi un chunk fino a raggiungere targetTok (stimati da char_count / 4)
    let endCursor = cursor;
    let assembledChars = 0;
    while (endCursor < tokens.length && assembledChars / 4 < targetTok) {
      assembledChars += tokens[endCursor].word.length + 1; // +1 per lo spazio
      endCursor++;
    }

    const slice = tokens.slice(cursor, endCursor);
    const content = slice.map(t => t.word).join(' ').trim();
    if (!content) break;

    const pageStart = slice[0].page;
    const pageEnd = slice[slice.length - 1].page;
    const sectionRef = pageStart === pageEnd ? `pag. ${pageStart}` : `pag. ${pageStart}-${pageEnd}`;

    chunks.push({
      chunk_index: chunkIndex++,
      content,
      section_ref: sectionRef,
      token_count: estimateTokens(content),
      metadata: { page_start: pageStart, page_end: pageEnd },
    });

    if (endCursor >= tokens.length) break;

    // Sliding: nuovo cursor = endCursor - overlapTok (in parole approssimate)
    // Stima parole per overlapTok: parole ~ overlapTok * 4 / 5 (assumendo lunghezza media parola ~5 char)
    const overlapWords = Math.max(0, Math.floor(overlapTok * 4 / 5));
    cursor = Math.max(cursor + 1, endCursor - overlapWords);
  }

  return chunks;
}

// ============================================================
// Router chunking per doc_type
// Phase 1: tutti usano slidingWindow. Phase 2 si aggiungono strategie ad hoc.
// ============================================================

export type DocType = 'ccnl' | 'sentenza' | 'interpello' | 'circolare' | 'dottrina' | 'altro';

export function chunkDocument(
  pages: PageText[],
  docType: DocType,
  opts?: ChunkOptions
): Chunk[] {
  // Phase 1: strategia unica. Tracciamo doc_type per uso futuro (Phase 2).
  void docType;
  return slidingWindowChunks(pages, opts);
}
