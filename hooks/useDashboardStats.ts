import { useMemo } from 'react';
import { Wallet, Ticket } from 'lucide-react';
import { Worker } from '../types';
import { parseLocalFloat } from '../utils/formatters';
import { computeHolidayIndemnity } from '../utils/calculationEngine';

type StatsModalType = 'net' | 'ticket' | null;

export interface WorkerStatItem {
    id: string;
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

            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];
            const allYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).filter(y => !isNaN(y as number)).sort((a, b) => (a as number) - (b as number)) as number[];

            const yearResults = computeHolidayIndemnity({
                data: safeAnni,
                profilo: worker.profilo || 'RFI',
                eliorType: worker.eliorType,
                includeExFest,
                includeTickets,
                startClaimYear,
                years: allYears,
            });

            let wNetto = 0;
            let wTicket = 0;
            yearResults.forEach(r => {
                if (r.isReferenceYear) return;
                wNetto += r.sumNetto;
                wTicket += r.sumBuoniPasto;
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

            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];
            const allYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).filter(y => !isNaN(y as number)).sort((a, b) => (a as number) - (b as number)) as number[];

            // Run engine with tickets enabled to get potential; actual netto uses real includeTickets
            const yearResultsFull = computeHolidayIndemnity({
                data: safeAnni,
                profilo: worker.profilo || 'RFI',
                eliorType: worker.eliorType,
                includeExFest,
                includeTickets: true,
                startClaimYear,
                years: allYears,
            });

            let wNetto = 0;
            let wTicketLiq = 0;
            let wTicketPotenziale = 0;

            yearResultsFull.forEach(r => {
                if (r.isReferenceYear) return;
                wTicketPotenziale += r.sumBuoniPasto;
                const ticketForNetto = includeTickets ? r.sumBuoniPasto : 0;
                wNetto += (r.sumIndennitaSpettante - r.sumIndennitaPercepita) + ticketForNetto;
                if (includeTickets) wTicketLiq += r.sumBuoniPasto;
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
