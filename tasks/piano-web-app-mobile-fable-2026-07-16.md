# Piano condiviso — Web app mobile / PWA Valora

> **Destinatario della prima review:** Fable (Claude Code)
> **Data:** 16/07/2026
> **Stato:** Fase 0 completata; tranche 1 "shell mobile sicura" implementata, verificata e **chiusa dall'utente il 16/07/2026**; prossima coda = tranche 1b (manifest/install), senza commit/deploy automatico
> **Ruoli proposti:** Fable = implementer principale; Codex = revisore indipendente e verificatore

## 1. Obiettivo

Rendere Valora realmente utilizzabile da smartphone senza degradare l'esperienza desktop e senza
tentare di comprimere l'intero gestionale analitico dentro uno schermo piccolo.

La direzione consigliata è una **PWA mobile companion** con tre livelli progressivi:

1. **Acquisizione:** scansione/fotocamera, galleria, QR, stato dell'invio.
2. **Consultazione:** dashboard, ricerca pratiche, riepiloghi, archivio e report leggibili.
3. **Gestione mirata:** azioni frequenti e modifiche semplici; le griglie analitiche massive restano
   inizialmente ottimizzate per desktop.

Il progetto non richiede un'app nativa né un secondo backend: React/Vite, Supabase e Netlify Functions
restano la base condivisa.

## 2. Decisione di prodotto da confermare prima di implementare

Fino al 14/07 il target esplicito del gestionale era desktop-only (`tasks/lessons.md`). Questa iniziativa
cambia il perimetro. Prima di scrivere codice, Fable deve valutare e l'utente deve confermare quale livello
mobile è richiesto:

| Livello | Contenuto | Raccomandazione |
| --- | --- | --- |
| A — Scanner | QR, foto, galleria, upload e avanzamento | Obbligatorio; è già quasi pronto |
| B — Consultazione | Dashboard, pratica, report, archivio | Obbligatorio per una web app mobile utile |
| C — Modifica mirata | Stato, note, documenti, campi semplici | Dopo A+B |
| D — Editing analitico completo | Griglie mensili, pivot, TFR, operazioni massive | Da differire salvo requisito esplicito |

**Proposta iniziale:** autorizzare A+B, progettare C, non promettere D nella prima release.

**Decisione confermata dall'utente (16/07/2026):**

1. **A+B autorizzati, con B limitato all'area Incidenza + modalità viewer.**
   Riposi/Indennità/Vertenze restano desktop-only per ora (smoke test desktop a ogni tranche,
   perché condividono AreaSwitch, DynamicIsland e index.css). C si progetta dopo A+B; D fuori.
2. **Niente shell offline:** installabile + online-only. Nessun service worker con cache
   (al più pass-through); decade l'update flow di Fase 1.
3. **Utente mobile primario: owner e viewer alla pari.** Ogni tranche B si verifica in
   entrambe le modalità (blocco pagamento incluso); Fase 2 (scanner) e Fase 3 (consultazione)
   hanno pari priorità.

## 3. Baseline verificata

### Già favorevole al mobile

- `index.html` contiene viewport, theme color, apple-touch-icon e link al manifest.
- `public/manifest.json` contiene nome, icone 192/512, `display: standalone` e colori.
- `index.tsx` separa con lazy loading l'entrypoint `?mobile=true` dal gestionale completo.
- `pages/MobileUploadPage.tsx` offre già fotocamera, galleria/PDF, batch, compressione, feedback aptico,
  Wake Lock, retry e UI sticky/fixed.
- Login e Mobile Upload sono stati provati a **390 × 844 px** senza overflow orizzontale globale; i controlli
  principali misuravano circa 46–58 px in altezza.
- Dashboard e card usano già diversi breakpoint Tailwind e alcune righe a scorrimento orizzontale.

### Gap verificati

- Non esistono service worker, registrazione Workbox/PWA, cache dello shell, strategia di aggiornamento o
  fallback offline.
- `WorkerDetail` mantiene header, command bar e griglie desktop. Nel test a 390 px alcuni contenuti interni
  arrivavano a circa **2.900 px** di larghezza.
