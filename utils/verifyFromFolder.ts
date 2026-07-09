// Feature "prova d'accuratezza" — confronto DAL DISCO (zero egress Supabase).
// L'utente sceglie una cartella locale di buste (come il tasto Cartella multi-anno);
// leggiamo i PDF LATO CLIENT con PDF.js (utils/rfiTruthParser), estraiamo la VERITÀ e la
// confrontiamo col dato del motore già salvato (le righe AnnoDati del lavoratore).
// Nessun download dallo storage: i byte arrivano da file.arrayBuffer() del disco.

import { extractRfiTruth, type RfiTruth } from './rfiTruthParser';
import type { AnnoDati } from '../types';

// Codici RFI/Trenitalia che l'app traccia (indennità variabili + fisse Quadro B) → si confrontano.
const VERIFY_CODES = [
  '0152', '0421', '0423', '0457', '0470', '0482', '0496', '0687', '0AA1', '0576',
  '0584', '0919', '0920', '0932', '0933', '0995', '0996',
  '3B01', '3B03', '3B05', '3B10', '3B15', '3B20', '3B30', '3B35', '3B70', '3B71',
];

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const EPS = 0.005;

/** Numero da valore memorizzato (stringa IT "1.234,56" o "390,92", oppure numero). */
function pv(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Rileva anno e mese dal nome file (e dalla cartella-anno immediata), come l'upload cartella. */
function detectYM(file: File): { year: number; monthIndex: number } | null {
  const name = file.name;
  const rel: string = (file as any).webkitRelativePath || (file as any).relativePath || '';
  const parentDir = rel.split('/').slice(-2, -1)[0] || '';
  const monthIndex = MESI.findIndex(m => name.toLowerCase().includes(m));
  const ym = name.match(/(20\d{2})/) || parentDir.match(/(20\d{2})/);
  if (monthIndex < 0 || !ym) return null;
  return { year: parseInt(ym[1], 10), monthIndex };
}

export interface Discrepancy {
  year: number;
  monthIndex: number;
  field: string;            // codice ('0AA1'…) oppure 'daysWorked' / 'daysVacation'
  engine: number | null;    // valore del motore (null = assente nel dato)
  truth: number;            // valore vero dal PDF
}

export interface VerifyReport {
  discrepancies: Discrepancy[];
  busteVerificate: number;
  busteNonTestuali: number;  // scansioni (nessun testo)
  busteSenzaData: number;    // anno/mese non rilevabili dal nome
  mesiAssenti: { year: number; monthIndex: number }[]; // busta sul disco ma mese non nel dato
  // Più buste TESTUALI cadono sullo stesso mese ma NON concordano (doppioni, conguagli, file
  // misfilati): la verità è ambigua → il mese NON viene corretto in automatico, solo segnalato.
  // Senza questa guardia si generano due discrepanze in conflitto sulla stessa cella e le
  // correzioni oscillano ad ogni ri-controllo (bug flip-flop "al contrario").
  mesiInConflitto: { year: number; monthIndex: number; count: number }[];
}

/** Firma dei valori tracciati di una busta: due buste con la stessa firma sono, per noi, identiche. */
function truthSignature(t: RfiTruth): string {
  const codeSig = VERIFY_CODES.map(c => `${c}:${Math.round((t.codes[c] ?? 0) * 100)}`).join('|');
  const daySig = t.hasDays ? `D:${t.daysWorked},${t.daysVacation},${t.daysPaidLeave}` : 'D:-';
  return `${codeSig}#${daySig}`;
}

/** Buste dello stesso mese: se concordano tutte → una vale l'altra (ritorna la prima); se NO → null (conflitto). */
function pickConsistentTruth(truths: RfiTruth[]): RfiTruth | null {
  if (truths.length === 1) return truths[0];
  const sig0 = truthSignature(truths[0]);
  for (let i = 1; i < truths.length; i++) {
    if (truthSignature(truths[i]) !== sig0) return null;
  }
  return truths[0];
}

/**
 * Confronta i PDF della cartella con le righe del lavoratore.
 * @param files    i File dal folder-picker (webkitdirectory) o dal drop.
 * @param anni     le righe AnnoDati attuali del lavoratore (il dato del motore).
 * @param onProgress callback (done, total) per la barra di avanzamento.
 */
export async function verifyFromFolder(
  files: File[],
  anni: AnnoDati[],
  onProgress?: (done: number, total: number) => void,
): Promise<VerifyReport> {
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  const byYM = new Map<string, AnnoDati>();
  for (const r of anni) byYM.set(`${Number(r.year)}-${Number(r.monthIndex)}`, r);

  const rep: VerifyReport = {
    discrepancies: [], busteVerificate: 0, busteNonTestuali: 0, busteSenzaData: 0, mesiAssenti: [], mesiInConflitto: [],
  };

  // FASE 1 — leggi TUTTE le buste testuali e raggruppale per (anno, mese). Non confrontiamo
  // ancora: prima dobbiamo sapere se un mese ha più di una busta (verità potenzialmente ambigua).
  const groups = new Map<string, { year: number; monthIndex: number; truths: RfiTruth[] }>();
  let done = 0;
  for (const f of pdfs) {
    try {
      const ym = detectYM(f);
      if (!ym) { rep.busteSenzaData++; continue; }

      const buf = new Uint8Array(await f.arrayBuffer());
      const truth = await extractRfiTruth(buf);
      if (!truth.isText) { rep.busteNonTestuali++; continue; }
      rep.busteVerificate++;

      const key = `${ym.year}-${ym.monthIndex}`;
      let g = groups.get(key);
      if (!g) { g = { year: ym.year, monthIndex: ym.monthIndex, truths: [] }; groups.set(key, g); }
      g.truths.push(truth);
    } catch {
      rep.busteNonTestuali++; // PDF illeggibile/cifrato → trattato come non verificabile
    } finally {
      done++; onProgress?.(done, pdfs.length);
    }
  }

  // FASE 2 — confronto per mese. Un mese con più buste che NON concordano è in CONFLITTO:
  // niente correzione automatica (eviterebbe il flip-flop), solo segnalazione.
  for (const g of groups.values()) {
    const truth = pickConsistentTruth(g.truths);
    if (!truth) { rep.mesiInConflitto.push({ year: g.year, monthIndex: g.monthIndex, count: g.truths.length }); continue; }

    const row = byYM.get(`${g.year}-${g.monthIndex}`);
    if (!row) { rep.mesiAssenti.push({ year: g.year, monthIndex: g.monthIndex }); }

    // Codici: confronta solo quelli tracciati dall'app
    for (const code of VERIFY_CODES) {
      const t = truth.codes[code] ?? 0;
      const has = !!row && row[code as keyof AnnoDati] !== undefined
        && row[code as keyof AnnoDati] !== null && row[code as keyof AnnoDati] !== '';
      const e = has ? pv(row![code as keyof AnnoDati]) : null;
      if (e === null && Math.abs(t) < EPS) continue;             // entrambi ~0 → ok
      if (e === null || Math.abs(e - t) >= EPS) {
        rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field: code, engine: e, truth: Math.round(t * 100) / 100 });
      }
    }

    // Giorni (solo se la banda è stata letta con certezza)
    if (truth.hasDays && row) {
      const eW = pv(row.daysWorked);
      if (Math.abs(eW - truth.daysWorked) >= EPS)
        rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field: 'daysWorked', engine: eW, truth: truth.daysWorked });
      const eV = pv(row.daysVacation);
      if (Math.abs(eV - truth.daysVacation) >= EPS)
        rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field: 'daysVacation', engine: eV, truth: truth.daysVacation });
      // Assenze retribuite: rilevante per i distaccati sindacali (Cataneo), dove con il
      // toggle "Permessi" (Strategia B) entra nel divisore. Confronta il dato grezzo.
      const eP = pv(row.daysPaidLeave);
      if (Math.abs(eP - truth.daysPaidLeave) >= EPS)
        rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field: 'daysPaidLeave', engine: eP, truth: truth.daysPaidLeave });
    }
  }

  rep.discrepancies.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex || a.field.localeCompare(b.field));
  rep.mesiInConflitto.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);
  return rep;
}
