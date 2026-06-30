# Lessons — Self-Correction Log

> Pattern e errori da evitare nelle prossime sessioni.
> Aggiornato dopo ogni correzione utente.

## 2026-06-30 — Due "Avella Antonio" NON sono un doppione: omonimi (Foggia vs Termoli)

**Contesto:** audit visivo dell'archivio. Visti due "Avella Antonio" sotto RFI, stesso ruolo, **entrambi
228 buste** → ho concluso "doppione / re-import". **Sbagliato.** Sono due **persone diverse**: uno di
**Foggia**, uno di **Termoli** (lo si legge nella testata delle buste). I dati lo confermano: 0 storage_path
condivisi, 228 file distinti ciascuno in cartelle worker separate. Il 228 = 19 anni pieni, coincidenza.

**Lezione:**
1. **Stesso nome + stesso conteggio buste ≠ doppione.** In RFI ci sono omonimi su sedi diverse. Prima di
   chiamarlo doppione, **leggi la SEDE nella testata della busta** (e confronta gli `storage_path`: se sono
   in cartelle `worker_id` diverse e non si sovrappongono, sono archivi distinti → persone distinte).
2. Non proporre MAI merge/dedupe di worker su base nome. Vedi memoria `project-avella-antonio-omonimi`.
3. Il vero problema non è "doppione" ma **UI ambigua**: lista archivio e chip dashboard mostrano solo
   "Avella Antonio" → confondono due persone. Fix = esporre la sede/ruolo distintivo in quei punti compatti.

## 2026-06-30 — Recupero buste misfiled: lo scan aggiorna la griglia `anni` con un MERGE che lascia residui

**Contesto:** primo dei 7 recuperi delle buste col nominativo/mese sbagliato (Mottola, Novembre
2008 — vedi memoria `project-audit-mese-archivio-vs-testata`). Caricata e ri-scansionata la
busta vera, ho verificato i dati e ho trovato che la riga di **griglia** (`worker_profiles.anni`)
di novembre aveva sì le voci nuove corrette, ma si portava dietro `imponibile_tfr_mensile` e
`fondo_pregresso_31_12` (più la nota "[⚠️ Conguaglio mese prec.]") del **vecchio** contenuto
(dicembre), mentre la riga di dicembre ne era priva.

**Lezione (vale per i 5 recuperi rimasti — Cataneo Pasquale, Tozzi ×2, Avella, Cataneo V, Gentile):**
1. Lo **scan di una busta aggiorna SIA `payslip_metadata` SIA la griglia `anni`**, ma con un MERGE
   che **non azzera** i campi non presenti nel nuovo scan. Ri-scansionando un mese prima misfiled,
   restano residui del vecchio contenuto. Sono due store separati: copiare `extracted_data` via SQL
   NON tocca la griglia, e viceversa.
2. **Prima di chiamarlo "bug del totale", verifica se il campo residuo entra in un calcolo.** Qui no:
   `imponibile_tfr_mensile` → `utils/tfrCalculator.ts:58-63` prende il `Math.max` dell'**anno**
   (mese irrilevante); `fondo_pregresso_31_12` → solo scritto (`usePayslipUpload.ts`), mai letto; le
   differenze usano le voci, ora corrette. → residuo **cosmetico**, lasciato lì (non vale il rischio
   `feedback-anni-clobber-stale-browser` di un edit SQL su `anni`). Se in un caso il residuo fosse un
   total-mover, correggere DALL'APP (griglia mensile) + hard-refresh, non via SQL.
3. **Inserire la busta in archivio ≠ riempire la griglia che fa i conti.** "Caricata e scansionata"
   non basta a dire che i totali sono giusti: controllare sempre la riga `anni` del mese recuperato.

## 2026-06-13 — Split buste Elior cartacee (Ghiro/Mastropasqua): 2 trappole

