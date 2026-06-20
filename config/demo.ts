// ==========================================
// DEMO MODE — vetrina sanitizzata di RailFlow
// ==========================================
// Attivo solo quando l'app è avviata in `--mode demo` (vedi .env.demo →
// VITE_DEMO=true). In quella modalità le credenziali Supabase sono azzerate
// (.env.demo) e il codice carica dati FINTI in memoria (fixtures/demoWorkers),
// senza mai connettersi al database reale. Serve per colloqui/portfolio.
//
// Build/dev normali: VITE_DEMO assente → IS_DEMO = false → comportamento identico
// a sempre. Nessun ramo demo viene eseguito in produzione.

export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';
