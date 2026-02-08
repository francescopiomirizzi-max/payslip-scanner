import React, { useState } from 'react';
import { X, Printer, Copy, FileText, CheckCircle, PenTool } from 'lucide-react';
import { motion } from 'framer-motion';
// Se questo import fallisce, il codice sotto userà comunque un anno di default per non crashare
import { YEARS, AnnoDati } from '../../types';

// --- HELPER DI SICUREZZA (Questo impedisce il crash su .toLocaleString) ---
const fmt = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generaRelazioneTestuale = (worker: any, totali: any, includeExFest: boolean) => {
    const oggi = new Date().toLocaleDateString('it-IT');
    const tettoGiorni = includeExFest ? 32 : 28;

    // --- PROTEZIONE DATI ---
    // Se 'totali' è null, usiamo un oggetto vuoto {} per non rompere il codice
    const gt = totali?.grandTotal || {};

    // Cerchiamo i valori con TUTTI i nomi possibili (compatibilità tra TableComponent e DealMaker)
    const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
    const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
    const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;

    // Calcolo il netto per sicurezza
    const nettoVal = (lordoVal - percepitoVal) + ticketVal;

    // --- PROTEZIONE ANNI ---
    // Se YEARS non è stato importato correttamente, usiamo l'anno corrente
    const safeYears = (Array.isArray(YEARS) && YEARS.length > 0) ? YEARS : [new Date().getFullYear()];
    const inizioPeriodo = safeYears[0];
    const finePeriodo = safeYears[safeYears.length - 1];

    // --- ESTRAZIONE NOTE ---
    let sezioneNote = "";
    if (worker?.anni && Array.isArray(worker.anni)) {
        const noteTrovate = worker.anni
            .filter((r: AnnoDati) => r.note && r.note.trim() !== "")
            // Ordinamento sicuro che gestisce eventuali undefined
            .sort((a: AnnoDati, b: AnnoDati) => (a.year || 0) - (b.year || 0) || (a.monthIndex || 0) - (b.monthIndex || 0));

        if (noteTrovate.length > 0) {
            sezioneNote = "\nEVENTI E ANNOTAZIONI SPECIFICHE:\n";
            noteTrovate.forEach((r: AnnoDati) => {
                sezioneNote += `- ${r.month} ${r.year}: ${r.note}\n`;
            });
            sezioneNote += "--------------------------------------------------\n";
        }
    }

    let noteContratto = "Il calcolo si basa sulle voci accessorie standard del contratto Ferroviario.";
    if (worker?.profilo === 'REKEEP') noteContratto = "Il calcolo include le specifiche indennità di appalto previste dal CCNL Multiservizi/Ferroviario.";
    if (worker?.profilo === 'ELIOR') noteContratto = "Il calcolo considera le voci tipiche della Ristorazione a Bordo.";

    return `
RELAZIONE TECNICA DI RICALCOLO CONTABILE - ${worker?.profilo || 'ND'}
OGGETTO: Integrazione Indennità Feriale (Art. 36 Cost. - Cass. 20216/2022)
PERIODO DI RIFERIMENTO: ${inizioPeriodo} - ${finePeriodo}

1. DATI DEL LAVORATORE
Nominativo: ${worker?.cognome || ''} ${worker?.nome || ''}
Matricola Aziendale: ${worker?.id || ''}
Qualifica: ${worker?.ruolo || 'Personale Operativo'}
Contratto Applicato: ${worker?.profilo || ''}

2. PREMESSA METODOLOGICA
La presente perizia contabile ha lo scopo di determinare le differenze retributive maturate a titolo di "retribuzione feriale onnicomprensiva", in applicazione dei principi stabiliti dalla Corte di Giustizia UE e recepiti dalla Corte di Cassazione (Sent. n. 20216/2022).

${noteContratto}

3. CRITERI DI CALCOLO ADOTTATI
- Base di Calcolo: Media delle voci variabili e continuative percepite.
- Divisore: Giorni effettivamente lavorati nel mese di riferimento.
- Tetto Giornate: Il ricalcolo è stato applicato esclusivamente entro il limite di ${tettoGiorni} giorni annui (${includeExFest ? "incluse ex-festività" : "solo ferie legali"}).
- Principio di Cassa: Sono stati detratti gli importi già erogati.

${sezioneNote}
4. RISULTANZE CONTABILI (RIEPILOGO)
Dall'analisi dei cedolini paga, si certifica la seguente situazione creditoria:

   A) TOTALE LORDO SPETTANTE: ......................... € ${fmt(lordoVal)}
   B) MENO QUANTO GIÀ PERCEPITO: ...................... € ${fmt(percepitoVal)}
   C) PIÙ DIFFERENZE TICKET RESTAURANT: ............... € ${fmt(ticketVal)}
   
   ------------------------------------------------------------
   TOTALE DIFFERENZE DA LIQUIDARE (A - B + C): ........ € ${fmt(nettoVal)}
   ============================================================

Luogo e Data: ${oggi}
`;
};

export const RelazioneModal = ({ isOpen, onClose, worker, totals, includeExFest = false }: any) => {
    const [copiato, setCopiato] = useState(false);

    // Se non deve essere aperto o mancano i dati, non renderizzare nulla
    if (!isOpen || !worker) return null;

    // Generazione sicura del testo
    let testoCompleto = "";
    try {
        testoCompleto = generaRelazioneTestuale(worker, totals, includeExFest);
    } catch (err) {
        console.error("Errore generazione testo:", err);
        testoCompleto = "Impossibile generare la relazione. Controllare i dati di input.";
    }

    const handleStampa = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>Perizia Tecnica</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; max-width: 800px; margin: 0 auto; }
              h1 { text-align: center; font-size: 20px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; }
              pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
              .footer { margin-top: 50px; border-top: 1px solid #000; padding-top: 10px; display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <h1>Relazione Tecnica di Ricalcolo</h1>
            <pre>${testoCompleto}</pre>
            <div class="footer">
                <div>Data: ${new Date().toLocaleDateString('it-IT')}</div>
                <div>Firma del Tecnico</div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-slate-900 w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-700"
            >
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <PenTool className="text-indigo-400 w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-none tracking-tight">RELAZIONE TECNICA</h2>
                            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">{worker?.profilo || 'GENERICO'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto bg-slate-950 flex-1 relative">
                    <div className="p-8 relative z-10">
                        <div className="bg-white text-slate-900 p-8 shadow-xl rounded-xl font-serif text-sm leading-relaxed border border-slate-200">
                            <pre className="whitespace-pre-wrap font-serif text-sm">{testoCompleto}</pre>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-800 flex gap-3 justify-end bg-[#020617]">
                    <button
                        onClick={handleCopia}
                        className="px-5 py-2.5 flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                    >
                        {copiato ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiato ? 'Copiato!' : 'Copia Testo'}
                    </button>

                    <button
                        onClick={handleStampa}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-xs uppercase tracking-wider"
                    >
                        <Printer className="w-4 h-4" /> Stampa Ufficiale
                    </button>
                </div>
            </motion.div>
        </div>
    );
};