# Phase 1 — Piano Operativo MVP RAG (Local-First)

> **Documento**: piano tattico, derivato da `tasks/rag-architecture.md` rev. 2 (Ollama locale).
> **Target**: 1-2 settimane di sviluppo end-to-end → primo demo interno funzionante.
> **Stack**: Browser client TypeScript ↔ Ollama localhost:11434 ↔ Supabase (pgvector + Storage).

---

## 0. Prerequisiti hardware/setup

### 0.1 Macchina dello sviluppatore (host Ollama)
- **RAM/VRAM**: ≥ 24 GB libera per `qwen3:35b` (Q4 quantizzato ~22 GB)
- **Disco**: ≥ 30 GB liberi (modelli + cache)
- **OS**: macOS / Linux / Windows (Ollama supporta tutti)
- **Connessione internet**: solo per download iniziale modelli + chiamate Supabase

### 0.2 Comandi setup Ollama (one-shot)

```bash
# 1. Installa Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: scarica installer da https://ollama.com/download

# 2. Avvia il daemon (auto-start su macOS, manuale altrove)
ollama serve  # listening su 0.0.0.0:11434 di default

# 3. Pull dei modelli necessari
ollama pull nomic-embed-text     # ~270 MB
ollama pull qwen3:35b            # ~22 GB — verifica il tag esatto su https://ollama.com/library

# 4. Verifica installazione
ollama list                       # deve mostrare entrambi i modelli
curl http://localhost:11434/api/tags  # endpoint deve rispondere

# 5. Test embedding (sanity check)
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "Test indennità di disagio"
}'
# Risposta attesa: { "embedding": [768 numeri float] }

# 6. Test chat (sanity check)
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:35b",
  "messages": [{"role": "user", "content": "In una frase, cos'è il CCNL Multiservizi?"}],
  "stream": false
}'
```

### 0.3 CORS — abilitare l'accesso dal browser RailFlow

Ollama di default accetta richieste solo da `localhost` con CORS restrittivo. Per consentire al frontend Vite (`http://localhost:5173`) o al deploy Netlify (`https://railflow.netlify.app`) di chiamare Ollama:

```bash
# macOS (launchd):
launchctl setenv OLLAMA_ORIGINS "http://localhost:5173,https://railflow.netlify.app"
# Restart Ollama dopo questo comando

# Linux (systemd):
sudo systemctl edit ollama
# Aggiungi: Environment="OLLAMA_ORIGINS=http://localhost:5173,https://railflow.netlify.app"
sudo systemctl restart ollama

# Windows:
# Imposta variabile di sistema OLLAMA_ORIGINS, poi restart Ollama

# Sviluppo rapido (NON in produzione):
export OLLAMA_ORIGINS="*"
ollama serve
```

### 0.4 Documentazione utente
Aggiungere `docs/setup-rag-local.md` con questi step + screenshot. Mostrare nella UI un wizard "Primo avvio Avvocato Virtuale" che linki il doc.

---

## 1. Migration SQL Supabase

### 1.1 Migration `001_enable_pgvector.sql`

```sql
-- Abilita estensione pgvector (pgvector >= 0.5 per HNSW)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verifica versione (opzionale)
-- SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

Eseguire dalla Supabase Dashboard → SQL Editor (o `supabase db push` se usi CLI).

### 1.2 Migration `002_legal_corpus_schema.sql`

```sql
-- Tabella documenti legali
CREATE TABLE legal_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  doc_type        text NOT NULL CHECK (doc_type IN ('ccnl', 'sentenza', 'interpello', 'circolare', 'dottrina', 'altro')),
  source_ref      text,
  storage_path    text,
  ccnl_ref        text,
  doc_date        date,
  metadata        jsonb DEFAULT '{}'::jsonb,
  embedding_model text NOT NULL DEFAULT 'nomic-embed-text',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_legal_documents_doc_type ON legal_documents (doc_type);
