import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MONTH_NAMES,
  YEARS,
  AnnoDati,
  getColumnsByProfile,
  ProfiloAzienda,
  evaluateFormula
} from '../../types';
import { parseLocalFloat, formatCurrency, formatDay } from '../../utils/formatters';
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
  Scale,
  TriangleAlert,
  AlertTriangle,
  CheckCircle2,
  Undo2,
  Copy,
  ClipboardPaste,
  ShieldCheck,
  Loader2,
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

export interface VerifyDiscrepancy {
  field: string;
  extracted: number;
  suggested: number;
  message: string;
}

export interface VerifyState {
  status: 'loading' | 'success' | 'warning' | 'error';
  discrepancies: VerifyDiscrepancy[];
  errorMessage?: string;
}

interface MonthlyDataGridProps {
  data: AnnoDati[];
  onDataChange: (newData: AnnoDati[]) => void;
  initialYear: number;
  onYearChange: (year: number) => void;
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  onCellFocus?: (rowIndex: number, colId: string) => void;
  years: number[];  // Range dinamico controllato dal parent
  // Verifica AI: chiave `${year}-${monthIndex}` → storage_path
  archiveEntries?: Record<string, string>;
  verifyStates?: Record<string, VerifyState>;
  onVerifyRequest?: (row: AnnoDati) => void;
  onAcceptCorrection?: (year: number, monthIndex: number, field: string, value: number) => void;
  onAcceptAllCorrections?: (year: number, monthIndex: number) => void;
}

