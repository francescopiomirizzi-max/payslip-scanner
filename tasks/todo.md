# Sessione 2026-06-09 — Fix card "Credito Stimato Totale" (Strategia B / assenze retribuite)

> **Bug:** nella dashboard principale (`pages/DashboardPage.tsx`) la card "Credito Stimato
> Totale" mostra numeri sballati sui distaccati (Cataneo Vincenzo/Pasquale) perché non tiene
> conto della scelta Strategia A/B (assenze retribuite nel divisore).
>
> **Causa (root):** la preferenza Strategia B vive su `localStorage paidLeave_<id>` (non c'è
> colonna DB). Il fallback su localStorage è duplicato a mano in ALCUNI call site e MANCA in
> altri. La card principale usa `useDashboardStats` → `resolveIncludePaidLeave(worker)`, che
> guarda solo il campo `worker.includePaidLeave` (idratato SOLO se apri il dettaglio) + default
> profilo (oggi vuoto → Strategia A). Quindi su un load fresco i Cataneo vengono calcolati in A
> → con pochissime presenze (distacco) la tariffa giornaliera "esplode" → credito gonfiato.
> Diventa "giusto" solo dopo aver aperto il loro dettaglio (che idrata il campo via
> `onUpdateWorkerFields`). Da qui il "a volte sballato".
>
> **Fix (single source of truth):** centralizzare il fallback localStorage DENTRO
> `resolveIncludePaidLeave` (campo esplicito → localStorage `paidLeave_<id>` → default profilo).
> Così TUTTI i call site (card dashboard, ordinamento, WorkerCard, riepilogo, relazione)
> diventano coerenti senza dover aprire il dettaglio, e i 3 punti che leggevano localStorage a
> mano si semplificano.

- [x] `types.ts` — `resolveIncludePaidLeave`: aggiunto `id?` al tipo param; dopo il check del
      campo boolean legge `localStorage paidLeave_<id>` (guard `typeof localStorage` + try/catch),
      poi default profilo.
- [x] Semplificati i call site ridondanti → `resolveIncludePaidLeave(...)`:
      `StatsDashboard.tsx`, `utils/reportGenerator.ts`, `utils/concluseExport.ts`,
      `components/WorkerDetailPage.tsx` (init useState).
- [x] Verifica: `npx tsc --noEmit` pulito + **148 test verdi** (142 + 6 nuovi).
- [x] Aggiunto `__tests__/resolveIncludePaidLeave.test.ts` (precedenza campo→localStorage→default).

## Review
- **Root cause:** preferenza Strategia B con DUE fonti (campo `worker.includePaidLeave` + localStorage
  `paidLeave_<id>`), riconciliate solo dentro `WorkerDetailPage`. Il fallback localStorage era
  duplicato a mano in 3 call site e MANCAVA negli altri 4 (tra cui `useDashboardStats` = la card).
