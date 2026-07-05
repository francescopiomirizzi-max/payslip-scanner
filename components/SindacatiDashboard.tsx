import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Clock, MapPin, ChevronRight, X, Users, Calculator, Plus, ArrowRight } from 'lucide-react';
import type { AppArea } from './AreaSwitch';
import { CompanyLogo } from './ui/CompanyLogo';
import { AnimatedLogo } from './ui/AnimatedLogo';

/** Un'organizzazione committente: sindacato (vertenze) o CAF/Patronato (fiscale+previdenziale). Multi: se ne possono avere N. */
export interface OrganizzazioneInfo {
    id: string;
    nome: string;
    tipo: 'sindacato' | 'caf';
    logo: string;
    sezioni: AppArea[];
}

/** Riga minima di pratica per il riepilogo (dai worker reali dell'account). */
export interface PraticaRow {
    id: string;
    nome: string;
    cognome: string;
    profilo: string;
    status?: string;
}

const SEZIONE_META: Record<AppArea, { label: string; sub: string; icon: React.ComponentType<{ className?: string }>; gradient: string; glow: string; text: string }> = {
    incidenza: { label: 'Incidenza', sub: 'Buste paga · differenze retributive', icon: Wallet, gradient: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.45)', text: 'group-hover/sez:text-emerald-600 dark:group-hover/sez:text-emerald-400' },
    riposi: { label: 'Turni & Riposi', sub: 'Mancati riposi · Reg. CE 561/2006', icon: Clock, gradient: 'from-indigo-500 to-violet-500', glow: 'rgba(99,102,241,0.45)', text: 'group-hover/sez:text-indigo-600 dark:group-hover/sez:text-indigo-400' },
    indennita: { label: 'Indennità', sub: 'Assenza residenza · voci 4300/4305', icon: MapPin, gradient: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.45)', text: 'group-hover/sez:text-amber-600 dark:group-hover/sez:text-amber-400' },
};

const CATEGORIE = {
    sindacato: { titolo: 'Sindacati', desc: 'Vertenze e tutele: differenze retributive, mancati riposi, indennità.', icon: Users, gradient: 'from-[#1E3A5F] to-[#0d9488]' },
    caf: { titolo: 'CAF e Patronato', desc: 'Assistenza fiscale e previdenziale: 730, ISEE, pensioni, NASPI, invalidità. Sezioni in arrivo.', icon: Calculator, gradient: 'from-[#0d9488] to-emerald-500' },
} as const;

/** Ingresso morbido (fade + salita) per gli elementi della dashboard. */
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

/** Curve morbide di sfondo (teal/emerald tenui) — richiamo del monogramma. */
const DecorCurves: React.FC = () => (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900" aria-hidden="true">
        <g fill="none" stroke="#14b8a6" strokeWidth="2" className="opacity-[0.30] dark:opacity-[0.20]">
            <path d="M-120,240 C260,80 520,360 860,220 S1360,120 1620,340" />
            <path d="M-120,320 C280,180 560,440 900,300 S1400,210 1640,420" />
            <path d="M-120,420 C300,300 600,560 960,410 S1440,320 1680,520" />
        </g>
        <g fill="none" stroke="#10b981" strokeWidth="1.75" className="opacity-[0.24] dark:opacity-[0.16]">
            {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx="1440" cy="450" rx={220 + i * 140} ry={320 + i * 150} />)}
        </g>
    </svg>
);

/**
 * Dashboard iniziale di ValOra — la base del sito. Topbar brand, due mondi (Sindacati / CAF) con
 * MULTI-organizzazione (card-logo + slot "+"), riepilogo pratiche recenti. Click su un'organizzazione
 * → popup con le sezioni. Immagini fuse nella card (loghi trasparenti, illustrazione CAF sfumata).
 */
