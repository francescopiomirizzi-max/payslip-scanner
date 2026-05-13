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
            eq: vi.fn(() => ({
                order: vi.fn(() => mockSelect()),
                limit: vi.fn(() => mockSelect()),
            })),
        })),
        delete: vi.fn(() => ({
            eq: vi.fn(() => mockDelete()),
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

// ─── CRUD — Delete ───────────────────────────────────────────────────────────

describe('delete', () => {
    it('handleDeleteWorker sets workerToDelete', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const id = result.current.workers[0].id;
        act(() => { result.current.handleDeleteWorker(id); });
        expect(result.current.workerToDelete).toBe(id);
    });

    it('confirmDelete removes the worker and clears workerToDelete', async () => {
        mockSelect.mockResolvedValueOnce({ data: [makeDbWorker()], error: null });

        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const id = result.current.workers[0].id;
        act(() => { result.current.handleDeleteWorker(id); });
        await act(async () => { await result.current.confirmDelete(); });

        expect(result.current.workers.find(w => w.id === id)).toBeUndefined();
        expect(result.current.workerToDelete).toBeNull();
    });

    it('confirmDelete is a no-op when workerToDelete is null', async () => {
        const { result } = renderHook(() => useWorkers(mockToast));
        await waitFor(() => expect(result.current.isWorkersLoading).toBe(false));

        const initialCount = result.current.workers.length;
        await act(async () => { await result.current.confirmDelete(); });
        expect(result.current.workers.length).toBe(initialCount);
    });
});
