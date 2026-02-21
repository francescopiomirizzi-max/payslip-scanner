import React, { useState, useRef } from 'react';
import { Camera, Loader2, CheckCircle2, UploadCloud, Plus, X, FileText, Image as ImageIcon, Smartphone, Zap, UserPlus, Wand2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

const MobileUploadPage = ({ sessionId }: { sessionId: string }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const company = searchParams.get('company') || 'Azienda';
    const workerName = searchParams.get('name') || 'Lavoratore';

    // --- MAGIA: Leggiamo il tipo di sessione dall'URL ---
    const sessionType = searchParams.get('type') || 'payslip';
    const isOnboarding = sessionType === 'onboarding';

    const [files, setFiles] = useState<File[]>([]);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    // ✨ FUNZIONE UTILE: Vibrazione nativa del telefono
    const triggerHaptic = (type: 'light' | 'success' | 'error' = 'light') => {
        if (!navigator.vibrate) return;
        if (type === 'light') navigator.vibrate(50);
        if (type === 'success') navigator.vibrate([50, 100, 50]);
        if (type === 'error') navigator.vibrate([100, 50, 100, 50, 100]);
    };

    // ✨ FUNZIONE UTILE: Compressione Immagini prima dell'invio (Evita Timeout del server)
    const processFileBase64 = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const base64String = event.target?.result as string;

                // Se è un PDF, lo lasciamo intatto
                if (file.type === 'application/pdf') {
                    resolve(base64String);
                    return;
                }

                // Se è un'immagine, la ridimensioniamo per non far crashare Netlify (Max 1500px)
                const img = new Image();
                img.src = base64String;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1500;
                    const MAX_HEIGHT = 1500;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Comprime in JPEG all'80% di qualità
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => reject(new Error("Errore compressione immagine"));
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            triggerHaptic('light');

            // Limitiamo a 1 file se siamo in modalità onboarding
            let newFiles = Array.from(e.target.files);
            if (isOnboarding && newFiles.length > 1) {
                newFiles = [newFiles[0]];
                alert("Per l'autocompilazione basta inquadrare la prima pagina del documento.");
            }

            setFiles(prev => isOnboarding ? newFiles : [...prev, ...newFiles]);
        }
        if (e.target) e.target.value = '';
    };

    const removeFile = (index: number) => {
        triggerHaptic('light');
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Format utile per mostrare il peso in KB/MB
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleUploadAll = async () => {
        if (files.length === 0 || !sessionId) return;

        triggerHaptic('light');
        setUploadStatus('uploading');
        setProgress({ current: 0, total: files.length });

        await supabase.from('scan_sessions').update({ status: 'processing' }).eq('id', sessionId);

        try {
            // Se siamo in ONBOARDING (Autocompilazione Anagrafica)
            if (isOnboarding) {
                const file = files[0]; // Prende solo il primo file
                const base64 = await processFileBase64(file);

                const response = await fetch('/.netlify/functions/scan-worker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileData: base64,
                        mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg'
                    })
                });

                if (!response.ok) throw new Error("Errore API Anagrafica");

                const aiData = await response.json();

                await supabase.from('scan_sessions').update({
                    status: 'completed',
                    data: aiData
                }).eq('id', sessionId);

                setProgress({ current: 1, total: 1 });

            } else {
                // MODO CLASSICO: Buste Paga Mensili (Ciclo su tutti i file)
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const base64 = await processFileBase64(file);

                    const response = await fetch('/.netlify/functions/scan-payslip', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileData: base64,
                            mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg',
                            company: company
                        })
                    });

                    if (!response.ok) throw new Error("Errore API Busta Paga");

                    const aiData = await response.json();
                    aiData._batchId = Date.now() + i;

                    await supabase.from('scan_sessions').update({
                        status: 'completed',
                        data: aiData
                    }).eq('id', sessionId);

                    await new Promise(r => setTimeout(r, 500));
                    setProgress({ current: i + 1, total: files.length });
                }
            }

            await supabase.from('scan_sessions').update({ status: 'all_done' }).eq('id', sessionId);
            triggerHaptic('success');
            setUploadStatus('success');
        } catch (error) {
            triggerHaptic('error');
            console.error(error);
            alert("Errore durante l'elaborazione. Riprova.");
            setUploadStatus('idle');
            // Annulliamo il blocco processing se c'è errore, per sicurezza
            await supabase.from('scan_sessions').update({ status: 'waiting' }).eq('id', sessionId);
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
                <p className="text-slate-400 mb-10 text-base font-medium relative z-10 max-w-[280px]">
                    Abbiamo elaborato <b className="text-emerald-400">{files.length} {files.length === 1 ? 'documento' : 'documenti'}</b> con successo.<br /><br />
                    I dati sono ora sul tuo PC e la finestra si è chiusa. <b>Puoi chiudere questa pagina sul telefono.</b>
                </p>

                <button
                    onClick={() => { triggerHaptic('light'); setUploadStatus('idle'); setFiles([]); }}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl text-slate-400 font-bold border border-white/5 transition-all relative z-10 active:scale-95 text-sm"
                >
                    Scansiona un altro documento
                </button>
            </motion.div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans relative pb-36">

            {/* GLOW BACKGROUND EFFETTO MODERNO */}
            <div className={`fixed top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[100px] pointer-events-none ${isOnboarding ? 'bg-purple-600/20' : 'bg-indigo-600/20'}`}></div>
            <div className={`fixed bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[100px] pointer-events-none ${isOnboarding ? 'bg-pink-600/10' : 'bg-cyan-600/10'}`}></div>

            {/* HEADER GLASSMORPHISM */}
            <div className="p-5 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg 
                            ${isOnboarding ? 'bg-gradient-to-tr from-purple-500 to-pink-500 shadow-purple-500/30' : 'bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-indigo-500/30'}`}>
                            {isOnboarding ? <UserPlus className="w-5 h-5 text-white" /> : <Smartphone className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                            {isOnboarding ? (
                                <>
                                    <p className="text-[9px] text-purple-300 font-black uppercase tracking-widest leading-none mb-1">Onboarding AI</p>
                                    <h1 className="text-lg font-black leading-none truncate max-w-[200px]">Nuova Pratica</h1>
                                </>
                            ) : (
                                <>
                                    <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest leading-none mb-1">Destinazione: {company}</p>
                                    <h1 className="text-lg font-black leading-none truncate max-w-[200px]">{workerName}</h1>
                                </>
                            )}
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
                                <div className={`absolute inset-0 border-2 border-dashed rounded-full animate-[spin_10s_linear_infinite] ${isOnboarding ? 'border-purple-500/30' : 'border-indigo-500/30'}`}></div>
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10 
                                    ${isOnboarding ? 'bg-gradient-to-tr from-purple-500/20 to-pink-500/20 shadow-[0_0_50px_rgba(168,85,247,0.2)]' : 'bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]'}`}>
                                    {isOnboarding ? <UserPlus className="w-10 h-10 text-purple-300" /> : <Camera className="w-10 h-10 text-indigo-300" />}
                                </div>
                            </div>
                            <h2 className="text-2xl font-black mb-2 tracking-tight text-center">{isOnboarding ? 'Crea Anagrafica' : 'Nessun Documento'}</h2>
                            <p className="text-slate-400 text-center text-sm font-medium max-w-[250px] leading-relaxed">
                                {isOnboarding
                                    ? "Scatta una foto all'intestazione della busta paga per compilare il form in automatico."
                                    : "Fotografa i cedolini o caricali dalla galleria per elaborarli con l'AI."}
                            </p>
                        </motion.div>
                    ) : (
                        /* GRIGLIA FILE (CON ANTEPRIME E PESO) */
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className={`grid gap-4 ${isOnboarding ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-2'}`}
                        >
                            <AnimatePresence>
                                {files.map((file, idx) => {
                                    const isImage = file.type.startsWith('image/');
                                    const previewUrl = isImage ? URL.createObjectURL(file) : null;

                                    return (
                                        <motion.div
                                            key={`${file.name}-${idx}`}
                                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                                            className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-slate-800 border border-white/10 shadow-lg group"
                                        >
                                            {isImage ? (
                                                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 p-2">
                                                    <FileText className="w-10 h-10 text-slate-500 mb-2" />
                                                    <span className="text-xs text-slate-500 font-bold text-center uppercase">PDF Doc</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent"></div>

                                            {/* Info File e Dimensioni */}
                                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2 py-1 rounded-md line-clamp-1 border border-white/10 flex-1 mr-2">
                                                    {file.name}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-300 bg-slate-900/80 px-1.5 py-1 rounded border border-white/5 whitespace-nowrap">
                                                    {formatBytes(file.size)}
                                                </span>
                                            </div>

                                            {!isOnboarding && (
                                                <div className="absolute top-3 left-3 bg-indigo-500 text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                                                    #{idx + 1}
                                                </div>
                                            )}

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
            <div className="fixed bottom-0 left-0 w-full p-5 pb-8 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-white/5 z-50 rounded-t-[2rem] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">

                <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleFileSelect} multiple={!isOnboarding} />
                <input type="file" accept="image/*,application/pdf" ref={galleryRef} className="hidden" onChange={handleFileSelect} multiple={!isOnboarding} />

                {uploadStatus === 'uploading' ? (
                    /* STATO CARICAMENTO (Neon ProgressBar) */
                    <div className={`w-full bg-slate-900 rounded-2xl p-5 border relative overflow-hidden shadow-inner ${isOnboarding ? 'border-purple-500/30' : 'border-indigo-500/30'}`}>
                        <div className={`absolute inset-0 animate-pulse ${isOnboarding ? 'bg-purple-500/10' : 'bg-indigo-500/10'}`}></div>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 ${isOnboarding ? 'bg-purple-500/20 border-purple-500/50' : 'bg-indigo-500/20 border-indigo-500/50'}`}>
                                <Zap className={`w-5 h-5 animate-pulse ${isOnboarding ? 'text-purple-400' : 'text-indigo-400'}`} fill="currentColor" />
                            </div>
                            <div className="flex-1">
                                <div className={`flex justify-between text-xs font-black uppercase tracking-wider mb-2 ${isOnboarding ? 'text-purple-300' : 'text-indigo-300'}`}>
                                    <span>{isOnboarding ? 'Lettura Anagrafica AI' : 'Compressione & Invio'}</span>
                                    {!isOnboarding && <span>{progress.current} / {progress.total}</span>}
                                </div>
                                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className={`h-full transition-all duration-300 relative ${isOnboarding ? 'bg-gradient-to-r from-purple-500 to-pink-400 w-full animate-pulse' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'}`}
                                        style={{ width: isOnboarding ? '100%' : `${(progress.current / progress.total) * 100}%` }}
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

                        {files.length > 0 && (
                            <button
                                onClick={handleUploadAll}
                                className={`w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/20 text-lg uppercase tracking-wide
                                    ${isOnboarding
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-500 active:from-purple-700 active:to-pink-600 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.8)]'
                                        : 'bg-gradient-to-r from-indigo-600 to-blue-500 active:from-indigo-700 active:to-blue-600 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.8)]'}`}
                            >
                                <Wand2 className="w-6 h-6 animate-pulse" />
                                {isOnboarding ? 'Estrai Dati AI' : `Invia ${files.length} Documenti`}
                            </button>
                        )}

                        {(!isOnboarding || files.length === 0) && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { triggerHaptic('light'); cameraRef.current?.click(); }}
                                    className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border
                                        ${files.length === 0
                                            ? (isOnboarding ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-white/20 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.8)]' : 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white border-white/20 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.8)]')
                                            : 'bg-slate-800 text-slate-300 border-slate-700 active:bg-slate-700'
                                        }`}
                                >
                                    <Camera className="w-5 h-5" />
                                    {files.length === 0 ? 'Scatta Foto' : 'Aggiungi'}
                                </button>

                                <button
                                    onClick={() => { triggerHaptic('light'); galleryRef.current?.click(); }}
                                    className="flex-1 py-3.5 bg-slate-800 active:bg-slate-700 rounded-2xl text-slate-300 font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    Sfoglia
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileUploadPage;