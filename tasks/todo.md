# Todo — Sessione 11/07 (pomeriggio): Riposi — parità vista viewer + chiarimenti Vincenzo su Viterbo

> **Contesto:** (1) Vincenzo non vede alcune cose nell'area Turni & Riposi dal suo account viewer →
> parità di vista; (2) dall'incontro: il PDF sorgente calcola giornate CEE + riposi giornalieri
> (sigla GRO, ≥11h/giorno) e settimanali con **paga oraria del mese × parametro** (561 artt. 6-7-8);
> ciclo riposi 3 settimane; settimanale 45h entro il 6° giorno (7° = riposo; se riconosciuto
> all'8° = violazione con TUTTE le 45 ore); **il 20% dell'avvocato = MAGGIORAZIONE sul totale**
> (non "danno = 20%": ribalta l'interpretazione registrata il 21/06).

**Evidenze già misurate (seed fonte, 5.022 giornate):**
- Regola 45h CONFERMATA nei dati: **103/499 righe settimanali valgono esattamente 45h piene**,
  le altre quote parziali (1-23h) → il perito applica entrambe le casistiche.
- Tariffa implicita per riga: G e S IDENTICHE per anno (10,03 → 13,13 €/h, mediana), coerente con
  la curva derivata del motore. Ipotesi da verificare con le buste: 13,13 = paga oraria mensile
  × 1,20 (teorica Monteleone 2024: 9,63 × 1,20 = 11,56 con anzianità diversa) → se vero, il +20%
  è GIÀ dentro la curva derivata.
- Il nostro motore serie B conta solo la QUOTA mancante (129 viol. sett./975h) → gran parte del
  gap con la fonte è la regola 45h, non la tariffa.
- **Inventario vista viewer** (`useIsReadOnly`/`canManage`/`canExport`): il viewer NON vede
  (a) pannello "Parametri di calcolo" (valorizzazione + curva €/h + editor) — unico blocco
  INFORMATIVO nascosto; (b) Excel/Relazione/Stampa su pratiche non "pagata" (regola-leva
  deliberata, cross-app); (c) tutto il lavoro post-28/06 non ancora deployato (coda deploy unico).
  Stato/importo riconosciuto già visibili read-only.

**Fasi:**
- [x] 1. Parità vista FATTA: pannello "Parametri di calcolo" ora visibile al viewer in SOLA LETTURA
      (valorizzazione applicata + curva €/h; editor/bottoni solo owner). Scelta utente: export
      (Excel/Relazione/Stampa) restano solo sulle Pagate (regola-leva invariata).
- [x] 2. Knowledge aggiornata (§2-bis metodologia-mancati-riposi): GRO = colonna Rip.Gro (riposo
      giornaliero fatto, 11−Rip.Gro = mancante, verificato al minuto), 45h piene = righe con
      Rip.Set VUOTO (103/103), tariffa = paga mensile × parametro, 20% = maggiorazione.
- [x] 3. Verifica tariffa FATTA (92 buste testuali Viterbo col parser FSE): **implicita fonte =
      teorica (AA245×7/6÷195) × 1,20 ESATTO su 2023-24 (13,13 = 10,94×1,20), 1,203 nel 2022** →
      il +20% è GIÀ nella curva derivata → coefficiente corretto = 1,0. Bonus: nota perito conferma
      (1,75h × 8,36 × 1,20 = 17,55 = riga PDF). **DB: coefficiente era GIÀ 1 (memoria 21/06 stale)**
      → serie B in produzione = €11.620,48, nessun intervento. UI: opzione "Maggiorazione · +20%"
      aggiunta per i casi a curva-base (es. Monteleone con teorica).
- [~] 4. Motore — DUE interventi, decisione di quantificazione APERTA (numeri sotto):
      (a) **guardia falsi-riposi ATTIVA**: i gap tra turni che attraversano giornate LAVORATE senza
      orari (servizio numerico/D, centinaia nel roster: 19 e 22/01/2011 ecc.) NON sono più riposi
      → correzione di correttezza, +1 warning aggregato; (b) **tempestività art. 8 §6 OPT-IN**
      (termineRiposoSettimanale, default OFF): riposo iniziato oltre 144h → 45h piene, dedup con
      alternanza. Configurazioni misurate sul dato reale (soloCEE, coeff 1, curva derivata):
      vecchio motore €11.620 (143 viol) · con guardia €21.785 (249) · guardia+144h €75.182 (277,
      timing 114 vs 82 eventi CEE del perito → sovra-spara, finestra da rifinire se si adotta).
      Fonte/perito CEE = €66.360. Reverse-engineering del trigger perito: miglior modello 86-89/103
      (festività lavorate trattate diversamente) — criterio esatto non estraibile con certezza.
- [x] 5. UI selettore 3 opzioni + banner/relazione/Excel aggiornati (danno vs maggiorazione).
- [ ] 6. Riconciliazione coi conteggi del perito per Viterbo FSE (15__conteggi.pdf,
      RiepilogoGenerale, Interessi e Rivalutazioni) — rinviata a sessione dedicata.
- [x] 9. **Toggle tempestività per pratica** (richiesta 11/07 sera): migration 025
      (`tempestivita_settimanale boolean`, APPLICATA live) + mapper/tipo/update + wiring motore
      (dettaglio E card area) + controllo nel pannello Parametri (owner; viewer read-only).
      Documenti GIÀ adattivi (nTiming): con toggle ON descrivono la regola come passo del metodo
      e tolgono l'esclusione prudenziale; causale «Settimanale oltre il termine: 45h intere».
      Riscritta in chiaro l'«unità di conteggio del settimanale» (ex granularità) in doc + UI.
      +4 test (mapper roundtrip, documenti adattivi) → 296/296.
- [x] 7a. Azienda + logo (richiesta 11/07 pomeriggio): `azienda='Ferrovie del Sud Est'` in DB
      (UPDATE verificato), helper `aziendaToProfilo` in profiles.ts, logo FSE nel header del
      dettaglio e nell'avatar card (fallback BusFront per aziende ignote), azienda nel sottotitolo.
- [x] 7b. **Leggibilità calendari per Vincenzo** FATTA (approvata con enfasi su "al click la
      spiegazione dettagliata + riferimento giuridico"). In più, scoperto in review: i giorni
      lavorati SENZA orari apparivano come "riposo" grigio → ora stile dedicato "turno senza
      orari nel PDF" (coerente con la guardia del motore), in celle, tabella e legende. Dettaglio:
      1. Sigle decodificate ovunque: D = A disposizione (riserva) · VM = Visita medica ·
         Malato = Malattia · P.retr = Permesso retribuito (oggi "sigla da decodificare").
      2. Elenco violazioni: mostrare il `motivo` del motore (frase completa già calcolata, mai
         renderizzata) + chip CEE sulla riga; click = apre il mese (invariato).
      3. Prospetto turni, griglia anni: pallino sui giorni CEE + voce in legenda; click sul
         giorno apre il mese CON quel giorno selezionato.
      4. Prospetto turni, vista mese: colonna CEE + colonne "Mancato G/S (PDF)"; card
         "Violazioni del mese" nell'aside con spiegazione completa per ognuna (tipo, motivo,
         gravità, riferimento); riga violata cliccabile → evidenzia la spiegazione.
      5. Confronto PDF: click sul giorno → pannello dettaglio in parole (cosa dice il PDF:
         mancato+indennità; cosa dice il motore: violazione+motivo; se non la contiamo, perché
         quando determinabile) + legenda arricchita.
      Vincoli: nessun controllo rimosso, tema chiaro/scuro, viewer = stessa leggibilità.

## 8. Documenti da giudice — relazione .docx + conteggi stampa (richiesta 11/07 sera, PIANO)

> Obiettivo: accuratezza notevole, tutto dichiarato, zero spazio a interpretazioni. I due documenti
> devono dire le STESSE cose (oggi duplicano testi a mano → rischio divergenza) e riflettere tutto
> ciò che oggi è cambiato/si è scoperto.

**Gap trovati nella lettura integrale dei generatori attuali:**
1. **"Coefficiente danno" ovunque, stale**: con coefficiente 1,20 stamperebbero «danno = 120% del
   valore» — testo sbagliato davanti a un giudice. Serve la tripartizione pieno/maggiorazione/danno
   (come la UI di oggi). Anche `coeffSuffix` («× 120%») e `causaleSintetica` (non conosce la
   violazione di tempestività → la etichetterebbe «inferiore al minimo ridotto») vanno adeguati.
2. **Tariffa oraria spiegata in modo vago** («ricavata dal documento, confermabile») quando ORA
   abbiamo la catena contrattuale VERIFICATA: retribuzione oraria (fissi+ratei ÷195, art. 15 CCNL
   '76) × 1,20 festivo (art. 14 CCNL '97), riscontrata al centesimo sulle buste 2023-24 e −0,3%
   nel 2022. Da dichiarare con onestà sul perimetro (anni verificati vs derivati).
3. **La guardia sui giorni lavorati senza orari NON è dichiarata** nel metodo (i gap che li
   attraversano non sono riposi): regola che sposta i numeri → va scritta.
4. **La tempestività art. 8 §6 (45h piene) non è menzionata**: se spenta va dichiarata ESCLUSA con
   riserva (spiega parte del divario A↔B ed è prudenziale); se attiva va descritta (rilevabile dai
   risultati). 
5. **Serie A descritta come scatola nera** («criteri di chi ha prodotto il documento») quando ora
   conosciamo il suo metodo esatto (Rip.Gro/Rip.Set, 11h−fatto, 45h−fatto, 45 piene oltre il
   termine, paga mensile ×1,20) → descriverlo rende il confronto A↔B leggibile dal giudice.
6. **Divario A↔B senza numeri**: serve la sezione dedicata con le ragioni QUANTIFICATE (split fonte
   CEE/non-CEE calcolabile dalle giornate; riduzioni lecite; tempestività esclusa; granularità
   settimanale per-evento vs a scorrimento).
7. **Perimetro CEE citato senza base normativa completa**: artt. 2 §1 lett. b) e 3 lett. a)
   Reg. 561/2006 (a contrario) + nota INL prot. 61 del 14/01/2021.

