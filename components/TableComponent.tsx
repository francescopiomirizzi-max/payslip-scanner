import React, { useMemo, useState } from 'react';
import { Worker, AnnoDati, parseFloatSafe, YEARS, getColumnsByProfile } from '../types';
import {
  Printer,
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  FileText,
  Gavel,
  CalendarPlus,
  AlertCircle,
  Info,
  Ticket,
  Eye,
  EyeOff
} from 'lucide-react';
import { RelazioneModal } from '../RelazioneModal';
import { motion, AnimatePresence } from 'framer-motion';
// LIBRERIE PDF NATIVE
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TableComponentProps {
  worker: Worker;
  onBack: () => void;
  onEdit: () => void;
  startClaimYear: number; // <--- NUOVA PROP AGGIUNTA
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

// --- FUNZIONE PDF AGGIORNATA CON LOGICA ANNO RIFERIMENTO ---
const handleDownloadPDF = (
  doc: any,
  worker: Worker,
  startYear: number,
  endYear: number,
  tableData: any[],
  totals: any,
  includeTickets: boolean,
  showPercepito: boolean,
  startClaimYear: number // <--- Passiamo l'anno di start
) => {
  const fmt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-';
  const fmtNum = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, 297, 25, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("PROSPETTO UFFICIALE DI RICALCOLO", 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(`Dipendente: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, 14, 18);
  doc.text(`Periodo Conteggi: ${startClaimYear} - ${endYear}`, 14, 22);

  // Costruzione dinamica Header e Righe PDF
  const headRow = ['ANNO', 'TOT. VOCI\nRETRIBUTIVE', 'DIVISORE\nANNUO', 'INCIDENZA\nGIORNALIERA', 'GIORNI FERIE\n(PAGABILI)', 'LORDO\nFERIE'];

  if (showPercepito) {
    headRow.push('INDENNITÀ\nPERCEPITA');
  }

  headRow.push('NETTO DA\nPERCEPIRE');

  if (includeTickets) {
    headRow.push('CREDITO\nTICKET');
  }

  const tableBody = tableData.map(row => {
    // Check se è anno di riferimento (precedente allo start)
    const isRef = row.anno < startClaimYear;

    const rowData: any[] = [
      isRef ? `${row.anno} (Rif.)` : row.anno,
      fmt(row.totaleVoci),
      fmtNum(row.divisore),
      fmt(row.incidenzaGiornata),
      fmtNum(row.giornateFerie),
      isRef ? '(Solo Media)' : fmt(row.incidenzaTotale) // Nascondi soldi se Rif.
    ];

    if (showPercepito) {
      rowData.push(isRef ? '-' : fmt(row.indennitaPercepita));
    }

    rowData.push(isRef ? '-' : fmt(row.totaleDaPercepire));

    if (includeTickets) {
      rowData.push(isRef ? '-' : fmt(row.indennitaPasto));
    }

    return rowData;
  });

  const totRow: any[] = ['TOTALE', '-', '-', '-', '-', fmt(totals.incidenzaTotale)];
  if (showPercepito) totRow.push(fmt(totals.indennitaPercepita));
  totRow.push(fmt(totals.totaleDaPercepire));
  if (includeTickets) totRow.push(fmt(totals.indennitaPasto));
  tableBody.push(totRow);

  // Calcolo indici colonne per stili
  const indexNetto = headRow.indexOf('NETTO DA\nPERCEPIRE');
  const indexTicket = includeTickets ? headRow.indexOf('CREDITO\nTICKET') : -1;

  const dynamicColumnStyles: any = {
    0: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] },
    3: { textColor: [30, 64, 175], fontStyle: 'bold' }
  };

  if (indexNetto !== -1) {
    dynamicColumnStyles[indexNetto] = { fontStyle: 'bold', fillColor: [254, 249, 195], textColor: [0, 0, 0], fontSize: 10 };
  }

  if (indexTicket !== -1) {
    dynamicColumnStyles[indexTicket] = { textColor: [22, 163, 74] };
  }

  autoTable(doc, {
    startY: 35,
    head: [headRow],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      valign: 'middle',
      halign: 'right',
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [50, 50, 50]
    },
    headStyles: {
      fillColor: [23, 37, 84],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: dynamicColumnStyles,
    didParseCell: (data) => {
      // Stile Totali
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 10;
        if (data.column.index === 0) {
          data.cell.styles.halign = 'left';
          data.cell.styles.fillColor = [22, 163, 74];
          data.cell.styles.textColor = [255, 255, 255];
        } else if (data.column.index === indexNetto) {
          data.cell.styles.fillColor = [220, 38, 38];
          data.cell.styles.textColor = [255, 255, 255];
        }
      }

      // Stile Righe Anno Riferimento (Grigino e testo chiaro)
      // @ts-ignore
      if (data.row.raw && typeof data.row.raw[0] === 'string' && data.row.raw[0].includes('(Rif.)')) {
        data.cell.styles.fillColor = [245, 245, 245];
        data.cell.styles.textColor = [150, 150, 150];
        // Mantiene leggibile la media (colonna 3)
        if (data.column.index === 3) data.cell.styles.textColor = [180, 83, 9];
      }
    }
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 30;
  if (finalY > 170) { doc.addPage(); finalY = 40; }

  doc.setFontSize(10);
  doc.setTextColor(0);

  doc.text("Firma del Dipendente", 60, finalY, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(30, finalY + 10, 90, finalY + 10);

  doc.text("Timbro e Firma Responsabile", 230, finalY, { align: 'center' });
  doc.line(200, finalY + 10, 260, finalY + 10);

  doc.save(`Prospetto_${worker.cognome}_${worker.nome}.pdf`);
};

// --- COMPONENTE PRINCIPALE ---
const TableComponent: React.FC<TableComponentProps> = ({ worker, onBack, onEdit, startClaimYear }) => {

  const [isRelazioneOpen, setIsRelazioneOpen] = useState(false);
  const [showInfoTetto, setShowInfoTetto] = useState(false);

  // --- STATI CON MEMORIA (LOCALSTORAGE) ---
  const [includeExFest, setIncludeExFest] = useState(() => {
    const saved = localStorage.getItem(`report_exfest_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [includeTickets, setIncludeTickets] = useState(() => {
    const saved = localStorage.getItem(`report_tickets_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [showPercepito, setShowPercepito] = useState(() => {
    const saved = localStorage.getItem(`report_percepito_${worker.id}`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  React.useEffect(() => {
    localStorage.setItem(`report_exfest_${worker.id}`, JSON.stringify(includeExFest));
    localStorage.setItem(`report_tickets_${worker.id}`, JSON.stringify(includeTickets));
    localStorage.setItem(`report_percepito_${worker.id}`, JSON.stringify(showPercepito));
  }, [includeExFest, includeTickets, showPercepito, worker.id]);

  // --- 1. LOGICA DATI CORRETTA (FILTRO DINAMICO) ---
  const tableData = useMemo(() => {
    const sortedYears = [...YEARS].sort((a: number, b: number) => a - b);
    const TETTO_FERIE = includeExFest ? 32 : 28;
    const profileColumns = getColumnsByProfile(worker.profilo);

    // STEP A: PRE-CALCOLO MEDIE ANNUALI
    const yearlyRawStats: Record<number, { totVar: number; ggLav: number }> = {};
    const safeRows = worker.anni || [];

    safeRows.forEach(row => {
      const y = Number(row.year);
      if (!yearlyRawStats[y]) yearlyRawStats[y] = { totVar: 0, ggLav: 0 };

      const ggLav = parseFloatSafe(row.daysWorked);
      if (ggLav > 0) {
        let monthlyVoci = 0;
        profileColumns.forEach(col => {
          if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(col.id)) {
            monthlyVoci += parseFloatSafe(row[col.id]);
          }
        });
        yearlyRawStats[y].totVar += monthlyVoci;
        yearlyRawStats[y].ggLav += ggLav;
      }
    });

    const yearlyAverages: Record<number, number> = {};
    Object.keys(yearlyRawStats).forEach(yStr => {
      const y = Number(yStr);
      const s = yearlyRawStats[y];
      yearlyAverages[y] = s.ggLav > 0 ? s.totVar / s.ggLav : 0;
    });

    // STEP B: COSTRUZIONE RIGHE REPORT
    let ferieCumulateCounter = 0;

    return sortedYears.map(year => {
      // FILTRO: Ignora anni precedenti al "Reference Year" (Start - 1)
      if (year < startClaimYear - 1) return null;

      const yearRows = safeRows.filter(r => r.year === year).sort((a, b) => a.monthIndex - b.monthIndex);
      if (yearRows.length === 0) return null;

      let avgApplied = yearlyAverages[year - 1];
      if (avgApplied === undefined || avgApplied === 0) {
        avgApplied = yearlyAverages[year] || 0;
      }

      let yearlyDaysVacationUtili = 0;
      let yearlyGrossAmount = 0;
      let yearlyPercepitoVal = 0;
      let yearlyTicketVal = 0;

      let displayTotalVoci = yearlyRawStats[year]?.totVar || 0;
      let displayTotalDaysWorked = yearlyRawStats[year]?.ggLav || 0;

      yearRows.forEach(row => {
        const gFerieReali = parseFloatSafe(row.daysVacation);
        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += gFerieReali;

        let gFerieUtili = 0;
        const spazioRimanente = Math.max(0, TETTO_FERIE - prevTotal);
        gFerieUtili = Math.min(gFerieReali, spazioRimanente);

        if (gFerieUtili > 0) {
          yearlyGrossAmount += (gFerieUtili * avgApplied);

          const coeffPercepito = parseFloatSafe(row.coeffPercepito);
          const coeffTicket = parseFloatSafe(row.coeffTicket);

          yearlyPercepitoVal += (gFerieUtili * coeffPercepito);

          // APPLICA IL TOGGLE TICKET
          yearlyTicketVal += includeTickets ? (gFerieUtili * coeffTicket) : 0;

          yearlyDaysVacationUtili += gFerieUtili;
        }
      });

      const netAmount = (yearlyGrossAmount - yearlyPercepitoVal) + yearlyTicketVal;

      return {
        anno: year,
        totaleVoci: displayTotalVoci,
        divisore: displayTotalDaysWorked,
        incidenzaGiornata: avgApplied,
        giornateFerie: yearlyDaysVacationUtili,
        incidenzaTotale: yearlyGrossAmount,
        indennitaPercepita: yearlyPercepitoVal,
        totaleDaPercepire: netAmount,
        indennitaPasto: yearlyTicketVal
      };
    }).filter(Boolean);
  }, [worker, includeExFest, includeTickets, startClaimYear]); // Dipendenze aggiornate

  // 2. CALCOLO TOTALI GENERALI
  const totals = useMemo(() => {
    return tableData.reduce((acc, row) => {
      // --- MODIFICA CRUCIALE: Se è anno di riferimento, NON sommare ---
      if (row.anno < startClaimYear) return acc;

      return {
        incidenzaTotale: acc.incidenzaTotale + row.incidenzaTotale,
        indennitaPercepita: acc.indennitaPercepita + row.indennitaPercepita,
        totaleDaPercepire: acc.totaleDaPercepire + row.totaleDaPercepire,
        indennitaPasto: acc.indennitaPasto + row.indennitaPasto
      };
    }, {
      incidenzaTotale: 0,
      indennitaPercepita: 0,
      totaleDaPercepire: 0,
      indennitaPasto: 0
    });
  }, [tableData, startClaimYear]);

  // Start/End per visualizzazione (Mostriamo anche il 2007 se presente come riferimento)
  const startYear = tableData.length > 0 ? tableData[0].anno : startClaimYear;
  const endYear = tableData.length > 0 ? tableData[tableData.length - 1].anno : 2025;

  const handlePrint = () => {
    window.print();
  };

  // --- FUNZIONE DIFFIDA COMPLETA (Testo Ripristinato) ---
  const handlePrintDiffida = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const today = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFont("times", "roman");
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("UFFICIO VERTENZE E LEGALE", 20, 20);
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text("SEDE TERRITORIALE", 20, 25);

    doc.setFontSize(11);
    doc.text(`Luogo, lì ${today}`, 140, 40);

    doc.setFont("times", "bold");
    doc.text("Spett.le Azienda", 120, 55);
    doc.text("Direzione Risorse Umane", 120, 60);
    doc.text("(c.a. Responsabile p.t.)", 120, 65);
    doc.text("SEDE", 120, 70);

    doc.setFont("times", "bold");
    doc.text(`OGGETTO: Diffida ad adempiere e costituzione in mora - Ricalcolo Retribuzione Feriale.`, 20, 90);
    doc.text(`Lavoratore: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, 20, 95);

    doc.setFont("times", "normal");

    let testoCodici = "";
    if (worker.profilo === 'RFI' || !worker.profilo) {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle voci variabili ricorrenti, tra cui a titolo esemplificativo: Straordinario Diurno (0152), Notturno (0421), Chiamata (0470, 0496), Reperibilità (0482), Ind. Linea (0687), Trasferta (0AA1) e altre indennità accessorie contrattualmente previste.";
    } else if (worker.profilo === 'REKEEP') {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle indennità specifiche di appalto (Turni non cadenzati, Ind. Sussidiaria, Maggiorazioni) previste dal CCNL Multiservizi/Ferroviario.";
    }

    const bodyText = `
Scrivo in nome e per conto del Sig. ${worker.nome} ${worker.cognome}, vostro dipendente, il quale mi ha conferito espresso mandato per la tutela dei suoi diritti patrimoniali.

Dall'esame della documentazione retributiva relativa al periodo ${startClaimYear} - ${endYear}, è emerso che la Vostra Società non ha correttamente incluso le voci retributive accessorie e variabili nella base di calcolo della retribuzione feriale, in violazione dell'Art. 36 della Costituzione, della Direttiva 2003/88/CE e dei principi di diritto consolidati dalla Corte di Cassazione (Sent. n. 20216 del 23/06/2022).

Nello specifico, il ricalcolo è stato effettuato applicando il "principio di onnicomprensività" della retribuzione feriale, utilizzando come divisore le giornate lavorative effettive e come moltiplicatore i giorni di ferie fruiti (entro il limite del periodo minimo protetto di ${includeExFest ? "32" : "28"} giorni annui).

${testoCodici}

Tutto ciò premesso, con la presente

VI INVITO E DIFFIDO

a corrispondere al mio assistito, entro e non oltre 10 giorni dal ricevimento della presente, la somma complessiva di:

EURO ${formatCurrency(totals.totaleDaPercepire)} (Netto differenze ricalcolate)

Tale somma è comprensiva delle differenze retributive maturate e del valore dei buoni pasto non riconosciuti, oltre agli interessi legali e alla rivalutazione monetaria maturati dal dovuto al saldo effettivo.

In difetto di riscontro entro il termine assegnato, sarò costretto ad adire l'Autorità Giudiziaria competente per il recupero coattivo del credito e delle spese legali, senza ulteriore avviso.

Distinti saluti.
    `;

    const splitText = doc.splitTextToSize(bodyText.trim(), 170);
    let currentY = 110;

    if (splitText.length > 30) {
      doc.addPage();
      currentY = 20;
    }

    doc.text(splitText, 20, currentY);

    const signY = currentY + (splitText.length * 5) + 20;

    if (signY > 250) {
      doc.addPage();
      doc.text("Firme:", 20, 20);
    }

    doc.setFont("times", "bold");
    doc.text("Il Lavoratore (per ratifica)", 30, signY > 250 ? 40 : signY);
    doc.text("L'Ufficio Vertenze / Legale", 120, signY > 250 ? 40 : signY);

    doc.setLineWidth(0.1);
    doc.line(30, (signY > 250 ? 40 : signY) + 15, 90, (signY > 250 ? 40 : signY) + 15);
    doc.line(120, (signY > 250 ? 40 : signY) + 15, 180, (signY > 250 ? 40 : signY) + 15);

    doc.save(`Diffida_${worker.cognome}_${worker.nome}.pdf`);
  };

  // --- GENERAZIONE REPORT PDF UFFICIALE (Locale) ---
  const handleDownloadPDFLocal = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    // Chiamata alla funzione esterna passando startClaimYear
    handleDownloadPDF(doc, worker, startYear, endYear, tableData, totals, includeTickets, showPercepito, startClaimYear);
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center font-sans text-gray-900 pb-20">

      {/* CSS STAMPA BROWSER */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; zoom: 75%; padding: 10mm; }
          .no-print { display: none !important; }
          .print-container { overflow: visible !important; width: 100% !important; display: block !important; }
          table { width: 100% !important; font-size: 12px !important; }
          tr.bg-blue-header { background-color: #7EB6D3 !important; color: black !important; }
          td.bg-green-total { background-color: #92D050 !important; }
          td.bg-red-total { background-color: #FF5050 !important; color: white !important; }
          td.bg-yellow-cell { background-color: #fef08a !important; }
          td.row-ref { background-color: #f3f4f6 !important; color: #9ca3af !important; }
        }
      `}</style>

      {/* HEADER NAV */}
      <div className="no-print w-full p-5 bg-slate-900 text-white flex justify-between items-center shadow-2xl sticky top-0 z-50 border-b border-slate-700">
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-4 border-l border-slate-700 pl-8 h-full">
            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide text-slate-100">Prospetto Ufficiale</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm uppercase font-medium text-slate-400 tracking-wider">Report {startClaimYear} - {endYear}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${includeExFest ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-slate-400 border-slate-500'}`}>
                  {includeExFest ? <AlertCircle size={10} /> : null}
                  {includeExFest ? 'Tetto 32gg' : 'Tetto 28gg'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">

          {/* --- GRUPPO TOGGLE --- */}
          <div className="relative flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">

            {/* Tasto Tetto Ferie */}
            <button
              onClick={() => setIncludeExFest(!includeExFest)}
              className={`group relative px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all duration-300 flex items-center gap-2 ${includeExFest
                ? 'bg-amber-600 text-white border border-amber-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:text-white'
                }`}
            >
              <CalendarPlus className="w-4 h-4 shrink-0" />
              <div className="flex flex-col items-start leading-none">
                <span className="whitespace-nowrap">{includeExFest ? "32gg (ExF)" : "28gg (Std)"}</span>
              </div>
            </button>

            {/* Tasto Ticket */}
            <button
              onClick={() => setIncludeTickets(!includeTickets)}
              className={`group relative px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all duration-300 flex items-center gap-2 ${includeTickets
                ? 'bg-indigo-600 text-white border border-indigo-400'
                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-white line-through opacity-70'
                }`}
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Ticket</span>
            </button>

            {/* Tasto Colonna Percepito */}
            <button
              onClick={() => setShowPercepito(!showPercepito)}
              className={`group relative px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all duration-300 flex items-center gap-2 ${showPercepito
                ? 'bg-orange-600 text-white border border-orange-400'
                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-white opacity-70'
                }`}
              title="Mostra/Nascondi colonna Indennità Già Percepita"
            >
              {showPercepito ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
              <span className="whitespace-nowrap">Già Perc.</span>
            </button>

            {/* Tasto Info */}
            <button
              onClick={() => setShowInfoTetto(!showInfoTetto)}
              className={`p-2 rounded-xl transition-all ${showInfoTetto ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* TOOLTIP/MODALE INFO */}
            <AnimatePresence>
              {showInfoTetto && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-4 w-96 bg-white text-slate-800 p-5 rounded-2xl shadow-2xl border border-slate-200 z-[100] text-left"
                >
                  <div className="absolute -top-2 right-12 w-4 h-4 bg-white transform rotate-45 border-t border-l border-slate-200"></div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Nota Metodologica
                  </h4>
                  <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <strong className="block text-green-700 mb-1">🟢 Tetto 28 Giorni (Standard Legale)</strong>
                      Si basa sul periodo minimo di ferie (4 settimane) garantito dalla <strong>Direttiva UE 2003/88</strong> e dall'Art. 36 Cost. È il parametro "blindato" confermato dalla Cassazione n. 20216/2022. <span className="underline decoration-green-300">Opzione consigliata per evitare contestazioni.</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <strong className="block text-amber-700 mb-1">🟠 Tetto 32 Giorni (Esteso)</strong>
                      Include nel calcolo anche le 4 giornate di <strong>Ex-Festività</strong> (permessi soppressi). Sebbene aumenti l'importo recuperabile, questa estensione non è esplicitamente coperta dalla sentenza 20216/2022 e potrebbe essere oggetto di eccezione da parte dell'azienda.
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInfoTetto(false)}
                    className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-colors"
                  >
                    Ho capito
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handlePrintDiffida}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #9333ea 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <Gavel className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Diffida</span>
          </button>

          <button
            onClick={() => setIsRelazioneOpen(true)}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <FileText className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Relazione</span>
          </button>

          <button
            onClick={onEdit}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #059669 0%, #14b8a6 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <LayoutGrid className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Gestione Dati</span>
          </button>

          <button
            onClick={handleDownloadPDFLocal}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #dc2626 0%, #e11d48 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <FileDown className="w-5 h-5 transition-transform duration-500 group-hover:bounce" strokeWidth={2.5} />
            <span>PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="group relative px-8 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <Printer className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Stampa</span>
          </button>
        </div>
      </div>

      {/* TABELLA HTML */}
      <div id="report-content" className="w-full flex flex-col items-center">
        <div className="print-container overflow-x-auto print:overflow-visible w-full flex justify-center print:block print:w-full mt-12">
          <div className="inline-block min-w-[1200px] w-full max-w-[1400px] border-2 border-black bg-white shadow-2xl print:shadow-none print:w-full print:border-none rounded-2xl overflow-hidden print:rounded-none">

            <div className="bg-gray-200 border-b border-black text-center py-6 print:bg-gray-200 print:border-black print:py-4 relative">
              <div className="font-black text-2xl uppercase mb-2 print:text-xl">
                Incidenza degli elementi accessori ai fini del calcolo annuale della retribuzione feriale
              </div>
              <div className="text-lg font-normal normal-case print:text-base">
                Lavoratore: <span className="font-bold mr-2">{worker.cognome} {worker.nome}</span> (Matr. {worker.id})
              </div>
              <div className="text-lg font-normal normal-case print:text-base">
                Periodo Conteggi: dal 01-01-{startClaimYear} al 31-12-{endYear}
              </div>
            </div>

            <table className="w-full border-collapse text-sm text-center">
              <thead>
                <tr className="bg-[#7EB6D3] bg-blue-header text-black print:bg-[#7EB6D3] print:text-black h-12" style={{ backgroundColor: '#7EB6D3' }}>
                  <th className="border border-black p-2 font-bold text-base w-20 align-middle">Anno</th>
                  <th className="border border-black p-2 font-bold text-base w-40 align-middle">Totale Voci<br />Retributive<br />Accessorie</th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Divisore Annuo<br /><span className="text-sm font-normal">(media gg lav.)</span></th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Incidenza per<br />Giornate di<br />Ferie</th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle bg-yellow-50 print:bg-yellow-50">
                    Giornate Ferie<br />
                    <span className="text-xs font-normal">(Pagabili {includeExFest ? "32" : "28"})</span>
                  </th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Incidenza<br />(Lordo)</th>

                  {/* Visualizzazione Condizionale Intestazioni */}
                  {showPercepito && (
                    <th className="border border-black p-2 font-bold text-base w-40 align-middle">INDENNITA'<br />PERCEPITA X<br />gg DI FERIE</th>
                  )}

                  <th className="border border-black p-2 font-black text-base w-40 align-middle">TOTALE<br />INDENNITA' DA<br />PERCEPIRE</th>

                  {includeTickets && (
                    <th className="border border-black p-2 font-bold text-base w-40 align-middle">CREDITO<br />TICKET<br />RESTAURANT</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => {
                  const isRef = row.anno < startClaimYear;
                  return (
                    <tr key={row.anno} className={`h-10 text-base ${isRef ? 'bg-gray-100 row-ref text-gray-500' : ''}`}>
                      <td className={`border border-black px-2 py-1 text-center font-bold ${isRef ? 'bg-gray-200' : 'bg-gray-100 bg-gray-row print:bg-gray-100'}`}>
                        {row.anno} {isRef && <span className="text-[9px] uppercase block">(Rif.)</span>}
                      </td>
                      <td className="border border-black px-2 py-1 text-right">{formatCurrency(row.totaleVoci)}</td>
                      <td className="border border-black px-2 py-1 text-center">{formatNumber(row.divisore)}</td>
                      <td className={`border border-black px-2 py-1 text-right font-medium ${isRef ? 'text-gray-500' : 'text-blue-800'}`}>{formatCurrency(row.incidenzaGiornata)}</td>
                      <td className="border border-black px-2 py-1 text-center font-bold bg-yellow-50 print:bg-yellow-50">{formatNumber(row.giornateFerie)}</td>

                      {/* CELLE MONETARIE (Nascoste se anno riferimento) */}
                      <td className="border border-black px-2 py-1 text-right font-medium">
                        {isRef ? '(Solo Media)' : formatCurrency(row.incidenzaTotale)}
                      </td>

                      {/* Visualizzazione Condizionale Celle */}
                      {showPercepito && (
                        <td className="border border-black px-2 py-1 text-right text-orange-600 font-medium">
                          {isRef ? '-' : formatCurrency(row.indennitaPercepita)}
                        </td>
                      )}

                      <td className={`border border-black px-2 py-1 text-right font-black ${isRef ? 'text-gray-400' : 'bg-yellow-100 bg-yellow-cell print:bg-yellow-50 text-lg'}`}>
                        {isRef ? '-' : formatCurrency(row.totaleDaPercepire)}
                      </td>

                      {includeTickets && (
                        <td className="border border-black px-2 py-1 text-right text-green-700 font-medium">
                          {isRef ? '-' : formatCurrency(row.indennitaPasto)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="h-14 font-black text-lg">
                  <td colSpan={5} className="border border-black bg-[#92D050] bg-green-total text-left px-6 relative align-middle uppercase print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>TOTALE DOVUTO</td>
                  <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.incidenzaTotale)}</td>

                  {showPercepito && (
                    <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-orange-800 print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPercepita)}</td>
                  )}

                  <td className="border border-black bg-[#FF5050] bg-red-total text-right px-2 align-middle text-white text-xl print:bg-[#FF5050] print:text-white" style={{ backgroundColor: '#FF5050', color: 'white' }}>{formatCurrency(totals.totaleDaPercepire)}</td>

                  {includeTickets && (
                    <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-green-900 print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPasto)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="hidden print:flex mt-16 w-full max-w-[1200px] px-8 justify-between text-base font-medium">
          <div className="text-center"><p className="mb-16">Firma del Dipendente</p><div className="border-t-2 border-black w-72"></div></div>
          <div className="text-center"><p className="mb-16">Timbro e Firma Responsabile</p><div className="border-t-2 border-black w-72"></div></div>
        </div>
      </div>

      {isRelazioneOpen && (
        <RelazioneModal
          isOpen={isRelazioneOpen}
          onClose={() => setIsRelazioneOpen(false)}
          worker={worker}
          includeExFest={includeExFest}
          totals={{
            grandTotal: {
              incidenzaTotale: totals.incidenzaTotale,
              indennitaPercepita: totals.indennitaPercepita,
              indennitaPasto: totals.indennitaPasto,
              totalNet: totals.totaleDaPercepire
            }
          }}
        />
      )}
    </div>
  );
};

export default TableComponent;