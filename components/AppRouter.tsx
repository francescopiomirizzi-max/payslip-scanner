import React from 'react';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import StatsDashboard from './StatsDashboard';
import WorkerDetailPage from './WorkerDetailPage';
import TableComponent from './TableComponent';
import DashboardPage from '../pages/DashboardPage';
import ArchivePage from '../pages/ArchivePage';
import CompanyPage from '../pages/CompanyPage';
import { Worker, AnnoDati } from '../types';
import { DashboardStats, WorkerStatItem, ModalConfig } from '../hooks/useDashboardStats';

type ViewMode = 'home' | 'simple' | 'complex' | 'stats' | 'archive' | 'company';

interface AppRouterProps {
    viewMode: ViewMode;
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
    handleDeleteWorkersBulk: (ids: string[]) => void;
    recentlyCreatedId: string | null;
    handleOpenModal: (mode: 'create' | 'edit') => void;
    updateWorkerById: (id: string, fields: any) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportData: () => void;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setViewMode: (mode: ViewMode) => void;
    selectedWorker: Worker | null;
    handleUpdateWorkerData: (data: AnnoDati[]) => void;
    handleUpdateStatus: (status: string) => void;
    handleUpdateWorkerFields: (fields: any) => void;
    handleBack: () => void;
    archiveWorkerId?: string | null;
    handleOpenArchive: (id: string) => void;
    selectedCompany: string | null;
    handleOpenCompany: (key: string) => void;
    addToast: (
        message: string,
        type?: 'success' | 'error' | 'info',
        options?: { action?: { label: string; onClick: () => void }; duration?: number }
    ) => void;
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
    handleDeleteWorkersBulk,
    recentlyCreatedId,
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
    handleBack,
    archiveWorkerId,
    handleOpenArchive,
    selectedCompany,
    handleOpenCompany,
    addToast,
}) => {
    const pageAnim: Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> = {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] as any } },
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

                {viewMode === 'archive' && (
                    <motion.div key="archive" {...pageAnim} className="h-screen">
                        <ArchivePage workers={workers} onBack={handleBack} initialWorkerId={archiveWorkerId ?? undefined} />
                    </motion.div>
                )}

                {viewMode === 'company' && selectedCompany && (
                    <motion.div key={`company-${selectedCompany}`} {...pageAnim}>
                        <CompanyPage
                            companyKey={selectedCompany}
                            workers={workers}
                            onBack={handleBack}
                            onOpenWorker={handleOpenComplex}
                        />
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
                            onPersistWorkerById={updateWorkerById}
                            onBack={handleBack}
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
                            addToast={addToast}
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
                handleDeleteWorkersBulk={handleDeleteWorkersBulk}
                recentlyCreatedId={recentlyCreatedId}
                handleOpenModal={handleOpenModal}
                updateWorkerById={updateWorkerById}
                fileInputRef={fileInputRef}
                handleExportData={handleExportData}
                handleImportData={handleImportData}
                setViewMode={setViewMode}
                onOpenArchive={handleOpenArchive}
                onOpenCompany={handleOpenCompany}
                addToast={addToast}
            />
        </>
    );
};

export default AppRouter;