// parseLocalFloat importato da formatters

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
  eliorType,
  onCellFocus,
  years,
  archiveEntries = {},
  verifyStates = {},
  onVerifyRequest,
  onAcceptCorrection,
  onAcceptAllCorrections,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  // Stati Modali
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean; monthIndex: number; text: string }>({ isOpen: false, monthIndex: -1, text: '' });
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [rowToClear, setRowToClear] = useState<number | null>(null);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  // --- STATO MENU CONTESTUALE (TASTO DESTRO) ---
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; rowIndex: number; colId: string;
  } | null>(null);

  // Chiude il menu contestuale cliccando altrove o premendo Esc
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);
  // --- STATI DRAG-TO-FILL OMNIDIREZIONALE ---
  const [dragSelection, setDragSelection] = useState<{
    isDragging: boolean; startRow: number; endRow: number; startColIdx: number; endColIdx: number; startValue: string | number;
  }>({
    isDragging: false, startRow: -1, endRow: -1, startColIdx: -1, endColIdx: -1, startValue: ''
  });
  // --- STATI SELEZIONE CELLE (PER CANCELLAZIONE MASSIVA) ---
  const [cellSelection, setCellSelection] = useState<{
    isSelecting: boolean; startRow: number; endRow: number; startColIdx: number; endColIdx: number; active: boolean;
  }>({ isSelecting: false, startRow: -1, endRow: -1, startColIdx: -1, endColIdx: -1, active: false });

  const handleCellMouseDown = (e: React.MouseEvent, rowIndex: number, colIdx: number) => {
    if (e.button !== 0) return;
    // Se clicchiamo sul quadratino magico, NON deve partire la selezione ma il drag-to-fill
    if ((e.target as HTMLElement).closest('.drag-handle')) return;

    // ✨ FIX: Se clicchiamo sulla colonna dei mesi (0), ignoriamo la selezione multipla
    if (colIdx === 0) return;

    setCellSelection({ isSelecting: true, startRow: rowIndex, endRow: rowIndex, startColIdx: colIdx, endColIdx: colIdx, active: true });
  };

  const handleCellMouseEnter = (rowIndex: number, colIdx: number) => {
    if (cellSelection.isSelecting) {
      setCellSelection(prev => ({ ...prev, endRow: rowIndex, endColIdx: colIdx }));
    }
  };
  // --- 1. REF E LOGICA SCROLL (UNIFICATA) ---
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  // Larghezza dinamica per scorrere fino alla fine
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  // STATO SCROLL (Per disabilitare hover pesanti mentre si muove)
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  // --- STATO MACCHINA DEL TEMPO (UNDO) ---
  const [history, setHistory] = useState<AnnoDati[][]>([]);
  // ✨ STATO TOAST UNDO RAPIDO (GMAIL STYLE)
  const [undoToast, setUndoToast] = useState<{ show: boolean, msg: string }>({ show: false, msg: '' });
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerUndoToast = (msg: string) => {
    setUndoToast({ show: true, msg });
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setUndoToast({ show: false, msg: '' }), 7000); // Scompare dopo 7 secondi
  };

  const performQuickUndo = () => {
    handleUndo();
    setUndoToast({ show: false, msg: '' });
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  };
  // Funzione wrapper che "fotografa" i dati prima di modificarli
  const updateDataWithHistory = useCallback((newData: AnnoDati[]) => {
    setHistory(prev => [...prev.slice(-99), data]); // Salva gli ultimi 100 passaggi
    onDataChange(newData);
  }, [data, onDataChange]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1)); // Rimuove l'ultimo step dalla memoria
    onDataChange(previousState);           // Ripristina la visuale
  }, [history, onDataChange]);

  // Ascolta la tastiera per Ctrl+Z da qualsiasi punto dello schermo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo]);
  // Flags per il sync e intervallo scroll tasti
  const isSyncing = useRef(false);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);

  let ferieCumulateCounter = 0;
  const TETTO_FERIE = 28;

  // --- CLEANUP GLOBALE TIMERS E INTERVALS (Anti-Memory Leak) ---
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (scrollInterval.current) clearInterval(scrollInterval.current);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  useEffect(() => { setSelectedYear(initialYear); }, [initialYear]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    onYearChange(year);
  };

  // Funzioni Tasti Laterali
  const startScrolling = (direction: 'left' | 'right') => {
    if (scrollInterval.current) return;

    // Bilanciamento perfetto per uno scroll fluido e continuo (tipo 60fps)
    const step = 15;  // Quanti pixel si sposta a ogni "scatto"
    const speed = 15; // Millisecondi tra uno scatto e l'altro

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
      // 1. Spegne gli effetti CSS per la massima fluidità
      if (!isScrolling) setIsScrolling(true);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150);

      if (isSyncing.current) return;

      // 2. Chiude il "lucchetto" per non creare un loop infinito
      isSyncing.current = true;

      // 3. APPLICAZIONE ISTANTANEA (Senza requestAnimationFrame = Latenza Zero)
      const left = source.scrollLeft;
      if (source !== tableEl) tableEl.scrollLeft = left;
      if (source !== topEl) topEl.scrollLeft = left;
      if (source !== botEl) botEl.scrollLeft = left;

      // 4. Riapre il lucchetto una frazione di secondo dopo per assorbire gli eventi "eco"
      window.requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    };

    const onTableScroll = () => handleScroll(tableEl);
    const onTopScroll = () => handleScroll(topEl);
    const onBotScroll = () => handleScroll(botEl);

    tableEl.addEventListener('scroll', onTableScroll, { passive: true });
    topEl.addEventListener('scroll', onTopScroll, { passive: true });
    botEl.addEventListener('scroll', onBotScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      tableEl.removeEventListener('scroll', onTableScroll);
      topEl.removeEventListener('scroll', onTopScroll);
      botEl.removeEventListener('scroll', onBotScroll);
    };
  }, [profilo, isScrolling]); // Si riaggiorna se cambia il profilo/colonne
  // --- 1. CONFIGURAZIONE COLONNE ---
  const currentColumns = useMemo(() => {
    const cols = getColumnsByProfile(profilo, eliorType);
    // ESCLUSIONE DEFINITIVA: Rimuoviamo Ticket e i codici di Produttività
    return cols.filter(c => !['ticket', '3B70', '3B71'].includes(c.id));
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
      // 1. Prendi i dati inseriti dall'utente per questo mese
      const existingRow = currentYearData.find(d => d.monthIndex === index) || {};
      let rowData = { ...existingRow, month: monthName, monthIndex: index, year: selectedYear };

      // 2. FORMULA ENGINE: Cerca le colonne "formula" e risolvile in tempo reale!
      currentColumns.forEach(col => {
        if (col.type === 'formula' && col.formula) {
          const result = evaluateFormula(col.formula, rowData);
          // Inserisce il risultato calcolato nella riga, pronto per essere visualizzato (e sommato)
          (rowData as any)[col.id] = result;
        }
      });

      return rowData;
    });
  }, [currentYearData, selectedYear, currentColumns]);
  // --- HELPER FORMULE ---
  // Ricalcola tutte le celle "formula" della riga prima di salvarla nel DB
  const applyFormulas = (row: any) => {
    const newRow = { ...row };
    currentColumns.forEach(col => {
      if (col.type === 'formula' && col.formula) {
        newRow[col.id] = evaluateFormula(col.formula, newRow);
      }
    });
    return newRow;
  };
  // --- HANDLERS ---
  const handleCellChange = (monthIndex: number, field: string, value: string) => {
    const existingRow = currentYearData.find(d => d.monthIndex === monthIndex);
    let updatedRow = {
      ...(existingRow || {}),
      year: selectedYear,
      monthIndex: monthIndex,
      month: MONTH_NAMES[monthIndex],
      [field]: value
    };

    // MAGIA: Ricalcola le formule e "fissa" il risultato prima di salvare
    updatedRow = applyFormulas(updatedRow);

    const otherData = data.filter(d => !(d.year === selectedYear && d.monthIndex === monthIndex));
    updateDataWithHistory([...otherData, updatedRow]);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>, rowIndex: number, colId: string) => {
    if (activeRowIndex !== rowIndex) setActiveRowIndex(rowIndex);
    if (activeColId !== colId) setActiveColId(colId);

    if (onCellFocus) onCellFocus(rowIndex, colId);
    e.target.select();
  };

  // --- FUNZIONE CHE ESEGUE LA CANCELLAZIONE REALE ---
  const confirmClearRow = () => {
    if (rowToClear === null) return;
    const meseNome = MONTH_NAMES[rowToClear]; // Salviamo il nome per il Toast

    const existingRow = currentYearData.find(d => d.monthIndex === rowToClear) || {};
    const updatedRow = { ...existingRow, year: selectedYear, monthIndex: rowToClear, month: meseNome };
    editableColumns.forEach(col => {
      if (col.id !== 'month' && col.id !== 'note') (updatedRow as any)[col.id] = 0;
    });
    const otherData = data.filter(d => !(d.year === selectedYear && d.monthIndex === rowToClear));
    updateDataWithHistory([...otherData, updatedRow]);

    setRowToClear(null); // Chiude il modale
    triggerUndoToast(`Dati di ${meseNome} azzerati.`); // ✨ ACCENDE IL TOAST!
  };
  // --- FUNZIONI MENU CONTESTUALE ---
  const handleContextMenu = (e: React.MouseEvent, rowIndex: number, colId: string) => {
    e.preventDefault(); // Blocca il menu standard del browser

    // Calcolo per evitare che il menu esca fuori dallo schermo
    const menuWidth = 230;
    const menuHeight = 200;

    let clickX = e.clientX;
    let clickY = e.clientY;

    if (clickX + menuWidth > window.innerWidth) clickX -= menuWidth;
    if (clickY + menuHeight > window.innerHeight) clickY -= menuHeight;

    setContextMenu({
      visible: true,
      x: clickX,
      y: clickY,
      rowIndex,
      colId
    });
    // Seleziona visivamente la cella
    setActiveRowIndex(rowIndex);
    setActiveColId(colId);
  };

  const handleCopyCell = () => {
    if (!contextMenu) return;
    const { rowIndex, colId } = contextMenu;
    const row = currentYearData.find(d => d.monthIndex === rowIndex) || {};
    const val = (row as any)[colId] || '';
    navigator.clipboard.writeText(val.toString());
  };

  const handlePasteCell = async () => {
    if (!contextMenu) return;
    try {
      const text = await navigator.clipboard.readText();
      const num = parseLocalFloat(text);
      if (!isNaN(num)) {
        handleCellChange(contextMenu.rowIndex, contextMenu.colId, text);
      }
    } catch (err) {
      console.error("Errore incolla", err);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colId: string) => {
    // --- Tasto rapido "Svuota Mese" (Alt + C) ---
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      setRowToClear(rowIndex);
      return;
    }

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
        if (colIdx >= editableColumns.length - 1) {
          nextColIdx = 0;
          nextRow = Math.min(11, rowIndex + 1);
        } else {
          nextColIdx = colIdx + 1;
        }
        break;
      case 'Tab':
        if (!e.shiftKey && colIdx >= editableColumns.length - 1) {
          e.preventDefault();
          nextColIdx = 0;
          nextRow = Math.min(11, rowIndex + 1);
        } else if (e.shiftKey && colIdx === 0) {
          e.preventDefault();
          nextColIdx = editableColumns.length - 1;
          nextRow = Math.max(0, rowIndex - 1);
        } else {
          return;
        }
        break;
      default: return;
    }

    if (nextRow === rowIndex && nextColIdx === colIdx) return;
    if (e.key.startsWith('Arrow')) e.preventDefault();

    const nextId = `input-${nextRow}-${editableColumns[nextColIdx].id}`;

    const nextEl = document.getElementById(nextId) as HTMLInputElement;
      if (nextEl) {
        // Focus istantaneo senza far saltare la pagina
        nextEl.focus({ preventScroll: true });
        nextEl.select();

        // --- MOTORE DI SCROLL FLUIDO CUSTOM (Ultra-Premium) ---
        if (tableContainerRef.current) {
          const container = tableContainerRef.current as any;
          const cell = nextEl.closest('td');

          if (cell) {
            const containerRect = container.getBoundingClientRect();
            const cellRect = cell.getBoundingClientRect();

            const stickyOffset = 110; // Larghezza colonna Mesi fissa
            const lookAhead = 100; // Pixel di "respiro" visivo extra

            let targetScroll = null;

            // Calcolo direzione e target
            if (cellRect.left < containerRect.left + stickyOffset) {
              targetScroll = container.scrollLeft - ((containerRect.left + stickyOffset) - cellRect.left) - lookAhead;
            } else if (cellRect.right > containerRect.right) {
              targetScroll = container.scrollLeft + (cellRect.right - containerRect.right) + lookAhead;
            }

            // Esecuzione Animazione Fluida a 60fps
            if (targetScroll !== null) {
              targetScroll = Math.max(0, targetScroll); // Non andare in negativo

              // Cancella eventuali animazioni precedenti se digiti velocissimo
              if (container._animId) cancelAnimationFrame(container._animId);

              const startScroll = container.scrollLeft;
              const distance = targetScroll - startScroll;
              let startTime: number | null = null;
              const duration = 120; // 120ms: il tempo perfetto tra velocità e morbidezza

              const animateScroll = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Curva Ease-Out Cubic (Decelerazione elegante)
                const ease = 1 - Math.pow(1 - progress, 3);

                container.scrollLeft = startScroll + distance * ease;

                if (progress < 1) {
                  container._animId = requestAnimationFrame(animateScroll);
                }
              };
              container._animId = requestAnimationFrame(animateScroll);
            }
          }
        }
      }
    
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
        if (existingRowIndex >= 0) {
          let updated = { ...newData[existingRowIndex], [targetColId]: value.trim() };
          newData[existingRowIndex] = applyFormulas(updated); // Applica Formula
        }
        else {
          let newRow = { year: selectedYear, monthIndex: targetRowIdx, month: MONTH_NAMES[targetRowIdx], daysWorked: 0, daysVacation: 0, ticket: 0, [targetColId]: value.trim() };
          newData.push(applyFormulas(newRow)); // Applica Formula
        }
      });
    });
    updateDataWithHistory(newData);
  };
  // --- FUNZIONI DRAG TO FILL OMNIDIREZIONALE ---
  const handleDragStart = (e: React.MouseEvent, rowIndex: number, colIdx: number, cellValue: any) => {
    if (e.button !== 0) return; // Solo click sinistro
    e.preventDefault();
    setDragSelection({ isDragging: true, startRow: rowIndex, endRow: rowIndex, startColIdx: colIdx, endColIdx: colIdx, startValue: cellValue ?? '' });
  };

  const handleDragEnter = (rowIndex: number, colIdx: number) => {
    if (dragSelection.isDragging) {
      setDragSelection(prev => ({ ...prev, endRow: rowIndex, endColIdx: colIdx }));
    }
  };

  const applyDragFill = useCallback(() => {
    if (!dragSelection.isDragging) return;

    const minRow = Math.min(dragSelection.startRow, dragSelection.endRow);
    const maxRow = Math.max(dragSelection.startRow, dragSelection.endRow);
    const minCol = Math.min(dragSelection.startColIdx, dragSelection.endColIdx);
    const maxCol = Math.max(dragSelection.startColIdx, dragSelection.endColIdx);

    const resetDragState = { isDragging: false, startRow: -1, endRow: -1, startColIdx: -1, endColIdx: -1, startValue: '' };

    if (minRow === maxRow && minCol === maxCol) {
      setDragSelection(resetDragState);
      return;
    }

    let newData = [...data];
    const val = dragSelection.startValue;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const targetCol = currentColumns[c];
        if (targetCol.id === 'month' || targetCol.id === 'total' || targetCol.id === 'note' || targetCol.type === 'formula') continue;

        const existingRowIndex = newData.findIndex(d => d.year === selectedYear && d.monthIndex === r);
        if (existingRowIndex >= 0) {
          let updated = { ...newData[existingRowIndex], [targetCol.id]: val };
          newData[existingRowIndex] = applyFormulas(updated);
        } else {
          let newRow = {
            id: Date.now().toString() + Math.random(), year: selectedYear, monthIndex: r, month: MONTH_NAMES[r],
            daysWorked: 0, daysVacation: 0, ticket: 0, arretrati: 0, note: '', coeffTicket: 0, coeffPercepito: 0,
            [targetCol.id]: val
          };
          newData.push(applyFormulas(newRow));
        }
      }
    }

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.getSelection()?.removeAllRanges();
    setActiveRowIndex(null);
    setActiveColId(null);
    updateDataWithHistory(newData);
    setDragSelection(resetDragState);
  }, [dragSelection, data, selectedYear, updateDataWithHistory, currentColumns]);

  // Rilascio del Mouse (Per Drag-to-Fill e Selezione)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragSelection.isDragging) applyDragFill();
      setCellSelection(prev => prev.isSelecting ? { ...prev, isSelecting: false } : prev);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragSelection.isDragging, applyDragFill]);

  // Ascoltatore Globale per la Cancellazione Massiva
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMultiSelection = cellSelection.startRow !== cellSelection.endRow || cellSelection.startColIdx !== cellSelection.endColIdx;

      // Se premo Canc o Backspace ed ho selezionato più celle
      if ((e.key === 'Delete' || e.key === 'Backspace') && cellSelection.active && isMultiSelection && !cellSelection.isSelecting) {
        e.preventDefault();

        const minRow = Math.min(cellSelection.startRow, cellSelection.endRow);
        const maxRow = Math.max(cellSelection.startRow, cellSelection.endRow);
        const minCol = Math.min(cellSelection.startColIdx, cellSelection.endColIdx);
        const maxCol = Math.max(cellSelection.startColIdx, cellSelection.endColIdx);

        let newData = [...data];
        let changed = false;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const targetCol = currentColumns[c];
            // Non cancelliamo colonne intoccabili
            if (targetCol.id === 'month' || targetCol.id === 'total' || targetCol.id === 'note' || targetCol.type === 'formula') continue;

            const existingRowIndex = newData.findIndex(d => d.year === selectedYear && d.monthIndex === r);
            if (existingRowIndex >= 0) {
              let updated = { ...newData[existingRowIndex], [targetCol.id]: '' };
              newData[existingRowIndex] = applyFormulas(updated);
              changed = true;
            }
          }
        }

        if (changed) {
          updateDataWithHistory(newData);
          triggerUndoToast("Valori delle celle cancellati."); // ✨ ACCENDE IL TOAST!
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        // Svuota la selezione
        setCellSelection(prev => ({ ...prev, active: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cellSelection, data, selectedYear, currentColumns, updateDataWithHistory]);
  const openNoteModal = (monthIndex: number, currentNote: string | undefined) => setNoteModal({ isOpen: true, monthIndex, text: currentNote || '' });
  const closeNoteModal = () => setNoteModal(prev => ({ ...prev, isOpen: false }));
  const saveNote = () => { if (noteModal.monthIndex !== -1) handleCellChange(noteModal.monthIndex, 'note', noteModal.text); closeNoteModal(); };
  const clearNote = () => setNoteModal(prev => ({ ...prev, text: '' }));
  const addTag = (tag: string) => setNoteModal(prev => ({ ...prev, text: prev.text ? `${prev.text}, ${tag}` : tag }));

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 shadow-xl rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 select-none group/main-container transition-colors duration-300">
        <style>{`
          /* Nasconde la scrollbar nativa dalla tabella principale */
          .hide-native-scrollbar::-webkit-scrollbar { display: none; }
          .hide-native-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

          /* Stile barre fantasma: invisibili di base */
          .custom-scrollbar-x::-webkit-scrollbar { height: 16px; }
          .custom-scrollbar-x::-webkit-scrollbar-track { background: transparent; border-top: 1px solid transparent; }
          .custom-scrollbar-x::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 8px; border: 4px solid transparent; background-clip: content-box; }
          
          /* --- TEMA CHIARO (Comportamento Standard) --- */
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-track { background: #f8fafc; border-top: 1px solid #e2e8f0; }
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb { background-color: #cbd5e1; }
          .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
          
          /* --- TEMA SCURO (Blindato) --- */
          /* Usiamo html.dark e !important per distruggere ogni interferenza del tema chiaro */
          html.dark .custom-scrollbar-x::-webkit-scrollbar-track,
          html.dark .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-track { 
              background: #0f172a !important; 
              border-top: 1px solid #1e293b !important; 
          }
          html.dark .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb { 
              background-color: #22d3ee !important; /* Azzurro Elettrico Base */
          }
          html.dark .group\\/main-container:hover .custom-scrollbar-x::-webkit-scrollbar-thumb:hover { 
              background-color: #06b6d4 !important; /* Azzurro Elettrico Hover (Più intenso) */
          }
             /* --- ANIMAZIONI DRAG TO FILL --- */
          @keyframes border-march {
            0% { background-position: 0 0, 10px 0, 100% 0, 0 100%; }
            100% { background-position: 10px 0, 0 0, 100% 10px, 0 0; }
          }
          .drag-target-cell {
            background-color: rgba(99, 102, 241, 0.15) !important;
            box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.8) !important;
            transition: none !important; /* LA MAGIA: Spegne l'animazione per renderlo ISTANTANEO */
          } 
            /* --- GPU HARDWARE ACCELERATION (God Tier Fluidity) --- */
          .gpu-scroll {
            will-change: scroll-position, transform;
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
          }
          .gpu-render {
            contain: layout style; /* Isola la tabella: se cambia una cella, il browser non ricalcola l'intera pagina */
          }
        `}</style>

        {/* --- HEADER --- */}
        <div className="bg-slate-800 text-white p-2 flex items-center justify-between shrink-0 z-20 shadow-md">
          <div className="flex flex-wrap items-center gap-1 flex-1 mr-4">
            <div className="flex items-center px-3 text-slate-400 border-r border-slate-600 mr-2 h-8">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="text-xs font-bold uppercase tracking-widest select-none">Periodo</span>
            </div>
            {years.map(year => (
              <button
                key={year}
                onClick={() => handleYearChange(year)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 border border-transparent ${selectedYear === year ? 'bg-blue-500 text-white shadow-md border-blue-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-600'}`}
              >
                {year}
              </button>
            ))}

            {/* --- GRUPPO TASTI DESTRA (UNDO + MANUALE LEGALE) --- */}
            <div className="ml-auto flex items-center gap-2">
              {/* TASTO UNDO (FRECCIA INDIETRO) - VERSIONE DEFINITIVA */}
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 overflow-hidden border ${history.length > 0
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200 shadow-sm hover:shadow hover:bg-indigo-100 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700/60 dark:hover:bg-cyan-800/60 active:scale-95'
                  : 'text-slate-400 bg-transparent border-transparent cursor-default opacity-50 dark:text-slate-500'
                  }`}
                title="Annulla ultima modifica (Ctrl+Z)"
              >
                <Undo2 size={16} className={history.length > 0 ? 'group-active:-rotate-45 transition-transform duration-300' : ''} />
                <span className="hidden sm:inline relative z-10">Annulla</span>

                {/* Contatore Badge Incassato */}
                {history.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-200/70 dark:bg-cyan-950/80 text-[10px] text-indigo-800 dark:text-cyan-200 font-black ml-1 px-1.5 shadow-inner transition-all">
                    {history.length}
                  </span>
                )}
              </button>

              {/* TASTO MANUALE LEGALE */}
              <button
                onClick={() => setLegalModalOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-full text-xs font-bold transition-all duration-300 border border-slate-600 hover:border-slate-500 shadow-sm group dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <Scale size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Manuale Legale</span>
              </button>
            </div>
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
        <div className="bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/50 py-1.5 px-4 flex items-center h-8 shrink-0 gap-4 transition-colors">

          {/* 1. ETICHETTA FISSA (Non si muove, ha priorità di spazio) */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest shrink-0 z-20">
            <AlertTriangle size={12} className="animate-pulse" />
            <span className="whitespace-nowrap">Nota Metodologica:</span>
          </div>

          {/* 2. AREA DI SCORRIMENTO (Occupa solo lo spazio rimanente a destra) */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">

            {/* Sfumatura sinistra (perfetta per la dark mode) */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-linear-to-r from-amber-50 dark:from-slate-900 to-transparent z-10"></div>

            {/* Sfumatura destra */}
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-linear-to-l from-amber-50 dark:from-slate-900 to-transparent z-10"></div>

            <motion.div
              className="whitespace-nowrap text-[11px] font-medium text-amber-800 dark:text-amber-200 flex gap-12 pl-4" // pl-4 per dare respiro iniziale
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
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center transition-colors">
          <div
            ref={topScrollRef}
            className="overflow-x-auto custom-scrollbar-x w-full gpu-scroll"
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
            className="w-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group/arrow shadow-sm shrink-0"
          >
            <div className="opacity-0 group-hover/main-container:opacity-100 transition-opacity duration-300 transform group-hover/arrow:scale-110 group-active/arrow:scale-95">
              <ChevronLeft size={28} className="text-slate-400 group-hover/arrow:text-blue-600" />
            </div>
          </div>

          <div ref={tableContainerRef} className="flex-1 overflow-auto hide-native-scrollbar relative gpu-scroll">
            <table className="text-sm border-collapse table-fixed relative gpu-render" style={{ minWidth: `${currentColumns.length * 100}px` }}>
              <thead className="sticky top-0 z-[150] shadow-sm relative">
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700 transition-colors">
                  {currentColumns.map((col, idx) => {
                    const detail = INDENNITA_DETAILS[col.id];
                    const isLastColumn = idx >= currentColumns.length - 2;

                    const tooltipClass = isLastColumn ? "right-full mr-1" : "left-full ml-1";
                    const arrowClass = isLastColumn ? "right-4" : "left-4";

                    return (
                      <th key={col.id}
                        className={`
                         p-2 font-bold text-center border-r border-slate-300 dark:border-slate-700 select-none transition-colors
                          ${col.width ? col.width : 'w-24'} 
                          ${col.id === 'total' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : ''} 
                          ${idx === 0 ? 'sticky left-0 bg-slate-100 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] z-200' : 'z-150'}
                          relative hover:z-9999!
                        `}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight h-10 group/head relative">
                          <span className="truncate w-full block text-[11px] uppercase tracking-tight">{col.label.replace(/\(.*\)/, '')}</span>

                          {col.id !== 'month' && col.id !== 'total' && col.id !== 'arretrati' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              {col.id !== 'daysWorked' && col.id !== 'daysVacation' && (
                                <span className="text-xs font-mono font-bold text-slate-500 dark:text-cyan-400 bg-slate-200/50 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-300/50 dark:border-cyan-900/50 transition-colors">{col.id}</span>
                              )}

                              {detail && (
                                <div className="relative">
                                  <Info size={11} className="text-slate-400 hover:text-blue-600 cursor-help transition-colors" />
                                  {/* TOOLTIP CORRETTO: Appare dopo 0.3s ed è forzato sopra a TUTTO */}
                                  <div className={`
                                    opacity-0 invisible group-hover/head:opacity-100 group-hover/head:visible transition-all duration-300 delay-300 
                                    absolute top-8 ${tooltipClass} w-64 p-0 bg-slate-800 text-white rounded-lg shadow-xl z-[99999] pointer-events-none text-left border border-slate-600 overflow-hidden
                                  `}>
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

              <tbody className={`bg-white dark:bg-slate-900 transition-colors duration-300 ${isScrolling ? 'pointer-events-none' : ''} ${dragSelection.isDragging ? 'select-none cursor-crosshair' : ''}`}>
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

                  // Colore Riga Validazione: Premium UX Puntamento
                  let rowClass = isActiveRow
                    ? 'bg-blue-50/80 dark:bg-indigo-950/60 shadow-[inset_6px_0_0_0_#3b82f6] dark:shadow-[inset_6px_0_0_0_#06b6d4] ring-2 ring-blue-400 dark:ring-cyan-500 z-30 relative transition-all duration-300'
                    : 'group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors duration-150 relative z-0';
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

                        // Calcoli per la SELEZIONE MULTIPLA (Cancellazione)
                        const selMinRow = Math.min(cellSelection.startRow, cellSelection.endRow);
                        const selMaxRow = Math.max(cellSelection.startRow, cellSelection.endRow);
                        const selMinCol = Math.min(cellSelection.startColIdx, cellSelection.endColIdx);
                        const selMaxCol = Math.max(cellSelection.startColIdx, cellSelection.endColIdx);
                        const isSelectedCell = cellSelection.active && rowIndex >= selMinRow && rowIndex <= selMaxRow && colIndex >= selMinCol && colIndex <= selMaxCol;

                        // Calcoli per il Drag 2D (Fill)
                        const minRow = Math.min(dragSelection.startRow, dragSelection.endRow);
                        const maxRow = Math.max(dragSelection.startRow, dragSelection.endRow);
                        const minCol = Math.min(dragSelection.startColIdx, dragSelection.endColIdx);
                        const maxCol = Math.max(dragSelection.startColIdx, dragSelection.endColIdx);

                        const isInDragRange = dragSelection.isDragging && rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
                        const isDragStartCell = dragSelection.isDragging && rowIndex === dragSelection.startRow && colIndex === dragSelection.startColIdx;
                        const isCellActive = activeRowIndex === rowIndex && activeColId === col.id;

                        // AI discrepancy for this cell
                        const rowVerifyState = !isMonth && !isTotal ? verifyStates[`${selectedYear}-${rowIndex}`] : undefined;
                        const cellDiscrepancy = rowVerifyState && rowVerifyState.status !== 'loading' && col.type !== 'formula'
                          ? rowVerifyState.discrepancies.find(d => d.field === col.id)
                          : undefined;

                        return (
                          <td
                            key={col.id}
                            onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                            onMouseEnter={() => {
                              handleDragEnter(rowIndex, colIndex);
                              handleCellMouseEnter(rowIndex, colIndex);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, rowIndex, col.id)}
                            className={`
                                border-r border-b border-slate-300 dark:border-slate-700 p-0 relative transition-colors
                                ${colIndex === 0 ? 'sticky left-0 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 z-20 border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}
                                ${(isDayCountError || isDivisorError) && colIndex === 0 ? (isDivisorError ? 'bg-red-100! dark:bg-red-900/60! text-red-800 dark:text-red-300' : 'bg-orange-100! dark:bg-orange-900/60! text-orange-800 dark:text-orange-300') : ''}
                                ${isActiveRow && colIndex === 0 && !isDayCountError && !isDivisorError ? 'bg-blue-100! dark:bg-indigo-900/80! text-blue-900 dark:text-cyan-300 font-black' : ''}
                                ${isTotal ? 'bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-cyan-100 text-right pr-2' : ''}
                                ${isVacation ? 'bg-amber-50/20' : ''}
                                ${isVacationWarning ? 'ring-2 ring-inset ring-red-400/50' : ''}
                                ${cellDiscrepancy && !isVacationWarning ? (rowVerifyState?.status === 'error' ? 'ring-2 ring-inset ring-red-400/50 dark:ring-red-500/50 bg-red-50/40 dark:bg-red-900/10' : 'ring-2 ring-inset ring-amber-400/60 dark:ring-amber-500/50 bg-amber-50/40 dark:bg-amber-900/10') : ''}
                                ${isInDragRange && !isDragStartCell ? 'drag-target-cell' : ''}
                                ${isSelectedCell && !dragSelection.isDragging ? 'bg-indigo-100/60 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-400' : ''}
                                hover:!z-[1000]
                              `}
                          >
                            {isMonth ? (
                              <div
                                className="flex items-center justify-between px-3 h-full w-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => {
                                  // ✨ FIX: Ora si accende/spegne in modo infallibile e pulisce le selezioni azzurre!
                                  setActiveRowIndex(isActiveRow ? null : rowIndex);
                                  setCellSelection(prev => ({ ...prev, active: false }));
                                }}
                                title="Clicca per bloccare/sbloccare l'evidenziatore su questo mese"
                              >
                                <div className="flex items-center gap-2 overflow-hidden relative group/ai">
                                  {isDivisorError ? (
                                    <div className="text-red-600 animate-pulse" title="ERRORE: Indennità presenti senza giorni lavorati"><AlertCircle size={14} /></div>
                                  ) : isDayCountError ? (
                                    <div className="text-orange-500" title={`ATTENZIONE: Totale giorni (${totalDaysInput}) supera il limite del mese (${daysInMonth})`}><TriangleAlert size={14} /></div>
                                  ) : hasAiWarning ? (
                                    <div className="text-red-500 cursor-help" title="Anomalia Rilevata dall'IA"><AlertCircle size={14} className="animate-bounce" /></div>
                                  ) : aiWarning === "Nessuna anomalia" ? (
                                    <div className="text-emerald-500"><CheckCircle2 size={14} /></div>
                                  ) : null}

                                  {hasAiWarning && (
                                    <div className={`
                                      opacity-0 invisible group-hover/ai:opacity-100 group-hover/ai:visible transition-all duration-300 delay-500
                                      absolute left-full ml-2 ${rowIndex > 7 ? 'bottom-0' : 'top-0'}
                                      w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl z-[9999] whitespace-normal leading-tight border border-slate-700 pointer-events-none
                                    `}>
                                      <span className="font-bold text-red-400 block mb-1">Avviso AI:</span>
                                      {aiWarning}
                                    </div>
                                  )}

                                  {/* Semaphore indicator for AI verification result */}
                                  {(() => {
                                    const vKey = `${selectedYear}-${rowIndex}`;
                                    const vs = verifyStates[vKey];
                                    if (!vs || vs.status === 'loading') return null;
                                    const dotColor = vs.status === 'success'
                                      ? 'bg-emerald-500'
                                      : vs.status === 'warning'
                                        ? 'bg-amber-400'
                                        : 'bg-red-500';
                                    return (
                                      <div className="relative group/verify flex-shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${dotColor} ring-1 ring-white/50`} />
                                        {(vs.discrepancies.length > 0 || vs.errorMessage) && (
                                          <div className={`
                                            opacity-0 invisible group-hover/verify:opacity-100 group-hover/verify:visible
                                            transition-all duration-200 delay-300
                                            absolute left-full ml-2 ${rowIndex > 7 ? 'bottom-0' : 'top-0'}
                                            w-64 p-2.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-2xl z-[9999]
                                            border border-slate-700 pointer-events-none whitespace-normal leading-relaxed
                                          `}>
                                            <span className={`font-bold block mb-1.5 text-[10px] uppercase tracking-wider ${vs.status === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                              {vs.status === 'error' ? '⚠ Discrepanze trovate' : '⚡ Anomalie minori'}
                                            </span>
                                            {vs.errorMessage && (
                                              <div className="text-red-300 border-t border-slate-700/60 pt-1 mt-1">{vs.errorMessage}</div>
                                            )}
                                            {vs.discrepancies.map((d, i) => (
                                              <div key={i} className="border-t border-slate-700/60 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">{d.message}</div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <div className="text-xs font-bold uppercase tracking-wide truncate max-w-[70px]" title={note}>{MONTH_NAMES[rowIndex]}</div>
                                </div>

                                {/* Verify button — shown only when archive has a PDF for this row */}
                                {(() => {
                                  const vKey = `${selectedYear}-${rowIndex}`;
                                  const hasArchive = !!archiveEntries[vKey];
                                  const vs = verifyStates[vKey];
                                  if (!hasArchive || !onVerifyRequest) return null;
                                  const isLoading = vs?.status === 'loading';
                                  const btnColor = !vs
                                    ? 'text-slate-300 dark:text-slate-600 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-slate-700'
                                    : vs.status === 'success'
                                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                      : vs.status === 'warning'
                                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50';
                                  return (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); if (!isLoading) onVerifyRequest(currentRows[rowIndex] as AnnoDati); }}
                                      tabIndex={-1}
                                      title={
                                        isLoading ? 'Verifica in corso…'
                                          : vs?.status === 'success' ? 'Dati verificati ✓ — Riclicca per ri-verificare'
                                            : vs?.status === 'warning' ? 'Anomalie minori rilevate — Riclicca per ri-verificare'
                                              : vs?.status === 'error' ? 'Discrepanze trovate! — Riclicca per ri-verificare'
                                                : 'Verifica dati con AI (confronta con il PDF archiviato)'
                                      }
                                      className={`p-1.5 rounded-lg transition-all focus:outline-none ${btnColor} ${isLoading ? 'cursor-wait' : ''}`}
                                    >
                                      {isLoading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ShieldCheck className="w-3.5 h-3.5" strokeWidth={vs ? 2.5 : 2} />
                                      }
                                    </button>
                                  );
                                })()}

                                {/* "Accetta tutto" — visible when there are actionable discrepancies */}
                                {(() => {
                                  const vKey = `${selectedYear}-${rowIndex}`;
                                  const vs = verifyStates[vKey];
                                  if (!vs || vs.status === 'loading' || vs.discrepancies.length === 0 || !onAcceptAllCorrections) return null;
                                  return (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onAcceptAllCorrections(selectedYear, rowIndex); }}
                                      tabIndex={-1}
                                      title={`Accetta tutte le ${vs.discrepancies.length} correzioni AI`}
                                      className="p-1.5 rounded-lg transition-all focus:outline-none text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 ring-1 ring-emerald-300 dark:ring-emerald-700/50 flex items-center gap-0.5"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                                      <span className="text-[9px] font-bold leading-none">{vs.discrepancies.length}</span>
                                    </button>
                                  );
                                })()}

                                <button onClick={() => openNoteModal(rowIndex, note)} tabIndex={-1} className={`p-1.5 rounded-lg transition-all focus:outline-none ${note ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 ring-1 ring-amber-300 dark:ring-amber-700/50' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-cyan-400 hover:bg-indigo-50 dark:hover:bg-slate-700'}`}><MessageSquareText className="w-3.5 h-3.5" strokeWidth={note ? 2.5 : 2} /></button>
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
                                  disabled={col.type === 'formula'}
                                  className={`
                                        w-full h-full bg-transparent px-2 text-right outline-none transition-colors duration-75 tabular-nums text-xs placeholder:text-transparent
                                        ${col.type === 'formula'
                                      ? 'cursor-not-allowed bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 font-black italic'
                                      : `focus:bg-white dark:focus:bg-slate-950 focus:z-50 focus:ring-4 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 dark:focus:ring-cyan-400 bg-white/50 dark:bg-slate-800/80 shadow-[0_0_15px_rgba(79,70,229,0.3)] focus:text-indigo-700 dark:focus:text-cyan-300 font-medium hover:bg-slate-50/80 dark:hover:bg-slate-800/80
                                               ${cellValue ? 'text-slate-900 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-600'}`
                                    }
                                        ${isVacationWarning ? 'text-red-600 dark:text-red-400 font-black decoration-4 decoration-red-500 bg-[linear-gradient(45deg,transparent_45%,rgba(255,0,0,0.3)_50%,transparent_55%)]' : ''}
                                        ${!isVacation && col.id === 'daysWorked' ? 'text-blue-700 dark:text-blue-400 font-bold' : ''}
                                        ${dragSelection.isDragging || cellSelection.isSelecting ? 'pointer-events-none' : ''}
                                      `}
                                  placeholder="0"
                                  value={col.type === 'formula' && cellValue !== 0 ? formatCurrency(cellValue) : (cellValue ?? '')}
                                  onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)}
                                  onFocus={(e) => handleInputFocus(e, rowIndex, col.id)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, col.id)}
                                  onPaste={(e) => handlePaste(e, rowIndex, col.id)}
                                />

                                {/* QUADRATINO MAGICO PER IL DRAG-TO-FILL */}
                                {isCellActive && !dragSelection.isDragging && !cellSelection.isSelecting && col.type !== 'formula' && (
                                  <div
                                    onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, rowIndex, colIndex, cellValue); }}
                                    className="drag-handle absolute -bottom-[3px] -right-[3px] w-2.5 h-2.5 bg-indigo-500 dark:bg-cyan-500 border border-white dark:border-slate-900 cursor-crosshair z-[50] shadow-sm hover:scale-125 transition-transform"
                                    title="Trascina per copiare i valori in ogni direzione"
                                  ></div>
                                )}


                                {/* --- TOOLTIP INTELLIGENTE FERIE --- */}
                                {isVacationWarning && !dragSelection.isDragging && (
                                  <>
                                    <div className="absolute top-0.5 left-0.5 z-10 pointer-events-none">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-500 fill-red-100" />
                                    </div>

                                    {/* NUOVO COMPORTAMENTO: Ritardo 0.5s, Sfumatura, Direzione Dinamica */}
                                    <div className={`
                                      opacity-0 invisible group-hover/cell:opacity-100 group-hover/cell:visible transition-all duration-300 delay-500 
                                      absolute ${rowIndex > 7 ? 'bottom-full mb-2' : 'top-full mt-2'} ${tooltipClass === 'left-full ml-1' ? 'left-0' : 'right-0'} 
                                      w-72 p-3 bg-slate-900/95 text-white text-[11px] rounded-lg shadow-2xl z-[9999] border border-slate-700 backdrop-blur-sm pointer-events-none
                                    `}>
                                      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1.5 uppercase tracking-wider text-[10px]">
                                        <AlertCircle size={12} /> Soglia Legale Superata
                                      </div>
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-slate-300"><span>Hai inserito:</span> <span className="font-bold text-white text-xs">{formatDay(vacDays)} gg</span></div>
                                        <div className="flex justify-between items-center text-slate-300"><span>Massimo (Legale):</span> <span className="font-mono text-xs">{TETTO_FERIE} gg</span></div>
                                        <div className="flex justify-between items-center bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                                          <span className="text-red-300 font-bold">Eccedenza (Tagliata):</span>
                                          <span className="font-black text-red-400 text-xs">+{formatDay(eccedenza)} gg</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/30">
                                          <span className="text-emerald-300 font-bold">Conteggiati:</span>
                                          <span className="font-black text-emerald-400 text-xs">{formatDay(utili)} gg</span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2 italic leading-relaxed border-t border-slate-700 pt-1">
                                          Ai sensi della <strong>Sentenza Cass. 23/6/2022 n. 20216</strong>, il periodo minimo protetto è di 28 giorni. L'eccedenza non concorre al calcolo della retribuzione feriale.
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* AI discrepancy indicator + tooltip with accept button */}
                                {cellDiscrepancy && !dragSelection.isDragging && (
                                  <div className="absolute top-0.5 right-1 z-20 group/disc">
                                    <div className={`w-2 h-2 rounded-full cursor-help ${rowVerifyState?.status === 'error' ? 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.8)]' : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]'}`} />
                                    <div className={`
                                      opacity-0 invisible group-hover/disc:opacity-100 group-hover/disc:visible
                                      pointer-events-none group-hover/disc:pointer-events-auto
                                      transition-all duration-200 delay-200
                                      absolute ${rowIndex > 7 ? 'bottom-full mb-1' : 'top-full mt-1'} right-0
                                      w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[9999] overflow-hidden
                                    `}>
                                      <div className="px-3 py-2.5">
                                        <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">AI Suggerisce</div>
                                        <div className="font-bold text-white tabular-nums text-sm">
                                          {cellDiscrepancy.suggested.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[9px] text-slate-500 mt-0.5">estratto: {cellDiscrepancy.extracted.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div className="text-[9px] text-slate-400 mt-1.5 leading-tight border-t border-slate-700/60 pt-1.5">{cellDiscrepancy.message}</div>
                                      </div>
                                      <button
                                        className="w-full px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors border-t border-emerald-800"
                                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onAcceptCorrection?.(selectedYear, rowIndex, col.id, cellDiscrepancy.suggested);
                                        }}
                                      >
                                        <CheckCircle2 className="w-3 h-3" /> Accetta correzione
                                      </button>
                                    </div>
                                  </div>
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

              <tfoot className="sticky bottom-0 z-20 bg-slate-50 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_8px_rgba(0,0,0,0.6)]">
                <tr className="font-bold text-slate-800 dark:text-slate-200">
                  {currentColumns.map((col, index) => {
                    if (col.id === 'month') return <td key="total-label" className="sticky left-0 bg-amber-200 dark:bg-amber-600 border-r-2 border-slate-300 dark:border-slate-700 px-3 py-3 text-left text-xs uppercase tracking-wider z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">TOTALE {selectedYear}</td>;

                    const totalVal = columnTotals[col.id] || 0;

                    // FIX 1: Ferie (Massimo 2 decimali)
                    if (col.id === 'daysVacation') {
                      const totUtile = Math.min(totalVal, TETTO_FERIE);
                      const formattedReale = totalVal !== 0 ? Number(totalVal).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '-';
                      const formattedUtile = Number(totUtile).toLocaleString('it-IT', { maximumFractionDigits: 2 });
                      return (
                        <td key={col.id} className="border-r border-slate-300 dark:border-slate-700 px-2 py-3 text-right bg-amber-100/50 dark:bg-amber-900/30">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Tot: {formattedReale}</span>
                            <span className="text-xs font-black text-slate-800 dark:text-amber-400">Utili: {formattedUtile}</span>
                          </div>
                        </td>
                      );
                    }

                    // FIX 2: Giorni Lavorati (Massimo 2 decimali, COLORE STANDARD RIPRISTINATO)
                    if (col.id === 'daysWorked') {
                      const formattedReale = totalVal !== 0 ? Number(totalVal).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '-';
                      return (
                        <td key={col.id} className="border-r border-slate-300 dark:border-slate-700 px-2 py-3 text-right tabular-nums text-xs bg-amber-100/50 dark:bg-amber-900/20 text-slate-800 dark:text-slate-200">
                          {formattedReale}
                        </td>
                      );
                    }

                    // Tutte le altre colonne
                    const cellBg = col.id === 'total' ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'bg-amber-100/50 dark:bg-amber-900/20';
                    return <td key={`total-${col.id}`} className={`border-r border-slate-300 dark:border-slate-700 px-2 py-3 text-right tabular-nums text-xs transition-colors ${cellBg}`}>
                      {col.type === 'integer' ? (totalVal !== 0 ? formatDay(totalVal) : '-') : (totalVal && totalVal !== 0 ? formatCurrency(totalVal) : '-')}
                    </td>;
                  })}
                </tr>
                <tr>
                  <td colSpan={100} className="p-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 italic transition-colors">
                    <div className="flex items-center gap-2"><Info className="w-3 h-3 text-slate-400 dark:text-slate-500" /><span>Nota: I giorni di ferie eccedenti la soglia legale di {TETTO_FERIE} (rif. Cass. 20216/2022) sono evidenziati in rosso ed esclusi dal calcolo.</span></div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div
            onMouseDown={() => startScrolling('right')}
            onMouseUp={stopScrolling}
            onMouseLeave={stopScrolling}
            className="w-10 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 z-30 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group/arrow shadow-sm shrink-0"
          >
            <div className="opacity-0 group-hover/main-container:opacity-100 transition-opacity duration-300 transform group-hover/arrow:scale-110 group-active/arrow:scale-95">
              <ChevronRight size={28} className="text-slate-400 group-hover/arrow:text-blue-600" />
            </div>
          </div>

        </div>
        {/* --- GHOST SCROLLBAR INFERIORE (Sync) --- */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center transition-colors">
          <div
            ref={bottomScrollRef}
            className="overflow-x-auto custom-scrollbar-x w-full gpu-scroll"
            style={{ paddingLeft: '40px', paddingRight: '40px' }}
          >
            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
          </div>
        </div>

        {/* MODALE NOTE */}
        <AnimatePresence>
          {noteModal.isOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeNoteModal}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400"><MessageSquareText className="w-5 h-5" /></div><div><h3 className="font-bold text-slate-800 dark:text-white">Nota Mensile</h3><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{noteModal.monthIndex >= 0 ? MONTH_NAMES[noteModal.monthIndex] : ''} {selectedYear}</p></div></div>
                  <button onClick={closeNoteModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Descrizione Evento</label>
                  <textarea value={noteModal.text} onChange={(e) => setNoteModal(prev => ({ ...prev, text: e.target.value }))} className="w-full h-32 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-indigo-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-cyan-900 outline-none resize-none text-slate-700 dark:text-slate-200 text-sm transition-all placeholder-slate-400 dark:placeholder-slate-600" placeholder="Scrivi qui il motivo..." autoFocus />
                  <div className="mt-4"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inserimento Rapido</p><div className="flex flex-wrap gap-2">{QUICK_TAGS.map(tag => (<button key={tag} onClick={() => addTag(tag)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-cyan-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-cyan-800"><Tag className="w-3 h-3" />{tag}</button>))}</div></div>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <button onClick={clearNote} className="flex items-center gap-2 px-4 py-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-sm font-bold transition-colors"><Eraser className="w-4 h-4" /> Pulisci</button>
                  <div className="flex gap-3"><button onClick={closeNoteModal} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold text-sm transition-colors">Annulla</button><button onClick={saveNote} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 dark:bg-cyan-600 hover:bg-indigo-700 dark:hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 dark:shadow-cyan-900/40 transition-all active:scale-95"><Save className="w-4 h-4" /> Salva Nota</button></div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODALE MANUALE LEGALE --- */}
        <AnimatePresence>
          {legalModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setLegalModalOpen(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                {/* Header Modale */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400"><Scale className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-lg">Manuale Legale & Riferimenti</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perizia Tecnica Ferie non Godute</p>
                    </div>
                  </div>
                  <button onClick={() => setLegalModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* Contenuto Scrollabile */}
                <div className="p-8 overflow-y-auto space-y-8">

                  {/* Sezione 1: Art. 64 */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2 mb-3 text-indigo-700 dark:text-indigo-400">
                      <BookOpen size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Articolo 64 CCNL Mobilità</h4>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed text-justify mb-4">
                      "Durante le ferie il lavoratore ha diritto alla retribuzione che avrebbe percepito se avesse lavorato,
                      comprensiva delle indennità fisse e variabili legate alla modalità di esecuzione della prestazione."
                    </p>
                    <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3 italic">
                      Nota: Questo principio è stato rafforzato dalla giurisprudenza europea e dalla Corte di Cassazione,
                      impedendo che il lavoratore subisca svantaggi economici durante il riposo.
                    </div>
                  </div>

                  {/* Sezione 2: Il Divisore */}
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-900/30 transition-colors">
                    <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-500">
                      <TrendingUp size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Il Calcolo del Divisore</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                        Il <strong>divisore</strong> è il numero utilizzato per trasformare il totale delle indennità mensili in una quota giornaliera media.
                      </p>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li>
                          <strong className="dark:text-white">Divisore Convenzionale (26):</strong> Spesso usato dalle aziende per semplicità, ma penalizzante se si lavorano meno giorni.
                        </li>
                        <li>
                          <strong className="dark:text-white">Divisore Effettivo (Consigliato):</strong> Si utilizza il numero reale di giorni lavorati nel mese (es. 20, 21, 22). Questo metodo alza il valore medio giornaliero ed è quello preferito nei ricorsi (Cass. 20216/2022).
                        </li>
                      </ul>
                      <div className="bg-white dark:bg-slate-950 p-3 rounded border border-amber-100 dark:border-amber-900/50 text-xs font-mono text-slate-600 dark:text-slate-400 transition-colors">
                        Formula: Totale Indennità / Giorni Lavorati = Media Giornaliera
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-right shrink-0 transition-colors">
                  <button onClick={() => setLegalModalOpen(false)} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold transition-all shadow-lg">Chiudi Manuale</button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* --- MODALE CONFERMA AZZERAMENTO MESE --- */}
        <AnimatePresence>
          {rowToClear !== null && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRowToClear(null)}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 text-center relative overflow-hidden">
                  {/* Effetto luce rossa dietro */}
                  <div className="absolute top-[-50%] left-[50%] -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-gradient-to-br from-red-100 to-rose-100 text-red-500 shadow-inner ring-4 ring-white relative z-10">
                    <Eraser className="w-10 h-10" strokeWidth={2} />
                  </div>

                  <h3 className="text-xl font-black text-slate-800 mb-2 relative z-10">Svuotare il mese?</h3>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed relative z-10">
                    Stai per azzerare tutti i valori inseriti per il mese di <br />
                    <b className="text-slate-700 text-base">{MONTH_NAMES[rowToClear]} {selectedYear}</b>.
                  </p>

                  <div className="flex gap-3 justify-center relative z-10">
                    <button onClick={() => setRowToClear(null)} className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                      Annulla
                    </button>
                    <button onClick={confirmClearRow} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:scale-105 transition-all shadow-[0_10px_25px_-5px_rgba(239,68,68,0.5)]">
                      Sì, Svuota Dati
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* --- MENU CONTESTUALE (TASTO DESTRO) TRAMITE PORTAL - VERSIONE GOD TIER --- */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {contextMenu && contextMenu.visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ top: contextMenu.y, left: contextMenu.x }}
                className="fixed z-[99999] w-64 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/60 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] p-1.5 overflow-hidden text-sm font-medium flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Menu */}
                <div className="px-3 py-2.5 text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1 flex justify-between items-center select-none">
                  <span>Azioni Cella</span>
                  <span className="text-indigo-600 dark:text-cyan-400 bg-indigo-100/50 dark:bg-cyan-900/30 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-cyan-800/50">
                    {MONTH_NAMES[contextMenu.rowIndex]}
                  </span>
                </div>

                {/* Bottone Copia */}
                <button onClick={() => { handleCopyCell(); setContextMenu(null); }} className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-all duration-200">
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                    <Copy size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Copia Valore</span>
                </button>

                {/* Bottone Incolla */}
                <button onClick={() => { handlePasteCell(); setContextMenu(null); }} className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-all duration-200">
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                    <ClipboardPaste size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Incolla Numero</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-1 mx-3 rounded-full"></div>

                {/* Bottone Svuota */}
                <button
                  onClick={() => { setRowToClear(contextMenu.rowIndex); setContextMenu(null); }}
                  className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-3 transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 shadow-sm border border-transparent group-hover:border-red-200 dark:group-hover:border-red-800/50 transition-colors">
                    <Eraser size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200 font-semibold">Svuota Intero Mese</span>
                </button>

                {/* Bottone Note */}
                <button
                  onClick={() => {
                    const row = currentYearData.find(d => d.monthIndex === contextMenu.rowIndex);
                    openNoteModal(contextMenu.rowIndex, (row as any)?.note);
                    setContextMenu(null);
                  }}
                  className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-3 transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 shadow-sm border border-transparent group-hover:border-amber-200 dark:group-hover:border-amber-800/50 transition-colors">
                    <MessageSquareText size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Gestisci Note / Eventi</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        {/* ✨ TOAST UNDO RAPIDO (GMAIL STYLE) */}
        <AnimatePresence>
          {undoToast.show && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-700/50"
            >
              <span className="text-sm font-medium text-slate-200">{undoToast.msg}</span>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button
                onClick={performQuickUndo}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-black text-sm transition-colors tracking-wide active:scale-95"
              >
                <Undo2 size={16} strokeWidth={2.5} /> Ripristina
              </button>
              <button
                onClick={() => setUndoToast({ show: false, msg: '' })}
                className="ml-1 p-1 text-slate-500 hover:text-slate-300 transition-colors bg-white/5 hover:bg-white/10 rounded-full"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default MonthlyDataGrid;