- **Fix:** una sola modifica sostanziale (`resolveIncludePaidLeave` legge localStorage) sistema card
  dashboard + ordinamento + WorkerCard + riepilogo + relazione; i 3 call site con la lettura inline
  sono stati semplificati (rimossa la duplicazione che aveva generato l'incoerenza).
- **Comportamento:** card corretta già al load (legge la preferenza salvata) e live al toggle
  (toggle → `onUpdateWorkerFields` → `setWorkers` → memo `[workers]` ricalcola). Nessun deploy fatto
  (regola batch crediti Netlify): testare in locale `npm start` :8888.
- **File toccati:** `types.ts`, `components/StatsDashboard.tsx`, `components/WorkerDetailPage.tsx`,
  `utils/reportGenerator.ts`, `utils/concluseExport.ts`, `__tests__/resolveIncludePaidLeave.test.ts`,
  `knowledge/strategia-a-vs-b.md`.

---

# Sessione 2026-06-09 (b) — Pagina report finale (`TableComponent`)

## Part 1 — Stampa non deve mostrare i widget flottanti
- [x] Causa: `window.print()` cattura l'intera pagina → comparivano i widget GLOBALI di `App.tsx`
      (`AreaSwitch` Incidenza/Turni&Riposi in basso a sx, `KeyboardShortcutsHint` scorciatoie in basso a dx),
      fuori dal `@media print` locale di TableComponent.
- [x] Fix: regola globale in `index.css` (`@media print { .print\:hidden { display:none !important } }`)
      + classe `print:hidden` su `AreaSwitch` e `KeyboardShortcutsHint`. Vale ovunque, non solo nel report.
- [ ] **Da confermare dall'utente** (anteprima stampa in locale): i toggle in basso non compaiono più.

## Part 2 — Tasto "PDF" → tasto "Documenti" (ZIP dei 3)
- [x] Rimosso il tasto "PDF" (`handleDownloadPDFLocal`, Riepilogo singolo = doppione della Stampa).
- [x] `concluseExport.ts`: estratti `buildWorkerDocs(w)` + `addWorkerDocsToZip()` (DRY) e aggiunto
      `exportSingleWorkerZip(worker)` → zip con Conteggi + Riepilogo + Relazione (stessa struttura cartelle).
- [x] `TableComponent.tsx`: nuovo tasto "Documenti" (icona Package, spinner durante la generazione async
      della Relazione .docx) che chiama `exportSingleWorkerZip(worker)`; opzioni risolte = quelle a schermo.
- [x] Verifica: `npx tsc --noEmit` pulito + **148 test verdi**, nessun import orfano/ciclo.
- Scelta utente: **ZIP unico** (non 3 file separati).
- [x] Struttura ZIP singolo: UNA cartella `Conteggi {Cognome} {Nome}` con i 3 file (no albero aziendale).
- [x] **Riepilogo nel ZIP = screenshot del prospetto** (come tasto Stampa), non la tabella jsPDF:
      nuova dip `html-to-image` (foreignObject → gestisce oklch Tailwind v4) + `utils/reportScreenshotPdf.ts`
      (`captureReportPdfBlob`); cattura `#riepilogo-card` → jsPDF A4 landscape → blob; override passato a
      `exportSingleWorkerZip(worker, riepilogoOverride)`. Fallback al riepilogo jsPDF se la cattura fallisce.
      Export Concluse in blocco invariato (nessun DOM → usa la tabella jsPDF).
- [x] Import `concluseExport`/`reportScreenshotPdf` resi **dinamici** in TableComponent → chunk lazy,
      fuori dal bundle principale (risolve il warning rollup). `tsc` pulito + **build OK**.

---

# Sessione 2026-06-02 — Uniformare RFI al metodo "ricco" dell'avvocato (% di incidenza)

> **Origine:** l'avvocato ha fornito un Excel di conteggio (CONTEGGI - PALLADINO CIRO
> SALVATORE.xlsx, un **macchinista Trenitalia/PDM**, NON magazzino). È più articolato del
> nostro metodo. Ha chiesto che **la stessa impostazione valga anche per RFI**, perché in
> tribunale gli servono le **percentuali di incidenza** che oggi non produciamo.
>
> **Vincoli confermati dall'utente:**
> - Ferie restano come le facciamo noi: **max 28 giorni**; switch **32 ex-fest disattivato**.
> - Quindi il **numero del credito ferie NON cambia**. Le percentuali sono **ADDITIVE**.
> - Le percentuali vanno: (1) nella **relazione legale** (con spiegazione del metodo +
>   esempio pratico) e (2) nel **foglio dei conteggi** (le tabelle mensili/voci a schermo/PDF).

## Metodo dell'avvocato — DECODIFICATO dalle formule dell'Excel (verificato cella per cella, anno 2008)

Per ogni anno costruisce 6 quadri. Il **credito** dipende SOLO dalle voci variabili; le
percentuali servono per argomentare in giudizio.

- **Quadro B (FISSE)** = voci continuative percepite *sia in lavoro che in ferie*
  (minimo, EDR, superminimo, salario professionale, APA…). `TotMese_B = Σ voci fisse`.
