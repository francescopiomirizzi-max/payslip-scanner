# Piano — Modulo "Mancati Riposi" (area "Turni & Riposi") in RailFlow

> **Origine:** progetto affidato da Vincenzo Cataneo (~2026-06-07). Dominio **diverso** da RFI:
> conducente TPL di linea (Viterbo Tommaso, sindacato FAST Confsal). Obiettivo: sostituire il
> fragile Excel generato con ChatGPT (`Foglio_calcolo_mancati_riposi_Viterbo_DIVISO_ANNO_CON_RIF_NORMATIVI.xlsx`)
> con un **modulo difendibile** dentro RailFlow.
>
> **Ruolo:** noi prepariamo dati + metodo; l'avvocato decide il ricorso (come RFI).
>
> **Perché un modulo e non un Excel:** estrazione Gemini riproducibile (addio outlier OCR da
> €98.732 e numeri-come-testo), calcolo vivo, riusabile per qualsiasi autista, output .docx pronto.

## Decisioni architetturali (confermate con l'utente)

1. **Area separata (workspace switch)** — switch in alto: `Incidenza` (attuale) ⟷ `Turni & Riposi` (nuovo).
   Le due aree condividono piattaforma (auth, Supabase, Gemini, export) ma hanno navigazione/dati distinti.
   Motivo: i due mondi non condividono dati (turni giornalieri vs buste mensili) → separazione alla radice.
2. **Modello dati nuovo e separato** — NON dentro `worker_profiles.anni`. Tabella `pratiche_riposi`.
3. **Motore di regole puro e testato** — il cuore; deterministico; non dipende dal PDF.
4. **Riuso massiccio**: pipeline scan Gemini, auth/RLS/storage, libreria `docx`, `exceljs`, `SplitViewViewer`, `pdfjs-dist`.

## Onestà sui dati (perimetro v1)

- Dai soli orari `inizio`/`termine` di turno si calcolano **riposo giornaliero** e **riposo settimanale** → **Violazione n.1**.
- La **Violazione n.2 (pausa art. 7)** richiede il dettaglio di guida intra-turno / dati cronotachigrafo, **non presenti** in quei dati → fuori dal v1 finché Vincenzo non procura i tracciati.

---

## FASE 1 — Motore di regole + test (NON serve il PDF) ✅ FATTA (2026-06-07)

> Nota: i tipi sono **co-locati in `utils/restEngine.ts`** (come `calculationEngine.ts` tiene le sue
> interfacce nel file motore), non in un `types/riposi.ts` separato. Più idiomatico e mantiene il
> motore autosufficiente. Il `types/riposi.ts` separato si farà solo se i tipi serviranno anche fuori.

- [x] `utils/restEngine.ts` — funzioni pure, nessun I/O:
  - [x] `parseHmm(v)` — `h.mm`→minuti, gestisce virgola/interi (`45,00`, `45`) e rifiuta i minuti >59 (`6.75`→NaN, segnala non indovina).
  - [x] `buildDuties(giornate)` — da righe giornaliere a turni con datetime assoluti; gestisce i turni a cavallo di mezzanotte; segnala turni anomali (>16h).
  - [x] `computeRestViolations` — gap tra turni consecutivi; **<24h = contesto giornaliero** (≥11 regolare, 9–11 ridotto lecito **max 3×**, <9 violazione), **≥24h = contesto settimanale**. Risolve la "soglia piatta a 11h" dell'Excel: espone il deficit ma non flagga i ridotti leciti.
  - [x] `classifyWeeklyRest` / `classifyDailyRest`.
  - [x] `applyTwoWeekRule` — art. 8 §6 su due settimane consecutive (no due ridotti di fila); `gravita` 'grave' se riduzione >10% (Reg. UE 2016/403), **separata dal trigger dell'illecito**.
  - [x] Indennità = ore mancanti × `tariffaOraria` (parametro con `fonteTariffa`).
- [x] `__tests__/restEngine.test.ts` (vitest) — 15 test:
  - [x] 29 mag–11 giu 2023: 37h50 (ridotto lecito) + 38h55 (ridotto illecito, grave) → violazione art. 8 §6.
  - [x] 30 lug–13 ago 2023: 43h25 (lecito) + 38h00 (illecito, grave) → violazione.
  - [x] Casi limite: parsing `h.mm`/virgola, riposo a cavallo di mezzanotte/mese/anno, cap dei 3 ridotti giornalieri, regolare-tra-due-ridotti azzera la violazione, orari illeggibili → warning.
