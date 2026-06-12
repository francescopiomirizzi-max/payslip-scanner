import { describe, it, expect, beforeAll } from 'vitest';
import { Packer } from 'docx';
import { unzipSync, strFromU8 } from 'fflate';
import { buildRelazioneRiposiDoc } from '../utils/riposiRelazione';
import { computeRestViolations, type GiornataInput } from '../utils/restEngine';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// Stessa fixture di riposiPrint: una violazione giornaliera (riposo 6h),
// serie fonte su una giornata, una riga non interpretabile (warning).
const giornate: GiornataInput[] = [
    { data: '30/12/2023', servizio: '63', inizio: '6.00', termine: '14.00' },
    { data: '30/12/2023', servizio: '1063', inizio: '20.00', termine: '23.00' },
    { data: '31/12/2023', servizio: 'R' },
    { data: '02/01/2024', servizio: '63', inizio: '6.00', termine: '14.00', mancatoRipGiorn: '2.30', indennitaFonte: 25.5 },
    { data: '03/01/2024', servizio: '63', inizio: '6.00', termine: '6.99' },
];

const pratica: PraticaRiposi = {
    id: 'test',
    nome: 'Tommaso',
    cognome: 'Viterbo',
    mansione: 'Operatore di esercizio (TPL)',
    periodoStart: '30/12/2023',
    periodoEnd: '03/01/2024',
    tariffaOraria: 10.03,
    fonteTariffa: 'placeholder — da confermare con l\'avvocato',
    giornate,
};

describe('buildRelazioneRiposiDoc (docx vero, ispezionato via unzip)', () => {
    let xml = '';

    beforeAll(async () => {
        const result = computeRestViolations(giornate, { tariffaOraria: pratica.tariffaOraria });
        const buffer = await Packer.toBuffer(buildRelazioneRiposiDoc(pratica, result));
        const files = unzipSync(new Uint8Array(buffer));
        // .docx vero: deve essere uno zip OOXML con il document.xml
        expect(Object.keys(files)).toContain('word/document.xml');
        xml = strFromU8(files['word/document.xml']);
    });

    it('intestazione e dati pratica', () => {
        expect(xml).toContain('Relazione tecnica — Mancati riposi giornalieri e settimanali');
        expect(xml).toContain('Viterbo Tommaso');
        expect(xml).toContain('Operatore di esercizio (TPL)');
        expect(xml).toContain('€ 10,03/h');
    });

    it('quadro normativo con i riferimenti del vademecum', () => {
        expect(xml).toContain('Reg. (CE) n. 561/2006');
        expect(xml).toContain('D.Lgs. n. 234/2007');
        expect(xml).toContain('Reg. (UE) 2016/403');
    });

    it('metodo: parser deterministico e policy segnala-non-indovinare', () => {
        expect(xml).toContain('parser deterministico');
        expect(xml).toContain('quadrano al centesimo');
    });

    it('due serie affiancate, non sommabili', () => {
        expect(xml).toContain('non si sommano');
        expect(xml).toContain('€ 25,50');                       // serie A (fonte)
        expect(xml).toContain('motore Reg. 561/2006');           // serie B
        expect(xml).toContain('Riepilogo per anno');
    });

    it('elenco violazioni e riserve (pausa art. 7, tariffa, warnings)', () => {
        expect(xml).toContain('Elenco delle violazioni rilevate');
        expect(xml).toContain('Riposo inferiore al minimo ridotto (9h)');
        expect(xml).toContain('Pausa di guida (art. 7)');
        expect(xml).toContain('Righe da verificare a mano (1)');
        expect(xml).toContain('orario non interpretabile');
    });
});
