import { describe, it, expect } from 'vitest';
import {
    valorizzazioneInfo, coeffSuffix, buildDocModel,
    divarioBullets, riserveBullets, metodoMotorePassi, tariffaSpiegazione,
    buildRivalutazioneModel, rivalutazioneBullets,
} from '../utils/riposiDocText';
import { computeRestViolations, type GiornataInput } from '../utils/restEngine';
import { buildRelazioneRiposiDoc } from '../utils/riposiRelazione';
import { buildConteggiRiposiHtml } from '../utils/riposiPrint';
import { Packer } from 'docx';
import { unzipSync, strFromU8 } from 'fflate';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// Fixture con TUTTI i casi che i documenti devono dichiarare:
// - violazione giornaliera CEE (riposo 6h il 30/12);
// - giornata lavorata SENZA orari (servizio '41' il 04/01) → salvaguardia;
// - fonte con indennità sia su giornata CEE sia su giornata NON CEE (split del divario).
const giornate: GiornataInput[] = [
    { data: '30/12/2023', servizio: '63', tipo: 'CEE', inizio: '6.00', termine: '14.00' },
    { data: '30/12/2023', servizio: '1063', inizio: '20.00', termine: '23.00' }, // riposo 14–20 = 6h → violazione
    { data: '31/12/2023', servizio: 'R' },
    { data: '02/01/2024', servizio: '63', tipo: 'CEE', inizio: '6.00', termine: '14.00', mancatoRipGiorn: '2.30', indennitaFonte: 25.5 },
    { data: '03/01/2024', servizio: '70', inizio: '6.00', termine: '14.00', mancatoRipGiorn: '1.00', indennitaFonte: 10 }, // NON CEE indennizzata
    { data: '04/01/2024', servizio: '41' }, // lavorata senza orari → l'intervallo che la attraversa non è riposo
    { data: '05/01/2024', servizio: '63', inizio: '6.00', termine: '14.00' },
];

const basePratica: PraticaRiposi = {
    id: 'test', nome: 'Tommaso', cognome: 'Viterbo', mansione: 'Operatore di esercizio (TPL)',
    azienda: 'Ferrovie del Sud Est', periodoStart: '30/12/2023', periodoEnd: '05/01/2024',
    tariffaOraria: 10, stato: 'in_corso', fonteTariffa: 'costruzione verificata sui ruoli paga', giornate,
};

const result = computeRestViolations(giornate, { tariffaOraria: 10, soloCEE: true });

describe('valorizzazioneInfo — le tre letture del coefficiente (documenti da giudice)', () => {
    it('valore pieno (1): nessun coefficiente, formula semplice', () => {
        const v = valorizzazioneInfo(1);
        expect(v.modo).toBe('pieno');
        expect(v.riga).toContain('valore pieno');
        expect(v.passo).toBeNull();
    });
    it('maggiorazione (1,20): MAI «danno = 120%»', () => {
        const v = valorizzazioneInfo(1.2);
        expect(v.modo).toBe('maggiorazione');
        expect(v.riga).toContain('maggiorato del 20%');
        expect(v.riga).not.toContain('danno');
        expect(v.formula).toContain('1,20');
        expect(coeffSuffix(1.2)).toBe(' +20%');
    });
    it('danno (0,20): percentuale sul valore', () => {
        const v = valorizzazioneInfo(0.2);
        expect(v.modo).toBe('danno');
        expect(v.riga).toContain('20% del valore');
        expect(coeffSuffix(0.2)).toBe(' × 20%');
        expect(coeffSuffix(1)).toBe('');
    });
});

describe('buildDocModel — numeri dichiarati nei documenti', () => {
    const model = buildDocModel(basePratica, result);
    it('split CEE della serie A (per la sezione divario)', () => {
        expect(model.splitCEE.ceeInd).toBe(25.5);
        expect(model.splitCEE.ceeGG).toBe(1);
        expect(model.splitCEE.altroInd).toBe(10);
        expect(model.splitCEE.altroGG).toBe(1);
    });
    it('giornate lavorate senza orari contate (salvaguardia)', () => {
        expect(model.nSenzaOrari).toBe(1); // il servizio "41" del 04/01
        expect(model.nIntervalliNonValutati).toBeGreaterThan(0); // il warning aggregato del motore
    });
    it('tempestività assente di default → nTiming = 0 (esclusione dichiarata)', () => {
        expect(model.nTiming).toBe(0);
    });
});

