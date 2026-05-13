# RailFlow — Roadmap Operativa

> **Ultimo aggiornamento:** 11 Maggio 2026
> **Ordine di esecuzione:** 1 → 2 → 3 → 4 → 5

---

## Stato di Partenza (Tutto completato)

| Task | Stato |
|---|---|
| `App.tsx` monolitico (1973 → 247 righe) | ✅ |
| `eval()` nella calcolatrice → parser Recursive Descent | ✅ |
| Modularizzazione `WorkerDetailPage` (hook, layout, viewer) | ✅ |
| Motore di calcolo unificato `calculationEngine.ts` + Vitest | ✅ |
| Pulizia `@ts-ignore`, commenti residui, debounce | ✅ |
| OCR Sniper → Netlify function `scan-payslip` (action: ocr) | ✅ |
| "Spiega busta paga" → Netlify function `scan-payslip` (action: explain) | ✅ |
| Dynamic Island AI → Netlify function `ask-ai` | ✅ |
| `VITE_GEMINI_API_KEY` rimossa dal bundle frontend | ✅ |
| Auth fake localStorage → Supabase Auth (email + password) | ✅ |
| `ChangePasswordModal` → `supabase.auth.updateUser()` | ✅ |
| Badge ELIOR Viaggiante / ELIOR Magazzino su tutte le schermate | ✅ |
| Relazione tecnica: codici indennità elencati singolarmente, anno esempio variabile | ✅ |
| Migrazione Apple Silicon M4 | ✅ |

