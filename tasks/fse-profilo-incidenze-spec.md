# FSE (Ferrovie del Sud Est) — Specifica profilo Incidenze + code-map — 09/07/2026

> Nuova azienda da inserire nell'area **Incidenze** (differenze retributive / % incidenza indennità).
> Primo lavoratore: **Clarino Francesco** (da inserire SOLO dopo profilo + motore OCR pronti).
> Analisi basata su: 40 cedolini reali Clarino 2023-2025 + `Relazione_Tecnico_Giuridica_Clarino.pdf` +
> `Riepilogo Generale Ferie (NoT) Clarino.pdf` (modello del perito, gen-2011→nov-2024).

## 1. La vertenza e il metodo (= motore già esistente)
- **Oggetto**: differenze retributive sull'**indennità feriale** ex art. 7 Dir. 2003/88/CE (CGUE *Williams* C-155/10,
  *Lock* C-539/12): le indennità "di incomodo" (turno, domenicale, presenza, percorrenze, trasferte, ecc.) percepite
  nei 12 mesi precedenti NON sono state incluse nella paga ferie → ferie sottopagate. + riflesso TFR (art. 2120 c.c.).
- **Metodo del perito (§4 relazione, confermato dal riepilogo)**: identico al motore ferie RailFlow —
  *Indennità Unitaria* = Σ indennità di incomodo (12 mesi precedenti) ÷ giorni servizio effettivo (12 mesi);
  *indennità ferie spettante* = unitaria × giorni ferie fruiti nel mese; + rivalutazione ISTAT FOI + interessi legali.
  Totali Clarino: **6.340,97 + 1.093,37 riv. + 736,56 int. = 8.170,94 €**; TFR **566,87 €**.
- ⇒ **NON serve un motore nuovo**: FSE riusa il calcolo % incidenza / ferie già in app. Serve solo il **profilo**.

## 2. Layout cedolino (ZUCCHETTI)
- Azienda: **FERROVIE DEL SUD EST E SERVIZI AUTOMOBILISTICI SRL** (cod. az. `FSE`), filiale Bari.
- **Voci fisse** nel blocco **"ELEMENTI DELLA RETRIBUZIONE"** (testata, importi con etichette a parole, non codici):
  `Minimo contr. · Contingenza · Scatti · T.D.R. · Ind.mensa` → TOTALE (= voce **AA245 Retribuzione** in tabella).
- **Tabella voci a 7 colonne**: `CODICE · DESCRIZIONE · ORE/GIORNI · IMPORTO UNITARIO · IMPORTI FIGURATI ·
  COMPETENZE · TRATTENUTE`. ⚠️ Gli importi indennità si leggono da **COMPETENZE** (come MERCITALIA; non da
  "importo unitario"/"figurati").

## 3. INDENNITA_FSE — indennità di incomodo (colonne griglia, numeratore) — DA CONFERMARE
Censite su 40 cedolini 2023-2025; mappate sulle categorie del perito. Proposta:

| Codice | Label proposta | Categoria perito | Freq. |
|---|---|---|---|
| I86178 | Compenso di presenza | Presenza giornaliera | 36/40 |
| I86161 | Comp. turno produttivo | Ind. Aziendale/turno | alta |
| I86174 | Comp. produttività a vuoto | Guide (pieno/vuoto) | media |
| I85210 | Ordinario notturno avv. 20% | Notturno | 32/40 |
| I85248 | Indennità domenicale | Ind. Domenicale | 10/40 |
| I85240 / I85245 | Punto 5 acc. 21/5/81 | Ind. Turno Art.5A | alta |
| I86110 | Ind. disponibilità | Ind. Aggiuntiva (disp.) | bassa |
| AA712 | Compenso funzione sala | Ind. Aziendale (ruolo) | 36/40 |
| T8305 / T8306 / T8309 | Trasferta 90% / 50% / C1 10% | Diarie/Trasferte | alta |
| I8320 | Rimborso spese vitto | Diarie | bassa |
| S11000 | Straordinario 110% | Straordinario | 34/40 |
| V12000 / V12001 | Straord. festivo / Lavoro festivo 120% | Festivo | media |
| I86125 | Straord. Fer/Fest. notturno | Straord. festivo nott. | 17/40 |

