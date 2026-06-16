-- Migration 018: app_settings (config a riga singola).
--
-- Nasce per l'avviso di pagamento BLOCCANTE rivolto all'account viewer
-- (Vincenzo): quando `viewer_payment_block = true`, alla prossima apertura il
-- viewer trova una schermata a tutto campo che SOSPENDE l'accesso al gestionale
-- finché non salda quanto pattuito (€ `payment_amount_eur`). L'owner spegne il
-- flag (UPDATE) quando riceve il pagamento → accesso ripristinato, senza redeploy.
--
-- RLS: SELECT aperto a tutti gli autenticati (il viewer DEVE poter leggere il
-- flag per sapere se è bloccato); scrittura solo all'owner (il viewer non deve
-- potersi spegnere l'avviso da solo). Stile coerente con 016_messages.

CREATE TABLE IF NOT EXISTS public.app_settings (
    id                    smallint     PRIMARY KEY DEFAULT 1,
    viewer_payment_block  boolean      NOT NULL DEFAULT false,
    payment_amount_eur    integer      NOT NULL DEFAULT 750,
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT app_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select_all"   ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update_owner" ON public.app_settings;

-- Lettura: tutti gli autenticati (incluso il viewer).
CREATE POLICY "app_settings_select_all"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (true);

-- Scrittura: solo l'account proprietario (Francesco).
CREATE POLICY "app_settings_update_owner"
    ON public.app_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid)
    WITH CHECK (auth.uid() = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid);

-- Riga singola: avviso ATTIVO (Vincenzo deve trovarlo alla prossima apertura,
-- post-deploy). Sul sito live attuale la tabella è inerte finché il nuovo bundle
-- non viene pubblicato.
INSERT INTO public.app_settings (id, viewer_payment_block, payment_amount_eur)
VALUES (1, true, 750)
ON CONFLICT (id) DO NOTHING;
