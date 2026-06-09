import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getYearCoverage } from '../utils/workerStatus';
import type { AnnoDati } from '../types';

// Congela la data: il range atteso arriva fino all'"anno scorso" (qui 2025).
beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-09'));
});
afterAll(() => vi.useRealTimers());

const month = (year: number, monthIndex: number, fields: Record<string, unknown> = {}): AnnoDati => ({
    year,
    monthIndex,
    daysWorked: 0,
    daysVacation: 0,
    ticket: 0,
    ...fields,
} as AnnoDati);

const fullYear = (year: number): AnnoDati[] =>
    Array.from({ length: 12 }, (_, m) => month(year, m, { daysWorked: 20 }));

describe('getYearCoverage', () => {
    it('senza dati né startClaimYear non ha range → []', () => {
        expect(getYearCoverage({ anni: [], startClaimYear: undefined })).toEqual([]);
    });

    it('copre [startClaimYear-1, anno scorso] con il conteggio mesi compilati per anno', () => {
        const anni = [
            ...fullYear(2023),                                  // completo
            month(2024, 0, { daysWorked: 18 }),                 // 2024: 2 mesi
            month(2024, 5, { daysWorked: 21 }),
            // 2025: nessun mese compilato
        ];
        const cov = getYearCoverage({ anni, startClaimYear: 2024 });

        expect(cov.map(c => c.year)).toEqual([2023, 2024, 2025]);
        expect(cov.find(c => c.year === 2023)!.filledMonths).toBe(12);
        expect(cov.find(c => c.year === 2024)!.filledMonths).toBe(2);
        expect(cov.find(c => c.year === 2025)!.filledMonths).toBe(0);
    });

    it('un mese con sola nota NON conta come compilato (campi strutturali esclusi)', () => {
        const anni = [
            month(2024, 0, { note: 'malattia' }),
            month(2024, 1, { ticket: '7,30' }), // valore numerico it-IT > 0 → conta
        ];
        const cov = getYearCoverage({ anni, startClaimYear: 2025 });
        expect(cov.find(c => c.year === 2024)!.filledMonths).toBe(1);
    });

    it('dati oltre l\'anno scorso estendono il range (stesso comportamento del report)', () => {
        const anni = [...fullYear(2025), month(2026, 0, { daysWorked: 10 })];
        const cov = getYearCoverage({ anni, startClaimYear: 2026 });
        expect(cov.map(c => c.year)).toEqual([2025, 2026]);
        expect(cov.find(c => c.year === 2026)!.filledMonths).toBe(1);
    });
});
