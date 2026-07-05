import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { IS_DEMO } from '../config/demo';
import type { OrganizzazioneInfo } from '../components/SindacatiDashboard';
import type { AppArea } from '../components/AreaSwitch';

// Le sezioni dipendono dal TIPO di organizzazione: i sindacati hanno le 3 aree
// vertenze; i CAF (fiscale: 730/ISEE/redditi) avranno le loro — oggi nessuna.
const SEZIONI_PER_TIPO: Record<'sindacato' | 'caf', AppArea[]> = {
    sindacato: ['incidenza', 'riposi', 'indennita'],
    caf: [],
};

// Fallback client (demo, o errore/tabella vuota): la sola FAST-CONFSAL, com'era
// prima della migration 022. Fail-open: un blip di rete non deve lasciare la
// dashboard senza organizzazioni.
const FALLBACK: OrganizzazioneInfo[] = [
    { id: 'fast-confsal', nome: 'FAST-CONFSAL', tipo: 'sindacato', logo: '/logos/fast-confsal.png', sezioni: SEZIONI_PER_TIPO.sindacato },
];

interface SindacatoRow {
    id: string;
    nome: string;
    tipo: 'sindacato' | 'caf';
    logo_url: string | null;
}

const rowToOrganizzazione = (s: SindacatoRow): OrganizzazioneInfo => ({
    id: s.id,
    nome: s.nome,
    tipo: s.tipo,
    logo: s.logo_url ? `/${s.logo_url.replace(/^\/+/, '')}` : '',
    sezioni: SEZIONI_PER_TIPO[s.tipo] ?? [],
});

/**
 * Organizzazioni committenti (tabella `sindacati`, migration 022) per la
 * dashboard di selezione. Sola lettura: la gestione (crea/modifica) è rimandata
 * a quando arriveranno organizzazioni oltre FAST-CONFSAL. Niente filtro client
 * su owner_id: le RLS limitano già la visibilità (owner + viewer autorizzato).
 */
export const useSindacati = () => {
    const [organizzazioni, setOrganizzazioni] = useState<OrganizzazioneInfo[]>(IS_DEMO ? FALLBACK : []);
    const [isLoading, setIsLoading] = useState(!IS_DEMO);
    const loadedUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (IS_DEMO) return; // demo: dati fissi, nessuna chiamata Supabase

        const load = async (userId: string) => {
            if (loadedUserIdRef.current === userId) return; // anti double-fire (getSession + onAuthStateChange)
            loadedUserIdRef.current = userId;
            const { data, error } = await supabase
                .from('sindacati')
                .select('id, nome, tipo, logo_url')
                .order('created_at', { ascending: true });
            if (error || !data || data.length === 0) {
                if (error) console.error('useSindacati', error);
                setOrganizzazioni(FALLBACK);
            } else {
                setOrganizzazioni((data as SindacatoRow[]).map(rowToOrganizzazione));
            }
            setIsLoading(false);
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) load(session.user.id);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            if (session?.user) load(session.user.id);
            else loadedUserIdRef.current = null; // logout: al prossimo login si ricarica
        });
        return () => subscription.unsubscribe();
    }, []);

    return { organizzazioni, isLoading };
};
