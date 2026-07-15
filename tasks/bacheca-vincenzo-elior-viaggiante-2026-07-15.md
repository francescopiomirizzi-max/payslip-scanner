# Bacheca Vincenzo + note operative — Elior viaggiante (2026-07-15)

> File di lavoro per il **messaggio in bacheca** (da comporre DOPO le scansioni, prima del deploy)
> e per le **cose da chiedere/dire a Vincenzo**. Raccolto durante la ri-scansione v2 dei 10 viaggiante.

---

## 📢 MESSAGGI BACHECA — BOZZE PRONTE (per l'account viewer di Vincenzo)

> Due annunci distinti, senza cifre e senza tecnicismi. Da pubblicare **con il deploy**
> (il messaggio 1 cita il nuovo look, che sarà visibile solo dopo). Attendono l'ok dell'utente.

### ▶️ MESSAGGIO 1 — «Aggiornamento pratiche» (prima persona singolare = Francesco)

Ciao Vincenzo, ecco cosa ho sistemato di recente.

**Elior viaggiante (indennità assenza residenza)**
- Ho caricato in archivio **tutte le buste** dei 10 lavoratori (oltre 660 in tutto, da febbraio 2020 a
  fine 2025): ora sono tutte consultabili nella scheda di ciascuno.
- Ho costruito un **nuovo sistema di lettura e controllo** delle buste: mentre estrae i dati verifica
  automaticamente che ogni voce, i totali e le tariffe quadrino al centesimo, e segnala le buste da
  ricontrollare. Ho poi verificato la voce dell'indennità (4301) **una per una** su tutti i lavoratori:
  risulta corretta ovunque.
- Da chiarire con l'avv. Celentano: l'indennità risulta pagata con la voce **4301 «Fuori sede ITA
  turni RFR»**, non con i codici **4300/4305** su cui è impostato il ricorso; e il periodo dei
  lavoratori va da **febbraio 2020** (assunzione) a **fine 2025**, non «nov 2017 – lug 2023». Due
  punti da verificare: quale voce e quale periodo mettere a base del ricorso.
- L'area **"Indennità"** del sito la sto preparando: comparirà dopo questi chiarimenti.

**Viterbo (mancati riposi)**
- Ho completato i documenti con la **rivalutazione ISTAT e gli interessi legali** «tempo per tempo», con
  lo stesso metodo del perito. La relazione ha ora la forma da depositare (oggetto, premessa,
  conclusioni, firma).
- Nei documenti trovi **due conteggi a confronto**, entrambi spiegati al giudice: quello del documento
  sorgente e il mio, più prudente (conta solo la quota di riposo davvero mancante).
