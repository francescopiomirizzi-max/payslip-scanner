-- Migration 011: aggiunge la policy UPDATE mancante sul bucket payslips_archive.
--
-- Bug rilevato il 2026-05-28: i tre criteri esistenti (INSERT/SELECT/DELETE) coprono
-- il flusso "carico una nuova busta paga" ma NON il caso `supabase.storage.upload(..., {upsert: true})`
-- quando il file esiste già. In quel caso Supabase Storage tenta un UPDATE sulla riga
-- esistente in storage.objects, ma senza policy UPDATE lo rifiuta con "new row violates
-- row-level security policy". Effetto utente: scansione QR di un mese già caricato →
-- successCount=0 → Dynamic Island rossa.
--
-- Il flusso UPDATE è LEGITTIMO: l'utente può rifotografare la stessa busta paga con una
-- foto migliore. Il client costruisce il path in modo deterministico
-- (`<owner_id>/<worker_id>/<year>_<monthIndex>_<filename>`), quindi un re-upload dello
-- stesso mese collide sempre con la riga precedente.
--
-- Logica identica alle altre policy: il primo segmento del path deve essere auth.uid()
-- (la "cartella personale" dell'utente), e il viewer read-only Vincenzo Cataneo
-- (34967593-6447-45fd-a303-13ec842c7b9e) resta escluso anche da questo lato.

CREATE POLICY "storage payslips: update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payslips_archive'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND auth.uid() <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid
)
WITH CHECK (
  bucket_id = 'payslips_archive'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND auth.uid() <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid
);
