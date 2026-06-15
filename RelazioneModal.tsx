import { useState } from 'react';
import { X, Printer, Copy, CheckCircle, PenTool, FileText, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType } from 'docx';
import { motion } from 'framer-motion';
import { YEARS, MONTH_NAMES, AnnoDati, getColumnsByProfile, getFixedColumnsByProfile, resolveIncludePaidLeave } from './types';
import { parseLocalFloat, getProfiloBadgeLabel, formatDay } from './utils/formatters';
import { EXCLUDED_INDEMNITY_COLS, computeHolidayIndemnity, computePeriodIncidence } from './utils/calculationEngine';
import { useIsReadOnly } from './lib/readonly';

// --- HELPER DI FORMATTAZIONE SICURA ---
const fmt = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- HELPER CENTRALIZZATI PER SINCRONIA UI/WORD ---
const generaVociRaggruppate = (worker: any) => {
    const cols = getColumnsByProfile(worker?.profilo, worker?.eliorType)
        .filter((c: any) => !EXCLUDED_INDEMNITY_COLS.includes(c.id));

    const testo = cols.map((c: any) => `- (${c.id}) ${c.label}`).join('\n');
    const html = cols.map((c: any) => `<li>(${c.id}) ${c.label}</li>`).join('\n                ');

    return { testo, html };
};

// Voci FISSE continuative ("Quadro B") — il denominatore delle percentuali di incidenza.
// Data-driven: una voce viene elencata SOLO se compare con valore > 0 in almeno un mese,
// così non si attribuiscono al lavoratore voci che non ha (es. ERI/EDR assenti su alcune
// pratiche). Mai stampare l'intero set teorico a tappeto.
const generaVociFisseRaggruppate = (worker: any) => {
    const cols = getFixedColumnsByProfile(worker?.profilo) || [];
    const anni = Array.isArray(worker?.anni) ? worker.anni : [];
    const presenti = cols.filter((c: any) =>
        anni.some((m: any) => parseLocalFloat(m?.[c.id]) > 0)
    );
    const testo = presenti.map((c: any) => `- (${c.id}) ${c.label}`).join('\n');
    return { testo, presenti };
};

