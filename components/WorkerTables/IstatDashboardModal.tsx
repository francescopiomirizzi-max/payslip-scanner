import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scale, LineChart, Percent, FileSignature, TrendingUp, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateLegalInterestsAndRevaluation, fetchIstatFOI } from '../../istatService';
import { Worker, AnnoDati, parseFloatSafe, getColumnsByProfile } from '../../types';

interface IstatDashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    worker: Worker;
    monthlyInputs: AnnoDati[];
    startClaimYear: number;
    includeExFest: boolean;
    includeTickets: boolean;
}

const IstatDashboardModal: React.FC<IstatDashboardModalProps> = ({
    isOpen, onClose, worker, monthlyInputs, startClaimYear, includeExFest, includeTickets
}) => {
    const [isIstatLoading, setIsIstatLoading] = useState(false);
    const [istatResults, setIstatResults] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) return;

        const performCalculations = async () => {
            setIsIstatLoading(true);
            try {
                // 1. Fetch ISTAT (silenzioso, usa fallback se fallisce)
                await fetchIstatFOI();

                // 2. Calcolo differenze nette annuali
                const TETTO = includeExFest ? 32 : 28;
                const yearlyNetDifferences: Record<number, number> = {};

                // Estrazione anni pulita per evitare il warning delle key
                const rawYears: number[] = Array.from(new Set(monthlyInputs.map(d => Number(d.year))));
                const years = rawYears.filter((y: number) => !isNaN(y) && y > 2000).sort((a: number, b: number) => a - b);

                const indCols = getColumnsByProfile(worker.profilo).filter(c => !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(c.id));

                years.forEach(year => {
                    if (year < startClaimYear) return;

                    let ferieCumulateAnno = 0;
                    let lordoAnno = 0;
                    let percepitoAnno = 0;
                    let ticketAnno = 0;

                    let totGiorni = 0;
                    let totVoci = 0;
                    monthlyInputs.filter(d => Number(d.year) === year || Number(d.year) === year - 1).forEach(r => {
                        const ggL = parseFloatSafe(r.daysWorked);
                        if (ggL > 0) {
                            totGiorni += ggL;
                            indCols.forEach(c => totVoci += parseFloatSafe(r[c.id]));
                        }
                    });
                    const mediaUsata = totGiorni > 0 ? totVoci / totGiorni : 0;

                    const monthsInYear = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);
                    monthsInYear.forEach(m => {
                        const vac = parseFloatSafe(m.daysVacation);
                        const spazio = Math.max(0, TETTO - ferieCumulateAnno);
                        const gu = Math.min(vac, spazio);
                        ferieCumulateAnno += vac;

                        if (gu > 0) {
                            lordoAnno += (gu * mediaUsata);
                            percepitoAnno += (gu * parseFloatSafe(m['coeffPercepito']));
                            if (includeTickets) ticketAnno += (gu * parseFloatSafe(m['coeffTicket']));
                        }
                    });

                    const nettoDifferenzaAnno = (lordoAnno - percepitoAnno) + ticketAnno;
                    if (nettoDifferenzaAnno > 0) {
                        yearlyNetDifferences[year] = nettoDifferenzaAnno;
                    }
                });

                // 3. Calcolo Combinato ISTAT + Interessi
                const breakdown: any[] = [];
                let grandTotalOriginale = 0;
                let grandTotalRivalutazione = 0;
                let grandTotalInteressi = 0;

                Object.keys(yearlyNetDifferences).forEach(annoStr => {
                    const anno = parseInt(annoStr);
                    const importo = yearlyNetDifferences[anno];

                    const risultato = calculateLegalInterestsAndRevaluation(importo, anno);

                    breakdown.push({
                        anno,
                        originale: risultato.importoOriginale,
                        rivalutazione: risultato.rivalutazione,
                        capitaleRivalutato: risultato.capitaleRivalutato,
                        interessi: risultato.interessiMaturati,
                        totale: risultato.totaleDovuto
                    });

                    grandTotalOriginale += risultato.importoOriginale;
                    grandTotalRivalutazione += risultato.rivalutazione;
                    grandTotalInteressi += risultato.interessiMaturati;
                });

                setIstatResults({
                    breakdown: breakdown.sort((a, b) => b.anno - a.anno),
                    capitalePuro: grandTotalOriginale,
                    rivalutazioneTotale: grandTotalRivalutazione,
                    interessiMaturati: grandTotalInteressi,
                    totaleAssoluto: grandTotalOriginale + grandTotalRivalutazione + grandTotalInteressi
                });

            } catch (error) {
                console.error("Errore calcolo ISTAT", error);
            } finally {
                setTimeout(() => setIsIstatLoading(false), 1200);
            }
        };

        performCalculations();
    }, [isOpen, monthlyInputs, worker, startClaimYear, includeExFest, includeTickets]);

    // ✨ VERSIONE PDF PERITALE
    const handlePrintRelazione = async () => {
        if (!istatResults) return;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        doc.setFillColor(23, 37, 84); // Navy Blue
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("RELAZIONE FINANZIARIA: RIVALUTAZIONE E INTERESSI", 14, 15);

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(`Pratica: ${worker.cognome} ${worker.nome}`, 14, 38);
        doc.setFont('helvetica', 'normal');
        doc.text(`Data Elaborazione: ${new Date().toLocaleDateString('it-IT')}`, 14, 44);

        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text("METODOLOGIA DI CALCOLO (Ex Art. 429 c.p.c.)", 14, 55);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const premessaTesto = "Il presente prospetto determina la quantificazione degli interessi legali e della rivalutazione monetaria maturati sul credito da lavoro subordinato. Il calcolo è sviluppato in ossequio al combinato disposto dell'art. 429, comma 3, c.p.c. e dell'art. 150 disp. att. c.p.c., applicando il saggio degli interessi legali (ex art. 1284 c.c.) tempo per tempo vigente e gli indici ISTAT (FOI) dei prezzi al consumo per le famiglie di operai e impiegati. Come da costante giurisprudenza di Cassazione, gli interessi legali sono calcolati sul capitale progressivamente rivalutato anno per anno.";

        const splitPremessa = doc.splitTextToSize(premessaTesto, 182);
        doc.text(splitPremessa, 14, 62);

        let currentY = 62 + (splitPremessa.length * 4) + 6;

        // RIEPILOGO CREDITI AGGIORNATI
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, currentY, 182, 50, 'FD');

        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text("RIEPILOGO CREDITI AGGIORNATI", 20, currentY + 10);

        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`Capitale Netto Base:`, 20, currentY + 22);
        doc.text(`€ ${istatResults.capitalePuro.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 180, currentY + 22, { align: 'right' });

        doc.text(`Rivalutazione Monetaria (Indici FOI):`, 20, currentY + 28);
        doc.text(`€ ${istatResults.rivalutazioneTotale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 180, currentY + 28, { align: 'right' });

        doc.text(`Interessi Legali Maturati:`, 20, currentY + 34);
        doc.text(`€ ${istatResults.interessiMaturati.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 180, currentY + 34, { align: 'right' });

        doc.setDrawColor(150, 150, 150);
        doc.line(20, currentY + 38, 188, currentY + 38);

        doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(`TOTALE DOVUTO:`, 20, currentY + 45);
        doc.text(`€ ${istatResults.totaleAssoluto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 180, currentY + 45, { align: 'right' });

        currentY += 60;

        // TABELLA ANALITICA
        const tableBody = istatResults.breakdown.map((b: any) => [
            b.anno.toString(),
            `€ ${b.originale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `€ ${b.rivalutazione.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `€ ${b.interessi.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `€ ${b.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['ANNO', 'CAPITALE BASE', 'RIVALUTAZIONE', 'INTERESSI', 'TOTALE']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [23, 37, 84], textColor: 255, halign: 'center', fontStyle: 'bold' },
            styles: { halign: 'right', fontSize: 8, cellPadding: 3, textColor: [50, 50, 50], lineColor: [200, 200, 200] },
            columnStyles: { 0: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } }
        });

        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Il presente prospetto ha valore di elaborazione tecnica di parte.", 105, 290, { align: 'center' });
        }

        const nomeFile = `Relazione_Interessi_${worker.cognome}_${worker.nome}.pdf`;
        const pdfBlob = doc.output('blob');

        try {
            if ('showSaveFilePicker' in window) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: nomeFile,
                    types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(pdfBlob);
                await writable.close();
                return;
            }
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = nomeFile;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('Errore salvataggio PDF:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl" onClick={() => !isIstatLoading && onClose()}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -30 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative w-full max-w-5xl bg-slate-900 rounded-[2.5rem] shadow-[0_0_100px_rgba(217,70,239,0.2)] border border-fuchsia-500/30 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-fuchsia-500/20 blur-[100px] pointer-events-none rounded-full"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full"></div>

                <div className="relative px-8 py-6 border-b border-slate-800 flex justify-between items-center z-10 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-fuchsia-600 rounded-2xl shadow-[0_0_20px_rgba(217,70,239,0.4)]">
                            <Scale className="w-6 h-6 text-white" strokeWidth={2} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Rivalutazione ISTAT & Interessi</h2>
                            <p className="text-xs text-fuchsia-400 font-bold uppercase tracking-widest mt-0.5">Calcolo ai sensi dell'Art. 429 c.p.c.</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isIstatLoading} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white disabled:opacity-50">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-8">
                    {isIstatLoading || !istatResults ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="relative w-24 h-24 mb-6">
                                <div className="absolute inset-0 border-t-4 border-fuchsia-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-2 border-b-4 border-amber-400 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                                <LineChart className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Connessione Dati Sicuri...</h3>
                            <p className="text-slate-400 text-sm">Calcolo rivalutazione FOI e tassi MEF in corso</p>
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">

                            {/* LE 4 CARD CON TOOLTIP HOVER PAZZESCO */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                {/* CARD 1: Capitale */}
                                <div className="relative group z-10 hover:z-50">
                                    <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden h-full cursor-help transition-all duration-300 group-hover:border-slate-500 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                                            Capitale Netto <Info size={12} className="opacity-50" />
                                        </span>
                                        <span className="text-2xl font-black text-white tracking-tight">€ {istatResults.capitalePuro.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {/* TOOLTIP 1 */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 w-72 bg-slate-900/95 backdrop-blur-2xl border border-slate-600 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl p-5">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-t border-l border-slate-600 rotate-45"></div>
                                        <h4 className="text-white font-black mb-2 relative z-10 text-sm uppercase tracking-wide border-b border-slate-700 pb-2">Capitale Base (Non rivalutato)</h4>
                                        <p className="text-slate-400 text-xs leading-relaxed relative z-10">È la somma matematica delle differenze retributive nette spettanti, calcolate anno per anno prima dell'intervento del Giudice.</p>
                                    </div>
                                </div>

                                {/* CARD 2: Rivalutazione FOI */}
                                <div className="relative group z-10 hover:z-50">
                                    <div className="bg-slate-800/50 border border-amber-500/30 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden h-full cursor-help transition-all duration-300 group-hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><TrendingUp size={10} /> Rivalutazione FOI</span>
                                            <Info size={12} className="opacity-50" />
                                        </span>
                                        <span className="text-2xl font-black text-amber-400 tracking-tight">+ € {istatResults.rivalutazioneTotale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {/* TOOLTIP 2 */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 w-80 bg-slate-900/95 backdrop-blur-2xl border border-amber-500/50 shadow-[0_20px_50px_rgba(245,158,11,0.2)] rounded-2xl p-5">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-t border-l border-amber-500/50 rotate-45"></div>
                                        <h4 className="text-amber-400 font-black mb-2 relative z-10 text-sm uppercase tracking-wide border-b border-slate-700 pb-2">Protezione Inflazione</h4>
                                        <p className="text-slate-300 text-xs leading-relaxed relative z-10">Compensa la perdita del potere d'acquisto della moneta nel tempo usando gli Indici ISTAT. <br /><br /><strong className="text-amber-300">Esempio:</strong> 1.000€ non pagati nel 2018 oggi valgono di meno; la rivalutazione li riporta al loro reale valore odierno.</p>
                                    </div>
                                </div>

                                {/* CARD 3: Interessi */}
                                <div className="relative group z-10 hover:z-50">
                                    <div className="bg-slate-800/50 border border-fuchsia-500/30 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden h-full cursor-help transition-all duration-300 group-hover:border-fuchsia-400 group-hover:shadow-[0_0_20px_rgba(217,70,239,0.2)]">
                                        <span className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Percent size={10} /> Interessi Legali</span>
                                            <Info size={12} className="opacity-50" />
                                        </span>
                                        <span className="text-2xl font-black text-fuchsia-400 tracking-tight">+ € {istatResults.interessiMaturati.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {/* TOOLTIP 3 */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 w-80 bg-slate-900/95 backdrop-blur-2xl border border-fuchsia-500/50 shadow-[0_20px_50px_rgba(217,70,239,0.2)] rounded-2xl p-5">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-t border-l border-fuchsia-500/50 rotate-45"></div>
                                        <h4 className="text-fuchsia-400 font-black mb-2 relative z-10 text-sm uppercase tracking-wide border-b border-slate-700 pb-2">Interessi Art. 429 c.p.c.</h4>
                                        <p className="text-slate-300 text-xs leading-relaxed relative z-10">È la mora per il ritardato pagamento calcolata sui Tassi Ufficiali del MEF (Es. 5% nel 2023). <br /><br /><strong className="text-fuchsia-300">Nota Giuridica:</strong> La Cassazione impone che gli interessi vengano calcolati sul capitale <em>progressivamente rivalutato</em> anno per anno, massimizzando il rendimento.</p>
                                    </div>
                                </div>

                                {/* CARD 4: Totale */}
                                <div className="relative group z-10 hover:z-50">
                                    <div className="bg-gradient-to-br from-emerald-900 to-slate-900 border border-emerald-500/50 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden h-full cursor-help shadow-[0_0_30px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] group-hover:border-emerald-400 transition-all duration-300">
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/20 blur-[40px] group-hover:bg-emerald-400/40 transition-colors"></div>
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                                            Nuovo Totale
                                            <Info size={12} className="opacity-50 text-emerald-200" />
                                        </span>
                                        <span className="text-3xl font-black text-white tracking-tight">€ {istatResults.totaleAssoluto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {/* TOOLTIP 4 */}
                                    <div className="absolute top-full right-0 mt-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 w-80 bg-slate-900/95 backdrop-blur-2xl border border-emerald-500/50 shadow-[0_20px_50px_rgba(16,185,129,0.3)] rounded-2xl p-5 origin-top-right">
                                        <div className="absolute -top-2 right-10 w-4 h-4 bg-slate-900 border-t border-l border-emerald-500/50 rotate-45"></div>
                                        <h4 className="text-emerald-400 font-black mb-2 relative z-10 text-sm uppercase tracking-wide border-b border-emerald-900 pb-2">Totale da Richiedere</h4>
                                        <p className="text-slate-300 text-xs leading-relaxed relative z-10">È l'importo definitivo, blindato e inattaccabile. Questa è la cifra esatta da inserire nella lettera di Diffida e Messa in Mora (PEC) o nell'atto di Ricorso in Tribunale.</p>
                                    </div>
                                </div>
                            </div>

                            {/* TABELLA ANALITICA COMPLETA */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Sviluppo Analitico Annuale</h3>
                                <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400">
                                            <tr>
                                                <th className="px-6 py-4">Anno</th>
                                                <th className="px-6 py-4 text-right">Capitale Netto</th>
                                                <th className="px-6 py-4 text-right text-amber-400">Rivalutazione ISTAT</th>
                                                <th className="px-6 py-4 text-right text-fuchsia-400">Interessi (Su Cap. Rival.)</th>
                                                <th className="px-6 py-4 text-right text-emerald-400">Totale Aggiornato</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {istatResults.breakdown.map((row: any, index: number) => (
                                                <tr key={row.anno ? `row-${row.anno}` : `fallback-${index}`} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4 font-black text-white">{row.anno}</td>
                                                    <td className="px-6 py-4 text-right font-mono">€ {row.originale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-amber-300">+ € {row.rivalutazione.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-fuchsia-300">+ € {row.interessi.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-300">€ {row.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center z-10">
                    <p className="text-[11px] text-slate-500 font-medium max-w-xl">
                        Gli interessi sono calcolati progressivamente sul capitale rivalutato come da indicazione della Suprema Corte.
                    </p>
                    <button
                        onClick={handlePrintRelazione}
                        disabled={isIstatLoading || !istatResults}
                        className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileSignature className="w-5 h-5" /> STAMPA RELAZIONE PDF
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default IstatDashboardModal;