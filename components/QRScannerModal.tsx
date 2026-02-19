
import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, CheckCircle, Loader2 } from 'lucide-react';
import { supabase, createScanSession } from '../utils/supabaseClient';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (data: any) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<'generating' | 'waiting' | 'scanning' | 'success'>('generating');

    // 1. INIT SESSION
    useEffect(() => {
        if (isOpen) {
            const newSession = uuidv4();
            setSessionId(newSession);
            setStatus('generating');

            // Crea record su Supabase
            createScanSession(newSession).then(() => {
                setStatus('waiting');
            });
        }
    }, [isOpen]);

    // 2. LISTEN FOR UPDATES
    useEffect(() => {
        if (!isOpen || !sessionId) return;

        const channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'scan_sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    const newData = payload.new;
                    if (newData.status === 'completed' && newData.data) {
                        setStatus('success');
                        setTimeout(() => {
                            onScanSuccess(newData.data);
                            onClose();
                        }, 1500);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, sessionId, onScanSuccess, onClose]);

    if (!isOpen) return null;

    // URL Mobile (punta alla stessa app ma con parametro ?mobile=true)
    const mobileUrl = `${window.location.origin}/?mobile=true&session=${sessionId}`;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* HEADER */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-indigo-500" /> Scansione Mobile
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* CONTENT */}
                    <div className="p-8 flex flex-col items-center text-center">

                        {status === 'generating' && (
                            <div className="py-12 flex flex-col items-center">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                                <p className="text-slate-500">Inizializzazione sessione sicura...</p>
                            </div>
                        )}

                        {status === 'waiting' && (
                            <>
                                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-indigo-100 mb-6">
                                    <QRCode
                                        value={mobileUrl}
                                        size={220}
                                        fgColor="#1e293b"
                                    />
                                </div>
                                <p className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                                    Inquadra il QR con il tuo telefono
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                                    Si aprirà una pagina web sicura dove potrai scattare o caricare la foto della busta paga.
                                </p>
                                <a href={mobileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 underlines mt-4 opacity-50 hover:opacity-100">
                                    Simula da questo PC (Debug)
                                </a>
                            </>
                        )}

                        {status === 'success' && (
                            <div className="py-12 flex flex-col items-center">
                                <motion.div
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
                                >
                                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                                </motion.div>
                                <h4 className="text-2xl font-bold text-emerald-600 mb-2">Scansione Ricevuta!</h4>
                                <p className="text-slate-500">Sto elaborando i dati...</p>
                            </div>
                        )}

                    </div>

                    {/* FOOTER */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700">
                        Session ID: <span className="font-mono">{sessionId.slice(0, 8)}...</span>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default QRScannerModal;