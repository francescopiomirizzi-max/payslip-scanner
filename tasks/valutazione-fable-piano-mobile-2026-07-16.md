# Valutazione Fable — Piano web app mobile / PWA Valora

> Risposta alla Fase 0 di [piano-web-app-mobile-fable-2026-07-16.md](piano-web-app-mobile-fable-2026-07-16.md).
> Verificata contro il codice reale il 16/07/2026. Nessuna implementazione eseguita.

## Valutazione Fable

### Verdetto

**GO CON MODIFICHE**

Il piano è di qualità sopra la media: la baseline è quasi tutta confermata dal codice, i principi
(una codebase, CSS non basta per le viste dense, desktop invariato, offline limitato) sono giusti.
Le modifiche necessarie riguardano: due pezzi di prodotto che il piano non vede (le **altre aree
dell'app** e la **modalità viewer**), una strategia PWA più semplice di quella ipotizzata, e una
Fase 1 da sfoltire.

### Correzioni al piano

1. **L'inventario copre solo l'area Incidenza — l'app ne ha tre.** `components/AreaSwitch.tsx:5`
   definisce `'incidenza' | 'riposi' | 'indennita'`; esistono inoltre la scelta organizzazione
   (`components/SindacatiDashboard.tsx`), `pages/CompanyPage.tsx`, `components/VertenzeArea.tsx`,
   `components/RiposiArea.tsx`, `components/StatsDashboard.tsx` — tutti con `h-screen`/layout desktop
   e tutti assenti dalla tabella §6. Il "Livello B — Consultazione" va scopato per area: prima
   release = **solo Incidenza**, le altre esplicitamente desktop-only (ma da smoke-testare a ogni
   tranche, perché condividono AreaSwitch, DynamicIsland e index.css).

2. **Il piano ignora la modalità viewer (Vincenzo).** `App.tsx:70` (`useIsReadOnly`), `App.tsx:74-81`
   (il viewer bypassa la dashboard org), `App.tsx:103` (`useViewerPaymentBlock`). Il viewer readonly
   è l'utente "consultazione pura" — esattamente il profilo del Livello B, e il più probabile
   utilizzatore da telefono. Ogni tranche B va verificata **anche in modalità viewer** (blocco
   pagamento incluso).

3. **AreaSwitch non è "una barra fissa con etichette complete".** È già una pillola compatta fissa
   in basso a sinistra (`components/AreaSwitch.tsx:45`) con bottoni icona da 36px (`w-9 h-9`,
   riga 52) ed etichetta solo sulla voce attiva. I problemi mobile reali sono: target sotto i 44px
   e possibile sovrapposizione col contenuto in fondo pagina. Trasformarla in bottom navigation
   (Fase 1) è un redesign di prodotto non necessario alla prima release → declassare a opzione da
   valutare in Fase 3.

4. **L'installabilità c'è già quasi tutta: il service worker non serve per installare.**
   `index.html:16-19` (manifest, apple-touch-icon, theme-color, viewport) e `public/manifest.json`
   (nome, icone 192/512, `standalone`) sono a posto; Android Chrome e iOS "Aggiungi a Home"
   installano senza SW. Il costo vero della Fase 1 è il criterio **"shell riapribile senza rete"**
   (richiede precache di index.html + chunk JS). Per un tool interno online-only (dati Supabase,
   OCR via function) vale poco e apre il fronte asset-stale → proporrei di **eliminarlo** (vedi
   decisioni). Precedente interno: il gestionale CAF gemello è una PWA installabile con SW
   pass-through **senza alcuna cache**, zero dipendenze nuove.

5. **Manifest: `purpose: "any maskable"` combinato su entrambe le icone** (`public/manifest.json`).
   La normalizzazione proposta dal piano è corretta. Aggiungere però un caso non previsto: un
   telefono che installa la PWA **dalla pagina QR** (`?mobile=true`) si ritrova `start_url: "./"`,
   cioè il gestionale desktop con login. Da decidere in Fase 1: sopprimere l'install sull'entry
   mobile, dare uno scope dedicato, o accettare documentando.

6. **Font Google esterni** (`index.html:22-25`): con una shell offline i font mancherebbero; se
   cacheati nel SW si apre la cache cross-origin. Un motivo in più per rinunciare all'offline (o
   self-hostare i font prima, come pre-requisito esplicito).

7. **`capture="environment"` in `pages/MobileUploadPage.tsx:624` è corretto, non "correggerlo".**
   È un input dedicato al bottone fotocamera, separato da quello galleria/PDF: la scelta all'utente
   resta. (Nel progetto gemello forzare `capture` era un errore perché l'input era unico — la
   lezione non si trasferisce meccanicamente.)

8. **Fase 6 E2E: sproporzionata così com'è.** Il repo ha vitest+jsdom con test di motore
   (`__tests__/`), zero infrastruttura browser: "test E2E dei percorsi critici mobile" significa
   introdurre Playwright — un progetto a sé. Per un tool interno con due utenti: protocollo di
   verifica manuale scritto (la matrice viewport di Fase 6 va benissimo) + misure DOM scriptate
   (`document.scrollWidth` vs `innerWidth`, visibilità reale via `offsetParent`) come già praticato.
   E2E declassato a opzionale futuro.

