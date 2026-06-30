# Metodologia — Mancati riposi (Reg. CE 561/2006)

Come si conteggiano e valorizzano i **mancati riposi** (giornalieri e settimanali) del personale
viaggiante / conducenti di linea TPL. Dominio **distinto** da ferie/differenze retributive: altra
normativa (Reg. CE 561/2006 + CCNL Autoferrotranvieri), altro motore (`utils/restEngine.ts`),
altra area dell'app («Turni & Riposi»).

Fonte primaria: documenti del **perito di Vincenzo** (caso Viterbo, TPL) in
`~/Desktop/Pratiche_differenze_ retributive_ indennità/mancati riposi/` — Nota metodologica + Relazione
tecnica + Excel + CSV. Analisi di dettaglio: `tasks/analisi-doc-vincenzo-riposi-2026-06-30.md`.

---

## 1. Quadro normativo

### Limiti di legge (cosa è violazione)
- **Reg. (CE) n. 561/2006** (attuato dal **D.Lgs. 234/2007**), + **L. 138/1958**, **D.Lgs. 66/2003**.
- **Riposo giornaliero**: almeno **11 h** consecutive nelle 24 h; riducibile a **9 h** max **3 volte** tra
  due riposi settimanali (oltre = violazione).
- **Riposo settimanale**: almeno **45 h**; riducibile a **24 h** solo in **alternanza** con uno regolare
  (mai due ridotti consecutivi).
- **Gravità**: riduzione > 10% della soglia = «grave» (criteri Reg. UE 2016/403) — è classificazione, non
  il presupposto dell'illecito.

### Base contrattuale (per la quantificazione economica)
CCNL **Autoferrotranvieri** e successive integrazioni:
- **23/07/1976** — art. 6 (retribuzione normale), art. 15 (retribuzione oraria).
- **12/03/1980** — art. 11 (lavoro straordinario, festivo, notturno).
- **12/06/1982** — raddoppio maggiorazioni notturne dal 1984.
- **25/07/1997** — **art. 14**: per chi lavora di domenica e riposa in altro giorno, il giorno fissato per
  il riposo periodico è **festivo a tutti gli effetti** → ogni prestazione resa in quel giorno = **lavoro festivo**.

## 2. Valorizzazione del riposo perso (criterio del perito)

- **Principio**: ogni ora di mancato riposo è valorizzata in analogia all'**ora festiva (120%)** della
  retribuzione oraria normale (base giuridica = art. 14 CCNL 1997). Impostazione **cautelativa/prudenziale**.
- **Retribuzione oraria** = «retribuzione normale» ÷ **divisore 195**.
  - Retribuzione normale = tabellare/minimo + contingenza + scatti + mensa + T.D.R. + assegni ad personam.
  - Divisore 195 = 39 h settimanali su 6 giorni = 6,5 h/giorno × 30.
- **Maggiorazioni** (cumulabili, *sommate* non composte): straordinario **+10%** (1,10), festivo **+20%**
  (1,20), notturno **+20%** (1,20). Combinazioni: straord. festivo o notturno **130%**, straord. festivo
  notturno **150%**.
- **Esclusioni prudenziali** (→ "importi minimi"): NON si applicano né la maggiorazione **notturna**
  (22:00–05:00) né l'**integrazione del 50%** prevista per il servizio reso nel giorno di riposo in misura
  inferiore all'orario giornaliero. Restano salve per il Giudicante.
- **Rivalutazione + interessi**: rivalutazione **ISTAT FOI** (generale) + interessi legali "tempo per tempo"
  (decreti ministeriali). RailFlow lo fa già.

## 3. Come RailFlow implementa il calcolo (`utils/restEngine.ts`)

### Tariffa €/h per anno — VERIFICATO (30/06/2026)
- Il motore usa una **tariffa effettiva per anno**, ricavata dal PDF sorgente come
  **Σ indennità fonte ÷ Σ ore mancanti** (`deriveTariffePerAnno`). Cresce per anzianità di servizio.
  Per il caso Viterbo: **≈ 10,04 (2011) → 13,13 (2024)** (= colonna `tariffa_oraria_mediana_eur` dei CSV).
- ⚠️ **Non confondere** con la **"paga oraria base"** della Nota (Appendice A: 9,20 → 12,04): è un parametro
  intermedio più basso (l'effettiva ≈ base × ~1,1, perché incorpora la valorizzazione). Per l'indennità si
  usa la tariffa **effettiva**, non la paga base. → la tariffa del motore è **corretta, non va sostituita**.

### Coefficiente danno — due teorie
- **Valore pieno (100%)**: ore × tariffa effettiva = valore intero del riposo perso.
- **Danno (20%)**: coefficiente **0,20** sul valore pieno (danno equitativo ancorato al CCNL).
  **Criterio scelto e CONFERMATO dall'avvocato** per Viterbo (vedi [`avvocato-decisioni.md`](avvocato-decisioni.md)).
- In app: campo `coefficiente` per pratica + **selettore UI** in `RiposiPraticaDetail` (Valore pieno 100% ↔
  Danno 20%). Default e motore **invariati**; la scelta resta del legale.

### Due serie a confronto (mai sommate)
- **Serie FONTE (PDF)**: *tutte* le ore di mancato riposo × tariffa effettiva, coi criteri del perito.
  Per Viterbo ≈ **€ 98.732**.
- **Serie B (motore Reg. 561/2006)**: solo le ore che **violano** le soglie CEE (perimetro CEE) × tariffa ×
  coefficiente. Per Viterbo ≈ **€ 2.324** (×20%).
- Si **affiancano** come confronto neutro per l'avvocato; non si sommano.

## 4. Note
- Pausa di guida art. 7 (cronotachigrafo): fuori perimetro (dati non nel prospetto turni).
- I documenti del perito sono **template** (esempi "Clarino Francesco" / Ferrovie Sud Est), ma la tabella
  paga e il periodo (2011–2024) coincidono col caso Viterbo.
- Vademecum FAST Turni/Riposi (561/2006 + D.Lgs. 234/2007) tra le fonti sul Desktop.

Collegati: [`ccnl-e-normativa.md`](ccnl-e-normativa.md) · [`avvocato-decisioni.md`](avvocato-decisioni.md) · [`glossario.md`](glossario.md)
