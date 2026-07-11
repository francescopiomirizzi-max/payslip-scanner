import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderSearch, ShieldCheck, Loader2, AlertTriangle, Wand2 } from 'lucide-react';
import type { AnnoDati } from '../../types';
import { verifyFromFolder, type VerifyReport, type Discrepancy, type VerifyProfile } from '../../utils/verifyFromFolder';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const fmt = (n: number | null) => n === null ? '—' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const campo = (f: string) => f === 'daysWorked' ? 'Giorni lav.' : f === 'daysVacation' ? 'Ferie' : f === 'daysPaidLeave' ? 'Ass. Retrib.' : f;

// Nota sul perimetro, per profilo: cosa il parser può verificare e cosa no.
const HINT: Record<VerifyProfile, string> = {
  RFI: 'Solo buste RFI/Trenitalia con testo (le scansioni verranno segnalate come non verificabili).',
  TRENITALIA: 'Solo buste RFI/Trenitalia con testo (le scansioni verranno segnalate come non verificabili).',
  FSE: 'Buste FSE digitali da luglio 2017 in poi (ere IX e I8/T8). L\'era storica 2010–giu 2017 è fatta di scansioni: non verificabile qui.',
  MERCITALIA: 'Buste Mercitalia in PDF (layout ADP). Vale anche per i nomi file numerici tipo "Cedolini-2019-10-…".',
};

interface Props {
  anni: AnnoDati[];
  profilo: VerifyProfile;
  onApply: (fixes: Discrepancy[]) => void;
  onClose: () => void;
}

