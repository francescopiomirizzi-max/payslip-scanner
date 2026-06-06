# Decisioni con avvocato e sindacalista

Decisioni **chiuse** (non ri-chiedere) e **aperte** su voci, codici e metodo. Le query inviate e
il dettaglio storico sono in memory (`mail-avvocato-quesiti-rfi`).

- **Avvocato:** Guido Celentano. **Sindacalista:** Vincenzo.
- **Principio guida** (memory `feedback-ancora-agli-artefatti-reali`): ancorarsi a ciò che loro
  vedono davvero — buste paga, Excel dell'avvocato (Quadri A/B/C), UI del sito — non a
  raggruppamenti/etichette inventati.

## Divisione del lavoro (ruoli)

- **Noi (utente)** prepariamo le pratiche: dati corretti e completi (backfill voci fisse, variabili,
  giorni) **+ le percentuali di incidenza**.
- **L'avvocato (Celentano)** riceve la pratica e fa **le sue valutazioni**: decide se **vale la pena
  depositare il ricorso** o meno, e come impostare la difesa.
- **Le % di incidenza sono nate proprio per questo** (l'avvocato ci ha insistito molto): sono il
  materiale su cui lui fonda la sua valutazione di opportunità/forza del caso in giudizio.

➜ **Implicazione su come presento i referti di verifica:** finding tipo "% sotto soglia 20%",
"anni a variabili basse", "profilo Quadro con incidenza bassa" vanno dati come **input neutri per
la valutazione dell'avvocato**, NON come "problemi da correggere" o blocchi alla pratica. Il nostro
compito è che i numeri siano giusti; la convenienza legale la decide lui.

## Punto di partenza: l'Excel di Palladino

L'avvocato ha fornito "CONTEGGI - PALLADINO CIRO SALVATORE.xlsx". È un **macchinista
Trenitalia/PDM**, non un caso RFI: serve come **esempio di STRUTTURA** (tabelle/prospetti,
metodo a Quadri, % di incidenza), **non** come lista di codici. In RFI non ci sono macchinisti e
le voci sono diverse. Da qui la richiesta di portare lo stesso impianto (le %) anche su RFI.

## Decisioni CHIUSE (non ri-chiedere)

- **Set voci variabili (credito)** = esattamente le 17 del sito:
  `0152,0421,0423,0457,0470,0482,0496,0576,0584,0687,0919,0920,0932,0933,0995,0996,0AA1` +
  Ticket/Buoni Pasto. **Confermato dall'avvocato.**
- **`0496`** confermato (non esiste `0490`: era un mio errore di lettura su foto ruotata).
- **`0457`** Festivo Notturno: **incluso** (lo vuole l'avvocato).
- **`0AA1`** sì, **`0AA2`** no. **`0687`** sì, **`0686`/`0376`** no.
- **`3B70`/`3B71`** Salario Produttività: **nelle fisse** (Quadro B), fuori dal credito (Vincenzo
  conferma).
- **`3B50`** Ind. Utilizzazione Professionale: **fuori** (né variabile né fissa, non reclamata —
  non è nell'elenco del ricorso; varia mese su mese).
- **Tetto 28 gg** ferie: come fa il sito (segue il ricorso nuovo + Cass. 20216/2022, non l'Excel
  vecchio che usa ferie grezze).
- **Ticket/buoni pasto**: giornaliero × giorni di ferie.
- **Media = anno precedente** (Metodo A); **÷12 anche negli anni parziali** (solo argomentativo).
- **Strategia B** solo per i 2 Cataneo (distaccati). Vedi [`strategia-a-vs-b.md`](strategia-a-vs-b.md).
- **Dettagli PDM** (`÷12÷26` parte fissa, detrazione voce `0792`): **non** si applicano a RFI.
- **Base giuridica** = artt. **30 (Ferie)** + **83 (Indennità diverse)** CCNL Mobilità/AF +
  Contratti Aziendali FS (non l'art. 64).

## Decisioni APERTE / da confermare

- **D'Errico = Strategia A** (raccomandato: il ricorso depositato dice "effettive giornate
  lavorative" → mettere B creerebbe una contraddizione interna e gli toglierebbe ~€589). Da
  confermare con l'avvocato, poi rigenerare i suoi 3 documenti col toggle "Permessi" OFF.
- **`3B50` nel denominatore delle %?** — escluso dal credito è corretto; resta il dubbio
  secondario se vada almeno nel denominatore dell'incidenza. Da decidere.
- **Reperibilità "da remoto €6"** (novità CCNL 2025): possibile **codice voce nuovo** sui cedolini
  2025/2026 oggi non letto → da verificare e, se serve, aggiungere.

## Aspetto economico (contesto)

Le pratiche già concluse e pagate (18) hanno un **supplemento €450** per l'aggiunta delle % →
il **deploy** va fatto solo dopo essersi fatti pagare il supplemento. Le pratiche nuove/non
concluse includono già la % nel prezzo (€50). I conteggi saranno verificati da un **consulente
del Tribunale** → tracciabilità essenziale (tabelle di dettaglio già in PDF).
