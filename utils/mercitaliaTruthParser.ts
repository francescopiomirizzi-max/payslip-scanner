// Parser di VERITÀ per buste MERCITALIA (Shunting & Terminal, gestionale ADP a 7 colonne) —
// feature "prova d'accuratezza". Calibrato su tutte le 78 buste reali di Gagliano (2019-2025):
// 78/78 riconciliate con la riga "Totali" e col check 1000+1001+1025 = 1100.
//
// Regole (allineate a PROMPT_MERCITALIA):
//   - indennità variabili: importo dalla colonna "Competenze", somma col segno (righe multiple);
//   - voci fisse 1000/1001/1025: importo dalla colonna "Valori" (righe in testa alla tabella);
//   - ferie = righe 3833 con segno POSITIVO in "Valori", giorni dalla colonna "Numero o base di
//     calcolo"; le righe 3833 negative sono STORNI di periodi precedenti (non ferie del mese);
//   - daysWorked = GIORNI INPS (pagina 2, "Informazioni Previdenziali") − ferie; se GIORNI INPS
//     manca (successo 1 volta su 78: Dic 2025) si usa la quantità della riga 1213 RETRIBUZ.ORDINARIA.
//
// Autovalidazione (reconOk): Σ colonna Competenze letta = riga "Totali" stampata a fondo tabella.

import { getPdfjs } from '../lib/pdfChunker';

export interface MercTruth {
  /** false = PDF senza testo o layout non riconosciuto → non verificabile. */
  isText: boolean;
  /** codice voce → somma (variabili da Competenze, fisse 1000/1001/1025 da Valori). */
  codes: Record<string, number>;
  hasDays: boolean;
  /** GIORNI INPS − ferie (fallback: quantità 1213). */
  daysWorked: number;
  /** somma righe 3833 positive (giorni). */
  daysVacation: number;
  /** non tracciato per Mercitalia. */
  daysPaidLeave: number;
  daysUncertain: boolean;
  /** false = Σ Competenze ≠ riga "Totali" → busta da scartare come verità. */
  reconOk: boolean;
  is13a14a: boolean;
  /** periodo letto dal cedolino ("PERIODO MAGGIO 2022") per il check col nome file. */
  period: { month: number; year: number } | null;
}

interface Item { x: number; s: string; }

const NUM = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;  // 1.804,76 · -0,41 · 26,00
const CODE = /^\d{4}$/;
const toNum = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const r2 = (n: number) => Math.round(n * 100) / 100;

const FISSE = ['1000', '1001', '1025'];
const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
  'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];