- Il report ufficiale arrivava a circa **1.586 px** di larghezza interna e la toolbar non ha una variante mobile.
- `ArchivePage` usa un workspace fisso a tre colonne (`w-72`, `w-80`, viewer), non un flusso drill-down.
- `DynamicIsland` assegna larghezze esplicite fino a 420/500 px.
- `AreaSwitch` è già una pillola compatta fissa in basso a sinistra (icona + etichetta per area),
  ma con target alti ~36 px e possibile sovrapposizione col contenuto in fondo pagina (correzione
  della valutazione).
- Alcune azioni delle card dipendono dall'hover o hanno target inferiori a 44 px.
- `min-h-screen`/`h-screen` sono ancora usati in punti dove su iOS conviene valutare `dvh` e safe area.

## 4. Principi architetturali

1. **Una codebase, due composizioni UI.** Riutilizzare hook, motori e componenti di dominio; consentire
   shell/layout diversi per mobile e desktop.
2. **CSS non basta per le viste dense.** Archivio, report e scheda lavoratore richiedono una diversa
   gerarchia di navigazione, non soltanto breakpoint più piccoli.
3. **Desktop invariato per tranche.** Ogni fase deve dimostrare che i viewport desktop supportati non sono
   cambiati incidentalmente.
4. **Niente cache, niente offline (deciso 16/07/2026).** Il modo più robusto di non cacheare
   cedolini è non avere cache: manifest + HTTPS per l'install, nessun service worker con cache
   (al più pass-through). PDF, base64, risposte Supabase e Netlify Functions non passano mai
   da Cache Storage per costruzione.
5. **Progressive enhancement.** Se una API mobile non esiste (Wake Lock, vibrazione, install prompt), il
   flusso deve continuare con un messaggio comprensibile.
6. **Touch e tastiera entrambi supportati.** Nessuna azione essenziale deve dipendere soltanto da hover,
   drag-and-drop o shortcut.
7. **Niente duplicazione della logica di calcolo.** Le viste mobile presentano gli stessi dati derivati dai
   motori esistenti; non creano un secondo motore “semplificato”.

## 5. Piano per fasi

### Fase 0 — Review di Fable e specifica congelata

**Owner:** Fable, con review Codex

- [x] Verificare i file e le misure riportate nella baseline.
- [x] Confermare o correggere la divisione A/B/C/D.
- [x] Inventariare tutte le azioni reali di Dashboard, Worker Detail, Report e Archivio prima dei mockup.
- [x] Proporre una piccola architettura responsive: hook/breakpoint condiviso, shell mobile e routing/stato.
- [x] Decidere se usare `vite-plugin-pwa` o un service worker minimale, motivando aggiornamenti e caching.
- [x] Identificare rischi su auth, QR anonimo, logout, cache e documenti sensibili.
- [x] Restituire stima relativa per fase (`S/M/L`) e dipendenze; evitare una stima unica dell'intero progetto.

**Gate:** ✅ superato il 16/07/2026 — valutazione GO CON MODIFICHE + decisioni utente in §2
(scope prima release, niente offline, utenti mobile alla pari).

### Fase 1 — Shell mobile sicura (tranche 1) + manifest/install (tranche 1b)

**Obiettivo:** rimuovere i blocker trasversali del telefono senza service worker, senza nuove
dipendenze e senza toccare le viste dense. (Ridefinita il 16/07/2026 dopo la decisione "niente offline".)

**Tranche 1 — "shell mobile sicura": CHIUSA il 16/07/2026.** *Implementata 16/07; review Codex giro 1 = 2 P1
[AreaSwitch 406 px · menu Island tagliato dal clamp] + 1 P2 accessibilità → CORRETTI in
giornata con misure DOM reali a 360/390/430/1280; rifiniture safe-area/disclosure applicate;
gate e collaudo Codex verdi; chiusura approvata dall'utente. Vedi `tasks/todo.md`.*

- [x] Utility condivise in `index.css`: `dvh`, `safe-area-inset-*`, helper touch (`pointer: coarse`)
  — safe-area come `@utility`; `dvh` e `pointer-coarse:` sono nativi di Tailwind v4.
- [x] `DynamicIsland` viewport-bound: larghezze clampate via `max-width` sottraendo margine e
  `safe-area-inset-left/right`; menu responsive su due righe quando il clamp entra in azione.
