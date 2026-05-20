// ============================================================
// hooks/useRagAvvocato.ts
// Pipeline retrieval-augmented generation client-side per l'Avvocato Virtuale.
// Flusso:
//   1. Query expansion con worker context (CCNL, codici, mese)
//   2. Embed query via Ollama (nomic-embed-text)
//   3. Similarity search Supabase RPC (match_legal_chunks)
//   4. Costruzione system prompt con fonti numerate [1] [2] [3]
//   5. Generazione streaming via Ollama (qwen3.6:35b)
//   6. Log non-bloccante su legal_queries
//
// Esposto come hook: { ask, streamingAnswer, sources, isAsking, error, abort, reset }
// ============================================================

import { useCallback, useRef, useState } from 'react';
import {
  ollamaEmbed,
  ollamaChatStream,
  ollamaHealthCheck,
  type ChatMessage,
} from '../lib/ollama';
import { matchLegalChunks, logLegalQuery, type MatchedChunk } from '../lib/ragRepository';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS } from '../config/profiles';

// ============================================================
// Mappatura profilo RailFlow → ccnl_ref nel corpus legale.
// Derivata dal registro centralizzato: i valori DEVONO coincidere
// con ciò che l'admin inserisce in `legal_documents.ccnl_ref`.
// ============================================================
const PROFILO_TO_CCNL_REF: Record<string, string> = Object.fromEntries(
  SYSTEM_PROFILE_KEYS.map(k => [k, SYSTEM_PROFILES[k].ccnlRef])
);

// ============================================================
// Tipi pubblici
// ============================================================

export interface WorkerLite {
  nome?: string;
  cognome?: string;
  profilo?: string;
  eliorType?: string | null;
}

export interface AskOptions {
  worker?: WorkerLite;
  /** Se null/omesso, retrieval su tutto il corpus. Se presente, override del mapping automatico. */
  ccnl_filter?: string | null;
  threshold?: number;       // default 0.7
  k?: number;               // default 5
  /** Mese rilevante (1-12) se la domanda riguarda un mese specifico */
  monthContext?: { year: number; month: number };
}

export type RagSource = MatchedChunk;

const SYSTEM_PROMPT_BASE = `Sei un Senior Consulente del Lavoro e Avvocato Giuslavorista italiano specializzato in CCNL multi-settore, differenze retributive (Cass. 20216/2022) e indennità accessorie.

Stile e regole TASSATIVE:
- Rispondi in modo preciso, tecnico ma sintetico (max 6-8 righe a meno di richiesta esplicita).
- Cita ESPLICITAMENTE le fonti fornite tra parentesi quadre: [1], [2], [3]. Le fonti che usi devono apparire nel testo come segnalibri cliccabili.
- È SEVERAMENTE VIETATO inventare riferimenti normativi, articoli, sentenze, date, nomi, numeri di protocollo non presenti TESTUALMENTE nelle FONTI sottostanti. Se non compare nelle fonti, NON lo nominare.
- **Disclaimer "fonti insufficienti"**: usalo SOLO come PRIMA frase della risposta quando le fonti sono davvero insufficienti. Se hai risposto utilmente citando [1] [2] [3], NON aggiungere mai il disclaimer in coda — è contraddittorio.
- **Verifica delle premesse**: se la domanda contiene un'affermazione (data, nome, sentenza, importo) che NON compare nelle FONTI, segnalalo apertamente in apertura: "Non trovo conferma di X nelle fonti del corpus" — poi prosegui solo su ciò che le fonti supportano.
- Se rilevi un sotto-pagamento o anomalia (es. tariffa oraria estratta vs tariffa CCNL), segnalalo con "⚠️ POSSIBILE ANOMALIA:" all'inizio del paragrafo.
- Usa il "Tu" diretto con il consulente che ti interroga.
- Niente preamboli inutili. Vai dritto al punto.`;

// ============================================================
// Hook
// ============================================================