**Piano:**
- [x] A. **Nucleo testuale condiviso `utils/riposiDocText.ts`** — una sola fonte della verità per i
      testi/calcoli che compaiono in ENTRAMBI i documenti: valorizzazione (3 casi), catena tariffa
      con perimetro di verifica, metodo serie A, regole motore complete (guardia, ridotti leciti,
      alternanza, tempestività presente/esclusa), ragioni del divario con numeri, riferimenti
      normativi, riserve. Fix `causaleSintetica` per la tempestività.
- [x] B. **Relazione .docx** ristrutturata sul nucleo: 1 dati pratica · 2 fonte dei dati e
      affidabilità (parser deterministico quadrato al centesimo) · 3 quadro normativo (con CEE
      completo) · 4 metodo del documento sorgente (serie A) · 5 metodo del motore (serie B) +
      esempio numerico · 6 risultanze e riepilogo per anno · 7 il divario A↔B spiegato coi numeri ·
      8 elenco violazioni · 9 riserve e limiti. Stile docx invariato (branding documenti INVARIATO
      come da decisione rebrand).
- [x] C. **Conteggi stampa** allineati: stessi contenuti dal nucleo, layout tabellare A4 attuale.
- [x] D. **Verifica FATTA**: 14 test nuovi sul nucleo (3 valorizzazioni, split CEE, salvaguardia,
      tempestività, «mai danno=120%», parità docx↔html) + 18 test esistenti INVARIATI verdi;
      generazione END-TO-END dei documenti REALI di Viterbo in Node (5.022 giornate): serie B
      € 21.784,85 = configurazione scelta, divario CEE quantificato al centesimo (€ 32.372,41 =
      98.732−66.360), 584 intervalli di salvaguardia e 1.264 giornate senza orari dichiarati,
      riscontro tariffa (fonte_tariffa aggiornata in DB) citato nel testo. Gate 292/292 · build ok.
      Copie reali su ~/Desktop (viterbo-relazione.docx + viterbo-conteggi.html) per il collaudo visivo.

