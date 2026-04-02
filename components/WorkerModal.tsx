import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProfiloAzienda } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User, Briefcase, Building2, Sparkles, Save,
    Check, Train, Coffee, Wrench, AlignLeft, ArrowRight,
    Fingerprint, BadgeCheck, Wand2, Loader2, UploadCloud, Smartphone, FileText, Cpu // <-- AGGIUNTE QUESTE
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabaseClient';
import { useIsland } from '../IslandContext';
import { FRAMER_PHYSICS } from '../framerConfig';
interface WorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    initialData?: any;
    mode: 'create' | 'edit';
}
// --- COMPONENTE AI X-RAY VISION (HUD OLOGRAFICO) ---
const AiScannerOverlay = ({ isScanning }: { isScanning: boolean }) => {
    const [scanText, setScanText] = useState("Inizializzazione Motore AI...");

    // Testi che ruotano durante l'attesa
    useEffect(() => {
        if (!isScanning) return;
        const texts = [
            "Allineamento griglia OCR...",
            "Scansione codici indennità...",
            "Risoluzione anomalie sintattiche...",
            "Estrazione retribuzione variabile...",
            "Validazione incrociata parametri legali...",
            "Compilazione JSON in corso..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            i = (i + 1) % texts.length;
            setScanText(texts[i]);
        }, 800); // Cambia testo ogni 0.8 secondi per dare senso di estrema velocità

        return () => clearInterval(interval);
    }, [isScanning]);

    // Scatoline olografiche fittizie che si accendono per simulare la lettura
    const boundingBoxes = [
        { top: '15%', left: '10%', width: '30%', delay: 0.2 },
        { top: '25%', left: '50%', width: '40%', delay: 0.8 },
        { top: '40%', left: '15%', width: '20%', delay: 1.4 },
        { top: '45%', left: '60%', width: '25%', delay: 2.0 },
        { top: '65%', left: '10%', width: '80%', delay: 2.5 },
        { top: '80%', left: '70%', width: '20%', delay: 3.1 },
    ];

    return (
        <AnimatePresence>
            {isScanning && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)' }}
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl overflow-hidden font-mono"
                >
                    {/* Sfondo Cyberpunk */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)]"></div>

                    <div className="relative w-[400px] h-[550px] border border-cyan-500/30 rounded-lg p-6 bg-slate-900/50 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col">

                        {/* HEADER HUD */}
                        <div className="flex justify-between items-center border-b border-cyan-500/30 pb-4 mb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
                                <div>
                                    <p className="text-cyan-400 text-xs font-black tracking-widest">GEMINI 3.1 PRO</p>
                                    <p className="text-slate-500 text-[9px] tracking-widest uppercase">X-Ray Vision Engine</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
                                <div className="w-2 h-2 rounded-full bg-cyan-500/50"></div>
                            </div>
                        </div>

                        {/* AREA DOCUMENTO (Con laser e box) */}
                        <div className="flex-1 relative border border-cyan-900/50 rounded bg-slate-950 overflow-hidden">
                            {/* Griglia di sfondo */}
                            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                            {/* Linee di testo finte (Blueprint) */}
                            <div className="absolute inset-4 flex flex-col gap-3 opacity-20">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="h-2 bg-cyan-500 rounded w-full" style={{ width: `${Math.random() * 60 + 30}%` }}></div>
                                ))}
                            </div>

                            {/* Bounding Boxes Animate (I rettangoli che "trovano" i dati) */}
                            {boundingBoxes.map((box, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1, 1.1] }}
                                    transition={{ duration: 1.5, delay: box.delay, repeat: Infinity, repeatDelay: 1 }}
                                    className="absolute border border-amber-400 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.5)] z-10"
                                    style={{ top: box.top, left: box.left, width: box.width, height: '24px' }}
                                >
                                    <span className="absolute -top-3 right-0 text-[7px] text-amber-400">DATA_EXTRACTED</span>
                                </motion.div>
                            ))}

                            {/* LASER SCANNER MAIN */}
                            <motion.div
                                animate={{ top: ['-10%', '110%'] }}
                                transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                                className="absolute left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_4px_rgba(6,182,212,0.8)] z-20"
                            >
                                <div className="absolute inset-0 bg-white blur-[2px]"></div>
                            </motion.div>
                            {/* SCIA DEL LASER */}
                            <motion.div
                                animate={{ top: ['-10%', '110%'] }}
                                transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                                className="absolute left-0 w-full h-32 bg-gradient-to-b from-transparent to-cyan-500/20 z-10 -translate-y-full"
                            ></motion.div>
                        </div>

                        {/* LOG INFERIORE */}
                        <div className="mt-4 shrink-0 bg-slate-950 border border-cyan-900/50 rounded p-3 h-20 flex flex-col justify-end relative overflow-hidden">
                            <motion.p
                                key={scanText}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-cyan-300 text-[10px] tracking-wider"
                            >
                                &gt; {scanText}
                            </motion.p>
                            <p className="text-slate-600 text-[9px] mt-1">&gt; Attendere responso dal server...</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
