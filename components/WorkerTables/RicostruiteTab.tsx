import React, { useMemo, useState, useCallback } from 'react';
import { HardHat, Info, FileText, TriangleAlert, Calculator } from 'lucide-react';
import { AnnoDati, ProfiloAzienda } from '../../types';
import { parseLocalFloat, formatCurrency } from '../../utils/formatters';
import { RICOSTRUZIONI_FSE } from '../../config/ricostruzioniFse';
import { computeHolidayIndemnity } from '../../utils/calculationEngine';
import {
  RicostruzioniState, VoceState, loadRicostruzioniState, ricostruzioniStorageKey,
  workedByYear, valoreVoce, computeRicostruzioniByYear,
} from '../../utils/ricostruzioniEngine';

interface Props {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  startClaimYear: number;
  years: number[];
  includeExFest: boolean;
  includeTickets: boolean;
  includePaidLeave: boolean;
  workerId?: string;
}

/**
 * Sezione "Indennità Ricostruite" (FSE). Calcola e SPIEGA le indennità che il perito ricostruisce a
 * tariffa dagli accordi aziendali (Relazione §3), NON stampate sui cedolini. Con il toggle "includi
 * nel credito" ogni voce entra nel numeratore delle medie (divisore = giorni lavorati invariato) →
 * mostra il credito nominale base vs con ricostruite. Il credito ufficiale (ISTAT+interessi) è nella
 * Relazione, che usa lo stesso stato salvato qui.
 */
export default function RicostruiteTab({
  data, profilo, eliorType, startClaimYear, years, includeExFest, includeTickets, includePaidLeave, workerId,
}: Props) {
  const [state, setState] = useState<RicostruzioniState>(() => loadRicostruzioniState(workerId));

  const persist = useCallback((next: RicostruzioniState) => {
    try { localStorage.setItem(ricostruzioniStorageKey(workerId), JSON.stringify(next)); } catch { /* n/d */ }
  }, [workerId]);

  const patch = useCallback((id: string, field: keyof VoceState, val: string | boolean) => {
    setState(prev => {
      const next = { ...prev, [id]: { ...prev[id], [field]: val } };
      persist(next);
      return next;
    });
  }, [persist]);

  const wby = useMemo(() => workedByYear(data), [data]);

  const rows = useMemo(() => RICOSTRUZIONI_FSE.map(r => {
    const st = state[r.id];
    const da = r.periodo?.da ?? -Infinity, a = r.periodo?.a ?? Infinity;
    const gg = r.base === 'daysWorked'
      ? Object.entries(wby).filter(([y]) => Number(y) >= da && Number(y) <= a).reduce((s, [, v]) => s + v, 0)
      : 0;
    return { r, total: valoreVoce(r, wby, st), gg, includi: !!st?.includi, usaPerito: parseLocalFloat(st?.valore) > 0 };
  }), [wby, state]);

  const grandTotal = rows.reduce((s, x) => s + x.total, 0);
  const inclusiTotal = rows.filter(x => x.includi).reduce((s, x) => s + x.total, 0);

  // Credito NOMINALE base vs con ricostruite incluse (stesso motore; ISTAT+interessi nella Relazione).
  const { base, con } = useMemo(() => {
    const p = { data, profilo, eliorType, includeExFest, includeTickets, startClaimYear, years, includePaidLeave };
    const sumNetto = (res: ReturnType<typeof computeHolidayIndemnity>) =>
      res.filter(y => y.year >= startClaimYear).reduce((s, y) => s + y.sumNetto, 0);
    const base = sumNetto(computeHolidayIndemnity(p));
    const extra = computeRicostruzioniByYear(data, profilo, state);
    const con = sumNetto(computeHolidayIndemnity({ ...p, extraNumeratorByYear: extra }));
    return { base, con };
  }, [data, profilo, eliorType, includeExFest, includeTickets, startClaimYear, years, includePaidLeave, state]);

  const deltaCredito = con - base;

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
          giorni di servizio effettivo; per le altre inserisci la quantità (× tariffa) o il valore dal perito.
          Spunta <strong>"includi nel credito"</strong> per farle entrare nel numeratore delle medie. Ogni voce
          indica <strong>fin dove è documentata</strong> da un accordo.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map(({ r, total, gg, includi, usaPerito }) => (
          <div key={r.id} className={`p-4 rounded-xl border shadow-sm transition-colors ${includi ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-300 dark:border-emerald-700/60' : 'bg-white/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
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
                {/* Toggle inclusione nel credito */}
                <label className="inline-flex items-center gap-2 mt-3 cursor-pointer select-none">
                  <input type="checkbox" checked={includi} onChange={e => patch(r.id, 'includi', e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                  <span className={`text-[12px] font-bold ${includi ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>includi nel credito</span>
                </label>
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
                          value={state[r.id]?.qty ?? ''}
                          onChange={e => patch(r.id, 'qty', e.target.value)}
                          placeholder="0"
                          disabled={usaPerito}
                          className="w-20 px-2 py-1 text-right tabular-nums text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-400 outline-none disabled:opacity-40"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        o valore perito €
                        <input
                          type="text" inputMode="decimal"
                          value={state[r.id]?.valore ?? ''}
                          onChange={e => patch(r.id, 'valore', e.target.value)}
                          placeholder="0,00"
                          className="w-24 px-2 py-1 text-right tabular-nums text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                      </label>
                      {usaPerito && <span className="text-[10px] text-indigo-500 dark:text-indigo-400">valore dal perito</span>}
                    </div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totali + impatto sul credito */}
      <div className="mt-5 p-4 rounded-2xl bg-slate-900 text-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><Calculator size={16} className="text-amber-400" /> Totale ricostruito</div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums">{formatCurrency(grandTotal)}</div>
            <div className="text-[11px] text-slate-400">di cui incluse nel credito: {formatCurrency(inclusiTotal)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Credito base</div>
            <div className="text-lg font-black tabular-nums text-slate-200">{formatCurrency(base)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-400">+ Ricostruite</div>
            <div className="text-lg font-black tabular-nums text-emerald-400">{deltaCredito > 0 ? '+' : ''}{formatCurrency(deltaCredito)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white">= Con ricostruite</div>
            <div className="text-lg font-black tabular-nums text-white">{formatCurrency(con)}</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-700 pt-2 flex gap-2">
          <Info size={13} className="shrink-0 mt-0.5 text-slate-500" />
          Credito <strong>nominale</strong> (l'app aggiunge ISTAT + interessi nella Relazione, che usa le stesse
          voci incluse). Le ricostruzioni entrano nel numeratore delle medie; il divisore (giorni di servizio
          effettivo) resta invariato. La conferma delle voci non stampate spetta all'avvocato: qui il calcolo è
          tracciato con la fonte e il limite di documentazione di ogni tariffa.
        </p>
      </div>
    </div>
  );
}
