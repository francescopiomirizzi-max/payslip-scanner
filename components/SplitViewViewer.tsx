import React from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, FileStack, Sparkles,
  ChevronLeft, ChevronRight,
  Crosshair, Eye, ScanEye,
  Wand2, RotateCw, ZoomOut, ZoomIn, Maximize,
  Trash2, X, Bot, Upload,
} from 'lucide-react';

interface SplitViewViewerProps {
  // File state
  payslipFiles: string[];
  currentFileIndex: number;
  isBatchProcessing: boolean;

  // OCR sniper
  isSniperMode: boolean;
  isProcessing: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;

  // Image viewer
  imgRef: React.RefObject<HTMLImageElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  batchInputRef: React.RefObject<HTMLInputElement>;
  imgScale: number;
  imgPos: { x: number; y: number };
  imgRotation: number;
  imgFilter: 'none' | 'contrast';
  isDragging: boolean;

  // AI explainer
  isExplainerOpen: boolean;

  // Callbacks — navigation
  onClose: () => void;
  onPrevFile: () => void;
  onNextFile: () => void;
  onDeleteCurrentFile: () => void;

  // Callbacks — upload
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Callbacks — drag & drop
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;

  // Callbacks — mouse
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;

  // Callbacks — viewer controls
  onToggleSniper: () => void;
  onToggleFilter: () => void;
  onRotate: () => void;
  onZoom: (delta: number) => void;
  onResetView: () => void;

  // Callbacks — AI
  onExplainPayslip: () => void;
}