// --- SISTEMA COLORE "ZENITH NOVA" ---
const THEMES: any = {
    NEUTRAL: {
        color: '#64748b',
        avatarBg: 'from-slate-100 to-slate-200',
        avatarText: 'text-slate-500',
        gradient: 'from-slate-700 to-slate-800',
        lightGlow: 'rgba(148, 163, 184, 0.1)',
        icon: Building2 // <--- LA MAGIA È QUI: Abbiamo aggiunto l'icona di default!
    },
    RFI: {
        color: '#3b82f6',
        glow: '0 0 60px -15px rgba(59, 130, 246, 0.7)',
        gradient: 'from-blue-500 via-indigo-600 to-violet-600',
        avatarBg: 'from-blue-500 to-indigo-600',
        avatarText: 'text-white',
        lightGlow: 'rgba(59, 130, 246, 0.5)',
        icon: Train
    },
    ELIOR: {
        color: '#f97316',
        glow: '0 0 60px -15px rgba(249, 115, 22, 0.7)',
        gradient: 'from-orange-500 via-amber-500 to-red-500',
        avatarBg: 'from-orange-500 to-red-500',
        avatarText: 'text-white',
        lightGlow: 'rgba(249, 115, 22, 0.5)',
        icon: Coffee
    },
    REKEEP: {
        color: '#10b981',
        glow: '0 0 60px -15px rgba(16, 185, 129, 0.7)',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        avatarBg: 'from-emerald-500 to-teal-500',
        avatarText: 'text-white',
        lightGlow: 'rgba(16, 185, 129, 0.5)',
        icon: Wrench
    }
};

const OPTIONS = [
    { value: 'RFI', label: 'RFI', sub: 'Infrastrutture' },
    { value: 'ELIOR', label: 'ELIOR', sub: 'Ristorazione' },
    { value: 'REKEEP', label: 'REKEEP', sub: 'Manutenzione' },
];

