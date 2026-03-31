import React, { useMemo, useState } from 'react';
import {
  AnnoDati,
  YEARS,
  INDENNITA_RFI,
  INDENNITA_ELIOR,
  INDENNITA_REKEEP,
  getColumnsByProfile,
  ProfiloAzienda
} from '../../types';
import { parseLocalFloat, formatCurrency, formatDay } from '../../utils/formatters';
import { Info, TrendingUp, DollarSign, FileSearch } from 'lucide-react';



// --- MAPPATURA DESCRIZIONI ---
const INDENNITA_DESCRIPTIONS: Record<string, string> = {
  "0152": "Straordinario Feriale Diurno non recup.",
  "0421": "Indennità Lavoro Notturno",
  "0470": "Indennità di Chiamata",
  "0482": "Compenso Reperibilità",
  "0496": "Chiamata in Disponibilità",
  "0687": "Indennità di Linea <= 10h",
  "0AA1": "Trasferta Esente",
  "0423": "Compenso Cantiere Notte",
  "0576": "Indennità Orario Spezzato",
  "0584": "Reperibilità Festive",
  "0919": "Straordinario Feriale Diurno",
  "0920": "Str. Festivo Diurno / Notturno",
  "0932": "Str. Reperibilità Diurno",
  "0933": "Str. Reperibilità Notturno",
  "0995": "Str. Disponibilità Diurno",
  "0996": "Str. Disponibilità Notturno"
};

interface IndemnityPivotTableProps {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  startClaimYear?: number;
  years: number[];  // Range dinamico controllato dal parent
}

type ViewMode = 'total' | 'average';

