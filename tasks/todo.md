# PIANO — Nuova area "Indennità" (vertenza-voce) · banco di prova Elior magazzino (2026-06-30)

> Disegno completo: [feature-indennita-residenza-elior.md](feature-indennita-residenza-elior.md).
> **NON implementare finché non approvato.** Stato: piano in attesa di OK.
> **Bacino = tutti gli Elior viaggiante** (già presenti + futuri): la sezione si auto-popola dai worker
> `profilo==='ELIOR' && eliorType==='viaggiante'` (sono esattamente i destinatari di questa vertenza).
> I dati 4300/4305 reali del viaggiante sono ancora incompleti (no `extracted_data`/OCR) → per validare i
> **numeri** del confronto si usa un **seed/mock** su un viaggiante finché non si sblocca l'OCR.
> Obiettivo di QUESTA fase: **scheletro feature + UI navigabile + motore parametrico**, con la lista già
> popolata dai viaggiante reali. La vertenza VERA (numeri 4300/4305 reali) = dopo lo sblocco dati — fuori scope qui.

> **STATO — giro 1 (30/06):** Fasi 0-4 ✅ scheletro navigabile (tsc=0 · 236 test · build ok).
> Restano: **Fase 4b** (cross-link da Incidenza), **Fase 5** (generatori .docx/Excel/stampa + aggancio ISTAT),
> **Fase 6** verifica navigazione manuale (serve login owner). Tutto locale, non deployato.

## Principi
- **Gemello *differenziato* dei Riposi**: stesso pattern, identità propria (rame/ambra + icona MapPin/Home),
  cuore detail = **confronto Pagato↔Dovuto**, **timeline prescrizione** esclusiva.
- **Modulo parametrico sulla voce**: niente hard-code 4300/4305 (config: voci+tariffe, periodo, prescrizione).
- **Additivo**: zero impatto su Incidenza e Riposi (nuova `AppArea`, nuove rotte, nuovi file).

## Fase 0 — Dato & tipi
- [ ] `types.ts`: tipo `PraticaVertenza` { id, workerNome, profilo/eliorType, voci:[{codice,label,tariffaPagata,tariffaDovuta}],
      periodo{da,a}, prescrizione{interruzioni[],cutoff}, coefficiente?, stato:'bozza'|'in_corso'|'pagata' }.
- [ ] Migration Supabase `pratiche_vertenze` (clone leggero di `pratiche_riposi`) + RLS owner/viewer identiche. **Non applicare finché il piano non è approvato.**
- [ ] **Lista derivata dai viaggiante reali**: la lista = tutti i worker `ELIOR/viaggiante` (one-pratica-per-worker,
      creata on-demand). `pratiche_vertenze` persiste stato/parametri/override; i worker senza pratica compaiono
      come «da impostare». Accoglie automaticamente i futuri viaggiante.
- [ ] Seed/mock dei **numeri** su 1 viaggiante (tariffe + importi finti realistici) per validare il confronto Pagato↔Dovuto finché manca l'OCR.

## Fase 1 — Motore parametrico
- [ ] `utils/vertenzaEngine.ts`: per mese×voce `ore = importo/tariffaPagata` · `Δ = ore×(dovuta−pagata)`;
      somma per anno; + rivalutazione ISTAT FOI (`istatService`) + interessi legali; `coefficiente` opzionale.
- [ ] Test `vitest`: 1 voce · 2 voci · prescrizione che taglia mesi · coefficiente ≠ 1.

## Fase 2 — Area & navigazione
- [ ] `AreaSwitch`: terza voce `'indennita'` (rame/ambra, icona MapPin/Home); estendere `AppArea`.
- [ ] Routing hash + persistenza area come per Incidenza/Riposi.

## Fase 3 — Lista pratiche (`VertenzeArea`, calco di `RiposiArea`)
- [ ] **Auto-popolata dai worker `ELIOR/viaggiante`** (filtro su `useWorkers`), non da seed: ogni viaggiante = una riga.
      Oggi sono **≈10** → **lista lineare** ordinabile per stato/credito; niente raggruppamenti per azienda né ricerca pesante.
- [ ] Card per-lavoratore: **header con `CompanyLogo` Elior** (già meglio dei Riposi attuali); stato/credito/periodo o «da impostare».
- [ ] Stati vuoto/loading.

## Fase 4 — Detail (`VertenzaDetail`) — il cuore differenziato
- [ ] Header pratica **con `CompanyLogo` Elior** (i Riposi oggi NON mostrano il logo — qui sì).
- [ ] **Timeline prescrizione** (striscia nov2017→lug2023 + marcatori interruzioni OO.SS. + cutoff); statica in v1.
- [ ] **Tabella confronto Pagato↔Dovuto** per voce (4300/4305) con colonna Δ + riga GAP+ISTAT+interessi = credito.
- [ ] Banner metodologico (CCNL Multiservizi/Ristorazione 2012/2016 art. 77; misura ridotta vs CCNL).
- [ ] Selettore coefficiente (riuso pattern Riposi), gated owner.

