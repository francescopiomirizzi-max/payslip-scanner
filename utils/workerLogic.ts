import {
    AnnoDati,
    parseFloatSafe,
    INDENNITA_RFI,
    INDENNITA_ELIOR,
    INDENNITA_REKEEP,
    COLONNA_ARRETRATI,
    YEARS
} from '../types';

// --- STRATEGIA LISTA MAESTRA ---
const ALL_INDEMNITY_COLUMNS = [
    ...INDENNITA_RFI,
    ...INDENNITA_ELIOR,
    ...INDENNITA_REKEEP,
    COLONNA_ARRETRATI
];

// MODIFICA 1: La funzione ora accetta le opzioni di calcolo
export const calculateEverything = (
    inputs: AnnoDati[],
    startClaimYear: number = 2008, // Default di sicurezza
    includeTickets: boolean = true
) => {

    // --- INIZIALIZZAZIONE TOTALI ---
    const grandTotal = {
        totalGross: 0,
        totalTicket: 0,
        totalNet: 0,
        totalVacationDays: 0,
        totalIndemnitySum: 0
    };

    const yearlyData: any[] = [];
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

        // --- MODIFICA 2: FILTRO ANNO ---
        // Se l'anno è precedente all'inizio della vertenza, lo ignoriamo nei conteggi
        // (Nota: Per la Pivot potremmo volerlo vedere, ma per i totali no. Qui lo escludiamo per coerenza).
        if (year < startClaimYear) return;

        let totalIndemnity = 0;
        let workDays = 0;
        let vacationDays = 0;

        // Accumulatori economici
        let totalLordoYear = 0;
        let totalPercepitoYear = 0;
        let totalTicketYear = 0;

        // Ciclo sui mesi dell'anno
        rows.forEach(row => {

            // A. Somma Indennità (Per la visualizzazione Pivot)
            ALL_INDEMNITY_COLUMNS.forEach(col => {
                if (col.id !== 'month' && col.id !== 'total' && col.id !== 'daysWorked' && col.id !== 'daysVacation' && col.id !== 'ticket') {
                    const val = parseFloatSafe(row[col.id]);

                    if (val > 0) {
                        totalIndemnity += val;

                        // Popolamento Dati Pivot (Solo se > 0)
                        const pivotKey = col.subLabel ? `${col.label} ${col.subLabel}` : col.label;
                        if (!pivotData[pivotKey]) pivotData[pivotKey] = {};
                        if (!pivotData[pivotKey][year]) pivotData[pivotKey][year] = 0;
                        pivotData[pivotKey][year] += val;
                    }
                }
            });

            // B. Recupero Dati Giornalieri
            const daysW = parseFloatSafe(row.daysWorked);
            const daysV = parseFloatSafe(row.daysVacation);

            workDays += daysW;
            vacationDays += daysV;

            // C. Calcolo Ticket & Percepito (Puntuale mese su mese)
            // Attenzione: Qui stiamo facendo una stima approssimativa per la Pivot.
            // Il calcolo preciso "legale" (con la media anno precedente) è fatto in WorkerDetailPage.
            // Qui facciamo una somma statistica.

            const coeffTicket = parseFloatSafe(row.coeffTicket);
            const coeffPercepito = parseFloatSafe(row.coeffPercepito);

            // Calcolo Ticket (rispetta il toggle)
            if (includeTickets) {
                totalTicketYear += (daysV * coeffTicket);
            }

            totalPercepitoYear += (daysV * coeffPercepito);
        });

        // 3. Calcolo Totali Anno (Stimati)
        const dailyIncidence = workDays > 0 ? totalIndemnity / workDays : 0;
        const grossAmount = dailyIncidence * vacationDays;

        // FORMULA CORRETTA: (Lordo - Percepito) + Ticket
        const netAmount = (grossAmount - totalPercepitoYear) + totalTicketYear;

        if (workDays > 0 || vacationDays > 0 || totalIndemnity > 0) {
            yearlyData.push({
                year,
                totalIndemnity,
                workDays,
                dailyIncidence,
                vacationDays,
                grossAmount,
                ticketAmount: totalTicketYear,
                netAmount
            });

            // Aggiorna Totali Generali
            grandTotal.totalGross += grossAmount;
            grandTotal.totalTicket += totalTicketYear;
            grandTotal.totalVacationDays += vacationDays;
            grandTotal.totalIndemnitySum += totalIndemnity;
            grandTotal.totalNet += netAmount;
        }
    });

    return { yearlyData, pivotData, grandTotal };
};