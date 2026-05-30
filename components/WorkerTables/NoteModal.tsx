import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, X, Tag, Eraser, Save } from 'lucide-react';
import { MONTH_NAMES } from '../../types';

const QUICK_TAGS = ["Infortunio", "Malattia", "Congedo", "Sciopero", "Assenza Ingiust.", "Permesso 104"];

interface NoteModalProps {
  state: { isOpen: boolean; monthIndex: number; text: string };
  year: number;
  isReadOnly: boolean;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onClear: () => void;
  onSave: () => void;
}

// Modale Note mensile, estratta da MonthlyDataGrid. Presentazionale: stato e salvataggio
// (handleCellChange) restano nel parent.
const NoteModal: React.FC<NoteModalProps> = ({ state, year, isReadOnly, onChangeText, onClose, onClear, onSave }) => {
  return (
        <AnimatePresence>
          {state.isOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400"><MessageSquareText className="w-5 h-5" /></div><div><h3 className="font-bold text-slate-800 dark:text-white">Nota Mensile</h3><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{state.monthIndex >= 0 ? MONTH_NAMES[state.monthIndex] : ''} {year}</p></div></div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Descrizione Evento</label>
                  <textarea readOnly={isReadOnly} value={state.text} onChange={(e) => onChangeText(e.target.value)} className="w-full h-32 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:border-indigo-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-cyan-900 outline-none resize-none text-slate-700 dark:text-slate-200 text-sm transition-all placeholder-slate-400 dark:placeholder-slate-600" placeholder="Scrivi qui il motivo..." autoFocus />
                  <div className="mt-4"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inserimento Rapido</p><div className="flex flex-wrap gap-2">{QUICK_TAGS.map(tag => (<button key={tag} onClick={() => onChangeText(state.text ? `${state.text}, ${tag}` : tag)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-cyan-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-cyan-800"><Tag className="w-3 h-3" />{tag}</button>))}</div></div>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  {!isReadOnly && <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-sm font-bold transition-colors"><Eraser className="w-4 h-4" /> Pulisci</button>}
                  <div className="flex gap-3 ml-auto"><button onClick={onClose} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold text-sm transition-colors">{isReadOnly ? 'Chiudi' : 'Annulla'}</button>{!isReadOnly && <button onClick={onSave} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 dark:bg-cyan-600 hover:bg-indigo-700 dark:hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 dark:shadow-cyan-900/40 transition-all active:scale-95"><Save className="w-4 h-4" /> Salva Nota</button>}</div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
};

export default NoteModal;