# Todo — Sessione 12/07: rivalutazione ISTAT + interessi riposi + cornice formale relazione

> **Contesto:** punto 10 dell'11/07. Bersaglio di riconciliazione = «Viterbo (Interessi e
> Rivalutazioni).pdf» (166 pagg. testuali: 1 pagina per mese di danno, serie A intera 98.732,03,
> scadenza comune 31/10/2024; Riepilogo Generale: riv 14.475,09 + int 9.747,67 = 122.954,79).
> Metodo perito: FOI MENSILE alla decorrenza (fine mese), capitale progressivamente rivalutato,
> interessi legali pro-rata GIORNI. Il motore Incidenze (istatService) è annuale/approssimato →
> NON si tocca; modulo nuovo puro. Decisioni utente: rivalutare ENTRAMBE le serie (A e B) nei
> documenti + riga del totale rivalutato anche in UI. Piano: ~/.claude/plans/pure-hatching-swan.md

- [x] 0. Calibrazione FATTA — metodo del perito DECIFRATO sui dati: FOI mensile 1 decimale (identico
      alle tavole ufficiali), rivalutazione CONCATENATA per anno con coefficienti round-3-decimali,
      interessi base 365 FISSA su giorni di calendario tra confini di segmento. Riprodotte 153/165
      pagine al centesimo (1.184/1.184 righe interessi), riepilogo Δ +4,84 € su 122.954,79 (+0,004%,
      arrotondamenti interni del suo software non riproducibili da indici pubblicati); capitali
      mensili = serie A dal seed **165/165 al centesimo** (il perito rivaluta la serie A INTERA).
      Report: [riconciliazione-rivalutazione-viterbo-2026-07-12.md](riconciliazione-rivalutazione-viterbo-2026-07-12.md)
