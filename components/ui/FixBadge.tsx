import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Worker } from '../../types';
import { formatFixTargets } from '../../utils/workerStatus';

/**
 * Badge rosso "manca <mesi>" per i lavoratori con buste paga da sistemare
 * (mese archiviato col file di un altro periodo). Sola lettura: serve a
 * individuarli a colpo d'occhio nelle liste e nel dettaglio. Non renderizza
 * nulla se il lavoratore non ha fixTargets.
 */
export const FixBadge: React.FC<{
  worker: Pick<Worker, 'fixTargets'>;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ worker, size = 'md', className = '' }) => {
  const label = formatFixTargets(worker.fixTargets);
  if (!label) return null;

  const pad = size === 'sm' ? 'px-2 py-0.5 text-[9px] gap-1' : 'px-2.5 py-1 text-[10px] gap-1.5';
  const icon = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      title={`Busta paga da sistemare: manca ${label}`}
      className={`inline-flex items-center ${pad} rounded-full font-bold uppercase tracking-wide border shadow-sm animate-pulse shrink-0 bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/60 ${className}`}
    >
      <AlertCircle className={icon} />
      manca {label}
    </span>
  );
};

export default FixBadge;
