import autoTable from 'jspdf-autotable';
import { Worker, AnnoDati, resolveIncludePaidLeave } from '../types';
import { computeHolidayIndemnity, computePeriodIncidence } from './calculationEngine';

// Dati del "Riepilogo / Prospetto Ufficiale di Ricalcolo" estratti dal motore
// unico, condivisi tra la pagina report (TableComponent) e l'export batch dei
// Conclusi. Unica fonte di verità: niente duplicazione della derivazione.
export interface RiepilogoRow {
  anno: number;
  totaleVoci: number;
  divisore: number;
  incidenzaGiornata: number;
  giornateFerie: number;
  incidenzaTotale: number;
  indennitaPercepita: number;
  totaleDaPercepire: number;
  indennitaPasto: number;
}

export interface RiepilogoTotals {
  incidenzaTotale: number;
  indennitaPercepita: number;
  totaleDaPercepire: number;
  indennitaPasto: number;
}

// % di incidenza voci variabili/fisse (Quadro A/B/C dell'avvocato). null per i
// profili senza voci fisse definite (Elior/Clean Service/Mercitalia): la sezione
// nel report non viene mostrata.
export interface RiepilogoIncidenza {
  rows: { anno: number; pctVariabile: number; pctFissa: number; isReferenceYear: boolean }[];
  period: { pctVariabile: number; pctFissa: number };
}

export interface RiepilogoData {
  tableData: RiepilogoRow[];
  totals: RiepilogoTotals;
  startYear: number;
  endYear: number;
  incidenza: RiepilogoIncidenza | null;
}

export function computeRiepilogoData(
  worker: Worker,
  monthlyInputs: AnnoDati[] | undefined,
  startClaimYear: number,
  includeExFest: boolean,
  includeTickets: boolean,
): RiepilogoData {
  const safeRows: AnnoDati[] = Array.isArray(monthlyInputs) ? monthlyInputs
    : Array.isArray(worker.anni) ? worker.anni : [];

  const allYears = Array.from(new Set(safeRows.map(d => Number(d.year))))
    .filter(y => !isNaN(y))
    .sort((a, b) => a - b);

  const results = computeHolidayIndemnity({
    data: safeRows,
    profilo: worker.profilo,
    eliorType: worker.eliorType,
    includeExFest,
    includeTickets,
    startClaimYear,
    includePaidLeave: resolveIncludePaidLeave(worker),
    years: allYears,
  });

  const tableData: RiepilogoRow[] = results
    .filter(r => !r.isReferenceYear)
    .map(r => ({
      anno: r.year,
      totaleVoci: r.sumIndennitaTotali,
      divisore: r.sumGiorniLav,
      incidenzaGiornata: r.avgApplied,
      giornateFerie: r.sumGiorniFerieUtili,
      incidenzaTotale: r.sumIndennitaSpettante,
      indennitaPercepita: r.sumIndennitaPercepita,
      totaleDaPercepire: r.sumNetto,
      indennitaPasto: r.sumBuoniPasto,
    }));

  const totals: RiepilogoTotals = tableData.reduce((acc, row) => {
    if (row.anno < startClaimYear) return acc;
    return {
      incidenzaTotale: acc.incidenzaTotale + row.incidenzaTotale,
      indennitaPercepita: acc.indennitaPercepita + row.indennitaPercepita,
      totaleDaPercepire: acc.totaleDaPercepire + row.totaleDaPercepire,
      indennitaPasto: acc.indennitaPasto + row.indennitaPasto,
    };
  }, { incidenzaTotale: 0, indennitaPercepita: 0, totaleDaPercepire: 0, indennitaPasto: 0 });

  const startYear = tableData.length > 0 ? tableData[0].anno : startClaimYear;
  const endYear = tableData.length > 0 ? tableData[tableData.length - 1].anno : 2025;

  // Stessa selezione del tab "Calcolo Annuale" (AnnualCalculationTable): anni con
  // Quadro B compilato; la media di periodo è sui soli anni non di riferimento.
  // Tra gli anni pre-ricorso teniamo SOLO il vero N-1 (l'unica fonte della media):
  // se lo start è stato spostato avanti (es. Borriello 2020→2021), gli anni-mozzicone
  // ancora più indietro (2019, 0 giorni) non vanno mostrati come un secondo "(Rif.)".
  const incidenzaRows = results.filter(r =>
    r.hasIncidence && r.sumQuadroFisse > 0 &&
    (!r.isReferenceYear || r.year === startClaimYear - 1));
  const incidenza: RiepilogoIncidenza | null = incidenzaRows.length === 0 ? null : {
    rows: incidenzaRows.map(r => ({
      anno: r.year,
      pctVariabile: r.pctVariabileMediaAnnua,
      pctFissa: r.pctFissaMediaAnnua,
      isReferenceYear: r.isReferenceYear,
    })),
    period: (() => {
      const p = computePeriodIncidence(results.filter(r => !r.isReferenceYear));
      return { pctVariabile: p.pctVariabile, pctFissa: p.pctFissa };
    })(),
  };

  return { tableData, totals, startYear, endYear, incidenza };
}

// Disegna il PDF "Prospetto Ufficiale di Ricalcolo" su un doc jsPDF (landscape).
// NON salva: il chiamante decide save() o output('blob').
export function renderRiepilogoPdf(
  doc: any,
  worker: Worker,
  startYear: number,
  endYear: number,
  tableData: RiepilogoRow[],
  totals: RiepilogoTotals,
  includeTickets: boolean,
  showPercepito: boolean,
): void {
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
    didParseCell: (data: any) => {
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

  let finalY = doc.lastAutoTable.finalY + 30;
  if (finalY > 170) { doc.addPage(); finalY = 40; }

  doc.setFontSize(10);
  doc.setTextColor(0);

  doc.text("Firma del Dipendente", 60, finalY, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(30, finalY + 10, 90, finalY + 10);

  doc.text("Timbro e Firma Responsabile", 230, finalY, { align: 'center' });
  doc.line(200, finalY + 10, 260, finalY + 10);
}
