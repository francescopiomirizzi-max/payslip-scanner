# UX fixes — sessione 2026-06-09 (seconda parte)

Pacchetto concordato dopo review UX: feedback/conferme coerenti + URL sync.
(La prima parte della giornata — fix Strategia B card credito — è completata e committata.)

## Piano

- [x] 1. Toast errore persistenti: in `App.tsx` `addToast`, i toast `error` senza
      `duration` esplicita non si auto-chiudono (restano finché l'utente non li chiude).
- [x] 2. Eliminazione multipla coerente:
      - `useWorkers`: nuova `handleDeleteWorkersBulk(ids)` — rimozione ottimistica,
        UN solo toast con Annulla (5s), una sola delete batch `.in('id', ids)`.
      - `ConfirmModal`: props opzionali `title`/`message`/`confirmLabel` (default invariati).
      - `DashboardPage`: via `confirm()` nativo → `ConfirmModal`; via N toast → bulk.
- [x] 3. Export Concluse senza `alert()` + progresso visibile:
      - `DashboardPage` riceve `addToast`; esiti via toast (errore = persistente,
        dettaglio failures in console).
      - Pill di progresso fissa in basso al centro mentre `concluseStatus` è attivo.
- [x] 4. `TableComponent`: `alert()` su export fallito → toast errore (prop `addToast`
      opzionale con fallback alert per robustezza).
- [x] 5. URL sync (hash routing, senza router): `hooks/useHashRoute.ts` cablato in `App.tsx`.
      - `#/` home · `#/stats` · `#/archive[/:id]` · `#/worker/:id` · `#/report/:id` · `#/riposi`
      - Back/Forward, F5 e deep-link funzionano; id inesistente → fallback home;
        l'init aspetta `isReady` (auth + workers caricati), quindi il deep link
        sopravvive al login. Entry mobile QR (`?mobile=true`) non passa di qui.
      - `handleBack` ora azzera anche `archiveWorkerId` (niente id stale nell'URL).
- [x] 6. Verifica: `npx tsc --noEmit` pulito · `vite build` ok · **157 test verdi**
      (150 + 7 nuovi in `__tests__/useHashRoute.test.tsx`).

## Secondo giro (stessa sessione) — punti 3, 4, 8 + ricerca estesa

- [x] 3. Affordance solo-hover rese sempre visibili:
      - badge "CLICCA PER DETTAGLI" (card Netto/Ticket) → chip "Dettagli ›" sempre
        visibile, con varianti dark;
      - "Vedi Report" nella modale statistiche → sempre visibile (era opacity-0
        fino al group-hover: invisibile su touch).
- [x] 4. Toggle Ticket globale: ora apre `ConfirmModal` (arancio) con conteggio
      pratiche coinvolte + toast di esito; niente più riscrittura di massa al click secco.
- [x] 8. Note di metodo nelle card (onnicomprensività Cass. 20216/2022, buoni pasto):
      da text-[10px] semi-trasparente hover-dependent → text-xs leggibile a riposo.
- [x] Ricerca estesa: `filteredWorkers` matcha anche azienda (underscore→spazio,
      come la mostra la UI) e ruolo; placeholder aggiornato.
- [x] Test: +6 in `useWorkers.test.tsx` (bulk delete: un solo toast/una sola delete
      batch/undo; ricerca per azienda/ruolo/cognome). Mock esteso con `.delete().in()`.
- [x] 7. Angolo basso-destra decongestionato (ok utente): toast spostati in alto a
      destra (`top-6 right-4`, entrata dall'alto), basso-destra resta ai soli bottoni
      scroll-top + scorciatoie; aggiornato il testo della modale bulk delete.
- [~] 9. Accessibilità/animazioni — ESCLUSO su richiesta dell'utente.

## Review

- Verifica finale: `npx tsc --noEmit` pulito · `vite build` ok · **163 test verdi**.
- Nessun `alert()`/`confirm()` residuo nei flussi principali; resta UN alert in
  `RagAdminPanel.tsx` (pannello admin RAG, fuori scope) e il fallback difensivo in
  `TableComponent`.
- La pill export e la barra selezione condividono bottom-center: sovrapposizione
  possibile solo esportando in selection mode (caso remoto, accettato).
- NON committato, NON deployato (batching Netlify).
