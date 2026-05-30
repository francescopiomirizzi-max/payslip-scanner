import { describe, it, expect } from 'vitest';
import { calculateTFR, TFR_REVALUATION_RATES } from '../utils/tfrCalculator';
import type { AnnoDati } from '../types';

// Costruisce una riga mensile minimale: calculateTFR legge solo year,
// imponibile_tfr_mensile e daysWorked.
function row(partial: Partial<AnnoDati>): AnnoDati {
    return { year: 2020, monthIndex: 0, month: 'GENNAIO', ...partial } as unknown as AnnoDati;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe('calculateTFR — casi vuoti', () => {
    it('ritorna [] senza dati reali e senza punto zero', () => {
        expect(calculateTFR([], 0)).toEqual([]);
    });

    it('ignora gli anni fantasma (nessun imponibile, nessun giorno lavorato)', () => {
        const ghosts = [
            row({ year: 2018, imponibile_tfr_mensile: 0, daysWorked: 0 }),
            row({ year: 2019, imponibile_tfr_mensile: 0, daysWorked: 0 }),
        ];
        expect(calculateTFR(ghosts, 0)).toEqual([]);
    });
});

describe('calculateTFR — anno singolo', () => {
    it('quota netta = imponibile/13.5 − 0.5% INPS, fondo iniziale a 0 quindi niente rivalutazione', () => {
        const res = calculateTFR([row({ year: 2020, imponibile_tfr_mensile: 13500 })], 0);
        expect(res).toHaveLength(1);
        const y = res[0];
        // 13500/13.5 = 1000 ; 13500*0.005 = 67.5 ; netta = 932.5
        expect(y.quotaMaturataNetta).toBe(932.5);
        expect(y.rivalutazione).toBe(0);
        expect(y.fondoFinale).toBe(932.5);
        expect(y.imponibileLordo).toBe(13500);
    });

    it("usa il MASSIMO progressivo dell'anno, non la somma dei mesi", () => {
        const res = calculateTFR([
            row({ year: 2020, monthIndex: 0, imponibile_tfr_mensile: 1000 }),
            row({ year: 2020, monthIndex: 5, imponibile_tfr_mensile: 7000 }),
            row({ year: 2020, monthIndex: 11, imponibile_tfr_mensile: 13500 }),
        ], 0);
        // se sommasse: 21500 ; col massimo: 13500
        expect(res[0].imponibileLordo).toBe(13500);
    });

    it('tiene vivo un anno con soli giorni lavorati (daysWorked come stringa)', () => {
        const res = calculateTFR([row({ year: 2021, imponibile_tfr_mensile: 0, daysWorked: '20' as any })], 0);
        expect(res).toHaveLength(1);
        expect(res[0].year).toBe(2021);
        expect(res[0].quotaMaturataNetta).toBe(0);
    });
});

describe('calculateTFR — rivalutazione multi-anno', () => {
    it('applica il tasso ISTAT sul fondo accumulato', () => {
        const res = calculateTFR([
            row({ year: 2020, imponibile_tfr_mensile: 13500 }),
            row({ year: 2021, imponibile_tfr_mensile: 0, daysWorked: 20 }),
        ], 0);
        expect(res).toHaveLength(2);
        // 2020 chiude a 932.5
        expect(res[0].fondoFinale).toBe(932.5);
        // 2021: rivalutazione = 932.5 * 0.0434 ; fondo = 932.5 + 0 + riv
        const riv = round2(932.5 * TFR_REVALUATION_RATES[2021]);
        expect(res[1].rivalutazione).toBe(riv);
        expect(res[1].fondoFinale).toBe(round2(932.5 + riv));
        expect(res[1].fondoIniziale).toBe(932.5);
    });

    it('usa il tasso di fallback 1.5% per anni fuori tabella', () => {
        const res = calculateTFR([
            row({ year: 2024, imponibile_tfr_mensile: 13500 }),
            row({ year: 2025, imponibile_tfr_mensile: 0, daysWorked: 20 }),
        ], 0);
        expect(TFR_REVALUATION_RATES[2025]).toBeUndefined();
        const fondo2024 = res[0].fondoFinale;
        expect(res[1].rivalutazione).toBe(round2(fondo2024 * 0.015));
    });
});

describe('calculateTFR — punto zero (TFR pregresso)', () => {
    it('congela gli anni prima del punto zero e inietta il malloppo nell\'anno del punto zero', () => {
        const res = calculateTFR([
            row({ year: 2020, imponibile_tfr_mensile: 13500 }),
        ], 10000, 2019);
        // firstYear = 2019 (annoPregresso < primo anno dati)
        expect(res[0].year).toBe(2019);
        expect(res[0].isPuntoZeroYear).toBe(true);
        expect(res[0].fondoFinale).toBe(10000);

        // 2020: calcolo standard sopra il pregresso
        const y2020 = res.find(r => r.year === 2020)!;
        expect(y2020.fondoIniziale).toBe(10000);
        const riv = round2(10000 * TFR_REVALUATION_RATES[2020]); // 0.015 → 150
        expect(y2020.rivalutazione).toBe(riv);
        expect(y2020.fondoFinale).toBe(round2(10000 + 932.5 + riv));
    });

    it('marca isBeforePuntoZero per gli anni dati antecedenti al punto zero', () => {
        const res = calculateTFR([
            row({ year: 2018, imponibile_tfr_mensile: 5000 }),
            row({ year: 2020, imponibile_tfr_mensile: 13500 }),
        ], 10000, 2019);
        const y2018 = res.find(r => r.year === 2018)!;
        expect(y2018.isBeforePuntoZero).toBe(true);
        expect(y2018.fondoFinale).toBe(0); // calcoli congelati
    });
});
