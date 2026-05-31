# Helper locale — Importa Concluse

Strumento **solo locale** (gira sul Mac, non viene deployato su Netlify) che smista
nello loro cartelle i documenti generati dal bottone **"Esporta Concluse (ZIP)"** del
sito.

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