**Ticket**: `I86121 Ticket mensa (elettr.)` → colonna **standard ticket** (`ticketRate`), NON colonna indennità
(pattern lezione 10: ticket sempre fuori dalle indennità).

## 4. INDENNITA_FSE_FISSE — voci fisse (denominatore % incidenza) — DA CONFERMARE
Dal box "ELEMENTI DELLA RETRIBUZIONE": `Minimo contr. · Contingenza · Scatti · T.D.R. · Ind.mensa`.
Alternativa a colonna singola: **AA245 Retribuzione** (= loro somma, riga in Competenze, come ELIOR voce 1000).
Nota da decidere: fisse dal box (base mensile piena) vs AA245 (può essere pro-ratato nei mesi parziali).

## 5. Build plan — i 5 punti di registrazione profilo (lezione 16/05)
1. **`types.ts`** — `ProfiloAzienda` += `'FSE'`; `INDENNITA_FSE` + `INDENNITA_FSE_FISSE`; case in
   `getColumnsByProfile()` e `getFixedColumnsByProfile()`.
2. **`netlify/functions/scan-payslip.ts`** — `PROMPT_FSE` (layout ZUCCHETTI, importi da COMPETENZE, giorni servizio,
   ferie fruite, elementi fissi dal box) + `PROMPT_DIRECTORY['FSE']`. Scritto GUARDANDO i cedolini reali (lezione MERCITALIA).
3. **`netlify/functions/scan-worker.ts`** — FSE nell'elenco aziende del prompt anagrafica (riconoscere la testata).
4. **`components/WorkerModal.tsx`** — `THEMES.FSE` (colori/logo `ferrovie-del-sud-est.png`), `OPTIONS`, `validCompanies`.
5. **Scatter** — App/WorkerCard/WorkerDetailPage/CompanyBuilder/StatsDashboard/WorkerTables/printTables/DashboardPage
   (badge/filtro/CCNL). Audit finale: `grep -rn "FSE"` = zero residui nei punti UI.
+ **`verify-payslip.ts`** — ramo FSE gemello del prompt di estrazione (i 2 prompt Gemini vanno sincronizzati).
+ Logo: `FERROVIE DEL SUD EST LOGO.png` (1159×130, trasparente) → dark mode con trattamento `CompanyLogo`.

## 6. Decisioni (CONFERMATE dall'utente 09/07)
- **Straordinari/festivi ESCLUSI** (S11000/V12000/V12001/I86125): seguiamo il modello del perito → i totali devono
  combaciare col riepilogo (8.170,94 €). Gli straordinari finiscono eventualmente in "Arretrati/Altro".
- **Voci fisse = 5 elementi separati** (Minimo contr. · Contingenza · Scatti · T.D.R. · Ind.mensa).
- **⚠️ Il perito lavora per CATEGORIA, senza codici** (Vincenzo confermato): il code-map §3 è una **ricostruzione
  nostra dai cedolini**, da validare sui totali, non una verità del perito.
- **Cedolini**: 2010-2016 = **scansioni immagine** (no text layer → solo OCR RailFlow); 2017-2026 = testuali mensili.
  Il set colonne §3 è certo sui codici 2023-2025; percorrenze/nastri/flessibilità/riserva del periodo vecchio
  vanno confermati in fase OCR sugli anni scansionati.

## 7. Prossimo passo
Confermato il set colonne → implemento i 5 punti (profilo + prompt), poi carichiamo Clarino e verifichiamo i totali
contro il riepilogo del perito (8.170,94 €) come banco di prova.
