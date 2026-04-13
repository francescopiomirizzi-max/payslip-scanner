import React, { useState, useMemo, useRef, useEffect } from 'react';
import MonthlyDataGrid from './WorkerTables/MonthlyDataGrid';
import AnnualCalculationTable from './WorkerTables/AnnualCalculationTable';
import IndemnityPivotTable from './WorkerTables/IndemnityPivotTable';
import TfrCalculationTable from './WorkerTables/TfrCalculationTable';
// (Aggiusta il percorso se hai salvato il file in una cartella diversa)
import TableComponent from './TableComponent'; // Assicurati che il percorso sia corretto
import { useIsland } from '../IslandContext';
import { LineChart } from 'lucide-react';
import IstatDashboardModal from './WorkerTables/IstatDashboardModal';
import { calculateTFR } from '../utils/tfrCalculator'; // <--- AGGIUNGI QUESTO IMPORT
import { calculateLegalInterestsAndRevaluation } from '../istatService'; // <--- AGGIUNGI QUESTA!
// Import necessario per i calcoli della stampa
import QRScannerModal from '../components/QRScannerModal';
import DynamicIsland from '../components/DynamicIsland'; // <--- AGGIUNGI QUESTA RIGA
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES, YEARS } from '../types';
import { parseLocalFloat, parseFloatSafe, formatCurrency } from '../utils/formatters';
import {
  ArrowLeft,
  FileSpreadsheet,
  LayoutGrid,
  Calculator,
  TrendingUp,
  User,
  BadgeCheck,
  CheckCircle,
  CalendarPlus,
  Wallet,
  Ticket,
  CalendarClock,
  Banknote,
  Briefcase,
  Eye,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  ScanEye,
  Loader2,
  Crosshair,
  Printer,
  ScanLine,
  // --- NUOVE ICONE (Tutte incluse ora) ---
  Send,
  Gavel,
  Handshake,
  Scale,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileBarChart,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileStack,
  Smartphone,
  Sparkles,
  XCircle,
  AlertTriangle,
  QrCode,
  Check,
  RotateCw, // <--- AGGIUNTA
  Wand2,
  Download,
  Bot,    // <--- AGGIUNTO QUI
  Cpu,
  FileText,
  Save,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// IMPORTANTE: Tesseract per il ritaglio (Canvas)
import Tesseract from 'tesseract.js';

// LIBRERIE PDF NATIVE
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- STILI CSS SPOSTATI IN index.css ---
import { FRAMER_PHYSICS } from '../framerConfig';

// --- CONFIGURAZIONE PROFILI PEC ---
const PROFILE_CONFIG: any = {
  RFI: { label: 'RFI', pec: 'ru.rfi@pec.rfi.it' },
  ELIOR: { label: 'ELIOR', pec: 'elior@legalmail.it' },
  REKEEP: { label: 'REKEEP', pec: 'rekeep@pec.rekeep.it' }
};

interface WorkerDetailPageProps {
  worker: Worker;
  onUpdateData: (data: AnnoDati[]) => void;
  onUpdateStatus: (status: string) => void; // <--- AGGIUNGI QUESTA RIGA
  onBack: () => void;
  onOpenReport?: () => void;
}

// --- CONFIGURAZIONE STILI PDF ---
const STYLES = {
  headerColor: [23, 37, 84],
  headerText: [255, 255, 255],
  rowText: [30, 41, 59],
  gridColor: [200, 200, 200],
  alternateRow: [248, 250, 252],
  accentGreen: [22, 163, 74],
  accentRed: [220, 38, 38]
};

const MovingGrid = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-500">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] transition-colors duration-500"></div>
    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob transition-colors duration-500"></div>
    <div className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000 transition-colors duration-500"></div>
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000 transition-colors duration-500"></div>
  </div>
);

const WorkerDetailPage: React.FC<WorkerDetailPageProps> = ({ worker, onUpdateData, onUpdateStatus, onBack, onOpenReport }) => {
  const [monthlyInputs, setMonthlyInputs] = useState<AnnoDati[]>(Array.isArray(worker?.anni) ? worker.anni : []);



  // DYNAMIC SYNC: Lo stato locale comanda, il Parent riceve aggiornamenti in automatico
  const lastSyncRef = useRef<string>(JSON.stringify(monthlyInputs));
  useEffect(() => {
    const currentStr = JSON.stringify(monthlyInputs);
    if (currentStr !== lastSyncRef.current) {
      lastSyncRef.current = currentStr;
      onUpdateData(monthlyInputs);
    }
  }, [monthlyInputs, onUpdateData]);

  // ✨ INIEZIONE CERVELLO NELLA PAGINA LAVORATORE
  const { showNotification, setQuickActions, startUpload, updateUploadProgress, finishUpload } = useIsland();

  const [activeTab, setActiveTab] = useState<'input' | 'calc' | 'pivot' | 'tfr'>('input');
  // Stato per mostrare/nascondere il report ufficiale
  const [showReport, setShowReport] = useState(false);
  // ✨ Stati per il Radar TFR Globale dell'Intelligenza Artificiale
  const [isAiTfrModalOpen, setIsAiTfrModalOpen] = useState(false);
  const [isIstatModalOpen, setIsIstatModalOpen] = useState(false);
  const [aiTfrAmount, setAiTfrAmount] = useState<string>('');
  const [aiTfrYear, setAiTfrYear] = useState<string>('');
  // --- STATO CONFIGURAZIONE CAUSA E ANNO INIZIALE ---
  // Legge o imposta l'anno di inizio calcoli (Default 2008)
  const [startClaimYear, setStartClaimYear] = useState<number>(() => {
    const saved = localStorage.getItem(`startYear_${worker.id}`);
    return saved ? parseInt(saved) : 2008;
  });
  // --- RANGE ANNI DINAMICO CENTRALIZZATO (Single Source of Truth) ---
  const dynamicYears = useMemo(() => {
    const DEFAULT_START = 2007;
    const END_YEAR = 2025;
    // Se l'utente ha impostato un anno specifico, il range parte da (startClaimYear - 1)
    // per includere l'anno di riferimento per la media. Altrimenti mostra il default [2007..2025]
    const effectiveStart = startClaimYear > DEFAULT_START + 1
      ? startClaimYear - 1
      : DEFAULT_START;
    return Array.from(
      { length: END_YEAR - effectiveStart + 1 },
      (_, i) => effectiveStart + i
    );
  }, [startClaimYear]);
  // Stato per il Modale Informativo del Ticker
  const [activeTickerModal, setActiveTickerModal] = useState<{ title: string, content: React.ReactNode } | null>(null);
  // ✨ LOGICA ANNO CORRENTE INTELLIGENTE (Fixata per evitare anni fantasma)
  const [currentYear, setCurrentYear] = useState<number>(() => {
    // 1. Se ci sono dati, troviamo l'ultimo anno EFFETTIVAMENTE compilato
    if (worker?.anni && worker.anni.length > 0) {
      // Filtriamo gli anni considerandoli validi solo se c'è un imponibile o dei giorni lavorati
      const activeInputs = worker.anni.filter((d: AnnoDati) =>
        (d.imponibile_tfr_mensile && d.imponibile_tfr_mensile > 0) ||
        (d.daysWorked && Number(d.daysWorked) > 0) ||
        (d.daysVacation && Number(d.daysVacation) > 0)
      );

      const anniCompilati = activeInputs.map((d: AnnoDati) => Number(d.year)).filter((y: number) => !isNaN(y));

      // Se trova almeno un anno compilato, prende il più recente
      if (anniCompilati.length > 0) {
        return Math.max(...anniCompilati);
      }
    }

    // 2. Se non ci sono dati validi, ti posiziona automaticamente sull'anno di inizio vertenza
    // Leggiamo il valore salvato o partiamo dal default
    const savedStartYear = localStorage.getItem(`startYear_${worker.id}`);
    const initialYear = savedStartYear ? parseInt(savedStartYear) : 2008;

    // Partiamo dall'anno prima per preparare il calcolo della media
    return initialYear - 1;
  });



  // --- INIZIO NUOVO BLOCCO ISOLA (Radar Definitivo Fixato) ---
  const isQuickActionsActiveRef = useRef(false);

  useEffect(() => {
    // ✨ BISTURI: Diciamo all'Isola che siamo nella pagina "detail" (Tabelle)
    window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'detail' }));

    const handleGlobalScroll = () => {
      requestAnimationFrame(() => {
        let scrollTop = 0;
        if (typeof window !== 'undefined') {
          scrollTop = window.scrollY || document.documentElement.scrollTop;
        }

        if (scrollTop > 300 && !isQuickActionsActiveRef.current) {
          isQuickActionsActiveRef.current = true;
          setQuickActions(true);
        } else if (scrollTop <= 200 && isQuickActionsActiveRef.current) {
          isQuickActionsActiveRef.current = false;
          setQuickActions(false);
        }
      });
    };

    window.addEventListener('scroll', handleGlobalScroll, true);

    return () => {
      window.removeEventListener('scroll', handleGlobalScroll, true);
      setQuickActions(false);
      isQuickActionsActiveRef.current = false;
    };
  }, [setQuickActions]);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      if (scrollTop > 300 && !isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = true;
        setQuickActions(true);
      } else if (scrollTop <= 200 && isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = false;
        setQuickActions(false);
      }
    });
  };

  // 2. Eventi Custom della Dynamic Island
  useEffect(() => {
    const onDashboard = () => onBack();
    // @ts-ignore
    const onDownload = () => typeof handlePrintTables === 'function' && handlePrintTables();
    const onReport = () => setShowReport(true);

    window.addEventListener('trigger-dashboard', onDashboard);
    window.addEventListener('trigger-download', onDownload);
    window.addEventListener('trigger-report', onReport);

    return () => {
      window.removeEventListener('trigger-dashboard', onDashboard);
      window.removeEventListener('trigger-download', onDownload);
      window.removeEventListener('trigger-report', onReport);
    };
  }, [onBack]);
  // --- FINE NUOVO BLOCCO ISOLA ---
  // 👇 INCOLLA QUI IL NUOVO BOCCO 👇
  // --- FIX ISOLA: Ri-afferma il contesto quando si chiude il Report ---
  useEffect(() => {
    if (!showReport) {
      window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'detail' }));

      // Sicurezza: forziamo la chiusura delle azioni rapide se siamo in cima alla pagina
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop <= 200) {
        setQuickActions(false);
      }
    }
  }, [showReport, setQuickActions]);
  // 👆 FINE INCOLLA 👆

  // Salva preferenza
  useEffect(() => {
    localStorage.setItem(`startYear_${worker.id}`, startClaimYear.toString());
  }, [startClaimYear, worker.id]);
  // Stato per la tendina personalizzata dell'anno
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  // --- EFFETTO: AVVISO MEDIA MANCANTE (Al cambio anno) ---
  useEffect(() => {
    // Controlla se abbiamo dati dell'anno precedente
    const prevYear = startClaimYear - 1;
    // ✨ Se la tabella è vuota e cambi l'anno di inizio, sposta automaticamente la vista sull'anno da compilare
    if (monthlyInputs.length === 0) setCurrentYear(prevYear);
    const hasPrevData = monthlyInputs.some(r => Number(r.year) === prevYear);

    // Se mancano i dati, mostra notifica GIALLA per 5 secondi
    if (!hasPrevData) {
      setBatchNotification({
        msg: `⚠️ Attenzione: Hai impostato il ${startClaimYear}.\nRicorda di caricare le buste del ${prevYear} per calcolare la media corretta!`,
        type: 'warning'
      });

      // Nascondi dopo 6 secondi
      const timer = setTimeout(() => setBatchNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [startClaimYear, monthlyInputs]); // Aggiunto monthlyInputs alle dipendenze per sicurezza
  // --- STATO SPLIT SCREEN / VISORE ---
  const [showSplit, setShowSplit] = useState(false);

  // --- STATO MULTI-FILE ---
  const [payslipFiles, setPayslipFiles] = useState<string[]>([]); // Array di URL
  const [currentFileIndex, setCurrentFileIndex] = useState(0); // Indice file corrente
  const [imgScale, setImgScale] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // --- NUOVI STATI PER STRUMENTI VISORE ---
  const [imgRotation, setImgRotation] = useState(0);
  const [imgFilter, setImgFilter] = useState<'none' | 'contrast'>('none');
  // --- FUNZIONE ZOOM MANCANTE ---
  const handleZoom = (delta: number) => {
    setImgScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };
  // --- STATO SNIPER OCR ---
  const [isSniperMode, setIsSniperMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);
  // --- STATI AUDITOR AI ---
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationData, setExplanationData] = useState<string | null>(null);
  // --- NUOVI STATI PER LEGAL COCKPIT ---
  const [legalStatus, setLegalStatus] = useState<'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa'>(worker.status || 'analisi'); //
  const [offerAmount, setOfferAmount] = useState<string>('');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false); // <--- STATO PER LA TENDINA
  // --- NUOVO STATO: Toggle Ex Festività (Default False = 28gg) ---
  // --- SALVATAGGIO IN MEMORIA DELLE IMPOSTAZIONI ---
  const [includeExFest, setIncludeExFest] = useState(() => {
    const saved = localStorage.getItem(`exFest_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [includeTickets, setIncludeTickets] = useState(() => {
    const saved = localStorage.getItem(`tickets_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Salva automaticamente le modifiche nel browser appena clicchi i bottoni
  React.useEffect(() => {
    localStorage.setItem(`exFest_${worker.id}`, JSON.stringify(includeExFest));
    localStorage.setItem(`tickets_${worker.id}`, JSON.stringify(includeTickets));
  }, [includeExFest, includeTickets, worker.id]);
  const scanRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // --- STATO BATCH UPLOAD ---
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const badgeStyles = useMemo(() => {
    if (!worker.profilo) return 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
    if (worker.profilo === 'ELIOR') return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/50';
    if (worker.profilo === 'REKEEP') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50';
    if (worker.profilo === 'RFI') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 border-blue-200 dark:border-blue-700/50';

    // AZIENDE CUSTOM
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
  // AGGIUNGI QUESTE DUE RIGHE QUI:
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  // --- NUOVI STATI PER UX TOP TIER ---
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showSupernova, setShowSupernova] = useState(false);
  const commandBarRef = useRef<HTMLDivElement>(null);
  // Stato per la notifica personalizzata (sostituisce l'alert brutto)
  // Aggiorna questa riga aggiungendo | 'warning'
  const [batchNotification, setBatchNotification] = useState<{ msg: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const batchInputRef = useRef<HTMLInputElement>(null);
  // --- STATO QR CODE ---
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  // ✨ MOTORE NOTIFICHE AUTO-PULENTE (Previene i blocchi su schermo)
  useEffect(() => {
    if (batchNotification) {
      const timer = setTimeout(() => {
        setBatchNotification(null);
      }, 4000);
      return () => clearTimeout(timer); // Se arriva una nuova notifica, cancella il timer vecchio!
    }
  }, [batchNotification]);

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
      // ESC per chiudere i modali
      if (e.key === 'Escape') {
        if (state.showSplit) setShowSplit(false);
        if (state.isQRModalOpen) setIsQRModalOpen(false);
        if (state.showReport) setShowReport(false);
        if (state.isAiTfrModalOpen) setIsAiTfrModalOpen(false);
        if (state.activeTickerModal) setActiveTickerModal(null);
        if (state.isExplainerOpen) setIsExplainerOpen(false);
      }
      // CTRL+S o CMD+S per forzare sync visivo
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        state.onUpdateData(state.monthlyInputs);
        setBatchNotification({ type: 'success', msg: 'Dati sincronizzati e salvati correttamente.' });
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []); // <-- Dependencies vuoto: l'ascoltatore è persistente e previene il memory leak.


  // --- FUNZIONE CHE RICEVE I DATI DAL TELEFONO (ANTI-SOVRASCRITTURA DEFINITIVA FIXATA) ---
  const handleQRData = (aiResult: any) => {
    if (!aiResult) return;

    // 2. TRADUTTORE TITANIUM PER L'ANNO (Fuori dallo State Updater per Side Effects)
    let targetYear = parseInt(String(aiResult.year || "").replace(/[^\d]/g, ''));
    if (isNaN(targetYear) || targetYear < 2000) {
      const yMatchMonth = String(aiResult.month || "").match(/(20\d{2})/);
      if (yMatchMonth) targetYear = parseInt(yMatchMonth[1]);
      else return; // Anno introvabile, scartiamo per sicurezza
    }

    // 3. TRADUTTORE TITANIUM PER IL MESE
    const isCUD = aiResult.isCUD === true;
    let targetMonthIndex = -1;

    if (isCUD) {
      targetMonthIndex = 11; // 11 = Dicembre
    } else if (aiResult.month) {
      const mesiStr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
      let monthRaw = String(aiResult.month).toLowerCase().trim();
      targetMonthIndex = mesiStr.findIndex(m => monthRaw.includes(m));

      if (targetMonthIndex === -1) {
        const numMatch = monthRaw.match(/\b(0?[1-9]|1[0-2])\b/);
        if (numMatch) {
          targetMonthIndex = parseInt(numMatch[1]) - 1;
        } else if (monthRaw.length >= 5) {
          const firstTwo = parseInt(monthRaw.substring(0, 2));
          if (firstTwo >= 1 && firstTwo <= 12) targetMonthIndex = firstTwo - 1;
        }
      }
    }

    if (targetMonthIndex < 0 || targetMonthIndex > 11) {
      console.error("Mese non riconosciuto dal QR:", aiResult.month);
      targetMonthIndex = 0;
    }

    // SIDE EFFECTS ESEGUITI FUORI DALLO STATE UPDATER
    setCurrentYear(targetYear);
    window.dispatchEvent(new CustomEvent('island-scan-label', { detail: `${MONTH_NAMES[targetMonthIndex]} ${targetYear}` }));

    const fondoPregresso = aiResult.fondo_pregresso_31_12 !== undefined ? parseLocalFloat(aiResult.fondo_pregresso_31_12) : null;
    if (fondoPregresso !== null && !isNaN(fondoPregresso) && fondoPregresso > 0) {
      window.dispatchEvent(new CustomEvent('ai-found-tfr-base', {
        detail: { amount: fondoPregresso, year: targetYear - 1 }
      }));
    }

    // 1. IL FIX: Usiamo prevInputs puro senza produrre side effects interni
    setMonthlyInputs((prevInputs) => {
      let currentAnni = JSON.parse(JSON.stringify(prevInputs));

      // 4. CERCA O CREA LA RIGA CORRETTA
      let rowIndex = currentAnni.findIndex((r: any) => Number(r.year) === targetYear && r.monthIndex === targetMonthIndex);

      if (rowIndex === -1) {
        currentAnni.push({
          id: Date.now().toString() + Math.random().toString(),
          year: targetYear,
          monthIndex: targetMonthIndex,
          month: MONTH_NAMES[targetMonthIndex],
          daysWorked: 0, daysVacation: 0, ticket: 0, arretrati: 0, note: '', coeffTicket: 0, coeffPercepito: 0
        });
        rowIndex = currentAnni.length - 1;
      }

      const row = currentAnni[rowIndex];

      // 5. INIEZIONE DATI SICURA CON PROTEZIONE DECIMALI
      if (!isCUD) {
        if (aiResult.daysWorked !== undefined && aiResult.daysWorked !== null) row.daysWorked = parseLocalFloat(aiResult.daysWorked);
        if (aiResult.daysVacation !== undefined && aiResult.daysVacation !== null) row.daysVacation = parseLocalFloat(aiResult.daysVacation);
      }

      const ticketVal = parseLocalFloat(aiResult.ticketRate);
      if (!isNaN(ticketVal) && ticketVal > 0) row.coeffTicket = ticketVal;

      const arretratiVal = parseLocalFloat(aiResult.arretrati);
      if (!isNaN(arretratiVal) && arretratiVal !== 0) row.arretrati = arretratiVal;

      const sep = '  •  ';
      if (isCUD && !row.note?.includes("CUD")) row.note = row.note ? `[📄 Dati da CUD]${sep}${row.note}` : `[📄 Dati da CUD]`;
      if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote)) row.note = row.note ? `${row.note}${sep}[${aiResult.eventNote}]` : `[${aiResult.eventNote}]`;
      if (aiResult.aiWarning && aiResult.aiWarning !== "Nessuna anomalia" && !row.note?.includes("⚠️")) row.note = row.note ? `${row.note}${sep}[⚠️ AI: ${aiResult.aiWarning}]` : `[⚠️ AI: ${aiResult.aiWarning}]`;

      // SALVATAGGIO TFR INVISIBILE
      if (aiResult.imponibile_tfr_mensile !== undefined) {
        const newVal = parseLocalFloat(aiResult.imponibile_tfr_mensile);
        row.imponibile_tfr_mensile = isCUD ? newVal : (row.imponibile_tfr_mensile || 0) + newVal;
      }

      if (fondoPregresso !== null && !isNaN(fondoPregresso)) {
        row.fondo_pregresso_31_12 = fondoPregresso;
      }

      // MAPPA I CODICI IN TABELLA
      if (aiResult.codes) {
        const expectedColumns = getColumnsByProfile(worker.profilo, worker.eliorType) || [];
        Object.entries(aiResult.codes).forEach(([code, value]) => {
          const numValue = parseLocalFloat(value);
          if (!isNaN(numValue) && numValue !== 0) {
            const matchedCol = expectedColumns.find(c => code.toUpperCase().includes(c.id.toUpperCase()));
            if (matchedCol) {
              row[matchedCol.id] = numValue;
            } else {
              row[code] = numValue;
            }
          }
        });
      }

      currentAnni[rowIndex] = row;
      currentAnni.sort((a: any, b: any) => (a.year - b.year) || (a.monthIndex - b.monthIndex));

      return currentAnni; // <-- Dati Puri. useEffect pensa ad avvisare il padre!
    });
  };
  // Helper per far "respirare" l'IA tra un file e l'altro
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  // --- HELPER: RECUPERA LE COLONNE CUSTOM DA INVIARE ALL'AI ---
  const getCustomColumnsForAI = () => {
    // Se è la variante Elior Magazzino, passiamo le colonne di quel sotto-profilo al motore dinamico AI
    if (worker.profilo === 'ELIOR' && worker.eliorType === 'magazzino') {
      const columns = getColumnsByProfile(worker.profilo, worker.eliorType);
      return columns.filter((c: any) => c.id !== 'month' && c.id !== 'total' && c.id !== 'note' && c.id !== 'arretrati');
    }

    if (['RFI', 'ELIOR', 'REKEEP'].includes(worker.profilo)) return null;

    try {
      const saved = localStorage.getItem('customCompanies');
      if (saved) {
        const companies = JSON.parse(saved);
        if (companies[worker.profilo] && companies[worker.profilo].columns) {
          // Filtriamo solo i codici numerici/valuta da cercare, non roba tipo "note"
          return companies[worker.profilo].columns.filter((c: any) => c.id !== 'month' && c.id !== 'total' && c.id !== 'note' && c.id !== 'arretrati');
        }
      }
    } catch (e) {
      console.error("Errore lettura custom companies per AI", e);
    }
    return null;
  };
  // ✨ FUNZIONE DI SUPPORTO 1: Converte i file in Base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let result = reader.result as string;
        if (result.includes(',')) {
          result = result.split(',')[1];
        }
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
  };

  // ✨ FUNZIONE DI SUPPORTO 2: Importata da utils/formatters
  // --- 🔥 2. LOGICA UPLOAD COLLEGATA ALLA DYNAMIC ISLAND (CON PARSER TITANIUM V2) ---
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>, isSingle = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 🔴 ACCENDIAMO L'ISOLA GLOBALE
    startUpload(isSingle ? 'single' : 'batch', files.length);

    let currentAnni = JSON.parse(JSON.stringify(monthlyInputs));
    let successCount = 0;
    let errorCount = 0;
    let lastDetectedYear = null;

    // Recupera le colonne della tabella per mappare esattamente i codici
    const expectedColumns = getColumnsByProfile(worker.profilo, worker.eliorType) || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // ✨ TRASMETTE IL NOME FILE ALLA DYNAMIC ISLAND E CALCOLA SUBITO IL MESE
      const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      let label = file.name;
      const foundMonthUiIndex = monthNames.findIndex(m => file.name.toLowerCase().includes(m.toLowerCase()));
      const yearMatchUI = file.name.match(/(20\d{2})/);

      if (foundMonthUiIndex !== -1) {
        label = yearMatchUI ? `${monthNames[foundMonthUiIndex]} ${yearMatchUI[1]}` : monthNames[foundMonthUiIndex];
      } else {
        label = file.name.length > 18 ? file.name.substring(0, 18) + '...' : file.name;
      }
      window.dispatchEvent(new CustomEvent('island-scan-label', { detail: label }));

      // 🔵 AGGIORNA BARRA
      if (!isSingle) updateUploadProgress(i + 1);

      try {
        const base64String = await toBase64(file);

        const response = await fetch('/.netlify/functions/scan-payslip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64String,
            mimeType: file.type || "application/pdf",
            company: worker.profilo,
            eliorType: worker.eliorType, // <--- INSERISCI QUESTA RIGA
            customColumns: getCustomColumnsForAI()
          })
        });

        const responseText = await response.text();
        let aiResult;

        try {
          let parsed = JSON.parse(responseText);

          // 🛡️ SCUDO ANTI-ALLUCINAZIONI STRUTTURALI DELL'IA
          // Se l'IA ha "impacchettato" male i dati, li estraiamo a forza
          if (Array.isArray(parsed)) parsed = parsed[0];
          if (parsed && parsed.data) parsed = parsed.data;
          if (parsed && parsed.payslip) parsed = parsed.payslip;
          if (parsed && parsed.risultato) parsed = parsed.risultato;

          aiResult = parsed;

          // 📡 SPIA DIAGNOSTICA: Stampa nella console cosa ha capito l'IA
          // Dati estratti e pronti per l'inserimento

        } catch (e) {
          console.error(`❌ Il server ha fallito sul file ${file.name}. Risposta:`, responseText);
          errorCount++;
          continue;
        }

        if (!response.ok || !aiResult || aiResult.error) {
          console.error(`Errore file ${file.name}`, aiResult?.error || "Nessun dato valido");
          errorCount++;
          continue;
        }

        // ✨ IL TRADUTTORE TITANIUM V3 (Fix Integrità Dati)
        // Diamo PRIORITÀ ASSOLUTA all'anno scritto nel nome del file dall'utente.
        // Evitiamo che l'IA sbagli leggendo la "competenza" dell'anno precedente.
        let targetYear: number;
        if (yearMatchUI) {
          targetYear = parseInt(yearMatchUI[1]);
        } else {
          targetYear = parseInt(String(aiResult.year || "").replace(/[^\d]/g, ''));
          if (isNaN(targetYear) || targetYear < 2000) {
            const yMatchMonth = String(aiResult.month || "").match(/(20\d{2})/);
            if (yMatchMonth) targetYear = parseInt(yMatchMonth[1]);
          }
        }

        let targetMonthIndex = foundMonthUiIndex;

        // 🚨 MODALITÀ CUD: Forza l'inserimento nel mese di Dicembre
        const isCUD = aiResult.isCUD === true;

        if (isCUD) {
          targetMonthIndex = 11; // 11 = Dicembre
        } else if (targetMonthIndex === -1 && aiResult.month) {
          const mesiStr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
          let monthRaw = String(aiResult.month).toLowerCase().trim();
          targetMonthIndex = mesiStr.findIndex(m => monthRaw.includes(m));

          if (targetMonthIndex === -1) {
            const numMatch = monthRaw.match(/\b(0?[1-9]|1[0-2])\b/);
            if (numMatch) {
              targetMonthIndex = parseInt(numMatch[1]) - 1;
            } else if (monthRaw.length >= 5) {
              const firstTwo = parseInt(monthRaw.substring(0, 2));
              if (firstTwo >= 1 && firstTwo <= 12) targetMonthIndex = firstTwo - 1;
            }
          }
        }

        if (targetMonthIndex < 0 || targetMonthIndex > 11 || isNaN(targetYear) || targetYear < 2000) {
          console.error("❌ Impossibile determinare data per il file:", file.name);
          errorCount++;
          continue;
        }

        lastDetectedYear = targetYear;

        let rowIndex = currentAnni.findIndex((r: AnnoDati) =>
          Number(r.year) === targetYear && r.monthIndex === targetMonthIndex
        );

        if (rowIndex === -1) {
          const newRow: AnnoDati = {
            id: Date.now().toString() + Math.random(),
            year: targetYear,
            monthIndex: targetMonthIndex,
            month: MONTH_NAMES[targetMonthIndex],
            daysWorked: 0, daysVacation: 0, ticket: 0, arretrati: 0, note: '', coeffTicket: 0, coeffPercepito: 0
          };
          currentAnni.push(newRow);
          rowIndex = currentAnni.length - 1;
        }

        const row = currentAnni[rowIndex];

        // DATI FISSI E PROTEZIONE CUD (Non sovrascriviamo le medie dei giorni)
        if (!isCUD) {
          if (aiResult.daysWorked !== undefined && aiResult.daysWorked !== null) row.daysWorked = parseLocalFloat(aiResult.daysWorked);
          if (aiResult.daysVacation !== undefined && aiResult.daysVacation !== null) row.daysVacation = parseLocalFloat(aiResult.daysVacation);
        }

        const ticketVal = parseLocalFloat(aiResult.ticketRate);
        if (!isNaN(ticketVal) && ticketVal > 0) row.coeffTicket = ticketVal;

        const arretratiVal = parseLocalFloat(aiResult.arretrati);
        if (!isNaN(arretratiVal) && arretratiVal !== 0) row.arretrati = arretratiVal;

        const sep = '  •  ';
        if (isCUD && !row.note?.includes("CUD")) row.note = row.note ? `[📄 Dati da CUD]${sep}${row.note}` : `[📄 Dati da CUD]`;
        if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote)) row.note = row.note ? `${row.note}${sep}[${aiResult.eventNote}]` : `[${aiResult.eventNote}]`;
        if (aiResult.aiWarning && aiResult.aiWarning !== "Nessuna anomalia" && !row.note?.includes("⚠️")) row.note = row.note ? `${row.note}${sep}[⚠️ AI: ${aiResult.aiWarning}]` : `[⚠️ AI: ${aiResult.aiWarning}]`;
        if (!isNaN(ticketVal) && ticketVal > 0 && !row.note?.includes("Ticket")) row.note = row.note ? `${row.note}${sep}[🎫 Ticket: €${ticketVal.toFixed(2)}]` : `[🎫 Ticket: €${ticketVal.toFixed(2)}]`;

        // ✨ SALVATAGGIO INVISIBILE DATI TFR E RADAR INTELLIGENTE
        if (aiResult.imponibile_tfr_mensile !== undefined) {
          const newVal = parseLocalFloat(aiResult.imponibile_tfr_mensile);
          // Se è CUD forza l'importo annuo, se è busta paga lo accoda
          row.imponibile_tfr_mensile = isCUD ? newVal : (row.imponibile_tfr_mensile || 0) + newVal;
        }

        if (aiResult.fondo_pregresso_31_12 !== undefined) {
          const fondoTrovato = parseLocalFloat(aiResult.fondo_pregresso_31_12);
          row.fondo_pregresso_31_12 = fondoTrovato;

          // Se trova un fondo > 0, Lancia un segnale radio a tutta l'app!
          if (fondoTrovato > 0) {
            window.dispatchEvent(new CustomEvent('ai-found-tfr-base', {
              detail: {
                amount: fondoTrovato,
                year: targetYear - 1 // Se il CUD è del 2018 (redditi 2018), il fondo è al 31/12/2017
              }
            }));
          }
        }

        // INDENNITÀ (Codici in tabella)
        if (aiResult.codes && typeof aiResult.codes === 'object') {
          Object.entries(aiResult.codes).forEach(([code, value]) => {
            const numValue = parseLocalFloat(value);
            if (!isNaN(numValue) && numValue !== 0) {
              const matchedCol = expectedColumns.find(c => code.toUpperCase().includes(c.id.toUpperCase()));
              if (matchedCol) {
                // @ts-ignore
                row[matchedCol.id] = numValue;
              } else {
                // @ts-ignore
                row[code] = numValue;
              }
            }
          });
        }

        currentAnni[rowIndex] = row;
        successCount++;

      } catch (error) {
        console.error("Errore generico batch", error);
        errorCount++;
      }

      if (!isSingle && i < files.length - 1) {
        await delay(1500);
      }
    }

    currentAnni.sort((a: AnnoDati, b: AnnoDati) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    });

    setMonthlyInputs(currentAnni);
    if (lastDetectedYear) setCurrentYear(lastDetectedYear);

    if (batchInputRef.current) batchInputRef.current.value = '';

    finishUpload(successCount, errorCount, isSingle ? 'single' : 'batch');
  };
  // 👇 INCOLLA QUI IL CERVELLO RADAR E IL SALVATAGGIO 👇

  // --- 🤖 ANTENNA RADAR AI GLOBALE (VERSIONE SILENZIATA) ---
  const hasPromptedTfrRef = useRef(false);

  useEffect(() => {
    const handleAiTfr = (e: any) => {
      const { amount, year } = e.detail;
      // ✨ LA MAGIA: Scatta SOLO se non abbiamo già chiesto in questa sessione e se il campo è vuoto!
      if (!hasPromptedTfrRef.current && (!worker?.tfr_pregresso || worker.tfr_pregresso === 0)) {
        hasPromptedTfrRef.current = true; // Blocca chiamate successive
        setAiTfrAmount(amount.toString());
        setAiTfrYear(year.toString());
        setIsAiTfrModalOpen(true);
        // Niente più notifica fissa qui: il modale basta e avanza!
      }
    };
    window.addEventListener('ai-found-tfr-base', handleAiTfr);
    return () => window.removeEventListener('ai-found-tfr-base', handleAiTfr);
  }, [worker]);

  const handleSaveAiTfr = () => {
    if (!aiTfrAmount || !aiTfrYear) return;
    const rawData = localStorage.getItem('workers_data');
    if (rawData && worker) {
      let workers = JSON.parse(rawData);
      const amount = parseFloat(aiTfrAmount.replace(',', '.'));
      const year = parseInt(aiTfrYear);

      workers = workers.map((w: any) => w.id === worker.id ? { ...w, tfr_pregresso: amount, tfr_pregresso_anno: year } : w);
      localStorage.setItem('workers_data', JSON.stringify(workers));

      worker.tfr_pregresso = amount;
      worker.tfr_pregresso_anno = year;

      setIsAiTfrModalOpen(false);
      // ✨ FIX: Invia la notifica DIRETTAMENTE NEL TERMINALE DELL'ISOLA senza chiuderla!
      window.dispatchEvent(new CustomEvent('island-scan-label', { detail: 'TFR STORICO SALVATO ✅' }));
    }
  };

  const handleIgnoreAiTfr = () => {
    setIsAiTfrModalOpen(false);
    setBatchNotification(null); // Pulisce eventuali notifiche bloccate
  };

  const handleDataChange = (newData: AnnoDati[]) => {
    setMonthlyInputs(newData);
  };

  // --- GESTIONE CELLA ATTIVA ---
  const handleCellFocus = (rowIndex: number, colId: string) => {
    setActiveCell({ row: rowIndex, col: colId });
  };


  // --- 🔥 3. FUNZIONE SINGOLA (WRAPPER) ---
  const handleAnalyzePaySlip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      await handleBatchUpload(event, true); // Passiamo 'true' per attivare la modale dedicata!
      if (scanRef.current) scanRef.current.value = '';
    }
  };

  // --- FUNZIONE CERVELLO CORRETTA (Logica Anno Precedente + Filtro Anno Inizio) ---
  const calculateAnnualLegalData = (data: AnnoDati[], profile: any, withExFest: boolean, startClaimYear: number) => {
    const years = Array.from(new Set(data.map(d => Number(d.year)))).sort((a, b) => a - b);

    const indennitaCols = getColumnsByProfile(profile, worker?.eliorType).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(c.id)
    );

    // 1. PASSO PRELIMINARE: Calcoliamo le medie giornaliere per OGNI anno disponibile (anche il 2007)
    const yearlyAverages: Record<number, number> = {};

    years.forEach(year => {
      const monthsInYear = data.filter(d => Number(d.year) === year);
      let totIndennitaAnno = 0;
      let totGiorniLavoratiAnno = 0;

      monthsInYear.forEach(m => {
        const ggLav = parseLocalFloat(m.daysWorked);
        
        if (ggLav > 0) {
          let totMese = 0;
          indennitaCols.forEach(col => { totMese += parseLocalFloat(m[col.id]); });

          totIndennitaAnno += totMese;
          totGiorniLavoratiAnno += ggLav;
        }
      });

      // Calcolo media giornaliera dell'anno
      if (totGiorniLavoratiAnno > 0) {
        yearlyAverages[year] = totIndennitaAnno / totGiorniLavoratiAnno;
      } else {
        yearlyAverages[year] = 0;
      }
    });

    // 2. PASSO FINALE: Calcolo Spettanze (Escludendo importi anni precedenti allo start)
    let globalLordo = 0;
    let globalTicket = 0;
    let globalFerieEffettive = 0;
    let globalFeriePagate = 0;

    const TETTO_FERIE = withExFest ? 32 : 28;

    years.forEach(year => {
      // --- MODIFICA FONDAMENTALE ---
      // Se l'anno è precedente all'inizio della vertenza (es. 2007 < 2008), 
      // NON sommare nulla ai totali globali. Serve solo per la media calcolata sopra.
      if (year < startClaimYear) return;

      const monthsInYear = data.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);
      let ferieCumulateAnno = 0;

      // RECUPERO LA MEDIA DA USARE (Anno prec o corrente)
      const prevYear = year - 1;
      const avgToUse = yearlyAverages[prevYear] !== undefined ? yearlyAverages[prevYear] : yearlyAverages[year];

      monthsInYear.forEach(m => {
        const ferieMese = parseLocalFloat(m.daysVacation);
        const coeffTicket = parseLocalFloat(m['coeffTicket']);

        // Logica Tetto
        const spazioRimanente = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
        const giorniUtili = Math.min(ferieMese, spazioRimanente);
        ferieCumulateAnno += ferieMese;

        // Calcolo Lordo Mensile
        globalLordo += (giorniUtili * avgToUse);

        // Calcolo Ticket
        if (includeTickets) {
          globalTicket += (giorniUtili * coeffTicket);
        }

        globalFerieEffettive += ferieMese;
        globalFeriePagate += giorniUtili;
      });
    });

    return { globalLordo, globalTicket, globalFerieEffettive, globalFeriePagate };
  };

  // --- CALCOLO VALORE TOTALE (Per il Ticker della Dynamic Island) ---
  const dealStats = useMemo(() => {
    const { globalLordo, globalTicket } = calculateAnnualLegalData(monthlyInputs, worker.profilo, includeExFest, startClaimYear);
    const TETTO = includeExFest ? 32 : 28;
    let totalPercepito = 0;

    const years = Array.from(new Set(monthlyInputs.map(d => Number(d.year))));
    years.forEach(year => {
      if (year < startClaimYear) return;
      const months = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);
      let acc = 0;
      months.forEach(m => {
        const f = parseLocalFloat(m.daysVacation);
        const coeff = parseLocalFloat(m['coeffPercepito']);
        const utile = Math.min(f, Math.max(0, TETTO - acc));
        acc += f;
        totalPercepito += (utile * coeff);
      });
    });

    const grossClaim = (globalLordo - totalPercepito) + globalTicket;

    return {
      displayTarget: grossClaim > 0 ? grossClaim : 0
    };
  }, [monthlyInputs, worker.profilo, includeExFest, includeTickets, startClaimYear]);

  // --- GESTIONE INVIO PEC ---
  const handleSendPec = () => {
    const profile = PROFILE_CONFIG[worker.profilo] || PROFILE_CONFIG.RFI;
    const subject = `DIFFIDA E MESSA IN MORA - ${worker.cognome} ${worker.nome}`;
    const body = `Spett.le ${profile.label},\n\nIn nome e per conto del Sig. ${worker.nome} ${worker.cognome}, trasmetto in allegato i conteggi relativi alle differenze retributive maturate.\n\nDistinti Saluti,\nUfficio Vertenze`;
    window.location.href = `mailto:${profile.pec}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // --- FUNZIONE STAMPA PDF (STRUTTURA ORIGINALE + CALCOLI CORRETTI + FIX TYPESCRIPT) ---
  const handlePrintTables = () => {
    // 0. RECUPERO PREFERENZE: Legge se l'utente ha nascosto la colonna nel Report
    const savedPercepito = localStorage.getItem(`report_percepito_${worker.id}`);
    const showPercepito = savedPercepito !== null ? JSON.parse(savedPercepito) : true;

    // 1. SETUP E CONFIGURAZIONE (Orientamento Landscape per farci stare tutto)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const totalPagesExp = '{total_pages_count_string}'; // Variabile necessaria

    const indennitaCols = getColumnsByProfile(worker.profilo, worker.eliorType).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(c.id)
    );

    const fmt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const fmtInt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { maximumFractionDigits: 0 }) : '-';

    // Parametri Calcolo
    const TETTO = includeExFest ? 32 : 28;

    // --- A. PRE-CALCOLO MEDIE ANNUALI (IL "CERVELLO") ---
    const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};
    monthlyInputs.forEach(row => {
      const y = Number(row.year);
      if (!isNaN(y)) {
        if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
        const gg = parseLocalFloat(row.daysWorked);
        if (gg > 0) {
          let sum = 0;
          indennitaCols.forEach(c => sum += parseLocalFloat(row[c.id]));
          yearlyRaw[y].totVar += sum;
          yearlyRaw[y].ggLav += gg;
        }
      }
    });

    const yearlyAverages: Record<number, number> = {};
    Object.keys(yearlyRaw).forEach(k => {
      const y = Number(k);
      const t = yearlyRaw[y];
      yearlyAverages[y] = t.ggLav > 0 ? t.totVar / t.ggLav : 0;
    });

    // 3. PREPARAZIONE DATI
    const yearsSet = new Set(monthlyInputs.map((d: any) => Number(d.year)));
    const yearsToPrint = Array.from(yearsSet)
      .filter((y: any) => !isNaN(Number(y)))
      .map((y: any) => Number(y))
      .sort((a: number, b: number) => a - b);

    // Variabili per i totali PDF
    const yearlyRows: any[] = [];
    const pivotData: any = {};

    // Inizializzazione Totali Generali
    let grandTotalLordo = 0;
    let grandTotalTicket = 0;
    let grandTotalNet = 0;
    let grandTotalFerieEffettive = 0;
    let grandTotalFeriePagate = 0;
    let grandTotalIndemnity = 0;
    let grandTotalPercepito = 0; // <--- AGGIUNTO PER EVITARE BUG NEL FINALE

    // --- B. COSTRUZIONE DATI TABELLA 1 (RIEPILOGO) ---
    yearsToPrint.forEach((yearVal) => {
      const year = Number(yearVal);

      // 🔥 FIX 1: AZZERIAMO IL CONTATORE FERIE AD OGNI ANNO 🔥
      let ferieCumulateCounter = 0;

      let mediaApplicata = yearlyAverages[year - 1];
      if (mediaApplicata === undefined || mediaApplicata === 0) {
        mediaApplicata = yearlyAverages[year] || 0;
      }

      const months = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      let yIndemnity = 0;
      let yWorkDays = 0;
      let yLordo = 0;
      let yTicket = 0;
      let yPercepito = 0;
      let yFerieEffettive = 0;
      let yFeriePagate = 0;

      months.forEach(row => {
        let monthVoci = 0;
        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          monthVoci += val;

          const pivotKey = `[${col.id}] ${col.label}`;
          if (!pivotData[pivotKey]) pivotData[pivotKey] = {};
          if (!pivotData[pivotKey][year]) pivotData[pivotKey][year] = 0;
          pivotData[pivotKey][year] += val;
        });
        yIndemnity += monthVoci;
        yWorkDays += parseLocalFloat(row.daysWorked);

        const vacDays = parseLocalFloat(row.daysVacation);
        const cTicket = parseLocalFloat(row.coeffTicket);
        const cPercepito = parseLocalFloat(row.coeffPercepito);

        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += vacDays;

        const spazio = Math.max(0, TETTO - prevTotal);
        const ggUtili = Math.min(vacDays, spazio);

        yFerieEffettive += vacDays;
        yFeriePagate += ggUtili;

        if (ggUtili > 0) {
          yLordo += (ggUtili * mediaApplicata);
          yPercepito += (ggUtili * cPercepito);

          if (includeTickets) {
            yTicket += (ggUtili * cTicket);
          } else {
            yTicket = 0;
          }
        }
      });

      const yNetto = (yLordo - (showPercepito ? yPercepito : 0)) + yTicket;
      const isReferenceYear = year < startClaimYear;

      yearlyRows.push([
        isReferenceYear ? `${year} (Rif.)` : year,
        fmt(yIndemnity),
        fmtInt(yWorkDays),
        fmt(mediaApplicata),
        `${fmtInt(yFeriePagate)} / ${fmtInt(yFerieEffettive)}`,
        isReferenceYear ? '(Media)' : fmt(yLordo),
        isReferenceYear ? '-' : fmt(yTicket),
        isReferenceYear ? '-' : fmt(yNetto)
      ]);

      if (!isReferenceYear) {
        grandTotalIndemnity += yIndemnity;
        grandTotalLordo += yLordo;
        grandTotalTicket += yTicket;
        grandTotalNet += yNetto;
        grandTotalFerieEffettive += yFerieEffettive;
        grandTotalFeriePagate += yFeriePagate;
        grandTotalPercepito += yPercepito; // Accumuliamo in modo pulito
      }
    });

    yearlyRows.push([
      'TOTALE',
      fmt(grandTotalIndemnity),
      '-',
      '-',
      `${fmtInt(grandTotalFeriePagate)} / ${fmtInt(grandTotalFerieEffettive)}`,
      fmt(grandTotalLordo),
      fmt(grandTotalTicket),
      fmt(grandTotalNet)
    ]);

    // --- C. GENERAZIONE PDF ---
    const drawHeaderFooter = (data: any) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(23, 37, 84);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text(`CONTEGGIO DIFFERENZE RETRIBUTIVE (Max ${TETTO}gg)`, 14, 12);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
      // Sostituita Matricola con Profilo Professionale (Ruolo)
      doc.text(`Pratica: ${worker.cognome} ${worker.nome} - Profilo: ${worker.ruolo}`, pageWidth - 14, 12, { align: 'right' });

      doc.setFontSize(7); doc.setTextColor(100);

      // Dinamizza il nome del contratto in base all'azienda
      let nomeCCNL = 'CCNL di Categoria';
      if (worker.profilo === 'RFI') nomeCCNL = 'CCNL Mobilità';
      if (worker.profilo === 'REKEEP') nomeCCNL = 'CCNL Multiservizi';
      if (worker.profilo === 'ELIOR') nomeCCNL = 'CCNL Ristorazione';

      // Applica il nome del contratto e il tetto giorni reale (28 o 32)
      const note = `Calcolo elaborato ai sensi Cass. n. 20216/2022 e Art. 64 ${nomeCCNL}. La media giornaliera è calcolata sul totale delle voci variabili diviso i giorni di effettiva presenza. Limite giorni indennizzabili: ${TETTO}.`;
      doc.text(note, 14, pageHeight - 10);
      const str = "Pagina " + doc.getNumberOfPages();
      doc.text(str, pageWidth - 14, pageHeight - 10, { align: 'right' });
    };

    let currentY = 30;

    // --- TABELLA 1 ---
    doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("1. CALCOLO DIFFERENZE PER ANNO", 14, currentY);

    // 🔥 FIX 1: DINAMIZZIAMO LE INTESTAZIONI DELLA TABELLA
    const table1Head = ['ANNO', 'TOT. VARIABILI', 'GG LAV.', 'MEDIA UTILIZZATA', 'GG FERIE / TOT'];
    if (includeTickets) {
      table1Head.push('DIFF. LORDA', 'TICKET', 'NETTO DOVUTO');
    } else {
      table1Head.push('DOVUTO'); // Se non ci sono i ticket, usiamo solo una colonna finale
    }

    // 🔥 FIX 2: SBIANCHIAMO L'ANNO DI RIFERIMENTO (LA PRIMA RIGA) E ADATTIAMO LE COLONNE
    const table1Body = yearlyRows.map((row, index) => {
      // L'anno di riferimento è per forza il primo in alto nella tabella (indice 0)
      const isReferenceYear = index === 0;

      if (isReferenceYear) {
        // Sbianchiamo la media, le ferie e i conteggi economici mettendo il trattino "-"
        return includeTickets
          ? [row[0], row[1], row[2], '-', '-', '-', '-', '-']
          : [row[0], row[1], row[2], '-', '-', '-'];
      }

      // Anni successivi (calcoli attivi)
      if (includeTickets) {
        return row;
      } else {
        // Rimuoviamo Diff Lorda e Ticket, teniamo solo il Netto finale (che ora si chiama Dovuto)
        return [row[0], row[1], row[2], row[3], row[4], row[7]];
      }
    });

    autoTable(doc, {
      startY: currentY + 5,
      head: [table1Head],
      body: table1Body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: 50, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: [23, 37, 84], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252] },
        3: { fontStyle: 'bold', textColor: [180, 83, 9] },
        // Colora sempre di verde l'ultima colonna a destra
        [table1Head.length - 1]: { fontStyle: 'bold', halign: 'right', fillColor: [220, 252, 231], textColor: [21, 128, 61] }
      },
      bodyStyles: { halign: 'right' },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 3;

    // NOTA A PIE DI TABELLA 1
    doc.setFontSize(8); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
    doc.text(`* La dicitura "GG FERIE / TOT" indica i giorni effettivamente conteggiati ai fini del calcolo rispetto a quelli goduti. In caso di superamento del limite legale (${TETTO}gg annui), l'eccedenza è stata esclusa dal conteggio economico.`, 14, currentY);
    currentY += 12;

    // --- TABELLA 2 (PIVOT) ---
    // @ts-ignore
    if (currentY > 150) { doc.addPage(); currentY = 30; }

    doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("2. RIEPILOGO VOCI VARIABILI DELLA RETRIBUZIONE", 14, currentY);

    const pivotHead = ['CODICE E VOCE', ...yearsToPrint.map(String), 'TOTALE'];

    // 🔥 FIX 1: Contatori per la riga dei totali finali
    const yearlyTotals = new Array(yearsToPrint.length).fill(0);
    let grandPivotTotal = 0;

    const pivotBody = Object.keys(pivotData).sort().map(key => {
      let rowTotal = 0;
      const shortKey = key.length > 25 ? key.substring(0, 23) + '..' : key;
      const row = [shortKey];

      yearsToPrint.forEach((yearVal, index) => {
        const year = Number(yearVal);
        const val = pivotData[key][year] || 0;

        rowTotal += val;
        yearlyTotals[index] += val; // Accumuliamo il totale per questa colonna (anno)

        row.push(fmt(val));
      });

      grandPivotTotal += rowTotal; // Accumuliamo il totale generale di tutta la tabella
      row.push(fmt(rowTotal));

      return row;
    });

    // 🔥 FIX 2: Costruiamo e aggiungiamo la riga finale dei totali
    const totalsRow = ['TOTALE COMPLESSIVO'];
    yearlyTotals.forEach(val => totalsRow.push(fmt(val))); // Inseriamo i totali degli anni
    totalsRow.push(fmt(grandPivotTotal)); // Inseriamo il super-totale finale a destra
    pivotBody.push(totalsRow);

    autoTable(doc, {
      startY: currentY + 5,
      head: [pivotHead],
      body: pivotBody,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1.5, textColor: 50 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      bodyStyles: { halign: 'right', valign: 'middle' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } },
      didParseCell: function (data) {
        // 🔥 FIX: Rimosso minCellWidth per far "respirare" la tabella dentro i margini del foglio A4
        if (data.column.index > 0) {
          data.cell.styles.cellWidth = 'auto'; // Lasciamo decidere all'algoritmo
        }
        // Colora l'ultima colonna a destra (Totale di ogni singola voce)
        if (data.section === 'body' && data.column.index === pivotHead.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
        // Colora ed evidenzia l'ultimissima riga in basso (Totale Complessivo)
        if (data.section === 'body' && data.row.index === pivotBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 235, 200];
          data.cell.styles.textColor = [194, 65, 12];
        }
      },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 10, right: 10 }
    });

    // --- TABELLA 3 (DETTAGLIO MENSILE) ---
    // 🔥 FIX: Manteniamo il foglio in ORIZZONTALE (Landscape) anche per i dettagli mensili!
    doc.addPage('a4', 'landscape');
    currentY = 30;
    drawHeaderFooter(null);

    doc.setFontSize(12); doc.setTextColor(23, 37, 84);
    doc.text("3. DETTAGLIO MENSILE ANALITICO", 14, currentY);

    yearsToPrint.forEach(yearVal => {
      const year = Number(yearVal);
      // @ts-ignore
      if (currentY > 160) { doc.addPage(); currentY = 30; }

      let monthlyFerieCounter = 0;

      let media = yearlyAverages[year - 1];
      if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`ANNO ${year} (Media: ${fmt(media)})`, 14, currentY + 8);

      const yearRows = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      const tableHead = [
        'MESE',
        ...indennitaCols.map(c => `${c.id}\n${c.label.substring(0, 8)}.`),
        'GG LAV', 'GG FERIE', 'LORDO'
      ];
      if (showPercepito) tableHead.push('GIA\' PERC.');
      if (includeTickets) tableHead.push('TICKET');
      if (showPercepito || includeTickets) tableHead.push('NETTO');

      // 🔥 FIX 1: Prepariamo le "scatole" per accumulare i totali dell'anno
      let sumGgLav = 0;
      let sumGgFerie = 0;
      let sumLordo = 0;
      let sumPercepito = 0;
      let sumTicket = 0;
      let sumNetto = 0;

      const tableBody = yearRows.map(row => {
        const monthName = row.month ? row.month : (MONTH_NAMES[row.monthIndex] || '');
        const rowData = [monthName.substring(0, 3).toUpperCase()];

        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          rowData.push(fmt(val) === '-' ? '' : fmt(val).replace(' €', ''));
        });

        const ggLav = parseLocalFloat(row.daysWorked);
        const vac = parseLocalFloat(row.daysVacation);

        const spazio = Math.max(0, TETTO - monthlyFerieCounter);
        const gu = Math.min(vac, spazio);
        monthlyFerieCounter += vac;

        let rLordo = 0;
        if (gu > 0) rLordo = gu * media;

        const rTicket = includeTickets ? (gu * parseLocalFloat(row.coeffTicket)) : 0;
        const rPercepito = gu * parseLocalFloat(row.coeffPercepito);

        const rNetto = (rLordo - (showPercepito ? rPercepito : 0)) + rTicket;

        // Accumuliamo i valori riga per riga nelle nostre "scatole"
        sumGgLav += ggLav;
        sumGgFerie += gu;
        sumLordo += rLordo;
        sumPercepito += rPercepito;
        sumTicket += rTicket;
        sumNetto += rNetto;

        rowData.push(ggLav > 0 ? String(ggLav) : '');
        rowData.push(gu !== vac ? `${fmtInt(gu)}*` : fmtInt(gu));
        rowData.push(fmt(rLordo));

        if (showPercepito) rowData.push(fmt(rPercepito));
        if (includeTickets) rowData.push(fmt(rTicket));
        if (showPercepito || includeTickets) rowData.push(fmt(rNetto));

        return rowData;
      });

      // 🔥 FIX 2: Costruiamo la Riga Totale (Usiamo "Tot." per non andare a capo)
      const totalsRow = ['TOT.'];

      // Mettiamo celle vuote per "saltare" le colonne delle indennità
      indennitaCols.forEach(() => totalsRow.push(''));

      // Inseriamo solo i totali di Giorni, Ferie e Valori Economici
      totalsRow.push(sumGgLav > 0 ? String(sumGgLav) : '');
      totalsRow.push(fmtInt(sumGgFerie));
      totalsRow.push(fmt(sumLordo));

      if (showPercepito) totalsRow.push(fmt(sumPercepito));
      if (includeTickets) totalsRow.push(fmt(sumTicket));
      if (showPercepito || includeTickets) totalsRow.push(fmt(sumNetto));

      // Spingiamo la riga in fondo alla tabella
      tableBody.push(totalsRow);

      autoTable(doc, {
        startY: currentY + 12,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'right', lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 12, fillColor: [241, 245, 249] },
          [tableHead.length - 1]: { fontStyle: 'bold', fillColor: [240, 253, 250], textColor: [21, 128, 61] }
        },
        didParseCell: function (data) {
          // 🔥 FIX 3: Colore sobrio ed istituzionale per i sub-totali mensili
          if (data.section === 'body' && data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [226, 232, 240]; // Un grigio-azzurro molto elegante (Slate-200)
            data.cell.styles.textColor = [23, 37, 84]; // Testo blu scuro che richiama l'intestazione
          }
        },
        didDrawPage: drawHeaderFooter,
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    });
    // --- PAGINA 4: RIEPILOGO FINALE ---
    // Ritorniamo in VERTICALE per la pagina di chiusura
    doc.addPage('a4', 'landscape');
    drawHeaderFooter(null);
    currentY = 40;

    doc.setFontSize(16); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("RIEPILOGO FINALE", 105, currentY, { align: 'center' });
    currentY += 15;

    // 🔥 SPIEGAZIONE SEMPLICE
    doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal');
    const spiegazione = `Sulla base dei dati analizzati nelle tabelle precedenti, il sistema ha calcolato le differenze retributive spettanti al lavoratore.`;

    const splitSpiegazione = doc.splitTextToSize(spiegazione, 160);
    doc.text(splitSpiegazione, 25, currentY);
    currentY += (splitSpiegazione.length * 6) + 10;

    const printRow = (label, value, isTotal = false) => {
      doc.setFontSize(isTotal ? 14 : 12);
      if (isTotal) doc.setTextColor(22, 163, 74); // Verde Vittoria per il totale
      else doc.setTextColor(50, 50, 50);

      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');

      doc.text(label, 40, currentY);
      doc.text(value, 170, currentY, { align: 'right' });
      doc.setDrawColor(200); doc.setLineWidth(0.1);
      doc.line(40, currentY + 2, 170, currentY + 2);
      currentY += 12;
    };

    // Calcoliamo il netto effettivo (se ci sono detrazioni/aggiunte)
    const veroNettoDaStampare = (grandTotalLordo - (showPercepito ? grandTotalPercepito : 0)) + (includeTickets ? grandTotalTicket : 0);

    // 🔥 FIX NOMENCLATURA LEGALE: Chiamiamo le cose con il loro vero nome!
    if (!showPercepito && !includeTickets) {
      // Caso 1: Nessun calcolo extra. L'unico totale è il LORDO.
      currentY += 10;
      printRow("TOTALE LORDO SPETTANTE", fmt(grandTotalLordo), true);
    } else {
      // Caso 2: Ci sono detrazioni/ticket. Si parte dal Lordo e si arriva al Netto.
      printRow("Totale Lordo Spettante", fmt(grandTotalLordo));

      if (showPercepito) {
        printRow("Totale Già Percepito (Voce Busta)", fmt(grandTotalPercepito));
      }

      if (includeTickets) {
        printRow("Totale Buoni Pasto Maturati", fmt(grandTotalTicket));
      }

      currentY += 5;
      printRow("TOTALE NETTO DA LIQUIDARE", fmt(veroNettoDaStampare), true);
    }

    // CHIUSURA FORMALE
    currentY += 25;
    doc.setFontSize(9); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
    const notaFinale = "Il presente conteggio ha valore di perizia tecnica di parte. I calcoli sono stati eseguiti algoritmicamente garantendo la massima precisione matematica basata sui dati forniti.";
    doc.text(notaFinale, 105, currentY, { align: 'center', maxWidth: 150 });

    if (typeof doc.putTotalPages === 'function') { doc.putTotalPages(totalPagesExp); }
    doc.save(`Conteggi_${worker.cognome}_${worker.nome}.pdf`);
  };
  // --- MOTORE OCR (Invariato) ---
  const performOcr = async (crop: { x: number, y: number, w: number, h: number }) => {
    if (!imgRef.current || !activeCell) return;

    setIsProcessing(true);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const renderedWidth = imgRef.current.width;
    const renderedHeight = imgRef.current.height;
    const naturalWidth = imgRef.current.naturalWidth;
    const naturalHeight = imgRef.current.naturalHeight;

    const scaleX = naturalWidth / renderedWidth;
    const scaleY = naturalHeight / renderedHeight;

    canvas.width = crop.w * scaleX;
    canvas.height = crop.h * scaleY;

    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        crop.x * scaleX, crop.y * scaleY, crop.w * scaleX, crop.h * scaleY,
        0, 0, canvas.width, canvas.height
      );

      try {
        const { data: { text } } = await Tesseract.recognize(
          canvas.toDataURL('image/png'),
          'eng'
        );

        let cleanText = text.trim().replace(/[^\d,.-]/g, '');
        cleanText = cleanText.replace(/O/g, '0').replace(/o/g, '0');

        if (cleanText) {
          updateDataWithOcr(cleanText);
        }
      } catch (err) {
        console.error("Errore OCR", err);
      }
    }

    setIsProcessing(false);
    setSelectionBox(null);
    setIsSniperMode(false);
  };

  const updateDataWithOcr = (value: string) => {
    if (!activeCell) return;

    const { row, col } = activeCell;
    const existingRow = monthlyInputs.find(d => d.year === currentYear && d.monthIndex === row);

    const updatedRow = {
      ...(existingRow || {
        year: currentYear,
        monthIndex: row,
        month: MONTH_NAMES[row],
        daysWorked: 0,
        daysVacation: 0,
        ticket: 0
      }),
      [col]: value
    };

    const otherData = monthlyInputs.filter(d => !(d.year === currentYear && d.monthIndex === row));
    const newData = [...otherData, updatedRow];
    setMonthlyInputs(newData);
  };
  // --- INIZIO NUOVO HELPER: ORDINAMENTO CRONOLOGICO BUSTE PAGA ---
  const getFilenameDateScore = (filename: string) => {
    const name = filename.toLowerCase();
    let month = 0;
    let year = 0;

    // 1. Cerca l'anno (es. 2023, 2024)
    const yearMatch = name.match(/(20\d{2})/);
    if (yearMatch) year = parseInt(yearMatch[1]);

    // 2. Cerca i mesi in formato testuale (gennaio, feb, mar...)
    const monthNames = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    monthNames.forEach((m, index) => {
      if (name.includes(m)) month = index + 1;
    });

    // 3. Se non ha trovato il testo, cerca i mesi a numero (01, 02... 12)
    if (month === 0) {
      // Cerca numeri da 01 a 12 separati da underscore o trattini
      const numMatch = name.match(/[^0-9](0[1-9]|1[0-2])[^0-9]/) || name.match(/^(0[1-9]|1[0-2])[^0-9]/);
      if (numMatch) month = parseInt(numMatch[1] || numMatch[0].replace(/[^0-9]/g, ''));
    }

    // Restituisce un numero ordinabile (es. Anno 2024, Mese 1 = 202401)
    return (year * 100) + month;
  };
  // --- FINE HELPER ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // 1. Prendi i file veri
      const filesArray = Array.from(e.target.files) as File[];

      // 2. Ordinali magicamente usando il nome!
      filesArray.sort((a, b) => {
        const scoreA = getFilenameDateScore(a.name);
        const scoreB = getFilenameDateScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name); // Fallback alfabetico
      });

      // 3. Trasformali in URL da mostrare
      const newFiles = filesArray.map(file => URL.createObjectURL(file));

      setPayslipFiles(prev => [...prev, ...newFiles]);
      setCurrentFileIndex(prev => prev === 0 && payslipFiles.length === 0 ? 0 : prev);
      setShowSplit(true);

      // Reset totale
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
  // --- NUOVE FUNZIONI DRAG & DROP ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Blocca l'apertura della scheda
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); // Blocca l'apertura della scheda
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // 1. Prendi i file veri dal Drag
      const filesArray = Array.from(e.dataTransfer.files) as File[];

      // 2. Ordinali magicamente
      filesArray.sort((a, b) => {
        const scoreA = getFilenameDateScore(a.name);
        const scoreB = getFilenameDateScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
      });

      // 3. Trasformali in URL
      const newFiles = filesArray.map(file => URL.createObjectURL(file));

      setPayslipFiles(prev => [...prev, ...newFiles]);

      // Se è il primo caricamento, resetta la vista
      if (payslipFiles.length === 0) {
        setCurrentFileIndex(0);
        setImgScale(1);
        setImgPos({ x: 0, y: 0 });
      }
    }
  };
  // --- GESTIONE MOUSE ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSniperMode) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      const startX = (e.clientX - rect.left - imgPos.x) / imgScale;
      const startY = (e.clientY - rect.top - imgPos.y) / imgScale;

      setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });
      setIsSelecting(true);
    } else {
      // Controlla se ci sono file nell'array invece che l'immagine singola
      if (payslipFiles.length > 0) setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSniperMode && isSelecting && selectionBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - imgPos.x) / imgScale;
      const currentY = (e.clientY - rect.top - imgPos.y) / imgScale;

      setSelectionBox({
        ...selectionBox,
        w: currentX - selectionBox.x,
        h: currentY - selectionBox.y
      });
    } else if (isDragging) {
      setImgPos(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => {
    if (isSniperMode && isSelecting && selectionBox) {
      const finalBox = {
        x: selectionBox.w > 0 ? selectionBox.x : selectionBox.x + selectionBox.w,
        y: selectionBox.h > 0 ? selectionBox.y : selectionBox.y + selectionBox.h,
        w: Math.abs(selectionBox.w),
        h: Math.abs(selectionBox.h)
      };

      if (finalBox.w > 5 && finalBox.h > 5) {
        performOcr(finalBox);
      } else {
        setSelectionBox(null);
      }
      setIsSelecting(false);
    }
    setIsDragging(false);
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

      const res = await fetch('/.netlify/functions/scan-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64String,
          mimeType: blob.type || "application/pdf",
          action: 'explain',
          company: worker.profilo,
          eliorType: worker.eliorType, // <--- INSERISCI QUESTA RIGA
          customColumns: getCustomColumnsForAI() // Inietta i codici custom anche all'avvocato!
        })
      });

      const aiResult = await res.json();
      setExplanationData(aiResult.explanation);
    } catch (error) {
      setExplanationData("❌ Impossibile stabilire una connessione con il Motore Neurale.");
    } finally {
      setIsExplaining(false);
    }
  };
  // --- PARSER CUSTOM PER IL REPORT AI (Typography Premium Definitivo) ---
  const renderAIReport = (text: string | null) => {
    if (!text) return null;

    // Dividiamo per doppio a capo per isolare i blocchi logici e rimuoviamo blocchi vuoti
    return text.split('\n\n').filter(p => p.trim() !== '').map((paragraph, index) => {

      // --- 1. Gestione Titoli (Iniziano con ###) ---
      if (paragraph.trim().startsWith('###')) {
        const titleText = paragraph.replace(/###/g, '').trim();
        return (
          <h3 key={index} className="text-xl font-black text-white mt-8 mb-4 flex items-center gap-3 border-b border-slate-700/50 pb-3">
            {titleText}
          </h3>
        );
      }

      // --- Funzione interna per colorare i Grassetti ---
      const renderTextWithBold = (str: string) => {
        return str.split(/(\*\*.*?\*\*)/g).map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            // MAGIA: Se è una cifra in € o la parola Netto, diventa Verde Smeraldo. Altrimenti Fucsia.
            const isMoney = boldText.includes('€') || boldText.toLowerCase().includes('netto');

            return (
              <strong key={i} className={`font-bold tracking-wide ${isMoney ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.3)]'}`}>
                {boldText}
              </strong>
            );
          }
          // Trasforma eventuali singoli \n in veri a capo
          return <span key={i}>{part.split('\n').map((line, j, arr) => <React.Fragment key={j}>{line}{j < arr.length - 1 && <br />}</React.Fragment>)}</span>;
        });
      };

      // --- 2. Gestione Liste puntate (Gestisce sia i trattini che gli asterischi dell'AI) ---
      const lines = paragraph.split('\n');
      const isList = lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('*'));

      if (isList) {
        return (
          <ul key={index} className="space-y-3 mb-6 ml-2 border-l-[3px] border-fuchsia-500/30 pl-5">
            {lines.filter(line => line.trim() !== '').map((line, i) => {
              // Rimuove il trattino o l'asterisco iniziale
              const cleanLine = line.replace(/^[-*]\s*/, '').trim();
              return (
                <li key={i} className="text-slate-300 text-[15px] leading-relaxed relative flex items-start gap-3">
                  {/* Pallino Custom Olografico */}
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
                  <span>{renderTextWithBold(cleanLine)}</span>
                </li>
              );
            })}
          </ul>
        );
      }

      // --- 3. Paragrafi normali discorsivi ---
      return (
        <p key={index} className="text-slate-300 text-[15px] leading-relaxed mb-5">
          {renderTextWithBold(paragraph)}
        </p>
      );
    });
  };
  // --- 🔥 MODIFICA 2: CALCOLO STATISTICHE UNIFICATO E TICKER ISTAT (GOD TIER UX) ---
  const statsData = useMemo(() => {
    if (!monthlyInputs || !Array.isArray(monthlyInputs)) return { cards: [], rawTotal: 0 };

    const indennitaCols = getColumnsByProfile(worker.profilo, worker.eliorType).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(c.id)
    );

    const yearlyRawStats: Record<number, { totVar: number; ggLav: number }> = {};

    monthlyInputs.forEach(row => {
      const y = Number(row.year);
      if (!yearlyRawStats[y]) yearlyRawStats[y] = { totVar: 0, ggLav: 0 };
      const ggLav = parseFloatSafe(row.daysWorked);

      let sommaIndennitaRow = 0;
      indennitaCols.forEach(c => { sommaIndennitaRow += parseFloatSafe(row[c.id]); });
      yearlyRawStats[y].totVar += sommaIndennitaRow;
      yearlyRawStats[y].ggLav += ggLav;
    });

    const yearlyAverages: Record<number, number> = {};
    Object.keys(yearlyRawStats).forEach(k => {
      const y = Number(k);
      const t = yearlyRawStats[y];
      yearlyAverages[y] = t.ggLav > 0 ? t.totVar / t.ggLav : 0;
    });

    let totLordoSpettante = 0;
    let totTicket = 0;
    let totGiaPercepito = 0;
    let totaleISTATeInteressi = 0;

    const TETTO = includeExFest ? 32 : 28;
    const availableYears = Array.from(new Set(monthlyInputs.map(d => Number(d.year)))).sort((a, b) => a - b);

    availableYears.forEach(year => {
      if (year < startClaimYear) return;

      let ferieCumulateAnno = 0;
      let mediaDaUsare = yearlyAverages[year - 1];
      if (mediaDaUsare === undefined || mediaDaUsare === 0) mediaDaUsare = yearlyAverages[year] || 0;

      const monthsInYear = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      let lordoAnno = 0;
      let percepitoAnno = 0;
      let ticketAnno = 0;

      monthsInYear.forEach(row => {
        const vacDays = parseFloatSafe(row.daysVacation);
        const coeffTicket = parseFloatSafe(row.coeffTicket);
        const coeffPercepito = parseFloatSafe(row.coeffPercepito);

        const spazio = Math.max(0, TETTO - ferieCumulateAnno);
        const giorniUtili = Math.min(vacDays, spazio);
        ferieCumulateAnno += vacDays;

        if (giorniUtili > 0) {
          lordoAnno += (giorniUtili * mediaDaUsare);
          percepitoAnno += (giorniUtili * coeffPercepito);
          if (includeTickets) ticketAnno += (giorniUtili * coeffTicket);
        }
      });

      totLordoSpettante += lordoAnno;
      totGiaPercepito += percepitoAnno;
      totTicket += ticketAnno;

      const nettoAnno = (lordoAnno - percepitoAnno) + ticketAnno;
      if (nettoAnno > 0) {
        const risultatoIstat = calculateLegalInterestsAndRevaluation(nettoAnno, year);
        totaleISTATeInteressi += risultatoIstat.totaleDovuto;
      }
    });

    const differenzaRetributiva = totLordoSpettante - totGiaPercepito;
    const nettoRecuperabile = differenzaRetributiva + totTicket;
    const tfrSulleDifferenze = totLordoSpettante / 13.5;

    const cards = [
      {
        label: "TOTALE DA LIQUIDARE",
        value: formatCurrency(nettoRecuperabile),
        icon: Wallet,
        color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50",
        textColor: "text-emerald-600 dark:text-emerald-400",
        note: `Diff. Retr. (${formatCurrency(differenzaRetributiva)}) + Ticket`,
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30 shadow-inner">
              <strong className="text-emerald-400 block mb-1.5 tracking-wide uppercase text-xs">Il Valore di Conciliazione</strong>
              <p className="text-sm">Questa è la somma liquida, netta ed esigibile che il lavoratore deve incassare <em>immediatamente</em> alla chiusura della vertenza.</p>
            </div>
            <p className="pl-2">Rappresenta la differenza pura tra ciò che gli spettava di diritto e ciò che l'azienda gli ha effettivamente pagato nei periodi di ferie, al netto delle imposte e con l'aggiunta dell'indennità sostitutiva dei buoni pasto. È la <strong>bottom line</strong> per qualsiasi trattativa stragiudiziale.</p>
          </div>
        )
      },
      {
        label: "TOTALE ISTAT + INTERESSI",
        value: formatCurrency(totaleISTATeInteressi),
        icon: LineChart,
        color: "bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-800/50",
        textColor: "text-fuchsia-600 dark:text-fuchsia-400",
        note: "Rivalutazione e Mora (Art. 429 c.p.c.)",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-fuchsia-950/40 p-4 rounded-xl border border-fuchsia-500/30 shadow-inner">
              <strong className="text-fuchsia-400 block mb-1.5 tracking-wide uppercase text-xs">Lo Scudo Finanziario</strong>
              <p className="text-sm">L'importo massimo inattaccabile da esigere in caso di ricorso in Giudizio.</p>
            </div>
            <p className="pl-2">La giurisprudenza protegge i crediti di lavoro imponendo due oneri all'azienda inadempiente: la <strong>Rivalutazione Monetaria</strong> (che neutralizza l'inflazione usando gli indici ISTAT FOI) e gli <strong>Interessi Legali</strong> (calcolati sul capitale progressivamente rivalutato anno per anno). Il tempo, qui, gioca a favore del lavoratore.</p>
          </div>
        )
      },
      {
        label: "LORDO SPETTANTE",
        value: formatCurrency(totLordoSpettante),
        icon: TrendingUp,
        color: "bg-blue-50 dark:bg-cyan-900/20 border-blue-200 dark:border-cyan-800/50",
        textColor: "text-blue-600 dark:text-cyan-400",
        note: "Basato su media annuale",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-cyan-950/40 p-4 rounded-xl border border-cyan-500/30 shadow-inner">
              <strong className="text-cyan-400 block mb-1.5 tracking-wide uppercase text-xs">Il Motore della Vertenza</strong>
              <p className="text-sm">Il fulcro matematico e giuridico dell'intera operazione, basato sull'Ordinanza <strong>Cass. n. 20216/2022</strong>.</p>
            </div>
            <p className="pl-2">Durante le ferie, la retribuzione non può subire flessioni. Questo valore calcola <em>al centesimo</em> quanto l'azienda avrebbe dovuto pagare, applicando il <strong>Principio di Onnicomprensività</strong>: la media giornaliera di tutte le voci variabili e continuative percepite nell'anno, moltiplicata per i giorni di riposo costituzionalmente garantito.</p>
          </div>
        )
      },
      {
        label: "TFR SU DIFFERENZE",
        value: formatCurrency(tfrSulleDifferenze),
        icon: Banknote,
        color: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50",
        textColor: "text-violet-600 dark:text-violet-400",
        note: "Da aggiungere alla liquidazione",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-violet-950/40 p-4 rounded-xl border border-violet-500/30 shadow-inner">
              <strong className="text-violet-400 block mb-1.5 tracking-wide uppercase text-xs">L'Effetto Domino</strong>
              <p className="text-sm">Il danno economico si ripercuote matematicamente sulla Liquidazione Finale del lavoratore.</p>
            </div>
            <p className="pl-2">Essendo il Trattamento di Fine Rapporto calcolato dividendo la retribuzione annua utile per 13,5, ogni euro di indennità illecitamente trattenuto durante le ferie ha generato un ammanco nel fondo. Questo valore ripristina la quota esatta di liquidazione sottratta negli anni.</p>
          </div>
        )
      },
      {
        label: "GIÀ PERCEPITO",
        value: formatCurrency(totGiaPercepito),
        icon: CheckCircle2,
        color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50",
        textColor: "text-orange-600 dark:text-orange-400",
        note: "Importo già erogato",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-orange-950/40 p-4 rounded-xl border border-orange-500/30 shadow-inner">
              <strong className="text-orange-400 block mb-1.5 tracking-wide uppercase text-xs">L'Ammortizzatore di Rischio Legale</strong>
              <p className="text-sm">Previene contestazioni di controparte o rischi di indebito arricchimento.</p>
            </div>
            <p className="pl-2">Indica le somme "tampone" che l'azienda ha già versato a titolo di indennità ferie (spesso forfettarie o calcolate al ribasso). Sottraendo rigorosamente questo importo dal <em>Lordo Spettante</em>, il nostro calcolo si trasforma in un'<strong>armatura matematica inattaccabile</strong> in sede processuale.</p>
          </div>
        )
      },
      {
        label: "TOTALE BUONI PASTO",
        value: formatCurrency(totTicket),
        icon: Ticket,
        color: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50",
        textColor: "text-indigo-600 dark:text-indigo-400",
        note: "Indennità sostitutiva",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/30 shadow-inner">
              <strong className="text-indigo-400 block mb-1.5 tracking-wide uppercase text-xs">L'Indennità Sostitutiva</strong>
              <p className="text-sm">Il riconoscimento del buono pasto come elemento ordinario della retribuzione.</p>
            </div>
            <p className="pl-2">La giurisprudenza consolida un principio chiaro: se il Ticket Restaurant è erogato con carattere di continuità, la sua mancata corresponsione produce un danno. Questo indicatore monetizza il controvalore esatto dei buoni pasto illecitamente trattenuti dall'azienda durante i giorni di ferie.</p>
          </div>
        )
      }
    ];

    if (worker.tfr_pregresso && worker.tfr_pregresso > 0) {
      cards.push({
        label: "FONDO TFR STORICO",
        value: formatCurrency(worker.tfr_pregresso),
        icon: Scale,
        color: "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700",
        textColor: "text-slate-700 dark:text-slate-300",
        note: `Base AI dal ${worker.tfr_pregresso_anno}`,
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-inner">
              <strong className="text-white block mb-1.5 tracking-wide uppercase text-xs">Il Punto Zero (AI Vision)</strong>
              <p className="text-sm">L'Ancora Temporale estratta in automatico dal Motore Neurale.</p>
            </div>
            <p className="pl-2">È il capitale di partenza del Trattamento di Fine Rapporto, letto dall'Intelligenza Artificiale dai documenti originali (CU o Buste Paga dell'anno {worker.tfr_pregresso_anno}). Serve da base infallibile per innescare l'algoritmo di rivalutazione composta ISTAT nel Prospetto TFR.</p>
          </div>
        )
      });
    }

    return { cards, rawTotal: nettoRecuperabile };
  }, [monthlyInputs, worker.profilo, includeExFest, includeTickets, startClaimYear, worker.tfr_pregresso, worker.tfr_pregresso_anno]);

  // Passiamo i dati delle card al Ticker scorrevole
  const tickerItems = [...statsData.cards, ...statsData.cards, ...statsData.cards];

  // --- TRASMETTITORE PER LA DYNAMIC ISLAND ---
  useEffect(() => {
    // Invia il valore TOTALE esatto e sincronizzato all'Island
    window.dispatchEvent(new CustomEvent('island-ticker', { detail: statsData.rawTotal }));

    // Quando usciamo dalla pagina, resetta a null
    return () => {
      window.dispatchEvent(new CustomEvent('island-ticker', { detail: null }));
    };
  }, [statsData.rawTotal]);

  // COMPONENTE TIMELINE (Semaforo Style)
  const TimelineStep = ({ step, label, icon: Icon, activeStatus }: any) => {
    const steps = ['analisi', 'pronta', 'inviata', 'trattativa', 'chiusa'];
    const isActive = step === activeStatus;
    const isPast = steps.indexOf(activeStatus) > steps.indexOf(step);

    // Mappa colori stato
    let colorClass = 'text-slate-400 dark:text-slate-200 border-slate-300 dark:text-slate-500 dark:text-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800';
    if (isActive || isPast) {
      if (step === 'analisi' || step === 'trattativa') colorClass = 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-500 dark:shadow-[0_0_10px_rgba(220,38,38,0.5)]'; // Rosso
      else if (step === 'pronta' || step === 'inviata') colorClass = 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-500 dark:shadow-[0_0_10px_rgba(217,119,6,0.5)]'; // Giallo
      else if (step === 'chiusa') colorClass = 'text-white bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-500 dark:shadow-[0_0_10px_rgba(5,150,105,0.5)]'; // Verde
    }

    return (
      <div
        onClick={() => {
          setLegalStatus(step);
          if (onUpdateStatus) onUpdateStatus(step);
        }}
        className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${isActive ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-slate-800 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-300'}`}>{label}</span>
      </div>
    );
  };
  // --- RENDER CONDIZIONALE DEL REPORT ---
  if (showReport) {
    return (
      <TableComponent
        worker={worker}
        // ECCO LA MAGIA: Ora gli diciamo di spegnere il report E tornare alla vera Dashboard!
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
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#020617] font-sans text-slate-900 dark:text-slate-100 relative flex flex-col overflow-hidden transition-colors duration-500"
      onDragEnter={(e) => { e.preventDefault(); setIsGlobalDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsGlobalDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          // Innesca il caricamento massivo simulando l'evento dell'input
          handleBatchUpload({ target: { files: e.dataTransfer.files } } as any);
        }
      }}
    >

      {/* --- 1. GLOBAL MAGNETIC DROPZONE --- */}
      <AnimatePresence mode="wait">
        {isGlobalDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            // 1. VIA DI FUGA: Se l'utente clicca ovunque sullo sfondo scuro, si chiude.
            onClick={() => setIsGlobalDragging(false)}
            className="fixed inset-0 z-[999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center border-[8px] border-dashed border-fuchsia-500/50 m-4 rounded-[3rem] cursor-pointer"
            onDragLeave={(e) => {
              // Sicurezza nativa del browser
              if (e.clientX === 0 || e.clientY === 0) setIsGlobalDragging(false);
            }}
          >
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Bot className="w-32 h-32 text-fuchsia-400 drop-shadow-[0_0_40px_rgba(217,70,239,0.8)]" />
            </motion.div>
            <h2 className="text-4xl font-black text-white mt-8 tracking-widest uppercase text-center">Sgancia i file qui</h2>
            <p className="text-fuchsia-300 font-bold mt-2 text-center">Il Motore Neurale li processerà in automatico.</p>

            {/* 2. VIA DI FUGA VISIVA: Bottone esplicito per rassicurare l'utente */}
            <div className="mt-12 flex flex-col items-center">
              <span className="text-slate-400 dark:text-slate-200 text-sm mb-4">oppure</span>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Evita che il click si propaghi al div genitore
                  setIsGlobalDragging(false);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all border border-slate-600 hover:border-slate-400 shadow-xl active:scale-95"
              >
                <X className="w-5 h-5" /> Annulla e Chiudi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STYLE GLOBALE */}
      {/* STILI GLOBALI SPOSTATI IN INDEX.CSS */}

      <MovingGrid />
      <div className="relative z-50 pt-20 px-6 pb-2"> {/* AUMENTATO IL PADDING TOP A 20 PER L'ISLAND */}
        {/* HEADER GLASSMORPHISM (Colori Blindati con style) */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={FRAMER_PHYSICS.smooth}
          className="glass-panel max-w-[1800px] mx-auto rounded-[2rem] p-4 flex justify-between items-center gap-6"
        >
          <div className="flex items-center gap-6 shrink-0">

            {/* COLONNA NAVIGAZIONE (Versione BIG & BOLD) */}
            <div className="flex flex-col gap-3 w-44"> {/* w-44 allarga tutta la colonna */}

              {/* 1. TASTO DASHBOARD (Grande e Leggibile) */}
              <button
                onClick={onBack}
                className="group relative h-11 w-full rounded-xl font-bold text-white shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center justify-center gap-3 text-sm"
                style={{ background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)' }}
              >
                {/* Effetto luce di sfondo */}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>

                <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
                <span className="tracking-wide">DASHBOARD</span>
              </button>

              {/* 2. NUOVO SELETTORE ANNO (Stile "Capsula Spaziale") */}
              <div className="relative group h-11 w-full">
                {/* Glow arancione dietro */}
                <div className="absolute inset-0 bg-orange-500 rounded-xl blur opacity-20 group-hover:opacity-50 dark:opacity-80 transition duration-500"></div>

                <div className="relative flex items-center justify-between bg-slate-900 text-white rounded-xl border border-slate-700 group-hover:border-orange-500/50 transition-colors w-full h-full px-3 shadow-xl overflow-hidden">

                  {/* Icona e Label */}
                  <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500 group-hover:text-orange-400 transition-colors">
                      <CalendarClock size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-200 leading-none mb-0.5 tracking-widest">Start Year</span>
                      <span className="text-lg font-black text-white leading-none tracking-tight">{startClaimYear}</span>
                    </div>
                  </div>

                  {/* Freccia decorativa */}
                  <ChevronDown size={16} className="text-slate-500 dark:text-slate-300 group-hover:text-orange-500 transition-colors z-10 pointer-events-none" />

                  {/* IL VERO SELECT (Invisibile sopra, ma con opzioni stilizzate) */}
                  <select
                    value={startClaimYear}
                    onChange={(e) => setStartClaimYear(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  >
                    {/* Opzioni stilizzate per evitare l'effetto "lenzuolo bianco" su Windows/Chrome */}
                    {YEARS.filter(y => y >= 2008 && y <= 2025).map(y => (
                      <option key={y} value={y} className="bg-slate-800 text-white py-2 font-bold">
                        Inizio Calcoli: {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* USER INFO (Ripristinato) */}
            <div className="flex items-center gap-5 border-l-2 border-slate-200/60 dark:border-slate-700/50 pl-8 h-20 transition-colors">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl text-white shadow-indigo-200 dark:shadow-indigo-900/40 ring-4 ring-white dark:ring-slate-800 shrink-0 transition-all"
                style={{ background: `linear-gradient(135deg, ${worker.accentColor === 'indigo' ? '#6366f1' : worker.accentColor === 'emerald' ? '#10b981' : worker.accentColor === 'orange' ? '#f97316' : '#3b82f6'}, ${worker.accentColor === 'indigo' ? '#4f46e5' : worker.accentColor === 'emerald' ? '#059669' : worker.accentColor === 'orange' ? '#ea580c' : '#2563eb'})` }}>
                <User className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none transition-colors">
                    {worker.cognome} {worker.nome}
                  </h1>
                  <BadgeCheck className="w-6 h-6 text-blue-500 dark:text-cyan-400 transition-colors" />
                  <div className={`ml-2 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-tighter border transition-colors ${badgeStyles}`}>
                    {worker.profilo}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-300 uppercase tracking-wider mt-1.5 transition-colors">
                  <Briefcase className="w-4 h-4" />
                  <span>{worker.ruolo}</span>
                </div>

              </div>
            </div>
          </div>



          <div className="flex items-center gap-3 shrink-0">

            {/* TASTO CALCOLO ISTAT E INTERESSI */}
            <button
              onClick={() => setIsIstatModalOpen(true)}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #eab308 0%, #d946ef 100%)' }} // Gold -> Fuchsia
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <LineChart className="w-4 h-4 transition-transform duration-500 group-hover:-translate-y-1" strokeWidth={2.5} />
              <span className="hidden lg:inline tracking-wide">Calcolo interessi (ISTAT)</span>
            </button>

            {/* TASTO PEC (Originale Invariato) */}
            <button
              onClick={handleSendPec}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #334155 0%, #475569 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Send className="w-4 h-4 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" strokeWidth={2.5} />
              <span className="hidden lg:inline">PEC</span>
            </button>
            {/* TASTO DOWNLOAD TABELLE */}
            <button
              onClick={handlePrintTables}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' }} // Emerald -> Teal
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Download className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-1" strokeWidth={2.5} />
              <span className="hidden xl:inline">Download</span>
            </button>

            {/* TASTO VAI AL REPORT */}
            <button
              onClick={() => setShowReport(true)}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)' }} // Violet -> Indigo
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <FileSpreadsheet className="w-4 h-4 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
              <span className="hidden xl:inline">Vai al Report</span>
            </button>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 flex-1 p-6 flex flex-col gap-6 max-w-[1800px] mx-auto w-full">



        {/* TIMELINE STATO VERTENZA E PARAMETRI (A TENDINA) */}
        <div className="lg:col-span-2 glass-panel px-6 py-4 shadow-sm dark:shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-white/60 dark:border-cyan-400 relative overflow-hidden transition-all duration-300">

          {/* Header: Pulsante apri/chiudi a sinistra, Toggle sempre visibili a destra */}
          <div className="flex justify-between items-center">

            <button
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              className="group flex items-center gap-2 text-sm font-black text-slate-700 dark:text-cyan-400 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors focus:outline-none"
            >
              <div className="p-1.5 bg-indigo-100 dark:bg-cyan-900/40 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-cyan-800/60 transition-colors">
                <Gavel className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
              </div>
              STATO VERTENZA
              <motion.div animate={{ rotate: isTimelineOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-200 dark:text-cyan-500/50 group-hover:text-indigo-500 dark:group-hover:text-cyan-400" />
              </motion.div>
            </button>
            {/* 👇 IL NUOVO TICKER CENTRALE (Incollato qui) 👇 */}
            <div className="flex-1 hidden xl:flex items-center justify-center overflow-hidden relative h-12 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-cyan-900/30 mx-8 shadow-inner transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white/90 dark:from-[#0f172a]/90 to-transparent z-10 transition-colors"></div>
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/90 dark:from-[#0f172a]/90 to-transparent z-10 transition-colors"></div>
              <div className="w-full overflow-hidden flex items-center">
                <motion.div
                  className="flex gap-12 items-center whitespace-nowrap"
                  animate={{ x: ["0%", "-33.33%"] }}
                  transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
                >
                  {tickerItems.map((stat: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-1 border-r border-slate-200/50 dark:border-slate-700/50 last:border-0 transition-colors cursor-pointer hover:bg-slate-100/10 dark:hover:bg-slate-800/50 rounded-lg"
                      onClick={() => setActiveTickerModal({ title: stat.label, content: stat.tooltip })} // 👈 SOLO QUESTA MODIFICA QUI
                    >
                      <div className={`p-2 rounded-xl shadow-sm border ${stat.color} ${stat.textColor} bg-white dark:bg-slate-900 transition-colors`}>
                        <stat.icon className="w-5 h-5" strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-300 uppercase tracking-widest leading-tight transition-colors flex items-center gap-1">
                          {stat.label} <span className="text-[8px] opacity-60 dark:opacity-90 font-bold">(?)</span>
                        </span>
                        <span className={`text-base font-black ${stat.textColor} leading-tight transition-colors`}>
                          {stat.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
            {/* 👆 FINE TICKER 👆 */}
            {/* TOGGLES PARAMETRI CALCOLO (SEMPRE VISIBILI) */}
            <div className="flex items-center p-1 bg-slate-100/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-full border border-slate-200/80 dark:border-cyan-900/50 shadow-sm shrink-0 transition-colors">
              <button
                onClick={() => setIncludeExFest(!includeExFest)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ${includeExFest
                  ? 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/60 dark:to-orange-900/60 text-amber-800 dark:text-amber-300 border-amber-300/50 dark:border-amber-500/50 shadow-[0_1px_6px_rgba(251,191,36,0.2)] dark:shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-amber-200/60 dark:hover:border-amber-700/50 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                title="Includi/Escludi Ex-Festività"
              >
                <CalendarPlus size={14} className={`transition-transform duration-300 ${includeExFest ? 'rotate-0' : 'group-hover:rotate-12'}`} strokeWidth={2.5} />
                <span>{includeExFest ? "32gg" : "28gg"}</span>
              </button>

              <button
                onClick={() => setIncludeTickets(!includeTickets)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ml-1 ${includeTickets
                  ? 'bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/60 dark:to-blue-900/60 text-indigo-800 dark:text-indigo-300 border-indigo-300/50 dark:border-indigo-500/50 shadow-[0_1px_6px_rgba(99,102,241,0.2)] dark:shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                  : 'bg-transparent text-slate-400 dark:text-slate-500 dark:text-slate-300 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200/60 dark:hover:border-indigo-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 line-through opacity-70 hover:opacity-100 hover:no-underline'
                  }`}
                title="Includi/Escludi Ticket Restaurant"
              >
                <Ticket size={14} className={`transition-transform duration-300 ${includeTickets ? 'rotate-0' : 'group-hover:-rotate-12'}`} strokeWidth={2.5} />
                Ticket
              </button>
            </div>
          </div>

          {/* TIMELINE A SCOMPARSA */}
          <AnimatePresence mode="wait">
            {isTimelineOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 mb-2 relative flex justify-between items-center z-10 px-4">
                  <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10 transition-colors"></div>
                  <TimelineStep step="analisi" label="Analisi" icon={Search} activeStatus={legalStatus} />
                  <TimelineStep step="pronta" label="Conteggi" icon={Calculator} activeStatus={legalStatus} />
                  <TimelineStep step="inviata" label="PEC Inviata" icon={Send} activeStatus={legalStatus} />
                  <TimelineStep step="trattativa" label="Trattativa" icon={Handshake} activeStatus={legalStatus} />
                  <TimelineStep step="chiusa" label="Chiusa" icon={CheckCircle2} activeStatus={legalStatus} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-center mb-6 z-20 shrink-0">
          {/* Contenitore con CURSOR SPOTLIGHT (Infallibile) */}
          <div
            ref={commandBarRef}
            onMouseMove={(e) => {
              if (!commandBarRef.current) return;
              const rect = commandBarRef.current.getBoundingClientRect();
              // Calcola le coordinate in tempo reale
              commandBarRef.current.style.setProperty('--x', `${e.clientX - rect.left}px`);
              commandBarRef.current.style.setProperty('--y', `${e.clientY - rect.top}px`);
            }}
            onMouseEnter={() => {
              // Accende la luce quando entri con il mouse
              if (commandBarRef.current) commandBarRef.current.style.setProperty('--spotlight-opacity', '1');
            }}
            onMouseLeave={() => {
              // Spegne la luce quando esci
              if (commandBarRef.current) commandBarRef.current.style.setProperty('--spotlight-opacity', '0');
            }}
            className="relative flex flex-wrap p-2 glass-panel gap-3 w-full justify-center"
          >
            {/* La Luce della Torcia (Ora è Indaco/Azzurrina e usa variabili native) */}
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300 z-0"
              style={{
                opacity: 'var(--spotlight-opacity, 0)',
                background: 'radial-gradient(300px circle at var(--x, 50%) var(--y, 50%), rgba(99, 102, 241, 0.25), transparent 50%)'
              }}
            ></div>
            {/* --- INPUT FILE NASCOSTO --- */}
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(e) => handleBatchUpload(e, false)}
              className="hidden"
              id="dashboard-ai-upload"
              disabled={isBatchProcessing}
            />

            {/* --- TASTO AI AGENT (Plasma Violet Theme - Immobile) --- */}
            <button
              onClick={() => document.getElementById('dashboard-ai-upload')?.click()}
              disabled={isBatchProcessing}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-500 flex items-center gap-3 overflow-hidden border-2 shrink-0
                  ${isBatchProcessing
                  ? 'bg-slate-100 border-slate-200 opacity-50 dark:opacity-80 cursor-not-allowed'
                  // A riposo: Vetro grigio. Hover: Si oscura e si accende di Fucsia SENZA sollevarsi.
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:border-transparent hover:shadow-[0_0_40px_rgba(217,70,239,0.3)]'
                }`}
            >
              {/* 1. SFONDO SCURO CHE APPARE IN HOVER */}
              <div className="absolute inset-0 bg-slate-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* 2. BORDO ROTANTE DI ENERGIA (Fucsia: #d946ef) */}
              <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#d946ef_360deg)] opacity-0 group-hover:opacity-100 group-hover:animate-[spin_2s_linear_infinite] transition-opacity duration-300"></div>

              {/* 3. CORE INTERNO SCURO (Lascia solo il bordo fine) */}
              <div className="absolute inset-[2px] bg-slate-900 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></div>

              {/* 4. GLOW FUCSIA DI FONDO */}
              <div className="absolute inset-0 bg-fuchsia-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 blur-xl"></div>

              {/* 5. CONTENUTO FRONTALE */}
              <div className="relative z-10 flex items-center gap-2.5 transition-colors duration-300">
                <div className="relative flex items-center justify-center">
                  {/* Icona Robot: Diventa Fucsia in hover */}
                  <Bot className="w-5 h-5 transition-all duration-500 group-hover:text-fuchsia-400" />
                  {/* Occhi Laser del Robot */}
                  <div className="absolute inset-0 bg-fuchsia-400 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                <div className="flex flex-col items-start leading-none text-left">
                  <span className="text-[8.5px] uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 group-hover:text-fuchsia-200 transition-all duration-300 mb-0.5 font-black">
                    Auto-Scan
                  </span>
                  <span className="tracking-widest font-black text-[13px] group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(217,70,239,0.8)] transition-all duration-300">
                    AI AGENT
                  </span>
                </div>
              </div>
            </button>

            {/* TASTO CARICA BUSTA (Pink) */}
            <button
              onClick={() => setShowSplit(!showSplit)}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${showSplit
                  ? 'text-white shadow-lg shadow-pink-500/30 border-white/20' // Attivo: Bordo visibile
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-pink-500 hover:shadow-md' // Inattivo: Bordo TRASPARENTE
                }`}
              style={showSplit ? { backgroundImage: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' } : {}}
            >
              {/* EFFETTO SERRANDA DI LUCE */}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>

              <div className="relative z-10 flex items-center gap-2">
                {showSplit ? <X className="w-5 h-5" /> : <Eye className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />}
                <span className="hidden lg:inline">{showSplit ? 'Chiudi Visore' : 'Carica Busta Paga'}</span>
              </div>
            </button>
            {/* --- TASTO SCAN AI (VERSIONE STEALTH BLINDATA + ICONA FLUTTUANTE) --- */}
            <button
              onClick={() => scanRef.current?.click()}
              disabled={isAnalyzing}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${isAnalyzing
                  ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                }`}
            >

              {/* 1. SFONDO SCURO (Per contrasto massimo in hover) */}
              <div className="absolute inset-0 bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></div>

              {/* 2. RAGGIO LASER (Indistruttibile con Framer Motion) */}
              <div className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 overflow-hidden z-0 transition-opacity duration-300">
                <motion.div
                  animate={{
                    top: ['-50%', '150%'],
                    opacity: [0, 1, 1, 0]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                    times: [0, 0.15, 0.85, 1]
                  }}
                  className="absolute left-0 w-full h-[50%] bg-gradient-to-b from-transparent via-cyan-500/20 to-cyan-400/80"
                >
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-300 shadow-[0_0_8px_#22d3ee,0_0_15px_#22d3ee]"></div>
                </motion.div>
              </div>

              {/* 3. CONTENUTO FRONTALE ANIMATO */}
              <div className="relative z-10 flex items-center gap-2.5 transition-colors duration-300 group-hover:text-white">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="font-medium">Analisi in corso...</span>
                  </>
                ) : (
                  <>
                    {/* ✨ FIX DEFINITIVO: Animazione fluida che si attiva SOLO in hover! */}
                    {/* Animazione scanIconFloat centralizzata in index.css */}

                    <div className="scan-icon-animate transition-transform">
                      <ScanLine className="w-5 h-5 transition-colors duration-300 text-slate-500 dark:text-slate-300 group-hover:text-cyan-400" />
                    </div>

                    <span className="font-bold transition-colors duration-300 group-hover:text-white tracking-wide flex gap-1.5">
                      SCAN
                      <span className="group-hover:text-cyan-400 transition-colors duration-300 group-hover:drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">
                        AI
                      </span>
                      Busta paga
                    </span>
                  </>
                )}
              </div>
            </button>

            {/* INPUT FILE NASCOSTO COLLEGATO AL TASTO */}
            <input
              type="file"
              accept="image/*,.pdf"
              ref={scanRef}
              className="hidden"
              onChange={handleAnalyzePaySlip}
            />
            {/* TASTO MOBILE SCAN - DESIGN SMARTPHONE 3D (Completamente trasparente a riposo) */}
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="group relative flex items-center gap-3 px-4 py-2 ml-2 bg-white/40 dark:bg-slate-800/40 border-2 border-transparent hover:bg-slate-900 hover:border-indigo-500 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] overflow-hidden shrink-0"
              title="Connetti lo Smartphone"
            >
              {/* Effetto Riflesso Vetro (Solo hover) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* IL MINI-SMARTPHONE CSS */}
              <div className="relative w-6 h-10 border-[1.5px] border-slate-400 dark:border-slate-500 group-hover:border-indigo-400 rounded-[6px] flex flex-col items-center p-[2px] transition-colors duration-300 shadow-inner bg-transparent group-hover:bg-slate-950">
                {/* Notch / Altoparlante */}
                <div className="w-2 h-[2px] bg-slate-400 dark:bg-slate-500 group-hover:bg-indigo-400 rounded-full mb-0.5 transition-colors duration-300"></div>

                {/* Schermo che si illumina (Solo hover) */}
                <div className="flex-1 w-full bg-slate-300/50 dark:bg-slate-700/50 group-hover:bg-indigo-500/20 rounded-[2px] flex items-center justify-center relative overflow-hidden transition-colors duration-300">
                  <QrCode className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-75 group-hover:scale-100" />
                </div>

                {/* Home Indicator */}
                <div className="w-2.5 h-[1.5px] bg-slate-400 dark:bg-slate-500 group-hover:bg-indigo-500 rounded-full mt-0.5 transition-colors duration-300"></div>
              </div>

              {/* Testo del Bottone */}
              <div className="flex flex-col items-start text-left relative z-10">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-200 group-hover:text-indigo-300 transition-colors uppercase tracking-widest leading-none mb-1">
                  Connetti
                </span>
                <span className="text-sm font-black text-slate-600 dark:text-slate-400 dark:text-slate-200 group-hover:text-white transition-colors leading-none">
                  Mobile Scan
                </span>
              </div>

              {/* Pallino di notifica: Grigio base, Verde e pulsante in hover */}
              <div className="absolute top-2 right-2 w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-0 group-hover:opacity-75 group-hover:animate-ping transition-opacity duration-300"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-slate-400 dark:bg-slate-600 group-hover:bg-emerald-500 transition-colors duration-300"></span>
              </div>
            </button>
            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

            {/* TASTO INSERIMENTO MENSILE (Blue) */}
            <button
              onClick={() => setActiveTab('input')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'input'
                  ? 'text-white shadow-lg shadow-blue-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-blue-500 dark:hover:text-cyan-400 hover:shadow-md'
                }`}
              style={activeTab === 'input' ? { backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <LayoutGrid className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'input' ? 'rotate-0' : 'group-hover:rotate-90'}`} />
              <span className="relative z-10">Inserimento Mensile</span>
            </button>

            {/* TASTO RIEPILOGO ANNUALE (Emerald) */}
            <button
              onClick={() => setActiveTab('calc')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'calc'
                  ? 'text-white shadow-lg shadow-emerald-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-500 dark:hover:text-emerald-400 hover:shadow-md'
                }`}
              style={activeTab === 'calc' ? { backgroundImage: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Calculator className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'calc' ? 'rotate-0' : 'group-hover:rotate-12'}`} />
              <span className="relative z-10">Riepilogo Annuale</span>
            </button>

            {/* TASTO ANALISI VOCI (Amber) */}
            <button
              onClick={() => setActiveTab('pivot')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'pivot'
                  ? 'text-white shadow-lg shadow-amber-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-md'
                }`}
              style={activeTab === 'pivot' ? { backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <TrendingUp className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'pivot' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Analisi Voci</span>
            </button>
            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
            {/* TASTO PROSPETTO TFR (Fucsia) */}
            <button
              onClick={() => setActiveTab('tfr')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'tfr'
                  ? 'text-white shadow-lg shadow-fuchsia-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-fuchsia-500 hover:shadow-md'
                }`}
              style={activeTab === 'tfr' ? { backgroundImage: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Wallet className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'tfr' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Prospetto TFR</span>
            </button>





          </div>
        </div>
        {/* --- SPLIT SCREEN CONTAINER (Tabella + Visore partono da qui!) --- */}
        <div className="flex flex-row gap-6 w-full items-stretch relative min-h-[calc(100vh-250px)]">
          <div className="flex-1 bg-white/60 dark:bg-slate-950/80 backdrop-blur-md rounded-[2.5rem] border border-white/60 dark:border-cyan-400 shadow-2xl dark:shadow-[inset_0_0_50px_rgba(34,211,238,0.15),0_0_30px_rgba(34,211,238,0.3)] overflow-hidden flex flex-col relative min-h-0 transition-all duration-300">
            <div className="flex-1 p-2 sm:p-6 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {isExplainerOpen ? (
                  /* --- PANNELLO AUDITOR AI --- */
                  <motion.div
                    key="explainer"
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: "circOut" }}
                    className="h-full w-full bg-slate-950 rounded-3xl border border-fuchsia-500/30 shadow-[0_0_30px_rgba(192,38,211,0.15)] flex flex-col overflow-hidden relative"
                  >
                    <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 z-10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-fuchsia-500/20 rounded-lg border border-fuchsia-500/30">
                          <Bot className="w-6 h-6 text-fuchsia-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white tracking-wide">Analisi Documentale</h2>
                          <p className="text-xs text-fuchsia-400 font-bold uppercase tracking-widest">Traduzione Legale</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsExplainerOpen(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 active:scale-95"
                      >
                        <X className="w-4 h-4" /> Chiudi
                      </button>
                    </div>

                    <div
                      className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar relative"
                      onScroll={handleContainerScroll}
                    >
                      <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-white opacity-5 pointer-events-none" />

                      {isExplaining ? (
                        <div className="space-y-6 animate-pulse">
                          {/* Skeleton dell'intestazione */}
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-xl"></div>
                            <div className="space-y-2">
                              <div className="h-4 w-32 bg-slate-800 rounded-md"></div>
                              <div className="h-3 w-20 bg-slate-800/60 rounded-md"></div>
                            </div>
                          </div>

                          {/* Skeleton del corpo report */}
                          <div className="space-y-4 pt-4">
                            <div className="h-3 w-full bg-slate-800/80 rounded-full"></div>
                            <div className="h-3 w-[90%] bg-slate-800/60 rounded-full"></div>
                            <div className="h-3 w-[95%] bg-slate-800/80 rounded-full"></div>
                            <div className="h-3 w-[85%] bg-slate-800/40 rounded-full"></div>
                          </div>

                          <div className="pt-8 space-y-4">
                            <div className="h-20 w-full bg-slate-800/40 rounded-2xl border border-slate-800"></div>
                            <div className="h-20 w-full bg-slate-800/40 rounded-2xl border border-slate-800"></div>
                          </div>

                          <div className="flex justify-center pt-6">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500 opacity-50" />
                              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">AI sta scrivendo il report...</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 pb-12 pr-4">
                          {renderAIReport(explanationData)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  /* --- TABELLE NORMALI --- */
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: "circOut" }}
                    className="h-full w-full"
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
                        />
                      </div>
                    )}

                    {activeTab === 'calc' && (
                      <div className="h-full overflow-auto custom-scrollbar pr-2">
                        {/* Passiamo l'interruttore alla tabella aggiungendo includeTickets={includeTickets} */}
                        <AnnualCalculationTable data={monthlyInputs} profilo={worker.profilo} eliorType={worker.eliorType} onDataChange={handleDataChange} includeTickets={includeTickets} startClaimYear={startClaimYear} years={dynamicYears} />
                      </div>
                    )}

                    {activeTab === 'pivot' && (
                      <div className="h-full overflow-auto custom-scrollbar pr-2">
                        <IndemnityPivotTable data={monthlyInputs} profilo={worker.profilo} eliorType={worker.eliorType} startClaimYear={startClaimYear} years={dynamicYears} />
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* --- SPLIT SCREEN SIDEBAR (MULTI-FILE) --- */}
          <AnimatePresence mode="wait">
            {showSplit && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: -50 }}
                animate={{ width: "45%", opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -50 }}
                className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 shrink-0 z-40"
                // 1. ASSEGNAZIONE EVENTI DRAG & DROP
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >

                {/* 2. INPUT SPOSTATO E CORRETTO (Un solo ref) */}
                <input
                  type="file"
                  ref={fileInputRef} // <--- SOLO QUESTO REF
                  className="hidden"
                  onChange={handleImageUpload}
                  accept="image/*,application/pdf"
                  multiple
                />

                {/* HEADER VISORE CON NAVIGAZIONE */}
                <div className="p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex justify-between items-center z-20">
                  <div className="flex items-center gap-3">
                    {/* TASTO BATCH UPLOAD - PREMIUM AI STYLE */}
                    <div className="relative mr-2">
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,image/*"
                        ref={batchInputRef}
                        onChange={handleBatchUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => batchInputRef.current?.click()}
                        disabled={isBatchProcessing}
                        className={`group relative px-5 py-2 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-300 overflow-hidden flex items-center gap-2.5 border border-white/10
                        ${isBatchProcessing
                            ? 'bg-slate-800 cursor-wait opacity-80'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 active:scale-95'
                          }`}
                      >
                        {/* Effetto Luce "Shimmer" al passaggio del mouse */}
                        {!isBatchProcessing && (
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                        )}

                        {isBatchProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-violet-200" />
                            <span className="tracking-wide text-xs">AI WORKING...</span>
                          </>
                        ) : (
                          <>
                            <div className="relative">
                              <FileStack className="w-4 h-4 text-white" strokeWidth={2.5} />
                              {/* Piccola stellina che pulsa per indicare l'AI */}
                              <Sparkles className="w-2.5 h-2.5 absolute -top-2 -right-2 text-amber-300 animate-pulse" fill="currentColor" />
                            </div>
                            <span className="tracking-wide">Smart Upload 12</span>
                          </>
                        )}
                      </button>
                    </div>
                    {payslipFiles.length > 1 ? (
                      <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-1 border border-slate-700">
                        <button onClick={prevFile} disabled={currentFileIndex === 0} className="p-1.5 hover:bg-slate-700 rounded text-white disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                        <span className="text-xs font-mono font-bold text-cyan-400 w-16 text-center">{currentFileIndex + 1} / {payslipFiles.length}</span>
                        <button onClick={nextFile} disabled={currentFileIndex === payslipFiles.length - 1} className="p-1.5 hover:bg-slate-700 rounded text-white disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300">
                        {isSniperMode ? <Crosshair className="w-5 h-5 text-red-500 animate-pulse" /> : <Eye className="w-5 h-5 text-indigo-400" />}
                        <span className="text-xs font-bold uppercase tracking-wider">{isSniperMode ? 'MODALITÀ CECCHINO' : 'Visore Buste paga'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {payslipFiles.length > 0 && (
                      <>
                        <button onClick={() => setIsSniperMode(!isSniperMode)} disabled={isProcessing} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSniperMode ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanEye className="w-4 h-4" />}
                          {isSniperMode ? 'STOP' : 'OCR'}
                        </button>
                        <div className="h-6 w-px bg-slate-600 mx-2"></div>

                        {/* NUOVI STRUMENTI: BACCHETTA MAGICA E ROTAZIONE */}
                        <button onClick={() => setImgFilter(prev => prev === 'none' ? 'contrast' : 'none')} className={`p-2 rounded-lg transition-colors ${imgFilter === 'contrast' ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`} title="Migliora Leggibilità Busta Paga Sbiadita"><Wand2 className="w-4 h-4" /></button>
                        <button onClick={() => setImgRotation(prev => prev + 90)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Ruota Immagine"><RotateCw className="w-4 h-4" /></button>
                        <div className="h-6 w-px bg-slate-600 mx-1"></div>

                        <button onClick={() => handleZoom(-0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Riduci Zoom"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={() => { setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); }} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Centra e Ripristina"><Maximize className="w-4 h-4" /></button>
                        <button onClick={() => handleZoom(0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Aumenta Zoom"><ZoomIn className="w-4 h-4" /></button>

                        {/* CESTINO FIXATO (Non chiude il visore) */}
                        <button onClick={() => {
                          const newFiles = payslipFiles.filter((_, i) => i !== currentFileIndex);
                          setPayslipFiles(newFiles);
                          if (newFiles.length > 0 && currentFileIndex >= newFiles.length) {
                            setCurrentFileIndex(newFiles.length - 1);
                          } else if (newFiles.length === 0) {
                            setCurrentFileIndex(0);
                            setImgScale(1); setImgPos({ x: 0, y: 0 }); setImgRotation(0); setImgFilter('none');
                          }
                        }} className="p-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded-lg ml-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                    <button onClick={() => setShowSplit(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-200 hover:text-white ml-2" title="Chiudi Visore"><X className="w-5 h-5" /></button>
                  </div>
                </div>
                {/* BODY DEL VISORE */}
                <div
                  ref={containerRef}
                  className={`flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center ${isSniperMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onMouseMove={handleMouseMove}
                >
                  {payslipFiles.length > 0 ? (
                    <div className="relative w-full h-full flex items-center justify-center">

                      {/* VISUALIZZATORE PDF / IMG */}
                      <object
                        data={payslipFiles[currentFileIndex]}
                        type="application/pdf"
                        className="w-full h-full rounded-none"
                        style={{
                          // IMPORTANTE: pointerEvents 'auto' permette lo scroll del PDF. 'none' solo se sei in modalità cecchino.
                          pointerEvents: isSniperMode ? 'none' : 'auto',
                          display: payslipFiles[currentFileIndex].endsWith('.pdf') || payslipFiles[currentFileIndex].startsWith('blob:') ? 'block' : 'none'
                        }}
                      >
                        {/* Fallback IMG (Solo se il PDF non va o è un'immagine) */}
                        <img
                          ref={imgRef}
                          src={payslipFiles[currentFileIndex]}
                          alt="Busta Paga"
                          draggable={false}
                          style={{
                            // QUI AGGIUNGIAMO LA ROTAZIONE
                            transform: `scale(${imgScale}) translate(${imgPos.x}px, ${imgPos.y}px) rotate(${imgRotation}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                            pointerEvents: 'auto', // Riabilita interazione img
                            // QUI AGGIUNGIAMO IL FILTRO BACCHETTA MAGICA
                            filter: imgFilter === 'contrast' ? 'contrast(150%) grayscale(100%)' : 'none'
                          }}
                          className={`max-w-full max-h-full object-contain select-none ${isSniperMode ? '' : 'cursor-grab active:cursor-grabbing'}`}
                        />
                      </object>
                      {/* IL ROBOTTINO FLUTTUANTE (Visibile solo se l'Auditor è chiuso e c'è un PDF) */}
                      {payslipFiles.length > 0 && !isExplainerOpen && (
                        <button
                          onClick={handleExplainPayslip}
                          className="absolute bottom-6 right-6 z-50 p-4 bg-slate-900 border border-slate-700 hover:border-fuchsia-500 rounded-full shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.6)] transition-all duration-300 group hover:-translate-y-1"
                        >
                          <Bot className="w-6 h-6 text-fuchsia-500 group-hover:text-fuchsia-400 group-hover:animate-pulse" />

                          {/* Tooltip nascosto che compare al passaggio del mouse */}
                          <span className="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                            Spiega questa Busta Paga
                          </span>
                        </button>
                      )}
                      {/* BOX CECCHINO */}
                      {isSniperMode && selectionBox && (
                        <div
                          style={{
                            position: 'absolute',
                            left: (selectionBox.x * imgScale) + imgPos.x,
                            top: (selectionBox.y * imgScale) + imgPos.y,
                            width: selectionBox.w * imgScale,
                            height: selectionBox.h * imgScale,
                            border: '2px solid #ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            pointerEvents: 'none',
                            zIndex: 50
                          }}
                        />
                      )}
                      {/* 👇 INCOLLA QUESTO: MESSAGGIO DISCRETO IN BASSO 👇 */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-5 py-2 rounded-full text-[10px] text-white/70 pointer-events-none border border-white/10 z-[60]">
                        {isSniperMode ? "DISEGNA UN RETTANGOLO SUL NUMERO" : "Trascina per spostare • Usa i tasti per lo zoom"}
                      </div>
                    </div>
                  ) : (
                    // AREA UPLOAD (RIPRISTINATO STILE RIQUADRO CENTRALE CON ANIMAZIONE)
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      // Aggiunto 'group' per gestire l'hover
                      className="group flex flex-col items-center justify-center text-slate-500 dark:text-slate-300 hover:text-indigo-400 transition-all cursor-pointer p-8 border-2 border-dashed border-slate-700 rounded-3xl hover:border-indigo-500 hover:bg-slate-900/50 w-64 h-64"
                    >
                      {/* Icona che rimbalza in hover */}
                      <div className="mb-4 p-4 bg-slate-900 rounded-full group-hover:scale-110 transition-transform duration-300 border border-slate-800 group-hover:border-indigo-500/30">
                        <Upload className="w-8 h-8 group-hover:-translate-y-1 transition-transform duration-500 ease-in-out" />
                      </div>
                      <p className="font-bold text-sm uppercase tracking-wider text-slate-400 dark:text-slate-200 group-hover:text-white transition-colors">Carica Buste Paga</p>
                      <p className="text-[10px] mt-2 opacity-50 dark:opacity-80 text-center px-4 group-hover:opacity-100 transition-opacity">
                        Trascina qui o clicca.<br />Supporta PDF, JPG, PNG (Max 12)
                      </p>
                      <p className="text-[10px] mt-1 opacity-40 pointer-events-none">Carica fino a 12 file insieme!</p>
                    </div>

                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>


        </div>
      </div>
      {/* --- HUD INTELLIGENZA ARTIFICIALE (Plasma & Supernova) --- */}
      <AnimatePresence mode="wait">
        {isBatchProcessing && !showSplit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: showSupernova ? 1.05 : 1, y: 0 }}
              transition={FRAMER_PHYSICS.smooth}
              className={`p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center max-w-sm w-full relative overflow-hidden border transition-all duration-500
                ${showSupernova ? 'bg-emerald-950 border-emerald-500 shadow-[0_0_150px_rgba(16,185,129,0.8)]' : 'bg-slate-900 border-slate-700 shadow-[0_0_120px_rgba(217,70,239,0.15)]'}`}
            >
              {/* FLASH SUPERNOVA (Bianco abbagliante che svanisce) */}
              <AnimatePresence mode="wait">
                {showSupernova && (
                  <motion.div
                    initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8 }}
                    className="absolute inset-0 bg-white z-50 pointer-events-none"
                  ></motion.div>
                )}
              </AnimatePresence>

              {/* Sfondo a griglia cybernetica */}
              <div className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:16px_16px] opacity-30 pointer-events-none`}></div>

              {/* REATTORE NEURALE */}
              <div className="relative w-36 h-36 mb-10 flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className={`absolute inset-0 border-t-[3px] border-r-[3px] border-transparent rounded-full ${showSupernova ? 'border-t-emerald-400 border-r-emerald-400/30' : 'border-t-fuchsia-400 border-r-fuchsia-400/30'}`}></motion.div>
                <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 5, ease: "linear" }} className={`absolute inset-3 border-b-[2px] border-l-[2px] border-transparent rounded-full ${showSupernova ? 'border-b-emerald-300 border-l-emerald-300/30' : 'border-b-violet-500 border-l-violet-500/30'}`}></motion.div>

                <motion.div animate={showSupernova ? { scale: [1, 2], opacity: [0.8, 0] } : { scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: showSupernova ? 0.8 : 1.5, repeat: showSupernova ? 0 : Infinity }} className={`absolute inset-8 rounded-full blur-xl ${showSupernova ? 'bg-emerald-400' : 'bg-fuchsia-500'}`}></motion.div>

                <div className={`relative z-10 p-5 rounded-2xl border transition-colors duration-500 ${showSupernova ? 'bg-emerald-900 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.5)]' : 'bg-slate-900 border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.2)]'}`}>
                  {showSupernova ? <CheckCircle2 className="w-12 h-12 text-emerald-400" /> : <Bot className="w-12 h-12 text-fuchsia-400" />}
                </div>

                {!showSupernova && (
                  <motion.div
                    animate={{ y: [-65, 65, -65] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-[2px] bg-fuchsia-300 shadow-[0_0_15px_#f0abfc,0_0_30px_#f0abfc] z-20"
                  ></motion.div>
                )}
              </div>

              {/* TESTI DINAMICI */}
              <h3 className={`font-black tracking-[0.3em] text-[10px] uppercase mb-3 relative z-10 flex items-center gap-2 ${showSupernova ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {showSupernova ? <CheckCircle className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                {showSupernova ? 'Elaborazione Conclusa' : 'Motore Neurale Attivo'}
              </h3>

              <p className="text-white font-medium text-xl text-center mb-8 relative z-10">
                Analisi busta paga <span className={`text-4xl font-black mx-1.5 ${showSupernova ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]'}`}>{batchProgress}</span> di <span className="text-2xl text-slate-400 dark:text-slate-200 mx-1.5">{batchTotal}</span>
              </p>

              {/* PROGRESS BAR */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 mb-3 overflow-hidden border border-slate-800 relative shadow-inner z-10 p-0.5">
                <motion.div
                  className={`h-full relative rounded-full ${showSupernova ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-fuchsia-300'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(batchProgress / Math.max(1, batchTotal)) * 100}%` }}
                  transition={{ ease: "circOut", duration: 0.3 }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-white rounded-full blur-[2px]"></div>
                </motion.div>
              </div>
              <p className={`text-[9px] uppercase tracking-[0.3em] font-black relative z-10 ${showSupernova ? 'text-emerald-400' : 'text-fuchsia-500/70 animate-pulse'}`}>
                {showSupernova ? 'Sincronizzazione dati...' : 'Estrazione Dati in corso...'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- HUD DELLO SCANNER SINGOLO (Tema Stealth / Ciano) --- */}
      {isAnalyzing && !showSplit && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
            transition={FRAMER_PHYSICS.smooth}
            className="p-10 rounded-[3rem] flex flex-col items-center relative overflow-hidden bg-slate-900 border border-cyan-500/20 shadow-[0_0_80px_rgba(6,182,212,0.15)]"
          >
            {/* Luce di fondo ciano */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none"></div>

            {/* Header Scanner */}
            <div className="flex items-center gap-3 mb-10 relative z-10">
              <ScanLine className="w-6 h-6 text-cyan-400" />
              <h3 className="font-black tracking-[0.3em] text-[12px] uppercase text-cyan-400">
                Sistema di Scansione Attivo
              </h3>
            </div>

            {/* L'ANIMAZIONE DELLO SCANNER */}
            <div className="relative w-40 h-48 flex items-center justify-center mb-8">
              {/* Mirino (Angoli) */}
              <div className="absolute inset-0 border-2 border-slate-700 rounded-xl" style={{ animation: 'bracket-pulse 2s ease-in-out infinite' }}></div>
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>

              {/* Il Documento al centro */}
              <FileText className="w-20 h-20 text-slate-500 dark:text-slate-300 opacity-50 dark:opacity-80" />

              {/* IL RAGGIO LASER */}
              <div className="absolute inset-0 overflow-hidden rounded-xl z-20">
                <div
                  className="absolute left-0 right-0 h-[2px] bg-cyan-400"
                  style={{ animation: 'single-scan-laser 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                >
                  {/* Sfumatura sotto al raggio */}
                  <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-t from-cyan-400/20 to-transparent -translate-y-full"></div>
                </div>
              </div>
            </div>

            {/* Testi dinaminici di attesa */}
            <p className="text-white font-medium text-lg text-center mb-2 relative z-10">
              Lettura OCR in corso...
            </p>

            <div className="flex items-center gap-2 relative z-10">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-200">
                Tempo stimato: ~20 secondi
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* --- TOAST NOTIFICATION (Premium Modern Style) --- */}
      <AnimatePresence mode="wait">
        {batchNotification && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={FRAMER_PHYSICS.smooth}
            className="fixed bottom-8 right-8 z-[250] flex flex-col gap-2"
          >
            <div className={`relative flex items-start gap-3 p-4 pr-12 w-80 rounded-2xl shadow-2xl backdrop-blur-2xl border border-white/10 overflow-hidden
              ${batchNotification.type === 'success' ? 'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]' :
                batchNotification.type === 'warning' ? 'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)]' :
                  'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(239,68,68,0.3)]'}`}>

              {/* Linea colorata laterale per indicare lo status */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 
                ${batchNotification.type === 'success' ? 'bg-emerald-500' :
                  batchNotification.type === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}
              ></div>

              {/* Effetto luce interna */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none"></div>

              {/* Icona di Status */}
              <div className={`mt-0.5 ml-2 shrink-0 ${batchNotification.type === 'success' ? 'text-emerald-400' :
                batchNotification.type === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                {batchNotification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {batchNotification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                {batchNotification.type === 'error' && <AlertCircle className="w-5 h-5" />}
              </div>

              {/* Testo del Toast */}
              <div className="flex-1 relative z-10">
                <h4 className="font-bold text-[13px] text-white tracking-wide mb-1">
                  {batchNotification.type === 'success' ? 'Completato' :
                    batchNotification.type === 'warning' ? 'Attenzione' : 'Errore'}
                </h4>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                  {batchNotification.msg}
                </p>
              </div>

              {/* Tasto Chiudi */}
              <button
                onClick={() => setBatchNotification(null)}
                className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-slate-400 dark:text-slate-200 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
        {/* MODALE QR CODE SCANNER */}
        <QRScannerModal
          key="qr-scanner-modal"
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          onScanSuccess={handleQRData}
          company={worker.profilo || 'RFI'}
          workerName={`${worker.cognome} ${worker.nome}`}
          eliorType={worker.eliorType} // <--- AGGIUNGI QUESTA!
        // RIMOSSA LA RIGA customColumns CHE FACEVA ESPLODERE IL QR!
        />
        <IstatDashboardModal
          isOpen={isIstatModalOpen}
          onClose={() => setIsIstatModalOpen(false)}
          worker={worker}
          monthlyInputs={monthlyInputs}
          startClaimYear={startClaimYear}
          includeExFest={includeExFest}
          includeTickets={includeTickets}
        />
        {/* --- ✨ MODALE AI RADAR TFR (Vero Pop-up a schermo intero) --- */}
        <AnimatePresence mode="wait">
          {isAiTfrModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsAiTfrModalOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={FRAMER_PHYSICS.smooth}
                className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] shadow-[0_0_80px_rgba(99,102,241,0.2)] border border-slate-700 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-[60px] pointer-events-none"></div>

                <div className="relative px-8 pt-8 pb-4 text-center">
                  <div className="w-16 h-16 mx-auto bg-slate-950 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4 relative group">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-400 opacity-20 animate-ping"></div>
                    <Wallet className="w-8 h-8 text-indigo-400 relative z-10" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">TFR Storico Rilevato!</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-200 mt-2 font-medium">L'Intelligenza Artificiale ha letto questi dati dal documento. Vuoi impostarli come base di calcolo?</p>
                </div>

                <div className="px-8 pb-8 space-y-5 relative z-10">
                  {/* Classe hide-arrows centralizzata in index.css */}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest pl-1">Importo Trovato</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-indigo-400 font-black text-lg">€</span>
                      </div>
                      <input
                        type="number" value={aiTfrAmount} onChange={(e) => setAiTfrAmount(e.target.value)}
                        className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest pl-1">Anno di riferimento</label>
                    <div className="relative group">
                      <input
                        type="number" value={aiTfrYear} onChange={(e) => setAiTfrYear(e.target.value)}
                        className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 px-4 text-center focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={handleIgnoreAiTfr} className="flex-1 py-4 rounded-xl font-bold text-sm text-slate-400 dark:text-slate-200 bg-slate-800/50 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700">Ignora</button>
                    <button onClick={handleSaveAiTfr} className="flex-[2] py-4 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Save size={18} /> CONFERMA
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AnimatePresence>
      {/* --- INFO MODAL (TICKER) --- */}
      <AnimatePresence mode="wait">
        {activeTickerModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setActiveTickerModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={FRAMER_PHYSICS.smooth}
              // Ingrandito da max-w-sm a max-w-lg per far respirare il testo
              className="relative w-full max-w-lg bg-slate-900 rounded-[2rem] shadow-[0_0_60px_rgba(79,70,229,0.3)] border border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Linea colorata decorativa in alto */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  {/* Icona "i" stilizzata */}
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl border border-slate-700 text-indigo-400 flex items-center justify-center font-serif text-2xl font-black italic shadow-inner">
                    i
                  </div>
                  <button onClick={() => setActiveTickerModal(null)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 dark:text-slate-200 hover:text-white rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-xl font-black text-white tracking-tight mb-4 uppercase">
                  {activeTickerModal.title}
                </h3>

                {/* Qui stampiamo il ReactNode (HTML/JSX) che abbiamo scritto nelle cards */}
                <div className="text-left">
                  {activeTickerModal.content}
                </div>
              </div>

              <div className="p-5 bg-slate-950 border-t border-slate-800 text-center">
                <button onClick={() => setActiveTickerModal(null)} className="w-full py-3.5 rounded-xl font-black tracking-wide text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors active:scale-95 shadow-lg shadow-indigo-600/20">
                  HO CAPITO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div >
  );
};

export default WorkerDetailPage   