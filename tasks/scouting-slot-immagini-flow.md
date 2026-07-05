# Scouting slot immagini Google Flow (2026-07-05)

> Segue l'idea annotata in roadmap il 05/07: immagini Flow **solo su superfici di presentazione**
> (ingresso / landing aree / login), MAI nelle viste operative. Prima si definiscono gli slot
> (aspect ratio + stile), poi si genera. **Questo file è lo scouting: niente è implementato.**

## Vincoli trasversali (verificati sul codice)

1. **Whitelabel** — dentro le sezioni del sindacato il brand ValOra NON compare (vive su ingresso+login).
   → Le immagini nelle landing delle aree devono essere **tematiche e neutre** (niente logo/wordmark ValOra).
   Sull'ingresso e sul login invece il brand è ammesso.
2. **Dark mode** — dashboard e aree sono light+dark. Due tecniche già collaudate nel codice:
   - **Tecnica CAF** (per illustrazioni grandi con fondo proprio): un solo asset chiaro, in dark gli si mette
     sotto un backing chiaro sfumato (`dark:bg-gradient-to-b dark:from-slate-100/90 dark:to-slate-200/70`,
     vedi `SindacatiDashboard.tsx:259`). 1 asset, zero varianti.
   - **PNG trasparente** (per spot piccoli): scontorno Pillow dal file generato su fondo bianco;
     funziona su entrambi i temi se i colori sono mid-tone (teal/petrol, non navy pieno né pastello).
3. **Peso file** — budget: illustrazione grande **≤200 KB** (WebP q80), spot **≤60 KB**; `loading="lazy"`
   per tutto ciò che è sotto la piega. NB: l'attuale `caf-illustrazione.png` pesa **775 KB** → da convertire
   in WebP a prescindere (stessa resa, ~-75%). `login.mp4` = 1,9 MB (riferimento del tetto già accettato).
4. **Regole di generazione Flow** (lezioni 02-03/07):
   - Flow/Imagen **ignorano gli hex** nel prompt → non forzare la palette dal prompt: generare, scegliere
     le uscite già in gamma teal/navy, eventuale correzione colore in post.
   - **Niente testo dentro le immagini** (rischio farfuglio); le label le mette la UI.
   - Generare **su fondo bianco solido** (regola "su-bianco"), 2K; poi tecnica CAF o scontorno.
   - Stile di riferimento = `public/caf-illustrazione.png` (illustrazione morbida, fusa nella card).

## Slot censiti

### A — Dashboard d'ingresso (`components/SindacatiDashboard.tsx`) · brand ammesso

| # | Slot | Stato | Formato | Note |
|---|------|-------|---------|------|
| A1 | Illustrazione pannello CAF (`:260`) | **già occupato** — è il riferimento di stile | 1344×698 (~1,93:1) | ✅ 05/07 convertita: PNG 756 KB → **WebP 28 KB** (alpha preservato), PNG rimosso |
| A2 | Empty state "Recenti pratiche" (`:118`) | oggi solo testo | spot 1:1 (gen. 1024², resa ~140 px) | Cartellina/pratiche in attesa, teal. PNG trasparente |
| A3 | Sfondo pagina | **escluso** | — | Curve SVG+aurore scelte apposta il 04/07 (video scartato per peso/tono) |
| A4 | Popup sezioni (portal) | **escluso** | — | Funzionale, le icone gradiente bastano |

La fascia del pannello Sindacati (`aspect-[1344/698]`, `:241`) è **occupata dal logo FAST tra parentesi neon**
= slot whitelabel del committente, non si tocca.

### B — Login (`pages/LoginPage.tsx`) · brand ammesso

| # | Slot | Stato | Formato | Note |
|---|------|-------|---------|------|
| B1 | Sfondo (`:30`, oggi `login.mp4`) | occupato, **re-skin opzionale** | video loop 8s 16:9 o still 2K 16:9 | Sta sotto overlay scuro (`opacity-50` + gradiente): serve scena scura navy/teal. Se still WebP → si risparmiano ~1,7 MB |

### C — Landing delle 3 aree · **whitelabel: niente brand ValOra**, solo immagini tematiche

Le aree: Incidenza (`pages/DashboardPage.tsx:634` hero), Turni & Riposi (`components/RiposiArea.tsx:100`),
Indennità (`components/VertenzeArea.tsx:110`).

| # | Slot | Stato | Formato | Note |
|---|------|-------|---------|------|
| C1 | Fascia hero (banda h-40 in cima al pannello) | **da valutare con mockup** | striscia ~1600×640 ritagliata, resa angolo dx ~400×160, dissolta nella fascia | Slot più visibile ma più rischioso: l'hero è già pieno (icona+titolo+stat/azioni). Solo se il mockup convince |
| C2 | Sezione "Cosa fa quest'area" (Riposi `:187`, Indennità `:181`) | **candidato principale** | 4:3 (gen. 1600×1200, resa ~280 px colonna dx su lg) | È letteralmente "cosa fanno le sezioni". Riposi = autista/tachigrafo/orologio; Indennità = casa/trasferta/mappa. Tecnica CAF o trasparente |
| C3 | Empty state pratiche (Riposi `:175`, Indennità `:169`, Incidenza ricerca `~:1192`) | oggi solo testo | spot 1:1 (gen. 1024², resa ~160 px) | Diventa importante col multi-sindacato giro 2: le aree vuote **si mostrano** (decisione 05/07) → un nuovo sindacato vedrà subito questi slot |
| C4 | Step "Come funziona" | **escluso** | — | Icone a gradiente già efficaci, spot lì = rumore |

