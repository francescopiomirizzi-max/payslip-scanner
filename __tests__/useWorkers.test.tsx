// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { useWorkers } from '../hooks/useWorkers';

// ─── Hoisted mocks (must precede vi.mock calls) ───────────────────────────────

const { mockSelect, mockDelete, mockFrom } = vi.hoisted(() => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockDelete = vi.fn().mockResolvedValue({ error: null });

    const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
            // loadWorkers ora fa select('*').order(...) diretto: il filtro client
            // owner_id è stato rimosso (lo coprono le RLS). Manteniamo anche il ramo
            // .eq().order()/.limit() per eventuali query owner-scoped residue.
            order: vi.fn(() => mockSelect()),
            eq: vi.fn(() => ({
                order: vi.fn(() => mockSelect()),
                limit: vi.fn(() => mockSelect()),
            })),
        })),
        delete: vi.fn(() => ({
            eq: vi.fn(() => mockDelete()),
            in: vi.fn(() => mockDelete()),
        })),
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
    }));

    return { mockSelect, mockDelete, mockFrom };
});

vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

vi.mock('../utils/migrateFromLocalToCloud', () => ({
    migrateLocalToCloud: vi.fn().mockResolvedValue(false),
}));

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } }),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: mockFrom,
        storage: { from: vi.fn() },
    },
}));

// ─── Test helpers ────────────────────────────────────────────────────────────

const mockToast = vi.fn();

function makeWorker(overrides: Record<string, unknown> = {}) {
    return { nome: 'Luca', cognome: 'Bianchi', profilo: 'ELIOR', ruolo: 'Tecnico', ...overrides };
}

function makeDbWorker(overrides: Record<string, unknown> = {}) {
    return {
        id: 'worker-uuid-1',
        nome: 'Mario', cognome: 'Rossi', profilo: 'RFI', ruolo: 'Tecnico',
        elior_type: null, status: null, accent_color: 'blue',
        avatar_url: null, notes: null,
        tfr_pregresso: null, tfr_pregresso_anno: null,
        anni: [],
        ...overrides,
    };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
    localStorage.clear();
    mockToast.mockReset();
    // Reset only the leaf mocks — don't touch mockFrom's implementation
    mockSelect.mockReset();
    mockSelect.mockResolvedValue({ data: [], error: null });
    mockDelete.mockReset();
    mockDelete.mockResolvedValue({ error: null });

    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
    it('starts loading and resolves to empty when DB is empty', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));
        expect(result.current.workers).toHaveLength(0);
    });

    it('loads workers returned by Supabase', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        expect(result.current.workers).toHaveLength(1);
        expect(result.current.workers[0].cognome).toBe('Rossi');
        expect(result.current.workers[0].id).toBe('worker-uuid-1');
    });
});

// ─── CRUD — Create ───────────────────────────────────────────────────────────

describe('handleSaveWorker — create', () => {
    it('adds worker optimistically with a UUID id', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => {
            result.current.openCreateModal();
            result.current.handleSaveWorker(makeWorker());
        });

        expect(result.current.workers).toHaveLength(1);
        const nuovo = result.current.workers[0];
        expect(typeof nuovo.id).toBe('string');
        expect(nuovo.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        expect(nuovo.cognome).toBe('Bianchi');
    });

    it('new worker gets DEFAULT_YEARS_TEMPLATE as anni', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => {
            result.current.openCreateModal();
            result.current.handleSaveWorker(makeWorker());
        });

        const nuovo = result.current.workers[0];
        expect(Array.isArray(nuovo.anni)).toBe(true);
        expect(nuovo.anni.length).toBeGreaterThan(0);
        expect(nuovo.anni[0]).toHaveProperty('monthIndex');
    });

    it('ids are unique across multiple creates', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => {
            result.current.openCreateModal();
            result.current.handleSaveWorker(makeWorker({ cognome: 'Alpha' }));
        });
        act(() => {
            result.current.openCreateModal();
            result.current.handleSaveWorker(makeWorker({ cognome: 'Beta' }));
        });

        const ids = result.current.workers.map(w => w.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('calls addToast with success on create', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => {
            result.current.openCreateModal();
            result.current.handleSaveWorker(makeWorker());
        });

        expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'success');
    });
});

