// ==========================================
// FILE: utils/riposiRelazione.ts
// Relazione tecnica .docx VERA (libreria docx, mirror di reportGenerator.ts —
// mai HTML travestito da .doc) per l'area Turni & Riposi.
//
// buildRelazioneRiposiDoc è puro (testabile via Packer.toBuffer + unzip);
// generateRelazioneRiposi scarica il file. Import del modulo DINAMICO dal
// componente: docx resta fuori dal bundle principale.
//
// Le due serie (fonte vs motore 561/2006) sono presentate AFFIANCATE e mai
// sommate: la scelta della base di quantificazione spetta all'avvocato.
// ==========================================

import {
    Document, Packer, Paragraph, Table, TableCell, TableRow,
    TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import { causaleSintetica, computeSerieFonte, formatHm, type RestResult } from './restEngine';
import { groupThousandsIT } from './formatters';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

const euro = (n: number) => '€ ' + groupThousandsIT(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const intIT = (n: number) => groupThousandsIT(Math.round(n).toLocaleString('it-IT'));
const dmyhm = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

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
    const fonte = computeSerieFonte(pratica.giornate);
    const violazioni = [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio));
    const totViol = result.nViolazioniGiornaliere + result.nViolazioniSettimanali;
    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

    // Riepilogo annuale: motore + fonte affiancate.
    const perAnno: Record<string, { g: number; s: number; ore: number; ind: number; indFonte: number }> = {};
    const riga = (y: string) => (perAnno[y] ??= { g: 0, s: 0, ore: 0, ind: 0, indFonte: 0 });
    for (const v of violazioni) {
        const r = riga(v.inizio.slice(0, 4));
        if (v.tipo === 'riposo_giornaliero') r.g++; else r.s++;
        r.ore += v.oreMancanti; r.ind += v.indennita;
    }
    for (const [y, ind] of Object.entries(fonte.perAnno)) riga(y).indFonte = ind;
    const anni = Object.keys(perAnno).sort();

    const children: (Paragraph | Table)[] = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Relazione tecnica — Mancati riposi giornalieri e settimanali', bold: true })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: `Lavoratore: ${pratica.cognome} ${pratica.nome} — periodo ${pratica.periodoStart ?? '—'} / ${pratica.periodoEnd ?? '—'}`, italics: true })],
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
            new TableRow({ children: [dataCell('Tariffa oraria applicata'), dataCell(`${euro(pratica.tariffaOraria)}/h${pratica.fonteTariffa ? ` (${pratica.fonteTariffa})` : ''}`)] }),
        ]),

        heading('2. Quadro normativo'),
        para([
            'La disciplina dei tempi di guida e di riposo del personale viaggiante su strada è dettata dal ',
            b('Reg. (CE) n. 561/2006'), ', attuato nell\'ordinamento interno dal ', b('D.Lgs. n. 234/2007'), '. In particolare:',
        ]),
        bullet([b('Riposo giornaliero'), ' (art. 8 §§2,4; art. 4 lett. g): almeno ', b('11 ore consecutive'), ' nell\'arco delle 24 ore dal termine del precedente riposo; riducibile a ', b('9 ore'), ' al massimo ', b('3 volte'), ' tra due riposi settimanali.']),
        bullet([b('Riposo settimanale'), ' (art. 8 §6; art. 4 lett. h): almeno ', b('45 ore consecutive'), '; riducibile a ', b('24 ore'), ' solo in alternanza con un riposo regolare (mai due ridotti consecutivi).']),
        bullet([b('Gravità'), ': la riduzione superiore al 10% della soglia è classificata «grave» secondo i criteri del ', b('Reg. (UE) 2016/403'), '; è un criterio di classificazione, non il presupposto dell\'illecito.']),

        heading('3. Metodo'),
        para([
            'Le giornate di servizio sono state estratte dal documento sorgente («Mancati riposi») con un ',
            b('parser deterministico'), ' — nessuna interpretazione AI/OCR — i cui totali ', b('quadrano al centesimo'),
            ' con quelli stampati nel documento stesso.',
        ]),
        para([
            'Su tali giornate un motore di calcolo deterministico ricostruisce i riposi effettivamente fruiti tra turni consecutivi (dai soli orari di inizio e termine) e li classifica secondo le soglie normative. ',
            'I riposi giornalieri ridotti leciti (', b(intIT(result.nRidottiGiornalieriLeciti)), ' nel periodo) non sono conteggiati come violazioni. ',
            'Le righe non interpretabili o anomale sono segnalate, mai stimate.',
        ]),

        heading('4. Risultanze — le due serie a confronto'),
        para([
            'Sono disponibili due quantificazioni dello stesso pregiudizio, costruite con criteri diversi: ',
            b('non si sommano'), '.',
        ]),
        bordered([
            new TableRow({ tableHeader: true, children: [headerCell('Serie'), headerCell('Base di calcolo'), headerCell('Quantificazione')] }),
            new TableRow({
                children: [
                    dataCell('A — documento sorgente', { bold: true }),
                    dataCell(fonte.gg > 0 ? `${intIT(fonte.gg)} giornate indennizzate · ${intIT(fonte.ore)} ore · criteri di chi ha prodotto il documento` : 'serie non presente nei dati'),
                    dataCell(fonte.gg > 0 ? euro(fonte.ind) : '—', { right: true, bold: true }),
                ],
            }),
            new TableRow({
                children: [
                    dataCell('B — motore Reg. 561/2006', { bold: true }),
                    dataCell(`${intIT(totViol)} violazioni (${result.nViolazioniGiornaliere} giornaliere, ${result.nViolazioniSettimanali} settimanali) · ${intIT(result.totOreMancanti)} ore mancanti · ${euro(pratica.tariffaOraria)}/h`),
                    dataCell(euro(result.totIndennita), { right: true, bold: true }),
                ],
            }),
        ]),
        para('', { after: 120 }),
        para([b('Riepilogo per anno')], { after: 60 }),
        bordered([
            new TableRow({
                tableHeader: true,
                children: [headerCell('Anno'), headerCell('Viol. giornaliere'), headerCell('Viol. settimanali'), headerCell('Ore mancanti'), headerCell('€ motore (B)'), headerCell('€ fonte (A)')],
            }),
            ...anni.map((y) => {
                const r = perAnno[y];
                return new TableRow({
                    children: [
                        dataCell(y), dataCell(String(r.g), { right: true }), dataCell(String(r.s), { right: true }),
                        dataCell(formatHm(r.ore), { right: true }), dataCell(euro(r.ind), { right: true }),
                        dataCell(r.indFonte ? euro(r.indFonte) : '—', { right: true }),
                    ],
                });
            }),
            new TableRow({
                children: [
                    dataCell('Totale', { bold: true, fill: 'F2F2F2' }),
                    dataCell(String(result.nViolazioniGiornaliere), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(String(result.nViolazioniSettimanali), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(formatHm(result.totOreMancanti), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(euro(result.totIndennita), { right: true, bold: true, fill: 'F2F2F2' }),
                    dataCell(fonte.ind ? euro(fonte.ind) : '—', { right: true, bold: true, fill: 'F2F2F2' }),
                ],
            }),
        ]),

        heading(`5. Elenco delle violazioni rilevate (${intIT(totViol)})`),
        para('Ogni riga è un riposo fruito in misura inferiore alle soglie del Reg. (CE) n. 561/2006 (riferimenti normativi in sezione 2).', { italics: true }),
        bordered([
            new TableRow({
                tableHeader: true,
                children: [headerCell('Riposo dal'), headerCell('al'), headerCell('Tipo'), headerCell('Fruito'), headerCell('Mancante'), headerCell('Indennità'), headerCell('Gravità'), headerCell('Causale')],
            }),
            ...violazioni.map((v) => new TableRow({
                children: [
                    dataCell(dmyhm(v.inizio)), dataCell(dmyhm(v.fine)),
                    dataCell(v.tipo === 'riposo_giornaliero' ? 'Giornaliero' : 'Settimanale'),
                    dataCell(formatHm(v.ore), { right: true }), dataCell(formatHm(v.oreMancanti), { right: true }),
                    dataCell(euro(v.indennita), { right: true }),
                    dataCell(v.gravita, { bold: v.gravita === 'grave' }),
                    dataCell(causaleSintetica(v)),
                ],
            })),
        ]),

        heading('6. Riserve e limiti'),
        bullet([b('Tariffa oraria'), `: il valore applicato (${euro(pratica.tariffaOraria)}/h) è ${pratica.fonteTariffa ?? 'da confermare'}; la quantificazione della serie B si ricalcola automaticamente alla conferma della tariffa e della sua fonte contrattuale.`]),
        bullet([b('Pausa di guida (art. 7)'), ': richiede i dati del cronotachigrafo, non presenti nel prospetto turni; è esclusa dal perimetro di questa relazione.']),
        bullet([b('Codici di servizio'), ': i codici di linea/turno non sono decodificabili senza la legenda aziendale.']),
        bullet([b('Cumulo delle serie'), ': le serie A e B quantificano i medesimi riposi non fruiti; la scelta della base di quantificazione — e la verifica che le indennità della serie A non risultino già corrisposte in busta paga — spettano al legale incaricato.']),
        ...(result.warnings.length
            ? [
                para([b(`Righe da verificare a mano (${result.warnings.length})`), ' — escluse dal calcolo, segnalate per trasparenza:'], { after: 60 }),
                ...result.warnings.map((w) => bullet([w])),
            ]
            : []),

        new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: 'La presente è un\'elaborazione tecnica di supporto: ogni valutazione sull\'azionabilità delle pretese spetta al professionista legale incaricato.', italics: true, color: '666666' })],
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
