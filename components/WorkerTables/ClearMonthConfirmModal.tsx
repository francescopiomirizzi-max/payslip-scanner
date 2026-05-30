import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser } from 'lucide-react';
import { MONTH_NAMES } from '../../types';

interface ClearMonthConfirmModalProps { rowToClear: number | null; year: number; onCancel: () => void; onConfirm: () => void; }

// Conferma azzeramento mese. Estratto da MonthlyDataGrid (presentazionale).
const ClearMonthConfirmModal: React.FC<ClearMonthConfirmModalProps> = ({ rowToClear, year, onCancel, onConfirm }) => {
  return (
        <AnimatePresence>
          {rowToClear !== null && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 text-center relative overflow-hidden">
                  {/* Effetto luce rossa dietro */}
                  <div className="absolute top-[-50%] left-[50%] -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-gradient-to-br from-red-100 to-rose-100 text-red-500 shadow-inner ring-4 ring-white relative z-10">
                    <Eraser className="w-10 h-10" strokeWidth={2} />
                  </div>

                  <h3 className="text-xl font-black text-slate-800 mb-2 relative z-10">Svuotare il mese?</h3>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed relative z-10">
                    Stai per azzerare tutti i valori inseriti per il mese di <br />
                    <b className="text-slate-700 text-base">{MONTH_NAMES[rowToClear]} {year}</b>.
                  </p>

                  <div className="flex gap-3 justify-center relative z-10">
                    <button onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                      Annulla
                    </button>
                    <button onClick={onConfirm} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:scale-105 transition-all shadow-[0_10px_25px_-5px_rgba(239,68,68,0.5)]">
                      Sì, Svuota Dati
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
};

export default ClearMonthConfirmModal;
