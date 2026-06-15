import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, FileUp, ListChecks, FileText, ShieldCheck, Moon, CalendarClock, Coffee, CheckCircle2, BookOpen, ChevronRight, AlertTriangle, Euro, CloudUpload, Loader2 } from 'lucide-react';
import { usePraticheRiposi, STATO_META, type PraticaRiposi, type StatoPratica } from '../hooks/usePraticheRiposi';
import { groupThousandsIT } from '../utils/formatters';
import { computeRestViolations, hasCEEDays } from '../utils/restEngine';
import RiposiPraticaDetail from './RiposiPraticaDetail';
import { DevBadge } from './ui/DevBadge';

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
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statoFiltro, setStatoFiltro] = useState<StatoPratica | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const selected = pratiche.find((p) => p.id === selectedId) ?? null;

    const seedPratica = pratiche.find((p) => p.isSeed);
    const visibili = statoFiltro ? pratiche.filter((p) => p.stato === statoFiltro) : pratiche;

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
                {/* Header */}
                <header className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Clock className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">Turni &amp; Riposi</h1>
                        <p className="text-slate-500 dark:text-slate-400">Mancati riposi · Reg. (CE) n. 561/2006 — area separata dalle buste paga</p>
                        <div className="mt-2">
                            <DevBadge label="Sezione nuova — in sviluppo, nuove funzioni in arrivo!" />
                        </div>
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
                        <a
                            href={`${import.meta.env.BASE_URL}vademecum-turni-riposi.docx`}
                            download="Vademecum_Turni_Riposi_FAST.docx"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/30 transition-colors"
                        >
                            <BookOpen className="w-4 h-4" /> Apri il vademecum
                        </a>
                        <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-semibold cursor-not-allowed"
                        >
                            <FileUp className="w-4 h-4" /> Nuova pratica (in arrivo)
                        </button>
                    </div>
                </motion.div>

                {/* Come funziona + Quadro normativo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Come funziona */}
                    <section className="rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-6">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Come funziona</h3>
                        <div className="space-y-4">
                            {STEPS.map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="flex gap-3">
                                    <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
                    <section className="rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-6">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Quadro normativo · soglie chiave</h3>
                        <div className="space-y-3">
                            {LIMITI.map(({ icon: Icon, voce, regola, rif }) => (
                                <div key={voce} className="flex gap-3">
                                    <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-300" />
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
                <section className="rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-6">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Violazioni che il motore rileva</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {VIOLAZIONI.map(({ n, titolo, rif, attiva, nota }) => (
                            <div key={n} className={`rounded-2xl border p-4 ${attiva ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'}`}>
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
                        <span key={f} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{f}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PraticaCard: React.FC<{ pratica: PraticaRiposi; onOpen: () => void }> = ({ pratica, onOpen }) => {
    // Stima rapida per la card (1 pratica → costo trascurabile; in Fase 2 si precalcola).
    const { tot, indennita } = useMemo(() => {
        const r = computeRestViolations(pratica.giornate, { tariffaOraria: pratica.tariffaOraria, soloCEE: hasCEEDays(pratica.giornate) });
        return { tot: r.nViolazioniGiornaliere + r.nViolazioniSettimanali, indennita: r.totIndennita };
    }, [pratica]);
    return (
        <button
            onClick={onOpen}
            className="group relative overflow-hidden flex items-center gap-4 text-left rounded-[1.6rem] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-[0_20px_50px_-22px_rgba(99,102,241,0.55)]"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] to-transparent pointer-events-none" />
            <div className="relative w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                {pratica.cognome.charAt(0)}{pratica.nome.charAt(0)}
            </div>
            <div className="relative min-w-0 flex-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{pratica.cognome} {pratica.nome}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{pratica.mansione} · {pratica.periodoStart}–{pratica.periodoEnd}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATO_META[pratica.stato].chip}`}><span className={`w-1.5 h-1.5 rounded-full ${STATO_META[pratica.stato].dot}`} />{STATO_META[pratica.stato].label}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"><AlertTriangle className="w-3 h-3" />{tot} violazioni</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"><Euro className="w-3 h-3" />{groupThousandsIT(indennita.toLocaleString('it-IT', { maximumFractionDigits: 0 }))}</span>
                    {pratica.isSeed && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">seed locale</span>}
                </div>
            </div>
            <ChevronRight className="relative w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
    );
};

export default RiposiArea;
