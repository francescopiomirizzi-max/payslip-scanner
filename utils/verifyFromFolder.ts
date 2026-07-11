// Feature "prova d'accuratezza" — confronto DAL DISCO (zero egress Supabase).
// L'utente sceglie una cartella locale di buste (come il tasto Cartella multi-anno);
// leggiamo i PDF LATO CLIENT con PDF.js, estraiamo la VERITÀ col parser del profilo
// (RFI/Trenitalia · FSE · Mercitalia) e la confrontiamo col dato del motore già salvato
// (le righe AnnoDati del lavoratore). Nessun download dallo storage: i byte arrivano
// da file.arrayBuffer() del disco.

import { extractRfiTruth } from './rfiTruthParser';
import { extractFseTruth } from './fseTruthParser';
import { extractMercTruth } from './mercitaliaTruthParser';
import {
  INDENNITA_FSE, INDENNITA_FSE_FISSE,
  INDENNITA_MERCITALIA, INDENNITA_MERCITALIA_FISSE,
} from '../types';
import type { AnnoDati } from '../types';

/** Forma comune della verità estratta da una busta (RfiTruth/FseTruth/MercTruth sono compatibili). */
export interface PayslipTruth {
  isText: boolean;
  codes: Record<string, number>;
  hasDays: boolean;
  daysWorked: number;
  daysVacation: number;
  daysPaidLeave: number;
  /** true = giorni ambigui (es. FSE presenze>31: quantità con arretrati multi-mese) → daysWorked non confrontato. */
  daysUncertain?: boolean;
  /** false = la Σ dei valori letti NON quadra col totale stampato sul cedolino → busta scartata. */
  reconOk?: boolean;
  /** true = cedolino di 13ª/14ª → fuori conteggio, busta saltata. */
  is13a14a?: boolean;
  /** periodo letto DENTRO il PDF (se il parser lo estrae): check contro il nome file. */
  period?: { month: number; year: number } | null;
}

export type VerifyProfile = 'RFI' | 'TRENITALIA' | 'FSE' | 'MERCITALIA';
export const VERIFY_PROFILES: readonly string[] = ['RFI', 'TRENITALIA', 'FSE', 'MERCITALIA'];

// Codici RFI/Trenitalia che l'app traccia (indennità variabili + fisse Quadro B) → si confrontano.
const RFI_CODES = [
  '0152', '0421', '0423', '0457', '0470', '0482', '0496', '0687', '0AA1', '0576',
  '0584', '0919', '0920', '0932', '0933', '0995', '0996',
  '3B01', '3B03', '3B05', '3B10', '3B15', '3B20', '3B30', '3B35', '3B70', '3B71',
];

type DayField = 'daysWorked' | 'daysVacation' | 'daysPaidLeave';

interface ProfileCfg {
  extract: (data: Uint8Array) => Promise<PayslipTruth>;
  codes: string[];
  dayFields: DayField[];
}

// I set di codici FSE/Mercitalia derivano dalle colonne dell'app (types.ts): restano in sync
// da soli. daysPaidLeave è tracciato solo dal parser RFI/Trenitalia.
const PROFILES: Record<VerifyProfile, ProfileCfg> = {
  RFI: { extract: extractRfiTruth, codes: RFI_CODES, dayFields: ['daysWorked', 'daysVacation', 'daysPaidLeave'] },
  TRENITALIA: { extract: extractRfiTruth, codes: RFI_CODES, dayFields: ['daysWorked', 'daysVacation', 'daysPaidLeave'] },
  FSE: {
    extract: extractFseTruth,
    codes: [...INDENNITA_FSE, ...INDENNITA_FSE_FISSE].map(c => c.id),
    dayFields: ['daysWorked', 'daysVacation'],
  },
  MERCITALIA: {
    extract: extractMercTruth,
    codes: [...INDENNITA_MERCITALIA, ...INDENNITA_MERCITALIA_FISSE].map(c => c.id),
    dayFields: ['daysWorked', 'daysVacation'],
  },
};

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

