import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, ChevronDown, ChevronRight, ChevronLeft,
  Download, Archive, Loader2, X, FolderOpen, File, Calendar, UploadCloud, Check,
} from 'lucide-react';
import { Worker, MONTH_NAMES } from '../types';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS, getCompanyGradient, getCompanyHex, getCompanyLogo } from '../config/profiles';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { usePayslipArchive, PayslipRecord } from '../hooks/usePayslipArchive';
import { matchesCompanyFilter } from '../hooks/useWorkers';
import { getProfiloBadgeLabel } from '../utils/formatters';
import { useIsReadOnly } from '../lib/readonly';

interface ArchivePageProps {
  workers: Worker[];
  onBack: () => void;
  initialWorkerId?: string;
}

interface ParsedPayslipInfo {
  year: number | null;
  monthIndex: number | null;
  autoDetected: boolean;
}

function parsePayslipFromFilename(filename: string): ParsedPayslipInfo {
  const base = filename.toLowerCase().replace(/\.pdf$/i, '');

  const italianMonths = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ];

  let year: number | null = null;
  let monthIndex: number | null = null;

  // Try to find Italian month name
  for (let i = 0; i < italianMonths.length; i++) {
    if (base.includes(italianMonths[i])) {
      monthIndex = i;
      break;
    }
  }

  // Try to find year (4-digit, 1990–2099)
  const yearMatch = base.match(/\b(19[9]\d|20[0-2]\d)\b/);
  if (yearMatch) year = parseInt(yearMatch[1]);

  // Try YYYYMM or MMYYYY patterns if month not yet found
  if (monthIndex === null) {
    // YYYYMM: e.g. 202401
    const yyyymm = base.match(/\b(20[0-2]\d)(0[1-9]|1[0-2])\b/);
    if (yyyymm) {
      year = parseInt(yyyymm[1]);
      monthIndex = parseInt(yyyymm[2]) - 1;
    } else {
      // MM_YYYY or MM-YYYY or YYYY_MM or YYYY-MM
      const mmSepYyyy = base.match(/\b(0[1-9]|1[0-2])[-_\/](20[0-2]\d)\b/);
      if (mmSepYyyy) {
        monthIndex = parseInt(mmSepYyyy[1]) - 1;
        year = parseInt(mmSepYyyy[2]);
      } else {
        const yyyySepMm = base.match(/\b(20[0-2]\d)[-_\/](0[1-9]|1[0-2])\b/);
        if (yyyySepMm) {
          year = parseInt(yyyySepMm[1]);
          monthIndex = parseInt(yyyySepMm[2]) - 1;
        }
      }
    }
  }

  const autoDetected = year !== null && monthIndex !== null;
  return { year, monthIndex, autoDetected };
}

interface MonthEntry {
  monthIndex: number;
  monthName: string;
  hasData: boolean;
  payslip?: PayslipRecord;
}

interface YearEntry {
  year: number;
  months: MonthEntry[];
  payslipCount: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i);

const MONTH_ABBR = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

