import React, { useMemo, useState } from 'react';
import {
  AnnoDati,
  YEARS,
  formatCurrency,
  formatInteger,
  parseFloatSafe,
  INDENNITA_RFI,
  INDENNITA_ELIOR,
  INDENNITA_REKEEP,
  ProfiloAzienda
} from '../../types';
import { Info, TrendingUp, DollarSign } from 'lucide-react';

// --- MAPPATURA DESCRIZIONI (Ripresa per coerenza) ---
// In un'app reale, questa dovrebbe stare in un file condiviso (es. constants.ts)
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
  // Aggiungere qui eventuali codici Elior/Rekeep se noti
};

interface IndemnityPivotTableProps {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
}

type ViewMode = 'total' | 'average';

const IndemnityPivotTable: React.FC<IndemnityPivotTableProps> = ({ data = [], profilo }) => {

  // --- STATO PER IL TOGGLE DI VISUALIZZAZIONE ---
  const [viewMode, setViewMode] = useState<ViewMode>('total');

  const pivotConfig = useMemo(() => {
    switch (profilo) {
      case 'ELIOR': return INDENNITA_ELIOR;
      case 'REKEEP': return INDENNITA_REKEEP;
      default: return INDENNITA_RFI;
    }
  }, [profilo]);

  // --- CALCOLO AVANZATO ---
  const { rows, yearlyTotals, grandTotal, yearlyDaysWorked } = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];

    // 1. Calcoliamo i giorni lavorati totali per ogni anno (il Divisore)
    const yearlyDaysWorked: { [year: number]: number } = {};
    YEARS.forEach(year => {
      const months = safeData.filter(d => d.year === year);
      const totalDays = months.reduce((acc, m) => acc + parseFloatSafe(m.daysWorked), 0);
      yearlyDaysWorked[year] = totalDays > 0 ? totalDays : 1; // Evita div/0
    });

    const calculatedRows = pivotConfig.map(def => {
      const yearValues: { [year: number]: number } = {};
      let rowSumAmount = 0;

      YEARS.forEach(year => {
        const months = safeData.filter(d => d.year === year);
        const yearSum = months.reduce((acc, month) => acc + parseFloatSafe(month[def.id]), 0);

        // Se siamo in modalità "Average", dividiamo per i giorni lavorati di quell'anno
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
        // Media ponderata totale: (Somma Totale Euro) / (Somma Totale Giorni Lavorati di tutti gli anni)
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
        description: INDENNITA_DESCRIPTIONS[def.id] || def.label // Fallback descrizione
      };
    });

    // Calcolo Totali Colonna
    const yearlyTotals: { [year: number]: number } = {};
    let grandTotal = 0;

    YEARS.forEach(year => {
      let yearSum = 0;
      calculatedRows.forEach(row => {
        yearSum += row.yearValues[year];
      });
      yearlyTotals[year] = yearSum;
      grandTotal += yearSum; // Nota: somma delle medie se in average mode
    });

    // Fix grandTotal per average mode (non ha senso sommare le medie, ha senso la media totale)
    if (viewMode === 'average') {
      let totalEuroAll = 0;
      let totalDaysAll = 0;
      YEARS.forEach(y => {
        // Ricostruiamo i totali assoluti per il calcolo finale corretto
        const days = yearlyDaysWorked[y];
        totalEuroAll += yearlyTotals[y] * days;
        totalDaysAll += days;
      });
      // Il grandTotal visualizzato è la somma delle medie delle singole righe (Total Average Daily Value)
      // Questo è utile perché dice: "Mediamente prendi X euro al giorno di indennità totali"
    }

    return { rows: calculatedRows, yearlyTotals, grandTotal, yearlyDaysWorked };
  }, [data, pivotConfig, viewMode]);

  const badgeClass = useMemo(() => {
    switch (profilo) {
      case 'ELIOR': return 'text-orange-400 border-orange-600 bg-orange-900/30';
      case 'REKEEP': return 'text-emerald-400 border-emerald-600 bg-emerald-900/30';
      default: return 'text-blue-400 border-blue-600 bg-blue-900/30';
    }
  }, [profilo]);

  const headerColorClass = useMemo(() => {
    switch (profilo) {
      case 'ELIOR': return 'text-orange-600';
      case 'REKEEP': return 'text-emerald-600';
      default: return 'text-slate-700';
    }
  }, [profilo]);

  return (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200 flex flex-col h-full">
      <div className="p-3 bg-slate-800 text-white font-bold text-sm tracking-wide flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span>RIEPILOGO VOCI</span>
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

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse table-fixed" style={{ minWidth: `${(YEARS.length + 2) * 100}px` }}>
          <thead className="sticky top-0 z-20 shadow-sm bg-slate-100">
            <tr>
              <th className={`p-3 text-left font-bold border-r border-slate-300 w-64 min-w-[250px] sticky left-0 z-30 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase tracking-wider ${headerColorClass}`}>
                VOCE RETRIBUTIVA
              </th>
              {YEARS.map(year => (
                <th key={year} className="px-3 py-3 text-right font-bold border-r border-slate-300 min-w-[90px] text-slate-600 bg-slate-50">
                  <div className="flex flex-col items-end">
                    <span>{year}</span>
                    {/* Mostra i giorni lavorati nell'header se siamo in modalità media */}
                    {viewMode === 'average' && (
                      <span className="text-[9px] font-normal text-slate-400">Div: {formatInteger(yearlyDaysWorked[year])} gg</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-bold bg-slate-200 text-slate-800 min-w-[110px]">
                {viewMode === 'total' ? 'TOTALE STORICO' : 'MEDIA PONDERATA'}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group border-b border-slate-200 hover:bg-blue-50 transition-colors odd:bg-white even:bg-slate-50/50">
                <td className="p-2 border-r border-slate-300 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit group-hover:bg-blue-50 font-medium text-slate-700">
                  <div className="flex items-center justify-between group/label">
                    <div className="flex flex-col">
                      <span className="truncate" title={row.description}>{row.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal font-mono">{row.code}</span>
                    </div>
                    {/* Tooltip Descrizione */}
                    <div className="relative">
                      <Info size={12} className="text-slate-300 opacity-0 group-hover/label:opacity-100 transition-opacity" />
                      <div className="hidden group-hover/label:block absolute left-4 top-0 w-48 p-2 bg-slate-800 text-white text-[10px] rounded z-50 pointer-events-none shadow-xl">
                        {row.description}
                      </div>
                    </div>
                  </div>
                </td>
                {YEARS.map(year => {
                  const val = row.yearValues[year];
                  return (
                    <td key={year} className={`px-2 py-1 border-r border-slate-200 text-right tabular-nums ${viewMode === 'average' && val > 0 ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>
                      {val !== 0 ? formatCurrency(val) : <span className="text-slate-200">-</span>}
                    </td>
                  );
                })}
                <td className={`px-2 py-1 text-right font-bold text-slate-800 bg-slate-100 group-hover:bg-blue-100 tabular-nums ${viewMode === 'average' ? 'text-indigo-700' : ''}`}>
                  {row.rowTotal !== 0 ? formatCurrency(row.rowTotal) : '-'}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="sticky bottom-0 z-20 bg-white border-t-2 border-slate-400 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <tr className="bg-slate-100">
              <td className="p-3 font-bold text-slate-800 border-r border-slate-300 sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-amber-100">
                {viewMode === 'total' ? 'TOTALE VOCI' : 'MEDIA GIORNALIERA TOTALE'}
              </td>
              {YEARS.map(year => (
                <td key={year} className="px-2 py-2 text-right font-bold text-slate-800 border-r border-slate-300 tabular-nums bg-amber-50">
                  {yearlyTotals[year] !== 0 ? formatCurrency(yearlyTotals[year]) : '-'}
                </td>
              ))}
              <td className="px-2 py-2 text-right font-black text-white bg-slate-700 tabular-nums text-sm">
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