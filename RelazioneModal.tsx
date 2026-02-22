import React, { useState } from 'react';
import { X, Printer, Copy, CheckCircle, PenTool, FileText, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { motion } from 'framer-motion';
import { YEARS, AnnoDati } from './types';

// --- HELPER DI FORMATTAZIONE SICURA ---
const fmt = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generaRelazioneTestuale = (worker: any, totali: any, includeExFest: boolean, includeTickets: boolean, startClaimYear: number, showPercepito: boolean) => {
    const oggi = new Date().toLocaleDateString('it-IT');
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

    // --- ESTRAZIONE NOTE ---
    let sezioneNote = "";
    if (worker?.anni && Array.isArray(worker.anni)) {
        const noteTrovate = worker.anni
            .filter((r: AnnoDati) => r.note && r.note.trim() !== "")
            .filter((r: AnnoDati) => Number(r.year) >= inizioPeriodo)
            .sort((a: AnnoDati, b: AnnoDati) => (a.year || 0) - (b.year || 0));

        if (noteTrovate.length > 0) {
            sezioneNote = "\nEVENTI RILEVANTI E ANNOTAZIONI:\n";
            noteTrovate.forEach((r: AnnoDati) => {
                const cleanNote = r.note?.replace(/[\[\]]/g, '') || '';
                sezioneNote += `- ${r.month} ${r.year}: ${cleanNote}\n`;
            });
            sezioneNote += "--------------------------------------------------\n";
        }
    }

    // --- INTEGRAZIONE TESTO LEGALE ---
    let elencoVoci = "";
    if (worker?.profilo === 'RFI' || !worker?.profilo || worker?.profilo === 'ND') {
        elencoVoci = `
VOCI RETRIBUTIVE VARIABILI INCLUSE NEL CALCOLO:
L'analisi ha isolato le voci a carattere continuativo e ricorrente (Art. 64 CCNL), tra cui:

1. LAVORO NOTTURNO E FESTIVO:
   - Indennità Lavoro Notturno (Cod. 0421, 1130)
   - Festivo Notturno (Cod. 0457) [Alta Incidenza]
   - Compenso Cantiere Notte (Cod. 0423)
   - Straordinari Vari (Cod. 0919, 0920, 0932, 0933, 0995, 0996)

2. INDENNITÀ DI FUNZIONE E DISAGIO:
   - Indennità di Chiamata/Disponibilità (Cod. 0470, 0496)
   - Compenso per Reperibilità (Cod. 0482, 0584)
   - Indennità di Linea e Manutenzione (Cod. 0687, 0686)
   - Indennità Orario Spezzato (Cod. 0576)
   - Trasferta Esente (Cod. 0AA1)

3. PREMIALITÀ RICORRENTE (Novità 2024):
   - Salario Produttività Mensile (Cod. 3B70)
   - Produttività Incrementale (Cod. 3B71)
${includeTickets ? `
4. RISTORO PASTI:
   - Ticket Restaurant / Buoni Pasto (Quota Esente)` : ''}

NOTA BENE:
Sono state TASSATIVAMENTE ESCLUSE dal calcolo della media tutte le voci "Una Tantum", i rimborsi spese a piè di lista, i premi annuali non ricorrenti, la malattia, gli arretrati anni precedenti e le voci di Welfare aziendale.`;
    } else if (worker?.profilo === 'REKEEP') {
        elencoVoci = `
VOCI INCLUSE (Appalto Multiservizi/FS):
- Indennità Turni Non Cadenzati (Cod. I215FC)
- Indennità Sussidiaria (Cod. I1182C)
- Lavoro Domenicale e Notturno (Cod. I1037C, I1040C)
- Maggiorazioni e Straordinari (Cod. S1800C, M3500C)`;
    } else {
        elencoVoci = "Voci incluse: Indennità specifiche della Ristorazione a Bordo (Diaria Scorta, Ind. Cassa, Lavoro Domenicale/Notturno).";
    }

    const dettagliMetodologia = `
METODOLOGIA DI CALCOLO PERITALE (Rif. Cass. Sez. Lav. 23/6/2022 n. 20216):
Il presente prospetto determina la "Retribuzione Globale di Fatto" spettante durante le ferie, superando il concetto di retribuzione base.

CRITERI ADOTTATI:
1. PRINCIPIO DI ONNICOMPRENSIVITÀ: Inclusione di tutte le indennità collegate agli inconvenienti intrinseci alle mansioni (es. notte, turni) o alla status professionale.
2. CRITERIO DEL DIVISORE REALE: La media giornaliera è ottenuta dividendo la somma delle competenze variabili per le GIORNATE EFFETTIVAMENTE LAVORATE nel mese/anno, e non per divisori convenzionali (26 o 30), garantendo la massima precisione contabile.
3. TETTO MASSIMO DI LEGGE: Il ricalcolo è applicato sui giorni di ferie fruiti entro il limite del periodo minimo legale di ${tettoGiorni} giorni (Art. 36 Cost. e Dir. 2003/88/CE).

4. APPLICAZIONE DEL CRITERIO DELLA MEDIA STORICA (ANNO PRECEDENTE):
Al fine di rispettare il principio di comparabilità della retribuzione feriale con quella ordinaria, e in aderenza alla prassi contabile per la determinazione della "retribuzione media globale di fatto", i calcoli sono stati eseguiti applicando un criterio storico.

Nello specifico, il valore giornaliero delle voci variabili da riconoscere per i giorni di ferie goduti nell'anno N è stato determinato sulla base della media delle competenze variabili maturate dal lavoratore nell'anno precedente (N-1).
Questo metodo garantisce che la retribuzione feriale non sia influenzata dalla casualità del mese di fruizione, ma rifletta l'effettiva capacità reddituale media del dipendente, depurando il calcolo da picchi o flessioni momentanee.

PROCEDIMENTO ANALITICO:
- Estrapolazione OCR dei dati da cedolini paga originali.
- Separazione netta tra voci ricorrenti (utili) e voci straordinarie (escluse).
- Calcolo differenziale: [Media Giornaliera Storica] x [Giorni Ferie] - [Quanto già erogato].
`;

    return `
RELAZIONE TECNICA DI RICALCOLO CONTABILE - ${worker?.profilo || 'ND'}
OGGETTO: Integrazione Indennità Feriale (Mancata Retribuzione Variabile)
PERIODO DI ANALISI: ${inizioPeriodo} - ${finePeriodo}

DATI DEL RICORRENTE
Nominativo: ....... ${worker?.cognome || ''} ${worker?.nome || ''}
Matricola/ID: ..... ${worker?.id || 'ND'}
Profilo: .......... ${worker?.profilo || 'ND'} - ${worker?.ruolo || 'Personale Operativo'}

--------------------------------------------------

PREMESSA GIURIDICA
La presente perizia tecnica ha lo scopo di quantificare le differenze retributive maturate a titolo di "Retribuzione Feriale", in applicazione della giurisprudenza della Corte di Giustizia UE e della Corte di Cassazione, che sanciscono il diritto del lavoratore a percepire, durante le ferie, la retribuzione ordinaria comprensiva delle voci variabili medie.

${dettagliMetodologia}

${elencoVoci}

${sezioneNote}

RISULTANZE CONTABILI FINALI
Dall'analisi dei cedolini paga prodotti, risulta il seguente credito a favore del lavoratore:

+ DIFFERENZE LORDE MATURATE: .......... € ${fmt(lordoVal)}
  (Calcolate su indennità fisse e variabili ricorrenti)
${showPercepito ? `
- IMPORTO GIÀ PERCEPITO: .............. € ${fmt(percepitoVal)}
  (A titolo di indennità feriale base o acconti)` : ''}
${includeTickets ? `
+ CREDITO BUONI PASTO: ................ € ${fmt(ticketVal)}
  (Ticket maturati durante le ferie e non goduti)` : ''}

==================================================
  TOTALE CREDITO LORDO SPETTANTE: ..... € ${fmt(nettoVal)}
==================================================

Si rilascia il presente conteggio per gli usi consentiti dalla legge.

Luogo e Data: Foggia, ${oggi}
Firma del Tecnico: __________________________
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
    // Prepariamo l'HTML per le note (per la stampa)
    let noteSectionHTML = '';
    if (worker?.anni && Array.isArray(worker.anni)) {
        const noteRowsHTML = worker.anni
            .filter((r: AnnoDati) => r.note && r.note.trim() !== "")
            .sort((a: AnnoDati, b: AnnoDati) => (a.year || 0) - (b.year || 0))
            .map((r: AnnoDati) => `<tr><td style="padding:4px; border-bottom:1px solid #eee;"><b>${r.month} ${r.year}</b></td><td style="padding:4px; border-bottom:1px solid #eee;">${r.note}</td></tr>`)
            .join('');

        if (noteRowsHTML) {
            noteSectionHTML = `<div style="margin-top: 20px; padding: 15px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 5px;">
              <h3 style="margin-top:0; font-size:14px; color:#876800;">ANNOTAZIONI ED EVENTI</h3>
              <table style="width:100%; font-size:12px; border-collapse:collapse;">${noteRowsHTML}</table>
            </div>`;
        }
    }

    const handleStampa = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            // Estraiamo il testo puro senza la sezione note per evitare doppioni
            // Visto che "sezioneNote" era definita sopra, "tagliamo" il testo usando un marcatore
            const testoSenzaNote = testoCompleto.split('EVENTI RILEVANTI E ANNOTAZIONI:')[0]
                + testoCompleto.split('--------------------------------------------------\n').pop();

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
              .footer { margin-top: 50px; border-top: 2px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; }
              .signature-line { margin-top: 40px; border-top: 1px solid #000; width: 200px; }
              @media print { body { padding: 20px; } .no-print { display: none; } pre { border: none; padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Prospetto Analitico Differenze Retributive</h2>
              <div class="sub-header">CONTRATTO DI RIFERIMENTO: ${worker?.profilo || 'ND'}</div>
            </div>
            
            <pre>${testoSenzaNote}</pre>
            
            ${noteSectionHTML}

            <div class="footer">
              <div>Data: ${new Date().toLocaleDateString('it-IT')}</div>
              <div style="text-align: center;">
                <p>Firma del Tecnico</p>
                <div class="signature-line"></div>
              </div>
            </div>
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

        const fmt = (val: any) => Number(val).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // --- 2. Costruzione Tabella Note ---
        let noteWordHTML = '';
        if (worker?.anni && Array.isArray(worker.anni)) {
            const noteRows = worker.anni
                .filter((r: AnnoDati) => r.note && r.note.trim() !== "")
                .sort((a: AnnoDati, b: AnnoDati) => (a.year || 0) - (b.year || 0))
                .map((r: AnnoDati) => `
                    <tr>
                        <td style="border: 1px solid #000; padding: 8px; width: 25%; font-weight: bold; vertical-align: top; background-color: #f9f9f9;">${r.month} ${r.year}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: justify; vertical-align: top;">${r.note}</td>
                    </tr>
                `).join('');

            if (noteRows) {
                noteWordHTML = `
                    <br clear="all" style="page-break-before:always" />
                    <p style="font-size: 14pt; text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 20pt;">Annotazioni ed Eventi Rilevanti</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11pt; border: 1px solid #000; margin-bottom: 20pt;">
                        ${noteRows}
                    </table>
                `;
            }
        }

        // --- 3. Voci Variabili Dinamiche con Elenchi Puntati Veri ---
        let vociHTML = '';
        if (worker?.profilo === 'RFI' || !worker?.profilo || worker?.profilo === 'ND') {
            vociHTML = `
                <p><b>VOCI RETRIBUTIVE VARIABILI INCLUSE NEL CALCOLO:</b><br>
                L'analisi ha isolato le voci a carattere continuativo e ricorrente (Art. 64 CCNL), tra cui:</p>
                
                <ul style="margin-top: 5pt; margin-bottom: 15pt; padding-left: 30pt;">
                    <li style="margin-bottom: 5pt; text-align: justify;"><b>LAVORO NOTTURNO E FESTIVO:</b> Indennità Lavoro Notturno (Cod. 0421, 1130), Festivo Notturno (Cod. 0457) [Alta Incidenza], Compenso Cantiere Notte (Cod. 0423), Straordinari Vari (Cod. 0919, 0920, 0932, 0933, 0995, 0996).</li>
                    <li style="margin-bottom: 5pt; text-align: justify;"><b>INDENNITÀ DI FUNZIONE E DISAGIO:</b> Indennità di Chiamata/Disponibilità (Cod. 0470, 0496), Compenso per Reperibilità (Cod. 0482, 0584), Indennità di Linea e Manutenzione (Cod. 0687, 0686), Indennità Orario Spezzato (Cod. 0576), Trasferta Esente (Cod. 0AA1).</li>
                    <li style="margin-bottom: 5pt; text-align: justify;"><b>PREMIALITÀ RICORRENTE (Novità 2024):</b> Salario Produttività Mensile (Cod. 3B70), Produttività Incrementale (Cod. 3B71).</li>
                    ${includeTickets ? `<li style="margin-bottom: 5pt; text-align: justify;"><b>RISTORO PASTI:</b> Ticket Restaurant / Buoni Pasto (Quota Esente).</li>` : ''}
                </ul>
                
                <p><b>NOTA BENE:</b> Sono state TASSATIVAMENTE ESCLUSE dal calcolo della media tutte le voci "Una Tantum", i rimborsi spese a piè di lista, i premi annuali non ricorrenti, la malattia, gli arretrati anni precedenti e le voci di Welfare aziendale.</p>
            `;
        } else if (worker?.profilo === 'REKEEP') {
            vociHTML = `
                <p><b>VOCI INCLUSE (Appalto Multiservizi/FS):</b></p>
                <ul style="margin-top: 5pt; margin-bottom: 15pt; padding-left: 30pt;">
                    <li>Indennità Turni Non Cadenzati (Cod. I215FC)</li>
                    <li>Indennità Sussidiaria (Cod. I1182C)</li>
                    <li>Lavoro Domenicale e Notturno (Cod. I1037C, I1040C)</li>
                    <li>Maggiorazioni e Straordinari (Cod. S1800C, M3500C)</li>
                </ul>
            `;
        } else {
            vociHTML = `<p><b>VOCI INCLUSE:</b> Indennità specifiche della Ristorazione a Bordo (Diaria Scorta, Ind. Cassa, Lavoro Domenicale/Notturno).</p>`;
        }

        // --- 4. STRUTTURA XML WORD IMPAGINATA IN STILE ATTO ---
        const wordHtml = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>Relazione Tecnica</title>
                <style>
                    @page {
                        size: 21cm 29.7cm; /* Formato A4 */
                        margin: 3cm 2.5cm 3cm 2.5cm; /* Margini più generosi da Atto */
                        mso-page-orientation: portrait;
                    }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 12pt;
                        color: #000000;
                        line-height: 1.5;
                    }
                    p {
                        margin-top: 0;
                        margin-bottom: 12pt;
                        text-align: justify;
                    }
                    h2 {
                        text-align: center;
                        font-size: 15pt;
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-bottom: 5pt;
                    }
                    .subtitle {
                        text-align: center;
                        font-size: 12pt;
                        font-weight: bold;
                        margin-bottom: 30pt;
                        border-bottom: 1px solid #000;
                        padding-bottom: 10pt;
                    }
                    .section-title {
                        font-weight: bold;
                        text-transform: uppercase;
                        margin-top: 20pt;
                        margin-bottom: 10pt;
                        font-size: 12pt;
                    }
                    ul, ol {
                        margin-top: 5pt;
                        margin-bottom: 15pt;
                        padding-left: 30pt;
                        text-align: justify;
                    }
                    li {
                        margin-bottom: 5pt;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .info-table td {
                        padding: 4pt 0;
                        vertical-align: top;
                    }
                    .info-label {
                        width: 120pt;
                        font-weight: bold;
                    }
                    .hr-line {
                        border-bottom: 1px solid #000;
                        margin: 20pt 0;
                    }
                </style>
            </head>
            <body>
                <h2>Prospetto Analitico Differenze Retributive</h2>
                <div class="subtitle">CONTRATTO DI RIFERIMENTO: ${worker?.profilo || 'ND'}</div>
                
                <p style="text-align: center; font-weight: bold; font-size: 13pt;">
                    RELAZIONE TECNICA DI RICALCOLO CONTABILE<br>
                    <span style="font-weight: normal; font-size: 12pt;">OGGETTO: Integrazione Indennità Feriale (Mancata Retribuzione Variabile)</span><br>
                    PERIODO DI ANALISI: ${inizioPeriodo} - ${finePeriodo}
                </p>
                
                <p class="section-title">DATI DEL RICORRENTE</p>
                <table class="info-table">
                    <tr><td class="info-label">Nominativo:</td><td>${worker?.cognome || ''} ${worker?.nome || ''}</td></tr>
                    <tr><td class="info-label">Matricola/ID:</td><td>${worker?.id || 'ND'}</td></tr>
                    <tr><td class="info-label">Profilo:</td><td>${worker?.profilo || 'ND'} - ${worker?.ruolo || 'Personale Operativo'}</td></tr>
                </table>

                <div class="hr-line"></div>

                <p class="section-title">PREMESSA GIURIDICA</p>
                <p>La presente perizia tecnica ha lo scopo di quantificare le differenze retributive maturate a titolo di "Retribuzione Feriale", in applicazione della giurisprudenza della Corte di Giustizia UE e della Corte di Cassazione, che sanciscono il diritto del lavoratore a percepire, durante le ferie, la retribuzione ordinaria comprensiva delle voci variabili medie.</p>

                <p class="section-title">METODOLOGIA DI CALCOLO PERITALE (Rif. Cass. Sez. Lav. 23/6/2022 n. 20216)</p>
                <p>Il presente prospetto determina la "Retribuzione Globale di Fatto" spettante durante le ferie, superando il concetto di retribuzione base.</p>

                <p><b>CRITERI ADOTTATI:</b></p>
                <ol>
                    <li><b>PRINCIPIO DI ONNICOMPRENSIVITÀ:</b> Inclusione di tutte le indennità collegate agli inconvenienti intrinseci alle mansioni (es. notte, turni) o allo status professionale.</li>
                    <li><b>CRITERIO DEL DIVISORE REALE:</b> La media giornaliera è ottenuta dividendo la somma delle competenze variabili per le GIORNATE EFFETTIVAMENTE LAVORATE nel mese/anno, e non per divisori convenzionali (es. 26 o 30), garantendo la massima precisione contabile.</li>
                    <li><b>TETTO MASSIMO DI LEGGE:</b> Il ricalcolo è applicato sui giorni di ferie fruiti entro il limite del periodo minimo legale di ${tettoGiorni} giorni (Art. 36 Cost. e Dir. 2003/88/CE).</li>
                    <li><b>APPLICAZIONE DEL CRITERIO DELLA MEDIA STORICA (ANNO PRECEDENTE):</b><br>
                    Al fine di rispettare il principio di comparabilità della retribuzione feriale con quella ordinaria, e in aderenza alla prassi contabile per la determinazione della "retribuzione media globale di fatto", i calcoli sono stati eseguiti applicando un criterio storico.<br><br>
                    Nello specifico, il valore giornaliero delle voci variabili da riconoscere per i giorni di ferie goduti nell'anno N è stato determinato sulla base della media delle competenze variabili maturate dal lavoratore nell'anno precedente (N-1).<br>
                    Questo metodo garantisce che la retribuzione feriale non sia influenzata dalla casualità del mese di fruizione, ma rifletta l'effettiva capacità reddituale media del dipendente, depurando il calcolo da picchi o flessioni momentanee.</li>
                </ol>

                <p><b>PROCEDIMENTO ANALITICO:</b></p>
                <ul>
                    <li>Estrapolazione OCR dei dati da cedolini paga originali.</li>
                    <li>Separazione netta tra voci ricorrenti (utili) e voci straordinarie (escluse).</li>
                    <li>Calcolo differenziale: <i>[Media Giornaliera Storica] moltiplicata per [Giorni Ferie] dedotto [Quanto già erogato]</i>.</li>
                </ul>

                ${vociHTML}

                <br clear="all" style="page-break-before:always" />

                <p class="section-title" style="text-align: center; font-size: 14pt; margin-top: 40pt;">RISULTANZE CONTABILI FINALI</p>
                <p style="text-align: center; margin-bottom: 20pt;">Dall'analisi dei cedolini paga prodotti, risulta il seguente credito a favore del lavoratore:</p>

                <table style="width: 80%; margin: 0 auto; border: 2px solid #000; padding: 10pt;">
                    <tr>
                        <td style="padding: 15pt; width: 70%;">
                            <b>+ DIFFERENZE LORDE MATURATE:</b><br>
                            <i style="font-size: 10pt; color: #555;">(Calcolate su indennità fisse e variabili ricorrenti)</i>
                        </td>
                        <td style="text-align: right; vertical-align: middle; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(lordoVal)}</td>
                    </tr>
                    ${showPercepito ? `
                    <tr>
                        <td style="padding: 15pt; border-top: 1px solid #ccc;">
                            <b>- IMPORTO GIÀ PERCEPITO:</b><br>
                            <i style="font-size: 10pt; color: #555;">(A titolo di indennità feriale base o acconti)</i>
                        </td>
                        <td style="text-align: right; vertical-align: middle; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(percepitoVal)}</td>
                    </tr>` : ''}
                    ${includeTickets ? `
                    <tr>
                        <td style="padding: 15pt; border-top: 1px solid #ccc;">
                            <b>+ CREDITO BUONI PASTO:</b><br>
                            <i style="font-size: 10pt; color: #555;">(Ticket maturati durante le ferie e non goduti)</i>
                        </td>
                        <td style="text-align: right; vertical-align: middle; padding: 15pt; font-weight: bold; font-size: 13pt;">€ ${fmt(ticketVal)}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding: 15pt; border-top: 2px solid #000; background-color: #f2f2f2;">
                            <b style="font-size: 14pt;">TOTALE CREDITO LORDO SPETTANTE:</b>
                        </td>
                        <td style="text-align: right; vertical-align: middle; padding: 15pt; border-top: 2px solid #000; background-color: #f2f2f2; font-weight: bold; font-size: 14pt;">
                            € ${fmt(nettoVal)}
                        </td>
                    </tr>
                </table>

                <p style="margin-top: 30pt; text-align: center; font-style: italic;">Si rilascia il presente conteggio per gli usi consentiti dalla legge.</p>

                <table style="width: 100%; border: none; margin-top: 50pt;">
                    <tr>
                        <td style="text-align: left; border: none; vertical-align: bottom; font-size: 12pt;">
                            Foggia, lì ${new Date().toLocaleDateString('it-IT')}
                        </td>
                        <td style="text-align: right; border: none; vertical-align: bottom; font-size: 12pt;">
                            <p style="margin: 0; text-align: center; width: 200pt; float: right;">
                                Il Tecnico Incaricato<br><br><br>
                                ___________________________
                            </p>
                        </td>
                    </tr>
                </table>

                ${noteWordHTML}
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
        const codiciTrovati = new Set<string>();
        const mesi = worker?.anni || [];
        mesi.forEach((m: AnnoDati) => {
            if (m.codes && typeof m.codes === 'object') {
                Object.keys(m.codes).forEach(c => codiciTrovati.add(c));
            }
        });
        const codiciArray = Array.from(codiciTrovati).sort();

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
            let totMese = 0;
            codiciArray.forEach(cod => { totMese += m.codes && m.codes[cod] ? Number(m.codes[cod]) : 0; });
            datiAnnuali[anno].totVoci += totMese;
            datiAnnuali[anno].ggLav += (Number(m.daysWorked) || 0);
            if (anno >= startClaimYear) datiAnnuali[anno].ferieGodute += (Number(m.daysVacation) || 0);
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
                sheet.getCell(currentRow, 3).value = Number(m.daysWorked) || 0;
                sheet.getCell(currentRow, 4).value = Number(m.daysVacation) || 0;

                sheet.getCell(currentRow, 5).value = Number(m.ticketRate) || 0;
                sheet.getCell(currentRow, 5).numFmt = numEuroContabile;

                sheet.getCell(currentRow, 6).value = Number(m.arretrati) || 0;
                sheet.getCell(currentRow, 6).numFmt = numEuroContabile;

                const cellNote = sheet.getCell(currentRow, 7);
                cellNote.value = m.note || "";
                cellNote.alignment = { wrapText: true, vertical: 'middle' };

                codiciArray.forEach((cod, idx) => {
                    const val = m.codes && m.codes[cod] ? Number(m.codes[cod]) : 0;
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