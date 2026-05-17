# Dynamic Island — Concept UX (Apple-Style) per Railflow

> Prodotto come analisi di Product Designer Apple-ecosystem.
> Obiettivo: trasformare l'isola da "vezzo estetico" a strumento funzionalmente vitale.
> Stato: **proposte**. Da approvare prima di implementare.

---

## Quadro di analisi

L'isola oggi gestisce: idle, ticker, dropzone, menu, notify, calc, ai, calc_history, notification, stats, quick_actions, uploading. Punti di forza: presence costante, già integrata con `useIsland` in 11 componenti, già event-driven (events `island-*` / `trigger-*`).

Pain point individuati nel codice:
- **Mode `uploading` monopolizza l'isola** (15-60s per batch da `usePayslipUpload.ts`) → utente bloccato dall'usare AI/Calc.
- **Errori di validazione form sono silenziosi** → in `WorkerModal`/`CompanyBuilder` un campo invalido sotto fold può sfuggire.
- **Idle è "puro decoro"** → l'isola passa la maggior parte del tempo a respirare senza dare valore informativo.

---

## Concept A — Live Validation Pill 🎯 (alto valore funzionale)

### Scenario
L'utente apre `WorkerModal` per inserire un nuovo lavoratore. Compila Nome, Cognome, salta CF, mette un IBAN incompleto. Mentre digita:

- L'isola, già in modalità form-aware, si trasforma in **pill validatore**.
- Sul lato sinistro: piccolo dot animato (rosso se errori bloccanti, giallo se warning, verde se tutto ok).
- Al centro: counter live "**2 campi da rivedere**".
- Sul destro: chevron `>` che invita al click.
- **Tap** → l'isola si espande mostrando elenco compatto ("CF mancante · IBAN: 22 caratteri, ne servono 27") e fa scroll + focus al primo campo invalido.

### Estetica iOS
- Stessa fisica `FRAMER_PHYSICS.dynamicIsland`.
- Dot pulsante con `animate={{ scale: [1, 1.15, 1] }}` (rosso/giallo only).
- Quando l'utente corregge un errore, l'isola fa un "soft cheer": leggero scale 1.05 + boxShadow verde transitorio.
- Quando tutti i campi sono validi, l'isola si pill-orizza in verde per 800ms ("Pronto al salvataggio") poi torna idle.

### Implementazione tecnica
- Nuovo `IslandMode = 'validation'` in `IslandContext.tsx`.
- Nuovo metodo `setValidation(state: { errors: ValidationError[], focusFirstInvalid: () => void } | null)` nel context.
- `WorkerModal` e `CompanyBuilder` espongono il loro validation state via hook al context (no event listener, accoppiamento diretto via `useIsland()`).
- ~150 LOC totali. Refactor minimo dei form esistenti.

### Valore
Riduce il "form rage" — l'utente non scopre più gli errori dopo aver cliccato "Salva". Convergenza con i pattern Apple di Mail/Reminders (badge live).

---

## Concept B — Background Job Drawer 🚀 (massimo valore funzionale)

### Problema risolto
Oggi un batch upload da `usePayslipUpload.ts` (15-60s) **monopolizza** l'isola: niente menu, niente AI, niente calc. L'utente deve aspettare.

### Scenario
- L'utente avvia un upload batch di 12 buste paga. Isola entra in mode `uploading` espanso.
- Sul header dell'upload, in alto a destra, compare un piccolo glyph **"minimize"** (icona `Minimize2` da lucide).
- **Click** → l'isola si contrae a uno **stato idle-with-jobs**: forma pill normale, ma con una **piccola pill secondaria** "satellite" attaccata sul lato destro che mostra `[ 7/12 ]` + ring di progresso circolare.
- L'utente è libero di aprire menu, fare un calcolo, chiedere all'AI.
- **Hover** sulla pill satellite → preview "Batch · 7/12 · ETA 23s · busta_marzo_2026.pdf".
- **Click** sulla pill satellite → ri-espande l'upload Live Activity completa.
- A fine job: la satellite mostra brevemente check verde con badge "12 fatte" e poi si dissolve, emettendo la `showNotification` esistente.

### Estensione: Multi-Job Stack
Se l'utente avvia un secondo job (es. mobile upload mentre il batch gira), una **seconda pill satellite** appare a stack verticale sotto la prima. Layout: `flex-col gap-1.5` sul lato destro.

### Estetica iOS
- Pill satellite con la stessa fisica `FRAMER_PHYSICS.dynamicIsland`.
- Anello di progresso radiale (SVG `circle` con `strokeDasharray` animato).
- Color-coding per tipo job: violet=batch, indigo=mobile, cyan=single.
- Entry animation: dalla pill principale come "splitting cell" (motion `layout` magic).

