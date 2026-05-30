import React from 'react';
import { motion } from 'framer-motion';
import { useIsReadOnly } from '../lib/readonly';
import {
  Loader2,
  ChevronLeft, ChevronRight,
  Crosshair, Eye, ScanEye,
  Wand2, RotateCw, ZoomOut, ZoomIn, Maximize,
  Trash2, X, Bot, Upload, CalendarDays,
} from 'lucide-react';

// Una busta selezionabile dal picker archivio (visore in sola lettura).
export interface ArchivedPick {
  id: string;
  storage_path: string;
  filename: string;
  year: number;
  month: string;
  monthIdx: number;
}

const MONTH_SHORT = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

interface SplitViewViewerProps {
  // File state
  payslipFiles: string[];
  currentFileIndex: number;
  currentFileMonthLabel: string | null;

  // Picker archivio (solo visore in sola lettura, quando non ci sono file caricati)
  archivedPicks?: ArchivedPick[];
  onOpenArchivedPicks?: (ids: string[]) => void;
  onBackToArchivePicker?: () => void;

  // OCR sniper
  isSniperMode: boolean;
  isProcessing: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;

  // Image viewer
  imgRef: React.RefObject<HTMLImageElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
  currentFileMonthLabel,
  archivedPicks,
  onOpenArchivedPicks,
  onBackToArchivePicker,
  isSniperMode,
  isProcessing,
  selectionBox,
  imgRef,
  containerRef,
  fileInputRef,
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
}) => {
  const isReadOnly = useIsReadOnly();
  // Selezione multipla del picker archivio (visore): permette di aprire alcune buste
  // specifiche, oltre al caricamento di un anno intero col bottone dedicato.
  const [selectedPickIds, setSelectedPickIds] = React.useState<Set<string>>(new Set());
  const togglePick = (id: string) => setSelectedPickIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const pickYears = archivedPicks
    ? Array.from(new Set(archivedPicks.map(p => p.year))).sort((a, b) => b - a)
    : [];

  // Tipo del file mostrato. Gli URL firmati Supabase conservano l'estensione reale
  // prima del ?token=… (…/2024_01_busta.jpg?token=…), così distinguiamo immagini da PDF.
  // I blob: locali (upload owner) non hanno estensione: ricadono nel ramo <object>
  // che prova il PDF e altrimenti ripiega sull'<img> di fallback.
  const currentUrl = payslipFiles[currentFileIndex];
  const isImageFile = !!currentUrl &&
    /\.(jpe?g|png|gif|webp|bmp|heic|heif|tiff?)$/.test(currentUrl.split('?')[0].toLowerCase());
  return (
  <motion.div
    initial={{ width: 0, opacity: 0, x: -50 }}
    animate={{ width: '45%', opacity: 1, x: 0 }}
    exit={{ width: 0, opacity: 0, x: -50 }}
    className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-700 shrink-0 z-40"
    onDragOver={isReadOnly ? undefined : onDragOver}
    onDrop={isReadOnly ? undefined : onDrop}
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
        {/* VISORE: torna al picker dell'archivio per scegliere altre buste */}
        {isReadOnly && payslipFiles.length > 0 && onBackToArchivePicker && (
          <button
            onClick={onBackToArchivePicker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-cyan-600 text-white transition-colors"
            title="Torna all'archivio per scegliere altre buste"
          >
            <ChevronLeft className="w-4 h-4" /> Archivio
          </button>
        )}
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

        {/* Badge col mese del PDF visualizzato (nello spazio liberato dallo Smart Upload) */}
        {currentFileMonthLabel && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tracking-wide whitespace-nowrap">{currentFileMonthLabel}</span>
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

            {!isReadOnly && (
            <button
              onClick={onDeleteCurrentFile}
              className="p-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded-lg ml-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            )}
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
          {isImageFile ? (
            // Buste archiviate in JPG/PNG (foto): renderizziamo direttamente l'<img>.
            // Mettere l'immagine come contenuto di fallback dentro un <object> nascosto
            // (display:none) la nascondeva insieme all'object → visore scuro.
            <img
              ref={imgRef}
              src={currentUrl}
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
          ) : (
            <object
              data={currentUrl}
              type="application/pdf"
              className="w-full h-full rounded-none"
              style={{ pointerEvents: isSniperMode ? 'none' : 'auto' }}
            >
              {/* Fallback per i blob: locali senza estensione che non sono PDF */}
              <img
                ref={imgRef}
                src={currentUrl}
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
          )}

          {/* AI explain button — nascosto al visore: eviterebbe chiamate Gemini sprecate */}
          {payslipFiles.length > 0 && !isExplainerOpen && !isReadOnly && (
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
      ) : isReadOnly ? (
        // VISORE: niente upload. Mostra il picker delle buste archiviate sul DB cosi'
        // il sindacalista apre una busta senza passare dal tab Archivio.
        // `absolute inset-0`: il picker scrolla DENTRO l'altezza del body (guidata dalla
        // tabella di fianco) invece di far crescere la pagina quando ci sono molti anni.
        archivedPicks && archivedPicks.length > 0 ? (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 pb-20">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 text-center">
              Buste paga archiviate
            </p>
            {pickYears.map(year => {
              const yearPicks = archivedPicks
                .filter(p => p.year === year)
                .sort((a, b) => a.monthIdx - b.monthIdx);
              return (
                <div key={year} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-cyan-400">{year}</span>
                    <span className="flex-1 h-px bg-slate-700/60" />
                    <button
                      onClick={() => onOpenArchivedPicks?.(yearPicks.map(p => p.id))}
                      className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500 transition-colors"
                      title={`Apri tutte le ${yearPicks.length} buste del ${year}`}
                    >
                      Tutto l'anno
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {yearPicks.map(p => {
                      const selected = selectedPickIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePick(p.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-colors ${
                            selected
                              ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-cyan-500'
                          }`}
                          title={`${p.month} ${p.year} — ${p.filename}`}
                        >
                          {MONTH_SHORT[p.monthIdx] ?? p.month.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Barra di conferma: appare quando ci sono buste selezionate */}
            {selectedPickIds.size > 0 && (
              <div className="sticky bottom-0 -mx-4 -mb-20 px-4 py-3 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex items-center gap-2">
                <button
                  onClick={() => setSelectedPickIds(new Set())}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => { onOpenArchivedPicks?.([...selectedPickIds]); setSelectedPickIds(new Set()); }}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-white transition-colors"
                >
                  Apri {selectedPickIds.size} {selectedPickIds.size === 1 ? 'busta' : 'buste'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center text-slate-500 dark:text-slate-300 p-8 w-64 h-64">
            <p className="text-sm text-center opacity-60">Nessuna busta paga<br />disponibile</p>
          </div>
        )
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
};

export default SplitViewViewer;
