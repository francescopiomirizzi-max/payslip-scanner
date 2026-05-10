import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Worker, AnnoDati } from '../types';
import { DEFAULT_YEARS_TEMPLATE } from '../constants';
import { triggerConfetti } from '../utils/confetti';

// --- CONFIGURAZIONE ---
const DEFAULT_WORKERS: Worker[] = [
    {
        id: 1,
        nome: "Mario", cognome: "Rossi",
        ruolo: "Operaio Ferroviario", profilo: "RFI",
        accentColor: "blue",
        anni: JSON.parse(JSON.stringify(DEFAULT_YEARS_TEMPLATE))
    }
];

const CARD_COLORS = ['blue', 'indigo', 'emerald', 'orange'];

/**
 * Hook che gestisce tutto lo stato dei lavoratori:
 * CRUD, persistenza localStorage, modali, ricerca/filtri,
 * navigazione e import/export backup.
 */
export const useWorkers = (addToast: (message: string, type: 'success' | 'error' | 'info') => void) => {
    // --- STATO PRINCIPALE ---
    const [workers, setWorkers] = useState<Worker[]>(() => {
        const saved = localStorage.getItem('workers_data');
        return saved ? JSON.parse(saved) : DEFAULT_WORKERS;
    });

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [viewMode, setViewMode] = useState<'home' | 'simple' | 'complex' | 'stats'>('home');

    // --- STATO MODALE CRUD ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
    const [currentWorker, setCurrentWorker] = useState<any>(null);

    // --- STATO ELIMINAZIONE ---
    const [workerToDelete, setWorkerToDelete] = useState<number | null>(null);

    // --- STATO RICERCA E FILTRI ---
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('ALL');
    const [customFilters, setCustomFilters] = useState<string[]>([]);

    // --- STATO IMPORT/EXPORT ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importPendingData, setImportPendingData] = useState<any>(null);

    // Trigger per forzare il ricalcolo quando si torna dalla scheda dettaglio
    const [refreshStats, setRefreshStats] = useState(0);

    // --- EFFETTI ---

    // Persistenza localStorage
    useEffect(() => {
        localStorage.setItem('workers_data', JSON.stringify(workers));
    }, [workers]);

    // Carica filtri custom da localStorage
    useEffect(() => {
        const loadCustomFilters = () => {
            const saved = localStorage.getItem('customCompanies');
            if (saved) {
                try {
                    setCustomFilters(Object.keys(JSON.parse(saved)));
                } catch (e) { }
            }
        };
        loadCustomFilters();
        window.addEventListener('storage', loadCustomFilters);
        return () => window.removeEventListener('storage', loadCustomFilters);
    }, []);

    // --- LOGICA FILTRATA ---
    const filteredWorkers = workers.filter(w => {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${w.nome} ${w.cognome}`.toLowerCase();
        const reverseName = `${w.cognome} ${w.nome}`.toLowerCase();
        const matchesSearch = !searchQuery || fullName.includes(query) || reverseName.includes(query);
        const matchesFilter = activeFilter === 'ALL' || w.profilo === activeFilter;
        return matchesSearch && matchesFilter;
    });

    // --- NAVIGAZIONE ---
    const handleOpenSimple = (id: number) => {
        setSelectedWorker(workers.find(w => w.id === id) || null);
        setViewMode('simple');
    };

    const handleOpenComplex = (id: number) => {
        setSelectedWorker(workers.find(w => w.id === id) || null);
        setViewMode('complex');
    };

    const handleBack = () => {
        setSelectedWorker(null);
        setViewMode('home');
        setRefreshStats(prev => prev + 1);
    };

    // --- CRUD ---
    const openCreateModal = () => {
        setModalMode('create');
        setCurrentWorker(null);
        setEditingWorkerId(null);
        setIsModalOpen(true);
    };

    const openEditModal = (e: React.MouseEvent, idOrWorker: any) => {
        e.stopPropagation();
        const targetId = typeof idOrWorker === 'object' ? idOrWorker.id : idOrWorker;
        const workerToEdit = workers.find(w => w.id === targetId);
        setCurrentWorker(workerToEdit);
        setModalMode('edit');
        setEditingWorkerId(targetId);
        setIsModalOpen(true);
    };

    const handleOpenModal = (mode: 'create' | 'edit', worker: any = null) => {
        setModalMode(mode);
        if (mode === 'edit') {
            setCurrentWorker(worker);
            setEditingWorkerId(worker.id);
        } else {
            setCurrentWorker(null);
            setEditingWorkerId(null);
        }
        setIsModalOpen(true);
    };

    const handleSaveWorker = (data: any) => {
        if (modalMode === 'create') {
            const newId = Math.max(...workers.map(w => w.id), 0) + 1;
            const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
            const newWorker = {
                id: newId, ...data, accentColor: randomColor,
                anni: JSON.parse(JSON.stringify(DEFAULT_YEARS_TEMPLATE))
            };
            setWorkers([...workers, newWorker]);
            addToast("Nuovo lavoratore aggiunto!", "success");
            triggerConfetti();
        } else {
            const currentEditingWorker = workers.find(w => w.id === editingWorkerId);
            const updatedWorker = { ...currentEditingWorker, ...data } as any;
            setWorkers(workers.map(w => w.id === editingWorkerId ? updatedWorker : w));
            setSelectedWorker(prev => (prev && prev.id === editingWorkerId ? updatedWorker : prev));
            addToast("Modifiche salvate con successo.", "success");
        }
        setIsModalOpen(false);
    };

    const handleDeleteWorker = (id: number) => {
        setWorkerToDelete(id);
    };

    const confirmDelete = () => {
        if (workerToDelete !== null) {
            setWorkers(workers.filter(w => w.id !== workerToDelete));
            addToast("Lavoratore eliminato con successo.", "error");
            setWorkerToDelete(null);
        }
    };

    const selectedWorkerId = selectedWorker?.id;

    const handleUpdateWorkerData = useCallback((updatedAnni: AnnoDati[]) => {
        if (!selectedWorkerId) return;
        setWorkers(prevWorkers =>
            prevWorkers.map(w =>
                w.id === selectedWorkerId ? { ...w, anni: updatedAnni } : w
            )
        );
        setSelectedWorker(prevSelected =>
            prevSelected ? { ...prevSelected, anni: updatedAnni } : null
        );
    }, [selectedWorkerId]);

    const handleUpdateStatus = useCallback((status: string) => {
        if (!selectedWorkerId) return;
        setWorkers(prevWorkers =>
            prevWorkers.map(w =>
                w.id === selectedWorkerId ? { ...w, status: status as any } : w
            )
        );
        setSelectedWorker(prevSelected =>
            prevSelected ? { ...prevSelected, status: status as any } : null
        );
    }, [selectedWorkerId]);

    const getEditingWorkerData = () => editingWorkerId ? workers.find(w => w.id === editingWorkerId) : null;

    // --- BACKUP GLOBALE E RIPRISTINO ---
    const handleExportData = async () => {
        const payload: any = {
            version: "2.0",
            workers: workers,
            settings: {}
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('tickets_') || key.startsWith('exFest_') || key.startsWith('startYear_'))) {
                payload.settings[key] = localStorage.getItem(key);
            }
        }

        const dataStr = JSON.stringify(payload, null, 2);
        const nomeFile = `Backup_Completo_Ferrovieri_${new Date().toISOString().slice(0, 10)}.json`;

        try {
            if ('showSaveFilePicker' in window) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: nomeFile,
                    types: [{
                        description: 'File JSON di Backup',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(dataStr);
                await writable.close();
                addToast("Backup Globale salvato con successo!", "success");
                return;
            }

            // --- PIANO B (Per Safari o browser vecchi) ---
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = nomeFile;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                addToast("Backup scaricato (Modalità base)", "success");
            }, 100);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Errore salvataggio:', error);
                addToast("Errore durante il salvataggio", "error");
            }
        }
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsedData = JSON.parse(content);
                let targetWorkers = [];
                let targetSettings = {};

                if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].hasOwnProperty('id')) {
                    targetWorkers = parsedData;
                } else if (parsedData.version === "2.0" && Array.isArray(parsedData.workers)) {
                    targetWorkers = parsedData.workers;
                    targetSettings = parsedData.settings;
                } else {
                    addToast("Il file non è valido.", "error");
                    return;
                }
                setImportPendingData({ workers: targetWorkers, settings: targetSettings } as any);
                setIsImportModalOpen(true);
            } catch (error) {
                addToast("Errore lettura file.", "error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const executeImport = () => {
        if (!importPendingData) return;
        try {
            const workersToImport = importPendingData.workers ? importPendingData.workers : importPendingData;
            setWorkers(workersToImport);
            if (importPendingData.settings) {
                Object.keys(importPendingData.settings).forEach(key => {
                    localStorage.setItem(key, importPendingData.settings[key]);
                });
            }
            setIsImportModalOpen(false);
            setImportPendingData(null);
            addToast("Dati ripristinati con successo!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            addToast("Errore durante il ripristino.", "error");
        }
    };

    return {
        // State
        workers,
        selectedWorker,
        setSelectedWorker,
        viewMode,
        setViewMode,
        filteredWorkers,
        refreshStats,

        // Search & Filters
        searchQuery,
        setSearchQuery,
        activeFilter,
        setActiveFilter,
        customFilters,

        // Modal CRUD
        isModalOpen,
        setIsModalOpen,
        modalMode,
        currentWorker,
        handleOpenModal,
        openCreateModal,
        openEditModal,
        handleSaveWorker,
        getEditingWorkerData,

        // Delete
        workerToDelete,
        setWorkerToDelete,
        handleDeleteWorker,
        confirmDelete,

        // Data Updates
        handleUpdateWorkerData,
        handleUpdateStatus,

        // Navigation
        handleOpenSimple,
        handleOpenComplex,
        handleBack,

        // Import/Export
        fileInputRef,
        isImportModalOpen,
        setIsImportModalOpen,
        importPendingData,
        setImportPendingData,
        handleExportData,
        handleImportData,
        executeImport,
    };
};
