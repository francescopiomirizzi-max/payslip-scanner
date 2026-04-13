import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useIsland } from '../IslandContext'; // 👈 ECCOLA QUI!
import { Worker, AnnoDati, YEARS, getColumnsByProfile } from '../types';
import { parseLocalFloat, formatCurrency, formatNumber, formatLongDate } from '../utils/formatters';
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
  EyeOff,
  FileQuestion,
  FileSearch
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
  startClaimYear: number;
}

// --- FUNZIONI UTILITY RIMOSSE ---

// --- FUNZIONE PDF ---
const handleDownloadPDF = (
  doc: any,
  worker: Worker,
  startYear: number,
  endYear: number,
  tableData: any[],
  totals: any,
  includeTickets: boolean,
  showPercepito: boolean
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
  doc.text(`Dipendente: ${worker.cognome} ${worker.nome} - Profilo: ${worker.ruolo}`, 14, 18);
  doc.text(`Periodo: ${startYear} - ${endYear}`, 14, 22);

  const headRow = ['ANNO', 'TOT. VOCI\nRETRIBUTIVE', 'DIVISORE\nANNUO', 'INCIDENZA\nGIORNALIERA', 'GIORNI DI FERIE', 'LORDO\nFERIE'];

  if (showPercepito) {
    headRow.push('INDENNITÀ\nPERCEPITA');
  }

  headRow.push('NETTO DA\nPERCEPIRE');

  if (includeTickets) {
    headRow.push('CREDITO\nTICKET');
  }

  const tableBody = tableData.map(row => {
    const rowData: any[] = [
      row.anno,
      fmt(row.totaleVoci),
      fmtNum(row.divisore),
      fmt(row.incidenzaGiornata),
      fmtNum(row.giornateFerie),
      fmt(row.incidenzaTotale)
    ];

    if (showPercepito) {
      rowData.push(fmt(row.indennitaPercepita));
    }

    rowData.push(fmt(row.totaleDaPercepire));

    if (includeTickets) {
      rowData.push(fmt(row.indennitaPasto));
    }

    return rowData;
  });

  const totRow: any[] = ['TOTALE', '-', '-', '-', '-', fmt(totals.incidenzaTotale)];
  if (showPercepito) totRow.push(fmt(totals.indennitaPercepita));
  totRow.push(fmt(totals.totaleDaPercepire));
  if (includeTickets) totRow.push(fmt(totals.indennitaPasto));
  tableBody.push(totRow);

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

  doc.save(`Riepilogo_somme_richieste_${worker.cognome}_${worker.nome}.pdf`);
};

