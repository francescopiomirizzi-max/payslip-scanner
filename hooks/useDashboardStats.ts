import { useMemo } from 'react';
import { Wallet, Ticket } from 'lucide-react';
import { Worker, getColumnsByProfile } from '../types';
import { parseLocalFloat } from '../utils/formatters';

type StatsModalType = 'net' | 'ticket' | null;

export interface WorkerStatItem {
    id: number;
    fullName: string;
    role: string;
    profilo: string;
    amount: number;
    potential: number;
    color: string;
    isTicketExcluded: boolean;
}

export interface DashboardStats {
    totalNet: number;
    totalTicket: number;
}

export interface ModalConfig {
    title: string;
    subtitle: string;
    color: 'emerald' | 'amber';
    icon: typeof Wallet;
    totalLabel: string;
    totalValue: number;
}

/**
 * Hook che calcola le statistiche aggregate della dashboard:
 * - totali netto/ticket per le card
 * - lista dettaglio per il modale
 * - configurazione del modale
 *
 * Dipende da workers, refreshStats (trigger manuale) e activeStatsModal.
 */
export const useDashboardStats = (
    workers: Worker[],
    refreshStats: number,
    activeStatsModal: StatsModalType
) => {
    // --- 1. TOTALI CARD DASHBOARD ---
    const dashboardStats = useMemo<DashboardStats>(() => {
        return workers.reduce((acc, worker) => {
            const storedTicket = localStorage.getItem(`tickets_${worker.id}`);
            const includeTickets = storedTicket !== null ? JSON.parse(storedTicket) : true;
            const storedExFest = localStorage.getItem(`exFest_${worker.id}`);
            const includeExFest = storedExFest !== null ? JSON.parse(storedExFest) : false;
            const storedStart = localStorage.getItem(`startYear_${worker.id}`);
            const startClaimYear = storedStart ? parseInt(storedStart) : 2008;

            const TETTO_FERIE = includeExFest ? 32 : 28;
            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];

            const indCols = getColumnsByProfile(worker.profilo || 'RFI', worker.eliorType).filter(c =>
                !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
            );

            const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};
            safeAnni.forEach((row: any) => {
                const y = Number(row.year);
                if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
                const gg = parseLocalFloat(row.daysWorked);
                if (gg > 0) {
                    let sum = 0;
                    indCols.forEach(c => sum += parseLocalFloat(row[c.id]));
                    yearlyRaw[y].totVar += sum;
                    yearlyRaw[y].ggLav += gg;
                }
            });

            const yearlyAverages: Record<number, number> = {};
            Object.keys(yearlyRaw).forEach(k => {
                const y = Number(k);
                yearlyAverages[y] = yearlyRaw[y].ggLav > 0 ? yearlyRaw[y].totVar / yearlyRaw[y].ggLav : 0;
            });

            let wNetto = 0;
            let wTicket = 0;

            const uniqueYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).sort((a, b) => a - b);

            uniqueYears.forEach((yearVal) => {
                const year = Number(yearVal);
                if (year < startClaimYear) return;

                let ferieCumulateAnno = 0;
                let media = yearlyAverages[year - 1];
                if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

                const monthsInYear = safeAnni
                    .filter((r: any) => Number(r.year) === year)
                    .sort((a: any, b: any) => a.monthIndex - b.monthIndex);

                monthsInYear.forEach((row: any) => {
                    const vacDays = parseLocalFloat(row.daysVacation);
                    const cTicket = parseLocalFloat(row.coeffTicket);
                    const cPercepito = parseLocalFloat(row.coeffPercepito);

                    const spazio = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
                    const ggUtili = Math.min(vacDays, spazio);
                    ferieCumulateAnno += vacDays;

                    if (ggUtili > 0) {
                        const lordo = ggUtili * media;
                        const percepito = ggUtili * cPercepito;
                        const ticketVal = ggUtili * cTicket;

                        if (includeTickets) {
                            wTicket += ticketVal;
                            wNetto += (lordo - percepito) + ticketVal;
                        } else {
                            wNetto += (lordo - percepito);
                        }
                    }
                });
            });

            return {
                totalNet: acc.totalNet + wNetto,
                totalTicket: acc.totalTicket + wTicket
            };
        }, { totalNet: 0, totalTicket: 0 });
    }, [workers, refreshStats]);

    // --- 2. LISTA DETTAGLIO MODALE ---
    const statsList = useMemo<WorkerStatItem[]>(() => {
        if (!activeStatsModal) return [];

        return workers.map(worker => {
            const storedTicket = localStorage.getItem(`tickets_${worker.id}`);
            const includeTickets = storedTicket !== null ? JSON.parse(storedTicket) : true;
            const storedExFest = localStorage.getItem(`exFest_${worker.id}`);
            const includeExFest = storedExFest !== null ? JSON.parse(storedExFest) : false;
            const storedStart = localStorage.getItem(`startYear_${worker.id}`);
            const startClaimYear = storedStart ? parseInt(storedStart) : 2008;

            const TETTO_FERIE = includeExFest ? 32 : 28;
            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];

            const indCols = getColumnsByProfile(worker.profilo || 'RFI', worker.eliorType).filter(c =>
                !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
            );

            const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};
            safeAnni.forEach((row: any) => {
                const y = Number(row.year);
                if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
                const gg = parseLocalFloat(row.daysWorked);
                if (gg > 0) {
                    let sum = 0;
                    indCols.forEach(c => sum += parseLocalFloat(row[c.id]));
                    yearlyRaw[y].totVar += sum;
                    yearlyRaw[y].ggLav += gg;
                }
            });

            const yearlyAverages: Record<number, number> = {};
            Object.keys(yearlyRaw).forEach(k => {
                const y = Number(k);
                yearlyAverages[y] = yearlyRaw[y].ggLav > 0 ? yearlyRaw[y].totVar / yearlyRaw[y].ggLav : 0;
            });

            let wNetto = 0;
            let wTicketLiq = 0;
            let wTicketPotenziale = 0;

            const uniqueYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).sort((a, b) => a - b);

            uniqueYears.forEach((yearVal) => {
                const year = Number(yearVal);
                if (year < startClaimYear) return;

                let ferieCumulateAnno = 0;
                let media = yearlyAverages[year - 1];
                if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

                const monthsInYear = safeAnni
                    .filter((r: any) => Number(r.year) === year)
                    .sort((a: any, b: any) => a.monthIndex - b.monthIndex);

                monthsInYear.forEach((row: any) => {
                    const vacDays = parseLocalFloat(row.daysVacation);
                    const cTicket = parseLocalFloat(row.coeffTicket);
                    const cPercepito = parseLocalFloat(row.coeffPercepito);

                    const spazio = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
                    const ggUtili = Math.min(vacDays, spazio);
                    ferieCumulateAnno += vacDays;

                    if (ggUtili > 0) {
                        const lordo = ggUtili * media;
                        const percepito = ggUtili * cPercepito;
                        const ticketVal = ggUtili * cTicket;

                        wTicketPotenziale += ticketVal;

                        if (includeTickets) {
                            wTicketLiq += ticketVal;
                            wNetto += (lordo - percepito) + ticketVal;
                        } else {
                            wNetto += (lordo - percepito);
                        }
                    }
                });
            });

            const amount = activeStatsModal === 'net' ? wNetto : wTicketLiq;
            const potential = activeStatsModal === 'net' ? 0 : wTicketPotenziale;

            return {
                id: worker.id,
                fullName: `${worker.cognome} ${worker.nome}`,
                role: worker.ruolo,
                profilo: worker.profilo,
                amount,
                potential,
                color: worker.accentColor || 'blue',
                isTicketExcluded: !includeTickets
            };
        })
            .filter(w => w.amount > 0 || (activeStatsModal === 'ticket' && w.potential > 0))
            .sort((a, b) => b.amount - a.amount);
    }, [workers, activeStatsModal, refreshStats]);

    // --- 3. CONFIGURAZIONE MODALE ---
    const modalConfig = useMemo<ModalConfig>(() => {
        if (activeStatsModal === 'net') {
            return {
                title: "Dettaglio Importi Netti",
                subtitle: "Specifica indennità per lavoratore",
                color: "emerald" as const,
                icon: Wallet,
                totalLabel: "Totale Credito",
                totalValue: dashboardStats.totalNet
            };
        }
        return {
            title: "Dettaglio Ticket Pasto",
            subtitle: "Specifica buoni pasto per lavoratore",
            color: "amber" as const,
            icon: Ticket,
            totalLabel: "Totale Ticket",
            totalValue: dashboardStats.totalTicket
        };
    }, [activeStatsModal, dashboardStats]);

    return { dashboardStats, statsList, modalConfig };
};
