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

- [x] **Estrazione** (2026-06-10) — `scan-turni.ts` NON serve: il PDF di Vincenzo ("Mancati riposi di Viterbo (2).pdf", Desktop) è **testo nativo** → parser deterministico `scripts/parse-mancati-riposi-pdf.py` (regex, zero AI/OCR, verifiche di quadratura incorporate). Seed rigenerato: **5.022 giornate** (gen 2011–set 2024, zero buchi) vs 4.936 dell'Excel; quadra al centesimo col "Totale complessivo" stampato nel PDF (€98.732,03). L'opzione Gemini resta solo per eventuali PDF futuri scansionati.
- [x] **Persistenza Supabase** ✅ (2026-06-12): migration `013` estesa coi campi gestione (stato/date/importo) e **APPLICATA live** (tabella + RLS owner-scoped verificate via SQL: 4 policy, nessuna anon). Hook riscritto: fetch da `pratiche_riposi` + mapper `dbToPratica`/`praticaToDb` (testati, round-trip senza perdite) + `salvaInArchivio` + `updatePratica` (ottimistico). Il seed resta come **fallback marcato `isSeed`** quando l'archivio è vuoto: si salva nell'archivio SOLO con azione esplicita (banner ambra in lista) — mai auto-insert, altrimenti l'account viewer si clonerebbe la pratica.
- [ ] **Review giornate** in `SplitViewViewer` (PDF a sx, righe a dx, dubbie evidenziate) — la correzione umana prima del calcolo.

## 🟢 PRONTI PER IL PDF — dove si aggancia (leggere quando arriva il PDF di Vincenzo)

Tutto l'impianto è in piedi e testato sui dati grezzi dell'Excel. Quando arriva il PDF, i punti di innesto sono:

1. **Estrazione** → scrivere `scan-turni.ts` e far produrre l'array `GiornataInput[]` (`data·servizio·inizio·termine`, formato h.mm). Il motore (`computeRestViolations`) e tutta la UI **non cambiano**: lavorano già su quel tipo.
2. **Persistenza** → `apply_migration 013_pratiche_riposi`, poi in `usePraticheRiposi` sostituire il fetch del seed con la CRUD Supabase (`giornate` jsonb). Tolto il seed, sparisce `public/viterbo-seed.json`.
3. **Review** → `SplitViewViewer` con PDF a sinistra e le `GiornataInput` a destra; le righe `warning` del motore sono già quelle da evidenziare.
4. **Tariffa** → appena l'avvocato conferma €/h + fonte, aggiornare `tariffaOraria`/`fonteTariffa` della pratica: indennità e gravità si ricalcolano da sole.
5. **Codici turno** → la `Legenda servizi` mostra già i codici; con la legenda aziendale si possono etichettare (mappa `SERV_LABEL` o tabella di lookup).

## FASE 3 — Export e gestione pratica (roadmap 2026-06-10, richiesta utente)

