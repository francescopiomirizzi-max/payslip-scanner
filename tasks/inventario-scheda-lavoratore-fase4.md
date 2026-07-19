# Inventario Scheda Lavoratore (area Incidenza) — Fase 4 PWA mobile

Rilevato sul codice del 18/07/2026 (branch main + working tree). Tutti i percorsi sono relativi a
`/Users/francescopiomirizzi/Documents/GitHub/payslip-scanner/`.

---

## 1. Catena di montaggio e struttura verticale

Ingresso: `App.tsx:416-424` → `components/AppRouter.tsx:154-166` (viewMode `'complex'` + `selectedWorker`) →
`components/WorkerDetailPage.tsx:41` (possiede TUTTO lo stato) → `WorkerDetailProvider`
(`components/WorkerDetail/WorkerDetailContext.tsx:114`, value pass-through di ~80 campi, **non memoizzato**:
object literal a `WorkerDetailPage.tsx:874-970`) → `components/WorkerDetailLayout.tsx:26` (guscio sottile).

Ordine verticale dei blocchi dentro il layout (`WorkerDetailLayout.tsx:29-143`):

| # | Blocco | File:riga | Ruolo / note layout |
|---|--------|-----------|---------------------|
| 0 | Dropzone magnetica globale | `WorkerDetailLayout.tsx:47-126` | overlay `fixed inset-0 z-[999]`, 2 varianti ('drag' fucsia / 'folder' ambra), bottoni "Scegli una cartella" e "Annulla" |
| 0b | MovingGrid (sfondo) | `WorkerDetailLayout.tsx:13-20` | 3 blob `blur-[120px] animate-blob` + griglia CSS — puro decoro, costoso su GPU mobile |
| 1 | Header glass | `WorkerDetail/WorkerDetailHeader.tsx:22` | wrapper `pt-20 px-6` (`WorkerDetailLayout.tsx:130`); riga singola `flex justify-between`, **nessun wrap** |
| 2 | VertenzaTimeline | `WorkerDetail/VertenzaTimeline.tsx:12` | barra "STATO VERTENZA" + ticker stats centrale (`hidden xl:flex`) + 3 toggle; timeline a scomparsa con **5 step** |
| 3 | CommandBar | `WorkerDetail/WorkerDetailCommandBar.tsx:12` | `flex flex-wrap` (già wrappa), spotlight mouse-only; 3 tasti scan + 4 tab |
| 4 | Content | `WorkerDetail/WorkerDetailContent.tsx:60` | pannello `min-h-[calc(100vh-250px)]` (r.88) con tab-children + `SplitViewViewer` affiancato (45% width, r.175-214) + pannello Explainer AI (r.92-156) |
| 5 | HUD overlay | `WorkerDetail/WorkerDetailHuds.tsx:8` | batch "Motore Neurale" e scanner singolo, `fixed inset-0 z-[200]` |
| 6 | Toast batch | `WorkerDetail/WorkerDetailToast.tsx:8` | `fixed bottom-8 right-8 z-[250]`, w-96 |
| 7 | Modali | `WorkerDetail/WorkerDetailModals.tsx:10` | QRScannerModal, IstatDashboardModal, modale AI-TFR (`z-[99999]`), modale info ticker (`z-[99999]`) |

Contenuto dei tab (children montati da `WorkerDetailPage.tsx`):

| Tab | Componente | File:riga mount | Note |
|-----|-----------|-----------------|------|
| `input` | MonthlyDataGrid | `WorkerDetailPage.tsx:974` | il monolite (1922 righe) |
| `calc` | AnnualCalculationTable | `WorkerDetailPage.tsx:999` | landing del viewer readonly (`:258-264`) |
| `pivot` | IndemnityPivotTable | `WorkerDetailPage.tsx:1014` | |
| `tfr` | TfrCalculationTable | `WorkerDetailPage.tsx:1026` | **owner-only** (viewer rimbalzato su calc, `:268-270`) |
| `archive` | barra Voci fisse + PayslipArchiveTab | `WorkerDetailPage.tsx:1036-1117` | barra backfill owner-only |

