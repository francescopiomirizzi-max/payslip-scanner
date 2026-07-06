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

## 4. Deploy in batch ✅ FATTO 06/07
- [x] Gate pre-deploy: tsc pulito + 260/260 test + build prod e demo verdi.
- [x] OK visivo dell'utente ricevuto.
- [x] README riscritto prima del push (39db75d): evoluzione scanner→RailFlow→aree→Valora
      multi-org, stack reale, niente dati sensibili (vetrina portfolio).
- [x] Push su main: **44 commit** in un colpo → **UN deploy Netlify** (railflow-2, stato `ready`).
- [x] Smoke test live: titolo "Valora — Ufficio Vertenze", 4 link favicon con `media`,
      bundle 200, favicon colorate+bianche 200, elior-residenza-seed 200.
      `viterbo-seed.json` → 404 **by-design**: git-ignorato per privacy (riga 37 .gitignore);
      in prod innocuo (il DB ha la pratica, il fallback non scatta). La demo si builda in
      locale, dove il file esiste.
- [ ] **Residuo**: RIDEPLOY del sito demo (separato) per portare live i fix "demo pulita" —
      serve URL/processo di deploy della demo (build locale `npm run build:demo`).

## Rinviati a prossime sessioni (ordine concordato)
- P2 code-split bundle (3,68 MB) → prima impressione mobile.
- Restyle "sala macchine" (scheda lavoratore) a livello Incidenza.
- Feature "prova d'accuratezza" riga-per-riga (cancello Bari, primo passo perizia-factory).
- Mattone CAF (derivazione anagrafica da CF) — ultimo, non aprire un secondo fronte.
- Le ~17 pratiche riposi in arrivo: PREZZARLE all'incontro prima di lavorarle.

## Review (a fine sessione)
- [x] Aggiornare `_roadmap.md` nel vault (data + stato) e diario.

### Esito sessione 06/07
Consolidamento completo in una sessione: favicon theme-aware, P1 RLS chiuso e VERIFICATO
(incluso il bucket storage `legal-corpus`, fuori lista audit), demo pulita (4 fix), README
riscritto, 44 commit deployati con un solo deploy Netlify, smoke test verde. Restano: rideploy
della demo, P2 code-split, sala macchine, prova d'accuratezza (ordine già concordato).
