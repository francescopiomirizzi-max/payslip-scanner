// ==========================================
// FILE: utils/rivalutazione.ts
// Rivalutazione monetaria ISTAT FOI + interessi legali "tempo per tempo" per
// l'area Turni & Riposi (art. 429 c.p.c.). Modulo PURO: nessun I/O, nessuna
// dipendenza dall'app — tutto deterministico e testabile.
//
// METODO (calibrato sul prospetto del perito «Viterbo (Interessi e
// Rivalutazioni).pdf», 165 pagine mensili riprodotte 153/165 al centesimo,
// Δ complessivo +0,004% da arrotondamenti interni del suo software non
// riproducibili con gli indici pubblicati — vedi report di sessione 12/07):
// - un calcolo per ogni MESE con danno: capitale = danno del mese,
//   decorrenza = ultimo giorno del mese, scadenza comune;
// - rivalutazione CONCATENATA per anno solare: ad ogni fine-anno (o alla
//   scadenza per l'ultimo segmento) il capitale è moltiplicato per il
//   coefficiente FOI arrotondato alla TERZA cifra decimale
//   (indice di fine segmento ÷ indice di fine segmento precedente),
//   con arrotondamento del capitale al centesimo ad ogni passo;
// - interessi legali per segmento: capitale rivalutato di fine segmento ×
//   tasso dell'anno × giorni/365 (base FISSA 365 anche nei bisestili),
//   giorni = differenza di calendario tra i confini del segmento;
// - la rivalutazione complessiva del mese non è mai negativa (divieto di
//   svalutazione del credito di lavoro): floor a 0 sul risultato finale.
//
// Il motore annuale delle Incidenze (istatService.ts) resta separato e
// invariato: qui serve il metodo mensile/a giorni per riconciliare col
// prospetto del perito.
// ==========================================

import type { GiornataInput, Violazione } from './restEngine';

// ─── Indici ISTAT FOI (senza tabacchi) mensili, COME PUBBLICATI ───────────────
// Fonte: tavole ufficiali ISTAT (prospetto CCIAA su dati ISTAT + GU), verificate
// il 12/07/2026 su due fonti indipendenti e — per il 2011-2024 — identiche agli
// indici stampati nel prospetto del perito. UN decimale, base indicata a fianco.
// 2011-2015: base 2010=100 · 2016-2025: base 2015=100 · dal 2026: base 2025=100.

const FOI_2010: Record<string, number[]> = {
    // base 2010=100                G      F      M      A      M      G      L      A      S      O      N      D
    '2011': [101.2, 101.5, 101.9, 102.4, 102.5, 102.6, 102.9, 103.2, 103.2, 103.6, 103.7, 104.0],
    '2012': [104.4, 104.8, 105.2, 105.7, 105.6, 105.8, 105.9, 106.4, 106.4, 106.4, 106.2, 106.5],
    '2013': [106.7, 106.7, 106.9, 106.9, 106.9, 107.1, 107.2, 107.6, 107.2, 107.1, 106.8, 107.1],
    '2014': [107.3, 107.2, 107.2, 107.4, 107.3, 107.4, 107.3, 107.5, 107.1, 107.2, 107.0, 107.0],
    '2015': [106.5, 106.8, 107.0, 107.1, 107.2, 107.3, 107.2, 107.4, 107.0, 107.2, 107.0, 107.0],
};
const FOI_2015: Record<string, number[]> = {
    // base 2015=100
    '2016': [99.7, 99.5, 99.6, 99.6, 99.7, 99.9, 100.0, 100.2, 100.0, 100.0, 100.0, 100.3],
    '2017': [100.6, 101.0, 101.0, 101.3, 101.1, 101.0, 101.0, 101.4, 101.1, 100.9, 100.8, 101.1],
    '2018': [101.5, 101.5, 101.7, 101.7, 102.0, 102.2, 102.5, 102.9, 102.4, 102.4, 102.2, 102.1],
    '2019': [102.2, 102.3, 102.5, 102.6, 102.7, 102.7, 102.7, 103.2, 102.5, 102.4, 102.3, 102.5],
    '2020': [102.7, 102.5, 102.6, 102.5, 102.3, 102.4, 102.3, 102.5, 101.9, 102.0, 102.0, 102.3],
    '2021': [102.9, 103.0, 103.3, 103.7, 103.6, 103.8, 104.2, 104.7, 104.5, 105.1, 105.7, 106.2],
    '2022': [107.7, 108.8, 109.9, 109.7, 110.6, 111.9, 112.3, 113.2, 113.5, 117.2, 117.9, 118.2],
    '2023': [118.3, 118.5, 118.0, 118.4, 118.6, 118.6, 118.7, 119.1, 119.3, 119.2, 118.7, 118.9],
    '2024': [119.3, 119.3, 119.4, 119.3, 119.5, 119.5, 120.0, 120.1, 120.0, 120.1, 120.1, 120.2],
    '2025': [120.9, 121.1, 121.4, 121.3, 121.2, 121.3, 121.8, 121.8, 121.7, 121.4, 121.3, 121.5],
};
const FOI_2025: Record<string, number[]> = {
    // base 2025=100 (serie in corso: si estende ad ogni pubblicazione ISTAT)
    '2026': [100.4, 100.9, 101.5, 102.5, 102.8],
};

