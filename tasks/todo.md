# Sessione 2026-05-31 — Esporta Concluse (ZIP) + helper locale

> **Obiettivo:** portare automaticamente nelle cartelle Desktop i 3 documenti di
> ogni pratica **Conclusa** (stato `trattativa`). Strada scelta: **A** — un bottone
> sul sito genera tutto in UNO zip con la struttura cartelle; un helper locale (fatto
> DOPO, senza deploy) scompatta nel Desktop.
>
> **Vincolo di sequenza:** il bottone è una modifica al sito → deve entrare
> nell'ULTIMO deploy Netlify previsto. L'helper è 100% locale → nessun deploy.
>
> **Scoperte dal codice:**
> - "Concluse" = lavoratori con `status === 'trattativa'` (`DashboardPage.tsx:64`).
> - Azienda → cartella = campo `worker.profilo` (cartelle: ELIOR/RFI/CLEAN SERVICE/…).
> - I dati mensili sono già caricati in `worker.anni` → nessuna fetch extra per il calcolo.
> - I 3 documenti NON esistono sul server: si generano nel browser e si scaricano.
>   - `Conteggi_{cognome}_{nome}.pdf` — jsPDF, `utils/printTables.ts:437` (fa `doc.save()`).
>   - `Riepilogo_somme_richieste_{cognome}_{nome}.pdf` — jsPDF, `components/TableComponent.tsx:177`.
>   - `Relazione_Tecnica_{cognome}.docx` — **GIÀ ESISTE**: `RelazioneModal.tsx` (root),
>     `handleExportWord` (riga 321-447) costruisce un .docx vero con la lib `docx` e fa
>     `saveAs(..., 'Relazione_Tecnica_{cognome}.docx')`. NON va costruito da zero, va estratto.
>   - NB: il `components/WorkerTables/RelazioneModal.tsx` è la versione VECCHIA (testo+print),
>     codice morto — l'attivo è quello di root, importato da `components/TableComponent.tsx:24`.
> - Calcolo totali = funzione pura `computeHolidayIndemnity` (`utils/calculationEngine`),
>   richiamabile in batch su `worker.anni` senza React (oggi avvolta in `useStatsData`).
> - La relazione esistente NON ha data né riga firma (confermato dal file di Mastropasqua) → ok così.
> - Decisioni utente: Nota Spese **fuori** per ora; relazione **.docx editabile**
>   (auto-generata, niente ritocco manuale nel batch — il sindacalista la modifica dopo).

## Plan — Esporta Concluse (bottone, da includere nel deploy)

- [x] **Refactor generatori → blob.** `printPayslipTables` ora ha `output?: 'save'|'blob'`
      (default 'save', restituisce `Blob` in modalità blob). Riepilogo idem via
      `renderRiepilogoPdf` (il chiamante fa `doc.save` o `doc.output('blob')`).
- [x] **Estrarre il calcolo Riepilogo** in `utils/riepilogoReport.ts`
      (`computeRiepilogoData` + `renderRiepilogoPdf`), richiamato sia da `TableComponent`
      (single source of truth, niente più duplicazione) sia dal batch.
- [x] **Estrarre il generatore Relazione .docx** da `RelazioneModal.handleExportWord`
      in `buildRelazioneDocxBlob(...)` esportata; la modale e il batch la riusano.
      Stesso identico contenuto del file di Mastropasqua.
- [x] **`utils/concluseExport.ts`** (`exportConcluseZip`): per ogni worker `trattativa`
      → calcola totali → 3 blob → zip al path `{AZIENDA}/{COGNOME NOME}/conteggi/{file}`.
      `jszip` aggiunto e caricato via `import()` dinamico (chunk separato, ~lazy).
- [x] **Opzioni per-lavoratore (NON default globale).** `resolveOptions` replica la
      risoluzione del singolo export: `worker.X ?? localStorage 'report_*_{id}' ?? default`.
      Default di codice allineati a escludere ticket+percepito (scelta utente):
      `report_tickets`/`report_percepito` ora default `false` in TableComponent/printTables;
      props RelazioneModal `includeTickets`/`showPercepito` default `false`.
