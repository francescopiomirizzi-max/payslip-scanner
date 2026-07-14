import React from 'react';

/**
 * Fascia istituzionale condivisa dalle tre aree FAST-CONFSAL.
 * Il layout resta volutamente unico: ufficio a sinistra, logo al centro e segreteria a destra.
 * Il logo è nudo, a colori in light e bianco in dark (pattern `CompanyLogo`).
 */
export const SindacatoTag: React.FC<{ className?: string }> = ({ className = '' }) => (
    <section
        aria-label="Ufficio Vertenze FAST-CONFSAL — Segreteria Regionale Puglia e Basilicata"
        className={`relative grid w-full grid-cols-2 items-center gap-x-5 gap-y-4 overflow-hidden rounded-[2.25rem] px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:rounded-[2.75rem] sm:px-8 sm:py-6 lg:px-11 ${className}`}
    >
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-50/75 via-white/35 to-sky-50/75 dark:from-amber-950/10 dark:via-slate-900/10 dark:to-blue-950/20"
        />

        <div className="relative col-start-1 row-start-2 min-w-0 justify-self-start text-left sm:row-start-1">
            <span className="block text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-slate-500 dark:text-slate-400 sm:text-xs lg:text-sm">
                Ufficio
            </span>
            <span className="mt-2 block text-base font-semibold leading-none text-slate-900 dark:text-white sm:text-xl lg:text-2xl">
                Vertenze
            </span>
        </div>

        <div className="relative col-span-2 col-start-1 row-start-1 flex justify-self-center sm:col-span-1 sm:col-start-2">
            <img
                src="/logos/fast-confsal.png"
                alt="FAST-CONFSAL"
                className="h-16 w-auto origin-center scale-[1.14] object-contain select-none dark:brightness-0 dark:invert sm:h-20 sm:scale-[1.2] lg:h-24 lg:scale-[1.25]"
                draggable={false}
            />
        </div>

        <div className="relative col-start-2 row-start-2 min-w-0 justify-self-end text-right sm:col-start-3 sm:row-start-1">
            <span className="block text-[9px] font-medium uppercase leading-tight tracking-[0.16em] text-slate-500 dark:text-slate-400 sm:text-xs sm:tracking-[0.2em] lg:text-sm">
                Segreteria Regionale
            </span>
            <span className="mt-2 block text-sm font-semibold leading-tight text-slate-900 dark:text-white sm:text-xl lg:text-2xl">
                Puglia e Basilicata
            </span>
        </div>
    </section>
);

export default SindacatoTag;
