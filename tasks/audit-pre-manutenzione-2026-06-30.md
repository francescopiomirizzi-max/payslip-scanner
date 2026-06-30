# Audit pre-manutenzione — RailFlow / payslip-scanner (2026-06-30)

> Scattato in vista della finestra di manutenzione "a breve". Obiettivo: cosa conviene
> infilare nel prossimo deploy. Ogni voce è marcata **[VERIFICATO]** (misurato adesso) o
> **[DA VERIFICARE]** (osservato, non confermato). Verità tecnica di dominio → memoria di
> progetto; questo file è solo la fotografia "stato di salute + cose da sistemare".

## TL;DR
Salute di base **verde**. Nessun bug bloccante trovato. Da fare nella finestra, in ordine:

1. **P1 [sicurezza, basso sforzo]** — stringere 6 RLS `USING(true)` sulle tabelle RAG `legal_*`:
   oggi qualunque utente autenticato (**incluso il viewer Vincenzo**) può INSERT/UPDATE/DELETE lì.
2. **P2 [impatto utente]** — code-split del chunk `App` (3,68 MB / 1,04 MB gzip): first load lento su mobile.
3. **P3 [cosmetico]** — revoca EXECUTE anon su `cleanup_expired_scan_sessions()`; drop di 9 index mai usati.
4. **[DA VERIFICARE]** — click sui chip "Buste paga mancanti" nella dashboard owner non apriva la scheda.

---

## 1. Salute di base — [VERIFICATO oggi]
| Check | Esito |
|---|---|
| Test (`vitest run`) | **229/229 verdi**, 16 file. Solo warning `act(...)` cosmetici. |
| Typecheck (`tsc --noEmit`) | **Pulito**, nessun errore. |
| Build (`vite build`) | **OK** in 4,5s, 2949 moduli. |
| Git vs `origin/main` | **0 commit avanti** (allineato; deploy 28/06 ha chiuso la coda). Solo `tasks/*` modificati in locale. |
| Marker `TODO/FIXME/HACK` nel sorgente | **0**. |

→ Non c'è codice "fermo" da deployare: la manutenzione è una finestra di *miglioramenti*, non di recupero arretrati.

---

## 2. Sicurezza — advisor Supabase [VERIFICATO oggi]
Progetto `bpnkjfboijfhnqovymwg`. Tutti **WARN** (nessun ERROR).

### ⭐ P1 — RLS RAG `legal_*` con `USING(true)` (×6)
`legal_chunks` e `legal_documents` hanno policy permissive per il ruolo `authenticated`:
- `legal_chunks`: INSERT / UPDATE / DELETE → `WITH CHECK(true)` / `USING(true)`
- `legal_documents`: INSERT / UPDATE / DELETE → idem

**Rischio reale ma a bassa esploitabilità:** il viewer Vincenzo è `authenticated`, quindi via chiamata
REST diretta potrebbe scrivere/cancellare nelle tabelle della knowledge-base legale. La UI non espone
nulla, ma l'RLS è la rete di sicurezza e qui è bucata. Coerente con il principio "il viewer non scrive".
**Fix:** restringere le 6 policy all'UID owner (come le altre tabelle). 1 migration, basso sforzo.
Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

### P3 — SECURITY DEFINER del flusso QR (×4)
`cleanup_expired_scan_sessions()` e `is_active_scan_session(text)` sono `SECURITY DEFINER` e
chiamabili da `anon` e `authenticated` via RPC.
- `is_active_scan_session` — **probabilmente intenzionale** (il telefono non loggato la usa nel flusso QR). Lasciare.
- `cleanup_expired_scan_sessions` — non serve sia pubblica: **revocare EXECUTE ad `anon`** (e valutare authenticated).
Remediation: .../lint=0028 e .../lint=0029

### Minori
- `extension_in_public` (vector nel public schema) — cosmetico, comune. Lasciare.
- `auth_leaked_password_protection` disabilitata — **WON'T FIX**: è feature Pro-only (verificato 18/06,
  memoria `supabase-leaked-password-pro-only`). Non riproporre.

---

