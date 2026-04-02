import React, { useState, useRef } from 'react';
import { Camera, Loader2, CheckCircle2, X, FileText, Image as ImageIcon, Smartphone, Zap, UserPlus, Fingerprint, Crosshair, Cpu, Plus, Layers, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js'; // ✨ IMPORTANTE: Il motore OCR per leggere i mesi
import { useIsland } from '../IslandContext';

// Struttura dati per la Fascicolazione Intelligente
type DocumentFolder = {
    id: string;
    pages: File[];
    title: string;          // ✨ NUOVO: Il titolo intelligente del mese
    isDetecting: boolean;   // ✨ NUOVO: Stato di caricamento OCR
};

// --- MOTORE DI ESTRAZIONE DATE ---
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const SHORT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const guessTitleFromText = (text: string) => {
    // 1. Pulizia: tutto maiuscolo, zeri e uni corretti dall'OCR
    let t = text.toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I');

    // 2. LA REGOLA D'ORO: Cerca esplicitamente MESE + ANNO ravvicinati (es. DICEMBRE 2020)
    const monthYearRegex = /\b(GENNAIO|FEBBRAIO|MARZO|APRILE|MAGGIO|GIUGNO|LUGLIO|AGOSTO|SETTEMBRE|OTTOBRE|NOVEMBRE|DICEMBRE)\b\s*(?:DI\s*)?(201[0-9]|202[0-9])/;
    const match = t.match(monthYearRegex);
    if (match) return `${match[1]} ${match[2]}`; // Perfetto: "DICEMBRE 2020"

    // 3. Fallback: cerca l'anno isolato
    let foundYear = '';
    const yearMatch = text.match(/\b(201[0-9]|202[0-9])\b/);
    if (yearMatch) foundYear = yearMatch[1];

    // 4. Fallback: cerca la parola ESATTA del mese (ignora "GIU" se è dentro "GIULIA")
    let foundMonth = '';
    for (let m of MONTHS) {
        const regex = new RegExp(`\\b${m.toUpperCase()}\\b`);
        if (regex.test(t)) {
            foundMonth = m;
            break;
        }
    }

    // 5. Fallback numerico (es. 12/2020)
    if (!foundMonth && foundYear) {
        const numMatch = text.match(/\b(0?[1-9]|1[0-2])[\/\-\.](201[0-9]|202[0-9])\b/);
        if (numMatch) foundMonth = MONTHS[parseInt(numMatch[1], 10) - 1];
    }

    if (foundMonth && foundYear) return `${foundMonth} ${foundYear}`;
    if (foundMonth) return `${foundMonth}`;
    if (foundYear) return `Anno ${foundYear}`;
    return null;
};

const MobileUploadPage = ({ sessionId }: { sessionId: string }) => {
    const { showNotification } = useIsland();
    const searchParams = new URLSearchParams(window.location.search);
    const company = searchParams.get('company') || 'Azienda';
    const workerName = searchParams.get('name') || 'Lavoratore';

    const sessionType = searchParams.get('type') || 'payslip';
    const isOnboarding = sessionType === 'onboarding';

    const customColsString = searchParams.get('cols');
    let customColumns = null;
    if (customColsString) {
        try { customColumns = JSON.parse(decodeURIComponent(customColsString)); }
        catch (e) { console.error("Errore lettura codici QR"); }
    }

    const [documents, setDocuments] = useState<DocumentFolder[]>([]);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    const triggerHaptic = (type: 'light' | 'success' | 'error' = 'light') => {
        if (!navigator.vibrate) return;
        if (type === 'light') navigator.vibrate(50);
        if (type === 'success') navigator.vibrate([50, 100, 50]);
        if (type === 'error') navigator.vibrate([100, 50, 100, 50, 100]);
    };

    // ✨ MICRO-SCANNER OCR (Lavora in background senza bloccare il telefono)
    const runAutoDetect = async (file: File, folderId: string) => {
        // 1. Prova prima dal nome del file (Veloce per la Galleria)
        let title = guessTitleFromText(file.name);
        if (title) {
            setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title, isDetecting: false } : d));
            return;
        }

        // 2. Se è una foto (Fotocamera), scansiona solo il 35% in alto per leggere l'intestazione
        if (file.type.startsWith('image/')) {
            try {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise(res => img.onload = res);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scanHeight = img.height * 0.35;
                canvas.width = img.width;
                canvas.height = scanHeight;
                ctx?.drawImage(img, 0, 0, img.width, scanHeight, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                URL.revokeObjectURL(img.src);

                const { data: { text } } = await Tesseract.recognize(base64, 'eng');
                title = guessTitleFromText(text);

                setDocuments(prev => prev.map(d => d.id === folderId ? {
                    ...d,
                    title: title || 'Mese non rilevato',
                    isDetecting: false
                } : d));
            } catch (e) {
                setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title: 'Busta Paga', isDetecting: false } : d));
            }
        } else {
            setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title: 'Documento PDF', isDetecting: false } : d));
        }
    };

    const processFileBase64 = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const base64String = event.target?.result as string;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    resolve(base64String.split(',')[1] || base64String);
                    return;
                }
                const img = new Image();
                img.src = base64String;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200; const MAX_HEIGHT = 1600;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(compressed.split(',')[1] || compressed);
                };
                img.onerror = () => resolve(base64String.split(',')[1] || base64String);
            };
            reader.onerror = error => reject(error);
        });
    };

    const stitchImagesVertically = async (files: File[]): Promise<string> => {
        const images = await Promise.all(files.map(f => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(f);
            });
        }));

        const maxWidth = Math.max(...images.map(img => img.width));
        const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas non supportato");

        let currentY = 0;
        images.forEach(img => {
            const xOffset = (maxWidth - img.width) / 2;
            ctx.drawImage(img, xOffset, currentY);
            currentY += img.height;
            URL.revokeObjectURL(img.src);
        });

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        return base64.split(',')[1] || base64;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            triggerHaptic('light');
            let newFiles = Array.from(e.target.files) as File[];

            if (isOnboarding && newFiles.length > 1) {
                newFiles = [newFiles[0]];
                showNotification("Solo una pagina", "Per l'autocompilazione basta inquadrare la prima pagina del documento.", "warning");
            }

            setDocuments(prev => {
                if (targetFolderId) {
                    return prev.map(doc =>
                        doc.id === targetFolderId ? { ...doc, pages: [...doc.pages, ...newFiles] } : doc
                    );
                }
                else {
                    const newFolders = newFiles.map((file: File) => {
                        const folderId = Date.now() + Math.random().toString();

                        // ✨ Attiva lo scanner OCR invisibile in background
                        runAutoDetect(file, folderId);

                        return {
                            id: folderId,
                            pages: [file],
                            title: 'Lettura Intestazione...',
                            isDetecting: true
                        };
                    });
                    return isOnboarding ? newFolders : [...prev, ...newFolders];
                }
            });
        }
        if (e.target) e.target.value = '';
        setTargetFolderId(null);
    };

    const removeDocument = (id: string) => {
        triggerHaptic('light');
        setDocuments(prev => prev.filter(doc => doc.id !== id));
    };

    const handleUploadAll = async () => {
        if (documents.length === 0 || !sessionId) return;

        triggerHaptic('light');
        setUploadStatus('uploading');
        setProgress({ current: 0, total: documents.length });

        try {
            let cumulativeResults: any[] = [];

            for (let i = 0; i < documents.length; i++) {
                setProgress({ current: i + 1, total: documents.length });
                await supabase.from('scan_sessions').update({ status: 'processing', data: JSON.stringify({ current: i + 1, total: documents.length }) }).eq('id', sessionId);

                try {
                    const doc = documents[i];
                    let base64ToUpload = "";
                    let mimeTypeToUpload = "image/jpeg";

                    // PREPARAZIONE FILE (Fonde se multipli, comprime se singoli)
                    if (doc.pages.length > 1) {
                        base64ToUpload = await stitchImagesVertically(doc.pages);
                    } else {
                        const file = doc.pages[0];
                        base64ToUpload = await processFileBase64(file);
                        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                            mimeTypeToUpload = 'application/pdf';
                        }
                    }

                    // ✨ IL BIVIO CHIRURGICO: ARCHIVIO O AI?
                    if (sessionType === 'archive') {
                        // === MODALITA' ARCHIVIO PC ===
                        // Bypassiamo Netlify e l'AI. Creiamo un "finto" risultato AI che contiene solo l'immagine nuda e cruda!
                        // Se il titolo è vuoto o è rimasto il segnaposto, usa un nome numerato
                        const finalTitle = (!doc.title || doc.title === 'Lettura Intestazione...') ? `Documento_${i + 1}` : doc.title;

                        const archiveData = {
                            _batchId: Date.now() + i,
                            fileData: base64ToUpload,
                            mimeType: mimeTypeToUpload,
                            title: finalTitle,
                            isArchive: true
                        };

                        cumulativeResults.push(archiveData);
                        await supabase.from('scan_sessions').update({ status: 'completed', data: JSON.stringify(cumulativeResults) }).eq('id', sessionId);

                    } else if (isOnboarding) {
                        // === MODALITA' ONBOARDING ANAGRAFICA ===
                        const response = await fetch('/.netlify/functions/scan-worker', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileData: base64ToUpload, mimeType: mimeTypeToUpload })
                        });
                        if (!response.ok) throw new Error(await response.text() || `Status ${response.status}`);

                        const aiData = await response.json();
                        aiData._batchId = Date.now();
                        cumulativeResults.push(aiData);
                        await supabase.from('scan_sessions').update({ status: 'completed', data: JSON.stringify(cumulativeResults) }).eq('id', sessionId);

                    } else {
                        // === MODALITA' STANDARD AI (BUSTE PAGA) ===
                        const response = await fetch('/.netlify/functions/scan-payslip', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileData: base64ToUpload,
                                mimeType: mimeTypeToUpload,
                                company: company,
                                customColumns: customColumns
                            })
                        });
                        if (!response.ok) throw new Error(await response.text() || `Status ${response.status}`);

                        const aiData = await response.json();
                        aiData._batchId = Date.now() + i;
                        cumulativeResults.push(aiData);
                        await supabase.from('scan_sessions').update({ status: 'completed', data: JSON.stringify(cumulativeResults) }).eq('id', sessionId);
                    }

                } catch (err: any) {
                    console.error(`Errore sul fascicolo ${i + 1}:`, err);
                    triggerHaptic('error');
                    let msg = err.message;
                    if (msg.includes('502') || msg.includes('504')) msg = "Timeout Netlify (>10 sec). Riduci la risoluzione.";
                    if (msg.includes('413')) msg = "Il fascicolo è troppo pesante.";
                    showNotification(`Errore fascicolo ${i + 1}`, msg, "error", 6000);
                }
                await new Promise(r => setTimeout(r, 1200));
            }

            await supabase.from('scan_sessions').update({ status: 'all_done', data: JSON.stringify(cumulativeResults) }).eq('id', sessionId);

            triggerHaptic('success');
            setUploadStatus('success');
            setTimeout(() => { setDocuments([]); setUploadStatus('idle'); }, 1500);

        } catch (error: any) {
            triggerHaptic('error');
            const msg = error.message || "Errore di connessione o file troppo pesante";
            await supabase.from('scan_sessions').update({ status: 'error', data: msg }).eq('id', sessionId);
            setDocuments([]); setUploadStatus('idle');
            showNotification("Errore di Sistema", msg, "error", 6000);
        }
    };

    if (uploadStatus === 'success') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-9999 bg-emerald-950/95 backdrop-blur-2xl flex items-center justify-center flex-col text-white p-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: "spring", damping: 15 }} className="mb-6 relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-40 rounded-full"></div>
                    <CheckCircle2 className="w-24 h-24 text-emerald-400 relative z-10 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" strokeWidth={2} />
                </motion.div>
                <h1 className="text-2xl font-black tracking-widest uppercase text-emerald-400 drop-shadow-md mb-2">Trasferimento<br />Completato</h1>
                <p className="text-emerald-500/80 font-mono text-xs uppercase tracking-widest mt-2">Terminale pronto per nuovo uplink</p>
            </motion.div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B1120] text-white flex flex-col font-sans relative pb-40">
            <div className={`fixed top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[120px] pointer-events-none ${isOnboarding ? 'bg-teal-600/20' : 'bg-indigo-600/20'}`}></div>
            <div className={`fixed bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[120px] pointer-events-none ${isOnboarding ? 'bg-emerald-600/10' : 'bg-indigo-600/10'}`}></div>

            <div className="p-5 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-[#0a1220] border shadow-lg ${isOnboarding ? 'border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.3)]' : 'border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.3)]'}`}>
                            {isOnboarding ? <UserPlus className="w-5 h-5 text-teal-400" /> : <Smartphone className="w-5 h-5 text-indigo-400" />}
                        </div>
                        <div>
                            {isOnboarding ? (
                                <>
                                    <p className="text-[9px] text-teal-400 font-black uppercase tracking-widest leading-none mb-1">Onboarding AI</p>
                                    <h1 className="text-lg font-black leading-none truncate max-w-[200px]">Nuova Pratica</h1>
                                </>
                            ) : (
                                <>
                                    <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest leading-none mb-1">Connesso a: {company}</p>
                                    <h1 className="text-lg font-black leading-none truncate max-w-[200px]">{workerName}</h1>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-5 relative z-10">
                <AnimatePresence mode="wait">
                    {documents.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="h-[60vh] flex flex-col items-center justify-center">
                            <div className="w-48 h-48 relative flex items-center justify-center mb-8">
                                <div className={`absolute inset-0 border border-dashed rounded-full animate-[spin_15s_linear_infinite] opacity-50 ${isOnboarding ? 'border-teal-500' : 'border-indigo-500'}`}></div>
                                <div className={`absolute inset-4 border border-solid rounded-full animate-[spin_10s_linear_infinite_reverse] opacity-20 ${isOnboarding ? 'border-teal-500' : 'border-indigo-500'}`}></div>
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-md border shadow-2xl relative z-10 ${isOnboarding ? 'bg-teal-950/80 border-teal-500/50 shadow-[0_0_40px_rgba(20,184,166,0.3)]' : 'bg-indigo-950/80 border-indigo-500/50 shadow-[0_0_40px_rgba(79,70,229,0.3)]'}`}>
                                    {isOnboarding ? <Fingerprint className="w-8 h-8 text-teal-400 animate-pulse" strokeWidth={1.5} /> : <Layers className="w-8 h-8 text-indigo-400 animate-pulse" strokeWidth={1.5} />}
                                </div>
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-white mb-2">{isOnboarding ? 'Scansione Anagrafica' : 'Nessun Fascicolo'}</h2>
                            <p className="text-slate-500 text-center font-mono text-[11px] max-w-[280px] leading-relaxed uppercase tracking-wider">
                                {isOnboarding ? "Inquadra la prima pagina del documento per l'estrazione dati." : "Usa la fotocamera per creare un fascicolo o seleziona foto multiple dalla galleria."}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                            <AnimatePresence>
                                {documents.map((doc, idx) => (
                                    <motion.div key={doc.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                                        className={`relative p-4 rounded-2xl bg-[#0a1220] border shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-center justify-between group ${isOnboarding ? 'border-teal-900/50' : 'border-indigo-900/50'}`}
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            {/* Stack Thumbnails */}
                                            <div className="relative w-14 h-16 shrink-0">
                                                {doc.pages.slice(0, 3).map((page, pIdx) => {
                                                    const isImg = page.type.startsWith('image/');
                                                    const preview = isImg ? URL.createObjectURL(page) : null;
                                                    return (
                                                        <div key={pIdx} className="absolute top-0 left-0 w-full h-full rounded-md border border-slate-600 bg-slate-800 shadow-md overflow-hidden" style={{ transform: `rotate(${pIdx * 4}deg) translate(${pIdx * 2}px, ${pIdx * 2}px)`, zIndex: 10 - pIdx }}>
                                                            {isImg ? <img src={preview!} className="w-full h-full object-cover opacity-80" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800"><FileText size={16} className="text-indigo-400" /></div>}
                                                        </div>
                                                    );
                                                })}
                                                {doc.pages.length > 3 && (
                                                    <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center z-20 shadow-lg border border-indigo-400">
                                                        +{doc.pages.length - 3}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                {/* ✨ TITOLO INTELLIGENTE ED EDITABILE */}
                                                <div className="flex items-center gap-2 mb-1 group/title">
                                                    {doc.isDetecting ? (
                                                        <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${isOnboarding ? 'text-teal-400' : 'text-indigo-400'}`} />
                                                    ) : (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={doc.title === 'Lettura Intestazione...' ? '' : doc.title}
                                                        placeholder={doc.isDetecting ? "Lettura in corso..." : "Inserisci Nome"}
                                                        onChange={(e) => {
                                                            const newTitle = e.target.value;
                                                            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, title: newTitle } : d));
                                                        }}
                                                        className={`bg-transparent border-b border-transparent focus:border-indigo-500/50 outline-none text-[12px] font-black uppercase tracking-widest truncate w-[130px] transition-colors pb-0.5 ${doc.isDetecting ? 'text-slate-400' : (isOnboarding ? 'text-teal-400' : 'text-indigo-400')}`}
                                                    />
                                                </div>

                                                <span className="text-white font-bold text-sm tracking-wide">{doc.pages.length} Pagin{doc.pages.length > 1 ? 'e' : 'a'} collegate</span>

                                                {/* Tasto Aggiungi Pagina al Fascicolo */}
                                                {!isOnboarding && (
                                                    <button onClick={() => { setTargetFolderId(doc.id); cameraRef.current?.click(); }} className="mt-2 text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md border border-indigo-500/30 transition-colors w-fit">
                                                        <Plus size={12} /> Aggiungi Pagina
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <button onClick={() => removeDocument(doc.id)} className="w-10 h-10 bg-red-950/50 hover:bg-red-500 rounded-xl flex items-center justify-center text-red-400 hover:text-white border border-red-500/30 transition-colors shrink-0">
                                            <Trash2 size={18} strokeWidth={2} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* BOTTOM ACTION BAR */}
            <div className={`fixed bottom-0 left-0 w-full p-5 pb-8 bg-[#050b14]/95 backdrop-blur-xl border-t z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${isOnboarding ? 'border-teal-500/20' : 'border-indigo-500/20'}`}>

                <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleFileSelect} />
                <input type="file" accept="image/*,application/pdf" ref={galleryRef} className="hidden" onChange={handleFileSelect} multiple={!isOnboarding} />

                {uploadStatus === 'uploading' ? (
                    <div className={`w-full bg-[#0a1220] rounded-xl p-5 border relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] ${isOnboarding ? 'border-teal-500/30' : 'border-indigo-500/30'}`}>
                        <div className="relative z-10 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 bg-[#050b14] ${isOnboarding ? 'border-teal-500/50' : 'border-indigo-500/50'}`}>
                                <Cpu className={`w-5 h-5 animate-pulse ${isOnboarding ? 'text-teal-400' : 'text-indigo-400'}`} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <div className={`flex justify-between text-[10px] font-mono uppercase tracking-widest mb-2 ${isOnboarding ? 'text-teal-400' : 'text-indigo-400'}`}>
                                    <span>{isOnboarding ? 'Estrazione AI' : 'Uplink Protocol'}</span>
                                    {!isOnboarding && <span>{progress.current} / {progress.total}</span>}
                                </div>
                                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                    <motion.div className={`h-full relative ${isOnboarding ? 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)] w-full animate-pulse' : 'bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]'}`}
                                        initial={{ width: '0%' }} animate={{ width: isOnboarding ? '100%' : `${(progress.current / progress.total) * 100}%` }} transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {documents.length > 0 && (
                            <button onClick={handleUploadAll} className={`w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-3 transition-all active:scale-95 border text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(79,70,229,0.3)]
                                ${isOnboarding ? 'bg-linear-to-r from-teal-600 to-emerald-600 border-teal-500 text-white' : 'bg-linear-to-r from-indigo-600 to-blue-600 border-indigo-500 text-white'}`}>
                                <Zap className="w-5 h-5" fill="currentColor" />
                                {isOnboarding ? 'Estrai Dati AI' : `Invia ${documents.length} Fascicoli al Server`}
                            </button>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => { triggerHaptic('light'); setTargetFolderId(null); cameraRef.current?.click(); }}
                                className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 border text-[11px] uppercase tracking-wider
                                    ${documents.length === 0
                                        ? (isOnboarding ? 'bg-teal-600/20 border-teal-500 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.2)]')
                                        : `bg-[#0a1220] text-slate-400 border-slate-700 hover:text-white ${isOnboarding ? 'hover:border-teal-500' : 'hover:border-indigo-500'}`}`}>
                                <Camera className="w-5 h-5" />
                                {documents.length === 0 ? 'Nuova Busta (Foto)' : 'Nuova Busta'}
                            </button>

                            <button onClick={() => { triggerHaptic('light'); setTargetFolderId(null); galleryRef.current?.click(); }}
                                className={`flex-1 py-4 bg-[#0a1220] rounded-xl text-slate-400 font-bold flex flex-col items-center justify-center gap-1 border border-slate-700 transition-all active:scale-95 hover:text-white ${isOnboarding ? 'hover:border-teal-500' : 'hover:border-indigo-500'}`}>
                                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
                                    <ImageIcon className="w-4 h-4" /> Galleria
                                </div>
                                {/* Il Pro Tip */}
                                {!isOnboarding && <span className="text-[8px] text-indigo-500/80 font-mono tracking-widest">PRO: Seleziona Multiple</span>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileUploadPage;