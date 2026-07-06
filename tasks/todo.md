# Todo — Sessione 2026-07-06 · Consolidamento e deploy (zero feature nuove)

> Piano approvato dall'utente. Ordine: fix da verifica visiva → P1 RLS → demo pulita → deploy in batch.
> Riferimenti: `~/second-brain/_roadmap.md` + review Valora 06/07 nel vault.
> (Il piano precedente — Multi-Sindacato GIRO 2 — è COMPLETATO 05/07; storia nel diario del vault.)

## 1. Fix da verifica visiva (l'utente verifica, io correggo)
- [ ] **Favicon invisibile in light mode** — la favicon ufficiale è bianca → su tab chiara sparisce.
      Fix: variante consapevole del tema (colore in light / bianco in dark).
      → verifica: tab visibile in entrambi i temi browser.
- [ ] Altri finding man mano che emergono dalla verifica d'insieme dell'utente.

## 2. P1 — Stringere RLS RAG `legal_*`
- [ ] Migration: restringere all'owner le 6 policy `USING(true)`/`WITH CHECK(true)` su
      `legal_chunks` + `legal_documents` (INSERT/UPDATE/DELETE), oggi aperte a ogni `authenticated`
      incluso il viewer. Applicare via MCP.
      → verifica: query pg_policies post-migration; il viewer non può più scrivere.

## 3. Demo pulita (da review 06/07)
- [ ] Seed pratica riposi demo (come "Boriglione" in Indennità) → Turni & Riposi non più vuota in demo.
- [ ] Demo-gate di `usePayslipArchive` → 0 errori console in demo.
- [ ] Badge DEMO non copre più il wordmark ValOra.
- [ ] Ammorbidire i badge "Sezione nuova — in sviluppo" per l'esterno.
      → verifica: giro demo completo senza errori console né buchi visivi.

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
