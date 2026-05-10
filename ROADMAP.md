# 🗺️ RailFlow — Roadmap Operativa

> **Approvata il:** 10 Maggio 2026 · **Ordine di esecuzione:** A → B → C → D · **Vitest** sarà installato con la Fase B.

---

## Stato di Partenza

Il refactoring di `App.tsx` (Fase 1a del Health Report) è stato completato con successo: da **1973 → 247 righe**.
Estratti: `AppRouter`, `DashboardPage`, `LoginPage`, `Background`, `useWorkers`, `useAuth`, `useTheme`, `useDashboardStats`.

| Issue Originale | Stato |
|---|---|
| 🔴 P0 — `App.tsx` monolitico (1973 righe) | ✅ **Risolto** |
| 🔴 P0 — `eval()` nella calcolatrice | ✅ **Risolto** (parser Recursive Descent) |
| Checklist §7 step 1-5 (Migrazione Apple Silicon) | ✅ **Completati** |

---

## FASE A: Modularizzazione WorkerDetailPage (🔴 P0)

> **Il singolo file più critico del progetto: 3358 righe.**
> Stesso pattern usato per App.tsx: estrai hook/componente → aggiorna import → verifica build.

### Step A1 — `hooks/usePayslipUpload.ts`
- Estrarre tutta la logica di upload (singolo, batch, mobile): `handleFileUpload`, `handleBatchUpload`, `handleQRData`
- Include la comunicazione con la Dynamic Island (`island-scan-label`, progress events)
- **~300-400 righe da estrarre**

### Step A2 — `hooks/useOCRSniper.ts`
- Estrarre la modalità "Sniper" OCR: logica di ritaglio Canvas, chiamata Tesseract, parsing risultati
- Include `handleSniperShot`, `handleSniperCancel`, logica crop
- **~200-300 righe da estrarre**

### Step A3 — `hooks/useIslandSync.ts`
- Estrarre tutti gli event listener `window.addEventListener('island-*', ...)` che sincronizzano la Dynamic Island
- Include i dispatcher per context (`set-island-context`), ticker (`island-ticker`), quick actions
- **~100-150 righe da estrarre**

### Step A4 — `components/SplitViewViewer.tsx`
- Estrarre il viewer di immagini split-view (immagine busta paga a sinistra, dati OCR a destra)
- Componente puramente visuale con props
- **~200-300 righe da estrarre**

### Step A5 — `components/WorkerDetailLayout.tsx`
- Estrarre l'header del lavoratore, la tab navigation e il layout contenitore
- `WorkerDetailPage.tsx` diventa un orchestratore che compone i sotto-componenti
- **Obiettivo: ridurre WorkerDetailPage a ~1000-1200 righe**

**Stima: 3-4 sessioni · Rischio: Medio**

---

## FASE B: Motore di Calcolo Unificato (🟠 P1) + Vitest

> **La formula di Cassazione 20216/2022 è implementata in 4 punti distinti.**
> Qualsiasi modifica futura alla logica richiede 4 edit sincronizzati — rischio altissimo.

### Step B1 — Creare `utils/calculationEngine.ts`
- Implementare la formula unica: `(ΣVociVariabili / GGLavorati) × GGFerie`
- Esportare: `calculateAnnualIndemnity()`, `calculateYearlyBreakdown()`, `calculateGrandTotal()`
- Gestire: tetto ferie (28/32), filtro `daysWorked > 0`, `parseLocalFloat`, profilo aziendale

### Step B2 — Consumare il motore nei 4 punti
- `AnnualCalculationTable.tsx` → sostituire il calcolo inline (righe 150-279)
- `TableComponent.tsx` → sostituire il calcolo nel prospetto (righe 254-362)
- `RelazioneModal.tsx` → sostituire ricalcolo Excel **e** esempio numerico Word
- `workerLogic.ts` → sostituire il calcolo aggregato Dashboard

