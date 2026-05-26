import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Calculator, Search, X, Loader2,
    CheckCircle2, AlertCircle, LayoutGrid, Sun, Moon,
    Database, Settings, LogOut, Copy, User, DownloadCloud, Trash2, ArrowRight, QrCode, Smartphone, Sparkles, LoaderCircle, FileText, Check, XCircle, ArrowLeft, Download, FileSpreadsheet, Printer, Archive, Minimize2,
    ScrollText, ExternalLink
} from 'lucide-react';
import { useIsland } from '../IslandContext';
import { useIsReadOnly } from '../lib/readonly';
import { FRAMER_PHYSICS, APPLE_EASE } from '../framerConfig';
import { useRagAvvocato } from '../hooks/useRagAvvocato';
import RagAdminPanel from './RagAdminPanel';
import { openLegalDocumentInTab } from '../lib/ragRepository';

export const notifyIsland = (msg: string, type: 'success' | 'error' | 'ai' = 'success') => {
    window.dispatchEvent(new CustomEvent('island-notify', { detail: { msg, type } }));
};

// --- TRANSIZIONI ---
// Centralizzate in framerConfig.ts → preset `dynamicIsland` (spring quasi-critica)
// per x/boxShadow, e `dynamicIslandLayout` (overdamped) per il resize del contenitore.

// --- GESTORE DEGLI STILI ---
// NOTA: il border-radius è gestito separatamente da `getIslandBorderRadius` come valore
// numerico animato nello `style` del motion.div. Le classi `rounded-*` sono volutamente
// rimosse da qui per evitare che Framer Motion le "perda" durante i layout-shift
// (causa del bug angoli appuntiti in mode calc).
const getIslandStyles = (mode: string, _isExpanded: boolean, _uploadState: any) => {
    if (mode === 'uploading') {
        return `pointer-events-auto bg-transparent border-none shadow-none overflow-hidden flex flex-col`;
    }

    // ❌ NIENTE `backdrop-filter` nella transition: causa repaint con corner bug
    // su container con backdrop-blur + border-radius durante interazione dei figli.
    const base = "overflow-hidden backdrop-blur-md pointer-events-auto flex flex-col transition-[background-color,border-color,box-shadow,opacity] duration-500";

    switch (mode) {
        case 'idle':
            return `${base} bg-white/20 dark:bg-slate-900/30 border border-white/20 dark:border-cyan-500/15 shadow-sm hover:backdrop-blur-2xl hover:bg-white/60 dark:hover:bg-slate-900/70 hover:border-slate-300 dark:hover:border-cyan-400/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]`;
        case 'dropzone':
            return `${base} bg-slate-950/90 border-2 border-fuchsia-500 shadow-[0_0_50px_rgba(217,70,239,0.5)]`;
        case 'ticker':
            return `${base} bg-white/90 dark:bg-slate-950/90 border border-emerald-500/50 shadow-[0_10px_30px_rgba(16,185,129,0.3)]`;
        default:
            return `${base} bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border border-white/30 dark:border-cyan-500/10 shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)]`;
    }
};

// Border-radius come numero → Framer Motion interpola pulito durante layout.
// 9999 = pill shape; valori più contenuti per stati espansi.
const getIslandBorderRadius = (mode: string, isExpanded: boolean, uploadState: any): number => {
    if (mode === 'idle' || mode === 'ticker' || mode === 'quick_actions') return 9999;
    if (mode === 'notify') return 9999;
    if (mode === 'dropzone') return 40;
    if (mode === 'uploading') {
        if (uploadState.isFinishing) return 20;
        return isExpanded ? 32 : 20;
    }
    // calc, calc_history, ai, menu, stats, notification → 32px sempre
    return 32;
};

// Width esplicita per ogni mode → animata via `animate` (no transform scale di Framer).
// Eliminando `layout` prop, evitiamo lo schiacciamento durante apertura/chiusura.
const getIslandWidth = (mode: string, isExpanded: boolean, uploadState: any): number => {
    switch (mode) {
        case 'dropzone': return 350;
        case 'ticker': return 220;
        case 'idle': return 140;
        case 'notify':
        case 'notification': return 350;
        case 'ai': return 500;
        case 'ai_cloud': return 500;
        case 'calc': return 280;
        case 'calc_history': return 320;
        case 'stats': return 360;
        case 'quick_actions': return 180;
        case 'menu': return 420;
        case 'uploading':
            if (isExpanded) return 300;
            if (uploadState.isFinishing) return 280;
            return 260;
        default: return 320;
    }
};

