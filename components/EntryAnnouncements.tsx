import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, X, AlertCircle, Info } from 'lucide-react';
import { MessageRecord, CATEGORY_BUSTE_MANCANTI } from '../hooks/useMessages';

interface EntryAnnouncementsProps {
  /** Messaggi non letti da mostrare in evidenza all'ingresso. */
  messages: MessageRecord[];
  /** Chiude lo spotlight e segna i messaggi come letti. */
  onDismiss: () => void;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Spotlight d'ingresso (solo viewer): appena entra, se ci sono comunicazioni nuove
 * le mostra in primo piano come card AFFIANCATE (2 in fila su desktop, impilate su
 * schermo stretto). Alla chiusura vengono segnate come lette e non ricompaiono, ma
 * restano sempre disponibili nella bacheca (icona Mail). I messaggi vengono catturati
 * al mount, così non spariscono se lo stato a monte si azzera con "letto".
 */
const EntryAnnouncements: React.FC<EntryAnnouncementsProps> = ({ messages, onDismiss }) => {
  const [items] = useState<MessageRecord[]>(messages);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onDismiss]);

  if (items.length === 0) return null;
  const twoUp = items.length > 1;

  return (
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      initial="hidden" animate="visible" exit="hidden"
    >
      <motion.div
        onClick={onDismiss}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${twoUp ? 'max-w-4xl' : 'max-w-lg'} max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden`}
        variants={{ hidden: { opacity: 0, scale: 0.94, y: 16 }, visible: { opacity: 1, scale: 1, y: 0 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500">
            <Megaphone className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-slate-900 dark:text-white leading-tight">Novità</p>
            <p className="text-[11px] font-medium text-slate-400">Le trovi sempre nella bacheca (icona in alto)</p>
          </div>
          <button
            onClick={onDismiss}
            className="ml-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card affiancate */}
        <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 grid gap-3 ${twoUp ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {items.map((m, i) => {
            const isBuste = m.category === CATEGORY_BUSTE_MANCANTI;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.24) }}
                className={`flex flex-col rounded-2xl border p-4 ${isBuste
                  ? 'border-amber-300/70 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isBuste
                    ? <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    : <Info className="w-4 h-4 shrink-0 text-indigo-400" />}
                  {m.title && <p className="font-black text-slate-900 dark:text-white text-sm">{m.title}</p>}
                </div>
                {m.body && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                )}
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-3">{fmtDate(m.created_at)}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onDismiss}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
          >
            Ho letto
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EntryAnnouncements;
