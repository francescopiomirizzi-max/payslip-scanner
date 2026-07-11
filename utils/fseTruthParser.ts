// Parser di VERITÀ per buste FSE (Ferrovie del Sud Est, gestionale Zucchetti) — feature
// "prova d'accuratezza". Copre le ere TESTUALI: I8/T8 (nov 2020→oggi) e IX (lug 2017–ott 2020).
// L'era storica SPA-GUIDA (set 2010–giu 2017) è fatta di SCANSIONI senza testo → isText=false,
// resta coperta da OCR + censimento (tasks/censimento-codici-fse-2011-2016.md).
//
// Estrae dal PDF:
//   - somma per codice voce dalla colonna COMPETENZE, COL SEGNO (gli storni nettano: es. Mag 2021
//     I86178 609,84+1905,75 e I86005 −1611,75 — verificati al centesimo);
//   - giorni lavorati = quantità G NETTA delle voci di presenza (I86178/I86005/IX0023), stessa
//     definizione del motore (PROMPT_FSE §2). La banda "GG LAV." di testata NON si usa: la
//     calibrazione su 107 buste reali ha mostrato che nell'era IX è un 22 TEORICO costante.
//     Quantità > 31 (arretrati multi-mese, es. Gen 2018 = 16+22) → daysUncertain, non si confronta;
//   - ferie = ore della voce F2105 ÷ 6,5 (intere su tutti i 107 mesi calibrati);
//   - voci fisse fse_* dal box "ELEMENTI DELLA RETRIBUZIONE" (solo le 5 etichette tracciate;
//     il box è ristampato sul retro → si legge UNA volta sola).
//
// Autovalidazione (reconOk): la Σ di tutti i valori Competenze letti deve quadrare col box
// "TOT COMPETENZE" stampato sul cedolino (107/107 in calibrazione). Se non quadra, il layout
// è cambiato o la lettura è sbagliata → la busta NON va usata come verità.
// Trappole gestite (tutte trovate sui PDF reali): riga banca "INTESA SANPAOLO … Emolumenti
// correnti" (2022+) e "D01CNG Esonero L.234" cadono in zona Competenze ma NON sono voci →
// la regione voci è delimitata da header → separatore "---- Imponibili"/riga NOTE; i crediti
// fiscali WZF* (DL 66/2014) sono contati da Zucchetti nel TOT → solo riconciliazione, mai codici.

import { getPdfjs } from '../lib/pdfChunker';

export interface FseTruth {
  /** false = PDF senza testo (era storica/scansione) → non verificabile qui. */
  isText: boolean;
  /** codice voce (e chiavi fse_* del box ELEMENTI) → somma Competenze col segno. */
  codes: Record<string, number>;
  hasDays: boolean;
  /** quantità G netta delle voci di presenza (definizione del motore). */
  daysWorked: number;
  /** ore F2105 ÷ 6,5. */
  daysVacation: number;
  /** non tracciato per FSE. */
  daysPaidLeave: number;
  /** true = presenze > 31 (arretrati multi-mese): giorni ambigui, da non confrontare. */
  daysUncertain: boolean;
  /** false = Σ Competenze ≠ TOT COMPETENZE stampato → busta da scartare come verità. */
  reconOk: boolean;
  /** true = cedolino di 13ª/14ª (fuori conteggio per regola pratica). */
  is13a14a: boolean;
  /** periodo letto dal box "PERIODO DI RETRIBUZIONE" (per il check col nome file). */
  period: { month: number; year: number } | null;
}

interface Item { x: number; s: string; }

const NUM2 = /^-?\d+(?:\.\d{3})*,\d{2}$/;   // importi: 609,84 · -1611,75 · 1.985,50
const QTY3 = /^-?\d+(?:\.\d{3})*,\d{3}$/;   // quantità ORE/GIORNI: 24,000 · -75,000
const CODE = /^[A-Z][A-Z0-9]{3,5}$/;        // I85240, T8305, IX0023, F2105… (esclude 005/088/F11)
const toNum = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const norm = (s: string) => s.replace(/\s+/g, ''); // "C O M P E T E N Z E" → "COMPETENZE"
const r2 = (n: number) => Math.round(n * 100) / 100;

