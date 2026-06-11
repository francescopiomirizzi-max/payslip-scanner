import { useEffect, useRef } from 'react';

type ViewMode = 'home' | 'simple' | 'complex' | 'stats' | 'archive';
type AppArea = 'incidenza' | 'riposi';

interface HashRouteDeps {
    /** true quando auth + workers sono caricati: solo allora un deep link è applicabile */
    isReady: boolean;
    area: AppArea;
    viewMode: ViewMode;
    selectedWorkerId: string | null;
    archiveWorkerId: string | null;
    workerExists: (id: string) => boolean;
    setArea: (a: AppArea) => void;
    setViewMode: (m: ViewMode) => void;
    openComplex: (id: string) => void;
    openSimple: (id: string) => void;
    openArchive: (id: string) => void;
    goHome: () => void;
}

/**
 * Sincronizza lo stato di navigazione dell'app con l'hash dell'URL, senza router.
 *
 * Rotte: #/ (home) · #/stats · #/archive[/:workerId] · #/worker/:id (dettaglio)
 *        · #/report/:id (riepilogo) · #/riposi
 *
 * Cosa abilita: Back/Forward del browser, F5 che riapre la vista corrente,
 * deep link condivisibili (es. la scheda di un lavoratore al viewer readonly).
 * L'entry mobile QR usa la query `?mobile=true` (split in index.tsx) e non passa
 * di qui, quindi non c'è conflitto.
 *
 * Anti-loop: niente flag. L'effetto stato→URL scrive solo se l'hash differisce
 * dalla rotta canonica; dopo un popstate lo stato applicato riproduce esattamente
 * l'hash corrente, quindi l'effetto non ri-pusha.
 */
export const useHashRoute = (deps: HashRouteDeps) => {
    // Ref sempre aggiornata: i listener (popstate) leggono handler e stato correnti
    // senza richiedere re-subscribe a ogni render.
    const depsRef = useRef(deps);
    depsRef.current = deps;
    const initializedRef = useRef(false);

    const applyHash = (rawHash: string) => {
        const d = depsRef.current;
        const [seg, id] = rawHash.replace(/^#\/?/, '').split('/');
        switch (seg) {
            case 'riposi':
                d.setArea('riposi');
                return;
            case 'stats':
                d.setArea('incidenza');
                d.setViewMode('stats');
                return;
            case 'archive':
                d.setArea('incidenza');
                if (id && d.workerExists(id)) d.openArchive(id);
                else d.setViewMode('archive');
                return;
            case 'worker':
                if (id && d.workerExists(id)) {
                    d.setArea('incidenza');
                    d.openComplex(id);
                    return;
                }
                break;
            case 'report':
                if (id && d.workerExists(id)) {
                    d.setArea('incidenza');
                    d.openSimple(id);
                    return;
                }
                break;
        }
        // Rotta sconosciuta o id inesistente → home
        d.setArea('incidenza');
        d.goHome();
    };

    const routeFromState = (): string => {
        const d = depsRef.current;
        if (d.area === 'riposi') return '#/riposi';
        switch (d.viewMode) {
            case 'stats':   return '#/stats';
            case 'archive': return d.archiveWorkerId ? `#/archive/${d.archiveWorkerId}` : '#/archive';
            case 'complex': return d.selectedWorkerId ? `#/worker/${d.selectedWorkerId}` : '#/';
            case 'simple':  return d.selectedWorkerId ? `#/report/${d.selectedWorkerId}` : '#/';
            default:        return '#/';
        }
    };

    // Init: applica l'hash presente al primo load utile (deep link / F5).
    useEffect(() => {
        if (!deps.isReady || initializedRef.current) return;
        initializedRef.current = true;
        if (window.location.hash && window.location.hash !== '#/') {
            applyHash(window.location.hash);
        } else {
            window.history.replaceState(null, '', '#/');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deps.isReady]);

    // Stato → URL: ogni transizione di vista diventa una entry di history.
    // Un hash che ESTENDE la rotta canonica (es. #/worker/:id/pivot, il tab del
    // dettaglio scritto dalla pagina con replaceState) è considerato equivalente:
    // non va riscritto, altrimenti si cancellerebbe il sotto-stato.
    useEffect(() => {
        if (!initializedRef.current) return;
        const route = routeFromState();
        const h = window.location.hash;
        if (h !== route && !h.startsWith(route + '/')) window.history.pushState(null, '', route);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deps.area, deps.viewMode, deps.selectedWorkerId, deps.archiveWorkerId]);

    // Back/Forward → stato.
    useEffect(() => {
        const onPop = () => {
            if (!initializedRef.current) return;
            applyHash(window.location.hash);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};
