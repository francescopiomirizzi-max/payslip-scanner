import React, { useState, useEffect } from 'react';

interface WorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { nome: string; cognome: string; ruolo: string }) => void;
    initialData?: { nome: string; cognome: string; ruolo: string } | null;
    mode: 'create' | 'edit';
    headerColor?: string;
}

const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onConfirm, initialData, mode, headerColor = 'blue' }) => {
    const [nome, setNome] = useState('');
    const [cognome, setCognome] = useState('');
    const [ruolo, setRuolo] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            setNome(initialData.nome);
            setCognome(initialData.cognome);
            setRuolo(initialData.ruolo);
        } else if (isOpen) {
            setNome('');
            setCognome('');
            setRuolo('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ nome, cognome, ruolo });
        onClose();
    };

    const isFormValid = nome.trim() && cognome.trim() && ruolo.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`px-6 py-4 bg-${headerColor}-600`}>
                    <h2 className="text-xl font-bold text-white">
                        {mode === 'create' ? 'Nuovo Lavoratore' : 'Modifica Lavoratore'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                        <input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${headerColor}-500 focus:border-transparent outline-none transition-all`}
                            placeholder="Es. Mario"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cognome</label>
                        <input
                            type="text"
                            value={cognome}
                            onChange={(e) => setCognome(e.target.value)}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${headerColor}-500 focus:border-transparent outline-none transition-all`}
                            placeholder="Es. Rossi"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ruolo / Qualifica</label>
                        <input
                            type="text"
                            value={ruolo}
                            onChange={(e) => setRuolo(e.target.value)}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${headerColor}-500 focus:border-transparent outline-none transition-all`}
                            placeholder="Es. Software Engineer"
                        />
                    </div>

                    <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={!isFormValid}
                            className={`flex-1 px-4 py-2 text-white bg-${headerColor}-600 hover:bg-${headerColor}-700 rounded-xl font-bold shadow-lg shadow-${headerColor}-500/30 transition-all disabled:opacity-50 disabled:shadow-none`}
                        >
                            {mode === 'create' ? 'Conferma Creazione' : 'Salva Modifiche'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorkerModal;
