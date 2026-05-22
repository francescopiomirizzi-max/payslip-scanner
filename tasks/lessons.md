# Lessons — Self-Correction Log

> Pattern e errori da evitare nelle prossime sessioni.
> Aggiornato dopo ogni correzione utente.

## 2026-05-21 — scan-payslip: lo swap Presenze/Riposi NON si risolve con il prompt

### Lezione: per un errore OCR sistematico, correggi nel CODICE con un'invariante — non con l'ennesima riscrittura del prompt

**Bug riscontrato (segnalato dall'utente):** su RFI/Trenitalia l'IA mette "sempre" il valore
della colonna *Riposi* dentro `daysWorked` (giorni lavorati). `daysWorked` è il DIVISORE di
tutti i calcoli indennità → un errore qui corrompe l'intera pratica.

**Perché il prompt non bastava:** il bug era già stato "blindato" 3+ volte nel prompt
(vedi todo.md). Continuava a fallire perché è un problema di disambiguazione SPAZIALE: quando
la cella "Presenze" è fisicamente vuota, l'OCR non ha modo di sapere che il primo numero
appartiene alla 2ª colonna. Nessuna quantità di istruzioni testuali lo rende affidabile.

**Tre design scartati (riprodotti empiricamente, NON hanno retto):**
- *Range dei Riposi* (un full-time ha 4-16 riposi): l'IA **allucina** un `riposi` *dentro* il
  range (es. `riposi:6`, numero inesistente sul cedolino) → il check non scatta.
- *Quadratura `E = giorniMese − colonne di destra`*: presuppone che la riga presenze sommi
  SEMPRE ai giorni del mese. Falso: Marzo 2010 somma 28≠31, Febbraio 2012 somma 31 > 29
  giorni reali, i conguagli sommano 57-61. Soglia legata al calendario → falsi positivi.
- *Check "riposi rotto" (null o < 3) come spia del bug*: smentito da Giugno 2021 RFI, che ha
  `riposi` realmente vuoto pur essendo un mese letto correttamente → avrebbe azzerato a torto.

**Fix definitivo (8 cedolini reali — 4 Trenitalia + 4 RFI — come banco di prova):**
1. Il prompt §2 non chiede più `daysWorked`: chiede di TRASCRIVERE la riga presenze
   nell'oggetto `attendance` (10 colonne). Compito più meccanico.
2. Scoperta chiave: l'IA legge **perfettamente** una cella "Presenze" VALORIZZATA (1/8/10/18/
   18.5/20/44 tutti esatti) e la colonna "Ferie". Sbaglia SOLO con la cella VUOTA.
3. `reconcileRailwayAttendance()`: daysVacation/daysPaidLeave letti diretti. Per daysWorked,
   invariante ASIMMETRICA con **soglia FISSA** (non i giorni di calendario): una riga onesta
   di un singolo mese somma a ~28-31, mai oltre ~32; il bug inserisce un valore-presenze
   FANTASMA → sovra-conteggio. → È il bug se `presenze` ∈ [4,16] (plausibile come riposi),
   la riga sfora la soglia, E azzerare `presenze` la riporta sotto soglia (quest'ultima
   distingue il bug da un conguaglio multi-mese, dove azzerare non basta). Le tre condizioni
   in AND: una busta onesta non le attiva mai → MAI un falso azzeramento.

**Regola generale:**
> Quando un modello sbaglia sistematicamente un campo, NON insistere col prompt: ricava il
> campo per via deterministica. Ma attenzione: NON costruire la validazione sul campo che il
> modello sbaglia (può allucinare un valore "plausibile"), e NON dare per scontate invarianti
> non verificate (qui: "la riga somma ai giorni del mese" era falsa). Riproduci il bug su PIÙ
> casi reali: sono serviti 8 cedolini per scartare 3 design e trovarne uno robusto — un'invariante
> *asimmetrica* ("non supera mai", non "è sempre uguale a") regge dove quella rigida cade.

### Lezione collaterale: la matematica del retry deve stare nel budget della Function

`generateContentWithRetry` faceva 3×16s = 48s, ma la Netlify Function muore a ~30s: ogni
chiamata Gemini "normale ma lenta" (~22s, misurata) veniva abortita al 16° secondo e mai
completata. Fix: retry **budget-aware** (budget totale, 1° tentativo fino a 24s così una
chiamata da 22s RIESCE) + rotazione delle chiavi API tra i tentativi (quota bucket diversi).
> Regola: un meccanismo di retry con timeout deve conoscere il budget totale dell'ambiente
> in cui gira; `n_tentativi × timeout` non può eccederlo, o il retry diventa autolesionista.

---

## 2026-05-20 — verify-payslip: il verificatore "ignorava i campi a 0" → cieco alle omissioni

### Lezione: un verificatore non deve MAI saltare i campi a zero

