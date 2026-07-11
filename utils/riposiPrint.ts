// ==========================================
// FILE: utils/riposiPrint.ts
// "PDF dei conteggi" dell'area Turni & Riposi — pattern del tasto Stampa
// (HTML → finestra di stampa del browser → Salva come PDF), come il Riepilogo
// buste. NIENTE jsPDF: il documento buono è quello HTML.
//
// DOCUMENTO DA GIUDICE: tutti i testi di metodo/tariffa/valorizzazione/divario/
// riserve vengono dal nucleo condiviso utils/riposiDocText.ts (stessa fonte
// della relazione .docx: i due documenti non possono divergere). Le due serie
// (fonte PDF vs motore 561/2006) sono AFFIANCATE, mai sommate: confronto
// neutro, la scelta della base spetta all'avvocato.
// ==========================================

import { causaleSintetica, tariffaRange, formatHm, type RestResult } from './restEngine';
import {
    euro, intIT, tariffaLabel, coeffSuffix, dmyhm, buildDocModel,
    fonteDatiBullets, metodoFonteBullets, metodoMotorePassi, tariffaSpiegazione,
    divarioBullets, riserveBullets, AVVERTENZA_SERIE, QUALIFICAZIONE_SERIE, DISCLAIMER, RIF_PERIMETRO_CEE, type Bullet,
} from './riposiDocText';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Punto elenco dal nucleo: lead in grassetto + testo (escapato). */
const li = (bl: Bullet) => `<li><strong>${esc(bl.lead)}</strong> — ${esc(bl.testo)}</li>`;

