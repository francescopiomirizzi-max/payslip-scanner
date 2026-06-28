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