## 3. Performance — advisor Supabase [VERIFICATO oggi]
9 **unused index** (livello INFO):
- RAG: `idx_legal_documents_doc_type`, `_ccnl_ref`, `_metadata`; `idx_legal_chunks_document_id`,
  `_embedding_hnsw`; `idx_legal_queries_user_id`, `_created_at`, `_worker_id`.
- `idx_messages_author_id` (aggiunto il 28/06 come indice FK; "unused" perché `messages` è minuscola).

Sono "mai usati" perché RAG/legal è poco interrogato e `messages` è piccola. Innocui. **Drop opzionale**
solo per pulizia; nessun guadagno percepibile. Tenere `idx_messages_author_id` (è un indice FK, giusto averlo).

---

## 4. Front-end / bundle — [VERIFICATO oggi]
Output `vite build` (chunk principali):

| Chunk | Size | gzip |
|---|---|---|
| **`App-*.js`** | **3.679 kB** | **1.038 kB** |
| `readonly-*.js` (lazy worker/report) | 341 kB | 97 kB |
| `index-*.js` | 205 kB | 65 kB |
| `html2canvas.esm` (lazy) | 202 kB | 48 kB |
| `index.es` (docx/exceljs, lazy) | 160 kB | 54 kB |
| `pdf.worker.min` (lazy) | 1.232 kB | — |
| CSS | 434 kB | 45 kB |

Vite avvisa: chunk > 500 kB. **Il problema è il singolo `App` monolitico (1 MB gzip).** Le librerie pesanti
(pdf.js, html2canvas, docx, exceljs) sono **già lazy** — bene. Il guadagno vero è spezzare `App` per route
(`manualChunks` o `import()` su Dashboard / WorkerDetail / Riposi / Archive). **Unico tech-debt con impatto
utente reale** (first load mobile). File più grossi che ci contribuiscono: `DynamicIsland.tsx` (2329 righe),
`MonthlyDataGrid.tsx` (1922), `DashboardPage.tsx` (1610).

---

## 5. Audit visivo del sito — [VERIFICATO oggi, vista owner :5174]
Giro su Dashboard, Statistiche, Archivio (+ anteprima busta), Riposi. **Console pulita**: 0 errori/
eccezioni su reload completo e durante tutto il giro. Nessun layout rotto. Schermate solide.

### ✅ RISOLTO in locale (30/06) — omonimi indistinguibili nei punti compatti
> Non solo Avella: anche i fratelli **Circello** (Francesco/Marco) e i **Cataneo** (Pasquale/Vincenzo)
> apparivano come solo cognome nei chip dashboard. Fix generale:
> - helper `sedeFromRuolo` (utils/formatters.ts) + tag sede nella lista Archivio (ArchivePage);
> - chip dashboard (DashboardPage): quando un cognome è condiviso da ≥2 lavoratori il chip aggiunge il
>   NOME; se anche il nome coincide (Avella Antonio) aggiunge la SEDE. Una regola copre tutti i casi futuri;
> - al record Avella-Foggia aggiunto "(Foggia)" nel ruolo (SQL).
> tsc OK, 229/229 test, verificato a video (chip → "Circello Francesco/Marco", "Cataneo Pasquale/Vincenzo",
> "Avella Antonio · Foggia/Termoli"). Non deployato (va nel batch di manutenzione).