/** Coefficienti ufficiali di raccordo tra basi (ISTAT): indice nuova base × raccordo
 *  = indice nella base precedente. 1,071 = media 2015 in base 2010; 1,214 = media
 *  2025 in base 2015. */
export const RACCORDO_2015_SU_2010 = 1.071;
export const RACCORDO_2025_SU_2015 = 1.214;

/** Indice FOI del mese 'YYYY-MM' riportato alla scala UNIFICATA (equivalente base
 *  2010): i rapporti tra mesi della stessa base restano esatti (la scala si
 *  cancella), quelli tra basi diverse incorporano il raccordo ufficiale. */
export function foiUnificato(ym: string): number | undefined {
    const [y, m] = ym.split('-');
    const idx = parseInt(m, 10) - 1;
    if (FOI_2010[y]?.[idx] != null) return FOI_2010[y][idx];
    if (FOI_2015[y]?.[idx] != null) return FOI_2015[y][idx] * RACCORDO_2015_SU_2010;
    if (FOI_2025[y]?.[idx] != null) return FOI_2025[y][idx] * RACCORDO_2025_SU_2015 * RACCORDO_2015_SU_2010;
    return undefined;
}

/** Primo e ultimo mese coperti dalla serie FOI ('YYYY-MM'). */
export const PRIMO_MESE_FOI = '2011-01';
export const ULTIMO_MESE_FOI = (() => {
    const anni = Object.keys(FOI_2025).sort();
    const y = anni[anni.length - 1];
    return `${y}-${String(FOI_2025[y].length).padStart(2, '0')}`;
})();

// ─── Tassi di interesse legale (art. 1284 c.c., DM MEF annuali) ────────────────
// Verificati il 12/07/2026: 2025 = 2,00% (DM 10/12/2024), 2026 = 1,60%
// (DM 10/12/2025, GU n. 289 del 13/12/2025). NB: la tabella delle Incidenze in
// istatService.ts riporta 2025 = 2,50 (provvisorio, errato) — segnalato, non
// modificato qui (modulo separato per scelta).
export const TASSI_LEGALI: Record<number, number> = {
    2011: 1.5, 2012: 2.5, 2013: 2.5, 2014: 1.0, 2015: 0.5, 2016: 0.2,
    2017: 0.1, 2018: 0.3, 2019: 0.8, 2020: 0.05, 2021: 0.01, 2022: 1.25,
    2023: 5.0, 2024: 2.5, 2025: 2.0, 2026: 1.6,
};

// ─── Tipi ──────────────────────────────────────────────────────────────────────

/** Un segmento annuale del calcolo di un mese (una riga dell'analitico). */
export interface SegmentoRivalutazione {
    anno: number;
    dal: string;                 // 'DD/MM/YYYY' — confine iniziale (escluso dal conteggio giorni)
    al: string;                  // 'DD/MM/YYYY' — confine finale (incluso)
    capitaleRivalutato: number;  // capitale rivalutato a fine segmento
    tasso: number;               // % legale dell'anno
    giorni: number;
    interessi: number;
}

