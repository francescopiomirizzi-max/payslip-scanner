import {
  Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { saveAs } from 'file-saver';
import type { Worker } from '../types';
import { resolveIncludePaidLeave } from '../types';
import {
  isConcluded, isMissingPayslips,
  formatInsertedRange, formatMissingMonths, isPaid,
} from './workerStatus';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_KEYS } from '../config/profiles';
import { computeHolidayIndemnity } from './calculationEngine';
import { formatCurrency } from './formatters';

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

const buildMissingTable = (workers: Worker[]): Table => {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Nominativo'), headerCell('Buste Paga Mancanti')],
    }),
    ...workers.map(w => {
      const missing = formatMissingMonths(w);
      return new TableRow({
        children: [
          dataCell(fullName(w)),
          dataCell(missing || '—'),
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
  // Solo le pratiche con buste paga mancanti (status 'inviata'): il documento serve al
  // sindacalista per sapere quali buste mancano per completare le pratiche. Nient'altro.
  const eligible = workers.filter(isMissingPayslips);

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
      children: [new TextRun({ text: 'Report Buste Paga Mancanti', bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Buste paga ancora da acquisire per completare le pratiche', italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `Generato il ${today}`, italics: true, color: '666666' })],
    }),
  ];

  if (orderedProfiles.length === 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Nessuna busta paga mancante: tutte le pratiche risultano complete.', italics: true })],
    }));
  } else {
    orderedProfiles.forEach((profilo, idx) => {
      const list = byProfile.get(profilo)!.slice().sort(sortByCognome);
      const summary = `${list.length} lavorator${list.length === 1 ? 'e' : 'i'} con buste paga mancanti.`;

      children.push(sectionHeading(`${idx + 1}. AREA ${profileLabel(profilo)}`, HeadingLevel.HEADING_2));
      children.push(new Paragraph({ children: [new TextRun({ text: summary, italics: true })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      children.push(buildMissingTable(list));
    });
  }

  const doc = new Document({
    creator: 'RailFlow',
    title: 'Report Buste Paga Mancanti',
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `Report_Buste_Mancanti_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, fname);
};

// ── REGISTRO MONITORAGGIO PRATICHE PAGATE (formato Ufficio Legale FAST CONFSAL) ──

/** Credito stimato del lavoratore — stesso numero della Dashboard (somma sumNetto). */
const computeWorkerCredit = (w: Worker): number => {
  const storedTicketPref = localStorage.getItem(`tickets_${w.id}`);
  const includeTickets = storedTicketPref !== null ? JSON.parse(storedTicketPref) : true;
  const storedExFestPref = localStorage.getItem(`exFest_${w.id}`);
  const includeExFest = storedExFestPref !== null ? JSON.parse(storedExFestPref) : false;
  const storedPaidLeavePref = localStorage.getItem(`paidLeave_${w.id}`);
  const includePaidLeave = storedPaidLeavePref !== null ? JSON.parse(storedPaidLeavePref) : resolveIncludePaidLeave(w);
  const storedStartYear = localStorage.getItem(`startYear_${w.id}`);
  const startClaimYear = storedStartYear ? parseInt(storedStartYear) : 2008;

  const safeAnni = (Array.isArray(w.anni) ? w.anni : []) as any[];
  const allYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year))))
    .filter(y => !isNaN(y as number))
    .sort((a, b) => (a as number) - (b as number)) as number[];

  const yearResults = computeHolidayIndemnity({
    data: safeAnni,
    profilo: w.profilo || 'RFI',
    eliorType: w.eliorType,
    includeExFest,
    includeTickets,
    startClaimYear,
    includePaidLeave,
    years: allYears,
  });

  const grandTotalNetto = yearResults
    .filter(r => !r.isReferenceYear)
    .reduce((sum, r) => sum + r.sumNetto, 0);
  return grandTotalNetto > 0 ? grandTotalNetto : 0;
};

const escapeXml = (s: string): string =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Registro interno delle pratiche CONCLUSE E PAGATE (status 'chiusa').
 * Usa il file originale del sindacalista come TEMPLATE (public/registro_template.docx):
 * mantiene loghi, intestazione, stili e formattazione IDENTICI; clona la riga
 * segnaposto (con token {{...}}) una volta per ogni lavoratore pagato.
 */
export const generateRegistroPagate = async (workers: Worker[]): Promise<void> => {
  const pagate = workers.filter(isPaid).slice().sort(sortByCognome);

  // 1) Carico il template .docx e ne estraggo il document.xml
  const res = await fetch(`${import.meta.env.BASE_URL}registro_template.docx`);
  if (!res.ok) { console.error('[Registro] template non trovato:', res.status); return; }
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  let docXml = strFromU8(files['word/document.xml']);

  // 2) Individuo la riga-template (l'unica con i token {{...}}). La lookahead
  //    negativa evita di partire dal primo <w:tr> del documento attraversando
  //    i confini di riga.
  const rowMatch = docXml.match(/<w:tr\b(?:(?!<\/w:tr>)[\s\S])*?\{\{COGNOME\}\}(?:(?!<\/w:tr>)[\s\S])*?<\/w:tr>/);
  if (!rowMatch) { console.error('[Registro] riga segnaposto non trovata nel template'); return; }
  const templateRow = rowMatch[0];

  // 3) Clono la riga per ogni lavoratore, sostituendo i token
  const valuesFor = (w: Worker, i: number): Record<string, string> => ({
    N: String(i + 1),
    COGNOME: w.cognome || '',
    NOME: w.nome || '',
    SOCIETA: profileLabel(w.profilo),
    CONTATTI: '',
    VERTENZA: 'RETRIBUZIONE FERIALE',
    RICORSO: '',
    CALCOLI: formatCurrency(computeWorkerCredit(w)),
    BUSTE: formatInsertedRange(w),
    MATURITA: '',
    REFERENTE: '',
    STATO: 'Pagata',
    NOTE: w.notes || '',
  });

  const rowsXml = pagate.map((w, i) => {
    let row = templateRow;
    for (const [token, value] of Object.entries(valuesFor(w, i))) {
      row = row.split(`{{${token}}}`).join(escapeXml(value));
    }
    return row;
  }).join('');

  // 4) Sostituisco la riga segnaposto con le righe generate (split/join: niente
  //    interpretazione di $ come in String.replace)
  docXml = docXml.split(templateRow).join(rowsXml);

  // 5) Re-zippo mantenendo TUTTO il resto identico (loghi, stili, header/footer)
  files['word/document.xml'] = strToU8(docXml);
  const zipped = zipSync(files);
  const blob = new Blob([zipped as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveAs(blob, `Registro_Pratiche_Pagate_${new Date().toISOString().slice(0, 10)}.docx`);
};