CREATE INDEX idx_legal_documents_ccnl_ref ON legal_documents (ccnl_ref) WHERE ccnl_ref IS NOT NULL;
CREATE INDEX idx_legal_documents_metadata ON legal_documents USING GIN (metadata);

-- Tabella chunks con embeddings 768-dim (nomic-embed-text)
CREATE TABLE legal_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  chunk_index     int NOT NULL,
  content         text NOT NULL,
  section_ref     text,
  token_count     int,
  embedding       vector(768) NOT NULL,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_legal_chunks_document_id ON legal_chunks (document_id);

-- Indice HNSW per cosine similarity
CREATE INDEX idx_legal_chunks_embedding_hnsw
  ON legal_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Tabella log query
CREATE TABLE legal_queries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  worker_id            uuid REFERENCES workers(id) ON DELETE SET NULL,
  query_text           text NOT NULL,
  query_embedding      vector(768),
  retrieved_chunk_ids  uuid[],
  llm_answer           text,
  feedback_score       smallint,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_legal_queries_user_id ON legal_queries (user_id);
CREATE INDEX idx_legal_queries_created_at ON legal_queries (created_at DESC);
```

### 1.3 Migration `003_rls_policies.sql`

```sql
-- legal_documents: read pubblico per authenticated, write solo admin
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

-- legal_chunks: identico a documents
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

-- legal_queries: utente vede e scrive solo le proprie
ALTER TABLE legal_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_queries_select"
  ON legal_queries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_own_queries_insert"
  ON legal_queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**Nota Phase 1 sull'admin role**: se la decisione sul JWT claim `role = 'admin'` non è ancora presa (domanda §9.3 dell'architettura), per il MVP usiamo temporaneamente la **service_role key** lato seed script (vedi §3.4 sotto), bypassando RLS per il bootstrap iniziale. Le query degli utenti finali useranno la anon key con read-only.

### 1.4 Migration `004_match_legal_chunks_rpc.sql`

```sql
-- RPC esposta al client per similarity search con pre-filter opzionale
CREATE OR REPLACE FUNCTION match_legal_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  ccnl_filter text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  section_ref text,
  doc_title text,
  doc_source_ref text,
  doc_type text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.content,
    c.section_ref,
    d.title AS doc_title,
    d.source_ref AS doc_source_ref,
    d.doc_type,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM legal_chunks c
  JOIN legal_documents d ON c.document_id = d.id
  WHERE
    (ccnl_filter IS NULL OR d.ccnl_ref = ccnl_filter)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Permesso esecuzione per utenti autenticati
GRANT EXECUTE ON FUNCTION match_legal_chunks TO authenticated;
```

### 1.5 Storage bucket

Dalla Supabase Dashboard → Storage → New bucket:
- **Nome**: `legal-corpus`
- **Public**: No (privato)
- **Allowed MIME types**: `application/pdf` (Phase 1; estensibile a `.docx`/`.txt` in Phase 2)
- **Max file size**: 50 MB
- **RLS policy**:
  - SELECT: tutti gli authenticated
  - INSERT/UPDATE/DELETE: solo admin (stesso pattern delle tabelle)

---

## 2. Codice client-side — file da creare

### 2.1 `lib/ollama.ts` — wrapper Ollama localhost

**Responsabilità**: incapsula tutte le chiamate a Ollama, gestisce errori e fallback graceful.

Signature proposte:

```typescript
// Health check al mount dell'app
export async function ollamaHealthCheck(): Promise<{ ok: boolean; models: string[] }>;

// Embedding singolo
export async function ollamaEmbed(text: string, model = 'nomic-embed-text'): Promise<number[]>;

// Embedding batch in parallelo (concurrency configurabile)
export async function ollamaEmbedBatch(
  texts: string[],
  options?: { model?: string; concurrency?: number; onProgress?: (done: number, total: number) => void }
): Promise<number[][]>;

// Chat completion non-streaming
export async function ollamaChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number }
): Promise<string>;

// Chat completion streaming (per UI typewriter)
export async function* ollamaChatStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number; signal?: AbortSignal }
): AsyncGenerator<string, void, void>;
```

Costanti d'ambiente: `OLLAMA_BASE_URL` (default `http://localhost:11434`), override via Vite env `VITE_OLLAMA_BASE_URL`.

### 2.2 `lib/pdfChunker.ts` — parser PDF + chunking

**Dipendenze**: `pdfjs-dist` (web build).

Signature:

```typescript
// Estrae testo + page metadata da un PDF
export async function extractPdfText(file: File | Blob): Promise<Array<{ page: number; text: string }>>;

// Chunking strategy router per doc_type
export function chunkDocument(
  pages: Array<{ page: number; text: string }>,
  docType: 'ccnl' | 'sentenza' | 'interpello' | 'circolare' | 'dottrina' | 'altro'
): Array<{ content: string; section_ref: string; token_count: number; chunk_index: number; metadata: any }>;

// Helper conteggio token (rough: text.length / 4)
export function estimateTokens(text: string): number;
```

**Phase 1 simplification**: implementare solo strategia `slidingWindow` (chunk 800 tok overlap 100) per tutti i `doc_type`. Strategie per-type vanno in Phase 2.

### 2.3 `lib/ragRepository.ts` — wrapper Supabase per RAG

**Responsabilità**: CRUD su `legal_documents` e `legal_chunks`, RPC `match_legal_chunks`, insert `legal_queries`.

Signature:

```typescript
// Upload PDF a Storage bucket
export async function uploadLegalPdf(file: File, docType: string, slug: string): Promise<{ storage_path: string }>;

// Insert metadata documento (ritorna id)
export async function insertLegalDocument(data: {
  title: string;
  doc_type: string;
  source_ref?: string;
  storage_path?: string;
  ccnl_ref?: string;
  doc_date?: string;
  metadata?: any;
  embedding_model?: string;
}): Promise<string>;

// Bulk insert chunks
export async function insertLegalChunks(
  document_id: string,
  chunks: Array<{ chunk_index: number; content: string; section_ref?: string; token_count?: number; embedding: number[]; metadata?: any }>
): Promise<void>;

// Verifica chunks già presenti (per idempotenza retry)
export async function getExistingChunkIndices(document_id: string): Promise<number[]>;

// Similarity search via RPC
export async function matchLegalChunks(
  query_embedding: number[],
  options?: { threshold?: number; k?: number; ccnl_filter?: string }
): Promise<Array<{ chunk_id: string; document_id: string; content: string; section_ref: string; doc_title: string; doc_source_ref: string; doc_type: string; similarity: number }>>;

// Log query per analytics
export async function logLegalQuery(data: {
  query_text: string;
  query_embedding: number[];
  retrieved_chunk_ids: string[];
  llm_answer: string;
  worker_id?: string;
}): Promise<void>;
```

### 2.4 `hooks/useRagIngestion.ts` — hook pipeline ingestion

**Uso target**:
```tsx
const { ingestDocument, progress, isIngesting, error } = useRagIngestion();
// Nel form admin:
await ingestDocument(file, { title, doc_type, source_ref, ccnl_ref, doc_date });
```

Step interni (orchestra `lib/*`):
1. `uploadLegalPdf` → ottiene `storage_path`
2. `insertLegalDocument` → ottiene `document_id`
3. `extractPdfText(file)`
4. `chunkDocument(pages, doc_type)`
5. `getExistingChunkIndices(document_id)` → filtra chunks già presenti (resume)
6. `ollamaEmbedBatch(contents, { concurrency: 6, onProgress })` → array di embeddings
7. `insertLegalChunks(document_id, chunksWithEmbeddings)` in batch da 50
8. Notifica completamento via Dynamic Island

Gestione errori:
- Ollama offline → mostra UI con istruzioni setup, blocca pipeline
- Parse PDF fallisce (scansionato) → suggerisce OCR pre-processing
- Insert Supabase fallisce → retry esponenziale 3 volte, poi errore esplicito

