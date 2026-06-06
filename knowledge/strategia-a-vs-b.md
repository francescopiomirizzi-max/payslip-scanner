# Strategia A vs Strategia B — il divisore della media

Punto delicato e spesso frainteso. Tenerlo chiaro evita errori sui numeri e contraddizioni
interne alle pratiche.

## Un solo principio, due meccaniche

**A e B non sono due metodi diversi: sono lo stesso principio** — il divisore della media =
"i giorni che contano come lavorati". Cambia solo *cosa* conta come tale.

| | Divisore della media | Per chi | Default |
|---|---|---|---|
| **Strategia A** | **effettive giornate lavorative** | tutti i lavoratori normali | ✅ sì |
| **Strategia B** | giornate lavorate **+ assenze retribuite** | solo distaccati (≈0 presenze) | opt-in |

- **A** è ciò che dice il **ricorso depositato**: "**effettive giornate lavorative**" (scritto due
  volte, evidenziato in giallo). È il default corretto.
- **B** serve quando il lavoratore è in **distacco** quasi totale e ha ~0 presenze reali: con A
  il divisore sarebbe quasi zero → la media si **gonfia o esplode** (divide per pochissimi
  giorni) e il credito diventa inaffidabile/contestabile. Includere le **assenze retribuite**
  (distacco, permessi sindacali) nel divisore lo rende prudente e difendibile. Base giuridica:
  **art. 23 L. 300/1970** (permessi retribuiti RSA) — ⚠️ **non** art. 15 (= atti
  discriminatori, è un errore già corretto nei documenti).

## Direzione dell'effetto (NON confondere)

Mettere le assenze nel divisore (B) **allarga il denominatore** → **abbassa** la media:

- per chi ha **presenze reali**, B **riduce** il credito (diluisce la media su più giorni);
- per chi ha un anno con **esattamente 0 presenze**, B **alza** il credito (A non potrebbe
  dividere → credito 0).

Quindi **B ≠ "più soldi"**. Per i distaccati: A darebbe di più ma su pochissimi giorni
(gonfiabile/contestabile), B è prudente. Esempi reali: nei mesi di distacco la media con B vale
solo il ~2-7% della media con A. Es. su D'Errico (presenze normali) B gli **toglie ~€589**
(A = €19.609,72 vs B = €19.020,44).

## Chi usa cosa

- **Tutti = Strategia A.**
- **Eccezione = i 2 Cataneo**: **Cataneo Vincenzo (RFI)** e **Cataneo Pasquale (Trenitalia)**,
  distaccati → **Strategia B** (deciso col sindacalista Vincenzo, per coerenza con la loro
  situazione di distacco, non per fare cassa).

> L'uniformità richiesta dall'utente è al livello del **principio** (divisore = giorni che
> contano come lavorati), non della meccanica: i Cataneo sono l'eccezione **motivata**, non un
> trattamento di favore.

## Implementazione

- Campo `Worker.includePaidLeave` (per-lavoratore). Default profilo:
  `PROFILES_DEFAULT_PAID_LEAVE = []` → **A per tutti** (era `['RFI','TRENITALIA']`, **invertito**
  il 2026-06-04 dopo aver letto il ricorso). B resta **opt-in** col toggle UI "Permessi" (verde,
  in `VertenzaTimeline`).
- Motore: `CalculationParams.includePaidLeave` → divisore = `daysWorked + (includePaidLeave ?
  daysPaidLeave : 0)`. Additivo, con OFF il comportamento è quello storico.
- Persistenza: `localStorage` `paidLeave_<id>` + helper `resolveIncludePaidLeave(worker)` usato
  in **tutti** i call site. Nel DB **non** esiste colonna `include_paid_leave`.
- ⚠️ **Trappola localStorage:** il mount-effect di `WorkerDetailPage` aveva scritto
  `paidLeave_<id>=true` sulle pratiche aperte a inizio giugno (quando il default era ON). Invertire
  il default **non** le corregge da solo → su quelle pratiche va **spento il toggle a mano**.

Cfr. memory `analisi-divisore-26-rfi`, `check-derrico-e-coerenza-legale`,
`avvocato-metodo-percentuali`.
