# Lessons — Self-Correction Log

> Pattern e errori da evitare nelle prossime sessioni.
> Aggiornato dopo ogni correzione utente.

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