function rowsOf(items: any[]): Map<number, Item[]> {
  const rows = new Map<number, Item[]>();
  for (const it of items) {
    const s: string = (it.str || '').trim();
    if (!s) continue;
    const x: number = it.transform[4];
    const y = Math.round(it.transform[5]);
    let key: number | null = null;
    for (const k of rows.keys()) { if (Math.abs(k - y) <= 2) { key = k; break; } }
    if (key === null) { key = y; rows.set(key, []); }
    rows.get(key)!.push({ x, s });
  }
  for (const items of rows.values()) items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Estrae la verità completa da una busta Mercitalia (PDF ADP testuale). */
export async function extractMercTruth(data: Uint8Array): Promise<MercTruth> {
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const codes: Record<string, number> = {};
  let giorniInps: number | null = null;
  let fallback1213: number | null = null;
  let daysVacation = 0;
  let foundHeader = false;
  let is13a14a = false;
  let period: MercTruth['period'] = null;
  let sumComp = 0;
  let totComp: number | null = null;
  const pageSigs = new Set<string>();

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const sig = (content.items as any[]).map(i => i.str).join('');
      if (pageSigs.has(sig)) { page.cleanup(); continue; }
      pageSigs.add(sig);
      const rows = rowsOf(content.items as any[]);

      // ancore colonne: l'header ADP è spezzato su più righe → si cercano le etichette in pagina
      let valX: number | null = null, numX: number | null = null, unitX: number | null = null;
      let compX: number | null = null, trattX: number | null = null;
      for (const items of rows.values()) {
        for (const it of items) {
          if (it.s === 'Valori') valX = it.x;
          else if (it.s === 'base di calcolo' || it.s === 'Numero o') numX = numX === null ? it.x : Math.min(numX, it.x);
          else if (it.s === 'unitario o %' || it.s === 'Compenso') unitX = unitX === null ? it.x : Math.min(unitX, it.x);
          else if (it.s === 'Competenze') compX = it.x;
          else if (it.s === 'Trattenute') trattX = it.x;
        }
      }

      for (const [, items] of rows) {
        const joined = items.map(i => i.s).join(' ');

        if (giorniInps === null) {
          const lab = items.find(i => i.s.startsWith('GIORNI INPS'));
          if (lab) {
            const inline = lab.s.match(/GIORNI INPS\s+(\d+(?:,\d+)?)/);
            const raw = inline ? inline[1]
              : items.filter(i => i.x > lab.x && /^\d+(?:,\d{2})?$/.test(i.s)).sort((a, b) => a.x - b.x)[0]?.s;
            if (raw) giorniInps = toNum(raw.includes(',') ? raw : raw + ',00');
          }
        }
        if (!period) {
          const m = joined.match(/PERIODO\s+([A-Z]+)\s+(20\d{2})/);
          if (m) {
            const mi = MESI.indexOf(m[1]);
            if (mi >= 0) period = { month: mi + 1, year: parseInt(m[2], 10) };
          }
          if (/13\s*MA\s*MENSILITA|14\s*MA\s*MENSILITA/i.test(joined) && /PERIODO/.test(joined)) is13a14a = true;
        }

        if (valX === null || numX === null || unitX === null || compX === null || trattX === null) continue;

        // riga "Totali" a fondo tabella → totale Competenze per la riconciliazione
        if (totComp === null && items.some(i => i.s === 'Totali')) {
          const v = items.find(i => NUM.test(i.s) && i.x >= compX - 8 && i.x < trattX - 8);
          if (v) totComp = toNum(v.s);
          continue;
        }

        // righe voci: primo item nella colonna codici (i flag ++/-- sono fusi nel primo item)
        const first = items[0];
        if (!first || first.x > 45) continue;
        const code = first.s.split(/\s+/)[0];
        if (!CODE.test(code)) continue;
        foundHeader = true;

        let vVal: number | null = null, vNum: number | null = null, vComp: number | null = null;
        for (const it of items) {
          if (it === first || !NUM.test(it.s)) continue;
          if (it.x >= valX - 8 && it.x < numX - 8) vVal = toNum(it.s);
          else if (it.x >= numX - 8 && it.x < unitX - 8) vNum = toNum(it.s);
          else if (it.x >= compX - 8 && it.x < trattX - 8) vComp = toNum(it.s);
        }

        if (code === '3833') {
          // segno dalla colonna Valori, giorni dalla colonna Numero (storni negativi esclusi)
          const sign = vVal ?? vNum ?? 0;
          if (sign >= 0) daysVacation += vNum ?? Math.abs(vVal ?? 0);
          continue;
        }
        if (code === '1213' && vNum !== null) fallback1213 = vNum;
        if (FISSE.includes(code) && vVal !== null) codes[code] = r2((codes[code] || 0) + vVal);
        if (vComp !== null && !FISSE.includes(code)) codes[code] = r2((codes[code] || 0) + vComp);
        if (vComp !== null) sumComp = r2(sumComp + vComp);
      }
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  const gInps = giorniInps ?? fallback1213 ?? 0;
  const daysWorked = r2(gInps - daysVacation);
  return {
    isText: foundHeader,
    codes,
    hasDays: giorniInps !== null || fallback1213 !== null,
    daysWorked,
    daysVacation: r2(daysVacation),
    daysPaidLeave: 0,
    daysUncertain: daysWorked < 0 || daysWorked > 31,
    reconOk: totComp !== null && Math.abs(sumComp - totComp) < 0.011,
    is13a14a,
    period,
  };
}
