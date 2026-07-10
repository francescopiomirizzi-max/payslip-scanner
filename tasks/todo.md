# Todo — Sessione 10/07 notte: controllo totale pratica Clarino (post-caricamento)

> **Contesto:** l'utente ha caricato TUTTA la pratica Clarino in app (deploy unico ancora pendente
> → caricamento via dev locale). Controllo integrale su DB, anche in vista del parser di verità FSE
> (roadmap punto 4). NOVITÀ 10/07: Vincenzo ha riconsegnato le buste di TUTTI i lavoratori Elior
> viaggiante + archivio → sblocca la sezione Indennità (vertenza residenza); si parte DOPO Clarino.

- [x] 1. Inventario archivio: 183 buste, copertura piena (manca solo Set 2017 = noto), zero duplicati,
      zero 13ª/14ª, Dic 2010 = Nº 0046860
- [x] 2. Griglia + estrazioni: prompt NUOVO (32+5 chiavi) su TUTTI i mesi; Nov 2011/Set 2013 = censimento
      al centesimo; griglia coerente, zero virgole
- [x] 3. Sanity + storni: scan full-text 2017-2025 → 3 mesi con righe negative (tutti 2021), importi
      NETTATI correttamente; **2 FIX da fare: daysWorked Mag 2021 75→24, Gen 2018 38→22/15** (dall'app!)
- [x] 4. Report: [controllo-pratica-clarino-2026-07-10.md](controllo-pratica-clarino-2026-07-10.md)
      (+ nota: perito usa media MOBILE 12 mesi, noi anno solare precedente → altro delta by design)
- [x] 5. Roadmap vault + memorie aggiornate: Clarino controllato, Elior viaggiante SBLOCCATO
      (buste tutti i lavoratori + archivio da Vincenzo, 10/07)

---

# Todo — Sessione 10/07 sera: primo collaudo delega a Codex (test TFR/verify)

> **Contesto:** Codex CLI (bundled in ChatGPT.app, piano Plus attivo) usato come esecutore:
> Claude scrive la spec e verifica, Codex implementa. Primo task = estendere la copertura
> test di `tfrCalculator` e `verify-payslip` (tech debt backlog; i file test esistono già
> ma sottili — mancano i casi-lezione e il blocco era storica FSE di be4fd20).

- [x] 1. Spec dettagliata (target, casi limite, regole vincolanti: solo `__tests__/`, niente fix ai sorgenti)
- [x] 2. `codex exec --sandbox workspace-write` sul repo → 13 test nuovi, perimetro rispettato (sole aggiunte)
- [x] 3. Review del diff + gate rifatti da Claude: vitest 274/274 · tsc 0 → commit ac56b80
- [x] 4. Finding triage: virgola su imponibile/daysWorked = rischio LATENTE (upload usa parseLocalFloat,
      edit manuale TFR usa replace(',','.') — resta il caso jsonb legacy); "12,34"→NaN nel verificatore =
      da valutare hardening; punto zero anno = by design (il malloppo include la quota); punto zero futuro =
      config assurda, bassa priorità. Nessun fix applicato — decisione all'utente.

### Review collaudo Codex
- Il flusso spec→exec→review→gate funziona: Codex ha rispettato tutti i vincoli (solo 2 file, stile
  italiano, ⚠️ sui sospetti, niente fix ai sorgenti) e i conti dei test tornano (verificati a mano).
- Bonus stessa sessione: verificato `viewer_payment_block=false` su Supabase (punto flaggato in roadmap).

---

# Todo — Sessione 10/07: split PDF annuali FSE Clarino 2010-2016 in cedolini mensili

> **Contesto:** i ruoli paga Clarino 2010-2016 sono scansioni accorpate in un PDF per anno
> (`Ruoli paga Clarino/2010.pdf` … `2016.pdf`, 12+28×6 = 180 pagine, fronte+retro alternati,
> ordine NON cronologico). Vanno divisi in PDF mensili (2 pagine ciascuno) nelle cartelle
> anno, con la convenzione esistente `Mese Anno.PDF` / `Tredicesima Anno.PDF` / `Quattordicesima Anno.PDF`.

- [x] 1. Ispezione layout → verifica: fronte = pagine dispari col box "Periodo di Retribuzione", retro = pari (IRPEF)
- [x] 2. Lettura periodo di OGNI pagina via griglie di ritagli (lezione split Elior 13/06: mai inferire dalla sequenza)
      → 2011-2016 completi (12 mesi + 13ª + 14ª); 2010 parziale da Settembre (assunzione 01/09/2010)
      → ⚠️ 2010 ha DUE cedolini "Dicembre 2010" distinti (Nº 0022887 netto 1.490,57 vs Nº 0046860 netto 1.439,58,
        stesse competenze, ritenute diverse — probabile riemissione/conguaglio): estratti entrambi col Nº nel nome,
        decide l'utente quale inserire nell'app (policy: segnalare, non indovinare)
- [x] 3. Split lossless con pdfseparate+pdfunite in scratchpad → verificato: 90 file, tutti da 2 pagine (pdfinfo)
- [x] 4. Verifica visiva post-split: griglia fronte-di-ogni-file-creato etichettata col nome file → 90/90 periodo = nome
- [x] 5. Copia nelle cartelle `Ruoli paga Clarino/2010` … `2016` (originali annuali INTATTI) → 6+14×6 file in posizione

## Blocco 2 — Censimento codici voce era 2011-2016 (+ Gen-Giu 2017 SPA-GUIDA)
> Prerequisito del quesito 2 all'avvocato: confermare che le colonne del riepilogo perito
> (Percorrenze, Nastri, Guide, Rimorchio…) corrispondano alle voci stampate dell'era.
- [x] 1. Griglie crop tabella voci (colonne Voce+Descrizione) di OGNI fronte 2010-2016 + bundle Gen-Giu 2017
      (96 fronti in 12 griglie + griglia periodi bundle: Gen→Giu 2017 in ordine crescente)
- [x] 2. Lettura visiva → 9 mesi con tabella lunga ricontrollati con crop di coda (nessuna riga persa)
- [x] 3. Deliverable [tasks/censimento-codici-fse-2011-2016.md](censimento-codici-fse-2011-2016.md)
- [x] 4. Memoria aggiornata

### Esito censimento (sintesi)
- Indennità di incomodo STAMPATE nell'era = solo **029 Art.5A · 094 Art.5/B · 300/301/303/306/307 Trasferte
  · 663 Ind. giornaliera (presenza, da OTT 2012)**. Percorrenze/Nastri/Guide/Rimorchio/Disponibilità/Riserva/
  Flessibilità/IndAggiun **NON esistono come voci stampate** → nel riepilogo perito 2011-2016 possono essere
  solo ricostruzioni a tariffa (pattern §4 report riconciliazione) → bozza di risposta al quesito 2.
- Pre-ott 2012 la fonte GG è la banda "Presenze del mese" (in questo layout è compilata e affidabile):
  la regola "vietato usare la banda" del PROMPT_FSE andrà differenziata per era.
- PRIMA di estendere colonne/prompt: verifica quantitativa a campione (importi 029/094/30x vs celle riepilogo
  perito) + risposta avvocato al quesito 2. Poi PROMPT_FSE + verify-payslip gemello insieme.

## Blocco 3 — Verifica quantitativa a campione (FATTA, 8/8 al centesimo)
- [x] Header riepilogo perito decodificato per coordinate (15 colonne numeratore, dump-riepilogo.mjs)
- [x] 8 mesi campione (Giu/Nov 2011, Apr/Ott 2012, Feb/Set 2013, Mar 2015, Ott 2016): importi letti dai crop
      full-width e confrontati cella per cella → **8/8 al centesimo**, esito in
      [censimento-codici-fse-2011-2016.md](censimento-codici-fse-2011-2016.md) §7 + cross-link nel report riconciliazione §8.2
- Regole inchiodate: Diarie = serie A (300/301/303) · Trasferte = serie B (306/307) · GG = banda Presenze
  (663 qty ≈ 26 fisso, DIVERGE) · Ferie = banda Congedi (anche il 17 di Set 2013) · 029 = 0,52×GG ·
  "Ind. Aziendale" = 3,50×GG anche nel 2011-2016 (la ricostruzione parte da gen 2011, non dal 2017)
- Il numeratore perito 2011-2016 è DOMINATO dal ricostruito (~120-480 €/mese; Mar 2015 = 97%) → quesito 2
  pronto per l'avvocato coi numeri; estensione colonne/prompt SOLO dopo la sua risposta

## Blocco 4 — Estensione era storica (DECISIONE UTENTE 10/07: si fa ORA, voci stampate)
> L'utente vuole caricare TUTTI gli anni con estrazione AI reale. L'app conterà le voci STAMPATE
> (029/094/300/301/303/306/307); le ricostruzioni del perito restano quesito 2 per l'avvocato.
- [x] 1. `types.ts`: +7 colonne era storica in INDENNITA_FSE (029, 094, 300, 301, 303, 306, 307)
- [x] 2. `scan-payslip.ts` PROMPT_FSE: guardia → blocco §5-ter era storica (tre ere nel §0; §2/§3 scopati
      alle ere Zucchetti; GG=banda Presenze, ferie=banda Congedi, 663 VIETATO sia importo sia giorni,
      fisse dal box con A.P.A.+3°El.Sal. sommati in fse_scatti, 13-14 MENS., esclusioni censimento §3;
      esempio few-shot Nov 2011 coi numeri verificati; contratto JSON a 28 chiavi)
- [x] 3. `verify-payslip.ts` FSE: blocco ERA STORICA speculare (regole "ribaltate": qui la banda È la fonte)
- [x] 4. Bundle 2017 splittato → 6 mensili verificati (6/6 periodo=nome) nella cartella 2017; originale
      rinominato e spostato nella root: `Gennaio-Giugno 2017 (scansione, originale non caricare).pdf`
- [x] 5. Gate: tsc 0 err · vitest 261/261 · build ok

### Review Blocco 4
- L'app ora estrae le voci STAMPATE dell'era storica; scelta deliberata di NON replicare le ricostruzioni
  del perito (3,50×GG, Percorrenze, Guide…) → restano il quesito 2. Quando/se l'avvocato dirà di
  replicarle, la via è la colonna-formula (es. `3,50×[daysWorked]`), non il prompt.
- Restano da caricare (utente, via AI): 2010-2016 splittati + Gen-Giu 2017; NO 13ª/14ª; UN solo Dic 2010.

## Blocco 5 — DECISIONE UTENTE 10/07: "i calcoli come li facciamo noi, il perito era una linea guida"
> Supera il "seguiamo il modello del perito" del 09/07. Criterio nuovo (proposto da me, confermato):
> nel numeratore le INDENNITÀ DI PRESTAZIONE (perse nei giorni di ferie); fuori gli straordinari
> (lavoro aggiuntivo, CGUE Hein) e le voci FISSE mensili pagate anche in ferie (nessuna perdita).
- [x] +9 colonne in `INDENNITA_FSE` (32 totali): I86178 presenza, I86005 giornaliera, I85210 notturno,
      I86161 turno prod., I86110 disponibilità, V12001 lavoro festivo, IX0023, IX0046, 013 notturno storico
- [x] PROMPT_FSE §5 (24 variabili Zucchetti, presenza = importo in codes E quantità → daysWorked),
      §6 esclusi riscritto (AA712 fisso mensile, S11000/IX0048/V12000/I86125 straordinari, I8320 rimborso),
      §5-ter: +013; 663 ESCLUSA con motivazione empirica (fisso ~26gg anche con 17gg ferie — Set 2013)
- [x] verify-payslip specchiato (presenza: importo+contatore NON è doppio uso da segnalare)
- [x] Gate: tsc 0 · vitest 261/261 · build ok
- ⚠️ Conseguenze attese: totali app ≠ perito OVUNQUE d'ora in poi (2021-24: ~+800€/mese di voci
  in più del suo set; 2011-16: niente ricostruzioni). La riconciliazione 49/49 resta la prova che
  leggiamo i cedolini giusti, NON il target dei totali. 041 festività esclusa = nota per l'avvocato.

