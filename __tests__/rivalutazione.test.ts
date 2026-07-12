import { describe, it, expect } from 'vitest';
import {
    foiUnificato, calcolaRivalutazioneMese, buildRivalutazione,
    capitaliMensiliSerieA, capitaliMensiliSerieB, ultimoGiornoDelMese,
    PRIMO_MESE_FOI, ULTIMO_MESE_FOI, TASSI_LEGALI,
} from '../utils/rivalutazione';
import type { GiornataInput, Violazione } from '../utils/restEngine';

// ─── Fixture REALI dal prospetto del perito «Viterbo (Interessi e Rivalutazioni).pdf»
// (scadenza comune 31/10/2024). Le pagine campione sono tra le 153/165 riprodotte
// al centesimo in calibrazione; i capitali mensili sono TUTTI i 165 del prospetto.

const SCADENZA_PERITO = '2024-10';

// Pagine campione: { capitale, capRivalutato, rivalutazione, interessi, totale, nSegmenti }
const PAGINE_PERITO: Array<{ ym: string; cap: number; capRiv: number; riv: number; int: number; tot: number; nSeg: number }> = [
    { ym: '2011-01', cap: 601.79, capRiv: 765.40, riv: 163.61, int: 122.65, tot: 888.05, nSeg: 14 },
    { ym: '2011-02', cap: 199.79, capRiv: 253.36, riv: 53.57, int: 40.36, tot: 293.72, nSeg: 14 },
    { ym: '2011-03', cap: 161.38, capRiv: 203.85, riv: 42.47, int: 32.27, tot: 236.12, nSeg: 14 },
    { ym: '2011-04', cap: 310.12, capRiv: 389.83, riv: 79.71, int: 61.30, tot: 451.13, nSeg: 14 },
    { ym: '2024-08', cap: 644.42, capRiv: 644.42, riv: 0.00, int: 2.69, tot: 647.11, nSeg: 1 },
    { ym: '2024-09', cap: 262.59, capRiv: 262.85, riv: 0.26, int: 0.56, tot: 263.41, nSeg: 1 },
];

// Tutti i 165 capitali mensili del prospetto (= serie A del mese, verificato 165/165 col seed).
const CAPITALI_PERITO: Record<string, number> = { '2011-01': 601.79, '2011-02': 199.79, '2011-03': 161.38, '2011-04': 310.12, '2011-05': 248.13, '2011-06': 408.04, '2011-07': 782.34, '2011-08': 34.2, '2011-09': 230.18, '2011-10': 446.62, '2011-11': 370.39, '2011-12': 226, '2012-01': 153.75, '2012-02': 300.78, '2012-03': 148.66, '2012-04': 138.47, '2012-05': 84.16, '2012-06': 156.3, '2012-07': 169.04, '2012-08': 37.3, '2012-09': 152.12, '2012-10': 289.59, '2012-11': 354.08, '2012-12': 451.72, '2013-01': 504.6, '2013-02': 360.21, '2013-03': 317.71, '2013-04': 536.9, '2013-05': 313.52, '2013-06': 611.59, '2013-07': 151.22, '2013-08': 837.2, '2013-09': 330.99, '2013-10': 335.97, '2013-11': 747.03, '2013-12': 423.16, '2014-01': 391.77, '2014-02': 324.66, '2014-03': 693.63, '2014-04': 376.17, '2014-05': 433.66, '2014-06': 914.44, '2014-07': 177.99, '2014-08': 601.08, '2014-09': 241.02, '2014-10': 341.22, '2014-11': 243.42, '2014-12': 144.9, '2015-01': 270.54, '2015-02': 318.49, '2015-03': 195.46, '2015-04': 626.42, '2015-05': 102.93, '2015-06': 213.9, '2015-07': 223.31, '2015-08': 548.73, '2015-09': 644.92, '2015-10': 686.6, '2015-11': 252.47, '2015-12': 266.6, '2016-01': 103.65, '2016-02': 108.3, '2016-03': 619.16, '2016-04': 592.08, '2016-05': 600.2, '2016-06': 529.8, '2016-07': 672.83, '2016-08': 74.45, '2016-09': 783.14, '2016-10': 1070.91, '2016-11': 670.95, '2016-12': 593.74, '2017-01': 747.27, '2017-02': 801.55, '2017-03': 682.87, '2017-04': 552.38, '2017-05': 683.97, '2017-06': 580.07, '2017-07': 750.04, '2017-08': 262.73, '2017-09': 1127.82, '2017-10': 688.8, '2017-11': 844.16, '2017-12': 624.3, '2018-01': 1205.83, '2018-02': 575.01, '2018-03': 693.85, '2018-04': 746.64, '2018-05': 157.49, '2018-06': 131.04, '2018-07': 114.83, '2018-08': 652.04, '2018-09': 224.53, '2018-10': 1151.95, '2018-11': 1204.74, '2018-12': 1009.93, '2019-01': 678.61, '2019-02': 834.65, '2019-03': 1216.56, '2019-04': 198.08, '2019-05': 497.71, '2019-06': 316.94, '2019-07': 304.64, '2019-08': 1346.03, '2019-09': 1174.04, '2019-10': 1657.59, '2019-11': 1265.7, '2019-12': 1147.19, '2020-01': 1065.93, '2020-02': 1032.03, '2020-03': 623.7, '2020-04': 97.96, '2020-05': 971.03, '2020-06': 1568.76, '2020-07': 906.22, '2020-08': 624.69, '2020-09': 389.78, '2020-10': 821.6, '2020-11': 920.45, '2020-12': 1330.76, '2021-01': 422.67, '2021-02': 219.44, '2021-03': 1288.47, '2021-04': 289.7, '2021-05': 1540.04, '2021-06': 244.44, '2021-07': 1446.3, '2021-08': 738, '2021-09': 780.24, '2021-10': 1413, '2021-11': 399.59, '2021-12': 229.17, '2022-01': 324.43, '2022-02': 881.26, '2022-03': 360.94, '2022-04': 855.53, '2022-05': 432.47, '2022-06': 1395.07, '2022-07': 1247.25, '2022-08': 600.95, '2022-09': 430.13, '2022-10': 1388.8, '2022-11': 666.68, '2022-12': 239.01, '2023-01': 360.05, '2023-02': 1432.1, '2023-03': 229.32, '2023-04': 747.46, '2023-05': 1055.12, '2023-06': 1223.86, '2023-07': 947.85, '2023-08': 1290.76, '2023-09': 1374.31, '2023-10': 1688.38, '2023-11': 233.06, '2023-12': 763.77, '2024-01': 1001.03, '2024-02': 400.47, '2024-03': 311.84, '2024-04': 788.98, '2024-05': 326.01, '2024-06': 211.26, '2024-07': 822.73, '2024-08': 644.42, '2024-09': 262.59 };

