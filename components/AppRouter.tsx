import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatsDashboard from './StatsDashboard';
import WorkerDetailPage from './WorkerDetailPage';
import TableComponent from './TableComponent';
import DashboardPage from '../pages/DashboardPage';
import { Worker, AnnoDati } from '../types';
import { DashboardStats, WorkerStatItem, ModalConfig } from '../hooks/useDashboardStats';

interface AppRouterProps {
    viewMode: 'home' | 'simple' | 'complex' | 'stats';
    workers: Worker[];
    filteredWorkers: Worker[];
    dashboardStats: DashboardStats;
    statsList: WorkerStatItem[];
    modalConfig: ModalConfig;
    netCreditMap: Record<string | number, number>;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    activeFilter: string;
    setActiveFilter: (f: string) => void;
    activeStatusFilter: string;
    setActiveStatusFilter: (f: string) => void;
    customFilters: string[];
    activeStatsModal: 'net' | 'ticket' | null;
    setActiveStatsModal: (modal: 'net' | 'ticket' | null) => void;
    showScrollTop: boolean;
    scrollToTop: () => void;
    containerVariants: any;
    itemVariants: any;
    getFilterStyle: (filterId: string, isActive: boolean) => string;
    handleOpenSimple: (id: string) => void;
    handleOpenComplex: (id: string) => void;
    openEditModal: (e: React.MouseEvent, id: string) => void;
    handleDeleteWorker: (id: string) => void;
    handleOpenModal: (mode: 'create' | 'edit') => void;
    updateWorkerById: (id: string, fields: any) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportData: () => void;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats') => void;
    selectedWorker: Worker | null;
    handleUpdateWorkerData: (data: AnnoDati[]) => void;
    handleUpdateStatus: (status: string) => void;
    handleUpdateWorkerFields: (fields: any) => void;
    handleBack: () => void;
}

const AppRouter: React.FC<AppRouterProps> = ({
    viewMode,
    workers,
    filteredWorkers,
    dashboardStats,
    statsList,
    modalConfig,
    netCreditMap,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeStatusFilter,
    setActiveStatusFilter,
    customFilters,
    activeStatsModal,
    setActiveStatsModal,
    showScrollTop,
    scrollToTop,
    containerVariants,
    itemVariants,
    getFilterStyle,
    handleOpenSimple,
    handleOpenComplex,
    openEditModal,
    handleDeleteWorker,
    handleOpenModal,
    updateWorkerById,
    fileInputRef,
    handleExportData,
    handleImportData,
    setViewMode,
    selectedWorker,
    handleUpdateWorkerData,
    handleUpdateStatus,
    handleUpdateWorkerFields,
    handleBack
}) => {
    const pageAnim = {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit:    { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
    };

    return (
        <>
            <AnimatePresence mode="wait">
                {viewMode === 'stats' && (
                    <motion.div key="stats" {...pageAnim}>
                        <StatsDashboard workers={workers} onBack={handleBack} />
                    </motion.div>
                )}

                {viewMode === 'complex' && selectedWorker && (
                    <motion.div key={`complex-${selectedWorker.id}`} {...pageAnim}>
                        <WorkerDetailPage
                            key={selectedWorker.id}
                            worker={selectedWorker}
                            onUpdateData={handleUpdateWorkerData}
                            onUpdateStatus={handleUpdateStatus}
                            onUpdateWorkerFields={handleUpdateWorkerFields}
                            onBack={handleBack}
                            onOpenReport={() => handleOpenSimple(selectedWorker.id)}
                        />
                    </motion.div>
                )}

                {viewMode === 'simple' && selectedWorker && (
                    <motion.div key={`simple-${selectedWorker.id}`} {...pageAnim} className="min-h-screen bg-white">
                        <TableComponent
                            key={`report-${selectedWorker.id}`}
                            worker={selectedWorker}
                            onBack={() => setViewMode('home')}
                            onEdit={() => setViewMode('complex')}
                            startClaimYear={selectedWorker.startClaimYear ?? 2008}
                            onUpdateWorkerFields={handleUpdateWorkerFields}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <DashboardPage
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
                handleOpenModal={handleOpenModal}
                updateWorkerById={updateWorkerById}
                fileInputRef={fileInputRef}
                handleExportData={handleExportData}
                handleImportData={handleImportData}
                setViewMode={setViewMode}
            />
        </>
    );
};

export default AppRouter;
