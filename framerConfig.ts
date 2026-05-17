// --- framerConfig.ts ---
// Centralizzazione delle fisiche di animazione per Framer Motion
// Questo sostituisce i valori "hardcoded" sparsi nei componenti per un tuning olistico dell'UX.

export const FRAMER_PHYSICS = {
    // Fisica standard in stile Apple (Fluida e netta, usata nei modali)
    apple: { type: "spring" as const, damping: 25, stiffness: 200 },

    // Fisica rimbalzante e pesante (Ideale per caricamenti modali completi, es. WorkerModal)
    heavyBounce: { type: "spring" as const, stiffness: 250, damping: 25, mass: 1.2 },

    // Fisica scattante (Ideale per icone, piccoli tooltip o espansioni di layout rapide)
    snappy: { type: "spring" as const, stiffness: 400, damping: 30 },

    // Fisica reattiva per tab o liste (WorkerDetailPage)
    smooth: { type: "spring" as const, stiffness: 300, damping: 30 },

    // Fisica lentissima (background o grossi spostamenti)
    lazy: { type: "spring" as const, stiffness: 120, damping: 20 },

    // Fisica calibrata sul Dynamic Island reale di iOS 16/17: vivace e sotto-critica.
    // ζ ≈ 0.83 → vita percepita senza overshoot evidente, periodo naturale ~300ms.
    dynamicIsland: { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.85 },

    // Variante "layout" per il resize del contenitore: ζ ≈ 0.945, quasi critico
    // ma più reattivo (no overshoot, no senso di "pesante").
    dynamicIslandLayout: { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.85 },

    // Variante "elastic" con overshoot controllato (~6%, ζ ≈ 0.72).
    // SOLO per liquid morphing di width/borderRadius dell'isola — non usare altrove
    // (su modali/card creerebbe rebound indesiderato).
    dynamicIslandElastic: { type: "spring" as const, stiffness: 380, damping: 26, mass: 0.85 },
};

// Easing curve "iOS-standard" per enter/exit dei child interni all'isola.
// È la curva canonica usata da Apple per le transizioni di sistema.
export const APPLE_EASE = [0.32, 0.72, 0, 1] as const;
