// ==========================================
// DATI DEMO — lavoratori e cedolini FINTI
// ==========================================
// Usati SOLO in modalità demo (config/demo.ts → IS_DEMO). Nomi di pura fantasia,
// importi generati da un PRNG deterministico (stabili tra reload → screenshot
// coerenti). Nessun riferimento a persone reali. Coprono i profili principali
// (RFI, TRENITALIA, ELIOR viaggiante/magazzino, CLEAN_SERVICE) con stati misti,
// così la dashboard, le statistiche, le tabelle e la relazione hanno dati veri
// su cui lavorare.

import { Worker, AnnoDati } from '../types';
import { MONTH_NAMES } from '../constants';

// PRNG deterministico (mulberry32): stesso seed → stessa sequenza di importi.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface AnniSpec {
  seed: number;
  fromYear: number;
  toYear: number;
  /** Indennità variabili: importo massimo e probabilità di comparire nel mese. */
  variabili: { code: string; max: number; freq: number }[];
  /** Voci fisse continuative: base mensile (cresce ~1.2%/anno per simulare scatti). */
  fisse: { code: string; base: number }[];
  /** Valore del ticket per giorno lavorato (0 = nessun ticket). */
  ticketDie?: number;
}

function buildAnni(spec: AnniSpec): AnnoDati[] {
  const rnd = mulberry32(spec.seed);
  const anni: AnnoDati[] = [];
  for (let year = spec.fromYear; year <= spec.toYear; year++) {
    for (let m = 0; m < 12; m++) {
      const isAugust = m === 7;
      const daysVacation = isAugust ? 12 + Math.floor(rnd() * 8) : Math.floor(rnd() * 4);
      const daysWorked = Math.max(
        0,
        (isAugust ? 22 : 26) - daysVacation - Math.floor(rnd() * 2)
      );
      const row: AnnoDati = {
        id: `${year}-${m}`,
        year,
        monthIndex: m,
        month: MONTH_NAMES[m],
        daysWorked,
        daysVacation,
        ticket: round2(daysWorked * (spec.ticketDie ?? 0)),
        arretrati: 0,
        note: '',
      };
      for (const v of spec.variabili) {
        row[v.code] = rnd() < v.freq ? round2(rnd() * v.max) : 0;
      }
      const bump = 1 + (year - spec.fromYear) * 0.012;
      for (const f of spec.fisse) {
        row[f.code] = round2(f.base * bump);
      }
      anni.push(row);
    }
  }
  return anni;
}

export const DEMO_WORKERS: Worker[] = [
  {
    id: 'demo-rfi-1',
    nome: 'Mario',
    cognome: 'Rossi',
    ruolo: 'Manovratore',
    profilo: 'RFI',
    status: 'in_corso',
    accentColor: 'blue',
    startClaimYear: 2018,
    dataAssunzione: '12/03/2015',
    anni: buildAnni({
      seed: 101,
      fromYear: 2017,
      toYear: 2024,
      ticketDie: 7,
      variabili: [
        { code: '0152', max: 180, freq: 0.7 },
        { code: '0421', max: 220, freq: 0.6 },
        { code: '0470', max: 90, freq: 0.5 },
        { code: '0482', max: 140, freq: 0.5 },
        { code: '0919', max: 160, freq: 0.4 },
        { code: '0920', max: 130, freq: 0.3 },
      ],
      fisse: [
        { code: '3B01', base: 1320 },
        { code: '3B03', base: 210 },
        { code: '3B05', base: 75 },
        { code: '3B10', base: 160 },
        { code: '3B20', base: 45 },
        { code: '3B30', base: 12 },
        { code: '3B35', base: 16 },
      ],
    }),
  },
  {
    id: 'demo-tren-1',
    nome: 'Giulia',
    cognome: 'Bianchi',
    ruolo: 'Capotreno',
    profilo: 'TRENITALIA',
    status: 'aperta',
    accentColor: 'emerald',
    startClaimYear: 2019,
    dataAssunzione: '01/09/2016',
    anni: buildAnni({
      seed: 202,
      fromYear: 2018,
      toYear: 2024,
      ticketDie: 7.5,
      variabili: [
        { code: '0152', max: 150, freq: 0.6 },
        { code: '0421', max: 260, freq: 0.7 },
        { code: '0470', max: 80, freq: 0.4 },
        { code: '0584', max: 110, freq: 0.4 },
        { code: '0919', max: 140, freq: 0.4 },
      ],
      fisse: [
        { code: '3B01', base: 1380 },
        { code: '3B03', base: 240 },
        { code: '3B05', base: 80 },
        { code: '3B10', base: 170 },
        { code: '3B20', base: 50 },
        { code: '3B30', base: 12 },
        { code: '3B35', base: 16 },
      ],
    }),
  },
  {
    id: 'demo-elior-1',
    nome: 'Luca',
    cognome: 'Verdi',
    ruolo: 'Addetto ristorazione a bordo',
    profilo: 'ELIOR',
    eliorType: 'viaggiante',
    status: 'chiusa',
    accentColor: 'orange',
    startClaimYear: 2018,
    dataAssunzione: '15/06/2014',
    anni: buildAnni({
      seed: 303,
      fromYear: 2017,
      toYear: 2023,
      variabili: [
        { code: '1130', max: 120, freq: 0.7 },
        { code: '1131', max: 90, freq: 0.6 },
        { code: '2018', max: 110, freq: 0.5 },
        { code: '2035', max: 140, freq: 0.4 },
        { code: '4255', max: 70, freq: 0.5 },
      ],
      fisse: [{ code: '1000', base: 1610 }],
    }),
  },
  {
    id: 'demo-elior-2',
    nome: 'Anna',
    cognome: 'Esposito',
    ruolo: 'Magazziniera',
    profilo: 'ELIOR',
    eliorType: 'magazzino',
    status: 'in_corso',
    accentColor: 'violet',
    startClaimYear: 2019,
    dataAssunzione: '03/11/2017',
    anni: buildAnni({
      seed: 404,
      fromYear: 2018,
      toYear: 2024,
      variabili: [
        { code: '1130', max: 100, freq: 0.6 },
        { code: '1131', max: 80, freq: 0.5 },
        { code: '2018', max: 90, freq: 0.5 },
        { code: '2035', max: 120, freq: 0.4 },
        { code: '2313', max: 60, freq: 0.6 },
      ],
      fisse: [{ code: '1000', base: 1540 }],
    }),
  },
  {
    id: 'demo-clean-1',
    nome: 'Marco',
    cognome: 'Ferrari',
    ruolo: 'Addetto pulizie',
    profilo: 'CLEAN_SERVICE',
    status: 'aperta',
    accentColor: 'teal',
    startClaimYear: 2018,
    dataAssunzione: '20/01/2015',
    anni: buildAnni({
      seed: 505,
      fromYear: 2017,
      toYear: 2024,
      variabili: [
        { code: '8037', max: 90, freq: 0.6 },
        { code: '8019', max: 120, freq: 0.4 },
        { code: '8007', max: 100, freq: 0.5 },
        { code: '820', max: 60, freq: 0.6 },
        { code: '565', max: 80, freq: 0.3 },
      ],
      fisse: [
        { code: 'MC01', base: 1210 },
        { code: 'MC06', base: 85 },
        { code: 'MC07', base: 65 },
        { code: 'MC10', base: 100 },
      ],
    }),
  },
];
