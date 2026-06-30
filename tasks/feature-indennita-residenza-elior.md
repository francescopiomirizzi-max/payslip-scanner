# Feature (bozza) — Vertenza "indennità assenza residenza" Elior

> Per le **prossime sessioni**. NON implementare ora: questo è il disegno per avere le idee chiare.
> Dominio/diritto: `knowledge/indennita-assenza-residenza-elior.md`. Fonte: ricorso ex art. 414 c.p.c. (Celentano).

## Obiettivo
Nuova lavorazione: calcolare le **differenze retributive sull'indennità di assenza dalla residenza** per i
lavoratori **Elior viaggiante** (periodo nov 2017 – lug 2023), generare **prospetto analitico + relazione**,
pronta da allegare al ricorso.

## ⚠️ PREREQUISITO BLOCCANTE (dati viaggiante incompleti)
Verificato sul DB il 30/06: le buste Elior **viaggiante NON sono in archivio** (analizzate dal vecchio
gestionale, prima che l'archivio esistesse → solo in tabella `anni`); i codici `4300/4305` sono estratti in
**pochissimi mesi** (es. Boriglione 3/228); mancano le **voci fisse**. → **Prima** della vertenza serve:
**acquisire le buste viaggiante → caricarle in archivio → ri-scansionarle con tutte le voci** (nov2017–lug2023).
(Elior **magazzino** è completo — Ghiro/Mastropasqua, ~98 buste — ma non ha 4300/4305: non c'entra con questa vertenza.)

## Perché poi è fattibile con poco (una volta sistemati i dati)
- Calcolo **deterministico e semplice**: delta di tariffa × importo già pagato (nessun metodo nuovo).
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
1. **Sbloccare i dati viaggiante** (prerequisito): reperire le buste Elior viaggiante, caricarle in archivio e
   ri-scansionarle con tutte le voci per nov2017–lug2023. Senza questo non c'è il dato `4300/4305` su cui calcolare.
2. Su 1-2 buste reali confermare che `4300/4305 ÷ ore = 0,75 / 1,00` (misura ridotta effettivamente pagata).
3. Stimare a mano (Excel) il credito di **un lavoratore pilota** → validare il metodo PRIMA di scrivere codice.
4. Decidere con l'avvocato lo scope (pilota vs batch).
