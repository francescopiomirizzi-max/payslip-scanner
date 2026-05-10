# RailFlow: Project Architecture & Developer Guide

## 📌 Project Overview
**RailFlow** (precedentemente Payslip Scanner) è un'applicazione web avanzata e scalabile progettata per la gestione delle indennità feriali e delle statistiche sui lavoratori per diverse aziende (come RFI, Elior, Rekeep, ecc.). 
L'obiettivo del progetto è offrire uno strumento professionale, altamente reattivo e con un'estetica premium per il calcolo dinamico di indennità, la generazione di report, la gestione CRUD dei lavoratori e il monitoraggio statistico (dashboard).

---

## 🌳 Tree Structure

Di seguito l'alberatura della cartella di lavoro principale (tipicamente la radice o la directory `src`, a seconda dell'inizializzazione):

```text
/
├── App.tsx                    # Orchestratore principale e provider di layout
├── main.tsx                   # Entry point React
├── index.css                  # Stili globali e configurazione Tailwind v4
├── index.html                 # Entry point HTML
├── vite.config.ts             # Configurazione Vite
├── package.json               # Dipendenze
├── /types                     # Definizioni dei tipi TypeScript (es. types.ts)
│
├── /hooks                     # Custom Hooks per la logica di business e di stato
│   ├── useWorkers.ts          # Gestione CRUD lavoratori, filtri, localStorage, Import/Export
│   ├── useAuth.ts             # Logica di autenticazione, login e sessione
│   ├── useDashboardStats.ts   # Motore di calcolo statistiche per la dashboard
│   └── useTheme.ts            # Gestione della Dark/Light Mode
│
├── /pages                     # Viste macro della singola applicazione (Smart Components)
│   ├── DashboardPage.tsx      # L'interfaccia principale (griglia lavoratori, carte statistiche)
│   ├── LoginPage.tsx          # Pagina di autenticazione iniziale
│   └── MobileUploadPage.tsx   # Pagina dedicata all'upload mobile tramite QR Code
│
├── /components                # Componenti isolati (Dumb & Smart)
│   ├── AppRouter.tsx          # Gestore della logica di viewMode e routing
│   ├── Background.tsx         # Sfondo animato 'Living Ocean'
│   ├── DynamicIsland.tsx      # Barra notifiche superiore (stile iOS)
│   ├── StatsDashboard.tsx     # Modale God-tier con statistiche estese (torte e grafici)
│   ├── TableComponent.tsx     # Tabella calcoli indennità feriale del lavoratore
│   ├── WorkerCard.tsx         # Card riassuntiva del singolo lavoratore (usata in Dashboard)
│   ├── WorkerDetailPage.tsx   # Pagina/Modale di dettaglio pratiche per lavoratore
│   ├── WorkerModal.tsx        # Modale per la creazione o modifica dei dati anagrafici
│   ├── QRScannerModal.tsx     # Modale per l'acquisizione di buste paga via telefono
│   ├── CompanyBuilder.tsx     # Modello costruttore aziende custom
│   └── /ui                    # Micro-componenti architetturali puri
│       ├── Toast.tsx
│       ├── ConfirmModal.tsx
│       ├── ConfirmImportModal.tsx
│       ├── ChangePasswordModal.tsx
│       ├── AnimatedCounter.tsx
│       ├── FloatingCalculator.tsx
│       └── EmptyState.tsx
│
└── /utils                     # Utility e Helper Function PURE
    ├── colorVariants.ts       # Palette colori e varianti Tailwind per le UI dinamiche
    ├── confetti.ts            # Script per animazioni triggerConfetti
    └── formatters.ts          # Funzioni di parsing per date e valute
```

---

## 🗂️ File Responsibilities