- [x] `npm test` verde — **142/142** (8 file esistenti + 15 nuovi), zero regressioni.

> ⚠️ Da rivedere in Fase 2 con dati reali: (a) DST — `durationHours` usa il tempo fisico trascorso
> (legalmente corretto: 11h consecutive reali), ma verificare i casi a cavallo del cambio ora; (b) la
> separazione giornaliero/settimanale a 24h è un'euristica — il PDF etichetta già Rip.Gro/Rip.Set, si
> potrà incrociare; (c) metodologia indennità riposo settimanale da confermare con l'avvocato.

## FASE 2 — Area separata + estrazione + review UI

### Scaffold (NON serve il PDF) ✅ FATTO (2026-06-07)

- [x] **Routing**: stato globale `area: 'incidenza' | 'riposi'` in `App.tsx` (sopra `viewMode`); l'area Incidenza è invariata, render condizionato `AppRouter` vs `RiposiArea`.
- [x] **Switch** `components/AreaSwitch.tsx` — pillola compatta fissa in basso a sx (non cozza con header/isola/scroll-top); unico punto di passaggio fra le due aree.
- [x] **Landing** `components/RiposiArea.tsx` — empty state con i 3 passi del workflow (scaffold, non pagina rotta).
- [x] **DB**: migration `supabase/migrations/013_pratiche_riposi.sql` — tabella `pratiche_riposi` (id, owner_id, nome, cognome, azienda, mansione, periodo_start/end, tariffa_oraria, fonte_tariffa, giornate jsonb, created_at, updated_at). **RLS owner-scoped su SELECT/INSERT/UPDATE/DELETE** (mirror 008). ⚠️ **da applicare** su Supabase (non ancora eseguita).
- [x] `npm test` 142/142 verde · `tsc --noEmit` pulito · `vite build` ok.

### Dati vivi dall'Excel (seed locale, NON serve il PDF) ✅ FATTO (2026-06-07)

> Prima lettura reale del motore sui dati grezzi dell'Excel di Viterbo:
> **275 violazioni** (35 giornaliere + 240 settimanali), **1.890h** mancanti,
> **€18.958** (tariffa placeholder 10,03), **504 ridotti leciti** non flaggati,
> 16 righe da verificare. Conferma che l'Excel sovrastimava (970 "potenziali").

- [x] `public/viterbo-seed.json` — giornate grezze dall'Excel (4937 righe). **Gitignored** (dati personali).
- [x] **Hook** `hooks/usePraticheRiposi.ts` — per ora seed locale di Viterbo (fetch del JSON); struttura pronta per il wiring Supabase in Fase 2.
- [x] **UI lista** pratiche nell'area `riposi`: card cliccabile di Viterbo.
- [x] **UI dettaglio** `components/RiposiPraticaDetail.tsx` — cruscotto che gira `computeRestViolations`: stat cards, tabella per anno, elenco violazioni con gravità. Banner onestà dati ("ordine di grandezza, non definitivo").
- [x] **UI rifinita** (2026-06-07): stat card stile "vetro" + `AnimatedCounter`; grafico a barre per anno (stacked); 2 tab **Violazioni** / **Prospetto turni**; il Prospetto è un **calendario annuale** (12 mesi, giorni colorati turno/riposo + ring rosso violazione) e il **click sul mese** apre `MeseFocus` (tabella incolonnata + legenda verticale: riepilogo mese, colori, servizi). `AreaSwitch` ricolorato per sezione (Incidenza=smeraldo, Riposi=indaco). Card pratica con chip calcolati.
- [x] `tsc` pulito · 142/142 test · `vite build` ok · seed valido in `dist/`.

### Resto della Fase 2 (serve il PDF)

- [ ] **Estrazione** `netlify/functions/scan-turni.ts` (mirror `scan-payslip.ts`): prompt Gemini per righe giornaliere `data·gset·tipo·servizio·inizio·termine` + **confidence per cella**; coda capata + thinking budget 1024 + retry (i 3 layer esistenti). Policy: cella dubbia → **flag, non indovinare**.
- [ ] **Persistenza Supabase**: applicare migration `013`; wiring CRUD reale nel hook (mapper `dbToPratica`/`praticaToDb`), il seed sparisce.
- [ ] **Review giornate** in `SplitViewViewer` (PDF a sx, righe a dx, dubbie evidenziate) — la correzione umana prima del calcolo.

