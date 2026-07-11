import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Moon, CalendarClock, Euro, CheckCircle2, Search, CalendarDays, ListChecks, FileText, FileSpreadsheet, Scale, GitCompare, ChevronLeft, ChevronRight, ChevronDown, X, Printer, Calculator, RotateCcw, BusFront } from 'lucide-react';
import { RIPOSI_THEME, riposiHeaderBand } from './riposi/riposiTheme';
import { computeRestViolations, computeSerieFonte, resolveTariffePerAnno, buildConfronto, tariffaRange, formatHm, parseHmm, hasCEEDays, isGiornoNonLavorato, type Violazione, type GiornataInput, type RestResult, type ConfrontoResult, type ConfrontoStato } from '../utils/restEngine';
import { printConteggiRiposi } from '../utils/riposiPrint';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { STATO_META, type PraticaRiposi, type PraticaRiposiUpdate, type StatoPratica } from '../hooks/usePraticheRiposi';
import { useIsReadOnly, canExportForViewer } from '../lib/readonly';
import { groupThousandsIT } from '../utils/formatters';
import { aziendaToProfilo } from '../config/profiles';
import { CompanyLogo } from './ui/CompanyLogo';
import { parseTariffaInput, parseTariffeDraft, tariffeToDraft, draftIsDirty } from '../utils/tariffeDraft';

const euro = (n: number) => '€ ' + groupThousandsIT(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** Etichetta tariffa: valore singolo se piatta, range "€min → €max" se cresce per anno. */
const tariffaLabel = (rates: Record<string, number>): string => {
    const { min, max, uniform } = tariffaRange(rates);
    return uniform ? `${euro(min)}/h` : `${euro(min)} → ${euro(max)}/h`;
};
/** Suffisso coefficiente danno (es. " × 20%") quando attivo; vuoto se valore pieno. */
const coeffSuffix = (coeff: number): string => (coeff !== 1 ? ` × ${Math.round(coeff * 100)}%` : '');
// Valorizzazioni del riposo perso proposte dal selettore. Il "+20%" è la MAGGIORAZIONE sul
// totale chiarita da Vincenzo l'11/07 (Cass. 14940/2014: 20% = maggiorazione straordinario
// festivo); il "danno 20%" resta selezionabile come interpretazione alternativa del legale.
const VALORIZZAZIONI = [
    { v: 1, label: 'Valore pieno · 100%' },
    { v: 1.20, label: 'Maggiorazione · +20%' },
    { v: 0.20, label: 'Danno · 20%' },
];
const dmy = (iso: string) => new Date(iso).toLocaleDateString('it-IT');
const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const weekday = (data: string) => { const [d, m, y] = data.split('/').map(Number); return GIORNI[new Date(y, m - 1, d).getDay()]; };
const yearOf = (data: string) => data.split('/')[2] ?? '';
const isRiposo = (g: GiornataInput) => !g.inizio || !g.termine;
const isoToKey = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const WEEK = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
// Sigle di servizio decodificate (D/VM = standard di settore, confermate da Vincenzo).
const SERV_LABEL: Record<string, string> = {
    R: 'Riposo', Festivo: 'Festività', Ferie: 'Ferie',
    D: 'A disposizione (riserva)', VM: 'Visita medica', Malato: 'Malattia', 'P.retr': 'Permesso retribuito',
};
const servLabel = (code: string) => SERV_LABEL[code] ?? 'sigla da decodificare';
/** true = giornata marcata CEE (servizio di linea >50 km, in perimetro Reg. 561/2006). */
const isCEEDay = (g?: GiornataInput) => (g?.tipo || '').trim().toUpperCase() === 'CEE';
/** Giornata LAVORATA (codice servizio di turno) ma senza orari nel PDF: non è un riposo —
 *  stessa distinzione della guardia del motore (i gap che la attraversano non sono riposi). */
const isLavoratoSenzaOrari = (g?: GiornataInput) => !!g && (!g.inizio || !g.termine) && !isGiornoNonLavorato(g.servizio);
const CEE_CHIP = 'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300';

interface Props {
    pratica: PraticaRiposi;
    onBack: () => void;
    /** Assente per le pratiche-seed (non ancora in archivio): gestione stato disabilitata. */
    onUpdate?: (fields: PraticaRiposiUpdate) => void;
}

type Tone = 'rose' | 'amber' | 'indigo' | 'emerald' | 'slate';
const TONE: Record<Tone, { icon: string; card: string; text: string; hover: string }> = {
    rose:    { icon: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',         card: 'bg-rose-50/80 dark:bg-rose-900/20 border-rose-200/80 dark:border-rose-700/40',          text: 'text-rose-700 dark:text-rose-300',       hover: 'hover:shadow-[0_20px_50px_-22px_rgba(244,63,94,0.55)]' },
    amber:   { icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',     card: 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200/80 dark:border-amber-700/40',       text: 'text-amber-700 dark:text-amber-300',     hover: 'hover:shadow-[0_20px_50px_-22px_rgba(245,158,11,0.55)]' },
    indigo:  { icon: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400', card: 'bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-200/80 dark:border-indigo-700/40',    text: 'text-indigo-700 dark:text-indigo-300',   hover: 'hover:shadow-[0_20px_50px_-22px_rgba(99,102,241,0.55)]' },
    emerald: { icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', card: 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200/80 dark:border-emerald-700/40', text: 'text-emerald-700 dark:text-emerald-300', hover: 'hover:shadow-[0_20px_50px_-22px_rgba(16,185,129,0.55)]' },
    slate:   { icon: 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300',     card: 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/50',     text: 'text-slate-700 dark:text-slate-200',     hover: 'hover:shadow-[0_20px_50px_-22px_rgba(100,116,139,0.5)]' },
};

const RiposiPraticaDetail: React.FC<Props> = ({ pratica, onBack, onUpdate }) => {
    const [tab, setTab] = useState<'violazioni' | 'prospetto' | 'confronto'>('violazioni');
    const [isExportingDocx, setIsExportingDocx] = useState(false);
    const [isRelazioneOpen, setIsRelazioneOpen] = useState(false);
    // Editor tariffe €/h per anno (override CCNL): draft = testo dei campi; null = editor chiuso.
    const [tariffeOpen, setTariffeOpen] = useState(false);
    const [tariffeDraft, setTariffeDraft] = useState<Record<string, string> | null>(null);

    // Cambio tab senza far saltare la pagina in cima: la layout-animation del pill (framer `layoutId`)
    // rimisura le posizioni al cambio e la finestra scatta su. Salviamo lo scroll e lo ripristiniamo
    // prima del paint (useLayoutEffect gira dopo il layout effect del pill → vince sul jump).
    const pendingScrollY = useRef<number | null>(null);
    const changeTab = (id: typeof tab) => { pendingScrollY.current = window.scrollY; setTab(id); };
    useLayoutEffect(() => {
        if (pendingScrollY.current == null) return;
        const y = pendingScrollY.current;
        pendingScrollY.current = null;
        window.scrollTo(0, y);
        // Rete: se framer riscrolla in modo async subito dopo, ripristiniamo al frame (no-op se già a posto).
        const raf = requestAnimationFrame(() => window.scrollTo(0, y));
        return () => cancelAnimationFrame(raf);
    }, [tab]);
    const isReadOnly = useIsReadOnly();
    const canManage = Boolean(onUpdate) && !isReadOnly;
    // Logo aziendale dal campo azienda (testo libero → chiave profilo con logo)
    const logoProfilo = aziendaToProfilo(pratica.azienda);
    // Il viewer scarica/stampa solo le pratiche "pagata"; l'owner sempre.
    const canExport = canExportForViewer(isReadOnly, pratica.stato === 'pagata');

    // Cambio stato: scrive da sé la data utile corrispondente (se mancante).
    const handleStato = (stato: StatoPratica) => {
        if (!onUpdate || stato === pratica.stato) return;
        const oggi = new Date().toISOString().slice(0, 10);
        const fields: PraticaRiposiUpdate = { stato };
        if (stato === 'conclusa' && !pratica.dataChiusura) fields.dataChiusura = oggi;
        if (stato === 'pagata' && !pratica.dataPagamento) fields.dataPagamento = oggi;
        onUpdate(fields);
    };

    // Tariffa per anno passata al motore: override della pratica se presente,
    // altrimenti ricavata dalla fonte (cresce per anzianità). Valore orario pieno.
    const tariffePerAnno = useMemo(
        () => resolveTariffePerAnno(pratica.giornate, pratica.tariffePerAnno),
        [pratica]
    );
    // Coefficiente danno (default 1 = valore pieno; metodo avvocato «20%» → 0.20).
    const coeff = pratica.coefficiente ?? 1;

    const result = useMemo(
        () => computeRestViolations(pratica.giornate, { tariffaOraria: pratica.tariffaOraria, fonteTariffa: pratica.fonteTariffa, tariffePerAnno, coefficiente: pratica.coefficiente, soloCEE: hasCEEDays(pratica.giornate) }),
        [pratica, tariffePerAnno]
    );

    // Tariffa piena applicata per anno (dal motore, esatta), per il display.
    const rates = result.tariffePerAnnoApplicate;

    // Stato dell'editor tariffe: override attivo? draft valido e modificato?
    const hasTariffeOverride = pratica.tariffePerAnno != null;
    const tariffeParsed = tariffeDraft ? parseTariffeDraft(tariffeDraft) : null;
    const tariffeDirty = tariffeDraft ? draftIsDirty(tariffeDraft, rates) : false;

    // Import dinamico: docx resta fuori dal bundle principale.
    const handleRelazioneDocx = async () => {
        if (isExportingDocx) return;
        setIsExportingDocx(true);
        try {
            const { generateRelazioneRiposi } = await import('../utils/riposiRelazione');
            await generateRelazioneRiposi(pratica, result);
        } finally {
            setIsExportingDocx(false);
        }
    };

    // Import dinamico: exceljs resta fuori dal bundle principale.
    const [isExportingXlsx, setIsExportingXlsx] = useState(false);
    const handleExcel = async () => {
        if (isExportingXlsx) return;
        setIsExportingXlsx(true);
        try {
            const { generateExcelRiposi } = await import('../utils/riposiExcel');
            await generateExcelRiposi(pratica, result);
        } finally {
            setIsExportingXlsx(false);
        }
    };

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
    const fonte = useMemo(() => computeSerieFonte(pratica.giornate), [pratica]);

    /** Confronto giorno-per-giorno PDF ↔ nostro metodo (per il tab Confronto). */
    const confronto = useMemo(() => buildConfronto(pratica.giornate, result), [pratica, result]);

    const perAnnoRows = useMemo(() => {
        const m = new Map(perAnno.map((a) => [a.y, a]));
        const ys = Array.from(new Set([...perAnno.map((a) => a.y), ...Object.keys(fonte.perAnno)])).sort();
        return ys.map((y) => ({ y, g: m.get(y)?.g ?? 0, s: m.get(y)?.s ?? 0, ind: m.get(y)?.ind ?? 0, indFonte: fonte.perAnno[y] ?? 0, rate: rates[y] }));
    }, [perAnno, fonte, rates]);

    const maxAnno = useMemo(() => Math.max(1, ...perAnno.map((a) => a.tot)), [perAnno]);
    const violazioniOrdinate = useMemo(() => [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio)), [result]);

    const years = useMemo(() => Array.from(new Set(pratica.giornate.map((g) => yearOf(g.data)).filter(Boolean))).sort(), [pratica]);
    const [year, setYear] = useState<string>(() => years[years.length - 1] ?? '');
    const giornateAnno = useMemo(() => pratica.giornate.filter((g) => yearOf(g.data) === year), [pratica, year]);
    const byDataAnno = useMemo(() => { const m = new Map<string, GiornataInput>(); for (const g of giornateAnno) m.set(g.data, g); return m; }, [giornateAnno]);
    const violDaysAnno = useMemo(() => { const s = new Set<string>(); for (const v of result.violazioni) { const k = v.dataTurno ?? isoToKey(v.inizio); if (k.endsWith('/' + year)) s.add(k); } return s; }, [result, year]);
    const [meseAperto, setMeseAperto] = useState<number | null>(null);
    // Giorno da evidenziare quando si arriva al mese da una violazione (cross-link).
    const [giornoFocus, setGiornoFocus] = useState<string | null>(null);

    // Cross-link: dall'elenco violazioni al mese nel Prospetto (giorno = dataTurno 'DD/MM/YYYY').
    const openMeseProspetto = (day: string) => {
        const [, mm, yyyy] = day.split('/');
        setYear(yyyy);
        setMeseAperto(Number(mm) - 1);
        setGiornoFocus(day);
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
        { tone: 'indigo',  icon: Euro,          label: 'Indennità stimata', sub: `tariffa ${tariffaLabel(rates)}${coeffSuffix(coeff)}`, node: <AnimatedCounter value={result.totIndennita} isCurrency /> },
        { tone: 'emerald', icon: CheckCircle2,  label: 'Ridotti leciti',    sub: 'non conteggiati (≤3/sett)',      node: <AnimatedCounter value={result.nRidottiGiornalieriLeciti} /> },
        { tone: 'slate',   icon: Search,        label: 'Da verificare',     sub: 'righe non interpretabili',       node: <AnimatedCounter value={result.warnings.length} /> },
    ];

    const TABS = [
        { id: 'violazioni' as const, label: 'Violazioni', icon: ListChecks },
        { id: 'prospetto' as const, label: 'Prospetto turni', icon: CalendarDays },
        { id: 'confronto' as const, label: 'Confronto PDF', icon: GitCompare },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="min-h-screen px-6 py-10">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header hero — identità pratica + numeri chiave a colpo d'occhio */}
                <div className="relative overflow-hidden rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-6 shadow-xl">
                    <div className="absolute inset-x-0 top-0 h-36 pointer-events-none" style={{ background: riposiHeaderBand }} />
                    <div className="relative flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:-translate-x-0.5 transition-all shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    {logoProfilo ? (
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/85 dark:bg-slate-900/70 backdrop-blur border border-white/70 dark:border-slate-700 shadow-lg shrink-0" title={pratica.azienda ?? undefined}>
                            <CompanyLogo profilo={logoProfilo} h={30} />
                        </div>
                    ) : (
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                            style={{ background: RIPOSI_THEME.gradient, boxShadow: `0 8px 24px -8px ${RIPOSI_THEME.glow}` }}
                        >
                            <BusFront className="w-7 h-7" strokeWidth={1.5} />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight tracking-tight truncate"><span className="uppercase">{pratica.cognome}</span> {pratica.nome}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{pratica.azienda ? `${pratica.azienda} · ` : ''}{pratica.mansione} · {pratica.periodoStart} – {pratica.periodoEnd} · {pratica.giornate.length} giornate</p>
                    </div>
                    {/* Numeri chiave (colorati per tipo) */}
                    <div className="hidden sm:flex items-stretch gap-2.5 ml-2">
                        <div className="rounded-xl bg-rose-50/80 dark:bg-rose-900/20 border border-rose-200/80 dark:border-rose-700/40 px-3.5 py-2 text-center backdrop-blur-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600/80 dark:text-rose-400/70">Violazioni</p>
                            <p className="text-lg font-black tabular-nums text-rose-700 dark:text-rose-300 leading-tight">{totViol}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-700/40 px-3.5 py-2 text-center backdrop-blur-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/70">Credito</p>
                            <p className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300 leading-tight">{euro(result.totIndennita)}</p>
                        </div>
                    </div>
                    <div className="ml-auto">
                        {canManage ? (
                            <label className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${STATO_META[pratica.stato].chip}`} title="Stato della pratica: cambiarlo scrive da sé la data di chiusura/pagamento">
                                <span className={`w-2 h-2 rounded-full ${STATO_META[pratica.stato].dot}`} />
                                <select
                                    value={pratica.stato}
                                    onChange={(e) => handleStato(e.target.value as StatoPratica)}
                                    className="appearance-none bg-transparent font-bold text-inherit pr-4 cursor-pointer focus:outline-none"
                                >
                                    {(Object.keys(STATO_META) as StatoPratica[]).map((s) => (
                                        <option key={s} value={s} className="text-slate-800 bg-white">{STATO_META[s].label}</option>
                                    ))}
                                </select>
                                <ChevronRight className="w-3 h-3 absolute right-2 rotate-90 pointer-events-none" />
                            </label>
                        ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${STATO_META[pratica.stato].chip}`} title={onUpdate ? 'Sola consultazione' : 'Pratica dal seed locale: salvala nell\'archivio per gestirne lo stato'}>
                                <span className={`w-2 h-2 rounded-full ${STATO_META[pratica.stato].dot}`} />{STATO_META[pratica.stato].label}
                            </span>
                        )}
                    </div>
                    </div>
                </div>

                {/* Riga azioni (Excel, Relazione, Stampa conteggi) — per il viewer
                    solo sulle pratiche "pagata"; l'owner sempre. */}
                {canExport && (
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleExcel}
                            disabled={isExportingXlsx}
                            title="Scarica l'Excel pulito: numeri veri, formule vive (la tariffa nel Riepilogo ricalcola tutto), un foglio per anno"
                            className="group inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/70 dark:border-slate-700/70 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
                        >
                            <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110"><FileSpreadsheet className="w-4 h-4" /></span>
                            Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsRelazioneOpen(true)}
                            title="Apri la relazione: spiegazione del metodo, esempio numerico sui tuoi dati, le due serie, e download .docx / stampa"
                            className="group inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/70 dark:border-slate-700/70 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap"
                        >
                            <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110"><FileText className="w-4 h-4" /></span>
                            Relazione
                        </button>
                        <button
                            type="button"
                            onClick={() => printConteggiRiposi(pratica, result)}
                            title="Apre il documento dei conteggi (due serie, riepilogo per anno, elenco violazioni) nella finestra di stampa: da lì si salva in PDF"
                            className="group relative overflow-hidden inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl text-white text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap"
                            style={{ background: RIPOSI_THEME.gradient, boxShadow: `0 10px 24px -8px ${RIPOSI_THEME.glow}` }}
                        >
                            <span className="absolute inset-0 bg-white/25 -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12 pointer-events-none" />
                            <span className="relative w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Printer className="w-4 h-4" /></span>
                            <span className="relative">Stampa conteggi</span>
                        </button>
                    </div>
                )}

                {/* Gestione pratica: date utili + importo riconosciuto */}
                {pratica.stato !== 'in_corso' && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {pratica.dataChiusura && <span>Conclusa il <strong>{dmy(pratica.dataChiusura)}</strong></span>}
                        {pratica.stato === 'pagata' && (
                            <>
                                {pratica.dataPagamento && <span>Pagata il <strong>{dmy(pratica.dataPagamento)}</strong></span>}
                                <span className="inline-flex items-center gap-2">
                                    Importo riconosciuto:
                                    {canManage ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            defaultValue={pratica.importoRiconosciuto ?? ''}
                                            placeholder="0,00"
                                            title="Importo effettivamente riconosciuto a chiusura (Invio o click fuori per salvare)"
                                            onBlur={(e) => {
                                                const n = parseFloat(e.target.value);
                                                const v = Number.isFinite(n) && n >= 0 ? n : undefined;
                                                if (v !== pratica.importoRiconosciuto) onUpdate?.({ importoRiconosciuto: v });
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            className="w-28 px-2 py-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                                        />
                                    ) : (
                                        <strong className="tabular-nums">{pratica.importoRiconosciuto != null ? euro(pratica.importoRiconosciuto) : '—'}</strong>
                                    )}
                                    {canManage && <span className="text-slate-400">€</span>}
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Banner onestà dati */}
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Giornate dal <strong>PDF sorgente</strong> («Mancati riposi»), parsato in modo deterministico e quadrato al centesimo coi totali del documento. La tariffa è <strong>ricavata anno per anno</strong> dal documento sorgente ({tariffaLabel(rates)}, cresce per anzianità di servizio); la valorizzazione segue la disciplina contrattuale (riposo periodico trattato come festivo, art. 14 CCNL 25/07/1997), confermabile con l'avvocato.{coeff < 1 && <> L'indennità è calcolata come <strong>danno = {Math.round(coeff * 100)}% del valore</strong> del riposo perso.</>}{coeff > 1 && <> Il valore del riposo perso è <strong>maggiorato del {Math.round((coeff - 1) * 100)}%</strong> (maggiorazione confermata dal legale).</>}</span>
                </div>

                {/* Parametri di calcolo — owner: controlli attivi; viewer: SOLA LETTURA (parità di
                    vista con l'account consultazione, 11/07 — vede valorizzazione applicata e curva
                    €/h, senza editor). Persistono `coefficiente` e `tariffePerAnno`; l'override
                    tariffe è COMPLETO (rateFor fa cadere gli anni mancanti sul flat). */}
                <div className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Parametri di calcolo</h3>
                        </div>

                        {/* Valorizzazione serie B (coefficiente sul valore del riposo perso) */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 mr-1">Valorizzazione serie B</span>
                            {canManage ? VALORIZZAZIONI.map(({ v, label }) => {
                                const active = Math.abs((pratica.coefficiente ?? 1) - v) < 1e-9;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => { if (!active) onUpdate?.({ coefficiente: v }); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            }) : (
                                <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm">
                                    {VALORIZZAZIONI.find(o => Math.abs(coeff - o.v) < 1e-9)?.label ?? `× ${coeff}`}
                                </span>
                            )}
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 w-full sm:w-auto sm:ml-auto">Scelta del legale{canManage && ' · ricalcola tutto, nessun dato perso'}</span>
                        </div>

                        {/* Tariffa €/h per anno (override CCNL) */}
                        {Object.keys(rates).length > 0 && (
                            <div className="pt-4 border-t border-slate-200/70 dark:border-slate-700/50">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 mr-1">Tariffa €/h per anno</span>
                                    <span className="tabular-nums text-sm text-slate-600 dark:text-slate-300">{tariffaLabel(rates)}</span>
                                    {hasTariffeOverride
                                        ? <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">Personalizzata</span>
                                        : <span className="text-[11px] text-slate-400 dark:text-slate-500">derivata dalla fonte</span>}
                                    {canManage && (
                                    <button
                                        onClick={() => { if (tariffeOpen) { setTariffeOpen(false); setTariffeDraft(null); } else { setTariffeDraft(tariffeToDraft(rates)); setTariffeOpen(true); } }}
                                        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors"
                                    >
                                        {tariffeOpen ? 'Chiudi' : 'Personalizza'}
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tariffeOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    )}
                                </div>
                                {canManage && tariffeOpen && tariffeDraft && (
                                    <div className="mt-3">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                            {Object.keys(tariffeDraft).sort().map((y) => {
                                                const invalid = parseTariffaInput(tariffeDraft[y]) == null;
                                                return (
                                                    <label key={y} className="flex flex-col gap-1">
                                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{y}</span>
                                                        <div className={`flex items-center gap-1 rounded-lg border bg-white dark:bg-slate-900/60 px-2 py-1 ${invalid ? 'border-rose-400 dark:border-rose-500/60' : 'border-slate-200 dark:border-slate-700'}`}>
                                                            <span className="text-[11px] text-slate-400">€</span>
                                                            <input
                                                                inputMode="decimal"
                                                                value={tariffeDraft[y]}
                                                                onChange={(e) => setTariffeDraft({ ...tariffeDraft, [y]: e.target.value })}
                                                                className="w-full bg-transparent text-sm tabular-nums text-slate-800 dark:text-slate-100 outline-none"
                                                            />
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <button
                                                disabled={!tariffeParsed || !tariffeDirty}
                                                onClick={() => { if (tariffeParsed) { onUpdate?.({ tariffePerAnno: tariffeParsed }); setTariffeOpen(false); setTariffeDraft(null); } }}
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                                            >
                                                Salva tariffe
                                            </button>
                                            <button
                                                onClick={() => setTariffeDraft(tariffeToDraft(rates))}
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-colors"
                                            >
                                                Annulla
                                            </button>
                                            {hasTariffeOverride && (
                                                <button
                                                    onClick={() => { onUpdate?.({ tariffePerAnno: undefined }); setTariffeOpen(false); setTariffeDraft(null); }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400 transition-colors"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Ripristina curva derivata
                                                </button>
                                            )}
                                            {!tariffeParsed && <span className="text-[11px] text-rose-500">Ogni anno deve avere un importo €/h valido (&gt; 0).</span>}
                                            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">Sovrascrive la curva derivata · ricalcola tutto, nessun dato perso</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                </div>

                {/* Tabs — pill attivo colorato (gradiente tema) */}
                <div className="inline-flex gap-1 p-1 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur border border-white/60 dark:border-slate-700/60 shadow-sm">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => changeTab(id)} className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === id ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'}`}>
                            {tab === id && <motion.span layoutId="riposi-tab" className="absolute inset-0 rounded-xl shadow-md" style={{ background: RIPOSI_THEME.gradient, boxShadow: `0 8px 20px -8px ${RIPOSI_THEME.glow}` }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
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
                                    <div className="rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/10 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></span>
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Indennità secondo il PDF</span>
                                        </div>
                                        <p className="text-3xl font-black tabular-nums text-sky-700 dark:text-sky-300"><AnimatedCounter value={fonte.ind} isCurrency /></p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{groupThousandsIT(fonte.gg.toLocaleString('it-IT'))} giornate indennizzate · {groupThousandsIT(Math.round(fonte.ore).toLocaleString('it-IT'))} h mancanti · criteri del documento sorgente (valorizzazione contrattuale: riposo periodico = festivo)</p>
                                    </div>
                                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0"><Scale className="w-4 h-4" /></span>
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Indennità secondo il motore (Reg. 561/2006)</span>
                                        </div>
                                        <p className="text-3xl font-black tabular-nums text-indigo-700 dark:text-indigo-300"><AnimatedCounter value={result.totIndennita} isCurrency /></p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{totViol} violazioni · {groupThousandsIT(Math.round(result.totOreMancanti).toLocaleString('it-IT'))} h mancanti · tariffa per anno {tariffaLabel(rates)}{coeffSuffix(coeff)}</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">Criteri di calcolo diversi: la fonte applica le proprie regole, il motore le soglie del Reg. (CE) 561/2006 sui soli orari di turno. Le due serie si affiancano, non si sommano — confronto neutro per l'avvocato.</p>
                            </section>
                        )}

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {STAT.map(({ tone, icon: Icon, label, sub, node }) => (
                                <div key={label} className={`group relative overflow-hidden rounded-[1.6rem] backdrop-blur-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${TONE[tone].card} ${TONE[tone].hover}`}>
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${TONE[tone].icon}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <p className={`text-2xl font-black leading-tight tabular-nums ${TONE[tone].text}`}>{node}</p>
                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
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
                                <div className="relative flex items-end gap-2 flex-1 min-h-[10rem]">
                                    {/* Griglia di riferimento */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        {[0, 1, 2, 3].map((i) => <div key={i} className="h-px bg-slate-200/60 dark:bg-slate-700/40" />)}
                                    </div>
                                    {perAnno.map(({ y, g, s, tot }) => {
                                        const attivo = annoFiltro === y;
                                        const spento = annoFiltro !== null && !attivo;
                                        return (
                                            <button
                                                key={y}
                                                type="button"
                                                onClick={() => setAnnoFiltro(attivo ? null : y)}
                                                title={attivo ? 'Mostra tutti gli anni' : `Filtra l'elenco violazioni sul ${y}`}
                                                className={`group/bar relative flex-1 flex flex-col items-center justify-end h-full gap-1.5 transition-opacity duration-200 ${spento ? 'opacity-35 hover:opacity-70' : ''}`}
                                            >
                                                <span className={`text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300 transition-opacity ${attivo ? 'opacity-100' : 'opacity-0 group-hover/bar:opacity-100'}`}>{tot}</span>
                                                <div className={`w-full flex flex-col justify-end h-full rounded-t-md overflow-hidden transition-[filter] duration-300 group-hover/bar:brightness-110 ${attivo ? 'ring-2 ring-indigo-400/70 dark:ring-indigo-500/60' : ''}`}>
                                                    <div className="w-full" style={{ height: `${(g / maxAnno) * 100}%`, background: 'linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)' }} title={`${g} giornaliere`} />
                                                    <div className="w-full" style={{ height: `${(s / maxAnno) * 100}%`, background: `linear-gradient(180deg, ${RIPOSI_THEME.end} 0%, ${RIPOSI_THEME.start} 100%)` }} title={`${s} settimanali`} />
                                                </div>
                                                <span className={`text-[10px] tabular-nums ${attivo ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>'{y.slice(2)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">Clicca un anno per filtrare l'elenco violazioni qui sotto.</p>
                            </section>

                            <section className="lg:col-span-2 rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-5">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Dettaglio per anno</h3>
                                <div className="space-y-1">
                                    <div className="grid grid-cols-6 text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2">
                                        <span>Anno</span><span className="text-right">€/h</span><span className="text-right">G.</span><span className="text-right">S.</span><span className="text-right">€ mot.</span><span className="text-right">€ PDF</span>
                                    </div>
                                    {perAnnoRows.map(({ y, g, s, ind, indFonte, rate }) => (
                                        <div key={y} className="grid grid-cols-6 text-sm px-2 py-1.5 rounded-lg odd:bg-slate-50 dark:odd:bg-slate-800/40">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{y}</span>
                                            <span className="text-right tabular-nums text-indigo-600 dark:text-indigo-400" title="Tariffa €/h applicata a quest'anno (cresce per anzianità)">{rate != null ? rate.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
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
                                {violazioniVisibili.map((v, i) => <ViolazioneRow key={i} v={v} onOpenMese={() => openMeseProspetto(v.dataTurno ?? isoToKey(v.inizio))} />)}
                            </div>
                        </section>
                    </>
                ) : tab === 'confronto' ? (
                    <ConfrontoView giornate={pratica.giornate} confronto={confronto} fonte={fonte} result={result} />
                ) : meseAperto === null ? (
                    /* PROSPETTO — vista anno (griglia 12 mesi) */
                    <section className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                            <div className="flex flex-wrap items-center gap-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Prospetto turni <span className="text-slate-400 font-normal">{year}</span></h3>
                                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-200 dark:bg-indigo-500/30" /> turno</span>
                                    <span className="flex items-center gap-1.5" title="Giornata lavorata ma il PDF non ne riporta gli orari"><span className="w-2.5 h-2.5 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/30" /> turno senza orari</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700" /> riposo</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded ring-2 ring-rose-400" /> violazione</span>
                                    <span className="flex items-center gap-1.5" title="Servizio di linea oltre 50 km: giornata in perimetro Reg. (CE) 561/2006"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> CEE</span>
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
                        violazioni={result.violazioni}
                        focusData={giornoFocus}
                        onBack={() => { setMeseAperto(null); setGiornoFocus(null); }}
                        onNavigate={(d) => { setGiornoFocus(null); navigateMese(d); }}
                        canPrev={canPrevMese}
                        canNext={canNextMese}
                    />
                )}
            </div>

            {canExport && (
                <RelazioneRiposiModal
                    isOpen={isRelazioneOpen}
                    onClose={() => setIsRelazioneOpen(false)}
                    pratica={pratica}
                    result={result}
                    fonte={fonte}
                    onScarica={handleRelazioneDocx}
                    isExporting={isExportingDocx}
                    onStampa={() => printConteggiRiposi(pratica, result)}
                />
            )}
        </motion.div>
    );
};

// Modale "Relazione / come si calcola" — gemella in-app del report indennità:
// spiega il metodo, mostra un esempio numerico REALE preso dalle violazioni della
// pratica, i totali e le riserve; da qui si scarica il .docx o si stampa.
interface RelazioneRiposiModalProps {
    isOpen: boolean;
    onClose: () => void;
    pratica: PraticaRiposi;
    result: RestResult;
    fonte: { gg: number; ore: number; ind: number };
    onScarica: () => void;
    isExporting: boolean;
    onStampa: () => void;
}

const RelazioneRiposiModal: React.FC<RelazioneRiposiModalProps> = ({ isOpen, onClose, pratica, result, fonte, onScarica, isExporting, onStampa }) => {
    // Esempio didattico: la violazione con più ore mancanti (la più rappresentativa).
    const esempio = useMemo<Violazione | null>(
        () => result.violazioni.reduce<Violazione | null>((best, v) => (!best || v.oreMancanti > best.oreMancanti ? v : best), null),
        [result]
    );
    if (!isOpen) return null;

    const totViol = result.nViolazioniGiornaliere + result.nViolazioniSettimanali;
    const coeff = pratica.coefficiente ?? 1;
    const rates = result.tariffePerAnnoApplicate;
    // Tariffa oraria PIENA dell'anno dell'esempio (il coefficiente è un fattore a parte).
    const rateEsempio = esempio ? (rates[esempio.inizio.slice(0, 4)] ?? pratica.tariffaOraria) : pratica.tariffaOraria;
    const stat = (label: string, value: string, sub?: string) => (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
            <p className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100 leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
            >
                <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">Relazione — come si calcola</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{pratica.cognome} {pratica.nome} · metodo e numeri di questa pratica</p>
                    </div>
                    <button onClick={onClose} title="Chiudi" className="ml-auto shrink-0 w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <section>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Cosa misura</h3>
                        <p className="mb-2">Sui soli orari di turno si verifica il rispetto dei riposi minimi del personale viaggiante previsti dal <b>Reg. (CE) 561/2006</b> (art. 8), attuato dal <b>D.Lgs. 234/2007</b>:</p>
                        <ul className="space-y-1.5 pl-1">
                            <li className="flex gap-2"><Moon className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" /><span><b>Riposo giornaliero</b>: almeno <b>11 ore</b> consecutive ogni 24h (riducibile a 9h max 3 volte tra due riposi settimanali — queste riduzioni sono lecite e non contano).</span></li>
                            <li className="flex gap-2"><CalendarClock className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" /><span><b>Riposo settimanale</b>: almeno <b>45 ore</b> consecutive (24h solo in alternanza con uno regolare).</span></li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
                        <h3 className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300 mb-3"><Euro className="w-4 h-4" /> Esempio dai tuoi dati</h3>
                        {esempio ? (
                            <>
                                <p className="mb-2">{esempio.tipo === 'riposo_giornaliero' ? 'Riposo giornaliero' : 'Riposo settimanale'} del <b>{dmy(esempio.inizio)}</b>:</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between"><span>Soglia di legge</span><span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{esempio.soglia} h</span></div>
                                    <div className="flex items-center justify-between"><span>Riposo fruito</span><span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatHm(esempio.ore)}</span></div>
                                    <div className="flex items-center justify-between border-t border-indigo-200/60 dark:border-indigo-500/20 pt-1.5"><span>Ore mancanti</span><span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{esempio.soglia} h − {formatHm(esempio.ore)} = {formatHm(esempio.oreMancanti)}</span></div>
                                    <div className="flex items-center justify-between"><span className="font-semibold text-indigo-700 dark:text-indigo-300">Indennità</span><span className="font-black tabular-nums text-indigo-700 dark:text-indigo-300">{formatHm(esempio.oreMancanti)} × {euro(rateEsempio)}/h{coeffSuffix(coeff)} = {euro(esempio.indennita)}</span></div>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">La tariffa è quella del {esempio.inizio.slice(0, 4)} ({euro(rateEsempio)}/h): cresce per anzianità di servizio, quindi ogni anno è valorizzato alla sua.{coeff < 1 ? ` Sul valore si applica il ${Math.round(coeff * 100)}% (danno).` : coeff > 1 ? ` Il valore è maggiorato del ${Math.round((coeff - 1) * 100)}%.` : ''} Lo stesso procedimento è applicato a ogni riposo non conforme e sommato per anno.</p>
                            </>
                        ) : (
                            <p>Nessuna violazione rilevata nel periodo analizzato.</p>
                        )}
                    </section>

                    <section>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">I numeri di questa pratica</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {stat('Violazioni', String(totViol), `${result.nViolazioniGiornaliere} giorn. · ${result.nViolazioniSettimanali} sett.`)}
                            {stat('Ore mancanti', formatHm(result.totOreMancanti))}
                            {stat('Indennità (motore)', euro(result.totIndennita), `tariffa per anno ${tariffaLabel(rates)}${coeffSuffix(coeff)}`)}
                            {fonte.gg > 0 && stat('Indennità (PDF)', euro(fonte.ind), `${fonte.gg} giornate · criteri della fonte`)}
                        </div>
                    </section>

                    <section>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Riserve</h3>
                        <ul className="space-y-1.5 pl-1 text-[13px]">
                            <li className="flex gap-2"><span className="text-amber-500">•</span><span><b>Tariffa</b>: ricavata <b>anno per anno</b> dal documento sorgente ({tariffaLabel(rates)}, cresce per anzianità di servizio); la fonte CCNL (tabellare o con maggiorazione) è confermabile con l'avvocato e, alla conferma, l'indennità si ricalcola.</span></li>
                            <li className="flex gap-2"><span className="text-amber-500">•</span><span><b>Valorizzazione (coefficiente)</b>: {coeff < 1 ? <>l'indennità è il <b>{Math.round(coeff * 100)}% del valore</b> del riposo perso (danno, criterio del legale).</> : coeff > 1 ? <>il valore del riposo perso è <b>maggiorato del {Math.round((coeff - 1) * 100)}%</b> (maggiorazione, criterio del legale).</> : <>è applicato il <b>valore pieno</b> (100%); la maggiorazione +20% (o il «danno = 20%») va confermata dal legale e si attiva senza ricalcoli manuali.</>}</span></li>
                            <li className="flex gap-2"><span className="text-amber-500">•</span><span><b>Due serie</b>: l'indennità «motore» (Reg. 561/2006) e quella «PDF» (criteri di chi ha prodotto il documento) si <b>affiancano, non si sommano</b>.</span></li>
                            <li className="flex gap-2"><span className="text-amber-500">•</span><span><b>Pausa di guida (art. 7)</b>: richiede il cronotachigrafo, non presente nei turni → fuori perimetro.</span></li>
                            <li className="flex gap-2"><span className="text-amber-500">•</span><span><b>Codici di servizio</b>: la legenda dei turni va richiesta all'azienda.</span></li>
                        </ul>
                    </section>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={onStampa} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap">
                        <Printer className="w-4 h-4" /> Stampa conteggi
                    </button>
                    <button type="button" onClick={onScarica} disabled={isExporting} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap">
                        <FileText className="w-4 h-4" /> {isExporting ? 'Genero…' : 'Scarica .docx'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const NO_VIOL_DAYS = new Set<string>(); // placeholder per MeseCalendario in modo confronto (violDays non usato)

const CONFRONTO_CELL: Record<ConfrontoStato, string> = {
    entrambi: 'bg-emerald-400 text-white dark:bg-emerald-500',
    pdf: 'bg-amber-300 text-amber-900 dark:bg-amber-400/80 dark:text-amber-950',
    nostra: 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500',
};

const MeseCalendario: React.FC<{ year: number; month: number; byData: Map<string, GiornataInput>; violDays: Set<string>; active: boolean; onSelect?: () => void; marks?: Record<string, ConfrontoStato>; onDayClick?: (k: string) => void; selectedDay?: string | null }> = ({ year, month, byData, violDays, active, onSelect, marks, onDayClick, selectedDay }) => {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7; // settimana che parte da lunedì
    const numDays = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];
    const key = (d: number) => `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    // Pallino teal = giornata CEE (in perimetro Reg. 561/2006)
    const ceeDot = <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-teal-500" />;
    const inner = (
        <>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{MESI[month]}</p>
            <div className="grid grid-cols-7 gap-1">
                {WEEK.map((w, i) => <span key={`w${i}`} className="text-[9px] text-center text-slate-300 dark:text-slate-600 font-bold">{w}</span>)}
                {cells.map((d, i) => {
                    if (d === null) return <span key={i} />;
                    const k = key(d);
                    const g = byData.get(k);
                    const riposo = !g || isRiposo(g);
                    const cee = isCEEDay(g);
                    // Modo CONFRONTO: colora per sovrapposizione PDF/nostra/entrambi; i giorni
                    // non marcati restano tenui per far risaltare le differenze. Il click sul
                    // giorno apre il dettaglio in parole (richiesta Vincenzo 11/07).
                    if (marks) {
                        const mark = marks[k];
                        const tip = mark === 'entrambi' ? `${weekday(k)} ${k} · PDF + nostra violazione (concordi)`
                            : mark === 'pdf' ? `${weekday(k)} ${k} · solo PDF (noi non la conteggiamo)`
                            : mark === 'nostra' ? `${weekday(k)} ${k} · solo nostra violazione (561/2006)`
                            : g ? `${weekday(k)} ${k} · ${riposo ? 'riposo' : 'turno'}` : k;
                        const cls = `relative aspect-square rounded-md flex items-center justify-center text-[9px] font-semibold tabular-nums ${
                            mark ? CONFRONTO_CELL[mark]
                            : !g ? 'text-slate-300 dark:text-slate-700'
                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600'
                        } ${selectedDay === k ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`;
                        return onDayClick && g ? (
                            <button key={i} type="button" title={`${tip} — clicca per il dettaglio`} onClick={() => onDayClick(k)} className={`${cls} cursor-pointer hover:brightness-95 dark:hover:brightness-125`}>
                                {d}{cee && ceeDot}
                            </button>
                        ) : (
                            <span key={i} title={tip} className={cls}>{d}{cee && ceeDot}</span>
                        );
                    }
                    const viol = violDays.has(k);
                    const lavNoOre = isLavoratoSenzaOrari(g);
                    const tip = g
                        ? (lavNoOre ? `${weekday(k)} ${k} · turno ${g.servizio} · orari non indicati nel PDF${cee ? ' · CEE' : ''}`
                        : isRiposo(g) ? `${weekday(k)} ${k} · ${servLabel(g.servizio ?? 'R') === 'sigla da decodificare' ? 'riposo' : servLabel(g.servizio ?? 'R')}${g.servizio ? ` (${g.servizio})` : ''}`
                        : `${weekday(k)} ${k} · turno ${g.servizio ?? ''} · ${g.inizio}–${g.termine}${cee ? ' · CEE' : ''}${viol ? ' · VIOLAZIONE (apri il mese per il dettaglio)' : ''}`)
                        : k;
                    return (
                        <span
                            key={i}
                            title={tip}
                            className={`relative aspect-square rounded-md flex items-center justify-center text-[9px] font-semibold tabular-nums ${
                                !g ? 'text-slate-300 dark:text-slate-700'
                                : lavNoOre ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-400 dark:text-indigo-300/70'
                                : riposo ? 'bg-slate-100 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500'
                                : 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300'
                            } ${viol ? 'ring-2 ring-rose-400 dark:ring-rose-500' : ''}`}
                        >
                            {d}{cee && ceeDot}
                        </span>
                    );
                })}
            </div>
        </>
    );
    return onSelect
        ? <button type="button" onClick={onSelect} className={`text-left rounded-2xl border bg-white/40 dark:bg-slate-800/40 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-400/60' : 'border-slate-100 dark:border-slate-700/60'}`}>{inner}</button>
        : <div className="rounded-2xl border bg-white/40 dark:bg-slate-800/40 p-3 border-slate-100 dark:border-slate-700/60">{inner}</div>;
};

// Tab "Confronto": sovrappone i giorni segnati dal PDF e le nostre violazioni 561/2006,
// con riconciliazione conteggi/€ e nota onesta sul settimanale (granularità diversa).
const ConfrontoView: React.FC<{ giornate: GiornataInput[]; confronto: ConfrontoResult; fonte: { gg: number; ind: number }; result: RestResult }> = ({ giornate, confronto, fonte, result }) => {
    const years = useMemo(() => Array.from(new Set(giornate.map((g) => yearOf(g.data)).filter(Boolean))).sort(), [giornate]);
    const [year, setYear] = useState<string>(() => years[years.length - 1] ?? '');
    const byData = useMemo(() => { const m = new Map<string, GiornataInput>(); for (const g of giornate) if (yearOf(g.data) === year) m.set(g.data, g); return m; }, [giornate, year]);
    const totViol = result.nViolazioniGiornaliere + result.nViolazioniSettimanali;
    const pct = fonte.ind > 0 ? Math.round((1 - result.totIndennita / fonte.ind) * 100) : 0;
    // Dettaglio del giorno cliccato: cosa dice il PDF e cosa dice il nostro motore, in parole.
    const [giornoSel, setGiornoSel] = useState<string | null>(null);
    const violByDay = useMemo(() => {
        const m = new Map<string, Violazione[]>();
        for (const v of result.violazioni) {
            const k = v.dataTurno ?? isoToKey(v.inizio);
            m.set(k, [...(m.get(k) ?? []), v]);
        }
        return m;
    }, [result]);
    const soloCEE = useMemo(() => hasCEEDays(giornate), [giornate]);
    const gSel = giornoSel ? byData.get(giornoSel) : undefined;
    const violSel = giornoSel ? violByDay.get(giornoSel) ?? [] : [];
    const markSel = giornoSel ? confronto.perGiorno[giornoSel] : undefined;

    return (
        <section className="rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 p-6 space-y-5">
            {/* Banda riconciliazione: PDF vs nostro metodo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 mb-1 text-amber-700 dark:text-amber-300"><FileText className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wide">Documento sorgente (PDF)</span></div>
                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100">{euro(fonte.ind)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{groupThousandsIT(confronto.pdfGiorni.toLocaleString('it-IT'))} giorni indennizzati · criteri del documento</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
                    <div className="flex items-center gap-2 mb-1 text-indigo-700 dark:text-indigo-300"><Scale className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wide">Nostro metodo (Reg. 561/2006)</span></div>
                    <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100">{euro(result.totIndennita)} {pct > 0 && <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">−{pct}%</span>}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{totViol} violazioni · {confronto.nostreGiorn} giorn. · {confronto.nostreSett} sett.</p>
                </div>
            </div>

            {/* Ragioni del divario */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Perché il nostro è più basso:</span>
                {['solo giornate CEE', 'ridotti giornalieri leciti', 'alternanza settimanale (no doppio ridotto)'].map((r) => (
                    <span key={r} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{r}</span>
                ))}
            </div>

            {/* Legenda + selettore anno */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400" /> concordi (entrambi)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-300" /> solo PDF</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded ring-2 ring-indigo-500" /> solo nostro</span>
                    <span className="flex items-center gap-1.5" title="Servizio di linea oltre 50 km: in perimetro Reg. (CE) 561/2006"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> CEE</span>
                </div>
                <div className="flex flex-wrap gap-1">
                    {years.map((y) => (
                        <button key={y} onClick={() => { setYear(y); setGiornoSel(null); }} className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors ${year === y ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600'}`}>{y}</button>
                    ))}
                </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">Clicca un giorno del calendario: qui sotto compare la spiegazione di cosa dice il PDF e cosa dice il nostro metodo.</p>

            {/* Griglia 12 mesi con sovrapposizione PDF/nostro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {MESI.map((_, m) => <MeseCalendario key={m} year={Number(year)} month={m} byData={byData} violDays={NO_VIOL_DAYS} active={false} marks={confronto.perGiorno} onDayClick={(k) => setGiornoSel(giornoSel === k ? null : k)} selectedDay={giornoSel} />)}
            </div>

            {/* Dettaglio del giorno selezionato: le due letture a confronto, in parole */}
            {giornoSel && gSel && (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-500/5 p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-800 dark:text-slate-100">{weekday(giornoSel)} {giornoSel}</p>
                        {isRiposo(gSel)
                            ? <span className="text-sm text-slate-500 dark:text-slate-400">{servLabel(gSel.servizio ?? 'R')}{gSel.servizio ? ` (${gSel.servizio})` : ''}</span>
                            : <span className="text-sm text-slate-500 dark:text-slate-400">turno {gSel.servizio ?? ''} · {gSel.inizio}–{gSel.termine}</span>}
                        {isCEEDay(gSel) && <span className={CEE_CHIP} title="Servizio di linea oltre 50 km">CEE</span>}
                        {markSel && <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${markSel === 'entrambi' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : markSel === 'pdf' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'}`}>{markSel === 'entrambi' ? 'concordi' : markSel === 'pdf' ? 'solo PDF' : 'solo nostro'}</span>}
                        <button type="button" onClick={() => setGiornoSel(null)} className="ml-auto w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px] leading-relaxed">
                        <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 border border-amber-200/70 dark:border-amber-500/30 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">Cosa dice il PDF sorgente</p>
                            {(gSel.mancatoRipGiorn || gSel.mancatoRipSett) ? (
                                <>
                                    {gSel.mancatoRipGiorn && <p className="text-slate-700 dark:text-slate-200">Mancato riposo <b>giornaliero</b> di <b>{formatHm(parseHmm(gSel.mancatoRipGiorn) / 60)}</b> (minimo 11h/giorno).</p>}
                                    {gSel.mancatoRipSett && <p className="text-slate-700 dark:text-slate-200">Mancato riposo <b>settimanale</b> di <b>{formatHm(parseHmm(gSel.mancatoRipSett) / 60)}</b> (minimo 45h{parseHmm(gSel.mancatoRipSett) / 60 >= 45 ? ' — riconosciute per intero: riposo non fatto in tempo utile' : ''}).</p>}
                                    {gSel.indennitaFonte != null && <p className="text-slate-500 dark:text-slate-400 mt-1">Indennità del documento: <b className="text-sky-600 dark:text-sky-400">{euro(gSel.indennitaFonte)}</b></p>}
                                </>
                            ) : (
                                <p className="text-slate-500 dark:text-slate-400">Nessun mancato riposo indennizzato su questo giorno.</p>
                            )}
                        </div>
                        <div className="rounded-xl bg-white/70 dark:bg-slate-800/60 border border-indigo-200/70 dark:border-indigo-500/30 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1.5">Cosa dice il nostro metodo (Reg. 561/2006)</p>
                            {violSel.length > 0 ? violSel.map((v, i) => (
                                <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60' : ''}>
                                    <p className="text-slate-700 dark:text-slate-200">{v.motivo}.</p>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1 tabular-nums">Mancano <b className="text-rose-600 dark:text-rose-400">{formatHm(v.oreMancanti)}</b> · indennità {euro(v.indennita)} · <span className="italic">{v.rifNormativo}</span></p>
                                </div>
                            )) : (
                                <p className="text-slate-500 dark:text-slate-400">
                                    Nessuna nostra violazione attribuita a questo giorno.
                                    {(gSel.mancatoRipGiorn || gSel.mancatoRipSett) && (
                                        soloCEE && !isCEEDay(gSel)
                                            ? ' Motivo: la giornata non è marcata CEE, quindi resta fuori dal perimetro del calcolo (si contano solo i servizi di linea oltre 50 km).'
                                            : gSel.mancatoRipSett
                                                ? ' Motivo probabile: il PDF spalma il mancato settimanale su più giorni (a scorrimento), noi lo contiamo una volta per evento — il confronto giusto è su numero e importo, non sul singolo giorno.'
                                                : ' Motivo probabile: riduzione lecita per il Reg. 561/2006 (riposo 9–11h consentito fino a 3 volte tra due riposi settimanali).'
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Nota onesta sul settimanale */}
            <div className="flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 px-4 py-3 text-[12px] text-slate-600 dark:text-slate-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>I riposi <strong>giornalieri</strong> si allineano bene ({confronto.concordiGiorn} su {confronto.nostreGiorn} nostre cadono su un giorno indennizzato dal PDF). I <strong>settimanali</strong> no: il PDF li conta giorno-per-giorno (a scorrimento), noi una volta per evento → per il settimanale conta il confronto su <strong>numero e importo</strong>, non sul singolo giorno del calendario.</span>
            </div>
        </section>
    );
};

const MeseFocus: React.FC<{ year: number; month: number; giornate: GiornataInput[]; violDays: Set<string>; violazioni: Violazione[]; focusData?: string | null; onBack: () => void; onNavigate: (delta: 1 | -1) => void; canPrev: boolean; canNext: boolean }> = ({ year, month, giornate, violDays, violazioni, focusData, onBack, onNavigate, canPrev, canNext }) => {
    // I giorni lavorati SENZA orari contano come turno (come nel motore), non come riposo.
    const nLav = giornate.filter((g) => !isRiposo(g) || isLavoratoSenzaOrari(g)).length;
    const nRiposi = giornate.length - nLav;
    const nViol = giornate.filter((g) => violDays.has(g.data)).length;
    const indFonteMese = giornate.reduce((a, g) => a + (g.indennitaFonte ?? 0), 0);
    const hasFonte = giornate.some((g) => g.indennitaFonte != null);
    // Giorno selezionato (dalla riga in tabella o dal cross-link violazione→prospetto):
    // evidenzia la riga E la spiegazione corrispondente nella card a fianco.
    const [giornoSel, setGiornoSel] = useState<string | null>(focusData ?? null);
    useEffect(() => { setGiornoSel(focusData ?? null); }, [focusData, month, year]);
    // Violazioni del NOSTRO motore attribuite ai giorni di questo mese (dataTurno).
    const violMese = useMemo(() => {
        const suff = `/${String(month + 1).padStart(2, '0')}/${year}`;
        return violazioni
            .map((v) => ({ v, day: v.dataTurno ?? isoToKey(v.inizio) }))
            .filter(({ day }) => day.endsWith(suff))
            .sort((a, b) => a.day.localeCompare(b.day));
    }, [violazioni, month, year]);
    // Il PDF indica un mancato riposo su giorni che il nostro motore può non contare:
    // anche quelli vanno spiegati (colonna "Manc. PDF").
    const pdfManc = (g: GiornataInput): string | null => {
        const parts: string[] = [];
        if (g.mancatoRipGiorn) parts.push(`G ${formatHm(parseHmm(g.mancatoRipGiorn) / 60)}`);
        if (g.mancatoRipSett) parts.push(`S ${formatHm(parseHmm(g.mancatoRipSett) / 60)}`);
        return parts.length ? parts.join(' · ') : null;
    };
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
                                {hasFonte && <th className="text-right font-bold px-3 py-2.5" title="Mancato riposo secondo il PDF sorgente: G = giornaliero, S = settimanale">Manc. PDF</th>}
                                {hasFonte && <th className="text-right font-bold px-4 py-2.5">€ PDF</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {giornate.map((g, i) => {
                                const riposo = isRiposo(g);
                                const viol = violDays.has(g.data);
                                const sel = giornoSel === g.data;
                                const manc = pdfManc(g);
                                return (
                                    <tr
                                        key={i}
                                        onClick={() => setGiornoSel(sel ? null : g.data)}
                                        title={viol ? 'Clicca: la spiegazione della violazione si evidenzia qui a fianco' : undefined}
                                        className={`border-t border-slate-100 dark:border-slate-700/40 cursor-pointer transition-colors ${sel ? 'bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-500/50' : viol ? 'bg-rose-50/70 dark:bg-rose-500/10 hover:bg-rose-100/70 dark:hover:bg-rose-500/15' : 'odd:bg-slate-50/50 dark:odd:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'}`}
                                    >
                                        <td className={`px-4 py-2 tabular-nums font-medium ${riposo ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                            <span className="inline-flex items-center gap-2">{viol && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}{g.data}</span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{weekday(g.data)}</td>
                                        <td className="px-3 py-2">
                                            <span className="inline-flex items-center gap-1.5">
                                                {isLavoratoSenzaOrari(g)
                                                    ? <span className="font-semibold text-indigo-400 dark:text-indigo-300/80" title="Giornata lavorata: il PDF non riporta gli orari di questo turno">{g.servizio} <span className="font-normal text-[10px] text-slate-400 dark:text-slate-500">(senza orari)</span></span>
                                                    : riposo ? <span className="text-slate-400 dark:text-slate-500">{g.servizio ?? '—'}</span> : <span className="font-semibold text-indigo-600 dark:text-indigo-400">{g.servizio ?? '—'}</span>}
                                                {isCEEDay(g) && <span className={CEE_CHIP} title="Servizio di linea oltre 50 km: in perimetro Reg. (CE) 561/2006">CEE</span>}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{g.inizio ?? '—'}</td>
                                        <td className={`${hasFonte ? 'px-3' : 'px-4'} py-2 text-right tabular-nums text-slate-600 dark:text-slate-300`}>{g.termine ?? '—'}</td>
                                        {hasFonte && <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">{manc ?? <span className="text-slate-300 dark:text-slate-600">—</span>}</td>}
                                        {hasFonte && <td className="px-4 py-2 text-right tabular-nums font-semibold text-sky-600 dark:text-sky-400">{g.indennitaFonte != null ? groupThousandsIT(g.indennitaFonte.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : <span className="font-normal text-slate-300 dark:text-slate-600">—</span>}</td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Legenda verticale */}
                <aside className="space-y-4">
                    {/* Spiegazione delle violazioni del mese (richiesta Vincenzo 11/07):
                        per ogni violazione il PERCHÉ (motivo del motore) + riferimento giuridico.
                        Cliccando una riga violata in tabella si evidenzia la sua spiegazione. */}
                    {violMese.length > 0 && (
                        <div className="rounded-2xl border border-rose-200/70 dark:border-rose-500/30 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-400 mb-3">Violazioni del mese — spiegazione</p>
                            <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
                                {violMese.map(({ v, day }, i) => {
                                    const isSett = v.tipo === 'riposo_settimanale';
                                    const sel = giornoSel === day;
                                    return (
                                        <div key={i} className={`rounded-xl border p-3 text-[12px] leading-relaxed transition-all ${sel ? 'border-indigo-300 dark:border-indigo-500/60 bg-indigo-50/70 dark:bg-indigo-500/10 ring-2 ring-indigo-300/60 dark:ring-indigo-500/40' : 'border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40'}`}>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                                {isSett ? <CalendarClock className="w-3.5 h-3.5 text-indigo-500" /> : <Moon className="w-3.5 h-3.5 text-rose-500" />}
                                                {weekday(day)} {day}
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${v.gravita === 'grave' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>{v.gravita}</span>
                                                {v.cee && <span className={CEE_CHIP}>CEE</span>}
                                            </p>
                                            <p className="text-slate-600 dark:text-slate-300 mt-1">{v.motivo}.</p>
                                            <p className="text-slate-400 dark:text-slate-500 mt-1 tabular-nums">Mancano <b className="text-rose-600 dark:text-rose-400">{formatHm(v.oreMancanti)}</b> sul minimo di {formatHm(v.soglia)} · indennità {euro(v.indennita)}</p>
                                            <p className="text-slate-400 dark:text-slate-500 mt-0.5 italic">{v.rifNormativo}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/30" /> Turno senza orari nel PDF</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-700" /> Riposo</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded ring-2 ring-rose-400" /> Giorno con violazione</div>
                            <div className="flex items-center gap-2"><span className={CEE_CHIP}>CEE</span> Servizio di linea &gt;50 km (Reg. 561/2006)</div>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">Clicca una riga della tabella per evidenziare la spiegazione della sua violazione.</p>
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

// Riga violazione ESPANDIBILE: il click apre la spiegazione dettagliata (perché è una
// violazione, con le parole del motore) + il riferimento giuridico — richiesta di
// Vincenzo 11/07: "al click deve spiegare bene che tipo di violazione c'è".
const ViolazioneRow: React.FC<{ v: Violazione; onOpenMese: () => void }> = ({ v, onOpenMese }) => {
    const [open, setOpen] = useState(false);
    const isSett = v.tipo === 'riposo_settimanale';
    const Icon = isSett ? CalendarClock : Moon;
    return (
        <div className={`rounded-xl border transition-colors ${open ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' : 'bg-slate-50/80 dark:bg-slate-800/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                title={open ? 'Chiudi la spiegazione' : 'Apri la spiegazione della violazione'}
                className="w-full flex items-center gap-3 px-3 py-2 text-left group"
            >
                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${isSett ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-500 dark:text-rose-400'}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {dmy(v.inizio)} <span className="font-normal text-slate-400">→</span> {dmy(v.fine)}
                        <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${v.gravita === 'grave' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>{v.gravita}</span>
                        {v.cee && <span className={`ml-1.5 ${CEE_CHIP}`}>CEE</span>}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{isSett ? 'Mancato riposo settimanale' : 'Mancato riposo giornaliero'} · {v.rifNormativo}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{formatHm(v.ore)}</p>
                    <p className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">manc {formatHm(v.oreMancanti)}</p>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>
            {open && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 text-sm border-t border-slate-100 dark:border-slate-700/60 mx-3 -mt-0.5">
                    <p className="pt-2 text-slate-700 dark:text-slate-200 leading-relaxed"><b>Perché è una violazione:</b> {v.motivo}.</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>Riposo fruito: <b className="text-slate-700 dark:text-slate-200">{formatHm(v.ore)}</b></span>
                        <span>Minimo di legge: <b className="text-slate-700 dark:text-slate-200">{formatHm(v.soglia)}</b></span>
                        <span>Ore mancanti: <b className="text-rose-600 dark:text-rose-400">{formatHm(v.oreMancanti)}</b></span>
                        <span>Indennità: <b className="text-slate-700 dark:text-slate-200">{euro(v.indennita)}</b></span>
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400"><b>Riferimento giuridico:</b> {v.rifNormativo}.</p>
                    {v.cee && <p className="text-[12px] text-teal-700 dark:text-teal-300">Giornata <b>CEE</b>: servizio di linea oltre 50 km, in perimetro Reg. (CE) 561/2006 — rientra nel calcolo.</p>}
                    <button
                        type="button"
                        onClick={onOpenMese}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
                    >
                        <CalendarDays className="w-3.5 h-3.5" /> Vedi il giorno nel Prospetto turni
                    </button>
                </div>
            )}
        </div>
    );
};

export default RiposiPraticaDetail;
