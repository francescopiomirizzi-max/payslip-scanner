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

## Quarto giro — proposte visive 1 e 2 (timeline anni + header compatto)

- [x] V1. Timeline anni sulla WorkerCard (sostituisce la barra % generica):
      - `utils/workerStatus.ts`: nuovo `getYearCoverage` — stesso range/definizione di
        "mese compilato" di formatMissingMonths, così card e Report Word coincidono;
      - `WorkerCard`: componente `YearTimeline` — una tacca per anno (verde 12/12,
        ambra parziale, grigio vuoto), tooltip "anno · N/12 mesi", label
        "Copertura buste · X/Y anni · %"; click su tacca → Gestione Buste su
        quell'anno (hint one-shot `sessionStorage openYear_<id>` letto
        dall'inizializzatore di `currentYear` in WorkerDetailPage);
      - rimosso il memo stats ormai morto (restava solo `range` → `yearsRange`).
- [x] V2. Header dashboard compatto: logo 128→56px, titolo 5xl→3xl, bottoni
      py-3→py-2.5 con icone w-4, gap/margini ridotti (≈90px verticali recuperati);
      skeleton di caricamento in App.tsx allineato.
- [x] Verifica: tsc pulito · build ok · **167 test verdi** (+4 workerStatus.test.ts).

## Quinto giro — proposte visive 3 e 4 (variante utente)

- [x] V4 (idea utente, migliore dell'originale): card colorata per AZIENDA + tacca
      laterale colorata per STATO:
      - `WorkerCard`: tema derivato da `worker.profilo` (RFI blu, Trenitalia rosso,
        Elior arancio, Clean Service smeraldo, Mercitalia ambra — hex canonici di
        SYSTEM_PROFILES; custom → famiglia deterministica via getCustomColorIndex,
        stessa palette dei badge); `accentColor` casuale non guida più la card
        (resta usato da header dettaglio/modale stats — fuori scope);
      - hexMap esteso con red/amber/cyan/fuchsia; Sparkline riceve il colore dal tema;
      - tacca stato potenziata: 5px (7px in hover), gradiente sfumato alle estremità,
        glow, tooltip con label stato.
- [x] V3. Tipografia/numeri: `tabular-nums` su tutti gli importi (3 hero dashboard,
      modale stats importi+totale, retro card: recupero/ticket/lordo/g.utili);
      formato € unificato sul retro card (maximumFractionDigits:0, via il
      .replace(',00','') che teneva i decimali solo a volte); label retro card
      7-8px→9px tracking-wide.
- [x] Verifica: tsc pulito · build ok · 167 test verdi.

## Sesto giro — header definitivo + V5 dark mode + V6 titolo tab

- [x] Header a TRE CORSIE (fix sovrapposizione segnalata dall'utente): grid
      `auto | minmax(260px,1fr) | auto` — brand a sinistra, corsia centrale VUOTA
      riservata alla Dynamic Island (fissa top-center, 140px idle), azioni a destra.
      La collisione bottoni/isola sparisce per costruzione.
- [x] Brand ricalibrato (era troppo piccolo a 56px/3xl): logo 80px con ring sottile +
      alone gradiente in hover, titolo 4xl, sottotitolo 11px; bottoni uniformati h-11
      con whitespace-nowrap; skeleton App.tsx allineato.
- [x] V5 dark mode: Toast con varianti dark (success/error/info + bottoni azione);
      badge profilo modale stats da hardcoded ELIOR/blu → registro SYSTEM_PROFILES
      (con dark, fallback neutro custom); ranking # con dark:text-slate-600;
      chip stato WorkerCard: rimossi `dark:bg-opacity-*` (utility INESISTENTI in
      Tailwind v4 → in dark il chip restava chiaro), aggiunte varianti dark vere
      per i 5 stati.
- [x] V6 titolo tab dinamico: "Cognome Nome · RailFlow", "Archivio · RailFlow",
      "Statistiche · RailFlow", "Turni & Riposi · RailFlow" (effect in App.tsx).
- [x] Verifica: tsc pulito · build ok · 167 test verdi.

## Settimo giro (chiusura) — colore-azienda ovunque + hero compatte + stats/login

- [x] Colore-azienda come linguaggio unico: helper centrali in `config/profiles.ts`
      (`getCompanyColorKey` / `getCompanyGradient` / `getCompanyHex`); WorkerCard
      usa l'helper condiviso (via mappa locale); avatar header dettaglio
      (`WorkerDetailHeader`) e colori modale stats (`useDashboardStats`) ora
      azienda-based — l'`accentColor` casuale NON guida più nessuna UI (resta solo
      campo DB legacy); `COLOR_VARIANTS` esteso con red/fuchsia/rose/teal.
- [x] Hero cards dashboard compattate: min-h 220→180px, p-8→p-6, mb-6→mb-4,
      gap-8 mb-10→gap-6 mb-8; skeleton allineato (h-56→h-48).
- [x] StatsDashboard: tabular-nums sui 6 numeri grandi; badge profilo nel ranking
      dal grigio neutro al colore-azienda (inline hex); barColor custom via
      getCompanyHex (via array duplicato); rimosso `bg-opacity-90` (no-op Tailwind v4).
- [x] LoginPage: logo vero con alone gradiente al posto del lucchetto generico.
- [x] Verifica: tsc pulito · build ok · 167 test verdi.
- NOTA (fuori scope, da valutare): StatsDashboard legge le preferenze SOLO da
      localStorage (tickets_/exFest_/startYear_) ignorando i campi worker.* cloud —
      incoerente con card/dashboard che preferiscono i campi; non toccato perché
      cambierebbe i numeri, non l'estetica.

## Ottavo giro — Archivio ridisegnato (4 interventi, ok utente)

- [x] A1. Mesi a GRIGLIA-CALENDARIO (4×3) al posto della lista: cella piena nel
      gradiente azienda = PDF (clic per aprire, ring se selezionata), bordo
      colorato = solo dati, tratteggiata = mancante; `yearTree` ora genera sempre
      12 mesi; header anno con micro-barra a 12 punti + "N/12" tabular-nums.
- [x] A2. Navigazione sequenziale buste: frecce ‹ › nel visore + tasti ←/→
      (ignorati su input/select e con modale aperta), contatore "5/38",
      `orderedPayslips` cronologico, anno auto-espanso al salto.
- [x] A3. Colonna lavoratori nel linguaggio azienda: avatar con gradiente
      aziendale, selezione con tacca+velo nel colore azienda (via indigo fisso),
      etichetta azienda del worker header col2 nel suo colore.
- [x] A4. Polish: header visore con gerarchia giusta (Mese Anno titolo, filename
      secondario), Download nel gradiente azienda, empty states con alone
      gradiente e hint d'uso, icona drag&drop con rimbalzo, tabular-nums sui conteggi.
- [x] Verifica: tsc pulito · build ok · 167 test verdi.

## Review

- Verifica finale: `npx tsc --noEmit` pulito · `vite build` ok · **163 test verdi**.
- Nessun `alert()`/`confirm()` residuo nei flussi principali; resta UN alert in
  `RagAdminPanel.tsx` (pannello admin RAG, fuori scope) e il fallback difensivo in
  `TableComponent`.
- La pill export e la barra selezione condividono bottom-center: sovrapposizione
  possibile solo esportando in selection mode (caso remoto, accettato).
- NON committato, NON deployato (batching Netlify).
