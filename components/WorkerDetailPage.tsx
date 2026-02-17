import React, { useState, useMemo, useRef, useEffect } from 'react';
import MonthlyDataGrid from './WorkerTables/MonthlyDataGrid';
import AnnualCalculationTable from './WorkerTables/AnnualCalculationTable';
import IndemnityPivotTable from './WorkerTables/IndemnityPivotTable';
import TableComponent from './TableComponent'; // Assicurati che il percorso sia corretto
// Import necessario per i calcoli della stampa
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
  Sparkles,
  XCircle,
  AlertTriangle,
  Check
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
  /* Glassmorphism 2.0 */
  .glass-panel {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
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
// --- COMPONENTE CALCOLATRICE FLUTTUANTE (Spostabile) ---
const FloatingCalculator = ({ onClose }: { onClose: () => void }) => {
  const [display, setDisplay] = useState('');

  const handleInput = (val: string) => setDisplay(prev => prev + val);
  const handleClear = () => setDisplay('');
  const handleCalc = () => {
    try { setDisplay(String(eval(display.replace(/,/g, '.')))); }
    catch { setDisplay('Errore'); setTimeout(() => setDisplay(''), 1000); }
  };

  // Listener Tastiera
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (/[0-9+\-*/.]/.test(key)) handleInput(key);
      if (key === 'Enter' || key === '=') { e.preventDefault(); handleCalc(); }
      if (key === 'Backspace') setDisplay(prev => prev.slice(0, -1));
      if (key === 'Escape') onClose();
      if (key === 'Delete' || key === 'c') handleClear();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const btnClass = "h-12 rounded-lg font-bold text-lg transition-all active:scale-95 flex items-center justify-center shadow-sm";

  return (
    <motion.div
      drag // <--- ABILITA IL TRASCINAMENTO
      dragMomentum={false} // <--- FERMA IL MOVIMENTO AL RILASCIO
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

  // --- NUOVI STATI PER LEGAL COCKPIT ---
  const [legalStatus, setLegalStatus] = useState<'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa'>(worker.status || 'analisi'); //
  const [offerAmount, setOfferAmount] = useState<string>('');
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
  // Stato per la notifica personalizzata (sostituisce l'alert brutto)
  // Aggiorna questa riga aggiungendo | 'warning'
  const [batchNotification, setBatchNotification] = useState<{ msg: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const batchInputRef = useRef<HTMLInputElement>(null);

  // --- 🔥 2. LOGICA UPLOAD MASSIVO OTTIMIZZATA (Sostituisci handleBatchUpload) ---
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBatchProcessing(true);
    setBatchNotification(null);

    // Copia profonda per evitare mutazioni dirette
    let currentAnni = JSON.parse(JSON.stringify(monthlyInputs));
    let successCount = 0;
    let errorCount = 0;
    let lastDetectedYear = null;

    for (let i = 0; i < files.length; i++) {
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
            // Sovrascriviamo per evitare duplicazioni
            row.arretrati = arretratiVal;
          }

          // Aggiunta Note Eventi (es. "Malattia") senza duplicarle
          if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote)) {
            row.note = (row.note ? row.note + ' ' : '') + `[${aiResult.eventNote}]`;
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

    setIsBatchProcessing(false);
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
      // Passiamo l'evento direttamente alla funzione Batch
      await handleBatchUpload(event);
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
    // 1. SETUP E CONFIGURAZIONE
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
    // FIX TYPESCRIPT: Creiamo un array di numeri garantiti
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
    // Totale Variabili (solo statistico)
    let grandTotalIndemnity = 0;

    // Contatore Tetto Progressivo
    let ferieCumulateCounter = 0;

    // --- B. COSTRUZIONE DATI TABELLA 1 (RIEPILOGO) ---
    yearsToPrint.forEach((yearVal) => {
      const year = Number(yearVal);

      // Logica Media: Anno Prec -> Fallback Corrente
      let mediaApplicata = yearlyAverages[year - 1];
      if (mediaApplicata === undefined || mediaApplicata === 0) {
        mediaApplicata = yearlyAverages[year] || 0;
      }

      // Filtro mesi
      const months = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      // Totali dell'ANNO
      let yIndemnity = 0; // Somma voci
      let yWorkDays = 0;
      let yLordo = 0;
      let yTicket = 0;
      let yPercepito = 0; // Serve per il netto
      let yFerieEffettive = 0;
      let yFeriePagate = 0;

      months.forEach(row => {
        // 1. Somma voci grezze (per Tabella 2 e colonna 1)
        let monthVoci = 0;
        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          monthVoci += val;
          // Pivot Data
          if (!pivotData[col.label]) pivotData[col.label] = {};
          if (!pivotData[col.label][year]) pivotData[col.label][year] = 0;
          pivotData[col.label][year] += val;
        });
        yIndemnity += monthVoci;
        yWorkDays += parseLocalFloat(row.daysWorked);

        // 2. Calcoli Economici
        const vacDays = parseLocalFloat(row.daysVacation);
        const cTicket = parseLocalFloat(row.coeffTicket);
        const cPercepito = parseLocalFloat(row.coeffPercepito);

        // Tetto Progressivo
        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += vacDays;

        // Giorni Utili
        const spazio = Math.max(0, TETTO - prevTotal);
        const ggUtili = Math.min(vacDays, spazio);

        // Accumulatori Giorni
        yFerieEffettive += vacDays;
        yFeriePagate += ggUtili;

        // Calcolo Euro (Se ci sono giorni utili)
        if (ggUtili > 0) {
          yLordo += (ggUtili * mediaApplicata); // Usiamo la media corretta!
          yPercepito += (ggUtili * cPercepito);

          // Applichiamo il bottone ai Ticket
          if (includeTickets) {
            yTicket += (ggUtili * cTicket);
          } else {
            yTicket = 0;
          }
        }
      });

      const yNetto = (yLordo - yPercepito) + yTicket;

      // --- LOGICA ANNO RIFERIMENTO VS CONTEGGIO ---
      const isReferenceYear = year < startClaimYear;

      yearlyRows.push([
        isReferenceYear ? `${year} (Rif.)` : year, // Segnala visivamente che è solo riferimento
        fmt(yIndemnity),
        fmtInt(yWorkDays),
        fmt(mediaApplicata),
        `${fmtInt(yFeriePagate)} / ${fmtInt(yFerieEffettive)}`,
        // Se è anno di riferimento, non mostriamo gli importi perché non si chiedono
        isReferenceYear ? '(Media)' : fmt(yLordo),
        isReferenceYear ? '-' : fmt(yTicket),
        isReferenceYear ? '-' : fmt(yNetto)
      ]);

      // --- MODIFICA CRUCIALE: SOMMA AI TOTALI SOLO SE ANNO >= ANNO INIZIO ---
      // Se siamo nel 2007 (isReferenceYear = true), saltiamo la somma.
      if (!isReferenceYear) {
        grandTotalIndemnity += yIndemnity;
        grandTotalLordo += yLordo;
        grandTotalTicket += yTicket;
        grandTotalNet += yNetto;
        grandTotalFerieEffettive += yFerieEffettive;
        grandTotalFeriePagate += yFeriePagate;
      }
    });
    // Riga Totale Finale
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

      // Footer con Nota Legale
      doc.setFontSize(7); doc.setTextColor(100);
      const note = "Calcolo elaborato ai sensi Cass. n. 20216/2022 (Onnicomprensività retribuzione feriale).";
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
      head: [['ANNO', 'TOT. VARIABILI', 'GG LAV.', 'MEDIA UTILIZZATA', 'GG UTILI / TOT', 'DIFF. LORDA', 'TICKET', 'NETTO DOVUTO']],
      body: yearlyRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: 50, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: [23, 37, 84], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252] },
        3: { fontStyle: 'bold', textColor: [180, 83, 9] }, // Colonna Media in Arancio scuro
        7: { fontStyle: 'bold', halign: 'right', fillColor: [220, 252, 231], textColor: [21, 128, 61] } // Netto Verde
      },
      bodyStyles: { halign: 'right' },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;

    // --- TABELLA 2 ---
    // @ts-ignore
    if (currentY > 150) { doc.addPage(); currentY = 30; }

    doc.setFontSize(12); doc.setTextColor(23, 37, 84);
    doc.text("2. RIEPILOGO VOCI VARIABILI DELLA RETRIBUZIONE", 14, currentY);

    const pivotHead = ['VOCE', ...yearsToPrint.map(String), 'TOTALE'];
    const pivotBody = Object.keys(pivotData).sort().map(key => {
      let rowTotal = 0;
      const row = [key];
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
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2, textColor: 50 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, halign: 'center', fontStyle: 'bold' },
      bodyStyles: { halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 } },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    // --- TABELLA 3 (DETTAGLIO MENSILE) ---
    doc.addPage();
    currentY = 30;
    doc.setFontSize(12); doc.setTextColor(23, 37, 84);
    doc.text("3. DETTAGLIO MENSILE ANALITICO", 14, currentY);

    // Reset contatore per ristampare i mesi correttamente
    let monthlyFerieCounter = 0;

    yearsToPrint.forEach(yearVal => {
      const year = Number(yearVal);
      // @ts-ignore
      if (currentY > 160) { doc.addPage(); currentY = 30; }

      // Recupero media per mostrarla nel titolo
      let media = yearlyAverages[year - 1];
      if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`ANNO ${year} (Media: ${fmt(media)})`, 14, currentY + 8);

      const yearRows = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      const tableHead = [
        'MESE',
        ...indennitaCols.map(c => c.label.substring(0, 10) + '.'),
        'GG LAV', 'GG UTILI', 'LORDO', 'GIA\' PERC.', 'TICKET', 'NETTO'
      ];

      const tableBody = yearRows.map(row => {
        const monthName = row.month ? row.month : (MONTH_NAMES[row.monthIndex] || '');
        const rowData = [monthName.substring(0, 3).toUpperCase()];

        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          rowData.push(fmt(val) === '-' ? '' : fmt(val).replace(' €', ''));
        });

        const ggLav = parseLocalFloat(row.daysWorked);
        const vac = parseLocalFloat(row.daysVacation);

        // Ricalcolo al volo per la visualizzazione mensile
        const spazio = Math.max(0, TETTO - monthlyFerieCounter);
        const gu = Math.min(vac, spazio);
        monthlyFerieCounter += vac;

        // Calcoli Row
        let rLordo = 0;
        if (gu > 0) rLordo = gu * media;

        // --- MODIFICA QUI ---
        // Se il bottone includeTickets è attivo calcola il ticket, altrimenti forzalo a 0.
        const rTicket = includeTickets ? (gu * parseLocalFloat(row.coeffTicket)) : 0;

        const rPercepito = gu * parseLocalFloat(row.coeffPercepito);
        const rNetto = (rLordo - rPercepito) + rTicket;

        rowData.push(
          ggLav > 0 ? String(ggLav) : '',
          // Se i giorni sono stati tagliati dal tetto, li segniamo con asterisco
          gu !== vac ? `${fmtInt(gu)}*` : fmtInt(gu),
          fmt(rLordo),
          fmt(rPercepito),
          fmt(rTicket),
          fmt(rNetto)
        );
        return rowData;
      });

      autoTable(doc, {
        startY: currentY + 12,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'right', lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
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

    // --- PAGINA 4: RIEPILOGO FINALE (AGGIUNTA) ---
    doc.addPage();
    drawHeaderFooter(null);
    currentY = 40;

    doc.setFontSize(16); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("RIEPILOGO FINALE DEI CREDITI", 105, currentY, { align: 'center' });
    currentY += 20;

    const printRow = (label: string, value: string, isTotal = false) => {
      doc.setFontSize(isTotal ? 14 : 12);
      if (isTotal) doc.setTextColor(22, 163, 74); // Verde
      else doc.setTextColor(50, 50, 50); // Grigio

      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');

      doc.text(label, 40, currentY);
      doc.text(value, 170, currentY, { align: 'right' });
      doc.setDrawColor(200); doc.setLineWidth(0.1);
      doc.line(40, currentY + 2, 170, currentY + 2);
      currentY += 12;
    };

    // Per il riepilogo finale usiamo i totali calcolati in "grandTotal..." che sono corretti
    // MA dobbiamo calcolare il "Già Percepito Totale" per differenza logica o somma
    // Poiché grandTotalIndemnity è la somma delle voci variabili e non del percepito (che è ferie * coeff),
    // dobbiamo ricalcolare velocemente il percepito totale corretto.

    let recalcPercepitoTotal = 0;
    let tempFerie = 0;

    // Ordine cronologico per coerenza tetto
    const allSorted = [...monthlyInputs].sort((a, b) => {
      return (Number(a.year) - Number(b.year)) || (a.monthIndex - b.monthIndex);
    });

    allSorted.forEach(row => {
      const v = parseLocalFloat(row.daysVacation);
      const s = Math.max(0, TETTO - tempFerie);
      const gu = Math.min(v, s);
      tempFerie += v;
      if (gu > 0) recalcPercepitoTotal += (gu * parseLocalFloat(row.coeffPercepito));
    });

    printRow("Totale Lordo Spettante", fmt(grandTotalLordo));
    printRow("Totale Già Percepito (Voce Busta)", fmt(recalcPercepitoTotal));
    printRow("Totale Buoni Pasto Maturati", fmt(grandTotalTicket));

    currentY += 5;
    printRow("TOTALE NETTO DA LIQUIDARE", fmt(grandTotalNet), true);

    // Disclaimer
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
      // Converte tutti i file selezionati in URL temporanei
      // MODIFICA QUI: Aggiunto ": File" e "as File" per calmare TypeScript
      const newFiles = Array.from(e.target.files).map((file: any) => URL.createObjectURL(file as Blob));

      setPayslipFiles(prev => [...prev, ...newFiles]);
      setCurrentFileIndex(prev => prev === 0 && payslipFiles.length === 0 ? 0 : prev);
      setShowSplit(true);

      // Reset zoom/pos
      setImgScale(1);
      setImgPos({ x: 0, y: 0 });
    }
  };

  // Funzioni di navigazione
  const nextFile = () => {
    if (currentFileIndex < payslipFiles.length - 1) {
      setCurrentFileIndex(prev => prev + 1);
      setImgScale(1); setImgPos({ x: 0, y: 0 }); // Reset zoom al cambio file
    }
  };

  const prevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(prev => prev - 1);
      setImgScale(1); setImgPos({ x: 0, y: 0 });
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
        onBack={() => setShowReport(false)}
        onEdit={() => setShowReport(false)}
        startClaimYear={startClaimYear}
      />
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative flex flex-col overflow-hidden">

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

            {/* USER INFO (Separato da riga verticale - Invariato ma aumentata altezza riga) */}
            <div className="flex items-center gap-5 border-l-2 border-slate-200/60 pl-8 h-20">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl text-white shadow-indigo-200 ring-4 ring-white"
                style={{ background: `linear-gradient(135deg, ${worker.accentColor === 'indigo' ? '#6366f1' : worker.accentColor === 'emerald' ? '#10b981' : worker.accentColor === 'orange' ? '#f97316' : '#3b82f6'}, ${worker.accentColor === 'indigo' ? '#4f46e5' : worker.accentColor === 'emerald' ? '#059669' : worker.accentColor === 'orange' ? '#ea580c' : '#2563eb'})` }}>
                <User className="w-7 h-7" strokeWidth={2} />
              </div>
              {/* ... resto del blocco User Info (puoi lasciare quello di prima) ... */}
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

            {/* TASTO STAMPA DATI */}
            <button
              onClick={handlePrintTables}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' }} // Emerald -> Teal
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Printer className="w-4 h-4 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
              <span className="hidden xl:inline">Stampa Dati</span>
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

          {/* TIMELINE STATO VERTENZA */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/60 relative overflow-hidden">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-indigo-500" /> STATO VERTENZA
            </h3>
            <div className="relative flex justify-between items-center z-10 px-4">
              <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
              <TimelineStep step="analisi" label="Analisi" icon={Search} activeStatus={legalStatus} />
              <TimelineStep step="pronta" label="Conteggi" icon={Calculator} activeStatus={legalStatus} />
              <TimelineStep step="inviata" label="PEC Inviata" icon={Send} activeStatus={legalStatus} />
              <TimelineStep step="trattativa" label="Trattativa" icon={Handshake} activeStatus={legalStatus} />
              <TimelineStep step="chiusa" label="Chiusa" icon={CheckCircle2} activeStatus={legalStatus} />
            </div>
          </div>

          <div className="flex justify-center mb-6 z-20 shrink-0">
            <div className="flex p-2 bg/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-2xl gap-3 overflow-x-auto w-full justify-start md:justify-center scrollbar-hide">

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

              <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

              {/* --- NUOVI TOGGLE CONFIGURAZIONI (TETTO E TICKET) --- */}
              <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  onClick={() => setIncludeExFest(!includeExFest)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${includeExFest ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-slate-500 hover:text-amber-600 hover:bg-white/50'
                    }`}
                  title="Includi/Escludi Ex-Festività"
                >
                  <CalendarPlus size={18} />
                  {includeExFest ? "32gg (ExF)" : "28gg (Std)"}
                </button>
                <button
                  onClick={() => setIncludeTickets(!includeTickets)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${includeTickets ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-indigo-600 hover:bg-white/50 line-through opacity-80'
                    }`}
                  title="Includi/Escludi Ticket Restaurant"
                >
                  <Ticket size={18} />
                  Ticket
                </button>
              </div>

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
                      <button onClick={() => handleZoom(-0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
                      <button onClick={() => { setImgScale(1); setImgPos({ x: 0, y: 0 }); }} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><Maximize className="w-4 h-4" /></button>
                      <button onClick={() => handleZoom(0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
                      <button onClick={() => {
                        const newFiles = payslipFiles.filter((_, i) => i !== currentFileIndex);
                        setPayslipFiles(newFiles);
                        if (newFiles.length === 0) setShowSplit(false);
                        else if (currentFileIndex >= newFiles.length) setCurrentFileIndex(newFiles.length - 1);
                      }} className="p-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded-lg ml-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => setShowSplit(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white ml-2"><X className="w-5 h-5" /></button>
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
                          transform: `scale(${imgScale}) translate(${imgPos.x}px, ${imgPos.y}px)`,
                          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                          pointerEvents: 'auto' // Riabilita interazione img
                        }}
                        className={`max-w-full max-h-full object-contain select-none ${isSniperMode ? '' : 'cursor-grab active:cursor-grabbing'}`}
                      />
                    </object>

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
      {/* RENDER CALCOLATRICE */}
      <AnimatePresence>
        {showCalc && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <FloatingCalculator onClose={() => setShowCalc(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* NOTIFICA FLUTTUANTE UNIVERSALE (Success / Error / Warning) */}
      <AnimatePresence>
        {batchNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150]"
          >
            <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${batchNotification.type === 'success' ? 'bg-slate-900/90 border-emerald-500/30 text-white' :
              batchNotification.type === 'warning' ? 'bg-amber-900/95 border-amber-500/50 text-white' : // Stile Giallo
                'bg-red-900/90 border-red-500/30 text-white'
              }`}>
              <div className={`p-2 rounded-full ${batchNotification.type === 'success' ? 'bg-emerald-500' :
                batchNotification.type === 'warning' ? 'bg-amber-500 text-slate-900' :
                  'bg-red-500'
                }`}>
                {batchNotification.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {batchNotification.type === 'warning' && <AlertTriangle className="w-6 h-6" />}
                {batchNotification.type === 'error' && <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <h4 className={`font-black text-sm uppercase tracking-wider mb-0.5 ${batchNotification.type === 'warning' ? 'text-amber-400' : 'text-white'
                  }`}>
                  {batchNotification.type === 'success' ? 'Operazione Completata' :
                    batchNotification.type === 'warning' ? 'Attenzione Media' : 'Errore'}
                </h4>
                <p className="text-sm font-medium opacity-90 whitespace-pre-line leading-snug">
                  {batchNotification.msg}
                </p>
              </div>
              <button
                onClick={() => setBatchNotification(null)}
                className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkerDetailPage;  