import { describe, it, expect } from 'vitest';
import { mergeFixedVociIntoAnni, FIXED_VOCI_IDS, deriveFixedVociPeriod } from '../utils/fixedVociBackfill';
import type { AnnoDati } from '../types';

const baseRow = (over: Partial<AnnoDati> = {}): AnnoDati => ({
  year: 2013, monthIndex: 0, daysWorked: 20, daysVacation: 3, ticket: 7,
  '0152': 540.73, note: 'curato a mano', ...over,
});

describe('mergeFixedVociIntoAnni — merge-safe', () => {
  it('scrive i codici 3B.. sulla riga giusta senza toccare il resto', () => {
    const anni = [baseRow()];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '3B01': 1609.30, '3B05': 40.38, '3B20': 179.46,
    });
    expect(updated).toBe(true);
    expect(out[0]['3B01']).toBe(1609.30);
    expect(out[0]['3B05']).toBe(40.38);
    expect(out[0]['3B20']).toBe(179.46);
    // tutto il resto INTATTO (anti-clobber)
    expect(out[0].daysWorked).toBe(20);
    expect(out[0].daysVacation).toBe(3);
    expect(out[0]['0152']).toBe(540.73);
    expect(out[0].note).toBe('curato a mano');
  });

  it('NON crea righe per mesi inesistenti (no-op)', () => {
    const anni = [baseRow({ monthIndex: 0 })];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 5, { '3B01': 1000 });
    expect(updated).toBe(false);
    expect(out).toHaveLength(1);
  });

  it('ignora chiavi fuori whitelist (non scrive variabili/giorni)', () => {
    const anni = [baseRow()];
    const { anni: out } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '0152': 99999, daysWorked: 1, '3B01': 1609.30,
    } as any);
    expect(out[0]['3B01']).toBe(1609.30);
    expect(out[0]['0152']).toBe(540.73); // NON sovrascritto
    expect(out[0].daysWorked).toBe(20);  // NON sovrascritto
  });

  it('salta gli zeri (uno 0 resta implicito)', () => {
    const anni = [baseRow()];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '3B01': 1609.30, '3B05': 0.0, '3B15': 0,
    });
    expect(updated).toBe(true);
    expect(out[0]['3B01']).toBe(1609.30);
    expect(out[0]['3B05']).toBeUndefined();
    expect(out[0]['3B15']).toBeUndefined();
  });

  it('è idempotente: secondo run senza cambi → updated=false e stesso array', () => {
    const anni = [baseRow()];
    const r1 = mergeFixedVociIntoAnni(anni, 2013, 0, { '3B01': 1609.30 });
    const r2 = mergeFixedVociIntoAnni(r1.anni, 2013, 0, { '3B01': 1609.30 });
    expect(r2.updated).toBe(false);
    expect(r2.anni).toBe(r1.anni); // stesso riferimento (nessuna riscrittura)
  });

  it('non muta l\'array di input (immutabile)', () => {
    const anni = [baseRow()];
    const snapshot = JSON.stringify(anni);
    mergeFixedVociIntoAnni(anni, 2013, 0, { '3B01': 1609.30 });
    expect(JSON.stringify(anni)).toBe(snapshot);
  });

  it('gestisce input invalidi senza crash', () => {
    expect(mergeFixedVociIntoAnni(null as any, 2013, 0, { '3B01': 1 }).updated).toBe(false);
    expect(mergeFixedVociIntoAnni([baseRow()], 2013, 0, null).updated).toBe(false);
    expect(mergeFixedVociIntoAnni([baseRow()], 2013, 0, { '3B01': NaN as any }).updated).toBe(false);
  });

  it('la whitelist copre i 10 codici fissi attesi (3B50 escluso: è variabile)', () => {
    expect([...FIXED_VOCI_IDS].sort()).toEqual(
      ['3B01','3B03','3B05','3B10','3B15','3B20','3B30','3B35','3B70','3B71'].sort()
    );
  });
});

describe('deriveFixedVociPeriod — periodo per buste caricate da file', () => {
  it('usa il periodo letto dall\'AI (month 1-12 + year)', () => {
    expect(deriveFixedVociPeriod(3, 2019, 'qualsiasi.pdf')).toEqual({ year: 2019, monthIdx: 2 });
    expect(deriveFixedVociPeriod(12, 2025, 'x')).toEqual({ year: 2025, monthIdx: 11 });
  });

  it('accetta month/year come stringhe sporche', () => {
    expect(deriveFixedVociPeriod('03', '2017 ', 'x')).toEqual({ year: 2017, monthIdx: 2 });
  });

  it('fallback sul nome del file quando l\'AI non dà il periodo', () => {
    expect(deriveFixedVociPeriod(0, 0, 'Gennaio 2013.PDF')).toEqual({ year: 2013, monthIdx: 0 });
    expect(deriveFixedVociPeriod(null, null, '01_GENNAIO_payslip_2019_2.jpg')).toEqual({ year: 2019, monthIdx: 0 });
    expect(deriveFixedVociPeriod(undefined, undefined, 'Dicembre 2014.PDF')).toEqual({ year: 2014, monthIdx: 11 });
  });

  it('preferisce il periodo AI al nome file se entrambi presenti', () => {
    // AI dice maggio 2020, il nome dice gennaio 2013 → vince l'AI
    expect(deriveFixedVociPeriod(5, 2020, 'Gennaio 2013.PDF')).toEqual({ year: 2020, monthIdx: 4 });
  });

  it('restituisce null se il periodo non è identificabile (niente da indovinare)', () => {
    expect(deriveFixedVociPeriod(0, 0, 'busta_senza_data.pdf')).toBeNull();
    expect(deriveFixedVociPeriod(13, 2019, 'x')).toBeNull(); // mese fuori range e nessun mese nel nome
    expect(deriveFixedVociPeriod(3, 1999, 'x')).toBeNull();  // anno fuori range
  });
});
