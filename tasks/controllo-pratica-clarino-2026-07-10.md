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

## 2. Da CORREGGERE (2 mesi, solo il campo giorni)

I due mesi che l'AI stessa ha flaggato ("Anomalia: Presenze > 31") hanno gli **importi giusti ma i GIORNI sbagliati** — `daysWorked` è il divisore delle medie, quindi sono total-mover:

### 2a. Maggio 2021 — `daysWorked` 75 → **24**
- Cedolino: DUE righe I86178 (24 gg del mese + **75 gg retroattivi** di ricodifica I86005→I86178) + storno I86005 −75. L'app ha preso 75.
- **Banda GG LAV = 24** (fonte pulita). Il perito usa 25. Netto voce: 24+75−75 = 24.
- Impatto: divisore 2021 gonfiato **334 → 283 gg reali (+18%)** → media 2021 sottostimata → si riflette sul credito 2022 (media anno precedente).

### 2b. Gennaio 2018 — `daysWorked` 38 → **da decidere (NON 38)**
- Voce IX0023 qty **38** (include arretrati; mese con Malattia/Carenza). **Banda GG LAV = 22** · **perito = 15**.
- Tre numeri diversi: 38 è certamente sbagliato; la scelta tra 22 (banda) e 15 (perito, coerente con la malattia) è metodologica → nota per l'avvocato o criterio interno. Impatto sul divisore 2018: −23 o −16 gg.

**Come correggere:** DALL'APP (griglia mensile) + hard refresh — MAI via SQL (lezione anni-clobber 30/06).

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

- [ ] Correzione `daysWorked` Mag 2021 (→24) e Gen 2018 (→22 o 15, decide l'utente/avvocato) dall'app.
- [ ] Set 2017 quando arriva da Vincenzo; 2026 (Gen-Giu) se rilevante per la pratica.
- [ ] Parser di verità FSE (requisiti §4) — prossima sessione.
- [ ] Quesiti avvocato invariati (ricostruzioni 2011-2020, 041, oltre nov-24) + eventuale quesito su Gen 2018 e media mobile vs anno solare.
