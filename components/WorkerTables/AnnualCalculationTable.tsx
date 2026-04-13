import React, { useMemo, useState } from 'react';
import {
  AnnoDati,
  YEARS,
  MONTH_NAMES,
  getColumnsByProfile,
  ProfiloAzienda
} from '../../types';
import {
  parseLocalFloat,
  parseFloatSafe,
  formatCurrency,
  formatDay
} from '../../utils/formatters';
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
  CalendarPlus,
  Info,
  FileSearch
} from 'lucide-react';

interface AnnualCalculationTableProps {
  data: AnnoDati[];
  profilo: ProfiloAzienda;
  eliorType?: 'viaggiante' | 'magazzino';
  onDataChange: (newData: AnnoDati[]) => void;
  includeTickets?: boolean;
  startClaimYear: number;
  years: number[];  // Range dinamico controllato dal parent
}

const MONTH_COLORS = [
  'bg-sky-400 shadow-sky-200', 'bg-blue-500 shadow-blue-200', 'bg-emerald-400 shadow-emerald-200',
  'bg-green-500 shadow-green-200', 'bg-lime-500 shadow-lime-200', 'bg-yellow-400 shadow-yellow-200',
  'bg-orange-400 shadow-orange-200', 'bg-red-500 shadow-red-200', 'bg-amber-500 shadow-amber-200',
  'bg-orange-600 shadow-orange-200', 'bg-slate-500 shadow-slate-200', 'bg-indigo-500 shadow-indigo-200'
];