**Bug riscontrato (segnalato dall'utente):** la verifica AI "non rileva errori veri" — dava
esito verde anche a estrazioni in cui mancavano interi codici indennità.

**Causa root in `verify-payslip.ts`:** il prompt comune conteneva la regola
"IGNORA i campi con valore 0 o 0.0 — niente da verificare". Quando l'OCR PERDE un dato lo
lascia a 0.0: il verificatore, istruito a saltare gli 0.0, non poteva strutturalmente
accorgersi delle omissioni — cioè proprio la classe di errore più importante. Aggravante: il
JSON `monthData` passato al verificatore contiene solo i codici non-zero (il merge client
scarta i valori 0), quindi un codice perso non era nemmeno presente come chiave da controllare.

**Fix:**
1. Rimossa la regola "IGNORA 0.0"; aggiunta una regola esplicita "VALORE MANCANTE": un campo
   a 0.0 va dato per buono SOLO dopo aver verificato sul PDF che la voce è davvero assente.
2. Passata SEMPRE (anche per i profili di sistema, non solo i custom) la checklist completa
   dei codici indennità del profilo → il verificatore li spunta voce per voce, anche quelli
   non presenti nel JSON.
3. Intro riscritta in chiave "revisore pignolo e scettico".
4. Chiarita la regola TFR: "TFR 31/12 A.P." ≠ "RETR.UTILE TFR" (un test ha rivelato che le
   confondeva, generando un falso positivo) — fix applicato sia a verify che a scan-payslip.

**Regola generale:**
> Un controllo di qualità che salta i valori "vuoti/zero" è cieco proprio agli errori di
> omissione. Il verificatore deve avere la lista COMPLETA di ciò che si aspetta e spuntarla
> tutta contro la fonte, non limitarsi a ricontrollare ciò che è già stato estratto.
> Verificato empiricamente eseguendo verify-payslip end-to-end: caso errato → 3/3 discrepanze
> intercettate (incluso un codice mancante); caso corretto → success, 0 falsi positivi.

**Aggiornamento (cross-profili).** La fix sopra toccava la sezione di prompt CONDIVISA tra tutti
i profili. Ri-testando RFI ed ELIOR sono emersi due effetti collaterali, poi corretti:
(a) riscrivendo il `commonSection` avevo perso la regola "i codici si leggono dalla colonna
Competenze" → reintrodotta in modo generico;
(b) la regola "valore mancante" era troppo ampia: segnalava come errori anche voci NON tracciate
dall'app (trattenute, addizionali IRPEF, quote sindacali) → ristretta ESPLICITAMENTE ai soli
codici della checklist + campi standard.
**Regola:** una modifica a un blocco di prompt CONDIVISO va ri-testata su OGNI profilo, non solo
su quello in focus; e ogni regola "cattura tutto" ha bisogno di un ambito esplicito, altrimenti
genera falsi positivi. Verifica finale: RFI → 2/2 discrepanze reali, 0 falsi positivi;
ELIOR → daysWorked intercettato, 0 falsi positivi; caso corretto → success su entrambi.

---

## 2026-05-20 — MERCITALIA: prompt OCR scritto da spec testuale, senza il PDF reale

### Lezione: NON scrivere un prompt di estrazione OCR senza prima vedere un cedolino reale

**Bug riscontrato (segnalato dall'utente):** il `PROMPT_MERCITALIA` estraeva dati sbagliati.
`daysWorked` restava sempre 26 anche con ferie; le indennità risultavano vuote/0.

**Causa root:** ho scritto `PROMPT_MERCITALIA` (e il ramo MERCITALIA di `verify-payslip.ts`)
basandomi SOLO sulla specifica testuale dell'utente, senza un PDF ADP reale. Tre errori:
1. **Ordine colonne errato.** Avevo descritto la tabella come "Codice | Descrizione |
   Numero o base di calcolo | … | Valori". L'ordine reale ADP è 7 colonne:
   `Cod.Voce | Descrizione | Valori | Numero o base di calcolo | Compenso unitario o % | Competenze | Trattenute`.
2. **Indennità lette dalla colonna sbagliata.** Il prompt diceva di leggere gli importi
   delle indennità da "Valori". Su ADP gli importi pagati sono in **"Competenze"** (6ª col).
   "Valori" contiene solo retribuzione base/imponibili. → indennità tutte a 0.
3. **`daysWorked` senza sottrarre le ferie.** "GIORNI INPS" (≈26) INCLUDE le ferie godute.
   Il valore corretto è `daysWorked = GIORNI INPS − ferie (cod. 3833)`, come per ELIOR.

**Fix:** riscritto `PROMPT_MERCITALIA` con la mappa colonne esatta, indennità da "Competenze",
`daysWorked` calcolato con few-shot examples. Stesso allineamento su `verify-payslip.ts`.

**Regola generale:**
> Un prompt OCR per un nuovo layout di documento DEVE essere scritto guardando almeno un
> documento reale, non solo una descrizione testuale. Le specifiche a parole sbagliano
> sistematicamente l'ordine delle colonne e la colonna-sorgente dei valori. Se l'utente
> non fornisce subito un campione, CHIEDERLO prima di scrivere il prompt.
> Inoltre: i campi "giorni lavorati" sui cedolini italiani spesso includono ferie/permessi
> — verificare sempre se vanno sottratti (pattern già visto su ELIOR: `GG INPS − ferie`).

---

## 2026-05-19 — scan-worker: "ruolo" sempre compilato con "Professional"

### Lezione: i prompt OCR devono distinguere LIVELLO CONTRATTUALE da MANSIONE OPERATIVA

**Bug riscontrato:** il modale di creazione lavoratore mostrava sempre "Professional" nel campo Qualifica, indipendentemente dal cedolino scansionato.

**Causa root in `netlify/functions/scan-worker.ts`:**
Il `PROMPT_ANAGRAFICA` descriveva `ruolo` come "la qualifica o la mansione". Sui cedolini RFI/Trenitalia esistono DUE voci distinte:
- "Q.PROF" / "Qualifica" → categoria contrattuale (es. "Professional", "Specialist") — appartiene a `profiloProfessionale`
- "Mansione" / "Funzione" / "Profilo" → ruolo operativo specifico (es. "Macchinista", "Tecnico") — appartiene a `ruolo`

L'AI, vedendo la voce letterale "QUALIFICA: PROFESSIONAL" in alto sul cedolino, la prendeva e la metteva in `ruolo` come prima parola che il prompt chiedeva.

**Fix (doppia difesa):**
1. **Lato prompt** — riscritto PROMPT_ANAGRAFICA: separazione netta dei due campi con anti-pattern espliciti ("❌ SBAGLIATO: ruolo=Professional"), blacklist di token vietati in `ruolo` (Professional/Specialist/Quadro/Operaio/Impiegato/Livello X/Parametro N/codici come "B1"), istruzione "meglio vuoto che sbagliato". Temperature abbassata 0.1 → 0.0.
2. **Lato client** (`WorkerModal.compileDataFromAI`) — safety net `normalizeRuoloProfilo()`: se l'AI mette in `ruolo` qualcosa che matcha la blacklist (parole esatte + regex per Livello/Parametro/codici tipo "B1"), lo sposta automaticamente in `profiloProfessionale` (se vuoto) e svuota `ruolo`.

**Regole generali per prompt di estrazione dati strutturati:**
> Quando un PDF ha PIÙ campi con label simili (es. "Qualifica" vs "Profilo"), il prompt deve:
> 1. Definire ogni target field con la **fonte specifica** ("dove cercarlo: sezione X"), non solo il significato semantico
> 2. Includere una **blacklist esplicita** di valori che NON devono mai finire in quel campo
> 3. Fornire esempi anti-pattern ("❌ così no"), non solo positivi
> 4. Permettere il valore vuoto come fallback sicuro ("meglio vuoto che sbagliato")
> 5. Aggiungere una safety net client-side per i casi residui — i prompt LLM non sono mai deterministici al 100%

---

## 2026-05-19 — MonthlyDataGrid: re-render loop dopo scansione AI

### Lezione: MAI mettere uno state nelle deps di un useEffect se lo stesso effect lo aggiorna

**Bug riscontrato (segnalato dall'utente):** in Chrome, dopo l'inserimento di dati scansionati dall'AI nella tabella di `WorkerDetailPage`, le tabelle sembravano ricaricare continuamente. Riducendo la finestra il bug si fermava (scrollbar orizzontale spariva → niente eventi scroll → loop interrotto).

**Causa root in `components/WorkerTables/MonthlyDataGrid.tsx`:**
- `useEffect` aveva `[profilo, isScrolling]` come deps
- Lo scroll handler dentro l'effect chiamava `setIsScrolling(true)` e poi `setIsScrolling(false)` dopo 150ms
- Ogni cambio di `isScrolling` → effect ricreato → cleanup + nuovo `ResizeObserver` + nuovi listener ad ogni evento scroll
- Il `ResizeObserver` appena creato fa fire immediato di `updateWidth` → `setTableScrollWidth` → re-render
- Su schermo piccolo niente scrollbar orizzontale → nessun evento scroll → loop non si innesca

**Fix elegante:**
- State `isScrolling` mantenuto solo per il className (`pointer-events-none` durante scroll)
- Aggiunto `isScrollingRef` per il guard interno (`if (!isScrollingRef.current)`)
- Rimosso `isScrolling` dalle deps del useEffect → listener e observer creati una volta sola

**Regola generale:**
> Se un useEffect contiene listener/observer che chiamano `setX`, **X NON deve essere nelle deps**. Usa un `ref` per leggere il valore corrente dentro il callback. Le deps di un effect "setup-once" devono contenere solo identità stabili (props, config, non state che lo stesso effect muta).

**Bonus trovato durante la review:** `currentColumns = useMemo(..., [profilo])` usava `eliorType` senza dichiararlo nelle deps → cambio di `eliorType` non aggiornava le colonne. Aggiunto.

**Checklist da seguire per i prossimi effect con listener:**
1. Lo state nelle deps viene mutato dentro l'effect stesso? → spostalo in ref
2. L'effect crea un `ResizeObserver`/`MutationObserver`/`addEventListener`? → deps devono essere solo identità DOM/config, non state mutabili
3. Verificare deps del useMemo accanto: ogni variabile usata DEVE essere dichiarata

---

## 2026-05-15 — DynamicIsland: bug border-radius + fluidità

### Lezione 1: MAI duplicare `borderRadius` in `style` + `animate` su un `motion.div` con `layout`

**Errore commesso (primo fix):** ho applicato `borderRadius: <numero>` **sia** nello `style` **sia** nell'`animate` del motion.div principale. Convinto fosse "ridondante ma robusto". In realtà:

- Quando un altro state cambia (es. `display` della calcolatrice ad ogni click), React re-renders.
- Framer Motion vede sia `style.borderRadius` sia `animate.borderRadius` e va in confusione su quale è la "source of truth".
- Risultato: durante input numeri compaiono angoli appuntiti — il fix sembrava completo, era peggio del bug.

**Pattern canonico Framer Motion v11+:**
```tsx
<motion.div
  layout
  animate={{ borderRadius: 32 }}    // solo qui
  style={{ overflow: 'hidden' }}    // niente borderRadius
  transition={{ borderRadius: ... }} // animation curve
/>
```

**Quando hai un motion.div con `layout` prop e bisogna gestire un border-radius dinamico:**
- `animate.borderRadius` come numero (px) — Framer applica la sua correzione automatica durante layout shifts
- `style.overflow: 'hidden'` esplicito (non delegare a Tailwind class)
- `style.contain: 'layout'` per isolare i reflow interni dal layout calculation di Framer
- Niente classe Tailwind `rounded-*` sul motion.div che ha layout — verrebbe persa durante i transform

### Lezione 2: i flex item con `truncate` hanno bisogno di `min-w-0 flex-1`

**Errore commesso:** il display della calcolatrice aveva `<span className="truncate">` dentro un `flex justify-between`. Senza `min-w-0`, lo span ha `min-width: auto` (default CSS), quindi non si lascia comprimere sotto la sua larghezza naturale. Risultato: sub-pixel reflow del parent ad ogni input → Framer Motion misura un layout shift → applica un transform → distorce il border-radius.

**Pattern corretto per truncate in flex container:**
```tsx
<div className="flex justify-between">
  <button className="shrink-0">...</button>
  <span className="truncate min-w-0 flex-1 text-right">...</span>
</div>
```

`min-w-0` neutralizza il default `min-width: auto`, `flex-1` permette di prendersi lo spazio rimanente, `shrink-0` sui sibling fissi.

### Lezione 3: Spring damping > 1 = "pesante", non Apple-like

**Errore commesso:** primo tentativo con `stiffness: 280, damping: 38, mass: 1.0` → ζ = 38/(2·√(1·280)) ≈ 1.14 (overdamped). Razionale: "no overshoot = no angoli sbatacchiati". In pratica: l'utente ha percepito "non fluido" / "lento".

**Calibrazione iOS-realistica:**
- Apple Dynamic Island reale usa spring **sotto-critico** (ζ ≈ 0.83-0.95), non overdamped.
- Un piccolo overshoot percettivo = sensazione di "vita".
- Valori buoni: `stiffness: 380, damping: 30, mass: 0.85` (ζ ≈ 0.83, periodo ~300ms).
- Per layout dove serve zero overshoot certo: `stiffness: 380, damping: 34, mass: 0.85` (ζ ≈ 0.94, ma reattivo).

**Regola:** se l'utente dice "non fluido" e hai damping ≥ 1, abbassa damping prima di pensare ad altro.

### Lezione 4: STOP & re-plan quando il fix peggiora

Quando un fix sembra logico ma l'utente segnala che è peggiorato → **non insistere** con micro-aggiustamenti. Ridiagnosticare da zero il root cause (in questo caso: la duplicazione + il flex item senza min-w-0 erano due cause cumulative ignorate al primo round).

Pattern: leggere attentamente la documentazione delle librerie esterne quando si tocca un'API sottile come `layout`/`animate` di Framer Motion. Gli auto-correct delle librerie sono incompatibili con il "belt and suspenders".

### Lezione 5 (CRITICA): `layout` prop di Framer Motion **distorce intrinsecamente** il contenuto

**Errore commesso (terzo round):** ho insistito a usare `layout` prop sul motion.div principale convinto di poterlo "domare" con `borderRadius` animato + `contain: 'layout'`. **Sbagliato.**

**Come funziona davvero `layout`:**
- Framer Motion misura il bounding box prima e dopo il render.
- Per "animare" la transizione, applica un `transform: matrix(scaleX, scaleY, translateX, translateY)` sul nodo, e contrae/espande il transform fino al valore finale.
- **Conseguenza inevitabile**: il contenuto interno viene **scalato** non solo geometricamente ma visivamente — bordi, font, padding tutto "schiacciato" durante la transizione. Apple Dynamic Island NON si comporta così perché iOS anima width/height come proprietà nativa, non via transform.

**Aggravante**: `contain: 'layout'` PEGGIORA la situazione perché restringe il subtree di layout calculation che Framer userebbe per fare le correzioni automatiche. Non aggiungerlo mai accoppiato a `layout` prop.

**Pattern corretto per morphing "Apple-style" senza distorsione:**
```tsx
<motion.div
  // NO layout prop
  initial={false}
  animate={{
    width: <numero>,         // animato come property CSS reale
    borderRadius: <numero>,  // idem
    boxShadow: ...,
  }}
  transition={{
    width: FRAMER_PHYSICS.dynamicIslandLayout,
    borderRadius: FRAMER_PHYSICS.dynamicIslandLayout,
  }}
  style={{
    minHeight: ...,
    overflow: 'hidden',
    willChange: 'width, border-radius',
    // NIENTE contain: layout
  }}
>
  <AnimatePresence>{/* children con loro fade */}</AnimatePresence>
</motion.div>
```

**Effetto**:
- Width è interpolato come numero CSS reale → niente scale transform → niente distorsione.
- Border-radius animato senza essere distorto.
- Height: lasciata `auto` con `overflow: hidden` (è una piccola perdita di smoothness verticale, accettabile perché i child AnimatePresence fanno fade).
- I sub-AnimatePresence dei child gestiscono i loro mode → l'effetto "morph" estetico resta.

**Heuristica**: usa `layout` solo per micro-elementi (es. una pill che si sposta in una lista, dove il transform scale è poco visibile). Per container grandi con bordi e contenuto strutturato → animate width/height esplicitamente.

### Lezione 6: `backdrop-filter` + `border-radius` + child con `transform` = corner bug

**Sintomo descritto dall'utente:** "Lo sfondo non segue la cornice stondata, mostra gli angoli quando si premono i tasti calcolatrice."

**Causa:** È un comportamento documentato di Chrome/Safari. Il `backdrop-filter` (es. `backdrop-blur-md` di Tailwind) viene calcolato relativamente al **bounding box rettangolare** del nodo e **clippato dopo** dal border-radius. Durante un re-paint causato da un transform su un figlio (esempio: `active:scale-95` su un bottone cliccato), il compositor può esporre per uno o due frame il bounding box rettangolare del backdrop-filter PRIMA che venga applicato il clip del border-radius.

**Fix canonico:** forzare il container in un proprio stacking context isolato.
```tsx
style={{
  isolation: 'isolate',        // proprio stacking context → backdrop-filter clippato correttamente
  backfaceVisibility: 'hidden', // forza GPU layer (no conflict con `transform` di Framer)
  overflow: 'hidden',
}}
```

**Non fare:** `transform: translateZ(0)` come style se Framer Motion sta animando `x`/`y` — sovrascriverebbe il transform di Framer. `backfaceVisibility` ottiene lo stesso effetto compositor senza conflitto.

**Heuristica:** se vedi "angoli rettangolari" durante interazioni con figli, e il container ha `backdrop-filter` o `backdrop-blur-*`, è quasi certamente questo bug. `isolation: isolate` è il primo tentativo.

### Lezione 7: `transition-all` + `backdrop-blur` = corner repaint bug (causa profonda)

**Scoperto risolvendo il bug calcolatrice al terzo tentativo.** L'utente ha segnalato che lo stesso identico tipo di "angolo rettangolare visibile" compariva anche su una card statica (Pratiche Gestite Totali) in DashboardPage, completamente separata dal DynamicIsland. Diagnosi: **pattern condiviso**.

**Causa:** quando un container ha `backdrop-blur-*` (Tailwind) + `rounded-*` + `transition-all` (o `transition-[backdrop-filter,...]` esplicito), il browser dichiara che `backdrop-filter` è una proprietà animabile su quel nodo. Anche se il valore NON cambia mai, ad ogni repaint del nodo (es. causato da `active:scale-95` di un figlio, o da `hover:scale` su un sibling), il compositor ricalcola il backdrop-filter sul bounding box rettangolare PRIMA di applicare il clip del border-radius. Per uno o più frame, gli angoli rettangolari del backdrop sono visibili.

**Fix:** mai includere `backdrop-filter` (né `all`) nella lista di `transition-*`. Usare `transition` esplicito sulle property che effettivamente cambiano:
```tsx
// ❌ Causa corner bug
className="backdrop-blur-md rounded-2xl transition-all duration-500 hover:scale-105"

// ✅ OK
className="backdrop-blur-md rounded-2xl transition-[transform,box-shadow,border-color] duration-500 hover:scale-105"
```

**Su DynamicIsland (`getIslandStyles`):** rimosso `backdrop-filter` dalla lista `transition-[background-color,border-color,box-shadow,backdrop-filter,opacity]` → ora `transition-[background-color,border-color,box-shadow,opacity]`.

**Audit pattern da fare**: cercare nel progetto tutti i casi di `transition-all` su elementi con `backdrop-blur` → sostituire con transition esplicita. (Es. `.glass-panel`, `.glass-btn`, `.glass-input` in `index.css` hanno `backdrop-blur` ma niente `transition-all` esplicito → safe).

**Heuristica:** se due elementi NON RELATI mostrano lo stesso glitch visivo, la causa è quasi sempre in una utility/pattern CSS condivisa (`transition-all`, `glass-*` mixins, classi globali). Non perdere tempo a fixare uno specifico nodo prima di aver capito il pattern.

### Lezione 11 (2026-05-17): `position: fixed` viene catturato da antenati con `backdrop-filter`/`transform` → modali devono usare React Portal

**Errore commesso**: ho montato `<RagAdminPanel />` come child del `<div ref={islandRef}>` della Dynamic Island. Il modale ha `fixed inset-0 z-[9999]` ma all'apertura non copriva il viewport: appariva come un rettangolo nero confinato dentro l'area della pill della Dynamic Island. La Dynamic Island sembrava "crashare".

**Causa**: in CSS, `position: fixed` si ancora normalmente al viewport, MA se un antenato ha una di queste proprietà CSS, l'antenato diventa il containing block per i fixed discendenti:
- `transform` (qualsiasi, anche `translate(0,0)`)
- `filter`
- `perspective`
- `backdrop-filter` ✅ ← causa nel nostro caso
- `contain: paint`
- `will-change: transform`

Framer Motion applica `transform` ai motion.div animati, e la Dynamic Island ha un `backdrop-blur-2xl` su un wrapper. Risultato: il modale `fixed inset-0` finisce ancorato alla pill della Dynamic Island, non al viewport.

**Fix canonico**: usare React Portal per montare il modale come sibling diretto di `document.body`, fuori dal subtree problematico:

```tsx
import { createPortal } from 'react-dom';

return createPortal(
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[9999] ...">
        {/* modale */}
      </div>
    )}
  </AnimatePresence>,
  document.body
);
```

Note implementative:
- **SSR safety**: `if (typeof document === 'undefined') return null;` prima del `createPortal` per evitare crash in build SSR.
- **AnimatePresence + condizione**: spostare la condizione `isOpen` come child di AnimatePresence (`{isOpen && <motion.div .../>}`), NON come early-return esterno (`if (!isOpen) return null`). Altrimenti AnimatePresence non vede mai gli enter/exit dei figli.
- **Niente `backdrop-blur` su backdrop fixed**: combinato con border-radius/transform di figli crea repaint con corner clipping (vedi Lezione 6/7). Sul backdrop di un modale, opacità alta basta.

**Heuristica**: ogni volta che monti un modale dentro un component che ha `backdrop-blur`, `motion.div animate`, `filter`, o simili, **assumi** che il containing block sarà rotto e usa subito il portal. Non aspettare di vedere il bug.

**Audit pattern da fare**: cercare in tutto il progetto `position: fixed` (o classi Tailwind `fixed inset-0`) all'interno di subtree che hanno `backdrop-blur-*` o `motion.div animate={{ ...transform... }}`. WorkerModal e altri modali nel codebase usano lo stesso pattern dentro componenti potenzialmente problematici — verificare al prossimo bug.

---

### Lezione 10 (2026-05-16): Ticket sempre fuori dalle indennità + chiave interna vs display label

**Contesto**: follow-up sessione Clean Service. L'utente ha rilevato 3 problemi nel mio lavoro iniziale.

**Errore 1: ho incluso il codice ticket nelle indennità.**
Su Clean Service ho messo `{ id: '311', label: 'Ticket (311)', ... }` come ColumnDef in `INDENNITA_CLEAN_SERVICE`. Sbagliato. Il pattern RailFlow è:
- `getColumnsByProfile()` aggiunge una colonna **standard fissa** `{ id: 'ticket', label: 'Ticket', subLabel: 'Past.' }` in coda per TUTTI i profili (vedi `types.ts:214`).
- Il prompt OCR estrae il valore unitario del codice ticket in `ticketRate` (campo top-level del JSON).
- I dati salvati popolano `AnnoDati.ticket` da `ticketRate`.
- RFI (codici 0E99/0299/0293), Elior (codici 2000/2001/0293) — nessuno di questi codici compare nei rispettivi `INDENNITA_*`.

**Pattern**: prima di aggiungere un codice come ColumnDef, chiedersi "esiste già una colonna standard per questo concetto?" — ticket e arretrati hanno colonne fisse universali (vedi `COLONNA_ARRETRATI` e la pipeline `getColumnsByProfile`).

**Errore 2: ho usato `'Clean Service SRL'` come label nel selettore card del modal.**
Le altre 2 card hanno label brevi e uppercase (`'RFI'`, `'ELIOR'`) e sub brevi (`'Infrastrutture'`, `'Ristorazione'`). La mia label era 17 char + sub 22 char → outlier visivo. Da `WorkerModal.tsx:837`: `h-[140px]` fisso, `grid-cols-3` (~180px wide). Le label devono stare in 1 riga di ~12 char + sub di ~14 char.

**Pattern**: in un componente con dimensioni fisse e items che si comparano visivamente, **misurare la lunghezza testo** prima di scegliere label. Maiuscola uniforme aiuta perché tutti i char hanno larghezza simile.

**Errore 3: ho usato `CLEAN_SERVICE` come chiave interna ma non ho gestito il display.**
La chiave TypeScript `CLEAN_SERVICE` (underscore obbligatorio per identifier validi) appare con underscore visibile ovunque sia renderizzata raw: badge "CLEAN_SERVICE ATTIVO", filter pill "CLEAN_SERVICE", header tabella. Il fix corretto è **separare chiave interna da display label** centralizzando in un helper (`getProfiloBadgeLabel` con `replace(/_/g, ' ')` default), così ogni callsite esistente si aggiorna in cascata.

**Pattern**: quando una chiave deve essere multi-word ma TypeScript-friendly, accetta l'underscore SOLO se hai un helper centralizzato per il display. Mai assumere che il valore raw sia user-facing.

**Bonus: verify-payslip e scan-payslip vanno tenuti sincronizzati.**
Ho aggiunto un nuovo profilo a `scan-payslip.ts` (estrazione) ma dimenticato `verify-payslip.ts` (verifica matematica post-estrazione). Risultato: il verifier cade nel fallback generico e segnala falsi positivi su pattern noti (asterischi, UNA TANTUM). 

**Pattern**: in RailFlow ci sono **2 prompt Gemini paralleli** per ogni profilo (estrazione + verifica). Modificarne uno richiede modificare l'altro per simmetria. Aggiungere un profilo = 2 blocchi di prompt, non uno solo.

---

### Lezione 9 (2026-05-16): Profili aziendali RailFlow — checklist dei 4-5 punti di registrazione

**Contesto**: sessione "Rekeep → Clean Service SRL". Sostituire/aggiungere un profilo aziendale di sistema NON è una sola operazione: il profilo è registrato in **5 zone separate** del codebase. Saltarne anche una rompe rispettivamente: griglia tabella, dropdown modal, prompt OCR, anagrafica AI, e routing UI (badge/filter/PEC).

**I 5 punti di registrazione** (in ordine di importanza):

1. **`types.ts`** — `ProfiloAzienda` union, `INDENNITA_*` columns, switch in `getColumnsByProfile()`. Senza questo, la tabella non mostra le colonne giuste.
2. **`netlify/functions/scan-payslip.ts`** — `PROMPT_*` + `PROMPT_DIRECTORY[KEY]`. Senza, l'OCR cade nel `PROMPT_GENERICO` e i codici specifici dell'azienda non vengono estratti.
3. **`netlify/functions/scan-worker.ts`** — esempio lista aziende nel prompt anagrafica. Senza, l'autocompilazione AI del modal non riconosce l'azienda dalla testata busta paga.
4. **`components/WorkerModal.tsx`** — `THEMES.<KEY>` (color/gradient/icon), `OPTIONS` array (label/sub), `validCompanies` array, `shellTheme` default. Senza, la modal non offre la scelta o crasha.
5. **Riferimenti scatter** — `App.tsx`, `WorkerCard`, `WorkerDetailPage` (PROFILE_CONFIG + standardProfiles + badge), `CompanyBuilder` (SYSTEM_COMPANIES), `StatsDashboard`, `WorkerTables/*` (Indemnity, Annual, Relazione), `usePayslipUpload`, `ArchivePage`, `DashboardPage` (counter + filter), `utils/printTables` (CCNL). Senza, la UI mostra il profilo come "custom" anziché di sistema.

**Audit finale**: `grep -rn "<OLD_KEY>" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md"` deve restituire zero match in codice funzionale (i match in `tasks/*.md` sono OK perché descrittivi).

**Errore da evitare**: assumere che esista una cartella `src/config/profiles/` come faceva supporre il suggerimento dell'utente. Il pattern reale è **centralizzato in `types.ts` + scatter UI**. Non creare nuove architetture senza prima esplorare le esistenti.

**Sull'interazione con l'utente**:
- L'utente ha chiarito le strategie di rename solo dopo `AskUserQuestion`. Senza chiedere, avrei dato per scontato "hard replace + migrazione Supabase" sbagliando. **Pattern**: prima di pianificare una sostituzione "globale", chiedere se i dati esistenti vanno preservati.
- Quando ho suggerito un'aggiunta non strettamente richiesta (immagine Unsplash nel theme), l'utente l'ha rifiutata con "no non mettere un'immagine". **Pattern**: se l'utente è ambiguo su un'aggiunta opzionale, includerla solo dopo conferma esplicita, non assumere.

---

### Lezione 8: `filter: blur()` su elementi out-of-bounds NON è clippato in modo affidabile da `overflow: hidden`

**Scoperto vedendo le foto utente** (la card "Pratiche Gestite Totali" aveva un angolo "appuntito" in alto a destra — era il blob blu `top-[-50%] right-[-50%] w-96 h-96 blur-[100px]` che sticka fuori).

**Causa:** quando un elemento ha `filter: blur(N)` con `N` grande (es. `blur-[100px]`), il browser alloca un **buffer di rendering più grande del bounding box dell'elemento** (per accomodare l'halo del blur). Questo buffer può eccedere il `overflow: hidden` del parent, specialmente se il parent ha `isolation: isolate` (che crea un nuovo stacking context con composite separato).

**Sintomi visivi:**
- Una "macchia" colorata visibile in un angolo del container, anche se il blob è teoricamente clippato
- L'angolo del container appare "non arrotondato" perché il blob spilla oltre il border-radius
- Particolarmente visibile su Chrome/Safari con GPU rendering

**Fix robusti (in ordine di preferenza):**

1. **Inner wrapper con `overflow: hidden` + `rounded-*` espliciti**: wrappa le decorations in un sub-div che ha gli stessi vincoli del parent. Forza un secondo livello di clipping che il compositor deve onorare:
   ```tsx
   <div className="rounded-[2.5rem] overflow-hidden ...">
     <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
       {/* blob qui dentro */}
     </div>
     {/* content */}
   </div>
   ```

2. **`clip-path: inset(0 round Xrem)`** sul container: è un clipping GPU-level più affidabile di overflow+border-radius, perché il browser lo applica PRIMA del calcolo dei filtri:
   ```tsx
   className="... rounded-[2.5rem] overflow-hidden [clip-path:inset(0_round_2.5rem)] ..."
   ```

3. **Limitare il blur**: `blur-[100px]` è spesso eccessivo. `blur-[60px]` con un blob più piccolo dà effetto simile senza overflow.

**Pattern applicato nelle 3 card DashboardPage**: combinati 1+2 (inner wrapper + clip-path). Per DynamicIsland non applicabile clip-path perché borderRadius è animato, ma il fix Lezione 7 + Lezione 6 + rimozione del `layout` dal glow esterno è bastato.

### Lezione 12 (2026-05-22): sincronizzazione UI — evidenzia, non scrollare in automatico

Implementando la sync visore→tabella (badge mese + selezione automatica della riga del
mese mostrato nel visore), il primo tentativo usava `scrollIntoView({behavior:'smooth'})`
sulla riga sincronizzata. L'utente l'ha trovato **fastidioso**: a ogni cambio file la
schermata "scattava" su/giù.

**Lezione:** per una sincronizzazione di selezione, l'**evidenziazione** (sfondo/ring ben
visibile) basta ed è non invasiva. Lo scroll automatico va evitato: sposta il punto di
vista dell'utente senza che l'abbia chiesto. Se la lista è corta (qui 12 righe, tutte a
schermo) non serve; se fosse lunga, al massimo `scrollIntoView({block:'nearest'})`, che
scrolla solo se l'elemento è davvero fuori vista.

**Corollario (stessa sessione):** un nuovo elemento UI va inserito verificando lo spazio
REALE del contenitore. Il badge del mese, messo nella barra comandi del visore mentre
c'era ancora il pulsante "Smart Upload", la tagliava. Rimosso quel pulsante (doppione
dell'"AI Agent" — stesso `handleBatchUpload`), lo spazio si è liberato e il badge ci sta.
Anche: un primo highlight `bg-indigo-50` era troppo chiaro → quasi invisibile; servono
tinte piene (`bg-indigo-200` / `dark:bg-indigo-500/30`) perché una selezione si veda.
