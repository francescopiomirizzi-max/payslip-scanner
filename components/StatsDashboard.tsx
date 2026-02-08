import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
    TrendingUp,
    Users,
    Wallet,
    ArrowLeft,
    Printer,
    Calendar,
    Award,
    Activity,
    Briefcase,
    ArrowUpRight,
    Target,
    Download,
    Zap
} from 'lucide-react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// 1. IMPORTIAMO GLI STRUMENTI NECESSARI
import { Worker, getColumnsByProfile, parseFloatSafe, YEARS } from '../types';

// --- COMPONENTE NUMERO ANIMATO (TICKING) ---
const AnimatedCounter = ({ value, currency = false }: { value: number, currency?: boolean }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { damping: 40, stiffness: 60, duration: 2500 });

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        return springValue.on("change", (latest) => {
            if (ref.current) {
                ref.current.textContent = currency
                    ? latest.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                    : Math.round(latest).toString();
            }
        });
    }, [springValue, currency]);

    return <span ref={ref} />;
};

// --- GRAFICO SPETTACOLARE INTERATTIVO (SCANNER EDITION) ---
const InteractiveChart = ({ data }: { data: number[] }) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const height = 250;
    const width = 800;
    const max = Math.max(...data, 100);
    const min = 0;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height * 0.7 - 40;
        return { x, y, val };
    });

    const buildCurve = (points: { x: number, y: number }[]) => {
        if (points.length === 0) return "";
        let d = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) / 2;
            const cp1y = p0.y;
            const cp2x = p0.x + (p1.x - p0.x) / 2;
            const cp2y = p1.y;
            d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
        }
        return d;
    };

    const lineD = buildCurve(points);
    const pathD = `${lineD} L${width},${height} L0,${height} Z`;

    return (
        <div
            className="relative w-full h-full cursor-crosshair"
            ref={containerRef}
            onMouseLeave={() => setHoverIndex(null)}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="50%" stopColor="#c084fc" />
                        <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                    <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {[0, 1, 2, 3].map(i => (
                    <line key={i} x1="0" y1={height - (i * 60)} x2={width} y2={height - (i * 60)} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                ))}

                <motion.path
                    d={pathD}
                    fill="url(#chartFill)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                />

                <motion.path
                    d={lineD}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="4"
                    filter="url(#glowLine)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                />

                {points.map((p, i) => (
                    <rect
                        key={i}
                        x={p.x - (width / points.length / 2)}
                        y="0"
                        width={width / points.length}
                        height={height}
                        fill="transparent"
                        onMouseEnter={() => setHoverIndex(i)}
                    />
                ))}

                {hoverIndex !== null && (
                    <>
                        <line
                            x1={points[hoverIndex].x} y1="0"
                            x2={points[hoverIndex].x} y2={height}
                            stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
                        />
                        <circle
                            cx={points[hoverIndex].x}
                            cy={points[hoverIndex].y}
                            r="6"
                            fill="#fff"
                            stroke="#6366f1"
                            strokeWidth="3"
                            style={{ filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.8))' }}
                        />
                    </>
                )}
            </svg>

            <AnimatePresence>
                {hoverIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="absolute pointer-events-none z-50 flex flex-col items-center"
                        style={{
                            left: `${(points[hoverIndex].x / width) * 100}%`,
                            top: `${(points[hoverIndex].y / height) * 100}%`,
                            transform: 'translate(-50%, -130%)'
                        }}
                    >
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 text-white rounded-xl px-4 py-2 shadow-2xl flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1">Valore Stimato</span>
                            <span className="text-lg font-black font-mono text-white drop-shadow-md">
                                € {points[hoverIndex].val.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                            </span>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/90 border-r border-b border-indigo-500/30 rotate-45"></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface StatsDashboardProps {
    workers: Worker[];
    onBack: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ workers = [], onBack }) => {

    // --- LOGICA DI CALCOLO UNIFICATA CON IL RESTO DELL'APP ---
    const stats = useMemo(() => {
        const computedWorkers = workers.map(w => {
            // 1. Identifichiamo le colonne indennità (tutto tranne i campi tecnici)
            const indennitaCols = getColumnsByProfile(w.profilo).filter(c =>
                !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note'].includes(c.id)
            );

            let grandTotalNetto = 0;
            const safeAnni = Array.isArray(w.anni) ? w.anni : [];

            // 2. ITERIAMO PER ANNI (Per resettare il contatore dei 28 giorni)
            YEARS.forEach(year => {
                // Filtriamo e ordiniamo per mese (importante per il calcolo progressivo!)
                const yearRows = safeAnni
                    .filter(r => r.year === year)
                    .sort((a, b) => a.monthIndex - b.monthIndex);

                let ferieCumulateCounter = 0;
                const TETTO_FERIE = 28; // Tetto standard per la dashboard esecutiva

                yearRows.forEach(row => {
                    // A. Somma Indennità del mese
                    let mIndemnity = 0;
                    indennitaCols.forEach(col => { mIndemnity += parseFloatSafe(row[col.id]); });

                    // B. Dati Giorni
                    const ggLav = parseFloatSafe(row.daysWorked);
                    const ggFerieReali = parseFloatSafe(row.daysVacation);

                    // C. Logica Tetto 28gg (Giorni Utili)
                    const prevTotal = ferieCumulateCounter;
                    ferieCumulateCounter += ggFerieReali;

                    let ggUtili = 0;
                    if (prevTotal < TETTO_FERIE) {
                        const spazioRimanente = TETTO_FERIE - prevTotal;
                        ggUtili = Math.min(ggFerieReali, spazioRimanente);
                    }

                    // D. Calcolo Importo Spettante
                    if (ggLav > 0) {
                        const valoreGiornaliero = mIndemnity / ggLav;
                        grandTotalNetto += valoreGiornaliero * ggUtili;
                    }
                });
            });

            return { ...w, computedTotal: grandTotalNetto > 0 ? grandTotalNetto : 0 };
        });

        const sortedWorkers = [...computedWorkers].sort((a, b) => b.computedTotal - a.computedTotal);
        const totalRevenue = sortedWorkers.reduce((acc, w) => acc + w.computedTotal, 0);
        const avgRevenue = workers.length > 0 ? totalRevenue / workers.length : 0;
        const topPerformer = sortedWorkers[0];

        const byProfile: Record<string, { count: number, value: number }> = {};
        sortedWorkers.forEach(w => {
            const p = w.profilo || 'ALTRO';
            if (!byProfile[p]) byProfile[p] = { count: 0, value: 0 };
            byProfile[p].count += 1;
            byProfile[p].value += w.computedTotal;
        });

        const chartData = sortedWorkers.length > 3
            ? sortedWorkers.slice(0, 10).map(w => w.computedTotal).reverse()
            : [1500, 2300, 3200, 2800, 4500, 5200, 4900, 6100, 5800, 7200];

        return {
            totalWorkers: workers.length,
            totalRevenue,
            avgRevenue,
            byProfile,
            topPerformer,
            list: sortedWorkers,
            chartData
        };
    }, [workers]);

    const handlePrintReport = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const today = new Date().toLocaleDateString('it-IT');

        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 30, 'F');
        doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        doc.text("REPORT FINANZIARIO EXECUTIVE", 15, 14);
        doc.setFontSize(9); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
        doc.text(`Analisi Recupero Crediti - Generato il ${today}`, 15, 21);

        let y = 45;
        doc.setTextColor(30); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text("1. SINTESI FINANZIARIA (Tetto 28gg applicato)", 15, y);
        doc.setDrawColor(200); doc.line(15, y + 2, 100, y + 2);

        const printKpi = (lbl: string, val: string, x: number) => {
            doc.setFillColor(241, 245, 249); doc.roundedRect(x, y + 8, 55, 20, 2, 2, 'F');
            doc.setFontSize(8); doc.setTextColor(100); doc.text(lbl, x + 4, y + 14);
            doc.setFontSize(12); doc.setTextColor(0); doc.text(val, x + 4, y + 22);
        };

        printKpi("TOTALE RECUPERABILE", stats.totalRevenue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }), 15);
        printKpi("NUMERO PRATICHE", stats.totalWorkers.toString(), 75);
        printKpi("MEDIA PER PRATICA", stats.avgRevenue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }), 135);

        y += 40;
        doc.text("2. DETTAGLIO PRATICHE", 15, y);
        doc.line(15, y + 2, 80, y + 2);

        const tableBody = stats.list.map(w => [
            `${w.cognome} ${w.nome}`,
            w.profilo,
            'ANALISI', // Placeholder stato
            w.computedTotal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
        ]);

        autoTable(doc, {
            startY: y + 8,
            head: [['DIPENDENTE', 'PROFILO', 'STATO', 'NETTO RECUPERABILE']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } },
            styles: { fontSize: 9, cellPadding: 3 },
        });

        doc.save(`Dashboard_Executive_${today.replace(/\//g, '-')}.pdf`);
    };

    const containerVars = { show: { transition: { staggerChildren: 0.08 } } };
    const itemVars = { hidden: { opacity: 0, y: 40, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 40, damping: 10 } } };

    return (
        <div className="min-h-screen bg-[#020617] font-sans text-slate-200 pb-20 relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">

            {/* SFONDO ANIMATO "DEEP SPACE" */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[20%] w-[1000px] h-[1000px] bg-indigo-500/10 rounded-full blur-[150px] animate-blob opacity-60 mix-blend-screen"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] animate-blob animation-delay-2000 opacity-60 mix-blend-screen"></div>
                <div className="absolute top-[40%] left-[-20%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] animate-blob animation-delay-4000 opacity-40 mix-blend-screen"></div>
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>

            {/* HEADER GLASS */}
            <div className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
                <div className="max-w-[1800px] mx-auto px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <button onClick={onBack} className="group p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-slate-400 hover:text-white shadow-lg active:scale-95">
                            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter">
                                <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_0_20px_-5px_rgba(99,102,241,0.6)]">
                                    <Activity className="w-6 h-6 text-white" />
                                </div>
                                EXECUTIVE
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                                    DASHBOARD
                                </span>
                            </h1>
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePrintReport}
                        className="relative group px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-2xl overflow-hidden border border-white/10"
                    >
                        <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_100%] animate-[shimmer_3s_infinite] bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
                        <div className="relative flex items-center gap-3 z-10 tracking-widest">
                            <Printer className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-12" />
                            <span>EXPORT REPORT</span>
                            <Download className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-y-0.5 transition-all" />
                        </div>
                    </motion.button>
                </div>
            </div>

            <motion.div
                className="max-w-[1800px] mx-auto p-8 space-y-8 relative z-10"
                variants={containerVars}
                initial="hidden"
                animate="show"
            >

                {/* --- GRID LAYOUT "BENTO" --- */}
                <div className="grid grid-cols-12 gap-6">

                    {/* 1. HERO CHART (Span 8) */}
                    <motion.div variants={itemVars} className="col-span-12 lg:col-span-8 bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden flex flex-col h-[450px] group hover:border-indigo-500/30 transition-colors duration-500">
                        <div className="p-8 pb-0 relative z-20 flex justify-between items-start">
                            <div>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                    Analisi Trend
                                </h2>
                                <div className="text-6xl font-black text-white tracking-tighter flex items-baseline gap-4 drop-shadow-2xl">
                                    <AnimatedCounter value={stats.totalRevenue} currency />

                                    {/* BADGE PERCENTUALE TOP TIER (FIXED) */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5, type: "spring" }}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] backdrop-blur-md self-center transform -translate-y-2"
                                    >
                                        <div className="bg-emerald-500 rounded-full p-0.5 flex items-center justify-center">
                                            <TrendingUp className="w-3 h-3 text-slate-900" strokeWidth={3} />
                                        </div>
                                        <span className="text-sm font-bold text-emerald-400">+14.5%</span>
                                    </motion.div>
                                </div>
                                <p className="text-slate-500 text-sm mt-2 font-medium">Performance globale rispetto al mese precedente</p>
                            </div>

                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner">
                                <TrendingUp className="w-8 h-8 text-indigo-400" />
                            </div>
                        </div>

                        {/* GRAFICO */}
                        <div className="absolute bottom-0 left-0 right-0 h-[300px] w-full z-10">
                            <InteractiveChart data={stats.chartData} />
                        </div>
                    </motion.div>

                    {/* 2. KPI VERTICALI (Span 4) */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

                        {/* KPI CARD 1 */}
                        <motion.div variants={itemVars} className="flex-1 bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden group hover:bg-slate-800/50 transition-all duration-300">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-bl-full blur-2xl transition-transform group-hover:scale-125"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4 text-blue-400">
                                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]"><Users className="w-6 h-6" /></div>
                                    <span className="text-xs font-black uppercase tracking-widest opacity-80">Pratiche Gestite</span>
                                </div>
                                <div className="text-5xl font-black text-white tracking-tighter drop-shadow-lg"><AnimatedCounter value={stats.totalWorkers} /></div>
                            </div>
                        </motion.div>

                        {/* KPI CARD 2 */}
                        <motion.div variants={itemVars} className="flex-1 bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden group hover:bg-slate-800/50 transition-all duration-300">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-bl-full blur-2xl transition-transform group-hover:scale-125"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4 text-amber-400">
                                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]"><Target className="w-6 h-6" /></div>
                                    <span className="text-xs font-black uppercase tracking-widest opacity-80">Media / Pratica</span>
                                </div>
                                <div className="text-5xl font-black text-white tracking-tighter drop-shadow-lg"><AnimatedCounter value={stats.avgRevenue} currency /></div>
                            </div>
                        </motion.div>

                    </div>

                    {/* 3. BREAKDOWN AZIENDE (Span 4) */}
                    <motion.div variants={itemVars} className="col-span-12 lg:col-span-4 bg-slate-900/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 shadow-xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-slate-800 rounded-xl text-slate-300 border border-slate-700"><Briefcase className="w-5 h-5" /></div>
                            <h3 className="text-xl font-black text-white tracking-tight">Distribuzione Aziende</h3>
                        </div>

                        <div className="space-y-8">
                            {Object.entries(stats.byProfile).map(([profile, data]: [string, { count: number, value: number }], idx) => {
                                const percent = (data.value / stats.totalRevenue) * 100 || 0;

                                let barColor = '#3b82f6';
                                let bgClass = 'bg-blue-500';
                                if (profile === 'ELIOR') { barColor = '#f97316'; bgClass = 'bg-orange-500'; }
                                if (profile === 'REKEEP') { barColor = '#10b981'; bgClass = 'bg-emerald-500'; }

                                return (
                                    <div key={profile} className="group">
                                        <div className="flex justify-between items-end mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg ${bgClass} bg-opacity-90`}>
                                                    {profile.substring(0, 1)}
                                                </div>
                                                <div>
                                                    <span className="block font-bold text-white text-lg leading-none tracking-tight">{profile}</span>
                                                    <span className="text-xs font-medium text-slate-500">{data.count} pratiche attive</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-black text-xl drop-shadow-md" style={{ color: barColor }}>{data.value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                                <span className="text-xs font-bold text-slate-600">{percent.toFixed(1)}% market share</span>
                                            </div>
                                        </div>

                                        {/* Barra Neon Inline */}
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-[2px] shadow-inner border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percent}%` }}
                                                transition={{ duration: 1.5, delay: 0.2 * idx, ease: "circOut" }}
                                                className="h-full rounded-full relative"
                                                style={{ backgroundColor: barColor }}
                                            >
                                                <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]"></div>
                                            </motion.div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* 4. LISTA CLASSIFICA (Span 5) */}
                    <motion.div variants={itemVars} className="col-span-12 lg:col-span-5 bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-xl overflow-hidden flex flex-col h-[600px]">
                        <div className="p-8 border-b border-white/5 bg-slate-900/80 sticky top-0 z-10 flex justify-between items-center backdrop-blur-md">
                            <h3 className="font-bold text-white text-lg flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                                Ranking Pratiche
                            </h3>
                            <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-white/5">{stats.list.length} records</span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {stats.list.map((w, idx) => (
                                <div key={w.id} className="group p-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 flex justify-between items-center cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-lg ${idx < 3 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_-2px_rgba(99,102,241,0.4)]' : 'bg-slate-800 text-slate-500'}`}>#{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{w.cognome} {w.nome}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${w.profilo === 'RFI' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    w.profilo === 'ELIOR' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    }`}>{w.profilo}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-400 text-sm tracking-tight drop-shadow-md">
                                            {w.computedTotal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                        </p>
                                        <ArrowUpRight className="w-3 h-3 text-slate-500 ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* 5. GOLD CARD PRESTIGE (Span 3) */}
                    {stats.topPerformer && (
                        <motion.div variants={itemVars}
                            className="col-span-12 lg:col-span-3 border p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white flex flex-col justify-between group"
                            style={{ background: 'linear-gradient(to bottom, #1e1b4b, #0f172a)', borderColor: 'rgba(250, 204, 21, 0.3)' }}
                        >
                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(250,204,21,0.2),transparent_70%)] pointer-events-none"></div>
                            {/* Particelle d'oro animate (simulate) */}
                            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 shadow-[0_0_15px_-3px_rgba(234,179,8,0.4)]">
                                    <Award className="w-4 h-4" /> Top Performer
                                </div>

                                {/* ICONA ORO CON RIFLESSO */}
                                <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-[0_10px_30px_-5px_rgba(234,179,8,0.4)] text-4xl font-black text-yellow-900 relative overflow-hidden bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50"></div>
                                    <span className="relative z-10">{stats.topPerformer.nome.charAt(0)}</span>
                                </div>

                                <h3 className="text-3xl font-black leading-none mb-1 tracking-tight text-white">{stats.topPerformer.cognome}</h3>
                                <h3 className="text-3xl font-light text-slate-400 leading-none mb-2">{stats.topPerformer.nome}</h3>
                                <p className="text-yellow-500/90 font-bold text-sm flex items-center gap-2 mt-4">
                                    <Zap className="w-4 h-4 fill-current animate-pulse" /> High Priority
                                </p>
                            </div>

                            <div className="mt-8 relative z-10 pt-6 border-t border-white/10">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valore Stimato</p>
                                <p className="text-4xl font-black text-transparent bg-clip-text drop-shadow-sm bg-gradient-to-r from-yellow-200 to-yellow-500">
                                    {stats.topPerformer.computedTotal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </motion.div>
                    )}

                </div>
            </motion.div>
        </div>
    );
};

export default StatsDashboard;