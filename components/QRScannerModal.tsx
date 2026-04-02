import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, FileText, Smartphone, Cpu, Archive, Sparkles } from 'lucide-react';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabaseClient';
import { useIsland } from '../IslandContext';

// ✨ MEMORIA GLOBALE INDISTRUTTIBILE
let globalSessionId = '';
let globalProcessedIds = new Set<any>();

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (data: any) => void;
    company?: string;
    workerName?: string;
    eliorType?: string; // <--- AGGIUNTA QUESTA!
    customColumns?: any[];
    scanMode?: 'ai' | 'archive'; // Prop passata dal bottone PC
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
    isOpen, onClose, onScanSuccess, company = 'RFI', workerName = 'Lavoratore', eliorType, customColumns, scanMode = 'ai' // <--- AGGIUNTO eliorType
}) => {
    const { startUpload, updateUploadProgress, finishUpload } = useIsland();
    const hasStartedUpload = useRef(false);

    // ✨ LO SWITCH INTERNO E LA SUA "MEMORIA FOTOGRAFICA" INFALLIBILE
    const [localScanMode, setLocalScanMode] = useState<'ai' | 'archive'>(scanMode);
    const scanModeRef = useRef(localScanMode);

    // Quando cambia l'interruttore, aggiorniamo subito la memoria fotografica!
    useEffect(() => {
        scanModeRef.current = localScanMode;
    }, [localScanMode]);

    // All'apertura, allineiamo l'interruttore al bottone che abbiamo cliccato su PC
    useEffect(() => {
        if (isOpen) setLocalScanMode(scanMode);
    }, [isOpen, scanMode]);

    const [sessionId, setSessionId] = useState('');
    const [status, setStatus] = useState<'waiting' | 'processing' | 'file_done' | 'all_done' | 'error'>('waiting');
    const [errorMessage, setErrorMessage] = useState('');
    const [scannedCount, setScannedCount] = useState(0);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [isPoweringOff, setIsPoweringOff] = useState(false);
    const [isDropping, setIsDropping] = useState(false);
    const [isScreenOff, setIsScreenOff] = useState(false);
    const latestOnScanSuccess = useRef(onScanSuccess);
    const latestOnClose = useRef(onClose);
    const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
    const pollingTimer = useRef<NodeJS.Timeout | null>(null);
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        latestOnScanSuccess.current = onScanSuccess;
        latestOnClose.current = onClose;
    }, [onScanSuccess, onClose]);

    // MOTORE OROLOGIO
    useEffect(() => {
        const updateTime = () => setCurrentTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // FEEDBACK SONORI
    const playSuccessBeep = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    const playFinalSuccessChime = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch (e) { }
    };

    const playErrorBuzz = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch (e) { }
    };

    const triggerClose = async () => {
        if (isPoweringOff || isDropping) return;
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (pollingTimer.current) clearTimeout(pollingTimer.current);

        if (globalSessionId) await supabase.from('scan_sessions').delete().eq('id', globalSessionId);

        setIsPoweringOff(true);
        setTimeout(() => {
            setIsDropping(true);
            setTimeout(() => {
                globalSessionId = '';
                globalProcessedIds.clear();
                latestOnClose.current();
                setIsPoweringOff(false);
                setIsDropping(false);
                setStatus('waiting');
                setScannedCount(0);
                setSyncProgress({ current: 0, total: 0 });
            }, 300);
        }, 200);
    };

    const resetInactivityTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => triggerClose(), 600000);
    };

    useEffect(() => {
        if (!isOpen) return;

        if (!globalSessionId) {
            hasStartedUpload.current = false;
            globalSessionId = uuidv4();
            globalProcessedIds.clear();
        }

        setSessionId(globalSessionId);
        setScannedCount(globalProcessedIds.size);
        setStatus(globalProcessedIds.size > 0 ? 'processing' : 'waiting');
        setIsPoweringOff(false); setIsDropping(false); setIsScreenOff(false);
        resetInactivityTimer();

        let isPolling = true;

        const initDb = async () => {
            try { await supabase.from('scan_sessions').insert([{ id: globalSessionId, status: 'waiting' }]); } catch (err) { }
            startPolling();
        };

        const startPolling = async () => {
            if (!isPolling) return;
            try {
                const { data } = await supabase.from('scan_sessions').select('*').eq('id', globalSessionId).single();
                if (data) {
                    if (data.status === 'all_done') {
                        setStatus('all_done');
                        playFinalSuccessChime();
                        isPolling = false;
                        if (pollingTimer.current) clearTimeout(pollingTimer.current);

                        finishUpload(globalProcessedIds.size, 0, 'mobile');
                        setTimeout(() => triggerClose(), 1200);
                        return;
                    }

                    if (data.status === 'processing') {
                        setStatus(prev => prev === 'all_done' ? 'all_done' : 'processing');

                        if (!hasStartedUpload.current) {
                            hasStartedUpload.current = true;
                            setIsScreenOff(true);

                            setTimeout(() => {
                                setIsDropping(true);
                                let totalFiles = 1;
                                try {
                                    if (data.data) {
                                        const p = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                                        if (p.total) totalFiles = p.total;
                                    }
                                } catch (e) { }
                                startUpload('mobile', totalFiles);
                            }, 500);
                        }

                        if (data.data) {
                            try {
                                const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                                if (parsed.total) {
                                    setSyncProgress({ current: parsed.current, total: parsed.total });
                                    updateUploadProgress(parsed.current);
                                }
                            } catch (e) { }
                        }
                    }
                    else if (data.status === 'completed' && data.data) {
                        let resultsArray: any[] = [];
                        try {
                            const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                            resultsArray = Array.isArray(parsed) ? parsed : [parsed];
                        } catch (err) { console.error("Errore parsing array", err); }

                        let addedNewFile = false;

                        resultsArray.forEach((item: any) => {
                            if (item && item._batchId && !globalProcessedIds.has(item._batchId)) {
                                globalProcessedIds.add(item._batchId);

                                // ✨ LA MAGIA: Qui usiamo la Memoria Fotografica (scanModeRef.current) 
                                // così è sempre aggiornata all'ultima mossa dell'utente!
                                if (scanModeRef.current === 'archive') {
                                    if (item.fileData) {
                                        try {
                                            const link = document.createElement('a');
                                            link.href = `data:${item.mimeType};base64,${item.fileData}`;
                                            const sanitizedName = workerName.replace(/[^a-zA-Z0-9]/g, '_');
                                            const monthTitle = item.title ? item.title.replace(/[^a-zA-Z0-9]/g, '_') : 'Documento';
                                            const ext = item.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
                                            link.download = `${company}_${sanitizedName}_${monthTitle}.${ext}`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);

                                            window.dispatchEvent(new CustomEvent('island-scan-label', { detail: `SCARICATO: ${item.title}` }));
                                        } catch (downloadErr) {
                                            console.error("Errore download:", downloadErr);
                                        }
                                    }
                                } else {
                                    // Modalità AI
                                    latestOnScanSuccess.current(item);
                                    window.dispatchEvent(new CustomEvent('mobile-onboarding-data', { detail: item }));
                                }

                                addedNewFile = true;
                            }
                        });

                        if (addedNewFile) {
                            playSuccessBeep();
                            resetInactivityTimer();
                            setScannedCount(globalProcessedIds.size);
                            updateUploadProgress(globalProcessedIds.size);
                            setStatus('file_done');
                            setTimeout(() => {
                                setStatus(prev => prev === 'all_done' ? 'all_done' : 'processing');
                            }, 800);
                        }
                    }
                    else if (data.status === 'error') {
                        const errorReason = data.data || "Immagine illeggibile o sfocata.";
                        setErrorMessage(errorReason);
                        setStatus('error');
                        playErrorBuzz();

                        if (hasStartedUpload.current) {
                            finishUpload(0, 1, 'mobile', errorReason);
                            setTimeout(() => triggerClose(), 2000);
                        } else {
                            await supabase.from('scan_sessions').update({ data: null, status: 'waiting' }).eq('id', globalSessionId);
                            setTimeout(() => { if (isPolling) setStatus('waiting'); }, 3000);
                        }
                    }
                }
            } catch (e) { }

            if (isPolling) {
                pollingTimer.current = setTimeout(startPolling, 400);
            }
        };

        initDb();
        return () => {
            isPolling = false;
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            if (pollingTimer.current) clearTimeout(pollingTimer.current);
        };
    }, [isOpen, company, workerName]); // <--- Rimosso scanMode dalle dipendenze per evitare riavvii del polling

    if (!isOpen) return null;

    const eliorParam = eliorType ? `&eliorType=${encodeURIComponent(eliorType)}` : '';

    // L'URL dinamico in base alla pillola
    const qrUrl = `${window.location.origin}/?mobile=true&session=${sessionId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(workerName)}${eliorParam}&type=${localScanMode}`;

    const appleTransition = { type: "spring", damping: 25, stiffness: 200 };
    const isVisuallyHidden = status === 'processing' || status === 'file_done' || status === 'all_done';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: (isDropping || isVisuallyHidden) ? 0 : 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-700 h-screen w-screen ${(isDropping || isVisuallyHidden) ? 'bg-transparent pointer-events-none backdrop-blur-none' : 'bg-slate-950/80 backdrop-blur-2xl'}`}
        >
            <div className={`absolute w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none transition-opacity duration-500 ${(isDropping || isVisuallyHidden) ? 'opacity-0' : 'opacity-100'}`}></div>

            <motion.div
                initial={globalProcessedIds.size > 0 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0, y: 20 }}
                animate={{
                    scale: (isDropping || isVisuallyHidden) ? 0.7 : 1,
                    opacity: (isDropping || isVisuallyHidden) ? 0 : 1,
                    y: (isDropping || isVisuallyHidden) ? 200 : 0,
                    filter: (isDropping || isVisuallyHidden) ? 'blur(10px)' : 'blur(0px)'
                }}
                transition={appleTransition}
                className={`w-[350px] h-[720px] rounded-[3.5rem] p-3 border-[2px] border-[#4a4a50] relative flex flex-col bg-gradient-to-b from-[#2a2a30] to-[#1a1a1f] transition-shadow duration-700 ${status === 'waiting' ? 'shadow-[0_0_60px_rgba(79,70,229,0.35)]' : 'shadow-none'}`}
            >
                {/* Tasti Fisici */}
                <div className="absolute top-32 -left-[3px] w-[3px] h-8 bg-[#3a3a40] rounded-l-md"></div>
                <div className="absolute top-44 -left-[3px] w-[3px] h-12 bg-[#3a3a40] rounded-l-md"></div>
                <div className="absolute top-60 -left-[3px] w-[3px] h-12 bg-[#3a3a40] rounded-l-md"></div>
                <div className="absolute top-48 -right-[3px] w-[3px] h-16 bg-[#3a3a40] rounded-r-md"></div>

                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent rounded-[3.5rem] pointer-events-none z-50"></div>

                <div className="w-full h-full bg-gradient-to-b from-[#0f172a] to-[#020617] rounded-[3rem] relative overflow-hidden flex flex-col ring-1 ring-black">

                    <AnimatePresence>
                        {isPoweringOff && (
                            <motion.div
                                className="absolute inset-0 z-[100] flex items-center justify-center bg-black"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}
                            />
                        )}
                    </AnimatePresence>

                    {/* DYNAMIC ISLAND */}
                    <div className="absolute top-0 inset-x-0 flex justify-center z-50 pt-3">
                        <div className="w-28 h-8 bg-black rounded-full flex items-center justify-between px-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#0a0f1c] relative overflow-hidden">
                                <div className="absolute top-[1px] right-[1px] w-[1.5px] h-[1.5px] bg-blue-400/60 rounded-full blur-[0.5px]"></div>
                            </div>
                            <div className={`w-1.5 h-1.5 rounded-full ${status === 'waiting' ? 'bg-emerald-500' : status === 'all_done' ? 'bg-emerald-400' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`}></div>
                        </div>
                    </div>

                    {/* STATUS BAR iOS */}
                    <div className="absolute top-3.5 left-7 right-6 flex justify-between items-center z-40 pointer-events-none">
                        <span className="text-white font-semibold text-[12px] tracking-tight">{currentTime}</span>
                        <div className="flex gap-1.5 items-center opacity-90 mt-0.5">
                            <div className="flex items-end gap-[1.5px] h-[10px]">
                                <div className="w-[2.5px] h-[4px] bg-white rounded-sm"></div>
                                <div className="w-[2.5px] h-[6px] bg-white rounded-sm"></div>
                                <div className="w-[2.5px] h-[8px] bg-white rounded-sm"></div>
                                <div className="w-[2.5px] h-[10px] bg-white rounded-sm"></div>
                            </div>
                            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.5 11C8.21731 11 8.79093 10.4283 8.79093 9.71343C8.79093 8.99859 8.21731 8.42691 7.5 8.42691C6.78269 8.42691 6.20907 8.99859 6.20907 9.71343C6.20907 10.4283 6.78269 11 7.5 11Z" fill="white" />
                                <path d="M10.8711 7.3752C9.97341 6.47761 8.78443 5.98375 7.50005 5.98375C6.21568 5.98375 5.02672 6.47761 4.12903 7.3752L3.25055 6.49673C4.38541 5.36187 5.89531 4.73688 7.50005 4.73688C9.10478 4.73688 10.6147 5.36187 11.7495 6.49673L10.8711 7.3752Z" fill="white" />
                                <path d="M14.2863 3.96001C12.4746 2.1484 10.0659 1.15045 7.50005 1.15045C4.93416 1.15045 2.52549 2.1484 0.713806 3.96001L0 3.08154C2.00412 1.07742 4.66442 0 7.50005 0C10.3357 0 12.996 1.07742 15 3.08154L14.2863 3.96001Z" fill="white" />
                            </svg>
                            <div className="flex items-center">
                                <div className="w-[23px] h-[12px] border border-white/50 rounded-[4px] p-[1.5px] relative">
                                    <div className="bg-white h-full w-[80%] rounded-[2px]"></div>
                                </div>
                                <div className="w-[1.5px] h-1 bg-white/50 rounded-r-sm ml-[1px]"></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center px-6 pt-20 pb-4 relative z-20">
                        <h2 className="text-white font-semibold text-xl tracking-tight">
                            {status === 'waiting' ? 'Scanner' : status === 'all_done' ? 'Completato' : 'Sincronizzazione'}
                        </h2>
                        <button onClick={triggerClose} className="w-8 h-8 bg-[#1c1c1e] rounded-full flex items-center justify-center text-white/70 hover:bg-[#2c2c2e] transition-colors z-50">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* CONTENUTO CENTRALE */}
                    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 relative">
                        <div className="w-full relative flex items-center justify-center mb-6 h-[300px]">
                            <AnimatePresence mode="popLayout">
                                {status === 'waiting' ? (
                                    <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={appleTransition} className="absolute inset-0 flex flex-col items-center justify-center px-5">
                                        {/* QR CODE CON BORDO DINAMICO */}
                                        <div className={`bg-white p-4 rounded-[2rem] relative overflow-hidden shadow-2xl ring-4 transition-colors duration-500 ${localScanMode === 'ai' ? 'ring-indigo-500/20' : 'ring-cyan-500/20'}`}>
                                            <QRCode value={qrUrl} size={170} level="M" />
                                            <motion.div
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3.5, ease: "linear", repeat: Infinity }}
                                                className={`absolute left-0 right-0 h-[2px] z-20 opacity-70 transition-colors duration-500 ${localScanMode === 'ai' ? 'bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,0.5)]' : 'bg-cyan-400 shadow-[0_0_10px_2px_rgba(34,211,238,0.5)]'}`}
                                            />
                                        </div>

                                        {/* SELETTORE STILE iOS (Segmented Control) */}
                                        <div className="mt-8 w-full bg-[#1c1c1e] p-1 rounded-[14px] flex relative shadow-inner border border-[#2c2c2e]">
                                            <motion.div
                                                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[10px] shadow-sm transition-colors duration-300 ${localScanMode === 'ai' ? 'bg-indigo-600' : 'bg-cyan-600'}`}
                                                animate={{ left: localScanMode === 'ai' ? '4px' : 'calc(50%)' }}
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                            <button onClick={() => setLocalScanMode('ai')} className="flex-1 py-2.5 relative z-10 flex items-center justify-center gap-2">
                                                <Sparkles className={`w-3.5 h-3.5 transition-colors ${localScanMode === 'ai' ? 'text-white' : 'text-slate-500'}`} />
                                                <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${localScanMode === 'ai' ? 'text-white' : 'text-slate-500'}`}>AI Scan</span>
                                            </button>
                                            <button onClick={() => setLocalScanMode('archive')} className="flex-1 py-2.5 relative z-10 flex items-center justify-center gap-2">
                                                <Archive className={`w-3.5 h-3.5 transition-colors ${localScanMode === 'archive' ? 'text-white' : 'text-slate-500'}`} />
                                                <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${localScanMode === 'archive' ? 'text-white' : 'text-slate-500'}`}>Archivio PC</span>
                                            </button>
                                        </div>
                                    </motion.div>

                                ) : status === 'processing' ? (
                                    <motion.div key="processing" initial={{ opacity: 0, filter: 'blur(5px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(5px)' }} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/90 to-slate-950 rounded-[2.8rem] border border-indigo-500/20 p-6 overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.25)_0%,transparent_70%)] animate-pulse"></div>
                                        <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className={`absolute inset-0 border-[2px] border-transparent rounded-full ${localScanMode === 'ai' ? 'border-t-indigo-400 border-r-indigo-400/30' : 'border-t-cyan-400 border-r-cyan-400/30'}`}></motion.div>
                                            <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className={`absolute inset-3 border-[2px] border-transparent rounded-full ${localScanMode === 'ai' ? 'border-b-indigo-400 border-l-indigo-400/30' : 'border-b-cyan-400 border-l-cyan-400/30'}`}></motion.div>
                                            <div className={`absolute inset-0 blur-xl rounded-full ${localScanMode === 'ai' ? 'bg-indigo-500/10' : 'bg-cyan-500/10'}`}></div>
                                            <Cpu className={`w-8 h-8 relative z-10 ${localScanMode === 'ai' ? 'text-indigo-300' : 'text-cyan-300'}`} strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-white font-semibold text-lg mb-1 tracking-tight relative z-10 drop-shadow-md">{localScanMode === 'archive' ? 'Ricezione e Salvataggio...' : 'Estrazione AI in corso'}</h3>
                                        <p className="text-indigo-300/60 text-sm mb-10 relative z-10">Mantenere lo schermo attivo</p>
                                        <div className="w-4/5 bg-slate-900/80 rounded-full h-1.5 overflow-hidden relative z-10 border border-slate-800 shadow-inner">
                                            <motion.div className={`h-full rounded-full relative ${localScanMode === 'ai' ? 'bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'}`} initial={{ width: '0%' }} animate={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '50%' }} transition={{ duration: 0.4, ease: "easeOut" }}>
                                                <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/60 blur-[2px]"></div>
                                            </motion.div>
                                        </div>
                                        {syncProgress.total > 0 && <span className="text-indigo-300/80 font-mono font-medium text-[11px] mt-4 tracking-widest uppercase relative z-10">Documento {syncProgress.current} di {syncProgress.total}</span>}
                                    </motion.div>

                                ) : status === 'file_done' ? (
                                    <motion.div key="file_done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.2 }} className="absolute inset-0 flex flex-col items-center justify-center">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${localScanMode === 'ai' ? 'bg-indigo-500' : 'bg-cyan-500'}`}><Check className="w-8 h-8 text-white" strokeWidth={3} /></div>
                                    </motion.div>

                                ) : status === 'all_done' ? (
                                    <motion.div key="all_done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={appleTransition} className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5">
                                            <motion.div initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                                                <Check className="w-12 h-12 text-black" strokeWidth={3.5} />
                                            </motion.div>
                                        </div>
                                        <h2 className="text-white font-semibold text-2xl tracking-tight">Fatto</h2>
                                    </motion.div>

                                ) : (
                                    <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                        <AlertTriangle className="w-14 h-14 text-red-500 mb-4" />
                                        <span className="text-red-500 font-medium text-sm text-center max-w-[200px] leading-snug">{errorMessage}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="h-28 w-full flex flex-col items-center justify-start relative z-20">
                            <AnimatePresence mode="popLayout">
                                {scannedCount === 0 ? (
                                    <motion.div key="testo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(5px)' }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center absolute inset-0 px-4">
                                        <p className="text-[#8e8e93] text-[15px] leading-snug font-medium">Inquadra il codice QR con la fotocamera del tuo smartphone.</p>
                                    </motion.div>
                                ) : (
                                    <motion.div key="azioni" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={appleTransition} className="flex flex-col items-center w-full gap-5 absolute inset-0">
                                        <div className="flex -space-x-3">
                                            {Array.from({ length: Math.min(scannedCount, 5) }).map((_, i) => (
                                                <motion.div key={`file-${i}`} initial={{ opacity: 0, y: -20, x: -10 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ type: "spring", damping: 15 }} className="w-11 h-14 bg-[#1c1c1e] border border-[#2c2c2e] rounded-[10px] flex items-center justify-center z-10 shadow-lg">
                                                    <FileText className={`w-4 h-4 ${localScanMode === 'ai' ? 'text-indigo-500' : 'text-cyan-500'}`} strokeWidth={2} />
                                                </motion.div>
                                            ))}
                                            {scannedCount > 5 && (
                                                <div className="w-11 h-14 bg-[#1c1c1e] border border-[#2c2c2e] rounded-[10px] shadow-lg flex items-center justify-center z-20 translate-x-3">
                                                    <span className="text-[11px] font-semibold text-white">+{scannedCount - 5}</span>
                                                </div>
                                            )}
                                        </div>
                                        {status !== 'all_done' && (
                                            <button onClick={triggerClose} className={`w-full py-4 bg-gradient-to-r text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg transition-all active:scale-95 mt-auto ${localScanMode === 'ai' ? 'from-indigo-600 to-indigo-500 shadow-indigo-500/30' : 'from-cyan-600 to-cyan-500 shadow-cyan-500/30'}`}>
                                                {status === 'all_done' ? 'Chiusura in corso...' : `Termina Sessione (${scannedCount})`}
                                            </button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none z-50">
                        <div className="w-32 h-[5px] bg-white rounded-full"></div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default QRScannerModal;