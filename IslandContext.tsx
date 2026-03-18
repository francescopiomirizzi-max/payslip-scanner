import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ✨ FIX: Aggiunto 'quick_actions'
export type IslandMode = 'idle' | 'notification' | 'stats' | 'calc_history' | 'uploading' | 'quick_actions';

interface CalcHistoryItem {
  id: string;
  timestamp: Date;
  operation: string;
  result: string;
}

interface IslandContextType {
  mode: IslandMode;
  notification: { title: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' } | null;
  workerStats: any | null;
  calcHistory: CalcHistoryItem[];

  // Azioni di Base
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  showWorkerStats: (workerData: any) => void;
  toggleCalcHistory: () => void;
  addCalcHistory: (operation: string, result: string) => void;
  clearCalcHistory: () => void;
  closeIsland: () => void;

  // STATO CARICAMENTI E AZIONI
  uploadState: { isUploading: boolean; isFinishing: boolean; isError: boolean; type: 'single' | 'batch' | 'mobile'; progress: number; total: number };
  startUpload: (type: 'single' | 'batch' | 'mobile', total: number) => void;
  updateUploadProgress: (progress: number) => void;
  finishUpload: (successCount: number, errorCount: number, type: 'single' | 'batch' | 'mobile', customError?: string) => void;

  // ✨ FIX: AGGIUNTO IL COMANDO QUICK ACTIONS
  setQuickActions: (visible: boolean) => void;
}

// ✨ FIX 1: IL CONTESTO ERA STATO CANCELLATO, ORA C'È!
const IslandContext = createContext<IslandContextType | undefined>(undefined);

export const IslandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<IslandMode>('idle');
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [workerStats, setWorkerStats] = useState<any | null>(null);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>([]);

  const [uploadState, setUploadState] = useState<{ isUploading: boolean; isFinishing: boolean; isError: boolean; type: 'single' | 'batch' | 'mobile'; progress: number; total: number }>({ isUploading: false, isFinishing: false, isError: false, type: 'batch', progress: 0, total: 0 });

  // ✨ FIX 2: FUNZIONI BASE RICOSTRUITE
  const closeIsland = useCallback(() => {
    setMode('idle');
    setNotification(null);
    setWorkerStats(null);
  }, []);

  const showNotification = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000) => {
    setNotification({ title, message, type });
    setMode('notification');
    if (duration > 0) {
      setTimeout(() => {
        setMode(prev => (prev === 'notification' ? 'idle' : prev));
      }, duration);
    }
  }, []);

  const showWorkerStats = useCallback((workerData: any) => {
    setWorkerStats(workerData);
    setMode('stats');
  }, []);

  const toggleCalcHistory = useCallback(() => {
    setMode(prev => prev === 'calc_history' ? 'idle' : 'calc_history');
  }, []);

  const addCalcHistory = useCallback((operation: string, result: string) => {
    const newItem: CalcHistoryItem = { id: Date.now().toString(), timestamp: new Date(), operation, result };
    setCalcHistory(prev => [newItem, ...prev].slice(0, 10)); // Tiene solo le ultime 10
  }, []);

  const clearCalcHistory = useCallback(() => {
    setCalcHistory([]);
  }, []);

  // --- MOTORE DEI CARICAMENTI ---
  const startUpload = useCallback((type: 'single' | 'batch' | 'mobile', total: number) => {
    setUploadState({ isUploading: true, isFinishing: false, isError: false, type, progress: 0, total });
    setMode('uploading');
  }, []);

  const updateUploadProgress = useCallback((progress: number) => {
    setUploadState(prev => ({ ...prev, progress }));
  }, []);

  const finishUpload = useCallback((successCount: number, errorCount: number, type: 'single' | 'batch' | 'mobile', customError?: string) => {
    const isError = successCount === 0;

    setUploadState(prev => ({ ...prev, isFinishing: true, isError, progress: prev.total }));

    setTimeout(() => {
      setUploadState(prev => ({ ...prev, isUploading: false, isFinishing: false }));
      setMode('idle');

      let msg = '';
      if (isError) {
        msg = customError || 'Errore durante la scansione del documento. Riprova.';
      } else {
        if (type === 'single') msg = 'Busta Paga acquisita e tradotta.';
        else if (type === 'batch') msg = `${successCount} Buste Paga sincronizzate.`;
        else if (type === 'mobile') msg = 'Documento Mobile acquisito con successo.';
        if (errorCount > 0) msg += `\n(⚠️ ${errorCount} illeggibili)`;
      }

      showNotification(
        isError ? "Scansione Fallita" : "Estrazione Completata",
        msg,
        isError ? "error" : "success",
        6000
      );
    }, 2000);
  }, [showNotification]);
  // ✨ FIX: COMANDO QUICK ACTIONS POTENZIATO
  const setQuickActions = useCallback((visible: boolean) => {
    setMode(prev => {
      // Forza l'apparizione se l'isola non sta facendo cose importanti
      if (visible && (prev === 'idle' || prev === 'quick_actions')) {
        return 'quick_actions';
      }
      // La nasconde quando torni su
      if (!visible && prev === 'quick_actions') {
        return 'idle';
      }
      return prev;
    });
  }, []);
  return (
    <IslandContext.Provider value={{
      mode, notification, workerStats, calcHistory,
      showNotification, showWorkerStats, toggleCalcHistory, addCalcHistory, clearCalcHistory, closeIsland,
      uploadState, startUpload, updateUploadProgress, finishUpload,
      setQuickActions // ✨ FIX: ORA VIENE ESPORTATA CORRETTAMENTE!
    }}>
      {children}
    </IslandContext.Provider>
  );
};

export const useIsland = () => {
  const context = useContext(IslandContext);
  if (!context) throw new Error("useIsland deve essere usato dentro un IslandProvider");
  return context;
};