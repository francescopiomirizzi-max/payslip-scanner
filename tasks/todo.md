# Todo — Sessione 18/07: PWA mobile — Fase 4 "scheda lavoratore mobile" (PIANO, in attesa di approvazione)

> **Contesto:** Fase 3 implementata e verificata (sotto), NON committata: collaudo visivo
> utente pendente. Fase 4 dal piano (`piano-web-app-mobile-fable-2026-07-16.md` §Fase 4):
> consultare la pratica e fare le azioni frequenti senza esporre la griglia desktop intera.
> Il piano la marca L, DA SPEZZARE. Inventario completo dal codice (metodo compose-file) in
> `scratchpad/inventario-scheda-lavoratore-fase4.md`.
>
> **Ricognizione (fatti chiave):** composizione = WorkerDetailHeader (11 controlli, riga
> `shrink-0` SENZA wrap → overflow certo a 390) → VertenzaTimeline (5 step + 3 toggle;
> **ticker stats `hidden xl:flex` → sotto 1280 le statistiche NON ESISTONO**) → CommandBar
> (4 azioni owner + 4 tab) → MonthlyDataGrid (1922 righe, ~25 tipi di controllo, minWidth
> colonne×100, drag-fill/undo/context-menu solo mouse+tastiera; griglia GIÀ controllata:
> `data`+`onDataChange` → debounce → `handleUpdateWorkerData`) → tab calc/pivot/tfr/archive
> + SplitViewViewer (pan/sniper senza touch) + 7 modali.
> **Sorprese:** scudo verify per-riga, "Accetta correzione/tutto" e **Start Year NON gated
> per il viewer** (può consumare chiamate Gemini e scrivere; il batch "Verifica anno" invece
> è gated); doppio toggle Ex-Festività indipendente (timeline vs Riepilogo Annuale); aria
> quasi assente; provider context non memoizzato (re-render globale a ogni keystroke).

## Tranche proposte (eseguirle una per sessione, gate pieno a ogni giro)

- [ ] **T1 — Shell consultabile** (rischio basso, questa sessione se approvata):
      header con wrap/compattazione max-sm (stessi 11 comandi), CommandBar e tab
      raggiungibili su touch (≥44px), VertenzaTimeline fruibile a 390 (step + toggle),
      **ticker stats reso accessibile sotto xl** (le card oggi spariscono: sostituto
      compatto, non rimozione), gate viewer su scudo verify/accetta/Start Year
      (stesso pattern useIsReadOnly di Fase 3 — decisione utente da confermare),
      aria-label sui controlli senza nome. NIENTE griglia in T1.
- [ ] **T2 — Vista mensile mobile** (rischio ALTO, da spezzare in T2a read-only →
      T2b editing): componente NUOVO `MonthlyDataMobile` affiancato a MonthlyDataGrid
      con le STESSE props (`data`+`onDataChange`+hook invariati, come chiede il piano);
      elenco mesi → dettaglio mese → voci; il sync scroll a 3 vie del monolite NON si
      porta su mobile (lì visse il re-render loop storico, MonthlyDataGrid:506);
      tabella completa resta come modalità desktop/tablet.
- [ ] **T3 — Tab Riepilogo/Pivot/TFR mobile** (basso-medio, CSS-mostly: scroll confinato
      + prima colonna sticky come da piano Fase 5-report).
- [ ] **T4 — Archivio tab + visore touch** (medio; lo "sniper"/pan del SplitViewViewer è
      rimandabile, il viewer a pagina intera è Fase 5).

**Criteri (dal piano §Fase 4):** nessun overflow globale della scheda; cambio anno +
lettura mese + aggiornamento semplice completabili su touch; stessi risultati di calcolo
mobile/desktop sullo stesso fixture; nessuna regressione autosave.
**Verifica:** protocollo demo+iframe (funziona: la scheda è raggiungibile in demo?
da verificare al primo giro — altrimenti misure su main + collaudo utente) + gate
tsc/vitest/build + diff review.

---

# Todo — Sessione 17/07: PWA mobile — Fase 3 "dashboard e consultazione mobile"