export function useRagAvvocato() {
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sources, setSources] = useState<RagSource[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStreamingAnswer('');
    setSources([]);
    setError(null);
    setIsAsking(false);
    abortRef.current = null;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const ask = useCallback(
    async (query: string, options: AskOptions = {}): Promise<void> => {
      if (isAsking) throw new Error('Richiesta già in corso');
      if (!query.trim()) return;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsAsking(true);
      setError(null);
      setStreamingAnswer('');
      setSources([]);

      try {
        // ── 1. Health check (fail-fast con UX chiara) ─────
        const health = await ollamaHealthCheck();
        if (!health.ok) {
          throw new Error('Ollama non raggiungibile. Avvialo in locale (`ollama serve`).');
        }
        if (!health.hasEmbedding) {
          throw new Error('Modello "nomic-embed-text" mancante (esegui: ollama pull nomic-embed-text).');
        }
        if (!health.hasLlm) {
          throw new Error('Modello "qwen3.6:35b" mancante (esegui: ollama pull qwen3.6:35b).');
        }

        // ── 2. Query expansion con worker context ──────────
        const expanded = expandQuery(query, options);

        // ── 3. Embedding query ─────────────────────────────
        const queryEmbedding = await ollamaEmbed(expanded);

        // ── 4. Similarity search ───────────────────────────
        const ccnl_filter =
          options.ccnl_filter !== undefined
            ? options.ccnl_filter
            : options.worker?.profilo
            ? PROFILO_TO_CCNL_REF[options.worker.profilo] ?? null
            : null;

        const retrieved = await matchLegalChunks(queryEmbedding, {
          threshold: options.threshold ?? 0.7,
          k: options.k ?? 5,
          ccnl_filter,
        });

        // Se non c'è nulla con il filtro CCNL, riprova senza filtro
        // (fallback su tutto il corpus — meglio una risposta debole che nessuna).
        let finalSources = retrieved;
        if (retrieved.length === 0 && ccnl_filter) {
          finalSources = await matchLegalChunks(queryEmbedding, {
            threshold: options.threshold ?? 0.7,
            k: options.k ?? 5,
            ccnl_filter: null,
          });
        }
        setSources(finalSources);

        // ── 5. Costruzione prompt + streaming ──────────────
        const messages = buildMessages(query, options, finalSources);

        let assembled = '';
        const stream = ollamaChatStream(messages, { temperature: 0.2, signal: ctrl.signal });
        for await (const tok of stream) {
          assembled += tok;
          setStreamingAnswer(assembled);
        }

        // ── 6. Log non-bloccante ───────────────────────────
        void logLegalQuery({
          query_text: query,
          query_embedding: queryEmbedding,
          retrieved_chunk_ids: finalSources.map(s => s.chunk_id),
          llm_answer: assembled,
          worker_id: undefined, // il caller può passarlo via options in futuro
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setError('Risposta annullata.');
        } else {
          setError(e?.message ?? String(e));
        }
        throw e;
      } finally {
        setIsAsking(false);
        abortRef.current = null;
      }
    },
    [isAsking]
  );

  return { ask, streamingAnswer, sources, isAsking, error, abort, reset };
}

// ============================================================
// Helpers
// ============================================================

function expandQuery(query: string, opts: AskOptions): string {
  const parts: string[] = [];

  if (opts.worker?.profilo) {
    const ccnl = PROFILO_TO_CCNL_REF[opts.worker.profilo];
    parts.push(`Profilo lavoratore: ${opts.worker.profilo}${ccnl ? ` (CCNL ${ccnl})` : ''}`);
    if (opts.worker.eliorType) parts.push(`Variante: ${opts.worker.eliorType}`);
  }

  if (opts.monthContext) {
    parts.push(`Periodo di riferimento: mese ${opts.monthContext.month}/${opts.monthContext.year}`);
  }

  if (parts.length === 0) return query;
  return `${query}\n\nContesto: ${parts.join('; ')}`;
}

function buildMessages(
  query: string,
  opts: AskOptions,
  sources: RagSource[]
): ChatMessage[] {
  const lines: string[] = [SYSTEM_PROMPT_BASE, ''];

  // Contesto worker
  if (opts.worker?.cognome || opts.worker?.profilo) {
    lines.push('[CONTESTO LAVORATORE]');
    if (opts.worker.cognome) lines.push(`- Lavoratore: ${opts.worker.cognome} ${opts.worker.nome ?? ''}`.trim());
    if (opts.worker.profilo) {
      const ccnl = PROFILO_TO_CCNL_REF[opts.worker.profilo];
      lines.push(`- Profilo: ${opts.worker.profilo}${ccnl ? ` — CCNL ${ccnl}` : ''}`);
    }
    if (opts.worker.eliorType) lines.push(`- Variante: ${opts.worker.eliorType}`);
    if (opts.monthContext) lines.push(`- Mese: ${opts.monthContext.month}/${opts.monthContext.year}`);
    lines.push('');
  }

  // Fonti
  if (sources.length === 0) {
    lines.push('[FONTI LEGALI RILEVANTI]');
    lines.push('Nessun documento rilevante trovato nel corpus indicizzato.');
    lines.push('Rispondi solo se sei sicuro, altrimenti dichiara che il corpus non copre il tema.');
    lines.push('');
  } else {
    lines.push('[FONTI LEGALI RILEVANTI — usa SOLO queste, non inventare riferimenti diversi]');
    sources.forEach((s, i) => {
      const num = i + 1;
      const header = [s.doc_title, s.section_ref, s.doc_source_ref].filter(Boolean).join(' · ');
      lines.push(`[${num}] ${header}`);
      lines.push(`    ${truncate(s.content, 600)}`);
      lines.push(`    (similarity: ${s.similarity.toFixed(2)})`);
    });
    lines.push('');
  }

  lines.push('[DOMANDA]');
  lines.push(query.trim());

  return [
    { role: 'system', content: lines.join('\n') },
    { role: 'user', content: query.trim() },
  ];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + '…';
}
