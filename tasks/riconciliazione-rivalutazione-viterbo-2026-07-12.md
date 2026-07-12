# Riconciliazione rivalutazione/interessi — Viterbo vs prospetto del perito (12/07/2026)

> Bersaglio: `Desktop/Pratiche…/Vertenze Mancati riposi/Nuovi file da analizzare/VITERBO FSE/Viterbo (Interessi e Rivalutazioni).pdf`
> (166 pagine testuali, PDFCreator). Esito: **metodo del perito decifrato e riprodotto**; modulo di
> produzione [utils/rivalutazione.ts](../utils/rivalutazione.ts) costruito su quel metodo con indici ufficiali.

## 1. Struttura del prospetto del perito

- **165 pagine mensili** (gen 2011 → set 2024; ott 2024 = mese di scadenza, senza pagina) + 1 pagina «Riepilogo Generale».
- Ogni pagina: un mese di danno. Capitale iniziale = **somma delle indennità della serie A di quel mese**
  — verificato **165/165 al centesimo** contro il nostro seed (`public/viterbo-seed.json`): il perito rivaluta
  la serie A INTERA (CEE e non CEE), capitale complessivo 98.732,03.
- Decorrenza = ultimo giorno del mese; scadenza comune = 31/10/2024; «Indice Istat utilizzato: FOI generale».
- **Riepilogo Generale**: capitale 98.732,03 + rivalutazione 14.475,09 + interessi 9.747,67 = **122.954,79**.

## 2. Metodo decifrato (calibrazione sui dati, non a tavolino)

1. **Indici FOI MENSILI a 1 decimale** — gli «Indice alla Decorrenza» stampati coincidono ESATTAMENTE con le
   tavole ufficiali ISTAT (verifica: prospetto CCIAA Genova su dati ISTAT + rivaluta.it). Cambio base al 2016
   col raccordo ufficiale **1,071** (= media 2015 in base 2010).
2. **Rivalutazione CONCATENATA per anno solare**: capitale × coefficiente(anno), dove
   coefficiente = FOI(fine segmento) ÷ FOI(fine segmento precedente) **arrotondato alla 3ª cifra decimale**,
   capitale arrotondato al centesimo ad ogni passo. Primo segmento: dal mese di decorrenza a dic; ultimo: a
   scadenza. Esempio pagina gen 2011: 601,79 ×1,028 = 618,64 ×1,024 = 633,49 ×1,006 = 637,29 … ×1,010 = 765,40 —
   TUTTI i passi coincidono con le righe stampate. I coefficienti annuali possono scendere sotto 1 (0,999 nel
   2014; 0,998 nel 2020): nessun floor per anno; il floor è sul risultato finale.
3. **Interessi legali per segmento**: capitale rivalutato di fine segmento × tasso dell'anno × giorni/**365
   (base fissa, anche nei bisestili)**; giorni = differenza di calendario pura tra i confini del segmento
   (es. 31/01/2011→31/12/2011 = 334; 01/01→31/12/2012 = 366; 01/01→31/10/2024 = 305).

## 3. Esito della riproduzione

| Verifica | Esito |
|---|---|
| Capitali mensili = serie A per mese (seed) | **165/165 al centesimo** |
| Pagine riprodotte al centesimo (cap. rivalutato, rivalutazione, interessi, totale, ogni riga) | **153/165** |
| Righe di interessi esatte sulle pagine riprodotte | **1.184/1.184** |
| Riepilogo Generale — capitale | 98.732,03 = **identico** |
| Riepilogo Generale — rivalutazione | nostro 14.479,55 vs 14.475,09 (**Δ +4,46**) |
| Riepilogo Generale — interessi | nostro 9.748,05 vs 9.747,67 (**Δ +0,38**) |
| Riepilogo Generale — totale | nostro 122.959,63 vs 122.954,79 (**Δ +4,84 = +0,004%**) |

**Le 12 pagine divergenti** (2012-01, 2012-05, 2013-02, 2014-07, 2019-06, 2022-03, 2022-07, 2022-10, 2022-11,
2023-05, 2023-06, 2023-10; Δ da ±0,01 a ±1,71 € sul capitale rivalutato) hanno TUTTE il primo coefficiente con
rapporto «borderline» al 3° decimale (es. 1,0755→ il perito usa 1,075, noi 1,076; 0,99748→ lui 0,998, noi 0,997):
il suo software usa internamente indici con più decimali di quelli pubblicati (non riproducibili da fonte
ufficiale — il FOI è pubblicato a 1 decimale). Le transizioni annuali dic→dic sono invece TUTTE spiegate dai
round3 dei rapporti pubblicati. Conclusione: **stesso metodo, scarto da arrotondamenti interni del suo software,
+0,004% (leggermente A FAVORE nostro, dichiarabile)**.

## 4. Dati recuperati da fonte ufficiale (12/07/2026, doppia fonte)

- **FOI mensile nov 2024 → mag 2026** (ultimo pubblicato; prossimo indice il 16/07/2026): serie in
  [utils/rivalutazione.ts](../utils/rivalutazione.ts). Dal gen 2026 nuova base 2025=100, raccordo ufficiale **1,214**.
- **Tassi legali**: 2025 = **2,00%** (DM 10/12/2024) · 2026 = **1,60%** (DM 10/12/2025, GU n. 289 del 13/12/2025).
- ⚠️ **Finding fuori scope, NON corretto**: `LEGAL_INTEREST_RATES` in [istatService.ts](../istatService.ts)
  (motore Incidenze) riporta 2025 = 2,50 «provvisorio» → il valore vero è 2,00. Gli interessi 2025 delle
  Incidenze sono quindi leggermente sovrastimati. Decidere se correggerlo in una sessione Incidenze.

## 5. Numeri di produzione (config DB: coeff 1, tempestività OFF, solo CEE, curva derivata)

Alla scadenza di oggi (limitata all'ultimo indice: **31/05/2026**, dichiarato nei documenti):

- **Serie A**: capitale 98.732,03 + rivalutazione 18.931,55 + interessi 13.294,10 = **€ 130.957,68**
- **Serie B**: capitale 21.784,85 + rivalutazione 4.076,78 + interessi 2.857,46 = **€ 28.719,09**

Copie reali per il collaudo visivo: `~/Desktop/viterbo-relazione.docx` + `~/Desktop/viterbo-conteggi.html`.

## 6. Artefatti di calibrazione (scratchpad, non nel repo)

`parse-perito.mjs` (parser 166 pagine → JSON, somme = riepilogo), `decifra-metodo.mjs` (serie FOI dalle
decorrenze, coefficienti impliciti), `riproduci-pagine.mjs` (153/165), `crosscheck-seed.mjs` (165/165),
`e2e-viterbo.mjs` (documenti reali + asserzioni).
