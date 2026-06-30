import { describe, it, expect } from 'vitest';
import {
    computeVertenza,
    annoMinimoNonPrescritto,
    type VoceVertenza,
} from '../utils/vertenzaEngine';

const v4300 = (righe: { anno: string; importoPagato: number }[]): VoceVertenza => ({
    codice: '4300', label: 'Ass. Res. No RS', tariffaPagata: 0.75, tariffaDovuta: 1.30, righe,
});
const v4305 = (righe: { anno: string; importoPagato: number }[]): VoceVertenza => ({
    codice: '4305', label: 'Ass. Res. RS', tariffaPagata: 1.00, tariffaDovuta: 2.20, righe,
});

describe('vertenzaEngine · nucleo differenziale', () => {
    it('una voce: ore = importo/tariffaPagata, dovuto = ore×tariffaDovuta, differenza = dovuto−pagato', () => {
        const r = computeVertenza([v4300([{ anno: '2019', importoPagato: 150 }])]);
        const voce = r.perVoce[0];
        expect(voce.ore).toBe(200);        // 150 / 0,75
        expect(voce.pagato).toBe(150);
        expect(voce.dovuto).toBe(260);     // 200 × 1,30
        expect(voce.differenza).toBe(110); // 260 − 150
        expect(r.totDifferenza).toBe(110);
        expect(r.totCredito).toBe(110);    // niente rivalutazione/interessi
    });

    it('due voci: il prospetto per anno aggrega entrambe', () => {
        const r = computeVertenza([
            v4300([{ anno: '2019', importoPagato: 150 }]),
            v4305([{ anno: '2019', importoPagato: 100 }]),
        ]);
        expect(r.perAnno).toHaveLength(1);
        const a = r.perAnno[0];
        expect(a.anno).toBe('2019');
        expect(a.pagato).toBe(250);        // 150 + 100
        expect(a.dovuto).toBe(480);        // 260 + 220
        expect(a.differenza).toBe(230);    // 480 − 250
        expect(r.totCredito).toBe(230);
    });

    it('coefficiente danno (0.20) scala la differenza, non il pagato/dovuto lordi', () => {
        const r = computeVertenza(
            [v4300([{ anno: '2019', importoPagato: 150 }]), v4305([{ anno: '2019', importoPagato: 100 }])],
            undefined,
            { coefficiente: 0.20 },
        );
        expect(r.perVoce[0].differenza).toBe(22);  // 110 × 0,20
        expect(r.perVoce[1].differenza).toBe(24);  // 120 × 0,20
        expect(r.perAnno[0].pagato).toBe(250);     // lordi invariati
        expect(r.perAnno[0].dovuto).toBe(480);
        expect(r.totCredito).toBe(46);             // 230 × 0,20
    });

    it('rivalutazione e interessi iniettati entrano nel totale per anno', () => {
        const r = computeVertenza(
            [v4300([{ anno: '2019', importoPagato: 150 }]), v4305([{ anno: '2019', importoPagato: 100 }])],
            undefined,
            { rivaluta: (imp) => imp * 0.10, interessi: (imp) => imp * 0.05 },
        );
        const a = r.perAnno[0];
        expect(a.differenza).toBe(230);
        expect(a.rivalutazione).toBe(23);   // 230 × 0,10
        expect(a.interessi).toBe(11.5);     // 230 × 0,05
        expect(a.totale).toBe(264.5);
        expect(r.totCredito).toBe(264.5);
    });
});

describe('vertenzaEngine · prescrizione', () => {
    it('anno minimo non prescritto = cutoff − anni, arretrato dall\'interruzione utile più vecchia', () => {
        expect(annoMinimoNonPrescritto({ cutoff: '01/01/2024', anni: 5 })).toBe(2019);
        expect(annoMinimoNonPrescritto({
            cutoff: '01/01/2024', anni: 5,
            interruzioni: [{ data: '12/02/2018' }],
        })).toBe(2013); // 2018 − 5
        expect(annoMinimoNonPrescritto(undefined)).toBeNull();
    });

    it('le righe prescritte sono escluse dai totali', () => {
        const voci = [v4300([
            { anno: '2017', importoPagato: 75 },   // prescritto (sotto al limite)
            { anno: '2019', importoPagato: 150 },  // ammesso
        ])];
        const r = computeVertenza(voci, { cutoff: '01/01/2024', anni: 5 }); // limite 2019
        expect(r.perAnno).toHaveLength(1);
        expect(r.perAnno[0].anno).toBe('2019');
        expect(r.perVoce[0].pagato).toBe(150); // il 2017 non conta
    });

    it('un\'interruzione recupera gli anni altrimenti prescritti', () => {
        const voci = [v4300([{ anno: '2017', importoPagato: 75 }, { anno: '2019', importoPagato: 150 }])];
        const r = computeVertenza(voci, {
            cutoff: '01/01/2024', anni: 5,
            interruzioni: [{ data: '12/02/2018' }], // limite arretra a 2013
        });
        expect(r.perAnno).toHaveLength(2);
        expect(r.perVoce[0].pagato).toBe(225); // 75 + 150
    });
});
