# Metodologia di calcolo

Come il sito calcola il **credito ferie** e la **% di incidenza**. Validato cella-per-cella
contro l'Excel dell'avvocato (caso Palladino, anno 2008) e contro il ricorso depositato.

Termini in [`glossario.md`](glossario.md); codici in [`codici-voce.md`](codici-voce.md);
il divisore in [`strategia-a-vs-b.md`](strategia-a-vs-b.md).

---

## 1. Credito differenze ferie (gli EURO)

Per ogni anno a credito:

```
tariffa giornaliera variabile (anno) = Σ voci variabili anno / divisore
credito anno = (tariffa giorn. dell'ANNO PRECEDENTE × ferie fruite, max 28) − già percepito
```

- **Tariffa dell'anno PRECEDENTE.** Si usa la media dell'anno N-1, non dell'anno stesso. Nel
  codice: `avgApplied = yearlyAverages[year-1]`. Equivale alla regola del ricorso ("media degli
  ultimi 12 mesi **precedenti** la fruizione" = **Metodo A**) e alla cella K82 dell'Excel
  avvocato. ⚠️ Il "foglio 3" del ricorso diceva "stesso anno": è **impreciso**, non seguirlo.
- **Divisore.** Vedi [`strategia-a-vs-b.md`](strategia-a-vs-b.md) — di default = giornate
  effettive lavorative (Strategia A).
- **Tetto 28** giorni di ferie/anno (Cass. 20216/2022). Switch "32 ex-festività" **OFF**.
- **Già percepito** = valore reale letto dalla busta (`coeffPercepito`), non una detrazione fissa.
- **Ticket / buoni pasto**: tariffa giornaliera × giorni di ferie (a parte rispetto alle indennità).

> **Anno di riferimento pieno.** Poiché si usa N-1, `start_claim_year − 1` deve essere un anno
> con ~12 mesi reali (giorni > 0 e variabili > 0). Se è rado/vuoto (assunzione a fine anno) →
> spostare lo `start_claim_year` in avanti (es. Borriello 2020 → 2021). Vedi
> [`verifica-pratica.md`](verifica-pratica.md) e memory `feedback-anno-riferimento-completo`.

Mapping verificato con l'Excel Palladino: tariffa = `totVar/presenze` (≡ K72 `S54/S63`);
tariffa = anno precedente (≡ K82); credito = `ferieUtili × tariffaPrec` (≡ K83). Divergenze
**volute** vs Palladino: tetto 28 (lui usa ferie grezze), nessuna detrazione `0792` (è PDM),
`÷12÷26` della parte fissa si annulla algebricamente (ininfluente sul credito).

---

## 2. % di incidenza (l'ARGOMENTO per il giudice)

Quanto pesano le variabili sul totale retribuzione. **Additiva: NON cambia gli euro del credito.**
Costruita sui Quadri dell'avvocato:

- **Quadro B** = Σ voci **fisse** del mese.
- **Quadro C** = Σ voci **variabili** del mese.
- **Quadro A** = B + C (il denominatore; **non** il lordo busta).

```
% variabili (mese) = C × 100 / (B + C)
% fisse     (mese) = B × 100 / (B + C)            (le due sommano a 100)
% media annua       = Σ(% mensili) / 12           (si divide SEMPRE per 12, anche i mesi a 0)
% media periodo     = media delle medie annue     (es. "22,94% incidenza media 2008-2018")
```

- Nel codice: `quadroFisse / quadroVariabili / pctVariabile / pctFissa` (mese);
  `hasIncidence / sumQuadroFisse / pctVariabileMediaAnnua / pctFissaMediaAnnua` (anno);
  `computePeriodIncidence()`. Validato sui numeri reali Palladino 2008 (variabili 23,91% /
  fisse 76,09% / somma 100).
- **÷12 anche negli anni parziali**: voluto (identico all'Excel), è solo argomentativo.
- **Soglia 20%**: anni sotto il 20% sono più **attaccabili** in giudizio (evidenziati
  verde ≥20% / rosso <20% a schermo e in PDF). Es. D'Errico: 17/19 anni tra 23-41%, ma
  2014 = 19,4% e 2025 = 17,1%.

⚠️ **% oneste solo con base fissa reale.** Per i lavoratori backfillati solo in parte, gli anni
**senza** voci fisse mostrerebbero "100% variabili / base €0" (fuorviante) e gonfierebbero la
media periodo. Per questo le righe per-anno, la media periodo e l'anno-esempio della Relazione
filtrano `hasIncidence && sumQuadroFisse > 0`. ➜ Per % oneste su tutto il periodo, **backfillare
le voci fisse di ogni anno a credito**.

---

## 3. Dove compaiono i risultati

- **A schermo:** pannello "Incidenza %" in `AnnualCalculationTable` (tab Calcolo); toggle
  "Variabili ⇄ Fisse" in `MonthlyDataGrid` per verificare/correggere le voci fisse estratte.
- **Foglio Conteggi (PDF, `printTables.ts`):** tabella "Riepilogo Voci Fisse (Quadro B)" +
  "Incidenza %". Compaiono solo se `sumQuadroFisse > 0`.
- **Relazione legale (.docx, `RelazioneModal.tsx`):** sezione dedicata con metodo + esempio
  pratico sull'anno reale a credito + % media di periodo. Deve essere **.docx vero** (libreria
  `docx`), mai HTML travestito (memory `feedback-relazione-docx-vero`).
