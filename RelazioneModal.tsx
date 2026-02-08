import React, { useState } from 'react';
// AGGIUNTO PenTool agli import
import { X, Printer, Copy, CheckCircle, PenTool } from 'lucide-react';
import { motion } from 'framer-motion';
import { YEARS, AnnoDati } from './types';

// --- HELPER DI FORMATTAZIONE SICURA ---
const fmt = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generaRelazioneTestuale = (worker: any, totali: any, includeExFest: boolean) => {
    const oggi = new Date().toLocaleDateString('it-IT');
    const tettoGiorni = includeExFest ? 32 : 28;

    // --- PROTEZIONE DATI ---
    const gt = totali?.grandTotal || {};

    // Recupero valori sicuro
    const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
    const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
    const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;

    // Netto finale
    const nettoVal = (Number(lordoVal) - Number(percepitoVal)) + Number(ticketVal);

    // --- GESTIONE ANNI ---
    const yearsSafe = (Array.isArray(YEARS) && YEARS.length > 0) ? YEARS : [2008, 2025];
    const inizioPeriodo = yearsSafe[0];
    const finePeriodo = yearsSafe[yearsSafe.length - 1];

    // --- ESTRAZIONE NOTE ---
    let sezioneNote = "";
    if (worker?.anni && Array.isArray(worker.anni)) {
        const noteTrovate = worker.anni
            .filter((r: AnnoDati) => r.note && r.note.trim() !== "")
            .sort((a: AnnoDati, b: AnnoDati) => (a.year || 0) - (b.year || 0));

        if (noteTrovate.length > 0) {
            sezioneNote = "\nEVENTI E ANNOTAZIONI SPECIFICHE:\n";
            noteTrovate.forEach((r: AnnoDati) => {
                sezioneNote += `- ${r.month} ${r.year}: ${r.note}\n`;
            });
            sezioneNote += "--------------------------------------------------\n";
        }
    }

    // --- INTEGRAZIONE TESTO LEGALE ---
    let elencoVoci = "";

    if (worker?.profilo === 'RFI' || !worker?.profilo || worker?.profilo === 'ND') {
        elencoVoci = `
VOCI VARIABILI INCLUSE (Riferimento CCNL/Contratti Aziendali):
- Straordinario Diurno non recuperato (Cod. 0152)
- Indennità Lavoro Notturno (Cod. 0421, 1130)
- Indennità di Chiamata/Disponibilità (Cod. 0470, 0496)
- Compenso per Reperibilità (Cod. 0482, 0584)
- Indennità di Linea (Cod. 0687)
- Trasferta (Cod. 0AA1)
- Compenso Cantiere Notte (Cod. 0423)
- Indennità Orario Spezzato (Cod. 0576)
- Straordinari Vari (Cod. 0919, 0920, 0932, 0933, 0995, 0996)
- Ticket Restaurant / Buoni Pasto
`;
    } else if (worker?.profilo === 'REKEEP') {
        elencoVoci = "Voci incluse: Indennità specifiche appalto FS/Multiservizi (Turni non cadenzati, Ind. Sussidiaria, Straordinari, Maggiorazioni).";
    } else {
        elencoVoci = "Voci incluse: Tipiche della Ristorazione a Bordo (Diaria Scorta, Ind. Cassa, Lavoro Domenicale/Notturno).";
    }

    const dettagliMetodologia = `
METODOLOGIA DI CALCOLO (Rif. Cass. 23/6/2022 n. 20216):
Il conteggio è stato costruito su due elementi fondamentali:

1. DIVISORE: Il numero delle effettive giornate lavorative annuali, ricavato dalle buste paga.
2. MOLTIPLICATORE: Il numero dei giorni di ferie annualmente spettanti, nel limite comunque di ${tettoGiorni} giorni (periodo minimo protetto ex Art. 36 Cost. e Dir. 2003/88/CE).

PROCEDIMENTO ANALITICO:
- È stata estrapolata, busta per busta, ogni singola voce variabile della retribuzione.
- È stata effettuata la sommatoria annuale di tali voci.
- Dividendo tale somma per il numero delle effettive giornate lavorative, è stato ricavato il valore medio giornaliero.
- Tale valore medio è stato moltiplicato per i giorni di ferie effettivamente fruiti (ridotti al tetto di ${tettoGiorni} ove eccedenti).
- Infine, è stato detratto quanto già percepito allo stesso titolo.
`;

    return `
RELAZIONE TECNICA DI RICALCOLO CONTABILE - ${worker?.profilo || 'ND'}
OGGETTO: Integrazione Indennità Feriale - Periodo ${inizioPeriodo}-${finePeriodo}

DATI DEL LAVORATORE
Nominativo: ${worker?.cognome || ''} ${worker?.nome || ''}
Azienda/Contratto: ${worker?.profilo || 'ND'}
Qualifica: ${worker?.ruolo || 'Personale Operativo'}
ID Pratica: #W-${worker?.id || 'ND'}

PREMESSA GIURIDICA
La presente analisi determina le differenze retributive maturate durante le ferie, applicando il principio di onnicomprensività della retribuzione feriale, previa disapplicazione delle clausole contrattuali limitative per contrarietà a norme imperative.

${dettagliMetodologia}

${elencoVoci}

${sezioneNote}

RISULTANZE CONTABILI
Si certifica che per il lavoratore risulta maturato il seguente credito:

- DIFFERENZE RETRIBUTIVE (Lordo): ..... € ${fmt(lordoVal)}
- MENO GIÀ PERCEPITO: ................. € ${fmt(percepitoVal)}
- CREDITO BUONI PASTO: ................ € ${fmt(ticketVal)}

--------------------------------------------------
TOTALE CREDITO NETTO SPETTANTE: ....... € ${fmt(nettoVal)} 

Documento generato il: ${oggi}
`;
};