## Fase 4b — Richiamo da Incidenza (cross-link)
- [ ] Nella scheda Incidenza di un worker `ELIOR/viaggiante` (`WorkerCard` / `WorkerDetailHeader`): badge/bottone
      **«Indennità residenza»** → `setArea('indennita')` (esposto da `App.tsx:106`) + deep-link al worker (hash `#indennita/<id>`).
- [ ] Visibile **solo** per i viaggiante (no RFI/magazzino/altri profili). Owner + viewer (sola navigazione, nessun export).

## Fase 5 — Generatori (calco `riposi*`)
- [ ] `vertenzaRelazione.ts` (.docx vero, libreria docx) · `vertenzaExcel.ts` · `vertenzaPrint.ts`.
- [ ] Gate viewer via `canExportForViewer` (export solo su pratiche `pagata`).

## Fase 6 — Verifica
- [ ] `npx tsc --noEmit` = 0 · `vitest` verde · `npm run build` ok.
- [ ] Navigazione manuale: area visibile → lista → detail → timeline → confronto → azioni; Incidenza/Riposi invariati.
- [ ] Rilettura diff: tutto additivo, nessuna regressione sulle aree esistenti.

## Fuori scope (questa fase)
- Sblocco dati **viaggiante** (acquisire+caricare+ri-scansionare buste reali nov2017–lug2023) → prerequisito della vertenza VERA, sessione dedicata.
- Estrazione OCR reale di 4300/4305.

## Side-note (segnalato 30/06) — logo azienda mancante in Turni & Riposi (Viterbo)
Due cause combinate (verificate nel codice):
- (a) `RiposiPraticaDetail` **non rende** affatto `CompanyLogo` nell'header (l'area Incidenza sì, via `WorkerCard`/`WorkerDetailHeader`).
- (b) L'azienda di Viterbo è **custom** (`pratica.azienda` = stringa libera), non un profilo di sistema → `getCompanyLogo` = null
      (loghi solo per RFI/Trenitalia/Elior/Mercitalia/Clean Service, `config/profiles.ts`).
- **Fix (task separato)**: aggiungere il blocco logo nell'header Riposi **+** registrare un logo per l'azienda viterbese
      (file in `public/logos/` + mappatura custom). Da decidere: ora o backlog.

### Review — giro 1 (2026-06-30)
Scheletro navigabile completo, additivo (Incidenza/Riposi invariati). tsc=0 · 236 test (7 nuovi sul motore) · build ok.
File nuovi: `utils/vertenzaEngine.ts` (motore parametrico) · `__tests__/vertenzaEngine.test.ts` · `hooks/usePraticheVertenze.ts`
(lista auto-derivata dai worker ELIOR/viaggiante + seed didattico) · `components/VertenzeArea.tsx` (lista, identità rame) ·
`components/VertenzaDetail.tsx` (confronto Pagato↔Dovuto + timeline prescrizione + selettore coefficiente) ·
`public/elior-residenza-seed.json` · `supabase/migrations/021_pratiche_vertenze.sql` (**creata, NON applicata**).
File toccati: `AreaSwitch.tsx` (3ª voce rame/MapPin) · `App.tsx` (render + titolo) · `useHashRoute.ts` (`#/indennita`).
Decisioni chiuse in autonomia: seed = "Boriglione" demo; logo Viterbo → backlog.
Rimandato al giro 2: cross-link da Incidenza, generatori, aggancio ISTAT/interessi (ora a 0), persistenza DB.
Da fare lato utente: verifica navigazione manuale (login owner) — la lista mostrerà i 10 viaggiante reali + la card demo.

---

# MISSIONE 30/06 pom. — Arricchire la Relazione Riposi con la metodologia del perito (doc Vincenzo)

> Fonti: cartella `~/Desktop/Pratiche_differenze_ retributive_ indennità/mancati riposi/`
> (2 .docx perito + Excel + CSV). Analisi: `tasks/analisi-doc-vincenzo-riposi-2026-06-30.md`.

## Scope confermato dalla verifica (IMPORTANTE)
- ❌ **Il motore di calcolo NON si tocca.** Verificato sui CSV: la nostra tariffa (`deriveTariffePerAnno`)
  = tariffa effettiva del PDF (10,04→13,13 = colonna `tariffa_oraria_mediana_eur`); il coefficiente 20% è
  scelta dell'avvocato già confermata; le due serie sono già a confronto. Tutto corretto.
- ✅ Il valore dei doc è la **base giuridica della valorizzazione**, che la nostra Relazione NON cita.

## P1 (la missione) — `utils/riposiRelazione.ts`: sezione "Base contrattuale della valorizzazione"
- [ ] Aggiungere ai riferimenti di legge: **L. 138/1958**, **D.Lgs. 66/2003** (oltre 561/2006 + 234/2007).
- [ ] Nuova sezione con la catena **CCNL Autoferrotranvieri**: 1976 (art. 6 retrib. normale, art. 15 retrib.
      oraria), 1980 (art. 11 straord./fest./nott.), 1982 (raddoppio notturne dal 1984), **1997 (art. 14:
      riposo periodico = festivo)**.
