import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export interface MessageRecord {
  id: string;
  title: string;
  body: string;
  created_at: string;
  /** NULL = comunicazione generica; 'buste_mancanti' = sezione dedicata in evidenza. */
  category: string | null;
}

/** Categoria degli annunci "in evidenza" (sezione dedicata + persistente). */
export const CATEGORY_BUSTE_MANCANTI = 'buste_mancanti';

const LAST_SEEN_KEY = 'messages_last_seen_at';

/**
 * Bacheca annunci di SISTEMA (sola lettura lato client). I messaggi vengono
 * pubblicati dall'amministrazione via service role (deploy grossi, manutenzione,
 * indisponibilità) — l'app li LEGGE soltanto. RLS migration 016/017: SELECT
 * aperto agli autenticati, nessuna scrittura concessa agli utenti.
 */
export const useMessages = () => {
  const listMessages = useCallback(async (): Promise<MessageRecord[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, title, body, created_at, category')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('listMessages', error);
      return [];
    }
    return data ?? [];
  }, []);

  return { listMessages };
};

/**
 * Conteggio dei messaggi "non letti" per il badge dell'header. Lo stato letto è
 * locale al dispositivo (localStorage): nessuna scrittura sul DB. Un messaggio è
 * non letto se creato dopo l'ultimo accesso alla bacheca.
 * `enabled` evita la query quando il pulsante non è mostrato (es. account owner).
 */
export const useUnreadMessages = (enabled: boolean = true) => {
  const { listMessages } = useMessages();
  const [unreadMessages, setUnreadMessages] = useState<MessageRecord[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) { setUnreadMessages([]); return; }
    const msgs = await listMessages();
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    const lastSeenT = lastSeen ? Date.parse(lastSeen) : 0;
    setUnreadMessages(msgs.filter(m => Date.parse(m.created_at) > lastSeenT));
  }, [enabled, listMessages]);

  useEffect(() => { refresh(); }, [refresh]);

  const markAllRead = useCallback(() => {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setUnreadMessages([]);
  }, []);

  return { unread: unreadMessages.length, unreadMessages, refresh, markAllRead };
};
