# Indennità di assenza dalla residenza — personale Elior ristorazione

Vertenza **distinta** da ferie e mancati riposi. Riguarda il personale **Elior viaggiante** (ristorazione
a bordo dei Frecce Trenitalia), CCNL Attività Ferroviarie. Patrocinio avv. **Guido Celentano** (Tribunale
di Lecce, Sez. Lavoro). Fonte: **ricorso ex art. 414 c.p.c.** (template, importi/nome in bianco) trovato il
30/06/2026 in `~/Downloads/Ricorso ex art. 414 cpc (1).docx`.

## Il fatto in breve
L'**indennità di assenza dalla residenza** è un compenso orario per chi presta servizio fuori dalla propria
residenza di lavoro. Due misure: **servizi SENZA riposo fuori residenza** e **servizi CON riposo fuori residenza**.

## Evoluzione delle tariffe (il cuore della causa)
| Fonte | Senza riposo | Con riposo | Note |
|---|---|---|---|
| CCNL Att. Ferr. **20/07/2012** (personale mobile) | €1,30 | €2,20 | per la **ristorazione**: delegato alla contrattazione aziendale (art. 77 §2.1) |
| Accordo aziendale **Elior 14/10/2014** (ristorazione) | **€0,75** | **€1,00** | misura ridotta; scadenza **30/10/2017** |
| CCNL Att. Ferr. **16/12/2016** (art. 77) | **€1,30** | **€2,20** | **elimina la delega** → misura piena anche per la ristorazione |

- Dal **01/11/2017** (scaduto l'accordo) doveva applicarsi €1,30/€2,20. Elior ha pagato la misura **ridotta
  fino a luglio 2023**; da **agosto 2023** paga la misura piena.
- **Credito** = differenze sul periodo **novembre 2017 – luglio 2023**.

## Dove sta il dato in busta (RailFlow) — ⚠️ DATI VIAGGIANTE INCOMPLETI
Le voci sono **definite** (`INDENNITA_ELIOR` in `types.ts`):
- **`4300` — "Ass. Res. No RS"** = assenza residenza **senza** riposo (pagata €0,75, dovuta €1,30).
- **`4305` — "Ass. Res. RS"** = assenza residenza **con** riposo (pagata €1,00, dovuta €2,20).

**MA i dati Elior viaggiante NON sono pronti** (verificato sul DB il 30/06):
- Le buste viaggiante **non sono in archivio** (`payslip_metadata`): analizzate dal **vecchio gestionale**,
  *prima* che l'archivio esistesse → presenti solo nella **tabella** (griglia `anni`).
- Anche in tabella i codici `4300/4305` compaiono in **pochissimi mesi** (es. Boriglione 3/228, altri 0–2):
  l'indennità residenza **non è estratta** per la quasi totalità del periodo.
- Mancano anche le **voci fisse** Elior viaggiante.
- → **Prerequisito alla vertenza:** acquisire le buste viaggiante, caricarle in archivio e **ri-scansionarle
  con tutte le voci** (4300/4305 inclusi) per il periodo nov 2017 – lug 2023.
- (Elior **magazzino** — Ghiro/Mastropasqua, ~98 buste ciascuno in archivio — è completo, ma il magazzino
  **NON ha** l'indennità residenza: non è oggetto di questa vertenza.)

## Calcolo della differenza (per mese, nel periodo nov2017–lug2023)
- Da `4300`: differenza = importo₄₃₀₀ × (1,30/0,75 − 1) = importo × **0,7333** (≡ ore × €0,55, con ore = importo/0,75).
- Da `4305`: differenza = importo₄₃₀₅ × (2,20/1,00 − 1) = importo × **1,20** (≡ ore × €1,20, con ore = importo/1,00).
- + **rivalutazione ISTAT FOI** + **interessi legali** (come le altre pratiche).

## Base giuridica
- **Art. 77** CCNL Att. Ferr. 2012 vs 2016; clausola di salvaguardia per accordi in essere; art. **1322 / 1362
  / 2074 / 2077 c.c.**; **art. 36 Cost.**
- **Corte d'Appello di Roma n. 92 del 27/01/2026** — caso identico (stessi soggetti, stesse clausole): precedente forte.
- Cass. SU **11325/2005**; Cass. **5908/2003, 11939/2004, 2124/2012, 32294/2022, 7609/2001, 30141/2022**.
- No ultrattività dell'accordo scaduto; contestazioni OO.SS. **12/02/2018** e disdetta **19/04/2023**.

## Da verificare quando si lavora una pratica
- Solo Elior **viaggiante** (ristorazione a bordo), **non magazzino**.
- **Prescrizione** (5 anni, differenze retributive): interrotta dalle comunicazioni OO.SS.; il cutoff dipende dalla data di deposito del ricorso.
- Confermare su busta reale che `4300/4305 ÷ ore = 0,75/1,00` nel periodo (cioè che la misura pagata era davvero quella ridotta).
- Periodo **per-lavoratore** (assunzione/cessazione possono restringerlo).

Implementazione in RailFlow: bozza in `tasks/feature-indennita-residenza-elior.md`.
Collegati: [`ccnl-e-normativa.md`](ccnl-e-normativa.md) · [`codici-voce.md`](codici-voce.md) · [`avvocato-decisioni.md`](avvocato-decisioni.md)
