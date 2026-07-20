// Calcolo delle indennità RICOSTRUITE a tariffa (FSE) — condiviso tra la scheda "Ricostruite" e la
// Relazione, così i due mostrano gli stessi numeri. Le ricostruzioni non sono stampate sui cedolini:
// tariffa (Relazione §3) × quantità base. Solo l'Indennità Aziendale ha base auto (giorni lavorati);
// le altre hanno quantità manuale (o valore dal perito). Vedi config/ricostruzioniFse.ts.

import { RICOSTRUZIONI_FSE, RicostruzioneFse } from '../config/ricostruzioniFse';
import { parseLocalFloat } from './formatters';

/** Stato per-voce salvato in localStorage: quantità, override "valore perito", flag inclusione nel credito. */
export interface VoceState { qty?: string; valore?: string; includi?: boolean }
export type RicostruzioniState = Record<string, VoceState>;

export const ricostruzioniStorageKey = (workerId?: string) => `ricostruite_fse_${workerId || 'x'}`;

export function loadRicostruzioniState(workerId?: string): RicostruzioniState {
  if (typeof localStorage === 'undefined') return {};
  try {
    const s = localStorage.getItem(ricostruzioniStorageKey(workerId));
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

/** Giorni di servizio effettivo (daysWorked già = lavorati) per anno. */
export function workedByYear(data: { year?: number | string; daysWorked?: number | string }[]): Record<number, number> {
  const m: Record<number, number> = {};
  (data || []).forEach(r => {
    const y = Number(r?.year);
    if (!isFinite(y) || isNaN(y)) return;
    m[y] = (m[y] || 0) + Math.max(0, parseLocalFloat(r?.daysWorked));
  });
  return m;
}

/**
 * Valore TOTALE ricostruito di una singola voce (per la card della scheda).
 * - base 'daysWorked': tariffa × Σ giorni lavorati nel periodo (auto).
 * - base 'manuale': override "valore perito" se > 0, altrimenti quantità × tariffa.
 */
export function valoreVoce(r: RicostruzioneFse, wby: Record<number, number>, st: VoceState | undefined): number {
  if (r.base === 'daysWorked') {
    const da = r.periodo?.da ?? -Infinity;
    const a = r.periodo?.a ?? Infinity;
    const gg = Object.entries(wby).filter(([y]) => Number(y) >= da && Number(y) <= a).reduce((s, [, v]) => s + v, 0);
    return gg * r.tariffa;
  }
  const valore = parseLocalFloat(st?.valore);
  if (valore > 0) return valore;
  return parseLocalFloat(st?.qty) * r.tariffa;
}

/**
 * Extra numeratore per ANNO delle sole voci INCLUSE (flag `includi`). Da passare a
 * `computeHolidayIndemnity({ extraNumeratorByYear })`. Solo profilo FSE.
 * - auto: tariffa × giorni lavorati dell'anno (dentro il periodo).
 * - manuale: valore totale distribuito per anno in proporzione ai giorni lavorati.
 */
export function computeRicostruzioniByYear(
  data: { year?: number | string; daysWorked?: number | string }[],
  profilo: string,
  state: RicostruzioniState,
): Record<number, number> {
  const out: Record<number, number> = {};
  if (profilo !== 'FSE') return out;
  const wby = workedByYear(data);
  const years = Object.keys(wby).map(Number);
  const totWorked = years.reduce((s, y) => s + wby[y], 0);

  for (const r of RICOSTRUZIONI_FSE) {
    if (!state[r.id]?.includi) continue;
    if (r.base === 'daysWorked') {
      const da = r.periodo?.da ?? -Infinity;
      const a = r.periodo?.a ?? Infinity;
      for (const y of years) if (y >= da && y <= a) out[y] = (out[y] || 0) + wby[y] * r.tariffa;
    } else {
      const totale = valoreVoce(r, wby, state[r.id]);
      if (totale <= 0 || totWorked <= 0) continue;
      // distribuzione per anno proporzionale ai giorni lavorati (approssimazione; base non sul cedolino).
      for (const y of years) out[y] = (out[y] || 0) + totale * (wby[y] / totWorked);
    }
  }
  return out;
}
