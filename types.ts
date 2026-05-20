// ==========================================
// FILE: src/types.ts
// ==========================================

export const MONTH_NAMES = [
  'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
  'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
];

// Alias per compatibilità
export const MONTHS = MONTH_NAMES;

// Dal 2007 al 2025 sono 19 anni (2025 - 2007 + 1)
export const YEARS = Array.from({ length: 19 }, (_, i) => 2007 + i);

// --- MODIFICA CHIRURGICA 1: TIPO APERTO ---
// Invece di limitare alle sole 3 aziende, lo apriamo a qualsiasi stringa, 
// mantenendo i suggerimenti per le 3 principali.
export type ProfiloAzienda = 'RFI' | 'TRENITALIA' | 'ELIOR' | 'CLEAN_SERVICE' | 'MERCITALIA' | string;

export interface AnnoDati {
  id?: string;
  year: number;
  monthIndex: number;
  month?: string;

  // Input per il calcolo
  daysWorked: string | number;   // Divisore
  daysVacation: string | number; // Ferie fruite
  ticket: string | number;       // Buono pasto

  // Note per eventi (es. Malattia, Infortunio)
  note?: string;

  // ✨ DATI TFR (Estrattti invisibilmente dall'IA)
  imponibile_tfr_mensile?: number;
  fondo_pregresso_31_12?: number;

  // Campi dinamici (codici indennità)
  [key: string]: any;
}

export interface Worker {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  profilo: ProfiloAzienda;
  status?: 'aperta' | 'in_corso' | 'chiusa' | 'inviata' | 'pronta' | 'trattativa';
  anni: AnnoDati[];
  avatarUrl?: string;
  accentColor?: string;

  // ✨ IL PUNTO ZERO DEL TFR (Inserito manualmente dall'utente nel Modale)
  tfr_pregresso?: number;
  tfr_pregresso_anno?: number;

  eliorType?: 'viaggiante' | 'magazzino';
  notes?: string;

  profiloProfessionale?: string;

  // Preferenze UI per-lavoratore (cloud-synced)
  startClaimYear?: number;
  includeExFest?: boolean;
  includeTickets?: boolean;
  reportShowPercepito?: boolean;

  created_at?: string;
}

export interface ColumnDef {
  id: string;
  label: string;
  subLabel?: string;
  width: string;
  sticky?: boolean;
  isTotal?: boolean;
  type?: 'integer' | 'currency' | 'text' | 'formula'; // <--- AGGIUNTO 'formula'
  formula?: string;                                   // <--- NUOVO CAMPO
  isCalculated?: boolean;
  isInput?: boolean;
}

// --- CONFIGURAZIONE COLONNE PER PROFILO (BLINDATE) ---

