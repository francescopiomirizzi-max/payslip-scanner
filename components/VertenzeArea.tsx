import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ChevronRight, Euro, Scale, FileText, ShieldCheck, AlertTriangle, Users } from 'lucide-react';
import { usePraticheVertenze, STATO_META_VERTENZA, type PraticaVertenza, type StatoVertenza, type WorkerLike } from '../hooks/usePraticheVertenze';
import { computeVertenza, type RigaAnnoVertenza } from '../utils/vertenzaEngine';
import { CompanyLogo } from './ui/CompanyLogo';
import { SindacatoTag } from './ui/SindacatoTag';
import { DevBadge } from './ui/DevBadge';
import VertenzaDetail from './VertenzaDetail';
import { VERTENZE_THEME, vertenzeHeaderBand, STATO_HEX_VERTENZA } from './vertenze/vertenzeTheme';

const eur0 = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Anno da una data pratica, robusto al formato ("DD/MM/YYYY" seed o "YYYY-MM-DD" DB). */
const annoDi = (d?: string): string => (!d ? '' : d.includes('/') ? (d.split('/')[2] ?? '') : (d.split('-')[0] ?? ''));

/** Statistiche per pratica, calcolate una volta a livello area e passate a card + hero. */
type PraticaStats = { credito: number; anni: number; vuota: boolean; perAnno: RigaAnnoVertenza[] };

