# Valora — piattaforma per uffici vertenze e CAF *(ex RailFlow)*

Applicazione web per uffici vertenze sindacali: dall'acquisizione OCR delle buste paga al calcolo
delle differenze retributive, fino alla generazione dei documenti legali (relazioni .docx, conteggi
Excel, prospetti di stampa) pronti per lo studio legale. Nata come scanner di cedolini, è cresciuta
caso reale dopo caso reale fino a diventare una piattaforma multi-organizzazione.

## 📈 L'evoluzione del progetto

Il progetto non è nato "piattaforma": lo è diventato. Ogni fase è stata guidata da pratiche vere
portate in giudizio, non da feature immaginate.

1. **Scanner di cedolini (payslip-scanner).** OCR su buste paga italiane via Gemini: estrazione
   strutturata di voci retributive, presenze e indennità da PDF e scansioni, con profili per
   azienda (layout e codici voce diversi) e un secondo prompt AI di *verifica* indipendente
   dall'estrazione.
2. **RailFlow — il motore di calcolo.** Sopra l'archivio è cresciuto il motore per le differenze
   retributive: incidenza percentuale delle voci variabili su ferie/festività (giurisprudenza di
   Cassazione), TFR e rivalutazioni ISTAT, con griglia dati Excel-like per il controllo manuale
   riga per riga. Output: relazione tecnica .docx, conteggi Excel e prospetti di stampa che un
   avvocato può validare voce per voce.
3. **Aree specializzate.** Il dominio si è allargato a tre aree operative gemelle nella UI ma
   con motori distinti:
   - **Incidenza** — differenze retributive su ferie e festività (l'area storica);
   - **Turni & Riposi** — mancati riposi nel TPL (Reg. CE 561/2006, D.Lgs 234/2007), con
     analisi delle giornate, tariffe per anno e quantificazione del danno;
   - **Indennità** — differenze su indennità contrattuali (confronto Pagato↔Dovuto con
     timeline di prescrizione).
4. **Multi-organizzazione e rebrand Valora.** Dashboard d'ingresso per più sindacati e CAF,
   scoping dei dati per organizzazione (RLS + filtri fail-open), accesso viewer in sola lettura
   per i referenti, disciplina whitelabel (il brand Valora vive sull'ingresso, dentro le sezioni
   parla l'organizzazione). Il rebrand ha toccato solo l'interfaccia: i documenti generati
   restano invariati.

## ✨ Funzionalità principali

* **Pipeline OCR resiliente:** scansione massiva di archivi (centinaia di buste), retry
  budget-aware, pool di client e rate limiting; scanner QR realtime per l'acquisizione da mobile.
* **Doppio controllo AI:** estrazione e verifica sono due prompt indipendenti; i campi ambigui
  vengono segnalati, mai indovinati. Invarianti deterministiche lato codice dove l'OCR è fragile.
* **Motori di calcolo verificabili:** ogni numero è riconducibile alla busta sorgente; i
  generatori producono documenti che il legale può controllare riga per riga.
* **Data entry Excel-like:** griglia con navigazione da tastiera per il controllo e la correzione
  manuale dei dati estratti.
* **Sicurezza per ruoli:** Row Level Security su tutte le tabelle e sullo storage; account
  viewer in sola lettura con permessi di export selettivi.
* **Modalità demo:** build separata con dati fittizi e zero chiamate al backend, usata come
  showroom pubblico.

## 🛠️ Stack tecnologico

* **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4, Framer Motion, Recharts, Lucide.
* **Backend:** Supabase (Postgres + RLS, Storage, Realtime) e Netlify Functions per le chiamate
  server-side a Gemini.
* **AI:** Google Gemini per OCR strutturato e verifica dei cedolini.
* **Documenti:** docx, ExcelJS, jsPDF per relazioni, conteggi e prospetti.
* **Test:** Vitest (unit test sui motori di calcolo e sugli helper critici).

## 💻 Sviluppo locale

Prerequisito: Node.js 24+.

```bash
npm install
npm run dev        # app completa (richiede credenziali Supabase)
npm run dev:demo   # modalità demo: dati fittizi, nessun backend
npm test           # suite Vitest
npm run build      # build di produzione
```

Le migration SQL vivono in `supabase/migrations/` (numerate e commentate); la conoscenza di
dominio (CCNL, codici voce, metodologia di calcolo) in `knowledge/`.

## 👨‍💻 Autore

Progettato, sviluppato e manutenuto da **Francesco Pio Mirizzi**.
