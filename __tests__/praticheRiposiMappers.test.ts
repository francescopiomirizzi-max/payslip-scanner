import { describe, it, expect } from 'vitest';
import { dbToPratica, praticaToDb, type PraticaRiposi } from '../hooks/usePraticheRiposi';

const row = {
    id: 'abc-123',
    owner_id: 'utente-1',
    nome: 'Tommaso',
    cognome: 'Viterbo',
    azienda: null,
    mansione: 'Operatore di esercizio (TPL)',
    periodo_start: '2011-01-01',
    periodo_end: '2024-09-30',
    tariffa_oraria: '10.03', // numeric di Postgres arriva come stringa
    fonte_tariffa: 'placeholder',
    giornate: [{ data: '01/01/2011', servizio: 'R' }],
    stato: 'pagata',
    data_apertura: '2026-06-01',
    data_chiusura: '2026-06-10',
    data_pagamento: '2026-06-12',
    importo_riconosciuto: '1500.50',
    created_at: '2026-06-12T10:00:00Z',
};

describe('dbToPratica', () => {
    const p = dbToPratica(row);

    it('date periodo in DD/MM/YYYY (come il seed e la UI)', () => {
        expect(p.periodoStart).toBe('01/01/2011');
        expect(p.periodoEnd).toBe('30/09/2024');
    });

    it('numerici di Postgres convertiti in numeri veri', () => {
        expect(p.tariffaOraria).toBe(10.03);
        expect(p.importoRiconosciuto).toBe(1500.5);
    });

    it('stato e date di gestione', () => {
        expect(p.stato).toBe('pagata');
        expect(p.dataChiusura).toBe('2026-06-10');
        expect(p.dataPagamento).toBe('2026-06-12');
    });

    it('default robusti', () => {
        const vuota = dbToPratica({ id: 'x', giornate: null });
        expect(vuota.stato).toBe('in_corso');
        expect(vuota.giornate).toEqual([]);
        expect(vuota.importoRiconosciuto).toBeUndefined();
    });
});

describe('praticaToDb', () => {
    const pratica: PraticaRiposi = {
        id: 'viterbo-seed',
        nome: 'Tommaso',
        cognome: 'Viterbo',
        mansione: 'Operatore di esercizio (TPL)',
        periodoStart: '01/01/2011',
        periodoEnd: '30/09/2024',
        tariffaOraria: 10.03,
        giornate: [{ data: '01/01/2011', servizio: 'R' }],
        stato: 'in_corso',
        isSeed: true,
    };
    const db = praticaToDb(pratica);

    it('niente id/owner_id/isSeed: li gestisce il DB', () => {
        expect(db).not.toHaveProperty('id');
        expect(db).not.toHaveProperty('owner_id');
        expect(db).not.toHaveProperty('is_seed');
    });

    it('date periodo in ISO per le colonne date', () => {
        expect(db.periodo_start).toBe('2011-01-01');
        expect(db.periodo_end).toBe('2024-09-30');
    });

    it('round-trip senza perdite sui campi di dominio', () => {
        const back = dbToPratica({ ...db, id: 'nuovo-id' });
        expect(back.periodoStart).toBe(pratica.periodoStart);
        expect(back.periodoEnd).toBe(pratica.periodoEnd);
        expect(back.tariffaOraria).toBe(pratica.tariffaOraria);
        expect(back.giornate).toEqual(pratica.giornate);
        expect(back.stato).toBe('in_corso');
        expect(back.isSeed).toBeUndefined();
    });
});
