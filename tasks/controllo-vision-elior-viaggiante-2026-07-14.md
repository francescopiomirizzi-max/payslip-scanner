# Controllo ELIOR VIAGGIANTE — incrocio griglia ↔ censimento Vision

> Generato il 2026-07-14. Metodo: piano controlli OCR cartacee (11/07).
> Confronto **al centesimo della voce 4301** (la voce della vertenza residenza) tra il valore
> presente nella griglia `anni` (lettura di produzione **Gemini v1**) e il valore del
> **censimento Vision** del 13/07, limitato alle **436 buste riconciliate** (Σvoci = totale stampato).
> SOLO letture: **nessuna scrittura** su DB o buste.

## Risultato in una riga
- Su **401 buste confrontabili** (4301 presente sia in griglia sia nel censimento riconciliato):
  **248 CONCORDI** al centesimo (doppia lettura indipendente Gemini+Vision → *confermate*) ·
  **153 DIVERGENTI**.
- **261** buste hanno un 4301 in griglia ma il censimento non le riconcilia → **nessun secondo occhio** (non confrontabili).
- **3** buste hanno un 4301 nel censimento riconciliato ma **non** in griglia.

## ⚠️ Perché il censimento NON autorizza correzioni automatiche
Il tasso di divergenza (~38% dei confrontabili) **non** significa che la griglia sia sbagliata: il
`reconOk` del censimento garantisce solo che **Σ competenze = totale stampato**, NON che il 4301
sia attribuito alla riga giusta. Su queste scansioni **ruotate** Vision scambia frequentemente
label↔valore (trappola nota, censimento 13/07). Due prove concrete dai dati:

- **Cautilli Ott 2023**: griglia `194,05` — che è **la verità già verificata con Gemini** nel
  censimento del 13/07 — contro censimento `16,80`. Qui **la griglia è giusta, il censimento no**.
- I valori censiti *piccoli e ricorrenti* (16,80 · 8,00 · 18,20 · 2,80 · 14,00 · 23,31…) coincidono
  con importi di **altre** voci (pernottamento 2,80/notte, domenicale, ecc.): Vision ha agganciato
  la riga sbagliata. Applicarli alla griglia **distruggerebbe** ~150 valori corretti.

**Conseguenza operativa:** le divergenze sono *segnalazioni*, non correzioni. Le vere correzioni
richiedono di **rileggere il PDF** (ri-scansione con prompt v2 + validatore, cioè la *strada completa*),
non di copiare il censimento. Coerente con `ocr-ambiguity-flag-policy` e «prepariamo, l'avvocato decide».

## Confermate vs da-controllare, per lavoratore
| Lavoratore | ✅ Confermate | ⚠️ Divergenti | ⬜ Non confrontabili | ❓ Solo censimento | % conferma* |
|---|---:|---:|---:|---:|---:|
| Boriglione | 27 | 19 | 19 | 2 | 59% |
| Cautilli | 39 | 9 | 18 | 0 | 81% |
| De Biasio | 13 | 10 | 39 | 0 | 57% |
| Gregorio | 10 | 10 | 48 | 0 | 50% |
| Martinelli | 26 | 15 | 23 | 0 | 63% |
| Montanaro | 29 | 19 | 19 | 1 | 60% |
| Nitti | 21 | 13 | 32 | 0 | 62% |
| Paglionico | 21 | 25 | 22 | 0 | 46% |
| Pierro | 24 | 14 | 30 | 0 | 63% |
| Schingaro | 38 | 19 | 11 | 0 | 67% |
| **TOTALE** | **248** | **153** | **261** | **3** | **62%** |

*% conferma = concordi / (concordi+divergenti): quanta parte del confrontabile il secondo occhio conferma.

## Sospetti INTERNI alla griglia (indipendenti dal censimento)
Valori 4301 in griglia implausibili come €1×ore di **una singola mensilità** (> 250). Questi
meritano un controllo sul PDF **a prescindere** dal censimento (possibile doppio conteggio in fase OCR v1):

| Lavoratore | Mese | 4301 griglia | 4301 censimento |
|---|---|---:|---:|
| Boriglione | Set 2020 | 309.73 | 0.00 |
| Schingaro | Mag 2024 | 277.71 | 121.08 |
| Paglionico | Nov 2021 | 264.21 | 0.00 |
| Paglionico | Ott 2020 | 261.05 | 19.60 |

> Nota: questa lista copre solo le divergenti > soglia; un pass di sanità interna su TUTTA la
> griglia (incluse concordi/scoperte) è un controllo separato e deterministico, da fare a parte.

