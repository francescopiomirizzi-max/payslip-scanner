import React, { useMemo } from 'react';
import { ArrowLeft, FileText, FileSpreadsheet, Printer, Scale, ShieldAlert, Info, MapPin, Euro, CalendarClock, Clock, Wallet } from 'lucide-react';
import { computeVertenza, annoMinimoNonPrescritto } from '../utils/vertenzaEngine';
import { STATO_META_VERTENZA, type PraticaVertenza, type PraticaVertenzaUpdate } from '../hooks/usePraticheVertenze';
import { CompanyLogo } from './ui/CompanyLogo';
import { useIsReadOnly } from '../lib/readonly';
import { VERTENZE_THEME, vertenzeHeaderBand, STATO_HEX_VERTENZA } from './vertenze/vertenzeTheme';

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const tar = (n: number) => `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/h`;

interface Props {
    pratica: PraticaVertenza;
    onBack: () => void;
    onUpdate?: (fields: PraticaVertenzaUpdate) => void;
}

/**
 * Dettaglio di una pratica "indennità assenza residenza".
 * Cuore DIVERSO dai riposi: confronto Pagato↔Dovuto per voce (la tesi "preso meno
 * del dovuto") + timeline di prescrizione (elemento esclusivo). Identità rame.
 */
const VertenzaDetail: React.FC<Props> = ({ pratica, onBack, onUpdate }) => {
    const isReadOnly = useIsReadOnly();
    const result = useMemo(
        () => computeVertenza(pratica.voci, pratica.prescrizione, { coefficiente: pratica.coefficiente }),
        [pratica],
    );
    const vuota = pratica.voci.every((v) => v.righe.length === 0);
    const coeff = pratica.coefficiente ?? 1;
    const oreTot = useMemo(() => result.perVoce.reduce((s, v) => s + v.ore, 0), [result]);
    const stato = STATO_META_VERTENZA[pratica.stato];
    const statoHex = STATO_HEX_VERTENZA[pratica.stato] ?? '#94a3b8';

    return (
        <div className="min-h-screen px-6 py-10">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* ── HERO — identità pratica + cruscotto numerico ── */}
                <header className="relative overflow-hidden rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-6 shadow-xl">
                    <div className="absolute inset-x-0 top-0 h-32 pointer-events-none" style={{ background: vertenzeHeaderBand }} />
                    {/* Tacca stato con glow */}
                    <div className="absolute left-0 top-8 bottom-8 w-[5px] rounded-r-full" style={{ background: `linear-gradient(180deg, ${statoHex}00 0%, ${statoHex} 14%, ${statoHex} 86%, ${statoHex}00 100%)`, boxShadow: `0 0 14px 2px ${statoHex}55` }} />

                    <div className="relative flex items-start gap-4">
                        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/80 dark:bg-slate-900/60 backdrop-blur border border-white/70 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:-translate-x-0.5 transition-all shrink-0 shadow-sm">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="relative shrink-0">
                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 opacity-50 blur-md" />
                            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: VERTENZE_THEME.gradient, boxShadow: `0 10px 30px -8px ${VERTENZE_THEME.glow}` }}>
                                <MapPin className="w-7 h-7" />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                                <span className="uppercase tracking-tight">{pratica.cognome}</span> <span className="capitalize font-bold text-slate-500 dark:text-slate-400">{pratica.nome}</span>
                            </h1>
                            <span className="inline-flex items-center gap-2 mt-1">
                                <CompanyLogo profilo="ELIOR" eliorType="viaggiante" h={18} title="Elior viaggiante" />
                                <span className="text-sm text-slate-500 dark:text-slate-400 truncate">Indennità assenza residenza · {pratica.periodoStart}–{pratica.periodoEnd}</span>
                            </span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${stato.chip}`} style={{ boxShadow: `0 0 0 1px ${statoHex}33, 0 3px 12px -2px ${statoHex}66` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statoHex, boxShadow: `0 0 6px ${statoHex}` }} />{stato.label}
                        </span>
                    </div>

                    {/* Cruscotto numerico */}
                    <div className="relative mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-700/40 px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400/80" /><p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/70">Credito stimato</p></div>
                            <p className="text-2xl font-black tabular-nums leading-none text-emerald-700 dark:text-emerald-300">{vuota ? '—' : eur0(result.totCredito)}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-700/40 px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1"><CalendarClock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400/80" /><p className="text-[9px] font-black uppercase tracking-widest text-amber-600/80 dark:text-amber-400/70">Anni</p></div>
                            <p className="text-2xl font-black tabular-nums leading-none text-amber-700 dark:text-amber-300">{vuota ? '—' : result.perAnno.length}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-slate-400" /><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ore indennità</p></div>
                            <p className="text-2xl font-black tabular-nums leading-none text-slate-700 dark:text-slate-200">{vuota ? '—' : oreTot.toLocaleString('it-IT')}</p>
                        </div>
                    </div>
                </header>

                {/* Selettore coefficiente (owner only) */}
                {!isReadOnly && onUpdate && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Valorizzazione</span>
                        {[{ v: 1, label: 'Valore pieno · 100%' }, { v: 0.20, label: 'Danno · 20%' }].map(({ v, label }) => {
                            const active = Math.abs(coeff - v) < 1e-9;
                            return (
                                <button
                                    key={label}
                                    onClick={() => { if (!active) onUpdate({ coefficiente: v }); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/30' : 'bg-white/70 dark:bg-slate-800/70 backdrop-blur text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:-translate-y-0.5'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Scelta del legale · ricalcola tutto</span>
                    </div>
                )}

                {/* Banner metodologico */}
                <div className="flex gap-3 rounded-2xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 text-sm text-amber-900 dark:text-amber-200 backdrop-blur">
                    <Scale className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="leading-relaxed">
                        <strong>Base giuridica</strong> — CCNL Multiservizi/Ristorazione 2016, art. 77: l'indennità di assenza
                        dalla residenza è dovuta nella misura piena (<strong>1,30 €/h</strong> voce 4300, <strong>2,20 €/h</strong> voce 4305).
                        La misura corrisposta è ridotta (0,75 / 1,00 €/h): la differenza, rivalutata e nel rispetto della
                        prescrizione quinquennale, è il credito.
                    </p>
                </div>

                {vuota && (
                    <div className="flex gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
                        <Info className="w-5 h-5 shrink-0 text-slate-400" />
                        <p>Per questo lavoratore gli importi <strong>4300/4305</strong> non sono ancora stati estratti dalle buste:
                            la struttura è pronta, i numeri compaiono dopo l'estrazione (OCR del viaggiante).</p>
                    </div>
                )}

                {/* Timeline prescrizione */}
                <TimelinePrescrizione pratica={pratica} />

                {/* Confronto Pagato ↔ Dovuto */}
                <section className="rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><Scale className="w-4 h-4" /></span>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Confronto Pagato ↔ Dovuto</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/80">
                                    <th className="text-left font-bold px-5 py-2.5">Voce</th>
                                    <th className="text-right font-bold px-3 py-2.5">Pagato</th>
                                    <th className="text-right font-bold px-3 py-2.5">Dovuto</th>
                                    <th className="text-right font-bold px-5 py-2.5">Δ {coeff !== 1 && <span className="text-amber-500">×{Math.round(coeff * 100)}%</span>}</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {result.perVoce.map((v) => (
                                    <tr key={v.codice} className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-500/[0.04]">
                                        <td className="px-5 py-3">
                                            <div className="font-bold text-slate-700 dark:text-slate-200">{v.label} <span className="text-slate-400 font-medium">({v.codice})</span></div>
                                            <div className="text-[11px] text-slate-400">{tar(v.tariffaPagata)} → {tar(v.tariffaDovuta)} · {v.ore.toLocaleString('it-IT')} h</div>
                                        </td>
                                        <td className="text-right px-3 py-3 text-slate-600 dark:text-slate-300">{eur(v.pagato)}</td>
                                        <td className="text-right px-3 py-3 text-slate-600 dark:text-slate-300">{eur(v.dovuto)}</td>
                                        <td className="text-right px-5 py-3 font-bold text-amber-600 dark:text-amber-400">{eur(v.differenza)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10">
                                    <td className="px-5 py-3.5 font-black text-slate-700 dark:text-slate-100">GAP + rivalutazione + interessi</td>
                                    <td className="text-right px-3 py-3.5 tabular-nums text-slate-500">{eur(result.totPagato)}</td>
                                    <td className="text-right px-3 py-3.5 tabular-nums text-slate-500">{eur(result.totDovuto)}</td>
                                    <td className="text-right px-5 py-3.5 font-black text-lg tabular-nums text-amber-700 dark:text-amber-300">{eur(result.totCredito)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {(result.totRivalutazione === 0 && result.totInteressi === 0 && !vuota) && (
                        <p className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-700/60">
                            Rivalutazione ISTAT e interessi legali: aggancio al servizio ISTAT in arrivo (ora 0 → credito = solo differenziale).
                        </p>
                    )}
                </section>

                {/* Prospetto per anno */}
                {result.perAnno.length > 0 && (
                    <section className="rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-xl overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><CalendarClock className="w-4 h-4" /></span>
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Prospetto per anno</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/80">
                                        <th className="text-left font-bold px-5 py-2.5">Anno</th>
                                        <th className="text-right font-bold px-3 py-2.5">Pagato</th>
                                        <th className="text-right font-bold px-3 py-2.5">Dovuto</th>
                                        <th className="text-right font-bold px-5 py-2.5">Credito</th>
                                    </tr>
                                </thead>
                                <tbody className="tabular-nums">
                                    {result.perAnno.map((r) => {
                                        const maxTot = Math.max(...result.perAnno.map((x) => x.totale), 1);
                                        return (
                                            <tr key={r.anno} className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-500/[0.04]">
                                                <td className="px-5 py-2.5 font-bold text-slate-700 dark:text-slate-200">{r.anno}</td>
                                                <td className="text-right px-3 py-2.5 text-slate-500">{eur(r.pagato)}</td>
                                                <td className="text-right px-3 py-2.5 text-slate-500">{eur(r.dovuto)}</td>
                                                <td className="px-5 py-2.5">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="hidden sm:block h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.max(6, (r.totale / maxTot) * 64)}px` }} />
                                                        <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{eur(r.totale)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Azioni (generatori in arrivo) */}
                <div className="flex flex-wrap items-center gap-3">
                    {[{ icon: FileText, label: 'Relazione' }, { icon: FileSpreadsheet, label: 'Excel' }, { icon: Printer, label: 'Stampa conteggi' }].map(({ icon: Icon, label }) => (
                        <button key={label} type="button" disabled className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold text-sm cursor-not-allowed">
                            <Icon className="w-4 h-4" /> {label} <span className="text-[10px] font-bold">(in arrivo)</span>
                        </button>
                    ))}
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldAlert className="w-3.5 h-3.5" />Export disponibile a pratica «Pagata»</span>
                </div>
            </div>
        </div>
    );
};

