# Feature (bozza) — Vertenza "indennità assenza residenza" Elior

> Per le **prossime sessioni**. NON implementare ora: questo è il disegno per avere le idee chiare.
> Dominio/diritto: `knowledge/indennita-assenza-residenza-elior.md`. Fonte: ricorso ex art. 414 c.p.c. (Celentano).

## Obiettivo
Nuova lavorazione: calcolare le **differenze retributive sull'indennità di assenza dalla residenza** per i
lavoratori **Elior viaggiante** (periodo nov 2017 – lug 2023), generare **prospetto analitico + relazione**,
pronta da allegare al ricorso.

## Perché è fattibile con poco (la buona notizia)
- I dati **ci sono già**: voci **`4300`** (No RS) e **`4305`** (RS) sono colonne estratte sull'archivio Elior viaggiante.
- Calcolo **deterministico e semplice**: delta di tariffa × importo già pagato (nessun OCR nuovo).
- Molto **riusabile**: archivio + struttura per-anno + rivalutazione ISTAT/interessi + generatori relazione/Excel.

## Calcolo (nucleo)
Per ogni mese nel periodo [nov 2017 → lug 2023]:
- differenza = `4300 × 0,7333` + `4305 × 1,20`  (= ore×0,55 + ore×1,20, con ore = importo/tariffa pagata)
- somma per anno; + rivalutazione ISTAT FOI + interessi legali "tempo per tempo".

## Cosa serve di nuovo
1. **Modulo "vertenza voce"** parametrico: tariffe (pagata/dovuta per 4300 e 4305), periodo, prescrizione.
2. **Relazione .docx**: la narrazione giuridica è **già scritta nel ricorso** → template riusabile
   (CCNL 2012/2016 art. 77, Corte App. Roma 92/2026, Cassazioni, no-ultrattività).
3. **Prospetto analitico differenze** (per mese/anno) + **Excel** allegabile.
4. **Selezione lavoratori**: solo Elior **viaggiante**; gestione prescrizione + periodo per-lavoratore.

## Riuso da RailFlow (mappa)
- Archivio/estrazione Elior: già presente (`4300/4305` in `INDENNITA_ELIOR`, `types.ts`).
- Rivalutazione ISTAT FOI + interessi: già presente (`istatService` / dashboard ISTAT).
- Generatori relazione/Excel/stampa: pattern dei riposi (`utils/riposi*`) e delle ferie riusabili.
- Collocazione possibile: nuova area "Vertenze" o nuovo sotto-tipo nella scheda lavoratore.

## Open questions (da chiudere prima/durante)
- Confermare su busta reale che `4300/4305 ÷ ore = 0,75 / 1,00` nel periodo (misura ridotta effettiva).
- **Prescrizione** quinquennale: date di interruzione (comunicazioni OO.SS. 12/02/2018, 19/04/2023) e cutoff per data deposito.
- Periodo per-lavoratore (assunzione/cessazione; chi è entrato dopo nov 2017).
- Quanti lavoratori Elior viaggiante in archivio sono coinvolti? (stima volume → vale un modulo o è un caso isolato?)
- Scope con l'avvocato: un lavoratore **pilota** vs batch.

## Primo passo concreto (prossima sessione)
1. Aprire 1-2 buste Elior viaggiante reali (es. un mese 2018 e uno 2022) → leggere `4300/4305` e confermare le tariffe pagate.
2. Stimare a mano (Excel) il credito di **un lavoratore pilota** → validare il metodo PRIMA di scrivere codice.
3. Decidere con l'avvocato se procede come lavorazione di prodotto.