- [x] `AreaSwitch`: target ≥44 px su touch e verifica che non copra contenuti in fondo pagina
  (la dashboard ha già `pb-20`; la bottom navigation è declassata a opzione da valutare in Fase 3).
- [x] Azioni della `WorkerCard` oggi solo-hover sempre raggiungibili su coarse pointer.
- [x] Passata di misura su Login + Dashboard Incidenza a 390 px; owner verificato direttamente,
  viewer coperto geometricamente dal caso owner e accettato nel collaudo finale dell'utente.
- [x] Conservare lazy loading e code splitting dell'entrypoint mobile (chunk `MobileUploadPage-*`
  verificato nel build).

**Tranche 1b — manifest e install:**

- [ ] Normalizzare manifest e icone, verificando separatamente resa `any` e `maskable`.
- [ ] Decidere l'install dall'entry QR (`?mobile=true` con `start_url: "./"`): sopprimere, scope
  dedicato o accettare documentando.
- [ ] Eventuale SW pass-through senza cache SOLO se emerge un requisito concreto (default: nessun SW).

**Criteri di accettazione:**

- A 360/390/430 px: nessun overflow globale su Login e Dashboard (`scrollWidth ≤ innerWidth`);
  Island mai più larga del viewport in tutti i mode; azioni card raggiungibili senza hover;
  target AreaSwitch ≥44 px.
- A 1280 px e oltre: resa desktop invariata (Island alle larghezze attuali, hover identico a oggi,
  nessun cambio di layout) — la verifica deve dimostrare anche ciò che **non** è cambiato.
- Modalità viewer consultabile a 390 px.
- Smoke test desktop su Riposi e Indennità (condividono i componenti toccati).
- Cache Storage vuota per costruzione (nessun service worker con cache).
- `npx tsc --noEmit` + `npm test` + `npm run build` verdi.
- (Tranche 1b) Avvio standalone con nome, icona e colori corretti su HTTPS.

### Fase 2 — Consolidamento dello scanner mobile

**Obiettivo:** trasformare il flusso già valido nella prima feature mobile production-ready.

- [ ] Gestire session id assente, invalido, scaduto o già chiuso con schermata esplicita.
- [ ] Verificare fotocamera posteriore, galleria, PDF singolo e batch su iOS Safari e Android Chrome.
- [ ] Usare safe area e viewport dinamico per header e action bar fissa.
- [ ] Portare ogni controllo interattivo essenziale ad almeno 44 × 44 px.
- [ ] Mostrare stato online/offline prima dell'invio e preservare la selezione se la rete cade.
- [ ] Definire retry per singolo fascicolo, evitando di cancellare quelli riusciti o quelli ancora da inviare.
- [ ] Comprimere immagini con limite dimensionale/memoria documentato e testare file grandi.
- [ ] Non introdurre persistenza offline dei cedolini senza una review privacy/security dedicata.

**Criteri di accettazione:**

- Nessun invio fallisce silenziosamente.
- L'utente sa sempre quali fascicoli sono riusciti, falliti o ancora da inviare.
- Standby, background breve e perdita temporanea di rete non producono un falso “completato”.
- Nessun object URL o canvas rimane in memoria oltre il flusso necessario.

### Fase 3 — Dashboard e consultazione mobile

**Obiettivo:** trovare e aprire una pratica rapidamente con una mano.

- [ ] Compattare header hero e azioni senza rimuovere comandi reali.
- [ ] Rendere KPI e ricerca prioritari; filtri azienda/status a scroll orizzontale con indizio visivo.
- [ ] Rendere sempre disponibili su touch le azioni che oggi emergono con hover.
- [ ] Ridurre il retro/flip della card o sostituirlo su mobile con menu/sheet accessibile.
- [ ] Verificare ordine del focus, label accessibili, contrasto e `prefers-reduced-motion`.
- [ ] Evitare che Dynamic Island, badge demo e bottom navigation si sovrappongano.

**Criteri di accettazione:**

- Ricerca → apertura pratica completabile senza zoom e senza hover.
- Nessuna azione essenziale sotto 44 px.
- Nessun controllo fisso copre l'ultima card o il campo note.
- Il layout resta leggibile a 200% di zoom e con tastiera software aperta.

### Fase 4 — Scheda lavoratore mobile

