# Analisi documenti Vincenzo — metodologia mancati riposi (Viterbo) — 2026-06-30

> 2 .docx trovati dall'utente in `~/Downloads`, dati da Vincenzo "molto tempo fa":
> - `Nota_metodologica_parametri_calcolo_mancati_riposi.docx`
> - `Relazione_tecnica_mancati_riposi_riformulata.docx`
>
> Sono la **metodologia del perito di Vincenzo** per i mancati riposi (Reg. CE 561/2006).
> Aggiornamento doc: 02/02/2026. Testo estratto con `textutil` (txt in scratchpad).
>
> ⚠️ Sono **template/metodologia generale** (esempi: "Clarino Francesco", "Ferrovie del Sud Est"),
> NON Viterbo-specifici — MA il periodo dell'Appendice A (01/01/2011 → 30/09/2024) **coincide
> esatto con Viterbo Tommaso** → la tabella tariffe è verosimilmente quella di Viterbo (da confermare).

## 1. Metodologia estratta (l'essenziale)

### Basi giuridiche
- Reg. (CE) 561/2006; L. 138/1958; D.Lgs. 66/2003.
- CCNL Autoferrotranvieri: **1976** (artt. 6/15/16/17), **1980** (art. 11), **1982** (raddoppio
  maggiorazioni notturne dal 1984), **1997** (art. 14 — riposo periodico).
- **Art. 14 CCNL 1997 = perno giuridico**: chi lavora di domenica e riposa in altro giorno → il
  giorno di riposo è "festivo a tutti gli effetti" → **ogni prestazione nel giorno di riposo = lavoro festivo**.

### Retribuzione e divisore
- Retribuzione normale = tabellare/minimo + contingenza + scatti + mensa + TDR + assegni ad personam.
- **Divisore 195** (39h/sett. su 6 gg = 6,5 h/gg; 6,5 × 30 = 195) → retribuzione oraria = normale / 195.

### Maggiorazioni (cumulabili, sommate non composte)
| Tipologia | Magg. | Coeff. |
|---|---|---|
| Straordinario | +10% | 1,10 |
| Festivo | +20% | 1,20 |
| Notturno (viaggiante, 22:00–05:00) | +20% | 1,20 |

Combinazioni: straord. notturno 130%, straord. festivo 130%, straord. festivo notturno 150%.

### ⭐ Valorizzazione del mancato riposo (il punto chiave)
- Criterio del perito (cautelativo): **ogni ora di mancato riposo = ora festiva = 120%** della
  retribuzione oraria normale (base giuridica = art. 14 CCNL 1997).
- È un **minimo prudenziale**: NON include la maggiorazione notturna, NON include l'integrazione
  del **50%** sulle ore non lavorate quando il servizio nel giorno di riposo è < orario giornaliero.
- NB: l'Excel di base replica però il **PDF sorgente** = ore × "paga oraria straordinario" (×1,0);
  il 120% è gestito come scenario opzionale (coefficiente nel foglio Parametri).

### ⭐ Tariffa oraria per periodo (Nota, Appendice A) — la "tabella" che aspettavamo
"Paga oraria straordinario" dal prospetto PDF, con date precise:

| Dal | Al | €/h |
|---|---|---|
| 01/01/2011 | 31/08/2012 | 9,20 |
| 01/09/2012 | 31/08/2013 | 9,34 |
| 01/09/2013 | 30/09/2013 | 9,48 |
| 01/10/2013 | 31/08/2015 | 9,60 |
| 01/09/2015 | 31/12/2015 | 9,74 |
| 01/01/2016 | 30/06/2016 | 9,92 |
| 01/07/2016 | 31/08/2017 | 10,11 |
| 01/09/2017 | 30/09/2017 | 10,25 |
| 01/10/2017 | 31/08/2019 | 11,18 |
| 01/09/2019 | 31/08/2021 | 11,34 |
| 01/09/2021 | 30/06/2022 | 11,50 |
| 01/07/2022 | 31/05/2023 | 11,68 |
| 01/06/2023 | 31/08/2023 | 11,86 |
| 01/09/2023 | 30/09/2024 | 12,04 |

### Rivalutazione + interessi
- Rivalutazione **ISTAT FOI** (generale) + interessi legali "tempo per tempo" (decreti ministeriali).
  → **È esattamente quello che la nostra app già fa** (tab/dashboard ISTAT + interessi). Conferma il metodo.

## 2. Confronto con la NOSTRA sezione Riposi — dove migliorare

Il motore (`hooks/usePraticheRiposi.ts`) ha **già i ganci giusti**, lasciati come follow-up:
- `tariffePerAnno?: Record<'YYYY', €/h>` — override per anno; se assente i consumatori derivano da
  `deriveTariffePerAnno`. Colonna DB `tariffe_per_anno` già prevista. TODO nel codice: *"editor quando
  arriva la **tabella CCNL**"*. → **La tabella è arrivata (Appendice A).**
