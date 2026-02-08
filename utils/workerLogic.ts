import {
    AnnoDati,
    parseFloatSafe,
    INDENNITA_RFI,
    INDENNITA_ELIOR,
    INDENNITA_REKEEP,
    COLONNA_ARRETRATI, // <--- 1. AGGIUNTO QUI
    YEARS
} from '../types';

// --- STRATEGIA LISTA MAESTRA ---
// Uniamo tutte le colonne di tutti i profili + la colonna ARRETRATI.
// Il calcolatore proverà a sommare tutto ciò che trova.
const ALL_INDEMNITY_COLUMNS = [
    ...INDENNITA_RFI,
    ...INDENNITA_ELIOR,
    ...INDENNITA_REKEEP,
    COLONNA_ARRETRATI // <--- 2. AGGIUNTO QUI (Ora viene sommata nel totale!)
];

export const calculateEverything = (inputs: AnnoDati[]) => {
    // --- INIZIALIZZAZIONE TOTALI ---
    const grandTotal = {
        totalGross: 0,
        totalTicket: 0,
        totalNet: 0,
        totalVacationDays: 0,
        totalIndemnitySum: 0
    };

    const yearlyData: any[] = [];

    // Oggetto per la pivot (chiave: "Nome Voce", valore: { 2020: 100, 2021: 200 })
    const pivotData: any = {};

    // --- PROTEZIONE ANTI-CRASH ---
    if (!inputs || !Array.isArray(inputs)) {
        console.warn("ATTENZIONE: calculateEverything ha ricevuto dati non validi.", inputs);
        return { yearlyData, pivotData, grandTotal };
    }

    // 1. Raggruppa i dati per Anno
    const dataByYear: { [key: number]: AnnoDati[] } = {};

    inputs.forEach(row => {
        if (!row || !YEARS.includes(row.year)) return;
        if (!dataByYear[row.year]) dataByYear[row.year] = [];
        dataByYear[row.year].push(row);
    });

    // 2. Elabora ogni anno
    Object.keys(dataByYear).forEach(yearStr => {
        const year = parseInt(yearStr);
        const rows = dataByYear[year];

        let totalIndemnity = 0;
        let workDays = 0;
        let vacationDays = 0;
        let ticketAmount = 0;

        // Ciclo sui mesi dell'anno
        rows.forEach(row => {
            // A. Somma Indennità (Usando la Lista Maestra Universale)
            ALL_INDEMNITY_COLUMNS.forEach(col => {
                // Escludiamo campi tecnici
                if (col.id !== 'month' && col.id !== 'total' && col.id !== 'daysWorked' && col.id !== 'daysVacation' && col.id !== 'ticket') {
                    const val = parseFloatSafe(row[col.id]);

                    if (val > 0) {
                        totalIndemnity += val;

                        // B. Popolamento Dati Pivot
                        // Usiamo "Label (Codice)" come chiave univoca
                        const pivotKey = col.subLabel ? `${col.label} ${col.subLabel}` : col.label;
                        if (!pivotData[pivotKey]) pivotData[pivotKey] = {};
                        if (!pivotData[pivotKey][year]) pivotData[pivotKey][year] = 0;
                        pivotData[pivotKey][year] += val;
                    }
                }
            });

            // C. Somma Variabili Input
            workDays += parseFloatSafe(row['daysWorked']);
            vacationDays += parseFloatSafe(row['daysVacation']);
            ticketAmount += parseFloatSafe(row['ticket']);
        });

        // 3. Calcoli Matematici (La Formula Blindata)
        const divisore = workDays;
        const dailyIncidence = divisore > 0 ? totalIndemnity / divisore : 0;

        // Lordo = Media * Ferie Godute
        const grossAmount = dailyIncidence * vacationDays;

        // Netto = Lordo - Ticket
        const netAmount = grossAmount - ticketAmount;

        // Salviamo solo se c'è attività nell'anno
        if (workDays > 0 || vacationDays > 0 || ticketAmount > 0 || totalIndemnity > 0) {
            yearlyData.push({
                year,
                totalIndemnity,
                workDays,
                dailyIncidence,
                vacationDays,
                grossAmount,
                ticketAmount,
                netAmount
            });

            // Aggiorna Totali Generali
            grandTotal.totalGross += grossAmount;
            grandTotal.totalTicket += ticketAmount;
            grandTotal.totalVacationDays += vacationDays;
            grandTotal.totalIndemnitySum += totalIndemnity;

            // Nel totale netto sommiamo il risultato algebrico
            grandTotal.totalNet += netAmount;
        }
    });

    return { yearlyData, pivotData, grandTotal };
};