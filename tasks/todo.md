# Sessione 2026-05-21 — Fix swap Presenze/Riposi + timeout Gemini

> **Problema 1 (priorità):** in estrazione l'IA confonde i giorni lavorati (Presenze)
> con i Riposi. Caso reale: `TRENITALIA/CATANEO PASQUALE/2008/Maggio 2008.PDF` — cella
> "Presenze" vuota, l'IA mette 11 (= Riposi) in `daysWorked`. Corretto: daysWorked=0.
> Il prompt-engineering è stato già "blindato" 3+ volte e continua a fallire → serve
> una correzione DETERMINISTICA lato codice.
>
> **Problema 2:** errore Gemini "Request aborted" / timeout. La retry fa 3×16s=48s ma
> il budget Function locale è 30s → sfora sempre.

## Plan — Fix swap + timeout

- [x] **Step 0 — Riproduzione empirica.** Diagnostico Gemini sul PDF reale Maggio 2008:
      l'IA mette 11 (= Riposi) in `daysWorked` e perde i 18 di Assenze retribuite.
      Latenza 22,5s → conferma anche il timeout (16s abortiva la chiamata).
- [x] **Step 1 — Nuovo contratto di estrazione (RFI+TRENITALIA).** Il prompt §2 non chiede
      più `daysWorked`: chiede l'oggetto `attendance` con le 10 colonne (null = cella vuota).
      Effetto collaterale positivo: l'IA ora trova i 18 di Assenze retribuite.
- [x] **Step 2 — Riconciliatore deterministico** `reconcileRailwayAttendance()`.
      Due design scartati (range Riposi → IA allucina dentro range; quadratura rigida → la
      riga NON somma sempre ai giorni del mese: Marzo 28≠31, Novembre 61). Design finale:
      daysVacation/daysPaidLeave letti diretti; daysWorked azzerato solo se la riga sfora i
      giorni del mese e azzerare `presenze` rientra nel tetto (+ guardia riposi rotto).
- [x] **Step 3 — `verify-payslip.ts`:** nessuna modifica necessaria. Le regole RFI/TREN
      (commit 944ea00) già dicono "daysWorked=0 corretto, non scambiare Riposi": coerenti
      con il nuovo flusso (la verifica riceve già il `daysWorked` riconciliato).
- [x] **Step 4 — Fix timeout Gemini.** Retry budget-aware (budget totale 25s, 1° tentativo
      fino a 24s così una chiamata da ~22s RIESCE) + rotazione/partenza casuale tra le
      chiavi API disponibili (SCAN_API_KEYS).
- [x] **Step 5 — Verifica.** `npx tsc` pulito; `vitest` 67/67; `npm run build` OK. 8
      cedolini reali (4 Trenitalia + 4 RFI) estratti con la API key e usati come test
      bloccanti. `daysWorked` corretto 8/8, `daysVacation` 8/8.
- [x] **Step 6 — `lessons.md` aggiornato.**

## Review

**Esito:** bug swap Presenze/Riposi risolto alla radice (RFI + Trenitalia) + timeout Gemini
sistemato.
- `scan-payslip.ts`: prompt RFI/TRENITALIA §2 riscritto (oggetto `attendance`);
  `reconcileRailwayAttendance()` deterministico; retry budget-aware con rotazione chiavi.
- `__tests__/reconcileAttendance.test.ts`: 10 test, gli 8 cedolini reali come verità a terra.
- `verify-payslip.ts`: non toccato (già coerente).

**Risultati sugli 8 cedolini reali (estrazione IA → riconciliatore):**
| Cedolino | Presenze cella | daysWorked | daysVacation |
|---|---|---|---|
| Maggio 2008 (T) | vuota (bug) | 11 → **0** ✅ | 2 ✅ |
| Luglio 2009 (T) | piena (8) | 8 ✅ | 7 ✅ |
| Novembre 2009 (T) | piena (44, conguaglio) | 44 ✅ | 0 ✅ |
| Marzo 2010 (T) | piena (18.5) | 18.5 ✅ | 0.5 ✅ |
| Febbraio 2012 (RFI) | piena (20) | 20 ✅ | 3 ✅ |
| Giugno 2021 (RFI) | piena (10), riposi=null | 10 ✅ | 0 ✅ |
| Giugno 2018 (RFI) | piena (1) | 1 ✅ | 0 ✅ |
| Giugno 2009 (RFI) | piena (18, conguaglio) | 18 ✅ | 1 ✅ |

**Note oneste:**
- *Limite residuo:* un mese-bug (Presenze vuota) la cui riga reale è già in sotto-conteggio
  marcato E con `riposi` allucinato piccolo potrebbe sfuggire. Mai osservato sugli 8 reali.
