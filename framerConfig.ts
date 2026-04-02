// --- framerConfig.ts ---
// Centralizzazione delle fisiche di animazione per Framer Motion
// Questo sostituisce i valori "hardcoded" sparsi nei componenti per un tuning olistico dell'UX.

export const FRAMER_PHYSICS = {
    // Fisica standard in stile Apple (Fluida e netta, usata nei modali)
    apple: { type: "spring", damping: 25, stiffness: 200 },
    
    // Fisica rimbalzante e pesante (Ideale per caricamenti modali completi, es. WorkerModal)
    heavyBounce: { type: "spring", stiffness: 250, damping: 25, mass: 1.2 },
    
    // Fisica scattante (Ideale per icone, piccoli tooltip o espansioni di layout rapide)
    snappy: { type: "spring", stiffness: 400, damping: 30 },
    
    // Fisica reattiva per tab o liste (WorkerDetailPage)
    smooth: { type: "spring", stiffness: 300, damping: 30 },
    
    // Fisica lentissima (background o grossi spostamenti)
    lazy: { type: "spring", stiffness: 120, damping: 20 },
};
