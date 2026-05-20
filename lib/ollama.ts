// ============================================================
// lib/ollama.ts
// Wrapper per Ollama localhost (Phase 1 RAG Local-First).
// Tutte le chiamate partono DAL BROWSER verso http://localhost:11434.
// Per CORS: l'utente deve avviare Ollama con OLLAMA_ORIGINS che includa
// l'origin del frontend (dev: http://localhost:5173; prod: il deploy domain).
// ============================================================

const OLLAMA_BASE_URL =
  (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) ?? 'http://localhost:11434';

export const OLLAMA_MODELS = {
  embedding: 'nomic-embed-text',
  llm: 'qwen3.6:35b',
} as const;

// Numero di chunk processati in parallelo durante l'embedding batch.
// Bilancia velocità e stabilità della queue interna di Ollama.
const DEFAULT_EMBED_CONCURRENCY = 6;

// ============================================================
// Errori dedicati per UI graceful degradation
// ============================================================

export class OllamaUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('Ollama non raggiungibile su ' + OLLAMA_BASE_URL);
    this.name = 'OllamaUnreachableError';
    if (cause) (this as any).cause = cause;
  }
}

export class OllamaModelMissingError extends Error {
  constructor(public readonly model: string) {
    super(`Modello "${model}" non installato in Ollama (esegui: ollama pull ${model})`);
    this.name = 'OllamaModelMissingError';
  }
}

// ============================================================
// Health check
// ============================================================

export interface OllamaHealth {
  ok: boolean;
  models: string[];
  hasEmbedding: boolean;
  hasLlm: boolean;
}

export async function ollamaHealthCheck(timeoutMs = 3000): Promise<OllamaHealth> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, models: [], hasEmbedding: false, hasLlm: false };

    const data: { models?: Array<{ name: string }> } = await res.json();
    const models = (data.models ?? []).map(m => m.name);
    return {
      ok: true,
      models,
      hasEmbedding: models.some(m => m.startsWith(OLLAMA_MODELS.embedding)),
      hasLlm: models.some(m => m === OLLAMA_MODELS.llm || m.startsWith(OLLAMA_MODELS.llm + ':')),
    };
  } catch {
    return { ok: false, models: [], hasEmbedding: false, hasLlm: false };
  }
}

// ============================================================
// Embedding singolo
// ============================================================

export async function ollamaEmbed(
  text: string,
  model: string = OLLAMA_MODELS.embedding
): Promise<number[]> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
  } catch (e) {
    throw new OllamaUnreachableError(e);
  }

  if (!res.ok) {
    if (res.status === 404) throw new OllamaModelMissingError(model);
    throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  }

  const data: { embedding?: number[] } = await res.json();
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error('Risposta Ollama embed senza campo "embedding"');
  }
  return data.embedding;
}

// ============================================================
// Embedding batch parallelo (per ingestion)
// Niente throttling: gira in locale, il limite è hardware.
// ============================================================

export interface EmbedBatchOptions {
  model?: string;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export async function ollamaEmbedBatch(
  texts: string[],
  options: EmbedBatchOptions = {}
): Promise<number[][]> {
  const {
    model = OLLAMA_MODELS.embedding,
    concurrency = DEFAULT_EMBED_CONCURRENCY,
    onProgress,
    signal,
  } = options;

  const results: number[][] = new Array(texts.length);
  let nextIndex = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const i = nextIndex++;
      if (i >= texts.length) return;
      results[i] = await ollamaEmbed(texts[i], model);
      done++;
      onProgress?.(done, texts.length);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================
// Chat completion (non-streaming)
// ============================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

export async function ollamaChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { model = OLLAMA_MODELS.llm, temperature = 0.2, signal } = options;

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature },
      }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new OllamaUnreachableError(e);
  }

  if (!res.ok) {
    if (res.status === 404) throw new OllamaModelMissingError(model);
    throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
  }

  const data: { message?: { content?: string } } = await res.json();
  return data.message?.content ?? '';
}

// ============================================================
// Chat completion streaming (NDJSON)
// Usa async generator per push token-by-token nella UI.
// ============================================================

export async function* ollamaChatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string, void, void> {
  const { model = OLLAMA_MODELS.llm, temperature = 0.2, signal } = options;

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature },
      }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new OllamaUnreachableError(e);
  }

  if (!res.ok || !res.body) {
    if (res.status === 404) throw new OllamaModelMissingError(model);
    throw new Error(`Ollama chat stream failed: ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // NDJSON: ogni riga = un JSON object
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        try {
          const parsed: { message?: { content?: string }; done?: boolean } = JSON.parse(line);
          const chunk = parsed.message?.content;
          if (chunk) yield chunk;
          if (parsed.done) return;
        } catch {
          // Riga JSON malformata: ignora e continua (resilienza)
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
