# Controllo pre-invio — 18 pratiche PAGATE (status `chiusa`) · 2026-07-01

Verifica "quasi totale" dei dati in griglia (`worker_profiles.anni`) prima dell'invio
**irreversibile** all'avvocato (Studio Celentano). 3 agenti paralleli (6 worker ciascuno,
sola lettura) + sanity globale + spot-check su immagini reali delle buste.

## Esito globale (tutte e 18)
- ✅ **Zero duplicati** (anno, mese); griglia integra 2007–2025 (228 righe, nessun mese doppio/mancante).
- ✅ **Backfill voci fisse completo** (12/12 mesi con `3B..` su ogni anno di domanda, tutti).
- ✅ **Strategia A** per tutte (nessun `include_paid_leave`; i 2 Cataneo non sono nel blocco).
- ✅ **Nessun valore negativo, nessun anno lavorato con variabili=0, nessun `daysWorked`>40** (salvo il cluster 2009, vedi sotto).
- ✅ **Nessun errore che gonfi il credito.** Le poche eccezioni sono semmai *conservative* (sotto-stima).

## Tabella verdetti

| # | Lavoratore | Start | Verdetto | Nota |
|---|---|---|---|---|
| 1 | Iammarino Luigi | 2023 | **GO** | rif 2022 pieno; incidenza 20-23% |
| 2 | Maio Carmine | 2008 | **GO** | pulito; incidenza ~33% |
| 3 | Micaletti Massimiliano | 2008 | **GO** | pulito; incidenza ~38% |
| 4 | Tozzi Tommaso | 2008 | **GO** | pulito; incidenza ~37% |
| 5 | Valente Potito | 2008 | **GO** | pulito; incidenza ~40% |
| 6 | Cotugno Michele | 2008 | REVIEW-minor | solo 2022 a 18,7% (borderline) |
| 7 | D'Errico Paolo | 2008 | REVIEW-minor | base fissa corta (no ERI/EDR = corretto); 2020 ferie 48 (capped→no impatto); 2014/2025 <20% |
| 8 | Di Ponte Armando | 2008 | REVIEW-minor | 2025 ferie 46 (capped); alcuni anni <20% |
| 9 | Gentile Celestino | 2008 | REVIEW-minor | 12 anni <20% (trend reale variabili↓ / fisse↑); media ~18% |
| 10 | Mascolo Donato | 2019 | REVIEW-minor | rif 2018 pieno; 2022-25 <20% (attività ridotta reale) |
| 11 | Spadavecchia Giuseppe | 2008 | REVIEW-minor | solo 2008 a 19,6% (borderline) |
| 12 | Zichella Mario | 2008 | REVIEW-minor | 2024/2025 borderline ~19,5% |
| 13 | Avella Antonio (Foggia) | 2008 | REVIEW | 2010 variabili €1.713 basse (possibile gap; conservativo) — spot-check consigliato |
| 14 | Giannasso Silvano M. | 2008 | REVIEW | 2009 un mese `gg`=41 (cluster-wide → prob. compensazione legittima; conservativo) |
| 15 | Taronna Michele | 2008 | REVIEW | 2009 un mese `gg`=41 (idem cluster) |
| 16 | Mottola Angelo | 2008 | REVIEW | 2022-25 crollo variabili €10k→€250-1010/anno (prob. reale: fine straordinari) — spot-check consigliato |
| 17 | **Borriello Stefano** | 2021 | **DECISIONE** | 2020 (rif) variabili reali quasi nulle (COVID) → tariffa 2021 ≈ 0. **Spot-check FATTO: dato corretto.** Start 2021 vs 2022 = scelta avvocato |
| 18 | **Circello Marco** | 2018 | **DECISIONE** | assunto ~Giu 2017 → 2017 = 1° anno parziale (7 mesi, €533). Start 2018 (rif parziale) vs 2019 (rif 2018 pieno) = scelta avvocato |

