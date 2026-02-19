
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials mancanti in .env.local');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');


// --- INTERFACCE ---
export interface ScanSession {
    id: string; // UUID
    created_at: string;
    status: 'pending' | 'scanning' | 'completed' | 'error';
    data?: any; // Il JSON della busta paga
}

// --- FUNZIONI HELPER ---
// 1. Crea una sessione univoca (chiamata dal Desktop)
export const createScanSession = async (sessionId: string) => {
    const { error } = await supabase
        .from('scan_sessions')
        .insert([{ id: sessionId, status: 'pending' }]);

    if (error) console.error("Errore creazione sessione:", error);
    return { error };
};

// 2. Aggiorna la sessione con i dati (chiamata dal Mobile)
export const updateScanSession = async (sessionId: string, data: any) => {
    const { error } = await supabase
        .from('scan_sessions')
        .update({ status: 'completed', data: data })
        .eq('id', sessionId);

    if (error) console.error("Errore update sessione:", error);
    return { error };
};
