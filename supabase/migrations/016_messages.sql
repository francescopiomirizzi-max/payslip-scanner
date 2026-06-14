-- Migration 016: bacheca annunci `messages` (one-way: owner -> viewer).
--
-- Il proprietario (account principale) pubblica annunci/aggiornamenti; gli account
-- in sola consultazione (es. Vincenzo) li LEGGONO. Lo stato "letto" è tenuto sul
-- dispositivo del viewer (localStorage), così il suo account resta sola-lettura sul DB
-- (nessuna scrittura richiesta per leggere o marcare come letto).
--
-- RLS: SELECT aperto a tutti gli autenticati (gli annunci sono pensati per essere
-- letti dai viewer); scrittura/cancellazione solo all'autore (owner-scoped come 013).

CREATE TABLE IF NOT EXISTS public.messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title       text NOT NULL DEFAULT '',
    body        text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_all" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_author" ON public.messages;
DROP POLICY IF EXISTS "messages_update_author" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_author" ON public.messages;

CREATE POLICY "messages_select_all"
    ON public.messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "messages_insert_author"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (author_id = auth.uid());

CREATE POLICY "messages_update_author"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

CREATE POLICY "messages_delete_author"
    ON public.messages FOR DELETE
    TO authenticated
    USING (author_id = auth.uid());
