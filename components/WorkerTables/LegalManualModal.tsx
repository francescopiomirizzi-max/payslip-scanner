import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, BookOpen, TrendingUp, X } from 'lucide-react';

interface LegalManualModalProps { isOpen: boolean; onClose: () => void; }

// Manuale legale (Art.64 + divisore), contenuto statico. Estratto da MonthlyDataGrid.
const LegalManualModal: React.FC<LegalManualModalProps> = ({ isOpen, onClose }) => {
  return (
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                {/* Header Modale */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400"><Scale className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-lg">Manuale Legale & Riferimenti</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perizia Tecnica Ferie non Godute</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* Contenuto Scrollabile */}
                <div className="p-8 overflow-y-auto space-y-8">

                  {/* Sezione 1: Art. 64 */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2 mb-3 text-indigo-700 dark:text-indigo-400">
                      <BookOpen size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Articolo 64 CCNL Mobilità</h4>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed text-justify mb-4">
                      "Durante le ferie il lavoratore ha diritto alla retribuzione che avrebbe percepito se avesse lavorato,
                      comprensiva delle indennità fisse e variabili legate alla modalità di esecuzione della prestazione."
                    </p>
                    <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3 italic">
                      Nota: Questo principio è stato rafforzato dalla giurisprudenza europea e dalla Corte di Cassazione,
                      impedendo che il lavoratore subisca svantaggi economici durante il riposo.
                    </div>
                  </div>

                  {/* Sezione 2: Il Divisore */}
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-900/30 transition-colors">
                    <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-500">
                      <TrendingUp size={20} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Il Calcolo del Divisore</h4>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                        Il <strong>divisore</strong> è il numero utilizzato per trasformare il totale delle indennità mensili in una quota giornaliera media.
                      </p>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <li>
                          <strong className="dark:text-white">Divisore Convenzionale (26):</strong> Spesso usato dalle aziende per semplicità, ma penalizzante se si lavorano meno giorni.
                        </li>
                        <li>
                          <strong className="dark:text-white">Divisore Effettivo (Consigliato):</strong> Si utilizza il numero reale di giorni lavorati nel mese (es. 20, 21, 22). Questo metodo alza il valore medio giornaliero ed è quello preferito nei ricorsi (Cass. 20216/2022).
                        </li>
                      </ul>
                      <div className="bg-white dark:bg-slate-950 p-3 rounded border border-amber-100 dark:border-amber-900/50 text-xs font-mono text-slate-600 dark:text-slate-400 transition-colors">
                        Formula: Totale Indennità / Giorni Lavorati = Media Giornaliera
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-right shrink-0 transition-colors">
                  <button onClick={onClose} className="px-6 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold transition-all shadow-lg">Chiudi Manuale</button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );
};

export default LegalManualModal;