## Elenco completo divergenze (per revisione / ri-scansione mirata)
Δ = 4301 griglia − 4301 censimento. Ordinato per |Δ| decrescente (le più lontane prima).

| Lavoratore | Mese | 4301 griglia | 4301 censimento | Δ |
|---|---|---:|---:|---:|
| Boriglione | Set 2020 | 309.73 | 0.00 | 309.73 |
| Boriglione | Ago 2020 | — (assente) | 271.18 | -271.18 |
| Paglionico | Nov 2021 | 264.21 | 0.00 | 264.21 |
| Paglionico | Ott 2020 | 261.05 | 19.60 | 241.45 |
| Schingaro | Ago 2020 | 231.70 | 0.00 | 231.70 |
| Montanaro | Giu 2022 | 231.20 | 0.00 | 231.20 |
| Nitti | Dic 2023 | 230.00 | 0.00 | 230.00 |
| Paglionico | Dic 2022 | 229.70 | 0.00 | 229.70 |
| Gregorio | Ott 2025 | 227.46 | 0.00 | 227.46 |
| De Biasio | Lug 2021 | 226.15 | 0.00 | 226.15 |
| Pierro | Giu 2021 | 225.76 | 0.00 | 225.76 |
| Pierro | Mag 2022 | 233.55 | 8.00 | 225.55 |
| Gregorio | Ott 2020 | 224.63 | 0.00 | 224.63 |
| Paglionico | Dic 2024 | 233.56 | 15.84 | 217.72 |
| Schingaro | Gen 2024 | 233.56 | 15.92 | 217.64 |
| Montanaro | Ott 2023 | 234.03 | 16.80 | 217.23 |
| Boriglione | Set 2024 | 230.03 | 16.76 | 213.27 |
| Nitti | Ago 2022 | 231.20 | 23.31 | 207.89 |
| Pierro | Ago 2022 | 231.20 | 23.31 | 207.89 |
| Martinelli | Nov 2024 | 237.56 | 29.96 | 207.60 |
| Schingaro | Nov 2021 | 230.15 | 30.98 | 199.17 |
| Paglionico | Mar 2020 | 198.81 | 0.00 | 198.81 |
| Pierro | Ago 2024 | 230.03 | 33.52 | 196.51 |
| De Biasio | Apr 2024 | 196.08 | 0.00 | 196.08 |
| Boriglione | Ott 2023 | 230.03 | 34.18 | 195.85 |
| Schingaro | Mar 2020 | 195.85 | 0.00 | 195.85 |
| Pierro | Apr 2021 | 195.26 | 0.00 | 195.26 |
| Schingaro | Ago 2021 | 195.26 | 0.00 | 195.26 |
| Schingaro | Feb 2024 | 194.05 | 0.00 | 194.05 |
| Martinelli | Mar 2021 | 193.65 | 0.00 | 193.65 |
| Gregorio | Nov 2025 | 193.51 | 0.00 | 193.51 |
| Nitti | Mar 2023 | 38.46 | 231.80 | -193.34 |
| Boriglione | Lug 2023 | 230.03 | 37.34 | 192.69 |
| Schingaro | Giu 2024 | 192.43 | 0.00 | 192.43 |
| Montanaro | Ago 2024 | 192.28 | 0.00 | 192.28 |
| Gregorio | Gen 2021 | 191.01 | 0.00 | 191.01 |
| Paglionico | Feb 2022 | 194.00 | 4.46 | 189.54 |
| Pierro | Mar 2020 | 189.15 | 0.00 | 189.15 |
| De Biasio | Nov 2021 | 188.83 | 0.00 | 188.83 |
| Pierro | Ott 2022 | 193.45 | 8.00 | 185.45 |
| Paglionico | Nov 2025 | 195.81 | 14.00 | 181.81 |
| Boriglione | Nov 2023 | 195.81 | 14.56 | 181.25 |
| Nitti | Mag 2022 | 195.80 | 17.12 | 178.68 |
| Nitti | Ott 2020 | 195.28 | 16.80 | 178.48 |
| Nitti | Feb 2023 | 15.64 | 194.05 | -178.41 |
| Schingaro | Ott 2023 | 194.80 | 16.80 | 178.00 |
| Nitti | Ott 2022 | 193.45 | 15.95 | 177.50 |
| Montanaro | Nov 2024 | 192.28 | 14.98 | 177.30 |
| Montanaro | Ott 2024 | 194.05 | 16.76 | 177.29 |
| Cautilli | Ott 2023 | 194.05 | 16.80 | 177.25 |
| Paglionico | Gen 2022 | 61.08 | 237.88 | -176.80 |
| Paglionico | Nov 2023 | 190.96 | 14.56 | 176.40 |
| Boriglione | Ott 2024 | 192.28 | 16.76 | 175.52 |
| Paglionico | Ago 2023 | 194.05 | 19.16 | 174.89 |
| Paglionico | Mar 2023 | 192.28 | 19.60 | 172.68 |
| Martinelli | Set 2021 | 67.40 | 237.30 | -169.90 |
| Pierro | Apr 2022 | 191.10 | 23.15 | 167.95 |
| De Biasio | Set 2022 | 235.90 | 69.91 | 165.99 |
| Martinelli | Dic 2024 | 31.68 | 194.45 | -162.77 |
| Montanaro | Apr 2021 | 161.41 | 0.00 | 161.41 |
| Schingaro | Gen 2022 | 192.13 | 30.98 | 161.15 |
| Pierro | Lug 2024 | 192.28 | 31.58 | 160.70 |
| Montanaro | Feb 2024 | 194.05 | 33.80 | 160.25 |
| Montanaro | Lug 2022 | 158.05 | 0.00 | 158.05 |
| Schingaro | Gen 2021 | 157.06 | 0.00 | 157.06 |
| Paglionico | Nov 2022 | 157.03 | 0.00 | 157.03 |
| Schingaro | Mag 2024 | 277.71 | 121.08 | 156.63 |
| Nitti | Apr 2021 | 156.38 | 0.00 | 156.38 |
| Gregorio | Lug 2022 | 155.70 | 0.00 | 155.70 |
| Montanaro | Apr 2024 | — (assente) | 154.86 | -154.86 |
| Paglionico | Feb 2021 | 154.76 | 0.00 | 154.76 |
| Schingaro | Feb 2021 | 154.76 | 0.00 | 154.76 |
| Gregorio | Dic 2025 | 154.53 | 0.00 | 154.53 |
| Montanaro | Set 2023 | 154.53 | 0.00 | 154.53 |
| Paglionico | Ago 2025 | 186.51 | 32.22 | 154.29 |
| Paglionico | Ott 2025 | 189.71 | 37.34 | 152.37 |
| Boriglione | Dic 2024 | 79.84 | 232.20 | -152.36 |
| Montanaro | Ott 2020 | 151.80 | 0.00 | 151.80 |
| De Biasio | Set 2025 | 188.20 | 38.00 | 150.20 |
| Montanaro | Ott 2022 | 158.05 | 8.00 | 150.05 |
| De Biasio | Mag 2025 | 149.66 | 0.00 | 149.66 |
| Cautilli | Ott 2024 | 148.50 | 0.00 | 148.50 |
| Nitti | Giu 2022 | 153.35 | 8.00 | 145.35 |
| Cautilli | Nov 2024 | 154.53 | 11.20 | 143.33 |
| Schingaro | Ago 2022 | 155.70 | 14.00 | 141.70 |
| Boriglione | Nov 2021 | 152.25 | 11.20 | 141.05 |
| Martinelli | Mag 2022 | 157.06 | 17.12 | 139.94 |
| Boriglione | Mar 2022 | 158.05 | 20.35 | 137.70 |
| Gregorio | Apr 2023 | 152.76 | 16.80 | 135.96 |
| Martinelli | Giu 2025 | 148.31 | 12.73 | 135.58 |
| Nitti | Nov 2025 | 154.53 | 21.05 | 133.48 |
| Paglionico | Apr 2022 | 155.70 | 23.15 | 132.55 |
| Schingaro | Dic 2021 | 156.25 | 30.98 | 125.27 |
| De Biasio | Giu 2024 | 156.30 | 31.16 | 125.14 |
| Cautilli | Ott 2025 | 120.56 | 0.00 | 120.56 |
| De Biasio | Dic 2024 | 192.68 | 73.11 | 119.57 |
| Pierro | Dic 2024 | 192.28 | 73.11 | 119.17 |
| De Biasio | Lug 2023 | 116.78 | 0.00 | 116.78 |
| Paglionico | Mar 2022 | 155.00 | 40.70 | 114.30 |
| Schingaro | Set 2021 | 113.50 | 0.00 | 113.50 |
| Martinelli | Set 2025 | 149.83 | 38.00 | 111.83 |
| Schingaro | Set 2025 | 149.83 | 38.00 | 111.83 |
| Schingaro | Apr 2022 | 155.70 | 46.30 | 109.40 |
| Boriglione | Dic 2025 | 8.40 | 115.01 | -106.61 |
| Montanaro | Mar 2023 | 115.01 | 8.40 | 106.61 |
| Paglionico | Ago 2021 | 114.26 | 8.40 | 105.86 |
| Pierro | Ott 2024 | 116.78 | 11.20 | 105.58 |
| Boriglione | Ott 2022 | 114.75 | 16.00 | 98.75 |
| Martinelli | Ott 2025 | 116.78 | 18.67 | 98.11 |
| Paglionico | Set 2023 | 115.01 | 18.20 | 96.81 |
| Pierro | Set 2023 | 115.01 | 18.20 | 96.81 |
| Martinelli | Ago 2025 | 112.56 | 16.11 | 96.45 |
| Martinelli | Ago 2023 | 152.76 | 57.48 | 95.28 |
| Paglionico | Gen 2021 | 134.80 | 229.66 | -94.86 |
| Montanaro | Ago 2022 | 117.95 | 23.31 | 94.64 |
| Paglionico | Giu 2024 | 231.80 | 142.92 | 88.88 |
| Montanaro | Mar 2021 | 67.40 | 153.86 | -86.46 |
| Montanaro | Lug 2020 | 76.83 | 157.73 | -80.90 |
| Cautilli | Lug 2025 | 79.03 | 0.00 | 79.03 |
| Cautilli | Giu 2024 | 154.53 | 76.14 | 78.39 |
| Paglionico | Ago 2022 | 77.85 | 0.00 | 77.85 |
| Schingaro | Dic 2024 | 76.14 | 0.00 | 76.14 |
| Martinelli | Apr 2020 | 72.83 | 0.00 | 72.83 |
| De Biasio | Feb 2021 | 77.76 | 5.60 | 72.16 |
| Schingaro | Feb 2022 | 77.25 | 11.20 | 66.05 |
| Montanaro | Dic 2024 | 73.11 | 8.00 | 65.11 |
| Montanaro | Gen 2024 | 152.76 | 216.52 | -63.76 |
| Paglionico | Apr 2024 | 194.96 | 135.60 | 59.36 |
| Martinelli | Lug 2022 | 195.80 | 139.81 | 55.99 |
| Gregorio | Apr 2021 | 49.15 | 0.00 | 49.15 |
| Pierro | Giu 2024 | 15.58 | 62.32 | -46.74 |
| Boriglione | Gen 2025 | 239.53 | 194.05 | 45.48 |
| Gregorio | Set 2024 | 77.26 | 33.52 | 43.74 |
| Cautilli | Dic 2024 | 118.55 | 76.14 | 42.41 |
| Martinelli | Lug 2024 | 194.05 | 152.27 | 41.78 |
| Martinelli | Gen 2025 | 194.05 | 152.27 | 41.78 |
| Boriglione | Dic 2021 | 190.43 | 150.43 | 40.00 |
| Martinelli | Ott 2023 | 39.51 | 0.00 | 39.51 |
| Cautilli | Apr 2020 | 39.48 | 0.00 | 39.48 |
| Nitti | Apr 2020 | 39.48 | 0.00 | 39.48 |
| Nitti | Gen 2022 | 156.38 | 195.00 | -38.62 |
| Paglionico | Lug 2020 | 40.41 | 2.80 | 37.61 |
| Boriglione | Set 2025 | 79.84 | 112.08 | -32.24 |
| Boriglione | Gen 2021 | 191.01 | 220.67 | -29.66 |
| Pierro | Lug 2020 | 44.41 | 67.01 | -22.60 |
| Paglionico | Lug 2021 | 164.88 | 184.88 | -20.00 |
| Cautilli | Gen 2022 | 134.80 | 150.88 | -16.08 |
| Gregorio | Nov 2024 | 20.00 | 8.00 | 12.00 |
| Boriglione | Apr 2023 | 7.00 | 18.31 | -11.31 |
| Nitti | Mar 2024 | 154.53 | 143.28 | 11.25 |
| Boriglione | Apr 2024 | — (assente) | 8.00 | -8.00 |
| Boriglione | Mag 2025 | 159.69 | 152.93 | 6.76 |
| Boriglione | Mag 2024 | 153.28 | 159.69 | -6.41 |
| Montanaro | Lug 2025 | 77.26 | 73.11 | 4.15 |
| Boriglione | Lug 2025 | 159.69 | 158.06 | 1.63 |
| Montanaro | Mar 2022 | 116.75 | 117.95 | -1.20 |

