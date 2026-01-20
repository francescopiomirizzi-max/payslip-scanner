import React, { useMemo } from 'react';
import { Worker } from '../types';
import { TrainFront, Briefcase, User, Edit2, Trash2 } from 'lucide-react';
import { DEFAULT_YEARS_TEMPLATE } from '../constants';

interface WorkerCardProps {
  worker: Worker;
  onOpenPratica: (workerId: number) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onOpenPratica, onEdit, onDelete }) => {

  // Dynamic Icon Selection
  const RoleIcon = useMemo(() => {
    const roleLower = worker.ruolo.toLowerCase();
    if (roleLower.includes('macchinista') || roleLower.includes('capotreno') || roleLower.includes('manovratore')) {
      return TrainFront;
    }
    return Briefcase;
  }, [worker.ruolo]);

  // Dynamic Progress Calculation
  const progressPercentage = useMemo(() => {
    const totalYears = DEFAULT_YEARS_TEMPLATE.length;
    // Count years where totalVociAccessorie is > 0
    const filledYears = worker.anni.filter(y => y.totaleVociAccessorie > 0).length;
    return Math.min(Math.round((filledYears / totalYears) * 100), 100);
  }, [worker.anni]);


  // Dynamic shadow classes for "Neon Glow" effect
  const getGlowClass = (color: string) => {
    switch (color) {
      case 'indigo': return 'hover:shadow-[0_20px_50px_rgba(99,102,241,0.4)] border-indigo-100/50';
      case 'emerald': return 'hover:shadow-[0_20px_50px_rgba(16,185,129,0.4)] border-emerald-100/50';
      case 'blue': return 'hover:shadow-[0_20px_50px_rgba(59,130,246,0.4)] border-blue-100/50';
      case 'purple': return 'hover:shadow-[0_20px_50px_rgba(168,85,247,0.4)] border-purple-100/50';
      case 'red': return 'hover:shadow-[0_20px_50px_rgba(239,68,68,0.4)] border-red-100/50';
      case 'orange': return 'hover:shadow-[0_20px_50px_rgba(249,115,22,0.4)] border-orange-100/50';
      default: return 'hover:shadow-[0_20px_50px_rgba(100,116,139,0.4)] border-slate-100/50'; // Slate default
    }
  };

  const shadowClass = getGlowClass(worker.accentColor || 'indigo');

  return (
    <div
      onClick={() => onOpenPratica(worker.id)}
      className={`group relative bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] ${shadowClass} transition-all duration-300 cursor-pointer overflow-hidden border transform hover:-translate-y-2`}
    >
      {/* Decorative Top Accent */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-${worker.accentColor}-600/80`}></div>

      {/* Edit/Delete Actions (Hover only) */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(e);
          }}
          className="p-2 bg-white/90 text-slate-500 hover:text-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all backdrop-blur-sm border border-slate-200"
          title="Modifica"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          className="p-2 bg-white/90 text-slate-500 hover:text-red-600 rounded-lg shadow-sm hover:shadow-md transition-all backdrop-blur-sm border border-slate-200"
          title="Elimina"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 pt-10 flex flex-col items-center">
        {/* Icon Avatar */}
        <div className={`w-20 h-20 bg-gradient-to-br from-${worker.accentColor}-50 to-${worker.accentColor}-100 rounded-2xl flex items-center justify-center shadow-inner mb-5 group-hover:scale-105 transition-transform duration-300`}>
          <RoleIcon className={`w-10 h-10 text-${worker.accentColor}-600 opacity-90`} strokeWidth={1.5} />
        </div>

        {/* Info */}
        <div className="text-center space-y-1 w-full">
          <h3 className="text-xl font-bold text-slate-900 truncate px-2">{worker.nome} {worker.cognome}</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{worker.ruolo}</p>
        </div>

        {/* Stats Divider */}
        <div className="w-full h-px bg-slate-100 my-6"></div>

        {/* Financial Stat */}
        <div className="w-full flex justify-between items-end mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Attuale</span>
          <span className="text-lg font-bold text-slate-800">
            € {(worker.totaleDovuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Completamento</span>
            <span className={`text-[10px] font-bold text-${worker.accentColor}-600`}>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full bg-${worker.accentColor}-500 rounded-full transition-all duration-1000 ease-out`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerCard;