**Obiettivo:** consultare la pratica e svolgere le azioni frequenti senza esporre la griglia desktop intera.

**Composizione proposta:**

1. Riepilogo lavoratore e stato.
2. Periodo/anno selezionato.
3. Azioni frequenti: Scan, Mobile Scan, Archivio, Report.
4. Navigazione per sezioni: Mensile, Annuale, Voci, TFR.
5. Vista mensile mobile: elenco mesi → dettaglio mese → elenco voci/campi.

- [ ] Creare header mobile dedicato; non nascondere semplicemente nome e metadati.
- [ ] Trasformare la command bar in azioni primarie + menu “Altro”.
- [ ] Conservare identici nomi e comportamenti dei comandi esistenti.
- [ ] Separare la vista mobile della griglia dal modello dati e dalle funzioni di aggiornamento.
- [ ] Gestire autosave, feedback e conflitti con gli stessi hook del desktop.
- [ ] Mantenere disponibile la tabella completa come modalità desktop/tablet, non come default telefono.

**Criteri di accettazione:**

- Nessun contenitore della scheda causa overflow globale.
- Il cambio anno, la lettura di un mese e un aggiornamento semplice sono completabili su touch.
- Stessi risultati di calcolo tra vista mobile e desktop sullo stesso fixture.
- Nessuna regressione dell'auto-sync o perdita di modifiche cambiando mese/pratica.

### Fase 5 — Report e Archivio mobile

#### Report

- [ ] Conservare la tabella ufficiale come sorgente per stampa/PDF.
- [ ] Presentare su smartphone card per anno, totale dovuto, ticket e incidenze.
- [ ] Spostare azioni secondarie in sheet/menu; mantenere chiari Report, Relazione, Documenti e Stampa.
- [ ] Consentire, come fallback, una vista tabella con scroll confinato e prima colonna sticky.

#### Archivio

- [ ] Sostituire le tre colonne simultanee con drill-down:
  `Lavoratore → Anno → Mese → Documento`.
- [ ] Aggiungere breadcrumb/back coerente e preservare la selezione tornando indietro.
- [ ] Aprire il viewer documento a pagina intera su mobile.
- [ ] Sostituire drag-and-drop con picker/camera quando `pointer: coarse`.

**Criteri di accettazione:**

- Il report è leggibile senza pan globale; stampa/PDF desktop invariati.
- Nell'Archivio si raggiunge un PDF in massimo quattro scelte prevedibili.
- Tornando dal viewer non si perde lavoratore/anno/mese selezionato.
- Nessun URL firmato o PDF viene messo nella cache PWA.

### Fase 6 — QA, rollout e osservabilità

- [ ] Matrice minima: 360×800, 390×844, 412×915, 430×932, tablet 768 px, desktop corrente.
- [ ] Browser reali: iOS Safari/PWA standalone e Android Chrome/PWA standalone.
- [ ] Protocollo di verifica manuale scritto (matrice viewport sopra) + misure DOM scriptate
  (`scrollWidth` vs `innerWidth`, visibilità reale via `offsetParent`); E2E browser (Playwright)
  declassato a opzionale futuro (correzione della valutazione: sproporzionato per un tool interno).
- [ ] Percorso manuale minimo: login → ricerca o scansione → pratica → documento → logout.
- [ ] Eseguire sempre `npx tsc --noEmit`, `npm test`, `npm run build`.
- [ ] Verificare bundle iniziale mobile e assenza di caricamento delle viste desktop non usate.
- [ ] Usare Lighthouse mobile come segnale diagnostico, non come sostituto dei test su dispositivi reali.
- [ ] Rollout progressivo dietro flag/configurazione se le modifiche condivise sono rischiose.
- [ ] Raccogliere feedback reale su: tempo per trovare pratica, invio fascicoli, apertura documento, errori rete.

**Gate di rilascio:** nessun P0/P1 mobile aperto, gate verdi, privacy cache verificata, test su almeno un
dispositivo iOS e uno Android reali.

## 6. File principali da riesaminare

