import { describe, it, expect } from 'vitest';
import { buildVerifyPrompt, normalizeVerifyResponse } from '../netlify/functions/verify-payslip';

describe('normalizeVerifyResponse', () => {
    it('lascia passare uno status valido', () => {
        expect(normalizeVerifyResponse({ status: 'success', discrepancies: [] }).status).toBe('success');
        expect(normalizeVerifyResponse({ status: 'error', discrepancies: [] }).status).toBe('error');
    });

    it('ripiega su "warning" per status mancante o non valido', () => {
        expect(normalizeVerifyResponse({ discrepancies: [] }).status).toBe('warning');
        expect(normalizeVerifyResponse({ status: 'boh', discrepancies: [] }).status).toBe('warning');
    });

    it('ritorna [] se discrepancies non è un array', () => {
        expect(normalizeVerifyResponse({ status: 'error', discrepancies: 'nope' as any }).discrepancies).toEqual([]);
        expect(normalizeVerifyResponse({ status: 'error' }).discrepancies).toEqual([]);
    });

    it('scarta le discrepanze malformate (senza field o non oggetti)', () => {
        const { discrepancies } = normalizeVerifyResponse({
            status: 'error',
            discrepancies: [
                { field: '1801', extracted: 0, suggested: 57.6, message: 'ok' },
                { extracted: 1, suggested: 2 },        // niente field → scartata
                null,                                   // non oggetto → scartata
                'stringa',                              // non oggetto → scartata
            ],
        });
        expect(discrepancies).toHaveLength(1);
        expect(discrepancies[0].field).toBe('1801');
    });

    it('forza i numeri e di default mette 0', () => {
        const { discrepancies } = normalizeVerifyResponse({
            status: 'warning',
            discrepancies: [{ field: 'daysWorked', extracted: '26', suggested: '19', message: 'x' }],
        });
        expect(discrepancies[0].extracted).toBe(26);
        expect(discrepancies[0].suggested).toBe(19);

        const { discrepancies: d2 } = normalizeVerifyResponse({
            status: 'warning',
            discrepancies: [{ field: 'ticket' }],
        });
        expect(d2[0].extracted).toBe(0);
        expect(d2[0].suggested).toBe(0);
    });

    it('genera un message di fallback quando manca o non è stringa', () => {
        const { discrepancies } = normalizeVerifyResponse({
            status: 'error',
            discrepancies: [{ field: '5000', extracted: 0, suggested: 2.4 }],
        });
        expect(discrepancies[0].message).toContain('5000');
        expect(typeof discrepancies[0].message).toBe('string');
    });

    it('converte le stringhe decimali con il punto ma produce NaN con la virgola', () => {
        // ⚠️ COMPORTAMENTO ATTUALE (possibile bug): Number("12,34") non gestisce il formato italiano.
        const { discrepancies } = normalizeVerifyResponse({
            status: 'warning',
            discrepancies: [{ field: 'ticket', extracted: '12.34', suggested: '12,34', message: 'x' }],
        });
        expect(discrepancies[0].extracted).toBe(12.34);
        expect(discrepancies[0].suggested).toBeNaN();
    });

    it('ignora expected, found, severity e gli altri campi extra', () => {
        // ⚠️ COMPORTAMENTO ATTUALE (possibile bug): expected/found non sono alias di extracted/suggested.
        const { discrepancies } = normalizeVerifyResponse({
            status: 'error',
            discrepancies: [{
                field: 'daysWorked',
                expected: '12.34',
                found: '12,34',
                severity: 'high',
                detail: 'extra',
                message: 'valori discordanti',
            }],
        });
        expect(discrepancies[0]).toEqual({
            field: 'daysWorked',
            extracted: 0,
            suggested: 0,
            message: 'valori discordanti',
        });
    });
});

