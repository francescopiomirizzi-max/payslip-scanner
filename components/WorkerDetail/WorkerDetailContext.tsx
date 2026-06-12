import React, { createContext, useContext, ReactNode } from 'react';
import { Worker, AnnoDati } from '../../types';
import type { ArchivedPick } from '../SplitViewViewer';

// Valore del context del sottoalbero WorkerDetail. È la vecchia interfaccia
// `WorkerDetailLayoutProps` (meno `children`): tutto lo stato e gli handler vivono
// in WorkerDetailPage e vengono distribuiti via context invece che per ~80 prop.
export interface WorkerDetailContextValue {
  worker: Worker;
  badgeStyles: string;
  onBack: () => void;
  onShowReport: () => void;
  onSendPec: () => void;
  onPrintTables: () => void;
  onOpenIstat: () => void;
  startClaimYear: number;
  onStartClaimYearChange: (y: number) => void;
  /** Persistenza campi worker (cloud-synced via auto-sync useWorkers). */
  onUpdateWorkerFields: (fields: Partial<Worker>) => void;
  /** false = chiusa; 'drag' = overlay fucsia da trascinamento; 'folder' = overlay
      ambra aperto dal tasto CARTELLA (stesso tema del tasto). */
  isGlobalDragging: false | 'drag' | 'folder';
  onSetIsGlobalDragging: (v: false | 'drag' | 'folder') => void;
  onBatchUpload: (e: any, isSingle?: boolean) => void;
  /** Drop di file E cartelle (traversate ricorsivamente, anche più cartelle-anno). */
  onBatchDrop: (dataTransfer: DataTransfer) => void;
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
  includePaidLeave: boolean;
  onTogglePaidLeave: () => void;
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
  archivedPicks?: ArchivedPick[];
  onOpenArchivedPicks?: (ids: string[]) => void;
  onBackToArchivePicker?: () => void;
  currentFileIndex: number;
  currentFileMonthLabel: string | null;
  isSniperMode: boolean;
  onToggleSniper: () => void;
  isProcessing: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  imgRef: React.RefObject<HTMLImageElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
}

const WorkerDetailContext = createContext<WorkerDetailContextValue | undefined>(undefined);

// Provider pass-through: lo stato vive in WorkerDetailPage, che passa il value già
// costruito. A differenza di IslandContext, qui il provider non possiede stato proprio.
export const WorkerDetailProvider: React.FC<{ value: WorkerDetailContextValue; children: ReactNode }> = ({ value, children }) => (
  <WorkerDetailContext.Provider value={value}>{children}</WorkerDetailContext.Provider>
);

export const useWorkerDetail = (): WorkerDetailContextValue => {
  const ctx = useContext(WorkerDetailContext);
  if (!ctx) throw new Error('useWorkerDetail deve essere usato dentro un WorkerDetailProvider');
  return ctx;
};
