import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard } from 'lucide-react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const shortcuts = [
    { keys: [`${mod}K`], label: 'Apri Dynamic Island' },
    { keys: [`${mod}S`], label: 'Salva dati lavoratore' },
    { keys: [`${mod}E`], label: 'Esporta relazione' },
    { keys: ['Esc'], label: 'Chiudi modal aperto' },
];

export const KeyboardShortcutsHint = () => {
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 min-w-[220px]"
                    >
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                            Keyboard Shortcuts
                        </p>
                        <div className="flex flex-col gap-2">
                            {shortcuts.map(({ keys, label }) => (
                                <div key={label} className="flex items-center justify-between gap-4">
                                    <span className="text-[13px] text-slate-600 dark:text-slate-300">{label}</span>
                                    <div className="flex gap-1">
                                        {keys.map(k => (
                                            <kbd
                                                key={k}
                                                className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                                            >
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setOpen(v => !v)}
                className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
                title="Keyboard shortcuts"
            >
                <Keyboard className="w-4 h-4" />
            </motion.button>
        </div>
    );
};
