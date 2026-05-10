import React from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';

export const ConfirmImportModal = ({ isOpen, onClose, onConfirm, count }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; count: number }) => {
    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative"
            >
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="p-8 text-center relative z-10">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shadow-inner">
                        <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Ripristino Backup</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                        Stai per sovrascrivere il database attuale caricando <span className="font-black text-blue-600 dark:text-blue-400 text-base">{count}</span> lavoratori dal file di backup.<br />Questa operazione non è reversibile.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                            Annulla
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 hover:scale-105 transition-all shadow-lg shadow-blue-500/30">
                            Conferma Ripristino
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
