-- Migration 017: la bacheca `messages` diventa annunci di SISTEMA, inviati lato
-- amministrazione (service role) e non più dall'app.
--   * author_id diventa opzionale: i messaggi di sistema non hanno un utente autore.
--   * niente più policy di scrittura: la tabella è sola lettura per gli utenti
--     autenticati (resta solo la SELECT aperta); le INSERT/UPDATE/DELETE avvengono
--     solo via service role (bypassa RLS).

ALTER TABLE public.messages ALTER COLUMN author_id DROP NOT NULL;

DROP POLICY IF EXISTS "messages_insert_author" ON public.messages;
DROP POLICY IF EXISTS "messages_update_author" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_author" ON public.messages;
