# Demo Mode sanitizzato — RailFlow (Roadmap Carriera · Fase B1)

**Obiettivo:** una demo mostrabile (colloquio + screenshot portfolio) con dati **finti**, che non tocca e non può nemmeno raggiungere i dati reali dei lavoratori.

## Approccio proposto: "Demo Mode" client-side, senza DB (Opzione A)
Flag `VITE_DEMO`. Quando attivo:
- `App.tsx` bypassa il login → utente demo fittizio (niente LoginPage).
- `useWorkers` NON interroga Supabase: carica `demoWorkers` da fixtures in memoria.
- Scritture/CRUD/scan/QR = no-op (guard `IS_DEMO`).

**Perché è il più sicuro:** il build demo non si connette ad alcun DB reale → leak di dati veri impossibile by design. Bonus: gira offline sul portatile al colloquio e produce un link statico per il portfolio.

## Cambi fatti (minimi, isolati dietro un flag — build normale invariato)
- [x] 1. `config/demo.ts` → `export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'`.
- [x] 1b. `.env.demo` → `VITE_DEMO=true` + **azzera** VITE_SUPABASE_URL/ANON_KEY (il build demo non può raggiungere il DB reale).
- [x] 2. `fixtures/demoWorkers.ts` → 5 lavoratori finti su RFI/TRENITALIA/ELIOR(viaggiante+magazzino)/CLEAN_SERVICE, anni 2017-2024 inventati (nomi di fantasia, importi da PRNG deterministico mulberry32 → stabili tra reload).
- [x] 3. `hooks/useAuth.ts` → se IS_DEMO: `isAuthenticated=true`, `isLoading=false`, niente sessione Supabase.
- [x] 4. `hooks/useWorkers.ts` → se IS_DEMO: carica `DEMO_WORKERS`, **authUser resta null** → auto-sync e delete/import (già protetti da `if(!authUser)`) restano no-op.
- [x] 5. `lib/readonly.ts` → i 3 hook (`useViewerPaymentBlock`, `useIsReadOnly`, `useReadOnlyViewerName`) no-op in demo. **Chiave**: senza questo, `useViewerPaymentBlock` restava `loading:true` (getSession con URL vuoto) e gate-ava l'app sullo skeleton.
- [x] 6. `App.tsx` → badge "DEMO · dati di esempio" (fixed, top-left) quando IS_DEMO.
- [x] 7. Network guards: `onArchive` (storage) → no-op in demo. _(2026-06-20: le guardie su `createScanSession`/`updateScanSession` erano su `utils/supabaseClient.ts`, file MORTO ora eliminato — vedi sezione sotto. L'isolamento vero è ora a livello di client.)_
- [x] 8. Script npm `dev:demo` / `build:demo` / `preview:demo` (`vite --mode demo`).
- [x] 9. **Scansione AI SIMULATA** (richiesta utente): `fixtures/demoScan.ts` (`buildDemoExtraction` per profilo, stesso formato di Gemini); in `usePayslipUpload.processFile` la chiamata di rete è sostituita da finta latenza 1.4s + risultato di esempio → l'animazione "sto analizzando…" e il riempimento griglia sono quelli REALI, zero chiamate AI. Cedolino-esempio finto in `public/demo/Cedolino_Esempio_Mario_Rossi_Marzo_2023.pdf` (valori coincidenti con l'estrazione RFI).

## Verifica — FATTA (2026-06-17)
- [x] `npm run dev:demo` apre l'app SENZA login, con i 5 lavoratori finti; dashboard popolata (credito totale 6.478,75 €). Verificato con screenshot headless.
- [x] Build demo (`npm run build:demo`) e build normale (`npm run build`) compilano entrambi.
- [x] Suite test verde: **213/213**.
- [x] `.env.demo` azzera Supabase → nessuna connessione possibile al DB reale; nomi tutti di fantasia.

## Review
- Approccio "no-DB by design": leak impossibile. Build normale invariato (tutti i rami sono `if(IS_DEMO)`, false in produzione).
- Scan AI: SIMULATA in demo (funziona, mostra l'UX reale).
- QR: TENUTO visibile (su richiesta utente: comunica la funzione PC↔telefono). In demo `initSession` è guardato → mostra solo il QR senza chiamate Supabase + nota "Anteprima demo — collegamento live disattivato".

## Fix isolamento client — falla chiusa (2026-06-20)
**Bug trovato:** esistevano DUE client Supabase. Quello vivo, importato da tutti i 13 file dell'app, era `supabaseClient.ts` (root) con **credenziali reali HARDCODED** → non leggeva `.env.demo` e restava puntato al DB vero **anche in demo**. Le guardie demo erano finite per errore su `utils/supabaseClient.ts`, un duplicato **mai importato** (codice morto). La promessa "il build demo non può fisicamente raggiungere il DB reale" era quindi **falsa**: l'isolamento reggeva solo perché ogni hook fa short-circuit su `IS_DEMO`, non "by design".

**Fix:**
1. `supabaseClient.ts` (root) reso demo-aware: se `IS_DEMO`, URL/chiave = `http://demo.invalid` / `demo-anon-key`. Modalità normale invariata (stesse credenziali di prima).
2. Eliminato `utils/supabaseClient.ts` (duplicato morto, helper `createScanSession`/`updateScanSession`/`ScanSession` non usati da nessuno → il flusso QR usa Realtime+outbox).

**Verifica (build reali):**
- Bundle DEMO: contiene `demo.invalid`; **NON** contiene URL né chiave reali (tree-shaking di Vite con `IS_DEMO=true`). Le credenziali reali non vengono nemmeno spedite. ✅
- Bundle NORMALE: contiene l'URL reale, non contiene `demo.invalid` → produzione intatta. ✅
- `tsc` pulito, 213/213 test verdi, entrambe le build OK.

→ Ora la garanzia "by design" è **vera**: la vetrina non spedisce e non può raggiungere il DB reale.

## Deliverable
- Locale offline: **`npm run dev:demo`** (per il colloquio) → http://localhost:5173 (o 5174 se occupata).
- (Opzionale, Fase B2/B3) deploy demo dedicato → link pubblico + screenshot.
