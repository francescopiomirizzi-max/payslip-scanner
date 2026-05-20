# Sessione — RAG Local-First Phase 1 (Step 1 + Step 2)

> **Obiettivo:** mettere in piedi le fondamenta dell'Avvocato Virtuale RailFlow con stack 100% locale (Ollama + Supabase pgvector). Questa sessione copre solo i primi due step del piano operativo (setup ambiente + migration DB).
>
> **Riferimenti**: `tasks/rag-architecture.md` (architettura rev. 2 Local-First) e `tasks/rag-phase-1-plan.md` (piano tattico completo).
>
> **Branch**: `feat/rag-mvp` (creata da `main`).

## Context Alignment — Sacro Graal

Caso reale Tribunale di Lecce: Elior ha pagato indennità "assenza dalla residenza" a 0,75 €/h tra 2017-2023, contro 1,30 €/h previsto da CCNL. L'Avvocato Virtuale dovrà incrociare il **valore unitario** estratto dalla busta paga con la **tariffa legale** trovata nel CCNL via RAG, per segnalare il sotto-pagamento.

→ **Doppia natura dei dati**: i totali servono al calcolo matematico esistente; i valori unitari sono il nuovo dato critico per l'audit RAG. Lo schema `legal_chunks.metadata` JSONB è progettato future-proof per ospitare le rate legali estratte dai CCNL.

## Plan (approvato)

- [x] **Step 1.a** — Branch `feat/rag-mvp` creata
- [x] **Step 1.b** — Verifica Ollama running su `localhost:11434`
- [x] **Step 1.c** — Verifica `qwen3.6:35b` installato (36B, Q4_K_M, 23.94 GB)
- [x] **Step 1.d** — Pull `nomic-embed-text:latest` (270 MB) + sanity test embedding (ritorna 768 dim corretti)
- [x] **Step 2.a** — Scritto `supabase/migrations/001_enable_pgvector.sql`
- [x] **Step 2.b** — Scritto `supabase/migrations/002_legal_corpus_schema.sql` (tabelle + HNSW + trigger updated_at)
- [x] **Step 2.c** — Scritto `supabase/migrations/003_rls_policies.sql` (RLS docs/chunks/queries)
- [x] **Step 2.d** — Scritto `supabase/migrations/004_match_legal_chunks_rpc.sql` (RPC similarity search)
- [ ] **Step 2.e** — ⏳ **Da fare dall'utente**: applicare le 4 migration via Supabase Dashboard SQL Editor (istruzioni in `rag-phase-1-plan.md` §8)
- [ ] **Step 2.f** — ⏳ **Da fare dall'utente**: creare bucket Storage `legal-corpus` (privato, max 50 MB, MIME application/pdf)
- [ ] **Step 2.g** — ⏳ **Da fare dall'utente**: smoke test post-migration (script SQL in `rag-phase-1-plan.md` §8)
- [ ] **Step 2.h** — ⏳ **Eventuale**: config `OLLAMA_ORIGINS="http://localhost:5173"` se al primo test browser-side compare errore CORS

## File modificati / creati questa sessione

**Nuovi**:
- `supabase/migrations/001_enable_pgvector.sql`
- `supabase/migrations/002_legal_corpus_schema.sql`
- `supabase/migrations/003_rls_policies.sql`
- `supabase/migrations/004_match_legal_chunks_rpc.sql`

**Aggiornati**:
- `tasks/rag-phase-1-plan.md` — context alignment, 5 decisioni risolte, status step 1-2, istruzioni esecuzione migration, tag `qwen3.6:35b`
- `tasks/todo.md` (questo file)

## Review

### Stato infrastruttura locale

```
Ollama (localhost:11434):
  ✅ qwen3.6:35b        — LLM generazione (36B params, Q4_K_M, 23.94 GB)
  ✅ nomic-embed-text   — Embedding model (768 dim, 270 MB)

Git:
  ✅ branch feat/rag-mvp (off main, working tree clean)

Supabase:
  ⏳ migration da applicare (4 file SQL pronti)
  ⏳ bucket legal-corpus da creare
```

### Verifica embedding endpoint

```bash
curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"indennità di assenza dalla residenza CCNL Multiservizi"}'
# → embedding length: 768, first 4 dims: [1.3255, 0.3704, -3.0538, 1.6876]
```

✅ Output coerente con `vector(768)` dello schema in `002_legal_corpus_schema.sql`.

## Cosa serve dall'utente per sbloccare Step 3

1. Applicare le 4 migration SQL via Supabase Dashboard (vedi `rag-phase-1-plan.md` §8) → 5 minuti
2. Creare bucket Storage `legal-corpus` (privato, MIME pdf)
3. Eseguire smoke test SQL e confermare esito
4. Comunicare il go per Step 3 (implementazione `lib/ollama.ts`, `lib/pdfChunker.ts`, `lib/ragRepository.ts`)

## Step 3 — Lib client-side ✅ (turno precedente)

- `lib/ollama.ts` — health check, embed singolo/batch, chat, chatStream NDJSON
- `lib/pdfChunker.ts` — pdfjs-dist + sliding window 800 tok overlap 100
- `lib/ragRepository.ts` — Storage upload/signedUrl, CRUD documents/chunks, RPC match, log query

## Step 4 — Hook ingestion + UI admin ✅ (questo turno)

