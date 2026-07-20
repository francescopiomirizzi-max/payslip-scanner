# Controllo mappatura "indennità di presenza" — Clarino (FSE) — 20/07/2026

> Preparazione videochiamata con Clarino. Domanda dell'utente: *"abbiamo mappato bene i
> codici delle indennità legate alla presenza?"*
> Metodo: griglia `anni` (228 righe) + estrazione grezza `payslip_metadata` + testo delle
> buste vere dal Desktop (`…/CLARINO FRANCESCO/…/Ruoli paga Clarino/`). Worker
> `311037d4-589e-44c0-8011-80571a06c5fa`, profilo FSE, start 2011.

## 1. La voce "presenza" è UNA sola, con 4 codici lungo le ere

La stessa voce (indennità giornaliera / compenso di presenza) cambia codice nel tempo. È la
"gemella" documentata nel [censimento §2](censimento-codici-fse-2011-2016.md):

| Era | Codice | Etichetta busta | Nel codice (`INDENNITA_FSE`) |
|---|---|---|---|
| set 2010 → giu 2017 | **663** | Indennità giornaliera | **NON è colonna** (esclusa) |
| lug 2017 → ott 2020 | **IX0023** | Indenn. giornaliera | colonna "Ind. Giornaliera" |
| nov 2020 → mag 2021 | **I86005** | Indennita' giornaliera | colonna "Ind. Giornaliera" |
| giu 2021 → oggi | **I86178** | Compenso di presenza | colonna "Comp. Presenza" |

Sui dati la catena è **pulita e senza buchi**: `IX0023` valorizzato 2017→ott2020,
`I86005` da nov2020, transizione `I86005→I86178` a maggio 2021 (con storno documentato),
`I86178` da giu2021 a oggi. Nessun mese usa due codici "vivi" insieme, nessuna sovrapposizione.

## 2. Cosa è CORRETTO (verificato sulle buste vere)

- **Codice → colonna giusto.** Su Set 2024 la busta stampa `I86178 Compenso di presenza G 22,000 × 25,41 = 559,02`;
  l'app ha `I86178 = 559,02`, `daysWorked = 22`. ✓
- **Multi-riga sommata.** Set 2024: `I86161 Comp. turno produttivo` su 2 righe (22,50 + 265,50) → app `I86161 = 288`. ✓
- **`25,41 €/giorno` costante** nell'era moderna: 559,02/22 = 584,43/23 = 533,61/21 = 25,41. La qty della voce
  = i "giorni di presenza" che diventano il divisore `daysWorked`. ✓
- **Ferie corrette.** `F2105 Ferie godute` in ORE ÷ 6,5 = giorni: Set 2024 110,5 h → 17; Ago 2022 104 h → 16.
  L'app estrae esattamente 17 e 16. ✓
- **Esclusioni giuste** e verificate sulle stesse buste: `AA712` funzione sala, `S11000` straordinario,
  `I86121` ticket → fuori dal numeratore. ✓
- **Era storica coerente:** la 663 non compare tra i codici (giusto), i giorni vengono dalla banda Presenze
  (Set 2013: worked 9 + ferie 17 = 26, tutto torna). ✓

➡️ **Sul "codici mappati bene" la risposta è: sì.** Nessun codice presenza è sbagliato, doppio o mancante.

## 3. IL punto da decidere insieme (e con l'avvocato): la 663 è esclusa, `I86178` è inclusa

Le due voci sono **la stessa voce** (§1), ma le trattiamo in modo opposto:
- **663 storica → ESCLUSA** dal numeratore. Motivo scritto in `types.ts`: *"pagata ~26gg fissi anche con
  17gg di ferie — Set 2013"* → è pagata **anche in ferie**, quindi non "persa in ferie".
- **`I86178` moderna → INCLUSA** nel numeratore (decisione utente 10/07 «calcoli nostri, perito = linea guida»).

**Ma sulle buste vere anche `I86178` è pagata durante le ferie** — stessa identica proprietà della 663:

| Mese | Compenso presenza (gg pagati) | Ferie godute | Permessi L104 | Presenza fisica reale |
|---|---|---|---|---|
| **Ago 2022** | `I86178` = **23 gg** × 25,41 | 16 gg (104 h) | 3 gg | ≈ pochi giorni (16+3 = 19 gg di assenza su ~22) |
| **Set 2024** | `I86178` = **22 gg** × 25,41 | 17 gg (110,5 h) | 3 gg L104 + 2 malattia | ≈ pochi giorni |

23 giorni di "presenza" pagati in un mese con 16 di ferie + 3 di L104 è impossibile come presenza *fisica*:
la voce è corrisposta sul mese pieno di giornate retribuite, **ferie incluse**. Non è un artefatto di un
mese: è sistematico su entrambi i mesi estivi controllati.

**Conseguenze:**
1. **Incoerenza interna nostra:** la voce presenza entra nel numeratore per le ere moderne (`I86178`/`I86005`/`IX0023`)
   ma non per l'era storica (663), pur essendo la stessa voce con lo stesso comportamento (pagata in ferie).
2. **Divergenza dal perito, più netta di quanto pensassimo.** Il [report di riconciliazione](riconciliazione-perito-clarino-2026-07-09.md)
   (riga 57) dice che il perito **esclude** `I86178`/`I86005`/`IX0023` dal numeratore in TUTTE le ere e le usa
   solo come fonte di `daysWorked`. Includendole "sovra-contavamo ≈ 800 €/mese" (presenza + sala + notturno).
3. **Impatto materiale:** `I86178` è la voce moderna più pesante del numeratore (~525–660 €/mese). La sua
   inclusione muove il totale della pratica in modo significativo (ordine di migliaia di €).

Questo NON è un bug: è la conseguenza diretta della scelta del 10/07 di andare oltre il perito. Ma va deciso
**sapendo** che la voce inclusa è pagata anche in ferie e che il perito la teneva fuori. Serve una scelta
consapevole (nostra + avvocato), non un default silenzioso.

## 4. Checklist operativa per la videochiamata

Buste da aprire davanti a Clarino (le ho già viste, servono per mostrare dal vivo):

1. **Set 2024 e Ago 2022** — far vedere `I86178 Compenso di presenza` (22/23 gg) accanto a `F2105 Ferie godute`
   (17/16 gg): la voce presenza è pagata anche nei giorni di ferie. È il cuore della decisione.
2. **Un mese "pulito"** (es. Feb 2025, 24 gg, 0 ferie) — mostrare che codice→colonna e 25,41 €/g tornano.
3. **Set 2013** (era storica) — mostrare che la 663 c'è sulla busta ma è (correttamente) fuori, e i giorni
   vengono dalla banda Presenze.
4. Chiedere a Clarino / verificare col Riepilogo del perito: nella colonna "Presenza" del perito, un mese
   con molte ferie è valorizzato o è a zero? Conferma se il perito la esclude davvero (come da riga 57).

## 5. Domande da girare all'avvocato (Celentano)

- La "indennità di presenza / compenso di presenza", essendo **già corrisposta durante le ferie**, va inclusa
  o esclusa dal calcolo della differenza retributiva sulle ferie? (Se è già pagata in ferie, non c'è ammanco su
  quella voce → il perito la esclude.)
- Se la si esclude, va esclusa in **tutte** le ere (coerenza con la 663), e la voce resta solo come conta-giorni.

## 6. Stato

- **Nessuna modifica al codice fatta.** La mappatura codici è corretta; l'unico nodo (inclusione/esclusione
  della voce presenza) è una decisione di metodo, non un errore da correggere di iniziativa
  (cfr. `feedback-ruolo-prepariamo-avvocato-decide`).
- Se dopo la call si decide di allinearsi al perito: rimuovere `I86178`/`I86005`/`IX0023` da `INDENNITA_FSE`
  come colonne, tenerle nel prompt solo come fonte di `daysWorked` (è il piano già scritto al §98-99 del report
  di riconciliazione). Impatto: totale in calo, allineato al perito.