9. **Baseline confermata nei punti chiave** (do atto al piano di essere accurato):
   - nessun service worker/workbox nel repo (grep su tutto il codice: zero occorrenze) ✓
   - split lazy `?mobile=true` (`index.tsx:13-18`) ✓
   - DynamicIsland a larghezze fisse 500/420 (`components/DynamicIsland.tsx:73-79`; anche 90/190/300
     a riga 714) → a 390px sborda nei mode ai/menu ✓
   - `h-screen`/`min-h-screen` in 16 file, **zero** `dvh` in tutto il repo ✓ (es.
     `pages/ArchivePage.tsx:422`, `components/WorkerDetailLayout.tsx:31`)
   - Archivio a colonne fisse `w-72` (`pages/ArchivePage.tsx:476`) ✓
   - azioni solo-hover (`components/WorkerCard.tsx:525`, `opacity-0 group-hover:opacity-60`) e card
     flip (`WorkerCard.tsx:264,461`) ✓
   - griglia mensile `minWidth = colonne × 100px` (`components/WorkerTables/MonthlyDataGrid.tsx:1367`)
     → i ~2.900px misurati sono plausibili; nota: la griglia è già dentro `overflow-x-auto`
     (riga 1344), quindi lo scroll è confinato — il lavoro di Fase 4 è di **gerarchia di
     navigazione**, non di overflow globale, coerente col principio 2 del piano ✓
   - report `max-w-[1400px]` (`components/TableComponent.tsx:434`) → i ~1.586px interni sono plausibili ✓

10. **Auth e QR: il quadro reale.** L'auth è Supabase Auth vera (`hooks/useAuth.ts:58`,
    `signInWithPassword`) con sessione persistita → funziona in PWA standalone senza lavoro extra.
    Il flusso QR invece scrive su `scan_sessions` col **client anon senza login**
    (`pages/MobileUploadPage.tsx:365`): il rischio "QR anonimo" citato dal piano è reale ma
    **pre-esistente** — in Fase 2 verificare TTL della sessione, non-indovinabilità dell'id e
    policy RLS su `scan_sessions`, senza attribuirlo al lavoro mobile.

### Decisioni architetturali consigliate

- **Niente `vite-plugin-pwa`/Workbox: SW minimale o nessun SW** (domande §8.3-4). I dati sono
  cedolini: il modo più robusto di non cachearli è **non avere cache**. Manifest + HTTPS bastano per
  l'install; se serve un fetch handler, SW pass-through di ~10 righe. Senza cache, l'intero update
  flow di Fase 1 ("nuova versione, refresh controllato, upload non interrotto", domanda §8.5)
  decade per costruzione: il deploy Netlify torna a essere l'unico meccanismo di aggiornamento,
  come oggi. (Compatibilità: `vite-plugin-pwa` ≥0.21 supporta Vite 6 — `package.json` ha
  `vite ^6.2.0` — ma non è questo il punto: è complessità non ripagata.)
- **Composizione, non fork** (domanda §8.1): layout mobile dedicati solo dove cambia la gerarchia
  (Archivio drill-down, scheda lavoratore); breakpoint/CSS dove la struttura regge (login,
  dashboard, scanner). Un helper condiviso (`pointer: coarse` / larghezza) + utility `dvh` e
  `safe-area-inset-*` in `index.css`.
- **Griglia mensile** (domanda §8.2): il confine anti-duplicazione è "stessi dati e stesse funzioni
  di update passati per props, altra presentazione". La vista mobile (elenco mesi → dettaglio mese)
  è un componente di sola presentazione che consuma gli stessi hook/callback oggi passati a
  `MonthlyDataGrid`. Mai un secondo motore, mai copiare le formule.
- **Scope release** (domande §8.6-7): A+B come propone il piano, con B = **area Incidenza +
  modalità viewer**. C si progetta dopo aver visto l'uso reale su telefono. D fuori, confermando §2.
- **Breakpoint misurati, non "a naso"** (lezione dal progetto gemello, 16/07/2026): la soglia
  vista-mobile/vista-desktop si ricava misurando la larghezza che il contenuto **chiede**
  (`scrollWidth` vs `clientWidth` a più viewport), non dal breakpoint che suona giusto. Lì la
  tabella chiedeva ~1220px e la soglia giusta era `lg`, non `sm`; qui le griglie chiedono ~2.900px.
  E il **tablet è touch**: stessi target ≥44px del telefono.

### Rischi non coperti

- **P0 — Documenti sensibili in Cache Storage** — principio già nel piano (§4.4), evidenza del
  perimetro: `pages/MobileUploadPage.tsx` (base64 cedolini), Archivio con URL firmati — mitigazione:
  adottare "niente cache" (sopra), così il rischio decade per costruzione; se un domani si introduce
  precache, ispezione manuale di Cache Storage con documento aperto e dopo logout a ogni tranche.
