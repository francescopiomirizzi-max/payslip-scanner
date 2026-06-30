import { useState, useEffect, useCallback, useMemo } from 'react';
import type { VoceVertenza, PrescrizioneConfig } from '../utils/vertenzaEngine';

export type StatoVertenza = 'bozza' | 'in_corso' | 'pagata';

/** Etichette/colori dello stato (badge lista + dettaglio). Identità RAME dell'area,
 *  distinta dall'indaco dei Riposi e dallo smeraldo dell'Incidenza. */
export const STATO_META_VERTENZA: Record<StatoVertenza, { label: string; chip: string; dot: string }> = {
    bozza:    { label: 'Da impostare', chip: 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
    in_corso: { label: 'In corso',     chip: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
    pagata:   { label: 'Pagata',       chip: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

/** Una pratica della vertenza "indennità assenza residenza" = un Elior viaggiante. */
export interface PraticaVertenza {
    id: string;
    nome: string;
    cognome: string;
    eliorType?: string;
    periodoStart?: string;   // 'DD/MM/YYYY'
    periodoEnd?: string;
    voci: VoceVertenza[];
    prescrizione?: PrescrizioneConfig;
    /** Coefficiente sul valore della differenza (1 = pieno; 0.20 = criterio danno). */
    coefficiente?: number;
    stato: StatoVertenza;
    /** true = pratica didattica dal seed locale (non un lavoratore reale). */
    isSeed?: boolean;
    /** true = lavoratore reale ancora senza dati 4300/4305 estratti → «da impostare». */
    isPlaceholder?: boolean;
}

export type PraticaVertenzaUpdate = Partial<Pick<PraticaVertenza, 'stato' | 'coefficiente'>>;

/** Input minimale dei worker (evita l'accoppiamento col tipo Worker completo). */
export interface WorkerLike {
    id: string;
    nome: string;
    cognome: string;
    profilo?: string | null;
    eliorType?: string | null;
}

// Tariffe di riferimento dal ricorso (CCNL 2016): misura pagata vs misura piena.
// Default per i worker reali finché non si estraggono gli importi 4300/4305 dalle buste.
const VOCI_DEFAULT: VoceVertenza[] = [
    { codice: '4300', label: 'Ass. Res. No RS', tariffaPagata: 0.75, tariffaDovuta: 1.30, righe: [] },
    { codice: '4305', label: 'Ass. Res. RS',    tariffaPagata: 1.00, tariffaDovuta: 2.20, righe: [] },
];

const PRESCRIZIONE_DEFAULT: PrescrizioneConfig = {
    anni: 5,
    cutoff: '01/03/2024',
    interruzioni: [
        { data: '12/02/2018', nota: 'Comunicazione OO.SS.' },
        { data: '19/04/2023', nota: 'Comunicazione OO.SS.' },
    ],
};

const isEliorViaggiante = (w: WorkerLike) => w.profilo === 'ELIOR' && w.eliorType === 'viaggiante';

/** Worker reale → pratica scheletro «da impostare» (dati 4300/4305 ancora da estrarre). */
function workerToPlaceholder(w: WorkerLike): PraticaVertenza {
    return {
        id: w.id,
        nome: w.nome,
        cognome: w.cognome,
        eliorType: w.eliorType ?? 'viaggiante',
        periodoStart: '01/11/2017',
        periodoEnd: '31/07/2023',
        voci: VOCI_DEFAULT.map((v) => ({ ...v, righe: [] })),
        prescrizione: PRESCRIZIONE_DEFAULT,
        coefficiente: 1,
        stato: 'bozza',
        isPlaceholder: true,
    };
}

async function loadSeed(): Promise<PraticaVertenza[]> {
    try {
        const r = await fetch(`${import.meta.env.BASE_URL}elior-residenza-seed.json`);
        if (!r.ok) return [];
        const raw: any[] = await r.json();
        return raw.map((p, i) => ({
            id: `residenza-seed-${i}`,
            nome: p.nome ?? '',
            cognome: p.cognome ?? '',
            eliorType: 'viaggiante',
            periodoStart: p.periodoStart,
            periodoEnd: p.periodoEnd,
            voci: p.voci ?? [],
            prescrizione: p.prescrizione,
            coefficiente: p.coefficiente ?? 1,
            stato: 'in_corso' as StatoVertenza,
            isSeed: true,
        }));
    } catch {
        return [];
    }
}

/**
 * Pratiche dell'area "Indennità" (vertenza assenza residenza Elior viaggiante).
 *
 * La lista si AUTO-POPOLA dai worker `ELIOR/viaggiante` passati (uno per lavoratore),
 * più una pratica seed didattica con numeri mock per validare la UI finché non si
 * sbloccano i dati 4300/4305 reali del viaggiante (estrazione OCR, fuori scope ora).
 * Persistenza su `pratiche_vertenze` = follow-up (migration creata, non ancora applicata):
 * per ora stato/coefficiente vivono in memoria.
 */
export function usePraticheVertenze(workers: WorkerLike[]) {
    const [seed, setSeed] = useState<PraticaVertenza[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [overrides, setOverrides] = useState<Record<string, PraticaVertenzaUpdate>>({});

    useEffect(() => {
        let alive = true;
        (async () => {
            const s = await loadSeed();
            if (!alive) return;
            setSeed(s);
            setIsLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    const viaggianti = useMemo(
        () => workers.filter(isEliorViaggiante).map(workerToPlaceholder),
        [workers],
    );

    const pratiche = useMemo(() => {
        // Lavoratori reali prima, seed didattico in coda; gli override (stato/coeff)
        // applicati sopra entrambi.
        return [...viaggianti, ...seed].map((p) =>
            overrides[p.id] ? { ...p, ...overrides[p.id] } : p,
        );
    }, [viaggianti, seed, overrides]);

    /** Aggiorna stato/coefficiente in memoria (persistenza DB = follow-up). */
    const updatePratica = useCallback((id: string, fields: PraticaVertenzaUpdate) => {
        setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...fields } }));
    }, []);

    return { pratiche, isLoading, updatePratica };
}