### Lezione A — Box "PERIODO DI PAGA" NON è a quota fissa: scansioni con margine variabile
Dividendo i PDF scansionati ho ritagliato una fascia FISSA in fondo pagina (y≈0.90–0.96)
per leggere il mese. Su un blocco di pagine il cedolino era scansionato più in alto (largo
margine bianco sotto) → la fascia cadeva nel vuoto e ho scambiato **buste reali per pagine
bianche** (Ghiro 1.pdf p29-45 = mesi Nov2019→Dic2020, NON vuote). **Regola:** per leggere un
campo da scansioni, ritaglia una fascia ALTA/relativa al contenuto (qui [0.78,0.99]) o trova
il bbox del contenuto; mai fidarsi di una soglia di "inchiostro" fissa (le scansioni Ghiro
erano molto più chiare di Mastropasqua → stessa soglia = falsi vuoti). E i **doppioni di
scansione** (stesso cedolino due volte, es. Set2023 ×2) sballano la sequenza monotòna: leggere
il box di OGNI pagina, non inferire dal vicino.

### Lezione B — Segno del deskew: VERIFICARE numericamente, non a occhio
Ho raddrizzato 101 pagine ruotando di `corr` invece di `-corr` → ho **raddoppiato** lo storto
(da −1.55° a −3.10°). Il test "before/after" a occhio mi era sembrato ok (ho visto ciò che mi
aspettavo). L'ha smascherato solo la **ri-misura quantitativa** del residuo. **Regola:** dopo
un'operazione geometrica (rotazione/deskew/scala) misura il risultato con la stessa metrica,
non fidarti dell'eyeball; tieni il sorgente intatto così puoi rigenerare lossless e ricorreggere.

## 2026-06-06 — Variabili a virgola decimale: la mia query SQL li scartava e ho inventato un bug inesistente

### Lezione: normalizzare la virgola prima di sommare i valori di `anni`, e fidarsi del totale che l'utente vede nell'app

**Cosa è successo:** verificando Micaletti 2025 sommavo i codici variabili da `worker_profiles.anni`
con il filtro `(elem->>k) ~ '^-?[0-9.]+$'`. Ma molti valori sono **stringhe in formato italiano con
la virgola** (`"390,92"`), inseriti a mano nell'app. Il mio regex (solo punto) li **scartava come 0**.
Risultato: leggevo 2025 = 3.140 con Aprile/Nov/Dic "vuoti", mentre il totale reale era ~7.958. L'utente
mi diceva "è 7000" e io insistevo col mio numero, arrivando a diagnosticare un **clobber da snapshot
vecchio inesistente** e a fargli fare hard refresh + micro-modifiche inutili.

**L'errore doppio:** (1) tecnico — sommare valori jsonb senza normalizzare la virgola (`replace(x,',','.')`)
su un'app ITALIANA dove l'inserimento manuale usa la virgola; (2) di metodo — ho creduto alla mia query
grezza più che all'osservazione diretta dell'utente sull'app, e ho costruito una teoria di bug elaborata
su un dato falso invece di sospettare prima il caso più banale (formato decimale).

**Regola per me:** quando sommo importi da `anni`, usare SEMPRE `replace(elem->>k, ',', '.')::numeric`
e un filtro `~ '^-?[0-9.]+$'` DOPO il replace. Se l'utente vede nell'app un totale diverso dal mio,
il sospetto n.1 è la MIA lettura (formato/parsing), non un bug di persistenza: prima di gridare al clobber,
dump del record grezzo e verifica del formato. Le mie % "proxy" via SQL vanno marcate come tali e
ricalcolate con la virgola gestita. Vale per tutte le pratiche verificate finora.

## 2026-06-03 — Non accusare di "errore/ambiguità" un testo legale per una mia sovra-lettura

### Lezione: prima di dire che il ricorso "si contraddice", verifica che le due frasi parlino DAVVERO della stessa cosa