## 🟢 PRONTI PER IL PDF — dove si aggancia (leggere quando arriva il PDF di Vincenzo)

Tutto l'impianto è in piedi e testato sui dati grezzi dell'Excel. Quando arriva il PDF, i punti di innesto sono:

1. **Estrazione** → scrivere `scan-turni.ts` e far produrre l'array `GiornataInput[]` (`data·servizio·inizio·termine`, formato h.mm). Il motore (`computeRestViolations`) e tutta la UI **non cambiano**: lavorano già su quel tipo.
2. **Persistenza** → `apply_migration 013_pratiche_riposi`, poi in `usePraticheRiposi` sostituire il fetch del seed con la CRUD Supabase (`giornate` jsonb). Tolto il seed, sparisce `public/viterbo-seed.json`.
3. **Review** → `SplitViewViewer` con PDF a sinistra e le `GiornataInput` a destra; le righe `warning` del motore sono già quelle da evidenziare.
4. **Tariffa** → appena l'avvocato conferma €/h + fonte, aggiornare `tariffaOraria`/`fonteTariffa` della pratica: indennità e gravità si ricalcolano da sole.
5. **Codici turno** → la `Legenda servizi` mostra già i codici; con la legenda aziendale si possono etichettare (mappa `SERV_LABEL` o tabella di lookup).

## FASE 3 — Export (contestazione + Excel pulito)

- [ ] `utils/contestazioneReport.ts` (mirror `reportGenerator.ts`): `.docx` contestazione popolata coi dati reali + boilerplate dal vademecum.
- [ ] Export **Excel pulito** via `exceljs`: numeri **veri** (non testo) + formule vive + foglio per anno + riepilogo.

---

## Aperti / dipendenze esterne

- [ ] **PDF sorgente** "Mancati riposi di Viterbo (1).pdf" — da Vincenzo (blocca la Fase 2).
- [ ] **Tariffa €/ora** con **fonte legale/CCNL** — parametro, non hardcoded (domanda per l'avvocato; l'Excel usava €10,03 ricavato a ritroso).
- [ ] **Legenda codici turno** dall'azienda — i codici numerici di "Servizio" (linea/turno) non sono decodificabili senza la chiave aziendale; serve per la contestazione.

### 📋 Da chiedere a Vincenzo (riassunto)
1. Il **PDF** "Mancati riposi di Viterbo".
2. La **tariffa €/h** dell'indennità con la sua **fonte** (CCNL/legale).
3. La **legenda dei codici turno** (cosa significano i numeri di servizio).
- [x] **Vademecum**: 3 ritocchi fatti (2026-06-07) → salvato `Vademecum_Turni_Riposi_FAST_REV1.docx` (originale intatto). (a) sez. 2.1: aggiunti "Principio applicativo" (>10% = gravità ex Reg. UE 2016/403, non il trigger dell'illecito) e "Nota metodologica" (esempi illustrativi); (b) tabella sez. 5: riposo giornaliero ridotto "max 3× tra due settimanali" + settimanale "entro 6 periodi di 24h, ≥45h/≥24h con compensazione". Copiato in `public/vademecum-turni-riposi.docx` (~9MB, immagini FAST) e linkato dal bottone "Apri il vademecum" nella landing.
- [ ] Nota deploy: l'asset vademecum pesa ~9MB → valutare se committarlo o servirlo altrove prima del push (repo bloat / Netlify).
- [ ] Nota brand: "RailFlow" è ferroviario, qui siamo su gomma (TPL) — irrilevante per ora.

## Verifica prima di "done" (CLAUDE.md)

- [x] `npm test` verde (142/142) + `restEngine.test.ts` passa contro gli esempi del vademecum.
- [x] `tsc --noEmit` pulito · `vite build` ok · nessun import/helper inutile.
- [ ] Motore validato a mano su almeno un periodo reale (quando arriva il PDF) confrontando col conteggio atteso.
- [x] Tutto **locale, non deployato** (commit sì, push no — da indicazione utente).

## Review (da compilare a fine lavoro)

_(vuoto — si compila man mano)_
