# Todo — Visore: "Carica dall'archivio" (account principale) 2026-06-14

Obiettivo: nel Visore Buste Paga del dettaglio lavoratore, sull'account principale
(NON read-only), aggiungere accanto al "Carica busta paga" locale l'opzione
"Carica dall'archivio", con un layout master/detail (anni a sinistra, mesi a destra
in elenco) DIVERSO dalla griglia-calendario dell'account read-only (Vincenzo).

Vincoli:
- Nessuna apertura automatica del visore sull'account principale (resta solo per read-only).
- Egress: la griglia è solo metadati (già caricati), l'egress scatta solo all'apertura
  effettiva di una busta — identico al flusso read-only già esistente.
- Riusare handleOpenArchivedPicks + getSignedUrls già esistenti. Nessuna modifica al
  genitore né al DB. Tutto in components/SplitViewViewer.tsx.
- NON toccare il ramo read-only (Vincenzo tiene la griglia-calendario).

- [x] 1. Stato vuoto non-readonly: toggle in alto `Carica busta paga` (default) | `Carica dall'archivio` (solo se ci sono buste in archivio)
- [x] 2. Pannello archivio master/detail: colonna anni a sx, mesi a dx in elenco (nome file, "—" se mancante, ☑ selezione)
- [x] 3. Azioni: "Tutto l'anno" (apre subito) + "Apri N" (apre i mesi selezionati), riuso onOpenArchivedPicks
- [x] 4. Bottone "← Archivio" abilitato anche non-readonly (torna al picker in modalità archivio)
- [x] 5. tsc + build + test verdi (210/210)
- [x] 6. Sezione review

## Review
Modifica isolata in `components/SplitViewViewer.tsx` (nessun cambio a genitore/DB):
- Import `Archive`, `Check`; costante `MONTH_FULL`.
- Stato locale: `emptyMode` ('local' default | 'archive'), `selectedYear` + `effectiveYear`,
  `hasArchive`. Il toggle archivio appare solo se ci sono buste archiviate.
- Nuovo stato vuoto non-readonly: toggle + (upload locale com'era) / (master-detail anni·mesi).
  Mesi come elenco con nome file, "—" per i mancanti, checkbox di selezione; "Tutto l'anno"
  apre subito, "Apri N" apre i selezionati (anche cross-anno).
- Bottone "← Archivio" ora visibile anche non-readonly (se hasArchive): torna al picker
  impostando emptyMode='archive'.
- Ramo read-only INVARIATO → Vincenzo tiene la griglia-calendario.

Egress: la griglia è solo metadati già caricati (zero egress); il download immagini avviene
solo all'apertura di una busta via getSignedUrls, identico al visore read-only di oggi.

Verifiche: tsc pulito, build ok (4.9s), test 210/210. Verifica visiva interattiva da fare
nel browser (richiede login account principale + lavoratore con buste in archivio).

---

# Todo — Scheda azienda: scelta destinazione per lavoratore 2026-06-14

Click su un lavoratore (scheda azienda) → modale "Dove vuoi andare?" invece di andare
dritto al dettaglio. 4 destinazioni: Dashboard · Dettaglio inserimento · Report finale ·
Archivio lavoratore. Estetica curata + fluida.

- [x] Nuovo componente components/WorkerDestinationModal.tsx (modale 2x2, blur, spring-in, entrata sfalsata card, hover lift+glow, Esc/click-fuori/X, scroll lock)
- [x] CompanyPage: stato navWorker, riga apre la modale (setNavWorker) invece di onOpenWorker; AnimatePresence; nuove prop onOpenReport/onOpenArchive/onGoDashboard
- [x] AppRouter: passa handleOpenSimple (report), handleOpenArchive (archivio), handleBack (dashboard + detail già su handleOpenComplex)
- [x] tsc + build + test verdi (210/210)

Mappa destinazioni → handler esistenti: Dashboard=handleBack · Dettaglio=handleOpenComplex
· Report=handleOpenSimple · Archivio=handleOpenArchive. Nessuna rotta nuova.

---

# Todo — Account Vincenzo: bacheca annunci + picker semplificato 2026-06-14

Ultime 2 cose prima del deploy Netlify (demo avvocato 15/06).

## A) Bacheca annunci (casella di posta one-way: owner → Vincenzo)
- [x] Migration 016_messages.sql (tabella + RLS): SELECT aperto agli autenticati, scrittura owner-scoped. APPLICATA LIVE su bpnkjfboijfhnqovymwg (4 policy verificate) + file in repo.
- [x] hooks/useMessages.ts: listMessages / sendMessage / deleteMessage + useUnreadMessages (badge via localStorage messages_last_seen_at)
- [x] components/MessagesInbox.tsx: modale; owner = compositore + cestino; readonly = sola lettura; apre → marca letti
- [x] DashboardPage: pulsante 📩 nell'header (badge non letti) visibile a entrambi
Stato "letto" sul dispositivo del viewer → suo account resta SOLA LETTURA sul DB.

## B) Picker archivio di Vincenzo → drill-down tap-to-open
- [x] SplitViewViewer ramo isReadOnly: selettore anno (pillole) + mesi esistenti come pulsanti, TAP = apre subito; "Tutto l'anno" resta; rimossi tratteggi/×N/multi-selezione. (Account principale invariato.)

## C) Verifica
- [x] tsc + build + test verdi (210/210)

## Review
- MODELLO RIVISTO (richiesta utente): la bacheca = annunci di SISTEMA inviati da Claude via MCP, NON dall'app. Migration 017 LIVE: author_id nullable + droppate le policy di scrittura (resta solo SELECT). MessagesInbox = sola lettura (niente compositore). Icona 📩 solo per i viewer (isReadOnly), l'owner non la vede.
- DB: tabella `messages` live, 1 policy SELECT `USING(true)` authenticated. Invio: `INSERT INTO public.messages (title, body) VALUES (...)` via service role. Egress trascurabile (testo).
- Nessuna scrittura dal client: lo stato letto è localStorage → account Vincenzo resta sola-lettura sul DB.
- Picker readonly semplificato; ramo account principale (master/detail) NON toccato.
- DA FARE a mano in app: verifica visiva (invio messaggio dal tuo account → compare con badge su quello di Vincenzo dopo il deploy; picker drill-down sul suo account).
