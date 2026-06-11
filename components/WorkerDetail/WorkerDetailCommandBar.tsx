import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid, Calculator, TrendingUp, Wallet,
  Loader2, ScanLine, Bot, QrCode,
} from 'lucide-react';
import { useIsReadOnly } from '../../lib/readonly';
import { useWorkerDetail } from './WorkerDetailContext';

// Sezione COMMAND BAR (tasti AI/scan/QR + tab) estratta da WorkerDetailLayout.
// Possiede commandBarRef per l'effetto spotlight. Legge dal context.
const WorkerDetailCommandBar: React.FC = () => {
  const {
    isBatchProcessing, onBatchUpload,
    isAnalyzing, scanRef, onFileUpload, onOpenQR, activeTab, onSetActiveTab,
  } = useWorkerDetail();
  const isReadOnly = useIsReadOnly();
  const commandBarRef = useRef<HTMLDivElement>(null);

  return (
    <>
        <div className="flex justify-center mb-6 z-20 shrink-0">
          <div
            ref={commandBarRef}
            onMouseMove={(e) => {
              if (!commandBarRef.current) return;
              const rect = commandBarRef.current.getBoundingClientRect();
              commandBarRef.current.style.setProperty('--x', `${e.clientX - rect.left}px`);
              commandBarRef.current.style.setProperty('--y', `${e.clientY - rect.top}px`);
            }}
            onMouseEnter={() => {
              if (commandBarRef.current) commandBarRef.current.style.setProperty('--spotlight-opacity', '1');
            }}
            onMouseLeave={() => {
              if (commandBarRef.current) commandBarRef.current.style.setProperty('--spotlight-opacity', '0');
            }}
            className="relative flex flex-wrap p-2 glass-panel gap-3 w-full justify-center"
          >
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300 z-0"
              style={{
                opacity: 'var(--spotlight-opacity, 0)',
                background: 'radial-gradient(300px circle at var(--x, 50%) var(--y, 50%), rgba(99, 102, 241, 0.25), transparent 50%)'
              }}
            ></div>

            {/* INPUT FILE NASCOSTO */}
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(e) => onBatchUpload(e, false)}
              className="hidden"
              id="dashboard-ai-upload"
              disabled={isBatchProcessing}
            />

            {/* TASTO AI AGENT — nascosto in modalita' sola lettura */}
            {!isReadOnly && (
            <button
              onClick={() => document.getElementById('dashboard-ai-upload')?.click()}
              disabled={isBatchProcessing}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-500 flex items-center gap-3 overflow-hidden border-2 shrink-0
                  ${isBatchProcessing
                  ? 'bg-slate-100 border-slate-200 opacity-50 dark:opacity-80 cursor-not-allowed'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:border-transparent hover:shadow-[0_0_40px_rgba(217,70,239,0.3)]'
                }`}
            >
              <div className="absolute inset-0 bg-slate-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#d946ef_360deg)] opacity-0 group-hover:opacity-100 group-hover:animate-[spin_2s_linear_infinite] transition-opacity duration-300"></div>
              <div className="absolute inset-[2px] bg-slate-900 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></div>
              <div className="absolute inset-0 bg-fuchsia-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 blur-xl"></div>
              <div className="relative z-10 flex items-center gap-2.5 transition-colors duration-300">
                <div className="relative flex items-center justify-center">
                  <Bot className="w-5 h-5 transition-all duration-500 group-hover:text-fuchsia-400" />
                  <div className="absolute inset-0 bg-fuchsia-400 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
                <div className="flex flex-col items-start leading-none text-left">
                  <span className="text-[8.5px] uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 group-hover:text-fuchsia-200 transition-all duration-300 mb-0.5 font-black">
                    Auto-Scan
                  </span>
                  <span className="tracking-widest font-black text-[13px] group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(217,70,239,0.8)] transition-all duration-300">
                    AI AGENT
                  </span>
                </div>
              </div>
            </button>
            )}

            {/* Il tasto Carica Busta Paga / Chiudi Visore vive ora sulla barra
                PERIODO della griglia (occhio "Visore" in MonthlyDataGrid). */}

            {/* TASTO SCAN AI — nascosto in modalita' sola lettura */}
            {!isReadOnly && (
            <button
              onClick={() => scanRef.current?.click()}
              disabled={isAnalyzing}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${isAnalyzing
                  ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                }`}
            >
              <div className="absolute inset-0 bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></div>
              <div className="absolute inset-0 w-full h-full pointer-events-none opacity-0 group-hover:opacity-100 overflow-hidden z-0 transition-opacity duration-300">
                <motion.div
                  animate={{ top: ['-50%', '150%'], opacity: [0, 1, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear", times: [0, 0.15, 0.85, 1] }}
                  className="absolute left-0 w-full h-[50%] bg-gradient-to-b from-transparent via-cyan-500/20 to-cyan-400/80"
                >
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-300 shadow-[0_0_8px_#22d3ee,0_0_15px_#22d3ee]"></div>
                </motion.div>
              </div>
              <div className="relative z-10 flex items-center gap-2.5 transition-colors duration-300 group-hover:text-white">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="font-medium">Analisi in corso...</span>
                  </>
                ) : (
                  <>
                    <div className="scan-icon-animate transition-transform">
                      <ScanLine className="w-5 h-5 transition-colors duration-300 text-slate-500 dark:text-slate-300 group-hover:text-cyan-400" />
                    </div>
                    <span className="font-bold transition-colors duration-300 group-hover:text-white tracking-wide flex gap-1.5">
                      SCAN
                      <span className="group-hover:text-cyan-400 transition-colors duration-300 group-hover:drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">AI</span>
                      Busta paga
                    </span>
                  </>
                )}
              </div>
            </button>
            )}

            {/* INPUT FILE SCAN */}
            <input type="file" accept="image/*,.pdf" ref={scanRef} className="hidden" onChange={onFileUpload} />

            {/* TASTO MOBILE SCAN — nascosto in modalita' sola lettura */}
            {!isReadOnly && (
            <button
              onClick={onOpenQR}
              className="group relative flex items-center gap-3 px-4 py-2 ml-2 bg-white/40 dark:bg-slate-800/40 border-2 border-transparent hover:bg-slate-900 hover:border-indigo-500 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] overflow-hidden shrink-0"
              title="Connetti lo Smartphone"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative w-6 h-10 border-[1.5px] border-slate-400 dark:border-slate-500 group-hover:border-indigo-400 rounded-[6px] flex flex-col items-center p-[2px] transition-colors duration-300 shadow-inner bg-transparent group-hover:bg-slate-950">
                <div className="w-2 h-[2px] bg-slate-400 dark:bg-slate-500 group-hover:bg-indigo-400 rounded-full mb-0.5 transition-colors duration-300"></div>
                <div className="flex-1 w-full bg-slate-300/50 dark:bg-slate-700/50 group-hover:bg-indigo-500/20 rounded-[2px] flex items-center justify-center relative overflow-hidden transition-colors duration-300">
                  <QrCode className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-75 group-hover:scale-100" />
                </div>
                <div className="w-2.5 h-[1.5px] bg-slate-400 dark:bg-slate-500 group-hover:bg-indigo-500 rounded-full mt-0.5 transition-colors duration-300"></div>
              </div>
              <div className="flex flex-col items-start text-left relative z-10">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-200 group-hover:text-indigo-300 transition-colors uppercase tracking-widest leading-none mb-1">Connetti</span>
                <span className="text-sm font-black text-slate-600 dark:text-slate-400 dark:text-slate-200 group-hover:text-white transition-colors leading-none">Mobile Scan</span>
              </div>
              <div className="absolute top-2 right-2 w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-0 group-hover:opacity-75 group-hover:animate-ping transition-opacity duration-300"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-slate-400 dark:bg-slate-600 group-hover:bg-emerald-500 transition-colors duration-300"></span>
              </div>
            </button>
            )}

            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

            {/* TAB: INSERIMENTO MENSILE */}
            <button
              onClick={() => onSetActiveTab('input')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-colors duration-200 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'input'
                  ? 'text-white shadow-lg shadow-blue-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-blue-500 dark:hover:text-cyan-400 hover:shadow-md'
                }`}
            >
              {activeTab === 'input' && (
                <motion.div layoutId="active-tab-bg" className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }} transition={{ type: 'spring' as const, stiffness: 380, damping: 40 }} />
              )}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
              <LayoutGrid className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'input' ? 'rotate-0' : 'group-hover:rotate-90'}`} />
              <span className="relative z-10">Inserimento Mensile</span>
            </button>

            {/* TAB: RIEPILOGO ANNUALE */}
            <button
              onClick={() => onSetActiveTab('calc')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-colors duration-200 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'calc'
                  ? 'text-white shadow-lg shadow-emerald-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-500 dark:hover:text-emerald-400 hover:shadow-md'
                }`}
            >
              {activeTab === 'calc' && (
                <motion.div layoutId="active-tab-bg" className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' }} transition={{ type: 'spring' as const, stiffness: 380, damping: 40 }} />
              )}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
              <Calculator className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'calc' ? 'rotate-0' : 'group-hover:rotate-12'}`} />
              <span className="relative z-10">Riepilogo Annuale</span>
            </button>

            {/* TAB: ANALISI VOCI */}
            <button
              onClick={() => onSetActiveTab('pivot')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-colors duration-200 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'pivot'
                  ? 'text-white shadow-lg shadow-amber-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-md'
                }`}
            >
              {activeTab === 'pivot' && (
                <motion.div layoutId="active-tab-bg" className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' }} transition={{ type: 'spring' as const, stiffness: 380, damping: 40 }} />
              )}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
              <TrendingUp className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'pivot' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Analisi Voci</span>
            </button>

            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* TAB: PROSPETTO TFR */}
            <button
              onClick={() => onSetActiveTab('tfr')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-colors duration-200 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'tfr'
                  ? 'text-white shadow-lg shadow-fuchsia-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-fuchsia-500 hover:shadow-md'
                }`}
            >
              {activeTab === 'tfr' && (
                <motion.div layoutId="active-tab-bg" className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)' }} transition={{ type: 'spring' as const, stiffness: 380, damping: 40 }} />
              )}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
              <Wallet className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'tfr' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Prospetto TFR</span>
            </button>

          </div>
        </div>
    </>
  );
};

export default WorkerDetailCommandBar;
