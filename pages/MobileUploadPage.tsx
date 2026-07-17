import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Loader2, CheckCircle2, FileText, Image as ImageIcon, Zap, UserPlus, Fingerprint, Cpu, Plus, Trash2, Lock, QrCode, WifiOff, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsland } from '../IslandContext';
import { useIsReadOnly } from '../lib/readonly';
import { useWakeLock } from '../hooks/useWakeLock';
// Tesseract è stato rimosso dal carico iniziale: ~30MB di WASM/dati lingua scaricati
// sul telefono solo per indovinare il titolo. Ora la guess passa per la function
// /guess-title (Gemini Flash) — più precisa e leggera sulla rete mobile.

// Struttura dati per la Fascicolazione Intelligente
// Stato di invio PER fascicolo: i falliti restano in lista con l'errore e si
// ripropongono al prossimo "Invia" — mai cancellare foto che l'utente dovrebbe rifare.
type FolderStatus = 'ready' | 'sending' | 'sent' | 'failed';
type DocumentFolder = {
    id: string;
    pages: File[];
    title: string;          // ✨ NUOVO: Il titolo intelligente del mese
    isDetecting: boolean;   // ✨ NUOVO: Stato di caricamento OCR
    status: FolderStatus;
    errorMsg?: string;
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
    // Valorizzato = payload consegnati ma la conferma all_done al PC non è
    // passata: si ripropone la SOLA conferma, ritrasmettendo ESATTAMENTE i
    // conteggi del giro rimasto in sospeso (non i cumulativi della lista).
    const [handshakePending, setHandshakePending] = useState<{ sent: number; failed: number } | null>(null);

    // Mode lo decide il TELEFONO (fonte di verità, vedi qr-scanner-architecture);
    // qui è noto già dall'URL, il probe sotto lo scrive subito su scan_sessions.
    const sessionMode = sessionType === 'archive' ? 'archive' : (isOnboarding ? 'onboarding' : 'ai');

    // Stato sessione: il telefono è anon e l'RLS non gli consente SELECT su
    // scan_sessions. Il probe usa la RPC is_active_scan_session (migration 010,
    // SECURITY DEFINER, già GRANT ad anon perché la usa la policy INSERT di
    // scan_results): read-only → nessuna scrittura, nessun evento Realtime al PC,
    // nessuna dipendenza dal comportamento di count sotto RLS.
    const [sessionState, setSessionState] = useState<'checking' | 'valid' | 'dead'>(
        sessionId ? 'checking' : 'dead'
    );
    useEffect(() => {
        if (!sessionId) return;
        let cancelled = false;
        (async () => {
            try {
                const { data: active, error } = await supabase
                    .rpc('is_active_scan_session', { p_id: sessionId });
                if (cancelled) return;
                // Solo un false esplicito è un verdetto certo. Un errore di rete
                // NON condanna la sessione: fail-open, ci pensa l'upload.
                setSessionState(!error && active === false ? 'dead' : 'valid');
            } catch {
                if (!cancelled) setSessionState('valid');
            }
        })();
        return () => { cancelled = true; };
    }, [sessionId]);

    // Stato rete: banner + Invia disabilitato quando offline. La selezione resta
    // in memoria: si invia quando torna la linea, senza rifare le foto.
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    const patchFolder = (id: string, patch: Partial<DocumentFolder>) =>
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));

    // Tieni lo schermo attivo finché c'è lavoro DA INVIARE o un upload in corso.
    // Senza, se il telefono va in standby il browser pausa il JS, le fetch in
    // flight vengono abortite e il PC vede silenzio → watchdog → sessione persa.
    // Niente lock su sessione morta o con soli fascicoli già consegnati.
    const keepAwake = sessionState === 'valid' && (
        uploadStatus === 'uploading' ||
        (documents.some(d => d.status !== 'sent') && uploadStatus !== 'success')
    );
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
        // Gli object URL si revocano in finally: se un decode fallisce a metà,
        // quelli già creati non devono restare in memoria.
        const objectUrls: string[] = [];
        try {
            const images = await Promise.all(files.map(f => {
                return new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Pagina non leggibile come immagine'));
                    const url = URL.createObjectURL(f);
                    objectUrls.push(url);
                    img.src = url;
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
            });

            const base64 = canvas.toDataURL('image/jpeg', 0.6);
            return base64.split(',')[1] || base64;
        } finally {
            objectUrls.forEach(u => URL.revokeObjectURL(u));
        }
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
                            isDetecting: true,
                            status: 'ready' as FolderStatus,
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
        // Si (re)inviano solo i fascicoli non ancora consegnati: ready + failed.
        // I sent restano in lista come ricevuta visiva, mai re-inviati.
        const toSend = documents.filter(d => d.status !== 'sent');
        if (!sessionId) return;
        if (!isOnline) {
            showNotification("Sei offline", "I fascicoli restano sul telefono: invia quando torna la rete.", "warning", 5000);
            return;
        }
        if (toSend.length === 0) {
            // Solo conferma mancata da recuperare: niente da reinviare.
            if (!handshakePending) return;
            const { data: ack, error: ackErr } = await supabase.rpc('touch_scan_session', {
                p_id: sessionId, p_status: 'all_done',
                p_data: {
                    sent: handshakePending.sent,
                    ...(handshakePending.failed > 0 ? { failed: handshakePending.failed } : {}),
                },
            });
            if (!ackErr && ack === false) { setSessionState('dead'); return; }
            if (ackErr || ack !== true) {
                showNotification("Ancora nessuna conferma", "Controlla la rete e riprova.", "warning", 5000);
                return;
            }
            setHandshakePending(null);
            triggerHaptic('success');
            setUploadStatus('success');
            setTimeout(() => {
                setDocuments(prev => prev.filter(d => d.status !== 'sent'));
                setUploadStatus('idle');
            }, 1500);
            return;
        }

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
        setProgress({ current: 0, total: toSend.length });

        let successCount = 0;
        let failCount = 0;

        {
            for (let i = 0; i < toSend.length; i++) {
                const doc = toSend[i];
                setProgress({ current: i + 1, total: toSend.length });
                patchFolder(doc.id, { status: 'sending', errorMsg: undefined });
                // Status/progress via RPC whitelistata (migration 028: anon non ha
                // più UPDATE diretto su scan_sessions). Il boolean di ritorno fa
                // anche da sentinella: false = sessione scaduta o chiusa dal PC a
                // metà giro → stop esplicito, fascicoli preservati.
                const { data: alive, error: aliveErr } = await supabase.rpc('touch_scan_session', {
                    p_id: sessionId,
                    p_status: 'processing',
                    p_data: { current: i + 1, total: toSend.length },
                    p_mode: sessionMode,
                });
                if (!aliveErr && alive === false) {
                    patchFolder(doc.id, { status: 'ready' });
                    setUploadStatus('idle');
                    setSessionState('dead');
                    triggerHaptic('error');
                    return;
                }

                try {
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
                    if (insertErr) {
                        // 42501 = la policy WITH CHECK (is_active_scan_session) ha detto no:
                        // la sessione è morta tra la sentinella e l'insert → stop esplicito.
                        if (insertErr.code === '42501') {
                            patchFolder(doc.id, { status: 'ready' });
                            setUploadStatus('idle');
                            setSessionState('dead');
                            triggerHaptic('error');
                            return;
                        }
                        throw new Error(`DB insert fallita: ${insertErr.message}`);
                    }

                    patchFolder(doc.id, { status: 'sent' });
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
                    // Il fascicolo resta in lista con l'errore: si ripropone al prossimo Invia.
                    patchFolder(doc.id, { status: 'failed', errorMsg: msg });
                }
            }

            // Verità onesta a fine batch: se zero successi, NON dire "completato".
            // In OGNI esito con falliti i fascicoli restano in lista (mai setDocuments([])).
            if (successCount === 0) {
                const errMsg = `Tutti i ${failCount} fascicoli sono falliti.`;
                // retryable:true = il telefono tiene i fascicoli e può riprovare:
                // il PC mostra l'errore e torna in attesa SENZA chiudere/cancellare
                // la sessione (vedi branch error di QRScannerModal).
                try {
                    const { data: ack, error: ackErr } = await supabase.rpc('touch_scan_session', { p_id: sessionId, p_status: 'error', p_data: { error: errMsg, retryable: true, failed: failCount } });
                    if (!ackErr && ack === false) {
                        setUploadStatus('idle');
                        setSessionState('dead');
                        triggerHaptic('error');
                        return;
                    }
                } catch { /* offline: i fascicoli restano, il retry riscrive lo stato */ }
                triggerHaptic('error');
                setUploadStatus('idle');
                showNotification("Trasferimento Fallito", errMsg + " Restano in lista: controlla la connessione e riprova.", "error", 8000);
                return;
            }

            // Handshake finale: il PC riceve all_done (con data.failed se parziale).
            // L'esito VA verificato: senza ack il PC non finalizza (supabase-js mette
            // gli errori in {error}, il try/catch da solo non li vede).
            let doneAck: boolean | null = null;
            try {
                // data.sent = consegnati DAVVERO in questo giro: il PC lo usa per
                // aspettare gli ultimi INSERT Realtime prima di finalizzare.
                const { data, error } = await supabase.rpc('touch_scan_session', {
                    p_id: sessionId,
                    p_status: 'all_done',
                    p_data: { sent: successCount, ...(failCount > 0 ? { failed: failCount } : {}) },
                });
                doneAck = error ? null : data;
            } catch { /* offline: doneAck resta null */ }
            if (doneAck === false) {
                setUploadStatus('idle');
                setSessionState('dead');
                triggerHaptic('error');
                return;
            }
            const handshakeOk = doneAck === true;
            setHandshakePending(handshakeOk ? null : { sent: successCount, failed: failCount });

            if (failCount > 0) {
                // Con falliti in lista il prossimo "Invia" rifà comunque l'handshake
                // a fine giro: nessun bottone dedicato necessario qui.
                triggerHaptic('error');
                setUploadStatus('idle');
                showNotification("Trasferimento Parziale", `${successCount} inviati, ${failCount} falliti — restano in lista per riprovare.`, "warning", 6000);
                return;
            }

            if (!handshakeOk) {
                triggerHaptic('error');
                setUploadStatus('idle');
                showNotification("Conferma al PC mancata", "I fascicoli sono stati consegnati ma la conferma finale non è passata. Riprova la sola conferma dal bottone.", "warning", 8000);
                return;
            }

            triggerHaptic('success');
            setUploadStatus('success');
            // Si rimuovono SOLO i fascicoli consegnati: eventuali nuovi scatti
            // aggiunti durante il timer non vanno persi.
            setTimeout(() => {
                setDocuments(prev => prev.filter(d => d.status !== 'sent'));
                setUploadStatus('idle');
            }, 1500);
        }
    };

    if (isReadOnly) {
        return (
            <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-950 text-center">
                <div className="max-w-xs">
                    <h1 className="text-lg font-semibold text-slate-200 mb-2">Modalità sola lettura</h1>
                    <p className="text-sm text-slate-400">Il tuo account può consultare i dati ma non è autorizzato a caricare buste paga.</p>
                </div>
            </div>
        );
    }

    // Schermata esplicita per QR assente/invalido/scaduto/chiuso dal PC: senza
    // sessione viva il telefono non può consegnare nulla (RLS), inutile far
    // fotografare a vuoto. Una nuova scansione del QR apre una pagina nuova.
    if (sessionState === 'dead') {
        return (
            <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-950 text-center">
                <div className="max-w-xs">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-amber-500/40 flex items-center justify-center mb-3">
                        <QrCode className="w-6 h-6 text-amber-400" strokeWidth={1.8} />
                    </div>
                    <h1 className="text-lg font-semibold text-slate-200 mb-2">Sessione non valida o scaduta</h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Riapri lo scanner sul PC e inquadra il nuovo QR per iniziare una nuova sessione.
                        {documents.length > 0 && ' I fascicoli non inviati andranno aggiunti di nuovo.'}
                    </p>
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
    const toSendCount = documents.filter(d => d.status !== 'sent').length;
    const failedCount = documents.filter(d => d.status === 'failed').length;
    const isRetryOnly = toSendCount > 0 && toSendCount === failedCount;

    return (
        <div className="min-h-dvh bg-slate-950 text-white flex flex-col font-sans pb-32">
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

            {/* Stato invio per screen reader: i badge per-fascicolo sono solo visivi */}
            <p className="sr-only" aria-live="polite">
                {isUploading
                    ? `Invio in corso: ${progress.current} di ${progress.total}`
                    : hasDocs
                        ? `${documents.filter(d => d.status === 'sent').length} inviati, ${failedCount} falliti, ${documents.filter(d => d.status === 'ready').length} da inviare`
                        : ''}
            </p>

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
                                        className={`flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border ${
                                            doc.status === 'failed' ? 'border-red-500/40'
                                            : doc.status === 'sent' ? 'border-emerald-600/40 opacity-75'
                                            : 'border-slate-800'}`}>
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
                                                    aria-label="Nome busta paga"
                                                    value={doc.title === 'Lettura Intestazione...' ? '' : doc.title}
                                                    placeholder={doc.isDetecting ? "Lettura..." : "Nome busta paga"}
                                                    onChange={(e) => {
                                                        const newTitle = e.target.value;
                                                        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, title: newTitle } : d));
                                                    }}
                                                    className="bg-transparent border-none outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40 rounded text-sm font-medium text-white placeholder-slate-500 truncate w-full min-w-0 pointer-coarse:min-h-11"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{doc.pages.length} pagin{doc.pages.length > 1 ? 'e' : 'a'}</span>
                                                {!isOnboarding && doc.status !== 'sent' && !isUploading &&
                                                    !doc.pages.some(p => p.type === 'application/pdf' || p.name.toLowerCase().endsWith('.pdf')) && (
                                                    // Niente "aggiungi pagina" sui fascicoli PDF: lo stitching
                                                    // multi-pagina decodifica con Image e un PDF lo farebbe fallire.
                                                    <button
                                                        onClick={() => { setTargetFolderId(doc.id); cameraRef.current?.click(); }}
                                                        className={`flex items-center gap-0.5 ${accentText} active:opacity-70 pointer-coarse:min-h-11`}>
                                                        <Plus size={11} /> aggiungi pagina
                                                    </button>
                                                )}
                                                {doc.status === 'sent' && (
                                                    <span className="text-emerald-500 font-medium">inviato</span>
                                                )}
                                            </div>
                                            {doc.status === 'failed' && doc.errorMsg && (
                                                <p className="flex items-center gap-1 text-[11px] text-red-400 mt-0.5">
                                                    <AlertTriangle size={10} className="shrink-0" />
                                                    <span className="truncate">{doc.errorMsg}</span>
                                                </p>
                                            )}
                                        </div>
                                        {/* Stato invio / rimozione */}
                                        {doc.status === 'sending' ? (
                                            <div className="w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center shrink-0">
                                                <Loader2 className={`w-4 h-4 animate-spin ${accentText}`} />
                                            </div>
                                        ) : doc.status === 'sent' ? (
                                            <div className="w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            </div>
                                        ) : (
                                            <button onClick={() => removeDocument(doc.id)}
                                                disabled={isUploading}
                                                className="w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg flex items-center justify-center text-slate-500 active:text-red-400 active:bg-red-500/10 shrink-0 disabled:opacity-40"
                                                aria-label="Rimuovi">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom bar fissa */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-white/5 px-4 py-3 pb-safe-6">
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
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"
                                role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.current}
                                aria-label="Avanzamento invio">
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
                        {!isOnline && (
                            <div role="status" className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                <WifiOff size={12} className="shrink-0" />
                                <span>Sei offline — i fascicoli restano sul telefono, invia quando torna la rete.</span>
                            </div>
                        )}
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

                        {(toSendCount > 0 || handshakePending) && (
                            <button onClick={handleUploadAll}
                                disabled={anyDetecting || !isOnline}
                                className={`w-full py-3.5 rounded-xl ${accentBg} text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}>
                                <Zap size={16} />
                                {isOnboarding
                                    ? 'Estrai dati'
                                    : toSendCount === 0
                                        ? 'Conferma invio al PC'
                                        : isRetryOnly
                                            ? `Riprova ${failedCount} fallit${failedCount > 1 ? 'i' : 'o'}`
                                            : `Invia ${toSendCount} fascicol${toSendCount > 1 ? 'i' : 'o'}`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileUploadPage;