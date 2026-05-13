import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Plus,
    Download,
    Upload,
    User,
    Ticket,
    Sparkles,
    ArrowUp,
    X,
    Wallet,
    ChevronRight,
    BarChart3,
    RotateCcw,
    SearchX,
    ArrowUpDown,
    ArrowUp as SortAsc,
    ArrowDown as SortDesc,
    ChevronDown,
} from 'lucide-react';
import WorkerCard from '../components/WorkerCard';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { Worker } from '../types';
import { DashboardStats, WorkerStatItem, ModalConfig } from '../hooks/useDashboardStats';
import { COLOR_VARIANTS } from '../utils/colorVariants';

interface DashboardPageProps {
    viewMode: 'home' | 'simple' | 'complex' | 'stats';
    workers: Worker[];
    filteredWorkers: Worker[];
    dashboardStats: DashboardStats;
    statsList: WorkerStatItem[];
    modalConfig: ModalConfig;
    netCreditMap: Record<string | number, number>;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    activeFilter: string;
    setActiveFilter: (f: string) => void;
    activeStatusFilter: string;
    setActiveStatusFilter: (f: string) => void;
    customFilters: string[];
    activeStatsModal: 'net' | 'ticket' | null;
    setActiveStatsModal: (modal: 'net' | 'ticket' | null) => void;
    showScrollTop: boolean;
    scrollToTop: () => void;
    containerVariants: any;
    itemVariants: any;
    getFilterStyle: (filterId: string, isActive: boolean) => string;
    handleOpenSimple: (id: string) => void;
    handleOpenComplex: (id: string) => void;
    openEditModal: (e: React.MouseEvent, id: string) => void;
    handleDeleteWorker: (id: string) => void;
    handleOpenModal: (mode: 'create' | 'edit') => void;
    updateWorkerById: (id: string, fields: any) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportData: () => void;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats') => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
    viewMode,
    workers,
    filteredWorkers,
    dashboardStats,
    statsList,
    modalConfig,
    netCreditMap,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeStatusFilter,
    setActiveStatusFilter,
    customFilters,
    activeStatsModal,
    setActiveStatsModal,
    showScrollTop,
    scrollToTop,
    containerVariants,
    itemVariants,
    getFilterStyle,
    handleOpenSimple,
    handleOpenComplex,
    openEditModal,
    handleDeleteWorker,
    handleOpenModal,
    updateWorkerById,
    fileInputRef,
    handleExportData,
    handleImportData,
    setViewMode
}) => {
    type SortKey = 'cognome' | 'credito' | 'status' | 'data';
    const [sortBy, setSortBy] = useState<SortKey>('cognome');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showStatusFilters, setShowStatusFilters] = useState(false);

    const STATUS_ORDER: Record<string, number> = { chiusa: 0, inviata: 1, pronta: 2, trattativa: 3 };

    const sortedWorkers = useMemo(() => {
        const list = [...filteredWorkers];
        if (sortBy === 'cognome') {
            list.sort((a, b) => {
                const cmp = a.cognome.localeCompare(b.cognome, 'it');
                return sortDir === 'asc' ? cmp : -cmp;
            });
        } else if (sortBy === 'credito') {
            list.sort((a, b) => {
                const diff = (netCreditMap[a.id] ?? 0) - (netCreditMap[b.id] ?? 0);
                return sortDir === 'asc' ? diff : -diff;
            });
        } else if (sortBy === 'status') {
            list.sort((a, b) => {
                const aO = STATUS_ORDER[a.status ?? ''] ?? 4;
                const bO = STATUS_ORDER[b.status ?? ''] ?? 4;
                return sortDir === 'asc' ? aO - bO : bO - aO;
            });
        } else if (sortBy === 'data') {
            list.sort((a, b) => {
                const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
                return sortDir === 'asc' ? aT - bT : bT - aT;
            });
        }
        return list;
    }, [filteredWorkers, sortBy, sortDir, netCreditMap]);

    const toggleSort = (key: SortKey) => {
        if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(key); setSortDir('asc'); }
    };

    return (
        <div className="relative max-w-7xl mx-auto px-6 py-10" style={{ display: viewMode === 'home' ? 'block' : 'none' }}>
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-8 mb-12">

                {/* SINISTRA: LOGO E TITOLO */}
                <div className="flex items-center gap-6 w-full xl:w-auto">
                    <div className="relative group w-32 h-32 flex-shrink-0">
                        <div className="relative w-full h-full rounded-full flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 overflow-hidden">
                            <img
                                src="/logo.png"
                                alt="Logo FS"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    <motion.div
                        className="group/brand cursor-default"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        <h1 className="text-5xl font-black tracking-tight select-none">
                            <span className="text-slate-900 dark:text-white">Rail</span>
                            <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent transition-all duration-500 group-hover/brand:drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                                Flow
                            </span>
                        </h1>
                        <p className="text-xs font-medium tracking-[0.25em] uppercase text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-2 select-none">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-500/60 dark:text-cyan-400/40" />
                            Pannello di controllo ferrovieri
                        </p>
                    </motion.div>
                </div>

                {/* DESTRA: PULSANTI AZIONE */}
                <div className="flex flex-wrap justify-center xl:justify-end gap-3 w-full xl:w-auto ml-auto">

                    {/* GRUPPO STRUMENTI (Ora gestiti dalla Dynamic Island, resta solo Statistiche) */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setViewMode('stats')}
                            className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #4f46e5, #7c3aed)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                            <BarChart3 className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
                            <span>Statistiche</span>
                        </button>
                    </div>

                    {/* GRUPPO DATI */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleExportData}
                            className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(168,85,247,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #8b5cf6, #d946ef)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                            <Download className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={2.5} />
                            <span>Esporta JSON</span>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #3b82f6, #06b6d4)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                            <Upload className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={2.5} />
                            <span>Importa JSON</span>
                        </button>
                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
                    </div>

                    {/* GRUPPO AZIONE PRINCIPALE */}
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="group relative px-8 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                        style={{ backgroundImage: 'linear-gradient(to right, #34d399, #06b6d4)' }}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                        <Plus className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={3} />
                        <span>Nuovo Lavoratore</span>
                    </button>
                </div>
            </div>

            {/* STATISTICHE HOME (GOD TIER FX RESTORED) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 relative z-10">

                {/* 1. CARD PRATICHE (NEON BLU - CON SFONDO E PING) */}
                <div className="group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] flex flex-col justify-between cursor-default">

                    {/* Sfondo Decorativo Animato */}
                    <div className="absolute top-[-50%] right-[-50%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:scale-110"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            {/* Icona con Ping */}
                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/40">
                                <User className="w-7 h-7" strokeWidth={2} />
                            </div>
                            <div className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-0 group-hover:opacity-75 transition-opacity duration-300"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300 group-hover:bg-blue-500 transition-colors duration-300"></span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-600 transition-colors duration-300">Pratiche Gestite Totali</p>
                            <p className="text-6xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)', WebkitBackgroundClip: 'text' }}>
                                <AnimatedCounter value={workers.length} />
                            </p>
                        </div>
                    </div>

                    {/* Footer Badge Stats */}
                    <div className="px-8 pb-8 relative z-10">
                        <div className="flex flex-wrap gap-3 opacity-90 group-hover:opacity-100 transition-opacity duration-500 translate-y-2 group-hover:translate-y-0">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-cyan-400 dark:shadow-[0_0_8px_currentColor]"></div>
                                <span className="text-[11px] font-black text-blue-800 dark:text-cyan-300 transition-colors">RFI</span>
                                <span className="text-[11px] font-bold text-blue-600 dark:text-cyan-500 transition-colors">{workers.filter(w => w.profilo === 'RFI').length}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700/50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 dark:shadow-[0_0_8px_currentColor]"></div>
                                <span className="text-[11px] font-black text-orange-800 dark:text-orange-300 transition-colors">ELIOR</span>
                                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-500 transition-colors">{workers.filter(w => w.profilo === 'ELIOR').length}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_currentColor]"></div>
                                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 transition-colors">REKEEP</span>
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 transition-colors">{workers.filter(w => w.profilo === 'REKEEP').length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CARD NETTO (EMERALD - CON GRAFICO SVG) */}
                <div onClick={() => setActiveStatsModal('net')} className="group relative h-full min-h-[220px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.5)] cursor-pointer flex flex-col justify-between">

                    {/* Sfondo Decorativo */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-emerald-500/20"></div>

                    {/* Grafico SVG Sfondo (RESTITUITO!) */}
                    <svg className="absolute bottom-0 left-0 w-full h-40 text-emerald-500/5 group-hover:text-emerald-500/20 transition-all duration-700 ease-out translate-y-10 group-hover:translate-y-2" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path d="M0 40 L0 30 Q10 15 20 25 T40 15 T60 20 T80 5 L100 0 L100 40 Z" fill="currentColor" />
                    </svg>

                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/40">
                                <Wallet className="w-7 h-7" strokeWidth={2} />
                            </div>
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 opacity-0 group-hover:opacity-100 transition-all transform -translate-y-2 group-hover:translate-y-0 shadow-lg">CLICCA PER DETTAGLI</div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-600 transition-colors duration-300">Credito Stimato Totale</p>
                            <p className="text-5xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left overflow-hidden" style={{ backgroundImage: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', WebkitBackgroundClip: 'text' }}>
                                {dashboardStats.totalNet > 0 ? <AnimatedCounter value={dashboardStats.totalNet} isCurrency /> : '-'}
                            </p>
                            <div className="flex items-center gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_currentColor]"></div>
                                <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">Differenza retributive calcolate applicando il principio di onnicomprensività (Cass. 20216/2022) sulle voci variabili ricorrenti, parametrata al tetto di 28 giorni annui.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. CARD TICKET (AMBER - CON ICONA GIGANTE) */}
                <div onClick={() => setActiveStatsModal('ticket')} className="group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.5)] cursor-pointer flex flex-col justify-between">

                    {/* Sfondo Decorativo */}
                    <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-amber-500/20"></div>

                    {/* Icona Gigante Sfondo (RESTITUITA!) */}
                    <div className="absolute top-4 right-4 text-amber-500/0 group-hover:text-amber-500/10 transition-all duration-500 transform rotate-0 group-hover:rotate-12 scale-50 group-hover:scale-100 pointer-events-none">
                        <Ticket className="w-40 h-40" strokeWidth={1.5} />
                    </div>

                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-400 group-hover:-rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/40">
                                <Ticket className="w-7 h-7" strokeWidth={2} />
                            </div>
                            <div className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 shadow-lg">CLICCA PER DETTAGLI</div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-amber-600 transition-colors duration-300">Valore Ticket</p>
                            <p className="text-5xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left overflow-hidden" style={{ backgroundImage: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', WebkitBackgroundClip: 'text' }}>
                                {dashboardStats.totalTicket > 0 ? <AnimatedCounter value={dashboardStats.totalTicket} isCurrency /> : '-'}
                            </p>
                            <div className="flex items-center gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_currentColor]"></div>
                                <p className="text-[10px] font-bold text-slate-400 group-hover:text-amber-700">Controvalore monetario dei buoni pasto maturati durante le ferie godute e non erogati.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* --- SEARCH COMMAND CENTER (HOVER ACTIVATION EDITION) --- */}
            <div className="relative w-full max-w-4xl mx-auto mb-16 z-20">

                {/* 1. LA BARRA DI RICERCA (CAPSULA ATTIVA) */}
                <div className="relative group cursor-text">

                    {/* AURA DI SFONDO (Si attiva all'hover e al focus) */}
                    {/* A riposo: invisibile. Hover: 30% opacità. Focus: 60% opacità */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-30 group-focus-within:opacity-60 transition-all duration-500"></div>

                    {/* LA BARRA REALE */}
                    <div className="relative flex items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border-2 border-white/50 dark:border-slate-700/50 rounded-[2.5rem] shadow-xl transition-all duration-300 
                     group-hover:scale-[1.01] group-hover:bg-white/90 dark:group-hover:bg-slate-800/90 group-hover:border-indigo-300/50 dark:group-hover:border-indigo-500/50 group-hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)] dark:group-hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.4)]
                     group-focus-within:scale-[1.02] group-focus-within:bg-white/95 dark:group-focus-within:bg-slate-900/95 group-focus-within:border-indigo-500 dark:group-focus-within:border-indigo-400 group-focus-within:shadow-[0_20px_50px_-10px_rgba(99,102,241,0.4)] dark:group-focus-within:shadow-[0_20px_50px_-10px_rgba(99,102,241,0.6)]">

                        {/* Icona Lente (Animazione FIXATA: Hover inclina, Focus raddrizza) */}
                        <div className="pl-6 md:pl-8">
                            <Search className="h-7 w-7 text-slate-400 dark:text-slate-500 transition-all duration-500 ease-out
                           group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:scale-110 group-hover:-rotate-12
                           group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-300 group-focus-within:scale-125 group-focus-within:rotate-0"
                                strokeWidth={2.5} />
                        </div>

                        {/* Input Campo */}
                        <input
                            type="text"
                            placeholder="Cerca dipendente per nome e/o cognome.."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none px-6 py-6 text-xl font-bold text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-medium focus:ring-0 focus:outline-none"
                        />

                        {/* Tasto Reset */}
                        <AnimatePresence>
                            {searchQuery && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    onClick={() => setSearchQuery('')}
                                    className="mr-4 p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Scanner Line (Appare solo quando scrivi) */}
                        <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 dark:via-indigo-400 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
                    </div>
                </div>

                {/* 2. SMART FILTERS — AZIENDA + STATO A SCOMPARSA */}
                {(() => {
                    const STATUS_OPTIONS = [
                        { id: 'ALL',        label: 'Tutti',          dot: null,      cls: 'bg-indigo-600 text-white border-indigo-500' },
                        { id: 'analisi',    label: 'Da Analizzare',  dot: '#94a3b8', cls: 'bg-slate-600 text-white border-slate-500',   count: workers.filter(w => !w.status || w.status === 'aperta' || w.status === 'in_corso').length },
                        { id: 'pronta',     label: 'Pronta',         dot: '#f59e0b', cls: 'bg-amber-500 text-white border-amber-400',    count: workers.filter(w => w.status === 'pronta').length },
                        { id: 'trattativa', label: 'In Trattativa',  dot: '#f43f5e', cls: 'bg-rose-500 text-white border-rose-400',      count: workers.filter(w => w.status === 'trattativa').length },
                        { id: 'inviata',    label: 'PEC Inviata',    dot: '#a855f7', cls: 'bg-purple-500 text-white border-purple-400',  count: workers.filter(w => w.status === 'inviata').length },
                        { id: 'chiusa',     label: 'Conclusa',       dot: '#10b981', cls: 'bg-emerald-500 text-white border-emerald-400', count: workers.filter(w => w.status === 'chiusa').length },
                    ];
                    const hasStatusFilter = activeStatusFilter !== 'ALL';
                    const activeOpt = STATUS_OPTIONS.find(o => o.id === activeStatusFilter)!;
                    const inactivePill = 'bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/60';

                    return (
                        <div className="mt-6 space-y-3">
                            {/* RIGA PRINCIPALE: AZIENDE + TOGGLE STATO */}
                            <div className="flex justify-center gap-3 flex-wrap items-center">
                                {['ALL', 'RFI', 'ELIOR', 'REKEEP', ...customFilters].map((filterId) => {
                                    const isActive = activeFilter === filterId;
                                    return (
                                        <button
                                            key={filterId}
                                            onClick={() => setActiveFilter(filterId)}
                                            className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 backdrop-blur-md flex items-center gap-2 ${getFilterStyle(filterId, isActive)}`}
                                        >
                                            {filterId === 'ALL' ? 'Tutti' : filterId}
                                            {filterId !== 'ALL' && (
                                                <span className="opacity-70 font-mono text-[10px]">
                                                    ({workers.filter(w => w.profilo === filterId).length})
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}

                                <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

                                {/* PILL TOGGLE STATO */}
                                <button
                                    onClick={() => setShowStatusFilters(v => !v)}
                                    className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 backdrop-blur-md flex items-center gap-2 border ${
                                        hasStatusFilter
                                            ? `${activeOpt.cls} shadow-md`
                                            : showStatusFilters
                                                ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                                                : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/60'
                                    }`}
                                >
                                    {hasStatusFilter && activeOpt.dot && (
                                        <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />
                                    )}
                                    {hasStatusFilter ? activeOpt.label : 'Stato'}
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showStatusFilters ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* RIGA STATUS (a scomparsa con animazione) */}
                            <AnimatePresence>
                                {showStatusFilters && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex justify-center gap-2 flex-wrap pt-1">
                                            {STATUS_OPTIONS.map(opt => {
                                                const isActive = activeStatusFilter === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            setActiveStatusFilter(opt.id);
                                                            if (opt.id !== 'ALL') setShowStatusFilters(false);
                                                        }}
                                                        className={`px-4 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-200 backdrop-blur-md flex items-center gap-1.5 border ${isActive ? opt.cls : inactivePill}`}
                                                    >
                                                        {opt.dot && (
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-slate-400'}`} />
                                                        )}
                                                        {opt.label}
                                                        {'count' in opt && (
                                                            <span className={`font-mono text-[9px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                                                                ({opt.count})
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })()}
            </div>
            {/* --- 3. NO RESULTS STATE (MESSAGGIO VUOTO) --- */}
            <AnimatePresence>
                {searchQuery && filteredWorkers.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-2xl mx-auto mt-12 text-center">
                        <div className="relative p-10 rounded-[3rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden group">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shimmer"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/10">
                                    <SearchX className="w-10 h-10 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                                </motion.div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Nessun lavoratore trovato</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mb-8 leading-relaxed">Non ci sono corrispondenze per "<span className="text-indigo-500 font-bold">{searchQuery}</span>".</p>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSearchQuery('')} className="group relative px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] animate-[shimmer_3s_infinite]"></div>
                                    <div className="relative flex items-center gap-2"><RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-180 duration-500" /><span>RESETTA RICERCA</span></div>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- 4. WORKERS GRID --- */}
            {(!searchQuery || filteredWorkers.length > 0) && (
                <>
                {/* SORT BAR */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-1">Ordina:</span>
                    {([
                        { key: 'cognome', label: 'Cognome' },
                        { key: 'credito', label: 'Credito' },
                        { key: 'status', label: 'Stato' },
                        { key: 'data', label: 'Data inserimento' },
                    ] as { key: SortKey; label: string }[]).map(opt => {
                        const isActive = sortBy === opt.key;
                        const Icon = isActive ? (sortDir === 'asc' ? SortAsc : SortDesc) : ArrowUpDown;
                        return (
                            <button
                                key={opt.key}
                                onClick={() => toggleSort(opt.key)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 backdrop-blur-md border ${
                                    isActive
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/30'
                                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-700/60'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                {opt.label}
                            </button>
                        );
                    })}
                    <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {filteredWorkers.length} {filteredWorkers.length === 1 ? 'pratica' : 'pratiche'}
                    </span>
                </div>

                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
                    variants={containerVariants}
                    initial="hidden" animate="show"
                >
                    <AnimatePresence mode='popLayout'>

                        {/* 1. LAVORATORI ESISTENTI */}
                        {sortedWorkers.map(w => (
                            <motion.div key={w.id} variants={itemVariants} layout initial="hidden" animate="show" exit="exit">
                                <WorkerCard
                                    worker={w}
                                    onOpenSimple={handleOpenSimple}
                                    onOpenComplex={handleOpenComplex}
                                    onEdit={(e) => openEditModal(e, w.id)}
                                    onDelete={() => handleDeleteWorker(w.id)}
                                    onStatusChange={(id, status) => updateWorkerById(id, { status: status === '' ? undefined : status })}
                                    onNotesChange={(id, notes) => updateWorkerById(id, { notes })}
                                />
                            </motion.div>
                        ))}

                        {/*  2. CARD "AGGIUNGI NUOVO" (ALLA FINE) */}
                        <motion.div
                            key="add-new-card"
                            variants={itemVariants}
                            layout
                            onClick={() => handleOpenModal('create')}
                            className="group relative w-full h-full min-h-[300px] bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 hover:border-emerald-400 hover:bg-emerald-50/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:-translate-y-2"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
                                <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-700 shadow-xl border border-white/80 dark:border-slate-500 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-90 relative z-10">
                                    <Plus className="w-10 h-10 text-slate-300 dark:text-slate-500 transition-colors duration-300 group-hover:text-emerald-500" strokeWidth={2.5} />
                                </div>
                            </div>
                            <span className="mt-6 font-black text-slate-400 uppercase tracking-widest text-sm transition-colors duration-300 group-hover:text-emerald-600">Crea Nuova Pratica</span>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
                </>
            )}

            {/* MODALE STATISTICHE (CORRETTA E SICURA) */}
            <AnimatePresence>
                {activeStatsModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setActiveStatsModal(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-700/60 overflow-hidden max-h-[80vh] flex flex-col">

                            {/* HEADER */}
                            <div className={`p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center sticky top-0 z-10`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${COLOR_VARIANTS[modalConfig.color].bgLight} ${COLOR_VARIANTS[modalConfig.color].bgDark}`}>
                                        <modalConfig.icon className={`w-6 h-6 ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark}`} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-white">{modalConfig.title}</h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{modalConfig.subtitle}</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveStatsModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
                            </div>

                            {/* LISTA CON FIX ANTI-CRASH */}
                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                                {statsList.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">Nessun importo calcolato disponibile.</div>
                                ) : (
                                    statsList.map((item, index) => {
                                        // Se il colore non esiste nella palette, usa 'blue' di default
                                        const theme = COLOR_VARIANTS[item.color] || COLOR_VARIANTS['blue'] || COLOR_VARIANTS['emerald'];

                                        return (
                                            <div key={item.id} className={`flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group ${theme.borderHover} ${theme.borderDarkHover}`}>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-bold text-slate-300 w-6">#{index + 1}</span>
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme.bgLight} ${theme.bgSoftDark} ${theme.text} ${theme.textDark} font-bold shadow-inner`}>
                                                        {item.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 dark:text-slate-200">{item.fullName}</h3>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] uppercase font-bold text-slate-400">{item.role || 'N.D.'}</p>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${item.profilo === 'ELIOR' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{item.profilo}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    {/* CASO 1: TICKET ESCLUSI (Solo nel modale ticket) */}
                                                    {activeStatsModal === 'ticket' && item.isTicketExcluded ? (
                                                        <>
                                                            <div className="flex items-center gap-1 mb-0.5">
                                                                <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wide border border-red-200 dark:border-red-800">
                                                                    NON CALCOLATO
                                                                </span>
                                                            </div>
                                                            <span className="block text-lg font-black text-slate-300 dark:text-slate-600 tracking-tight line-through decoration-2 decoration-red-400/50">
                                                                {/* Mostriamo il potenziale barrato, oppure 0 */}
                                                                {item.potential.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                                Maturati: <span className="text-slate-500 font-mono">{item.potential.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                                                            </span>
                                                        </>
                                                    ) : (
                                                        /* CASO 2: NORMALE */
                                                        <>
                                                            <span className={`block text-lg font-black ${theme.text} ${theme.textDark} tracking-tight`}>
                                                                {item.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                            </span>
                                                        </>
                                                    )}

                                                    <button onClick={() => { setActiveStatsModal(null); handleOpenSimple(item.id); }} className={`text-[10px] font-bold ${theme.textLight} hover:underline flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                        Vedi Report <ChevronRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* FOOTER */}
                            <div className={`p-6 ${COLOR_VARIANTS[modalConfig.color].bgSoft} ${COLOR_VARIANTS[modalConfig.color].bgSoftDark} border-t ${COLOR_VARIANTS[modalConfig.color].border} ${COLOR_VARIANTS[modalConfig.color].borderDark} flex justify-between items-center`}>
                                <span className={`font-bold ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark} uppercase tracking-widest text-sm`}>{modalConfig.totalLabel}</span>
                                <span className={`text-2xl font-black ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark}`}>{modalConfig.totalValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            <AnimatePresence>
                {showScrollTop && (
                    <motion.button initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.8 }} whileHover={{ scale: 1.1, boxShadow: "0 0 25px rgba(99, 102, 241, 0.6)" }} onClick={scrollToTop} className="fixed bottom-20 right-6 z-50 p-4 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-2xl border border-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer">
                        <ArrowUp className="w-6 h-6" strokeWidth={3} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DashboardPage;
