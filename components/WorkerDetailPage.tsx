import React, { useState, useMemo, useRef } from 'react';
import MonthlyDataGrid from './WorkerTables/MonthlyDataGrid';
import AnnualCalculationTable from './WorkerTables/AnnualCalculationTable';
import IndemnityPivotTable from './WorkerTables/IndemnityPivotTable';
// Import necessario per i calcoli della stampa
import { Worker, AnnoDati, parseFloatSafe, getColumnsByProfile, MONTH_NAMES, formatCurrency } from '../types';
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
  Search  // <--- ECCOLA! Ora non darà più errore
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

const WorkerDetailPage: React.FC<WorkerDetailPageProps> = ({ worker, onUpdateData, onUpdateStatus, onBack, onOpenReport }) => {
  const [monthlyInputs, setMonthlyInputs] = useState<AnnoDati[]>(Array.isArray(worker?.anni) ? worker.anni : []);
  const [activeTab, setActiveTab] = useState<'input' | 'calc' | 'pivot'>('input');
  const [currentYear, setCurrentYear] = useState(2024);

  // --- STATO SPLIT SCREEN / VISORE ---
  const [showSplit, setShowSplit] = useState(false);
  const [showDealMaker, setShowDealMaker] = useState(false);
  const [payslipImg, setPayslipImg] = useState<string | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

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
  const [includeExFest, setIncludeExFest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // --- STATI DEAL MAKER 2.0 (STRATEGIA LEGALE) ---
  const [isNetMode, setIsNetMode] = useState(false); // Toggle Lordo/Netto
  const [winProb, setWinProb] = useState(90); // Probabilità vittoria (Default 90% per Cassazione 20216)
  const [legalCosts, setLegalCosts] = useState(1500); // Costi stimati (CTU + Spese)
  const [yearsDuration, setYearsDuration] = useState(3); // Durata causa (anni)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
  // --- FUNZIONE ANALISI AI CORRETTA (CREA I MESI MANCANTI) ---
  const handleAnalyzePaySlip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);

    try {
      // 1. Converti in Base64
      const base64Image = await toBase64(file);

      // 2. Chiama il Backend
      const response = await fetch('/.netlify/functions/scan-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      // GESTIONE ERRORE DETTAGLIATA (Così capiamo se è la Chiave o altro)
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Errore Backend:", errorText);
        throw new Error(`Errore Server: ${errorText}`);
      }

      const aiResult = await response.json();
      console.log("Dati letti dall'IA:", aiResult);

      // 3. AGGIORNAMENTO DATI (LOGICA AUTO-CREAZIONE)
      const currentAnni = JSON.parse(JSON.stringify(monthlyInputs));

      // L'IA restituisce mese 1-12, noi usiamo index 0-11
      const targetMonthIndex = aiResult.month - 1;
      const targetYear = aiResult.year;

      // CERCA LA RIGA
      let rowIndex = currentAnni.findIndex((r: AnnoDati) =>
        Number(r.year) === targetYear &&
        r.monthIndex === targetMonthIndex
      );

      // --- MODIFICA CRUCIALE: SE NON ESISTE, LA CREIAMO! ---
      if (rowIndex === -1) {
        const newRow: AnnoDati = {
          id: Date.now().toString(), // ID temporaneo
          year: targetYear,
          monthIndex: targetMonthIndex,
          month: MONTH_NAMES[targetMonthIndex],
          daysWorked: 0,
          daysVacation: 0,
          ticket: 0,
          note: ''
        };
        currentAnni.push(newRow);

        // Ordiniamo per anno e mese per non rompere la tabella
        currentAnni.sort((a: AnnoDati, b: AnnoDati) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.monthIndex - b.monthIndex;
        });

        // Ritroviamo l'indice della riga appena creata
        rowIndex = currentAnni.findIndex((r: AnnoDati) =>
          Number(r.year) === targetYear &&
          r.monthIndex === targetMonthIndex
        );
      }

      // ORA AGGIORNIAMO I DATI SICURI DI AVERE LA RIGA
      const row = currentAnni[rowIndex];

      // A. Dati Base
      if (aiResult.daysWorked) row.daysWorked = aiResult.daysWorked;
      if (aiResult.daysVacation) row.daysVacation = aiResult.daysVacation;

      // B. Voci Variabili (Codici)
      if (aiResult.codes) {
        Object.entries(aiResult.codes).forEach(([code, value]) => {
          if (value && typeof value === 'number') {
            row[code] = value;
          }
        });
      }

      // C. Logica Ticket
      let calculatedCoeff = 0;
      if (aiResult.ticket_data) {
        if (aiResult.ticket_data.single > 0) {
          calculatedCoeff = aiResult.ticket_data.single;
        } else if (aiResult.ticket_data.total > 0 && row.daysWorked > 0) {
          calculatedCoeff = aiResult.ticket_data.total / row.daysWorked;
        }
      }

      if (calculatedCoeff > 0) {
        row.coeffTicket = calculatedCoeff.toFixed(2);
        const oldNote = row.note || '';
        if (!oldNote.includes('AI: Ticket')) {
          row.note = `${oldNote} [AI: Ticket €${calculatedCoeff.toFixed(2)}]`.trim();
        }
      }

      // Aggiorna array e stato
      currentAnni[rowIndex] = row;

      // Se l'anno scansionato è diverso da quello visualizzato, cambiamo vista
      if (targetYear !== currentYear) {
        setCurrentYear(targetYear);
      }

      handleDataChange(currentAnni);
      alert(`✅ Busta ${aiResult.month}/${aiResult.year} acquisita con successo!`);

    } catch (error: any) {
      console.error("Errore analisi:", error);
      // Mostra l'errore vero nell'alert
      alert(`Errore: ${error.message || "Controlla la console per dettagli"}`);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  // --- HELPER PARSING (AGGIUNGERE QUESTO) ---
  const parseLocalFloat = (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const cleanStr = val.toString().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  // --- FUNZIONE CERVELLO CORRETTA (Logica Mensile + Tetto Dinamico) ---
  const calculateAnnualLegalData = (data: AnnoDati[], profile: any, withExFest: boolean) => {
    const years = Array.from(new Set(data.map(d => Number(d.year)))).sort((a, b) => a - b);

    const indennitaCols = getColumnsByProfile(profile).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
    );

    let globalLordo = 0;
    let globalTicket = 0;
    let globalFerieEffettive = 0;
    let globalFeriePagate = 0;

    const TETTO_FERIE = withExFest ? 32 : 28;

    years.forEach(year => {
      // Ordine cronologico fondamentale per il calcolo progressivo
      const monthsInYear = data.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);
      let ferieCumulateAnno = 0;

      monthsInYear.forEach(m => {
        // A. Somma Indennità Mese
        let totIndennitaMese = 0;
        indennitaCols.forEach(col => {
          totIndennitaMese += parseLocalFloat(m[col.id]);
        });

        // B. Dati Giorni
        const giorniLavorati = parseLocalFloat(m.daysWorked);
        const ferieMese = parseLocalFloat(m.daysVacation);
        const coeffTicket = parseLocalFloat(m['coeffTicket']);

        // C. Logica Tetto (Bucket)
        const spazioRimanente = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
        const giorniUtili = Math.min(ferieMese, spazioRimanente);
        ferieCumulateAnno += ferieMese;

        // D. Calcolo Lordo Mensile (Puntuale)
        if (giorniLavorati > 0) {
          const valoreGiornaliero = totIndennitaMese / giorniLavorati;
          globalLordo += (valoreGiornaliero * giorniUtili);
        }

        // E. Calcolo Ticket
        globalTicket += (giorniUtili * coeffTicket);

        globalFerieEffettive += ferieMese;
        globalFeriePagate += giorniUtili;
      });
    });

    return { globalLordo, globalTicket, globalFerieEffettive, globalFeriePagate };
  };


  // --- PUNTO 2: DEAL MAKER STRATEGICO (CORRETTO ANTICRASH) ---
  const dealStats = useMemo(() => {
    // 1. Dati Base (Lordo + Ticket)
    const { globalLordo, globalTicket } = calculateAnnualLegalData(monthlyInputs, worker.profilo, includeExFest);

    // Calcolo Percepito da detrarre (solo su gg utili)
    const TETTO = includeExFest ? 32 : 28;
    let totalPercepito = 0;

    const years = Array.from(new Set(monthlyInputs.map(d => Number(d.year))));
    years.forEach(year => {
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
      netDifference: grossClaim, // <--- QUESTA RIGA EVITA IL CRASH (Compatibilità)
      grossClaim: grossClaim > 0 ? grossClaim : 0,
      netClaim: netClaim > 0 ? netClaim : 0,
      courtRealValue: courtRealValue > 0 ? courtRealValue : 0,
      displayTarget: isNetMode ? netClaim : grossClaim
    };
  }, [monthlyInputs, worker.profilo, includeExFest, isNetMode, winProb, legalCosts, yearsDuration]);

  // --- GESTIONE INVIO PEC ---
  const handleSendPec = () => {
    const profile = PROFILE_CONFIG[worker.profilo] || PROFILE_CONFIG.RFI;
    const subject = `DIFFIDA E MESSA IN MORA - ${worker.cognome} ${worker.nome}`;
    const body = `Spett.le ${profile.label},\n\nIn nome e per conto del Sig. ${worker.nome} ${worker.cognome}, trasmetto in allegato i conteggi relativi alle differenze retributive maturate.\n\nDistinti Saluti,\nUfficio Vertenze`;
    window.location.href = `mailto:${profile.pec}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // --- FUNZIONE STAMPA PDF (MOTORE MATEMATICO CORRETTO) ---
  const handlePrintTables = () => {
    // 1. SETUP COLONNE E FONT
    const indennitaCols = getColumnsByProfile(worker.profilo).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
    );

    const colCount = indennitaCols.length + 6;
    let dynamicFontSize = 8;
    if (colCount > 10) dynamicFontSize = 7;
    if (colCount > 14) dynamicFontSize = 6;

    // 2. SETUP DOCUMENTO
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const totalPagesExp = '{total_pages_count_string}';
    const fmt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const fmtInt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { maximumFractionDigits: 0 }) : '-';

    // 3. PREPARAZIONE DATI
    const yearsToPrint = Array.from(new Set(monthlyInputs.map((d: any) => Number(d.year))))
      .sort((a: number, b: number) => a - b) as number[];

    // Variabili per i totali PDF
    const yearlyRows: any[] = [];
    const pivotData: any = {};

    // Inizializzazione Totali Generali
    let grandTotalIndemnity = 0;
    let grandTotalLordo = 0;
    let grandTotalTicket = 0;
    let grandTotalNet = 0;
    let grandTotalFerieEffettive = 0;
    let grandTotalFeriePagate = 0;

    const CAP = includeExFest ? 32 : 28;

    yearsToPrint.forEach((year: number) => {
      // IMPORTANTE: Ordine cronologico per il tetto progressivo
      const months = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      // Totali dell'ANNO corrente
      let yIndemnity = 0; // Totale Voci Variabili
      let yWorkDays = 0; // Totale Giorni Lavorati
      let yLordo = 0; // Totale Spettante (calcolato mese su mese)
      let yTicket = 0; // Totale Ticket
      let yPercepito = 0; // Totale Percepito
      let yFerieEffettive = 0;
      let yFeriePagate = 0;
      let ferieCumulateAnno = 0;

      // --- CICLO MESE PER MESE (LOGICA PUNTUALE) ---
      // @ts-ignore
      months.forEach(row => {
        // 1. Somma voci del mese
        let monthVoci = 0;
        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          monthVoci += val;
          // Pivot Data (per la tabella 2)
          if (!pivotData[col.label]) pivotData[col.label] = {};
          if (!pivotData[col.label][year]) pivotData[col.label][year] = 0;
          pivotData[col.label][year] += val;
        });

        yIndemnity += monthVoci;
        const ggLav = parseLocalFloat(row.daysWorked);
        yWorkDays += ggLav;

        const ggFerie = parseLocalFloat(row.daysVacation);
        const coeffT = parseLocalFloat(row['coeffTicket']);
        const coeffP = parseLocalFloat(row['coeffPercepito']);

        // 2. Logica Bucket (Tetto 28/32)
        const spazio = Math.max(0, CAP - ferieCumulateAnno);
        const ggUtili = Math.min(ggFerie, spazio);
        ferieCumulateAnno += ggFerie;

        // 3. Calcolo Lordo MESE SU MESE (Non media annuale!)
        let rowLordo = 0;
        if (ggLav > 0) {
          rowLordo = (monthVoci / ggLav) * ggUtili;
        }

        const rowTicket = ggUtili * coeffT;
        const rowPercepito = ggUtili * coeffP;

        // Somma agli accumulatori annuali
        yLordo += rowLordo;
        yTicket += rowTicket;
        yPercepito += rowPercepito;
        yFerieEffettive += ggFerie;
        yFeriePagate += ggUtili;

        // Salvataggio temporaneo per dettaglio PDF (Tabella 3)
        // @ts-ignore
        row._tempLordo = rowLordo;
        // @ts-ignore
        row._tempGgUtili = ggUtili;
        // @ts-ignore
        row._tempNettoRow = (rowLordo - rowPercepito) + rowTicket;
      });

      // 4. Calcolo Netto Annuale
      const yNetto = (yLordo - yPercepito) + yTicket;

      // Calcolo Media Visuale (Solo statistica per la tabella riepilogativa)
      // Nota: Questa media è "ex-post", serve solo per dare un'idea del valore medio giornaliero pagato
      const annualAvgVisual = yFeriePagate > 0 ? yLordo / yFeriePagate : 0;

      yearlyRows.push([
        year,
        fmt(yIndemnity),
        fmtInt(yWorkDays),
        fmt(annualAvgVisual), // Mostriamo la media reale pagata
        `${fmtInt(yFeriePagate)} / ${fmtInt(yFerieEffettive)}`,
        fmt(yLordo),
        fmt(yTicket),
        fmt(yNetto)
      ]);

      grandTotalIndemnity += yIndemnity;
      grandTotalLordo += yLordo;
      grandTotalTicket += yTicket;
      grandTotalNet += yNetto;
      grandTotalFerieEffettive += yFerieEffettive;
      grandTotalFeriePagate += yFeriePagate;
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

    const drawHeaderFooter = (data: any) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(23, 37, 84);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text(`CONTEGGIO DIFFERENZE RETRIBUTIVE (Max ${CAP}gg)`, 14, 12);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
      doc.text(`Pratica: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, pageWidth - 14, 12, { align: 'right' });
      const str = "Pagina " + doc.getNumberOfPages();
      doc.setFontSize(8); doc.setTextColor(100);
      doc.text(str, pageWidth - 14, pageHeight - 10, { align: 'right' });
      doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 14, pageHeight - 10);
    };

    let currentY = 30;

    // --- TABELLA 1 ---
    doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
    doc.text("1. RIEPILOGO ANNUALE (Applicazione Sent. Cass. 20216/2022)", 14, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['ANNO', 'TOT. VARIABILI', 'GG LAV.', 'MEDIA GIORN.', 'GG UTILI / TOT', 'DIFF. LORDA', 'TICKET', 'NETTO DOVUTO']],
      body: yearlyRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: 50, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: [23, 37, 84], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252] },
        4: { halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' },
        7: { fontStyle: 'bold', halign: 'right', fillColor: [220, 252, 231], textColor: [21, 128, 61] }
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
    doc.text("2. ANALISI ANALITICA VOCI (Breakdown)", 14, currentY);

    const pivotHead = ['VOCE', ...yearsToPrint.map(String), 'TOTALE'];
    const pivotBody = Object.keys(pivotData).sort().map(key => {
      let rowTotal = 0;
      const row = [key];
      yearsToPrint.forEach(year => {
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

    // --- TABELLA 3 ---
    doc.addPage();
    currentY = 30;
    doc.setFontSize(12); doc.setTextColor(23, 37, 84);
    doc.text("3. DETTAGLIO MENSILE ANALITICO", 14, currentY);

    yearsToPrint.forEach(year => {
      // @ts-ignore
      if (currentY > 160) { doc.addPage(); currentY = 30; }

      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`ANNO ${year}`, 14, currentY + 8);

      const yearRows = monthlyInputs.filter(d => Number(d.year) === year).sort((a, b) => a.monthIndex - b.monthIndex);

      const tableHead = [
        'MESE',
        ...indennitaCols.map(c => {
          const words = c.label.split(' ');
          let formattedLabel = words.join('\n');
          if (c.subLabel) formattedLabel += `\n${c.subLabel}`;
          return formattedLabel.toUpperCase();
        }),
        'GG\nLAV', 'GG\nFER', 'GG\nUTILI', 'COEFF.\nTICKET', 'NETTO'
      ];

      const tableBody = yearRows.map(row => {
        const monthName = row.month ? row.month : (MONTH_NAMES[row.monthIndex] || '');
        const rowData = [monthName.substring(0, 3).toUpperCase()];

        indennitaCols.forEach(col => {
          const val = parseLocalFloat(row[col.id]);
          rowData.push(fmt(val) === '-' ? '' : fmt(val));
        });

        const ggLav = parseLocalFloat(row.daysWorked);
        const ggFerie = parseLocalFloat(row.daysVacation);
        // @ts-ignore
        const ggUtili = row._tempGgUtili || 0;
        const coeffT = parseLocalFloat(row['coeffTicket']);
        // @ts-ignore
        const netto = row._tempNettoRow || 0;

        rowData.push(
          ggLav > 0 ? String(ggLav) : '',
          ggFerie > 0 ? String(ggFerie) : '',
          ggUtili !== ggFerie ? { content: String(fmtInt(ggUtili)), styles: { textColor: [220, 38, 38], fontStyle: 'bold' } } : String(fmtInt(ggUtili)),
          coeffT > 0 ? fmt(coeffT) : '',
          netto !== 0 ? fmt(netto) : '-'
        );
        return rowData;
      });

      autoTable(doc, {
        startY: currentY + 12,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        styles: {
          fontSize: dynamicFontSize,
          cellPadding: 1.5,
          halign: 'right',
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
          textColor: 50,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [23, 37, 84],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          lineColor: 255,
          lineWidth: 0.1,
          minCellHeight: 15
        },
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

  // --- GESTIONE IMMAGINE ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPayslipImg(event.target?.result as string);
        setImgScale(1);
        setImgPos({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoom = (delta: number) => {
    setImgScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
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
      if (payslipImg) setIsDragging(true);
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

  // --- PUNTO 4: STATISTICHE GLOBALI (CORRETTO) ---
  const globalStats = useMemo(() => {
    if (!monthlyInputs || !Array.isArray(monthlyInputs)) return [];

    // 1. Recuperiamo i dati calcolati
    const { globalLordo, globalTicket, globalFerieEffettive, globalFeriePagate } = calculateAnnualLegalData(monthlyInputs, worker.profilo, includeExFest);

    // 2. Recuperiamo il totale dal Deal Maker (che ora esiste sicuro grazie alla correzione sopra)
    const totaleRecupero = dealStats.netDifference || 0;

    // 3. Calcoliamo il Già Percepito per differenza
    // Formula: Lordo Totale - (Recupero Netto - Ticket)
    // Se il risultato è negativo (strano ma possibile), lo mettiamo a 0
    let totaleGiaPercepito = globalLordo - (totaleRecupero - globalTicket);
    if (totaleGiaPercepito < 0) totaleGiaPercepito = 0;

    return [
      {
        label: "NETTO RECUPERABILE",
        value: totaleRecupero.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }),
        icon: Wallet,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        note: "Differenza dovuta + Ticket"
      },
      {
        label: "LORDO SPETTANTE",
        value: globalLordo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }),
        icon: TrendingUp,
        color: "text-blue-600 bg-blue-50 border-blue-200",
        note: "Calcolato su gg utili (Cass. 20216)"
      },
      {
        label: "GIÀ PERCEPITO",
        value: totaleGiaPercepito.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }),
        icon: CheckCircle2,
        color: "text-orange-600 bg-orange-50 border-orange-200",
        note: "Importo da detrarre"
      },
      {
        label: includeExFest ? "FERIE PAGABILI (32GG)" : "FERIE PAGABILI (28GG)",
        value: `${globalFeriePagate.toLocaleString('it-IT', { maximumFractionDigits: 1 })} / ${globalFerieEffettive.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`,
        icon: CalendarClock,
        color: "text-indigo-600 bg-indigo-50 border-indigo-200",
        note: `Eccedenza: ${(globalFerieEffettive - globalFeriePagate).toLocaleString('it-IT', { maximumFractionDigits: 1 })} gg`
      },
    ];
  }, [monthlyInputs, worker.profilo, includeExFest, dealStats]);
  // --- AGGIUNGI QUESTA RIGA QUI SOTTO ---
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
            <button
              onClick={onBack}
              className="group relative px-5 py-2.5 rounded-xl font-bold text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)' }} // Blue -> Cyan
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
              <span className="hidden xl:inline">Dashboard</span>
            </button>

            <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg text-white"
                style={{ background: `linear-gradient(135deg, ${worker.accentColor === 'indigo' ? '#6366f1' : worker.accentColor === 'emerald' ? '#10b981' : worker.accentColor === 'orange' ? '#f97316' : '#3b82f6'}, ${worker.accentColor === 'indigo' ? '#4f46e5' : worker.accentColor === 'emerald' ? '#059669' : worker.accentColor === 'orange' ? '#ea580c' : '#2563eb'})` }}>
                <User className="w-6 h-6" />
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                    {worker.cognome} {worker.nome}
                  </h1>
                  <BadgeCheck className="w-5 h-5 text-blue-500" />
                  <div className={`ml-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter border ${worker.profilo === 'ELIOR'
                    ? 'bg-orange-50 text-orange-600 border-orange-200'
                    : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                    {worker.profilo}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                  <Briefcase className="w-3 h-3" />
                  <span>{worker.ruolo}</span>
                  {/* NUOVO BOTTONE TOGGLE EX-FEST */}
                  <button
                    onClick={() => setIncludeExFest(!includeExFest)}
                    className={`ml-4 flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${includeExFest
                      ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'
                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                      }`}
                  >
                    <CalendarPlus size={10} />
                    {includeExFest ? "Tetto 32gg (ExF)" : "Tetto 28gg (Std)"}
                  </button>
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
              onClick={onOpenReport}
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
            <div className="flex p-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-2xl gap-3 overflow-x-auto w-full justify-start md:justify-center scrollbar-hide">

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
              {/* TASTO SCAN AI (Viola/Indaco) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${isAnalyzing
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-violet-500 hover:shadow-md hover:border-violet-200'
                  }`}
              >
                {/* EFFETTO SERRANDA */}
                {!isAnalyzing && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>}

                <div className="relative z-10 flex items-center gap-2">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                      <span>Analisi in corso...</span>
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="hidden lg:inline">Scan AI Busta</span>
                    </>
                  )}
                </div>
              </button>

              {/* INPUT FILE NASCOSTO COLLEGATO AL TASTO */}
              <input
                type="file"
                accept="image/*,.pdf"
                ref={fileInputRef}
                className="hidden"
                onChange={handleAnalyzePaySlip}
              />

              <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
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
                      <AnnualCalculationTable data={monthlyInputs} profilo={worker.profilo} onDataChange={handleDataChange} />
                    </div>
                  )}

                  {activeTab === 'pivot' && (
                    <div className="h-full overflow-auto custom-scrollbar pr-2">
                      <IndemnityPivotTable data={monthlyInputs} profilo={worker.profilo} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* --- SPLIT SCREEN SIDEBAR (Invariato) --- */}
        <AnimatePresence>
          {showSplit && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: "45%", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 relative shrink-0"
            >
              <div className="p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex justify-between items-center z-20">
                <div className="flex items-center gap-2 text-slate-300">
                  {isSniperMode ? <Crosshair className="w-5 h-5 text-red-500 animate-pulse" /> : <Eye className="w-5 h-5 text-indigo-400" />}
                  <span className="text-xs font-bold uppercase tracking-wider">{isSniperMode ? 'MODALITÀ CECCHINO ATTIVA' : 'Visore Busta Paga'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {payslipImg && (
                    <>
                      <button
                        onClick={() => setIsSniperMode(!isSniperMode)}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSniperMode ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanEye className="w-4 h-4" />}
                        {isSniperMode ? 'ANNULLA' : 'LEGGI NUMERO'}
                      </button>

                      <div className="h-6 w-px bg-slate-600 mx-2"></div>

                      <button onClick={() => handleZoom(-0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
                      <button onClick={() => { setImgScale(1); setImgPos({ x: 0, y: 0 }); }} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><Maximize className="w-4 h-4" /></button>
                      <button onClick={() => handleZoom(0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
                      <button onClick={() => setPayslipImg(null)} className="p-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded-lg ml-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => setShowSplit(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white ml-2"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div
                ref={containerRef}
                className={`flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center ${isSniperMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onMouseMove={handleMouseMove}
              >
                {payslipImg ? (
                  <div className="relative">
                    <img
                      ref={imgRef}
                      src={payslipImg}
                      alt="Busta Paga"
                      draggable={false}
                      style={{
                        transform: `scale(${imgScale}) translate(${imgPos.x}px, ${imgPos.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                      }}
                      className="max-w-full max-h-full object-contain select-none"
                    />

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
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer p-10 border-2 border-dashed border-slate-700 rounded-3xl hover:border-indigo-500/50 hover:bg-slate-900"
                  >
                    <Upload className="w-12 h-12 mb-4" />
                    <p className="font-bold">Clicca per caricare la Busta Paga</p>
                    <p className="text-xs mt-2 opacity-60">Supporta JPG, PNG</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              {payslipImg && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full text-[10px] text-white/70 pointer-events-none">
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
    </div>
  );
};

export default WorkerDetailPage;  