describe('calcolaRivalutazioneMese — riconciliazione con le pagine reali del perito', () => {
    for (const p of PAGINE_PERITO) {
        it(`pagina ${p.ym}: capitale ${p.cap} → riv ${p.riv} + int ${p.int} = ${p.tot}`, () => {
            const r = calcolaRivalutazioneMese(p.cap, p.ym, SCADENZA_PERITO);
            expect(r.capitaleRivalutato).toBe(p.capRiv);
            expect(r.rivalutazione).toBe(p.riv);
            expect(r.interessi).toBe(p.int);
            expect(r.totale).toBe(p.tot);
            expect(r.segmenti.length).toBe(p.nSeg);
        });
    }

    it('pagina gen 2011: primo e ultimo segmento identici alle righe stampate', () => {
        const r = calcolaRivalutazioneMese(601.79, '2011-01', SCADENZA_PERITO);
        // "31/01/2011  31/12/2011   618.64   1.50%   334   8.49"
        expect(r.segmenti[0]).toEqual({ anno: 2011, dal: '31/01/2011', al: '31/12/2011', capitaleRivalutato: 618.64, tasso: 1.5, giorni: 334, interessi: 8.49 });
        // "01/01/2024  31/10/2024   765.40   2.50%   305   15.99"
        expect(r.segmenti[13]).toEqual({ anno: 2024, dal: '31/12/2023', al: '31/10/2024', capitaleRivalutato: 765.40, tasso: 2.5, giorni: 305, interessi: 15.99 });
        // base 365 FISSA anche nel bisestile: 2012 = 366 giorni pro-rata su 365
        expect(r.segmenti[1].giorni).toBe(366);
        expect(r.segmenti[1].interessi).toBe(15.88);
    });
});

describe('buildRivalutazione — riepilogo generale del prospetto (165 mesi)', () => {
    const r = buildRivalutazione(CAPITALI_PERITO, SCADENZA_PERITO);
    it('capitale complessivo identico al perito (98.732,03)', () => {
        expect(r.totCapitale).toBe(98732.03);
    });
    it('rivalutazione e interessi entro lo scarto di calibrazione (|Δ| < 5 € su 122.954,79)', () => {
        // Perito: riv 14.475,09 · int 9.747,67 · totale 122.954,79. Le 12 pagine
        // divergenti (coefficienti borderline al 3° decimale del suo software)
        // valgono +4,46 € di rivalutazione e +0,38 € di interessi.
        expect(r.totRivalutazione).toBe(14479.55);
        expect(r.totInteressi).toBe(9748.05);
        expect(r.totale).toBe(122959.63);
        expect(Math.abs(r.totale - 122954.79)).toBeLessThan(5);
    });
    it('aggregato per anno: somme coerenti coi totali', () => {
        const sum = (f: (x: { capitale: number; rivalutazione: number; interessi: number }) => number) =>
            Math.round(r.perAnno.reduce((a, x) => a + f(x), 0) * 100) / 100;
        expect(sum((x) => x.capitale)).toBe(r.totCapitale);
        expect(sum((x) => x.rivalutazione)).toBe(r.totRivalutazione);
        expect(sum((x) => x.interessi)).toBe(r.totInteressi);
        expect(r.perAnno.map((x) => x.anno)).toEqual(['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024']);
    });
    it('scadenza dentro la copertura: nessun limite dichiarato', () => {
        expect(r.scadenzaLimitata).toBe(false);
        expect(r.scadenzaEffettiva).toBe(SCADENZA_PERITO);
        expect(r.mesiFuoriCopertura).toBe(0);
    });
});