- [x] **Path azienda** = `SYSTEM_PROFILES[worker.profilo].label` (ELIOR/RFI/CLEAN SERVICE…),
      cartella worker = `COGNOME NOME` in MAIUSCOLO. Fallback al profilo se azienda custom.
- [x] **Bottone UI** nel menu "Dati" della dashboard: "Esporta Concluse (ZIP)" con
      avanzamento `n / tot` e riepilogo finale (esportate/non riuscite) via alert.
- [x] **Verifica statica:** `tsc --noEmit` exit 0; `npm run build` verde; chunk
      `concluseExport` separato (2.14 kB, lazy). **Verifica funzionale manuale ancora
      da fare** (vedi Review): cliccare il bottone con 1-2 Conclusi, scompattare lo zip,
      confrontare i 3 file col flusso singolo.

## Plan — Helper locale (DOPO, nessun deploy)

- [ ] Script Node che sorveglia ~/Downloads, riconosce `Concluse_*.zip`,
      scompatta dentro `~/Desktop/Pratiche…/Cedolini Lavoratori/` preservando la struttura,
      e archivia/rimuove lo zip. (Spec di dettaglio in sessione separata.)

## Review — Esporta Concluse

**Fatto:**
- `utils/riepilogoReport.ts` (nuovo): `computeRiepilogoData` + `renderRiepilogoPdf`.
  `TableComponent` ora li usa → eliminata la duplicazione (rimossa la vecchia
  `handleDownloadPDF` + i tre useMemo locali).
- `utils/printTables.ts`: param `output?: 'save'|'blob'`; default percepito → `false`.
- `RelazioneModal.tsx`: estratta `buildRelazioneDocxBlob(...)` esportata; la modale
  ora è un wrapper sottile; default props `includeTickets`/`showPercepito` → `false`.
- `utils/concluseExport.ts` (nuovo): `exportConcluseZip(workers, onProgress)`.
- `DashboardPage.tsx`: voce menu "Esporta Concluse (ZIP)" con avanzamento + alert
  riepilogo; `import()` dinamico → chunk separato.
- Default ticket/percepito allineati a `false` (scelta utente).

**Verifica statica:** `tsc --noEmit` = 0; `npm run build` verde; chunk
`concluseExport` 2.14 kB (lazy).

**Verifica funzionale headless (Node, esbuild --conditions browser):** su lavoratore
sintetico ELIOR → Conteggi PDF (103.748 b) + Riepilogo PDF (10.962 b) generati,
calcolo eseguito (lordo 155,45 €), ZIP impacchettato con struttura ESATTA
`ELIOR/ROSSI MARIO/conteggi/{Conteggi_*,Riepilogo_somme_richieste_*}.pdf`, riletto:
entrambi i PDF integri (magic `%PDF-`). Nota: in Node il Blob di jspdf va convertito
in Buffer per JSZip; nel browser JSZip accetta il Blob nativamente (nessuna modifica
al codice necessaria).

**Ancora da fare (manuale, nel browser prima del deploy):**
- Aprire la dashboard, menu Dati → "Esporta Concluse (ZIP)" con ≥1 pratica Conclusa.
- Scompattare lo zip e confrontare i 3 file (incl. la **Relazione .docx**, non
  testabile headless perché in file React) con quelli del flusso singolo per lo stesso
  lavoratore: devono essere identici.

**Note / possibili evoluzioni:**
- La Relazione `.docx` è codice esistente estratto verbatim (stesso output di prima):
  non testata headless ma coperta da tsc/build e dal fatto che la modale la riusa.
- Aziende custom (non in SYSTEM_PROFILES): fallback cartella = chiave `profilo`.

---

# Sessione 2026-05-22 (d) — Fix timeout Gemini (scan + verify)

