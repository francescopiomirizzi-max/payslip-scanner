import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

// UI Components
import DynamicIsland from './components/DynamicIsland';
import WorkerModal from './components/WorkerModal';
import QRScannerModal from './components/QRScannerModal';
import MobileUploadPage from './pages/MobileUploadPage';
import LoginPage from './pages/LoginPage';
import CompanyBuilder from './components/CompanyBuilder';
import Background from './components/Background';
import AppRouter from './components/AppRouter';
import HiddenClasses from './HiddenClasses';

// UI Utils
import { triggerConfetti } from './utils/confetti';
import { Toast } from './components/ui/Toast';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { ConfirmImportModal } from './components/ui/ConfirmImportModal';
import { ChangePasswordModal } from './components/ui/ChangePasswordModal';

// Context & Hooks
import { useIsland } from './IslandContext';
import { useTheme } from './hooks/useTheme';
import { useWorkers } from './hooks/useWorkers';
import { useAuth } from './hooks/useAuth';
import { useDashboardStats } from './hooks/useDashboardStats';

const App: React.FC = () => {
    const { isDarkMode, toggleTheme } = useTheme();

    // --- ROUTING MOBILE ---
    const [isMobileMode, setIsMobileMode] = useState(false);
    const [mobileSessionId, setMobileSessionId] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const isMobile = params.get('mobile') === 'true';
        const session = params.get('session');

        if (isMobile && session) {
            setIsMobileMode(true);
            setMobileSessionId(session);
        }
    }, []);

    // --- TOASTS ---
    const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    // --- HOOKS CORI ---
    const {
        workers, selectedWorker, viewMode, setViewMode,
        filteredWorkers, refreshStats,
        searchQuery, setSearchQuery, activeFilter, setActiveFilter, customFilters,
        isModalOpen, setIsModalOpen, modalMode, currentWorker,
        handleOpenModal, openEditModal, handleSaveWorker,
        workerToDelete, setWorkerToDelete, handleDeleteWorker, confirmDelete,
        handleUpdateWorkerData, handleUpdateStatus,
        handleOpenSimple, handleOpenComplex, handleBack,
        fileInputRef, isImportModalOpen, setIsImportModalOpen, importPendingData, setImportPendingData,
        handleExportData, handleImportData, executeImport,
    } = useWorkers(addToast);

    const { isAuthenticated, loginPassword, setLoginPassword, loginError, handleLogin, handleLogout } = useAuth(setViewMode);
    const { setQuickActions } = useIsland();

    // --- MODALI SETTINGS ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCompanyBuilderOpen, setIsCompanyBuilderOpen] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [activeStatsModal, setActiveStatsModal] = useState<'net' | 'ticket' | null>(null);

    const [showScrollTop, setShowScrollTop] = useState(false);

    // --- SCROLL TO TOP ---
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    // --- DYNAMIC ISLAND SYNC ---
    useEffect(() => {
        if (viewMode === 'home' || viewMode === 'stats') {
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

        window.addEventListener('island-theme', handleTheme);
        window.addEventListener('island-company', handleCompany);
        window.addEventListener('island-settings', handleSettings);
        window.addEventListener('island-logout', handleLogoutEvent);
        window.addEventListener('island-open-worker', handleOpenFromIsland);
        window.addEventListener('island-export', handleExportIsland);

        return () => {
            window.removeEventListener('island-theme', handleTheme);
            window.removeEventListener('island-company', handleCompany);
            window.removeEventListener('island-settings', handleSettings);
            window.removeEventListener('island-logout', handleLogoutEvent);
            window.removeEventListener('island-open-worker', handleOpenFromIsland);
            window.removeEventListener('island-export', handleExportIsland);
        };
    }, [isDarkMode, toggleTheme, setIsCompanyBuilderOpen, setIsSettingsOpen, handleLogout, handleOpenComplex, handleExportData]);

    const { dashboardStats, statsList, modalConfig } = useDashboardStats(workers, refreshStats, activeStatsModal);

    // --- STILI BOTTONI E ANIMAZIONI ---
    const getFilterStyle = (filterId: string, isActive: boolean) => {
        if (!isActive) return "bg-white/40 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/50 border border-white/40 dark:border-slate-700 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5";
        
        if (filterId === 'ALL') return 'bg-slate-800 text-white shadow-lg shadow-slate-500/30 ring-2 ring-slate-400 scale-105 border-transparent';
        if (filterId === 'RFI') return 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 scale-105 border-transparent';
        if (filterId === 'ELIOR') return 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300 scale-105 border-transparent';
        if (filterId === 'REKEEP') return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300 scale-105 border-transparent';

        const customPalette = [
            'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/40 ring-2 ring-fuchsia-300 scale-105 border-transparent',
            'bg-violet-500 text-white shadow-lg shadow-violet-500/40 ring-2 ring-violet-300 scale-105 border-transparent',
            'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-300 scale-105 border-transparent',
            'bg-rose-500 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-300 scale-105 border-transparent',
            'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-300 scale-105 border-transparent',
            'bg-teal-500 text-white shadow-lg shadow-teal-500/40 ring-2 ring-teal-300 scale-105 border-transparent'
        ];
        let hash = 0;
        for (let i = 0; i < filterId.length; i++) hash = filterId.charCodeAt(i) + ((hash << 5) - hash);
        return customPalette[Math.abs(hash) % customPalette.length];
    };

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50, damping: 15 } }, exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } } };

    // --- GESTIONE MOBILE SCAN ---
    const handleMobileScanSuccess = (data: any) => {
        addToast("Busta Paga ricevuta dal telefono!", "success");
        triggerConfetti();
    };

    // --- MAIN RENDER LOGIC ---
    if (isMobileMode) return <MobileUploadPage sessionId={mobileSessionId} />;
    if (!isAuthenticated) return <LoginPage loginPassword={loginPassword} setLoginPassword={setLoginPassword} loginError={loginError} handleLogin={handleLogin} />;

    return (
        <div className="min-h-screen font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 relative overflow-hidden transition-colors duration-500">
            <HiddenClasses />
            <DynamicIsland />
            <Background />

            <AppRouter
                viewMode={viewMode}
                workers={workers}
                filteredWorkers={filteredWorkers}
                dashboardStats={dashboardStats}
                statsList={statsList}
                modalConfig={modalConfig}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
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
                handleOpenModal={handleOpenModal}
                fileInputRef={fileInputRef}
                handleExportData={handleExportData}
                handleImportData={handleImportData}
                setViewMode={setViewMode}
                selectedWorker={selectedWorker}
                handleUpdateWorkerData={handleUpdateWorkerData}
                handleUpdateStatus={handleUpdateStatus}
                handleBack={handleBack}
            />

            {/* MODALS AND TOASTS */}
            <div className="fixed bottom-4 right-4 z-[110] flex flex-col items-end pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <div key={toast.id} className="pointer-events-auto">
                            <Toast message={toast.message} type={toast.type} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {workerToDelete !== null && (
                    <ConfirmModal
                        isOpen={true}
                        color={workers.find(w => w.id === workerToDelete)?.accentColor || 'red'}
                        onClose={() => setWorkerToDelete(null)}
                        onConfirm={confirmDelete}
                    />
                )}
            </AnimatePresence>

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