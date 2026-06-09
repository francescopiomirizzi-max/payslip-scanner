import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
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
    Database,
    MousePointer2,
    Check,
    Ban,
    Trash2,
    Archive,
    CheckCircle2,
    Activity,
    FileText,
    Clock,
    FileBarChart,
    AlertCircle,
    Handshake,
    Loader2,
} from 'lucide-react';
import WorkerCard from '../components/WorkerCard';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useIsReadOnly } from '../lib/readonly';
import { Worker } from '../types';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS } from '../config/profiles';
import { DashboardStats, WorkerStatItem, ModalConfig } from '../hooks/useDashboardStats';
import { generateReport, generateRegistroPagate } from '../utils/reportGenerator';
import { COLOR_VARIANTS } from '../utils/colorVariants';

// ─── CONFIG DEI CASSETTI ─────────────────────────────────────────────────────
// La griglia è strutturata come una cassettiera: ogni stato è un cassetto
// indipendente, espandibile/comprimibile. "Da Analizzare" è sempre aperto
// di default ed è il punto di atterraggio per ogni pratica nuova.
type CassettoId = 'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa';

interface CassettoConfig {
    id: CassettoId;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
    accentHex: string;
    matches: (status: string | undefined) => boolean;
    defaultOpen: boolean;
}

const CASSETTI: CassettoConfig[] = [
    { id: 'analisi',    label: 'Da Analizzare',         icon: Clock,         accentHex: '#94a3b8', matches: (s) => !s || s === 'aperta' || s === 'in_corso', defaultOpen: true  },
    { id: 'pronta',     label: 'Conteggi Pronti',       icon: FileBarChart,  accentHex: '#f59e0b', matches: (s) => s === 'pronta',                            defaultOpen: false },
    { id: 'inviata',    label: 'Buste Paga Mancanti',   icon: AlertCircle,   accentHex: '#ef4444', matches: (s) => s === 'inviata',                           defaultOpen: false },
    { id: 'trattativa', label: 'Concluse',              icon: Handshake,     accentHex: '#14b8a6', matches: (s) => s === 'trattativa',                        defaultOpen: false },
    { id: 'chiusa',     label: 'Pagate',                icon: CheckCircle2,  accentHex: '#10b981', matches: (s) => s === 'chiusa',                            defaultOpen: false },
];