> **Problema:** errori frequenti "Request aborted" (scan-payslip, ~24s) e "Task timed
> out after 30s" (verify-payslip).
>
> **Causa:** (1) il budget del retry in scan-payslip era fisso a 25s, tarato per una
> Function da ~30s — ma `netlify.toml` dà 60s in produzione → le chiamate Gemini
> venivano abortite a 24s pur avendo tempo. (2) verify-payslip non aveva alcun timeout
> sulla chiamata Gemini → veniva uccisa di colpo dal limite della Function.
>
> Nota: in locale `netlify dev` gira con lambda-local a 30s (non rispetta netlify.toml).

## Plan — fix timeout

- [x] scan-payslip: budget del retry env-aware — ~50s in prod, ~26s in locale
      (NETLIFY_DEV), override con `AI_BUDGET_MS`.
- [x] verify-payslip: aggiunto timeout esplicito alla chiamata Gemini (stesso budget).
- [x] `tsc` + build verdi.

## Review — fix timeout

`scan-payslip` `generateContentWithRetry`: il budget non è più fisso a 25s ma deriva
dall'ambiente — 50s in produzione (netlify.toml timeout=60), 26s in locale. Così in
produzione una chiamata lenta (30-45s) RIESCE invece di essere abortita a 24s.
`verify-payslip`: la chiamata Gemini ha ora `{ timeout }` → fallisce in modo pulito
invece di far scattare il kill secco della Function. Entrambi override con `AI_BUDGET_MS`.

Limite: in locale resta il tetto di 30s di `netlify dev` (lambda-local). Il test reale va
fatto sul sito in produzione. Se anche lì si va in timeout: il modello è troppo lento
(provare `GEMINI_MODEL=gemini-2.5-flash`) o serve passare a Netlify Background Functions.

---

# Sessione 2026-05-22 (c) — Fix UX: Dynamic Island perde l'upload al refocus

> **Problema 1:** uscendo dalla scheda durante un upload (per controllare altro sul PC)
> e tornando, la Dynamic Island perde la Live Activity di caricamento e mostra il
> messaggio "Bentornato!".
>
> **Causa:** Supabase ri-emette l'evento `SIGNED_IN` ogni volta che la scheda riprende
> il focus. `useAuth` mostrava "Bentornato!" su OGNI `SIGNED_IN` → la notifica impostava
> `mode='notification'` nel context. In DynamicIsland la visibilità dell'upload era
> ancorata a `globalMode==='uploading'` → la notifica lo sovrascriveva e la Live
> Activity spariva, senza più tornare per il resto dell'upload.

## Plan — fix 1

- [x] `useAuth.ts`: "Bentornato!" solo su login vero (transizione non-auth → auth),
      non sui re-emit di `SIGNED_IN` al refocus della scheda.
- [x] `DynamicIsland.tsx`: ancorare la priorità dell'upload a `uploadState.isUploading`
      (stato reale) invece di `globalMode`, così nessuna notifica può nascondere un
      caricamento in corso.
- [x] `tsc` + test + build verdi.

## Review — fix 1

Implementato e verificato (`tsc` exit 0 · 71/71 test · build OK). 2 cause, 2 fix:

- `useAuth.ts` — "Bentornato!" mostrato solo su un login vero (transizione
  non-autenticato → autenticato), tracciata con `wasAuthenticatedRef`. I re-emit di
  `SIGNED_IN` di Supabase al rientro sulla scheda non generano più la notifica.
- `DynamicIsland.tsx` — `uploadingActive` ora deriva da `uploadState.isUploading`
  (stato reale del caricamento) e il mode è forzato a `'uploading'`. Nessuna notifica,
  da qualunque sorgente, può più nascondere un upload in corso.

Effetto: uscendo e rientrando nella scheda durante un upload, la Live Activity resta
visibile e non compare più il "Bentornato!". Da validare sul sito dopo il deploy.

## Plan — fix 2 (visore ↔ tabella)

Richiesta: (a) la tabella seleziona in automatico il mese mostrato nel visore;
(b) badge col nome del mese nella barra in alto del visore. Sincronia una-via
(visore → tabella), come scelto dall'utente.