## Spot-check su immagini (verità = busta reale)
- **Borriello, Luglio 2020** (`.../BORRIELLO STEFANO/Buste paga 2019-2026/buste paga 2020/`):
  unica voce variabile a credito = **0576 Ind. orario spezz. = €20,00**, identico alla griglia.
  Nessuno straordinario (0152/0919/0421 assenti). → I €248 di variabili sul 2020 sono **reali** (COVID), non un buco OCR. **Dato fedele.**

## Le 2 decisioni da prendere (start year — competenza avvocato/utente, NON errori-dato)
Stesso schema in entrambi: l'**anno di riferimento** (N-1 del 1° anno di domanda) è debole → la
tariffa del 1° anno nasce bassa. Non si corregge un dato; si sceglie da quale anno far partire la domanda.

- **Borriello:** rif 2020 = anno COVID con variabili quasi nulle (€248). Start 2021 → credito 2021 ≈ 0.
  - *Opzione A:* tieni 2021 (includi un anno a credito ~0, conservativo).
  - *Opzione B:* sposta a 2022 (rif 2021 pieno, ~€2.616).
- **Circello:** rif 2017 = primo anno parziale (assunto ~Giu 2017, 7 mesi, €533).
  - *Opzione A:* tieni 2018 (ferie 2018 valutate al basso rate 2017, conservativo).
  - *Opzione B:* sposta a 2019 (droppi il 2018 dalla domanda; rif 2018 pieno ~€9.079 → tariffa più alta sugli anni successivi).

## Spot-check ancora aperti (facoltativi, tutti in direzione conservativa)
- **Mottola 2023/2024**: confermare che il crollo variabili è reale (buste appena ritrasmesse dallo Studio).
- **Avella 2010**: 1 busta per capire se €1.713 è reale o gap.
- **Giannasso/Taronna 2009**: 1 mese ciascuno per il `gg`=41 (quasi certamente compensazione).
- Ferie >45 (D'Errico 2020, Di Ponte 2025): **capped a 28/32 → nessun impatto sul credito**, solo estetico.

## Voci "<20% incidenza"
NON sono errori: sono input neutri per l'avvocato (decide lui se un anno debole entra o meno).
Cfr. memory `feedback-ruolo-prepariamo-avvocato-decide`.

## Aggiornamenti 2026-07-01 (azioni fatte)
- **Circello** → `start_claim_year` 2018 → **2019** (SQL, applicato). Riferimento = 2018 pieno;
  domanda 2019–2025. Motivo: 2017 = 1° anno parziale (assunto ~giu 2017), non affidabile per la media.
- **Mottola** → spot-check busta **Ottobre 2023**: unica variabile 0576 = €21, identica alla griglia,
  zero straordinari, fisse tutte presenti → **crollo variabili REALE** (non buco). REVIEW sciolto (anni a bassa incidenza).
- **Borriello** → spot-check busta **Luglio 2020**: 0576 = €20, identica alla griglia → 2020 variabili reali (COVID). Dato fedele. **DECISO: si tiene start 2021** — il 2020 (riferimento) è un anno *pieno* di presenze (solo povero di straordinari), quindi base media valida e conservativa; diverso da Circello (2017 = mezzo anno di rodaggio → non affidabile). Documenti già generati a 2021 = OK.
- **Avella (Foggia)** → rimosso `fix_targets` (era `{2009, Set}` = urgenza residua, busta ora sistemata). Nessun'altra urgenza tra le 18.
- ⚠️ **Le 2 modifiche SQL (Circello start, Avella fix_targets) richiedono HARD REFRESH dell'app** prima
  di generare i documenti, per evitare il clobber last-write-wins (memory `feedback-anni-clobber-stale-browser`).
  Verificare che Circello mostri start 2019 nell'app prima di generare i Conteggi.

### Stato finale
- Tutte e 18 verificate e decise. Borriello (2021) e Circello (2019) chiusi.
- Spot-check facoltativi NON eseguiti (tutti conservativi, non bloccanti): Avella 2010, Giannasso/Taronna 2009 (gg=41).
- Consegna: cartella `~/Downloads/Pratiche_RFI_da_caricare_Drive` (estratta) → Google Drive; bozza email pronta nel thread Criscio + busta Avella Set2009 in allegato. Invio a cura dell'utente.
