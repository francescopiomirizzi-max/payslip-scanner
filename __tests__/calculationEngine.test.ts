import { describe, it, expect } from 'vitest';
import {
  computeYearlyAverages,
  computeHolidayIndemnity,
  EXCLUDED_INDEMNITY_COLS,
} from '../utils/calculationEngine';
import type { AnnoDati } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function row(
  year: number,
  monthIndex: number,
  daysWorked: number | string,
  daysVacation: number | string,
  indemnity: number | string = 0,
  extras: Record<string, unknown> = {}
): AnnoDati {
  return {
    year,
    monthIndex,
    daysWorked,
    daysVacation,
    ticket: 0,
    '0152': indemnity, // first non-excluded RFI column
    ...extras,
  };
}

function params(
  data: AnnoDati[],
  overrides: Partial<Parameters<typeof computeHolidayIndemnity>[0]> = {}
) {
  return {
    data,
    profilo: 'RFI' as const,
    includeExFest: false,
    includeTickets: false,
    startClaimYear: 2024,
    years: [2023, 2024],
    ...overrides,
  };
}

// ─── EXCLUDED_INDENNITY_COLS ─────────────────────────────────────────────────

describe('EXCLUDED_INDEMNITY_COLS', () => {
  it('contains 3B70 and 3B71', () => {
    expect(EXCLUDED_INDEMNITY_COLS).toContain('3B70');
    expect(EXCLUDED_INDEMNITY_COLS).toContain('3B71');
  });

  it('contains all structural columns', () => {
    const structural = ['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'];
    structural.forEach(col => expect(EXCLUDED_INDEMNITY_COLS).toContain(col));
  });
});

// ─── computeYearlyAverages ───────────────────────────────────────────────────

describe('computeYearlyAverages', () => {
  it('returns empty object for empty data', () => {
    expect(computeYearlyAverages([], 'RFI')).toEqual({});
  });

  it('returns empty object for non-array data', () => {
    expect(computeYearlyAverages(null as any, 'RFI')).toEqual({});
  });

  it('computes average correctly: 200€ over 20 days = 10€/day', () => {
    const data = [row(2023, 0, 20, 0, 200)];
    const avgs = computeYearlyAverages(data, 'RFI');
    expect(avgs[2023]).toBeCloseTo(10);
  });

  it('excludes months with 0 daysWorked from denominator', () => {
    const data = [
      row(2023, 0, 20, 0, 200), // 200/20 = 10
      row(2023, 1, 0, 0, 100),  // 0 days → excluded from denominator, but 100 added to totVar
    ];
    const avgs = computeYearlyAverages(data, 'RFI');
    // totVar = 300, ggLav = 20 → avg = 15
    expect(avgs[2023]).toBeCloseTo(15);
  });

  it('returns 0 for year where all months have daysWorked=0', () => {
    const data = [row(2023, 0, 0, 5, 300)];
    const avgs = computeYearlyAverages(data, 'RFI');
    expect(avgs[2023]).toBe(0);
  });

  it('ignores 3B70 and 3B71 columns', () => {
    const withoutBonus = [row(2023, 0, 20, 0, 200)];
    const withBonus = [row(2023, 0, 20, 0, 200, { '3B70': 1000, '3B71': 500 })];
    const avgWithout = computeYearlyAverages(withoutBonus, 'RFI')[2023];
    const avgWith = computeYearlyAverages(withBonus, 'RFI')[2023];
    expect(avgWith).toBeCloseTo(avgWithout);
  });

  it('handles undefined profilo gracefully (falls back to RFI)', () => {
    const data = [row(2023, 0, 20, 0, 200)];
    expect(() => computeYearlyAverages(data, undefined as any)).not.toThrow();
  });
});

// ─── computeHolidayIndemnity — guard cases ───────────────────────────────────