**Cosa è successo:** ho segnalato come "ambiguità grave" del ricorso due frasi sul metodo della
media: Conclusioni = *"media ultimi 12 mesi precedenti la fruizione"*; descrizione conteggio =
*"per ciascun anno lavorativo… media × ferie"*. Ho letto la seconda come "media dello STESSO anno"
e costruito perfino un documento-quesito per l'avvocato.

**L'errore:** sovra-interpretazione. La frase "per ciascun anno lavorativo" descrive solo la
**meccanica** (per ogni anno si calcola una media e la si moltiplica per le ferie); NON dice quale
periodo usare. Il periodo lo fissa **già** la frase delle Conclusioni ("12 mesi precedenti" =
anno precedente = Metodo A). Lette insieme sono coerenti. Nessuna contraddizione, nessun errore
dell'avvocato — che peraltro aveva sempre detto "Metodo A".

**Regola per me:** quando due passaggi sembrano confliggere, chiediti se uno fissa il *cosa/quale*
e l'altro descrive solo il *come*. Non trasformare una mia incertezza interpretativa in un "errore"
della controparte/avvocato, e non far partire artefatti (documenti, quesiti) prima di aver
escluso la lettura più semplice e coerente. Vale doppio sui testi legali firmati dal cliente.

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

### Lezione 13 (2026-05-28): "aprire i file dal visore" → chiarire il MODELLO DI INTERAZIONE, non solo l'ambito

Richiesta: far aprire al visore (sola lettura) le buste paga salvate sul DB, non solo
quelle caricate da PC. Prima di implementare ho chiarito l'**ambito** (solo visore vs anche
owner) ma ho assunto l'**interazione**: auto-caricamento di TUTTE le buste nel SplitView
all'apertura del lavoratore. L'utente voleva invece la **scelta manuale**: SplitView vuoto,
si clicca una busta dal tab Archivio e quella si carica nel pannello laterale (non window.open
in nuova scheda).

**Lezione:** quando il verbo è generico ("aprire", "caricare", "mostrare"), il punto da
chiarire non è solo *chi/cosa* ma *come avviene l'azione*: automatica vs su richiesta, una vs
tutte, in-place vs nuova scheda. Sono scelte UX che cambiano l'implementazione. Chiedere
entrambe le dimensioni (ambito + interazione) prima di scrivere codice.

