import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileSpreadsheet, LayoutGrid, Calculator, TrendingUp,
  User, BadgeCheck, CalendarPlus, Wallet, Ticket, CalendarClock,
  Briefcase, Eye, X, Loader2, ScanLine, Send, Gavel,
  Handshake, CheckCircle2, AlertCircle, Search, ChevronDown,
  QrCode, Download, Bot, Cpu, FileText, Save, CheckCircle, AlertTriangle, Archive,
} from 'lucide-react';
import { LineChart } from 'lucide-react';
import SplitViewViewer from './SplitViewViewer';
import QRScannerModal from './QRScannerModal';
import IstatDashboardModal from './WorkerTables/IstatDashboardModal';
import { Worker, AnnoDati, YEARS } from '../types';
import { getProfiloBadgeLabel } from '../utils/formatters';
import { FRAMER_PHYSICS } from '../framerConfig';

const MovingGrid = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-500">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] transition-colors duration-500"></div>
    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob transition-colors duration-500"></div>
    <div className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000 transition-colors duration-500"></div>
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000 transition-colors duration-500"></div>
  </div>
);

interface WorkerDetailLayoutProps {
  worker: Worker;
  badgeStyles: string;
  onBack: () => void;
  onShowReport: () => void;
  onSendPec: () => void;
  onPrintTables: () => void;
  onOpenIstat: () => void;
  startClaimYear: number;
  onStartClaimYearChange: (y: number) => void;
  isGlobalDragging: boolean;
  onSetIsGlobalDragging: (v: boolean) => void;
  onBatchUpload: (e: any, isSingle?: boolean) => void;
  isTimelineOpen: boolean;
  onToggleTimeline: () => void;
  legalStatus: 'analisi' | 'pronta' | 'inviata' | 'trattativa' | 'chiusa';
  onLegalStatusChange: (s: string) => void;
  onUpdateStatus: (s: string) => void;
  tickerItems: any[];
  activeTickerModal: { title: string; content: React.ReactNode } | null;
  onSetActiveTickerModal: (m: { title: string; content: React.ReactNode } | null) => void;
  includeExFest: boolean;
  onToggleExFest: () => void;
  includeTickets: boolean;
  onToggleTickets: () => void;
  isBatchProcessing: boolean;
  isAnalyzing: boolean;
  scanRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showSplit: boolean;
  onSetShowSplit: (v: boolean) => void;
  isQRModalOpen: boolean;
  onOpenQR: () => void;
  onCloseQR: () => void;
  onQRData: (data: any) => void;
  activeTab: 'input' | 'calc' | 'pivot' | 'tfr' | 'archive';
  onSetActiveTab: (t: 'input' | 'calc' | 'pivot' | 'tfr' | 'archive') => void;
  archiveCount: number;
  isExplainerOpen: boolean;
  onCloseExplainer: () => void;
  isExplaining: boolean;
  explanationData: string | null;
  onContainerScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  payslipFiles: string[];
  currentFileIndex: number;
  isSniperMode: boolean;
  onToggleSniper: () => void;
  isProcessing: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  imgRef: React.RefObject<HTMLImageElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  batchInputRef: React.RefObject<HTMLInputElement>;
  imgScale: number;
  imgPos: { x: number; y: number };
  imgRotation: number;
  imgFilter: 'none' | 'contrast';
  isDragging: boolean;
  onPrevFile: () => void;
  onNextFile: () => void;
  onDeleteCurrentFile: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onToggleFilter: () => void;
  onRotate: () => void;
  onZoom: (delta: number) => void;
  onResetView: () => void;
  onExplainPayslip: () => void;
  batchProgress: number;
  batchTotal: number;
  showSupernova: boolean;
  batchNotification: { msg: string; type: 'success' | 'warning' | 'error' } | null;
  onCloseBatchNotification: () => void;
  isIstatModalOpen: boolean;
  onCloseIstat: () => void;
  monthlyInputs: AnnoDati[];
  isAiTfrModalOpen: boolean;
  onCloseAiTfr: () => void;
  aiTfrAmount: string;
  onSetAiTfrAmount: (v: string) => void;
  aiTfrYear: string;
  onSetAiTfrYear: (v: string) => void;
  onSaveAiTfr: () => void;
  onIgnoreAiTfr: () => void;
  children: React.ReactNode;
}

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

