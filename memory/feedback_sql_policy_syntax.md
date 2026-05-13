---
name: SQL Policy Supabase — sintassi USING/WITH CHECK
description: Nelle policy Supabase Storage, SELECT richiede USING(), INSERT richiede WITH CHECK(). Non dimenticare la keyword.
type: feedback
---

Nelle policy RLS per `storage.objects` su Supabase, ogni clausola richiede la keyword corretta:

- `FOR SELECT` → `USING (...)`
- `FOR INSERT` → `WITH CHECK (...)`
- `FOR DELETE` → `USING (...)`

**Why:** Ho omesso `USING (` nella policy `FOR SELECT` su `storage.objects`, causando un errore SQL che l'utente ha dovuto correggere manualmente.

**How to apply:** Ogni volta che scrivo policy RLS (tabelle o storage), verificare che tutte le clausole abbiano la keyword esatta prima delle condizioni.
