import React, { useState, useRef } from 'react';
import { Camera, Loader2, CheckCircle2, UploadCloud, Plus, X, FileText, Image as ImageIcon, Smartphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

// ACCETTIAMO SESSION ID COME PROP (passata da App.tsx)
const MobileUploadPage = ({ sessionId }: { sessionId: string }) => {

    // USIAMO IL LETTORE NATIVO DEL BROWSER invece di react-router-dom
    const searchParams = new URLSearchParams(window.location.search);
    const company = searchParams.get('company') || 'Azienda';
    const workerName = searchParams.get('name') || 'Lavoratore';

    // STATO PER LA CODA DI FILE
    const [files, setFiles] = useState<File[]>([]);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // DUE REF SEPARATI PER FOTOCAMERA E GALLERIA
    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    // Helper Base64
    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    // GESTIONE SELEZIONE FILE
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
        // Resetta l'input per permettere selezioni ripetute
        if (e.target) e.target.value = '';
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // --- MOTORE DI INVIO SERIALE ---
    const handleUploadAll = async () => {
        if (files.length === 0 || !sessionId) return;

        setUploadStatus('uploading');
        setProgress({ current: 0, total: files.length });

        // Notifica Supabase che iniziamo
        await supabase.from('scan_sessions').update({ status: 'processing' }).eq('id', sessionId);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const base64 = await toBase64(file);

                const response = await fetch('/.netlify/functions/scan-payslip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileData: base64,
                        mimeType: file.type,
                        company: company
                    })
                });

                const aiData = await response.json();
                aiData._batchId = Date.now() + i;

                await supabase.from('scan_sessions').update({
                    status: 'completed',
                    data: aiData
                }).eq('id', sessionId);

                await new Promise(r => setTimeout(r, 500));
                setProgress({ current: i + 1, total: files.length });
            }
            setUploadStatus('success');
        } catch (error) {
            console.error(error);
            alert("Errore durante l'invio. Riprova.");
            setUploadStatus('idle');
        }
    };

    // --- SCHERMATA DI SUCCESSO ---
    if (uploadStatus === 'success') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#020617] flex items-center justify-center flex-col text-white p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent"></div>
                <motion.div
                    initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 15 }}
                    className="w-32 h-32 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(16,185,129,0.4)] relative z-10 rotate-12"
                >
                    <CheckCircle2 className="w-16 h-16 text-white -rotate-12" strokeWidth={2.5} />
                </motion.div>

                <h1 className="text-4xl font-black mb-3 tracking-tight relative z-10">Tutto Inviato!</h1>
                <p className="text-slate-400 mb-10 text-lg font-medium relative z-10">
                    Abbiamo inviato <b className="text-emerald-400">{files.length} documenti</b>.<br />
                    Guarda lo schermo del tuo PC.
                </p>

                <button
                    onClick={() => { setUploadStatus('idle'); setFiles([]); }}
                    className="w-full py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white font-bold border border-white/10 transition-all relative z-10 active:scale-95 uppercase tracking-widest text-sm"
                >
                    Scansiona Altri
                </button>
            </motion.div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans relative pb-32">

            {/* GLOW BACKGROUND EFFETTO MODERNO */}
            <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            {/* HEADER GLASSMORPHISM */}
            <div className="p-5 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Smartphone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest leading-none mb-1">Connesso a {company}</p>
                            <h1 className="text-lg font-black leading-none truncate max-w-[200px]">{workerName}</h1>
                        </div>
                    </div>
                    {files.length > 0 && (
                        <div className="bg-white/10 border border-white/10 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
                            {files.length} File
                        </div>
                    )}
                </div>
            </div>

            {/* AREA CENTRALE (SCROLLABILE) */}
            <div className="flex-1 p-5 relative z-10">

                <AnimatePresence mode="wait">
                    {files.length === 0 ? (
                        /* STATO VUOTO (EMPTY STATE PREMIUM) */
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="h-[60vh] flex flex-col items-center justify-center"
                        >
                            <div className="w-48 h-48 relative flex items-center justify-center mb-6">
                                <div className="absolute inset-0 border-2 border-dashed border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
                                <div className="absolute inset-2 border-2 border-dashed border-cyan-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                                    <Camera className="w-10 h-10 text-indigo-300" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-black mb-2 tracking-tight text-center">Nessun Documento</h2>
                            <p className="text-slate-400 text-center text-sm font-medium max-w-[250px] leading-relaxed">
                                Usa i pulsanti in basso per fotografare le buste paga o caricarle dalla galleria.
                            </p>
                        </motion.div>
                    ) : (
                        /* GRIGLIA FILE (CON ANTEPRIME IMMAGINI) */
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="grid grid-cols-2 gap-4"
                        >
                            <AnimatePresence>
                                {files.map((file, idx) => {
                                    // Creiamo l'URL per l'anteprima (se è un'immagine)
                                    const isImage = file.type.startsWith('image/');
                                    const previewUrl = isImage ? URL.createObjectURL(file) : null;

                                    return (
                                        <motion.div
                                            key={`${file.name}-${idx}`}
                                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                                            className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-slate-800 border border-white/10 shadow-lg group"
                                        >
                                            {/* Anteprima Immagine o Icona Documento */}
                                            {isImage ? (
                                                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                    <FileText className="w-12 h-12 text-slate-500" />
                                                </div>
                                            )}

                                            {/* Gradiente Scuro in basso per leggere il testo */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent"></div>

                                            {/* Info File */}
                                            <div className="absolute bottom-3 left-3 right-3">
                                                <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2 py-1 rounded-md line-clamp-1 border border-white/10">
                                                    {file.name}
                                                </span>
                                            </div>

                                            {/* Badge Numero */}
                                            <div className="absolute top-3 left-3 bg-indigo-500 text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                                                #{idx + 1}
                                            </div>

                                            {/* Bottone Elimina */}
                                            <button
                                                onClick={() => removeFile(idx)}
                                                className="absolute top-2 right-2 w-8 h-8 bg-black/40 hover:bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-colors"
                                            >
                                                <X size={16} strokeWidth={3} />
                                            </button>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- BOTTOM ACTION BAR (FLOATING NATIVE STYLE) --- */}
            <div className="fixed bottom-0 left-0 w-full p-5 pb-8 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/5 z-50 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">

                {/* INPUT NASCOSTI */}
                {/* 1. Forza la Fotocamera */}
                <input type="file" accept="image/*" capture="environment" multiple ref={cameraRef} className="hidden" onChange={handleFileSelect} />
                {/* 2. Sfoglia Galleria/File */}
                <input type="file" accept="image/*,application/pdf" multiple ref={galleryRef} className="hidden" onChange={handleFileSelect} />

                {uploadStatus === 'uploading' ? (
                    /* STATO CARICAMENTO (Neon ProgressBar) */
                    <div className="w-full bg-slate-900 rounded-2xl p-5 border border-indigo-500/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50 shrink-0">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-2 text-indigo-300">
                                    <span>Invio Dati in corso</span>
                                    <span>{progress.current} / {progress.total}</span>
                                </div>
                                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300 relative"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    >
                                        <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/50 blur-[2px]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* BOTTONI AZIONE */
                    <div className="flex flex-col gap-3">

                        {/* Se ci sono già file, mostriamo il tastone INVIA come principale */}
                        {files.length > 0 && (
                            <button
                                onClick={handleUploadAll}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 rounded-2xl text-white font-black flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.8)] transition-all active:scale-95 border border-white/20 text-lg uppercase tracking-wide"
                            >
                                <UploadCloud className="w-6 h-6 animate-bounce" />
                                Invia {files.length} Documenti
                            </button>
                        )}

                        <div className="flex gap-3">
                            {/* BOTTONE FOTOCAMERA */}
                            <button
                                onClick={() => cameraRef.current?.click()}
                                className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border
                                    ${files.length === 0
                                        ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white border-white/20 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.8)]'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    }`}
                            >
                                <Camera className="w-5 h-5" />
                                {files.length === 0 ? 'Scatta Foto' : 'Aggiungi'}
                            </button>

                            {/* BOTTONE GALLERIA */}
                            <button
                                onClick={() => galleryRef.current?.click()}
                                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
                            >
                                <ImageIcon className="w-5 h-5" />
                                Sfoglia
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileUploadPage;