// ==========================================
// SCANSIONE SIMULATA — solo modalità demo
// ==========================================
// Restituisce un risultato di estrazione FINTO nello stesso formato prodotto
// dalla pipeline reale (Gemini → scan-payslip): campi top-level + `codes`
// (codice voce → importo). In demo, usePayslipUpload usa questo al posto della
// chiamata di rete, così l'utente vede l'animazione "sto analizzando…" e la
// griglia riempirsi, senza alcuna chiamata ad AI/DB.
//
// I valori RFI coincidono con il cedolino-esempio in public/demo/ (coerenza:
// se l'interlocutore confronta PDF e dati estratti, tornano). Gli altri profili
// hanno set plausibili così la scansione funziona su qualsiasi lavoratore demo.

import { Worker } from '../types';

export interface DemoExtraction {
  month: string;
  year: number;
  daysWorked: number;
  daysVacation: number;
  ticketRate?: number;
  aiWarning: string;
  codes: Record<string, number>;
}

const RFI: DemoExtraction = {
  month: 'Marzo',
  year: 2023,
  daysWorked: 22,
  daysVacation: 0,
  ticketRate: 7,
  aiWarning: 'Nessuna anomalia',
  codes: {
    '0152': 142.5, '0421': 188.0, '0470': 75.0, '0482': 96.0, '0919': 120.0,
    '3B01': 1320.0, '3B03': 210.0, '3B05': 75.0, '3B10': 160.0,
    '3B20': 45.0, '3B30': 12.0, '3B35': 16.0,
  },
};

const ELIOR_VIAGGIANTE: DemoExtraction = {
  month: 'Marzo', year: 2023, daysWorked: 21, daysVacation: 1,
  aiWarning: 'Nessuna anomalia',
  codes: { '1130': 96.4, '1131': 72.0, '2018': 88.5, '2035': 110.0, '4255': 55.0, '1000': 1610.0 },
};

const ELIOR_MAGAZZINO: DemoExtraction = {
  month: 'Marzo', year: 2023, daysWorked: 23, daysVacation: 0,
  aiWarning: 'Nessuna anomalia',
  codes: { '1130': 80.0, '1131': 60.0, '2018': 74.0, '2035': 95.0, '2313': 48.0, '1000': 1540.0 },
};

const CLEAN_SERVICE: DemoExtraction = {
  month: 'Marzo', year: 2023, daysWorked: 22, daysVacation: 0,
  aiWarning: 'Nessuna anomalia',
  codes: { '8037': 72.0, '8019': 95.0, '8007': 84.0, '820': 50.0, '565': 60.0,
    'MC01': 1210.0, 'MC06': 85.0, 'MC07': 65.0, 'MC10': 100.0 },
};

export function buildDemoExtraction(worker: Worker): DemoExtraction {
  switch (worker.profilo) {
    case 'ELIOR':
      return worker.eliorType === 'magazzino' ? ELIOR_MAGAZZINO : ELIOR_VIAGGIANTE;
    case 'CLEAN_SERVICE':
      return CLEAN_SERVICE;
    case 'RFI':
    case 'TRENITALIA':
    default:
      return RFI;
  }
}
