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

---

# Todo — Sessione serale 09/07: FSE riconciliazione perito + motore OCR

> **Scoperta chiave (verificata al centesimo su 3 ere: 2019, 2021, 2023):** il numeratore del perito NON è il set
> `INDENNITA_FSE` del pomeriggio — esclude presenza (I86178/I86005), funzione sala (AA712), notturno (I85210).
> GG Effettivi = giorni G della voce presenza/giornaliera; Ferie = ore F2105 ÷ 6,5.
> Decisione utente: **riconciliazione deterministica prima**, poi profilo + motore OCR.
> Piano completo: `~/.claude/plans/golden-doodling-kurzweil.md`.

## Fase 0a — Riordino cartella Clarino (Desktop) — FATTO
- [x] Rename `2024/Luglio 2024.PDF` → `Quattordicesima 2024.pdf` (verificato: è la 14ª) e `Luglio 2024 (1).PDF` → `Luglio 2024.PDF`
- [x] Rename `(1)` in 2022 (Tredicesima/Quattordicesima) + `Novembre_2025.pdf` → `Novembre 2025.pdf`
- [x] Rename `2017/2017 1:2.pdf` → `Gennaio-Giugno 2017 (scansione).pdf` (verificato: 6 cedolini fronte/retro Gen-Giu)
- [x] Audit nome↔contenuto di tutti i mensili testuali: nessun altro mismatch. Mancanti (per Vincenzo): Set 2017, 13ª 2017, 13ª 2023, 13ª 2025

## Fase 0 — Riconciliazione deterministica perito ↔ cedolini — FATTO
- [x] Script Node (scratchpad `recon-fse.mjs`, pdfjs-dist del progetto): parser riepilogo (167 righe, colonne per coordinate) + parser cedolini
- [x] **49/49 mesi nov2020-nov2024 riprodotti al centesimo, zero ambiguità**; era IX 2017-2020: voci stampate al centesimo + 2 ricostruzioni a tariffa del perito (3,50×GG; 1,76×gg-Art5A) NON stampate
- [x] Deliverable: [riconciliazione-perito-clarino-2026-07-09.md](riconciliazione-perito-clarino-2026-07-09.md) (con 3 quesiti per l'avvocato)

## Fase 1 — Correzione profilo — FATTO
- [x] `INDENNITA_FSE` riscritta: 16 voci riconciliate (10 era I8/T8 + 6 era IX); escluse presenza/sala/notturno/straordinari; merge upload verificato (chiavi extra innocue)

## Fase 2 — Motore OCR — FATTO
- [x] `scan-payslip.ts`: PROMPT_FSE (Zucchetti 7 colonne, COMPETENZE, GG da voce presenza I86178/I86005/IX0023, ferie F2105÷6,5, fisse dal box → fse_*, ticket I86120/I86121, 13ª/14ª fuori conteggio, doppia era, guardia era 2011-16) + PROMPT_DIRECTORY
- [x] `verify-payslip.ts`: ramo FSE gemello (stesse regole, esclusioni esplicitate come NON-mancanti) · `scan-worker.ts`: FSE nell'enum (anti-confusione con Ferrovie dello Stato)
- [x] Gate: tsc 0 err · vitest 261/261 · build ok · commit senza push

## Review (sessione serale)
- La riconciliazione ha ribaltato il set del pomeriggio: sovra-contava ~800€/mese (presenza+sala+notturno).
  Ora le colonne = esattamente ciò che il perito somma, dimostrato al centesimo su tutti i mesi 2021-2024.
- Restano per le prossime sessioni: caricamento Clarino + confronto totale 8.170,94 (serve deploy),
  era 2011-2016 da censire via OCR, i 3 quesiti per l'avvocato (ricostruzioni 2017-2020, era vecchia, 2025-26).
