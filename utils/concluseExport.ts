import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Worker, resolveIncludePaidLeave } from '../types';
import { SYSTEM_PROFILES } from '../config/profiles';
import { printPayslipTables } from './printTables';
import { computeRiepilogoData, renderRiepilogoPdf } from './riepilogoReport';
import { buildRelazioneDocxBlob } from '../RelazioneModal';

// Export "Concluse": per ogni lavoratore concluso genera i 3 documenti (Conteggi
// PDF, Riepilogo PDF, Relazione .docx) e li impacchetta in UNO zip con la stessa
// struttura cartelle del Desktop:  {AZIENDA}/{COGNOME NOME}/conteggi/{file}
// Un helper locale (separato) scompatta lo zip nella cartella pratiche.

const DEFAULT_START_CLAIM_YEAR = 2008;

interface ResolvedOptions {
  includeExFest: boolean;
  includeTickets: boolean;
  showPercepito: boolean;
  startClaimYear: number;
  includePaidLeave: boolean;
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Replica ESATTA della risoluzione usata nel singolo export (TableComponent /
// WorkerDetailPage): campo sul record → localStorage → default. Così lo zip
// contiene per ogni concluso ciò che uscirebbe cliccando export sulla sua pagina.
function resolveOptions(worker: Worker): ResolvedOptions {
  const includeExFest = worker.includeExFest ?? readBool(`report_exfest_${worker.id}`, false);
  const includeTickets = worker.includeTickets ?? readBool(`report_tickets_${worker.id}`, false);
  const showPercepito = (worker as any).reportShowPercepito ?? readBool(`report_percepito_${worker.id}`, false);
  const includePaidLeave = resolveIncludePaidLeave(worker);

  let startClaimYear = worker.startClaimYear ?? DEFAULT_START_CLAIM_YEAR;
  if (worker.startClaimYear === undefined) {
    const saved = localStorage.getItem(`startYear_${worker.id}`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) startClaimYear = parsed;
    }
  }

  return { includeExFest, includeTickets, showPercepito, startClaimYear, includePaidLeave };
}

function companyFolder(worker: Worker): string {
  return SYSTEM_PROFILES[worker.profilo]?.label ?? worker.profilo ?? 'SENZA_PROFILO';
}

function workerFolder(worker: Worker): string {
  return `${worker.cognome || ''} ${worker.nome || ''}`.trim().toUpperCase() || 'SENZA_NOME';
}

interface WorkerDocs {
  conteggi: Blob;   // Conteggi PDF
  riepilogo: Blob;  // Riepilogo somme PDF (il "report")
  relazione: Blob;  // Relazione tecnica .docx
}

/**
 * Genera i 3 documenti (Conteggi + Riepilogo + Relazione) di UN lavoratore come blob,
 * usando ESATTAMENTE le opzioni risolte (campo → localStorage → default) che produrrebbe
 * la sua pagina. Unica fonte: la usano sia l'export ZIP di tutti i conclusi sia il tasto
 * "scarica i 3 documenti" del singolo report.
 */
async function buildWorkerDocs(w: Worker, riepilogoOverride?: Blob): Promise<WorkerDocs> {
  const opts = resolveOptions(w);
  const monthly = Array.isArray(w.anni) ? w.anni : [];

  // 1. Conteggi PDF
  const conteggi = printPayslipTables({
    worker: w,
    monthlyInputs: monthly,
    includeExFest: opts.includeExFest,
    includeTickets: opts.includeTickets,
    startClaimYear: opts.startClaimYear,
    includePaidLeave: opts.includePaidLeave,
    output: 'blob',
  }) as Blob;

  // computeRiepilogoData serve comunque per i totali della Relazione.
  const { tableData, totals, startYear, endYear } = computeRiepilogoData(
    w, monthly, opts.startClaimYear, opts.includeExFest, opts.includeTickets,
  );

  // 2. Riepilogo PDF — se il chiamante passa lo "screenshot" del prospetto a schermo
  //    (tasto Documenti nel report) si usa quello; altrimenti, in mancanza del DOM
  //    (export Concluse in blocco), si genera la tabella con jsPDF.
  let riepilogo: Blob;
  if (riepilogoOverride) {
    riepilogo = riepilogoOverride;
  } else {
    const riepilogoDoc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    await renderRiepilogoPdf(riepilogoDoc, w, startYear, endYear, tableData, totals, opts.includeTickets, opts.showPercepito);
    riepilogo = riepilogoDoc.output('blob');
  }

  // 3. Relazione .docx — riusa il generatore della modale
  const relazione = await buildRelazioneDocxBlob({
    worker: w,
    totals,
    includeExFest: opts.includeExFest,
    includeTickets: opts.includeTickets,
    showPercepito: opts.showPercepito,
    startClaimYear: opts.startClaimYear,
  });

  return { conteggi, riepilogo, relazione };
}

/** Aggiunge i 3 documenti allo zip dentro la cartella `base` indicata. */
function addWorkerDocsToZip(zip: JSZip, w: Worker, docs: WorkerDocs, base: string): void {
  zip.file(`${base}/Conteggi_${w.cognome}_${w.nome}.pdf`, docs.conteggi);
  zip.file(`${base}/Riepilogo_somme_richieste_${w.cognome}_${w.nome}.pdf`, docs.riepilogo);
  zip.file(`${base}/Relazione_Tecnica_${w.cognome}.docx`, docs.relazione);
}

/**
 * Scarica i 3 documenti di UN lavoratore in un unico zip. Aprendolo si trova UNA sola
 * cartella "Conteggi {Cognome} {Nome}" con dentro i 3 file (niente struttura aziendale
 * annidata: quella resta solo per l'export Concluse in blocco). Usato dal tasto nel
 * report (`TableComponent`).
 */
export async function exportSingleWorkerZip(worker: Worker, riepilogoOverride?: Blob): Promise<void> {
  const docs = await buildWorkerDocs(worker, riepilogoOverride);
  const zip = new JSZip();
  const folder = `Conteggi ${worker.cognome || ''} ${worker.nome || ''}`.trim();
  addWorkerDocsToZip(zip, worker, docs, folder);
  const out = await zip.generateAsync({ type: 'blob' });
  saveAs(out, `${folder}.zip`);
}

export interface ConcluseExportResult {
  total: number;
  exported: number;
  failed: { worker: string; error: string }[];
}

/**
 * Genera lo zip dei conclusi e lo scarica. `onProgress` riceve (fatti, totale,
 * nome corrente) per aggiornare la UI.
 */
export async function exportConcluseZip(
  workers: Worker[],
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<ConcluseExportResult> {
  const zip = new JSZip();
  const result: ConcluseExportResult = { total: workers.length, exported: 0, failed: [] };

  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const nominativo = `${w.cognome || ''} ${w.nome || ''}`.trim();
    onProgress?.(i, workers.length, nominativo);

    try {
      const docs = await buildWorkerDocs(w);
      addWorkerDocsToZip(zip, w, docs, `${companyFolder(w)}/${workerFolder(w)}/conteggi`);
      result.exported++;
    } catch (err: any) {
      result.failed.push({ worker: nominativo, error: err?.message || String(err) });
    }
  }

  onProgress?.(workers.length, workers.length, '');

  if (result.exported > 0) {
    const out = await zip.generateAsync({ type: 'blob' });
    saveAs(out, `Concluse_${new Date().toISOString().slice(0, 10)}.zip`);
  }

  return result;
}