- `coefficiente?: number` — danno sul valore (default 1 pieno; metodo avvocato 20% → 0.20). Colonna DB `coefficiente`.

### Discrepanza 1 — Tariffa: ❌ NESSUNA (verificato sui CSV sorgente il 30/06)
**La nostra tariffa è già CORRETTA, non va toccata.** Il CSV `viterbo_riepilogo_annuale.csv` ha la
colonna `tariffa_oraria_mediana_eur` = **10,04 (2011) → 13,13 (2024)**, che è ESATTAMENTE la nostra
curva. La nostra `deriveTariffePerAnno` (Σ indennità fonte / Σ ore) ricostruisce la **tariffa effettiva
del PDF** (= € indennità per ora realmente pagata). L'Appendice A (9,20→12,04) è la **"paga oraria base"**,
un parametro intermedio più basso (l'effettiva ≈ base × ~1,1): NON è il valore che genera l'indennità.
→ Niente sostituzione. (Eventuale: mostrare la paga base come dato di trasparenza, opzionale.)

### Discrepanza 2 — Coefficiente: noi 20% (danno), il doc 120% (festivo)
- App: `coefficiente` 0.20 → "danno = 20% del valore", **confermato dall'avvocato** (memoria `viterbo-marcatore-cee-e-tariffa`).
- Doc: **120%** (festivo, art. 14 1997) come cautelativa, con possibili extra (notturno, 50%).
- Sono **due teorie diverse**: "danno da usura 20%" vs "retribuzione festiva piena 120%". La seconda
  vale ~6× la prima. **NON cambiare unilateralmente** — è scelta dell'avvocato (noi prepariamo, lui decide).
- Il campo `coefficiente` esiste già → si può rendere **selezionabile** (0.20 ↔ 1.20) e affiancare le serie.
  La tab "Confronto PDF↔noi" già confronta 2 serie; si può aggiungere la **3ª "festivo 120%"**.

### Discrepanza 3 — Componenti non modellate (opzionali, prudenziali)
- Maggiorazione **notturna** (fascia 22:00–05:00, +20%).
- **Integrazione 50%** sulle ore non lavorate quando il servizio nel giorno di riposo è < orario giornaliero.
- Il doc le segnala come "non applicate per scelta cautelativa" → candidabili come **toggle** nel motore.

### Discrepanza 4 — Relazione .docx più forte
- `utils/riposiRelazione.ts` può citare con precisione: CCNL artt. 6/15/1976, art. 11/1980, art. 14/1997,
  divisore 195, composizione della retribuzione normale, schema maggiorazioni. Alza la qualità giuridica.

## 3. Raccomandazioni (priorità) — RIVISTE dopo la verifica sui CSV
Il **motore di calcolo è già corretto** (tariffa = effettiva del PDF; coefficiente = scelta avvocato già
confermata; le due serie già a confronto). Quindi NON si tocca il calcolo. Il valore dei doc è la **rigore
giuridico della Relazione** + un po' di trasparenza in-app.
- **P1 (la missione) — Relazione arricchita**: aggiungere a `riposiRelazione.ts` la **base contrattuale
  della valorizzazione** (catena CCNL 1976/1980/1982/1997, **art. 14/1997 = riposo periodico è festivo**,
  divisore 195, composizione retribuzione normale, schema maggiorazioni, esclusioni prudenziali notturno/50%).
  Integrato in modo coerente col nostro impianto: il "valore pieno" (serie fonte) = valorizzazione festiva del
  perito; la serie B applica su quello il coefficiente di danno (criterio del legale). Solo testo, zero calcolo.
- **P2 (minore) — Banner/etichette in-app**: nel banner metodologico e nelle etichette serie citare la base
  (561/2006 + valorizzazione CCNL festiva) con più precisione.
- **P3 (opzionale, gated avvocato)** — coefficiente selezionabile in UI (0.20 ↔ 1.0) sfruttando il campo
  `coefficiente` già esistente; la 3ª serie "festivo pieno" di fatto è già la serie fonte.
- **Scartato**: sostituzione tariffa (ns. già corretta); extra notturno/50% (il perito stesso NON li applica → prudenziale).

## 4. Caveat
- I doc sono **template** (esempi Clarino/Ferrovie Sud Est), non Viterbo-specifici → confermare che la
  tabella Appendice A sia quella di Viterbo (il periodo coincide; verificare col PDF sorgente `15__conteggi.pdf`).
- Il **coefficiente è decisione dell'avvocato**: memoria = ×20% confermato; i doc argomentano 120%. Input neutro.
- Distinguere **"paga oraria straordinario"** (Appendice A) vs **"retribuzione oraria normale"** (normale/195)
  prima di sostituire la tariffa: il 120% si applica alla seconda, il PDF usa la prima.
- Valutare se distillare questa metodologia in `knowledge/` (dominio durevole) oltre che qui.

## Fonti
- `~/Downloads/Nota_metodologica_parametri_calcolo_mancati_riposi.docx`
- `~/Downloads/Relazione_tecnica_mancati_riposi_riformulata.docx`