const PRESENZA = ['I86178', 'I86005', 'IX0023'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
// Etichette del box ELEMENTI tracciate; le altre (Ass.perequativo, Ass-ad personam…) restano fuori
// perché il motore non le mappa (PROMPT_FSE §5-bis).
const ELEM_MAP: { key: string; test: (l: string) => boolean }[] = [
  { key: 'fse_minimo',      test: l => l.includes('Minimo') },
  { key: 'fse_contingenza', test: l => l.includes('Contingenza') },
  { key: 'fse_tdr',         test: l => l.includes('T.D.R') },
  { key: 'fse_scatti',      test: l => /\bScatti\b/.test(l) },
  { key: 'fse_mensa',       test: l => l.includes('Ind.mensa') },
];

/** Raggruppa gli item di testo PDF.js in RIGHE per coordinata y (tolleranza 2), ordinate per x. */
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

/** Estrae la verità completa da una busta FSE (PDF testuale, ere Zucchetti). */
export async function extractFseTruth(data: Uint8Array): Promise<FseTruth> {
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const codes: Record<string, number> = {};
  const qty: Record<string, number> = {};
  const fisse: Record<string, number> = {};
  let foundHeader = false;
  let is13a14a = false;
  let period: FseTruth['period'] = null;
  let sumComp = 0;
  let totComp: number | null = null;
  const pageSigs = new Set<string>();

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // copie identiche della stessa pagina nel medesimo PDF → una volta sola
      const sig = (content.items as any[]).map(i => i.str).join('');
      if (pageSigs.has(sig)) { page.cleanup(); continue; }
      pageSigs.add(sig);
      const rows = rowsOf(content.items as any[]);

      // header tabella voci → ancore colonne (etichette a lettere spaziate: normalizzare)
      let headerY: number | null = null;
      let oreX: number | null = null, unitX: number | null = null;
      let compX: number | null = null, trattX: number | null = null;
      for (const [y, items] of rows) {
        const j = items.map(i => norm(i.s)).join('|');
        if (j.includes('CODICE') && j.includes('DESCRIZIONEVOCE') && j.includes('COMPETENZE')) {
          headerY = y;
          for (const it of items) {
            const n = norm(it.s);
            if (n === 'ORE/GIORNI') oreX = it.x;
            else if (n === 'IMPORTOUNITARIO') unitX = it.x;
            else if (n === 'COMPETENZE') compX = it.x;
            else if (n === 'TRATTENUTE') trattX = it.x;
          }
          break;
        }
      }

      // periodo (riga sotto il box "PERIODO DI RETRIBUZIONE") + marcatore 13ª/14ª
      if (!period) {
        let periodY: number | null = null;
        for (const [y, items] of rows) {
          if (items.some(i => i.s === 'PERIODO DI RETRIBUZIONE')) { periodY = y; break; }
        }
        if (periodY !== null) {
          for (const [y, items] of rows) {
            if (y >= periodY || periodY - y > 25) continue;
            const m = items.map(i => i.s).join(' ').match(/([A-Za-zà]+)\s+(20\d{2})/);
            if (m) {
              const mi = MESI.findIndex(x => x.startsWith(m[1].toLowerCase().slice(0, 4)));
              if (mi >= 0) period = { month: mi + 1, year: parseInt(m[2], 10) };
              break;
            }
          }
        }
        for (const items of rows.values()) {
          const j = items.map(i => i.s).join(' ').toLowerCase();
          if (j.includes('13a mens') || j.includes('14a mens')) is13a14a = true;
        }
      }

      if (headerY !== null && compX !== null && trattX !== null) {
        foundHeader = true;
        // la tabella voci finisce al separatore "---- Imponibili" (o alla riga NOTE)
        let endY = -1e9;
        for (const [y, items] of rows) {
          if (y >= headerY) continue;
          if (items[0]?.s.startsWith('----') || items.some(i => i.s.includes('DESCRIZIONE IMPONIBILE FISCALE'))) {
            if (y > endY) endY = y;
          }
        }
        for (const [y, items] of rows) {
          if (y >= headerY) continue;
          const first = items[0];
          if (!first || first.x > 50) continue;
          const code = first.s.split(/\s+/)[0];
          if (!CODE.test(code)) continue;
          const inVoci = y > endY;
          if (!inVoci && !code.startsWith('WZF')) continue; // sotto il separatore: solo crediti WZF (recon)
          let cv: number | null = null, qv: number | null = null;
          for (const it of items) {
            if (it === first) continue;
            if (NUM2.test(it.s) && it.x >= compX - 10 && it.x < trattX - 10) cv = toNum(it.s);
            if (QTY3.test(it.s) && oreX !== null && unitX !== null && it.x >= oreX - 10 && it.x < unitX - 10) qv = toNum(it.s);
          }
          if (cv !== null) sumComp = r2(sumComp + cv);
          if (!inVoci) continue;
          if (cv !== null) codes[code] = r2((codes[code] || 0) + cv);
          if (qv !== null) qty[code] = Math.round(((qty[code] || 0) + qv) * 1000) / 1000;
        }

        // box ELEMENTI DELLA RETRIBUZIONE (una volta sola: il retro lo ristampa identico)
        if (Object.keys(fisse).length === 0) {
          let elemY: number | null = null;
          for (const [y, items] of rows) {
            if (items.map(i => norm(i.s)).join('').includes('ELEMENTIDELLARETRIBUZIONE')) { elemY = y; break; }
          }
          if (elemY !== null) {
            // token in ordine di lettura; il valore chiude l'etichetta accumulata
            // (gli item possono fondere valore+etichetta successiva: "542,39 T.D.R.")
            const tokens: string[] = [];
            const boxRows = [...rows.entries()].filter(([y]) => y < elemY && y > headerY!).sort((a, b) => b[0] - a[0]);
            for (const [, items] of boxRows) for (const it of items) for (const t of it.s.split(/\s+/)) if (t) tokens.push(t);
            let label: string[] = [];
            for (const t of tokens) {
              if (t === 'TOTALE') break;
              if (NUM2.test(t)) {
                const hit = ELEM_MAP.find(e => e.test(label.join(' ')));
                if (hit) fisse[hit.key] = r2((fisse[hit.key] || 0) + toNum(t));
                label = [];
              } else label.push(t);
            }
          }
        }
      }

      // box "TOT COMPETENZE" (sul retro): totale per la riconciliazione
      if (totComp === null) {
        for (const [y, items] of rows) {
          const lab = items.find(i => norm(i.s) === 'TOTCOMPETENZE');
          if (!lab) continue;
          const labTr = items.find(i => norm(i.s) === 'TOTTRATTENUTE');
          const hi = labTr ? labTr.x - 10 : 1e9;
          for (const [y2, items2] of rows) {
            if (y2 >= y || y - y2 > 25) continue;
            const v = items2.find(i => NUM2.test(i.s) && i.x >= lab.x - 10 && i.x < hi);
            if (v) { totComp = toNum(v.s); break; }
          }
          if (totComp !== null) break;
        }
      }
      page.cleanup();
    }
  } finally {
    // come extractRfiTruth: senza destroy() i documenti si accumulano nel worker → OOM del tab
    await pdf.destroy();
  }

  const presQty = r2(PRESENZA.reduce((s, c) => s + (qty[c] || 0), 0));
  return {
    isText: foundHeader,
    codes: { ...codes, ...fisse },
    hasDays: foundHeader,
    daysWorked: presQty,
    daysVacation: r2((qty['F2105'] || 0) / 6.5),
    daysPaidLeave: 0,
    daysUncertain: presQty > 31,
    reconOk: totComp !== null && Math.abs(sumComp - totComp) < 0.011,
    is13a14a,
    period,
  };
}