const DynamicIsland = ({ workers = [] }: { workers?: { id: string | number; nome: string; cognome: string; profilo?: string; [key: string]: any }[] }) => {
    const {
        mode: globalMode,
        calcHistory,
        addCalcHistory,
        clearCalcHistory,
        showNotification,
        notification,
        closeIsland,
        workerStats,
        showWorkerStats,
        uploadState,
        minimizeUpload,
        restoreUpload
    } = useIsland();

    const isReadOnly = useIsReadOnly();

    // ✨ BISTURI 1A: STATO CONTESTO ISOLA
    const [islandContext, setIslandContext] = useState<'detail' | 'report'>('detail');

    // ✨ RICEVITORE NOME FILE E MOTORE DEL TERMINALE OLOGRAFICO
    const [currentScanLabel, setCurrentScanLabel] = useState<string>('');
    const [syncLogs, setSyncLogs] = useState<string[]>([]); // <-- ECCO LA CHIAVE CHE MANCAVA!

    useEffect(() => {
        const handleLabel = (e: any) => {
            setCurrentScanLabel(e.detail);
            // Questa magia prende i nomi delle buste paga o i messaggi del TFR e li impila nel terminale!
            if (e.detail && !e.detail.includes('Inizializzazione') && !e.detail.includes('Analisi')) {
                setSyncLogs(prev => [e.detail, ...prev].slice(0, 3));
            }
        };
        window.addEventListener('island-scan-label', handleLabel);
        return () => window.removeEventListener('island-scan-label', handleLabel);
    }, []);

    useEffect(() => {
        const handleCtx = (e: any) => setIslandContext(e.detail);
        window.addEventListener('set-island-context', handleCtx);
        return () => window.removeEventListener('set-island-context', handleCtx);
    }, []);

    const [workerContext, setWorkerContext] = useState<{ nome: string; cognome: string; profilo: string; eliorType: string | null } | null>(null);

    useEffect(() => {
        const handleWorkerCtx = (e: any) => setWorkerContext(e.detail);
        window.addEventListener('island-worker-context', handleWorkerCtx);
        return () => window.removeEventListener('island-worker-context', handleWorkerCtx);
    }, []);

    const [localMode, setLocalMode] = useState<'idle' | 'calc' | 'ai' | 'ai_cloud' | 'notify' | 'menu' | 'dropzone' | 'ticker'>('idle');
    const [isUploadExpanded, setIsUploadExpanded] = useState(false);
    const [isDark, setIsDark] = useState<boolean>(() =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    );

    // L'upload in corso (non minimizzato) ha SEMPRE la priorità sull'isola: la sua
    // visibilità è ancorata a `uploadState.isUploading` (lo stato reale del caricamento),
    // NON a `globalMode`. Così nessuna notifica — nemmeno un evento di auth che rientra
    // quando si torna sulla scheda — può rubargli la Live Activity.
    // Quando l'upload è minimized, l'isola segue il localMode; gli altri global mode
    // (notification, stats, quick_actions) restano prioritari sul local.
    const uploadingActive = uploadState.isUploading && !uploadState.minimized;
    const mode = uploadingActive
        ? 'uploading'
        : (globalMode !== 'idle' && globalMode !== 'uploading')
            ? globalMode
            : localMode;

    // Keep a ref so stale-closure handlers can always read the current globalMode
    const globalModeRef = useRef(globalMode);
    useEffect(() => { globalModeRef.current = globalMode; }, [globalMode]);

    useEffect(() => {
        const obs = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);

    const setMode = (newMode: any) => {
        // Upload attivo NON minimizzato → blocca local mode (preserve full Live Activity).
        // Upload attivo minimized → consenti cambio local mode (l'utente l'ha rilasciato volontariamente).
        if (globalModeRef.current === 'uploading' && !uploadState.minimized) return;
        if (globalModeRef.current !== 'idle' && globalModeRef.current !== 'uploading') closeIsland();
        setLocalMode(newMode);
    };

    const [notifyData, setNotifyData] = useState<{ msg: string, type: string } | null>(null);

    useEffect(() => {
        const handleNotify = (e: any) => {
            if (globalModeRef.current === 'uploading') return;
            setNotifyData(e.detail);
            setLocalMode('notify');
            setTimeout(() => {
                setLocalMode((prev: any) => prev === 'notify' ? 'idle' : prev);
                setNotifyData(null);
            }, 3000);
        };
        window.addEventListener('island-notify', handleNotify);
        return () => window.removeEventListener('island-notify', handleNotify);
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);
    const [liveTicker, setLiveTicker] = useState<number | null>(null);
    const prevTickerRef = useRef<number | null>(null);
    const [display, setDisplay] = useState('');
    // Ripple effect bottoni calcolatrice: ogni click crea un ripple con coordinate locali
    // al bottone. Auto-cleanup dopo 600ms (durata animazione).
    const [calcRipples, setCalcRipples] = useState<Array<{ id: number; btn: string; x: number; y: number }>>([]);

    // === PILL SATELLITE INTELLIGENCE: ETA dinamico + stall detection ===
    const [uploadEta, setUploadEta] = useState<string>('—');
    const [uploadIsStalled, setUploadIsStalled] = useState(false);
    const uploadStartTimeRef = useRef<number | null>(null);
    const lastProgressUpdateRef = useRef<number>(0);
    const lastProgressValueRef = useRef<number>(0);
    const spawnRipple = (btn: string, e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = Date.now() + Math.random();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCalcRipples(prev => [...prev, { id, btn, x, y }]);
        setTimeout(() => setCalcRipples(prev => prev.filter(r => r.id !== id)), 600);
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [aiHistory, setAiHistory] = useState<Array<{ id: number; question: string; answer: string }>>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);

    // --- Avvocato Virtuale RAG (mode 'ai' — Local-First Ollama) ---
    const {
        ask: askAvvocato,
        streamingAnswer,
        sources: ragSources,
        isAsking: isAiThinking,
        error: ragError,
        reset: resetAvvocato,
        abort: abortAvvocato,
    } = useRagAvvocato();
    const [isRagAdminOpen, setIsRagAdminOpen] = useState(false);

    // --- Spotlight Cloud (mode 'ai_cloud' — Gemini Pro via Netlify Function) ---
    const [cloudResponse, setCloudResponse] = useState<string | null>(null);
    const [isCloudThinking, setIsCloudThinking] = useState(false);
    const [cloudHistory, setCloudHistory] = useState<Array<{ id: number; question: string; answer: string }>>([]);
    const [cloudHistoryIdx, setCloudHistoryIdx] = useState(-1);

    // pendingTickerRef: store a ticker value that arrived during upload so we can show it after upload ends
    const pendingTickerRef = useRef<number | null>(null);

    useEffect(() => {
        const handleTickerUpdate = (e: any) => {
            const newValue = e.detail;
            setLiveTicker(newValue);
            if (newValue !== null && newValue > 0 && newValue !== prevTickerRef.current) {
                prevTickerRef.current = newValue;
                if (globalModeRef.current === 'uploading') {
                    // Stash for display after upload ends instead of stomping on upload UI
                    pendingTickerRef.current = newValue;
                    return;
                }
                setLocalMode('ticker');
                setTimeout(() => { setLocalMode((prev: any) => prev === 'ticker' ? 'idle' : prev); }, 4000);
            } else if (newValue === null) {
                prevTickerRef.current = null;
            }
        };
        window.addEventListener('island-ticker', handleTickerUpdate);
        return () => window.removeEventListener('island-ticker', handleTickerUpdate);
    }, []);

    useEffect(() => {
        let dragCounter = 0;
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer?.types.includes('Files') && mode === 'idle') setMode('dropzone');
        };
        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0 && mode === 'dropzone') setMode('idle');
        };
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter = 0;
            if (mode === 'dropzone') setMode('idle');
        };
        const handleDragOver = (e: DragEvent) => e.preventDefault();

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);
        window.addEventListener('dragover', handleDragOver);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
            window.removeEventListener('dragover', handleDragOver);
        };
    }, [mode]);

    useEffect(() => {
        if ((mode === 'ai' || mode === 'ai_cloud') && searchQuery.trim().length > 1) {
            const query = searchQuery.toLowerCase();
            const matches = workers.filter(w =>
                w.nome.toLowerCase().includes(query) || w.cognome.toLowerCase().includes(query)
            ).slice(0, 3);
            setSearchResults(matches);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, mode, workers]);

    const handleOpenWorker = (worker: any) => {
        showWorkerStats(worker);
        setSearchQuery('');
    };

    // ──────────────────────────────────────────────────────────
    // MODE 'ai' — Avvocato Virtuale (Ollama RAG locale, con citazioni)
    // ──────────────────────────────────────────────────────────
    const handleAskAvvocato = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const question = searchQuery.trim();
        if (!question) return;

        setAiResponse(null);
        try {
            await askAvvocato(question, {
                worker: workerContext
                    ? {
                        nome: workerContext.nome,
                        cognome: workerContext.cognome,
                        profilo: workerContext.profilo,
                        eliorType: workerContext.eliorType,
                    }
                    : undefined,
            });
            setAiHistory(prev => [
                { id: Date.now(), question, answer: '' /* riempito post-stream */ },
                ...prev,
            ].slice(0, 5));
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                setAiResponse(`⚠️ ${err?.message ?? 'Errore Avvocato Virtuale'}`);
            }
        }
    };

    // Sincronizza la cronologia Avvocato con la risposta finale dello stream
    useEffect(() => {
        if (!isAiThinking && streamingAnswer && aiHistory.length > 0 && !aiHistory[0].answer) {
            setAiHistory(prev => prev.map((h, i) => (i === 0 ? { ...h, answer: streamingAnswer } : h)));
        }
    }, [isAiThinking, streamingAnswer, aiHistory]);

    const handleResetAi = () => {
        resetAvvocato();
        setAiResponse(null);
        setSearchQuery('');
        setHistoryIdx(-1);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleAiInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (aiHistory.length === 0) return;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.min(historyIdx + 1, aiHistory.length - 1);
            setHistoryIdx(next);
            setSearchQuery(aiHistory[next].question);
            setAiResponse(aiHistory[next].answer);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIdx > 0) {
                const prev = historyIdx - 1;
                setHistoryIdx(prev);
                setSearchQuery(aiHistory[prev].question);
                setAiResponse(aiHistory[prev].answer);
            } else {
                setHistoryIdx(-1);
                setSearchQuery('');
                setAiResponse(null);
            }
        }
    };

    // ──────────────────────────────────────────────────────────
    // MODE 'ai_cloud' — Spotlight Cloud (Gemini Pro via Netlify Function)
    // Risposta rapida senza retrieval, niente citazioni; utile come fallback
    // o per query generiche/test quando Ollama è giù o serve velocità.
    // ──────────────────────────────────────────────────────────
    const handleAskCloud = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsCloudThinking(true);
        setCloudResponse(null);
        const question = searchQuery;
        try {
            const response = await fetch('/.netlify/functions/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, workerContext })
            });
            const data = await response.json();
            if (!response.ok) {
                setCloudResponse(`⚠️ ${data.error || `Errore (${response.status})`}`);
            } else if (data.answer) {
                setCloudResponse(data.answer);
                setCloudHistory(prev => [{ id: Date.now(), question, answer: data.answer }, ...prev].slice(0, 5));
            } else {
                setCloudResponse('Il modello cloud non ha restituito una risposta valida. Riprova.');
            }
        } catch {
            setCloudResponse('Errore di connessione. Controlla la rete.');
        }
        setIsCloudThinking(false);
    };

    const handleResetCloud = () => {
        setCloudResponse(null);
        setSearchQuery('');
        setCloudHistoryIdx(-1);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleCloudInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (cloudHistory.length === 0) return;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.min(cloudHistoryIdx + 1, cloudHistory.length - 1);
            setCloudHistoryIdx(next);
            setSearchQuery(cloudHistory[next].question);
            setCloudResponse(cloudHistory[next].answer);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cloudHistoryIdx > 0) {
                const prev = cloudHistoryIdx - 1;
                setCloudHistoryIdx(prev);
                setSearchQuery(cloudHistory[prev].question);
                setCloudResponse(cloudHistory[prev].answer);
            } else {
                setCloudHistoryIdx(-1);
                setSearchQuery('');
                setCloudResponse(null);
            }
        }
    };

    const islandRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
                setIsUploadExpanded(false);
                if (localMode === 'menu' || localMode === 'ai' || localMode === 'ai_cloud' || localMode === 'calc') {
                    setMode('idle');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [localMode]);

    // --- LOGICA CALCOLATRICE MANUALE ---
    const handleInput = (val: string) => setDisplay(prev => prev + val);
    const handleClear = () => setDisplay('');

    // 🛡️ PARSER MATEMATICO SICURO (Recursive Descent)
    // Accetta SOLO numeri e operatori +, -, *, /
    // Gestisce correttamente la precedenza degli operatori.
    // Nessun eval(), nessun new Function(), zero rischio di code injection.
    const safeCalculate = (expr: string): number => {
        const sanitized = expr.replace(/,/g, '.').replace(/\s/g, '');

        // Validazione rigorosa: solo cifre, punto decimale e operatori aritmetici
        if (!/^[0-9+\-*/.]+$/.test(sanitized)) {
            throw new Error('Caratteri non ammessi');
        }

        let pos = 0;

        const peek = (): string => sanitized[pos] || '';
        const consume = (): string => sanitized[pos++];

        // Livello 3 (più alta precedenza): Numeri (inclusi decimali e negativi unari)
        const parseNumber = (): number => {
            let numStr = '';
            // Gestione segno negativo unario (es. "-5" o "3*-2")
            if (peek() === '-') {
                numStr += consume();
            }
            if (!/[0-9.]/.test(peek())) throw new Error('Numero atteso');
            while (/[0-9.]/.test(peek())) {
                numStr += consume();
            }
            const num = parseFloat(numStr);
            if (isNaN(num)) throw new Error('Numero non valido');
            return num;
        };

        // Livello 2: Moltiplicazione e Divisione
        const parseTerm = (): number => {
            let result = parseNumber();
            while (peek() === '*' || peek() === '/') {
                const op = consume();
                const right = parseNumber();
                if (op === '*') result *= right;
                else {
                    if (right === 0) throw new Error('Divisione per zero');
                    result /= right;
                }
            }
            return result;
        };

        // Livello 1 (più bassa precedenza): Addizione e Sottrazione
        const parseExpression = (): number => {
            let result = parseTerm();
            while (peek() === '+' || peek() === '-') {
                const op = consume();
                const right = parseTerm();
                if (op === '+') result += right;
                else result -= right;
            }
            return result;
        };

        const result = parseExpression();

        // Se non abbiamo consumato tutta la stringa, l'espressione è malformata
        if (pos < sanitized.length) throw new Error('Espressione non valida');

        return result;
    };

    const handleCalc = () => {
        if (!display) return;
        try {
            const operation = display;
            const result = safeCalculate(display);

            // Intercettiamo Infinity o NaN
            if (!Number.isFinite(result) || Number.isNaN(result)) {
                throw new Error("Calcolo impossibile");
            }

            const finalDisplay = String(result);
            setDisplay(finalDisplay);

            if (finalDisplay && finalDisplay !== 'Errore') {
                addCalcHistory(operation, finalDisplay);
            }
        } catch {
            setDisplay('Errore');
            setTimeout(() => setDisplay(''), 1000);
        }
    };
    const handleCopyResult = () => {
        if (display && display !== 'Errore') {
            navigator.clipboard.writeText(display);
            notifyIsland('Risultato copiato!', 'success');
            setTimeout(() => setMode('idle'), 500);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setMode(mode === 'idle' ? 'ai' : 'idle');
            }
            if (e.key === 'Escape' && mode !== 'idle') setMode('idle');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'calc') return;
        const handleCalcKeys = (e: KeyboardEvent) => {
            const key = e.key;
            if (key === 'Enter' || key === '=') { e.preventDefault(); handleCalc(); }
            else if (/[0-9+\-*/.]/.test(key)) { e.preventDefault(); handleInput(key); }
            else if (key === 'Backspace') setDisplay(prev => prev.slice(0, -1));
            else if (key === 'Delete' || key.toLowerCase() === 'c') handleClear();
        };
        window.addEventListener('keydown', handleCalcKeys);
        return () => window.removeEventListener('keydown', handleCalcKeys);
    }, [display, mode]);

    useEffect(() => {
        if ((mode === 'ai' || mode === 'ai_cloud') && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
    }, [mode]);

    // === PILL SATELLITE: tracking start time + reset stall on progress change ===
    useEffect(() => {
        if (uploadState.isUploading && !uploadState.isFinishing) {
            if (uploadStartTimeRef.current === null) {
                uploadStartTimeRef.current = Date.now();
                lastProgressUpdateRef.current = Date.now();
                lastProgressValueRef.current = 0;
                setUploadIsStalled(false);
                setUploadEta('—');
            }
        } else {
            uploadStartTimeRef.current = null;
        }
    }, [uploadState.isUploading, uploadState.isFinishing]);

    useEffect(() => {
        if (uploadState.progress !== lastProgressValueRef.current) {
            lastProgressValueRef.current = uploadState.progress;
            lastProgressUpdateRef.current = Date.now();
            setUploadIsStalled(false);
        }
    }, [uploadState.progress]);

    // ETA + stall watcher (1s tick), attivo solo durante upload non-finishing
    useEffect(() => {
        if (!uploadState.isUploading || uploadState.isFinishing) {
            setUploadEta('—');
            setUploadIsStalled(false);
            return;
        }
        const tick = () => {
            // ETA per batch e single (mobile non ha total significativo)
            if (uploadState.type !== 'mobile' && uploadStartTimeRef.current && uploadState.progress > 0 && uploadState.total > 0) {
                const elapsedMs = Date.now() - uploadStartTimeRef.current;
                const rate = uploadState.progress / (elapsedMs / 1000);
                const remainingItems = uploadState.total - uploadState.progress;
                if (rate > 0 && remainingItems > 0) {
                    const remainingSec = remainingItems / rate;
                    if (remainingSec < 1) setUploadEta('<1s');
                    else if (remainingSec < 60) setUploadEta(`${Math.ceil(remainingSec)}s`);
                    else setUploadEta(`${Math.floor(remainingSec / 60)}m ${Math.ceil(remainingSec % 60)}s`);
                } else {
                    setUploadEta('—');
                }
            }
            // Stall: nessun progress update da > 5s e progress < total
            if (Date.now() - lastProgressUpdateRef.current > 5000 && uploadState.progress < uploadState.total) {
                setUploadIsStalled(true);
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [uploadState.isUploading, uploadState.isFinishing, uploadState.type, uploadState.progress, uploadState.total]);

    // Flush any ticker value that was stashed while upload was running
    useEffect(() => {
        if (globalMode !== 'idle') return;
        if (pendingTickerRef.current !== null) {
            const pending = pendingTickerRef.current;
            pendingTickerRef.current = null;
            setLiveTicker(pending);
            setLocalMode('ticker');
            setTimeout(() => { setLocalMode((prev: any) => prev === 'ticker' ? 'idle' : prev); }, 4000);
        }
    }, [globalMode]);

    const getGlowColor = () => {
        if (mode === 'dropzone') return 'rgba(217, 70, 239, 0.8)';
        if (mode === 'notify' && notifyData?.type === 'error') return 'rgba(239,68,68,0.4)';
        if (mode === 'notify' && notifyData?.type === 'success') return 'rgba(16,185,129,0.4)';
        if (mode === 'ai') return 'rgba(139,92,246,0.4)';     // violet — Avvocato Virtuale (RAG locale)
        if (mode === 'ai_cloud') return 'rgba(217,70,239,0.4)'; // fuchsia — Spotlight Cloud (Gemini)
        if (mode === 'calc') return 'rgba(99,102,241,0.4)';
        if (mode === 'menu') return 'rgba(59,130,246,0.4)';
        if (mode === 'ticker') return 'rgba(16, 185, 129, 0.4)';
        if (mode === 'calc_history') return 'rgba(99,102,241,0.6)';
        if (mode === 'stats') return 'rgba(6, 182, 212, 0.5)';
        if (mode === 'notification') {
            if (notification?.type === 'success') return 'rgba(16,185,129,0.5)';
            if (notification?.type === 'warning') return 'rgba(245,158,11,0.5)';
            return 'rgba(59,130,246,0.5)';
        }
        if (mode === 'quick_actions') return 'rgba(148, 163, 184, 0.4)';
        if (mode === 'uploading') {
            if (uploadState.isFinishing) return uploadState.isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
            if (uploadState.type === 'batch') return 'rgba(139, 92, 246, 0.6)';
            if (uploadState.type === 'mobile') return 'rgba(99, 102, 241, 0.6)';
            return 'rgba(6, 182, 212, 0.6)';
        }
        return isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(99, 102, 241, 0.3)';
    };

    // Helper per generare colore con opacità arbitraria (es. per keyframes "respirante").
    const withOpacity = (op: number) => getGlowColor().replace(/[\d.]+\)\s*$/, `${op})`);

    // Varianti standard del glow (legacy compat per code che non usa keyframes).
    const getGlowColorMuted = () => withOpacity(0.12);
    const getGlowColorRing = () => withOpacity(0.55);

    const calcBtnClass = "relative overflow-hidden h-12 rounded-xl font-bold text-lg transition-[transform,background-color,color] active:scale-95 flex items-center justify-center shadow-sm";

    return (
        <div ref={islandRef} className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none group/island print:hidden">
            {/* Glow blob esterno: ambient (idle, dropzone). In idle fa COLOR DRIFT aurora-style. */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[50px] -z-10 pointer-events-none"
                animate={{
                    // ✨ COLOR DRIFT in idle: ciclo lento cyan → indigo → fuchsia → cyan (8s).
                    // Negli altri mode resta sul colore del mode.
                    backgroundColor: mode === 'idle'
                        ? (isDark
                            ? ['rgba(6,182,212,0.35)', 'rgba(99,102,241,0.35)', 'rgba(217,70,239,0.30)', 'rgba(6,182,212,0.35)']
                            : ['rgba(99,102,241,0.30)', 'rgba(168,85,247,0.28)', 'rgba(217,70,239,0.26)', 'rgba(99,102,241,0.30)'])
                        : getGlowColor(),
                    width: mode === 'idle' ? ['90px', '190px', '90px'] : mode === 'dropzone' ? '300px' : '140px',
                    height: mode === 'idle' ? ['24px', '64px', '24px'] : mode === 'dropzone' ? '100px' : '40px',
                    opacity: mode === 'idle' ? [0.4, 1.0, 0.4] : mode === 'dropzone' ? 1 : 0,
                    scale: mode === 'idle' ? [0.9, 1.2, 0.9] : 1,
                }}
                transition={mode === 'idle'
                    ? {
                        repeat: Infinity,
                        duration: 4,
                        ease: "easeInOut",
                        // Color drift su scala temporale più lunga (8s) per non sovrapporsi al pulse della forma.
                        backgroundColor: { repeat: Infinity, duration: 8, ease: "easeInOut" },
                    }
                    : { duration: 0.4, ease: APPLE_EASE }
                }
            />

            <motion.div
                // ❌ NIENTE `layout` prop: causava lo "schiacciamento" via transform scale.
                // Animo `width` e `borderRadius` come property esplicite → niente distorsione.
                initial={false}
                transition={{
                    // Liquid morphing: overshoot ~6% per sensazione "gel" Apple Dynamic Island-style
                    width: FRAMER_PHYSICS.dynamicIslandElastic,
                    borderRadius: FRAMER_PHYSICS.dynamicIslandElastic,
                    x: FRAMER_PHYSICS.dynamicIsland,
                    // Neon "respirante": loop 3.5s con ease morbido per i mode con array.
                    // Per mode statici (uploading/dropzone) usa lo spring transition normale.
                    boxShadow: (mode === 'idle' || (mode !== 'uploading' && mode !== 'dropzone'))
                        ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
                        : FRAMER_PHYSICS.dynamicIsland,
                }}
                className={getIslandStyles(mode, isUploadExpanded, uploadState)}
                style={{
                    minHeight: (mode === 'idle' || mode === 'notify' || mode === 'ticker' || mode === 'quick_actions' || (mode === 'uploading' && !isUploadExpanded)) ? '40px' : 'auto',
                    cursor: mode === 'idle' ? 'pointer' : (mode === 'ai' || mode === 'ai_cloud') ? 'text' : 'default',
                    willChange: 'width, border-radius, transform',
                    overflow: 'hidden',
                    // FIX backdrop-filter corner bug: forza un proprio stacking context
                    // così il backdrop-blur è clippato correttamente dal border-radius anche
                    // durante repaint dei figli (es. active:scale-95 dei bottoni calcolatrice).
                    isolation: 'isolate',
                    // GPU layer forzato (no conflict con `transform` gestito da Framer Motion).
                    backfaceVisibility: 'hidden',
                }}
                animate={
                    (mode === 'uploading' && uploadState.isError) || display === 'Errore'
                        ? {
                            x: [0, -8, 8, -6, 6, -3, 3, 0],
                            width: getIslandWidth(mode, isUploadExpanded, uploadState),
                            borderRadius: getIslandBorderRadius(mode, isUploadExpanded, uploadState),
                        }
                        : {
                            x: 0,
                            width: getIslandWidth(mode, isUploadExpanded, uploadState),
                            borderRadius: getIslandBorderRadius(mode, isUploadExpanded, uploadState),
                            boxShadow: mode === 'idle'
                                ? [
                                    `0 0 15px 2px ${getGlowColor()}, 0 0 30px 5px transparent`,
                                    `0 0 28px 10px ${getGlowColor()}, 0 0 55px 18px ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(99,102,241,0.12)'}`,
                                    `0 0 15px 2px ${getGlowColor()}, 0 0 30px 5px transparent`
                                ]
                                : mode === 'uploading' ? 'none'
                                : mode === 'dropzone' ? `0 0 20px 5px ${getGlowColor()}`
                                // ✨ NEON RESPIRANTE per i mode espansi: array di 3 keyframes che pulsano
                                //  in 3.5s loop. Opacità ridotte rispetto al primo tentativo: il glow
                                //  saturato troppo creava la "cornice rettangolare" percettiva durante
                                //  i repaint. Layer:
                                //  1. Ring 1.5px (segue border-radius con precisione)
                                //  2. Neon core 6px (filamento)
                                //  3. Halo medio 14px (sfumatura)
                                //  4. Atmosphere 32px (alone lontano)
                                //  5+6. Drop-shadow scuri per profondità Apple
                                : [
                                    `0 0 0 1.5px ${withOpacity(0.40)}, 0 0 6px 0 ${withOpacity(0.30)}, 0 0 14px 0 ${withOpacity(0.18)}, 0 0 32px 2px ${withOpacity(0.08)}, 0 20px 40px -12px ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.25)'}, 0 8px 16px -8px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.15)'}`,
                                    `0 0 0 1.5px ${withOpacity(0.65)}, 0 0 6px 0 ${withOpacity(0.50)}, 0 0 14px 0 ${withOpacity(0.28)}, 0 0 32px 2px ${withOpacity(0.14)}, 0 20px 40px -12px ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.25)'}, 0 8px 16px -8px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.15)'}`,
                                    `0 0 0 1.5px ${withOpacity(0.40)}, 0 0 6px 0 ${withOpacity(0.30)}, 0 0 14px 0 ${withOpacity(0.18)}, 0 0 32px 2px ${withOpacity(0.08)}, 0 20px 40px -12px ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.25)'}, 0 8px 16px -8px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.15)'}`,
                                ]
                        }
                }
                whileHover={mode === 'idle' ? {
                    boxShadow: `0 0 35px 12px ${getGlowColor()}, 0 0 60px 20px ${isDark ? 'rgba(6,182,212,0.35)' : 'rgba(99,102,241,0.18)'}`,
                    scale: 1.03,
                    transition: { duration: 0.4, ease: "easeOut" }
                } : undefined}
                whileTap={mode === 'idle' ? {
                    scale: 0.94,
                    transition: { type: 'spring' as const, stiffness: 500, damping: 30 }
                } : undefined}
            >
                <AnimatePresence mode="wait">

                    {/* STATO UPLOADING: I 3 SCENARI CONSERVATI E CLICCABILI */}
                    {mode === 'uploading' && (() => {
                        // ✨ BLOCCO 1 SOSTITUITO: I NUOVI COLORI E OMBRE PER I BAGLIORI
                        const activeTheme = uploadState.type === 'batch' ? {
                            bg: 'bg-linear-to-br from-violet-900 via-[#8b5cf6] to-fuchsia-800',
                            laser: 'border-fuchsia-400 shadow-[0_0_12px_1px_#d946ef]', // Updated rings
                            sparkle: 'text-fuchsia-200', // Robot color
                            timeline: 'bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_4px_#fff]',
                            nodeOn: 'bg-white border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]',
                            text: 'text-cyan-600 dark:text-cyan-400',
                            badge: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-700',
                            border: 'border-fuchsia-400 shadow-[0_4px_12px_rgba(217,70,239,0.2)]',
                            laserBar: 'bg-fuchsia-400'
                        } : uploadState.type === 'mobile' ? {
                            bg: 'bg-linear-to-br from-slate-900 via-indigo-600 to-blue-800',
                            laser: 'border-cyan-400 shadow-[0_0_12px_1px_#22d3ee]',
                            sparkle: 'text-cyan-200',
                            timeline: 'bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_4px_#fff]',
                            nodeOn: 'bg-white border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]',
                            text: 'text-cyan-600 dark:text-cyan-400',
                            badge: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
                            border: 'border-cyan-400 shadow-[0_4px_12px_rgba(34,211,238,0.2)]',
                            laserBar: 'bg-indigo-400'
                        } : {
                            bg: 'bg-linear-to-br from-slate-900 via-cyan-600 to-sky-800',
                            laser: 'border-cyan-400 shadow-[0_0_12px_1px_#22d3ee]',
                            sparkle: 'text-cyan-200',
                            timeline: 'bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_4px_#fff]',
                            nodeOn: 'bg-white border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]',
                            text: 'text-cyan-600 dark:text-cyan-400',
                            badge: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
                            border: 'border-cyan-400 shadow-[0_4px_12px_rgba(34,211,238,0.2)]',
                            laserBar: 'bg-cyan-400'
                        };

                        const progressRatio = uploadState.progress / Math.max(1, uploadState.total);

                        return (
                            <motion.div
                                key="uploading"
                                layout
                                initial={{ opacity: 0, y: -10, scale: 0.98, borderRadius: 20 }}
                                animate={{ opacity: 1, y: 0, scale: 1, borderRadius: isUploadExpanded && !uploadState.isFinishing ? 32 : 20 }}
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                onClick={() => !uploadState.isFinishing && setIsUploadExpanded(!isUploadExpanded)}
                                // ✨ FIX SQUADRATURE: Maschere e fix obsoleti rimossi. Usiamo overflow nativo.
                                style={{ overflow: 'hidden', isolation: 'isolate' }}
                                className={`relative w-full flex flex-col cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/20 overflow-hidden ${isUploadExpanded && !uploadState.isFinishing ? 'rounded-[32px]' : 'rounded-[20px]'}`}
                            >
                                {/* ✨ FIX 1: CROSSFADE FLUIDO DEL BACKGROUND */}
                                {/* Livello Base (Viola/Azzurro) */}
                                <div className={`absolute inset-0 z-0 ${activeTheme.bg}`}></div>

                                {/* Livello di Completamento (Verde o Rosso) che appare in morbida dissolvenza */}
                                <motion.div
                                    className={`absolute inset-0 z-0 ${uploadState.isError ? 'bg-linear-to-br from-red-800 to-red-600' : 'bg-linear-to-br from-emerald-500 to-teal-400'}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: uploadState.isFinishing ? 1 : 0 }}
                                    transition={{ duration: 0.6, ease: "easeInOut" }}
                                />

                                {!uploadState.isFinishing && (
                                    <div className="absolute inset-0 z-0 pointer-events-none">
                                        {[...Array(24)].map((_, i) => (
                                            <motion.div key={`sparkle-${i}`} className="absolute bg-white rounded-full mix-blend-overlay"
                                                style={{ width: Math.random() * 2.5 + 'px', height: Math.random() * 2.5 + 'px', left: Math.random() * 100 + '%', top: Math.random() * 100 + '%' }}
                                                animate={{ opacity: [0, Math.random() * 0.8 + 0.2, 0], scale: [0, 1.5, 0] }}
                                                transition={{ duration: Math.random() * 2 + 1, repeat: Infinity, delay: Math.random() * 2 }}
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="absolute top-0 left-[5%] right-[5%] h-[1px] bg-linear-to-r from-transparent via-white/50 to-transparent pointer-events-none z-10"></div>
                                <div className="absolute top-0 left-0 right-0 h-[40px] bg-linear-to-b from-white/20 to-transparent pointer-events-none z-10"></div>

                                {/* HEADER COMPATTO */}
                                <motion.div layout="position" className="relative z-20 flex items-center justify-between px-4 h-[40px] shrink-0 w-full">
                                    {/* ✨ BLOCCO 2 SOSTITUITO: IL NUOVO ROBOT PULSANTE CON ANELLI 3D */}
                                    <div className="relative w-7 h-7 flex items-center justify-center shrink-0 -ml-1">
                                        <AnimatePresence mode="wait">
                                            {uploadState.isFinishing ? (
                                                <motion.div key="done" initial={{ scale: 0, rotate: uploadState.isError ? -180 : 180 }} animate={{ scale: 1, rotate: 0 }} className="absolute z-10">
                                                    {uploadState.isError ? <XCircle className="w-6 h-6 text-white" /> : <CheckCircle2 className="w-6 h-6 text-white" />}
                                                </motion.div>
                                            ) : (
                                                <motion.div key="bot-core" className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                                >
                                                    {/* 1. ALONE PROFONDO DI SFONDO */}
                                                    <motion.div
                                                        className={`absolute inset-1 rounded-full ${activeTheme.bg} blur-md`}
                                                        animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
                                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                                    />

                                                    {/* 2. ANELLI NEURALI DINAMICI */}
                                                    <motion.div
                                                        animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                                                        transition={{ rotate: { repeat: Infinity, duration: 1.2, ease: "linear" }, scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" } }}
                                                        className={`absolute inset-[-1.5px] border-t-[1.5px] border-l-[1.5px] border-white rounded-full ${activeTheme.laser} transition-colors duration-500`}
                                                    />
                                                    <motion.div
                                                        animate={{ rotate: -360, opacity: [0.3, 0.6, 0.3] }}
                                                        transition={{ rotate: { repeat: Infinity, duration: 3.5, ease: "linear" }, opacity: { repeat: Infinity, duration: 2, ease: "easeInOut" } }}
                                                        className={`absolute inset-[1.5px] border-[1px] border-dashed border-white/50 rounded-full transition-all duration-500`}
                                                    />

                                                    {/* 3. IL ROBOT CENTRALE CON BAGLIORE INTENSIFICATO */}
                                                    <motion.div
                                                        animate={{ scale: [1, 1.25, 1] }}
                                                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                        className="relative flex items-center justify-center"
                                                    >
                                                        {/* Orbite di luce interna (Shine) */}
                                                        <motion.div className={`absolute w-3 h-3 rounded-full bg-white/40 blur-[3px] transition-all`}
                                                            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                        />

                                                        <Bot size={13}
                                                            className={`relative z-10 ${activeTheme.sparkle} transition-colors duration-500`}
                                                            style={{ filter: `drop-shadow(0 0 1px white) drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px currentColor)` }}
                                                        />
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* ✨ Titolo Centrale (Visibile SOLO quando ESPANSA) */}
                                    <AnimatePresence>
                                        {isUploadExpanded && (
                                            <motion.div
                                                key="title-center"
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20"
                                            >
                                                {/* RIMESSO BIANCO E CON IL TUO TESTO ORIGINALE */}
                                                <span className="text-[11px] font-black text-white tracking-[0.15em] uppercase drop-shadow-md">
                                                    {uploadState.isFinishing ? (uploadState.isError ? 'Errore' : 'Completato') : 'Scansione...'}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* ✨ Bottone Minimize — visibile durante TUTTO l'upload (espanso + collassato).
                                        Posizione absolute right-1 con z-40, sopra contatori e titolo per garanzia di click. */}
                                    <AnimatePresence>
                                        {!uploadState.isFinishing && (
                                            <motion.button
                                                key="minimize-btn"
                                                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                                                whileHover={{ scale: 1.15 }}
                                                whileTap={{ scale: 0.92 }}
                                                onClick={(e) => { e.stopPropagation(); minimizeUpload(); }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-white/85 hover:text-white bg-white/10 hover:bg-white/25 rounded-full transition-colors z-40 pointer-events-auto border border-white/20 hover:border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                                                title="Minimizza in pill — libera l'isola per altre azioni"
                                            >
                                                <Minimize2 size={14} strokeWidth={2.5} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>

                                    {/* ✨ Contatore Laterale (Visibile SOLO quando CHIUSA) */}
                                    <AnimatePresence>
                                        {!isUploadExpanded && !uploadState.isFinishing && (
                                            <motion.div
                                                key="counter-side"
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="ml-auto mr-8 flex items-center justify-end font-mono text-[12px] font-bold text-white relative z-20 min-w-[100px]"
                                            >
                                                {uploadState.type === 'mobile' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></div>
                                                        <span className="text-[10px] uppercase tracking-widest opacity-90 text-cyan-300 drop-shadow-md">
                                                            In Ascolto
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] uppercase tracking-widest mr-2 opacity-90 truncate text-slate-300">
                                                            Scansione
                                                        </span>
                                                        <div className="flex items-center justify-end shrink-0">
                                                            <motion.span key={uploadState.progress} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="drop-shadow-md text-lg text-white">
                                                                {uploadState.progress}
                                                            </motion.span>
                                                        </div>
                                                        {uploadState.type === 'batch' && (
                                                            <div className="flex items-center ml-1">
                                                                <span className="opacity-50 text-[10px] mx-0.5">/</span>
                                                                <span className="opacity-80">{uploadState.total}</span>
                                                            </div>
                                                        )}
                                                        {/* ✨ IL FIX: ORA IL % APPARE SOLO SE È UNA SCANSIONE SINGOLA (0-100) */}
                                                        {uploadState.type === 'single' && (
                                                            <span className="opacity-80 ml-0.5">%</span>
                                                        )}
                                                    </>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>

                                {/* LE TUE VISTE ESPANSE ORIGINALI - ORA POTENZIATE */}
                                <AnimatePresence initial={false}>
                                    {isUploadExpanded && !uploadState.isFinishing && (
                                        <motion.div
                                            key="expanded-view"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ height: { type: "tween", duration: 0.35, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
                                            className="relative z-20 flex flex-col w-full overflow-hidden origin-top"
                                        >
                                            <div className="pb-1 w-full flex flex-col">
                                                <div className="px-6 pt-3 pb-8 w-full relative z-10">

                                                    {/* PARTICELLE NEURALI 3D */}
                                                    <div
                                                        className="absolute inset-0 z-0 pointer-events-none"
                                                        style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}
                                                    >
                                                        {[...Array(30)].map((_, i) => {
                                                            const size = Math.random() * 3 + 1;
                                                            return (
                                                                <motion.div key={`expand-spark-${i}`}
                                                                    className={`absolute rounded-full ${i % 3 === 0 ? 'bg-white' : activeTheme.sparkle} mix-blend-screen`}
                                                                    style={{
                                                                        width: `${size}px`, height: `${size}px`,
                                                                        left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                                                                        boxShadow: `0 0 ${size * 2}px currentColor`,
                                                                        filter: i % 4 === 0 ? 'blur(1px)' : 'none'
                                                                    }}
                                                                    animate={{
                                                                        opacity: [0, Math.random() * 0.9 + 0.3, 0],
                                                                        y: [0, -Math.random() * 30 - 15],
                                                                        x: Math.sin(i) * 15,
                                                                        scale: [0, Math.random() * 1.2 + 0.8, 0]
                                                                    }}
                                                                    transition={{ duration: Math.random() * 2.5 + 1.5, repeat: Infinity, delay: Math.random() * 2, ease: "easeInOut" }}
                                                                />
                                                            );
                                                        })}
                                                    </div>

                                                    {/* TIMELINE CON TESTINA LASER */}
                                                    <div className="relative h-2 flex items-center w-full mt-2">
                                                        <div className="absolute left-0 right-0 h-[2px] bg-white/20 rounded-full"></div>
                                                        <motion.div
                                                            className={`absolute left-0 h-[2px] rounded-full ${activeTheme.timeline}`}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${progressRatio * 100}%`, opacity: [0.6, 1, 0.6] }}
                                                            transition={{ width: { type: "spring", damping: 20 }, opacity: { repeat: Infinity, duration: 1.5, ease: "easeInOut" } }}
                                                        >
                                                            {/* ✨ LA TESTINA LASER IN PUNTA */}
                                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[3px] bg-white rounded-full shadow-[0_0_8px_3px_white] z-20" />
                                                        </motion.div>

                                                        <div className="absolute inset-0 flex justify-between items-center">
                                                            {uploadState.type === 'batch' && [...Array(uploadState.total)].map((_, i) => {
                                                                const isPast = i < uploadState.progress - 1;
                                                                const isCurrent = i === uploadState.progress - 1;
                                                                return (
                                                                    <motion.div
                                                                        key={i}
                                                                        initial={false}
                                                                        animate={{ scale: isCurrent ? [1, 1.6, 1.4] : 1 }}
                                                                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                                                        className={`w-2.5 h-2.5 rounded-full border-2 transition-colors duration-300 z-10 ${isPast || isCurrent ? activeTheme.nodeOn : 'bg-transparent border-white/40'}`}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PANNELLO CENTRALE */}
                                                <div className="relative z-30 -mt-5 mx-1.5 mb-1.5">
                                                    {/* Alone pulsante dietro la card */}
                                                    <motion.div
                                                        className={`absolute -inset-1 rounded-[26px] opacity-30 blur-md ${activeTheme.bg}`}
                                                        animate={{ scale: [0.98, 1.02, 0.98], opacity: [0.2, 0.4, 0.2] }}
                                                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                                    />

                                                    <motion.div
                                                        initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} transition={{ type: "spring", damping: 25 }}
                                                        className="bg-white dark:bg-[#0f172a] rounded-[24px] p-5 shadow-2xl relative overflow-hidden group/card"
                                                    >
                                                        {/* ✨ RIFLESSO OLOGRAFICO (GLASS SWEEP) */}
                                                        <motion.div
                                                            className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-white/20 dark:via-white/5 to-transparent skew-x-12 pointer-events-none"
                                                            animate={{ left: ['-100%', '200%'] }}
                                                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", repeatDelay: 1.5 }}
                                                        />

                                                        <div className="relative z-10 text-center mb-4">
                                                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide">
                                                                {uploadState.type === 'batch' ? 'Motore IA Neurale:' : uploadState.type === 'mobile' ? 'Sincronizzazione Dati:' : 'Deep Scan Busta:'}
                                                            </h4>
                                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">Analisi Documentale</p>
                                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${activeTheme.badge}`}>
                                                                {currentScanLabel || 'Inizializzazione...'}
                                                            </span>
                                                        </div>

                                                        {/* SCENARIO 1: BATCH CON STAGGER ANIMATION */}
                                                        {uploadState.type === 'batch' && (
                                                            <div className="relative z-10 w-full flex flex-wrap justify-center gap-2 mb-4">
                                                                {[...Array(uploadState.total)].map((_, index) => {
                                                                    const isCompleted = index < uploadState.progress - 1;
                                                                    const isCurrent = index === uploadState.progress - 1;
                                                                    return (
                                                                        <motion.div
                                                                            key={index}
                                                                            // ✨ INGRESSO A CASCATA (Pop-in scaglionato)
                                                                            initial={{ scale: 0, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            transition={{ type: "spring", damping: 20, delay: index * 0.05 }}
                                                                            className={`relative flex items-center justify-center w-9 h-11 rounded border transition-all duration-300 
                                                                                ${isCompleted ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-90' :
                                                                                    isCurrent ? `bg-white dark:bg-slate-900 border-2 ${activeTheme.border} scale-110 z-10 shadow-lg` :
                                                                                        'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 opacity-50'}`}
                                                                        >
                                                                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-linear-to-bl from-transparent via-slate-200 to-slate-300 dark:via-slate-600 dark:to-slate-700 rounded-bl-sm z-10 shadow-[-1px_1px_2px_rgba(0,0,0,0.1)]"></div>
                                                                            <div className="absolute top-2 left-1.5 flex flex-col gap-[2px] opacity-30">
                                                                                <div className="w-3 h-[1.5px] bg-slate-500 rounded-full"></div>
                                                                                <div className="w-5 h-[1.5px] bg-slate-500 rounded-full"></div>
                                                                            </div>
                                                                            {isCompleted ? (
                                                                                // ✨ FIX 2: RIMBALZO ELASTICO (POP) DEL FOGLIETTO COMPLETATO
                                                                                <motion.div
                                                                                    initial={{ scale: 0, rotate: -45 }}
                                                                                    animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                                                                                    transition={{ type: "spring", stiffness: 300, damping: 12 }}
                                                                                    className="absolute -bottom-1 -right-1 bg-white dark:bg-[#0f172a] rounded-full p-[1px] z-20 shadow-sm"
                                                                                >
                                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" fill="currentColor" stroke="white" strokeWidth={2} />
                                                                                </motion.div>
                                                                            ) : (
                                                                                <span className={`text-xs font-black relative z-10 mt-1 ${isCurrent ? activeTheme.text : 'text-slate-400 dark:text-slate-500'}`}>{index + 1}</span>
                                                                            )}
                                                                        </motion.div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* SCENARIO 2: DEEP SCAN CON RAGGIO VOLUMETRICO */}
                                                        {uploadState.type === 'single' && (
                                                            <div className="relative z-10 flex justify-center items-center gap-6 mb-4 w-full px-2">
                                                                <div className="relative w-[50px] h-[64px] bg-slate-50 dark:bg-slate-800 rounded-md border-2 border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden shrink-0">
                                                                    <div className="absolute top-0 right-0 w-4 h-4 bg-linear-to-bl from-transparent via-slate-200 to-slate-300 dark:via-slate-600 dark:to-slate-700 rounded-bl-sm shadow-[-1px_1px_2px_rgba(0,0,0,0.1)] z-30"></div>
                                                                    <div className="absolute top-3 left-2 flex flex-col gap-1.5 opacity-40">
                                                                        <div className="w-4 h-1 bg-slate-500 rounded-full"></div>
                                                                        <div className="w-8 h-0.5 bg-slate-500 rounded-full"></div>
                                                                        <div className="w-6 h-0.5 bg-slate-500 rounded-full"></div>
                                                                    </div>
                                                                    {/* ✨ RAGGIO SCANNER POTENZIATO */}
                                                                    <motion.div
                                                                        animate={{ y: [-30, 70, -30] }}
                                                                        transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                                                                        className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-transparent to-cyan-400/30 border-b-[2px] border-cyan-400 shadow-[0_4px_10px_rgba(34,211,238,0.5)] z-20"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-2 w-full">
                                                                    {[
                                                                        { label: 'Scansione OCR', threshold: 0.2 },
                                                                        { label: 'Analisi Voci', threshold: 0.6 },
                                                                        { label: 'Validazione Netto', threshold: 0.9 }
                                                                    ].map((step, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2">
                                                                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all duration-500 ${progressRatio > step.threshold ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>
                                                                                {progressRatio > step.threshold && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-2.5 h-2.5 text-white" strokeWidth={4} /></motion.div>}
                                                                            </div>
                                                                            <span className={`text-[10px] font-bold transition-colors duration-500 ${progressRatio > step.threshold ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{step.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* SCENARIO 3: LA VASCA LIQUIDA E IL TERMINALE COMPUTER (PURE FACELIFT) */}
                                                        {uploadState.type === 'mobile' && (
                                                            <div className="relative z-10 flex flex-col items-center justify-start mb-2 mt-1 w-full px-4 h-full pointer-events-auto">

                                                                {/* --- PARTE SUPERIORE: LA VASCA LIQUIDA E IL CONTATORE --- */}
                                                                <div className="flex items-center justify-center gap-6 w-full mb-4 px-2">

                                                                    {/* Vaschetta di Raccolta (Glassmorphism vuoto) */}
                                                                    <div className="relative w-12 h-16 bg-slate-900/80 rounded-b-xl rounded-t-sm border-[2px] border-slate-700/80 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] overflow-hidden shrink-0">

                                                                        {/* Riflesso Curvo del Vetro */}
                                                                        <div className="absolute top-0 left-1 w-1.5 h-full bg-white/20 blur-[1px] rounded-full z-20"></div>

                                                                        {/* ✨ EFFETTO "VERSAMENTO" (Stream di liquido azzurro che scende dall'alto) */}
                                                                        {!uploadState.isFinishing && uploadState.progress > 0 && (
                                                                            <motion.div
                                                                                key={`versamento-${uploadState.progress}`}
                                                                                initial={{ top: -10, opacity: 0, scaleY: 0 }}
                                                                                animate={{ top: 20, opacity: [0, 1, 0], scaleY: [0, 1, 0.5], y: [0, 10, 20] }}
                                                                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                                                                className="absolute left-1/2 -translate-x-1/2 w-1 h-10 bg-linear-to-b from-cyan-400 via-blue-500 to-transparent rounded-full blur-[2px] z-20"
                                                                            />
                                                                        )}

                                                                        {/* Il Liquido Azzurro Elettrico Organico */}
                                                                        <motion.div
                                                                            className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-blue-700 via-cyan-500 to-cyan-300 z-10"
                                                                            initial={{ height: '5%' }}
                                                                            // Il liquido sale a scatti (Max 10 file per ora, scalalo se serve)
                                                                            animate={{ height: `${Math.min(100, (uploadState.progress / Math.max(1, uploadState.total || 10)) * 100)}%` }}
                                                                            transition={{ type: "spring", stiffness: 50, damping: 12 }}
                                                                        >
                                                                            {/* Linea chiara di superficie dell'acqua */}
                                                                            <div className="absolute top-[-3px] left-0 right-0 h-1.5 bg-cyan-200/60 rounded-[50%] blur-[1px]"></div>
                                                                        </motion.div>
                                                                    </div>

                                                                    {/* Il Numero che si aggiorna (Il "Contenitore" Visivo) */}
                                                                    <div className="flex flex-col items-start">
                                                                        <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-0.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                                                                            Vaschetta Raccolta
                                                                        </span>
                                                                        <div className="flex items-baseline gap-1">
                                                                            <motion.span
                                                                                key={uploadState.progress}
                                                                                initial={{ scale: 1.5, color: '#22d3ee' }}
                                                                                animate={{ scale: 1, color: '#ffffff' }}
                                                                                transition={{ type: "spring", damping: 15 }}
                                                                                className="text-4xl font-black drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                                                            >
                                                                                {uploadState.progress}
                                                                            </motion.span>
                                                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                                                                Fascicoli
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* --- PARTE INFERIORE: IL VERO TERMINALE COMPUTER RIFINITO --- */}
                                                                <div className="w-full bg-[#050505] border border-slate-700 rounded-lg overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col h-[95px] shrink-0 mb-3">

                                                                    {/* Header Finestra Stile macOS */}
                                                                    <div className="h-5 bg-linear-to-b from-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center px-2 gap-1.5 shrink-0 w-full relative z-20">
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] shadow-[0_0_4px_#ff5f56]"></div>
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] shadow-[0_0_4px_#ffbd2e]"></div>
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] shadow-[0_0_4px_#27c93f]"></div>
                                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                            <span className="text-[9px] font-mono text-slate-400 tracking-wider">root@uplink-server:~</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Schermo Logs (Monospace hacker style) */}
                                                                    <div className="flex-1 p-2 pb-1 relative overflow-hidden flex flex-col justify-end bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:10px_10px]">
                                                                        {/* Scanline Dinamica */}
                                                                        <motion.div
                                                                            className="absolute left-0 right-0 h-4 bg-linear-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none z-10"
                                                                            animate={{ top: ['-10%', '110%'] }}
                                                                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                                        />

                                                                        {syncLogs.length === 0 ? (
                                                                            <div className="flex items-center gap-2 text-cyan-500/80 mt-auto relative z-20">
                                                                                <span className="text-[10px] font-mono uppercase tracking-widest">Waiting for incoming data</span>
                                                                                <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 h-3 bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col gap-0.5 relative z-20 w-full">
                                                                                <AnimatePresence initial={false}>
                                                                                    {[...syncLogs].reverse().map((log, i, arr) => {
                                                                                        const isLast = i === arr.length - 1;
                                                                                        return (
                                                                                            <motion.div
                                                                                                key={`${log}-${i}`} // <-- CHIAVE UNICA SICURA
                                                                                                initial={{ opacity: 0, x: -10 }}
                                                                                                animate={{ opacity: isLast ? 1 : 0.5, x: 0 }}
                                                                                                className="flex items-start gap-1.5 w-full"
                                                                                            >
                                                                                                <span className="text-[10px] text-emerald-400 font-mono mt-[1px] shrink-0">~%</span>
                                                                                                <span className={`text-[10px] font-mono ${isLast ? 'text-cyan-50 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]' : 'text-cyan-600'} truncate w-full leading-tight`}>
                                                                                                    {log}
                                                                                                </span>
                                                                                                {isLast && (
                                                                                                    <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 h-2.5 bg-cyan-400 mt-0.5 shadow-[0_0_5px_#22d3ee] shrink-0" />
                                                                                                )}
                                                                                            </motion.div>
                                                                                        );
                                                                                    })}
                                                                                </AnimatePresence>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Diciture Sotto (Solo Batch) */}
                                                        {uploadState.type === 'batch' && (
                                                            <div className="relative z-10 flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                                                <span>Elaborate ({uploadState.progress}/{uploadState.total})</span>
                                                                <span>In attesa ({uploadState.total - uploadState.progress})</span>
                                                            </div>
                                                        )}

                                                        <div className="relative z-10 w-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex items-center gap-3 transition-all">
                                                            <div className="bg-emerald-100 dark:bg-emerald-900/80 p-1.5 rounded-full shrink-0 shadow-sm"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} /></div>
                                                            <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium leading-tight">
                                                                Nessuna anomalia rilevata.<br />
                                                                <b className="font-black text-emerald-900 dark:text-emerald-200">
                                                                    {uploadState.type === 'batch' ? `${uploadState.progress} Buste elaborate.` : 'Controllo integrità superato.'}
                                                                </b>
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {!isUploadExpanded && !uploadState.isFinishing && (
                                    <motion.div className={`absolute bottom-0 left-0 right-0 h-[2px] ${activeTheme.laserBar}`}
                                        initial={{ width: 0 }} animate={{ width: `${progressRatio * 100}%` }}
                                    />
                                )}
                            </motion.div>
                        );
                    })()}

                    {/* STATO 1: IDLE */}
                    {mode === 'idle' && (
                        <motion.div key="idle" initial={{ opacity: 0, filter: 'blur(5px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.28, ease: APPLE_EASE } }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="flex items-center justify-center px-4 py-2.5 h-full w-full group cursor-pointer" onClick={() => setMode('menu')}>
                            {/* ✨ HEARTBEAT DOT: pattern 2-pulse + lunga pausa, ciclo 4s.
                                Sostituisce la vecchia barra centrale per dare "vita" all'isola idle.
                                Svanisce al hover per fare spazio alle icone shortcut. */}
                            <motion.div
                                className="absolute w-2 h-2 rounded-full bg-slate-400/50 dark:bg-cyan-400/60 transition-opacity duration-300 group-hover:opacity-0 group-hover:scale-50"
                                animate={{
                                    scale: [0.85, 1.4, 0.95, 1.2, 0.85],
                                    opacity: [0.45, 1, 0.7, 0.95, 0.45],
                                }}
                                transition={{
                                    duration: 4,
                                    times: [0, 0.06, 0.12, 0.18, 1],
                                    repeat: Infinity,
                                    ease: "easeOut",
                                }}
                                style={{
                                    boxShadow: isDark
                                        ? '0 0 6px rgba(34,211,238,0.6), 0 0 14px rgba(34,211,238,0.3)'
                                        : '0 0 6px rgba(99,102,241,0.5), 0 0 14px rgba(99,102,241,0.25)',
                                }}
                            />
                            <div className="flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100 w-full relative z-10">
                                <button onClick={(e) => { e.stopPropagation(); setMode('menu'); }} className="text-slate-500 dark:text-cyan-600 hover:text-slate-800 dark:hover:text-cyan-300 transition-colors" title="Menu"><LayoutGrid size={16} strokeWidth={2.5} /></button>
                                <div className="w-px h-4 bg-slate-300 dark:bg-cyan-900/50"></div>
                                <button onClick={(e) => { e.stopPropagation(); setMode('calc'); }} className="text-slate-500 dark:text-cyan-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Calcolatrice"><Calculator size={16} strokeWidth={2.5} /></button>
                                <div className="w-px h-4 bg-slate-300 dark:bg-cyan-900/50"></div>
                                <button onClick={(e) => { e.stopPropagation(); setMode('ai'); }} className="text-slate-500 dark:text-cyan-600 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors" title="AI Copilot"><Bot size={16} strokeWidth={2.5} /></button>
                            </div>
                        </motion.div>
                    )}

                    {/* STATO 2: TICKER */}
                    {mode === 'ticker' && liveTicker !== null && (
                        <motion.div key="ticker" initial={{ opacity: 0, y: -16, scale: 0.9, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: FRAMER_PHYSICS.dynamicIsland }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="flex items-center justify-center gap-3 px-5 py-2.5 h-full w-full">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Netto</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-[15px] tracking-wide">
                                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(liveTicker)}
                            </span>
                        </motion.div>
                    )}

                    {/* STATO 3: DROPZONE */}
                    {mode === 'dropzone' && (
                        <motion.div key="dropzone" initial={{ opacity: 0, scale: 0.8, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.38, ease: [0.34, 1.56, 0.64, 1] } }} exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }} className="p-8 flex flex-col items-center justify-center pointer-events-none">
                            <motion.div animate={{ y: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 2 }}>
                                <DownloadCloud className="w-12 h-12 text-fuchsia-400 mb-3 drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]" />
                            </motion.div>
                            <h3 className="text-white font-black text-xl tracking-widest uppercase">Sgancia i File</h3>
                            <p className="text-fuchsia-300 text-sm font-bold mt-1">L'AI è pronta ad analizzarli</p>
                        </motion.div>
                    )}

                    {/* STATO 4: MENU POTENZIATO CON BACKUP */}
                    {mode === 'menu' && (
                        <motion.div
                            key="menu"
                            initial="hidden" animate="show" exit="hidden"
                            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
                            className="p-2 w-full flex items-center justify-between gap-2"
                        >
                            <div className="flex items-center gap-2 pl-2">
                                {/* Tema — Sun: rotate-180 + scale + glow ambra · Moon: rotate-negative + scale + glow indigo */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-theme')); setMode('idle'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-amber-500 dark:text-amber-400 hover:shadow-[0_0_12px_rgba(245,158,11,0.5)] dark:hover:shadow-[0_0_12px_rgba(129,140,248,0.5)]" title="Tema Chiaro/Scuro">
                                    <Sun className="w-4 h-4 dark:hidden block group-hover/btn:rotate-180 group-hover/btn:scale-110 transition-transform duration-500 ease-out drop-shadow-[0_0_3px_currentColor]" />
                                    <Moon className="w-4 h-4 hidden dark:block text-indigo-400 group-hover/btn:-rotate-12 group-hover/btn:scale-110 transition-transform duration-500 ease-out drop-shadow-[0_0_3px_currentColor]" />
                                </motion.button>

                                {/* Aziende Custom — Database: scale + glow cyan */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-company')); setMode('idle'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-cyan-600 dark:text-cyan-400 hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]" title="Aziende Custom">
                                    <Database className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                </motion.button>

                                {/* Export Backup — Cloud bounce y + freccia in giù che pulsa */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('island-export')); setMode('idle'); }} className="group/btn relative p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-purple-600 dark:text-purple-400 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)]" title="Esporta JSON (copia locale)">
                                    <DownloadCloud className="w-4 h-4 group-hover/btn:translate-y-[1px] group-hover/btn:scale-110 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                    {/* Mini-particles che cadono dalla cloud al hover */}
                                    <span className="absolute left-1/2 top-[60%] -translate-x-1/2 w-[2px] h-[2px] bg-current rounded-full opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-y-[5px] transition-all duration-500" />
                                </motion.button>

                                {/* Archivio — Lid box che si solleva */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-archive')); setMode('idle'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-indigo-600 dark:text-indigo-400 hover:shadow-[0_0_12px_rgba(99,102,241,0.5)]" title="Archivio Buste Paga">
                                    <Archive className="w-4 h-4 group-hover/btn:-translate-y-0.5 group-hover/btn:scale-105 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                </motion.button>

                                {/* Spotlight Cloud — Gemini Pro veloce senza retrieval: Bot fuchsia */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); setMode('ai_cloud'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-fuchsia-600 dark:text-fuchsia-400 hover:shadow-[0_0_12px_rgba(217,70,239,0.5)]" title="Spotlight Cloud · Gemini Pro (risposta veloce senza RAG)">
                                    <Bot className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                </motion.button>

                                {/* Libreria Legale — Avvocato Virtuale: scroll che srotola + glow violet */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); setIsRagAdminOpen(true); setMode('idle'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-violet-600 dark:text-violet-400 hover:shadow-[0_0_12px_rgba(139,92,246,0.5)]" title="Libreria Legale · Avvocato Virtuale">
                                    <ScrollText className="w-4 h-4 group-hover/btn:scale-110 group-hover/btn:-rotate-3 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                </motion.button>

                                {/* Password/Settings — Rotate continuo lento al hover */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-settings')); setMode('idle'); }} className="group/btn p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:shadow-[0_0_12px_rgba(148,163,184,0.5)]" title="Password di sicurezza">
                                    <Settings className="w-4 h-4 group-hover/btn:rotate-180 transition-transform duration-700 ease-out drop-shadow-[0_0_3px_currentColor]" />
                                </motion.button>

                                <motion.div variants={{ hidden: { height: 0 }, show: { height: 24 } }} className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></motion.div>

                                {/* Disconnetti — Arrow che esce dal box */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-logout')); setMode('idle'); }} className="group/btn p-2.5 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-xl transition-[transform,background-color,box-shadow] duration-300 hover:scale-110 text-red-600 dark:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]" title="Disconnetti">
                                    <LogOut className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:scale-110 transition-transform duration-300 drop-shadow-[0_0_3px_currentColor] group-hover/btn:drop-shadow-[0_0_5px_currentColor]" />
                                </motion.button>
                            </div>
                            <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); setMode('idle'); }} className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-2 mr-1"><X size={14} /></motion.button>
                        </motion.div>
                    )}

                    {/* STATO 5: NOTIFY */}
                    {mode === 'notify' && notifyData && (
                        <motion.div
                            key="notify"
                            initial={{ opacity: 0, y: -14, scale: 0.92, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: FRAMER_PHYSICS.dynamicIsland }}
                            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                            className="flex items-center gap-3 px-5 py-2.5 h-full w-full"
                        >
                            {notifyData.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" /> :
                                notifyData.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" /> : <Bot className="w-5 h-5 text-fuchsia-500 dark:text-fuchsia-400 shrink-0" />}
                            <span className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{notifyData.msg}</span>
                        </motion.div>
                    )}

                    {/* STATO 6: CALCOLATRICE */}
                    {mode === 'calc' && (
                        <motion.div key="calc" initial={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.32, ease: APPLE_EASE } }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="p-4 w-full flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Calculator size={12} /> Calcolatrice</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setMode('calc_history')} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                        Memoria ({calcHistory.length})
                                    </button>
                                    <button onClick={() => setMode('idle')} className="text-slate-500 hover:text-slate-800 dark:hover:text-white"><X size={14} /></button>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mb-3 h-16 flex items-center justify-between px-4 overflow-hidden shadow-inner group/display">
                                <button onClick={handleCopyResult} disabled={!display || display === 'Errore'} className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-md transition-all disabled:opacity-0 shrink-0"><Copy size={16} /></button>
                                <span className="text-3xl font-mono text-slate-800 dark:text-white font-bold tracking-wider truncate ml-4 min-w-0 flex-1 text-right">{display || '0'}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
                                    <button
                                        key={btn}
                                        onClick={(e) => {
                                            spawnRipple(btn, e);
                                            if (btn === '=') handleCalc();
                                            else if (btn === 'C') handleClear();
                                            else handleInput(btn);
                                        }}
                                        className={`${calcBtnClass} ${btn === '=' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30' : btn === 'C' ? 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' : ['/', '*', '-', '+'].includes(btn) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <span className="relative z-10">{btn}</span>
                                        {/* Ripple layer: onda concentrica al click. Colore basato su tipo bottone. */}
                                        {calcRipples.filter(r => r.btn === btn).map(r => {
                                            const rippleColor = btn === '=' ? 'rgba(255,255,255,0.45)'
                                                : btn === 'C' ? 'rgba(239,68,68,0.35)'
                                                : ['/', '*', '-', '+'].includes(btn) ? 'rgba(99,102,241,0.30)'
                                                : 'rgba(99,102,241,0.20)';
                                            return (
                                                <motion.span
                                                    key={r.id}
                                                    initial={{ opacity: 0.8, scale: 0 }}
                                                    animate={{ opacity: 0, scale: 2.5 }}
                                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                                    className="absolute rounded-full pointer-events-none"
                                                    style={{
                                                        left: r.x,
                                                        top: r.y,
                                                        width: 12,
                                                        height: 12,
                                                        marginLeft: -6,
                                                        marginTop: -6,
                                                        backgroundColor: rippleColor,
                                                    }}
                                                />
                                            );
                                        })}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STATO 7: SPOTLIGHT AI POTENZIATO */}
                    {mode === 'ai' && (
                        <motion.div key="ai" initial={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.32, ease: APPLE_EASE } }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="p-5 w-full flex flex-col gap-4 relative overflow-hidden">

                            {/* ✨ NUOVO: Effetto Shimmer (Raggio di luce) durante l'elaborazione */}
                            {isAiThinking && (
                                <motion.div
                                    className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-fuchsia-500/10 to-transparent skew-x-12"
                                    animate={{ left: ['-100%', '200%'] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                />
                            )}

                            <div className="flex justify-between items-center relative z-10">
                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles size={12} className={isAiThinking ? "animate-pulse" : ""} /> Avvocato Virtuale · Local RAG
                                </span>
                                <div className="flex items-center gap-3">
                                    {isAiThinking && (
                                        <button
                                            onClick={abortAvvocato}
                                            className="text-[9px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
                                            title="Annulla risposta"
                                        >
                                            Stop
                                        </button>
                                    )}
                                    <span className="text-[9px] text-slate-500 border border-slate-300 dark:border-slate-700 px-1.5 rounded bg-slate-100 dark:bg-slate-800 shadow-sm">ESC</span>
                                    <button onClick={() => setMode('idle')} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={14} /></button>
                                </div>
                            </div>

                            {workerContext && (
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-500/15 border border-fuchsia-400/30 min-w-0">
                                        <User size={10} className="text-fuchsia-400 shrink-0" />
                                        <span className="text-[11px] text-fuchsia-400 font-bold truncate">
                                            {workerContext.cognome} {workerContext.nome}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                                        {workerContext.profilo}{workerContext.eliorType ? ` · ${workerContext.eliorType}` : ''}
                                    </span>
                                </div>
                            )}

                            <form onSubmit={handleAskAvvocato} className="relative z-10 group/input">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-500/50 transition-colors group-focus-within/input:text-fuchsia-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setAiResponse(null); setHistoryIdx(-1); }}
                                    onKeyDown={handleAiInputKeyDown}
                                    placeholder={workerContext ? `Domanda su ${workerContext.cognome} ${workerContext.nome}…` : aiHistory.length > 0 ? "Domanda, nome lavoratore… ↑ cronologia" : "Fai una domanda legale o cerca un lavoratore..."}
                                    className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-fuchsia-300/50 dark:border-fuchsia-500/30 rounded-xl py-3.5 pl-10 pr-10 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/50 shadow-inner transition-all"
                                />
                                {/* ✨ FIX: Tasto "Svuota" animato che appare solo se c'è del testo */}
                                <AnimatePresence>
                                    {searchQuery.length > 0 && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-fuchsia-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1"
                                            title="Svuota ricerca"
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </form>

                            {/* Risultati Lavoratori — compatti se c'è anche una risposta AI */}
                            {searchResults.length > 0 && !isAiThinking && (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                                    className="flex flex-col gap-1.5 relative z-10"
                                >
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lavoratori in archivio</span>
                                    {searchResults.map(w => (
                                        <motion.button
                                            key={w.id}
                                            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } } }}
                                            onClick={() => handleOpenWorker(w)}
                                            className={`flex items-center gap-2.5 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-600/50 transition-colors text-left group ${aiResponse ? 'px-3 py-2' : 'p-3'}`}
                                        >
                                            <div className={`rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${aiResponse ? 'w-6 h-6' : 'w-8 h-8'}`}>
                                                <User size={aiResponse ? 11 : 14} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors truncate">{w.cognome} {w.nome}</h4>
                                                {!aiResponse && <p className="text-[10px] text-slate-500 uppercase">{w.profilo} • {w.ruolo}</p>}
                                            </div>
                                            <ArrowRight size={12} className="ml-auto shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Risposta Avvocato Virtuale — streaming live + citazioni cliccabili */}
                            <AnimatePresence>
                                {/* Pre-token: solo loader di attesa */}
                                {isAiThinking && !streamingAnswer && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 text-violet-600/70 dark:text-violet-400/80 py-2 relative z-10 overflow-hidden">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-[10px] font-black tracking-widest uppercase drop-shadow-sm">Interrogazione corpus + Qwen 35b…</span>
                                    </motion.div>
                                )}

                                {/* Risposta (streaming o snapshot da cronologia) + citazioni */}
                                {(streamingAnswer || (aiResponse && !isAiThinking)) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: 10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                        className="flex flex-col gap-2 relative z-10"
                                    >
                                        <div className="bg-linear-to-br from-violet-50/80 to-white/50 dark:from-violet-950/30 dark:to-slate-900/50 border border-violet-200/60 dark:border-violet-500/20 p-4 rounded-xl backdrop-blur-md shadow-sm max-h-[50vh] overflow-y-auto custom-scrollbar pointer-events-auto">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {streamingAnswer || aiResponse}
                                                {isAiThinking && (
                                                    <motion.span
                                                        animate={{ opacity: [0.2, 1, 0.2] }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                                                        className="inline-block w-[6px] h-[14px] bg-violet-500 ml-1 align-middle rounded-sm"
                                                    />
                                                )}
                                            </p>
                                        </div>

                                        {/* Citazioni cliccabili (solo se ci sono sources, principalmente durante/dopo streaming) */}
                                        {ragSources.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1 self-center">
                                                    Fonti
                                                </span>
                                                {ragSources.map((s, i) => {
                                                    const label = [s.doc_title, s.section_ref].filter(Boolean).join(' · ');
                                                    return (
                                                        <button
                                                            key={s.chunk_id}
                                                            onClick={() => openLegalDocumentInTab(s.document_id)}
                                                            title={`${label} (similarity ${s.similarity.toFixed(2)}) — apri PDF`}
                                                            className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-100/70 hover:bg-violet-200 dark:bg-violet-900/40 dark:hover:bg-violet-800/60 border border-violet-300/50 dark:border-violet-700/50 text-violet-700 dark:text-violet-300 transition-all"
                                                        >
                                                            <span className="text-[10px] font-black">[{i + 1}]</span>
                                                            <span className="text-[10px] font-bold truncate max-w-[140px]">
                                                                {s.doc_title}
                                                            </span>
                                                            <ExternalLink size={10} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Errore RAG */}
                                        {ragError && !isAiThinking && (
                                            <div className="text-[11px] text-red-600 dark:text-red-400 px-2 py-1 bg-red-50/50 dark:bg-red-950/30 rounded-lg border border-red-200/50 dark:border-red-700/30">
                                                ⚠️ {ragError}
                                            </div>
                                        )}

                                        {!isAiThinking && (
                                            <button
                                                onClick={handleResetAi}
                                                className="self-start flex items-center gap-1.5 text-[10px] font-bold text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 uppercase tracking-widest transition-colors py-1 px-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                            >
                                                <ArrowLeft size={11} /> Nuova domanda
                                            </button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* CRONOLOGIA DOMANDE AI */}
                            <AnimatePresence>
                                {!aiResponse && !isAiThinking && searchQuery.length === 0 && aiHistory.length > 0 && (
                                    <motion.div
                                        key="ai-history"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex flex-col gap-1.5 relative z-10 overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Domande recenti · ↑↓</span>
                                            <button onClick={() => setAiHistory([])} className="text-[9px] text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"><Trash2 size={9} /> Svuota</button>
                                        </div>
                                        {aiHistory.map((item, i) => (
                                            <motion.button
                                                key={item.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.04 }}
                                                onClick={() => { setSearchQuery(item.question); setAiResponse(item.answer); setHistoryIdx(i); }}
                                                className="flex items-start gap-2.5 p-2.5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-fuchsia-200 dark:hover:border-fuchsia-700/40 transition-all text-left group"
                                            >
                                                <Bot size={11} className="mt-0.5 shrink-0 text-fuchsia-400 group-hover:text-fuchsia-500 transition-colors" />
                                                <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300 transition-colors">{item.question}</span>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* STATO 7-BIS: SPOTLIGHT CLOUD (Gemini Pro, no RAG) */}
                    {mode === 'ai_cloud' && (
                        <motion.div key="ai_cloud" initial={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.32, ease: APPLE_EASE } }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="p-5 w-full flex flex-col gap-4 relative overflow-hidden">

                            {/* Shimmer durante thinking */}
                            {isCloudThinking && (
                                <motion.div
                                    className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-fuchsia-500/10 to-transparent skew-x-12"
                                    animate={{ left: ['-100%', '200%'] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                />
                            )}

                            <div className="flex justify-between items-center relative z-10">
                                <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                                    <Bot size={12} className={isCloudThinking ? "animate-pulse" : ""} /> Spotlight Cloud · Gemini Pro
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] text-slate-500 border border-slate-300 dark:border-slate-700 px-1.5 rounded bg-slate-100 dark:bg-slate-800 shadow-sm">ESC</span>
                                    <button onClick={() => setMode('idle')} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={14} /></button>
                                </div>
                            </div>

                            {workerContext && (
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-500/15 border border-fuchsia-400/30 min-w-0">
                                        <User size={10} className="text-fuchsia-400 shrink-0" />
                                        <span className="text-[11px] text-fuchsia-400 font-bold truncate">
                                            {workerContext.cognome} {workerContext.nome}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                                        {workerContext.profilo}{workerContext.eliorType ? ` · ${workerContext.eliorType}` : ''}
                                    </span>
                                </div>
                            )}

                            <form onSubmit={handleAskCloud} className="relative z-10 group/input">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-500/50 transition-colors group-focus-within/input:text-fuchsia-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setCloudResponse(null); setCloudHistoryIdx(-1); }}
                                    onKeyDown={handleCloudInputKeyDown}
                                    placeholder={workerContext ? `Domanda su ${workerContext.cognome} ${workerContext.nome}…` : cloudHistory.length > 0 ? "Domanda, nome lavoratore… ↑ cronologia" : "Domanda veloce a Gemini Pro..."}
                                    className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-fuchsia-300/50 dark:border-fuchsia-500/30 rounded-xl py-3.5 pl-10 pr-10 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/50 shadow-inner transition-all"
                                />
                                <AnimatePresence>
                                    {searchQuery.length > 0 && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.5 }}
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-fuchsia-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1"
                                            title="Svuota ricerca"
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </form>

                            {/* Risultati lavoratori (stessa search di mode 'ai') */}
                            {searchResults.length > 0 && !isCloudThinking && (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                                    className="flex flex-col gap-1.5 relative z-10"
                                >
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lavoratori in archivio</span>
                                    {searchResults.map(w => (
                                        <motion.button
                                            key={w.id}
                                            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } } }}
                                            onClick={() => handleOpenWorker(w)}
                                            className={`flex items-center gap-2.5 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-fuchsia-300 dark:hover:border-fuchsia-600/50 transition-colors text-left group ${cloudResponse ? 'px-3 py-2' : 'p-3'}`}
                                        >
                                            <div className={`rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${cloudResponse ? 'w-6 h-6' : 'w-8 h-8'}`}>
                                                <User size={cloudResponse ? 11 : 14} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-fuchsia-500 transition-colors truncate">{w.cognome} {w.nome}</h4>
                                                {!cloudResponse && <p className="text-[10px] text-slate-500 uppercase">{w.profilo} • {w.ruolo}</p>}
                                            </div>
                                            <ArrowRight size={12} className="ml-auto shrink-0 text-slate-300 group-hover:text-fuchsia-400 transition-colors" />
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Risposta Cloud */}
                            <AnimatePresence>
                                {isCloudThinking && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 text-fuchsia-600/70 dark:text-fuchsia-400/80 py-2 relative z-10 overflow-hidden">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-[10px] font-black tracking-widest uppercase drop-shadow-sm">Sincronizzazione Gemini Pro…</span>
                                    </motion.div>
                                )}

                                {cloudResponse && !isCloudThinking && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: 10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                        className="flex flex-col gap-2 relative z-10"
                                    >
                                        <div className="bg-linear-to-br from-fuchsia-50/80 to-white/50 dark:from-fuchsia-950/30 dark:to-slate-900/50 border border-fuchsia-200/60 dark:border-fuchsia-500/20 p-4 rounded-xl backdrop-blur-md shadow-sm max-h-[50vh] overflow-y-auto custom-scrollbar pointer-events-auto">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {cloudResponse}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleResetCloud}
                                            className="self-start flex items-center gap-1.5 text-[10px] font-bold text-fuchsia-500 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 uppercase tracking-widest transition-colors py-1 px-2 rounded-lg hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30"
                                        >
                                            <ArrowLeft size={11} /> Nuova domanda
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Cronologia cloud */}
                            <AnimatePresence>
                                {!cloudResponse && !isCloudThinking && searchQuery.length === 0 && cloudHistory.length > 0 && (
                                    <motion.div
                                        key="cloud-history"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex flex-col gap-1.5 relative z-10 overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Domande recenti · ↑↓</span>
                                            <button onClick={() => setCloudHistory([])} className="text-[9px] text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"><Trash2 size={9} /> Svuota</button>
                                        </div>
                                        {cloudHistory.map((item, i) => (
                                            <motion.button
                                                key={item.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.04 }}
                                                onClick={() => { setSearchQuery(item.question); setCloudResponse(item.answer); setCloudHistoryIdx(i); }}
                                                className="flex items-start gap-2.5 p-2.5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-fuchsia-200 dark:hover:border-fuchsia-700/40 transition-all text-left group"
                                            >
                                                <Bot size={11} className="mt-0.5 shrink-0 text-fuchsia-400 group-hover:text-fuchsia-500 transition-colors" />
                                                <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 group-hover:text-fuchsia-700 dark:group-hover:text-fuchsia-300 transition-colors">{item.question}</span>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* STATO 8: CRONOLOGIA CALCOLATRICE RIFINITO */}
                    {mode === 'calc_history' && (
                        <motion.div key="calc_history" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.28, ease: APPLE_EASE } }} exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }} className="p-4 pb-5 w-full h-[250px] flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Calculator size={12} /> Memoria Calcoli</span>
                                <button onClick={() => setMode('calc')} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                    Indietro
                                </button>
                            </div>

                            {/* ✨ FIX: Aggiunta custom-scrollbar per coerenza visiva con l'AI */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {calcHistory.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">Nessun calcolo salvato</div>
                                ) : (
                                    calcHistory.map(calc => (
                                        <div key={calc.id} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-2 flex justify-between items-center">
                                            <span className="font-mono text-xs text-slate-500">{calc.operation} =</span>
                                            <span className="font-bold text-indigo-600 dark:text-cyan-400 font-mono">{calc.result}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            {calcHistory.length > 0 && (
                                <button onClick={clearCalcHistory} className="mt-2 py-1.5 bg-red-100 text-red-500 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors hover:bg-red-200"><Trash2 size={12} /> Svuota</button>
                            )}
                        </motion.div>
                    )}

                    {/* STATO 9: NOTIFICA GLOBALE (Morphing Perfetto) */}
                    {mode === 'notification' && notification && (
                        <motion.div
                            key="global_notify"
                            initial={{ opacity: 0, y: -14, scale: 0.94, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { ...FRAMER_PHYSICS.dynamicIsland, delay: 0.05 } }}
                            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                            className="flex items-start gap-4 px-5 py-3 w-full h-full min-h-[48px] max-h-32 overflow-y-auto custom-scrollbar"
                        >
                            <motion.div
                                className="mt-0.5 shrink-0"
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", damping: 15 }}
                            >
                                {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                                    notification.type === 'warning' ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <Bot className="w-5 h-5 text-blue-500" />}
                            </motion.div>

                            <motion.div
                                className="flex flex-col justify-center"
                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                            >
                                <span className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{notification.title}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-normal leading-relaxed mt-0.5 break-words">
                                    {notification.message}
                                </span>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* STATO 10: STATS (BIVIO RICERCA) RIFINITO */}
                    {mode === 'stats' && workerStats && (
                        <motion.div
                            key="stats_expand"
                            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: APPLE_EASE } }}
                            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                            // ✨ FIX 1: Aggiunto pb-6 per dare respiro vitale all'ombra del pulsante inferiore
                            className="p-5 pb-6 w-full flex flex-col gap-4"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                    <User size={14} />
                                    {/* ✨ FIX 2: Troncamento sul nome per evitare che sballi l'header se troppo lungo */}
                                    <span className="truncate max-w-[200px]">{workerStats.cognome} {workerStats.nome}</span>
                                </span>
                                <button onClick={closeIsland} className="text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-full transition-colors shrink-0">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex gap-3">
                                {/* ✨ FIX 3: Aggiunto overflow-hidden ai box interni per evitare che il testo strabordi durante l'animazione di resize (da 500px a 360px) */}
                                <div className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col justify-center overflow-hidden">
                                    <span className="text-[9px] uppercase text-slate-400 font-bold mb-1 truncate">Azienda / Profilo</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{workerStats.profilo}</span>
                                </div>
                                <div className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col justify-center overflow-hidden">
                                    <span className="text-[9px] uppercase text-slate-400 font-bold mb-1 truncate">Mansione</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate" title={workerStats.ruolo}>{workerStats.ruolo}</span>
                                </div>
                            </div>

                            <div className="flex mt-1">
                                <button
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('island-open-worker', { detail: workerStats.id }));
                                        closeIsland();
                                    }}
                                    // ✨ FIX 4: Ombra ricalibrata (meno espansa verticalmente) e transform più pulito
                                    className="w-full py-3 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-[0_8px_20px_-6px_rgba(6,182,212,0.6)] transition-all active:scale-95 flex justify-center items-center gap-2"
                                >
                                    Apri Pratica Lavoratore <ArrowRight size={14} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STATO 11: QUICK ACTIONS */}
                    {mode === 'quick_actions' && (
                        <motion.div
                            key="quick_actions"
                            initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] } }}
                            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.15, ease: 'easeIn' } }}
                            className="flex items-center justify-around w-full px-3 py-1.5 h-10"
                        >
                            {islandContext === 'report' ? (
                                <>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-dashboard'))} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors group relative" title="Torna alla Dashboard"><ArrowLeft size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-edit'))} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors group relative" title="Torna alla Gestione Dati"><LayoutGrid size={18} strokeWidth={2.5} /></button>
                                    {!isReadOnly && (<>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-print'))} className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-colors group relative" title="Stampa Immediata"><Printer size={18} strokeWidth={2.5} /></button>
                                    </>)}
                                </>
                            ) : (
                                <>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-dashboard'))} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors group relative" title="Torna alla Dashboard"><ArrowLeft size={18} strokeWidth={2.5} /></button>
                                    {!isReadOnly && (<>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-download'))} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors group relative" title="Scarica Tabelle Dati (PDF)"><Download size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-report'))} className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-colors group relative" title="Vai al Report Ufficiale"><FileSpreadsheet size={18} strokeWidth={2.5} /></button>
                                    </>)}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ✨ SPARKLE PARTICLES — emanate dal centro dell'isola al completamento upload con successo.
                12 particelle emerald con traiettoria radiale, durata ~1.2s, delay scaglionato.
                Posizionate come sibling del motion.div principale per poter uscire oltre i bordi dell'isola. */}
            <AnimatePresence>
                {uploadState.isFinishing && !uploadState.isError && (
                    <div
                        key="sparkle-burst"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 pointer-events-none z-10"
                    >
                        {[...Array(12)].map((_, i) => {
                            const angle = (i / 12) * Math.PI * 2;
                            const distance = 70 + Math.random() * 40;
                            return (
                                <motion.div
                                    key={`sparkle-${i}`}
                                    className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-emerald-300"
                                    initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                                    animate={{
                                        x: Math.cos(angle) * distance,
                                        y: Math.sin(angle) * distance,
                                        scale: [0, 1.3, 0],
                                        opacity: [0, 1, 0],
                                    }}
                                    transition={{
                                        duration: 1.0 + Math.random() * 0.3,
                                        ease: 'easeOut',
                                        delay: 0.1 + Math.random() * 0.2,
                                    }}
                                    style={{
                                        boxShadow: '0 0 8px rgba(110,231,183,0.9), 0 0 16px rgba(16,185,129,0.5)',
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* PILL SATELLITE v2 — Background Job Drawer (Apple-style + intelligence).
                ✦ Visuale: gradient pill, ring SVG con linearGradient, Bot pulsante, completion flash
                ✦ Intelligence: ETA real-time, stall detection (>5s no progress), currentScanLabel
                Click → restoreUpload() riapre la Live Activity completa sull'isola. */}
            <AnimatePresence>
                {uploadState.isUploading && uploadState.minimized && (() => {
                    // Color theming per tipo
                    const baseTheme = uploadState.type === 'batch'
                        ? { from: '#a855f7', to: '#d946ef', glow: 'rgba(217,70,239,0.5)', border: 'rgba(217,70,239,0.4)' }
                        : uploadState.type === 'mobile'
                            ? { from: '#0ea5e9', to: '#22d3ee', glow: 'rgba(34,211,238,0.5)', border: 'rgba(34,211,238,0.4)' }
                            : { from: '#4f46e5', to: '#6366f1', glow: 'rgba(99,102,241,0.5)', border: 'rgba(99,102,241,0.4)' };

                    // State override per stall (giallo warning)
                    const isStallVisible = uploadIsStalled && !uploadState.isFinishing;
                    const theme = isStallVisible
                        ? { from: '#f59e0b', to: '#facc15', glow: 'rgba(245,158,11,0.55)', border: 'rgba(245,158,11,0.5)' }
                        : baseTheme;

                    // Completion flash (transient, quando isFinishing && !isError)
                    const isCompleteFlash = uploadState.isFinishing && !uploadState.isError;
                    const themeFinal = isCompleteFlash
                        ? { from: '#10b981', to: '#34d399', glow: 'rgba(16,185,129,0.65)', border: 'rgba(16,185,129,0.55)' }
                        : theme;

                    // Label principale (counter o stato)
                    const label = uploadState.type === 'batch'
                        ? `${uploadState.progress}/${uploadState.total}`
                        : uploadState.type === 'mobile'
                            ? `${uploadState.progress}`
                            : `${uploadState.progress}%`;

                    // Hint testo (cambia in base allo stato): ETA / Stallo / Riapri / Fatto
                    const hint = isCompleteFlash
                        ? 'Fatto'
                        : isStallVisible
                            ? 'Verifica…'
                            : uploadState.type === 'mobile'
                                ? 'In ascolto'
                                : uploadEta !== '—'
                                    ? uploadEta
                                    : 'Calcolo…';

                    const progressRatio = Math.min(1, uploadState.progress / Math.max(1, uploadState.total));
                    const RADIUS = 10;
                    const CIRC = 2 * Math.PI * RADIUS;
                    const gradientId = `sat-grad-${uploadState.type}-${isStallVisible ? 'stall' : isCompleteFlash ? 'done' : 'ok'}`;

                    return (
                        <motion.button
                            key="upload-satellite"
                            initial={{ opacity: 0, y: -10, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.85 }}
                            transition={FRAMER_PHYSICS.dynamicIsland}
                            onClick={restoreUpload}
                            className="mt-2 relative flex items-center gap-3 pl-1 pr-4 py-1 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-full pointer-events-auto hover:scale-[1.05] active:scale-[0.97] transition-transform group/sat"
                            style={{
                                isolation: 'isolate',
                                backfaceVisibility: 'hidden',
                                border: `1px solid ${themeFinal.border}`,
                                boxShadow: `0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 14px -2px ${themeFinal.glow}, 0 10px 25px -8px rgba(0,0,0,0.55)`,
                            }}
                            title={currentScanLabel ? `Riapri (${currentScanLabel})` : 'Riapri upload'}
                        >
                            {/* Ring SVG con gradient + Bot pulsante centrale */}
                            <div className="relative w-[24px] h-[24px] flex items-center justify-center shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" className="absolute inset-0">
                                    <defs>
                                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor={themeFinal.from} />
                                            <stop offset="100%" stopColor={themeFinal.to} />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="12" cy="12" r={RADIUS} stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />
                                    <motion.circle
                                        cx="12" cy="12" r={RADIUS}
                                        stroke={`url(#${gradientId})`}
                                        strokeWidth="2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeDasharray={CIRC}
                                        animate={{ strokeDashoffset: isCompleteFlash ? 0 : (1 - progressRatio) * CIRC }}
                                        transition={{ type: 'spring', stiffness: 100, damping: 22 }}
                                        transform="rotate(-90 12 12)"
                                        style={{ filter: `drop-shadow(0 0 4px ${themeFinal.glow})` }}
                                    />
                                </svg>
                                {/* Bot icon (o Check al completion) con pulse subtle */}
                                <motion.div
                                    animate={isCompleteFlash
                                        ? { scale: [0.6, 1.3, 1], rotate: [0, 360, 360] }
                                        : isStallVisible
                                            ? { opacity: [0.6, 1, 0.6] }
                                            : { scale: [0.95, 1.1, 0.95] }
                                    }
                                    transition={isCompleteFlash
                                        ? { duration: 0.7, ease: 'easeOut' }
                                        : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                                    }
                                    className="relative z-10 flex items-center justify-center"
                                >
                                    {isCompleteFlash
                                        ? <Check size={11} className="text-emerald-300" strokeWidth={3} />
                                        : <Bot size={11} className="text-white" />
                                    }
                                </motion.div>
                            </div>

                            {/* Counter principale (numeri tabulari per evitare jitter) */}
                            <span className="text-[12px] font-mono font-bold text-white tracking-wide tabular-nums leading-none">
                                {label}
                            </span>

                            {/* Hint dinamico (ETA / Stallo / Fatto / Riapri) — slot 72px fissa per evitare
                                overlap col counter (es. "1/2"). whitespace-nowrap impedisce wrap. */}
                            <span className="relative text-[9px] font-bold uppercase tracking-[0.1em] leading-none w-[72px] h-[10px] shrink-0 block">
                                {/* Stato attuale */}
                                <span className={`absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap transition-opacity duration-300 ${
                                    isStallVisible ? 'text-amber-300' : isCompleteFlash ? 'text-emerald-300' : 'text-white/55'
                                } group-hover/sat:opacity-0`}>
                                    {hint}
                                </span>
                                {/* Hover: appare "Riapri" */}
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover/sat:opacity-100 transition-opacity duration-300 text-white">
                                    Riapri
                                </span>
                            </span>

                            {/* Tooltip filename scrolling (visibile solo on hover, se c'è label scan) */}
                            {currentScanLabel && !isCompleteFlash && (
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 px-2 py-0.5 bg-slate-900/95 backdrop-blur-md rounded-md text-[9px] font-mono text-white/85 whitespace-nowrap opacity-0 group-hover/sat:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10 shadow-lg max-w-[200px] truncate">
                                    {currentScanLabel}
                                </span>
                            )}
                        </motion.button>
                    );
                })()}
            </AnimatePresence>

            {/* Modale Libreria Legale (Avvocato Virtuale RAG) — montato qui per essere overlay full-screen */}
            <RagAdminPanel isOpen={isRagAdminOpen} onClose={() => setIsRagAdminOpen(false)} />
        </div>
    );
};

export default DynamicIsland;