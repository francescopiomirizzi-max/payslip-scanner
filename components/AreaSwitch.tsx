import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Clock } from 'lucide-react';

export type AppArea = 'incidenza' | 'riposi';

interface AreaSwitchProps {
    area: AppArea;
    onChange: (area: AppArea) => void;
}

const OPTIONS: { id: AppArea; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'incidenza', label: 'Incidenza', icon: Wallet },
    { id: 'riposi', label: 'Turni & Riposi', icon: Clock },
];

/**
 * Switch globale tra le due aree dell'app: "Incidenza" (buste paga / % RFI) e
 * "Turni & Riposi" (mancati riposi TPL, Reg. CE 561/2006). Le due aree condividono
 * la piattaforma ma hanno dati e navigazione separati → questo è l'unico punto di
 * passaggio fra loro. Compatto e fisso, non interferisce con l'header o l'isola.
 */
const AreaSwitch: React.FC<AreaSwitchProps> = ({ area, onChange }) => {
    return (
        <div className="fixed bottom-4 left-4 z-[60]">
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/60 shadow-lg shadow-slate-500/10">
                {OPTIONS.map(({ id, label, icon: Icon }) => {
                    const isActive = area === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onChange(id)}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                                isActive
                                    ? 'text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                            aria-pressed={isActive}
                        >
                            {isActive && (
                                <motion.span
                                    layoutId="area-switch-active"
                                    className="absolute inset-0 rounded-full bg-indigo-600 shadow-md shadow-indigo-500/40"
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                />
                            )}
                            <Icon className="relative w-4 h-4" />
                            <span className="relative hidden sm:inline">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AreaSwitch;
