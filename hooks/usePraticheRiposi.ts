import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { GiornataInput } from '../utils/restEngine';
import { matchesSindacato, sindacatoIdPerScrittura } from '../utils/sindacatoScope';

export type StatoPratica = 'in_corso' | 'conclusa' | 'pagata';

/** Etichette/colori dello stato (badge lista + controllo dettaglio): qui per
 *  evitare l'import circolare RiposiArea ⇄ RiposiPraticaDetail. */
export const STATO_META: Record<StatoPratica, { label: string; chip: string; dot: string }> = {
    in_corso: { label: 'In corso', chip: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
    conclusa: { label: 'Conclusa', chip: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    pagata:   { label: 'Pagata',   chip: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
};

/** Una "pratica" dell'area Turni & Riposi: un autista con il suo prospetto turni. */
export interface PraticaRiposi {
    id: string;
    nome: string;
    cognome: string;
    azienda?: string;
    mansione?: string;
    periodoStart?: string;   // 'DD/MM/YYYY'
    periodoEnd?: string;
    tariffaOraria: number;
    fonteTariffa?: string;
    /** Override tariffa €/h per anno ('YYYY'→€/h). Se assente, i consumatori la
     *  ricavano dalla fonte con `deriveTariffePerAnno`. Non ancora persistito su DB
     *  (follow-up: colonna `tariffe_per_anno` + editor quando arriva la tabella CCNL). */
    tariffePerAnno?: Record<string, number>;
    /** Coefficiente danno sul valore del riposo perso (default 1 = valore pieno).
     *  Metodo avvocato «danno = 20% del valore» → 0.20. Non ancora persistito su DB
     *  (follow-up con `tariffe_per_anno`). Vedi `RestParams.coefficiente`. */
    coefficiente?: number;
    giornate: GiornataInput[];
    /** Organizzazione committente (`sindacati`, migration 022). Assente = legacy,
     *  visibile in ogni organizzazione (fail-open, vedi utils/sindacatoScope). */
    sindacatoId?: string;
    // Gestione pratica (fase 3)
    stato: StatoPratica;
    dataApertura?: string;   // 'YYYY-MM-DD' (come arrivano dal DB)
    dataChiusura?: string;
    dataPagamento?: string;
    importoRiconosciuto?: number;
    /** true = caricata dal seed locale, NON ancora nell'archivio Supabase. */
    isSeed?: boolean;
}

/** Campi di gestione aggiornabili dal dettaglio. */
export type PraticaRiposiUpdate = Partial<Pick<PraticaRiposi,
    'stato' | 'dataApertura' | 'dataChiusura' | 'dataPagamento' | 'importoRiconosciuto' | 'tariffaOraria' | 'fonteTariffa' | 'coefficiente' | 'tariffePerAnno'
>>;

// ─── Mappers (esportati per i test) ──────────────────────────────────────────

const isoToDmy = (iso?: string | null): string | undefined => {
    if (!iso) return undefined;
    const [y, m, d] = iso.slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : undefined;
};
const dmyToIso = (dmy?: string): string | null => {
    if (!dmy) return null;
    const [d, m, y] = dmy.trim().split(/[\/\-.]/);
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null;
};

export function dbToPratica(row: any): PraticaRiposi {
    return {
        id: row.id,
        nome: row.nome ?? '',
        cognome: row.cognome ?? '',
        azienda: row.azienda ?? undefined,
        mansione: row.mansione ?? undefined,
        periodoStart: isoToDmy(row.periodo_start),
        periodoEnd: isoToDmy(row.periodo_end),
        tariffaOraria: Number(row.tariffa_oraria ?? 0),
        fonteTariffa: row.fonte_tariffa ?? undefined,
        tariffePerAnno: row.tariffe_per_anno ?? undefined,
        coefficiente: row.coefficiente != null ? Number(row.coefficiente) : undefined,
        giornate: row.giornate ?? [],
        sindacatoId: row.sindacato_id ?? undefined,
        stato: row.stato ?? 'in_corso',
        dataApertura: row.data_apertura ?? undefined,
        dataChiusura: row.data_chiusura ?? undefined,
        dataPagamento: row.data_pagamento ?? undefined,
        importoRiconosciuto: row.importo_riconosciuto != null ? Number(row.importo_riconosciuto) : undefined,
    };
}

export function praticaToDb(p: PraticaRiposi): Record<string, unknown> {
    // Niente id/owner_id: li genera il DB (owner_id DEFAULT auth.uid()).
    return {
        nome: p.nome,
        cognome: p.cognome,
        azienda: p.azienda ?? null,
        mansione: p.mansione ?? null,
        periodo_start: dmyToIso(p.periodoStart),
        periodo_end: dmyToIso(p.periodoEnd),
        tariffa_oraria: p.tariffaOraria,
        fonte_tariffa: p.fonteTariffa ?? null,
        tariffe_per_anno: p.tariffePerAnno ?? null,
        coefficiente: p.coefficiente ?? null,
        giornate: p.giornate,
        // Chiave scritta solo se presente (coerente con workerToDb: mai azzerare
        // dal client un collegamento fatto su DB).
        ...(p.sindacatoId !== undefined ? { sindacato_id: p.sindacatoId } : {}),
        stato: p.stato,
        data_apertura: p.dataApertura ?? null,
        data_chiusura: p.dataChiusura ?? null,
        data_pagamento: p.dataPagamento ?? null,
        importo_riconosciuto: p.importoRiconosciuto ?? null,
    };
}

const updateToDb = (u: PraticaRiposiUpdate): Record<string, unknown> => {
    const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('stato' in u) out.stato = u.stato;
    if ('dataApertura' in u) out.data_apertura = u.dataApertura ?? null;
    if ('dataChiusura' in u) out.data_chiusura = u.dataChiusura ?? null;
    if ('dataPagamento' in u) out.data_pagamento = u.dataPagamento ?? null;
    if ('importoRiconosciuto' in u) out.importo_riconosciuto = u.importoRiconosciuto ?? null;
    if ('tariffaOraria' in u) out.tariffa_oraria = u.tariffaOraria;
    if ('fonteTariffa' in u) out.fonte_tariffa = u.fonteTariffa ?? null;
    if ('coefficiente' in u) out.coefficiente = u.coefficiente ?? null;
    if ('tariffePerAnno' in u) out.tariffe_per_anno = u.tariffePerAnno ?? null;
    return out;
};

// ─── Seed locale (fallback finché la pratica non è in archivio) ───────────────

async function loadSeed(): Promise<PraticaRiposi[]> {
    try {
        const r = await fetch(`${import.meta.env.BASE_URL}viterbo-seed.json`);
        if (!r.ok) return [];
        const giornate: GiornataInput[] = await r.json();
        const date = giornate.map((g) => g.data).filter(Boolean);
        return [{
            id: 'viterbo-seed',
            nome: 'Tommaso',
            cognome: 'Viterbo',
            mansione: 'Operatore di esercizio (TPL)',
            periodoStart: date[0],
            periodoEnd: date[date.length - 1],
            tariffaOraria: 10.03,
            fonteTariffa: 'ricavata per anno dal documento sorgente (cresce per anzianità di servizio)',
            coefficiente: 0.2, // danno = 20% del valore (metodo confermato dall'avvocato)
            giornate,
            stato: 'in_corso',
            isSeed: true,
        }];
    } catch {
        return [];
    }
}

/**
 * Pratiche dell'area Turni & Riposi su Supabase (`pratiche_riposi`, RLS owner-scoped).
 *
 * Il seed locale di Viterbo resta come FALLBACK quando l'archivio dell'utente è
 * vuoto, marcato `isSeed`: si salva nell'archivio SOLO con l'azione esplicita
 * `salvaInArchivio` (mai auto-insert: un account viewer non deve clonarsi la
 * pratica al primo accesso).
 */
export function usePraticheRiposi(sindacatoAttivo: string | null = null) {
    const [pratiche, setPratiche] = useState<PraticaRiposi[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data, error } = await supabase
                .from('pratiche_riposi')
                .select('*')
                .order('created_at', { ascending: true });
            if (!alive) return;
            const list = (!error && data && data.length > 0)
                ? data.map(dbToPratica)
                // archivio vuoto (o non raggiungibile) → seed locale come fallback
                : await loadSeed();
            if (!alive) return;
            setPratiche(list);
            setIsLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    /** Salva una pratica-seed nell'archivio Supabase; restituisce la riga vera. */
    const salvaInArchivio = useCallback(async (pratica: PraticaRiposi): Promise<PraticaRiposi | null> => {
        const { data, error } = await supabase
            .from('pratiche_riposi')
            // Nuova riga → organizzazione attiva (solo se reale, mai la sentinella).
            .insert(praticaToDb({ ...pratica, sindacatoId: pratica.sindacatoId ?? sindacatoIdPerScrittura(sindacatoAttivo) }))
            .select()
            .single();
        if (error || !data) {
            console.error('[riposi] salvataggio in archivio fallito:', error);
            return null;
        }
        const salvata = dbToPratica(data);
        setPratiche((prev) => prev.map((p) => (p.id === pratica.id ? salvata : p)));
        return salvata;
    }, [sindacatoAttivo]);

    /** Aggiorna i campi di gestione (stato, date, importo, tariffa). Ottimistico. */
    const updatePratica = useCallback(async (id: string, fields: PraticaRiposiUpdate): Promise<boolean> => {
        setPratiche((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
        const { error } = await supabase
            .from('pratiche_riposi')
            .update(updateToDb(fields))
            .eq('id', id);
        if (error) console.error('[riposi] update pratica fallito:', error);
        return !error;
    }, []);

    // Vista scopata sull'organizzazione attiva (fail-open: seed e righe legacy
    // senza sindacato_id restano visibili). Lo stato interno resta completo.
    const visibili = pratiche.filter((p) => matchesSindacato(p.sindacatoId, sindacatoAttivo));

    return { pratiche: visibili, isLoading, salvaInArchivio, updatePratica };
}
