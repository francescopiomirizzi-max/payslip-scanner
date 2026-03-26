import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Calculator, Search, X, Loader2,
    CheckCircle2, AlertCircle, LayoutGrid, Sun, Moon,
    Database, Settings, LogOut, Copy, User, DownloadCloud, Trash2, ArrowRight, QrCode, Smartphone, Sparkles, LoaderCircle, FileText, Check, XCircle, ArrowLeft, Download, FileSpreadsheet, Printer
} from 'lucide-react';
import { useIsland } from '../IslandContext';

export const notifyIsland = (msg: string, type: 'success' | 'error' | 'ai' = 'success') => {
    window.dispatchEvent(new CustomEvent('island-notify', { detail: { msg, type } }));
};

// --- TRANSIZIONE FLUIDA GLOBALE ---
const islandTransition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.8
};

// --- GESTORE DEGLI STILI ---
const getIslandStyles = (mode: string, isExpanded: boolean, uploadState: any) => {
    if (mode === 'uploading') {
        // ✨ FIX APPLICATO: pointer-events-auto per permettere l'espansione al click
        return "pointer-events-auto bg-transparent border-none shadow-none !overflow-visible flex flex-col";
    }

    const base = "overflow-hidden backdrop-blur-md transition-all duration-500 pointer-events-auto flex flex-col";

    switch (mode) {
        case 'idle':
            return `${base} bg-white/20 dark:bg-slate-900/30 border border-white/20 dark:border-cyan-500/15 rounded-full shadow-sm hover:backdrop-blur-2xl hover:bg-white/60 dark:hover:bg-slate-900/70 hover:border-slate-300 dark:hover:border-cyan-400/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]`;
        case 'dropzone':
            return `${base} bg-slate-950/90 border-2 border-fuchsia-500 rounded-[2.5rem] shadow-[0_0_50px_rgba(217,70,239,0.5)]`;
        case 'ticker':
            return `${base} bg-white/90 dark:bg-slate-950/90 border border-emerald-500/50 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.3)]`;
        default:
            return `${base} bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border border-white/30 dark:border-cyan-500/10 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)]`;
    }
};

