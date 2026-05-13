import React, { useMemo } from 'react';
import {
  Wallet, TrendingUp, Banknote, CheckCircle2, Ticket, Scale,
} from 'lucide-react';
import { LineChart } from 'lucide-react';
import { Worker, AnnoDati } from '../types';
import { formatCurrency } from '../utils/formatters';
import { calculateLegalInterestsAndRevaluation } from '../istatService';
import { computeHolidayIndemnity } from '../utils/calculationEngine';

interface UseStatsDataOptions {
  monthlyInputs: AnnoDati[];
  worker: Worker;
  startClaimYear: number;
  includeExFest: boolean;
  includeTickets: boolean;
}

export function useStatsData({
  monthlyInputs,
  worker,
  startClaimYear,
  includeExFest,
  includeTickets,
}: UseStatsDataOptions) {
  const statsData = useMemo(() => {
    if (!monthlyInputs || !Array.isArray(monthlyInputs)) return { cards: [], rawTotal: 0 };

    const allYears = Array.from(new Set(monthlyInputs.map(d => Number(d.year)))).sort((a, b) => a - b);

    const yearResults = computeHolidayIndemnity({
      data: monthlyInputs,
      profilo: worker.profilo,
      eliorType: worker.eliorType,
      includeExFest,
      includeTickets,
      startClaimYear,
      years: allYears,
    });

    let totLordoSpettante = 0;
    let totTicket = 0;
    let totGiaPercepito = 0;
    let totaleISTATeInteressi = 0;

    yearResults.forEach(r => {
      if (r.isReferenceYear) return;
      totLordoSpettante += r.sumIndennitaSpettante;
      totGiaPercepito += r.sumIndennitaPercepita;
      totTicket += r.sumBuoniPasto;
      if (r.sumNetto > 0) {
        const risultatoIstat = calculateLegalInterestsAndRevaluation(r.sumNetto, r.year);
        totaleISTATeInteressi += risultatoIstat.totaleDovuto;
      }
    });

    const differenzaRetributiva = totLordoSpettante - totGiaPercepito;
    const nettoRecuperabile = differenzaRetributiva + totTicket;
    const tfrSulleDifferenze = totLordoSpettante / 13.5;

    const cards = [
      {
        label: "TOTALE DA LIQUIDARE",
        value: formatCurrency(nettoRecuperabile),
        icon: Wallet,
        color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50",
        textColor: "text-emerald-600 dark:text-emerald-400",
        note: `Diff. Retr. (${formatCurrency(differenzaRetributiva)}) + Ticket`,
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30 shadow-inner">
              <strong className="text-emerald-400 block mb-1.5 tracking-wide uppercase text-xs">Il Valore di Conciliazione</strong>
              <p className="text-sm">Questa è la somma liquida, netta ed esigibile che il lavoratore deve incassare <em>immediatamente</em> alla chiusura della vertenza.</p>
            </div>
            <p className="pl-2">Rappresenta la differenza pura tra ciò che gli spettava di diritto e ciò che l'azienda gli ha effettivamente pagato nei periodi di ferie, al netto delle imposte e con l'aggiunta dell'indennità sostitutiva dei buoni pasto. È la <strong>bottom line</strong> per qualsiasi trattativa stragiudiziale.</p>
          </div>
        )
      },
      {
        label: "TOTALE ISTAT + INTERESSI",
        value: formatCurrency(totaleISTATeInteressi),
        icon: LineChart,
        color: "bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-200 dark:border-fuchsia-800/50",
        textColor: "text-fuchsia-600 dark:text-fuchsia-400",
        note: "Rivalutazione e Mora (Art. 429 c.p.c.)",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-fuchsia-950/40 p-4 rounded-xl border border-fuchsia-500/30 shadow-inner">
              <strong className="text-fuchsia-400 block mb-1.5 tracking-wide uppercase text-xs">Lo Scudo Finanziario</strong>
              <p className="text-sm">L'importo massimo inattaccabile da esigere in caso di ricorso in Giudizio.</p>
            </div>
            <p className="pl-2">La giurisprudenza protegge i crediti di lavoro imponendo due oneri all'azienda inadempiente: la <strong>Rivalutazione Monetaria</strong> (che neutralizza l'inflazione usando gli indici ISTAT FOI) e gli <strong>Interessi Legali</strong> (calcolati sul capitale progressivamente rivalutato anno per anno). Il tempo, qui, gioca a favore del lavoratore.</p>
          </div>
        )
      },
      {
        label: "LORDO SPETTANTE",
        value: formatCurrency(totLordoSpettante),
        icon: TrendingUp,
        color: "bg-blue-50 dark:bg-cyan-900/20 border-blue-200 dark:border-cyan-800/50",
        textColor: "text-blue-600 dark:text-cyan-400",
        note: "Basato su media annuale",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-cyan-950/40 p-4 rounded-xl border border-cyan-500/30 shadow-inner">
              <strong className="text-cyan-400 block mb-1.5 tracking-wide uppercase text-xs">Il Motore della Vertenza</strong>
              <p className="text-sm">Il fulcro matematico e giuridico dell'intera operazione, basato sull'Ordinanza <strong>Cass. n. 20216/2022</strong>.</p>
            </div>
            <p className="pl-2">Durante le ferie, la retribuzione non può subire flessioni. Questo valore calcola <em>al centesimo</em> quanto l'azienda avrebbe dovuto pagare, applicando il <strong>Principio di Onnicomprensività</strong>: la media giornaliera di tutte le voci variabili e continuative percepite nell'anno, moltiplicata per i giorni di riposo costituzionalmente garantito.</p>
          </div>
        )
      },
      {
        label: "TFR SU DIFFERENZE",
        value: formatCurrency(tfrSulleDifferenze),
        icon: Banknote,
        color: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50",
        textColor: "text-violet-600 dark:text-violet-400",
        note: "Da aggiungere alla liquidazione",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-violet-950/40 p-4 rounded-xl border border-violet-500/30 shadow-inner">
              <strong className="text-violet-400 block mb-1.5 tracking-wide uppercase text-xs">L'Effetto Domino</strong>
              <p className="text-sm">Il danno economico si ripercuote matematicamente sulla Liquidazione Finale del lavoratore.</p>
            </div>
            <p className="pl-2">Essendo il Trattamento di Fine Rapporto calcolato dividendo la retribuzione annua utile per 13,5, ogni euro di indennità illecitamente trattenuto durante le ferie ha generato un ammanco nel fondo. Questo valore ripristina la quota esatta di liquidazione sottratta negli anni.</p>
          </div>
        )
      },
      {
        label: "GIÀ PERCEPITO",
        value: formatCurrency(totGiaPercepito),
        icon: CheckCircle2,
        color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50",
        textColor: "text-orange-600 dark:text-orange-400",
        note: "Importo già erogato",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-orange-950/40 p-4 rounded-xl border border-orange-500/30 shadow-inner">
              <strong className="text-orange-400 block mb-1.5 tracking-wide uppercase text-xs">L'Ammortizzatore di Rischio Legale</strong>
              <p className="text-sm">Previene contestazioni di controparte o rischi di indebito arricchimento.</p>
            </div>
            <p className="pl-2">Indica le somme "tampone" che l'azienda ha già versato a titolo di indennità ferie (spesso forfettarie o calcolate al ribasso). Sottraendo rigorosamente questo importo dal <em>Lordo Spettante</em>, il nostro calcolo si trasforma in un'<strong>armatura matematica inattaccabile</strong> in sede processuale.</p>
          </div>
        )
      },
      {
        label: "TOTALE BUONI PASTO",
        value: formatCurrency(totTicket),
        icon: Ticket,
        color: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50",
        textColor: "text-indigo-600 dark:text-indigo-400",
        note: "Indennità sostitutiva",
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/30 shadow-inner">
              <strong className="text-indigo-400 block mb-1.5 tracking-wide uppercase text-xs">L'Indennità Sostitutiva</strong>
              <p className="text-sm">Il riconoscimento del buono pasto come elemento ordinario della retribuzione.</p>
            </div>
            <p className="pl-2">La giurisprudenza consolida un principio chiaro: se il Ticket Restaurant è erogato con carattere di continuità, la sua mancata corresponsione produce un danno. Questo indicatore monetizza il controvalore esatto dei buoni pasto illecitamente trattenuti dall'azienda durante i giorni di ferie.</p>
          </div>
        )
      }
    ];

    if (worker.tfr_pregresso && worker.tfr_pregresso > 0) {
      cards.push({
        label: "FONDO TFR STORICO",
        value: formatCurrency(worker.tfr_pregresso),
        icon: Scale,
        color: "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700",
        textColor: "text-slate-700 dark:text-slate-300",
        note: `Base AI dal ${worker.tfr_pregresso_anno}`,
        tooltip: (
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-300">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-inner">
              <strong className="text-white block mb-1.5 tracking-wide uppercase text-xs">Il Punto Zero (AI Vision)</strong>
              <p className="text-sm">L'Ancora Temporale estratta in automatico dal Motore Neurale.</p>
            </div>
            <p className="pl-2">È il capitale di partenza del Trattamento di Fine Rapporto, letto dall'Intelligenza Artificiale dai documenti originali (CU o Buste Paga dell'anno {worker.tfr_pregresso_anno}). Serve da base infallibile per innescare l'algoritmo di rivalutazione composta ISTAT nel Prospetto TFR.</p>
          </div>
        )
      });
    }

    return { cards, rawTotal: nettoRecuperabile };
  }, [monthlyInputs, worker.profilo, worker.eliorType, worker.tfr_pregresso, worker.tfr_pregresso_anno, includeExFest, includeTickets, startClaimYear]);

  const tickerItems = [...statsData.cards, ...statsData.cards, ...statsData.cards];

  return { statsData, tickerItems };
}
