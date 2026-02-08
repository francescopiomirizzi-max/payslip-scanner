// ==========================================
// FILE: src/types.ts
// ==========================================

export const MONTH_NAMES = [
  'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
  'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
];

// Alias per compatibilità con altri componenti che cercano "MONTHS"
export const MONTHS = MONTH_NAMES;

export const YEARS = Array.from({ length: 18 }, (_, i) => 2008 + i);

// --- 1. MODIFICA: AGGIUNTO 'REKEEP' ---
export type ProfiloAzienda = 'RFI' | 'ELIOR' | 'REKEEP';

export interface AnnoDati {
  id?: string;
  year: number;
  monthIndex: number;
  month?: string;

  // Input per il calcolo delle differenze ferie
  daysWorked: string | number;   // Divisore (GG Lavorati)
  daysVacation: string | number; // GG Ferie fruite
  ticket: string | number;       // Buoni Pasto

  // --- MODIFICA: CAMPO NOTE PER EVENTI SPECIALI ---
  note?: string; // Es. "Infortunio", "Congedo", "Sciopero"

  // Campi dinamici per le indennità
  [key: string]: any;
}

export interface Worker {
  id: number;
  nome: string;
  cognome: string;
  ruolo: string;
  profilo: ProfiloAzienda;
  status?: 'aperta' | 'in_corso' | 'chiusa' | 'inviata' | 'pronta' | 'trattativa';
  anni: AnnoDati[];
  avatarUrl?: string;
  accentColor?: string;
}

export interface ColumnDef {
  id: string;
  label: string;
  subLabel?: string;
  width: string;
  sticky?: boolean;
  isTotal?: boolean;
  type?: 'integer' | 'currency' | 'text';
  isCalculated?: boolean;
  isInput?: boolean; // Aggiunto per compatibilità
}

// --- CONFIGURAZIONE COLONNE PER PROFILO ---

// Colonne RFI (Aggiornate: ESATTAMENTE 16 VOCI DA DOCUMENTO LEGALE)
export const INDENNITA_RFI: ColumnDef[] = [
  { id: '0152', label: 'Straord. Diurno', subLabel: '(0152)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0421', label: 'Ind. Notturno', subLabel: '(0421)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0470', label: 'Ind. Chiamata', subLabel: '(0470)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0482', label: 'Ind. Reperibilità', subLabel: '(0482)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0496', label: 'Ind. Disp. Chiamata', subLabel: '(0496)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0687', label: 'Ind. Linea < 10h', subLabel: '(0687)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0AA1', label: 'Trasferta', subLabel: '(0AA1)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0423', label: 'Comp. Cantiere Notte', subLabel: '(0423)', width: 'min-w-[130px]', type: 'currency' },
  { id: '0576', label: 'Ind. Orario Spezz.', subLabel: '(0576)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0584', label: 'Rep. Festive/Riposo', subLabel: '(0584)', width: 'min-w-[130px]', type: 'currency' },
  { id: '0919', label: 'Str. Feriale Diurno', subLabel: '(0919)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0920', label: 'Str. Fest/Notturno', subLabel: '(0920)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0932', label: 'Str. Diurno Rep.', subLabel: '(0932)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0933', label: 'Str. Fest/Not Rep.', subLabel: '(0933)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0995', label: 'Str. Diurno Disp.', subLabel: '(0995)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0996', label: 'Str. Fest/Not Disp.', subLabel: '(0996)', width: 'min-w-[120px]', type: 'currency' },
];

