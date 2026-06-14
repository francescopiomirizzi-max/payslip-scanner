# Codici voce per profilo

Legenda dei codici voce delle buste, per profilo azienda. Per la base contrattuale vedi
[`ccnl-e-normativa.md`](ccnl-e-normativa.md); per cosa entra nel credito vedi
[`metodologia-calcolo.md`](metodologia-calcolo.md).

Touch points nel codice: set variabili = `INDENNITA_<AZIENDA>` (types.ts) filtrato da
`EXCLUDED_INDEMNITY_COLS` (calculationEngine.ts); set fisse = `INDENNITA_<AZIENDA>_FISSE`
(types.ts) via `getFixedColumnsByProfile` + whitelist per profilo `getFixedVociIds`
(utils/fixedVociBackfill.ts); estrazione = prompt per azienda e action `fixed-voci`
(parametrica per company) in `netlify/functions/scan-payslip.ts`.

> ⚠️ Qualsiasi modifica al set **VARIABILE** cambia gli **euro del credito** → ricalcolare,
> aggiornare i test, ri-deployare. Le voci **fisse** e le **%** sono additive (non toccano gli euro).

---

## RFI / Trenitalia

### Variabili — entrano nel CREDITO (set confermato dall'avvocato, 17 voci)

`0152, 0421, 0423, 0457, 0470, 0482, 0496, 0576, 0584, 0687, 0919, 0920, 0932, 0933, 0995,
0996, 0AA1` — più **Ticket / Buoni Pasto** (colonna standard a parte).

Reperibilità (art. 79): `0482` €14, `0584` €32/€58, `0470` €20, `0496` €6 (remoto, novità 2025).

> Nota codice: l'array `INDENNITA_RFI` (types.ts) contiene anche `3B70`/`3B71`, ma sono in
> `EXCLUDED_INDEMNITY_COLS` → **non** entrano nel credito (vivono nel Quadro B fisse). Il set
> che genera euro = `INDENNITA_RFI` **meno** `EXCLUDED_INDEMNITY_COLS` = le 17 voci sopra.

### Fisse — Quadro B, NON generano credito (servono per le %), 10 voci

| Codice | Descrizione | Note |
|---|---|---|
| `3B01` | Minimo | sempre presente |
| `3B03` | Superminimo | sempre |
| `3B05` | ERI | non tutti (es. D'Errico **non** ce l'ha) |
| `3B10` | Salario Professionale | sempre |
| `3B15` | Ind. Funzione | **solo Quadri/dirigenti** (costante → trattata come fissa) |
| `3B20` | APA | sempre |
| `3B30` | EDR 8.11.95 | non tutti |
| `3B35` | EDR acc. 11.9.98 | non tutti |
| `3B70` | Salario Produttività | l'avvocato lo colloca nel Quadro B (confermato) |
| `3B71` | Salario Produttività | idem |

