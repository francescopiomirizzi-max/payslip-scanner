---
name: RailFlow Refactoring State
description: Stato avanzamento refactoring FASE A WorkerDetailPage
type: project
---

FASE A Step A1 completato: creato `hooks/usePayslipUpload.ts` (499 righe). WorkerDetailPage ridotto da 3358 → 2956 righe.
FASE A Step A2 completato: creato `hooks/useOCRSniper.ts` (168 righe). WorkerDetailPage 2857 righe.
FASE A Step A3 completato il 2026-05-10: creato `hooks/useIslandSync.ts` (103 righe), estratti 3 useEffect island (scroll, trigger-*, re-affermazione contesto) + effect island-ticker + `handleContainerScroll`. `useIsland()` rimosso da WorkerDetailPage. Il hook è chiamato dopo `handlePrintTables` e `statsData` (dipendenze tardive). WorkerDetailPage ora a 2778 righe.
FASE A Step A4 completato il 2026-05-10: creato `components/SplitViewViewer.tsx` (316 righe), componente puramente visuale con 30+ props. AI explainer rimasto nel pannello sinistro (comportamento originale). WorkerDetailPage ridotto da 2778 → 2601 righe (−177 righe). Zero errori TypeScript.

FASE A Step A5 completato il 2026-05-10: creati `components/WorkerDetailLayout.tsx` (1098 righe — full JSX layout), `hooks/useStatsData.tsx` (235 righe), `utils/printTables.ts` (498 righe). WorkerDetailPage ridotto da 2601 → 593 righe (−2008 righe). Zero errori TypeScript nei file modificati. `useStatsData.ts` rinominato in `.tsx` (JSX in hook). Un errore pre-esistente in `utils/workerLogic.ts` non correlato ai cambiamenti.

**Why:** Fase A del ROADMAP, decomporre il file monolitico più critico del progetto. COMPLETATA.

FASE B Step B1 completato il 2026-05-11: creato `utils/calculationEngine.ts` (160 righe). Esporta `computeYearlyAverages` e `computeHolidayIndemnity` con interfacce `MonthDetail`, `YearResult`, `CalculationParams`. Normalizzato comportamento ggLav (guard `gg > 0` canonico). Aggiornati 3 consumer: `hooks/useStatsData.tsx`, `utils/printTables.ts`, `components/WorkerTables/AnnualCalculationTable.tsx`. Zero nuovi errori TypeScript.

FASE B Step B2 completato il 2026-05-11: Collegati dati OCR al motore unificato. FIX REATTIVITÀ: `components/TableComponent.tsx` — aggiunto prop `monthlyInputs?: AnnoDati[]` (live state vs. `worker.anni` salvato); `WorkerDetailPage.tsx` ora passa `monthlyInputs={monthlyInputs}` → OCR updates visibili immediatamente nel Report senza reload. Migrati al motore: `hooks/useDashboardStats.ts` (2 blocchi inline rimossi), `components/TableComponent.tsx` (blocco inline rimosso). Eliminato `utils/workerLogic.ts` (dead code, fonte errore TS pre-esistente). Build: 0 errori TypeScript totali (era 1 pre-B2).

Fix Card Coherence (2026-05-11): identificato e risolto bug `3B70`/`3B71` mancanti nelle exclusion list di `WorkerCard.tsx` e `StatsDashboard.tsx` — quelle due colonne (premi di produttività) erano incluse nel calcolo delle card ma escluse dal Report, causando totali divergenti. Migrati entrambi al motore unificato. Build: 0 errori TypeScript.

FASE B Step B3 completato il 2026-05-11: hardening completo di `utils/calculationEngine.ts` e `utils/formatters.ts`. Aggiunte funzioni interne `fin()`, `parseDays()`, `parseAmount()`, `parseRate()`, `monthName()`, `safeMonthIndex()`. Tutti i casi: null/undefined input, NaN/Infinity numerici, giorni negativi da OCR (clampati a 0), rate negative (clampate a 0), anno/monthIndex non validi, data/years non-array, profilo undefined, startClaimYear NaN. Corretto anche `parseLocalFloat` in formatters.ts (Infinity passava attraverso il `typeof === 'number'` check). Build: 0 errori TypeScript.

FASE B Step B4 completato il 2026-05-11: installato `vitest@4.1.5` con `--legacy-peer-deps` (react-tilt richiede React 18, progetto su React 19 — conflitto pre-esistente). Aggiunto blocco `test: { environment: 'node', globals: true }` a `vite.config.ts`, script `"test": "vitest run"` e `"test:watch": "vitest"` a `package.json`. Creato `__tests__/calculationEngine.test.ts` con **40 test** (100% pass): EXCLUDED_INDENNITY_COLS, computeYearlyAverages, guards, calcolo standard, TETTO 28/32, ticket on/off, anomalie OCR (negativi clampati, Infinity→0, formato italiano "1.234,56", string vuota, monthIndex fuori range), esclusione 3B70/3B71, multi-year con average annui a cascata, calcolo netto, assenza NaN in tutti i campi.

