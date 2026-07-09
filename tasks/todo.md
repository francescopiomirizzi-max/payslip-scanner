# Todo — Sessione 09/07: nuovo logo FAST-CONFSAL + sottotitolo + analisi mancati riposi

> **Contesto:** incontro con Vincenzo il 09/07. Ha pagato (accesso viewer sbloccato su Supabase,
> passaggio al piano Pro). Ha consegnato: (a) nuovo logo FAST-CONFSAL da sostituire + dicitura sede;
> (b) documenti "mancati riposi" che in realtà sono il primo materiale della nuova azienda
> **Ferrovie del Sud Est (FSE)** / lavoratore **Monteleone Giuseppe** — usati come *esempio* per capire
> come è impostata la pratica dei mancati riposi. L'inserimento dell'azienda FSE è per una sessione futura.

## Blocco 1 — Logo + sottotitolo (FATTO, verificato)
- [x] **1. Nuovo asset logo.** Ritagliato il logo tondo dal JPG sorgente (1596²) in PNG circolare 512²
      con **fuori-cerchio trasparente** → il cerchio bianco è auto-contenuto, leggibile su light E dark
      senza pastiglia/invert. Sostituito `public/logos/fast-confsal.png` (un solo file → aggiorna tutti gli usi).
- [x] **2. `SindacatoTag.tsx`** — rimossa la pastiglia bianca dark (ora inutile, creava angoli dietro il cerchio);
      aggiunta la dicitura **"Segreteria Regionale / Puglia e Basilicata"** sotto il logo. Essendo il co-brand
      usato in tutte le aree (Incidenze, Turni & Riposi, Indennità, dashboard), il sottotitolo compare **ovunque**.
- [x] **3. `WorkerModal.tsx`** — stessa pulizia della pastiglia dark sull'header (logo auto-contenuto).
      Qui **niente sottotitolo**: è l'header di un form ("Nuova Pratica"), la dicitura regionale lo affollerebbe.
- [x] **Gate:** `tsc --noEmit` 0 err · `vite build` ok. Preview statica del logo su fondo scuro/chiaro = pulito.

## Blocco 2 — Analisi mancati riposi (esempio Monteleone/FSE) — FATTO
- [x] Estratta la relazione tecnica nuova (metodo: divisore 195, elementi fissi + ratei 13ª/14ª → paga oraria,
      ×1,20 festivo, ×7 ore/riposo, ISTAT FOI + interessi legali; ruolo paga sett. 2024).
- [x] Confronto col metodo già implementato (`restEngine.ts` + `metodologia-mancati-riposi.md`): **combacia in tutto**,
      nessun metodo nuovo. Unico nodo per il futuro = quale tariffa oraria usare per Monteleone (effettiva vs teorica).
- [x] Deliverable = [`tasks/analisi-relazione-monteleone-fse-2026-07-09.md`](analisi-relazione-monteleone-fse-2026-07-09.md)
      + puntatore nella nota 4 del doc dominio. Zero modifiche al codice di calcolo.

## Note aperte / da decidere con l'utente
- Sottotitolo anche nell'header di `WorkerModal`? (ora no — flag).
- Verificare che il blocco pagamento viewer (`viewer_payment_block`, migration 018) sia effettivamente spento
  (l'utente dice di averlo sbloccato lui).

## Review
- **Logo:** cambio centralizzato in 1 asset + 2 micro-edit di componente. Nessun `dark:invert`/pastiglia: il nuovo
  logo tondo ha il cerchio bianco proprio → si legge nudo su qualsiasi tema (pattern lezione 03/07). Diff minimo,
  gate verdi. Validazione visiva finale all'utente nell'app.
