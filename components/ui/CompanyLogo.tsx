import React from 'react';
import { getCompanyLogo } from '../../config/profiles';

interface CompanyLogoProps {
    profilo?: string | null;
    /** Altezza del logo come classe Tailwind (es. 'h-3.5'). */
    imgClass?: string;
    /** Silhouette bianca anche in light (per sfondi colorati saturi, es. filtro attivo). */
    forceWhite?: boolean;
    className?: string;
    title?: string;
}

/**
 * Logo aziendale ufficiale (public/logos/), nudo, senza pastiglia: in light i
 * colori originali reggono sul fondo chiaro, in dark diventa silhouette bianca
 * via filtro CSS (le pastiglie bianche erano rettangoli fastidiosi in entrambi
 * i temi — feedback 2026-06-10). Se il profilo non ha logo (Clean Service,
 * custom) renderizza null: il chiamante mantiene il suo fallback colorato.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({ profilo, imgClass = 'h-3.5', forceWhite = false, className = '', title }) => {
    const src = getCompanyLogo(profilo);
    if (!src) return null;
    return (
        <span className={`inline-flex items-center ${className}`} title={title}>
            <img
                src={src}
                alt={profilo ?? ''}
                className={`${imgClass} w-auto select-none ${forceWhite ? 'brightness-0 invert' : 'dark:brightness-0 dark:invert'}`}
                loading="lazy"
                draggable={false}
            />
        </span>
    );
};