### 2.5 `hooks/useRagAvvocato.ts` — hook query+risposta

**Uso target**:
```tsx
const { ask, streamingAnswer, sources, isAsking, abort } = useRagAvvocato({ worker });
// Nel Dynamic Island Spotlight:
await ask("Posso contestare il codice 8019?");
// streamingAnswer si aggiorna token-per-token
// sources = array dei chunks usati (per UI citations)
```

Step interni:
1. Espandi `query` con worker context (profilo CCNL, codici attivi)
2. `ollamaEmbed(expandedQuery)` → query_embedding
3. `matchLegalChunks(query_embedding, { ccnl_filter: worker.profilo === 'CLEAN_SERVICE' ? 'Multiservizi' : ... })`
4. Costruisci `systemPrompt` con BASE + contesto + fonti numerate
5. `ollamaChatStream(messages, { temperature: 0.2 })` → push token in state
6. Al completamento: `logLegalQuery(...)` per analytics
7. Parse output per estrarre citazioni `[1] [2] [3]` → mapping a chunks

### 2.6 `components/RagAdminPanel.tsx` — UI admin (minimal Phase 1)

Form drag-and-drop PDF + campi metadata + progress bar. Lista documenti già indicizzati (lettura da `legal_documents`). Bottone "Reindicizza" per singolo doc.

### 2.7 Wiring Dynamic Island

Modificare `DynamicIsland.tsx` (chiamante esistente di `ask-ai`) per:
- Health check Ollama al mount → badge stato
- Sostituire fetch a `ask-ai.ts` (cloud Gemini) con chiamata a `useRagAvvocato.ask()`
- Mostrare le citazioni come footer cliccabili sotto la risposta

**`ask-ai.ts` cloud**: lo lasciamo in vita come fallback (es. "se Ollama è offline, vuoi una risposta meno accurata via cloud?"). Phase 2 valutiamo se dismetterlo.

---

## 3. Step di implementazione ordinati

### Step 1 — Setup ambiente (1 giorno)
- [ ] Install Ollama + pull `nomic-embed-text` + `qwen3:35b` (verifica tag esatto!)
- [ ] Config `OLLAMA_ORIGINS` per il dev domain
- [ ] Test manuale endpoint con `curl` (sanity check §0.2)
- [ ] Branch `git checkout -b feat/rag-mvp`

### Step 2 — Migration DB (mezza giornata)
- [ ] Eseguire migration `001` (pgvector extension)
- [ ] Eseguire migration `002` (schema tabelle + indici HNSW)
- [ ] Eseguire migration `003` (RLS policies)
- [ ] Eseguire migration `004` (RPC match_legal_chunks)
- [ ] Creare bucket `legal-corpus` da Dashboard
- [ ] Smoke test: insert manuale di 1 chunk dummy con embedding random, verifica RPC ritorna risultato

### Step 3 — Lib base (1-2 giorni)
- [ ] Implementare `lib/ollama.ts` con tutte le signature §2.1 + test unit
- [ ] Implementare `lib/pdfChunker.ts` con `pdfjs-dist` + chunking sliding window + test unit
- [ ] Implementare `lib/ragRepository.ts` con wrapper Supabase + test integrazione

### Step 4 — Ingestion (1 giorno)
- [ ] Implementare `useRagIngestion` hook
- [ ] Implementare `RagAdminPanel` minimal (un solo form + tabella documenti)
- [ ] Aggiungere route admin (`/admin/rag` o overlay nel Settings)
- [ ] Test E2E: upload PDF → verifica chunks in DB + similarity query manuale

### Step 5 — Retrieval + Generation (2 giorni)
- [ ] Implementare `useRagAvvocato` hook con streaming
- [ ] Wiring `DynamicIsland` (sostituzione progressiva `ask-ai` cloud)
- [ ] UI citazioni come footer cliccabile (apertura PDF dal bucket via signed URL)
- [ ] Health check Ollama + badge stato nel topbar