/** Il calcolo completo di un mese di danno. */
export interface RivalutazioneMese {
    decorrenza: string;          // 'YYYY-MM'
    capitale: number;
    segmenti: SegmentoRivalutazione[];
    capitaleRivalutato: number;
    rivalutazione: number;       // capitaleRivalutato − capitale (mai negativa)
    interessi: number;
    totale: number;              // capitaleRivalutato + interessi
    /** true = decorrenza fuori dalla copertura della serie FOI: capitale incluso
     *  nei totali ma senza rivalutazione/interessi (dichiarato nei documenti). */
    fuoriCopertura?: boolean;
}

export interface RigaAnnoRivalutazione {
    anno: string;                // anno di DECORRENZA del danno
    capitale: number;
    rivalutazione: number;
    interessi: number;
    totale: number;
}

export interface RivalutazioneResult {
    righeMese: RivalutazioneMese[];
    /** Aggregato per anno di decorrenza (l'«analitico delle annualità»). */
    perAnno: RigaAnnoRivalutazione[];
    totCapitale: number;
    totRivalutazione: number;
    totInteressi: number;
    totale: number;
    scadenzaRichiesta: string;   // 'YYYY-MM'
    /** Scadenza effettiva del calcolo: la richiesta, limitata all'ultimo indice
     *  FOI pubblicato (policy: mai stimare un indice non pubblicato). */
    scadenzaEffettiva: string;
    scadenzaLimitata: boolean;
    /** Mesi con capitale fuori dalla copertura FOI (se presenti, dichiarati). */
    mesiFuoriCopertura: number;
}

// ─── Calcolo ───────────────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const dUTC = (dmy: string): number => {
    const [dd, mm, yy] = dmy.split('/').map((x) => parseInt(x, 10));
    return Date.UTC(yy, mm - 1, dd);
};
const daysDiff = (a: string, b: string): number => Math.round((dUTC(b) - dUTC(a)) / 86_400_000);
/** Ultimo giorno del mese 'YYYY-MM' → 'DD/MM/YYYY'. */
export const ultimoGiornoDelMese = (ym: string): string => {
    const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
    return `${new Date(Date.UTC(y, m, 0)).getUTCDate()}/${String(m).padStart(2, '0')}/${y}`;
};

/** 'YYYY-MM' del mese corrente (scadenza di default per i chiamanti). */
export const ymCorrente = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Rivalutazione + interessi legali di un singolo mese di danno, dal mese di
 * decorrenza (ultimo giorno) alla scadenza (ultimo giorno). Entrambi 'YYYY-MM',
 * già dentro la copertura FOI — i chiamanti passano da `buildRivalutazione`.
 */
export function calcolaRivalutazioneMese(capitale: number, decorrenza: string, scadenza: string): RivalutazioneMese {
    const segmenti: SegmentoRivalutazione[] = [];
    const y0 = parseInt(decorrenza.slice(0, 4), 10);
    const y1 = parseInt(scadenza.slice(0, 4), 10);

    let cap = capitale;
    let prevFoi = foiUnificato(decorrenza)!;
    let prevConfine = ultimoGiornoDelMese(decorrenza);
    let totInteressi = 0;

    for (let y = y0; y <= y1; y++) {
        const fineYM = y === y1 ? scadenza : `${y}-12`;
        const fineConfine = ultimoGiornoDelMese(fineYM);
        const idx = foiUnificato(fineYM)!;
        cap = round2(cap * round3(idx / prevFoi));
        const giorni = daysDiff(prevConfine, fineConfine);
        const tasso = TASSI_LEGALI[y] ?? 0;
        const interessi = round2(cap * (tasso / 100) * (giorni / 365));
        segmenti.push({ anno: y, dal: prevConfine, al: fineConfine, capitaleRivalutato: cap, tasso, giorni, interessi });
        totInteressi += interessi;
        prevFoi = idx;
        prevConfine = fineConfine;
    }

    // Divieto di svalutazione del credito: la rivalutazione complessiva non è mai
    // negativa (i coefficienti dei singoli anni possono invece scendere sotto 1,
    // come nel prospetto del perito per il 2014 e il 2020).
    if (cap < capitale) cap = capitale;

    return {
        decorrenza,
        capitale: round2(capitale),
        segmenti,
        capitaleRivalutato: cap,
        rivalutazione: round2(cap - capitale),
        interessi: round2(totInteressi),
        totale: round2(cap + totInteressi),
    };
}