- [x] `constants.tsx`: helper `parseMonthFromFilename` (mese+anno dal nome file).
- [x] `WorkerDetailPage.tsx`: stato `payslipFileNames` parallelo a `payslipFiles`
      (sync in handleImageUpload / handleDrop / handleDeleteCurrentFile); deriva
      `currentFileMonth` + `currentFileMonthLabel`.
- [x] `SplitViewViewer.tsx` + `WorkerDetailLayout.tsx`: prop `currentFileMonthLabel`,
      badge mese nella barra in alto del visore.
- [x] `MonthlyDataGrid.tsx`: props `activeMonthIndex` / `activeYear`; switch anno +
      evidenziazione riga + `scrollIntoView` del mese mostrato nel visore.
- [x] `tsc` + test + build verdi.

## Review — fix 2

Implementato e verificato (`tsc` exit 0 · 71/71 test · build OK). 6 file:

- `constants.tsx` — helper `parseMonthFromFilename(name)`: mese (0-11) + anno dal nome
  del file (nome esteso del mese, o numerico 01-12; anno 20xx).
- `WorkerDetailPage.tsx` — stato `payslipFileNames` parallelo a `payslipFiles`
  (sincronizzato nei 3 handler che mutano i file); derivati `currentFileMonth`,
  `currentFileMonthLabel` e `activeMonthIndex` / `activeYear` (attivi solo a visore aperto).
- `SplitViewViewer.tsx` — badge col mese del PDF corrente come overlay in basso a
  sinistra sul documento (icona calendario + "Mese Anno").
- `WorkerDetailLayout.tsx` — pass-through del prop `currentFileMonthLabel`.
- `MonthlyDataGrid.tsx` — props `activeMonthIndex` / `activeYear`; effetto che porta la
  tabella sull'anno del cedolino mostrato; riga del mese evidenziata (accento indaco) e
  portata in vista con `scrollIntoView`.

Comportamento: navigando i PDF nel visore (◀ ▶) il badge si aggiorna e la tabella
evidenzia/scrolla automaticamente sul mese corrispondente. Sola direzione visore →
tabella, come richiesto.

Limite: il mese si ricava dal NOME del file. File senza mese nel nome → niente badge né
sync per quel file (gli altri funzionano). Verifica reale da fare sul sito.

Aggiustamenti post-test utente: (1) il badge nella barra comandi la tagliava → spostato
a overlay sul PDF (basso a sinistra); (2) evidenziazione riga troppo chiara → resa più
marcata (sfondo indaco pieno + ring + accento laterale); (3) rimosso il pulsante "Smart
Upload 12" dal visore: duplicava il "Tasto AI Agent" (stesso `handleBatchUpload`).
Rimosso anche il ref ormai orfano `batchInputRef` (SplitViewViewer, WorkerDetailLayout,
WorkerDetailPage, usePayslipUpload). (4) badge ri-posizionato nella barra in alto del
visore, tra navigatore file e OCR (lo spazio liberato dallo Smart Upload). (5) rimosso
lo `scrollIntoView` automatico: al cambio mese la schermata non scatta più, resta la
sola evidenziazione (ben visibile) della riga. `tsc` exit 0 · 71/71 test · build OK.

---

# Sessione 2026-05-22 (b) — Fix slittamento Presenze: caso "mese sparso" (Aprile 2008)

> **Problema:** `TRENITALIA/CATANEO PASQUALE/2008/Aprile 2008.PDF` — cella "Presenze"
> vuota, l'8 è nella colonna Riposi, daysWorked corretto = 0. Il sistema estrae 8.
> La rete `reconcileRailwayAttendance` NON lo prende: scatta solo se la riga sfora i
> 32,5 gg, ma Aprile somma ~29 (8 Riposi + 21 Assenze retribuite) → sotto soglia.
> Anche la "verifica AI" ricasca nello stesso errore (ri-OCR dello stesso PDF).
>
> **Causa radice:** dai SOLI numeri il caso è indistinguibile da un mese lavorato
> davvero poco (cfr. test reale "Giugno 2021": presenze=10, assenze=21 → giusto 10).
> Il dato dirimente — "cella Presenze vuota?" — vive solo nell'immagine: va recuperato
> all'OCR, non con una soglia numerica.

