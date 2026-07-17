# Lessons — Self-Correction Log

> Pattern e errori da evitare nelle prossime sessioni.
> Aggiornato dopo ogni correzione utente.

## 2026-07-17 — RLS anon: tre regole pagate care (Fase 2 scanner mobile, 6 giri di review)

**Contesto:** consolidamento scanner QR. Il mio probe "sessione viva" via UPDATE+count è
stato bocciato in review; la verifica empirica sul DB live ha dato ragione al reviewer e
scoperto che il canale di stato telefono→PC era GIÀ rotto in produzione da un mese e
mezzo. Il primo fix (policy SELECT anon, migration 027) era a sua volta una falla di
enumerazione, superata dalla 028 (RPC whitelistata + revoca superficie diretta).

**Le tre regole:**
1. **Un UPDATE con WHERE sotto RLS richiede ANCHE visibilità SELECT** sulle righe, oltre
   alla USING della policy UPDATE (il WHERE "legge"). Senza, l'update tocca 0 righe IN
   SILENZIO (PostgREST 204, error null). Corollario: droppare una policy SELECT
   permissiva (qui la 012) può rompere gli UPDATE di un altro ruolo senza alcun errore.
2. **Una policy USING con `funzione(id)` è valutata PER RIGA: non prova che il chiamante
   conosca l'id** → SELECT senza filtro = enumerazione completa (qui: tutte le sessioni
   vive e, peggio, i payload dei cedolini via la gemella della 010). Il canale giusto per
   un client anonimo che "conosce un segreto" è una **RPC SECURITY DEFINER con il segreto
   come parametro esplicito e transizioni/campi whitelistati** — mai una policy per-riga.
3. **"La feature funziona in prod" non prova che OGNI canale funzioni.** Qui il canale
   rotto era mascherato da due fallback involontari (payload via INSERT funzionante +
   telefono loggato come owner che passa dalla SELECT owner-scoped). Prima di costruire
   sopra un canale esistente, testarlo ISOLATO con il ruolo reale (client anon vero
   contro il DB live, verifica server-side che la scrittura sia atterrata) — è lo stesso
   principio dell'autovalidazione dei parser (11/07), applicato all'infrastruttura.

**Bonus di metodo:** la review avversaria (Codex) ha reso 2 P0 veri su 2 — ma al 6° giro
proponeva ancora hardening da sistema distribuito su un tool interno single-user: i
finding si INCORPORANO finché violano i criteri di accettazione, si CONTESTANO con
motivazione quando il costo supera il rischio (doppio toast in una finestra di 2s ≠ P1).
L'utente ha chiuso il loop esplicitamente («basta chiedere a codex»).

## 2026-07-16 — Clampare il contenitore non rende responsive il contenuto; e una correzione di baseline va propagata alle conseguenze

**Contesto:** tranche 1 mobile. Review Codex: due P1 su lavoro che avevo consegnato "a criteri
soddisfatti". (a) AreaSwitch ≈406 px a 390: avevo CORRETTO io stesso la baseline del piano
("le etichette sono sempre visibili, non solo sull'attiva") ma non ho mai ricalcolato la
larghezza totale che ne discende — ho sistemato i target touch e dichiarato la pillola ok.
(b) DynamicIsland: `maxWidth` conteneva il guscio, ma il menu interno (~415 px) veniva
tagliato da `overflow:hidden` — contenere ≠ rendere responsive, l'avevo perfino scritto io
nella valutazione ("CSS non basta per le viste dense") senza applicarlo al mio stesso fix.

**Aggravante scoperta col fix:** il primo tentativo (`flex-wrap` incondizionato) avrebbe
spezzato la riga del menu ANCHE a 420 px desktop: il contenuto chiede 369 px contro ~365
disponibili — oggi la differenza è clippata invisibilmente, il wrap l'avrebbe resa visibile.
Trovato solo MISURANDO il DOM reale (harness con i componenti veri in iframe a larghezza
esatta), non dall'aritmetica delle classi. Fix giusto: wrap gated alla soglia del clamp
(`max-[444px]:flex-wrap`, 444 = 420 + margine 24).

**Lezione:**
1. Quando correggi un'assunzione di baseline (qui: "etichetta solo sull'attiva" → "sempre
   tutte"), rifai i conti di TUTTO ciò che vi poggiava, non solo del punto in discussione.
2. Un clamp/contenimento sul contenitore va sempre verificato aprendo gli stati LARGHI del
   contenuto (menu, pannelli, mode espansi): se dentro c'è una riga progettata al pixel,
   contenerla = tagliarla.
3. Le righe flex "giuste al pixel" possono già essere in overflow clippato di pochi px su
   main: un `flex-wrap` aggiunto lì cambia il desktop. Gate del wrap alla larghezza in cui
   serve davvero, e SEMPRE misura prima/dopo alla larghezza desktop di riferimento.
