import { describe, it, expect } from 'vitest';
import {
    valorizzazioneInfo, coeffSuffix, buildDocModel,
    divarioBullets, riserveBullets, metodoMotorePassi, tariffaSpiegazione,
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
        expect(leads).toContain('Granularità del settimanale');
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