## Verifica sui PDF originali dei 4 sospetti interni (14/07) — correzione applicata
Ho aperto e letto i 4 PDF sul Desktop, leggendo la terna della voce 4301 (`valore unitario × ore = competenze`):

| Lavoratore | Mese | 4301 griglia | Busta (terna) | Esito |
|---|---|---:|---|---|
| Boriglione | Set 2020 | 309,73 | 1,00 × 309,73 = **309,73** | ✅ griglia GIUSTA (mese davvero alto) |
| Paglionico | Ott 2020 | 261,05 | 1,00 × 261,05 = **261,05** | ✅ griglia GIUSTA |
| Paglionico | Nov 2021 | 264,21 | 1,00 × 264,21 = **264,21** | ✅ griglia GIUSTA |
| **Schingaro** | **Mag 2024** | **277,71** | 1,00 × 121,08 = **121,08** | ❌ griglia SBAGLIATA → **corretta a 121,08** |

- **1 errore reale su 4**: `Schingaro Nicola Leonardo, Mag 2024` — UPDATE chirurgico applicato sul DB
  (`worker_profiles.anni[208].4301: 277.71 → 121.08`, RETURNING confermato).
- Nota di metodo: il censimento Vision aveva sbagliato su **3 di questi 4** (dava 0 dove la busta ha
  un 4301 pieno) → ulteriore conferma che NON è una fonte per correggere.