- Il totale **"RETRIBUZIONE MENSILE"** stampato in busta = Minimo + Superminimo + ERI +
  Salario Prof. + APA (**esclusi gli EDR**). Per chi non ha ERI/EDR (es. D'Errico) la base fissa
  è 3B01 + 3B03 + 3B10 + 3B20 (+ 3B70/3B71 se presenti).

### In sospeso / esclusi

- `3B50` — **Ind. Utilizzazione Professionale**: **VARIA** mese su mese (es. D'Errico 2007:
  74,46 / 84,17 / 61,51) ed è **fuori** dalla "Retribuzione mensile" → NON è fissa. Per ora
  **né variabile né fissa**, non reclamata (non è nell'elenco del ricorso). Dubbio residuo: se
  vada almeno nel denominatore delle %. Da decidere con l'avvocato.
- `0AA2` — **Trasferta imponibile**: variabile vista su Taronna, **non** estratta oggi (il sito
  ha solo `0AA1`). Esclusa salvo richiesta avvocato.
- `0686` (linea > 10h), `0376` (indennità varie) — esclusi (il set ha solo `0687`).

> **Nota macchinista (PDM):** l'Excel di Palladino è di un **macchinista Trenitalia/PDM**, con
> voci diverse (IUP, divisore fisse `÷12÷26`, detrazione voce `0792` €12,80). **Non si applicano
> a RFI** (`0792` verificato assente sui cedolini RFI). Se un giorno si faranno i macchinisti,
> sarà un profilo a sé. Cfr. [`avvocato-decisioni.md`](avvocato-decisioni.md).

---

## Clean Service SRL (CCNL Multiservizi)

Validato il 2026-05-28 su 14 buste di un lavoratore (Cianci, 2013–2019).

### NON vanno in "codes" (sono base / tredicesima / ferie)

- `6001` RETRIBUZIONE ORDINARIA → base (la quantità "26" è il divisore mensile, vedi CCNL)
- `313` 13MA TRANS RIMB ACCORDO → quota tredicesima
- `8101` FERIE GODUTE → in `daysVacation` (colonna ORE/GIORNI ambigua: se > 7 sono ore, ÷ 8)
- `8301` ASSEGNI FAM. NUCLEO ARRETR. → in `arretrati`

### Vanno in "codes" (dalla colonna Competenze)

| Codice | Descrizione |
|---|---|
| `315` | IND. TRASFERTA |
| `316` | GIORNI FESTIVITÀ |
| `380` | IND. MENSILE PROFESSIONALITÀ |
| `8001` | ASSEGN. FAM. NUCLEO (TOT.) — *sul cedolino stampato è il codice 8300* |
| `8005` | FESTIVITÀ NON GODUTA |
| `8007` | LAVORO STRAORDINARIO |
| `8019` | IND. LAV. NOTTURNO / MAGG. LAV. FESTIVO 35% — ⚠️ stesso codice per più sottocasi: **sommarli** |
| `8029` | IND. LAV. DOMEN. > 2 h |
| `8037` | IND. NOTTURNO / IND. RIPOSO ASS. |
| `8038` | CREDITO DA M/CA SCALATO/ASSORTO |
| `8053` | BIN MENSILE INPS |
| `8057` | IND. PRESTAZIONE / PRECUSTODIA |
| `8191` | QUOTA TFR MESE INPS |
| `8258` | CREDITO DI 66/14 EROGATO (bonus Renzi/€80 — **non** è un arretrato) |
| `8350` | IND. MALATTIA C/INPS |
| `9117` | RATA ADDIZ. REGIONALE A.P. |
| `9119` | RATA ADD. COMUNALE A.P. |
| `7173` | ACCONTO ADD. COMUNALE A.P. |

**Range tipici (sanity check):** ANF (8001) 86,35 (dal 07/2014) o 193,33 (fino 06/2014);
9117 ~3,93/mese; 9119 ~3,93/mese; TFR mensile Dic 15000–25000 (cumulativo anno); bonus Renzi
(8258) 0–292.

### Fisse — Quadro B, NON generano credito (servono per le %), 4 voci

Mappate il 2026-06-12 sulle buste reali di Cianci (2014, 2019, 2021, 2023). Il cedolino le
stampa in **due layout**:

| Chiave app | Voce | Layout nuovo (dal 2021 ca.) | Layout vecchio (≤ 2019/2020) |
|---|---|---|---|
| `MC01` | Minimo | riga `MC01 MINIMO` in testa alla tabella voci | banda di testata, etichetta "MINIMO", riga **ATT.** |
| `MC06` | Sal. Prof. | riga `MC06 SAL. PROF.` | etichetta "SAL. PROF." |
| `MC07` | Scatti Anz. | riga `MC07 SCATTI ANZ` | etichetta "SCATTI ANZ" |
| `MC10` | Ad Personam | riga `MC10 AD PERS.` | etichetta "AD PERS." |

- Totale di controllo: `MCT TOTALE RETRIBUZIONE` (layout nuovo) = "RETRIBUZIONE DI FATTO"
  in testata (layout vecchio) = MC01+MC06+MC07+MC10. **Non** va in `codes`.
- Nel layout vecchio usare la riga **ATT.** (attuale), mai la riga PREC.
- Esempio Cianci 05/2023: 1.670,92 + 22,00 + 146,04 + 25,63 = 1.864,59.

> ⚠️ Nota osservata sulle buste reali (2014 e 2023): la retribuzione ordinaria è stampata col
> codice **8001** (non 6001 come dice il prompt) e l'ANF col codice **8300** (l'app la chiama
> 8001). Il set variabile funziona via descrizioni, ma il mapping interno ha questi alias
> storici: NON "correggerli" senza rivalidare le 14 buste.

---

## Mercitalia Shunting & Terminal (layout ADP)

Lavoratore di riferimento: Gagliano (buste 2019–2025, PDF). Le **variabili** sono le 12 voci
di `INDENNITA_MERCITALIA` (types.ts): 1801/1802/1811/1819/1879/2331 (presenza),
2013/2023/2033/2073 (straordinari), 2263/2293 (festività) — importi dalla colonna
**Competenze** (6ª).

### Fisse — Quadro B, NON generano credito (servono per le %), 3 voci

Mappate il 2026-06-12 sulle buste reali di Gagliano (2019, 2021, 2024). Sono le righe in
**testa** alla tabella voci e l'importo si legge nella colonna **"Valori"** (3ª), NON in
Competenze:

| Codice | Descrizione | Note |
|---|---|---|
| `1000` | RETRIBUZIONE BASE | sempre presente |
| `1001` | SALARIO PROFESS. | sempre presente |
| `1025` | SCATTI ANZIANITA' | assente per i neoassunti senza scatti (Gagliano 2019) |

- Totale di controllo: riga `1100 TOT.RETRIBUZIONE` = 1000+1001+1025. **Non** va in `codes`.
- La riga `1213 RETRIBUZ.ORDINARIA` (Competenze) è la stessa base erogata a giorni
  (26 × tariffa = 1100): non è una voce fissa né variabile.
- Esempio Gagliano 05/2021: 1.630,30 + 107,73 + 25,22 = 1.763,25.

---

## Elior Ristorazione (magazzino e viaggiante)

Le variabili stanno in `INDENNITA_ELIOR` (viaggiante) / `INDENNITA_ELIOR_MAGAZZINO` (magazzino)
in types.ts. Il sotto-profilo si distingue con `eliorType` ('magazzino' | 'viaggiante').

### Fisse — Quadro B, NON generano credito (servono per le %), 1 voce

Mappate il 2026-06-14 sulle buste magazzino reali (Ghiro, Mastropasqua 2017-2025). La base
fissa ricorrente del mese è **una sola voce**:

| Codice | Descrizione | Note |
|---|---|---|
| `1000` | RETRIBUZIONE/STIPENDIO | prima riga della tabella voci, colonna **Competenze** |

- La voce `1000` **è già la somma** di quanto sta nel riquadro di testata: `Paga Base` +
  `Scatti Imp.Rivalut.` + `Salario Professionale` + `Ad Pers. non assor.`. Per le % basta
  leggere il solo `1000` (un numero, robusto), non i 4 componenti.
- ⚠️ NON usare `TOTALE RETRIBUZIONE`/`TOTALE COMPETENZE` (è il totale di tutte le competenze
  del mese, non la sola base fissa). ⚠️ NON confondere col `4285`/`5655 26/MI RETRIBUZIONE`
  (quota giornaliera variabile).
- Verifica: Mastropasqua 11/2017 → 1.577,51 + 73,02 + 22,00 + 34,66 = **1.707,19** = voce 1000.
- Stessa voce `1000` per entrambi i sotto-profili → `getFixedColumnsByProfile('ELIOR')` non
  ha bisogno di distinguere magazzino/viaggiante.

---

## Note OCR (valide trasversalmente)

- **Coda lunga troncata (Gemini):** sui cedolini con molte righe il modello "molla" le ultime
  voci e le salva a 0, con `aiWarning` = "Nessuna anomalia" (falso negativo). Voci tipicamente
  perse: `7173`, `9117`, `9119`, nei casi peggiori `8191` (TFR). **Verificare sempre la coda**
  del cedolino contro la foto. Indizio: se 9117/9119 sono 0 ma in altri mesi ~3,93, sono persi.
- **Bias scambio codici:** `8019` ↔ `8037` ↔ `8053` si scambiano valori su foto marginali.
  Unica vera soluzione: foto ad alta qualità / contrasto.
- **Ambiguità → segnalare, non indovinare** (memory `ocr-ambiguity-flag-policy`).
- **Lettura PDF scansionati** (senza pdftotext): `qlmanage -t -s 3508 file.pdf -o /tmp` → PNG,
  poi leggere l'immagine.