/**
 * Calcolo completo su un insieme di capitali mensili ('YYYY-MM' → €), con
 * scadenza limitata all'ultimo indice FOI pubblicato. I mesi fuori copertura
 * (o successivi alla scadenza effettiva) entrano nei totali col solo capitale.
 */
export function buildRivalutazione(capitaliPerMese: Record<string, number>, scadenza: string): RivalutazioneResult {
    const scadenzaEffettiva = scadenza > ULTIMO_MESE_FOI ? ULTIMO_MESE_FOI : scadenza;
    const righeMese: RivalutazioneMese[] = [];
    let mesiFuoriCopertura = 0;

    for (const ym of Object.keys(capitaliPerMese).sort()) {
        const capitale = round2(capitaliPerMese[ym]);
        if (capitale <= 0) continue;
        if (ym < PRIMO_MESE_FOI) {
            mesiFuoriCopertura++;
            righeMese.push({ decorrenza: ym, capitale, segmenti: [], capitaleRivalutato: capitale, rivalutazione: 0, interessi: 0, totale: capitale, fuoriCopertura: true });
            continue;
        }
        if (ym >= scadenzaEffettiva) {
            // danno maturato alla scadenza (o dopo): nessun tempo per rivalutare
            righeMese.push({ decorrenza: ym, capitale, segmenti: [], capitaleRivalutato: capitale, rivalutazione: 0, interessi: 0, totale: capitale });
            continue;
        }
        righeMese.push(calcolaRivalutazioneMese(capitale, ym, scadenzaEffettiva));
    }

    const perAnnoMap: Record<string, RigaAnnoRivalutazione> = {};
    for (const r of righeMese) {
        const y = r.decorrenza.slice(0, 4);
        const riga = (perAnnoMap[y] ??= { anno: y, capitale: 0, rivalutazione: 0, interessi: 0, totale: 0 });
        riga.capitale += r.capitale;
        riga.rivalutazione += r.rivalutazione;
        riga.interessi += r.interessi;
        riga.totale += r.totale;
    }
    const perAnno = Object.values(perAnnoMap)
        .sort((a, b) => a.anno.localeCompare(b.anno))
        .map((r) => ({ anno: r.anno, capitale: round2(r.capitale), rivalutazione: round2(r.rivalutazione), interessi: round2(r.interessi), totale: round2(r.totale) }));

    const sum = (f: (r: RivalutazioneMese) => number) => round2(righeMese.reduce((a, r) => a + f(r), 0));
    return {
        righeMese,
        perAnno,
        totCapitale: sum((r) => r.capitale),
        totRivalutazione: sum((r) => r.rivalutazione),
        totInteressi: sum((r) => r.interessi),
        totale: sum((r) => r.totale),
        scadenzaRichiesta: scadenza,
        scadenzaEffettiva,
        scadenzaLimitata: scadenzaEffettiva !== scadenza,
        mesiFuoriCopertura,
    };
}

// ─── Aggregazione dei capitali mensili dalle due serie ────────────────────────

/** 'DD/MM/YYYY' → 'YYYY-MM' (undefined se non interpretabile). */
const dmyToYm = (dmy?: string): string | undefined => {
    if (!dmy) return undefined;
    const [, mm, yyyy] = dmy.trim().split(/[\/\-.]/);
    return yyyy && mm ? `${yyyy}-${mm.padStart(2, '0')}` : undefined;
};

/** Serie A: indennità della fonte aggregate per mese di calendario. */
export function capitaliMensiliSerieA(giornate: GiornataInput[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const g of giornate) {
        if (g.indennitaFonte == null || g.indennitaFonte <= 0) continue;
        const ym = dmyToYm(g.data);
        if (!ym) continue;
        out[ym] = (out[ym] ?? 0) + g.indennitaFonte;
    }
    for (const k of Object.keys(out)) out[k] = round2(out[k]);
    return out;
}

/** Serie B: indennità delle violazioni aggregate per mese del giorno-turno di
 *  attribuzione (`dataTurno`, come la fonte; fallback: inizio del riposo). */
export function capitaliMensiliSerieB(violazioni: Violazione[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of violazioni) {
        if (v.indennita <= 0) continue;
        const ym = dmyToYm(v.dataTurno) ?? v.inizio.slice(0, 7);
        out[ym] = (out[ym] ?? 0) + v.indennita;
    }
    for (const k of Object.keys(out)) out[k] = round2(out[k]);
    return out;
}
