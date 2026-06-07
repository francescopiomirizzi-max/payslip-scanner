import { describe, it, expect } from 'vitest';
import {
  parseHmm,
  parseDateTime,
  durationHours,
  classifyWeeklyRest,
  classifyDailyRest,
  applyTwoWeekRule,
  computeRestViolations,
  formatHm,
  type Riposo,
  type RestParams,
  type GiornataInput,
} from '../utils/restEngine';

const P: RestParams = { tariffaOraria: 10, fonteTariffa: 'test' };

// ─── parseHmm: il formato h.mm che rompeva l'Excel ────────────────────────────

describe('parseHmm (formato h.mm, non decimale)', () => {
  it('interpreta i minuti, non i decimali', () => {
    expect(parseHmm('6.15')).toBe(6 * 60 + 15);   // 375
    expect(parseHmm('38.50')).toBe(38 * 60 + 50);  // 2330
    expect(parseHmm('15.15')).toBe(15 * 60 + 15);  // 915
    expect(parseHmm('13.30')).toBe(13 * 60 + 30);  // 810
  });
  it('gestisce la virgola e gli interi (la cella "45,00" dell\'Excel)', () => {
    expect(parseHmm('45,00')).toBe(45 * 60);       // 2700
    expect(parseHmm('45')).toBe(45 * 60);          // 2700
  });
  it('rifiuta i minuti impossibili e i vuoti (segnala, non indovinare)', () => {
    expect(parseHmm('6.75')).toBeNaN();            // 75 > 59 → non è h.mm
    expect(parseHmm('')).toBeNaN();
    expect(parseHmm(null)).toBeNaN();
    expect(parseHmm('abc')).toBeNaN();
  });
});

// ─── Durata riposi: i 4 valori del vademecum ──────────────────────────────────

describe('durationHours sui riposi del vademecum', () => {
  const cases: Array<[string, string, string, string, string]> = [
    // [d1, h1, d2, h2, atteso formattato]
    ['03/06/2023', '15.50', '05/06/2023', '05.40', '37h50'],
    ['10/06/2023', '14.25', '12/06/2023', '05.20', '38h55'],
    ['05/08/2023', '20.05', '07/08/2023', '15.30', '43h25'],
    ['12/08/2023', '15.20', '14/08/2023', '05.20', '38h00'],
  ];
  it.each(cases)('%s %s → %s %s = %s', (d1, h1, d2, h2, atteso) => {
    const ore = durationHours(parseDateTime(d1, h1), parseDateTime(d2, h2));
    expect(formatHm(ore)).toBe(`${atteso}'`);
  });
});

// ─── Classificazione ──────────────────────────────────────────────────────────

describe('classificazione riposi', () => {
  it('settimanale: ≥45 regolare, 24–45 ridotto, <24 insufficiente', () => {
    expect(classifyWeeklyRest(45, P)).toBe('regolare');
    expect(classifyWeeklyRest(38.9, P)).toBe('ridotto');
    expect(classifyWeeklyRest(20, P)).toBe('insufficiente');
  });
  it('giornaliero: ≥11 regolare, 9–11 ridotto, <9 insufficiente', () => {
    expect(classifyDailyRest(11, P)).toBe('regolare');
    expect(classifyDailyRest(9.5, P)).toBe('ridotto');
    expect(classifyDailyRest(6, P)).toBe('insufficiente');
  });
});

// ─── Regola due settimane (art. 8 §6): i casi del vademecum ────────────────────

function riposoSettimanale(d1: string, h1: string, d2: string, h2: string): Riposo {
  const inizio = parseDateTime(d1, h1);
  const fine = parseDateTime(d2, h2);
  const ore = durationHours(inizio, fine);
  return { inizio, fine, ore, esito: classifyWeeklyRest(ore, P) };
}