// ─── CRUD — Edit ─────────────────────────────────────────────────────────────

describe('handleSaveWorker — edit', () => {
    it('updates the target worker fields', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const existing = result.current.workers[0];
        act(() => { result.current.handleOpenModal('edit', existing); });
        act(() => { result.current.handleSaveWorker({ nome: 'Giuseppe', cognome: 'Esposito', profilo: 'RFI', ruolo: 'Capo' }); });

        const updated = result.current.workers.find(w => w.id === existing.id)!;
        expect(updated.nome).toBe('Giuseppe');
        expect(updated.cognome).toBe('Esposito');
    });

    it('preserves anni and id on edit', async () => {
        const dbRow = makeDbWorker({
            anni: [{ year: 2020, monthIndex: 0, month: 'GENNAIO', daysWorked: 22, daysVacation: 2, ticket: 0 }],
        });
        mockSelect.mockResolvedValueOnce({ data: [dbRow], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const existing = result.current.workers[0];
        act(() => { result.current.handleOpenModal('edit', existing); });
        act(() => { result.current.handleSaveWorker({ nome: 'Giuseppe', cognome: 'Esposito', profilo: 'RFI', ruolo: 'Capo' }); });

        const updated = result.current.workers.find(w => w.id === existing.id)!;
        expect(updated.id).toBe(existing.id);
        expect(updated.anni).toEqual(existing.anni);
    });

    it('calls addToast with success on edit', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const existing = result.current.workers[0];
        act(() => { result.current.handleOpenModal('edit', existing); });
        act(() => { result.current.handleSaveWorker({ nome: 'Giuseppe', cognome: 'Esposito', profilo: 'RFI', ruolo: 'Capo' }); });

        expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'success');
    });
});

// ─── CRUD — Delete (optimistic + undo window) ────────────────────────────────

