import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, FileUp, ListChecks, FileText, ShieldCheck, Moon, CalendarClock, Coffee, CheckCircle2, BookOpen, ChevronRight, AlertTriangle, Euro, CloudUpload, Loader2, BusFront } from 'lucide-react';
import { usePraticheRiposi, STATO_META, type PraticaRiposi, type StatoPratica } from '../hooks/usePraticheRiposi';
import { groupThousandsIT } from '../utils/formatters';
import { computeRestViolations, resolveTariffePerAnno, hasCEEDays, violazioniPerAnno } from '../utils/restEngine';
import RiposiPraticaDetail from './RiposiPraticaDetail';
import { DevBadge } from './ui/DevBadge';
import { useIsReadOnly } from '../lib/readonly';
import { RIPOSI_THEME, riposiHeaderBand, STATO_HEX } from './riposi/riposiTheme';
import { SindacatoTag } from './ui/SindacatoTag';

/** Statistiche per pratica, calcolate una volta a livello area e passate alle card + all'hero. */
type PraticaStats = { tot: number; indennita: number; perAnno: Record<string, { n: number; indennita: number }> };
const euroInt = (n: number) => groupThousandsIT(n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));

// ─── Workflow (cosa farà la pratica, in 3 passi) ──────────────────────────────
const STEPS: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
    { icon: FileUp, title: '1 · Carica i turni', desc: 'Importi il prospetto "Mancati riposi" / SA20: l\'estrazione legge data, servizio, inizio e termine.' },
    { icon: ListChecks, title: '2 · Verifica', desc: 'Controlli le righe (le dubbie sono evidenziate). Il motore calcola riposi e violazioni.' },
    { icon: FileText, title: '3 · Contestazione', desc: 'Esci con la contestazione .docx (Reg. CE 561/2006) e un Excel pulito come allegato.' },
];

// ─── Quadro normativo (sintesi dal vademecum) ─────────────────────────────────
const LIMITI: { icon: React.ComponentType<{ className?: string }>; voce: string; regola: string; rif: string }[] = [
    { icon: Moon, voce: 'Riposo giornaliero', regola: '≥ 11h (ridotto 9h, max 3 volte tra due riposi settimanali)', rif: 'art. 8 §§2,4' },
    { icon: CalendarClock, voce: 'Riposo settimanale', regola: '≥ 45h regolare / 24h ridotto — vietati due ridotti consecutivi', rif: 'art. 8 §6' },
    { icon: Coffee, voce: 'Pausa di guida', regola: 'dopo 4h30 di guida, almeno 45′ (oppure 15′ + 30′)', rif: 'art. 7' },
    { icon: Clock, voce: 'Orario di lavoro', regola: 'media 48h/sett (max 60h); notturno max 10h nelle 24h', rif: 'D.Lgs 234/2007' },
];

// ─── Le violazioni che il motore rileva ───────────────────────────────────────
const VIOLAZIONI: { n: string; titolo: string; rif: string; attiva: boolean; nota?: string }[] = [
    { n: '01', titolo: 'Mancato riposo settimanale', rif: 'art. 8 §6 — due riposi ridotti in due settimane consecutive', attiva: true },
    { n: '02', titolo: 'Mancata pausa di guida', rif: 'art. 7 — oltre 4h30 senza interruzione', attiva: false, nota: 'richiede i dati cronotachigrafo' },
];

/**
 * Landing dell'area "Turni & Riposi". Spiega cosa fa l'area e porta inline la
 * sostanza del vademecum (quadro normativo + violazioni) come quick-reference.
 * Scaffold: il motore (utils/restEngine.ts) è pronto e testato; estrazione PDF,
 * persistenza (pratiche_riposi) e UI di review arrivano in Fase 2.
 */
