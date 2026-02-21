import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search,
    Plus,
    Download,
    Upload,
    User,
    Ticket,
    Sparkles,
    ArrowUp,
    X,
    Wallet,
    ChevronRight,
    Calculator,
    Delete,
    CheckCircle,
    AlertCircle,
    Info,
    SearchX,
    Briefcase,
    BarChart3,
    Lock,
    LogIn,
    LogOut,
    Settings,
    ArrowLeft,
    FileSpreadsheet,
    RotateCcw,
    Smartphone
} from 'lucide-react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import WorkerCard from './components/WorkerCard';
import WorkerModal from './components/WorkerModal';
import WorkerDetailPage from './components/WorkerDetailPage';
import TableComponent from './components/TableComponent';
import StatsDashboard from './components/StatsDashboard';
import QRScannerModal from './components/QRScannerModal';
import MobileUploadPage from './pages/MobileUploadPage';
// Importiamo tipi e logica
import { Worker, AnnoDati, parseFloatSafe, getColumnsByProfile } from './types';
import { DEFAULT_YEARS_TEMPLATE } from './constants';
import HiddenClasses from './HiddenClasses';
// --- CONFIGURAZIONE COLORI STATICA (FULL PALETTE) ---
const COLOR_VARIANTS: any = {
    emerald: {
        bgLight: 'bg-emerald-100', bgDark: 'dark:bg-emerald-900/30', bgSoft: 'bg-emerald-50', bgSoftDark: 'dark:bg-emerald-900/10',
        text: 'text-emerald-600', textDark: 'dark:text-emerald-400', textLight: 'text-emerald-500',
        border: 'border-emerald-200', borderDark: 'dark:border-emerald-700',
        borderHover: 'hover:border-emerald-300', borderDarkHover: 'dark:hover:border-emerald-600'
    },
    amber: {
        bgLight: 'bg-amber-100', bgDark: 'dark:bg-amber-900/30', bgSoft: 'bg-amber-50', bgSoftDark: 'dark:bg-amber-900/10',
        text: 'text-amber-600', textDark: 'dark:text-amber-400', textLight: 'text-amber-500',
        border: 'border-amber-200', borderDark: 'dark:border-amber-700',
        borderHover: 'hover:border-amber-300', borderDarkHover: 'dark:hover:border-amber-600'
    },
    blue: {
        bgLight: 'bg-blue-100', bgDark: 'dark:bg-blue-900/30', bgSoft: 'bg-blue-50', bgSoftDark: 'dark:bg-blue-900/10',
        text: 'text-blue-600', textDark: 'dark:text-blue-400', textLight: 'text-blue-500',
        border: 'border-blue-200', borderDark: 'dark:border-blue-700',
        borderHover: 'hover:border-blue-300', borderDarkHover: 'dark:hover:border-blue-600'
    },
    indigo: {
        bgLight: 'bg-indigo-100', bgDark: 'dark:bg-indigo-900/30', bgSoft: 'bg-indigo-50', bgSoftDark: 'dark:bg-indigo-900/10',
        text: 'text-indigo-600', textDark: 'dark:text-indigo-400', textLight: 'text-indigo-500',
        border: 'border-indigo-200', borderDark: 'dark:border-indigo-700',
        borderHover: 'hover:border-indigo-300', borderDarkHover: 'dark:hover:border-indigo-600'
    },
    orange: {
        bgLight: 'bg-orange-100', bgDark: 'dark:bg-orange-900/30', bgSoft: 'bg-orange-50', bgSoftDark: 'dark:bg-orange-900/10',
        text: 'text-orange-600', textDark: 'dark:text-orange-400', textLight: 'text-orange-500',
        border: 'border-orange-200', borderDark: 'dark:border-orange-700',
        borderHover: 'hover:border-orange-300', borderDarkHover: 'dark:hover:border-orange-600'
    },
    violet: {
        bgLight: 'bg-violet-100', bgDark: 'dark:bg-violet-900/30', bgSoft: 'bg-violet-50', bgSoftDark: 'dark:bg-violet-900/10',
        text: 'text-violet-600', textDark: 'dark:text-violet-400', textLight: 'text-violet-500',
        border: 'border-violet-200', borderDark: 'dark:border-violet-700',
        borderHover: 'hover:border-violet-300', borderDarkHover: 'dark:hover:border-violet-600'
    },
    cyan: {
        bgLight: 'bg-cyan-100', bgDark: 'dark:bg-cyan-900/30', bgSoft: 'bg-cyan-50', bgSoftDark: 'dark:bg-cyan-900/10',
        text: 'text-cyan-600', textDark: 'dark:text-cyan-400', textLight: 'text-cyan-500',
        border: 'border-cyan-200', borderDark: 'dark:border-cyan-700',
        borderHover: 'hover:border-cyan-300', borderDarkHover: 'dark:hover:border-cyan-600'
    },
    slate: {
        bgLight: 'bg-slate-100', bgDark: 'dark:bg-slate-800', bgSoft: 'bg-slate-50', bgSoftDark: 'dark:bg-slate-900',
        text: 'text-slate-600', textDark: 'dark:text-slate-300', textLight: 'text-slate-500',
        border: 'border-slate-200', borderDark: 'dark:border-slate-700',
        borderHover: 'hover:border-slate-300', borderDarkHover: 'dark:hover:border-slate-600'
    }
};
// --- MOTORE CORIANDOLI (GOD TIER FX) ---
const triggerConfetti = () => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
    const particleCount = 100;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: any[] = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 5,
            life: 100 + Math.random() * 50,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 5 + 2
        });
    }

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (p.life > 0) {
                active = true;
                p.life--;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.4;
                p.vx *= 0.95;

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        if (active) requestAnimationFrame(render);
        else document.body.removeChild(canvas);
    };

    render();
};

const DEFAULT_WORKERS: Worker[] = [
    {
        id: 1,
        nome: "Mario",
        cognome: "Rossi",
        ruolo: "Macchinista",
        profilo: "RFI",
        accentColor: "indigo",
        anni: JSON.parse(JSON.stringify(DEFAULT_YEARS_TEMPLATE))
    }
];

const CARD_COLORS = ['blue', 'indigo', 'emerald', 'orange'];

// --- COMPONENTE ANIMAZIONE NUMERI (CORRETTO CON DECIMALI) ---
const AnimatedCounter = ({ value, isCurrency = false }: { value: number, isCurrency?: boolean }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { damping: 30, stiffness: 100 });

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        return springValue.on("change", (latest) => {
            if (ref.current) {
                ref.current.textContent = isCurrency
                    ? latest.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Math.round(latest).toString();
            }
        });
    }, [springValue, isCurrency]);

    return <span ref={ref} />;
};

