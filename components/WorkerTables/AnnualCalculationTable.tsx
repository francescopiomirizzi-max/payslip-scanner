import React, { useMemo, useState } from 'react';
import {
  AnnoDati,
  YEARS,
  MONTH_NAMES,
  formatCurrency,
  formatInteger,
  getColumnsByProfile,
  ProfiloAzienda,
  parseFloatSafe
} from '../../types';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Calculator,
  Eye,
  EyeOff,
  AlertCircle,
  Percent,
  CalendarPlus
} from 'lucide-react';

interface AnnualCalculationTableProps {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
  onDataChange: (newData: AnnoDati[]) => void;
}

const MONTH_COLORS = [
  'bg-sky-400 shadow-sky-200', 'bg-blue-500 shadow-blue-200', 'bg-emerald-400 shadow-emerald-200',
  'bg-green-500 shadow-green-200', 'bg-lime-500 shadow-lime-200', 'bg-yellow-400 shadow-yellow-200',
  'bg-orange-400 shadow-orange-200', 'bg-red-500 shadow-red-200', 'bg-amber-500 shadow-amber-200',
  'bg-orange-600 shadow-orange-200', 'bg-slate-500 shadow-slate-200', 'bg-indigo-500 shadow-indigo-200'
];

const AnnualCalculationTable: React.FC<AnnualCalculationTableProps> = ({ data = [], profilo, onDataChange }) => {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [isCopied, setIsCopied] = useState(false);

  // --- STATI DI CONFIGURAZIONE AVANZATA ---
  const [showDetails, setShowDetails] = useState(false);
  const [includeExFest, setIncludeExFest] = useState(false); // Toggle per 28 vs 32 giorni
  const [interestRate, setInterestRate] = useState<string>("0"); // Interessi e Rivalutazione

  const toggleYear = (year: number) => {
    const newSet = new Set(expandedYears);
    if (newSet.has(year)) newSet.delete(year);
    else newSet.add(year);
    setExpandedYears(newSet);
  };

  const handleCoeffChange = (year: number, monthIndex: number, field: 'coeffPercepito' | 'coeffTicket', value: string) => {
    const cleanValue = value.replace(/[^0-9.,]/g, '');
    const existingRowIndex = data.findIndex(d => d.year === year && d.monthIndex === monthIndex);
    let newData = [...data];

    if (existingRowIndex >= 0) {
      newData[existingRowIndex] = { ...newData[existingRowIndex], [field]: cleanValue };
    } else {
      newData.push({
        year, monthIndex, daysWorked: 0, daysVacation: 0, ticket: 0, [field]: cleanValue
      } as AnnoDati);
    }
    onDataChange(newData);
  };

  const handleAnnualCoeffChange = (year: number, field: 'coeffPercepito' | 'coeffTicket', value: string) => {
    const cleanValue = value.replace(/[^0-9.,]/g, '');
    let newData = [...data];

    for (let i = 0; i < 12; i++) {
      const existingRowIndex = newData.findIndex(d => d.year === year && d.monthIndex === i);
      if (existingRowIndex >= 0) {
        newData[existingRowIndex] = { ...newData[existingRowIndex], [field]: cleanValue };
      } else {
        newData.push({
          year, monthIndex: i, daysWorked: 0, daysVacation: 0, ticket: 0, [field]: cleanValue
        } as AnnoDati);
      }
    }
    onDataChange(newData);
  };

  const getAnnualDisplayValue = (year: number, field: string) => {
    let firstVal: string | null = null;
    for (let i = 0; i < 12; i++) {
      const row = data.find(d => d.year === year && d.monthIndex === i);
      const val = row ? (row as any)[field] : "";
      if (firstVal === null) firstVal = val || "";
      else if ((val || "") !== firstVal) return "";
    }
    return firstVal || "";
  };

  const parseInputToNumber = (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const calculateMonthIndemnity = (monthRow: any) => {
    if (!monthRow) return 0;
    let sum = 0;
    const specificColumns = getColumnsByProfile(profilo);
    specificColumns.forEach(col => {
      if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note'].includes(col.id)) {
        sum += parseFloatSafe(monthRow[col.id]);
      }
    });
    return sum;
  };

  // --- LOGICA DI CALCOLO AGGIORNATA (TETTO DINAMICO) ---
  const annualRows = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];

    // SE includeExFest è true, il tetto sale a 32 (28 Ferie + 4 Ex Fest)
    const TETTO_FERIE = includeExFest ? 32 : 28;

    return YEARS.map(year => {
      const existingMonths = safeData.filter(d => d.year === year);

      let ferieCumulateCounter = 0;

      let sumIndennitaTotali = 0;
      let sumGiorniLav = 0;
      let sumGiorniFerieReali = 0;
      let sumGiorniFerieUtili = 0;
      let sumIndennitaSpettante = 0;
      let sumIndennitaPercepita = 0;
      let sumBuoniPasto = 0;
      let sumNetto = 0;

      const monthlyDetails = MONTH_NAMES.map((monthName, index) => {
        const safeRow = existingMonths.find((r: any) => r.monthIndex == index) || {};

        const indennitaMensile = calculateMonthIndemnity(safeRow);
        const giorniLav = parseFloatSafe(safeRow['daysWorked']);
        const giorniFerieReali = parseFloatSafe(safeRow['daysVacation']);

        // --- APPLICAZIONE TETTO DINAMICO ---
        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += giorniFerieReali;

        let giorniUtili = 0;
        if (prevTotal < TETTO_FERIE) {
          const spazioRimanente = TETTO_FERIE - prevTotal;
          giorniUtili = Math.min(giorniFerieReali, spazioRimanente);
        } else {
          giorniUtili = 0;
        }

        const rawPercepito = safeRow['coeffPercepito'] || "";
        const rawTicket = safeRow['coeffTicket'] || "";

        const valPercepito = parseInputToNumber(rawPercepito);
        const valTicket = parseInputToNumber(rawTicket);

        // Calcoli basati su GIORNI UTILI
        let indennitaSpettante = 0;
        if (giorniLav > 0) {
          indennitaSpettante = (indennitaMensile / giorniLav) * giorniUtili;
        }

        const indennitaPercepita = giorniUtili * valPercepito;
        const buoniPasto = giorniUtili * valTicket;
        const netto = indennitaSpettante - indennitaPercepita + buoniPasto;

        sumIndennitaTotali += indennitaMensile;
        sumGiorniLav += giorniLav;
        sumGiorniFerieReali += giorniFerieReali;
        sumGiorniFerieUtili += giorniUtili;
        sumIndennitaSpettante += indennitaSpettante;
        sumIndennitaPercepita += indennitaPercepita;
        sumBuoniPasto += buoniPasto;
        sumNetto += netto;

        return {
          index,
          name: monthName,
          indennitaMensile,
          giorniLav,
          giorniFerieReali,
          giorniUtili,
          indennitaSpettante,
          indennitaPercepita,
          buoniPasto,
          netto,
          rawPercepito,
          rawTicket
        };
      });

      return {
        year,
        sumIndennitaTotali,
        sumGiorniLav,
        sumGiorniFerieReali,
        sumGiorniFerieUtili,
        sumIndennitaSpettante,
        sumIndennitaPercepita,
        sumBuoniPasto,
        sumNetto,
        monthlyDetails
      };
    });
  }, [data, profilo, includeExFest]); // Dipendenza aggiunta: includeExFest

  // Totale Generale + Interessi
  const summary = useMemo(() => {
    const baseSummary = annualRows.reduce((acc, row) => ({
      totalGrossIndemnity: acc.totalGrossIndemnity + row.sumIndennitaSpettante,
      totalPaid: acc.totalPaid + row.sumIndennitaPercepita,
      totalTickets: acc.totalTickets + row.sumBuoniPasto,
      totalNetDue: acc.totalNetDue + row.sumNetto
    }), {
      totalGrossIndemnity: 0,
      totalPaid: 0,
      totalTickets: 0,
      totalNetDue: 0
    });

    // Calcolo Interessi
    const rate = parseFloat(interestRate.replace(',', '.')) || 0;
    const interestAmount = baseSummary.totalNetDue * (rate / 100);
    const grandTotal = baseSummary.totalNetDue + interestAmount;

    return { ...baseSummary, interestAmount, grandTotal };
  }, [annualRows, interestRate]);

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(summary.grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200 flex flex-col h-full">
      <div className="p-3 bg-slate-800 text-white font-bold text-sm tracking-wide flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>CALCOLO DIFFERENZE</span>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-[10px] text-blue-400 border border-slate-600">{profilo}</span>
          </div>

          {/* --- TOGGLE EX FESTIVITA' --- */}
          <button
            onClick={() => setIncludeExFest(!includeExFest)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-all ${includeExFest
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
              }`}
            title="Include le 4 giornate di Ex Festività nel calcolo (Tetto 32gg)"
          >
            <CalendarPlus size={12} />
            {includeExFest ? "Tetto: 32gg (+ExFest)" : "Tetto: 28gg (Solo Ferie)"}
          </button>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] uppercase font-bold tracking-wider transition-all border border-slate-600 hover:border-slate-500"
        >
          {showDetails ? <EyeOff size={14} className="text-slate-300" /> : <Eye size={14} className="text-emerald-400" />}
          <span className="text-slate-200">{showDetails ? "Nascondi Dettagli" : "Mostra Parametri"}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto border-b border-slate-200">
        <table className="w-full text-sm border-collapse table-fixed min-w-[1000px]">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="bg-slate-100 text-slate-600 border-b border-slate-300 h-14 text-xs uppercase">
              <th className="p-2 text-left font-bold border-r border-slate-300 w-48 pl-4 sticky left-0 bg-slate-100 z-20">ANNO / MESE</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 w-32 bg-blue-50/50">Indennità<br />Totali Mensili</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 w-24">Giorni<br />Lavorati</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 w-28">
                Giorni<br />{includeExFest ? "Ferie+ExF" : "Ferie"} <span className="text-[9px] lowercase font-normal text-slate-500">(utili)</span>
              </th>
              <th className="p-2 text-right font-bold border-r border-slate-300 w-32 bg-indigo-50/50">Spettante<br />(Lordo)</th>

              {showDetails && (
                <>
                  <th className="p-2 text-center font-bold border-r border-slate-300 w-24 bg-orange-50 text-orange-700">Coeff.<br />Variabile</th>
                  <th className="p-2 text-right font-bold border-r border-slate-300 w-32 bg-orange-50 text-orange-700">Indennità<br />Percepita</th>
                  <th className="p-2 text-center font-bold border-r border-slate-300 w-24 bg-teal-50 text-teal-700">Coeff.<br />Ticket</th>
                  <th className="p-2 text-right font-bold border-r border-slate-300 w-32 bg-teal-50 text-teal-700">Buoni<br />Pasto</th>
                </>
              )}

              <th className="p-2 text-right font-black bg-emerald-100 text-emerald-800 w-36">DIFFERENZA<br />DOVUTA</th>
            </tr>
          </thead>
          <tbody>
            {annualRows.map((row) => {
              const isExpanded = expandedYears.has(row.year);
              const displayAnnualPercepito = getAnnualDisplayValue(row.year, 'coeffPercepito');
              const displayAnnualTicket = getAnnualDisplayValue(row.year, 'coeffTicket');

              return (
                <React.Fragment key={row.year}>
                  <tr className={`transition-colors duration-150 border-b border-slate-300 h-12 ${isExpanded ? 'bg-slate-200' : 'bg-slate-100 hover:bg-slate-200'}`}>
                    <td onClick={() => toggleYear(row.year)} className="p-2 border-r border-slate-300 font-bold text-slate-800 flex items-center gap-2 h-12 sticky left-0 z-10 bg-inherit cursor-pointer">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {row.year}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-700">{formatCurrency(row.sumIndennitaTotali)}</td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-700">{formatInteger(row.sumGiorniLav)}</td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-700">
                      <div className="flex flex-col items-end leading-none">
                        <span>{formatInteger(row.sumGiorniFerieUtili)}</span>
                        {row.sumGiorniFerieReali > row.sumGiorniFerieUtili && (
                          <span className="text-[9px] font-normal text-slate-500">su {formatInteger(row.sumGiorniFerieReali)}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-indigo-700 bg-indigo-100/30">{formatCurrency(row.sumIndennitaSpettante)}</td>

                    {showDetails && (
                      <>
                        <td className="p-1 border-r border-slate-300 bg-orange-50/30 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full h-8 text-center text-sm font-bold border border-orange-300 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-300 outline-none text-orange-800 bg-white placeholder-orange-300/50"
                            placeholder="Misto"
                            value={displayAnnualPercepito}
                            onChange={(e) => handleAnnualCoeffChange(row.year, 'coeffPercepito', e.target.value)}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-bold text-orange-700 bg-orange-50/30">{formatCurrency(row.sumIndennitaPercepita)}</td>
                        <td className="p-1 border-r border-slate-300 bg-teal-50/30 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full h-8 text-center text-sm font-bold border border-teal-300 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-300 outline-none text-teal-800 bg-white placeholder-teal-300/50"
                            placeholder="Misto"
                            value={displayAnnualTicket}
                            onChange={(e) => handleAnnualCoeffChange(row.year, 'coeffTicket', e.target.value)}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-300 text-right font-bold text-teal-700 bg-teal-50/30">{formatCurrency(row.sumBuoniPasto)}</td>
                      </>
                    )}

                    <td className="p-2 text-right font-black text-emerald-800 bg-emerald-200/50 text-sm">{formatCurrency(row.sumNetto)}</td>
                  </tr>

                  {isExpanded && row.monthlyDetails.map((month) => (
                    <tr key={`${row.year}-${month.index}`} className="bg-white hover:bg-slate-50 border-b border-slate-100 last:border-slate-300 h-10">
                      <td className="py-1 pr-2 pl-10 border-r border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide h-10 sticky left-0 bg-white z-10 flex items-center">
                        <span className={`w-2.5 h-2.5 rounded-full mr-3 shadow-sm ${MONTH_COLORS[month.index]}`}></span>
                        {month.name}
                      </td>

                      <td className="px-2 border-r border-slate-200 text-right text-xs text-slate-600">{month.indennitaMensile !== 0 ? formatCurrency(month.indennitaMensile) : '-'}</td>
                      <td className="px-2 border-r border-slate-200 text-right text-xs text-slate-600">{month.giorniLav !== 0 ? formatInteger(month.giorniLav) : '-'}</td>
                      <td className="px-2 border-r border-slate-200 text-right text-xs bg-yellow-50/50">
                        <div className="flex flex-col items-end">
                          <span className={month.giorniFerieReali > month.giorniUtili ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>
                            {formatInteger(month.giorniUtili)}
                          </span>
                          {month.giorniFerieReali > month.giorniUtili && (
                            <span className="text-[8px] text-slate-400 line-through decoration-red-400">{formatInteger(month.giorniFerieReali)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 border-r border-slate-200 text-right text-xs text-indigo-600 font-medium bg-indigo-50/20">
                        {month.indennitaSpettante !== 0 ? formatCurrency(month.indennitaSpettante) : '-'}
                      </td>

                      {showDetails && (
                        <>
                          <td className="px-1 border-r border-slate-200 text-center bg-orange-50/10">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full h-7 text-center text-xs border border-orange-200 rounded focus:border-orange-500 outline-none text-orange-700 bg-white"
                              value={month.rawPercepito}
                              onChange={(e) => handleCoeffChange(row.year, month.index, 'coeffPercepito', e.target.value)}
                            />
                          </td>
                          <td className="px-2 border-r border-slate-200 text-right text-xs text-orange-600 bg-orange-50/10">
                            {month.indennitaPercepita !== 0 ? formatCurrency(month.indennitaPercepita) : '-'}
                          </td>
                          <td className="px-1 border-r border-slate-200 text-center bg-teal-50/10">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full h-7 text-center text-xs border border-teal-200 rounded focus:border-teal-500 outline-none text-teal-700 bg-white"
                              value={month.rawTicket}
                              onChange={(e) => handleCoeffChange(row.year, month.index, 'coeffTicket', e.target.value)}
                            />
                          </td>
                          <td className="px-2 border-r border-slate-200 text-right text-xs text-teal-600 bg-teal-50/10">
                            {month.buoniPasto !== 0 ? formatCurrency(month.buoniPasto) : '-'}
                          </td>
                        </>
                      )}

                      <td className="px-2 text-right text-xs font-bold text-emerald-700 bg-emerald-50/30">
                        {month.netto !== 0 ? formatCurrency(month.netto) : '-'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 bg-slate-50 p-6 border-t border-slate-200">
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest">
                Riepilogo Finale
              </h3>
              <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                <AlertCircle size={10} />
                <span>Tetto: {includeExFest ? "32" : "28"} GG</span>
              </div>
            </div>

            {/* --- INPUT INTERESSI E RIVALUTAZIONE --- */}
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-sm">
              <Percent size={12} className="text-indigo-500" />
              <span className="text-[10px] font-bold text-indigo-700 uppercase">Interessi/Rivalutazione:</span>
              <input
                type="text"
                className="w-12 text-right text-xs font-bold text-indigo-700 outline-none border-b border-indigo-200 focus:border-indigo-500 bg-transparent"
                placeholder="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
              <span className="text-xs text-indigo-500 font-bold">%</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 font-bold tracking-wide">TOT. SPETTANTE LORDO (Sui GG Utili)</span>
              <span className="text-lg font-bold text-indigo-700 tabular-nums">{formatCurrency(summary.totalGrossIndemnity)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 font-bold tracking-wide">TOT. GIA' PERCEPITO</span>
              <span className="text-lg font-bold text-orange-600 tabular-nums">- {formatCurrency(summary.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 font-bold tracking-wide">TOT. BUONI PASTO</span>
              <span className="text-lg font-bold text-teal-600 tabular-nums">+ {formatCurrency(summary.totalTickets)}</span>
            </div>

            {/* Mostra la riga interessi solo se > 0 */}
            {summary.interestAmount > 0 && (
              <div className="flex justify-between items-center border-b border-emerald-200 pb-2 border-dashed bg-emerald-50/50 px-2 rounded">
                <span className="text-xs uppercase text-emerald-600 font-bold tracking-wide">
                  + INTERESSI E RIVALUTAZIONE ({interestRate}%)
                </span>
                <span className="text-lg font-bold text-emerald-600 tabular-nums">+ {formatCurrency(summary.interestAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center mt-2 bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700 font-black tracking-wide">TOTALE DA LIQUIDARE</span>
                {summary.interestAmount > 0 && <span className="text-[9px] text-emerald-500 font-medium">Comprensivo di interessi</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-emerald-700 tabular-nums tracking-tight">{formatCurrency(summary.grandTotal)}</span>
                <button
                  onClick={handleCopyTotal}
                  className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-400 hover:text-emerald-700 transition-colors"
                  title="Copia totale"
                >
                  {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualCalculationTable;