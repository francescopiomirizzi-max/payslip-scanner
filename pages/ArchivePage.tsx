import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, FileText, Database, ChevronDown, ChevronRight,
  Download, Archive, Loader2, X, FolderOpen, File, Calendar, UploadCloud, Check,
} from 'lucide-react';
import { Worker, MONTH_NAMES } from '../types';
import { usePayslipArchive, PayslipRecord } from '../hooks/usePayslipArchive';
import { getProfiloBadgeLabel } from '../utils/formatters';

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

const ArchivePage: React.FC<ArchivePageProps> = ({ workers, onBack, initialWorkerId }) => {
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
    return sortedWorkers.filter(w =>
      w.cognome.toLowerCase().includes(q) ||
      w.nome.toLowerCase().includes(q) ||
      (w.profilo || '').toLowerCase().includes(q)
    );
  }, [sortedWorkers, searchQuery]);

  const selectedWorker = useMemo(
    () => workers.find(w => w.id === selectedWorkerId) ?? null,
    [workers, selectedWorkerId]
  );

  const loadWorkerPayslips = useCallback(async (workerId: string) => {
    if (payslipCache[workerId] !== undefined) return;
    setLoadingWorker(workerId);
    const records = await getPayslipsByWorker(workerId);
    setPayslipCache(prev => ({ ...prev, [workerId]: records }));
    setLoadingWorker(null);
  }, [payslipCache, getPayslipsByWorker]);

  // Auto-select worker when arriving from a card's archive button
  useEffect(() => {
    if (!initialWorkerId) return;
    const worker = workers.find(w => w.id === initialWorkerId);
    if (worker) {
      setSelectedWorkerId(initialWorkerId);
      loadWorkerPayslips(initialWorkerId);
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWorker = useCallback(async (worker: Worker) => {
    setSelectedWorkerId(worker.id);
    setSelectedPayslip(null);
    setPdfUrl(null);
    setExpandedYears(new Set());
    await loadWorkerPayslips(worker.id);
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

      // Build month entries: union of all months present in either source
      const monthIndexSet = new Set<number>([...dataMonths]);
      payslips.filter(p => Number(p.year) === year).forEach(p => {
        const idx = MONTH_NAMES.findIndex(m => m === p.month);
        if (idx >= 0) monthIndexSet.add(idx);
      });

      const months: MonthEntry[] = Array.from(monthIndexSet)
        .sort((a, b) => a - b)
        .map(monthIndex => ({
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

  const badgeStyle = (profilo: string) => {
    if (profilo === 'RFI') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (profilo === 'TRENITALIA') return 'bg-red-100 text-red-700 border-red-200';
    if (profilo === 'ELIOR') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (profilo === 'CLEAN_SERVICE') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-violet-100 text-violet-700 border-violet-200';
  };

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
              filteredWorkers.map(worker => {
                const isSelected = selectedWorkerId === worker.id;
                const isLoading = loadingWorker === worker.id;
                const count = payslipCountMap[worker.id];
                const dataMonths = (worker.anni ?? []).length;

                return (
                  <button
                    key={worker.id}
                    onClick={() => handleSelectWorker(worker)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-slate-100/60 dark:border-slate-800/60 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {worker.cognome.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-slate-800 dark:text-white truncate leading-tight">
                        {worker.cognome} {worker.nome}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeStyle(worker.profilo)}`}>
                          {getProfiloBadgeLabel(worker.profilo, worker.eliorType, true)}
                        </span>
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                        ) : count !== undefined ? (
                          <span className="text-[9px] font-bold text-slate-400">{count} PDF</span>
                        ) : (
                          <span className="text-[9px] text-slate-400">{dataMonths} mesi</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── COL 2: YEAR/MONTH TREE ── */}
        <div className="w-80 flex-none flex flex-col border-r border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40">
          {!selectedWorker ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Calendar className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Seleziona un lavoratore</p>
            </div>
          ) : (
            <>
              {/* Worker header */}
              <div className="flex-none px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-0.5">
                  {getProfiloBadgeLabel(selectedWorker.profilo, selectedWorker.eliorType, true)}
                </p>
                <p className="text-base font-black text-slate-800 dark:text-white truncate">
                  {selectedWorker.cognome} {selectedWorker.nome}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
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
                      {/* Year header */}
                      <button
                        onClick={() => toggleYear(year)}
                        className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {expandedYears.has(year)
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        }
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{year}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {payslipCount > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                              {payslipCount} PDF
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400">{months.length} mesi</span>
                        </div>
                      </button>

                      {/* Months */}
                      <AnimatePresence>
                        {expandedYears.has(year) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {months.map(({ monthIndex, monthName, hasData, payslip }) => {
                              const isSelectedPayslip = selectedPayslip?.id === payslip?.id;
                              return (
                                <button
                                  key={monthIndex}
                                  onClick={() => payslip ? handleSelectPayslip(payslip) : undefined}
                                  disabled={!payslip}
                                  className={`w-full flex items-center gap-3 pl-10 pr-5 py-2 transition-all ${
                                    isSelectedPayslip
                                      ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                      : payslip
                                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'
                                        : 'cursor-default opacity-60'
                                  }`}
                                >
                                  {/* Status icon */}
                                  {payslip ? (
                                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelectedPayslip ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`} />
                                  ) : hasData ? (
                                    <Database className="w-3.5 h-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 shrink-0" />
                                  )}

                                  {/* Month name */}
                                  <span className={`text-[11px] font-bold capitalize flex-1 text-left ${
                                    isSelectedPayslip ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {monthName.charAt(0) + monthName.slice(1).toLowerCase()}
                                  </span>

                                  {/* Right badges */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {payslip && (
                                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                                        PDF
                                      </span>
                                    )}
                                    {hasData && (
                                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                        dati
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
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
              <div className="w-20 h-20 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center">
                <File className="w-10 h-10 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Nessuna busta selezionata</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {selectedWorker ? 'Seleziona un mese con PDF per visualizzarlo' : 'Seleziona prima un lavoratore'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* PDF Header */}
              <div className="flex-none flex items-center gap-3 px-5 py-3 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
                    {selectedPayslip?.filename}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedWorker?.cognome} {selectedWorker?.nome} · {' '}
                    {selectedPayslip && (
                      <>
                        {selectedPayslip.month.charAt(0) + selectedPayslip.month.slice(1).toLowerCase()} {selectedPayslip.year}
                      </>
                    )}
                  </p>
                </div>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    download={selectedPayslip?.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-500/30"
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
              <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                <UploadCloud className="w-10 h-10 text-white" />
              </div>
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
