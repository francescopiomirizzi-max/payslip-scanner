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
