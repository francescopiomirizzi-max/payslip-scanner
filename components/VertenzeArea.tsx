import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ChevronRight, Euro, Scale, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usePraticheVertenze, STATO_META_VERTENZA, type PraticaVertenza, type StatoVertenza, type WorkerLike } from '../hooks/usePraticheVertenze';
import { computeVertenza } from '../utils/vertenzaEngine';
import { CompanyLogo } from './ui/CompanyLogo';
import { DevBadge } from './ui/DevBadge';
import VertenzaDetail from './VertenzaDetail';

const eur0 = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

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
                {/* Header */}
                <header className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">Indennità di assenza residenza</h1>
                        <p className="text-slate-500 dark:text-slate-400">Differenze retributive voci 4300/4305 · Elior viaggiante · CCNL 2016</p>
                        <div className="mt-2"><DevBadge label="Sezione nuova — in sviluppo, nuove funzioni in arrivo!" /></div>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibili.map((p) => (
                                <PraticaCard key={p.id} pratica={p} onOpen={() => setSelectedId(p.id)} />
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

const PraticaCard: React.FC<{ pratica: PraticaVertenza; onOpen: () => void }> = ({ pratica, onOpen }) => {
    const { credito, vuota } = useMemo(() => {
        const r = computeVertenza(pratica.voci, pratica.prescrizione, { coefficiente: pratica.coefficiente });
        const righe = pratica.voci.reduce((n, v) => n + v.righe.length, 0);
        return { credito: r.totCredito, vuota: righe === 0 };
    }, [pratica]);

    return (
        <button
            onClick={onOpen}
            className="group relative overflow-hidden flex items-center gap-4 text-left rounded-[1.6rem] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-[0_20px_50px_-22px_rgba(245,158,11,0.55)]"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] to-transparent pointer-events-none" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <MapPin className="w-6 h-6 text-white" />
            </div>
            <div className="relative min-w-0 flex-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{pratica.cognome} {pratica.nome}</p>
                <span className="mt-1 inline-flex items-center gap-1.5">
                    <CompanyLogo profilo="ELIOR" eliorType="viaggiante" h={18} title="Elior viaggiante" />
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">Viag.</span>
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{pratica.periodoStart}–{pratica.periodoEnd}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATO_META_VERTENZA[pratica.stato].chip}`}><span className={`w-1.5 h-1.5 rounded-full ${STATO_META_VERTENZA[pratica.stato].dot}`} />{STATO_META_VERTENZA[pratica.stato].label}</span>
                    {vuota ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"><AlertTriangle className="w-3 h-3" />dati da estrarre</span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"><Euro className="w-3 h-3" />{eur0(credito)}</span>
                    )}
                    {pratica.isSeed && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">demo</span>}
                </div>
            </div>
            <ChevronRight className="relative w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
    );
};

export default VertenzeArea;
