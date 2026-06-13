import React from 'react';

interface DevBadgeProps {
    /** Testo racchiuso nella pillola. */
    label?: string;
    className?: string;
}

/**
 * Pillola "sezione in sviluppo" con pallino giallo lampeggiante: segnala una
 * sezione nuova / in evoluzione. Visibile anche al viewer in sola lettura
 * (Vincenzo), così capisce che la sezione è nuova e che arriveranno altre funzioni.
 */
export const DevBadge: React.FC<DevBadgeProps> = ({
    label = 'Sezione in sviluppo — nuove funzioni in arrivo',
    className = '',
}) => (
    <span
        title="Sezione nuova: in sviluppo, nuove funzioni in arrivo."
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 dark:bg-amber-500/15 border border-amber-300/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold shadow-sm ${className}`}
    >
        {/* Pallino giallo lampeggiante */}
        <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
        </span>
        {label}
    </span>
);