const generaEsempioDinamico = (worker: any, startClaimYear: number, tettoGiorni: number) => {
    let testo = "A titolo di esempio, illustriamo il calcolo generico utilizzato: sommiamo le voci variabili dell'anno precedente, dividiamo per i giorni lavorati ottenendo la media giornaliera, e la moltiplichiamo per i giorni di ferie goduti.";
    let html = "<p>A titolo di esempio, illustriamo il calcolo generico utilizzato:</p><ul><li><b>Passo A:</b> Sommiamo tutto il valore delle voci variabili percepite nell'anno di riferimento (N-1).</li><li><b>Passo B:</b> Dividiamo questa somma per i giorni effettivi di lavoro svolti in quell'anno (Media).</li><li><b>Passo C:</b> Moltiplichiamo la Media per i giorni di ferie goduti.</li></ul>";

    if (worker?.anni && Array.isArray(worker.anni)) {
        const validCodes = getColumnsByProfile(worker.profilo, worker.eliorType)
            .map((c: any) => c.id)
            .filter((id: string) => !['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(id));

        // Raccoglie tutti gli anni candidati (ordinati ASC) con i dati già calcolati
        const tuttiGliAnni: number[] = Array.from(new Set(worker.anni.map((m: any) => Number(m.year)))).sort((a: number, b: number) => a - b) as number[];

        type Candidato = { annoCorrente: number; annoPrec: number; totVariabiliPrec: number; ggLavPrec: number; ferieUsate: number; lordoEsempio: number; mediaGiornaliera: number };
        const candidati: Candidato[] = [];

        for (const annoCorrente of tuttiGliAnni) {
            if (annoCorrente <= startClaimYear) continue;

            const datiAnnoCorrente = worker.anni.filter((a: any) => Number(a.year) === annoCorrente);
            const totFerieCorrente = datiAnnoCorrente.reduce((s: number, mm: any) => s + (Number(mm.daysVacation) || 0), 0);
            if (totFerieCorrente === 0) continue;

            const annoPrec = annoCorrente - 1;
            const datiAnnoPrec = worker.anni.filter((a: any) => Number(a.year) === annoPrec);
            let totVariabiliPrec = 0;
            let ggLavPrec = 0;

            datiAnnoPrec.forEach((mm: any) => {
                const ggLavMese = parseLocalFloat(mm.daysWorked);
                if (ggLavMese > 0) ggLavPrec += ggLavMese;
                validCodes.forEach((cod: string) => {
                    const rawVal = mm[cod];
                    if (rawVal) {
                        const parsed = parseLocalFloat(rawVal);
                        if (!isNaN(parsed) && parsed !== 0) totVariabiliPrec += parsed;
                    }
                });
            });

            if (ggLavPrec > 0 && totVariabiliPrec > 0) {
                const mediaGiornaliera = totVariabiliPrec / ggLavPrec;
                const ferieUsate = Math.min(totFerieCorrente, tettoGiorni);
                candidati.push({ annoCorrente, annoPrec, totVariabiliPrec, ggLavPrec, ferieUsate, lordoEsempio: mediaGiornaliera * ferieUsate, mediaGiornaliera });
            }
        }

        // Sceglie l'anno centrale del periodo — così ogni lavoratore ha un esempio diverso
        if (candidati.length > 0) {
            const { annoCorrente, annoPrec, totVariabiliPrec, ggLavPrec, ferieUsate, lordoEsempio, mediaGiornaliera } = candidati[Math.floor(candidati.length / 2)];

            testo = `A titolo illustrativo, riportiamo il calcolo matematico applicato esattamente per l'anno ${annoCorrente} dei conteggi allegati:\n- Passo A (Totale Voci): Nell'anno di riferimento (${annoPrec}), il lavoratore ha percepito indennità variabili ricorrenti per un totale di € ${fmt(totVariabiliPrec)}.\n- Passo B (Media Giornaliera): Dividendo tale somma per i giorni effettivamente lavorati nel ${annoPrec} (${formatDay(ggLavPrec)} gg), si ottiene una media giornaliera pari a € ${fmt(mediaGiornaliera)}.\n- Passo C (Moltiplicazione): Nell'anno ${annoCorrente}, il lavoratore ha fruito di ${formatDay(ferieUsate)} giorni di ferie validi ai fini del calcolo (entro il tetto legale applicato). Moltiplicando la media di € ${fmt(mediaGiornaliera)} per i ${formatDay(ferieUsate)} giorni, si certifica una differenza lorda maturata pari a € ${fmt(lordoEsempio)} per quel singolo anno.`;

            html = `
                <p>A titolo illustrativo, riportiamo il calcolo matematico applicato esattamente per l'anno <b>${annoCorrente}</b> dei conteggi allegati:</p>
                <ul>
                    <li><b>Passo A (Totale Voci):</b> Nell'anno di riferimento (<b>${annoPrec}</b>), il lavoratore ha percepito indennità variabili ricorrenti per un totale di <b>€ ${fmt(totVariabiliPrec)}</b>.</li>
                    <li><b>Passo B (Media Giornaliera):</b> Dividendo tale somma per i giorni effettivamente lavorati nel ${annoPrec} (<b>${formatDay(ggLavPrec)} gg</b>), si ottiene una media giornaliera pari a <b>€ ${fmt(mediaGiornaliera)}</b>.</li>
                    <li><b>Passo C (Moltiplicazione):</b> Nell'anno <b>${annoCorrente}</b>, il lavoratore ha fruito di <b>${formatDay(ferieUsate)}</b> giorni di ferie validi ai fini del calcolo (entro il tetto legale applicato). Moltiplicando la media di € ${fmt(mediaGiornaliera)} per i ${formatDay(ferieUsate)} giorni, si certifica una differenza lorda maturata pari a <b>€ ${fmt(lordoEsempio)}</b> per quel singolo anno.</li>
                </ul>`;
        }
    }
    return { testo, html };
};

const generaSpiegazioneRisultato = (includeTickets: boolean, showPercepito: boolean) => {
    let testo = "";
    let html = "";
    
    if (!showPercepito && !includeTickets) {
        testo = "Applicando la formula mese per mese, abbiamo calcolato la differenza retributiva lorda maturata dal lavoratore.\n\nPoiché non vi sono indennità già erogate da dedurre, né buoni pasto da integrare, il totale richiesto corrisponde interamente ed esclusivamente al LORDO maturato e non corrisposto dall'Azienda.";
        html = "<p>Poiché non vi sono indennità già erogate dall'azienda da dedurre, né buoni pasto da integrare, il totale richiesto corrisponde interamente ed esclusivamente al <b>LORDO maturato e non corrisposto</b>.</p>";
    } else {
        testo = "Applicando la formula mese per mese, abbiamo ricavato il Lordo totale maturato. \n";
        html = "<ul>";
        
        if (showPercepito) {
            testo += "Da questa cifra abbiamo sottratto con precisione quanto l'azienda aveva già versato a titolo di 'indennità feriale' base, in modo da evitare qualsiasi duplicazione (voce 'Già Percepito').\n";
            html += "<li>Dal lordo totale maturato, abbiamo sottratto con precisione matematica quanto l'azienda aveva già versato a titolo di 'indennità feriale' base (voce 'Già Percepito'), evitando così qualsiasi duplicazione di calcolo.</li>";
        }
        if (includeTickets) {
            testo += "Infine, abbiamo aggiunto il valore economico dei Buoni Pasto (Ticket) non consegnati durante i giorni di ferie fruite.\n";
            html += "<li>Infine, abbiamo sommato il valore economico dei Buoni Pasto (Ticket Restaurant) maturati ma non consegnati per le giornate di ferie godute.</li>";
        }
        
        testo += "\nIl risultato finale rappresenta l'esatto credito NETTO da liquidare a favore del lavoratore.";
        html += "</ul><p>Il risultato finale espone pertanto l'esatto credito <b>NETTO da liquidare</b>.</p>";
    }
    return { testo, html };
};
// --- FINE HELPER CENTRALIZZATI ---

const generaRelazioneTestuale = (worker: any, totali: any, includeExFest: boolean, includeTickets: boolean, startClaimYear: number, showPercepito: boolean) => {
    const tettoGiorni = includeExFest ? 32 : 28;

    // --- PROTEZIONE DATI ---
    const gt = totali?.grandTotal || totali || {};
    const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
    const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
    const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;
    const nettoVal = (Number(lordoVal) - (showPercepito ? Number(percepitoVal) : 0)) + (includeTickets ? Number(ticketVal) : 0);

    // --- GESTIONE ANNI ALLINEATA AL "CERVELLO" ---
    let anniAttivi = (worker?.anni || [])
        .filter((a: AnnoDati) => Number(a.daysWorked) > 0 && Number(a.year) >= startClaimYear) // Filtro rigoroso!
        .map((a: AnnoDati) => Number(a.year))
        .sort((a: number, b: number) => a - b);

    anniAttivi = [...new Set(anniAttivi)];
    if (anniAttivi.length === 0) anniAttivi = [startClaimYear, new Date().getFullYear()];

    const inizioPeriodo = startClaimYear; // Ora comanda l'interfaccia, non si tira più a indovinare!
    const finePeriodo = anniAttivi[anniAttivi.length - 1];

    // Utilizzo helpers centralizzati
    const voci = generaVociRaggruppate(worker);
    const esempio = generaEsempioDinamico(worker, startClaimYear, tettoGiorni);
    const spiegazione = generaSpiegazioneRisultato(includeTickets, showPercepito);

    return `
RELAZIONE TECNICA - SINTESI E METODOLOGIA
Pratica di: ${worker?.cognome || ''} ${worker?.nome || ''}
Profilo contrattuale: ${getProfiloBadgeLabel(worker?.profilo, worker?.eliorType) || 'ND'}
Periodo esaminato: Dal ${inizioPeriodo} al ${finePeriodo}

--------------------------------------------------

1. LA PREMESSA
Il "diritto alle ferie annuali retribuite", oggetto del ricorso a cui la presente è allegata, viene posto a tutela della salute e della sicurezza del lavoratore, motivo per il quale si inserisce tra i principi cardine del diritto comunitario, ai quali non si può derogare. Il mantenimento della retribuzione durante il periodo feriale, pertanto, persegue il precipuo scopo di evitare l'insorgere di qualsiasi fattore che possa "dissuadere", anche solo a livello potenziale ovvero condizionare in termini negativi il godimento delle ferie e, dunque, costituisce un elemento che garantisce l'effettività dell'esercizio del diritto stesso.
La retribuzione feriale spettante al lavoratore può, pertanto, determinarsi effettuando una media della retribuzione percepita durante un periodo di lavoro effettivo all'uopo giudicato rappresentativo; il diritto interno di ogni Stato europeo non può, dunque, prevedere norme o ammettere prassi che condizionino, in termini negativi, il diritto alle ferie retribuite o che dissuadano il lavoratore dall'esercitare tale diritto.

2. LE VOCI ANALIZZATE (Rif. Allegato "Tabella 2 - Riepilogo Voci Variabili")
Per quantificare il credito, sono stati esaminati i cedolini paga forniti. Come dettagliato nella "Tabella 2" dei conteggi, sono state isolate esclusivamente le "voci ricorrenti e continuative, aventi natura specificatamente retributiva", escludendo tassativamente rimborsi spese, ticket mensa, elargizioni una tantum o arretrati non pertinenti.
Nello specifico del profilo lavorativo in questione, abbiamo tenuto conto di:
${voci.testo}

3. IL METODO DI CALCOLO (Rif. Allegato "Tabella 1 - Calcolo Differenze per Anno")
Per garantire una precisione matematica inattaccabile, l'algoritmo utilizza il "Criterio della Media Storica".
${esempio.testo}

4. L'APPLICAZIONE MENSILE (Rif. Allegato "Tabella 3 - Dettaglio Mensile Analitico")
Come dimostrato analiticamente nella "Tabella 3", abbiamo applicato il calcolo per ogni singolo mese in cui il lavoratore ha goduto delle ferie.
${spiegazione.testo}

5. CONCLUSIONI (Rif. Allegato "Prospetto Ufficiale di Ricalcolo / Riepilogo Somme Richieste")
I risultati di tutte le tabelle analitiche di cui sopra confluiscono nel documento riassuntivo finale (il Prospetto Ufficiale), che certifica gli importi esatti qui sotto riportati.

--------------------------------------------------
RIEPILOGO FINALE DEGLI IMPORTI
+ DIFFERENZE LORDE MATURATE: .......... € ${fmt(lordoVal)}
${showPercepito ? `- IMPORTO GIÀ PERCEPITO IN BUSTA: ..... € ${fmt(percepitoVal)}\n` : ''}${includeTickets ? `+ CREDITO BUONI PASTO NON EROGATI: .... € ${fmt(ticketVal)}\n` : ''}==================================================
TOTALE CREDITO ${(!showPercepito && !includeTickets) ? 'LORDO' : 'NETTO'} SPETTANTE: ..... € ${fmt(nettoVal)}
==================================================
`;
};

// ... Il resto del componente (RelazioneModal) rimane identico ...
// ... Copia tutto il resto dal tuo codice originale (handleStampa, JSX return, etc.) ...

// Costruisce un VERO .docx (editabile/salvabile in Word) della relazione tecnica.
// Estratto da handleExportWord per essere riusato sia dalla modale sia dall'export
// batch dei Conclusi. Restituisce il Blob; il chiamante decide se salvarlo o zipparlo.
export interface RelazioneDocxParams {
    worker: any;
    totals: any;
    includeExFest?: boolean;
    includeTickets?: boolean;
    showPercepito?: boolean;
    startClaimYear?: number;
}

export async function buildRelazioneDocxBlob({
    worker,
    totals,
    includeExFest = false,
    includeTickets = false,
    showPercepito = false,
    startClaimYear = 2008,
}: RelazioneDocxParams): Promise<Blob> {
    // --- 1. Ricalcolo Variabili ---
    const tettoGiorni = includeExFest ? 32 : 28;
    const gt = totals?.grandTotal || totals || {};
    const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
    const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
    const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;
    const nettoVal = (Number(lordoVal) - (showPercepito ? Number(percepitoVal) : 0)) + (includeTickets ? Number(ticketVal) : 0);

    let anniAttivi = (worker?.anni || [])
        .filter((a: AnnoDati) => Number(a.daysWorked) > 0 && Number(a.year) >= startClaimYear)
        .map((a: AnnoDati) => Number(a.year))
        .sort((a: number, b: number) => a - b);
    anniAttivi = [...new Set(anniAttivi)];
    if (anniAttivi.length === 0) anniAttivi = [startClaimYear, new Date().getFullYear()];
    const inizioPeriodo = startClaimYear;
    const finePeriodo = anniAttivi[anniAttivi.length - 1];

    const voci = generaVociRaggruppate(worker);
    const esempio = generaEsempioDinamico(worker, startClaimYear, tettoGiorni);
    const spiegazione = generaSpiegazioneRisultato(includeTickets, showPercepito);

    // --- 2. Helper docx locali (look "atto": Times New Roman, titoli con filetto) ---
    const para = (text: string) => new Paragraph({
        alignment: AlignmentType.JUSTIFIED, spacing: { after: 140 },
        children: [new TextRun({ text })],
    });
    const bullet = (text: string) => new Paragraph({
        bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 },
        children: [new TextRun({ text })],
    });
    const sezTitle = (text: string) => new Paragraph({
        spacing: { before: 360, after: 160, line: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 3 } },
        children: [new TextRun({ text, bold: true, size: 24 })],
    });
    const fromTesto = (testo: string): Paragraph[] => testo
        .split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => l.startsWith('-') ? bullet(l.replace(/^-\s*/, '')) : para(l));

    // Tabella info (Pratica / Periodo): bordo leggero
    const infoBorders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
    };
    const infoRow = (label: string, value: string) => new TableRow({ children: [
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 140, right: 100 }, children: [new Paragraph({ spacing: { line: 240 }, children: [new TextRun({ text: label, bold: true })] })] }),
        new TableCell({ margins: { top: 60, bottom: 60, left: 100, right: 140 }, children: [new Paragraph({ spacing: { line: 240 }, children: [new TextRun({ text: value })] })] }),
    ] });

    // Specchietto riepilogo: centrato, bordo esterno spesso, valori grandi in grassetto,
    // riga totale evidenziata in grigio con filetto superiore marcato.
    const summaryBorders = {
        top: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };
    const moneyRow = (label: string, value: string, isTotal = false) => new TableRow({ children: [
        new TableCell({
            margins: { top: 120, bottom: 120, left: 200, right: 120 },
            shading: isTotal ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
            borders: isTotal ? { top: { style: BorderStyle.SINGLE, size: 18, color: '000000' } } : undefined,
            children: [new Paragraph({ spacing: { line: 240 }, children: [new TextRun({ text: label, bold: true, size: isTotal ? 28 : 24 })] })],
        }),
        new TableCell({
            margins: { top: 120, bottom: 120, left: 120, right: 200 },
            shading: isTotal ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
            borders: isTotal ? { top: { style: BorderStyle.SINGLE, size: 18, color: '000000' } } : undefined,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { line: 240 }, children: [new TextRun({ text: `€ ${value}`, bold: true, size: isTotal ? 28 : 26 })] })],
        }),
    ] });

    // --- 3. Contenuto del documento ---
    const children: (Paragraph | Table)[] = [];
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80, line: 240 }, children: [new TextRun({ text: `RELAZIONE TECNICA DESCRITTIVA — SINTESI E METODOLOGIA`, bold: true, size: 30 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360, line: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 } }, children: [new TextRun({ text: `CONTRATTO DI RIFERIMENTO: ${getProfiloBadgeLabel(worker?.profilo, worker?.eliorType) || 'ND'}`, bold: true, size: 24 })] }));

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: infoBorders, rows: [
        infoRow(`Pratica di:`, `${worker?.cognome || ''} ${worker?.nome || ''}`.trim()),
        infoRow(`Periodo Esaminato:`, `Dal ${inizioPeriodo} al ${finePeriodo}`),
    ] }));

    children.push(sezTitle(`1. LA PREMESSA`));
    children.push(para(`Il "diritto alle ferie annuali retribuite", oggetto del ricorso a cui la presente è allegata, viene posto a tutela della salute e della sicurezza del lavoratore, motivo per il quale si inserisce tra i principi cardine del diritto comunitario, ai quali non si può derogare. Il mantenimento della retribuzione durante il periodo feriale, pertanto, persegue il precipuo scopo di evitare l'insorgere di qualsiasi fattore che possa "dissuadere", anche solo a livello potenziale ovvero condizionare in termini negativi il godimento delle ferie e, dunque, costituisce un elemento che garantisce l'effettività dell'esercizio del diritto stesso.`));
    children.push(para(`La retribuzione feriale spettante al lavoratore può, pertanto, determinarsi effettuando una media della retribuzione percepita durante un periodo di lavoro effettivo all'uopo giudicato rappresentativo; il diritto interno di ogni Stato europeo non può, dunque, prevedere norme o ammettere prassi che condizionino, in termini negativi, il diritto alle ferie retribuite o che dissuadano il lavoratore dall'esercitare tale diritto.`));

    children.push(sezTitle(`2. LE VOCI ANALIZZATE (Rif. Allegato "Tabella 2 - Riepilogo Voci Variabili")`));
    children.push(para(`Per quantificare il credito, sono stati esaminati i cedolini paga forniti. Come dettagliato nella "Tabella 2" dei conteggi, sono state isolate esclusivamente le "voci ricorrenti e continuative, aventi natura specificatamente retributiva", escludendo tassativamente rimborsi spese, ticket mensa, elargizioni una tantum o arretrati non pertinenti.`));
    children.push(para(`Nello specifico del profilo lavorativo, sono state computate le seguenti indennità:`));
    voci.testo.split('\n').map((l: string) => l.trim()).filter(Boolean).forEach((l: string) => children.push(bullet(l.replace(/^-\s*/, ''))));

    children.push(sezTitle(`3. IL METODO DI CALCOLO (Rif. Allegato "Tabella 1 - Calcolo Differenze")`));
    children.push(para(`A garanzia di inattaccabilità contabile, il sistema ha applicato il "Criterio della Media Storica" (Rif. Cass. 20216/2022). Il valore di una giornata feriale è stato calcolato estraendo la media matematica dell'anno solare precedente.`));
    fromTesto(esempio.testo).forEach((p: Paragraph) => children.push(p));

    // 2026-06-15 — su indicazione dell'avvocato (revisione relazione Micaletti): il paragrafo
    // "Trattamento delle assenze retribuite" NON va più esplicitato in relazione. La scelta sul
    // divisore (Strategia A/B, resolveIncludePaidLeave) resta nel CALCOLO; semplicemente non se
    // ne descrive il metodo nel documento.

    children.push(sezTitle(`4. L'APPLICAZIONE MENSILE (Rif. Allegato "Tabella 3 - Dettaglio Analitico")`));
    children.push(para(`Come documentato analiticamente nella "Tabella 3", il procedimento è stato reiterato per ogni singolo mese in cui il dipendente ha fruito di ferie.`));
    fromTesto(spiegazione.testo).forEach((p: Paragraph) => children.push(p));

    // --- Sezione incidenza % (solo profili con voci fisse definite, es. RFI/Trenitalia) ---
    const yearResultsRel = computeHolidayIndemnity({
        data: worker?.anni || [],
        profilo: worker?.profilo,
        eliorType: worker?.eliorType,
        includeExFest, includeTickets, startClaimYear,
        includePaidLeave: resolveIncludePaidLeave(worker),
        years: anniAttivi,
    });
    // Solo anni con base fissa reale (sumQuadroFisse>0): i non-backfillati (base 0 → 100%
    // variabili) renderebbero l'esempio assurdo ("a fronte di € 0,00 fissi") e gonfierebbero la media.
    const periodInc = computePeriodIncidence(yearResultsRel.filter((r: any) => !r.isReferenceYear && r.sumQuadroFisse > 0));
    if (yearResultsRel.some((r: any) => r.hasIncidence && r.sumQuadroFisse > 0) && periodInc.anni > 0) {
        const pct = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // Anno esemplificativo: quello a credito CON base fissa e con più voci variabili.
        const esempioAnno = yearResultsRel
            .filter((r: any) => r.hasIncidence && !r.isReferenceYear && r.sumQuadroFisse > 0)
            .sort((a: any, b: any) => b.sumIndennitaTotali - a.sumIndennitaTotali)[0];

        children.push(sezTitle(`5. L'INCIDENZA PERCENTUALE DELLE VOCI VARIABILI (Rif. Allegati "Tabella 4 - Riepilogo Voci Fisse" e "Tabella 5 - Incidenza %")`));
        children.push(para(`Per rendere evidente il peso economico delle voci escluse durante le ferie, è stata calcolata la loro "incidenza percentuale" sulla retribuzione continuativa. Per ciascun mese si rapportano le voci VARIABILI (percepite solo in giornata di lavoro) al totale delle voci continuative, ossia alla somma tra Voci Fisse e Voci Variabili. La percentuale di ciascun anno è la media delle dodici incidenze mensili.`));
        children.push(para(`Le voci fisse e continuative considerate come base (quali il minimo contrattuale, il superminimo, il salario professionale, gli scatti di anzianità ed ulteriori elementi retributivi fissi e continuativi) sono riportate, voce per voce e anno per anno, nella "Tabella 4 - Riepilogo Voci Fisse"; le percentuali che ne derivano sono esposte nella "Tabella 5 - Incidenza %". In tal modo ogni valore percentuale è verificabile a partire dai dati di dettaglio.`));
        const vociFisse = generaVociFisseRaggruppate(worker);
        if (vociFisse.presenti.length > 0) {
            children.push(para(`Nel caso di specie, le voci fisse e continuative effettivamente rilevate sui cedolini del lavoratore — poste a denominatore del calcolo di incidenza — sono le seguenti:`));
            vociFisse.testo.split('\n').map((l: string) => l.trim()).filter(Boolean)
                .forEach((l: string) => children.push(bullet(l.replace(/^-\s*/, ''))));
        }
        if (esempioAnno) {
            const mesiEs: any[] = Array.isArray(esempioAnno.monthlyDetails) ? esempioAnno.monthlyDetails : [];
            // Mese rappresentativo: quello con più voci variabili tra i mesi con incidenza > 0.
            const meseEs = mesiEs
                .filter((m: any) => m.pctVariabile > 0 && (m.quadroFisse + m.quadroVariabili) > 0)
                .sort((a: any, b: any) => b.quadroVariabili - a.quadroVariabili)[0];

            children.push(para(`Il calcolo si articola in due passaggi. In primo luogo, per ciascun mese si determina l'incidenza come rapporto percentuale tra le voci variabili e il totale delle voci continuative, secondo la formula: incidenza mensile = (Voci Variabili × 100) ÷ (Voci Fisse + Voci Variabili). In secondo luogo, l'incidenza dell'anno è data dalla media aritmetica delle dodici incidenze mensili così ottenute.`));

            if (meseEs) {
                const nomeMese = meseEs.name.charAt(0) + meseEs.name.slice(1).toLowerCase();
                children.push(para(`A titolo esemplificativo, nel mese di ${nomeMese} ${esempioAnno.year} il lavoratore ha percepito voci variabili per € ${fmt(meseEs.quadroVariabili)} a fronte di voci fisse continuative per € ${fmt(meseEs.quadroFisse)}; l'incidenza di quel mese è dunque pari a (€ ${fmt(meseEs.quadroVariabili)} × 100) ÷ (€ ${fmt(meseEs.quadroFisse)} + € ${fmt(meseEs.quadroVariabili)}) = ${pct(meseEs.pctVariabile)}%.`));
            }

            // Stessa operazione, mostrata anche per la media ANNUA: elenco delle incidenze
            // mensili + somma ÷ 12 (il metodo divide sempre per 12, anche negli anni parziali).
            const mesiOrdinati = [...mesiEs].sort((a: any, b: any) =>
                MONTH_NAMES.indexOf(String(a.name).toUpperCase()) - MONTH_NAMES.indexOf(String(b.name).toUpperCase()));
            const sommaMensili = mesiOrdinati.reduce((s: number, m: any) => s + (m.pctVariabile || 0), 0);
            const elencoMesi = mesiOrdinati
                .map((m: any) => `${m.name.charAt(0)}${m.name.slice(1).toLowerCase()} ${pct(m.pctVariabile)}%`)
                .join('; ');
            children.push(para(`Ripetendo l'operazione per ogni mese del ${esempioAnno.year} si ottengono le incidenze mensili (${elencoMesi}). La loro somma è pari a ${pct(sommaMensili)} e, divisa per dodici (i mesi dell'anno), restituisce l'incidenza media annua: ${pct(sommaMensili)} ÷ 12 = ${pct(esempioAnno.pctVariabileMediaAnnua)}% (nell'anno: voci variabili complessive € ${fmt(esempioAnno.sumIndennitaTotali)}, retribuzione fissa continuativa € ${fmt(esempioAnno.sumQuadroFisse)}).`));
        }
        // Stessa operazione anche a livello di PERIODO: somma delle incidenze annue ÷ n. anni.
        const anniInc = yearResultsRel.filter((r: any) => !r.isReferenceYear && r.sumQuadroFisse > 0 && r.hasIncidence);
        const sommaAnnue = anniInc.reduce((s: number, r: any) => s + (r.pctVariabileMediaAnnua || 0), 0);
        children.push(para(`Estendendo l'analisi all'intero periodo oggetto di domanda (${anniAttivi[0]} - ${finePeriodo}), l'incidenza media è la media delle incidenze annue, riportate anno per anno nella "Tabella 5 - Incidenza %". Per i ${periodInc.anni} anni a credito la loro somma è pari a ${pct(sommaAnnue)}, che divisa per ${periodInc.anni} restituisce ${pct(sommaAnnue)} ÷ ${periodInc.anni} = ${pct(periodInc.pctVariabile)}%: tale quota della retribuzione, di natura ricorrente e continuativa, non è stata corrisposta al lavoratore durante i giorni di ferie, in violazione dei principi richiamati in premessa.`));

        children.push(sezTitle(`6. CONCLUSIONI (Rif. Allegato "Prospetto Ufficiale di Ricalcolo")`));
    } else {
        children.push(sezTitle(`5. CONCLUSIONI (Rif. Allegato "Prospetto Ufficiale di Ricalcolo")`));
    }
    children.push(para(`Le risultanze delle elaborazioni analitiche di cui sopra convergono nel documento conclusivo denominato "Riepilogo Somme Richieste", che certifica senza ombra di dubbio gli importi esatti riportati nello specchietto sottostante.`));

    children.push(new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 280, line: 240 }, children: [new TextRun({ text: `RIEPILOGO DEGLI IMPORTI`, bold: true, size: 28 })] }));

    const totalLabel = `TOTALE CREDITO ${(!showPercepito && !includeTickets) ? 'LORDO' : 'NETTO'} SPETTANTE:`;
    const summaryRows: TableRow[] = [ moneyRow(`+ DIFFERENZE LORDE MATURATE:`, fmt(lordoVal)) ];
    if (showPercepito) summaryRows.push(moneyRow(`- IMPORTO GIÀ PERCEPITO IN BUSTA:`, fmt(percepitoVal)));
    if (includeTickets) summaryRows.push(moneyRow(`+ CREDITO BUONI PASTO NON EROGATI:`, fmt(ticketVal)));
    summaryRows.push(moneyRow(totalLabel, fmt(nettoVal), true));
    children.push(new Table({ alignment: AlignmentType.CENTER, width: { size: 78, type: WidthType.PERCENTAGE }, borders: summaryBorders, rows: summaryRows }));

    // --- 4. Genera il VERO .docx ---
    const doc = new Document({
        creator: 'RailFlow',
        title: `Relazione Tecnica - ${worker?.cognome || 'Ricorrente'}`,
        styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 360 } } } } },
        sections: [{ properties: { page: { margin: { top: 1700, right: 1417, bottom: 1700, left: 1417 } } }, children }],
    });
    return await Packer.toBlob(doc);
}

