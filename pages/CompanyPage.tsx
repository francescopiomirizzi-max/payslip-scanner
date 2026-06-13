import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, FileText, Mail, ChevronRight, UserX } from 'lucide-react';
import { Worker } from '../types';
import { SYSTEM_PROFILES, getCompanyLogo } from '../config/profiles';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { DevBadge } from '../components/ui/DevBadge';
import { matchesCompanyFilter } from '../hooks/useWorkers';
import { getCassettoByStatus } from '../config/cassetti';

interface CompanyPageProps {
    /** Chiave azienda di sistema (incl. 'ELIOR_MAGAZZINO'). */
    companyKey: string;
    workers: Worker[];
    onBack: () => void;
    onOpenWorker: (id: string) => void;
}

/**
 * Scheda INFORMATIVA dell'azienda: hero col logo grande, informativa CCNL in
 * breve, ed elenco dei lavoratori di quell'azienda (click → loro dettaglio).
 * Niente azioni operative (export/PEC/modifica): quelle vivono altrove.
 * Raggiungibile dai badge della striscia compatta della dashboard (#/azienda/:key).
 */
const CompanyPage: React.FC<CompanyPageProps> = ({ companyKey, workers, onBack, onOpenWorker }) => {
    const isEliorMag = companyKey === 'ELIOR_MAGAZZINO';
    const profileKey = isEliorMag ? 'ELIOR' : companyKey;
    const profile = SYSTEM_PROFILES[profileKey];

    const list = useMemo(
        () =>
            workers
                .filter(w => matchesCompanyFilter(w, companyKey))
                .sort((a, b) =>
                    `${a.cognome ?? ''} ${a.nome ?? ''}`.localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`, 'it')
                ),
        [workers, companyKey]
    );

    // Chiave non valida (non dovrebbe accadere: il routing valida) → ripiego sobrio.
    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <button onClick={onBack} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg">
                    Torna alla home
                </button>
            </div>
        );
    }

    const hex = profile.hex;
    const Icon = profile.modal.icon;
    const title = isEliorMag ? `${profile.detailLabel} · Magazzino` : profile.detailLabel;
    const hasLogo = !!getCompanyLogo(profileKey, isEliorMag ? 'magazzino' : undefined);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 pb-24">

            {/* ── HERO — sfondo neutro, identità data dal colore-azienda come accento.
                Il logo resta A COLORI (in dark diventa silhouette, come in dashboard) su una
                targa neutra che si adatta alla larghezza: i wordmark larghi (Elior) respirano. ── */}
            <div className="relative overflow-hidden">
                {/* Alone soft del colore-azienda: identità senza schiacciare il logo */}
                <motion.div
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.14, 0.26, 0.14] }}
                    transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-28 left-1/2 -translate-x-1/2 w-[46rem] h-[46rem] rounded-full blur-3xl pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${hex}, transparent 70%)` }}
                />

                <div className="max-w-5xl mx-auto px-6 pt-6 pb-10 relative z-10">
                    <button
                        onClick={onBack}
                        className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold shadow-sm hover:shadow-md hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        Indietro
                    </button>

                    <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-7">
                        {/* TARGA LOGO — superficie neutra (i colori del logo si vedono),
                            larghezza adattiva al logo con respiro generoso. */}
                        <motion.div
                            initial={{ opacity: 0, y: 14, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 150, damping: 16 }}
                            className="relative shrink-0 self-start"
                        >
                            <div
                                aria-hidden
                                className="absolute -inset-4 rounded-[2.2rem] blur-2xl opacity-50"
                                style={{ background: `radial-gradient(circle, ${hex}66, transparent 72%)` }}
                            />
                            <div
                                className="relative inline-flex items-center justify-center rounded-[1.75rem] bg-white dark:bg-slate-900 border-2 px-10 py-8 min-h-[7.5rem]"
                                style={{ borderColor: `${hex}33`, boxShadow: `0 26px 64px -28px ${hex}` }}
                            >
                                {hasLogo ? (
                                    <CompanyLogo
                                        profilo={profileKey}
                                        eliorType={isEliorMag ? 'magazzino' : undefined}
                                        h={60}
                                        title={title}
                                    />
                                ) : (
                                    <Icon className="w-16 h-16" style={{ color: hex }} strokeWidth={1.5} />
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: 0.12 }}
                            className="min-w-0"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: hex }} />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: hex }}>Scheda azienda</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                {title}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{profile.sub}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <span
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border"
                                    style={{ color: hex, borderColor: `${hex}40`, backgroundColor: `${hex}14` }}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    {list.length} {list.length === 1 ? 'lavoratore' : 'lavoratori'}
                                </span>
                                <DevBadge label="Sezione nuova — in sviluppo, nuove funzioni in arrivo" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── CONTENUTO ── */}
            <div className="max-w-5xl mx-auto px-6 mt-2 relative z-20 space-y-6">

                {/* Informativa CCNL */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl shadow-slate-900/5"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4" style={{ color: hex }} />
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Informativa CCNL</h2>
                    </div>
                    <p className="text-lg font-black text-slate-800 dark:text-white mb-3">{profile.ccnl}</p>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{profile.ccnlSummary}</p>

                    {profile.ccnlHighlights.length > 0 && (
                        <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {profile.ccnlHighlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                    {h}
                                </li>
                            ))}
                        </ul>
                    )}

                    {(profile.ccnlRef || profile.pec) && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {profile.ccnlRef && (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    Rif. {profile.ccnlRef}
                                </span>
                            )}
                            {profile.pec && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <Mail className="w-3.5 h-3.5" /> {profile.pec}
                                </span>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Elenco lavoratori */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.12 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 overflow-hidden"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="flex items-center gap-2 font-black text-slate-800 dark:text-white">
                            <Users className="w-4 h-4" style={{ color: hex }} />
                            Lavoratori
                        </h2>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                            {list.length}
                        </span>
                    </div>

                    {list.length === 0 ? (
                        <div className="px-6 py-14 flex flex-col items-center text-center text-slate-400">
                            <UserX className="w-10 h-10 mb-3" strokeWidth={1.5} />
                            <p className="font-medium">Nessuna pratica per questa azienda.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {list.map(w => {
                                const cassetto = getCassettoByStatus(w.status);
                                const initial = (w.cognome || w.nome || '?').charAt(0).toUpperCase();
                                return (
                                    <button
                                        key={w.id}
                                        onClick={() => onOpenWorker(w.id)}
                                        title={`Apri ${w.cognome} ${w.nome}`}
                                        className="w-full group flex items-center gap-4 px-6 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                    >
                                        <span
                                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm"
                                            style={{ background: `linear-gradient(135deg, ${hex}, ${hex}aa)` }}
                                        >
                                            {initial}
                                        </span>
                                        <span className="min-w-0 flex-1 font-bold text-slate-800 dark:text-white truncate">
                                            {w.cognome} {w.nome}
                                        </span>
                                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cassetto.accentHex }} />
                                            {cassetto.label}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default CompanyPage;