describe('testi critici: divario, riserve, metodo', () => {
    const model = buildDocModel(basePratica, result);
    it('divario: perimetro CEE quantificato + tempestività esclusa + granularità', () => {
        const leads = divarioBullets(model, result).map((b) => b.lead);
        expect(leads).toContain('Perimetro CEE');
        expect(leads).toContain('Tempestività del settimanale');
        expect(leads).toContain('Unità di conteggio del settimanale');
        const cee = divarioBullets(model, result).find((b) => b.lead === 'Perimetro CEE')!;
        expect(cee.testo).toContain('€ 10,00'); // quota non-CEE della serie A
    });
    it('riserve: esclusione prudenziale della tempestività dichiarata quando la regola è spenta', () => {
        const leads = riserveBullets(model, basePratica, result).map((b) => b.lead);
        expect(leads.join('|')).toContain('Tempestività del settimanale (esclusione prudenziale)');
    });
    it('riserve con maggiorazione: dichiarato il CUMULO con la valorizzazione festiva già in tariffa', () => {
        const p = { ...basePratica, coefficiente: 1.2 };
        const m = buildDocModel(p, result);
        const r = riserveBullets(m, p, result).find((b) => b.lead === 'Valorizzazione')!;
        expect(r.testo).toContain('incorpora già la valorizzazione festiva');
        expect(r.testo).toContain('CUMULA');
    });
    it('metodo motore: salvaguardia giornate senza orari dichiarata come passo', () => {
        const passi = metodoMotorePassi(model, basePratica, result).map((p) => p.lead + ' ' + p.testo).join('\n');
        expect(passi).toContain('Salvaguardia sulle giornate senza orari');
        expect(passi).toContain('Perimetro CEE');
    });
    it('tariffa: catena contrattuale completa + riscontro documentale dalla pratica', () => {
        const t = tariffaSpiegazione(model, basePratica);
        expect(t).toContain('divisore 195');
        expect(t).toContain('art. 15 CCNL 23/07/1976');
        expect(t).toContain('art. 14 CCNL 25/07/1997');
        expect(t).toContain('INCORPORA');
        expect(t).toContain('costruzione verificata sui ruoli paga');
    });
});

describe('i due documenti dicono le stesse cose (nucleo condiviso)', () => {
    it('relazione .docx: nuove sezioni presenti', async () => {
        const buffer = await Packer.toBuffer(buildRelazioneRiposiDoc(basePratica, result));
        const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']);
        for (const s of [
            'Fonte dei dati e affidabilità',
            'Criteri del documento sorgente (serie A)',
            'Perché le due serie differiscono',
            'Salvaguardia sulle giornate senza orari',
            'art. 15 CCNL 23/07/1976',
            'nota INL prot. n. 61 del 14/01/2021',
            'Riserve e limiti',
        ]) expect(xml).toContain(s);
    });
    it('conteggi stampabili: stesse dichiarazioni', () => {
        const html = buildConteggiRiposiHtml(basePratica, result);
        for (const s of [
            'Perché le due serie differiscono',
            'Criteri del documento sorgente (serie A)',
            'Salvaguardia sulle giornate senza orari',
            'art. 15 CCNL 23/07/1976',
            'Riserve e limiti',
        ]) expect(html).toContain(s);
    });
    it('con maggiorazione 1,20 nessun documento parla di «danno»: etichette coerenti', async () => {
        const p = { ...basePratica, coefficiente: 1.2 };
        const html = buildConteggiRiposiHtml(p, result);
        expect(html).toContain('maggiorato del 20%');
        expect(html).not.toContain('danno = 120');
        expect(html).toContain('+20%');
        const buffer = await Packer.toBuffer(buildRelazioneRiposiDoc(p, result));
        const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']);
        expect(xml).toContain('maggiorato del 20%');
        expect(xml).not.toContain('120% del valore');
    });
});

describe('con la tempestività ATTIVA i documenti cambiano dichiarazione', () => {
    // 9 turni consecutivi tra due riposi: il secondo settimanale arriva oltre 144h → 45h piene.
    const turno = (data: string): GiornataInput => ({ data, tipo: 'CEE', inizio: '6.00', termine: '15.00' });
    const giornateRitardo: GiornataInput[] = [
        turno('01/03/2023'),
        ...['04/03/2023', '05/03/2023', '06/03/2023', '07/03/2023', '08/03/2023', '09/03/2023', '10/03/2023', '11/03/2023', '12/03/2023'].map(turno),
        turno('15/03/2023'),
    ];
    const p = { ...basePratica, giornate: giornateRitardo };
    const r = computeRestViolations(giornateRitardo, { tariffaOraria: 10, soloCEE: true, termineRiposoSettimanale: 144 });
    const m = buildDocModel(p, r);

    it('nTiming rilevato → passo del metodo presente, esclusione prudenziale ASSENTE', () => {
        expect(m.nTiming).toBe(1);
        const passi = metodoMotorePassi(m, p, r).map((x) => x.lead + x.testo).join('\n');
        expect(passi).toContain('Tempestività del settimanale');
        const leads = riserveBullets(m, p, r).map((b) => b.lead).join('|');
        expect(leads).not.toContain('esclusione prudenziale');
        const div = divarioBullets(m, r).map((b) => b.lead);
        expect(div).not.toContain('Tempestività del settimanale');
    });
    it('la violazione di tempestività ha la causale giusta nei documenti', () => {
        const html = buildConteggiRiposiHtml(p, r);
        expect(html).toContain('Settimanale oltre il termine: 45h intere');
    });
});

