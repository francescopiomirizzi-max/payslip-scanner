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
        {/* Il nuovo logo FAST-CONFSAL porta il proprio cerchio bianco → leggibile su chiaro e su scuro senza
            pastiglia. Sotto, la dicitura ufficiale della sede (Segreteria Regionale Puglia e Basilicata). */}
        <div className="flex flex-col items-center">
            <img
                src="/logos/fast-confsal.png"
                alt="FAST-CONFSAL"
                className="h-20 w-auto object-contain select-none"
                draggable={false}
            />
            <span className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-center leading-tight tracking-tight">
                Segreteria Regionale<br />Puglia e Basilicata
            </span>
        </div>
    </div>
);

export default SindacatoTag;
