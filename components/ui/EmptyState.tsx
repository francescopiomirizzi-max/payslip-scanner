import React from 'react';
import { motion } from 'framer-motion';
import { SearchX } from 'lucide-react';

export const EmptyState = ({ isSearch = false, onReset }: { isSearch?: boolean, onReset?: () => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <SearchX className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 mb-2">
            {isSearch ? "Nessun lavoratore trovato" : "L'elenco è vuoto"}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
            {isSearch
                ? "Non ci sono corrispondenze per la tua ricerca. Prova a controllare l'ortografia."
                : "Non hai ancora inserito nessun lavoratore nel database."}
        </p>
        {isSearch && onReset && (
            <button
                onClick={onReset}
                className="px-6 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
            >
                Resetta Ricerca
            </button>
        )}
    </motion.div>
);
