import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <--- AGGIUNGI QUESTA RIGA
import { AnnoDati, Worker } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Wallet, Printer, Edit3, Save, X, Info, Calculator, BookOpen, Calendar, FileSearch } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateTFR } from '../../utils/tfrCalculator';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsland } from '../../IslandContext'; // Aggiungiamo l'isola per le notifiche!

interface TfrCalculationTableProps {
    data: AnnoDati[];
    worker: Worker;
    startClaimYear: number;
    onDataChange: (newData: AnnoDati[]) => void;
}

const TfrCalculationTable: React.FC<TfrCalculationTableProps> = ({
    data,
    worker,
    startClaimYear,
    onDataChange
}) => {

    const { showNotification } = useIsland();
    const [editingYear, setEditingYear] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // Stati per il Modale Punto Zero TFR
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tfrAmount, setTfrAmount] = useState<string>('');
    const [tfrYear, setTfrYear] = useState<string>('');

    // Stati Locali per aggiornamento UI istantaneo
    const [localTfrPregresso, setLocalTfrPregresso] = useState<number>(worker.tfr_pregresso || 0);
    const [localTfrAnno, setLocalTfrAnno] = useState<number>(worker.tfr_pregresso_anno || (startClaimYear - 1));

    // Motore di Calcolo (Ora connesso all'inizio della vertenza!)
    const tfrData = calculateTFR(data, localTfrPregresso, localTfrAnno, startClaimYear);

    // Salvataggio Edit Manuale (nel mese di Dicembre)
    const handleSaveEdit = (year: number) => {
        const numericValue = parseFloat(editValue.replace(',', '.'));
        if (isNaN(numericValue)) {
            setEditingYear(null);
            return;
        }

        let newData = [...data];
        const monthsInYear = newData.filter(d => Number(d.year) === year);

        if (monthsInYear.length === 0) {
            newData.push({
                id: Math.random().toString(),
                year,
                monthIndex: 11,
                month: 'DICEMBRE',
                daysWorked: 0, daysVacation: 0, ticket: 0, arretrati: 0, note: '[TFR Inserito Manualmente]',
                imponibile_tfr_mensile: numericValue
            });
        } else {
            const lastMonthIndex = Math.max(...monthsInYear.map(m => m.monthIndex));
            newData = newData.map(d => {
                if (Number(d.year) === year) {
                    if (d.monthIndex === lastMonthIndex) {
                        return { ...d, imponibile_tfr_mensile: numericValue };
                    } else {
                        return { ...d, imponibile_tfr_mensile: 0 };
                    }
                }
                return d;
            });
        }

        onDataChange(newData);
        setEditingYear(null);
    };

    // Salvataggio Punto Zero TFR nel Local Storage
    const handleSavePuntoZero = () => {
        if (!tfrAmount || !tfrYear) return;

        const rawData = localStorage.getItem('workers_data');
        if (rawData && worker) {
            let workers = JSON.parse(rawData);
            const amount = parseFloat(tfrAmount.replace(',', '.'));
            const year = parseInt(tfrYear);

            workers = workers.map((w: any) => {
                if (w.id === worker.id) {
                    return { ...w, tfr_pregresso: amount, tfr_pregresso_anno: year };
                }
                return w;
            });

            localStorage.setItem('workers_data', JSON.stringify(workers));

            setLocalTfrPregresso(amount);
            setLocalTfrAnno(year);
            setIsModalOpen(false);

            showNotification("Punto Zero TFR", `Base storica aggiornata a € ${formatCurrency(amount)}`, "success");
        }
    };

    // Motore Stampa PDF
    const handlePrintTFR = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const primaryColor: [number, number, number] = [15, 23, 42];
        const accentColor: [number, number, number] = [79, 70, 229];

        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 24, 'F');
        doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        doc.text(`PROSPETTO RIVALUTAZIONE T.F.R.`, 14, 15);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
        doc.text(`Lavoratore: ${worker.cognome} ${worker.nome}`, 196, 15, { align: 'right' });

        let currentY = 34;
        doc.setTextColor(50);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Fondo Iniziale (Punto Zero): € ${formatCurrency(localTfrPregresso)} (al 31/12/${localTfrAnno})`, 14, currentY);
        currentY += 8;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);
        doc.text(`Calcolo elaborato ai sensi dell'Art. 2120 c.c. con indici ISTAT FOI ufficiali.`, 14, currentY);
        currentY += 12;

        const tableData = tfrData.map(row => {
            let fIniziale = formatCurrency(row.fondoIniziale);
            let riv = formatCurrency(row.rivalutazione);
            let fFinale = formatCurrency(row.fondoFinale);

            if (row.isBeforePuntoZero) {
                fIniziale = '-'; riv = '-'; fFinale = 'Inglobato nello Storico';
            } else if (row.isPuntoZeroYear) {
                fIniziale = '-'; riv = '-'; fFinale = `PUNTO ZERO: € ${formatCurrency(row.fondoFinale)}`;
            }

            return [
                row.year.toString(),
                fIniziale,
                formatCurrency(row.imponibileLordo),
                formatCurrency(row.quotaMaturataNetta),
                riv,
                fFinale
            ];
        });

        autoTable(doc, {
            startY: currentY,
            head: [['ANNO', 'FONDO INIZIALE', 'IMPONIBILE UTILE', 'QUOTA MATURATA\n(-0.5% INPS)', 'RIVALUTAZIONE\nISTAT (FOI)', 'FONDO FINALE']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 4, halign: 'right', textColor: [60, 60, 60] },
            headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center', lineColor: [210, 210, 210], lineWidth: 0.1 },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' },
                2: { fontStyle: 'normal' },
                5: { fontStyle: 'bold', textColor: accentColor, fillColor: [249, 250, 251] }
            },
            margin: { left: 14, right: 14 }
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 18;

        if (tfrData.length > 0) {
            const totaleAssoluto = tfrData[tfrData.length - 1].fondoFinale;
            doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
            doc.text(`TOTALE T.F.R. MATURATO: € ${formatCurrency(totaleAssoluto)}`, 196, currentY, { align: 'right' });
        }

        doc.save(`Prospetto_TFR_${worker.cognome}_${worker.nome}.pdf`);
    };

    // --- COMPONENTE HEADER CON COLOR CODING ---
    const HeaderTooltip = ({ title, subtitle, description, align = 'right', isEditable = false, colorTheme = 'slate' }: any) => {
        const themes: any = {
            slate: { bg: "bg-slate-100/80 dark:bg-slate-800/80", text: "text-slate-600 dark:text-slate-300", hover: "group-hover/th:text-slate-900 dark:group-hover/th:text-white", icon: "text-slate-400" },
            indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300", hover: "group-hover/th:text-indigo-900 dark:group-hover/th:text-indigo-100", icon: "text-indigo-400" },
            emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", hover: "group-hover/th:text-emerald-900 dark:group-hover/th:text-emerald-100", icon: "text-emerald-400" },
            blue: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", hover: "group-hover/th:text-blue-900 dark:group-hover/th:text-blue-100", icon: "text-blue-400" },
            fuchsia: { bg: "bg-fuchsia-100/50 dark:bg-fuchsia-900/30", text: "text-fuchsia-700 dark:text-fuchsia-300", hover: "group-hover/th:text-fuchsia-900 dark:group-hover/th:text-fuchsia-100", icon: "text-fuchsia-400" }
        };
        const theme = themes[colorTheme];

        return (
            <th className={`px-4 py-4 text-xs font-black uppercase tracking-wider border-b border-r border-slate-200 dark:border-slate-800 relative group/th cursor-help ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${theme.bg} ${theme.text}`}>
                <div className={`flex flex-col ${align === 'right' ? 'items-end' : align === 'center' ? 'items-center' : 'items-start'} leading-tight`}>
                    <div className={`flex items-center gap-1.5 transition-colors duration-300 ${theme.hover}`}>
                        {align !== 'right' && <Info size={14} className={`${theme.icon} opacity-80 mb-0.5`} strokeWidth={2.5} />}
                        <span>{title}</span>
                        {align === 'right' && <Info size={14} className={`${theme.icon} opacity-80 mb-0.5`} strokeWidth={2.5} />}
                    </div>
                    {subtitle && (
                        <div className={`flex items-center gap-1 mt-1 opacity-80`}>
                            <span className={`text-[10px] font-bold tracking-widest normal-case`}>{subtitle}</span>
                            {isEditable && <Edit3 size={10} />}
                        </div>
                    )}
                </div>

                <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-slate-900/95 dark:bg-[#0B1120]/95 backdrop-blur-xl border border-slate-700/50 text-white rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] opacity-0 invisible group-hover/th:opacity-100 group-hover/th:visible transition-all duration-300 z-999 text-left normal-case pointer-events-none transform group-hover/th:translate-y-0 translate-y-2">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-700/50"></div>
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-700/50 pb-2">
                        <div className={`p-1.5 rounded-lg bg-white/10`}>
                            <BookOpen size={14} className="text-white" />
                        </div>
                        <h4 className="font-bold text-[12px] text-slate-100 tracking-wide">{title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{description}</p>
                </div>
            </th>
        );
    };

    const hasActualTfr = tfrData.some(row => row.imponibileLordo > 0 || row.fondoIniziale > 0);

    if (!tfrData || !hasActualTfr) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-center mt-4 border-dashed border-2 border-slate-300 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl h-full min-h-[400px] shadow-lg transition-all">
                <div className="w-24 h-24 mb-6 rounded-full bg-indigo-50 dark:bg-slate-800/80 flex items-center justify-center shadow-inner ring-4 ring-white dark:ring-slate-800">
                    <FileSearch className="w-12 h-12 text-indigo-500 dark:text-cyan-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 tracking-tight">Nessun TFR Calcolato</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed text-base font-medium">
                    Non ci sono dati sufficienti per il calcolo del TFR. Assicurati che siano presenti importi spettanti nel tab "Gestione Dati" per gli anni lavorati.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0B1120] shadow-2xl rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60 transition-colors duration-300 select-none relative">

            <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        .animate-shine { animation: shine 3s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      `}</style>

            {/* HEADER TOP-BAR */}
            <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0 z-20 shadow-lg border-b border-slate-800">

                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center p-2.5 bg-linear-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shadow-inner">
                        <Calculator size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h2 className="text-base font-black uppercase tracking-widest text-slate-100 leading-none">Rivalutazione TFR</h2>

                        {/* BADGE INTERATTIVO PUNTO ZERO (Nuovo Posizionamento) */}
                        <div className="mt-2">
                            <button
                                onClick={() => {
                                    setTfrAmount(localTfrPregresso ? localTfrPregresso.toString() : '');
                                    setTfrYear(localTfrAnno.toString());
                                    setIsModalOpen(true);
                                }}
                                className="group flex items-center gap-2 bg-slate-800 hover:bg-indigo-900/50 border border-slate-700 hover:border-indigo-500/50 px-3 py-1 rounded-md transition-all duration-300"
                                title="Clicca per modificare la Base Storica"
                            >
                                <Wallet size={12} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                <span className="text-[10px] text-slate-400 group-hover:text-indigo-300 font-medium uppercase tracking-widest transition-colors">Base Storica:</span>
                                {localTfrPregresso > 0 ? (
                                    <span className="text-xs font-mono font-black text-indigo-400 tabular-nums">€ {formatCurrency(localTfrPregresso)} <span className="text-[10px] text-slate-500 font-medium ml-1">al 31/12/{localTfrAnno}</span></span>
                                ) : (
                                    <span className="text-[10px] font-bold text-amber-500 group-hover:text-amber-400">NON IMPOSTATA (CLICCA QUI)</span>
                                )}
                                <Edit3 size={10} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <button
                        onClick={handlePrintTFR}
                        disabled={!hasActualTfr}
                        className="group relative px-6 py-2.5 bg-linear-to-br from-indigo-600 to-blue-700 text-white rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-400/30 overflow-hidden flex items-center gap-2"
                    >
                        <div className="absolute inset-0 -translate-x-full w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shine z-0"></div>
                        <Printer size={15} className="relative z-10 drop-shadow-md" />
                        <span className="relative z-10 tracking-wide uppercase text-[11px] font-black">Genera Report</span>
                    </button>
                </div>
            </div>

            {/* CORPO TABELLA SCROLLABILE */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#0B1120] relative">
                <table className="w-full text-sm border-collapse table-fixed">

                    <thead className="sticky top-0 z-100 shadow-sm">
                        <tr>
                            <HeaderTooltip align="center" title="Anno" colorTheme="slate" description="L'anno solare di riferimento per il calcolo della quota di accantonamento e della rivalutazione." />
                            <HeaderTooltip title="Fondo Iniziale" colorTheme="slate" description="Il TFR accumulato dal lavoratore fino al 31 Dicembre dell'anno precedente. Costituisce la base su cui calcolare l'interesse ISTAT." />
                            <HeaderTooltip isEditable={true} colorTheme="indigo" title="Imponibile Utile" subtitle="Editabile Manualmente" description="La retribuzione lorda annua utile ai fini TFR. Clicca sulla cella per correggere l'importo qualora il dato estratto dall'Intelligenza Artificiale non sia esatto." />
                            <HeaderTooltip title="Quota Maturata" colorTheme="emerald" subtitle="Lorda - 0.50% INPS" description="Si calcola dividendo l'imponibile utile per 13,5. Al risultato viene sottratta la trattenuta dello 0,50% destinata al Fondo di Garanzia INPS." />
                            <HeaderTooltip title="Rivalutazione" colorTheme="blue" subtitle="Indice ISTAT (FOI)" description="Si applica al Fondo Iniziale. È composta da un tasso fisso dell'1,5% annuo più il 75% dell'aumento dell'indice dei prezzi al consumo (FOI)." />
                            <HeaderTooltip title="Fondo Finale" colorTheme="fuchsia" description="La somma esatta tra: Fondo Iniziale + Quota Netta Maturata + Rivalutazione ISTAT. Rappresenta il totale accantonato al 31/12 dell'anno." />
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {tfrData.map(row => (
                            <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150 group">
                                <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200 text-center border-r border-slate-100 dark:border-slate-800/50">{row.year}</td>

                                {/* FONDO INIZIALE: Nascosto se prima o durante l'anno del Punto Zero */}
                                <td className="px-4 py-4 text-right font-mono text-[13px] text-slate-500 dark:text-slate-400 tabular-nums border-r border-slate-100 dark:border-slate-800/50">
                                    {row.isBeforePuntoZero || row.isPuntoZeroYear ? '-' : formatCurrency(row.fondoIniziale)}
                                </td>

                                {/* IMPONIBILE LORDO EDITABILE (Lasciato esattamente come lo avevi fatto tu!) */}
                                <td className="p-0 text-right relative border-r border-slate-100 dark:border-slate-800/50 bg-indigo-50/20 dark:bg-indigo-900/10 transition-colors">
                                    {editingYear === row.year ? (
                                        <div className="absolute inset-0 flex items-center justify-end gap-1.5 px-2 bg-indigo-100/90 dark:bg-indigo-900/90 backdrop-blur-md z-10 transition-all">
                                            <input type="number" autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(row.year)} className="w-28 bg-white dark:bg-[#0B1120] border border-indigo-300 dark:border-indigo-600 rounded-lg px-3 py-1.5 text-right font-mono text-[13px] font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" />
                                            <button onClick={() => handleSaveEdit(row.year)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-md transition-colors"><Save size={14} /></button>
                                            <button onClick={() => setEditingYear(null)} className="p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-md"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div onClick={() => { setEditingYear(row.year); setEditValue(row.imponibileLordo.toString()); }} className="flex items-center justify-end gap-2 h-full w-full cursor-pointer py-4 px-4 hover:bg-indigo-100/50 dark:hover:bg-indigo-800/40 transition-all border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 group/cell">
                                            <Edit3 size={12} className="text-indigo-400 dark:text-indigo-500 opacity-0 group-hover/cell:opacity-100 transition-opacity" strokeWidth={2.5} />
                                            <span className={`font-mono text-[13px] tabular-nums ${row.imponibileLordo > 0 ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500/60'}`}>{formatCurrency(row.imponibileLordo)}</span>
                                        </div>
                                    )}
                                </td>

                                {/* QUOTA MATURATA: Sempre visibile */}
                                <td className="px-4 py-4 text-right font-mono text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums border-r border-slate-100 dark:border-slate-800/50">
                                    +{formatCurrency(row.quotaMaturataNetta)}
                                </td>

                                {/* RIVALUTAZIONE: Nascosta se prima o durante l'anno del Punto Zero */}
                                <td className="px-4 py-4 text-right font-mono text-[13px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums border-r border-slate-100 dark:border-slate-800/50">
                                    {row.isBeforePuntoZero || row.isPuntoZeroYear ? '-' : `+${formatCurrency(row.rivalutazione)}`}
                                </td>

                                {/* FONDO FINALE: Testo dinamico in base all'anno */}
                                <td className="px-4 py-4 text-right bg-fuchsia-50/20 dark:bg-fuchsia-900/10">
                                    {row.isBeforePuntoZero ? (
                                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Inglobato nello Storico</span>
                                    ) : row.isPuntoZeroYear ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] uppercase tracking-widest font-black text-indigo-500 dark:text-indigo-400 mb-1 opacity-80">Base Storica (31/12)</span>
                                            <span className="font-mono text-[14px] font-black tabular-nums bg-clip-text text-transparent bg-linear-to-r from-slate-800 to-indigo-600 dark:from-slate-100 dark:to-indigo-400">
                                                {formatCurrency(row.fondoFinale)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="font-mono text-[14px] font-black tabular-nums bg-clip-text text-transparent bg-linear-to-r from-slate-800 to-fuchsia-600 dark:from-slate-100 dark:to-fuchsia-400">
                                            {formatCurrency(row.fondoFinale)}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {!hasActualTfr && (
                            <tr>
                                <td colSpan={6} className="p-20 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="relative w-20 h-20 flex items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 mb-5">
                                            <Wallet className="w-8 h-8 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Nessun TFR Calcolato</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
                                            Imposta la "Base Storica" qui in alto e acquisisci i cedolini per generare automaticamente il prospetto di rivalutazione.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>

                    {tfrData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-50 bg-slate-50/95 dark:bg-[#0B1120]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.4)]">
                            <tr>
                                <td className="px-4 py-5 text-center font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] border-r border-slate-200 dark:border-slate-800">Totale</td>
                                <td className="px-4 py-5 border-r border-slate-200 dark:border-slate-800"></td>
                                <td className="px-4 py-5 text-right font-mono text-[13px] font-bold text-indigo-700 dark:text-indigo-400 tabular-nums border-r border-slate-200 dark:border-slate-800">
                                    {formatCurrency(tfrData.reduce((acc, r) => acc + r.imponibileLordo, 0))}
                                </td>
                                <td className="px-4 py-5 text-right font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums border-r border-slate-200 dark:border-slate-800">
                                    {formatCurrency(tfrData.reduce((acc, r) => acc + r.quotaMaturataNetta, 0))}
                                </td>
                                <td className="px-4 py-5 text-right font-mono text-[13px] font-bold text-blue-600 dark:text-blue-400 tabular-nums border-r border-slate-200 dark:border-slate-800">
                                    {formatCurrency(tfrData.reduce((acc, r) => acc + r.rivalutazione, 0))}
                                </td>
                                <td className="px-4 py-4 text-right bg-fuchsia-50/40 dark:bg-fuchsia-900/20 rounded-br-2xl">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] uppercase tracking-widest font-black text-fuchsia-500 dark:text-fuchsia-400 mb-1 opacity-80">TFR Spettante</span>
                                        <span className="font-mono text-lg font-black tabular-nums bg-clip-text text-transparent bg-linear-to-r from-slate-800 to-fuchsia-600 dark:from-slate-100 dark:to-fuchsia-400 drop-shadow-sm">
                                            {formatCurrency(tfrData[tfrData.length - 1].fondoFinale)}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* --- MODALE PUNTO ZERO (PORTAL: Vero Pop-up a schermo intero) --- */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] shadow-[0_0_80px_rgba(99,102,241,0.2)] border border-slate-700 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-[60px] pointer-events-none"></div>

                                <div className="relative px-8 pt-8 pb-4 text-center">
                                    <div className="w-16 h-16 mx-auto bg-slate-950 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4 relative group">
                                        <div className="absolute inset-0 rounded-2xl bg-indigo-400 opacity-20 animate-ping"></div>
                                        <Wallet className="w-8 h-8 text-indigo-400 relative z-10" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Punto Zero TFR</h3>
                                    <p className="text-sm text-slate-400 mt-2 font-medium">Imposta la base storica per la rivalutazione.</p>
                                </div>

                                <div className="px-8 pb-8 space-y-5 relative z-10">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Fondo Accantonato</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-indigo-400 font-black text-lg">€</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={tfrAmount} onChange={(e) => setTfrAmount(e.target.value)} placeholder="0.00"
                                                className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner group-hover:border-slate-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Anno di riferimento</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Calendar size={18} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                                            </div>
                                            <input
                                                type="number"
                                                value={tfrYear} onChange={(e) => setTfrYear(e.target.value)} placeholder="Es. 2017"
                                                className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner group-hover:border-slate-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-xl font-bold text-sm text-slate-400 bg-slate-800/50 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700">Annulla</button>
                                        <button onClick={handleSavePuntoZero} disabled={!tfrAmount || !tfrYear} className="flex-[2] py-4 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Save size={18} /> SALVA
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                            {/* Codice per nascondere le frecce di sistema dai campi numerici */}
                            <style>{`
                .hide-arrows::-webkit-outer-spin-button,
                .hide-arrows::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                .hide-arrows {
                  -moz-appearance: textfield;
                }
              `}</style>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

        </div>
    );
};

export default TfrCalculationTable;