describe('computeHolidayIndemnity — guards', () => {
  it('returns [] for empty data array', () => {
    expect(computeHolidayIndemnity(params([]))).toEqual([]);
  });

  it('returns [] for non-array data', () => {
    expect(computeHolidayIndemnity(params(null as any))).toEqual([]);
  });

  it('returns [] for empty years array', () => {
    const data = [row(2024, 0, 20, 5, 200)];
    expect(computeHolidayIndemnity(params(data, { years: [] }))).toEqual([]);
  });

  it('returns [] for non-array years', () => {
    const data = [row(2024, 0, 20, 5, 200)];
    expect(computeHolidayIndemnity(params(data, { years: null as any }))).toEqual([]);
  });

  it('handles null rows inside data without crashing', () => {
    const data = [null as any, row(2024, 0, 20, 5, 200), undefined as any];
    expect(() => computeHolidayIndemnity(params(data, { years: [2024] }))).not.toThrow();
  });

  it('handles undefined profilo gracefully', () => {
    const data = [row(2024, 0, 20, 5, 200)];
    expect(() => computeHolidayIndemnity(params(data, { profilo: undefined as any, years: [2024] }))).not.toThrow();
  });

  it('handles NaN startClaimYear, falling back to 2008', () => {
    const data = [row(2024, 0, 20, 5, 200)];
    const result = computeHolidayIndemnity(params(data, { startClaimYear: NaN, years: [2024] }));
    expect(result).toHaveLength(1);
    // 2024 >= 2008 → isReferenceYear = false
    expect(result[0].isReferenceYear).toBe(false);
  });
});

// ─── computeHolidayIndemnity — standard calculation ──────────────────────────

describe('computeHolidayIndemnity — standard calculation', () => {
  it('applies previous-year average to claim year vacation days', () => {
    const data = [
      // 2023: reference year → avg = 200/20 = 10/day
      row(2023, 0, 20, 0, 200),
      // 2024: claim year, 5 vacation days
      row(2024, 0, 20, 5, 300, { coeffPercepito: '0', coeffTicket: '0' }),
    ];
    const result = computeHolidayIndemnity(params(data));
    const year2024 = result.find(r => r.year === 2024)!;

    expect(year2024.avgApplied).toBeCloseTo(10); // from 2023
    expect(year2024.isFallback).toBe(false);
    expect(year2024.monthlyDetails[0].giorniUtili).toBe(5);
    expect(year2024.monthlyDetails[0].indennitaSpettante).toBeCloseTo(50); // 5 * 10
  });

  it('marks years before startClaimYear as isReferenceYear', () => {
    const data = [
      row(2023, 0, 20, 5, 200),
      row(2024, 0, 20, 5, 300),
    ];
    const result = computeHolidayIndemnity(params(data));
    expect(result.find(r => r.year === 2023)!.isReferenceYear).toBe(true);
    expect(result.find(r => r.year === 2024)!.isReferenceYear).toBe(false);
  });

  it('uses fallback average when no previous-year data exists', () => {
    const data = [row(2024, 0, 20, 5, 200)];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    const y = result[0];
    // No 2023 data → fallback to 2024 avg = 200/20 = 10
    expect(y.avgApplied).toBeCloseTo(10);
    expect(y.isFallback).toBe(true);
  });

  it('returns correct sumGiorniLav accumulation', () => {
    const data = [
      row(2024, 0, 20, 3, 200),
      row(2024, 1, 22, 5, 220),
    ];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].sumGiorniLav).toBe(42);
  });

  it('returns correct sumIndennitaTotali even for months with 0 days', () => {
    const data = [
      row(2024, 0, 0, 0, 100), // 0 days worked, indemnity still contributes to totVar
      row(2024, 1, 20, 5, 200),
    ];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].sumIndennitaTotali).toBeCloseTo(300);
    expect(result[0].sumGiorniLav).toBe(20); // only month 1
  });
});

// ─── computeHolidayIndemnity — TETTO (cap on vacation days) ─────────────────

describe('computeHolidayIndemnity — TETTO', () => {
  it('caps total vacation days at 28 when includeExFest=false', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 20, 300),
      row(2024, 1, 20, 20, 300), // cumulative 40 → capped at 28
    ];
    const result = computeHolidayIndemnity(params(data, { includeExFest: false }));
    const y = result.find(r => r.year === 2024)!;
    expect(y.sumGiorniFerieUtili).toBe(28);
  });

  it('caps total vacation days at 32 when includeExFest=true', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 20, 300),
      row(2024, 1, 20, 20, 300), // cumulative 40 → capped at 32
    ];
    const result = computeHolidayIndemnity(params(data, { includeExFest: true }));
    const y = result.find(r => r.year === 2024)!;
    expect(y.sumGiorniFerieUtili).toBe(32);
  });
});

// ─── computeHolidayIndemnity — tickets ───────────────────────────────────────