const IndemnityPivotTable: React.FC<IndemnityPivotTableProps> = ({
  data = [],
  profilo,
  eliorType,
  startClaimYear = 2008,
  years
}) => {

  const [viewMode, setViewMode] = useState<ViewMode>('total');

  // --- ANNI VISIBILI (Controllati centralmente dal parent) ---
  const visibleYears = years;

  const pivotConfig = useMemo(() => {
    // Usiamo il motore universale. Togliamo le colonne di calcolo e di base (month, total, daysWorked, ecc)
    // per lasciare SOLO le indennità vere e proprie da mostrare nella Pivot
    return getColumnsByProfile(profilo, eliorType).filter(c =>
      !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'note', 'arretrati', 'coeffPercepito', 'coeffTicket'].includes(c.id)
    );
  }, [profilo, eliorType]);

  // --- CALCOLO AVANZATO ---
  const { rows, yearlyTotals, grandTotal, yearlyDaysWorked } = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];

    // 1. Calcoliamo i giorni lavorati totali per ogni anno
    const yearlyDaysWorked: { [year: number]: number } = {};
    visibleYears.forEach(year => {
      const months = safeData.filter(d => d.year === year);
      // USIAMO parseLocalFloat QUI
      const totalDays = months.reduce((acc, m) => acc + parseLocalFloat(m.daysWorked), 0);
      yearlyDaysWorked[year] = totalDays > 0 ? totalDays : 1;
    });

    const calculatedRows = pivotConfig
      .filter(def => def.id !== '3B70' && def.id !== '3B71') // <-- Esclusione Sal. Prod. e Prod. Inc.
      .map(def => {
        const yearValues: { [year: number]: number } = {};
        let rowSumAmount = 0;

        visibleYears.forEach(year => {
          // Filtro di sicurezza
          if (year < startClaimYear) return;

          const months = safeData.filter(d => d.year === year);
          // USIAMO parseLocalFloat ANCHE QUI per leggere gli importi corretti
          const yearSum = months.reduce((acc, month) => acc + parseLocalFloat(month[def.id]), 0);

          if (viewMode === 'average') {
            yearValues[year] = yearSum / yearlyDaysWorked[year];
          } else {
            yearValues[year] = yearSum;
          }

          rowSumAmount += yearSum;
        });

        // Calcolo totale riga
        let rowTotal = 0;
        if (viewMode === 'average') {
          const totalDaysAllYears = Object.values(yearlyDaysWorked).reduce((a, b) => a + b, 0);
          rowTotal = totalDaysAllYears > 0 ? rowSumAmount / totalDaysAllYears : 0;
        } else {
          rowTotal = rowSumAmount;
        }

        return {
          id: def.id,
          label: def.label,
          code: def.subLabel,
          yearValues,
          rowTotal,
          description: INDENNITA_DESCRIPTIONS[def.id] || def.label
        };
      });

    // Calcolo Totali Colonna
    const yearlyTotals: { [year: number]: number } = {};
    let grandTotal = 0;

    visibleYears.forEach(year => {
      let yearSum = 0;
      calculatedRows.forEach(row => {
        yearSum += (row.yearValues[year] || 0);
      });
      yearlyTotals[year] = yearSum;
      grandTotal += yearSum;
    });

    // Fix grandTotal per average mode
    if (viewMode === 'average') {
      let totalEuroAll = 0;
      let totalDaysAll = 0;
      visibleYears.forEach(y => {
        const days = yearlyDaysWorked[y];
        totalEuroAll += (yearlyTotals[y] || 0) * days;
        totalDaysAll += days;
      });
      // Qui lasciamo la somma delle medie per coerenza visiva o ricalcoliamo la media globale
    }

    return { rows: calculatedRows, yearlyTotals, grandTotal, yearlyDaysWorked };
  }, [data, pivotConfig, viewMode, visibleYears, startClaimYear]);

  const customTheme = useMemo(() => {
    if (profilo === 'ELIOR') return { badge: 'text-orange-400 border-orange-600 bg-orange-900/30', header: 'text-orange-600' };
    if (profilo === 'REKEEP') return { badge: 'text-emerald-400 border-emerald-600 bg-emerald-900/30', header: 'text-emerald-600' };
    if (profilo === 'RFI') return { badge: 'text-blue-400 border-blue-600 bg-blue-900/30', header: 'text-blue-700' };

    // AZIENDE CUSTOM (Palette dinamica sincronizzata)
    const customPalette = [
      { badge: 'text-fuchsia-400 border-fuchsia-600 bg-fuchsia-900/30', header: 'text-fuchsia-600' },
      { badge: 'text-violet-400 border-violet-600 bg-violet-900/30', header: 'text-violet-600' },
      { badge: 'text-cyan-400 border-cyan-600 bg-cyan-900/30', header: 'text-cyan-600' },
      { badge: 'text-rose-400 border-rose-600 bg-rose-900/30', header: 'text-rose-600' },
      { badge: 'text-indigo-400 border-indigo-600 bg-indigo-900/30', header: 'text-indigo-600' },
      { badge: 'text-teal-400 border-teal-600 bg-teal-900/30', header: 'text-teal-600' }
    ];
    let hash = 0;
    if (profilo) {
      for (let i = 0; i < profilo.length; i++) {
        hash = profilo.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return customPalette[Math.abs(hash) % customPalette.length];
  }, [profilo]);

  const badgeClass = customTheme.badge;
  const headerColorClass = customTheme.header;

  const hasActualData = useMemo(() => {
    const indemnityCols = pivotConfig.map(c => c.id);
    return data.some(d => {
      const hasIndemnity = indemnityCols.some(id => parseLocalFloat(d[id]) > 0);
      return hasIndemnity || parseLocalFloat(d.daysWorked) > 0;
    });
  }, [data, pivotConfig]);

  if (!data || !hasActualData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center mt-4 border-dashed border-2 border-slate-300 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl h-full min-h-[400px] shadow-lg transition-all">
        <div className="w-24 h-24 mb-6 rounded-full bg-teal-50 dark:bg-slate-800/80 flex items-center justify-center shadow-inner ring-4 ring-white dark:ring-slate-800">
          <FileSearch className="w-12 h-12 text-teal-500 dark:text-cyan-400 animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 tracking-tight">Nessun Riepilogo Disponibile</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed text-base font-medium">
          Non ci sono voci variabili registrate. Inserisci i dati mensili nel tab "Gestione Dati" per visualizzare la tabella pivot delle indennità.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 shadow-xl dark:shadow-[0_0_20px_rgba(34,211,238,0.15)] rounded-lg overflow-hidden border border-slate-200 dark:border-cyan-400 flex flex-col h-full transition-all duration-300">
      <div className="p-3 bg-slate-800 text-white font-bold text-sm tracking-wide flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span>RIEPILOGO VOCI VARIABILI</span>
          <span className={`px-2 py-0.5 rounded text-[10px] border border-slate-600 uppercase tracking-tighter ${badgeClass}`}>
            {profilo}
          </span>
        </div>

        {/* --- TOGGLE VIEW MODE --- */}
        <div className="flex bg-slate-900/50 p-0.5 rounded-lg border border-slate-600">
          <button
            onClick={() => setViewMode('total')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'total'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <DollarSign size={12} /> TOTALI (€)
          </button>
          <button
            onClick={() => setViewMode('average')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'average'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
            title="Mostra la media giornaliera (Totale / Giorni Lavorati)"
          >
            <TrendingUp size={12} /> MEDIA GIORNALIERA
          </button>
        </div>
      </div>

      <style>{`
        /* --- SCROLLBAR TEMA CHIARO --- */
        .pivot-scrollbar::-webkit-scrollbar { height: 14px; }
        .pivot-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .pivot-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 8px; border: 3px solid #f8fafc; }
        .pivot-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        
        /* --- SCROLLBAR TEMA SCURO (Blindato con !important) --- */
        html.dark .pivot-scrollbar::-webkit-scrollbar-track { 
            background: #0f172a !important; 
            border-top: 1px solid #1e293b !important; 
        }
        html.dark .pivot-scrollbar::-webkit-scrollbar-thumb { 
            background-color: #22d3ee !important; /* Azzurro Elettrico */
            border: 3px solid #0f172a !important; /* Bordo nero per staccare dal fondo */
        }
        html.dark .pivot-scrollbar::-webkit-scrollbar-thumb:hover { 
            background-color: #06b6d4 !important; /* Azzurro Elettrico Intenso */
        }
      `}</style>

      <div className="flex-1 overflow-auto pivot-scrollbar transition-colors">
        <table className="w-full text-xs border-collapse table-fixed" style={{ minWidth: `${(visibleYears.length + 2) * 100}px` }}>
          <thead className="sticky top-0 z-20 shadow-sm bg-slate-100 dark:bg-slate-800 transition-colors">
            <tr>
              <th className={`p-3 text-left font-bold border-r border-slate-300 dark:border-slate-700 w-64 min-w-[250px] sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] uppercase tracking-wider ${headerColorClass} dark:!text-cyan-400 transition-colors`}>
                VOCE RETRIBUTIVA
              </th>
              {visibleYears.map(year => (
                <th key={year} className="px-3 py-3 text-right font-bold border-r border-slate-300 dark:border-slate-700 min-w-[90px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 transition-colors">
                  <div className="flex flex-col items-end">
                    <span>{year}</span>
                    {viewMode === 'average' && (
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500">Div: {formatDay(yearlyDaysWorked[year] || 0)} gg</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 min-w-[110px] transition-colors">
                {viewMode === 'total' ? 'TOTALE STORICO' : 'MEDIA PONDERATA'}
              </th>
            </tr>
          </thead>

          <tbody className="transition-colors">
            {rows.map((row) => (
              <tr key={row.id} className="group border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50 dark:even:bg-slate-800">
                <td className="p-2 border-r border-slate-300 dark:border-slate-700 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.8)] bg-white dark:bg-slate-900 group-even:bg-slate-50 dark:group-even:bg-slate-800 group-hover:!bg-blue-50 dark:group-hover:!bg-slate-700 font-medium text-slate-700 dark:text-slate-200 transition-colors">
                  <div className="flex items-center justify-between group/label">
                    <div className="flex flex-col">
                      <span className="truncate" title={row.description}>{row.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal font-mono">{row.code}</span>
                    </div>
                    <div className="relative">
                      <Info size={12} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover/label:opacity-100 transition-opacity" />
                      <div className="hidden group-hover/label:block absolute left-4 top-0 w-48 p-2 bg-slate-800 dark:bg-slate-950 dark:border dark:border-slate-700 text-white text-[10px] rounded z-50 pointer-events-none shadow-xl">
                        {row.description}
                      </div>
                    </div>
                  </div>
                </td>
                {visibleYears.map(year => {
                  const val = row.yearValues[year] || 0;
                  return (
                    <td key={year} className={`px-2 py-1 border-r border-slate-200 dark:border-slate-700 text-right tabular-nums transition-colors ${viewMode === 'average' && val > 0 ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                      {val !== 0 ? formatCurrency(val) : <span className="text-slate-200 dark:text-slate-700">-</span>}
                    </td>
                  );
                })}
                <td className={`px-2 py-1 text-right font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/50 group-hover:bg-blue-100 dark:group-hover:bg-slate-700 tabular-nums transition-colors ${viewMode === 'average' ? 'text-indigo-700 dark:text-cyan-400' : ''}`}>
                  {row.rowTotal !== 0 ? formatCurrency(row.rowTotal) : '-'}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="sticky bottom-0 z-20 bg-white dark:bg-slate-900 border-t-2 border-slate-400 dark:border-slate-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.6)] transition-colors">
            <tr className="bg-slate-100 dark:bg-slate-800 transition-colors">
              <td className="p-3 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.8)] bg-amber-100 dark:bg-amber-900 transition-colors">
                {viewMode === 'total' ? 'TOTALE VOCI' : 'MEDIA GIORNALIERA TOTALE'}
              </td>
              {visibleYears.map(year => (
                <td key={year} className="px-2 py-2 text-right font-bold text-slate-800 dark:text-amber-400 border-r border-slate-300 dark:border-slate-700 tabular-nums bg-amber-50 dark:bg-amber-900/20 transition-colors">
                  {yearlyTotals[year] !== 0 ? formatCurrency(yearlyTotals[year] || 0) : '-'}
                </td>
              ))}
              <td className="px-2 py-2 text-right font-black text-white dark:text-slate-900 bg-slate-700 dark:bg-cyan-400 tabular-nums text-sm transition-colors">
                {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default IndemnityPivotTable;