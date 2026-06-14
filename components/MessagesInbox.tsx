import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, X, Loader2, Inbox } from 'lucide-react';
import { useMessages, MessageRecord } from '../hooks/useMessages';

interface MessagesInboxProps {
  onClose: () => void;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * Bacheca annunci (sola lettura). Mostra le comunicazioni di sistema pubblicate
 * dall'amministrazione (novità di versione, manutenzioni, indisponibilità del
 * sito). Modale centrata con blur e spring-in. Nessun compositore: i messaggi
 * vengono inviati lato gestione, non dall'app.
 */
const MessagesInbox: React.FC<MessagesInboxProps> = ({ onClose }) => {
  const { listMessages } = useMessages();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listMessages().then(m => { if (alive) { setMessages(m); setLoading(false); } });
    return () => { alive = false; };
  }, [listMessages]);

  // Esc per chiudere + blocco scroll del body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      initial="hidden" animate="visible" exit="hidden"
    >
      <motion.div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        variants={{
          hidden: { opacity: 0, scale: 0.92, y: 16 },
          visible: { opacity: 1, scale: 1, y: 0 },
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500">
            <Mail className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-slate-900 dark:text-white leading-tight">Comunicazioni</p>
            <p className="text-[11px] font-medium text-slate-400">Aggiornamenti e avvisi sul servizio</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista messaggi */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Inbox className="w-10 h-10 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">Nessuna comunicazione al momento.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.2) }}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4"
              >
                {m.title && <p className="font-black text-slate-900 dark:text-white text-sm">{m.title}</p>}
                {m.body && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-2">{fmtDate(m.created_at)}</p>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MessagesInbox;
