/**
 * Utility functions for parsing and formatting numbers, currencies and dates.
 */

export const parseLocalFloat = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) return 0;
    return value;
  }

  let cleanStr = value.toString().trim();
  if (!cleanStr) return 0;

  // Strip leading currency symbols and whitespace (e.g. "€ 1.234,56" → "1.234,56")
  cleanStr = cleanStr.replace(/^[€$£\s]+/, '').trim();

  if (cleanStr.includes(',') && (!cleanStr.includes('.') || cleanStr.indexOf(',') > cleanStr.lastIndexOf('.'))) {
    // Italian/EU format: "1.234,56" → "1234.56"
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else {
    // US format or plain: remove grouping commas
    cleanStr = cleanStr.replace(/,/g, '');
  }

  const num = parseFloat(cleanStr);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

// Alias per compatibilità
export const parseFloatSafe = parseLocalFloat;

export const formatCurrency = (value: number | string | undefined | null) => {
  if (value === undefined || value === null || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num) || num === 0) return '-';
  return `€ ${num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (value: number | string | undefined | null) => {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'string' ? parseLocalFloat(value) : value;
  if (isNaN(num as number)) return '0';
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num as number);
};

export const formatInteger = (value: number | string | undefined | null) => {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'number' ? value : parseLocalFloat(value);
  return Math.round(num).toString();
};

export const formatDay = (value: number | string | undefined | null) => {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'number' ? value : parseLocalFloat(value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('it-IT', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  }).format(num);
};

export const getFormattedDate = (date: Date = new Date()) => {
  const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  return `${giorni[date.getDay()]} ${date.getDate()} ${mesi[date.getMonth()]}`;
};

export const getFormattedTime = (date: Date = new Date()) => {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

export const formatLongDate = (date: Date = new Date()) => {
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const getProfiloBadgeLabel = (profilo: string | undefined, eliorType?: 'viaggiante' | 'magazzino', short = false): string => {
  if (!profilo) return '';
  if (profilo === 'ELIOR') {
    if (eliorType === 'viaggiante') return short ? 'ELIOR Viag.' : 'ELIOR Viaggiante';
    if (eliorType === 'magazzino') return short ? 'ELIOR Mag.' : 'ELIOR Magazzino';
    return 'ELIOR';
  }
  return profilo;
};
