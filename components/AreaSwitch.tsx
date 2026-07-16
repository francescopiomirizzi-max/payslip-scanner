import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Clock, MapPin, Building2 } from 'lucide-react';

export type AppArea = 'incidenza' | 'riposi' | 'indennita';

interface AreaSwitchProps {
    area: AppArea;
    onChange: (area: AppArea) => void;
    onHome?: () => void;   // torna alla scelta dell'organizzazione (owner); assente per il viewer
}

// Ogni area ha il suo colore, così la pillola segnala "dove sei":
//   Incidenza (buste/€) = smeraldo · Turni & Riposi (561/2006) = indaco ·
//   Indennità (vertenza assenza residenza Elior) = rame/ambra.
const META: Record<AppArea, { label: string; icon: React.ComponentType<{ className?: string }>; activeBg: string; hoverText: string }> = {
    incidenza: {
        label: 'Incidenza',
        icon: Wallet,
        activeBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/40',
        hoverText: 'hover:text-emerald-600 dark:hover:text-emerald-400',
    },
    riposi: {
        label: 'Turni & Riposi',
        icon: Clock,
        activeBg: 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-indigo-500/40',
        hoverText: 'hover:text-indigo-600 dark:hover:text-indigo-400',
    },
    indennita: {
        label: 'Indennità',
        icon: MapPin,
        activeBg: 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/40',
        hoverText: 'hover:text-amber-600 dark:hover:text-amber-400',
    },
};

const ORDER: AppArea[] = ['incidenza', 'riposi', 'indennita'];

/**
 * Switch globale tra le due aree dell'app. Compatto, fisso in basso a sinistra,
 * con colore proprio per ciascuna sezione (smeraldo = Incidenza, indaco = Riposi).
 */
const AreaSwitch: React.FC<AreaSwitchProps> = ({ area, onChange, onHome }) => {
    return (
        <div className="fixed bottom-safe-4 left-safe-4 z-[60] print:hidden">
            {/* max-w (viewport − margini − inset laterali) + scroll interno = garanzia
                right ≤ area utile a qualsiasi larghezza/zoom, anche edge-to-edge;
                sotto `sm` le etichette delle aree non attive spariscono (variante compatta). */}
            <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/75 dark:bg-slate-800/75 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-xl shadow-slate-900/10 max-w-safe-viewport overflow-x-auto no-scrollbar">
                {onHome && (
                    <button
                        type="button"
                        onClick={onHome}
                        title="Cambia organizzazione"
                        aria-label="Cambia organizzazione"
                        className="flex items-center justify-center shrink-0 w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 rounded-full text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors mr-0.5"
                    >
                        <Building2 className="w-4 h-4" />
                    </button>
                )}
                {ORDER.map((id) => {
                    const { label, icon: Icon, activeBg, hoverText } = META[id];
                    const isActive = area === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onChange(id)}
                            aria-pressed={isActive}
                            aria-label={label}
                            className={`relative flex items-center shrink-0 gap-2 px-4 py-2 pointer-coarse:min-h-11 rounded-full text-sm font-bold transition-colors ${
                                isActive ? 'text-white' : `text-slate-500 dark:text-slate-400 ${hoverText}`
                            }`}
                        >
                            {isActive && (
                                <motion.span
                                    layoutId="area-switch-active"
                                    className={`absolute inset-0 rounded-full shadow-lg ${activeBg}`}
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                />
                            )}
                            <Icon className="relative w-4 h-4" />
                            <span className={`relative ${isActive ? '' : 'max-sm:hidden'}`}>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AreaSwitch;
