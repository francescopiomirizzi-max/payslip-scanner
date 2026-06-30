# Recupero busta misfiled #5 — Gentile Celestino (Settembre 2009) — 2026-06-30 pom.

> 5° dei 7 recuperi. Playbook = memoria `project-audit-mese-archivio-vs-testata` + lezione 30/06.
> ⚠️ **DIVERGE da Tozzi/Cataneo:** lo slot di destinazione Set2008 è **VUOTO**, e nello slot Set2009
>   ci sono **dati 2008 reali** → rischio di perdere Settembre 2008 se si sovrascrive e basta.

## Stato DB (verificato 30/06)
- Gentile Celestino `68782a50-cff0-4796-b6c0-13d0fdd83f8b`, RFI, status **CHIUSA**, fix_targets=[{2009, Settembre}], 228 buste.
- Slot **Set2009** (file 85,4KB): `extracted_data` con `year:2008, month:9` (presenze 18, ferie 6, riposi 7, voci RFI reali, fondo_pregresso 32.354,68) → contenuto = busta **SETTEMBRE 2008**.
- Slot **Set2008** (file 76,4KB): `extracted_data` **VUOTO** (mai scansionato). File DIVERSO (dimensione) da quello del 2009.

## Verificato su buste reali + griglia (30/06) → CASO A (no rischio perdite)
- [x] File Set2008 (76,4KB): testata "Stipendio di Settembre 2008", val. 25.09.2008 → è la vera Set2008.
- [x] File Set2009 (85,4KB): testata "Stipendio di Settembre 2008", val. 25.09.2008 → **doppione del 2008**.
- [x] Griglia `2008-8` (Settembre 2008): presente e corretta (0152:296,32 / pres.18 / ferie 6 / arretrati 220,53).
- [x] Griglia `2009-8` (Settembre 2009): contiene gli STESSI numeri 2008 → da sostituire con la vera Set2009.
      (residui da tenere d'occhio post-scan, tipo Tozzi: `fondo_pregresso_31_12`=32354,68, `imponibile_tfr_mensile`=0)
- [ ] Busta NUOVA (mail Gentile): confermare testata = **Settembre 2009** prima di caricarla (NON un altro 2008).

## Sequenza (Caso A — come Tozzi)
- [x] [APP, utente] caricato la vera **Settembre 2009** (l'utente ha fatto cancella+ricarica, non upsert).
      Risultato OK: payslip_metadata Set2009 `year:2009`, presenze 10, UNA riga, no doppione; Set2008 intatto.
- [x] [SQL io] verificato griglia `2009-8` = numeri 2009 reali (0152 296,32→193,34; 3B01 1.615,76→1.685,21; gg 18→10);
      **azzerato `fix_targets` → []**. Residuo MERGE: griglia `arretrati`=220,53 (reale 0) → COSMETICO (colonna "(Esclusi)",
      fuori da TOTALE/credito/%/documenti; cfr. `EXCLUDED_INDEMNITY_COLS`). Lasciato (come residui Tozzi).
- [ ] [APP, utente] **HARD-REFRESH** (anti-clobber: rende stabile il flag azzerato).
- [ ] [DOC, utente] rigenerare documenti Gentile (chiusa → il 2009 cambia: prima Settembre contava i numeri 2008)
      e inviarli allo Studio Celentano con la busta recuperata.
- [opz.] [APP] azzerare "Arretrati / Altro" di Sett 2009 nella griglia (solo estetica, non cambia nulla).

### Review (2026-06-30 pom.)
Recupero #5 (Gentile Set2009) completato. Caso A confermato su buste reali (entrambi i file Settembre = "Set 2008"):
Set2008 era già coperto (file proprio + griglia corretta), lo slot 2009 aveva un doppione del 2008 → sostituito.
Nessuna perdita. Verifica solida; unico residuo cosmetico (arretrati, escluso da tutto). **Recuperi 5/7**, restano
**Avella (Set2009)** + **Cataneo Pasquale (Nov2008)**.

---

# Anteprima PDF prospetto Gagliano per Vincenzo (WhatsApp) — 2026-06-30

> Vincenzo (call 30/06) vuole un'anteprima di Gagliano: la sua vista viewer è bloccata
> (manutenzione + pagamento). Gli giriamo via WhatsApp **solo il prospetto + % incidenza**
> (la pagina report finale, nodo `#riepilogo-card`). Sorgente = **locale (dev)**, formato = **PDF**.
> NB: Gagliano è **incompleta** (mancano buste in recupero) → anteprima PROVVISORIA, da etichettare.

## Vincoli / decisioni
- NON sbloccare l'account viewer di Vincenzo: il `viewer_payment_block` resta `true` (leva 750 €).
  L'anteprima è un artefatto piatto (PDF), non accesso alla piattaforma.
- Vista **owner** (mio account, non l'UID di Vincenzo) → si vede Gagliano e si esporta sempre.

## Passi (verifica per passo)
- [x] 1. [ENV] `npm run dev` su (5173 occupata → 5174). Server fermato a fine task.
- [x] 2. [BROWSER] Tab su localhost:5174; login owner fatto dall'utente.
- [x] 3. [NAV] Ricerca "Gagliano" → scheda Gagliano Dario (Mercitalia Rail) → tasto REPORT → pagina incidenza.
- [x] 4. [PDF] Generato PDF di `#riepilogo-card` via captureReportPdfBlob → ma conteneva SOLO il prospetto
      (la tabella % è una card SEPARATA fuori da #riepilogo-card). PDF su Desktop = parziale → superato.
- [x] 5. [CONSEGNA] L'utente ha fatto a mano uno **screenshot** della pagina (prospetto + % insieme):
      `~/Desktop/Screenshot 2026-06-30 alle 11.45.02.png` (545 KB, 2390×1764). Verificato: completo e leggibile.

### Review (2026-06-30)
- Anteprima Gagliano consegnata come **screenshot PNG** (non PDF): include sia il prospetto (TOTALE DOVUTO
  €2.212,51) sia la % incidenza (MEDIA PERIODO 17,09% < soglia 20%). Pronto per WhatsApp.
- Lezione tecnica: `captureReportPdfBlob(#riepilogo-card)` cattura SOLO il prospetto; la tabella % incidenza
  (IndemnityPivotTable) è un nodo sibling fuori dalla card → per un PDF unico servirebbe catturare l'antenato
  comune o un multi-pagina. Per un'anteprima veloce lo screenshot di pagina è la via più semplice.
- Caveat comunicati: pratica parziale (5/7 anni, 96%) → numeri provvisori; viewer di Vincenzo resta bloccato.
- Cleanup: dev server :5174 fermato (il :5173 dell'utente non toccato). PDF parziale su Desktop = da rimuovere.

---

# Recupero buste misfiled #2-#4 — Tozzi (Nov2008 + Set2009) + Cataneo V (Set2009) (2026-06-30)

> Secondo blocco di recuperi dopo Mottola (#1). Playbook = memoria `project-audit-mese-archivio-vs-testata`.
> **Differenza-chiave da Mottola:** i mesi di destinazione (Tozzi Dic2008 e Set2008; Cataneo V Set2008)
> ESISTONO GIÀ con i dati in `payslip_metadata` e nella griglia `anni` → **NIENTE salvataggio-dati SQL**.

## Fatti verificati (PDF + DB, 30/06)
- File veri localizzati e confermati dal contenuto (testata):
  - Tozzi Novembre 2008 → `~/Downloads/Novembre 2008.PDF` (presenze 22, retr. 1.670,27, minimo 1.395,91)
  - Tozzi Settembre 2009 → `~/Downloads/CEDOLINO (24).PDF` (presenze 14, retr. 1.730,27, minimo 1.455,91)
  - Cataneo V Settembre 2009 → `.../CATANEO VINCENZO/2009/Settembre 2009.PDF` (presenze 15, minimo 1.455,91)
- Slot misfiled confermati in `payslip_metadata`: Tozzi Nov2008=ed_month 12 (Dic); Tozzi Set2009=ed_year 2008; Cataneo V Set2009=ed_year 2008.
- Griglia `anni` tiene il contenuto sbagliato: Tozzi Nov2008→dati Dic (TFR mens 28.329,81); Tozzi/CataneoV Set2009→dati Set2008 (minimo 1.395,91, gg 13/17).

## Passi (verifica per passo)
- [x] 1. [APP] Carica+scansiona i 3 file veri nei slot corretti (fatto dall'utente 30/06).
      Rinominato `CEDOLINO (24).PDF`→`Settembre 2009.PDF` → auto-parse + sovrascrittura in-place.
- [x] 2. [APP] Doppione: NON serve — i nomi file allineati hanno fatto sovrascrivere in-place lo stesso storage_path. 1 sola riga per slot, zero "(1)".
- [x] 3. [SQL] `fix_targets`→`[]` per Tozzi (764fef08…) e Cataneo V (b90f6e89…). HARD-REFRESH app pendente lato utente.
- [x] 4. [VERIFICA] Archivio: ed_month/ed_year corretti (Tozzi Nov 12→11, Tozzi/CataneoV Set 2008→2009). Griglia: gg+minimo+voci reali; residuo TFR Tozzi Nov2008 (28.329,81) cosmetico (max anno=28.329,81 con/senza nov → 0 impatto).
- [ ] 5. [DOC] Rigenerare documenti pratiche toccate (utente, nell'app): Tozzi (chiusa, 2008+2009 cambiati) + Cataneo V (trattativa, 2009).
- [x] 6. Memoria aggiornata. Restano 3 recuperi: Avella-Foggia Set2009, Cataneo Pasquale Nov2008, Gentile Set2009.

### Review (2026-06-30)
Recuperi #2-#4 completati. Divisione: utente = carica+scansiona in-app; io = verifica DB + SQL flag.
- **Archivio**: 3 slot corretti in-place (nessun doppione, niente cancellazioni). Mesi destinazione (Dic2008/Set2008) intatti.
- **Griglia `anni`**: Tozzi Set2009 (14gg/1.455,91) e Cataneo V Set2009 (15gg/1.455,91) pienamente corretti; Tozzi Nov2008 voci=novembre reale (0152/0470/0496/0932/0933 ok), unico residuo `imponibile_tfr_mensile` cosmetico (verificato non-total-mover).
- **Niente salvataggio-dati SQL** (a differenza di Mottola: i mesi di destinazione avevano già i dati).
- **Flag**: fix_targets azzerati per i due → spariranno dal badge "da sistemare", dal filtro Urgenze (6→4) e dalla lista buste-mancanti del viewer dopo l'hard-refresh/deploy.
- **Da fare lato utente**: hard-refresh app (anti-clobber); rigenerare i documenti di Tozzi (pratica chiusa: il 2008 prima contava 2× dicembre e zero novembre) e Cataneo V se già prodotti.

---

# Manutenzione sito — deploy + advisor Supabase (2026-06-28) ✅

Scope concordato: **A (deploy) + B (advisor quick win)**. C (refactor codice) escluso.

## A. Deploy degli 8 commit (50aa8b9 → 7bf0a20)
- [x] Gate pre-deploy: `npx tsc --noEmit`=0, `npm test`=229/229 verdi, `npm run build`=ok (exit 0).
- [x] `git push origin main` (96af9b8..7bf0a20). Netlify auto-deploy `railflow-2`.
- [x] Verifica live: deploy `ready/current`; l'entry servito `assets/index-CeFE0ynh.js` combacia con l'hash del build locale → il nuovo bundle è online.
- [x] Blocco viewer: `app_settings.viewer_payment_block=true`, `payment_amount_eur=750` (invariato) → Vincenzo al login trova il blocco "manutenzione" con importo. Importo TENUTO (saldo legato al recupero buste mancanti).

## B. Advisor Supabase (migration MCP `pin_function_search_path_and_index_messages_author`)
- [x] `function_search_path_mutable` ×4 risolto: `search_path=''` sui 3 trigger (handle_updated_at, update_updated_at_column, scan_sessions_block_immutable_changes); `search_path=public` su `match_legal_chunks` (referenzia tabelle + operatore `<=>` del vector in public → '' lo romperebbe).
- [x] `unindexed_foreign_keys` su `messages.author_id` → `idx_messages_author_id`.
- [x] Advisor ri-controllato: i 5 lint chiusi. Restano per scelta (bassa priorità): RLS `USING(true)` ×6 (RAG legal_*), security-definer QR ×4, `extension_in_public` (vector), leaked-password (Pro-only won't-fix).

## Aperti (outward-facing, NON eseguiti senza OK)
- [ ] Annuncio bacheca "buste paga mancanti" (`messages` via MCP): testo pronto, **in attesa OK** prima di pubblicare.
- [ ] Spegnere il blocco 750€ quando Vincenzo paga: `UPDATE public.app_settings SET viewer_payment_block=false, updated_at=now() WHERE id=1;`

---

# Piano — Vista Vincenzo: messaggio (solo pagati) + Word disguido Margherita (2026-06-28)

> Prima della manutenzione: due ritocchi sulle "buste paga mancanti".
> Fonti distinte nel codice: `fix_targets`/`fixTargets` = misfiled (disguido Margherita,
> mesi presenti ma "pieni" di busta sbagliata → invisibili a `formatMissingMonths`);
> `status==='inviata'` = buste genuinamente mancanti (base del Word).
> DB: 6 lavoratori con fix_targets → 4 pagati (Avella, Gentile, Mottola, Tozzi) + 2 Cataneo non pagati.

- [x] 1. `components/ViewerPaymentBlock.tsx` — elenco buste mancanti del messaggio solo per i PAGATI
      (select +`status`, filtro `isPaid`) → spariscono i 2 Cataneo, restano i 4.
- [x] 2. `utils/reportGenerator.ts` (`generateReport`) — nuova sezione dedicata "disguido nominativi"
      con tutti e 6 i lavoratori con `fixTargets` (`formatFixTargets`), in coda ai mesi-mancanti reali.
      Refactor: `buildMissingTable` → `buildNameValueTable(workers, header2, valueFn)` riusato 2 volte.
- verifica: `tsc --noEmit`=0 ✓; 229 test verdi ✓; Word generato realmente (test usa-e-getta
  con file-saver mockato → XML del .docx contiene sezione disguido + tutti i fixTargets + sezione mancanti) ✓.

### Review
- **Intervento 1**: messaggio di Vincenzo ora elenca solo i 4 pagati, raggruppati per periodo
  (verificato via SQL = stessa logica del componente): *Novembre 2008* → Mottola, Tozzi;
  *Settembre 2009* → Avella (Foggia), Gentile, Tozzi. I 2 Cataneo (inviata/trattativa) esclusi.
- **Intervento 2**: il Word ha ora 2 blocchi — (a) mesi realmente mancanti dei 7 'inviata' (invariato);
  (b) sezione "Buste paga da ricontrollare — disguido nominativi" con tutti e 6 i lavoratori misfiled
  (anche i pagati), nota controllo Margherita/studio Celentano, mesi formattati con `formatFixTargets`.
- Nessuna migration (sola lettura). Modifiche locali NON deployate (batch col deploy di manutenzione).

---

# Piano — Viewer Vincenzo post-sblocco: "vede tutto, scarica le Pagate" + buste mancanti (2026-06-28)

> Cambio di policy rispetto al lockdown del 16/06. Oggi il viewer vede SOLO le Pagate
> e non scarica nulla. Nuova regola: **vede tutto**, ma **scarica/stampa solo le pratiche
> Pagate** (per quelle può portarsi via TUTTO: conteggi, relazione, Excel, ZIP/PDF buste —
> tranne il backup JSON gestionale). Più: aggiornare il messaggio di blocco con l'elenco
> delle buste paga mancanti, e replicarlo come annuncio persistente in bacheca.

**Decisioni (confermate dall'utente 28/06):**
- Visibilità: il viewer vede TUTTE le pratiche in ogni stato (anche buste in lavorazione e Viterbo `in_corso`).
- Download: solo sulle PAGATE → "tutto della pratica" (escluso backup JSON gestionale). Non-pagate = sola consultazione a video.
- "Pagata" = buste/RFI `worker.status==='chiusa'`; riposi `pratica.stato==='pagata'`.
- Elenco buste mancanti: nel blocco pagamento **+** annuncio persistente in bacheca.

## Parte 1 — Visibilità: vede tutto  ✅
- [x] 1.1 `hooks/useWorkers.ts` — rimosso filtro `status==='chiusa'` per il viewer → `list = all` (+ import orfano).
- [x] 1.2 `hooks/usePraticheRiposi.ts` — rimosso filtro `stato==='pagata'` → `setPratiche(list)` (+ import/var orfani).

## Parte 2 — Download SOLO sulle Pagate ("tutto della pratica")  ✅
- [x] 2.1 Helper `canExportForViewer(isReadOnly, isPaid)` in `lib/readonly.ts`.
- [x] 2.2 Buste/RFI (gate su `worker.status==='chiusa'`):
      `TableComponent` → "Documenti" (ZIP: conteggi+riepilogo+relazione .docx) e "Stampa";
      `RelazioneModal` (testuale) → bottoni "Stampa Ufficiale"/"Copia" (a video resta consultabile);
      `ArchivePage` → "Download" busta PDF (gate su `selectedWorker.status`).
- [x] 2.3 Riposi `RiposiPraticaDetail` (gate su `pratica.stato==='pagata'`): blocco azioni Excel/Relazione/Stampa conteggi + RelazioneRiposiModal.
- [x] 2.4 Restano owner-only: "Diffida"; `StatsDashboard` "EXPORT REPORT" (aggregato globale, non per-pratica);
      menu "Dati"; "Export Backup" isola; "Apri vademecum"; verify Gemini; ogni bottone di editing.
- verifica: `tsc --noEmit` = 0 ✓; test ⏳; rilettura diff ⏳.

## Parte 3 — Buste mancanti (blocco + bacheca)
Fonte unica = `worker_profiles.fix_targets` (già allineati alla lista utente). Niente costanti duplicate.
Lista confermata 28/06 (combacia col DB):
  - NOVEMBRE 2008: Mottola Angelo (RFI), Cataneo Pasquale (Trenitalia), Tozzi Tommaso (RFI)
  - SETTEMBRE 2009: Avella Antonio (RFI), Cataneo Vincenzo (RFI), Gentile Celestino (RFI), Tozzi Tommaso (RFI)
- [x] 3.1 Verifica allineamento DB↔lista: 6 worker, fix_targets identici. Nessun UPDATE dati.
- [x] 3.2 `ViewerPaymentBlock.tsx` — sezione "Buste paga mancanti" (query live, raggruppata per periodo; sparisce quando sistemi tutto).
      Testo riscritto in chiave **manutenzione** (no "accesso sospeso"); credito "da regolarizzare per il ripristino";
      controllo attribuito a **Margherita** (studio avv. **Celentano**); icona Wrench + accenti ambra/slate.
- [ ] 3.3 Bacheca: annuncio persistente in `messages` via MCP — **testo pronto, in attesa OK utente** prima di pubblicare (outward-facing).
- verifica: tsc=0, 229 test ✓; resa a schermo ⏳ (da deploy).

## Parte 4 — Filtro "Urgenze"  ✅
- [x] 4.1+4.2 `pages/DashboardPage.tsx` — toggle "Urgenze (N)" (rosso, icona AlertCircle) nella barra strumenti; gli urgenti
      calcolati da `workers` (fixTargets non vuoto), riusa la **vista flat** (come la ricerca) senza toccare i cassetti;
      conteggio aggiornato e nascondi-se-zero. Nessuna modifica a `useWorkers`.
- verifica: tsc=0, 229 test ✓; urgenti dal DB = 6.

## Verifica finale
- [ ] `npx tsc --noEmit` pulito · `npm test` verde.
- [ ] Rilettura diff: editing sempre gated `!isReadOnly`; download gated sullo stato; owner invariato.
- [ ] Deploy: accorpare ai 6 commit già in attesa di push.

**Note:** nessuna migration (le RLS consentono già al viewer la SELECT su worker_profiles,
payslip_metadata, storage.objects, pratiche_riposi). Il blocco 750€ resta attivo finché non
saldi — questo piano cambia solo cosa vedrà/scaricherà DOPO lo sblocco.

## Review (2026-06-28)
10 file toccati, tutto chirurgico (2 filtri rimossi + gate export + 1 toggle + sezione blocco). tsc=0, 229 test verdi.
- Viewer: vede tutto; scarica/stampa SOLO le pratiche pagate (buste 'chiusa' / riposi 'pagata'); editing e aggregati owner-only.
- Blocco: narrativa "manutenzione" (icona Wrench, ambra), importo "da regolarizzare", buste mancanti live (Avella → Foggia), Margherita/studio Celentano.
- Filtro "Urgenze (6)" in dashboard via vista flat, senza toccare i cassetti.
- Bacheca (annuncio): testo pronto, **NON pubblicato** (outward-facing, in attesa OK).
- Niente migration (RLS già aperte in lettura). Tutto locale → si attiva col deploy (si accoda ai 6 commit pendenti).
- NB: blocco viewer ancora ATTIVO sul DB (`viewer_payment_block=true`, 750€): spegnere via MCP quando Vincenzo paga.
- Aperto: importo nel blocco (tenere/togliere) da confermare.

---

# Lockdown account viewer Vincenzo Cataneo (2026-06-16)

Dopo l'incontro 15/06: l'account in sola consultazione di Vincenzo
(`vincenzocataneofg@gmail.com`, UID `34967593-…c7b9e`) deve poter
**solo consultare la sezione "Pagate"** e **non scaricare né stampare**
alcun documento.

"Pagate" = area buste → worker con `status === 'chiusa'` (cassetto "Pagate");
area riposi → pratica con `stato === 'pagata'` (Viterbo è `in_corso` → si nasconde).

Decisione utente (16/06): bloccare anche i pulsanti **Stampa** (= salva-PDF).

## A. Visibilità: solo "Pagate"
- [x] A1 `hooks/useWorkers.ts` — in `loadWorkers(userId)` filtrare `list` a
      `status === 'chiusa'` quando `READONLY_VIEWER_UIDS.has(userId)`
      (chokepoint unico: propaga a cassetti, ricerca, stats, hash, isola).
- [x] A2 `hooks/usePraticheRiposi.ts` — filtrare `pratiche` (DB + seed) a
      `stato === 'pagata'` per il viewer readonly.

## B. Niente download / stampa per il viewer (gate `!isReadOnly`)
- [x] B1 `pages/DashboardPage.tsx` — nascosto l'intero menu "Dati".
- [x] B2 `components/DynamicIsland.tsx` — nascosto "Export Backup" (JSON).
- [x] B3 `components/TableComponent.tsx` — nascosti "Documenti" (ZIP) e
      "Stampa". Lasciata "Relazione" (sola lettura, export già gated).
- [x] B4 `components/StatsDashboard.tsx` — nascosto "EXPORT REPORT" (stampa PDF).
- [x] B5 `pages/ArchivePage.tsx` — nascosto l'anchor "Download" della busta PDF.
- [x] B6 `components/RiposiPraticaDetail.tsx` — nascosti Excel / Relazione .docx / Stampa conteggi.
- [x] B7 `components/RiposiArea.tsx` — nascosto "Apri il vademecum".

## C. Verifica
- [x] `npx tsc --noEmit` pulito (exit 0).
- [x] `npm test` verde — 16 file, 213 test passati.
- [x] Rilettura diff: ogni gate tocca solo il ramo readonly; owner invariato.

## Note / limiti
- Il visore interno della busta (iframe/PDF nativo del browser) ha controlli di
  download propri del browser non bloccabili da codice app: fuori scopo.
- Le RLS sul DB restano invariate (il viewer legge tutto via RLS; il filtro
  "solo pagate" è lato client, coerente con l'architettura readonly esistente).

## Review
Fatto il 2026-06-16. 9 file sorgente toccati, ~modifiche minime (gate `!isReadOnly`
+ 2 filtri al caricamento). 213 test verdi, tsc pulito.

Cosa cambia per l'account di Vincenzo (UID `34967593-…c7b9e`):
- **Vede solo le pratiche "Pagate"** — buste: cassetto 'chiusa'; riposi: 'pagata'
  (Viterbo `in_corso` sparisce). Il filtro è al caricamento, quindi vale anche per
  ricerca, statistiche, deep-link via hash e isola: non può raggiungere una pratica
  non pagata nemmeno per URL.
- **Non può scaricare nulla**: niente menu "Dati" (JSON/Word), niente Export Backup,
  niente "Documenti" (ZIP), niente Excel/Relazione .docx/vademecum, niente Download
  busta dall'archivio.
- **Non può stampare** (decisione 16/06): via i bottoni Stampa report, EXPORT REPORT,
  Stampa conteggi.
- Resta consultabile a video: report, relazione (modale, export già bloccato), buste
  nel visore interno.

Owner (account principale) completamente invariato: tutti i gate sono `!isReadOnly`.

NON deployato: modifiche locali, da accorpare al deploy ufficiale (2026-06-18).

Limite noto: il visore PDF interno (iframe) espone i controlli di download nativi del
browser, non bloccabili da codice app. Se diventa un problema, valutare un render
custom (pdf.js) senza toolbar — fuori dallo scopo di oggi.

---

# Avviso pagamento bloccante viewer (2026-06-16)

Obiettivo: alla prossima apertura, Vincenzo (viewer) trova una schermata a tutto
campo non skippabile = **blocco totale** finché non salda **750 € (non trattabili)**
per le pratiche concluse + l'aggiornamento del sito. Toggle via DB (no redeploy).

- [x] Migration `018_app_settings.sql` (riga singola; SELECT autenticati, UPDATE owner;
      `viewer_payment_block=true`, `payment_amount_eur=750`). **Applicata al DB live** + verificata.
- [x] Hook `useViewerPaymentBlock()` in `lib/readonly.ts` (fail-open).
- [x] Componente `components/ViewerPaymentBlock.tsx` (full-screen, solo logout).
- [x] `App.tsx`: gate di loading + early-return della schermata al posto dell'app.
- [x] `npx tsc --noEmit` pulito · `npm test` verde (213).

Spegnere quando paga (via MCP):
`UPDATE public.app_settings SET viewer_payment_block=false, updated_at=now() WHERE id=1;`

NON deployato: live inerte finché non pubblichi (~18/06). Testo avviso in
`ViewerPaymentBlock.tsx`, modificabile prima del deploy.
