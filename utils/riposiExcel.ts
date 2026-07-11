// ==========================================
// FILE: utils/riposiExcel.ts
// Export Excel PULITO dell'area Turni & Riposi (exceljs) — l'anti-Excel-di-ChatGPT:
// numeri VERI (date Excel, orari come orari, importi numerici), FORMULE VIVE
// (tariffa €/h PER ANNO sul Riepilogo — cresce per anzianità: ogni violazione la
// pesca via VLOOKUP, cambiarne una ricalcola indennità, riepilogo annuo e totali),
// un foglio per anno + Riepilogo + Violazioni.
//
// buildRiposiWorkbook è puro (testabile via writeBuffer → xlsx.load);
// generateExcelRiposi scarica il file. Import del modulo DINAMICO dal
// componente: exceljs resta fuori dal bundle principale.
// ==========================================

import ExcelJS from 'exceljs';
import { causaleSintetica, computeSerieFonte, parseHmm, type RestResult } from './restEngine';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

const EURO_FMT = '#,##0.00 "€"';
const ORE_FMT = '0.00';
const DATA_FMT = 'dd/mm/yyyy';
const DATAORA_FMT = 'dd/mm/yyyy hh:mm';
const ORARIO_FMT = 'hh:mm';

/** exceljs serializza le date via UTC: una mezzanotte locale diventerebbe il
 *  giorno prima. Si costruisce la data con gli stessi componenti ma in UTC. */
const utcDate = (y: number, m0: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m0, d, h, min));
const dmyToDate = (dmy: string): Date | null => {
    const [d, m, y] = dmy.trim().split(/[\/\-.]/).map((x) => parseInt(x, 10));
    return y && m && d ? utcDate(y, m - 1, d) : null;
};
const isoToDate = (iso: string): Date => {
    const d = new Date(iso);
    return utcDate(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
};
/** 'H.mm' → frazione di giorno Excel (orario vero), null se non interpretabile. */
const hmmToExcelTime = (v: string | undefined): number | null => {
    const min = parseHmm(v);
    return Number.isNaN(min) ? null : min / 1440;
};
/** 'H.mm' → ore decimali (durata), null se non interpretabile. */
const hmmToHours = (v: string | undefined): number | null => {
    const min = parseHmm(v);
    return Number.isNaN(min) ? null : Math.round((min / 60) * 100) / 100;
};

const styleHeaderRow = (row: ExcelJS.Row) => {
    row.font = { bold: true, size: 10 };
    row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
        cell.border = { bottom: { style: 'thin' } };
    });
};

