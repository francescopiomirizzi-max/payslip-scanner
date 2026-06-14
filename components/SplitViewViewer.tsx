import React from 'react';
import { motion } from 'framer-motion';
import { useIsReadOnly } from '../lib/readonly';
import {
  Loader2,
  ChevronLeft, ChevronRight,
  Crosshair, Eye, ScanEye,
  Wand2, RotateCw, ZoomOut, ZoomIn, Maximize,
  Trash2, X, Bot, Upload, CalendarDays,
  Archive, Check,
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

const MONTH_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

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
  const pickYears = archivedPicks
    ? Array.from(new Set(archivedPicks.map(p => p.year))).sort((a, b) => b - a)
    : [];

  // Stato vuoto sull'account principale (NON visore read-only): scelta tra upload
  // locale e archivio. Il toggle parte sempre da 'local' così l'apertura del visore
  // si comporta come oggi; l'archivio è opt-in esplicito.
  const hasArchive = !!archivedPicks && archivedPicks.length > 0;
  const [emptyMode, setEmptyMode] = React.useState<'local' | 'archive'>('local');
  // Anno selezionato nel pannello archivio master/detail (default = più recente).
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
  const effectiveYear = selectedYear !== null && pickYears.includes(selectedYear)
    ? selectedYear
    : (pickYears[0] ?? null);

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
        {payslipFiles.length > 0 && onBackToArchivePicker && (isReadOnly || hasArchive) && (
          <button
            onClick={() => { if (!isReadOnly) setEmptyMode('archive'); onBackToArchivePicker(); }}
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
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 text-center">
              Buste paga archiviate
            </p>

            {/* Selettore anno: un anno alla volta, niente muro di griglie */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-4">
              {pickYears.map(year => {
                const active = year === effectiveYear;
                return (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black tabular-nums transition-colors ${
                      active
                        ? 'bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>

            {/* Mesi dell'anno scelto: TAP = apre subito la busta (nessuna conferma) */}
            {effectiveYear !== null && (() => {
              const yearPicks = archivedPicks
                .filter(p => p.year === effectiveYear)
                .sort((a, b) => a.monthIdx - b.monthIdx);
              const byMonth = new Map<number, ArchivedPick[]>();
              yearPicks.forEach(p => {
                const arr = byMonth.get(p.monthIdx) ?? [];
                arr.push(p);
                byMonth.set(p.monthIdx, arr);
              });
              const months = [...byMonth.entries()].sort((a, b) => a[0] - b[0]);
              return (
                <>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm font-bold text-cyan-400">{effectiveYear}</span>
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">{byMonth.size} {byMonth.size === 1 ? 'busta' : 'buste'}</span>
                    <span className="flex-1 h-px bg-slate-700/60" />
                    {yearPicks.length > 0 && (
                      <button
                        onClick={() => onOpenArchivedPicks?.(yearPicks.map(p => p.id))}
                        className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500 transition-colors"
                        title={`Apri tutte le ${yearPicks.length} buste del ${effectiveYear}`}
                      >
                        Tutto l'anno
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {months.map(([m, picks]) => (
                      <button
                        key={m}
                        onClick={() => onOpenArchivedPicks?.(picks.map(p => p.id))}
                        className="group flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-600 border border-slate-700 hover:border-cyan-500 text-left transition-colors"
                        title={picks.map(p => `${p.month} ${p.year} — ${p.filename}`).join('\n')}
                      >
                        <CalendarDays className="w-4 h-4 text-cyan-400 group-hover:text-white shrink-0" />
                        <span className="text-sm font-bold text-slate-100 group-hover:text-white truncate">{MONTH_FULL[m]}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center justify-center text-slate-500 dark:text-slate-300 p-8 w-64 h-64">
            <p className="text-sm text-center opacity-60">Nessuna busta paga<br />disponibile</p>
          </div>
        )
      ) : (
        // Account principale: scelta tra upload locale e archivio (master/detail).
        // Il toggle "Dall'archivio" appare solo se ci sono buste archiviate per il
        // lavoratore; di default si parte dall'upload locale come oggi.
        <div className="absolute inset-0 flex flex-col p-4">
          {hasArchive && (
            <div className="flex items-center justify-center mb-3 shrink-0">
              <div className="inline-flex p-1 rounded-xl bg-slate-800/80 border border-slate-700">
                <button
                  onClick={() => setEmptyMode('local')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${emptyMode === 'local' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                >
                  <Upload className="w-3.5 h-3.5" /> Carica busta paga
                </button>
                <button
                  onClick={() => setEmptyMode('archive')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${emptyMode === 'archive' ? 'bg-cyan-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                >
                  <Archive className="w-3.5 h-3.5" /> Carica dall'archivio
                </button>
              </div>
            </div>
          )}

          {(!hasArchive || emptyMode === 'local') ? (
            // Upload locale (com'era): area drag&drop centrata.
            <div className="flex-1 flex items-center justify-center">
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
            </div>
          ) : (
            // Archivio master/detail: anni a sinistra, mesi a destra in elenco.
            // La griglia è solo metadati (zero egress); l'egress scatta solo quando
            // si apre davvero una busta, come nel visore read-only.
            (() => {
              const yearPicks = effectiveYear === null
                ? []
                : archivedPicks!.filter(p => p.year === effectiveYear).sort((a, b) => a.monthIdx - b.monthIdx);
              const byMonth = new Map<number, ArchivedPick[]>();
              yearPicks.forEach(p => {
                const arr = byMonth.get(p.monthIdx) ?? [];
                arr.push(p);
                byMonth.set(p.monthIdx, arr);
              });
              return (
                <div className="flex-1 min-h-0 flex gap-3">
                  {/* Colonna anni */}
                  <div className="w-24 shrink-0 flex flex-col gap-1 overflow-y-auto custom-scrollbar border-r border-slate-700 pr-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 py-1">Anni</p>
                    {pickYears.map(year => {
                      const count = archivedPicks!.filter(p => p.year === year).length;
                      const active = year === effectiveYear;
                      return (
                        <button
                          key={year}
                          onClick={() => setSelectedYear(year)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                          <span>{year}</span>
                          <span className={`text-[10px] tabular-nums ${active ? 'text-cyan-100' : 'text-slate-500'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Colonna mesi */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <p className="text-xs font-bold text-cyan-400">
                        {effectiveYear ?? '—'} · {byMonth.size} {byMonth.size === 1 ? 'busta' : 'buste'}
                      </p>
                      {yearPicks.length > 0 && (
                        <button
                          onClick={() => onOpenArchivedPicks?.(yearPicks.map(p => p.id))}
                          className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500 transition-colors"
                          title={`Apri tutte le ${yearPicks.length} buste del ${effectiveYear}`}
                        >
                          Tutto l'anno
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                      {MONTH_FULL.map((label, m) => {
                        const picks = byMonth.get(m);
                        if (!picks) {
                          return (
                            <div key={m} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-dashed border-slate-700/60 text-slate-600 select-none">
                              <span className="w-4 h-4 shrink-0 rounded border border-dashed border-slate-700" />
                              <span className="text-xs font-medium w-20 shrink-0">{label}</span>
                              <span className="text-[11px] opacity-60">—</span>
                            </div>
                          );
                        }
                        const selected = picks.some(p => selectedPickIds.has(p.id));
                        return (
                          <button
                            key={m}
                            onClick={() => setSelectedPickIds(prev => {
                              const next = new Set(prev);
                              picks.forEach(p => selected ? next.delete(p.id) : next.add(p.id));
                              return next;
                            })}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors ${selected ? 'bg-cyan-500/15 border-cyan-500/50' : 'bg-slate-800/60 border-slate-700 hover:border-cyan-500/40 hover:bg-slate-800'}`}
                          >
                            <span className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border ${selected ? 'bg-cyan-500 border-cyan-400' : 'border-slate-500'}`}>
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="text-xs font-bold text-slate-200 w-20 shrink-0">{label}</span>
                            <span className="text-[11px] text-slate-400 truncate flex-1" title={picks.map(p => p.filename).join('\n')}>
                              {picks[0].filename}{picks.length > 1 ? ` +${picks.length - 1}` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Barra apertura selezione (può attraversare più anni) */}
                    {selectedPickIds.size > 0 && (
                      <div className="shrink-0 mt-2 flex items-center gap-2">
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
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  </motion.div>
  );
};

export default SplitViewViewer;