**Due lavoratori DIVERSI** con lo stesso nome (confermato dall'utente + dati): uno di **Foggia**
(`7e43be35…`, status *chiusa*), uno di **Termoli** (`aa055d61…`, status *trattativa*). NON è un doppione
(0 storage condiviso, archivi separati). **Problema UX reale:** nella **lista Archivio** e nei **chip della
dashboard** appaiono identici ("Avella Antonio" / "228 mesi") → rischio di lavorare sul lavoratore sbagliato.
**Fix proposto:** esporre un marcatore di **sede** nei punti compatti (lista archivio + chip). Il Termoli ha
già "(Termoli)" nel ruolo; al Foggia va aggiunto "(Foggia)". Meglio ancora: regola generale → quando
cognome+nome coincidono, mostrare il dettaglio distintivo (ruolo/sede) accanto al nome. Vedi memoria
`project-avella-antonio-omonimi`. **Mai unire/deduplicare i due record.**

### Note visive minori (cosmetiche, bassa priorità)
- **Dynamic Island** (pill fissa in alto-centro) **si sovrappone al titolo** della pagina Statistiche
  ("EXECUTIVE DASH[BOARD]") a viewport ~960px. A schermo largo non collide. Valutare uno z-offset/margine.
- **Anteprima busta (Archivio):** il titolo del pannello tronca il mese ("Gen…" per "Gennaio 2025"). Cosmetico.

### [DA VERIFICARE] Chip gruppo dashboard
Cliccando il chip "Gagliano" sotto *"Buste paga mancanti"* la scheda non si è aperta (scrollava in cima).
La **lista dell'Archivio**, invece, apre i lavoratori correttamente. Capire se i chip di gruppo della
dashboard devono essere tap-to-open o sono solo etichette. (Bassa confidenza: possibile click impreciso.)

---

### Audit visivo — esito completo (30/06)
**Schermate coperte (tutte OK salvo note):** Dashboard (desktop + mobile ~400px), Statistiche, Archivio
(+ anteprima busta), Report/prospetto, **Gestione Dati / `MonthlyDataGrid`**, **Riposi → dettaglio Viterbo**
(+ Confronto PDF), **RelazioneModal**, **Scheda azienda `CompanyPage`**. Nessun layout rotto; mobile regge
(wrap + scroll orizzontale intenzionale). Console pulita.

**Finding azionabile:**
- ⚠️ **Toolbar del Report tagliata a destra** a larghezze laptop/strette (~960px, la finestra reale dell'utente):
  i tasti **Relazione / Gestione Dati / Documenti / Stampa** finiscono fuori schermo, senza wrap né
  scroll orizzontale → a finestra non massimizzata non si raggiungono. Fix: far andare a capo la toolbar o
  renderla scrollabile sotto una certa larghezza. **Candidato manutenzione (P2/P3).**
  (NB: il tasto "Diffida" è stato **rimosso** il 30/06 su richiesta utente — feature non usata.)

**Risolto in questo giro:**
- ✅ **Omonimi anche nella scheda azienda** (`CompanyPage`): mostrava due "Avella Antonio" identici → aggiunto
  il tag sede (`Foggia`/`Termoli`). Ora la fix omonimi copre TUTTI i 3 punti compatti (archivio, chip, scheda azienda).

**Note minori (cosmetiche):** Dynamic Island sovrapposta al titolo in Statistiche a ~960px; anteprima busta
tronca il mese ("Gen…").

**Non coperto (richiede setup dedicato, rinviato):**
- `MobileUploadPage` (serve il flusso QR da telefono reale).
- Vista viewer "manutenzione" `ViewerPaymentBlock` (serve login viewer di Vincenzo — non accessibile).
- Dark mode end-to-end (le classi `dark:` ci sono ovunque; non individuato un toggle in-app durante il giro).

## 6. Item di dominio aperti (NON bug — lavoro, già in roadmap)
Non sono "da sistemare" in senso tecnico, ma è ciò che la finestra/le prossime sessioni dovranno smaltire:
- **3 urgenze / 7 buste mancanti** in dashboard → 3 recuperi residui (Avella, Gentile, Cataneo Pasquale).
- **Viterbo ×20% sul reale** + 2 righe duplicate da ripulire.
- **RFI** 8/23 verificate → ~15 con procedura standard.
- **Elior** voci fisse da mappare (`extracted_data` vuoto).
- **Conteggi Tozzi** da rigenerare e inviare allo studio.

---

## Proposta per la finestra di manutenzione
**Minimo sensato (1 deploy):** P1 (RLS RAG) + verifica/fix del chip dashboard. Bassissimo rischio, chiude
l'unico buco di sicurezza concreto e un eventuale attrito UX.
**Se c'è tempo:** P2 (code-split `App`) — più lavoro ma è il miglioramento che gli utenti *sentono*.
**Scartare:** leaked-password (Pro-only), drop index (nessun guadagno).
