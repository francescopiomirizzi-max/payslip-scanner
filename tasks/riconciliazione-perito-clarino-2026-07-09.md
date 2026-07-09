# Riconciliazione deterministica perito ↔ cedolini — FSE / Clarino Francesco — 09/07/2026

> **Scopo:** derivare l'esatto set di voci che il perito conta nel "Riepilogo Generale Ferie"
> (totale di riferimento **8.170,94 €**, TFR 566,87 €) prima di costruire il profilo/motore OCR FSE.
> **Metodo:** script Node (pdfjs-dist del progetto, dal disco, zero API) che parsa il riepilogo del
> perito per coordinate (167 righe mensili gen-2011→nov-2024) e i **~100 cedolini testuali 2017-2026**,
> poi riconcilia mese per mese col subset-sum al centesimo sulla colonna COMPETENZE.
> Script: scratchpad `recon-fse.mjs` (sessione 09/07 serale). Fonti: Desktop, cartella Clarino.

## 1. Esito globale

| Era | Mesi confrontati | Esito |
|---|---|---|
| **nov 2020 – nov 2024** (codici I8/T8) | 49 | **49/49 riconciliati al centesimo, zero ambiguità** (unica eccezione: il residuo 3,50×GG di dic 2020, ultima coda della ricostruzione — v. §4) |
| **lug 2017 – ott 2020** (codici IX) | 39 | Voci stampate riconciliate al centesimo **+ 2 ricostruzioni sistematiche del perito NON stampate sui cedolini** (v. §4) |
| **gen 2011 – giu 2017** (scansioni immagine, codici a 3 cifre) | — | non verificabile senza OCR; le colonne del perito (Percorrenze, Nastri, Guide, Rimorchio…) suggeriscono voci stampate dell'era SPA-GUIDA |

Validazione del parser sul riepilogo: somma "Indennità Ferie Spettanti" = **6.309,08** vs 6.340,97
dichiarati; somma "Totale" = 8.139,01 vs 8.170,94. Lo scarto (31,89 identico su entrambe) è la coda
della **sola riga 11/2024** (ultima riga, colonne finali fuori griglia); tutto il resto torna al centesimo.

## 2. Regole del perito INCHIODATE (verificate su tutti i mesi testuali)

1. **GG Effettivi Lavoro = giorni (G) della voce "presenza/giornaliera" dell'era**, NON "GG LAV." della banda:
   - 2017–ott 2020: `IX0023` Indenn. giornaliera · nov 2020–2021: `I86005` Indennita' giornaliera · 2022+: `I86178` Compenso di presenza.
   - Eccezioni residue solo in mesi 2017 con L104/ferie pesanti (perito da fonte esterna, v. §5).
2. **Ferie fruite = ore della voce `F2105` "Ferie godute" ÷ 6,5** (giornata ferie = 6,5h): esatto su TUTTI i mesi mar 2018 → nov 2024 (0 eccezioni). Attenzione alla gemella `X2016` "Permessi retribuiti" (stessa forma H, NON ferie).
3. Gli importi indennità si leggono dalla colonna **COMPETENZE** (7 colonne Zucchetti).

## 3. Set di voci INCLUSE dal perito (= colonne/numeratore del profilo FSE)

**Era recente (nov 2020 → oggi), codici I8/T8** — frequenza nei 49 mesi riconciliati:

| Codice | Descrizione cedolino | Colonna perito | Freq. |
|---|---|---|---|
| I85240 | Punto 5 acc.21/5/81 (1) | Ind. Turno Art5A Cnnl | 46 |
| T8305 | Trasferta 90% | Trasferte/Diarie | 35 |
| T8309 | Trasferta C1 10% | Trasferte/Diarie | 29 |
| I85245 | Punto 5 acc.21/5/81 (2) | Ind. Domen.le Art5B Cnnl | 20 |
| I85248 | Indennità domenicale | Ind. Domen. Aziendale | 17 |
| T8306 | Trasferta 50% | Trasferte/Diarie | 6 |
| I86025 | Indennità Aggiuntiva | IndAggiun | 4 (2020-21) |
| T8304 / T8323 | Trasferta (varianti) | Trasferte/Diarie | 1+1 (dic 2022) |
| I86174 | Comp. produttività a vuoto | Guide | 1 (nov 2024) |

**Era IX (lug 2017 → ott 2020)** — riconciliate al centesimo dentro i NO-MATCH:

| Codice | Descrizione | Colonna perito |
|---|---|---|
| IX0002 | Art. 5A | Ind. Turno Art5A Cnnl |
| IX0001 | Art. 5/B | Ind. Domen.le Art5B Cnnl |
| IX0051 | Trasferta A1 24% | Trasferte/Diarie |
| IX0052 | Trasferta A2 9% | Trasferte/Diarie |
| IX0057 | Trasferta B1 90% | Trasferte/Diarie |
| IX0058 | Trasferta B2 50% | Trasferte/Diarie |

**Voci ESCLUSE dal perito (verificato, mai nei subset):** `I86178`/`I86005`/`IX0023` presenza-giornaliera
(~530 €/mese — usata SOLO come contatore GG), `AA712` Compenso funzione sala (270 €/mese fisso),
`I85210`/`IX0046` notturno, `S11000`/`IX0048`/`V12000`/`V12001`/`I86125` straordinari e festivi,
`I86161` Comp. turno produttivo, ticket (`I86120`/`I86121`), voci INPS/L104 (`PIH*`/`PX*`), ANF, una tantum.
⇒ Il set del pomeriggio (13 colonne in `INDENNITA_FSE`) **sovra-contava**: presenza+sala+notturno ≈ 800 €/mese di troppo.