### Step B3 — Fix `RelazioneModal` Excel Export (🟠 P1 collegato)
- Eliminare il workaround `SUM()/2` (riga 634)
- L'Excel deve consumare i dati pre-calcolati dal nuovo engine, non ricalcolarli

### Step B4 — Installare Vitest e creare test di regressione
- `npm install -D vitest @testing-library/react`
- Creare `__tests__/calculationEngine.test.ts`
- Coprire la formula con almeno 10 test case (dati reali da pratiche esistenti)
- Confrontare i risultati pre/post sostituzione su almeno 3 lavoratori

> ⚠️ **Fase B è la più delicata.** Un errore qui produce totali sbagliati nei report legali.

**Stima: 2-3 sessioni · Rischio: Alto**

---

## FASE C: Pulizia e Qualità del Codice (🟡 P2 + 🟢 P3)

### Step C1 — Rimuovere `@ts-ignore` (11 occorrenze)
| File | Righe |
|---|---|
| `WorkerDetailPage.tsx` | 247, 792, 795, 1250, 1259, 1339, 1454 |
| `TableComponent.tsx` | 160 |
| `IstatDashboardModal.tsx` | 216 |
| `TfrCalculationTable.tsx` | 169 |
| `useWorkers.ts` | 216 |

Per ciascuno: aggiungere i tipi TypeScript corretti o usare type assertion esplicite.

### Step C2 — Rimuovere commenti residui
- `// 👇 INCOLLA QUI` — 2 occorrenze in WorkerDetailPage.tsx (righe 262, 827)
- Sostituire con commenti descrittivi o eliminare

### Step C3 — Debounce su `JSON.stringify` sync (🟡 P2)
- In WorkerDetailPage.tsx, righe 126-133: la serializzazione avviene ad ogni render
- Aggiungere un `useDebouncedEffect` (~300ms) per ridurre le serializzazioni
- Alternativa: usare un hash/checksum leggero invece di `JSON.stringify` completo

### Step C4 — Estendere la test suite
- Aggiungere test per `useWorkers` (CRUD, filtri, import/export)
- Aggiungere test per `useAuth`
- Obiettivo: copertura minima sulle funzioni critiche

**Stima: 1-2 sessioni · Rischio: Basso**

---

## FASE D: Integrazione AI Locale (Apple Silicon M4 + 64GB)

> Fase indipendente, da affrontare dopo il consolidamento architetturale.

### Step D1 — Installare `transformers.js` e testare WebGPU
- `npm install @xenova/transformers`
- Creare un benchmark con un PDF campione sul M4
- Verificare supporto WebGPU nel browser

### Step D2 — Creare `workers/ocrWorker.ts`
- Dedicated Web Worker per OCR offline
- Fallback su Gemini API se il locale fallisce
- Architettura: `PDF → Web Worker (transformers.js + WebGPU) → JSON → handleQRData()`

### Step D3 — Cache Layer IndexedDB
- Persistere risultati OCR per evitare re-processing

**Stima: 2-3 sessioni · Rischio: Medio**

---

## Checklist Migrazione (Sezione 7 del Report)

| Step | Azione | Stato |
|---|---|---|
| 1 | Node.js 22+ (ARM) | ✅ v24.15.0 |
| 2 | Clone repo + npm install | ✅ |
| 3 | `.env.local` presente | ✅ |
| 4 | `@tailwindcss/vite` v4 | ✅ |
| 5 | `npm run dev` funzionante | ✅ |
| 6 | Installare `transformers.js` | ⬜ → Fase D |
| 7 | Benchmark WebGPU su M4 | ⬜ → Fase D |
| 8 | Refactoring App.tsx | ✅ Completato |
| 9 | Test di regressione calcoli | ⬜ → Fase B |

---

## Diagramma di Esecuzione

```
FASE A (WorkerDetailPage) ───→ FASE B (Calcolo Unificato + Vitest) ───→ FASE C (Pulizia)
                                                                              │
                                                                      FASE D (AI Locale)
```

---

*Documento generato il 10 Maggio 2026 — Guida ufficiale per le sessioni di refactoring successive.*
