import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MONTH_NAMES,
  AnnoDati,
  getColumnsByProfile,
  ProfiloAzienda,
  evaluateFormula,
} from '../../types';
import { parseLocalFloat, formatCurrency, formatDay } from '../../utils/formatters';
import { monthsByYearFromAnni } from '../../utils/workerStatus';
import type { VerifyState } from './MonthlyDataGrid';
import {
  AlertCircle,
  TriangleAlert,
  CheckCircle2,
  ChevronDown,
  MessageSquareText,
} from 'lucide-react';

/**
 * Vista mensile per telefono (viewport < 640px) — SOLA LETTURA (Fase 4 T2a).
 * Alternativa mobile a MonthlyDataGrid: elenco dei 12 mesi dell'anno con
 * dettaglio voci in accordion. Legge gli stessi dati (`data`) con la stessa
 * semantica di calcolo della griglia (parseLocalFloat, totale riga senza
 * arretrati, Strategia B nel divisore); l'editing arriva con la T2b — qui
 * nessuna scrittura, per nessun ruolo.
 */

interface MonthlyDataMobileProps {
  data: AnnoDati[];
  initialYear: number;
  onYearChange: (year: number) => void;
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  years: number[];
  /** Strategia B: le assenze retribuite entrano nei "GG Lav." mostrati (come in griglia). */
  includePaidLeave?: boolean;
  /** Esiti verifica AI per riga, chiave `${year}-${monthIndex}` (stessa mappa della griglia). */
  verifyStates?: Record<string, VerifyState>;
}