## Review
- Split **lossless** (pdfseparate+pdfunite, zero ricompressione delle scansioni); generato in scratchpad,
  verificato (pagine + lettura visiva di ogni fronte), POI copiato su Desktop. Originali annuali lasciati al loro posto.
- Nomi = convenzione delle cartelle già inserite (`Mese Anno.PDF`, `Tredicesima/Quattordicesima Anno.PDF`) →
  compatibili col parsing mese/anno dal nome file di `usePayslipUpload` (§ label, riga ~357).
- Nota per l'inserimento in app: prompt FSE ([scan-payslip.ts:933](../netlify/functions/scan-payslip.ts)) tratta
  l'era 2011-2016 come NON mappata → in archivio sì, voci a 0.0 con aiWarning. Il doppio Dicembre 2010 va
  scelto dall'utente prima dell'upload (i due file hanno il Nº documento nel nome).

---

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

## Follow-up (stessa serata, richieste utente) — FATTO
- [x] Prompt anagrafica FSE in `scan-worker.ts` (matricola fusa col nominativo, DESCRIZIONE QUALIFICA = mansione, QUA./IN = livello)
- [x] Chip azienda della striscia compatta a scorrimento orizzontale (no-scrollbar) — segnalato taglio dal clip
- [x] Verificato: chip FSE già auto-cablato dal registry (logo 3,36 ≈ elior, footer teal, filtro generico) — commit ca312aa

## Review (sessione serale)
- La riconciliazione ha ribaltato il set del pomeriggio: sovra-contava ~800€/mese (presenza+sala+notturno).
  Ora le colonne = esattamente ciò che il perito somma, dimostrato al centesimo su tutti i mesi 2021-2024.
- Restano per le prossime sessioni: caricamento Clarino + confronto totale 8.170,94 (serve deploy),
  era 2011-2016 da censire via OCR, i 3 quesiti per l'avvocato (ricostruzioni 2017-2020, era vecchia, 2025-26).