describe('applyTwoWeekRule', () => {
  it('Esempio 1 (29 mag–11 giu): il 2° ridotto consecutivo è illecito', () => {
    const riposi = [
      riposoSettimanale('03/06/2023', '15.50', '05/06/2023', '05.40'), // 37h50 ridotto lecito
      riposoSettimanale('10/06/2023', '14.25', '12/06/2023', '05.20'), // 38h55 ridotto illecito
    ];
    const v = applyTwoWeekRule(riposi, P);
    expect(v).toHaveLength(1);
    expect(v[0].tipo).toBe('riposo_settimanale');
    expect(v[0].gravita).toBe('grave');            // 38h55 < 40h30 (45 − 10%)
    expect(v[0].oreMancanti).toBeCloseTo(6.08, 2); // 45 − 38h55
    expect(v[0].rifNormativo).toContain('art. 8 §6');
  });

  it('Esempio 2 (30 lug–13 ago): stesso schema, 2° ridotto illecito', () => {
    const riposi = [
      riposoSettimanale('05/08/2023', '20.05', '07/08/2023', '15.30'), // 43h25 ridotto lecito
      riposoSettimanale('12/08/2023', '15.20', '14/08/2023', '05.20'), // 38h00 ridotto illecito
    ];
    const v = applyTwoWeekRule(riposi, P);
    expect(v).toHaveLength(1);
    expect(v[0].gravita).toBe('grave');
    expect(v[0].oreMancanti).toBeCloseTo(7.0, 2);  // 45 − 38h00
  });

  it('un riposo regolare tra due ridotti azzera la violazione', () => {
    const riposi = [
      riposoSettimanale('03/06/2023', '15.50', '05/06/2023', '05.40'), // ridotto
      { inizio: new Date(2023, 5, 12), fine: new Date(2023, 5, 14, 1), ore: 49, esito: 'regolare' as const },
      riposoSettimanale('10/06/2023', '14.25', '12/06/2023', '05.20'), // ridotto, ma preceduto da regolare
    ];
    expect(applyTwoWeekRule(riposi, P)).toHaveLength(0);
  });
});

// ─── Orchestratore su roster sintetico ────────────────────────────────────────

describe('computeRestViolations (roster end-to-end)', () => {
  it('flagga un riposo giornaliero <9h e ignora i giorni di riposo (R)', () => {
    const giornate: GiornataInput[] = [
      { data: '05/01/2024', inizio: '6.00', termine: '14.00' }, // → 16h al prossimo turno: ok
      { data: '06/01/2024', inizio: '6.00', termine: '22.00' },
      { data: '07/01/2024', inizio: '4.00', termine: '12.00' }, // riposo 06/22:00→07/04:00 = 6h: violazione
      { data: '08/01/2024', servizio: 'R' },                    // giorno di riposo: nessun turno
      { data: '09/01/2024', servizio: 'R' },
      { data: '10/01/2024', inizio: '6.00', termine: '14.00' }, // 07/12:00→10/06:00 = 66h: settimanale regolare
    ];
    const r = computeRestViolations(giornate, P);
    expect(r.nViolazioniGiornaliere).toBe(1);
    expect(r.nViolazioniSettimanali).toBe(0);
    const v = r.violazioni[0];
    expect(v.tipo).toBe('riposo_giornaliero');
    expect(v.ore).toBe(6);
    expect(v.oreMancanti).toBe(5);       // 11 − 6
    expect(v.indennita).toBe(50);        // 5h × €10
    expect(v.gravita).toBe('grave');     // <9h
    expect(r.warnings).toHaveLength(0);
  });

  it('consente fino a 3 riposi giornalieri ridotti, flagga il 4°', () => {
    // turni alle 06:00–20:00 con ripresa alle 06:00: riposo 10h (ridotto 9–11) per 4 volte
    const giornate: GiornataInput[] = [];
    for (let d = 1; d <= 6; d++) {
      giornate.push({ data: `0${d}/04/2024`, inizio: '6.00', termine: '20.00' });
    }
    // riposi tra turni consecutivi: 20:00→06:00 = 10h (ridotto). 5 riposi in fila.
    const r = computeRestViolations(giornate, P);
    expect(r.nRidottiGiornalieriLeciti).toBe(3);     // i primi 3 leciti
    expect(r.nViolazioniGiornaliere).toBe(2);        // il 4° e 5° oltre il cap
  });

  it('segnala (non indovina) gli orari illeggibili', () => {
    const giornate: GiornataInput[] = [
      { data: '05/01/2024', inizio: '6.75', termine: '14.00' }, // 6.75 non è h.mm
    ];
    const r = computeRestViolations(giornate, P);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.violazioni).toHaveLength(0);
  });
});
