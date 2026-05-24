import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Worker, AnnoDati } from '../types';
import { DEFAULT_YEARS_TEMPLATE } from '../constants';
import { triggerConfetti } from '../utils/confetti';
import { supabase } from '../supabaseClient';
import { migrateLocalToCloud } from '../utils/migrateFromLocalToCloud';

const CARD_COLORS = ['blue', 'emerald', 'orange', 'rose', 'violet', 'teal'];

function dbToWorker(row: any): Worker {
    return {
        id: row.id,
        nome: row.nome,
        cognome: row.cognome,
        ruolo: row.ruolo,
        profilo: row.profilo,
        eliorType: row.elior_type ?? undefined,
        status: row.status ?? undefined,
        accentColor: row.accent_color ?? 'blue',
        avatarUrl: row.avatar_url ?? undefined,
        notes: row.notes ?? undefined,
        profiloProfessionale: row.profilo_professionale ?? undefined,
        tfr_pregresso: row.tfr_pregresso ?? undefined,
        tfr_pregresso_anno: row.tfr_pregresso_anno ?? undefined,
        startClaimYear: row.start_claim_year ?? undefined,
        includeExFest: row.include_ex_fest ?? undefined,
        includeTickets: row.include_tickets ?? undefined,
        reportShowPercepito: row.report_show_percepito ?? undefined,
        anni: row.anni ?? [],
        created_at: row.created_at ?? undefined,
    };
}

function workerToDb(worker: Worker, ownerId: string): object {
    return {
        id: worker.id,
        owner_id: ownerId,
        nome: worker.nome,
        cognome: worker.cognome,
        ruolo: worker.ruolo,
        profilo_professionale: worker.profiloProfessionale ?? null,
        profilo: worker.profilo,
        elior_type: worker.eliorType ?? null,
        status: worker.status ?? null,
        accent_color: worker.accentColor ?? 'blue',
        avatar_url: worker.avatarUrl ?? null,
        notes: worker.notes ?? null,
        tfr_pregresso: worker.tfr_pregresso ?? null,
        tfr_pregresso_anno: worker.tfr_pregresso_anno ?? null,
        start_claim_year: worker.startClaimYear ?? null,
        include_ex_fest: worker.includeExFest ?? null,
        include_tickets: worker.includeTickets ?? null,
        report_show_percepito: worker.reportShowPercepito ?? null,
        anni: worker.anni,
    };
}

type AddToast = (
    message: string,
    type?: 'success' | 'error' | 'info',
    options?: { action?: { label: string; onClick: () => void }; duration?: number }
) => number | void;

