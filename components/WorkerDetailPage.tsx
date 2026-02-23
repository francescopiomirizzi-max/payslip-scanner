import React, { useState, useMemo, useRef, useEffect } from 'react';
import MonthlyDataGrid from './WorkerTables/MonthlyDataGrid';
import AnnualCalculationTable from './WorkerTables/AnnualCalculationTable';
import IndemnityPivotTable from './WorkerTables/IndemnityPivotTable';
import TableComponent from './TableComponent'; // Assicurati che il percorso sia corretto
// Import necessario per i calcoli della stampa
import QRScannerModal from '../components/QRScannerModal';
import { Worker, AnnoDati, parseFloatSafe, getColumnsByProfile, MONTH_NAMES, formatCurrency, YEARS } from '../types';
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
  Bot,    // <--- AGGIUNTO QUI
  Cpu   // <--- AGGIUNTA
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// IMPORTANTE: Tesseract per il ritaglio (Canvas)
import Tesseract from 'tesseract.js';

// LIBRERIE PDF NATIVE
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- STILI CSS AVANZATI (AGGIUNTI PER EFFETTI TOP TIER) ---
const GLOBAL_STYLES = `
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob {
    animation: blob 7s infinite;
  }
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  .animation-delay-4000 {
    animation-delay: 4s;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .animate-shimmer {
    background-size: 200% auto;
    animation: shimmer 4s linear infinite;
}
@keyframes aurora {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .animate-aurora {
    background-size: 200% 200%;
    animation: aurora 3s ease infinite;
  }
  
  /* Glassmorphism 2.0 */
  .glass-panel {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
  }
/* Nasconde la barra di scorrimento mantenendo lo scroll attivo */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE e Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;

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
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[120px] mix-blend-multiply animate-blob"></div>
    <div className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] bg-emerald-400/20 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
  </div>
);
// --- COMPONENTE CALCOLATRICE FLUTTUANTE (Spostabile e con Fix Tastiera) ---
const FloatingCalculator = ({ onClose }: { onClose: () => void }) => {
  const [display, setDisplay] = useState('');

  const handleInput = (val: string) => setDisplay(prev => prev + val);
  const handleClear = () => setDisplay('');

  const handleCalc = () => {
    if (!display) return; // Se è vuoto, non fa nulla ed evita "undefined"
    try {
      const result = eval(display.replace(/,/g, '.'));
      setDisplay(result !== undefined ? String(result) : '');
    }
    catch { setDisplay('Errore'); setTimeout(() => setDisplay(''), 1000); }
  };

  // Listener Tastiera
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // Cattura l'invio e blocca l'evento per non far cliccare bottoni in background
      if (key === 'Enter' || key === '=') {
        e.preventDefault();
        e.stopPropagation();
        handleCalc();
        return;
      }

      if (/[0-9+\-*/.]/.test(key)) {
        e.preventDefault(); // Evita scroll della pagina se premi + o -
        handleInput(key);
        return;
      }

      if (key === 'Backspace') setDisplay(prev => prev.slice(0, -1));
      if (key === 'Escape') onClose();
      if (key === 'Delete' || key === 'c' || key === 'C') handleClear();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, onClose]); // <--- IL FIX E' QUI: Aggiorna la memoria a ogni tasto premuto

  const btnClass = "h-12 rounded-lg font-bold text-lg transition-all active:scale-95 flex items-center justify-center shadow-sm";

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed bottom-24 right-8 z-[100] w-64 bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl overflow-hidden text-white"
    >
      {/* HEADER con cursore di spostamento */}
      <div className="p-3 bg-slate-800/50 flex justify-between items-center border-b border-white/10 cursor-move">
        <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Calculator className="w-3 h-3" /> Calc</span>
        {/* Stop Propagation per evitare di trascinare quando si clicca X */}
        <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
      </div>

      <div className="p-4 bg-transparent text-right text-2xl font-mono font-bold tracking-wider overflow-hidden h-16 flex items-center justify-end break-all">
        {display || '0'}
      </div>
      <div className="grid grid-cols-4 gap-1 p-2 bg-white/5">
        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
          <button key={btn} onClick={() => {
            if (btn === '=') handleCalc();
            else if (btn === 'C') handleClear();
            else handleInput(btn);
          }} className={`${btnClass} ${btn === '=' ? 'bg-emerald-500 hover:bg-emerald-400' : btn === 'C' ? 'text-red-400 hover:bg-white/10' : ['/', '*', '-', '+'].includes(btn) ? 'text-indigo-400 hover:bg-white/10' : 'hover:bg-white/10'}`}>
            {btn}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
const WorkerDetailPage: React.FC<WorkerDetailPageProps> = ({ worker, onUpdateData, onUpdateStatus, onBack, onOpenReport }) => {
  const [monthlyInputs, setMonthlyInputs] = useState<AnnoDati[]>(Array.isArray(worker?.anni) ? worker.anni : []);
  const [activeTab, setActiveTab] = useState<'input' | 'calc' | 'pivot'>('input');
  const [currentYear, setCurrentYear] = useState(2024);
  // --- STATO CONFIGURAZIONE CAUSA ---
  // Legge o imposta l'anno di inizio calcoli (Default al primo anno trovato + 1, o 2008)
  const [startClaimYear, setStartClaimYear] = useState<number>(() => {
    const saved = localStorage.getItem(`startYear_${worker.id}`);
    return saved ? parseInt(saved) : 2008; // Default 2008 come da fogli
  });
  // Stato per mostrare/nascondere il report ufficiale
  const [showReport, setShowReport] = useState(false);
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
  const [showDealMaker, setShowDealMaker] = useState(false);
  const [showCalc, setShowCalc] = useState(false); // Stato Calcolatrice
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
  // --- STATI DEAL MAKER 2.0 (STRATEGIA LEGALE) ---
  const [isNetMode, setIsNetMode] = useState(false); // Toggle Lordo/Netto
  const [winProb, setWinProb] = useState(90); // Probabilità vittoria (Default 90% per Cassazione 20216)
  const [legalCosts, setLegalCosts] = useState(1500); // Costi stimati (CTU + Spese)
  const [yearsDuration, setYearsDuration] = useState(3); // Durata causa (anni)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // --- STATO BATCH UPLOAD ---
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
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

  // --- FUNZIONE CHE RICEVE I DATI DAL TELEFONO (ANTI-SOVRASCRITTURA) ---
  const handleQRData = (aiResult: any) => {

    // Usiamo prevInputs per pescare sempre i dati in tempo reale senza chiusure
    setMonthlyInputs((prevInputs) => {
      let currentAnni = JSON.parse(JSON.stringify(prevInputs));

      if (aiResult.month && aiResult.year) {
        const targetYear = Number(aiResult.year);
        const targetMonthIndex = Number(aiResult.month) - 1;

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

        if (typeof aiResult.daysWorked === 'number') row.daysWorked = aiResult.daysWorked;
        if (typeof aiResult.daysVacation === 'number') row.daysVacation = aiResult.daysVacation;

        const ticketVal = Number(aiResult.ticketRate);
        if (!isNaN(ticketVal) && ticketVal > 0) row.coeffTicket = ticketVal;

        const arretratiVal = Number(aiResult.arretrati);
        if (!isNaN(arretratiVal) && arretratiVal !== 0) row.arretrati = arretratiVal;

        if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote)) {
          row.note = (row.note ? row.note + ' ' : '') + `[${aiResult.eventNote}]`;
        }

        if (aiResult.codes) {
          Object.entries(aiResult.codes).forEach(([code, value]) => {
            const numValue = parseFloat(value as string);
            if (!isNaN(numValue) && numValue !== 0) {
              // @ts-ignore
              row[code] = numValue;
            }
          });
        }

        currentAnni[rowIndex] = row;
        currentAnni.sort((a: any, b: any) => (a.year - b.year) || (a.monthIndex - b.monthIndex));

        // Aggiorniamo le info esterne senza rompere il ciclo di React
        setTimeout(() => {
          onUpdateData(currentAnni);
          setCurrentYear(targetYear);
          setBatchNotification({ msg: `✅ Busta ${aiResult.month}/${aiResult.year} caricata!`, type: 'success' });
          setTimeout(() => setBatchNotification(null), 4000);
        }, 0);

        return currentAnni;
      }
      return prevInputs;
    });
  };
  // --- 🔥 2. LOGICA UPLOAD MASSIVO OTTIMIZZATA (Sostituisci handleBatchUpload) ---
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBatchProcessing(true);
    setBatchNotification(null);

    // 👉 1. IMPOSTA IL TOTALE DEI FILE (Es. 12)
    setBatchTotal(files.length);
    setBatchProgress(0);

    // Copia profonda per evitare mutazioni dirette
    let currentAnni = JSON.parse(JSON.stringify(monthlyInputs));
    let successCount = 0;
    let errorCount = 0;
    let lastDetectedYear = null;

    for (let i = 0; i < files.length; i++) {
      // 👉 2. AGGIORNA IL NUMERO AD OGNI BUSTA PROCESSATA
      setBatchProgress(i + 1);

      const file = files[i];
      try {
        const base64String = await toBase64(file);

        // Chiamata al NUOVO Backend V15/V16
        const response = await fetch('/.netlify/functions/scan-payslip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64String,
            mimeType: file.type || "application/pdf"
          })
        });

        const aiResult = await response.json();

        if (!response.ok || aiResult.error) {
          console.error(`Errore file ${file.name}`, aiResult.error);
          errorCount++;
          continue;
        }

        // Validazione Dati Minimi
        if (aiResult.month && aiResult.year) {
          const targetYear = Number(aiResult.year);
          const targetMonthIndex = Number(aiResult.month) - 1;

          lastDetectedYear = targetYear;

          // A. CERCA RIGA ESISTENTE
          let rowIndex = currentAnni.findIndex((r: AnnoDati) =>
            Number(r.year) === targetYear && r.monthIndex === targetMonthIndex
          );

          // B. CREA SE NON ESISTE
          if (rowIndex === -1) {
            const newRow: AnnoDati = {
              id: Date.now().toString() + Math.random(), // ID unico
              year: targetYear,
              monthIndex: targetMonthIndex,
              month: MONTH_NAMES[targetMonthIndex],
              daysWorked: 0,
              daysVacation: 0,
              ticket: 0,
              arretrati: 0,
              note: '',
              coeffTicket: 0,    // Importante inizializzare
              coeffPercepito: 0  // Importante inizializzare
            };
            currentAnni.push(newRow);
            // Aggiorniamo l'indice per puntare alla nuova riga
            rowIndex = currentAnni.length - 1;
          }

          const row = currentAnni[rowIndex];

          // --- C. MAPPING DATI "CHIRURGICO" (NUOVA LOGICA) ---

          // 1. PRESENZE & FERIE (Sovrascrivi sempre con il dato OCR più recente)
          if (typeof aiResult.daysWorked === 'number') row.daysWorked = aiResult.daysWorked;
          if (typeof aiResult.daysVacation === 'number') row.daysVacation = aiResult.daysVacation;

          // 2. TICKET UNITARIO (La tua richiesta specifica)
          // Se il backend trova "ticketRate" (es. 7.00), lo mettiamo nel coefficiente
          const ticketVal = Number(aiResult.ticketRate);
          if (!isNaN(ticketVal) && ticketVal > 0) {
            row.coeffTicket = ticketVal; // <--- Assegnazione diretta al coefficiente
          }

          // 3. ARRETRATI E NOTE
          const arretratiVal = Number(aiResult.arretrati);
          if (!isNaN(arretratiVal) && arretratiVal !== 0) {
            row.arretrati = arretratiVal;
          }

          // Definiamo un separatore largo e pulito per non appiccicare i testi
          const sep = '  •  ';

          // A. Aggiunta Note Eventi (es. "Malattia")
          if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote)) {
            row.note = row.note ? `${row.note}${sep}[${aiResult.eventNote}]` : `[${aiResult.eventNote}]`;
          }

          // B. Aggiunta AUDITOR AI WARNING 
          if (aiResult.aiWarning && aiResult.aiWarning !== "Nessuna anomalia" && !row.note?.includes("⚠️")) {
            row.note = row.note ? `${row.note}${sep}[⚠️ AI: ${aiResult.aiWarning}]` : `[⚠️ AI: ${aiResult.aiWarning}]`;
          }

          // C. Aggiunta Valore Ticket visivo
          const ticketValNote = Number(aiResult.ticketRate);
          if (!isNaN(ticketValNote) && ticketValNote > 0 && !row.note?.includes("Ticket")) {
            row.note = row.note ? `${row.note}${sep}[🎫 Ticket: €${ticketValNote.toFixed(2)}]` : `[🎫 Ticket: €${ticketValNote.toFixed(2)}]`;
          }

          // 4. VOCI VARIABILI (Codici)
          // Mappiamo l'oggetto "codes" restituito dal backend alle colonne della griglia
          if (aiResult.codes && typeof aiResult.codes === 'object') {
            Object.entries(aiResult.codes).forEach(([code, value]) => {
              const numValue = parseFloat(value as string);
              if (!isNaN(numValue) && numValue !== 0) {
                // Sovrascrittura: Se l'OCR dice 150€, scriviamo 150€.
                // @ts-ignore
                row[code] = numValue;
              }
            });
          }

          currentAnni[rowIndex] = row;
          successCount++;
        }
      } catch (error) {
        console.error("Errore generico batch", error);
        errorCount++;
      }
    }

    // 3. ORDINAMENTO E SALVATAGGIO
    currentAnni.sort((a: AnnoDati, b: AnnoDati) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    });

    setMonthlyInputs(currentAnni);
    onUpdateData(currentAnni);

    if (lastDetectedYear) setCurrentYear(lastDetectedYear);

    // --- EFFETTO SUPERNOVA ---
    if (successCount > 0) {
      setShowSupernova(true);
      await new Promise(resolve => setTimeout(resolve, 800)); // Pausa scenica
    }

    setIsBatchProcessing(false);
    setShowSupernova(false);

    // 👉 3. AZZERA I CONTATORI SOLO QUANDO L'HUD È CHIUSO
    setTimeout(() => {
      setBatchProgress(0);
      setBatchTotal(0);
    }, 300);

    if (batchInputRef.current) batchInputRef.current.value = '';

    // Notifica Intelligente
    if (successCount > 0) {
      setBatchNotification({
        msg: `✅ Elaborazione Completata!\n${successCount} cedolini inseriti correttamente.\n${errorCount > 0 ? `⚠️ ${errorCount} errori.` : ''}`,
        type: 'success'
      });
    } else if (errorCount > 0) {
      setBatchNotification({
        msg: `❌ Operazione fallita.\nNessun cedolino valido trovato su ${files.length} file.`,
        type: 'error'
      });
    }

    setTimeout(() => setBatchNotification(null), 6000);
  };
  const handleDataChange = (newData: AnnoDati[]) => {
    setMonthlyInputs(newData);
    onUpdateData(newData);
  };

  // --- GESTIONE CELLA ATTIVA ---
  const handleCellFocus = (rowIndex: number, colId: string) => {
    setActiveCell({ row: rowIndex, col: colId });
  };
  // --- HELPER BASE64 ---
  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
  // --- 🔥 3. FUNZIONE SINGOLA (WRAPPER) ---
  // Reindirizza il file singolo alla logica Batch che è già perfetta e aggiornata
  const handleAnalyzePaySlip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // 1. Accendiamo la rotellina di caricamento del bottone
      setIsAnalyzing(true);

      // 2. Eseguiamo il caricamento
      await handleBatchUpload(event);

      // 3. Spegniamo la rotellina e resettiamo l'input (così puoi ricaricare lo stesso file se serve)
      setIsAnalyzing(false);
      if (scanRef.current) scanRef.current.value = '';
    }
  };
  // --- 🔥 1. PARSER ROBUSTO (Sostituisci quello esistente) ---
  const parseLocalFloat = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;

    let str = val.toString();
    // Logica Ibrida: Se c'è la virgola, è input utente (ITA).
    if (str.includes(',')) {
      str = str.replace(/\./g, ''); // Via i punti migliaia (1.000 -> 1000)
      str = str.replace(',', '.');  // Virgola diventa punto (1000,50 -> 1000.50)
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };
  // --- FUNZIONE CERVELLO CORRETTA (Logica Anno Precedente + Filtro Anno Inizio) ---
  const calculateAnnualLegalData = (data: AnnoDati[], profile: any, withExFest: boolean, startClaimYear: number) => {
    const years = Array.from(new Set(data.map(d => Number(d.year)))).sort((a, b) => a - b);

    const indennitaCols = getColumnsByProfile(profile).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
    );

    // 1. PASSO PRELIMINARE: Calcoliamo le medie giornaliere per OGNI anno disponibile (anche il 2007)
    const yearlyAverages: Record<number, number> = {};

    years.forEach(year => {
      const monthsInYear = data.filter(d => Number(d.year) === year);
      let totIndennitaAnno = 0;
      let totGiorniLavoratiAnno = 0;

      monthsInYear.forEach(m => {
        let totMese = 0;
        indennitaCols.forEach(col => { totMese += parseLocalFloat(m[col.id]); });

        totIndennitaAnno += totMese;
        totGiorniLavoratiAnno += parseLocalFloat(m.daysWorked);
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

  // --- PUNTO 2: DEAL MAKER STRATEGICO (AGGIORNATO CON FILTRO ANNI) ---
  const dealStats = useMemo(() => {
    // 1. Passiamo startClaimYear alla funzione di calcolo
    const { globalLordo, globalTicket } = calculateAnnualLegalData(monthlyInputs, worker.profilo, includeExFest, startClaimYear);

    // 2. Calcolo Percepito da detrarre (solo su gg utili e ANNI VALIDI)
    const TETTO = includeExFest ? 32 : 28;
    let totalPercepito = 0;

    const years = Array.from(new Set(monthlyInputs.map(d => Number(d.year))));
    years.forEach(year => {
      // --- FILTRO: Se l'anno è precedente all'inizio della vertenza, lo ignoriamo ---
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

    // IL CREDITO LORDO (Base della causa)
    const grossClaim = (globalLordo - totalPercepito) + globalTicket;

    // --- SIMULAZIONE SCENARI ---

    // A. Tassazione (Stimata al 23% medio per arretrati anni precedenti)
    const TAX_RATE = 0.23;
    const netClaim = grossClaim * (1 - TAX_RATE);

    // B. Valore Atteso dalla Causa (Expected Value)
    const baseValue = isNetMode ? netClaim : grossClaim;
    const courtExpectedValue = (baseValue * (winProb / 100)) - legalCosts;

    // C. Valore del Tempo
    const inflationFactor = Math.pow(1.03, yearsDuration);
    const courtRealValue = courtExpectedValue / inflationFactor;

    return {
      netDifference: grossClaim,
      grossClaim: grossClaim > 0 ? grossClaim : 0,
      netClaim: netClaim > 0 ? netClaim : 0,
      courtRealValue: courtRealValue > 0 ? courtRealValue : 0,
      displayTarget: isNetMode ? netClaim : grossClaim
    };
  }, [monthlyInputs, worker.profilo, includeExFest, isNetMode, winProb, legalCosts, yearsDuration, startClaimYear]); // <--- Aggiunto startClaimYear qui!

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

    const indennitaCols = getColumnsByProfile(worker.profilo).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
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

    let ferieCumulateCounter = 0;

    // --- B. COSTRUZIONE DATI TABELLA 1 (RIEPILOGO) ---
    yearsToPrint.forEach((yearVal) => {
      const year = Number(yearVal);

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

          // 🔥 MODIFICA CHIRURGICA: Inseriamo il Codice tra parentesi quadre nella chiave della Pivot
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
      doc.text(`Pratica: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, pageWidth - 14, 12, { align: 'right' });

      doc.setFontSize(7); doc.setTextColor(100);
      const note = "Calcolo elaborato ai sensi Cass. n. 20216/2022 e Art. 64 CCNL Mobilità. La media giornaliera è calcolata sul totale delle voci variabili diviso i giorni di effettiva presenza. Limite giorni indennizzabili: 28.";
      doc.text(note, 14, pageHeight - 10);
      const str = "Pagina " + doc.getNumberOfPages();
      doc.text(str, pageWidth - 14, pageHeight - 10, { align: 'right' });
    };

    let currentY = 30;

    // --- TABELLA 1 ---
    doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("1. CALCOLO DIFFERENZE PER ANNO (Applicazione Sent. Cass. 20216/2022)", 14, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['ANNO', 'TOT. VARIABILI', 'GG LAV.', 'MEDIA UTILIZZATA', 'GG FERIE / TOT', 'DIFF. LORDA', 'TICKET', 'NETTO DOVUTO']],
      body: yearlyRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: 50, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: [23, 37, 84], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252] },
        3: { fontStyle: 'bold', textColor: [180, 83, 9] },
        7: { fontStyle: 'bold', halign: 'right', fillColor: [220, 252, 231], textColor: [21, 128, 61] }
      },
      bodyStyles: { halign: 'right' },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 3;

    // NOTA A PIE DI TABELLA 1 (Spiegazione Asterisco e GG Ferie)
    doc.setFontSize(8); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
    doc.text(`* La dicitura "GG FERIE / TOT" indica i giorni effettivamente conteggiati ai fini del calcolo rispetto a quelli goduti. In caso di superamento del limite legale (${TETTO}gg annui), l'eccedenza è stata esclusa dal conteggio economico.`, 14, currentY);
    currentY += 12;

    // --- TABELLA 2 (IL VERO PROBLEMA RISOLTO) ---
    // @ts-ignore
    if (currentY > 150) { doc.addPage(); currentY = 30; }

    doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("2. RIEPILOGO VOCI VARIABILI DELLA RETRIBUZIONE", 14, currentY);

    const pivotHead = ['CODICE E VOCE', ...yearsToPrint.map(String), 'TOTALE'];
    const pivotBody = Object.keys(pivotData).sort().map(key => {
      let rowTotal = 0;
      // Tagliamo leggermente la label per farci stare il codice (es. "[0152] Straord...")
      const shortKey = key.length > 25 ? key.substring(0, 23) + '..' : key;
      const row = [shortKey];

      yearsToPrint.forEach(yearVal => {
        const year = Number(yearVal);
        const val = pivotData[key][year] || 0;
        rowTotal += val;
        row.push(fmt(val));
      });
      row.push(fmt(rowTotal));
      return row;
    });

    autoTable(doc, {
      startY: currentY + 5,
      head: [pivotHead],
      body: pivotBody,
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.5,
        textColor: 50
      },
      headStyles: {
        fillColor: [234, 88, 12],
        textColor: 255,
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold'
      },
      bodyStyles: { halign: 'right', valign: 'middle' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } // Allargato leggermente per il codice
      },
      // MAGIA: Forza le colonne numeriche a non andare a capo + Evidenzia Colonna Totali
      didParseCell: function (data) {
        if (data.column.index > 0) {
          data.cell.styles.cellWidth = 'wrap';
          data.cell.styles.minCellWidth = 14;
        }
        // Evidenzia visivamente l'ultima colonna (Il Totale Finale a destra)
        if (data.section === 'body' && data.column.index === pivotHead.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 10, right: 10 }
    });

    // --- TABELLA 3 (DETTAGLIO MENSILE) ---
    doc.addPage();
    currentY = 30;
    doc.setFontSize(12); doc.setTextColor(23, 37, 84);
    doc.text("3. DETTAGLIO MENSILE ANALITICO", 14, currentY);

    let monthlyFerieCounter = 0;

    yearsToPrint.forEach(yearVal => {
      const year = Number(yearVal);
      // @ts-ignore
      if (currentY > 160) { doc.addPage(); currentY = 30; }

      let media = yearlyAverages[year - 1];
      if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`ANNO ${year} (Media: ${fmt(media)})`, 14, currentY + 8);

      const yearRows = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      // 🔥 MODIFICA CHIRURGICA: Codice al primo rigo, descrizione al secondo. Cambiato GG UTILI in GG FERIE
      const tableHead = [
        'MESE',
        ...indennitaCols.map(c => `${c.id}\n${c.label.substring(0, 8)}.`),
        'GG LAV', 'GG FERIE', 'LORDO'
      ];
      if (showPercepito) tableHead.push('GIA\' PERC.');
      if (includeTickets) tableHead.push('TICKET');
      tableHead.push('NETTO');

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

        rowData.push(ggLav > 0 ? String(ggLav) : '');
        // Mantiene l'asterisco per i mesi in cui interviene il taglio
        rowData.push(gu !== vac ? `${fmtInt(gu)}*` : fmtInt(gu));
        rowData.push(fmt(rLordo));

        if (showPercepito) rowData.push(fmt(rPercepito));
        if (includeTickets) rowData.push(fmt(rTicket));

        rowData.push(fmt(rNetto));

        return rowData;
      });

      autoTable(doc, {
        startY: currentY + 12,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'right', lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] }, // 🔥 ZEBRA STRIPING per leggibilità orizzontale!
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 12, fillColor: [241, 245, 249] },
          [tableHead.length - 1]: { fontStyle: 'bold', fillColor: [240, 253, 250], textColor: [21, 128, 61] }
        },
        didDrawPage: drawHeaderFooter,
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 10;
    });

    // --- PAGINA 4: RIEPILOGO FINALE ---
    doc.addPage();
    drawHeaderFooter(null);
    currentY = 40;

    doc.setFontSize(16); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("RIEPILOGO FINALE DEI CREDITI", 105, currentY, { align: 'center' });
    currentY += 20;

    const printRow = (label: string, value: string, isTotal = false) => {
      doc.setFontSize(isTotal ? 14 : 12);
      if (isTotal) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(50, 50, 50);

      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');

      doc.text(label, 40, currentY);
      doc.text(value, 170, currentY, { align: 'right' });
      doc.setDrawColor(200); doc.setLineWidth(0.1);
      doc.line(40, currentY + 2, 170, currentY + 2);
      currentY += 12;
    };

    let recalcPercepitoTotal = 0;
    let tempFerie = 0;

    const allSorted = [...monthlyInputs].sort((a, b) => {
      return (Number(a.year) - Number(b.year)) || (a.monthIndex - b.monthIndex);
    });

    allSorted.forEach(row => {
      if (Number(row.year) < startClaimYear) return;

      const v = parseLocalFloat(row.daysVacation);
      const s = Math.max(0, TETTO - tempFerie);
      const gu = Math.min(v, s);
      tempFerie += v;
      if (gu > 0) recalcPercepitoTotal += (gu * parseLocalFloat(row.coeffPercepito));
    });

    printRow("Totale Lordo Spettante", fmt(grandTotalLordo));

    if (showPercepito) {
      printRow("Totale Già Percepito (Voce Busta)", fmt(recalcPercepitoTotal));
    }

    if (includeTickets) {
      printRow("Totale Buoni Pasto Maturati", fmt(grandTotalTicket));
    }

    currentY += 5;
    const veroNettoDaStampare = (grandTotalLordo - (showPercepito ? recalcPercepitoTotal : 0)) + (includeTickets ? grandTotalTicket : 0);
    printRow("TOTALE NETTO DA LIQUIDARE", fmt(veroNettoDaStampare), true);

    currentY += 20;
    doc.setFontSize(9); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
    doc.text("Il presente conteggio ha valore di perizia tecnica di parte. I calcoli sono basati sui dati inseriti e sulla giurisprudenza corrente.", 105, currentY, { align: 'center', maxWidth: 150 });

    if (typeof doc.putTotalPages === 'function') { doc.putTotalPages(totalPagesExp); }
    doc.save(`Scheda_Lavorazione_${worker.cognome}_${worker.nome}.pdf`);
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
    onUpdateData(newData);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file: any) => URL.createObjectURL(file as Blob));
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
      const newFiles = Array.from(e.dataTransfer.files).map((file: any) => URL.createObjectURL(file));
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
          company: worker.profilo
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
  // --- 🔥 MODIFICA 2: CALCOLO STATISTICHE ALLINEATO AL PDF ---
  const globalStats = useMemo(() => {
    if (!monthlyInputs || !Array.isArray(monthlyInputs)) return [];

    // Filtriamo solo le colonne che sono indennità (escludendo giorni, ticket, ecc)
    const indennitaCols = getColumnsByProfile(worker.profilo).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
    );

    // 1. PRE-CALCOLO MEDIE (Cervello)
    const yearlyRawStats: Record<number, { totVar: number; ggLav: number }> = {};

    monthlyInputs.forEach(row => {
      const y = Number(row.year);
      if (!yearlyRawStats[y]) yearlyRawStats[y] = { totVar: 0, ggLav: 0 };

      const ggLav = parseLocalFloat(row.daysWorked);

      if (ggLav > 0) {
        let sommaIndennitaRow = 0;
        indennitaCols.forEach(c => {
          sommaIndennitaRow += parseLocalFloat(row[c.id]);
        });
        yearlyRawStats[y].totVar += sommaIndennitaRow;
        yearlyRawStats[y].ggLav += ggLav;
      }
    });

    const yearlyAverages: Record<number, number> = {};
    Object.keys(yearlyRawStats).forEach(k => {
      const y = Number(k);
      const t = yearlyRawStats[y];
      yearlyAverages[y] = t.ggLav > 0 ? t.totVar / t.ggLav : 0;
    });

    // 2. CALCOLO SPETTANZE FINALI
    let totLordoSpettante = 0;
    let totTicket = 0;
    let totGiaPercepito = 0;

    const TETTO = includeExFest ? 32 : 28;
    const availableYears = Array.from(new Set(monthlyInputs.map(d => Number(d.year)))).sort((a, b) => a - b);

    availableYears.forEach(year => {
      // --- FILTRO: Se l'anno è precedente all'inizio impostato, lo ignoriamo nei totali ---
      if (year < startClaimYear) return;

      let ferieCumulateAnno = 0;

      // Logica Media: Anno Precedente (Fallback su corrente se manca)
      let mediaDaUsare = yearlyAverages[year - 1];
      if (mediaDaUsare === undefined || mediaDaUsare === 0) {
        mediaDaUsare = yearlyAverages[year] || 0;
      }

      const monthsInYear = monthlyInputs
        .filter(d => Number(d.year) === year)
        .sort((a, b) => a.monthIndex - b.monthIndex);

      monthsInYear.forEach(row => {
        const vacDays = parseLocalFloat(row.daysVacation);
        const coeffTicket = parseLocalFloat(row.coeffTicket);
        const coeffPercepito = parseLocalFloat(row.coeffPercepito);

        // Saturazione Tetto
        const spazio = Math.max(0, TETTO - ferieCumulateAnno);
        const giorniUtili = Math.min(vacDays, spazio);
        ferieCumulateAnno += vacDays;

        if (giorniUtili > 0) {
          totLordoSpettante += (giorniUtili * mediaDaUsare);
          totGiaPercepito += (giorniUtili * coeffPercepito);

          if (includeTickets) {
            totTicket += (giorniUtili * coeffTicket);
          }
        }
      });
    });

    const differenzaRetributiva = totLordoSpettante - totGiaPercepito;
    const nettoRecuperabile = differenzaRetributiva + totTicket;

    return [
      {
        label: "TOTALE DA LIQUIDARE",
        value: formatCurrency(nettoRecuperabile),
        icon: Wallet,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        note: `Diff. Retr. (${formatCurrency(differenzaRetributiva)}) + Ticket`
      },
      {
        label: "LORDO SPETTANTE",
        value: formatCurrency(totLordoSpettante),
        icon: TrendingUp,
        color: "text-blue-600 bg-blue-50 border-blue-200",
        note: "Basato su media annuale"
      },
      {
        label: "GIÀ PERCEPITO",
        value: formatCurrency(totGiaPercepito),
        icon: CheckCircle2,
        color: "text-orange-600 bg-orange-50 border-orange-200",
        note: "Importo già erogato"
      },
      {
        label: "TOTALE BUONI PASTO",
        value: formatCurrency(totTicket),
        icon: Ticket,
        color: "text-indigo-600 bg-indigo-50 border-indigo-200",
        note: "Indennità sostitutiva"
      },
    ];
  }, [monthlyInputs, worker.profilo, includeExFest, includeTickets, startClaimYear]);
  const tickerItems = [...globalStats, ...globalStats, ...globalStats];
  // COMPONENTE TIMELINE (Semaforo Style)
  const TimelineStep = ({ step, label, icon: Icon, activeStatus }: any) => {
    const steps = ['analisi', 'pronta', 'inviata', 'trattativa', 'chiusa'];
    const isActive = step === activeStatus;
    const isPast = steps.indexOf(activeStatus) > steps.indexOf(step);

    // Mappa colori stato
    let colorClass = 'text-slate-400 border-slate-300 bg-white';
    if (isActive || isPast) {
      if (step === 'analisi' || step === 'trattativa') colorClass = 'text-white bg-red-500 border-red-500'; // Rosso
      else if (step === 'pronta' || step === 'inviata') colorClass = 'text-white bg-amber-500 border-amber-500'; // Giallo
      else if (step === 'chiusa') colorClass = 'text-white bg-emerald-500 border-emerald-500'; // Verde
    }

    return (
      <div
        onClick={() => {
          setLegalStatus(step);  // 1. Aggiorna la grafica locale
          if (onUpdateStatus) {
            onUpdateStatus(step);  // 2. Aggiorna il database (Dashboard)
          }
        }}
        className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${isActive ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{label}</span>
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
      className="min-h-screen bg-slate-50 font-sans text-slate-900 relative flex flex-col overflow-hidden"
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
      <AnimatePresence>
        {isGlobalDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center border-[8px] border-dashed border-fuchsia-500/50 m-4 rounded-[3rem]"
            onDragLeave={(e) => {
              // Evita flickering se il cursore passa sopra figli del div
              if (e.clientX === 0 || e.clientY === 0) setIsGlobalDragging(false);
            }}
          >
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Bot className="w-32 h-32 text-fuchsia-400 drop-shadow-[0_0_40px_rgba(217,70,239,0.8)]" />
            </motion.div>
            <h2 className="text-4xl font-black text-white mt-8 tracking-widest uppercase">Sgancia i file qui</h2>
            <p className="text-fuchsia-300 font-bold mt-2">Il Motore Neurale li processerà in automatico.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STYLE GLOBALE */}
      <style>{GLOBAL_STYLES}</style>

      <MovingGrid />

      <div className="relative z-50 pt-6 px-6 pb-2">
        {/* HEADER GLASSMORPHISM (Colori Blindati con style) */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
                <div className="absolute inset-0 bg-orange-500 rounded-xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>

                <div className="relative flex items-center justify-between bg-slate-900 text-white rounded-xl border border-slate-700 group-hover:border-orange-500/50 transition-colors w-full h-full px-3 shadow-xl overflow-hidden">

                  {/* Icona e Label */}
                  <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500 group-hover:text-orange-400 transition-colors">
                      <CalendarClock size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[8px] uppercase font-bold text-slate-400 leading-none mb-0.5 tracking-widest">Start Year</span>
                      <span className="text-lg font-black text-white leading-none tracking-tight">{startClaimYear}</span>
                    </div>
                  </div>

                  {/* Freccia decorativa */}
                  <ChevronDown size={16} className="text-slate-500 group-hover:text-orange-500 transition-colors z-10 pointer-events-none" />

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
            <div className="flex items-center gap-5 border-l-2 border-slate-200/60 pl-8 h-20">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl text-white shadow-indigo-200 ring-4 ring-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${worker.accentColor === 'indigo' ? '#6366f1' : worker.accentColor === 'emerald' ? '#10b981' : worker.accentColor === 'orange' ? '#f97316' : '#3b82f6'}, ${worker.accentColor === 'indigo' ? '#4f46e5' : worker.accentColor === 'emerald' ? '#059669' : worker.accentColor === 'orange' ? '#ea580c' : '#2563eb'})` }}>
                <User className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {worker.cognome} {worker.nome}
                  </h1>
                  <BadgeCheck className="w-6 h-6 text-blue-500" />
                  <div className={`ml-2 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-tighter border ${worker.profilo === 'ELIOR'
                    ? 'bg-orange-50 text-orange-600 border-orange-200'
                    : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                    {worker.profilo}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                  <Briefcase className="w-4 h-4" />
                  <span>{worker.ruolo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TICKER CENTRALE */}
          <div className="flex-1 hidden lg:flex items-center justify-center overflow-hidden relative h-12 bg-slate-50/50 rounded-xl border border-slate-100/50 mx-4 shadow-inner">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white via-white/80 to-transparent z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white via-white/80 to-transparent z-10"></div>
            <div className="w-full overflow-hidden flex items-center">
              <motion.div
                className="flex gap-12 items-center whitespace-nowrap"
                animate={{ x: ["0%", "-33.33%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 40 }} // Rallentato un po' per leggere le note
              >
                {tickerItems.map((stat, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-1 border-r border-slate-200/50 last:border-0">
                    <div className={`p-2 rounded-xl bg-white shadow-sm border ${stat.color}`}>
                      {/* @ts-ignore */}
                      <stat.icon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                        {stat.label}
                      </span>
                      <span className={`text-base font-black ${stat.color.split(' ')[0]} leading-tight`}>
                        {stat.value}
                      </span>
                      {/* NUOVA RIGA: NOTA LEGALE */}
                      <span className="text-[9px] font-medium text-slate-400 italic leading-none mt-0.5">
                        {/* @ts-ignore */}
                        {stat.note}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">

            {/* TASTO PEC */}
            <button
              onClick={handleSendPec}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #334155 0%, #475569 100%)' }} // Slate
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

      <div className="relative z-10 flex-1 p-6 flex gap-6 max-w-[1800px] mx-auto w-full h-[calc(100vh-100px)] overflow-hidden">

        {/* --- COLONNA PRINCIPALE --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">

          {/* TIMELINE STATO VERTENZA E PARAMETRI (A TENDINA) */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-[1.5rem] px-6 py-4 shadow-sm border border-white/60 relative overflow-hidden transition-all duration-300">

            {/* Header: Pulsante apri/chiudi a sinistra, Toggle sempre visibili a destra */}
            <div className="flex justify-between items-center">

              <button
                onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                className="group flex items-center gap-2 text-sm font-black text-slate-700 hover:text-indigo-600 transition-colors focus:outline-none"
              >
                <div className="p-1.5 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <Gavel className="w-4 h-4 text-indigo-600" />
                </div>
                STATO VERTENZA
                <motion.div animate={{ rotate: isTimelineOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                </motion.div>
              </button>

              {/* TOGGLES PARAMETRI CALCOLO (SEMPRE VISIBILI) */}
              <div className="flex items-center p-1 bg-slate-100/50 backdrop-blur-sm rounded-full border border-slate-200/80 shadow-sm shrink-0">
                <button
                  onClick={() => setIncludeExFest(!includeExFest)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ${includeExFest
                    ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-300/50 shadow-[0_1px_6px_rgba(251,191,36,0.2)]'
                    : 'bg-transparent text-slate-500 border-transparent hover:bg-white hover:border-amber-200/60 hover:text-amber-600'
                    }`}
                  title="Includi/Escludi Ex-Festività"
                >
                  <CalendarPlus size={14} className={`transition-transform duration-300 ${includeExFest ? 'rotate-0' : 'group-hover:rotate-12'}`} strokeWidth={2.5} />
                  <span>{includeExFest ? "32gg" : "28gg"}</span>
                </button>

                <button
                  onClick={() => setIncludeTickets(!includeTickets)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ml-1 ${includeTickets
                    ? 'bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-800 border-indigo-300/50 shadow-[0_1px_6px_rgba(99,102,241,0.2)]'
                    : 'bg-transparent text-slate-400 border-transparent hover:bg-white hover:border-indigo-200/60 hover:text-indigo-600 line-through opacity-70 hover:opacity-100 hover:no-underline'
                    }`}
                  title="Includi/Escludi Ticket Restaurant"
                >
                  <Ticket size={14} className={`transition-transform duration-300 ${includeTickets ? 'rotate-0' : 'group-hover:-rotate-12'}`} strokeWidth={2.5} />
                  Ticket
                </button>
              </div>
            </div>

            {/* TIMELINE A SCOMPARSA */}
            <AnimatePresence>
              {isTimelineOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 mb-2 relative flex justify-between items-center z-10 px-4">
                    <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
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
              className="relative flex p-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-2xl gap-3 overflow-x-auto w-full justify-start md:justify-center no-scrollbar"
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
                onChange={handleBatchUpload}
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
                    ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                    // A riposo: Vetro grigio. Hover: Si oscura e si accende di Fucsia SENZA sollevarsi.
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:border-transparent hover:shadow-[0_0_40px_rgba(217,70,239,0.3)]'
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
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-pink-500 hover:shadow-md' // Inattivo: Bordo TRASPARENTE
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
              {/* --- TASTO SCAN AI (VERSIONE "STEALTH TECH") --- */}
              <style>{`
                @keyframes scan-vertical {
                  0% { transform: translateY(-100%); opacity: 0; }
                  15% { opacity: 1; }
                  85% { opacity: 1; }
                  100% { transform: translateY(200%); opacity: 0; }
                }
                @keyframes icon-float-subtle {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-2px); }
                }
                .group:hover .animate-scan-vertical {
                  animation: scan-vertical 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .group:hover .animate-icon-subtle {
                  animation: icon-float-subtle 1.5s ease-in-out infinite;
                }
              `}</style>

              <button
                onClick={() => scanRef.current?.click()}
                disabled={isAnalyzing}
                className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${isAnalyzing
                    ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70'
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                  // ^^^ MODIFICA QUI: Sfondo "glass" (white/40) e bordo trasparente a riposo.
                  }`}
              >

                {/* 1. SFONDO SCURO CHE APPARE (Per contrasto massimo in hover) */}
                <div className="absolute inset-0 bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* 2. RAGGIO LASER DI SCANSIONE (Visibile solo in Hover) */}
                <div className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-transparent via-cyan-500/30 to-cyan-400/80 animate-scan-vertical"></div>
                </div>

                {/* 3. CONTENUTO */}
                <div className="relative z-10 flex items-center gap-2.5 transition-colors duration-300 group-hover:text-white">

                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                      <span className="font-medium">Analisi in corso...</span>
                    </>
                  ) : (
                    <>
                      {/* Icona: Colore base ereditato (slate), diventa Ciano in hover */}
                      <ScanLine className="w-5 h-5 transition-colors duration-300 group-hover:text-cyan-400 animate-icon-subtle" />

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
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-300 transition-colors uppercase tracking-widest leading-none mb-1">
                    Connetti
                  </span>
                  <span className="text-sm font-black text-slate-600 dark:text-slate-400 group-hover:text-white transition-colors leading-none">
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
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-blue-500 hover:shadow-md'
                  }`}
                style={activeTab === 'input' ? { backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' } : {}}
              >
                {/* EFFETTO SERRANDA DI LUCE */}
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
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-emerald-500 hover:shadow-md'
                  }`}
                style={activeTab === 'calc' ? { backgroundImage: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' } : {}}
              >
                {/* EFFETTO SERRANDA DI LUCE */}
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
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-amber-500 hover:shadow-md'
                  }`}
                style={activeTab === 'pivot' ? { backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' } : {}}
              >
                {/* EFFETTO SERRANDA DI LUCE */}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>

                <TrendingUp className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'pivot' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
                <span className="relative z-10">Analisi Voci</span>
              </button>

              <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

              {/* TASTO DEAL MAKER (Dark/Slate) */}
              <button
                onClick={() => setShowDealMaker(!showDealMaker)}
                className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${showDealMaker
                    ? 'text-white shadow-lg shadow-slate-500/30 border-white/20 scale-105'
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 hover:shadow-md'
                  }`}
                style={showDealMaker ? { backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' } : {}}
              >
                {/* EFFETTO SERRANDA DI LUCE */}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>

                <Handshake className={`w-5 h-5 transition-transform duration-300 relative z-10 ${showDealMaker ? 'text-emerald-400' : 'group-hover:text-emerald-500'}`} />
                <span className="hidden lg:inline relative z-10">Deal Maker</span>
              </button>

              {/* TASTO CALCOLATRICE */}
              <button
                onClick={() => setShowCalc(!showCalc)}
                className={`group relative px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${showCalc ? 'text-white border-white/20 shadow-lg' : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 border-transparent hover:bg-white hover:text-indigo-500'}`}
                style={showCalc ? { backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' } : {}}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                <Calculator className="w-5 h-5 relative z-10" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/60 shadow-2xl overflow-hidden flex flex-col relative min-h-0">
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

                    <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar relative">
                      <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-white opacity-5 pointer-events-none" />

                      {isExplaining ? (
                        <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                            <Loader2 className="w-12 h-12 text-fuchsia-500" />
                          </motion.div>
                          <p className="text-lg font-bold text-white">Scansione e interpretazione in corso...</p>
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
                      <div className="h-full flex flex-col">
                        <MonthlyDataGrid
                          data={monthlyInputs}
                          onDataChange={handleDataChange}
                          initialYear={currentYear}
                          onYearChange={setCurrentYear}
                          profilo={worker.profilo}
                          onCellFocus={handleCellFocus}
                        />
                      </div>
                    )}

                    {activeTab === 'calc' && (
                      <div className="h-full overflow-auto custom-scrollbar pr-2">
                        {/* Passiamo l'interruttore alla tabella aggiungendo includeTickets={includeTickets} */}
                        <AnnualCalculationTable data={monthlyInputs} profilo={worker.profilo} onDataChange={handleDataChange} includeTickets={includeTickets} startClaimYear={startClaimYear} />
                      </div>
                    )}

                    {activeTab === 'pivot' && (
                      <div className="h-full overflow-auto custom-scrollbar pr-2">
                        <IndemnityPivotTable data={monthlyInputs} profilo={worker.profilo} startClaimYear={startClaimYear} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* --- SPLIT SCREEN SIDEBAR (MULTI-FILE) --- */}
        <AnimatePresence>
          {showSplit && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: "45%", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 relative shrink-0"
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
                  <button onClick={() => setShowSplit(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white ml-2" title="Chiudi Visore"><X className="w-5 h-5" /></button>
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
                  </div>
                ) : (
                  // AREA UPLOAD (RIPRISTINATO STILE RIQUADRO CENTRALE CON ANIMAZIONE)
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    // Aggiunto 'group' per gestire l'hover
                    className="group flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 transition-all cursor-pointer p-8 border-2 border-dashed border-slate-700 rounded-3xl hover:border-indigo-500 hover:bg-slate-900/50 w-64 h-64"
                  >
                    {/* Icona che rimbalza in hover */}
                    <div className="mb-4 p-4 bg-slate-900 rounded-full group-hover:scale-110 transition-transform duration-300 border border-slate-800 group-hover:border-indigo-500/30">
                      <Upload className="w-8 h-8 group-hover:-translate-y-1 transition-transform duration-500 ease-in-out" />
                    </div>
                    <p className="font-bold text-sm uppercase tracking-wider text-slate-400 group-hover:text-white transition-colors">Carica Buste Paga</p>
                    <p className="text-[10px] mt-2 opacity-50 text-center px-4 group-hover:opacity-100 transition-opacity">
                      Trascina qui o clicca.<br />Supporta PDF, JPG, PNG (Max 12)
                    </p>
                    <p className="text-[10px] mt-1 opacity-40 pointer-events-none">Carica fino a 12 file insieme!</p>
                  </div>

                )}
              </div>
              {payslipFiles.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full text-[10px] text-white/70 pointer-events-none border border-white/10 z-30">
                  {isSniperMode ? "DISEGNA UN RETTANGOLO SUL NUMERO" : "Trascina per spostare • Usa i tasti per lo zoom"}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* SIDEBAR DEAL MAKER A SCOMPARSA */}
        <AnimatePresence>
          {showDealMaker && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 50 }}
              animate={{ width: "400px", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 50 }}
              className="bg-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 relative shrink-0 z-50"
            >
              {/* HEADER SIDEBAR */}
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-black text-white leading-none">STRATEGIA LEGALE</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Simulatore Transattivo</p>
                  </div>
                </div>
                <button onClick={() => setShowDealMaker(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar">

                {/* 1. SELETTORE LORDO / NETTO */}
                <div className="flex bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setIsNetMode(false)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${!isNetMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    LORDO (Ricorso)
                  </button>
                  <button
                    onClick={() => setIsNetMode(true)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${isNetMode ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    NETTO (In Tasca)
                  </button>
                </div>

                {/* 2. IL TARGET (BATNA) */}
                <div className="text-center relative">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {isNetMode ? "Valore Netto Reale" : "Valore Nominale Causa"}
                  </p>
                  <div className="text-4xl font-black text-white tracking-tight">
                    {formatCurrency(dealStats.displayTarget)}
                  </div>
                  {isNetMode && <p className="text-[9px] text-slate-500 mt-1">Stima tassazione separata ~23%</p>}
                </div>

                <div className="h-px bg-slate-800 w-full"></div>

                {/* 3. SIMULATORE RISCHIO CAUSA */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-300">Probabilità Vittoria</label>
                    <span className={`text-xs font-bold ${winProb > 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{winProb}%</span>
                  </div>
                  <input
                    type="range" min="50" max="100" step="5"
                    value={winProb} onChange={(e) => setWinProb(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Costi Legali (€)</label>
                      <input
                        type="number" value={legalCosts} onChange={(e) => setLegalCosts(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Durata (Anni)</label>
                      <input
                        type="number" value={yearsDuration} onChange={(e) => setYearsDuration(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. CONFRONTO OFFERTA */}
                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 block">Offerta Azienda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                      <input
                        type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 pl-8 pr-4 text-white font-bold text-lg focus:outline-none focus:border-emerald-500 shadow-inner"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* BARRA DI CONFRONTO VISIVA */}
                  {offerAmount && (
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Offerta: {formatCurrency(parseFloat(offerAmount))}</span>
                        <span>vs Scenario Causa: {formatCurrency(dealStats.courtRealValue)}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${Math.min(100, (parseFloat(offerAmount) / dealStats.displayTarget) * 100)}%` }}
                          className={`h-full transition-all duration-500 ${parseFloat(offerAmount) >= dealStats.courtRealValue ? 'bg-emerald-500' : 'bg-red-500'}`}
                        ></div>
                        {/* Marker del Valore Atteso Causa */}
                        <div
                          style={{ left: `${Math.min(100, (dealStats.courtRealValue / dealStats.displayTarget) * 100)}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-white h-3 z-10 shadow-[0_0_10px_white]"
                          title="Punto di Indifferenza (Break-even)"
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* VERDETTO STRATEGICO */}
                  {offerAmount && (
                    <div className={`p-3 rounded-xl border text-xs leading-relaxed font-medium ${parseFloat(offerAmount) >= dealStats.courtRealValue
                      ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-red-900/30 border-red-500/50 text-red-200'
                      }`}>
                      {parseFloat(offerAmount) >= dealStats.courtRealValue ? (
                        <span className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> <b>CONVIENE ACCETTARE.</b> L'offerta supera il valore atteso della causa considerando rischi, costi e tempi.</span>
                      ) : (
                        <span className="flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <b>NON CONVIENE.</b> L'offerta è inferiore al valore reale atteso in giudizio. Meglio procedere o rilanciare.</span>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* FOOTER */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
                <p className="text-[9px] text-slate-500">
                  Il calcolo "Scenario Causa" include: Probabilità {winProb}%, Costi {formatCurrency(legalCosts)}, Svalutazione {yearsDuration} anni.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      {/* --- HUD INTELLIGENZA ARTIFICIALE (Plasma & Supernova) --- */}
      <AnimatePresence>
        {isBatchProcessing && !showSplit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: showSupernova ? 1.05 : 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center max-w-sm w-full relative overflow-hidden border transition-all duration-500
                ${showSupernova ? 'bg-emerald-950 border-emerald-500 shadow-[0_0_150px_rgba(16,185,129,0.8)]' : 'bg-slate-900 border-slate-700 shadow-[0_0_120px_rgba(217,70,239,0.15)]'}`}
            >
              {/* FLASH SUPERNOVA (Bianco abbagliante che svanisce) */}
              <AnimatePresence>
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
                Analisi busta paga <span className={`text-4xl font-black mx-1.5 ${showSupernova ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]'}`}>{batchProgress}</span> di <span className="text-2xl text-slate-400 mx-1.5">{batchTotal}</span>
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
      {/* RENDER CALCOLATRICE */}
      <AnimatePresence>
        {showCalc && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <FloatingCalculator onClose={() => setShowCalc(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- TOAST NOTIFICATION (Premium Modern Style) --- */}
      <AnimatePresence>
        {batchNotification && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
                className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
        {/* MODALE QR CODE SCANNER */}
        <QRScannerModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          onScanSuccess={handleQRData}
          company={worker.profilo || 'RFI'}
          workerName={`${worker.cognome} ${worker.nome}`}
        />
      </AnimatePresence>
    </div >
  );
};

export default WorkerDetailPage; 