const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onConfirm, initialData, mode }) => {
    // Isola Dinamica
    const { showNotification } = useIsland();

    // 1. Aggiornato stato con profiloProfessionale
    const [formData, setFormData] = useState<{
        nome: string;
        cognome: string;
        ruolo: string;
        profiloProfessionale: string; // NUOVO CAMPO
        profilo: ProfiloAzienda | null;
        eliorType?: 'viaggiante' | 'magazzino';
    }>({ nome: '', cognome: '', ruolo: '', profiloProfessionale: '', profilo: null, eliorType: 'viaggiante' });

    const [focusedField, setFocusedField] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    // --- NUOVO STATO OPZIONI DINAMICHE E RIQUADRO ESPANDIBILE ---
    const [dynamicOptions, setDynamicOptions] = useState(OPTIONS);
    const [isCompanyExpanded, setIsCompanyExpanded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('customCompanies');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const customOpts = Object.keys(parsed).map(key => ({
                        value: key,
                        label: key,
                        sub: 'Modello Custom'
                    }));
                    setDynamicOptions([...OPTIONS, ...customOpts]);
                } catch (e) { }
            }
        }
    }, [isOpen]);
    // --- NUOVI STATI PER QR CODE ---
    const [qrSessionId, setQrSessionId] = useState('');
    const [isQrActive, setIsQrActive] = useState(false);
    // Refs
    const pollingRef = useRef<boolean>(false);

    // --- CLEANUP GLOBALE POLLING (Anti-Memory Leak) ---
    useEffect(() => {
        return () => {
            pollingRef.current = false;
        };
    }, []);

    const nomeRef = useRef<HTMLInputElement>(null);
    const cognomeRef = useRef<HTMLInputElement>(null);
    const ruoloRef = useRef<HTMLInputElement>(null);
    const profRef = useRef<HTMLInputElement>(null); // NUOVO REF
    const gridRef = useRef<HTMLDivElement>(null);
    const submitBtnRef = useRef<HTMLButtonElement>(null);

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const compileDataFromAI = (data: any) => {
        setFormData(prev => {
            // 1. Recupera dinamicamente tutte le aziende valide (Sistema + Custom)
            let validCompanies = ['RFI', 'ELIOR', 'REKEEP'];
            const saved = localStorage.getItem('customCompanies');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    validCompanies = [...validCompanies, ...Object.keys(parsed)];
                } catch (e) { }
            }

            // 2. Normalizza il nome letto dall'AI (tutto maiuscolo)
            const detectedCompany = data.azienda ? data.azienda.toUpperCase().trim() : '';

            return {
                ...prev,
                nome: data.nome || prev.nome,
                cognome: data.cognome || prev.cognome,
                ruolo: data.ruolo || prev.ruolo,
                profiloProfessionale: data.profiloProfessionale || prev.profiloProfessionale,
                // 3. Se l'azienda trovata è tra quelle valide, la seleziona in automatico!
                profilo: validCompanies.includes(detectedCompany) ? detectedCompany : prev.profilo
            };
        });
    };

    const handleAutoFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsScanning(true);
        try {
            const base64 = await toBase64(file);
            const response = await fetch('/.netlify/functions/scan-worker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData: base64, mimeType: file.type })
            });
            if (!response.ok) throw new Error('Errore server');

            const data = await response.json();
            compileDataFromAI(data);
        } catch (error) {
            console.error(error);
            showNotification("Errore di Lettura", "Documento illeggibile o timeout server. Compila manualmente.", "error", 5000);
        } finally {
            setIsScanning(false);
            if (e.target) e.target.value = '';
        }
    };

    // --- LOGICA SMARTPHONE (QR) ---
    const startQrSession = async () => {
        const newSession = uuidv4();
        setQrSessionId(newSession);
        setIsQrActive(true);
        pollingRef.current = true;
        await supabase.from('scan_sessions').insert([{ id: newSession, status: 'waiting' }]);
        pollSupabase(newSession);
    };

    const cancelQrSession = async () => {
        setIsQrActive(false);
        pollingRef.current = false;
        if (qrSessionId) await supabase.from('scan_sessions').delete().eq('id', qrSessionId);
    };

    const pollSupabase = async (sessionId: string) => {
        if (!pollingRef.current) return;
        try {
            const { data } = await supabase.from('scan_sessions').select('*').eq('id', sessionId).single();

            // ✨ FIX CHIRURGICO: Aspettiamo ESPLICITAMENTE che lo status sia "completed" o "all_done"
            // Ignoriamo i messaggi intermedi di "processing"!
            if (data && (data.status === 'completed' || data.status === 'all_done') && data.data) {
                const parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                const aiResult = Array.isArray(parsedData) ? parsedData[0] : parsedData;

                // Assicuriamoci che ci siano i dati veri dell'AI prima di chiudere tutto
                if (aiResult && (aiResult.nome || aiResult.cognome || aiResult.azienda || aiResult.ruolo)) {
                    compileDataFromAI(aiResult);
                    cancelQrSession(); // Chiude il QR e ferma la ricerca

                    window.dispatchEvent(new CustomEvent('island-scan-label', { detail: 'ANAGRAFICA COMPILATA ✅' }));
                    return; // Fermiamo il ciclo
                }
            }
        } catch (e) { }

        // Se non ha ancora finito, riprova tra 1 secondo
        if (pollingRef.current) setTimeout(() => pollSupabase(sessionId), 1000);
    };

    // Se si chiude la finestra, spenge il QR
    useEffect(() => {
        if (!isOpen) cancelQrSession();
    }, [isOpen]);

    // 👇 INIZIO BLOCCO DA AGGIUNGERE 👇
    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && initialData) {
                // Se siamo in modalità modifica, popoliamo i campi
                setFormData({
                    nome: initialData.nome || '',
                    cognome: initialData.cognome || '',
                    ruolo: initialData.ruolo || '',
                    profiloProfessionale: initialData.profiloProfessionale || '',
                    profilo: initialData.profilo || null,
                    eliorType: initialData.eliorType || 'viaggiante'
                });
            } else {
                // Se stiamo creando, svuotiamo tutto
                setFormData({
                    nome: '',
                    cognome: '',
                    ruolo: '',
                    profiloProfessionale: '',
                    profilo: null,
                    eliorType: 'viaggiante'
                });
            }
        }
    }, [isOpen, mode, initialData]);
    // 👆 FINE BLOCCO DA AGGIUNGERE 👆
    // ✨ ASCOLTATORE MAGICO: Cattura i dati dal telefono via Evento Globale!
    useEffect(() => {
        if (!isOpen || mode !== 'create') return;

        const handleMobileData = (e: any) => {
            const aiData = e.detail;
            if (aiData) {
                compileDataFromAI(aiData);
                // Aggiorna l'Isola per dirle che è andato tutto bene
                window.dispatchEvent(new CustomEvent('island-scan-label', { detail: 'AUTOCOMPILAZIONE COMPLETATA ✅' }));
            }
        };

        window.addEventListener('mobile-onboarding-data', handleMobileData);
        return () => window.removeEventListener('mobile-onboarding-data', handleMobileData);
    }, [isOpen, mode]);
    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (formData.profilo && isFormValid) {
            onConfirm(formData);
            onClose();
        }
    };
    // Navigazione Aggiornata
    const handleInputNavigation = (e: React.KeyboardEvent, currentField: string) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            if (currentField === 'nome') cognomeRef.current?.focus();
            else if (currentField === 'cognome') ruoloRef.current?.focus();
            else if (currentField === 'ruolo') profRef.current?.focus(); // Va al nuovo campo
            else if (currentField === 'profiloProfessionale') gridRef.current?.focus(); // Dal nuovo campo alla griglia
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentField === 'cognome') nomeRef.current?.focus();
            else if (currentField === 'ruolo') cognomeRef.current?.focus();
            else if (currentField === 'profiloProfessionale') ruoloRef.current?.focus(); // Torna su
        }
    };

    const handleGridNavigation = (e: React.KeyboardEvent) => {
        const currentIndex = formData.profilo ? OPTIONS.findIndex(opt => opt.value === formData.profilo) : -1;
        if (e.key === 'ArrowRight') {
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % OPTIONS.length;
            setFormData({ ...formData, profilo: OPTIONS[nextIndex].value as ProfiloAzienda });
        } else if (e.key === 'ArrowLeft') {
            const prevIndex = currentIndex <= 0 ? OPTIONS.length - 1 : currentIndex - 1;
            setFormData({ ...formData, profilo: OPTIONS[prevIndex].value as ProfiloAzienda });
        } else if (e.key === 'ArrowUp') {
            profRef.current?.focus(); // Torna al nuovo campo
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
            if (formData.profilo) submitBtnRef.current?.focus();
        }
    };

    // Calcolo Progresso (Diviso per 5 campi = 20 punti ciascuno)
    const calculateProgress = () => {
        let score = 0;
        if (formData.nome.trim()) score += 20;
        if (formData.cognome.trim()) score += 20;
        if (formData.ruolo.trim()) score += 20;
        if (formData.profiloProfessionale.trim()) score += 20; // Punteggio nuovo campo
        if (formData.profilo) score += 20;
        return score;
    };

    const getInitials = () => {
        const n = formData.nome.charAt(0).toUpperCase();
        const c = formData.cognome.charAt(0).toUpperCase();
        return (n && c) ? `${n}${c}` : (mode === 'create' ? '' : '?');
    };

    const progress = calculateProgress();
    const isFormValid = progress === 100;

    // Algoritmo Tema Dinamico
    const activeTheme = useMemo(() => {
        if (!formData.profilo) return THEMES.NEUTRAL;
        // Se è un'azienda di sistema, usa il suo tema fisso
        if (THEMES[formData.profilo]) return THEMES[formData.profilo];

        // Se è Custom, genera un tema spettacolare basato sul nome!
        const customThemes = [
            { color: '#d946ef', glow: '0 0 60px -15px rgba(217, 70, 239, 0.7)', gradient: 'from-fuchsia-500 via-purple-500 to-pink-500', avatarBg: 'from-fuchsia-500 to-pink-500', avatarText: 'text-white', lightGlow: 'rgba(217, 70, 239, 0.5)', icon: Building2 }, // Fuchsia
            { color: '#8b5cf6', glow: '0 0 60px -15px rgba(139, 92, 246, 0.7)', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500', avatarBg: 'from-violet-500 to-purple-500', avatarText: 'text-white', lightGlow: 'rgba(139, 92, 246, 0.5)', icon: Building2 }, // Violet
            { color: '#06b6d4', glow: '0 0 60px -15px rgba(6, 182, 212, 0.7)', gradient: 'from-cyan-500 via-blue-500 to-indigo-500', avatarBg: 'from-cyan-500 to-blue-500', avatarText: 'text-white', lightGlow: 'rgba(6, 182, 212, 0.5)', icon: Building2 }, // Cyan
            { color: '#f43f5e', glow: '0 0 60px -15px rgba(244, 63, 94, 0.7)', gradient: 'from-rose-500 via-red-500 to-pink-500', avatarBg: 'from-rose-500 to-pink-500', avatarText: 'text-white', lightGlow: 'rgba(244, 63, 94, 0.5)', icon: Building2 }, // Rose
            { color: '#6366f1', glow: '0 0 60px -15px rgba(99, 102, 241, 0.7)', gradient: 'from-indigo-500 via-blue-500 to-cyan-500', avatarBg: 'from-indigo-500 to-blue-500', avatarText: 'text-white', lightGlow: 'rgba(99, 102, 241, 0.5)', icon: Building2 }, // Indigo
            { color: '#14b8a6', glow: '0 0 60px -15px rgba(20, 184, 166, 0.7)', gradient: 'from-teal-500 via-emerald-500 to-green-500', avatarBg: 'from-teal-500 to-emerald-500', avatarText: 'text-white', lightGlow: 'rgba(20, 184, 166, 0.5)', icon: Building2 }  // Teal
        ];

        let hash = 0;
        for (let i = 0; i < formData.profilo.length; i++) {
            hash = formData.profilo.charCodeAt(i) + ((hash << 5) - hash);
        }
        return customThemes[Math.abs(hash) % customThemes.length];
    }, [formData.profilo]);
    const shellTheme = mode === 'create' ? THEMES.REKEEP : activeTheme;

    if (!isOpen) return null;

    return (
        <>
            {/* IL NOSTRO NUOVO VISORE X-RAY */}
            <AiScannerOverlay isScanning={isScanning} />

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 perspective-1000">
                        {/* BACKDROP */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
                            className="absolute inset-0 bg-[#0a0f1e]/90 backdrop-blur-xl transition-all duration-700"
                        />

                        {/* CARD MODALE */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 120, rotateX: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 80, rotateX: 5 }}
                            transition={FRAMER_PHYSICS.heavyBounce}
                            className="relative w-full max-w-[700px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[3.5rem] overflow-hidden border-2 border-white/60 dark:border-slate-700 transition-colors duration-500"
                            style={{
                                // Usiamo l'operatore document.documentElement per verificare se siamo dark mode e togliere l'inset shadow bianco
                                boxShadow: document.documentElement.classList.contains('dark')
                                    ? `0 40px 100px -30px ${shellTheme.color}80, inset 0 2px 20px rgba(255,255,255,0.05)`
                                    : `0 40px 100px -30px ${shellTheme.color}60, inset 0 2px 20px rgba(255,255,255,0.8)`
                            }}
                        >
                            {/* AMBIENT GLOW */}
                            <motion.div
                                animate={{ background: `radial-gradient(circle at 50% -10%, ${shellTheme.lightGlow} 0%, transparent 60%)` }}
                                className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out"
                            />

                            {/* === HEADER === */}
                            <div className="relative overflow-hidden rounded-t-[3.5rem] border-b border-white/10">
                                {/* Dynamic Light Source */}
                                <motion.div
                                    animate={{
                                        backgroundColor: shellTheme.color,
                                        scale: [1, 1.1, 1],
                                    }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute top-[-60%] left-[-20%] w-[80%] h-[220%] rounded-full blur-[140px] opacity-25 pointer-events-none"
                                />
                                <motion.div
                                    animate={{ backgroundColor: shellTheme.color }}
                                    className="absolute top-[-40%] right-[-30%] w-[70%] h-[180%] rounded-full blur-[120px] opacity-20 pointer-events-none"
                                />

                                <div className="relative px-12 pt-12 pb-8 flex justify-between items-start z-10">
                                    <div className="flex items-center gap-6">
                                        <div className="relative group">
                                            <motion.div
                                                animate={{ backgroundColor: shellTheme.color }}
                                                className="absolute inset-0 rounded-3xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 scale-110"
                                            />
                                            <motion.div
                                                animate={{ backgroundImage: `linear-gradient(135deg, ${shellTheme.gradient})` }}
                                                className={`relative p-5 rounded-3xl text-white shadow-2xl ring-1 ring-white/40`}
                                            >
                                                {mode === 'create' ? <Sparkles className="w-9 h-9" strokeWidth={1.5} /> : <User className="w-9 h-9" strokeWidth={1.5} />}
                                            </motion.div>
                                        </div>

                                        <div className="text-slate-800 dark:text-white transition-colors">
                                            <h2 className="text-4xl font-black tracking-tight drop-shadow-sm leading-none">
                                                {mode === 'create' ? 'Nuova Pratica' : 'Modifica Dati'}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">
                                                    {mode === 'create' ? 'Inserimento Lavoratore' : `Matricola: ${initialData?.id}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* IDENTITY CORE (Avatar) */}
                                    <div className="relative flex flex-col items-center">
                                        <div className="absolute -inset-3 rounded-full blur-md opacity-40 transition-colors duration-700"
                                            style={{ backgroundColor: activeTheme.color }}></div>

                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center relative overflow-hidden ring-[4px] ring-white shadow-2xl z-10 bg-gradient-to-br ${activeTheme.avatarBg} transition-all duration-700`}>
                                            <motion.div
                                                animate={{
                                                    backgroundImage: `linear-gradient(135deg, ${activeTheme.gradient})`,
                                                    opacity: progress > 0 ? 1 : 0
                                                }}
                                                className="absolute inset-0 transition-all duration-500"
                                            />
                                            <span className={`relative z-10 text-2xl font-black transition-colors duration-500 drop-shadow-md ${activeTheme.avatarText}`}>
                                                {getInitials() || (mode === 'create' ? <User className="w-8 h-8 opacity-50" /> : '')}
                                            </span>
                                        </div>
                                        <svg className="absolute -top-1 -left-1 w-[88px] h-[88px] pointer-events-none rotate-[-90deg] z-20">
                                            <circle cx="44" cy="44" r="38" stroke="rgba(255,255,255,0.4)" strokeWidth="4" fill="none" />
                                            <motion.circle
                                                cx="44" cy="44" r="38" stroke={activeTheme.color} strokeWidth="4" fill="none" strokeLinecap="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: progress / 100 }}
                                                transition={{ duration: 0.7, ease: "easeOut" }}
                                                style={{ filter: `drop-shadow(0 0 6px ${activeTheme.color})` }}
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* PROGRESS BEAM */}
                            <div className="relative h-[4px] w-full bg-slate-100/50 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%`, backgroundColor: activeTheme.color }}
                                    className="absolute left-0 top-0 bottom-0 shadow-[0_0_25px_rgba(0,0,0,0.5)]"
                                    style={{ boxShadow: `0 0 20px ${activeTheme.color}, 0 0 8px white` }}
                                >
                                    <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full" />
                                </motion.div>
                            </div>

                            {/* FORM BODY */}
                            <form className="px-12 py-10 space-y-9 relative z-10 bg-white/30 dark:bg-slate-950/30 transition-colors">

                                {/* --- TASTO MAGICO AUTOCOMPILAZIONE AI --- */}
                                {mode === 'create' && (
                                    <div className="bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 p-4 rounded-3xl shadow-inner relative overflow-hidden mb-6 transition-colors">
                                        <div className="flex items-center gap-2 mb-3 px-2">
                                            <Wand2 className="w-4 h-4 text-indigo-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Autocompilazione AI</span>
                                        </div>

                                        <div className="flex gap-3">
                                            {/* Bottone 1: PDF Locale */}
                                            <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleAutoFill} className="hidden" />
                                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning || isQrActive}
                                                className="flex-1 relative group rounded-2xl p-[2px] bg-gradient-to-r from-indigo-500 to-cyan-500 overflow-hidden shadow-sm hover:shadow-[0_8px_20px_-5px_rgba(99,102,241,0.5)] transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:hover:shadow-none"
                                            >
                                                {/* Sfondo bianco che scompare all'hover per svelare il gradiente */}
                                                <div className="absolute inset-[2px] bg-white rounded-[14px] group-hover:opacity-0 transition-opacity duration-300 z-0"></div>
                                                {/* Contenuto */}
                                                <div className="relative z-10 px-4 py-3 flex items-center justify-center gap-2 h-full">
                                                    {isScanning ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600 group-hover:text-white transition-colors duration-300" />
                                                    ) : (
                                                        <FileText className="w-5 h-5 text-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                                                    )}
                                                    <span className="font-bold text-[11px] uppercase tracking-wide text-slate-700 group-hover:text-white transition-colors duration-300">Carica PDF</span>
                                                </div>
                                            </button>

                                            {/* Bottone 2: Usa Smartphone */}
                                            <button type="button" onClick={isQrActive ? cancelQrSession : startQrSession} disabled={isScanning}
                                                className={`flex-1 relative group rounded-2xl p-[2px] overflow-hidden shadow-sm transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:hover:shadow-none
            ${isQrActive
                                                        ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-[0_8px_20px_-5px_rgba(239,68,68,0.5)]'
                                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-[0_8px_20px_-5px_rgba(16,185,129,0.5)]'}`}
                                            >
                                                {/* Sfondo bianco/rosso chiaro che scompare all'hover */}
                                                <div className={`absolute inset-[2px] rounded-[14px] group-hover:opacity-0 transition-opacity duration-300 z-0 ${isQrActive ? 'bg-red-50' : 'bg-white'}`}></div>
                                                {/* Contenuto */}
                                                <div className="relative z-10 px-4 py-3 flex items-center justify-center gap-2 h-full">
                                                    {isQrActive ? (
                                                        <>
                                                            <X className="w-5 h-5 text-red-600 group-hover:text-white transition-colors duration-300" />
                                                            <span className="font-bold text-[11px] uppercase tracking-wide text-red-600 group-hover:text-white transition-colors duration-300">Annulla QR</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Smartphone className="w-5 h-5 text-emerald-600 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                                                            <span className="font-bold text-[11px] uppercase tracking-wide text-slate-700 group-hover:text-white transition-colors duration-300">Usa Smartphone</span>
                                                        </>
                                                    )}
                                                </div>
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isQrActive && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4">
                                                    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col items-center justify-center shadow-md relative">
                                                        <QRCode value={`${window.location.origin}/?mobile=true&session=${qrSessionId}&type=onboarding`} size={150} level="H" className="relative z-10 p-2 bg-white rounded-xl shadow-sm border border-slate-100" />
                                                        <p className="text-[11px] text-slate-500 mt-4 text-center max-w-[200px] font-medium leading-tight">Inquadra con la fotocamera per scansionare la busta paga.</p>
                                                        <motion.div animate={{ top: ['10%', '80%', '10%'] }} transition={{ duration: 2.5, ease: "linear", repeat: Infinity }} className="absolute left-1/2 -translate-x-1/2 w-[160px] h-0.5 bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] z-20 opacity-60 pointer-events-none" />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* ANAGRAFICA */}
                                <div className="grid grid-cols-2 gap-7">
                                    {['nome', 'cognome'].map((field) => (
                                        <div key={field} className="space-y-3">
                                            <label className="text-xs font-black uppercase tracking-widest ml-2 text-slate-400 flex items-center gap-2">
                                                {field}
                                                {focusedField === field && <motion.span layoutId="activeDot" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: shellTheme.color }} />}
                                            </label>
                                            <div className="relative group">
                                                {isScanning ? (
                                                    <div className="w-full h-[68px] rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border-2 border-transparent relative overflow-hidden">
                                                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent"></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div
                                                            className={`absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === field ? '' : 'text-slate-400'}`}
                                                            style={{ color: focusedField === field ? shellTheme.color : undefined }}
                                                        >
                                                            <motion.div animate={{ scale: focusedField === field ? 1.2 : 1 }} transition={FRAMER_PHYSICS.smooth}>
                                                                <AlignLeft className="w-6 h-6" />
                                                            </motion.div>
                                                        </div>
                                                        <input
                                                            ref={field === 'nome' ? nomeRef : cognomeRef}
                                                            type="text"
                                                            value={(formData as any)[field]}
                                                            onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                                            onKeyDown={(e) => handleInputNavigation(e, field)}
                                                            onFocus={() => setFocusedField(field)}
                                                            onBlur={() => setFocusedField(null)}
                                                            className="w-full pl-14 pr-6 py-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border-2 border-slate-200/80 dark:border-slate-700 outline-none transition-all duration-300 font-bold text-lg text-slate-700 dark:text-white dark:placeholder-slate-500 focus:bg-white/90 dark:focus:bg-slate-800 focus:border-transparent focus:ring-4 backdrop-blur-md shadow-sm"
                                                            style={{
                                                                boxShadow: focusedField === field ? `0 0 0 4px ${shellTheme.color}20, 0 8px 25px -5px ${shellTheme.color}30` : '',
                                                                borderColor: focusedField === field ? shellTheme.color : ''
                                                            }}
                                                            placeholder={`Inserisci ${field}...`}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* GRIGLIA QUALIFICA + PROFILO PROFESSIONALE */}
                                <div className="grid grid-cols-2 gap-7">
                                    {/* QUALIFICA */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest ml-2 text-slate-400 flex items-center gap-2">
                                            Qualifica
                                            {focusedField === 'ruolo' && <motion.span layoutId="activeDot" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: shellTheme.color }} />}
                                        </label>
                                        <div className="relative group">
                                            {isScanning ? (
                                                <div className="w-full h-[68px] rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border-2 border-transparent relative overflow-hidden">
                                                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent"></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'ruolo' ? '' : 'text-slate-400'}`} style={{ color: focusedField === 'ruolo' ? shellTheme.color : '' }}>
                                                        <motion.div animate={{ scale: focusedField === 'ruolo' ? 1.2 : 1 }} transition={FRAMER_PHYSICS.smooth}>
                                                            <Briefcase className="w-6 h-6" />
                                                        </motion.div>
                                                    </div>
                                                    <input
                                                        ref={ruoloRef}
                                                        type="text"
                                                        value={formData.ruolo}
                                                        onChange={e => setFormData({ ...formData, ruolo: e.target.value })}
                                                        onKeyDown={(e) => handleInputNavigation(e, 'ruolo')}
                                                        onFocus={() => setFocusedField('ruolo')}
                                                        onBlur={() => setFocusedField(null)}
                                                        className="w-full pl-14 pr-6 py-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border-2 border-slate-200/80 dark:border-slate-700 outline-none transition-all duration-300 font-bold text-lg text-slate-700 dark:text-white focus:bg-white/90 dark:focus:bg-slate-800 focus:border-transparent focus:ring-4 backdrop-blur-md shadow-sm"
                                                        style={{
                                                            boxShadow: focusedField === 'ruolo' ? `0 0 0 4px ${shellTheme.color}20, 0 8px 25px -5px ${shellTheme.color}30` : '',
                                                            borderColor: focusedField === 'ruolo' ? shellTheme.color : ''
                                                        }}
                                                        placeholder="Es. Macchinista..."
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* PROFILO PROFESSIONALE (NUOVO CAMPO) */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest ml-2 text-slate-400 flex items-center gap-2">
                                            Profilo Prof.
                                            {focusedField === 'profiloProfessionale' && <motion.span layoutId="activeDot" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: shellTheme.color }} />}
                                        </label>
                                        <div className="relative group">
                                            {isScanning ? (
                                                <div className="w-full h-[68px] rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border-2 border-transparent relative overflow-hidden">
                                                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent"></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'profiloProfessionale' ? '' : 'text-slate-400'}`} style={{ color: focusedField === 'profiloProfessionale' ? shellTheme.color : '' }}>
                                                        <motion.div animate={{ scale: focusedField === 'profiloProfessionale' ? 1.2 : 1 }} transition={FRAMER_PHYSICS.smooth}>
                                                            <BadgeCheck className="w-6 h-6" />
                                                        </motion.div>
                                                    </div>
                                                    <input
                                                        ref={profRef}
                                                        type="text"
                                                        value={formData.profiloProfessionale}
                                                        onChange={e => setFormData({ ...formData, profiloProfessionale: e.target.value })}
                                                        onKeyDown={(e) => handleInputNavigation(e, 'profiloProfessionale')}
                                                        onFocus={() => setFocusedField('profiloProfessionale')}
                                                        onBlur={() => setFocusedField(null)}
                                                        className="w-full pl-14 pr-6 py-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border-2 border-slate-200/80 dark:border-slate-700 outline-none transition-all duration-300 font-bold text-lg text-slate-700 dark:text-white dark:placeholder-slate-500 focus:bg-white/90 dark:focus:bg-slate-800 focus:border-transparent focus:ring-4 backdrop-blur-md shadow-sm"
                                                        style={{
                                                            boxShadow: focusedField === 'profiloProfessionale' ? `0 0 0 4px ${shellTheme.color}20, 0 8px 25px -5px ${shellTheme.color}30` : '',
                                                            borderColor: focusedField === 'profiloProfessionale' ? shellTheme.color : ''
                                                        }}
                                                        placeholder="Es. Livello B..."
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SELETTORE CONTRATTO */}
                                <div
                                    className="space-y-5 pt-4 outline-none"
                                    ref={gridRef}
                                    tabIndex={0}
                                    onKeyDown={handleGridNavigation}
                                    onFocus={() => setFocusedField('grid')}
                                    onBlur={() => setFocusedField(null)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Building2 className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Tipologia Contratto</span>
                                        </div>
                                        <motion.div
                                            animate={{
                                                color: activeTheme.color,
                                                backgroundColor: formData.profilo ? activeTheme.color + '20' : '#f1f5f9',
                                                borderColor: formData.profilo ? activeTheme.color + '40' : 'transparent'
                                            }}
                                            className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-500 border"
                                        >
                                            {formData.profilo ? (
                                                <>
                                                    <span className="w-2 h-2 rounded-full animate-pulse shadow-sm" style={{ background: activeTheme.color, boxShadow: `0 0 12px ${activeTheme.color}` }}></span>
                                                    <span className="drop-shadow-sm">{formData.profilo} ATTIVO</span>
                                                </>
                                            ) : 'SELEZIONE RICHIESTA'}
                                        </motion.div>
                                    </div>

                                    {/* INIZIO RIQUADRO ESPANDIBILE */}
                                    <div className="relative">
                                        <div className={`grid grid-cols-3 gap-5 transition-all duration-500 ${isCompanyExpanded ? 'max-h-[320px] overflow-y-auto custom-scrollbar p-2 -m-2' : ''}`}>
                                            {(isCompanyExpanded
                                                ? dynamicOptions
                                                // LOGICA MAGICA: Se chiuso, mostra la selezionata + altre 2 per riempire la prima riga
                                                : formData.profilo
                                                    ? [dynamicOptions.find(o => o.value === formData.profilo), ...dynamicOptions.filter(o => o.value !== formData.profilo)].slice(0, 3)
                                                    : dynamicOptions.slice(0, 3)
                                            ).map((opt) => {
                                                if (!opt) return null; // Previene crash
                                                const isSelected = formData.profilo === opt.value;
                                                const style = THEMES[opt.value] || THEMES.NEUTRAL;
                                                const isDimmed = formData.profilo !== null && !isSelected;

                                                return (
                                                    <motion.div
                                                        key={opt.value}
                                                        onClick={() => setFormData({ ...formData, profilo: opt.value as ProfiloAzienda })}
                                                        animate={isSelected
                                                            ? { scale: 1.05, opacity: 1, y: -8 }
                                                            : { scale: isDimmed ? 0.94 : 1, opacity: isDimmed ? 0.5 : 1, y: 0 }
                                                        }
                                                        whileHover={!isSelected ? { scale: 1.02, opacity: 1, y: -4 } : {}}
                                                        whileTap={{ scale: 0.96 }}
                                                        className={`
                          relative cursor-pointer rounded-3xl p-5 flex flex-col items-center justify-center text-center gap-3 h-[140px] overflow-hidden border-[3px] transition-all duration-500 backdrop-blur-md group
                          ${isSelected ? 'border-transparent bg-white dark:bg-slate-800' : 'border-slate-200/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:bg-white/90 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}
                        `}
                                                        style={{
                                                            boxShadow: isSelected ? style.glow : 'none',
                                                            ring: (focusedField === 'grid' && isSelected) ? `3px solid ${style.color}` : 'none'
                                                        }}
                                                    >
                                                        {/* LIQUID CASCADE FILL + SHIMMER */}
                                                        <AnimatePresence>
                                                            {isSelected && (
                                                                <>
                                                                    <motion.div
                                                                        initial={{ scaleX: 0, originX: 0 }}
                                                                        animate={{ scaleX: 1 }}
                                                                        exit={{ scaleX: 0, transition: { duration: 0.2 } }}
                                                                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                                                                        className={`absolute inset-0 z-0 bg-gradient-to-br ${style.gradient}`}
                                                                    />
                                                                    <motion.div
                                                                        animate={{ x: ['-100%', '200%'] }}
                                                                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 z-[1]"
                                                                    />
                                                                </>
                                                            )}
                                                        </AnimatePresence>

                                                        {/* CONTENT */}
                                                        <div className="relative z-10 flex flex-col items-center gap-3">
                                                            <motion.div
                                                                animate={isSelected ? { rotate: [0, -8, 8, 0], scale: 1.15 } : { rotate: 0, scale: 1 }}
                                                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                                                className={`p-3 rounded-2xl transition-all duration-500
                               ${isSelected ? 'bg-white/25 text-white backdrop-blur-md shadow-inner ring-1 ring-white/50' : 'bg-white shadow-sm text-slate-400 group-hover:text-' + style.color}`}
                                                            >
                                                                <style.icon className="w-8 h-8" />
                                                            </motion.div>

                                                            <div>
                                                                <p className={`text-lg font-black transition-colors duration-300 leading-none ${isSelected ? 'text-white drop-shadow-sm' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                    {opt.label}
                                                                </p>
                                                                <p className={`text-[10px] font-bold uppercase mt-1.5 transition-colors duration-300 tracking-wider ${isSelected ? 'text-white/90' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                    {opt.sub}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {isSelected && (
                                                            <motion.div
                                                                initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
                                                                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                                                className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.6)] ring-2 ring-white/50"
                                                                style={{ color: style.color }}
                                                            >
                                                                <Check className="w-4 h-4" strokeWidth={4} />
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>

                                        {/* TASTO MOSTRA TUTTE */}
                                        {dynamicOptions.length > 3 && (
                                            <div className="flex justify-center mt-5 relative z-20">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); setIsCompanyExpanded(!isCompanyExpanded); }}
                                                    className="flex items-center gap-2 px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                                                >
                                                    {isCompanyExpanded ? 'Comprimi Lista' : `Mostra Tutte (${dynamicOptions.length})`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* FINE RIQUADRO ESPANDIBILE */}

                                    {/* SELETTORE SOTTO-PROFILO ELIOR (TOGGLE) */}
                                    <AnimatePresence>
                                        {formData.profilo === 'ELIOR' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Briefcase className="w-5 h-5 text-orange-500" />
                                                        <span className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Variante Profilo Elior</span>
                                                    </div>
                                                    
                                                    {/* TOGGLE SWITCH GLASSMORPHISM */}
                                                    <div className="relative flex p-1.5 bg-slate-200/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-md border border-white/40 dark:border-slate-700">
                                                        {['viaggiante', 'magazzino'].map((type) => {
                                                            const isSelected = formData.eliorType === type;
                                                            return (
                                                                <button
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={(e) => { e.preventDefault(); setFormData({ ...formData, eliorType: type as 'viaggiante' | 'magazzino' }); }}
                                                                    className={`relative flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-300 z-10 flex items-center justify-center gap-2 ${isSelected ? 'text-white drop-shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                                                >
                                                                    {isSelected && (
                                                                        <motion.div
                                                                            layoutId="eliorTypeToggle"
                                                                            className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)] border border-white/20"
                                                                            initial={false}
                                                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                                        />
                                                                    )}
                                                                    <span className="relative z-10 flex items-center gap-2">
                                                                        {type === 'viaggiante' ? <Train className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                                                        {type}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                </div>

                                {/* FOOTER */}
                                <div className="flex gap-5 pt-8 border-t border-slate-200/50 mt-6 items-center">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="py-4 px-8 rounded-2xl font-bold text-slate-500 bg-white/60 border-2 border-slate-200/80 hover:border-slate-300 hover:bg-white hover:text-slate-700 transition-all duration-300 backdrop-blur-sm"
                                    >
                                        Annulla
                                    </button>
                                    <motion.button
                                        ref={submitBtnRef}
                                        onClick={(e) => handleSubmit(e)}
                                        disabled={!isFormValid}
                                        animate={isFormValid ? { scale: 1, opacity: 1 } : { scale: 0.98, opacity: 1 }}
                                        whileHover={isFormValid ? { scale: 1.03, boxShadow: activeTheme.glow } : {}}
                                        whileTap={isFormValid ? { scale: 0.96 } : {}}
                                        className={`flex-1 py-5 rounded-3xl font-black text-xl text-white flex items-center justify-center gap-4 transition-all relative overflow-hidden shadow-2xl group
                    ${!isFormValid ? 'bg-slate-200/50 backdrop-blur-md text-slate-400 cursor-not-allowed border-2 border-slate-300/50' : `bg-gradient-to-r ${activeTheme.gradient}`}`}
                                    >
                                        {isFormValid ? (
                                            <>
                                                <Save className="w-6 h-6 relative z-10" />
                                                <span className="relative z-10 tracking-tight drop-shadow-sm">
                                                    {mode === 'create' ? 'CONFERMA E SALVA' : 'AGGIORNA DATI'}
                                                </span>
                                                <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
                                                {/* BREATHE EFFECT + SHIMMER */}
                                                <motion.div
                                                    animate={{ opacity: [0, 0.3, 0] }}
                                                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                                    className="absolute inset-0 bg-white mix-blend-overlay"
                                                />
                                                <motion.div
                                                    animate={{ x: ['-100%', '200%'] }}
                                                    transition={{ repeat: Infinity, duration: 3, ease: "linear", delay: 1 }}
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 z-[1]"
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <Fingerprint className="w-6 h-6 relative z-10 opacity-50" />
                                                <span className="relative z-10 text-base tracking-tight uppercase opacity-70">
                                                    Compila tutti i dati per procedere
                                                </span>
                                            </>
                                        )}
                                    </motion.button>
                                </div>

                            </form>
                        </motion.div>
                    </div>
                )}

            </AnimatePresence>
        </>
    );
};

export default WorkerModal;