### Prerequisito per il primo accesso dopo questa modifica
Devi creare un utente Supabase Auth nel tuo progetto:
1. Vai su [supabase.com](https://supabase.com) → Dashboard → tuo progetto
2. Sezione **Authentication → Users → Add User**
3. Inserisci la tua email e una password (min. 8 caratteri)
4. Da quel momento usi email + password per accedere a RailFlow

### Variabili d'ambiente da impostare in Netlify
Rimuovere `VITE_GEMINI_API_KEY` da Netlify env vars e `.env.local` — non serve più nel frontend.
Assicurarsi che in Netlify siano presenti:
- `GOOGLE_API_KEY` (chiave principale)
- `GOOGLE_API_KEY_TFR` (opzionale, fallback su GOOGLE_API_KEY)
- `GOOGLE_API_KEY_EXPLAINER` (opzionale, fallback su GOOGLE_API_KEY)
- `GOOGLE_API_KEY_ONBOARDING` (opzionale, fallback su GOOGLE_API_KEY)

---

## FASE 1 — UX Polish e Miglioramenti Interfaccia

> Miglioramenti visivi e di usabilità che rendono il tool professionale.

### Step 1.1 — Export PDF migliorato
- Qualità rendering aumentata (html2canvas pixelizza — valutare `@react-pdf/renderer` o `jsPDF` nativo)
- Aggiungere copertina alla relazione tecnica (logo, data, numero pratica)
- Verificare che tabelle e layout non vengano spezzati tra le pagine

### Step 1.2 — Keyboard shortcuts globali
- `Cmd+K` → apri Dynamic Island
- `Cmd+S` → salva bozza lavoratore corrente
- `Cmd+E` → esporta relazione corrente
- `Esc` → chiudi qualsiasi modal aperto
- Tooltip con shortcut disponibili (stile Figma)

### Step 1.3 — Miglioramento responsive e tablet
- Layout tablet per WorkerDetailPage (split view più compatta)
- Gestione touch events per OCR Sniper (attualmente solo mouse)
- Navbar adattiva su schermi < 1024px

### Step 1.4 — Onboarding e empty states
- Schermata di benvenuto per nuovo utente (nessun lavoratore inserito)
- Tooltip contestuali al primo utilizzo di OCR Sniper e "Spiega busta paga"
- Progress indicator durante import batch PDF

**Stima: 2 sessioni · Rischio: Basso**

---

## FASE 2 — Archivio Buste Paga per Lavoratore

> Fondamento obbligatorio per le Fasi 3, 4 e 5.
> Senza persistenza dei PDF le funzionalità di ricerca e RAG non sono possibili.

> ⚠️ **Decisione architetturale tassativa:** l'intero archivio è su **Supabase cloud**.
> IndexedDB e qualsiasi storage browser-locale sono stati scartati — le buste paga sono documenti sensibili e il salvataggio locale è inaccettabile. `supabaseClient.ts` e Supabase Auth sono già configurati nel progetto.

### Step 2.1 — Storage layer su Supabase
- **Supabase Storage**: bucket dedicato `payslips_archive` per i blob PDF
- **Tabella PostgreSQL** `payslip_metadata`:
  ```
  payslip_metadata:
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
    worker_id   text NOT NULL
    storage_path text NOT NULL   -- percorso nel bucket
    filename    text NOT NULL
    year        integer NOT NULL
    month       text NOT NULL
    uploaded_at timestamptz DEFAULT now()
    extracted_data jsonb          -- dati OCR già estratti
  ```
- Hook `usePayslipArchive`: `addPayslip()`, `getPayslipsByWorker()`, `deletePayslip()`
- RLS policy: ogni utente vede solo i propri record (filtro su `auth.uid()`)

### Step 2.2 — Salvataggio automatico durante upload
- Dopo ogni upload OCR riuscito, caricare il blob su Supabase Storage e inserire il record di metadati nella tabella
- Nessuna azione manuale richiesta dall'utente

### Step 2.3 — Tab "Archivio" nel profilo lavoratore
- Nuova tab in WorkerDetailPage
- Lista di tutte le buste paga caricate, ordinate per data (query sulla tabella `payslip_metadata`)
- Per ogni busta: filename, mese/anno, data upload
- Azioni disponibili: visualizza nel viewer (URL firmato da Supabase Storage), ri-analizza con AI, elimina (rimuove sia il blob che il record)

**Stima: 2-3 sessioni · Rischio: Medio**

---

## FASE 3 — Doppio Controllo AI sui Dati Estratti

> Dopo l'estrazione automatica, una seconda passata AI verifica i valori
> confrontandoli con il PDF originale e segnala le discrepanze.
> Critico per un tool che produce documenti con valenza legale.

### Step 3.1 — Pulsante "Verifica Dati" per riga mese
- Appare nella tabella dopo che i dati sono stati estratti per un mese
- Stato visuale: spinner durante verifica → badge verde (OK) o rosso (discrepanza)

### Step 3.2 — Chiamata Gemini per verifica
- Invia: PDF del mese + JSON con i valori attualmente in tabella
- Prompt strutturato:
  ```
  Sei un controllore di qualità per dati di buste paga.
  Ho estratto i seguenti valori da questa busta paga: {JSON}
  
  Per ogni voce indica:
  - "OK" se corrisponde al documento
  - "DISCREPANZA: valore corretto è X" se non corrisponde
  - "NON TROVATO" se la voce non è presente nel documento
  
  Rispondi SOLO con un JSON con la stessa struttura.
  ```

### Step 3.3 — Visualizzazione discrepanze in tabella
- Celle con discrepanza evidenziate in giallo/rosso
- Tooltip al hover: "AI suggerisce: {valore corretto}"
- Pulsante "Accetta correzione AI" per singola cella
- Pulsante "Accetta tutto" per applicare tutte le correzioni

### Step 3.4 — Log verifiche ✅
- Salvare storico verifiche nell'archivio (quante eseguite, quante discrepanze trovate)
- Statistiche di accuratezza AI visibili nel profilo lavoratore

**Stima: 2 sessioni · Rischio: Medio**

---

## FASE 4 — Ricerca Avanzata nell'Archivio

> Ricerca full-text e per concetto su tutti i documenti archiviati.
> MVP senza embeddings — ricerca strutturata sui dati già estratti.

### Step 4.1 — Ricerca base su dati estratti
- Barra di ricerca globale in Dashboard
- Cerca per: nome lavoratore, codice fiscale, anno/mese, importo (range), codice indennità
- Risultati con highlight del campo trovato
- Implementazione: filtraggio in-memory su dati IndexedDB (nessun backend necessario)

### Step 4.2 — Filtri avanzati
- Filtro per profilo (RFI, ELIOR Viaggiante, ELIOR Magazzino, ...)
- Filtro per range date (da mese/anno → a mese/anno)
- Filtro per importo (es. "buste con indennità > €X")
- Filtro anomalie (es. "buste con 0 giorni lavorati ma indennità presente")

### Step 4.3 — Ricerca semantica (opzionale, richiede AI locale)
- Generare embeddings del testo estratto da ogni PDF con `transformers.js`
- Query in linguaggio naturale: "buste paga con straordinari notturni"
- Modello leggero consigliato: `Xenova/all-MiniLM-L6-v2` (~22MB)
- Trovare documenti per concetto anche se il termine esatto non è presente

**Stima: 2 sessioni · Rischio: Basso (4.1-4.2) / Medio (4.3)**

---

## FASE 5 — RAG Chatbot Legale Multimodale

> Il feature differenziante strategico del progetto.
> Risponde a domande legali citando il contratto collettivo esatto e la sentenza Cassazione esatta con numero di pagina.
> Nessun altro tool per consulenti del lavoro offre questa funzionalità.

### Step 5.1 — Sezione "Libreria Legale"
- Nuova sezione dedicata (separata dall'archivio buste paga)
- Upload PDF di: CCNL (RFI, ELIOR, ...), sentenze Cassazione, circolari INPS, accordi aziendali
- Categorizzazione per: tipo documento, azienda di riferimento, anno, argomento
- Storage: IndexedDB locale o Supabase Storage per cloud sync

### Step 5.2 — Pipeline di ingestione e chunking
- Estrazione testo da ogni PDF con Gemini Vision (già disponibile nel progetto)
- Chunking intelligente: dividere per articolo/paragrafo, non a lunghezza fissa
  - Rispettare la struttura degli articoli CCNL (es. "Art. 45 — Ferie")
  - Mantenere il numero di pagina per ogni chunk (necessario per la citazione)
- Generazione embeddings per ogni chunk (Gemini Embeddings API o `transformers.js`)
- Struttura chunk salvato: `{ chunkId, documentId, pageNumber, articleTitle, text, embedding }`

### Step 5.3 — Motore di retrieval
- Quando l'utente fa una domanda: generare embedding della query
- Calcolare similarità coseno con tutti i chunk indicizzati
- Selezionare i top-5 chunk più rilevanti
- Passarli a Gemini come contesto per la risposta

### Step 5.4 — Chatbot UI (pagina dedicata "Consulente Legale")
- Pagina separata dalla Dynamic Island (serve spazio per le citazioni)
- Input: domanda in linguaggio naturale
- Output: risposta con citazioni esplicite, es.:
  ```
  Secondo l'Art. 45 del CCNL Ferroviario (pag. 127, edizione 2023):
  "...i lavoratori maturano 28 giorni di ferie per anno..."

  Confermato dalla sentenza Cassazione n. 20216/2022 (pag. 4):
  "...il calcolo dell'indennità sostitutiva deve includere..."
  ```
- Pulsante "Vai al documento" che apre il PDF alla pagina citata nel viewer

### Step 5.5 — Integrazione con dati lavoratore specifico
- Query contestuale: "Questo lavoratore [nome] ha diritto all'indennità X?"
- Il chatbot combina: dati estratti del lavoratore + CCNL applicabile + giurisprudenza
- Genera automaticamente un estratto pronto da inserire nella relazione tecnica peritale

> ⚠️ Complessità molto alta — è un progetto a sé stante.
> Richiede obbligatoriamente la Fase 2 (archivio) completata.
> `supabaseClient.ts` già presente nel progetto: usare Supabase pgvector per persistenza embeddings in cloud.

**Stima: 4-6 sessioni · Rischio: Alto**

---

## Variabili d'Ambiente

| Variabile | Usata in | Stato |
|---|---|---|
| `VITE_GEMINI_API_KEY` | DynamicIsland, OCR Sniper, Spiega Busta, Netlify fn | ✅ Configurata |
| `VITE_SUPABASE_URL` | `supabaseClient.ts` | ✅ Necessaria per Fase 2 |
| `VITE_SUPABASE_ANON_KEY` | `supabaseClient.ts` | ✅ Necessaria per Fase 2 |

---

## Diagramma di Esecuzione

```
FASE 1 (UX Polish)
      │
FASE 2 (Archivio PDF) ← fondamento obbligatorio per 3, 4, 5
    │         │
FASE 3     FASE 4
(Doppio    (Ricerca
 Check)    Avanzata)
    │         │
    └────┬────┘
         ↓
    FASE 5 (RAG Legale)
```

---

## Guida per la Prossima Sessione

Scegli in base all'obiettivo:

| Obiettivo | Inizia da |
|---|---|
| Migliorare look e usabilità | Fase 1 |
| Conservare i PDF per ogni lavoratore | Fase 2 |
| Verificare che l'AI non commetta errori di estrazione | Fase 3 (dopo Fase 2) |
| Cercare documenti nell'archivio | Fase 4 (dopo Fase 2) |
| Chatbot che cita CCNL e Cassazione | Fase 5 (dopo Fase 2) |

---

*Documento aggiornato l'11 Maggio 2026.*
