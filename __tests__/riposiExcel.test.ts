import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { buildRiposiWorkbook } from '../utils/riposiExcel';
import { computeRestViolations, type GiornataInput } from '../utils/restEngine';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// Stessa fixture degli altri export: violazione giornaliera (riposo 6h) nel 2023,
// serie fonte su una giornata del 2024, una riga non interpretabile.
const giornate: GiornataInput[] = [
    { data: '30/12/2023', gset: 'Sab', servizio: '63', inizio: '6.00', termine: '14.00' },
    { data: '30/12/2023', gset: 'Sab', servizio: '1063', inizio: '20.00', termine: '23.00' },
    { data: '31/12/2023', gset: 'Dom', servizio: 'R' },
    { data: '02/01/2024', gset: 'Mar', servizio: '63', inizio: '6.00', termine: '14.00', mancatoRipGiorn: '2.30', indennitaFonte: 25.5 },
    { data: '03/01/2024', gset: 'Mer', servizio: '63', inizio: '6.00', termine: '6.99' },
];

const pratica: PraticaRiposi = {
    id: 'test',
    nome: 'Tommaso',
    cognome: 'Viterbo',
    mansione: 'Operatore di esercizio (TPL)',
    periodoStart: '30/12/2023',
    periodoEnd: '03/01/2024',
    tariffaOraria: 10.03,
    stato: 'in_corso',
    giornate,
};

describe('buildRiposiWorkbook (riletto con exceljs dopo writeBuffer)', () => {
    let wb: ExcelJS.Workbook;
    const result = computeRestViolations(giornate, { tariffaOraria: pratica.tariffaOraria });

    beforeAll(async () => {
        const buffer = await buildRiposiWorkbook(pratica, result).xlsx.writeBuffer();
        wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
    });

    it('struttura: Riepilogo + Violazioni + un foglio per anno', () => {
        const names = wb.worksheets.map((w) => w.name);
        expect(names[0]).toBe('Riepilogo');
        expect(names).toContain('Violazioni');
        expect(names).toContain('2023');
        expect(names).toContain('2024');
    });

    it('tariffa per anno: blocco con celle €/h modificabili (numeri veri)', () => {
        const rie = wb.getWorksheet('Riepilogo')!;
        expect(rie.getCell('A9').value).toBe('Anno');   // intestazione blocco tariffe
        expect(rie.getCell('B9').value).toBe('€/h');
        expect(rie.getCell('A10').value).toBe(2023);    // unico anno con violazione
        expect(rie.getCell('B10').value).toBe(10.03);   // tariffa €/h del 2023
    });

    it('coefficiente danno: cella modificabile (default 1 = valore pieno)', () => {
        // blocco tariffe 1 riga → TAR_LAST=10, coefficiente a TAR_LAST+2 = riga 12
        const cell = wb.getWorksheet('Riepilogo')!.getCell('B12');
        expect(cell.value).toBe(1);
    });

    it('violazioni: ore come numeri, tariffa via VLOOKUP, indennità = mancante×tariffa×coeff', () => {
        const vio = wb.getWorksheet('Violazioni')!;
        const r = vio.getRow(2); // unica violazione (riposo 6h del 30/12/2023)
        expect(r.getCell(1).value).toBe(2023);
        expect(r.getCell(4).value).toBe('Giornaliero');
        expect(r.getCell(5).value).toBe(6);          // ore fruite: numero, non testo
        expect(r.getCell(6).value).toBe(5);          // mancanti rispetto a 11h
        // colonna Tariffa €/h: VLOOKUP dell'anno nel blocco tariffe
        const tar = r.getCell(7).value as ExcelJS.CellFormulaValue;
        expect(String(tar.formula)).toContain('VLOOKUP');
        expect(tar.result).toBeCloseTo(10.03, 2);
        // colonna Indennità: mancante (F) × tariffa (G) × coefficiente danno
        const ind = r.getCell(8).value as ExcelJS.CellFormulaValue;
        expect(String(ind.formula)).toContain('F2*G2*');
        expect(ind.result).toBeCloseTo(50.15, 2);
    });

    it('foglio anno: data come data Excel, orari come orari, fonte numerica', () => {
        const ws24 = wb.getWorksheet('2024')!;
        const r = ws24.getRow(2); // 02/01/2024
        expect(r.getCell(1).value).toBeInstanceOf(Date);
        expect((r.getCell(1).value as Date).getUTCDate()).toBe(2);
        expect(r.getCell(5).value).toBeInstanceOf(Date);   // inizio 6.00 → orario Excel
        expect(r.getCell(7).value).toBe(2.5);              // mancato rip. fonte '2.30' h.mm → 2,5 ore
        expect(r.getCell(9).value).toBe(25.5);             // indennità fonte: numero
        // riga col termine non interpretabile: resta il testo grezzo, mai inventato
        const r2 = ws24.getRow(3);
        expect(r2.getCell(6).value).toBe('6.99');
    });

    it('riepilogo per anno: conteggi e totali con formule vive', () => {
        const rie = wb.getWorksheet('Riepilogo')!;
        // 1 anno tariffe → TAR_LAST=10, coeff=12, header riepilogo = 15, dati da 16
        const row2023 = rie.getRow(16);
        expect(row2023.getCell(1).value).toBe(2023);
        const g = row2023.getCell(2).value as ExcelJS.CellFormulaValue;
        expect(String(g.formula)).toContain('COUNTIFS');
        const euroMotore = row2023.getCell(5).value as ExcelJS.CellFormulaValue;
        expect(String(euroMotore.formula)).toContain('SUMIFS');   // somma indennità per anno
        expect(String(euroMotore.formula)).toContain('Violazioni');
        const fonte2024 = rie.getRow(17).getCell(6).value as ExcelJS.CellFormulaValue;
        expect(String(fonte2024.formula)).toContain("'2024'!");
    });
});