FASE C completata il 2026-05-11: rimossi tutti e 10 i `@ts-ignore` dal progetto. 5 erano stantii (rimossi senza sostituzione: `printTables.ts` x2, `TableComponent.tsx`, `usePayslipUpload.ts` x2). 5 sostituiti con cast espliciti: `(doc as any).lastAutoTable.finalY` in `printTables.ts` x2 e `TfrCalculationTable.tsx` x1 (jspdf-autotable non augmenta correttamente jsPDF in alcuni file); `(window as any).showSaveFilePicker()` in `IstatDashboardModal.tsx` e `useWorkers.ts` (File System Access API — narrowing `in` operator non preserva la firma callable). Contestualmente fixato `vite.config.ts` (import da `vitest/config` invece di `vite` per il blocco `test:`). Build: 0 errori TypeScript, 40/40 test verdi.

FASE C Step C3 completato il 2026-05-11: debounce 300ms su `JSON.stringify` sync in `WorkerDetailPage.tsx` — `useEffect` ora usa `setTimeout` con cleanup `clearTimeout`, evitando serializzazioni ad ogni singolo render.

FASE C Step C4 completato il 2026-05-11: estesa la test suite con `__tests__/useWorkers.test.tsx` (32 test, environment jsdom). Installati `jsdom@29`, `@testing-library/react@16`, `@testing-library/dom`. Testati: stato iniziale + localStorage rehydration, CRUD create (id auto-increment, anni template, toast), CRUD edit (campi aggiornati, anni/id preservati, nessun side-effect su altri workers), delete (mark → confirm, no-op su null), handleUpdateWorkerData/handleUpdateStatus, filtri (nome, nome+cognome invertito, profilo, ALL, combinati, nessun match), executeImport (workers rimpiazzati, settings su localStorage, no-op su null, toast), handleImportData (v2.0 JSON, v1.0 array, formato invalido → toast error, JSON malformato → toast error, no file). Nota fix critico: chiamate setter+lettore nello stesso `act()` leggono lo stato stale → split in atti separati.

**FASE C COMPLETATA.** Build: 0 errori TypeScript, 72/72 test verdi.

**OPERAZIONE QUICK WINS completata il 2026-05-11:**
- **Punto 1 (PDF bug)**: `utils/printTables.ts` — `yearsToPrint` ora filtra solo anni con dati reali (`daysWorked > 0` OR qualsiasi colonna indennità > 0); `isReferenceYear` corretto da `index === 0` a `typeof row[0] === 'string' && row[0].includes('(Rif.')`
- **Punto 4 (Mutazione stato)**: aggiunto `handleUpdateWorkerFields(fields: Partial<Worker>)` in `useWorkers.ts`; propagato via `AppRouter.tsx` e `App.tsx`; `handleSaveAiTfr` in `WorkerDetailPage.tsx` ora usa il callback React corretto invece di mutare il prop e scrivere direttamente su localStorage
- **Punto 9 (Silent catch)**: `WorkerModal.tsx` — 3 catch vuoti sostituiti con `console.error`; `QRScannerModal.tsx` — 4 catch vuoti sostituiti con `console.error`, i 3 catch AudioContext mantenuti silenti con commento esplicativo
- **Punto 10 (react-tilt)**: libreria disinstallata; `WorkerCard.tsx` — rimosso import e rimossi i 2 wrapper `<Tilt>` (fronte e retro), nessuna regressione visiva

Build: 0 errori TypeScript, 72/72 test verdi.

**FASE E Steps E1-E4 completati il 2026-05-11:**
- **E1** (filtro status + bug card): filtro AND status nella searchbar; `text-6xl` → `text-5xl` nelle card stats
- **E2** (status change rapido): badge status in `WorkerCard.tsx` è ora clickable → dropdown con 5 opzioni; `updateWorkerById` in `useWorkers.ts` per aggiornare qualsiasi worker by ID senza `selectedWorkerId`
- **E3** (note pratica): campo `notes?: string` in `Worker` type; textarea nella back face della card, auto-save on blur via `onNotesChange` callback
- **E4** (ordinamento grid): sort bar sopra la grid con opzioni Cognome / Credito / Stato; toggle asc/desc; credito sort usa `statsList.potential` già calcolato; sort è stato locale in `DashboardPage.tsx`
- Fasi E5/E6/E7 scartate (notifiche/export avanzato rimandati alla migrazione DB cloud)

**How to apply:** Per runnare i test: `npm test`. Prossima fase: migrazione Supabase (cloud DB) quando pronto.