- **Precisazioni importanti (per l'avvocato):**
  - Il «20%» è la maggiorazione festiva ed è **già compresa** nella paga oraria che ho usato (verificata
    sulle buste): non va sommata a parte.
  - Considero **solo le giornate CEE** (autotrasporto), con la relativa base di legge.
  - I giorni **lavorati senza orario** non li conto come riposo (per non gonfiare il conteggio).
  - La regola delle **45 ore intere** (riposo concesso oltre il termine) è per ora esclusa in via
    prudenziale, attivabile se l'avvocato lo ritiene.
  - La rivalutazione è aggiornata all'**ultimo indice ISTAT** pubblicato; si aggiornerà con i nuovi indici.

**Sito** — ho rinnovato il look (intestazione FAST-CONFSAL) e migliorato la leggibilità dei calendari e
delle pratiche.

### ▶️ MESSAGGIO 2 — «Buste paga che servono per completare le pratiche»

Ciao Vincenzo, per completare alcune pratiche mi servono queste buste paga. Ecco cosa manca, lavoratore
per lavoratore — appena me le fai avere completo i conteggi:

- **Boriglione** (Elior): Febbraio 2023
- **Clarino** (Ferrovie del Sud Est): Settembre 2017
- **Gagliano** (Mercitalia): Novembre 2024
- **Circello** (RFI): da Aprile 2016 fino alla cessazione (2020)
- **Paciello** (RFI): Dicembre 2007, Gennaio 2008, Luglio 2010
- **Rosiello** (RFI): da Settembre a Dicembre 2007, Giugno 2009, tutto il 2025
- **Cataneo Pasquale** (Trenitalia): Novembre 2008, da Marzo a Dicembre 2025

Grazie!

---

## A. Da dire / chiedere a Vincenzo (nel messaggio in bacheca)

### 1. 🔴 Il ricorso è impostato sui codici sbagliati — 4300/4305 vs 4301
Verificato su **665 buste reali** dei 10 viaggiante:
- La voce dell'indennità di assenza residenza effettivamente pagata è la **4301 «FUORI SEDE ITA
  TURNI RFR» a €1,00/h**, presente in (quasi) ogni mese lavorato.
- I codici **4300 / 4305** su cui è costruito il ricorso **non compaiono mai** come voce genuina:
  le pochissime occorrenze nel DB sono **zeri o errori OCR** (es. Martinelli Dic 2024 ha 4300 =
  esattamente il valore del 4301, cioè un duplicato; Boriglione Apr 2023 ha 2,80 = la tariffa del
  pernottamento finita nella colonna sbagliata).
- **Quesito avvocato**: qualificazione della 4301 (misura «con/senza riposo»?) e **periodo del credito**.
  La finestra del ricorso («nov 2017 – lug 2023») è sbagliata su **entrambi gli estremi** per questi 10:
  il rapporto parte da **Feb 2020** (data assunzione, prima busta) e la 4301 a €1,00/h arriva fino a
  **Dic 2025** (contraddice sia il «nov 2017» sia il «misura piena da ago 2023»/«fino a lug 2023»).

### 2. Perché l'area «Indennità / assenze residenza» del sito è VUOTA
- **(a) Tecnico**: la tabella che regge quell'area **non è ancora attiva in produzione**
  (migration 021 non applicata) → non ha dati da mostrare.
- **(b) Sostanziale**: la vertenza è costruita su 4300/4305 che nelle buste non esistono → prima di
  popolare l'area serve **riconfigurare la pratica sulla 4301**, dopo la decisione dell'avvocato.
- Si popolerà **dopo**: deploy + attivazione tabella + configurazione pratiche su 4301.

### 3. ~~Buco nov 2017 → gen 2020~~ — NON è un buco (correzione utente 15/07)
I 10 viaggiante sono **assunti 01/02/2020** (DATA ASSUNZIONE sulle buste; prima busta = Feb 2020 per
tutti e 10, confermato sul DB). Il periodo nov 2017–gen 2020 **non esiste**: nessun rapporto, nessuna
busta pregressa. **Non c'è nulla da chiedere.** Il credito parte da Feb 2020 (vedi periodo in A.1).

### 4. Nitti — Luglio 2022 illeggibile
Su quella busta la tabella voci è quasi vuota (stampata solo l'una tantum €200), pur con totale
competenze 5.808,75 → la **4301 di quel mese non è determinabile**. Se serve, chiedere una copia più
leggibile di *Nitti Luglio 2022*.

### 5. Buste 2025 mancanti — ⚠️ DETTAGLIO INTERNO (nel messaggio a Vincenzo va SOLO: «mancano alcune buste del 2025, inviacele»)
Gregorio (Gen–Ago 2025), Nitti (Gen–Lug 2025), Paglionico (Lug 2023 + Gen–Lug 2025), Pierro
(Feb–Nov 2025). **Scoperta nella passata finale (15/07):** questi ~32 mesi **non sono vuoti**: la
griglia ha un **4301 da OCR v1** (con daysWorked e note) ma **nessuna busta corrente** (voce 1000
nulla) → NON passati dai controlli v2. Se il motore Indennità somma la 4301 dalla griglia, questi
valori entrano nel credito **da dati non verificati**.
**NON è cessazione**: dal DB tutti e 10 risultano occupati fino a **Ott 2025** (Pierro Dic 2025) →
il lavoratore c'era, la busta esiste ma non è nel materiale ri-splittato del 12-13/07 (probabilmente
la consegna di luglio era incompleta per il 2025). I valori v1 sono readings reali di allora.
**Decisione (utente + avvocato):** (a) recuperare quelle buste 2025 da Vincenzo e ri-scansionarle,
oppure (b) tenere i valori v1 dichiarandoli «non ri-verificati», oppure (c) escluderli dal credito
(prudenziale). Elenco completo dei 32 mesi nella query di sweep (sessione 15/07).

---

## B. Cose fatte dall'ultimo deploy — materiale per il messaggio (DA COMPILARE)

> Dai **24 commit** (09→14/07) + sessione **15/07**. Da tradurre in linguaggio per Vincenzo.
- Rebrand FAST-CONFSAL (fascia istituzionale nelle 3 aree, logo, archivio come workspace documentale).
- Controlli OCR buste cartacee Elior v2 (terne + validatore aritmetico + verify).
- Parser di verità FSE + Mercitalia (prova d'accuratezza dal disco).
- Rivalutazione ISTAT FOI + interessi legali per i Riposi (relazione + conteggi + UI).
- Fix motore Incidenze (tassi legali 2025/2026, indice FOI 2026).
- Era storica FSE 2010–2016, code-split bundle, toast anomalie persistente.
- **Sessione 15/07**: 676 buste viaggiante ricaricate + **scansione v2 con controlli**, verifica
  per-lavoratore della voce 4301 (vedi sez. A.1).

---

## C. Note tecniche (NON per Vincenzo)

1. **`elior_type` troppo largo** — 16 lavoratori NON-Elior (12 RFI + FSE/Clean/Mercitalia/Trenitalia)
   hanno `elior_type='viaggiante'` per errore: residuo dell'UPDATE del 13/07 (probabile
   `WHERE elior_type IS NULL` troppo ampio). Innocuo nei calcoli (profilo≠ELIOR lo ignora) ma sporca
   il filtro dell'area Indennità. **Fix proposto (in fase deploy, con ok utente):**
   `UPDATE worker_profiles SET elior_type=NULL WHERE profilo<>'ELIOR' AND elior_type='viaggiante';`
   (i 10 ELIOR restano intatti). NON ancora eseguito.

2. **Migration 021** (tabella pratiche Indennità) da applicare prima di configurare l'area.

3. **Modifiche locali non committate** (coda deploy-unico): validatore Elior affinato (esclusione
   TFR/fiscali dal check quantità + tariffe CCNL 2025) + toast anomalie persistente/scrollabile.

---

## D. Verifica per-lavoratore della 4301 (avanzamento)

| Lavoratore | Buste | Esito 4301 | Note |
|---|---|---|---|
| Boriglione | 70 | ✅ pulita | rinnovo CCNL 2025 su altre voci; 4301 ferma a 1,00 |
| Montanaro | 71 | ✅ pulita | Nov 2020 Δ3036 = TFR/crediti in competenze (spiegato) |
| Cautilli | 70 | ✅ pulita | Nov 2024: 4301 in codes, riga omessa da voci (credito ok); no-4301 = malattia |
| De Biasio | 71 | ✅ pulita | no-4301 = 2020 COVID + ferie estive |
| Gregorio | 64 | ✅ pulita | Ott 2021 Δ≈4301 (dropped-from-voci, credito ok) |
| Martinelli | 71 | ✅ pulita | no-4301 Nov/Dic 2023 = **infortunio** (verificato PDF) |
| Nitti | 64 | ✅ con 1 buco | **Lug 2022 illeggibile** (sez. A.4); Gen 2022 4301 = 1,00×195 ok |
| Paglionico | 63 | ✅ pulita | no-4301 = 2020; Dic 2025 terna 1000 misread, 4301 ok |
| Pierro | 61 | ✅ pulita | Dic 2021 Δ3760 = doppio-conteggio, 4301 ok (231,76); no-4301 = 2020 |
| Schingaro | 71 | ✅ pulita | Gen 2024 "sembra Dic 2023" = falso positivo (codici CONGUAGLIO); 4301 = 233,56 ok |

**Regola emersa**: gli scarti di riconciliazione sono sempre su voci **accessorie** (TFR, crediti,
arretrati); i mesi «senza 4301» sono sempre **assenze vere** (COVID 2020, ferie, malattia, infortunio),
riconosciute dai codici MAL/INF anche quando gg=26 (valore template). Nessuna 4301 persa in silenzio.
