-- Migration 013: tabella `pratiche_riposi` per l'area "Turni & Riposi".
--
-- Dominio DIVERSO dalle buste paga (worker_profiles): qui una "pratica" è un autista
-- TPL con il suo prospetto turni giornaliero (mancati riposi, Reg. CE 561/2006).
-- Tenuta separata di proposito → nessun rischio di mescolare le due popolazioni.
--
-- Modello dati: come worker_profiles, le righe giornaliere stanno in una colonna JSONB
-- (`giornate`), non in una tabella figlia, per coerenza con l'impianto esistente.
--
-- RLS: owner-scoped su TUTTE le operazioni (stesso modello di 008/scan_sessions).
-- Solo l'utente proprietario (owner_id = auth.uid()) vede/modifica le proprie pratiche.

CREATE TABLE IF NOT EXISTS public.pratiche_riposi (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    nome            text NOT NULL DEFAULT '',
    cognome         text NOT NULL DEFAULT '',
    azienda         text,
    mansione        text,
    periodo_start   date,
    periodo_end     date,
    -- Parametro indennità: tariffa €/h + provenienza (da confermare con l'avvocato,
    -- NON hardcoded come nell'Excel che usava €10,03 ricavato a ritroso).
    tariffa_oraria  numeric,
    fonte_tariffa   text,
    -- Righe giornaliere estratte dal PDF/SA20: [{ data, gset, tipo, servizio, inizio, termine, ... }]
    giornate        jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pratiche_riposi_owner_idx ON public.pratiche_riposi (owner_id);

ALTER TABLE public.pratiche_riposi ENABLE ROW LEVEL SECURITY;

-- Idempotenza
DROP POLICY IF EXISTS "pratiche_riposi_select_owner" ON public.pratiche_riposi;
DROP POLICY IF EXISTS "pratiche_riposi_insert_owner" ON public.pratiche_riposi;
DROP POLICY IF EXISTS "pratiche_riposi_update_owner" ON public.pratiche_riposi;
DROP POLICY IF EXISTS "pratiche_riposi_delete_owner" ON public.pratiche_riposi;

CREATE POLICY "pratiche_riposi_select_owner"
    ON public.pratiche_riposi FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "pratiche_riposi_insert_owner"
    ON public.pratiche_riposi FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pratiche_riposi_update_owner"
    ON public.pratiche_riposi FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pratiche_riposi_delete_owner"
    ON public.pratiche_riposi FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());