NB Incidenza: sotto l'hero è tutto operativo (ricerca/filtri/card/statistiche) → per Incidenza l'unico slot
extra-hero è l'empty state; non ha una sezione "Cosa fa" (eventuale aggiunta = decisione separata, non uno slot).

### D — Superfici ESCLUSE (per regola o per tono)

- Viste operative: archivio, dettagli pratica/vertenza, report, tabelle, statistiche.
- `ViewerPaymentBlock` (vista bloccata di Vincenzo): tono "manutenzione" volutamente sobrio — niente decorazioni.
- `MobileUploadPage` (QR telefono): operativa.
- Documenti generati (.docx/Excel/stampa): decisione rebrand 03/07 — invariati.

## ✅ DECISIONE 05/07 — GO su C2

Si parte da **C2 "Cosa fa quest'area"** (2 immagini: Riposi + Indennità). Brief di generazione consegnato
in chat (formato 4:3, stile CAF = flat vettoriale + fascia sfumata, colori del TEMA D'AREA: indaco/violetto
per Riposi, ambra/rame per Indennità — non teal brand, per coerenza whitelabel + identità d'area).
L'utente genera su Flow → io scelgo/ottimizzo (WebP) e innesto negli slot. Gli altri slot restano in coda
secondo le priorità sotto.

## Proposta di priorità (da discutere)

1. **C2 — "Cosa fa quest'area"** (2 immagini: Riposi + Indennità): valore massimo, zero rischio layout.
2. **C3 + A2 — empty states** (4 spot): piccoli, utili subito col multi-sindacato giro 2.
3. **A1 — conversione WebP** dell'illustrazione CAF esistente (nessuna generazione, solo peso).
4. **B1 — re-skin login** (opzionale, quando capita una scena buona su Flow).
5. **C1 — fascia hero**: solo dopo un mockup convincente; default = non farlo.

### Review — C2 ESEGUITO (05/07) · gate: tsc=0 · 253 test · build ok
- Generazione utente su Flow: 4 varianti per area in `~/Desktop/~:Desktop:flow-cosa-fa:/` (cartelle 1=Riposi, 2=Indennità).
- **Scelte** (coppia stilisticamente gemella: outline + fascia sfumata): Riposi = variante «(3)»; Indennità = variante «(2)».
  Scartate: Riposi base (frontale bus doppio), Riposi (2) (fascia sfocata), Indennità base+(1) (simbolo **$** sull'assegno),
  Indennità (3) (senza fascia).
- **Asset**: `public/riposi-illustrazione.webp` (1200×896, **36 KB**) + `public/indennita-illustrazione.webp` (1200×896,
  **23 KB**) — Pillow, q80, ben sotto il budget 200 KB.
- **Innesto** (chirurgico, 2 file): sezione "Cosa fa quest'area" di `components/RiposiArea.tsx` e
  `components/VertenzeArea.tsx` → layout `lg:flex` (testo a sinistra, immagine a destra `lg:w-80`/`lg:w-72`;
  su mobile immagine sotto il testo), `loading="lazy"`, alt descrittivo, `rounded-2xl`. Nessun tocco a motori/generatori.
- **Verifica visiva = utente** (light + dark; l'immagine è opaca chiara → in dark resta un riquadro chiaro come
  l'illustrazione CAF in dashboard: da confermare a schermo).

### Review — EMPTY STATE (C3+A2) ESEGUITO (05/07 pom.) · gate: tsc=0 · 253 test · build ok
- Generazione utente su Flow: 4 soggetti × 4 varianti in `~/Desktop/flow-cosa-fa/` (cartelle 1-4, rinominata senza `~:`).
- **Scelte**: Riposi = cartellina+orologio «(3)» (tratto più corposo, meglio a 160px); Indennità = cartella+casa+pin «(2)»
  (unica senza artefatti: la base-1120 aveva un frammento fluttuante, la (1) una pila tripla); Incidenza = schedario+busta
  «base» (la più iconica); Dashboard = vassoio «(2)» (trattini-dettaglio coerenti col set).
- **Pipeline scontorno** (nuova, in Python/Pillow+numpy): alpha dalla distanza dal bianco (min canale) + **un-blend**
  `c = (obs − 255(1−α))/α` + autocrop bbox+30px + max 480px + WebP q85 con alpha. Risultato verificato a video (linee pulite).
  Asset: `riposi-empty.webp` 21 KB · `indennita-empty.webp` 13 KB · `incidenza-empty.webp` 38 KB · `dashboard-empty.webp` 23 KB.
- **Innesti** (4 file): empty state con spot in `RiposiArea` e `VertenzeArea` (blocco tratteggiato centrato);
  `SindacatiDashboard` "Recenti pratiche" vuoto; `DashboardPage` **nuovo blocco "Nessun lavoratore in archivio"**
  (`workers.length === 0 && !searchQuery` — prima non esisteva: griglia muta) + control bar della griglia nascosta ad
  archivio vuoto. I vuoti "da filtro" (togli il filtro / Urgenze) restano solo testo, com'erano.
- Visibili oggi solo ad archivio vuoto (39 worker) → diventeranno reali col giro 2 multi-sindacato (aree vuote mostrate).
  **Verifica visiva = utente** (es. demo mode o account nuovo).

## Flusso operativo concordabile

1. Si concordano gli slot (questo file) → l'utente genera su Flow con i formati indicati.
2. Io preparo gli asset (scontorno/backing/WebP/resize) e li innesto negli slot; gate tsc/test/build.
3. Verifica visiva = utente (regola 02/07). Deploy in batch coi commit pendenti.