- **Quadro C (VARIABILI)** = voci percepite *solo in giornate di lavoro*. `TotMese_C = Σ voci variabili`.
- **Quadro A (denominatore)** = `B + C` (NON il lordo busta!). Formula reale: `F8 = SUM(F24,F52)`.
- **% incidenza variabili (mese)** = `C*100 / (B+C)`  → formula reale `F56 = +(F52*100/F8)`.
- **% incidenza fisse (mese)** = `B*100 / (B+C)` → `F27 = +(F24*100/F8)`. (F27+F56 = 100%.)
- **Media annua incidenza** = `Σ(% mensili) / 12` (divide SEMPRE per 12, anche mesi a 0).
- **% media periodo** = media delle % annue (es. cita "22,94% incidenza media 2008-2018").
- **Credito anno** (INVARIATO vs sito) = `(diff.giorn. ANNO PRECEDENTE × ferie fruite) − (già percepito)`.
  - Conferma chiave: usa la tariffa dell'**anno precedente** (cella K82) → il nostro
    `avgApplied = yearlyAverages[year-1]` è GIUSTO. Il foglio 3 del ricorso (che diceva
    "stesso anno") era impreciso.

## Ingrediente mancante per RFI — RISOLTO

Le percentuali richiedono le **voci FISSE** (Quadro B), che oggi NON estraiamo per RFI.
Ricavate da busta RFI reale (Tozzi Tommaso, Gen 2013):
- **Quadro B RFI proposto:** `3B01` Minimo, `3B03` Superminimo, `3B05` ERI,
  `3B10` Salario Professionale, `3B20` APA, `3B30` EDR 8.11.95, `3B35` EDR acc. 11.9.98.
- La busta ha pure un totale già pronto **"RETRIBUZIONE MENSILE"** (= Minimo+Superminimo+ERI+
  SalProf+APA, ESCLUSI gli EDR). Da decidere se itemizzare i 7 codici o usare quel totale.
- **Quadro C RFI** = identico al set variabili attuale (0152, 0421, …) usato già per il credito.

## ⚠️ Decisioni aperte (validare con l'avvocato/utente prima/durante l'implementazione)
1. ~~Membership Quadro B RFI~~ → **DECISO:** B = 7 codici base (3B01/3B03/3B05/3B10/3B20/3B30/3B35)
   **+ 3B70/3B71 Salario Produttività** (l'avvocato li colloca nel Quadro B nel suo Excel,
   righe 3B90/3B91). Restano comunque FUORI dal credito (solo denominatore %). Da confermare
   con l'avvocato ma facilmente spostabile.
2. ~~Itemizzare vs totale~~ → **DECISO: itemizzare i 7 codici** (più fedele/difendibile).
3. ~~Dato storico~~ → **DECISO: solo nuovi/ri-scansionati.** Niente inserimento manuale ora;
   le % compaiono dove ci sono le voci fisse.

## Plan — implementazione (NON iniziata, in attesa di OK)

- [x] **0. Validate** decisioni → fatto (vedi sopra).
- [x] **1. types.ts** — `INDENNITA_RFI_FISSE` (9 voci: 7 base + 3B70/3B71) + helper
      `getFixedColumnsByProfile`. `INDENNITA_RFI` NON toccato.
- [x] **2. scan-payslip.ts** — PROMPT_RFI + clone TRENITALIA (replace_all): blocco "VOCI FISSE
      CONTINUATIVE" con 3B01/3B03/3B05/3B10/3B20/3B30/3B35/3B70/3B71 + chiavi nell'esempio JSON
      (valori reali Tozzi). Persistenza OK: i codici non mappati finiscono in row[code]
      (usePayslipUpload.ts:232 e :522), nessun whitelist da toccare. ⚠️ Richiede DEPLOY.
