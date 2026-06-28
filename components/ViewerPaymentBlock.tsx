import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Nota disambiguante per omonimi/identificazione (sostituisce il profilo tra parentesi).
const NOTE_DISAMBIGUA: Record<string, string> = { 'Avella Antonio': 'Foggia' };

interface MissingPeriod { periodo: string; sortKey: number; persone: string[]; }

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

  // Elenco buste paga mancanti (fonte: worker_profiles.fix_targets), raggruppato
  // per periodo. Live: quando una busta viene sistemata, sparisce da qui.
  const [missing, setMissing] = useState<MissingPeriod[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('worker_profiles')
        .select('cognome, nome, profilo, fix_targets');
      if (!alive || !data) return;
      const byPeriod = new Map<string, { sortKey: number; persone: string[] }>();
      for (const r of data as any[]) {
        const ft = r.fix_targets;
        if (!Array.isArray(ft) || ft.length === 0) continue;
        for (const t of ft) {
          const key = `${MESI[t.monthIndex] ?? '?'} ${t.year}`;
          const base = `${r.cognome} ${r.nome ?? ''}`.trim();
          const extra = NOTE_DISAMBIGUA[base] ?? (r.profilo ? String(r.profilo).replace(/_/g, ' ') : '');
          const persona = extra ? `${base} (${extra})` : base;
          if (!byPeriod.has(key)) byPeriod.set(key, { sortKey: t.year * 12 + t.monthIndex, persone: [] });
          byPeriod.get(key)!.persone.push(persona);
        }
      }
      const list = [...byPeriod.entries()]
        .map(([periodo, v]) => ({ periodo, sortKey: v.sortKey, persone: v.persone.sort() }))
        .sort((a, b) => a.sortKey - b.sortKey);
      setMissing(list);
    })();
    return () => { alive = false; };
  }, []);

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
        className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-500/30 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.45)] overflow-hidden"
      >
        {/* Banda superiore — manutenzione */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center ring-4 ring-amber-500/10">
            <Wrench className="w-9 h-9 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Gestionale in manutenzione
          </h1>

          <div className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 text-left">
            <p>Gentile <strong>Vincenzo Cataneo</strong>,</p>
            <p>
              il gestionale è <strong>temporaneamente non disponibile</strong> per
              manutenzione e aggiornamento.
            </p>
            <p>
              L'accesso sarà ripristinato una volta completato l'aggiornamento e
              regolarizzata la posizione concordata per <strong>le pratiche concluse</strong>:
            </p>

            {/* Importo da regolarizzare per il ripristino */}
            <div className="my-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 px-5 py-4 text-center">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500/80 dark:text-slate-400/80">
                Da regolarizzare per il ripristino
              </div>
              <div className="mt-1 text-4xl font-black tabular-nums text-slate-800 dark:text-slate-100">
                {importo}
              </div>
            </div>

            {missing.length > 0 && (
              <div className="my-2 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 px-5 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                  Buste paga mancanti da recuperare
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Dal controllo effettuato con Margherita, assistente dello studio legale dell'avvocato Celentano, risultano mancanti le seguenti buste paga:
                </p>
                <ul className="mt-2.5 space-y-2.5">
                  {missing.map((m) => (
                    <li key={m.periodo}>
                      <div className="text-[13px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">{m.periodo}</div>
                      <div className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">{m.persone.join(' · ')}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p>
              Non appena il pagamento risulterà effettuato, l'accesso tornerà
              <strong> immediatamente disponibile</strong>.
            </p>
            <p>
              Per qualsiasi necessità, <strong>contattami direttamente</strong>.
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
