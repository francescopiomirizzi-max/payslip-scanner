# Todo — Serata UX/estetica 2026-06-10

Piano approvato in conversazione: cross-link funzionali sul dettaglio Riposi + bundle N+S dashboard.
(La sessione precedente — UX fixes 2026-06-09, otto giri — è completata e committata; v. git history.)

- [x] 0. Commit del diff pendente su RiposiPraticaDetail (servLabel + turni alfanumerici) → 177f359
- [x] 1. Click su violazione → apre il mese corrispondente nel tab Prospetto → e9236dc
- [x] 2. Barre "Andamento per anno" cliccabili → filtrano l'elenco violazioni (toggle + chip per azzerare) → e9236dc
- [x] 3. Frecce mese precedente/successivo in MeseFocus (con scavalco anno se esiste) → e9236dc
- [x] 4. N — glass shimmer on hover sulle 3 card stat della DashboardPage → a3077b5
- [x] 5. S — cursor highlight (radial gradient) nella hero/home della DashboardPage → a3077b5
- [x] 6. Test verdi + tsc + build, poi commit per blocchi logici

## Secondo giro (feedback utente)

- [x] 7. S RIMOSSO — il glow cursor-following non piace all'utente (hook eliminato,
      backlog aggiornato: non riproporre la famiglia cursor-following, K incluso)
- [x] 8. Inizio calcoli in BLOCCO dalla barra di selezione: select 2008-2025 +
      Applica, stessa doppia scrittura del dettaglio (startClaimYear via
      updateWorkerById → auto-sync debounced + mirror localStorage startYear_<id>);
      toast con promemoria anno precedente completo

## Terzo giro — loghi aziendali (solo UI, mai nei documenti)

- [x] 9. Asset: SVG ufficiali da Wikimedia Commons in public/logos/ — RFI,
      Trenitalia (viewBox aggiunto a mano, il file ne era privo), Mercitalia Rail,
      Elior. Clean Service NON ha logo pubblico affidabile → fallback.
- [x] 10. Infrastruttura: getCompanyLogo() in config/profiles.ts (mappa estendibile,
      null per Clean Service/custom) + componente ui/CompanyLogo (pastiglia bianca,
      necessaria in dark e su sfondi colorati; null se senza logo → il chiamante
      tiene il fallback colorato esistente).
- [x] 11. Superfici (scelte dall'utente, tutte e 4): WorkerCard (badge → logo,
      suffisso Viag./Mag. conservato per Elior), filtri azienda + chips footer
      card Pratiche (dot+nome → logo), header dettaglio, colonna lavoratori Archivio.
- [x] 12. Verifica visiva: preview Chrome headless dei loghi a 12/14/16px su
      pastiglia, light+dark — leggibili. tsc pulito · build ok · 171 test verdi.

## Review

- Verifica: `npx tsc --noEmit` pulito · `vite build` ok · **171 test verdi**.
- Scelte tecniche degne di nota:
  - keyframe `card-sweep` dedicato invece di riusare `shimmer`: il nome era già
    doppiamente definito (index.css background-position vs tailwind.config translateX)
    e il transform del keyframe avrebbe schiacciato lo skew — risolto con wrapper
    che trasla + figlio skewato; animazione SOLO in :hover (niente GPU a riposo).
  - `useMouseGlow`: CSS custom properties + requestAnimationFrame, zero re-render React.
  - cross-link violazione→mese: `v.inizio` è ISO, `year` state è 'yyyy' da dd/mm/yyyy —
    combaciano via slice(0,4).
- ux-backlog.md aggiornato (N+S spuntati); prossimi del bundle: E (tilt 3D), O (skeleton).
- NON deployato (batching Netlify, deploy fissato 2026-06-17).

# Upload massivo parallelo (2026-06-11)

Obiettivo: batch 2008–2025 in un colpo solo, non presidiato, senza cambiare
NIENTE della logica di estrazione/applicazione dati (Titanium V3 intatto).

- [x] 1. usePayslipUpload: pool di concorrenza 3 (una per chiave API) al posto
      del for sequenziale; via la pausa fissa 1500ms; progresso = completati.
      Il corpo per-file resta IDENTICO (solo estratto in funzione): le mutazioni
      su currentAnni sono in blocchi sincroni → nessuna race su findIndex/push.