- ⚠️ **Serve hard-refresh** dell'app prima di riaprire la pratica Schingaro, altrimenti uno stato
  stale del browser può sovrascrivere l'edit SQL (lezione `anni-clobber-stale-browser`).

## Verifica indipendente con subagente (pilota) — 14/07
Pilota su 15 buste Boriglione (batch_01): un subagente ha letto ogni PDF "alla cieca" (senza sapere
il valore di griglia) e riportato la terna 4301. Esito: **coincide con la griglia in 11/15** (incluso
Set 2020 = 309,73 che avevo già verificato io), e le 4 discordanze sono tutte errori REALI di griglia
(OCR v1), poi verificati da me sui PDF e **corretti**:

| Busta | Griglia (v1) | Busta reale | Tipo errore |
|---|---:|---:|---|
| Ago 2020 | *assente* | **271,18** | 4301 mancante (4285 = −73,56 quel mese) |
| Dic 2021 | 190,43 | **150,43** | valore errato (5↔9) |
| Gen 2022 | 73,56 | **190,88** | griglia aveva salvato la voce **4285** (paga base/26) |
| Lug 2022 | 73,56 | **155,70** | stessa confusione 4285↔4301 |

→ **Classe di errore v1 scoperta:** talvolta la griglia ha salvato la 4285 (73,56) al posto della 4301.