- [x] 1. `utils/rivalutazione.ts` FATTO (puro): FOI mensile 2011→mag 2026 (2025-26 verificati su
      DUE fonti ufficiali; raccordi 1,071 e 1,214), tassi legali propri 2011-2026 (2025=2,00%,
      2026=1,60% da DM — ⚠️ istatService ha 2025=2,50 ERRATO, segnalato e NON toccato),
      calcolaRivalutazioneMese/buildRivalutazione + helper capitali serie A/B; scadenza limitata
      all'ultimo indice pubblicato e DICHIARATA; mesi pre-2011 inclusi col solo capitale, flaggati.
- [x] 2. Nucleo: buildRivalutazioneModel (entrambe le serie), rivalutazioneBullets (429 c.p.c.,
      indici+raccordi, tempo per tempo, ultimo indice, «non si sommano»), MAGGIORAZIONI_BASE_100.
- [x] 3. Relazione .docx: Oggetto · 1 Premessa e incarico (firmatario in bianco, Luogo e data in
      testata) · … · 9 Rivalutazione (riepilogo economico A+B + analitico per annualità per serie) ·
      12 Conclusioni a punti coi totali rivalutati · riga Firma; tabella maggiorazioni base-100 nel
      quadro contrattuale; sezioni rinumerate e riferimenti incrociati aggiornati.
- [x] 4. Conteggi stampa: sezione 3 «Rivalutazione monetaria e interessi legali» (stessi bullets +
      riepilogo + analitici per serie dal nucleo), sezioni rinumerate.
- [x] 5. UI: totale rivalutato in ENTRAMBE le card «Le due serie a confronto» (+ nota metodo/scadenza
      nel footer della sezione); stessi numeri dei documenti (buildRivalutazioneModel), viewer invariato.
