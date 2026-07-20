# Todo — Divisore = "giorni di servizio effettivo" + scomposizione dei giorni (FSE / Clarino)

> Sessione 20/07/2026. Nasce dal controllo Clarino: il "GG Lav." moderno (es. Ago 2022 = 23)
> NON sono i giorni lavorati, ma la quantità della voce presenza, che include ferie.
> Decisione con l'utente: facciamo la cosa GIUSTA, non seguiamo il perito alla cieca.
> (Il piano F5 precedente è ESEGUITO e committato — vedi git `ee9ec2c`.)

## 1. Decisione di metodo (presa)

- **Divisore delle medie = giorni di SERVIZIO EFFETTIVO (lavorati), ferie/permessi/malattia esclusi**,
  coerente in TUTTE le ere. È ciò che dice la relazione dell'avvocato (§4: "giorni di servizio
  effettivo") ed è il metodo RFI di sempre. Il perito ha deviato nell'era moderna (usa la voce
  presenza con le ferie dentro): noi NON lo seguiamo.
- **La voce presenza** (`I86178`/`I86005`/`IX0023`, il "23") si continua a ESTRARRE e MOSTRARE,
  ma va SCOMPOSTA; il divisore usa i soli lavorati.
- **Presenza FUORI dal numeratore** (è pagata anche in ferie → non si perde → come la 663 storica
  e come fa il perito). ⟵ da confermare (incide sul credito).
- **Distacco sindacale** (Strategia B, +assenze retribuite al divisore): eccezione invariata.

## 2. Il modello della scomposizione

```
Mese retributivo (GG INPS, ~26) = LAVORATI + FERIE + PERMESSI(L104…) + MALATTIA/altre assenze
Voce presenza (il "23")         = LAVORATI + FERIE           (esclude già permessi e malattia)
DIVISORE                        = LAVORATI  →  lavorati = presenza − ferie
```
Esempio Ago 2022: 26 = 7 lav + 16 ferie + 3 L104 → presenza 23 = 7 + 16; divisore = 7.

## 3. Verificato in analisi (fatto)

- **Relazione §4** = "giorni di servizio effettivo". **Perito**: storico usa i lavorati
  (Set 2013 = 9), moderno usa la presenza-con-ferie (Ago 2022 = 23) → incoerenza sua.
- **Invariante `lavorati = presenza − ferie` validata su TUTTI i mesi moderni 2017-2025**:
  sempre ≥ 0, mai negativa. Minimo = 0 (Ago 2023: 7−7, mese senza lavoro, legittimo).
- **Era storica (≤ giu 2017): `daysWorked` è GIÀ i lavorati** (dalla banda) → la sottrazione
  NON va applicata lì. La discriminante è "il mese ha una voce presenza (>0)".
- Casi da gestire: mese assenza totale (Set 2022 = 0), storno (Mag 2021, gg pulito 24),
  righe gemelle permessi/malattia (INPS + assenza = stessi giorni → contare una volta).

## 4. Implementazione (in ordine, con verifica per step)

- [ ] **1. Modello dati** — aggiungere `daysPresence` (giorni voce presenza, il "23") accanto a
  `daysWorked` (= lavorati, il divisore) e `daysVacation` (ferie); nuovi `daysPermit` (L104…) e
  (opz.) `daysSickness` per la scomposizione completa.
  → verifica: `tsc` compila; invariante `daysPresence = daysWorked + daysVacation` (moderno).
- [ ] **2. Parser/OCR FSE** (`scan-payslip.ts` PROMPT_FSE + gemello `verify-payslip.ts`):
  estrarre la qty della voce presenza in `daysPresence`, i giorni L104 (voci `PIHP*`/`PXR140`)
  in `daysPermit` con **dedup delle righe gemelle**, malattia in `daysSickness`; calcolare
  `daysWorked = daysPresence − daysVacation` SOLO dove esiste la voce presenza (storico invariato).
  → verifica: e2e Ago 2022 (23→7, L104=3) e Set 2024 (22→5); `lavorati × 0,52` = turno 5A.
- [ ] **3. Reconciliation/flag** — per ogni mese: `lavorati+ferie+permessi+malattia ≈ GG INPS`
  e `daysPresence ≥ daysVacation`; se non torna → nota/segnalazione (riuso flag "presenze>31").
- [ ] **4. Calcolo** — confermare che il divisore dell'unitaria è `daysWorked` in `utils/` e che
  ora contiene i lavorati; ricalcolo credito.
  → verifica: unitaria SALE (divisore più piccolo); diff credito prima/dopo.
- [ ] **5. Migrazione Clarino** (unico worker FSE) — mesi moderni (presenza>0): `daysPresence` =
  vecchio `daysWorked`; `daysWorked` = `daysPresence − daysVacation`; estrarre L104/malattia dai
  cedolini; storico intatto. Via SQL scoped + hard refresh.
  → verifica: 228 righe, storico invariato, nessun `daysWorked` < 0, campioni tornano.
