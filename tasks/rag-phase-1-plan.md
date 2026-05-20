# Phase 1 — Piano Operativo MVP RAG (Local-First)

> **Documento**: piano tattico, derivato da `tasks/rag-architecture.md` rev. 2 (Ollama locale).
> **Target**: 1-2 settimane di sviluppo end-to-end → primo demo interno funzionante.
> **Stack**: Browser client TypeScript ↔ Ollama localhost:11434 ↔ Supabase (pgvector + Storage).
> **Branch attiva**: `feat/rag-mvp`
> **Status setup**: Ollama + qwen3.6:35b + nomic-embed-text verificati ✅

---

## Context Alignment — Il "Sacro Graal" (Caso Lecce vs Elior)

L'obiettivo finale dell'Avvocato Virtuale, raccontato sul caso reale:

> Tra novembre 2017 e luglio 2023, Elior Ristorazione S.p.A. ha pagato ai lavoratori l'indennità di "assenza dalla residenza" con tariffa oraria **0,75 €** (servizi senza riposo). Il CCNL applicabile prevede **1,30 €**. Il ricorso ex art. 414 c.p.c. al Tribunale di Lecce chiede il recupero delle differenze retributive (€0,55/h × ore × mesi × lavoratori).

### Implicazione architetturale: DOPPIA NATURA DEI DATI

Da oggi in poi, ogni dato estratto da una busta paga ha due usi distinti:

| Dato | Uso "matematico" (esistente) | Uso "audit RAG" (nuovo) |
|------|------------------------------|--------------------------|
| Importo totale voce (es. €123.45 codice 4300) | `computeHolidayIndemnity` usa il totale per la media ferie | — |
| **Valore unitario** (es. €0.75/h della voce 4300) | — | Confrontato con €1.30/h legale → anomalia |
| **Quantità** (es. 164 ore per la voce 4300) | — | Usato come moltiplicatore differenza |
| Codice voce (es. "4300") | Mappato a `ColumnDef.id` per cella tabella | Cercato come `section_ref` nei chunks CCNL |

**Cosa NON cambia in Phase 1 RAG MVP**:
- L'infrastruttura RAG che stiamo costruendo è **agnostica** rispetto a questo: indicizziamo documenti legali e facciamo retrieval, niente di più.
- Lo schema `legal_chunks` non viene modificato.

**Cosa cambierà DOPO il MVP RAG** (Phase 2/3, da pianificare separatamente):
- Arricchire `PROMPT_RFI` / `PROMPT_CLEAN_SERVICE` / `PROMPT_ELIOR` (e `scan-payslip.ts`) per estrarre **anche** `valore_unitario` e `quantità` per ogni codice voce, non solo l'importo totale. Probabile nuova chiave JSON tipo `codes_detail: { "4300": { totale: 123.45, valore_unitario: 0.75, quantita: 164.6 } }`.
- L'Avvocato Virtuale, dopo retrieval del CCNL, confronterà `valore_unitario` estratto vs valore CCNL → segnala anomalia con calcolo della differenza recuperabile.

**Decisione architetturale per Phase 1**: il `metadata` JSONB di `legal_chunks` rimane libero → quando in futuro popolerò chunk CCNL con `{ "rates": { "indennita_assenza_residenza_h": 1.30, "unit": "EUR/ora" } }`, il sistema sarà pronto a usarli senza ulteriori migration. **Schema future-proof confermato**.

---

## ✅ Decisioni acquisite (5 risposte definitive ricevute)

1. **Tag Ollama LLM**: `qwen3.6:35b` (verificato presente sulla macchina: 36B params, Q4_K_M, 23.94 GB)
2. **Tag Ollama Embedding**: `nomic-embed-text` (768 dim, 270 MB, sanity test OK con `prompt: "indennità di assenza dalla residenza CCNL Multiservizi"` → ritorna vector di 768 dimensioni)
3. **Corpus seed**: PDF già pronti sul Mac dell'utente, sarà lui a caricarli via UI admin
4. **Admin role**: bootstrap iniziale via **service_role key** (bypass RLS). JWT claim `role='admin'` posticipato a Phase 2.
5. **Surface UI**: Dynamic Island Spotlight **+** modale "Avvocato Virtuale" dedicato (decisione UI di dettaglio: il modale è per query lunghe/strutturate, lo Spotlight per quick-ask). Vedi §UI di seguito.
6. **Topologia**: single-user, tutto in locale sul Mac dell'utente.

---

---

## 0. Prerequisiti hardware/setup

### 0.1 Macchina dello sviluppatore (host Ollama)
- **RAM/VRAM**: ≥ 24 GB libera per `qwen3.6:35b` (Q4 quantizzato ~22 GB)
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
ollama pull qwen3.6:35b            # ~22 GB — verifica il tag esatto su https://ollama.com/library

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
  "model": "qwen3.6:35b",
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

