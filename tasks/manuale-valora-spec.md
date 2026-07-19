# Specifica - Manuale operativo ValOra

## Obiettivo

Creare un manuale d'uso completo ma leggibile che spieghi sia **come usare ValOra** sia
**come ValOra controlla i dati**. Le schede promozionali restano un estratto; il manuale
diventa la fonte destinata a owner, collaboratori, sindacati e studi legali.

## Deliverable

- `output/manual/Manuale-operativo-ValOra.docx` - sorgente editabile.
- `output/pdf/Manuale-operativo-ValOra.pdf` - versione pronta da leggere/stampare.
- Schermate sanificate della modalita demo in `output/manual/assets/`.

## Sistema editoriale

- Preset documenti: `compact_reference_guide`.
- Cover: `editorial_cover`, adattata al brand ValOra.
- Override dichiarato: pagina A4, margini 0,75", palette navy/teal ValOra.
- Corpo Arial 10,5 pt, interlinea 1,20; H1 18 pt, H2 14 pt, H3 11,5 pt.
- Header: ValOra | Manuale operativo. Footer: versione e numero pagina.
- Formati: prosa breve, procedure numerate, note/callout, confronti tabellari solo dove
  servono davvero, screenshot con didascalia e diagrammi di flusso.

## Pubblico e tono

- **Owner/operatore:** procedure passo passo e controlli da eseguire.
- **Viewer/sindacato/studio:** come leggere dati, report, avvisi e limiti.
- Tono trasparente: distinguere estrazione, verifica e decisione legale; non chiamare
  "automatico" cio che richiede conferma umana.

## Indice previsto

1. Cos'e ValOra e come leggere il manuale.
2. Mappa delle aree e stato delle funzioni.
3. Accesso, organizzazioni e ruoli.
4. Dalla pratica al fascicolo: flusso generale.
5. Creare e preparare un lavoratore.
6. Acquisire buste da PC: singolo, batch, cartella multi-anno.
7. Acquisire dal telefono con QR.
8. Come funziona l'estrazione AI per profilo aziendale.
9. I controlli deterministici durante e dopo l'import.
10. Prova d'accuratezza: parser deterministico locale.
11. Scarti prudenti, anomalie e correzioni.
12. Revisione mensile e modifica manuale.
13. Archivio dei documenti originali.
14. Motore Incidenza e credito ferie.
15. TFR, rivalutazione ISTAT e interessi.
16. Area Turni & Riposi.
17. Report, DOCX, PDF, Excel e ZIP.
18. Demo, viewer e sola lettura.
19. Limiti della versione corrente.
20. Risoluzione problemi e checklist di chiusura pratica.
21. Glossario essenziale.

## Formula tecnica vincolante

> ValOra acquisisce PDF e immagini attraverso un motore AI specializzato per azienda.
> Sui documenti testuali dei profili supportati puo poi eseguire una verifica
> deterministica locale, indipendente dall'AI, confrontando i dati estratti con le
> colonne del PDF. Per le scansioni cartacee Elior applica invece controlli aritmetici
> deterministici sull'output OCR e segnala ogni mancata quadratura.

Non scrivere mai "i PDF testuali vengono importati dal parser deterministico": oggi e falso.

## Matrice dei controlli da rappresentare

| Livello | Quando | Cosa controlla | Esito |
|---|---|---|---|
| Estrazione AI | import | campi e codici secondo il profilo aziendale | proposta dati + avvisi |
| Riconciliazione presenze | post-AI RFI/Trenitalia | colonne presenze, ferie, slittamenti, plausibilita | una correzione sicura o flag |
| Validatore Elior | post-OCR | terne, totali, netto, giorni, tariffe | flag, mai correzione automatica |
| Verifica AI archivio | su richiesta | PDF archiviato contro JSON mese | proposte accettabili dall'utente |
| Parser deterministico | su richiesta, dal disco | testo e coordinate PDF contro dati ValOra | report scarti + correzioni confermate |

## Guardrail da spiegare

- Nome file/cartella ha priorita sul periodo letto; divergenza = "Mese da verificare".
- Scansione priva di testo non passa dal parser deterministico.
- 13a/14a, quadratura fallita, periodo incoerente, duplicati discordanti e giorni ambigui
  vengono esclusi o segnalati: nessuna correzione cieca.
- L'archiviazione manuale conserva il PDF ma non compila la griglia.
- Ri-analizzare un PDF nell'Archivio non aggiorna automaticamente la griglia mensile.
- Mobile: modifica tabella non disponibile; consultazione soltanto.

## Stato funzioni da dichiarare

- Incidenza: operativo.
- Turni & Riposi: consultazione/calcolo/export su pratiche esistenti; creazione/import UI
  non ancora disponibile.
- Indennita: anteprima/in sviluppo; niente promessa di persistenza/export produttivo.
- CAF/Patronato: prospettiva, non funzione operativa.

## Schermate

1. ingresso ValOra;
2. scelta area;
3. dashboard Incidenza;
4. scheda lavoratore e comandi di acquisizione;
5. collegamento mobile QR;
6. Turni & Riposi;
7. prova d'accuratezza;
8. archivio;
9. prospetto ufficiale.

## Gate di chiusura

- Contenuto verificato contro codice, test e `knowledge/`.
- DOCX renderizzato con `render_docx.py --emit_pdf`.
- Ogni pagina PNG ispezionata a vista; zero clipping, tabelle spezzate o screenshot illeggibili.
- PDF A4 con testo estraibile, pagine e metadata verificati.
- Scheda promozionale corretta per non attribuire il parser all'import ordinario.
