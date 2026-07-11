// ==========================================
// FILE: utils/riposiRelazione.ts
// Relazione tecnica .docx VERA (libreria docx, mirror di reportGenerator.ts —
// mai HTML travestito da .doc) per l'area Turni & Riposi.
//
// buildRelazioneRiposiDoc è puro (testabile via Packer.toBuffer + unzip);
// generateRelazioneRiposi scarica il file. Import del modulo DINAMICO dal
// componente: docx resta fuori dal bundle principale.
//
// DOCUMENTO DA GIUDICE: tutti i testi di metodo/tariffa/valorizzazione/divario/
// riserve vengono dal nucleo condiviso utils/riposiDocText.ts (stessa fonte dei
// conteggi stampabili: i due documenti non possono divergere). Le due serie
// (fonte vs motore 561/2006) sono presentate AFFIANCATE e mai sommate: la
// scelta della base di quantificazione spetta all'avvocato.
// ==========================================

import {
    Document, Packer, Paragraph, Table, TableCell, TableRow,
    TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { causaleSintetica, tariffaRange, formatHm, type RestResult, type Violazione } from './restEngine';
import {
    euro, intIT, tariffaLabel, coeffSuffix, dmyhm, buildDocModel,
    quadroNormativoBullets, quadroContrattualeBullets, fonteDatiBullets, metodoFonteBullets,
    metodoMotorePassi, tariffaSpiegazione, divarioBullets, riserveBullets,
    AVVERTENZA_SERIE, DISCLAIMER, type Bullet,
} from './riposiDocText';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// ─── Mattoni docx (stesso linguaggio visivo di reportGenerator) ───────────────

const heading = (text: string): Paragraph =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun({ text, bold: true })] });

const para = (runs: (TextRun | string)[] | string, opts: { after?: number; italics?: boolean } = {}): Paragraph =>
    new Paragraph({
        spacing: { after: opts.after ?? 120 },
        children: (typeof runs === 'string' ? [runs] : runs).map((r) => (typeof r === 'string' ? new TextRun({ text: r, italics: opts.italics }) : r)),
    });

const bullet = (runs: (TextRun | string)[]): Paragraph =>
    new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs.map((r) => (typeof r === 'string' ? new TextRun(r) : r)) });

const b = (text: string) => new TextRun({ text, bold: true });

/** Punto elenco dal nucleo condiviso: lead in grassetto + testo. */
const bulletB = (bl: Bullet): Paragraph => bullet([b(bl.lead), ` — ${bl.testo}`]);

const headerCell = (text: string): TableCell =>
    new TableCell({
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEF7' },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 18 })] })],
    });

const dataCell = (text: string, opts: { right?: boolean; bold?: boolean; fill?: string } = {}): TableCell =>
    new TableCell({
        shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
        children: [new Paragraph({
            alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text: text || '—', bold: opts.bold, size: 18 })],
        })],
    });

const bordered = (rows: TableRow[]): Table =>
    new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
            left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
            right: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
        },
    });

// ─── Contenuto ────────────────────────────────────────────────────────────────

