import type { Worker } from '../types';
import { parseLocalFloat } from './formatters';

const MESI_ABBR_FIX = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Etichetta compatta dei mesi da sistemare, es. "Nov 2008 · Set 2009". Vuota se nessuno. */
export const formatFixTargets = (targets?: { year: number; monthIndex: number }[] | null): string => {
  if (!targets || targets.length === 0) return '';
  return [...targets]
    .sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex)
    .map(t => `${MESI_ABBR_FIX[t.monthIndex] ?? '?'} ${t.year}`)
    .join(' · ');
};

/**
 * Un mese è "compilato" se almeno un campo NON strutturale ha un valore numerico > 0.
 * Necessario perché ogni profilo aziendale popola colonne diverse:
 *  - ELIOR / RFI: `daysWorked`
 *  - TRENITALIA: codici indennità (es. '0576')
 *  - altri: ticket / arretrati / ecc.
 */
const STRUCTURAL_FIELDS = new Set(['id', 'year', 'month', 'monthIndex', 'note']);

const isMonthFilled = (a: Record<string, any>): boolean => {
  for (const [k, v] of Object.entries(a)) {
    if (STRUCTURAL_FIELDS.has(k)) continue;
    if (v == null || v === '') continue;
    const n = parseLocalFloat(v);
    if (n > 0) return true;
  }
  return false;
};

export const monthsByYearFromAnni = (worker: Pick<Worker, 'anni'>): Map<number, Set<number>> => {
  const map = new Map<number, Set<number>>();
  for (const a of worker.anni ?? []) {
    if (a.year == null || a.monthIndex == null) continue;
    if (!isMonthFilled(a)) continue;
    if (!map.has(a.year)) map.set(a.year, new Set<number>());
    map.get(a.year)!.add(a.monthIndex);
  }
  return map;
};

export const isPaid = (w: Pick<Worker, 'status'>): boolean => w.status === 'chiusa';

export const isConcluded = (w: Pick<Worker, 'status'>): boolean => w.status === 'trattativa';

export const isMissingPayslips = (w: Pick<Worker, 'status'>): boolean => w.status === 'inviata';

export const isInReport = (w: Pick<Worker, 'status'>): boolean => isConcluded(w) || isMissingPayslips(w);

// --- Calcolo periodo & mesi mancanti per Report Word ---

const MONTH_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Range "Inserito": dal primo mese compilato all'ultimo (es. "Mar 2020 - 2025"). */
export const formatInsertedRange = (worker: Pick<Worker, 'anni'>): string => {
  const flat: { year: number; monthIndex: number }[] = [];
  for (const a of worker.anni ?? []) {
    if (a.year == null || a.monthIndex == null) continue;
    if (!isMonthFilled(a)) continue;
    flat.push({ year: a.year, monthIndex: a.monthIndex });
  }
  if (flat.length === 0) return '—';
  flat.sort((x, y) => x.year - y.year || x.monthIndex - y.monthIndex);
  const first = flat[0];
  const last = flat[flat.length - 1];
  const startLabel = first.monthIndex === 0 ? `${first.year}` : `${MONTH_ABBR[first.monthIndex]} ${first.year}`;
  const endLabel = last.monthIndex === 11 ? `${last.year}` : `${MONTH_ABBR[last.monthIndex]} ${last.year}`;
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

/**
 * Calcola il range atteso [start, end]:
 *  - start: `startClaimYear - 1` (anno base obbligatorio). Se `startClaimYear` manca,
 *    si usa il primo anno con dati come fallback.
 *  - end: l'anno scorso (`currentYear - 1`), oppure l'ultimo anno con dati se maggiore.
 *
 * Eventuali dati caricati PRIMA di `startClaimYear - 1` non generano mancanti
 * (sono "dati extra", non parte del range atteso).
 */
const computeExpectedRange = (worker: Pick<Worker, 'anni' | 'startClaimYear'>): [number, number] | null => {
  const byYear = monthsByYearFromAnni(worker);
  const presentYears = [...byYear.keys()];
  const claimStart = worker.startClaimYear;
  const lastFullYear = new Date().getFullYear() - 1;

  let startY: number;
  if (typeof claimStart === 'number') {
    startY = claimStart - 1;
  } else if (presentYears.length > 0) {
    startY = Math.min(...presentYears);
  } else {
    return null;
  }

  const endY = Math.max(lastFullYear, ...presentYears);
  if (endY < startY) return null;
  return [startY, endY];
};

/**
 * Mesi mancanti — opzione (c): per ciascun anno nel range atteso [start_claim_year, anno_scorso]
 * sono attesi tutti i 12 mesi. Output: "Gen/Feb 2020; 2025 (tutto); Feb 2022".
 */
export const formatMissingMonths = (worker: Pick<Worker, 'anni' | 'startClaimYear'>): string => {
  const byYear = monthsByYearFromAnni(worker);
  const range = computeExpectedRange(worker);
  if (!range) return '';
  const [startY, endY] = range;
  const parts: string[] = [];

  for (let year = startY; year <= endY; year++) {
    const present = byYear.get(year) ?? new Set<number>();
    const missing: number[] = [];
    for (let m = 0; m < 12; m++) if (!present.has(m)) missing.push(m);
    if (missing.length === 0) continue;

    if (missing.length === 12) {
      parts.push(`${year} (tutto)`);
      continue;
    }

    const runs: number[][] = [];
    let cur: number[] = [missing[0]];
    for (let i = 1; i < missing.length; i++) {
      if (missing[i] === missing[i - 1] + 1) cur.push(missing[i]);
      else { runs.push(cur); cur = [missing[i]]; }
    }
    runs.push(cur);

    if (runs.length === 1 && runs[0].length >= 3) {
      const r = runs[0];
      parts.push(`${year} (${MONTH_ABBR[r[0]]}-${MONTH_ABBR[r[r.length - 1]]})`);
    } else {
      const labels = runs.map(r => r.length === 1 ? MONTH_ABBR[r[0]] : `${MONTH_ABBR[r[0]]}-${MONTH_ABBR[r[r.length - 1]]}`);
      parts.push(`${labels.join('/')} ${year}`);
    }
  }

  return parts.join('; ');
};

// --- Copertura per anno (timeline WorkerCard) ---

export interface YearCoverage {
  year: number;
  /** Mesi compilati su 12, stessa definizione di "compilato" del Report Buste Mancanti. */
  filledMonths: number;
}

/**
 * Copertura buste per ogni anno del range atteso [startClaimYear-1, anno scorso]
 * (stesso range e stessa logica di formatMissingMonths, così la timeline in card
 * e il Report Word non possono raccontare storie diverse).
 */
export const getYearCoverage = (worker: Pick<Worker, 'anni' | 'startClaimYear'>): YearCoverage[] => {
  const byYear = monthsByYearFromAnni(worker);
  const range = computeExpectedRange(worker);
  if (!range) return [];
  const [startY, endY] = range;
  const out: YearCoverage[] = [];
  for (let year = startY; year <= endY; year++) {
    out.push({ year, filledMonths: (byYear.get(year) ?? new Set<number>()).size });
  }
  return out;
};

/** True se ci sono mesi mancanti nel range atteso [startClaimYear, anno_scorso]. */
export const hasMissingMonths = (worker: Pick<Worker, 'anni' | 'startClaimYear'>): boolean => {
  const byYear = monthsByYearFromAnni(worker);
  const range = computeExpectedRange(worker);
  if (!range) return false;
  const [startY, endY] = range;
  for (let year = startY; year <= endY; year++) {
    const present = byYear.get(year) ?? new Set<number>();
    if (present.size < 12) return true;
  }
  return false;
};