const WorkerDetailLayout: React.FC<WorkerDetailLayoutProps> = ({
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
  payslipFiles, currentFileIndex, isSniperMode, onToggleSniper, isProcessing,
  selectionBox, imgRef, containerRef, fileInputRef, batchInputRef,
  imgScale, imgPos, imgRotation, imgFilter, isDragging,
  onPrevFile, onNextFile, onDeleteCurrentFile, onImageUpload,
  onDragOver, onDrop, onMouseDown, onMouseMove, onMouseUp,
  onToggleFilter, onRotate, onZoom, onResetView, onExplainPayslip,
  batchProgress, batchTotal, showSupernova,
  batchNotification, onCloseBatchNotification,
  isIstatModalOpen, onCloseIstat, monthlyInputs,
  isAiTfrModalOpen, onCloseAiTfr, aiTfrAmount, onSetAiTfrAmount, aiTfrYear, onSetAiTfrYear,
  onSaveAiTfr, onIgnoreAiTfr,
  children,
}) => {
  const commandBarRef = useRef<HTMLDivElement>(null);

  const TimelineStep = ({ step, label, icon: Icon, activeStatus }: any) => {
    const steps = ['analisi', 'pronta', 'inviata', 'trattativa', 'chiusa'];
    const isActive = step === activeStatus;
    const isPast = steps.indexOf(activeStatus) > steps.indexOf(step);
    let colorClass = 'text-slate-400 dark:text-slate-200 border-slate-300 dark:text-slate-500 dark:text-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800';
    if (isActive || isPast) {
      if (step === 'analisi' || step === 'trattativa') colorClass = 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-500 dark:shadow-[0_0_10px_rgba(220,38,38,0.5)]';
      else if (step === 'pronta' || step === 'inviata') colorClass = 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-500 dark:shadow-[0_0_10px_rgba(217,119,6,0.5)]';
      else if (step === 'chiusa') colorClass = 'text-white bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-500 dark:shadow-[0_0_10px_rgba(5,150,105,0.5)]';
    }
    return (
      <div
        onClick={() => { onLegalStatusChange(step); if (onUpdateStatus) onUpdateStatus(step); }}
        className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${isActive ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-slate-800 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-300'}`}>{label}</span>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#020617] font-sans text-slate-900 dark:text-slate-100 relative flex flex-col overflow-hidden transition-colors duration-500"
      onDragEnter={(e) => { e.preventDefault(); onSetIsGlobalDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onSetIsGlobalDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onBatchUpload({ target: { files: e.dataTransfer.files } } as any);
        }
      }}
    >
      {/* --- 1. GLOBAL MAGNETIC DROPZONE --- */}
      <AnimatePresence mode="wait">
        {isGlobalDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => onSetIsGlobalDragging(false)}
            className="fixed inset-0 z-[999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center border-[8px] border-dashed border-fuchsia-500/50 m-4 rounded-[3rem] cursor-pointer"
            onDragLeave={(e) => {
              if (e.clientX === 0 || e.clientY === 0) onSetIsGlobalDragging(false);
            }}
          >
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Bot className="w-32 h-32 text-fuchsia-400 drop-shadow-[0_0_40px_rgba(217,70,239,0.8)]" />
            </motion.div>
            <h2 className="text-4xl font-black text-white mt-8 tracking-widest uppercase text-center">Sgancia i file qui</h2>
            <p className="text-fuchsia-300 font-bold mt-2 text-center">Il Motore Neurale li processerà in automatico.</p>
            <div className="mt-12 flex flex-col items-center">
              <span className="text-slate-400 dark:text-slate-200 text-sm mb-4">oppure</span>
              <button
                onClick={(e) => { e.stopPropagation(); onSetIsGlobalDragging(false); }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all border border-slate-600 hover:border-slate-400 shadow-xl active:scale-95"
              >
                <X className="w-5 h-5" /> Annulla e Chiudi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MovingGrid />

      <div className="relative z-50 pt-20 px-6 pb-2">
        {/* HEADER GLASSMORPHISM */}
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl text-white shadow-indigo-200 dark:shadow-indigo-900/40 ring-4 ring-white dark:ring-slate-800 shrink-0 transition-all"
                style={{ background: `linear-gradient(135deg, ${worker.accentColor === 'indigo' ? '#6366f1' : worker.accentColor === 'emerald' ? '#10b981' : worker.accentColor === 'orange' ? '#f97316' : '#3b82f6'}, ${worker.accentColor === 'indigo' ? '#4f46e5' : worker.accentColor === 'emerald' ? '#059669' : worker.accentColor === 'orange' ? '#ea580c' : '#2563eb'})` }}>
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
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* TASTO CALCOLO ISTAT */}
            <button
              onClick={onOpenIstat}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #eab308 0%, #d946ef 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <LineChart className="w-4 h-4 transition-transform duration-500 group-hover:-translate-y-1" strokeWidth={2.5} />
              <span className="hidden lg:inline tracking-wide">Calcolo interessi (ISTAT)</span>
            </button>

            {/* TASTO PEC */}
            <button
              onClick={onSendPec}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #334155 0%, #475569 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Send className="w-4 h-4 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" strokeWidth={2.5} />
              <span className="hidden lg:inline">PEC</span>
            </button>

            {/* TASTO DOWNLOAD */}
            <button
              onClick={onPrintTables}
              className="group relative px-6 py-2.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-2"
              style={{ background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Download className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-1" strokeWidth={2.5} />
              <span className="hidden xl:inline">Download</span>
            </button>

            {/* TASTO VAI AL REPORT */}
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
      </div>

      <div className="relative z-10 flex-1 p-6 flex flex-col gap-6 max-w-[1800px] mx-auto w-full">

        {/* TIMELINE STATO VERTENZA */}
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
                  <TimelineStep step="analisi" label="Analisi" icon={Search} activeStatus={legalStatus} />
                  <TimelineStep step="pronta" label="Conteggi" icon={Calculator} activeStatus={legalStatus} />
                  <TimelineStep step="inviata" label="PEC Inviata" icon={Send} activeStatus={legalStatus} />
                  <TimelineStep step="trattativa" label="Trattativa" icon={Handshake} activeStatus={legalStatus} />
                  <TimelineStep step="chiusa" label="Chiusa" icon={CheckCircle2} activeStatus={legalStatus} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* COMMAND BAR */}
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

            {/* TASTO AI AGENT */}
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

            {/* TASTO CARICA BUSTA */}
            <button
              onClick={() => onSetShowSplit(!showSplit)}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${showSplit
                  ? 'text-white shadow-lg shadow-pink-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-700 hover:text-pink-500 hover:shadow-md'
                }`}
              style={showSplit ? { backgroundImage: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <div className="relative z-10 flex items-center gap-2">
                {showSplit ? <X className="w-5 h-5" /> : <Eye className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />}
                <span className="hidden lg:inline">{showSplit ? 'Chiudi Visore' : 'Carica Busta Paga'}</span>
              </div>
            </button>

            {/* TASTO SCAN AI */}
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

            {/* INPUT FILE SCAN */}
            <input type="file" accept="image/*,.pdf" ref={scanRef} className="hidden" onChange={onFileUpload} />

            {/* TASTO MOBILE SCAN */}
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

            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

            {/* TAB: INSERIMENTO MENSILE */}
            <button
              onClick={() => onSetActiveTab('input')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'input'
                  ? 'text-white shadow-lg shadow-blue-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-blue-500 dark:hover:text-cyan-400 hover:shadow-md'
                }`}
              style={activeTab === 'input' ? { backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <LayoutGrid className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'input' ? 'rotate-0' : 'group-hover:rotate-90'}`} />
              <span className="relative z-10">Inserimento Mensile</span>
            </button>

            {/* TAB: RIEPILOGO ANNUALE */}
            <button
              onClick={() => onSetActiveTab('calc')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'calc'
                  ? 'text-white shadow-lg shadow-emerald-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-500 dark:hover:text-emerald-400 hover:shadow-md'
                }`}
              style={activeTab === 'calc' ? { backgroundImage: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Calculator className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'calc' ? 'rotate-0' : 'group-hover:rotate-12'}`} />
              <span className="relative z-10">Riepilogo Annuale</span>
            </button>

            {/* TAB: ANALISI VOCI */}
            <button
              onClick={() => onSetActiveTab('pivot')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'pivot'
                  ? 'text-white shadow-lg shadow-amber-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-md'
                }`}
              style={activeTab === 'pivot' ? { backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <TrendingUp className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'pivot' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Analisi Voci</span>
            </button>

            <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

            {/* TAB: PROSPETTO TFR */}
            <button
              onClick={() => onSetActiveTab('tfr')}
              className={`group relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 overflow-hidden border-2 shrink-0
                  ${activeTab === 'tfr'
                  ? 'text-white shadow-lg shadow-fuchsia-500/30 border-white/20'
                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 dark:text-slate-200 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:text-fuchsia-500 hover:shadow-md'
                }`}
              style={activeTab === 'tfr' ? { backgroundImage: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)' } : {}}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
              <Wallet className={`w-5 h-5 transition-transform duration-300 relative z-10 ${activeTab === 'tfr' ? 'rotate-0' : 'group-hover:-translate-y-1 group-hover:translate-x-1'}`} />
              <span className="relative z-10">Prospetto TFR</span>
            </button>

          </div>
        </div>

        {/* SPLIT SCREEN CONTAINER */}
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
                currentFileIndex={currentFileIndex}
                isBatchProcessing={isBatchProcessing}
                isSniperMode={isSniperMode}
                isProcessing={isProcessing}
                selectionBox={selectionBox}
                imgRef={imgRef}
                containerRef={containerRef}
                fileInputRef={fileInputRef}
                batchInputRef={batchInputRef}
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
                onBatchUpload={onBatchUpload}
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
      </div>

      {/* HUD BATCH PROCESSING */}
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

      {/* TOAST NOTIFICATION */}
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

      {/* MODALE QR CODE */}
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
              className="relative w-full max-w-lg bg-slate-900 rounded-[2rem] shadow-[0_0_60px_rgba(79,70,229,0.3)] border border-slate-700 overflow-hidden"
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
    </div>
  );
};

export default WorkerDetailLayout;