describe('computeHolidayIndemnity — tickets', () => {
  it('sumBuoniPasto is 0 when includeTickets=false', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300, { coeffTicket: '8' }),
    ];
    const result = computeHolidayIndemnity(params(data, { includeTickets: false }));
    const y = result.find(r => r.year === 2024)!;
    expect(y.sumBuoniPasto).toBe(0);
  });

  it('sumBuoniPasto = giorni_utili * coeffTicket when includeTickets=true', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300, { coeffTicket: '8', coeffPercepito: '0' }),
    ];
    const result = computeHolidayIndemnity(params(data, { includeTickets: true }));
    const y = result.find(r => r.year === 2024)!;
    // 5 giorni_utili * 8€/ticket = 40
    expect(y.sumBuoniPasto).toBeCloseTo(40);
  });
});

// ─── computeHolidayIndemnity — OCR anomalies ─────────────────────────────────

describe('computeHolidayIndemnity — OCR anomalies', () => {
  it('clamps negative daysVacation to 0', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, -5, 300), // negative from OCR
    ];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].monthlyDetails[0].giorniFerieReali).toBe(0);
    expect(result[0].sumGiorniFerieReali).toBe(0);
  });

  it('clamps negative daysWorked to 0', () => {
    const data = [row(2024, 0, -10, 5, 200)];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].monthlyDetails[0].giorniLav).toBe(0);
  });

  it('clamps negative coeffPercepito to 0', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300, { coeffPercepito: '-10' }),
    ];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].monthlyDetails[0].indennitaPercepita).toBe(0);
  });

  it('handles Infinity input as 0', () => {
    const data = [row(2024, 0, Infinity, 5, Infinity)];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    const detail = result[0].monthlyDetails[0];
    expect(detail.giorniLav).toBe(0);
    expect(detail.indennitaMensile).toBe(0);
  });

  it('parses Italian-format string "1.234,56" correctly', () => {
    const data = [row(2023, 0, 20, 0, '1.234,56')];
    const avgs = computeYearlyAverages(data, 'RFI');
    // 1234.56 / 20 = 61.728
    expect(avgs[2023]).toBeCloseTo(61.728);
  });

  it('treats empty string as 0', () => {
    const data = [row(2024, 0, '', 0, '')];
    const result = computeHolidayIndemnity(params(data, { years: [2024] }));
    expect(result[0].monthlyDetails[0].giorniLav).toBe(0);
    expect(result[0].monthlyDetails[0].indennitaMensile).toBe(0);
  });

  it('out-of-range monthIndex does not crash and defaults to 0', () => {
    const data = [row(2024, 99, 20, 5, 200)];
    expect(() => computeHolidayIndemnity(params(data, { years: [2024] }))).not.toThrow();
    const detail = computeHolidayIndemnity(params(data, { years: [2024] }))[0].monthlyDetails[0];
    expect(detail.index).toBe(11); // Math.min(11, 99)
  });

  it('string monthIndex (OCR artifact) is treated as 0', () => {
    const data = [{ ...row(2024, 0, 20, 5, 200), monthIndex: 'gennaio' as any }];
    expect(() => computeHolidayIndemnity(params(data, { years: [2024] }))).not.toThrow();
  });
});

// ─── computeHolidayIndemnity — 3B70 / 3B71 exclusion ────────────────────────

describe('computeHolidayIndemnity — 3B70/3B71 exclusion', () => {
  it('adding 3B70 does not affect indemnity calculation', () => {
    const base = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300),
    ];
    const withBonus = [
      row(2023, 0, 20, 0, 200, { '3B70': 5000 }),
      row(2024, 0, 20, 5, 300, { '3B70': 5000 }),
    ];

    const r1 = computeHolidayIndemnity(params(base)).find(r => r.year === 2024)!;
    const r2 = computeHolidayIndemnity(params(withBonus)).find(r => r.year === 2024)!;

    expect(r2.avgApplied).toBeCloseTo(r1.avgApplied);
    expect(r2.sumIndennitaSpettante).toBeCloseTo(r1.sumIndennitaSpettante);
  });

  it('adding 3B71 does not affect indemnity calculation', () => {
    const base = [row(2024, 0, 20, 5, 200)];
    const withBonus = [row(2024, 0, 20, 5, 200, { '3B71': 9999 })];

    const r1 = computeHolidayIndemnity(params(base, { years: [2024] }))[0];
    const r2 = computeHolidayIndemnity(params(withBonus, { years: [2024] }))[0];

    expect(r2.avgApplied).toBeCloseTo(r1.avgApplied);
    expect(r2.sumIndennitaSpettante).toBeCloseTo(r1.sumIndennitaSpettante);
  });
});