// ─── COMPONENTE CASSETTO ─────────────────────────────────────────────────────
// Bar compatta in singola riga: icona + label + count + badge cliccabili
// (uno per lavoratore, colorati per azienda) + chevron. I badge appaiono solo
// a cassetto chiuso: cliccarli apre direttamente la WorkerDetailPage. Quando il
// cassetto è aperto, le card sostituiscono i badge nello spazio sotto.
//
// Overflow del pannello aperto: parte hidden per animare la height, passa a
// visible a fine apertura → così le WorkerCard non vengono tagliate ai lati
// quando si inclinano in hover.
const Cassetto: React.FC<{
    config: CassettoConfig;
    workers: Worker[];
    isOpen: boolean;
    onToggle: () => void;
    onOpenWorker: (id: string) => void;
    children: React.ReactNode;
}> = ({ config, workers, isOpen, onToggle, onOpenWorker, children }) => {
    const Icon = config.icon;
    const count = workers.length;

    // Overflow visible solo dopo apertura completa (anti-clip card in hover).
    const [overflowVisible, setOverflowVisible] = useState(false);
    useLayoutEffect(() => {
        if (!isOpen) setOverflowVisible(false);
    }, [isOpen]);

    return (
        <div className="mb-3 relative">
            {/* Outer è <div role="button"> per poter contenere i <button> dei badge
                (nested button non è valido in HTML). Toggle via click/Enter/Space. */}
            <div
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/65 dark:bg-slate-800/65 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 shadow-[0_1px_2px_0_rgb(0,0,0,0.04)] hover:shadow-[0_6px_20px_-10px_rgb(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-px group relative z-10 cursor-pointer"
                style={{
                    backgroundImage: `linear-gradient(to right, ${config.accentHex}10, transparent 32%)`,
                }}
            >
                {/* Icona compatta del cassetto */}
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                    style={{
                        background: `linear-gradient(135deg, ${config.accentHex}, ${config.accentHex}d0)`,
                        boxShadow: `0 3px 10px -3px ${config.accentHex}80, inset 0 1px 0 0 rgb(255 255 255 / 0.25)`,
                    }}
                >
                    <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>

                {/* Label + count inline */}
                <span className="font-black text-[11px] uppercase tracking-widest text-slate-700 dark:text-slate-200 shrink-0">
                    {config.label}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0 -ml-1">
                    · {count}
                </span>

                {/* Badge lavoratori cliccabili — solo a cassetto chiuso. Scrollabili
                    orizzontalmente (trackpad swipe / shift+wheel) quando non ci stanno.
                    Colore preso da SYSTEM_PROFILES.footer; fallback slate per custom.
                    Il wrapper flex-1 occupa sempre lo spazio centrale così il chevron
                    resta ancorato a destra anche quando i badge non sono mostrati. */}
                <div className="flex-1 min-w-0 ml-2 relative">
                    {!isOpen && count > 0 && (
                        <>
                            <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <div className="flex items-center gap-1.5 py-0.5">
                                    {workers.map(w => {
                                        const profilo = SYSTEM_PROFILES[w.profilo];
                                        const wrapCls = profilo?.footer.wrap ?? 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/50';
                                        const dotCls  = profilo?.footer.dot  ?? 'bg-slate-400';
                                        const nameCls = profilo?.footer.name ?? 'text-slate-700 dark:text-slate-300';
                                        return (
                                            <button
                                                key={w.id}
                                                onClick={(e) => { e.stopPropagation(); onOpenWorker(w.id); }}
                                                title={`Apri scheda ${w.nome} ${w.cognome}`}
                                                className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all duration-150 hover:scale-[1.06] hover:shadow-sm ${wrapCls}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                                <span className={`tracking-tight ${nameCls}`}>{w.cognome}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* fade-right: hint visivo che ci sono altri badge oltre il bordo */}
                            <div className="absolute inset-y-0 right-0 w-8 pointer-events-none bg-gradient-to-l from-white/65 dark:from-slate-800/65 to-transparent" />
                        </>
                    )}
                </div>

                {/* Chevron — nudge "apri/chiudi" */}
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="text-slate-400 dark:text-slate-500 shrink-0"
                >
                    <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </motion.div>
            </div>

            {/* Stack hint: due fascicoli sottili sbucano sotto a cassetto chiuso */}
            {!isOpen && count > 0 && (
                <>
                    <div className="absolute left-2 right-2 -bottom-1 h-2 rounded-b-xl bg-white/45 dark:bg-slate-800/45 backdrop-blur-xl border-x border-b border-white/40 dark:border-slate-700/40 pointer-events-none" aria-hidden="true" />
                    <div className="absolute left-4 right-4 -bottom-2 h-2 rounded-b-xl bg-white/25 dark:bg-slate-800/25 backdrop-blur-xl border-x border-b border-white/25 dark:border-slate-700/25 pointer-events-none" aria-hidden="true" />
                </>
            )}

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.9 }}
                        onAnimationComplete={() => { if (isOpen) setOverflowVisible(true); }}
                        style={{ overflow: overflowVisible ? 'visible' : 'hidden' }}
                    >
                        <div className="pt-4 px-1">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface DashboardPageProps {
    viewMode: 'home' | 'simple' | 'complex' | 'stats' | 'archive';
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
    handleDeleteWorkersBulk: (ids: string[]) => void;
    recentlyCreatedId: string | null;
    handleOpenModal: (mode: 'create' | 'edit') => void;
    updateWorkerById: (id: string, fields: any) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportData: () => void;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats' | 'archive') => void;
    onOpenArchive: (id: string) => void;
    addToast: (
        message: string,
        type?: 'success' | 'error' | 'info',
        options?: { action?: { label: string; onClick: () => void }; duration?: number }
    ) => void;
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
    handleDeleteWorkersBulk,
    recentlyCreatedId,
    handleOpenModal,
    updateWorkerById,
    fileInputRef,
    handleExportData,
    handleImportData,
    setViewMode,
    onOpenArchive,
    addToast,
}) => {
    const isReadOnly = useIsReadOnly();
    type SortKey = 'cognome' | 'credito' | 'status' | 'data';
    const [sortBy, setSortBy] = useState<SortKey>('cognome');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
    const dataMenuRef = useRef<HTMLDivElement>(null);

    // --- SELEZIONE RAPIDA TICKET ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isDataMenuOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node))
                setIsDataMenuOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isDataMenuOpen]);

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

    // --- CASSETTI: stato apertura + raggruppamento worker ---
    const [openCassetti, setOpenCassetti] = useState<Set<CassettoId>>(() => {
        if (typeof window === 'undefined') return new Set(['analisi']);
        try {
            const saved = localStorage.getItem('openCassetti');
            if (saved) return new Set(JSON.parse(saved) as CassettoId[]);
        } catch {}
        return new Set(CASSETTI.filter(c => c.defaultOpen).map(c => c.id));
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('openCassetti', JSON.stringify([...openCassetti]));
    }, [openCassetti]);

    const toggleCassetto = (id: CassettoId) => {
        setOpenCassetti(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const workersByCassetto = useMemo(() => {
        const map = new Map<CassettoId, Worker[]>();
        CASSETTI.forEach(c => map.set(c.id, []));
        sortedWorkers.forEach(w => {
            const found = CASSETTI.find(c => c.matches(w.status));
            if (found) map.get(found.id)!.push(w);
        });
        return map;
    }, [sortedWorkers]);

    // --- ESPORTA CONCLUSE (ZIP) ---
    // Per ogni pratica nel cassetto "Concluse" (status 'trattativa') genera i 3
    // documenti (Conteggi PDF, Riepilogo PDF, Relazione .docx) e li impacchetta in
    // uno zip con la struttura cartelle {AZIENDA}/{COGNOME NOME}/conteggi/.
    // jszip è caricato on-demand per non gonfiare il bundle principale.
    const [concluseStatus, setConcluseStatus] = useState<string | null>(null);
    const handleExportConcluse = async () => {
        setIsDataMenuOpen(false);
        const conclusi = workersByCassetto.get('trattativa') ?? [];
        if (conclusi.length === 0) {
            addToast('Nessuna pratica nel cassetto "Concluse" da esportare.', 'info');
            return;
        }
        setConcluseStatus(`0 / ${conclusi.length}`);
        try {
            const { exportConcluseZip } = await import('../utils/concluseExport');
            const res = await exportConcluseZip(conclusi, (done, total) => {
                setConcluseStatus(`${done} / ${total}`);
            });
            if (res.failed.length > 0) {
                addToast(
                    `Esportate ${res.exported} pratiche su ${res.total}. Non riuscite: ${res.failed.map(f => f.worker).join(', ')}.`,
                    'error'
                );
                console.error('[Export Concluse] Pratiche non riuscite:', res.failed);
            } else {
                addToast(`Esportate ${res.exported} pratiche su ${res.total}.`, 'success');
            }
        } catch (err: any) {
            addToast(`Errore durante l'export: ${err?.message || err}`, 'error');
        } finally {
            setConcluseStatus(null);
        }
    };

    // Quando viene creata una nuova pratica: apri il cassetto giusto, sort per
    // data desc (così la nuova card va in cima al suo cassetto) e scroll in alto.
    useEffect(() => {
        if (!recentlyCreatedId) return;
        const newWorker = workers.find(w => w.id === recentlyCreatedId);
        if (!newWorker) return;
        const targetCassetto = CASSETTI.find(c => c.matches(newWorker.status));
        if (targetCassetto) {
            setOpenCassetti(prev => new Set([...prev, targetCassetto.id]));
        }
        setSortBy('data');
        setSortDir('desc');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // workers/setSortBy/setSortDir sono stabili o letti al volo: il trigger è recentlyCreatedId
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recentlyCreatedId]);

    // Helper: rendering di una card lavoratore (anello flash + overlay selezione + WorkerCard).
    // Estratto per essere usato sia dentro i cassetti che nella vista flat di ricerca.
    const renderWorkerCard = (w: Worker) => {
        const isJustCreated = w.id === recentlyCreatedId;
        return (
            <motion.div key={w.id} variants={itemVariants} layout initial="hidden" animate="show" exit="exit" className="relative h-[420px]">
                {isJustCreated && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 2.4, times: [0, 0.08, 0.75, 1], ease: 'easeInOut' }}
                        className="absolute -inset-1 rounded-[2.7rem] pointer-events-none z-30"
                        style={{ boxShadow: '0 0 0 3px #10b981, 0 0 36px 6px rgba(16,185,129,0.5)' }}
                    >
                        <motion.div
                            initial={{ opacity: 0.6, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.08 }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="absolute inset-0 rounded-[2.7rem] ring-2 ring-emerald-400"
                        />
                    </motion.div>
                )}
                {isSelectionMode && (
                    <div
                        onClick={() => toggleSelectWorker(w.id)}
                        className={`absolute inset-0 z-40 rounded-[2.5rem] cursor-pointer transition-all duration-200 ${
                            selectedIds.has(w.id)
                                ? 'ring-2 ring-indigo-500 bg-indigo-500/10'
                                : 'ring-1 ring-slate-300/40 dark:ring-slate-600/40 hover:bg-indigo-500/5 hover:ring-indigo-400/40'
                        }`}
                    >
                        <div className={`absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-md ${
                            selectedIds.has(w.id)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'bg-white/90 dark:bg-slate-800/90 border-slate-300 dark:border-slate-600'
                        }`}>
                            {selectedIds.has(w.id) && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </div>
                    </div>
                )}
                <WorkerCard
                    worker={w}
                    onOpenSimple={handleOpenSimple}
                    onOpenComplex={handleOpenComplex}
                    onEdit={(e) => openEditModal(e, w.id)}
                    onDelete={() => handleDeleteWorker(w.id)}
                    onStatusChange={(id, status) => updateWorkerById(id, { status: status === '' ? undefined : status })}
                    onNotesChange={(id, notes) => updateWorkerById(id, { notes })}
                    onOpenArchive={onOpenArchive}
                />
            </motion.div>
        );
    };

    const searchActive = searchQuery.trim().length > 0;

    // --- HANDLER TICKET RAPIDO ---
    const allTicketsOn = sortedWorkers.length > 0 && sortedWorkers.every(w => w.includeTickets !== false);

    // Il toggle riscrive l'impostazione su TUTTE le pratiche mostrate: troppo
    // pesante per un click secco accanto ai controlli di ordinamento → conferma.
    const [isTicketConfirmOpen, setIsTicketConfirmOpen] = useState(false);

    const confirmGlobalTickets = () => {
        const value = !allTicketsOn;
        sortedWorkers.forEach(w => updateWorkerById(w.id, { includeTickets: value }));
        setIsTicketConfirmOpen(false);
        addToast(
            `Ticket ${value ? 'attivati' : 'disattivati'} su ${sortedWorkers.length} ${sortedWorkers.length === 1 ? 'pratica' : 'pratiche'}.`,
            'success'
        );
    };

    const toggleSelectWorker = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const applyTicketsToSelection = (value: boolean) => {
        selectedIds.forEach(id => updateWorkerById(id, { includeTickets: value }));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    // Conferma via ConfirmModal (coerente col resto dell'app, niente confirm()
    // nativo); l'eliminazione vera passa dalla bulk delete con singolo undo.
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

    const confirmBulkDelete = () => {
        setIsBulkDeleteOpen(false);
        handleDeleteWorkersBulk([...selectedIds]);
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const exitSelectionMode = () => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    return (
        <div className="relative max-w-7xl mx-auto px-6 py-10" style={{ display: viewMode === 'home' ? 'block' : 'none' }}>
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-8 mb-8">

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

                    {/* GRUPPO STRUMENTI */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setViewMode('archive')}
                            className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(99,102,241,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #6366f1, #8b5cf6)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                            <Archive className="w-5 h-5 transition-transform duration-500 group-hover:-rotate-6" strokeWidth={2.5} />
                            <span>Archivio</span>
                        </button>
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
                    <div className="relative" ref={dataMenuRef}>
                        <button
                            onClick={() => setIsDataMenuOpen(v => !v)}
                            className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(168,85,247,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #8b5cf6, #d946ef)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
                            <Database className="w-5 h-5" strokeWidth={2.5} />
                            <span>Dati</span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDataMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isDataMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.88, y: -8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.88, y: -8 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                                    style={{ transformOrigin: 'top right' }}
                                    className="absolute right-0 top-full mt-2 z-50 w-56 bg-white/96 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Gestione dati</p>
                                        <p className="text-[12px] font-black text-slate-700 dark:text-slate-200 mt-0.5">RailFlow</p>
                                    </div>

                                    {/* Voci */}
                                    <div className="p-2 space-y-0.5">
                                        {[
                                            {
                                                icon: <Download className="w-4 h-4 text-white" strokeWidth={2.5} />,
                                                label: 'Esporta JSON',
                                                iconBg: 'bg-violet-500',
                                                hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-950/60',
                                                hoverText: 'hover:text-violet-700 dark:hover:text-violet-300',
                                                onClick: () => { handleExportData(); setIsDataMenuOpen(false); },
                                            },
                                            ...(isReadOnly ? [] : [{
                                                icon: <Upload className="w-4 h-4 text-white" strokeWidth={2.5} />,
                                                label: 'Importa JSON',
                                                iconBg: 'bg-sky-500',
                                                hoverBg: 'hover:bg-sky-50 dark:hover:bg-sky-950/60',
                                                hoverText: 'hover:text-sky-700 dark:hover:text-sky-300',
                                                onClick: () => { fileInputRef.current?.click(); setIsDataMenuOpen(false); },
                                            }]),
                                            {
                                                icon: <FileText className="w-4 h-4 text-white" strokeWidth={2.5} />,
                                                label: 'Buste Paga Mancanti (Word)',
                                                iconBg: 'bg-indigo-500',
                                                hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/60',
                                                hoverText: 'hover:text-indigo-700 dark:hover:text-indigo-300',
                                                onClick: () => { generateReport(workers); setIsDataMenuOpen(false); },
                                            },
                                            {
                                                icon: <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.5} />,
                                                label: 'Registro Pagate (Word)',
                                                iconBg: 'bg-emerald-500',
                                                hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/60',
                                                hoverText: 'hover:text-emerald-700 dark:hover:text-emerald-300',
                                                onClick: () => { generateRegistroPagate(workers); setIsDataMenuOpen(false); },
                                            },
                                            // Strumento interno di workflow: nascosto al viewer
                                            // readonly (sindacalista).
                                            ...(isReadOnly ? [] : [{
                                                icon: <Handshake className="w-4 h-4 text-white" strokeWidth={2.5} />,
                                                label: concluseStatus ? `Esporto… ${concluseStatus}` : 'Esporta Concluse (ZIP)',
                                                iconBg: 'bg-teal-500',
                                                hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-950/60',
                                                hoverText: 'hover:text-teal-700 dark:hover:text-teal-300',
                                                onClick: () => { if (!concluseStatus) handleExportConcluse(); },
                                            }]),
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
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
                    </div>

                    {/* GRUPPO AZIONE PRINCIPALE — nascosto in modalita' sola lettura */}
                    {!isReadOnly && (
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="group relative px-8 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                        style={{ backgroundImage: 'linear-gradient(to right, #34d399, #06b6d4)' }}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                        <Plus className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={3} />
                        <span>Nuovo Lavoratore</span>
                    </button>
                    )}
                </div>
            </div>

            {/* STATISTICHE HOME (GOD TIER FX RESTORED) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 relative z-10">

                {/* 1. CARD PRATICHE (NEON BLU - CON SFONDO E PING) */}
                <div className="isolate group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden [clip-path:inset(0_round_2.5rem)] transition-[transform,box-shadow,border-color] duration-500 hover:scale-[1.03] hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] flex flex-col justify-between cursor-default">

                    {/* Sfondo Decorativo Animato — wrappato in inner clipper per containere il blur out-of-bounds */}
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                        <div className="absolute top-[-50%] right-[-50%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] transition-[opacity,transform] duration-700 opacity-50 group-hover:opacity-100 group-hover:scale-110"></div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    </div>

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
                            {SYSTEM_PROFILE_KEYS.map((key) => {
                                const p = SYSTEM_PROFILES[key];
                                return (
                                    <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md transition-colors ${p.footer.wrap}`}>
                                        <div className={`w-2 h-2 rounded-full ${p.footer.dot}`}></div>
                                        <span className={`text-[11px] font-black transition-colors ${p.footer.name}`}>{p.label}</span>
                                        <span className={`text-[11px] font-bold transition-colors ${p.footer.count}`}>{workers.filter(w => w.profilo === key).length}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. CARD NETTO (EMERALD - CON GRAFICO SVG) */}
                <div onClick={() => setActiveStatsModal('net')} className="isolate group relative h-full min-h-[220px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden [clip-path:inset(0_round_2.5rem)] transition-[transform,box-shadow,border-color] duration-500 hover:scale-[1.04] hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.5)] cursor-pointer flex flex-col justify-between">

                    {/* Decorazioni — wrappate in inner clipper */}
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] transition-[opacity,background-color] duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-emerald-500/20"></div>

                        <svg className="absolute bottom-0 left-0 w-full h-40 text-emerald-500/5 group-hover:text-emerald-500/20 transition-[color,transform] duration-700 ease-out translate-y-10 group-hover:translate-y-2" viewBox="0 0 100 40" preserveAspectRatio="none">
                            <path d="M0 40 L0 30 Q10 15 20 25 T40 15 T60 20 T80 5 L100 0 L100 40 Z" fill="currentColor" />
                        </svg>
                    </div>

                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/40">
                                <Wallet className="w-7 h-7" strokeWidth={2} />
                            </div>
                            {/* Sempre visibile: l'affordance "qui si clicca" deve esistere anche su touch/tastiera */}
                            <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 dark:border-emerald-800 shadow-sm group-hover:shadow-lg transition-shadow">
                                Dettagli <ChevronRight className="w-3 h-3" strokeWidth={3} />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-600 transition-colors duration-300">Credito Stimato Totale</p>
                            <p className="text-5xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left overflow-hidden" style={{ backgroundImage: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', WebkitBackgroundClip: 'text' }}>
                                {dashboardStats.totalNet > 0 ? <AnimatedCounter value={dashboardStats.totalNet} isCurrency /> : '-'}
                            </p>
                            {/* Nota di metodo: è contenuto sostanziale, non decorazione → leggibile a riposo */}
                            <div className="flex items-start gap-2 mt-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                <p className="text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">Differenza retributive calcolate applicando il principio di onnicomprensività (Cass. 20216/2022) sulle voci variabili ricorrenti, parametrata al tetto di 28 giorni annui.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. CARD TICKET (AMBER - CON ICONA GIGANTE) */}
                <div onClick={() => setActiveStatsModal('ticket')} className="isolate group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden [clip-path:inset(0_round_2.5rem)] transition-[transform,box-shadow,border-color] duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.5)] cursor-pointer flex flex-col justify-between">

                    {/* Decorazioni — wrappate in inner clipper */}
                    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                        <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] transition-[opacity,background-color] duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-amber-500/20"></div>

                        <div className="absolute top-4 right-4 text-amber-500/0 group-hover:text-amber-500/10 transition-[color,transform] duration-500 rotate-0 group-hover:rotate-12 scale-50 group-hover:scale-100">
                            <Ticket className="w-40 h-40" strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-400 group-hover:-rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/40">
                                <Ticket className="w-7 h-7" strokeWidth={2} />
                            </div>
                            {/* Sempre visibile: l'affordance "qui si clicca" deve esistere anche su touch/tastiera */}
                            <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-800 shadow-sm group-hover:shadow-lg transition-shadow">
                                Dettagli <ChevronRight className="w-3 h-3" strokeWidth={3} />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-amber-600 transition-colors duration-300">Valore Ticket</p>
                            <p className="text-5xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left overflow-hidden" style={{ backgroundImage: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', WebkitBackgroundClip: 'text' }}>
                                {dashboardStats.totalTicket > 0 ? <AnimatedCounter value={dashboardStats.totalTicket} isCurrency /> : '-'}
                            </p>
                            {/* Nota di metodo: è contenuto sostanziale, non decorazione → leggibile a riposo */}
                            <div className="flex items-start gap-2 mt-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                                <p className="text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">Controvalore monetario dei buoni pasto maturati durante le ferie godute e non erogati.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* --- SEARCH COMMAND CENTER (HOVER ACTIVATION EDITION) --- */}
            <div className="relative w-full max-w-4xl mx-auto mb-10 z-20">

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
                            placeholder="Cerca per nome, cognome, azienda o ruolo.."
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

                {/* 2. FILTRI AZIENDA — i filtri stato sono sostituiti dai cassetti sotto */}
                <div className="mt-6 flex justify-center gap-3 flex-wrap items-center">
                    {['ALL', ...SYSTEM_PROFILE_KEYS, ...customFilters].map((filterId) => {
                        const isActive = activeFilter === filterId;
                        return (
                            <button
                                key={filterId}
                                onClick={() => setActiveFilter(filterId)}
                                className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 backdrop-blur-md flex items-center gap-2 ${getFilterStyle(filterId, isActive)}`}
                            >
                                {filterId === 'ALL' ? 'Tutti' : filterId.replace(/_/g, ' ')}
                                {filterId !== 'ALL' && (
                                    <span className="opacity-70 font-mono text-[10px]">
                                        ({workers.filter(w => w.profilo === filterId).length})
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
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
                {/* CONTROL BAR — ordina + ticket + selezione in un'unica toolbar */}
                <div className="flex items-center gap-2 mb-6 px-4 py-2.5 bg-white/50 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl flex-wrap">

                    {/* Gruppo: Ordina — segmented control con indicatore scorrevole */}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">Ordina</span>
                    <LayoutGroup id="sort-control">
                        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 rounded-xl p-0.5 gap-0 shrink-0">
                            {([
                                { key: 'cognome', label: 'Cognome', pill: 'bg-indigo-500 shadow-indigo-500/40' },
                                { key: 'credito', label: 'Credito', pill: 'bg-emerald-500 shadow-emerald-500/40' },
                                { key: 'status',  label: 'Stato',   pill: 'bg-amber-500 shadow-amber-500/40'   },
                                { key: 'data',    label: 'Data',    pill: 'bg-sky-500 shadow-sky-500/40'       },
                            ] as { key: SortKey; label: string; pill: string }[]).map(opt => {
                                const isActive = sortBy === opt.key;
                                const Icon = isActive ? (sortDir === 'asc' ? SortAsc : SortDesc) : ArrowUpDown;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => toggleSort(opt.key)}
                                        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-widest z-10 select-none"
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="sort-pill"
                                                className={`absolute inset-0 rounded-[10px] shadow-md ${opt.pill}`}
                                                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                            />
                                        )}
                                        <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                                            <Icon className="w-3 h-3" />
                                            {opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </LayoutGroup>

                    <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

                    {/* Gruppo: Ticket */}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-0.5 shrink-0">Ticket</span>
                    <button
                        onClick={() => setIsTicketConfirmOpen(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border ${
                            allTicketsOn
                                ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/30'
                                : 'bg-white/60 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-600/50 hover:bg-white dark:hover:bg-slate-700/70'
                        }`}
                    >
                        <Ticket className="w-3 h-3" />
                        {allTicketsOn ? 'ON' : 'OFF'}
                    </button>

                    <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

                    {/* Gruppo: Selezione — nascosto in modalita' sola lettura (le bulk action sono tutte scritture) */}
                    {!isReadOnly && (
                    <button
                        onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border ${
                            isSelectionMode
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/30'
                                : 'bg-white/60 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-600/50 hover:bg-white dark:hover:bg-slate-700/70'
                        }`}
                    >
                        <MousePointer2 className="w-3 h-3" />
                        {isSelectionMode ? `${selectedIds.size} selezionate` : 'Seleziona'}
                    </button>
                    )}

                    {/* Conteggio allineato a destra */}
                    <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {filteredWorkers.length} {filteredWorkers.length === 1 ? 'pratica' : 'pratiche'}
                    </span>
                </div>

                {searchActive ? (
                    /* RICERCA ATTIVA: grid piatto con tutti i risultati visibili
                       senza dover aprire cassetti — l'obiettivo è "trovo subito". */
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        <AnimatePresence mode="popLayout">
                            {sortedWorkers.map(renderWorkerCard)}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    /* CASSETTI — ogni stato è un drawer indipendente.
                       "Da Analizzare" è sempre mostrato anche se vuoto: è il punto di
                       atterraggio delle pratiche nuove e contiene la card "+ Crea". */
                    <div className="pb-20">
                        {CASSETTI.map(config => {
                            const workersInCassetto = workersByCassetto.get(config.id) || [];
                            const isOpen = openCassetti.has(config.id);
                            if (workersInCassetto.length === 0 && config.id !== 'analisi') return null;

                            return (
                                <Cassetto
                                    key={config.id}
                                    config={config}
                                    workers={workersInCassetto}
                                    isOpen={isOpen}
                                    onToggle={() => toggleCassetto(config.id)}
                                    onOpenWorker={handleOpenComplex}
                                >
                                    <motion.div
                                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                    >
                                        <AnimatePresence mode="popLayout">
                                            {workersInCassetto.map(renderWorkerCard)}

                                            {/* CARD "AGGIUNGI NUOVO" — solo dentro 'Da Analizzare', nascosta in modalita' sola lettura */}
                                            {config.id === 'analisi' && !isSelectionMode && !isReadOnly && (
                                                <motion.div
                                                    key="add-new-card"
                                                    variants={itemVariants}
                                                    layout
                                                    onClick={() => handleOpenModal('create')}
                                                    className="group relative w-full h-[420px] bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 hover:border-emerald-400 hover:bg-emerald-50/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:-translate-y-2"
                                                >
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
                                                        <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-700 shadow-xl border border-white/80 dark:border-slate-500 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-90 relative z-10">
                                                            <Plus className="w-10 h-10 text-slate-300 dark:text-slate-500 transition-colors duration-300 group-hover:text-emerald-500" strokeWidth={2.5} />
                                                        </div>
                                                    </div>
                                                    <span className="mt-6 font-black text-slate-400 uppercase tracking-widest text-sm transition-colors duration-300 group-hover:text-emerald-600">Crea Nuova Pratica</span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                </Cassetto>
                            );
                        })}
                    </div>
                )}
                </>
            )}

            {/* FLOATING ACTION BAR - SELEZIONE TICKET */}
            <AnimatePresence>
                {isSelectionMode && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 dark:border-slate-700 whitespace-nowrap"
                    >
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                            {selectedIds.size} {selectedIds.size === 1 ? 'pratica' : 'pratiche'} selezionate
                        </span>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={() => setSelectedIds(new Set(sortedWorkers.map(w => w.id)))}
                            className="text-[10px] font-black uppercase tracking-wide text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            Tutte
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-[10px] font-black uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            Nessuna
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={() => applyTicketsToSelection(true)}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wide shadow-md shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-600 transition-colors"
                        >
                            <Ticket className="w-3 h-3" />
                            Tickets ON
                        </button>
                        <button
                            onClick={() => applyTicketsToSelection(false)}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-wide shadow-md shadow-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-600 transition-colors"
                        >
                            <Ban className="w-3 h-3" />
                            Tickets OFF
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={() => setIsBulkDeleteOpen(true)}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wide shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                            Elimina
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={exitSelectionMode}
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PILL PROGRESSO EXPORT CONCLUSE — visibile anche a menu Dati chiuso */}
            <AnimatePresence>
                {concluseStatus && (
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-5 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-teal-200/60 dark:border-teal-800/60"
                    >
                        <Loader2 className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-spin" />
                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                            Esporto pratiche concluse… <span className="font-mono tabular-nums">{concluseStatus}</span>
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONFERMA TOGGLE TICKET GLOBALE */}
            <AnimatePresence>
                {isTicketConfirmOpen && (
                    <ConfirmModal
                        isOpen={true}
                        onClose={() => setIsTicketConfirmOpen(false)}
                        onConfirm={confirmGlobalTickets}
                        color="orange"
                        title={`${allTicketsOn ? 'Disattivare' : 'Attivare'} i ticket su ${sortedWorkers.length} ${sortedWorkers.length === 1 ? 'pratica' : 'pratiche'}?`}
                        message="L'impostazione viene riscritta su tutte le pratiche mostrate e i conteggi vengono ricalcolati di conseguenza."
                        confirmLabel={allTicketsOn ? 'Disattiva Ticket' : 'Attiva Ticket'}
                    />
                )}
            </AnimatePresence>

            {/* CONFERMA ELIMINAZIONE MULTIPLA */}
            <AnimatePresence>
                {isBulkDeleteOpen && (
                    <ConfirmModal
                        isOpen={true}
                        onClose={() => setIsBulkDeleteOpen(false)}
                        onConfirm={confirmBulkDelete}
                        title={selectedIds.size === 1 ? 'Eliminare la pratica selezionata?' : `Eliminare ${selectedIds.size} pratiche selezionate?`}
                        message="Dopo la conferma avrai 5 secondi per annullare dal messaggio in alto a destra; poi l'eliminazione diventa definitiva."
                        confirmLabel="Elimina"
                    />
                )}
            </AnimatePresence>

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

                                                    {/* Sempre visibile: su touch il group-hover non scatta mai */}
                                                    <button onClick={() => { setActiveStatsModal(null); handleOpenSimple(item.id); }} className={`text-[11px] font-bold ${theme.textLight} hover:underline flex items-center justify-end gap-1 mt-1`}>
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
