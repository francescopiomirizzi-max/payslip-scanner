import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Loader2, CheckCircle2, FileText, Image as ImageIcon, Zap, UserPlus, Fingerprint, Cpu, Plus, Trash2, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsland } from '../IslandContext';
import { useIsReadOnly } from '../lib/readonly';
import { useWakeLock } from '../hooks/useWakeLock';
// Tesseract è stato rimosso dal carico iniziale: ~30MB di WASM/dati lingua scaricati
// sul telefono solo per indovinare il titolo. Ora la guess passa per la function
// /guess-title (Gemini Flash) — più precisa e leggera sulla rete mobile.

// Struttura dati per la Fascicolazione Intelligente
type DocumentFolder = {
    id: string;
    pages: File[];
    title: string;          // ✨ NUOVO: Il titolo intelligente del mese
    isDetecting: boolean;   // ✨ NUOVO: Stato di caricamento OCR
};

// Thumbnail con cleanup automatico degli object URL: prima venivano creati ad ogni
// render senza revoke, accumulando blob refs in memoria su sessioni lunghe.
const DocumentThumbnails: React.FC<{ pages: File[] }> = ({ pages }) => {
    const previews = useMemo(
        () => pages.slice(0, 3).map(p => ({ isImg: p.type.startsWith('image/'), url: p.type.startsWith('image/') ? URL.createObjectURL(p) : null })),
        [pages]
    );
    useEffect(() => () => { previews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); }); }, [previews]);
    return (
        <>
            {previews.map((p, pIdx) => (
                <div key={pIdx} className="absolute top-0 left-0 w-full h-full rounded-md border border-slate-600 bg-slate-800 shadow-md overflow-hidden" style={{ transform: `rotate(${pIdx * 4}deg) translate(${pIdx * 2}px, ${pIdx * 2}px)`, zIndex: 10 - pIdx }}>
                    {p.isImg ? <img src={p.url!} className="w-full h-full object-cover opacity-80" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800"><FileText size={16} className="text-indigo-400" /></div>}
                </div>
            ))}
        </>
    );
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
    const isReadOnly = useIsReadOnly();
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

    // Tieni lo schermo attivo finché c'è lavoro pending o un upload in corso.
    // Senza, se il telefono va in standby il browser pausa il JS, le fetch in
    // flight vengono abortite e il PC vede silenzio → watchdog → sessione persa.
    const keepAwake = uploadStatus === 'uploading' || (documents.length > 0 && uploadStatus !== 'success');
    const wakeLock = useWakeLock(keepAwake);

    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    const triggerHaptic = (type: 'light' | 'success' | 'error' = 'light') => {
        if (!navigator.vibrate) return;
        if (type === 'light') navigator.vibrate(50);
        if (type === 'success') navigator.vibrate([50, 100, 50]);
        if (type === 'error') navigator.vibrate([100, 50, 100, 50, 100]);
    };

    // Indovina il titolo "Mese Anno" dall'intestazione. Ordine:
    //  1) match dal nome file (gratis, istantaneo — copre l'80% dei casi di galleria);
    //  2) se foto, ritaglia il 35% in alto e chiede a Gemini Flash via /guess-title.
    // Se entrambi falliscono, il campo resta editabile (no guess errato).
    const runAutoDetect = async (file: File, folderId: string) => {
        const titleFromName = guessTitleFromText(file.name);
        if (titleFromName) {
            setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title: titleFromName, isDetecting: false } : d));
            return;
        }

        if (!file.type.startsWith('image/')) {
            setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title: 'Documento PDF', isDetecting: false } : d));
            return;
        }

        let objectUrl: string | null = null;
        try {
            const img = new Image();
            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            await new Promise<void>((res, rej) => {
                img.onload = () => res();
                img.onerror = () => rej(new Error('Immagine non caricabile'));
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scanHeight = Math.round(img.height * 0.35);
            canvas.width = img.width;
            canvas.height = scanHeight;
            ctx?.drawImage(img, 0, 0, img.width, scanHeight, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            // Timeout corto: se la rete è lenta, il client mostra "Mese non rilevato"
            // editabile invece di girare in tondo.
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 10000);
            let title: string | null = null;
            try {
                const res = await fetch('/.netlify/functions/guess-title', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileData: base64, mimeType: 'image/jpeg', sessionId }),
                    signal: ctrl.signal,
                });
                if (res.ok) {
                    const j = await res.json();
                    title = j?.title ?? null;
                }
            } finally {
                clearTimeout(timer);
            }

            setDocuments(prev => prev.map(d => d.id === folderId ? {
                ...d,
                title: title || 'Mese non rilevato',
                isDetecting: false,
            } : d));
        } catch (e) {
            setDocuments(prev => prev.map(d => d.id === folderId ? { ...d, title: 'Busta Paga', isDetecting: false } : d));
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
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
                    // 1100×1500 @ q=0.55 sta tipicamente sotto i 200KB base64. Margine
                    // contro il body limit del Netlify CLI (osservato crash "Stream body
                    // too big" su batch di foto a piena risoluzione) e bandwidth WiFi.
                    const MAX_WIDTH = 1100; const MAX_HEIGHT = 1500;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.55);
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

        let maxWidth = Math.max(...images.map(img => img.width));
        let totalHeight = images.reduce((sum, img) => sum + img.height, 0);

        // Hard cap sul canvas stitched: senza, un fascicolo da 5+ pagine HD finiva
        // 1200×8000+ → base64 multi-MB → crash CLI "Stream body too big" e timeout
        // Gemini. Scaliamo tutto proporzionalmente per restare gestibili.
        const MAX_STITCH_W = 1100;
        const MAX_STITCH_H = 4200; // ~3 pagine A4 a 1100w mantengono leggibilità
        const scale = Math.min(MAX_STITCH_W / maxWidth, MAX_STITCH_H / totalHeight, 1);
        if (scale < 1) {
            maxWidth = Math.floor(maxWidth * scale);
            totalHeight = Math.floor(totalHeight * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas non supportato");

        let currentY = 0;
        images.forEach(img => {
            const targetW = Math.floor(img.width * scale);
            const targetH = Math.floor(img.height * scale);
            const xOffset = Math.floor((maxWidth - targetW) / 2);
            ctx.drawImage(img, xOffset, currentY, targetW, targetH);
            currentY += targetH;
            URL.revokeObjectURL(img.src);
        });

        const base64 = canvas.toDataURL('image/jpeg', 0.6);
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

    // Timeout client sulle netlify functions. Il backend ha budget ~50s in prod (vedi
    // scan-payslip.ts), qui mettiamo un margine + qualche secondo per la rete: se il
    // serverless va in coma, l'utente vede un errore invece di restare bloccato per sempre.
    const FETCH_TIMEOUT_MS = 55000;

    const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    // Wrapper: 1 retry su errori di rete/abort (non sul timeout proprio nostro). Coperture:
    //  - bug netlify-cli@26 che chiude la connessione mid-response → "Failed to fetch"
    //  - glitch transienti del provider che resettano la TCP
    // Non ritenta su HTTP 5xx (li lascia salire come errore Gemini).
    const fetchWithRetry = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
        try {
            return await fetchWithTimeout(url, init, timeoutMs);
        } catch (err: any) {
            const msg = err?.message || String(err);
            const isOurAbort = err?.name === 'AbortError'; // nostro timeout: NON ritentare
            const isNetwork = !isOurAbort && (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network') || msg.includes('aborted'));
            if (!isNetwork) throw err;
            await new Promise(r => setTimeout(r, 600));
            return await fetchWithTimeout(url, init, timeoutMs);
        }
    };

    const handleUploadAll = async () => {
        if (documents.length === 0 || !sessionId) return;

        triggerHaptic('light');
        // Avviso onesto se il browser non supporta Wake Lock (iOS < 16.4): l'utente
        // deve tenere lo schermo aperto manualmente, sennò il browser pausa JS e
        // l'upload si interrompe.
        if (!wakeLock.supported) {
            showNotification(
                "Tieni lo schermo attivo",
                "Il tuo browser non blocca lo standby. Non lasciare il telefono finché l'invio non è completato.",
                "warning", 5000
            );
        }
        setUploadStatus('uploading');
        setProgress({ current: 0, total: documents.length });

        // Mode lo decide il telefono e lo scrive su scan_sessions: il PC lo legge da lì
        // (vedi Step 4) — niente più disallineamento se l'utente cambia lo switch sul PC
        // dopo che il telefono ha già scansionato il QR.
        const sessionMode = sessionType === 'archive' ? 'archive' : (isOnboarding ? 'onboarding' : 'ai');

        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < documents.length; i++) {
                setProgress({ current: i + 1, total: documents.length });
                // Status/progress vivono ancora su scan_sessions: il payload è piccolissimo.
                await supabase.from('scan_sessions').update({
                    status: 'processing',
                    mode: sessionMode,
                    data: { current: i + 1, total: documents.length },
                }).eq('id', sessionId);

                try {
                    const doc = documents[i];
                    let base64ToUpload = "";
                    let mimeTypeToUpload = "image/jpeg";

                    if (doc.pages.length > 1) {
                        base64ToUpload = await stitchImagesVertically(doc.pages);
                    } else {
                        const file = doc.pages[0];
                        base64ToUpload = await processFileBase64(file);
                        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                            mimeTypeToUpload = 'application/pdf';
                        }
                    }

                    // Batch id collision-safe: timestamp + indice + casuale.
                    const batchId = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
                    let payload: any;

                    if (sessionType === 'archive') {
                        const finalTitle = (!doc.title || doc.title === 'Lettura Intestazione...') ? `Documento_${i + 1}` : doc.title;
                        payload = {
                            _batchId: batchId,
                            fileData: base64ToUpload,
                            mimeType: mimeTypeToUpload,
                            title: finalTitle,
                            isArchive: true,
                        };
                    } else if (isOnboarding) {
                        const response = await fetchWithRetry('/.netlify/functions/scan-worker', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileData: base64ToUpload, mimeType: mimeTypeToUpload, sessionId })
                        }, FETCH_TIMEOUT_MS);
                        if (!response.ok) throw new Error(await response.text() || `Status ${response.status}`);
                        const aiData = await response.json();
                        aiData._batchId = batchId;
                        payload = aiData;
                    } else {
                        const response = await fetchWithRetry('/.netlify/functions/scan-payslip', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileData: base64ToUpload,
                                mimeType: mimeTypeToUpload,
                                company: company,
                                customColumns: customColumns,
                                sessionId,
                            })
                        }, FETCH_TIMEOUT_MS);
                        if (!response.ok) throw new Error(await response.text() || `Status ${response.status}`);
                        const aiData = await response.json();
                        aiData._batchId = batchId;
                        aiData.fileData = base64ToUpload;
                        aiData.mimeType = mimeTypeToUpload;
                        payload = aiData;
                    }

                    // Outbox: una INSERT per file. Il PC è sottoscritto a scan_results via
                    // Realtime e riceve il push immediato — niente più array cumulativo.
                    const { error: insertErr } = await supabase
                        .from('scan_results')
                        .insert({ session_id: sessionId, batch_id: batchId, payload });
                    if (insertErr) throw new Error(`DB insert fallita: ${insertErr.message}`);

                    successCount++;
                } catch (err: any) {
                    failCount++;
                    console.error(`Errore sul fascicolo ${i + 1}:`, err);
                    triggerHaptic('error');
                    let msg = err?.message || String(err);
                    if (err?.name === 'AbortError') msg = `Timeout (>${Math.round(FETCH_TIMEOUT_MS/1000)}s): il server AI non ha risposto. Riprova o riduci la risoluzione.`;
                    else if (msg.includes('502') || msg.includes('504')) msg = "Timeout backend. Riprova o riduci la risoluzione.";
                    else if (msg.includes('413')) msg = "Il fascicolo è troppo pesante.";
                    else if (msg === 'Failed to fetch' || msg.includes('NetworkError')) msg = "Connessione persa. Riprova quando torni online.";
                    showNotification(`Errore fascicolo ${i + 1}`, msg, "error", 6000);
                }
            }

            // Verità onesta a fine batch: se zero successi, NON dire "completato".
            if (successCount === 0) {
                const errMsg = `Tutti i ${failCount} fascicoli sono falliti.`;
                try { await supabase.from('scan_sessions').update({ status: 'error', data: { error: errMsg } }).eq('id', sessionId); } catch { /* offline */ }
                triggerHaptic('error');
                setUploadStatus('idle');
                setDocuments([]);
                showNotification("Trasferimento Fallito", errMsg + " Controlla la connessione o riprova.", "error", 8000);
                return;
            }

            await supabase.from('scan_sessions').update({ status: 'all_done' }).eq('id', sessionId);

            triggerHaptic('success');
            setUploadStatus('success');
            if (failCount > 0) {
                showNotification("Trasferimento Parziale", `${successCount} ok, ${failCount} falliti.`, "warning", 6000);
            }
            setTimeout(() => { setDocuments([]); setUploadStatus('idle'); }, 1500);

        } catch (error: any) {
            triggerHaptic('error');
            const msg = error?.message || "Errore di connessione o file troppo pesante";
            try { await supabase.from('scan_sessions').update({ status: 'error', data: { error: msg } }).eq('id', sessionId); } catch { /* offline: il PC vedrà il watchdog */ }
            setDocuments([]); setUploadStatus('idle');
            showNotification("Errore di Sistema", msg, "error", 6000);
        }
    };

    if (isReadOnly) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-center">
                <div className="max-w-xs">
                    <h1 className="text-lg font-semibold text-slate-200 mb-2">Modalità sola lettura</h1>
                    <p className="text-sm text-slate-400">Il tuo account può consultare i dati ma non è autorizzato a caricare buste paga.</p>
                </div>
            </div>
        );
    }

    // Palette per modalità: indigo per scan/archive, teal per onboarding.
    const accentText = isOnboarding ? 'text-teal-400' : 'text-indigo-400';
    const accentBg = isOnboarding ? 'bg-teal-600 active:bg-teal-700' : 'bg-indigo-600 active:bg-indigo-700';
    const accentBorder = isOnboarding ? 'border-teal-500/40' : 'border-indigo-500/40';
    const accentBadgeBg = isOnboarding ? 'bg-teal-600' : 'bg-indigo-600';
    const accentBgSubtle = isOnboarding ? 'bg-teal-500/10' : 'bg-indigo-500/10';

    const isUploading = uploadStatus === 'uploading';
    const isSuccess = uploadStatus === 'success';
    const hasDocs = documents.length > 0;
    const anyDetecting = documents.some(d => d.isDetecting);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-32">
            {/* Header compatto, sticky */}
            <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-slate-900 border ${accentBorder}`}>
                        {isOnboarding
                            ? <UserPlus className={`w-4 h-4 ${accentText}`} />
                            : <Camera className={`w-4 h-4 ${accentText}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold uppercase tracking-wider truncate ${accentText}`}>
                            {isOnboarding ? 'Onboarding' : company}
                        </p>
                        <h1 className="text-sm font-semibold truncate text-white">
                            {isOnboarding ? 'Nuova pratica' : workerName}
                        </h1>
                    </div>
                    {wakeLock.held && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5"
                             title="Schermo bloccato attivo durante l'upload">
                            <Lock size={10} />
                            <span className="font-medium">on</span>
                        </div>
                    )}
                    {hasDocs && !isUploading && !isSuccess && (
                        <span className="text-xs text-slate-400 font-mono tabular-nums">{documents.length}</span>
                    )}
                </div>
            </div>

            {/* Contenuto */}
            <div className="flex-1 px-4 py-3">
                <AnimatePresence mode="wait">
                    {isSuccess ? (
                        <motion.div key="success"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="h-[55vh] flex flex-col items-center justify-center text-center px-6">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" strokeWidth={2.5} />
                            </div>
                            <h2 className="text-base font-semibold text-emerald-300 mb-1">Buste paga inviate</h2>
                            <p className="text-sm text-slate-400 max-w-[260px]">Aggiungi altre foto per un nuovo batch — la sessione resta aperta finché non chiudi sul PC.</p>
                        </motion.div>
                    ) : !hasDocs ? (
                        <motion.div key="empty"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="h-[55vh] flex flex-col items-center justify-center text-center px-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-900 border ${accentBorder} mb-3`}>
                                {isOnboarding
                                    ? <Fingerprint className={`w-6 h-6 ${accentText}`} strokeWidth={1.8} />
                                    : <Camera className={`w-6 h-6 ${accentText}`} strokeWidth={1.8} />}
                            </div>
                            <h2 className="text-base font-semibold mb-1">
                                {isOnboarding ? 'Scansiona il documento' : 'Aggiungi i primi fascicoli'}
                            </h2>
                            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
                                {isOnboarding
                                    ? "Inquadra la prima pagina del documento per estrarre i dati."
                                    : "Foto singole o multiple. Puoi inviare più batch dallo stesso QR senza riscansionarlo."}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
                            <AnimatePresence>
                                {documents.map((doc) => (
                                    <motion.div key={doc.id}
                                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                                        {/* Thumbnail */}
                                        <div className="relative w-12 h-14 shrink-0">
                                            <DocumentThumbnails pages={doc.pages} />
                                            {doc.pages.length > 1 && (
                                                <div className={`absolute -bottom-1 -right-1 ${accentBadgeBg} text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow`}>
                                                    {doc.pages.length}
                                                </div>
                                            )}
                                        </div>
                                        {/* Titolo + meta */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {doc.isDetecting
                                                    ? <Loader2 className={`w-3 h-3 animate-spin ${accentText} shrink-0`} />
                                                    : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                <input
                                                    type="text"
                                                    value={doc.title === 'Lettura Intestazione...' ? '' : doc.title}
                                                    placeholder={doc.isDetecting ? "Lettura..." : "Nome busta paga"}
                                                    onChange={(e) => {
                                                        const newTitle = e.target.value;
                                                        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, title: newTitle } : d));
                                                    }}
                                                    className="bg-transparent border-none outline-none text-sm font-medium text-white placeholder-slate-500 truncate w-full min-w-0"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{doc.pages.length} pagin{doc.pages.length > 1 ? 'e' : 'a'}</span>
                                                {!isOnboarding && (
                                                    <button
                                                        onClick={() => { setTargetFolderId(doc.id); cameraRef.current?.click(); }}
                                                        className={`flex items-center gap-0.5 ${accentText} active:opacity-70`}>
                                                        <Plus size={11} /> aggiungi pagina
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Delete */}
                                        <button onClick={() => removeDocument(doc.id)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 active:text-red-400 active:bg-red-500/10 shrink-0"
                                            aria-label="Rimuovi">
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom bar fissa */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-white/5 px-4 py-3 pb-6">
                <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleFileSelect} />
                <input type="file" accept="image/*,application/pdf" ref={galleryRef} className="hidden" onChange={handleFileSelect} multiple={!isOnboarding} />

                {isUploading ? (
                    <div className="flex items-center gap-3">
                        <Cpu className={`w-5 h-5 animate-pulse ${accentText} shrink-0`} />
                        <div className="flex-1">
                            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                <span>{isOnboarding ? 'Estrazione AI' : 'Invio in corso'}</span>
                                {!isOnboarding && progress.total > 0 && (
                                    <span className="font-mono tabular-nums">{progress.current}/{progress.total}</span>
                                )}
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div className={`h-full ${accentBg.split(' ')[0]}`}
                                    initial={{ width: '0%' }}
                                    animate={{ width: isOnboarding ? '100%' : `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                    transition={{ duration: 0.3 }} />
                            </div>
                        </div>
                    </div>
                ) : isSuccess ? (
                    <button onClick={() => { triggerHaptic('light'); setTargetFolderId(null); cameraRef.current?.click(); }}
                        className={`w-full py-3.5 rounded-xl ${accentBg} text-white text-sm font-semibold flex items-center justify-center gap-2`}>
                        <Camera size={16} /> Aggiungi altre foto
                    </button>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button onClick={() => { triggerHaptic('light'); setTargetFolderId(null); cameraRef.current?.click(); }}
                                className={`flex-1 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 active:bg-slate-800 ${hasDocs ? 'bg-slate-900 border-slate-800 text-white' : `${accentBgSubtle} ${accentBorder} ${accentText}`}`}>
                                <Camera size={16} />
                                Foto
                            </button>
                            <button onClick={() => { triggerHaptic('light'); setTargetFolderId(null); galleryRef.current?.click(); }}
                                className={`flex-1 py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 active:bg-slate-800 ${hasDocs ? 'bg-slate-900 border-slate-800 text-white' : `${accentBgSubtle} ${accentBorder} ${accentText}`}`}>
                                <ImageIcon size={16} />
                                Galleria
                            </button>
                        </div>

                        {hasDocs && (
                            <button onClick={handleUploadAll}
                                disabled={anyDetecting}
                                className={`w-full py-3.5 rounded-xl ${accentBg} text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}>
                                <Zap size={16} />
                                {isOnboarding
                                    ? 'Estrai dati'
                                    : `Invia ${documents.length} fascicol${documents.length > 1 ? 'i' : 'o'}`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileUploadPage;