import React, { useMemo, useState, useRef } from 'react';
import { Worker, parseFloatSafe, getColumnsByProfile } from '../types';
import { motion } from 'framer-motion';
import { Tilt } from 'react-tilt';
import {
  UserCircle, Trash2, Edit, FileSpreadsheet, LayoutGrid, CalendarRange,
  TrainFront, Briefcase, RotateCw, ArrowLeft, CheckCircle2, AlertCircle,
  Send, FileBarChart, Clock, Wallet, Ticket, Layers, CreditCard, Activity,
  CalendarClock, TrendingUp
} from 'lucide-react';

// --- STILI CSS PER LA SCROLLBAR PERSONALIZZATA ---
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.05);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 10px;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.3);
  }
`;

// --- COMPONENTE SPARKLINE (FRONTE) ---
const Sparkline = ({ worker }: { worker: Worker }) => {
  const dataPoints = useMemo(() => {
    if (!worker.anni || !Array.isArray(worker.anni) || worker.anni.length === 0) return [15, 16, 15, 17, 16];
    const cols = getColumnsByProfile(worker.profilo);
    const values = worker.anni.slice(-10).map(anno => {
      let sum = 0;
      cols.forEach(col => { if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'note'].includes(col.id)) sum += parseFloatSafe(anno[col.id]); });
      return sum > 0 ? sum : (Math.random() * 200 + 300);
    });
    return values.length < 2 ? [40, 45, 42, 48] : values;
  }, [worker]);

  const width = 300;
  const height = 80;
  const max = Math.max(...dataPoints);
  const min = Math.min(...dataPoints);
  const range = max - min || 1;
  const points = dataPoints.map((val, i) => {
    const x = (i / (dataPoints.length - 1)) * width;
    const y = height - ((val - min) / range) * height * 0.7 - 5;
    return `${x},${y}`;
  });
  const pathD = `M 0,${height} L ${points[0]} L ${points.join(' L ')} L ${width},${height} Z`;
  const lineD = `M ${points[0]} L ${points.join(' L ')}`;

  const accent = worker.accentColor || 'indigo';
  const colorMap: any = { indigo: '#6366f1', emerald: '#10b981', orange: '#f97316', blue: '#3b82f6' };
  const hexColor = colorMap[accent] || '#3b82f6';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-28 overflow-hidden rounded-b-[2.5rem] pointer-events-none opacity-40 mix-blend-multiply" style={{ color: hexColor }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${worker.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={pathD} fill={`url(#grad-${worker.id})`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} />
        <motion.path d={lineD} fill="none" stroke="currentColor" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }} />
      </svg>
    </div>
  );
};

// --- MINI GRAFICO A BARRE DINAMICO (RETRO) ---
const BackChart = ({ worker, theme }: { worker: Worker, theme: any }) => {
  const bars = useMemo(() => {
    if (!worker.anni || !Array.isArray(worker.anni) || worker.anni.length === 0) {
      return [20, 30, 20, 30, 20, 30];
    }
    const lastData = worker.anni.slice(-6);
    const values = lastData.map(d => {
      const val = typeof d.daysWorked === 'string' ? parseFloat(d.daysWorked.replace(',', '.')) : d.daysWorked;
      return isNaN(val) ? 0 : val;
    });
    const filledValues = [...values];
    while (filledValues.length < 6) { filledValues.unshift(5); }
    const max = Math.max(...filledValues) || 1;
    return filledValues.map(v => Math.max(15, Math.round((v / max) * 100)));
  }, [worker.anni]);

  return (
    <div className="w-full h-16 flex items-end justify-between gap-1 px-1 my-3 opacity-90 pointer-events-none">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: `${height}%`, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.1, type: "spring" }}
          className="w-full rounded-t-sm opacity-70"
          style={{ backgroundColor: theme.rawColor.start }}
        />
      ))}
    </div>
  );
};