export const SindacatiDashboard: React.FC<{
    organizzazioni: OrganizzazioneInfo[];
    pratiche: PraticaRow[];
    onSelect: (organizzazioneId: string, sezione: AppArea) => void;
}> = ({ organizzazioni, pratiche, onSelect }) => {
    const [openId, setOpenId] = useState<string | null>(null);
    const open = organizzazioni.find((o) => o.id === openId) ?? null;
    const sindacati = useMemo(() => organizzazioni.filter((o) => o.tipo === 'sindacato'), [organizzazioni]);
    const caf = useMemo(() => organizzazioni.filter((o) => o.tipo === 'caf'), [organizzazioni]);
    const recenti = useMemo(() => pratiche.slice(0, 5), [pratiche]);

    return (
        <div className="relative min-h-screen">
            {/* Sfondo dedicato: chiaro con curve teal (copre i blob globali) + aurore che derivano piano */}
            <div className="fixed inset-0 -z-[5] overflow-hidden pointer-events-none bg-gradient-to-b from-white via-emerald-50/40 to-teal-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-teal-300/25 dark:bg-teal-500/10 blur-3xl motion-safe:[animation:blob_18s_ease-in-out_infinite]" />
                <div className="absolute top-1/3 -right-28 w-[30rem] h-[30rem] rounded-full bg-emerald-300/25 dark:bg-emerald-500/10 blur-3xl motion-safe:[animation:blob_22s_ease-in-out_infinite] motion-safe:[animation-delay:5s]" />
                <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-cyan-300/20 dark:bg-cyan-500/[0.07] blur-3xl motion-safe:[animation:blob_26s_ease-in-out_infinite] motion-safe:[animation-delay:9s]" />
                <DecorCurves />
            </div>

            {/* Topbar */}
            <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/70 dark:border-slate-800 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center gap-3">
                    <AnimatedLogo imgClassName="neon-vo h-11 w-auto object-contain select-none dark:brightness-0 dark:invert" delay={0.1} />
                    <span className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">VALORA <span className="font-semibold text-slate-400 dark:text-slate-500">— Dashboard Personale</span></span>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12">
                <motion.div className="text-center mb-10" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-800 dark:text-slate-100">Benvenuto!</h1>
                    <p className="mt-2 text-lg sm:text-xl font-bold text-slate-600 dark:text-slate-300">Gestisci le tue pratiche <span className="text-teal-600 dark:text-teal-400">sindacali</span>, <span className="text-emerald-600 dark:text-emerald-400">fiscali</span> e <span className="text-emerald-600 dark:text-emerald-400">previdenziali</span>.</p>
                </motion.div>

                {/* Due mondi, multi-organizzazione — ingresso a cascata */}
                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.14, delayChildren: 0.12 } } }}
                >
                    <motion.div variants={fadeUp} className="h-full">
                        <CategoriaPanel tipo="sindacato" orgs={sindacati} onOpen={setOpenId} />
                    </motion.div>
                    <motion.div variants={fadeUp} className="h-full">
                        <CategoriaPanel tipo="caf" orgs={caf} onOpen={setOpenId} />
                    </motion.div>
                </motion.div>

                {/* Recenti pratiche */}
                <motion.section className="mt-10" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">Recenti pratiche</h3>
                    <div className="rounded-[1.5rem] bg-white/80 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/70 dark:border-slate-700/60 shadow-xl overflow-hidden">
                        {recenti.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 px-6 py-10">
                                <img src="/dashboard-empty.webp" alt="" loading="lazy" draggable={false} className="h-24 w-auto select-none" />
                                <p className="text-sm text-slate-400 text-center">Nessuna pratica ancora.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/60">
                                            <th className="text-left font-bold px-6 py-3">Lavoratore</th>
                                            <th className="text-left font-bold px-3 py-3">Azienda</th>
                                            <th className="text-left font-bold px-3 py-3 w-[38%]">Stato</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recenti.map((p) => {
                                            const completata = p.status === 'chiusa';
                                            return (
                                                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700/40 last:border-0 transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-500/[0.04]">
                                                    <td className="px-6 py-3.5 font-bold text-slate-700 dark:text-slate-200"><span className="uppercase">{p.cognome}</span> <span className="font-medium text-slate-500 dark:text-slate-400 capitalize">{p.nome}</span></td>
                                                    <td className="px-3 py-3.5"><CompanyLogo profilo={p.profilo} h={16} title={p.profilo} /></td>
                                                    <td className="px-3 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden max-w-[220px]">
                                                                <div className="h-full rounded-full" style={{ width: completata ? '100%' : '55%', backgroundImage: 'linear-gradient(to right, #10b981, #1E3A5F)' }} />
                                                            </div>
                                                            <span className={`text-[11px] font-bold ${completata ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{completata ? 'Completata' : 'In lavorazione'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.section>

                <footer className="mt-12 pt-5 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex flex-wrap items-center gap-4 font-semibold">
                        {['Chi siamo', 'Assistenza', 'Contatti', 'Privacy'].map((l) => <span key={l} className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-default">{l}</span>)}
                    </div>
                    <span>ValOra · Tutti i diritti riservati</span>
                </footer>
            </div>

            {/* Popup sezioni (portal) */}
            {createPortal(
                <AnimatePresence>
                    {open && open.sezioni.length > 0 && (
                        <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenId(null)}>
                            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 12 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-[1.75rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-2xl overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center h-12 dark:bg-white dark:rounded-lg dark:px-2 dark:py-1">
                                        <img src={open.logo} alt={open.nome} className="max-h-12 w-auto object-contain" draggable={false} />
                                    </div>
                                    <button onClick={() => setOpenId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="p-3 space-y-2">
                                    <p className="px-3 pt-1 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Sezioni</p>
                                    {open.sezioni.map((sez) => {
                                        const m = SEZIONE_META[sez];
                                        const Icon = m.icon;
                                        return (
                                            <button key={sez} onClick={() => { onSelect(open.id, sez); setOpenId(null); }} className="group/sez w-full flex items-center gap-3.5 text-left rounded-2xl px-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${m.gradient} flex items-center justify-center text-white shrink-0 shadow-lg transition-transform duration-300 group-hover/sez:scale-110 group-hover/sez:rotate-3`} style={{ boxShadow: `0 8px 22px -8px ${m.glow}` }}>
                                                    <Icon className="w-5 h-5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block font-black text-slate-800 dark:text-slate-100 leading-tight transition-colors ${m.text}`}>{m.label}</span>
                                                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{m.sub}</span>
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover/sez:translate-x-0.5 transition-transform shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </div>
    );
};

/** Card-logo di un'organizzazione: logo fuso (trasparente in light, alone morbido in dark). */
const OrgCard: React.FC<{ org: OrganizzazioneInfo; onOpen: (id: string) => void }> = ({ org, onOpen }) => (
    <button
        onClick={() => onOpen(org.id)}
        title={`Apri ${org.nome}`}
        className="group relative flex items-center justify-center h-24 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 dark:hover:border-teal-500/50 hover:shadow-[0_18px_40px_-20px_rgba(13,148,136,0.5)]"
    >
        {/* Alone morbido dietro il logo SOLO in dark (nessuna pastiglia netta): fonde il logo col fondo scuro */}
        <div className="absolute inset-3 rounded-2xl blur-xl dark:bg-white/85 transition-opacity" />
        <img src={org.logo} alt={org.nome} className="relative max-h-16 w-auto object-contain px-3 select-none transition-transform duration-300 group-hover:scale-105" draggable={false} />
    </button>
);

/** Pannello di una macro-categoria. Sindacati: organizzazione principale IN GRANDE + spazio per aggiungerne
 *  altre sotto. CAF: illustrazione della categoria + le sue organizzazioni sotto. */
const CategoriaPanel: React.FC<{ tipo: 'sindacato' | 'caf'; orgs: OrganizzazioneInfo[]; onOpen: (id: string) => void }> = ({ tipo, orgs, onOpen }) => {
    const cat = CATEGORIE[tipo];
    const Icon = cat.icon;
    const principale = tipo === 'sindacato' ? (orgs[0] ?? null) : null;
    const altri = tipo === 'sindacato' ? orgs.slice(1) : orgs;

    return (
        <section className="flex flex-col h-full rounded-[1.75rem] bg-white/80 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/70 dark:border-slate-700/60 shadow-xl p-6 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-2xl hover:shadow-teal-900/10 hover:border-teal-200/80 dark:hover:border-teal-500/40">
            <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-white shrink-0 shadow-lg`}><Icon className="w-7 h-7" /></div>
                <div className="min-w-0">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">{cat.titolo}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug">{cat.desc}</p>
                </div>
            </div>

            {/* Elemento grande: sindacato principale col logo tra parentesi + "Accedi"; oppure illustrazione CAF */}
            {tipo === 'sindacato' && principale ? (
                <>
                    {/* Fascia speculare a quella CAF: stessa larghezza (bleed -mx-1) e stessa
                        altezza (aspect-ratio dell'illustrazione), ma TRASPARENTE — nessun fondo
                        né bordo: il logo si fonde con la card. Le parentesi sono l'unico elemento al neon. */}
                    <div className="mt-6 -mx-1 aspect-[1600/893] relative flex items-center justify-center">
                        <span className="neon-bracket absolute left-[8%] top-8 bottom-8 w-6 border-l-[3px] border-t-[3px] border-b-[3px] rounded-l-xl" />
                        <span className="neon-bracket absolute right-[8%] top-8 bottom-8 w-6 border-r-[3px] border-t-[3px] border-b-[3px] rounded-r-xl" />
                        <div className="relative">
                            <div className="absolute inset-2 rounded-2xl blur-2xl dark:bg-white/85" />
                            <img src={principale.logo} alt={principale.nome} className="relative max-h-32 w-auto object-contain px-6 select-none" draggable={false} />
                        </div>
                    </div>
                    <button
                        onClick={() => onOpen(principale.id)}
                        className="group mt-6 mx-auto inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 transition-all"
                        style={{ backgroundImage: 'linear-gradient(to right, #10b981, #0d9488)' }}
                    >
                        Accedi alle pratiche <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                </>
            ) : tipo === 'caf' ? (
                <>
                    <div className="mt-6 -mx-1 rounded-2xl overflow-hidden dark:bg-gradient-to-b dark:from-slate-100/90 dark:to-slate-200/70">
                        <img src="/caf-patronato-illustrazione.webp" alt="Assistenza fiscale e previdenziale · 730, ISEE, pensioni, NASPI" className="w-full select-none" draggable={false} />
                    </div>
                    <button disabled className="mt-6 mx-auto inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 font-bold cursor-not-allowed">
                        Accedi alle pratiche <span className="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600/60">in arrivo</span>
                    </button>
                </>
            ) : null}

            {/* Spazio per aggiungere altre organizzazioni della categoria */}
            <div className="mt-auto pt-5 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-3">{tipo === 'sindacato' ? 'Aggiungi altri sindacati' : 'I tuoi CAF e Patronati'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {altri.map((o) => <OrgCard key={o.id} org={o} onOpen={onOpen} />)}
                    <div title="Aggiunta organizzazioni · in arrivo" className="flex flex-col items-center justify-center gap-1 h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-teal-300 dark:hover:border-teal-500/40 hover:text-teal-400 transition-colors cursor-pointer">
                        <Plus className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Aggiungi</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SindacatiDashboard;
