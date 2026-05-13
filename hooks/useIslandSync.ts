import React, { useEffect, useRef } from 'react';
import { useIsland } from '../IslandContext';

interface UseIslandSyncOptions {
  onBack: () => void;
  showReport: boolean;
  setShowReport: (v: boolean) => void;
  onPrintTables: () => void;
  rawTotal: number;
}

export function useIslandSync({
  onBack,
  showReport,
  setShowReport,
  onPrintTables,
  rawTotal,
}: UseIslandSyncOptions) {
  const { setQuickActions } = useIsland();
  const isQuickActionsActiveRef = useRef(false);

  // Ref stabile per onPrintTables — evita stale closure nell'effect trigger-download
  const onPrintTablesRef = useRef(onPrintTables);
  useEffect(() => {
    onPrintTablesRef.current = onPrintTables;
  }, [onPrintTables]);

  // 1. Imposta il contesto island e gestisce lo scroll globale per le quick actions
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'detail' }));

    const handleGlobalScroll = () => {
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 300 && !isQuickActionsActiveRef.current) {
          isQuickActionsActiveRef.current = true;
          setQuickActions(true);
        } else if (scrollTop <= 200 && isQuickActionsActiveRef.current) {
          isQuickActionsActiveRef.current = false;
          setQuickActions(false);
        }
      });
    };

    window.addEventListener('scroll', handleGlobalScroll, true);

    return () => {
      window.removeEventListener('scroll', handleGlobalScroll, true);
      setQuickActions(false);
      isQuickActionsActiveRef.current = false;
    };
  }, [setQuickActions]);

  // 2. Listener per i trigger della Dynamic Island (dashboard, download, report)
  useEffect(() => {
    const onDashboard = () => onBack();
    const onDownload = () => onPrintTablesRef.current?.();
    const onReport = () => setShowReport(true);

    window.addEventListener('trigger-dashboard', onDashboard);
    window.addEventListener('trigger-download', onDownload);
    window.addEventListener('trigger-report', onReport);

    return () => {
      window.removeEventListener('trigger-dashboard', onDashboard);
      window.removeEventListener('trigger-download', onDownload);
      window.removeEventListener('trigger-report', onReport);
    };
  }, [onBack, setShowReport]);

  // 3. Ri-afferma il contesto quando si chiude il report
  useEffect(() => {
    if (!showReport) {
      window.dispatchEvent(new CustomEvent('set-island-context', { detail: 'detail' }));
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop <= 200) setQuickActions(false);
    }
  }, [showReport, setQuickActions]);

  // 4. Trasmette il totale netto recuperabile al ticker della Dynamic Island
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('island-ticker', { detail: rawTotal }));
    return () => {
      window.dispatchEvent(new CustomEvent('island-ticker', { detail: null }));
    };
  }, [rawTotal]);

  // Scroll handler per il contenitore principale della pagina
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      if (scrollTop > 300 && !isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = true;
        setQuickActions(true);
      } else if (scrollTop <= 200 && isQuickActionsActiveRef.current) {
        isQuickActionsActiveRef.current = false;
        setQuickActions(false);
      }
    });
  };

  return { handleContainerScroll };
}