> **Contesto:** Fase 2 scanner COMMITTATA (`d22fb6d`, locale; 3 commit avanti a origin,
> push=deploy da decidere; resta il collaudo telefono reale dell'item 8). Da questa sessione
> **niente più Codex** (direttiva utente): verifiche e review le fa Fable coi gate del
> progetto. Scope Fase 3 dal piano (`piano-web-app-mobile-fable-2026-07-16.md` §Fase 3):
> trovare e aprire una pratica con una mano, su Dashboard Incidenza, owner E viewer alla pari.
> Desktop invariato (gate `pointer-coarse:` / `max-sm:` come nelle tranche 1/2).
>
> **Ricognizione (inventario completo dal codice in
> `scratchpad/inventario-dashboard-fase3.md`, metodo compose-file):** blocchi = SindacatoTag →
> hero+azioni (6 controlli + menu Dati 5 voci) → striscia KPI ↔ 3 card statistiche → ricerca +
> filtri azienda (già scrollabili, 14/07) → control bar (4 sort + Urgenze + Ticket + Seleziona)
> → 5 cassetti con chip per lavoratore → WorkerCard (fronte 10 controlli, retro note; flip via
> bottone dedicato) → overlay fissi (floating bar selezione ~700px nowrap, pill export,
> scroll-top, modale statistiche, MessagesInbox, EntryAnnouncements).
> **Rischi 390px:** 🔴 striscia KPI clippata senza scroll · 🔴 floating bar selezione ~700px
> fixed · 🔴 tacche YearTimeline 16px (unico accesso per-anno) · 🟠 congestione fascia bassa
> (AreaSwitch+bar+pill+scroll-top) · 🟠 target 28-36px sul flusso ricerca→apertura · 🟠 tilt 3D
> mousemove su touch · 🟠 zero `prefers-reduced-motion` in dashboard.
> **Finding fuori scope (da decisione utente):** «Ticket ON/OFF» globale e textarea note del
> retro NON gated per il viewer (la scrittura la ferma solo RLS → UI che sembra editabile).

## Piano (APPROVATO 17/07 — decisioni: flip resta via bottone · finding viewer gated DENTRO
## la tranche (Ticket+note read-only col pattern useIsReadOnly) · KPI = scroll orizzontale+fade)

- [x] 1. **Striscia KPI responsive**: sotto 640px scroll orizzontale con fade (`max-sm:
      overflow-x-auto` + utility `scroll-hint-x`); chip azienda ORA VISIBILI anche su mobile
      (prima `hidden sm:` senza sostituto); Espandi `pointer-coarse:p-[14px]` = 44px, fuori
      dallo scroller → sempre visibile. Verificato: scroller attivo a 356/390/430, 5 chip
      presenti, Espandi dentro il viewport; a 1276 nessuno scroll (1122=1122), invariata.
- [x] 2. **Hero header compatto su mobile**: `max-sm:` p-5, icona 48px, titolo 2xl,
      sottotitolo sm, gap azioni 2 — stessi comandi e label, zero rimozioni. Fix in corsa:
      menu Dati era right-0 sul bottone → **usciva di 62px a sinistra a 390 (misurato)** →
      `max-sm:left-0` + origin coerente; a 1276 resta allineato a destra (verificato).
- [x] 3. **Flusso ricerca→apertura su touch**: `pointer-coarse:min-h-11` su sort, Urgenze,
      Ticket, Seleziona, pill filtri, chip cassetti, voci menu Dati/•••/picker stato,
      "Vedi Report" del modale; X ricerca `p-3` + aria-label; fade sui filtri (`max-sm:
      scroll-hint-x`); capsula ricerca compattata sotto sm (py-4, text-base).
- [x] 4. **WorkerCard touch**: tilt 3D + spotlight disattivati su coarse (guard matchMedia);
      tacche YearTimeline con hit-area estesa a 44px verticali su coarse (pseudo `before:`,
      resa visiva h-4 invariata — larghezza per-tacca resta fluida: l'apertura pratica ha
      comunque i CTA grandi); chip stato con hit-area estesa; portal picker stato ora
      CLAMPATO al bordo destro del viewport; CTA `pointer-coarse:min-h-11`; back retro con
      aria-label + p-3 coarse. Desktop misurato invariato: tacca 16px, sort 28px, flip
      opacity 0 (hover-gated come prima).
- [x] 5. **Overlay fissi**: floating bar selezione `max-w-safe-viewport` +
      `max-[1060px]:flex-wrap` + `max-sm:bottom-24` (sopra l'AreaSwitch) — vedi Review per
      il P1 shrink-to-fit trovato misurando; pill export idem (bottom-24 mobile); badge DEMO
      `max-sm:top-[4.75rem]` = sotto l'Island (76 > 64 misurato); modale statistiche
      z-60→**z-80** (copriva/era coperta dall'AreaSwitch a pari z); hint tastiera
      `pointer-coarse:hidden` (scorciatoie ⌘ inutili senza tastiera fisica).
- [x] 6. **A11y + reduced-motion**: aria-label su X selezione, back retro, scroll-top,
      X ricerca, X modale statistiche; `MotionConfig reducedMotion="user"` a livello App
      (spegne transform/layout animation di TUTTI i motion con "riduci movimento" attivo);
      `useReducedMotion` in AnimatedCounter (jump al valore); CSS: `animate-pulse/ping`
      fermati sotto `prefers-reduced-motion` (animate-spin sui loader resta: comunica stato).
- [x] 6-bis. **Gate viewer (decisione b)**: Ticket ON/OFF → pillola statica informativa per
      il viewer; textarea note retro → readOnly + placeholder "Nessuna nota" (scrittura già
      bloccata da RLS, ora la UI non mente più).
- [x] 7. **Gate**: tsc 0 · **344/344 test** · build ok (solo warning chunk preesistente);
      classi verificate nel CSS prodotto; misure DOM reali (vedi Review).
- [ ] 8. **Collaudo visivo utente** (390px + desktop + viewer) → chiusura tranche.

## Review Fase 3 giro 1 (17/07)

**Diff: 6 file** (DashboardPage, WorkerCard, AnimatedCounter, KeyboardShortcutsHint, App,
index.css), ~130 righe nette, zero dipendenze nuove, zero logica di calcolo toccata.

**Verifica = misure DOM reali** sulla dashboard VERA montata in **modalità demo**
(`npm run dev:demo`, auto-auth con fixtures, zero credenziali) dentro iframe same-origin a
larghezza esatta (protocollo tranche 1), Chrome reale:

| Misura | 356 | 390 | 430 | 1276 |
| --- | --- | --- | --- | --- |
| Overflow documento (sw ≤ iw) | ✓ | ✓ | ✓ | ✓ |
| Striscia KPI scorre / chip visibili | ✓ / 5 | ✓ / 5 | ✓ / 5 | no scroll (=main) / 5 |
| Espandi dentro viewport | ✓ | ✓ | ✓ | ✓ |
| Header padding | 20px (p-5) | 20px | 20px | **28px = p-7 invariato** |
| Badge DEMO vs Island | 76>64 ✓ | ✓ | ✓ | top-3 (preesistente, solo demo) |
| Barra selezione (in viewport / righe) | — | ✓ / wrap, bottom 95px | — | ✓ / **1 riga, w=1002, bottom 23px** |
| Menu Dati in viewport | — | ✓ (fix) | — | ✓ allineato dx (=main) |
| Mask fade filtri | — | attiva | — | **none** |
| Modale statistiche | — | z-80 sopra AreaSwitch(60) ✓ | — | — |
| Card: tacca anno / sort / flip | — | — | — | **16px / 28px / opacity 0 = main** |

**P1 trovato e corretto MISURANDO (non a tavolino):** il primo tentativo di responsive
della barra selezione usava `flex-wrap` incondizionato → a 1276 la riga si spezzava
comunque (h 103 vs 60): un elemento `position:fixed` con `left:50%` in shrink-to-fit,
appena il wrap è permesso, riceve come larghezza disponibile solo la metà destra del
viewport (min-content < available < max-content). Fix: wrap gated a `max-[1060px]`
(riga intera misurata 1002px + margini 2rem). Conferme post-fix: 1276 = 1 riga (h 60),
1024 = wrap centrato in viewport, 390 = wrap sopra l'AreaSwitch.

**Limiti dichiarati (non bug):**
- Le verifiche `pointer-coarse:` sono provate nel CSS prodotto + demo, non su un vero
  touch (il Chrome desktop ha pointer fine): è il collaudo utente su telefono (item 8).
- Tacche YearTimeline: hit-area 44px in VERTICALE; in orizzontale restano fluide
  (~14-20px con range lunghi) — vincolo del design a striscia; l'apertura della pratica
  ha sempre i due CTA grandi come percorso principale.
- Viewer non misurabile in demo (demo = mai readonly): geometricamente coperto dal caso
  owner (più controlli, bottone più grande); gating verificato a codice.
- Banda 640–1060 con selection bar: wrap su 2-3 righe centrato (su main la riga unica
  usciva dal viewport già sotto ~1034: era rotto anche prima).
- Badge DEMO a desktop resta top-3 sotto l'Island (preesistente, solo build demo).

**Rollback:** revert dei 6 file; nessuna migrazione, nessun asset.

---

# Todo — Sessione 16/07: PWA mobile — tranche 1 "shell mobile sicura"

> **Contesto:** Fase 0 chiusa (valutazione GO CON MODIFICHE in
> [valutazione-fable-piano-mobile-2026-07-16.md](valutazione-fable-piano-mobile-2026-07-16.md));
> decisioni utente registrate nel piano §2: prima release = A+B con B solo **area Incidenza +
> modalità viewer** · **niente shell offline** (installabile + online-only, nessun SW con cache) ·
> utente mobile primario = **owner e viewer alla pari**.
>
> **STATO: TRANCHE 1 CHIUSA il 16/07/2026 su approvazione dell'utente.** GO tecnico Codex:
> gate verdi, owner/login a 390 px, menu/AI, disclosure WorkerCard e smoke desktop sulle tre aree.
> La prova con account viewer e dispositivo touch reali è accettata come collaudo utente e non è
> stata riprodotta direttamente da Codex. Nessun commit/deploy eseguito; prossima coda: tranche 1b.

## Piano (scope = valutazione, sezione "Prima tranche proposta")
- [x] 1. Utility condivise in `index.css`: `dvh`, `safe-area-inset-*`, helper touch (`pointer: coarse`)
      → verifica: classi presenti e usate solo nei file toccati dalla tranche.
- [x] 2. `DynamicIsland` viewport-bound: larghezze clampate a `min(<attuale>, 100vw − margine)`
      in TUTTI i mode (73-79 e 714) → verifica: mai più larga del viewport a 360/390/430 px,
      larghezze desktop invariate a 1280 px.
- [x] 3. `AreaSwitch`: target ≥44 px su touch senza cambiare la resa desktop; verifica che non
      copra contenuti in fondo pagina.
- [x] 4. `WorkerCard`: azioni oggi solo-hover sempre raggiungibili su coarse pointer
      (desktop hover identico a oggi).
- [x] 5. Passata di misura Login + Dashboard Incidenza a 390 px (inclusa modalità viewer):
      fix puntuali SOLO se emergono overflow → nessun fix necessario (vedi Review).
- [x] 6. Gate: `npx tsc --noEmit` · `npm test` · `npm run build` · diff review (dimostrare anche
      ciò che NON è cambiato). **Verifica visiva finale all'utente** (390 px + desktop + viewer +
      smoke Riposi/Indennità) → accettata e tranche chiusa il 16/07/2026.

## Review (16/07)

**Diff: 5 file, ~30 righe, zero dipendenze nuove, zero service worker, zero logica toccata.**

1. **`index.css`** — nuova sezione "MOBILE / TOUCH": 3 utility safe-area (`top-safe-6`,
   `bottom-safe-4`, `left-safe-4`). `dvh` e `pointer-coarse:` NON servivano come utility custom:
   Tailwind v4 (installata 4.2.4) li ha nativi — verificato nel CSS buildato
   (`min-height:100dvh` + blocco `@media(pointer:coarse)` con le 4 classi usate).
   `hooks/useIsMobile.ts` NON creato: nessun call site lo richiedeva (solo CSS) — meno codice.
2. **`DynamicIsland.tsx`** — (a) `maxWidth: calc(100vw − 24px)` nello style del motion.div:
   Framer anima `width` come property inline, il max-width CSS la clampa → vale per TUTTI i mode
   (ai 500, menu 420, ecc.) con una riga sola, niente touch alla tabella `getIslandWidth`;
   (b) container `top-6` → `top-safe-6` (= `max(1.5rem, safe-area-top)`).
3. **`AreaSwitch.tsx`** — bottone Home `pointer-coarse:w-11/h-11`, bottoni area
   `pointer-coarse:min-h-11` (36→44 px solo su touch); container `bottom-safe-4 left-safe-4`.
4. **`WorkerCard.tsx`** — `pointer-coarse:opacity-60` sui 2 tasti solo-hover (Ruota card + menu
   •••); il retro della card ha già il tasto ritorno sempre visibile. Erano le UNICHE azioni
   hover-gated della card (grep `opacity-0`/`group-hover` completo: il resto è decorativo).
5. **`LoginPage.tsx`** — `min-h-screen` → `min-h-dvh` (unico file della tranche con h-screen).

**Desktop: nessuna regressione osservata/misurata** (criterio "dimostrare ciò che NON è
cambiato"; l'argomento per costruzione regge finché il viewport resta senza
`viewport-fit=cover` — vedi rifiniture giro 2 per gli inset laterali):
`env(safe-area-inset-*)` = 0 senza viewport-fit=cover → `top/bottom/left` identici al px;
`max(1.5rem, 0)` = `top-6`; il clamp dell'Island a ≥1280 px non morde (soglia ~524 px);
`@media(pointer:coarse)` non matcha mouse/trackpad; `100dvh` = `100vh` su desktop.
Hover della card e larghezze Island desktop: intoccati nel diff. Confermato poi dalle
misure DOM a 1276 px (giro Codex): shell 420, gruppo su una riga, groupW 369 come su main.

**Passata di misura (punto 5):** baseline già misurata senza overflow globale a 390 px
(Login/Mobile Upload in Fase 0; Dashboard con riga filtri a scorrimento il 14/07); la tranche
non introduce NUOVE larghezze fisse (diff review) → nessun fix aggiuntivo necessario.
La conferma visiva su viewport reali spetta all'utente (`feedback-verifica-video-utente`).

**Gate:** tsc 0 errori · **344/344 test** · build ok (solo warning chunk-size preesistente) ·
`git diff --check` pulito · chunk `MobileUploadPage-*.js` separato ancora presente (code-split ok).

**Rischi residui e rollback:** il rischio "contenuto dei mode larghi compresso/tagliato dal
clamp" segnalato qui in origine è stato RISOLTO nel giro Codex 1 (wrap del menu sotto 444 px,
misurato 0/9 bottoni tagliati); il mode `ai` resta da rifinire esteticamente in Fase 3 ma il
suo input è fluido. Rollback = revert dei 5 file (nessuna migrazione, nessun asset).
Non ancora provato su iPhone/Android reali: è il collaudo utente previsto dal piano.

**Checklist collaudo utente (da telefono o DevTools responsive):**
- [x] 390 px: Dashboard Incidenza senza scroll orizzontale; Island menu/AI entro viewport;
      visibilità e target touch di Ruota/••• verificati nel CSS prodotto e accettati dall'utente.
- [x] 390 px: login centrato e senza overflow (`dvh`); prova Safari/tastiera accettata dall'utente.
- [x] 390 px viewer: chiusura accettata dall'utente; geometria coperta dal caso owner peggiore,
      senza riprodurre direttamente la sessione dell'account Vincenzo.
- [x] Desktop 1280+: nessuna regressione osservata/misurata su Island, card e AreaSwitch.
- [x] Smoke desktop Riposi + Indennità completato.

## Review Codex giro 1 → 2 P1 + 1 P2, CORRETTI (16/07 sera)

**Finding Codex (su gate verdi):** P1-A AreaSwitch ≈406 px a 390 (ultima area fuori viewport);
P1-B il maxWidth conteneva il guscio ma il menu owner (~415 px) veniva tagliato da
`overflow:hidden`; P2 target Ruota/••• sotto 44 px su touch + accessibilità.

**Correzioni:**
1. **AreaSwitch compatta** — sotto `sm` (640 px) l'etichetta resta SOLO sull'area attiva
   (`max-sm:hidden` sulle inattive, `aria-label` sempre presente); in più guardia dura
   `max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar` + `shrink-0` sui bottoni
   → right ≤ viewport garantito a qualsiasi larghezza/zoom.
2. **Menu Island responsive** — `max-[444px]:flex-wrap` sulla riga bottoni: wrappa SOLO quando
   il clamp morde (100vw−24 < 420 ⇔ viewport < 444). Il wrap incondizionato del primo tentativo
   avrebbe spezzato la riga ANCHE a 420 px desktop (il contenuto chiede 369 px vs ~365
   disponibili, oggi clippati invisibilmente): scoperto misurando, non a tavolino.
3. **P2** — Ruota/•••: `pointer-coarse:p-[13px]` (13+18+13 = 44 px esatti su touch),
   `focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 ring-teal-500/50`
   (idioma del progetto), `aria-label`; sul menu ••• anche `aria-haspopup` + `aria-expanded`.

**Misure reali (harness temporaneo con i componenti VERI in iframe a larghezza esatta,
Chrome; owner = caso peggiore: Home presente, label più lunga attiva, menu 8+1 bottoni):**

| innerWidth | AreaSwitch owner (right) | viewer (right) | Island menu shell | bottoni tagliati |
| --- | --- | --- | --- | --- |
| 356 | 326 ✓ | 284 ✓ | 333, dentro ✓ | 0/9, 2 righe ✓ |
| 386 | 326 ✓ | 284 ✓ | 363, dentro ✓ | 0/9, 2 righe ✓ |
| 426 | 326 ✓ | 284 ✓ | 403, dentro ✓ | 0/9, 2 righe ✓ |
| 1276 (desktop) | 474, label complete ✓ | — | **420 = attuale**, gruppo su UNA riga (top identici, `nowrap`), groupW 369 = main ✓ | 0/9 ✓ |

`docScrollWidth = innerWidth` in tutti i casi (zero overflow di pagina). Menu viewer non
misurabile senza le credenziali di Vincenzo, ma è un SOTTOINSIEME stretto dell'owner
(3 bottoni in meno, niente Home nella pillola) → coperto a fortiori dal caso peggiore.
Nota harness: Chrome headless ignorava --window-size (min ~500 px) → iframe same-origin a
larghezza esatta dentro il Chrome reale; harness eliminato dopo l'uso (zero residui nel repo).

**Gate post-fix:** tsc 0 · **344/344 test** · build ok · classi verificate nel CSS prodotto
(`max-\[444px]`, `max-sm`, `padding:13px`, focus-visible, max-width guard).
**Resta:** collaudo visivo utente (checklist sopra, invariata) + eventuale re-check Codex.
Niente commit/deploy (coda deploy-unico confermata).

## Rifiniture giro 2 (follow-up Codex non bloccanti, 16/07 — P1 confermati risolti)

Review Codex 2: P1 risolti, gate e misure confermati; via libera al collaudo utente con tre
rifiniture pre-commit, tutte applicate:

1. **Inset laterali nei clamp** — `calc(100vw − margine)` non considerava
   `safe-area-inset-left/right`: innocuo oggi (senza `viewport-fit=cover` valgono 0), sarebbe
   diventato un buco se la tranche 1b abilitasse edge-to-edge. Ora: utility
   `max-w-safe-viewport` in `index.css` (usata da AreaSwitch) e stessa sottrazione nel
   `maxWidth` dell'Island. Comportamento odierno invariato per costruzione (env = 0).
2. **WorkerCard = disclosure, non finto menu ARIA** — rimosso `aria-haspopup="menu"` (il
   popup non implementa ruoli/tastiera del pattern menu); pattern disclosure corretto:
   `aria-expanded` + `aria-controls` → `id` sul pannello (`worker-actions-<id>`), referenziato
   solo quando il pannello è montato.
3. **Riepilogo ridimensionato** (questo file): il claim "desktop invariato per costruzione /
   pixel-identico" è stato riformulato in "nessuna regressione osservata/misurata" con il
   perimetro esplicito dell'argomento (valido senza viewport-fit=cover); eliminato il rischio
   residuo "menu compresso", risolto dal wrap.

**Gate giro 2:** tsc 0 · **344/344 test** · build ok, rilanciati anche da Codex dopo le rifiniture.
**Chiusura:** nessun altro blocco Codex; tranche 1 chiusa dall'utente il 16/07/2026.

---

# Todo — Sessione 14/07: restyling desktop Archivio Buste Paga

> **Scope approvato:** restyling completo della pagina Archivio per uso esclusivamente desktop.
> Conservare tutti i controlli e i flussi esistenti; nessun investimento specifico sulla resa mobile.

## Piano
- [x] 1. Trasformare il corpo a tre colonne in un unico workspace documentale arrotondato, mantenendo
      larghezze, scroll interni e `h-screen` funzionali.
- [x] 2. Introdurre intestazioni “Lavoratori / Periodi / Documento” e migliorare gerarchia di ricerca,
      gruppi azienda e stati vuoti senza rinominare o rimuovere comandi.
- [x] 3. Aggiungere una legenda persistente dei quattro stati mese e rendere il drag&drop visibile
      prima dell'interazione.
- [x] 4. Coerentemente con “Sola consultazione”, impedire che il viewer apra il flusso upload tramite
      drag&drop e non mostrare l'affordance di caricamento.
- [x] 5. Verificare selezione gruppo/lavoratore/anno/mese, viewer PDF, upload, light/dark e gate completi.
- [x] 6. Documentare diff, prove e risultato.

## Review (14/07)

- La pagina è ora un workspace documentale unico, arrotondato e scandito in tre aree numerate:
  **Lavoratori**, **Periodi** e **Documento**. Le larghezze operative e gli scroll interni sono rimasti
  invariati, con spazio inferiore riservato alla navigazione globale.
- Il titolo include il logo FAST-CONFSAL; la top bar, il fondo ambientale e le superfici delle colonne
  costruiscono una gerarchia visiva riconoscibile senza appesantire la consultazione.
- Aggiunta la legenda persistente dei quattro stati mensili (PDF presente, solo dati, mancante, da
  sistemare) e resa esplicita la possibilità di trascinare uno o più PDF.
- Il drag&drop e la modale upload non sono più disponibili in sola lettura. Inoltre `addPayslip`
  restituisce l'esito reale: in caso di errore la modale resta aperta, mostra il problema e consente
  di riprovare, eliminando il precedente falso feedback positivo.
- QA browser desktop: verificati ricerca, apertura azienda, selezione lavoratore, toggle anno e resa
  populated/empty in light e dark mode. Tutti i comandi preesistenti sono conservati.
- Gate finali: `npx tsc --noEmit` superato, **339/339 test** passati, build produzione riuscita
  (solo warning chunk-size preesistente), `git diff --check` pulito.

---

# Todo — Sessione 14/07: logo FAST-CONFSAL nell'Archivio Buste Paga + audit visivo

> **Richiesta:** aggiungere il logo FAST-CONFSAL accanto al titolo “Archivio Buste Paga”; valutare
> poi un eventuale restyling della pagina, oggi percepita come anonima, senza applicarlo finché non
> viene approvato.

## Piano
- [x] 1. Inserire il logo ufficiale nudo nel gruppo titolo della top bar, colorato in light e bianco
      in dark, mantenendo l'icona Archivio come identificatore funzionale.
- [x] 2. Proteggere il layout mobile della top bar senza modificare i controlli o la struttura a tre
      colonne dell'archivio.
- [x] 3. Verificare desktop/mobile, typecheck, test e build.
- [x] 4. Inventariare i controlli reali e preparare una proposta di restyling prioritizzata, separata
      dalla modifica approvata.
- [x] 5. Documentare implementazione, prove e raccomandazioni.

## Review (14/07)

- Aggiunto il logo ufficiale subito dopo “Archivio Buste Paga”, accanto all'icona funzionale
  Archivio: nudo, 44 px visivi su desktop, colori originali in light e bianco in dark.
- La top bar desktop resta compatta (73 px). Sotto 640 px il testo del pulsante Dashboard e il
  contatore lavoratori vengono nascosti; un padding superiore dedicato evita la sovrapposizione
  con la Dynamic Island.
- Verifica browser a 1280, 390 e 320 px: titolo completo, logo visibile, zero overflow pagina;
  nessuna modifica al workspace a tre colonne o ai suoi controlli.
- Controlli reali inventariati per il futuro restyling: ricerca/clear, cassetti azienda e lavoratore,
  anni e 12 mesi con quattro stati, PDF precedente/successivo, download condizionale, drag&drop
  multiplo e relativa modale.
- Direzione raccomandata, non implementata: workspace documentale più riconoscibile con micro-header
  delle tre colonne, legenda mesi, upload più scopribile e master-detail responsive.
- Gate finali: `npx tsc --noEmit` superato, **339/339 test** passati, build produzione riuscita
  (solo warning chunk-size preesistente), `git diff --check` pulito.

---

# Todo — Sessione 14/07: filtri azienda Incidenza su una sola riga

> **Richiesta:** disporre tutte le pillole azienda sotto la ricerca sulla stessa riga per recuperare
> spazio verticale. La ricerca e tutti gli altri controlli restano invariati.

## Piano
- [x] 1. Lasciare la ricerca nell'attuale `max-w-4xl`, dando alla sola riga filtri tutta la larghezza
      disponibile della dashboard.
- [x] 2. Rendere le pillole `nowrap` e non comprimibili; sui viewport stretti usare scroll orizzontale
      senza scrollbar invece di tornare su una seconda riga.
- [x] 3. Verificare allineamento, loghi non tagliati e assenza di overflow pagina su desktop/mobile.
- [x] 4. Eseguire typecheck, test, build e documentare l'esito.

## Review (14/07)

- La capsula di ricerca mantiene l'attuale `max-w-4xl`; solo il contenitore dei filtri usa tutta la
  larghezza disponibile di Incidenza.
- Le 8 pillole sono ora in un flex `nowrap`, `shrink-0`, con padding orizzontale leggermente ridotto
  (`px-5`) per farle entrare tutte anche a 1280 px senza ridurre loghi o altezza.
- Verifica browser a 1280 px: 8/8 filtri sulla stessa riga, `scrollWidth = clientWidth = 1217`, ultima
  pillola entro il viewport e zero overflow pagina.
- A 390 px la riga resta alta 44 px e non va a capo; il contenitore scorre orizzontalmente
  (`327 px` visibili su `1201 px`), sempre con zero overflow del documento.
- Gate finali: `npx tsc --noEmit` superato, **339/339 test** passati, build produzione riuscita
  (solo warning chunk-size preesistente), `git diff --check` pulito.

---

# Todo — Sessione 14/07: fascia organizzativa speculare nelle tre aree

> **Scope confermato dall'utente:** implementare per ora soltanto la fascia superiore del mockup
> con “Ufficio Vertenze”, logo FAST-CONFSAL e “Segreteria Regionale Puglia e Basilicata”. La fascia
> deve essere identica in Incidenza, Turni & Riposi e Indennità; tutto il resto resta invariato.

## Piano
- [x] 1. Convertire `SindacatoTag` in una fascia istituzionale a tutta larghezza, mantenendo logo
      ufficiale trasparente, colori originali in light e silhouette bianca in dark.
- [x] 2. Montare la fascia con lo stesso contenitore nelle tre aree, senza cambiare hero, KPI,
      filtri, card o navigazione.
- [x] 3. Verificare desktop/mobile, assenza di overflow e parità strutturale tra le tre sezioni.
- [x] 4. Eseguire typecheck, test, build e documentare il risultato.

## Review (14/07)

- `SindacatoTag` è ora una fascia unica a tre colonne su desktop e due righe su mobile: Ufficio a
  sinistra, logo ufficiale centrato, Segreteria a destra. Gradiente tenue pesca→bianco→azzurro,
  raggio 36 px mobile / 44 px desktop, senza bordo, ombra o badge aggiuntivi.
- Il logo conserva il box di layout precedente ma viene scalato visivamente: a 1280 px misura circa
  120×120 dentro una fascia alta 144 px, quindi è più presente senza aumentare l'altezza della barra.
- Incidenza, Turni & Riposi e Indennità misurano tutte: fascia `x=24, y=80, w=1217, h=144`, logo
  `x=572, y=92, w=120, h=120`, hero a `y=248`; un solo blocco istituzionale per area e zero overflow.
- Responsive verificato a 390 e 320 px: logo centrato sulla prima riga, testi sulla seconda, nessun
  taglio orizzontale; il filtro dark del logo resta `brightness-0 invert`.
- Scope rispettato: nessuna modifica a hero, KPI, filtri, card o navigazione; nelle due aree più
  strette è stata estratta soltanto la fascia nel wrapper comune `max-w-screen-2xl`.
- Gate finali: `npx tsc --noEmit` superato, **339/339 test** passati, build produzione riuscita
  (solo warning chunk-size preesistente), `git diff --check` pulito.

---

# Todo — Sessione 14/07: FAST-CONFSAL — colori pieni e co-brand più autorevole

> **Correzione utente:** il logo trasparente appare leggermente desaturato; nelle testate di
> Incidenza, Turni & Riposi e Indennità deve essere più grande. Anche “Ufficio Vertenze” e
> “Segreteria Regionale Puglia e Basilicata” vanno rese più curate e adeguate al ruolo istituzionale.

## Piano
- [x] 1. Misurare l'alpha e i colori del PNG attuale contro il JPG ufficiale; ricostruire un asset
      trasparente con interni realmente opachi, senza alterare geometria o colori originali.
- [x] 2. Ridisegnare `SindacatoTag` come piccolo blocco istituzionale: logo più grande, gerarchia
      tipografica leggibile e allineamento equilibrato, senza badge/pastiglie.
- [x] 3. Verificare il blocco nelle tre aree, in light/dark e a viewport desktop/compatto; controllare
      che il nuovo ingombro non interferisca con Dynamic Island o header.
- [x] 4. Eseguire test/build, review del diff e documentare prove e risultato.

## Review (14/07)

- Root cause colore: il viola del PNG era RGB-identico al JPG ufficiale (mediana `49,44,128`),
  ma l'interno restava a circa alpha 210/255. Rimappato l'alpha: **22.715 pixel interni opachi**
  (prima 197), semitrasparenza conservata solo sui bordi. Asset finale 512×511 RGBA, 66 KB.
- La prova built-in `imagegen` su chroma key è stata scartata perché alterava leggermente forma e
  riempimento del lettering; la correzione finale agisce solo sull'alpha dell'asset fedele.
- `SindacatoTag`: logo 96 px da `sm` (80 px mobile), separatore verticale leggero, “Ufficio” e
  “Segreteria Regionale” come sovratitoli, “Vertenze” e “Puglia e Basilicata” in evidenza.
- Verifica browser: Incidenza, Turni & Riposi e Indennità montano un solo logo; light `filter:none`,
  dark `brightness(0) invert(1)`. Viewport 1280, 768 e 390 px: nessun overflow orizzontale;
  su mobile blocco 254 px entro i 390 px e padding superiore anticollisione con Dynamic Island.
- Gate: **339/339 test** passati; build produzione riuscita (solo warning chunk-size preesistente);
  `git diff --check` incluso nella review finale.
- Follow-up modale lavoratore: logo FAST-CONFSAL portato da 64 px a 96 px su desktop (80 px su
  viewport stretti), coerente con la nuova scala delle testate e senza cambiare il layout del titolo.

---

# Todo — Sessione 14/07: logo FAST-CONFSAL trasparente e adattivo al tema

> **Richiesta:** sostituire il logo FAST-CONFSAL attuale con il file ufficiale indicato
> dall'utente, rimuovere il fondo bianco/grigio incorporato e uniformarlo ai loghi aziendali:
> colori originali in light mode, silhouette bianca in dark mode, senza badge o pastiglie.

## Piano
- [x] 1. Preparare dal JPG ufficiale un PNG con alpha reale, preservando esattamente simbolo,
      scritte, stelle e tricolore; verificare trasparenza, bordi e assenza di alone chiaro.
- [x] 2. Applicare il filtro tema (`dark:brightness-0 dark:invert`) in tutti i punti che mostrano
      FAST-CONFSAL, mantenendo dimensioni e layout esistenti.
- [x] 3. Verificare asset e UI con controlli automatici, test/build e ispezione visiva light/dark.
- [x] 4. Documentare esito e prove nella Review di questa sezione.

## Review (14/07)

- Sostituito `public/logos/fast-confsal.png` col logo ufficiale fornito dall'utente: PNG RGBA
  512×511, 82 KB, fondo bianco/grigio rimosso e geometria originale preservata. La prova
  generativa chroma-key della skill `imagegen` non è stata adottata perché introduceva minime
  variazioni nel lettering/colore; usato l'helper ufficiale di estrazione alpha direttamente sul
  JPG sorgente, quindi ridimensionamento ottimizzato per l'uso UI.
- Filtro tema applicato ai 5 render effettivi: tag in alto nelle aree, modale lavoratore e tre
  varianti della dashboard sindacati. Rimossi anche i tre workaround `dark:bg-white`/aloni della
  vecchia immagine: nessuna pastiglia residua. Light = colori originali; dark = silhouette bianca.
- Verifica browser locale finale sulla dashboard: asset 512×511 caricato, nessun antenato con
  fondo bianco, light `filter: none`, dark `filter: brightness(0) invert(1)`; controllo precedente
  dello stesso filtro superato anche nel tag in alto dell'area Incidenza.
- Gate finali: **339/339 test** passati; `npm run build` riuscita (solo warning chunk-size già
  esistente); controllo visivo dell'asset finale dopo downscale, alpha confermato da `sips`.

---

# Todo — Sessione 14/07: ELIOR VIAGGIANTE — controllo via incrocio col censimento Vision

> **Contesto (verificato dal vivo oggi):** le voci fisse SONO inserite (griglia `anni` dei 10
> viaggiante, 4301 mese-per-mese con valori veri, es. Boriglione 190,43 / 226,35 / 146,73) ma
> provengono da un OCR **v1 mai verificato aritmeticamente**: nessuna delle 10 pratiche ha una
> nota `⚠️ OCR`, le 668 buste caricate il 13/07 hanno `extracted_data` VUOTO e zero `ocrChecks`,
> e il codice dei controlli (validatore + terne v2) è **23 commit avanti a `origin/main`** → NON
> in produzione. Non si può retro-eseguire il validatore sul DB (mancano le terne). Scelta utente:
> **strada rapida = incrociare la griglia col censimento Vision già fatto** (zero deploy, zero costi).

**Fatti verificati (14/07):**
- Dataset censimento: `.../ELIOR VIAGGIANTE/censimento-vision-buste-2026-07-13.json` = **676 record**,
  ognuno con `worker`, `year`, `month` (num), `rows[{code,competenze,...}]`, `totComp`, `ggInps`,
  `reconDelta` (0.0 = busta riconciliata al centesimo, 416/676).
- Griglia `anni` in `worker_profiles` (jsonb): il 4301 è un importo €/mese (= ore × €1,00).
- Il 4301 è **la voce della vertenza** → è il fulcro del confronto.

## Piano (ESEGUITO 14/07) — SOLO letture + 1 correzione verificata su PDF
- [x] 1-4. Incrocio griglia↔censimento (436 buste riconciliate) sulla voce 4301, al centesimo,
      via join in SQL (censimento iniettato come VALUES, griglia dal DB). Script in scratchpad.
- [x] 5-6. Report → [tasks/controllo-vision-elior-viaggiante-2026-07-14.md](controllo-vision-elior-viaggiante-2026-07-14.md).

### Review (14/07)
- **Risultato:** su 401 buste confrontabili → **248 CONCORDI** (doppia lettura Gemini+Vision al
  centesimo = confermate), 153 divergenti, +261 non confrontabili (censimento non riconciliato),
  +3 solo-censimento. % conferma sul confrontabile = 62%.
- **Il censimento NON è una fonte per correggere:** il suo `reconOk` garantisce Σ=totale, non la
  corretta attribuzione per-voce; su scansioni ruotate Vision aggancia la riga sbagliata. Prova:
  Cautilli Ott 2023 (griglia 194,05 = verità Gemini verificata; censimento 16,80 = errato). Copiarlo
  avrebbe distrutto ~150 valori buoni. → NON fatto (coerente con `ocr-ambiguity-flag-policy`).
- **Subagente pilota (batch_01, 15 buste Boriglione, lettura alla cieca):** coincide con la griglia
  in 11/15; 4 discordanze = errori v1 REALI (verificati poi da me sui PDF). Scoperta classe d'errore:
  la griglia a volte ha salvato la voce **4285** (73,56 = paga base/26) al posto della 4301.
- **5 correzioni applicate (tutte verificate su PDF, terna quadrata, RETURNING ok):**
  Schingaro Mag2024 277,71→121,08 · Boriglione Ago2020 assente→271,18 · Dic2021 190,43→150,43 ·
  Gen2022 73,56→190,88 · Lug2022 73,56→155,70. ⚠️ hard-refresh app prima di riaprire Boriglione/Schingaro.
- **Scelta utente sul grosso:** NON sweep coi subagenti (~1,3M token) ma **ri-scansione v2 in LOCALE**
  (`netlify dev`, no deploy prod) sulle ~368 buste non confermate → validatore terne automatico.
- **Artefatti:** manifest 416 buste + 26 batch + pilota in scratchpad (`master.csv`, `batches/`,
  `results/batch_01.json`), riutilizzabili se si vuole comunque un secondo occhio coi subagenti.

**Garanzie:** il censimento è un *secondo occhio*, non la verità assoluta (Vision su scansioni deboli
riconcilia solo 416/676); dove diverge NON si corregge — si segnala per la revisione dell'avvocato
(policy `ocr-ambiguity-flag-policy` + `ruolo-prepariamo-avvocato-decide`). Output lungo → su file.

---

# Todo — Sessione 13/07: ELIOR VIAGGIANTE — carico + scansione con controlli OCR cartacee

> **Richiesta:** caricare le 676 buste splittate (Desktop) nell'archivio e scansionarle con TUTTE
> le voci (4300/4305 + fisse) applicando il **piano controlli OCR cartacee ratificato l'11/07**
> (terne qty×tariffa×importo + validatore client deterministico + verify AI + campione umano).
> Sblocca l'area Indennità (vertenza assenza residenza, ricorso Celentano Trib. Lecce).

**Fatti verificati (13/07):**
- 676 PDF al loro posto in `<LAVORATORE>/buste paga/<ANNO>/<Mese ANNO>.pdf` (conteggio `find` = 676).
- Busta reale (Boriglione Mar 2021) CONFERMA l'applicabilità del piano: la tabella voci ha le terne
  `VALORE UNITARIO × ORE/GG/MESI = COMPETENZE` per riga, e il cedolino stampa **TOTALE COMPETENZE**
  (Σ voci = 2.360,67 quadrata al centesimo a mano), TOTALE TRATTENUTE e NETTO → il `reconOk` del
  parser è trasponibile all'OCR.
- ⚠️ In quella busta NON ci sono 4300/4305 ma c'è **4301 FUORI SEDE ITA TURNI RFR a €1,00 × 151,43h**:
  la mappa voci reale del viaggiante va CENSITA prima di fissare prompt e tabella tariffe (non fidarsi
  della lista codici del prompt attuale — lezione 20/05: mai scrivere un prompt OCR senza i documenti).
- Nota in calce al cedolino: «gli elementi variabili sono riferiti al mese precedente» → rilevante per
  la mappatura competenza/cassa della vertenza (da riportare in knowledge, non tocca l'estrazione).
- Prompt Elior attuale (`getEliorPrompt`): estrae solo importi Competenze, nessuna terna, nessun
  totale di controllo. `verify-payslip.ts` ha già il ramo ELIOR (da tenere in coppia col prompt).

## Piano (approvato 13/07: merge anni SÌ · tutte le 676 · consenso solo su flaggate)
- [x] 0. Verifiche preliminari FATTE: i 10 viaggiante avevano `elior_type=NULL` → **UPDATE a
      'viaggiante'** (RETURNING verificato; senza fix l'area Indennità non trovava pratiche);
      colonne griglia e prompt cadevano già sul ramo giusto per fortuna (`null !== 'magazzino'`).
      41 buste sparse già in archivio (Pierro 10, Gregorio/Nitti/Paglionico 8…) → attenzione
      doppioni al carico.
- [x] 1. **Censimento FATTO su TUTTE le 676 buste** (non solo campione): Vision locale, 416/676
      riconciliate al centesimo, 186 codici censiti → report in
      [tasks/censimento-elior-viaggiante-2026-07-13.md](censimento-elior-viaggiante-2026-07-13.md),
      dataset consenso accanto alle buste sul Desktop. **🔴 FINDING: 4300/4305 NON ESISTONO nelle
      buste; la voce della vertenza è la 4301 «FUORI SEDE ITA TURNI RFR» a €1,00/h COSTANTE fino
      a Dic 2025** (contraddice «da ago 2023 misura piena» del ricorso) → quesito per l'avvocato;
      knowledge aggiornata.
- [x] 2. **Prompt v2 FATTO** (`getEliorPrompt`): sezione 3-bis terne (trascrizione integrale voci)
      + 3-ter totali di controllo (ggInps, totaleRetribuzione, totaleCompetenze, totaleTrattenute,
      netto) + codici mancanti dal censimento (1129, 4053, 4340, 0214); `codes` invariato.
      Fix robustezza: il modello troncava il JSON con `voci` in coda → ordine chiavi nell'esempio
      + riparazione graffe in `cleanAndParseJSON` + merge multi-pagina voci/totali in `mergeBlocks`
      (cedolini a 2 fogli). Verifica: **prova end-to-end 5/5 buste perfette** (terne tutte ok,
      recon Δ=0,00; incluse scansione storta e cedolino 2 fogli).
- [x] 3. **Validatore FATTO**: `utils/eliorScanValidator.ts` (7 famiglie di controlli, tabella
      tariffe dal censimento) + 13 test (`__tests__/eliorScanValidator.test.ts`) sul caso reale
      pilota + errori sintetici. Solo FLAG, mai correzione.
- [x] 4. **verify-payslip** ramo ELIOR aggiornato in coppia (struttura colonne esatta,
      anti-scivolamento, avviso skew, terna come autodiagnosi).
- [x] 5. Wiring FATTO in `usePayslipUpload` (batch/single/folder): `aiResult.ocrChecks` persistito
      con l'archivio, nota `[⚠️ OCR: …]` sul mese, sezione dedicata nel riepilogo batch.
      Gate: tsc 0 · **338/338 test** · build ok.
- [~] 6. Caricamento 676 in archivio — **giro 2 (13/07 pomeriggio), decisioni utente:**
      Supabase ora è PRO (100 GB, pagato da Vincenzo) · carica l'UTENTE dall'app · annuncio
      a Vincenzo CON il finding 4301.
      - [x] 6a. Compressione 676 → 150 DPI grigio q68 (qualità OCR verificata: recon Vision
            Δ=0,00 su 3/3; a 120 DPI degrada → scartato). Motivo: limite payload ~6 MB delle
            Netlify Functions (le buste 5-10 MB fallirebbero la scansione) + egress 10×.
            Output: `ELIOR VIAGGIANTE/_archivio-150dpi/<LAV>/` (flat per lavoratore, 1 selezione
            per lavoratore col picker). Originali INTATTI sul Desktop.
      - [x] 6b. Fix dedup archivio nel batch scan (`WorkerDetailPage` onArchive: skip mesi già
            archiviati — l'insert non è idempotente, evita righe doppie alla riscansione v2).
      - [x] 6c. Fix priorità periodo in `deriveFixedVociPeriod`: nome file con mese+anno COMPLETO
            vince sull'AI (politica batch/audit; i nomi sono verificati 676/676); AI resta per i
            nomi non-standard. Test aggiornati (22/22).
      - [x] 6d. **Annuncio in bacheca a Vincenzo PUBBLICATO** (id dd132b91: buste organizzate,
            controlli qualità, finding 4301, buco nov2017–gen2020, prossimi passi).
      - [ ] 6e. UTENTE: carico dall'app per i 10 lavoratori (tab Archivio → «Carica buste → solo
            voci fisse» → selezionare tutti i PDF di `_archivio-150dpi/<LAVORATORE>/`) — archivia
            con dedup + estrae voce 1000 (Function fixed-voci GIÀ live, non serve deploy).
      - [ ] 6f. Commit + push (=deploy Netlify) DOPO il carico (ordine chiesto dall'utente).
      - [ ] 6g. Scansione batch v2 con controlli (post-deploy) + report validatore.
- [ ] 7. Doppia scansione mirata sulle flaggate + **campione umano al centesimo**
      (1 busta/lavoratore + tutte le flaggate) documentato in tasks/.
- [ ] 8. Review + memoria + roadmap vault + promemoria a Vincenzo del buco nov2017–gen2020.

**Decisioni prese (13/07):** merge `anni` SÌ (riscrittura voluta) · perimetro = tutte le 676 ·
consenso doppia scansione solo sulle flaggate.
**Decisioni ancora aperte:**
- (d) **Colonna 1129 in griglia?** Il prompt v2 ora la estrae (il gestionale la estraeva: 588
  righe) ma senza colonna non entra nei totali ferie; aggiungerla muove i totali di TUTTE le
  pratiche ferie viaggiante → decidere con l'avvocato (set voci Elior).
- (e) **Quando deployare** scan-payslip v2 (serve per il carico; c'è la coda deploy-unico).
- (f) Quesito avvocato: qualificazione 4301 (misura «con riposo»?) e periodo del credito
  (fino a Dic 2025, non lug 2023, se la tariffa resta 1,00).

---

# Todo — Sessione 12/07 sera: split buste ELIOR VIAGGIANTE (10 lavoratori) per mese/anno

> **Richiesta:** organizzare le buste della cartella Desktop `…/ELIOR/ELIOR VIAGGIANTE` come già
> fatto per ELIOR MAGAZZINO (Ghiro/Mastropasqua, 13/06): split dei PDF scansionati multi-pagina
> in un PDF per mese, cartelle per anno, **tredicesime SCARTATE** (e 14e, stessa logica).
> Questo sblocca poi caricamento+scansione nell'app (sessione Elior fissata, area Indennità).

**Materiale censito:** 10 lavoratori (Boriglione, Cautilli, De Biasio, Gregorio, Martinelli,
Montanaro, Nitti, Paglionico, Pierro, Schingaro), 25 PDF scansionati in `<NOME> BUSTE PAGA/`,
**935 pagine totali (~2 GB)**, 1 pagina = 1 cedolino (layout Elior identico al magazzino,
box PERIODO DI PAGA in basso). Il corpus arriva almeno a metà 2024 (Pierro 1 = Gen–Giu 2024+).
Ogni lavoratore ha già `buste paga/` (vuota, tranne Boriglione: 20 JPG fotografati) e
`conteggi/` del perito (NON si tocca).

**Metodo (= magazzino + Clarino, con OCR automatizzato):**
- Lettura periodo di OGNI pagina (lezione 13/06: mai inferire dalla sequenza): fascia bassa
  relativa [0.78, 0.995] renderizzata a 150 DPI e letta con **OCR macOS Vision** (pyobjc,
  pilota su Pierro 1 pp.1-8: 8/8 leggibili, doppione Aprile già intercettato).
- Classificazione per pagina → manifest: `main` / `tred` (TREDICESIMA/13.MA/14.MA → SCARTATO) /
  `dup` (stesso mese ripetuto, scarto il doppione dopo confronto visivo) / `suppl` (secondo
  cedolino DIVERSO dello stesso mese → unito al main) / pagina bianca (retro).
- Pagine senza periodo riconosciuto → render pagina intera → **verifica visiva mia** (no guess,
  cfr. `ocr-ambiguity-flag-policy`).
- Split **lossless** con `pdfseparate`+`pdfunite` (zero ricompressione) in scratchpad, poi copia
  in `<LAVORATORE>/buste paga/<ANNO>/<Mese> <ANNO>.pdf` + `manifest.csv` (formato magazzino).

## Piano
- [x] 1. Script OCR batch su tutti i 25 PDF → manifest grezzo per pagina
      → verifica: 935/935 pagine classificate (866 main, 61 tred, 6 ambigue, 2 blank; 0 discrepanze
      col conteggio pdfinfo). OCR = Vision macOS, 3 processi paralleli, render solo-fascia.
- [x] 2. Revisione a vista FATTA: 8 ambigue/blank risolte (5 identificate, 2 bianche vere, 1 retro
      in trasparenza); **scoperta chiave: i "mesi doppi" sono quasi tutti CEDOLINI SU 2 FOGLI**
      (foglio voci + foglio totali, stesso timestamp di stampa al secondo) → UNITI, non scartati.
      164 continuazioni (campione 8/8 ok) + 11 dup veri (11/11 verificati, stesso netto) + 6 gruppi
      da 4 = cedolino 2-fogli scansionato 2 volte (tengo una coppia) + 1 continuazione Nitti.
- [x] 3. Manifest finale: 935 righe = 676 buste (main) + 172 fogli-voci uniti (suppl) +
      61 tredicesime + 23 dup + 3 blank SCARTATI.
- [x] 4. Split lossless (pdfseparate 1-passata/sorgente + pdfunite) → 676 PDF in scratchpad
      (Boriglione 70, Cautilli 70, De Biasio 71, Gregorio 64, Martinelli 71, Montanaro 71,
      Nitti 64, Paglionico 63, Pierro 61, Schingaro 71)
- [x] 5. **Verifica post-split doppia FATTA**: (a) OCR automatico su TUTTE le 848 pagine dei
      676 file → 6 flake OCR (mese non letto a 120 DPI), tutti risolti a vista = corretti;
      (b) 30 griglie visive lette una per una → **676/676 periodo = nome file** ✓
- [x] 6. Copia su Desktop FATTA (13/07 notte): 676 PDF + 10 manifest.csv in
      `<LAVORATORE>/buste paga/<ANNO>/`; `diff -rq` contro split_out = copie identiche;
      Boriglione `_jpg originali/` (21 JPG) preservata; spazio finale in "SCHINGARO … " gestito.
- [x] 7. Review finale + aggiornamento memoria/roadmap

## Review (13/07 notte)

**Risultato:** 935 pagine → **676 buste mensili** (Feb 2020 → Dic 2025 per tutti), scartate
61 tredicesime + 23 dup + 3 blank; 172 fogli-voci uniti al proprio foglio-totali (cedolino
Elior = 2 fogli). Verifica doppia al 100% (OCR 848 pagine + 30 griglie visive).

**Copertura per lavoratore (mesi | buchi nel range):**
- Boriglione 70 (manca Feb 2023) · Cautilli 70 (manca Gen 2024) · De Biasio 71 (pieno)
- Gregorio 64 (manca Gen–Ago 2025 tranne Mar) · Martinelli 71 (pieno) · Montanaro 71 (pieno)
- Nitti 64 (manca Gen–Lug 2025) · Paglionico 63 (Lug 2023 + Gen–Lug 2025)
- Pierro 61 (manca Feb–Nov 2025) · Schingaro 71 (pieno)
I buchi 2025 (Gregorio/Nitti/Paglionico/Pierro) sono assenze nel materiale consegnato, non
errori di split — probabile cessazione/aspettativa, da verificare con Vincenzo se servono.

**Note a margine (non tocco senza ok):** Gregorio e Nitti hanno conteggi duplicati alla
radice (.doc vecchio + copia in conteggi/). JPG Boriglione spostati in
`buste paga/_jpg originali/` (nulla cancellato).

**Prossimo passo (sessione successiva):** caricamento+scansione nell'app coi controlli OCR
cartacee (piano ratificato 11/07) → sblocca l'area Indennità.

---

# Todo — Sessione 11/07 (pomeriggio): Riposi — parità vista viewer + chiarimenti Vincenzo su Viterbo

> **Contesto:** (1) Vincenzo non vede alcune cose nell'area Turni & Riposi dal suo account viewer →
> parità di vista; (2) dall'incontro: il PDF sorgente calcola giornate CEE + riposi giornalieri
> (sigla GRO, ≥11h/giorno) e settimanali con **paga oraria del mese × parametro** (561 artt. 6-7-8);
> ciclo riposi 3 settimane; settimanale 45h entro il 6° giorno (7° = riposo; se riconosciuto
> all'8° = violazione con TUTTE le 45 ore); **il 20% dell'avvocato = MAGGIORAZIONE sul totale**
> (non "danno = 20%": ribalta l'interpretazione registrata il 21/06).

**Evidenze già misurate (seed fonte, 5.022 giornate):**
- Regola 45h CONFERMATA nei dati: **103/499 righe settimanali valgono esattamente 45h piene**,
  le altre quote parziali (1-23h) → il perito applica entrambe le casistiche.
- Tariffa implicita per riga: G e S IDENTICHE per anno (10,03 → 13,13 €/h, mediana), coerente con
  la curva derivata del motore. Ipotesi da verificare con le buste: 13,13 = paga oraria mensile
  × 1,20 (teorica Monteleone 2024: 9,63 × 1,20 = 11,56 con anzianità diversa) → se vero, il +20%
  è GIÀ dentro la curva derivata.
- Il nostro motore serie B conta solo la QUOTA mancante (129 viol. sett./975h) → gran parte del
  gap con la fonte è la regola 45h, non la tariffa.
- **Inventario vista viewer** (`useIsReadOnly`/`canManage`/`canExport`): il viewer NON vede
  (a) pannello "Parametri di calcolo" (valorizzazione + curva €/h + editor) — unico blocco
  INFORMATIVO nascosto; (b) Excel/Relazione/Stampa su pratiche non "pagata" (regola-leva
  deliberata, cross-app); (c) tutto il lavoro post-28/06 non ancora deployato (coda deploy unico).
  Stato/importo riconosciuto già visibili read-only.

**Fasi:**
- [x] 1. Parità vista FATTA: pannello "Parametri di calcolo" ora visibile al viewer in SOLA LETTURA
      (valorizzazione applicata + curva €/h; editor/bottoni solo owner). Scelta utente: export
      (Excel/Relazione/Stampa) restano solo sulle Pagate (regola-leva invariata).
- [x] 2. Knowledge aggiornata (§2-bis metodologia-mancati-riposi): GRO = colonna Rip.Gro (riposo
      giornaliero fatto, 11−Rip.Gro = mancante, verificato al minuto), 45h piene = righe con
      Rip.Set VUOTO (103/103), tariffa = paga mensile × parametro, 20% = maggiorazione.
- [x] 3. Verifica tariffa FATTA (92 buste testuali Viterbo col parser FSE): **implicita fonte =
      teorica (AA245×7/6÷195) × 1,20 ESATTO su 2023-24 (13,13 = 10,94×1,20), 1,203 nel 2022** →
      il +20% è GIÀ nella curva derivata → coefficiente corretto = 1,0. Bonus: nota perito conferma
      (1,75h × 8,36 × 1,20 = 17,55 = riga PDF). **DB: coefficiente era GIÀ 1 (memoria 21/06 stale)**
      → serie B in produzione = €11.620,48, nessun intervento. UI: opzione "Maggiorazione · +20%"
      aggiunta per i casi a curva-base (es. Monteleone con teorica).
- [~] 4. Motore — DUE interventi, decisione di quantificazione APERTA (numeri sotto):
      (a) **guardia falsi-riposi ATTIVA**: i gap tra turni che attraversano giornate LAVORATE senza
      orari (servizio numerico/D, centinaia nel roster: 19 e 22/01/2011 ecc.) NON sono più riposi
      → correzione di correttezza, +1 warning aggregato; (b) **tempestività art. 8 §6 OPT-IN**
      (termineRiposoSettimanale, default OFF): riposo iniziato oltre 144h → 45h piene, dedup con
      alternanza. Configurazioni misurate sul dato reale (soloCEE, coeff 1, curva derivata):
      vecchio motore €11.620 (143 viol) · con guardia €21.785 (249) · guardia+144h €75.182 (277,
      timing 114 vs 82 eventi CEE del perito → sovra-spara, finestra da rifinire se si adotta).
      Fonte/perito CEE = €66.360. Reverse-engineering del trigger perito: miglior modello 86-89/103
      (festività lavorate trattate diversamente) — criterio esatto non estraibile con certezza.
- [x] 5. UI selettore 3 opzioni + banner/relazione/Excel aggiornati (danno vs maggiorazione).
- [ ] 6. Riconciliazione coi conteggi del perito per Viterbo FSE (15__conteggi.pdf,
      RiepilogoGenerale, Interessi e Rivalutazioni) — rinviata a sessione dedicata.
- [x] 9. **Toggle tempestività per pratica** (richiesta 11/07 sera): migration 025
      (`tempestivita_settimanale boolean`, APPLICATA live) + mapper/tipo/update + wiring motore
      (dettaglio E card area) + controllo nel pannello Parametri (owner; viewer read-only).
      Documenti GIÀ adattivi (nTiming): con toggle ON descrivono la regola come passo del metodo
      e tolgono l'esclusione prudenziale; causale «Settimanale oltre il termine: 45h intere».
      Riscritta in chiaro l'«unità di conteggio del settimanale» (ex granularità) in doc + UI.
      +4 test (mapper roundtrip, documenti adattivi) → 296/296.
- [x] 7a. Azienda + logo (richiesta 11/07 pomeriggio): `azienda='Ferrovie del Sud Est'` in DB
      (UPDATE verificato), helper `aziendaToProfilo` in profiles.ts, logo FSE nel header del
      dettaglio e nell'avatar card (fallback BusFront per aziende ignote), azienda nel sottotitolo.
- [x] 7b. **Leggibilità calendari per Vincenzo** FATTA (approvata con enfasi su "al click la
      spiegazione dettagliata + riferimento giuridico"). In più, scoperto in review: i giorni
      lavorati SENZA orari apparivano come "riposo" grigio → ora stile dedicato "turno senza
      orari nel PDF" (coerente con la guardia del motore), in celle, tabella e legende. Dettaglio:
      1. Sigle decodificate ovunque: D = A disposizione (riserva) · VM = Visita medica ·
         Malato = Malattia · P.retr = Permesso retribuito (oggi "sigla da decodificare").
      2. Elenco violazioni: mostrare il `motivo` del motore (frase completa già calcolata, mai
         renderizzata) + chip CEE sulla riga; click = apre il mese (invariato).
      3. Prospetto turni, griglia anni: pallino sui giorni CEE + voce in legenda; click sul
         giorno apre il mese CON quel giorno selezionato.
      4. Prospetto turni, vista mese: colonna CEE + colonne "Mancato G/S (PDF)"; card
         "Violazioni del mese" nell'aside con spiegazione completa per ognuna (tipo, motivo,
         gravità, riferimento); riga violata cliccabile → evidenzia la spiegazione.
      5. Confronto PDF: click sul giorno → pannello dettaglio in parole (cosa dice il PDF:
         mancato+indennità; cosa dice il motore: violazione+motivo; se non la contiamo, perché
         quando determinabile) + legenda arricchita.
      Vincoli: nessun controllo rimosso, tema chiaro/scuro, viewer = stessa leggibilità.

## 8. Documenti da giudice — relazione .docx + conteggi stampa (richiesta 11/07 sera, PIANO)

> Obiettivo: accuratezza notevole, tutto dichiarato, zero spazio a interpretazioni. I due documenti
> devono dire le STESSE cose (oggi duplicano testi a mano → rischio divergenza) e riflettere tutto
> ciò che oggi è cambiato/si è scoperto.

**Gap trovati nella lettura integrale dei generatori attuali:**
1. **"Coefficiente danno" ovunque, stale**: con coefficiente 1,20 stamperebbero «danno = 120% del
   valore» — testo sbagliato davanti a un giudice. Serve la tripartizione pieno/maggiorazione/danno
   (come la UI di oggi). Anche `coeffSuffix` («× 120%») e `causaleSintetica` (non conosce la
   violazione di tempestività → la etichetterebbe «inferiore al minimo ridotto») vanno adeguati.
2. **Tariffa oraria spiegata in modo vago** («ricavata dal documento, confermabile») quando ORA
   abbiamo la catena contrattuale VERIFICATA: retribuzione oraria (fissi+ratei ÷195, art. 15 CCNL
   '76) × 1,20 festivo (art. 14 CCNL '97), riscontrata al centesimo sulle buste 2023-24 e −0,3%
   nel 2022. Da dichiarare con onestà sul perimetro (anni verificati vs derivati).
3. **La guardia sui giorni lavorati senza orari NON è dichiarata** nel metodo (i gap che li
   attraversano non sono riposi): regola che sposta i numeri → va scritta.
4. **La tempestività art. 8 §6 (45h piene) non è menzionata**: se spenta va dichiarata ESCLUSA con
   riserva (spiega parte del divario A↔B ed è prudenziale); se attiva va descritta (rilevabile dai
   risultati). 
5. **Serie A descritta come scatola nera** («criteri di chi ha prodotto il documento») quando ora
   conosciamo il suo metodo esatto (Rip.Gro/Rip.Set, 11h−fatto, 45h−fatto, 45 piene oltre il
   termine, paga mensile ×1,20) → descriverlo rende il confronto A↔B leggibile dal giudice.
6. **Divario A↔B senza numeri**: serve la sezione dedicata con le ragioni QUANTIFICATE (split fonte
   CEE/non-CEE calcolabile dalle giornate; riduzioni lecite; tempestività esclusa; granularità
   settimanale per-evento vs a scorrimento).
7. **Perimetro CEE citato senza base normativa completa**: artt. 2 §1 lett. b) e 3 lett. a)
   Reg. 561/2006 (a contrario) + nota INL prot. 61 del 14/01/2021.

**Piano:**
- [x] A. **Nucleo testuale condiviso `utils/riposiDocText.ts`** — una sola fonte della verità per i
      testi/calcoli che compaiono in ENTRAMBI i documenti: valorizzazione (3 casi), catena tariffa
      con perimetro di verifica, metodo serie A, regole motore complete (guardia, ridotti leciti,
      alternanza, tempestività presente/esclusa), ragioni del divario con numeri, riferimenti
      normativi, riserve. Fix `causaleSintetica` per la tempestività.
- [x] B. **Relazione .docx** ristrutturata sul nucleo: 1 dati pratica · 2 fonte dei dati e
      affidabilità (parser deterministico quadrato al centesimo) · 3 quadro normativo (con CEE
      completo) · 4 metodo del documento sorgente (serie A) · 5 metodo del motore (serie B) +
      esempio numerico · 6 risultanze e riepilogo per anno · 7 il divario A↔B spiegato coi numeri ·
      8 elenco violazioni · 9 riserve e limiti. Stile docx invariato (branding documenti INVARIATO
      come da decisione rebrand).
- [x] C. **Conteggi stampa** allineati: stessi contenuti dal nucleo, layout tabellare A4 attuale.
- [x] D. **Verifica FATTA**: 14 test nuovi sul nucleo (3 valorizzazioni, split CEE, salvaguardia,
      tempestività, «mai danno=120%», parità docx↔html) + 18 test esistenti INVARIATI verdi;
      generazione END-TO-END dei documenti REALI di Viterbo in Node (5.022 giornate): serie B
      € 21.784,85 = configurazione scelta, divario CEE quantificato al centesimo (€ 32.372,41 =
      98.732−66.360), 584 intervalli di salvaguardia e 1.264 giornate senza orari dichiarati,
      riscontro tariffa (fonte_tariffa aggiornata in DB) citato nel testo. Gate 292/292 · build ok.
      Copie reali su ~/Desktop (viterbo-relazione.docx + viterbo-conteggi.html) per il collaudo visivo.

# Todo — Sessione 12/07: rivalutazione ISTAT + interessi riposi + cornice formale relazione

> **Contesto:** punto 10 dell'11/07. Bersaglio di riconciliazione = «Viterbo (Interessi e
> Rivalutazioni).pdf» (166 pagg. testuali: 1 pagina per mese di danno, serie A intera 98.732,03,
> scadenza comune 31/10/2024; Riepilogo Generale: riv 14.475,09 + int 9.747,67 = 122.954,79).
> Metodo perito: FOI MENSILE alla decorrenza (fine mese), capitale progressivamente rivalutato,
> interessi legali pro-rata GIORNI. Il motore Incidenze (istatService) è annuale/approssimato →
> NON si tocca; modulo nuovo puro. Decisioni utente: rivalutare ENTRAMBE le serie (A e B) nei
> documenti + riga del totale rivalutato anche in UI. Piano: ~/.claude/plans/pure-hatching-swan.md

- [x] 0. Calibrazione FATTA — metodo del perito DECIFRATO sui dati: FOI mensile 1 decimale (identico
      alle tavole ufficiali), rivalutazione CONCATENATA per anno con coefficienti round-3-decimali,
      interessi base 365 FISSA su giorni di calendario tra confini di segmento. Riprodotte 153/165
      pagine al centesimo (1.184/1.184 righe interessi), riepilogo Δ +4,84 € su 122.954,79 (+0,004%,
      arrotondamenti interni del suo software non riproducibili da indici pubblicati); capitali
      mensili = serie A dal seed **165/165 al centesimo** (il perito rivaluta la serie A INTERA).
      Report: [riconciliazione-rivalutazione-viterbo-2026-07-12.md](riconciliazione-rivalutazione-viterbo-2026-07-12.md)
- [x] 1. `utils/rivalutazione.ts` FATTO (puro): FOI mensile 2011→mag 2026 (2025-26 verificati su
      DUE fonti ufficiali; raccordi 1,071 e 1,214), tassi legali propri 2011-2026 (2025=2,00%,
      2026=1,60% da DM — ⚠️ istatService ha 2025=2,50 ERRATO, segnalato e NON toccato),
      calcolaRivalutazioneMese/buildRivalutazione + helper capitali serie A/B; scadenza limitata
      all'ultimo indice pubblicato e DICHIARATA; mesi pre-2011 inclusi col solo capitale, flaggati.
- [x] 2. Nucleo: buildRivalutazioneModel (entrambe le serie), rivalutazioneBullets (429 c.p.c.,
      indici+raccordi, tempo per tempo, ultimo indice, «non si sommano»), MAGGIORAZIONI_BASE_100.
- [x] 3. Relazione .docx: Oggetto · 1 Premessa e incarico (firmatario in bianco, Luogo e data in
      testata) · … · 9 Rivalutazione (riepilogo economico A+B + analitico per annualità per serie) ·
      12 Conclusioni a punti coi totali rivalutati · riga Firma; tabella maggiorazioni base-100 nel
      quadro contrattuale; sezioni rinumerate e riferimenti incrociati aggiornati.
- [x] 4. Conteggi stampa: sezione 3 «Rivalutazione monetaria e interessi legali» (stessi bullets +
      riepilogo + analitici per serie dal nucleo), sezioni rinumerate.
- [x] 5. UI: totale rivalutato in ENTRAMBE le card «Le due serie a confronto» (+ nota metodo/scadenza
      nel footer della sezione); stessi numeri dei documenti (buildRivalutazioneModel), viewer invariato.
- [x] 6. Verifica: 20 test nuovi rivalutazione (6 pagine reali del perito al centesimo, riepilogo 165
      mesi, edge copertura/clamp/serie) + 5 test documenti (cornice formale, sezione in docx E html,
      base-100, scadenza limitata dichiarata) → **322/322** · tsc 0 · build ok; end-to-end Node su
      dati reali: serie B €21.784,85 invariata, serie A rivalutata 31/10/2024 = 122.959,63 (|Δ perito|
      = 4,84 < 5), documenti reali rigenerati su ~/Desktop (viterbo-relazione.docx + conteggi.html,
      scadenza 31/05/2026 dichiarata «ultimo indice»). Collaudo visivo all'utente.

### Review — sessione 12/07
- Gate: tsc 0 · vitest 322/322 (25 nuovi; il 342 scritto in prima battuta era un errore di conteggio) · build ok.
  Nessun tocco a migration/DB, nessun push.
- **Fix istatService (stessa sessione, richiesta utente)**: tasso legale 2025 2,50→2,00 (DM 10/12/2024),
  +2026 = 1,60 (DM 10/12/2025), +FOI 2026 = 124,8 (ultimo indice mag 2026 ×1,214; prima il fallback stale
  fermava la rivalutazione all'indice 2024 e gli interessi 2026 usavano il default 2,50). Solo DATI, zero
  logica. Impatto su €1.000 origine 2020 a oggi: 1.319,85 → 1.356,65 (+riv per l'indice vero, −int per i
  tassi veri). Test-guardrail __tests__/istatService.test.ts (fallisce a inizio anno se le tabelle non
  vengono aggiornate) → 325/325.
- La riconciliazione ha chiuso ANCHE la parte interessi/rivalutazione della fase 6 (riconciliazione
  conteggi perito): capitali 165/165, metodo identico, scarto +0,004% documentato e spiegato.
- A oggi (31/05/2026): serie A rivalutata € 130.957,68 · serie B € 28.719,09 (cap 21.784,85 +
  ISTAT 4.076,78 + interessi 2.857,46). I documenti dichiarano scadenza e criteri.
- Fuori scope dichiarato: Excel riposi senza rivalutazione; istatService (bug tasso 2025) intatto;
  restano del punto 10 originario SOLO gli altri PDF del perito (15__conteggi/RiepilogoGenerale).

---

## 10. PROSSIMA SESSIONE — allineamento al modello di relazione + rivalutazione/interessi riposi

> Confronto (11/07 notte) con «IMPORTANTE Relazione_tecnica_mancati_riposi_.docx» (il modello che
> lo studio usò in passato, template Monteleone): la nostra relazione è GIÀ più completa su dati,
> metodo, trasparenza e elenco violazioni. Da adottare dal modello:
- [ ] **Rivalutazione ISTAT FOI + interessi legali "tempo per tempo"** per i riposi (loro §7,
      con allegato analitico per annualità: capitale rivalutato + interessi = totale). È il gap
      SOSTANZIALE: il numero da giudice è quello rivalutato. Riusare il motore ISTAT delle
      Incidenze; bersaglio di riconciliazione = «Viterbo (Interessi e Rivalutazioni).pdf» del
      perito (cartella VITERBO FSE) → si aggancia alla fase 6 (riconciliazione conteggi).
- [ ] Cornice formale nella relazione: «Oggetto» + «Premessa e incarico» (campo firmatario in
      bianco, come il modello) + «Conclusioni» a punti + riga firma.
- [ ] (cosmetico) Schema maggiorazioni in tabella base-100 nel quadro contrattuale.

### Review — sessione riposi 11/07
- Gate: tsc 0 · vitest 278/278 (4 test nuovi tempestività) · build ok. Nessun tocco a migration/DB.
- La banda dei chiarimenti ha retto TUTTA alla prova dei dati: GRO, 45h piene, paga×parametro,
  maggiorazione — ogni affermazione di Vincenzo trova riscontro esatto nel PDF/buste.
- Il numero in produzione NON è cambiato finché l'utente non sceglie la configurazione serie B
  (il refresh col nuovo build porta la guardia → €21.785; la tempestività resta spenta).

---

# Todo — Sessione 11/07: parser di verità FSE + MERCITALIA (prova d'accuratezza)

> **Contesto:** estendere la feature "Verifica accuratezza (dal disco)" — oggi solo RFI/Trenitalia
> (`utils/rfiTruthParser.ts` + `utils/verifyFromFolder.ts`) — alle buste FSE (Clarino, 200 PDF sul
> Desktop) e MERCITALIA (Gagliano, 78 PDF). Requisiti FSE già raccolti nel §4 del
> [controllo-pratica-clarino-2026-07-10.md](controllo-pratica-clarino-2026-07-10.md).
> Lezione vincolante 20/05: parser scritto SUI PDF REALI; lezione 07/07: validare in Node con la
> stessa pdfjs-dist PRIMA di dichiararlo fatto.

**Perimetro dati (ricognizione fatta):**
- FSE testuali = ere Zucchetti I8/T8 (nov 2020→) e IX (lug 2017–ott 2020), ~100 buste; era storica
  2010–giu 2017 = scansioni → `isText=false`, restano OCR+censimento (fuori dal parser, by design).
- MERCITALIA = ADP 7 colonne, tutte testuali; nomi file NUMERICI (`Cedolini-2019-10-…`) → il
  `detectYM` attuale (solo nomi mese italiani) NON li riconosce: va esteso.

**Decisioni di design (da ratificare):**
1. **daysWorked FSE (verità)** = quantità G NETTA delle voci presenza (I86178/I86005/IX0023, storni
   inclusi) — stessa definizione del motore → confronto omogeneo. La banda **GG LAV** si legge come
   CONTROLLO: se diverge dalla voce → mese **flaggato, non auto-corretto** (req. §4.3: avrebbe preso
   sia Mag 2021 sia Gen 2018). Relazione esatta banda↔voce (es. GG LAV = presenza − ferie, visto su
   Ago 2021: 24−6=18) da calibrare empiricamente in fase 0.
2. **Codici FSE confrontati** = 24 variabili Zucchetti + 5 fisse `fse_*` (dal box ELEMENTI, mappate
   come chiavi nel `codes`); gli 8 codici era storica mai raggiungibili dal parser testo.
3. **MERCITALIA**: 12 variabili da "Competenze" + 3 fisse (1000/1001/1025) da "Valori";
   daysVacation = somma righe 3833 POSITIVE; daysWorked = GIORNI INPS (pag. 2) − daysVacation
   (fallback 1213). Ticket/arretrati fuori confronto (come per RFI).
4. **Robustezza FSE** (req. §4): multi-riga stesso codice → somma col segno; pagine duplicate
   identiche nello stesso PDF → dedup per firma testo; 13ª/14ª ("13a mens."/R4210/R4230) → busta
   SALTATA e contata a parte; daysPaidLeave non tracciato per FSE/Merc → non confrontato.

**Fasi:**
- [x] 0. **Calibrazione in Node** FATTA — FSE: 107/107 riconciliazione Σ Competenze vs TOT COMPETENZE
      stampato, 107/107 box ELEMENTI vs AA245, 107/107 periodo PDF = nome file, 14/14 campioni al
      centesimo (storni Mag/Giu/Ott 2021 nettati, Ago 2021 completo, Set 2022 vuoto, Gen 2018 qty 38,
      Ago 2018 era IX). Merc: 78/78 + 78/78 (1000+1001+1025=1100) + campione Mag 2022 al centesimo.
      **Esiti che cambiano il design:** (1) banda GG LAV = 22 TEORICO in tutta l'era IX e sporadicamente
      altrove → INUTILIZZABILE come controllo; flag giusto = presenze>31 (becca Gen 2018=38 e Apr
      2026=46), giorni non confrontati per quei mesi. (2) Trappole di layout risolte: riga banca
      "INTESA SANPAOLO … Emolumenti correnti" (2022+) e "D01CNG Esonero L.234" cadono in zona
      Competenze → regione voci delimitata da header→separatore "---- Imponibili"/NOTE; crediti WZF*
      (DL 66/2014) contati da Zucchetti nel TOT → solo riconciliazione, mai codici. (3) Ferie F2105
      H÷6,5 = intere su TUTTI i 107 mesi. (4) Box ELEMENTI ristampato sul retro → lettura singola.
      (5) Merc: GIORNI INPS assente 1 volta (Dic 2025) → fallback 1213 ok; 1 storno 3833 gestito;
      esiste doppione "Cedolini-2025-12 (1).pdf" → gestito dal guardrail mesiInConflitto.
- [x] 1. `utils/fseTruthParser.ts` — con autovalidazione reconOk (Σ Competenze = TOT COMPETENZE),
      flag daysUncertain (presenze>31), periodo dal PDF, skip 13ª/14ª, dedup pagine identiche.
- [x] 2. `utils/mercitaliaTruthParser.ts` — reconOk vs riga "Totali", GIORNI INPS + fallback 1213,
      3833 col segno (storni esclusi), fisse da "Valori".
- [x] 3. `utils/verifyFromFolder.ts` parametrizzato (`PROFILES`: parser + codici derivati da
      types.ts + campi giorni); `detectYM` esteso ai nomi numerici; report con busteNonQuadrate,
      buste13a14a, busteMisfiled (periodo PDF ≠ nome file), mesiGiorniIncerti — RFI invariato.
- [x] 4. UI: gating header + prop `profilo` + hint per azienda + avvisi nuovi nel modale.
- [x] 5. Validazione finale coi parser DEFINITIVI (transpilati esbuild, stub solo getPdfjs):
      **22/22 asserzioni verdi** su 200 PDF FSE + 78 Mercitalia; tsc 0 · vitest 274/274 · build ok.
- [x] 6. Commit locale (NO push: deploy unico dopo Elior) + todo/report/lessons/memoria aggiornati.

### Review — parser di verità FSE + Mercitalia (11/07)
- **Copertura**: FSE 107 buste testuali verificabili (lug 2017→giu 2026; le 93 scansioni era storica
  restano OCR+censimento, segnalate nel modale); Mercitalia 78/78 verificabili.
- **Scoperta che cambia il §4.3 del report Clarino**: la banda "GG LAV." NON è una fonte — nell'era
  IX è un 22 TEORICO fisso (anche nel mese di congedo totale Set 2022, dove il report la diceva
  vuota). Il netting delle quantità becca da solo Mag 2021 (24+75−75=24); i casi Gen-2018-style
  (arretrati nella quantità) li becca il flag presenze>31 → mese segnalato, giorni NON toccati
  (protegge anche i 2 fix manuali dell'11/07 dal ri-rollback).
- **Autovalidazione per-busta (novità)**: ogni busta deve quadrare col SUO totale stampato
  (TOT COMPETENZE / riga Totali); se non quadra → scartata come verità e contata nel modale.
  In calibrazione questo ha scovato 3 trappole reali: riga banca INTESA (2022+), esonero D01CNG,
  crediti WZF* — tutte invisibili a un parser "a colonne" ingenuo.
- **Non fatto di proposito**: nessun tocco al parser RFI/Trenitalia (solo firma verifyFromFolder);
  ticket/arretrati fuori confronto (come per RFI); era storica FSE fuori perimetro parser.

---

# Todo — Sessione 10/07 notte: controllo totale pratica Clarino (post-caricamento)

> **Contesto:** l'utente ha caricato TUTTA la pratica Clarino in app (deploy unico ancora pendente
> → caricamento via dev locale). Controllo integrale su DB, anche in vista del parser di verità FSE
> (roadmap punto 4). NOVITÀ 10/07: Vincenzo ha riconsegnato le buste di TUTTI i lavoratori Elior
> viaggiante + archivio → sblocca la sezione Indennità (vertenza residenza); si parte DOPO Clarino.

- [x] 1. Inventario archivio: 183 buste, copertura piena (manca solo Set 2017 = noto), zero duplicati,
      zero 13ª/14ª, Dic 2010 = Nº 0046860
- [x] 2. Griglia + estrazioni: prompt NUOVO (32+5 chiavi) su TUTTI i mesi; Nov 2011/Set 2013 = censimento
      al centesimo; griglia coerente, zero virgole
- [x] 3. Sanity + storni: scan full-text 2017-2025 → 3 mesi con righe negative (tutti 2021), importi
      NETTATI correttamente; **2 FIX FATTI l'11/07 via SQL verificato: Mag 2021 75→24, Gen 2018 38→16**
      (16 = 38 − 22 arretrati Dic 2017, voce assente a dicembre; perito 15 ±1) → hard refresh utente
- [x] 4. Report: [controllo-pratica-clarino-2026-07-10.md](controllo-pratica-clarino-2026-07-10.md)
      (+ nota: perito usa media MOBILE 12 mesi, noi anno solare precedente → altro delta by design)
- [x] 5. Roadmap vault + memorie aggiornate: Clarino controllato, Elior viaggiante SBLOCCATO
      (buste tutti i lavoratori + archivio da Vincenzo, 10/07)

---

# Todo — Sessione 10/07 sera: primo collaudo delega a Codex (test TFR/verify)

> **Contesto:** Codex CLI (bundled in ChatGPT.app, piano Plus attivo) usato come esecutore:
> Claude scrive la spec e verifica, Codex implementa. Primo task = estendere la copertura
> test di `tfrCalculator` e `verify-payslip` (tech debt backlog; i file test esistono già
> ma sottili — mancano i casi-lezione e il blocco era storica FSE di be4fd20).

- [x] 1. Spec dettagliata (target, casi limite, regole vincolanti: solo `__tests__/`, niente fix ai sorgenti)
- [x] 2. `codex exec --sandbox workspace-write` sul repo → 13 test nuovi, perimetro rispettato (sole aggiunte)
- [x] 3. Review del diff + gate rifatti da Claude: vitest 274/274 · tsc 0 → commit ac56b80
- [x] 4. Finding triage: virgola su imponibile/daysWorked = rischio LATENTE (upload usa parseLocalFloat,
      edit manuale TFR usa replace(',','.') — resta il caso jsonb legacy); "12,34"→NaN nel verificatore =
      da valutare hardening; punto zero anno = by design (il malloppo include la quota); punto zero futuro =
      config assurda, bassa priorità. Nessun fix applicato — decisione all'utente.

### Review collaudo Codex
- Il flusso spec→exec→review→gate funziona: Codex ha rispettato tutti i vincoli (solo 2 file, stile
  italiano, ⚠️ sui sospetti, niente fix ai sorgenti) e i conti dei test tornano (verificati a mano).
- Bonus stessa sessione: verificato `viewer_payment_block=false` su Supabase (punto flaggato in roadmap).

---

# Todo — Sessione 10/07: split PDF annuali FSE Clarino 2010-2016 in cedolini mensili

> **Contesto:** i ruoli paga Clarino 2010-2016 sono scansioni accorpate in un PDF per anno
> (`Ruoli paga Clarino/2010.pdf` … `2016.pdf`, 12+28×6 = 180 pagine, fronte+retro alternati,
> ordine NON cronologico). Vanno divisi in PDF mensili (2 pagine ciascuno) nelle cartelle
> anno, con la convenzione esistente `Mese Anno.PDF` / `Tredicesima Anno.PDF` / `Quattordicesima Anno.PDF`.

- [x] 1. Ispezione layout → verifica: fronte = pagine dispari col box "Periodo di Retribuzione", retro = pari (IRPEF)
- [x] 2. Lettura periodo di OGNI pagina via griglie di ritagli (lezione split Elior 13/06: mai inferire dalla sequenza)
      → 2011-2016 completi (12 mesi + 13ª + 14ª); 2010 parziale da Settembre (assunzione 01/09/2010)
      → ⚠️ 2010 ha DUE cedolini "Dicembre 2010" distinti (Nº 0022887 netto 1.490,57 vs Nº 0046860 netto 1.439,58,
        stesse competenze, ritenute diverse — probabile riemissione/conguaglio): estratti entrambi col Nº nel nome,
        decide l'utente quale inserire nell'app (policy: segnalare, non indovinare)
- [x] 3. Split lossless con pdfseparate+pdfunite in scratchpad → verificato: 90 file, tutti da 2 pagine (pdfinfo)
- [x] 4. Verifica visiva post-split: griglia fronte-di-ogni-file-creato etichettata col nome file → 90/90 periodo = nome
- [x] 5. Copia nelle cartelle `Ruoli paga Clarino/2010` … `2016` (originali annuali INTATTI) → 6+14×6 file in posizione

## Blocco 2 — Censimento codici voce era 2011-2016 (+ Gen-Giu 2017 SPA-GUIDA)
> Prerequisito del quesito 2 all'avvocato: confermare che le colonne del riepilogo perito
> (Percorrenze, Nastri, Guide, Rimorchio…) corrispondano alle voci stampate dell'era.
- [x] 1. Griglie crop tabella voci (colonne Voce+Descrizione) di OGNI fronte 2010-2016 + bundle Gen-Giu 2017
      (96 fronti in 12 griglie + griglia periodi bundle: Gen→Giu 2017 in ordine crescente)
- [x] 2. Lettura visiva → 9 mesi con tabella lunga ricontrollati con crop di coda (nessuna riga persa)
- [x] 3. Deliverable [tasks/censimento-codici-fse-2011-2016.md](censimento-codici-fse-2011-2016.md)
- [x] 4. Memoria aggiornata

### Esito censimento (sintesi)
- Indennità di incomodo STAMPATE nell'era = solo **029 Art.5A · 094 Art.5/B · 300/301/303/306/307 Trasferte
  · 663 Ind. giornaliera (presenza, da OTT 2012)**. Percorrenze/Nastri/Guide/Rimorchio/Disponibilità/Riserva/
  Flessibilità/IndAggiun **NON esistono come voci stampate** → nel riepilogo perito 2011-2016 possono essere
  solo ricostruzioni a tariffa (pattern §4 report riconciliazione) → bozza di risposta al quesito 2.
- Pre-ott 2012 la fonte GG è la banda "Presenze del mese" (in questo layout è compilata e affidabile):
  la regola "vietato usare la banda" del PROMPT_FSE andrà differenziata per era.
- PRIMA di estendere colonne/prompt: verifica quantitativa a campione (importi 029/094/30x vs celle riepilogo
  perito) + risposta avvocato al quesito 2. Poi PROMPT_FSE + verify-payslip gemello insieme.

## Blocco 3 — Verifica quantitativa a campione (FATTA, 8/8 al centesimo)
- [x] Header riepilogo perito decodificato per coordinate (15 colonne numeratore, dump-riepilogo.mjs)
- [x] 8 mesi campione (Giu/Nov 2011, Apr/Ott 2012, Feb/Set 2013, Mar 2015, Ott 2016): importi letti dai crop
      full-width e confrontati cella per cella → **8/8 al centesimo**, esito in
      [censimento-codici-fse-2011-2016.md](censimento-codici-fse-2011-2016.md) §7 + cross-link nel report riconciliazione §8.2
- Regole inchiodate: Diarie = serie A (300/301/303) · Trasferte = serie B (306/307) · GG = banda Presenze
  (663 qty ≈ 26 fisso, DIVERGE) · Ferie = banda Congedi (anche il 17 di Set 2013) · 029 = 0,52×GG ·
  "Ind. Aziendale" = 3,50×GG anche nel 2011-2016 (la ricostruzione parte da gen 2011, non dal 2017)
- Il numeratore perito 2011-2016 è DOMINATO dal ricostruito (~120-480 €/mese; Mar 2015 = 97%) → quesito 2
  pronto per l'avvocato coi numeri; estensione colonne/prompt SOLO dopo la sua risposta

## Blocco 4 — Estensione era storica (DECISIONE UTENTE 10/07: si fa ORA, voci stampate)
> L'utente vuole caricare TUTTI gli anni con estrazione AI reale. L'app conterà le voci STAMPATE
> (029/094/300/301/303/306/307); le ricostruzioni del perito restano quesito 2 per l'avvocato.
- [x] 1. `types.ts`: +7 colonne era storica in INDENNITA_FSE (029, 094, 300, 301, 303, 306, 307)
- [x] 2. `scan-payslip.ts` PROMPT_FSE: guardia → blocco §5-ter era storica (tre ere nel §0; §2/§3 scopati
      alle ere Zucchetti; GG=banda Presenze, ferie=banda Congedi, 663 VIETATO sia importo sia giorni,
      fisse dal box con A.P.A.+3°El.Sal. sommati in fse_scatti, 13-14 MENS., esclusioni censimento §3;
      esempio few-shot Nov 2011 coi numeri verificati; contratto JSON a 28 chiavi)
- [x] 3. `verify-payslip.ts` FSE: blocco ERA STORICA speculare (regole "ribaltate": qui la banda È la fonte)
- [x] 4. Bundle 2017 splittato → 6 mensili verificati (6/6 periodo=nome) nella cartella 2017; originale
      rinominato e spostato nella root: `Gennaio-Giugno 2017 (scansione, originale non caricare).pdf`
- [x] 5. Gate: tsc 0 err · vitest 261/261 · build ok

### Review Blocco 4
- L'app ora estrae le voci STAMPATE dell'era storica; scelta deliberata di NON replicare le ricostruzioni
  del perito (3,50×GG, Percorrenze, Guide…) → restano il quesito 2. Quando/se l'avvocato dirà di
  replicarle, la via è la colonna-formula (es. `3,50×[daysWorked]`), non il prompt.
- Restano da caricare (utente, via AI): 2010-2016 splittati + Gen-Giu 2017; NO 13ª/14ª; UN solo Dic 2010.

## Blocco 5 — DECISIONE UTENTE 10/07: "i calcoli come li facciamo noi, il perito era una linea guida"
> Supera il "seguiamo il modello del perito" del 09/07. Criterio nuovo (proposto da me, confermato):
> nel numeratore le INDENNITÀ DI PRESTAZIONE (perse nei giorni di ferie); fuori gli straordinari
> (lavoro aggiuntivo, CGUE Hein) e le voci FISSE mensili pagate anche in ferie (nessuna perdita).
- [x] +9 colonne in `INDENNITA_FSE` (32 totali): I86178 presenza, I86005 giornaliera, I85210 notturno,
      I86161 turno prod., I86110 disponibilità, V12001 lavoro festivo, IX0023, IX0046, 013 notturno storico
- [x] PROMPT_FSE §5 (24 variabili Zucchetti, presenza = importo in codes E quantità → daysWorked),
      §6 esclusi riscritto (AA712 fisso mensile, S11000/IX0048/V12000/I86125 straordinari, I8320 rimborso),
      §5-ter: +013; 663 ESCLUSA con motivazione empirica (fisso ~26gg anche con 17gg ferie — Set 2013)
- [x] verify-payslip specchiato (presenza: importo+contatore NON è doppio uso da segnalare)
- [x] Gate: tsc 0 · vitest 261/261 · build ok
- ⚠️ Conseguenze attese: totali app ≠ perito OVUNQUE d'ora in poi (2021-24: ~+800€/mese di voci
  in più del suo set; 2011-16: niente ricostruzioni). La riconciliazione 49/49 resta la prova che
  leggiamo i cedolini giusti, NON il target dei totali. 041 festività esclusa = nota per l'avvocato.

## Review
- Split **lossless** (pdfseparate+pdfunite, zero ricompressione delle scansioni); generato in scratchpad,
  verificato (pagine + lettura visiva di ogni fronte), POI copiato su Desktop. Originali annuali lasciati al loro posto.
- Nomi = convenzione delle cartelle già inserite (`Mese Anno.PDF`, `Tredicesima/Quattordicesima Anno.PDF`) →
  compatibili col parsing mese/anno dal nome file di `usePayslipUpload` (§ label, riga ~357).
- Nota per l'inserimento in app: prompt FSE ([scan-payslip.ts:933](../netlify/functions/scan-payslip.ts)) tratta
  l'era 2011-2016 come NON mappata → in archivio sì, voci a 0.0 con aiWarning. Il doppio Dicembre 2010 va
  scelto dall'utente prima dell'upload (i due file hanno il Nº documento nel nome).

---

# Todo — Sessione 09/07: nuovo logo FAST-CONFSAL + sottotitolo + analisi mancati riposi

> **Contesto:** incontro con Vincenzo il 09/07. Ha pagato (accesso viewer sbloccato su Supabase,
> passaggio al piano Pro). Ha consegnato: (a) nuovo logo FAST-CONFSAL da sostituire + dicitura sede;
> (b) documenti "mancati riposi" che in realtà sono il primo materiale della nuova azienda
> **Ferrovie del Sud Est (FSE)** / lavoratore **Monteleone Giuseppe** — usati come *esempio* per capire
> come è impostata la pratica dei mancati riposi. L'inserimento dell'azienda FSE è per una sessione futura.

## Blocco 1 — Logo + sottotitolo (FATTO, verificato)
- [x] **1. Nuovo asset logo.** Ritagliato il logo tondo dal JPG sorgente (1596²) in PNG circolare 512²
      con **fuori-cerchio trasparente** → il cerchio bianco è auto-contenuto, leggibile su light E dark
      senza pastiglia/invert. Sostituito `public/logos/fast-confsal.png` (un solo file → aggiorna tutti gli usi).
- [x] **2. `SindacatoTag.tsx`** — rimossa la pastiglia bianca dark (ora inutile, creava angoli dietro il cerchio);
      aggiunta la dicitura **"Segreteria Regionale / Puglia e Basilicata"** sotto il logo. Essendo il co-brand
      usato in tutte le aree (Incidenze, Turni & Riposi, Indennità, dashboard), il sottotitolo compare **ovunque**.
- [x] **3. `WorkerModal.tsx`** — stessa pulizia della pastiglia dark sull'header (logo auto-contenuto).
      Qui **niente sottotitolo**: è l'header di un form ("Nuova Pratica"), la dicitura regionale lo affollerebbe.
- [x] **Gate:** `tsc --noEmit` 0 err · `vite build` ok. Preview statica del logo su fondo scuro/chiaro = pulito.

## Blocco 2 — Analisi mancati riposi (esempio Monteleone/FSE) — FATTO
- [x] Estratta la relazione tecnica nuova (metodo: divisore 195, elementi fissi + ratei 13ª/14ª → paga oraria,
      ×1,20 festivo, ×7 ore/riposo, ISTAT FOI + interessi legali; ruolo paga sett. 2024).
- [x] Confronto col metodo già implementato (`restEngine.ts` + `metodologia-mancati-riposi.md`): **combacia in tutto**,
      nessun metodo nuovo. Unico nodo per il futuro = quale tariffa oraria usare per Monteleone (effettiva vs teorica).
- [x] Deliverable = [`tasks/analisi-relazione-monteleone-fse-2026-07-09.md`](analisi-relazione-monteleone-fse-2026-07-09.md)
      + puntatore nella nota 4 del doc dominio. Zero modifiche al codice di calcolo.

## Note aperte / da decidere con l'utente
- Sottotitolo anche nell'header di `WorkerModal`? (ora no — flag).
- Verificare che il blocco pagamento viewer (`viewer_payment_block`, migration 018) sia effettivamente spento
  (l'utente dice di averlo sbloccato lui).

## Review
- **Logo:** cambio centralizzato in 1 asset + 2 micro-edit di componente. Nessun `dark:invert`/pastiglia: il nuovo
  logo tondo ha il cerchio bianco proprio → si legge nudo su qualsiasi tema (pattern lezione 03/07). Diff minimo,
  gate verdi. Validazione visiva finale all'utente nell'app.

---

# Todo — Sessione serale 09/07: FSE riconciliazione perito + motore OCR

> **Scoperta chiave (verificata al centesimo su 3 ere: 2019, 2021, 2023):** il numeratore del perito NON è il set
> `INDENNITA_FSE` del pomeriggio — esclude presenza (I86178/I86005), funzione sala (AA712), notturno (I85210).
> GG Effettivi = giorni G della voce presenza/giornaliera; Ferie = ore F2105 ÷ 6,5.
> Decisione utente: **riconciliazione deterministica prima**, poi profilo + motore OCR.
> Piano completo: `~/.claude/plans/golden-doodling-kurzweil.md`.

## Fase 0a — Riordino cartella Clarino (Desktop) — FATTO
- [x] Rename `2024/Luglio 2024.PDF` → `Quattordicesima 2024.pdf` (verificato: è la 14ª) e `Luglio 2024 (1).PDF` → `Luglio 2024.PDF`
- [x] Rename `(1)` in 2022 (Tredicesima/Quattordicesima) + `Novembre_2025.pdf` → `Novembre 2025.pdf`
- [x] Rename `2017/2017 1:2.pdf` → `Gennaio-Giugno 2017 (scansione).pdf` (verificato: 6 cedolini fronte/retro Gen-Giu)
- [x] Audit nome↔contenuto di tutti i mensili testuali: nessun altro mismatch. Mancanti (per Vincenzo): Set 2017, 13ª 2017, 13ª 2023, 13ª 2025

## Fase 0 — Riconciliazione deterministica perito ↔ cedolini — FATTO
- [x] Script Node (scratchpad `recon-fse.mjs`, pdfjs-dist del progetto): parser riepilogo (167 righe, colonne per coordinate) + parser cedolini
- [x] **49/49 mesi nov2020-nov2024 riprodotti al centesimo, zero ambiguità**; era IX 2017-2020: voci stampate al centesimo + 2 ricostruzioni a tariffa del perito (3,50×GG; 1,76×gg-Art5A) NON stampate
- [x] Deliverable: [riconciliazione-perito-clarino-2026-07-09.md](riconciliazione-perito-clarino-2026-07-09.md) (con 3 quesiti per l'avvocato)

## Fase 1 — Correzione profilo — FATTO
- [x] `INDENNITA_FSE` riscritta: 16 voci riconciliate (10 era I8/T8 + 6 era IX); escluse presenza/sala/notturno/straordinari; merge upload verificato (chiavi extra innocue)

## Fase 2 — Motore OCR — FATTO
- [x] `scan-payslip.ts`: PROMPT_FSE (Zucchetti 7 colonne, COMPETENZE, GG da voce presenza I86178/I86005/IX0023, ferie F2105÷6,5, fisse dal box → fse_*, ticket I86120/I86121, 13ª/14ª fuori conteggio, doppia era, guardia era 2011-16) + PROMPT_DIRECTORY
- [x] `verify-payslip.ts`: ramo FSE gemello (stesse regole, esclusioni esplicitate come NON-mancanti) · `scan-worker.ts`: FSE nell'enum (anti-confusione con Ferrovie dello Stato)
- [x] Gate: tsc 0 err · vitest 261/261 · build ok · commit senza push

## Follow-up (stessa serata, richieste utente) — FATTO
- [x] Prompt anagrafica FSE in `scan-worker.ts` (matricola fusa col nominativo, DESCRIZIONE QUALIFICA = mansione, QUA./IN = livello)
- [x] Chip azienda della striscia compatta a scorrimento orizzontale (no-scrollbar) — segnalato taglio dal clip
- [x] Verificato: chip FSE già auto-cablato dal registry (logo 3,36 ≈ elior, footer teal, filtro generico) — commit ca312aa

## Review (sessione serale)
- La riconciliazione ha ribaltato il set del pomeriggio: sovra-contava ~800€/mese (presenza+sala+notturno).
  Ora le colonne = esattamente ciò che il perito somma, dimostrato al centesimo su tutti i mesi 2021-2024.
- Restano per le prossime sessioni: caricamento Clarino + confronto totale 8.170,94 (serve deploy),
  era 2011-2016 da censire via OCR, i 3 quesiti per l'avvocato (ricostruzioni 2017-2020, era vecchia, 2025-26).
# Audit tecnico progetto — 12/07/2026

> **Obiettivo:** analizzare architettura, qualità del codice, test, sicurezza e manutenibilità
> senza modificare il comportamento dell'applicazione; produrre osservazioni verificabili e una
> roadmap ordinata per impatto/rischio.

- [x] 1. Mappare struttura, dipendenze, flussi principali e confini frontend/backend.
- [x] 2. Valutare qualità TypeScript/React, complessità, duplicazioni e debito tecnico.
- [x] 3. Verificare test, type-check, build e segnali quantitativi (dimensioni/moduli critici).
- [x] 4. Auditare autenticazione, Supabase/RLS, segreti, funzioni server e trattamento documenti.
- [x] 5. Sintetizzare punti di forza, criticità e miglioramenti prioritizzati con evidenze.
- [x] 6. Aggiungere una review finale con verifiche eseguite e limiti dell'analisi.

### Review — audit tecnico 12/07/2026

- Gate locali: `npx tsc --noEmit` **OK** · Vitest **325/325** (23 file) · build Vite **OK**.
- Struttura: ~45k righe TS/TSX/SQL, 136 sorgenti TS/TSX; motori di dominio puri e ben testati,
  profili centralizzati, demo isolata e code splitting già efficace. Chunk App sceso a 882 kB
  (227 kB gzip), ma restano warning >500 kB e CSS da 467 kB.
- Priorità critica di correttezza: l'auto-sync debounce di `useWorkers` aggiorna il ref prima del
  flush e cancella il timer precedente; modifiche rapide a worker diversi possono lasciare il primo
  cambiamento solo in memoria. Serve dirty queue per id + retry/feedback, con test di regressione.
- Priorità critica di sicurezza/costi: tutte le Netlify Functions AI sono prive di autenticazione;
  CORS è `*`, il rate limit è best-effort in-memory e `ask-ai`/`verify-payslip` non lo applicano.
  `verify-payslip` effettua inoltre `fetch(pdfUrl)` su input arbitrario (SSRF/download senza cap).
- Privacy: la UI dichiara «Nessun dato viene ceduto a terzi», ma cedolini/anagrafiche sono inviati
  a Gemini; alcuni log duplicano dati personali. Informativa e minimizzazione vanno riallineate.
- Supabase: RLS generalmente ben documentata, incluso hardening del QR; restano accessi viewer
  globali per UID, scoping organizzazione fail-open lato client e policy Storage principali non
  ricostruibili interamente dalle migration. Il canale QR consente SELECT anon del payload (incluso
  base64) a chi conosce un session id attivo.
- Manutenibilità: 25 file oltre 500 righe; picchi `DynamicIsland` 2329, `MonthlyDataGrid` 1922,
  `DashboardPage` 1649. Circa 280 `any` in 60 file, TypeScript non-strict, nessun ESLint/coverage/E2E.
  La CI esegue type-check+test ma, nonostante il nome, non `npm run build`.
- Prodotto: Incidenza e Riposi sono maturi; Indennità è ancora un prototipo con seed/placeholder e
  stato/coefficiente solo in memoria, mentre la migration 021 è dichiarata non applicata.
- Limiti: audit statico + gate locali; nessun accesso al DB live/advisor Supabase, ai log Netlify,
  alle metriche real-user o ai flussi autenticati owner/viewer. Nessuna modifica funzionale eseguita.

---

# Piano — Web app mobile/PWA condiviso con Fable — 16/07/2026

> **Obiettivo:** preparare una specifica verificabile da sottoporre a Fable (Claude Code) prima di
> autorizzare l'implementazione della versione smartphone.

- [x] 1. Verificare la baseline mobile attuale con audit statico e viewport 390×844.
- [x] 2. Separare il prodotto in scanner, consultazione, modifica mirata ed editing analitico.
- [x] 3. Definire fasi, dipendenze, criteri di accettazione, rischi privacy/cache e gate desktop.
- [x] 4. Definire collaborazione: Fable implementer principale, Codex reviewer indipendente.
- [ ] 5. Ricevere la valutazione di Fable senza avviare implementazione.
- [ ] 6. Concordare con l'utente scope e prima tranche.

**Piano completo:** [`tasks/piano-web-app-mobile-fable-2026-07-16.md`](piano-web-app-mobile-fable-2026-07-16.md)

### Review — preparazione handoff

- Documento verificato contro i file e le misure raccolte nell'audit mobile del 16/07.
- Include gate distinti per scanner, consultazione, gestione mirata ed editing analitico.
- La cache PWA è limitata allo shell pubblico: documenti, payload autenticati e funzioni restano esclusi.
- La prima azione richiesta a Fable è una review architetturale senza implementazione.
- `git diff --check` OK; nessun file applicativo modificato e nessun gate runtime necessario per questa tranche documentale.

---

# Todo — Sessione 16/07 (sera): PWA mobile — tranche 1b "manifest e install"

> **Contesto:** tranche 1 chiusa e committata (`b3dfde3`, locale). Scope 1b dal piano §Fase 1:
> normalizzare manifest/icone, decidere l'install dall'entry QR, nessun service worker
> (default confermato, nessun requisito emerso).
>
> **Stato ricognizione (fatti misurati):**
> - `manifest.json`: icone 192/512 con `purpose: "any maskable"` COMBINATO; le PNG sono
>   trasparenti con simbolo a tutto canvas (bbox orizzontale 0→512, zero safe-zone) → come
>   maskable Android ritaglia il simbolo e il fondo è indefinito.
> - `apple-touch-icon.png` (180×180): 74% pixel trasparenti → iOS compone su NERO, il navy
>   dell'anello quasi sparisce. Va rigenerata opaca (lezione 14/07: alpha interni a 255).
> - Nessuna gestione `beforeinstallprompt` nel codice (grep completo).
> - `start_url: "./"` con manifest in root → risolve su `/` (login/app completa).

## Piano (approvato dall'utente il 16/07 sera; decisioni: icona = logo BIANCO su navy #1E3A5F,
## install da QR = accettare documentando)

- [x] 1. **Icone maskable dedicate** generate da `icon-512.png`: `icon-maskable-512.png` +
      `icon-maskable-192.png`, sfondo pieno navy `#1E3A5F`, simbolo BIANCO centrato nella
      safe-zone (cerchio Ø 80%). → verificato: script numerico (mode RGB = 0 trasparenze;
      peggior angolo del bbox 200.3 vs limite 204.8 a 512px, 75.5/76.8 a 192) + anteprima
      composta su bianco/chiaro/scuro con maschera circolare e angoli iOS (lezione 14/07).
- [x] 2. **`apple-touch-icon.png` rigenerata opaca** (180×180, stesso design; prima 74%
      trasparente → iOS componeva su nero). → verificato: stesso script (71.0/72.0).
- [x] 3. **Manifest normalizzato**: `purpose` separati (`any` = PNG trasparenti esistenti,
      `maskable` = nuove), aggiunti `id: "/"`, `lang: "it"`, `description`; `background_color`
      invariato `#f0fdfa`. → JSON valido, riletto da `dist/` dopo il build.
- [x] 4. **Install da entry QR**: ACCETTATA DOCUMENTANDO (decisione utente, 0 righe) —
      motivazione registrata nel piano §Fase 1 tranche 1b.
- [x] 5. **Gate**: tsc pulito · vitest 344/344 · build ok con icone+manifest in `dist/` ·
      review Codex indipendente = **GO con follow-up, nessun P0/P1** (2 P2: collaudo standalone
      posticiato per scelta; registro sessione da aggiornare → fatto con questo edit).
- [ ] 6. **Collaudo standalone reale** (nome/icona/colori all'avvio installato): richiede HTTPS
      → POSTICIPATO al prossimo deploy batched (follow-up Codex, resta il criterio di chiusura
      finale della Fase 1 lato utente).

**Fuori scope (rispettato):** service worker (anche pass-through), modifiche a viste/CSS,
`viewport-fit=cover`. Diff applicativo = solo `public/` (manifest + 3 PNG): zero TS/TSX toccati.

## Review tranche 1b (16/07 sera)

**Diff: 1 file di testo (`public/manifest.json`) + 3 PNG rigenerati/nuovi in `public/`.
Zero codice applicativo, zero dipendenze, zero service worker.**

- Icone generate con script deterministico (PIL) da `icon-512.png`: versione bianca del
  simbolo = riempimento bianco sull'alpha originale (stesso principio del pattern CSS
  `brightness-0 invert` già usato in-app per il logo su fondo scuro).
- Verifica anti-lezione-14/07: nessun pixel semitrasparente interno (canvas RGB opaco),
  resa controllata su tre fondi + maschera circolare Android + angoli arrotondati iOS.
- `index.html` invariato: già puntava a `/apple-touch-icon.png` e `/manifest.json`; le favicon
  browser restano le trasparenti (corretto: lì il fondo lo dà la tab del browser).
- Rischio residuo: resa reale su launcher iOS/Android verificabile solo dopo deploy HTTPS
  (item 6). Rollback: revert di 4 file in `public/`.

---

# Todo — Sessione 16/07 (notte): PWA mobile — Fase 2 "consolidamento scanner"

> **Contesto:** tranche 1 (`b3dfde3`) e 1b (`3ce8d0d`) chiuse, locali. Scope Fase 2 dal piano:
> rendere production-ready il flusso QR→telefono→upload. Vincoli architetturali da memoria
> `qr-scanner-architecture`: NON tornare al polling, payload via INSERT su `scan_results`,
> mode deciso dal telefono, fetch con AbortController+timeout, RLS strict intoccabile.
>
> **Ricognizione (fatti dal codice, `pages/MobileUploadPage.tsx` 681 righe):**
> - GIÀ a posto: compressione con cap documentati (1100×1500 q0.55; stitch max 1100×4200),
>   wake lock con avviso se non supportato, timeout client 55s + 1 retry di rete, batch id
>   collision-safe, fine-batch onesto (0 successi ≠ "completato"), object URL con revoke.
> - BUCHI vs criteri Fase 2:
>   (a) fascicoli FALLITI CANCELLATI a fine giro (`setDocuments([])` a riga ~456/468/474
>       anche con failCount>0) → l'utente perde le foto e deve rifarle;
>   (b) nessuno stato per-fascicolo: impossibile sapere QUALI sono riusciti/falliti/da inviare;
>   (c) sessione assente/invalida/scaduta/chiusa: nessuna schermata esplicita (con `!sessionId`
>       il tasto Invia semplicemente non fa nulla; su sessione morta errori criptici per file);
>   (d) nessun indicatore online/offline prima dell'invio;
>   (e) touch target sotto 44px: cestino 32×32, "aggiungi pagina" ~15px di altezza;
>   (f) `min-h-screen` (non dvh) e bottom bar fissa senza padding safe-area.
> - Lato PC (`QRScannerModal`): status gestiti `waiting/processing/file_done/all_done/error`;
>   alla chiusura la riga viene CANCELLATA; TTL 2h; RLS UPDATE anon `USING expires_at>now()`.

## Piano (approvato; ESEGUITO col percorso reale sotto — lo scope è cresciuto su
## evidenza: 2 decisioni utente in corsa per RLS/migration)

- [x] 1. **Stato sessione esplicito** (`checking → valid | dead`): probe al mount via RPC
      `is_active_scan_session` (read-only, zero eventi Realtime); `!sessionId` → schermata
      subito. Sentinella a metà giro = ritorno FOUND della RPC `touch_scan_session` +
      classificazione 42501 sull'INSERT. *(Il design originale UPDATE+count è stato
      SCARTATO in review: vedi Review, P0 RLS.)*
- [x] 2. **Stato per-fascicolo** (`ready | sending | sent | failed`+`errorMsg`): badge per
      riga, retry naturale, `setDocuments([])` eliminato dai percorsi con falliti; il timer
      del successo rimuove SOLO i `sent`. In più (review): handshake `all_done` verificato
      con ack + stato `handshakePending {sent,failed}` e bottone "Conferma invio al PC".
- [x] 3. **Online/offline**: listener + banner ambra `role=status` + Invia disabilitato.
- [x] 4. **Touch target ≥44px su coarse**: cestino 44px, "aggiungi pagina" `min-h-11`
      (niente margini negativi: overlap con l'input), input titolo `min-h-11` +
      `focus-visible:outline`.
- [x] 5. **dvh + safe-area**: `min-h-dvh` (pagina, readonly, schermata dead) + utility
      `pb-safe-6` sulla bottom bar.
- [x] 6. **Compressione**: nessun cambio, cap già documentati (1100×1500 q0.55; stitch
      1100×4200) — criterio già soddisfatto; stitch però ora revoca gli object URL in
      `finally` e "aggiungi pagina" è nascosto sui fascicoli PDF (stitching Image-only).
- [x] 7. **Gate**: tsc pulito · vitest 344/344 · build ok, ad OGNI giro (6 giri).
      Review Codex: 6 giri, chiusa dall'utente al 6° («basta chiedere a codex»).
- [ ] 8. **Collaudo utente su telefono reale** (fotocamera posteriore, galleria, PDF,
      batch, retry, sessione scaduta) — DA FARE (deploy o LAN).

## Review Fase 2 (16-17/07, notte)

**Diff finale: `MobileUploadPage.tsx` + `QRScannerModal.tsx` + `IslandContext.tsx` +
`index.css` (1 utility) + migrations `027` e `028` (APPLICATE al DB live, decisione utente).**

**Il percorso (6 giri di review, 2 scoperte grosse):**
1. Giro 1-2 — Codex boccia il probe UPDATE+count (P0): "serve la SELECT policy". La mia
   verifica EMPIRICA sul DB live (riga di test + client anon reale) gli dà ragione e
   scopre di più: **il canale di stato telefono→PC era GIÀ ROTTO in produzione** da
   migration 012 (30/05) — UPDATE anon = 0 righe silenziose (204). Mascherato perché: i
   payload viaggiano su INSERT (funzionante) e un telefono loggato come owner passa dalla
   SELECT owner-scoped. Regola Postgres: un UPDATE con WHERE legge le righe → serve ANCHE
   visibilità SELECT oltre alla USING dell'UPDATE.
2. Migration **027** (policy SELECT anon gated da `is_active_scan_session(id)`) applicata
   e SUBITO superata: giro 3 Codex — la USING per-riga non prova la conoscenza dell'id →
   **enumerazione di tutte le sessioni vive** + stessa falla nella policy della 010 sui
   payload (`scan_results`). Migration **028**: RPC `touch_scan_session` SECURITY DEFINER
   (status/mode whitelistati, p_id esplicito, RETURN FOUND = sentinella), revoca
   SELECT/UPDATE anon su scan_sessions (chiude anche il blanket-update della 008), DROP
   della SELECT anon sui payload (js v2 = INSERT minimal). Test empirico 9/9 post-028.
3. Giri 4-6 — protocollo terminale PC: dedup all_done (guard con evidenza batch),
   serializzazione dei due canali Realtime (coda promise), attesa bounded del conteggio
   `sent` dichiarato dal telefono + riconciliazione dalla tabella al timeout, snapshot
   spostato DOPO la subscribe (duplicati deduplicati invece di buchi), finishTimer
   dell'Island annullato da startUpload, startUpload immediato (l'animazione resta
   ritardata), CAS sui reset (`.eq('status', <terminale>)`), guard `isClosing` dedicato
   in triggerClose (prima watchdog/X non chiudevano MAI a upload in corso — bug
   pre-esistente).

**Limiti accettati (documentati, non fix):** doppio all_done nella finestra 2s pre-reset
(richiede commit+risposta persa+tap conferma <2s; esito = doppio toast, CAS protegge il
DB); X nascosta durante l'upload (design: la superficie di controllo è l'Island).

**Bug pre-esistenti risolti di passaggio:** canale stato anon rotto (012), blanket-update
anon possibile (008), enumerazione payload anon (010), watchdog/X che non chiudevano il
modal a upload in corso, Island inchiodata su batch <500ms, leak object URL nello stitch
fallito, "aggiungi pagina" su fascicoli PDF (stitch impossibile).

**Fuori scope rispettato:** niente persistenza offline, niente polling, niente service
worker. QRScannerModal/RLS SONO stati toccati — scope ampliato con decisione utente
esplicita (fix RLS) e su requisito del piano (retry ⇒ esito non terminale lato PC).

**Rischio residuo:** collaudo su telefono reale mancante (item 8); rollback codice =
revert 4 file; rollback DB = ripristino policy 008/010 (sconsigliato: riaprirebbe i buchi).
