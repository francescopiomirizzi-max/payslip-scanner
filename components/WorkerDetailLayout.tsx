import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { useWorkerDetail } from './WorkerDetail/WorkerDetailContext';
import WorkerDetailHeader from './WorkerDetail/WorkerDetailHeader';
import VertenzaTimeline from './WorkerDetail/VertenzaTimeline';
import WorkerDetailCommandBar from './WorkerDetail/WorkerDetailCommandBar';
import WorkerDetailContent from './WorkerDetail/WorkerDetailContent';
import WorkerDetailHuds from './WorkerDetail/WorkerDetailHuds';
import WorkerDetailToast from './WorkerDetail/WorkerDetailToast';
import WorkerDetailModals from './WorkerDetail/WorkerDetailModals';

const MovingGrid = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-500">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] transition-colors duration-500"></div>
    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob transition-colors duration-500"></div>
    <div className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000 transition-colors duration-500"></div>
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000 transition-colors duration-500"></div>
  </div>
);

// Guscio sottile: dopo l'estrazione delle sezioni (Fase 2), WorkerDetailLayout si limita
// a comporre i sottocomponenti sotto components/WorkerDetail/, ognuno dei quali legge il
// context via useWorkerDetail(). Qui restano solo il root con i drag handler globali, la
// dropzone magnetica e i wrapper strutturali (invariati per non alterare il layout).
const WorkerDetailLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isGlobalDragging, onSetIsGlobalDragging, onBatchUpload } = useWorkerDetail();

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
        <WorkerDetailHeader />
      </div>

      <div className="relative z-10 flex-1 p-6 flex flex-col gap-6 max-w-[1800px] mx-auto w-full">
        <VertenzaTimeline />
        <WorkerDetailCommandBar />
        <WorkerDetailContent>{children}</WorkerDetailContent>
      </div>

      <WorkerDetailHuds />
      <WorkerDetailToast />
      <WorkerDetailModals />
    </div>
  );
};

export default WorkerDetailLayout;
