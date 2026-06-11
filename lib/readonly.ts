import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Account autorizzati alla sola consultazione: vedono i dati di tutti gli owner
// ma non devono modificare/creare/cancellare. Le RLS sul DB rifiutano comunque
// le scritture; qui nascondiamo i bottoni di azione lato UI per pulizia e per
// evitare di scatenare chiamate Gemini sprecate (la function scan-payslip
// risponde prima che il client capisca che la INSERT poi fallirebbe).
//
// Per aggiungere altri viewer in futuro: estendere questa lista; oltre i 2-3
// passare a una funzione SQL is_readonly_viewer() invece di hardcodare UID.
export const READONLY_VIEWER_UIDS = new Set<string>([
  '34967593-6447-45fd-a303-13ec842c7b9e', // vincenzocataneofg@gmail.com
]);

// Nome da mostrare accanto al chip "Sola consultazione" della dashboard:
// chi è collegato deve vedere a colpo d'occhio CON QUALE account sta guardando.
export const READONLY_VIEWER_NAMES: Record<string, string> = {
  '34967593-6447-45fd-a303-13ec842c7b9e': 'Vincenzo Cataneo',
};

/** Nome del viewer readonly collegato, o null se l'utente non è un viewer. */
export function useReadOnlyViewerName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const update = (uid: string | undefined) =>
      setName(uid ? READONLY_VIEWER_NAMES[uid] ?? null : null);

    supabase.auth.getSession().then(({ data }) => update(data.session?.user.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => update(session?.user.id),
    );
    return () => subscription.unsubscribe();
  }, []);

  return name;
}

export function useIsReadOnly(): boolean {
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    const update = (uid: string | undefined) =>
      setIsReadOnly(!!uid && READONLY_VIEWER_UIDS.has(uid));

    supabase.auth.getSession().then(({ data }) => update(data.session?.user.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => update(session?.user.id),
    );
    return () => subscription.unsubscribe();
  }, []);

  return isReadOnly;
}