const SplitViewViewer: React.FC<SplitViewViewerProps> = ({
  payslipFiles,
  currentFileIndex,
  isBatchProcessing,
  isSniperMode,
  isProcessing,
  selectionBox,
  imgRef,
  containerRef,
  fileInputRef,
  batchInputRef,
  imgScale,
  imgPos,
  imgRotation,
  imgFilter,
  isDragging,
  isExplainerOpen,
  onClose,
  onPrevFile,
  onNextFile,
  onDeleteCurrentFile,
  onImageUpload,
  onBatchUpload,
  onDragOver,
  onDrop,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onToggleSniper,
  onToggleFilter,
  onRotate,
  onZoom,
  onResetView,
  onExplainPayslip,
}) => (
  <motion.div
    initial={{ width: 0, opacity: 0, x: -50 }}
    animate={{ width: '45%', opacity: 1, x: 0 }}
    exit={{ width: 0, opacity: 0, x: -50 }}
    className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 shrink-0 z-40"
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    {/* Hidden inputs */}
    <input
      type="file"
      ref={fileInputRef}
      className="hidden"
      onChange={onImageUpload}
      accept="image/*,application/pdf"
      multiple
    />

    {/* HEADER */}
    <div className="p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex justify-between items-center z-20">
      <div className="flex items-center gap-3">
        {/* Batch upload button */}
        <div className="relative mr-2">
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            ref={batchInputRef}
            onChange={onBatchUpload}
            className="hidden"
          />
          <button
            onClick={() => batchInputRef.current?.click()}
            disabled={isBatchProcessing}
            className={`group relative px-5 py-2 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-300 overflow-hidden flex items-center gap-2.5 border border-white/10
              ${isBatchProcessing
                ? 'bg-slate-800 cursor-wait opacity-80'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 active:scale-95'
              }`}
          >
            {!isBatchProcessing && (
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12" />
            )}
            {isBatchProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-violet-200" />
                <span className="tracking-wide text-xs">AI WORKING...</span>
              </>
            ) : (
              <>
                <div className="relative">
                  <FileStack className="w-4 h-4 text-white" strokeWidth={2.5} />
                  <Sparkles className="w-2.5 h-2.5 absolute -top-2 -right-2 text-amber-300 animate-pulse" fill="currentColor" />
                </div>
                <span className="tracking-wide">Smart Upload 12</span>
              </>
            )}
          </button>
        </div>

        {/* File navigator or mode label */}
        {payslipFiles.length > 1 ? (
          <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-1 border border-slate-700">
            <button onClick={onPrevFile} disabled={currentFileIndex === 0} className="p-1.5 hover:bg-slate-700 rounded text-white disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-mono font-bold text-cyan-400 w-16 text-center">{currentFileIndex + 1} / {payslipFiles.length}</span>
            <button onClick={onNextFile} disabled={currentFileIndex === payslipFiles.length - 1} className="p-1.5 hover:bg-slate-700 rounded text-white disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-300">
            {isSniperMode ? <Crosshair className="w-5 h-5 text-red-500 animate-pulse" /> : <Eye className="w-5 h-5 text-indigo-400" />}
            <span className="text-xs font-bold uppercase tracking-wider">{isSniperMode ? 'MODALITÀ CECCHINO' : 'Visore Buste paga'}</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {payslipFiles.length > 0 && (
          <>
            <button
              onClick={onToggleSniper}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSniperMode ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanEye className="w-4 h-4" />}
              {isSniperMode ? 'STOP' : 'OCR'}
            </button>
            <div className="h-6 w-px bg-slate-600 mx-2" />

            <button onClick={onToggleFilter} className={`p-2 rounded-lg transition-colors ${imgFilter === 'contrast' ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`} title="Migliora Leggibilità">
              <Wand2 className="w-4 h-4" />
            </button>
            <button onClick={onRotate} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Ruota Immagine">
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="h-6 w-px bg-slate-600 mx-1" />

            <button onClick={() => onZoom(-0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Riduci Zoom">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={onResetView} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Centra e Ripristina">
              <Maximize className="w-4 h-4" />
            </button>
            <button onClick={() => onZoom(0.1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors" title="Aumenta Zoom">
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={onDeleteCurrentFile}
              className="p-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded-lg ml-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-200 hover:text-white ml-2" title="Chiudi Visore">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* BODY */}
    <div
      ref={containerRef}
      className={`flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center ${isSniperMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onMouseMove={onMouseMove}
    >
      {payslipFiles.length > 0 ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <object
            data={payslipFiles[currentFileIndex]}
            type="application/pdf"
            className="w-full h-full rounded-none"
            style={{
              pointerEvents: isSniperMode ? 'none' : 'auto',
              display: payslipFiles[currentFileIndex].endsWith('.pdf') || payslipFiles[currentFileIndex].startsWith('blob:') ? 'block' : 'none',
            }}
          >
            <img
              ref={imgRef}
              src={payslipFiles[currentFileIndex]}
              alt="Busta Paga"
              draggable={false}
              style={{
                transform: `scale(${imgScale}) translate(${imgPos.x}px, ${imgPos.y}px) rotate(${imgRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                pointerEvents: 'auto',
                filter: imgFilter === 'contrast' ? 'contrast(150%) grayscale(100%)' : 'none',
              }}
              className={`max-w-full max-h-full object-contain select-none ${isSniperMode ? '' : 'cursor-grab active:cursor-grabbing'}`}
            />
          </object>

          {/* AI explain button */}
          {payslipFiles.length > 0 && !isExplainerOpen && (
            <button
              onClick={onExplainPayslip}
              className="absolute bottom-6 right-6 z-50 p-4 bg-slate-900 border border-slate-700 hover:border-fuchsia-500 rounded-full shadow-[0_0_20px_rgba(192,38,211,0.3)] hover:shadow-[0_0_30px_rgba(192,38,211,0.6)] transition-all duration-300 group hover:-translate-y-1"
            >
              <Bot className="w-6 h-6 text-fuchsia-500 group-hover:text-fuchsia-400 group-hover:animate-pulse" />
              <span className="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                Spiega questa Busta Paga
              </span>
            </button>
          )}

          {/* Sniper selection box */}
          {isSniperMode && selectionBox && (
            <div
              style={{
                position: 'absolute',
                left: selectionBox.x * imgScale + imgPos.x,
                top: selectionBox.y * imgScale + imgPos.y,
                width: selectionBox.w * imgScale,
                height: selectionBox.h * imgScale,
                border: '2px solid #ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          )}

          {/* Bottom hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-5 py-2 rounded-full text-[10px] text-white/70 pointer-events-none border border-white/10 z-[60]">
            {isSniperMode ? 'DISEGNA UN RETTANGOLO SUL NUMERO' : 'Trascina per spostare • Usa i tasti per lo zoom'}
          </div>
        </div>
      ) : (
        // Empty upload area
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group flex flex-col items-center justify-center text-slate-500 dark:text-slate-300 hover:text-indigo-400 transition-all cursor-pointer p-8 border-2 border-dashed border-slate-700 rounded-3xl hover:border-indigo-500 hover:bg-slate-900/50 w-64 h-64"
        >
          <div className="mb-4 p-4 bg-slate-900 rounded-full group-hover:scale-110 transition-transform duration-300 border border-slate-800 group-hover:border-indigo-500/30">
            <Upload className="w-8 h-8 group-hover:-translate-y-1 transition-transform duration-500 ease-in-out" />
          </div>
          <p className="font-bold text-sm uppercase tracking-wider text-slate-400 dark:text-slate-200 group-hover:text-white transition-colors">Carica Buste Paga</p>
          <p className="text-[10px] mt-2 opacity-50 dark:opacity-80 text-center px-4 group-hover:opacity-100 transition-opacity">
            Trascina qui o clicca.<br />Supporta PDF, JPG, PNG (Max 12)
          </p>
          <p className="text-[10px] mt-1 opacity-40 pointer-events-none">Carica fino a 12 file insieme!</p>
        </div>
      )}
    </div>
  </motion.div>
);

export default SplitViewViewer;