export const RelazioneModal = ({ isOpen, onClose, worker, totals, includeExFest = false }: any) => {
    const [copiato, setCopiato] = useState(false);

    if (!isOpen) return null;

    // Generazione sicura del testo
    let testoCompleto = "";
    try {
        testoCompleto = generaRelazioneTestuale(worker, totals, includeExFest);
    } catch (err) {
        console.error("Errore generazione testo:", err);
        testoCompleto = "Errore nella generazione dei dati. Controllare la console.";
    }

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
            
            <pre>${testoCompleto.replace('EVENTI E ANNOTAZIONI SPECIFICHE:', '')}</pre>
            
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

    const handleCopia = () => {
        navigator.clipboard.writeText(testoCompleto);
        setCopiato(true);
        setTimeout(() => setCopiato(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md font-sans">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                // Aggiunto gradiente sottile in dark mode
                className="bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-700/50"
            >
                {/* HEADER: Icona Penna migliorata */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900/50 relative z-10">
                    <div className="flex items-center gap-4">
                        {/* Contenitore icona con gradiente e bordo */}
                        <div className="p-3 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                            <PenTool className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold dark:text-white leading-none tracking-tight">Relazione Tecnica</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 uppercase font-bold tracking-widest">Profilo: {worker?.profilo || 'ND'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* BODY: Area testo migliorata */}
                <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 flex-1 relative">
                    {/* Box testo con sfondo semitrasparente in dark mode e bordi più curati */}
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-sm p-8 shadow-sm dark:shadow-inner border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs dark:text-slate-300 leading-relaxed relative z-10">
                        <pre className="whitespace-pre-wrap">{testoCompleto}</pre>
                    </div>
                </div>

                {/* FOOTER: Pulsanti con effetti grafici */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end bg-white dark:bg-slate-900/50 relative z-10">
                    {/* Pulsante COPIA: Effetto hover sul bordo e testo */}
                    <button
                        onClick={handleCopia}
                        className="px-5 py-2.5 flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-semibold transition-all active:scale-95 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:shadow-sm"
                    >
                        {copiato ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copiato ? 'Copiato' : 'Copia Testo'}
                    </button>

                    {/* Pulsante STAMPA: Gradiente, ombra colorata e effetto sollevamento */}
                    <button
                        onClick={handleStampa}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all active:scale-95 hover:-translate-y-0.5"
                    >
                        <Printer className="w-4 h-4" /> Stampa PDF
                    </button>
                </div>
            </motion.div>
        </div>
    );
};