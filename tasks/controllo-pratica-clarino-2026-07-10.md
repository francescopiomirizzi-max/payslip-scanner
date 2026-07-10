# Controllo totale pratica Clarino Francesco (FSE) — 10/07/2026 notte

> **Metodo:** controllo integrale su DB (archivio `payslip_metadata` + griglia `anni`) via SQL,
> verifiche mirate sui PDF sorgente (pdftotext, cartella Desktop) e confronto con i valori
> già verificati al centesimo del censimento (§7) e del riepilogo perito.
> Worker: `311037d4-589e-44c0-8011-80571a06c5fa` · profilo FSE · status "pronta" · start 2011.

## 1. Esiti VERDI (il grosso della pratica è sano)

| Controllo | Esito |
|---|---|
| Copertura archivio | **183 buste**: 2010 = 4 (Set-Dic ✓ assunzione 01/09/2010), 2011-2016 = 12/12, 2017 = 11 (**manca solo Set 2017 = mancante NOTO, atteso da Vincenzo**), 2018-2025 = 12/12. Niente 2026. |
| Duplicati / mensilità extra | **Zero duplicati; zero 13ª/14ª caricate** (regola rispettata). |
| Doppio Dicembre 2010 | Scelto e caricato **Nº 0046860** (netto 1.439,58); il Nº 0022887 NON caricato. |
| Estrazioni | 0 vuote; **tutte le 183 col contratto a 32+5 chiavi → prompt NUOVO (§5-ter) su ogni mese**, incluse le ere storiche. |
| Campioni al centesimo | **Nov 2011 e Set 2013 = identici ai valori verificati del censimento §7** (029=12,48/4,68 · serie A 86,41 · serie B 76,10/248,36 · GG dalla banda 24/9 · ferie 17 nel mese-trappola · 663 correttamente esclusa). |
| Storni / conguagli (scan full-text 2017-2025) | Solo **3 mesi, tutti 2021**. Importi **NETTATI CORRETTAMENTE** dall'app, verificati al centesimo sul PDF: Mag = 2.515,59 −1.611,75 −41,61 → netto set 862,23 ✓ (609,84 mese + 294,00 ricodifica 75gg I86005→I86178 − 41,61 storno aggiuntiva) · Giu: I85240 11,44 = 11,96−0,52 ✓ · Ott: I86178 584,43 = 609,84−25,41 ✓. |
| Griglia `anni` | 228 righe (2007-2025; 2007-09 fantasma innocue). Coerente con l'archivio sui campioni; note trasportano i warning AI; **zero valori con la virgola** (il rischio TFR-anno-fantasma dei nuovi test NON è attivo qui). |
| TFR | Imponibile 0 ovunque **BY DESIGN** (il cedolino FSE non stampa un imponibile TFR consolidato; regola esplicita nel PROMPT_FSE). Punto zero utente: 973,64 @ 2018. |
| Set 2022 tutto a 0 | Coerente: **anche la riga del perito è vuota** (report riconciliazione §, riga 84). Cedolino = solo AA712 (fisso, escluso). |

## 2. CORRETTI l'11/07 (2 mesi, solo il campo giorni) ✅

I due mesi che l'AI stessa ha flaggato ("Anomalia: Presenze > 31") avevano gli **importi giusti ma i GIORNI sbagliati** — `daysWorked` è il divisore delle medie, quindi total-mover. **Corretti via SQL l'11/07** (griglia `anni` con ordinalità preservata + `payslip_metadata`, nota ✏️ appesa al mese; verificato: 228 elementi, mese di controllo intatto, divisori 2021 334→283 e 2018 295→273; richiesto hard refresh all'utente prima di riusare l'app su Clarino):

### 2a. Maggio 2021 — `daysWorked` 75 → **24** ✅
- Cedolino: DUE righe I86178 (24 gg del mese + **75 gg retroattivi** di ricodifica I86005→I86178) + storno I86005 −75. L'app aveva preso 75.
- **Banda GG LAV = 24** (fonte pulita). Il perito usa 25 (±1). Netto voce: 24+75−75 = 24.
- Chiusura del cerchio: lo storno di 75 gg = esattamente Feb+Mar+Apr 2021 (24+24+27 gg di I86005 positiva; Gennaio rimasto I86005) → il trattamento "importi come pagati, gg del mese reali" è coerente a livello anno.

### 2b. Gennaio 2018 — `daysWorked` 38 → **16** ✅ (deciso su prova documentale)
- Voce IX0023 qty **38** = 16 di gennaio + **22 arretrati di Dicembre 2017**: il cedolino di Dic 2017 NON ha la voce giornaliera (Nov 2017 sì, 24×9,63) e **GG Dic = 22 sia nella nostra estrazione sia nella riga del perito**.
- Il perito scrive 15 per Gen 2018 (±1 come su Mag 2021, dove scrive 25 vs banda 24) → annotato nella nota del mese, eventuale quesito.
- Prova collaterale: banda GG LAV vuota nel mese di assenza totale (Set 2022) → la banda traccia il servizio reale, non i giorni teorici.

## 3. Nota metodologica (non è un bug, ma va saputa)

- **Il perito usa la media MOBILE dei 12 mesi precedenti** (header riepilogo: "indennità di incomodo nei
  12 mesi precedenti", colonne "Emolumenti/Giorni 12 Mesi Prec."). **Il nostro motore usa la media
  dell'ANNO SOLARE precedente** (fallback: anno corrente). Metodi diversi → altra ragione per cui
  totali app ≠ perito BY DESIGN (oltre al set voci più ampio).
- **Start 2011 con riferimento 2010 parziale** (Set-Dic, 104 gg): la media di riferimento per il 2011
  è su 4 mesi autunnali. Il perito ha la stessa limitazione (parte da gen-11 con 4 mesi di storia).
  Coerente con la regola "anno riferimento completo" andrebbe flaggato, ma qui il dato 2010 pieno
  NON ESISTE (assunzione 01/09/2010) → nota informativa, eventualmente quesito.

## 4. Requisiti EMERSI per il parser di verità FSE (da questo controllo)

1. **Multi-riga stesso codice** → somma (Mag 2021: I86178 ×2; AA712 ×2; I85248 ×2).
2. **Righe negative (storni)** → nettare, mai scartare (I86005/I86025/I85240/I86121 negativi reali).
3. **GG robusto**: banda **GG LAV** come fonte primaria nell'era Zucchetti + confronto con qty voce
   presenza; se divergono → flag (avrebbe preso al volo sia Mag 2021 sia Gen 2018).
4. Gestione 3 ere (I8/T8 · IX · storica scansioni — quest'ultima NON parsabile via testo, resta OCR+censimento).
5. Skip 13ª/14ª e mesi di assenza (Set 2022: GG LAV 0 → riga legittimamente vuota).
6. Base di partenza: logica dello script di riconciliazione (49/49) + regole censimento §7.

## 5. Azioni aperte

- [x] Correzione `daysWorked` Mag 2021 (→24) e Gen 2018 (→16) — FATTA 11/07 via SQL con verifica; hard refresh richiesto all'utente.
- [ ] Set 2017 quando arriva da Vincenzo; 2026 (Gen-Giu) se rilevante per la pratica.
- [ ] Parser di verità FSE (requisiti §4) — prossima sessione.
- [ ] Quesiti avvocato invariati (ricostruzioni 2011-2020, 041, oltre nov-24) + nuovi: Gen 2018 16-vs-15, media mobile vs anno solare.
- [ ] Push/deploy unico: DOPO il lavoro Elior (decisione utente 11/07).
