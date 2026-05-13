import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePayslipUpload } from '../hooks/usePayslipUpload';
import { usePayslipArchive } from '../hooks/usePayslipArchive';
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
import { printPayslipTables } from '../utils/printTables';
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES } from '../types';

// --- CONFIGURAZIONE PROFILI PEC ---
const PROFILE_CONFIG: any = {
  RFI: { label: 'RFI', pec: 'ru.rfi@pec.rfi.it' },
  ELIOR: { label: 'ELIOR', pec: 'elior@legalmail.it' },
  REKEEP: { label: 'REKEEP', pec: 'rekeep@pec.rekeep.it' }
};

interface WorkerDetailPageProps {
  worker: Worker;
  onUpdateData: (data: AnnoDati[]) => void;
  onUpdateStatus: (status: string) => void;
  onUpdateWorkerFields: (fields: Partial<Worker>) => void;
  onBack: () => void;
  onOpenReport?: () => void;
}

const WorkerDetailPage: React.FC<WorkerDetailPageProps> = ({ worker, onUpdateData, onUpdateStatus, onUpdateWorkerFields, onBack, onOpenReport }) => {
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

  const [activeTab, setActiveTab] = useState<'input' | 'calc' | 'pivot' | 'tfr' | 'archive'>('input');
  const [archiveCount, setArchiveCount] = useState(0);

  // Build archive entries map whenever archiveCount changes (new upload or delete)
  useEffect(() => {
    getPayslipsByWorker(worker.id).then(records => {
      const map: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      records.forEach(r => {
        const monthIdx = MONTH_NAMES.indexOf(r.month.toUpperCase());
        if (monthIdx !== -1) {
          map[`${r.year}-${monthIdx}`] = r.storage_path;
          idMap[`${r.year}-${monthIdx}`] = r.id;
        }
      });
      setArchiveEntries(map);
      setArchiveIdMap(idMap);
    });
  }, [worker.id, archiveCount]);

  const handleVerifyRequest = async (row: AnnoDati) => {
    const vKey = `${row.year}-${row.monthIndex}`;
    const storagePath = archiveEntries[vKey];
    if (!storagePath) return;

    setVerifyStates(prev => ({ ...prev, [vKey]: { status: 'loading', discrepancies: [] } }));

    // Build customColumns only for non-standard profiles (Company Builder)
    const standardProfiles = new Set(['RFI', 'ELIOR', 'REKEEP']);
    const standardFields = new Set(['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'arretrati', 'note']);
    const isCustomProfile = !standardProfiles.has((worker.profilo || '').toUpperCase());
    const customColumns = isCustomProfile
      ? getColumnsByProfile(worker.profilo, worker.eliorType)
          .filter(c => !standardFields.has(c.id) && c.type !== 'formula')
          .map(c => ({ id: c.id, label: c.label }))
      : undefined;

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

  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (worker?.anni && worker.anni.length > 0) {
      const activeInputs = worker.anni.filter((d: AnnoDati) =>
        (d.imponibile_tfr_mensile && d.imponibile_tfr_mensile > 0) ||
        (d.daysWorked && Number(d.daysWorked) > 0) ||
        (d.daysVacation && Number(d.daysVacation) > 0)
      );
      const anniCompilati = activeInputs.map((d: AnnoDati) => Number(d.year)).filter((y: number) => !isNaN(y));
      if (anniCompilati.length > 0) return Math.max(...anniCompilati);
    }
    const savedStartYear = localStorage.getItem(`startYear_${worker.id}`);
    const initialYear = savedStartYear ? parseInt(savedStartYear) : 2008;
    return initialYear - 1;
  });

  const { addPayslip, getPayslipsByWorker, getSignedUrl, addVerifyLog } = usePayslipArchive();

  // --- VERIFICA AI ---
  const [archiveEntries, setArchiveEntries] = useState<Record<string, string>>({});
  const [archiveIdMap, setArchiveIdMap] = useState<Record<string, string>>({});
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({});

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
    batchInputRef,
    handleBatchUpload,
    handleFileUpload,
    handleQRData,
    getCustomColumnsForAI,
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
  }, [startClaimYear, worker.id]);

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

  const [showSplit, setShowSplit] = useState(false);
  const [payslipFiles, setPayslipFiles] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [imgScale, setImgScale] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgFilter, setImgFilter] = useState<'none' | 'contrast'>('none');

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
  const [legalStatus, setLegalStatus] = useState<'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa'>(worker.status || 'analisi');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const [includeExFest, setIncludeExFest] = useState(() => {
    const saved = localStorage.getItem(`exFest_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [includeTickets, setIncludeTickets] = useState(() => {
    const saved = localStorage.getItem(`tickets_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  React.useEffect(() => {
    localStorage.setItem(`exFest_${worker.id}`, JSON.stringify(includeExFest));
    localStorage.setItem(`tickets_${worker.id}`, JSON.stringify(includeTickets));
  }, [includeExFest, includeTickets, worker.id]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const badgeStyles = useMemo(() => {
    if (!worker.profilo) return 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
    if (worker.profilo === 'ELIOR') return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/50';
    if (worker.profilo === 'REKEEP') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50';
    if (worker.profilo === 'RFI') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 border-blue-200 dark:border-blue-700/50';
    const customPalette = [
      'bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-700/50',
      'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700/50',
      'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700/50',
      'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-700/50',
      'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700/50',
      'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-700/50'
    ];
    let hash = 0;
    for (let i = 0; i < worker.profilo.length; i++) {
      hash = worker.profilo.charCodeAt(i) + ((hash << 5) - hash);
    }
    return customPalette[Math.abs(hash) % customPalette.length];
  }, [worker.profilo]);

  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showSupernova, setShowSupernova] = useState(false);

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
    worker, monthlyInputs, includeExFest, includeTickets, startClaimYear,
  });

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
      setPayslipFiles(prev => [...prev, ...newFiles]);
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
      setPayslipFiles(prev => [...prev, ...newFiles]);
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
    monthlyInputs, worker, startClaimYear, includeExFest, includeTickets,
  });

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
      />
    );
  }

  return (
    <WorkerDetailLayout
      worker={worker}
      badgeStyles={badgeStyles}
      onBack={onBack}
      onShowReport={() => setShowReport(true)}
      onSendPec={handleSendPec}
      onPrintTables={handlePrintTables}
      onOpenIstat={() => setIsIstatModalOpen(true)}
      startClaimYear={startClaimYear}
      onStartClaimYearChange={setStartClaimYear}
      isGlobalDragging={isGlobalDragging}
      onSetIsGlobalDragging={setIsGlobalDragging}
      onBatchUpload={handleBatchUpload}
      isTimelineOpen={isTimelineOpen}
      onToggleTimeline={() => setIsTimelineOpen(!isTimelineOpen)}
      legalStatus={legalStatus}
      onLegalStatusChange={setLegalStatus}
      onUpdateStatus={onUpdateStatus}
      tickerItems={tickerItems}
      activeTickerModal={activeTickerModal}
      onSetActiveTickerModal={setActiveTickerModal}
      includeExFest={includeExFest}
      onToggleExFest={() => setIncludeExFest(!includeExFest)}
      includeTickets={includeTickets}
      onToggleTickets={() => setIncludeTickets(!includeTickets)}
      isBatchProcessing={isBatchProcessing}
      isAnalyzing={isAnalyzing}
      scanRef={scanRef}
      onFileUpload={handleFileUpload}
      showSplit={showSplit}
      onSetShowSplit={setShowSplit}
      isQRModalOpen={isQRModalOpen}
      onOpenQR={() => setIsQRModalOpen(true)}
      onCloseQR={() => setIsQRModalOpen(false)}
      onQRData={handleQRData}
      activeTab={activeTab}
      onSetActiveTab={setActiveTab}
      archiveCount={archiveCount}
      isExplainerOpen={isExplainerOpen}
      onCloseExplainer={() => setIsExplainerOpen(false)}
      isExplaining={isExplaining}
      explanationData={explanationData}
      onContainerScroll={handleContainerScroll}
      payslipFiles={payslipFiles}
      currentFileIndex={currentFileIndex}
      isSniperMode={isSniperMode}
      onToggleSniper={() => setIsSniperMode(!isSniperMode)}
      isProcessing={isProcessing}
      selectionBox={selectionBox}
      imgRef={imgRef}
      containerRef={containerRef}
      fileInputRef={fileInputRef}
      batchInputRef={batchInputRef}
      imgScale={imgScale}
      imgPos={imgPos}
      imgRotation={imgRotation}
      imgFilter={imgFilter}
      isDragging={isDragging}
      onPrevFile={prevFile}
      onNextFile={nextFile}
      onDeleteCurrentFile={handleDeleteCurrentFile}
      onImageUpload={handleImageUpload}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onToggleFilter={handleToggleFilter}
      onRotate={handleRotate}
      onZoom={handleZoom}
      onResetView={handleResetView}
      onExplainPayslip={handleExplainPayslip}
      batchProgress={batchProgress}
      batchTotal={batchTotal}
      showSupernova={showSupernova}
      batchNotification={batchNotification}
      onCloseBatchNotification={() => setBatchNotification(null)}
      isIstatModalOpen={isIstatModalOpen}
      onCloseIstat={() => setIsIstatModalOpen(false)}
      monthlyInputs={monthlyInputs}
      isAiTfrModalOpen={isAiTfrModalOpen}
      onCloseAiTfr={() => setIsAiTfrModalOpen(false)}
      aiTfrAmount={aiTfrAmount}
      onSetAiTfrAmount={setAiTfrAmount}
      aiTfrYear={aiTfrYear}
      onSetAiTfrYear={setAiTfrYear}
      onSaveAiTfr={handleSaveAiTfr}
      onIgnoreAiTfr={handleIgnoreAiTfr}
    >
      {activeTab === 'input' && (
        <div className="h-full flex flex-col overflow-auto custom-scrollbar">
          <MonthlyDataGrid
            data={monthlyInputs}
            onDataChange={handleDataChange}
            initialYear={currentYear}
            onYearChange={setCurrentYear}
            profilo={worker.profilo}
            eliorType={worker.eliorType}
            onCellFocus={handleCellFocus}
            years={dynamicYears}
            archiveEntries={archiveEntries}
            verifyStates={verifyStates}
            onVerifyRequest={handleVerifyRequest}
            onAcceptCorrection={handleAcceptCorrection}
            onAcceptAllCorrections={handleAcceptAllCorrections}
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
          />
        </div>
      )}
      {activeTab === 'tfr' && (
        <div className="h-full overflow-hidden">
          <TfrCalculationTable
            data={monthlyInputs}
            worker={worker}
            startClaimYear={startClaimYear}
            onDataChange={handleDataChange}
          />
        </div>
      )}
      {activeTab === 'archive' && (
        <PayslipArchiveTab
          workerId={String(worker.id)}
          workerProfilo={worker.profilo}
          workerEliorType={worker.eliorType}
          onCountChange={setArchiveCount}
        />
      )}
    </WorkerDetailLayout>
  );
};

export default WorkerDetailPage;
