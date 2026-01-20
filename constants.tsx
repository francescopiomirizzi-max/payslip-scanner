import { AnnoDati, Worker } from './types';
import { ProspettoRow, TotaleDovuto } from './types'; // Keeping types import if needed, but cleaning up structure

// Default template for years 2008-2025 with standard divisors
export const DEFAULT_YEARS_TEMPLATE: AnnoDati[] = [
  { anno: 2008, totaleVociAccessorie: 0, divisoreAnnuo: 201.5, giornateFerieFruite: 0 },
  { anno: 2009, totaleVociAccessorie: 0, divisoreAnnuo: 190, giornateFerieFruite: 0 },
  { anno: 2010, totaleVociAccessorie: 0, divisoreAnnuo: 187, giornateFerieFruite: 0 },
  { anno: 2011, totaleVociAccessorie: 0, divisoreAnnuo: 227, giornateFerieFruite: 0 },
  { anno: 2012, totaleVociAccessorie: 0, divisoreAnnuo: 202, giornateFerieFruite: 0 },
  { anno: 2013, totaleVociAccessorie: 0, divisoreAnnuo: 218, giornateFerieFruite: 0 },
  { anno: 2014, totaleVociAccessorie: 0, divisoreAnnuo: 219, giornateFerieFruite: 0 },
  { anno: 2015, totaleVociAccessorie: 0, divisoreAnnuo: 226.5, giornateFerieFruite: 0 },
  { anno: 2016, totaleVociAccessorie: 0, divisoreAnnuo: 240, giornateFerieFruite: 0 },
  { anno: 2017, totaleVociAccessorie: 0, divisoreAnnuo: 220.5, giornateFerieFruite: 0 },
  { anno: 2018, totaleVociAccessorie: 0, divisoreAnnuo: 224, giornateFerieFruite: 0 },
  { anno: 2019, totaleVociAccessorie: 0, divisoreAnnuo: 218, giornateFerieFruite: 0 },
  { anno: 2020, totaleVociAccessorie: 0, divisoreAnnuo: 214, giornateFerieFruite: 0 },
  { anno: 2021, totaleVociAccessorie: 0, divisoreAnnuo: 192, giornateFerieFruite: 0 },
  { anno: 2022, totaleVociAccessorie: 0, divisoreAnnuo: 158, giornateFerieFruite: 0 },
  { anno: 2023, totaleVociAccessorie: 0, divisoreAnnuo: 199, giornateFerieFruite: 0 },
  { anno: 2024, totaleVociAccessorie: 0, divisoreAnnuo: 219, giornateFerieFruite: 0 },
  { anno: 2025, totaleVociAccessorie: 0, divisoreAnnuo: 220, giornateFerieFruite: 0 }, // Estimated typical divisor
];

export const WORKERS: Worker[] = []; // Cleanup old workers data, now managed in App.tsx

export const TOTALE_DOVUTO: TotaleDovuto = {
  label: "Totale Dovuto",
  incidenzaTotale: "18.102,77",
  percepitaTotale: "0,00",
  daPercepireTotale: "18.102,77",
  pastoTotale: "0,00"
};


