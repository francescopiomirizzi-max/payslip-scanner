import React from 'react';
import StatsDashboard from './StatsDashboard';
import WorkerDetailPage from './WorkerDetailPage';
import TableComponent from './TableComponent';
import DashboardPage from '../pages/DashboardPage';
import { Worker } from '../types';
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
    customFilters: string[];
    activeStatsModal: 'net' | 'ticket' | null;
    setActiveStatsModal: (modal: 'net' | 'ticket' | null) => void;
    showScrollTop: boolean;
    scrollToTop: () => void;
    containerVariants: any;
    itemVariants: any;
    getFilterStyle: (filterId: string, isActive: boolean) => string;
    handleOpenSimple: (id: number) => void;
    handleOpenComplex: (id: number) => void;
    openEditModal: (e: React.MouseEvent, id: number) => void;
    handleDeleteWorker: (id: number) => void;
    handleOpenModal: (mode: 'create' | 'edit') => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportData: () => void;
    handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats') => void;
    selectedWorker: Worker | null;
    handleUpdateWorkerData: (id: number, data: any) => void;
    handleUpdateStatus: (id: number, status: string) => void;
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
    fileInputRef,
    handleExportData,
    handleImportData,
    setViewMode,
    selectedWorker,
    handleUpdateWorkerData,
    handleUpdateStatus,
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
                        startClaimYear={Number(localStorage.getItem(`startYear_${selectedWorker.id}`)) || 2008} 
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
            />
        </>
    );
};

export default AppRouter;
