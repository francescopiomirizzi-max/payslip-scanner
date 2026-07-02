import { describe, it, expect } from 'vitest';
import { violazioniPerAnno, type Violazione } from '../utils/restEngine';

// Costruisce una violazione minima con i soli campi usati da violazioniPerAnno.
const v = (partial: Partial<Violazione>): Violazione => ({
    tipo: 'settimanale', rifNormativo: '', inizio: '2020-01-01T00:00:00', fine: '2020-01-01T00:00:00',
    ore: 0, soglia: 45, oreMancanti: 0, valorePieno: 0, indennita: 0, gravita: 'media', motivo: '', cee: true,
    ...partial,
} as Violazione);

describe('violazioniPerAnno', () => {
    it('raggruppa per anno del dataTurno (fallback inizio) con conteggio e indennità', () => {
        const out = violazioniPerAnno([
            v({ dataTurno: '10/03/2019', indennita: 100 }),
            v({ dataTurno: '20/07/2019', indennita: 50.5 }),
            v({ dataTurno: '01/01/2024', indennita: 30 }),
        ]);
        expect(out['2019']).toEqual({ n: 2, indennita: 150.5 });
        expect(out['2024']).toEqual({ n: 1, indennita: 30 });
    });

    it('usa l\'anno di inizio quando dataTurno manca', () => {
        const out = violazioniPerAnno([v({ inizio: '2022-11-30T22:00:00', indennita: 10 })]);
        expect(out['2022']).toEqual({ n: 1, indennita: 10 });
    });

    it('array vuoto → oggetto vuoto', () => {
        expect(violazioniPerAnno([])).toEqual({});
    });

    it('arrotonda l\'indennità al centesimo', () => {
        const out = violazioniPerAnno([
            v({ dataTurno: '01/01/2020', indennita: 10.005 }),
            v({ dataTurno: '02/01/2020', indennita: 0.001 }),
        ]);
        expect(out['2020'].indennita).toBe(10.01);
    });
});
