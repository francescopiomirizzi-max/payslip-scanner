# Knowledge base — RailFlow / payslip-scanner

Base di conoscenza **di dominio** del progetto: CCNL, codici voce delle buste paga,
metodologia di calcolo del credito ferie, e le decisioni prese con avvocato e sindacalista.

È pensata per essere letta **sia da Claude** (che la legge/grep istantaneamente a ogni
sessione) **sia dall'utente**. Vive nel repo → è versionata in git, non dipende da nessun
servizio esterno.

> **Perché file e non NotebookLM (o simili):** un servizio esterno richiederebbe un ponte
> fragile (NotebookLM non ha API pubblica) e darebbe risposte già sintetizzate da un altro
> modello. File markdown nel repo = accesso diretto, deterministico, citabile riga per riga,
> e restano anche se la memoria di Claude si azzera. NotebookLM resta utile come strumento
> *dell'utente* per digerire PDF lunghi (sentenze, ricorsi) e poi versarne qui la sintesi.

## Due livelli

1. **Sintesi curate** — i file `.md` in questa cartella. È quello che Claude legge per primo.
   Vanno tenuti aggiornati e *senza dati personali* oltre il minimo (codici, tariffe, metodo).
2. **Fonti grezze** — la cartella [`fonti/`](fonti/) (CCNL completi, sentenze, mail
   dell'avvocato, Excel di conteggio). È **gitignorata** perché può contenere dati personali
   (nomi, buste paga, corrispondenza). Claude le legge su richiesta; il distillato va nelle
   sintesi.

## Rapporto con `memory/` e `tasks/`

Tre archivi diversi, nessuna duplicazione:

| Archivio | Cosa contiene | Esempio |
|---|---|---|
| **`knowledge/`** (qui) | Fatti **stabili di dominio** — la "teoria" che non cambia da sessione a sessione | "Il tetto ferie è 28 gg (Cass. 20216/2022)"; "0482 = €14/gg reperibilità" |
| **`memory/`** | **Stato del lavoro** e come Claude deve comportarsi (verità del momento) | "5/23 pratiche fatte"; "tutto in locale, non deployato" |
| **`tasks/lessons.md`** | **Errori da non ripetere** | "Non scrivere un prompt OCR senza vedere un cedolino reale" |

**Regola di smistamento:** se è un fatto di dominio durevole → qui. Se è "stato attuale /
non deployato / chi ha deciso cosa oggi" → memory. Se è "ho sbagliato X, evitalo" → lessons.

## Come far crescere la base

1. Metti il documento grezzo in `fonti/` (vedi convenzione di naming in [`fonti/README.md`](fonti/README.md)).
2. Chiedi a Claude di **consolidarlo** nella sintesi giusta (es. "aggiungi questo articolo CCNL
   a `ccnl-e-normativa.md`").
3. Claude estrae i fatti durevoli, li scrive nella sintesi e cita la fonte.

## Indice delle sintesi

- [`glossario.md`](glossario.md) — termini di dominio (ferie, divisore, reperibilità, Quadro A/B/C…)
- [`ccnl-e-normativa.md`](ccnl-e-normativa.md) — CCNL Mobilità/AF (RFI, Trenitalia), Multiservizi (Clean Service), Elior, Mercitalia
- [`codici-voce.md`](codici-voce.md) — legenda codici voce per profilo + note OCR
- [`metodologia-calcolo.md`](metodologia-calcolo.md) — come si calcola il credito ferie e la % di incidenza
- [`metodologia-mancati-riposi.md`](metodologia-mancati-riposi.md) — mancati riposi (Reg. CE 561/2006 + valorizzazione CCNL): soglie, tariffa effettiva, coefficiente danno, due serie
- [`strategia-a-vs-b.md`](strategia-a-vs-b.md) — il divisore della media: giornate effettive (A) vs assenze incluse (B)
- [`verifica-pratica.md`](verifica-pratica.md) — checklist per considerare "chiusa" una pratica
- [`avvocato-decisioni.md`](avvocato-decisioni.md) — set voci confermato e decisioni chiuse/aperte

_Ultimo aggiornamento: 2026-06-30._