// --- COMPONENTE CALCOLATRICE FLUTTUANTE (Spostabile e con Fix Tastiera) ---
const FloatingCalculator = ({ onClose }: { onClose: () => void }) => {
    const [display, setDisplay] = useState('');

    const handleBtn = (val: string) => setDisplay(prev => prev + val);
    const handleClear = () => setDisplay('');

    const handleEqual = () => {
        if (!display) return; // Evita l'errore "undefined" se il display è vuoto
        try {
            const result = eval(display.replace(/,/g, '.'));
            setDisplay(result !== undefined ? String(result) : '');
        } catch {
            setDisplay('Errore');
            setTimeout(() => setDisplay(''), 1000);
        }
    };

    // Listener Tastiera
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;

            // Cattura l'invio e blocca l'evento per non far cliccare bottoni in background
            if (key === 'Enter' || key === '=') {
                e.preventDefault();
                e.stopPropagation();
                handleEqual();
                return;
            }

            // Accetta numeri e operatori
            if (/[0-9+\-*/.,]/.test(key)) {
                e.preventDefault();
                handleBtn(key);
                return;
            }

            if (key === 'Backspace') setDisplay(prev => prev.slice(0, -1));
            if (key === 'Escape') onClose();
            if (key === 'Delete' || key.toLowerCase() === 'c') handleClear();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [display, onClose]); // Aggiorna la memoria a ogni tasto premuto

    const btns = [
        { L: '7', v: '7' }, { L: '8', v: '8' }, { L: '9', v: '9' }, { L: '/', v: '/', c: 'text-indigo-500' },
        { L: '4', v: '4' }, { L: '5', v: '5' }, { L: '6', v: '6' }, { L: '*', v: '*', c: 'text-indigo-500' },
        { L: '1', v: '1' }, { L: '2', v: '2' }, { L: '3', v: '3' }, { L: '-', v: '-', c: 'text-indigo-500' },
        { L: 'C', v: 'C', f: handleClear, c: 'text-red-500' }, { L: '0', v: '0' }, { L: '=', v: '=', f: handleEqual, bg: 'bg-indigo-500 text-white hover:bg-indigo-600' }, { L: '+', v: '+', c: 'text-indigo-500' },
    ];

    return (
        <motion.div
            drag
            dragMomentum={false}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed bottom-24 right-8 z-[100] w-72 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden"
        >
            {/* HEADER con cursore move per trascinare */}
            <div className="p-4 bg-indigo-50/50 flex justify-between items-center border-b border-indigo-100 cursor-move">
                <span className="font-bold text-indigo-900 flex items-center gap-2 pointer-events-none">
                    <Calculator className="w-4 h-4" /> Calc
                </span>
                {/* Stop propagation sulla X per non innescare il drag */}
                <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="p-1 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-6 bg-slate-50 text-right text-3xl font-mono text-slate-700 font-bold tracking-widest overflow-hidden border-b border-slate-100 h-20 flex items-center justify-end">
                {display || '0'}
            </div>

            <div className="grid grid-cols-4 gap-2 p-4 bg-white/50">
                {btns.map((b, i) => (
                    <button key={i} onClick={() => b.f ? b.f() : handleBtn(b.v)}
                        className={`h-12 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center shadow-sm ${b.bg ? b.bg : 'bg-white hover:bg-indigo-50 text-slate-600'} ${b.c || ''}`}>
                        {b.L}
                    </button>
                ))}
            </div>
        </motion.div>
    );
};

