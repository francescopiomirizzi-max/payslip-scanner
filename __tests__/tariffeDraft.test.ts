import { describe, it, expect } from 'vitest';
import { formatTariffaInput, parseTariffaInput, parseTariffeDraft, tariffeToDraft, draftIsDirty } from '../utils/tariffeDraft';

describe('tariffeDraft — helper editor tariffe €/h per anno', () => {
    describe('parseTariffaInput', () => {
        it('accetta virgola e punto come decimale', () => {
            expect(parseTariffaInput('10,08')).toBe(10.08);
            expect(parseTariffaInput('10.08')).toBe(10.08); // punto decimale (abitudine) → NON 1008
            expect(parseTariffaInput('13')).toBe(13);
        });
        it('separatore migliaia: ultimo separatore = decimale', () => {
            expect(parseTariffaInput('1.234,56')).toBe(1234.56);
            expect(parseTariffaInput('1,234.56')).toBe(1234.56);
        });
        it('rifiuta vuoto, non numerico e non positivo', () => {
            expect(parseTariffaInput('')).toBeNull();
            expect(parseTariffaInput('   ')).toBeNull();
            expect(parseTariffaInput('abc')).toBeNull();
            expect(parseTariffaInput('0')).toBeNull();
            expect(parseTariffaInput('-5')).toBeNull();
        });
        it('arrotonda a 2 decimali', () => {
            expect(parseTariffaInput('10,999')).toBe(11);
        });
    });

    describe('formatTariffaInput', () => {
        it('formato italiano a 2 decimali', () => {
            expect(formatTariffaInput(10.08)).toBe('10,08');
            expect(formatTariffaInput(13.1)).toBe('13,10');
        });
        it('round-trip con parse', () => {
            for (const n of [10.08, 12.19, 13.13]) {
                expect(parseTariffaInput(formatTariffaInput(n))).toBe(n);
            }
        });
    });

    describe('parseTariffeDraft', () => {
        it('converte un draft completo', () => {
            expect(parseTariffeDraft({ '2011': '10,08', '2024': '13,13' })).toEqual({ '2011': 10.08, '2024': 13.13 });
        });
        it('null se un solo campo è invalido (blocca il salvataggio → niente fallback flat)', () => {
            expect(parseTariffeDraft({ '2011': '10,08', '2024': '' })).toBeNull();
            expect(parseTariffeDraft({ '2011': 'x', '2024': '13,13' })).toBeNull();
        });
        it('null se il draft è vuoto', () => {
            expect(parseTariffeDraft({})).toBeNull();
        });
    });

    describe('tariffeToDraft + draftIsDirty', () => {
        const rates = { '2011': 10.08, '2024': 13.13 };
        it('precompila il draft dalla curva, anni ordinati', () => {
            expect(tariffeToDraft(rates)).toEqual({ '2011': '10,08', '2024': '13,13' });
        });
        it('non dirty se identico alla curva', () => {
            expect(draftIsDirty(tariffeToDraft(rates), rates)).toBe(false);
        });
        it('dirty se un valore cambia', () => {
            expect(draftIsDirty({ '2011': '10,50', '2024': '13,13' }, rates)).toBe(true);
        });
    });
});
