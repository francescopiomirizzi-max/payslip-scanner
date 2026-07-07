# Todo — Sessione 2026-07-07 · Restyle "sala macchine" (scheda lavoratore)

> ⏸️ **PARCHEGGIATO (07/07) — BOZZA PER IL FUTURO, non implementare.** Decisione utente: per ora non si cambia
> nulla. Mockup salvato in [ideas/sala-macchine-restyle-mockup.html](ideas/sala-macchine-restyle-mockup.html)
> (indice: [ideas/README.md](ideas/README.md)). Questo piano resta come riferimento per quando si riprenderà.
>
> Piano nato dalla revisione del mockup (artifact
> `6048e507`, versione "tre-tab-complete", theme-aware). Inventario dei comandi tracciato dal file
> di composizione `WorkerDetailLayout.tsx` (lezione 07/07 in `tasks/lessons.md`).

## Obiettivo e vincoli
- **Solo layout/gerarchia/leggibilità.** Zero modifiche a motore, calcoli, numeri. **Nessun comando
  rimosso o rinominato** (inventario completo qui sotto). Palette e temi per-azienda intoccabili.
- **Theme-aware**: l'app ha chiaro E scuro; il restyle deve reggere entrambi.
- Struttura verticale confermata (quella reale): **Testata → Stato vertenza → Statistiche → Strumenti → Corpo del tab**.

## Decisioni bloccate (dalla revisione 07/07)
1. **Testata**: Dashboard, Start Year, identità (nome/azienda/sede/ruolo/Assunzione), Azioni (ISTAT+PEC),
   Download, Vai al Report, Archivio. Tasti in alto **esteticamente invariati** (glass/gradienti/spotlight).
   **NOVITÀ (richiesta utente 07/07): la barra testata prende il COLORE-AZIENDA del lavoratore** (non più il
   verde fisso) e mostra il **logo azienda reale**. Sorgenti già esistenti: `getCompanyGradient(profilo)`
   (`config/profiles.ts` → RFI blu #3b82f6→#06b6d4, Trenitalia rosso, Elior arancio, Clean Service emerald,
   Mercitalia ambra) e `getCompanyLogo(profilo, eliorType)` (`public/logos/*` via `CompanyLogo`). L'avatar è
   già company-colored; da estendere alla banda/accento della testata + logo accanto al nome (come `CompanyLogo`,
   con `forceWhite` sui fondi scuri). Nessun colore hardcoded: leggere sempre dal profilo.
