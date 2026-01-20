import React, { useState, useEffect } from 'react';
import { Search, TrainFront, Briefcase, Ticket, FileText, Plus, Download, Printer, ArrowLeft, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import TableComponent from './components/TableComponent';
import WorkerCard from './components/WorkerCard';
import WorkerModal from './components/WorkerModal';
import { AnnoDati, Worker } from './types';
import { calcolaTotaleComplessivo } from './utils/calculations';
import { DEFAULT_YEARS_TEMPLATE } from './constants';

// Helper to merge default template with specific data
const createWorkerData = (specificData: Partial<AnnoDati>[]): AnnoDati[] => {
  return DEFAULT_YEARS_TEMPLATE.map(defaultYear => {
    const specific = specificData.find(s => s.anno === defaultYear.anno);
    return specific ? { ...defaultYear, ...specific } : { ...defaultYear };
  });
};

// Default Data for Mario and Laura
const DEFAULT_WORKERS: Worker[] = [
  {
    id: 1,
    nome: "Mario",
    cognome: "Rossi",
    ruolo: "Software Engineer",
    avatarUrl: "https://i.pravatar.cc/150?u=1",
    accentColor: "indigo",
    anni: createWorkerData([
      { anno: 2023, totaleVociAccessorie: 5000.00, divisoreAnnuo: 312, giornateFerieFruite: 20 },
      { anno: 2024, totaleVociAccessorie: 5500.00, divisoreAnnuo: 312, giornateFerieFruite: 22 }
    ])
  },
  {
    id: 2,
    nome: "Laura",
    cognome: "Bianchi",
    ruolo: "UX Designer",
    avatarUrl: "https://i.pravatar.cc/150?u=2",
    accentColor: "green",
    anni: createWorkerData([
      { anno: 2023, totaleVociAccessorie: 4800.00, divisoreAnnuo: 312, giornateFerieFruite: 18 }
    ])
  }
];

const App: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = localStorage.getItem('workers_data');
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_WORKERS;
  });

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter workers based on search query
  // Filter workers based on search query
  const filteredWorkers = workers.filter(worker => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return worker.nome.toLowerCase().startsWith(term) || worker.cognome.toLowerCase().startsWith(term);
  });

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredWorkers.length === 1) {
      handleOpenPratica(filteredWorkers[0].id);
    }
  };

  // Save to localStorage whenever workers change
  useEffect(() => {
    localStorage.setItem('workers_data', JSON.stringify(workers));
  }, [workers]);

  // Update selectedWorker when workers state changes
  useEffect(() => {
    if (selectedWorker) {
      const updated = workers.find(w => w.id === selectedWorker.id);
      if (updated) setSelectedWorker(updated);
    }
  }, [workers, selectedWorker?.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPratica = (workerId: number) => {
    const worker = workers.find(w => w.id === workerId);
    if (worker) setSelectedWorker(worker);
  };

  const handleBack = () => {
    setSelectedWorker(null);
  };

  const handleExportPDF = () => {
    if (!selectedWorker) return;

    const doc = new jsPDF();
    const totals = calcolaTotaleComplessivo(selectedWorker.anni);

    // Header
    doc.setFontSize(18);
    doc.text("Prospetto Analitico Indennità Feriale", 14, 22);

    // Worker Info
    doc.setFontSize(12);
    doc.text(`Dipendente: ${selectedWorker.cognome} ${selectedWorker.nome}`, 14, 32);
    doc.text(`Ruolo: ${selectedWorker.ruolo}`, 14, 38);

    // Table
    const tableData = totals.risultatiAnni.map(r => {
      const originalYear = selectedWorker.anni.find(y => y.anno === r.anno);
      return [
        r.anno,
        `€ ${originalYear?.totaleVociAccessorie.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        originalYear?.divisoreAnnuo,
        `€ ${r.incidenzaGiornaliera.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        originalYear?.giornateFerieFruite,
        `€ ${r.incidenzaTotaleAnno.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        `€ ${r.totaleIndennitaDaPercepire.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Anno', 'Totale Voci', 'Divisore', 'Media/Day', 'Ferie', 'Indennità', 'Netto']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      styles: { fontSize: 10 },
      foot: [[
        'TOTALE',
        '',
        '',
        '',
        '',
        `€ ${totals.totaleComplessivo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        `€ ${totals.totaleNettoDaPercepire.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
      ]],
      footStyles: { fillColor: [240, 244, 255], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // Save
    doc.save(`prospetto_${selectedWorker.cognome.toLowerCase()}_${selectedWorker.nome.toLowerCase()}.pdf`);
  };

  // --- CRUD Operations ---

  const handleOpenAddModal = () => {
    setModalMode('create');
    setEditingWorkerId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (workerId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the details view
    setModalMode('edit');
    setEditingWorkerId(workerId);
    setIsModalOpen(true);
  };

  const handleDeleteWorker = (workerId: number) => {
    const updatedWorkers = workers.filter(w => w.id !== workerId);
    setWorkers(updatedWorkers);
    localStorage.setItem('workers_data', JSON.stringify(updatedWorkers));

    if (selectedWorker?.id === workerId) {
      setSelectedWorker(null);
    }
  };

  const handleSaveWorker = (data: { nome: string; cognome: string; ruolo: string }) => {
    if (modalMode === 'create') {
      const newId = Math.max(...workers.map(w => w.id), 0) + 1;
      const newWorker: Worker = {
        id: newId,
        nome: data.nome,
        cognome: data.cognome,
        ruolo: data.ruolo,
        avatarUrl: `https://i.pravatar.cc/150?u=${newId}`, // Generic placeholder
        accentColor: "blue",
        anni: [...DEFAULT_YEARS_TEMPLATE.map(y => ({ ...y }))] // Deep copy
      };
      setWorkers([...workers, newWorker]);
    } else if (modalMode === 'edit' && editingWorkerId) {
      setWorkers(prev => prev.map(w =>
        w.id === editingWorkerId
          ? { ...w, nome: data.nome, cognome: data.cognome, ruolo: data.ruolo }
          : w
      ));
    }
  };

  const handleUpdateWorkerData = (updatedYears: AnnoDati[]) => {
    if (!selectedWorker) return;

    setWorkers(prevWorkers =>
      prevWorkers.map(w =>
        w.id === selectedWorker.id
          ? { ...w, anni: updatedYears }
          : w
      )
    );
  };

  const getEditingWorkerData = () => {
    if (editingWorkerId) {
      return workers.find(w => w.id === editingWorkerId) || null;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] font-sans selection:bg-indigo-100">
      {/* Dynamic Background Decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none no-print">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-[120px] opacity-60"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 md:px-8 space-y-10">

        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center">
                <TrainFront className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                {selectedWorker ? "Dettaglio Analitico" : "Gestione Indennità Feriale Ferrovieri"}
              </h1>
            </div>
            <p className="text-gray-500 font-medium ml-[52px]">
              {selectedWorker
                ? `Visualizzando il prospetto visuale e analitico.`
                : "Analisi e ricalcolo competenze accessorie per personale di macchina e bordo"}
            </p>
          </div>

          <div className="flex items-center gap-4 ml-[52px] md:ml-0">
            {!selectedWorker && (
              <button
                onClick={handleOpenAddModal}
                className="group flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-400 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg hover:brightness-110 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(34,197,94,0.4)] active:scale-95 border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuovo Lavoratore
              </button>
            )}
            {selectedWorker && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm border border-slate-200 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Torna Indietro
              </button>
            )}
            {selectedWorker && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/30 active:scale-95 border border-red-500"
              >
                <FileText className="h-5 w-5 text-white" />
                Download PDF
              </button>
            )}
            {selectedWorker && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 active:scale-95 border border-indigo-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Stampa
              </button>
            )}
          </div>
        </header>

        {/* Search Bar & Global Stats (Dashboard Only) */}
        {!selectedWorker && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">


            {/* Global Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Stat 1: Practices */}
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex items-center justify-between group hover:border-blue-300/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(59,130,246,0.35)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pratiche Gestite</p>
                  <p className="text-3xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{workers.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50/80 rounded-2xl flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
              </div>

              {/* Stat 2: Total Net */}
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex items-center justify-between group hover:border-emerald-300/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(34,197,94,0.35)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Totale Netto da Erogare</p>
                  <p className="text-3xl font-black text-emerald-600 tracking-tight">
                    € {workers.reduce((acc, w) => acc + calcolaTotaleComplessivo(w.anni).totaleNettoDaPercepire, 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    <span className="text-lg font-bold text-emerald-600/60">.{(workers.reduce((acc, w) => acc + calcolaTotaleComplessivo(w.anni).totaleNettoDaPercepire, 0) % 1).toFixed(2).split('.')[1]}</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-50/80 rounded-2xl flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              {/* Stat 3: Total Tickets */}
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex items-center justify-between group hover:border-orange-300/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(249,115,22,0.35)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Totale Ticket Pasto</p>
                  <p className="text-3xl font-black text-orange-600 tracking-tight">
                    € {workers.reduce((acc, w) => acc + calcolaTotaleComplessivo(w.anni).totalePasto, 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    <span className="text-lg font-bold text-orange-600/60">.{(workers.reduce((acc, w) => acc + calcolaTotaleComplessivo(w.anni).totalePasto, 0) % 1).toFixed(2).split('.')[1]}</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-50/80 rounded-2xl flex items-center justify-center border border-orange-100 group-hover:scale-110 transition-transform duration-300">
                  <Ticket className="w-6 h-6 text-orange-500" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative w-full max-w-xl mx-auto mb-10 group">
              {/* Icona forzata in primo piano con z-10 */}
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Search className="h-5 w-5 text-slate-400" />
              </div>

              <input
                type="text"
                placeholder="Cerca ferroviere per nome e/o cognome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="min-h-[60vh]">
          {selectedWorker ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    {/* Dynamic Icon Avatar for Detail View */}
                    <div className={`w-16 h-16 bg-gradient-to-br from-${selectedWorker.accentColor}-50 to-${selectedWorker.accentColor}-100 rounded-2xl flex items-center justify-center shadow-inner`}>
                      {(() => {
                        const roleLower = selectedWorker.ruolo.toLowerCase();
                        const Icon = (roleLower.includes('macchinista') || roleLower.includes('capotreno') || roleLower.includes('manovratore'))
                          ? TrainFront
                          : Briefcase;
                        return <Icon className={`w-8 h-8 text-${selectedWorker.accentColor}-600 opacity-90`} strokeWidth={1.5} />;
                      })()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Dettaglio Pratica: {selectedWorker.nome} {selectedWorker.cognome}</h2>
                      <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{selectedWorker.ruolo}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Totale Da Percepire</span>
                    <span className="text-2xl font-black text-indigo-600">
                      € {calcolaTotaleComplessivo(selectedWorker.anni).totaleNettoDaPercepire.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <TableComponent
                  worker={selectedWorker}
                  onUpdateWorker={handleUpdateWorkerData}
                />
              </div>
              <div className="mt-4 no-print text-sm text-gray-500 italic bg-white/50 p-4 rounded-xl border border-gray-200/50 backdrop-blur-sm">
                * Nota: I dati visualizzati sono calcolati in base all'incidenza degli elementi accessori sulla retribuzione feriale.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12 pb-12 animate-in fade-in zoom-in-95 duration-500">
              {filteredWorkers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={{
                    ...worker,
                    totaleDovuto: calcolaTotaleComplessivo(worker.anni).totaleNettoDaPercepire
                  }}
                  onOpenPratica={() => handleOpenPratica(worker.id)}
                  onEdit={(e) => handleOpenEditModal(worker.id, e)}
                  onDelete={() => { handleDeleteWorker(worker.id); }}
                />
              ))}
            </div>
          )}
        </main>

        <WorkerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleSaveWorker}
          initialData={getEditingWorkerData()}
          mode={modalMode}
          headerColor={modalMode === 'create' ? 'emerald' : (getEditingWorkerData()?.accentColor || 'blue')}
        />
      </div>
    </div>
  );
};

export default App;