// --- COMPONENTE PRINCIPALE ---
const TableComponent: React.FC<TableComponentProps> = ({ worker, onBack, onEdit, startClaimYear }) => {

  // ✨ BISTURI 1: QUICK ACTIONS CONTESTUALI (Radar Intelligente)
  const { setQuickActions } = useIsland();
  const isQuickActionsActiveRef = useRef(false);

  // 1. Spegnimento sicuro E comunicazione cambio contesto
  useEffect(() => {
    // Diciamo all'isola che siamo nel REPORT
    window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'report' }));

    return () => {
      setQuickActions(false);
      isQuickActionsActiveRef.current = false;
    };
  }, [setQuickActions]);

  // 2. Il Radar e i Comandi "Locali"
  useEffect(() => {
    // Mappiamo i bottoni dell'Isola alle azioni di QUESTA pagina
    const handleDashboardAction = () => onBack();
    const handleEditAction = () => onEdit(); // Tasto centrale
    const handlePrintAction = () => handlePrint(); // Tasto destro (Stampa nativa)

    window.addEventListener('trigger-dashboard', handleDashboardAction);
    window.addEventListener('trigger-edit', handleEditAction);
    window.addEventListener('trigger-print', handlePrintAction);

    const handleGlobalScroll = () => {
      let scrollTop = window.scrollY || document.documentElement.scrollTop;

      if (scrollTop > 80 && !isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = true;
        setQuickActions(true);
      }
      else if (scrollTop <= 20 && isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = false;
        setQuickActions(false);
      }
    };

    window.addEventListener('scroll', handleGlobalScroll, true);

    return () => {
      window.removeEventListener('trigger-dashboard', handleDashboardAction);
      window.removeEventListener('trigger-edit', handleEditAction);
      window.removeEventListener('trigger-print', handlePrintAction);
      window.removeEventListener('scroll', handleGlobalScroll, true);
    };
  }, [onBack, onEdit, setQuickActions]); // 👈 QUESTE ERANO QUELLE MANCANTI!// Si aggiorna sempre per avere i dati PDF più freschi

  const [isRelazioneOpen, setIsRelazioneOpen] = useState(false);
  const [showInfoTetto, setShowInfoTetto] = useState(false);
  // --- STATI CON MEMORIA ---
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

  // --- 1. LOGICA DATI CORRETTA E UNIFICATA ---
  const tableData = useMemo(() => {
    const sortedYears = [...YEARS].sort((a: number, b: number) => a - b);
    const TETTO_FERIE = includeExFest ? 32 : 28;
    const profileColumns = getColumnsByProfile(worker.profilo, worker.eliorType);

    // STEP A: PRE-CALCOLO MEDIE ANNUALI
    const yearlyRawStats: Record<number, { totVar: number; ggLav: number }> = {};
    const safeRows = worker.anni || [];

    safeRows.forEach(row => {
      const y = Number(row.year);
      if (!yearlyRawStats[y]) yearlyRawStats[y] = { totVar: 0, ggLav: 0 };

      // USIAMO parseLocalFloat QUI
      const ggLav = parseLocalFloat(row.daysWorked);
      if (ggLav > 0) {
        let monthlyVoci = 0;
        profileColumns.forEach(col => {
          // Aggiunti '3B70', '3B71' per escluderli dal report e dal PDF
          if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(col.id)) {
            // USIAMO parseLocalFloat QUI
            monthlyVoci += parseLocalFloat(row[col.id]);
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
      // 🔥🔥🔥 MODIFICA QUI: NASCONDI L'ANNO SE È PRECEDENTE ALL'INIZIO CAUSA 🔥🔥🔥
      // Questo impedisce che la riga venga generata, stampata o finisca nel PDF
      if (year < startClaimYear) return null;
      // --- MODIFICA FONDAMENTALE: RIMOSSO IL FILTRO DELL'ANNO DI INIZIO ---
      // Se vuoi che i totali coincidano con AnnualCalculationTable che mostra 4675,
      // dobbiamo calcolare TUTTI gli anni presenti, senza esclusioni.
      // if (year < startClaimYear) return null; <--- RIMOSSO

      const yearRows = safeRows.filter(r => r.year === year).sort((a, b) => a.monthIndex - b.monthIndex);
      if (yearRows.length === 0) return null;

      // RESETTA IL CONTATORE FERIE OGNI ANNO (Coerenza con AnnualCalculationTable)
      ferieCumulateCounter = 0;

      // 2. RECUPERO MEDIA (Anno precedente o corrente)
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
        const gFerieReali = parseLocalFloat(row.daysVacation);

        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += gFerieReali;

        let gFerieUtili = 0;
        const spazioRimanente = Math.max(0, TETTO_FERIE - prevTotal);
        gFerieUtili = Math.min(gFerieReali, spazioRimanente);

        if (gFerieUtili > 0) {
          yearlyGrossAmount += (gFerieUtili * avgApplied);

          const coeffPercepito = parseLocalFloat(row.coeffPercepito);
          const coeffTicket = parseLocalFloat(row.coeffTicket);

          yearlyPercepitoVal += (gFerieUtili * coeffPercepito);

          if (includeTickets) {
            yearlyTicketVal += (gFerieUtili * coeffTicket);
          }

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
    })
      .filter(Boolean); // Rimuove i null (anni saltati)
  }, [worker, includeExFest, includeTickets, startClaimYear]);
  // --- CORREZIONE: ESCLUDERE ANNI RIFERIMENTO DAI TOTALI REPORT ---
  const totals = useMemo(() => {
    return tableData.reduce((acc, row) => {

      // 🔥 AGGIUNGI QUESTA RIGA: Se l'anno è prima dell'inizio causa, SALTALO
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

  const startYear = tableData.length > 0 ? tableData[0].anno : startClaimYear;
  const endYear = tableData.length > 0 ? tableData[tableData.length - 1].anno : 2025;

  const handlePrint = () => {
    // 1. Salviamo il titolo originale della scheda del browser
    const originalTitle = document.title;

    // 2. Cambiamo il titolo dinamicamente con il nome del lavoratore
    document.title = `Riepilogo_somme_richieste_${worker.cognome}_${worker.nome}`;

    // 3. Lanciamo il comando di stampa nativo del browser
    window.print();

    // 4. Ripristiniamo il titolo originale dopo un istante (il tempo che il browser legga il nuovo nome)
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  const handlePrintDiffida = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const today = formatLongDate(new Date());

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
    doc.text(`Lavoratore: ${worker.cognome} ${worker.nome} - Profilo: ${worker.ruolo}`, 20, 95);

    doc.setFont("times", "normal");

    let testoCodici = "";
    if (worker.profilo === 'RFI' || !worker.profilo) {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle voci variabili ricorrenti, tra cui a titolo esemplificativo: Straordinario Diurno (0152), Notturno (0421), Chiamata (0470, 0496), Reperibilità (0482), Ind. Linea (0687), Trasferta (0AA1) e altre indennità accessorie contrattualmente previste.";
    } else if (worker.profilo === 'REKEEP') {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle indennità specifiche di appalto (Turni non cadenzati, Ind. Sussidiaria, Maggiorazioni) previste dal CCNL Multiservizi/Ferroviario.";
    } else if (worker.profilo === 'ELIOR') {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle indennità specifiche della Ristorazione a Bordo (Diaria Scorta, Ind. Cassa, Lavoro Domenicale/Notturno) previste dal CCNL di riferimento.";
    } else {
      // TESTO JOLLY PER LE AZIENDE CUSTOM (Es. ATM Milano)
      testoCodici = `L'analisi ha evidenziato la mancata inclusione delle voci variabili ricorrenti e continuative previste dal modello aziendale applicato (${worker.profilo}), con l'esclusione delle sole voci una tantum e dei rimborsi spese.`;
    }

    const bodyText = `
Scrivo in nome e per conto del Sig. ${worker.nome} ${worker.cognome}, vostro dipendente, il quale mi ha conferito espresso mandato per la tutela dei suoi diritti patrimoniali.

Dall'esame della documentazione retributiva relativa al periodo ${startYear} - ${endYear}, è emerso che la Vostra Società non ha correttamente incluso le voci retributive accessorie e variabili nella base di calcolo della retribuzione feriale, in violazione dell'Art. 36 della Costituzione, della Direttiva 2003/88/CE e dei principi di diritto consolidati dalla Corte di Cassazione (Sent. n. 20216 del 23/06/2022).

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

  const handleDownloadPDFLocal = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    handleDownloadPDF(doc, worker, startYear, endYear, tableData, totals, includeTickets, showPercepito);
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#020617] flex flex-col items-center font-sans text-gray-900 dark:text-slate-100 pb-20 print:bg-white print:pb-0 print:block transition-colors duration-500">

      <style>{`
        @media print {
          /* 1. Margini ridotti al minimo per sfruttare tutto il foglio */
          @page { size: A4 landscape; margin: 5mm; }
          /* ✨ BISTURI: Nascondiamo l'Isola Dinamica forzatamente */
          .group\\/island { display: none !important; }
          body, html { 
            background-color: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            margin: 0; padding: 0;
            width: 100%;
            height: 100%;
          }
          
          .print\\:hidden { display: none !important; }
          
          /* 2. CENTRATURA E SCALA ANTI-TAGLIO */
          #report-content {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
            zoom: 0.82; /* Scala perfetta per non sbordare in basso */
            page-break-inside: avoid; /* Ordina al browser di NON spezzare la pagina */
          }

          .print-container {
            width: 98% !important; /* Allargato al massimo */
            max-width: 100% !important;
            margin: 0 auto !important; 
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid;
          }

          /* 3. TABELLA ADATTIVA */
          table { 
            width: 100% !important; 
            table-layout: auto !important; 
            margin: 0 auto !important;
          }
          
          th { 
            font-size: 13px !important; 
            padding: 6px 4px !important; /* Padding verticale ridotto per recuperare altezza */
            line-height: 1.1 !important;
          }
          
          td { 
            font-size: 14px !important; 
            padding: 5px 4px !important; /* Padding verticale ridotto */
          }

          /* Testi Intestazione proporzionati */
          .text-2xl { font-size: 18px !important; }
          .text-xl { font-size: 16px !important; }
          .text-lg { font-size: 14px !important; }
          .text-base { font-size: 13px !important; }

          /* Colori inalterati */
          tr.bg-blue-header { background-color: #7EB6D3 !important; color: black !important; }
          td.bg-green-total { background-color: #92D050 !important; }
          td.bg-red-total { background-color: #FF5050 !important; color: white !important; }
          td.bg-yellow-cell { background-color: #fef08a !important; }
        }
      `}</style>

      {/* HEADER NAV */}
      {/* ✨ BISTURI 2: Spazio ottimizzato e bilanciato */}
      <div className="print:hidden w-full pt-16 pb-4 px-6 bg-slate-900 dark:bg-[#0f172a] text-white flex justify-between items-center shadow-2xl sticky top-0 z-50 border-b border-slate-700 dark:border-cyan-900/50 transition-colors">
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
                <p className="text-sm uppercase font-medium text-slate-400 dark:text-slate-200 tracking-wider">Report Annuale</p>
                <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${includeExFest ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-slate-400 dark:text-slate-200 border-slate-500'}`}>
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
                ? 'bg-amber-600 dark:bg-amber-500/20 text-white dark:text-amber-400 border border-amber-400 dark:border-amber-500/50 dark:shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-slate-700 dark:bg-slate-800 text-slate-300 dark:text-slate-400 border border-slate-600 dark:border-slate-700 hover:text-white'
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
                ? 'bg-indigo-600 dark:bg-indigo-500/20 text-white dark:text-indigo-300 border border-indigo-400 dark:border-indigo-500/50 dark:shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                : 'bg-slate-700 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-600 dark:border-slate-700 hover:text-white line-through opacity-70'
                }`}
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Ticket</span>
            </button>

            {/* Tasto Colonna Percepito */}
            <button
              onClick={() => setShowPercepito(!showPercepito)}
              className={`group relative px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all duration-300 flex items-center gap-2 ${showPercepito
                ? 'bg-orange-600 dark:bg-orange-500/20 text-white dark:text-orange-400 border border-orange-400 dark:border-orange-500/50 dark:shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                : 'bg-slate-700 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-600 dark:border-slate-700 hover:text-white opacity-70'
                }`}
              title="Mostra/Nascondi colonna Indennità Già Percepita"
            >
              {showPercepito ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
              <span className="whitespace-nowrap">Già Perc.</span>
            </button>

            {/* Tasto Info */}
            <button
              onClick={() => setShowInfoTetto(!showInfoTetto)}
              className={`p-2 rounded-xl transition-all ${showInfoTetto ? 'bg-blue-600 dark:bg-cyan-600 text-white dark:shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'hover:bg-slate-700 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* TOOLTIP/MODALE INFO */}
            <AnimatePresence mode="wait">
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
            <LayoutGrid className="w-5 h-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={2.5} />
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

      {/* TABELLA HTML - WRAPPER PULITO PER LA STAMPA */}
      <div id="report-content" className="w-full flex justify-center print:block">
        <div className="print-container mt-12 print:mt-0 w-full max-w-[1400px]">
          {/* Rimossa la larghezza forzata e i bordi ingombranti in stampa */}
          {tableData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center mt-8 border-dashed border-2 border-slate-300 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl h-full min-h-[400px] shadow-lg transition-all">
              <div className="w-24 h-24 mb-6 rounded-full bg-indigo-50 dark:bg-slate-800/80 flex items-center justify-center shadow-inner ring-4 ring-white dark:ring-slate-800">
                <FileSearch className="w-12 h-12 text-indigo-500 dark:text-cyan-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 tracking-tight">Nessuna Griglia Elaborata</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed text-base font-medium">
                La tabella classica è vuota. Non ci sono mesi registrati. Inserisci i dati nel tab "Gestione Dati" per generare il prospetto generale.
              </p>
              <button onClick={onBack} className="px-8 py-3.5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 ring-4 ring-indigo-500/20">
                Torna alla Dashboard
              </button>
            </div>
          ) : (
            <div className="bg-white text-black dark:text-black border-2 border-black dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl">

              <div className="bg-gray-200 border-b border-black text-center py-6">
                <div className="font-black text-2xl uppercase mb-2">
                  Incidenza degli elementi accessori ai fini del calcolo annuale della retribuzione feriale lavoratore:
                </div>
                <div className="text-lg font-normal normal-case print:text-base">
                  <span className="font-bold mr-2">{worker.cognome} {worker.nome}</span> - Profilo: {worker.ruolo}
                </div>
                <div className="text-lg font-normal normal-case">
                  Periodo interessato: dal 01-01-{startYear} al 31-12-{endYear}
                </div>
              </div>

              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="bg-[#7EB6D3] bg-blue-header text-black h-12" style={{ backgroundColor: '#7EB6D3' }}>
                    <th className="border border-black p-2 font-bold text-base align-middle">Anno</th>
                    <th className="border border-black p-2 font-bold text-base align-middle">Totale Voci<br />Retributive<br />Accessorie</th>
                    <th className="border border-black p-2 font-bold text-base align-middle">Divisore Annuo<br /><span className="text-sm font-normal">(media gg lav.)</span></th>
                    <th className="border border-black p-2 font-bold text-base align-middle">Medie competenze<br />sui valori dell'anno<br />godute</th>
                    <th className="border border-black p-2 font-bold text-base align-middle bg-yellow-50">
                      Giornate di Ferie<br />
                    </th>
                    <th className="border border-black p-2 font-bold text-base align-middle">Incidenza<br />(Lordo)</th>

                    {showPercepito && (
                      <th className="border border-black p-2 font-bold text-base align-middle">INDENNITA'<br />PERCEPITA X<br />gg DI FERIE</th>
                    )}

                    <th className="border border-black p-2 font-black text-base align-middle">TOTALE<br />INDENNITA' DA<br />PERCEPIRE</th>

                    {includeTickets && (
                      <th className="border border-black p-2 font-bold text-base align-middle">CREDITO<br />TICKET<br />RESTAURANT</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row) => (
                    <tr key={row.anno} className="h-10 text-base">
                      <td className="border border-black px-2 py-1 text-center bg-gray-100 font-bold">{row.anno}</td>
                      <td className="border border-black px-2 py-1 text-right">{formatCurrency(row.totaleVoci)}</td>
                      <td className="border border-black px-2 py-1 text-center">{formatNumber(row.divisore)}</td>
                      <td className="border border-black px-2 py-1 text-right text-blue-800 font-medium">{formatCurrency(row.incidenzaGiornata)}</td>
                      <td className="border border-black px-2 py-1 text-center font-bold bg-yellow-50">{formatNumber(row.giornateFerie)}</td>
                      <td className="border border-black px-2 py-1 text-right font-medium">{formatCurrency(row.incidenzaTotale)}</td>

                      {showPercepito && (
                        <td className="border border-black px-2 py-1 text-right text-orange-600 font-medium">{formatCurrency(row.indennitaPercepita)}</td>
                      )}

                      <td className="border border-black px-2 py-1 text-right font-black bg-yellow-100 bg-yellow-cell text-lg">{formatCurrency(row.totaleDaPercepire)}</td>

                      {includeTickets && (
                        <td className="border border-black px-2 py-1 text-right text-green-700 font-medium">{formatCurrency(row.indennitaPasto)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="h-14 font-black text-lg">
                    <td colSpan={5} className="border border-black bg-[#92D050] bg-green-total text-left px-6 align-middle uppercase" style={{ backgroundColor: '#92D050' }}>TOTALE DOVUTO</td>
                    <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.incidenzaTotale)}</td>

                    {showPercepito && (
                      <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-orange-800" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPercepita)}</td>
                    )}

                    <td className="border border-black bg-[#FF5050] bg-red-total text-right px-2 align-middle text-white text-xl" style={{ backgroundColor: '#FF5050', color: 'white' }}>{formatCurrency(totals.totaleDaPercepire)}</td>

                    {includeTickets && (
                      <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-green-900" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPasto)}</td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {isRelazioneOpen && (
        <RelazioneModal
          isOpen={isRelazioneOpen}
          onClose={() => setIsRelazioneOpen(false)}
          worker={worker}
          includeExFest={includeExFest}
          includeTickets={includeTickets}
          showPercepito={showPercepito}
          startClaimYear={startClaimYear}
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