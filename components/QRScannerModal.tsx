import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Smartphone, Loader2, CheckCircle2, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
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

    useEffect(() => {
        if (isOpen) {
            const newSession = Date.now().toString();
            setSessionId(newSession);
            setStatus('waiting');
            setScannedCount(0);

            // Crea la sessione nel database
            supabase.from('scan_sessions').insert([{ id: newSession, status: 'waiting' }]).then();

            // Ascolta i cambiamenti in tempo reale dal telefono
            const subscription = supabase
                .channel(`session_${newSession}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scan_sessions', filter: `id=eq.${newSession}` },
                    (payload) => {
                        const newStatus = payload.new.status;

                        // Il telefono dice che sta analizzando...
                        if (newStatus === 'processing') setStatus('processing');

                        // Il telefono ha finito e ci manda i dati!
                        if (newStatus === 'completed' && payload.new.data) {
                            setStatus('completed');
                            setScannedCount(prev => prev + 1);

                            // Inviamo i dati alla tabella principale
                            onScanSuccess(payload.new.data);

                            // Dopo 2 secondi, torna in attesa per la foto successiva
                            setTimeout(() => setStatus('waiting'), 2000);
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        }
    }, [isOpen, onScanSuccess]);

    if (!isOpen) return null;

    // IL FIX E' QUI: Costruiamo l'URL passando in modo sicuro l'azienda e il nome!
    const qrUrl = `${window.location.origin}/?mobile=true&session=${sessionId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(workerName)}`;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-white"
            >
                {/* Header Modale */}
                <div className="p-4 bg-slate-800/50 flex justify-between items-center border-b border-slate-700">
                    <span className="font-bold text-sm flex items-center gap-2 text-indigo-400">
                        <Smartphone className="w-5 h-5" /> Connessione Mobile
                    </span>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Corpo Modale */}
                <div className="p-8 flex flex-col items-center text-center">

                    {/* Contenitore QR Code animato */}
                    <div className="bg-white p-4 rounded-2xl shadow-xl mb-6 relative overflow-hidden">
                        <QRCode value={qrUrl} size={200} level="H" />

                        {/* Overlay quando sta lavorando */}
                        {status === 'processing' && (
                            <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center">
                                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-3 shadow-lg rounded-full" />
                                <span className="text-indigo-800 font-black text-sm uppercase tracking-widest">Analisi AI...</span>
                            </div>
                        )}
                        {/* Overlay di successo temporaneo */}
                        {status === 'completed' && (
                            <div className="absolute inset-0 bg-emerald-500/90 backdrop-blur-sm flex flex-col items-center justify-center">
                                <CheckCircle2 className="w-16 h-16 text-white mb-2" />
                                <span className="text-white font-black text-sm uppercase tracking-widest">Ricevuto!</span>
                            </div>
                        )}
                    </div>

                    <h3 className="text-2xl font-black mb-2 tracking-tight">Inquadra per iniziare</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-[280px] leading-relaxed">
                        Apri la fotocamera dello smartphone per inviare le buste paga in tempo reale.
                    </p>

                    {/* Avviso Fondamentale */}
                    <div className="mt-2 p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <p className="text-amber-400 text-[11px] font-bold leading-relaxed uppercase tracking-wider">
                            ⚠️ MANTENI QUESTA FINESTRA APERTA SUL PC FINCHÉ NON HAI FINITO DI INVIARE TUTTE LE FOTO.
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