import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  MONTH_NAMES,
  YEARS,
  formatCurrency,
  formatInteger,
  AnnoDati,
  getColumnsByProfile,
  ProfiloAzienda
} from '../../types';
import {
  MessageSquareText,
  X,
  Save,
  Eraser,
  Tag,
  TrendingUp,
  AlertCircle,
  Calendar,
  Info,
  Wallet,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MapPin,
  Scale, // Icona per il legale
  TriangleAlert,
  AlertTriangle,
  CheckCircle2 // Icona per errori validazione
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURAZIONE TAG RAPIDI ---
const QUICK_TAGS = ["Infortunio", "Malattia", "Congedo", "Sciopero", "Assenza Ingiust.", "Permesso 104"];

// --- MAPPATURA DETTAGLIATA ---
interface IndennitaDetail {
  title: string;
  explanation: string;
  location: string;
}

const INDENNITA_DETAILS: Record<string, IndennitaDetail> = {
  "0152": {
    title: "Straordinario Feriale Diurno non recup.",
    explanation: "Ore di lavoro straordinario prestate in giorni feriali (diurno) non recuperate con riposi.",
    location: "Corpo centrale, colonna 'Cod. Voce'. Solitamente tra le prime voci variabili."
  },
  "0421": {
    title: "Indennità per Lavoro Notturno (CCNL 03)",
    explanation: "Indennità oraria per prestazioni svolte tra le 22:00 e le 06:00.",
    location: "Corpo centrale, raggruppata con le indennità di turno."
  },
  "0470": {
    title: "Indennità di Chiamata (Reperibilità)",
    explanation: "Compenso per l'effettiva chiamata in servizio durante il turno di reperibilità.",
    location: "Corpo centrale. Voce variabile presente solo se c'è stata attivazione."
  },
  "0482": {
    title: "Compenso per Reperibilità (CCNL 03)",
    explanation: "Quota fissa giornaliera per la disponibilità al servizio (stand-by).",
    location: "Corpo centrale. Spesso su più righe se copre periodi misti."
  },
  "0496": {
    title: "Indennità Chiamata in Disponibilità",
    explanation: "Specifica per il personale in regime di disponibilità (diverso dalla reperibilità standard).",
    location: "Corpo centrale, elenco voci variabili."
  },
  "0687": {
    title: "Indennità di Linea (Prestazione <= 10h)",
    explanation: "Indennità per servizi svolti in linea/manutenzione entro le 10 ore di turno.",
    location: "Corpo centrale. Verifica la colonna 'Quantità' per il numero di presenze."
  },
  "0AA1": {
    title: "Indennità di Trasferta (Esente)",
    explanation: "Rimborso forfettario (pasti/disagio) per servizio fuori sede. Non tassata.",
    location: "Verso il fondo del corpo centrale (voci variabili). Spesso ripetuta su più righe."
  },
  "0423": {
    title: "Compenso Cantiere Notte",
    explanation: "Indennità specifica per attività lavorativa notturna in regime di cantiere.",
    location: "Corpo centrale, voci variabili specifiche."
  },
  "0576": {
    title: "Indennità Orario Spezzato (Interv. <= 1h)",
    explanation: "Indennità per turni con interruzioni brevi (fino a 1 ora) tra le prestazioni.",
    location: "Corpo centrale, elenco voci variabili."
  },
  "0584": {
    title: "Reperibilità Festive o Riposo",
    explanation: "Maggiorazione per reperibilità prestata di domenica o giorni festivi.",
    location: "Corpo centrale. Verifica la colonna 'Quantità' o 'Giorni'."
  },
  "0919": {
    title: "Straordinario Feriale Diurno",
    explanation: "Ore eccedenti l'orario contrattuale in giorni feriali (6:00-22:00).",
    location: "Corpo centrale, prime posizioni lista variabili."
  },
  "0920": {
    title: "Str. Festivo Diurno / Feriale Notturno",
    explanation: "Straordinario con maggiorazione per orario notturno o giornata festiva.",
    location: "Corpo centrale, sotto le voci di straordinario ordinario."
  },
  "0932": {
    title: "Straordinario in Reperibilità (Diurno)",
    explanation: "Ore lavorate a seguito di chiamata in reperibilità (feriale diurno).",
    location: "Corpo centrale, vicino alle voci 0470/0482."
  },
  "0933": {
    title: "Straordinario in Reperibilità (Fest./Nott.)",
    explanation: "Ore lavorate dopo chiamata in reperibilità, di notte o festivo.",
    location: "Corpo centrale, voci variabili area straordinari."
  },
  "0995": {
    title: "Straordinario in Disponibilità (Diurno)",
    explanation: "Ore extra durante la disponibilità.",
    location: "Corpo centrale."
  },
  "0996": {
    title: "Straordinario Disponibilità (Nott./Fest.)",
    explanation: "Ore extra in disponibilità con maggiorazione notturna/festiva.",
    location: "Corpo centrale."
  },
  "0376": {
    title: "Indennità di Turno A",
    explanation: "Indennità legata alla tipologia di turnazione effettuata.",
    location: "Corpo centrale, elenco voci variabili."
  },
  "0686": {
    title: "Indennità Linea > 10 ore",
    explanation: "Indennità supplementare per turni in linea che superano le 10 ore.",
    location: "Corpo centrale, vicino alla voce 0687."
  },
  "daysWorked": {
    title: "Giornate Lavorative (Divisore)",
    explanation: "Numero giorni lavorati effettivi. Usato come divisore per le medie.",
    location: "Testata del cedolino (Box Presenze) o somma giorni lavorati nel corpo."
  },
  "daysVacation": {
    title: "Giorni Ferie (Moltiplicatore)",
    explanation: "Giorni di ferie goduti. Tetto max 28gg (Sent. Cass. 20216/2022).",
    location: "Testata del cedolino, riquadro 'Ferie' -> Colonna 'Godute' o 'Anno Corr.'."
  },
  "0457": {
    title: "Festivo Notturno (Alta Incidenza)",
    explanation: "Indennità per prestazione svolta in orario notturno (22-06) ricadente in giornata festiva. È una delle voci variabili più 'pesanti': la sua esclusione abbassa drasticamente la media giornaliera spettante.",
    location: "Corpo centrale. Verifica la concomitanza di 'Notti' e 'Festivi' nel calendario."
  },
  "3B70": {
    title: "Salario Produttività (Mensile)",
    explanation: "Quota mensile del premio di risultato/produttività. A differenza del premio annuale una tantum, questa voce è RICORRENTE (presente ogni mese), quindi DEVE rientrare nel calcolo della retribuzione feriale (Art. 64 CCNL).",
    location: "Corpo centrale, spesso verso la fine della lista competenze."
  },
  "3B71": {
    title: "Produttività Incrementale",
    explanation: "Elemento aggiuntivo al salario di produttività (3B70). Introdotto dai recenti accordi (2024), rappresenta una componente fissa della retribuzione variabile mensile. Va sommata al calcolo.",
    location: "Solitamente adiacente al codice 3B70."
  },
};

interface MonthlyDataGridProps {
  data: AnnoDati[];
  onDataChange: (newData: AnnoDati[]) => void;
  initialYear: number;
  onYearChange: (year: number) => void;
  profilo: ProfiloAzienda;
  onCellFocus?: (rowIndex: number, colId: string) => void;
}

const parseLocalFloat = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;

  let str = val.toString();

  // LOGICA INTELLIGENTE:
  // 1. Se la stringa contiene una virgola (es. "345,16" o "1.000,50"),
  //    allora è formato ITALIANO (Utente).
  if (str.includes(',')) {
    str = str.replace(/\./g, ''); // Rimuovi i punti delle migliaia
    str = str.replace(',', '.');  // Trasforma la virgola in punto
  }
  // 2. Altrimenti, se NON c'è virgola (es. "345.16"), 
  //    assumiamo sia formato AI/INGLESE. Non tocchiamo nulla.

  return parseFloat(str) || 0;
};

