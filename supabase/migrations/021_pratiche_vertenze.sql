-- Migration 021: tabella `pratiche_vertenze` per l'area "Indennità" (vertenza-voce).
--
-- Prima vertenza ospitata: "indennità di assenza dalla residenza" degli Elior
-- VIAGGIANTE (voci 4300/4305, CCNL 2016). Modello PARAMETRICO sulla voce: la stessa
-- tabella regge future vertenze-voce cambiando solo il contenuto di `voci`.
--
-- Clone leggero di `pratiche_riposi` (013): righe/parametri in colonne JSONB, niente
-- tabella figlia. RLS owner-scoped come 013.
--
-- ⚠️ NON ancora applicata al DB live: in questa fase la lista si deriva dai worker
--    `ELIOR/viaggiante` + seed didattico (stato/coefficiente in memoria). Applicare
--    quando si introduce la persistenza reale. Per l'accesso del viewer in sola
--    lettura, allineare la policy SELECT al modello già usato per le altre tabelle
--    (apertura al UID viewer) prima del deploy.

CREATE TABLE IF NOT EXISTS public.pratiche_vertenze (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Anagrafica del lavoratore (di norma allineata a un worker_profiles ELIOR viaggiante).
    worker_id       uuid,
    nome            text NOT NULL DEFAULT '',
    cognome         text NOT NULL DEFAULT '',
    elior_type      text,
    periodo_start   date,
    periodo_end     date,
    -- Voci oggetto della vertenza con le due tariffe a confronto + importi pagati per anno:
    --   [{ codice, label, tariffaPagata, tariffaDovuta, righe: [{ anno, importoPagato }] }]
    voci            jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Prescrizione: { anni, cutoff, interruzioni: [{ data, nota }] }
    prescrizione    jsonb,
    -- Coefficiente sul valore della differenza (1 = pieno; 0.20 = criterio danno).
    coefficiente    numeric NOT NULL DEFAULT 1,
    stato           text NOT NULL DEFAULT 'bozza'
                    CHECK (stato IN ('bozza', 'in_corso', 'pagata')),
    data_apertura   date,
    data_chiusura   date,
    data_pagamento  date,
    importo_riconosciuto numeric,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pratiche_vertenze_owner_idx ON public.pratiche_vertenze (owner_id);

ALTER TABLE public.pratiche_vertenze ENABLE ROW LEVEL SECURITY;

-- Idempotenza
DROP POLICY IF EXISTS "pratiche_vertenze_select_owner" ON public.pratiche_vertenze;
DROP POLICY IF EXISTS "pratiche_vertenze_insert_owner" ON public.pratiche_vertenze;
DROP POLICY IF EXISTS "pratiche_vertenze_update_owner" ON public.pratiche_vertenze;
DROP POLICY IF EXISTS "pratiche_vertenze_delete_owner" ON public.pratiche_vertenze;

CREATE POLICY "pratiche_vertenze_select_owner"
    ON public.pratiche_vertenze FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "pratiche_vertenze_insert_owner"
    ON public.pratiche_vertenze FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pratiche_vertenze_update_owner"
    ON public.pratiche_vertenze FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "pratiche_vertenze_delete_owner"
    ON public.pratiche_vertenze FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());