// Feature "Prova d'accuratezza" — verifica DAL DISCO (zero egress): l'utente sceglie la cartella
// locale delle buste; leggiamo i PDF con PDF.js e confrontiamo col dato del motore. Poi si
// applicano le correzioni (verità dal PDF) con un click.
const AccuracyCheckModal: React.FC<Props> = ({ anni, profilo, onApply, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [applied, setApplied] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setPhase('running');
    setProgress({ done: 0, total: files.filter(f => /\.pdf$/i.test(f.name)).length });
    const rep = await verifyFromFolder(files, anni, profilo, (done, total) => setProgress({ done, total }));
    setReport(rep);
    setPhase('done');
  };

  const doApply = () => {
    if (report) { onApply(report.discrepancies); setApplied(true); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Prova d'accuratezza</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Confronta le buste dal disco con i dati estratti — dal PDF, senza scaricare nulla.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {phase === 'idle' && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 max-w-md mx-auto">
                Scegli la cartella locale delle buste di questo lavoratore (es. <b>BUSTE PAGA</b> con le sottocartelle-anno).
                I file restano sul tuo disco: <b>nessun consumo di banda</b>.
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">{HINT[profilo] ?? HINT.RFI}</p>
              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                <FolderSearch className="w-5 h-5" /> Scegli la cartella delle buste
              </button>
              <input
                ref={inputRef} type="file" multiple accept="application/pdf" className="hidden"
                onChange={onPick} {...({ webkitdirectory: '' } as any)}
              />
            </div>
          )}

          {phase === 'running' && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Analizzo i PDF… {progress.done}/{progress.total}</p>
              <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {phase === 'done' && report && (
            <div>
              {/* Riepilogo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <Stat label="Buste verificate" value={report.busteVerificate} tone="ok" />
                <Stat label="Scarti trovati" value={report.discrepancies.length} tone={report.discrepancies.length ? 'warn' : 'ok'} />
                <Stat label="Mesi in conflitto" value={report.mesiInConflitto.length} tone={report.mesiInConflitto.length ? 'warn' : 'mute'} />
                <Stat label="Mesi non nel dato" value={report.mesiAssenti.length} tone="mute" />
              </div>

              {/* Conflitti: più buste sullo stesso mese che non concordano → NON corretti in automatico. */}
              {report.mesiInConflitto.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {report.mesiInConflitto.length} {report.mesiInConflitto.length === 1 ? 'mese ha' : 'mesi hanno'} più buste in conflitto — non corretti
                  </div>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1.5">
                    Per questi mesi la cartella contiene più buste con valori diversi (doppioni, conguagli o file di un altro
                    mese/anno): la verità è ambigua, quindi <b>non vengono corretti in automatico</b>. Sistema la cartella
                    (togli il doppione o rimetti il file nel mese giusto) e rilancia.
                  </p>
                  <div className="text-xs font-mono text-amber-800 dark:text-amber-200 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                    {report.mesiInConflitto.map((m, i) => (
                      <span key={i}>{MESI[m.monthIndex]} {m.year} <span className="opacity-60">({m.count})</span></span>
                    ))}
                  </div>
                </div>
              )}

              {/* Giorni ambigui sul PDF (quantità presenze con arretrati multi-mese): non corretti. */}
              {report.mesiGiorniIncerti.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Giorni lavorati da verificare a mano ({report.mesiGiorniIncerti.length} {report.mesiGiorniIncerti.length === 1 ? 'mese' : 'mesi'})
                  </div>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1.5">
                    La voce di presenza supera i 31 giorni (arretrati di mesi precedenti dentro la quantità):
                    il valore vero va deciso sui documenti, quindi <b>i giorni di questi mesi non vengono toccati</b>.
                  </p>
                  <div className="text-xs font-mono text-amber-800 dark:text-amber-200 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                    {report.mesiGiorniIncerti.map((m, i) => (
                      <span key={i}>{MESI[m.monthIndex]} {m.year} <span className="opacity-60">({m.presenze} gg)</span></span>
                    ))}
                  </div>
                </div>
              )}

              {/* Buste col periodo interno diverso dal nome file: confrontarle corromperebbe il mese sbagliato. */}
              {report.busteMisfiled.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {report.busteMisfiled.length} {report.busteMisfiled.length === 1 ? 'busta ha' : 'buste hanno'} un nome che non torna col contenuto — saltate
                  </div>
                  <div className="text-xs font-mono text-amber-800 dark:text-amber-200 mt-2 space-y-0.5">
                    {report.busteMisfiled.map((b, i) => (
                      <div key={i}>{b.name} <span className="opacity-60">→ dentro è {MESI[b.monthIndex]} {b.year}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {report.discrepancies.length === 0 ? (
                <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 font-bold flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8" /> Nessuno scarto: i dati combaciano col PDF al centesimo.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="max-h-[38vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold">Mese</th>
                          <th className="text-left px-3 py-2 font-bold">Campo</th>
                          <th className="text-right px-3 py-2 font-bold">Motore</th>
                          <th className="text-right px-3 py-2 font-bold">Verità (PDF)</th>
                          <th className="text-right px-3 py-2 font-bold">Δ</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {report.discrepancies.map((d, i) => {
                          const delta = d.truth - (d.engine ?? 0);
                          return (
                            <tr key={i} className="border-t border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/50">
                              <td className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200">{MESI[d.monthIndex]} {d.year}</td>
                              <td className="px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">{campo(d.field)}</td>
                              <td className="px-3 py-1.5 text-right text-slate-500 dark:text-slate-400">{d.engine === null ? <span className="text-red-500 font-bold">mancante</span> : fmt(d.engine)}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmt(d.truth)}</td>
                              <td className={`px-3 py-1.5 text-right font-bold ${delta >= 0 ? 'text-blue-600 dark:text-cyan-400' : 'text-orange-600 dark:text-orange-400'}`}>{delta >= 0 ? '+' : ''}{fmt(delta)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {report.busteNonTestuali > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 mt-3">
                  <AlertTriangle className="w-3.5 h-3.5" /> {report.busteNonTestuali} buste sono scansioni (senza testo): non verificabili così.
                </p>
              )}
              {report.busteNonQuadrate > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 mt-3">
                  <AlertTriangle className="w-3.5 h-3.5" /> {report.busteNonQuadrate} buste non quadrano col totale stampato sul cedolino (layout inatteso): saltate per prudenza.
                </p>
              )}
              {report.buste13a14a > 0 && (
                <p className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                  <AlertTriangle className="w-3.5 h-3.5" /> {report.buste13a14a} cedolini di 13ª/14ª: fuori conteggio, saltati.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer azioni */}
        {phase === 'done' && report && report.discrepancies.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {applied ? 'Correzioni applicate ✓' : `${report.discrepancies.length} valori verranno riportati alla verità del PDF.`}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Chiudi</button>
              <button
                onClick={doApply} disabled={applied}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 shadow disabled:opacity-50 active:scale-95 transition-all"
              >
                <Wand2 className="w-4 h-4" /> {applied ? 'Applicato' : 'Applica correzioni'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const Stat: React.FC<{ label: string; value: number; tone: 'ok' | 'warn' | 'mute' }> = ({ label, value, tone }) => (
  <div className={`rounded-lg px-3 py-2 border ${tone === 'warn' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50' : tone === 'ok' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'}`}>
    <div className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
  </div>
);

export default AccuracyCheckModal;
