# Test accuratezza motore OCR — 07/07/2026 (VERITÀ dal PDF)

## Metodo (aggiornato: ora con verità assoluta)
Costruito un **parser deterministico** (`pdftotext -layout` → somma per codice dalla colonna
COMPETENZE, sommando le voci a righe multiple). I PDF RFI sono **testuali, non cifrati** → verità
estraibile in modo ripetibile. Parser **validato su 4 mesi** contro il PDF grezzo (Nov2012=268,26 ·
Mar2019=307,54 · Gen2022=138,28 · Lug2020=278,82), su **entrambi i layout** (vecchio indentato + nuovo 2021+).
Gira su tutte le **228 buste**, 0 fallite. Confrontato con: motore attuale ("fr fr", scan di oggi) e
Ciscutti (dato già in archivio). Parser salvato: `payslip-scanner/tasks/ideas/accuracy-parser-rfi.py`.

## Verdetto per codice (verità vs motore vs Ciscutti)
Su 17 codici RFI tracciati:
- **13 codici quasi perfetti** (0152, 0421, 0423, 0457, 0470, 0482, 0576, 0584, 0687, 0919, 0932, 0995, 0996):
  motore e Ciscutti = verità, salvo la busta fallita. Valore MAI sbagliato quando presente.
- **0920** (Str.fes.diu/fer.not, voce a righe multiple, ~34k€ totali): per-cella **97% motore / 99% Ciscutti**
  esatto, 0 valori sbagliati — solo qualche mese mancante.
- **0AA1 (Trasferta) = IL problema**: per-cella esatta solo nel **54,5% (motore) / 52,6% (Ciscutti)** dei mesi.
  Su 211 mesi, **~95-99 hanno un valore sbagliato** in ENTRAMBE le estrazioni.
  ⚠️ Al livello della SOMMA sembrava ok (errori piccoli e che si compensano → impatto sul totale <1%),
  ma **per-mese la Trasferta è quasi sempre imprecisa**.

## Due fatti che ribaltano il quadro iniziale
1. **Ciscutti NON era da temere.** Il dato già in archivio è quasi verità (esatto su 13/17 codici). Unica
   debolezza reale: 0AA1, che però sbaglia anche lui (è un problema del MOTORE, non del singolo run).
2. **La busta Agosto 2018** (l'unica fallita del batch di oggi) = −1 mese su quasi ogni codice → ri-scansionarla.

## Causa radice di 0AA1 e cosa fare nel prompt
La Trasferta 0AA1 è una **lista di 1–14 righe giornaliere** (12,00 · 22,16 · 37,65…) da SOMMARE. Il prompt
già dice *"0AA1 (Trasferta - Somma tutte le occorrenze)"* — ma **dirlo non basta: il modello conta/somma
male le righe**. È lo stesso pattern delle lezioni (`feedback-gemini-drops-trailing-addizionali`,
scan-payslip §): quando il modello sbaglia sistematicamente un campo, **NON insistere col prompt →
ricavarlo per via deterministica**. Direzione fix:
- **Far TRASCRIVERE al modello ogni riga 0AA1** (una lista di importi) e **fare la somma nel CODICE**,
  non chiedere la somma al modello. (Come `reconcileRailwayAttendance` per le presenze.)
- In alternativa/aggiunta: few-shot con una busta reale multi-riga che mostra la somma esplicita.
- Verificare che catturi le righe su TUTTE le pagine (le buste 2021+ sono su 2-3 pagine).

## Prossimi passi (multi-giorno)
1. Applicare il fix 0AA1 (trascrizione righe + somma in codice) → ri-misurare con il parser: obiettivo 0AA1 ~100%.
2. Estendere il parser a giorni lavorati / ferie / ticket (per verificare anche il divisore).
3. Generalizzare il parser come vera feature "prova d'accuratezza" (cancello Bari): puntalo su un lavoratore,
   ti dà gli scarti motore↔verità per codice.
4. Ri-scansionare Agosto 2018 (busta fallita).