- [x] **3. calculationEngine.ts** — `MonthDetail` (+quadroFisse/quadroVariabili/pctVariabile/pctFissa)
      e `YearResult` (+hasIncidence/sumQuadroFisse/pctVariabileMediaAnnua/pctFissaMediaAnnua) +
      `computePeriodIncidence()`. Additivo: credito identico (test lo prova).
- [x] **4. Foglio conteggi** (`utils/printTables.ts`) — nuova "Sezione 4: INCIDENZA % DELLE VOCI
      VARIABILI" (tabella per anno: % variabili / % fisse / base fissa / tot. variabili + riga
      MEDIA PERIODO via computePeriodIncidence) + nota metodologica. Mostrata solo se
      hasIncidence. Riepilogo finale → pagina 5. ⚠️ DEPLOY.
- [x] **5. Relazione legale** (`RelazioneModal.tsx` root, `buildRelazioneDocxBlob`) — nuova
      sezione "5. L'INCIDENZA PERCENTUALE DELLE VOCI VARIABILI" con spiegazione del metodo +
      esempio pratico sull'anno reale a credito + % media di periodo; Conclusioni rinumerate a 6.
      Usata sia dal bottone modale (handleExportWord) sia dal batch. ⚠️ DEPLOY.
- [x] **6. Test** (`__tests__/calculationEngine.test.ts`) — 7 nuovi test, % validate sui numeri
      reali Palladino 2008 (variabili 23,91% / fisse 76,09% / somma 100). 110/110 verdi, tsc pulito.

## Note di verifica (da soddisfare prima di "done")
- Diff euro credito PRIMA/DOPO su un lavoratore RFI reale = **0** (le % non devono spostare il credito).
- Le % di un anno pieno sommano a 100.
- Niente regressioni sui test esistenti.

## Censimento codici fissi RFI (2026-06-02, su buste reali)

Verificate 6 buste RFI (5 lavoratori, anni 2010-2022) via qlmanage→PNG:
- **Sempre presenti:** 3B01, 3B03, 3B05, 3B10, 3B20, 3B30, 3B35.
- **Solo Quadri/dirigenti:** 3B15 (Ind. Funzione), 3B50 (Ind. Utilizzazione Professionale) → AGGIUNTI.
- **Salario produttività:** 3B70, 3B71 (presenti su Tozzi/Maio/Taronna).
- Set fisse RFI finale = 11 codici. Prompt RFI+TRENITALIA aggiornati di conseguenza.
- NB collaterale (fuori scope): vista 0AA2 "Trasferta imponibile" (variabile) su Taronna — il
  sito ha solo 0AA1; valutare se aggiungerla al set VARIABILE/credito in futuro.

## ✅ LACUNA UI RISOLTA — toggle "Variabili ⇄ Fisse"

`MonthlyDataGrid`: aggiunto stato `gridMode` + controllo segmentato in toolbar (compare solo se
`getFixedColumnsByProfile(profilo).length>0`). In modalità "Fisse" la griglia mostra MESE +
voci fisse (Quadro B) + TOTALE, **editabili** con stessa UX → l'utente verifica/corregge i valori
estratti dall'AI. KPI header restano sempre sulle VARIABILI (il credito). Alert divisore silenziato
in vista Fisse. tsc pulito, build OK, 110/110 test. ⚠️ DEPLOY.

## Backfill voci fisse (archivio già scansionato) — in corso

Archivio reale (Supabase): **1942 buste, 19 lavoratori, 1675 RFI/Trenitalia**.
Scelte utente: **prompt dedicato leggero**; scope **per-lavoratore (base) + batch (scorciatoia)**.
Decisione progettuale: **backfill MIRATO merge-safe** — riusa l'immagine archiviata (no re-upload),
scrive SOLO i 3B.. → NON clobbera i dati a mano (vedi [[feedback-anni-clobber-stale-browser]],
Cianci 2014/2015). NO re-scan cieco (costo 1675 call + clobber). Lo scudo NON va bene: la sua
checklist usa solo le variabili (`WorkerDetailPage.tsx:85`) e va a mano cella per cella.