| File / Componente | Responsabilità |
| :--- | :--- |
| **`App.tsx`** | È il puro orchestratore dell'app. Istanzia gli hooks top-level (`useWorkers`, `useAuth`, `useTheme`, `useIsland`), gestisce i modali globali (Toast, ConfirmModal, Settings) e invoca `<AppRouter />`. Non contiene JSX per singole viste. |
| **`components/AppRouter.tsx`** | Riceve le props da `App.tsx` e decide quale "Pagina" renderizzare in base al `viewMode` (`home`, `stats`, `complex`, `simple`). Isola la complessità del routing condizionale. |
| **`pages/DashboardPage.tsx`** | Rappresenta l'interfaccia `home`. Riceve lavoratori e statistiche e disegna: l'Header, i bottoni rapidi, le Smart Cards statistiche, la barra di ricerca, i filtri intelligenti e la Griglia iterativa con `WorkerCard`. |
| **`pages/LoginPage.tsx`** | Gestisce unicamente l'interfaccia di login iniziale e interagisce tramite callbacks. |
| **`hooks/useWorkers.ts`** | Contiene il database in-memory (sincronizzato con `localStorage`). Esporta il CRUD (`handleSaveWorker`, `handleDeleteWorker`), l'array `filteredWorkers`, il sistema di ricerca, i custom filters e la logica di esportazione/importazione JSON. |
| **`hooks/useDashboardStats.ts`** | Isola il motore matematico. Itera sui lavoratori per fornire importi totali, numero di ticket e metriche specifiche di azienda. Passa queste variabili formattate alla Dashboard. |
| **`components/Background.tsx`** | Isola l'animazione SVG e CSS dello sfondo. Migliora le performance e rende `App.tsx` molto più leggibile. |
| **`components/TableComponent.tsx`**| Contiene l'incredibile griglia editabile con gli anni, in cui avviene il calcolo `(A/B)*C` in tempo reale sulle indennità. |

---

## 🔄 State Management & Data Flow

RailFlow non utilizza (e non necessita) di Redux o Zustand, affidandosi completamente a un solido **Pattern Presentational and Container Components** attraverso React Context e Custom Hooks top-level.

1. **Top-Level State (Orchestratore):** `App.tsx` importa lo stato da `useWorkers` e `useDashboardStats`. Qui risiede la "Truth" globale dell'app in runtime.
2. **Data Flow Unidirezionale:** I dati e le funzioni di aggiornamento vengono spinti giù tramite *Props Drilling* (moderato) al componente genitore `AppRouter.tsx`.
3. **Distribuzione View-Based:**
    - `AppRouter` smista i dati: alla `DashboardPage` passa l'array dei `filteredWorkers` e le statistiche macro.
    - Se si seleziona un lavoratore (`viewMode === 'complex'`), `AppRouter` inietta il `selectedWorker` in `WorkerDetailPage.tsx`.
    - Qualsiasi modifica interna ai componenti foglia (come eliminare un lavoratore da `DashboardPage` o ricalcolare le cifre in `TableComponent`) chiama una callback (es. `handleDeleteWorker` o `handleUpdateWorkerData`), che risale verso `useWorkers.ts`. L'hook aggiorna il `localStorage` e forza il re-render globale dei dati e delle statistiche.

---

## 🛠️ Tech Stack

- **Libreria Core:** React (v18.x) con paradigmi funzionali.
- **Tipizzazione Estesa:** TypeScript (`.tsx`). Tutte le interfacce (`Worker`, `DashboardStats`) garantiscono la Type Safety del business logic.
- **Bundler:** Vite (estremamente veloce in HMR, configurato per build ottimizzati).
- **Styling Dinamico:** **Tailwind v4** (e successivi). È importante notare che usiamo l'inclusione CSS `@tailwind utilities;` o il nuovo standard Tailwind per stili veloci inline e design glassmorfico (Backdrop-blur, mix-blend modes). Non esistono file CSS massivi, solo `index.css` per definire i layer base e le animazioni chiaveframe personalizzate (come `animate-wide-float`).
- **Animazioni:** `framer-motion` per le transizioni `AnimatePresence` dei modali e gli ingressi fluidi in pagina.
- **Icone:** `lucide-react`.

---
*Documentazione generata per le future iterazioni architettoniche del progetto.*