Extra a livello pagina: modale backfill voci fisse (`WorkerDetailPage.tsx:1122`, `z-[1000]`),
`AccuracyCheckModal` (`:1173`, `z-[9999]`), e swap a schermo intero su `TableComponent` quando
`showReport` (`:857-871` — il "Vai al Report" NON è una modale, sostituisce l'intera pagina).
Il tab vive nel 4° segmento dell'hash `#/worker/:id/:tab` (`:76-85`).

---

## 2. Inventario controlli interattivi (label REALI dal codice)

### 2.1 Header (`components/WorkerDetail/WorkerDetailHeader.tsx`)

| Controllo | Label/title esatto | Cosa fa | Riga | Gate |
|-----------|--------------------|---------|------|------|
| Bottone | "DASHBOARD" | `onBack` → torna alla dashboard | 78-86 | tutti |
| Select | "Start Year" / opzioni "Inizio Calcoli: {y}" (2008-2025) | `onStartClaimYearChange` | 88-114 | tutti (nessun gate readonly!) |
| Chip | "manca {Mese} {Anno}" + title "Busta paga da sistemare…" | avviso fixTargets | 152-183 | visibile a tutti |
| Bottoncino nel chip | title "Segna come sistemato (rimuove l'avviso)" | rimuove il fixTarget (`onUpdateWorkerFields`) | 165-179 | `!isReadOnly` |
| Bottone/input inline | "Assunzione: …" / placeholder "gg/mm/aaaa" | edit data assunzione (cloud+localStorage) | 186-212 | edit `!isReadOnly` |
| Dropdown | "Azioni" (label `hidden lg:inline`) | apre menu | 221-230 | tutti |
| Voce menu | "Calcolo interessi (ISTAT)" | apre IstatDashboardModal | 240-246 | tutti |
| Voce menu | "Verifica accuratezza (dal disco)" | apre AccuracyCheckModal | 247-255 | `!isReadOnly` **e** profilo ∈ {RFI, TRENITALIA, FSE, MERCITALIA} |
| Voce menu | "Invia PEC" | mailto precompilato diffida | 256-264 | `!isReadOnly` |
| Bottone | "Download" (label `hidden xl:inline`) | `onPrintTables` → PDF conteggi (jspdf on-demand) | 271-279 | tutti |
| Bottone | "Vai al Report" (label `hidden xl:inline`) | `setShowReport(true)` → TableComponent | 282-290 | tutti |
| Bottone | "Archivio" + badge conteggio, title "Archivio PDF buste paga" | toggle tab archive/input | 293-315 | tutti |

### 2.2 VertenzaTimeline (`components/WorkerDetail/VertenzaTimeline.tsx`)

| Controllo | Label esatto | Cosa fa | Riga | Gate |
|-----------|--------------|---------|------|------|
| Bottone | "STATO VERTENZA" + chevron | apre/chiude la timeline | 50-61 | tutti |
| Ticker centrale | card cliccabili (v. 2.8) con "(?)" | apre modale info ticker | 64-94 | **`hidden xl:flex`** → INVISIBILE sotto xl/mobile |
| Toggle | "32gg" ⇄ "28gg", title "Includi/Escludi Ex-Festività" | `onToggleExFest` | 98-108 | tutti (nessun gate readonly) |
| Toggle | "Ticket", title "Includi/Escludi Ticket Restaurant" | `onToggleTickets` | 109-119 | tutti |
| Toggle | "Permessi", title "Strategia B: conta le assenze retribuite…" | `onTogglePaidLeave` | 120-130 | tutti |
| 5 TimelineStep (cerchi 40px) | `analisi`→"Da Analizzare", `pronta`→"Conteggi", `inviata`→"Buste Paga Mancanti", `trattativa`→"Conclusa", `chiusa`→"Pagata" | click = `onLegalStatusChange`+`onUpdateStatus` | 146-150 (click handler 35) | click solo `!isReadOnly` |

⚠️ Gli id degli step non corrispondono più alle label (semantica riciclata) — v. §6.

### 2.3 CommandBar (`components/WorkerDetail/WorkerDetailCommandBar.tsx`)

| Controllo | Label esatto (2 righe) | Cosa fa | Riga | Gate |
|-----------|------------------------|---------|------|------|
| input nascosto | `#dashboard-ai-upload` (multiple, pdf+img) | batch upload | 48-56 | — |
| input nascosto | `#dashboard-ai-upload-folder` (webkitdirectory) | upload cartella | 61-69 | — |
| Bottone | "Auto-Scan / AI AGENT" | apre file picker batch | 73-100 | `!isReadOnly` |
| Bottone | "Multi-anno / CARTELLA", title "Apre l'area di sgancio…" | apre dropzone 'folder' | 108-136 | `!isReadOnly` |
| Bottone | "SCAN AI Busta paga" ("Analisi in corso..." se busy) | scan singolo (scanRef) | 144-182 | `!isReadOnly` |
| input nascosto | scanRef (image/pdf singolo) | — | 186 | — |
| Bottone | "Connetti / Mobile Scan", title "Connetti lo Smartphone" | apre QRScannerModal | 190-211 | `!isReadOnly` |
| Tab | "Inserimento Mensile" | `onSetActiveTab('input')` | 217-231 | tutti |
| Tab | "Riepilogo Annuale" | `onSetActiveTab('calc')` | 234-248 | tutti |
| Tab | "Analisi Voci" | `onSetActiveTab('pivot')` | 251-265 | tutti |
| Tab | "Prospetto TFR" | `onSetActiveTab('tfr')` | 273-287 | `!isReadOnly` (nascosto al viewer) |

### 2.4 MonthlyDataGrid (`components/WorkerTables/MonthlyDataGrid.tsx`) — il monolite

**Barra PERIODO piena** (`:1155-1291`, quando il visore è chiuso):

| Controllo | Label/title esatto | Cosa fa | Riga | Gate |
|-----------|--------------------|---------|------|------|
| Frecce anno | title "Anno precedente"/"Anno successivo" | `goPrevYear/goNextYear` | 1168-1175, 1198-1205 | tutti |
| Pillole anno (griglia auto-fill minmax(78px,1fr)) | "{anno}" + dot copertura, title "{anno} · completo (12/12)" ecc. | `handleYearChange` | 1176-1197 | tutti |
| Occhio | "Visore", title "Carica busta paga — apri il visore affiancato alla griglia" | `onToggleViewer` (apre SplitViewViewer) | 1211-1223 | tutti (`onToggleViewer` sempre passato) |
| Badge | "PDF {n}/12", title "Buste paga in archivio per il {anno}…" | apre tab Archivio | 1227-1240 | tutti |
| Toggle vista | "Variabili" / "Fisse" (title "Voci variabili (indennità del credito)" / "Voci fisse continuative (Quadro B)…") | `setGridMode` | 984-999 | solo profili con voci fisse (RFI/Trenitalia); non gated readonly |
| Bottone | "Verifica anno" ("Verifico {d}/{t}…" in corso), title "Verifica AI di tutti i mesi del {anno}…" | batch verify sequenziale | 1002-1018 | `!isReadOnly` + PDF in archivio |
| Bottone | "Annulla" + badge contatore, title "Annulla ultima modifica (Ctrl+Z)" | `handleUndo` | 1020-1040 | tutti (disabled se history vuota) |
| Bottone | "Manuale Legale" | apre LegalManualModal | 1251-1257 | tutti |
| Bottone | "Archivio", title "Apri l'archivio buste paga di questo lavoratore" | `onOpenArchive` | 1260-1269 | tutti |
| Card KPI | "Media Giornaliera" / "Totale Indennità Variabili" | display (hover lift) | 1275-1289 | tutti |

**Barra COMPATTA** (visore aperto, `compact`, `:1096-1149`): ‹ / select "Anno selezionato" (con
"— completo"/"— n/12" nelle option) / › + vistaToggle + verifyYearBtn + undoBtn + "Chiudi visore" (1139-1148).

**Ticker legale** "Nota Metodologica:" (marquee infinito, `:1294-1339`, solo `!compact`).

**Struttura tabella** (`:1341-1900`): ghost scrollbar sopra (1341) e sotto (1892) sincronizzate a 3 vie
(`:451-506`, lock anti-loop `isSyncing` + `isScrolling` via ref — commento "per evitare loop" a r.506);
frecce laterali hold-to-scroll w-10, **visibili solo in hover del container** (1353-1362, 1879-1888);
`<table>` `minWidth = colonne×100px` (1367), `thead sticky z-[150]` (1368), prima colonna sticky left
(header z-200, celle z-20), `tfoot sticky bottom z-20` con riga "TOTALE {anno}" (1831-1875).

**Controlli per riga/cella:**

| Controllo | Label/title | Cosa fa | Riga | Gate |
|-----------|-------------|---------|------|------|
| Cella mese (click) | title "Clicca per bloccare/sbloccare l'evidenziatore su questo mese" | pin evidenziatore riga | 1562-1571 | tutti |
| Icone alert mese | title "ERRORE: Indennità senza giorni lavorati…" / "ATTENZIONE: Totale giorni…" / tooltip "Avviso AI:" | validazione divisore/giorni/AI | 1573-1586 | display |
| Semaforo verify (dot 8px) | tooltip "⚠ Discrepanze trovate"/"⚡ Anomalie minori" | esito verifica AI | 1589-1621 | display |
| Scudo verify per-riga | title "Verifica dati con AI (confronta con il PDF archiviato)" (+ varianti esito) | `onVerifyRequest(row)` — chiamata Netlify/Gemini | 1627-1686 | ⚠️ **NON gated readonly** (solo `hasArchive`), v. §6 |
| Bottone "Accetta tutto" | title "Accetta tutte le {n} correzioni AI" | `onAcceptAllCorrections` | 1690-1705 | ⚠️ non gated readonly |
| Bottone nota | (icona MessageSquareText) | apre NoteModal | 1707 | tutti (modale readonly-aware) |
| Input cella | `input-{row}-{col}`, type text `inputMode="decimal"` | `handleCellChange` a ogni keystroke → `updateDataWithHistory` → `onDataChange` | 1713-1740 | `disabled` se formula / `isReadOnly` / paidLeaveMerged (title Strategia B a 1719-1721) |
| Quadratino drag-to-fill (10px) | title "Trascina per copiare i valori in ogni direzione" | fill 2D omnidirezionale | 1743-1749 | solo cella attiva, mouse-only |
| Tooltip ferie | "Soglia Legale Superata" (delay 500ms hover) | spiega tetto 28gg | 1753-1785 | hover-only |
| Dot discrepanza cella + popover | "AI Suggerisce … / Accetta correzione" | `onAcceptCorrection` | 1790-1819 | ⚠️ non gated readonly |

**Interazioni globali griglia:** selezione multipla drag (mousedown celle, 313-327) + Canc/Backspace =
cancellazione massiva (934-976); menu tasto destro (`handleContextMenu` 681, `CellContextMenu.tsx`:
"Copia" 42, "Incolla" 50, "Svuota Intero Mese" 60, "Gestisci Note / Eventi" 71); tastiera: frecce/Enter/Tab
navigazione (726-834 con scroll fluido custom), **Alt+C** svuota mese (728), **Ctrl+Z** undo globale (372-381);
paste TSV multi-cella da Excel (835-863). Sync visore→tabella sull'anno del PDF (423-429).

**Modali figlie della griglia:** `NoteModal.tsx` (textarea "Scrivi qui il motivo...", quick tags, "Pulisci",
"Annulla/Chiudi", "Salva Nota" — save/clear gated `!isReadOnly`); `LegalManualModal.tsx` ("Chiudi Manuale");
`ClearMonthConfirmModal.tsx` (conferma/annulla azzeramento); `UndoToast.tsx` ("Ripristina" + X, stile Gmail 7s).

### 2.5 Tab Riepilogo Annuale (`components/WorkerTables/AnnualCalculationTable.tsx`)

| Controllo | Label esatto | Cosa fa | Riga | Gate |
|-----------|--------------|---------|------|------|
| Toggle | "Tetto: 32gg (+ExFest)" ⇄ "Tetto: 28gg (Solo Ferie)", title "Include le 4 giornate di Ex Festività…" | `setIncludeExFest` **LOCALE** (⚠️ separato dal toggle di pagina, v. §6) | 242-252 (state 70) | tutti |
| Toggle | "Mostra Parametri" ⇄ "Nascondi Dettagli" | mostra 4 colonne coeff | 255-261 | tutti |
| Riga anno (click) | "{anno}" + chevron + badge "Rif. Media" | espande i 12 mesi | 304-306 | tutti |
| Input coeff annuale ×2 | placeholder "Misto" | `handleAnnualCoeffChange('coeffPercepito'/'coeffTicket')` → **scrive su data** via onDataChange | 340-347, 355-362 | ⚠️ nessun gate readonly nel componente (RLS a valle) |
| Input coeff mensile ×2 | — | `handleCoeffChange` → onDataChange | 405-411, 419-425 | idem |
| Input | "Soglia" % (title "Soglia % minima delle voci variabili per il ricorso") | stato locale, banner ✓/✗ | 454-461 | tutti |
| Input | "Interessi/Rivalutazione:" % | stato locale, riga interessi nel riepilogo | 514-520 | tutti |
| Bottone | title "Copia totale" | clipboard del TOTALE DA LIQUIDARE | 558-563 | tutti |
| Empty-state | "Vai all'Inserimento Mensile" | `onGoToInput` | 213-219 | tutti |

Tabella `min-w-[1000px]` + prima colonna sticky (265-268); blocco "Incidenza % delle voci variabili"
con tabellina % per anno (446-496); "Riepilogo Finale" con totali (498-567).

### 2.6 Tab Analisi Voci (`components/WorkerTables/IndemnityPivotTable.tsx`)

| Controllo | Label esatto | Cosa fa | Riga |
|-----------|--------------|---------|------|
| Toggle vista | "TOTALI (€)" / "MEDIA GIORNALIERA" (title "Mostra la media giornaliera…") | `setViewMode` | 225-243 |
| Empty-state | "Vai all'Inserimento Mensile" | `onGoToInput` | 196-202 |
| Info voce (hover) | icona Info `opacity-0 group-hover` + tooltip descrizione | hover-only | 301-305 |

Tabella pivot: `minWidth = (anni+2)×100px` (269), prima colonna sticky `w-64 min-w-[250px]` (272),
colonne anno `min-w-[90px]` (276), tfoot sticky "TOTALE VOCI"/"MEDIA GIORNALIERA TOTALE" (323-337).
Nessuna scrittura dati.

### 2.7 Tab Prospetto TFR (`components/WorkerTables/TfrCalculationTable.tsx`) — owner-only

| Controllo | Label esatto | Cosa fa | Riga |
|-----------|--------------|---------|------|
| Bottone | "Base Storica: € … al 31/12/{anno}" oppure "NON IMPOSTATA (CLICCA QUI)" (title "Clicca per modificare la Base Storica") | apre modale Punto Zero | 260-277 |
| Bottone | "Genera Report" | `handlePrintTFR` (PDF) | 283-291 |
| Cella "Imponibile Utile" (click) | header "Editabile Manualmente" | edit inline → input number + Save/X → `onDataChange` (override `imponibile_tfr_annuale`) | 303, 324-326 (handler 47-80) |
| Modale Punto Zero | input importo + anno, "Annulla" / salva | `onUpdateWorkerFields({tfr_pregresso…})` | 442-466 (handler 84) |
| Empty-state | "Vai all'Inserimento Mensile" | `onGoToInput` | 224-231 |

Header a 6 colonne `HeaderTooltip` hover (301-306), `thead sticky z-100`.

### 2.8 Ticker stats (`hooks/useStatsData.tsx`)

Card (definite 64-187, triplicate a 192 per il loop marquee; click → modale info "HO CAPITO"):

1. "TOTALE DA LIQUIDARE" (nettoRecuperabile)
2. "TOTALE ISTAT + INTERESSI"
3. "LORDO SPETTANTE"
4. "TFR SU DIFFERENZE" — **filtrata per il viewer** (`WorkerDetailPage.tsx:841-846`)
5. "GIÀ PERCEPITO"
6. "TOTALE BUONI PASTO"
7. "FONDO TFR STORICO" (solo se `tfr_pregresso > 0`) — filtrata per il viewer

Motore: `computeHolidayIndemnity` (`utils/calculationEngine`) + `calculateLegalInterestsAndRevaluation`
(`istatService`), memo su monthlyInputs/toggles/startClaimYear.

### 2.9 Visore affiancato (`components/SplitViewViewer.tsx`)

| Controllo | Label/title esatto | Cosa fa | Riga | Gate |
|-----------|--------------------|---------|------|------|
| Bottone | "Archivio", title "Torna all'archivio per scegliere altre buste" | torna al picker | 169-175 | se buste aperte + archivio |
| Frecce | ‹ "{i} / {n}" › | prev/next file | 180-186 | >1 file |
| Badge | "{Mese} {Anno}" del PDF | display + sync griglia | 196-201 | — |
| Toggle | "OCR" ⇄ "STOP" | modalità cecchino (sniper) | 208-215 | tutti (mouse-only!) |
| Bottone | title "Migliora Leggibilità" | filtro contrasto | 218-220 | tutti |
| Bottone | title "Ruota Immagine" | +90° | 221-223 | tutti |
| Bottoni | title "Riduci Zoom" / "Centra e Ripristina" / "Aumenta Zoom" | zoom/reset | 226-234 | tutti |
| Bottone | (Trash, **senza title**) | elimina file corrente dal visore | 237-242 | `!isReadOnly` |
| Bottone | title "Chiudi Visore" | `onClose` | 246-248 | tutti |
| FAB | "Spiega questa Busta Paga" (tooltip hover) | `onExplainPayslip` → explainer AI | 306-314 | `!isReadOnly` |
| Picker archivio | pillole anno (355), "Tutto l'anno" title "Apri tutte le {n} buste del {anno}" (389), bottoni mese (400) | `onOpenArchivedPicks` | 344-414 | readonly + owner (modo archive) |
| Toggle owner | "Carica busta paga" / "Carica dall'archivio" | `setEmptyMode` | 429-440 | `!isReadOnly` |
| Dropzone | "Carica Buste Paga" | file picker locale | 448-455 | `!isReadOnly` |

Pan/sniper usano SOLO onMouseDown/Move/Up (props da `WorkerDetailPage.tsx:763-782`) — niente touch.
Larghezza animata `width: '45%'` (148).

### 2.10 Tab Archivio (`components/WorkerTables/PayslipArchiveTab.tsx` + barra voci fisse)

Barra voci fisse (`WorkerDetailPage.tsx:1038-1104`, gate `hasFixedProfile && !isReadOnly`):
select "Voci fisse · anno" (1041), bottone "Estrai voci fisse — {anno}" (1051, title "Rilegge le buste
archiviate…"), "Carica buste → solo voci fisse" (1066, title "Per le buste NON in archivio…"),
input nascosto (1078), "Ferma" (1094, title "Ferma l'estrazione…").

PayslipArchiveTab:

| Controllo | Label/title esatto | Cosa fa | Riga |
|-----------|--------------------|---------|------|
| Select | "Vai all'anno…" (title "Salta direttamente a un anno dell'archivio") | scroll all'anno | 343-353 |
| Bottone | "Torna alla griglia" (title "Torna alla tabella di inserimento mensile") | `onBackToGrid` | 356-367 |
| Bottone | "Scarica ZIP · {n}" (title "Scarica tutte le buste paga come ZIP suddiviso per anno") | download ZIP | 369-390 |
| Header anno | "{anno}" + "{n} busta paga" + chevron | apre/chiude cartella | 440-457 |
| Badge verifica | title "{n} verifiche · ultima: …" | display storico | 515-522 |
| Bottone | title "Ri-analizza con AI" | `handleReanalyze` | 529-551 |
| Bottone | title "Visualizza PDF" | apre nel visore (`onOpenInViewer`) | 554-565 |
| Bottone | title "Elimina" → conferma inline "No" / "Sì" | `handleDelete` | 577-605 |

### 2.11 Modali raggiungibili dalla scheda (trigger → modale)

| Modale | Trigger | File | z-index | Controlli chiave |
|--------|---------|------|---------|------------------|
| QRScannerModal | CommandBar "Mobile Scan" | `components/QRScannerModal.tsx` | `z-[9999]` | toggle modalità ai/archive (654/658), chiudi (626), CTA chiudi (732) |
| IstatDashboardModal | Azioni → "Calcolo interessi (ISTAT)" | `components/WorkerTables/IstatDashboardModal.tsx` | `z-[99999]` | chiudi (260), "STAMPA RELAZIONE PDF" (387-393) |
| Modale AI-TFR "TFR Storico Rilevato!" | evento `ai-found-tfr-base` post-scan | `WorkerDetail/WorkerDetailModals.tsx:59-111` | `z-[99999]` | input "Importo Trovato"/"Anno di riferimento", "Ignora", "CONFERMA" |
| Modale info ticker | click card ticker | `WorkerDetailModals.tsx:114-150` | `z-[99999]` | X, "HO CAPITO" |
| Modale backfill voci fisse | "Estrai voci fisse — {anno}" | `WorkerDetailPage.tsx:1122-1171` | `z-[1000]` | "Annulla", "Estrai", "Ok" |
| AccuracyCheckModal "Prova d'accuratezza" | Azioni → "Verifica accuratezza (dal disco)" | `components/WorkerTables/AccuracyCheckModal.tsx` | `z-[9999]` | "Scegli la cartella delle buste" (80-89, webkitdirectory), "Chiudi", "Applica correzioni" (231-236) |
| NoteModal / LegalManualModal / ClearMonthConfirmModal / CellContextMenu / UndoToast | dalla griglia | `components/WorkerTables/*` | vari | v. §2.4 |

Scorciatoie tastiera di pagina (`WorkerDetailPage.tsx:545-568`): **Esc** chiude split/QR/report/AI-TFR/
ticker/explainer; **Ctrl+S** forza sync + toast; **Ctrl+E** apre il Report.

---

## 3. Modello dati e scritture

**Stato master:** `monthlyInputs` (`WorkerDetailPage.tsx:42`) — array `AnnoDati[]` copia di `worker.anni`.
**Sync:** debounce 300ms (`:59-69`) → `onUpdateData` = `handleUpdateWorkerData`
(`hooks/useWorkers.ts:503-507`) → `setWorkers`/`setSelectedWorker` → auto-sync cloud con upsert
Supabase debounced (`useWorkers.ts:233-238`; in readonly `authUser` è null → nessuna scrittura).

**Chi scrive su `monthlyInputs`** (tutti passano dal medesimo canale controllato):

| Scrittore | Meccanismo | File:riga |
|-----------|-----------|-----------|
| MonthlyDataGrid | `onDataChange` = `handleDataChange` (griglia **controllata**: props `data` + `onDataChange`); ogni keystroke di cella → `handleCellChange` → `updateDataWithHistory` (snapshot undo, max 100) | `WorkerDetailPage.tsx:601`, `MonthlyDataGrid.tsx:627-642, 359-369` |
| AnnualCalculationTable | `onDataChange` per i coeff `coeffPercepito`/`coeffTicket` (annuale e mensile) | `AnnualCalculationTable.tsx:94-122` |
| TfrCalculationTable | `onDataChange` per override `imponibile_tfr_*` + `onUpdateWorkerFields` per Punto Zero | `TfrCalculationTable.tsx:47-96` |
| usePayslipUpload | `setMonthlyInputs` diretto (scan batch/singolo/QR outbox) + `onArchive` | `WorkerDetailPage.tsx:368-395`, `hooks/usePayslipUpload.ts` |
| useOCRSniper | `setMonthlyInputs` sulla cella attiva (`activeCell` da `onCellFocus`) | `WorkerDetailPage.tsx:462-480`, `hooks/useOCRSniper.ts` |
| useFixedVociBackfill | `onResult` → `setMonthlyInputs` + **`onPersistWorkerById`** (salvataggio app-level che sopravvive alla navigazione) | `WorkerDetailPage.tsx:321-366`, `hooks/useFixedVociBackfill.ts` |
| Verify AI accept | `handleAcceptCorrection` / `handleAcceptAllCorrections` | `WorkerDetailPage.tsx:160-183` |
| AccuracyCheckModal | `applyTruthFixes` | `WorkerDetailPage.tsx:47-56` |

**Campi worker (non-anni):** `onUpdateWorkerFields` (`useWorkers.ts:515`) da: effetto startClaimYear
(`:397-400`), effetto toggle ExFest/Tickets/PaidLeave (`:508-513`), dataAssunzione e fixTargets (header),
tfr_pregresso (modale AI-TFR e Punto Zero). Doppioni localStorage: `startYear_`, `exFest_`, `tickets_`,
`paidLeave_`, `assunzione_` (fallback legacy).

**Archivio:** `usePayslipArchive` (`addPayslip`, `getSignedUrl(s)`, `addVerifyLog`); delete solo da
PayslipArchiveTab. **Rete:** `/.netlify/functions/verify-payslip` (`WorkerDetailPage.tsx:127`),
`/.netlify/functions/scan-payslip` action explain (`:816`).

**Implicazione per la Fase 4:** la griglia è GIÀ separata dal modello (componente controllato): una
`MobileMonthlyView` può ricevere le stesse props (`data`, `onDataChange`, `initialYear`, `verifyStates`…)
e riusare gli stessi hook della pagina senza toccare né `WorkerDetailPage` né il canale di sync.
Attenzione: l'undo history vive DENTRO MonthlyDataGrid (state `history`, `:342`) — una vista mobile
separata non la condividerebbe (o si accetta, o si solleva a livello pagina).

---

## 4. Rischi overflow / mobile a 390px

1. **Header pagina senza wrap** (`WorkerDetailHeader.tsx:73`): `flex justify-between` con entrambi i
   lati `shrink-0` → overflow orizzontale certo a 390px. Nome lavoratore già `hidden md:block` (127) —
   su mobile oggi sparirebbe. Label bottoni già `hidden xl:inline` (icon-only sotto xl).
2. **Ticker stats invisibile sotto xl** (`VertenzaTimeline.tsx:64` `hidden xl:flex`): su mobile le 6-7
   card statistiche NON esistono — serve una resa alternativa (le card + modale info ci sono già).
3. **Griglia mensile**: `minWidth = colonne×100px` (`MonthlyDataGrid.tsx:1367`) → con profili a 20+
   colonne ≥2000px. GIÀ scrollabile (container `overflow-auto` + ghost scrollbar sync), MA: frecce
   laterali w-10 (80px totali persi) rivelate solo in hover (1359), ghost scrollbar è hover-reveal,
   prima colonna sticky ok. Barra PERIODO: zona anni `min-w-[300px]` (1167) + KPI cards con divider
   `border-l` non pensati per wrap totale.
4. **Interazioni mouse-only nella griglia**: drag-to-fill (quadratino 10px, `:1746`), selezione multipla
   celle (mousedown/mouseenter), cancellazione massiva via tasto Canc, menu contestuale right-click,
   navigazione tastiera, Alt+C, Ctrl+Z/S/E — nessun equivalente touch.
5. **Hover-only informativi**: tooltip codici voce (delay 300ms, `:1401`), tooltip ferie (delay 500ms,
   `:1760`), popover discrepanze AI (PortalTooltip hover), info pivot `opacity-0 group-hover`
   (`IndemnityPivotTable.tsx:301`), HeaderTooltip TFR, spotlight CommandBar — invisibili al touch.
6. **Target <44px sui controlli essenziali**: scudo verify e nota `p-1.5` (~27px), semafori 8px,
   pillole anno `py-1` (~28px), toggle timeline `py-1.5` (~30px), step timeline 40px, azioni archivio
   `p-1.5`, zoom visore `p-2` (~36px). Input cella h-10 (40px) è al limite ma accettabile.
7. **SplitViewViewer width 45%** (`SplitViewViewer.tsx:148`) — inutilizzabile affiancato su 390px;
   pan/pinch assenti (mouse events); già `compact` mode sulla griglia quando aperto (riusabile).
8. **Tabelle degli altri tab**: Annual `min-w-[1000px]` (265) con prima colonna sticky — già in
   `overflow-auto` (`WorkerDetailPage.tsx:998`); Pivot `minWidth (anni+2)×100px` con sticky col
   250px (≈2/3 dello schermo a 390px!); TFR `table-fixed w-full` a 6 colonne → colonne ~65px illeggibili.
9. **Fixed/sticky/z-index**: dropzone `z-[999]`, HUD `z-[200]`, toast `z-[250]` (bottom-8 right-8, w-96
   ma con `max-w-[calc(100vw-4rem)]` ok), modali `z-[9999]`/`z-[99999]`, thead `z-[150]`, celle
   `hover:z-[1000]`, th `hover:z-9999!` — scala z incoerente ma internamente funzionante; da verificare
   la convivenza con la DynamicIsland su viewport mobile.
10. **Costo GPU/CPU**: MovingGrid (3 blob blur 120px animati), 2 marquee framer infiniti (ticker legale
    + ticker stats), conic-gradient spin sui bottoni scan — su mobile pesano; il ticker stats è già
    assente sotto xl, il resto no.
11. **Provider non memoizzato** (`WorkerDetailPage.tsx:874`): ogni keystroke in griglia (via debounce
    dello stato pagina... no: `monthlyInputs` cambia a OGNI keystroke) ricrea il context value → re-render
    di Header/Timeline/CommandBar/Huds/Toast/Modals. Su desktop regge, su mobile è un rischio prestazioni
    concreto per la vista griglia.

---

## 5. Punti di taglio naturali per le tranche

Criterio: seguire i confini dei componenti già estratti (la Fase-2 di refactor ha già isolato le sezioni);
non toccare MonthlyDataGrid internamente finché possibile; il modello dati resta invariato ovunque.

**T1 — Shell della scheda (header + timeline + command bar).**
File: `WorkerDetailHeader.tsx`, `VertenzaTimeline.tsx`, `WorkerDetailCommandBar.tsx`,
`WorkerDetailLayout.tsx` (padding/pt-20), eventuale `index.css`.
Contenuto: header a 2 righe wrappabili (identità sopra, azioni sotto, menu "Azioni" può assorbire
Download/Report su mobile); ticker stats mobile = griglia di card tappabili (riusa `tickerItems` e la
modale info esistente — su mobile niente marquee); toggle e step timeline a target 44px.
Rischio: **basso** — solo lettura del context, zero scritture dati. È anche il prerequisito visivo di tutto il resto.

**T2 — Vista mensile mobile (il cuore).**
File: nuovo `components/WorkerTables/MobileMonthlyView.tsx` (o simile) + switch a breakpoint in
`WorkerDetailPage.tsx:972-995`; MonthlyDataGrid **non si tocca dentro**.
Contenuto: resa per-mese (card/accordion 12 mesi, colonne come righe) che riceve le STESSE props
(`data`, `onDataChange`, `initialYear/onYearChange`, `verifyStates`, `onVerifyRequest`,
`onAcceptCorrection/All`, `archiveEntries`, `includePaidLeave`) — obiettivo del piano "stessi hook del
desktop" già garantito dall'architettura controllata. Da decidere: undo (history è interna alla griglia
desktop — su mobile o si rinuncia o si replica il wrapper `updateDataWithHistory`).
Rischio: **alto** — è il monolite delicato (re-render: provider non memoizzato + `handleCellChange` a
ogni keystroke; il sync scroll a 3 vie NON va replicato su mobile). Tagliare qui a sua volta in 2 giri:
(a) vista read-only + selettore anno/mese, (b) editing celle + verify/note.

**T3 — Tab di consultazione (calc / pivot / TFR) + ticker legale.**
File: `AnnualCalculationTable.tsx`, `IndemnityPivotTable.tsx`, `TfrCalculationTable.tsx`.
Contenuto: per lo più CSS (contenitori `overflow-x-auto` già presenti; ridurre sticky-col pivot da 250px,
tooltip → tap, target dei pochi input coeff/soglia). Le scritture (coeff, imponibile TFR) restano sugli
stessi `onDataChange`.
Rischio: **basso-medio** — read-mostly, tabelle native scrollabili; attenzione solo ai tooltip hover.

**T4 — Archivio + Visore + modali di flusso.**
File: `PayslipArchiveTab.tsx`, `SplitViewViewer.tsx` (full-screen su mobile invece del 45%, touch
pan/pinch, sniper opzionale), barra voci fisse (`WorkerDetailPage.tsx:1038-1104`), HUD/Toast/Modals.
Rischio: **medio**; il visore touch è il pezzo grosso. Valutare se rimandare lo sniper OCR touch
(lo scan mobile è già coperto dal companion PWA di Fase 2/3 via QR).

Ordine consigliato: T1 → T2a → T2b → T3 → T4. T1+T3 sono a basso rischio e danno subito una scheda
"navigabile"; T2 è dove serve il collaudo vero.

---

## 6. Anomalie / sorprese

1. **Label timeline ≠ id stato** (`VertenzaTimeline.tsx:146-150`): `inviata`→"Buste Paga Mancanti",
   `trattativa`→"Conclusa", `chiusa`→"Pagata". Semantica riciclata: gli id (usati in DB/filtri dashboard)
   non raccontano più ciò che l'utente vede. Da non "correggere" in Fase 4 (i filtri dipendono dagli id).
2. **Verify per-riga NON gated per il viewer** (`MonthlyDataGrid.tsx:1631`: solo `!hasArchive || !onVerifyRequest`):
   il viewer readonly può lanciare la verifica AI singola (consumo Netlify/Gemini), mentre "Verifica anno"
   è correttamente `!isReadOnly` (1002). Anche "Accetta tutto" (1690) e "Accetta correzione" (1805) non
   sono gated — scrivono solo stato locale e l'RLS blocca a valle, ma la UI lo permette.
3. **Doppio toggle Ex-Festività indipendente**: `AnnualCalculationTable.tsx:70` ha un proprio
   `includeExFest` locale (default false), separato dal toggle "32gg/28gg" della VertenzaTimeline che
   governa ticker e report. Due verità sullo stesso parametro nella stessa pagina.
4. **Context value non memoizzato + destructuring totale**: `WorkerDetailPage.tsx:874-970` ricrea
   l'oggetto a ogni render; `WorkerDetailHuds/Toast/Modals/Content` destrutturano ~80 campi usandone
   una decina (`WorkerDetailHuds.tsx:9-32` ecc.). Ogni keystroke in griglia ri-renderizza l'intero
   sottoalbero. Primo candidato se su mobile la digitazione lagga.
5. **Trash del visore senza title/aria** (`SplitViewViewer.tsx:237-242`); in generale aria quasi assente
   su tutta la scheda (unico `aria-busy` in `PayslipArchiveTab.tsx:270`); niente `aria-label` sui
   bottoni icon-only.
6. **z-index babele**: 20/30/50/100/150/200/250/999/1000/9999/99999 + `hover:z-[1000]` sulle celle e
   `hover:z-9999!` sui th (`MonthlyDataGrid.tsx:1385`, sintassi arbitraria con `!`). Funziona per
   stratificazione fortuita; ogni nuovo layer mobile (bottom-bar, sheet) va piazzato con attenzione.
7. **Il "re-render loop" storico** è documentato nel commento a `MonthlyDataGrid.tsx:506`
   ("isScrolling gestito via ref per evitare loop") + lock `isSyncing` (475-489): il sync scroll a 3 vie
   è il meccanismo fragile da NON portare su mobile (su mobile basta l'overflow nativo).
8. **Start Year modificabile dal viewer** (`WorkerDetailHeader.tsx:102`: nessun gate readonly): il select
   scrive `onStartClaimYearChange` → effetto → `onUpdateWorkerFields` + localStorage. Come sopra: RLS
   protegge il DB, ma il viewer può alterare la propria vista dei calcoli (forse voluto? non documentato).
9. **Ticker legale duplicato hard-coded** (`MonthlyDataGrid.tsx:1317-1335`): i blocchi marquee sono
   copia-incollati due volte per il loop.
10. **`handleCellChange` salva stringhe grezze** nel modello (`'12,5'`) e il parsing avviene in lettura
    (`parseLocalFloat` ovunque): qualsiasi vista mobile deve riusare `parseLocalFloat`/`formatCurrency`
    di `utils/formatters` per non introdurre divergenze.
11. **Empty-state "Vai all'Inserimento Mensile"** presente anche per il viewer (calc/pivot): porta alla
    griglia readonly — coerente ma il redirect readonly iniziale (`WorkerDetailPage.tsx:258-264`) scatta
    solo al flip di `isReadOnly`, quindi il ritorno manuale su input è permesso (by design, commentato).