const RiposiArea: React.FC = () => {
    const { pratiche, isLoading, salvaInArchivio, updatePratica } = usePraticheRiposi();
    const isReadOnly = useIsReadOnly();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statoFiltro, setStatoFiltro] = useState<StatoPratica | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const selected = pratiche.find((p) => p.id === selectedId) ?? null;

    const seedPratica = pratiche.find((p) => p.isSeed);
    const visibili = statoFiltro ? pratiche.filter((p) => p.stato === statoFiltro) : pratiche;

    // Motore per pratica calcolato UNA volta (pesante su 5022 giornate): serve sia alle card sia all'hero.
    const statsByPratica = useMemo(() => {
        const m: Record<string, PraticaStats> = {};
        for (const p of pratiche) {
            const r = computeRestViolations(p.giornate, { tariffaOraria: p.tariffaOraria, tariffePerAnno: resolveTariffePerAnno(p.giornate, p.tariffePerAnno), coefficiente: p.coefficiente, soloCEE: hasCEEDays(p.giornate) });
            m[p.id] = { tot: r.nViolazioniGiornaliere + r.nViolazioniSettimanali, indennita: r.totIndennita, perAnno: violazioniPerAnno(r.violazioni) };
        }
        return m;
    }, [pratiche]);
    const aggregato = visibili.reduce((a, p) => {
        const s = statsByPratica[p.id];
        if (s) { a.tot += s.tot; a.indennita += s.indennita; a.nPratiche += 1; }
        return a;
    }, { tot: 0, indennita: 0, nPratiche: 0 });

    const handleSalvaSeed = async () => {
        if (!seedPratica || isSaving) return;
        setIsSaving(true);
        try {
            const salvata = await salvaInArchivio(seedPratica);
            if (salvata && selectedId === seedPratica.id) setSelectedId(salvata.id);
        } finally {
            setIsSaving(false);
        }
    };

    if (selected) {
        return (
            <RiposiPraticaDetail
                pratica={selected}
                onBack={() => setSelectedId(null)}
                onUpdate={selected.isSeed ? undefined : (fields) => updatePratica(selected.id, fields)}
            />
        );
    }

    return (
        <div className="min-h-screen px-6 py-12">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Committente delle pratiche: "Ufficio Vertenze" + logo FAST-CONFSAL, in alto a destra. */}
                <div className="flex justify-end">
                    <SindacatoTag />
                </div>

                {/* Header hero — identità dell'area + numeri aggregati a colpo d'occhio */}
                <header className="relative overflow-hidden rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-7 shadow-xl">
                    <div className="absolute inset-x-0 top-0 h-40 pointer-events-none" style={{ background: riposiHeaderBand }} />
                    <div className="relative flex flex-wrap items-center gap-5">
                        <div
                            className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg text-white shrink-0"
                            style={{ background: RIPOSI_THEME.gradient, boxShadow: `0 10px 30px -8px ${RIPOSI_THEME.glow}` }}
                        >
                            <Clock className="w-8 h-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">Turni &amp; Riposi</h1>
                            <p className="text-slate-500 dark:text-slate-400">Mancati riposi · Reg. (CE) n. 561/2006 — area separata dalle buste paga</p>
                            <div className="mt-2">
                                <DevBadge label="Sezione nuova — in sviluppo, nuove funzioni in arrivo!" />
                            </div>
                        </div>
                        {aggregato.nPratiche > 0 && (
                            <div className="flex items-stretch gap-3">
                                <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 px-5 py-3 text-center backdrop-blur-sm">
                                    <div className="flex items-center justify-center gap-1 text-rose-500/80 dark:text-rose-400/70"><AlertTriangle className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Violazioni</p></div>
                                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{groupThousandsIT(aggregato.tot.toLocaleString('it-IT'))}</p>
                                </div>
                                <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 px-5 py-3 text-center backdrop-blur-sm">
                                    <div className="flex items-center justify-center gap-1 text-emerald-500/90 dark:text-emerald-400/70"><Euro className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Credito stimato</p></div>
                                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{euroInt(aggregato.indennita)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Pratiche */}
                <section>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Pratiche</h2>
                        {pratiche.length > 0 && (
                            <div className="flex items-center gap-1">
                                {(Object.keys(STATO_META) as StatoPratica[]).map((s) => {
                                    const attivo = statoFiltro === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatoFiltro(attivo ? null : s)}
                                            title={attivo ? 'Mostra tutte le pratiche' : `Solo pratiche «${STATO_META[s].label}»`}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${attivo ? STATO_META[s].chip + ' ring-2 ring-current/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATO_META[s].dot}`} />{STATO_META[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pratica dal seed locale: in archivio solo con azione esplicita */}
                    {seedPratica && (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 mb-3 text-sm text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span className="flex-1 min-w-[16rem]">La pratica <strong>{seedPratica.cognome} {seedPratica.nome}</strong> è caricata dal <strong>seed locale</strong>: salvala nell'archivio per gestirne lo stato.</span>
                            <button
                                type="button"
                                onClick={handleSalvaSeed}
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-wait"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                                Salva nell'archivio
                            </button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                    ) : pratiche.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna pratica. Carica un prospetto turni per iniziare.</p>
                    ) : visibili.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna pratica «{STATO_META[statoFiltro!].label}». Togli il filtro per vederle tutte.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibili.map((p) => (
                                <PraticaCard key={p.id} pratica={p} stats={statsByPratica[p.id]} onOpen={() => setSelectedId(p.id)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Cosa fa quest'area */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl shadow-lg p-7"
                >
                    <div className="lg:flex lg:items-center lg:gap-8">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></span>
                                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Cosa fa quest'area</h2>
                            </div>
                            <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                                Verifica i <strong>mancati riposi</strong> dei conducenti del trasporto di linea e ne calcola le
                                indennità. Si carica il prospetto turni, il motore controlla i riposi giornalieri e settimanali
                                secondo il <strong>Reg. (CE) 561/2006</strong> — letto insieme al <strong>D.Lgs 234/2007</strong> sull'orario
                                di lavoro — e produce una contestazione pronta da valutare.
                            </p>
                            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                Strumento di preparazione: i risultati sono input neutri per la decisione dell'avvocato.
                            </p>
                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                {/* Vademecum (.docx) — nascosto al viewer (sola lettura): è un download. */}
                                {!isReadOnly && (
                                <a
                                    href={`${import.meta.env.BASE_URL}vademecum-turni-riposi.docx`}
                                    download="Vademecum_Turni_Riposi_FAST.docx"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/30 transition-colors"
                                >
                                    <BookOpen className="w-4 h-4" /> Apri il vademecum
                                </a>
                                )}
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-semibold cursor-not-allowed"
                                >
                                    <FileUp className="w-4 h-4" /> Nuova pratica (in arrivo)
                                </button>
                            </div>
                        </div>
                        {/* Illustrazione tematica dell'area (Flow, whitelabel: nessun brand) */}
                        <img
                            src="/riposi-illustrazione.webp"
                            alt="Bus di linea, orologio e disco del tachigrafo accanto al prospetto turni"
                            loading="lazy"
                            draggable={false}
                            className="mt-6 lg:mt-0 w-full lg:w-80 shrink-0 rounded-2xl select-none"
                        />
                    </div>
                </motion.div>

                {/* Come funziona + Quadro normativo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Come funziona */}
                    <section className="rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl shadow-lg p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                            <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"><ListChecks className="w-4 h-4" /></span>
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Come funziona</h3>
                        </div>
                        <div className="space-y-4">
                            {STEPS.map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="flex gap-3">
                                    <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: RIPOSI_THEME.gradient }}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{title}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Quadro normativo */}
                    <section className="rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl shadow-lg p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                            <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0"><CalendarClock className="w-4 h-4" /></span>
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Quadro normativo · soglie chiave</h3>
                        </div>
                        <div className="space-y-3">
                            {LIMITI.map(({ icon: Icon, voce, regola, rif }) => (
                                <div key={voce} className="flex gap-3">
                                    <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                                            {voce} <span className="ml-1 text-[11px] font-medium text-indigo-500 dark:text-indigo-400">{rif}</span>
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{regola}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Violazioni rilevate */}
                <section className="rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl shadow-lg p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4" /></span>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Violazioni che il motore rileva</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {VIOLAZIONI.map(({ n, titolo, rif, attiva, nota }) => (
                            <div key={n} className={`rounded-2xl border p-4 ${attiva ? 'border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10' : 'border-slate-200/80 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/40'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500">VIOLAZIONE N. {n}</span>
                                    {attiva ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> attiva
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">v2 · {nota}</span>
                                    )}
                                </div>
                                <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{titolo}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{rif}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Fonti di prova */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Fonti di prova:</span>
                    {['Rapportini SA20', 'Turni programmati', 'Turni effettuati', 'Libro Unico del Lavoro'].map((f) => (
                        <span key={f} className="px-3 py-1 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur border border-white/60 dark:border-slate-700/60 shadow-sm">{f}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

/** Anno da una data pratica, robusto al formato (seed "DD/MM/YYYY" o DB "YYYY-MM-DD"). */
const annoDi = (d?: string): string => (!d ? '' : d.includes('/') ? (d.split('/')[2] ?? '') : (d.split('-')[0] ?? ''));

/** Mini-timeline: una barra per anno del range, altezza ∝ n° violazioni. Gemello della YearTimeline delle buste. */
const MiniTimelineViol: React.FC<{ perAnno: Record<string, { n: number; indennita: number }> }> = ({ perAnno }) => {
    const years = Object.keys(perAnno).map(Number);
    if (years.length === 0) return null;
    const y0 = Math.min(...years), y1 = Math.max(...years);
    const span: number[] = [];
    for (let y = y0; y <= y1; y++) span.push(y);
    const maxN = Math.max(...span.map((y) => perAnno[String(y)]?.n ?? 0), 1);
    return (
        <div className="mt-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Violazioni per anno</span>
            <div className="relative h-14 mt-1.5">
                {/* Griglia orizzontale di riferimento */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="h-px bg-slate-200/70 dark:bg-slate-700/40" />)}
                </div>
                {/* Barre (gradiente verticale) */}
                <div className="relative flex gap-[3px] items-end h-full px-0.5">
                    {span.map((y) => {
                        const c = perAnno[String(y)];
                        const h = c ? Math.max(14, Math.round((c.n / maxN) * 100)) : 6;
                        return (
                            <div
                                key={y}
                                title={c ? `${y} · ${c.n} violazioni · ${euroInt(c.indennita)}` : `${y} · nessuna violazione`}
                                className={`flex-1 min-w-0 rounded-t-md transition-all duration-200 hover:brightness-110 ${c ? 'shadow-sm' : 'bg-slate-200/70 dark:bg-slate-700/50'}`}
                                style={{ height: `${h}%`, background: c ? `linear-gradient(180deg, ${RIPOSI_THEME.end} 0%, ${RIPOSI_THEME.start} 100%)` : undefined }}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="flex justify-between px-0.5 mt-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{y0}</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{y1}</span>
            </div>
        </div>
    );
};

const PraticaCard: React.FC<{ pratica: PraticaRiposi; stats?: PraticaStats; onOpen: () => void }> = ({ pratica, stats, onOpen }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [hover, setHover] = useState(false);

    const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const x = e.clientX - r.left, y = e.clientY - r.top;
        setPos({ x, y });
        setTilt({ x: -((y / r.height) - 0.5) * 8, y: ((x / r.width) - 0.5) * 8 });
    };

    const stato = STATO_META[pratica.stato];
    const statoHex = STATO_HEX[pratica.stato] ?? '#94a3b8';

    return (
        <div style={{ perspective: '1200px' }} className="w-full">
            <button
                ref={ref}
                onClick={onOpen}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => { setHover(false); setTilt({ x: 0, y: 0 }); }}
                onMouseMove={onMove}
                className="group relative overflow-hidden w-full text-left rounded-[1.75rem] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-lg hover:shadow-[0_24px_60px_-24px_rgba(99,102,241,0.55)]"
                style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', transition: hover ? 'box-shadow .3s' : 'transform .4s ease, box-shadow .3s' }}
            >
                {/* Testata gradiente del brand-area */}
                <div className="absolute inset-x-0 top-0 h-28 pointer-events-none" style={{ background: riposiHeaderBand }} />
                {/* Tinta lavanda diffusa sull'intera card */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.04) 45%, transparent 80%)' }} />
                {/* Spotlight che segue il mouse */}
                <div className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10" style={{ opacity: hover ? 1 : 0, background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, ${RIPOSI_THEME.spotlight}, transparent 40%)` }} />
                {/* Tacca stato laterale con glow */}
                <div
                    className="absolute left-0 top-7 bottom-7 w-[5px] rounded-r-full z-20 transition-all duration-500 group-hover:w-[7px]"
                    title={stato.label}
                    style={{ background: `linear-gradient(180deg, ${statoHex}00 0%, ${statoHex} 14%, ${statoHex} 86%, ${statoHex}00 100%)`, boxShadow: `0 0 14px 2px ${statoHex}55` }}
                />

                <div className="relative z-20 p-5 pl-6">
                    <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                            {/* Alone iridescente dietro l'avatar */}
                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-fuchsia-400 via-indigo-400 to-cyan-400 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
                            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center bg-white/85 dark:bg-slate-900/70 backdrop-blur border border-white/70 dark:border-slate-700 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <BusFront className="w-7 h-7 text-indigo-600 dark:text-indigo-300" strokeWidth={1.8} />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight tracking-tight uppercase truncate">{pratica.cognome}</h3>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-snug capitalize truncate">{pratica.nome}</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mt-1">{pratica.mansione}{pratica.periodoStart ? ` · ${annoDi(pratica.periodoStart)}–${annoDi(pratica.periodoEnd)}` : ''}</p>
                        </div>
                        <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border border-white/60 dark:border-white/10 ${stato.chip}`}
                            style={{ boxShadow: `0 0 0 1px ${statoHex}33, 0 3px 12px -2px ${statoHex}66` }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statoHex, boxShadow: `0 0 6px ${statoHex}` }} />{stato.label}
                        </span>
                    </div>

                    <MiniTimelineViol perAnno={stats?.perAnno ?? {}} />

                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="px-3 py-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-700/40 transition-all duration-300 hover:scale-[1.03]">
                            <div className="flex items-center gap-1 mb-0.5"><Euro className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400/70" /><p className="text-[8px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/60">Credito</p></div>
                            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">{stats ? euroInt(stats.indennita) : '—'}</p>
                        </div>
                        <div className="px-3 py-2.5 rounded-2xl bg-rose-50/80 dark:bg-rose-900/20 border border-rose-200/80 dark:border-rose-700/40 transition-all duration-300 hover:scale-[1.03]">
                            <div className="flex items-center gap-1 mb-0.5"><AlertTriangle className="w-2.5 h-2.5 text-rose-500/80 dark:text-rose-400/70" /><p className="text-[8px] font-black uppercase tracking-widest text-rose-600/70 dark:text-rose-400/60">Violazioni</p></div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums leading-none">{stats ? groupThousandsIT(stats.tot.toLocaleString('it-IT')) : '—'}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        {pratica.isSeed ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">seed locale</span> : <span />}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                </div>
            </button>
        </div>
    );
};

export default RiposiArea;
