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
 * Pastiglia bianca col logo aziendale ufficiale (public/logos/). La base bianca
 * serve in dark mode e sugli sfondi colorati: i loghi hanno testo scuro.
 * Se il profilo non ha logo (Clean Service, custom) renderizza null:
 * il chiamante mantiene il suo fallback colorato esistente.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({ profilo, imgClass = 'h-3.5', padClass = 'px-1.5 py-[3px]', className = '', title }) => {
    const src = getCompanyLogo(profilo);
    if (!src) return null;
    return (
        <span
            className={`inline-flex items-center bg-white rounded-md ring-1 ring-slate-900/10 dark:ring-white/15 shadow-sm ${padClass} ${className}`}
            title={title}
        >
            <img src={src} alt={profilo ?? ''} className={`${imgClass} w-auto select-none`} loading="lazy" draggable={false} />
        </span>
    );
};
