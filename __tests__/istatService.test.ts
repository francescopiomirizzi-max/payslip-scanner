import { describe, it, expect } from 'vitest';
import { LEGAL_INTEREST_RATES, FOI_ANNUAL_INDICES, calculateLegalInterestsAndRevaluation } from '../istatService';

// Guardrail contro i dati stale del motore Incidenze (fix 12/07/2026: il tasso 2025
// era rimasto al 2,50 "provvisorio" e il 2026 mancava del tutto → fallback silenziosi
// a valori sbagliati). Il test di copertura FALLIRÀ di proposito all'inizio di ogni
// nuovo anno finché le due tabelle non vengono aggiornate con i valori ufficiali.

describe('istatService — dati ufficiali', () => {
    it('tassi legali verificati sui DM: 2025 = 2,00% · 2026 = 1,60%', () => {
        expect(LEGAL_INTEREST_RATES[2025]).toBe(2.0);
        expect(LEGAL_INTEREST_RATES[2026]).toBe(1.6);
    });
    it('copertura completa dal 2007 all\'anno corrente: nessun fallback silenzioso', () => {
        const annoCorrente = new Date().getFullYear();
        for (let y = 2007; y <= annoCorrente; y++) {
            expect(LEGAL_INTEREST_RATES[y], `tasso legale mancante per il ${y}`).toBeGreaterThan(0);
            expect(FOI_ANNUAL_INDICES[y], `indice FOI mancante per il ${y}`).toBeGreaterThan(0);
        }
    });
    it('la rivalutazione a oggi non è ferma a un indice passato', () => {
        const annoCorrente = new Date().getFullYear();
        // l'indice dell'anno corrente deve essere ≥ di quello di due anni fa (serie crescente
        // negli ultimi anni): se il fallback stale tornasse, questo scatta
        expect(FOI_ANNUAL_INDICES[annoCorrente]).toBeGreaterThanOrEqual(FOI_ANNUAL_INDICES[annoCorrente - 2]);
        const r = calculateLegalInterestsAndRevaluation(1000, annoCorrente - 2);
        expect(r.rivalutazione).toBeGreaterThan(0);
        expect(r.totaleDovuto).toBeGreaterThan(r.capitaleRivalutato);
    });
});