/** Mini-timeline: una barra per anno del range, altezza ∝ differenza €. Gemella della MiniTimeline dei Riposi. */
const MiniTimelineDiff: React.FC<{ perAnno: RigaAnnoVertenza[] }> = ({ perAnno }) => {
    if (perAnno.length === 0) return null;
    const years = perAnno.map((r) => Number(r.anno)).filter((n) => !Number.isNaN(n));
    if (years.length === 0) return null;
    const y0 = Math.min(...years), y1 = Math.max(...years);
    const span: number[] = [];
    for (let y = y0; y <= y1; y++) span.push(y);
    const byYear = new Map(perAnno.map((r) => [r.anno, r.totale]));
    const maxV = Math.max(...perAnno.map((r) => r.totale), 1);
    return (
        <div className="mt-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Differenze per anno</span>
            <div className="relative h-14 mt-1.5">
                {/* Griglia orizzontale di riferimento */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="h-px bg-slate-200/70 dark:bg-slate-700/40" />)}
                </div>
                {/* Barre (gradiente verticale rame) */}
                <div className="relative flex gap-[3px] items-end h-full px-0.5">
                    {span.map((y) => {
                        const v = byYear.get(String(y));
                        const h = v ? Math.max(14, Math.round((v / maxV) * 100)) : 6;
                        return (
                            <div
                                key={y}
                                title={v ? `${y} · ${eur0(v)}` : `${y} · nessuna differenza`}
                                className={`flex-1 min-w-0 rounded-t-md transition-all duration-200 hover:brightness-110 ${v ? 'shadow-sm' : 'bg-slate-200/70 dark:bg-slate-700/50'}`}
                                style={{ height: `${h}%`, background: v ? `linear-gradient(180deg, ${VERTENZE_THEME.end} 0%, ${VERTENZE_THEME.start} 100%)` : undefined }}
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

/**
 * Landing dell'area "Indennità" — vertenza assenza residenza (Elior viaggiante).
 * La lista si auto-popola dai worker ELIOR/viaggiante; identità RAME per distinguersi
 * a colpo d'occhio dai Riposi (indaco) e dall'Incidenza (smeraldo).
 */
const VertenzeArea: React.FC<{ workers: WorkerLike[] }> = ({ workers }) => {
    const { pratiche, isLoading, updatePratica } = usePraticheVertenze(workers);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statoFiltro, setStatoFiltro] = useState<StatoVertenza | null>(null);
    const selected = pratiche.find((p) => p.id === selectedId) ?? null;

    // Motore per pratica calcolato UNA volta: serve sia alle card sia all'hero aggregato.
    const statsByPratica = useMemo(() => {
        const m = new Map<string, PraticaStats>();
        for (const p of pratiche) {
            const r = computeVertenza(p.voci, p.prescrizione, { coefficiente: p.coefficiente });
            const righe = p.voci.reduce((n, v) => n + v.righe.length, 0);
            m.set(p.id, { credito: r.totCredito, anni: r.perAnno.length, vuota: righe === 0, perAnno: r.perAnno });
        }
        return m;
    }, [pratiche]);

    const aggregato = useMemo(() => {
        let credito = 0;
        for (const s of statsByPratica.values()) credito += s.credito;
        return { nLavoratori: pratiche.length, credito };
    }, [statsByPratica, pratiche.length]);

    const visibili = statoFiltro ? pratiche.filter((p) => p.stato === statoFiltro) : pratiche;

    if (selected) {
        return (
            <VertenzaDetail
                pratica={selected}
                onBack={() => setSelectedId(null)}
                onUpdate={(fields) => updatePratica(selected.id, fields)}
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

                {/* Header hero — identità dell'area + numeri aggregati a colpo d'occhio (gemello Riposi) */}
                <header className="relative overflow-hidden rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-7 shadow-xl">
                    <div className="absolute inset-x-0 top-0 h-40 pointer-events-none" style={{ background: vertenzeHeaderBand }} />
                    <div className="relative flex flex-wrap items-center gap-5">
                        <div
                            className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg text-white shrink-0"
                            style={{ background: VERTENZE_THEME.gradient, boxShadow: `0 10px 30px -8px ${VERTENZE_THEME.glow}` }}
                        >
                            <MapPin className="w-8 h-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">Indennità di assenza residenza</h1>
                            <p className="text-slate-500 dark:text-slate-400">Differenze retributive voci 4300/4305 · Elior viaggiante · CCNL 2016</p>
                            <div className="mt-2">
                                <DevBadge label="Sezione nuova — in sviluppo, nuove funzioni in arrivo!" />
                            </div>
                        </div>
                        {aggregato.nLavoratori > 0 && (
                            <div className="flex items-stretch gap-3">
                                <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 px-5 py-3 text-center backdrop-blur-sm">
                                    <div className="flex items-center justify-center gap-1 text-amber-500/90 dark:text-amber-400/70"><Users className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Lavoratori</p></div>
                                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{aggregato.nLavoratori}</p>
                                </div>
                                <div className="rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 px-5 py-3 text-center backdrop-blur-sm">
                                    <div className="flex items-center justify-center gap-1 text-emerald-500/90 dark:text-emerald-400/70"><Euro className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Credito stimato</p></div>
                                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">{eur0(aggregato.credito)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Pratiche */}
                <section>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Lavoratori</h2>
                        {pratiche.length > 0 && (
                            <div className="flex items-center gap-1">
                                {(Object.keys(STATO_META_VERTENZA) as StatoVertenza[]).map((s) => {
                                    const attivo = statoFiltro === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatoFiltro(attivo ? null : s)}
                                            title={attivo ? 'Mostra tutti' : `Solo «${STATO_META_VERTENZA[s].label}»`}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${attivo ? STATO_META_VERTENZA[s].chip + ' ring-2 ring-current/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATO_META_VERTENZA[s].dot}`} />{STATO_META_VERTENZA[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                    ) : pratiche.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nessun lavoratore Elior viaggiante in archivio.</p>
                    ) : visibili.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nessun lavoratore «{STATO_META_VERTENZA[statoFiltro!].label}». Togli il filtro.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {visibili.map((p) => (
                                <PraticaCard key={p.id} pratica={p} stats={statsByPratica.get(p.id)} onOpen={() => setSelectedId(p.id)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Cosa fa quest'area */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-7"
                >
                    <div className="lg:flex lg:items-center lg:gap-8">
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Cosa fa quest'area</h2>
                            <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                                Calcola le <strong>differenze retributive sull'indennità di assenza dalla residenza</strong> dei
                                lavoratori Elior <strong>viaggiante</strong>: per le voci <strong>4300</strong> e <strong>4305</strong> la misura
                                corrisposta (ridotta) è confrontata con la misura piena prevista dal <strong>CCNL 2016</strong>; la
                                differenza, anno per anno e nel rispetto della prescrizione, forma il credito da allegare al ricorso.
                            </p>
                            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                Strumento di preparazione: i risultati sono input neutri per la decisione dell'avvocato.
                            </p>
                        </div>
                        {/* Illustrazione tematica dell'area (Flow, whitelabel: nessun brand) */}
                        <img
                            src="/indennita-illustrazione.webp"
                            alt="Casa, segnaposto e valigia accanto alla busta paga: indennità di assenza dalla residenza"
                            loading="lazy"
                            draggable={false}
                            className="mt-6 lg:mt-0 w-full lg:w-72 shrink-0 rounded-2xl select-none"
                        />
                    </div>
                </motion.div>

                {/* Base giuridica (sintesi) */}
                <section className="rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-6">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Base giuridica · sintesi</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { icon: Scale, voce: 'Misura dell\'indennità', regola: 'pagata 0,75 / 1,00 €/h vs CCNL 2016 1,30 / 2,20 €/h', rif: 'art. 77 CCNL' },
                            { icon: FileText, voce: 'Periodo', regola: 'novembre 2017 – luglio 2023', rif: 'ricorso ex art. 414 c.p.c.' },
                        ].map(({ icon: Icon, voce, regola, rif }) => (
                            <div key={voce} className="flex gap-3">
                                <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                                        {voce} <span className="ml-1 text-[11px] font-medium text-amber-500 dark:text-amber-400">{rif}</span>
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{regola}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

const PraticaCard: React.FC<{ pratica: PraticaVertenza; stats?: PraticaStats; onOpen: () => void }> = ({ pratica, stats, onOpen }) => {
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

    const stato = STATO_META_VERTENZA[pratica.stato];
    const statoHex = STATO_HEX_VERTENZA[pratica.stato] ?? '#94a3b8';
    const vuota = stats?.vuota ?? true;

    return (
        <div style={{ perspective: '1200px' }} className="w-full">
            <button
                ref={ref}
                onClick={onOpen}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => { setHover(false); setTilt({ x: 0, y: 0 }); }}
                onMouseMove={onMove}
                className="group relative overflow-hidden w-full text-left rounded-[1.75rem] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-lg hover:shadow-[0_24px_60px_-24px_rgba(245,158,11,0.55)]"
                style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', transition: hover ? 'box-shadow .3s' : 'transform .4s ease, box-shadow .3s' }}
            >
                {/* Testata gradiente del brand-area */}
                <div className="absolute inset-x-0 top-0 h-28 pointer-events-none" style={{ background: vertenzeHeaderBand }} />
                {/* Tinta rame diffusa sull'intera card */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(234,88,12,0.04) 45%, transparent 80%)' }} />
                {/* Spotlight che segue il mouse */}
                <div className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10" style={{ opacity: hover ? 1 : 0, background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, ${VERTENZE_THEME.spotlight}, transparent 40%)` }} />
                {/* Tacca stato laterale con glow */}
                <div
                    className="absolute left-0 top-7 bottom-7 w-[5px] rounded-r-full z-20 transition-all duration-500 group-hover:w-[7px]"
                    title={stato.label}
                    style={{ background: `linear-gradient(180deg, ${statoHex}00 0%, ${statoHex} 14%, ${statoHex} 86%, ${statoHex}00 100%)`, boxShadow: `0 0 14px 2px ${statoHex}55` }}
                />

                <div className="relative z-20 p-5 pl-6">
                    <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                            {/* Alone iridescente (rame) dietro l'avatar */}
                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
                            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center bg-white/85 dark:bg-slate-900/70 backdrop-blur border border-white/70 dark:border-slate-700 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <MapPin className="w-7 h-7 text-amber-600 dark:text-amber-300" strokeWidth={1.8} />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight tracking-tight uppercase truncate">{pratica.cognome}</h3>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-snug capitalize truncate">{pratica.nome}</p>
                            <span className="mt-1 inline-flex items-center gap-1.5">
                                <CompanyLogo profilo="ELIOR" eliorType="viaggiante" h={16} title="Elior viaggiante" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                                    Viaggiante{pratica.periodoStart ? ` · ${annoDi(pratica.periodoStart)}–${annoDi(pratica.periodoEnd)}` : ''}
                                </span>
                            </span>
                        </div>
                        <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border border-white/60 dark:border-white/10 ${stato.chip}`}
                            style={{ boxShadow: `0 0 0 1px ${statoHex}33, 0 3px 12px -2px ${statoHex}66` }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statoHex, boxShadow: `0 0 6px ${statoHex}` }} />{stato.label}
                        </span>
                    </div>

                    <MiniTimelineDiff perAnno={stats?.perAnno ?? []} />

                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="px-3 py-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-700/40 transition-all duration-300 hover:scale-[1.03]">
                            <div className="flex items-center gap-1 mb-0.5"><Euro className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400/70" /><p className="text-[8px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/60">Credito</p></div>
                            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">{stats && !vuota ? eur0(stats.credito) : '—'}</p>
                        </div>
                        <div className="px-3 py-2.5 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-700/40 transition-all duration-300 hover:scale-[1.03]">
                            <div className="flex items-center gap-1 mb-0.5"><FileText className="w-2.5 h-2.5 text-amber-500/80 dark:text-amber-400/70" /><p className="text-[8px] font-black uppercase tracking-widest text-amber-600/70 dark:text-amber-400/60">Anni</p></div>
                            <p className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums leading-none">{stats && !vuota ? stats.anni : '—'}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        {pratica.isSeed ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">demo</span>
                        ) : vuota ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"><AlertTriangle className="w-3 h-3" />dati da estrarre</span>
                        ) : <span />}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                </div>
            </button>
        </div>
    );
};

export default VertenzeArea;