- [x] **Backend**: nuovo `action: 'fixed-voci'` in `scan-payslip.ts` — prompt leggero che estrae
      SOLO 3B01..3B71 dalla colonna Competenze (ignora 2B30/2B35 trattenute) + "retribuzioneMensile"
      di controllo. Riusa pool chiavi/retry/rate-limit. Risposta `{codes, retribuzioneMensile}`.
- [x] **Merge-safe core**: `utils/fixedVociBackfill.ts` → `mergeFixedVociIntoAnni()` (whitelist
      FIXED_VOCI_IDS, no nuove righe, no clobber, salta 0, idempotente, immutabile) + 8 test. 118/118.
- [x] **Orchestrazione hook**: `hooks/useFixedVociBackfill.ts` — per ogni busta: signed URL →
      base64 → `action:'fixed-voci'` → `mergeFixedVociIntoAnni` → `onResult(anni)`. Sequenziale,
      retry 2x (pattern anti-coda Gemini), progress {running,total,done,updated,errors}.
- [x] **UI per-lavoratore**: bottone "Estrai voci fisse dall'archivio" nel tab Archivio di
      WorkerDetailPage (solo RFI/Trenitalia, gating isReadOnly, progress X/Y, salvataggio via
      setMonthlyInputs → onUpdateData). ⚠️ DEPLOY.
- [x] **Volume gestibile** (era "tutto in un colpo"): SALTA le buste già fatte (ripristinabile),
      CONFERMA col conteggio prima di partire, tasto STOP (i mesi fatti restano salvati).
- [x] **Scope ANNUALE**: dropdown anno (da archiveYears) → il backfill lavora solo l'anno scelto
      (~12 buste). Più controllo sui risultati estratti, verificabili anno per anno nel toggle Fisse.
- [x] **Dynamic Island**: il backfill ora pilota l'isola come una scansione normale
      (`useIsland` startUpload/updateUploadProgress/finishUpload + `island-scan-label` "MES ANNO · voci fisse").
      118/118, tsc, build OK.
- [ ] **(Opzionale) Wrapper batch** su tutti gli RFI da DashboardPage — NON fatto. Il primitivo
      per-lavoratore copre il caso (19 lavoratori, da fare per-pratica). Da valutare se serve.

## Strategia B sindacale (assenze retribuite nel divisore) — FATTO 2026-06-02

Richiesta: il sindacalista ha 0 presenze perché in distacco/permesso retribuito → quei giorni
vanno contati come lavorati nel DIVISORE (altrimenti la media annua = 0 → credito 0). Toggle
per-pratica (default A = come ora; B = permessi nel divisore) per coprire entrambi i casi.
- [x] Motore: `CalculationParams.includePaidLeave` + `computeYearlyAverages(...,includePaidLeave)`
      → divisore = `daysWorked + (includePaidLeave ? daysPaidLeave : 0)` (in entrambi i punti
      della media + giorniLav mensile). Additivo, default OFF = comportamento storico.
