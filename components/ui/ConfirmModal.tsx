import React from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';

// --- COMPONENTE MODALE DI CONFERMA (DINAMICO) ---
export const ConfirmModal = ({ isOpen, onClose, onConfirm, color = 'red' }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; color?: string }) => {
    if (!isOpen) return null;

    const styles: any = {
        indigo: { bgIcon: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400', btn: 'from-indigo-600 to-violet-600 shadow-indigo-500/30' },
        emerald: { bgIcon: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400', btn: 'from-emerald-600 to-teal-600 shadow-emerald-500/30' },
        orange: { bgIcon: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400', btn: 'from-orange-500 to-red-500 shadow-orange-500/30' },
        blue: { bgIcon: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400', btn: 'from-blue-600 to-cyan-600 shadow-blue-500/30' },
        red: { bgIcon: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-500', btn: 'from-red-500 to-pink-600 shadow-red-500/30' }
    };

    const currentStyle = styles[color] || styles.red;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${currentStyle.bgIcon}`}>
                        <Delete className={`w-8 h-8 ${currentStyle.icon}`} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Eliminare Lavoratore?</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        L'operazione è definitiva. Tutti i dati associati verranno rimossi dal sistema.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition-colors">
                            Annulla
                        </button>
                        <button onClick={onConfirm} className={`px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r hover:scale-105 transition-all shadow-lg dark:shadow-[0_0_15px_rgba(239,68,68,0.4)] ${currentStyle.btn}`}>
                            Conferma Eliminazione
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
