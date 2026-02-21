import React, { useState } from 'react';
import { X, Printer, Copy, CheckCircle, PenTool } from 'lucide-react';
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
            
            <pre>${testoCompleto.replace('EVENTI RILEVANTI E ANNOTAZIONI:', '')}</pre>
            
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
                className="bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-700/50"
            >
                {/* HEADER */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900/50 relative z-10">
                    <div className="flex items-center gap-4">
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

                {/* BODY */}
                <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 flex-1 relative">
                    <div className="bg-white dark:bg-slate-900/60 backdrop-blur-sm p-8 shadow-sm dark:shadow-inner border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs dark:text-slate-300 leading-relaxed relative z-10">
                        <pre className="whitespace-pre-wrap">{testoCompleto}</pre>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end bg-white dark:bg-slate-900/50 relative z-10">
                    <button
                        onClick={handleCopia}
                        className="px-5 py-2.5 flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-semibold transition-all active:scale-95 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:shadow-sm"
                    >
                        {copiato ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copiato ? 'Copiato' : 'Copia Testo'}
                    </button>

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