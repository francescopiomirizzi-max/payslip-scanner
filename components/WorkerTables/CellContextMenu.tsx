import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, ClipboardPaste, Eraser, MessageSquareText } from 'lucide-react';
import { MONTH_NAMES } from '../../types';

interface CellContextMenuProps {
  menu: { visible: boolean; x: number; y: number; rowIndex: number; colId: string } | null;
  onCopy: () => void;
  onPaste: () => void;
  onClearMonth: (rowIndex: number) => void;
  onOpenNote: (rowIndex: number) => void;
  onClose: () => void;
}

// Menu contestuale cella (tasto destro) estratto da MonthlyDataGrid. Presentazionale:
// copia/incolla/svuota/note delegati al parent via callback.
const CellContextMenu: React.FC<CellContextMenuProps> = ({ menu, onCopy, onPaste, onClearMonth, onOpenNote, onClose }) => {
  return (
    <>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {menu && menu.visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ top: menu.y, left: menu.x }}
                className="fixed z-[99999] w-64 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/60 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] p-1.5 overflow-hidden text-sm font-medium flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Menu */}
                <div className="px-3 py-2.5 text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1 flex justify-between items-center select-none">
                  <span>Azioni Cella</span>
                  <span className="text-indigo-600 dark:text-cyan-400 bg-indigo-100/50 dark:bg-cyan-900/30 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-cyan-800/50">
                    {MONTH_NAMES[menu.rowIndex]}
                  </span>
                </div>

                {/* Bottone Copia */}
                <button onClick={() => { onCopy(); onClose(); }} className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-all duration-200">
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                    <Copy size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Copia Valore</span>
                </button>

                {/* Bottone Incolla */}
                <button onClick={() => { onPaste(); onClose(); }} className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-all duration-200">
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                    <ClipboardPaste size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Incolla Numero</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-1 mx-3 rounded-full"></div>

                {/* Bottone Svuota */}
                <button
                  onClick={() => { onClearMonth(menu.rowIndex); onClose(); }}
                  className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-3 transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 shadow-sm border border-transparent group-hover:border-red-200 dark:group-hover:border-red-800/50 transition-colors">
                    <Eraser size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200 font-semibold">Svuota Intero Mese</span>
                </button>

                {/* Bottone Note */}
                <button
                  onClick={() => {
                    onOpenNote(menu.rowIndex);
                    onClose();
                  }}
                  className="group relative w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-3 transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 shadow-sm border border-transparent group-hover:border-amber-200 dark:group-hover:border-amber-800/50 transition-colors">
                    <MessageSquareText size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  </div>
                  <span className="group-hover:translate-x-0.5 transition-transform duration-200">Gestisci Note / Eventi</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default CellContextMenu;