2. **Stato vertenza**: timeline dei **5 cassetti** dell'area Incidenza (Da Analizzare · Conteggi · Buste Paga
   Mancanti · Conclusa · Pagata, valori interni `analisi/pronta/inviata/trattativa/chiusa`) + i **parametri
   globali** Ex-Festività (28/32gg), Ticket, Permessi — **una volta sola qui** (consolidamento scelto dall'utente).
3. **Statistiche (ex-ticker `useStatsData`)**: da marquee che scorre a **riga statica** con "?" (Totale da
   liquidare, Totale ISTAT+interessi, Lordo spettante, Già percepito, Totale buoni pasto; + TFR su differenze
   e Fondo TFR storico marcate **solo-owner**, nascoste al viewer come già oggi).
4. **Nota metodologica** (banda ambra in `MonthlyDataGrid`): da **marquee a statica ripiegabile**.
5. **Strumenti** (`WorkerDetailCommandBar`): stessi tasti, raggruppati sotto **"Acquisizione dati"**
   (AI Agent, Cartella, Scan AI Busta paga, Mobile Scan) e **"Analisi e calcolo"** (tab Inserimento Mensile,
   Riepilogo Annuale, Analisi Voci, Prospetto TFR). Solo la cornice cambia.
7. **Stato vertenza + Quadro economico RIPIEGABILI** (richiesta utente 07/07): entrambi i pannelli devono poter
   **collassare** per non rubare altezza alla tabella Inserimento. Da chiusi: Stato vertenza mostra titolo + stato
   corrente + parametri attivi; Quadro economico mostra il titolo + il numero-guida "Totale da liquidare". Stato
   ripiegato **persistente per-lavoratore** (come gli altri flag di scheda). Verifica: da chiusi la tabella prende
   l'altezza liberata; da aperti tutto invariato.

6. **Tabella (Inserimento Mensile)**: colonna mese **sticky**, chip codici con **tooltip dalla knowledge**,
   **scroll interno** alla tabella (la pagina scorre normale). Barra Periodo con tutti i tasti attuali
   (‹anni›, Visore, PDF n/12, Verifica anno, Annulla, Manuale legale, Archivio, Variabili/Fisse) + stat per-anno
   (Media Giornaliera, Totale Indennità Variabili).

## Ottimizzazione — consolidamento parametri globali (scelta: "consolida nello Stato vertenza")
- [ ] **O1 — Ex-Festività: unificare lo stato.** In `AnnualCalculationTable.tsx` è **stato LOCALE**
      (`useState(false)`, riga ~70), separato da quello dello Stato vertenza (context `includeExFest`/`onToggleExFest`).
      → farlo leggere dal context/props condivisi e **rimuovere il toggle duplicato** dall'header del Riepilogo.
      Verifica: cambiando Ex-Fest nello Stato vertenza, il "Tetto 28/32gg" del Riepilogo e i totali si aggiornano
      da soli; il numero "Totale da liquidare" combacia tra riga statistiche e Riepilogo Finale (a parità di interessi).
- [ ] **O2 — Media Giornaliera** compare in 3 posti (griglia, colonna Riepilogo, modalità pivot): NON accorpare
      (scope diversi), ma allineare **etichetta e formato** ovunque. Verifica: stessa dicitura + stessi decimali.
- [ ] **O3 — Titolo scuro** ripetuto in ogni header di tab: alleggerire, MA **tenere il logo azienda** nelle barre
      tabella (Periodo) e negli header dei tab — richiesta utente 07/07: serve quando la testata è scrollata via
      (cfr. commento reale in `MonthlyDataGrid`: "logo visibile anche con l'header di pagina scrollato via").
      Verifica: logo azienda presente in Periodo + header dei 4 tab; nessun testo-titolo ridondante.

## Implementazione zona per zona (ogni step: → verifica)
- [ ] **1. Testata** (`WorkerDetail/WorkerDetailHeader.tsx`): già vicina al target; ritocchi di raggruppamento
      azioni, nessun tasto tolto. → verifica: tutti i tasti presenti e funzionanti in light+dark.
- [ ] **2. Stato vertenza** (`WorkerDetail/VertenzaTimeline.tsx`): resta timeline + toggle globali; **il ticker
      statistiche esce da qui** (diventa la riga statica, step 3). Timeline invariata nella logica (onUpdateStatus).
      → verifica: click su uno step cambia stato come oggi; toggle Ex-Fest/Ticket/Permessi guidano i calcoli.
- [ ] **3. Statistiche riga statica**: nuovo componente (o refactor del render ticker) che dispone le card di
      `useStatsData` in griglia statica con tooltip "?" (mantenere il filtro viewer per le 2 voci TFR).
      → verifica: stesse voci/valori del ticker; "?" apre lo stesso contenuto; viewer non vede le 2 TFR.
- [ ] **4. Strumenti** (`WorkerDetail/WorkerDetailCommandBar.tsx`): wrap dei tasti nei due gruppi etichettati.
      Tasti invariati. → verifica: AI/scan/QR e i 4 tab funzionano; estetica dei bottoni identica.
- [ ] **5. Nota metodologica** (`WorkerTables/MonthlyDataGrid.tsx`): marquee ambra → blocco statico ripiegabile
      (stesso testo). → verifica: testo integrale leggibile fermo; niente animazione x.
- [ ] **6. Tabella Inserimento Mensile** (`MonthlyDataGrid.tsx`): confermare mese sticky + scroll interno (già
      presenti) e agganciare i **tooltip codici alla knowledge**. → verifica: hover su un codice mostra la voce; scroll ok.
- [ ] **7. Riepilogo Annuale** (`WorkerTables/AnnualCalculationTable.tsx`): header senza Ex-Fest (vedi O1); tiene
      Mostra Parametri, Soglia %, Interessi %. → verifica: espansione anni, Incidenza %, Totale da liquidare + copia.
- [ ] **8. Analisi Voci** (`WorkerTables/IndemnityPivotTable.tsx`): header alleggerito; tiene Totali/Media.
      → verifica: pivot voci×anni, toggle Totali/Media, Totale storico + riga Totale voci.
- [ ] **9. Prospetto TFR** (`WorkerTables/TfrCalculationTable.tsx`) — **IN SCOPE (inventariato 07/07, nel mockup)**:
      header "Rivalutazione TFR" + **Punto Zero / Base Storica** (editabile, modale) + **Stampa TFR**; tabella
      Anno · Fondo Iniziale · Imponibile Utile (editabile) · Quota Maturata · Indice ISTAT (FOI) · Rivalutazione ·
      Fondo Finale (righe editabili) + footer Totale / **TFR Spettante**. Allineare alla cornice + rimuovere
      badge/titolo ridondanti (O3). → verifica: modifica Punto Zero, edit riga, stampa, TFR spettante invariato.

## Gate finali
- [ ] `tsc --noEmit` pulito · suite Vitest verde · `build` prod + demo ok.
- [ ] **Diff comportamento**: i numeri (differenze, totali, %, TFR) identici a prima su un lavoratore campione.
- [ ] **Verifica visiva utente** sui 4 tab, in **light e dark**, owner e viewer.
- [ ] Niente push finché non richiesto (batch deploy).

## Review (a fine sessione)
- [ ] Aggiornare `_roadmap.md` (voce "Sala macchine") + memoria + lessons se emergono correzioni.

---

# Todo — Sessione 2026-07-06 · Consolidamento e deploy (zero feature nuove)

> Piano approvato dall'utente. Ordine: fix da verifica visiva → P1 RLS → demo pulita → deploy in batch.
> Riferimenti: `~/second-brain/_roadmap.md` + review Valora 06/07 nel vault.
> (Il piano precedente — Multi-Sindacato GIRO 2 — è COMPLETATO 05/07; storia nel diario del vault.)

## 1. Fix da verifica visiva (l'utente verifica, io correggo)
- [x] **Favicon invisibile in light mode** — FATTO (c290785): `media="(prefers-color-scheme)"` in
      index.html — bianca solo su tab scura, colorata in light; colorate per ultime = fallback
      per i browser che ignorano `media`. → verifica finale: occhio dell'utente sui 2 temi.
- [x] **Pratica Viterbo invisibile al viewer** (finding post-deploy): `pratiche_riposi` aveva la
      SELECT owner-only (013) — il cambio policy 28/06 "viewer vede tutto" aveva tolto solo i filtri
      client, non la RLS. **Migration 024 APPLICATA live**: SELECT = owner OR viewer, scritture
      invariate. Verificato con JWT: viewer legge 1 pratica, UPDATE = 0 righe. Nessun deploy necessario.
      ⚠️ Con `viewer_payment_block=true` Vincenzo dal SUO account vede la schermata di manutenzione:
      all'incontro si mostra dal login owner, oppure si spegne il blocco (decisione di Francesco).
- [x] **F5 dentro un'area ributtava sull'ingresso** (finding utente, sera): l'org attiva vive solo
      nello stato React e con hash vuoto il deep-link non risolveva nulla. Fix 36a0379: snapshot
      org+area in sessionStorage (per-scheda), ripristino fail-open nell'effetto una-tantum, guard
      ref anti-clobber al primo render; "Cambia organizzazione" pulisce → F5 = ingresso. NON è una
      regressione del code-split: c'era dal giro 1 multi-org, visibile solo ora che è deployato.
      → verifica utente: F5 in Incidenza/Riposi/Indennità resta nell'area; dopo "Cambia org" F5 = ingresso.

## 2. P1 — Stringere RLS RAG `legal_*` ✅
- [x] Migration **023_legal_rls_owner_write** scritta nel repo + **APPLICATA al DB live** (ea9d9c7).
      Chiuse le 6 policy tabelle **+ 3 policy storage `legal-corpus`** (stessa falla della 005,
      non era nella lista audit). Scrittura = solo owner `7fec036e-…`; lettura invariata.
      → VERIFICATO live: INSERT con JWT viewer → errore RLS 42501; INSERT owner → ok (rollback);
      pg_policies: 0 policy di scrittura aperte residue.

## 3. Demo pulita (da review 06/07) ✅ (0fdb746)
- [x] Turni & Riposi in demo → seed Viterbo via `loadSeed()` (gate IS_DEMO in `usePraticheRiposi`,
      scritture neutralizzate: salvaInArchivio null, updatePratica solo ottimistico locale).
- [x] Demo-gate di `usePayslipArchive` → guardia IS_DEMO su tutte e 7 le funzioni.
- [x] Badge DEMO spostato top-center (a sinistra copriva il wordmark ValOra).
- [x] DevBadge → "Novità" statico (via testo "in sviluppo" + animate-ping) nelle 3 aree.
      → verifica: tsc pulito, 260/260 test, build prod + build demo ok. Giro visivo = utente.

## 4. Deploy in batch ✅ FATTO 06/07
- [x] Gate pre-deploy: tsc pulito + 260/260 test + build prod e demo verdi.
- [x] OK visivo dell'utente ricevuto.
- [x] README riscritto prima del push (39db75d): evoluzione scanner→RailFlow→aree→Valora
      multi-org, stack reale, niente dati sensibili (vetrina portfolio).
- [x] Push su main: **44 commit** in un colpo → **UN deploy Netlify** (railflow-2, stato `ready`).
- [x] Smoke test live: titolo "Valora — Ufficio Vertenze", 4 link favicon con `media`,
      bundle 200, favicon colorate+bianche 200, elior-residenza-seed 200.
      `viterbo-seed.json` → 404 **by-design**: git-ignorato per privacy (riga 37 .gitignore);
      in prod innocuo (il DB ha la pratica, il fallback non scatta). La demo si builda in
      locale, dove il file esiste.
- [ ] **Residuo**: RIDEPLOY del sito demo (separato) per portare live i fix "demo pulita" —
      serve URL/processo di deploy della demo (build locale `npm run build:demo`).

---

# PIANO — P2 Code-split del bundle (2026-07-06, ✅ ESEGUITO in serata)

> **RISULTATO: first load 1,2 MB → ~378 kB gzip (−68%).** Dettaglio in fondo al piano.

> **Baseline misurata:** `App-*.js` **3,6 MB raw (~1,04 MB gzip)** in un chunk unico. Già lazy:
> MobileUploadPage, riposiExcel, riposiRelazione, reportScreenshotPdf, html2canvas, pdf.worker.
> **Zero `React.lazy`** su route/aree. Bonus trovato: `recharts` = dipendenza ORFANA (0 import).
> Principio: si spostano solo i CONFINI di caricamento, zero cambi di comportamento.

## Fase 1 — I "cantieri" on-demand escono dal chunk iniziale (massima resa, minimo rischio)
- [ ] 1.1 `RelazioneModal` (**exceljs + docx**) → `React.lazy` nei punti d'uso (TableComponent,
      WorkerDetailModals) con Suspense. → verifica: chunk separato nel build; genera .docx e Excel reali.
