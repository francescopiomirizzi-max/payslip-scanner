# UX Backlog — Proposte congelate post-backend

> Proposte UX/visive approvate concettualmente dall'utente ma **rinviate** in attesa del completamento del backend RAG/Supabase.
> Una volta consolidato il backend, riprendere da questa lista (priorità in ordine).

---

## Stato del componente Dynamic Island: SIGILLATO ✅

Il bundle "Polish Dynamic Island" (G + H + J + F) ha completato il lavoro sull'isola. Non aprire altre modifiche al componente senza motivo strutturale finché non si è passati al backend.

---

## Bundle "Wow Dashboard" (priorità 1 post-backend)

### E — Tilt 3D al hover sulle card stat (Pratiche/Netto/Ticket)
**Scope:** sulle 3 card del `DashboardPage.tsx` (righe 342, 390, 421) attualmente con solo `hover:scale-[1.03]`, aggiungere perspective tilt (max 6-8°) che segue la posizione del mouse sopra la card + highlight gradient radiale che traccia il cursore.

**Tecnica:**
- Custom hook `useMouseTilt(maxAngle = 6)` → restituisce `{ ref, transform, gradientPos }`
- `transform: perspective(800px) rotateX(...) rotateY(...)` con interpolazione lineare basata su posizione mouse normalizzata
- Highlight radial gradient via CSS custom property `--mouse-x` / `--mouse-y`

**Costo:** ~60 LOC (40 hook + 20 integration per card).

**Dipendenze:** nessuna backend. Può partire subito post-backend.

**Motivazione rinvio:** trasformazione estetica importante della Dashboard, vale la pena farla dopo aver consolidato il caricamento dati (RAG completion).

---

### ~~N — Glass shimmer on hover sulle card~~ ✅ FATTO 2026-06-10
Implementato con keyframe dedicato `card-sweep` in `index.css` (il nome `shimmer` era
già preso dallo skeleton, con doppia definizione in conflitto tra config e css);
animazione attiva solo in `:hover` (zero GPU a riposo), variante dark più tenue.

---

### O — Skeleton loading shimmer
**Scope:** quando `isWorkersLoading: true` (vedi `hooks/useWorkers.ts`), oggi probabilmente c'è un loader generico nella DashboardPage. Sostituirlo con **skeleton card** che mimano la struttura reale dei WorkerCard con effetto shimmer (animate-shimmer già pronto in `index.css`).

**Tecnica:**
- Nuovo componente `<WorkerCardSkeleton>` che replica le proporzioni/layout di `WorkerCard.tsx`
- Background `bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200` con `animate-shimmer`
- Renderizzare 6-8 skeleton in grid mentre `isWorkersLoading === true`

**Costo:** ~50 LOC (nuovo componente + integration in DashboardPage).

**Dipendenze:** **dipende da backend** — serve sapere quanto dura tipicamente il caricamento Supabase per calibrare la transizione (snap immediato se < 200ms, skeleton se > 500ms).

---

### ~~S — Smart cursor highlight (hero area)~~ ❌ BOCCIATO 2026-06-10
Implementato e RIMOSSO nella stessa sera su feedback utente: il glow che segue il
cursore non gli piace. **Non riproporre** effetti cursor-following; stessa famiglia
di K (magnetic cursor) → considerare anche K a rischio bocciatura.

---

## Ordine di implementazione consigliato (post-backend)

1. ~~**N**~~ ✅ fatto 2026-06-10 · ~~**S**~~ ❌ bocciato 2026-06-10
2. **E** (tilt 3D, ~60 LOC, sostanzioso ma additivo) — prossimo
3. **O** (skeleton, ~50 LOC, va calibrato sui tempi reali del backend Supabase)

---

## Altre idee tenute in mente (non bundle ufficiali)

Da rivalutare quando il backend è chiuso:

- **D**. Counter rolling slot-machine style per i numeri (`AnimatedCounter` esistente upgradabile)
- **G+ extended**. Liquid morphing più aggressivo con keyframes esplicite di width/borderRadius
- **K**. Magnetic cursor su isola idle (entro 50px attrae l'isola di 4px)
- **L**. Theme transition wipe (cerchio espandente dall'icona Sun/Moon al toggle)
- **P**. Worker card flip 3D al hover
- **R**. Parallax depth scroll su DashboardPage
- **T**. Sound design opt-in (Apple-style discrete sounds)

---

## Regole per riprendere il backlog

1. **Verificare prima che il backend sia stabile** — niente UI work se il caricamento dati ha edge case aperti.
2. **Implementare un bundle alla volta**, completando il review/verify prima di passare al prossimo.
3. **Aggiornare questo file** rimuovendo le voci completate o spostando in `tasks/todo.md` quelle in progress.
4. **NON tornare** sul componente Dynamic Island a meno di bug regressioni reali — è considerato sigillato.
