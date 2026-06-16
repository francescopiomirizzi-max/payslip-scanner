import React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, LogOut } from 'lucide-react';

interface Props {
  /** Importo dovuto (da `app_settings.payment_amount_eur`). */
  amount: number;
  /** Esci dall'account: unica azione concessa (non dà accesso al gestionale). */
  onLogout: () => void;
}

/**
 * Schermata a tutto campo che SOSPENDE l'accesso al gestionale per il viewer
 * readonly finché non salda quanto pattuito. Non skippabile: non esiste alcun
 * pulsante per proseguire — solo l'uscita dall'account. Renderizzata da App.tsx
 * AL POSTO dell'intera app quando `useViewerPaymentBlock().blocked` è vero, così
 * dietro non c'è nulla da consultare né con cui interagire.
 */
const ViewerPaymentBlock: React.FC<Props> = ({ amount, onLogout }) => {
  const importo = `€ ${amount.toLocaleString('it-IT')},00`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 sm:p-6">
      {/* Alone rosso d'allarme dietro la card */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] max-w-[90vw] max-h-[90vh] rounded-full bg-red-600/20 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-red-200/70 dark:border-red-500/30 shadow-[0_30px_80px_-20px_rgba(220,38,38,0.55)] overflow-hidden"
      >
        {/* Banda d'allarme superiore */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center ring-4 ring-red-500/10">
            <AlertOctagon className="w-9 h-9 text-red-600 dark:text-red-400" strokeWidth={2.2} />
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Accesso sospeso
          </h1>

          <div className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 text-left">
            <p>Gentile <strong>Vincenzo Cataneo</strong>,</p>
            <p>l'accesso al gestionale è attualmente <strong>sospeso</strong>.</p>
            <p>
              Come concordato espressamente durante il nostro ultimo incontro, il
              corrispettivo dovuto per <strong>le pratiche concluse</strong> e per
              <strong> l'aggiornamento della piattaforma</strong> è di:
            </p>

            {/* Importo in evidenza */}
            <div className="my-2 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/25 px-5 py-4 text-center">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500/80 dark:text-red-400/80">
                Importo dovuto
              </div>
              <div className="mt-1 text-4xl font-black tabular-nums text-red-600 dark:text-red-400">
                {importo}
              </div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-red-500/70 dark:text-red-400/70">
                Non soggetto a trattativa
              </div>
            </div>

            <p>
              Fino al <strong>saldo integrale</strong> dell'importo non sarà
              possibile accedere ad alcuna funzione del gestionale.
            </p>
            <p>
              Per regolarizzare la posizione e riattivare immediatamente l'accesso,
              <strong> contattami direttamente</strong>.
            </p>
          </div>

          {/* Unica azione: uscire (non concede accesso) */}
          <button
            type="button"
            onClick={onLogout}
            className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Esci dall'account
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ViewerPaymentBlock;
