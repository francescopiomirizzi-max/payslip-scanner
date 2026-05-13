import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES } from '../types';
import { parseLocalFloat } from './formatters';
import { computeHolidayIndemnity, EXCLUDED_INDEMNITY_COLS } from './calculationEngine';

interface PrintTablesParams {
  worker: Worker;
  monthlyInputs: AnnoDati[];
  includeExFest: boolean;
  includeTickets: boolean;
  startClaimYear: number;
}

export function printPayslipTables({
  worker,
  monthlyInputs,
  includeExFest,
  includeTickets,
  startClaimYear,
}: PrintTablesParams): void {
  // 0. RECUPERO PREFERENZE: Legge se l'utente ha nascosto la colonna nel Report
  const savedPercepito = localStorage.getItem(`report_percepito_${worker.id}`);
  const showPercepito = savedPercepito !== null ? JSON.parse(savedPercepito) : true;

  // 1. SETUP E CONFIGURAZIONE (Orientamento Landscape per farci stare tutto)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalPagesExp = '{total_pages_count_string}'; // Variabile necessaria

  const indennitaCols = getColumnsByProfile(worker.profilo, worker.eliorType).filter(
    c => !EXCLUDED_INDEMNITY_COLS.includes(c.id)
  );

  const fmt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  const fmtInt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { maximumFractionDigits: 0 }) : '-';

  // --- A. PREPARAZIONE ANNI ---
  const yearsToPrint = Array.from(
    new Set(
      monthlyInputs
        .filter(d => {
          const days = parseLocalFloat(String(d.daysWorked));
          if (days > 0) return true;
          return indennitaCols.some(col => parseLocalFloat(d[col.id]) > 0);
        })
        .map(d => Number(d.year))
        .filter(y => !isNaN(y))
    )
  ).sort((a, b) => a - b);

  const TETTO = includeExFest ? 32 : 28;

  // --- B. CALCOLO MOTORE UNIFICATO ---
  const yearResults = computeHolidayIndemnity({
    data: monthlyInputs,
    profilo: worker.profilo,
    eliorType: worker.eliorType,
    includeExFest,
    includeTickets,
    startClaimYear,
    years: yearsToPrint,
  });

  // avgApplied per year (previous-year average or fallback), used in monthly detail table
  const avgAppliedByYear: Record<number, number> = Object.fromEntries(
    yearResults.map(r => [r.year, r.avgApplied])
  );

  // Pivot data: per-column per-year breakdown (not in engine output)
  const pivotData: Record<string, Record<number, number>> = {};
  monthlyInputs.forEach(row => {
    const y = Number(row.year);
    if (isNaN(y)) return;
    indennitaCols.forEach(col => {
      const pivotKey = `[${col.id}] ${col.label}`;
      if (!pivotData[pivotKey]) pivotData[pivotKey] = {};
      if (!pivotData[pivotKey][y]) pivotData[pivotKey][y] = 0;
      pivotData[pivotKey][y] += parseLocalFloat(row[col.id]);
    });
  });

  // Totali generali per riga TOTALE
  let grandTotalIndemnity = 0;
  let grandTotalLordo = 0;
  let grandTotalTicket = 0;
  let grandTotalNet = 0;
  let grandTotalFerieEffettive = 0;
  let grandTotalFeriePagate = 0;
  let grandTotalPercepito = 0;

  const yearlyRows: any[] = yearResults.map(r => {
    const yNetto = (r.sumIndennitaSpettante - (showPercepito ? r.sumIndennitaPercepita : 0)) + r.sumBuoniPasto;

    if (!r.isReferenceYear) {
      grandTotalIndemnity += r.sumIndennitaTotali;
      grandTotalLordo += r.sumIndennitaSpettante;
      grandTotalTicket += r.sumBuoniPasto;
      grandTotalNet += yNetto;
      grandTotalFerieEffettive += r.sumGiorniFerieReali;
      grandTotalFeriePagate += r.sumGiorniFerieUtili;
      grandTotalPercepito += r.sumIndennitaPercepita;
    }

    return [
      r.isReferenceYear ? `${r.year} (Rif.)` : r.year,
      fmt(r.sumIndennitaTotali),
      fmtInt(r.sumGiorniLav),
      fmt(r.avgApplied),
      `${fmtInt(r.sumGiorniFerieUtili)} / ${fmtInt(r.sumGiorniFerieReali)}`,
      r.isReferenceYear ? '(Media)' : fmt(r.sumIndennitaSpettante),
      r.isReferenceYear ? '-' : fmt(r.sumBuoniPasto),
      r.isReferenceYear ? '-' : fmt(yNetto),
    ];
  });

  yearlyRows.push([
    'TOTALE',
    fmt(grandTotalIndemnity),
    '-',
    '-',
    `${fmtInt(grandTotalFeriePagate)} / ${fmtInt(grandTotalFerieEffettive)}`,
    fmt(grandTotalLordo),
    fmt(grandTotalTicket),
    fmt(grandTotalNet),
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
    doc.text(`Pratica: ${worker.cognome} ${worker.nome} - Profilo: ${worker.ruolo}`, pageWidth - 14, 12, { align: 'right' });

    doc.setFontSize(7); doc.setTextColor(100);

    let nomeCCNL = 'CCNL di Categoria';
    if (worker.profilo === 'RFI') nomeCCNL = 'CCNL Mobilità';
    if (worker.profilo === 'REKEEP') nomeCCNL = 'CCNL Multiservizi';
    if (worker.profilo === 'ELIOR') nomeCCNL = 'CCNL Ristorazione';

    const note = `Calcolo elaborato ai sensi Cass. n. 20216/2022 e Art. 64 ${nomeCCNL}. La media giornaliera è calcolata sul totale delle voci variabili diviso i giorni di effettiva presenza. Limite giorni indennizzabili: ${TETTO}.`;
    doc.text(note, 14, pageHeight - 10);
    const str = "Pagina " + doc.getNumberOfPages();
    doc.text(str, pageWidth - 14, pageHeight - 10, { align: 'right' });
  };

  let currentY = 30;

  // --- TABELLA 1 ---
  doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
  doc.text("1. CALCOLO DIFFERENZE PER ANNO", 14, currentY);

  const table1Head = ['ANNO', 'TOT. VARIABILI', 'GG LAV.', 'MEDIA UTILIZZATA', 'GG FERIE / TOT'];
  if (includeTickets) {
    table1Head.push('DIFF. LORDA', 'TICKET', 'NETTO DOVUTO');
  } else {
    table1Head.push('DOVUTO');
  }

  const table1Body = yearlyRows.map((row) => {
    const isReferenceYear = typeof row[0] === 'string' && row[0].includes('(Rif.)');

    if (isReferenceYear) {
      return includeTickets
        ? [row[0], row[1], row[2], '-', '-', '-', '-', '-']
        : [row[0], row[1], row[2], '-', '-', '-'];
    }

    if (includeTickets) {
      return row;
    } else {
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
      [table1Head.length - 1]: { fontStyle: 'bold', halign: 'right', fillColor: [220, 252, 231], textColor: [21, 128, 61] }
    },
    bodyStyles: { halign: 'right' },
    didDrawPage: drawHeaderFooter,
    margin: { top: 25, bottom: 15, left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3;

  doc.setFontSize(8); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
  doc.text(`* La dicitura "GG FERIE / TOT" indica i giorni effettivamente conteggiati ai fini del calcolo rispetto a quelli goduti. In caso di superamento del limite legale (${TETTO}gg annui), l'eccedenza è stata esclusa dal conteggio economico.`, 14, currentY);
  currentY += 12;

  // --- TABELLA 2 (PIVOT) ---
  if (currentY > 150) { doc.addPage(); currentY = 30; }

  doc.setFontSize(12); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
  doc.text("2. RIEPILOGO VOCI VARIABILI DELLA RETRIBUZIONE", 14, currentY);

  const pivotHead = ['CODICE E VOCE', ...yearsToPrint.map(String), 'TOTALE'];

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
      yearlyTotals[index] += val;

      row.push(fmt(val));
    });

    grandPivotTotal += rowTotal;
    row.push(fmt(rowTotal));

    return row;
  });

  const totalsRow = ['TOTALE COMPLESSIVO'];
  yearlyTotals.forEach(val => totalsRow.push(fmt(val)));
  totalsRow.push(fmt(grandPivotTotal));
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
      if (data.column.index > 0) {
        data.cell.styles.cellWidth = 'auto';
      }
      if (data.section === 'body' && data.column.index === pivotHead.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [245, 245, 245];
      }
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
  doc.addPage('a4', 'landscape');
  currentY = 30;
  drawHeaderFooter(null);

  doc.setFontSize(12); doc.setTextColor(23, 37, 84);
  doc.text("3. DETTAGLIO MENSILE ANALITICO", 14, currentY);

  yearsToPrint.forEach(yearVal => {
    const year = Number(yearVal);
    if (currentY > 160) { doc.addPage(); currentY = 30; }

    let monthlyFerieCounter = 0;

    const media = avgAppliedByYear[year] || 0;

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

    const totalsRow = ['TOT.'];
    indennitaCols.forEach(() => totalsRow.push(''));
    totalsRow.push(sumGgLav > 0 ? String(sumGgLav) : '');
    totalsRow.push(fmtInt(sumGgFerie));
    totalsRow.push(fmt(sumLordo));

    if (showPercepito) totalsRow.push(fmt(sumPercepito));
    if (includeTickets) totalsRow.push(fmt(sumTicket));
    if (showPercepito || includeTickets) totalsRow.push(fmt(sumNetto));

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
        if (data.section === 'body' && data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.textColor = [23, 37, 84];
        }
      },
      didDrawPage: drawHeaderFooter,
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  });

  // --- PAGINA 4: RIEPILOGO FINALE ---
  doc.addPage('a4', 'landscape');
  drawHeaderFooter(null);
  currentY = 40;

  doc.setFontSize(16); doc.setTextColor(23, 37, 84); doc.setFont('helvetica', 'bold');
  doc.text("RIEPILOGO FINALE", 105, currentY, { align: 'center' });
  currentY += 15;

  doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal');
  const spiegazione = `Sulla base dei dati analizzati nelle tabelle precedenti, il sistema ha calcolato le differenze retributive spettanti al lavoratore.`;
  const splitSpiegazione = doc.splitTextToSize(spiegazione, 160);
  doc.text(splitSpiegazione, 25, currentY);
  currentY += (splitSpiegazione.length * 6) + 10;

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

  const veroNettoDaStampare = (grandTotalLordo - (showPercepito ? grandTotalPercepito : 0)) + (includeTickets ? grandTotalTicket : 0);

  if (!showPercepito && !includeTickets) {
    currentY += 10;
    printRow("TOTALE LORDO SPETTANTE", fmt(grandTotalLordo), true);
  } else {
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

  currentY += 25;
  doc.setFontSize(9); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
  const notaFinale = "Il presente conteggio ha valore di perizia tecnica di parte. I calcoli sono stati eseguiti algoritmicamente garantendo la massima precisione matematica basata sui dati forniti.";
  doc.text(notaFinale, 105, currentY, { align: 'center', maxWidth: 150 });

  if (typeof doc.putTotalPages === 'function') { doc.putTotalPages(totalPagesExp); }
  doc.save(`Conteggi_${worker.cognome}_${worker.nome}.pdf`);
}