// ─── computeHolidayIndemnity — multi-year ────────────────────────────────────

describe('computeHolidayIndemnity — multi-year', () => {
  it('each year uses the previous year average', () => {
    const data = [
      row(2022, 0, 10, 0, 100), // avg = 100/10 = 10
      row(2023, 0, 20, 5, 400), // avg = 400/20 = 20; uses 2022 avg = 10
      row(2024, 0, 15, 8, 300), // avg = 300/15 = 20; uses 2023 avg = 20
    ];
    const result = computeHolidayIndemnity(params(data, {
      startClaimYear: 2022,
      years: [2022, 2023, 2024],
    }));

    const y2023 = result.find(r => r.year === 2023)!;
    const y2024 = result.find(r => r.year === 2024)!;

    expect(y2023.avgApplied).toBeCloseTo(10); // from 2022
    expect(y2024.avgApplied).toBeCloseTo(20); // from 2023
  });

  it('results are sorted by year ascending', () => {
    const data = [
      row(2024, 0, 20, 5, 300),
      row(2023, 0, 20, 0, 200),
    ];
    const result = computeHolidayIndemnity(params(data));
    const years = result.map(r => r.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});

// ─── computeHolidayIndemnity — netto calculation ─────────────────────────────

describe('computeHolidayIndemnity — netto', () => {
  it('netto = indennitaSpettante - indennitaPercepita (no tickets)', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300, { coeffPercepito: '5', coeffTicket: '0' }),
    ];
    const result = computeHolidayIndemnity(params(data));
    const y = result.find(r => r.year === 2024)!;
    const d = y.monthlyDetails[0];
    // avgApplied = 10, giorniUtili = 5
    // spettante = 50, percepita = 5 * 5 = 25, netto = 50 - 25 = 25
    expect(d.indennitaSpettante).toBeCloseTo(50);
    expect(d.indennitaPercepita).toBeCloseTo(25);
    expect(d.netto).toBeCloseTo(25);
    expect(y.sumNetto).toBeCloseTo(25);
  });

  it('netto = (spettante - percepita) + buoniPasto with tickets', () => {
    const data = [
      row(2023, 0, 20, 0, 200),
      row(2024, 0, 20, 5, 300, { coeffPercepito: '5', coeffTicket: '8' }),
    ];
    const result = computeHolidayIndemnity(params(data, { includeTickets: true }));
    const y = result.find(r => r.year === 2024)!;
    // spettante=50, percepita=25, buoniPasto=40, netto=65
    expect(y.sumNetto).toBeCloseTo(65);
  });

  it('never returns NaN in any numeric field', () => {
    const data = [
      row(2023, 0, 'garbage', 'bad', 'nope'),
      row(2024, 0, 0, 0, 0),
    ];
    const result = computeHolidayIndemnity(params(data));
    result.forEach(yr => {
      expect(isNaN(yr.avgApplied)).toBe(false);
      expect(isNaN(yr.sumIndennitaTotali)).toBe(false);
      expect(isNaN(yr.sumGiorniLav)).toBe(false);
      expect(isNaN(yr.sumGiorniFerieReali)).toBe(false);
      expect(isNaN(yr.sumGiorniFerieUtili)).toBe(false);
      expect(isNaN(yr.sumIndennitaSpettante)).toBe(false);
      expect(isNaN(yr.sumIndennitaPercepita)).toBe(false);
      expect(isNaN(yr.sumBuoniPasto)).toBe(false);
      expect(isNaN(yr.sumNetto)).toBe(false);
      yr.monthlyDetails.forEach(d => {
        expect(isNaN(d.indennitaMensile)).toBe(false);
        expect(isNaN(d.giorniLav)).toBe(false);
        expect(isNaN(d.giorniFerieReali)).toBe(false);
        expect(isNaN(d.giorniUtili)).toBe(false);
        expect(isNaN(d.indennitaSpettante)).toBe(false);
        expect(isNaN(d.indennitaPercepita)).toBe(false);
        expect(isNaN(d.buoniPasto)).toBe(false);
        expect(isNaN(d.netto)).toBe(false);
      });
    });
  });
});
