import React from 'react';

/**
 * Co-brand del committente in alto nelle aree: "Ufficio Vertenze" + logo del sindacato/CAF.
 * Oggi fisso su FAST-CONFSAL (unico committente); col multi-sindacato prenderà l'organizzazione
 * attiva (nome/logo dal record `sindacati`). Il logo è nudo: a colori in light, bianco in dark
 * (pattern `CompanyLogo`). "Ufficio Vertenze" sta accanto al logo del SINDACATO, non al brand Valora.
 */
export const SindacatoTag: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`flex items-center gap-4 ${className}`}>
        <span className="text-sm font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300 whitespace-nowrap leading-tight text-right">
            Ufficio<br />Vertenze
        </span>
        {/* In dark mode il logo (tricolore + testo blu) sparirebbe: pastiglia bianca per tenerlo fedele e leggibile. */}
        <div className="dark:bg-white dark:rounded-lg dark:p-1.5 dark:shadow-sm">
            <img
                src="/logos/fast-confsal.png"
                alt="FAST-CONFSAL"
                className="h-20 w-auto object-contain select-none"
                draggable={false}
            />
        </div>
    </div>
);

export default SindacatoTag;