export function buildConteggiRiposiHtml(pratica: PraticaRiposi, result: RestResult): string {
    const model = buildDocModel(pratica, result);
    const { coeff, val, rates, fonte, violazioni, righeAnno, totViol } = model;
    const mostraVP = coeff !== 1;
    const oggi = new Date().toLocaleDateString('it-IT');

    const totali = righeAnno.reduce(
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
            elencoRows += `<tr class="anno"><td colspan="${mostraVP ? 10 : 9}">${y} — ${n} violazioni</td></tr>`;
        }
        const tipo = v.tipo === 'riposo_giornaliero' ? 'Giornaliero&#185;' : 'Settimanale&#178;';
        elencoRows += `<tr>
            <td>${dmyhm(v.inizio)}</td>
            <td>${dmyhm(v.fine)}</td>
            <td>${tipo}</td>
            <td class="num">${formatHm(v.ore)}</td>
            <td class="num">${formatHm(v.oreMancanti)}</td>
            <td class="num">${euro(rates[y] ?? pratica.tariffaOraria)}</td>
            ${mostraVP ? `<td class="num">${euro(v.valorePieno)}</td>` : ''}
            <td class="num">${euro(v.indennita)}</td>
            <td class="${v.gravita === 'grave' ? 'grave' : ''}">${v.gravita}</td>
            <td class="motivo">${esc(causaleSintetica(v))}</td>
        </tr>`;
    }

    const warningsHtml = result.warnings.length
        ? `<section>
            <h2>Righe da verificare a mano (${result.warnings.length})</h2>
            <p class="nota">Per trasparenza metodologica: orari non interpretabili, turni di durata anomala o intervalli non valutabili segnalati dal motore (policy «segnala, non indovinare»). Non concorrono ai conteggi.</p>
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
    ul.blocco, ol.metodo { font-size: 9.5pt; padding-left: 16pt; margin: 0; }
    ul.blocco li, ol.metodo li { margin-bottom: 4pt; }
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
        <tr><td>Perimetro di calcolo (serie B)</td><td>${model.soloCEE ? 'sole giornate in regime Reg. (CE) n. 561/2006 (marcate «CEE»)' : 'tutte le giornate del prospetto'}</td></tr>
        <tr><td>Tariffa oraria applicata dal motore</td><td>${tariffaLabel(rates)}${tariffaRange(rates).uniform ? '' : ' — per anno, cresce per anzianità di servizio'}</td></tr>
        <tr><td>Valorizzazione della serie B</td><td>${esc(val.riga)}</td></tr>
        <tr><td>Documento generato il</td><td>${oggi}</td></tr>
    </table>

    <h2>1. Le due serie a confronto</h2>
    <div class="serie">
        <div>
            <h3>A — Indennità secondo il documento sorgente</h3>
            <p class="valore">${fonte.gg > 0 ? euro(fonte.ind) : '—'}</p>
            <p>${fonte.gg > 0 ? `${intIT(fonte.gg)} giornate indennizzate · ${intIT(fonte.ore)} ore mancanti · criteri del compilatore (v. nota metodologica)` : 'serie non presente nei dati'}</p>
        </div>
        <div>
            <h3>B — Indennità secondo il motore (Reg. 561/2006)</h3>
            <p class="valore">${euro(result.totIndennita)}</p>
            <p>${intIT(totViol)} violazioni (${result.nViolazioniGiornaliere} giornaliere, ${result.nViolazioniSettimanali} settimanali) · ${intIT(result.totOreMancanti)} ore mancanti · tariffa per anno ${tariffaLabel(rates)}${coeffSuffix(coeff)}</p>
        </div>
    </div>
    <p class="avvertenza"><strong>Le due serie NON si sommano:</strong> ${esc(AVVERTENZA_SERIE.replace('Le due serie NON si sommano: ', ''))}</p>

    <h2>2. Riepilogo per anno</h2>
    <table>
        <thead><tr><th>Anno</th><th class="num">Tariffa €/h</th><th class="num">Viol. giornaliere</th><th class="num">Viol. settimanali</th><th class="num">Ore mancanti</th>${mostraVP ? '<th class="num">Valore pieno</th>' : ''}<th class="num">${mostraVP ? `Indennità (${coeffSuffix(coeff).trim()})` : '€ motore (B)'}</th><th class="num">€ fonte (A)</th></tr></thead>
        <tbody>
            ${righeAnno.map((r) => `<tr><td>${r.y}</td><td class="num">${rates[r.y] != null ? euro(rates[r.y]) : '—'}</td><td class="num">${r.g}</td><td class="num">${r.s}</td><td class="num">${formatHm(r.oreMancanti)}</td>${mostraVP ? `<td class="num">${euro(r.vp)}</td>` : ''}<td class="num">${euro(r.ind)}</td><td class="num">${r.indFonte ? euro(r.indFonte) : '—'}</td></tr>`).join('')}
            <tr class="totale"><td>Totale</td><td class="num">—</td><td class="num">${totali.g}</td><td class="num">${totali.s}</td><td class="num">${formatHm(totali.ore)}</td>${mostraVP ? `<td class="num">${euro(totali.vp)}</td>` : ''}<td class="num">${euro(totali.ind)}</td><td class="num">${totali.indFonte ? euro(totali.indFonte) : '—'}</td></tr>
        </tbody>
    </table>
    ${mostraVP ? `<p class="nota"><strong>Come si arriva al totale:</strong> il valore pieno (ore mancanti × tariffa €/h dell'anno) è ${euro(totali.vp)}; su ciascuna violazione si applica la valorizzazione (${esc(val.riga)}) e si arrotonda al centesimo, quindi si somma → indennità complessiva <strong>${euro(totali.ind)}</strong>. Ogni colonna quadra per somma.</p>` : ''}

    <h2>3. Perché le due serie differiscono</h2>
    <ul class="blocco">${divarioBullets(model, result).map(li).join('')}</ul>
    <p class="nota" style="margin-top:6pt"><strong>Qualificazione delle due serie.</strong> ${esc(QUALIFICAZIONE_SERIE.replace('Qualificazione delle due serie: ', ''))}</p>

    <h2>4. Elenco delle violazioni rilevate dal motore (${intIT(totViol)})</h2>
    <table>
        <thead><tr><th>Riposo dal</th><th>al</th><th>Tipo</th><th class="num">Fruito</th><th class="num">Mancante</th><th class="num">Tariffa €/h</th>${mostraVP ? '<th class="num">Valore pieno</th>' : ''}<th class="num">Indennità</th><th>Gravità</th><th>Causale</th></tr></thead>
        <tbody>${elencoRows}</tbody>
    </table>
    <p class="legenda">&#185; Riposo giornaliero: Reg. (CE) n. 561/2006, art. 8 §§2,4; art. 4 lett. g — minimo 11h, riducibile a 9h al massimo 3 volte tra due riposi settimanali.<br>
    &#178; Riposo settimanale: Reg. (CE) n. 561/2006, art. 8 §6; art. 4 lett. h — minimo 45h, da iniziare entro sei periodi di 24h dal precedente; riducibile a 24h con alternanza obbligatoria con un riposo regolare.<br>
    Gravità «grave»: riduzione superiore al 10% della soglia (criterio Reg. (UE) 2016/403) o riposo inferiore al minimo ridotto; criterio di classificazione, non trigger dell'illecito.</p>

    <h2>5. Nota metodologica</h2>
    <p class="nota"><strong>Fonte dei dati.</strong></p>
    <ul class="blocco">${fonteDatiBullets(model, pratica).map(li).join('')}</ul>
    <p class="nota" style="margin-top:6pt"><strong>Criteri del documento sorgente (serie A).</strong></p>
    <ul class="blocco">${metodoFonteBullets(model).map(li).join('')}</ul>
    <p class="nota" style="margin-top:6pt"><strong>Catena di calcolo del motore (serie B).</strong> ${model.soloCEE ? esc(RIF_PERIMETRO_CEE) : ''}</p>
    <ol class="metodo">${metodoMotorePassi(model, pratica, result).map((p) => `<li><strong>${esc(p.lead.replace(/^\d+\) /, ''))}</strong> — ${esc(p.testo)}</li>`).join('')}</ol>
    <p class="nota" style="margin-top:6pt"><strong>Tariffa oraria.</strong> ${esc(tariffaSpiegazione(model, pratica))} In formula: <strong>${esc(val.formula)}</strong>. Gli importi sono arrotondati al centesimo per singola violazione e poi sommati: ogni colonna delle tabelle quadra per somma.</p>
    <p class="nota" style="margin-top:6pt"><strong>Riserve e limiti.</strong></p>
    <ul class="blocco">${riserveBullets(model, pratica, result).map(li).join('')}</ul>

    ${warningsHtml}

    <div class="footer">
        <span>Conteggi mancati riposi — ${esc(pratica.cognome)} ${esc(pratica.nome)} — generato il ${oggi}</span>
        <span>${esc(DISCLAIMER)}</span>
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