// Colonne RFI (Allineate al Prompt V14)
// Nota: TRENITALIA usa la stessa Master List finché non avremo i codici "personale viaggiante"
export const INDENNITA_RFI: ColumnDef[] = [
  { id: '0152', label: 'Straord. Diurno', subLabel: '(0152)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0421', label: 'Ind. Notturno', subLabel: '(0421)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0423', label: 'Comp. Cantiere Notte', subLabel: '(0423)', width: 'min-w-[130px]', type: 'currency' },
  { id: '0457', label: 'Festivo Notturno', subLabel: '(0457)', width: 'min-w-[130px]', type: 'currency' },
  { id: '0470', label: 'Ind. Chiamata', subLabel: '(0470)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0482', label: 'Ind. Reperibilità', subLabel: '(0482)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0496', label: 'Ind. Disp. Chiamata', subLabel: '(0496)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0687', label: 'Ind. Linea < 10h', subLabel: '(0687)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0AA1', label: 'Trasferta', subLabel: '(0AA1)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0576', label: 'Ind. Orario Spezz.', subLabel: '(0576)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0584', label: 'Rep. Festive/Riposo', subLabel: '(0584)', width: 'min-w-[130px]', type: 'currency' },
  { id: '0919', label: 'Str. Feriale Diurno', subLabel: '(0919)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0920', label: 'Str. Fest/Notturno', subLabel: '(0920)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0932', label: 'Str. Diurno Rep.', subLabel: '(0932)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0933', label: 'Str. Fest/Not Rep.', subLabel: '(0933)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0995', label: 'Str. Diurno Disp.', subLabel: '(0995)', width: 'min-w-[120px]', type: 'currency' },
  { id: '0996', label: 'Str. Fest/Not Disp.', subLabel: '(0996)', width: 'min-w-[120px]', type: 'currency' },
  { id: '3B70', label: 'Sal. Produttività', subLabel: '(3B70)', width: 'min-w-[120px]', type: 'currency' },
  { id: '3B71', label: 'Prod. Incrementale', subLabel: '(3B71)', width: 'min-w-[120px]', type: 'currency' },
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

// Colonne ELIOR MAGAZZINO (Aggiunto per gestire il nuovo sotto-profilo)
export const INDENNITA_ELIOR_MAGAZZINO: ColumnDef[] = [
  { id: '1130', label: 'Lav. Nott.', subLabel: '(1130)', width: 'min-w-[100px]' },
  { id: '1131', label: 'Lav. Domen.', subLabel: '(1131)', width: 'min-w-[100px]' },
  { id: '2018', label: 'Straord. 18%', subLabel: '(2018)', width: 'min-w-[100px]' },
  { id: '2035', label: 'Straord. 35%', subLabel: '(2035)', width: 'min-w-[100px]' },
  { id: '2235', label: 'Magg. 35%', subLabel: '(2235)', width: 'min-w-[100px]' },
  { id: '4133', label: 'Funz. Diverse', subLabel: '(4133)', width: 'min-w-[100px]' },
  { id: '2313', label: 'Ind. Cella', subLabel: '(2313)', width: 'min-w-[100px]' },
  { id: '4275', label: 'Ind. Sottosuolo', subLabel: '(4275)', width: 'min-w-[100px]' },
  { id: '4285', label: '26/MI Retrib.', subLabel: '(4285)', width: 'min-w-[100px]' },
];

// Colonne CLEAN SERVICE SRL (CCNL Multiservizi - Ristorazione e Pulizie)
export const INDENNITA_CLEAN_SERVICE: ColumnDef[] = [
  // Maggiorazioni Turni e Festività
  { id: '8037', label: 'Lav. Notturno',    subLabel: '(8037)', width: 'min-w-[110px]', type: 'currency' },
  { id: '8057', label: 'Turno Non Cad.',   subLabel: '(8057)', width: 'min-w-[110px]', type: 'currency' },
  { id: '8029', label: 'Dom. > 2h',        subLabel: '(8029)', width: 'min-w-[110px]', type: 'currency' },
  { id: '8019', label: 'Lav. Festivo 35%', subLabel: '(8019)', width: 'min-w-[110px]', type: 'currency' },
  { id: '565',  label: 'Ore Fest. 35%',    subLabel: '(565)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '8032', label: 'Dom. Pasqua',      subLabel: '(8032)', width: 'min-w-[110px]', type: 'currency' },
  { id: '442',  label: 'Fest. S.Pasqua',   subLabel: '(442)',  width: 'min-w-[110px]', type: 'currency' },
  // Straordinario / Supplementare
  { id: '8007', label: 'Straord. 18%',     subLabel: '(8007)', width: 'min-w-[110px]', type: 'currency' },
  { id: '18',   label: 'Supplem. 18%',     subLabel: '(18)',   width: 'min-w-[110px]', type: 'currency' },
  // Flessibilità Oraria
  { id: '437',  label: 'Flex 13-24',       subLabel: '(437)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '440',  label: 'Flex 24-30',       subLabel: '(440)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '441',  label: 'Flex > 30',        subLabel: '(441)',  width: 'min-w-[110px]', type: 'currency' },
  // Indennità Specifiche
  { id: '820',  label: 'Ind. Presenza',    subLabel: '(820)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '739',  label: 'Ind. Disposiz.',   subLabel: '(739)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '380',  label: 'Treno in Giorn.',  subLabel: '(380)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '315',  label: 'Trasferta',        subLabel: '(315)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '392',  label: 'Trasf. Italia',    subLabel: '(392)',  width: 'min-w-[110px]', type: 'currency' },
  { id: '8038', label: 'Pernottaz.',       subLabel: '(8038)', width: 'min-w-[110px]', type: 'currency' },
  { id: '8053', label: 'Maneggio Den.',    subLabel: '(8053)', width: 'min-w-[110px]', type: 'currency' },
];

// Colonne MERCITALIA (Mercitalia Shunting & Terminal - layout gestionale ADP)
// Master List a 4 cifre: A) indennità variabili di presenza, B) straordinario, C) festività.
// I ticket NON hanno colonna: vivono solo nella nota del mese.
export const INDENNITA_MERCITALIA: ColumnDef[] = [
  // A — Indennità variabili di presenza
  { id: '1801', label: 'Ind. Notturno',     subLabel: '(1801)', width: 'min-w-[120px]', type: 'currency' },
  { id: '1802', label: 'Ind. Turno H24',    subLabel: '(1802)', width: 'min-w-[120px]', type: 'currency' },
  { id: '1811', label: 'Lav. Domenicale',   subLabel: '(1811)', width: 'min-w-[120px]', type: 'currency' },
  { id: '1819', label: 'Lav. Festivo',      subLabel: '(1819)', width: 'min-w-[120px]', type: 'currency' },
  { id: '1879', label: 'Ore Viaggio',       subLabel: '(1879)', width: 'min-w-[120px]', type: 'currency' },
  { id: '2331', label: 'Trasferta Italia',  subLabel: '(2331)', width: 'min-w-[130px]', type: 'currency' },
  // B — Ore di straordinario
  { id: '2013', label: 'Str. Diurno 18%',   subLabel: '(2013)', width: 'min-w-[120px]', type: 'currency' },
  { id: '2023', label: 'Str. Fest. 35%',    subLabel: '(2023)', width: 'min-w-[120px]', type: 'currency' },
  { id: '2033', label: 'Str. Notturno 35%', subLabel: '(2033)', width: 'min-w-[130px]', type: 'currency' },
  { id: '2073', label: 'Str. Fest/Nott 50%',subLabel: '(2073)', width: 'min-w-[130px]', type: 'currency' },
  // C — Festività
  { id: '2263', label: 'Festività',         subLabel: '(2263)', width: 'min-w-[120px]', type: 'currency' },
  { id: '2293', label: 'Festività Infras.', subLabel: '(2293)', width: 'min-w-[130px]', type: 'currency' },
];

// --- COLONNA ARRETRATI (Universale) ---
export const COLONNA_ARRETRATI: ColumnDef = {
  id: 'arretrati',
  label: 'Arretrati / Altro',
  subLabel: '(Esclusi)',
  width: 'min-w-[130px]',
  type: 'currency'
};

// --- MODIFICA CHIRURGICA 2: IL MOTORE DI FUSIONE ---
// Questa funzione adesso cerca prima nei salvataggi locali. Se non trova l'azienda custom, 
// usa i profili di sistema standard (RFI, ELIOR, CLEAN_SERVICE).
export const getColumnsByProfile = (profilo: ProfiloAzienda, eliorType?: 'viaggiante' | 'magazzino'): ColumnDef[] => {
  let specificColumns: ColumnDef[] = [];

  // 1. Prova a pescare le colonne personalizzate dal LocalStorage (Company Builder)
  if (typeof window !== 'undefined') {
    const savedCustomCompanies = localStorage.getItem('customCompanies');
    if (savedCustomCompanies) {
      try {
        const companiesData = JSON.parse(savedCustomCompanies);
        if (companiesData[profilo] && Array.isArray(companiesData[profilo].columns)) {
          specificColumns = companiesData[profilo].columns;
        }
      } catch (e) {
        console.error("Errore lettura aziende custom", e);
      }
    }
  }

  // 2. Se non ha trovato nulla nel database locale, usa i modelli di base "Hardcoded"
  if (specificColumns.length === 0) {
    switch (profilo) {
      case 'ELIOR':
        specificColumns = eliorType === 'magazzino' ? INDENNITA_ELIOR_MAGAZZINO : INDENNITA_ELIOR;
        break;
      case 'CLEAN_SERVICE':
        specificColumns = INDENNITA_CLEAN_SERVICE;
        break;
      case 'MERCITALIA':
        specificColumns = INDENNITA_MERCITALIA;
        break;
      case 'RFI':
      case 'TRENITALIA':
        specificColumns = INDENNITA_RFI;
        break;
      default:
        specificColumns = INDENNITA_RFI; // Fallback di sicurezza
    }
  }

  // 3. Compone la tabella finale aggiungendo la colonna mesi, gli arretrati e le somme
  const tabella: ColumnDef[] = [
    { id: 'month', label: 'MESE', width: 'min-w-[120px]', sticky: true },
    ...specificColumns,
    COLONNA_ARRETRATI, // Viene sempre aggiunta alla fine delle indennità
    { id: 'total', label: 'TOTALE', subLabel: 'Voci', width: 'min-w-[100px]', isTotal: true, isCalculated: true },
    { id: 'daysWorked', label: 'GG Lav.', subLabel: 'Divisore', width: 'min-w-[80px]', type: 'integer' },
    { id: 'daysVacation', label: 'GG Ferie', subLabel: 'Fruite', width: 'min-w-[80px]', type: 'integer' },
    { id: 'ticket', label: 'Ticket', subLabel: 'Past.', width: 'min-w-[80px]', type: 'currency' }
  ];

  // MERCITALIA: i ticket vivono solo nella nota del mese → nessuna colonna ticket dedicata
  return profilo === 'MERCITALIA' ? tabella.filter(c => c.id !== 'ticket') : tabella;
};

import { parseFloatSafe } from './utils/formatters';

// --- FORMULA ENGINE: IL CERVELLO MATEMATICO ---
export const evaluateFormula = (formulaStr: string | undefined, rowData: any): number => {
  if (!formulaStr || typeof formulaStr !== 'string') return 0;

  try {
    // 1. Sostituisce i codici tra parentesi quadre con i valori reali della riga.
    // Es: "[1050] * 0.15" -> se rowData['1050'] è 100, diventa "100 * 0.15"
    let parsedFormula = formulaStr.replace(/\[([^\]]+)\]/g, (match, code) => {
      const rawValue = rowData[code];
      const val = parseFloatSafe(rawValue);
      return val.toString();
    });

    // 2. SANIFICAZIONE: Rimuoviamo tutto ciò che non è matematica sicura.
    // Permettiamo solo: Numeri, operatori (+ - * /), punti decimali e parentesi tonde.
    // Questo previene vulnerabilità di sicurezza (XSS/Code Injection).
    parsedFormula = parsedFormula.replace(/[^0-9+\-*/.()]/g, '');

    if (!parsedFormula) return 0;

    // 3. VALUTAZIONE MATEMATICA
    // Usiamo Function invece di eval() perché è leggermente più sicuro e isolato
    const result = new Function('return ' + parsedFormula)();

    // 4. Se il risultato è un numero valido (non Infinity o NaN), lo restituiamo, altrimenti 0
    return (typeof result === 'number' && !isNaN(result) && isFinite(result)) ? result : 0;

  } catch (error) {
    // Se la formula ha errori di sintassi (es. "100 * + 2"), non fa crashare l'app, restituisce solo 0
    console.warn(`Formula Engine Error: Impossibile valutare "${formulaStr}"`);
    return 0;
  }
};