### Step 6 — Bootstrap corpus (1 giorno)
- [ ] Reperire 5-10 PDF seed (vedi §4)
- [ ] Indicizzare ciascuno via UI admin
- [ ] Verifica che la similarity search restituisca risultati ragionevoli su query test

### Step 7 — Demo + raccolta feedback (mezza giornata)
- [ ] 5 query test predefinite con criteri di accettazione
- [ ] Misurazione latenza end-to-end
- [ ] Documentazione setup utente in `docs/setup-rag-local.md`

**Totale stimato**: **7-8 giorni di sviluppo effettivo** → realisticamente 1.5-2 settimane calendario.

---

## 4. Corpus seed Phase 1 (TBD con utente)

5-10 PDF prioritari da indicizzare per il MVP. **Da concordare con te (vedi domanda §9.2 dell'architettura)**. Lista suggerita di partenza:

| # | Documento | Tipo | Priorità | Note |
|---|-----------|------|----------|------|
| 1 | CCNL Multiservizi (testo vigente) | ccnl | 🔴 Alta | Per Clean Service |
| 2 | CCNL Mobilità/Ferroviari Attività Ferroviarie | ccnl | 🔴 Alta | Per RFI |
| 3 | CCNL Ristorazione Collettiva | ccnl | 🔴 Alta | Per Elior |
| 4 | Cassazione Sez. Lavoro 20216/2022 | sentenza | 🔴 Alta | Già citata nel codice (RelazioneModal) |
| 5 | Costituzione Art. 36 (estratto + commento) | dottrina | 🟡 Media | Base giuridica indennità feriali |
| 6 | Cass. SS.UU. 14490/2007 (ferie e indennità) | sentenza | 🟡 Media | Sentenza chiave su retribuzione feriale |
| 7-10 | Sentenze di merito recenti (Tribunale/Appello) sui temi codici-busta-paga | sentenza | 🟢 Bassa | Da scegliere insieme |

---

## 5. Criteri di successo Phase 1

- [ ] `npx tsc --noEmit` → exit 0 con tutto il nuovo codice
- [ ] Indicizzazione completa di 5 PDF in < 5 minuti totali
- [ ] Query "indennità di disagio CCNL Multiservizi" ritorna top-3 chunks dal CCNL Multiservizi con similarity > 0.75
- [ ] Risposta LLM completa con citazioni in < 60 secondi end-to-end
- [ ] Citazione `[1]` nella risposta è cliccabile e apre il PDF sorgente alla pagina giusta
- [ ] Ollama offline → UI degrada con messaggio chiaro, no errori criptici
- [ ] Almeno 5 query test reali producono risposte fondate verificabili

---

## 6. Non-goals Phase 1 (esplicitamente fuori scope)

- Hybrid search BM25 + vector (Phase 2)
- Reranking cross-encoder (Phase 3)
- OCR locale per PDF scansionati (Phase 2/3)
- Multi-tenant Ollama LAN-shared (post-MVP)
- Migrazione `verify-payslip.ts` a Ollama (Phase 3)
- Strategia chunking specifica per `doc_type` (Phase 2)
- Admin role management completo via JWT (Phase 1 usa service_role per bootstrap)
- UI feedback thumbs up/down (Phase 2)

---

## 7. Decisioni residue ancora aperte (da chiarire prima di iniziare)

1. **Tag Ollama esatto di Qwen 3.6 35b** — verifica che `ollama pull qwen3:35b` (o variante) sia disponibile sulla tua macchina
2. **Corpus seed** — quali 5-10 PDF concreti? Hai già i file o vanno scaricati?
3. **Admin role per RLS** — service_role per Phase 1 OK?
4. **Surface UI** — innesto in Dynamic Island Spotlight (raccomandato) o modale dedicato "Avvocato Virtuale"?
5. **Topologia** — confermi single-user per Phase 1?

Appena rispondi, apriamo il branch `feat/rag-mvp` e partiamo dallo Step 1.