**Nota tecnica riusabile:** le RLS Supabase consentivano già al viewer la SELECT su
`payslip_metadata` + `storage.objects` (policy con `OR auth.uid() = '<viewer-uid>'`), quindi
zero modifiche DB. Bastava il client. Per mostrare un URL firmato Supabase in `<object>` PDF
serve spogliare la query string prima del check `.endsWith('.pdf')` (l'URL finisce con
`?token=…` ma il path conserva l'estensione). Il bottone "Spiega" (Gemini) va nascosto al
viewer anche nel SplitView, ora che può avere file caricati.

**Aggiornamento (stessa feature):** due bug emersi nella seconda iterazione:
1. **Estensione `.PDF` maiuscola.** I file archiviati hanno filename tipo `Agosto 2025.PDF`.
   Il check `url.split('?')[0].endsWith('.pdf')` per decidere se mostrare il PDF nell'`<object>`
   falliva (case-sensitive) → object `display:none` → fallback `<img>` che non renderizza un PDF
   → pannello vuoto. Fix: `.toLowerCase().endsWith('.pdf')`. Lezione: mai assumere il case delle
   estensioni dei file caricati dall'utente.
2. **TDZ nella dependency array di useEffect.** Un `useEffect(..., [isReadOnly, archivedPicks, …])`
   piazzato PRIMA delle `const isReadOnly = …` / `const [archivedPicks] = useState(…)` compila con
   vite ma crasha a runtime (e tsc dà TS2448): la **deps array è valutata subito** alla chiamata di
   useEffect, non dopo. Il corpo del callback invece può referenziare const dichiarate più sotto
   (gira dopo il render). Lezione: se un effetto ha variabili nella deps array, va collocato DOPO le
   loro dichiarazioni; `tsc --noEmit` lo cattura, `vite build` no.

**Aggiornamento 2 (stessa feature):** lista lunga in una colonna flex `items-stretch` →
faceva crescere la pagina. Il contenitore riga prende l'altezza del figlio più alto: se il
picker (molti anni) supera la tabella accanto, la riga si allunga e la pagina si espande.
Fix: rendere il contenuto scrollabile `absolute inset-0` dentro un body `relative
overflow-hidden`, così NON contribuisce all'altezza intrinseca e scrolla entro l'altezza
guidata dal sibling (la tabella). Pattern riusabile per "pannello affiancato sempre alto
quanto il vicino".

---

## 2026-05-31 — Nuove voci di UI/export vanno gabbiate dietro `isReadOnly` di default

**Contesto:** ho aggiunto la voce di menu "Esporta Concluse (ZIP)" senza gabbiarla
dietro `isReadOnly` → sarebbe stata visibile anche all'account in sola lettura del
sindacalista. L'utente l'ha notato prima del deploy.

**Lezione:** quando aggiungo un'azione alla dashboard (specie nel menu Dati o azioni
sulle pratiche), il default è **nasconderla al viewer readonly** con il pattern già in
uso lì: `...(isReadOnly ? [] : [{ …item… }])`. La readonly del sindacalista è una vista
di consultazione: strumenti di workflow interno (export verso il mio Desktop, import,
ecc.) NON devono comparirle. Cfr. memoria `auth-readonly-viewer` (lì è lato dati/RLS;
qui è lato UI — vale lo stesso principio). Verificare SEMPRE "questa cosa la deve vedere
il sindacalista?" prima di considerare finita una feature di dashboard.

---

## 2026-06-04 — In verifica pratica, controllare che l'anno di riferimento (N-1) sia completo

**Contesto:** verificando Borriello ho notato `start_claim_year = 2020` ma il 2019 (anno
di riferimento per il 2020) aveva una sola busta, 0 giorni lavorati e 0 variabili: il
calcolo feriale del primo anno non aveva una media storica N-1 da cui attingere. L'utente
ha corretto spostando lo start al 2021 (riferimento = 2020, anno pieno) e mi ha chiesto di
segnalare i casi analoghi in futuro.

**Lezione:** il ricalcolo feriale usa SEMPRE la media dell'anno precedente. Quindi in ogni
verifica di pratica devo controllare che l'anno `start_claim_year - 1` abbia ~12 mesi reali
(giorni>0 e variabili>0). Se è rado/vuoto (tipico di assunzioni a fine anno) → segnalarlo
subito: lo start year va probabilmente spostato avanti al primo anno con un riferimento
completo. Aggiunto ai controlli standard insieme a: backfill fisse completo, 0 duplicati
archivio, % coerente, anni a variabili basse. Cfr. memoria `feedback-anno-riferimento-completo`.

## 2026-06-04 — Rispondere SEMPRE in italiano

**Contesto:** l'utente mi ha fatto notare che a volte scivolo in inglese.

**Lezione:** ogni testo rivolto all'utente va in italiano, senza eccezioni (analisi,
sintesi, sezioni tecniche, riepiloghi). Codice/commenti del repo già in italiano: mantenerli.
Cfr. memoria `feedback-rispondere-sempre-italiano`.

## 2026-06-05 — Dopo ogni verifica pratica, aggiornare la checklist sul Desktop

**Contesto:** ho verificato Di Ponte Armando sul DB ma ho riportato l'esito solo a parole,
senza aggiornare `~/Desktop/Checklist_pratiche_RFI.pdf`. L'utente mi ha detto che la checklist
va aggiornata **ogni volta** che controlliamo una pratica.

**Lezione:** la verifica di una pratica non è "finita" finché non ho aggiornato il tracciamento
che l'utente usa per coordinarsi. È un passo della procedura, non un extra opzionale: marcare la
riga del lavoratore (① backfill verificato sul DB; ③ documenti generati) e rigenerare il PDF.

