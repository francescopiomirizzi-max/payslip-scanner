-- Migration 024: il viewer (sola lettura) DEVE vedere le pratiche Turni & Riposi.
-- La 013 aveva creato pratiche_riposi con TUTTE le policy owner-only, SELECT inclusa:
-- fuori dal modello del progetto (il viewer legge tutto, cfr. worker_profiles in 019).
-- Effetto pratico: al viewer l'area risultava vuota — la pratica reale (Viterbo) è nel
-- DB e va mostrata a sindacalista e avvocato. Scritture INVARIATE (owner-only).
-- Viewer = 34967593-6447-45fd-a303-13ec842c7b9e (stesso UID delle policy 019).

DROP POLICY IF EXISTS "pratiche_riposi_select_owner" ON public.pratiche_riposi;

CREATE POLICY "pratiche_riposi_select_owner_or_viewer" ON public.pratiche_riposi
  FOR SELECT TO authenticated
  USING (
    (owner_id = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)
  );