/** Rileva anno e mese dal nome file (e dalla cartella-anno immediata), come l'upload cartella.
 *  Nome col mese per esteso ("Agosto 2021.PDF") oppure numerico ("Cedolini-2019-10-….pdf"). */
function detectYM(file: File): { year: number; monthIndex: number } | null {
  const name = file.name;
  const rel: string = (file as any).webkitRelativePath || (file as any).relativePath || '';
  const parentDir = rel.split('/').slice(-2, -1)[0] || '';
  const monthIndex = MESI.findIndex(m => name.toLowerCase().includes(m));
  if (monthIndex >= 0) {
    const ym = name.match(/(20\d{2})/) || parentDir.match(/(20\d{2})/);
    if (ym) return { year: parseInt(ym[1], 10), monthIndex };
    return null;
  }
  const num = name.match(/(20\d{2})[-_. ](\d{1,2})(?!\d)/);
  if (num) {
    const m = parseInt(num[2], 10);
    if (m >= 1 && m <= 12) return { year: parseInt(num[1], 10), monthIndex: m - 1 };
  }
  return null;
}

export interface Discrepancy {
  year: number;
  monthIndex: number;
  field: string;            // codice ('0AA1', 'I86178', 'fse_minimo'…) oppure 'daysWorked' / 'daysVacation'
  engine: number | null;    // valore del motore (null = assente nel dato)
  truth: number;            // valore vero dal PDF
}

export interface VerifyReport {
  discrepancies: Discrepancy[];
  busteVerificate: number;
  busteNonTestuali: number;  // scansioni (nessun testo)
  busteSenzaData: number;    // anno/mese non rilevabili dal nome
  // La Σ dei valori letti non quadra col totale stampato sul cedolino (layout cambiato o lettura
  // incerta): la busta NON è affidabile come verità → saltata e segnalata.
  busteNonQuadrate: number;
  // Cedolini di 13ª/14ª mensilità: fuori conteggio per regola pratica → saltati.
  buste13a14a: number;
  // Il periodo stampato DENTRO il PDF non coincide col nome file (busta misfiled): confrontarla
  // sul mese del nome corromperebbe il mese sbagliato → saltata e segnalata.
  busteMisfiled: { name: string; year: number; monthIndex: number }[];
  mesiAssenti: { year: number; monthIndex: number }[]; // busta sul disco ma mese non nel dato
  // Più buste TESTUALI cadono sullo stesso mese ma NON concordano (doppioni, conguagli, file
  // misfilati): la verità è ambigua → il mese NON viene corretto in automatico, solo segnalato.
  // Senza questa guardia si generano due discrepanze in conflitto sulla stessa cella e le
  // correzioni oscillano ad ogni ri-controllo (bug flip-flop "al contrario").
  mesiInConflitto: { year: number; monthIndex: number; count: number }[];
  // Giorni ambigui sul PDF (es. FSE: quantità presenze con arretrati multi-mese, Gen 2018 = 16+22):
  // daysWorked NON viene confrontato per questi mesi — la decisione resta umana.
  mesiGiorniIncerti: { year: number; monthIndex: number; presenze: number }[];
}

/** Firma dei valori tracciati di una busta: due buste con la stessa firma sono, per noi, identiche. */
function truthSignature(t: PayslipTruth, cfg: ProfileCfg): string {
  const codeSig = cfg.codes.map(c => `${c}:${Math.round((t.codes[c] ?? 0) * 100)}`).join('|');
  const daySig = t.hasDays ? `D:${cfg.dayFields.map(f => t[f]).join(',')}` : 'D:-';
  return `${codeSig}#${daySig}`;
}

/** Buste dello stesso mese: se concordano tutte → una vale l'altra (ritorna la prima); se NO → null (conflitto). */
function pickConsistentTruth(truths: PayslipTruth[], cfg: ProfileCfg): PayslipTruth | null {
  if (truths.length === 1) return truths[0];
  const sig0 = truthSignature(truths[0], cfg);
  for (let i = 1; i < truths.length; i++) {
    if (truthSignature(truths[i], cfg) !== sig0) return null;
  }
  return truths[0];
}