const ArchivePage: React.FC<ArchivePageProps> = ({ workers, onBack, initialWorkerId }) => {
  const isReadOnly = useIsReadOnly();
  const { getPayslipsByWorker, getSignedUrl, addPayslip } = usePayslipArchive();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [payslipCache, setPayslipCache] = useState<Record<string, PayslipRecord[]>>({});
  const [loadingWorker, setLoadingWorker] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // --- DRAG & DROP ---
  const dragCounter = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<File[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadWorkerId, setUploadWorkerId] = useState('');
  const [uploadYear, setUploadYear] = useState(CURRENT_YEAR);
  const [uploadMonthIndex, setUploadMonthIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadAutoDetected, setUploadAutoDetected] = useState(false);

  const currentFile = pendingQueue[queueIndex] ?? null;

  const sortedWorkers = useMemo(() =>
    [...workers].sort((a, b) => a.cognome.localeCompare(b.cognome, 'it')),
    [workers]
  );

  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return sortedWorkers;
    const q = searchQuery.toLowerCase();
    return sortedWorkers.filter(w => {
      // Allineata alla ricerca dashboard: azienda come la mostra la UI
      // (spazi, tipo Elior incluso) + ruolo
      const azienda = `${(w.profilo ?? '').replace(/_/g, ' ')}${w.profilo === 'ELIOR' && w.eliorType ? ' ' + w.eliorType : ''}`.toLowerCase();
      return w.cognome.toLowerCase().includes(q)
        || w.nome.toLowerCase().includes(q)
        || azienda.includes(q)
        || (w.ruolo ?? '').toLowerCase().includes(q);
    });
  }, [sortedWorkers, searchQuery]);

  // Gruppi per azienda nell'ordine del registro (Elior sdoppiata per tipo,
  // come i pill della dashboard), custom in coda, senza-azienda per ultimo.
  const workerGroups = useMemo(() => {
    const customIds = Array.from(
      new Set(filteredWorkers.map(w => w.profilo).filter((p): p is string => !!p && !SYSTEM_PROFILES[p]))
    ).sort((a, b) => a.localeCompare(b, 'it'));
    const ids = [
      ...SYSTEM_PROFILE_KEYS.flatMap(k => (k === 'ELIOR' ? [k, 'ELIOR_MAGAZZINO'] : [k])),
      ...customIds,
    ];
    const groups = ids
      .map(id => ({ id, workers: filteredWorkers.filter(w => matchesCompanyFilter(w, id)) }))
      .filter(g => g.workers.length > 0);
    const orphans = filteredWorkers.filter(w => !w.profilo);
    if (orphans.length > 0) groups.push({ id: 'SENZA_AZIENDA', workers: orphans });
    return groups;
  }, [filteredWorkers]);

  const selectedWorker = useMemo(
    () => workers.find(w => w.id === selectedWorkerId) ?? null,
    [workers, selectedWorkerId]
  );

  // Gruppi-azienda chiusi all'ingresso: si apre cliccando la barra (pattern
  // cassetti dashboard). La ricerca mostra aperti i gruppi con risultati.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const groupIdOf = (w: Worker) =>
    w.profilo === 'ELIOR' && w.eliorType === 'magazzino' ? 'ELIOR_MAGAZZINO' : (w.profilo ?? 'SENZA_AZIENDA');
  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const loadWorkerPayslips = useCallback(async (workerId: string) => {
    if (payslipCache[workerId] !== undefined) return payslipCache[workerId];
    setLoadingWorker(workerId);
    const records = await getPayslipsByWorker(workerId);
    setPayslipCache(prev => ({ ...prev, [workerId]: records }));
    setLoadingWorker(null);
    return records;
  }, [payslipCache, getPayslipsByWorker]);

  // Auto-select worker when arriving from a card's archive button
  useEffect(() => {
    if (!initialWorkerId) return;
    const worker = workers.find(w => w.id === initialWorkerId);
    // Stesso percorso della selezione manuale (incluso auto-expand anno recente)
    if (worker) handleSelectWorker(worker);
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWorker = useCallback(async (worker: Worker) => {
    setSelectedWorkerId(worker.id);
    setSelectedPayslip(null);
    setPdfUrl(null);
    setExpandedYears(new Set());
    // Il gruppo del selezionato resta/diventa visibile (conta per il deep-link dalla card)
    setExpandedGroups(prev => new Set([...prev, groupIdOf(worker)]));
    const records = await loadWorkerPayslips(worker.id);
    // Auto-apertura dell'anno più recente: con PDF se ce ne sono, altrimenti
    // l'ultimo anno con dati — si atterra già sulla griglia utile, zero click.
    const pdfYears = (records ?? []).map(r => Number(r.year)).filter(Number.isFinite);
    const dataYears = (worker.anni ?? []).map(a => a.year);
    const latest = pdfYears.length ? Math.max(...pdfYears) : dataYears.length ? Math.max(...dataYears) : null;
    if (latest !== null) setExpandedYears(new Set([latest]));
  }, [loadWorkerPayslips]);

  const handleSelectPayslip = useCallback(async (payslip: PayslipRecord) => {
    setSelectedPayslip(payslip);
    setPdfUrl(null);
    setLoadingPdf(true);
    const url = await getSignedUrl(payslip.storage_path);
    setPdfUrl(url);
    setLoadingPdf(false);
  }, [getSignedUrl]);

  const toggleYear = useCallback((year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  }, []);

  // Colori dell'azienda del lavoratore selezionato (stesso linguaggio di card/dettaglio)
  const companyHex = selectedWorker ? getCompanyHex(selectedWorker.profilo) : '#6366f1';
  const [gradStart, gradEnd] = selectedWorker ? getCompanyGradient(selectedWorker.profilo) : ['#6366f1', '#8b5cf6'];

  // --- NAVIGAZIONE SEQUENZIALE TRA LE BUSTE (‹ › e frecce tastiera) ---
  // Le buste del lavoratore in ordine cronologico: la verifica mese-per-mese
  // scorre senza tornare all'albero a ogni cambio.
  const orderedPayslips = useMemo(() => {
    if (!selectedWorker) return [] as PayslipRecord[];
    return [...(payslipCache[selectedWorker.id] ?? [])].sort(
      (a, b) => Number(a.year) - Number(b.year) || MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month)
    );
  }, [selectedWorker, payslipCache]);

  const currentPayslipIdx = useMemo(
    () => (selectedPayslip ? orderedPayslips.findIndex(p => p.id === selectedPayslip.id) : -1),
    [orderedPayslips, selectedPayslip]
  );

  const goToPayslip = useCallback((dir: 1 | -1) => {
    if (currentPayslipIdx < 0) return;
    const next = orderedPayslips[currentPayslipIdx + dir];
    if (!next) return;
    handleSelectPayslip(next);
    // Tiene l'albero in sync: l'anno della busta raggiunta resta visibile
    setExpandedYears(prev => new Set([...prev, Number(next.year)]));
  }, [currentPayslipIdx, orderedPayslips, handleSelectPayslip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showUploadModal || !selectedPayslip) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPayslip(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToPayslip(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToPayslip, selectedPayslip, showUploadModal]);

  // --- DRAG & DROP HANDLERS ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDraggingOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const initModalForFile = useCallback((file: File, defaultWorkerId: string) => {
    const parsed = parsePayslipFromFilename(file.name);
    setUploadWorkerId(defaultWorkerId);
    setUploadYear(parsed.year ?? CURRENT_YEAR);
    setUploadMonthIndex(parsed.monthIndex ?? 0);
    setUploadAutoDetected(parsed.autoDetected);
    setUploadDone(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;
    const defaultWorkerId = selectedWorkerId ?? (workers[0]?.id ?? '');
    setPendingQueue(files);
    setQueueIndex(0);
    initModalForFile(files[0], defaultWorkerId);
    setShowUploadModal(true);
  }, [selectedWorkerId, workers, initModalForFile]);

  const handleDismissModal = useCallback(() => {
    if (isUploading) return;
    setShowUploadModal(false);
    setPendingQueue([]);
    setQueueIndex(0);
    setUploadDone(false);
  }, [isUploading]);

  const handleUploadConfirm = useCallback(async () => {
    if (!currentFile || !uploadWorkerId) return;
    setIsUploading(true);
    const monthName = MONTH_NAMES[uploadMonthIndex];
    await addPayslip(uploadWorkerId, currentFile, uploadYear, monthName, uploadMonthIndex, {});
    setPayslipCache(prev => {
      const next = { ...prev };
      delete next[uploadWorkerId];
      return next;
    });
    if (uploadWorkerId === selectedWorkerId) {
      const records = await getPayslipsByWorker(uploadWorkerId);
      setPayslipCache(prev => ({ ...prev, [uploadWorkerId]: records }));
    }
    setIsUploading(false);
    setUploadDone(true);

    const nextIndex = queueIndex + 1;
    if (nextIndex < pendingQueue.length) {
      setTimeout(() => {
        const defaultWorkerId = selectedWorkerId ?? (workers[0]?.id ?? '');
        setQueueIndex(nextIndex);
        initModalForFile(pendingQueue[nextIndex], defaultWorkerId);
      }, 900);
    } else {
      setTimeout(() => {
        setShowUploadModal(false);
        setPendingQueue([]);
        setQueueIndex(0);
        setUploadDone(false);
      }, 1200);
    }
  }, [currentFile, uploadWorkerId, uploadYear, uploadMonthIndex, addPayslip, selectedWorkerId, getPayslipsByWorker, queueIndex, pendingQueue, workers, initModalForFile]);

  // Build year/month tree for selected worker
  const yearTree = useMemo((): YearEntry[] => {
    if (!selectedWorker) return [];
    const payslips = payslipCache[selectedWorker.id] ?? [];

    // Collect all years from both anni data and payslips
    const yearSet = new Set<number>();
    (selectedWorker.anni ?? []).forEach(d => yearSet.add(Number(d.year)));
    payslips.forEach(p => yearSet.add(Number(p.year)));

    return Array.from(yearSet).sort((a, b) => b - a).map(year => {
      // Months with AnnoDati
      const dataMonths = new Set<number>(
        (selectedWorker.anni ?? [])
          .filter(d => Number(d.year) === year)
          .map(d => Number(d.monthIndex))
      );

      // Payslips for this year, indexed by month name
      const payslipByMonth: Record<string, PayslipRecord> = {};
      payslips
        .filter(p => Number(p.year) === year)
        .forEach(p => { payslipByMonth[p.month] = p; });

      // Tutti i 12 mesi, sempre: la griglia-calendario mostra anche i mancanti
      // (cella tratteggiata), così la copertura si legge a colpo d'occhio.
      const months: MonthEntry[] = Array.from({ length: 12 }, (_, monthIndex) => ({
        monthIndex,
        monthName: MONTH_NAMES[monthIndex],
        hasData: dataMonths.has(monthIndex),
        payslip: payslipByMonth[MONTH_NAMES[monthIndex]],
      }));

      return {
        year,
        months,
        payslipCount: Object.keys(payslipByMonth).length,
      };
    });
  }, [selectedWorker, payslipCache]);

  // Auto-expand the most recent year when tree loads
  useEffect(() => {
    if (yearTree.length > 0 && expandedYears.size === 0) {
      setExpandedYears(new Set([yearTree[0].year]));
    }
  }, [yearTree]);

  // Payslip count per worker (from cache or workers.anni as fallback)
  const payslipCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(payslipCache).forEach(([id, records]) => {
      map[id] = records.length;
    });
    return map;
  }, [payslipCache]);

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >

      {/* TOP BAR */}
      <div className="flex-none flex items-center gap-4 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-sm font-bold">Dashboard</span>
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <Archive className="w-5 h-5 text-indigo-500" />
          <h1 className="text-lg font-black text-slate-800 dark:text-white">Archivio Buste Paga</h1>
        </div>
        <div className="ml-auto text-xs font-medium text-slate-400">
          {workers.length} {workers.length === 1 ? 'lavoratore' : 'lavoratori'}
        </div>
      </div>

      {/* 3-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">

        {/* ── COL 1: WORKERS ── */}
        <div className="w-72 flex-none flex flex-col border-r border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60">
          {/* Search */}
          <div className="flex-none p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca lavoratore..."
                className="flex-1 bg-transparent text-[11px] font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Workers list */}
          <div className="flex-1 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <FolderOpen className="w-8 h-8 opacity-40" />
                <p className="text-xs">Nessun risultato</p>
              </div>
            ) : (
              workerGroups.map(group => {
                const isEliorMag = group.id === 'ELIOR_MAGAZZINO';
                const logoProfilo = isEliorMag ? 'ELIOR' : group.id;
                const groupLabel = isEliorMag ? 'Elior Magazzino' : group.id.replace(/_/g, ' ');
                // In ricerca i gruppi con risultati sono aperti, altrimenti comanda il click
                const isGroupOpen = searchQuery.trim().length > 0 || expandedGroups.has(group.id);
                return (
                  <div key={group.id}>
                    {/* Barra-azienda sticky: chiusa all'ingresso, click per aprire */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                    >
                      {isGroupOpen
                        ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      }
                      {getCompanyLogo(logoProfilo) ? (
                        <CompanyLogo profilo={logoProfilo} eliorType={isEliorMag ? 'magazzino' : undefined} h={19} title={groupLabel} />
                      ) : (
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{groupLabel}</span>
                      )}
                      <span className="ml-auto text-xs font-bold tabular-nums text-slate-400">{group.workers.length}</span>
                    </button>
                    <AnimatePresence initial={false}>
                    {isGroupOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                    {group.workers.map(worker => {
                const isSelected = selectedWorkerId === worker.id;
                const isLoading = loadingWorker === worker.id;
                const count = payslipCountMap[worker.id];
                const dataMonths = (worker.anni ?? []).length;
                const wHex = getCompanyHex(worker.profilo);
                const [wGradS, wGradE] = getCompanyGradient(worker.profilo);

                return (
                  <button
                    key={worker.id}
                    onClick={() => handleSelectWorker(worker)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-slate-100/60 dark:border-slate-800/60 border-l-2 ${
                      isSelected ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                    style={isSelected
                      ? { borderLeftColor: wHex, backgroundColor: `${wHex}14` }
                      : { borderLeftColor: 'transparent' }}
                  >
                    {/* Avatar nel gradiente dell'azienda (come l'header del dettaglio) */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm transition-transform ${isSelected ? 'scale-105' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${wGradS}, ${wGradE})` }}
                    >
                      {worker.cognome.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-slate-800 dark:text-white truncate leading-tight">
                        {worker.cognome} {worker.nome}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* L'azienda la dice già l'header del gruppo: qui solo i conteggi */}
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                        ) : count !== undefined ? (
                          <span className="text-[9px] font-bold tabular-nums text-slate-400">{count} PDF</span>
                        ) : (
                          <span className="text-[9px] tabular-nums text-slate-400">{dataMonths} mesi</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
                    })}
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COL 2: YEAR/MONTH TREE ── */}
        <div className="w-80 flex-none flex flex-col border-r border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40">
          {!selectedWorker ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-cyan-500/10 blur-xl pointer-events-none" />
                <div className="relative w-16 h-16 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Seleziona un lavoratore</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Gli anni si aprono in una griglia mese per mese</p>
              </div>
            </div>
          ) : (
            <>
              {/* Worker header — logo azienda (fallback testuale per le custom) */}
              <div className="flex-none px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                {getCompanyLogo(selectedWorker.profilo) ? (
                  <CompanyLogo profilo={selectedWorker.profilo} eliorType={selectedWorker.eliorType} h={16} className="mb-1" title={getProfiloBadgeLabel(selectedWorker.profilo, selectedWorker.eliorType)} />
                ) : (
                  <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: companyHex }}>
                    {getProfiloBadgeLabel(selectedWorker.profilo, selectedWorker.eliorType, true)}
                  </p>
                )}
                <p className="text-base font-black text-slate-800 dark:text-white truncate">
                  {selectedWorker.cognome} {selectedWorker.nome}
                </p>
                <p className="text-[10px] tabular-nums text-slate-400 mt-0.5">
                  {yearTree.length} {yearTree.length === 1 ? 'anno' : 'anni'} · {' '}
                  {yearTree.reduce((s, y) => s + y.payslipCount, 0)} PDF caricati
                </p>
              </div>

              {/* Tree */}
              <div className="flex-1 overflow-y-auto py-2">
                {loadingWorker === selectedWorker.id ? (
                  <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Caricamento...</span>
                  </div>
                ) : yearTree.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Archive className="w-8 h-8 opacity-30" />
                    <p className="text-xs">Nessun dato disponibile</p>
                  </div>
                ) : (
                  yearTree.map(({ year, months, payslipCount }) => (
                    <div key={year} className="mb-1">
                      {/* Year header — micro-barra di copertura: 12 punti, pieno = PDF */}
                      <button
                        onClick={() => toggleYear(year)}
                        className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {expandedYears.has(year)
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        }
                        <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">{year}</span>
                        <div className="ml-auto flex items-center gap-2.5">
                          <div className="flex items-center gap-[3px]">
                            {months.map(m => (
                              <span
                                key={m.monthIndex}
                                className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"
                                style={m.payslip ? { backgroundColor: companyHex } : undefined}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold tabular-nums text-slate-400">{payslipCount}/12</span>
                        </div>
                      </button>

                      {/* Griglia-calendario: 12 celle, si legge come la timeline della card.
                          Piena = PDF (clic per aprire) · bordo = solo dati · tratteggiata = mancante */}
                      <AnimatePresence>
                        {expandedYears.has(year) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-4 gap-1.5 px-5 pb-3 pt-1">
                              {months.map(({ monthIndex, monthName, hasData, payslip }) => {
                                const isSelectedPayslip = !!payslip && selectedPayslip?.id === payslip.id;
                                const meseLabel = monthName.charAt(0) + monthName.slice(1).toLowerCase();
                                // Mese segnalato come "da sistemare" (file di un altro periodo): cornice rossa + pallino
                                const isFix = (selectedWorker?.fixTargets ?? []).some(
                                  t => t.year === year && t.monthIndex === monthIndex
                                );
                                const fixTitle = isFix ? ' · ⚠ DA SISTEMARE (è di un altro periodo)' : '';
                                const fixDot = isFix ? (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                ) : null;
                                if (payslip) {
                                  return (
                                    <button
                                      key={monthIndex}
                                      onClick={() => handleSelectPayslip(payslip)}
                                      title={`${meseLabel} ${year} — apri PDF${fixTitle}`}
                                      className={`relative h-9 rounded-lg flex items-center justify-center text-[10px] font-black tracking-wide text-white shadow-sm transition-all duration-150 hover:scale-[1.06] hover:shadow-md ${
                                        isFix ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                                        : isSelectedPayslip ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''
                                      }`}
                                      style={{
                                        background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
                                        ...(isSelectedPayslip && !isFix ? { ['--tw-ring-color' as any]: companyHex } : {}),
                                      }}
                                    >
                                      {fixDot}
                                      {MONTH_ABBR[monthIndex]}
                                    </button>
                                  );
                                }
                                if (hasData) {
                                  return (
                                    <div
                                      key={monthIndex}
                                      title={`${meseLabel} ${year} — dati inseriti, PDF non caricato${fixTitle}`}
                                      className={`relative h-9 rounded-lg flex items-center justify-center text-[10px] font-black tracking-wide border ${isFix ? 'ring-2 ring-red-500' : ''}`}
                                      style={isFix
                                        ? { color: '#dc2626', borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                                        : { color: companyHex, borderColor: `${companyHex}55`, backgroundColor: `${companyHex}0F` }}
                                    >
                                      {fixDot}
                                      {MONTH_ABBR[monthIndex]}
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={monthIndex}
                                    title={`${meseLabel} ${year} — mancante${fixTitle}`}
                                    className={`relative h-9 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide border ${
                                      isFix
                                        ? 'border-red-400 dark:border-red-600 text-red-500 dark:text-red-400 ring-2 ring-red-500/40 bg-red-50 dark:bg-red-950/30'
                                        : 'border-dashed border-slate-200 dark:border-slate-700/60 text-slate-300 dark:text-slate-600'
                                    }`}
                                  >
                                    {fixDot}
                                    {MONTH_ABBR[monthIndex]}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── COL 3: PDF VIEWER ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 dark:bg-slate-950/50">
          {!selectedPayslip && !loadingPdf ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-cyan-500/10 blur-xl pointer-events-none" />
                <div className="relative w-20 h-20 rounded-3xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center">
                  <File className="w-9 h-9 text-slate-300 dark:text-slate-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Nessuna busta selezionata</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {selectedWorker ? 'Clicca un mese pieno nella griglia, poi scorri con ‹ › o le frecce' : 'Seleziona prima un lavoratore'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* PDF Header — mese/anno come titolo, filename in secondo piano,
                  frecce ‹ › per scorrere le buste in ordine cronologico (anche ←/→) */}
              <div className="flex-none flex items-center gap-3 px-5 py-3 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => goToPayslip(-1)}
                    disabled={currentPayslipIdx <= 0}
                    title="Busta precedente (←)"
                    className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => goToPayslip(1)}
                    disabled={currentPayslipIdx < 0 || currentPayslipIdx >= orderedPayslips.length - 1}
                    title="Busta successiva (→)"
                    className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">
                    {selectedPayslip && (
                      <>
                        {selectedPayslip.month.charAt(0) + selectedPayslip.month.slice(1).toLowerCase()}{' '}
                        <span className="tabular-nums">{selectedPayslip.year}</span>
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {selectedWorker?.cognome} {selectedWorker?.nome} · {selectedPayslip?.filename}
                  </p>
                </div>
                {currentPayslipIdx >= 0 && (
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                    {currentPayslipIdx + 1} / {orderedPayslips.length}
                  </span>
                )}
                {/* Download busta — nascosto al viewer (sola lettura): può consultare
                    la busta a video ma non scaricarla. */}
                {pdfUrl && !isReadOnly && (
                  <a
                    href={pdfUrl}
                    download={selectedPayslip?.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[10px] font-black uppercase tracking-wide hover:opacity-90 transition-opacity shadow-md"
                    style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }}
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                )}
              </div>

              {/* PDF Body */}
              <div className="flex-1 relative">
                {loadingPdf ? (
                  <div className="flex items-center justify-center h-full gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Caricamento PDF...</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title={selectedPayslip?.filename}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                    <File className="w-8 h-8 opacity-40" />
                    <p className="text-sm">Impossibile caricare il PDF</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── DRAG OVERLAY ── */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-600/20 dark:bg-indigo-900/40 backdrop-blur-sm border-4 border-dashed border-indigo-400 dark:border-indigo-500 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40"
              >
                <UploadCloud className="w-10 h-10 text-white" />
              </motion.div>
              <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">Rilascia per caricare</p>
              <p className="text-sm text-indigo-500 dark:text-indigo-400">PDF busta paga · più file supportati</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── UPLOAD MODAL ── */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
            onClick={handleDismissModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-700 p-6 mx-4"
            >
              {uploadDone ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-base font-black text-slate-800 dark:text-white">Caricata!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <h2 className="text-base font-black text-slate-800 dark:text-white">Carica busta paga</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {pendingQueue.length > 1 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                          {queueIndex + 1} / {pendingQueue.length}
                        </span>
                      )}
                      {!isUploading && (
                        <button onClick={handleDismissModal} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 mb-2">
                    <File className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{currentFile?.name}</span>
                  </div>

                  {uploadAutoDetected && (
                    <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                      <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Rilevato automaticamente dal nome file</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Lavoratore */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lavoratore</label>
                      <select
                        value={uploadWorkerId}
                        onChange={e => setUploadWorkerId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.cognome} {w.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Anno */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Anno</label>
                        <select
                          value={uploadYear}
                          onChange={e => setUploadYear(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      {/* Mese */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mese</label>
                        <select
                          value={uploadMonthIndex}
                          onChange={e => setUploadMonthIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {MONTH_NAMES.map((m, i) => (
                            <option key={i} value={i}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleUploadConfirm}
                    disabled={isUploading || !uploadWorkerId}
                    className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {isUploading
                      ? 'Caricamento...'
                      : pendingQueue.length > 1 && queueIndex + 1 < pendingQueue.length
                        ? `Carica e prossimo (${queueIndex + 2}/${pendingQueue.length})`
                        : 'Carica'
                    }
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ArchivePage;
