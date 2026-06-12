import { describe, it, expect } from 'vitest';
import { buildConteggiRiposiHtml } from '../utils/riposiPrint';
import { computeRestViolations, computeSerieFonte, type GiornataInput } from '../utils/restEngine';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// Fixture: 4 turni su due anni con un riposo giornaliero insufficiente (6h)
// tra i primi due e la serie della fonte valorizzata su una giornata.
const giornate: GiornataInput[] = [
    { data: '30/12/2023', servizio: '63', inizio: '6.00', termine: '14.00' },
    { data: '30/12/2023', servizio: '1063', inizio: '20.00', termine: '23.00' }, // riposo 14–20 = 6h → violazione
    { data: '31/12/2023', servizio: 'R' },
    { data: '02/01/2024', servizio: '63', inizio: '6.00', termine: '14.00', mancatoRipGiorn: '2.30', indennitaFonte: 25.5 },
    // termine non interpretabile E con markup: finisce nei warnings → va escapato
    { data: '03/01/2024', servizio: '63', inizio: '6.00', termine: '<boh>' },
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

describe('buildConteggiRiposiHtml', () => {
    const result = computeRestViolations(giornate, { tariffaOraria: pratica.tariffaOraria });
    const html = buildConteggiRiposiHtml(pratica, result);

    it('intestazione pratica: nominativo, periodo, tariffa con fonte', () => {
        expect(html).toContain('<strong>Viterbo Tommaso</strong>');
        expect(html).toContain('30/12/2023 – 03/01/2024');
        expect(html).toContain('€ 10,03/h');
        expect(html).toContain('placeholder — da confermare con l\'avvocato');
    });

    it('le due serie affiancate con l\'avvertenza di non sommabilità', () => {
        const fonte = computeSerieFonte(giornate);
        expect(fonte.ind).toBe(25.5);
        expect(html).toContain('Indennità secondo il documento sorgente');
        expect(html).toContain('€ 25,50');
        expect(html).toContain('Indennità secondo il motore (Reg. 561/2006)');
        expect(html).toContain('NON si sommano');
    });

    it('riepilogo per anno: entrambe le serie, anni anche solo-fonte', () => {
        // 2023 ha la violazione del motore, 2024 ha solo l'indennità fonte:
        // entrambe le righe devono esserci.
        expect(html).toMatch(/<td>2023<\/td>/);
        expect(html).toMatch(/<td>2024<\/td>/);
        expect(html).toContain('<tr class="totale">');
    });

    it('elenco violazioni con riferimenti normativi e causale', () => {
        expect(result.violazioni.length).toBeGreaterThan(0);
        expect(html).toContain('Reg. (CE) n. 561/2006, art. 8 §§2,4');
        expect(html).toContain('Reg. (CE) n. 561/2006, art. 8 §6');
        expect(html).toContain('inferiore al minimo ridotto (9h)');
        expect(html).toContain('class="anno"');
    });

    it('nota metodologica e perimetro (pausa art. 7 esclusa)', () => {
        expect(html).toContain('Nota metodologica');
        expect(html).toContain('parser deterministico');
        expect(html).toContain('art. 7');
    });

    it('righe da verificare nel documento, con escape HTML', () => {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(html).toContain('Righe da verificare a mano');
        expect(html).toContain('&lt;boh&gt;');
        expect(html).not.toContain('"<boh>"');
    });
});
