import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckCircle2, CheckCircle, Cpu, ScanLine, FileText, Loader2 } from 'lucide-react';
import { FRAMER_PHYSICS } from '../../framerConfig';
import { useWorkerDetail } from './WorkerDetailContext';

// Overlay HUD (batch processing + scanner singolo) estratti da WorkerDetailLayout.
const WorkerDetailHuds: React.FC = () => {
  const {
    worker, badgeStyles, onBack, onShowReport, onSendPec, onPrintTables, onOpenIstat,
    startClaimYear, onStartClaimYearChange,
    isGlobalDragging, onSetIsGlobalDragging, onBatchUpload,
    isTimelineOpen, onToggleTimeline, legalStatus, onLegalStatusChange, onUpdateStatus,
    tickerItems, activeTickerModal, onSetActiveTickerModal,
    includeExFest, onToggleExFest, includeTickets, onToggleTickets,
    isBatchProcessing, isAnalyzing, scanRef, onFileUpload,
    showSplit, onSetShowSplit,
    isQRModalOpen, onOpenQR, onCloseQR, onQRData,
    activeTab, onSetActiveTab, archiveCount,
    isExplainerOpen, onCloseExplainer, isExplaining, explanationData, onContainerScroll,
    payslipFiles, archivedPicks, onOpenArchivedPicks, onBackToArchivePicker, currentFileIndex, currentFileMonthLabel, isSniperMode, onToggleSniper, isProcessing,
    selectionBox, imgRef, containerRef, fileInputRef,
    imgScale, imgPos, imgRotation, imgFilter, isDragging,
    onPrevFile, onNextFile, onDeleteCurrentFile, onImageUpload,
    onDragOver, onDrop, onMouseDown, onMouseMove, onMouseUp,
    onToggleFilter, onRotate, onZoom, onResetView, onExplainPayslip,
    batchProgress, batchTotal, showSupernova,
    batchNotification, onCloseBatchNotification,
    isIstatModalOpen, onCloseIstat, monthlyInputs,
    isAiTfrModalOpen, onCloseAiTfr, aiTfrAmount, onSetAiTfrAmount, aiTfrYear, onSetAiTfrYear,
    onSaveAiTfr, onIgnoreAiTfr,
  } = useWorkerDetail();

  return (
    <>
      <AnimatePresence mode="wait">
        {isBatchProcessing && !showSplit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: showSupernova ? 1.05 : 1, y: 0 }}
              transition={FRAMER_PHYSICS.smooth}
              className={`p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center max-w-sm w-full relative overflow-hidden border transition-all duration-500
                ${showSupernova ? 'bg-emerald-950 border-emerald-500 shadow-[0_0_150px_rgba(16,185,129,0.8)]' : 'bg-slate-900 border-slate-700 shadow-[0_0_120px_rgba(217,70,239,0.15)]'}`}
            >
              <AnimatePresence mode="wait">
                {showSupernova && (
                  <motion.div
                    initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8 }}
                    className="absolute inset-0 bg-white z-50 pointer-events-none"
                  ></motion.div>
                )}
              </AnimatePresence>
              <div className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:16px_16px] opacity-30 pointer-events-none`}></div>
              <div className="relative w-36 h-36 mb-10 flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className={`absolute inset-0 border-t-[3px] border-r-[3px] border-transparent rounded-full ${showSupernova ? 'border-t-emerald-400 border-r-emerald-400/30' : 'border-t-fuchsia-400 border-r-fuchsia-400/30'}`}></motion.div>
                <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 5, ease: "linear" }} className={`absolute inset-3 border-b-[2px] border-l-[2px] border-transparent rounded-full ${showSupernova ? 'border-b-emerald-300 border-l-emerald-300/30' : 'border-b-violet-500 border-l-violet-500/30'}`}></motion.div>
                <motion.div animate={showSupernova ? { scale: [1, 2], opacity: [0.8, 0] } : { scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: showSupernova ? 0.8 : 1.5, repeat: showSupernova ? 0 : Infinity }} className={`absolute inset-8 rounded-full blur-xl ${showSupernova ? 'bg-emerald-400' : 'bg-fuchsia-500'}`}></motion.div>
                <div className={`relative z-10 p-5 rounded-2xl border transition-colors duration-500 ${showSupernova ? 'bg-emerald-900 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.5)]' : 'bg-slate-900 border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.2)]'}`}>
                  {showSupernova ? <CheckCircle2 className="w-12 h-12 text-emerald-400" /> : <Bot className="w-12 h-12 text-fuchsia-400" />}
                </div>
                {!showSupernova && (
                  <motion.div
                    animate={{ y: [-65, 65, -65] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-[2px] bg-fuchsia-300 shadow-[0_0_15px_#f0abfc,0_0_30px_#f0abfc] z-20"
                  ></motion.div>
                )}
              </div>
              <h3 className={`font-black tracking-[0.3em] text-[10px] uppercase mb-3 relative z-10 flex items-center gap-2 ${showSupernova ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {showSupernova ? <CheckCircle className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                {showSupernova ? 'Elaborazione Conclusa' : 'Motore Neurale Attivo'}
              </h3>
              <p className="text-white font-medium text-xl text-center mb-8 relative z-10">
                Analisi busta paga <span className={`text-4xl font-black mx-1.5 ${showSupernova ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]'}`}>{batchProgress}</span> di <span className="text-2xl text-slate-400 dark:text-slate-200 mx-1.5">{batchTotal}</span>
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2.5 mb-3 overflow-hidden border border-slate-800 relative shadow-inner z-10 p-0.5">
                <motion.div
                  className={`h-full relative rounded-full ${showSupernova ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-fuchsia-300'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(batchProgress / Math.max(1, batchTotal)) * 100}%` }}
                  transition={{ ease: "circOut", duration: 0.3 }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-white rounded-full blur-[2px]"></div>
                </motion.div>
              </div>
              <p className={`text-[9px] uppercase tracking-[0.3em] font-black relative z-10 ${showSupernova ? 'text-emerald-400' : 'text-fuchsia-500/70 animate-pulse'}`}>
                {showSupernova ? 'Sincronizzazione dati...' : 'Estrazione Dati in corso...'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD SCANNER SINGOLO */}
      {isAnalyzing && !showSplit && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
            transition={FRAMER_PHYSICS.smooth}
            className="p-10 rounded-[3rem] flex flex-col items-center relative overflow-hidden bg-slate-900 border border-cyan-500/20 shadow-[0_0_80px_rgba(6,182,212,0.15)]"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-10 relative z-10">
              <ScanLine className="w-6 h-6 text-cyan-400" />
              <h3 className="font-black tracking-[0.3em] text-[12px] uppercase text-cyan-400">Sistema di Scansione Attivo</h3>
            </div>
            <div className="relative w-40 h-48 flex items-center justify-center mb-8">
              <div className="absolute inset-0 border-2 border-slate-700 rounded-xl" style={{ animation: 'bracket-pulse 2s ease-in-out infinite' }}></div>
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>
              <FileText className="w-20 h-20 text-slate-500 dark:text-slate-300 opacity-50 dark:opacity-80" />
              <div className="absolute inset-0 overflow-hidden rounded-xl z-20">
                <div
                  className="absolute left-0 right-0 h-[2px] bg-cyan-400"
                  style={{ animation: 'single-scan-laser 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                >
                  <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-t from-cyan-400/20 to-transparent -translate-y-full"></div>
                </div>
              </div>
            </div>
            <p className="text-white font-medium text-lg text-center mb-2 relative z-10">Lettura OCR in corso...</p>
            <div className="flex items-center gap-2 relative z-10">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-200">Tempo stimato: ~20 secondi</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default WorkerDetailHuds;
