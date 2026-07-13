/**
 * Validatore deterministico per le scansioni OCR delle buste ELIOR (cartacee).
 *
 * Le buste Elior sono scansioni di carta: il parser di verità sul testo PDF è
 * impossibile, quindi la qualità dell'estrazione OCR va verificata con vincoli
 * ARITMETICI interni al cedolino stesso (piano controlli OCR cartacee, 11/07):
 *
 *  1. Terne per voce:      valore unitario × quantità ≈ competenze
 *  2. Riconciliazione:     Σ competenze delle voci ≈ TOTALE COMPETENZE stampato
 *  3. Triangolo dei totali: totale competenze − totale trattenute ≈ netto
 *  4. Giorni:              daysWorked = GG INPS − ferie (ricalcolo client)
 *  5. Range di sanità:     GG INPS ≤ 31, ferie ≤ 26, quantità orarie plausibili
 *  6. Tariffe note:        valore unitario coerente con la tariffa censita per la voce
 *  7. Coerenza interna:    aiResult.codes[voce] ≈ Σ competenze delle righe di quella voce
 *
 * Ogni esito è un FLAG da mostrare/annotare, MAI una correzione automatica
 * (cfr. memoria `ocr-ambiguity-flag-policy`): il dubbio si segnala, non si indovina.
 */

export interface EliorVoce {
  code: string;
  desc?: string | null;
  unit?: number | null;        // VALORE UNITARIO
  qty?: number | null;         // ORE/GG/MESI
  competenze?: number | null;  // colonna COMPETENZE
  trattenute?: number | null;  // colonna TRATTENUTE
}

export interface EliorScanValidation {
  ok: boolean;
  flags: string[];
  /** Statistiche sintetiche per il report batch e l'archivio. */
  stats: {
    voci: number;
    terneVerificate: number;
    terneFallite: number;
    reconDelta: number | null; // Σ competenze − totale stampato (null se totale assente)
  };
}

/**
 * Tariffe unitarie NOTE per voce (censimento Vision su buste reali 2020-2025,
 * 13/07/2026 — tasks/censimento-elior-viaggiante). Un valore unitario fuori
 * lista è un flag di verifica, non un errore certo (le tariffe CCNL cambiano).
 */
