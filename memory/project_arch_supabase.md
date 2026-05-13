---
name: Architettura storage buste paga — Supabase, no IndexedDB
description: Decisione architetturale tassativa: l'archivio buste paga usa esclusivamente Supabase. IndexedDB è stato scartato.
type: feedback
---

IndexedDB è stato categoricamente scartato per l'archivio delle buste paga.

**Why:** Le buste paga sono documenti sensibili. Il salvataggio locale nel browser è inaccettabile per ragioni di sicurezza e non è sincronizzato tra dispositivi.

**How to apply:** La Fase 2 (e tutte le fasi successive che richiedono persistenza PDF) usa esclusivamente:
- **Supabase Storage** per i blob PDF (bucket dedicato `payslips_archive`)
- **Tabella PostgreSQL su Supabase** per i metadati (workerId, path file, mese, anno, dati estratti)
- **Mai** proporre IndexedDB, localStorage, o qualsiasi storage browser-locale per dati dei lavoratori.
Il progetto ha già `supabaseClient.ts` e Supabase Auth configurati — sono il punto di partenza corretto.
