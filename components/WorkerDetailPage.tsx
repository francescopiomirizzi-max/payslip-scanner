import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePayslipUpload } from '../hooks/usePayslipUpload';
import { usePayslipArchive } from '../hooks/usePayslipArchive';
import { useFixedVociBackfill } from '../hooks/useFixedVociBackfill';
import { getFixedVociIds } from '../utils/fixedVociBackfill';
import { useOCRSniper } from '../hooks/useOCRSniper';
import { useIslandSync } from '../hooks/useIslandSync';
import { useStatsData } from '../hooks/useStatsData';
import MonthlyDataGrid, { VerifyState, VerifyDiscrepancy } from './WorkerTables/MonthlyDataGrid';
import AnnualCalculationTable from './WorkerTables/AnnualCalculationTable';
import IndemnityPivotTable from './WorkerTables/IndemnityPivotTable';
import TfrCalculationTable from './WorkerTables/TfrCalculationTable';
import PayslipArchiveTab from './WorkerTables/PayslipArchiveTab';
import TableComponent from './TableComponent';
import WorkerDetailLayout from './WorkerDetailLayout';
import { WorkerDetailProvider } from './WorkerDetail/WorkerDetailContext';
import { printPayslipTables } from '../utils/printTables';
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES, resolveIncludePaidLeave } from '../types';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS, getCustomColorIndex } from '../config/profiles';
import { parseMonthFromFilename } from '../constants';
import { useIsReadOnly } from '../lib/readonly';
import type { ArchivedPick } from './SplitViewViewer';

// --- CONFIGURAZIONE PROFILI PEC (derivata dal registro centralizzato) ---
const PROFILE_CONFIG: Record<string, { label: string; pec: string }> = Object.fromEntries(
  SYSTEM_PROFILE_KEYS.map(k => [k, { label: SYSTEM_PROFILES[k].detailLabel, pec: SYSTEM_PROFILES[k].pec }])
);

interface WorkerDetailPageProps {
  worker: Worker;
  onUpdateData: (data: AnnoDati[]) => void;
  onUpdateStatus: (status: string) => void;
  onUpdateWorkerFields: (fields: Partial<Worker>) => void;
  /** Salvataggio per-ID a livello app (sopravvive alla navigazione): usato dal backfill
   *  così l'estrazione persiste anche se l'utente lascia la pagina del lavoratore. */
  onPersistWorkerById?: (id: string, fields: Partial<Worker>) => void;
  onBack: () => void;
}