const AnnualCalculationTable: React.FC<AnnualCalculationTableProps> = ({
  data = [],
  profilo,
  eliorType,
  onDataChange,
  includeTickets = true,
  startClaimYear,
  years
}) => {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [isCopied, setIsCopied] = useState(false);

  // --- STATI DI CONFIGURAZIONE AVANZATA ---
  const [showDetails, setShowDetails] = useState(false);
  const [includeExFest, setIncludeExFest] = useState(false);
  const [interestRate, setInterestRate] = useState<string>("0");
  const badgeClass = useMemo(() => {
    if (profilo === 'ELIOR') return 'text-orange-400 border-orange-600 bg-orange-900/30';
    if (profilo === 'REKEEP') return 'text-emerald-400 border-emerald-600 bg-emerald-900/30';
    if (profilo === 'RFI') return 'text-blue-400 border-blue-600 bg-blue-900/30';

    // AZIENDE CUSTOM (Palette dinamica)
    const customPalette = [
      'text-fuchsia-400 border-fuchsia-600 bg-fuchsia-900/30',
      'text-violet-400 border-violet-600 bg-violet-900/30',
      'text-cyan-400 border-cyan-600 bg-cyan-900/30',
      'text-rose-400 border-rose-600 bg-rose-900/30',
      'text-indigo-400 border-indigo-600 bg-indigo-900/30',
      'text-teal-400 border-teal-600 bg-teal-900/30'
    ];
    let hash = 0;
    if (profilo) {
      for (let i = 0; i < profilo.length; i++) {
        hash = profilo.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return customPalette[Math.abs(hash) % customPalette.length];
  }, [profilo]);
  const toggleYear = (year: number) => {
    const newSet = new Set(expandedYears);
    if (newSet.has(year)) newSet.delete(year);
    else newSet.add(year);
    setExpandedYears(newSet);
  };

  const handleCoeffChange = (year: number, monthIndex: number, field: 'coeffPercepito' | 'coeffTicket', value: string) => {
    // Non puliamo l'input qui, lasciamo che l'utente scriva virgole
    const existingRowIndex = data.findIndex(d => d.year === year && d.monthIndex === monthIndex);
    let newData = [...data];

    if (existingRowIndex >= 0) {
      newData[existingRowIndex] = { ...newData[existingRowIndex], [field]: value };
    } else {
      newData.push({
        year, monthIndex, daysWorked: 0, daysVacation: 0, ticket: 0, [field]: value
      } as AnnoDati);
    }
    onDataChange(newData);
  };

  const handleAnnualCoeffChange = (year: number, field: 'coeffPercepito' | 'coeffTicket', value: string) => {
    let newData = [...data];

    for (let i = 0; i < 12; i++) {
      const existingRowIndex = newData.findIndex(d => d.year === year && d.monthIndex === i);
      if (existingRowIndex >= 0) {
        newData[existingRowIndex] = { ...newData[existingRowIndex], [field]: value };
      } else {
        newData.push({
          year, monthIndex: i, daysWorked: 0, daysVacation: 0, ticket: 0, [field]: value
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

  // Funzione interna per sommare le indennità del mese usando il parser corretto
  const calculateMonthIndemnity = (monthRow: any) => {
    if (!monthRow) return 0;
    let sum = 0;
    const specificColumns = getColumnsByProfile(profilo, eliorType);
    specificColumns.forEach(col => {
      // Escludiamo i campi tecnici e i premi di produttività (3B70, 3B71)
      if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(col.id)) {
        sum += parseLocalFloat(monthRow[col.id]);
      }
    });
    return sum;
  };

  // --- LOGICA DI CALCOLO UNIFICATA ---
  const annualRows = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const TETTO_FERIE = includeExFest ? 32 : 28;

    // 1. PRE-CALCOLO MEDIE ANNUALI
    const yearlyRawStats: Record<number, { totVar: number; ggLav: number }> = {};

    safeData.forEach(row => {
      const y = Number(row.year);
      if (!yearlyRawStats[y]) yearlyRawStats[y] = { totVar: 0, ggLav: 0 };

      const gg = parseLocalFloat(row.daysWorked); // <--- USO PARSER UNIFICATO
      const indennitaMese = calculateMonthIndemnity(row);
      
      yearlyRawStats[y].totVar += indennitaMese;
      yearlyRawStats[y].ggLav += gg;
    });

    const yearlyAverages: Record<number, number> = {};
    Object.keys(yearlyRawStats).forEach(yStr => {
      const y = Number(yStr);
      const s = yearlyRawStats[y];
      yearlyAverages[y] = s.ggLav > 0 ? s.totVar / s.ggLav : 0;
    });

    // 2. COSTRUZIONE RIGHE ANNUALI
    const availableYears = Array.from(new Set(safeData.map(d => d.year)))
      .filter(y => years.includes(y))
      .sort((a, b) => a - b);

    // FIX FONDAMENTALE: ferieCumulateCounter deve essere DENTRO il .map ma FUORI dal ciclo mesi
    // In questo modo si resetta ogni anno (nuovo plafond ferie) ma si accumula mese per mese.

    return availableYears.map(year => {
      // RESET CONTATORE FERIE PER IL NUOVO ANNO
      let ferieCumulateCounter = 0;

      const months = safeData.filter(d => d.year === year).sort((a, b) => a.monthIndex - b.monthIndex);

      // FLAG ANNO RIFERIMENTO
      const isReferenceYear = year < startClaimYear;

      // Recupero media da applicare (Anno prec o corrente)
      let avgApplied = yearlyAverages[year - 1];
      let isFallback = false;

      if (avgApplied === undefined || avgApplied === 0) {
        avgApplied = yearlyAverages[year] || 0;
        isFallback = true;
      }

      // Totali per la riga dell'anno
      let sumIndennitaTotali = yearlyRawStats[year]?.totVar || 0;
      let sumGiorniLav = yearlyRawStats[year]?.ggLav || 0;
      let sumGiorniFerieReali = 0;
      let sumGiorniFerieUtili = 0;
      let sumIndennitaSpettante = 0;
      let sumIndennitaPercepita = 0;
      let sumBuoniPasto = 0;
      let sumNetto = 0;

      const monthlyDetails = months.map(row => {
        const indennitaMensile = calculateMonthIndemnity(row);
        const giorniLav = parseLocalFloat(row.daysWorked);
        const giorniFerieReali = parseLocalFloat(row.daysVacation);

        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += giorniFerieReali;

        // Calcolo giorni utili (fino al tetto)
        let giorniUtili = 0;
        const spazioRimanente = Math.max(0, TETTO_FERIE - prevTotal);
        giorniUtili = Math.min(giorniFerieReali, spazioRimanente);

        const rawPercepito = row['coeffPercepito'] || "";
        const rawTicket = row['coeffTicket'] || "";
        const valPercepito = parseLocalFloat(rawPercepito); // <--- USO PARSER UNIFICATO
        const valTicket = parseLocalFloat(rawTicket);       // <--- USO PARSER UNIFICATO

        // CALCOLO ECONOMICO
        let indennitaSpettante = 0;
        if (giorniUtili > 0) {
          indennitaSpettante = giorniUtili * avgApplied;
        }

        const indennitaPercepita = giorniUtili * valPercepito;
        const buoniPasto = includeTickets ? (giorniUtili * valTicket) : 0;
        const netto = (indennitaSpettante - indennitaPercepita) + buoniPasto;

        sumGiorniFerieReali += giorniFerieReali;
        sumGiorniFerieUtili += giorniUtili;
        sumIndennitaSpettante += indennitaSpettante;
        sumIndennitaPercepita += indennitaPercepita;
        sumBuoniPasto += buoniPasto;
        sumNetto += netto;

        return {
          index: row.monthIndex,
          name: MONTH_NAMES[row.monthIndex],
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
        isReferenceYear,
        sumIndennitaTotali,
        sumGiorniLav,
        sumGiorniFerieReali,
        sumGiorniFerieUtili,
        sumIndennitaSpettante,
        sumIndennitaPercepita,
        sumBuoniPasto,
        sumNetto,
        monthlyDetails,
        avgApplied,
        isFallback
      };
    });
  }, [data, profilo, includeExFest, includeTickets, startClaimYear]);

  // --- CORREZIONE: ESCLUDERE ANNI RIFERIMENTO DAL TOTALE ---
  const summary = useMemo(() => {
    const baseSummary = annualRows.reduce((acc, row) => {

      // 🔥 AGGIUNGI QUESTA RIGA: Se l'anno è prima dell'inizio causa, SALTALO
      if (row.year < startClaimYear) return acc;

      return {
        totalGrossIndemnity: acc.totalGrossIndemnity + row.sumIndennitaSpettante,
        totalPaid: acc.totalPaid + row.sumIndennitaPercepita,
        totalTickets: acc.totalTickets + row.sumBuoniPasto,
        totalNetDue: acc.totalNetDue + row.sumNetto
      };
    }, {
      totalGrossIndemnity: 0,
      totalPaid: 0,
      totalTickets: 0,
      totalNetDue: 0
    });

    const rate = parseLocalFloat(interestRate);
    const interestAmount = baseSummary.totalNetDue * (rate / 100);
    const grandTotal = baseSummary.totalNetDue + interestAmount;

    return { ...baseSummary, interestAmount, grandTotal };
  }, [annualRows, interestRate, startClaimYear]); // <--- Assicurati che startClaimYear sia qui

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(summary.grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const hasActualData = useMemo(() => {
    return data.some(d => 
      parseLocalFloat(d.daysWorked) > 0 || 
      parseLocalFloat(d.daysVacation) > 0 ||
      calculateMonthIndemnity(d) > 0
    );
  }, [data, profilo]);

  if (!data || !hasActualData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center mt-4 border-dashed border-2 border-slate-300 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl h-full min-h-[400px] shadow-lg transition-all">
        <div className="w-24 h-24 mb-6 rounded-full bg-blue-50 dark:bg-slate-800/80 flex items-center justify-center shadow-inner ring-4 ring-white dark:ring-slate-800">
          <FileSearch className="w-12 h-12 text-blue-500 dark:text-cyan-400 animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 tracking-tight">Nessun Dato Calcolabile</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed text-base font-medium">
          La tabella di calcolo annuale è vuota. Inserisci i dati mensili (ore o giornate lavorate/ferie) nel tab "Gestione Dati" per generare automaticamente il prospetto differenze.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 shadow-xl dark:shadow-[0_0_20px_rgba(34,211,238,0.15)] rounded-lg overflow-hidden border border-slate-200 dark:border-cyan-400 flex flex-col h-full transition-all duration-300">
      <div className="p-3 bg-slate-800 text-white font-bold text-sm tracking-wide flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>CALCOLO DIFFERENZE PER ANNO</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border uppercase ${badgeClass}`}>
              {profilo}
            </span>
          </div>

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
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700 h-14 text-xs uppercase transition-colors">
              <th className="p-2 text-left font-bold border-r border-slate-300 dark:border-slate-700 w-48 pl-4 sticky left-0 bg-slate-100 dark:bg-slate-800 z-20">ANNO / MESE</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-32 bg-blue-50/50 dark:bg-blue-900/20">Indennità<br />Totali Mensili</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-24">Giorni<br />Lavorati</th>
              <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-28 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400">Media<br />Giornaliera</th>

              <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-28">
                Giorni<br />{includeExFest ? "Ferie+ExF" : "Ferie"} <span className="text-[9px] lowercase font-normal text-slate-500 dark:text-slate-400">(utili)</span>
              </th>
              <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-32 bg-indigo-50/50 dark:bg-indigo-900/20">Spettante<br />(Lordo)</th>

              {showDetails && (
                <>
                  <th className="p-2 text-center font-bold border-r border-slate-300 dark:border-slate-700 w-24 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">Coeff.<br />Percepito</th>
                  <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-32 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">Indennità<br />Percepita</th>
                  <th className="p-2 text-center font-bold border-r border-slate-300 dark:border-slate-700 w-24 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">Coeff.<br />Ticket</th>
                  <th className="p-2 text-right font-bold border-r border-slate-300 dark:border-slate-700 w-32 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">Buoni<br />Pasto</th>
                </>
              )}

              <th className="p-2 text-right font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 w-36">DIFFERENZA<br />DOVUTA</th>
            </tr>
          </thead>
          <tbody>
            {annualRows.map((row) => {
              const isExpanded = expandedYears.has(row.year);
              const displayAnnualPercepito = getAnnualDisplayValue(row.year, 'coeffPercepito');
              const displayAnnualTicket = getAnnualDisplayValue(row.year, 'coeffTicket');

              // STILE RIGHE ANNO RIFERIMENTO
              const rowClass = row.isReferenceYear
                ? "bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 font-medium"
                : (isExpanded ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-700');

              return (
                <React.Fragment key={row.year}>
                  <tr className={`transition-colors duration-150 border-b border-slate-300 dark:border-slate-700 h-12 ${rowClass}`}>
                    <td onClick={() => toggleYear(row.year)} className={`p-2 border-r border-slate-300 dark:border-slate-700 font-bold flex items-center gap-2 h-12 sticky left-0 z-10 cursor-pointer ${row.isReferenceYear ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400' : 'bg-inherit text-slate-800 dark:text-slate-200'}`}>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {row.year} {row.isReferenceYear && <span className="text-[9px] uppercase border border-slate-300 dark:border-slate-600 px-1 rounded bg-white dark:bg-slate-800 ml-2">Rif. Media</span>}
                    </td>
                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold dark:text-slate-200">{formatCurrency(row.sumIndennitaTotali)}</td>
                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold dark:text-slate-200">{formatDay(row.sumGiorniLav)}</td>

                    <td className={`p-2 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold relative group cursor-help ${row.isReferenceYear ? 'dark:text-slate-300' : 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'}`}>
                      {formatCurrency(row.avgApplied)}
                      {row.isFallback && (
                        <>
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg z-50 text-center font-sans">
                            Dati anno prec. mancanti. Media corrente.
                          </div>
                        </>
                      )}
                    </td>

                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold dark:text-slate-200">
                      <div className="flex flex-col items-end leading-none">
                        <span>{formatDay(row.sumGiorniFerieUtili)}</span>
                        {row.sumGiorniFerieReali > row.sumGiorniFerieUtili && (
                          <span className="text-[9px] font-normal opacity-70">su {formatDay(row.sumGiorniFerieReali)}</span>
                        )}
                      </div>
                    </td>

                    <td className={`p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold ${row.isReferenceYear ? 'text-xs dark:text-slate-400' : 'text-indigo-700 dark:text-indigo-400 bg-indigo-100/30 dark:bg-indigo-900/30'}`}>
                      {row.isReferenceYear ? "(Solo Media)" : formatCurrency(row.sumIndennitaSpettante)}
                    </td>

                    {showDetails && (
                      <>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center" onClick={(e) => e.stopPropagation()}>
                          {!row.isReferenceYear && (
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full h-8 text-center text-sm font-bold border border-orange-300 dark:border-orange-700/50 rounded focus:border-orange-500 outline-none text-orange-800 dark:text-orange-300 bg-white dark:bg-slate-900 transition-colors"
                              placeholder="Misto"
                              value={displayAnnualPercepito}
                              onChange={(e) => handleAnnualCoeffChange(row.year, 'coeffPercepito', e.target.value)}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold text-orange-700 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-900/20">
                          {row.isReferenceYear ? "-" : formatCurrency(row.sumIndennitaPercepita)}
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center" onClick={(e) => e.stopPropagation()}>
                          {!row.isReferenceYear && (
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full h-8 text-center text-sm font-bold border border-teal-300 dark:border-teal-700/50 rounded focus:border-teal-500 outline-none text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-900 transition-colors"
                              placeholder="Misto"
                              value={displayAnnualTicket}
                              onChange={(e) => handleAnnualCoeffChange(row.year, 'coeffTicket', e.target.value)}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold text-teal-700 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-900/20">
                          {row.isReferenceYear ? "-" : formatCurrency(row.sumBuoniPasto)}
                        </td>
                      </>
                    )}

                    <td className={`p-2 text-right font-black text-sm ${row.isReferenceYear ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-800 dark:text-cyan-400 bg-emerald-200/50 dark:bg-emerald-900/40'}`}>
                      {row.isReferenceYear ? "-" : formatCurrency(row.sumNetto)}
                    </td>
                  </tr>

                  {isExpanded && row.monthlyDetails.map((month) => (
                    <tr key={`${row.year}-${month.index}`} className={`border-b border-slate-100 dark:border-slate-700/50 last:border-slate-300 dark:last:border-slate-600 h-10 transition-colors ${row.isReferenceYear ? 'bg-slate-50 dark:bg-slate-900/60 opacity-75' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80'}`}>
                      <td className="py-1 pr-2 pl-10 border-r border-slate-200 dark:border-slate-700/50 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide h-10 sticky left-0 z-10 flex items-center bg-inherit">
                        <span className={`w-2.5 h-2.5 rounded-full mr-3 shadow-sm ${MONTH_COLORS[month.index]}`}></span>
                        {month.name}
                      </td>

                      <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs text-slate-600 dark:text-slate-300">{month.indennitaMensile !== 0 ? formatCurrency(month.indennitaMensile) : '-'}</td>
                      <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs text-slate-600 dark:text-slate-300">{month.giorniLav !== 0 ? formatDay(month.giorniLav) : '-'}</td>

                      <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs font-mono text-amber-700/50 dark:text-amber-500/50">{formatCurrency(row.avgApplied)}</td>

                      <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs bg-yellow-50/50 dark:bg-amber-900/10">
                        <div className="flex flex-col items-end">
                          <span className={month.giorniFerieReali > month.giorniUtili ? "text-red-600 dark:text-red-400 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                            {formatDay(month.giorniUtili)}
                          </span>
                        </div>
                      </td>

                      {/* CELLE MONETARIE MENSILI */}
                      <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs text-indigo-600 dark:text-indigo-300 font-medium bg-indigo-50/20 dark:bg-indigo-900/20">
                        {row.isReferenceYear ? '-' : (month.indennitaSpettante !== 0 ? formatCurrency(month.indennitaSpettante) : '-')}
                      </td>

                      {showDetails && (
                        <>
                          <td className="px-1 border-r border-slate-200 dark:border-slate-700/50 text-center bg-orange-50/10 dark:bg-orange-900/10">
                            {!row.isReferenceYear && (
                              <input
                                type="text"
                                inputMode="decimal"
                                className="w-full h-7 text-center text-xs border border-orange-200 dark:border-orange-800/50 rounded focus:border-orange-500 outline-none text-orange-700 dark:text-orange-300 bg-white dark:bg-slate-900 transition-colors"
                                value={month.rawPercepito}
                                onChange={(e) => handleCoeffChange(row.year, month.index, 'coeffPercepito', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs text-orange-600 dark:text-orange-400 bg-orange-50/10 dark:bg-orange-900/10">
                            {row.isReferenceYear ? '-' : (month.indennitaPercepita !== 0 ? formatCurrency(month.indennitaPercepita) : '-')}
                          </td>
                          <td className="px-1 border-r border-slate-200 dark:border-slate-700/50 text-center bg-teal-50/10 dark:bg-teal-900/10">
                            {!row.isReferenceYear && (
                              <input
                                type="text"
                                inputMode="decimal"
                                className="w-full h-7 text-center text-xs border border-teal-200 dark:border-teal-800/50 rounded focus:border-teal-500 outline-none text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-900 transition-colors"
                                value={month.rawTicket}
                                onChange={(e) => handleCoeffChange(row.year, month.index, 'coeffTicket', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="px-2 border-r border-slate-200 dark:border-slate-700/50 text-right text-xs text-teal-600 dark:text-teal-400 bg-teal-50/10 dark:bg-teal-900/10">
                            {row.isReferenceYear ? '-' : (month.buoniPasto !== 0 ? formatCurrency(month.buoniPasto) : '-')}
                          </td>
                        </>
                      )}

                      <td className={`px-2 text-right text-xs font-bold ${row.isReferenceYear ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-700 dark:text-cyan-400 bg-emerald-50/30 dark:bg-emerald-900/20'}`}>
                        {row.isReferenceYear ? '-' : (month.netto !== 0 ? formatCurrency(month.netto) : '-')}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 bg-slate-50 dark:bg-slate-950 p-6 border-t border-slate-200 dark:border-slate-700 transition-colors">
        <div className="bg-blue-50/50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
          {/* ... HEADER DEL SUMMARY ... */}
          <div className="flex items-center gap-2 mb-4 justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest">
                Riepilogo Finale
              </h3>
              <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                <AlertCircle size={10} />
                <span>Tetto: {includeExFest ? "32" : "28"} GG</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-indigo-200 dark:border-slate-600 shadow-sm transition-colors">
              <Percent size={12} className="text-indigo-500 dark:text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Interessi/Rivalutazione:</span>
              <input
                type="text"
                className="w-12 text-right text-xs font-bold text-indigo-700 dark:text-cyan-300 outline-none border-b border-indigo-200 dark:border-indigo-500 focus:border-indigo-500 dark:focus:border-cyan-400 bg-transparent transition-colors"
                placeholder="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
              <span className="text-xs text-indigo-500 dark:text-indigo-400 font-bold">%</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">TOT. SPETTANTE LORDO (Media Applicata)</span>
              <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{formatCurrency(summary.totalGrossIndemnity)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">TOT. GIA' PERCEPITO</span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">- {formatCurrency(summary.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2 border-dashed">
              <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wide">TOT. BUONI PASTO</span>
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums">+ {formatCurrency(summary.totalTickets)}</span>
            </div>

            {summary.interestAmount > 0 && (
              <div className="flex justify-between items-center border-b border-emerald-200 dark:border-emerald-800/50 pb-2 border-dashed bg-emerald-50/50 dark:bg-emerald-900/20 px-2 rounded">
                <span className="text-xs uppercase text-emerald-600 dark:text-emerald-400 font-bold tracking-wide">
                  + INTERESSI E RIVALUTAZIONE ({interestRate}%)
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+ {formatCurrency(summary.interestAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center mt-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm transition-colors">
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700 dark:text-emerald-400 font-black tracking-wide">TOTALE DA LIQUIDARE</span>
                <div className="flex items-center gap-1">
                  <Info size={10} className="text-emerald-400 dark:text-emerald-500" />
                  <span className="text-[9px] text-emerald-500 dark:text-emerald-400/70 font-medium">Netto = (Spettante - Percepito) + Ticket {summary.interestAmount > 0 ? "+ Interessi" : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-emerald-700 dark:text-cyan-400 tabular-nums tracking-tight">{formatCurrency(summary.grandTotal)}</span>
                <button
                  onClick={handleCopyTotal}
                  className="p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-400 dark:text-cyan-500 hover:text-emerald-700 dark:hover:text-cyan-300 transition-colors"
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