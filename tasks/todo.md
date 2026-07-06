# Todo — Sessione 2026-07-06 · Consolidamento e deploy (zero feature nuove)

> Piano approvato dall'utente. Ordine: fix da verifica visiva → P1 RLS → demo pulita → deploy in batch.
> Riferimenti: `~/second-brain/_roadmap.md` + review Valora 06/07 nel vault.
> (Il piano precedente — Multi-Sindacato GIRO 2 — è COMPLETATO 05/07; storia nel diario del vault.)

## 1. Fix da verifica visiva (l'utente verifica, io correggo)
- [x] **Favicon invisibile in light mode** — FATTO (c290785): `media="(prefers-color-scheme)"` in
      index.html — bianca solo su tab scura, colorata in light; colorate per ultime = fallback
      per i browser che ignorano `media`. → verifica finale: occhio dell'utente sui 2 temi.
- [ ] Altri finding man mano che emergono dalla verifica d'insieme dell'utente.

## 2. P1 — Stringere RLS RAG `legal_*` ✅
- [x] Migration **023_legal_rls_owner_write** scritta nel repo + **APPLICATA al DB live** (ea9d9c7).
      Chiuse le 6 policy tabelle **+ 3 policy storage `legal-corpus`** (stessa falla della 005,
      non era nella lista audit). Scrittura = solo owner `7fec036e-…`; lettura invariata.
      → VERIFICATO live: INSERT con JWT viewer → errore RLS 42501; INSERT owner → ok (rollback);
      pg_policies: 0 policy di scrittura aperte residue.

## 3. Demo pulita (da review 06/07) ✅ (0fdb746)
- [x] Turni & Riposi in demo → seed Viterbo via `loadSeed()` (gate IS_DEMO in `usePraticheRiposi`,
      scritture neutralizzate: salvaInArchivio null, updatePratica solo ottimistico locale).
- [x] Demo-gate di `usePayslipArchive` → guardia IS_DEMO su tutte e 7 le funzioni.
- [x] Badge DEMO spostato top-center (a sinistra copriva il wordmark ValOra).
- [x] DevBadge → "Novità" statico (via testo "in sviluppo" + animate-ping) nelle 3 aree.
      → verifica: tsc pulito, 260/260 test, build prod + build demo ok. Giro visivo = utente.

## 4. Deploy in batch (~41 commit + quelli di oggi)
- [ ] Gate pre-deploy: tsc + vitest + build verdi.
- [ ] ATTESA OK visivo dell'utente sull'insieme (localhost).
- [ ] Push su main → un solo deploy Netlify → smoke test post-deploy.
      Nota tempismo: deploy PRIMA dell'incontro con Vincenzo; `viewer_payment_block` resta acceso.

## Rinviati a prossime sessioni (ordine concordato)
- P2 code-split bundle (3,68 MB) → prima impressione mobile.
- Restyle "sala macchine" (scheda lavoratore) a livello Incidenza.
- Feature "prova d'accuratezza" riga-per-riga (cancello Bari, primo passo perizia-factory).
- Mattone CAF (derivazione anagrafica da CF) — ultimo, non aprire un secondo fronte.
- Le ~17 pratiche riposi in arrivo: PREZZARLE all'incontro prima di lavorarle.

## Review (a fine sessione)
- [ ] Aggiornare `_roadmap.md` nel vault (data + stato) e diario.
