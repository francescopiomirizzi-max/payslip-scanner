import { describe, it, expect } from 'vitest';
import { parseMonthFromFilename } from '../constants';

// parseMonthFromFilename ricava mese (0-11) e anno dal nome del file. Alimenta il badge
// del visore e la sincronizzazione visore → tabella: è il punto critico della feature.

describe('parseMonthFromFilename', () => {
  it('nome mese esteso + anno — "Aprile 2008.PDF"', () => {
    expect(parseMonthFromFilename('Aprile 2008.PDF')).toEqual({ monthIndex: 3, year: 2008 });
  });

  it('riconosce i mesi in modo case-insensitive', () => {
    expect(parseMonthFromFilename('gennaio 2010.pdf')).toEqual({ monthIndex: 0, year: 2010 });
    expect(parseMonthFromFilename('DICEMBRE 2009.pdf')).toEqual({ monthIndex: 11, year: 2009 });
  });

  it('mese numerico 01-12 quando manca il nome esteso', () => {
    expect(parseMonthFromFilename('04-2008.pdf')).toEqual({ monthIndex: 3, year: 2008 });
    expect(parseMonthFromFilename('2015_12 cedolino.pdf')).toEqual({ monthIndex: 11, year: 2015 });
  });

  it('non scambia le cifre dell\'anno per il mese', () => {
    // "2008" non deve produrre un mese: senza un mese reale nel nome → null
    expect(parseMonthFromFilename('cedolino 2008.pdf')).toBeNull();
  });

  it('mese presente ma anno assente → year null', () => {
    expect(parseMonthFromFilename('Maggio.pdf')).toEqual({ monthIndex: 4, year: null });
  });

  it('nome senza mese → null', () => {
    expect(parseMonthFromFilename('busta paga scansione.pdf')).toBeNull();
  });

  it('input vuoto / assente → null', () => {
    expect(parseMonthFromFilename('')).toBeNull();
    expect(parseMonthFromFilename(undefined)).toBeNull();
    expect(parseMonthFromFilename(null)).toBeNull();
  });
});