- [x] 6. Verifica: 20 test nuovi rivalutazione (6 pagine reali del perito al centesimo, riepilogo 165
      mesi, edge copertura/clamp/serie) + 5 test documenti (cornice formale, sezione in docx E html,
      base-100, scadenza limitata dichiarata) → **322/322** · tsc 0 · build ok; end-to-end Node su
      dati reali: serie B €21.784,85 invariata, serie A rivalutata 31/10/2024 = 122.959,63 (|Δ perito|
      = 4,84 < 5), documenti reali rigenerati su ~/Desktop (viterbo-relazione.docx + conteggi.html,
      scadenza 31/05/2026 dichiarata «ultimo indice»). Collaudo visivo all'utente.

### Review — sessione 12/07
- Gate: tsc 0 · vitest 322/322 (25 nuovi; il 342 scritto in prima battuta era un errore di conteggio) · build ok.
  Nessun tocco a migration/DB, nessun push.
- **Fix istatService (stessa sessione, richiesta utente)**: tasso legale 2025 2,50→2,00 (DM 10/12/2024),
  +2026 = 1,60 (DM 10/12/2025), +FOI 2026 = 124,8 (ultimo indice mag 2026 ×1,214; prima il fallback stale
  fermava la rivalutazione all'indice 2024 e gli interessi 2026 usavano il default 2,50). Solo DATI, zero
  logica. Impatto su €1.000 origine 2020 a oggi: 1.319,85 → 1.356,65 (+riv per l'indice vero, −int per i
  tassi veri). Test-guardrail __tests__/istatService.test.ts (fallisce a inizio anno se le tabelle non
  vengono aggiornate) → 325/325.
- La riconciliazione ha chiuso ANCHE la parte interessi/rivalutazione della fase 6 (riconciliazione
  conteggi perito): capitali 165/165, metodo identico, scarto +0,004% documentato e spiegato.
- A oggi (31/05/2026): serie A rivalutata € 130.957,68 · serie B € 28.719,09 (cap 21.784,85 +
  ISTAT 4.076,78 + interessi 2.857,46). I documenti dichiarano scadenza e criteri.
- Fuori scope dichiarato: Excel riposi senza rivalutazione; istatService (bug tasso 2025) intatto;
  restano del punto 10 originario SOLO gli altri PDF del perito (15__conteggi/RiepilogoGenerale).

---

## 10. PROSSIMA SESSIONE — allineamento al modello di relazione + rivalutazione/interessi riposi

> Confronto (11/07 notte) con «IMPORTANTE Relazione_tecnica_mancati_riposi_.docx» (il modello che
> lo studio usò in passato, template Monteleone): la nostra relazione è GIÀ più completa su dati,
> metodo, trasparenza e elenco violazioni. Da adottare dal modello:
- [ ] **Rivalutazione ISTAT FOI + interessi legali "tempo per tempo"** per i riposi (loro §7,
      con allegato analitico per annualità: capitale rivalutato + interessi = totale). È il gap
      SOSTANZIALE: il numero da giudice è quello rivalutato. Riusare il motore ISTAT delle
      Incidenze; bersaglio di riconciliazione = «Viterbo (Interessi e Rivalutazioni).pdf» del
      perito (cartella VITERBO FSE) → si aggancia alla fase 6 (riconciliazione conteggi).
- [ ] Cornice formale nella relazione: «Oggetto» + «Premessa e incarico» (campo firmatario in
      bianco, come il modello) + «Conclusioni» a punti + riga firma.
- [ ] (cosmetico) Schema maggiorazioni in tabella base-100 nel quadro contrattuale.

### Review — sessione riposi 11/07
- Gate: tsc 0 · vitest 278/278 (4 test nuovi tempestività) · build ok. Nessun tocco a migration/DB.
- La banda dei chiarimenti ha retto TUTTA alla prova dei dati: GRO, 45h piene, paga×parametro,
  maggiorazione — ogni affermazione di Vincenzo trova riscontro esatto nel PDF/buste.
- Il numero in produzione NON è cambiato finché l'utente non sceglie la configurazione serie B
  (il refresh col nuovo build porta la guardia → €21.785; la tempestività resta spenta).

---

# Todo — Sessione 11/07: parser di verità FSE + MERCITALIA (prova d'accuratezza)

> **Contesto:** estendere la feature "Verifica accuratezza (dal disco)" — oggi solo RFI/Trenitalia
> (`utils/rfiTruthParser.ts` + `utils/verifyFromFolder.ts`) — alle buste FSE (Clarino, 200 PDF sul
> Desktop) e MERCITALIA (Gagliano, 78 PDF). Requisiti FSE già raccolti nel §4 del
> [controllo-pratica-clarino-2026-07-10.md](controllo-pratica-clarino-2026-07-10.md).
> Lezione vincolante 20/05: parser scritto SUI PDF REALI; lezione 07/07: validare in Node con la
> stessa pdfjs-dist PRIMA di dichiararlo fatto.

**Perimetro dati (ricognizione fatta):**
- FSE testuali = ere Zucchetti I8/T8 (nov 2020→) e IX (lug 2017–ott 2020), ~100 buste; era storica
  2010–giu 2017 = scansioni → `isText=false`, restano OCR+censimento (fuori dal parser, by design).
- MERCITALIA = ADP 7 colonne, tutte testuali; nomi file NUMERICI (`Cedolini-2019-10-…`) → il
  `detectYM` attuale (solo nomi mese italiani) NON li riconosce: va esteso.

**Decisioni di design (da ratificare):**
1. **daysWorked FSE (verità)** = quantità G NETTA delle voci presenza (I86178/I86005/IX0023, storni
   inclusi) — stessa definizione del motore → confronto omogeneo. La banda **GG LAV** si legge come
   CONTROLLO: se diverge dalla voce → mese **flaggato, non auto-corretto** (req. §4.3: avrebbe preso
   sia Mag 2021 sia Gen 2018). Relazione esatta banda↔voce (es. GG LAV = presenza − ferie, visto su
   Ago 2021: 24−6=18) da calibrare empiricamente in fase 0.
2. **Codici FSE confrontati** = 24 variabili Zucchetti + 5 fisse `fse_*` (dal box ELEMENTI, mappate
   come chiavi nel `codes`); gli 8 codici era storica mai raggiungibili dal parser testo.
3. **MERCITALIA**: 12 variabili da "Competenze" + 3 fisse (1000/1001/1025) da "Valori";
   daysVacation = somma righe 3833 POSITIVE; daysWorked = GIORNI INPS (pag. 2) − daysVacation
   (fallback 1213). Ticket/arretrati fuori confronto (come per RFI).
4. **Robustezza FSE** (req. §4): multi-riga stesso codice → somma col segno; pagine duplicate
   identiche nello stesso PDF → dedup per firma testo; 13ª/14ª ("13a mens."/R4210/R4230) → busta
   SALTATA e contata a parte; daysPaidLeave non tracciato per FSE/Merc → non confrontato.

**Fasi:**
- [x] 0. **Calibrazione in Node** FATTA — FSE: 107/107 riconciliazione Σ Competenze vs TOT COMPETENZE
      stampato, 107/107 box ELEMENTI vs AA245, 107/107 periodo PDF = nome file, 14/14 campioni al
      centesimo (storni Mag/Giu/Ott 2021 nettati, Ago 2021 completo, Set 2022 vuoto, Gen 2018 qty 38,
      Ago 2018 era IX). Merc: 78/78 + 78/78 (1000+1001+1025=1100) + campione Mag 2022 al centesimo.
      **Esiti che cambiano il design:** (1) banda GG LAV = 22 TEORICO in tutta l'era IX e sporadicamente
      altrove → INUTILIZZABILE come controllo; flag giusto = presenze>31 (becca Gen 2018=38 e Apr
      2026=46), giorni non confrontati per quei mesi. (2) Trappole di layout risolte: riga banca
      "INTESA SANPAOLO … Emolumenti correnti" (2022+) e "D01CNG Esonero L.234" cadono in zona
      Competenze → regione voci delimitata da header→separatore "---- Imponibili"/NOTE; crediti WZF*
      (DL 66/2014) contati da Zucchetti nel TOT → solo riconciliazione, mai codici. (3) Ferie F2105
      H÷6,5 = intere su TUTTI i 107 mesi. (4) Box ELEMENTI ristampato sul retro → lettura singola.
      (5) Merc: GIORNI INPS assente 1 volta (Dic 2025) → fallback 1213 ok; 1 storno 3833 gestito;
      esiste doppione "Cedolini-2025-12 (1).pdf" → gestito dal guardrail mesiInConflitto.
- [x] 1. `utils/fseTruthParser.ts` — con autovalidazione reconOk (Σ Competenze = TOT COMPETENZE),
      flag daysUncertain (presenze>31), periodo dal PDF, skip 13ª/14ª, dedup pagine identiche.
- [x] 2. `utils/mercitaliaTruthParser.ts` — reconOk vs riga "Totali", GIORNI INPS + fallback 1213,
      3833 col segno (storni esclusi), fisse da "Valori".
- [x] 3. `utils/verifyFromFolder.ts` parametrizzato (`PROFILES`: parser + codici derivati da
      types.ts + campi giorni); `detectYM` esteso ai nomi numerici; report con busteNonQuadrate,
      buste13a14a, busteMisfiled (periodo PDF ≠ nome file), mesiGiorniIncerti — RFI invariato.
- [x] 4. UI: gating header + prop `profilo` + hint per azienda + avvisi nuovi nel modale.
- [x] 5. Validazione finale coi parser DEFINITIVI (transpilati esbuild, stub solo getPdfjs):
      **22/22 asserzioni verdi** su 200 PDF FSE + 78 Mercitalia; tsc 0 · vitest 274/274 · build ok.
- [x] 6. Commit locale (NO push: deploy unico dopo Elior) + todo/report/lessons/memoria aggiornati.

### Review — parser di verità FSE + Mercitalia (11/07)
- **Copertura**: FSE 107 buste testuali verificabili (lug 2017→giu 2026; le 93 scansioni era storica
  restano OCR+censimento, segnalate nel modale); Mercitalia 78/78 verificabili.
- **Scoperta che cambia il §4.3 del report Clarino**: la banda "GG LAV." NON è una fonte — nell'era
  IX è un 22 TEORICO fisso (anche nel mese di congedo totale Set 2022, dove il report la diceva
  vuota). Il netting delle quantità becca da solo Mag 2021 (24+75−75=24); i casi Gen-2018-style
  (arretrati nella quantità) li becca il flag presenze>31 → mese segnalato, giorni NON toccati
  (protegge anche i 2 fix manuali dell'11/07 dal ri-rollback).
- **Autovalidazione per-busta (novità)**: ogni busta deve quadrare col SUO totale stampato
  (TOT COMPETENZE / riga Totali); se non quadra → scartata come verità e contata nel modale.
  In calibrazione questo ha scovato 3 trappole reali: riga banca INTESA (2022+), esonero D01CNG,
  crediti WZF* — tutte invisibili a un parser "a colonne" ingenuo.
- **Non fatto di proposito**: nessun tocco al parser RFI/Trenitalia (solo firma verifyFromFolder);
  ticket/arretrati fuori confronto (come per RFI); era storica FSE fuori perimetro parser.

---

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
      NETTATI correttamente; **2 FIX FATTI l'11/07 via SQL verificato: Mag 2021 75→24, Gen 2018 38→16**
      (16 = 38 − 22 arretrati Dic 2017, voce assente a dicembre; perito 15 ±1) → hard refresh utente
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