const DynamicIsland = () => {
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
        uploadState
    } = useIsland();

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

    const [localMode, setLocalMode] = useState<'idle' | 'calc' | 'ai' | 'notify' | 'menu' | 'dropzone' | 'ticker'>('idle');
    const [isUploadExpanded, setIsUploadExpanded] = useState(false);

    const mode = globalMode !== 'idle' ? globalMode : localMode;

    const setMode = (newMode: any) => {
        if (globalMode !== 'idle') closeIsland();
        setLocalMode(newMode);
    };

    const [notifyData, setNotifyData] = useState<{ msg: string, type: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [liveTicker, setLiveTicker] = useState<number | null>(null);
    const prevTickerRef = useRef<number | null>(null);
    const [display, setDisplay] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);

    useEffect(() => {
        const handleTickerUpdate = (e: any) => {
            const newValue = e.detail;
            setLiveTicker(newValue);
            if (newValue !== null && newValue > 0 && newValue !== prevTickerRef.current) {
                setMode('ticker');
                prevTickerRef.current = newValue;
                setTimeout(() => { setMode((prev: any) => prev === 'ticker' ? 'idle' : prev); }, 4000);
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
        if (mode === 'ai' && searchQuery.trim().length > 1) {
            const rawData = localStorage.getItem('workers_data');
            if (rawData) {
                const workers = JSON.parse(rawData);
                const query = searchQuery.toLowerCase();
                const matches = workers.filter((w: any) =>
                    w.nome.toLowerCase().includes(query) || w.cognome.toLowerCase().includes(query)
                ).slice(0, 3);
                setSearchResults(matches);
            }
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, mode]);

    const handleOpenWorker = (worker: any) => {
        showWorkerStats(worker);
        setSearchQuery('');
    };

    const handleAskGemini = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsAiThinking(true);
        setAiResponse(null);
        setSearchResults([]);

        const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
        const MODEL_NAME = "gemini-3.1-pro-preview";
        const SYSTEM_PROMPT = `Sei un esperto Consulente del Lavoro e Avvocato Giuslavorista italiano di altissimo livello.
Il tuo compito è assistere un collega nell'analisi di buste paga, calcolo di differenze retributive (Cassazione 20216/2022) e interpretazione dei CCNL.
Regole d'ingaggio: Rispondi in modo preciso, tecnico ma sintetico. Fornisci riferimenti normativi. Ecco la domanda: `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + searchQuery }] }] })
            });
            const data = await response.json();
            if (data.candidates && data.candidates[0]) {
                setAiResponse(data.candidates[0].content.parts[0].text);
            } else {
                setAiResponse("Il Modello Neurale non ha restituito una risposta valida.");
            }
        } catch (error) {
            setAiResponse("Errore di connessione API. Verifica la tua connessione.");
        }
        setIsAiThinking(false);
    };

    const islandRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
                setIsUploadExpanded(false);
                if (localMode === 'menu' || localMode === 'ai' || localMode === 'calc' || localMode === 'calc_history') {
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

    const handleCalc = () => {
        if (!display) return;
        try {
            const operation = display;
            const result = eval(display.replace(/,/g, '.'));

            // ✨ FIX: Intercettiamo i finti "successi" di JavaScript come Infinity o NaN (Not a Number)
            if (!Number.isFinite(result) || Number.isNaN(result)) {
                throw new Error("Calcolo impossibile"); // Questo fa saltare il codice direttamente nel catch!
            }

            const finalDisplay = result !== undefined ? String(result) : '';
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
        if (mode === 'ai' && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
    }, [mode]);

    const getGlowColor = () => {
        if (mode === 'dropzone') return 'rgba(217, 70, 239, 0.8)';
        if (mode === 'notify' && notifyData?.type === 'error') return 'rgba(239,68,68,0.4)';
        if (mode === 'notify' && notifyData?.type === 'success') return 'rgba(16,185,129,0.4)';
        if (mode === 'ai') return 'rgba(217,70,239,0.4)';
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
        return 'rgba(6, 182, 212, 0.15)';
    };

    const calcBtnClass = "h-12 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center shadow-sm";

    return (
        <div ref={islandRef} className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none group/island print:hidden">
            <motion.div
                layout
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[40px] -z-10"
                animate={{
                    backgroundColor: getGlowColor(),
                    width: mode === 'idle' ? ['90px', '160px', '90px'] : mode === 'dropzone' ? '300px' : '400px',
                    height: mode === 'idle' ? ['20px', '50px', '20px'] : '100px',
                    opacity: mode === 'idle' ? [0.3, 0.9, 0.3] : 1,
                    scale: mode === 'idle' ? [0.9, 1.15, 0.9] : 1,
                }}
                transition={mode === 'idle'
                    ? { repeat: Infinity, duration: 4, ease: "easeInOut" }
                    : { duration: 0.7 }
                }
            />

            <motion.div
                layout
                transition={islandTransition}
                className={getIslandStyles(mode, isUploadExpanded, uploadState)}
                style={{
                    width: mode === 'dropzone' ? '350px' :
                        mode === 'ticker' ? '220px' :
                            mode === 'idle' ? '140px' :
                                (mode === 'notify' || mode === 'notification') ? '350px' :
                                    mode === 'ai' ? '500px' :
                                        mode === 'calc' ? '280px' :
                                            mode === 'calc_history' ? '320px' :
                                                mode === 'stats' ? '360px' :
                                                    mode === 'quick_actions' ? '180px' :
                                                        // ✨ FIX 1: Se ha finito (isFinishing) si allarga a 280px per far respirare il testo!
                                                        mode === 'uploading' ? (isUploadExpanded ? '300px' : uploadState.isFinishing ? '280px' : '260px') : '320px',
                    minHeight: (mode === 'idle' || mode === 'notify' || mode === 'ticker' || mode === 'quick_actions' || (mode === 'uploading' && !isUploadExpanded)) ? '40px' : 'auto'
                }}
                // ✨ BREATHING GLOW: boxShadow pulsante in idle + Head Shake su errore
                animate={
                    (mode === 'uploading' && uploadState.isError) || display === 'Errore'
                        ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                        : {
                            x: 0,
                            boxShadow: mode === 'idle'
                                ? [
                                    `0 0 15px 2px ${getGlowColor()}, 0 0 30px 5px rgba(6,182,212,0)`,
                                    `0 0 25px 8px ${getGlowColor()}, 0 0 50px 15px rgba(6,182,212,0.25)`,
                                    `0 0 15px 2px ${getGlowColor()}, 0 0 30px 5px rgba(6,182,212,0)`
                                  ]
                                : `0 0 20px 5px ${getGlowColor()}`
                          }
                }
                // ✨ HOVER INTENSIFICATION: Il glow esplode morbidamente al passaggio del mouse
                whileHover={mode === 'idle' ? {
                    boxShadow: `0 0 35px 12px ${getGlowColor()}, 0 0 60px 20px rgba(6,182,212,0.35)`,
                    scale: 1.03,
                    transition: { duration: 0.4, ease: "easeOut" }
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
                                // ✨ FIX 2A: Exit in fade puro (nessun restringimento o blur), così il verde svanisce morbidamente
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                onClick={() => !uploadState.isFinishing && setIsUploadExpanded(!isUploadExpanded)}
                                style={{ overflow: 'hidden', WebkitMaskImage: '-webkit-radial-gradient(white, black)', isolation: 'isolate', transform: 'translateZ(0)' }}
                                className="relative w-full flex flex-col cursor-pointer shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/20"
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

                                    {/* ✨ Contatore Laterale (Visibile SOLO quando CHIUSA) */}
                                    <AnimatePresence>
                                        {!isUploadExpanded && !uploadState.isFinishing && (
                                            <motion.div
                                                key="counter-side"
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="ml-auto flex items-center justify-end font-mono text-[12px] font-bold text-white relative z-20 min-w-[120px]"
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
                        <motion.div key="idle" initial={{ opacity: 0, filter: 'blur(5px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} className="flex items-center justify-center px-4 py-2.5 h-full w-full group cursor-pointer" onClick={() => setMode('menu')}>
                            <div className="absolute w-6 h-1 bg-slate-400/30 dark:bg-cyan-500/30 rounded-full transition-all duration-300 group-hover:opacity-0 group-hover:scale-50"></div>
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
                        <motion.div key="ticker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} className="flex items-center justify-center gap-3 px-5 py-2.5 h-full w-full">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Netto</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-[15px] tracking-wide">
                                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(liveTicker)}
                            </span>
                        </motion.div>
                    )}

                    {/* STATO 3: DROPZONE */}
                    {mode === 'dropzone' && (
                        <motion.div key="dropzone" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-8 flex flex-col items-center justify-center pointer-events-none">
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
                                {/* Tema */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-theme')); setMode('idle'); }} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-105 text-amber-500 dark:text-amber-400 group" title="Tema Chiaro/Scuro">
                                    <Sun className="w-4 h-4 dark:hidden block group-hover:rotate-90 transition-transform" />
                                    <Moon className="w-4 h-4 hidden dark:block text-indigo-400 group-hover:-rotate-12 transition-transform" />
                                </motion.button>

                                {/* Aziende Custom */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-company')); setMode('idle'); }} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-xl transition-all duration-200 hover:scale-105 text-cyan-600 dark:text-cyan-400" title="Aziende Custom">
                                    <Database className="w-4 h-4" />
                                </motion.button>

                                {/* 👇 NUOVO TASTO: EXPORT BACKUP 👇 */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('island-export')); setMode('idle'); }} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-xl transition-all duration-200 hover:scale-105 text-purple-600 dark:text-purple-400" title="Esporta Backup Globale">
                                    <DownloadCloud className="w-4 h-4" />
                                </motion.button>

                                {/* Password/Settings */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-settings')); setMode('idle'); }} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-105 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" title="Password di sicurezza">
                                    <Settings className="w-4 h-4" />
                                </motion.button>

                                <motion.div variants={{ hidden: { height: 0 }, show: { height: 24 } }} className="w-px bg-slate-300 dark:bg-slate-700 mx-1"></motion.div>

                                {/* Disconnetti */}
                                <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={() => { window.dispatchEvent(new Event('island-logout')); setMode('idle'); }} className="p-2.5 bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-xl transition-all duration-200 hover:scale-105 text-red-600 dark:text-red-400" title="Disconnetti">
                                    <LogOut className="w-4 h-4" />
                                </motion.button>
                            </div>
                            <motion.button variants={{ hidden: { scale: 0, opacity: 0 }, show: { scale: 1, opacity: 1 } }} onClick={(e) => { e.stopPropagation(); setMode('idle'); }} className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-2 mr-1"><X size={14} /></motion.button>
                        </motion.div>
                    )}

                    {/* STATO 5: NOTIFY */}
                    {mode === 'notify' && notifyData && (
                        <motion.div key="notify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-3 px-5 py-2.5 h-full w-full">
                            {notifyData.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" /> :
                                notifyData.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" /> : <Bot className="w-5 h-5 text-fuchsia-500 dark:text-fuchsia-400 shrink-0" />}
                            <span className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{notifyData.msg}</span>
                        </motion.div>
                    )}

                    {/* STATO 6: CALCOLATRICE */}
                    {mode === 'calc' && (
                        <motion.div key="calc" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} className="p-4 w-full flex flex-col">
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
                                <button onClick={handleCopyResult} disabled={!display || display === 'Errore'} className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-md transition-all disabled:opacity-0"><Copy size={16} /></button>
                                <span className="text-3xl font-mono text-slate-800 dark:text-white font-bold tracking-wider truncate ml-4">{display || '0'}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
                                    <button key={btn} onClick={() => { if (btn === '=') handleCalc(); else if (btn === 'C') handleClear(); else handleInput(btn); }} className={`${calcBtnClass} ${btn === '=' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30' : btn === 'C' ? 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' : ['/', '*', '-', '+'].includes(btn) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}>{btn}</button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STATO 7: SPOTLIGHT AI POTENZIATO */}
                    {mode === 'ai' && (
                        <motion.div key="ai" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} className="p-5 w-full flex flex-col gap-4 relative overflow-hidden">

                            {/* ✨ NUOVO: Effetto Shimmer (Raggio di luce) durante l'elaborazione */}
                            {isAiThinking && (
                                <motion.div
                                    className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-fuchsia-500/10 to-transparent skew-x-12"
                                    animate={{ left: ['-100%', '200%'] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                />
                            )}

                            <div className="flex justify-between items-center relative z-10">
                                <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                                    <Bot size={12} className={isAiThinking ? "animate-pulse" : ""} /> Spotlight & Gemini Pro
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] text-slate-500 border border-slate-300 dark:border-slate-700 px-1.5 rounded bg-slate-100 dark:bg-slate-800 shadow-sm">ESC</span>
                                    <button onClick={() => setMode('idle')} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={14} /></button>
                                </div>
                            </div>

                            <form onSubmit={handleAskGemini} className="relative z-10 group/input">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-500/50 transition-colors group-focus-within/input:text-fuchsia-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Fai una domanda legale o calcola differenze..."
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

                            {/* Risultati Lavoratori - Effetto a Cascata (Stagger) */}
                            {searchResults.length > 0 && !isAiThinking && !aiResponse && (
                                <motion.div
                                    initial="hidden"
                                    animate="visible"
                                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                                    className="flex flex-col gap-2 mt-2 relative z-10"
                                >
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lavoratori in archivio</span>
                                    {searchResults.map(w => (
                                        <motion.button
                                            key={w.id}
                                            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } } }}
                                            onClick={() => handleOpenWorker(w)}
                                            className="flex items-center gap-3 p-3 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200/50 dark:border-slate-700/50 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{w.cognome} {w.nome}</h4>
                                                <p className="text-[10px] text-slate-500 uppercase">{w.profilo} • {w.ruolo}</p>
                                            </div>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}

                            {/* Risposta Gemini AI SICURA E OTTIMIZZATA */}
                            <AnimatePresence>
                                {isAiThinking && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 text-fuchsia-600/70 dark:text-fuchsia-400/80 py-2 relative z-10 overflow-hidden">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-[10px] font-black tracking-widest uppercase drop-shadow-sm">Sincronizzazione Rete Neurale...</span>
                                    </motion.div>
                                )}

                                {aiResponse && !isAiThinking && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: 10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                        // ✨ FIX: Aggiunto max-h-[60vh] e overflow-y-auto per permettere lo scorrimento
                                        className="bg-linear-to-br from-fuchsia-50/80 to-white/50 dark:from-fuchsia-950/30 dark:to-slate-900/50 border border-fuchsia-200/60 dark:border-fuchsia-500/20 p-4 rounded-xl relative z-10 backdrop-blur-md shadow-sm max-h-[60vh] overflow-y-auto custom-scrollbar pointer-events-auto"
                                    >
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {aiResponse}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* STATO 8: CRONOLOGIA CALCOLATRICE RIFINITO */}
                    {mode === 'calc_history' && (
                        <motion.div key="calc_history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 pb-5 w-full h-[250px] flex flex-col">
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
                            // ✨ FIX 2B: Initial in fade puro (senza muoversi dal basso), si "spalma" sulla pillola che si sta allargando
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.1 } }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
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
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
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
                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center justify-around w-full px-3 py-1.5 h-10"
                        >
                            {islandContext === 'report' ? (
                                <>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-dashboard'))} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors group relative" title="Torna alla Dashboard"><ArrowLeft size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-edit'))} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors group relative" title="Torna alla Gestione Dati"><LayoutGrid size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-print'))} className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-colors group relative" title="Stampa Immediata"><Printer size={18} strokeWidth={2.5} /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-dashboard'))} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors group relative" title="Torna alla Dashboard"><ArrowLeft size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-download'))} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors group relative" title="Scarica Tabelle Dati (PDF)"><Download size={18} strokeWidth={2.5} /></button>
                                    <div className="w-px h-5 bg-slate-700/50"></div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('trigger-report'))} className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-colors group relative" title="Vai al Report Ufficiale"><FileSpreadsheet size={18} strokeWidth={2.5} /></button>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default DynamicIsland;