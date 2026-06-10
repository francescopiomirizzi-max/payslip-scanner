import React from 'react';
import { getCompanyLogo } from '../../config/profiles';

interface CompanyLogoProps {
    profilo?: string | null;
    /** Altezza del logo come classe Tailwind (es. 'h-3.5'); la pastiglia si adatta. */
    imgClass?: string;
    /** Padding della pastiglia (separato da className per evitare conflitti di utility). */
    padClass?: string;
    className?: string;
    title?: string;
}

/**
 * Logo aziendale ufficiale (public/logos/), in due vesti per tema:
 * - light: pastiglia bianca (i loghi hanno testo scuro, serve la base chiara);
 * - dark: niente pastiglia, logo monocromo bianco via filtro CSS — le pastiglie
 *   bianche su fondo scuro erano rettangoli fastidiosi (feedback 2026-06-10).
 * Se il profilo non ha logo (Clean Service, custom) renderizza null:
 * il chiamante mantiene il suo fallback colorato esistente.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({ profilo, imgClass = 'h-3.5', padClass = 'px-1.5 py-[3px]', className = '', title }) => {
    const src = getCompanyLogo(profilo);
    if (!src) return null;
    return (
        <span
            className={`inline-flex items-center rounded-md bg-white ring-1 ring-slate-900/10 shadow-sm dark:bg-transparent dark:ring-0 dark:shadow-none ${padClass} ${className}`}
            title={title}
        >
            <img src={src} alt={profilo ?? ''} className={`${imgClass} w-auto select-none dark:brightness-0 dark:invert`} loading="lazy" draggable={false} />
        </span>
    );
};