export function buildRelazioneRiposiDoc(pratica: PraticaRiposi, result: RestResult): Document {
    const model = buildDocModel(pratica, result);
    const { coeff, val, rates, fonte, violazioni, righeAnno, totViol } = model;
    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    const mostraVP = coeff !== 1; // colonna "valore pieno" solo quando c'è un coefficiente

    // Esempio didattico: la violazione con più ore mancanti (mirror della modale in-app).
    const esempio = violazioni.reduce<Violazione | null>((best, v) => (!best || v.oreMancanti > best.oreMancanti ? v : best), null);
    // Tariffa oraria PIENA dell'anno dell'esempio (il coefficiente è un fattore a parte).
    const rateEsempio = esempio ? (rates[esempio.inizio.slice(0, 4)] ?? pratica.tariffaOraria) : pratica.tariffaOraria;

    const children: (Paragraph | Table)[] = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Relazione tecnica — Mancati riposi giornalieri e settimanali', bold: true })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: `Lavoratore: ${pratica.cognome} ${pratica.nome}${pratica.azienda ? ` (${pratica.azienda})` : ''} — periodo ${pratica.periodoStart ?? '—'} / ${pratica.periodoEnd ?? '—'}`, italics: true })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [new TextRun({ text: `Generata il ${oggi}`, italics: true, color: '666666' })],
        }),

        heading('1. Dati della pratica'),
        bordered([
            new TableRow({ children: [dataCell('Lavoratore'), dataCell(`${pratica.cognome} ${pratica.nome}`, { bold: true })] }),
            new TableRow({ children: [dataCell('Mansione'), dataCell(pratica.mansione ?? '—')] }),
            ...(pratica.azienda ? [new TableRow({ children: [dataCell('Azienda'), dataCell(pratica.azienda)] })] : []),
            new TableRow({ children: [dataCell('Periodo analizzato'), dataCell(`${pratica.periodoStart ?? '—'} – ${pratica.periodoEnd ?? '—'}`)] }),
            new TableRow({ children: [dataCell('Giornate nel prospetto turni'), dataCell(intIT(pratica.giornate.length))] }),
            new TableRow({ children: [dataCell('Perimetro di calcolo (serie B)'), dataCell(model.soloCEE ? 'sole giornate in regime Reg. (CE) n. 561/2006 (marcate «CEE»)' : 'tutte le giornate del prospetto')] }),
            new TableRow({ children: [dataCell('Tariffa oraria applicata (per anno)'), dataCell(`${tariffaLabel(rates)}${tariffaRange(rates).uniform ? '' : ', cresce per anzianità di servizio'}`)] }),
            new TableRow({ children: [dataCell('Valorizzazione della serie B'), dataCell(val.riga)] }),
        ]),

        heading('2. Fonte dei dati e affidabilità'),
        ...fonteDatiBullets(model, pratica).map(bulletB),

        heading('3. Quadro normativo e contrattuale'),
        para([
            'La disciplina dei tempi di guida e di riposo del personale viaggiante su strada è dettata dal ',
            b('Reg. (CE) n. 561/2006'), ', attuato nell\'ordinamento interno dal ', b('D.Lgs. n. 234/2007'), '. In particolare:',
        ]),
        ...quadroNormativoBullets().map(bulletB),
        para([
            'Per la ', b('quantificazione economica'), ' del riposo non fruito si fa riferimento alla disciplina ',
            b('contrattuale collettiva'), ' di settore — CCNL Autoferrotranvieri e successive integrazioni (',
            b('23/07/1976'), ' artt. 6 e 15; ', b('12/03/1980'), ' art. 11; ', b('12/06/1982'), '; ',
            b('25/07/1997'), ' art. 14) — letta insieme alla ', b('L. n. 138/1958'), ' e al ', b('D.Lgs. n. 66/2003'), '. In sintesi:',
        ]),
        ...quadroContrattualeBullets().map(bulletB),

        heading('4. Criteri del documento sorgente (serie A)'),
        para('Per trasparenza del confronto si descrivono i criteri applicati dal compilatore del prospetto, come risultano dal documento stesso:'),
        ...metodoFonteBullets(model).map(bulletB),

        heading('5. Metodo di calcolo del motore (serie B)'),
        para([
            'Sui dati del prospetto il calcolo procede per i passaggi seguenti, tutti verificabili e riproducibili:',
        ]),
        ...metodoMotorePassi(model, pratica, result).map(bulletB),
        para([b('Tariffa oraria'), ` — ${tariffaSpiegazione(model, pratica)}`]),
        para(['In formula: ', b(val.formula), '. Il dettaglio per violazione è nella sezione 8, il riepilogo per anno nella sezione 6.']),

        ...(esempio ? [
            para([b('Esempio di calcolo')], { after: 60 }),
            para('A titolo illustrativo, il riposo con la maggiore riduzione rilevata nel periodo; lo stesso procedimento è applicato a ogni riposo non conforme e sommato per anno:'),
            bordered([
                new TableRow({ children: [dataCell('Riposo'), dataCell(`${esempio.tipo === 'riposo_giornaliero' ? 'Giornaliero' : 'Settimanale'} del ${new Date(esempio.inizio).toLocaleDateString('it-IT')}`, { bold: true })] }),
                new TableRow({ children: [dataCell('Soglia di legge'), dataCell(`${esempio.soglia} ore`)] }),
                new TableRow({ children: [dataCell('Riposo fruito'), dataCell(formatHm(esempio.ore))] }),
                new TableRow({ children: [dataCell('Ore mancanti'), dataCell(`${esempio.soglia} h − ${formatHm(esempio.ore)} = ${formatHm(esempio.oreMancanti)}`)] }),
                new TableRow({ children: [dataCell(`Indennità (tariffa ${esempio.inizio.slice(0, 4)})`), dataCell(`${formatHm(esempio.oreMancanti)} × ${euro(rateEsempio)}/h${coeffSuffix(coeff)} = ${euro(esempio.indennita)}`, { bold: true })] }),
            ]),
        ] : []),

        heading('6. Risultanze — le due serie a confronto'),
        para([
            'Sono disponibili due quantificazioni dello stesso pregiudizio, costruite con criteri diversi: ',
            b('non si sommano'), '.',
        ]),
        bordered([
            new TableRow({ tableHeader: true, children: [headerCell('Serie'), headerCell('Base di calcolo'), headerCell('Quantificazione')] }),
            new TableRow({
                children: [
                    dataCell('A — documento sorgente', { bold: true }),
                    dataCell(fonte.gg > 0 ? `${intIT(fonte.gg)} giornate indennizzate · ${intIT(fonte.ore)} ore · criteri del compilatore (sezione 4)` : 'serie non presente nei dati'),
                    dataCell(fonte.gg > 0 ? euro(fonte.ind) : '—', { right: true, bold: true }),
                ],
            }),
            new TableRow({
                children: [
                    dataCell('B — motore Reg. 561/2006', { bold: true }),
                    dataCell(`${intIT(totViol)} violazioni (${result.nViolazioniGiornaliere} giornaliere, ${result.nViolazioniSettimanali} settimanali) · ${intIT(result.totOreMancanti)} ore mancanti · tariffa per anno ${tariffaLabel(rates)}${coeffSuffix(coeff)}`),
                    dataCell(euro(result.totIndennita), { right: true, bold: true }),
                ],
            }),
        ]),
        para('', { after: 120 }),
        para([b('Riepilogo per anno')], { after: 60 }),
        bordered([
            new TableRow({
                tableHeader: true,
                children: [
                    headerCell('Anno'), headerCell('Tariffa €/h'), headerCell('Viol. giornaliere'), headerCell('Viol. settimanali'), headerCell('Ore mancanti'),
                    ...(mostraVP ? [headerCell('Valore pieno')] : []),
                    headerCell(mostraVP ? `Indennità (${coeffSuffix(coeff).trim()})` : '€ motore (B)'), headerCell('€ fonte (A)'),
                ],
            }),
            ...righeAnno.map((r) => new TableRow({
                children: [
                    dataCell(r.y), dataCell(rates[r.y] != null ? euro(rates[r.y]) : '—', { right: true }),
                    dataCell(String(r.g), { right: true }), dataCell(String(r.s), { right: true }),
                    dataCell(formatHm(r.oreMancanti), { right: true }),
                    ...(mostraVP ? [dataCell(euro(r.vp), { right: true })] : []),
                    dataCell(euro(r.ind), { right: true }),
                    dataCell(r.indFonte ? euro(r.indFonte) : '—', { right: true }),
                ],
            })),
            new TableRow({
                children: [
                    dataCell('Totale', { bold: true, fill: 'F2F2F2' }),
                    dataCell('—', { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(String(result.nViolazioniGiornaliere), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(String(result.nViolazioniSettimanali), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(formatHm(result.totOreMancanti), { right: true, bold: true, fill: 'F2F2F2' }),
                    ...(mostraVP ? [dataCell(euro(result.totValorePieno), { right: true, bold: true, fill: 'F2F2F2' })] : []),
                    dataCell(euro(result.totIndennita), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(fonte.ind ? euro(fonte.ind) : '—', { right: true, bold: true, fill: 'F2F2F2' }),
                ],
            }),
        ]),
        ...(mostraVP ? [para([
            b('Come si arriva al totale'),
            `: il valore pieno (ore mancanti × tariffa €/h dell'anno) ammonta a ${euro(result.totValorePieno)}; su ciascuna violazione si applica la valorizzazione (${val.riga}) e si arrotonda al centesimo, quindi si somma → indennità complessiva ${euro(result.totIndennita)}. Ogni colonna quadra per somma.`,
        ], { after: 60 })] : []),

        heading('7. Perché le due serie differiscono'),
        para('Le ragioni del divario, dichiarate e quantificate dove possibile:'),
        ...divarioBullets(model, result).map(bulletB),

        heading(`8. Elenco delle violazioni rilevate (${intIT(totViol)})`),
        para('Ogni riga è un riposo fruito in misura inferiore alle soglie del Reg. (CE) n. 561/2006 (riferimenti normativi in sezione 3).', { italics: true }),
        para(mostraVP
            ? `Per ogni violazione: ore mancanti × tariffa €/h dell'anno = valore pieno; valorizzazione (${val.riga}) = indennità.`
            : 'Per ogni violazione: ore mancanti × tariffa €/h dell\'anno = indennità.', { italics: true }),
        bordered([
            new TableRow({
                tableHeader: true,
                children: [
                    headerCell('Riposo dal'), headerCell('al'), headerCell('Tipo'), headerCell('Fruito'), headerCell('Mancante'), headerCell('Tariffa €/h'),
                    ...(mostraVP ? [headerCell('Valore pieno')] : []),
                    headerCell('Indennità'), headerCell('Gravità'), headerCell('Causale'),
                ],
            }),
            ...violazioni.map((v) => new TableRow({
                children: [
                    dataCell(dmyhm(v.inizio)), dataCell(dmyhm(v.fine)),
                    dataCell(v.tipo === 'riposo_giornaliero' ? 'Giornaliero' : 'Settimanale'),
                    dataCell(formatHm(v.ore), { right: true }), dataCell(formatHm(v.oreMancanti), { right: true }),
                    dataCell(euro(rates[v.inizio.slice(0, 4)] ?? pratica.tariffaOraria), { right: true }),
                    ...(mostraVP ? [dataCell(euro(v.valorePieno), { right: true })] : []),
                    dataCell(euro(v.indennita), { right: true }),
                    dataCell(v.gravita, { bold: v.gravita === 'grave' }),
                    dataCell(causaleSintetica(v)),
                ],
            })),
        ]),

        heading('9. Riserve e limiti'),
        ...riserveBullets(model, pratica, result).map(bulletB),
        ...(result.warnings.length
            ? [
                para([b(`Righe da verificare a mano (${result.warnings.length})`), ' — escluse dal calcolo, dichiarate per trasparenza:'], { after: 60 }),
                ...result.warnings.map((w) => bullet([w])),
            ]
            : []),

        new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: DISCLAIMER, italics: true, color: '666666' })],
        }),
    ];

    return new Document({
        creator: 'RailFlow',
        title: `Relazione mancati riposi — ${pratica.cognome} ${pratica.nome}`,
        sections: [{ children }],
    });
}

/** Genera e scarica la relazione .docx (vera: si riapre e si salva da Word). */
export async function generateRelazioneRiposi(pratica: PraticaRiposi, result: RestResult): Promise<void> {
    // Import dinamico: file-saver è CJS browser-only, così il builder resta usabile anche in node.
    const { saveAs } = await import('file-saver');
    const blob = await Packer.toBlob(buildRelazioneRiposiDoc(pratica, result));
    saveAs(blob, `Relazione_mancati_riposi_${pratica.cognome}_${pratica.nome}_${new Date().toISOString().slice(0, 10)}.docx`);
}