// Colonne ELIOR (Invariato)
export const INDENNITA_ELIOR: ColumnDef[] = [
  { id: '1126', label: 'Ind. Cassa', subLabel: '(1126)', width: 'min-w-[100px]' },
  { id: '1130', label: 'Lav. Nott.', subLabel: '(1130)', width: 'min-w-[100px]' },
  { id: '1131', label: 'Lav. Domen.', subLabel: '(1131)', width: 'min-w-[100px]' },
  { id: '2018', label: 'Str. 18%', subLabel: '(2018)', width: 'min-w-[100px]' },
  { id: '2020', label: 'Str. 20%', subLabel: '(2020)', width: 'min-w-[100px]' },
  { id: '2035', label: 'Str. 35%', subLabel: '(2035)', width: 'min-w-[100px]' },
  { id: '2235', label: 'Magg. 35%', subLabel: '(2235)', width: 'min-w-[100px]' },
  { id: '4133', label: 'Funz. Diverse', subLabel: '(4133)', width: 'min-w-[100px]' },
  { id: '4254', label: 'RFR < 8h', subLabel: '(4254)', width: 'min-w-[100px]' },
  { id: '4255', label: 'Pernottamento', subLabel: '(4255)', width: 'min-w-[100px]' },
  { id: '4256', label: 'Pernottazione', subLabel: '(4256)', width: 'min-w-[100px]' },
  { id: '4300', label: 'Ass. Res. No RS', subLabel: '(4300)', width: 'min-w-[120px]' },
  { id: '4305', label: 'Ass. Res. RS', subLabel: '(4305)', width: 'min-w-[120px]' },
  { id: '4301', label: 'F. Sede RFR', subLabel: '(4301)', width: 'min-w-[100px]' },
  { id: '4320', label: 'Diaria Scorta', subLabel: '(4320)', width: 'min-w-[120px]' },
  { id: '4345', label: 'Riserva Pres.', subLabel: '(4345)', width: 'min-w-[100px]' },
  { id: '4325', label: 'Flex Oraria', subLabel: '(4325)', width: 'min-w-[100px]' },
  { id: '4330', label: 'Flex Res.', subLabel: '(4330)', width: 'min-w-[100px]' },
  { id: '5655', label: '26/MI Retrib.', subLabel: '(5655)', width: 'min-w-[100px]' },
];

// Colonne REKEEP (Invariato)
export const INDENNITA_REKEEP: ColumnDef[] = [
  { id: 'I1037C', label: 'Ind. Domenicale', subLabel: '(I1037C)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'I1040C', label: 'Lav. Notturno', subLabel: '(I1040C)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'I215FC', label: 'Turni Non Cad.', subLabel: '(I215FC)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'I225FC', label: 'Ind. Pernott.', subLabel: '(I225FC)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'I232FC', label: 'Ass. Residenza', subLabel: '(I232FC)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'I1182C', label: 'Ind. Sussidiaria', subLabel: '(I1182C)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'D2200', label: 'Fest. Non God.', subLabel: '(D2200)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'S1800C', label: 'Straord. 18%', subLabel: '(S1800C)', width: 'min-w-[110px]', type: 'currency' },
  { id: 'M3500C', label: 'Maggioraz. 35%', subLabel: '(M3500C)', width: 'min-w-[110px]', type: 'currency' },
];

// --- MODIFICA: COLONNA ARRETRATI/EXTRA (Universale) ---
export const COLONNA_ARRETRATI: ColumnDef = {
  id: 'arretrati',
  label: 'Arretrati / Altro',
  subLabel: '(Una Tantum)',
  width: 'min-w-[130px]',
  type: 'currency'
};

// --- 3. MODIFICA: COMPOSIZIONE COLONNE ---
export const getColumnsByProfile = (profilo: ProfiloAzienda): ColumnDef[] => {
  let specificColumns: ColumnDef[] = [];

  switch (profilo) {
    case 'ELIOR':
      specificColumns = INDENNITA_ELIOR;
      break;
    case 'REKEEP':
      specificColumns = INDENNITA_REKEEP;
      break;
    default:
      specificColumns = INDENNITA_RFI;
  }

  return [
    { id: 'month', label: 'MESE', width: 'min-w-[120px]', sticky: true },
    ...specificColumns,
    COLONNA_ARRETRATI,
    { id: 'total', label: 'TOTALE', subLabel: 'Voci', width: 'min-w-[100px]', isTotal: true, isCalculated: true },
    { id: 'daysWorked', label: 'GG Lav.', subLabel: 'Divisore', width: 'min-w-[80px]', type: 'integer' },
    { id: 'daysVacation', label: 'GG Ferie', subLabel: 'Fruite', width: 'min-w-[80px]', type: 'integer' },

    // Manteniamo Ticket qui nel modello dati, ma la UI (MonthlyDataGrid) lo filtrerà come concordato
    { id: 'ticket', label: 'Ticket', subLabel: 'Past.', width: 'min-w-[80px]', type: 'currency' }
  ];
};

// 4. HELPER FUNCTIONS (Invariate)
export const formatCurrency = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num) || num === 0) return '-';
  return `€ ${num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatInteger = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return '0';
  return value.toString();
};

export const parseFloatSafe = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  let cleanStr = value.toString().trim();
  if (cleanStr.includes(',') && (!cleanStr.includes('.') || cleanStr.indexOf(',') > cleanStr.lastIndexOf('.'))) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else {
    cleanStr = cleanStr.replace(/,/g, '');
  }

  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};