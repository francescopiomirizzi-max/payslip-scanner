# Checklist verifica pratica

Controlli da fare prima di considerare **chiusa** una pratica RFI/Trenitalia. È la procedura
standard; lo **stato di avanzamento** delle singole pratiche (chi è fatto, chi no) vive in
memory (`project-aggiornamento-pratiche-rfi`), non qui.

Query sul DB progetto `bpnkjfboijfhnqovymwg`, tabelle `worker_profiles.anni` (jsonb) e
`payslip_metadata`.

## I 7 controlli

1. **Backfill voci fisse completo** — 12/12 mesi con codici `3B..` su **ogni anno** del periodo
   di domanda. (Per % oneste serve la base fissa su tutti gli anni a credito, vedi
   [`metodologia-calcolo.md`](metodologia-calcolo.md) §2.)
2. **Variabili intatte** — nessun clobber: il backfill scrive SOLO i `3B..`, mai giorni/variabili/TFR.
3. **Zero duplicati archivio** — `group by year, month` non deve dare doppioni.
4. **% incidenza coerente** — mai 100% da base fissa €0; media periodo calcolata solo sugli anni
   con `sumQuadroFisse > 0`.
5. **Strategia A/B corretta** — A per tutti; **B solo per i distaccati** (i 2 Cataneo). Verificare
   anche il `localStorage` `paidLeave_<id>` (può essere rimasto ON da inizio giugno → spegnerlo a
   mano). Vedi [`strategia-a-vs-b.md`](strategia-a-vs-b.md).
6. **Anno di riferimento pieno** — `start_claim_year − 1` deve avere ~12 mesi reali; se è rado,
   spostare lo `start_claim_year` in avanti. Vedi [`metodologia-calcolo.md`](metodologia-calcolo.md).
7. **Anni a variabili anomalmente basse** — segnalarli (candidati sotto la soglia 20% di incidenza).

## Note pratiche ricorrenti (non sono errori)

- **gg lavorati > 31 su RFI** — normale: ci sono **compensazioni** (la busta lo dice) i cui giorni
  eccedono il mese. NON ri-segnalare gg_lav > 31 sugli RFI.
- **0 gg lavorati ma variabili > 0** — plausibile (reperibilità in un mese di assenza); con
  Strategia B è coperto dalle assenze.
- **Voci fisse "mancanti"** — verificare sulla busta: alcuni lavoratori non hanno ERI/EDR (es.
  D'Errico) → la base fissa più corta è **corretta**, non un buco di estrazione.

## Generazione documenti (a verifica superata)

Per ciascuna pratica: ① backfill voci fisse (tab Archivio, anno per anno) → ② toggle "Permessi"
solo sui 2 Cataneo → ③ generare i documenti (Download Conteggi + Report → PDF Riepilogo +
Relazione, oppure "Esporta Concluse ZIP").

- I 3 documenti = **Conteggi (PDF)**, **Riepilogo (PDF)**, **Relazione (.docx)**.
- Il "Riepilogo" buono è quello del tasto **Stampa** (HTML), non del tasto PDF (memory
  `riepilogo-stampa-vs-pdf`).
- ⚠️ I documenti generati prima delle modifiche (voci fisse + %, artt. 30/83, Strategia A) sono
  **stale** → vanno **rigenerati** in locale (`npm start`, porta **8888**).

> **Ambiente:** tutto in **locale**, non deployato (risparmio crediti Netlify). Il backfill
> scrive comunque sul Supabase di **produzione** (dati reali, merge-safe). Dopo ogni edit SQL su
> `worker_profiles.anni`, far fare un **hard refresh** all'app (le scritture live last-write-wins
> sovrascrivono le SQL da snapshot vecchio — memory `feedback-anni-clobber-stale-browser`).

## Aggiornare la checklist sul Desktop (SEMPRE, dopo ogni verifica)

A verifica conclusa, aggiornare il tracciamento `~/Desktop/Checklist_pratiche_RFI.pdf`:

1. Modificare la sorgente durevole `knowledge/fonti/checklist_pratiche_rfi.html` (① ✓ quando il
   backfill è verificato sul DB; ③ ✓ quando i documenti sono generati; aggiornare data + conteggio).
2. Rigenerare il PDF: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless
   --disable-gpu --no-pdf-header-footer --print-to-pdf="$HOME/Desktop/Checklist_pratiche_RFI.pdf"
   "file://$PWD/knowledge/fonti/checklist_pratiche_rfi.html"`.
3. Verifica a vista: `qlmanage -t -s 1400 <pdf> -o /tmp` → leggere il PNG.

Cfr. memory `feedback-aggiorna-checklist-desktop`.
