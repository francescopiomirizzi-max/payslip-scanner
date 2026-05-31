# Helper locali (solo Mac, niente deploy)

Due strumenti **solo locali** (girano sul Mac, non vengono deployati su Netlify):

1. **Importa Concluse** — smista nelle loro cartelle i documenti generati dal
   bottone **"Esporta Concluse (ZIP)"** del sito.
2. **Sostituisci Riepilogo** — rimpiazza il vecchio `Riepilogo_somme_richieste_*.pdf`
   nelle cartelle `conteggi/` con quello generato dal tasto **"Stampa"** del report
   (la tabella fedele al report). Vedi in fondo.

---

## 1. Importa Concluse

## Cosa fa

1. Cerca i file `Concluse_*.zip` nella cartella **Download**.
2. Per ogni pratica nello ZIP smista i 3 documenti (Conteggi PDF, Riepilogo PDF,
   Relazione .docx) nella cartella `Cedolini Lavoratori` sul Desktop, con **merge
   intelligente**:
   - cerca la cartella del lavoratore **ovunque** sotto l'azienda, confrontando i
     nomi *normalizzati* (ignora spazi finali, MAIUSCOLE/minuscole, accenti,
     apostrofi/underscore **e l'ordine** cognome/nome). Così aggancia anche archivi
     annidati (es. RFI sotto `Pratiche finite/<categoria>/`) e nomi scritti in modo
     diverso (es. `D'ERRICO PAOLO` ↔ `PAOLO D_ERRICO`);
   - **1 corrispondenza** → mette i file lì dentro (posizione e `buste paga`
     preservate);
   - **0 corrispondenze** → lavoratore nuovo: crea `AZIENDA/COGNOME NOME/conteggi`;
   - **match incerto** (più cartelle corrispondono) → mette i file in
     `_DA SMISTARE/` e lo segnala, così li sistemi tu a mano. **Mai un documento nel
     posto sbagliato.**
3. I file con lo stesso nome vengono **sovrascritti** (l'ultima versione è quella buona).
4. Lo ZIP importato viene spostato in `Download/_Concluse_importati/` (con data/ora):
   non viene cancellato, è una rete di sicurezza.

Tocca solo le sottocartelle `conteggi/`: le `buste paga/` non vengono mai modificate.

## Come si usa

**Doppio click** su `Importa Concluse.command`.

Si apre una finestra di Terminale che mostra cosa è stato importato (quante pratiche,
quali nomi) e poi si chiude premendo un tasto.

> Primo avvio: macOS può bloccare il file con "sviluppatore non identificato".
> Tasto destro sul file → **Apri** → **Apri** (solo la prima volta).

### Alternativa da riga di comando

```bash
node helper/import-concluse.mjs
```

## Note

- Trova da solo la cartella `Cedolini Lavoratori` cercandola nelle sottocartelle del
  Desktop: se rinomini la cartella "Pratiche…" continua a funzionare.
- Richiede Node.js (già installato). Non usa pacchetti npm: solo moduli di sistema +
  `unzip` di macOS.
- Flusso tipico: sul sito *menu Dati → Esporta Concluse* → si scarica lo ZIP → doppio
  click su `Importa Concluse.command`.

---

## 2. Sostituisci Riepilogo

Rimpiazza il vecchio `Riepilogo_somme_richieste_*.pdf` nelle cartelle `conteggi/`
con la versione **fedele al report** generata dal tasto **"Stampa"**.

### Come si usa

1. Sul sito apri il **report** del lavoratore concluso → tasto **"Stampa"** →
   **"Salva come PDF"**. Il file esce già col nome giusto
   (`Riepilogo_somme_richieste_<Cognome>_<Nome>.pdf`) e finisce nei **Download**.
   Ripeti per ogni lavoratore concluso.
2. **Doppio click** su `Sostituisci Riepilogo.command`.

### Cosa fa

- Per ogni `Riepilogo_somme_richieste_*.pdf` nei Download:
  - **nome file identico** a un Riepilogo già presente in una sola cartella
    `conteggi/` → lo **sovrascrive** lì (caso normale: vecchio e nuovo hanno lo stesso
    nome perché la stampa imposta quel titolo). Gestisce anche i duplicati del browser
    (` (1)`, ` (2)`…);
  - altrimenti prova il match sul **nome lavoratore** normalizzato (ignora
    spazi/maiuscole/accenti/ordine): se una sola cartella corrisponde, mette lì il file;
  - **0 o più corrispondenze** → sposta il PDF in `_DA SMISTARE/` sul Desktop e lo
    segnala. **Mai un documento nel posto sbagliato.**
- Tocca **solo** il Riepilogo: `Conteggi_*.pdf`, `buste paga/` e la Relazione non si
  toccano mai.
- I PDF importati vengono archiviati in `Download/_Riepilogo_sostituiti/` (con data/ora):
  non vengono cancellati.

### Alternativa da riga di comando

```bash
node helper/sostituisci-riepilogo.mjs
```

### Opzioni (per pen drive / altre destinazioni)

Tutte facoltative; senza opzioni vale il comportamento di default (Download →
cartella sul Desktop, sposta e archivia).

- `--da <cartella>` — sorgente dei PDF. Con questa opzione la cartella viene
  esplorata **ricorsivamente** (puoi puntare a un intero albero `Cedolini Lavoratori`).
- `--in <cartella>` — `Cedolini Lavoratori` di destinazione (es. quella sulla pen drive).
- `--copia` — **copia** i PDF senza spostarli né archiviare: la sorgente resta intatta
  (i non abbinati vengono solo segnalati, non spostati in `_DA SMISTARE`).

**Aggiornare la pen drive del sindacalista** usando come master i Riepilogo già
corretti nell'archivio sul Desktop (niente ristampe):

```bash
node helper/sostituisci-riepilogo.mjs \
  --da "$HOME/Desktop/Pratiche_differenze_ retributive_ indennità/Cedolini Lavoratori" \
  --in "/Volumes/NOME_PENDRIVE/Cedolini Lavoratori" \
  --copia
```

> Il master affidabile sono i file dentro l'albero `Cedolini Lavoratori` sul Desktop
> (la cartella `Download/_Riepilogo_sostituiti/` può essere ripulita dal sistema).
