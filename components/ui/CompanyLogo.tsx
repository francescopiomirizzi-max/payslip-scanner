import React from 'react';
import { getCompanyLogo, getCompanyLogoScale } from '../../config/profiles';

interface CompanyLogoProps {
    profilo?: string | null;
    /** Distingue i due brand Elior (magazzino → ELIOR SERVICES). */
    eliorType?: 'viaggiante' | 'magazzino';
    /** Altezza nominale in px; la scala per-logo di config/profiles la compensa. */
    h?: number;
    /** Silhouette bianca anche in light (per sfondi colorati saturi, es. filtro attivo). */
    forceWhite?: boolean;
    className?: string;
    title?: string;
}

/**
 * Logo aziendale ufficiale (public/logos/), nudo, senza pastiglia: in light i
 * colori originali reggono sul fondo chiaro, in dark diventa silhouette bianca
 * via filtro CSS (le pastiglie bianche erano rettangoli fastidiosi in entrambi
 * i temi — feedback 2026-06-10). Se il profilo non ha logo (custom) renderizza
 * null: il chiamante mantiene il suo fallback colorato.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({ profilo, eliorType, h = 14, forceWhite = false, className = '', title }) => {
    const src = getCompanyLogo(profilo, eliorType);
    if (!src) return null;
    return (
        <span className={`inline-flex items-center ${className}`} title={title}>
            <img
                src={src}
                alt={profilo ?? ''}
                style={{ height: Math.round(h * getCompanyLogoScale(profilo)) }}
                className={`w-auto select-none ${forceWhite ? 'brightness-0 invert' : 'dark:brightness-0 dark:invert'}`}
                loading="lazy"
                draggable={false}
            />
        </span>
    );
};