- [ ] 1.2 `StatsDashboard` (**jspdf**) → `React.lazy` in AppRouter. → verifica: rotta stats + EXPORT REPORT.
- [ ] 1.3 `IstatDashboardModal` (**jspdf**) → `React.lazy` nel punto d'uso. → verifica: apertura + PDF.
- [ ] 1.4 `lib/pdfChunker` (**pdfjs-dist + mammoth**) → `await import()` dentro `useRagIngestion`;
      `RagAdminPanel` → lazy (owner-only). → verifica: apertura pannello RAG + ingestione un file.
- [ ] 1.5 Export utils (`concluseExport`, `printTables`, `reportGenerator`, `riepilogoReport`) →
      `await import()` nei rispettivi handler (menu Dati, stampe, TFR pdf). → verifica: un export per tipo.
- [ ] 1.6 `fflate` in `PayslipArchiveTab` → dynamic import nel handler ZIP. → verifica: download ZIP buste.

## Fase 2 — Route/aree lazy (secondo respiro)
- [ ] `ArchivePage`, `CompanyPage`, `RiposiArea`, `VertenzeArea` (+ `WorkerDetailPage` solo se serve
      ancora) → `React.lazy` + fallback skeleton coerente. Restano EAGER: SindacatiDashboard,
      DashboardPage, Login (primo paint).
      ⚠️ Lezioni: lazy sul CONTENUTO, mai sul wrapper dentro `AnimatePresence` (exit animations);
      deps/TDZ (lezione 2026-05-28). → verifica: deep-link/F5 su OGNI rotta hash, transizioni pulite.

