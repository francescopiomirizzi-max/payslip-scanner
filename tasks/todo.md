# Sessione — Clean Service SRL: 4 fix correttivi (follow-up)

> **Obiettivo:** correggere 3 problemi rilevati dall'utente dopo lo smoke test della sessione precedente (Rekeep→Clean Service) + 1 fix collegato su verify-payslip.

## Plan (approvato dall'utente)

- [x] **Fix #1** — Ticket 311 fuori dalle colonne indennità (segui pattern RFI/Elior: solo `ticketRate`)
  - `types.ts`: rimosso `{ id: '311' }` da `INDENNITA_CLEAN_SERVICE` → 19 codici (era 20)
  - `scan-payslip.ts` PROMPT_CLEAN_SERVICE: rimosso "311" da MASTER LIST e da esempio JSON `codes`; aggiornato sezione 3 TICKET ("NON deve comparire in codes")
- [x] **Fix #2** — Card modale WorkerModal allineata visivamente
  - `OPTIONS`: label "Clean Service SRL" → **"CLEAN SERVICE"**, sub "Ristorazione e Pulizie" → **"Multiservizi"** (coerente con "Infrastrutture"/"Ristorazione")
- [x] **Fix #3** — Display senza underscore (`CLEAN_SERVICE` → `CLEAN SERVICE` ovunque renderizzato)
  - `utils/formatters.ts` `getProfiloBadgeLabel`: aggiunto `.replace(/_/g, ' ')` default → fix cascade su tutti i callsite (WorkerCard, ArchivePage, WorkerDetailLayout, RelazioneModal)
  - `WorkerModal.tsx:804` "ATTIVO" badge: replace inline
  - `AnnualCalculationTable.tsx:203`, `IndemnityPivotTable.tsx:207`: uso helper `getProfiloBadgeLabel`
  - `DashboardPage.tsx:538` filter pill: replace inline (filterId è generico, non sempre profilo)
  - `WorkerDetailPage.tsx:21` PROFILE_CONFIG: label "Clean Service SRL" → "Clean Service"
- [x] **Fix #4** — `verify-payslip.ts`: aggiunto blocco `else if (co === "CLEAN_SERVICE")` con regole specifiche (asterischi, ** SEGUE **, UNA TANTUM, ticket 311 valore unitario)
- [x] **Docs**: `project_health_report.md` (20→19 codici), `tasks/lessons.md` (Lezione 10)
- [x] **Verifica**: `npx tsc --noEmit` exit 0; `grep '311'` zero match in INDENNITA_CLEAN_SERVICE e in JSON example codes

## Codici Clean Service (aggiornati: 19)

**Maggiorazioni Turni e Festività (7)**: 8037, 8057, 8029, 8019, 565, 8032, 442
**Straordinario / Supplementare (2)**: 8007, 18
**Flessibilità Oraria (3)**: 437, 440, 441
**Indennità Specifiche (7)**: 820, 739, 380, 315, 392, 8038, 8053

**Ticket**: codice 311 → estratto come `ticketRate` (popola la colonna ticket standard di `getColumnsByProfile`), NON è una colonna indennità separata.

## Review

### Cosa è cambiato

**Fix #1 — Ticket coerente con RFI/Elior**
- `INDENNITA_CLEAN_SERVICE` ora ha 19 codici (era 20). Il codice 311 TICKET non compare più come ColumnDef.
- `PROMPT_CLEAN_SERVICE` estrae il codice 311 ESCLUSIVAMENTE come `ticketRate` (valore unitario dalla colonna "Valore Unitario"/"Base"). Esplicito nella sezione 3: "Il codice 311 NON deve comparire nella mappa codes".
- Coerente con come RFI estrae 0E99/0299/0293 e come Elior estrae 2000/2001/0293: tutti come `ticketRate`, mai come codice indennità.

**Fix #2 — Allineamento card selettore contratto**
- Label uppercase: "CLEAN SERVICE" (13 char, coerente con "RFI"/"ELIOR" maiuscoli).
- Sub breve: "Multiservizi" (12 char, coerente con "Infrastrutture"/"Ristorazione"). Descrittore del CCNL effettivo.
- Risultato: 3 card RFI/ELIOR/CLEAN SERVICE visivamente bilanciate, label su 1 riga, sub su 1 riga.

**Fix #3 — Display senza underscore**
- Helper `getProfiloBadgeLabel` ora applica `replace(/_/g, ' ')` come default → tutti i callsite esistenti (WorkerCard badge, ArchivePage badge, WorkerDetailLayout header, RelazioneModal stampa) ora mostrano "CLEAN SERVICE" anziché "CLEAN_SERVICE".
- Sito che usavano `{profilo}` raw aggiornati: AnnualCalculationTable e IndemnityPivotTable ora usano l'helper.
- WorkerModal badge "ATTIVO" e DashboardPage filter pill: replace inline (sono ambienti diversi che non usano l'helper centralizzato).
- WorkerDetailPage PROFILE_CONFIG.label: "Clean Service SRL" → "Clean Service" (senza forma legale, allineato al display naturale).

**Fix #4 — verify-payslip.ts blocco CLEAN_SERVICE**
- Inserito `else if (co === "CLEAN_SERVICE")` tra RFI e il fallback generico.
- Le 3 regole ferree sono riassunte nel blocco verifica: asterischi non sono discrepanza, multi-pagina ** SEGUE ** richiede somma, UNA TANTUM/ARRETRATI prevalgono sui codici.
- Esplicito che codice 311 va solo come ticketRate (coerente con scan-payslip).
- Avvertenza: prima di segnalare discrepanza su `codes.NNNN`, verificare che la voce non sia un UNA TANTUM/ARRETRATO (descrizione testuale prevale).

### File modificati (9 + 2 docs)

**Codice (9)**:
- `types.ts`
- `netlify/functions/scan-payslip.ts`
- `netlify/functions/verify-payslip.ts`
- `components/WorkerModal.tsx`
- `components/WorkerDetailPage.tsx`
- `components/WorkerTables/AnnualCalculationTable.tsx`
- `components/WorkerTables/IndemnityPivotTable.tsx`
- `pages/DashboardPage.tsx`
- `utils/formatters.ts`

**Docs (2)**:
- `project_health_report.md`
- `tasks/lessons.md` (+Lezione 10)

### Verifica

- `npx tsc --noEmit` → **exit 0**
- `grep "'311'\|\"311\""` su `types.ts` + `scan-payslip.ts` → zero match in `INDENNITA_*` e in `codes` JSON example. L'unico match residuo è nel testo della regola asterischi del prompt ("Leggi '311*' → il codice è '311'") — è intenzionale, serve a istruire Gemini.
- Smoke test manuale rimasto a carico utente:
  1. Apri WorkerModal → 3 card visualmente allineate (RFI/ELIOR/**CLEAN SERVICE**), label uppercase, sub breve
  2. Seleziona Clean Service → badge mostra "**CLEAN SERVICE ATTIVO**" (con spazio, niente underscore)
  3. Crea worker Clean Service → griglia mostra 19 colonne indennità + colonna ticket standard (= pattern RFI/Elior)
  4. Carica busta paga Clean Service → ticket popolato in colonna `ticket`, nessuna colonna `311` doppia
  5. Dashboard → filter pill "**CLEAN SERVICE**" (spazio)
  6. ArchivePage / WorkerCard / WorkerDetail → badge "**CLEAN SERVICE**" ovunque
  7. Carica busta con UNA TANTUM → verify-payslip non segnala falso positivo