interface WorkerCardProps {
  worker: Worker;
  onOpenSimple: (id: number) => void;
  onOpenComplex: (id: number) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onOpenSimple, onOpenComplex, onEdit, onDelete }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  const RoleIcon = useMemo(() => {
    const role = (worker.ruolo || '').toLowerCase();
    if (role.includes('macchinista') || role.includes('capotreno') || role.includes('manovratore')) return TrainFront;
    if (role.includes('ufficio') || role.includes('impiegato')) return Briefcase;
    return UserCircle;
  }, [worker.ruolo]);

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'chiusa': return { color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200', dot: '#10b981', label: 'Conclusa', icon: CheckCircle2 };
      case 'inviata': return { color: 'bg-purple-100/80 text-purple-700 border-purple-200', dot: '#a855f7', label: 'PEC Inviata', icon: Send };
      case 'pronta': return { color: 'bg-amber-100/80 text-amber-700 border-amber-200', dot: '#f59e0b', label: 'Pronta', icon: FileBarChart };
      case 'trattativa': return { color: 'bg-rose-100/80 text-rose-700 border-rose-200', dot: '#f43f5e', label: 'In Trattativa', icon: AlertCircle };
      default: return { color: 'bg-slate-100/80 text-slate-500 border-slate-200', dot: '#94a3b8', label: 'Da Analizzare', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(worker.status);
  const StatusIcon = statusConfig.icon;

  const stats = useMemo(() => {
    if (!worker.anni || worker.anni.length === 0) return { percent: 0, label: 'Nuova', range: 'N.D.', preview: [] };
    const validMonths = worker.anni.filter(row => parseFloatSafe(row.daysWorked) > 0);
    const validCount = validMonths.length;
    const preview = [...validMonths].sort((a, b) => b.year - a.year).slice(0, 3);
    const years = validMonths.map(m => m.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const totalPossibleMonths = (maxYear - minYear + 1) * 12;
    let percentage = Math.min(Math.round((validCount / totalPossibleMonths) * 100), 100);
    return { percent: percentage, label: percentage === 100 ? 'Completa' : 'In Corso', range: minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`, preview };
  }, [worker.anni]);

  // --- CALCOLO FINANZIARIO CORRETTO (SIMULAZIONE TETTO 28GG) ---
  const financialStats = useMemo(() => {
    // 1. Configurazioni Base
    const TETTO_MAX = 28; // Standard conservativo per la card
    const cols = getColumnsByProfile(worker.profilo).filter(c => !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note'].includes(c.id));

    let totalLordo = 0;
    let totalPercepito = 0;
    let totalTicket = 0;
    let totalFerieUtili = 0;

    // 2. Ordinamento Cronologico (Essenziale per il calcolo progressivo)
    const sortedRows = [...(worker.anni || [])].sort((a, b) =>
      a.year - b.year || a.monthIndex - b.monthIndex
    );

    // 3. Raggruppamento per Anno (Reset del contatore ferie)
    const years = Array.from(new Set(sortedRows.map(r => r.year)));

    years.forEach(year => {
      const yearRows = sortedRows.filter(r => r.year === year);
      let ferieCounter = 0;

      yearRows.forEach(row => {
        // A. Calcolo Variabili Mese
        let monthlyVars = 0;
        cols.forEach(col => { monthlyVars += parseFloatSafe(row[col.id]); });

        // B. Dati Base
        const ggLav = parseFloatSafe(row.daysWorked);
        const ggFerieReali = parseFloatSafe(row.daysVacation);
        const coeffP = parseFloatSafe(row['coeffPercepito']);
        const coeffT = parseFloatSafe(row['coeffTicket']);

        // C. Logica Tetto (Il Fix Importante)
        const prevTotal = ferieCounter;
        ferieCounter += ggFerieReali;

        let ggUtili = 0;
        if (prevTotal < TETTO_MAX) {
          const spazio = TETTO_MAX - prevTotal;
          ggUtili = Math.min(ggFerieReali, spazio);
        }

        totalFerieUtili += ggUtili;

        // D. Calcolo Economico sui GG UTILI
        if (ggLav > 0) {
          totalLordo += (monthlyVars / ggLav) * ggUtili;
        }
        totalPercepito += (ggUtili * coeffP);
        totalTicket += (ggUtili * coeffT);
      });
    });

    // Risultato Finale
    return {
      netto: (totalLordo - totalPercepito) + totalTicket,
      ticket: totalTicket,
      lordo: totalLordo,
      ferie: totalFerieUtili
    };
  }, [worker]);

  // --- TEMA E STILI ---
  const theme = useMemo(() => {
    const color = worker.accentColor || 'indigo';
    const hexMap: any = {
      indigo: { start: '#6366f1', end: '#8b5cf6', text: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', glow: 'rgba(99, 102, 241, 0.5)' },
      emerald: { start: '#10b981', end: '#14b8a6', text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', glow: 'rgba(16, 185, 129, 0.5)' },
      orange: { start: '#f97316', end: '#ef4444', text: '#ea580c', bg: '#fff7ed', border: '#fed7aa', glow: 'rgba(249, 115, 22, 0.5)' },
      blue: { start: '#3b82f6', end: '#06b6d4', text: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(59, 130, 246, 0.5)' }
    };
    const c = hexMap[color] || hexMap.blue;

    return {
      rawColor: c,
      spotlight: c.glow.replace('0.5', '0.25'),
      iconStyle: { color: c.text },
      iconBgStyle: { backgroundColor: c.bg, borderColor: c.border },
      btnTextStyle: { color: c.text },
      gradientStyle: { background: `linear-gradient(90deg, ${c.start} 0%, ${c.end} 100%)` },
      backGradientStyle: { background: `linear-gradient(135deg, ${c.bg}E6 0%, rgba(255,255,255,0.9) 50%, ${c.bg}E6 100%)` },
      textGradientStyle: { background: `linear-gradient(90deg, ${c.start} 0%, ${c.end} 100%)`, WebkitBackgroundClip: 'text', color: 'transparent' },
      shadowStyle: { '--shadow-color': c.glow } as React.CSSProperties
    };
  }, [worker.accentColor]);

  const badgeStyles = useMemo(() => {
    switch (worker.profilo) {
      case 'ELIOR': return 'bg-orange-100/50 text-orange-700 border-orange-200';
      case 'REKEEP': return 'bg-emerald-100/50 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-100/50 text-blue-700 border-blue-200';
    }
  }, [worker.profilo]);

  const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

  return (
    <>
      <style>{scrollbarStyles}</style>
      <motion.div variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} className="relative w-full h-full [perspective:1500px]">
        <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.8, type: "spring", stiffness: 50, damping: 15 }} className="relative w-full h-full [transform-style:preserve-3d]">

          {/* LATO FRONTALE */}
          <div className="w-full h-full [backface-visibility:hidden]">
            <Tilt options={{ max: 10, scale: 1.02, speed: 1000, glare: true, "max-glare": 0.3 }} className="w-full h-full">
              <div ref={divRef} onMouseMove={handleMouseMove} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
                className="group relative w-full h-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/60 dark:border-slate-600 rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01]"
                style={{ ...theme.shadowStyle, borderColor: opacity > 0 ? theme.rawColor.start : '' }}
              >
                <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: noiseBg, opacity: 0.4 }}></div>
                <div className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 z-10" style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${theme.spotlight}, transparent 40%)` }} />

                <div className="relative p-7 flex flex-col h-full z-20">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-500 group-hover:rotate-3 group-hover:scale-110" style={theme.iconBgStyle}>
                        <RoleIcon className="w-8 h-8" style={theme.iconStyle} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none tracking-tight uppercase">{worker.cognome}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border shadow-sm backdrop-blur-md ${badgeStyles}`}>{worker.profilo}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 leading-none capitalize">{worker.nome}</h3>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                      <button onClick={() => setIsFlipped(true)} className="p-2 text-slate-400 hover:text-indigo-500 transition-all hover:scale-125 hover:rotate-[360deg] duration-700"><RotateCw className="w-5 h-5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onEdit(e); }} className="p-2 text-slate-400 hover:text-blue-500 transition-all hover:scale-125 hover:rotate-12"><Edit className="w-5 h-5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-red-500 transition-all hover:scale-125 hover:-rotate-12"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm w-fit backdrop-blur-md ${statusConfig.color}`}>
                      <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: statusConfig.dot }}></span>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wide">{statusConfig.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="px-3 py-1.5 rounded-xl bg-white/50 border border-slate-200/60 text-[10px] font-bold text-slate-500 capitalize shadow-sm backdrop-blur-sm">{worker.ruolo || 'N.D.'}</span>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/50 border border-slate-200/60 shadow-sm backdrop-blur-sm">
                        <CalendarRange className="w-3.5 h-3.5" style={theme.iconStyle} />
                        <span className="text-[10px] font-black text-slate-700 tracking-tight">{stats.range}</span>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-end px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stats.label}</span>
                        <span className="text-xs font-black" style={theme.iconStyle}>{stats.percent}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200/50 rounded-full overflow-hidden border border-slate-100/50 p-[2px] shadow-inner backdrop-blur-sm">
                        <div className="h-full rounded-full shadow-[0_0_10px_currentColor] transition-all duration-1000 ease-out relative" style={{ ...theme.gradientStyle, width: `${stats.percent}%` }}>
                          <div className="absolute inset-0 bg-white/40 w-full animate-[shimmer_2s_infinite] skew-x-12"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-3 relative z-30">
                    <motion.button
                      initial="idle"
                      whileHover="hover"
                      whileTap="tap"
                      variants={{ idle: { scale: 1 }, hover: { scale: 1.05 }, tap: { scale: 0.95 } }}
                      onClick={() => onOpenComplex(worker.id)}
                      className="flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl bg-white/40 border border-white/60 text-slate-500 text-[9px] font-black tracking-tighter shadow-sm hover:shadow-lg hover:border-white hover:bg-white/80 backdrop-blur-md transition-all group"
                    >
                      <motion.div variants={{ idle: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.2 } }} transition={{ type: "spring", stiffness: 200, damping: 10 }}>
                        <LayoutGrid className="w-4 h-4" />
                      </motion.div>
                      <span className="group-hover:text-current transition-colors" style={{ color: 'inherit' }}>GESTIONE BUSTE PAGA</span>
                    </motion.button>

                    <motion.button
                      initial="idle"
                      whileHover="hover"
                      whileTap="tap"
                      variants={{ idle: { scale: 1, boxShadow: "0 0 0px 0px rgba(0,0,0,0)" }, hover: { scale: 1.05, boxShadow: `0 0 25px -5px ${theme.rawColor.glow}` }, tap: { scale: 0.95 } }}
                      onClick={() => onOpenSimple(worker.id)}
                      className="relative overflow-hidden flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-white text-[10px] font-black tracking-tighter shadow-lg transition-all"
                      style={theme.gradientStyle}
                    >
                      <motion.div variants={{ idle: { y: 0 }, hover: { y: [0, -4, 0], transition: { repeat: Infinity, duration: 0.6 } } }}>
                        <FileSpreadsheet className="w-4 h-4 text-white/90" />
                      </motion.div>
                      <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-500 skew-x-12" />REPORT
                    </motion.button>
                  </div>
                </div>
                <Sparkline worker={worker} />
              </div>
            </Tilt>
          </div>

          {/* LATO POSTERIORE */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <Tilt options={{ max: 10, scale: 1.02, speed: 1000, glare: true, "max-glare": 0.3 }} className="w-full h-full">
              <div className="w-full h-full backdrop-blur-3xl border border-white/60 rounded-[2.5rem] flex flex-col shadow-2xl relative overflow-hidden" style={theme.backGradientStyle}>

                {/* Header Fisso */}
                <div className="flex-none p-7 pb-4 relative z-20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: theme.rawColor.start }}></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Financial Overview</span>
                    </div>
                    <button onClick={() => setIsFlipped(false)} className="group p-2 bg-white/60 border border-white/50 rounded-full shadow-sm hover:scale-110 transition-all hover:bg-white text-slate-400 hover:text-indigo-600">
                      <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
                    </button>
                  </div>
                </div>

                {/* AREA SCROLLABILE */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-7 pb-4 relative z-10">

                  {/* DISPLAY NETTO */}
                  <div className="relative overflow-hidden p-5 rounded-[2rem] bg-white/50 border border-white/60 shadow-lg backdrop-blur-md mb-4 group transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: theme.rawColor.start }}></div>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">RECUPERO TOTALE (Stimato 28gg)</p>
                      <Wallet className="w-4 h-4 opacity-60" style={theme.iconStyle} />
                    </div>
                    <p className="text-3xl font-black tracking-tight bg-clip-text text-transparent" style={theme.textGradientStyle}>
                      {financialStats.netto.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>

                  {/* GRAFICO TREND */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1 px-1">
                      <p className="text-[8px] font-bold uppercase text-slate-400">Trend Storico</p>
                      <TrendingUp className="w-3 h-3 text-slate-300" />
                    </div>
                    <BackChart worker={worker} theme={theme} />
                  </div>

                  {/* BOX TICKET */}
                  <div className="p-4 rounded-[1.5rem] bg-white/40 border border-white/50 shadow-sm backdrop-blur-sm flex items-center justify-between mb-3 hover:bg-white/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-500" />
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Valore Ticket</span>
                    </div>
                    <p className="text-lg font-black text-slate-600">
                      {financialStats.ticket.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }).replace(',00', '')}
                    </p>
                  </div>

                  {/* GRIGLIA FINALE */}
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="p-3 rounded-[1.5rem] bg-white/40 border border-white/50 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center text-center hover:bg-white/60 transition-colors">
                      <Layers className="w-3.5 h-3.5 text-blue-400 mb-1" />
                      <p className="text-[7px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Lordo</p>
                      <p className="text-sm font-black text-slate-600">
                        {financialStats.lordo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }).replace(',00', '')}
                      </p>
                    </div>

                    <div className="p-3 rounded-[1.5rem] bg-white/40 border border-white/50 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center text-center hover:bg-white/60 transition-colors">
                      <CalendarClock className="w-3.5 h-3.5 mb-1" style={theme.iconStyle} />
                      <p className="text-[7px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">G. Utili</p>
                      <p className="text-sm font-black" style={theme.iconStyle}>
                        {financialStats.ferie.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Fisso */}
                <div className="flex-none p-4 pt-3 border-t border-slate-200/30 flex justify-between items-center opacity-70 relative z-20 bg-white/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">ID: {worker.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/50 border border-white/50">
                    <Activity className="w-2.5 h-2.5" style={theme.iconStyle} />
                    <span className="text-[7px] font-bold text-slate-500">ACTIVE</span>
                  </div>
                </div>

                {/* Sfondo Decorativo */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={{ backgroundImage: noiseBg }}></div>
                <div className="absolute top-[-20%] right-[-20%] w-64 h-64 rounded-full blur-[60px] opacity-20 animate-pulse pointer-events-none" style={{ backgroundColor: theme.rawColor.start }}></div>
                <div className="absolute bottom-[-20%] left-[-20%] w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none" style={{ backgroundColor: theme.rawColor.start }}></div>

              </div>
            </Tilt>
          </div>

        </motion.div>
      </motion.div>
    </>
  );
};

export default WorkerCard;