4. Per misurare componenti dietro login senza credenziali: harness temporaneo che monta i
   componenti REALI + iframe same-origin a larghezza esatta (le media query rispondono alla
   larghezza dell'iframe). Chrome headless ignora `--window-size` sotto ~500 px: non è la
   strada. Eliminare l'harness a fine giro.

## 2026-07-14 — Se il prodotto è desktop-only, investire la QA dove viene davvero usato

**Contesto:** durante il restyling dell'Archivio avevo continuato a trattare la resa mobile come un
vincolo prioritario; l'utente ha chiarito che, in questa fase, il sito viene usato esclusivamente da desktop.

**Lezione:**
1. Registrare subito il target di utilizzo dichiarato e concentrare layout, densità e prove sui viewport reali.
2. Non introdurre regressioni gratuite sui breakpoint piccoli, ma non sacrificare qualità desktop né tempo di
   rifinitura per un supporto mobile che non fa parte dello scope approvato.
3. Nei report finali distinguere tra “non rotto incidentalmente” e “supportato/verificato”: qui la garanzia è desktop.

## 2026-07-14 — La fascia deve appartenere alla pagina: raggio e scala percepita si valutano nel contesto

**Contesto:** la prima versione della nuova fascia istituzionale, pur coerente col ritaglio del mockup,
risultava troppo spigolosa dentro la pagina reale. L'utente ha inoltre chiesto più presenza al logo
senza aumentare l'altezza della barra.

**Lezione:**
1. Non trasferire meccanicamente il bordo di un ritaglio: confrontare il raggio con le card e le hero
   circostanti, perché una fascia rettangolare può stonare in un sistema molto arrotondato.
2. Per ingrandire un logo senza alterare il ritmo verticale, separare **box di layout** e **scala visiva**:
   mantenere la stessa altezza intrinseca e applicare una scala moderata, verificando che l'overflow
   del contenitore non tagli stelle, archi o tricolore.
3. La QA deve misurare sia l'altezza della fascia prima/dopo sia il bounding box visivo del logo: “più
   grande” non deve trasformarsi accidentalmente in “più spazio vuoto sopra la dashboard”.

## 2026-07-14 — Un mockup ampio non autorizza un restyling ampio: implementare per tranche

**Contesto:** dopo aver mostrato una proposta completa per la dashboard, l'utente ha scelto di
realizzare per ora soltanto la fascia organizzativa superiore e di lasciare invariato tutto il
resto. La stessa fascia deve essere speculare nelle tre sezioni operative.

**Lezione:**
1. Il mockup serve a scegliere una direzione, non amplia automaticamente lo scope di implementazione:
   modificare esclusivamente la zona esplicitamente approvata.
2. Quando una porzione deve essere “speculare” in più viste, cercare prima un componente condiviso e
   intervenire lì; nei call site limitarsi all'allineamento indispensabile.
3. La verifica del diff deve dimostrare anche ciò che **non** è cambiato: hero, KPI, filtri, card e
   navigazione restano fuori dallo scope finché l'utente non approva la tranche successiva.

## 2026-07-14 — Un PNG “trasparente” non è riuscito se gli interni restano semitrasparenti

**Contesto:** il logo FAST-CONFSAL sembrava corretto nell'anteprima su fondo neutro e il file aveva
un canale alpha valido, ma nell'app l'utente ha notato colori leggermente desaturati. Il ritaglio
aveva lasciato molti pixel interni parzialmente trasparenti: sui pannelli chiari il colore si
miscelava col fondo. Inoltre il blocco istituzionale era stato verificato come funzionante, ma non
abbastanza rifinito per scala e gerarchia tipografica.

**Lezione:**
1. Per un logo opaco, `hasAlpha=yes` e angoli trasparenti NON bastano: verificare l'istogramma alpha
   e pretendere interni a 255; la semitrasparenza deve restare solo sul bordo antialias.
2. Comporre il PNG su almeno un fondo bianco, uno colorato chiaro e uno scuro: un ritaglio può
   sembrare fedele su bianco ma perdere saturazione su vetro/gradienti.
3. La QA del brand include l'intero blocco nel contesto reale: dimensione percepita, gerarchia delle
   diciture e rapporto con gli header. “Presente e leggibile” non equivale a “adeguato e autorevole”.
4. Quando si uniforma un logo in tutti i render, verificare **anche la scala percepita di ciascun
   contesto**: la stessa altezza non è equivalente accanto a un titolo da 36 px, dentro una card o
   in una testata isolata. Inventario = asset, filtro tema, contenitore e dimensione, non solo `src`.

## 2026-07-11 — Parser FSE/Mercitalia: riconcilia ogni documento col SUO totale stampato; e ri-misura le conclusioni dei report passati

**Contesto:** parser di verità FSE + Mercitalia. Il report Clarino (§4.3) prescriveva "banda GG LAV
come fonte primaria" e (§2b) affermava "banda vuota in Set 2022". Entrambe le affermazioni — mie,
di 12 ore prima — erano FALSE sui PDF reali: la banda stampa un **22 teorico** in tutta l'era IX,
perfino nel mese di congedo totale. Se avessi implementato il requisito com'era scritto, il flag
avrebbe prodotto 27+ falsi allarmi.

**Lezione:**
1. **Una conclusione scritta in un report (anche mio) non è un fatto: è un'ipotesi da ri-misurare**
   quando ci si costruisce sopra del codice. La calibrazione su TUTTO il corpus (107 buste) ha
   ribaltato il design in 10 minuti di batch. Cfr. lezione 21/05 ("invarianti non verificate").
2. **Pattern d'oro per i parser di cedolini: l'autovalidazione per-documento.** Somma TUTTO ciò che
   leggi nella colonna e confrontala col totale stampato sul documento stesso (TOT COMPETENZE /
   riga "Totali"): se non quadra, la lettura o il layout è sbagliato → il documento si SCARTA come
   verità, mai "si spera". Così sono saltate fuori 3 trappole invisibili a occhio: la riga banca
   "INTESA SANPAOLO … Emolumenti correnti" (dal 2022 cade in zona Competenze e "INTESA" passa il
   regex codice), l'esonero D01CNG (in zona Competenze ma NON nel totale) e i crediti WZF* DL 66/2014
   (nel totale ma NON voci). Un campione a mano non le avrebbe mai trovate tutte.
3. **I form ristampano interi blocchi sul retro** (banda, box ELEMENTI, header voci): ogni blocco va
   letto UNA volta o con regione delimitata (header → separatore "----"/NOTE), altrimenti i fissi
   raddoppiano. E il flag giusto per i giorni ambigui è quello che l'app usa già (presenze>31), non
   un confronto con un campo dalla semantica non dimostrata.

**Appendice (stesso 11/07, dallo scetticismo dell'utente sul primo report live).** Il primo giro su
Clarino proponeva 3 correzioni ai giorni: 2 erano ERRORI del parser, 1 era un errore vero del motore
(Lug 2017: 22 teorico vs 20 su DUE voci concordi). Altre due regole imparate sui casi veri:
4. **Un parser per-file non può vedere gli arretrati cross-mese.** Dic 2017 non stampa la voce
   giornaliera (pagata dentro il 38 di Gen 2018): il PDF da solo "direbbe 0", ma azzerare
   distruggerebbe il 22 documentato → voce di presenza ASSENTE + motore≠0 = segnalazione
   (daysMissingVoce), MAI correzione automatica. Cfr. `ocr-ambiguity-flag-policy`.
5. **La quantità è un giorno solo se qty × tariffa = importo.** Ago 2018 ha una riga IX0023 di
   conguaglio con qty "1" e 84,76 senza tariffa unitaria: contatore fittizio che gonfiava i giorni
   (27 vs 26). Il guard qty×unit≈importo l'ha eliminata e sul corpus intero ha cambiato SOLO quel
   mese (verificato col diff pre/post fix).

## 2026-07-10 — Non trasformare il quesito per l'avvocato in un GATE sul lavoro dell'utente

**Contesto:** estensione FSE era storica. Avevo impostato la sequenza come "estendiamo colonne/prompt
SOLO dopo la risposta dell'avvocato al quesito 2" e presentavo i totali del perito come riferimento
da inseguire. L'utente mi ha corretto due volte nella stessa giornata: «estendi il prompt, ci serve
il lavoro finito di tutti gli anni» e poi «i nostri calcoli come li facciamo noi, il perito era una
linea guida».

**Lezione:**
1. **I quesiti per i terzi (avvocato/perito) sono flag, non lucchetti.** "Noi prepariamo, l'avvocato
   decide" significa: costruisci la capacità, documenta il punto aperto e vai avanti — non subordinare
   lo strumento dell'utente a una risposta esterna che può arrivare tra settimane.
2. **Una decisione di metodo registrata in memoria ("seguiamo il perito", 09/07) non è eterna:**
   quando inizia a vincolare lavoro nuovo, ri-verificarla con l'utente invece di applicarla come
   dogma. Il riferimento esterno serve a capire i documenti (la riconciliazione 49/49 = prova di
   lettura corretta), non a definire il perimetro dei NOSTRI conteggi.
3. Quando l'utente delega il criterio ("secondo te vanno messe?"), rispondere nel merito con una
   regola difendibile e coerente (qui: dentro le indennità di prestazione perse in ferie; fuori il
   lavoro aggiuntivo e i fissi mensili pagati anche in ferie — con prova empirica: la 663 storica
   paga 26gg anche con 17gg di ferie) e implementarla subito, marcando le zone grigie (041
   festività) come note per l'avvocato.

## 2026-07-09 — Riga nowrap con clip: non dichiararla "sicura" a tavolino, il taglio dipende dal viewport

**Contesto:** chip azienda nella striscia compatta della dashboard (nowrap + `overflow-hidden` +
clip-path). Ho calcolato le proporzioni dei loghi, concluso che il chip FSE "entra comodo — zero
modifiche, zero rischio", relegando il taglio a caveat teorico ("se un giorno dà fastidio…").
L'utente ha risposto che i chip **si tagliano già** sul suo schermo → fix subito dopo
(`min-w-0 overflow-x-auto no-scrollbar` sul contenitore, commit ca312aa).

**Lezione:**
1. In una riga `nowrap` dentro un contenitore che CLIPPA, il taglio non dipende (solo) dalla
   larghezza dei nuovi elementi ma dal **viewport reale dell'utente** + zoom: la matematica sugli
   asset dice "quanto è largo il contenuto", non "quanto è larga la finestra". Non dichiarare
   "zero rischio" ciò che non posso osservare (cfr. `feedback-verifica-video-utente`: la verifica
   visiva la fa l'utente).
2. Quando la salvaguardia costa 3 classi CSS già presenti nel progetto (`overflow-x-auto` +
   `no-scrollbar` + `min-w-0`), **proporla subito** invece di rimandarla come caveat: un contenuto
   che può crescere (aziende/chip/pill) dentro un clip è un bug latente, non un edge case.
3. Dentro un contenitore reso scrollabile, hover `scale` e animazioni d'entrata con offset verticale
   vengono clippati dall'overflow: dare aria con `py-N -my-N`.

## 2026-07-07 — Parser banda presenze: colonna gemella "Assenze retribuite" vs "non retribuite" + verifica in Node

**Contesto:** aggiunta di `daysPaidLeave` (assenze retribuite) al parser di verità RFI/Trenitalia,
utile per i due Cataneo in distacco sindacale (con il toggle "Permessi"/Strategia B entra nel
DIVISORE → total-mover, non info). L'utente mi ha invitato a "verificarlo io stesso perché è un
campo presente in tutti e due i layout".

**Due errori evitati SOLO grazie alla verifica su PDF reali:**
1. **Colonna gemella.** La banda ha `... Infortuni | Assenze Retribuite | Assenze non retribuite | Ferie...`.
   Il mio primo confine di colonna (prima etichetta a destra che NON contiene "retribuit") SALTAVA
   la colonna "non retribuite" e, quando la retribuita era vuota (Vincenzo Giu 2007), pescava il
   valore della colonna NON retribuita → falso positivo `daysPaidLeave=1`. Fix: confine = etichetta
   **immediatamente successiva** (`labels[idx+1].x`), cioè l'inizio di "Assenze non retribuite".
2. **Assunzione "campo solo informativo" sbagliata:** lo è di DEFAULT, ma il toggle "Permessi"
   ([VertenzaTimeline] + [MonthlyDataGrid]) lo somma al divisore per i distaccati → va verificato eccome.

**Regola (per QUALSIASI parser di colonna su banda tabellare):**
> Prima di dichiararlo fatto, gira il parser in **Node con la stessa pdfjs-dist del progetto**
> contro PDF REALI, su ENTRAMBI i layout e su regimi diversi (qui: pre-distacco vs distacco pieno).
> Sono bastate 24 buste (Vincenzo 2007+2025, Pasquale) per scoprire il bug della colonna gemella e
> confermare la fix (dw/pl coerenti col distacco, 0 anomalie). Diffidare di etichette quasi-identiche
> adiacenti (`X` vs `X non`): ancorare al confine della colonna SUCCESSIVA, non a un match testuale
> che le confonde. Cfr. lezione 21/05 (disambiguazione spaziale Presenze/Riposi) e `ocr-ambiguity-flag-policy`.

**Bonus (stessa sessione):** memory leak nel parser — `extractRfiTruth` non chiamava mai
`pdf.destroy()`; sulla prova d'accuratezza (cartella 200+ buste) i documenti PDF.js si accumulavano
→ tab in OOM (Chrome "Uffa!", codice errore 5). Fix: `try/finally` con `await pdf.destroy()` +
`page.cleanup()`. Regola: ogni `getDocument()` va sempre bilanciato con `destroy()` in un `finally`,
come già faceva `extractPdfText` in `lib/pdfChunker.ts`.

## 2026-07-07 — Mockup di restyle: PARTIRE dall'inventario reale dei controlli, non da uno schizzo "pulito"

**Contesto:** proposto un mockup HTML del restyle "sala macchine" (scheda lavoratore). L'utente l'ha
respinto: «hai omesso molti tasti che ci sono — start year, archivio in tabella, verifica anno… ho paura
che tolga troppe cose importanti; e i tasti in alto devono mantenere la stessa estetica che hanno ora,
non vanno semplificati». Inoltre avevo messo un tasto "Export" che NON esiste (il nostro è "Download").

**Errore:** ho disegnato un mockup "da zero" come idealizzazione grafica, trattandolo come fonte di verità
sui comandi. Un mockup pulito che omette controlli reali viene letto (giustamente) come "proposta di
rimozione". Ho anche introdotto un'etichetta ("Export") non ancorata a nessun comando esistente.

**Lezione (per QUALSIASI restyle di una vista esistente):**
1. **Prima l'inventario dal codice, poi il layout.** Estrarre la lista COMPLETA dei controlli reali
   (grep su `title=`/label/onClick nei file della vista) e verificarla con l'utente. Il restyle
   RI-DISPONE quegli stessi controlli; non è l'occasione per potarli.
2. **Zero tasti-fantasma:** ogni elemento del mockup deve mappare 1:1 su un comando esistente, col
   NOME reale che usa l'app (da noi: "Download", non "Export"; "Verifica anno"; "Start Year"; "Archivio").
3. **L'estetica dei tasti esistenti è un vincolo, non una variabile.** "Raggruppare sotto etichette"
   ≠ "ridisegnare i tasti". I bottoni in alto (glass-panel, gradienti, spotlight) restano identici;
   cambia solo la loro organizzazione/contenitore.
4. Un mockup di restyle va marcato esplicitamente come "stessi comandi, riorganizzati" e mostrato con
   TUTTI i controlli presenti, o non mostrato affatto. Renderlo **theme-aware** (l'app ha chiaro E scuro):
   non bloccarlo su un tema. Cfr. lezione 03/07 (non ridisegnare il logo scelto) e `feedback-verifica-video-utente`.
5. **L'inventario si traccia dal file che COMPONE la vista, non dai singoli file che capita di aprire.**
   Qui la scheda lavoratore è composta in `WorkerDetailLayout.tsx` (Header → **VertenzaTimeline** → CommandBar →
   Content). Avendo greppato solo Header/CommandBar/Grid mi erano sfuggiti un intero blocco (STATO VERTENZA:
   timeline dei 5 cassetti + toggle Ex-Festività/Ticket/Permessi) e le **statistiche vere** (le card di
   `useStatsData` che scorrono nel ticker: Totale da liquidare, ISTAT+interessi, Lordo spettante, TFR su diff…),
   che avevo perfino "corretto" via come inventate. Regola: apri prima il file di layout/compose e segui OGNI
   sottocomponente montato; e prima di dire "questa stat è inventata", cerca la sua label in `hooks/use*Stats*`.

## 2026-07-05 — Dropdown dentro un pannello con backdrop-blur: audit di TUTTI gli z-index fratelli, non solo del vicino

**Contesto:** inglobando i pulsanti (incluso il menu a tendina "Dati") nell'header hero glass dell'Incidenza,
il `backdrop-blur` del pannello crea uno stacking context → lo `z-50` del menu vale solo DENTRO il pannello.
Avevo previsto il conflitto con la striscia statistiche (`z-10`) dando `z-20` al pannello, ma la sezione
ricerca/filtri era ANCH'ESSA `z-20` e viene DOPO nel DOM → **a parità di z-index vince chi viene dopo** →
menu sotto la barra di ricerca e i chip azienda (bug segnalato dall'utente con screenshot).

**Lezione:**
1. Quando un dropdown/absolute finisce dentro un contenitore che crea stacking context (`backdrop-filter`,
   `transform`, `filter`…), il suo z-index NON compete più con l'esterno: conta lo z del **contenitore**.
2. Prima di scegliere quel valore: `grep "z-"` su TUTTA la pagina e confrontare i **fratelli/sezioni successive**
   (non solo l'elemento adiacente); superare il massimo dei concorrenti reali, ricordando che a parità vince
   il successivo nel DOM. Gli z alti annidati in contesti bassi (es. z-40 dentro una sezione z-10) non competono.
3. Per menu lunghi in mezzo a contenuti densi, il **portal** (cfr. Lezione 11) resta l'opzione più robusta.

## 2026-07-03 — Il logo va NUDO (trasparente), colore in light / bianco in dark: NON inventare badge/sfondi

**Contesto:** rebrand Valora, adozione del simbolo nell'header/login. Il markup esistente mostrava il vecchio
`logo.png` in un **cerchio** (`rounded-full overflow-hidden object-cover`) con glow/ring. Per farci stare il nuovo
simbolo ho generato un **badge quadrato con gradiente teal→navy + simbolo VO bianco** (per riempire il cerchio).
Reazione utente: **«perché il logo ha lo sfondo di quel colore ed è cerchiato? e perché non è a colori? voglio il
logo senza sfondi sotto, colori originali in light mode e bianco in dark mode».**

**Lezione:**
1. Quando l'utente ha scelto un logo, si mostra **il simbolo NUDO su trasparente**, non lo si chiude in un badge/
   cerchio/sfondo inventato. Se il contenitore esistente (cerchio `object-cover`) non va bene per la nuova forma,
   **si adatta il contenitore al logo** (rimuovi cerchio/ring/glow, `object-contain`, `h-fixed w-auto`), non il logo al contenitore.
2. **Colore in light, bianco in dark** = un solo file colore trasparente + CSS `dark:brightness-0 dark:invert`
   (è già il pattern `CompanyLogo` del progetto). Su fondo SEMPRE scuro (es. LoginPage `bg-slate-900`) → `brightness-0 invert` fisso.
   `brightness-0` porta a nero mantenendo l'alpha, `invert` lo rende bianco; i solchi interni (alpha 0) restano trasparenti → struttura preservata.
3. Un badge con sfondo colorato ha senso SOLO se l'utente lo chiede o per un'app-icon che deve avere un fondo — MAI come default per il logo in-app.
   Cfr. lezione 02/07 (non ridisegnare il logo scelto) e `feedback-verifica-video-utente`.

## 2026-06-30 — Due "Avella Antonio" NON sono un doppione: omonimi (Foggia vs Termoli)

**Contesto:** audit visivo dell'archivio. Visti due "Avella Antonio" sotto RFI, stesso ruolo, **entrambi
228 buste** → ho concluso "doppione / re-import". **Sbagliato.** Sono due **persone diverse**: uno di
**Foggia**, uno di **Termoli** (lo si legge nella testata delle buste). I dati lo confermano: 0 storage_path
condivisi, 228 file distinti ciascuno in cartelle worker separate. Il 228 = 19 anni pieni, coincidenza.

**Lezione:**
1. **Stesso nome + stesso conteggio buste ≠ doppione.** In RFI ci sono omonimi su sedi diverse. Prima di
   chiamarlo doppione, **leggi la SEDE nella testata della busta** (e confronta gli `storage_path`: se sono
   in cartelle `worker_id` diverse e non si sovrappongono, sono archivi distinti → persone distinte).
2. Non proporre MAI merge/dedupe di worker su base nome. Vedi memoria `project-avella-antonio-omonimi`.
3. Il vero problema non è "doppione" ma **UI ambigua**: lista archivio e chip dashboard mostrano solo
   "Avella Antonio" → confondono due persone. Fix = esporre la sede/ruolo distintivo in quei punti compatti.

## 2026-06-30 — Recupero buste misfiled: lo scan aggiorna la griglia `anni` con un MERGE che lascia residui

**Contesto:** primo dei 7 recuperi delle buste col nominativo/mese sbagliato (Mottola, Novembre
2008 — vedi memoria `project-audit-mese-archivio-vs-testata`). Caricata e ri-scansionata la
busta vera, ho verificato i dati e ho trovato che la riga di **griglia** (`worker_profiles.anni`)
di novembre aveva sì le voci nuove corrette, ma si portava dietro `imponibile_tfr_mensile` e
`fondo_pregresso_31_12` (più la nota "[⚠️ Conguaglio mese prec.]") del **vecchio** contenuto
(dicembre), mentre la riga di dicembre ne era priva.

**Lezione (vale per i 5 recuperi rimasti — Cataneo Pasquale, Tozzi ×2, Avella, Cataneo V, Gentile):**
1. Lo **scan di una busta aggiorna SIA `payslip_metadata` SIA la griglia `anni`**, ma con un MERGE
   che **non azzera** i campi non presenti nel nuovo scan. Ri-scansionando un mese prima misfiled,
   restano residui del vecchio contenuto. Sono due store separati: copiare `extracted_data` via SQL
   NON tocca la griglia, e viceversa.
2. **Prima di chiamarlo "bug del totale", verifica se il campo residuo entra in un calcolo.** Qui no:
   `imponibile_tfr_mensile` → `utils/tfrCalculator.ts:58-63` prende il `Math.max` dell'**anno**
   (mese irrilevante); `fondo_pregresso_31_12` → solo scritto (`usePayslipUpload.ts`), mai letto; le
   differenze usano le voci, ora corrette. → residuo **cosmetico**, lasciato lì (non vale il rischio
   `feedback-anni-clobber-stale-browser` di un edit SQL su `anni`). Se in un caso il residuo fosse un
   total-mover, correggere DALL'APP (griglia mensile) + hard-refresh, non via SQL.
3. **Inserire la busta in archivio ≠ riempire la griglia che fa i conti.** "Caricata e scansionata"
   non basta a dire che i totali sono giusti: controllare sempre la riga `anni` del mese recuperato.

## 2026-06-13 — Split buste Elior cartacee (Ghiro/Mastropasqua): 2 trappole

### Lezione A — Box "PERIODO DI PAGA" NON è a quota fissa: scansioni con margine variabile
Dividendo i PDF scansionati ho ritagliato una fascia FISSA in fondo pagina (y≈0.90–0.96)
per leggere il mese. Su un blocco di pagine il cedolino era scansionato più in alto (largo
margine bianco sotto) → la fascia cadeva nel vuoto e ho scambiato **buste reali per pagine
bianche** (Ghiro 1.pdf p29-45 = mesi Nov2019→Dic2020, NON vuote). **Regola:** per leggere un
campo da scansioni, ritaglia una fascia ALTA/relativa al contenuto (qui [0.78,0.99]) o trova
il bbox del contenuto; mai fidarsi di una soglia di "inchiostro" fissa (le scansioni Ghiro
erano molto più chiare di Mastropasqua → stessa soglia = falsi vuoti). E i **doppioni di
scansione** (stesso cedolino due volte, es. Set2023 ×2) sballano la sequenza monotòna: leggere
il box di OGNI pagina, non inferire dal vicino.

### Lezione B — Segno del deskew: VERIFICARE numericamente, non a occhio
Ho raddrizzato 101 pagine ruotando di `corr` invece di `-corr` → ho **raddoppiato** lo storto
(da −1.55° a −3.10°). Il test "before/after" a occhio mi era sembrato ok (ho visto ciò che mi
aspettavo). L'ha smascherato solo la **ri-misura quantitativa** del residuo. **Regola:** dopo
un'operazione geometrica (rotazione/deskew/scala) misura il risultato con la stessa metrica,
non fidarti dell'eyeball; tieni il sorgente intatto così puoi rigenerare lossless e ricorreggere.

## 2026-06-06 — Variabili a virgola decimale: la mia query SQL li scartava e ho inventato un bug inesistente

### Lezione: normalizzare la virgola prima di sommare i valori di `anni`, e fidarsi del totale che l'utente vede nell'app

**Cosa è successo:** verificando Micaletti 2025 sommavo i codici variabili da `worker_profiles.anni`
con il filtro `(elem->>k) ~ '^-?[0-9.]+$'`. Ma molti valori sono **stringhe in formato italiano con
la virgola** (`"390,92"`), inseriti a mano nell'app. Il mio regex (solo punto) li **scartava come 0**.
Risultato: leggevo 2025 = 3.140 con Aprile/Nov/Dic "vuoti", mentre il totale reale era ~7.958. L'utente
mi diceva "è 7000" e io insistevo col mio numero, arrivando a diagnosticare un **clobber da snapshot
vecchio inesistente** e a fargli fare hard refresh + micro-modifiche inutili.

**L'errore doppio:** (1) tecnico — sommare valori jsonb senza normalizzare la virgola (`replace(x,',','.')`)
su un'app ITALIANA dove l'inserimento manuale usa la virgola; (2) di metodo — ho creduto alla mia query
grezza più che all'osservazione diretta dell'utente sull'app, e ho costruito una teoria di bug elaborata
su un dato falso invece di sospettare prima il caso più banale (formato decimale).

**Regola per me:** quando sommo importi da `anni`, usare SEMPRE `replace(elem->>k, ',', '.')::numeric`
e un filtro `~ '^-?[0-9.]+$'` DOPO il replace. Se l'utente vede nell'app un totale diverso dal mio,
il sospetto n.1 è la MIA lettura (formato/parsing), non un bug di persistenza: prima di gridare al clobber,
dump del record grezzo e verifica del formato. Le mie % "proxy" via SQL vanno marcate come tali e
ricalcolate con la virgola gestita. Vale per tutte le pratiche verificate finora.

## 2026-06-03 — Non accusare di "errore/ambiguità" un testo legale per una mia sovra-lettura

### Lezione: prima di dire che il ricorso "si contraddice", verifica che le due frasi parlino DAVVERO della stessa cosa

**Cosa è successo:** ho segnalato come "ambiguità grave" del ricorso due frasi sul metodo della
media: Conclusioni = *"media ultimi 12 mesi precedenti la fruizione"*; descrizione conteggio =
*"per ciascun anno lavorativo… media × ferie"*. Ho letto la seconda come "media dello STESSO anno"
e costruito perfino un documento-quesito per l'avvocato.

**L'errore:** sovra-interpretazione. La frase "per ciascun anno lavorativo" descrive solo la
**meccanica** (per ogni anno si calcola una media e la si moltiplica per le ferie); NON dice quale
periodo usare. Il periodo lo fissa **già** la frase delle Conclusioni ("12 mesi precedenti" =
anno precedente = Metodo A). Lette insieme sono coerenti. Nessuna contraddizione, nessun errore
dell'avvocato — che peraltro aveva sempre detto "Metodo A".

**Regola per me:** quando due passaggi sembrano confliggere, chiediti se uno fissa il *cosa/quale*
e l'altro descrive solo il *come*. Non trasformare una mia incertezza interpretativa in un "errore"
della controparte/avvocato, e non far partire artefatti (documenti, quesiti) prima di aver
escluso la lettura più semplice e coerente. Vale doppio sui testi legali firmati dal cliente.

## 2026-05-21 — scan-payslip: lo swap Presenze/Riposi NON si risolve con il prompt

### Lezione: per un errore OCR sistematico, correggi nel CODICE con un'invariante — non con l'ennesima riscrittura del prompt

**Bug riscontrato (segnalato dall'utente):** su RFI/Trenitalia l'IA mette "sempre" il valore
della colonna *Riposi* dentro `daysWorked` (giorni lavorati). `daysWorked` è il DIVISORE di
tutti i calcoli indennità → un errore qui corrompe l'intera pratica.

**Perché il prompt non bastava:** il bug era già stato "blindato" 3+ volte nel prompt
(vedi todo.md). Continuava a fallire perché è un problema di disambiguazione SPAZIALE: quando
la cella "Presenze" è fisicamente vuota, l'OCR non ha modo di sapere che il primo numero
appartiene alla 2ª colonna. Nessuna quantità di istruzioni testuali lo rende affidabile.

**Tre design scartati (riprodotti empiricamente, NON hanno retto):**
- *Range dei Riposi* (un full-time ha 4-16 riposi): l'IA **allucina** un `riposi` *dentro* il
  range (es. `riposi:6`, numero inesistente sul cedolino) → il check non scatta.
- *Quadratura `E = giorniMese − colonne di destra`*: presuppone che la riga presenze sommi
  SEMPRE ai giorni del mese. Falso: Marzo 2010 somma 28≠31, Febbraio 2012 somma 31 > 29
  giorni reali, i conguagli sommano 57-61. Soglia legata al calendario → falsi positivi.
- *Check "riposi rotto" (null o < 3) come spia del bug*: smentito da Giugno 2021 RFI, che ha
  `riposi` realmente vuoto pur essendo un mese letto correttamente → avrebbe azzerato a torto.

**Fix definitivo (8 cedolini reali — 4 Trenitalia + 4 RFI — come banco di prova):**
1. Il prompt §2 non chiede più `daysWorked`: chiede di TRASCRIVERE la riga presenze
   nell'oggetto `attendance` (10 colonne). Compito più meccanico.
2. Scoperta chiave: l'IA legge **perfettamente** una cella "Presenze" VALORIZZATA (1/8/10/18/
   18.5/20/44 tutti esatti) e la colonna "Ferie". Sbaglia SOLO con la cella VUOTA.
3. `reconcileRailwayAttendance()`: daysVacation/daysPaidLeave letti diretti. Per daysWorked,
   invariante ASIMMETRICA con **soglia FISSA** (non i giorni di calendario): una riga onesta
   di un singolo mese somma a ~28-31, mai oltre ~32; il bug inserisce un valore-presenze
   FANTASMA → sovra-conteggio. → È il bug se `presenze` ∈ [4,16] (plausibile come riposi),
   la riga sfora la soglia, E azzerare `presenze` la riporta sotto soglia (quest'ultima
   distingue il bug da un conguaglio multi-mese, dove azzerare non basta). Le tre condizioni
   in AND: una busta onesta non le attiva mai → MAI un falso azzeramento.

**Regola generale:**
> Quando un modello sbaglia sistematicamente un campo, NON insistere col prompt: ricava il
> campo per via deterministica. Ma attenzione: NON costruire la validazione sul campo che il
> modello sbaglia (può allucinare un valore "plausibile"), e NON dare per scontate invarianti
> non verificate (qui: "la riga somma ai giorni del mese" era falsa). Riproduci il bug su PIÙ
> casi reali: sono serviti 8 cedolini per scartare 3 design e trovarne uno robusto — un'invariante
> *asimmetrica* ("non supera mai", non "è sempre uguale a") regge dove quella rigida cade.

### Lezione collaterale: la matematica del retry deve stare nel budget della Function

`generateContentWithRetry` faceva 3×16s = 48s, ma la Netlify Function muore a ~30s: ogni
chiamata Gemini "normale ma lenta" (~22s, misurata) veniva abortita al 16° secondo e mai
completata. Fix: retry **budget-aware** (budget totale, 1° tentativo fino a 24s così una
chiamata da 22s RIESCE) + rotazione delle chiavi API tra i tentativi (quota bucket diversi).
> Regola: un meccanismo di retry con timeout deve conoscere il budget totale dell'ambiente
> in cui gira; `n_tentativi × timeout` non può eccederlo, o il retry diventa autolesionista.

---

## 2026-05-20 — verify-payslip: il verificatore "ignorava i campi a 0" → cieco alle omissioni

### Lezione: un verificatore non deve MAI saltare i campi a zero

**Bug riscontrato (segnalato dall'utente):** la verifica AI "non rileva errori veri" — dava
esito verde anche a estrazioni in cui mancavano interi codici indennità.

**Causa root in `verify-payslip.ts`:** il prompt comune conteneva la regola
"IGNORA i campi con valore 0 o 0.0 — niente da verificare". Quando l'OCR PERDE un dato lo
lascia a 0.0: il verificatore, istruito a saltare gli 0.0, non poteva strutturalmente
accorgersi delle omissioni — cioè proprio la classe di errore più importante. Aggravante: il
JSON `monthData` passato al verificatore contiene solo i codici non-zero (il merge client
scarta i valori 0), quindi un codice perso non era nemmeno presente come chiave da controllare.

**Fix:**
1. Rimossa la regola "IGNORA 0.0"; aggiunta una regola esplicita "VALORE MANCANTE": un campo
   a 0.0 va dato per buono SOLO dopo aver verificato sul PDF che la voce è davvero assente.
2. Passata SEMPRE (anche per i profili di sistema, non solo i custom) la checklist completa
   dei codici indennità del profilo → il verificatore li spunta voce per voce, anche quelli
   non presenti nel JSON.
3. Intro riscritta in chiave "revisore pignolo e scettico".
4. Chiarita la regola TFR: "TFR 31/12 A.P." ≠ "RETR.UTILE TFR" (un test ha rivelato che le
   confondeva, generando un falso positivo) — fix applicato sia a verify che a scan-payslip.

**Regola generale:**
> Un controllo di qualità che salta i valori "vuoti/zero" è cieco proprio agli errori di
> omissione. Il verificatore deve avere la lista COMPLETA di ciò che si aspetta e spuntarla
> tutta contro la fonte, non limitarsi a ricontrollare ciò che è già stato estratto.
> Verificato empiricamente eseguendo verify-payslip end-to-end: caso errato → 3/3 discrepanze
> intercettate (incluso un codice mancante); caso corretto → success, 0 falsi positivi.

**Aggiornamento (cross-profili).** La fix sopra toccava la sezione di prompt CONDIVISA tra tutti
i profili. Ri-testando RFI ed ELIOR sono emersi due effetti collaterali, poi corretti:
(a) riscrivendo il `commonSection` avevo perso la regola "i codici si leggono dalla colonna
Competenze" → reintrodotta in modo generico;
(b) la regola "valore mancante" era troppo ampia: segnalava come errori anche voci NON tracciate
dall'app (trattenute, addizionali IRPEF, quote sindacali) → ristretta ESPLICITAMENTE ai soli
codici della checklist + campi standard.
**Regola:** una modifica a un blocco di prompt CONDIVISO va ri-testata su OGNI profilo, non solo
su quello in focus; e ogni regola "cattura tutto" ha bisogno di un ambito esplicito, altrimenti
genera falsi positivi. Verifica finale: RFI → 2/2 discrepanze reali, 0 falsi positivi;
ELIOR → daysWorked intercettato, 0 falsi positivi; caso corretto → success su entrambi.

---

## 2026-05-20 — MERCITALIA: prompt OCR scritto da spec testuale, senza il PDF reale

### Lezione: NON scrivere un prompt di estrazione OCR senza prima vedere un cedolino reale

**Bug riscontrato (segnalato dall'utente):** il `PROMPT_MERCITALIA` estraeva dati sbagliati.
`daysWorked` restava sempre 26 anche con ferie; le indennità risultavano vuote/0.

**Causa root:** ho scritto `PROMPT_MERCITALIA` (e il ramo MERCITALIA di `verify-payslip.ts`)
basandomi SOLO sulla specifica testuale dell'utente, senza un PDF ADP reale. Tre errori:
1. **Ordine colonne errato.** Avevo descritto la tabella come "Codice | Descrizione |
   Numero o base di calcolo | … | Valori". L'ordine reale ADP è 7 colonne:
   `Cod.Voce | Descrizione | Valori | Numero o base di calcolo | Compenso unitario o % | Competenze | Trattenute`.
2. **Indennità lette dalla colonna sbagliata.** Il prompt diceva di leggere gli importi
   delle indennità da "Valori". Su ADP gli importi pagati sono in **"Competenze"** (6ª col).
   "Valori" contiene solo retribuzione base/imponibili. → indennità tutte a 0.
3. **`daysWorked` senza sottrarre le ferie.** "GIORNI INPS" (≈26) INCLUDE le ferie godute.
   Il valore corretto è `daysWorked = GIORNI INPS − ferie (cod. 3833)`, come per ELIOR.

**Fix:** riscritto `PROMPT_MERCITALIA` con la mappa colonne esatta, indennità da "Competenze",
`daysWorked` calcolato con few-shot examples. Stesso allineamento su `verify-payslip.ts`.

**Regola generale:**
> Un prompt OCR per un nuovo layout di documento DEVE essere scritto guardando almeno un
> documento reale, non solo una descrizione testuale. Le specifiche a parole sbagliano
> sistematicamente l'ordine delle colonne e la colonna-sorgente dei valori. Se l'utente
> non fornisce subito un campione, CHIEDERLO prima di scrivere il prompt.
> Inoltre: i campi "giorni lavorati" sui cedolini italiani spesso includono ferie/permessi
> — verificare sempre se vanno sottratti (pattern già visto su ELIOR: `GG INPS − ferie`).

---

## 2026-05-19 — scan-worker: "ruolo" sempre compilato con "Professional"

### Lezione: i prompt OCR devono distinguere LIVELLO CONTRATTUALE da MANSIONE OPERATIVA

**Bug riscontrato:** il modale di creazione lavoratore mostrava sempre "Professional" nel campo Qualifica, indipendentemente dal cedolino scansionato.

**Causa root in `netlify/functions/scan-worker.ts`:**
Il `PROMPT_ANAGRAFICA` descriveva `ruolo` come "la qualifica o la mansione". Sui cedolini RFI/Trenitalia esistono DUE voci distinte:
- "Q.PROF" / "Qualifica" → categoria contrattuale (es. "Professional", "Specialist") — appartiene a `profiloProfessionale`
- "Mansione" / "Funzione" / "Profilo" → ruolo operativo specifico (es. "Macchinista", "Tecnico") — appartiene a `ruolo`

L'AI, vedendo la voce letterale "QUALIFICA: PROFESSIONAL" in alto sul cedolino, la prendeva e la metteva in `ruolo` come prima parola che il prompt chiedeva.

**Fix (doppia difesa):**
1. **Lato prompt** — riscritto PROMPT_ANAGRAFICA: separazione netta dei due campi con anti-pattern espliciti ("❌ SBAGLIATO: ruolo=Professional"), blacklist di token vietati in `ruolo` (Professional/Specialist/Quadro/Operaio/Impiegato/Livello X/Parametro N/codici come "B1"), istruzione "meglio vuoto che sbagliato". Temperature abbassata 0.1 → 0.0.
2. **Lato client** (`WorkerModal.compileDataFromAI`) — safety net `normalizeRuoloProfilo()`: se l'AI mette in `ruolo` qualcosa che matcha la blacklist (parole esatte + regex per Livello/Parametro/codici tipo "B1"), lo sposta automaticamente in `profiloProfessionale` (se vuoto) e svuota `ruolo`.

**Regole generali per prompt di estrazione dati strutturati:**
> Quando un PDF ha PIÙ campi con label simili (es. "Qualifica" vs "Profilo"), il prompt deve:
> 1. Definire ogni target field con la **fonte specifica** ("dove cercarlo: sezione X"), non solo il significato semantico
> 2. Includere una **blacklist esplicita** di valori che NON devono mai finire in quel campo
> 3. Fornire esempi anti-pattern ("❌ così no"), non solo positivi
> 4. Permettere il valore vuoto come fallback sicuro ("meglio vuoto che sbagliato")
> 5. Aggiungere una safety net client-side per i casi residui — i prompt LLM non sono mai deterministici al 100%

---

## 2026-05-19 — MonthlyDataGrid: re-render loop dopo scansione AI

### Lezione: MAI mettere uno state nelle deps di un useEffect se lo stesso effect lo aggiorna

**Bug riscontrato (segnalato dall'utente):** in Chrome, dopo l'inserimento di dati scansionati dall'AI nella tabella di `WorkerDetailPage`, le tabelle sembravano ricaricare continuamente. Riducendo la finestra il bug si fermava (scrollbar orizzontale spariva → niente eventi scroll → loop interrotto).

**Causa root in `components/WorkerTables/MonthlyDataGrid.tsx`:**
- `useEffect` aveva `[profilo, isScrolling]` come deps
- Lo scroll handler dentro l'effect chiamava `setIsScrolling(true)` e poi `setIsScrolling(false)` dopo 150ms
- Ogni cambio di `isScrolling` → effect ricreato → cleanup + nuovo `ResizeObserver` + nuovi listener ad ogni evento scroll
- Il `ResizeObserver` appena creato fa fire immediato di `updateWidth` → `setTableScrollWidth` → re-render
- Su schermo piccolo niente scrollbar orizzontale → nessun evento scroll → loop non si innesca

**Fix elegante:**
- State `isScrolling` mantenuto solo per il className (`pointer-events-none` durante scroll)
- Aggiunto `isScrollingRef` per il guard interno (`if (!isScrollingRef.current)`)
- Rimosso `isScrolling` dalle deps del useEffect → listener e observer creati una volta sola

**Regola generale:**
> Se un useEffect contiene listener/observer che chiamano `setX`, **X NON deve essere nelle deps**. Usa un `ref` per leggere il valore corrente dentro il callback. Le deps di un effect "setup-once" devono contenere solo identità stabili (props, config, non state che lo stesso effect muta).

**Bonus trovato durante la review:** `currentColumns = useMemo(..., [profilo])` usava `eliorType` senza dichiararlo nelle deps → cambio di `eliorType` non aggiornava le colonne. Aggiunto.

**Checklist da seguire per i prossimi effect con listener:**
1. Lo state nelle deps viene mutato dentro l'effect stesso? → spostalo in ref
2. L'effect crea un `ResizeObserver`/`MutationObserver`/`addEventListener`? → deps devono essere solo identità DOM/config, non state mutabili
3. Verificare deps del useMemo accanto: ogni variabile usata DEVE essere dichiarata

---

## 2026-05-15 — DynamicIsland: bug border-radius + fluidità

### Lezione 1: MAI duplicare `borderRadius` in `style` + `animate` su un `motion.div` con `layout`

**Errore commesso (primo fix):** ho applicato `borderRadius: <numero>` **sia** nello `style` **sia** nell'`animate` del motion.div principale. Convinto fosse "ridondante ma robusto". In realtà:

- Quando un altro state cambia (es. `display` della calcolatrice ad ogni click), React re-renders.
- Framer Motion vede sia `style.borderRadius` sia `animate.borderRadius` e va in confusione su quale è la "source of truth".
- Risultato: durante input numeri compaiono angoli appuntiti — il fix sembrava completo, era peggio del bug.

**Pattern canonico Framer Motion v11+:**
```tsx
<motion.div
  layout
  animate={{ borderRadius: 32 }}    // solo qui
  style={{ overflow: 'hidden' }}    // niente borderRadius
  transition={{ borderRadius: ... }} // animation curve
/>
```

**Quando hai un motion.div con `layout` prop e bisogna gestire un border-radius dinamico:**
- `animate.borderRadius` come numero (px) — Framer applica la sua correzione automatica durante layout shifts
- `style.overflow: 'hidden'` esplicito (non delegare a Tailwind class)
- `style.contain: 'layout'` per isolare i reflow interni dal layout calculation di Framer
- Niente classe Tailwind `rounded-*` sul motion.div che ha layout — verrebbe persa durante i transform

### Lezione 2: i flex item con `truncate` hanno bisogno di `min-w-0 flex-1`

**Errore commesso:** il display della calcolatrice aveva `<span className="truncate">` dentro un `flex justify-between`. Senza `min-w-0`, lo span ha `min-width: auto` (default CSS), quindi non si lascia comprimere sotto la sua larghezza naturale. Risultato: sub-pixel reflow del parent ad ogni input → Framer Motion misura un layout shift → applica un transform → distorce il border-radius.

**Pattern corretto per truncate in flex container:**
```tsx
<div className="flex justify-between">
  <button className="shrink-0">...</button>
  <span className="truncate min-w-0 flex-1 text-right">...</span>
</div>
```

`min-w-0` neutralizza il default `min-width: auto`, `flex-1` permette di prendersi lo spazio rimanente, `shrink-0` sui sibling fissi.

### Lezione 3: Spring damping > 1 = "pesante", non Apple-like

**Errore commesso:** primo tentativo con `stiffness: 280, damping: 38, mass: 1.0` → ζ = 38/(2·√(1·280)) ≈ 1.14 (overdamped). Razionale: "no overshoot = no angoli sbatacchiati". In pratica: l'utente ha percepito "non fluido" / "lento".

**Calibrazione iOS-realistica:**
- Apple Dynamic Island reale usa spring **sotto-critico** (ζ ≈ 0.83-0.95), non overdamped.
- Un piccolo overshoot percettivo = sensazione di "vita".
- Valori buoni: `stiffness: 380, damping: 30, mass: 0.85` (ζ ≈ 0.83, periodo ~300ms).
- Per layout dove serve zero overshoot certo: `stiffness: 380, damping: 34, mass: 0.85` (ζ ≈ 0.94, ma reattivo).

**Regola:** se l'utente dice "non fluido" e hai damping ≥ 1, abbassa damping prima di pensare ad altro.

### Lezione 4: STOP & re-plan quando il fix peggiora

Quando un fix sembra logico ma l'utente segnala che è peggiorato → **non insistere** con micro-aggiustamenti. Ridiagnosticare da zero il root cause (in questo caso: la duplicazione + il flex item senza min-w-0 erano due cause cumulative ignorate al primo round).

Pattern: leggere attentamente la documentazione delle librerie esterne quando si tocca un'API sottile come `layout`/`animate` di Framer Motion. Gli auto-correct delle librerie sono incompatibili con il "belt and suspenders".

### Lezione 5 (CRITICA): `layout` prop di Framer Motion **distorce intrinsecamente** il contenuto

**Errore commesso (terzo round):** ho insistito a usare `layout` prop sul motion.div principale convinto di poterlo "domare" con `borderRadius` animato + `contain: 'layout'`. **Sbagliato.**

**Come funziona davvero `layout`:**
- Framer Motion misura il bounding box prima e dopo il render.
- Per "animare" la transizione, applica un `transform: matrix(scaleX, scaleY, translateX, translateY)` sul nodo, e contrae/espande il transform fino al valore finale.
- **Conseguenza inevitabile**: il contenuto interno viene **scalato** non solo geometricamente ma visivamente — bordi, font, padding tutto "schiacciato" durante la transizione. Apple Dynamic Island NON si comporta così perché iOS anima width/height come proprietà nativa, non via transform.

**Aggravante**: `contain: 'layout'` PEGGIORA la situazione perché restringe il subtree di layout calculation che Framer userebbe per fare le correzioni automatiche. Non aggiungerlo mai accoppiato a `layout` prop.

**Pattern corretto per morphing "Apple-style" senza distorsione:**
```tsx
<motion.div
  // NO layout prop
  initial={false}
  animate={{
    width: <numero>,         // animato come property CSS reale
    borderRadius: <numero>,  // idem
    boxShadow: ...,
  }}
  transition={{
    width: FRAMER_PHYSICS.dynamicIslandLayout,
    borderRadius: FRAMER_PHYSICS.dynamicIslandLayout,
  }}
  style={{
    minHeight: ...,
    overflow: 'hidden',
    willChange: 'width, border-radius',
    // NIENTE contain: layout
  }}
>
  <AnimatePresence>{/* children con loro fade */}</AnimatePresence>
</motion.div>
```

**Effetto**:
- Width è interpolato come numero CSS reale → niente scale transform → niente distorsione.
- Border-radius animato senza essere distorto.
- Height: lasciata `auto` con `overflow: hidden` (è una piccola perdita di smoothness verticale, accettabile perché i child AnimatePresence fanno fade).
- I sub-AnimatePresence dei child gestiscono i loro mode → l'effetto "morph" estetico resta.

**Heuristica**: usa `layout` solo per micro-elementi (es. una pill che si sposta in una lista, dove il transform scale è poco visibile). Per container grandi con bordi e contenuto strutturato → animate width/height esplicitamente.

### Lezione 6: `backdrop-filter` + `border-radius` + child con `transform` = corner bug

**Sintomo descritto dall'utente:** "Lo sfondo non segue la cornice stondata, mostra gli angoli quando si premono i tasti calcolatrice."

**Causa:** È un comportamento documentato di Chrome/Safari. Il `backdrop-filter` (es. `backdrop-blur-md` di Tailwind) viene calcolato relativamente al **bounding box rettangolare** del nodo e **clippato dopo** dal border-radius. Durante un re-paint causato da un transform su un figlio (esempio: `active:scale-95` su un bottone cliccato), il compositor può esporre per uno o due frame il bounding box rettangolare del backdrop-filter PRIMA che venga applicato il clip del border-radius.

**Fix canonico:** forzare il container in un proprio stacking context isolato.
```tsx
style={{
  isolation: 'isolate',        // proprio stacking context → backdrop-filter clippato correttamente
  backfaceVisibility: 'hidden', // forza GPU layer (no conflict con `transform` di Framer)
  overflow: 'hidden',
}}
```

**Non fare:** `transform: translateZ(0)` come style se Framer Motion sta animando `x`/`y` — sovrascriverebbe il transform di Framer. `backfaceVisibility` ottiene lo stesso effetto compositor senza conflitto.

**Heuristica:** se vedi "angoli rettangolari" durante interazioni con figli, e il container ha `backdrop-filter` o `backdrop-blur-*`, è quasi certamente questo bug. `isolation: isolate` è il primo tentativo.

### Lezione 7: `transition-all` + `backdrop-blur` = corner repaint bug (causa profonda)

**Scoperto risolvendo il bug calcolatrice al terzo tentativo.** L'utente ha segnalato che lo stesso identico tipo di "angolo rettangolare visibile" compariva anche su una card statica (Pratiche Gestite Totali) in DashboardPage, completamente separata dal DynamicIsland. Diagnosi: **pattern condiviso**.

**Causa:** quando un container ha `backdrop-blur-*` (Tailwind) + `rounded-*` + `transition-all` (o `transition-[backdrop-filter,...]` esplicito), il browser dichiara che `backdrop-filter` è una proprietà animabile su quel nodo. Anche se il valore NON cambia mai, ad ogni repaint del nodo (es. causato da `active:scale-95` di un figlio, o da `hover:scale` su un sibling), il compositor ricalcola il backdrop-filter sul bounding box rettangolare PRIMA di applicare il clip del border-radius. Per uno o più frame, gli angoli rettangolari del backdrop sono visibili.

**Fix:** mai includere `backdrop-filter` (né `all`) nella lista di `transition-*`. Usare `transition` esplicito sulle property che effettivamente cambiano:
```tsx
// ❌ Causa corner bug
className="backdrop-blur-md rounded-2xl transition-all duration-500 hover:scale-105"

// ✅ OK
className="backdrop-blur-md rounded-2xl transition-[transform,box-shadow,border-color] duration-500 hover:scale-105"
```

**Su DynamicIsland (`getIslandStyles`):** rimosso `backdrop-filter` dalla lista `transition-[background-color,border-color,box-shadow,backdrop-filter,opacity]` → ora `transition-[background-color,border-color,box-shadow,opacity]`.

**Audit pattern da fare**: cercare nel progetto tutti i casi di `transition-all` su elementi con `backdrop-blur` → sostituire con transition esplicita. (Es. `.glass-panel`, `.glass-btn`, `.glass-input` in `index.css` hanno `backdrop-blur` ma niente `transition-all` esplicito → safe).

**Heuristica:** se due elementi NON RELATI mostrano lo stesso glitch visivo, la causa è quasi sempre in una utility/pattern CSS condivisa (`transition-all`, `glass-*` mixins, classi globali). Non perdere tempo a fixare uno specifico nodo prima di aver capito il pattern.

### Lezione 11 (2026-05-17): `position: fixed` viene catturato da antenati con `backdrop-filter`/`transform` → modali devono usare React Portal

**Errore commesso**: ho montato `<RagAdminPanel />` come child del `<div ref={islandRef}>` della Dynamic Island. Il modale ha `fixed inset-0 z-[9999]` ma all'apertura non copriva il viewport: appariva come un rettangolo nero confinato dentro l'area della pill della Dynamic Island. La Dynamic Island sembrava "crashare".

**Causa**: in CSS, `position: fixed` si ancora normalmente al viewport, MA se un antenato ha una di queste proprietà CSS, l'antenato diventa il containing block per i fixed discendenti:
- `transform` (qualsiasi, anche `translate(0,0)`)
- `filter`
- `perspective`
- `backdrop-filter` ✅ ← causa nel nostro caso
- `contain: paint`
- `will-change: transform`

Framer Motion applica `transform` ai motion.div animati, e la Dynamic Island ha un `backdrop-blur-2xl` su un wrapper. Risultato: il modale `fixed inset-0` finisce ancorato alla pill della Dynamic Island, non al viewport.

**Fix canonico**: usare React Portal per montare il modale come sibling diretto di `document.body`, fuori dal subtree problematico:

```tsx
import { createPortal } from 'react-dom';

return createPortal(
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[9999] ...">
        {/* modale */}
      </div>
    )}
  </AnimatePresence>,
  document.body
);
```

Note implementative:
- **SSR safety**: `if (typeof document === 'undefined') return null;` prima del `createPortal` per evitare crash in build SSR.
- **AnimatePresence + condizione**: spostare la condizione `isOpen` come child di AnimatePresence (`{isOpen && <motion.div .../>}`), NON come early-return esterno (`if (!isOpen) return null`). Altrimenti AnimatePresence non vede mai gli enter/exit dei figli.
- **Niente `backdrop-blur` su backdrop fixed**: combinato con border-radius/transform di figli crea repaint con corner clipping (vedi Lezione 6/7). Sul backdrop di un modale, opacità alta basta.

**Heuristica**: ogni volta che monti un modale dentro un component che ha `backdrop-blur`, `motion.div animate`, `filter`, o simili, **assumi** che il containing block sarà rotto e usa subito il portal. Non aspettare di vedere il bug.

**Audit pattern da fare**: cercare in tutto il progetto `position: fixed` (o classi Tailwind `fixed inset-0`) all'interno di subtree che hanno `backdrop-blur-*` o `motion.div animate={{ ...transform... }}`. WorkerModal e altri modali nel codebase usano lo stesso pattern dentro componenti potenzialmente problematici — verificare al prossimo bug.

---

### Lezione 10 (2026-05-16): Ticket sempre fuori dalle indennità + chiave interna vs display label

**Contesto**: follow-up sessione Clean Service. L'utente ha rilevato 3 problemi nel mio lavoro iniziale.

**Errore 1: ho incluso il codice ticket nelle indennità.**
Su Clean Service ho messo `{ id: '311', label: 'Ticket (311)', ... }` come ColumnDef in `INDENNITA_CLEAN_SERVICE`. Sbagliato. Il pattern RailFlow è:
- `getColumnsByProfile()` aggiunge una colonna **standard fissa** `{ id: 'ticket', label: 'Ticket', subLabel: 'Past.' }` in coda per TUTTI i profili (vedi `types.ts:214`).
- Il prompt OCR estrae il valore unitario del codice ticket in `ticketRate` (campo top-level del JSON).
- I dati salvati popolano `AnnoDati.ticket` da `ticketRate`.
- RFI (codici 0E99/0299/0293), Elior (codici 2000/2001/0293) — nessuno di questi codici compare nei rispettivi `INDENNITA_*`.

**Pattern**: prima di aggiungere un codice come ColumnDef, chiedersi "esiste già una colonna standard per questo concetto?" — ticket e arretrati hanno colonne fisse universali (vedi `COLONNA_ARRETRATI` e la pipeline `getColumnsByProfile`).

**Errore 2: ho usato `'Clean Service SRL'` come label nel selettore card del modal.**
Le altre 2 card hanno label brevi e uppercase (`'RFI'`, `'ELIOR'`) e sub brevi (`'Infrastrutture'`, `'Ristorazione'`). La mia label era 17 char + sub 22 char → outlier visivo. Da `WorkerModal.tsx:837`: `h-[140px]` fisso, `grid-cols-3` (~180px wide). Le label devono stare in 1 riga di ~12 char + sub di ~14 char.

**Pattern**: in un componente con dimensioni fisse e items che si comparano visivamente, **misurare la lunghezza testo** prima di scegliere label. Maiuscola uniforme aiuta perché tutti i char hanno larghezza simile.

**Errore 3: ho usato `CLEAN_SERVICE` come chiave interna ma non ho gestito il display.**
La chiave TypeScript `CLEAN_SERVICE` (underscore obbligatorio per identifier validi) appare con underscore visibile ovunque sia renderizzata raw: badge "CLEAN_SERVICE ATTIVO", filter pill "CLEAN_SERVICE", header tabella. Il fix corretto è **separare chiave interna da display label** centralizzando in un helper (`getProfiloBadgeLabel` con `replace(/_/g, ' ')` default), così ogni callsite esistente si aggiorna in cascata.

**Pattern**: quando una chiave deve essere multi-word ma TypeScript-friendly, accetta l'underscore SOLO se hai un helper centralizzato per il display. Mai assumere che il valore raw sia user-facing.

**Bonus: verify-payslip e scan-payslip vanno tenuti sincronizzati.**
Ho aggiunto un nuovo profilo a `scan-payslip.ts` (estrazione) ma dimenticato `verify-payslip.ts` (verifica matematica post-estrazione). Risultato: il verifier cade nel fallback generico e segnala falsi positivi su pattern noti (asterischi, UNA TANTUM). 

**Pattern**: in RailFlow ci sono **2 prompt Gemini paralleli** per ogni profilo (estrazione + verifica). Modificarne uno richiede modificare l'altro per simmetria. Aggiungere un profilo = 2 blocchi di prompt, non uno solo.

---

### Lezione 9 (2026-05-16): Profili aziendali RailFlow — checklist dei 4-5 punti di registrazione

**Contesto**: sessione "Rekeep → Clean Service SRL". Sostituire/aggiungere un profilo aziendale di sistema NON è una sola operazione: il profilo è registrato in **5 zone separate** del codebase. Saltarne anche una rompe rispettivamente: griglia tabella, dropdown modal, prompt OCR, anagrafica AI, e routing UI (badge/filter/PEC).

**I 5 punti di registrazione** (in ordine di importanza):

1. **`types.ts`** — `ProfiloAzienda` union, `INDENNITA_*` columns, switch in `getColumnsByProfile()`. Senza questo, la tabella non mostra le colonne giuste.
2. **`netlify/functions/scan-payslip.ts`** — `PROMPT_*` + `PROMPT_DIRECTORY[KEY]`. Senza, l'OCR cade nel `PROMPT_GENERICO` e i codici specifici dell'azienda non vengono estratti.
3. **`netlify/functions/scan-worker.ts`** — esempio lista aziende nel prompt anagrafica. Senza, l'autocompilazione AI del modal non riconosce l'azienda dalla testata busta paga.
4. **`components/WorkerModal.tsx`** — `THEMES.<KEY>` (color/gradient/icon), `OPTIONS` array (label/sub), `validCompanies` array, `shellTheme` default. Senza, la modal non offre la scelta o crasha.
5. **Riferimenti scatter** — `App.tsx`, `WorkerCard`, `WorkerDetailPage` (PROFILE_CONFIG + standardProfiles + badge), `CompanyBuilder` (SYSTEM_COMPANIES), `StatsDashboard`, `WorkerTables/*` (Indemnity, Annual, Relazione), `usePayslipUpload`, `ArchivePage`, `DashboardPage` (counter + filter), `utils/printTables` (CCNL). Senza, la UI mostra il profilo come "custom" anziché di sistema.

**Audit finale**: `grep -rn "<OLD_KEY>" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md"` deve restituire zero match in codice funzionale (i match in `tasks/*.md` sono OK perché descrittivi).

**Errore da evitare**: assumere che esista una cartella `src/config/profiles/` come faceva supporre il suggerimento dell'utente. Il pattern reale è **centralizzato in `types.ts` + scatter UI**. Non creare nuove architetture senza prima esplorare le esistenti.

**Sull'interazione con l'utente**:
- L'utente ha chiarito le strategie di rename solo dopo `AskUserQuestion`. Senza chiedere, avrei dato per scontato "hard replace + migrazione Supabase" sbagliando. **Pattern**: prima di pianificare una sostituzione "globale", chiedere se i dati esistenti vanno preservati.
- Quando ho suggerito un'aggiunta non strettamente richiesta (immagine Unsplash nel theme), l'utente l'ha rifiutata con "no non mettere un'immagine". **Pattern**: se l'utente è ambiguo su un'aggiunta opzionale, includerla solo dopo conferma esplicita, non assumere.

---

### Lezione 8: `filter: blur()` su elementi out-of-bounds NON è clippato in modo affidabile da `overflow: hidden`

**Scoperto vedendo le foto utente** (la card "Pratiche Gestite Totali" aveva un angolo "appuntito" in alto a destra — era il blob blu `top-[-50%] right-[-50%] w-96 h-96 blur-[100px]` che sticka fuori).

**Causa:** quando un elemento ha `filter: blur(N)` con `N` grande (es. `blur-[100px]`), il browser alloca un **buffer di rendering più grande del bounding box dell'elemento** (per accomodare l'halo del blur). Questo buffer può eccedere il `overflow: hidden` del parent, specialmente se il parent ha `isolation: isolate` (che crea un nuovo stacking context con composite separato).

**Sintomi visivi:**
- Una "macchia" colorata visibile in un angolo del container, anche se il blob è teoricamente clippato
- L'angolo del container appare "non arrotondato" perché il blob spilla oltre il border-radius
- Particolarmente visibile su Chrome/Safari con GPU rendering

**Fix robusti (in ordine di preferenza):**

1. **Inner wrapper con `overflow: hidden` + `rounded-*` espliciti**: wrappa le decorations in un sub-div che ha gli stessi vincoli del parent. Forza un secondo livello di clipping che il compositor deve onorare:
   ```tsx
   <div className="rounded-[2.5rem] overflow-hidden ...">
     <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
       {/* blob qui dentro */}
     </div>
     {/* content */}
   </div>
   ```

2. **`clip-path: inset(0 round Xrem)`** sul container: è un clipping GPU-level più affidabile di overflow+border-radius, perché il browser lo applica PRIMA del calcolo dei filtri:
   ```tsx
   className="... rounded-[2.5rem] overflow-hidden [clip-path:inset(0_round_2.5rem)] ..."
   ```

3. **Limitare il blur**: `blur-[100px]` è spesso eccessivo. `blur-[60px]` con un blob più piccolo dà effetto simile senza overflow.

**Pattern applicato nelle 3 card DashboardPage**: combinati 1+2 (inner wrapper + clip-path). Per DynamicIsland non applicabile clip-path perché borderRadius è animato, ma il fix Lezione 7 + Lezione 6 + rimozione del `layout` dal glow esterno è bastato.

### Lezione 12 (2026-05-22): sincronizzazione UI — evidenzia, non scrollare in automatico

Implementando la sync visore→tabella (badge mese + selezione automatica della riga del
mese mostrato nel visore), il primo tentativo usava `scrollIntoView({behavior:'smooth'})`
sulla riga sincronizzata. L'utente l'ha trovato **fastidioso**: a ogni cambio file la
schermata "scattava" su/giù.

**Lezione:** per una sincronizzazione di selezione, l'**evidenziazione** (sfondo/ring ben
visibile) basta ed è non invasiva. Lo scroll automatico va evitato: sposta il punto di
vista dell'utente senza che l'abbia chiesto. Se la lista è corta (qui 12 righe, tutte a
schermo) non serve; se fosse lunga, al massimo `scrollIntoView({block:'nearest'})`, che
scrolla solo se l'elemento è davvero fuori vista.

**Corollario (stessa sessione):** un nuovo elemento UI va inserito verificando lo spazio
REALE del contenitore. Il badge del mese, messo nella barra comandi del visore mentre
c'era ancora il pulsante "Smart Upload", la tagliava. Rimosso quel pulsante (doppione
dell'"AI Agent" — stesso `handleBatchUpload`), lo spazio si è liberato e il badge ci sta.
Anche: un primo highlight `bg-indigo-50` era troppo chiaro → quasi invisibile; servono
tinte piene (`bg-indigo-200` / `dark:bg-indigo-500/30`) perché una selezione si veda.

### Lezione 13 (2026-05-28): "aprire i file dal visore" → chiarire il MODELLO DI INTERAZIONE, non solo l'ambito

Richiesta: far aprire al visore (sola lettura) le buste paga salvate sul DB, non solo
quelle caricate da PC. Prima di implementare ho chiarito l'**ambito** (solo visore vs anche
owner) ma ho assunto l'**interazione**: auto-caricamento di TUTTE le buste nel SplitView
all'apertura del lavoratore. L'utente voleva invece la **scelta manuale**: SplitView vuoto,
si clicca una busta dal tab Archivio e quella si carica nel pannello laterale (non window.open
in nuova scheda).

**Lezione:** quando il verbo è generico ("aprire", "caricare", "mostrare"), il punto da
chiarire non è solo *chi/cosa* ma *come avviene l'azione*: automatica vs su richiesta, una vs
tutte, in-place vs nuova scheda. Sono scelte UX che cambiano l'implementazione. Chiedere
entrambe le dimensioni (ambito + interazione) prima di scrivere codice.

**Nota tecnica riusabile:** le RLS Supabase consentivano già al viewer la SELECT su
`payslip_metadata` + `storage.objects` (policy con `OR auth.uid() = '<viewer-uid>'`), quindi
zero modifiche DB. Bastava il client. Per mostrare un URL firmato Supabase in `<object>` PDF
serve spogliare la query string prima del check `.endsWith('.pdf')` (l'URL finisce con
`?token=…` ma il path conserva l'estensione). Il bottone "Spiega" (Gemini) va nascosto al
viewer anche nel SplitView, ora che può avere file caricati.

**Aggiornamento (stessa feature):** due bug emersi nella seconda iterazione:
1. **Estensione `.PDF` maiuscola.** I file archiviati hanno filename tipo `Agosto 2025.PDF`.
   Il check `url.split('?')[0].endsWith('.pdf')` per decidere se mostrare il PDF nell'`<object>`
   falliva (case-sensitive) → object `display:none` → fallback `<img>` che non renderizza un PDF
   → pannello vuoto. Fix: `.toLowerCase().endsWith('.pdf')`. Lezione: mai assumere il case delle
   estensioni dei file caricati dall'utente.
2. **TDZ nella dependency array di useEffect.** Un `useEffect(..., [isReadOnly, archivedPicks, …])`
   piazzato PRIMA delle `const isReadOnly = …` / `const [archivedPicks] = useState(…)` compila con
   vite ma crasha a runtime (e tsc dà TS2448): la **deps array è valutata subito** alla chiamata di
   useEffect, non dopo. Il corpo del callback invece può referenziare const dichiarate più sotto
   (gira dopo il render). Lezione: se un effetto ha variabili nella deps array, va collocato DOPO le
   loro dichiarazioni; `tsc --noEmit` lo cattura, `vite build` no.

**Aggiornamento 2 (stessa feature):** lista lunga in una colonna flex `items-stretch` →
faceva crescere la pagina. Il contenitore riga prende l'altezza del figlio più alto: se il
picker (molti anni) supera la tabella accanto, la riga si allunga e la pagina si espande.
Fix: rendere il contenuto scrollabile `absolute inset-0` dentro un body `relative
overflow-hidden`, così NON contribuisce all'altezza intrinseca e scrolla entro l'altezza
guidata dal sibling (la tabella). Pattern riusabile per "pannello affiancato sempre alto
quanto il vicino".

---

## 2026-05-31 — Nuove voci di UI/export vanno gabbiate dietro `isReadOnly` di default

**Contesto:** ho aggiunto la voce di menu "Esporta Concluse (ZIP)" senza gabbiarla
dietro `isReadOnly` → sarebbe stata visibile anche all'account in sola lettura del
sindacalista. L'utente l'ha notato prima del deploy.

**Lezione:** quando aggiungo un'azione alla dashboard (specie nel menu Dati o azioni
sulle pratiche), il default è **nasconderla al viewer readonly** con il pattern già in
uso lì: `...(isReadOnly ? [] : [{ …item… }])`. La readonly del sindacalista è una vista
di consultazione: strumenti di workflow interno (export verso il mio Desktop, import,
ecc.) NON devono comparirle. Cfr. memoria `auth-readonly-viewer` (lì è lato dati/RLS;
qui è lato UI — vale lo stesso principio). Verificare SEMPRE "questa cosa la deve vedere
il sindacalista?" prima di considerare finita una feature di dashboard.

---

## 2026-06-04 — In verifica pratica, controllare che l'anno di riferimento (N-1) sia completo

**Contesto:** verificando Borriello ho notato `start_claim_year = 2020` ma il 2019 (anno
di riferimento per il 2020) aveva una sola busta, 0 giorni lavorati e 0 variabili: il
calcolo feriale del primo anno non aveva una media storica N-1 da cui attingere. L'utente
ha corretto spostando lo start al 2021 (riferimento = 2020, anno pieno) e mi ha chiesto di
segnalare i casi analoghi in futuro.

**Lezione:** il ricalcolo feriale usa SEMPRE la media dell'anno precedente. Quindi in ogni
verifica di pratica devo controllare che l'anno `start_claim_year - 1` abbia ~12 mesi reali
(giorni>0 e variabili>0). Se è rado/vuoto (tipico di assunzioni a fine anno) → segnalarlo
subito: lo start year va probabilmente spostato avanti al primo anno con un riferimento
completo. Aggiunto ai controlli standard insieme a: backfill fisse completo, 0 duplicati
archivio, % coerente, anni a variabili basse. Cfr. memoria `feedback-anno-riferimento-completo`.

## 2026-06-04 — Rispondere SEMPRE in italiano

**Contesto:** l'utente mi ha fatto notare che a volte scivolo in inglese.

**Lezione:** ogni testo rivolto all'utente va in italiano, senza eccezioni (analisi,
sintesi, sezioni tecniche, riepiloghi). Codice/commenti del repo già in italiano: mantenerli.
Cfr. memoria `feedback-rispondere-sempre-italiano`.

## 2026-06-05 — Dopo ogni verifica pratica, aggiornare la checklist sul Desktop

**Contesto:** ho verificato Di Ponte Armando sul DB ma ho riportato l'esito solo a parole,
senza aggiornare `~/Desktop/Checklist_pratiche_RFI.pdf`. L'utente mi ha detto che la checklist
va aggiornata **ogni volta** che controlliamo una pratica.

**Lezione:** la verifica di una pratica non è "finita" finché non ho aggiornato il tracciamento
che l'utente usa per coordinarsi. È un passo della procedura, non un extra opzionale: marcare la
riga del lavoratore (① backfill verificato sul DB; ③ documenti generati) e rigenerare il PDF.

**Root cause della fragilità (risolta):** la sorgente HTML stava in `/tmp` (effimera) → tra una
sessione e l'altra spariva e il PDF non era più aggiornabile senza ricostruirlo da zero. Spostata
in `knowledge/fonti/checklist_pratiche_rfi.html` (durevole, gitignorata per i nomi). Regola
generale: **un artefatto che va aggiornato ricorrentemente non può avere la sua sorgente in /tmp**;
metterla in un percorso stabile e documentare il comando di rigenerazione.
Cfr. memoria `feedback-aggiorna-checklist-desktop`, `knowledge/verifica-pratica.md`.

## 2026-06-09 — Quando tocchi il layout, verifica gli elementi FIXED che ci galleggiano sopra

**Contesto:** ho compattato l'header della dashboard (logo 128→56px) per guadagnare spazio
verticale. Risultato: i bottoni azione sono saliti nella fascia della Dynamic Island (fixed
top-center) e "Archivio" ci finiva sotto. In più 56px/3xl era troppo piccolo per il gusto
dell'utente: ho ottimizzato una metrica (px verticali) sacrificando l'identità del brand.

**Lezione (doppia):**
1. Prima di spostare/ridurre elementi di layout, inventariare gli elementi `fixed`/overlay
   che condividono la stessa fascia (isola top-center, toast top-right, AreaSwitch bottom-left,
   bottoni bottom-right) e verificare le collisioni alle varie larghezze. La soluzione robusta
   non è "spostare di qualche px" ma riservare le corsie a livello di layout (header a 3 colonne
   con corsia centrale vuota per l'isola).
2. "Compatto" per l'utente non significa "minimo": il brand può perdere spazio ma non presenza.
   Quando riduco qualcosa di identitario, proporre il punto di mezzo (80px/4xl), non l'estremo.

## 2026-06-13 — Niente "abbellimenti" aggiunti: l'utente vuole funzione + dati veri, non decorazioni

**Contesto:** sul redesign cassetti ho aggiunto, uno dopo l'altro, elementi bocciati: panoramica
"vetrata"/totali per stadio ("a noi interessano solo i badge"), legame gentile testata↔card
(hairline+alone, "non mi piace per niente"), empty-state "n/d" sul Ticket OFF ("sembra rotto").
Pattern coerente con altre bocciature passate: glow cursor-following (K/S), e in generale le
aggiunte estetiche/aggregati che non sono dato operativo.

**Lezione:**
- Questo utente premia **funzione + immediatezza + dato reale**, non orpelli. Default per "renderlo
  più bello": migliorare gerarchia/spaziatura/colore di ciò che ESISTE, NON aggiungere nuovi
  elementi decorativi (aloni, hairline di collegamento, barre riassuntive, placeholder testuali).
- Stati "vuoto": MAI placeholder che sembrano rotti (`-`, `n/d`). Mostrare un **valore reale**
  (`0,00 €`) o lo stato esplicito; allineare i KPI fra loro.
- Quando propongo qualcosa di "spettacolare", chiarire che lo spettacolo deve nascere dagli
  elementi reali (le card, i badge), non da overlay aggiunti — e aspettarmi che gli overlay
  vengano tagliati. Cfr. `tasks/ux-backlog.md` (famiglia cursor-following bandita).
- **Non allargare lo scope ai vicini.** Stesso giorno: il fix era SOLO la barra strumenti, ma
  io ho "unificato" anche i filtri azienda e cambiato larghezze/allineamento → bocciato ("i
  filtri andavano lasciati identici, dovevamo sistemare solo la barra sotto"). Quando l'utente
  indica UN elemento, toccare solo quello; le incoerenze percepite da me sui vicini NON sono un
  invito a rifattorizzarli. Se penso valga la pena, lo PROPONGO a parte, non lo eseguo d'ufficio.

## 2026-07-02 — Verifica visiva: la fa l'utente, io NON avvio browser/screenshot

**Contesto:** durante il restyling dell'area Turni & Riposi ho avviato più volte `npm run dev:demo`
+ Claude-in-Chrome per fare screenshot e validare il look a video. L'utente mi ha fermato:
«non verificare a video perché ci sono io per questo».

**Lezione:** per i cambiamenti UI il gate che DEVO fare è quello **non-visivo** — `npx tsc --noEmit`,
`vitest`, `npm run build`, rilettura del diff. La **verifica a schermo la fa l'utente** nel suo
ambiente (owner, dati reali). NON avviare dev server né browser per screenshot di validazione, a
meno che non me lo chieda esplicitamente. Consegno le modifiche verdi, descrivo cosa aspettarsi e —
se serve tarare un valore estetico (es. intensità di un colore) — do i valori esatti e attendo il
suo riscontro invece di iterare a video da solo. Risparmia tempo/cache e non duplica il suo lavoro.
Cfr. memoria `feedback-verifica-video-utente`.

## 2026-07-02 — Un logo SCELTO dall'utente NON si ridisegna a mano: si usa il file dato

**Contesto:** rebrand Valora. L'utente aveva scelto un logo (monogramma VO generato su Google Flow,
2 varianti quasi identiche). Io ho proposto di "ricostruirlo in SVG geometrico pulito" e ho consegnato
un mio ridisegno a mano. Reazione: **«non ci siamo per niente, i loghi sono completamente diversi,
devi prendere quelli che ti ho dato così fai prima».**

**Lezione:**
1. Quando l'utente ha già **scelto** un artefatto grafico (logo/immagine), il default è **usare quel file**,
   non produrne una mia interpretazione. Un "ridisegno pulito" cambia la forma → è percepito come un logo
   DIVERSO, e vanifica la sua scelta. La fedeltà batte la mia idea di "eleganza geometrica".
2. Rendere utilizzabile un raster ≠ ridisegnarlo. La pipeline giusta e VELOCE ("così fai prima"):
   **ritaglio + sfondo trasparente** (Pillow/numpy: alpha da min-channel, `alpha[alpha<45]=0` per uccidere
   l'alone della vignettatura, autocrop al bbox) → PNG trasparente su qualunque fondo chiaro; favicon quadrata
   centrando su canvas trasparente. Verifica tecnica del MIO output (non del gusto): comporre il simbolo su
   bianco **e su navy** e guardarlo → smaschera aloni/box residui e parti mangiate.
3. Se serve un **vettoriale**, si fa un **trace FEDELE** del file scelto (potrace/vtracer), non un ridisegno
   a mano. Proporre il redraw solo se l'utente lo chiede esplicitamente.
4. Regola generale: "ricostruire in SVG pulito" suona professionale ma è **scope che l'utente non ha chiesto**
   e che ne ribalta una decisione già presa. Cfr. principio interventi chirurgici + [[feedback-verifica-video-utente]].

## 2026-07-05 — Scontorno di un'immagine scelta: SOLO sfondo→alpha, zero "migliorie" non chieste

**Errore commesso (illustrazione CAF/Patronato):** dovevo solo rendere trasparente lo sfondo. Invece:
(1) ho aggiunto una **dissolvenza orizzontale** ai lati (7%) che ha mangiato le estremità delle bande —
un'alterazione dell'artwork che nessuno aveva chiesto; (2) i **semi del flood-fill piazzati lungo tutto il
perimetro** cadevano DENTRO la banda verde pallida → la banda intera è stata scambiata per sfondo e rimossa;
(3) ho consegnato senza confrontare il risultato con l'originale fianco a fianco. Risultato: «è veramente
brutta, dovevi solo rendere trasparente lo sfondo senza alterare l'immagine».

**Regole:**
1. Su un artefatto grafico già scelto dall'utente, l'operazione richiesta è un **contratto letterale**:
   sfondo→trasparente significa che ogni pixel NON di sfondo resta identico. Niente fade, crop, erosioni
   o rifiniture estetiche a mia iniziativa (stessa famiglia della lezione "logo: usare il file dato").
2. Flood-fill dai bordi: **filtrare i semi** (solo pixel chiari E non saturi) — il perimetro può attraversare
   elementi dell'artwork che toccano il bordo (bande, cornici) e un seme lì dentro li cancella in blocco.
3. Verifica PRIMA di consegnare: composito su chiaro E su scuro + **confronto con l'originale** chiedendosi
   "cosa manca rispetto a prima?" — non solo "lo sfondo è sparito?".

**Addendum 05/07 sera — la ricetta che ha funzionato (2° giro, dopo «residui/chiazze in dark»):**
il 1° giro aveva lasciato polvere, aloni e pezzi di sfondo con bordi strappati, visibili SOLO sul backdrop
scuro reale (gradiente traslucido su pannello dark ≈ grigio medio: lì ogni residuo chiaro spicca; su bianco
si mimetizzava). Pipeline che ha retto (commit 1984d80, `caf-patronato-illustrazione.webp`):
1. **RGB sempre dall'ORIGINALE** (recuperato da git: la 1ª versione committata dell'asset aveva lo sfondo
   pieno) — mai dal cutout precedente, che ha frange contaminate.
2. **Calibrare le soglie campionando** lum/sat delle zone: sfondo (era 234-240, sat≤15), bianchi artwork
   (252+), ombre, contorni. Banda di scavo `[bg_riga−90, bg_riga+6]` con sat≤26: il +6 tiene fuori i bianchi
   dei documenti, il −90 INCLUDE le ombre ma NON i contorni scuri (lum<145) → i contorni fanno da barriera
   e proteggono gli interni bg-simili (la carta della stretta di mano era lum 239 = sfondo!).
3. **Scavo geodetico** (crescita dalla zona già trasparente, solo dentro la banda) + despeckle geodetico
   (erode r4 → reconstruct) + fill dei buchi chiusi + blur/soglia per lisciare il bordo.
4. Verifica sul **backdrop REALE** (riprodurre il gradiente della card in dark, non un grigio a caso) +
   zoom sulle zone che l'utente ha indicato + le zone a rischio (bianchi≈sfondo, elementi che toccano i bordi).

## 2026-07-08 — Verità da input multipli: se la stessa chiave ha due fonti che discordano, NON auto-applicare

**Sintomo (prova d'accuratezza, Cataneo):** il perser trovava ~15 errori, "Correggi" li correggeva, ma al
ri-controllo ritrovava gli **stessi errori al contrario** e li riportava al valore vecchio (flip-flop infinito).

**Causa:** `verifyFromFolder` confrontava **ogni file PDF** contro la riga del mese. Se la cartella aveva
**più buste sullo stesso (anno,mese)** (doppioni `... (1).PDF`, conguagli, file misfilati), nascevano **due
"verità" in conflitto sulla stessa cella**; `applyTruthFixes` (last-wins) ne applicava una, e al giro dopo la
riga combaciava con un file e contrastava con l'altro → oscillazione. **Il write in tabella era già corretto:**
il difetto era la *verità ambigua a monte*. (Diagnosi verificata riproducendo il round-trip in Node, non a occhio.)

**Regola per me:** quando una feature "porta il dato alla verità estratta", la verità dev'essere **univoca per
chiave** prima di scrivere. Se più fonti mappano sulla stessa chiave: se **concordano** → collassa a una; se
**discordano** → è un CONFLITTO, non correggere in automatico, **segnalalo** e lascia decidere all'umano
(dati legali!). Un tool che verifica non deve *dipendere* dall'input perfetto: un errore umano silenzioso che
sovrascrive un dato giusto è peggio di un errore visibile. Fix: raggruppo per chiave, `truthSignature` per
riconoscere i doppioni identici, campo `mesiInConflitto` mostrato nel modale.
