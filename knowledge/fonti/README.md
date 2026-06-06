# Fonti grezze

Documenti originali da cui sono distillate le sintesi in `knowledge/`: CCNL completi, sentenze,
ricorsi, mail dell'avvocato, Excel di conteggio, buste di esempio.

## ⚠️ Questa cartella è gitignorata

Può contenere **dati personali** (nomi, buste paga, corrispondenza legale). Per questo, tutto il
contenuto di `fonti/` **tranne questo README** è escluso da git (vedi `.gitignore`). Non
committare buste, mail o sentenze con dati identificabili.

Le **sintesi** in `knowledge/` invece sono versionate: devono restare **prive di dati personali**
oltre il minimo necessario (codici voce, tariffe, metodo; i cognomi delle pratiche solo come
riferimento, il dettaglio resta nel DB).

## Convenzione di naming e sottocartelle suggerite

Crea le sottocartelle quando servono:

```
fonti/
├── ccnl/          → testi CCNL (es. ccnl-mobilita-af-2025-05-22.pdf)
├── sentenze/      → es. cass-20216-2022.pdf
├── avvocato/      → mail e quesiti (es. 2026-06-02-quesiti-rfi.md)
├── ricorso/       → ricorso depositato e allegati
└── excel-conteggi/→ es. palladino-ciro.xlsx
```

Nomi: `kebab-case`, con data `aaaa-mm-gg` dove utile.

## Flusso

1. Deposita qui il documento.
2. Chiedi a Claude di consolidarlo nella sintesi giusta in `knowledge/` (Claude estrae i fatti
   durevoli e cita la fonte).
3. La sintesi diventa il punto di accesso rapido; la fonte resta come riscontro.
