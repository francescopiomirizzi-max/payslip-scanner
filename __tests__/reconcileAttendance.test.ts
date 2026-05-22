import { describe, it, expect } from 'vitest';
import { reconcileRailwayAttendance } from '../netlify/functions/scan-payslip';

// reconcileRailwayAttendance ricava daysWorked/daysVacation/daysPaidLeave dall'oggetto
// `attendance` trascritto dall'IA, correggendo lo slittamento di colonna (Riposi scambiati
// per giorni lavorati quando la cella "Presenze" è vuota).
//
// Ogni `attendance` qui sotto è OUTPUT REALE di Gemini su un cedolino reale (8 buste paga:
// 4 Trenitalia CATANEO PASQUALE + 4 RFI). Sono test bloccanti: il fix deve reggere sui dati
// veri, non su ipotesi.

const j = (month: number, year: number, attendance: any, codes: any = {}, extra: any = {}): any => ({
  month, year, codes, attendance, ...extra,
});

describe('reconcileRailwayAttendance — 8 cedolini reali (Trenitalia + RFI)', () => {
  it('Maggio 2008 (T) — BUG: cella Presenze vuota → daysWorked azzerato', () => {
    const x = j(5, 2008, {
      presenze: 11, riposi: 6, ferie: 2, ptv26: 0, malattie: null, infortuni: null,
      assenzeRetribuite: 18, assenzeNonRetribuite: 0, ferieAnnoPrec: 15, ferieAnnoCorrente: 24,
    }, { '0576': 16 });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(0);   // corretto da 11 (era il valore Riposi)
    expect(x.daysVacation).toBe(2);
    expect(x.daysPaidLeave).toBe(18);
    expect(x.aiWarning).toContain('corretti automaticamente');
  });

  it('Luglio 2009 (T) — mese lavorato parziale (Presenze=8): nessun falso positivo', () => {
    const x = j(7, 2009, {
      presenze: 8, riposi: 8, ferie: 7, ptv26: 0, malattie: 8, infortuni: 0,
      assenzeRetribuite: 0, assenzeNonRetribuite: 0, ferieAnnoPrec: 7.5, ferieAnnoCorrente: 15,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(8);
    expect(x.daysVacation).toBe(7);
    expect(x.daysPaidLeave).toBe(0);
  });

  it('Novembre 2009 (T) — conguaglio multi-mese (Presenze=44): niente azzeramento', () => {
    const x = j(11, 2009, {
      presenze: 44, riposi: 17, ferie: 0, ptv26: null, malattie: null, infortuni: null,
      assenzeRetribuite: null, assenzeNonRetribuite: 0, ferieAnnoPrec: null, ferieAnnoCorrente: 7.5,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(44);
    expect(x.daysVacation).toBe(0);
  });

  it('Marzo 2010 (T) — Presenze=18.5, riga somma 28<31: nessun falso positivo', () => {
    const x = j(3, 2010, {
      presenze: 18.5, riposi: 8, ferie: 0.5, ptv26: 0, malattie: null, infortuni: null,
      assenzeRetribuite: 1, assenzeNonRetribuite: 0, ferieAnnoPrec: 5.5, ferieAnnoCorrente: 24.5,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(18.5);
    expect(x.daysVacation).toBe(0.5);
    expect(x.daysPaidLeave).toBe(1);
  });

  it('Febbraio 2012 (RFI) — Presenze=20, riga somma 31 > 29 gg di febbraio', () => {
    const x = j(2, 2012, {
      presenze: 20, riposi: 8, ferie: 3, ptv26: 0, malattie: null, infortuni: null,
      assenzeRetribuite: null, assenzeNonRetribuite: 0, ferieAnnoPrec: 1, ferieAnnoCorrente: 22,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(20);  // NON azzerato benché la riga superi i giorni reali
    expect(x.daysVacation).toBe(3);
  });

  it('Giugno 2021 (RFI) — Presenze=10 con riposi=null reale: nessun falso positivo', () => {
    const x = j(6, 2021, {
      presenze: 10, riposi: null, ferie: 0, ptv26: null, malattie: null, infortuni: null,
      assenzeRetribuite: 21, assenzeNonRetribuite: 0, ferieAnnoPrec: 14, ferieAnnoCorrente: 25,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(10);  // riposi null NON deve far scattare la correzione
    expect(x.daysVacation).toBe(0);
    expect(x.daysPaidLeave).toBe(21);
  });

  it('Giugno 2018 (RFI) — Presenze=1 (mese quasi a zero, valore reale)', () => {
    const x = j(6, 2018, {
      presenze: 1, riposi: 8, ferie: 0, ptv26: null, malattie: null, infortuni: null,
      assenzeRetribuite: 18, assenzeNonRetribuite: 0, ferieAnnoPrec: 10, ferieAnnoCorrente: 25,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(1);
    expect(x.daysVacation).toBe(0);
  });

  it('Giugno 2009 (RFI) — conguaglio differimento (riga somma 57): Presenze=18 intatto', () => {
    const x = j(6, 2009, {
      presenze: 18, riposi: 13, ferie: 1, ptv26: 0, malattie: null, infortuni: null,
      assenzeRetribuite: 17, assenzeNonRetribuite: 8, ferieAnnoPrec: null, ferieAnnoCorrente: 23,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(18);  // conguaglio reale, NON azzerato
    expect(x.daysVacation).toBe(1);
  });
});

describe('reconcileRailwayAttendance — robustezza', () => {
  it('lettura GIÀ corretta dall\'IA (presenze=null) → daysWorked resta 0', () => {
    const x = j(5, 2008, {
      presenze: null, riposi: 11, ferie: 2, ptv26: 0, malattie: null, infortuni: null,
      assenzeRetribuite: 18, assenzeNonRetribuite: 0, ferieAnnoPrec: 15, ferieAnnoCorrente: 24,
    });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(0);
    expect(x.daysVacation).toBe(2);
    expect(x.daysPaidLeave).toBe(18);
  });

  it('attendance mancante → fallback prudente a 0 senza eccezioni', () => {
    const x: any = { month: 5, year: 2008, codes: {} };
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(0);
    expect(x.daysVacation).toBe(0);
    expect(x.daysPaidLeave).toBe(0);
  });
});

describe('reconcileRailwayAttendance — segnale presenzeVuota (Aprile 2008, caso reale)', () => {
  // Cedolino reale TRENITALIA/CATANEO PASQUALE/2008/Aprile 2008: cella "Presenze" VUOTA,
  // 8 nella colonna Riposi, 21 Assenze retribuite. daysWorked corretto = 0. La riga somma
  // ~29 (sotto la soglia 32.5): la sola rete numerica non la prende → serve presenzeVuota.
  const attendanceAprile2008 = {
    presenze: 8, riposi: null, ferie: null, ptv26: 0, malattie: null, infortuni: null,
    assenzeRetribuite: 21, assenzeNonRetribuite: 0, ferieAnnoPrec: 16, ferieAnnoCorrente: 25,
  };

  it("presenzeVuota=true → daysWorked azzerato (l'8 era il valore Riposi)", () => {
    const x = j(4, 2008, attendanceAprile2008, { '0576': 16.8 }, { presenzeVuota: true });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(0);
    expect(x.daysVacation).toBe(0);
    expect(x.daysPaidLeave).toBe(21);
    expect(x.aiWarning).toContain('corretti automaticamente');
  });

  it('presenzeVuota=false (prompt fallito) → niente errore silenzioso: dubbio segnalato', () => {
    const x = j(4, 2008, attendanceAprile2008, { '0576': 16.8 }, { presenzeVuota: false });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(8);              // valore estratto tenuto, NON sovrascritto
    expect(x.daysPaidLeave).toBe(21);
    expect(x.aiWarning).toContain('verificare'); // il dubbio è esplicitato all'utente
  });

  it('presenzeVuota assente (legacy) → rete: mese implausibilmente pieno → avviso verifica', () => {
    const x = j(4, 2008, attendanceAprile2008, { '0576': 16.8 });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(8);
    expect(x.aiWarning).toContain('verificare');
  });

  it('presenzeVuota=true comanda sul numero: anche con presenze grande → daysWorked 0', () => {
    const x = j(4, 2008, { ...attendanceAprile2008, presenze: 18 }, {}, { presenzeVuota: true });
    reconcileRailwayAttendance(x);
    expect(x.daysWorked).toBe(0);
  });
});