/**
 * Confronta i PDF della cartella con le righe del lavoratore.
 * @param files    i File dal folder-picker (webkitdirectory) o dal drop.
 * @param anni     le righe AnnoDati attuali del lavoratore (il dato del motore).
 * @param profilo  profilo azienda: sceglie parser e set di codici da confrontare.
 * @param onProgress callback (done, total) per la barra di avanzamento.
 */
export async function verifyFromFolder(
  files: File[],
  anni: AnnoDati[],
  profilo: VerifyProfile,
  onProgress?: (done: number, total: number) => void,
): Promise<VerifyReport> {
  const cfg = PROFILES[profilo] ?? PROFILES.RFI;
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  const byYM = new Map<string, AnnoDati>();
  for (const r of anni) byYM.set(`${Number(r.year)}-${Number(r.monthIndex)}`, r);

  const rep: VerifyReport = {
    discrepancies: [], busteVerificate: 0, busteNonTestuali: 0, busteSenzaData: 0,
    busteNonQuadrate: 0, buste13a14a: 0, busteMisfiled: [],
    mesiAssenti: [], mesiInConflitto: [], mesiGiorniIncerti: [],
  };

  // FASE 1 — leggi TUTTE le buste testuali e raggruppale per (anno, mese). Non confrontiamo
  // ancora: prima dobbiamo sapere se un mese ha più di una busta (verità potenzialmente ambigua).
  const groups = new Map<string, { year: number; monthIndex: number; truths: PayslipTruth[] }>();
  let done = 0;
  for (const f of pdfs) {
    try {
      const ym = detectYM(f);
      if (!ym) { rep.busteSenzaData++; continue; }

      const buf = new Uint8Array(await f.arrayBuffer());
      const truth = await cfg.extract(buf);
      if (!truth.isText) { rep.busteNonTestuali++; continue; }
      if (truth.is13a14a) { rep.buste13a14a++; continue; }
      if (truth.reconOk === false) { rep.busteNonQuadrate++; continue; }
      if (truth.period && (truth.period.year !== ym.year || truth.period.month - 1 !== ym.monthIndex)) {
        rep.busteMisfiled.push({ name: f.name, year: truth.period.year, monthIndex: truth.period.month - 1 });
        continue;
      }
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
    const truth = pickConsistentTruth(g.truths, cfg);
    if (!truth) { rep.mesiInConflitto.push({ year: g.year, monthIndex: g.monthIndex, count: g.truths.length }); continue; }

    const row = byYM.get(`${g.year}-${g.monthIndex}`);
    if (!row) { rep.mesiAssenti.push({ year: g.year, monthIndex: g.monthIndex }); }

    // Codici: confronta solo quelli tracciati dall'app
    for (const code of cfg.codes) {
      const t = truth.codes[code] ?? 0;
      const has = !!row && row[code as keyof AnnoDati] !== undefined
        && row[code as keyof AnnoDati] !== null && row[code as keyof AnnoDati] !== '';
      const e = has ? pv(row![code as keyof AnnoDati]) : null;
      if (e === null && Math.abs(t) < EPS) continue;             // entrambi ~0 → ok
      if (e === null || Math.abs(e - t) >= EPS) {
        rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field: code, engine: e, truth: Math.round(t * 100) / 100 });
      }
    }

    // Giorni (solo se letti con certezza)
    if (truth.hasDays && row) {
      if (truth.daysUncertain) {
        rep.mesiGiorniIncerti.push({ year: g.year, monthIndex: g.monthIndex, presenze: truth.daysWorked });
      }
      for (const field of cfg.dayFields) {
        if (field === 'daysWorked' && truth.daysUncertain) continue; // ambiguo → decisione umana
        const e = pv(row[field]);
        if (Math.abs(e - truth[field]) >= EPS)
          rep.discrepancies.push({ year: g.year, monthIndex: g.monthIndex, field, engine: e, truth: truth[field] });
      }
    }
  }

  rep.discrepancies.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex || a.field.localeCompare(b.field));
  rep.mesiInConflitto.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);
  rep.mesiGiorniIncerti.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);
  return rep;
}
