// ============================================================
// config/cassetti.ts
// CLASSIFICAZIONE UNICA DELLE PRATICHE PER STATO ("cassetti").
//
// Fonte di verità condivisa: la dashboard la usa per i cassetti (drawer) e la
// scheda azienda per il chip di stato del lavoratore. Così l'etichetta di uno
// stato (es. 'inviata' → "Buste Paga Mancanti") è IDENTICA ovunque, senza drift.
// ============================================================

import type React from 'react';
import { Clock, FileBarChart, AlertCircle, Handshake, CheckCircle2 } from 'lucide-react';

export type CassettoId = 'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa';

export interface CassettoConfig {
    id: CassettoId;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
    accentHex: string;
    matches: (status: string | undefined) => boolean;
    defaultOpen: boolean;
}

// "Da Analizzare" è il punto di atterraggio di ogni pratica nuova (stato vuoto/
// aperta/in_corso) ed è l'unico aperto di default.
export const CASSETTI: CassettoConfig[] = [
    { id: 'analisi',    label: 'Da Analizzare',         icon: Clock,         accentHex: '#94a3b8', matches: (s) => !s || s === 'aperta' || s === 'in_corso', defaultOpen: true  },
    { id: 'pronta',     label: 'Conteggi Pronti',       icon: FileBarChart,  accentHex: '#f59e0b', matches: (s) => s === 'pronta',                            defaultOpen: false },
    { id: 'inviata',    label: 'Buste Paga Mancanti',   icon: AlertCircle,   accentHex: '#ef4444', matches: (s) => s === 'inviata',                           defaultOpen: false },
    { id: 'trattativa', label: 'Concluse',              icon: Handshake,     accentHex: '#14b8a6', matches: (s) => s === 'trattativa',                        defaultOpen: false },
    { id: 'chiusa',     label: 'Pagate',                icon: CheckCircle2,  accentHex: '#10b981', matches: (s) => s === 'chiusa',                            defaultOpen: false },
];

/** Cassetto (classificazione) a cui appartiene una pratica dato il suo stato. */
export const getCassettoByStatus = (status?: string): CassettoConfig =>
    CASSETTI.find(c => c.matches(status)) ?? CASSETTI[0];
