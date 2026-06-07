import { useState, useEffect } from 'react';
import type { GiornataInput } from '../utils/restEngine';

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
    giornate: GiornataInput[];
}

/**
 * Carica le pratiche dell'area Turni & Riposi.
 *
 * FASE ATTUALE (scaffold): seed locale di Viterbo dai dati grezzi dell'Excel,
 * servito da `public/viterbo-seed.json` (gitignored, dati personali). Serve a
 * mostrare il cruscotto con dati VERI senza dipendere dalla migration.
 *
 * FASE 2 (col PDF): qui andrà il fetch da Supabase `pratiche_riposi` (mirror di
 * useWorkers), con l'estrazione Gemini a popolare le giornate. Il seed sparisce.
 */
export function usePraticheRiposi() {
    const [pratiche, setPratiche] = useState<PraticaRiposi[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        fetch(`${import.meta.env.BASE_URL}viterbo-seed.json`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((giornate: GiornataInput[]) => {
                if (!alive) return;
                const date = giornate.map((g) => g.data).filter(Boolean);
                setPratiche([
                    {
                        id: 'viterbo-seed',
                        nome: 'Tommaso',
                        cognome: 'Viterbo',
                        mansione: 'Operatore di esercizio (TPL)',
                        periodoStart: date[0],
                        periodoEnd: date[date.length - 1],
                        tariffaOraria: 10.03,
                        fonteTariffa: 'placeholder — da confermare con l\'avvocato',
                        giornate,
                    },
                ]);
            })
            .catch(() => { if (alive) setPratiche([]); })
            .finally(() => { if (alive) setIsLoading(false); });
        return () => { alive = false; };
    }, []);

    return { pratiche, isLoading };
}
