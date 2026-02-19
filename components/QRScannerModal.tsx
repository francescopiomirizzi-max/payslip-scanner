import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
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
    const [status, setStatus] = useState<'waiting' | 'processing' | 'completed'>('waiting');
    const [scannedCount, setScannedCount] = useState(0);

    const latestOnScanSuccess = useRef(onScanSuccess);
    useEffect(() => {
        latestOnScanSuccess.current = onScanSuccess;
    }, [onScanSuccess]);

    useEffect(() => {
        if (!isOpen) return;

        const newSession = uuidv4();
        setSessionId(newSession);
        setStatus('waiting');
        setScannedCount(0);

        let isPolling = true;

        const initDb = async () => {
            await supabase.from('scan_sessions').insert([{ id: newSession, status: 'waiting' }]);
            startPolling();
        };

        const startPolling = async () => {
            if (!isPolling) return;

            try {
                const { data } = await supabase
                    .from('scan_sessions')
                    .select('*')
                    .eq('id', newSession)
                    .single();

                if (data) {
                    if (data.status === 'processing') {
                        setStatus('processing');
                    }

                    // SE IL TELEFONO HA FINITO TUTTO
                    if (data.status === 'all_done') {
                        // Se c'era un ultimo dato rimasto appeso, salvalo prima di chiudere
                        if (data.data && Object.keys(data.data).length > 0) {
                            const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                            latestOnScanSuccess.current(parsedData);
                        }

                        setStatus('completed');
                        isPolling = false;

                        // Aspetta un secondo per mostrare la spunta verde, poi chiudi
                        setTimeout(() => {
                            onClose();
                        }, 1200);
                        return; // Ferma il polling
                    }

                    // SE STA INVIANDO UNA FOTO SINGOLA
                    else if (data.data && Object.keys(data.data).length > 0) {
                        const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                        latestOnScanSuccess.current(parsedData);
                        setStatus('completed');
                        setScannedCount(prev => prev + 1);

                        // Svuota il database per la prossima foto
                        await supabase.from('scan_sessions').update({ status: 'waiting', data: null }).eq('id', newSession);

                        setTimeout(() => {
                            if (isPolling) setStatus('waiting');
                        }, 1500);
                    }
                }
            } catch (error) {
                // Ignora errori di rete
            }

            if (isPolling) {
                setTimeout(startPolling, 1000);
            }
        };

        initDb();

        return () => {
            isPolling = false;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const qrUrl = `${window.location.origin}/?mobile=true&session=${sessionId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(workerName)}`;

    return (
        // z-[9999] per stare sopra a tutto (anche le notifiche) e blocco dello scroll
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md overflow-hidden h-screen w-screen">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-white relative"
            >
                <div className="p-4 bg-slate-800/50 flex justify-between items-center border-b border-slate-700">
                    <span className="font-bold text-sm flex items-center gap-2 text-indigo-400">
                        <Smartphone className="w-5 h-5" /> Connessione Mobile
                    </span>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center text-center">

                    <div className="bg-white p-4 rounded-2xl shadow-xl mb-6 relative overflow-hidden">
                        <QRCode value={qrUrl} size={200} level="H" />

                        {status === 'processing' && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-3" />
                                <span className="text-indigo-800 font-black text-sm uppercase tracking-widest">Analisi AI...</span>
                            </div>
                        )}
                        {status === 'completed' && (
                            <div className="absolute inset-0 bg-emerald-500/95 backdrop-blur-sm flex flex-col items-center justify-center">
                                <CheckCircle2 className="w-16 h-16 text-white mb-2" />
                                <span className="text-white font-black text-sm uppercase tracking-widest">Ricevuto!</span>
                            </div>
                        )}
                    </div>

                    <h3 className="text-2xl font-black mb-2 tracking-tight">Inquadra per iniziare</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-[280px] leading-relaxed">
                        Apri la fotocamera dello smartphone per inviare le buste paga in tempo reale.
                    </p>

                    <div className="mt-2 p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <p className="text-emerald-400 text-[11px] font-bold leading-relaxed uppercase tracking-wider">
                            📡 RICEVITORE ATTIVO. MANTIENI APERTO FINCHÉ NON HAI INVIATO TUTTE LE FOTO.
                        </p>
                    </div>

                    {scannedCount > 0 && (
                        <p className="mt-4 text-emerald-400 font-bold text-sm">
                            Hai inserito {scannedCount} buste paga con successo!
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default QRScannerModal;