## Plan

- [x] Step 1 — Prompt RFI/TRENITALIA §2: nuovo campo top-level `presenzeVuota` (booleano),
      lettura geometrica del 1° riquadro della tabella. Aggiornati esempi §2/§8/§9.
- [x] Step 2 — `reconcileRailwayAttendance` a 3 livelli: (1) `presenzeVuota` = segnale
      primario; (2) invariante numerica asimmetrica come rete; (3) caso ambiguo
      (presenze piccolo + mese implausibilmente pieno) → daysWorked tenuto + avviso
      "verifica manuale" invece di un numero sbagliato silenzioso (scelta utente).
- [x] Step 3 — `verify-payslip.ts`: framing geometrico della cella Presenze vuota.
- [x] Step 4 — Test: 4 casi reali Aprile 2008 (presenzeVuota true/false/assente +
      precedenza del segnale); i 10 test esistenti restano verdi.
- [x] Step 5 — `tsc --noEmit` + `npm test` verdi.

## Review

Implementato e verificato. Modifiche:
- `scan-payslip.ts` — prompt RFI + TRENITALIA §2: aggiunto il booleano top-level
  `presenzeVuota` con lettura geometrica del 1° riquadro della tabella; esempi §2/§8/§9
  aggiornati.
- `scan-payslip.ts` — `reconcileRailwayAttendance` riscritto a 3 livelli (segnale
  `presenzeVuota` → rete numerica asimmetrica → segnalazione del dubbio). Nuova costante
  `SOGLIA_MESE_PIENO = 26`. La vecchia logica a sola soglia 32,5 (che lasciava passare
  Aprile 2008) è ora solo la rete di backup, non più l'unico meccanismo.
- `verify-payslip.ts` — regola RFI/TRENITALIA daysWorked: aggiunto il controllo
  geometrico esplicito della cella "Presenze" vuota.
- `__tests__/reconcileAttendance.test.ts` — helper `j()` esteso con `extra`; nuovo blocco
  di 4 test sul caso reale Aprile 2008.

Verifica: `tsc --noEmit` exit 0 · `vitest run` 71/71 verdi (14 reconcile, di cui 4 nuovi) ·
`npm run build` OK.

Esito per Aprile 2008:
- con prompt che produce `presenzeVuota:true` → daysWorked = 0 (corretto, nessun avviso).
- se il prompt fallisse (`presenzeVuota:false`/assente) → daysWorked resta 8 MA con avviso
  "⚠️ Giorni lavorati da verificare a mano" visibile in griglia e nelle note del mese:
  niente più errore silenzioso sul divisore.

Limite noto: il caso "presenze piccolo + mese pieno" è intrinsecamente ambiguo dai soli
numeri (es. Giugno 2021, daysWorked=10 reale, ora riceve lo stesso avviso benigno). Per
scelta esplicita dell'utente si preferisce un dubbio segnalato a un numero sbagliato
nascosto.

### Addendum — passaggio a gemini-3.5-flash (modello configurabile)

Richiesta: passare da `gemini-2.5-flash` a un modello più recente. Il modello è ora
centralizzato nella env var `GEMINI_MODEL` in tutte e 4 le Netlify function (scan-payslip,
verify-payslip, scan-worker, ask-ai). Verificata via API ListModels la lista reale dei
modelli sulla chiave: `gemini-3.5-flash` esiste ed è il flash stabile più recente
(progressione 3 → 3.1 → 3.5; le 3.x precedenti sono "-preview"). Default in codice portato
a `gemini-3.5-flash`; `GEMINI_MODEL` resta come override/rollback istantaneo (es.
`GEMINI_MODEL=gemini-2.5-flash`). `tsc` exit 0. Da validare su buste reali dopo il deploy.

---

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