- [x] **PDF dei conteggi** ✅ (2026-06-12) — `utils/riposiPrint.ts`: `buildConteggiRiposiHtml` (puro, testato) + `printConteggiRiposi` (finestra di stampa, pattern Stampa/RelazioneModal, niente jsPDF). Bottone "Stampa conteggi" nell'header del cruscotto. Contenuto: intestazione pratica, due serie affiancate con avvertenza NON sommabilità, riepilogo per anno (G/S/ore/€ motore/€ fonte + totali), elenco 278 violazioni raggruppate per anno con causale sintetica e rif. normativi in legenda, nota metodologica (5 punti), righe da verificare (16). `computeSerieFonte` estratta in `restEngine.ts` (condivisa cruscotto+stampa). Verificato su seed reale via Chrome headless: 20 pagine A4, fonte €98.732,03 quadra col PDF sorgente, motore €19.178,22. 189 test verdi.
- [x] **Relazione** `.docx` **vero** ✅ (2026-06-12) — `utils/riposiRelazione.ts`: `buildRelazioneRiposiDoc` (puro) + `generateRelazioneRiposi` (Packer.toBlob + saveAs). 6 sezioni: dati pratica, quadro normativo (561/2006 + D.Lgs. 234/2007 + Reg. UE 2016/403), metodo, due serie + riepilogo annuo, elenco violazioni, riserve/limiti (tariffa, art. 7, codici turno, non-cumulo, warnings). Bottone "Relazione .docx" nel cruscotto con **import dinamico** (chunk separato 8,9 kB; anche file-saver è import dinamico per usabilità node). Test end-to-end: Packer.toBuffer → unzip fflate → asserzioni su document.xml. Verificato sul seed reale via textutil (importer Cocoa): tutte le sezioni e i totali quadrati. 194 test verdi.
- [x] Export **Excel pulito** ✅ (2026-06-12) — `utils/riposiExcel.ts`: `buildRiposiWorkbook` (puro) + `generateExcelRiposi` (import dinamico, chunk 6,3 kB). Numeri VERI: date Excel (via Date.UTC, exceljs serializza in UTC), orari come orari (`hh:mm`), durate in ore decimali, € numerici; orari non interpretabili restano testo grezzo (mai inventare). FORMULE VIVE: tariffa in `Riepilogo!B7` (cella ambra modificabile) → indennità violazioni (`F×B7`), riepilogo annuo (COUNTIFS/SUMIFS su Violazioni), € fonte per anno (SUM sul foglio-anno), totali. Struttura: Riepilogo + Violazioni + un foglio per anno (freeze header). `causaleSintetica` estratta in restEngine (condivisa print/docx/xlsx). Test round-trip writeBuffer→load; smoke su seed reale: 14 fogli anno, 278 violazioni, somma fonte €98.732,03 esatta. 199 test verdi.
- [x] **Archivio pratiche + stato** ✅ (2026-06-12) — `stato` (`in_corso`|`conclusa`|`pagata`, CHECK su DB) + `data_apertura/chiusura/pagamento` + `importo_riconosciuto` nella 013 applicata. Lista: badge stato colorato (ambra/smeraldo/cielo) su ogni card + chips filtro stato + pillola "seed locale". Dettaglio: select stato nell'header (cambiarlo scrive da sé la data utile mancante), striscia gestione con date e input importo riconosciuto (solo `pagata`); tutto disabilitato per pratiche-seed e viewer readonly (`useIsReadOnly`). `STATO_META` nel hook (evita import circolare Area⇄Detail). 206 test verdi.

### ⚖️ Domanda chiave prima degli export (per Vincenzo/avvocato)

Le due serie quantificano **lo stesso pregiudizio** (gli stessi riposi saltati) con criteri diversi → **non si sommano**. Cosa si chiede dipende da chi ha prodotto il PDF e se quelle indennità risultano **già pagate in busta**:
- mai pagate → si chiede UNA delle due quantificazioni (decide l'avvocato quale base);
- già pagate → si può valutare l'eventuale **danno ulteriore** (es. usura psicofisica) o differenze, ma è una scelta legale, non nostra.
Da chiedere: (a) chi ha prodotto il PDF (azienda? sindacato? consulente?); (b) riscontro nei cedolini di Viterbo di voci "indennità mancato riposo" pagate.

---

## Aperti / dipendenze esterne

- [x] **PDF sorgente** ricevuto 2026-06-10 ("Mancati riposi di Viterbo (2).pdf", Desktop). Parsato e quadrato; CSV derivati (giornaliero/mensile/annuale) accanto all'Excel in `mancati riposi/`.
- [ ] **Tariffa €/ora** con **fonte legale/CCNL** — parametro, non hardcoded (domanda per l'avvocato). Dal PDF la tariffa implicita è coerente e cresce per anno: €10,03 (2011) → €13,13 (2024) — resta da chiedere la fonte CCNL.
- [ ] **Due serie da presentare nel cruscotto** (decisione design): indennità del PDF (1.081 gg, €98.732,03, criteri di chi l'ha prodotto) vs motore nostro 561/2006 (prima lettura sul seed PDF: 278 violazioni = 35 giorn. + 243 sett., 1.912h, ~€19.178 a tariffa placeholder €10,03, 16 warnings turni >16h da verificare a mano). Finding neutro per l'avvocato.
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