### Step 1 — Setup ambiente ✅ COMPLETATO (2026-05-17)
- [x] Ollama running su localhost:11434
- [x] `qwen3.6:35b` installato (36B, Q4_K_M, 23.94 GB)
- [x] `nomic-embed-text:latest` installato (270 MB)
- [x] Sanity test embedding: ritorna 768 dim correttamente
- [x] Branch `feat/rag-mvp` aperta (su `main` clean)
- [ ] **TODO utente**: config `OLLAMA_ORIGINS="http://localhost:5173"` (o `"*"` per dev) + restart Ollama → solo se in fase di test browser-side appare errore CORS

### Step 2 — Migration DB ✅ FILE PRONTI (esecuzione richiesta utente)
- [x] File `supabase/migrations/001_enable_pgvector.sql` creato
- [x] File `supabase/migrations/002_legal_corpus_schema.sql` creato
- [x] File `supabase/migrations/003_rls_policies.sql` creato
- [x] File `supabase/migrations/004_match_legal_chunks_rpc.sql` creato
- [ ] **TODO utente**: applicare le 4 migration su Supabase (vedi §Esecuzione migration sotto)
- [ ] **TODO utente**: creare bucket `legal-corpus` privato (vedi §1.5 di questo doc)
- [ ] **Smoke test post-migration**: insert manuale di 1 chunk dummy con embedding random, verifica RPC ritorna risultato (Step 2 verifica finale)

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

## 7. Decisioni residue — ✅ TUTTE RISOLTE

Vedi sezione "Decisioni acquisite" in testa al documento.

---

## 8. Esecuzione migration SQL — istruzioni per l'utente

Le 4 migration sono pronte nella cartella `supabase/migrations/`. Per applicarle, **scegli uno dei due metodi**:

### Metodo A — Supabase Dashboard SQL Editor (più semplice)

1. Vai su https://supabase.com/dashboard → seleziona il progetto RailFlow
2. Sidebar → **SQL Editor** → **New query**
3. Apri il primo file `001_enable_pgvector.sql`, copia il contenuto, incolla nell'editor, premi **Run**
4. Ripeti per `002`, `003`, `004` (in ordine!)
5. Verifica esito: ogni Run mostra "Success. No rows returned" o conteggi simili

### Metodo B — Supabase CLI (se la hai configurata)

```bash
# Dalla root del progetto
supabase db push --linked
# Oppure se non hai linked il progetto:
supabase link --project-ref <your-project-ref>
supabase db push
```

### Step finale (entrambi i metodi)

Crea il bucket Storage:
1. Dashboard → **Storage** → **New bucket**
2. Nome: `legal-corpus`
3. Public: **NO** (privato)
4. Allowed MIME types: `application/pdf`
5. Max file size: `50 MB`

### Smoke test post-migration

Dalla Supabase Dashboard SQL Editor, esegui:

```sql
-- 1. Verifica pgvector
SELECT extversion FROM pg_extension WHERE extname = 'vector';
-- Atteso: 0.7.x o superiore

-- 2. Verifica tabelle
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'legal_%';
-- Atteso: legal_documents, legal_chunks, legal_queries

-- 3. Verifica indici HNSW
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'legal_chunks';
-- Atteso: idx_legal_chunks_document_id, idx_legal_chunks_embedding_hnsw, e PK

-- 4. Verifica RPC esiste
SELECT proname FROM pg_proc WHERE proname = 'match_legal_chunks';
-- Atteso: 1 riga "match_legal_chunks"

-- 5. (Opzionale) Inserto dummy + similarity test
-- Eseguire solo per verifica, poi rollback:
BEGIN;
  INSERT INTO legal_documents (title, doc_type, embedding_model)
  VALUES ('DUMMY TEST', 'altro', 'nomic-embed-text')
  RETURNING id \gset
  INSERT INTO legal_chunks (document_id, chunk_index, content, embedding)
  VALUES (:'id', 0, 'test contenuto',
          (SELECT array_to_string(ARRAY(SELECT random()::text FROM generate_series(1, 768)), ',')::vector);
  -- Test RPC (passando un embedding random)
  SELECT chunk_id, similarity FROM match_legal_chunks(
    (SELECT embedding FROM legal_chunks WHERE document_id = :'id'),
    0.0, 5, NULL
  );
ROLLBACK;
```

Appena confermi che le migration sono andate a buon fine, procederemo con lo **Step 3 — Implementazione `lib/ollama.ts`, `lib/pdfChunker.ts`, `lib/ragRepository.ts`**.
