import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

// UI Components
import DynamicIsland from './components/DynamicIsland';
import WorkerModal from './components/WorkerModal';
import QRScannerModal from './components/QRScannerModal';
import LoginPage from './pages/LoginPage';
import CompanyBuilder from './components/CompanyBuilder';
import Background from './components/Background';
import AppRouter from './components/AppRouter';
import AreaSwitch, { type AppArea } from './components/AreaSwitch';
import RiposiArea from './components/RiposiArea';
import HiddenClasses from './HiddenClasses';

// UI Utils
import { triggerConfetti } from './utils/confetti';
import { Toast, ToastData } from './components/ui/Toast';
import { ConfirmImportModal } from './components/ui/ConfirmImportModal';
import { ChangePasswordModal } from './components/ui/ChangePasswordModal';
import { KeyboardShortcutsHint } from './components/ui/KeyboardShortcutsHint';

// Config
import { SYSTEM_PROFILES, getCustomColorIndex } from './config/profiles';

// Context & Hooks
import { useIsland } from './IslandContext';
import { useTheme } from './hooks/useTheme';
import { useWorkers } from './hooks/useWorkers';
import { useAuth } from './hooks/useAuth';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useHashRoute } from './hooks/useHashRoute';

const App: React.FC = () => {
    const { isDarkMode, toggleTheme } = useTheme();

    // (Routing mobile gestito in index.tsx con lazy split, così il telefono non
    // scarica l'intera App.)

    // --- TOASTS ---
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const addToast = (
        message: string,
        type: 'success' | 'error' | 'info' = 'success',
        options: { action?: { label: string; onClick: () => void }; duration?: number } = {}
    ): number => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, action: options.action }]);
        // Gli errori senza duration esplicita restano finché l'utente non li chiude:
        // 3 secondi non bastano per leggere (e reagire a) un messaggio di errore.
        const duration = options.duration ?? (type === 'error' ? null : 3000);
        if (duration !== null) {
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
        }
        return id;
    };

    // --- HOOKS CORI ---
    const {
        workers, isWorkersLoading, selectedWorker, viewMode, setViewMode,
        filteredWorkers, refreshStats,
        searchQuery, setSearchQuery, activeFilter, setActiveFilter, activeStatusFilter, setActiveStatusFilter, customFilters,
        isModalOpen, setIsModalOpen, modalMode, currentWorker,
        handleOpenModal, openEditModal, handleSaveWorker,
        handleDeleteWorker, handleDeleteWorkersBulk, recentlyCreatedId,
        handleUpdateWorkerData, handleUpdateStatus, handleUpdateWorkerFields, updateWorkerById,
        handleOpenSimple, handleOpenComplex, handleBack, archiveWorkerId, handleOpenArchive,
        fileInputRef, isImportModalOpen, setIsImportModalOpen, importPendingData, setImportPendingData,
        handleExportData, handleImportData, executeImport,
    } = useWorkers(addToast);

    const { isAuthenticated, isLoading, loginEmail, setLoginEmail, loginPassword, setLoginPassword, loginError, handleLogin, handleLogout } = useAuth(setViewMode);
    const { setQuickActions } = useIsland();

    // --- MODALI SETTINGS ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCompanyBuilderOpen, setIsCompanyBuilderOpen] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [activeStatsModal, setActiveStatsModal] = useState<'net' | 'ticket' | null>(null);

    const [showScrollTop, setShowScrollTop] = useState(false);

    // --- AREA GLOBALE: 'incidenza' (buste/RFI) vs 'riposi' (mancati riposi TPL) ---
    const [area, setArea] = useState<AppArea>('incidenza');

    // --- URL SYNC (hash routing) ---
    // Back/Forward del browser, F5 e deep link (#/worker/:id, #/archive, ...)
    // riportano alla vista giusta invece di buttare fuori dall'app.
    useHashRoute({
        isReady: isAuthenticated && !isWorkersLoading,
        area,
        viewMode,
        selectedWorkerId: selectedWorker?.id ?? null,
        archiveWorkerId: archiveWorkerId ?? null,
        workerExists: (id) => workers.some(w => w.id === id),
        setArea,
        setViewMode,
        openComplex: handleOpenComplex,
        openSimple: handleOpenSimple,
        openArchive: handleOpenArchive,
        goHome: handleBack,
    });

    // --- SCROLL TO TOP ---
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- TITOLO TAB DINAMICO ---
    // Con più tab aperte su pratiche diverse ci si orienta dalla barra del browser.
    useEffect(() => {
        const base = 'RailFlow';
        let title = `${base} — Gestionale Ferrovieri`;
        if (area === 'riposi') title = `Turni & Riposi · ${base}`;
        else if (viewMode === 'stats') title = `Statistiche · ${base}`;
        else if (viewMode === 'archive') title = `Archivio · ${base}`;
        else if ((viewMode === 'complex' || viewMode === 'simple') && selectedWorker)
            title = `${selectedWorker.cognome} ${selectedWorker.nome} · ${base}`;
        document.title = title;
    }, [area, viewMode, selectedWorker]);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    // --- DYNAMIC ISLAND SYNC ---
    useEffect(() => {
        if (viewMode === 'home' || viewMode === 'stats' || viewMode === 'archive') {
            setQuickActions(false);
        }
    }, [viewMode, setQuickActions]);

    useEffect(() => {
        const handleTheme = () => toggleTheme();
        const handleCompany = () => setIsCompanyBuilderOpen(true);
        const handleSettings = () => setIsSettingsOpen(true);
        const handleLogoutEvent = () => handleLogout();
        const handleExportIsland = () => handleExportData();
        const handleOpenFromIsland = (e: any) => handleOpenComplex(e.detail);
        const handleArchiveIsland = () => setViewMode('archive');

        window.addEventListener('island-theme', handleTheme);
        window.addEventListener('island-company', handleCompany);
        window.addEventListener('island-settings', handleSettings);
        window.addEventListener('island-logout', handleLogoutEvent);
        window.addEventListener('island-open-worker', handleOpenFromIsland);
        window.addEventListener('island-export', handleExportIsland);
        window.addEventListener('island-archive', handleArchiveIsland);

        return () => {
            window.removeEventListener('island-theme', handleTheme);
            window.removeEventListener('island-company', handleCompany);
            window.removeEventListener('island-settings', handleSettings);
            window.removeEventListener('island-logout', handleLogoutEvent);
            window.removeEventListener('island-open-worker', handleOpenFromIsland);
            window.removeEventListener('island-export', handleExportIsland);
            window.removeEventListener('island-archive', handleArchiveIsland);
        };
    }, [isDarkMode, toggleTheme, setIsCompanyBuilderOpen, setIsSettingsOpen, handleLogout, handleOpenComplex, handleExportData, setViewMode]);

    const { dashboardStats, statsList, modalConfig, netCreditMap } = useDashboardStats(workers, refreshStats, activeStatsModal);

    // --- STILI BOTTONI E ANIMAZIONI ---
    const getFilterStyle = (filterId: string, isActive: boolean) => {
        if (!isActive) return "bg-white/40 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/50 border border-white/40 dark:border-slate-700 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5";
        
        if (filterId === 'ALL') return 'bg-slate-800 text-white shadow-lg shadow-slate-500/30 ring-2 ring-slate-400 scale-105 border-transparent';

        // Profili di sistema → registro centralizzato
        if (SYSTEM_PROFILES[filterId]) return SYSTEM_PROFILES[filterId].badge.filter;

        // Aziende custom → palette deterministica via hash condiviso
        const customPalette = [
            'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/40 ring-2 ring-fuchsia-300 scale-105 border-transparent',
            'bg-violet-500 text-white shadow-lg shadow-violet-500/40 ring-2 ring-violet-300 scale-105 border-transparent',
            'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-300 scale-105 border-transparent',
            'bg-rose-500 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-300 scale-105 border-transparent',
            'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-300 scale-105 border-transparent',
            'bg-teal-500 text-white shadow-lg shadow-teal-500/40 ring-2 ring-teal-300 scale-105 border-transparent'
        ];
        return customPalette[getCustomColorIndex(filterId)];
    };

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50, damping: 15 } }, exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } } };

    // --- GESTIONE MOBILE SCAN ---
    const handleMobileScanSuccess = (_data: any) => {
        addToast("Busta Paga ricevuta dal telefono!", "success");
        triggerConfetti();
    };

    // --- MAIN RENDER LOGIC ---
    if (isLoading || isWorkersLoading) return (
        <>
        <DynamicIsland workers={[]} />
        <div className="min-h-screen bg-white dark:bg-slate-900 font-sans px-6 py-10">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-9 w-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                            <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {[120, 110, 150].map((w, i) => (
                            <div key={i} className="h-11 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" style={{ width: w }} />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="h-56 bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-[2.5rem] animate-pulse p-8 flex flex-col justify-between">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700/50" />
                            <div className="space-y-3">
                                <div className="h-3 w-28 rounded-lg bg-slate-100 dark:bg-slate-700/50" />
                                <div className="h-14 w-36 rounded-2xl bg-slate-100 dark:bg-slate-700/50" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="h-20 max-w-4xl mx-auto bg-white dark:bg-slate-800/60 rounded-[2.5rem] animate-pulse border border-slate-100 dark:border-slate-700/60" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-80 bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-[2.5rem] animate-pulse p-7 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-20 rounded-lg bg-slate-100 dark:bg-slate-700/50" />
                                    <div className="h-5 w-32 rounded-lg bg-slate-100 dark:bg-slate-700/50" />
                                </div>
                            </div>
                            <div className="h-7 w-28 rounded-full bg-slate-100 dark:bg-slate-700/50" />
                            <div className="flex gap-2">
                                <div className="h-8 w-20 rounded-xl bg-slate-100 dark:bg-slate-700/50" />
                                <div className="h-8 w-24 rounded-xl bg-slate-100 dark:bg-slate-700/50" />
                            </div>
                            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700/50 mt-auto" />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/50" />
                                <div className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/50" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        </>
    );
    if (!isAuthenticated) return <LoginPage loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPassword={loginPassword} setLoginPassword={setLoginPassword} loginError={loginError} handleLogin={handleLogin} />;

    return (
        <div className="min-h-screen font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 relative overflow-hidden transition-colors duration-500">
            <HiddenClasses />
            <DynamicIsland workers={workers} />
            <KeyboardShortcutsHint />
            <Background />

            {area === 'incidenza' && <AppRouter
                viewMode={viewMode}
                workers={workers}
                filteredWorkers={filteredWorkers}
                dashboardStats={dashboardStats}
                statsList={statsList}
                modalConfig={modalConfig}
                netCreditMap={netCreditMap}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                activeStatusFilter={activeStatusFilter}
                setActiveStatusFilter={setActiveStatusFilter}
                customFilters={customFilters}
                activeStatsModal={activeStatsModal}
                setActiveStatsModal={setActiveStatsModal}
                showScrollTop={showScrollTop}
                scrollToTop={scrollToTop}
                containerVariants={containerVariants}
                itemVariants={itemVariants}
                getFilterStyle={getFilterStyle}
                handleOpenSimple={handleOpenSimple}
                handleOpenComplex={handleOpenComplex}
                openEditModal={openEditModal}
                handleDeleteWorker={handleDeleteWorker}
                handleDeleteWorkersBulk={handleDeleteWorkersBulk}
                recentlyCreatedId={recentlyCreatedId}
                handleOpenModal={handleOpenModal}
                updateWorkerById={updateWorkerById}
                fileInputRef={fileInputRef}
                handleExportData={handleExportData}
                handleImportData={handleImportData}
                setViewMode={setViewMode}
                selectedWorker={selectedWorker}
                handleUpdateWorkerData={handleUpdateWorkerData}
                handleUpdateStatus={handleUpdateStatus}
                handleUpdateWorkerFields={handleUpdateWorkerFields}
                handleBack={handleBack}
                archiveWorkerId={archiveWorkerId}
                handleOpenArchive={handleOpenArchive}
                addToast={addToast}
            />}

            {area === 'riposi' && <RiposiArea />}

            <AreaSwitch area={area} onChange={setArea} />

            {/* MODALS AND TOASTS */}
            {/* Toast in alto a destra: il basso-destra è dei bottoni fissi (scroll-top,
                scorciatoie) e i toast — ora anche persistenti per gli errori — non
                devono coprirli. In alto al centro c'è l'isola (z-9999, sta sopra). */}
            <div className="fixed top-6 right-4 z-[110] flex flex-col items-end pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <div key={toast.id} className="pointer-events-auto">
                            <Toast message={toast.message} type={toast.type} action={toast.action} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            <WorkerModal
                key={currentWorker ? `worker-${currentWorker.id}` : 'new-worker'}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleSaveWorker}
                mode={modalMode}
                initialData={currentWorker}
            />

            <QRScannerModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} onScanSuccess={handleMobileScanSuccess} />

            <AnimatePresence>
                {isImportModalOpen && importPendingData !== null && (
                    <ConfirmImportModal
                        isOpen={true}
                        count={importPendingData.workers ? importPendingData.workers.length : importPendingData.length}
                        onClose={() => { setIsImportModalOpen(false); setImportPendingData(null); }}
                        onConfirm={executeImport}
                    />
                )}
            </AnimatePresence>

            <ChangePasswordModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <CompanyBuilder isOpen={isCompanyBuilderOpen} onClose={() => setIsCompanyBuilderOpen(false)} />
        </div>
    );
};

export default App;