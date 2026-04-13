import React, { useState } from 'react';
import { X, Printer, Copy, CheckCircle, PenTool, FileText, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { motion } from 'framer-motion';
import { YEARS, AnnoDati, getColumnsByProfile } from './types';
import { parseLocalFloat } from './utils/formatters';

// --- HELPER DI FORMATTAZIONE SICURA ---
const fmt = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- HELPER CENTRALIZZATI PER SINCRONIA UI/WORD ---
const generaVociRaggruppate = (worker: any) => {
    let testo = "";
    let html = "";
    
    if (worker?.profilo === 'ELIOR') {
        if (worker?.eliorType === 'magazzino') {
            testo = "- Lavoro Notturno e Domenicale\n- Straordinari e Maggiorazioni (18%, 35%)\n- Indennità specifiche di logistica (Indennità Cella e Sottosuolo)\n- Funzioni Diverse e 26/MI Retribuzione";
            html = `<li>Lav. Nott. (1130) e Lav. Domen. (1131)</li>
                <li>Straord. 18% (2018), Straord. 35% (2035) e Magg. 35% (2235)</li>
                <li>Funz. Diverse (4133), Ind. Cella (2313) e Ind. Sottosuolo (4275)</li>
                <li>26/MI Retrib. (4285)</li>`;
        } else {
            testo = "- Indennità specifiche della Ristorazione a Bordo (Ind. Cassa, Lav. Notturno/Domenicale)\n- Diaria Scorta e Riserva Presenza\n- Straordinari e Maggiorazioni (18%, 20%, 35%)";
            html = `<li>Ind. Cassa (1126), Lav. Nott. (1130) e Lav. Domen. (1131)</li>
                <li>Str. 18% (2018), Str. 20% (2020), Str. 35% (2035) e Magg. 35% (2235)</li>
                <li>Funz. Diverse (4133), RFR < 8h (4254), Pernottamento (4255) e Pernottazione (4256)</li>
                <li>Ass. Res. No RS (4300), Ass. Res. RS (4305) e F. Sede RFR (4301)</li>
                <li>Diaria Scorta (4320), Riserva Pres. (4345), Flex Oraria (4325) e Flex Res. (4330)</li>
                <li>26/MI Retrib. (5655)</li>`;
        }
    } else if (worker?.profilo === 'REKEEP') {
        testo = "- Indennità Turni Non Cadenzati e Pernottamento\n- Indennità Sussidiaria e Residenza\n- Lavoro Domenicale e Notturno\n- Maggiorazioni e Straordinari legati all'appalto";
        html = `<li>Ind. Domenicale (I1037C) e Lav. Notturno (I1040C)</li>
            <li>Turni Non Cad. (I215FC) e Ind. Pernott. (I225FC)</li>
            <li>Ass. Residenza (I232FC) e Ind. Sussidiaria (I1182C)</li>
            <li>Fest. Non God. (D2200)</li>
            <li>Straord. 18% (S1800C) e Maggioraz. 35% (M3500C)</li>`;
    } else if (worker?.profilo === 'RFI' || !worker?.profilo || worker?.profilo === 'ND') {
        testo = "- Indennità legate ai turni (Lavoro Notturno, Festivo, Straordinari)\n- Indennità di funzione e disagio (Chiamata, Reperibilità, Linea, Condotta)\n- Trasferte esenti e indennità accessorie ricorrenti previste dal CCNL Mobilità/RFI";
        html = `<li>Straord. Diurno (0152) e Ind. Notturno (0421)</li>
            <li>Comp. Cantiere Notte (0423) e Festivo Notturno (0457)</li>
            <li>Ind. Chiamata (0470), Ind. Reperibilità (0482) e Ind. Disp. Chiamata (0496)</li>
            <li>Ind. Linea < 10h (0687) e Trasferta (0AA1)</li>
            <li>Ind. Orario Spezz. (0576) e Rep. Festive/Riposo (0584)</li>
            <li>Str. Feriale Diurno (0919), Str. Fest/Notturno (0920), Str. Diurno Rep. (0932), Str. Fest/Not Rep. (0933), Str. Diurno Disp. (0995) e Str. Fest/Not Disp. (0996)</li>`;
    } else {
        testo = `- Voci a carattere continuativo previste dal modello aziendale applicato (${worker?.profilo})`;
        html = `<li>Tutte le voci a carattere continuativo e ricorrente previste dal modello aziendale applicato (${worker?.profilo}).</li>`;
    }
    
    return { testo, html };
};

const generaEsempioDinamico = (worker: any, startClaimYear: number, tettoGiorni: number) => {
    let testo = "A titolo di esempio, illustriamo il calcolo generico utilizzato: sommiamo le voci variabili dell'anno precedente, dividiamo per i giorni lavorati ottenendo la media giornaliera, e la moltiplichiamo per i giorni di ferie goduti.";
    let html = "<p>A titolo di esempio, illustriamo il calcolo generico utilizzato:</p><ul><li><b>Passo A:</b> Sommiamo tutto il valore delle voci variabili percepite nell'anno di riferimento (N-1).</li><li><b>Passo B:</b> Dividiamo questa somma per i giorni effettivi di lavoro svolti in quell'anno (Media).</li><li><b>Passo C:</b> Moltiplichiamo la Media per i giorni di ferie goduti.</li></ul>";

    if (worker?.anni && Array.isArray(worker.anni)) {
        const validCodes = getColumnsByProfile(worker.profilo, worker.eliorType)
            .map((c: any) => c.id)
            .filter((id: string) => !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(id));

        const anniOrdinati = [...worker.anni].sort((a, b) => Number(b.year) - Number(a.year));
        
        for (const m of anniOrdinati) {
            const annoCorrente = Number(m.year);
            if (annoCorrente <= startClaimYear || Number(m.daysVacation) === 0) continue;
            
            const annoPrec = annoCorrente - 1;
            const datiAnnoPrec = worker.anni.filter((a: any) => Number(a.year) === annoPrec);
            let totVariabiliPrec = 0;
            let ggLavPrec = 0;

            datiAnnoPrec.forEach((mm: any) => {
                const ggLavMese = parseLocalFloat(mm.daysWorked);
                
                if (ggLavMese > 0) {
                    ggLavPrec += ggLavMese;
                    
                    validCodes.forEach((cod: string) => {
                        const rawVal = mm[cod];
                        if (rawVal) {
                            const parsed = parseLocalFloat(rawVal);
                            if (!isNaN(parsed) && parsed !== 0) totVariabiliPrec += parsed;
                        }
                    });
                }
            });

            if (ggLavPrec > 0 && totVariabiliPrec > 0) {
                const mediaGiornaliera = totVariabiliPrec / ggLavPrec;

                const datiAnnoCorrente = worker.anni.filter((a: any) => Number(a.year) === annoCorrente);
                let totFerieCorrente = 0;
                datiAnnoCorrente.forEach((mm: any) => totFerieCorrente += Number(mm.daysVacation) || 0);

                const ferieUsate = Math.min(totFerieCorrente, tettoGiorni);
                const lordoEsempio = mediaGiornaliera * ferieUsate;

                testo = `A titolo illustrativo, riportiamo il calcolo matematico applicato esattamente per l'anno ${annoCorrente} dei conteggi allegati:\n- Passo A (Totale Voci): Nell'anno di riferimento (${annoPrec}), il lavoratore ha percepito indennità variabili ricorrenti per un totale di € ${fmt(totVariabiliPrec)}.\n- Passo B (Media Giornaliera): Dividendo tale somma per i giorni effettivamente lavorati nel ${annoPrec} (${ggLavPrec} gg), si ottiene una media giornaliera pari a € ${fmt(mediaGiornaliera)}.\n- Passo C (Moltiplicazione): Nell'anno ${annoCorrente}, il lavoratore ha fruito di ${ferieUsate} giorni di ferie validi ai fini del calcolo (entro il tetto legale applicato). Moltiplicando la media di € ${fmt(mediaGiornaliera)} per i ${ferieUsate} giorni, si certifica una differenza lorda maturata pari a € ${fmt(lordoEsempio)} per quel singolo anno.`;
                
                html = `
                <p>A titolo illustrativo, riportiamo il calcolo matematico applicato esattamente per l'anno <b>${annoCorrente}</b> dei conteggi allegati:</p>
                <ul>
                    <li><b>Passo A (Totale Voci):</b> Nell'anno di riferimento (<b>${annoPrec}</b>), il lavoratore ha percepito indennità variabili ricorrenti per un totale di <b>€ ${fmt(totVariabiliPrec)}</b>.</li>
                    <li><b>Passo B (Media Giornaliera):</b> Dividendo tale somma per i giorni effettivamente lavorati nel ${annoPrec} (<b>${ggLavPrec} gg</b>), si ottiene una media giornaliera pari a <b>€ ${fmt(mediaGiornaliera)}</b>.</li>
                    <li><b>Passo C (Moltiplicazione):</b> Nell'anno <b>${annoCorrente}</b>, il lavoratore ha fruito di <b>${ferieUsate}</b> giorni di ferie validi ai fini del calcolo (entro il tetto legale applicato). Moltiplicando la media di € ${fmt(mediaGiornaliera)} per i ${ferieUsate} giorni, si certifica una differenza lorda maturata pari a <b>€ ${fmt(lordoEsempio)}</b> per quel singolo anno.</li>
                </ul>`;
                
                break;
            }
        }
    }
    return { testo, html };
};

const generaSpiegazioneRisultato = (includeTickets: boolean, showPercepito: boolean) => {
    let testo = "";
    let html = "";
    
    if (!showPercepito && !includeTickets) {
        testo = "Applicando la formula mese per mese, abbiamo calcolato la differenza retributiva lorda maturata dal lavoratore.\n\nPoiché non vi sono indennità già erogate da dedurre, né buoni pasto da integrare, il totale richiesto corrisponde interamente ed esclusivamente al LORDO maturato e non corrisposto dall'Azienda.";
        html = "<p>Poiché non vi sono indennità già erogate dall'azienda da dedurre, né buoni pasto da integrare, il totale richiesto corrisponde interamente ed esclusivamente al <b>LORDO maturato e non corrisposto</b>.</p>";
    } else {
        testo = "Applicando la formula mese per mese, abbiamo ricavato il Lordo totale maturato. \n";
        html = "<ul>";
        
        if (showPercepito) {
            testo += "Da questa cifra abbiamo sottratto con precisione quanto l'azienda aveva già versato a titolo di 'indennità feriale' base, in modo da evitare qualsiasi duplicazione (voce 'Già Percepito').\n";
            html += "<li>Dal lordo totale maturato, abbiamo sottratto con precisione matematica quanto l'azienda aveva già versato a titolo di 'indennità feriale' base (voce 'Già Percepito'), evitando così qualsiasi duplicazione di calcolo.</li>";
        }
        if (includeTickets) {
            testo += "Infine, abbiamo aggiunto il valore economico dei Buoni Pasto (Ticket) non consegnati durante i giorni di ferie fruite.\n";
            html += "<li>Infine, abbiamo sommato il valore economico dei Buoni Pasto (Ticket Restaurant) maturati ma non consegnati per le giornate di ferie godute.</li>";
        }
        
        testo += "\nIl risultato finale rappresenta l'esatto credito NETTO da liquidare a favore del lavoratore.";
        html += "</ul><p>Il risultato finale espone pertanto l'esatto credito <b>NETTO da liquidare</b>.</p>";
    }
    return { testo, html };
};
// --- FINE HELPER CENTRALIZZATI ---

const generaRelazioneTestuale = (worker: any, totali: any, includeExFest: boolean, includeTickets: boolean, startClaimYear: number, showPercepito: boolean) => {
    const tettoGiorni = includeExFest ? 32 : 28;

    // --- PROTEZIONE DATI ---
    const gt = totali?.grandTotal || totali || {};
    const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
    const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
    const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;
    const nettoVal = (Number(lordoVal) - (showPercepito ? Number(percepitoVal) : 0)) + (includeTickets ? Number(ticketVal) : 0);

    // --- GESTIONE ANNI ALLINEATA AL "CERVELLO" ---
    let anniAttivi = (worker?.anni || [])
        .filter((a: AnnoDati) => Number(a.daysWorked) > 0 && Number(a.year) >= startClaimYear) // Filtro rigoroso!
        .map((a: AnnoDati) => Number(a.year))
        .sort((a: number, b: number) => a - b);

    anniAttivi = [...new Set(anniAttivi)];
    if (anniAttivi.length === 0) anniAttivi = [startClaimYear, new Date().getFullYear()];

    const inizioPeriodo = startClaimYear; // Ora comanda l'interfaccia, non si tira più a indovinare!
    const finePeriodo = anniAttivi[anniAttivi.length - 1];

    // Utilizzo helpers centralizzati
    const voci = generaVociRaggruppate(worker);
    const esempio = generaEsempioDinamico(worker, startClaimYear, tettoGiorni);
    const spiegazione = generaSpiegazioneRisultato(includeTickets, showPercepito);

    return `
RELAZIONE TECNICA - SINTESI E METODOLOGIA
Pratica di: ${worker?.cognome || ''} ${worker?.nome || ''}
Profilo contrattuale: ${worker?.profilo || 'ND'}
Periodo esaminato: Dal ${inizioPeriodo} al ${finePeriodo}

--------------------------------------------------

1. LA PREMESSA: PERCHÉ CHIEDIAMO QUESTE SOMME
La legge europea (Direttiva 2003/88/CE) e la Suprema Corte di Cassazione (Sentenza n. 20216/2022) stabiliscono un principio fondamentale: quando un lavoratore va in ferie, ha il diritto di riposarsi senza subire alcuna penalizzazione economica.
Durante l'anno, il lavoratore percepisce regolarmente indennità per disagi, turni notturni, festivi e altre voci legate al proprio lavoro. Se l'azienda smette di erogare queste indennità proprio durante le ferie, il lavoratore subisce una perdita economica ingiusta. Questa relazione serve a calcolare e richiedere l'esatta restituzione di queste somme.

2. LE VOCI ANALIZZATE (Rif. Allegato "Tabella 2 - Riepilogo Voci Variabili")
Per calcolare quanto spetta al lavoratore, abbiamo analizzato minuziosamente i cedolini paga. Come illustrato nella "Tabella 2", abbiamo isolato solo le "voci ricorrenti", escludendo tassativamente rimborsi spese, una tantum o arretrati non pertinenti.
Nello specifico del profilo lavorativo in questione, abbiamo tenuto conto di:
${voci.testo}

3. IL METODO DI CALCOLO (Rif. Allegato "Tabella 1 - Calcolo Differenze per Anno")
Per garantire una precisione matematica inattaccabile, l'algoritmo utilizza il "Criterio della Media Storica".
${esempio.testo}

4. L'APPLICAZIONE MENSILE (Rif. Allegato "Tabella 3 - Dettaglio Mensile Analitico")
Come dimostrato analiticamente nella "Tabella 3", abbiamo applicato il calcolo per ogni singolo mese in cui il lavoratore ha goduto delle ferie.
${spiegazione.testo}

5. CONCLUSIONI (Rif. Allegato "Prospetto Ufficiale di Ricalcolo / Riepilogo Somme Richieste")
I risultati di tutte le tabelle analitiche di cui sopra confluiscono nel documento riassuntivo finale (il Prospetto Ufficiale), che certifica gli importi esatti qui sotto riportati.

--------------------------------------------------
RIEPILOGO FINALE DEGLI IMPORTI
+ DIFFERENZE LORDE MATURATE: .......... € ${fmt(lordoVal)}
${showPercepito ? `- IMPORTO GIÀ PERCEPITO IN BUSTA: ..... € ${fmt(percepitoVal)}\n` : ''}${includeTickets ? `+ CREDITO BUONI PASTO NON EROGATI: .... € ${fmt(ticketVal)}\n` : ''}==================================================
TOTALE CREDITO ${(!showPercepito && !includeTickets) ? 'LORDO' : 'NETTO'} SPETTANTE: ..... € ${fmt(nettoVal)}
==================================================
`;
};

// ... Il resto del componente (RelazioneModal) rimane identico ...
// ... Copia tutto il resto dal tuo codice originale (handleStampa, JSX return, etc.) ...

export const RelazioneModal = ({ isOpen, onClose, worker, totals, includeExFest = false, includeTickets = true, showPercepito = true, startClaimYear = 2008 }: any) => {

    const [copiato, setCopiato] = useState(false);

    if (!isOpen) return null;

    let testoCompleto = "";
    try {
        testoCompleto = generaRelazioneTestuale(worker, totals, includeExFest, includeTickets, startClaimYear, showPercepito);
    } catch (err) {
        console.error("Errore generazione testo:", err);
        testoCompleto = "Errore nella generazione dei dati. Controllare la console.";
    }

    // ... (Mantieni tutto il codice HTML per la stampa e il render JSX invariato) ...
    // Prepariamo l'HTML per le note (per la stampa) - RIMOSSO SU RICHIESTA BUSINESS

    const handleStampa = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>Relazione Tecnica - ${worker?.cognome || ''}</title>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 3px solid #1e293b; margin-bottom: 30px; padding-bottom: 15px; }
              .header h2 { margin: 0; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; font-size: 18px; }
              .sub-header { font-size: 14px; color: #666; margin-top: 5px; font-weight: bold; }
              pre { white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; font-size: 13px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
              @media print { body { padding: 20px; } .no-print { display: none; } pre { border: none; padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Prospetto Analitico Differenze Retributive</h2>
              <div class="sub-header">CONTRATTO DI RIFERIMENTO: ${worker?.profilo || 'ND'}</div>
            </div>
            
            <pre>${testoCompleto}</pre>
          </body>
        </html>
      `);
            printWindow.document.close();
            printWindow.print();
        }
    };
    const handleExportWord = () => {
        // --- 1. Ricalcolo Variabili ---
        const tettoGiorni = includeExFest ? 32 : 28;
        const gt = totals?.grandTotal || totals || {};
        const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
        const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
        const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;
        const nettoVal = (Number(lordoVal) - (showPercepito ? Number(percepitoVal) : 0)) + (includeTickets ? Number(ticketVal) : 0);

        let anniAttivi = (worker?.anni || [])
            .filter((a: AnnoDati) => Number(a.daysWorked) > 0 && Number(a.year) >= startClaimYear)
            .map((a: AnnoDati) => Number(a.year))
            .sort((a: number, b: number) => a - b);
        anniAttivi = [...new Set(anniAttivi)];
        if (anniAttivi.length === 0) anniAttivi = [startClaimYear, new Date().getFullYear()];
        const inizioPeriodo = startClaimYear;
        const finePeriodo = anniAttivi[anniAttivi.length - 1];

        // --- 2. Utilizzo Helpers Centralizzati per HTML Word ---
        const voci = generaVociRaggruppate(worker);
        const esempio = generaEsempioDinamico(worker, startClaimYear, tettoGiorni);
        const spiegazione = generaSpiegazioneRisultato(includeTickets, showPercepito);

        // --- 3. STRUTTURA XML WORD IMPAGINATA IN STILE ATTO ---
        const wordHtml = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>Relazione Tecnica</title>
                <style>
                    @page { size: 21cm 29.7cm; margin: 3cm 2.5cm 3cm 2.5cm; mso-page-orientation: portrait; }
                    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000000; line-height: 1.5; }
                    p { margin-top: 0; margin-bottom: 12pt; text-align: justify; }
                    h2 { text-align: center; font-size: 15pt; font-weight: bold; text-transform: uppercase; margin-bottom: 5pt; }
                    .subtitle { text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 30pt; border-bottom: 1px solid #000; padding-bottom: 10pt; }
                    .section-title { font-weight: bold; text-transform: uppercase; margin-top: 20pt; margin-bottom: 10pt; font-size: 12pt; color: #1e293b; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
                    ul { margin-top: 5pt; margin-bottom: 15pt; padding-left: 30pt; text-align: justify; }
                    li { margin-bottom: 5pt; text-align: justify; }
                    table { width: 100%; border-collapse: collapse; }
                </style>
            </head>
            <body>
                <h2>RELAZIONE TECNICA DESCRITTIVA - SINTESI E METODOLOGIA</h2>
                <div class="subtitle">CONTRATTO DI RIFERIMENTO: ${worker?.profilo || 'ND'}</div>
                
                <table style="width: 100%; margin-bottom: 20px; border: 1px solid #000; padding: 10px;">
                    <tr><td style="width: 150px; font-weight: bold;">Pratica di:</td><td>${worker?.cognome || ''} ${worker?.nome || ''}</td></tr>
                    <tr><td style="font-weight: bold;">Periodo Esaminato:</td><td>Dal ${inizioPeriodo} al ${finePeriodo}</td></tr>
                </table>

                <p class="section-title">1. LA PREMESSA: PERCHÉ CHIEDIAMO QUESTE SOMME</p>
                <p>La legge europea (Direttiva 2003/88/CE) e la Suprema Corte di Cassazione (Sentenza n. 20216/2022) stabiliscono un principio fondamentale: quando un lavoratore va in ferie, ha il diritto di riposarsi senza subire alcuna penalizzazione economica rispetto al normale svolgimento dell'attività lavorativa.</p>
                <p>Durante l'anno, il lavoratore in esame percepisce regolarmente indennità connesse a disagi, turni notturni, festivi e altre voci legate al proprio profilo. La mancata erogazione di tali indennità in costanza di ferie determina un'evidente sperequazione economica, oggetto della presente richiesta di integrazione.</p>

                <p class="section-title">2. LE VOCI ANALIZZATE (Rif. Allegato "Tabella 2 - Riepilogo Voci Variabili")</p>
                <p>Per quantificare il credito, sono stati esaminati minuziosamente i cedolini paga forniti. Come dettagliato nella "Tabella 2" dei conteggi, sono state isolate esclusivamente le "voci ricorrenti e continuative", escludendo tassativamente rimborsi spese, elargizioni una tantum o arretrati non pertinenti.</p>
                <p>Nello specifico del profilo lavorativo, sono state computate le seguenti indennità:</p>
                <ul>${voci.html}</ul>

                <p class="section-title">3. IL METODO DI CALCOLO (Rif. Allegato "Tabella 1 - Calcolo Differenze")</p>
                <p>A garanzia di inattaccabilità contabile, il sistema ha applicato il <b>"Criterio della Media Storica"</b> (Rif. Cass. 20216/2022). Il valore di una giornata feriale è stato calcolato estraendo la media matematica dell'anno solare precedente.</p>
                ${esempio.html}

                <p class="section-title">4. L'APPLICAZIONE MENSILE (Rif. Allegato "Tabella 3 - Dettaglio Analitico")</p>
                <p>Come documentato analiticamente nella "Tabella 3", il procedimento è stato reiterato per ogni singolo mese in cui il dipendente ha fruito di ferie.</p>
                ${spiegazione.html}

                <p class="section-title">5. CONCLUSIONI (Rif. Allegato "Prospetto Ufficiale di Ricalcolo")</p>
                <p>Le risultanze delle elaborazioni analitiche di cui sopra convergono nel documento conclusivo denominato "Riepilogo Somme Richieste", che certifica senza ombra di dubbio gli importi esatti riportati nello specchietto sottostante.</p>

                <br clear="all" style="page-break-before:always" />

                <p class="section-title" style="text-align: center; font-size: 14pt; margin-top: 40pt;">RIEPILOGO DEGLI IMPORTI</p>
                
                <table style="width: 80%; margin: 0 auto; border: 2px solid #000; padding: 10pt;">
                    <tr>
                        <td style="padding: 15pt; width: 70%;"><b>+ DIFFERENZE LORDE MATURATE:</b></td>
                        <td style="text-align: right; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(lordoVal)}</td>
                    </tr>
                    ${showPercepito ? `
                    <tr>
                        <td style="padding: 15pt; border-top: 1px solid #ccc;"><b>- IMPORTO GIÀ PERCEPITO IN BUSTA:</b></td>
                        <td style="text-align: right; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(percepitoVal)}</td>
                    </tr>` : ''}
                    ${includeTickets ? `
                    <tr>
                        <td style="padding: 15pt; border-top: 1px solid #ccc;"><b>+ CREDITO BUONI PASTO NON EROGATI:</b></td>
                        <td style="text-align: right; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(ticketVal)}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding: 15pt; border-top: 2px solid #000; background-color: #f2f2f2;">
                            <b style="font-size: 14pt;">TOTALE CREDITO ${(!showPercepito && !includeTickets) ? 'LORDO' : 'NETTO'} SPETTANTE:</b>
                        </td>
                        <td style="text-align: right; padding: 15pt; border-top: 2px solid #000; background-color: #f2f2f2; font-weight: bold; font-size: 14pt;">
                            € ${fmt(nettoVal)}
                        </td>
                    </tr>
                </table>

            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Relazione_Tecnica_${worker?.cognome || 'Ricorrente'}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = async () => {
        const nominativo = `${worker?.cognome || ''} ${worker?.nome || ''}`.trim();
        const tettoGiorni = includeExFest ? 32 : 28;

        // 1. Estrazione codici dinamici (dinamica e sicura)
        const specificColumns = getColumnsByProfile(worker?.profilo, worker?.eliorType);
        const codiciArray = specificColumns
            .map((c: any) => c.id)
            .filter((id: string) => !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(id))
            .sort();

        const mesi = worker?.anni || [];

        // 2. Ordinamento temporale
        const mesiOrdinati = [...mesi].sort((a: AnnoDati, b: AnnoDati) => {
            if (a.year !== b.year) return Number(a.year) - Number(b.year);
            const mesiNomi = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
            return mesiNomi.indexOf(a.month.toUpperCase()) - mesiNomi.indexOf(b.month.toUpperCase());
        });

        // 3. Calcoli N-1 preparatori
        const datiAnnuali: Record<number, { totVoci: number, ggLav: number, ferieGodute: number }> = {};
        mesiOrdinati.forEach((m: AnnoDati) => {
            const anno = Number(m.year);
            if (!datiAnnuali[anno]) datiAnnuali[anno] = { totVoci: 0, ggLav: 0, ferieGodute: 0 };
            
            const ggLavMese = parseLocalFloat(m.daysWorked);
            
            if (ggLavMese > 0) {
                let totMese = 0;
                codiciArray.forEach(cod => {
                    totMese += m[cod] ? parseLocalFloat(m[cod]) : 0;
                });
                datiAnnuali[anno].totVoci += totMese;
                datiAnnuali[anno].ggLav += ggLavMese;
            }
            
            if (anno >= startClaimYear) {
                datiAnnuali[anno].ferieGodute += parseLocalFloat(m.daysVacation);
            }
        });

        // --- MAPPA COLONNE ---
        // Se non ci sono codici, garantiamo almeno una larghezza di base
        const lastColLeft = 7 + codiciArray.length;
        const colSeparator = lastColLeft + 1;
        const startColRight = colSeparator + 1;
        const endColRight = startColRight + 5;

        // --- CREAZIONE WORKBOOK EXCELJS ---
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Prospetto CTU', {
            views: [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 4 }],
            properties: { outlineProperties: { summaryBelow: false, summaryRight: false } }
        });

        const borderThin: any = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        const numEuroContabile = '_-"€"* #,##0.00_-;-"€"* #,##0.00_-;_-"€"* "-"??_-;_-@_-';

        // Riga 1: Titolo Generale
        sheet.mergeCells(1, 1, 1, endColRight);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = `RELAZIONE TECNICA E PROSPETTO ANALITICO DIFFERENZE RETRIBUTIVE - ${nominativo.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 35;

        sheet.getRow(2).height = 10;

        // Riga 3: Macro-Sezioni
        sheet.mergeCells(3, 1, 3, lastColLeft);
        const headerLeft = sheet.getCell(3, 1);
        headerLeft.value = "DATI ESTRATTI DAI CEDOLINI MENSILI E INDENNITÀ PERCEPITE";
        headerLeft.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        headerLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } };
        headerLeft.alignment = { vertical: 'middle', horizontal: 'center' };
        headerLeft.border = borderThin;

        sheet.mergeCells(3, startColRight, 3, endColRight);
        const headerRight = sheet.getCell(3, startColRight);
        headerRight.value = "MOTORE DI CALCOLO: INCIDENZA MEDIA STORICA (ANNO N-1)";
        headerRight.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF385723' } };
        headerRight.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRight.border = borderThin;

        // Riga 4: Intestazioni di Colonna
        const headers = ["ANNO", "MESE", "GG LAV", "FERIE", "TICKET", "ARRETR.", "NOTE"];
        codiciArray.forEach(c => headers.push(`Cod.\n${c}`));

        headers.forEach((h, index) => {
            const cell = sheet.getCell(4, index + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        sheet.getCell(4, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };

        const rightHeaders = ["ANNO\nRIF.", "TOTALE VOCI\n(Anno N-1)", "GG LAV\n(Anno N-1)", "MEDIA\nGIORNALIERA", `FERIE GODUTE\n(Max ${tettoGiorni} gg)`, "CREDITO\nSPETTANTE"];
        rightHeaders.forEach((h, index) => {
            const cell = sheet.getCell(4, startColRight + index);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        sheet.getRow(4).height = 45;

        // ==========================================
        // SCRITTURA DATI E FORMULE (CON SUBTOTALI ANNUALI)
        // ==========================================
        const tuttiGliAnni = Array.from(new Set(mesiOrdinati.map(m => Number(m.year)))).sort((a, b) => a - b);
        let currentRow = 5;

        tuttiGliAnni.forEach(anno => {
            const mesiDellAnno = mesiOrdinati.filter(m => Number(m.year) === anno);
            const rigaSummary = currentRow;
            const startRowMesi = rigaSummary + 1;
            const endRowMesi = rigaSummary + mesiDellAnno.length;

            // --- 1. RIGA RIASSUNTIVA DELL'ANNO (VISIBILE) ---
            // Uniamo solo Anno e Mese per il titolo, lasciando libere le altre colonne per i Subtotali
            sheet.mergeCells(rigaSummary, 1, rigaSummary, 2);
            const cellSummary = sheet.getCell(rigaSummary, 1);
            cellSummary.value = `► ANNO ${anno}`;
            cellSummary.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
            cellSummary.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
            cellSummary.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cellSummary.border = borderThin;
            sheet.getCell(rigaSummary, 2).border = borderThin;

            // Inserimento formule SOMMA() per i dati del lato sinistro
            for (let colIndex = 3; colIndex <= lastColLeft; colIndex++) {
                const cell = sheet.getCell(rigaSummary, colIndex);
                const colLetter = sheet.getColumn(colIndex).letter;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
                cell.border = borderThin;
                cell.font = { bold: true };

                // Evitiamo di sommare la colonna NOTE (7)
                if (colIndex !== 7) {
                    cell.value = { formula: `SUM(${colLetter}${startRowMesi}:${colLetter}${endRowMesi})` };
                    if (colIndex >= 5 && colIndex !== 7) cell.numFmt = numEuroContabile; // Formato valuta per Ticket, Arretrati e Codici
                }
            }

            sheet.getCell(rigaSummary, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

            // Motore di Calcolo di destra
            if (anno >= startClaimYear) {
                const annoPrec = anno - 1;
                const datiPrec = datiAnnuali[annoPrec];
                const totVociN1 = datiPrec ? datiPrec.totVoci : 0;
                const ggLavN1 = datiPrec ? datiPrec.ggLav : 0;
                const ferieCalcolate = Math.min(datiAnnuali[anno].ferieGodute || 0, tettoGiorni);

                const colTot = sheet.getColumn(startColRight + 1).letter;
                const colGG = sheet.getColumn(startColRight + 2).letter;
                const colMedia = sheet.getColumn(startColRight + 3).letter;
                const colFerie = sheet.getColumn(startColRight + 4).letter;

                sheet.getCell(rigaSummary, startColRight).value = anno;
                sheet.getCell(rigaSummary, startColRight).font = { bold: true };
                sheet.getCell(rigaSummary, startColRight).alignment = { horizontal: 'center' };

                sheet.getCell(rigaSummary, startColRight + 1).value = totVociN1;
                sheet.getCell(rigaSummary, startColRight + 1).numFmt = numEuroContabile;

                sheet.getCell(rigaSummary, startColRight + 2).value = ggLavN1;
                sheet.getCell(rigaSummary, startColRight + 2).alignment = { horizontal: 'center' };

                const cellMedia = sheet.getCell(rigaSummary, startColRight + 3);
                cellMedia.value = ggLavN1 > 0 ? { formula: `IFERROR(${colTot}${rigaSummary}/${colGG}${rigaSummary}, 0)` } : 0;
                cellMedia.numFmt = numEuroContabile;

                sheet.getCell(rigaSummary, startColRight + 4).value = ferieCalcolate;
                sheet.getCell(rigaSummary, startColRight + 4).alignment = { horizontal: 'center' };

                const cellCredito = sheet.getCell(rigaSummary, startColRight + 5);
                cellCredito.value = { formula: `${colMedia}${rigaSummary}*${colFerie}${rigaSummary}` };
                cellCredito.numFmt = numEuroContabile;
                cellCredito.font = { bold: true };
                cellCredito.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }; // Verde chiaro

                for (let j = startColRight; j <= endColRight; j++) {
                    sheet.getCell(rigaSummary, j).border = borderThin;
                }
            } else {
                for (let j = startColRight; j <= endColRight; j++) {
                    sheet.getCell(rigaSummary, j).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    sheet.getCell(rigaSummary, j).border = borderThin;
                }
            }
            currentRow++;

            // --- 2. RIGHE DEI MESI (RAGGRUPPATE / NASCOSTE) ---
            mesiDellAnno.forEach((m: AnnoDati) => {
                const rowMese = sheet.getRow(currentRow);

                sheet.getCell(currentRow, 1).value = Number(m.year);
                sheet.getCell(currentRow, 2).value = m.month;
                sheet.getCell(currentRow, 3).value = parseLocalFloat(m.daysWorked);
                sheet.getCell(currentRow, 4).value = parseLocalFloat(m.daysVacation);

                sheet.getCell(currentRow, 5).value = parseLocalFloat(m.ticket);
                sheet.getCell(currentRow, 5).numFmt = numEuroContabile;

                sheet.getCell(currentRow, 6).value = parseLocalFloat(m.arretrati);
                sheet.getCell(currentRow, 6).numFmt = numEuroContabile;

                const cellNote = sheet.getCell(currentRow, 7);
                cellNote.value = m.note || "";
                cellNote.alignment = { wrapText: true, vertical: 'middle' };

                codiciArray.forEach((cod, idx) => {
                    const val = m[cod] ? parseLocalFloat(m[cod]) : 0;
                    const cell = sheet.getCell(currentRow, 8 + idx);
                    cell.value = val;
                    cell.numFmt = numEuroContabile;
                });

                for (let j = 1; j <= lastColLeft; j++) {
                    sheet.getCell(currentRow, j).border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
                }

                sheet.getCell(currentRow, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

                rowMese.outlineLevel = 1; // Nasconde i mesi sotto il livello dell'anno

                currentRow++;
            });
        });

        // ==========================================
        // QUADRO DEI TOTALI FINALI BLINDATI
        // ==========================================
        const rowTotali = currentRow + 1;
        const colCreditoLetter = sheet.getColumn(endColRight).letter;

        sheet.mergeCells(rowTotali, startColRight, rowTotali, endColRight - 1);
        const cellLabelTot = sheet.getCell(rowTotali, startColRight);
        cellLabelTot.value = "TOTALE DIFFERENZE LORDE MATURATE:";
        cellLabelTot.font = { bold: true, size: 12 };
        cellLabelTot.alignment = { horizontal: 'right', vertical: 'middle' };

        const cellTotLordo = sheet.getCell(rowTotali, endColRight);
        // Usiamo SUBTOTAL invece di SUM per non sommare i totali doppi se Excel fa confusione con le righe raggruppate
        const arrayRigheTotali = tuttiGliAnni.map((anno, index) => 5 + index + mesiOrdinati.filter(m => Number(m.year) < anno).length).join(',');

        if (tuttiGliAnni.length > 0) {
            cellTotLordo.value = { formula: `SUM(${colCreditoLetter}5:${colCreditoLetter}${currentRow - 1})/2` }; // Divide per 2 perché somma sia le righe nascoste che i subtotali
        } else {
            cellTotLordo.value = 0;
        }

        cellTotLordo.numFmt = numEuroContabile;
        cellTotLordo.font = { bold: true, size: 13, color: { argb: 'FF000000' } };
        cellTotLordo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
        cellTotLordo.border = { top: { style: 'double' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
        sheet.getRow(rowTotali).height = 25;

        // --- IMPOSTAZIONE LARGHEZZA COLONNE AUTOMATIZZATA ---
        sheet.getColumn(1).width = 9;  // Anno
        sheet.getColumn(2).width = 14; // Mese
        sheet.getColumn(3).width = 10; // GG Lav
        sheet.getColumn(4).width = 10; // Ferie
        sheet.getColumn(5).width = 13; // Ticket
        sheet.getColumn(6).width = 13; // Arretrati
        sheet.getColumn(7).width = 30; // Note

        for (let i = 0; i < codiciArray.length; i++) {
            sheet.getColumn(8 + i).width = 13; // Codici Economici
        }

        sheet.getColumn(colSeparator).width = 2; // Colonna divisoria

        sheet.getColumn(startColRight).width = 10;      // Anno Rif
        sheet.getColumn(startColRight + 1).width = 19; // Totale N-1
        sheet.getColumn(startColRight + 2).width = 13; // GG N-1
        sheet.getColumn(startColRight + 3).width = 18; // Media
        sheet.getColumn(startColRight + 4).width = 16; // Ferie Max
        sheet.getColumn(endColRight).width = 20;       // Credito

        // Salvataggio File Fisico
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Prospetto_Peritale_${worker?.cognome || 'Pratica'}.xlsx`);
    };
    const handleCopia = () => {
        navigator.clipboard.writeText(testoCompleto);
        setCopiato(true);
        setTimeout(() => setCopiato(false), 2000);
    };

    return (
        // Sfondo con Glassmorphism avanzato
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xl font-sans transition-all"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30, rotateX: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 20 }}
                // Contenitore con effetto vetro, bordi illuminati e ombra profonda
                className="bg-white/95 dark:bg-slate-900/90 w-full max-w-4xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-indigo-900/20 overflow-hidden flex flex-col max-h-[95vh] border border-white/60 dark:border-slate-700/50 backdrop-blur-2xl"
            >
                {/* HEADER - Floating Style */}
                <div className="px-8 py-5 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <motion.div
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="p-3 bg-gradient-to-br from-indigo-50 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 rounded-2xl border border-indigo-200/50 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        >
                            <PenTool className="w-6 h-6" />
                        </motion.div>
                        <div>
                            <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight">
                                Relazione Tecnica Peritale
                            </h2>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">
                                {worker?.profilo || 'ND'} <span className="mx-2 text-slate-300 dark:text-slate-600">|</span> {worker?.cognome || ''} {worker?.nome || ''}
                            </p>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </motion.button>
                </div>

                {/* BODY - Il vero Foglio A4 3D */}
                <div className="p-6 sm:p-10 overflow-y-auto flex-1 relative bg-slate-100/50 dark:bg-slate-950/50 scroll-smooth">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="max-w-3xl mx-auto"
                    >
                        {/* Effetto carta tridimensionale */}
                        <div className="bg-white dark:bg-[#0f172a] p-10 sm:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] ring-1 ring-slate-900/5 dark:ring-white/10 rounded-sm relative overflow-hidden">
                            {/* Bordo colorato finto-legale in alto (Opzionale, dà un tocco pazzesco) */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 opacity-90"></div>

                            <pre className="whitespace-pre-wrap font-serif text-[14px] sm:text-[15.5px] text-slate-800 dark:text-slate-200 leading-relaxed">
                                {testoCompleto}
                            </pre>
                        </div>
                    </motion.div>
                </div>

                {/* FOOTER - Staggered Animations & Micro-Interactions */}
                <div className="px-8 py-5 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">

                    {/* Utility Button (Sinistra) */}
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleCopia}
                        className="w-full sm:w-auto px-5 py-2.5 flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold transition-colors duration-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm"
                    >
                        {copiato ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copiato ? 'Copiato!' : 'Copia Testo'}
                    </motion.button>

                    {/* Esportazioni (Destra) - Con animazione a cascata */}
                    <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleExportWord}
                            className="flex-1 sm:flex-none px-5 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20"
                        >
                            <FileText className="w-4 h-4" /> Word
                        </motion.button>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleExportExcel}
                            className="flex-1 sm:flex-none px-5 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </motion.button>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleStampa}
                            className="w-full sm:w-auto px-7 py-2.5 flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold transition-colors duration-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 border border-transparent dark:border-white/10"
                        >
                            <Printer className="w-4 h-4" /> Stampa PDF
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};