- [x] 2. Flush incrementale: setMonthlyInputs con snapshot deep-copy ogni 12
      buste completate (stessa cadenza di scritture Supabase del flusso manuale
      attuale, via autosave debounced 300ms) — un crash a metà non perde tutto.
- [x] 3. _rateLimit: bucket IP 60→300 / 5 min (il batch desktop non manda
      sessionId: conta solo l'IP; 216 file + retry a pool 3 ≈ 75 req/5min).
      Bucket sessione QR resta 30/5min.
- [x] 4. Verifica: tsc --noEmit pulito · vite build ok · **173 test verdi** ·
      diff riletto a freddo.

## Review (upload parallelo)

- Il corpo per-file è IDENTICO al precedente (solo estratto in `processFile`,
  `continue`→`return`): zero modifiche alla logica Titanium V3 / merge codici.
- Sicurezza concorrenza: dopo l'ultimo `await` (fetch) l'applicazione del
  risultato a `currentAnni` è un unico blocco sincrono → niente race su
  findIndex/push anche con 3 file in volo.
- Progresso island = buste completate (in parallelo "file corrente" non ha
  più senso); flush ogni 12 completate ma MAI sull'ultima (il flush finale
  c'è già, si evita il doppio autosave).
- Resa attesa: anno da ~3 min → ~1 min; archivio intero 2008-2025 caricabile
  in un colpo (~15 min non presidiati) grazie al bucket IP 300/5min.
- NON deployato (batching Netlify, deploy ufficiale 2026-06-18).

## Aggiunta: tasto CARTELLA (upload multi-anno)

- [x] Input nascosto `webkitdirectory` + tasto CARTELLA in command bar (icona
      FolderUp, stile sobrio coerente): selezioni la cartella del lavoratore o
      una cartella-anno, prende tutto ricorsivamente.
- [x] Filtro nel hook (il picker-cartella ignora `accept`): solo PDF/immagini,
      via .DS_Store e simili; reset input dopo lettura (ri-selezione stessa
      cartella ri-scatta onChange).
- [x] Anno anche dalla cartella immediata (`webkitRelativePath`): "2022/Gennaio.pdf"
      → 2022. SOLO la cartella immediata, non il percorso intero (una madre
      "Avella 2008-2025" regalerebbe lo stesso anno a tutti).
- [x] Guardia anti-doppio-batch (ref + toast): due batch simultanei si
      clobberavano lo snapshot a vicenda. NON cablato isBatchProcessing: avrebbe
      resuscitato il vecchio HUD bloccante (sostituito dalla Dynamic Island).
- [x] Verifica: tsc pulito · build ok · 173 test verdi.

## Iterazione 2: drop multi-cartella + restyling tasto

- [x] Dropzone globale potenziata: onBatchDrop attraversa le CARTELLE trascinate
      (webkitGetAsEntry ricorsivo, readEntries a blocchi da 100, entry estratte
      sincronamente prima del primo await) → si trascinano PIÙ cartelle-anno
      insieme dal Finder. Prima dataTransfer.files vedeva le directory come file
      illeggibili. Percorso annotato in (file as any).relativePath per l'anno.
- [x] Copy dropzone: "Sgancia qui file o cartelle".
- [x] Tasto CARTELLA restylato: stesso trattamento hover di AI AGENT (fill scuro
      + bordo conico rotante + glow) in AMBRA per distinguerlo (fucsia=AI,
      ciano=scan). Tooltip spiega il drag per più cartelle.
- [x] Verifica: tsc pulito · build ok · 173 test verdi.

## Iterazione 3: Live Activity "cartella" sull'island

- [x] Nuovo tipo upload 'folder' end-to-end (IslandContext → usePayslipUpload →
      DynamicIsland → pill satellite). Auto-rilevato: webkitRelativePath dal
      picker-cartella, entry directory dal drop.
- [x] Tema AMBRA coerente col tasto CARTELLA: gradient bg, anelli, badge,
      laser bar, glow; icona FolderUp al posto del Bot (header + pill).
- [x] Avanzamento esplicito: contatore collassato con pillola % viva accanto a
      n/total; pannello espanso dedicato (la griglia per-file del batch sarebbe
      illeggibile su 50-200+ buste) con % grande, n/total, barra ambra, ETA
      reale (riusa uploadEta che prima viveva solo nella pill) e cartellina
      che "ingoia" un foglietto ad ogni busta completata.
- [x] Stall detection 5s→20s: col pool il progresso avanza solo a busta
      completata (~12-15s la prima) → 5s dava falsi "Verifica…".
- [x] Larghezze island: folder 300px collassata / 320px espansa.
- [x] Verifica: tsc pulito · build ok · 173 test verdi.

## Iterazione 4: click su CARTELLA apre l'area di sgancio

- [x] Il tasto CARTELLA ora apre l'overlay "Sgancia qui file o cartelle"
      (onSetIsGlobalDragging(true)) invece del picker nativo: il picker accetta
      UNA sola cartella, il drag ne accetta N — l'overlay è il bersaglio giusto.
- [x] Nell'overlay, accanto ad "Annulla": bottone ambra "Scegli una cartella"
      che chiude l'overlay e apre il picker nativo (ripiego senza drag).
- [x] Timing reale misurato dall'utente: 4 anni (48 buste) in 1m30s col pool 3.
- [x] Verifica: tsc pulito · build ok · 173 test verdi.

## Iterazione 5: dropzone a due varianti

- [x] isGlobalDragging: boolean → false | 'drag' | 'folder' (context + page).
- [x] Variante AMBRA (dal tasto CARTELLA): FolderUp pulsante con alone, bordo
      tratteggiato ambra, copy "Sgancia qui le cartelle degli anni", chips
      2022-2025 fluttuanti, bottone picker "Scegli una cartella" SOLO qui.
- [x] Variante classica (dragEnter): fucsia col Bot, invariata, solo "Annulla
      e Chiudi". dragEnter non degrada la variante folder se già aperta.
- [x] Verifica: tsc pulito · build ok · 173 test verdi.

## Nota Vincenzo v3 (12/06)

- [x] Riscritta in tono diretto da messaggio: proposta (750 €) SUBITO in box
      verde, poi le motivazioni (450 = seconda lavorazione richiesta avvocato a
      metà prezzo; 300 = una tantum < 17 €/pratica, sviluppo a carico nostro).
- [x] Novità motore in box ambra: carriera intera caricata in minuti vs ~1 ora
      → per Vincenzo (viewer) il beneficio è "consegne più rapide, meno errori".
- [x] PDF ~/Desktop/Nota_Integrazione_Pratiche_RFI_v3.pdf verificato (2 pagine,
      layout pulito); sorgente knowledge/fonti/...v3.html (gitignorata); v1/v2
      intatte. Memoria aggiornata.

## Voci fisse Mercitalia + Clean Service (12/06)

Mappatura derivata dalle buste reali sul Desktop (Gagliano 2019/2021/2024;
Cianci 2014/2019/2021/2023). Le % di incidenza si attivano da sole appena
`getFixedColumnsByProfile` restituisce le colonne (motore già generico).

- [x] types.ts: INDENNITA_MERCITALIA_FISSE (1000 Retrib. Base, 1001 Salario
      Prof., 1025 Scatti Anz.) + INDENNITA_CLEAN_SERVICE_FISSE (MC01 Minimo,
      MC06 Sal. Prof., MC07 Scatti Anz., MC10 Ad Pers.) + switch
      getFixedColumnsByProfile.
- [x] utils/fixedVociBackfill.ts: whitelist per profilo (getFixedVociIds) al
      posto della lista RFI hardcoded; merge invariato ma parametrico.
- [x] hooks/useFixedVociBackfill.ts + WorkerDetailPage: passare la whitelist
      del profilo; gating `hasFixedProfile` derivato da getFixedColumnsByProfile.
- [x] scan-payslip.ts: sezione VOCI FISSE nei prompt MERCITALIA (colonna
      "Valori", righe in testa; 1100 = totale di controllo, NON sommare) e
      CLEAN_SERVICE (righe MC01.. dal 2021; testata MINIMO/SAL.PROF./SCATTI/
      AD PERS. riga ATT. sui layout vecchi; MCT/Retrib. di fatto = controllo);
      action 'fixed-voci' parametrica per company (prompt + whitelist).
- [x] Test: merge per-profilo + incidenza motore per MERCITALIA/CLEAN_SERVICE.
- [x] knowledge/codici-voce.md: sezioni fisse per le due aziende.
- [x] Verifica: tsc · build · suite verde. NIENTE deploy (batching, 18/06).

## Preparazione incontro lunedì 15/06 (avvocato + Vincenzo)

- [x] Specchietto voci RFI per l'avvocato: variabili (17+ticket, Quadro C) vs
      fisse (10 voci 3B, Quadro B), prima/adesso, formule %, metodo credito
      invariato, punti aperti (3B50 nel denominatore?, D'Errico divisore,
      reperibilità remoto €6). PDF ~/Desktop/Specchietto_Voci_RFI.pdf (3 pag.),
      sorgente knowledge/fonti/specchietto_voci_rfi.html.
- [ ] Rebrand "Ufficio vertenze sede … Consaf sindacato": SOLO quando Vincenzo
      manda il logo (memoria project-rebrand-consaf).

# Statistiche dashboard collassabili (striscia compatta di default) — 2026-06-13

Piano approvato (`~/.claude/plans/tranquil-wibbling-bumblebee.md`). La dashboard
atterra **compatta** (striscia KPI + loghi-azienda) per dare spazio a ricerca +
cassetti; espandere ripristina le 3 card attuali invariate. Solo `pages/DashboardPage.tsx`.

- [x] 1. Stato `statsCollapsed` (useState init da localStorage, default `true`) + effect persistenza, mirror di `openCassetti` → DashboardPage.tsx:361-378
- [x] 2. Wrappare la regione statistiche in `<AnimatePresence mode="wait">` con ramo unico (strip ↔ griglia 3 card) → :772-1033
- [x] 3. Striscia compatta: 3 KPI inline (Credito/Ticket cliccabili) + fila loghi-azienda con conteggi + chevron espandi + shimmer `card-sweep`
- [x] 4. Linguetta "Comprimi statistiche" sotto la griglia espansa → :1018-1031
- [x] 5. Cura mobile (KPI+loghi in contenitore `overflow-x-auto no-scrollbar`, chevron pinnato)
- [x] 6. Verifica codice: `tsc --noEmit` pulito · **206 test verdi** · `vite build` ok. Verifica visiva nell'app: DA FARE dall'utente (richiede login Supabase, non automatizzabile qui).

## Review

- **Cosa cambia**: la home atterra compatta (striscia KPI + loghi-azienda) invece delle 3 card piene; espandi/comprimi con freccetta, stato ricordato in `localStorage('statsCollapsed')`, default compatto.
- **Le card NON sono state modificate**: il loro markup è stato solo spostato dentro il ramo `statsCollapsed === false`; spostato `mb-8 relative z-10` sul wrapper `motion.div`. Resta una lieve deriva di indentazione del blocco card (è dentro un wrapper più profondo ma indentato come prima) — cosmetica, JSX valido (tsc ok).
- **Animazione**: `AnimatePresence mode="wait"` + `height: 0 ↔ auto`; `overflow:hidden` SOLO in transizione via `transitionEnd:{overflow:'visible'}`, così a riposo l'hover/ombre delle card non vengono clippate. `initial={false}` → nessun flash di apertura al primo load.
- **Riuso**: badge loghi identici al footer card Pratiche (`SYSTEM_PROFILE_KEYS`/`getCompanyLogo`/`CompanyLogo`/`matchesCompanyFilter`/`p.footer.*`); `AnimatedCounter`; `card-sweep` (hover-only). Zero nuove dipendenze/import.
- **Click**: i segmenti Credito/Ticket della striscia chiamano `setActiveStatsModal('net'|'ticket')` → stessi modali di oggi.
- NON deployato (batching Netlify, deploy ufficiale 2026-06-18).

### Fix post-feedback utente
- **Card tagliate sull'hover (alto/basso) in vista espansa**: il `transitionEnd:{overflow:'visible'}`
  non reggeva → sostituito con stato `statsAnimating` + `onAnimationComplete`: overflow
  `hidden` SOLO durante l'animazione di altezza, `visible` a riposo. Toggle via helper
  `toggleStats(collapsed)`. tsc ok · build ok.
- **Loghi striscia più grandi**: `h={14}` → `h={20}`.
- **Mercitalia Rail tagliato (storico)**: KPI e loghi non condividono più un contenitore
  `overflow-x-auto` (che clippava). KPI = cluster `shrink-0`.
- **Niente a capo — una riga sola (richiesta utente)**: scartato il `flex-wrap`. Per far
  stare tutto su una riga a h=20 senza tagliare, la striscia mostra **solo le aziende con
  conteggio > 0** (= "aziende su cui si lavora davvero", la richiesta originale). Le aziende
  a zero spariscono dalla striscia (restano nel footer della card espansa). `nowrap`, badge
  un filo più stretti (gap-1.5/px-2), chevron `ml-auto`. tsc ok · build ok.
  Limite noto: se TUTTE le aziende fossero attive su schermo stretto, potrebbe non bastare
  una riga → eventuale ripiego (loghi più piccoli o scroll-x). Col dato reale sta su una riga.

# Scheda informativa azienda (badge cliccabili → pagina dedicata) — 2026-06-13

Piano approvato. Scope: SOLO scheda informativa (logo + CCNL + lista lavoratori), niente
azioni operative. Entry point: badge della striscia compatta.

- [x] 1. `config/profiles.ts`: campo `ccnlSummary` + `ccnlHighlights` su interfaccia e su tutti
      i 5 profili (distillati da `knowledge/ccnl-e-normativa.md`).
- [x] 2. Routing `'company'` + parametro `selectedCompany`, rotta `#/azienda/:key`:
      `useWorkers` (stato+handler+back+export), `useHashRoute` (deps+applyHash+routeFromState+dep),
      `App.tsx` (destructure+deps con `companyKeyValid`+props AppRouter+titolo+island-sync),
      `AppRouter` (tipo+props+render CompanyPage+`onOpenCompany` a DashboardPage).
- [x] 3. Badge striscia → `motion.button` con `onClick={onOpenCompany(key)}` (grafica invariata).
- [x] 4. `pages/CompanyPage.tsx` nuova: hero brand col logo grande (fallback icona se senza logo),
      informativa CCNL (`ccnl` + `ccnlSummary` + `ccnlHighlights` + chip `ccnlRef`/PEC), elenco
      lavoratori read-only (riga → `onOpenWorker` apre il dettaglio). Gestiti ELIOR vs ELIOR_MAGAZZINO,
      Clean Service senza logo, empty state, viewer readonly.
- [x] 5. Verifica codice: `tsc --noEmit` pulito · `vite build` ok · **208 test verdi**
      (2 nuovi su `#/azienda/:key` in `useHashRoute.test.tsx`).
- [ ] 6. Verifica visiva nell'app (manuale, utente): aspetto hero/lista + flusso navigazione.

## Review
- Quasi tutto riusato: `SYSTEM_PROFILES` (logo/ccnl/pec/hex/icona), `getCompanyLogo`/`CompanyLogo`,
  `matchesCompanyFilter`, pattern routing `archive`, stile-riga read-only. Una sola nuova pagina.
- Tipi `viewMode`/`setViewMode` allargati a `'company'` in useWorkers/useHashRoute/AppRouter/DashboardPage.
- Lista lavoratori senza azioni (info, non cruscotto): nome + chip stato (mini mappa locale
  `STATUS_META`) + click → dettaglio esistente. NON deployato (batching, 18/06).

### Fix post-feedback utente (hero scheda azienda)
- Hero ridisegnato: tolto lo sfondo a tinta piena + `forceWhite` (loghi bianchi schiacciati).
  Ora logo **a colori** (trattamento dashboard: colore in light, silhouette in dark) su una
  **targa neutra adattiva alla larghezza** (px-10/py-8, h=60) → Elior non più compresso, ogni
  logo ha respiro. Colore-azienda come alone soft "che respira" + accenti. Animazioni: molla
  targa + slide testo. tsc ok · build ok.

### Badge "sezione in sviluppo" (per il viewer Vincenzo)
- Nuovo componente riusabile `components/ui/DevBadge.tsx` (pillola ambra "In sviluppo" +
  nota opzionale + tooltip). Inserito in: scheda azienda (`CompanyPage`, accanto al chip
  conteggio) e Turni & Riposi (`RiposiArea`, sotto il sottotitolo). Dalla vista readonly si
  capisce che sono sezioni nuove e in evoluzione. tsc ok · build ok · 208 test verdi.
- Iterazione: testo tutto DENTRO la pillola + pallino giallo lampeggiante (animate-ping);
  "nuovissima" → "nuova" su entrambe.
- Stati scheda azienda allineati ai cassetti: estratta la classificazione in
  `config/cassetti.ts` (fonte unica: id/label/icon/accentHex/matches/defaultOpen +
  `getCassettoByStatus`). DashboardPage importa da lì (rimossa def locale + 3 icone inutili);
  CompanyPage usa `getCassettoByStatus` per chip (label+accentHex) → 'inviata' = "Buste Paga
  Mancanti", ecc. Niente più mappa locale divergente. tsc ok · build ok · 208 test verdi.

# Cassetti "spettacolari" — la cassettiera viva (2026-06-13)

Piano approvato. Solo visivo/UX, nessuna azione nuova nei cassetti. tsc ok · build ok · 208 test.

- [x] `components/CassettiOverview.tsx` (nuovo): panoramica "vetrata" — segmenti per stadio,
      larghi in proporzione alle pratiche, colore-stadio, fill in cascata (scaleX), hover
      lift+shimmer+glow, click → `focusCassetto` (apre+scrolla). Conteggio + € per segmento.
- [x] `Cassetto` (DashboardPage): spina di colore sul root (prosegue nel pannello aperto =
      binario lungo le card), si accende (glow) da aperto/hover; metriche `conteggio · €credito`
      con count-up (`AnimatedCounter`), € in tinta. Nuove prop `credito`, `isActive`.
- [x] Padre: memo `cassettoStats` (count+credito per stadio, riusa `netCreditMap`),
      `cassettoRefs`+`focusCassetto`(scrollIntoView), stato `hoveredCassetto` (hover panoramica
      ↔ spina cassetto), variante cascata `CASSETTO_GRID_VARIANTS` sulla griglia aperta.
- [x] `AnimatedCounter`: prop opzionale `fractionDigits` (default 2) → € senza centesimi nei cassetti.
- [ ] Verifica visiva nell'app (manuale): panoramica, spina/metriche, apertura, dark/light, viewer.

### Correzioni post-feedback (screenshot 12/06)
- Panoramica "vetrata" RIMOSSA (CassettiOverview.tsx eliminato): erano "totali di ogni
  cassetto", non interessano → contano i badge lavoratori.
- € credito TOLTO dalle barre dei cassetti → torna `etichetta · conteggio` + badge.
- Spina colore NON scende più lungo le card (spostata dentro la testata, glow solo da aperto)
  → risolto il conflitto con i colori delle card.
- Loghi striscia compatta: MANTENUTI (l'utente ha annullato la rimozione — sono anche
  l'ingresso alla scheda azienda). tsc ok · build ok · 208 test verdi.

### Rifiniture visive 1-2-3 (poi: riga strumenti)
- [x] 1. KPI Ticket: ~~empty-state n/d smorzato~~ BOCCIATO ("sembra rotto"). Soluzione finale:
      Ticket come Credito → mostra SEMPRE il valore (0 → "0,00 €"), nessun trattino/n-d.
      Allineato anche Credito (tolto `: '-'`).
- [x] 2. Cassetto aperto: legame gentile testata↔card — BOCCIATO dall'utente, RIMOSSO.
      Pannello aperto torna pulito (`pt-4 px-1`, nessun alone/hairline).
- [x] 3. Barra-cassetto chiusa ribilanciata: etichetta text-xs, conteggio 11px, badge-cognome
      più ariosi (px-2.5 py-1 rounded-lg gap-2) + fade destro più ampio (w-10).
- [x] 4. Riga strumenti: NON deve sembrare un cassetto. Tolto il contenitore vetro/bordo/rounded
      (stesso linguaggio dei cassetti) → toolbar TRASPARENTE e slim + sottile linea di sezione in
      basso che la separa dai cassetti. Controlli interni invariati.
- [~] 5. Coerenza fascia: tentato (allineamento + famiglia controlli) ma l'utente ha chiarito
      che i FILTRI AZIENDA andavano lasciati IDENTICI (andavano benissimo). RIPRISTINATI allo stato
      originale (centrati, px-6 py-2 rounded-2xl text-xs, logo h=20, conteggio `(N)` mono).
      Scope vero: SOLO la barra strumenti sotto i filtri. Lezione: non allargare lo scope ai
      vicini quando il fix è su un elemento preciso.
- [x] 6. Barra strumenti rifatta esteticamente (solo lei): via i divisori `|`, via le micro-etichette
      "ORDINA"/"TICKET", controlli portati alla stessa famiglia (superficie neutra spenti, colore
      accesi, niente bordi), Ticket mostra "Ticket ON/OFF" nella pillola, conteggio con numero in
      evidenza + "pratiche" smorzato.
tsc ok · build ok · 208 test verdi.

### Zone laterali vuote (screenshot 13/06) — "allarga + badge a capo"
Contesto: l'utente ha cerchiato i due margini vuoti ai lati della home (conseguenza di
`max-w-7xl mx-auto`) e ha scelto: NIENTE widget decorativi → ridare lo spazio al contenuto.
- [x] 1. Contenitore home `max-w-7xl` → `max-w-screen-2xl` (riga ~569): header, striscia KPI
      e cassetti respirano; search (max-w-4xl) e filtri restano centrati col loro cap interno.
- [x] 2. Badge lavoratori a cassetto CHIUSO: da scroll orizzontale + fade-right a `flex-wrap`
      → si vedono TUTTI senza scroll, la barra cresce in altezza quel tanto che serve.
      Rimosso lo scroll-x e la sfumatura destra (non più necessari).
- Nota: la griglia a cassetto APERTO resta `lg:grid-cols-3` (card più larghe). Si può portare
  a 4 colonne ≥2xl se in futuro si vuole sfruttare di più la larghezza da aperto.
tsc ok · build ok · 208 test verdi. Non committato/deployato.

### Striscia compatta più bella (mockup 13/06) — SOLO badge circolari
L'utente ha proposto un mockup con sparkline su Pratiche/Credito + badge circolari sui loghi.
Scelta: SOLO i badge circolari. Sparkline ESCLUSE perché il credito non ha storico → una linea
"in salita" sarebbe inventata (contro "ancora agli artefatti reali"). Resta opzione futura: una
sparkline VERA su credito-per-anno o ripartizione-per-stato, da decidere con calma.
- [x] Loghi azienda: conteggio da testo inline → pallino circolare (superficie chiara neutra
      `bg-white/75 dark:bg-slate-900/55`, numero nel colore azienda `footer.count`). Restyle puro,
      i loghi restano cliccabili → scheda azienda.
- [x] KPI compatto: "Pratiche" → "Pratiche Totali".
- Sparkline: NON fatte (vedi sopra). Italo: NON è tra le aziende mappate; aggiungere solo se
  esistono pratiche Italo (profilo nuovo, task a parte).
tsc ok · build ok. Non committato/deployato.

### Pillole lavoratori + cornice glow cassetto (13/06)
- [x] Pillole lavoratori (badge a cassetto chiuso) più grandi E più belle: px-3 py-1.5,
      testo text-xs, pallino w-2 h-2, gap-2.5 tra pillole, forma `rounded-full` (pillola vera),
      shadow-sm a riposo, hover lift (-translate-y-px) + shadow-md.
- [x] Cornice GLOW sulla barra del cassetto CHIUSO, nel colore dello STATO (config.accentHex):
      border `accentHex59` + alone `0 0 20px -6px accentHex73` + gradient sfondo più carico
      (accentHex1f). Così i cassetti CHIUSI si distinguono a colpo d'occhio per stato.
      APERTO torna neutro (border/ombra default), l'accento resta sulla spina che fa glow.
      NB: prima per errore l'avevo messa sul pannello APERTO → l'utente ha chiarito che intendeva
      il CHIUSO. Revert del frame aperto (torna `pt-4 px-1` pulito) e spostato sulla barra chiusa.

### Fluidità apertura/chiusura cassetti (13/06) — erano "scattosi"
Cause: (1) pannello animava height:auto con `spring` (velocità variabile + overshoot → strappo
su card pesanti col backdrop-blur); (2) ogni card entrava con molla lenta/floaty (itemVariants
stiffness 50, y:30) sfalsata → doppia animazione scoordinata.
- [x] Pannello cassetto: `spring` → tween con curva [0.22,1,0.36,1] (height 0.42s, opacity 0.28s),
      la stessa del pannello statistiche che è fluido. Velocità uniforme, niente overshoot.
- [x] Card dentro il cassetto: nuova `CASSETTO_ITEM_VARIANTS` (tween 0.3s, y:14) al posto della
      molla globale → entrata leggera coordinata con la glissata. Stagger ridotto 0.05→0.03.
- [x] `renderWorkerCard(w, variants=itemVariants)`: param opzionale. Cassetti passano la variante
      leggera; ricerca resta su itemVariants (entrata invariata). Call site a arrow per non
      passare l'index di .map come variants.
- Resta inerente il costo di reflow del backdrop-blur su cassetti molto pieni: se ancora pesante
  si valuterà alleggerire il blur durante l'animazione (non fatto, non necessario finora).
tsc ok · build ok. Non committato/deployato.
tsc ok · build ok. Non committato/deployato.
