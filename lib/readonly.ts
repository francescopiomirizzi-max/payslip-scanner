import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { IS_DEMO } from '../config/demo';

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
    if (IS_DEMO) return; // demo: nessun viewer, nessuna sessione Supabase
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
    if (IS_DEMO) return; // demo: mai readonly
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

/**
 * Il viewer in sola consultazione può esportare/stampare SOLTANTO le pratiche
 * già "pagate" (buste: status 'chiusa'; riposi: stato 'pagata'). L'owner sempre.
 * Usato per gateare i bottoni di download/stampa per-pratica: vede tutto, scarica
 * solo il pagato.
 */
export const canExportForViewer = (isReadOnly: boolean, isPaid: boolean): boolean =>
  !isReadOnly || isPaid;

export interface ViewerPaymentBlockState {
  loading: boolean;
  blocked: boolean;
  amount: number;
}

/**
 * Avviso di pagamento BLOCCANTE per il viewer readonly.
 *
 * Legge il flag dalla riga singola `app_settings` (id=1). Per l'owner e per
 * chiunque non sia un viewer ritorna subito `blocked: false`. Fail-open: in caso
 * di errore/rete NON blocca — il blocco è una leva commerciale, non un firewall,
 * e un blip di rete non deve chiudere fuori il viewer per sbaglio. Lo spegnimento
 * (owner che salda) avviene via UPDATE su `app_settings`; il viewer lo recepisce
 * al successivo accesso/refresh.
 */
export function useViewerPaymentBlock(): ViewerPaymentBlockState {
  const [state, setState] = useState<ViewerPaymentBlockState>({
    loading: !IS_DEMO, blocked: false, amount: 750,
  });

  useEffect(() => {
    if (IS_DEMO) return; // demo: nessun blocco pagamento, niente Supabase
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || !READONLY_VIEWER_UIDS.has(uid)) {
        if (alive) setState({ loading: false, blocked: false, amount: 750 });
        return;
      }
      const { data, error } = await supabase
        .from('app_settings')
        .select('viewer_payment_block, payment_amount_eur')
        .eq('id', 1)
        .maybeSingle();
      if (!alive) return;
      if (error || !data) {
        setState({ loading: false, blocked: false, amount: 750 });
        return;
      }
      setState({
        loading: false,
        blocked: !!data.viewer_payment_block,
        amount: data.payment_amount_eur ?? 750,
      });
    })();
    return () => { alive = false; };
  }, []);

  return state;
}
