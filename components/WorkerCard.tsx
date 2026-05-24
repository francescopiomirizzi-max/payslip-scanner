import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Worker, getColumnsByProfile } from '../types';
import { SYSTEM_PROFILES, getCustomColorIndex } from '../config/profiles';
import { parseLocalFloat, getProfiloBadgeLabel } from '../utils/formatters';
import { computeHolidayIndemnity } from '../utils/calculationEngine';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle, Trash2, Edit, FileSpreadsheet, LayoutGrid, CalendarRange,
  TrainFront, Briefcase, RotateCw, ArrowLeft, CheckCircle2, AlertCircle,
  Send, FileBarChart, Clock, Wallet, Ticket, Layers, CreditCard, Activity,
  TrendingUp, Ban, CalendarClock, ChevronDown, Archive, MoreHorizontal, Handshake,
  BarChart3,
} from 'lucide-react';

// --- STILI CSS ---
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 10px; }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.3); }
`;



// --- COMPONENTE SPARKLINE (FRONTE) ---
// Mostra il trend economico degli ultimi 12 mesi. Se non ci sono almeno 2 mesi
// con valori reali > 0, non si inventano dati: si mostra un piccolo segnale
// "in attesa" — tre puntini pulsanti nel colore accent della card.
const Sparkline = ({ worker }: { worker: Worker }) => {
  const dataPoints = useMemo(() => {
    if (!worker.anni || !Array.isArray(worker.anni) || worker.anni.length === 0) return null;
    const cols = getColumnsByProfile(worker.profilo, worker.eliorType);

    const sortedData = [...worker.anni].sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);

    const values = sortedData.slice(-12).map(anno => {
      let sum = 0;
      cols.forEach(col => {
        if (!['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'note', 'arretrati', 'coeffPercepito', 'coeffTicket'].includes(col.id))
          sum += parseLocalFloat(anno[col.id]);
      });
      return sum;
    });

    return values.length >= 2 && values.some(v => v > 0) ? values : null;
  }, [worker]);

  const accent = worker.accentColor || 'indigo';
  const colorMap: any = { indigo: '#6366f1', emerald: '#10b981', orange: '#f97316', blue: '#3b82f6', rose: '#f43f5e', violet: '#8b5cf6', teal: '#14b8a6' };
  const hexColor = colorMap[accent] || '#3b82f6';

  if (!dataPoints) {
    return (
      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none flex items-end justify-center pb-5">
        <div className="flex items-center gap-1.5 opacity-60">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.25, 0.75, 0.25], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: hexColor }}
            />
          ))}
        </div>
      </div>
    );
  }

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
// Mostra il trend economico degli ultimi 10 mesi a partire dallo startYear.
// Per il tool di perizie legali è essenziale non inventare dati: se non c'è
// nessun mese con valore reale > 0, si mostra uno stato vuoto esplicito invece
// di barre fittizie. Le barre reali a valore 0 si vedono come stub minimo (4%).
const BackChart = ({ worker, theme, startYear }: { worker: Worker, theme: any, startYear: number }) => {
  const bars = useMemo(() => {
    if (!worker.anni || !Array.isArray(worker.anni) || worker.anni.length === 0) return null;

    const validData = worker.anni
      .filter(d => Number(d.year) >= startYear)
      .sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);

    const lastData = validData.slice(-10);

    const cols = getColumnsByProfile(worker.profilo, worker.eliorType);
    const values = lastData.map(d => {
      let sum = 0;
      cols.forEach(col => {
        if (!['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'note', 'arretrati'].includes(col.id))
          sum += parseLocalFloat(d[col.id]);
      });
      return sum;
    });

    if (values.length === 0 || !values.some(v => v > 0)) return null;

    const max = Math.max(...values) || 1;
    return values.map(v => v > 0 ? Math.max(15, Math.round((v / max) * 100)) : 4);
  }, [worker.anni, startYear]);

  if (!bars) {
    return (
      <div className="w-full h-16 flex items-center justify-center my-3 px-1">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/40 dark:bg-slate-900/40 border border-dashed backdrop-blur-sm shadow-sm"
          style={{ borderColor: `${theme.rawColor.start}55` }}
        >
          <motion.div
            animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.12, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <BarChart3 className="w-3.5 h-3.5" style={{ color: theme.rawColor.start }} />
          </motion.div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            In attesa di buste paga
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-16 flex items-end justify-between gap-1 px-1 my-3 opacity-90 pointer-events-none">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: `${height}%`, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.05, type: "spring" }}
          className="w-full rounded-t-sm opacity-70"
          style={{ backgroundColor: theme.rawColor.start }}
        />
      ))}
    </div>
  );
};

const STATUS_PICKER_OPTIONS = [
  { value: '', label: 'Da Analizzare', dot: '#94a3b8' },
  { value: 'pronta', label: 'Conteggi', dot: '#f59e0b' },
  { value: 'inviata', label: 'Buste Paga Mancanti', dot: '#ef4444' },
  { value: 'trattativa', label: 'Conclusa', dot: '#14b8a6' },
  { value: 'chiusa', label: 'Pagata', dot: '#10b981' },
] as const;

interface WorkerCardProps {
  worker: Worker;
  onOpenSimple: (id: string) => void;
  onOpenComplex: (id: string) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onStatusChange?: (id: string, status: string) => void;
  onNotesChange?: (id: string, notes: string) => void;
  onOpenArchive?: (id: string) => void;
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onOpenSimple, onOpenComplex, onEdit, onDelete, onStatusChange, onNotesChange, onOpenArchive }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(worker.notes ?? '');
  const divRef = useRef<HTMLDivElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusPortalRef = useRef<HTMLDivElement>(null);
  const [statusPortalPos, setStatusPortalPos] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isStatusOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!statusBtnRef.current?.contains(t) && !statusPortalRef.current?.contains(t)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isStatusOpen]);

  useEffect(() => {
    if (!isActionsOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isActionsOpen]);

  // --- STATI SINCRONIZZATI COL DETTAGLIO ---
  // Derivati direttamente dalla prop worker (aggiornata da onUpdateWorkerFields)
  // con fallback a localStorage per compatibilità con dati precedenti alla migrazione
  const includeTickets = worker.includeTickets ?? (
    localStorage.getItem(`tickets_${worker.id}`) !== null
      ? JSON.parse(localStorage.getItem(`tickets_${worker.id}`)!)
      : true
  );
  const startClaimYear = worker.startClaimYear ?? (
    localStorage.getItem(`startYear_${worker.id}`)
      ? parseInt(localStorage.getItem(`startYear_${worker.id}`)!)
      : 2008
  );
  const includeExFest = worker.includeExFest ?? (
    localStorage.getItem(`exFest_${worker.id}`) !== null
      ? JSON.parse(localStorage.getItem(`exFest_${worker.id}`)!)
      : false
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x, y });
    setTilt({
      x: -((y / rect.height) - 0.5) * 18,
      y:  ((x / rect.width)  - 0.5) * 18,
    });
  };
  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => { setOpacity(0); setTilt({ x: 0, y: 0 }); };

  const RoleIcon = useMemo(() => {
    const role = (worker.ruolo || '').toLowerCase();
    if (role.includes('macchinista') || role.includes('capotreno') || role.includes('manovratore')) return TrainFront;
    if (role.includes('ufficio') || role.includes('impiegato')) return Briefcase;
    return UserCircle;
  }, [worker.ruolo]);

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'chiusa': return { color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200', dot: '#10b981', label: 'Pagata', icon: CheckCircle2 };
      case 'inviata': return { color: 'bg-red-100/80 text-red-700 border-red-200', dot: '#ef4444', label: 'Buste Paga Mancanti', icon: AlertCircle };
      case 'pronta': return { color: 'bg-amber-100/80 text-amber-700 border-amber-200', dot: '#f59e0b', label: 'Conteggi', icon: FileBarChart };
      case 'trattativa': return { color: 'bg-teal-100/80 text-teal-700 border-teal-200', dot: '#14b8a6', label: 'Conclusa', icon: Handshake };
      default: return { color: 'bg-slate-100/80 text-slate-500 border-slate-200', dot: '#94a3b8', label: 'Da Analizzare', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(worker.status);
  const StatusIcon = statusConfig.icon;

  // --- STATS PROGRESSO DATI ---
  const stats = useMemo(() => {
    if (!worker.anni || worker.anni.length === 0) {
      return { percent: 0, label: 'Nuova', range: 'N.D.', preview: [] };
    }
    const validRows = worker.anni.filter(row => parseLocalFloat(row.daysWorked) > 0);
    const yearsWithData = validRows.map(m => m.year);
    const maxYear = yearsWithData.length > 0 ? Math.max(...yearsWithData) : new Date().getFullYear();

    if (maxYear < startClaimYear) {
      return { percent: 0, label: 'Da Iniziare', range: `${startClaimYear}-...`, preview: [] };
    }

    const totalYearsSpan = maxYear - startClaimYear + 1;
    const totalMonthsPossible = totalYearsSpan * 12;
    const validMonthsCount = validRows.filter(row => row.year >= startClaimYear && row.year <= maxYear).length;

    let percentage = 0;
    if (totalMonthsPossible > 0) percentage = Math.round((validMonthsCount / totalMonthsPossible) * 100);

    const preview = [...validRows].sort((a, b) => b.year - a.year || b.monthIndex - a.monthIndex).slice(0, 3);

    return {
      percent: Math.min(percentage, 100),
      label: percentage >= 100 ? 'Completa' : percentage === 0 ? 'In Attesa' : 'In Corso',
      range: `${startClaimYear}-${maxYear}`,
      preview
    };
  }, [worker.anni, startClaimYear]);

  // --- CALCOLO FINANZIARIO — MOTORE UNIFICATO ---
  const financialStats = useMemo(() => {
    const safeAnni = Array.isArray(worker.anni) ? worker.anni : [];
    const allYears = (Array.from(new Set(safeAnni.map(d => Number(d.year)))) as number[])
      .filter(y => !isNaN(y))
      .sort((a, b) => a - b);

    const results = computeHolidayIndemnity({
      data: safeAnni,
      profilo: worker.profilo,
      eliorType: worker.eliorType,
      includeExFest,
      includeTickets,
      startClaimYear,
      years: allYears,
    });

    let totalLordo = 0;
    let totalTicket = 0;
    let totalPercepito = 0;
    let totalFerieUtili = 0;

    results.forEach(r => {
      if (r.isReferenceYear) return;
      totalLordo += r.sumIndennitaSpettante;
      totalTicket += r.sumBuoniPasto;
      totalPercepito += r.sumIndennitaPercepita;
      totalFerieUtili += r.sumGiorniFerieUtili;
    });

    return {
      netto: (totalLordo - totalPercepito) + totalTicket,
      ticket: totalTicket,
      lordo: totalLordo,
      ferie: totalFerieUtili
    };
  }, [worker, includeTickets, startClaimYear, includeExFest]);

  // --- TEMA E STILI ---
  const theme = useMemo(() => {
    const color = worker.accentColor || 'indigo';
    const hexMap: any = {
      indigo:  { start: '#6366f1', end: '#8b5cf6', text: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', glow: 'rgba(99, 102, 241, 0.5)',  classes: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700/50 text-indigo-600 dark:text-indigo-400' },
      emerald: { start: '#10b981', end: '#14b8a6', text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', glow: 'rgba(16, 185, 129, 0.5)',  classes: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/50 text-emerald-600 dark:text-emerald-400' },
      orange:  { start: '#f97316', end: '#ef4444', text: '#ea580c', bg: '#fff7ed', border: '#fed7aa', glow: 'rgba(249, 115, 22, 0.5)',  classes: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700/50 text-orange-600 dark:text-orange-400' },
      blue:    { start: '#3b82f6', end: '#06b6d4', text: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', glow: 'rgba(59, 130, 246, 0.5)',  classes: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 text-blue-600 dark:text-cyan-400' },
      rose:    { start: '#f43f5e', end: '#fb923c', text: '#e11d48', bg: '#fff1f2', border: '#fecdd3', glow: 'rgba(244, 63, 94, 0.5)',   classes: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400' },
      violet:  { start: '#8b5cf6', end: '#d946ef', text: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', glow: 'rgba(139, 92, 246, 0.5)', classes: 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700/50 text-violet-600 dark:text-violet-400' },
      teal:    { start: '#14b8a6', end: '#06b6d4', text: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', glow: 'rgba(20, 184, 166, 0.5)',  classes: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700/50 text-teal-600 dark:text-teal-400' }
    };
    const c = hexMap[color] || hexMap.blue;

    return {
      rawColor: c,
      spotlight: c.glow.replace('0.5', '0.25'),
      iconClasses: c.classes, // <--- LA NOSTRA NUOVA MAGIA TAILWIND
      iconStyle: { color: c.text }, // (Mantenuto per vecchi elementi)
      iconBgStyle: { backgroundColor: c.bg, borderColor: c.border }, // (Mantenuto per sicurezza)
      btnTextStyle: { color: c.text },
      gradientStyle: { background: `linear-gradient(90deg, ${c.start} 0%, ${c.end} 100%)` },
      backGradientStyle: { background: `linear-gradient(135deg, ${c.bg}E6 0%, rgba(255,255,255,0.9) 50%, ${c.bg}E6 100%)` },
      textGradientStyle: { background: `linear-gradient(90deg, ${c.start} 0%, ${c.end} 100%)`, WebkitBackgroundClip: 'text', color: 'transparent' },
      shadowStyle: { '--shadow-color': c.glow } as React.CSSProperties
    };
  }, [worker.accentColor]);

  const badgeStyles = useMemo(() => {
    if (!worker.profilo) return 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
    if (SYSTEM_PROFILES[worker.profilo]) return SYSTEM_PROFILES[worker.profilo].badge.card;

    // AZIENDE CUSTOM: Palette premium esclusiva (niente blu/arancio/verde base)
    const customPalette = [
      'bg-fuchsia-100/50 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-700/50',
      'bg-violet-100/50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-700/50',
      'bg-cyan-100/50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700/50',
      'bg-rose-100/50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700/50',
      'bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700/50',
      'bg-teal-100/50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-700/50'
    ];
    // Hash deterministico nome-azienda → colore fisso
    return customPalette[getCustomColorIndex(worker.profilo)];
  }, [worker.profilo]);

  const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

  return (
    <>
      <style>{scrollbarStyles}</style>
      <motion.div variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} className="relative w-full h-full" style={{ perspective: '1500px' }}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : tilt.y, rotateX: isFlipped ? 0 : tilt.x }}
          transition={isFlipped
            ? { rotateY: { type: "spring", stiffness: 260, damping: 45 }, rotateX: { type: "spring", stiffness: 260, damping: 45 } }
            : { type: "spring", stiffness: 400, damping: 35 }
          }
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
        >

          {/* LATO FRONTALE */}
          <div className="w-full h-full" style={{ backfaceVisibility: 'hidden', willChange: 'transform' }}>
              <div ref={divRef} onMouseMove={handleMouseMove} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
                className="group relative w-full h-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/60 dark:border-slate-600 rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01]"
                style={{ ...theme.shadowStyle, borderColor: opacity > 0 ? theme.rawColor.start : '' }}
              >
                <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: noiseBg, opacity: 0.4 }}></div>
                <div className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 z-10" style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${theme.spotlight}, transparent 40%)` }} />

                <div className="absolute left-0 top-10 bottom-10 w-[3px] rounded-full z-30 transition-colors duration-500" style={{ backgroundColor: statusConfig.dot, boxShadow: `0 0 10px 2px ${statusConfig.dot}50` }} />

                <div className="relative p-7 flex flex-col h-full z-20 pl-8">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm transition-all duration-500 group-hover:rotate-3 group-hover:scale-110 shrink-0 ${theme.iconClasses}`}>
                      <RoleIcon className="w-8 h-8" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight tracking-tight uppercase truncate">{worker.cognome}</h3>
                      <h3 className="text-base font-bold text-slate-500 dark:text-slate-400 leading-snug capitalize truncate">{worker.nome}</h3>
                      <span className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border shadow-sm backdrop-blur-md ${badgeStyles}`}>{getProfiloBadgeLabel(worker.profilo, worker.eliorType, true)}</span>
                    </div>

                    {/* Tasto ruota + Menu ••• */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setIsFlipped(true)}
                        className="p-2 rounded-xl opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all duration-200 hover:rotate-180"
                        title="Ruota card"
                      >
                        <RotateCw className="w-[18px] h-[18px] text-slate-500 dark:text-slate-400 transition-transform duration-500" />
                      </button>

                    <div className="relative" ref={actionsMenuRef}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsActionsOpen(prev => !prev); }}
                        className={`p-2 rounded-xl transition-all duration-200 ${isActionsOpen ? 'bg-slate-100 dark:bg-slate-700 opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
                      >
                        <MoreHorizontal className="w-[18px] h-[18px] text-slate-500 dark:text-slate-400" />
                      </button>

                      <AnimatePresence>
                        {isActionsOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.88, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.88, y: -8 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                            style={{ transformOrigin: 'top right' }}
                            className="absolute top-full right-0 mt-2 z-50 w-60 bg-white/96 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden"
                          >
                            {/* Header */}
                            <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Azioni pratica</p>
                              <p className="text-[12px] font-black text-slate-700 dark:text-slate-200 mt-0.5 truncate">{worker.cognome} {worker.nome}</p>
                            </div>

                            {/* Voci */}
                            <div className="p-2 space-y-0.5">
                              {[
                                ...(onOpenArchive ? [{
                                  icon: <Archive className="w-4 h-4 text-white" />,
                                  label: 'Archivio buste paga',
                                  iconBg: 'bg-violet-500',
                                  hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-950/60',
                                  hoverText: 'hover:text-violet-700 dark:hover:text-violet-300',
                                  onClick: (e: React.MouseEvent) => { e.stopPropagation(); onOpenArchive(worker.id); setIsActionsOpen(false); },
                                }] : []),
                                {
                                  icon: <Edit className="w-4 h-4 text-white" />,
                                  label: 'Modifica pratica',
                                  iconBg: 'bg-sky-500',
                                  hoverBg: 'hover:bg-sky-50 dark:hover:bg-sky-950/60',
                                  hoverText: 'hover:text-sky-700 dark:hover:text-sky-300',
                                  onClick: (e: React.MouseEvent) => { e.stopPropagation(); onEdit(e); setIsActionsOpen(false); },
                                },
                              ].map((item, i) => (
                                <motion.button
                                  key={i}
                                  initial={{ opacity: 0, x: 6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
                                  onClick={item.onClick}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group/item ${item.hoverBg}`}
                                >
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${item.iconBg} transition-transform duration-200 group-hover/item:scale-110`}>
                                    {item.icon}
                                  </div>
                                  <span className={`text-[13px] font-bold text-slate-600 dark:text-slate-300 transition-colors ${item.hoverText}`}>{item.label}</span>
                                </motion.button>
                              ))}

                              <div className="mx-2 h-px bg-slate-100 dark:bg-slate-800 my-1.5" />

                              {/* Elimina — separato e rosso */}
                              <motion.button
                                initial={{ opacity: 0, x: 6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (onOpenArchive ? 2 : 1) * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
                                onClick={(e) => { e.stopPropagation(); onDelete(); setIsActionsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-950/40 group/del"
                              >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-500 shadow-sm transition-transform duration-200 group-hover/del:scale-110">
                                  <Trash2 className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-[13px] font-bold text-red-500/80 group-hover/del:text-red-600 dark:group-hover/del:text-red-400 transition-colors">Elimina pratica</span>
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    </div> {/* chiude flex items-center gap-0.5 */}
                  </div>

                  <div className="flex-1 min-h-0 space-y-4">
                    <div className="relative">
                      <button
                        ref={statusBtnRef}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isStatusOpen && statusBtnRef.current) {
                            const r = statusBtnRef.current.getBoundingClientRect();
                            setStatusPortalPos({ top: r.bottom + 6, left: r.left });
                          }
                          setIsStatusOpen(prev => !prev);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm w-fit backdrop-blur-md transition-all hover:opacity-80 ${statusConfig.color} dark:bg-opacity-20 dark:border-opacity-30`}
                      >
                        <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: statusConfig.dot }} />
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{statusConfig.label}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isStatusOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isStatusOpen && statusPortalPos && ReactDOM.createPortal(
                        <div
                          ref={statusPortalRef}
                          style={{ position: 'fixed', top: statusPortalPos.top, left: statusPortalPos.left, zIndex: 9999 }}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden min-w-[160px]"
                        >
                          {STATUS_PICKER_OPTIONS.map(opt => {
                            const isCurrent = worker.status === opt.value || (!worker.status && opt.value === '');
                            return (
                              <button
                                key={opt.value}
                                onClick={(e) => { e.stopPropagation(); onStatusChange?.(worker.id, opt.value); setIsStatusOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-bold text-left transition-colors ${isCurrent ? 'bg-slate-50 dark:bg-slate-700/50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                                <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wide">{opt.label}</span>
                                {isCurrent && <span className="ml-auto text-slate-400 text-[10px]">✓</span>}
                              </button>
                            );
                          })}
                        </div>,
                        document.body
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 min-w-0">
                      <span className="flex-1 min-w-0 truncate px-3 py-1.5 rounded-xl bg-white/50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize shadow-sm backdrop-blur-sm transition-colors">{worker.ruolo || 'N.D.'}</span>
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-sm backdrop-blur-sm transition-colors">
                        <CalendarRange className="w-3.5 h-3.5" style={theme.iconStyle} />
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 tracking-tight transition-colors">{stats.range}</span>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-end px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 transition-colors">{stats.label}</span>
                        <span className="text-xs font-black" style={theme.iconStyle}>{stats.percent}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200/50 dark:bg-slate-900/80 rounded-full overflow-hidden border border-slate-100/50 dark:border-slate-800/80 p-[2px] shadow-inner backdrop-blur-sm transition-colors">
                        <div className="h-full rounded-full shadow-[0_0_10px_currentColor] transition-all duration-1000 ease-out relative" style={{ ...theme.gradientStyle, width: `${stats.percent}%` }}>
                          <div className="absolute inset-0 bg-white/40 dark:bg-white/20 w-full animate-[shimmer_2s_infinite] skew-x-12"></div>
                        </div>
                      </div>
                    </div>

                    {worker.notes && worker.notes.trim() && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-snug line-clamp-2 px-1 pt-1">
                        "{worker.notes.trim()}"
                      </p>
                    )}

                    {financialStats.netto > 0 && (
                      <div className={`grid gap-2 pt-1 ${includeTickets ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div className="px-3 py-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-md hover:shadow-emerald-500/10">
                          <div className="flex items-center gap-1 mb-1">
                            <Wallet className="w-2.5 h-2.5 text-emerald-500/80 dark:text-emerald-400/70" />
                            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/60">Credito</p>
                          </div>
                          <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                            {financialStats.netto.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        {includeTickets && (
                          <div className="px-3 py-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-md hover:shadow-amber-500/10">
                            <div className="flex items-center gap-1 mb-1">
                              <Ticket className="w-2.5 h-2.5 text-amber-500/80 dark:text-amber-400/70" />
                              <p className="text-[8px] font-black uppercase tracking-widest text-amber-600/70 dark:text-amber-400/60">Ticket</p>
                            </div>
                            <p className="text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums leading-none">
                              {financialStats.ticket > 0
                                ? financialStats.ticket.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                                : '—'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 relative z-30">
                    <motion.button
                      initial="idle"
                      whileHover="hover"
                      whileTap="tap"
                      variants={{ idle: { scale: 1 }, hover: { scale: 1.05 }, tap: { scale: 0.95 } }}
                      onClick={() => onOpenComplex(worker.id)}
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-300 text-[9px] font-black tracking-widest shadow-sm hover:shadow-lg hover:border-white dark:hover:border-slate-500 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-md transition-all group"
                    >
                      <motion.div variants={{ idle: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.2 } }} transition={{ type: "spring", stiffness: 350, damping: 30 }}>
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
                      className="relative overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-[10px] font-black tracking-widest shadow-lg transition-all"
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
          </div>

          {/* LATO POSTERIORE */}
          <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', willChange: 'transform' }}>
              {/* LATO POSTERIORE */}
              <div className="w-full h-full backdrop-blur-3xl border border-white/60 dark:border-slate-700 rounded-[2.5rem] flex flex-col shadow-2xl relative overflow-hidden dark:!bg-slate-900 dark:!bg-none transition-colors duration-500" style={{ ...(document.documentElement.classList.contains('dark') ? {} : theme.backGradientStyle) }}>

                {/* Header Fisso */}
                <div className="flex-none p-7 pb-4 relative z-20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: theme.rawColor.start }}></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Financial Overview</span>
                    </div>
                    <button onClick={() => setIsFlipped(false)} className="group p-2 bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-700 rounded-full shadow-sm hover:scale-110 transition-all hover:bg-white dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-cyan-400">
                      <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
                    </button>
                  </div>
                </div>

                {/* AREA SCROLLABILE */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-7 pb-4 relative z-10">

                  {/* DISPLAY NETTO */}
                  <div className="relative overflow-hidden p-5 rounded-[2rem] bg-white/50 dark:bg-slate-950/50 border border-white/60 dark:border-slate-700 shadow-lg backdrop-blur-md mb-4 group transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: theme.rawColor.start }}></div>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">RECUPERO TOTALE</p>
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
                      <TrendingUp className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    </div>
                    <BackChart worker={worker} theme={theme} startYear={startClaimYear} />
                  </div>

                  {/* BOX TICKET INTELLIGENTE */}
                  <div className={`p-4 rounded-[1.5rem] border shadow-sm backdrop-blur-sm flex items-center justify-between mb-3 transition-colors ${includeTickets
                    ? 'bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60'
                    : 'bg-slate-50/90 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
                    }`}>
                    <div className="flex items-center gap-2">
                      <Ticket className={`w-4 h-4 ${includeTickets ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500 dark:text-slate-600'}`} />
                      <span className={`text-[9px] uppercase tracking-widest font-bold ${includeTickets ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-500'}`}>
                        Valore Ticket
                      </span>
                    </div>

                    {includeTickets ? (
                      <p className="text-lg font-black text-slate-600 dark:text-slate-200 transition-colors">
                        {financialStats.ticket.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }).replace(',00', '')}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100/80 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/50 shadow-sm transition-colors">
                        <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 tracking-wide uppercase">Non Calcolati</span>
                      </div>
                    )}
                  </div>

                  {/* GRIGLIA FINALE */}
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="p-3 rounded-[1.5rem] bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-700/50 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center text-center hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
                      <Layers className="w-3.5 h-3.5 text-blue-400 dark:text-cyan-400 mb-1" />
                      <p className="text-[7px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Lordo</p>
                      <p className="text-sm font-black text-slate-600 dark:text-slate-200 transition-colors">
                        {financialStats.lordo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }).replace(',00', '')}
                      </p>
                    </div>

                    <div className="p-3 rounded-[1.5rem] bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-700/50 shadow-sm backdrop-blur-sm flex flex-col items-center justify-center text-center hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
                      <CalendarClock className="w-3.5 h-3.5 mb-1" style={theme.iconStyle} />
                      <p className="text-[7px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">G. Utili</p>
                      <p className="text-sm font-black" style={theme.iconStyle}>
                        {financialStats.ferie.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                      </p>
                    </div>
                  </div>

                  {/* NOTE PRATICA */}
                  <div className="mt-3 pt-3 border-t border-slate-200/30 dark:border-slate-700/50">
                    <textarea
                      value={localNotes}
                      onChange={e => setLocalNotes(e.target.value)}
                      onBlur={() => onNotesChange?.(worker.id, localNotes)}
                      onClick={e => e.stopPropagation()}
                      placeholder="Note sulla pratica..."
                      rows={2}
                      className="w-full text-[10px] font-medium bg-transparent resize-none text-slate-500 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-0 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Footer Fisso */}
                <div className="flex-none p-4 pt-3 border-t border-slate-200/30 dark:border-slate-700/50 flex justify-between items-center opacity-70 relative z-20 bg-white/20 dark:bg-slate-950/40 backdrop-blur-sm transition-colors">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">ID: {worker.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/50 dark:bg-slate-800/80 border border-white/50 dark:border-slate-700 transition-colors">
                    <Activity className="w-2.5 h-2.5" style={theme.iconStyle} />
                    <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400">ACTIVE</span>
                  </div>
                </div>

                {/* Sfondo Decorativo */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={{ backgroundImage: noiseBg }}></div>
                <div className="absolute top-[-20%] right-[-20%] w-64 h-64 rounded-full blur-[60px] opacity-20 dark:opacity-10 animate-pulse pointer-events-none transition-opacity" style={{ backgroundColor: theme.rawColor.start }}></div>
                <div className="absolute bottom-[-20%] left-[-20%] w-40 h-40 rounded-full blur-[60px] opacity-20 dark:opacity-10 pointer-events-none transition-opacity" style={{ backgroundColor: theme.rawColor.start }}></div>

              </div>
          </div>

        </motion.div>
      </motion.div>
    </>
  );
};

export default WorkerCard;