export const useWorkers = (addToast: AddToast) => {
    // --- STATO PRINCIPALE ---
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isWorkersLoading, setIsWorkersLoading] = useState(true);
    const [authUser, setAuthUser] = useState<any>(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [viewMode, setViewMode] = useState<'home' | 'simple' | 'complex' | 'stats' | 'archive'>('home');
    const [archiveWorkerId, setArchiveWorkerId] = useState<string | null>(null);

    // --- STATO MODALE CRUD ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
    const [currentWorker, setCurrentWorker] = useState<any>(null);

    // --- STATO ELIMINAZIONE ---
    // Mappa id → timer dei delete ottimistici in attesa della finestra di undo (5s).
    // Permette di annullare la cancellazione DB se l'utente clicca "Annulla" nel toast.
    const pendingDeleteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // --- ID DELLA PRATICA APPENA CREATA ---
    // La Dashboard reagisce per espandere il cassetto giusto e portare la card in vista
    // appena dopo la creazione. Si auto-azzera dopo 3s.
    const [recentlyCreatedId, setRecentlyCreatedId] = useState<string | null>(null);
    const recentlyCreatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- STATO RICERCA E FILTRI ---
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('ALL');
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
    const [customFilters, setCustomFilters] = useState<string[]>([]);

    // --- STATO IMPORT/EXPORT ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importPendingData, setImportPendingData] = useState<any>(null);

    const [refreshStats, setRefreshStats] = useState(0);

    // --- REFS SYNC ---
    const prevWorkersRef = useRef<Worker[]>([]);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedUserIdRef = useRef<string | null>(null);

    // --- OSSERVA AUTH ---
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setAuthUser(user);
            setAuthInitialized(true);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            setAuthUser(session?.user ?? null);
            setAuthInitialized(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    // --- CARICA DAL DB QUANDO L'UTENTE È PRONTO ---
    // Wait for auth to be initialized before reacting to authUser.
    // loadedUserIdRef guards against double-fire: getUser() + onAuthStateChange
    // both call setAuthUser on startup with different object references but the same user ID.
    useEffect(() => {
        if (!authInitialized) return;
        if (authUser === null) {
            setIsWorkersLoading(false);
            loadedUserIdRef.current = null;
            return;
        }
        if (loadedUserIdRef.current === authUser.id) return;
        loadedUserIdRef.current = authUser.id;
        loadWorkers(authUser.id);
    }, [authUser, authInitialized]);

    const loadWorkers = async (userId: string) => {
        setIsWorkersLoading(true);

        // Migrazione one-time da localStorage
        const migrated = await migrateLocalToCloud(userId);
        if (migrated) addToast('Dati migrati nel cloud con successo!', 'success');

        const { data, error } = await supabase
            .from('worker_profiles')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Workers] Load error:', error);
            addToast('Errore durante il caricamento dei lavoratori.', 'error');
            setIsWorkersLoading(false);
            return;
        }

        const list = (data ?? []).map(dbToWorker);
        setWorkers(list);
        prevWorkersRef.current = list;
        setIsWorkersLoading(false);
    };

    // --- FILTRI AZIENDE CUSTOM ---
    useEffect(() => {
        const loadCustomFilters = () => {
            const saved = localStorage.getItem('customCompanies');
            if (saved) {
                try { setCustomFilters(Object.keys(JSON.parse(saved))); } catch {}
            }
        };
        loadCustomFilters();
        window.addEventListener('storage', loadCustomFilters);
        return () => window.removeEventListener('storage', loadCustomFilters);
    }, []);

    // --- AUTO-SYNC DEBOUNCED ---
    useEffect(() => {
        if (!authUser || isWorkersLoading) return;

        const prev = prevWorkersRef.current;
        const changed = workers.filter(w => {
            const old = prev.find(p => p.id === w.id);
            return !old || JSON.stringify(old) !== JSON.stringify(w);
        });

        if (changed.length === 0) return;
        prevWorkersRef.current = [...workers];

        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(async () => {
            for (const w of changed) {
                const { error } = await supabase
                    .from('worker_profiles')
                    .upsert(workerToDb(w, authUser.id), { onConflict: 'id' });
                if (error) console.error('[Workers] Sync error for', w.id, error);
            }
        }, 1500);
    }, [workers]);

    // --- FILTRI ---
    const matchesStatusFilter = (status: string | undefined, filter: string): boolean => {
        if (filter === 'ALL') return true;
        if (filter === 'analisi') return !status || status === 'aperta' || status === 'in_corso';
        if (filter === 'in_corso') return status !== 'chiusa';
        return status === filter;
    };

    const filteredWorkers = workers.filter(w => {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${w.nome} ${w.cognome}`.toLowerCase();
        const reverseName = `${w.cognome} ${w.nome}`.toLowerCase();
        const matchesSearch = !searchQuery || fullName.includes(query) || reverseName.includes(query);
        const matchesFilter = activeFilter === 'ALL' || w.profilo === activeFilter;
        const matchesStatus = matchesStatusFilter(w.status, activeStatusFilter);
        return matchesSearch && matchesFilter && matchesStatus;
    });

    // --- NAVIGAZIONE ---
    const handleOpenSimple = (id: string) => {
        setSelectedWorker(workers.find(w => w.id === id) || null);
        setViewMode('simple');
    };

    const handleOpenComplex = (id: string) => {
        setSelectedWorker(workers.find(w => w.id === id) || null);
        setViewMode('complex');
    };

    const handleBack = () => {
        setSelectedWorker(null);
        setViewMode('home');
        setRefreshStats(prev => prev + 1);
    };

    const handleOpenArchive = (id: string) => {
        setArchiveWorkerId(id);
        setViewMode('archive');
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
        setCurrentWorker(workers.find(w => w.id === targetId));
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
            const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
            const newWorker: Worker = {
                id: crypto.randomUUID(),
                ...data,
                accentColor: randomColor,
                anni: JSON.parse(JSON.stringify(DEFAULT_YEARS_TEMPLATE)),
                // created_at locale provvisorio: serve a far apparire la card in cima
                // quando il sort è per data; Supabase poi imposta il valore definitivo
                // server-side al primo upsert, e dbToWorker lo recupera al prossimo load.
                created_at: new Date().toISOString(),
            };
            // Prepend: la nuova card va in cima all'array (la Dashboard ne tiene conto
            // sia per il sort di default sia per il routing nel cassetto "Da Analizzare").
            setWorkers(prev => [newWorker, ...prev]);
            setRecentlyCreatedId(newWorker.id);
            if (recentlyCreatedTimerRef.current) clearTimeout(recentlyCreatedTimerRef.current);
            recentlyCreatedTimerRef.current = setTimeout(() => setRecentlyCreatedId(null), 3000);
            addToast('Nuovo lavoratore aggiunto!', 'success');
            triggerConfetti();
        } else {
            const base = workers.find(w => w.id === editingWorkerId);
            const updated = { ...base, ...data } as Worker;
            setWorkers(prev => prev.map(w => w.id === editingWorkerId ? updated : w));
            setSelectedWorker(prev => prev?.id === editingWorkerId ? updated : prev);
            addToast('Modifiche salvate con successo.', 'success');
        }
        setIsModalOpen(false);
    };

    // Optimistic delete con finestra di undo di 5s.
    // Flusso: rimozione immediata dalla UI → toast con bottone "Annulla" →
    // se l'utente annulla, ripristino e niente chiamata DB; altrimenti, scaduto
    // il timer, cancellazione effettiva su Supabase (con restore se il DB fallisce).
    const handleDeleteWorker = (id: string) => {
        if (!authUser) return;
        const worker = workers.find(w => w.id === id);
        if (!worker) return;

        const restoreWorker = () => {
            setWorkers(prev => {
                if (prev.find(w => w.id === worker.id)) return prev;
                const next = [...prev, worker].sort((a, b) => {
                    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return aT - bT;
                });
                prevWorkersRef.current = next;
                return next;
            });
        };

        // 1. Rimozione ottimistica dalla UI
        setWorkers(prev => {
            const next = prev.filter(w => w.id !== id);
            prevWorkersRef.current = next;
            return next;
        });

        // 2. Cancellazione DB schedulata dopo la finestra di undo
        const timer = setTimeout(async () => {
            pendingDeleteTimersRef.current.delete(id);
            const { error } = await supabase
                .from('worker_profiles')
                .delete()
                .eq('id', id);
            if (error) {
                console.error('[Workers] Delete error:', error);
                addToast("Errore durante l'eliminazione dal database. Pratica ripristinata.", 'error');
                restoreWorker();
            }
        }, 5000);
        pendingDeleteTimersRef.current.set(id, timer);

        // 3. Toast con azione di annullamento
        addToast(
            `Pratica di ${worker.nome} ${worker.cognome} eliminata`,
            'info',
            {
                duration: 5000,
                action: {
                    label: 'Annulla',
                    onClick: () => {
                        const pendingTimer = pendingDeleteTimersRef.current.get(id);
                        if (pendingTimer) clearTimeout(pendingTimer);
                        pendingDeleteTimersRef.current.delete(id);
                        restoreWorker();
                        addToast('Eliminazione annullata.', 'success');
                    },
                },
            }
        );
    };

    const selectedWorkerId = selectedWorker?.id;

    const handleUpdateWorkerData = useCallback((updatedAnni: AnnoDati[]) => {
        if (!selectedWorkerId) return;
        setWorkers(prev => prev.map(w => w.id === selectedWorkerId ? { ...w, anni: updatedAnni } : w));
        setSelectedWorker(prev => prev ? { ...prev, anni: updatedAnni } : null);
    }, [selectedWorkerId]);

    const handleUpdateStatus = useCallback((status: string) => {
        if (!selectedWorkerId) return;
        setWorkers(prev => prev.map(w => w.id === selectedWorkerId ? { ...w, status: status as any } : w));
        setSelectedWorker(prev => prev ? { ...prev, status: status as any } : null);
    }, [selectedWorkerId]);

    const handleUpdateWorkerFields = useCallback((fields: Partial<Worker>) => {
        if (!selectedWorkerId) return;
        setWorkers(prev => prev.map(w => w.id === selectedWorkerId ? { ...w, ...fields } : w));
        setSelectedWorker(prev => prev ? { ...prev, ...fields } : null);
    }, [selectedWorkerId]);

    const updateWorkerById = useCallback((id: string, fields: Partial<Worker>) => {
        setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...fields } : w));
    }, []);

    const getEditingWorkerData = () => editingWorkerId ? workers.find(w => w.id === editingWorkerId) : null;

    // --- BACKUP / RIPRISTINO ---
    const handleExportData = async () => {
        const payload: any = { version: '2.0', workers, settings: {} };
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('tickets_') || key.startsWith('exFest_') || key.startsWith('startYear_') || key.startsWith('report_exfest_') || key.startsWith('report_percepito_'))) {
                payload.settings[key] = localStorage.getItem(key);
            }
        }
        const dataStr = JSON.stringify(payload, null, 2);
        const nomeFile = `Backup_RailFlow_${new Date().toISOString().slice(0, 10)}.json`;
        try {
            if ('showSaveFilePicker' in window) {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: nomeFile,
                    types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(dataStr);
                await writable.close();
                addToast('Backup salvato con successo!', 'success');
                return;
            }
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nomeFile;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            addToast('Backup scaricato.', 'success');
        } catch (err: any) {
            if (err.name !== 'AbortError') addToast('Errore durante il salvataggio.', 'error');
        }
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                let targetWorkers: any[] = [];
                let targetSettings: Record<string, string> = {};
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
                    targetWorkers = parsed;
                } else if (parsed.version === '2.0' && Array.isArray(parsed.workers)) {
                    targetWorkers = parsed.workers;
                    targetSettings = parsed.settings || {};
                } else {
                    addToast('Il file non è valido.', 'error'); return;
                }
                setImportPendingData({ workers: targetWorkers, settings: targetSettings });
                setIsImportModalOpen(true);
            } catch {
                addToast('Errore lettura file.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const executeImport = async () => {
        if (!importPendingData || !authUser) return;
        try {
            const source: any[] = importPendingData.workers || importPendingData;
            const withUUIDs: Worker[] = source.map((w: any) => ({
                ...w,
                id: crypto.randomUUID(),
                anni: w.anni || [],
            }));
            const { error } = await supabase
                .from('worker_profiles')
                .insert(withUUIDs.map(w => workerToDb(w, authUser.id)));
            if (error) {
                console.error('[Import] Error:', error);
                addToast("Errore durante l'importazione.", 'error');
                return;
            }
            if (importPendingData.settings) {
                Object.keys(importPendingData.settings).forEach(key => {
                    localStorage.setItem(key, importPendingData.settings[key]);
                });
            }
            await loadWorkers(authUser.id);
            setIsImportModalOpen(false);
            setImportPendingData(null);
            addToast('Dati importati con successo!', 'success');
        } catch {
            addToast('Errore durante il ripristino.', 'error');
        }
    };

    return {
        // State
        workers,
        isWorkersLoading,
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
        activeStatusFilter,
        setActiveStatusFilter,
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
        handleDeleteWorker,

        // Recently created (Dashboard reagisce per aprire il cassetto e portare in vista)
        recentlyCreatedId,

        // Data Updates
        handleUpdateWorkerData,
        handleUpdateStatus,
        handleUpdateWorkerFields,
        updateWorkerById,

        // Navigation
        handleOpenSimple,
        handleOpenComplex,
        handleBack,
        archiveWorkerId,
        handleOpenArchive,

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