describe('rivalutazione monetaria e interessi legali (nucleo + entrambi i documenti)', () => {
    // Scadenza FISSA per determinismo (le violazioni della fixture sono di fine 2023).
    const SCAD = '2024-10';
    const riv = buildRivalutazioneModel(basePratica, result, SCAD);

    it('modello: entrambe le serie rivalutate, capitali = capitali delle serie', () => {
        expect(riv.serieA).not.toBeNull();
        expect(riv.serieA!.totCapitale).toBe(35.5);       // 25,50 + 10,00 (fonte)
        expect(riv.serieB.totCapitale).toBe(result.totIndennita);
        expect(riv.scadenzaLabel).toBe('31/10/2024');
        expect(riv.scadenzaLimitata).toBe(false);
        // il totale rivalutato non è mai sotto il capitale
        expect(riv.serieA!.totale).toBeGreaterThan(riv.serieA!.totCapitale);
        expect(riv.serieB.totale).toBeGreaterThan(riv.serieB.totCapitale);
    });
    it('bullets: base normativa, indici con raccordi, tempo per tempo, avvertenza', () => {
        const txt = rivalutazioneBullets(riv).map((b) => b.lead + ' ' + b.testo).join('\n');
        expect(txt).toContain('art. 429, comma 3, c.p.c.');
        expect(txt).toContain('FOI');
        expect(txt).toContain('coefficienti di raccordo');
        expect(txt).toContain('tempo per tempo');
        expect(txt).toContain('NON si sommano');
        expect(txt).not.toContain('Ultimo indice disponibile'); // scadenza dentro la copertura
    });
    it('scadenza oltre l\'ultimo indice → dichiarata nei bullets', () => {
        const r2 = buildRivalutazioneModel(basePratica, result, '2099-12');
        expect(r2.scadenzaLimitata).toBe(true);
        const txt = rivalutazioneBullets(r2).map((b) => b.lead).join('|');
        expect(txt).toContain('Ultimo indice disponibile');
    });
    it('relazione .docx: cornice formale + sezione rivalutazione con i numeri', async () => {
        const buffer = await Packer.toBuffer(buildRelazioneRiposiDoc(basePratica, result, SCAD));
        const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']);
        for (const s of [
            'Oggetto', 'Premessa e incarico', 'Il/La sottoscritto/a', 'Luogo e data',
            'Rivalutazione monetaria e interessi legali', 'art. 429, comma 3, c.p.c.',
            'Analitico per annualità — serie B (motore Reg. 561/2006)',
            'Schema riepilogativo delle maggiorazioni (base 100)',
            'Straordinario festivo notturno', '150 (110 + 20 + 20)',
            'Conclusioni', 'Firma', '31/10/2024',
        ]) expect(xml).toContain(s);
    });
    it('conteggi stampabili: stessa sezione, stessi numeri', () => {
        const html = buildConteggiRiposiHtml(basePratica, result, SCAD);
        for (const s of [
            'Rivalutazione monetaria e interessi legali', 'art. 429, comma 3, c.p.c.',
            'Analitico per annualità — serie B (motore Reg. 561/2006)', '31/10/2024',
        ]) expect(html).toContain(s);
        // parità dei totali tra i due documenti: stesso nucleo, stessi importi
        expect(html).toContain(riv.serieB.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
    });
});

describe('qualificazione giuridica delle serie (sezione 7)', () => {
    it('presente in entrambi i documenti, neutra: descrive, non giudica', async () => {
        const html = buildConteggiRiposiHtml(basePratica, result);
        expect(html).toContain('Qualificazione delle due serie');
        expect(html).toContain('VIOLAZIONE del Reg. (CE) n. 561/2006');
        expect(html).toContain('D.Lgs. n. 66/2003');
        const buffer = await Packer.toBuffer(buildRelazioneRiposiDoc(basePratica, result));
        const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']);
        expect(xml).toContain('Qualificazione delle due serie');
        expect(xml).toContain('spetta al legale incaricato');
    });
});