// Colonne strutturali della griglia: tutto il resto è una voce (indennità/arretrati).
const STRUCTURAL_IDS = ['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'note'];

const TETTO_FERIE = 28;

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const MonthlyDataMobile: React.FC<MonthlyDataMobileProps> = ({
  data,
  initialYear,
  onYearChange,
  profilo,
  eliorType,
  years,
  includePaidLeave = false,
  verifyStates = {},
}) => {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const pillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelectedYear(initialYear); }, [initialYear]);

  // Porta la pillola dell'anno selezionato dentro la finestra di scroll.
  useEffect(() => {
    const el = pillsRef.current?.querySelector<HTMLButtonElement>(`[data-year="${selectedYear}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selectedYear]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setExpandedMonth(null);
    onYearChange(year);
  };

  // Stesso set colonne della griglia in vista "Variabili" (ticket e produttività esclusi).
  const columns = useMemo(() => {
    const cols = getColumnsByProfile(profilo, eliorType);
    return cols.filter(c => !['ticket', '3B70', '3B71'].includes(c.id));
  }, [profilo, eliorType]);

  const vociColumns = useMemo(
    () => columns.filter(c => !STRUCTURAL_IDS.includes(c.id)),
    [columns]
  );
  const hasPaidLeaveCol = useMemo(() => columns.some(c => c.id === 'daysPaidLeave'), [columns]);

  // Copertura dati per anno (stessa definizione delle pillole-anno della griglia).
  const filledByYear = useMemo(() => monthsByYearFromAnni({ anni: data }), [data]);

  const currentYearData = useMemo(
    () => (Array.isArray(data) ? data.filter(d => d.year === selectedYear) : []),
    [data, selectedYear]
  );

  // 12 righe del mese con le eventuali colonne-formula risolte (parità con la griglia).
  const rows = useMemo(() => {
    return MONTH_NAMES.map((monthName, index) => {
      const existing = currentYearData.find(d => d.monthIndex === index) || {};
      const rowData: any = { ...existing, month: monthName, monthIndex: index, year: selectedYear };
      columns.forEach(col => {
        if (col.type === 'formula' && col.formula) {
          rowData[col.id] = evaluateFormula(col.formula, rowData);
        }
      });
      return rowData as AnnoDati;
    });
  }, [currentYearData, selectedYear, columns]);

  // Totale riga = stessa esclusione di calculateRowTotal (strutturali + arretrati fuori).
  const rowTotal = (row: any): number => {
    let sum = 0;
    columns.forEach(col => {
      if (!STRUCTURAL_IDS.includes(col.id) && col.id !== 'arretrati') {
        const num = parseLocalFloat(row[col.id]);
        if (num && !isNaN(num)) sum += num;
      }
    });
    return sum;
  };

  // KPI dell'anno (stessa formula di annualStats della griglia).
  const annualStats = useMemo(() => {
    let totIndennita = 0;
    let totGiorniLav = 0;
    currentYearData.forEach(row => {
      vociColumns.forEach(col => {
        if (col.id !== 'arretrati') totIndennita += parseLocalFloat((row as any)[col.id]);
      });
      totGiorniLav += parseLocalFloat(row.daysWorked) + (includePaidLeave ? parseLocalFloat(row.daysPaidLeave) : 0);
    });
    const mediaAnnuale = totGiorniLav > 0 ? totIndennita / totGiorniLav : 0;
    return { totIndennita, mediaAnnuale };
  }, [currentYearData, vociColumns, includePaidLeave]);

  // Tetto ferie cumulato nell'anno (stessa logica della griglia, segnalato solo se ferie > 0).
  const ferieWarnings = useMemo(() => {
    let cum = 0;
    return rows.map(row => {
      const vac = parseLocalFloat(row.daysVacation);
      const prev = cum;
      cum += vac;
      const isOver = prev >= TETTO_FERIE;
      const isPartial = !isOver && cum > TETTO_FERIE;
      return vac > 0 && (isOver || isPartial);
    });
  }, [rows]);

  return (
    <div className="flex flex-col gap-3 pb-28">
      {/* Selettore anno (in flusso: lo scroll della scheda è a livello documento,
          e un elemento sticky al top del viewport colliderebbe con la DynamicIsland) */}
      <div className="pt-1 pb-1">
        <div
          ref={pillsRef}
          className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-hint-x"
          role="tablist"
          aria-label="Anno selezionato"
        >
          {years.map(year => {
            const filled = filledByYear.get(year)?.size ?? 0;
            const isSel = year === selectedYear;
            return (
              <button
                key={year}
                data-year={year}
                onClick={() => handleYearChange(year)}
                role="tab"
                aria-selected={isSel}
                title={filled === 12 ? `${year} · completo (12/12)` : filled > 0 ? `${year} · ${filled}/12 mesi` : `${year} · nessun dato`}
                className={`shrink-0 min-h-11 px-3.5 rounded-xl text-sm font-bold tabular-nums transition-colors flex items-center gap-1.5
                  ${isSel
                    ? 'bg-indigo-600 dark:bg-cyan-600 text-white shadow-md'
                    : filled > 0
                      ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      : 'bg-transparent text-slate-400 dark:text-slate-600 border border-dashed border-slate-300 dark:border-slate-700'}`}
              >
                {year}
                <span className={`w-1.5 h-1.5 rounded-full ${filled === 12 ? 'bg-emerald-400' : filled > 0 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI anno — stesse etichette e formule della barra PERIODO */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 px-3 py-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Giornaliera</div>
          <div className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">
            {annualStats.mediaAnnuale !== 0 ? formatCurrency(annualStats.mediaAnnuale) : '—'}
          </div>
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 px-3 py-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale Indennità Variabili</div>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {annualStats.totIndennita !== 0 ? formatCurrency(annualStats.totIndennita) : '—'}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
        Vista di consultazione — l'inserimento dati si fa da desktop o tablet.
      </p>

      {/* Elenco mesi */}
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => {
          const workedDays = parseLocalFloat(row.daysWorked);
          const vacDays = parseLocalFloat(row.daysVacation);
          const paidLeaveDays = parseLocalFloat(row.daysPaidLeave);
          const ggLavDisplay = includePaidLeave ? workedDays + paidLeaveDays : workedDays;

          // Stesse validazioni della griglia (vista Variabili).
          const totalDaysInput = workedDays + vacDays + paidLeaveDays;
          const daysInMonth = getDaysInMonth(selectedYear, idx);
          const isDayCountError = totalDaysInput > daysInMonth;
          let hasIndennita = false;
          vociColumns.forEach(c => { if (parseLocalFloat((row as any)[c.id]) > 0) hasIndennita = true; });
          const isDivisorError = hasIndennita && workedDays === 0 && vacDays === 0 && paidLeaveDays === 0;

          const note = (row as any).note;
          const aiWarning = (row as any).aiWarning;
          const hasAiWarning = aiWarning && aiWarning !== 'Nessuna anomalia';

          const vs = verifyStates[`${selectedYear}-${idx}`];
          const showVerifyDot = vs && vs.status !== 'loading';
          const verifyDetails = showVerifyDot && (vs.discrepancies.length > 0 || !!vs.errorMessage);

          const voci = vociColumns
            .map(col => ({ col, num: parseLocalFloat((row as any)[col.id]) }))
            .filter(v => v.num !== 0);
          const total = rowTotal(row);
          const isExpanded = expandedMonth === idx;

          return (
            <div
              key={idx}
              className={`rounded-2xl border overflow-hidden ${
                isDivisorError
                  ? 'border-red-300 dark:border-red-800/60 bg-red-50/60 dark:bg-red-900/10'
                  : isDayCountError
                    ? 'border-orange-300 dark:border-orange-800/60 bg-orange-50/60 dark:bg-orange-900/10'
                    : 'border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70'
              }`}
            >
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : idx)}
                aria-expanded={isExpanded}
                aria-controls={`month-detail-${idx}`}
                className="w-full min-h-14 px-3.5 py-2.5 flex items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isDivisorError ? (
                      <AlertCircle size={14} className="shrink-0 text-red-600" aria-label="Errore divisore" />
                    ) : isDayCountError ? (
                      <TriangleAlert size={14} className="shrink-0 text-orange-500" aria-label="Totale giorni oltre il mese" />
                    ) : hasAiWarning ? (
                      <AlertCircle size={14} className="shrink-0 text-red-500" aria-label="Avviso AI" />
                    ) : aiWarning === 'Nessuna anomalia' ? (
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-500" aria-label="Nessuna anomalia" />
                    ) : null}
                    {showVerifyDot && (
                      <span
                        className={`shrink-0 w-2 h-2 rounded-full ring-1 ring-white/50 ${
                          vs.status === 'success' ? 'bg-emerald-500' : vs.status === 'warning' ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        aria-label={`Verifica AI: ${vs.status === 'success' ? 'ok' : vs.status === 'warning' ? 'anomalie minori' : 'discrepanze'}`}
                      />
                    )}
                    <span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 truncate">
                      {MONTH_NAMES[idx]}
                    </span>
                    {note && <MessageSquareText size={12} className="shrink-0 text-amber-500" aria-label="Nota presente" />}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    GG Lav. {formatDay(ggLavDisplay)} · Ferie{' '}
                    <span className={ferieWarnings[idx] ? 'text-red-500 font-bold' : ''}>{formatDay(vacDays)}</span>
                    {hasPaidLeaveCol && !includePaidLeave && ` · Ass. Retr. ${formatDay(paidLeaveDays)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-cyan-100">
                    {total !== 0 ? formatCurrency(total) : '—'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div
                  id={`month-detail-${idx}`}
                  className="border-t border-slate-200 dark:border-slate-700/60 px-3.5 py-2.5 flex flex-col gap-1.5"
                >
                  {isDivisorError && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                      ERRORE: indennità senza giorni lavorati né copertura ferie/assenze retribuite.
                    </div>
                  )}
                  {isDayCountError && (
                    <div className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">
                      ATTENZIONE: totale giorni ({formatDay(totalDaysInput)}) supera il limite del mese ({daysInMonth}).
                    </div>
                  )}
                  {hasAiWarning && (
                    <div className="text-[11px] text-red-600 dark:text-red-400">
                      <span className="font-bold">Avviso AI:</span> {aiWarning}
                    </div>
                  )}
                  {verifyDetails && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 px-2.5 py-2">
                      <span className={`font-bold block mb-1 uppercase tracking-wider ${vs.status === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
                        {vs.errorMessage && vs.discrepancies.length === 0
                          ? '⚠ Errore di verifica'
                          : vs.status === 'error'
                            ? `⚠ ${vs.discrepancies.length} discrepanze rilevate`
                            : `⚡ ${vs.discrepancies.length} anomalie minori`}
                      </span>
                      {vs.errorMessage && <div>{vs.errorMessage}</div>}
                      {vs.discrepancies.map((d, i) => (
                        <div key={i} className="border-t border-slate-200 dark:border-slate-700/60 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">
                          {d.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {voci.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-500 italic">Nessuna voce nel mese</div>
                  ) : (
                    voci.map(({ col, num }) => (
                      <div key={col.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-slate-600 dark:text-slate-300 min-w-0">
                          {col.label}{' '}
                          {col.subLabel && <span className="text-slate-400 dark:text-slate-500">{col.subLabel}</span>}
                          {col.id === 'arretrati' && (
                            <span className="text-slate-400 dark:text-slate-500 italic"> · fuori dal totale</span>
                          )}
                        </span>
                        <span className="font-bold tabular-nums shrink-0 text-slate-800 dark:text-cyan-100">
                          {col.type === 'integer' ? formatDay(num) : formatCurrency(num)}
                        </span>
                      </div>
                    ))
                  )}

                  {note && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 rounded-lg bg-amber-50/80 dark:bg-amber-900/20 px-2.5 py-2 mt-0.5">
                      <span className="font-bold">Nota:</span> {note}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyDataMobile;