## 4. Ricostruzioni del perito NON stampate sui cedolini (2017 → dic 2020)

Nei 39 mesi IX (+dic 2020) il "Toale Mese" include importi che NON esistono come voce stampata:

1. **"Ind. Aziendale" = 3,50 € × GG Effettivi** — presente in TUTTI i mesi lug 2017 → dic 2020
   (70,00=20gg · 73,50=21gg · 87,50=25gg · 91,00=26gg…). Cessa a gen 2021.
2. **"IndAggiun/Rimorchio" ≈ 1,76 € × giorni-Art.5A** (giorni della voce IX0002, non i GG) — quasi tutti
   i mesi 2018-2020. Il cedolino stampa `IX0014` Indenn. aggiuntiva a **0,46 €/g**: il perito NON la usa
   e applica la sua tariffa. Da nov 2020 usa invece la voce stampata `I86025` (0,57 €/g).
3. **Solo lug 2017–apr 2018 (coda era SPA-GUIDA):** ulteriori colonne ricostruite (Percorrenze ~5-6 €/gg,
   Guide ~3 €/gg, Nastri, Flessibilità ~0,5 €/gg…) non riconducibili alle voci stampate.

⇒ **In quest'era i totali del perito NON sono riproducibili dai soli cedolini.** Sommando le sole voci
stampate incluse, l'app darà — a parità di metodo — un numeratore **inferiore** a quello del perito
per il 2017-2020 (≈ 3,50×GG + 1,76×gg5A al mese, ~100-135 €/mese).

## 5. Altri dati del perito da fonte esterna

- **Ferie 2017 (lug-dic):** il perito indica ferie fruite (3, 11, 3, 3…) ma i cedolini 2017 NON hanno
  la voce F2105 né la banda FERIE GODUTE valorizzata → fonte esterna (badge/aziendale).
- **GG di alcuni mesi 2017** (es. ago 2017: perito 15 = giorni Art.5A, non i 22 della giornaliera).
- La riga **set 2022** del perito è vuota (nessun GG) pur avendo il cedolino AA712 in competenze.

## 6. Audit cartella / nomi ↔ contenuto (fatto stasera, rename inclusi)

- `2024/Luglio 2024.PDF` era in realtà la **Quattordicesima 2024** (periodo "Luglio 2024 / 14a mens.",
  voci R4210/R4230) → rinominata; il vero mensile era `Luglio 2024 (1).PDF` → ora `Luglio 2024.PDF`.
- `2017/2017 1:2.pdf` = **scansione Gen-Giu 2017** (6 cedolini fronte/retro, fax-simile INAIL, codici a
  3 cifre, era SPA-GUIDA) → rinominata `Gennaio-Giugno 2017 (scansione).pdf`.
- Rinominati i `(1)` di 13ª/14ª 2022 e `Novembre_2025.pdf`.
- Audit contenuto di tutti i mensili testuali 2017-2026: **nessun altro mismatch**.
- **Mancanti (da chiedere a Vincenzo):** Settembre 2017, Tredicesima 2017, Tredicesima 2023, Tredicesima 2025.

## 7. Conseguenze per il build (applicate stasera)

- `INDENNITA_FSE` riscritta = **solo le 16 voci del §3** (10 era I8/T8 + 6 era IX). Le voci escluse
  NON diventano colonne; `I86178`/`I86005`/`IX0023` restano nel prompt SOLO come fonte di `daysWorked`.
- Prompt OCR: `daysWorked` dai giorni G della voce presenza; `daysVacation` = F2105 H ÷ 6,5;
  fisse dal box ELEMENTI DELLA RETRIBUZIONE; ticket I86120/I86121 → ticketRate; 13ª/14ª → nessuna voce.
- TFR: sul cedolino FSE esiste `W75005` Fondo TFR 31/12 a.p. (→ `fondo_pregresso_31_12`) ma NESSUN
  imponibile TFR annuo consolidato stile RFI → `imponibile_tfr_mensile` = 0, riflesso TFR da metodo perito.
- Codici era 2011-2016 (scansioni): da censire in fase OCR (visti nel fax-simile: 029 Art.5A,
  4 Trasferta A2 9%, 663 Indennità giornaliera…). Le colonne si estenderanno allora.

## 8. Input neutri per l'avvocato (non "errori": scelte del perito da confermare)

1. **2017-2020:** replicare le sue ricostruzioni a tariffa (3,50×GG; 1,76×gg-Art5A) o contare solo le
   voci stampate? (Se replicare: fattibile con colonne-formula sull'app — `3,50 × [daysWorked]` — ma è
   una scelta di metodo che spetta a lui.)
2. **2011-2016:** confermare che le colonne del suo riepilogo corrispondano alle voci stampate dell'era
   SPA-GUIDA (verificabile solo dopo l'OCR delle scansioni).
3. **2025-2026:** il riepilogo si ferma a nov 2024; i cedolini successivi esistono — estendere il conteggio?
   (Compare anche `I86110` Ind. disponibilità nel censimento pomeridiano: mai vista nel periodo del perito,
   trattamento da decidere se ricorre nel 2025-26.)
