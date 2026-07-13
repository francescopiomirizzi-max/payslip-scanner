# Censimento codici/tariffe ELIOR VIAGGIANTE — 13/07/2026

> Fase 1 del piano «carico + scansione con controlli OCR cartacee» (piano controlli
> ratificato l'11/07). OCR **Vision macOS locale** (zero API) su **tutte le 676 buste**
> splittate (Feb 2020 → Dic 2025, 10 lavoratori), parser geometrico con spareggi
> deterministici. Dataset di consenso copiato accanto alle buste sul Desktop:
> `censimento-vision-buste-2026-07-13.json` + `censimento-vision-codici-2026-07-13.csv`.

## Numeri del censimento
- **676/676 buste** processate; **416 (62%) riconciliate al centesimo** da Vision
  (Σ colonna competenze = TOTALE COMPETENZE stampato). Il restante 38% = limiti di
  lettura Vision su scansioni deboli (non errori dei documenti): fa da *secondo
  occhio*, la lettura di produzione resta Gemini + validatore.
- **186 codici voce distinti** censiti con descrizione e tariffe unitarie per anno.
- Top voci ricorrenti: 7310 (TFR base, 622), 1000 (retribuzione, 611), 2000/2001
  (ticket, 605/596), **1129 turno non cadenzato (587)**, 1130 notturno (582),
  **4301 fuori sede RFR (572)**, 4255/4256 pernottamento (558/556), 1131 domenicale (530).

## 🔴 Finding principale — la voce della vertenza residenza è la 4301
Nelle 676 buste **non esistono MAI le voci 4300 «Ass. Res. No RS» / 4305 «Ass. Res. RS»**
assunte dalla knowledge (dal ricorso). L'indennità di assenza dalla residenza viaggia su:

| Voce | Descrizione | Tariffa osservata | Presenza |
|---|---|---|---|
| **4301** | FUORI SEDE ITA TURNI RFR | **€ 1,00/ora — COSTANTE Feb 2020 → Dic 2025** | 572/676 buste, tutti e 10 i lavoratori |

- RFR = *Riposo Fuori Residenza* → la 4301 corrisponde alla misura «con riposo»
  (accordo aziendale 2014: € 1,00; CCNL 2016: € 2,20).
- **Nessuna voce a € 0,75** (misura ridotta «senza riposo») in tutto il corpus; nessuna
  voce nuova a € 1,30/€ 2,20 nemmeno dopo ago 2023.
- ⚠️ **Contraddice il ricorso** («da agosto 2023 Elior paga la misura piena»): nelle
  buste di questi 10 lavoratori la tariffa resta € 1,00 fino a **Dic 2025** (verificato
  con terne unit×qty=comp per mese, incluse Ott 2023, 2024 e 2025; conferma indipendente
  Gemini su Cautilli Ott 2023: 4301 = 194,05 = 1,00×194,05h).
- Conferma dal vecchio gestionale (griglia `anni`): 4301 popolata in 62-68 mesi per
  lavoratore (2020-2025); 4300/4305 = 4 righe spurie su ~2.280.
- **Conseguenza per l'area Indennità**: la pratica va configurata sulla voce 4301
  (pagato € 1,00/h → dovuto € 2,20/h se qualificata «con riposo»), periodo esteso fino
  a TUTTO il corpus e non solo lug 2023. Il periodo nov 2017 – gen 2020 resta scoperto
  (buste mancanti, da chiedere a Vincenzo). **Qualificazione giuridica → avv. Celentano.**

## Tariffe unitarie verificate (terne unit×qty=comp, per la tabella del validatore)
| Voce | Descrizione | Tariffa | Note |
|---|---|---|---|
| 1126 | Indennità di cassa | 2,20/h | costante 2020-2025 |
| 1129 | Ind. turno non cadenzati | 2,25/h | costante |
| 1130 | Lavoro notturno | 2,40/h | costante |
| 1131 | Lavoro domenicale oltre 2HH | 20,00/evento | per domenica lavorata |
| 2000/2001 | Ticket viaggiante/suppl. | 5,20 → 7,20 | 7,20 dal 2025 (+ 0214 «ticket fascia oraria» dal 2024) |
| 4255/4256 | Pernottamento/pernottazione | 2,80/notte | costante |
| 4301 | Fuori sede ITA turni RFR | 1,00/h | LA voce della vertenza |
| 4340/4345 | Disposizione/riserva media presidio | variabile (14-32) | tariffa giornaliera variabile, non fissa |
| 6548 | Ctr c/dip esonero L.197/22 | — | figurativa, NON nel totale competenze |

## Codici NON estratti dal prompt attuale (colmati nel prompt v2)
- **1129** (587 buste!): il vecchio gestionale la estraeva (588 righe in `anni`), il prompt
  attuale NO e **non ha colonna in griglia** → non è mai entrata nei totali ferie.
  **Decisione aperta per l'utente/avvocato**: aggiungere la colonna la farebbe entrare
  nel motore incidenza (i totali ferie viaggiante si muovono).
- 4340 (45 buste, dal 2022), 4053 (dal 2025), 0214 (ticket 2024+): aggiunti al prompt v2.
- 4307 = variante/refuso di stampa di 4301 (2 occorrenze, stessa descrizione).

## Trappole apprese (per prompt/validatore)
1. **Scansioni RUOTATE**: il lato destro è ~1 riga più in alto del sinistro; l'offset
   verticale label↔valori VARIA da busta a busta (anche di segno) → nel prompt:
   «associa i numeri alla riga per ORDINE, non per allineamento».
2. Il cedolino stampa la **terna completa** (VALORE UNITARIO × ORE/GG/MESI = COMPETENZE)
   e 4 totali di controllo: TOTALE RETRIBUZIONE (= competenze della riga 1000),
   TOTALE COMPETENZE (= Σ colonna competenze, **al centesimo**), TOTALE TRATTENUTE,
   NETTO (= totComp − totTratt ± arrotondamento ≤ 1). Su 416 buste la quadratura
   Vision regge al centesimo → la colonna competenze somma SEMPRE al totale stampato
   (nessuna voce «in colonna ma fuori totale» tipo D01CNG di FSE; la 6548 figurativa
   non stampa importi in colonna competenze).
3. **Il modello tronca il JSON quando `voci` è l'ultima chiave** (finishReason STOP senza
   graffa finale): mitigato con ordine chiavi nell'esempio + riparazione graffe in
   `cleanAndParseJSON` + merge multi-pagina di voci/totali in `mergeBlocks`.

## Prova end-to-end del prompt v2 (Gemini flash, parametri di produzione)
5/5 buste rappresentative **perfette** (terne 8-13/busta tutte verificate, recon Δ = 0,00,
validatore OK): pilota Boriglione Mar 2021 · NITTI Mar 2023 (scansione storta) ·
Cautilli Ott 2023 (post-switch: 4301 ancora 1,00) · Cautilli Mar 2025 (cedolino 2 fogli,
merge ok) · De Biasio Mar 2021 (dove Vision leggeva parziale).