## Fase 3 — Misura finale e rifiniture
- [ ] Tabella chunk prima/dopo nel todo; solo se serve ancora: `manualChunks` vendor (react/framer).
- [ ] Rimuovere `recharts` da package.json (orfano; non tocca il bundle, pulizia dipendenze).

## Gate finale
- [x] tsc pulito · 260/260 test · build prod + demo ok. **Target CENTRATO: ≤ 400 kB gzip.**
- [ ] Verifica visiva utente sui flussi chiave (scheda lavoratore, relazione .docx/Excel, stampa
      tabelle, stats+PDF, ZIP archivio, riposi, indennità, pannello RAG, F5 su ogni rotta).
- [x] NIENTE push: si accumula per il prossimo batch.

### Risultato misurato (build 06/07 sera)
| | prima | dopo |
|---|---|---|
| Chunk `App` | 3.683 kB raw / 1.043 kB gzip | **849 kB raw / 217 kB gzip** |
| First load totale (entry+readonly+App) | ~1,2 MB gzip | **~378 kB gzip (−68%)** |
| exceljs / docx / jspdf+autotable / pdfjs / mammoth / jszip / fflate | nel chunk iniziale | chunk on-demand al click |
| RiposiArea / VertenzeArea / Archivio / Company / Stats | nel chunk iniziale | lazy per rotta (Suspense nel motion.div) |