// --- COMPONENTE TOAST NOTIFICATION ---
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />
    };

    const colors = {
        success: 'border-emerald-500/50 bg-emerald-50/90 text-emerald-900',
        error: 'border-red-500/50 bg-red-50/90 text-red-900',
        info: 'border-blue-500/50 bg-blue-50/90 text-blue-900'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md mb-3 ${colors[type]}`}
        >
            {icons[type]}
            <span className="font-bold text-sm pr-2">{message}</span>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
        </motion.div>
    );
};

// --- COMPONENTE MODALE DI CONFERMA (DINAMICO) ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, color = 'red' }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; color?: string }) => {
    if (!isOpen) return null;

    const styles: any = {
        indigo: { bgIcon: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400', btn: 'from-indigo-600 to-violet-600 shadow-indigo-500/30' },
        emerald: { bgIcon: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400', btn: 'from-emerald-600 to-teal-600 shadow-emerald-500/30' },
        orange: { bgIcon: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400', btn: 'from-orange-500 to-red-500 shadow-orange-500/30' },
        blue: { bgIcon: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400', btn: 'from-blue-600 to-cyan-600 shadow-blue-500/30' },
        red: { bgIcon: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-500', btn: 'from-red-500 to-pink-600 shadow-red-500/30' }
    };

    const currentStyle = styles[color] || styles.red;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${currentStyle.bgIcon}`}>
                        <Delete className={`w-8 h-8 ${currentStyle.icon}`} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Eliminare Lavoratore?</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        L'operazione è definitiva. Tutti i dati associati verranno rimossi dal sistema.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            Annulla
                        </button>
                        <button onClick={onConfirm} className={`px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r hover:scale-105 transition-all shadow-lg ${currentStyle.btn}`}>
                            Conferma Eliminazione
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// --- NUOVO COMPONENTE: MODALE CAMBIO PASSWORD ---
const ChangePasswordModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        if (newPass.length < 4) {
            setError("La password deve avere almeno 4 caratteri.");
            return;
        }
        if (newPass !== confirmPass) {
            setError("Le password non coincidono.");
            return;
        }
        localStorage.setItem('app_password', newPass); // SALVA NEL BROWSER
        alert("Password aggiornata con successo! Usala al prossimo accesso.");
        onClose();
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" /> Imposta Password
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nuova Password</label>
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Conferma Password</label>
                        <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                </div>

                {error && <p className="text-red-500 text-xs font-bold mt-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}

                <div className="flex gap-3 justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-all shadow-lg">Salva</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// --- COMPONENTE EMPTY STATE (NESSUN RISULTATO) ---
const EmptyState = ({ isSearch = false, onReset }: { isSearch?: boolean, onReset?: () => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <SearchX className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 mb-2">
            {isSearch ? "Nessun lavoratore trovato" : "L'elenco è vuoto"}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
            {isSearch
                ? "Non ci sono corrispondenze per la tua ricerca. Prova a controllare l'ortografia."
                : "Non hai ancora inserito nessun lavoratore nel database."}
        </p>
        {isSearch && onReset && (
            <button
                onClick={onReset}
                className="px-6 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
            >
                Resetta Ricerca
            </button>
        )}
    </motion.div>
);



const App: React.FC = () => {
    // --- 0. ROUTING MOBILE (Check URL Params) ---
    const [isMobileMode, setIsMobileMode] = useState(false);
    const [mobileSessionId, setMobileSessionId] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const isMobile = params.get('mobile') === 'true';
        const session = params.get('session');

        if (isMobile && session) {
            setIsMobileMode(true);
            setMobileSessionId(session);
        }
    }, []);

    // --- ALTRIMENTI C'È L'APP DESKTOP ---

    // --- STATI MANCANTI PER IL MODALE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false); // <--- NUOVO STATO QR
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
    const [currentWorker, setCurrentWorker] = useState<any>(null);

    // --- FUNZIONE HANDLE OPEN MODAL (Che ora manca) ---
    const handleOpenModal = (mode: 'create' | 'edit', worker: any = null) => {
        setModalMode(mode);
        if (mode === 'edit') {
            setCurrentWorker(worker);
            setEditingWorkerId(worker.id);
        } else {
            setCurrentWorker(null);
            setEditingWorkerId(null);
        }
        setIsModalOpen(true);
    };

    // --- STATO LOGIN E SICUREZZA ---
    // 1. Modifica: Legge il login dalla memoria del browser all'avvio
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('is_logged_in') === 'true';
    });

    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // 2. Modifica: Funzione di Logout
    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('is_logged_in');
        setViewMode('home');
    };


    // --- STATO ---
    const [workers, setWorkers] = useState<Worker[]>(() => {
        const saved = localStorage.getItem('workers_data');
        return saved ? JSON.parse(saved) : DEFAULT_WORKERS;
    });

    const [showCalc, setShowCalc] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [viewMode, setViewMode] = useState<'home' | 'simple' | 'complex' | 'stats'>('home');


    // Modale Dettaglio Totali
    const [activeStatsModal, setActiveStatsModal] = useState<'net' | 'ticket' | null>(null);

    // Stato Eliminazione
    const [workerToDelete, setWorkerToDelete] = useState<number | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    // AGGIUNGI QUESTO STATO
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'RFI' | 'ELIOR' | 'REKEEP'>('ALL');
    const [showScrollTop, setShowScrollTop] = useState(false);
    // Trigger per forzare il ricalcolo quando si torna dalla scheda dettaglio
    const [refreshStats, setRefreshStats] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- STATO TOAST ---
    const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    // --- EFFETTI ---
    useEffect(() => {
        localStorage.setItem('workers_data', JSON.stringify(workers));
    }, [workers]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 400) setShowScrollTop(true);
            else setShowScrollTop(false);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- GESTIONE LOGIN DINAMICA ---
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const storedPassword = localStorage.getItem('app_password') || 'admin123';
        if (loginPassword === storedPassword) {
            setIsAuthenticated(true);
            localStorage.setItem('is_logged_in', 'true'); // <--- AGGIUNGI QUESTA RIGA
            setLoginError(false);
        } else {
            setLoginError(true);
            setTimeout(() => setLoginError(false), 2000);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // MODIFICA QUESTA LOGICA
    const filteredWorkers = workers.filter(w => {
        // Filtro Testo
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${w.nome} ${w.cognome}`.toLowerCase();
        const reverseName = `${w.cognome} ${w.nome}`.toLowerCase();
        const matchesSearch = !searchQuery || fullName.includes(query) || reverseName.includes(query);

        // Filtro Categoria (NUOVO)
        const matchesFilter = activeFilter === 'ALL' || w.profilo === activeFilter;

        return matchesSearch && matchesFilter;
    });

    // --- NAVIGAZIONE ---
    const handleOpenSimple = (id: number) => { setSelectedWorker(workers.find(w => w.id === id) || null); setViewMode('simple'); };
    const handleOpenComplex = (id: number) => { setSelectedWorker(workers.find(w => w.id === id) || null); setViewMode('complex'); };
    const handleBack = () => {
        setSelectedWorker(null);
        setViewMode('home');
        setRefreshStats(prev => prev + 1); // <--- Forza ricalcolo statistiche
    };

    // --- CRUD ---
    const openCreateModal = () => {
        setModalMode('create');
        setCurrentWorker(null); // <--- PULISCI I DATI
        setEditingWorkerId(null);
        setIsModalOpen(true);
    };

    const openEditModal = (e: React.MouseEvent, idOrWorker: any) => {
        e.stopPropagation();

        // Logica Corazzata: capisce da solo se gli arriva l'ID (numero) o l'oggetto intero
        const targetId = typeof idOrWorker === 'object' ? idOrWorker.id : idOrWorker;
        const workerToEdit = workers.find(w => w.id === targetId);

        setCurrentWorker(workerToEdit);
        setModalMode('edit');
        setEditingWorkerId(targetId);
        setIsModalOpen(true);
    };

    const handleSaveWorker = (data: any) => {
        if (modalMode === 'create') {
            const newId = Math.max(...workers.map(w => w.id), 0) + 1;
            const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
            const newWorker = {
                id: newId, ...data, accentColor: randomColor,
                anni: JSON.parse(JSON.stringify(DEFAULT_YEARS_TEMPLATE))
            };
            setWorkers([...workers, newWorker]);
            addToast("Nuovo lavoratore aggiunto!", "success");
            triggerConfetti();
        } else {
            setWorkers(workers.map(w => w.id === editingWorkerId ? { ...w, ...data } : w));
            addToast("Modifiche salvate con successo.", "success");
        }
        setIsModalOpen(false);
    };

    const handleDeleteWorker = (id: number) => {
        setWorkerToDelete(id);
    };

    const confirmDelete = () => {
        if (workerToDelete !== null) {
            setWorkers(workers.filter(w => w.id !== workerToDelete));
            addToast("Lavoratore eliminato con successo.", "error");
            setWorkerToDelete(null);
        }
    };

    const handleUpdateWorkerData = (updatedAnni: AnnoDati[]) => {
        if (!selectedWorker) return;
        const updatedWorkers = workers.map(w =>
            w.id === selectedWorker.id ? { ...w, anni: updatedAnni } : w
        );
        setWorkers(updatedWorkers);
        setSelectedWorker({ ...selectedWorker, anni: updatedAnni });
    };

    const handleUpdateStatus = (status: string) => {
        if (!selectedWorker) return;
        const updatedWorkers = workers.map(w =>
            w.id === selectedWorker.id ? { ...w, status: status as any } : w
        );
        setWorkers(updatedWorkers);
        setSelectedWorker({ ...selectedWorker, status: status as any });
    };

    const getEditingWorkerData = () => editingWorkerId ? workers.find(w => w.id === editingWorkerId) : null;
    // --- HELPER: PARSER ROBUSTO (AGGIUNGI DENTRO App, PRIMA DEI USEMEMO) ---
    const parseLocalFloat = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = val.toString();
        if (str.includes(',')) {
            str = str.replace(/\./g, '').replace(',', '.');
        }
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };
    // --- 1. CALCOLO STATISTICHE DASHBOARD (FIX: TICKET SOLO SE ATTIVI NEL TOTALE) ---
    const dashboardStats = useMemo(() => {
        return workers.reduce((acc, worker) => {
            // A. LEGGIAMO LE IMPOSTAZIONI
            const storedTicket = localStorage.getItem(`tickets_${worker.id}`);
            const includeTickets = storedTicket !== null ? JSON.parse(storedTicket) : true;
            const storedExFest = localStorage.getItem(`exFest_${worker.id}`);
            const includeExFest = storedExFest !== null ? JSON.parse(storedExFest) : false;
            const storedStart = localStorage.getItem(`startYear_${worker.id}`);
            const startClaimYear = storedStart ? parseInt(storedStart) : 2008;

            const TETTO_FERIE = includeExFest ? 32 : 28;
            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];

            const indCols = getColumnsByProfile(worker.profilo || 'RFI').filter(c =>
                !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
            );

            // B. CALCOLO MEDIE
            const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};
            safeAnni.forEach((row: any) => {
                const y = Number(row.year);
                if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
                const gg = parseLocalFloat(row.daysWorked);
                if (gg > 0) {
                    let sum = 0;
                    indCols.forEach(c => sum += parseLocalFloat(row[c.id]));
                    yearlyRaw[y].totVar += sum;
                    yearlyRaw[y].ggLav += gg;
                }
            });

            const yearlyAverages: Record<number, number> = {};
            Object.keys(yearlyRaw).forEach(k => {
                const y = Number(k);
                yearlyAverages[y] = yearlyRaw[y].ggLav > 0 ? yearlyRaw[y].totVar / yearlyRaw[y].ggLav : 0;
            });

            // C. CALCOLO FINALE
            let wNetto = 0;
            let wTicket = 0;

            const uniqueYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).sort((a, b) => a - b);

            uniqueYears.forEach((yearVal) => {
                const year = Number(yearVal);
                if (year < startClaimYear) return;

                let ferieCumulateAnno = 0;
                let media = yearlyAverages[year - 1];
                if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

                const monthsInYear = safeAnni
                    .filter((r: any) => Number(r.year) === year)
                    .sort((a: any, b: any) => a.monthIndex - b.monthIndex);

                monthsInYear.forEach((row: any) => {
                    const vacDays = parseLocalFloat(row.daysVacation);
                    const cTicket = parseLocalFloat(row.coeffTicket);
                    const cPercepito = parseLocalFloat(row.coeffPercepito);

                    const spazio = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
                    const ggUtili = Math.min(vacDays, spazio);
                    ferieCumulateAnno += vacDays;

                    if (ggUtili > 0) {
                        const lordo = ggUtili * media;
                        const percepito = ggUtili * cPercepito;
                        const ticketVal = ggUtili * cTicket;

                        // --- MODIFICA FONDAMENTALE QUI ---
                        // Sommiamo al totale della card SOLO se l'interruttore è ACCESO
                        if (includeTickets) {
                            wTicket += ticketVal;
                            wNetto += (lordo - percepito) + ticketVal;
                        } else {
                            wNetto += (lordo - percepito);
                            // wTicket rimane 0 per questo lavoratore in questa statistica
                        }
                    }
                });
            });

            return {
                totalNet: acc.totalNet + wNetto,
                totalTicket: acc.totalTicket + wTicket
            };
        }, { totalNet: 0, totalTicket: 0 });
    }, [workers, refreshStats]);

    // --- 2. LISTA DETTAGLIO MODALE (FIX: LOGICA ANNUALE CORRETTA) ---
    const statsList = useMemo(() => {
        if (!activeStatsModal) return [];

        return workers.map(worker => {
            // A. LEGGIAMO LE IMPOSTAZIONI
            const storedTicket = localStorage.getItem(`tickets_${worker.id}`);
            const includeTickets = storedTicket !== null ? JSON.parse(storedTicket) : true;
            const storedExFest = localStorage.getItem(`exFest_${worker.id}`);
            const includeExFest = storedExFest !== null ? JSON.parse(storedExFest) : false;
            const storedStart = localStorage.getItem(`startYear_${worker.id}`);
            const startClaimYear = storedStart ? parseInt(storedStart) : 2008;

            const TETTO_FERIE = includeExFest ? 32 : 28;
            const safeAnni = (Array.isArray(worker.anni) ? worker.anni : []) as any[];

            const indCols = getColumnsByProfile(worker.profilo || 'RFI').filter(c =>
                !['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(c.id)
            );

            // B. PRE-CALCOLO MEDIE
            const yearlyRaw: Record<number, { totVar: number; ggLav: number }> = {};
            safeAnni.forEach((row: any) => {
                const y = Number(row.year);
                if (!yearlyRaw[y]) yearlyRaw[y] = { totVar: 0, ggLav: 0 };
                const gg = parseLocalFloat(row.daysWorked);
                if (gg > 0) {
                    let sum = 0;
                    indCols.forEach(c => sum += parseLocalFloat(row[c.id]));
                    yearlyRaw[y].totVar += sum;
                    yearlyRaw[y].ggLav += gg;
                }
            });

            const yearlyAverages: Record<number, number> = {};
            Object.keys(yearlyRaw).forEach(k => {
                const y = Number(k);
                yearlyAverages[y] = yearlyRaw[y].ggLav > 0 ? yearlyRaw[y].totVar / yearlyRaw[y].ggLav : 0;
            });

            // C. CALCOLO IMPORTI (CICLO ANNUALE)
            let wNetto = 0;
            let wTicketLiq = 0;      // Quello che prende davvero (0 se spento)
            let wTicketPotenziale = 0; // Quello che avrebbe preso (240€ anche se spento)

            const uniqueYears = Array.from(new Set(safeAnni.map((r: any) => Number(r.year)))).sort((a, b) => a - b);

            uniqueYears.forEach((yearVal) => {
                const year = Number(yearVal);
                if (year < startClaimYear) return; // Filtro Anno

                let ferieCumulateAnno = 0; // RESET FONDAMENTALE DEL TETTO

                let media = yearlyAverages[year - 1];
                if (media === undefined || media === 0) media = yearlyAverages[year] || 0;

                const monthsInYear = safeAnni
                    .filter((r: any) => Number(r.year) === year)
                    .sort((a: any, b: any) => a.monthIndex - b.monthIndex);

                monthsInYear.forEach((row: any) => {
                    const vacDays = parseLocalFloat(row.daysVacation);
                    const cTicket = parseLocalFloat(row.coeffTicket);
                    const cPercepito = parseLocalFloat(row.coeffPercepito);

                    const spazio = Math.max(0, TETTO_FERIE - ferieCumulateAnno);
                    const ggUtili = Math.min(vacDays, spazio);
                    ferieCumulateAnno += vacDays;

                    if (ggUtili > 0) {
                        const lordo = ggUtili * media;
                        const percepito = ggUtili * cPercepito;
                        const ticketVal = ggUtili * cTicket;

                        // Accumula SEMPRE il potenziale (per mostrarlo barrato)
                        wTicketPotenziale += ticketVal;

                        if (includeTickets) {
                            wTicketLiq += ticketVal;
                            wNetto += (lordo - percepito) + ticketVal;
                        } else {
                            wNetto += (lordo - percepito);
                        }
                    }
                });
            });

            // Logica di visualizzazione
            let amount = 0;     // Cifra in grassetto
            let potential = 0;  // Cifra barrata (se diversa)

            if (activeStatsModal === 'net') {
                amount = wNetto;
            } else {
                amount = wTicketLiq;
                potential = wTicketPotenziale;
            }

            return {
                id: worker.id,
                fullName: `${worker.cognome} ${worker.nome}`,
                role: worker.ruolo,
                profilo: worker.profilo,
                amount: amount,
                potential: potential,
                color: worker.accentColor || 'blue',
                isTicketExcluded: !includeTickets
            };
        })
            // Mostra il lavoratore se ha un importo reale OPPURE se ha un potenziale nascosto (ticket spenti)
            .filter(w => w.amount > 0 || (activeStatsModal === 'ticket' && w.potential > 0))
            .sort((a, b) => b.amount - a.amount);
    }, [workers, activeStatsModal, refreshStats]);

    // --- 3. CONFIGURAZIONE MODALE (ORDINE CORRETTO: ULTIMO QUESTO) ---
    const modalConfig = useMemo(() => {
        if (activeStatsModal === 'net') {
            return {
                title: "Dettaglio Importi Netti",
                subtitle: "Specifica indennità per lavoratore",
                color: "emerald" as const,
                icon: Wallet,
                totalLabel: "Totale Credito",
                totalValue: dashboardStats.totalNet // Ora dashboardStats è già definito sopra!
            };
        }
        return {
            title: "Dettaglio Ticket Pasto",
            subtitle: "Specifica buoni pasto per lavoratore",
            color: "amber" as const,
            icon: Ticket,
            totalLabel: "Totale Ticket",
            totalValue: dashboardStats.totalTicket // Ora dashboardStats è già definito sopra!
        };
    }, [activeStatsModal, dashboardStats]);

    // --- VARIANTI ANIMAZIONE ---
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50, damping: 15 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };
    // --- BACKUP ---
    const handleExportData = () => {
        const dataStr = JSON.stringify(workers, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_ferrovieri_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("Backup scaricato con successo!", "success");
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsedData = JSON.parse(content);
                if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].hasOwnProperty('id')) {
                    if (window.confirm(`Stai per caricare ${parsedData.length} lavoratori. Continuare?`)) {
                        setWorkers(parsedData);
                        addToast("Backup ripristinato correttamente!", "success");
                        triggerConfetti();
                    }
                } else {
                    addToast("Il file selezionato non è valido.", "error");
                }
            } catch (error) {
                console.error(error);
                addToast("Errore durante la lettura del file.", "error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    {/* STATISTICHE HOME (VERSIONE SUPER-INTERATTIVA "INVITO AL CLICK") */ }
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 relative z-10">

        {/* 1. CARD PRATICHE (BADGE CHE SI ACCENDONO AL MOUSE) */}
        <div className="group relative h-full min-h-[240px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.4)] flex flex-col justify-between cursor-default">

            {/* Sfondo */}
            <div className="absolute top-[-50%] right-[-50%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="p-8 relative z-20">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 transition-all duration-500 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 group-hover:scale-110">
                        <User className="w-7 h-7" strokeWidth={2} />
                    </div>
                    {/* Indicatore Live */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Live</span>
                    </div>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Pratiche Totali</p>
                    <p className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-500 dark:from-white dark:to-slate-400">
                        <AnimatedCounter value={workers.length} />
                    </p>
                </div>
            </div>

            {/* BADGE ESPLOSIVI (Colore Pieno al Hover) */}
            <div className="px-8 pb-8 relative z-30 w-full pointer-events-auto">
                <div className="flex flex-wrap gap-2">

                    {/* RFI */}
                    <div
                        onClick={(e) => { e.stopPropagation(); setActiveFilter('RFI'); }}
                        className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white/50 text-slate-400 transition-all duration-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white hover:scale-110 hover:shadow-lg hover:shadow-blue-500/40 cursor-pointer"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest mb-1">RFI</span>
                        <span className="text-lg font-black leading-none">{workers.filter(w => w.profilo === 'RFI').length}</span>
                    </div>

                    {/* ELIOR */}
                    <div
                        onClick={(e) => { e.stopPropagation(); setActiveFilter('ELIOR'); }}
                        className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white/50 text-slate-400 transition-all duration-300 hover:bg-orange-500 hover:border-orange-400 hover:text-white hover:scale-110 hover:shadow-lg hover:shadow-orange-500/40 cursor-pointer"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest mb-1">ELIOR</span>
                        <span className="text-lg font-black leading-none">{workers.filter(w => w.profilo === 'ELIOR').length}</span>
                    </div>

                    {/* REKEEP */}
                    <div
                        onClick={(e) => { e.stopPropagation(); setActiveFilter('REKEEP'); }}
                        className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white/50 text-slate-400 transition-all duration-300 hover:bg-emerald-500 hover:border-emerald-400 hover:text-white hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/40 cursor-pointer"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest mb-1">REKEEP</span>
                        <span className="text-lg font-black leading-none">{workers.filter(w => w.profilo === 'REKEEP').length}</span>
                    </div>

                </div>
            </div>
        </div>

        {/* 2. CARD NETTO REALE (EMERALD - BOTTONE PULSANTE) */}
        <div
            onClick={() => setActiveStatsModal('net')}
            className="group relative h-full min-h-[240px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 hover:border-emerald-400/60 hover:shadow-[0_25px_60px_-15px_rgba(16,185,129,0.3)] cursor-pointer flex flex-col justify-between"
        >
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="p-8 relative z-20">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 transition-all duration-500 group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-12 group-hover:scale-110 shadow-sm group-hover:shadow-emerald-500/40">
                        <Wallet className="w-7 h-7" strokeWidth={2} />
                    </div>

                    {/* BOTTONE CHE INVITA AL CLICK (SEMPRE VISIBILE MA PULSANTE) */}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-400 group-hover:shadow-lg animate-pulse group-hover:animate-none">
                        <span className="group-hover:hidden">Vedi Dettagli</span>
                        <span className="hidden group-hover:inline">Clicca Qui</span>
                        <ChevronRight className="w-3 h-3" />
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-600 transition-colors">Netto Stimato Totale</p>
                    <p className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-500 dark:from-white dark:to-slate-300 group-hover:from-emerald-600 group-hover:to-teal-500 transition-all duration-500">
                        {dashboardStats.totalNet > 0 ? <AnimatedCounter value={dashboardStats.totalNet} isCurrency /> : '-'}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_currentColor]"></div>
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors">
                            Incluso Ticket e netto acconti
                        </p>
                    </div>
                </div>
            </div>
            {/* Barra colorata in basso */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>

        {/* 3. CARD TICKET (AMBER - BOTTONE PULSANTE) */}
        <div
            onClick={() => setActiveStatsModal('ticket')}
            className="group relative h-full min-h-[240px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 hover:border-amber-400/60 hover:shadow-[0_25px_60px_-15px_rgba(245,158,11,0.3)] cursor-pointer flex flex-col justify-between"
        >
            <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute top-4 right-4 text-amber-500/10 transition-all duration-500 transform rotate-0 group-hover:rotate-12 scale-75 group-hover:scale-100 group-hover:text-amber-500/20 pointer-events-none">
                <Ticket className="w-40 h-40" strokeWidth={1.5} />
            </div>

            <div className="p-8 relative z-20">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 transition-all duration-500 group-hover:bg-amber-500 group-hover:text-white group-hover:rotate-12 group-hover:scale-110 shadow-sm group-hover:shadow-amber-500/40">
                        <Ticket className="w-7 h-7" strokeWidth={2} />
                    </div>

                    {/* BOTTONE CHE INVITA AL CLICK */}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-400 group-hover:shadow-lg animate-pulse group-hover:animate-none">
                        <span className="group-hover:hidden">Vedi Dettagli</span>
                        <span className="hidden group-hover:inline">Clicca Qui</span>
                        <ChevronRight className="w-3 h-3" />
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-amber-600 transition-colors">Credito Ticket Maturato</p>
                    <p className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-500 dark:from-white dark:to-slate-300 group-hover:from-amber-600 group-hover:to-orange-500 transition-all duration-500">
                        {dashboardStats.totalTicket > 0 ? <AnimatedCounter value={dashboardStats.totalTicket} isCurrency /> : '-'}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_currentColor]"></div>
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-amber-700 transition-colors">
                            Valore monetario sostitutivo
                        </p>
                    </div>
                </div>
            </div>
            {/* Barra colorata in basso */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
        </div>
    </div>
    // SE SIAMO SU MOBILE, RENDERING ONLY MOBILE PAGE
    if (isMobileMode) {
        return <MobileUploadPage sessionId={mobileSessionId} />;
    }
    // --- RENDER CONDIZIONALE PER LOGIN ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-slate-900">
                <div className="absolute inset-0 z-0 bg-slate-900">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-50"
                    >
                        <source src="/login.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/30"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md relative z-10 mx-4"
                >
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/40 border border-white/20">
                            <Lock className="w-10 h-10 text-white" strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Accesso Gestionale</h2>
                        <p className="text-slate-300 text-sm font-medium">Inserisci le credenziali per sbloccare il sistema.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="relative group">
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="Password di Sicurezza"
                                className={`w-full bg-slate-900/60 border ${loginError ? 'border-red-500' : 'border-white/10 group-hover:border-white/30'} rounded-2xl px-6 py-4 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition-all font-bold tracking-widest text-center`}
                            />
                        </div>

                        {loginError && (
                            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-bold text-center bg-red-900/30 py-2 rounded-lg border border-red-500/30">
                                ⛔ Password errata. Accesso negato.
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/40 transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide text-sm"
                        >
                            <LogIn className="w-5 h-5" /> Entra nel Sistema
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold opacity-60">Sistema Sicuro v2.0 • Protetto</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // --- RENDER APP NORMALE (SOLO SE AUTENTICATO) ---
    if (viewMode === 'stats') {
        return <StatsDashboard workers={workers} onBack={handleBack} />;
    }
    if (viewMode === 'complex' && selectedWorker) {
        return (
            <WorkerDetailPage
                worker={selectedWorker}
                onUpdateData={handleUpdateWorkerData}
                onUpdateStatus={handleUpdateStatus}
                onBack={handleBack}
                onOpenReport={() => handleOpenSimple(selectedWorker.id)}
            />
        );
    }

    // --- BLOCCO VISTA REPORT (CORRETTO CON START YEAR) ---
    if (viewMode === 'simple' && selectedWorker) {
        // Recuperiamo al volo l'anno di partenza salvato per questo lavoratore
        const savedStart = localStorage.getItem(`startYear_${selectedWorker.id}`);
        const startYearToPass = savedStart ? parseInt(savedStart) : 2008;

        return (
            <div className="min-h-screen bg-white">
                <TableComponent
                    worker={selectedWorker}
                    onBack={() => setViewMode('home')}
                    onEdit={() => setViewMode('complex')}
                    startClaimYear={startYearToPass} // <--- Passaggio fondamentale aggiunto
                />
            </div>
        );
    }
    // -------------------------------------

    // --- GESTIONE DATI DA MOBILE ---
    // Funzione chiamata quando il QR Scanner riceve dati dal telefono
    const handleMobileScanSuccess = (data: any) => {
        console.log("DATI RICEVUTI DA MOBILE:", data);

        // 1. Apri Modale Edit/Create con i dati precompilati
        // (Qui potresti voler creare logica più complessa, es. aprire un modale di conferma)

        addToast("Busta Paga ricevuta dal telefono!", "success");
        triggerConfetti();

        // Esempio: Se vuoi salvare direttamente o aprire un worker esistente
        // Per ora facciamo un toast, l'implementazione dipenderà da come vuoi usare i dati.
        // Se l'OCR restituisce i dati completi, potremmo fare:
        // handleSaveWorker(data);
    };

    return (
        <div className="min-h-screen font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 relative overflow-hidden transition-colors duration-500">
            <HiddenClasses />
            {/* --- SFONDO "LIVING OCEAN" (Movimento Visibile & Colori Top) --- */}
            <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-500">

                {/* Definizione Animazione Custom "Wide Move" per garantire il movimento visibile */}
                <style>{`
               @keyframes wide-float {
                 0% { transform: translate(0, 0) scale(1); }
                 25% { transform: translate(10%, 15%) scale(1.2); }
                 50% { transform: translate(-5%, 20%) scale(0.9); }
                 75% { transform: translate(-15%, -5%) scale(1.1); }
                 100% { transform: translate(0, 0) scale(1); }
               }
               .animate-wide-float { animation: wide-float 15s infinite ease-in-out; }
               .animate-wide-float-fast { animation: wide-float 10s infinite ease-in-out reverse; }
               .animate-wide-float-slow { animation: wide-float 20s infinite ease-in-out; }
             `}</style>

                {/* --- LE CORRENTI (Colori: Blu Royal, Ciano Elettrico, Verde Acqua) --- */}

                {/* 1. La Corrente Profonda (Blu) - Si muove lenta */}
                <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-blue-600/50 dark:bg-blue-800/40 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-wide-float filter saturate-200"></div>

                {/* 2. La Corrente Luminosa (Ciano) - Si muove veloce e opposta */}
                <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] rounded-full bg-cyan-400/50 dark:bg-cyan-700/40 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-wide-float-fast filter saturate-200"></div>

                {/* 3. Il Cuore (Smeraldo/Teal) - Ruota al centro */}
                <div className="absolute top-[30%] left-[30%] w-[50vw] h-[50vw] rounded-full bg-emerald-400/40 dark:bg-teal-600/30 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-wide-float-slow filter saturate-200"></div>


                {/* --- STRATI DI FINITURA (Modificati per mostrare il movimento) --- */}

                {/* VETRO PIÙ SOTTILE: Blur sceso a 50px (era 90) e Bianco sceso al 40% (era 60) */}
                {/* Questo permette di vedere le forme muoversi distintamente sotto */}
                <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/50 backdrop-blur-[50px]"></div>

                {/* TEXTURE CARTA (Mantiene l'aspetto professionale) */}
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
                </div>

                {/* 3. VIGNETTATURA (Scurisce i bordi per concentrare la vista al centro) */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)]"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-6 py-10">
                {/* HEADER */}
                <div className="flex flex-col xl:flex-row justify-between items-center gap-8 mb-12">

                    {/* SINISTRA: LOGO E TITOLO */}
                    <div className="flex items-center gap-6 w-full xl:w-auto">
                        <div className="relative group w-32 h-32 flex-shrink-0">
                            <div className="relative w-full h-full rounded-full flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 overflow-hidden">
                                <img
                                    src="/logo.png"
                                    alt="Logo FS"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                Gestione{' '}
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={{
                                        backgroundImage: 'linear-gradient(to right, #4f46e5, #3b82f6)', // Indigo -> Blue
                                        WebkitBackgroundClip: 'text',
                                        color: 'transparent'
                                    }}
                                >
                                    Indennità
                                </span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1 flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-500" /> Pannello di Controllo Ferrovieri</p>
                        </div>
                    </div>

                    {/* DESTRA: PULSANTI AZIONE */}
                    <div className="flex flex-wrap justify-center xl:justify-end gap-3 w-full xl:w-auto ml-auto">

                        {/* GRUPPO STRUMENTI */}
                        <div className="flex gap-3">
                            <button onClick={() => setShowCalc(!showCalc)} className={`group relative w-12 h-12 rounded-xl shadow-md border flex items-center justify-center hover:scale-105 transition-all ${showCalc ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-slate-100'}`}>
                                <Calculator className={`w-6 h-6 ${showCalc ? 'text-white' : 'text-slate-600'}`} />
                            </button>

                            {/* TASTO IMPOSTAZIONI (COERENTE) */}
                            <button onClick={() => setIsSettingsOpen(true)} className="group relative w-12 h-12 rounded-xl shadow-md border bg-white border-slate-100 flex items-center justify-center hover:scale-105 transition-all hover:border-indigo-200">
                                <Settings className="w-6 h-6 text-slate-600 group-hover:text-indigo-600 transition-all duration-500 group-hover:rotate-180" />
                            </button>
                            {/* TASTO LOGOUT */}
                            <button onClick={handleLogout} className="group relative w-12 h-12 rounded-xl shadow-md border bg-white border-red-100 flex items-center justify-center hover:scale-105 transition-all hover:border-red-300 hover:bg-red-50">
                                <LogOut className="w-6 h-6 text-slate-600 group-hover:text-red-600" />
                            </button>
                            <button
                                onClick={() => setViewMode('stats')}
                                className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                                style={{ backgroundImage: 'linear-gradient(to right, #4f46e5, #7c3aed)' }} // Indigo -> Violet
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                                <BarChart3 className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
                                <span>Statistiche</span>
                            </button>
                        </div>

                        {/* GRUPPO DATI */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportData}
                                className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(168,85,247,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                                style={{ backgroundImage: 'linear-gradient(to right, #8b5cf6, #d946ef)' }} // Violet -> Fuchsia
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                                <Download className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={2.5} />
                                <span>Backup</span>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative px-6 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                                style={{ backgroundImage: 'linear-gradient(to right, #3b82f6, #06b6d4)' }} // Blue -> Cyan
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                                <Upload className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={2.5} />
                                <span>Ripristina</span>
                            </button>
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
                        </div>

                        {/* GRUPPO AZIONE PRINCIPALE */}
                        <button
                            onClick={openCreateModal}
                            className="group relative px-8 py-3 rounded-xl font-bold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.7)] hover:-translate-y-1 active:scale-95 transition-all duration-300 border border-white/20 overflow-hidden flex gap-2 items-center"
                            style={{ backgroundImage: 'linear-gradient(to right, #34d399, #06b6d4)' }} // Emerald -> Cyan
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
                            <Plus className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" strokeWidth={3} />
                            <span>Nuovo Lavoratore</span>
                        </button>
                    </div>
                </div>

                {/* STATISTICHE HOME (GOD TIER FX RESTORED) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 relative z-10">

                    {/* 1. CARD PRATICHE (NEON BLU - CON SFONDO E PING) */}
                    <div className="group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] flex flex-col justify-between cursor-default">

                        {/* Sfondo Decorativo Animato */}
                        <div className="absolute top-[-50%] right-[-50%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:scale-110"></div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="p-8 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                {/* Icona con Ping */}
                                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/40">
                                    <User className="w-7 h-7" strokeWidth={2} />
                                </div>
                                <div className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-0 group-hover:opacity-75 transition-opacity duration-300"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300 group-hover:bg-blue-500 transition-colors duration-300"></span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-600 transition-colors duration-300">Pratiche Gestite Totali</p>
                                <p className="text-6xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)', WebkitBackgroundClip: 'text' }}>
                                    <AnimatedCounter value={workers.length} />
                                </p>
                            </div>
                        </div>

                        {/* Footer Badge Stats */}
                        <div className="px-8 pb-8 relative z-10">
                            <div className="flex flex-wrap gap-3 opacity-90 group-hover:opacity-100 transition-opacity duration-500 translate-y-2 group-hover:translate-y-0">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-blue-50 border-blue-200"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[11px] font-black text-blue-800">RFI</span><span className="text-[11px] font-bold text-blue-600">{workers.filter(w => w.profilo === 'RFI').length}</span></div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-orange-50 border-orange-200"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-[11px] font-black text-orange-800">ELIOR</span><span className="text-[11px] font-bold text-orange-600">{workers.filter(w => w.profilo === 'ELIOR').length}</span></div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md bg-emerald-50 border-emerald-200"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[11px] font-black text-emerald-800">REKEEP</span><span className="text-[11px] font-bold text-emerald-600">{workers.filter(w => w.profilo === 'REKEEP').length}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* 2. CARD NETTO (EMERALD - CON GRAFICO SVG) */}
                    <div onClick={() => setActiveStatsModal('net')} className="group relative h-full min-h-[220px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.5)] cursor-pointer flex flex-col justify-between">

                        {/* Sfondo Decorativo */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-emerald-500/20"></div>

                        {/* Grafico SVG Sfondo (RESTITUITO!) */}
                        <svg className="absolute bottom-0 left-0 w-full h-40 text-emerald-500/5 group-hover:text-emerald-500/20 transition-all duration-700 ease-out translate-y-10 group-hover:translate-y-2" viewBox="0 0 100 40" preserveAspectRatio="none">
                            <path d="M0 40 L0 30 Q10 15 20 25 T40 15 T60 20 T80 5 L100 0 L100 40 Z" fill="currentColor" />
                        </svg>

                        <div className="p-8 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/40">
                                    <Wallet className="w-7 h-7" strokeWidth={2} />
                                </div>
                                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 opacity-0 group-hover:opacity-100 transition-all transform -translate-y-2 group-hover:translate-y-0 shadow-lg">CLICCA PER DETTAGLI</div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-600 transition-colors duration-300">Credito Stimato Totale</p>
                                <p className="text-6xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left" style={{ backgroundImage: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', WebkitBackgroundClip: 'text' }}>
                                    {dashboardStats.totalNet > 0 ? <AnimatedCounter value={dashboardStats.totalNet} isCurrency /> : '-'}
                                </p>
                                <div className="flex items-center gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_currentColor]"></div>
                                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">Differenza retributive calcolate applicando il principio di onnicomprensività (Cass. 20216/2022) sulle voci variabili ricorrenti, parametrata al tetto di 28 giorni annui.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. CARD TICKET (AMBER - CON ICONA GIGANTE) */}
                    <div onClick={() => setActiveStatsModal('ticket')} className="group relative h-full min-h-[220px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.5)] cursor-pointer flex flex-col justify-between">

                        {/* Sfondo Decorativo */}
                        <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] transition-all duration-700 opacity-50 group-hover:opacity-100 group-hover:bg-amber-500/20"></div>

                        {/* Icona Gigante Sfondo (RESTITUITA!) */}
                        <div className="absolute top-4 right-4 text-amber-500/0 group-hover:text-amber-500/10 transition-all duration-500 transform rotate-0 group-hover:rotate-12 scale-50 group-hover:scale-100 pointer-events-none">
                            <Ticket className="w-40 h-40" strokeWidth={1.5} />
                        </div>

                        <div className="p-8 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 border border-slate-200 dark:border-slate-600 transition-all duration-500 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-400 group-hover:-rotate-12 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/40">
                                    <Ticket className="w-7 h-7" strokeWidth={2} />
                                </div>
                                <div className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 shadow-lg">CLICCA PER DETTAGLI</div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-amber-600 transition-colors duration-300">Valore Ticket</p>
                                <p className="text-6xl font-black tracking-tighter transition-all duration-500 bg-clip-text text-slate-700 dark:text-slate-300 group-hover:text-transparent transform group-hover:scale-105 origin-left" style={{ backgroundImage: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', WebkitBackgroundClip: 'text' }}>
                                    {dashboardStats.totalTicket > 0 ? <AnimatedCounter value={dashboardStats.totalTicket} isCurrency /> : '-'}
                                </p>
                                <div className="flex items-center gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_currentColor]"></div>
                                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-amber-700">Controvalore monetario dei buoni pasto maturati durante le ferie godute e non erogati.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* --- SEARCH COMMAND CENTER (HOVER ACTIVATION EDITION) --- */}
                <div className="relative w-full max-w-4xl mx-auto mb-16 z-20">

                    {/* 1. LA BARRA DI RICERCA (CAPSULA ATTIVA) */}
                    <div className="relative group cursor-text">

                        {/* AURA DI SFONDO (Si attiva all'hover e al focus) */}
                        {/* A riposo: invisibile. Hover: 30% opacità. Focus: 60% opacità */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-30 group-focus-within:opacity-60 transition-all duration-500"></div>

                        {/* LA BARRA REALE */}
                        <div className="relative flex items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border-2 border-white/50 dark:border-slate-700/50 rounded-[2.5rem] shadow-xl transition-all duration-300 
                     group-hover:scale-[1.01] group-hover:bg-white/90 group-hover:border-indigo-300/50 group-hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)]
                     group-focus-within:scale-[1.02] group-focus-within:border-indigo-500 group-focus-within:shadow-[0_20px_50px_-10px_rgba(99,102,241,0.4)]">

                            {/* Icona Lente (Animazione FIXATA: Hover inclina, Focus raddrizza) */}
                            <div className="pl-6 md:pl-8">
                                <Search className="h-7 w-7 text-slate-400 transition-all duration-500 ease-out
                           group-hover:text-indigo-500 group-hover:scale-110 group-hover:-rotate-12
                           group-focus-within:text-indigo-600 group-focus-within:scale-125 group-focus-within:rotate-0"
                                    strokeWidth={2.5} />
                            </div>

                            {/* Input Campo */}
                            <input
                                type="text"
                                placeholder="Cerca dipendente per nome e/o cognome.."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none px-6 py-6 text-xl font-bold text-slate-700 dark:text-white placeholder:text-slate-400 placeholder:font-medium focus:ring-0 focus:outline-none"
                            />

                            {/* Tasto Reset */}
                            <AnimatePresence>
                                {searchQuery && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        onClick={() => setSearchQuery('')}
                                        className="mr-4 p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {/* Scanner Line (Appare solo quando scrivi) */}
                            <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
                        </div>
                    </div>

                    {/* 2. SMART FILTERS (PILLOLE NEON) */}
                    <div className="flex justify-center mt-6 gap-3 flex-wrap">
                        {[
                            { id: 'ALL', label: 'Tutti', color: 'slate' },
                            { id: 'RFI', label: 'RFI', color: 'blue' },
                            { id: 'ELIOR', label: 'ELIOR', color: 'orange' },
                            { id: 'REKEEP', label: 'REKEEP', color: 'emerald' }
                        ].map((filter) => {
                            const isActive = activeFilter === filter.id;
                            const activeClasses = {
                                slate: 'bg-slate-800 text-white shadow-lg shadow-slate-500/30 ring-2 ring-slate-400 scale-105',
                                blue: 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 scale-105',
                                orange: 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300 scale-105',
                                emerald: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300 scale-105'
                            };
                            // Aggiunto effetto hover anche sui filtri inattivi
                            const inactiveClasses = "bg-white/40 dark:bg-slate-800/40 text-slate-500 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 border border-white/40 hover:shadow-lg hover:-translate-y-0.5";

                            return (
                                <button
                                    key={filter.id}
                                    onClick={() => setActiveFilter(filter.id as any)}
                                    className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 backdrop-blur-md ${isActive ? (activeClasses as any)[filter.color] : inactiveClasses}`}
                                >
                                    {filter.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {/* --- 3. NO RESULTS STATE (MESSAGGIO VUOTO) --- */}
                <AnimatePresence>
                    {searchQuery && filteredWorkers.length === 0 && (
                        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-2xl mx-auto mt-12 text-center">
                            <div className="relative p-10 rounded-[3rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden group">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shimmer"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/10">
                                        <SearchX className="w-10 h-10 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                                    </motion.div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Nessun lavoratore trovato</h3>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mb-8 leading-relaxed">Non ci sono corrispondenze per "<span className="text-indigo-500 font-bold">{searchQuery}</span>".</p>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSearchQuery('')} className="group relative px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] animate-[shimmer_3s_infinite]"></div>
                                        <div className="relative flex items-center gap-2"><RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-180 duration-500" /><span>RESETTA RICERCA</span></div>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 4. WORKERS GRID (CORRETTA) --- */}
                {(!searchQuery || filteredWorkers.length > 0) && (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20"
                        variants={containerVariants}
                        initial="hidden" animate="show"
                    >
                        <AnimatePresence mode='popLayout'>

                            {/* 1. LAVORATORI ESISTENTI */}
                            {filteredWorkers.map(w => (
                                <motion.div key={w.id} variants={itemVariants} layout initial="hidden" animate="show" exit="exit">
                                    <WorkerCard
                                        worker={w}
                                        onOpenSimple={handleOpenSimple}
                                        onOpenComplex={handleOpenComplex}
                                        onEdit={(e) => openEditModal(e, w.id)} // <--- Assicurati che sia w.id
                                        onDelete={() => handleDeleteWorker(w.id)}
                                    />
                                </motion.div>
                            ))}

                            {/*  2. CARD "AGGIUNGI NUOVO" (ALLA FINE) */}
                            <motion.div
                                key="add-new-card"
                                variants={itemVariants}
                                layout
                                onClick={() => handleOpenModal('create')}
                                className="group relative w-full h-full min-h-[300px] bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 hover:border-emerald-400 hover:bg-emerald-50/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:-translate-y-2"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
                                    <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-700 shadow-xl border border-white/80 dark:border-slate-500 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-90 relative z-10">
                                        <Plus className="w-10 h-10 text-slate-300 dark:text-slate-500 transition-colors duration-300 group-hover:text-emerald-500" strokeWidth={2.5} />
                                    </div>
                                </div>
                                <span className="mt-6 font-black text-slate-400 uppercase tracking-widest text-sm transition-colors duration-300 group-hover:text-emerald-600">Crea Nuova Pratica</span>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* MODALE STATISTICHE (CORRETTA E SICURA) */}
                <AnimatePresence>
                    {activeStatsModal && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setActiveStatsModal(null)}>
                            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-700/60 overflow-hidden max-h-[80vh] flex flex-col">

                                {/* HEADER */}
                                <div className={`p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center sticky top-0 z-10`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl ${COLOR_VARIANTS[modalConfig.color].bgLight} ${COLOR_VARIANTS[modalConfig.color].bgDark}`}>
                                            <modalConfig.icon className={`w-6 h-6 ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark}`} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-800 dark:text-white">{modalConfig.title}</h2>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{modalConfig.subtitle}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveStatsModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-6 h-6" /></button>
                                </div>

                                {/* LISTA CON FIX ANTI-CRASH */}
                                <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                                    {statsList.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400">Nessun importo calcolato disponibile.</div>
                                    ) : (
                                        statsList.map((item, index) => {
                                            // 👇 RIGA MAGICA: Se il colore non esiste nella palette, usa 'blue' di default
                                            const theme = COLOR_VARIANTS[item.color] || COLOR_VARIANTS['blue'] || COLOR_VARIANTS['emerald'];

                                            return (
                                                <div key={item.id} className={`flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group ${theme.borderHover} ${theme.borderDarkHover}`}>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs font-bold text-slate-300 w-6">#{index + 1}</span>
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme.bgLight} ${theme.bgSoftDark} ${theme.text} ${theme.textDark} font-bold shadow-inner`}>
                                                            {item.fullName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 dark:text-slate-200">{item.fullName}</h3>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] uppercase font-bold text-slate-400">{item.role || 'N.D.'}</p>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${item.profilo === 'ELIOR' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{item.profilo}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        {/* CASO 1: TICKET ESCLUSI (Solo nel modale ticket) */}
                                                        {activeStatsModal === 'ticket' && item.isTicketExcluded ? (
                                                            <>
                                                                <div className="flex items-center gap-1 mb-0.5">
                                                                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wide border border-red-200 dark:border-red-800">
                                                                        NON CALCOLATO
                                                                    </span>
                                                                </div>
                                                                <span className="block text-lg font-black text-slate-300 dark:text-slate-600 tracking-tight line-through decoration-2 decoration-red-400/50">
                                                                    {/* Mostriamo il potenziale barrato, oppure 0 */}
                                                                    {item.potential.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                                    Maturati: <span className="text-slate-500 font-mono">{item.potential.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                                                                </span>
                                                            </>
                                                        ) : (
                                                            /* CASO 2: NORMALE */
                                                            <>
                                                                <span className={`block text-lg font-black ${theme.text} ${theme.textDark} tracking-tight`}>
                                                                    {item.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                                </span>
                                                            </>
                                                        )}

                                                        <button onClick={() => { setActiveStatsModal(null); handleOpenSimple(item.id); }} className={`text-[10px] font-bold ${theme.textLight} hover:underline flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                            Vedi Report <ChevronRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* FOOTER */}
                                <div className={`p-6 ${COLOR_VARIANTS[modalConfig.color].bgSoft} ${COLOR_VARIANTS[modalConfig.color].bgSoftDark} border-t ${COLOR_VARIANTS[modalConfig.color].border} ${COLOR_VARIANTS[modalConfig.color].borderDark} flex justify-between items-center`}>
                                    <span className={`font-bold ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark} uppercase tracking-widest text-sm`}>{modalConfig.totalLabel}</span>
                                    <span className={`text-2xl font-black ${COLOR_VARIANTS[modalConfig.color].text} ${COLOR_VARIANTS[modalConfig.color].textDark}`}>{modalConfig.totalValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 👇 ECCOLO QUI: IL TASTO TORNA SU È INCLUSO! */}
                <AnimatePresence>
                    {showScrollTop && (
                        <motion.button initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.8 }} whileHover={{ scale: 1.1, boxShadow: "0 0 25px rgba(99, 102, 241, 0.6)" }} onClick={scrollToTop} className="fixed bottom-8 right-8 z-50 p-4 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-2xl border border-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer">
                            <ArrowUp className="w-6 h-6" strokeWidth={3} />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* CALCOLATRICE FLUTTUANTE */}
            <AnimatePresence>
                {showCalc && <FloatingCalculator onClose={() => setShowCalc(false)} />}
            </AnimatePresence>

            {/* CONTAINER NOTIFICHE TOAST */}
            <div className="fixed bottom-4 right-4 z-[110] flex flex-col items-end pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <div key={toast.id} className="pointer-events-auto">
                            <Toast message={toast.message} type={toast.type} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            {/* MODALE CONFERMA ELIMINAZIONE */}
            <AnimatePresence>
                {workerToDelete !== null && (
                    <ConfirmModal
                        isOpen={true}
                        color={workers.find(w => w.id === workerToDelete)?.accentColor || 'red'}
                        onClose={() => setWorkerToDelete(null)}
                        onConfirm={confirmDelete}
                    />
                )}
            </AnimatePresence>
            {/* MODALE CRUD */}
            <WorkerModal
                key={currentWorker ? `worker-${currentWorker.id}` : 'new-worker'}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleSaveWorker}
                mode={modalMode}
                initialData={currentWorker}
            />

            {/* MODALE QR CODE SCANNER */}
            <QRScannerModal
                isOpen={isQRModalOpen}
                onClose={() => setIsQRModalOpen(false)}
                onScanSuccess={handleMobileScanSuccess}
            />

            {/* MODALE CAMBIO PASSWORD */}
            <ChangePasswordModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
};

export default App; 