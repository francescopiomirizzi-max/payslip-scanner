import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Loader2 } from 'lucide-react';
import SplitViewViewer from '../SplitViewViewer';
import { useWorkerDetail } from './WorkerDetailContext';

// Helper modulo-locale: renderizza il report AI dell'explainer. Usato solo qui.
const renderAIReport = (text: string | null): React.ReactNode => {
  if (!text) return null;
  return text.split('\n\n').filter(p => p.trim() !== '').map((paragraph, index) => {
    if (paragraph.trim().startsWith('###')) {
      const titleText = paragraph.replace(/###/g, '').trim();
      return (
        <h3 key={index} className="text-xl font-black text-white mt-8 mb-4 flex items-center gap-3 border-b border-slate-700/50 pb-3">
          {titleText}
        </h3>
      );
    }
    const renderTextWithBold = (str: string) => {
      return str.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          const isMoney = boldText.includes('€') || boldText.toLowerCase().includes('netto');
          return (
            <strong key={i} className={`font-bold tracking-wide ${isMoney ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.3)]'}`}>
              {boldText}
            </strong>
          );
        }
        return <span key={i}>{part.split('\n').map((line, j, arr) => <React.Fragment key={j}>{line}{j < arr.length - 1 && <br />}</React.Fragment>)}</span>;
      });
    };
    const lines = paragraph.split('\n');
    const isList = lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('*'));
    if (isList) {
      return (
        <ul key={index} className="space-y-3 mb-6 ml-2 border-l-[3px] border-fuchsia-500/30 pl-5">
          {lines.filter(line => line.trim() !== '').map((line, i) => {
            const cleanLine = line.replace(/^[-*]\s*/, '').trim();
            return (
              <li key={i} className="text-slate-300 text-[15px] leading-relaxed relative flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
                <span>{renderTextWithBold(cleanLine)}</span>
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <p key={index} className="text-slate-300 text-[15px] leading-relaxed mb-5">
        {renderTextWithBold(paragraph)}
      </p>
    );
  });
};

// Pannello centrale (tabelle/explainer) + sidebar Visore, estratto da WorkerDetailLayout.
// Riceve le tab come children; tutto il resto dal context.
const WorkerDetailContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        <div className="flex flex-row gap-6 w-full items-stretch relative min-h-[calc(100vh-250px)]">
          <div className="flex-1 bg-white/60 dark:bg-slate-950/80 backdrop-blur-md rounded-[2.5rem] border border-white/60 dark:border-cyan-400 shadow-2xl dark:shadow-[inset_0_0_50px_rgba(34,211,238,0.15),0_0_30px_rgba(34,211,238,0.3)] overflow-hidden flex flex-col relative min-h-0 transition-all duration-300">
            <div className="flex-1 p-2 sm:p-6 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {isExplainerOpen ? (
                  /* PANNELLO AUDITOR AI */
                  <motion.div
                    key="explainer"
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: "circOut" }}
                    className="h-full w-full bg-slate-950 rounded-3xl border border-fuchsia-500/30 shadow-[0_0_30px_rgba(192,38,211,0.15)] flex flex-col overflow-hidden relative"
                  >
                    <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 z-10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-fuchsia-500/20 rounded-lg border border-fuchsia-500/30">
                          <Bot className="w-6 h-6 text-fuchsia-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white tracking-wide">Analisi Documentale</h2>
                          <p className="text-xs text-fuchsia-400 font-bold uppercase tracking-widest">Traduzione Legale</p>
                        </div>
                      </div>
                      <button
                        onClick={onCloseExplainer}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 active:scale-95"
                      >
                        <X className="w-4 h-4" /> Chiudi
                      </button>
                    </div>
                    <div
                      className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar relative"
                      onScroll={onContainerScroll}
                    >
                      <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-white opacity-5 pointer-events-none" />
                      {isExplaining ? (
                        <div className="space-y-6 animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-xl"></div>
                            <div className="space-y-2">
                              <div className="h-4 w-32 bg-slate-800 rounded-md"></div>
                              <div className="h-3 w-20 bg-slate-800/60 rounded-md"></div>
                            </div>
                          </div>
                          <div className="space-y-4 pt-4">
                            <div className="h-3 w-full bg-slate-800/80 rounded-full"></div>
                            <div className="h-3 w-[90%] bg-slate-800/60 rounded-full"></div>
                            <div className="h-3 w-[95%] bg-slate-800/80 rounded-full"></div>
                            <div className="h-3 w-[85%] bg-slate-800/40 rounded-full"></div>
                          </div>
                          <div className="pt-8 space-y-4">
                            <div className="h-20 w-full bg-slate-800/40 rounded-2xl border border-slate-800"></div>
                            <div className="h-20 w-full bg-slate-800/40 rounded-2xl border border-slate-800"></div>
                          </div>
                          <div className="flex justify-center pt-6">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500 opacity-50" />
                              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">AI sta scrivendo il report...</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 pb-12 pr-4">
                          {renderAIReport(explanationData)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  /* TABELLE NORMALI */
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: "circOut" }}
                    className="h-full w-full"
                  >
                    {children}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* SPLIT SCREEN SIDEBAR */}
          <AnimatePresence mode="wait">
            {showSplit && (
              <SplitViewViewer
                payslipFiles={payslipFiles}
                archivedPicks={archivedPicks}
                onOpenArchivedPicks={onOpenArchivedPicks}
                onBackToArchivePicker={onBackToArchivePicker}
                currentFileIndex={currentFileIndex}
                currentFileMonthLabel={currentFileMonthLabel}
                isSniperMode={isSniperMode}
                isProcessing={isProcessing}
                selectionBox={selectionBox}
                imgRef={imgRef}
                containerRef={containerRef}
                fileInputRef={fileInputRef}
                imgScale={imgScale}
                imgPos={imgPos}
                imgRotation={imgRotation}
                imgFilter={imgFilter}
                isDragging={isDragging}
                isExplainerOpen={isExplainerOpen}
                onClose={() => onSetShowSplit(false)}
                onPrevFile={onPrevFile}
                onNextFile={onNextFile}
                onDeleteCurrentFile={onDeleteCurrentFile}
                onImageUpload={onImageUpload}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onToggleSniper={onToggleSniper}
                onToggleFilter={onToggleFilter}
                onRotate={onRotate}
                onZoom={onZoom}
                onResetView={onResetView}
                onExplainPayslip={onExplainPayslip}
              />
            )}
          </AnimatePresence>
        </div>
    </>
  );
};

export default WorkerDetailContent;