Fatti tutti: 1.1–1.6 (dynamic import negli handler, `import type` per i tipi docx,
`renderRiposiPdf`→async col caller aggiornato, getter lazy pdfjs/mammoth in pdfChunker),
Fase 2 (Stats/Archive/Company in AppRouter + Riposi/Vertenze in App), Fase 3 (recharts
DISINSTALLATO — era orfano). WorkerDetailPage/TableComponent lasciati eager: target già centrato,
non vale il rischio sulla vista più delicata. RagAdminPanel lasciato montato (exit animations del portal).

---

## Rinviati a prossime sessioni (ordine concordato)
- P2 code-split bundle (3,68 MB) → prima impressione mobile.
- Restyle "sala macchine" (scheda lavoratore) — **PROSSIMA SESSIONE: prima si RIVEDE INSIEME il
  mockup** (artifact `7ece31dd`, versione "tasti-originali-raggruppati"), POI il piano e il codice.
  Nessuna implementazione prima del giro di revisione. Direzione emersa il 06/07 sera:
  (1) testata stile aree con azioni raggruppate; (2) stat su riga propria con etichette+"?";
  (3) **tasti strumenti INVARIATI** ma raggruppati sotto etichette "Acquisizione dati"/"Analisi e calcolo";
  (4) nota metodologica statica ripiegabile (via marquee); (5) tabella: colonna mese sticky, chip
  codici con tooltip dalla knowledge, scroll contenuto nella tabella + pagina che scorre. Solo design,
  zero motore. Tema scuro/palette attuali intoccabili.
- Feature "prova d'accuratezza" riga-per-riga (cancello Bari, primo passo perizia-factory).
- Mattone CAF (derivazione anagrafica da CF) — ultimo, non aprire un secondo fronte.
- Le ~17 pratiche riposi in arrivo: PREZZARLE all'incontro prima di lavorarle.

## Review (a fine sessione)
- [x] Aggiornare `_roadmap.md` nel vault (data + stato) e diario.

### Esito sessione 06/07
Consolidamento completo in una sessione: favicon theme-aware, P1 RLS chiuso e VERIFICATO
(incluso il bucket storage `legal-corpus`, fuori lista audit), demo pulita (4 fix), README
riscritto, 44 commit deployati con un solo deploy Netlify, smoke test verde. Restano: rideploy
della demo, P2 code-split, sala macchine, prova d'accuratezza (ordine già concordato).
