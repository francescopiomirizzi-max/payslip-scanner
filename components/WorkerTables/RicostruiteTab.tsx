import React, { useMemo, useState, useCallback } from 'react';
import { HardHat, Info, FileText, TriangleAlert, Calculator } from 'lucide-react';
import { AnnoDati } from '../../types';
import { parseLocalFloat, formatCurrency } from '../../utils/formatters';
import { RICOSTRUZIONI_FSE } from '../../config/ricostruzioniFse';

interface Props {
  data: AnnoDati[];
  startClaimYear: number;
  years: number[];
  workerId?: string;
}

type ManualInput = { qty?: string; valore?: string };

/**
 * Sezione "Indennità Ricostruite" (FSE). Calcola e SPIEGA le indennità che il perito ricostruisce a
 * tariffa dagli accordi aziendali (Relazione §3), NON stampate sui cedolini.
 * - Indennità Aziendale: base auto = giorni di servizio effettivo (daysWorked) × 3,50 € (2011–2020).
 * - Le altre: base non ricavabile dai cedolini → quantità manuale (× tariffa) o valore dal perito.
 * L'integrazione nel credito ufficiale (numeratore) è un passo successivo/decisione avvocato.
 */
export default function RicostruiteTab({ data, workerId }: Props) {
  const STORAGE_KEY = `ricostruite_fse_${workerId || 'x'}`;

  const [inputs, setInputs] = useState<Record<string, ManualInput>>(() => {
    if (typeof localStorage === 'undefined') return {};
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const update = useCallback((id: string, field: keyof ManualInput, val: string) => {
    setInputs(prev => {
      const next = { ...prev, [id]: { ...prev[id], [field]: val } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* localStorage non disponibile */ }
      return next;
    });
  }, [STORAGE_KEY]);

  // Giorni di servizio effettivo per anno (daysWorked già = lavorati dopo la scomposizione presenza).
  const workedByYear = useMemo(() => {
    const m: Record<number, number> = {};
    (data || []).forEach(r => {
      const y = Number(r?.year);
      if (!isFinite(y) || isNaN(y)) return;
      m[y] = (m[y] || 0) + Math.max(0, parseLocalFloat(r.daysWorked));
    });
    return m;
  }, [data]);

  const rows = useMemo(() => RICOSTRUZIONI_FSE.map(r => {
    if (r.base === 'daysWorked') {
      const da = r.periodo?.da ?? -Infinity;
      const a = r.periodo?.a ?? Infinity;
      const gg = Object.entries(workedByYear)
        .filter(([y]) => Number(y) >= da && Number(y) <= a)
        .reduce((s, [, v]) => s + v, 0);
      return { r, total: gg * r.tariffa, gg, source: 'auto' as const };
    }
    const inp = inputs[r.id] || {};
    const valore = parseLocalFloat(inp.valore || '');
    const qty = parseLocalFloat(inp.qty || '');
    const usaPerito = valore > 0;
    return { r, total: usaPerito ? valore : qty * r.tariffa, gg: 0, source: usaPerito ? 'perito' as const : 'qty' as const };
  }), [workedByYear, inputs]);

  const grandTotal = rows.reduce((s, x) => s + x.total, 0);

  return (
    <div className="h-full overflow-auto custom-scrollbar pr-2 pb-8">
      {/* Intestazione */}
      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800/60 dark:to-slate-900/60 border border-orange-200/60 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400"><HardHat size={18} /></div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Indennità Ricostruite</h2>
        </div>
        <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Voci che il perito <strong>ricostruisce a tariffa</strong> dagli accordi aziendali (Relazione §3):
          non sono stampate sui cedolini. L'<strong>Indennità Aziendale</strong> è calcolata in automatico dai
          giorni di servizio effettivo; per le altre inserisci la quantità (× tariffa) oppure il valore dal
          riepilogo del perito. Ogni voce indica <strong>fin dove è documentata</strong> da un accordo.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map(({ r, total, gg, source }) => (
          <div key={r.id} className="p-4 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{r.nome}</h3>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900/70 text-slate-500 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                    {formatCurrency(r.tariffa)}/{r.unita}
                  </span>
                  {r.base === 'daysWorked'
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">AUTO</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">DA INSERIRE</span>}
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-snug max-w-2xl">{r.spiegazione}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1"><FileText size={11} /> {r.accordo}</span>
                  <span className="inline-flex items-center gap-1 text-orange-500 dark:text-orange-400"><TriangleAlert size={11} /> documentata: {r.documentataFinoAl}</span>
                  <span>TFR: {r.regimeTfr}</span>
                </div>
              </div>

              {/* Valore + input */}
              <div className="text-right shrink-0">
                <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{total > 0 ? formatCurrency(total) : '—'}</div>
                {r.base === 'daysWorked'
                  ? <div className="text-[11px] text-slate-400">{gg} gg lavorati {r.periodo ? `(${r.periodo.da}–${r.periodo.a})` : ''} × {formatCurrency(r.tariffa)}</div>
                  : (
                    <div className="mt-1.5 flex flex-col items-end gap-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Quantità
                        <input
                          type="text" inputMode="decimal"
                          value={inputs[r.id]?.qty ?? ''}
                          onChange={e => update(r.id, 'qty', e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1 text-right tabular-nums text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-400 outline-none"
                          disabled={parseLocalFloat(inputs[r.id]?.valore || '') > 0}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        o valore perito €
                        <input
                          type="text" inputMode="decimal"
                          value={inputs[r.id]?.valore ?? ''}
                          onChange={e => update(r.id, 'valore', e.target.value)}
                          placeholder="0,00"
                          className="w-24 px-2 py-1 text-right tabular-nums text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                      </label>
                      {source === 'perito' && <span className="text-[10px] text-indigo-500 dark:text-indigo-400">valore dal perito</span>}
                    </div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totale + nota */}
      <div className="mt-5 p-4 rounded-2xl bg-slate-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><Calculator size={16} className="text-amber-400" /> Totale ricostruito</div>
          <div className="text-2xl font-black tabular-nums">{formatCurrency(grandTotal)}</div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed border-t border-slate-700 pt-2 flex gap-2">
          <Info size={13} className="shrink-0 mt-0.5 text-slate-500" />
          Queste voci si <strong>aggiungono al numeratore</strong> delle medie (indennità di incomodo perse in
          ferie), col divisore invariato = giorni di servizio effettivo. L'inclusione nel credito ufficiale
          (con ISTAT + interessi) e la conferma delle voci non stampate spettano all'avvocato: qui il calcolo
          è pronto e tracciato con la fonte di ogni tariffa.
        </p>
      </div>
    </div>
  );
}