- *Fuori scope:* su Giugno 2009 RFI l'IA sbaglia `daysPaidLeave` (17 invece di 8) per uno
  slittamento delle colonne di DESTRA quando "Malattie" è vuota — è un altro bug OCR, non lo
  swap giorni/riposi richiesto, e non tocca il divisore `daysWorked`. Da valutare a parte.

## Debito tecnico (da monitorare)

- **Slittamento colonne di destra (RFI/Trenitalia).** Quando la cella "Malattie" (o
  Infortuni) è vuota, l'IA può slittare a sinistra le colonne `Infortuni / Assenze
  retribuite / Assenze non retribuite` → `daysPaidLeave` errato. Osservato su Giugno 2009
  RFI (`daysPaidLeave` = 17 invece di 8). **Impatto basso:** `daysPaidLeave` è un campo
  informativo, NON entra nel divisore `daysWorked` (che resta corretto). **Non correggere
  ora** — priorità alla stabilità del divisore. Da rivalutare quando si testeranno modelli
  più capaci (es. Gemini 3 / Pro): un modello migliore potrebbe risolverlo senza codice.

---

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

---

# Sessione — Tooltip Portal + Trenitalia "Assenze retribuite" (giorni lavorati = 0)

> Piano approvato: `~/.claude/plans/dreamy-leaping-lecun.md`
> Branch: `feat/trenitalia-assenze-retribuite-tooltip-portal`

## Plan (approvato)

### Parte A — Tooltip via React Portal
- [x] **A1** — Nuovo `components/ui/PortalTooltip.tsx` (createPortal + position fixed)
- [x] **A2** — `MonthlyDataGrid.tsx`: 3 tooltip cella mese → `<PortalTooltip>` (avviso AI, semaforo, tasto-scudo)

### Parte B — Trenitalia colonna "Assenze retribuite" + fix divisore
- [x] **B1** — `types.ts`: colonna `daysPaidLeave` (info) + interfaccia `AnnoDati`
- [x] **B2** — `scan-payslip.ts` `PROMPT_TRENITALIA`: estrazione "Assenze retribuite"
- [x] **B3** — `usePayslipUpload.ts`: mapping `daysPaidLeave` (upload singolo + batch)
- [x] **B4** — Esclusione dai calcoli: `EXCLUDED_INDEMNITY_COLS` + 8 liste sparse
- [x] **B5** — `MonthlyDataGrid.tsx`: fix `isDivisorError` + `totalDaysInput`
- [x] **B6** — `verify-payslip.ts`: regola `daysPaidLeave` per RFI/TRENITALIA
- [x] **B7** — Calc engine: verificato, nessuna modifica logica (solo B4)

### Verifica
- [x] `npm run test` → 57/57 verdi (+5 nuovi casi `daysPaidLeave`)
- [x] `npm run build` pulito + `npx tsc --noEmit` exit 0
- [ ] Test manuale Aprile/Agosto 2007 + tooltip (richiede ambiente Netlify + chiave Gemini → utente)

## Review

### Cosa è cambiato
- **Tooltip portal**: nuovo `components/ui/PortalTooltip.tsx` — renderizza su `document.body`
  con `position: fixed` e coordinate da `getBoundingClientRect()`, con flip orizzontale e
  clamp nel viewport. Risolve alla radice lo stacking-context isolato della prima colonna
  `sticky` e il clipping da `overflow-auto`. Applicato ai 3 tooltip della cella mese.
- **Colonna `daysPaidLeave`**: nuova colonna informativa "Ass. Retrib." (solo Trenitalia,
  RFI in follow-up). NON entra nel divisore né in nessuna formula — `EXCLUDED_INDEMNITY_COLS`
  + 8 liste di classificazione colonne aggiornate. Estratta dal prompt Trenitalia, mappata
  in upload singolo e batch, nota nel verificatore AI.
- **`isDivisorError`**: ora scatta solo con indennità + 0 presenze + 0 ferie + 0 assenze
  retribuite (mese senza alcuna copertura). Un mese a 0 presenze giustificato da
  ferie/permessi sindacali non è più segnalato come errore.
- **Motore di calcolo**: nessuna modifica logica — già applica la media annua ereditata ai
  giorni di ferie di ogni mese, anche con `daysWorked = 0` (verificato con test dedicato).

### Verifiche
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → 57/57 (5 nuovi test: esclusione daysPaidLeave da divisore/medie,
  scenario Aprile 2007, presenza colonna solo su Trenitalia)
- `npm run build` → build di produzione completata

### File modificati
- Nuovo: `components/ui/PortalTooltip.tsx`
- `components/WorkerTables/MonthlyDataGrid.tsx`, `types.ts`, `utils/calculationEngine.ts`
- `netlify/functions/scan-payslip.ts`, `netlify/functions/verify-payslip.ts`
- `hooks/usePayslipUpload.ts`, `hooks/useOCRSniper.ts`
- `components/WorkerCard.tsx`, `components/WorkerDetailPage.tsx`, `RelazioneModal.tsx`
- `components/WorkerTables/IndemnityPivotTable.tsx`, `components/WorkerTables/IstatDashboardModal.tsx`
- `__tests__/calculationEngine.test.ts`

### Estensione RFI ✅ (stessa sessione)
Estesa la colonna "Assenze retribuite" anche al profilo **RFI** (stesse buste SAP/Zucchetti,
stessa casistica 0 presenze / permessi sindacali):
- `types.ts`: `PROFILES_WITH_PAID_LEAVE = ['RFI', 'TRENITALIA']`.
- `scan-payslip.ts`: regola di estrazione "Assenze retribuite" aggiunta a `PROMPT_RFI` §2
  + chiave `daysPaidLeave` nell'esempio di output RFI.
- `verify-payslip.ts`, calcolo, tooltip, esclusioni: già profilo-agnostici, coprono RFI.
- Test `getColumnsByProfile`: aggiornato → RFI e Trenitalia includono `daysPaidLeave`,
  ELIOR/MERCITALIA no. `npx tsc --noEmit` exit 0, `npx vitest run` 57/57, build OK.

### Fix popover discrepanza interattivo ✅ (stessa sessione)
Segnalazione utente: il popover di discrepanza per-cella (con il tasto "Accetta correzione")
spariva muovendo il mouse → impossibile da cliccare. Causa: gap tra pallino e pannello che
rompeva la catena di hover, e `pointer-events-auto` attivo solo durante l'hover del trigger.
- `PortalTooltip`: aggiunta modalità `interactive` — pannello cliccabile, resta aperto
  mentre il mouse è sul trigger O sul pannello, con ritardo di chiusura (150ms) che fa da
  "ponte" sul gap.
- `MonthlyDataGrid.tsx`: il popover `group/disc` (discrepanza di cella + tasto Accetta)
  convertito a `<PortalTooltip interactive>`. `npx tsc` exit 0, `vitest` 57/57, build OK.

### Blindatura prompt anti-confusione Riposi/Presenze ✅ (stessa sessione)
Segnalazione utente: su Marzo 2007 l'IA ha messo 9 in `daysWorked` — ma 9 era la colonna
"Riposi", "Presenze" era vuota (daysWorked corretto = 0). Anche la verifica AI ha confermato
il dato errato. Causa: con "Presenze" vuota, l'OCR produce una sequenza che parte da
"Riposi" e il modello prende il primo numero come giorni lavorati.
- `scan-payslip.ts` — riscritta §2 di `PROMPT_RFI` e `PROMPT_TRENITALIA` come **algoritmo
  anti-confusione**: i Riposi (2ª col., 4-13, mai 0) vanno identificati per primi e non
  finiscono mai in daysWorked; due esempi opposti (Presenze vuota vs valorizzata); controllo
  di quadratura con il discriminante "se Riposi risulta 0 la lettura è errata".
- `verify-payslip.ts` — blocco RFI/TRENITALIA: aggiunto il controllo anti-confusione Riposi
  per il doppio check (se daysWorked coincide col valore dei Riposi e "Presenze" è vuota →
  discrepanza, suggested = 0).
- `npx tsc` exit 0, `vitest` 57/57, build OK.

### Fix falso positivo verifica AI su daysWorked ✅ (stessa sessione)
Segnalazione utente: la "Verifica dati con AI" segnala un errore su `daysWorked = 0`
(corretto) perché il verificatore stesso, leggendo il PDF, scambia il numero dei Riposi
per le Presenze e propone quel numero come valore corretto.
- `verify-payslip.ts` — riscritto il blocco `daysWorked` RFI/TRENITALIA come "FALSO
  POSITIVO #1 da non commettere": `daysWorked = 0` non è un valore mancante; un numero
  piccolo (4-13) nella riga presenze è RIPOSI, non Presenze; vietato proporre il valore
  dei Riposi come `suggested`; si segnala solo vedendo con certezza un numero sotto
  "Presenze". Mantenuto il caso opposto (estratto > 0 = valore dei Riposi → suggested 0).
- `verify-payslip.ts` — aggiunta "ECCEZIONE CONTEGGI GIORNI" alla regola comune "VALORE
  MANCANTE": uno 0 su daysWorked/daysVacation/daysPaidLeave non è di per sé un valore
  mancante. `npx tsc` exit 0, build OK.

### Follow-up
- Test manuale end-to-end con i PDF reali Marzo/Aprile/Agosto/Settembre 2007 (richiede `netlify dev`).