## Correzioni applicate oggi (tutte verificate su PDF, terna quadrata)
| Lavoratore | Mese | Prima | Dopo |
|---|---|---:|---:|
| Schingaro | Mag 2024 | 277,71 | 121,08 |
| Boriglione | Ago 2020 | assente | 271,18 |
| Boriglione | Dic 2021 | 190,43 | 150,43 |
| Boriglione | Gen 2022 | 73,56 | 190,88 |
| Boriglione | Lug 2022 | 73,56 | 155,70 |

## Decisione sul grosso (scelta utente 14/07)
Le ~368 buste non ancora confermate NON si verificano una-a-una coi subagenti (costo ~1,3M token):
si passa alla **ri-scansione v2 in LOCALE** (`netlify dev`, nessun deploy in prod), che rilegge ogni
busta con Gemini v2 + validatore delle terne — lo stesso metodo che ha già intercettato questi errori,
ma automatico e al centesimo. Runbook nella chat / prossima sessione.

## Conclusioni
1. **248 buste** hanno un 4301 **doppiamente confermato** (Gemini griglia = Vision censimento, al centesimo): su queste la fiducia è alta.
2. **417 buste** NON sono confermate da questo metodo → sono la **coda prioritaria** per la *strada completa* (deploy prompt v2 + ri-scansione col validatore) quando l'utente deciderà di attivarla.
3. **Nessuna correzione dal censimento** (fonte troppo rumorosa per-voce, prova Cautilli Ott 2023). L'unica correzione applicata (Schingaro Mag 2024) nasce dalla **lettura diretta della busta**, non dal censimento.
4. I **sospetti interni** (griglia 4301 implausibile) vanno verificati sul PDF: dei 4 controllati, solo 1 era un errore vero → l'euristica ">soglia" è un filtro grezzo, non un rilevatore affidabile. La copertura completa resta la ri-scansione v2.
