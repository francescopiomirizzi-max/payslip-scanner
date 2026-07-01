import { describe, it, expect } from 'vitest';
import { computeRiepilogoData } from '../utils/riepilogoReport';
import type { Worker, AnnoDati } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

// 12 mesi con voce fissa 3B01 (Quadro B) e variabile 0152 (Quadro C): B=300/C=100
// → % variabili = 25% ogni mese, quindi anche come media annua e di periodo.
function fullYear(year: number, withFixed: boolean): AnnoDati[] {
  return Array.from({ length: 12 }, (_, i) => ({
    year, monthIndex: i, daysWorked: 20, daysVacation: 1, ticket: 0,
    '0152': 100, ...(withFixed ? { '3B01': 300 } : {}),
  }));
}

function makeWorker(profilo: Worker['profilo'], anni: AnnoDati[]): Worker {
  return {
    id: 'w1', nome: 'Mario', cognome: 'Rossi', ruolo: 'Tecnico',
    profilo, anni,
  } as Worker;
}

// ─── computeRiepilogoData — incidenza ───────────────────────────────────────

describe('computeRiepilogoData — incidenza %', () => {
  it('RFI con voci fisse: incidenza valorizzata e coerente (25% variabili)', () => {
    const worker = makeWorker('RFI', [...fullYear(2023, true), ...fullYear(2024, true)]);
    const { tableData, incidenza } = computeRiepilogoData(worker, undefined, 2024, false, false);

    expect(incidenza).not.toBeNull();
    // L'anno di riferimento (2023) resta fuori dal prospetto ma compare nelle %.
    expect(tableData.map(r => r.anno)).toEqual([2024]);
    expect(incidenza!.rows.map(r => r.anno)).toEqual([2023, 2024]);
    expect(incidenza!.rows.find(r => r.anno === 2023)!.isReferenceYear).toBe(true);

    for (const r of incidenza!.rows) {
      expect(r.pctVariabile).toBeCloseTo(25, 5);
      expect(r.pctFissa).toBeCloseTo(75, 5);
    }
    expect(incidenza!.period.pctVariabile).toBeCloseTo(25, 5);
    expect(incidenza!.period.pctFissa).toBeCloseTo(75, 5);
  });

  it('RFI senza Quadro B compilato: incidenza null (niente sezione nel report)', () => {
    const worker = makeWorker('RFI', [...fullYear(2023, false), ...fullYear(2024, false)]);
    const { incidenza } = computeRiepilogoData(worker, undefined, 2024, false, false);
    expect(incidenza).toBeNull();
  });

  it('profilo senza voci fisse definite (ELIOR): incidenza null', () => {
    const anni: AnnoDati[] = Array.from({ length: 12 }, (_, i) => ({
      year: 2024, monthIndex: i, daysWorked: 20, daysVacation: 1, ticket: 0, '1130': 100,
    }));
    const worker = makeWorker('ELIOR', anni);
    const { incidenza } = computeRiepilogoData(worker, undefined, 2024, false, false);
    expect(incidenza).toBeNull();
  });

  it('start spostato avanti: solo il vero N-1 è marcato "(Rif.)", non i mozziconi (caso Borriello)', () => {
    // 2022 = anno-mozzicone: una busta con sola voce fissa, 0 giorni lavorati
    // (come il 2019 di Borriello). 2023 = N-1 pieno. 2024 = primo anno di ricorso.
    const stub2022: AnnoDati[] = [
      { year: 2022, monthIndex: 0, daysWorked: 0, daysVacation: 0, ticket: 0, '3B01': 300 } as AnnoDati,
    ];
    const worker = makeWorker('RFI', [...stub2022, ...fullYear(2023, true), ...fullYear(2024, true)]);
    const { tableData, incidenza } = computeRiepilogoData(worker, undefined, 2024, false, false);

    expect(incidenza).not.toBeNull();
    // Il mozzicone 2022 NON compare: tra i riferimenti resta solo il vero N-1 (2023).
    expect(incidenza!.rows.map(r => r.anno)).toEqual([2023, 2024]);
    const refRows = incidenza!.rows.filter(r => r.isReferenceYear);
    expect(refRows.map(r => r.anno)).toEqual([2023]);
    // Credito e media di periodo restano intatti (invariati dalla modifica cosmetica).
    expect(tableData.map(r => r.anno)).toEqual([2024]);
    expect(incidenza!.period.pctVariabile).toBeCloseTo(25, 5);
  });

  it("l'incidenza non altera i totali del prospetto", () => {
    const conFisse = computeRiepilogoData(makeWorker('RFI', [...fullYear(2023, true), ...fullYear(2024, true)]), undefined, 2024, false, false);
    const senzaFisse = computeRiepilogoData(makeWorker('RFI', [...fullYear(2023, false), ...fullYear(2024, false)]), undefined, 2024, false, false);
    expect(conFisse.totals.totaleDaPercepire).toBeCloseTo(senzaFisse.totals.totaleDaPercepire, 6);
  });
});
