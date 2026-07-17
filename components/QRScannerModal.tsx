import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, FileText, Smartphone, Cpu, Archive, Sparkles } from 'lucide-react';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabaseClient';
import { useIsland } from '../IslandContext';
import { IS_DEMO } from '../config/demo';

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
    const watchdogTimer = useRef<NodeJS.Timeout | null>(null);
    // Timer del reset post-esito (all_done/errore retryable): va annullato se il
    // telefono riparte prima che scatti, o riscriverebbe 'waiting' sopra il nuovo
    // 'processing' e azzererebbe i contatori del giro in corso.
    const pendingResetTimer = useRef<NodeJS.Timeout | null>(null);
    // Guard di chiusura (vedi triggerClose): separato dai flag visivi.
    const isClosing = useRef(false);
    const lastProgressAt = useRef<number>(0);
    const [currentTime, setCurrentTime] = useState('');

    // Se il telefono va in crash/timeout DURANTE l'upload, prima il PC restava su
    // "Sincronizzazione" all'infinito. Watchdog: se siamo in processing e non arriva
    // nessun update per WATCHDOG_MS, mostriamo errore e chiudiamo.
    const WATCHDOG_MS = 75000;

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
        } catch (e) { /* AudioContext non disponibile su questo browser — atteso */ }
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
        } catch (e) { /* AudioContext non disponibile su questo browser — atteso */ }
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
        } catch (e) { /* AudioContext non disponibile su questo browser — atteso */ }
    };

    const triggerClose = async () => {
        // Guard dedicato: prima il check era su isPoweringOff/isDropping, ma
        // isDropping è anche il flag VISIVO acceso durante l'upload → il watchdog
        // e la X non riuscivano a chiudere il modale a upload in corso (no-op
        // silenzioso, sessione lasciata aperta).
        if (isClosing.current) return;
        isClosing.current = true;
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
        if (pendingResetTimer.current) clearTimeout(pendingResetTimer.current);

        if (globalSessionId && !IS_DEMO) await supabase.from('scan_sessions').delete().eq('id', globalSessionId);

        setIsPoweringOff(true);
        setTimeout(() => {
            setIsDropping(true);
            setTimeout(() => {
                globalSessionId = '';
                globalProcessedIds.clear();
                hasStartedUpload.current = false;
                latestOnClose.current();
                setIsPoweringOff(false);
                setIsDropping(false);
                setStatus('waiting');
                setScannedCount(0);
                setSyncProgress({ current: 0, total: 0 });
                isClosing.current = false;
            }, 300);
        }, 200);
    };

    const triggerWatchdogError = (reason: string) => {
        setErrorMessage(reason);
        setStatus('error');
        playErrorBuzz();
        if (hasStartedUpload.current) {
            finishUpload(globalProcessedIds.size, 1, 'mobile', reason);
        }
        setTimeout(() => triggerClose(), 2500);
    };

    const resetInactivityTimer = () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => triggerClose(), 600000);
    };

    useEffect(() => {
        if (!isOpen) return;
        isClosing.current = false;

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

        let isActive = true;
        const currentSession = globalSessionId;

        const onPhoneFileReady = (item: any, sessionMode?: string | null) => {
            if (!item || !item._batchId || globalProcessedIds.has(item._batchId)) return;
            globalProcessedIds.add(item._batchId);

            // Step 4: la modalità è quella dichiarata dal telefono al primo upload.
            // Fallback su scanModeRef (vecchio comportamento) solo se il telefono non l'ha
            // ancora scritta (sessione molto vecchia o degradata).
            const effectiveMode = sessionMode ?? scanModeRef.current;

            if (effectiveMode === 'archive') {
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
                    } catch (downloadErr) { console.error("Errore download:", downloadErr); }
                }
            } else {
                latestOnScanSuccess.current(item);
                window.dispatchEvent(new CustomEvent('mobile-onboarding-data', { detail: item }));
            }

            playSuccessBeep();
            resetInactivityTimer();
            lastProgressAt.current = Date.now();
            setScannedCount(globalProcessedIds.size);
            updateUploadProgress(globalProcessedIds.size);
            setStatus('file_done');
            setTimeout(() => {
                setStatus(prev => prev === 'all_done' ? 'all_done' : 'processing');
            }, 800);
        };

        // Sessione persistente: dopo aver mostrato l'esito (Fatto/errore retryable),
        // torniamo in waiting SENZA chiudere e SENZA cancellare la riga DB. L'utente
        // può scattare altre buste dal telefono e inviarle sullo stesso QR. La
        // chiusura/cleanup avviene solo su X esplicito o expires_at.
        const scheduleBatchReset = (fromStatus: 'all_done' | 'error', delayMs: number) => {
            pendingResetTimer.current = setTimeout(async () => {
                pendingResetTimer.current = null;
                if (!isActive) return;
                globalProcessedIds.clear();
                hasStartedUpload.current = false;
                setScannedCount(0);
                setSyncProgress({ current: 0, total: 0 });
                setIsScreenOff(false);
                setIsDropping(false);
                setStatus('waiting');
                lastProgressAt.current = 0;
                resetInactivityTimer();
                try {
                    // Compare-and-set: se il telefono ha già riscritto 'processing'
                    // (retry partito dopo l'ingresso in questo callback), NON
                    // sovrascrivere il nuovo giro con 'waiting'.
                    await supabase
                        .from('scan_sessions')
                        .update({ status: 'waiting', data: null })
                        .eq('id', currentSession)
                        .eq('status', fromStatus);
                } catch (e) { console.error('QRScanner: reset sessione fallito', e); }
            }, delayMs);
        };

        const onSessionUpdate = (session: any) => {
            if (!session || !isActive) return;

            if (session.mode && session.mode !== scanModeRef.current && (session.mode === 'ai' || session.mode === 'archive')) {
                // Step 4: PC si allinea alla modalità decisa dal telefono.
                scanModeRef.current = session.mode;
                setLocalScanMode(session.mode);
            }

            if (session.status === 'all_done') {
                // Dedup: un all_done SENZA alcuna evidenza di batch (né processing
                // visto, né risultati arrivati) è un duplicato post-reset (retry
                // della sola conferma quando questo PC ha già finalizzato) o un
                // evento stale: ignorarlo evita "Scansione Fallita" fantasma.
                // La condizione sui risultati copre il fail-open del telefono: se
                // le RPC 'processing' non sono atterrate ma gli INSERT sì, il
                // batch è reale e va finalizzato.
                if (!hasStartedUpload.current && globalProcessedIds.size === 0) return;

                // Esito parziale onesto: il telefono passa in data.failed i fascicoli
                // NON consegnati (restano sul telefono per il retry, stesso QR) e in
                // data.sent quanti ne ha consegnati DAVVERO in questo giro.
                let failedOnPhone = 0;
                let sentOnPhone: number | null = null;
                try {
                    const p = typeof session.data === 'string' ? JSON.parse(session.data) : session.data;
                    if (p?.failed) failedOnPhone = p.failed;
                    if (typeof p?.sent === 'number' && p.sent > 0) sentOnPhone = p.sent;
                } catch { /* data assente o malformato: esito pieno */ }

                const finalizeAllDone = () => {
                    if (!isActive) return;
                    setStatus('all_done');
                    playFinalSuccessChime();
                    finishUpload(globalProcessedIds.size, failedOnPhone, 'mobile',
                        failedOnPhone > 0 ? `${failedOnPhone} fascicoli falliti sul telefono: riprovali da lì, la sessione resta aperta.` : undefined);
                    scheduleBatchReset('all_done', 2000);
                };

                // Al timeout NON si finalizza alla cieca: si riconcilia dalla tabella
                // (stesso pattern dello snapshot iniziale; onPhoneFileReady deduplica
                // per _batchId), così un INSERT perso dal canale non perde il payload.
                const finalizeWithReconcile = async () => {
                    if (!isActive) return;
                    if (sentOnPhone !== null && globalProcessedIds.size < sentOnPhone) {
                        try {
                            const { data: rows } = await supabase
                                .from('scan_results').select('*')
                                .eq('session_id', currentSession)
                                .order('id', { ascending: true });
                            rows?.forEach((row: any) => onPhoneFileReady(row.payload, scanModeRef.current));
                        } catch (e) { console.error('QRScanner: riconciliazione risultati fallita', e); }
                    }
                    finalizeAllDone();
                };

                // I risultati viaggiano su un canale Realtime diverso: se l'all_done
                // sorpassa gli ultimi INSERT ancora in elaborazione, aspetta (bounded)
                // che il conteggio dichiarato dal telefono sia raggiunto.
                if (sentOnPhone !== null && globalProcessedIds.size < sentOnPhone) {
                    const t0 = Date.now();
                    const waitForResults = () => {
                        if (!isActive) return;
                        if (globalProcessedIds.size >= (sentOnPhone as number)) {
                            finalizeAllDone();
                            return;
                        }
                        if (Date.now() - t0 > 8000) {
                            finalizeWithReconcile();
                            return;
                        }
                        setTimeout(waitForResults, 250);
                    };
                    waitForResults();
                    return;
                }
                finalizeAllDone();
                return;
            }

            if (session.status === 'processing') {
                // Un nuovo giro è partito prima che scattasse il reset del giro
                // precedente (retry rapido dal telefono): esegui SUBITO la parte
                // locale del reset e annulla il timer, che avrebbe riscritto
                // 'waiting' sopra il 'processing' del telefono e azzerato i
                // contatori a giro in corso.
                if (pendingResetTimer.current) {
                    clearTimeout(pendingResetTimer.current);
                    pendingResetTimer.current = null;
                    globalProcessedIds.clear();
                    hasStartedUpload.current = false;
                    setScannedCount(0);
                    setSyncProgress({ current: 0, total: 0 });
                    // Senza il timer nessuno riporterebbe lo status da 'all_done' a
                    // 'waiting': si passa direttamente al nuovo giro.
                    setStatus('processing');
                }
                setStatus(prev => prev === 'all_done' ? 'all_done' : 'processing');
                lastProgressAt.current = Date.now();

                if (!hasStartedUpload.current) {
                    hasStartedUpload.current = true;
                    setIsScreenOff(true);
                    // startUpload SUBITO: se il batch è rapidissimo (1 file archive),
                    // l'all_done può arrivare entro 500ms — uno start ritardato
                    // cancellerebbe il finishTimer appena armato e l'Island
                    // resterebbe su 'uploading' per sempre. Ritardata solo l'animazione.
                    let totalFiles = 1;
                    try {
                        const p = typeof session.data === 'string' ? JSON.parse(session.data) : session.data;
                        if (p?.total) totalFiles = p.total;
                    } catch (e) { /* data malformato: parto con 1 */ }
                    startUpload('mobile', totalFiles);
                    setTimeout(() => setIsDropping(true), 500);
                }

                try {
                    const parsed = typeof session.data === 'string' ? JSON.parse(session.data) : session.data;
                    if (parsed?.total) {
                        setSyncProgress({ current: parsed.current, total: parsed.total });
                        updateUploadProgress(parsed.current);
                    }
                } catch { /* idem */ }
                return;
            }

            if (session.status === 'error') {
                let errorReason = "Immagine illeggibile o sfocata.";
                let retryable = false;
                let failedOnPhone = 1;
                try {
                    const parsed = typeof session.data === 'string' ? JSON.parse(session.data) : session.data;
                    if (parsed?.error) errorReason = parsed.error;
                    else if (typeof session.data === 'string') errorReason = session.data;
                    if (parsed?.retryable) retryable = true;
                    if (parsed?.failed) failedOnPhone = parsed.failed;
                } catch { /* fallback al default */ }

                setErrorMessage(errorReason);
                setStatus('error');
                playErrorBuzz();

                if (hasStartedUpload.current && retryable) {
                    // Il telefono tiene i fascicoli falliti e può riprovare sullo stesso
                    // QR: mostriamo l'errore ma NON chiudiamo (triggerClose cancellerebbe
                    // la riga → retry impossibile). Reset a waiting come dopo all_done.
                    finishUpload(0, failedOnPhone, 'mobile', errorReason);
                    scheduleBatchReset('error', 2500);
                } else if (hasStartedUpload.current) {
                    finishUpload(0, 1, 'mobile', errorReason);
                    setTimeout(() => triggerClose(), 2000);
                } else {
                    supabase.from('scan_sessions').update({ data: null, status: 'waiting' }).eq('id', currentSession).then();
                    setTimeout(() => { if (isActive) setStatus('waiting'); }, 3000);
                }
            }
        };

        let sessionChannel: any = null;
        let resultsChannel: any = null;

        const initSession = async () => {
            // Cleanup opportunistico delle sessioni scadute (sostituisce un cron).
            supabase.rpc('cleanup_expired_scan_sessions').then(({ error }) => {
                if (error) console.warn('QRScanner: cleanup_expired_scan_sessions fallito (RPC mancante?):', error.message);
            });

            // Crea la riga di questa sessione con owner_id = auth.uid() (RLS).
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.warn('QRScanner: utente non autenticato, sessione non creata');
                    return;
                }
                await supabase.from('scan_sessions').upsert({
                    id: currentSession,
                    status: 'waiting',
                    owner_id: user.id,
                });
            } catch (err) {
                console.error('QRScanner: errore upsert scan_session', err);
            }

            // Snapshot iniziale (riconnessione/refresh: recupera tutto ciò che è già
            // successo). Viene eseguito DOPO l'attivazione del canale risultati (vedi
            // subscribe sotto): l'overlap produce duplicati — deduplicati per _batchId
            // da onPhoneFileReady — invece di buchi tra snapshot e sottoscrizione.
            let snapshotDone = false;
            const runSnapshot = async () => {
                if (snapshotDone || !isActive) return;
                snapshotDone = true;
                try {
                    const [{ data: sessionData }, { data: resultsData }] = await Promise.all([
                        supabase.from('scan_sessions').select('*').eq('id', currentSession).maybeSingle(),
                        supabase.from('scan_results').select('*').eq('session_id', currentSession).order('id', { ascending: true }),
                    ]);
                    const sessionMode = sessionData?.mode ?? null;
                    if (resultsData?.length) {
                        resultsData.forEach((row: any) => onPhoneFileReady(row.payload, sessionMode));
                    }
                    if (sessionData) onSessionUpdate(sessionData);
                } catch (e) { console.error('QRScanner: snapshot iniziale fallito', e); }
            };

            if (!isActive) return;

            // Realtime: niente più polling. Push diretti.
            // Coda di serializzazione: il callback dei risultati è async (SELECT mode)
            // e i due canali sono indipendenti — senza coda un all_done può sorpassare
            // l'elaborazione degli ultimi INSERT e finalizzare con conteggi parziali.
            let eventQueue: Promise<void> = Promise.resolve();
            const enqueue = (fn: () => void | Promise<void>) => {
                eventQueue = eventQueue
                    .then(fn)
                    .catch(e => console.error('QRScanner: evento Realtime fallito', e));
            };

            sessionChannel = supabase
                .channel(`scan_session:${currentSession}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'scan_sessions',
                    filter: `id=eq.${currentSession}`,
                }, (payload: any) => enqueue(() => onSessionUpdate(payload.new)))
                .subscribe();

            resultsChannel = supabase
                .channel(`scan_results:${currentSession}`)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'scan_results',
                    filter: `session_id=eq.${currentSession}`,
                }, (payload: any) => enqueue(async () => {
                    // Per la modalità ne abbiamo bisogno coerente con quello che il mobile
                    // ha appena scritto su scan_sessions. Una select singola è economica.
                    let sessionMode: string | null = null;
                    try {
                        const { data: sess } = await supabase.from('scan_sessions').select('mode').eq('id', currentSession).maybeSingle();
                        sessionMode = sess?.mode ?? null;
                    } catch { /* fallback su scanModeRef */ }
                    onPhoneFileReady(payload.new?.payload, sessionMode);
                }))
                .subscribe((status: string) => {
                    // Snapshot ad canale ATTIVO: ciò che è arrivato prima viene
                    // recuperato dalla tabella, ciò che arriva dopo dal canale.
                    if (status === 'SUBSCRIBED') enqueue(runSnapshot);
                });

            // Fallback: se la conferma di sottoscrizione non arriva (rete lenta,
            // Realtime degradato), lo snapshot parte comunque: meglio un duplicato
            // deduplicato che un modal vuoto dopo un refresh.
            setTimeout(() => enqueue(runSnapshot), 3000);
        };

        // Watchdog: se siamo in processing e non vediamo update per > WATCHDOG_MS,
        // il telefono ha crashato/perso connessione DURANTE l'upload. Senza, il modale
        // resta su "Sincronizzazione" all'infinito.
        const checkWatchdog = () => {
            if (!isActive) return;
            if (hasStartedUpload.current && lastProgressAt.current > 0) {
                const silenceMs = Date.now() - lastProgressAt.current;
                if (silenceMs > WATCHDOG_MS) {
                    isActive = false;
                    triggerWatchdogError("Il telefono non risponde da oltre un minuto. Riprova.");
                    return;
                }
            }
            watchdogTimer.current = setTimeout(checkWatchdog, 5000);
        };
        watchdogTimer.current = setTimeout(checkWatchdog, 5000);

        // Demo: mostra solo il QR (per spiegare la funzione PC↔telefono), senza
        // toccare Supabase. Il collegamento live resta disattivato.
        if (!IS_DEMO) initSession();

        return () => {
            isActive = false;
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
            if (sessionChannel) supabase.removeChannel(sessionChannel);
            if (resultsChannel) supabase.removeChannel(resultsChannel);
            // Reset hasStartedUpload se la sessione globale è stata cancellata.
            if (!globalSessionId) hasStartedUpload.current = false;
        };
    }, [isOpen, company, workerName]);

    if (!isOpen) return null;

    const eliorParam = eliorType ? `&eliorType=${encodeURIComponent(eliorType)}` : '';

    // L'URL dinamico in base alla pillola
    const qrUrl = `${window.location.origin}/?mobile=true&session=${sessionId}&company=${encodeURIComponent(company)}&name=${encodeURIComponent(workerName)}${eliorParam}&type=${localScanMode}`;

    const appleTransition = { type: "spring" as const, damping: 25, stiffness: 200 };
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
                                        <div className={`bg-white p-4 rounded-3xl relative overflow-hidden shadow-2xl ring-4 transition-colors duration-500 ${localScanMode === 'ai' ? 'ring-indigo-500/20' : 'ring-cyan-500/20'}`}>
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
                                                transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
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
                                        {IS_DEMO && (
                                            <p className="text-amber-400/80 text-[11px] leading-snug font-medium mt-3">Anteprima demo — il collegamento live col telefono è disattivato.</p>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="azioni" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={appleTransition} className="flex flex-col items-center w-full gap-5 absolute inset-0">
                                        <div className="flex -space-x-3">
                                            {Array.from({ length: Math.min(scannedCount, 5) }).map((_, i) => (
                                                <motion.div key={`file-${i}`} initial={{ opacity: 0, y: -20, x: -10 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ type: "spring" as const, damping: 15 }} className="w-11 h-14 bg-[#1c1c1e] border border-[#2c2c2e] rounded-[10px] flex items-center justify-center z-10 shadow-lg">
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
                                                {`Termina Sessione (${scannedCount})`}
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