// ─── Timeline di prescrizione (elemento esclusivo dell'area) ──────────────────
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const yearOf = (dmy?: string) => (dmy ? Number(dmy.slice(-4)) : NaN);
const fmtData = (dmy: string) => {
    const [d, m] = dmy.split('/');
    return `${d} ${MESI[Number(m) - 1] ?? ''} ${dmy.slice(-4)}`;
};

const TimelinePrescrizione: React.FC<{ pratica: PraticaVertenza }> = ({ pratica }) => {
    const startY = yearOf(pratica.periodoStart);
    const endY = yearOf(pratica.periodoEnd);
    if (!Number.isFinite(startY) || !Number.isFinite(endY) || endY < startY) return null;

    const anni = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);
    const annoMin = annoMinimoNonPrescritto(pratica.prescrizione);
    const interruzioni = pratica.prescrizione?.interruzioni ?? [];
    const recuperabili = anni.filter((a) => annoMin == null || a >= annoMin).length;

    return (
        <section className="rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><ShieldAlert className="w-4 h-4" /></span>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Prescrizione quinquennale</h3>
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">{recuperabili}/{anni.length} anni recuperabili</span>
            </div>

            {/* Barra anni: rame = recuperabile, grigio = prescritto */}
            <div className="flex gap-1">
                {anni.map((a) => {
                    const prescritto = annoMin != null && a < annoMin;
                    const hasInt = interruzioni.some((it) => yearOf(it.data) === a);
                    return (
                        <div key={a} className="flex-1 min-w-0">
                            <div className="relative h-2.5">
                                {hasInt && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-rose-500" title="Interruzione prescrizione" />}
                                <div className={`h-2.5 rounded-full ${prescritto ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm shadow-amber-500/40'}`} />
                            </div>
                            <div className={`text-center text-[10px] mt-1 font-bold ${prescritto ? 'text-slate-300 dark:text-slate-600 line-through' : 'text-slate-500 dark:text-slate-400'}`}>{a}</div>
                        </div>
                    );
                })}
            </div>

            {/* Legenda interruzioni + cutoff */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                {interruzioni.map((it, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                        <span className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-rose-500" />
                        Interruzione {fmtData(it.data)}{it.nota ? ` · ${it.nota}` : ''}
                    </span>
                ))}
                {pratica.prescrizione?.cutoff && (
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />Deposito {fmtData(pratica.prescrizione.cutoff)}</span>
                )}
            </div>
        </section>
    );
};

export default VertenzaDetail;
