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
- Restyle "sala macchine" (scheda lavoratore) a livello Incidenza.
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