- [ ] Principio art. 14/1997: prestazione nel giorno fissato per il riposo = **lavoro festivo**.
- [ ] **Divisore 195** (39h/6gg = 6,5h/gg) + composizione retribuzione normale (tabellare + contingenza +
      scatti + mensa + TDR + assegni ad personam).
- [ ] Schema **maggiorazioni** (straord. 110%, festivo 120%, notturno +20%, combos 130/150%).
- [ ] **Esclusioni prudenziali**: notturno e integrazione 50% NON applicate → "importi minimi".
- [ ] Aggancio al ns. impianto: "valore pieno" (serie fonte) = valorizzazione festiva del perito; la serie B
      applica su quel valore il **coefficiente di danno** (criterio del legale). Coerenza, niente conflitto.

## P2 (se c'è tempo) — etichette/banner in-app `RiposiPraticaDetail`
- [ ] Banner metodologico + etichette serie: citare la base contrattuale (561/2006 + valorizzazione CCNL festiva).

## P3 (opzionale, gated avvocato) — coefficiente selezionabile in UI (0.20 ↔ 1.0). Rimandabile.

## Verifica — FATTO
- [x] `vitest` 229/229 verde + tsc OK + build OK (motore invariato).
- [x] Relazione .docx di Viterbo generata dall'app → textutil → confermate tutte le nuove sezioni
      (art. 14 CCNL, divisore 195, "festivo a tutti gli effetti", L.138/1958, D.Lgs.66/2003, prudenziale, valore pieno).
- [x] P3 selettore: round-trip DB verificato (0,20 → 1 → 0,20). **Viterbo ripristinato a 0.2** (lawyer-confirmed).
- [ ] Commit dedicato (P1+P2+P3). NON deployare (batch).

### Review (2026-06-30 pom.) — MISSIONE COMPLETA
- **Colpo di scena verificato sui CSV**: il motore era GIÀ corretto (tariffa = effettiva del PDF 10,04→13,13;
  coefficiente 20% = scelta avvocato). Niente da correggere nel calcolo → ipotesi iniziale "tariffa sbagliata" smentita.
- **P1** `riposiRelazione.ts`: aggiunta la base contrattuale (catena CCNL + art.14/1997 festivo + divisore 195 +
  maggiorazioni + esclusioni prudenziali) dentro la sez. "2. Quadro normativo". Solo testo, zero calcolo.
- **P2** `RiposiPraticaDetail.tsx`: banner + sottotitolo card PDF citano la valorizzazione contrattuale.
- **P3** `RiposiPraticaDetail.tsx`: selettore "Valorizzazione serie B" (Valore pieno 100% ↔ Danno 20%) che espone
  il campo `coefficiente` già esistente (default e motore invariati). Visibile solo per owner su pratica gestibile.
- File su Desktop: `~/Desktop/Pratiche_differenze_ retributive_ indennità/mancati riposi/` (2 docx + Excel + CSV).

---

# Recupero busta misfiled #5 — Gentile Celestino (Settembre 2009) — 2026-06-30 pom.

> 5° dei 7 recuperi. Playbook = memoria `project-audit-mese-archivio-vs-testata` + lezione 30/06.
> ⚠️ **DIVERGE da Tozzi/Cataneo:** lo slot di destinazione Set2008 è **VUOTO**, e nello slot Set2009
>   ci sono **dati 2008 reali** → rischio di perdere Settembre 2008 se si sovrascrive e basta.

## Stato DB (verificato 30/06)
- Gentile Celestino `68782a50-cff0-4796-b6c0-13d0fdd83f8b`, RFI, status **CHIUSA**, fix_targets=[{2009, Settembre}], 228 buste.
- Slot **Set2009** (file 85,4KB): `extracted_data` con `year:2008, month:9` (presenze 18, ferie 6, riposi 7, voci RFI reali, fondo_pregresso 32.354,68) → contenuto = busta **SETTEMBRE 2008**.
- Slot **Set2008** (file 76,4KB): `extracted_data` **VUOTO** (mai scansionato). File DIVERSO (dimensione) da quello del 2009.

## Verificato su buste reali + griglia (30/06) → CASO A (no rischio perdite)
- [x] File Set2008 (76,4KB): testata "Stipendio di Settembre 2008", val. 25.09.2008 → è la vera Set2008.
- [x] File Set2009 (85,4KB): testata "Stipendio di Settembre 2008", val. 25.09.2008 → **doppione del 2008**.
- [x] Griglia `2008-8` (Settembre 2008): presente e corretta (0152:296,32 / pres.18 / ferie 6 / arretrati 220,53).
- [x] Griglia `2009-8` (Settembre 2009): contiene gli STESSI numeri 2008 → da sostituire con la vera Set2009.
      (residui da tenere d'occhio post-scan, tipo Tozzi: `fondo_pregresso_31_12`=32354,68, `imponibile_tfr_mensile`=0)
- [ ] Busta NUOVA (mail Gentile): confermare testata = **Settembre 2009** prima di caricarla (NON un altro 2008).

## Sequenza (Caso A — come Tozzi)
- [x] [APP, utente] caricato la vera **Settembre 2009** (l'utente ha fatto cancella+ricarica, non upsert).
      Risultato OK: payslip_metadata Set2009 `year:2009`, presenze 10, UNA riga, no doppione; Set2008 intatto.
- [x] [SQL io] verificato griglia `2009-8` = numeri 2009 reali (0152 296,32→193,34; 3B01 1.615,76→1.685,21; gg 18→10);
      **azzerato `fix_targets` → []**. Residuo MERGE: griglia `arretrati`=220,53 (reale 0) → COSMETICO (colonna "(Esclusi)",
      fuori da TOTALE/credito/%/documenti; cfr. `EXCLUDED_INDEMNITY_COLS`). Lasciato (come residui Tozzi).
- [ ] [APP, utente] **HARD-REFRESH** (anti-clobber: rende stabile il flag azzerato).
- [ ] [DOC, utente] rigenerare documenti Gentile (chiusa → il 2009 cambia: prima Settembre contava i numeri 2008)
      e inviarli allo Studio Celentano con la busta recuperata.
- [opz.] [APP] azzerare "Arretrati / Altro" di Sett 2009 nella griglia (solo estetica, non cambia nulla).

### Review (2026-06-30 pom.)
Recupero #5 (Gentile Set2009) completato. Caso A confermato su buste reali (entrambi i file Settembre = "Set 2008"):
Set2008 era già coperto (file proprio + griglia corretta), lo slot 2009 aveva un doppione del 2008 → sostituito.
Nessuna perdita. Verifica solida; unico residuo cosmetico (arretrati, escluso da tutto). **Recuperi 5/7**, restano
**Avella (Set2009)** + **Cataneo Pasquale (Nov2008)**.

---

# Anteprima PDF prospetto Gagliano per Vincenzo (WhatsApp) — 2026-06-30

> Vincenzo (call 30/06) vuole un'anteprima di Gagliano: la sua vista viewer è bloccata
> (manutenzione + pagamento). Gli giriamo via WhatsApp **solo il prospetto + % incidenza**
> (la pagina report finale, nodo `#riepilogo-card`). Sorgente = **locale (dev)**, formato = **PDF**.
> NB: Gagliano è **incompleta** (mancano buste in recupero) → anteprima PROVVISORIA, da etichettare.

## Vincoli / decisioni
- NON sbloccare l'account viewer di Vincenzo: il `viewer_payment_block` resta `true` (leva 750 €).
  L'anteprima è un artefatto piatto (PDF), non accesso alla piattaforma.
- Vista **owner** (mio account, non l'UID di Vincenzo) → si vede Gagliano e si esporta sempre.

## Passi (verifica per passo)
- [x] 1. [ENV] `npm run dev` su (5173 occupata → 5174). Server fermato a fine task.
- [x] 2. [BROWSER] Tab su localhost:5174; login owner fatto dall'utente.
- [x] 3. [NAV] Ricerca "Gagliano" → scheda Gagliano Dario (Mercitalia Rail) → tasto REPORT → pagina incidenza.
- [x] 4. [PDF] Generato PDF di `#riepilogo-card` via captureReportPdfBlob → ma conteneva SOLO il prospetto
      (la tabella % è una card SEPARATA fuori da #riepilogo-card). PDF su Desktop = parziale → superato.
- [x] 5. [CONSEGNA] L'utente ha fatto a mano uno **screenshot** della pagina (prospetto + % insieme):
      `~/Desktop/Screenshot 2026-06-30 alle 11.45.02.png` (545 KB, 2390×1764). Verificato: completo e leggibile.

### Review (2026-06-30)
- Anteprima Gagliano consegnata come **screenshot PNG** (non PDF): include sia il prospetto (TOTALE DOVUTO
  €2.212,51) sia la % incidenza (MEDIA PERIODO 17,09% < soglia 20%). Pronto per WhatsApp.
- Lezione tecnica: `captureReportPdfBlob(#riepilogo-card)` cattura SOLO il prospetto; la tabella % incidenza
  (IndemnityPivotTable) è un nodo sibling fuori dalla card → per un PDF unico servirebbe catturare l'antenato
  comune o un multi-pagina. Per un'anteprima veloce lo screenshot di pagina è la via più semplice.
- Caveat comunicati: pratica parziale (5/7 anni, 96%) → numeri provvisori; viewer di Vincenzo resta bloccato.
- Cleanup: dev server :5174 fermato (il :5173 dell'utente non toccato). PDF parziale su Desktop = da rimuovere.

---

# Recupero buste misfiled #2-#4 — Tozzi (Nov2008 + Set2009) + Cataneo V (Set2009) (2026-06-30)

> Secondo blocco di recuperi dopo Mottola (#1). Playbook = memoria `project-audit-mese-archivio-vs-testata`.
> **Differenza-chiave da Mottola:** i mesi di destinazione (Tozzi Dic2008 e Set2008; Cataneo V Set2008)
> ESISTONO GIÀ con i dati in `payslip_metadata` e nella griglia `anni` → **NIENTE salvataggio-dati SQL**.

## Fatti verificati (PDF + DB, 30/06)
- File veri localizzati e confermati dal contenuto (testata):
  - Tozzi Novembre 2008 → `~/Downloads/Novembre 2008.PDF` (presenze 22, retr. 1.670,27, minimo 1.395,91)
  - Tozzi Settembre 2009 → `~/Downloads/CEDOLINO (24).PDF` (presenze 14, retr. 1.730,27, minimo 1.455,91)
  - Cataneo V Settembre 2009 → `.../CATANEO VINCENZO/2009/Settembre 2009.PDF` (presenze 15, minimo 1.455,91)
- Slot misfiled confermati in `payslip_metadata`: Tozzi Nov2008=ed_month 12 (Dic); Tozzi Set2009=ed_year 2008; Cataneo V Set2009=ed_year 2008.
- Griglia `anni` tiene il contenuto sbagliato: Tozzi Nov2008→dati Dic (TFR mens 28.329,81); Tozzi/CataneoV Set2009→dati Set2008 (minimo 1.395,91, gg 13/17).

## Passi (verifica per passo)
- [x] 1. [APP] Carica+scansiona i 3 file veri nei slot corretti (fatto dall'utente 30/06).
      Rinominato `CEDOLINO (24).PDF`→`Settembre 2009.PDF` → auto-parse + sovrascrittura in-place.
- [x] 2. [APP] Doppione: NON serve — i nomi file allineati hanno fatto sovrascrivere in-place lo stesso storage_path. 1 sola riga per slot, zero "(1)".
- [x] 3. [SQL] `fix_targets`→`[]` per Tozzi (764fef08…) e Cataneo V (b90f6e89…). HARD-REFRESH app pendente lato utente.
- [x] 4. [VERIFICA] Archivio: ed_month/ed_year corretti (Tozzi Nov 12→11, Tozzi/CataneoV Set 2008→2009). Griglia: gg+minimo+voci reali; residuo TFR Tozzi Nov2008 (28.329,81) cosmetico (max anno=28.329,81 con/senza nov → 0 impatto).
- [ ] 5. [DOC] Rigenerare documenti pratiche toccate (utente, nell'app): Tozzi (chiusa, 2008+2009 cambiati) + Cataneo V (trattativa, 2009).
- [x] 6. Memoria aggiornata. Restano 3 recuperi: Avella-Foggia Set2009, Cataneo Pasquale Nov2008, Gentile Set2009.

### Review (2026-06-30)
Recuperi #2-#4 completati. Divisione: utente = carica+scansiona in-app; io = verifica DB + SQL flag.
- **Archivio**: 3 slot corretti in-place (nessun doppione, niente cancellazioni). Mesi destinazione (Dic2008/Set2008) intatti.
- **Griglia `anni`**: Tozzi Set2009 (14gg/1.455,91) e Cataneo V Set2009 (15gg/1.455,91) pienamente corretti; Tozzi Nov2008 voci=novembre reale (0152/0470/0496/0932/0933 ok), unico residuo `imponibile_tfr_mensile` cosmetico (verificato non-total-mover).
- **Niente salvataggio-dati SQL** (a differenza di Mottola: i mesi di destinazione avevano già i dati).
- **Flag**: fix_targets azzerati per i due → spariranno dal badge "da sistemare", dal filtro Urgenze (6→4) e dalla lista buste-mancanti del viewer dopo l'hard-refresh/deploy.
- **Da fare lato utente**: hard-refresh app (anti-clobber); rigenerare i documenti di Tozzi (pratica chiusa: il 2008 prima contava 2× dicembre e zero novembre) e Cataneo V se già prodotti.

---

# Manutenzione sito — deploy + advisor Supabase (2026-06-28) ✅

Scope concordato: **A (deploy) + B (advisor quick win)**. C (refactor codice) escluso.

## A. Deploy degli 8 commit (50aa8b9 → 7bf0a20)
- [x] Gate pre-deploy: `npx tsc --noEmit`=0, `npm test`=229/229 verdi, `npm run build`=ok (exit 0).
- [x] `git push origin main` (96af9b8..7bf0a20). Netlify auto-deploy `railflow-2`.
- [x] Verifica live: deploy `ready/current`; l'entry servito `assets/index-CeFE0ynh.js` combacia con l'hash del build locale → il nuovo bundle è online.
- [x] Blocco viewer: `app_settings.viewer_payment_block=true`, `payment_amount_eur=750` (invariato) → Vincenzo al login trova il blocco "manutenzione" con importo. Importo TENUTO (saldo legato al recupero buste mancanti).

## B. Advisor Supabase (migration MCP `pin_function_search_path_and_index_messages_author`)
- [x] `function_search_path_mutable` ×4 risolto: `search_path=''` sui 3 trigger (handle_updated_at, update_updated_at_column, scan_sessions_block_immutable_changes); `search_path=public` su `match_legal_chunks` (referenzia tabelle + operatore `<=>` del vector in public → '' lo romperebbe).
- [x] `unindexed_foreign_keys` su `messages.author_id` → `idx_messages_author_id`.
- [x] Advisor ri-controllato: i 5 lint chiusi. Restano per scelta (bassa priorità): RLS `USING(true)` ×6 (RAG legal_*), security-definer QR ×4, `extension_in_public` (vector), leaked-password (Pro-only won't-fix).

## Aperti (outward-facing, NON eseguiti senza OK)
- [ ] Annuncio bacheca "buste paga mancanti" (`messages` via MCP): testo pronto, **in attesa OK** prima di pubblicare.
- [ ] Spegnere il blocco 750€ quando Vincenzo paga: `UPDATE public.app_settings SET viewer_payment_block=false, updated_at=now() WHERE id=1;`

---

# Piano — Vista Vincenzo: messaggio (solo pagati) + Word disguido Margherita (2026-06-28)

> Prima della manutenzione: due ritocchi sulle "buste paga mancanti".
> Fonti distinte nel codice: `fix_targets`/`fixTargets` = misfiled (disguido Margherita,
> mesi presenti ma "pieni" di busta sbagliata → invisibili a `formatMissingMonths`);
> `status==='inviata'` = buste genuinamente mancanti (base del Word).
> DB: 6 lavoratori con fix_targets → 4 pagati (Avella, Gentile, Mottola, Tozzi) + 2 Cataneo non pagati.

- [x] 1. `components/ViewerPaymentBlock.tsx` — elenco buste mancanti del messaggio solo per i PAGATI
      (select +`status`, filtro `isPaid`) → spariscono i 2 Cataneo, restano i 4.
- [x] 2. `utils/reportGenerator.ts` (`generateReport`) — nuova sezione dedicata "disguido nominativi"
      con tutti e 6 i lavoratori con `fixTargets` (`formatFixTargets`), in coda ai mesi-mancanti reali.
      Refactor: `buildMissingTable` → `buildNameValueTable(workers, header2, valueFn)` riusato 2 volte.
- verifica: `tsc --noEmit`=0 ✓; 229 test verdi ✓; Word generato realmente (test usa-e-getta
  con file-saver mockato → XML del .docx contiene sezione disguido + tutti i fixTargets + sezione mancanti) ✓.

### Review
- **Intervento 1**: messaggio di Vincenzo ora elenca solo i 4 pagati, raggruppati per periodo
  (verificato via SQL = stessa logica del componente): *Novembre 2008* → Mottola, Tozzi;
  *Settembre 2009* → Avella (Foggia), Gentile, Tozzi. I 2 Cataneo (inviata/trattativa) esclusi.
- **Intervento 2**: il Word ha ora 2 blocchi — (a) mesi realmente mancanti dei 7 'inviata' (invariato);
  (b) sezione "Buste paga da ricontrollare — disguido nominativi" con tutti e 6 i lavoratori misfiled
  (anche i pagati), nota controllo Margherita/studio Celentano, mesi formattati con `formatFixTargets`.
- Nessuna migration (sola lettura). Modifiche locali NON deployate (batch col deploy di manutenzione).

---

# Piano — Viewer Vincenzo post-sblocco: "vede tutto, scarica le Pagate" + buste mancanti (2026-06-28)

> Cambio di policy rispetto al lockdown del 16/06. Oggi il viewer vede SOLO le Pagate
> e non scarica nulla. Nuova regola: **vede tutto**, ma **scarica/stampa solo le pratiche
> Pagate** (per quelle può portarsi via TUTTO: conteggi, relazione, Excel, ZIP/PDF buste —
> tranne il backup JSON gestionale). Più: aggiornare il messaggio di blocco con l'elenco
> delle buste paga mancanti, e replicarlo come annuncio persistente in bacheca.

**Decisioni (confermate dall'utente 28/06):**
- Visibilità: il viewer vede TUTTE le pratiche in ogni stato (anche buste in lavorazione e Viterbo `in_corso`).
- Download: solo sulle PAGATE → "tutto della pratica" (escluso backup JSON gestionale). Non-pagate = sola consultazione a video.
- "Pagata" = buste/RFI `worker.status==='chiusa'`; riposi `pratica.stato==='pagata'`.
- Elenco buste mancanti: nel blocco pagamento **+** annuncio persistente in bacheca.

## Parte 1 — Visibilità: vede tutto  ✅
- [x] 1.1 `hooks/useWorkers.ts` — rimosso filtro `status==='chiusa'` per il viewer → `list = all` (+ import orfano).
- [x] 1.2 `hooks/usePraticheRiposi.ts` — rimosso filtro `stato==='pagata'` → `setPratiche(list)` (+ import/var orfani).

## Parte 2 — Download SOLO sulle Pagate ("tutto della pratica")  ✅
- [x] 2.1 Helper `canExportForViewer(isReadOnly, isPaid)` in `lib/readonly.ts`.
- [x] 2.2 Buste/RFI (gate su `worker.status==='chiusa'`):
      `TableComponent` → "Documenti" (ZIP: conteggi+riepilogo+relazione .docx) e "Stampa";
      `RelazioneModal` (testuale) → bottoni "Stampa Ufficiale"/"Copia" (a video resta consultabile);
      `ArchivePage` → "Download" busta PDF (gate su `selectedWorker.status`).
- [x] 2.3 Riposi `RiposiPraticaDetail` (gate su `pratica.stato==='pagata'`): blocco azioni Excel/Relazione/Stampa conteggi + RelazioneRiposiModal.
- [x] 2.4 Restano owner-only: "Diffida"; `StatsDashboard` "EXPORT REPORT" (aggregato globale, non per-pratica);
      menu "Dati"; "Export Backup" isola; "Apri vademecum"; verify Gemini; ogni bottone di editing.
- verifica: `tsc --noEmit` = 0 ✓; test ⏳; rilettura diff ⏳.

## Parte 3 — Buste mancanti (blocco + bacheca)
Fonte unica = `worker_profiles.fix_targets` (già allineati alla lista utente). Niente costanti duplicate.
Lista confermata 28/06 (combacia col DB):
  - NOVEMBRE 2008: Mottola Angelo (RFI), Cataneo Pasquale (Trenitalia), Tozzi Tommaso (RFI)
  - SETTEMBRE 2009: Avella Antonio (RFI), Cataneo Vincenzo (RFI), Gentile Celestino (RFI), Tozzi Tommaso (RFI)
- [x] 3.1 Verifica allineamento DB↔lista: 6 worker, fix_targets identici. Nessun UPDATE dati.
- [x] 3.2 `ViewerPaymentBlock.tsx` — sezione "Buste paga mancanti" (query live, raggruppata per periodo; sparisce quando sistemi tutto).
      Testo riscritto in chiave **manutenzione** (no "accesso sospeso"); credito "da regolarizzare per il ripristino";
      controllo attribuito a **Margherita** (studio avv. **Celentano**); icona Wrench + accenti ambra/slate.
- [ ] 3.3 Bacheca: annuncio persistente in `messages` via MCP — **testo pronto, in attesa OK utente** prima di pubblicare (outward-facing).
- verifica: tsc=0, 229 test ✓; resa a schermo ⏳ (da deploy).

## Parte 4 — Filtro "Urgenze"  ✅
- [x] 4.1+4.2 `pages/DashboardPage.tsx` — toggle "Urgenze (N)" (rosso, icona AlertCircle) nella barra strumenti; gli urgenti
      calcolati da `workers` (fixTargets non vuoto), riusa la **vista flat** (come la ricerca) senza toccare i cassetti;
      conteggio aggiornato e nascondi-se-zero. Nessuna modifica a `useWorkers`.
- verifica: tsc=0, 229 test ✓; urgenti dal DB = 6.

## Verifica finale
- [ ] `npx tsc --noEmit` pulito · `npm test` verde.
- [ ] Rilettura diff: editing sempre gated `!isReadOnly`; download gated sullo stato; owner invariato.
- [ ] Deploy: accorpare ai 6 commit già in attesa di push.

**Note:** nessuna migration (le RLS consentono già al viewer la SELECT su worker_profiles,
payslip_metadata, storage.objects, pratiche_riposi). Il blocco 750€ resta attivo finché non
saldi — questo piano cambia solo cosa vedrà/scaricherà DOPO lo sblocco.

## Review (2026-06-28)
10 file toccati, tutto chirurgico (2 filtri rimossi + gate export + 1 toggle + sezione blocco). tsc=0, 229 test verdi.
- Viewer: vede tutto; scarica/stampa SOLO le pratiche pagate (buste 'chiusa' / riposi 'pagata'); editing e aggregati owner-only.
- Blocco: narrativa "manutenzione" (icona Wrench, ambra), importo "da regolarizzare", buste mancanti live (Avella → Foggia), Margherita/studio Celentano.
- Filtro "Urgenze (6)" in dashboard via vista flat, senza toccare i cassetti.
- Bacheca (annuncio): testo pronto, **NON pubblicato** (outward-facing, in attesa OK).
- Niente migration (RLS già aperte in lettura). Tutto locale → si attiva col deploy (si accoda ai 6 commit pendenti).
- NB: blocco viewer ancora ATTIVO sul DB (`viewer_payment_block=true`, 750€): spegnere via MCP quando Vincenzo paga.
- Aperto: importo nel blocco (tenere/togliere) da confermare.

---

# Lockdown account viewer Vincenzo Cataneo (2026-06-16)

Dopo l'incontro 15/06: l'account in sola consultazione di Vincenzo
(`vincenzocataneofg@gmail.com`, UID `34967593-…c7b9e`) deve poter
**solo consultare la sezione "Pagate"** e **non scaricare né stampare**
alcun documento.

"Pagate" = area buste → worker con `status === 'chiusa'` (cassetto "Pagate");
area riposi → pratica con `stato === 'pagata'` (Viterbo è `in_corso` → si nasconde).

Decisione utente (16/06): bloccare anche i pulsanti **Stampa** (= salva-PDF).

## A. Visibilità: solo "Pagate"
- [x] A1 `hooks/useWorkers.ts` — in `loadWorkers(userId)` filtrare `list` a
      `status === 'chiusa'` quando `READONLY_VIEWER_UIDS.has(userId)`
      (chokepoint unico: propaga a cassetti, ricerca, stats, hash, isola).
- [x] A2 `hooks/usePraticheRiposi.ts` — filtrare `pratiche` (DB + seed) a
      `stato === 'pagata'` per il viewer readonly.

## B. Niente download / stampa per il viewer (gate `!isReadOnly`)
- [x] B1 `pages/DashboardPage.tsx` — nascosto l'intero menu "Dati".
- [x] B2 `components/DynamicIsland.tsx` — nascosto "Export Backup" (JSON).
- [x] B3 `components/TableComponent.tsx` — nascosti "Documenti" (ZIP) e
      "Stampa". Lasciata "Relazione" (sola lettura, export già gated).
- [x] B4 `components/StatsDashboard.tsx` — nascosto "EXPORT REPORT" (stampa PDF).
- [x] B5 `pages/ArchivePage.tsx` — nascosto l'anchor "Download" della busta PDF.
- [x] B6 `components/RiposiPraticaDetail.tsx` — nascosti Excel / Relazione .docx / Stampa conteggi.
- [x] B7 `components/RiposiArea.tsx` — nascosto "Apri il vademecum".

## C. Verifica
- [x] `npx tsc --noEmit` pulito (exit 0).
- [x] `npm test` verde — 16 file, 213 test passati.
- [x] Rilettura diff: ogni gate tocca solo il ramo readonly; owner invariato.

## Note / limiti
- Il visore interno della busta (iframe/PDF nativo del browser) ha controlli di
  download propri del browser non bloccabili da codice app: fuori scopo.
- Le RLS sul DB restano invariate (il viewer legge tutto via RLS; il filtro
  "solo pagate" è lato client, coerente con l'architettura readonly esistente).

## Review
Fatto il 2026-06-16. 9 file sorgente toccati, ~modifiche minime (gate `!isReadOnly`
+ 2 filtri al caricamento). 213 test verdi, tsc pulito.

Cosa cambia per l'account di Vincenzo (UID `34967593-…c7b9e`):
- **Vede solo le pratiche "Pagate"** — buste: cassetto 'chiusa'; riposi: 'pagata'
  (Viterbo `in_corso` sparisce). Il filtro è al caricamento, quindi vale anche per
  ricerca, statistiche, deep-link via hash e isola: non può raggiungere una pratica
  non pagata nemmeno per URL.
- **Non può scaricare nulla**: niente menu "Dati" (JSON/Word), niente Export Backup,
  niente "Documenti" (ZIP), niente Excel/Relazione .docx/vademecum, niente Download
  busta dall'archivio.
- **Non può stampare** (decisione 16/06): via i bottoni Stampa report, EXPORT REPORT,
  Stampa conteggi.
- Resta consultabile a video: report, relazione (modale, export già bloccato), buste
  nel visore interno.

Owner (account principale) completamente invariato: tutti i gate sono `!isReadOnly`.

NON deployato: modifiche locali, da accorpare al deploy ufficiale (2026-06-18).

Limite noto: il visore PDF interno (iframe) espone i controlli di download nativi del
browser, non bloccabili da codice app. Se diventa un problema, valutare un render
custom (pdf.js) senza toolbar — fuori dallo scopo di oggi.

---

# Avviso pagamento bloccante viewer (2026-06-16)

Obiettivo: alla prossima apertura, Vincenzo (viewer) trova una schermata a tutto
campo non skippabile = **blocco totale** finché non salda **750 € (non trattabili)**
per le pratiche concluse + l'aggiornamento del sito. Toggle via DB (no redeploy).

- [x] Migration `018_app_settings.sql` (riga singola; SELECT autenticati, UPDATE owner;
      `viewer_payment_block=true`, `payment_amount_eur=750`). **Applicata al DB live** + verificata.
- [x] Hook `useViewerPaymentBlock()` in `lib/readonly.ts` (fail-open).
- [x] Componente `components/ViewerPaymentBlock.tsx` (full-screen, solo logout).
- [x] `App.tsx`: gate di loading + early-return della schermata al posto dell'app.
- [x] `npx tsc --noEmit` pulito · `npm test` verde (213).

Spegnere quando paga (via MCP):
`UPDATE public.app_settings SET viewer_payment_block=false, updated_at=now() WHERE id=1;`

NON deployato: live inerte finché non pubblichi (~18/06). Testo avviso in
`ViewerPaymentBlock.tsx`, modificabile prima del deploy.
