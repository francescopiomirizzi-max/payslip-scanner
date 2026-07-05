-- Migration 022: tabella `sindacati` (multi-sindacato/CAF) + collegamento delle pratiche.
--
-- Contesto: finora tutte le pratiche (worker_profiles + pratiche_riposi + pratiche_vertenze)
-- appartengono implicitamente a UN solo committente, il sindacato FAST-CONFSAL di Vincenzo.
-- Per rendere il sito generale si introduce un livello "organizzazione" SOPRA le aree:
-- ogni pratica appartiene a un sindacato/CAF; l'owner sceglie l'organizzazione all'ingresso.
--
-- Applicata al DB live via MCP il 2026-07-05 (decisioni utente: solo seed FAST-CONFSAL).
--
-- Modello: come worker_profiles (019) — SELECT owner O viewer sola-lettura (Vincenzo),
-- scritture owner E NON viewer; auth.uid() avvolto in (select …) per l'advisor initplan.
-- `azienda` (RFI/Elior…) resta il DATORE del lavoratore, indipendente dal sindacato
-- che commissiona la pratica.

-- ── 1. Tabella organizzazioni ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sindacati (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        text NOT NULL,
    tipo        text NOT NULL DEFAULT 'sindacato' CHECK (tipo IN ('sindacato', 'caf')),
    logo_url    text,          -- path relativo (public/logos/…) o URL storage
    colore      text,          -- chiave tema/tinta per la UI (es. 'teal')
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sindacati_owner_idx ON public.sindacati (owner_id);

ALTER TABLE public.sindacati ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sindacati_select_owner"  ON public.sindacati;
DROP POLICY IF EXISTS "sindacati_insert_owner"  ON public.sindacati;
DROP POLICY IF EXISTS "sindacati_update_owner"  ON public.sindacati;
DROP POLICY IF EXISTS "sindacati_delete_owner"  ON public.sindacati;

-- SELECT: owner O viewer sola-lettura (il viewer deve leggere il sindacato dell'owner per
-- il bypass/scoping). Scritture: owner E NON viewer. Stesso modello di worker_profiles (019).
CREATE POLICY "sindacati_select_owner" ON public.sindacati FOR SELECT
    TO authenticated
    USING ((owner_id = (select auth.uid())) OR ((select auth.uid()) = '34967593-6447-45fd-a303-13ec842c7b9e'::uuid));
CREATE POLICY "sindacati_insert_owner" ON public.sindacati FOR INSERT
    TO authenticated
    WITH CHECK ((owner_id = (select auth.uid())) AND ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid));
CREATE POLICY "sindacati_update_owner" ON public.sindacati FOR UPDATE
    TO authenticated
    USING ((owner_id = (select auth.uid())) AND ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid))
    WITH CHECK ((owner_id = (select auth.uid())) AND ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid));
CREATE POLICY "sindacati_delete_owner" ON public.sindacati FOR DELETE
    TO authenticated
    USING ((owner_id = (select auth.uid())) AND ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid));

-- ── 2. Collegamento pratiche → sindacato (tabelle live) ───────────────────────
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS sindacato_id uuid
    REFERENCES public.sindacati(id) ON DELETE SET NULL;
ALTER TABLE public.pratiche_riposi ADD COLUMN IF NOT EXISTS sindacato_id uuid
    REFERENCES public.sindacati(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS worker_profiles_sindacato_idx ON public.worker_profiles (sindacato_id);
CREATE INDEX IF NOT EXISTS pratiche_riposi_sindacato_idx ON public.pratiche_riposi (sindacato_id);
-- NB: `pratiche_vertenze` (021) NON è ancora applicata al DB live → la sua colonna sindacato_id
--     va aggiunta dentro la 021 quando verrà eseguita, non qui.

-- ── 3. Seed FAST-CONFSAL + backfill (idempotente) ────────────────────────────
-- Un sindacato FAST-CONFSAL per ogni owner che ha già pratiche; poi tutte le pratiche
-- esistenti puntano a quel sindacato.
INSERT INTO public.sindacati (owner_id, nome, tipo, logo_url, colore)
SELECT DISTINCT wp.owner_id, 'FAST-CONFSAL', 'sindacato', 'logos/fast-confsal.png', 'teal'
FROM public.worker_profiles wp
WHERE wp.owner_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.sindacati s
      WHERE s.owner_id = wp.owner_id AND s.nome = 'FAST-CONFSAL'
  );

UPDATE public.worker_profiles wp
SET sindacato_id = s.id
FROM public.sindacati s
WHERE s.owner_id = wp.owner_id AND s.nome = 'FAST-CONFSAL' AND wp.sindacato_id IS NULL;

UPDATE public.pratiche_riposi pr
SET sindacato_id = s.id
FROM public.sindacati s
WHERE s.owner_id = pr.owner_id AND s.nome = 'FAST-CONFSAL' AND pr.sindacato_id IS NULL;
