import React, { useMemo } from 'react';
import { ArrowLeft, FileText, FileSpreadsheet, Printer, Scale, ShieldAlert, Info, MapPin } from 'lucide-react';
import { computeVertenza, annoMinimoNonPrescritto } from '../utils/vertenzaEngine';
import { STATO_META_VERTENZA, type PraticaVertenza, type PraticaVertenzaUpdate } from '../hooks/usePraticheVertenze';
import { CompanyLogo } from './ui/CompanyLogo';
import { useIsReadOnly } from '../lib/readonly';

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    return (
        <div className="min-h-screen px-6 py-10">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-amber-600 transition-colors shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                        <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 truncate">{pratica.cognome} {pratica.nome}</h1>
                        <span className="inline-flex items-center gap-2 mt-0.5">
                            <CompanyLogo profilo="ELIOR" eliorType="viaggiante" h={18} title="Elior viaggiante" />
                            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">Indennità assenza residenza · {pratica.periodoStart}–{pratica.periodoEnd}</span>
                        </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATO_META_VERTENZA[pratica.stato].chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATO_META_VERTENZA[pratica.stato].dot}`} />{STATO_META_VERTENZA[pratica.stato].label}
                    </span>
                </div>

                {/* Selettore coefficiente (owner only) */}
                {!isReadOnly && onUpdate && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Valorizzazione</span>
                        {[{ v: 1, label: 'Valore pieno · 100%' }, { v: 0.20, label: 'Danno · 20%' }].map(({ v, label }) => {
                            const active = Math.abs(coeff - v) < 1e-9;
                            return (
                                <button
                                    key={label}
                                    onClick={() => { if (!active) onUpdate({ coefficiente: v }); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Scelta del legale · ricalcola tutto</span>
                    </div>
                )}

                {/* Banner metodologico */}
                <div className="flex gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 text-sm text-amber-900 dark:text-amber-200">
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
                <section className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700/60">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Confronto Pagato ↔ Dovuto</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80">
                                    <th className="text-left font-bold px-5 py-2">Voce</th>
                                    <th className="text-right font-bold px-3 py-2">Pagato</th>
                                    <th className="text-right font-bold px-3 py-2">Dovuto</th>
                                    <th className="text-right font-bold px-5 py-2">Δ {coeff !== 1 && <span className="text-amber-500">×{Math.round(coeff * 100)}%</span>}</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {result.perVoce.map((v) => (
                                    <tr key={v.codice} className="border-t border-slate-100 dark:border-slate-700/50">
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
                                    <td className="px-5 py-3 font-black text-slate-700 dark:text-slate-100">GAP + rivalutazione + interessi</td>
                                    <td className="text-right px-3 py-3 tabular-nums text-slate-500">{eur(result.totPagato)}</td>
                                    <td className="text-right px-3 py-3 tabular-nums text-slate-500">{eur(result.totDovuto)}</td>
                                    <td className="text-right px-5 py-3 font-black text-lg tabular-nums text-amber-700 dark:text-amber-300">{eur(result.totCredito)}</td>
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
                    <section className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700/60">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Prospetto per anno</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80">
                                        <th className="text-left font-bold px-5 py-2">Anno</th>
                                        <th className="text-right font-bold px-3 py-2">Pagato</th>
                                        <th className="text-right font-bold px-3 py-2">Dovuto</th>
                                        <th className="text-right font-bold px-5 py-2">Credito</th>
                                    </tr>
                                </thead>
                                <tbody className="tabular-nums">
                                    {result.perAnno.map((r) => (
                                        <tr key={r.anno} className="border-t border-slate-100 dark:border-slate-700/50">
                                            <td className="px-5 py-2.5 font-bold text-slate-700 dark:text-slate-200">{r.anno}</td>
                                            <td className="text-right px-3 py-2.5 text-slate-500">{eur(r.pagato)}</td>
                                            <td className="text-right px-3 py-2.5 text-slate-500">{eur(r.dovuto)}</td>
                                            <td className="text-right px-5 py-2.5 font-bold text-amber-600 dark:text-amber-400">{eur(r.totale)}</td>
                                        </tr>
                                    ))}
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
        <section className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Prescrizione quinquennale</h3>
                <span className="text-[11px] font-bold text-slate-400">{recuperabili}/{anni.length} anni recuperabili</span>
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
                                <div className={`h-2.5 rounded-full ${prescritto ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />
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