const WorkerDetailPage: React.FC<WorkerDetailPageProps> = ({ worker, onUpdateData, onUpdateStatus, onUpdateWorkerFields, onPersistWorkerById, onBack }) => {
  const [monthlyInputs, setMonthlyInputs] = useState<AnnoDati[]>(Array.isArray(worker?.anni) ? worker.anni : []);

  // DYNAMIC SYNC: Lo stato locale comanda, il Parent riceve aggiornamenti in automatico
  const lastSyncRef = useRef<string>(JSON.stringify(monthlyInputs));
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentStr = JSON.stringify(monthlyInputs);
      if (currentStr !== lastSyncRef.current) {
        lastSyncRef.current = currentStr;
        onUpdateData(monthlyInputs);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [monthlyInputs, onUpdateData]);

  // Il tab vive nel 4° segmento dell'hash (#/worker/:id/:tab): F5 e deep link
  // riaprono il tab giusto. Scrittura con replaceState (i tab non sporcano la
  // history); useHashRoute tollera il segmento extra.
  type DetailTab = 'input' | 'calc' | 'pivot' | 'tfr' | 'archive';
  const DETAIL_TABS: readonly DetailTab[] = ['input', 'calc', 'pivot', 'tfr', 'archive'];
  const [activeTab, setActiveTab] = useState<DetailTab>(() => {
    const seg = window.location.hash.split('/')[3];
    return (DETAIL_TABS as readonly string[]).includes(seg) ? (seg as DetailTab) : 'input';
  });
  useEffect(() => {
    const base = `#/worker/${worker.id}`;
    if (!window.location.hash.startsWith(base)) return; // non siamo la vista attiva
    const route = activeTab === 'input' ? base : `${base}/${activeTab}`;
    if (window.location.hash !== route) window.history.replaceState(null, '', route);
  }, [activeTab, worker.id]);
  const [archiveCount, setArchiveCount] = useState(0);

  // Build archive entries map whenever archiveCount changes (new upload or delete)
  useEffect(() => {
    getPayslipsByWorker(worker.id).then(records => {
      const map: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      const picks: ArchivedPick[] = [];
      records.forEach(r => {
        const monthIdx = MONTH_NAMES.indexOf(r.month.toUpperCase());
        if (monthIdx !== -1) {
          map[`${r.year}-${monthIdx}`] = r.storage_path;
          idMap[`${r.year}-${monthIdx}`] = r.id;
          picks.push({ id: r.id, storage_path: r.storage_path, filename: r.filename, year: r.year, month: r.month, monthIdx });
        }
      });
      picks.sort((a, b) => a.year - b.year || a.monthIdx - b.monthIdx);
      setArchiveEntries(map);
      setArchiveIdMap(idMap);
      setArchivedPicks(picks);
    });
  }, [worker.id, archiveCount]);

  const handleVerifyRequest = async (row: AnnoDati) => {
    const vKey = `${row.year}-${row.monthIndex}`;
    const storagePath = archiveEntries[vKey];
    if (!storagePath) return;

    setVerifyStates(prev => ({ ...prev, [vKey]: { status: 'loading', discrepancies: [] } }));

    // Codici indennità del profilo (sistema O custom) — passati SEMPRE al verificatore
    // così può fare una verifica esaustiva voce per voce, anche dei codici a 0.0.
    const standardFields = new Set(['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'arretrati', 'note']);
    const customColumns = getColumnsByProfile(worker.profilo, worker.eliorType)
      .filter(c => !standardFields.has(c.id) && c.type !== 'formula')
      .map(c => ({ id: c.id, label: c.label }));

    try {
      const pdfUrl = await getSignedUrl(storagePath);
      if (!pdfUrl) throw new Error('URL firmato non disponibile');

      const res = await fetch('/.netlify/functions/verify-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl,
          monthData: row,
          company: worker.profilo,
          eliorType: worker.eliorType,
          customColumns,
        }),
      });

      if (!res.ok) throw new Error(`Errore server: ${res.status}`);
      const result: { status: 'success' | 'warning' | 'error'; discrepancies: VerifyDiscrepancy[] } = await res.json();
      setVerifyStates(prev => ({ ...prev, [vKey]: result }));

      // Log the verification result
      const recordId = archiveIdMap[vKey];
      if (recordId) {
        void addVerifyLog(recordId, {
          run_at: new Date().toISOString(),
          status: result.status,
          discrepancy_count: result.discrepancies.length,
        });
      }
    } catch (err: any) {
      setVerifyStates(prev => ({
        ...prev,
        [vKey]: { status: 'error', discrepancies: [], errorMessage: `Errore durante la verifica: ${err.message}` },
      }));
    }
  };

  const handleAcceptCorrection = (year: number, monthIndex: number, field: string, value: number) => {
    setMonthlyInputs(prev => prev.map(row =>
      row.year === year && row.monthIndex === monthIndex ? { ...row, [field]: value } : row
    ));
    const vKey = `${year}-${monthIndex}`;
    setVerifyStates(prev => {
      const vs = prev[vKey];
      if (!vs) return prev;
      const remaining = vs.discrepancies.filter(d => d.field !== field);
      return { ...prev, [vKey]: { ...vs, discrepancies: remaining, status: remaining.length === 0 ? 'success' : vs.status } };
    });
  };

  const handleAcceptAllCorrections = (year: number, monthIndex: number) => {
    const vKey = `${year}-${monthIndex}`;
    const vs = verifyStates[vKey];
    if (!vs || vs.discrepancies.length === 0) return;
    const corrections: Record<string, number> = {};
    vs.discrepancies.forEach(d => { corrections[d.field] = d.suggested; });
    setMonthlyInputs(prev => prev.map(row =>
      row.year === year && row.monthIndex === monthIndex ? { ...row, ...corrections } : row
    ));
    setVerifyStates(prev => ({ ...prev, [vKey]: { ...vs, discrepancies: [], status: 'success' } }));
  };
  const [showReport, setShowReport] = useState(false);
  const [isAiTfrModalOpen, setIsAiTfrModalOpen] = useState(false);
  const [isIstatModalOpen, setIsIstatModalOpen] = useState(false);
  const [aiTfrAmount, setAiTfrAmount] = useState<string>('');
  const [aiTfrYear, setAiTfrYear] = useState<string>('');

  const [startClaimYear, setStartClaimYear] = useState<number>(() => {
    if (worker.startClaimYear !== undefined) return worker.startClaimYear;
    const saved = localStorage.getItem(`startYear_${worker.id}`);
    return saved ? parseInt(saved) : 2008;
  });

  const dynamicYears = useMemo(() => {
    const DEFAULT_START = 2007;
    const END_YEAR = 2025;
    const effectiveStart = startClaimYear > DEFAULT_START + 1
      ? startClaimYear - 1
      : DEFAULT_START;
    return Array.from(
      { length: END_YEAR - effectiveStart + 1 },
      (_, i) => effectiveStart + i
    );
  }, [startClaimYear]);

  const [activeTickerModal, setActiveTickerModal] = useState<{ title: string, content: React.ReactNode } | null>(null);

  // True se siamo atterrati da un click sulla YearTimeline della card: in quel caso
  // l'utente vuole proprio la griglia mensile di quell'anno, anche se è il viewer
  // readonly (che altrimenti atterra sul tab Calcolo Annuale). Va letto PRIMA
  // dell'inizializzazione di currentYear, che consuma l'hint.
  const hadOpenYearHint = useRef<boolean>(
    typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem(`openYear_${worker.id}`)
  );

  const [currentYear, setCurrentYear] = useState<number>(() => {
    // Hint one-shot dalla YearTimeline della WorkerCard: il click su una tacca
    // anno deve far atterrare direttamente su quell'anno.
    try {
      const hint = sessionStorage.getItem(`openYear_${worker.id}`);
      if (hint) {
        sessionStorage.removeItem(`openYear_${worker.id}`);
        const y = parseInt(hint);
        if (!isNaN(y)) return y;
      }
    } catch {}
    if (worker?.anni && worker.anni.length > 0) {
      const activeInputs = worker.anni.filter((d: AnnoDati) =>
        (d.imponibile_tfr_mensile && d.imponibile_tfr_mensile > 0) ||
        (d.daysWorked && Number(d.daysWorked) > 0) ||
        (d.daysVacation && Number(d.daysVacation) > 0) ||
        (d.daysPaidLeave && Number(d.daysPaidLeave) > 0)
      );
      const anniCompilati = activeInputs.map((d: AnnoDati) => Number(d.year)).filter((y: number) => !isNaN(y));
      if (anniCompilati.length > 0) return Math.max(...anniCompilati);
    }
    const initialYear = worker.startClaimYear
      ?? (localStorage.getItem(`startYear_${worker.id}`) ? parseInt(localStorage.getItem(`startYear_${worker.id}`)!) : 2008);
    return initialYear - 1;
  });

  const { addPayslip, getPayslipsByWorker, getSignedUrl, getSignedUrls, addVerifyLog } = usePayslipArchive();

  // --- VERIFICA AI ---
  const [archiveEntries, setArchiveEntries] = useState<Record<string, string>>({});
  const [archiveIdMap, setArchiveIdMap] = useState<Record<string, string>>({});
  // Lista buste archiviate per il picker del visore (ordinata cronologicamente).
  const [archivedPicks, setArchivedPicks] = useState<ArchivedPick[]>([]);
  const isReadOnly = useIsReadOnly();
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({});

  // Il viewer readonly atterra sul tab "Calcolo Annuale" (totali per anno + % di
  // incidenza): è la vista da consultazione, la griglia di input resta nel tab.
  // useIsReadOnly risolve la sessione in async, quindi si corregge qui e non nella
  // useState; solo se l'utente non ha già cambiato tab e non c'è l'hint anno.
  useEffect(() => {
    if (isReadOnly && activeTab === 'input' && !hadOpenYearHint.current) {
      setActiveTab('calc');
    }
    // attivo solo al flip di isReadOnly: un ritorno manuale su 'input' deve restare
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly]);

  // Prospetto TFR: fuori dal piano di consultazione (sarà un modulo a pagamento).
  // Il viewer non deve arrivarci nemmeno via hash/deep-link: rimbalzo su 'calc'.
  useEffect(() => {
    if (isReadOnly && activeTab === 'tfr') setActiveTab('calc');
  }, [isReadOnly, activeTab]);

  // --- BACKFILL VOCI FISSE (Quadro B) dalle buste già in archivio ---
  // Solo profili con voci fisse definite. Merge-safe: scrive SOLO le voci fisse del profilo.
  const { progress: backfillProgress, run: runFixedBackfill, runFromFiles: runFixedBackfillFromFiles, stop: stopFixedBackfill } = useFixedVociBackfill();
  const fixedUploadRef = useRef<HTMLInputElement>(null);
  const fixedVociIds = useMemo(() => getFixedVociIds(worker.profilo), [worker.profilo]);
  const hasFixedProfile = fixedVociIds.length > 0;
  // Anni che hanno effettivamente buste in archivio (per lo scope annuale del backfill).
  const archiveYears = useMemo(
    () => [...new Set(archivedPicks.map(p => p.year))].sort((a, b) => a - b),
    [archivedPicks]
  );
  const [backfillYear, setBackfillYear] = useState<number>(currentYear);
  // Tieni l'anno selezionato DENTRO gli anni realmente in archivio. Col default = anno
  // corrente (spesso non archiviato) o con un solo anno disponibile, il <select> mostrerebbe
  // il primo anno ma lo stato resterebbe sull'anno corrente (onChange mai scattato) → il
  // backfill filtrerebbe l'anno sbagliato e risponderebbe "nessuna busta". Allinea al più
  // recente anno archiviato appena l'archivio è noto / cambia.
  useEffect(() => {
    if (archiveYears.length && !archiveYears.includes(backfillYear)) {
      setBackfillYear(archiveYears[archiveYears.length - 1]);
    }
  }, [archiveYears]);
  // Modale in-app per il backfill (al posto di window.confirm/alert del browser).
  const [backfillModal, setBackfillModal] = useState<
    | { kind: 'confirm'; year: number; picks: { storage_path: string; year: number; monthIdx: number }[] }
    | { kind: 'info'; text: string }
    | null
  >(null);

  const handleBackfillFixed = () => {
    if (isReadOnly || backfillProgress.running || archivedPicks.length === 0) return;
    // Scope ANNUALE + salta le buste i cui mesi hanno GIÀ voci fisse (ripristinabile).
    const needs = archivedPicks.filter(p => {
      if (p.year !== backfillYear) return false;
      const row = monthlyInputs.find(r => Number(r.year) === p.year && Number(r.monthIndex) === p.monthIdx);
      if (!row) return false; // nessuna riga dati per quel mese: niente in cui fare merge
      return !fixedVociIds.some(id => Number((row as any)[id]) > 0);
    });
    if (needs.length === 0) {
      setBackfillModal({ kind: 'info', text: `Anno ${backfillYear}: voci fisse già presenti (o nessuna busta in archivio per quest'anno).` });
      return;
    }
    setBackfillModal({
      kind: 'confirm',
      year: backfillYear,
      picks: needs.map(p => ({ storage_path: p.storage_path, year: p.year, monthIdx: p.monthIdx })),
    });
  };

  const confirmBackfillFixed = async () => {
    if (backfillModal?.kind !== 'confirm') return;
    const picks = backfillModal.picks;
    const workerId = worker.id;
    setBackfillModal(null);
    await runFixedBackfill({
      picks,
      anni: monthlyInputs,
      company: worker.profilo,
      getSignedUrls,
      onResult: (anni) => {
        setMonthlyInputs(anni);                          // griglia live (no-op se la pagina è smontata)
        onPersistWorkerById?.(workerId, { anni });       // salvataggio app-level: sopravvive alla navigazione
      },
    });
  };

  // Carica buste da DISCO ed estrae SOLO le voci fisse (per i lavoratori senza archivio).
  // Stessa estrazione leggera + merge-safe del backfill, ma la sorgente è un File, non l'archivio.
  // Bonus: archivia anche la busta (dedup sui mesi già presenti, l'insert metadati non è idempotente).
  const handleUploadFixedVoci = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // consenti di riselezionare gli stessi file
    if (isReadOnly || backfillProgress.running || files.length === 0) return;
    const workerId = worker.id;
    const res = await runFixedBackfillFromFiles({
      files,
      anni: monthlyInputs,
      company: worker.profilo,
      onResult: (anni) => {
        setMonthlyInputs(anni);
        onPersistWorkerById?.(workerId, { anni });
      },
      onArchive: async (file, year, monthIdx) => {
        if (archiveEntries[`${year}-${monthIdx}`]) return; // già in archivio: niente doppioni
        await addPayslip(workerId, file, year, MONTH_NAMES[monthIdx], monthIdx, {});
        setArchiveCount(n => n + 1);
      },
    });
    setBackfillModal({
      kind: 'info',
      text: `Voci fisse da file: ${res.updated} mesi aggiornati`
        + (res.skipped ? `, ${res.skipped} saltati (nessuna riga dati per quel mese o periodo non riconosciuto)` : '')
        + (res.errors ? `, ${res.errors} non letti` : '') + '.',
    });
  };

  const {
    isAnalyzing,
    isBatchProcessing,
    batchProgress,
    batchTotal,
    batchNotification,
    setBatchNotification,
    isQRModalOpen,
    setIsQRModalOpen,
    scanRef,
    handleBatchUpload,
    handleBatchDrop,
    handleFileUpload,
    handleQRData,
  } = usePayslipUpload({
    worker,
    monthlyInputs,
    setMonthlyInputs,
    setCurrentYear,
    onArchive: async (file, year, month, monthIndex, extractedData) => {
      await addPayslip(worker.id, file, year, month, monthIndex, extractedData);
      setArchiveCount(n => n + 1);
    },
  });

  useEffect(() => {
    localStorage.setItem(`startYear_${worker.id}`, startClaimYear.toString());
    onUpdateWorkerFields({ startClaimYear });
  }, [startClaimYear]);

  useEffect(() => {
    const prevYear = startClaimYear - 1;
    if (monthlyInputs.length === 0) setCurrentYear(prevYear);
    const hasPrevData = monthlyInputs.some(r => Number(r.year) === prevYear);
    if (!hasPrevData) {
      setBatchNotification({
        msg: `⚠️ Attenzione: Hai impostato il ${startClaimYear}.\nRicorda di caricare le buste del ${prevYear} per calcolare la media corretta!`,
        type: 'warning'
      });
      const timer = setTimeout(() => setBatchNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [startClaimYear, monthlyInputs]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('island-worker-context', {
      detail: {
        nome: worker.nome,
        cognome: worker.cognome,
        profilo: worker.profilo,
        eliorType: worker.eliorType ?? null,
      }
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('island-worker-context', { detail: null }));
      window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'detail' }));
    };
  }, [worker.id]);

  const [showSplit, setShowSplit] = useState(false);
  const [payslipFiles, setPayslipFiles] = useState<string[]>([]);
  // Nomi dei file paralleli a payslipFiles (gli URL blob non li conservano): servono
  // a ricavare il mese di ogni PDF per badge + sincronizzazione con la tabella.
  const [payslipFileNames, setPayslipFileNames] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [imgScale, setImgScale] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgFilter, setImgFilter] = useState<'none' | 'contrast'>('none');

  // Mese/anno del PDF mostrato nel visore, ricavato dal nome del file. Alimenta il
  // badge del visore e la sincronizzazione con la tabella (sola direzione visore → tabella).
  const currentFileMonth = useMemo(
    () => parseMonthFromFilename(payslipFileNames[currentFileIndex]),
    [payslipFileNames, currentFileIndex]
  );
  const currentFileMonthLabel = currentFileMonth
    ? `${MONTH_NAMES[currentFileMonth.monthIndex]}${currentFileMonth.year ? ` ${currentFileMonth.year}` : ''}`
    : null;
  // Attivi solo a visore aperto: pilotano l'evidenziazione del mese nella tabella.
  const activeMonthIndex = showSplit && currentFileMonth ? currentFileMonth.monthIndex : null;
  const activeYear = showSplit && currentFileMonth ? currentFileMonth.year : null;

  const handleZoom = (delta: number) => {
    setImgScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);

  const {
    isSniperMode,
    setIsSniperMode,
    selectionBox,
    isSelecting,
    isProcessing,
    imgRef,
    containerRef,
    onSniperMouseDown,
    onSniperMouseMove,
    onSniperMouseUp,
  } = useOCRSniper({
    monthlyInputs,
    setMonthlyInputs,
    currentYear,
    activeCell,
    currentFileUrl: payslipFiles[currentFileIndex] ?? null,
    columnDefs: getColumnsByProfile(worker.profilo, worker.eliorType),
  });

  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationData, setExplanationData] = useState<string | null>(null);
  const validStatuses = ['analisi', 'pronta', 'inviata', 'trattativa', 'chiusa'] as const;
  type LegalStatus = typeof validStatuses[number];
  const initialStatus: LegalStatus = validStatuses.includes(worker.status as LegalStatus) ? (worker.status as LegalStatus) : 'analisi';
  const [legalStatus, setLegalStatus] = useState<LegalStatus>(initialStatus);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const [includeExFest, setIncludeExFest] = useState(() => {
    if (worker.includeExFest !== undefined) return worker.includeExFest;
    const saved = localStorage.getItem(`exFest_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [includeTickets, setIncludeTickets] = useState(() => {
    if (worker.includeTickets !== undefined) return worker.includeTickets;
    const saved = localStorage.getItem(`tickets_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Strategia B sindacale: assenze retribuite nel divisore. Default OFF / Strategia A per tutti
  // (il ricorso usa le "effettive giornate lavorative"); ON come opt-in per-lavoratore via
  // toggle "Permessi" — riservato ai distaccati sindacali a ~0 presenze (es. i 2 Cataneo).
  const [includePaidLeave, setIncludePaidLeave] = useState(() => resolveIncludePaidLeave(worker));

  React.useEffect(() => {
    localStorage.setItem(`exFest_${worker.id}`, JSON.stringify(includeExFest));
    localStorage.setItem(`tickets_${worker.id}`, JSON.stringify(includeTickets));
    localStorage.setItem(`paidLeave_${worker.id}`, JSON.stringify(includePaidLeave));
    onUpdateWorkerFields({ includeExFest, includeTickets, includePaidLeave });
  }, [includeExFest, includeTickets, includePaidLeave]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const badgeStyles = useMemo(() => {
    if (!worker.profilo) return 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
    if (SYSTEM_PROFILES[worker.profilo]) return SYSTEM_PROFILES[worker.profilo].badge.detail;
    const customPalette = [
      'bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-700/50',
      'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700/50',
      'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700/50',
      'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-700/50',
      'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700/50',
      'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-700/50'
    ];
    return customPalette[getCustomColorIndex(worker.profilo)];
  }, [worker.profilo]);

  const [isGlobalDragging, setIsGlobalDragging] = useState<false | 'drag' | 'folder'>(false);
  const [showSupernova] = useState(false);

  // --- GLOBAL SHORTCUTS (ESC & CTRL+S) ---
  const shortcutStateRef = useRef({
    showSplit, isQRModalOpen, showReport, isAiTfrModalOpen, activeTickerModal, isExplainerOpen, onUpdateData, monthlyInputs
  });

  useEffect(() => {
    shortcutStateRef.current = {
      showSplit, isQRModalOpen, showReport, isAiTfrModalOpen, activeTickerModal, isExplainerOpen, onUpdateData, monthlyInputs
    };
  }, [showSplit, isQRModalOpen, showReport, isAiTfrModalOpen, activeTickerModal, isExplainerOpen, onUpdateData, monthlyInputs]);

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const state = shortcutStateRef.current;
      if (e.key === 'Escape') {
        if (state.showSplit) setShowSplit(false);
        if (state.isQRModalOpen) setIsQRModalOpen(false);
        if (state.showReport) setShowReport(false);
        if (state.isAiTfrModalOpen) setIsAiTfrModalOpen(false);
        if (state.activeTickerModal) setActiveTickerModal(null);
        if (state.isExplainerOpen) setIsExplainerOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        state.onUpdateData(state.monthlyInputs);
        setBatchNotification({ type: 'success', msg: 'Dati sincronizzati e salvati correttamente.' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setShowReport(true);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // --- ANTENNA RADAR AI TFR ---
  const hasPromptedTfrRef = useRef(false);

  useEffect(() => {
    const handleAiTfr = (e: any) => {
      const { amount, year } = e.detail;
      if (!hasPromptedTfrRef.current && (!worker?.tfr_pregresso || worker.tfr_pregresso === 0)) {
        hasPromptedTfrRef.current = true;
        setAiTfrAmount(amount.toString());
        setAiTfrYear(year.toString());
        setIsAiTfrModalOpen(true);
      }
    };
    window.addEventListener('ai-found-tfr-base', handleAiTfr);
    return () => window.removeEventListener('ai-found-tfr-base', handleAiTfr);
  }, [worker]);

  const handleSaveAiTfr = () => {
    if (!aiTfrAmount || !aiTfrYear) return;
    const amount = parseFloat(aiTfrAmount.replace(',', '.'));
    const year = parseInt(aiTfrYear);
    onUpdateWorkerFields({ tfr_pregresso: amount, tfr_pregresso_anno: year });
    setIsAiTfrModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-scan-label', { detail: 'TFR STORICO SALVATO ✅' }));
  };

  const handleIgnoreAiTfr = () => {
    setIsAiTfrModalOpen(false);
    setBatchNotification(null);
  };

  const handleDataChange = (newData: AnnoDati[]) => {
    setMonthlyInputs(newData);
  };

  const handleCellFocus = (rowIndex: number, colId: string) => {
    setActiveCell({ row: rowIndex, col: colId });
  };

  // --- GESTIONE INVIO PEC ---
  const handleSendPec = () => {
    const profile = PROFILE_CONFIG[worker.profilo] || PROFILE_CONFIG.RFI;
    const subject = `DIFFIDA E MESSA IN MORA - ${worker.cognome} ${worker.nome}`;
    const body = `Spett.le ${profile.label},\n\nIn nome e per conto del Sig. ${worker.nome} ${worker.cognome}, trasmetto in allegato i conteggi relativi alle differenze retributive maturate.\n\nDistinti Saluti,\nUfficio Vertenze`;
    window.location.href = `mailto:${profile.pec}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handlePrintTables = () => printPayslipTables({
    worker, monthlyInputs, includeExFest, includeTickets, startClaimYear, includePaidLeave,
  });

  // Carica una busta scelta dal tab Archivio dentro il visore laterale (SplitView)
  // invece di aprirla in una nuova scheda. Usata dal visore in sola lettura, che
  // non puo' caricare file localmente. Torna alla vista tabella per il confronto.
  const handleOpenArchivedInSplit = (url: string, name: string) => {
    setPayslipFiles([url]);
    setPayslipFileNames([name]);
    setCurrentFileIndex(0);
    setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    setShowSplit(true);
    setActiveTab('input');
  };

  // Apre nel visore un insieme di buste scelte dal picker (uno, alcune, o un anno
  // intero). Una sola chiamata createSignedUrls per tutte; ordina cronologicamente
  // cosi' la navigazione ‹ › è coerente.
  const handleOpenArchivedPicks = async (ids: string[]) => {
    const picks = ids
      .map(id => archivedPicks.find(p => p.id === id))
      .filter((p): p is ArchivedPick => !!p)
      .sort((a, b) => a.year - b.year || a.monthIdx - b.monthIdx);
    if (picks.length === 0) return;

    const urlMap = await getSignedUrls(picks.map(p => p.storage_path));
    const files: string[] = [];
    const names: string[] = [];
    picks.forEach(p => {
      const url = urlMap[p.storage_path];
      if (!url) return;
      files.push(url);
      names.push(`${p.month} ${p.year} - ${p.filename}`);
    });
    if (files.length === 0) return;

    setPayslipFiles(files);
    setPayslipFileNames(names);
    setCurrentFileIndex(0);
    setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    setShowSplit(true);
    setActiveTab('input');
  };

  // VISORE: svuota le buste caricate per tornare al picker dell'archivio e
  // sceglierne altre, senza chiudere il pannello laterale.
  const handleBackToArchivePicker = () => {
    setPayslipFiles([]);
    setPayslipFileNames([]);
    setCurrentFileIndex(0);
    setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
  };

  // VISORE: all'apertura del lavoratore apre il pannello laterale (una volta per
  // lavoratore) cosi' il sindacalista vede subito il picker delle buste archiviate
  // senza dover passare dal tab Archivio. Il guard evita di riaprirlo se lo chiude.
  const splitAutoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isReadOnly || archivedPicks.length === 0 || payslipFiles.length > 0) return;
    if (splitAutoOpenedRef.current === worker.id) return;
    splitAutoOpenedRef.current = worker.id;
    setShowSplit(true);
  }, [isReadOnly, archivedPicks, worker.id]);

  // --- HELPER ORDINAMENTO CRONOLOGICO BUSTE PAGA ---
  const getFilenameDateScore = (filename: string) => {
    const name = filename.toLowerCase();
    let month = 0;
    let year = 0;
    const yearMatch = name.match(/(20\d{2})/);
    if (yearMatch) year = parseInt(yearMatch[1]);
    const monthNames = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    monthNames.forEach((m, index) => { if (name.includes(m)) month = index + 1; });
    if (month === 0) {
      const numMatch = name.match(/[^0-9](0[1-9]|1[0-2])[^0-9]/) || name.match(/^(0[1-9]|1[0-2])[^0-9]/);
      if (numMatch) month = parseInt(numMatch[1] || numMatch[0].replace(/[^0-9]/g, ''));
    }
    return (year * 100) + month;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      filesArray.sort((a, b) => {
        const scoreA = getFilenameDateScore(a.name);
        const scoreB = getFilenameDateScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
      });
      const newFiles = filesArray.map(file => URL.createObjectURL(file));
      const newNames = filesArray.map(file => file.name);
      setPayslipFiles(prev => [...prev, ...newFiles]);
      setPayslipFileNames(prev => [...prev, ...newNames]);
      setCurrentFileIndex(prev => prev === 0 && payslipFiles.length === 0 ? 0 : prev);
      setShowSplit(true);
      setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    }
  };

  const nextFile = () => {
    if (currentFileIndex < payslipFiles.length - 1) {
      setCurrentFileIndex(prev => prev + 1);
      setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    }
  };

  const prevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(prev => prev - 1);
      setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      filesArray.sort((a, b) => {
        const scoreA = getFilenameDateScore(a.name);
        const scoreB = getFilenameDateScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
      });
      const newFiles = filesArray.map(file => URL.createObjectURL(file));
      const newNames = filesArray.map(file => file.name);
      setPayslipFiles(prev => [...prev, ...newFiles]);
      setPayslipFileNames(prev => [...prev, ...newNames]);
      if (payslipFiles.length === 0) {
        setCurrentFileIndex(0);
        setImgScale(1);
        setImgPos({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSniperMode) {
      onSniperMouseDown(e, imgScale, imgPos);
    } else {
      if (payslipFiles.length > 0) setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSniperMode && isSelecting) {
      onSniperMouseMove(e, imgScale, imgPos);
    } else if (isDragging) {
      setImgPos(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = () => {
    if (isSniperMode && isSelecting) onSniperMouseUp();
    setIsDragging(false);
  };

  const handleToggleFilter = () => setImgFilter(prev => prev === 'none' ? 'contrast' : 'none');
  const handleRotate = () => setImgRotation(prev => prev + 90);
  const handleResetView = () => { setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); };

  const handleDeleteCurrentFile = () => {
    const newFiles = payslipFiles.filter((_, i) => i !== currentFileIndex);
    setPayslipFiles(newFiles);
    setPayslipFileNames(prev => prev.filter((_, i) => i !== currentFileIndex));
    if (newFiles.length > 0 && currentFileIndex >= newFiles.length) {
      setCurrentFileIndex(newFiles.length - 1);
    } else if (newFiles.length === 0) {
      setCurrentFileIndex(0);
      setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
    }
  };

  const handleExplainPayslip = async () => {
    if (payslipFiles.length === 0) return;
    setIsExplainerOpen(true);
    setIsExplaining(true);
    setExplanationData(null);

    try {
      const response = await fetch(payslipFiles[currentFileIndex]);
      const blob = await response.blob();
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
      });
      const mimeType = blob.type || 'application/pdf';

      const netlifyRes = await fetch('/.netlify/functions/scan-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64String, mimeType, action: 'explain' })
      });

      const aiData = await netlifyRes.json();
      if (!netlifyRes.ok) {
        setExplanationData(`⚠️ Errore: ${aiData.error ?? netlifyRes.status}`);
      } else {
        setExplanationData(aiData.explanation ?? "Il modello non ha restituito una risposta valida.");
      }
    } catch (error) {
      setExplanationData("❌ Impossibile stabilire una connessione con il Motore Neurale.");
    } finally {
      setIsExplaining(false);
    }
  };

  const { statsData, tickerItems } = useStatsData({
    monthlyInputs, worker, startClaimYear, includeExFest, includeTickets, includePaidLeave,
  });

  // Le card TFR seguono il Prospetto TFR: fuori dal piano di consultazione del
  // viewer (modulo a pagamento futuro), quindi via anche dalla barra ticker.
  const visibleTickerItems = useMemo(
    () => isReadOnly
      ? tickerItems.filter(t => t.label !== 'TFR SU DIFFERENZE' && t.label !== 'FONDO TFR STORICO')
      : tickerItems,
    [tickerItems, isReadOnly]
  );

  const { handleContainerScroll } = useIslandSync({
    onBack,
    showReport,
    setShowReport,
    onPrintTables: handlePrintTables,
    rawTotal: statsData.rawTotal,
  });

  // --- RENDER CONDIZIONALE DEL REPORT ---
  if (showReport) {
    return (
      <TableComponent
        worker={worker}
        monthlyInputs={monthlyInputs}
        onBack={() => {
          setShowReport(false);
          onBack();
        }}
        onEdit={() => setShowReport(false)}
        startClaimYear={startClaimYear}
        onUpdateWorkerFields={onUpdateWorkerFields}
      />
    );
  }

  return (
    <WorkerDetailProvider value={{
      worker,
      badgeStyles,
      onBack,
      onShowReport: () => setShowReport(true),
      onSendPec: handleSendPec,
      onPrintTables: handlePrintTables,
      onOpenIstat: () => setIsIstatModalOpen(true),
      startClaimYear,
      onStartClaimYearChange: setStartClaimYear,
      onUpdateWorkerFields,
      isGlobalDragging,
      onSetIsGlobalDragging: setIsGlobalDragging,
      onBatchUpload: handleBatchUpload,
      onBatchDrop: handleBatchDrop,
      isTimelineOpen,
      onToggleTimeline: () => setIsTimelineOpen(!isTimelineOpen),
      legalStatus,
      onLegalStatusChange: (s: string) => setLegalStatus(s as LegalStatus),
      onUpdateStatus,
      tickerItems: visibleTickerItems,
      activeTickerModal,
      onSetActiveTickerModal: setActiveTickerModal,
      includeExFest,
      onToggleExFest: () => setIncludeExFest(!includeExFest),
      includeTickets,
      onToggleTickets: () => setIncludeTickets(!includeTickets),
      includePaidLeave,
      onTogglePaidLeave: () => setIncludePaidLeave(v => !v),
      isBatchProcessing,
      isAnalyzing,
      scanRef,
      onFileUpload: handleFileUpload,
      showSplit,
      onSetShowSplit: setShowSplit,
      isQRModalOpen,
      onOpenQR: () => setIsQRModalOpen(true),
      onCloseQR: () => setIsQRModalOpen(false),
      onQRData: handleQRData,
      activeTab,
      onSetActiveTab: setActiveTab,
      archiveCount,
      isExplainerOpen,
      onCloseExplainer: () => setIsExplainerOpen(false),
      isExplaining,
      explanationData,
      onContainerScroll: handleContainerScroll,
      payslipFiles,
      archivedPicks,
      onOpenArchivedPicks: handleOpenArchivedPicks,
      onBackToArchivePicker: handleBackToArchivePicker,
      currentFileIndex,
      currentFileMonthLabel,
      isSniperMode,
      onToggleSniper: () => setIsSniperMode(!isSniperMode),
      isProcessing,
      selectionBox,
      imgRef,
      containerRef,
      fileInputRef,
      imgScale,
      imgPos,
      imgRotation,
      imgFilter,
      isDragging,
      onPrevFile: prevFile,
      onNextFile: nextFile,
      onDeleteCurrentFile: handleDeleteCurrentFile,
      onImageUpload: handleImageUpload,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onToggleFilter: handleToggleFilter,
      onRotate: handleRotate,
      onZoom: handleZoom,
      onResetView: handleResetView,
      onExplainPayslip: handleExplainPayslip,
      batchProgress,
      batchTotal,
      showSupernova,
      batchNotification,
      onCloseBatchNotification: () => setBatchNotification(null),
      isIstatModalOpen,
      onCloseIstat: () => setIsIstatModalOpen(false),
      monthlyInputs,
      isAiTfrModalOpen,
      onCloseAiTfr: () => setIsAiTfrModalOpen(false),
      aiTfrAmount,
      onSetAiTfrAmount: setAiTfrAmount,
      aiTfrYear,
      onSetAiTfrYear: setAiTfrYear,
      onSaveAiTfr: handleSaveAiTfr,
      onIgnoreAiTfr: handleIgnoreAiTfr,
    }}>
    <WorkerDetailLayout>
      {activeTab === 'input' && (
        <div className="h-full flex flex-col overflow-auto custom-scrollbar">
          <MonthlyDataGrid
            data={monthlyInputs}
            onDataChange={handleDataChange}
            initialYear={currentYear}
            onYearChange={setCurrentYear}
            activeMonthIndex={activeMonthIndex}
            activeYear={activeYear}
            profilo={worker.profilo}
            eliorType={worker.eliorType}
            onCellFocus={handleCellFocus}
            years={dynamicYears}
            includePaidLeave={includePaidLeave}
            archiveEntries={archiveEntries}
            verifyStates={verifyStates}
            onVerifyRequest={handleVerifyRequest}
            onAcceptCorrection={handleAcceptCorrection}
            onAcceptAllCorrections={handleAcceptAllCorrections}
            onOpenArchive={() => setActiveTab('archive')}
            compact={showSplit}
            onToggleViewer={() => setShowSplit(!showSplit)}
          />
        </div>
      )}
      {activeTab === 'calc' && (
        <div className="h-full overflow-auto custom-scrollbar pr-2">
          <AnnualCalculationTable
            data={monthlyInputs}
            profilo={worker.profilo}
            eliorType={worker.eliorType}
            onDataChange={handleDataChange}
            includeTickets={includeTickets}
            startClaimYear={startClaimYear}
            years={dynamicYears}
            includePaidLeave={includePaidLeave}
            onGoToInput={() => setActiveTab('input')}
          />
        </div>
      )}
      {activeTab === 'pivot' && (
        <div className="h-full overflow-auto custom-scrollbar pr-2">
          <IndemnityPivotTable
            data={monthlyInputs}
            profilo={worker.profilo}
            eliorType={worker.eliorType}
            startClaimYear={startClaimYear}
            years={dynamicYears}
            onGoToInput={() => setActiveTab('input')}
          />
        </div>
      )}
      {activeTab === 'tfr' && !isReadOnly && (
        <div className="h-full overflow-hidden">
          <TfrCalculationTable
            data={monthlyInputs}
            worker={worker}
            startClaimYear={startClaimYear}
            onDataChange={handleDataChange}
            onUpdateWorkerFields={onUpdateWorkerFields}
            onGoToInput={() => setActiveTab('input')}
          />
        </div>
      )}
      {activeTab === 'archive' && (
        <div className="h-full flex flex-col overflow-hidden">
          {hasFixedProfile && !isReadOnly && (
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-amber-50/60 dark:bg-amber-900/10">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Voci fisse · anno</span>
              <select
                value={backfillYear}
                onChange={e => setBackfillYear(Number(e.target.value))}
                disabled={backfillProgress.running}
                className="px-2 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                {(archiveYears.length ? archiveYears : [backfillYear]).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleBackfillFixed}
                disabled={backfillProgress.running || archivedPicks.length === 0}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  backfillProgress.running || archivedPicks.length === 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-amber-500 text-white border-amber-400 hover:bg-amber-600 shadow-sm active:scale-95'
                }`}
                title="Rilegge le buste archiviate dell'anno selezionato ed estrae SOLO le voci fisse (3B..). Non modifica gli altri dati."
              >
                {backfillProgress.running
                  ? `Estrazione… ${backfillProgress.done}/${backfillProgress.total}`
                  : `Estrai voci fisse — ${backfillYear}`}
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button
                onClick={() => fixedUploadRef.current?.click()}
                disabled={backfillProgress.running}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  backfillProgress.running
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-95'
                }`}
                title="Per le buste NON in archivio: carica i file dal disco ed estrai SOLO le voci fisse (3B..). Non tocca variabili/giorni/TFR; archivia anche le buste."
              >
                Carica buste → solo voci fisse
              </button>
              <input
                ref={fixedUploadRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={handleUploadFixedVoci}
              />
              {!backfillProgress.running && backfillProgress.total > 0 && (
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Fatto: {backfillProgress.updated} aggiornate
                  {backfillProgress.errors > 0 ? `, ${backfillProgress.errors} non lette` : ''}.
                </span>
              )}
              {backfillProgress.running && (
                <>
                  <button
                    onClick={stopFixedBackfill}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 text-white border border-rose-400 hover:bg-rose-600 active:scale-95 transition-all"
                    title="Ferma l'estrazione (i mesi già fatti restano salvati)"
                  >
                    Ferma
                  </button>
                  <span className="text-xs text-amber-700 dark:text-amber-300">Non chiudere la pagina…</span>
                </>
              )}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <PayslipArchiveTab
              workerId={String(worker.id)}
              workerProfilo={worker.profilo}
              workerEliorType={worker.eliorType}
              workerName={`${worker.cognome} ${worker.nome}`}
              onCountChange={setArchiveCount}
              onOpenInViewer={handleOpenArchivedInSplit}
              onBackToGrid={() => setActiveTab('input')}
            />
          </div>
        </div>
      )}
    </WorkerDetailLayout>

    {/* Modale in-app per il backfill voci fisse (sostituisce window.confirm/alert) */}
    {backfillModal && (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        onClick={() => setBackfillModal(null)}
      >
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {backfillModal.kind === 'confirm' ? (
            <>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
                Estrai voci fisse &mdash; anno {backfillModal.year}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                Verranno lette <b>{backfillModal.picks.length} buste</b> dall'archivio (circa {backfillModal.picks.length} letture AI, una alla volta).
                Puoi fermarti quando vuoi: i mesi già fatti restano salvati.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setBackfillModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmBackfillFixed}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white border border-amber-400 hover:bg-amber-600 shadow-sm active:scale-95 transition-all"
                >
                  Estrai
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Voci fisse</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">{backfillModal.text}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setBackfillModal(null)}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all"
                >
                  Ok
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </WorkerDetailProvider>
  );
};

export default WorkerDetailPage;
