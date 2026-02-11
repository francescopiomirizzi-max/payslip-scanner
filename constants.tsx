// src/constants.ts
import { AnnoDati } from './types';

// 1. CONFIGURAZIONE ANNI (Modifica qui per andare indietro nel tempo)
export const START_YEAR = 2007; // <--- Ora parte dal 2007
export const END_YEAR = 2025;   // Arriva fino al 2025

// 2. GENERAZIONE DINAMICA DEGLI ANNI (Dal più recente al più vecchio)
export const YEARS = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i
).reverse();

// 3. NOMI DEI MESI
export const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

// 4. GENERAZIONE TEMPLATE DATI (Struttura vuota per ogni mese/anno)
export const DEFAULT_YEARS_TEMPLATE: AnnoDati[] = YEARS.flatMap((year) =>
    MONTH_NAMES.map((month, index) => ({
        id: `${year}-${index}`, // ID unico come stringa (es. "2024-0")
        year: year,
        monthIndex: index,
        month: month,
        daysWorked: 0,
        daysVacation: 0,
        ticket: 0,
        arretrati: 0,
        note: ''
    }))
);