export function buildRiposiWorkbook(pratica: PraticaRiposi, result: RestResult): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'RailFlow';
    const fonte = computeSerieFonte(pratica.giornate);
    const violazioni = [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio));
    const anni = Array.from(new Set([
        ...pratica.giornate.map((g) => g.data.split('/')[2]).filter(Boolean),
        ...violazioni.map((v) => v.inizio.slice(0, 4)),
    ])).sort();
    // Tariffa €/h piena per anno (cresce per anzianità) + coefficiente danno (× sul valore).
    const coeff = pratica.coefficiente ?? 1;
    const rates = result.tariffePerAnnoApplicate;
    const tariffeAnni = Object.keys(rates).sort();

    // ── Foglio RIEPILOGO (creato per primo: deve essere il primo tab) ──────────
    const rie = wb.addWorksheet('Riepilogo');
    rie.columns = [
        { width: 30 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 },
    ];
    rie.getCell('A1').value = `Mancati riposi — ${pratica.cognome} ${pratica.nome}`;
    rie.getCell('A1').font = { bold: true, size: 14 };
    rie.getCell('A2').value = 'Conteggi ex Reg. (CE) n. 561/2006 — le serie A (fonte) e B (motore) NON si sommano';
    rie.getCell('A2').font = { italic: true, size: 9 };
    rie.getCell('A4').value = 'Mansione';
    rie.getCell('B4').value = pratica.mansione ?? '—';
    rie.getCell('A5').value = 'Periodo analizzato';
    rie.getCell('B5').value = `${pratica.periodoStart ?? '—'} – ${pratica.periodoEnd ?? '—'}`;
    rie.getCell('A6').value = 'Giornate nel prospetto turni';
    rie.getCell('B6').value = pratica.giornate.length;
    rie.getCell('A7').value = 'Tariffa oraria €/h per anno — MODIFICABILE';
    rie.getCell('A7').font = { bold: true };
    if (pratica.fonteTariffa) { rie.getCell('C7').value = pratica.fonteTariffa; rie.getCell('C7').font = { italic: true, size: 9 }; }
    rie.getCell('A8').value = 'La retribuzione cresce per anzianità: ogni anno ha la sua tariffa. Cambiando una €/h si ricalcolano da sole le indennità di quell\'anno (serie B), il riepilogo e i totali.';
    rie.getCell('A8').font = { italic: true, size: 9 };

    // ── Blocco TARIFFA €/h per anno (celle ambra modificabili: da qui le formule) ──
    const TAR_HDR = 9;
    rie.getCell(`A${TAR_HDR}`).value = 'Anno';
    rie.getCell(`B${TAR_HDR}`).value = '€/h';
    styleHeaderRow(rie.getRow(TAR_HDR));
    tariffeAnni.forEach((y, i) => {
        const r = TAR_HDR + 1 + i;
        rie.getCell(`A${r}`).value = Number(y);
        const c = rie.getCell(`B${r}`);
        c.value = rates[y];
        c.numFmt = EURO_FMT;
        c.font = { bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
    });
    const TAR_FIRST = TAR_HDR + 1;
    const TAR_LAST = TAR_HDR + Math.max(1, tariffeAnni.length);
    // Range assoluto per i VLOOKUP delle indennità (anno→€/h).
    const TARIFFA_BLOCK = `Riepilogo!$A$${TAR_FIRST}:$B$${TAR_LAST}`;

    // ── Cella COEFFICIENTE di valorizzazione (× sul valore): da qui le indennità si scalano ──
    const COEFF_ROW = TAR_LAST + 2;
    rie.getCell(`A${COEFF_ROW}`).value = 'Coefficiente di valorizzazione (× sul valore) — MODIFICABILE';
    rie.getCell(`A${COEFF_ROW}`).font = { bold: true };
    const coeffCell = rie.getCell(`B${COEFF_ROW}`);
    coeffCell.value = coeff;
    coeffCell.numFmt = '0%';
    coeffCell.font = { bold: true };
    coeffCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
    rie.getCell(`C${COEFF_ROW}`).value = 'es. 120% = maggiorazione +20% · 20% = danno · 100% = valore pieno (criterio del legale)';
    rie.getCell(`C${COEFF_ROW}`).font = { italic: true, size: 9 };
    const COEFF_CELL = `Riepilogo!$B$${COEFF_ROW}`;

    // ── Foglio VIOLAZIONI (serie B; indennità = mancante × tariffa €/h dell'anno) ──
    const vio = wb.addWorksheet('Violazioni');
    vio.columns = [
        { header: 'Anno', width: 8 },
        { header: 'Riposo dal', width: 17 },
        { header: 'al', width: 17 },
        { header: 'Tipo', width: 12 },
        { header: 'Fruito (ore)', width: 12 },
        { header: 'Mancante (ore)', width: 14 },
        { header: 'Tariffa €/h', width: 11 },
        { header: 'Indennità (€)', width: 13 },
        { header: 'Gravità', width: 9 },
        { header: 'Causale', width: 44 },
    ];
    styleHeaderRow(vio.getRow(1));
    violazioni.forEach((v, i) => {
        const r = i + 2;
        const row = vio.getRow(r);
        row.getCell(1).value = Number(v.inizio.slice(0, 4));
        row.getCell(2).value = isoToDate(v.inizio);
        row.getCell(2).numFmt = DATAORA_FMT;
        row.getCell(3).value = isoToDate(v.fine);
        row.getCell(3).numFmt = DATAORA_FMT;
        row.getCell(4).value = v.tipo === 'riposo_giornaliero' ? 'Giornaliero' : 'Settimanale';
        row.getCell(5).value = v.ore;
        row.getCell(5).numFmt = ORE_FMT;
        row.getCell(6).value = v.oreMancanti;
        row.getCell(6).numFmt = ORE_FMT;
        // Tariffa €/h dell'anno: VLOOKUP nel blocco tariffe (la si modifica da lì).
        row.getCell(7).value = { formula: `VLOOKUP(A${r},${TARIFFA_BLOCK},2,FALSE)`, result: rates[v.inizio.slice(0, 4)] };
        row.getCell(7).numFmt = EURO_FMT;
        // Indennità = ore mancanti × tariffa dell'anno × coefficiente danno.
        row.getCell(8).value = { formula: `F${r}*G${r}*${COEFF_CELL}`, result: v.indennita };
        row.getCell(8).numFmt = EURO_FMT;
        row.getCell(9).value = v.gravita;
        if (v.gravita === 'grave') row.getCell(9).font = { bold: true };
        row.getCell(10).value = causaleSintetica(v);
    });
    const lastVioRow = violazioni.length + 1;

    // ── Un foglio per ANNO: il prospetto turni con numeri veri ─────────────────
    for (const anno of anni) {
        const ws = wb.addWorksheet(anno);
        ws.columns = [
            { header: 'Data', width: 12 },
            { header: 'Giorno', width: 8 },
            { header: 'Tipo', width: 8 },
            { header: 'Servizio', width: 10 },
            { header: 'Inizio', width: 9 },
            { header: 'Termine', width: 9 },
            { header: 'Mancato rip. giorn. fonte (ore)', width: 24 },
            { header: 'Mancato rip. sett. fonte (ore)', width: 24 },
            { header: 'Indennità fonte (€)', width: 16 },
        ];
        styleHeaderRow(ws.getRow(1));
        let r = 2;
        for (const g of pratica.giornate) {
            if (g.data.split('/')[2] !== anno) continue;
            const row = ws.getRow(r++);
            const dt = dmyToDate(g.data);
            row.getCell(1).value = dt ?? g.data;
            if (dt) row.getCell(1).numFmt = DATA_FMT;
            row.getCell(2).value = g.gset ?? '';
            row.getCell(3).value = g.tipo ?? '';
            row.getCell(4).value = g.servizio ?? '';
            const ini = hmmToExcelTime(g.inizio);
            const ter = hmmToExcelTime(g.termine);
            // orario vero se interpretabile, altrimenti il testo grezzo (mai inventare)
            row.getCell(5).value = ini ?? g.inizio ?? '';
            if (ini !== null) row.getCell(5).numFmt = ORARIO_FMT;
            row.getCell(6).value = ter ?? g.termine ?? '';
            if (ter !== null) row.getCell(6).numFmt = ORARIO_FMT;
            const mg = hmmToHours(g.mancatoRipGiorn);
            const ms = hmmToHours(g.mancatoRipSett);
            if (mg !== null) { row.getCell(7).value = mg; row.getCell(7).numFmt = ORE_FMT; }
            if (ms !== null) { row.getCell(8).value = ms; row.getCell(8).numFmt = ORE_FMT; }
            if (g.indennitaFonte != null) { row.getCell(9).value = g.indennitaFonte; row.getCell(9).numFmt = EURO_FMT; }
        }
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    vio.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Riepilogo per anno (formule vive su Violazioni e sui fogli-anno) ───────
    const start = COEFF_ROW + 3; // header dopo il blocco tariffe + coefficiente
    rie.getCell(`A${start - 1}`).value = 'Riepilogo per anno';
    rie.getCell(`A${start - 1}`).font = { bold: true, size: 12 };
    const head = rie.getRow(start);
    ['Anno', 'Viol. giornaliere', 'Viol. settimanali', 'Ore mancanti', '€ motore (B)', '€ fonte (A)'].forEach((t, i) => {
        head.getCell(i + 1).value = t;
    });
    styleHeaderRow(head);
    const vRange = (col: string) => `Violazioni!$${col}$2:$${col}$${Math.max(lastVioRow, 2)}`;
    anni.forEach((anno, i) => {
        const r = start + 1 + i;
        const row = rie.getRow(r);
        row.getCell(1).value = Number(anno);
        row.getCell(2).value = { formula: `COUNTIFS(${vRange('A')},A${r},${vRange('D')},"Giornaliero")` };
        row.getCell(3).value = { formula: `COUNTIFS(${vRange('A')},A${r},${vRange('D')},"Settimanale")` };
        row.getCell(4).value = { formula: `SUMIFS(${vRange('F')},${vRange('A')},A${r})` };
        row.getCell(4).numFmt = ORE_FMT;
        // € motore = somma delle indennità (col H) delle violazioni di quell'anno.
        row.getCell(5).value = { formula: `SUMIFS(${vRange('H')},${vRange('A')},A${r})` };
        row.getCell(5).numFmt = EURO_FMT;
        row.getCell(6).value = { formula: `SUM('${anno}'!$I$2:$I$10000)` };
        row.getCell(6).numFmt = EURO_FMT;
    });
    const totRow = start + 1 + anni.length;
    const tot = rie.getRow(totRow);
    tot.getCell(1).value = 'Totale';
    for (let c = 2; c <= 6; c++) {
        const col = String.fromCharCode(64 + c);
        tot.getCell(c).value = { formula: `SUM(${col}${start + 1}:${col}${totRow - 1})` };
        tot.getCell(c).numFmt = c >= 5 ? EURO_FMT : c === 4 ? ORE_FMT : '0';
    }
    tot.font = { bold: true };
    tot.eachCell((cell) => { cell.border = { top: { style: 'thin' } }; });

    // Totali di controllo statici (valori del motore al momento dell'export)
    const note = totRow + 2;
    rie.getCell(`A${note}`).value =
        `Controllo al momento dell'export: serie B = € ${result.totIndennita.toLocaleString('it-IT')} ` +
        `(${result.nViolazioniGiornaliere + result.nViolazioniSettimanali} violazioni); ` +
        `serie A = € ${fonte.ind.toLocaleString('it-IT')} (${fonte.gg} giornate). ` +
        `Righe da verificare a mano: ${result.warnings.length} (escluse dal calcolo).`;
    rie.getCell(`A${note}`).font = { italic: true, size: 9 };

    return wb;
}

/** Genera e scarica l'export .xlsx. */
export async function generateExcelRiposi(pratica: PraticaRiposi, result: RestResult): Promise<void> {
    const { saveAs } = await import('file-saver');
    const buffer = await buildRiposiWorkbook(pratica, result).xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Conteggi_mancati_riposi_${pratica.cognome}_${pratica.nome}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