export const TARIFFE_NOTE_ELIOR: Record<string, number[]> = {
  '1126': [2.20],        // Indennità di cassa (oraria)
  '1129': [2.25],        // Ind. turno non cadenzato (oraria)
  '1130': [2.40],        // Lavoro notturno (oraria)
  '1131': [20.00],       // Lavoro domenicale oltre 2HH (per domenica)
  '2000': [5.20, 7.20],  // Ticket pers. viaggiante (7.20 dal 2025)
  '2001': [5.20, 7.20],  // Ticket supplementare PV
  '4255': [2.80],        // Ind. giorn. pernottamento
  '4256': [2.80],        // Ind. giorn. di pernottazione
  '4301': [1.00],        // Fuori sede ITA turni RFR (oraria — vertenza residenza)
  '4300': [0.75, 1.30],  // Ass. residenza senza riposo (ridotta / piena CCNL)
  '4305': [1.00, 2.20],  // Ass. residenza con riposo (ridotta / piena CCNL)
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const eur = (n: number) => n.toFixed(2).replace('.', ',');

/** Tolleranza terna: il valore unitario è stampato arrotondato al centesimo,
 *  quindi l'errore ammesso cresce con la quantità (mezzo centesimo per unità). */
const ternaTolerance = (qty: number) => Math.max(0.02, Math.abs(qty) * 0.006);

export function validateEliorScan(aiResult: any): EliorScanValidation {
  const flags: string[] = [];
  const voci: EliorVoce[] = Array.isArray(aiResult?.voci) ? aiResult.voci : [];

  // ── 1. Terne unit × qty ≈ competenze ─────────────────────────────────────
  let terneVerificate = 0;
  let terneFallite = 0;
  for (const v of voci) {
    const unit = toNum(v.unit);
    const qty = toNum(v.qty);
    const comp = toNum(v.competenze);
    if (unit === null || qty === null || comp === null) continue;
    if (Math.abs(unit * qty - comp) <= ternaTolerance(qty)) {
      terneVerificate++;
    } else {
      terneFallite++;
      flags.push(
        `voce ${v.code}: ${eur(unit)} × ${qty} ≠ ${eur(comp)} (attesi ${eur(unit * qty)})`
      );
    }
  }

  // ── 2. Σ competenze ≈ TOTALE COMPETENZE stampato ─────────────────────────
  const totComp = toNum(aiResult?.totaleCompetenze);
  let reconDelta: number | null = null;
  const compVals = voci.map(v => toNum(v.competenze)).filter((n): n is number => n !== null);
  if (totComp !== null && compVals.length > 0) {
    const somma = compVals.reduce((a, b) => a + b, 0);
    reconDelta = Math.round((somma - totComp) * 100) / 100 || 0; // niente -0
    if (Math.abs(reconDelta) > 0.01) {
      flags.push(`Σ competenze ${eur(somma)} ≠ totale stampato ${eur(totComp)} (Δ ${eur(reconDelta)})`);
    }
  }

  // ── 3. Totale competenze − trattenute ≈ netto (± arrotondamento) ─────────
  const totTratt = toNum(aiResult?.totaleTrattenute);
  const netto = toNum(aiResult?.netto);
  if (totComp !== null && totTratt !== null && netto !== null) {
    if (Math.abs(totComp - totTratt - netto) > 1.05) {
      flags.push(
        `totali incoerenti: ${eur(totComp)} − ${eur(totTratt)} ≠ netto ${eur(netto)}`
      );
    }
  }

  // ── 4. daysWorked = GG INPS − ferie (il modello non deve fare aritmetica) ─
  const ggInps = toNum(aiResult?.ggInps);
  const daysVacation = toNum(aiResult?.daysVacation);
  const daysWorked = toNum(aiResult?.daysWorked);
  if (ggInps !== null && daysVacation !== null && daysWorked !== null) {
    const atteso = ggInps - daysVacation;
    if (Math.abs(daysWorked - atteso) > 0.01) {
      flags.push(`giorni: daysWorked ${daysWorked} ≠ GG INPS ${ggInps} − ferie ${daysVacation}`);
    }
  }

  // ── 5. Range di sanità ────────────────────────────────────────────────────
  if (ggInps !== null && (ggInps < 0 || ggInps > 31)) flags.push(`GG INPS fuori range: ${ggInps}`);
  if (daysVacation !== null && (daysVacation < 0 || daysVacation > 26))
    flags.push(`ferie fuori range: ${daysVacation}`);
  for (const v of voci) {
    const qty = toNum(v.qty);
    if (qty !== null && Math.abs(qty) > 320)
      flags.push(`voce ${v.code}: quantità implausibile ${qty}`);
  }

  // ── 6. Tariffe note per voce ──────────────────────────────────────────────
  for (const v of voci) {
    const unit = toNum(v.unit);
    const note = TARIFFE_NOTE_ELIOR[v.code];
    if (unit === null || !note) continue;
    if (!note.some(t => Math.abs(unit - t) <= 0.005)) {
      flags.push(`voce ${v.code}: tariffa inattesa ${eur(unit)} (note: ${note.map(eur).join(' / ')})`);
    }
  }

  // ── 7. codes[voce] ≈ Σ competenze delle righe di quella voce ─────────────
  const codes = aiResult?.codes && typeof aiResult.codes === 'object' ? aiResult.codes : null;
  if (codes && voci.length > 0) {
    const perCode: Record<string, number> = {};
    for (const v of voci) {
      const comp = toNum(v.competenze);
      if (comp !== null) perCode[v.code] = (perCode[v.code] || 0) + comp;
    }
    for (const [code, raw] of Object.entries(codes)) {
      const dichiarato = toNum(raw);
      if (dichiarato === null || dichiarato === 0) continue;
      const daVoci = perCode[code];
      if (daVoci === undefined) {
        flags.push(`codes[${code}]=${eur(dichiarato)} ma nessuna riga voce corrispondente`);
      } else if (Math.abs(daVoci - dichiarato) > 0.01) {
        flags.push(`codes[${code}]=${eur(dichiarato)} ≠ Σ righe voce ${eur(daVoci)}`);
      }
    }
  }

  return {
    ok: flags.length === 0,
    flags,
    stats: { voci: voci.length, terneVerificate, terneFallite, reconDelta },
  };
}
