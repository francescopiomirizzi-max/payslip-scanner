import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, SquarePen, FileText, Archive, ArrowRight, X } from 'lucide-react';
import { Worker } from '../types';
import { getCassettoByStatus } from '../config/cassetti';

interface WorkerDestinationModalProps {
  worker: Worker;
  /** Colore identità dell'azienda: avatar + accenti soft. */
  hex: string;
  onClose: () => void;
  onDashboard: () => void;
  onDetail: () => void;
  onReport: () => void;
  onArchive: () => void;
}

interface Destination {
  key: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}

/**
 * Scelta della destinazione partendo da un lavoratore della scheda azienda.
 * Modale centrata (blur + spring-in) con 4 card-destinazione a colori distinti
 * ed entrata sfalsata. Chiusura con Esc, click sullo sfondo o sulla X.
 */
const WorkerDestinationModal: React.FC<WorkerDestinationModalProps> = ({
  worker, hex, onClose, onDashboard, onDetail, onReport, onArchive,
}) => {
  const initial = (worker.cognome || worker.nome || '?').charAt(0).toUpperCase();
  const cassetto = getCassettoByStatus(worker.status);

  // Esc per chiudere + blocco scroll del body mentre la modale è aperta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const destinations: Destination[] = [
    { key: 'dashboard', icon: LayoutDashboard, title: 'Dashboard', subtitle: 'Torna alla panoramica', color: '#6366f1', onClick: onDashboard },
    { key: 'detail', icon: SquarePen, title: 'Dettaglio inserimento', subtitle: 'Inserisci e calcola le buste', color: '#0ea5e9', onClick: onDetail },
    { key: 'report', icon: FileText, title: 'Report finale', subtitle: 'Il riepilogo per l’avvocato', color: '#10b981', onClick: onReport },
    { key: 'archive', icon: Archive, title: 'Archivio lavoratore', subtitle: 'Le buste paga caricate', color: '#f59e0b', onClick: onArchive },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      {/* Sfondo: oscura e sfoca tutto il resto */}
      <motion.div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        transition={{ duration: 0.2 }}
      />

      {/* Alone soft del colore-azienda dietro la card */}
      <motion.div
        aria-hidden
        className="absolute w-[34rem] h-[34rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${hex}, transparent 70%)` }}
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 0.18 } }}
        transition={{ duration: 0.35 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
        variants={{
          hidden: { opacity: 0, scale: 0.92, y: 16 },
          visible: { opacity: 1, scale: 1, y: 0 },
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Accento superiore nel colore-azienda */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-24 rounded-full" style={{ backgroundColor: hex }} />

        {/* Header lavoratore */}
        <div className="flex items-center gap-3.5 mb-1">
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${hex}, ${hex}aa)` }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-lg leading-tight truncate">
              {worker.cognome} {worker.nome}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cassetto.accentHex }} />
                {cassetto.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-4 mb-3">Dove vuoi andare?</p>

        {/* Card destinazione — griglia 2x2, entrata sfalsata */}
        <div className="grid grid-cols-2 gap-3">
          {destinations.map((d, i) => {
            const DIcon = d.icon;
            return (
              <motion.button
                key={d.key}
                onClick={d.onClick}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 240, damping: 20 }}
                whileHover={{ y: -4, boxShadow: `0 18px 38px -16px ${d.color}` }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left transition-colors hover:bg-white dark:hover:bg-slate-800"
              >
                <span
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${d.color}1f`, color: d.color }}
                >
                  <DIcon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-black text-slate-800 dark:text-white text-sm leading-tight">{d.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{d.subtitle}</p>
                </div>
                <ArrowRight
                  className="absolute top-4 right-4 w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  style={{ color: d.color }}
                />
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WorkerDestinationModal;
