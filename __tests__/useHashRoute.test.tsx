// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHashRoute } from '../hooks/useHashRoute';

type Deps = Parameters<typeof useHashRoute>[0];

function makeDeps(overrides: Partial<Deps> = {}): Deps {
    return {
        isReady: true,
        area: 'incidenza',
        viewMode: 'home',
        selectedWorkerId: null,
        archiveWorkerId: null,
        workerExists: (id: string) => id === 'w1',
        setArea: vi.fn(),
        setViewMode: vi.fn(),
        openComplex: vi.fn(),
        openSimple: vi.fn(),
        openArchive: vi.fn(),
        goHome: vi.fn(),
        ...overrides,
    };
}

const render = (deps: Deps) =>
    renderHook(({ d }: { d: Deps }) => useHashRoute(d), { initialProps: { d: deps } });

beforeEach(() => {
    window.history.replaceState(null, '', '/');
});

describe('useHashRoute', () => {
    it('senza hash al primo load canonicalizza a #/ senza toccare lo stato', () => {
        const deps = makeDeps();
        render(deps);
        expect(window.location.hash).toBe('#/');
        expect(deps.goHome).not.toHaveBeenCalled();
        expect(deps.setViewMode).not.toHaveBeenCalled();
    });

    it('non fa nulla finché isReady è false, poi applica il deep link', () => {
        window.history.replaceState(null, '', '#/worker/w1');
        const deps = makeDeps({ isReady: false });
        const { rerender } = render(deps);
        expect(deps.openComplex).not.toHaveBeenCalled();

        const ready = makeDeps({ isReady: true });
        rerender({ d: ready });
        expect(ready.openComplex).toHaveBeenCalledWith('w1');
        expect(ready.setArea).toHaveBeenCalledWith('incidenza');
    });

    it('deep link #/report/:id apre il riepilogo', () => {
        window.history.replaceState(null, '', '#/report/w1');
        const deps = makeDeps();
        render(deps);
        expect(deps.openSimple).toHaveBeenCalledWith('w1');
    });

    it('deep link con id inesistente fa fallback su home', () => {
        window.history.replaceState(null, '', '#/worker/sconosciuto');
        const deps = makeDeps();
        render(deps);
        expect(deps.openComplex).not.toHaveBeenCalled();
        expect(deps.goHome).toHaveBeenCalled();
    });

    it('#/archive/:id apre archivio sul lavoratore, #/archive senza id la vista piatta', () => {
        window.history.replaceState(null, '', '#/archive/w1');
        const withId = makeDeps();
        render(withId);
        expect(withId.openArchive).toHaveBeenCalledWith('w1');

        window.history.replaceState(null, '', '#/archive');
        const plain = makeDeps();
        render(plain);
        expect(plain.setViewMode).toHaveBeenCalledWith('archive');
        expect(plain.openArchive).not.toHaveBeenCalled();
    });

    it('un cambio di stato dopo l’init pusha la rotta corrispondente', () => {
        const { rerender } = render(makeDeps());
        expect(window.location.hash).toBe('#/');

        rerender({ d: makeDeps({ viewMode: 'stats' }) });
        expect(window.location.hash).toBe('#/stats');

        rerender({ d: makeDeps({ viewMode: 'complex', selectedWorkerId: 'w1' }) });
        expect(window.location.hash).toBe('#/worker/w1');

        rerender({ d: makeDeps({ area: 'riposi' }) });
        expect(window.location.hash).toBe('#/riposi');
    });

    it('popstate (Back/Forward) riapplica la rotta dell’hash allo stato', () => {
        const deps = makeDeps();
        render(deps);

        window.history.replaceState(null, '', '#/stats');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(deps.setViewMode).toHaveBeenCalledWith('stats');

        window.history.replaceState(null, '', '#/riposi');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(deps.setArea).toHaveBeenCalledWith('riposi');
    });
});
