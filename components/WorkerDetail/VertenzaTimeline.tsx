import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, Ticket, CalendarPlus, Send, Gavel,
  Handshake, CheckCircle2, Search, ChevronDown,
} from 'lucide-react';
import { useIsReadOnly } from '../../lib/readonly';
import { useWorkerDetail } from './WorkerDetailContext';

// Sezione TIMELINE STATO VERTENZA (+ ticker e toggle parametri) estratta da
// WorkerDetailLayout. Porta con sé il sub-componente TimelineStep. Legge dal context.
const VertenzaTimeline: React.FC = () => {
  const {
    isTimelineOpen, onToggleTimeline, tickerItems, onSetActiveTickerModal,
    includeExFest, onToggleExFest, includeTickets, onToggleTickets,
    legalStatus, onLegalStatusChange, onUpdateStatus,
  } = useWorkerDetail();
  const isReadOnly = useIsReadOnly();

  const TimelineStep = ({ step, label, icon: Icon, activeStatus }: any) => {
    const steps = ['analisi', 'pronta', 'inviata', 'trattativa', 'chiusa'];
    const isActive = step === activeStatus;
    const isPast = steps.indexOf(activeStatus) > steps.indexOf(step);
    let colorClass = 'text-slate-400 dark:text-slate-200 border-slate-300 dark:text-slate-500 dark:text-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800';
    if (isActive || isPast) {
      if (step === 'analisi') colorClass = 'text-white bg-slate-500 border-slate-500 dark:bg-slate-600 dark:border-slate-500 dark:shadow-[0_0_10px_rgba(100,116,139,0.5)]';
      else if (step === 'pronta') colorClass = 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-500 dark:shadow-[0_0_10px_rgba(217,119,6,0.5)]';
      else if (step === 'inviata') colorClass = 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-500 dark:shadow-[0_0_10px_rgba(220,38,38,0.5)]';
      else if (step === 'trattativa') colorClass = 'text-white bg-teal-500 border-teal-500 dark:bg-teal-600 dark:border-teal-500 dark:shadow-[0_0_10px_rgba(20,184,166,0.5)]';
      else if (step === 'chiusa') colorClass = 'text-white bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-500 dark:shadow-[0_0_10px_rgba(5,150,105,0.5)]';
    }
    return (
      <div
        onClick={isReadOnly ? undefined : () => { onLegalStatusChange(step); if (onUpdateStatus) onUpdateStatus(step); }}
        className={`flex flex-col items-center gap-2 transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isActive ? 'scale-110' : isReadOnly ? 'opacity-70' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-slate-800 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-300'}`}>{label}</span>
      </div>
    );
  };

  return (
    <>
        <div className="lg:col-span-2 glass-panel px-6 py-4 shadow-sm dark:shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-white/60 dark:border-cyan-400 relative overflow-hidden transition-all duration-300">
          <div className="flex justify-between items-center">
            <button
              onClick={onToggleTimeline}
              className="group flex items-center gap-2 text-sm font-black text-slate-700 dark:text-cyan-400 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors focus:outline-none"
            >
              <div className="p-1.5 bg-indigo-100 dark:bg-cyan-900/40 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-cyan-800/60 transition-colors">
                <Gavel className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
              </div>
              STATO VERTENZA
              <motion.div animate={{ rotate: isTimelineOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-200 dark:text-cyan-500/50 group-hover:text-indigo-500 dark:group-hover:text-cyan-400" />
              </motion.div>
            </button>

            {/* TICKER CENTRALE */}
            <div className="flex-1 hidden xl:flex items-center justify-center overflow-hidden relative h-12 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-cyan-900/30 mx-8 shadow-inner transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white/90 dark:from-[#0f172a]/90 to-transparent z-10 transition-colors"></div>
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/90 dark:from-[#0f172a]/90 to-transparent z-10 transition-colors"></div>
              <div className="w-full overflow-hidden flex items-center">
                <motion.div
                  className="flex gap-12 items-center whitespace-nowrap"
                  animate={{ x: ["0%", "-33.33%"] }}
                  transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
                >
                  {tickerItems.map((stat: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-1 border-r border-slate-200/50 dark:border-slate-700/50 last:border-0 transition-colors cursor-pointer hover:bg-slate-100/10 dark:hover:bg-slate-800/50 rounded-lg"
                      onClick={() => onSetActiveTickerModal({ title: stat.label, content: stat.tooltip })}
                    >
                      <div className={`p-2 rounded-xl shadow-sm border ${stat.color} ${stat.textColor} bg-white dark:bg-slate-900 transition-colors`}>
                        <stat.icon className="w-5 h-5" strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-300 uppercase tracking-widest leading-tight transition-colors flex items-center gap-1">
                          {stat.label} <span className="text-[8px] opacity-60 dark:opacity-90 font-bold">(?)</span>
                        </span>
                        <span className={`text-base font-black ${stat.textColor} leading-tight transition-colors`}>
                          {stat.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* TOGGLES PARAMETRI */}
            <div className="flex items-center p-1 bg-slate-100/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-full border border-slate-200/80 dark:border-cyan-900/50 shadow-sm shrink-0 transition-colors">
              <button
                onClick={onToggleExFest}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ${includeExFest
                  ? 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/60 dark:to-orange-900/60 text-amber-800 dark:text-amber-300 border-amber-300/50 dark:border-amber-500/50 shadow-[0_1px_6px_rgba(251,191,36,0.2)] dark:shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-amber-200/60 dark:hover:border-amber-700/50 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                title="Includi/Escludi Ex-Festività"
              >
                <CalendarPlus size={14} className={`transition-transform duration-300 ${includeExFest ? 'rotate-0' : 'group-hover:rotate-12'}`} strokeWidth={2.5} />
                <span>{includeExFest ? "32gg" : "28gg"}</span>
              </button>
              <button
                onClick={onToggleTickets}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-300 border ml-1 ${includeTickets
                  ? 'bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/60 dark:to-blue-900/60 text-indigo-800 dark:text-indigo-300 border-indigo-300/50 dark:border-indigo-500/50 shadow-[0_1px_6px_rgba(99,102,241,0.2)] dark:shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                  : 'bg-transparent text-slate-400 dark:text-slate-500 dark:text-slate-300 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200/60 dark:hover:border-indigo-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 line-through opacity-70 hover:opacity-100 hover:no-underline'
                  }`}
                title="Includi/Escludi Ticket Restaurant"
              >
                <Ticket size={14} className={`transition-transform duration-300 ${includeTickets ? 'rotate-0' : 'group-hover:-rotate-12'}`} strokeWidth={2.5} />
                Ticket
              </button>
            </div>
          </div>

          {/* TIMELINE A SCOMPARSA */}
          <AnimatePresence mode="wait">
            {isTimelineOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 mb-2 relative flex justify-between items-center z-10 px-4">
                  <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10 transition-colors"></div>
                  <TimelineStep step="analisi" label="Da Analizzare" icon={Search} activeStatus={legalStatus} />
                  <TimelineStep step="pronta" label="Conteggi" icon={Calculator} activeStatus={legalStatus} />
                  <TimelineStep step="inviata" label="Buste Paga Mancanti" icon={Send} activeStatus={legalStatus} />
                  <TimelineStep step="trattativa" label="Conclusa" icon={Handshake} activeStatus={legalStatus} />
                  <TimelineStep step="chiusa" label="Pagata" icon={CheckCircle2} activeStatus={legalStatus} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    </>
  );
};

export default VertenzaTimeline;
