import {
  Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Worker } from '../types';
import {
  isConcluded, isMissingPayslips,
  formatInsertedRange, formatMissingMonths, isPaid,
} from './workerStatus';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS } from '../config/profiles';

const sortByCognome = (a: Worker, b: Worker) =>
  (a.cognome || '').localeCompare(b.cognome || '', 'it') || (a.nome || '').localeCompare(b.nome || '', 'it');

const fullName = (w: Worker): string =>
  [w.cognome, w.nome].filter(Boolean).join(' ').trim() || '—';

const sectionHeading = (text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2): Paragraph =>
  new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true })],
  });

const headerCell = (text: string): TableCell =>
  new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEF7' },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
  });

const dataCell = (text: string): TableCell =>
  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text || '—' })] })] });

const buildAreaTable = (workers: Worker[]): Table => {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Nominativo'), headerCell('Periodo Inserito'), headerCell('Stato'), headerCell('Note / Mancanti')],
    }),
    ...workers.map(w => {
      const missing = formatMissingMonths(w);
      const stato = isConcluded(w) ? 'CONCLUSA' : 'BUSTE PAGA MANCANTI';
      const note = isConcluded(w)
        ? (missing || 'Pratica conclusa — in attesa di pagamento')
        : (missing || 'Nessuna anomalia rilevata');
      return new TableRow({
        children: [
          dataCell(fullName(w)),
          dataCell(formatInsertedRange(w)),
          dataCell(stato),
          dataCell(note),
        ],
      });
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
    },
  });
};

const profileLabel = (profilo: string): string => {
  const sys = SYSTEM_PROFILES[profilo];
  if (sys?.label) return sys.label.toUpperCase();
  return (profilo || 'ALTRO').toUpperCase();
};

/** Ordina i profili: prima quelli di sistema nell'ordine canonico, poi i custom in ordine alfabetico. */
const sortProfiles = (profiles: string[]): string[] => {
  const system = SYSTEM_PROFILE_KEYS.filter(k => profiles.includes(k));
  const custom = profiles.filter(p => !SYSTEM_PROFILE_KEYS.includes(p)).sort();
  return [...system, ...custom];
};

export const generateReport = async (workers: Worker[]): Promise<void> => {
  const eligible = workers.filter(w => !isPaid(w) && (isMissingPayslips(w) || isConcluded(w)));

  // Raggruppo per profilo
  const byProfile = new Map<string, Worker[]>();
  for (const w of eligible) {
    const key = (w.profilo || 'ALTRO').toUpperCase();
    if (!byProfile.has(key)) byProfile.set(key, []);
    byProfile.get(key)!.push(w);
  }

  const orderedProfiles = sortProfiles([...byProfile.keys()]);

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Report Stato Avanzamento Pratiche', bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `Generato il ${today}`, italics: true, color: '666666' })],
    }),
  ];

  if (orderedProfiles.length === 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Nessuna pratica in lavorazione.', italics: true })],
    }));
  } else {
    orderedProfiles.forEach((profilo, idx) => {
      const list = byProfile.get(profilo)!.slice().sort(sortByCognome);
      const concluse = list.filter(isConcluded).length;
      const buste = list.filter(isMissingPayslips).length;
      const summary = `${list.length} pratiche — ${buste} con buste paga mancanti, ${concluse} concluse in attesa di pagamento.`;

      children.push(sectionHeading(`${idx + 1}. AREA ${profileLabel(profilo)}`, HeadingLevel.HEADING_2));
      children.push(new Paragraph({ children: [new TextRun({ text: summary, italics: true })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      children.push(buildAreaTable(list));
    });
  }

  const doc = new Document({
    creator: 'RailFlow',
    title: 'Report Stato Avanzamento Pratiche',
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `Report_Stato_Pratiche_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, fname);
};
