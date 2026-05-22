// src/constants.ts
import { AnnoDati } from './types';

// 1. CONFIGURAZIONE ANNI (Modifica qui per andare indietro nel tempo)
export const START_YEAR = 2007; // <--- Parte dal 2007 (Anno Rif.)
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
        id: `${year}-${index}`, // ID unico come stringa
        year: year,
        monthIndex: index,
        month: month,
        daysWorked: 0,
        daysVacation: 0,
        ticket: 0,
        arretrati: 0,
        note: '',
        // --- AGGIUNTA CONSIGLIATA: Inizializza i campi calcolo ---
        coeffPercepito: 0,
        coeffTicket: 0
    }))
);

// 5. ESTRAZIONE MESE/ANNO DAL NOME FILE
// Ricava il mese (0-11) e l'anno da nomi tipo "Aprile 2008.pdf", "04-2008.pdf".
// Restituisce null se nel nome non si riconosce alcun mese. L'anno può essere null.
export function parseMonthFromFilename(
    filename: string | undefined | null
): { monthIndex: number; year: number | null } | null {
    if (!filename) return null;
    const lower = filename.toLowerCase();

    const yearMatch = filename.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    // 1° tentativo: mese per nome esteso (Gennaio…Dicembre).
    let monthIndex = MONTH_NAMES.findIndex(m => lower.includes(m.toLowerCase()));

    // 2° tentativo: mese numerico 01-12, escludendo le cifre dell'anno.
    if (monthIndex === -1) {
        const withoutYear = yearMatch ? lower.replace(yearMatch[1], ' ') : lower;
        const numMatch = withoutYear.match(/(?<!\d)(0[1-9]|1[0-2])(?!\d)/);
        if (numMatch) monthIndex = parseInt(numMatch[1], 10) - 1;
    }

    if (monthIndex === -1) return null;
    return { monthIndex, year };
}
