import { describe, it, expect } from 'vitest';
import { isUuid, matchesSindacato, sindacatoIdPerScrittura } from '../utils/sindacatoScope';

const FAST = 'b2dd2937-b2a1-49c0-9342-ddbd81093a5f';
const ALTRO = '11111111-2222-4333-8444-555555555555';

describe('isUuid', () => {
    it('riconosce un uuid reale, rifiuta sentinelle e vuoti', () => {
        expect(isUuid(FAST)).toBe(true);
        expect(isUuid(FAST.toUpperCase())).toBe(true);
        expect(isUuid('fast-confsal')).toBe(false);
        expect(isUuid('')).toBe(false);
        expect(isUuid(null)).toBe(false);
        expect(isUuid(undefined)).toBe(false);
    });
});

describe('matchesSindacato (fail-open)', () => {
    it('nessuna organizzazione attiva (null) → tutto visibile', () => {
        expect(matchesSindacato(FAST, null)).toBe(true);
        expect(matchesSindacato(undefined, null)).toBe(true);
    });

    it("sentinella 'fast-confsal' (fallback demo/errore) → non filtra nulla", () => {
        expect(matchesSindacato(FAST, 'fast-confsal')).toBe(true);
        expect(matchesSindacato(ALTRO, 'fast-confsal')).toBe(true);
        expect(matchesSindacato(undefined, 'fast-confsal')).toBe(true);
    });

    it('organizzazione reale attiva → filtra per uuid, legacy senza id resta visibile', () => {
        expect(matchesSindacato(FAST, FAST)).toBe(true);
        expect(matchesSindacato(ALTRO, FAST)).toBe(false);
        expect(matchesSindacato(null, FAST)).toBe(true);
        expect(matchesSindacato(undefined, FAST)).toBe(true);
    });
});

describe('sindacatoIdPerScrittura', () => {
    it('stampa solo organizzazioni reali; sentinella/null → undefined (colonna non scritta)', () => {
        expect(sindacatoIdPerScrittura(FAST)).toBe(FAST);
        expect(sindacatoIdPerScrittura('fast-confsal')).toBeUndefined();
        expect(sindacatoIdPerScrittura(null)).toBeUndefined();
    });
});
