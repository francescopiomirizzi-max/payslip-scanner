import { useEffect, useState } from 'react';

// Viewport da telefono: allineato al breakpoint `sm` di Tailwind (640px).
// Sotto questa soglia la scheda lavoratore monta la vista mensile mobile
// al posto di MonthlyDataGrid (Fase 4 T2a); da 640px in su tutto invariato.
const PHONE_QUERY = '(max-width: 639px)';

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    // Fallback: dentro un iframe Chromium NON recapita i change ai MediaQueryList
    // creati prima del primo resize del frame (misurato col protocollo demo+iframe).
    // Il resize copre quel caso; a parità di valore setState non re-renderizza.
    const onResize = () => setIsMobile(window.matchMedia(PHONE_QUERY).matches);
    window.addEventListener('resize', onResize);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return isMobile;
};