describe('delete (optimistic + undo)', () => {
    it('handleDeleteWorker removes the worker from the UI immediately', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const id = result.current.workers[0].id;
        act(() => { result.current.handleDeleteWorker(id); });
        expect(result.current.workers.find(w => w.id === id)).toBeUndefined();
    });

    it('handleDeleteWorker shows an info toast with an "Annulla" action', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const id = result.current.workers[0].id;
        act(() => { result.current.handleDeleteWorker(id); });

        expect(mockToast).toHaveBeenCalledWith(
            expect.stringContaining('eliminata'),
            'info',
            expect.objectContaining({
                action: expect.objectContaining({ label: 'Annulla' }),
            }),
        );
    });

    it('undo restores the worker and skips the DB delete', async () => {
        vi.useFakeTimers();
        try {
            mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

            const { result } = renderHook(() => useWorkers(mockToast));
            await vi.waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

            const id = result.current.workers[0].id;
            act(() => { result.current.handleDeleteWorker(id); });

            // Worker rimosso dalla UI
            expect(result.current.workers.find(w => w.id === id)).toBeUndefined();

            // Recupero la callback "Annulla" dal toast appena emesso
            const deleteCall = mockToast.mock.calls.find(c => c[2]?.action);
            expect(deleteCall).toBeDefined();
            const undo = (deleteCall![2] as any).action.onClick as () => void;

            act(() => { undo(); });

            // Worker ripristinato
            expect(result.current.workers.find(w => w.id === id)).toBeDefined();

            // Anche oltre la finestra di undo, niente cancellazione DB
            await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
            expect(mockDelete).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('after the undo window expires the DB delete is committed', async () => {
        vi.useFakeTimers();
        try {
            mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

            const { result } = renderHook(() => useWorkers(mockToast));
            await vi.waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

            const id = result.current.workers[0].id;
            act(() => { result.current.handleDeleteWorker(id); });

            expect(mockDelete).not.toHaveBeenCalled();

            await act(async () => { await vi.advanceTimersByTimeAsync(5100); });

            expect(mockDelete).toHaveBeenCalledTimes(1);
            expect(result.current.workers.find(w => w.id === id)).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });
});

// ─── Bulk delete (optimistic + undo unico) ───────────────────────────────────

describe('handleDeleteWorkersBulk', () => {
    const twoWorkers = [
        makeDbWorker(),
        makeDbWorker({ id: 'worker-uuid-2', nome: 'Luca', cognome: 'Bianchi' }),
    ];

    it('removes all workers at once with a single undo toast', async () => {
        mockSelect.mockResolvedValueOnce({ data: twoWorkers, error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => { result.current.handleDeleteWorkersBulk(['worker-uuid-1', 'worker-uuid-2']); });

        expect(result.current.workers).toHaveLength(0);
        const undoToasts = mockToast.mock.calls.filter(c => c[2]?.action?.label === 'Annulla');
        expect(undoToasts).toHaveLength(1);
        expect(undoToasts[0][0]).toContain('2 pratiche');
    });

    it('undo restores every worker and skips the DB delete', async () => {
        vi.useFakeTimers();
        try {
            mockSelect.mockResolvedValueOnce({ data: twoWorkers, error: null });

            const { result } = renderHook(() => useWorkers(mockToast));
            await vi.waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

            act(() => { result.current.handleDeleteWorkersBulk(['worker-uuid-1', 'worker-uuid-2']); });
            expect(result.current.workers).toHaveLength(0);

            const undoCall = mockToast.mock.calls.find(c => c[2]?.action);
            const undo = (undoCall![2] as any).action.onClick as () => void;
            act(() => { undo(); });

            expect(result.current.workers).toHaveLength(2);
            await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
            expect(mockDelete).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('after the undo window expires it issues ONE batch DB delete', async () => {
        vi.useFakeTimers();
        try {
            mockSelect.mockResolvedValueOnce({ data: twoWorkers, error: null });

            const { result } = renderHook(() => useWorkers(mockToast));
            await vi.waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

            act(() => { result.current.handleDeleteWorkersBulk(['worker-uuid-1', 'worker-uuid-2']); });
            await act(async () => { await vi.advanceTimersByTimeAsync(5100); });

            expect(mockDelete).toHaveBeenCalledTimes(1);
            expect(result.current.workers).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });
});

// ─── Ricerca estesa (nome, azienda, ruolo) ───────────────────────────────────

describe('filteredWorkers — ricerca estesa', () => {
    const seed = [
        makeDbWorker(), // Mario Rossi · RFI · Tecnico
        makeDbWorker({ id: 'worker-uuid-2', nome: 'Luca', cognome: 'Bianchi', profilo: 'CLEAN_SERVICE', ruolo: 'Operaio' }),
    ];

    it('matcha per azienda come la mostra la UI (underscore → spazio)', async () => {
        mockSelect.mockResolvedValueOnce({ data: seed, error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => { result.current.setSearchQuery('clean service'); });
        expect(result.current.filteredWorkers).toHaveLength(1);
        expect(result.current.filteredWorkers[0].cognome).toBe('Bianchi');
    });

    it('matcha per ruolo', async () => {
        mockSelect.mockResolvedValueOnce({ data: seed, error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => { result.current.setSearchQuery('tecnico'); });
        expect(result.current.filteredWorkers).toHaveLength(1);
        expect(result.current.filteredWorkers[0].cognome).toBe('Rossi');
    });

    it('continua a matchare per cognome', async () => {
        mockSelect.mockResolvedValueOnce({ data: seed, error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => { result.current.setSearchQuery('bianchi'); });
        expect(result.current.filteredWorkers).toHaveLength(1);
        expect(result.current.filteredWorkers[0].nome).toBe('Luca');
    });

    it('matcha "elior magazzino" via eliorType (e non i viaggianti)', async () => {
        const seedElior = [
            ...seed,
            makeDbWorker({ id: 'worker-uuid-3', nome: 'Anna', cognome: 'Verdi', profilo: 'ELIOR', elior_type: 'magazzino' }),
            makeDbWorker({ id: 'worker-uuid-4', nome: 'Paolo', cognome: 'Neri', profilo: 'ELIOR', elior_type: 'viaggiante' }),
        ];
        mockSelect.mockResolvedValueOnce({ data: seedElior, error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        act(() => { result.current.setSearchQuery('elior magazzino'); });
        expect(result.current.filteredWorkers).toHaveLength(1);
        expect(result.current.filteredWorkers[0].cognome).toBe('Verdi');

        // "elior" da solo continua a prenderli entrambi
        act(() => { result.current.setSearchQuery('elior'); });
        expect(result.current.filteredWorkers).toHaveLength(2);
    });
});