- [x] **Correzione modello**: tag `qwen3.6:35b` (era `qwen3.6:35b`) in `lib/ollama.ts` + 3 docs
- [x] **Migration `005_relax_rls.sql`**: DROP `admin_write_*` su `legal_documents`/`legal_chunks` + nuove policy `authenticated_*` aperte a INSERT/UPDATE/DELETE per qualsiasi authenticated. Stesso pattern per `storage.objects` bucket `legal-corpus`.
- [x] **`hooks/useRagIngestion.ts`**: orchestra pipeline 9-fase (health-check → upload → record → parse → chunking → resume support → embedding parallelo → bulk insert → done) con progress reporting granulare (`phase`, `percent`, `chunksDone/Total`, `message`), `abort()` via AbortController, `reset()` per UI cleanup.
- [x] **`components/RagAdminPanel.tsx`**: modale glassmorphism stile RailFlow con:
  - Header gradient indigo→violet→fuchsia + icona Sparkles animata
  - Health badge live (verde "Avvocato pronto" / rosso "Ollama offline" o "nomic-embed-text mancante")
  - Dropzone drag-and-drop PDF con stato visivo (idle / drag-over / file-selected)
  - Form metadata: title (auto-popolato da filename), source_ref, ccnl_ref, doc_date
  - Selettore tipo doc (CCNL/Sentenza/Interpello/Circolare/Dottrina/Altro) con icone Lucide
  - Progress bar live durante l'ingestion con messaggi per ogni fase
  - Lista documenti già indicizzati (auto-reload post-ingestion)
  - Button principale gradient + abort durante ingestion
- [x] `npx tsc --noEmit` → exit 0

## Cosa serve dall'utente per Step 5

1. **Verifica modello LLM**: `qwen3.6:35b` non risulta in `ollama list` (compaiono solo `nomic-embed-text` e `qwen3.6:35b`). Step 4 non lo richiede (l'ingestion usa solo embed), ma **Step 5 (chat/risposta) sì**. Da chiarire prima di Step 5: pull del modello mancante, oppure cambiare tag.
2. **Applicare migration 005** su Supabase via Dashboard SQL Editor (file `supabase/migrations/005_relax_rls.sql`).
3. **Wire-up `RagAdminPanel`**: il componente è standalone. Da decidere dove montarlo (proposta: nuova voce nel menu Dynamic Island, o overlay dal Settings panel, o route admin dedicata `/admin/rag`).
4. **Test ingestion E2E**: caricare 1 PDF reale (CCNL Multiservizi consigliato) e verificare che la pipeline arrivi a "done" con N chunks indicizzati.

## Out of scope (rispetto al piano completo Phase 1)

- Step 5: hook `useRagAvvocato` + wiring Dynamic Island Spotlight
- Step 6: bootstrap corpus seed (5-10 PDF reali)
- Step 7: demo + criteri di accettazione
- Estrazione valori unitari nei prompt OCR (`scan-payslip.ts`) → upgrade futuro, separato da Phase 1 RAG

---

# Sessione — Integrazione Profilo MERCITALIA (layout OCR ADP)

> Ultimo tassello dell'Epic "Espansione Profili Ferroviari". Mercitalia Shunting & Terminal
> è elaborata dal gestionale ADP (it-adp.com): gabbia grafica diversa da RFI/Trenitalia
> (SAP/Zucchetti) → prompt OCR proprietario, Master List a 4 cifre, regole geometriche ad hoc.

## Plan (approvato) — `~/.claude/plans/bubbly-swinging-cookie.md`

- [x] `scan-payslip.ts` — `PROMPT_MERCITALIA` (anatomia ADP §0–§11) + `PROMPT_DIRECTORY`
- [x] `verify-payslip.ts` — ramo `MERCITALIA` (marcatori grafici ADP, bypass asserzioni Zucchetti)
- [x] `types.ts` — `ProfiloAzienda` + `INDENNITA_MERCITALIA` (12 codici) + `getColumnsByProfile`
- [x] `usePayslipUpload.ts` — ticket isolati nella nota del mese (dicitura esatta), no tag generico
- [x] `scan-worker.ts` — riconoscimento azienda "Mercitalia" / framework ADP
- [x] `useRagAvvocato.ts` — `MERCITALIA → CCNL Mobilità/Ferroviari`
- [x] `WorkerModal.tsx` — `THEMES`/`OPTIONS`/`validCompanies` + icona `Truck`
- [x] Scatter UI (10 file) — badge/filtri colore ambra `#d97706` / `amber-*`

## Review

- **Master List**: 12 codici categorizzati — A) indennità presenza (1801, 1802, 1811, 1819,
  1879, 2331) · B) straordinario (2013, 2023, 2033, 2073) · C) festività (2263, 2293).
  Tutti colonne `currency`; il motore li somma nella media indennità (pattern RFI). I codici
  D (1723, 1733, 2469, 2501, 2502, 2512) confluiscono in `arretrati` via prompt, fuori da `codes`.
- **Ticket**: codici 3994/4001 → `count` + `ticketRate`. Nessuna colonna in `getColumnsByProfile`
  per MERCITALIA; `ticketRate → coeffTicket` resta (alimenta il calcolo buoni pasto). La nota
  esatta "Erogati N ticket restaurant da X€" è l'unica rappresentazione visiva.
- **TFR**: `imponibile_tfr_mensile` da "RETR.UTILE TFR" (pag. 2) solo a Dicembre, 0.0 Gen-Nov.
- **Verifiche**:
  - `npx tsc --noEmit` → exit 0
  - `npx vitest run` → 52/52 test passati, nessuna regressione
  - Audit `grep MERCITALIA` → presente in tutti i 17 file; parità completa con `TRENITALIA`
  - `getColumnsByProfile('MERCITALIA')` → 17 colonne, 12 indennità, **nessuna colonna ticket**
