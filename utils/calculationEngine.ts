import { AnnoDati, MONTH_NAMES, ProfiloAzienda, getColumnsByProfile } from '../types';
import { parseLocalFloat } from './formatters';

export const EXCLUDED_INDEMNITY_COLS = [
  'month', 'total', 'daysWorked', 'daysVacation', 'ticket',
  'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'
];

export interface MonthDetail {
  index: number;
  name: string;
  indennitaMensile: number;
  giorniLav: number;
  giorniFerieReali: number;
  giorniUtili: number;
  indennitaSpettante: number;
  indennitaPercepita: number;
  buoniPasto: number;
  netto: number;
  rawPercepito: string;
  rawTicket: string;
}

export interface YearResult {
  year: number;
  isReferenceYear: boolean;
  avgApplied: number;
  isFallback: boolean;
  sumIndennitaTotali: number;
  sumGiorniLav: number;
  sumGiorniFerieReali: number;
  sumGiorniFerieUtili: number;
  sumIndennitaSpettante: number;
  sumIndennitaPercepita: number;
  sumBuoniPasto: number;
  sumNetto: number;
  monthlyDetails: MonthDetail[];
}

export interface CalculationParams {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  includeExFest: boolean;
  includeTickets: boolean;
  startClaimYear: number;
  years: number[];
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Ensures a computed value is finite; replaces NaN/±Infinity with 0. */
function fin(v: number): number {
  return isFinite(v) ? v : 0;
}

/**
 * Parses any OCR/DB value as a day count.
 * Negative values (OCR artifacts) are clamped to 0.
 */
function parseDays(v: unknown): number {
  return Math.max(0, fin(parseLocalFloat(v)));
}

/**
 * Parses any OCR/DB value as a monetary amount.
 * Allows negatives (indemnity corrections are valid).
 */
function parseAmount(v: unknown): number {
  return fin(parseLocalFloat(v));
}

/**
 * Parses a rate coefficient (percepito/ticket per day).
 * Rates must be ≥ 0; negative rates from OCR are clamped to 0.
 */
function parseRate(v: unknown): number {
  return Math.max(0, fin(parseLocalFloat(v)));
}

/**
 * Returns a safe month name for a given index.
 * Out-of-range or non-integer indices fall back to a numbered label.
 */
function monthName(index: unknown): string {
  const i = typeof index === 'number' && Number.isInteger(index) ? index : -1;
  return (i >= 0 && i <= 11 ? MONTH_NAMES[i] : null) ?? `Mese ${i >= 0 ? i + 1 : '?'}`;
}

/**
 * Returns a safe integer in [0, 11] for a monthIndex from any source.
 * Clamps out-of-range values and falls back to 0 for non-integers.
 */
function safeMonthIndex(index: unknown): number {
  if (typeof index !== 'number' || !Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(11, index));
}

// ─── Exported functions ─────────────────────────────────────────────────────

/**
 * Computes the daily variable indemnity average per year.
 * Only months with daysWorked > 0 contribute to the denominator.
 * Returns an empty object for invalid inputs.
 */
export function computeYearlyAverages(
  data: AnnoDati[],
  profilo: ProfiloAzienda,
  eliorType?: 'viaggiante' | 'magazzino'
): Record<number, number> {
  if (!Array.isArray(data) || data.length === 0) return {};

  const safeProfile = profilo || 'RFI';
  const cols = (getColumnsByProfile(safeProfile, eliorType) || []).filter(
    c => c?.id && !EXCLUDED_INDEMNITY_COLS.includes(c.id)
  );

  const raw: Record<number, { totVar: number; ggLav: number }> = {};

  data.forEach(row => {
    if (!row) return;
    const y = Number(row.year);
    if (!isFinite(y) || isNaN(y)) return;
    if (!raw[y]) raw[y] = { totVar: 0, ggLav: 0 };
    const gg = parseDays(row.daysWorked);
    let sum = 0;
    cols.forEach(c => { sum += parseAmount(row[c.id]); });
    raw[y].totVar += fin(sum);
    if (gg > 0) raw[y].ggLav += gg;
  });

  const averages: Record<number, number> = {};
  Object.keys(raw).forEach(k => {
    const y = Number(k);
    const { totVar, ggLav } = raw[y];
    averages[y] = ggLav > 0 ? fin(totVar / ggLav) : 0;
  });
  return averages;
}

/**
 * Full holiday indemnity calculation: yearly averages + per-month economic detail.
 * Returns one YearResult per year present in both `data` and `params.years`.
 *
 * Guarantees:
 * - Never returns NaN or undefined in any numeric field.
 * - Negative vacation/work days from OCR are clamped to 0.
 * - Negative percepito/ticket rates are clamped to 0.
 * - Infinity from extreme inputs is coerced to 0.
 * - Invalid data/years arrays return an empty result set.
 */
export function computeHolidayIndemnity(params: CalculationParams): YearResult[] {
  const {
    data,
    profilo,
    eliorType,
    includeExFest,
    includeTickets,
    startClaimYear,
    years,
  } = params;

  // ── Input guards ──────────────────────────────────────────────────────────
  if (!Array.isArray(data) || data.length === 0) return [];
  if (!Array.isArray(years) || years.length === 0) return [];

  const safeProfile = profilo || 'RFI';
  const safeStartYear = (typeof startClaimYear === 'number' && isFinite(startClaimYear))
    ? Math.floor(startClaimYear)
    : 2008;

  const TETTO = includeExFest === true ? 32 : 28;

  const cols = (getColumnsByProfile(safeProfile, eliorType) || []).filter(
    c => c?.id && !EXCLUDED_INDEMNITY_COLS.includes(c.id)
  );

  // ── Step 1: yearly averages + raw totals ──────────────────────────────────
  const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};

