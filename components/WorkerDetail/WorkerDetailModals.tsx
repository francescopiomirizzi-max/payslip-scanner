import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Save, X } from 'lucide-react';
import { FRAMER_PHYSICS } from '../../framerConfig';
import QRScannerModal from '../QRScannerModal';
import IstatDashboardModal from '../WorkerTables/IstatDashboardModal';
import { useWorkerDetail } from './WorkerDetailContext';

// Tutte le modali (QR, ISTAT, AI-TFR, info ticker) estratte da WorkerDetailLayout.
const WorkerDetailModals: React.FC = () => {
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
      <QRScannerModal
        isOpen={isQRModalOpen}
        onClose={onCloseQR}
        onScanSuccess={onQRData}
        company={worker.profilo || 'RFI'}
        workerName={`${worker.cognome} ${worker.nome}`}
        eliorType={worker.eliorType}
      />

      {/* ISTAT DASHBOARD MODAL */}
      <IstatDashboardModal
        isOpen={isIstatModalOpen}
        onClose={onCloseIstat}
        worker={worker}
        monthlyInputs={monthlyInputs}
        startClaimYear={startClaimYear}
        includeExFest={includeExFest}
        includeTickets={includeTickets}
      />

      {/* MODALE AI TFR */}
      <AnimatePresence>
        {isAiTfrModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl" onClick={onCloseAiTfr}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={FRAMER_PHYSICS.smooth}
                className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] shadow-[0_0_80px_rgba(99,102,241,0.2)] border border-slate-700 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-500/20 blur-[60px] pointer-events-none"></div>
                <div className="relative px-8 pt-8 pb-4 text-center">
                  <div className="w-16 h-16 mx-auto bg-slate-950 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4 relative group">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-400 opacity-20 animate-ping"></div>
                    <Wallet className="w-8 h-8 text-indigo-400 relative z-10" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">TFR Storico Rilevato!</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-200 mt-2 font-medium">L'Intelligenza Artificiale ha letto questi dati dal documento. Vuoi impostarli come base di calcolo?</p>
                </div>
                <div className="px-8 pb-8 space-y-5 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest pl-1">Importo Trovato</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-indigo-400 font-black text-lg">€</span>
                      </div>
                      <input
                        type="number" value={aiTfrAmount} onChange={(e) => onSetAiTfrAmount(e.target.value)}
                        className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest pl-1">Anno di riferimento</label>
                    <div className="relative group">
                      <input
                        type="number" value={aiTfrYear} onChange={(e) => onSetAiTfrYear(e.target.value)}
                        className="hide-arrows w-full bg-slate-950 border border-slate-700 text-white rounded-2xl py-4 px-4 text-center focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={onIgnoreAiTfr} className="flex-1 py-4 rounded-xl font-bold text-sm text-slate-400 dark:text-slate-200 bg-slate-800/50 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700">Ignora</button>
                    <button onClick={onSaveAiTfr} className="flex-[2] py-4 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Save size={18} /> CONFERMA
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* INFO MODAL TICKER */}
      <AnimatePresence mode="wait">
        {activeTickerModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => onSetActiveTickerModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={FRAMER_PHYSICS.smooth}
              className="relative w-full max-w-lg bg-slate-900 rounded-3xl shadow-[0_0_60px_rgba(79,70,229,0.3)] border border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl border border-slate-700 text-indigo-400 flex items-center justify-center font-serif text-2xl font-black italic shadow-inner">
                    i
                  </div>
                  <button onClick={() => onSetActiveTickerModal(null)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 dark:text-slate-200 hover:text-white rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight mb-4 uppercase">
                  {activeTickerModal.title}
                </h3>
                <div className="text-left">
                  {activeTickerModal.content}
                </div>
              </div>
              <div className="p-5 bg-slate-950 border-t border-slate-800 text-center">
                <button onClick={() => onSetActiveTickerModal(null)} className="w-full py-3.5 rounded-xl font-black tracking-wide text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors active:scale-95 shadow-lg shadow-indigo-600/20">
                  HO CAPITO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WorkerDetailModals;