- **P1 — Modalità viewer fuori dal piano** — `App.tsx:70,74-81,103` — rischio: consegnare il
  Livello B rotto proprio per l'utente consultazione (incluso l'avviso di pagamento bloccante) —
  mitigazione: viewer nella matrice di verifica di ogni tranche B.
- **P1 — Aree Riposi/Indennità/Vertenze fuori inventario** — `components/AreaSwitch.tsx:5`,
  `components/RiposiArea.tsx`, `components/VertenzeArea.tsx` — rischio: regressioni non viste su
  superfici condivise (AreaSwitch, DynamicIsland, index.css) — mitigazione: smoke test desktop di
  tutte le aree in ogni tranche.
- **P2 — Install PWA dall'entry QR** — `index.tsx:16` + `public/manifest.json` `start_url: "./"` —
  rischio: il telefono installa "Valora" e si ritrova il login desktop — mitigazione: decisione
  esplicita in Fase 1 (sopprimere/scope/accettare).
- **P2 — Sessioni QR anonime** — `pages/MobileUploadPage.tsx:365` (update su `scan_sessions` con
  client anon) — rischio pre-esistente: id di sessione come unica barriera — mitigazione: in Fase 2
  verificare policy RLS, TTL e generazione dell'id.
- **P2 — `h-screen` su iOS** — 16 file, zero `dvh` — rischio: viewport instabile con barra
  Safari/tastiera — mitigazione: utility `dvh` in tranche 1, applicata **solo** ai file toccati
  dalle tranche mobile, niente find&replace di massa.

### Prima tranche proposta

**"Shell mobile sicura"** — rimuove i blocker trasversali del telefono senza SW, senza nuove
dipendenze e senza toccare le viste dense.

- **Scope incluso:**
  - utility condivise in `index.css`: `dvh`, `safe-area-inset-*`, helper touch (`pointer: coarse`);
  - `DynamicIsland` viewport-bound: larghezze clampate a `min(<attuale>, 100vw - margine)`
    (`components/DynamicIsland.tsx:73-79,714`);
  - `AreaSwitch`: target ≥44px su touch e verifica che non copra contenuti in fondo pagina
    (`components/AreaSwitch.tsx:45-52`);
  - azioni della `WorkerCard` oggi solo-hover sempre visibili su coarse pointer
    (`components/WorkerCard.tsx:525`);
  - passata di misura su Login + Dashboard Incidenza a 390px (inclusa modalità viewer) con fix
    puntuali di overflow se emergono.
- **Scope escluso:** service worker e caching, manifest/icone, bottom navigation, Archivio
  drill-down, scheda lavoratore mobile, report mobile, aree Riposi/Indennità, E2E.
- **File previsti:** `index.css`, `components/DynamicIsland.tsx`, `components/AreaSwitch.tsx`,
  `components/WorkerCard.tsx`, eventuale `hooks/useIsMobile.ts` (nuovo), ritocchi mirati a
  `pages/DashboardPage.tsx` solo se la misura li richiede.
- **Criteri di accettazione:**
  - a 360/390/430px: `document.documentElement.scrollWidth ≤ innerWidth` su Login e Dashboard;
    Island mai più larga del viewport in **tutti** i mode; azioni card raggiungibili senza hover;
    target AreaSwitch ≥44px;
  - a 1280px e oltre: resa desktop invariata (Island alle larghezze attuali, hover identico a oggi,
    nessun cambio di layout) — la verifica deve dimostrare anche ciò che **non** è cambiato;
  - modalità viewer consultabile a 390px;
  - smoke test desktop su Riposi e Indennità (condividono i componenti toccati);
  - `npx tsc --noEmit` + `npm test` + `npm run build` verdi.
- **Stima: S/M** — S se la dashboard regge come da baseline, M se le card nascondono overflow interni.

**Stime relative delle fasi successive** (richieste dalla Fase 0): manifest/icone + eventuale SW
pass-through = **S** · Fase 2 scanner = **S** (per lo più verifica su dispositivo reale + edge case
sessione) · Fase 3 dashboard = **M** · Fase 4 scheda lavoratore = **L** (la più grossa, da spezzare
in sotto-tranche) · Fase 5 report + archivio = **M/L**. Dipendenze: tranche 1 → Fase 3 → Fase 4/5;
Fase 2 è indipendente e può scorrere in parallelo.

### Domande per l'utente

1. Confermi la prima release = **A+B con B limitato all'area Incidenza** (+ modalità viewer)?
   Riposi/Indennità/Vertenze restano desktop-only per ora.
2. La **shell offline** ("app riapribile senza rete") ti serve davvero, o basta installabile +
   online-only? La mia raccomandazione è la seconda: niente cache → niente rischio privacy e
   niente update flow da progettare.
3. Chi è l'utente mobile primario della consultazione: **tu o Vincenzo (viewer)**? Cambia le
   priorità di Fase 3/4 (e Vincenzo oggi è anche soggetto al blocco pagamento).