**Root cause della fragilità (risolta):** la sorgente HTML stava in `/tmp` (effimera) → tra una
sessione e l'altra spariva e il PDF non era più aggiornabile senza ricostruirlo da zero. Spostata
in `knowledge/fonti/checklist_pratiche_rfi.html` (durevole, gitignorata per i nomi). Regola
generale: **un artefatto che va aggiornato ricorrentemente non può avere la sua sorgente in /tmp**;
metterla in un percorso stabile e documentare il comando di rigenerazione.
Cfr. memoria `feedback-aggiorna-checklist-desktop`, `knowledge/verifica-pratica.md`.

## 2026-06-09 — Quando tocchi il layout, verifica gli elementi FIXED che ci galleggiano sopra

**Contesto:** ho compattato l'header della dashboard (logo 128→56px) per guadagnare spazio
verticale. Risultato: i bottoni azione sono saliti nella fascia della Dynamic Island (fixed
top-center) e "Archivio" ci finiva sotto. In più 56px/3xl era troppo piccolo per il gusto
dell'utente: ho ottimizzato una metrica (px verticali) sacrificando l'identità del brand.

**Lezione (doppia):**
1. Prima di spostare/ridurre elementi di layout, inventariare gli elementi `fixed`/overlay
   che condividono la stessa fascia (isola top-center, toast top-right, AreaSwitch bottom-left,
   bottoni bottom-right) e verificare le collisioni alle varie larghezze. La soluzione robusta
   non è "spostare di qualche px" ma riservare le corsie a livello di layout (header a 3 colonne
   con corsia centrale vuota per l'isola).
2. "Compatto" per l'utente non significa "minimo": il brand può perdere spazio ma non presenza.
   Quando riduco qualcosa di identitario, proporre il punto di mezzo (80px/4xl), non l'estremo.

## 2026-06-13 — Niente "abbellimenti" aggiunti: l'utente vuole funzione + dati veri, non decorazioni

**Contesto:** sul redesign cassetti ho aggiunto, uno dopo l'altro, elementi bocciati: panoramica
"vetrata"/totali per stadio ("a noi interessano solo i badge"), legame gentile testata↔card
(hairline+alone, "non mi piace per niente"), empty-state "n/d" sul Ticket OFF ("sembra rotto").
Pattern coerente con altre bocciature passate: glow cursor-following (K/S), e in generale le
aggiunte estetiche/aggregati che non sono dato operativo.

**Lezione:**
- Questo utente premia **funzione + immediatezza + dato reale**, non orpelli. Default per "renderlo
  più bello": migliorare gerarchia/spaziatura/colore di ciò che ESISTE, NON aggiungere nuovi
  elementi decorativi (aloni, hairline di collegamento, barre riassuntive, placeholder testuali).
- Stati "vuoto": MAI placeholder che sembrano rotti (`-`, `n/d`). Mostrare un **valore reale**
  (`0,00 €`) o lo stato esplicito; allineare i KPI fra loro.
- Quando propongo qualcosa di "spettacolare", chiarire che lo spettacolo deve nascere dagli
  elementi reali (le card, i badge), non da overlay aggiunti — e aspettarmi che gli overlay
  vengano tagliati. Cfr. `tasks/ux-backlog.md` (famiglia cursor-following bandita).
- **Non allargare lo scope ai vicini.** Stesso giorno: il fix era SOLO la barra strumenti, ma
  io ho "unificato" anche i filtri azienda e cambiato larghezze/allineamento → bocciato ("i
  filtri andavano lasciati identici, dovevamo sistemare solo la barra sotto"). Quando l'utente
  indica UN elemento, toccare solo quello; le incoerenze percepite da me sui vicini NON sono un
  invito a rifattorizzarli. Se penso valga la pena, lo PROPONGO a parte, non lo eseguo d'ufficio.