- [ ] **6. UI griglia** — mostrare la scomposizione: "GG Lav. (divisore) **7**" + badge/tooltip
  "presenza 23 = 7 lav + 16 ferie + 3 L104"; correggere `INDENNITA_DETAILS['daysWorked']`
  (oggi dice, sbagliando, "giorni lavorati effettivi"). → verifica visiva utente.
- [ ] **7. Numeratore** — togliere `I86178`/`I86005`/`IX0023` dalle colonne di `INDENNITA_FSE`
  (restano fonte di `daysPresence`), se confermato. → verifica: totale ricalcolato, diff atteso.

## 5. Verifica finale

- Gate: `tsc` 0 · vitest · build.
- Credito Clarino Opzione A (attuale) vs B (nuova): numero pronto per la call.
- Nessuna modifica agli altri profili (RFI usa già i lavorati) salvo scelta esplicita.

## 6. Decisioni aperte (da confermare prima di partire)

- **A) Modello:** campo esplicito `daysPresence` (consigliato: trasparente) vs derivare la
  presenza come `daysWorked + daysVacation` (nessun campo nuovo, ma perde il valore grezzo).
- **B) Scomposizione in UI:** badge sotto la cella GG · tooltip · colonna dedicata?
- **C) Numeratore:** confermi presenza FUORI (come discusso)? È un total-mover.
- **D) Ambito:** solo FSE/Clarino ora, o predisponiamo il meccanismo per gli altri profili.
- **E) Malattia:** la estraiamo/mostriamo come i permessi, o per ora solo lavorati+ferie+L104?

---

## ESITO — ESEGUITO 20/07 (approvazione utente "parti in autonomia")

Scelte confermate: A=campo esplicito `daysPresence` · B=tooltip sulla cella · C=presenza fuori dal
numeratore · D=solo FSE/Clarino · E (permessi/malattia estratti): rimandato (non serve al divisore,
`lavorati = presenza − ferie` li esclude già; da aggiungere per la sola scomposizione fine).

**Codice (gate: tsc 0 · vitest 344/344 · build ok):**
- [x] `types.ts`: rimosse I86178/I86005/IX0023 da `INDENNITA_FSE` (fuori dal numeratore); commento
      aggiornato; `AnnoDati.daysPresence` documentato.
- [x] `MonthlyDataGrid.tsx`: tooltip di scomposizione sulla cella "GG Lav." ("presenza 23 = 7 lav +
      16 ferie") + testo `INDENNITA_DETAILS['daysWorked']` corretto (era "giorni lavorati effettivi").
- [x] `fseTruthParser.ts`: `daysWorked = presenza − ferie`, aggiunto `daysPresence` (parser di verità).
- [x] `scan-payslip.ts`: nuova `reconcileFsePresence` (era-aware: solo se voce presenza pagata) +
      wiring per `companyKey === "FSE"` → durabilità sui prossimi scan.
- [x] `usePayslipUpload.ts`: salva `daysPresence` (2 punti).
- [x] `verify-payslip.ts`: regola FSE riscritta (daysWorked = presenza − ferie; niente falsi allarmi).

**Dati (Clarino, worker 311037d4…):**
- [x] `worker_profiles.anni`: 100 mesi moderni migrati (daysWorked→lavorati, +daysPresence); ordine
      preservato; storico intatto; 0 negativi; invariante `presenza = lav + ferie` su 100/100.
- [x] `payslip_metadata.extracted_data`: 99 buste migrate; 0 buste moderne rimaste indietro;
      archivio coerente con la griglia.

**Impatto (credito NOMINALE, l'app aggiunge ISTAT+interessi):**
- PRIMA (presenza nel numeratore, divisore=presenza): **~6.740 €**
- DOPO Opzione B (presenza fuori, divisore=lavorati): **~3.106 €** (circa metà; calo corretto:
  l'app sovra-stimava). Nota: 3.106 < perito (nom. 6.341) perché non replichiamo le sue ricostruzioni
  a tariffa (3,50×GG, Percorrenze/Guide/Nastri) = quesito 2, separato.

**Aperti / follow-up:**
- Hard refresh richiesto all'utente (anni modificato via SQL — cfr. feedback-anni-clobber-stale-browser).
- Collaudo visivo utente (tooltip scomposizione, totali).
- Disponibilità (I86110) nel numeratore: è reperibilità/stand-by, non presenza pura → decisione utente.
- Scomposizione fine con permessi L104/malattia estratti (punto E) se serve in UI/relazione.
- Sezione "Come si calcola" nella Relazione + pannello Metodo (piano tooltip/relazione/pannello del 20/07).