export const RelazioneModal = ({ isOpen, onClose, worker, totals, includeExFest = false, includeTickets = false, showPercepito = false, startClaimYear = 2008 }: any) => {

    const [copiato, setCopiato] = useState(false);
    const isReadOnly = useIsReadOnly();

    if (!isOpen) return null;

    let testoCompleto = "";
    try {
        testoCompleto = generaRelazioneTestuale(worker, totals, includeExFest, includeTickets, startClaimYear, showPercepito);
    } catch (err) {
        console.error("Errore generazione testo:", err);
        testoCompleto = "Errore nella generazione dei dati. Controllare la console.";
    }

    // ... (Mantieni tutto il codice HTML per la stampa e il render JSX invariato) ...
    // Prepariamo l'HTML per le note (per la stampa) - RIMOSSO SU RICHIESTA BUSINESS

    const handleStampa = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const tettoGiorni = includeExFest ? 32 : 28;
        const gt = totals?.grandTotal || totals || {};
        const lordoVal = gt.incidenzaTotale ?? gt.totalLordo ?? gt.grossClaim ?? 0;
        const percepitoVal = gt.indennitaPercepita ?? gt.totalPercepito ?? 0;
        const ticketVal = gt.indennitaPasto ?? gt.totalTicket ?? 0;
        const nettoVal = (Number(lordoVal) - (showPercepito ? Number(percepitoVal) : 0)) + (includeTickets ? Number(ticketVal) : 0);

        let anniAttivi = (worker?.anni || [])
            .filter((a: AnnoDati) => Number(a.daysWorked) > 0 && Number(a.year) >= startClaimYear)
            .map((a: AnnoDati) => Number(a.year))
            .sort((a: number, b: number) => a - b);
        anniAttivi = [...new Set(anniAttivi)];
        if (anniAttivi.length === 0) anniAttivi = [startClaimYear, new Date().getFullYear()];
        const inizioPeriodo = startClaimYear;
        const finePeriodo = anniAttivi[anniAttivi.length - 1];

        const voci = generaVociRaggruppate(worker);
        const esempio = generaEsempioDinamico(worker, startClaimYear, tettoGiorni);
        const spiegazione = generaSpiegazioneRisultato(includeTickets, showPercepito);

        (printWindow.document as any).write(`
            <html>
            <head>
                <meta charset="utf-8">
                <title>Relazione Tecnica - ${worker?.cognome || ''}</title>
                <style>
                    @page { size: A4 portrait; margin: 2.5cm 2cm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; }
                    h2 { text-align: center; font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0 0 5pt 0; }
                    .subtitle { text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 20pt; border-bottom: 1px solid #000; padding-bottom: 8pt; }
                    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20pt; border: 1px solid #000; }
                    .info-table td { padding: 6pt 10pt; }
                    .section { page-break-inside: avoid; margin-top: 16pt; margin-bottom: 10pt; }
                    .section-title { font-weight: bold; text-transform: uppercase; font-size: 12pt; border-bottom: 1px solid #999; padding-bottom: 3pt; margin-bottom: 8pt; page-break-after: avoid; }
                    p { margin: 0 0 10pt 0; text-align: justify; orphans: 3; widows: 3; }
                    ul { margin: 4pt 0 12pt 0; padding-left: 24pt; }
                    li { margin-bottom: 4pt; text-align: justify; orphans: 3; widows: 3; }
                    .totali { page-break-before: always; padding-top: 20pt; }
                    .totali-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 20pt; }
                    .totali-table { width: 80%; margin: 0 auto; border-collapse: collapse; border: 2px solid #000; }
                    .totali-table td { padding: 12pt 15pt; }
                    .totali-row-final td { border-top: 2px solid #000; background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h2>Relazione Tecnica Descrittiva — Sintesi e Metodologia</h2>
                <div class="subtitle">CONTRATTO DI RIFERIMENTO: ${getProfiloBadgeLabel(worker?.profilo, worker?.eliorType) || 'ND'}</div>

                <table class="info-table">
                    <tr><td style="width:130pt; font-weight:bold;">Pratica di:</td><td>${worker?.cognome || ''} ${worker?.nome || ''}</td></tr>
                    <tr><td style="font-weight:bold;">Periodo Esaminato:</td><td>Dal ${inizioPeriodo} al ${finePeriodo}</td></tr>
                </table>

                <div class="section">
                    <div class="section-title">1. La Premessa</div>
                    <p>Il "diritto alle ferie annuali retribuite", oggetto del ricorso a cui la presente è allegata, viene posto a tutela della salute e della sicurezza del lavoratore, motivo per il quale si inserisce tra i principi cardine del diritto comunitario, ai quali non si può derogare. Il mantenimento della retribuzione durante il periodo feriale, pertanto, persegue il precipuo scopo di evitare l'insorgere di qualsiasi fattore che possa "dissuadere", anche solo a livello potenziale ovvero condizionare in termini negativi il godimento delle ferie e, dunque, costituisce un elemento che garantisce l'effettività dell'esercizio del diritto stesso.</p>
                    <p>La retribuzione feriale spettante al lavoratore può, pertanto, determinarsi effettuando una media della retribuzione percepita durante un periodo di lavoro effettivo all'uopo giudicato rappresentativo; il diritto interno di ogni Stato europeo non può, dunque, prevedere norme o ammettere prassi che condizionino, in termini negativi, il diritto alle ferie retribuite o che dissuadano il lavoratore dall'esercitare tale diritto.</p>
                </div>

                <div class="section">
                    <div class="section-title">2. Le Voci Analizzate (Rif. Allegato "Tabella 2 - Riepilogo Voci Variabili")</div>
                    <p>Per quantificare il credito, sono stati esaminati i cedolini paga forniti. Come dettagliato nella "Tabella 2" dei conteggi, sono state isolate esclusivamente le "voci ricorrenti e continuative, aventi natura specificatamente retributiva", escludendo tassativamente rimborsi spese, ticket mensa, elargizioni una tantum o arretrati non pertinenti.</p>
                    <p>Nello specifico del profilo lavorativo, sono state computate le seguenti indennità:</p>
                    <ul>${voci.html}</ul>
                </div>

                <div class="section">
                    <div class="section-title">3. Il Metodo di Calcolo (Rif. Allegato "Tabella 1 - Calcolo Differenze")</div>
                    <p>A garanzia di inattaccabilità contabile, il sistema ha applicato il <b>"Criterio della Media Storica"</b> (Rif. Cass. 20216/2022). Il valore di una giornata feriale è stato calcolato estraendo la media matematica dell'anno solare precedente.</p>
                    ${esempio.html}
                </div>

                <div class="section">
                    <div class="section-title">4. L'Applicazione Mensile (Rif. Allegato "Tabella 3 - Dettaglio Analitico")</div>
                    <p>Come documentato analiticamente nella "Tabella 3", il procedimento è stato reiterato per ogni singolo mese in cui il dipendente ha fruito di ferie.</p>
                    ${spiegazione.html}
                </div>

                <div class="section">
                    <div class="section-title">5. Conclusioni (Rif. Allegato "Prospetto Ufficiale di Ricalcolo")</div>
                    <p>Le risultanze delle elaborazioni analitiche di cui sopra convergono nel documento conclusivo denominato "Riepilogo Somme Richieste", che certifica senza ombra di dubbio gli importi esatti riportati nello specchietto sottostante.</p>
                </div>

                <div class="totali">
                    <div class="totali-title">Riepilogo degli Importi</div>
                    <table class="totali-table">
                        <tr>
                            <td style="width:70%;"><b>+ DIFFERENZE LORDE MATURATE:</b></td>
                            <td style="text-align:right; font-weight:bold; font-size:13pt;">€ ${fmt(lordoVal)}</td>
                        </tr>
                        ${showPercepito ? `<tr>
                            <td style="border-top:1px solid #ccc;"><b>- IMPORTO GIÀ PERCEPITO IN BUSTA:</b></td>
                            <td style="text-align:right; border-top:1px solid #ccc; font-weight:bold; font-size:13pt;">€ ${fmt(percepitoVal)}</td>
                        </tr>` : ''}
                        ${includeTickets ? `<tr>
                            <td style="border-top:1px solid #ccc;"><b>+ CREDITO BUONI PASTO NON EROGATI:</b></td>
                            <td style="text-align:right; border-top:1px solid #ccc; font-weight:bold; font-size:13pt;">€ ${fmt(ticketVal)}</td>
                        </tr>` : ''}
                        <tr class="totali-row-final">
                            <td><b style="font-size:14pt;">TOTALE CREDITO ${(!showPercepito && !includeTickets) ? 'LORDO' : 'NETTO'} SPETTANTE:</b></td>
                            <td style="text-align:right; font-weight:bold; font-size:14pt;">€ ${fmt(nettoVal)}</td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };
    const handleExportWord = async () => {
        const blob = await buildRelazioneDocxBlob({ worker, totals, includeExFest, includeTickets, showPercepito, startClaimYear });
        saveAs(blob, `Relazione_Tecnica_${worker?.cognome || 'Ricorrente'}.docx`);
    };

    const handleExportExcel = async () => {
        const nominativo = `${worker?.cognome || ''} ${worker?.nome || ''}`.trim();
        const tettoGiorni = includeExFest ? 32 : 28;

        // 1. Estrazione codici dinamici (dinamica e sicura)
        const specificColumns = getColumnsByProfile(worker?.profilo, worker?.eliorType);
        const codiciArray = specificColumns
            .map((c: any) => c.id)
            .filter((id: string) => !['month', 'total', 'daysWorked', 'daysVacation', 'daysPaidLeave', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati', '3B70', '3B71'].includes(id))
            .sort();

        const mesi = worker?.anni || [];

        // 2. Ordinamento temporale
        const mesiOrdinati = [...mesi].sort((a: AnnoDati, b: AnnoDati) => {
            if (a.year !== b.year) return Number(a.year) - Number(b.year);
            const mesiNomi = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
            return mesiNomi.indexOf(a.month.toUpperCase()) - mesiNomi.indexOf(b.month.toUpperCase());
        });

        // 3. Calcoli N-1 preparatori
        const datiAnnuali: Record<number, { totVoci: number, ggLav: number, ferieGodute: number }> = {};
        mesiOrdinati.forEach((m: AnnoDati) => {
            const anno = Number(m.year);
            if (!datiAnnuali[anno]) datiAnnuali[anno] = { totVoci: 0, ggLav: 0, ferieGodute: 0 };
            
            const ggLavMese = parseLocalFloat(m.daysWorked);
            
            let totMese = 0;
            codiciArray.forEach(cod => {
                totMese += m[cod] ? parseLocalFloat(m[cod]) : 0;
            });
            datiAnnuali[anno].totVoci += totMese;
            
            if (ggLavMese > 0) {
                datiAnnuali[anno].ggLav += ggLavMese;
            }
            
            if (anno >= startClaimYear) {
                datiAnnuali[anno].ferieGodute += parseLocalFloat(m.daysVacation);
            }
        });

        // --- MAPPA COLONNE ---
        // Se non ci sono codici, garantiamo almeno una larghezza di base
        const lastColLeft = 7 + codiciArray.length;
        const colSeparator = lastColLeft + 1;
        const startColRight = colSeparator + 1;
        const endColRight = startColRight + 5;

        // --- CREAZIONE WORKBOOK EXCELJS ---
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Prospetto CTU', {
            views: [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 4 }],
            properties: { outlineProperties: { summaryBelow: false, summaryRight: false } }
        });

        const borderThin: any = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        const numEuroContabile = '_-"€"* #,##0.00_-;-"€"* #,##0.00_-;_-"€"* "-"??_-;_-@_-';

        // Riga 1: Titolo Generale
        sheet.mergeCells(1, 1, 1, endColRight);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = `RELAZIONE TECNICA E PROSPETTO ANALITICO DIFFERENZE RETRIBUTIVE - ${nominativo.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 35;

        sheet.getRow(2).height = 10;

        // Riga 3: Macro-Sezioni
        sheet.mergeCells(3, 1, 3, lastColLeft);
        const headerLeft = sheet.getCell(3, 1);
        headerLeft.value = "DATI ESTRATTI DAI CEDOLINI MENSILI E INDENNITÀ PERCEPITE";
        headerLeft.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        headerLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } };
        headerLeft.alignment = { vertical: 'middle', horizontal: 'center' };
        headerLeft.border = borderThin;

        sheet.mergeCells(3, startColRight, 3, endColRight);
        const headerRight = sheet.getCell(3, startColRight);
        headerRight.value = "MOTORE DI CALCOLO: INCIDENZA MEDIA STORICA (ANNO N-1)";
        headerRight.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF385723' } };
        headerRight.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRight.border = borderThin;

        // Riga 4: Intestazioni di Colonna
        const headers = ["ANNO", "MESE", "GG LAV", "FERIE", "TICKET", "ARRETR.", "NOTE"];
        codiciArray.forEach(c => headers.push(`Cod.\n${c}`));

        headers.forEach((h, index) => {
            const cell = sheet.getCell(4, index + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        sheet.getCell(4, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };

        const rightHeaders = ["ANNO\nRIF.", "TOTALE VOCI\n(Anno N-1)", "GG LAV\n(Anno N-1)", "MEDIA\nGIORNALIERA", `FERIE GODUTE\n(Max ${tettoGiorni} gg)`, "CREDITO\nSPETTANTE"];
        rightHeaders.forEach((h, index) => {
            const cell = sheet.getCell(4, startColRight + index);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        sheet.getRow(4).height = 45;

        // ==========================================
        // SCRITTURA DATI E FORMULE (CON SUBTOTALI ANNUALI)
        // ==========================================
        const tuttiGliAnni = Array.from(new Set(mesiOrdinati.map(m => Number(m.year)))).sort((a, b) => a - b);
        let currentRow = 5;

        tuttiGliAnni.forEach(anno => {
            const mesiDellAnno = mesiOrdinati.filter(m => Number(m.year) === anno);
            const rigaSummary = currentRow;
            const startRowMesi = rigaSummary + 1;
            const endRowMesi = rigaSummary + mesiDellAnno.length;

            // --- 1. RIGA RIASSUNTIVA DELL'ANNO (VISIBILE) ---
            // Uniamo solo Anno e Mese per il titolo, lasciando libere le altre colonne per i Subtotali
            sheet.mergeCells(rigaSummary, 1, rigaSummary, 2);
            const cellSummary = sheet.getCell(rigaSummary, 1);
            cellSummary.value = `► ANNO ${anno}`;
            cellSummary.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
            cellSummary.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
            cellSummary.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cellSummary.border = borderThin;
            sheet.getCell(rigaSummary, 2).border = borderThin;

            // Inserimento formule SOMMA() per i dati del lato sinistro
            for (let colIndex = 3; colIndex <= lastColLeft; colIndex++) {
                const cell = sheet.getCell(rigaSummary, colIndex);
                const colLetter = sheet.getColumn(colIndex).letter;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
                cell.border = borderThin;
                cell.font = { bold: true };

                // Evitiamo di sommare la colonna NOTE (7)
                if (colIndex !== 7) {
                    cell.value = { formula: `SUM(${colLetter}${startRowMesi}:${colLetter}${endRowMesi})` };
                    if (colIndex >= 5 && colIndex !== 7) cell.numFmt = numEuroContabile; // Formato valuta per Ticket, Arretrati e Codici
                }
            }

            sheet.getCell(rigaSummary, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

            // Motore di Calcolo di destra
            if (anno >= startClaimYear) {
                const annoPrec = anno - 1;
                const datiPrec = datiAnnuali[annoPrec];
                const totVociN1 = datiPrec ? datiPrec.totVoci : 0;
                const ggLavN1 = datiPrec ? datiPrec.ggLav : 0;
                const ferieCalcolate = Math.min(datiAnnuali[anno].ferieGodute || 0, tettoGiorni);

                const colTot = sheet.getColumn(startColRight + 1).letter;
                const colGG = sheet.getColumn(startColRight + 2).letter;
                const colMedia = sheet.getColumn(startColRight + 3).letter;
                const colFerie = sheet.getColumn(startColRight + 4).letter;

                sheet.getCell(rigaSummary, startColRight).value = anno;
                sheet.getCell(rigaSummary, startColRight).font = { bold: true };
                sheet.getCell(rigaSummary, startColRight).alignment = { horizontal: 'center' };

                sheet.getCell(rigaSummary, startColRight + 1).value = totVociN1;
                sheet.getCell(rigaSummary, startColRight + 1).numFmt = numEuroContabile;

                sheet.getCell(rigaSummary, startColRight + 2).value = ggLavN1;
                sheet.getCell(rigaSummary, startColRight + 2).numFmt = '0.##'; // max 2 decimali: evita code floating-point (es. 253,20000000005)
                sheet.getCell(rigaSummary, startColRight + 2).alignment = { horizontal: 'center' };

                const cellMedia = sheet.getCell(rigaSummary, startColRight + 3);
                cellMedia.value = ggLavN1 > 0 ? { formula: `IFERROR(${colTot}${rigaSummary}/${colGG}${rigaSummary}, 0)` } : 0;
                cellMedia.numFmt = numEuroContabile;

                sheet.getCell(rigaSummary, startColRight + 4).value = ferieCalcolate;
                sheet.getCell(rigaSummary, startColRight + 4).numFmt = '0.##'; // max 2 decimali: evita code floating-point sulle ferie
                sheet.getCell(rigaSummary, startColRight + 4).alignment = { horizontal: 'center' };

                const cellCredito = sheet.getCell(rigaSummary, startColRight + 5);
                cellCredito.value = { formula: `${colMedia}${rigaSummary}*${colFerie}${rigaSummary}` };
                cellCredito.numFmt = numEuroContabile;
                cellCredito.font = { bold: true };
                cellCredito.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }; // Verde chiaro

                for (let j = startColRight; j <= endColRight; j++) {
                    sheet.getCell(rigaSummary, j).border = borderThin;
                }
            } else {
                for (let j = startColRight; j <= endColRight; j++) {
                    sheet.getCell(rigaSummary, j).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    sheet.getCell(rigaSummary, j).border = borderThin;
                }
            }
            currentRow++;

            // --- 2. RIGHE DEI MESI (RAGGRUPPATE / NASCOSTE) ---
            mesiDellAnno.forEach((m: AnnoDati) => {
                const rowMese = sheet.getRow(currentRow);

                sheet.getCell(currentRow, 1).value = Number(m.year);
                sheet.getCell(currentRow, 2).value = m.month;
                sheet.getCell(currentRow, 3).value = parseLocalFloat(m.daysWorked);
                sheet.getCell(currentRow, 4).value = parseLocalFloat(m.daysVacation);

                sheet.getCell(currentRow, 5).value = parseLocalFloat(m.ticket);
                sheet.getCell(currentRow, 5).numFmt = numEuroContabile;

                sheet.getCell(currentRow, 6).value = parseLocalFloat(m.arretrati);
                sheet.getCell(currentRow, 6).numFmt = numEuroContabile;

                const cellNote = sheet.getCell(currentRow, 7);
                cellNote.value = m.note || "";
                cellNote.alignment = { wrapText: true, vertical: 'middle' };

                codiciArray.forEach((cod, idx) => {
                    const val = m[cod] ? parseLocalFloat(m[cod]) : 0;
                    const cell = sheet.getCell(currentRow, 8 + idx);
                    cell.value = val;
                    cell.numFmt = numEuroContabile;
                });

                for (let j = 1; j <= lastColLeft; j++) {
                    sheet.getCell(currentRow, j).border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
                }

                sheet.getCell(currentRow, colSeparator).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

                rowMese.outlineLevel = 1; // Nasconde i mesi sotto il livello dell'anno

                currentRow++;
            });
        });

        // ==========================================
        // QUADRO DEI TOTALI FINALI BLINDATI
        // ==========================================
        const rowTotali = currentRow + 1;
        const colCreditoLetter = sheet.getColumn(endColRight).letter;

        sheet.mergeCells(rowTotali, startColRight, rowTotali, endColRight - 1);
        const cellLabelTot = sheet.getCell(rowTotali, startColRight);
        cellLabelTot.value = "TOTALE DIFFERENZE LORDE MATURATE:";
        cellLabelTot.font = { bold: true, size: 12 };
        cellLabelTot.alignment = { horizontal: 'right', vertical: 'middle' };

        const cellTotLordo = sheet.getCell(rowTotali, endColRight);

        if (tuttiGliAnni.length > 0) {
            cellTotLordo.value = { formula: `SUM(${colCreditoLetter}5:${colCreditoLetter}${currentRow - 1})/2` }; // Divide per 2 perché somma sia le righe nascoste che i subtotali
        } else {
            cellTotLordo.value = 0;
        }

        cellTotLordo.numFmt = numEuroContabile;
        cellTotLordo.font = { bold: true, size: 13, color: { argb: 'FF000000' } };
        cellTotLordo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
        cellTotLordo.border = { top: { style: 'double' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
        sheet.getRow(rowTotali).height = 25;

        // --- IMPOSTAZIONE LARGHEZZA COLONNE AUTOMATIZZATA ---
        sheet.getColumn(1).width = 9;  // Anno
        sheet.getColumn(2).width = 14; // Mese
        sheet.getColumn(3).width = 10; // GG Lav
        sheet.getColumn(4).width = 10; // Ferie
        sheet.getColumn(5).width = 13; // Ticket
        sheet.getColumn(6).width = 13; // Arretrati
        sheet.getColumn(7).width = 30; // Note

        for (let i = 0; i < codiciArray.length; i++) {
            sheet.getColumn(8 + i).width = 13; // Codici Economici
        }

        sheet.getColumn(colSeparator).width = 2; // Colonna divisoria

        sheet.getColumn(startColRight).width = 10;      // Anno Rif
        sheet.getColumn(startColRight + 1).width = 19; // Totale N-1
        sheet.getColumn(startColRight + 2).width = 13; // GG N-1
        sheet.getColumn(startColRight + 3).width = 18; // Media
        sheet.getColumn(startColRight + 4).width = 16; // Ferie Max
        sheet.getColumn(endColRight).width = 20;       // Credito

        // Salvataggio File Fisico
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Prospetto_Peritale_${worker?.cognome || 'Pratica'}.xlsx`);
    };
    const handleCopia = () => {
        navigator.clipboard.writeText(testoCompleto);
        setCopiato(true);
        setTimeout(() => setCopiato(false), 2000);
    };

    return (
        // Sfondo con Glassmorphism avanzato
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xl font-sans transition-all"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30, rotateX: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 20 }}
                // Contenitore con effetto vetro, bordi illuminati e ombra profonda
                className="bg-white/95 dark:bg-slate-900/90 w-full max-w-4xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-indigo-900/20 overflow-hidden flex flex-col max-h-[95vh] border border-white/60 dark:border-slate-700/50 backdrop-blur-2xl"
            >
                {/* HEADER - Floating Style */}
                <div className="px-8 py-5 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <motion.div
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="p-3 bg-gradient-to-br from-indigo-50 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 rounded-2xl border border-indigo-200/50 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        >
                            <PenTool className="w-6 h-6" />
                        </motion.div>
                        <div>
                            <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight">
                                Relazione Tecnica Peritale
                            </h2>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">
                                {getProfiloBadgeLabel(worker?.profilo, worker?.eliorType) || 'ND'} <span className="mx-2 text-slate-300 dark:text-slate-600">|</span> {worker?.cognome || ''} {worker?.nome || ''}
                            </p>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </motion.button>
                </div>

                {/* BODY - Il vero Foglio A4 3D */}
                <div className="p-6 sm:p-10 overflow-y-auto flex-1 relative bg-slate-100/50 dark:bg-slate-950/50 scroll-smooth">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="max-w-3xl mx-auto"
                    >
                        {/* Effetto carta tridimensionale */}
                        <div className="bg-white dark:bg-[#0f172a] p-10 sm:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] ring-1 ring-slate-900/5 dark:ring-white/10 rounded-sm relative overflow-hidden">
                            {/* Bordo colorato finto-legale in alto (Opzionale, dà un tocco pazzesco) */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 opacity-90"></div>

                            <pre className="whitespace-pre-wrap font-serif text-[14px] sm:text-[15.5px] text-slate-800 dark:text-slate-200 leading-relaxed">
                                {testoCompleto}
                            </pre>
                        </div>
                    </motion.div>
                </div>

                {/* FOOTER export/azioni — nascosto in modalita' sola lettura (tutti i bottoni
                    sono esportazioni di documenti sensibili: Copia testo, Word, Excel, Stampa PDF) */}
                {!isReadOnly && (
                <div className="px-8 py-5 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">

                    {/* Utility Button (Sinistra) */}
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleCopia}
                        className="w-full sm:w-auto px-5 py-2.5 flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold transition-colors duration-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm"
                    >
                        {copiato ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copiato ? 'Copiato!' : 'Copia Testo'}
                    </motion.button>

                    {/* Esportazioni (Destra) - Con animazione a cascata */}
                    <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleExportWord}
                            className="flex-1 sm:flex-none px-5 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20"
                        >
                            <FileText className="w-4 h-4" /> Word
                        </motion.button>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleExportExcel}
                            className="flex-1 sm:flex-none px-5 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors duration-200 bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </motion.button>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            whileHover={{ scale: 1.03, y: -2, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleStampa}
                            className="w-full sm:w-auto px-7 py-2.5 flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold transition-colors duration-200 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 border border-transparent dark:border-white/10"
                        >
                            <Printer className="w-4 h-4" /> Stampa PDF
                        </motion.button>
                    </div>
                </div>
                )}
            </motion.div>
        </motion.div>
    );
};