### Implementazione tecnica
- Estendere `uploadState` in `IslandContext.tsx`:
  ```ts
  jobs: Array<{
    id: string;
    type: 'single' | 'batch' | 'mobile';
    progress: number;
    total: number;
    minimized: boolean;
    startedAt: number;
  }>
  ```
- Funzioni: `minimizeJob(id)`, `restoreJob(id)`.
- Componente nuovo: `<JobSatellite>` accanto all'isola principale, posizionato fixed con offset orizzontale.
- ~200 LOC. Refactor moderato di `IslandContext` e `DynamicIsland` per disaccoppiare il render del mode `uploading` (che oggi è inline).

### Valore
**Sblocca un workflow reale**: oggi se l'utente lancia un batch di 30 buste paga e si ricorda di dover chiedere all'AI un dubbio sul TFR, deve aspettare. Con B, no. Pattern direttamente ispirato a Live Activities iOS multi-stack.

---

## Concept C — Daily Vitals Ticker 📊 (valore informativo, costo basso)

### Scenario
L'utente apre Railflow di mattina. Per i primi 5 secondi l'isola è idle classico (la "respirazione" attuale). Dopo 15 secondi senza interazione:

- L'isola entra in **`vitals_ticker`**: soft-scroll verticale (stile flap-board) attraverso 3-4 KPI giornalieri rilevanti, uno alla volta, ognuno visibile 4 secondi:
  - "📥 12 buste oggi"
  - "⚠️ 3 da validare"
  - "⏰ 2 TFR scadenti questa settimana"
  - "💰 Netto medio mese: 1.847 €"
- Transizione fra un KPI e l'altro: il vecchio sale e dissolve, il nuovo entra dal basso (`y: 10 → 0`, blur+fade).
- **Tap** su un valore → naviga al filtro corrispondente nel DashboardPage (es. tap su "3 da validare" → apre la dashboard con filtro `statusFilter: 'pending'`).
- Movimento mouse → torna a idle pura (rispetta il focus utente).

### Estetica iOS
- Fade+blur in stile widget iOS "Smart Stack".
- Font monospace per i numeri (coerente col ticker netto già implementato).
- Padding orizzontale generoso per dare aria.
- No suoni, no flash: deve essere _ambient_.

### Implementazione tecnica
- Nuovo `IslandMode = 'vitals_ticker'`.
- Nuovo hook `useDailyVitals()` che aggrega dati da `useWorkers()` (count totale, count statuses, sum netto medio).
- Timer di idle in `DynamicIsland.tsx` che, se `mode === 'idle'` per N ms senza eventi mouse, entra in `vitals_ticker`.
- Ogni vitale ha un callback `onClick: () => void` che dispatcha un evento al dashboard.
- ~120 LOC. Hook nuovo + un sub-AnimatePresence in più.

### Valore
Trasforma il "tempo morto" dell'isola in **awareness ambientale**. Pattern Apple ovvio: widget Smart Stack, At-a-Glance di watchOS. Non rivoluzionario ma molto coerente con l'estetica.

---

## Raccomandazione

**Implementare A + B nella prossima sessione, C come fase successiva.**

- **A** ha alto valore funzionale e basso costo (~150 LOC, refactor minimo).
- **B** ha valore funzionale altissimo (sblocca un workflow oggi bloccato) e costo medio (~200 LOC, richiede refactor di `IslandContext`).
- **C** è il più "wow" ma il meno essenziale — meglio averlo dopo aver consolidato A+B.

Insieme A+B fanno passare l'isola da "decoro animato" a **strumento operativo**, mantenendo il feeling Apple-native.

---

## Concept "bonus" — idee minori per il futuro

Per non perdere idee secondarie esplorate durante il design:

- **Magic Suggestion**: quando un upload finisce con errori, la notification non è passiva ma offre bottoni inline "Riprova", "Salta", "Visualizza errori". Piccolo refactor della `finishUpload` per accettare un payload con azioni.
- **Connection Indicator**: micro-pill discreta sull'isola idle che mostra lo stato Supabase (connected/offline/syncing). Pattern iOS Status Bar.
- **Drag Preview**: in mode `dropzone`, mostrare il filename del file che si sta trascinando (richiede `dragenter` deep access — costoso, fattibilità da verificare).
- **Voice Quick Command**: tap-and-hold sull'isola idle → mic → dictation per cercare lavoratore o lanciare azione. Richiede Web Speech API.

Questi NON entrano nelle proposte principali ma sono utili da tenere a mente.
