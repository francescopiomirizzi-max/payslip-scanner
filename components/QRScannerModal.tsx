import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Loader2, CheckCircle2, ScanLine } from 'lucide-react';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabaseClient';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (data: any) => void;
    company?: string;
    workerName?: string;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
    isOpen,
    onClose,
    onScanSuccess,
    company = 'RFI',
    workerName = 'Lavoratore'
}) => {
    const [sessionId, setSessionId] = useState('');
    const sessionIdRef = useRef(''); // Ci serve per accedere all'ID durante la pulizia del database
    const [status, setStatus] = useState<'waiting' | 'processing' | 'completed'>('waiting');
    const [scannedCount, setScannedCount] = useState(0);
    const [isClosing, setIsClosing] = useState(false);

    const latestOnScanSuccess = useRef(onScanSuccess);
    const latestOnClose = useRef(onClose);
    const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        latestOnScanSuccess.current = onScanSuccess;
        latestOnClose.current = onClose;
    }, [onScanSuccess, onClose]);

    // ✨ NOVITÀ 1: Feedback Sonoro (Genera un "Bip" da cassa di supermercato)
    const playSuccessBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // Frequenza del Bip
            gain.gain.setValueAtTime(0.1, ctx.currentTime); // Volume basso e gradevole
            osc.start();
            osc.stop(ctx.currentTime + 0.15); // Dura solo 0.15 secondi
        } catch (error) {
            console.error("Audio non supportato");
        }
    };

    // ✨ NOVITÀ 2 & 3: Chiusura morbida + Pulizia Database + Reset Timer
    const triggerClose = async () => {
        setIsClosing(true);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current); // Spegne il timer

        // ASPIRAPOLVERE: Elimina fisicamente la riga dal Database!
        if (sessionIdRef.current) {
            await supabase.from('scan_sessions').delete().eq('id', sessionIdRef.current);
        }

        setTimeout(() => {
            latestOnClose.current();
            setIsClosing(false);
            setStatus('waiting');
            setScannedCount(0);
        }, 400);
    };

    // ✨ NOVITÀ 3: Timer di inattività (10 minuti)
    const resetInactivityTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            console.log("Nessuna attività per 10 minuti. Chiusura di sicurezza.");
            triggerClose();
        }, 600000); // 600.000 ms = 10 minuti
    };

    useEffect(() => {
        if (!isOpen) return;

        const newSession = uuidv4();
        setSessionId(newSession);
        sessionIdRef.current = newSession; // Salvato nel ref per l'aspirapolvere

        setStatus('waiting');
        setScannedCount(0);
        setIsClosing(false);
        resetInactivityTimer(); // Fa partire il timer appena apri la finestra

        let isPolling = true;

        const initDb = async () => {
            await supabase.from('scan_sessions').insert([{ id: newSession, status: 'waiting' }]);
            startPolling();
        };

        const startPolling = async () => {
            if (!isPolling) return;

            try {
                const { data } = await supabase.from('scan_sessions').select('*').eq('id', newSession).single();

                if (data) {
                    if (data.status === 'processing') setStatus('processing');

                    // SEGNALE: "HO FINITO TUTTO" DAL TELEFONO
                    if (data.status === 'all_done') {
                        if (data.data && Object.keys(data.data).length > 0) {
                            const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                            latestOnScanSuccess.current(parsedData);
                            playSuccessBeep(); // Suona il Bip
                        }

                        setStatus('completed');
                        isPolling = false;

                        setTimeout(() => triggerClose(), 1500);
                        return;
                    }
                    // SEGNALE: ARRIVA UNA BUSTA PAGA SINGOLA IN RAFFICA
                    else if (data.data && Object.keys(data.data).length > 0) {
                        const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;

                        latestOnScanSuccess.current(parsedData); // Inserisce in tabella
                        playSuccessBeep(); // Suona il Bip!
                        resetInactivityTimer(); // Azzera il timer dei 10 minuti (sei attivo!)

                        setStatus('completed');
                        setScannedCount(prev => prev + 1);

                        await supabase.from('scan_sessions').update({ data: null }).eq('id', newSession);

                        setTimeout(() => {
                            if (isPolling) setStatus('waiting');
                        }, 1500);
                    }
                }
            } catch (error) {
                // Ignora errori di rete temporanei
            }

            if (isPolling) setTimeout(startPolling, 1000);
        };

        initDb();

        // Pulizia di emergenza se la pagina viene chiusa malamente
        return () => {
            isPolling = false;
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            if (sessionIdRef.current) {
                supabase.from('scan_sessions').delete().eq('id', sessionIdRef.current);
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const qrUrl = `${window.location.origin}/?mobile=true&session=${sessionId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(workerName)}`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isClosing ? 0 : 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl overflow-hidden h-screen w-screen"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={isClosing ? { scale: 0.9, opacity: 0, y: 20 } : { scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                className="bg-slate-900/90 border border-slate-700/50 w-full max-w-md rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden text-white relative flex flex-col"
            >
                {/* Header Premium */}
                <div className="px-6 py-5 flex justify-between items-center border-b border-slate-700/50 bg-slate-800/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <Smartphone className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm tracking-wide text-slate-100">Connessione Mobile</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">In ascolto</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => triggerClose()} className="p-2 hover:bg-slate-700/50 rounded-full text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center text-center">

                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full transform scale-110"></div>

                        <div className="bg-white p-5 rounded-3xl shadow-2xl relative overflow-hidden border-4 border-slate-800/50 group">
                            <QRCode value={qrUrl} size={180} level="H" className="relative z-10" />

                            {status === 'waiting' && (
                                <motion.div
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                                    className="absolute left-0 right-0 h-1 bg-indigo-500 shadow-[0_0_15px_3px_rgba(99,102,241,0.6)] z-20 opacity-70"
                                />
                            )}

                            <AnimatePresence>
                                {status === 'processing' && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-2xl"
                                    >
                                        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-3" />
                                        <span className="text-indigo-800 font-black text-xs uppercase tracking-widest bg-indigo-100 px-3 py-1 rounded-full">Analisi AI...</span>
                                    </motion.div>
                                )}
                                {status === 'completed' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-emerald-500/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-2xl"
                                    >
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: "spring", duration: 0.6 }}>
                                            <CheckCircle2 className="w-16 h-16 text-white mb-2 drop-shadow-lg" />
                                        </motion.div>
                                        <span className="text-white font-black text-xs uppercase tracking-widest bg-emerald-600 px-3 py-1 rounded-full shadow-inner">Ricevuto!</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <h3 className="text-2xl font-black mb-2 tracking-tight text-white flex items-center gap-2 justify-center">
                        <ScanLine className="w-6 h-6 text-indigo-400" /> Inquadra e scansiona
                    </h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-[280px] leading-relaxed">
                        Usa la fotocamera del tuo smartphone per elaborare i cedolini. La finestra si chiuderà in automatico a operazione completata.
                    </p>

                    <AnimatePresence>
                        {scannedCount > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mt-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                            >
                                <p className="text-emerald-400 font-bold text-xs uppercase tracking-wide">
                                    {scannedCount} {scannedCount === 1 ? 'busta paga inserita' : 'buste paga inserite'}!
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </motion.div>
        </motion.div>
    );
};

export default QRScannerModal;