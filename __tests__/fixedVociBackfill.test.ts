import { describe, it, expect } from 'vitest';
import { mergeFixedVociIntoAnni, FIXED_VOCI_IDS, getFixedVociIds, deriveFixedVociPeriod } from '../utils/fixedVociBackfill';
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

describe('getFixedVociIds — whitelist per profilo', () => {
  it('RFI/Trenitalia = i 10 codici 3B storici', () => {
    expect(getFixedVociIds('RFI').sort()).toEqual([...FIXED_VOCI_IDS].sort());
    expect(getFixedVociIds('TRENITALIA')).toEqual(getFixedVociIds('RFI'));
  });

  it('MERCITALIA = 1000/1001/1025 (1100 totale escluso)', () => {
    expect(getFixedVociIds('MERCITALIA').sort()).toEqual(['1000', '1001', '1025']);
  });

  it('CLEAN_SERVICE = MC01/MC06/MC07/MC10 (MCT totale escluso)', () => {
    expect(getFixedVociIds('CLEAN_SERVICE').sort()).toEqual(['MC01', 'MC06', 'MC07', 'MC10']);
  });

  it('ELIOR = la sola voce base 1000 (magazzino e viaggiante)', () => {
    expect(getFixedVociIds('ELIOR')).toEqual(['1000']);
  });
});

describe('mergeFixedVociIntoAnni — whitelist per profilo', () => {
  it('MERCITALIA: scrive 1000/1001/1025 e ignora il totale 1100 e le variabili', () => {
    const anni = [baseRow({ '1801': 96.0 } as Partial<AnnoDati>)];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '1000': 1630.30, '1001': 107.73, '1025': 25.22, '1100': 1763.25, '1801': 99999,
    }, getFixedVociIds('MERCITALIA'));
    expect(updated).toBe(true);
    expect(out[0]['1000']).toBe(1630.30);
    expect(out[0]['1001']).toBe(107.73);
    expect(out[0]['1025']).toBe(25.22);
    expect(out[0]['1100']).toBeUndefined(); // totale di controllo: mai scritto
    expect(out[0]['1801']).toBe(96.0);      // variabile NON clobberata
  });

  it('CLEAN_SERVICE: scrive solo le MC.. (MCT escluso)', () => {
    const anni = [baseRow()];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      MC01: 1670.92, MC06: 22.0, MC07: 146.04, MC10: 25.63, MCT: 1864.59,
    }, getFixedVociIds('CLEAN_SERVICE'));
    expect(updated).toBe(true);
    expect(out[0]['MC01']).toBe(1670.92);
    expect(out[0]['MC10']).toBe(25.63);
    expect(out[0]['MCT']).toBeUndefined();
  });

  it('ELIOR: scrive solo la base 1000 e ignora totali/variabili', () => {
    const anni = [baseRow({ '1130': 65.86 } as Partial<AnnoDati>)];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '1000': 1707.19, '1130': 99999, '4285': 140.06,
    }, getFixedVociIds('ELIOR'));
    expect(updated).toBe(true);
    expect(out[0]['1000']).toBe(1707.19);
    expect(out[0]['1130']).toBe(65.86);   // variabile NON clobberata
    expect(out[0]['4285']).toBeUndefined(); // 26/MI: NON è fissa, non scritta
  });

  it('senza whitelist esplicita resta il default RFI (retrocompatibilità)', () => {
    const anni = [baseRow()];
    const { anni: out, updated } = mergeFixedVociIntoAnni(anni, 2013, 0, {
      '3B01': 1609.30, MC01: 1670.92, '1000': 1630.30,
    });
    expect(updated).toBe(true);
    expect(out[0]['3B01']).toBe(1609.30);
    expect(out[0]['MC01']).toBeUndefined();
    expect(out[0]['1000']).toBeUndefined();
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

  it('nome file con periodo COMPLETO (mese+anno) → vince il nome, anche contro l\'AI', () => {
    // Politica del batch/audit archivio: il nome curato è verità verificata,
    // la testata AI può sbagliare (es. "elementi variabili riferiti al mese precedente").
    expect(deriveFixedVociPeriod(5, 2020, 'Gennaio 2013.PDF')).toEqual({ year: 2013, monthIdx: 0 });
  });

  it('nome file senza periodo completo → vince l\'AI (foto/nomi non-standard)', () => {
    expect(deriveFixedVociPeriod(5, 2020, 'IMG_4211.jpg')).toEqual({ year: 2020, monthIdx: 4 });
    // solo l'anno nel nome, niente mese testuale: vale il periodo AI
    expect(deriveFixedVociPeriod(5, 2020, 'payslip_2013.pdf')).toEqual({ year: 2020, monthIdx: 4 });
  });

  it('restituisce null se il periodo non è identificabile (niente da indovinare)', () => {
    expect(deriveFixedVociPeriod(0, 0, 'busta_senza_data.pdf')).toBeNull();
    expect(deriveFixedVociPeriod(13, 2019, 'x')).toBeNull(); // mese fuori range e nessun mese nel nome
    expect(deriveFixedVociPeriod(3, 1999, 'x')).toBeNull();  // anno fuori range
  });
});