  data.forEach(row => {
    if (!row) return;
    const y = Number(row.year);
    if (!isFinite(y) || isNaN(y)) return;
    if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
    const gg = parseDays(row.daysWorked);
    let sum = 0;
    cols.forEach(c => { sum += parseAmount(row[c.id]); });
    yearlyRaw[y].totVar += fin(sum);
    if (gg > 0) yearlyRaw[y].ggLav += gg;
  });

  const yearlyAverages: Record<number, number> = {};
  Object.keys(yearlyRaw).forEach(k => {
    const y = Number(k);
    const { totVar, ggLav } = yearlyRaw[y];
    yearlyAverages[y] = ggLav > 0 ? fin(totVar / ggLav) : 0;
  });

  // ── Step 2: filter to valid requested years ───────────────────────────────
  const safeYears = years.filter(y => typeof y === 'number' && isFinite(y));
  const availableYears = Array.from(new Set(data.map(d => Number(d?.year))))
    .filter(y => isFinite(y) && !isNaN(y) && safeYears.includes(y))
    .sort((a, b) => a - b);

  // ── Step 3: per-year calculation ──────────────────────────────────────────
  return availableYears.map(year => {
    const isReferenceYear = year < safeStartYear;
    let ferieCumulate = 0;

    // Resolve applied average: previous year, or fallback to current year
    let avgApplied = yearlyAverages[year - 1] ?? 0;
    let isFallback = false;
    if (!avgApplied) {
      avgApplied = yearlyAverages[year] ?? 0;
      isFallback = true;
    }
    avgApplied = fin(avgApplied); // guard against any residual Infinity

    const sumIndennitaTotali = fin(yearlyRaw[year]?.totVar ?? 0);
    const sumGiorniLav = fin(yearlyRaw[year]?.ggLav ?? 0);
    let sumGiorniFerieReali = 0;
    let sumGiorniFerieUtili = 0;
    let sumIndennitaSpettante = 0;
    let sumIndennitaPercepita = 0;
    let sumBuoniPasto = 0;
    let sumNetto = 0;

    const months = data
      .filter(d => d && Number(d.year) === year)
      .sort((a, b) => safeMonthIndex(a.monthIndex) - safeMonthIndex(b.monthIndex));

    const monthlyDetails: MonthDetail[] = months.map(row => {
      const idx = safeMonthIndex(row.monthIndex);

      let indennitaMensile = 0;
      cols.forEach(c => { indennitaMensile += parseAmount(row[c.id]); });
      indennitaMensile = fin(indennitaMensile);

      const giorniLav = parseDays(row.daysWorked);
      const giorniFerieReali = parseDays(row.daysVacation); // clamped ≥ 0

      const prevTotal = ferieCumulate;
      ferieCumulate = fin(ferieCumulate + giorniFerieReali);
      const giorniUtili = fin(Math.min(giorniFerieReali, Math.max(0, TETTO - prevTotal)));

      const rawPercepito = String(row['coeffPercepito'] ?? '');
      const rawTicket = String(row['coeffTicket'] ?? '');
      const valPercepito = parseRate(rawPercepito); // clamped ≥ 0
      const valTicket = parseRate(rawTicket);        // clamped ≥ 0

      const indennitaSpettante = fin(giorniUtili > 0 ? giorniUtili * avgApplied : 0);
      const indennitaPercepita = fin(giorniUtili * valPercepito);
      const buoniPasto = fin(includeTickets ? giorniUtili * valTicket : 0);
      const netto = fin((indennitaSpettante - indennitaPercepita) + buoniPasto);

      sumGiorniFerieReali += giorniFerieReali;
      sumGiorniFerieUtili += giorniUtili;
      sumIndennitaSpettante += indennitaSpettante;
      sumIndennitaPercepita += indennitaPercepita;
      sumBuoniPasto += buoniPasto;
      sumNetto += netto;

      return {
        index: idx,
        name: monthName(row.monthIndex),
        indennitaMensile,
        giorniLav,
        giorniFerieReali,
        giorniUtili,
        indennitaSpettante,
        indennitaPercepita,
        buoniPasto,
        netto,
        rawPercepito,
        rawTicket,
      };
    });

    return {
      year,
      isReferenceYear,
      avgApplied,
      isFallback,
      sumIndennitaTotali,
      sumGiorniLav,
      sumGiorniFerieReali: fin(sumGiorniFerieReali),
      sumGiorniFerieUtili: fin(sumGiorniFerieUtili),
      sumIndennitaSpettante: fin(sumIndennitaSpettante),
      sumIndennitaPercepita: fin(sumIndennitaPercepita),
      sumBuoniPasto: fin(sumBuoniPasto),
      sumNetto: fin(sumNetto),
      monthlyDetails,
    };
  });
}
