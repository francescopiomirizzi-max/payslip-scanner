# CCNL e base normativa

Fondamento contrattuale e giuridico delle voci che il sito conteggia, per profilo azienda.
Le decisioni "chiuse" con avvocato/sindacalista sono in [`avvocato-decisioni.md`](avvocato-decisioni.md).

---

## CCNL Mobilità / Area contrattuale Attività Ferroviarie (RFI + Trenitalia)

- **Contratto:** CCNL Mobilità/Area AF del **22 maggio 2025**, triennale, scadenza **31/12/2026**.
- **Fonte:** sindacatoorsa.it (CCNL Mobilità AF 22.5.2025).
- Si applica sia a **RFI** (infrastruttura) sia a **Trenitalia**.

### Articoli rilevanti per le ferie

- **Art. 30 — Ferie.**
- **Art. 83 — Indennità diverse.**
- ➜ Sono la base giuridica corretta del ricorso. **NON è l'art. 64** (errore corretto il
  2026-06-03: nei documenti era citato l'art. 64, sostituito con artt. 30 + 83).
- **Contratti Aziendali FS 2003 / 2012 / 2016 / 2022** — citati nel ricorso a supporto.

### Art. 79 — Reperibilità e disponibilità

Fondamento delle indennità di reperibilità (info dal sindacalista, 2026-06). Importi → codici:

| Importo | Causale | Codice |
|---|---|---|
| €14,00 / giornata lavorativa in reperibilità | Compenso reperibilità | **0482** |
| €32,00 / giornata di riposo in reperibilità | Rep. festive/riposo | **0584** |
| €58,00 / festività maggiori (1 gen, Pasqua, 15 ago, 25 dic) | (rientra in 0584) | **0584** |
| €20,00 / chiamata reperibilità **fisica** (solo se c'è spostamento) | Ind. chiamata | **0470** |
| €6,00 / chiamata reperibilità **da remoto** (prima chiamata, comprende le successive del turno) | Chiamata in disponibilità | **0496** |

Verificato su buste reali: Maio `0470 = 20,00`; Di Ponte `0584 = 128 = 4×32`. Quadra.

**Regole utili** (citabili dall'avvocato come prova che le indennità sono previste, ricorrenti
e legate alla mansione → vanno nella retribuzione feriale):
- turni esposti ≥ 15 gg prima; durata ≥ trimestrale;
- impegno ≤ 7 gg / 4 settimane (max 10 con accordo aziendale);
- intervento retribuito come straordinario o recupero;
- durante orario ordinario / pausa refezione / intervallo orario spezzato **non** è
  reperibilità ma straordinario.

⚠️ La **"reperibilità da remoto €6" è una novità del CCNL 2025** → possibile codice voce nuovo
sui cedolini 2025/2026 che oggi potremmo non leggere: **da verificare** sulle buste recenti.

### Il "divisore 26"

Il "26" del CCNL è il **divisore convenzionale della retribuzione GIORNALIERA** (parte FISSA:
mensile ÷ 26; 26 = anche i gg di ferie per parametro ≥ 202). **Riguarda solo la parte fissa**,
che si annulla nel calcolo del credito → **NON è il divisore delle voci variabili**.

Per le variabili (il credito) il **ricorso** dice di usare le **"effettive giornate lavorative"**
lette dalle buste (= Strategia A). Quindi **non** vale la regola "divisore = 26 − ferie" per RFI
(ipotesi del sindacalista Vincenzo verificata e scartata sui dati reali — la somma
`lavorati+assenze+ferie` sta tipicamente a ~14-24/mese, non 26, per via dei riposi; 26 è il
**tetto** di un mese pieno, non un valore ricorrente). Cfr. memory `analisi-divisore-26-rfi`.

### Giurisprudenza

- **Cass. 23/6/2022 n. 20216** — fonte del **tetto 28 giorni** di ferie conteggiabili.
  (Nota a mano sul ricorso: "effett. 32 / calcolat. 28 ✓".)

---

## CCNL Multiservizi (Clean Service SRL)

CCNL "**a divisore mensile**". La quantità **"26"** della voce RETRIBUZIONE ORDINARIA (cod.
`6001`) **non** è "giorni lavorati" ma **"giorni retribuiti del mese"** — include sia il lavoro
effettivo sia le ferie godute, pagate a tariffa ordinaria.

**Formula tassativa:** `daysWorked = GG_RETRIBUITI − daysVacation`.

Sanity check: `daysWorked + daysVacation ≤ 31`. (Verificato su Cianci Set 2014: senza la
sottrazione veniva 26 + 11,55 = 37,55 > 31, impossibile.) Cfr. memory
`feedback-divisore-mensile-meno-ferie`. Codici voce in [`codici-voce.md`](codici-voce.md).

---

## Elior (Ristorazione collettiva)

Anche qui CCNL "a divisore mensile": **"GIORNI INPS" (≈26) INCLUDE le ferie**. Va sottratto.
`daysWorked = GIORNI INPS − ferie`. Conversione ore→giorni con soglia (> 12).

## Mercitalia (ADP)

- Layout busta ADP a **7 colonne**: `Cod.Voce | Descrizione | Valori | Numero o base di calcolo
  | Compenso unitario o % | Competenze | Trattenute`.
- Gli **importi pagati** delle indennità si leggono dalla colonna **"Competenze"** (6ª), non da
  "Valori" (che ha solo retribuzione base/imponibili).
- `daysWorked = "GIORNI INPS" − ferie (cod. 3833)` (le ferie sono incluse nei GIORNI INPS).

> **Pattern generale** (cfr. lessons.md): per i CCNL "a presenze reali" (RFI, Trenitalia,
> Mercitalia) il valore Presenze/GG INPS è già al netto delle ferie → NO sottrazione. Per i CCNL
> "a divisore mensile" (Multiservizi, Ristorazione, Elior, Clean Service) → SÌ sottrazione.
