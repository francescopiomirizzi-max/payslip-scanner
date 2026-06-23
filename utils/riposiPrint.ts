// ==========================================
// FILE: utils/riposiPrint.ts
// "PDF dei conteggi" dell'area Turni & Riposi — pattern del tasto Stampa
// (HTML → finestra di stampa del browser → Salva come PDF), come il Riepilogo
// buste. NIENTE jsPDF: il documento buono è quello HTML.
//
// buildConteggiRiposiHtml è PURO (testabile); printConteggiRiposi apre la
// finestra. Le due serie (fonte PDF vs motore 561/2006) sono AFFIANCATE,
// mai sommate: confronto neutro, la scelta della base spetta all'avvocato.
// ==========================================

import { causaleSintetica, computeSerieFonte, tariffaRange, formatHm, type RestResult, type Violazione } from './restEngine';

import { groupThousandsIT } from './formatters';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

const euro = (n: number) => '€ ' + groupThousandsIT(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const intIT = (n: number) => groupThousandsIT(Math.round(n).toLocaleString('it-IT'));
/** Etichetta tariffa: valore singolo se piatta, range "€min → €max" se per-anno. */
const tariffaLabel = (rates: Record<string, number>): string => {
    const { min, max, uniform } = tariffaRange(rates);
    return uniform ? `${euro(min)}/h` : `${euro(min)} → ${euro(max)}/h`;
};
/** Suffisso coefficiente danno (es. " × 20%") quando attivo; vuoto se valore pieno. */
const coeffSuffix = (coeff: number): string => (coeff !== 1 ? ` × ${Math.round(coeff * 100)}%` : '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmyhm = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

/** Riga del riepilogo annuale: motore e fonte affiancate. */
interface RigaAnno { y: string; g: number; s: number; oreMancanti: number; vp: number; ind: number; indFonte: number }

function righePerAnno(violazioni: Violazione[], perAnnoFonte: Record<string, number>): RigaAnno[] {
    const m: Record<string, RigaAnno> = {};
    const riga = (y: string) => (m[y] ??= { y, g: 0, s: 0, oreMancanti: 0, vp: 0, ind: 0, indFonte: 0 });
    for (const v of violazioni) {
        const r = riga(v.inizio.slice(0, 4));
        if (v.tipo === 'riposo_giornaliero') r.g++; else r.s++;
        r.oreMancanti += v.oreMancanti;
        r.vp += v.valorePieno;
        r.ind += v.indennita;
    }
    for (const [y, ind] of Object.entries(perAnnoFonte)) riga(y).indFonte = ind;
    return Object.values(m).sort((a, b) => a.y.localeCompare(b.y));
}

export function buildConteggiRiposiHtml(pratica: PraticaRiposi, result: RestResult): string {
    const fonte = computeSerieFonte(pratica.giornate);
    const coeff = pratica.coefficiente ?? 1;
    const pct = Math.round(coeff * 100);
    const rates = result.tariffePerAnnoApplicate;
    const righe = righePerAnno(result.violazioni, fonte.perAnno);
    const violazioni = [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio));
    const totViol = result.nViolazioniGiornaliere + result.nViolazioniSettimanali;
    const oggi = new Date().toLocaleDateString('it-IT');

    const totali = righe.reduce(
        (t, r) => ({ g: t.g + r.g, s: t.s + r.s, ore: t.ore + r.oreMancanti, vp: t.vp + r.vp, ind: t.ind + r.ind, indFonte: t.indFonte + r.indFonte }),
        { g: 0, s: 0, ore: 0, vp: 0, ind: 0, indFonte: 0 }
    );

    // Elenco violazioni raggruppato per anno (subheader), thead ripetuto per pagina dal browser.
    let elencoRows = '';
    let annoCorrente = '';
    for (const v of violazioni) {
        const y = v.inizio.slice(0, 4);
        if (y !== annoCorrente) {
            annoCorrente = y;
            const n = violazioni.filter((x) => x.inizio.slice(0, 4) === y).length;
            elencoRows += `<tr class="anno"><td colspan="${coeff !== 1 ? 10 : 9}">${y} — ${n} violazioni</td></tr>`;
        }
        const tipo = v.tipo === 'riposo_giornaliero' ? 'Giornaliero&#185;' : 'Settimanale&#178;';
        elencoRows += `<tr>
            <td>${dmyhm(v.inizio)}</td>
            <td>${dmyhm(v.fine)}</td>
            <td>${tipo}</td>
            <td class="num">${formatHm(v.ore)}</td>
            <td class="num">${formatHm(v.oreMancanti)}</td>
            <td class="num">${euro(rates[y] ?? pratica.tariffaOraria)}</td>
            ${coeff !== 1 ? `<td class="num">${euro(v.valorePieno)}</td>` : ''}
            <td class="num">${euro(v.indennita)}</td>
            <td class="${v.gravita === 'grave' ? 'grave' : ''}">${v.gravita}</td>
            <td class="motivo">${esc(causaleSintetica(v))}</td>
        </tr>`;
    }

    const warningsHtml = result.warnings.length
        ? `<section>
            <h2>Righe da verificare a mano (${result.warnings.length})</h2>
            <p class="nota">Per trasparenza metodologica: orari non interpretabili o turni di durata anomala segnalati dal motore (policy «segnala, non indovinare»). Non concorrono ai conteggi.</p>
            <ul class="warnings">${result.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        </section>`
        : '';

    return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Conteggi_mancati_riposi_${esc(pratica.cognome)}_${esc(pratica.nome)}</title>
<style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; font-size: 10.5pt; line-height: 1.45; margin: 0; }
    h1 { font-size: 15pt; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 2pt; }
    .sottotitolo { font-size: 10pt; color: #444; margin: 0 0 14pt; }
    h2 { font-size: 11.5pt; border-bottom: 1.5px solid #111; padding-bottom: 3pt; margin: 18pt 0 8pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th { text-align: left; border-bottom: 1.2px solid #111; padding: 3pt 5pt; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.03em; }
    td { border-bottom: 0.5px solid #bbb; padding: 3pt 5pt; vertical-align: top; }
    tr { page-break-inside: avoid; }
    .num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .intestazione td { border: none; padding: 1.5pt 0; }
    .intestazione td:first-child { width: 38%; color: #444; }
    .serie { display: flex; gap: 10pt; }
    .serie > div { flex: 1; border: 1px solid #111; padding: 8pt 10pt; }
    .serie h3 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4pt; }
    .serie .valore { font-size: 14pt; font-weight: bold; margin: 0 0 2pt; }
    .serie p { margin: 0; font-size: 9pt; color: #333; }
    .avvertenza { border: 1px solid #111; background: #f3f3f3; padding: 6pt 9pt; font-size: 9pt; margin-top: 8pt; }
    tr.totale td { border-top: 1.5px solid #111; border-bottom: none; font-weight: bold; }
    tr.anno td { background: #eee; font-weight: bold; border-bottom: 1px solid #111; padding-top: 5pt; }
    td.grave { font-weight: bold; }
    td.motivo { font-size: 8.5pt; color: #333; }
    .nota { font-size: 9pt; color: #333; margin: 0 0 6pt; }
    .legenda { font-size: 8.5pt; color: #333; margin-top: 5pt; }
    ol.metodo { font-size: 9.5pt; padding-left: 16pt; margin: 0; }
    ol.metodo li { margin-bottom: 4pt; }
    ul.warnings { font-size: 8.5pt; color: #333; padding-left: 14pt; margin: 0; column-count: 2; column-gap: 16pt; }
    .footer { margin-top: 22pt; border-top: 1px solid #111; padding-top: 6pt; font-size: 8.5pt; color: #444; display: flex; justify-content: space-between; }
    @media print { .serie { display: flex; } }
</style>
</head>
<body>
    <h1>Prospetto dei conteggi — Mancati riposi</h1>
    <p class="sottotitolo">Riposo giornaliero e settimanale ex Reg. (CE) n. 561/2006 — elaborazione tecnica di supporto alla valutazione legale</p>

    <table class="intestazione">
        <tr><td>Lavoratore</td><td><strong>${esc(pratica.cognome)} ${esc(pratica.nome)}</strong></td></tr>
        ${pratica.mansione ? `<tr><td>Mansione</td><td>${esc(pratica.mansione)}</td></tr>` : ''}
        ${pratica.azienda ? `<tr><td>Azienda</td><td>${esc(pratica.azienda)}</td></tr>` : ''}
        <tr><td>Periodo analizzato</td><td>${esc(pratica.periodoStart ?? '—')} – ${esc(pratica.periodoEnd ?? '—')}</td></tr>
        <tr><td>Giornate nel prospetto turni</td><td>${intIT(pratica.giornate.length)}</td></tr>
        <tr><td>Tariffa oraria applicata dal motore</td><td>${tariffaLabel(rates)}${tariffaRange(rates).uniform ? '' : ' — per anno, cresce per anzianità di servizio'}${pratica.fonteTariffa ? ` (${esc(pratica.fonteTariffa)})` : ''}</td></tr>
        ${coeff !== 1 ? `<tr><td>Coefficiente danno</td><td>${Math.round(coeff * 100)}% del valore del riposo perso (indennità = ore mancanti × tariffa dell'anno × ${Math.round(coeff * 100)}%)</td></tr>` : ''}
        <tr><td>Documento generato il</td><td>${oggi}</td></tr>
    </table>

    <h2>1. Le due serie a confronto</h2>
    <div class="serie">
        <div>
            <h3>A — Indennità secondo il documento sorgente</h3>
            <p class="valore">${fonte.gg > 0 ? euro(fonte.ind) : '—'}</p>
            <p>${fonte.gg > 0 ? `${intIT(fonte.gg)} giornate indennizzate · ${intIT(fonte.ore)} ore mancanti · tariffe e criteri di chi ha prodotto il documento` : 'serie non presente nei dati'}</p>
        </div>
        <div>
            <h3>B — Indennità secondo il motore (Reg. 561/2006)</h3>
            <p class="valore">${euro(result.totIndennita)}</p>
            <p>${intIT(totViol)} violazioni (${result.nViolazioniGiornaliere} giornaliere, ${result.nViolazioniSettimanali} settimanali) · ${intIT(result.totOreMancanti)} ore mancanti · tariffa per anno ${tariffaLabel(rates)}${coeffSuffix(coeff)}</p>
        </div>
    </div>
    <p class="avvertenza"><strong>Le due serie NON si sommano:</strong> quantificano lo stesso pregiudizio (i medesimi riposi non fruiti) con criteri diversi. La scelta della base di quantificazione, e la verifica che le indennità della serie A non risultino già corrisposte in busta paga, spettano al legale incaricato.</p>

    <h2>2. Riepilogo per anno</h2>
    <table>
        <thead><tr><th>Anno</th><th class="num">Tariffa €/h</th><th class="num">Viol. giornaliere</th><th class="num">Viol. settimanali</th><th class="num">Ore mancanti</th>${coeff !== 1 ? '<th class="num">Valore pieno</th>' : ''}<th class="num">${coeff !== 1 ? `Indennità (×${pct}%)` : '€ motore (B)'}</th><th class="num">€ fonte (A)</th></tr></thead>
        <tbody>
            ${righe.map((r) => `<tr><td>${r.y}</td><td class="num">${rates[r.y] != null ? euro(rates[r.y]) : '—'}</td><td class="num">${r.g}</td><td class="num">${r.s}</td><td class="num">${formatHm(r.oreMancanti)}</td>${coeff !== 1 ? `<td class="num">${euro(r.vp)}</td>` : ''}<td class="num">${euro(r.ind)}</td><td class="num">${r.indFonte ? euro(r.indFonte) : '—'}</td></tr>`).join('')}
            <tr class="totale"><td>Totale</td><td class="num">—</td><td class="num">${totali.g}</td><td class="num">${totali.s}</td><td class="num">${formatHm(totali.ore)}</td>${coeff !== 1 ? `<td class="num">${euro(totali.vp)}</td>` : ''}<td class="num">${euro(totali.ind)}</td><td class="num">${totali.indFonte ? euro(totali.indFonte) : '—'}</td></tr>
        </tbody>
    </table>
    ${coeff !== 1 ? `<p class="nota"><strong>Come si arriva al totale:</strong> il valore pieno (ore mancanti × tariffa €/h dell'anno) è ${euro(totali.vp)}; su ciascuna violazione si applica il ${pct}% e si arrotonda al centesimo, quindi si somma → indennità complessiva <strong>${euro(totali.ind)}</strong>. Ogni colonna quadra per somma.</p>` : ''}

    <h2>3. Elenco delle violazioni rilevate dal motore (${intIT(totViol)})</h2>
    <table>
        <thead><tr><th>Riposo dal</th><th>al</th><th>Tipo</th><th class="num">Fruito</th><th class="num">Mancante</th><th class="num">Tariffa €/h</th>${coeff !== 1 ? '<th class="num">Valore pieno</th>' : ''}<th class="num">Indennità</th><th>Gravità</th><th>Causale</th></tr></thead>
        <tbody>${elencoRows}</tbody>
    </table>
    <p class="legenda">&#185; Riposo giornaliero: Reg. (CE) n. 561/2006, art. 8 §§2,4; art. 4 lett. g — minimo 11h, riducibile a 9h al massimo 3 volte tra due riposi settimanali.<br>
    &#178; Riposo settimanale: Reg. (CE) n. 561/2006, art. 8 §6; art. 4 lett. h — minimo 45h, riducibile a 24h con alternanza obbligatoria con un riposo regolare.<br>
    Gravità «grave»: riduzione superiore al 10% della soglia (criterio Reg. (UE) 2016/403) o riposo inferiore al minimo ridotto; criterio di classificazione, non trigger dell'illecito.</p>

    <h2>4. Nota metodologica</h2>
    <ol class="metodo">
        <li><strong>Fonte dei dati:</strong> prospetto turni giornaliero estratto dal documento sorgente con parser deterministico (nessuna interpretazione AI/OCR); i totali estratti quadrano al centesimo con quelli stampati nel documento.</li>
        <li><strong>Perimetro e motore:</strong> calcolo sulle sole giornate in regime <strong>CEE</strong> (servizio di linea ex Reg. (CE) n. 561/2006); ricostruzione dei riposi tra turni consecutivi dai soli orari di inizio/termine; soglie del Reg. 561/2006 (giornaliero 11h, ridotto 9h max 3 volte; settimanale 45h, ridotto 24h con alternanza ex art. 8 §6). I riposi ridotti leciti (${intIT(result.nRidottiGiornalieriLeciti)} nel periodo) non sono conteggiati come violazioni.</li>
        <li><strong>Indennità (serie B) — la catena di calcolo:</strong> per ogni violazione, <em>ore mancanti</em> (soglia − fruito) × <em>tariffa oraria dell'anno</em> = <strong>valore pieno</strong>. La tariffa è ricavata anno per anno dal documento sorgente (${tariffaLabel(rates)}) e cresce per anzianità di servizio${pratica.fonteTariffa ? ` — ${esc(pratica.fonteTariffa)}` : ''}.${coeff !== 1 ? ` Sul valore pieno si applica il <strong>${pct}%</strong> (danno, criterio dell'avvocato) = indennità. Formula: <strong>Indennità = Σ (ore mancanti × tariffa €/h dell'anno) × ${pct}%</strong>. Gli importi sono arrotondati al centesimo per singola violazione e poi sommati: ogni colonna delle tabelle quadra per somma.` : ''}</li>
        <li><strong>Perimetro:</strong> il calcolo copre il riposo giornaliero e settimanale. La pausa di guida ex art. 7 richiede i dati del cronotachigrafo, non presenti nel prospetto, ed è esclusa da questa elaborazione.</li>
        <li><strong>Limiti:</strong> i codici di servizio (linea/turno) non sono decodificabili senza la legenda aziendale; le righe segnalate in coda sono escluse dal calcolo e vanno verificate sui documenti originali.</li>
    </ol>

    ${warningsHtml}

    <div class="footer">
        <span>Conteggi mancati riposi — ${esc(pratica.cognome)} ${esc(pratica.nome)} — generato il ${oggi}</span>
        <span>Elaborazione tecnica di supporto: la valutazione legale spetta al professionista incaricato</span>
    </div>
</body>
</html>`;
}

/** Apre la finestra di stampa del browser sul documento dei conteggi. */
export function printConteggiRiposi(pratica: PraticaRiposi, result: RestResult): void {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildConteggiRiposiHtml(pratica, result));
    w.document.close();
    w.focus();
    w.print();
}
