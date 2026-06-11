import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Moon, CalendarClock, Euro, CheckCircle2, Search, CalendarDays, ListChecks, FileText, Scale, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { computeRestViolations, formatHm, parseHmm, type Violazione, type GiornataInput } from '../utils/restEngine';
import { AnimatedCounter } from './ui/AnimatedCounter';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';
import { groupThousandsIT } from '../utils/formatters';

const euro = (n: number) => '€ ' + groupThousandsIT(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dmy = (iso: string) => new Date(iso).toLocaleDateString('it-IT');
const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const weekday = (data: string) => { const [d, m, y] = data.split('/').map(Number); return GIORNI[new Date(y, m - 1, d).getDay()]; };
const yearOf = (data: string) => data.split('/')[2] ?? '';
const isRiposo = (g: GiornataInput) => !g.inizio || !g.termine;
const isoToKey = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const WEEK = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const SERV_LABEL: Record<string, string> = { R: 'Riposo', Festivo: 'Festività', Ferie: 'Ferie' };
const servLabel = (code: string) => SERV_LABEL[code] ?? 'sigla da decodificare';

interface Props {
    pratica: PraticaRiposi;
    onBack: () => void;
}

type Tone = 'rose' | 'amber' | 'indigo' | 'emerald' | 'slate';
const TONE: Record<Tone, { icon: string; glow: string; hover: string }> = {
    rose:    { icon: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',         glow: 'from-rose-500/[0.08]',    hover: 'hover:shadow-[0_20px_50px_-22px_rgba(244,63,94,0.55)]' },
    amber:   { icon: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',     glow: 'from-amber-500/[0.08]',   hover: 'hover:shadow-[0_20px_50px_-22px_rgba(245,158,11,0.55)]' },
    indigo:  { icon: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', glow: 'from-indigo-500/[0.08]',  hover: 'hover:shadow-[0_20px_50px_-22px_rgba(99,102,241,0.55)]' },
    emerald: { icon: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', glow: 'from-emerald-500/[0.08]', hover: 'hover:shadow-[0_20px_50px_-22px_rgba(16,185,129,0.55)]' },
    slate:   { icon: 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300',     glow: 'from-slate-500/[0.06]',   hover: 'hover:shadow-[0_20px_50px_-22px_rgba(100,116,139,0.5)]' },
};

const RiposiPraticaDetail: React.FC<Props> = ({ pratica, onBack }) => {
    const [tab, setTab] = useState<'violazioni' | 'prospetto'>('violazioni');

    const result = useMemo(
        () => computeRestViolations(pratica.giornate, { tariffaOraria: pratica.tariffaOraria, fonteTariffa: pratica.fonteTariffa }),
        [pratica]
    );

    const perAnno = useMemo(() => {
        const m: Record<string, { g: number; s: number; ind: number }> = {};
        for (const v of result.violazioni) {
            const y = v.inizio.slice(0, 4);
            m[y] ??= { g: 0, s: 0, ind: 0 };
            if (v.tipo === 'riposo_giornaliero') m[y].g++; else m[y].s++;
            m[y].ind += v.indennita;
        }
        return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([y, v]) => ({ y, ...v, tot: v.g + v.s }));
    }, [result]);

    /** Serie della FONTE: indennità/ore come calcolate nel PDF sorgente (criteri di
     *  chi l'ha prodotto), da affiancare — non sommare — alla serie del motore. */
    const fonte = useMemo(() => {
        let gg = 0, minuti = 0, ind = 0;
        const perAnnoF: Record<string, number> = {};
        for (const g of pratica.giornate) {
            if (g.indennitaFonte == null) continue;
            gg++; ind += g.indennitaFonte;
            for (const v of [g.mancatoRipGiorn, g.mancatoRipSett]) {
                const m = parseHmm(v);
                if (!Number.isNaN(m)) minuti += m;
            }
            const y = yearOf(g.data);
            perAnnoF[y] = (perAnnoF[y] ?? 0) + g.indennitaFonte;
        }
        return { gg, ore: minuti / 60, ind, perAnno: perAnnoF };
    }, [pratica]);

    const perAnnoRows = useMemo(() => {
        const m = new Map(perAnno.map((a) => [a.y, a]));
        const ys = Array.from(new Set([...perAnno.map((a) => a.y), ...Object.keys(fonte.perAnno)])).sort();
        return ys.map((y) => ({ y, g: m.get(y)?.g ?? 0, s: m.get(y)?.s ?? 0, ind: m.get(y)?.ind ?? 0, indFonte: fonte.perAnno[y] ?? 0 }));
    }, [perAnno, fonte]);

    const maxAnno = useMemo(() => Math.max(1, ...perAnno.map((a) => a.tot)), [perAnno]);
    const violazioniOrdinate = useMemo(() => [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio)), [result]);

    const years = useMemo(() => Array.from(new Set(pratica.giornate.map((g) => yearOf(g.data)).filter(Boolean))).sort(), [pratica]);
    const [year, setYear] = useState<string>(() => years[years.length - 1] ?? '');
    const giornateAnno = useMemo(() => pratica.giornate.filter((g) => yearOf(g.data) === year), [pratica, year]);
    const byDataAnno = useMemo(() => { const m = new Map<string, GiornataInput>(); for (const g of giornateAnno) m.set(g.data, g); return m; }, [giornateAnno]);
    const violDaysAnno = useMemo(() => { const s = new Set<string>(); for (const v of result.violazioni) { const k = isoToKey(v.inizio); if (k.endsWith('/' + year)) s.add(k); } return s; }, [result, year]);
    const [meseAperto, setMeseAperto] = useState<number | null>(null);

    // Cross-link: dall'elenco violazioni al mese nel Prospetto (v.inizio è ISO).
    const openMeseProspetto = (iso: string) => {
        setYear(iso.slice(0, 4));
        setMeseAperto(Number(iso.slice(5, 7)) - 1);
        setTab('prospetto');
    };

    // Frecce ‹ › in MeseFocus: scavalcano l'anno se nel dataset esiste quello adiacente.
    const yearIdx = years.indexOf(year);
    const canPrevMese = meseAperto !== null && (meseAperto > 0 || yearIdx > 0);
    const canNextMese = meseAperto !== null && (meseAperto < 11 || yearIdx < years.length - 1);
    const navigateMese = (delta: 1 | -1) => {
        if (meseAperto === null) return;
        const m = meseAperto + delta;
        if (m < 0) { setYear(years[yearIdx - 1]); setMeseAperto(11); }
        else if (m > 11) { setYear(years[yearIdx + 1]); setMeseAperto(0); }
        else setMeseAperto(m);
    };

    // Filtro anno dell'elenco violazioni, pilotato dal grafico (toggle).
    const [annoFiltro, setAnnoFiltro] = useState<string | null>(null);
    const violazioniVisibili = useMemo(
        () => (annoFiltro ? violazioniOrdinate.filter((v) => v.inizio.slice(0, 4) === annoFiltro) : violazioniOrdinate),
        [violazioniOrdinate, annoFiltro]
    );

    const totViol = result.nViolazioniGiornaliere + result.nViolazioniSettimanali;

    const STAT: { tone: Tone; icon: React.ComponentType<{ className?: string }>; label: string; sub: string; node: React.ReactNode }[] = [
        { tone: 'rose',    icon: AlertTriangle, label: 'Violazioni totali', sub: `${result.nViolazioniGiornaliere} giorn. · ${result.nViolazioniSettimanali} sett.`, node: <AnimatedCounter value={totViol} /> },
        { tone: 'amber',   icon: CalendarClock, label: 'Ore mancanti',      sub: 'rispetto alle soglie',           node: <><AnimatedCounter value={Math.round(result.totOreMancanti)} /> <span className="text-base font-bold">h</span></> },
        { tone: 'indigo',  icon: Euro,          label: 'Indennità stimata', sub: `tariffa ${euro(pratica.tariffaOraria)}/h`, node: <AnimatedCounter value={result.totIndennita} isCurrency /> },
        { tone: 'emerald', icon: CheckCircle2,  label: 'Ridotti leciti',    sub: 'non conteggiati (≤3/sett)',      node: <AnimatedCounter value={result.nRidottiGiornalieriLeciti} /> },
        { tone: 'slate',   icon: Search,        label: 'Da verificare',     sub: 'righe non interpretabili',       node: <AnimatedCounter value={result.warnings.length} /> },
    ];

    const TABS = [
        { id: 'violazioni' as const, label: 'Violazioni', icon: ListChecks },
        { id: 'prospetto' as const, label: 'Prospetto turni', icon: CalendarDays },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="min-h-screen px-6 py-10">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:-translate-x-0.5 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/30">
                        {pratica.cognome.charAt(0)}{pratica.nome.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">{pratica.cognome} {pratica.nome}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{pratica.mansione} · {pratica.periodoStart} – {pratica.periodoEnd} · {pratica.giornate.length} giornate</p>
                    </div>
                </div>

                {/* Banner onestà dati */}
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Giornate dal <strong>PDF sorgente</strong> («Mancati riposi»), parsato in modo deterministico e quadrato al centesimo coi totali del documento. La tariffa del motore è un <strong>placeholder</strong> da confermare con l'avvocato.</span>
                </div>

                {/* Tabs */}
                <div className="inline-flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)} className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === id ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            {tab === id && <motion.span layoutId="riposi-tab" className="absolute inset-0 rounded-xl bg-white dark:bg-slate-700 shadow-sm" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                            <Icon className="relative w-4 h-4" /><span className="relative">{label}</span>
                        </button>
                    ))}
                </div>

                {tab === 'violazioni' ? (
                    <>
                        {/* Le due serie a confronto: fonte (PDF) vs motore 561/2006 */}
                        {fonte.gg > 0 && (
                            <section className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Le due serie a confronto</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-500/10 p-4">
                                        <div className="flex items-center gap-2 mb-2 text-sky-700 dark:text-sky-300">
                                            <FileText className="w-4 h-4" />
                                            <span className="text-[11px] font-bold uppercase tracking-wide">Indennità secondo il PDF</span>
                                        </div>
                                        <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100"><AnimatedCounter value={fonte.ind} isCurrency /></p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{groupThousandsIT(fonte.gg.toLocaleString('it-IT'))} giornate indennizzate · {groupThousandsIT(Math.round(fonte.ore).toLocaleString('it-IT'))} h mancanti · tariffe e criteri di chi ha prodotto il documento</p>
                                    </div>
                                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-300">
                                            <Scale className="w-4 h-4" />
                                            <span className="text-[11px] font-bold uppercase tracking-wide">Indennità secondo il motore (Reg. 561/2006)</span>
                                        </div>
                                        <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100"><AnimatedCounter value={result.totIndennita} isCurrency /></p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{totViol} violazioni · {groupThousandsIT(Math.round(result.totOreMancanti).toLocaleString('it-IT'))} h mancanti · tariffa placeholder {euro(pratica.tariffaOraria)}/h</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">Criteri di calcolo diversi: la fonte applica le proprie regole, il motore le soglie del Reg. (CE) 561/2006 sui soli orari di turno. Le due serie si affiancano, non si sommano — confronto neutro per l'avvocato.</p>
                            </section>
                        )}

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {STAT.map(({ tone, icon: Icon, label, sub, node }) => (
                                <div key={label} className={`group relative overflow-hidden rounded-[1.6rem] bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-5 transition-all duration-300 hover:-translate-y-1 ${TONE[tone].hover}`}>
                                    <div className={`absolute inset-0 bg-gradient-to-br ${TONE[tone].glow} to-transparent pointer-events-none`} />
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${TONE[tone].icon}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight tabular-nums">{node}</p>
                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Per anno: grafico + tabella */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            <section className="lg:col-span-3 rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6 flex flex-col">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Andamento per anno</h3>
                                    <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> settimanali</span>
                                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> giornaliere</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 flex-1 min-h-[10rem]">
                                    {perAnno.map(({ y, g, s, tot }) => {
                                        const attivo = annoFiltro === y;
                                        const spento = annoFiltro !== null && !attivo;
                                        return (
                                            <button
                                                key={y}
                                                type="button"
                                                onClick={() => setAnnoFiltro(attivo ? null : y)}
                                                title={attivo ? 'Mostra tutti gli anni' : `Filtra l'elenco violazioni sul ${y}`}
                                                className={`group/bar flex-1 flex flex-col items-center justify-end h-full gap-1.5 transition-opacity duration-200 ${spento ? 'opacity-35 hover:opacity-70' : ''}`}
                                            >
                                                <span className={`text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300 transition-opacity ${attivo ? 'opacity-100' : 'opacity-0 group-hover/bar:opacity-100'}`}>{tot}</span>
                                                <div className={`w-full flex flex-col justify-end h-full rounded-t-md ${attivo ? 'ring-2 ring-indigo-400/70 dark:ring-indigo-500/60' : ''}`}>
                                                    <div className="w-full rounded-t-md bg-rose-400 transition-all duration-300 group-hover/bar:bg-rose-500" style={{ height: `${(g / maxAnno) * 100}%` }} title={`${g} giornaliere`} />
                                                    <div className="w-full bg-indigo-500 transition-all duration-300 group-hover/bar:bg-indigo-600" style={{ height: `${(s / maxAnno) * 100}%` }} title={`${s} settimanali`} />
                                                </div>
                                                <span className={`text-[10px] tabular-nums ${attivo ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>'{y.slice(2)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">Clicca un anno per filtrare l'elenco violazioni qui sotto.</p>
                            </section>

                            <section className="lg:col-span-2 rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-5">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Dettaglio per anno</h3>
                                <div className="space-y-1">
                                    <div className="grid grid-cols-5 text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2">
                                        <span>Anno</span><span className="text-right">G.</span><span className="text-right">S.</span><span className="text-right">€ mot.</span><span className="text-right">€ PDF</span>
                                    </div>
                                    {perAnnoRows.map(({ y, g, s, ind, indFonte }) => (
                                        <div key={y} className="grid grid-cols-5 text-sm px-2 py-1.5 rounded-lg odd:bg-slate-50 dark:odd:bg-slate-800/40">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{y}</span>
                                            <span className="text-right tabular-nums text-rose-500">{g}</span>
                                            <span className="text-right tabular-nums text-indigo-500">{s}</span>
                                            <span className="text-right tabular-nums text-slate-500 dark:text-slate-400">{groupThousandsIT(Math.round(ind).toLocaleString('it-IT'))}</span>
                                            <span className="text-right tabular-nums text-sky-600 dark:text-sky-400">{indFonte ? groupThousandsIT(Math.round(indFonte).toLocaleString('it-IT')) : '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Elenco violazioni */}
                        <section className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Elenco violazioni <span className="text-slate-400 font-normal">({violazioniVisibili.length})</span></h3>
                                {annoFiltro && (
                                    <button
                                        type="button"
                                        onClick={() => setAnnoFiltro(null)}
                                        title="Rimuovi il filtro anno"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-500/25 transition-colors"
                                    >
                                        solo {annoFiltro} <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[30rem] overflow-y-auto pr-1 space-y-1.5">
                                {violazioniVisibili.map((v, i) => <ViolazioneRow key={i} v={v} onOpenMese={() => openMeseProspetto(v.inizio)} />)}
                            </div>
                        </section>
                    </>
                ) : meseAperto === null ? (
                    /* PROSPETTO — vista anno (griglia 12 mesi) */
                    <section className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                            <div className="flex flex-wrap items-center gap-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Prospetto turni <span className="text-slate-400 font-normal">{year}</span></h3>
                                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-200 dark:bg-indigo-500/30" /> turno</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700" /> riposo</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded ring-2 ring-rose-400" /> violazione</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {years.map((y) => (
                                    <button key={y} onClick={() => { setYear(y); setMeseAperto(null); }} className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors ${year === y ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600'}`}>{y}</button>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Clicca un mese per aprirne il dettaglio.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {MESI.map((_, m) => <MeseCalendario key={m} year={Number(year)} month={m} byData={byDataAnno} violDays={violDaysAnno} active={false} onSelect={() => setMeseAperto(m)} />)}
                        </div>
                    </section>
                ) : (
                    /* PROSPETTO — vista mese singolo */
                    <MeseFocus
                        year={Number(year)}
                        month={meseAperto}
                        giornate={giornateAnno.filter((g) => Number(g.data.split('/')[1]) === meseAperto + 1)}
                        violDays={violDaysAnno}
                        onBack={() => setMeseAperto(null)}
                        onNavigate={navigateMese}
                        canPrev={canPrevMese}
                        canNext={canNextMese}
                    />
                )}
            </div>
        </motion.div>
    );
};

const MeseCalendario: React.FC<{ year: number; month: number; byData: Map<string, GiornataInput>; violDays: Set<string>; active: boolean; onSelect: () => void }> = ({ year, month, byData, violDays, active, onSelect }) => {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7; // settimana che parte da lunedì
    const numDays = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];
    const key = (d: number) => `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    return (
        <button type="button" onClick={onSelect} className={`text-left rounded-2xl border bg-white/40 dark:bg-slate-800/40 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-400/60' : 'border-slate-100 dark:border-slate-700/60'}`}>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{MESI[month]}</p>
            <div className="grid grid-cols-7 gap-1">
                {WEEK.map((w, i) => <span key={`w${i}`} className="text-[9px] text-center text-slate-300 dark:text-slate-600 font-bold">{w}</span>)}
                {cells.map((d, i) => {
                    if (d === null) return <span key={i} />;
                    const k = key(d);
                    const g = byData.get(k);
                    const riposo = !g || isRiposo(g);
                    const viol = violDays.has(k);
                    const tip = g
                        ? (isRiposo(g) ? `${weekday(k)} ${k} · riposo${g.servizio ? ` (${g.servizio})` : ''}` : `${weekday(k)} ${k} · ${g.servizio ?? 'turno'} · ${g.inizio}–${g.termine}`)
                        : k;
                    return (
                        <span
                            key={i}
                            title={tip}
                            className={`aspect-square rounded-md flex items-center justify-center text-[9px] font-semibold tabular-nums ${
                                !g ? 'text-slate-300 dark:text-slate-700'
                                : riposo ? 'bg-slate-100 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500'
                                : 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300'
                            } ${viol ? 'ring-2 ring-rose-400 dark:ring-rose-500' : ''}`}
                        >
                            {d}
                        </span>
                    );
                })}
            </div>
        </button>
    );
};

const MeseFocus: React.FC<{ year: number; month: number; giornate: GiornataInput[]; violDays: Set<string>; onBack: () => void; onNavigate: (delta: 1 | -1) => void; canPrev: boolean; canNext: boolean }> = ({ year, month, giornate, violDays, onBack, onNavigate, canPrev, canNext }) => {
    const nLav = giornate.filter((g) => !isRiposo(g)).length;
    const nRiposi = giornate.length - nLav;
    const nViol = giornate.filter((g) => violDays.has(g.data)).length;
    const indFonteMese = giornate.reduce((a, g) => a + (g.indennitaFonte ?? 0), 0);
    const hasFonte = giornate.some((g) => g.indennitaFonte != null);
    const counts = new Map<string, number>();
    for (const g of giornate) { const s = (g.servizio ?? '').trim(); if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    // Turno = codice che contiene cifre (63, 1063, 0020BR…); le sigle di sole
    // lettere (R, D, VM, Ferie, Festivo) sono marcatori di non-guida.
    const markers: [string, number][] = [], turni: [string, number][] = [];
    for (const [c, n] of counts) (/\d/.test(c) ? turni : markers).push([c, n]);
    markers.sort((a, b) => b[1] - a[1]); turni.sort((a, b) => b[1] - a[1]);
    const riepilogo: { color: string; label: string; value: React.ReactNode }[] = [
        { color: 'bg-indigo-500', label: 'Giorni di turno', value: nLav },
        { color: 'bg-slate-400', label: 'Riposi', value: nRiposi },
        { color: 'bg-rose-500', label: 'Con violazione', value: nViol },
        ...(hasFonte ? [{ color: 'bg-sky-500', label: 'Indennità PDF', value: euro(indFonteMese) }] : []),
    ];
    return (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6">
            <div className="flex items-center gap-3 mb-5">
                <button onClick={onBack} title="Torna alla griglia dei mesi" className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:-translate-x-0.5 transition-all">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{MESI[month]} <span className="text-slate-400 font-bold">{year}</span></h3>
                <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => onNavigate(-1)} disabled={!canPrev} title="Mese precedente" className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:text-slate-500">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => onNavigate(1)} disabled={!canNext} title="Mese successivo" className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:text-slate-500">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tabella mese incolonnata */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-100 dark:border-slate-700/60 overflow-hidden self-start">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            <tr>
                                <th className="text-left font-bold px-4 py-2.5">Data</th>
                                <th className="text-left font-bold px-3 py-2.5">Giorno</th>
                                <th className="text-left font-bold px-3 py-2.5">Servizio</th>
                                <th className="text-right font-bold px-3 py-2.5">Inizio</th>
                                <th className={`text-right font-bold ${hasFonte ? 'px-3' : 'px-4'} py-2.5`}>Termine</th>
                                {hasFonte && <th className="text-right font-bold px-4 py-2.5">€ PDF</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {giornate.map((g, i) => {
                                const riposo = isRiposo(g);
                                const viol = violDays.has(g.data);
                                return (
                                    <tr key={i} className={`border-t border-slate-100 dark:border-slate-700/40 ${viol ? 'bg-rose-50/70 dark:bg-rose-500/10' : 'odd:bg-slate-50/50 dark:odd:bg-slate-800/20'}`}>
                                        <td className={`px-4 py-2 tabular-nums font-medium ${riposo ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                            <span className="inline-flex items-center gap-2">{viol && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}{g.data}</span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{weekday(g.data)}</td>
                                        <td className="px-3 py-2">{riposo ? <span className="text-slate-400 dark:text-slate-500">{g.servizio ?? '—'}</span> : <span className="font-semibold text-indigo-600 dark:text-indigo-400">{g.servizio ?? '—'}</span>}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{g.inizio ?? '—'}</td>
                                        <td className={`${hasFonte ? 'px-3' : 'px-4'} py-2 text-right tabular-nums text-slate-600 dark:text-slate-300`}>{g.termine ?? '—'}</td>
                                        {hasFonte && <td className="px-4 py-2 text-right tabular-nums font-semibold text-sky-600 dark:text-sky-400">{g.indennitaFonte != null ? groupThousandsIT(g.indennitaFonte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : <span className="font-normal text-slate-300 dark:text-slate-600">—</span>}</td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Legenda verticale */}
                <aside className="space-y-4">
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">Riepilogo mese</p>
                        <div className="space-y-2.5">
                            {riepilogo.map(({ color, label, value }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><span className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</span>
                                    <span className="font-black tabular-nums text-slate-800 dark:text-slate-100">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">Legenda colori</p>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-indigo-200 dark:bg-indigo-500/30" /> Giorno di turno</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-700" /> Riposo</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded ring-2 ring-rose-400" /> Giorno con violazione</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">Servizi del mese</p>
                        <div className="space-y-2 text-sm">
                            {markers.map(([code, n]) => (
                                <div key={code} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                    <span><span className="font-bold">{code}</span>{servLabel(code) !== code && <span className={SERV_LABEL[code] ? '' : 'italic text-slate-400 dark:text-slate-500'}> · {servLabel(code)}</span>}</span>
                                    <span className="text-slate-400 tabular-nums">×{n}</span>
                                </div>
                            ))}
                            {turni.length > 0 && (
                                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-semibold pt-1 border-t border-slate-100 dark:border-slate-700/40">
                                    <span>Codici turno distinti</span><span className="tabular-nums">{turni.length}</span>
                                </div>
                            )}
                        </div>
                        {turni.length > 0 && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">I codici turno (numerici o alfanumerici) sono i turni/linee aziendali: la legenda dei singoli codici va richiesta all'azienda (o a Vincenzo).</p>
                        )}
                    </div>
                </aside>
            </div>
        </motion.section>
    );
};

const ViolazioneRow: React.FC<{ v: Violazione; onOpenMese: () => void }> = ({ v, onOpenMese }) => {
    const isSett = v.tipo === 'riposo_settimanale';
    const Icon = isSett ? CalendarClock : Moon;
    return (
        <button
            type="button"
            onClick={onOpenMese}
            title="Apri il mese nel Prospetto turni"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group"
        >
            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${isSett ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-500 dark:text-rose-400'}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {dmy(v.inizio)} <span className="font-normal text-slate-400">→</span> {dmy(v.fine)}
                    <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${v.gravita === 'grave' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>{v.gravita}</span>
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{isSett ? 'Riposo settimanale' : 'Riposo giornaliero'} · {v.rifNormativo}</p>
            </div>
            <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatHm(v.ore)}</p>
                <p className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">manc {formatHm(v.oreMancanti)}</p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
        </button>
    );
};

export default RiposiPraticaDetail;