describe('buildVerifyPrompt — selezione regole aziendali', () => {
    it('ELIOR magazzino usa il codice ticket 0293', () => {
        const p = buildVerifyPrompt('ELIOR', 'magazzino');
        expect(p).toContain('0293');
        expect(p).toContain('ELIOR');
    });

    it('ELIOR tavola (default) usa i codici ticket 2000/2001', () => {
        const p = buildVerifyPrompt('ELIOR');
        expect(p).toContain('2000 o 2001');
    });

    it('RFI include l\'avviso critico RIPOSI ≠ GIORNI LAVORATI', () => {
        const p = buildVerifyPrompt('RFI');
        expect(p).toContain('RIPOSI');
        expect(p).toContain('daysPaidLeave');
    });

    it('CLEAN_SERVICE cita il CCNL Multiservizi', () => {
        expect(buildVerifyPrompt('CLEAN_SERVICE')).toContain('Multiservizi');
    });

    it('MERCITALIA cita il framework ADP', () => {
        expect(buildVerifyPrompt('MERCITALIA')).toContain('ADP');
    });

    it('FSE usa i giorni della voce presenza e la regola ferie ÷ 6,5', () => {
        const p = buildVerifyPrompt('FSE');
        expect(p).toContain('ZUCCHETTI');
        expect(p).toContain('I86178');       // voce presenza = contatore giorni
        expect(p).toContain('÷ 6,5');        // ferie F2105 in ore
        expect(p).toContain('fse_minimo');   // voci fisse dal box testata
    });

    it('FSE include le regole dell\'era storica SPA-GUIDA', () => {
        const p = buildVerifyPrompt('FSE');
        expect(p).toContain('ERA STORICA SPA-GUIDA (set 2010 - giu 2017)');
        expect(p).toContain('daysWorked = valore "Presenze" della banda dei totali in testata');
        expect(p).toContain('029 (Art. 5A)');
        expect(p).toContain('094 (Art. 5/B)');
        expect(p).toContain('300/301/303/306/307');
        expect(p).toMatch(/ESCLUSI di proposito[\s\S]*663 \(in[\s\S]*né importo né giorni/);
    });

    it('FSE era Zucchetti elenca le voci di prestazione del set nuovo', () => {
        const p = buildVerifyPrompt('FSE');
        for (const code of ['I86178/I86005/IX0023', 'I85210/IX0046', 'I86161', 'I86110', 'V12001']) {
            expect(p).toContain(code);
        }
        expect(p).toContain('importo dalla colonna "COMPETENZE"');
    });

    it('azienda sconosciuta ricade sulle regole generiche', () => {
        expect(buildVerifyPrompt('PIPPO_SPA')).toContain('PIPPO_SPA');
    });

    it('è case-insensitive sul nome azienda', () => {
        expect(buildVerifyPrompt('elior', 'magazzino')).toContain('0293');
    });

    it('include sempre la Regola Globale TFR', () => {
        for (const co of ['ELIOR', 'RFI', 'CLEAN_SERVICE', 'MERCITALIA', 'FSE', 'CUSTOM']) {
            expect(buildVerifyPrompt(co)).toContain('REGOLA GLOBALE TFR');
        }
    });

    it('incorpora la checklist dei codici indennità custom', () => {
        const p = buildVerifyPrompt('RFI', undefined, [
            { id: '1801', label: 'Indennità di linea' },
            { id: '3E10', label: 'Premio' },
        ]);
        expect(p).toContain('1801 (Indennità di linea)');
        expect(p).toContain('3E10 (Premio)');
        expect(p).toContain('SOLO questi codici');
    });

    it('tratta customColumns vuoto come customColumns non definito', () => {
        const withEmptyColumns = buildVerifyPrompt('RFI', undefined, []);
        const withoutColumns = buildVerifyPrompt('RFI', undefined, undefined);
        expect(withEmptyColumns).toBe(withoutColumns);
        expect(withEmptyColumns).not.toContain('Questa azienda prevede SOLO questi codici indennità');
    });
});
