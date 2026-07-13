import { describe, it, expect } from 'vitest';
import { validateEliorScan, TARIFFE_NOTE_ELIOR } from '../utils/eliorScanValidator';

/**
 * Caso reale: Boriglione Francesco, Marzo 2021 (busta pilota del censimento,
 * quadrata a mano al centesimo: Σ competenze = 2.360,67 = TOTALE COMPETENZE).
 */
const boriglioneMar2021 = () => ({
  month: 3,
  year: 2021,
  daysWorked: 26.0,
  daysVacation: 0.0,
  ticketRate: 5.2,
  ggInps: 26,
  totaleRetribuzione: 1912.49,
  totaleCompetenze: 2360.67,
  totaleTrattenute: 476.48,
  netto: 1884.19,
  codes: {
    '1126': 24.2,
    '1130': 153.6,
    '1131': 60.0,
    '4255': 14.0,
    '4256': 11.2,
    '4301': 151.43,
    '1129': 33.75,
  },
  voci: [
    { code: '1000', desc: 'RETRIBUZIONE/STIPENDIO', unit: 73.56, qty: 26.0, competenze: 1912.49 },
    { code: '1126', desc: "INDENNITA' DI CASSA", unit: 2.2, qty: 11.0, competenze: 24.2 },
    { code: '1129', desc: 'IND.TURNO NON CADENZATI', unit: 2.25, qty: 15.0, competenze: 33.75 },
    { code: '1130', desc: 'LAVORO NOTTURNO', unit: 2.4, qty: 64.0, competenze: 153.6 },
    { code: '1131', desc: 'LAVORO DOMENICALE OLTRE 2 HH', unit: 20.0, qty: 3.0, competenze: 60.0 },
    { code: '2000', desc: 'TICKET PERS VIAGGIANTE', unit: 5.2, qty: 12.0, competenze: null },
    { code: '2001', desc: 'TICKET SUPPLEMENTARE PV', unit: 5.2, qty: 4.0, competenze: null },
    { code: '4255', desc: 'IND GIORN PERNOTTAMENTO', unit: 2.8, qty: 5.0, competenze: 14.0 },
    { code: '4256', desc: 'IND. GIORN DI PERNOTTAZIONE', unit: 2.8, qty: 4.0, competenze: 11.2 },
    { code: '4301', desc: 'FUORI SEDE ITA TURNI RFR', unit: 1.0, qty: 151.43, competenze: 151.43 },
    { code: '8320', desc: 'ADD.REG.: RATA A.P.', trattenute: 28.93 },
    { code: '8420', desc: 'ADD.COM.: RATA A.P.', trattenute: 10.59 },
    { code: '8460', desc: 'ADD.COM.: RATA ACCONTO A.C.', trattenute: 3.88 },
    { code: '9300', desc: 'TRATTENUTA SINDACALE', trattenute: 7.0 },
  ],
});

describe('validateEliorScan — busta reale corretta', () => {
  it('passa tutti i controlli senza flag', () => {
    const r = validateEliorScan(boriglioneMar2021());
    expect(r.flags).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats.terneVerificate).toBe(8); // 1000·1126·1129·1130·1131·4255·4256·4301 (2000/2001 senza competenze)
    expect(r.stats.reconDelta).toBe(0);
  });

  it('tollera la terna della riga 1000 (unitario arrotondato: 73,56 × 26 = 1.912,56 vs 1.912,49)', () => {
    const r = validateEliorScan(boriglioneMar2021());
    expect(r.flags.filter(f => f.startsWith('voce 1000'))).toEqual([]);
  });
});

describe('validateEliorScan — errori intercettati', () => {
  it('terna rotta: competenze non coerente con unit × qty', () => {
    const b = boriglioneMar2021();
    b.voci[3]!.competenze = 135.6; // 1130: vero 153.60 (cifre scambiate)
    b.codes['1130'] = 135.6;
    const r = validateEliorScan(b);
    expect(r.ok).toBe(false);
    expect(r.flags.some(f => f.startsWith('voce 1130'))).toBe(true);
    expect(r.stats.terneFallite).toBe(1);
  });

  it('voce persa: Σ competenze non quadra col totale stampato', () => {
    const b = boriglioneMar2021();
    b.voci = b.voci.filter(v => v.code !== '4301'); // il classico drop di coda
    delete (b.codes as any)['4301'];
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('totale stampato'))).toBe(true);
  });

  it('totale competenze letto male: lo smaschera il triangolo dei totali', () => {
    const b = boriglioneMar2021();
    b.totaleCompetenze = 2860.67; // 3↔8 su scansione sporca
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('totale stampato'))).toBe(true);
    expect(r.flags.some(f => f.includes('netto'))).toBe(true);
  });

  it('daysWorked incoerente con GG INPS − ferie', () => {
    const b = boriglioneMar2021();
    b.daysVacation = 2.4;
    // daysWorked resta 26 → atteso 23.6
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.startsWith('giorni:'))).toBe(true);
  });

  it('tariffa inattesa su voce a tariffa nota (4301 a 1,30 invece di 1,00)', () => {
    const b = boriglioneMar2021();
    b.voci[9]!.unit = 1.3;
    b.voci[9]!.competenze = 196.86;
    b.codes['4301'] = 196.86;
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('tariffa inattesa'))).toBe(true);
  });

  it('codes incoerente con le righe voce (il modello si contraddice)', () => {
    const b = boriglioneMar2021();
    b.codes['1126'] = 42.2; // le voci dicono 24.20
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('codes[1126]'))).toBe(true);
  });

  it('codes senza riga voce corrispondente', () => {
    const b = boriglioneMar2021();
    (b.codes as any)['4305'] = 33.0;
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('codes[4305]') && f.includes('nessuna riga'))).toBe(true);
  });

  it('range di sanità: GG INPS > 31 e quantità implausibile', () => {
    const b = boriglioneMar2021();
    (b as any).ggInps = 62; // doppia lettura banda
    b.daysWorked = 62;
    b.voci[9]!.qty = 1514.3; // virgola persa
    b.voci[9]!.competenze = 1514.3;
    b.codes['4301'] = 1514.3;
    const r = validateEliorScan(b);
    expect(r.flags.some(f => f.includes('GG INPS fuori range'))).toBe(true);
    expect(r.flags.some(f => f.includes('quantità implausibile'))).toBe(true);
  });
});

describe('validateEliorScan — robustezza input', () => {
  it('senza voci/totali (risposta vecchio formato): nessun flag, nessun crash', () => {
    const r = validateEliorScan({ month: 3, year: 2021, daysWorked: 26, daysVacation: 0, codes: { '1130': 10 } });
    expect(r.ok).toBe(true);
    expect(r.stats.voci).toBe(0);
  });

  it('valori stringa con virgola (formato italiano) parsati correttamente', () => {
    const b: any = boriglioneMar2021();
    b.totaleCompetenze = '2360,67';
    b.voci[1].competenze = '24,20';
    const r = validateEliorScan(b);
    expect(r.ok).toBe(true);
  });

  it('la tabella tariffe copre le voci della vertenza residenza', () => {
    expect(TARIFFE_NOTE_ELIOR['4301']).toEqual([1.0]);
    expect(TARIFFE_NOTE_ELIOR['4300']).toContain(0.75);
    expect(TARIFFE_NOTE_ELIOR['4305']).toContain(2.2);
  });
});
