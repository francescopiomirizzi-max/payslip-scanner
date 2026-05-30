import { useEffect, useRef, useState } from 'react';

// Tipi minimi della Wake Lock API: non sono nei lib.d.ts di TS di default.
interface WakeLockSentinelLike {
    released: boolean;
    release: () => Promise<void>;
    addEventListener: (event: 'release', cb: () => void) => void;
}
interface WakeLockApi {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

const getWakeLock = (): WakeLockApi | null => {
    if (typeof navigator === 'undefined') return null;
    const wl = (navigator as any).wakeLock;
    return wl && typeof wl.request === 'function' ? wl : null;
};

/**
 * Tiene lo schermo del dispositivo acceso finché `active` è true.
 *
 * Caso d'uso: il telefono che fa l'upload delle buste paga via QR non deve andare
 * in standby — quando lo schermo si spegne il browser pausa il JS, le fetch in
 * flight vengono abortite, e il PC vede silenzio fino a scattare il watchdog.
 *
 * Gestisce:
 *  - acquire/release automatico quando `active` cambia
 *  - re-acquire su visibilitychange (iOS rilascia il lock quando si esce dalla
 *    tab; quando si rientra serve riprenderlo)
 *  - fallback no-op su browser che non supportano l'API (iOS < 16.4)
 */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
    const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
    const [held, setHeld] = useState(false);
    const supported = !!getWakeLock();

    useEffect(() => {
        if (!supported || !active) {
            // Se diventa inattivo o non supportato, assicurati di rilasciare.
            const s = sentinelRef.current;
            sentinelRef.current = null;
            setHeld(false);
            if (s && !s.released) s.release().catch(() => { /* ignore */ });
            return;
        }

        let cancelled = false;

        const acquire = async () => {
            if (sentinelRef.current && !sentinelRef.current.released) return;
            const api = getWakeLock();
            if (!api) return;
            try {
                const sentinel = await api.request('screen');
                if (cancelled) {
                    await sentinel.release().catch(() => {});
                    return;
                }
                sentinelRef.current = sentinel;
                setHeld(true);
                sentinel.addEventListener('release', () => {
                    if (sentinelRef.current === sentinel) {
                        sentinelRef.current = null;
                        setHeld(false);
                    }
                });
            } catch (e) {
                // iOS può rifiutare se la pagina non è "visible" o se l'utente non
                // ha ancora interagito. Non bloccante.
                console.warn('useWakeLock: acquire failed', e);
            }
        };

        acquire();

        const onVisibility = () => {
            if (document.visibilityState === 'visible' && active) acquire();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibility);
            const s = sentinelRef.current;
            sentinelRef.current = null;
            setHeld(false);
            if (s && !s.released) s.release().catch(() => { /* ignore */ });
        };
    }, [active, supported]);

    return { supported, held };
}