describe('edge: copertura della serie FOI e della tabella tassi', () => {
    it('scadenza oltre l\'ultimo indice pubblicato → limitata e dichiarata', () => {
        const r = buildRivalutazione({ '2024-01': 100 }, '2099-12');
        expect(r.scadenzaLimitata).toBe(true);
        expect(r.scadenzaEffettiva).toBe(ULTIMO_MESE_FOI);
    });
    it('mese precedente alla copertura → capitale nei totali senza rivalutazione, flaggato', () => {
        const r = buildRivalutazione({ '2009-05': 100, '2024-01': 50 }, '2024-10');
        expect(r.mesiFuoriCopertura).toBe(1);
        expect(r.totCapitale).toBe(150);
        expect(r.righeMese[0].fuoriCopertura).toBe(true);
        expect(r.righeMese[0].rivalutazione).toBe(0);
        expect(r.righeMese[0].interessi).toBe(0);
    });
    it('danno nel mese di scadenza (o dopo): solo capitale, zero maturazione', () => {
        const r = buildRivalutazione({ '2024-10': 100, '2024-11': 80 }, '2024-10');
        expect(r.totCapitale).toBe(180);
        expect(r.totRivalutazione).toBe(0);
        expect(r.totInteressi).toBe(0);
    });
    it('la serie FOI è continua da PRIMO_MESE_FOI a ULTIMO_MESE_FOI (nessun buco)', () => {
        for (let y = 2011; y <= parseInt(ULTIMO_MESE_FOI.slice(0, 4), 10); y++) {
            for (let m = 1; m <= 12; m++) {
                const ym = `${y}-${String(m).padStart(2, '0')}`;
                if (ym < PRIMO_MESE_FOI || ym > ULTIMO_MESE_FOI) continue;
                expect(foiUnificato(ym), `FOI mancante per ${ym}`).toBeDefined();
            }
        }
    });
    it('ogni anno coperto dalla serie FOI ha il suo tasso legale', () => {
        for (let y = 2011; y <= parseInt(ULTIMO_MESE_FOI.slice(0, 4), 10); y++) {
            expect(TASSI_LEGALI[y], `tasso legale mancante per il ${y}`).toBeGreaterThan(0);
        }
    });
    it('tassi legali verificati: 2025 = 2,00% (DM 10/12/2024) · 2026 = 1,60% (DM 10/12/2025)', () => {
        expect(TASSI_LEGALI[2025]).toBe(2.0);
        expect(TASSI_LEGALI[2026]).toBe(1.6);
    });
    it('ultimoGiornoDelMese: fine mese corretti, bisestili inclusi', () => {
        expect(ultimoGiornoDelMese('2024-02')).toBe('29/02/2024');
        expect(ultimoGiornoDelMese('2023-02')).toBe('28/02/2023');
        expect(ultimoGiornoDelMese('2024-10')).toBe('31/10/2024');
    });
});

describe('aggregazione dei capitali mensili dalle due serie', () => {
    it('serie A: indennità della fonte per mese di calendario', () => {
        const giornate: GiornataInput[] = [
            { data: '02/01/2024', indennitaFonte: 25.5 },
            { data: '20/01/2024', indennitaFonte: 10 },
            { data: '03/02/2024', indennitaFonte: 7.25 },
            { data: '04/02/2024' },                        // senza indennità → ignorata
            { data: '05/02/2024', indennitaFonte: 0 },     // zero → ignorata
        ];
        expect(capitaliMensiliSerieA(giornate)).toEqual({ '2024-01': 35.5, '2024-02': 7.25 });
    });
    it('serie B: violazioni per mese del giorno-turno (fallback: inizio riposo)', () => {
        const base = { tipo: 'riposo_giornaliero' as const, rifNormativo: '', fine: '', ore: 6, soglia: 11, oreMancanti: 5, valorePieno: 50, gravita: 'lieve' as const, motivo: '', cee: true };
        const violazioni: Violazione[] = [
            { ...base, inizio: '2024-01-31T22:00:00.000Z', indennita: 50, dataTurno: '31/01/2024' },
            // turno a cavallo di mezzanotte: dataTurno resta il giorno del turno (31/01), non il mese dell'inizio riposo
            { ...base, inizio: '2024-02-01T01:00:00.000Z', indennita: 20, dataTurno: '31/01/2024' },
            { ...base, inizio: '2024-02-10T14:00:00.000Z', indennita: 30, dataTurno: undefined }, // fallback su inizio
        ];
        expect(capitaliMensiliSerieB(violazioni)).toEqual({ '2024-01': 70, '2024-02': 30 });
    });
});