- [x] 4 test (scenario sindacalista: media 0 con OFF, reale con ON; credito; casi normali invariati).
- [x] Campo `Worker.includePaidLeave` + persistenza (localStorage `paidLeave_<id>` + onUpdateWorkerFields).
- [x] Threading su TUTTI i 9 call site + concluseExport (batch) + WorkerDetailContext.
- [x] Toggle UI "Permessi" (verde) accanto a ExFest/Ticket in VertenzaTimeline.
- tsc pulito, 122/122, build OK. ⚠️ DEPLOY.
- TODO testo: correggere nel RTF "0 giorni lavorati…" → "media ereditata dai mesi ADIACENTI" è
  impreciso (in realtà = media dell'ANNO PRECEDENTE); ora la Strategia B è REALE (prima era falsa).

## Review (2026-06-02)

**Fatto e verificato:** tutti e 6 i passi. `tsc --noEmit` pulito, **110/110 test verdi**
(7 nuovi validati sui numeri reali Palladino 2008: variabili 23,91% / fisse 76,09%), `npm run build` OK.

**Garanzie rispettate:**
- Credito ferie INVARIATO: test dedicato prova `sumNetto` identico con/senza voci fisse. Le %
  sono puramente additive.
- Ferie max 28, switch 32 ex-fest invariato (non toccato).
- Profili senza voci fisse (ELIOR, CLEAN_SERVICE, MERCITALIA): `hasIncidence=false`, sezioni %
  non renderizzate, nessun effetto collaterale.

**File toccati:** `types.ts`, `utils/calculationEngine.ts`, `__tests__/calculationEngine.test.ts`,
`netlify/functions/scan-payslip.ts`, `utils/printTables.ts`, `RelazioneModal.tsx`.

**NON committato. NON deployato** (per regola batch crediti Netlify): i passi 2/4/5 (prompt +
PDF + relazione) entreranno nel prossimo deploy. Il core (1/3/6) è solo logica/test, già sicuro.

**Da confermare con l'avvocato (non bloccante):**
- Salario Produttività 3B70/3B71 collocato nelle FISSE (Quadro B) — spostabile in un attimo.
- Membership esatta Quadro B RFI (eventuali altri codici 3B.. visti su altre buste).

**Possibile follow-up:** replicare la sezione % anche nell'export Excel (`handleExportExcel`),
oggi non incluso. Da valutare se l'avvocato la vuole anche lì.

# Sessione 2026-06-04 — "Carica buste → solo voci fisse" (merge-safe da file)

> Problema: tanti RFI hanno le tabelle variabili compilate ma NESSUNA busta in archivio
> (pratiche fatte prima dell'archivio). Lo scan normale in batch NON va: riscrive giorni +
> variabili (varianza OCR) e RADDOPPIA imponibile_tfr_mensile (accumula). Serve un percorso
> che estragga SOLO le voci fisse (3B..) da file caricati, merge-safe come il backfill archivio.

- [x] 0. Indagine: confermato che lo scan normale clobbera (usePayslipUpload:169-235, TFR accumula :214).
      mergeFixedVociIntoAnni è merge-safe e richiede riga esistente. Periodo: lo scan legge month/year.
- [x] 1. **Backend** `scan-payslip.ts` (action 'fixed-voci'): il prompt restituisce anche `month`
      (1-12) e `year` (4 cifre) dalla testata; risposta `{codes, retribuzioneMensile, month, year}`.
      Retro-compatibile (il backfill archivio passa year/monthIdx propri e ignora questi). ⚠️ DEPLOY
      per la produzione; in locale (`npm start`/netlify dev) è già attivo.
- [x] 2. **Hook** `useFixedVociBackfill.ts`: nuova `runFromFiles({files, anni, company, onResult, onArchive?})`.
      Per file: base64 → action 'fixed-voci' (retry 2x) → `deriveFixedVociPeriod` (month/year AI,
      fallback nome file) → mergeFixedVociIntoAnni → archiviazione best-effort se onArchive. Progress +
      Dynamic Island + stop, come `run`. Ritorna {updated, errors, skipped}. La derivazione periodo è
      stata messa in `utils/fixedVociBackfill.ts` (pura, testabile), non nell'hook.
- [x] 3. **UI** `WorkerDetailPage.tsx` (tab Archivio): input file nascosto + bottone "Carica buste →
      solo voci fisse". onResult = setMonthlyInputs + onPersistWorkerById (come confirmBackfillFixed).
      onArchive DEDUP-guarded (salta i mesi già in archiveEntries: addPayslip non deduplica i metadati).
- [x] 4. **Verifica**: tsc pulito, **127 test verdi** (5 nuovi su deriveFixedVociPeriod), build OK.
      Niente clobber: si scrivono SOLO i 3B.. via mergeFixedVociIntoAnni, mai variabili/giorni/TFR.

## Review (2026-06-04)
Fatto e verificato. Percorso merge-safe da file per le buste fuori archivio: estrae solo le voci fisse,
non tocca il resto, archivia in bonus (deduplicato). Periodo dal cedolino (AI) con fallback sul nome file.
⚠️ Il cambio backend (`fixed-voci` → month/year) entra in produzione col prossimo DEPLOY; in locale funziona.

# Sessione 2026-06-05 — Knowledge base di dominio (`knowledge/`)

> Origine: l'utente proponeva una skill per collegarsi a NotebookLM e costruire una knowledge
> base. Valutato e sconsigliato (NotebookLM senza API pubblica → ponte fragile; risposte
> pre-sintetizzate). Alternativa scelta e approvata: cartella `knowledge/` nel repo, file
> markdown letti direttamente, versionati, seedati col contenuto reale già sparso in memory/lessons.

- [x] Esplorato repo + memory + lessons per estrarre la conoscenza di dominio reale.
- [x] Creata `knowledge/` con 8 sintesi: README, glossario, ccnl-e-normativa, codici-voce,
      metodologia-calcolo, strategia-a-vs-b, verifica-pratica, avvocato-decisioni.
- [x] `knowledge/fonti/` per i documenti grezzi (CCNL/sentenze/mail/Excel) + README con
      convenzione naming e nota privacy.
- [x] `.gitignore`: escluso `knowledge/fonti/*` (dati personali), versionato solo il README.
- [x] Memory `knowledge-base-folder` + voce in MEMORY.md (consultare/mantenere la base; regola
      di smistamento knowledge vs memory vs lessons).

## Review (2026-06-05)
Base di conoscenza in piedi e già piena (non placeholder). Tre archivi con ruoli distinti:
knowledge = fatti di dominio durevoli; memory = stato del lavoro; lessons = errori da evitare.
Le fonti grezze restano fuori da git per privacy. Niente codice toccato (solo documentazione).
Prossimo passo della sessione: verifica pratica **Di Ponte Armando** quando l'utente la finisce.

# Sessione 2026-06-06 — Valutazione progetto + 3 quick win (commit / CI / pulizia)

> Origine: l'utente ha chiesto una valutazione dell'intero progetto. Salute ottima nel
> cuore (tsc pulito, 127/127 test, motore di calcolo difensivo), ma due buchi di processo:
> 1.432 righe non committate (6 giorni di lavoro nel solo working tree) e nessuna rete di
> sicurezza automatica. Approvati ed eseguiti 3 passi su branch `feature/voci-fisse-incidenza`
> (nessun deploy):

- [x] **1. P0 — protezione del lavoro** (`b8baa7d`): commit del lavoro pendente (voci fisse,
      % incidenza, Strategia B, backfill, knowledge base). Verificato che `.env`/`.claude`/
      `knowledge/fonti` restassero fuori da git. Rischio "perdita da git checkout" azzerato.
- [x] **2. P1 — CI** (`3defa85`): `.github/workflows/ci.yml` → `tsc --noEmit` + `vitest run`
      a ogni push/PR, Node da `.nvmrc`, `npm ci` dal lockfile. I 127 test ora sono un gate.
- [x] **3. P2 — pulizia** (`0a47012`): rimosse `xlsx` (0 usi, CVE storici) e `openai` (0 usi,
      backend è Gemini) via `npm uninstall` (lockfile sincronizzato → `npm ci` valido);
      corretto il commento stale di `daysPaidLeave` in types.ts (con Strategia B entra nel
      divisore della media). tsc pulito, 127/127.

## Da fare (non bloccante, emerso dalla valutazione)
- Branch ancora **locale**: pushare quando opportuno (commit ≠ deploy, zero crediti Netlify).
- Deploy del batch (prompt `fixed-voci` + % incidenza + Strategia B) quando l'avvocato sblocca.
  NB: il backfill voci fisse funziona solo in locale finché `scan-payslip` non è deployato.
- Debito a medio termine: spezzare i monoliti (DynamicIsland 2226, MonthlyDataGrid 1695),
  code-splitting dei pezzi pesanti (docx/exceljs/jspdf/pdfjs/QRScanner), ridurre i 222 `any`.
