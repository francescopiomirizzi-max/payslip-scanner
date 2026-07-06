import React from 'react';

interface DevBadgeProps {
    /** Testo racchiuso nella pillola. */
    label?: string;
    className?: string;
}

/**
 * Pillola "Novità": segnala una sezione di recente introduzione. Visibile anche
 * al viewer in sola lettura (Vincenzo). Wording volutamente positivo: per un
 * occhio esterno "in sviluppo" + lampeggio comunicavano insicurezza (review 06/07).
 */
export const DevBadge: React.FC<DevBadgeProps> = ({
    label = 'Novità',
    className = '',
}) => (
    <span
        title="Sezione di recente introduzione — nuove funzioni in arrivo."
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 dark:bg-amber-500/15 border border-amber-300/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold shadow-sm ${className}`}
    >
        <span className="relative inline-flex rounded-full h-2 w-2 shrink-0 bg-yellow-500" />
        {label}
    </span>
);
