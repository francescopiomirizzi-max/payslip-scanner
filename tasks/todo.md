# PIANO — Multi-Sindacato/CAF: dashboard di selezione + scoping pratiche per organizzazione (2026-07-04)

> **STATO: 🟢 GIRO 1 ESEGUITO (05/07) — decisioni prese (vedi in fondo). Resta il GIRO 2 (scoping aree + bypass viewer + hash routing organizzazione).**
> Richiesta utente: rendere il sito **generale**, non ristretto al Consaf di Vincenzo. L'owner apre il sito su una
> **dashboard di selezione Sindacato/CAF**; scelto uno, entra nelle 3 aree (Incidenza/Riposi/Indennità) **filtrate
> per quel sindacato**. Il **viewer Vincenzo** invece bypassa e apre direttamente le sue sezioni Consaf (com'è ora).

## Modello mentale (verificato nel codice)
- Oggi **nessun concetto di sindacato/CAF**: `Worker.profilo` = **azienda datrice** (RFI/Elior/Trenitalia/Mercitalia/Clean
  Service), NON il sindacato. Tutte le pratiche sono implicitamente **FAST-CONFSAL** (Vincenzo).
- **Azienda ≠ Sindacato**: un sindacato/CAF commissiona pratiche di lavoratori di più aziende. Nuovo livello SOPRA le aree.
- Le aree oggi vivono in `App.tsx` (`area` = incidenza/riposi/indennita); il sindacato è un livello sopra `area`.

## Fase 1 — Dato (migration) — ✅ APPLICATA AL DB LIVE 05/07
- [x] Tabella `sindacati` (id, nome, tipo `sindacato|caf`, logo_url, colore/tema, owner_id, created_at).
- [x] `sindacato_id` FK su `worker_profiles`, `pratiche_riposi` (+ index). `pratiche_vertenze` NO: la 021 non è
      applicata al live → la sua colonna va aggiunta dentro la 021 quando verrà eseguita (nota già nella 022).
- [x] Backfill verificato via SQL: 1 sindacato FAST-CONFSAL, 39/39 worker_profiles + 1/1 pratiche_riposi collegati.
- [x] RLS modello 019: SELECT owner O viewer (UID Vincenzo), scritture owner E NON viewer, `(select auth.uid())`
      anti-initplan. Advisor security/performance post-apply: nessun warning nuovo.

## Fase 2 — Entry point owner: "Dashboard ValOra" (la base del sito) — 🟢 PROTOTIPO UI FATTO (04/07, dati client)
- [x] `components/SindacatiDashboard.tsx`: header brand + **due macro-pannelli Sindacati / CAF** (da mockup utente),
      ognuno con card organizzazione (logo) + slot "+ aggiungi"; **riepilogo pratiche recenti** con dati REALI (workers);
      click organizzazione → **popup sezioni** (portal) → un click e si è dentro. Icone+gradiente (no illustrazioni AI).
- [x] `App.tsx`: stato `sindacatoAttivo` SOPRA `area`; owner parte dalla dashboard, **viewer bypassa** (FAST-CONFSAL fisso);
      `AreaSwitch` con pulsante "Cambia organizzazione" (owner). Dati client `ORGANIZZAZIONI` (solo FAST-CONFSAL sindacato).
- **NOVITÀ dai mockup:** due TIPI di organizzazione — **sindacato** (vertenze: le 3 aree attuali) e **CAF** (fiscale:
      730/ISEE/redditi = sezioni NUOVE, in arrivo). Il CAF conferma "aree diverse per organizzazione". La migration 022
      ha già `tipo CHECK ('sindacato','caf')` → coerente.
- [x] **Collegamento al DB (05/07):** nuovo `hooks/useSindacati.ts` (osserva auth come useWorkers, anti double-fire;
      demo/errore/tabella vuota → fallback client FAST-CONFSAL, fail-open). `App.tsx` usa l'hook al posto della
      const `ORGANIZZAZIONI`; dashboard non renderizzata finché le organizzazioni caricano (no flash pannelli vuoti).
- [ ] Restano: hash routing del livello organizzazione (giro 2); sezioni CAF (fiscale) future.

## Fase 3 — Scoping delle aree
- [ ] Scelto un sindacato, `useWorkers`/`usePraticheRiposi`/`usePraticheVertenze` filtrano per `sindacato_id`.
- [ ] Aree senza pratiche di quel tipo → **[DECISIONE 2]** nascondi vs mostra-vuota.

## Fase 4 — Viewer Vincenzo (bypass)
- [ ] Il viewer salta la Dashboard Sindacati → `sindacatoId` fisso = FAST-CONFSAL; entra diretto sulle aree (com'è ora).
      L'endorsement "Ufficio Vertenze + FAST-CONFSAL" già presente diventa coerente col sindacato attivo.

## Fase 5 — Gestione sindacati — **[DECISIONE 1]**
- [ ] Solo seed FAST-CONFSAL ora (gli altri li aggiungi tu quando arrivano) **oppure** UI crea/modifica (nome+logo+colore).

## Fase 6 — Verifica
- [ ] tsc/test/build; owner: scelta → area filtrata; viewer: bypass diretto; nessuna regressione.

## DECISIONI — prese il 05/07
1. **Gestione sindacati**: solo seed FAST-CONFSAL ora; la UI crea/modifica arriva quando arrivano organizzazioni vere.
2. **Aree vuote**: si MOSTRANO vuote (si vede cosa offre la piattaforma; si crea la prima pratica da lì).
3. **Granularità**: PER GRADI — giro 1 = migration+backfill+dashboard su DB (fatto); giro 2 = scoping + bypass viewer.

### Review — GIRO 1 (2026-07-05) · gate: tsc=0 · 253 test · build ok
- **DB live**: migration 022 applicata via MCP dopo il fix RLS (la bozza aveva SELECT owner-only: il viewer non
  avrebbe letto il sindacato per bypass/scoping → allineata al modello worker_profiles/019, scritture negate al viewer).
  Pre-check: tabella assente, 1 owner, 39 worker, 1 pratica riposi → post-apply: backfill completo (39/39 + 1/1).
- **Client**: `hooks/useSindacati.ts` nuovo (sola lettura, mapping row→`OrganizzazioneInfo`, sezioni per tipo:
  sindacato=3 aree, caf=[]); `App.tsx` −const ORGANIZZAZIONI, +hook, +gate anti-flash sul render della dashboard.
- **Nota giro 2**: il bypass viewer usa ancora la sentinella `'fast-confsal'` (non l'uuid DB) — da risolvere quando
  lo scoping filtrerà per `sindacato_id`; i worker/pratiche creati d'ora in poi NON hanno `sindacato_id` (client non
  lo scrive ancora) → al giro 2 il client lo imposta alla creazione + re-run del backfill idempotente.
- **Verifica visiva** = utente (login owner: dashboard con FAST-CONFSAL dal DB; login viewer: bypass invariato).

---

# PIANO — Rebrand sito → Valora (logo Variante 1 + palette) + dicitura "Ufficio Vertenze FAST-CONFSAL" nella vista Vincenzo (2026-07-03)

> **STATO: 🟢 IN ESECUZIONE (OK utente "procedi, lavoro fatto per bene", 03/07).**
> Ripresa del rebrand. Nome **Valora** confermato (supera "Vertezze"; il sito mostra ancora "RailFlow").
> Logo scelto: **Variante 1** (nuovo simbolo VO con figura umana) + **wordmark/lockup di ieri**.
> L'utente sta producendo **mockup su Google Flow** in parallelo → possono orientare hero/lockup (fuori dal mio scope).

## Preparazione già fatta (scratchpad, non-distruttiva)
- **Simbolo ritagliato** dalla Variante 1 (`valora-simbolo.png`, sfondo trasparente, autocrop) — pulito su chiaro.
- **Silhouette BIANCA** per il dark (`valora-simbolo-bianco.png`) — ✅ **verificata leggibile** su navy `#1E3A5F`
  e su slate-900 `#0F172A` (i solchi interni tengono la struttura, nessun alone).
- **favicon 512 quadrata** derivata.
- **Palette dai PIXEL reali** (per copertura): petrol `#2C5765`, verde-salvia `#58A38D`, **navy `#223A5D`**,
  teal `#399D8D`, verde-teal `#45755E`, **verde chiaro `#71C994`**, petrol chiaro `#347384`.

## Decisioni prese (03/07)
1. **Nome Valora CONFERMATO** (supera "Vertezze").
2. Dicitura Vincenzo = **"Ufficio Vertenze"** + logo **FAST-CONFSAL** (il file `logofast`). Solo interfaccia.
   Resta da confermare solo la **posizione** (oggi unico viewer = Vincenzo → vale la vista readonly).
3. Rename RailFlow→Valora = **SOLO UI**. I **documenti generati restano invariati** (nessun logo, nessun rename).
4. Versione dark = **silhouette bianca**, derivata da me dal file (✅ fatto).

## Fase A — Asset logo (`public/`)
- [ ] Simbolo trasparente (chiaro) [fatto in scratchpad] → `public/`.
- [x] Versione **dark** = silhouette bianca [fatta in scratchpad, verificata su navy + slate-900].
- [ ] `favicon-32`, `apple-touch-icon`(180), `icon-192`, `icon-512`, `railway-app-icon.svg` col nuovo simbolo.
- [ ] `logo.png` (header/login) → **lockup Valora** (simbolo + wordmark di ieri).
- [ ] `manifest.json`: `name`/`short_name`/`theme_color`.
- Verifica: rendering su chiaro **e** su scuro (lo controllo su file); prova a schermo = utente.

## Spunti dai mockup Flow (03/07) — cosa adottare / cosa NO
La brand board dei mockup fissa 2 hex: **Emerald Teal `#00A388`** + **Navy `#1C355E`**, gradiente primario teal→navy.
Coerente con la palette dai pixel (teal `#399D8D`/petrol `#2C5765`/navy `#223A5D`), solo con un teal-accento più vivo.
- **Adottare:** (1) **chrome scuro navy + logo BIANCO** (header/sidebar/isola in navy `#1E3A5F` con la silhouette bianca);
  (2) **accento teal** `#00A388`/`#2E9E96` al posto dell'indigo per bottoni/tab attivi/focus/link; verde `#71C994` = highlight;
  (3) **gradienti brand** virati da indigo→violet a **teal→navy** (l'app ha già i gradienti, cambia solo l'hue).
- **NON adottare:** NON è un redesign. I mockup inventano hero/illustrazioni/layout nuovi → si ignorano: il sito ha già
  la sua architettura (aree Incidenza/Riposi/Indennità). Rebrand = **nome+logo+colore**, non ricostruire schermate.
- **Conferma dal mockup "Cross-Company Worker Dashboard":** le card lavoratore restano coi **colori-azienda**
  (Elior verde, RFI navy, Trenitalia teal, Mercitalia oro) → ribadisce: brand-app teal/navy, **temi azienda intatti**.
- **Font:** teniamo **Plus Jakarta Sans** (Inter dei mockup è quasi identico, nessun bisogno di cambiare).
- **Attenzione collisione:** il teal-brand e l'**emerald già usato per success/Credito** possono confondersi →
  tenere distinti: **teal = brand/azione**, **emerald = success/denaro**.
- **Doppia modalità logo (coerente col light/dark del sito):** header pubblico/landing **chiaro** con logo a **colori**;
  **chrome dell'app scuro** (sidebar/topbar navy) con logo **bianco** — è già il pattern `CompanyLogo` (`dark:brightness-0 dark:invert`).
- **Descrittore sotto il wordmark:** i mockup mettono una riga sotto "ValOra" ("Dispute Management…"). È lo **slot naturale**
  per l'etichetta whitelabel: nella vista viewer di Vincenzo lì va **"Ufficio Vertenze" + FAST-CONFSAL** (collega Fase D).
- **Status pill colorate** (verde=completed, rosso/rosa=flagged, azzurro=in progress): già coerenti con i nostri badge stato.

## Fase B — Palette (colore BRAND-APP, non i temi aziendali)
Token proposti (riconciliando pixel + brand board):
- **Navy** `#1E3A5F` (chrome scuro, testo, header/sidebar/isola) · **Teal primario** `#00A388` (bottoni/tab/focus/link,
  hover petrol `#2C5765`) · **Verde highlight** `#71C994` · **Gradiente brand** `#00A388 → #1E3A5F`.
- [ ] Distinguere il **brand-app** (oggi indigo `#4f46e5`: isola/bottoni/login/`theme-color`/focus ring)
      dai **temi per-azienda** (blue=RFI, emerald=Clean Service, orange=Elior, ecc.) = identità dei clienti → **NON si toccano**.
- [ ] Sostituire l'indigo brand-app coi token sopra (idealmente via CSS var / palette Tailwind `brand-*` per non spargere hex).
- [ ] Punti: `index.html` theme-color, `index.css` (focus ring indigo), `tailwind.config.js` safelist,
      + **audit mirato** delle occorrenze `indigo-*` che sono brand-app (non aziendali).
- Verifica: tsc/build; prova a schermo utente; zero regressioni sui temi aziendali.

## Fase C — Nome RailFlow → Valora (SOLO UI)
- [ ] UI: `index.html` title, `manifest.json`, `LoginPage`, `DashboardPage`, `RagAdminPanel`, `config/demo`, hooks.
- [x] **DECISO:** i generatori (`RelazioneModal`, `riposiRelazione`, `riposiExcel`, `reportGenerator`) **NON si toccano**
      — i documenti restano com'erano. `RailFlow` nei documenti resta (o si valuta a parte, fuori scope oggi).
- Verifica: `grep "RailFlow"` = 0 nei **soli file UI** scelti; documenti/generatori invariati.

## Fase D — Vista viewer Vincenzo: "Ufficio Vertenze" + logo FAST-CONFSAL
- [ ] Header vista readonly (`isReadOnly`): dicitura **"Ufficio Vertenze"** + logo **FAST-CONFSAL**
      (`logofast` → ottimizzato/ridimensionato in `public/logos/`; l'originale è 6249×4626, va rimpicciolito).
- [ ] Posizione da confermare col riscontro dell'utente (accanto al brand Valora nell'header del viewer).
- [ ] Gate: mostrato solo al viewer; owner invariato (pattern `...(isReadOnly ? [] : [])`).
- Verifica: tsc/test; prova a schermo utente (login viewer).

## Fase E — Verifica finale
- [ ] `npx tsc --noEmit`=0 · `vitest` verde · `npm run build` ok · rilettura diff. Prova a schermo = utente.
- [ ] Deploy in **batch** (non ora; si accoda ai commit pendenti).

## Fuori scope oggi
- Deploy; mockup Flow (li produce l'utente); redesign strutturale del sito (solo brand: nome+logo+colore).

### Review — ESECUZIONE 03/07 (gate verde: tsc=0 · 253 test · build ok)
- **Asset** (`public/`): `logo.png` = **simbolo colore NUDO trasparente** (no badge/cerchio); `favicon-32`/`apple-touch`/
  `icon-192`/`icon-512` = simbolo colore trasparente; `logos/fast-confsal.png` (600×444). Rimosso il rif. a `railway-app-icon.svg`.
- **Logo** (correzione utente): niente sfondo/cerchio. `dark:brightness-0 dark:invert` = colore in light, bianco in dark
  (LoginPage sempre scuro → `brightness-0 invert` fisso). Markup cerchio `object-cover` sostituito con `<img>` nudo `object-contain h-16`.
- **Nome** (solo UI): `index.html` title, `App.tsx` base+tagline, `manifest.json`, LoginPage (wordmark+footer), DashboardPage
  (wordmark+menu Dati). Sottotitolo "ferrovieri" → "Ufficio vertenze". **Documenti/generatori invariati** (i 4 `creator:'RailFlow'` restano).
- **Palette chrome**: theme-color `#1E3A5F`; wordmark "Rail/Flow" (cyan→indigo) → "Val/Ora" (emerald→teal); accenti login
  cyan→teal (focus/ring/icone/bottone); `glass-input` focus ring indigo→teal. Bottoni header **emerald→cyan un gradino
  più scuri del "Nuovo Lavoratore"** (`#10b981→#0891b2`, dopo feedback "troppo scuro" sui primi tentativi navy).
- **Vincenzo** (Fase D): blocco "Ufficio Vertenze" + logo **FAST-CONFSAL** nell'header, **gated `isReadOnly`** (owner non lo vede).
- **NON toccato** (scelte utente/prudenza): aree Turni&Riposi + Indennità (logo tematico per sezione **scartato** — "lasciamo
  tutto come è"); `DynamicIsland` (cyan = scanner AI, sottosistema); temi per-azienda (RFI/Elior/…).
- **Verifica visiva** = utente. Blocco FAST visibile solo con **login viewer** (Vincenzo). Non deployato (batch).
- Nota favicon: simbolo colore trasparente → su tab con tema scuro il navy può vedersi meno (trade-off del "senza sfondo"; da valutare a schermo).

---

# PIANO — Restyling UI area "Turni & Riposi" → livello Incidenza (2026-07-02)

> **STATO: piano in attesa di OK. NON implementare finché non approvato.**
> Direzione scelta dall'utente: **"restyling elegante mirato"** (NO flip-3D). Portare landing + card + header
> del dettaglio al livello di accuratezza dell'area Incidenza (`WorkerCard`). **Additivo**: zero cambi a
> motore di calcolo, DB, generatori (.docx/Excel/stampa). Solo componenti UI.

## Diagnosi (verificata sul codice)
Il *dettaglio* Riposi è già ricco (stat cards, tabs, banner, gestione stato, editor tariffe). La "piattezza" è:
- **Header area**: icona-orologio indigo generica (vs testata con identità di Incidenza).
- **`PraticaCard`**: riga piatta (iniziali + nome + 3 chip + chevron) vs `WorkerCard` (testata brand, tacca-stato
  glow, avatar+icona ruolo, `YearTimeline`, `Sparkline`, hover tilt+spotlight).
- **Header dettaglio**: sobrio, senza hero/identità.

## Identità visiva
Tema dell'area = gradiente **indigo→violet** ("tempo/turni") + glow coerente (l'area è già indigo). Le pratiche
riposi non hanno azienda (Viterbo `azienda=null`) → nessun colore-azienda; se un domani `pratica.azienda` è
valorizzato si potrà agganciare il logo/colore (fuori scope ora, coerente con la memoria "logo in pausa").

## Fase 0 — Helper condivisi (piccoli, puri)
- [ ] `utils/restEngine.ts`: `violazioniPerAnno(violazioni)` → `{ 'YYYY': { n, indennita } }` (raggruppa per
      `dataTurno` con fallback `inizio`). Puro + test. Serve alla mini-timeline della card.
- [ ] `components/riposi/riposiTheme.ts`: **un** tema condiviso (gradiente/glow + icona ruolo `BusFront`) usato da
      landing, card e detail — niente hexMap gigante, un'unica fonte.

## Fase 1 — Header area (`RiposiArea`)
- [ ] Hero: fascia gradiente tematico + icona + titolo/sottotitolo + **hero numerico aggregato** (totale violazioni
      + credito totale sulle pratiche visibili). `DevBadge` mantenuto.

## Fase 2 — Card pratica (`PraticaCard`)
- [ ] Testata con fascia gradiente + avatar icona ruolo (`BusFront`) + **tacca-stato laterale con glow** (da `STATO_META`).
- [ ] Nome (cognome uppercase + nome), `mansione · periodo`.
- [ ] **Mini-timeline violazioni per anno** (barre, altezza ∝ n° violazioni, tooltip «anno · n · €») — gemello di `YearTimeline`.
- [ ] Stat **Credito** / **Violazioni** con respiro; chip stato; badge seed.
- [ ] Hover: tilt leggero + spotlight radiale (pattern `WorkerCard`, versione sobria).

## Fase 3 — Header dettaglio (`RiposiPraticaDetail`)
- [ ] Hero header con identità: fascia gradiente + icona + nome pratica grande + chip stato + `mansione · periodo`.
      Bottoni export invariati (riallineati nell'hero). Nessun tocco a tabs/stat/banner/editor già presenti.

## Fase 4 — Verifica
- [x] `tsc`=0 · `vitest` = **253 verdi** (+4 `violazioniPerAnno`) · `build` ok.
- [x] Verifica visiva via **demo mode** (`npm run dev:demo`, login bypassato): landing + card + dettaglio OK,
      screenshot catturati. Card VITERBO con testata gradiente, avatar bus, tacca-stato, mini-timeline
      2011→2024, stat credito/violazioni; hero area 143 · 2.324 €; header dettaglio con numeri chiave.
- [x] Rilettura diff: additivo, calcolo/motore/DB/generatori invariati; area Incidenza intatta.

## Note
- Zero migration, zero motore, zero generatori. Solo UI. Locale, non deployato (batch).

### Review (2026-07-02)
Restyling completato in autonomia (direzione "elegante mirato", no flip-3D). File:
- **Nuovi**: `components/riposi/riposiTheme.ts` (tema condiviso indigo→violet + fascia + STATO_HEX),
  `__tests__/violazioniPerAnno.test.ts`.
- **Motore**: `utils/restEngine.ts` +`violazioniPerAnno()` (puro, aggrega per anno di attribuzione). Nessun cambio al calcolo.
- **`RiposiArea`**: header hero (gradiente + hero numerico aggregato); `PraticaCard` ricostruita (testata gradiente,
  avatar `BusFront`, tacca-stato con glow, mini-timeline violazioni/anno, stat Credito/Violazioni, tilt+spotlight).
  Motore sollevato a livello area (`statsByPratica`, useMemo) → calcolato una volta, condiviso da hero + card (no doppio compute).
- **`RiposiPraticaDetail`**: header elevato a hero (fascia gradiente + avatar bus + nome grande + numeri chiave + stato). Resto invariato.
- Verifica visiva su demo confermata (screenshot landing + dettaglio). tsc/test/build verdi. Locale, non deployato.

#### Rifinitura estetica (2026-07-02, su feedback utente)
- **Dettaglio**: i due pannelli slate piatti a tutta larghezza (Valorizzazione serie B + Tariffa €/h) **unificati** in
  un solo blocco glass **"Parametri di calcolo"** (coerente col resto del dettaglio, divider interno, gerarchia migliore).
  `SlidersHorizontal` → `Calculator`; rimosso l'import orfano.
- **Card**: alzato contrasto/dimensione dei testi deboli — mansione·periodo (`text-[11px] slate-400` → `text-xs slate-600/300`),
  label "Violazioni per anno" e anni del grafico (slate-400 → slate-500/600, +1px).
- Verificato a schermo su demo (pannello unificato + editor "Personalizza" aperto — via onUpdate no-op temporaneo sul seed,
  poi ripristinato: il pannello è owner-only e il seed non è gestibile). tsc/253 test/build verdi.

#### Giro colore/polish (2026-07-02, su mockup utente)
- **Card** (`RiposiArea`): avatar con alone iridescente (fucsia→indigo→ciano) su vetro chiaro + bus indaco; chip stato con
  glow colorato (STATO_HEX); grafico "Violazioni per anno" con **griglia orizzontale** + barre a **gradiente verticale**;
  stat **Credito → emerald** (coerente con le buste) / Violazioni rose, bordi più definiti; tinta lavanda diffusa sulla card.
- **Dettaglio** (`RiposiPraticaDetail`): **tab** attivo colorato a gradiente tema (era grigio); **bottoni** Excel/Relazione con
  icona in badge colorato + hover lift, "Stampa conteggi" a gradiente con shine; hero credito emerald allineato.
- **Sfondo sezione**: overlay radiale indigo/violet tenue su landing + dettaglio → distingue l'area dal resto del sito.
- Verifica visiva su demo (landing zoom + dettaglio). tsc/253 test/build verdi. Locale, non deployato.

#### Giro colore/polish #2 (2026-07-02, mockup utente + no verifica a video)
- **Sfondo di sezione** spostato dove va: `components/Background.tsx` accetta `area` e applica un velo indaco tenue
  SOLO per `riposi` (App.tsx passa `area`); rimosso l'overlay radiale dai wrapper delle pagine. La tinta della card resta.
- **Stat cards del dettaglio** (le 5 sotto la scheda) da bianche → **colorate per tipo** (rose/amber/indigo/emerald/slate):
  `TONE` esteso con `card` (bg+bordo tinta) e `text` (numero colorato); rimosso il glow overlay ridondante.
- **Mini-stat dell'header** (Violazioni/Credito) colorati (rose/emerald).
- **Card "Le due serie a confronto"**: icona in badge, numero `text-3xl` colorato (sky PDF / indigo motore).
- **Grafico "Andamento per anno"**: barre a **gradiente** (rose / indigo-violet) + griglia di riferimento, come la mini-timeline.
- Deciso di NON seguire lo skeuomorfismo del mockup (pergamena/sigillo/oro): stona con lo stile glass di RailFlow → preso solo il colore.
- **NON verificato a video** (nuova regola utente: la prova a schermo la fa lui). Gate: tsc · 253 test · build verdi. Da tarare col suo riscontro: intensità velo sfondo.

#### Giro colore/polish #3 (2026-07-02) — sezioni informative della landing
- Portate allo stile **glass** (bg-white/60 + backdrop-blur + border-white/60 + shadow) le 5 sezioni che erano bianche
  opache: "Cosa fa quest'area", "Come funziona", "Quadro normativo", "Violazioni che il motore rileva", "Fonti di prova".
- Accenti di colore: **header con icona in badge** (Cosa fa/Come funziona = indigo, Quadro = sky, Violazioni = rose);
  icone degli step "Come funziona" ora a **gradiente tema** (bianco su indigo→violet); chip "Fonti di prova" in glass.
- Gate: tsc · 253 test · build verdi. Locale, non deployato. Prova a schermo lasciata all'utente.

#### Fix UX (2026-07-02) — salto in cima al cambio tab
- **Sintomo:** a metà pagina, cliccando un tab (Prospetto turni / Confronto PDF) la finestra saltava in cima.
- **Causa:** il pill dei tab usa `motion.span layoutId="riposi-tab"` (framer shared-layout). Su pagina scrollata,
  la rimisura di layout al cambio fa scattare la finestra su — comportamento noto di framer.
- **Fix:** `changeTab()` salva `window.scrollY`, un `useLayoutEffect([tab])` lo ripristina prima del paint
  (gira dopo il layout effect del pill) + rete `requestAnimationFrame` per un eventuale riscroll async. Il
  cross-link `openMeseProspetto` (setTab senza pendingScroll) resta invariato. Animazione del pill mantenuta.
- Gate: tsc · build verdi. Prova a schermo lasciata all'utente.

---

# PIANO — Editor tariffe €/h per anno (override CCNL) · area Turni & Riposi (2026-07-02)

> **STATO: piano in attesa di OK. NON implementare finché non approvato.**
> Follow-up scoped della memoria `viterbo-marcatore-cee-e-tariffa` ("override CCNL persistito:
> migration + mappers + editor"). Migration 014 (`tariffe_per_anno jsonb`) **già applicata**,
> mapper DB↔pratica (`hooks/usePraticheRiposi.ts`) e persistenza (`updatePratica` → `tariffe_per_anno`)
> **già esistenti**. **Manca solo l'editor UI.** Zero migration, zero cambi al motore.

## Contesto verificato (02/07)
- Oggi `pratica.tariffePerAnno` è `null` → `resolveTariffePerAnno(giornate, undefined)` **deriva** la curva
  dalla fonte (10,08→13,13, cresce per anzianità). È il comportamento di default e resta tale.
- `RiposiPraticaDetail.tsx:67-77` passa già `tariffePerAnno` (risolto) + `coefficiente` al motore; i 3
  generatori (relazione/stampa/Excel) leggono la stessa curva → **erediteranno l'override senza modifiche**.
- ⚠️ **Vincolo di sicurezza** (`restEngine.ts:366-369`, `rateFor`): un anno **assente** dall'override
  cade sul fallback flat `tariffaOraria` (10,03), NON sulla curva derivata. → L'editor deve salvare un
  override **completo** su tutti gli anni con violazioni (precompilati), altrimenti alcuni anni si
  azzererebbero al valore sbagliato.

## Scope
- **MVP = editor manuale** dell'override €/h per anno (owner). Preset "tabella CCNL ufficiale" **fuori scope**
  finché non abbiamo i valori ufficiali per anno (oggi non disponibili). Additivo, chirurgico.

## Fase 1 — Editor UI (`components/RiposiPraticaDetail.tsx`)
- [x] Helper puri `utils/tariffeDraft.ts` (parse virgola/punto, `>0`, draft↔curva, dirty).
- [x] Pannello collassabile sotto il selettore coefficiente (gate `canManage`, come il selettore serie B),
      default **chiuso**. Header = riepilogo "Tariffa €/h per anno: {range} · {derivata dalla fonte | personalizzata}"
      + chevron "Personalizza".
- [ ] Aperto: griglia di input €/h, uno **per ogni anno con violazioni** (chiavi di `result.tariffePerAnnoApplicate`,
      ordinate), **precompilati** con i valori correnti (`rates`).
- [ ] Stato locale `draft` + dirty tracking. Azioni:
      - **Salva tariffe** → parse (virgola→punto, `>0`), `onUpdate({ tariffePerAnno: parsed })` (oggetto COMPLETO). Disabilitato se non-dirty o input non validi.
      - **Annulla** → reset `draft` a `rates`.
      - **Ripristina curva derivata** → `onUpdate({ tariffePerAnno: undefined })` (→ `null` sul DB → deriva). Visibile solo se override attivo (`pratica.tariffePerAnno != null`).
- [ ] Badge "Personalizzata" quando `pratica.tariffePerAnno != null`.
- [ ] Micro-testo: "sovrascrive la curva derivata dalla fonte · ricalcola tutto, nessun dato perso".

## Fase 2 — Nessun altro codice
- [x] Verificato: NESSUN tocco a motore/generatori/mapper (già passano `tariffePerAnno` risolto).
- [x] `resolveTariffePerAnno` invariato: override presente → usato; assente → derivato.

## Fase 3 — Test
- [x] `praticheRiposiMappers.test.ts`: round-trip `tariffe_per_anno` (DB↔pratica) → **già coperto** (righe 39-45, 94).
- [x] `restEngine.test.ts`: override applicato + fallback anni mancanti → **già coperto** (righe 217-234, 290-301).
- [x] `tariffeDraft.test.ts` **nuovo**: parse virgola/punto (fix bug punto-decimale), validazione `>0`, draft↔curva, dirty (12 test).

## Fase 4 — Verifica
- [x] `npx tsc --noEmit` = 0 · `vitest` = **249 verdi** (+12) · `npm run build` ok (warning bundle preesistente = P2).
- [ ] Verifica visiva (login owner): apri Viterbo → Personalizza → cambia 1 anno → Salva → il numero/curva si aggiorna
      in cruscotto e nei 3 export; Ripristina → torna €2.324,13 (curva derivata). Viewer: editor non visibile.  ← richiede login owner
- [x] Rilettura diff: additivo, owner-gated (`canManage`), Incidenza/altre pratiche invariate.

## Note
- Nessuna migration (colonna+mapper esistono). Locale, non deployato (batch con gli 11 commit pendenti).
- [x] Documentale allineato: roadmap del vault (`_roadmap.md`, Viterbo ×20% → fatto + log 02/07) e memoria
  `viterbo-marcatore-cee-e-tariffa` (×20% GIÀ completo+verificato €2.324,13 + editor costruito).

### Review (2026-07-02)
Scoperta iniziale: **Viterbo ×20% era già completo** (roadmap stale). Verificato sul DB (1 riga, `coefficiente=0.2`,
migration 014 applicata) + riverificato il numero end-to-end (€2.324,13, serie B piena €11.620,48 × 20%, 143 viol. CEE).
Il vero residuo era solo l'**editor override tariffe CCNL**, ora costruito:
- **Chirurgico**: 1 componente toccato (`RiposiPraticaDetail`, +81 righe, gate `canManage`) + 1 helper puro nuovo
  (`utils/tariffeDraft.ts`). Zero migration, zero motore/generatori/mapper (già passavano `tariffePerAnno` risolto).
- **Sicurezza**: l'override si salva SEMPRE completo (tutti gli anni con violazioni precompilati); il salvataggio è
  bloccato se un campo è invalido → nessun anno finisce sul fallback flat `tariffaOraria`. "Ripristina" → `null` → curva derivata.
- **Bug intercettato in review**: il parse iniziale trattava il punto come migliaia ("10.08"→1008); reso robusto
  (ultimo separatore = decimale). Coperto da test.
- **Verde**: tsc=0, 249 test (+12), build ok. Manca solo la verifica visiva UI (login owner).

---

# PIANO — Nuova area "Indennità" (vertenza-voce) · banco di prova Elior magazzino (2026-06-30)

> Disegno completo: [feature-indennita-residenza-elior.md](feature-indennita-residenza-elior.md).
> **NON implementare finché non approvato.** Stato: piano in attesa di OK.
> **Bacino = tutti gli Elior viaggiante** (già presenti + futuri): la sezione si auto-popola dai worker
> `profilo==='ELIOR' && eliorType==='viaggiante'` (sono esattamente i destinatari di questa vertenza).
> I dati 4300/4305 reali del viaggiante sono ancora incompleti (no `extracted_data`/OCR) → per validare i
> **numeri** del confronto si usa un **seed/mock** su un viaggiante finché non si sblocca l'OCR.
> Obiettivo di QUESTA fase: **scheletro feature + UI navigabile + motore parametrico**, con la lista già
> popolata dai viaggiante reali. La vertenza VERA (numeri 4300/4305 reali) = dopo lo sblocco dati — fuori scope qui.

> **STATO — giro 1 (30/06):** Fasi 0-4 ✅ scheletro navigabile (tsc=0 · 236 test · build ok).
> Restano: **Fase 4b** (cross-link da Incidenza), **Fase 5** (generatori .docx/Excel/stampa + aggancio ISTAT),
> **Fase 6** verifica navigazione manuale (serve login owner). Tutto locale, non deployato.

## Principi
- **Gemello *differenziato* dei Riposi**: stesso pattern, identità propria (rame/ambra + icona MapPin/Home),
  cuore detail = **confronto Pagato↔Dovuto**, **timeline prescrizione** esclusiva.
- **Modulo parametrico sulla voce**: niente hard-code 4300/4305 (config: voci+tariffe, periodo, prescrizione).
- **Additivo**: zero impatto su Incidenza e Riposi (nuova `AppArea`, nuove rotte, nuovi file).

## Fase 0 — Dato & tipi
- [ ] `types.ts`: tipo `PraticaVertenza` { id, workerNome, profilo/eliorType, voci:[{codice,label,tariffaPagata,tariffaDovuta}],
      periodo{da,a}, prescrizione{interruzioni[],cutoff}, coefficiente?, stato:'bozza'|'in_corso'|'pagata' }.
- [ ] Migration Supabase `pratiche_vertenze` (clone leggero di `pratiche_riposi`) + RLS owner/viewer identiche. **Non applicare finché il piano non è approvato.**
- [ ] **Lista derivata dai viaggiante reali**: la lista = tutti i worker `ELIOR/viaggiante` (one-pratica-per-worker,
      creata on-demand). `pratiche_vertenze` persiste stato/parametri/override; i worker senza pratica compaiono
      come «da impostare». Accoglie automaticamente i futuri viaggiante.
- [ ] Seed/mock dei **numeri** su 1 viaggiante (tariffe + importi finti realistici) per validare il confronto Pagato↔Dovuto finché manca l'OCR.

## Fase 1 — Motore parametrico
- [ ] `utils/vertenzaEngine.ts`: per mese×voce `ore = importo/tariffaPagata` · `Δ = ore×(dovuta−pagata)`;
      somma per anno; + rivalutazione ISTAT FOI (`istatService`) + interessi legali; `coefficiente` opzionale.
- [ ] Test `vitest`: 1 voce · 2 voci · prescrizione che taglia mesi · coefficiente ≠ 1.

## Fase 2 — Area & navigazione
- [ ] `AreaSwitch`: terza voce `'indennita'` (rame/ambra, icona MapPin/Home); estendere `AppArea`.
- [ ] Routing hash + persistenza area come per Incidenza/Riposi.

## Fase 3 — Lista pratiche (`VertenzeArea`, calco di `RiposiArea`)
- [ ] **Auto-popolata dai worker `ELIOR/viaggiante`** (filtro su `useWorkers`), non da seed: ogni viaggiante = una riga.
      Oggi sono **≈10** → **lista lineare** ordinabile per stato/credito; niente raggruppamenti per azienda né ricerca pesante.
- [ ] Card per-lavoratore: **header con `CompanyLogo` Elior** (già meglio dei Riposi attuali); stato/credito/periodo o «da impostare».
- [ ] Stati vuoto/loading.

## Fase 4 — Detail (`VertenzaDetail`) — il cuore differenziato
- [ ] Header pratica **con `CompanyLogo` Elior** (i Riposi oggi NON mostrano il logo — qui sì).
- [ ] **Timeline prescrizione** (striscia nov2017→lug2023 + marcatori interruzioni OO.SS. + cutoff); statica in v1.
- [ ] **Tabella confronto Pagato↔Dovuto** per voce (4300/4305) con colonna Δ + riga GAP+ISTAT+interessi = credito.
- [ ] Banner metodologico (CCNL Multiservizi/Ristorazione 2012/2016 art. 77; misura ridotta vs CCNL).
- [ ] Selettore coefficiente (riuso pattern Riposi), gated owner.

## Fase 4b — Richiamo da Incidenza (cross-link)
- [ ] Nella scheda Incidenza di un worker `ELIOR/viaggiante` (`WorkerCard` / `WorkerDetailHeader`): badge/bottone
      **«Indennità residenza»** → `setArea('indennita')` (esposto da `App.tsx:106`) + deep-link al worker (hash `#indennita/<id>`).
- [ ] Visibile **solo** per i viaggiante (no RFI/magazzino/altri profili). Owner + viewer (sola navigazione, nessun export).

## Fase 5 — Generatori (calco `riposi*`)
- [ ] `vertenzaRelazione.ts` (.docx vero, libreria docx) · `vertenzaExcel.ts` · `vertenzaPrint.ts`.
- [ ] Gate viewer via `canExportForViewer` (export solo su pratiche `pagata`).

## Fase 6 — Verifica
- [ ] `npx tsc --noEmit` = 0 · `vitest` verde · `npm run build` ok.
- [ ] Navigazione manuale: area visibile → lista → detail → timeline → confronto → azioni; Incidenza/Riposi invariati.
- [ ] Rilettura diff: tutto additivo, nessuna regressione sulle aree esistenti.

## Fuori scope (questa fase)
- Sblocco dati **viaggiante** (acquisire+caricare+ri-scansionare buste reali nov2017–lug2023) → prerequisito della vertenza VERA, sessione dedicata.
- Estrazione OCR reale di 4300/4305.

## Side-note (segnalato 30/06) — logo azienda mancante in Turni & Riposi (Viterbo)
Due cause combinate (verificate nel codice):
- (a) `RiposiPraticaDetail` **non rende** affatto `CompanyLogo` nell'header (l'area Incidenza sì, via `WorkerCard`/`WorkerDetailHeader`).
- (b) L'azienda di Viterbo è **custom** (`pratica.azienda` = stringa libera), non un profilo di sistema → `getCompanyLogo` = null
      (loghi solo per RFI/Trenitalia/Elior/Mercitalia/Clean Service, `config/profiles.ts`).
- **Fix (task separato)**: aggiungere il blocco logo nell'header Riposi **+** registrare un logo per l'azienda viterbese
      (file in `public/logos/` + mappatura custom). Da decidere: ora o backlog.

### Review — giro 1 (2026-06-30)
Scheletro navigabile completo, additivo (Incidenza/Riposi invariati). tsc=0 · 236 test (7 nuovi sul motore) · build ok.
File nuovi: `utils/vertenzaEngine.ts` (motore parametrico) · `__tests__/vertenzaEngine.test.ts` · `hooks/usePraticheVertenze.ts`
(lista auto-derivata dai worker ELIOR/viaggiante + seed didattico) · `components/VertenzeArea.tsx` (lista, identità rame) ·
`components/VertenzaDetail.tsx` (confronto Pagato↔Dovuto + timeline prescrizione + selettore coefficiente) ·
`public/elior-residenza-seed.json` · `supabase/migrations/021_pratiche_vertenze.sql` (**creata, NON applicata**).
File toccati: `AreaSwitch.tsx` (3ª voce rame/MapPin) · `App.tsx` (render + titolo) · `useHashRoute.ts` (`#/indennita`).
Decisioni chiuse in autonomia: seed = "Boriglione" demo; logo Viterbo → backlog.
Rimandato al giro 2: cross-link da Incidenza, generatori, aggancio ISTAT/interessi (ora a 0), persistenza DB.
Da fare lato utente: verifica navigazione manuale (login owner) — la lista mostrerà i 10 viaggiante reali + la card demo.

---

# MISSIONE 30/06 pom. — Arricchire la Relazione Riposi con la metodologia del perito (doc Vincenzo)

> Fonti: cartella `~/Desktop/Pratiche_differenze_ retributive_ indennità/mancati riposi/`
> (2 .docx perito + Excel + CSV). Analisi: `tasks/analisi-doc-vincenzo-riposi-2026-06-30.md`.

## Scope confermato dalla verifica (IMPORTANTE)
- ❌ **Il motore di calcolo NON si tocca.** Verificato sui CSV: la nostra tariffa (`deriveTariffePerAnno`)
  = tariffa effettiva del PDF (10,04→13,13 = colonna `tariffa_oraria_mediana_eur`); il coefficiente 20% è
  scelta dell'avvocato già confermata; le due serie sono già a confronto. Tutto corretto.
- ✅ Il valore dei doc è la **base giuridica della valorizzazione**, che la nostra Relazione NON cita.

## P1 (la missione) — `utils/riposiRelazione.ts`: sezione "Base contrattuale della valorizzazione"
- [ ] Aggiungere ai riferimenti di legge: **L. 138/1958**, **D.Lgs. 66/2003** (oltre 561/2006 + 234/2007).
- [ ] Nuova sezione con la catena **CCNL Autoferrotranvieri**: 1976 (art. 6 retrib. normale, art. 15 retrib.
      oraria), 1980 (art. 11 straord./fest./nott.), 1982 (raddoppio notturne dal 1984), **1997 (art. 14:
      riposo periodico = festivo)**.
- [ ] Principio art. 14/1997: prestazione nel giorno fissato per il riposo = **lavoro festivo**.
- [ ] **Divisore 195** (39h/6gg = 6,5h/gg) + composizione retribuzione normale (tabellare + contingenza +
      scatti + mensa + TDR + assegni ad personam).
- [ ] Schema **maggiorazioni** (straord. 110%, festivo 120%, notturno +20%, combos 130/150%).
- [ ] **Esclusioni prudenziali**: notturno e integrazione 50% NON applicate → "importi minimi".
- [ ] Aggancio al ns. impianto: "valore pieno" (serie fonte) = valorizzazione festiva del perito; la serie B
      applica su quel valore il **coefficiente di danno** (criterio del legale). Coerenza, niente conflitto.

## P2 (se c'è tempo) — etichette/banner in-app `RiposiPraticaDetail`
- [ ] Banner metodologico + etichette serie: citare la base contrattuale (561/2006 + valorizzazione CCNL festiva).

## P3 (opzionale, gated avvocato) — coefficiente selezionabile in UI (0.20 ↔ 1.0). Rimandabile.

## Verifica — FATTO
- [x] `vitest` 229/229 verde + tsc OK + build OK (motore invariato).
- [x] Relazione .docx di Viterbo generata dall'app → textutil → confermate tutte le nuove sezioni
      (art. 14 CCNL, divisore 195, "festivo a tutti gli effetti", L.138/1958, D.Lgs.66/2003, prudenziale, valore pieno).
- [x] P3 selettore: round-trip DB verificato (0,20 → 1 → 0,20). **Viterbo ripristinato a 0.2** (lawyer-confirmed).
- [ ] Commit dedicato (P1+P2+P3). NON deployare (batch).

### Review (2026-06-30 pom.) — MISSIONE COMPLETA
- **Colpo di scena verificato sui CSV**: il motore era GIÀ corretto (tariffa = effettiva del PDF 10,04→13,13;
  coefficiente 20% = scelta avvocato). Niente da correggere nel calcolo → ipotesi iniziale "tariffa sbagliata" smentita.
- **P1** `riposiRelazione.ts`: aggiunta la base contrattuale (catena CCNL + art.14/1997 festivo + divisore 195 +
  maggiorazioni + esclusioni prudenziali) dentro la sez. "2. Quadro normativo". Solo testo, zero calcolo.
- **P2** `RiposiPraticaDetail.tsx`: banner + sottotitolo card PDF citano la valorizzazione contrattuale.
- **P3** `RiposiPraticaDetail.tsx`: selettore "Valorizzazione serie B" (Valore pieno 100% ↔ Danno 20%) che espone
  il campo `coefficiente` già esistente (default e motore invariati). Visibile solo per owner su pratica gestibile.
- File su Desktop: `~/Desktop/Pratiche_differenze_ retributive_ indennità/mancati riposi/` (2 docx + Excel + CSV).

---

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

---

## Fix collaterale (2026-07-01) — doppio "(Rif.)" nella tabella incidenza

**Segnalazione:** Borriello mostrava DUE anni "(Rif.)" nella tabella % incidenza del report.
**Causa:** `isReferenceYear = year < startClaimYear` marca TUTTI i pre-ricorso; con lo start spostato
2020→2021, sia il 2019 (mozzicone: 0 giorni, 1.229 € di fisse) sia il 2020 (N-1 vero) risultavano "(Rif.)".
Nessun impatto su credito/Media periodo (entrambi escludono gli anni di riferimento) — solo display.
**Fix:** tra gli anni di riferimento la tabella incidenza tiene solo il vero N-1 (`year === startClaimYear-1`).
Applicato in [utils/riepilogoReport.ts](utils/riepilogoReport.ts) + [components/WorkerTables/AnnualCalculationTable.tsx](../components/WorkerTables/AnnualCalculationTable.tsx).
Test di regressione in [__tests__/riepilogoReport.test.ts](../__tests__/riepilogoReport.test.ts). tsc=0 · 237 test verdi. Locale, non deployato.
