import React from 'react';
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
    return (
        <>
            {viewMode === 'stats' && <StatsDashboard workers={workers} onBack={handleBack} />}

            {viewMode === 'complex' && selectedWorker && (
                <WorkerDetailPage
                    key={selectedWorker.id}
                    worker={selectedWorker}
                    onUpdateData={handleUpdateWorkerData}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdateWorkerFields={handleUpdateWorkerFields}
                    onBack={handleBack}
                    onOpenReport={() => handleOpenSimple(selectedWorker.id)}
                />
            )}

            {viewMode === 'simple' && selectedWorker && (
                <div className="min-h-screen bg-white">
                    <TableComponent
                        key={`report-${selectedWorker.id}`}
                        worker={selectedWorker}
                        onBack={() => setViewMode('home')}
                        onEdit={() => setViewMode('complex')}
                        startClaimYear={selectedWorker.startClaimYear ?? 2008}
                        onUpdateWorkerFields={handleUpdateWorkerFields}
                    />
                </div>
            )}

            <DashboardPage
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
