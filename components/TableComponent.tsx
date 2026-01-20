import React, { useMemo } from 'react';
import { Worker, AnnoDati } from '../types';
import { calcolaTotaleComplessivo, CalculationResult } from '../utils/calculations';

interface TableComponentProps {
  worker: Worker;
  onUpdateWorker: (updatedYears: AnnoDati[]) => void;
}

const TableComponent: React.FC<TableComponentProps> = ({ worker, onUpdateWorker }) => {
  const { risultatiAnni, totaleComplessivo, totaleNettoDaPercepire, totalePasto } = useMemo(() => {
    return calcolaTotaleComplessivo(worker.anni);
  }, [worker]);

  const handleInputChange = (anno: number, field: keyof AnnoDati, value: string) => {
    const numericValue = parseFloat(value) || 0;

    // Deep copy of years to avoid direct mutation
    const updatedYears = worker.anni.map(item => {
      if (item.anno === anno) {
        return { ...item, [field]: numericValue };
      }
      return item;
    });

    onUpdateWorker(updatedYears);
  };

  return (
    <div className="overflow-x-auto shadow-2xl rounded-lg bg-white">
      <table className="min-w-full border-collapse border border-black text-[10px] md:text-xs text-center font-medium">
        <thead>
          <tr className="bg-[#4a86e8] text-white">
            <th className="border border-black px-2 py-3 w-12 uppercase">Anno</th>
            <th className="border border-black px-2 py-3 uppercase w-28">
              Totale Voci<br />Retributive<br />Accessorie
            </th>
            <th className="border border-black px-2 py-3 uppercase w-20">
              Divisore Annuo<br />(media giornate<br />lavorative)
            </th>
            <th className="border border-black px-2 py-3 uppercase w-24">
              Incidenza per<br />Giornate di Ferie
            </th>
            <th className="border border-black px-2 py-3 uppercase w-20">
              Giornate Ferie<br />Fruite per Anno
            </th>
            <th className="border border-black px-2 py-3 uppercase w-24">
              Incidenza<br />(Totale)
            </th>
            <th className="border border-black px-2 py-3 uppercase w-24">
              INDENNITA'<br />PERCEPITA X<br />gg DI FERIE
            </th>
            <th className="border border-black px-2 py-3 uppercase w-24">
              TOTALE<br />INDENNITA' DA<br />PERCEPIRE X gg<br />DI FERIE
            </th>
            <th className="border border-black px-2 py-3 uppercase w-24">
              INDENNITA'<br />PASTO/TICKET<br />RESTAURANT
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {risultatiAnni.map((row: CalculationResult, index: number) => {
            const rawData = worker.anni.find(a => a.anno === row.anno);
            if (!rawData) return null;

            return (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="border border-black px-2 py-1 font-semibold">{row.anno}</td>
                {/* Totale Voci */}
                <td className="border border-black px-2 py-1">
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none text-[10px]">€</span>
                    <input
                      type="number"
                      step="0.01"
                      value={rawData.totaleVociAccessorie || ''}
                      onChange={(e) => handleInputChange(row.anno, 'totaleVociAccessorie', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#2a3b55]/90 text-white font-bold border-2 border-transparent focus:border-green-400 focus:outline-none rounded-md pl-4 pr-1 py-1 shadow-inner text-right transition-all tracking-wide text-xs"
                    />
                  </div>
                </td>
                {/* Divisore Annuo - NOW EDITABLE */}
                <td className="border border-black px-2 py-1">
                  <input
                    type="number"
                    step="0.1"
                    value={rawData.divisoreAnnuo || ''}
                    onChange={(e) => handleInputChange(row.anno, 'divisoreAnnuo', e.target.value)}
                    placeholder="220"
                    className="w-full bg-[#2a3b55]/90 text-white font-bold border-2 border-transparent focus:border-green-400 focus:outline-none rounded-md px-1 py-1 shadow-inner text-center transition-all tracking-wide text-xs"
                  />
                </td>
                {/* Incidenza Giornaliera (Calculated) */}
                <td className="border border-black px-2 py-1">
                  € {row.incidenzaGiornaliera.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
                {/* Giornate Ferie */}
                <td className="border border-black px-2 py-1">
                  <input
                    type="number"
                    step="0.5"
                    value={rawData.giornateFerieFruite || ''}
                    onChange={(e) => handleInputChange(row.anno, 'giornateFerieFruite', e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#2a3b55]/90 text-white font-bold border-2 border-transparent focus:border-green-400 focus:outline-none rounded-md px-1 py-1 shadow-inner text-center transition-all tracking-wide text-xs"
                  />
                </td>
                {/* Incidenza Totale (Calculated) */}
                <td className="border border-black px-2 py-1 font-bold text-gray-800">
                  € {row.incidenzaTotaleAnno.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
                {/* Indennità Percepita - NEW EDITABLE */}
                <td className="border border-black px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={rawData.indennitaPercepita || ''}
                    onChange={(e) => handleInputChange(row.anno, 'indennitaPercepita', e.target.value)}
                    placeholder="-"
                    className="w-full bg-white text-gray-800 font-medium border border-gray-300 focus:border-blue-500 focus:outline-none rounded-sm px-1 py-1 text-center text-xs"
                  />
                </td>
                {/* Totale Indennità da Percepire - READ ONLY (Calculated) */}
                <td className="border border-black px-2 py-1">
                  <div className="w-full bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-sm px-1 py-1 text-center text-xs">
                    € {row.totaleIndennitaDaPercepire?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '0,00'}
                  </div>
                </td>
                {/* Pasto Ticket - NEW EDITABLE */}
                <td className="border border-black px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={rawData.pastoTicket || ''}
                    onChange={(e) => handleInputChange(row.anno, 'pastoTicket', e.target.value)}
                    placeholder="-"
                    className="w-full bg-white text-gray-800 font-medium border border-gray-300 focus:border-blue-500 focus:outline-none rounded-sm px-1 py-1 text-center text-xs"
                  />
                </td>
              </tr>
            );
          })}

          {/* Totale Dovuto Row */}
          <tr className="font-bold text-sm">
            <td colSpan={5} className="bg-[#70ad47] text-white border border-black px-4 py-3 uppercase text-left tracking-wider">
              Totale Dovuto
            </td>
            <td className="bg-[#70ad47] text-white border border-black px-2 py-3">
              € {totaleComplessivo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </td>
            <td className="bg-white border border-black px-2 py-3 text-black">
              € {worker.anni.reduce((acc, curr) => acc + (curr.indennitaPercepita || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </td>
            <td className="bg-[#ff4d4d] text-white border border-black px-2 py-3">
              € {totaleNettoDaPercepire.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </td>
            <td className="bg-[#70ad47] text-white border border-black px-2 py-3">
              € {totalePasto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
    </div >
  );
};

export default TableComponent;