| Area | File |
| --- | --- |
| Entrypoint | `index.tsx`, `App.tsx`, `components/AppRouter.tsx` |
| PWA | `index.html`, `public/manifest.json`, `vite.config.ts`, `package.json` |
| Scanner | `pages/MobileUploadPage.tsx`, `components/QRScannerModal.tsx`, `hooks/useWakeLock.ts` |
| Shell globale | `components/DynamicIsland.tsx`, `components/AreaSwitch.tsx`, `index.css` |
| Dashboard | `pages/DashboardPage.tsx`, `components/WorkerCard.tsx` |
| Scheda | `components/WorkerDetailLayout.tsx`, `components/WorkerDetail/**` |
| Tabelle | `components/WorkerTables/MonthlyDataGrid.tsx`, `AnnualCalculationTable.tsx`, `IndemnityPivotTable.tsx`, `TfrCalculationTable.tsx` |
| Report | `components/TableComponent.tsx`, `RelazioneModal.tsx` |
| Archivio | `pages/ArchivePage.tsx`, `components/WorkerTables/PayslipArchiveTab.tsx` |
| Routing/stato | `hooks/useHashRoute.ts`, `hooks/useWorkers.ts`, `hooks/usePayslipArchive.ts` |

## 7. Modalità di collaborazione Fable ↔ Codex

Per evitare modifiche sovrapposte o due implementazioni concorrenti:

1. **Fable revisiona prima il piano**, senza implementare, e restituisce divergenze e rischi.
2. L'utente approva la prima fase.
3. **Fable implementa una sola fase/tranche**, mantenendo aggiornate le checkbox di questo documento e
   `tasks/todo.md`.
4. **Codex esegue review indipendente** su diff, comportamento mobile, desktop regression, sicurezza cache e gate.
5. Fable incorpora o contesta i finding con evidenza.
6. Solo dopo il gate congiunto si passa alla tranche seguente.

### Handoff minimo dopo ogni tranche

Fable deve consegnare:

- file modificati e motivazione;
- comportamento prima/dopo;
- dispositivi/viewport verificati;
- output di type-check, test e build;
- rischi residui e rollback;
- screenshot o registrazione dei percorsi principali, se la tranche è visuale.

Codex deve consegnare:

- finding ordinati P0/P1/P2 con file e riga;
- verifica indipendente dei criteri di accettazione;
- eventuali regressioni desktop/accessibilità/privacy;
- raccomandazione `GO`, `GO con follow-up` oppure `STOP` per la fase successiva.

## 8. Domande che Fable deve risolvere nella sua valutazione

1. La separazione mobile/desktop va realizzata nei componenti esistenti o con layout di composizione dedicati?
2. Qual è il confine minimo che evita duplicazione tra `MonthlyDataGrid` e la vista mensile mobile?
3. `vite-plugin-pwa` è coerente con la versione Vite attuale e con il deploy Netlify del progetto?
4. Quale strategia service-worker evita caching accidentale di documenti e richieste autenticate?
5. Come impedire che un update PWA interrompa upload o modifiche non ancora sincronizzate?
6. Quali azioni della scheda lavoratore sono davvero prioritarie su telefono?
7. Conviene includere la modifica dati nella prima release o limitarsi a scansione/consultazione?
8. Quale suite E2E minima offre valore senza introdurre un progetto di test sproporzionato?

## 9. Formato richiesto per la risposta di Fable

```md
## Valutazione Fable

### Verdetto
GO / GO CON MODIFICHE / STOP

### Correzioni al piano
1. ...

### Decisioni architetturali consigliate
- ...

### Rischi non coperti
- P0/P1/P2 — evidenza file:riga — mitigazione

### Prima tranche proposta
- Scope incluso
- Scope escluso
- File previsti
- Criteri di accettazione
- Stima S/M/L

### Domande per l'utente
1. ...
```

## 10. Prompt pronto da incollare a Fable

> Leggi integralmente `tasks/piano-web-app-mobile-fable-2026-07-16.md`, `AGENTS.md` e le prime lezioni
> pertinenti di `tasks/lessons.md`. In questo turno non implementare nulla: agisci come architetto/reviewer.
> Verifica il piano contro il codice reale, segnala assunzioni errate con riferimenti `file:riga`, valuta i
> rischi PWA/privacy/regressione desktop e proponi la prima tranche più piccola che produca valore reale.
> Rispondi usando esattamente il formato della sezione “Formato richiesto per la risposta di Fable”.
> Considera Codex come reviewer indipendente delle tranche implementate, non come implementer concorrente.
