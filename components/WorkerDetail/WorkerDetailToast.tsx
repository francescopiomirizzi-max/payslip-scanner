import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { FRAMER_PHYSICS } from '../../framerConfig';
import { useWorkerDetail } from './WorkerDetailContext';

// Toast notifica batch estratto da WorkerDetailLayout.
const WorkerDetailToast: React.FC = () => {
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
      <AnimatePresence>
        {batchNotification && (
          <motion.div
            key="batch-notification"
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={FRAMER_PHYSICS.smooth}
            className="fixed bottom-8 right-8 z-[250] flex flex-col gap-2"
          >
            <div className={`relative flex items-start gap-3 p-4 pr-12 w-80 rounded-2xl shadow-2xl backdrop-blur-2xl border border-white/10 overflow-hidden
              ${batchNotification.type === 'success' ? 'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]' :
                batchNotification.type === 'warning' ? 'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)]' :
                  'bg-slate-900/90 shadow-[0_10px_40px_-10px_rgba(239,68,68,0.3)]'}`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5
                ${batchNotification.type === 'success' ? 'bg-emerald-500' :
                  batchNotification.type === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none"></div>
              <div className={`mt-0.5 ml-2 shrink-0 ${batchNotification.type === 'success' ? 'text-emerald-400' :
                batchNotification.type === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                {batchNotification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {batchNotification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                {batchNotification.type === 'error' && <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1 relative z-10">
                <h4 className="font-bold text-[13px] text-white tracking-wide mb-1">
                  {batchNotification.type === 'success' ? 'Completato' :
                    batchNotification.type === 'warning' ? 'Attenzione' : 'Errore'}
                </h4>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                  {batchNotification.msg}
                </p>
              </div>
              <button
                onClick={onCloseBatchNotification}
                className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/20 rounded-full transition-colors text-slate-400 dark:text-slate-200 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WorkerDetailToast;
