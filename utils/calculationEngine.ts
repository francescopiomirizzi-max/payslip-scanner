import { AnnoDati, MONTH_NAMES, ProfiloAzienda, getColumnsByProfile, getFixedColumnsByProfile } from '../types';
import { parseLocalFloat } from './formatters';

export const EXCLUDED_INDEMNITY_COLS = [
  'month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket',
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
  // ── Percentuali di incidenza ("Quadro A/B/C" del conteggio dell'avvocato) ──
  // Additive: non influenzano il credito. quadroVariabili === indennitaMensile.
  quadroFisse: number;       // B = somma voci fisse continuative del mese
  quadroVariabili: number;   // C = somma voci variabili del mese (= indennitaMensile)
  pctVariabile: number;      // C*100 / (B+C); 0 se base assente o profilo senza voci fisse
  pctFissa: number;          // B*100 / (B+C)
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
  // ── Percentuali di incidenza dell'anno ──
  hasIncidence: boolean;          // true solo se il profilo ha voci fisse definite
  sumQuadroFisse: number;         // B annuo
  pctVariabileMediaAnnua: number; // Σ(% variabile mensile) / 12  (come l'Excel dell'avvocato)
  pctFissaMediaAnnua: number;     // Σ(% fissa mensile) / 12
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
  /**
   * Strategia B sindacale: se true, le assenze retribuite (distacchi/permessi)
   * vengono sommate ai giorni lavorati nel DIVISORE della media. Default false
   * (Strategia A: solo i giorni di effettiva presenza, comportamento storico).
   */
  includePaidLeave?: boolean;
  /**
   * Extra numeratore per ANNO: indennità RICOSTRUITE a tariffa, non stampate sui cedolini
   * (es. FSE — Ind. Aziendale 3,50 €×giorni lavorati; accordi in Relazione §3). Si SOMMA al
   * numeratore delle medie di quell'anno; il divisore (giorni lavorati) resta invariato.
   * Passato SOLO dove le ricostruzioni vanno incluse nel credito (scheda Ricostruite, Relazione),
   * non nelle viste quotidiane → il credito base (voci stampate) resta separato e visibile.
   */
  extraNumeratorByYear?: Record<number, number>;
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
 * Only months with a positive divisor contribute to the denominator.
 * Con `includePaidLeave` (Strategia B sindacale): il divisore di ogni mese diventa
 * `giorni lavorati + assenze retribuite`, così i distacchi/permessi sindacali
 * (mesi a 0 presenze) entrano nella media invece di azzerarla.
 * Returns an empty object for invalid inputs.
 */
export function computeYearlyAverages(
  data: AnnoDati[],
  profilo: ProfiloAzienda,
  eliorType?: 'viaggiante' | 'magazzino',
  includePaidLeave: boolean = false
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
    const gg = parseDays(row.daysWorked) + (includePaidLeave ? parseDays(row.daysPaidLeave) : 0);
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
    includePaidLeave = false,
    extraNumeratorByYear,
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

  // Voci FISSE continuative ("Quadro B"): solo denominatore delle percentuali di
  // incidenza, NON entrano nel credito. NON filtrate da EXCLUDED_INDEMNITY_COLS,
  // così 3B70/3B71 (esclusi dal credito) contano comunque nella base fissa.
  const fixedCols = (getFixedColumnsByProfile(safeProfile) || []).filter(c => c?.id);
  const hasIncidence = fixedCols.length > 0;

  // ── Step 1: yearly averages + raw totals ──────────────────────────────────
  const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};

  data.forEach(row => {
    if (!row) return;
    const y = Number(row.year);
    if (!isFinite(y) || isNaN(y)) return;
    if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
    // Strategia B: assenze retribuite (distacchi/permessi sindacali) nel divisore.
    const gg = parseDays(row.daysWorked) + (includePaidLeave ? parseDays(row.daysPaidLeave) : 0);
    let sum = 0;
    cols.forEach(c => { sum += parseAmount(row[c.id]); });
    yearlyRaw[y].totVar += fin(sum);
    if (gg > 0) yearlyRaw[y].ggLav += gg;
  });

  // Indennità RICOSTRUITE a tariffa (non stampate sui cedolini): additive al numeratore dell'anno,
  // divisore (giorni lavorati) invariato. Vuoto/undefined = credito base (comportamento storico).
  if (extraNumeratorByYear) {
    for (const [k, v] of Object.entries(extraNumeratorByYear)) {
      const y = Number(k);
      if (!isFinite(y) || isNaN(y)) continue;
      if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
      yearlyRaw[y].totVar += fin(parseAmount(v));
    }
  }

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
    let sumQuadroFisse = 0;
    let sumPctVariabile = 0;
    let sumPctFissa = 0;

    const months = data
      .filter(d => d && Number(d.year) === year)
      .sort((a, b) => safeMonthIndex(a.monthIndex) - safeMonthIndex(b.monthIndex));

    const monthlyDetails: MonthDetail[] = months.map(row => {
      const idx = safeMonthIndex(row.monthIndex);

      let indennitaMensile = 0;
      cols.forEach(c => { indennitaMensile += parseAmount(row[c.id]); });
      indennitaMensile = fin(indennitaMensile);

      // Base fissa del mese (Quadro B) e percentuali di incidenza (additive).
      let quadroFisse = 0;
      fixedCols.forEach(c => { quadroFisse += parseAmount(row[c.id]); });
      quadroFisse = fin(quadroFisse);
      const quadroVariabili = indennitaMensile; // C
      const baseAB = quadroFisse + quadroVariabili; // A = B + C
      const pctVariabile = hasIncidence && baseAB > 0 ? fin(quadroVariabili * 100 / baseAB) : 0;
      const pctFissa = hasIncidence && baseAB > 0 ? fin(quadroFisse * 100 / baseAB) : 0;

      // Divisore del mese: include le assenze retribuite se Strategia B attiva
      // (coerente col denominatore della media e con il "GG Lav." mostrato).
      const giorniLav = parseDays(row.daysWorked) + (includePaidLeave ? parseDays(row.daysPaidLeave) : 0);
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
      sumQuadroFisse += quadroFisse;
      sumPctVariabile += pctVariabile;
      sumPctFissa += pctFissa;

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
        quadroFisse,
        quadroVariabili,
        pctVariabile,
        pctFissa,
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
      // Media annua = Σ(% mensili) / 12 (divisione fissa per 12 come nell'Excel
      // dell'avvocato: i mesi assenti contano come 0 e abbassano la media).
      hasIncidence,
      sumQuadroFisse: fin(sumQuadroFisse),
      pctVariabileMediaAnnua: hasIncidence ? fin(sumPctVariabile / 12) : 0,
      pctFissaMediaAnnua: hasIncidence ? fin(sumPctFissa / 12) : 0,
      monthlyDetails,
    };
  });
}

/**
 * % media di incidenza delle voci variabili sull'intero periodo richiesto:
 * media delle medie annue dei soli anni con incidenza (== "22,94%" dell'Excel).
 * Restituisce 0 se nessun anno ha voci fisse.
 */
export function computePeriodIncidence(results: YearResult[]): {
  pctVariabile: number;
  pctFissa: number;
  anni: number;
} {
  const withIncidence = (results || []).filter(r => r?.hasIncidence);
  const n = withIncidence.length;
  if (n === 0) return { pctVariabile: 0, pctFissa: 0, anni: 0 };
  const sumVar = withIncidence.reduce((a, r) => a + fin(r.pctVariabileMediaAnnua), 0);
  const sumFis = withIncidence.reduce((a, r) => a + fin(r.pctFissaMediaAnnua), 0);
  return { pctVariabile: fin(sumVar / n), pctFissa: fin(sumFis / n), anni: n };
}
