# Piano — Sezione "Indennità Ricostruite" (FSE / Clarino) — 20/07/2026

> Idea utente: una sezione del sito che CALCOLA le indennità che il perito ricostruisce a tariffa
> (documentate nella relazione §3) e le SPIEGA. «Se ci sono nella relazione, servono.»

## 1. Il vincolo chiave (da capire prima di costruire)

Le indennità ricostruite dal perito NON sono stampate sui cedolini: lui le ricostruisce applicando
una **tariffa** (relazione §3) a una **quantità base**. Il problema è la quantità base:

| Indennità ricostruita | Tariffa (relazione) | Quantità base | Calcolabile dai cedolini? |
|---|---|---|---|
| **Indennità Aziendale** | 3,50 €/g (acc. 22/07/2009) | giorni lavorati | ✅ **SÌ** (li abbiamo) — verificata 8/8 al centesimo |
| IndAggiun / Disponibilità | 1,76 € (acc. 09/06/1998) | giorni Art.5A (= importo 5A ÷ 0,52) | 🟡 forse (formula incerta, census §7) |
| Ind. Domenicale Aziendale | 9,19 €/domenica (2019) | domeniche lavorate | ❌ NO (non sul cedolino) |
| Ind. di Riserva | 18,00 € (2019) | giorni di riserva | ❌ NO |
| Guida a Pieno/Vuoto | 3,30/1,60 → 4,80 € (2019/2024) | servizi di guida | ❌ NO |
| Percorrenze | 0,0258 €/km (acc. 03/02/1990) | km percorsi | ❌ NO |

⇒ **Solo l'Indennità Aziendale è calcolabile in automatico** e verificata. Per le altre servono
quantità da **fonte esterna** (badge/dati aziendali) — è ESATTAMENTE il motivo per cui il perito le
"ricostruisce". Il gap tra noi (3.866) e il perito (6.341) è quasi tutto qui.

## 2. Impatto (nominale, l'app aggiunge ISTAT+interessi)

- Opzione B (solo stampate): **3.106 €** · + Ind. Aziendale ricostruita: **3.866 €** (+759,50).
- Le altre ricostruzioni: quantificabili solo con le quantità base (input o dal riepilogo perito).

## 3. Design proposto — sezione "Indennità Ricostruite" nella scheda lavoratore

Una scheda (tab o pannello) che, per OGNI indennità ricostruita, mostra una card:
- **Spiegazione**: cos'è, tariffa, accordo/fonte (data), regime TFR — dati da un config `RICOSTRUZIONI_FSE`
  (dalla relazione §3, così è documentato e citabile).
- **Base × tariffa = valore**:
  - Auto (Ind. Aziendale): base = giorni lavorati (già in griglia) → 3,50 × gg, per mese/anno.
  - Manuale (le altre): campo per la quantità base (km, domeniche…) OPPURE import del valore mensile
    dal riepilogo del perito; se vuoto → resta 0 e la card lo segnala ("richiede dato aziendale").
- **Toggle "includi nel credito"** per-indennità: se attivo, entra nel numeratore (coerente con
  Opzione B: il divisore resta i giorni lavorati). Additivo, reversibile.
- Un totale ricostruito + l'effetto sul credito (prima/dopo), come le card statistiche esistenti.

## 4. Aperto (da confermare prima di costruire)

- **A) Dove**: tab dedicato nella scheda lavoratore (come Riepilogo/Analisi Voci/TFR), o sezione dentro
  la Relazione (output legale), o entrambi (il tab alimenta la Relazione). *Consiglio: tab + confluisce
  in Relazione.*
- **B) Base dell'Ind. Aziendale**: **giorni lavorati** (servizio effettivo, coerente col nostro metodo —
  il perito usava la sua GG con ferie dentro; noi restiamo coerenti). *Consiglio: giorni lavorati.*
- **C) Le non-calcolabili**: input manuale della quantità, o import del valore del perito dal riepilogo?
  *Consiglio: entrambi (input + "usa valore perito" come scorciatoia), con nota di provenienza.*
- **D) Ambito**: solo FSE ora (le ricostruzioni sono specifiche di questi accordi).

## 4-bis. Decisione utente 20/07 — fidarsi delle ricostruzioni, MA segnalare il limite di documentazione

L'utente: «fidiamoci delle sue ricostruzioni, ma scriviamo che fino a un certo punto non sono più
documentate». Quindi la sezione (e la Relazione) DEVE:
- **includere** i valori ricostruiti del perito (importarli/accettarli come input),
- ma **marcare esplicitamente il perimetro documentato**: gli accordi aziendali citati (relazione §3)
  coprono fino a una certa data (es. Ind. Aziendale = acc. 22/07/2009; ultimi accordi 2019/2024). Dove la
  ricostruzione del perito si spinge OLTRE l'ultimo accordo/periodo documentato, va segnalato con una nota
  ("valore del perito, non più coperto da accordo documentato dopo AAAA") → è trasparenza per l'avvocato,
  non un giudizio. Ogni card mostra: tariffa · accordo/fonte · **fino a quando è documentata**.

## 5. Perché è corretto farla

Le ricostruzioni sono **fondate** (accordi aziendali citati nella relazione), non arbitrarie; l'Ind.
Aziendale è pure presence-linked (per giorno lavorato) → rientra nel principio del numeratore. Renderla
esplicita + spiegata è più difendibile che ometterla o che infilarla di nascosto in una colonna.