// Helper per ottenere giorni nel mese
const getDaysInMonth = (year: number, monthIndex: number) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const MonthlyDataGrid: React.FC<MonthlyDataGridProps> = ({
  data,
  onDataChange,
  initialYear,
  onYearChange,
  profilo,
  onCellFocus
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  // Stati Modali
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean; monthIndex: number; text: string }>({ isOpen: false, monthIndex: -1, text: '' });
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- 1. REF E LOGICA SCROLL (UNIFICATA) ---
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  // Larghezza dinamica per scorrere fino alla fine
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // Flags per il sync e intervallo scroll tasti
  const isSyncing = useRef(false);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);

  let ferieCumulateCounter = 0;
  const TETTO_FERIE = 28;

  useEffect(() => { setSelectedYear(initialYear); }, [initialYear]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    onYearChange(year);
  };

  // Funzioni Tasti Laterali
  const startScrolling = (direction: 'left' | 'right') => {
    if (scrollInterval.current) return;
    const step = 120;
    const speed = 2;
    scrollInterval.current = setInterval(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'auto' });
      }
    }, speed);
  };

  const stopScrolling = () => {
    if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; }
  };

  // --- SINCRONIZZAZIONE A 3 VIE (Top <-> Table <-> Bottom) ---
  useEffect(() => {
    const tableEl = tableContainerRef.current;
    const topEl = topScrollRef.current;
    const botEl = bottomScrollRef.current;

    if (!tableEl || !topEl || !botEl) return;

    // Calcolo larghezza reale
    const updateWidth = () => { if (tableEl) setTableScrollWidth(tableEl.scrollWidth); };
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(tableEl);

    const handleScroll = (source: HTMLElement) => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      window.requestAnimationFrame(() => {
        const left = source.scrollLeft;
        if (source !== tableEl && tableEl.scrollLeft !== left) tableEl.scrollLeft = left;
        if (source !== topEl && topEl.scrollLeft !== left) topEl.scrollLeft = left;
        if (source !== botEl && botEl.scrollLeft !== left) botEl.scrollLeft = left;
        isSyncing.current = false;
      });
    };

    const onTableScroll = () => handleScroll(tableEl);
    const onTopScroll = () => handleScroll(topEl);
    const onBotScroll = () => handleScroll(botEl);

    tableEl.addEventListener('scroll', onTableScroll);
    topEl.addEventListener('scroll', onTopScroll);
    botEl.addEventListener('scroll', onBotScroll);

    return () => {
      resizeObserver.disconnect();
      tableEl.removeEventListener('scroll', onTableScroll);
      topEl.removeEventListener('scroll', onTopScroll);
      botEl.removeEventListener('scroll', onBotScroll);
    };
  }, [profilo]); // Si riaggiorna se cambia il profilo/colonne
  // --- 1. CONFIGURAZIONE COLONNE ---
  const currentColumns = useMemo(() => {
    const cols = getColumnsByProfile(profilo);
    return cols.filter(c => c.id !== 'ticket');
  }, [profilo]);

  const editableColumns = useMemo(() => {
    return currentColumns.filter(col =>
      col.id !== 'month' && col.id !== 'total' && col.id !== 'note'
    );
  }, [currentColumns]);
  // --- CALCOLO TOTALI RIGA ---
  const calculateRowTotal = useCallback((row: any): number => {
    if (!row) return 0;
    let sum = 0;
    currentColumns.forEach(col => {
      if (
        col.id !== 'month' && col.id !== 'total' &&
        col.id !== 'daysWorked' && col.id !== 'daysVacation' &&
        col.id !== 'ticket' && col.id !== 'note' &&
        col.id !== 'arretrati' // <--- MODIFICA: ESCLUDA ARRETRATI DAL TOTALE RIGA
      ) {
        const val = parseLocalFloat(row[col.id]);
        const num = parseLocalFloat(val);
        if (num && !isNaN(num)) sum += num;
      }
    });
    return sum;
  }, [currentColumns]);

  const currentYearData = useMemo(() => {
    return Array.isArray(data) ? data.filter(d => d.year === selectedYear) : [];
  }, [data, selectedYear]);

  const columnTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    currentColumns.forEach(col => {
      if (col.id === 'month' || col.id === 'note') return;
      let colSum = 0;
      for (let i = 0; i < 12; i++) {
        const row = currentYearData.find(d => d.monthIndex === i) || {};
        let val: number = 0;
        if (col.id === 'total') val = calculateRowTotal(row);
        else val = parseLocalFloat((row as any)[col.id]);
        if (val && !isNaN(val)) colSum += val;
      }
      totals[col.id] = colSum;
    });
    return totals;
  }, [currentYearData, calculateRowTotal, currentColumns]);

  // --- 2. STATISTICHE HEADER ---
  const annualStats = useMemo(() => {
    // MODIFICA: Aggiunto 'arretrati' alla lista delle esclusioni
    const indennitaCols = currentColumns.filter(col =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'note', 'arretrati'].includes(col.id)
    );
    let totIndennita = 0;
    let totGiorniLav = 0;
    currentYearData.forEach(row => {
      indennitaCols.forEach(col => { totIndennita += parseLocalFloat((row as any)[col.id]); });
      totGiorniLav += parseLocalFloat(row.daysWorked);
    });
    const mediaAnnuale = totGiorniLav > 0 ? totIndennita / totGiorniLav : 0;
    return { totIndennita, totGiorniLav, mediaAnnuale };
  }, [currentYearData, currentColumns]);

  const currentRows = useMemo(() => {
    return MONTH_NAMES.map((monthName, index) => {
      const existingRow = currentYearData.find(d => d.monthIndex === index) || {};
      return { ...existingRow, month: monthName, monthIndex: index, year: selectedYear };
    });
  }, [currentYearData, selectedYear]);

  // --- HANDLERS ---
  const handleCellChange = (monthIndex: number, field: string, value: string) => {
    const existingRow = currentYearData.find(d => d.monthIndex === monthIndex);
    const updatedRow = {
      ...(existingRow || {}),
      year: selectedYear,
      monthIndex: monthIndex,
      month: MONTH_NAMES[monthIndex],
      [field]: value
    };
    const otherData = data.filter(d => !(d.year === selectedYear && d.monthIndex === monthIndex));
    onDataChange([...otherData, updatedRow]);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>, rowIndex: number, colId: string) => {
    if (activeRowIndex !== rowIndex) {
      setActiveRowIndex(rowIndex);
    }
    if (onCellFocus) onCellFocus(rowIndex, colId);
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colId: string) => {
    const colIdx = editableColumns.findIndex(c => c.id === colId);
    if (colIdx === -1) return;

    let nextRow = rowIndex;
    let nextColIdx = colIdx;

    switch (e.key) {
      case 'ArrowUp': nextRow = Math.max(0, rowIndex - 1); break;
      case 'ArrowDown': nextRow = Math.min(11, rowIndex + 1); break;
      case 'ArrowLeft': nextColIdx = Math.max(0, colIdx - 1); break;
      case 'ArrowRight': nextColIdx = Math.min(editableColumns.length - 1, colIdx + 1); break;
      case 'Enter':
        e.preventDefault();
        if (colIdx >= editableColumns.length - 1) { nextColIdx = 0; nextRow = Math.min(11, rowIndex + 1); }
        else { nextColIdx = colIdx + 1; }
        break;
      default: return;
    }

    if (nextRow === rowIndex && nextColIdx === colIdx) return;
    if (e.key.startsWith('Arrow')) e.preventDefault();

    const nextId = `input-${nextRow}-${editableColumns[nextColIdx].id}`;

    requestAnimationFrame(() => {
      const nextEl = document.getElementById(nextId) as HTMLInputElement;
      if (nextEl) {
        nextEl.focus();
        nextEl.select();
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColId: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;
    const rows = clipboardData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
    const startColIdx = editableColumns.findIndex(c => c.id === startColId);
    if (startColIdx === -1) return;
    let newData = [...data];
    rows.forEach((rowStr, i) => {
      const targetRowIdx = startRowIndex + i;
      if (targetRowIdx > 11) return;
      const cols = rowStr.split('\t');
      cols.forEach((value, j) => {
        const targetColIdx = startColIdx + j;
        if (targetColIdx >= editableColumns.length) return;
        const targetColId = editableColumns[targetColIdx].id;
        const existingRowIndex = newData.findIndex(d => d.year === selectedYear && d.monthIndex === targetRowIdx);
        if (existingRowIndex >= 0) { newData[existingRowIndex] = { ...newData[existingRowIndex], [targetColId]: value.trim() }; }
        else { newData.push({ year: selectedYear, monthIndex: targetRowIdx, month: MONTH_NAMES[targetRowIdx], daysWorked: 0, daysVacation: 0, ticket: 0, [targetColId]: value.trim() }); }
      });
    });
    onDataChange(newData);
  };

  const openNoteModal = (monthIndex: number, currentNote: string | undefined) => setNoteModal({ isOpen: true, monthIndex, text: currentNote || '' });
  const closeNoteModal = () => setNoteModal(prev => ({ ...prev, isOpen: false }));
  const saveNote = () => { if (noteModal.monthIndex !== -1) handleCellChange(noteModal.monthIndex, 'note', noteModal.text); closeNoteModal(); };
  const clearNote = () => setNoteModal(prev => ({ ...prev, text: '' }));
  const addTag = (tag: string) => setNoteModal(prev => ({ ...prev, text: prev.text ? `${prev.text}, ${tag}` : tag }));

  return (
    <>
      <div className="flex flex-col h-full bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200 select-none group/main-container">
        <style>{`
          /* Nasconde la scrollbar nativa dalla tabella principale */
          .hide-native-scrollbar::-webkit-scrollbar { display: none; }
          .hide-native-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          /* Stile barre fantasma: invisibili di base */
          .custom-scrollbar-x::-webkit-scrollbar { height: 16px; }
          .custom-scrollbar-x::-webkit-scrollbar-track { background: transparent; border-top: 1px solid transparent; }
          .custom-scrollbar-x::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 8px; border: 4px solid transparent; background-clip: content-box; }
          
          /* Hover: Appaiono SOLO quando passi sopra il contenitore .group/main-container */
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-track { background: #f8fafc; border-top: 1px solid #e2e8f0; }
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb { background-color: #cbd5e1; }
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        `}</style>

        {/* --- HEADER --- */}
        <div className="bg-slate-800 text-white p-2 flex items-center justify-between shrink-0 z-20 shadow-md">
          <div className="flex flex-wrap items-center gap-1 flex-1 mr-4">
            <div className="flex items-center px-3 text-slate-400 border-r border-slate-600 mr-2 h-8">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="text-xs font-bold uppercase tracking-widest select-none">Periodo</span>
            </div>
            {YEARS.map(year => (
              <button
                key={year}
                onClick={() => handleYearChange(year)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border border-transparent ${selectedYear === year ? 'bg-blue-500 text-white shadow-md border-blue-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-600'}`}
              >
                {year}
              </button>
            ))}

            {/* --- NUOVO TASTO MANUALE LEGALE (POSIZIONATO QUI) --- */}
            <button
              onClick={() => setLegalModalOpen(true)}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-full text-xs font-bold transition-all border border-slate-600 hover:border-slate-500 shadow-sm group"
            >
              <Scale size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Manuale Legale</span>
            </button>

          </div>

          <div className="flex items-center gap-4 pr-2 pl-4 border-l border-slate-600 shrink-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} className="group flex flex-col items-end bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-lg cursor-default transition-all hover:shadow-blue-500/20 hover:border-blue-400/30">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 group-hover:text-blue-300 transition-colors">Media Giornaliera</span>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all"><TrendingUp size={14} /></div>
                <span className="text-xl font-black text-white tracking-tight">{formatCurrency(annualStats.mediaAnnuale)}</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} whileHover={{ y: -3 }} className="group flex flex-col items-end bg-gradient-to-br from-emerald-900/40 to-slate-900/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-lg cursor-default transition-all hover:shadow-emerald-500/20 hover:border-emerald-400/30">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 group-hover:text-emerald-300 transition-colors">Totale Indennità Variabili</span>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all"><Wallet size={14} /></div>
                <span className="text-xl font-black text-white tracking-tight">{formatCurrency(annualStats.totIndennita)}</span>
              </div>
            </motion.div>
          </div>
        </div>
        {/* --- TICKER LEGALE (CORRETTO: NESSUNA SOVRAPPOSIZIONE) --- */}
        <div className="bg-amber-50/80 border-b border-amber-100 py-1.5 px-4 flex items-center h-8 shrink-0 gap-4">

          {/* 1. ETICHETTA FISSA (Non si muove, ha priorità di spazio) */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700 uppercase tracking-widest shrink-0 z-20">
            <AlertTriangle size={12} className="animate-pulse" />
            <span className="whitespace-nowrap">Nota Metodologica:</span>
          </div>

          {/* 2. AREA DI SCORRIMENTO (Occupa solo lo spazio rimanente a destra) */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">

            {/* Sfumatura sinistra (per non tagliare il testo di netto vicino all'etichetta) */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-amber-50 to-transparent z-10"></div>

            {/* Sfumatura destra */}
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-amber-50 to-transparent z-10"></div>

            <motion.div
              className="whitespace-nowrap text-[11px] font-medium text-amber-800 flex gap-12 pl-4" // pl-4 per dare respiro iniziale
              animate={{ x: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
            >
              {/* Blocco 1 */}
              <span className="flex items-center gap-2">
                Per un calcolo preciso della media storica, è fondamentale compilare anche i dati dell'anno precedente (es. per il 2008, inserire prima il 2007).
              </span>
              <span className="text-amber-400">•</span>
              <span className="flex items-center gap-2">
                Il sistema utilizzerà automaticamente i dati storici per determinare il valore corretto delle ferie.
              </span>
              <span className="text-amber-400">•</span>

              {/* Blocco 2 (Copia esatta per il loop infinito fluido) */}
              <span className="flex items-center gap-2">
                Per un calcolo preciso della media storica, è fondamentale compilare anche i dati dell'anno precedente (es. per il 2008, inserire prima il 2007).
              </span>
              <span className="text-amber-400">•</span>
              <span className="flex items-center gap-2">
                Il sistema utilizzerà automaticamente i dati storici per determinare il valore corretto delle ferie.
              </span>
              <span className="text-amber-400">•</span>
            </motion.div>
          </div>
        </div>
        {/* --- GHOST SCROLLBAR SUPERIORE --- */}
        <div className="bg-white border-b border-slate-200 shrink-0 flex items-center justify-center">
          <div
            ref={topScrollRef}
            className="overflow-x-auto custom-scrollbar-x w-full"
            style={{ paddingLeft: '40px', paddingRight: '40px' }}
          >
            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
          </div>
        </div>
        {/* --- CORPO CENTRALE --- */}
        <div className="flex-1 flex flex-row relative min-h-0 bg-slate-50">

          <div
            onMouseDown={() => startScrolling('left')}
            onMouseUp={stopScrolling}
            onMouseLeave={stopScrolling}
            className="w-10 bg-white border-r border-slate-200 z-30 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer group/arrow shadow-sm shrink-0"
          >
            <div className="opacity-0 group-hover/main-container:opacity-100 transition-opacity duration-300 transform group-hover/arrow:scale-110 group-active/arrow:scale-95">
              <ChevronLeft size={28} className="text-slate-400 group-hover/arrow:text-blue-600" />
            </div>
          </div>

          <div ref={tableContainerRef} className="flex-1 overflow-auto hide-native-scrollbar scroll-smooth">
            <table className="text-sm border-collapse table-fixed" style={{ minWidth: `${currentColumns.length * 100}px` }}>
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-300">
                  {currentColumns.map((col, idx) => {
                    const detail = INDENNITA_DETAILS[col.id];
                    const isLastColumn = idx >= currentColumns.length - 2;

                    const tooltipClass = isLastColumn ? "right-full mr-1" : "left-full ml-1";
                    const arrowClass = isLastColumn ? "right-4" : "left-4";

                    return (
                      <th key={col.id}
                        className={`
                          p-2 font-bold text-center border-r border-slate-300 select-none 
                          ${col.width ? col.width : 'w-24'} 
                          ${col.id === 'total' ? 'bg-slate-200 text-slate-800' : ''} 
                          ${idx === 0 ? 'sticky left-0 bg-slate-100 z-20 border-r-2 border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
                          relative hover:!z-[1000]
                        `}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight h-10 group/head relative">
                          <span className="truncate w-full block text-[11px] uppercase tracking-tight">{col.label.replace(/\(.*\)/, '')}</span>

                          {col.id !== 'month' && col.id !== 'total' && col.id !== 'arretrati' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              {col.id !== 'daysWorked' && col.id !== 'daysVacation' && (
                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded border border-slate-300/50">{col.id}</span>
                              )}

                              {detail && (
                                <div className="relative">
                                  <Info size={11} className="text-slate-400 hover:text-blue-600 cursor-help transition-colors" />
                                  <div className={`hidden group-hover/head:block absolute top-8 ${tooltipClass} w-64 p-0 bg-slate-800 text-white rounded-lg shadow-xl z-[1000] pointer-events-none text-left border border-slate-600 overflow-hidden`}>
                                    <div className="bg-slate-900 px-3 py-2 border-b border-slate-600">
                                      <p className="text-[11px] font-bold text-white leading-tight">{detail.title}</p>
                                    </div>
                                    <div className="p-3 space-y-2">
                                      <p className="text-[10px] text-slate-300 leading-snug">{detail.explanation}</p>
                                      <div className="flex gap-2 pt-2 border-t border-slate-700 mt-1">
                                        <div className="shrink-0 mt-0.5 text-amber-400"><MapPin size={12} /></div>
                                        <div>
                                          <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">Posizione nel Cedolino</p>
                                          <p className="text-[10px] text-slate-400 leading-snug">{detail.location}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={`absolute -top-1 ${arrowClass} border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-slate-900`}></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="bg-white">
                {currentRows.map((row, rowIndex) => {
                  const rowTotal = calculateRowTotal(row);
                  const note = (row as any).note;
                  const aiWarning = (row as any).aiWarning;
                  const hasAiWarning = aiWarning && aiWarning !== "Nessuna anomalia";
                  const isActiveRow = activeRowIndex === rowIndex;

                  const vacDays = parseLocalFloat(row.daysVacation);
                  const workedDays = parseLocalFloat(row.daysWorked);

                  const prevTotal = ferieCumulateCounter;
                  ferieCumulateCounter += vacDays;

                  const isOverLimit = prevTotal >= TETTO_FERIE;
                  const isPartialLimit = !isOverLimit && ferieCumulateCounter > TETTO_FERIE;
                  const eccedenza = isPartialLimit ? (ferieCumulateCounter - TETTO_FERIE) : (isOverLimit ? vacDays : 0);
                  const utili = vacDays - eccedenza;

                  // --- VALIDAZIONE DATI (Data Quality) ---

                  // 1. Controllo Somma Giorni (Mese Reale)
                  const totalDaysInput = workedDays + vacDays; // Se si aggiungono malattie, sommare qui
                  const daysInMonth = getDaysInMonth(selectedYear, rowIndex);
                  const isDayCountError = totalDaysInput > daysInMonth;

                  // 2. Controllo Divisore (Fatal)
                  // Se ho indennità (> 0) ma 0 giorni lavorati -> ERRORE
                  // Calcoliamo se ci sono indennità (escludendo daysWorked, daysVacation etc)
                  let hasIndennita = false;
                  currentColumns.forEach(c => {
                    if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'note'].includes(c.id)) {
                      if (parseLocalFloat(row[c.id]) > 0) hasIndennita = true;
                    }
                  });
                  const isDivisorError = hasIndennita && workedDays === 0;

                  // Colore Riga Validazione
                  let rowClass = isActiveRow ? 'bg-indigo-50/60 ring-1 ring-indigo-200 z-10 relative' : 'group hover:bg-slate-50';
                  if (isDayCountError) rowClass = 'bg-orange-50 hover:bg-orange-100 ring-1 ring-orange-200 z-10 relative';
                  if (isDivisorError) rowClass = 'bg-red-50 hover:bg-red-100 ring-1 ring-red-200 z-10 relative';

                  return (
                    <tr key={rowIndex} className={`transition-colors duration-75 h-10 ${rowClass}`}>
                      {currentColumns.map((col, colIndex) => {
                        const cellValue = (row as any)[col.id];
                        const isTotal = col.id === 'total';
                        const isMonth = col.id === 'month';
                        const isVacation = col.id === 'daysVacation';
                        const isVacationWarning = isVacation && (isOverLimit || isPartialLimit);
                        const detail = INDENNITA_DETAILS[col.id];
                        const isLastColumn = colIndex >= currentColumns.length - 2;

                        const tooltipClass = isLastColumn ? "right-full mr-1" : "left-full ml-1";

                        return (
                          <td key={col.id} className={`
                                border-r border-b border-slate-300 p-0 relative
                                ${colIndex === 0 ? 'sticky left-0 bg-white font-semibold text-slate-700 z-10 border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
                                /* Overrides per errori validazione sulla prima colonna */
                                ${(isDayCountError || isDivisorError) && colIndex === 0 ? (isDivisorError ? '!bg-red-100 text-red-800' : '!bg-orange-100 text-orange-800') : ''}
                                ${isActiveRow && colIndex === 0 && !isDayCountError && !isDivisorError ? '!bg-indigo-100 text-indigo-800' : ''}
                                
                                ${isTotal ? 'bg-slate-50 font-bold text-slate-800 text-right pr-2' : ''}
                                ${isVacation ? 'bg-amber-50/20' : ''}
                                ${isVacationWarning ? 'ring-2 ring-inset ring-red-400/50' : ''}
                                
                                hover:!z-[1000]
                              `}
                          >
                            {isMonth ? (
                              <div className="flex items-center justify-between px-3 h-full w-full">
                                <div className="flex items-center gap-2 overflow-hidden relative group/ai">
                                  {/* Icone Errore Validazione e AUDITOR AI */}
                                  {isDivisorError ? (
                                    <div className="text-red-600 animate-pulse" title="ERRORE: Indennità presenti senza giorni lavorati"><AlertCircle size={14} /></div>
                                  ) : isDayCountError ? (
                                    <div className="text-orange-500" title={`ATTENZIONE: Totale giorni (${totalDaysInput}) supera il limite del mese (${daysInMonth})`}><TriangleAlert size={14} /></div>
                                  ) : hasAiWarning ? (
                                    <div className="text-red-500 cursor-help" title="Anomalia Rilevata dall'IA"><AlertCircle size={14} className="animate-bounce" /></div>
                                  ) : aiWarning === "Nessuna anomalia" ? (
                                    <div className="text-emerald-500"><CheckCircle2 size={14} /></div>
                                  ) : null}

                                  {/* TOOLTIP AUDITOR AI HOVER (Si apre passando sopra al mese) */}
                                  {hasAiWarning && (
                                    <div className="hidden group-hover/ai:block absolute left-6 top-6 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl z-[9999] whitespace-normal leading-tight border border-slate-700">
                                      <span className="font-bold text-red-400 block mb-1">Avviso AI:</span>
                                      {aiWarning}
                                    </div>
                                  )}

                                  <div className="text-xs font-bold uppercase tracking-wide truncate max-w-[70px]" title={note}>{MONTH_NAMES[rowIndex]}</div>
                                </div>
                                <button onClick={() => openNoteModal(rowIndex, note)} tabIndex={-1} className={`p-1.5 rounded-lg transition-all focus:outline-none ${note ? 'text-amber-600 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-300' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}><MessageSquareText className="w-3.5 h-3.5" strokeWidth={note ? 2.5 : 2} /></button>
                              </div>
                            ) : isTotal ? (
                              <div className="w-full h-full flex items-center justify-end px-2 tabular-nums text-xs">{rowTotal !== 0 ? formatCurrency(rowTotal) : '-'}</div>
                            ) : (
                              <div className="relative w-full h-10 group/cell">
                                <input
                                  id={`input-${rowIndex}-${col.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  className={`
                                        w-full h-full bg-transparent px-2 text-right outline-none transition-all tabular-nums text-xs placeholder:text-transparent
                                        focus:bg-white focus:z-20 focus:ring-2 focus:ring-indigo-500 focus:text-indigo-700 font-medium hover:bg-slate-50/80
                                        ${cellValue ? 'text-slate-900' : 'text-slate-500'}
                                        ${isVacationWarning
                                      ? 'text-red-600 font-black decoration-4 decoration-red-500 bg-[linear-gradient(45deg,transparent_45%,rgba(255,0,0,0.3)_50%,transparent_55%)]'
                                      : ''}
                                        ${!isVacation && col.id === 'daysWorked' ? 'text-blue-700 font-bold' : ''}
                                      `}
                                  placeholder="0"
                                  value={cellValue ?? ''}
                                  onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)}
                                  onFocus={(e) => handleInputFocus(e, rowIndex, col.id)}
                                  onBlur={() => setActiveRowIndex(null)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, col.id)}
                                  onPaste={(e) => handlePaste(e, rowIndex, col.id)}
                                />

                                {/* --- TOOLTIP GENERALE --- */}
                                {!isVacationWarning && detail && (
                                  <div className={`hidden group-hover/cell:block absolute top-0 ${tooltipClass} w-60 bg-white/95 backdrop-blur border border-slate-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.15)] rounded-lg z-[1000] pointer-events-none overflow-hidden`}>
                                    <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                      <div className="bg-white p-1 rounded-md shadow-sm text-indigo-600 border border-indigo-100">
                                        <BookOpen size={10} />
                                      </div>
                                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Dettaglio Voce</span>
                                    </div>
                                    <div className="p-3">
                                      <p className="text-[11px] font-bold text-slate-800 mb-1 leading-tight">{detail.title}</p>
                                      <p className="text-[10px] text-slate-500 mb-3 leading-snug border-b border-slate-100 pb-2">
                                        {detail.explanation}
                                      </p>
                                      <div className="flex gap-2 items-start bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className="text-xs">📍</span>
                                        <div>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Posizione Busta Paga</span>
                                          <span className="text-[10px] text-slate-600 leading-tight block">{detail.location}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* --- TOOLTIP INTELLIGENTE FERIE --- */}
                                {isVacationWarning && (
                                  <>
                                    <div className="absolute top-0.5 left-0.5 z-10 pointer-events-none">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-500 fill-red-100" />
                                    </div>

                                    <div className={`hidden group-hover/cell:block absolute top-6 ${tooltipClass === 'left-full ml-1' ? 'left-0' : 'right-0'} w-72 p-3 bg-slate-900/95 text-white text-[11px] rounded-lg shadow-2xl z-[1000] border border-slate-700 backdrop-blur-sm pointer-events-none`}>
                                      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1.5 uppercase tracking-wider text-[10px]">
                                        <AlertCircle size={12} /> Soglia Legale Superata
                                      </div>
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-slate-300"><span>Hai inserito:</span> <span className="font-bold text-white text-xs">{formatInteger(vacDays)} gg</span></div>
                                        <div className="flex justify-between items-center text-slate-300"><span>Massimo (Legale):</span> <span className="font-mono text-xs">{TETTO_FERIE} gg</span></div>
                                        <div className="flex justify-between items-center bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                                          <span className="text-red-300 font-bold">Eccedenza (Tagliata):</span>
                                          <span className="font-black text-red-400 text-xs">+{formatInteger(eccedenza)} gg</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/30">
                                          <span className="text-emerald-300 font-bold">Conteggiati:</span>
                                          <span className="font-black text-emerald-400 text-xs">{formatInteger(utili)} gg</span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2 italic leading-relaxed border-t border-slate-700 pt-1">
                                          Ai sensi della <strong>Sentenza Cass. 23/6/2022 n. 20216</strong>, il periodo minimo protetto è di 28 giorni. L'eccedenza non concorre al calcolo della retribuzione feriale.
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                <tr className="font-bold text-slate-800">
                  {currentColumns.map((col, index) => {
                    if (col.id === 'month') return <td key="total-label" className="sticky left-0 bg-amber-200 border-r-2 border-slate-300 px-3 py-3 text-left text-xs uppercase tracking-wider z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTALE {selectedYear}</td>;
                    const totalVal = columnTotals[col.id];
                    if (col.id === 'daysVacation') {
                      const totReale = columnTotals['daysVacation'];
                      const totUtile = Math.min(totReale, TETTO_FERIE);
                      return (<td key={col.id} className="border-r border-slate-300 px-2 py-3 text-right bg-amber-100/50"><div className="flex flex-col items-end leading-tight"><span className="text-[10px] text-slate-500 font-normal">Tot: {formatInteger(totReale)}</span><span className="text-xs font-black text-slate-800">Utili: {formatInteger(totUtile)}</span></div></td>)
                    }
                    const cellBg = col.id === 'total' ? 'bg-slate-200 text-slate-900' : 'bg-amber-100/50';
                    return <td key={`total-${col.id}`} className={`border-r border-slate-300 px-2 py-3 text-right tabular-nums text-xs ${cellBg}`}>{col.type === 'integer' ? (totalVal !== 0 ? formatInteger(totalVal) : '-') : (totalVal && totalVal !== 0 ? formatCurrency(totalVal) : '-')}</td>;
                  })}
                </tr>
                <tr>
                  <td colSpan={100} className="p-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 italic">
                    <div className="flex items-center gap-2"><Info className="w-3 h-3" /><span>Nota: I giorni di ferie eccedenti la soglia legale di {TETTO_FERIE} (rif. Cass. 20216/2022) sono evidenziati in rosso ed esclusi dal calcolo.</span></div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div
            onMouseDown={() => startScrolling('right')}
            onMouseUp={stopScrolling}
            onMouseLeave={stopScrolling}
            className="w-10 bg-white border-l border-slate-200 z-30 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer group/arrow shadow-sm shrink-0"
          >
            <div className="opacity-0 group-hover/main-container:opacity-100 transition-opacity duration-300 transform group-hover/arrow:scale-110 group-active/arrow:scale-95">
              <ChevronRight size={28} className="text-slate-400 group-hover/arrow:text-blue-600" />
            </div>
          </div>

        </div>
        {/* --- GHOST SCROLLBAR INFERIORE (Sync) --- */}
        <div className="bg-white border-t border-slate-200 shrink-0 flex items-center justify-center">
          <div
            ref={bottomScrollRef}
            className="overflow-x-auto custom-scrollbar-x w-full"
            style={{ paddingLeft: '40px', paddingRight: '40px' }}
          >
            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
          </div>
        </div>

        {/* MODALE NOTE */}
        <AnimatePresence>
          {noteModal.isOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeNoteModal}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg text-amber-600"><MessageSquareText className="w-5 h-5" /></div><div><h3 className="font-bold text-slate-800">Nota Mensile</h3><p className="text-xs text-slate-500 uppercase tracking-wider">{noteModal.monthIndex >= 0 ? MONTH_NAMES[noteModal.monthIndex] : ''} {selectedYear}</p></div></div>
                  <button onClick={closeNoteModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-semibold text-slate-600 mb-2">Descrizione Evento</label>
                  <textarea value={noteModal.text} onChange={(e) => setNoteModal(prev => ({ ...prev, text: e.target.value }))} className="w-full h-32 px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none text-slate-700 text-sm transition-all" placeholder="Scrivi qui il motivo..." autoFocus />
                  <div className="mt-4"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inserimento Rapido</p><div className="flex flex-wrap gap-2">{QUICK_TAGS.map(tag => (<button key={tag} onClick={() => addTag(tag)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-medium transition-colors border border-slate-200 hover:border-indigo-200"><Tag className="w-3 h-3" />{tag}</button>))}</div></div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <button onClick={clearNote} className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors"><Eraser className="w-4 h-4" /> Pulisci</button>
                  <div className="flex gap-3"><button onClick={closeNoteModal} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm">Annulla</button><button onClick={saveNote} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95"><Save className="w-4 h-4" /> Salva Nota</button></div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODALE MANUALE LEGALE --- */}
        <AnimatePresence>
          {legalModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setLegalModalOpen(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                {/* Header Modale */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Scale className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Manuale Legale & Riferimenti</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Perizia Tecnica Ferie non Godute</p>
                    </div>
                  </div>
                  <button onClick={() => setLegalModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* Contenuto Scrollabile */}
                <div className="p-8 overflow-y-auto space-y-8">

                  {/* Sezione 1: Art. 64 */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-3 text-indigo-700">
                      <BookOpen size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Articolo 64 CCNL Mobilità</h4>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed text-justify mb-4">
                      "Durante le ferie il lavoratore ha diritto alla retribuzione che avrebbe percepito se avesse lavorato,
                      comprensiva delle indennità fisse e variabili legate alla modalità di esecuzione della prestazione."
                    </p>
                    <div className="text-xs text-slate-500 border-t border-slate-200 pt-3 italic">
                      Nota: Questo principio è stato rafforzato dalla giurisprudenza europea e dalla Corte di Cassazione,
                      impedendo che il lavoratore subisca svantaggi economici durante il riposo.
                    </div>
                  </div>

                  {/* Sezione 2: Il Divisore */}
                  <div className="bg-amber-50 p-6 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3 text-amber-700">
                      <TrendingUp size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Il Calcolo del Divisore</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-700 leading-relaxed text-justify">
                        Il <strong>divisore</strong> è il numero utilizzato per trasformare il totale delle indennità mensili in una quota giornaliera media.
                      </p>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
                        <li>
                          <strong>Divisore Convenzionale (26):</strong> Spesso usato dalle aziende per semplicità, ma penalizzante se si lavorano meno giorni.
                        </li>
                        <li>
                          <strong>Divisore Effettivo (Consigliato):</strong> Si utilizza il numero reale di giorni lavorati nel mese (es. 20, 21, 22). Questo metodo alza il valore medio giornaliero ed è quello preferito nei ricorsi (Cass. 20216/2022).
                        </li>
                      </ul>
                      <div className="bg-white p-3 rounded border border-amber-100 text-xs font-mono text-slate-600">
                        Formula: Totale Indennità / Giorni Lavorati = Media Giornaliera
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right shrink-0">
                  <button onClick={() => setLegalModalOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-lg">Chiudi Manuale</button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
};

export default MonthlyDataGrid;