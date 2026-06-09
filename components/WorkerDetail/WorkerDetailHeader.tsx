import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileSpreadsheet, LayoutGrid, Calculator, TrendingUp,
  User, BadgeCheck, CalendarPlus, Wallet, Ticket, CalendarClock,
  Briefcase, Eye, X, Loader2, ScanLine, Send, Gavel,
  Handshake, CheckCircle2, AlertCircle, Search, ChevronDown,
  QrCode, Download, Bot, Cpu, FileText, Save, CheckCircle, AlertTriangle, Archive, Zap, LineChart,
} from 'lucide-react';
import { YEARS } from '../../types';
import { getCompanyGradient } from '../../config/profiles';
import { getProfiloBadgeLabel } from '../../utils/formatters';
import { useIsReadOnly } from '../../lib/readonly';
import { FRAMER_PHYSICS } from '../../framerConfig';
import { useWorkerDetail } from './WorkerDetailContext';

// Sezione HEADER GLASSMORPHISM estratta da WorkerDetailLayout. Possiede lo stato
// locale del menu Azioni (dropdown + click-outside). Legge tutto dal context.
const WorkerDetailHeader: React.FC = () => {
  const {
    worker, badgeStyles, onBack, onShowReport, onSendPec, onPrintTables, onOpenIstat,
    startClaimYear, onStartClaimYearChange,
    onSetActiveTab, activeTab, archiveCount,
  } = useWorkerDetail();
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const isReadOnly = useIsReadOnly();

  // Data di assunzione: campo MANUALE (la si legge dalla busta e si scrive una volta).
  // Persistita per-lavoratore in localStorage, come gli altri flag di scheda. Niente AI:
  // è un valore unico per lavoratore, leggerlo da ogni busta rallenterebbe inutilmente la scansione.
  const [dataAssunzione, setDataAssunzione] = useState('');
  const [editingAssunzione, setEditingAssunzione] = useState(false);
  useEffect(() => {
    try { setDataAssunzione(localStorage.getItem(`assunzione_${worker.id}`) || ''); }
    catch { setDataAssunzione(''); }
    setEditingAssunzione(false);
  }, [worker.id]);
  const saveAssunzione = (v: string) => {
    const val = v.trim();
    setDataAssunzione(val);
    try { localStorage.setItem(`assunzione_${worker.id}`, val); } catch { /* storage non disponibile */ }
  };

  useEffect(() => {
    if (!isActionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node))
        setIsActionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActionsOpen]);

  return (
    <>
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={FRAMER_PHYSICS.smooth}
          className="glass-panel max-w-[1800px] mx-auto rounded-[2rem] p-4 flex justify-between items-center gap-6"
        >
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex flex-col gap-3 w-44">
              {/* TASTO DASHBOARD */}
              <button
                onClick={onBack}
                className="group relative h-11 w-full rounded-xl font-bold text-white shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center justify-center gap-3 text-sm"
                style={{ background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)' }}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
                <span className="tracking-wide">DASHBOARD</span>
              </button>

              {/* SELETTORE ANNO */}
              <div className="relative group h-11 w-full">
                <div className="absolute inset-0 bg-orange-500 rounded-xl blur opacity-20 group-hover:opacity-50 dark:opacity-80 transition duration-500"></div>
                <div className="relative flex items-center justify-between bg-slate-900 text-white rounded-xl border border-slate-700 group-hover:border-orange-500/50 transition-colors w-full h-full px-3 shadow-xl overflow-hidden">
                  <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500 group-hover:text-orange-400 transition-colors">
                      <CalendarClock size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-200 leading-none mb-0.5 tracking-widest">Start Year</span>
                      <span className="text-lg font-black text-white leading-none tracking-tight">{startClaimYear}</span>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-slate-500 dark:text-slate-300 group-hover:text-orange-500 transition-colors z-10 pointer-events-none" />
                  <select
                    value={startClaimYear}
                    onChange={(e) => onStartClaimYearChange(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  >
                    {YEARS.filter(y => y >= 2008 && y <= 2025).map(y => (
                      <option key={y} value={y} className="bg-slate-800 text-white py-2 font-bold">
                        Inizio Calcoli: {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* USER INFO */}
            <div className="flex items-center gap-5 border-l-2 border-slate-200/60 dark:border-slate-700/50 pl-8 h-20 transition-colors">
              {/* Avatar nel colore-azienda (stesso linguaggio della card in dashboard) */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl text-white shadow-indigo-200 dark:shadow-indigo-900/40 ring-4 ring-white dark:ring-slate-800 shrink-0 transition-all"
                style={{ background: (() => {
                  const [s, e] = getCompanyGradient(worker.profilo);
                  return `linear-gradient(135deg, ${s}, ${e})`;
                })() }}>
                <User className="w-7 h-7" strokeWidth={2} />
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none transition-colors">
                    {worker.cognome} {worker.nome}
                  </h1>
                  <BadgeCheck className="w-6 h-6 text-blue-500 dark:text-cyan-400 transition-colors" />
                  <div className={`ml-2 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-tighter border transition-colors ${badgeStyles}`}>
                    {getProfiloBadgeLabel(worker.profilo, worker.eliorType)}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-300 uppercase tracking-wider mt-1.5 transition-colors">
                  <Briefcase className="w-4 h-4" />
                  <span>{worker.ruolo}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-400 mt-1.5">
                  <CalendarPlus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                  {editingAssunzione && !isReadOnly ? (
                    <input
                      autoFocus
                      type="text"
                      defaultValue={dataAssunzione}
                      placeholder="gg/mm/aaaa"
                      onBlur={(e) => { saveAssunzione(e.target.value); setEditingAssunzione(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { saveAssunzione((e.target as HTMLInputElement).value); setEditingAssunzione(false); }
                        if (e.key === 'Escape') setEditingAssunzione(false);
                      }}
                      className="w-28 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { if (!isReadOnly) setEditingAssunzione(true); }}
                      disabled={isReadOnly}
                      className={`normal-case tracking-normal ${isReadOnly ? 'cursor-default' : 'hover:text-slate-600 dark:hover:text-slate-200 hover:underline decoration-dotted underline-offset-2'}`}
                      title={isReadOnly ? 'Data di assunzione' : 'Clicca per inserire/correggere la data di assunzione (dalla busta)'}
                    >
                      Assunzione:{' '}
                      {dataAssunzione
                        ? <span className="text-slate-600 dark:text-slate-200">{dataAssunzione}</span>
                        : <span className="italic font-semibold text-slate-400">{isReadOnly ? '—' : 'aggiungi'}</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* DROPDOWN AZIONI (ISTAT + PEC) */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setIsActionsOpen(v => !v)}
                className="group relative px-5 py-2.5 rounded-xl font-bold text-white shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #eab308 0%, #d946ef 100%)' }}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
                <Zap className="w-4 h-4 relative z-10" strokeWidth={2.5} />
                <span className="relative z-10 tracking-wide hidden lg:inline">Azioni</span>
                <ChevronDown className={`w-3.5 h-3.5 relative z-10 transition-transform duration-200 ${isActionsOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isActionsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[210px]"
                  >
                    <button
                      onClick={() => { onOpenIstat(); setIsActionsOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <LineChart className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
                      Calcolo interessi (ISTAT)
                    </button>
                    {!isReadOnly && (
                    <button
                      onClick={() => { onSendPec(); setIsActionsOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
                    >
                      <Send className="w-4 h-4 text-fuchsia-500" strokeWidth={2.5} />
                      Invia PEC
                    </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* TASTO DOWNLOAD (Conteggi PDF) — visibile anche in sola lettura (scarica, non scrive) */}
            <button
              onClick={onPrintTables}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Download className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-1" strokeWidth={2.5} />
              <span className="hidden xl:inline">Download</span>
            </button>

            {/* TASTO VAI AL REPORT — visibile anche in sola lettura (sola navigazione) */}
            <button
              onClick={onShowReport}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <FileSpreadsheet className="w-4 h-4 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
              <span className="hidden xl:inline">Vai al Report</span>
            </button>

            {/* TASTO ARCHIVIO PDF */}
            <button
              onClick={() => onSetActiveTab(activeTab === 'archive' ? 'input' : 'archive')}
              className={`group relative px-4 py-2.5 rounded-xl font-bold transition-all duration-300 border overflow-hidden flex items-center gap-2 hover:-translate-y-0.5 active:scale-95
                ${activeTab === 'archive'
                  ? 'text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] border-white/20'
                  : 'text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 hover:shadow-md'
                }`}
              style={activeTab === 'archive' ? { background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' } : {}}
              title="Archivio PDF buste paga"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Archive className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:scale-110" strokeWidth={2.5} />
              <span className="relative z-10 text-sm">Archivio</span>
              {archiveCount > 0 && (
                <span className={`relative z-10 text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none
                  ${activeTab === 'archive'
                    ? 'bg-white/25 text-white'
                    : 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300'
                  }`}>
                  {archiveCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>
    </>
  );
};

export default WorkerDetailHeader;
