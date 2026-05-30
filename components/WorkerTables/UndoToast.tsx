import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, X } from 'lucide-react';

interface UndoToastProps { toast: { show: boolean; msg: string }; onUndo: () => void; onClose: () => void; }

// Toast Undo rapido (stile Gmail). Estratto da MonthlyDataGrid (presentazionale).
const UndoToast: React.FC<UndoToastProps> = ({ toast, onUndo, onClose }) => {
  return (
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-700/50"
            >
              <span className="text-sm font-medium text-slate-200">{toast.msg}</span>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button
                onClick={onUndo}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-black text-sm transition-colors tracking-wide active:scale-95"
              >
                <Undo2 size={16} strokeWidth={2.5} /> Ripristina
              </button>
              <button
                onClick={onClose}
                className="ml-1 p-1 text-slate-500 hover:text-slate-300 transition-colors bg-white/5 hover:bg-white/10 rounded-full"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
  );
};

export default UndoToast;
