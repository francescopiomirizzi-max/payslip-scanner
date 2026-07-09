// Parser di VERITÀ per buste RFI/Trenitalia — feature "prova d'accuratezza".
// Estrae dal PDF (testuale) la verità deterministica da confrontare col dato del motore:
//   - somma per codice voce dalla colonna COMPETENZE (indennità variabili + fisse Quadro B);
//   - giorni lavorati (Presenze) e ferie godute (Ferie) dalla banda di testata.
// Gira LATO CLIENT con PDF.js (già nel progetto). Solo PDF con testo: le SCANSIONI non hanno
// testo → isText=false → non verificabili qui (servirebbe l'OCR, cioè il motore stesso).
// Logica validata in Node contro il parser pdftotext (Nov2012/Gen2022/Mar2019, entrambi i layout).

import { getPdfjs } from '../lib/pdfChunker';

export interface RfiTruth {
  /** false = PDF senza testo (scansione) → non verificabile. */
  isText: boolean;
  /** codice voce → somma dei valori in colonna Competenze (righe multiple sommate). */
  codes: Record<string, number>;
  /** true se la banda Presenze/Ferie è stata trovata (giorni affidabili). */
  hasDays: boolean;
  /** giorni lavorati (colonna "Presenze" della banda). */
  daysWorked: number;
  /** ferie godute nel mese (colonna "Ferie" standalone della banda). */
  daysVacation: number;
  /** assenze retribuite (colonna "Assenze retribuite", subito dopo "Infortuni"). */
  daysPaidLeave: number;
}

interface Item { x: number; right: number; s: string; }

const CODE = /^[0-9/][0-9A-Z]{3}$/;               // 0152, 0AA1, 3B01, /4C1, 9DT6…
const NUM = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;         // 1.520,64 / 12,00
const toNum = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

/** Raggruppa gli item di testo PDF.js in RIGHE per coordinata y (tolleranza 2). */
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
    rows.get(key)!.push({ x, right: x + (it.width || 0), s });
  }
  return rows;
}

/** daysWorked (Presenze) + daysVacation (Ferie) dalla banda, per COLONNA (allineamento x). */
function extractDays(rows: Map<number, Item[]>): { daysWorked: number; daysVacation: number; daysPaidLeave: number } | null {
  let bandY: number | null = null;
  let labels: Item[] | null = null;
  for (const [y, items] of rows) {
    const j = items.map(i => i.s).join(' ');
    if (j.includes('Presenze') && j.includes('Riposi') && j.includes('Ferie')) {
      bandY = y; labels = [...items].sort((a, b) => a.x - b.x); break;
    }
  }
  if (!labels || bandY === null) return null;
  const presX = labels.find(i => i.s === 'Presenze')?.x;
  const ferieIdx = labels.findIndex(i => i.s === 'Ferie');   // primo "Ferie" = quello standalone
  const ferieX = ferieIdx >= 0 ? labels[ferieIdx].x : undefined;
  const nextX = ferieIdx >= 0 ? (labels[ferieIdx + 1]?.x ?? 1e9) : 1e9; // confine dx = "26mi PTV"
  const riposiX = labels.find(i => i.s === 'Riposi')?.x;
  if (presX === undefined || ferieX === undefined || riposiX === undefined) return null;
  // riga valori = la riga numerica subito sotto la banda (y minore, vicino)
  let valRow: Item[] | null = null;
  let best = Infinity;
  for (const [y, items] of rows) {
    if (y < bandY && (bandY - y) < 25 && items.some(i => /^\d/.test(i.s))) {
      if (bandY - y < best) { best = bandY - y; valRow = items; }
    }
  }
  if (!valRow) return null;
  const nums = valRow.filter(i => /^\d/.test(i.s)).sort((a, b) => a.x - b.x);
  const inCol = (lo: number, hi: number) => nums.filter(n => n.x >= lo - 6 && n.x < hi - 6);
  const pres = inCol(presX, riposiX)[0];
  const fer = inCol(ferieX, nextX)[0];
  // "Assenze retribuite" (subito dopo "Infortuni"), da NON confondere con la gemella
  // "Assenze non retribuite" che le sta subito a destra. Ancoriamo sulla PRIMA "Assenze…"
  // (per x = quella retribuita) e chiudiamo la colonna all'etichetta SUCCESSIVA (= inizio
  // di "Assenze non retribuite"): così un valore che cade nella colonna non retribuita
  // NON viene scambiato per assenza retribuita quando la retribuita è vuota (es. Giu 2007).
  const paidIdx = labels.findIndex(i => /assenz/i.test(i.s));
  let daysPaidLeave = 0;
  if (paidIdx >= 0) {
    const pl = inCol(labels[paidIdx].x, labels[paidIdx + 1]?.x ?? 1e9)[0];
    if (pl) daysPaidLeave = toNum(pl.s);
  }
  return { daysWorked: pres ? toNum(pres.s) : 0, daysVacation: fer ? toNum(fer.s) : 0, daysPaidLeave };
}

/** Estrae la verità completa da una busta RFI/Trenitalia (PDF testuale). */
export async function extractRfiTruth(data: Uint8Array): Promise<RfiTruth> {
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const codes: Record<string, number> = {};
  let daysWorked = 0;
  let daysVacation = 0;
  let daysPaidLeave = 0;
  let foundHeader = false;
  let foundBand = false;

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const rows = rowsOf(content.items as any[]);

      // colonna Competenze dalla riga header della tabella voci
      let compX: number | null = null;
      for (const items of rows.values()) {
        const j = items.map(i => i.s).join(' ');
        if (j.includes('Competenze') && j.includes('Trattenute') && j.includes('Descrizione')) {
          const c = items.find(i => i.s.includes('Competenze'));
          if (c) compX = compX === null ? c.x : Math.min(compX, c.x);
        }
      }
      if (compX !== null) {
        foundHeader = true;
        for (const items of rows.values()) {
          const sorted = [...items].sort((a, b) => a.x - b.x);
          const first = sorted[0];
          if (!first || !CODE.test(first.s)) continue;
          let cv: number | null = null;
          for (const it of sorted) { if (NUM.test(it.s) && it.right >= compX - 2) cv = toNum(it.s); }
          if (cv !== null) codes[first.s] = Math.round(((codes[first.s] || 0) + cv) * 100) / 100;
        }
      }

      // banda giorni (di norma in pagina 1): la prendiamo una volta sola
      if (!foundBand) {
        const band = extractDays(rows);
        if (band) { daysWorked = band.daysWorked; daysVacation = band.daysVacation; daysPaidLeave = band.daysPaidLeave; foundBand = true; }
      }
      page.cleanup();
    }
  } finally {
    // Libera SEMPRE il documento PDF.js. Senza destroy(), su una cartella di 200+ buste
    // (prova d'accuratezza) i documenti si accumulano nel worker → il tab va in OOM
    // (Chrome "Uffa!", codice errore 5). Anche in caso di PDF illeggibile che throwa.
    await pdf.destroy();
  }

  return { isText: foundHeader, codes, hasDays: foundBand, daysWorked, daysVacation, daysPaidLeave };
}
