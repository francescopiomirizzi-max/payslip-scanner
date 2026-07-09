# Analisi — Relazione tecnica mancati riposi (esempio Monteleone / Ferrovie Sud Est) — 09/07/2026

> Documenti consegnati da Vincenzo il 09/07 nella cartella *"Nuovi file da analizzare"*. Chiesto:
> capire **come è impostata la pratica dei mancati riposi**, usando questa relazione come esempio.
> L'inserimento dell'azienda **FSE** in app è per una sessione futura. Qui: solo analisi, niente codice.

## Cosa c'è di nuovo (e cosa no)

| File | Stato |
|---|---|
| `Foglio_calcolo_...DIVISO_ANNO...xlsx` | **Identico** (stesso MD5) a quello già in `VITERBO TOMMASO/`. Nessuna novità. |
| `IMPORTANTE Relazione_tecnica_mancati_riposi_.docx` | **Nuovo contenuto.** Template compilato per **Monteleone Giuseppe**, operatore d'esercizio **Ferrovie del Sud Est S.r.l.** |
| `WhatsApp Image ...jpeg` | Solo uno **screenshot** della relazione qui sopra (sezione 3). Nessun contenuto autonomo. |
| `VITERBO FSE/` | Buste 2009–2024 del lavoratore + prospetti (RiepilogoGenerale, Nota metodologica, TFR, interessi). Materiale della **futura** pratica FSE. |

## Il metodo della relazione = quello già documentato e implementato

La relazione **non introduce un metodo nuovo**: ricalca esattamente la metodologia già in
[`knowledge/metodologia-mancati-riposi.md`](../knowledge/metodologia-mancati-riposi.md) e implementata in
[`utils/restEngine.ts`](../utils/restEngine.ts). Confronto punto per punto:

| Elemento | Relazione (Monteleone, ruolo sett. 2024) | Già in app / knowledge | Esito |
|---|---|---|---|
| Normativa | Reg. CE 561/2006, L.138/1958, D.Lgs 66/2003 | idem | ✅ combacia |
| CCNL quantificazione | 23/07/1976 (art.6,15), 12/03/1980 (art.11), 12/06/1982, 25/07/1997 (art.14) | idem | ✅ combacia |
| Retribuzione normale | tabellare + contingenza + scatti + mensa + T.D.R. + assegni ad personam | idem | ✅ combacia |
| Divisore | **195** (39h/6gg = 6,5h/g × 30) | 195 | ✅ combacia |
| Ratei | + rateo 13ª + 14ª nella base | idem | ✅ combacia |
| Valorizzazione riposo perso | ora festiva **+20% (×1,20)**, impostazione cautelativa | ×1,20 festivo | ✅ combacia |
| Esclusioni prudenziali | no notturno, no integrazione 50% < orario giornaliero | idem | ✅ combacia |
| Maggiorazioni (schema base 100) | straord 110%, festivo/mancato riposo 120%, notturno +20%, comb. 130%/150% | idem (sez. 2) | ✅ combacia |
| Rivalutazione/interessi | ISTAT FOI + interessi legali "tempo per tempo" | idem, già calcolato | ✅ combacia |

### L'unica sottigliezza da tenere a mente (per il build FSE)
La relazione ricava la tariffa oraria in modo **teorico**: elementi fissi (1610,57) + ratei 13ª/14ª
(134,21+134,21) = 1878,99 ÷ 195 = **9,63** paga oraria → ×1,20 = **11,56** paga ora festivo (2024).

Il **motore** invece non usa questa formula: usa la **tariffa effettiva per anno** ricavata dal PDF
(`deriveTariffePerAnno` = Σ indennità fonte ÷ Σ ore mancanti; per Viterbo ≈ 10,08 nel 2011 → **13,13** nel 2024),
poi × `coefficiente` (0,20 danno / 1,0 pieno). Le due basi **non coincidono** (teorica 11,56 vs effettiva 13,13
per il 2024): è la stessa distinzione già riconciliata il 30/06 (vedi knowledge §3.1 — l'effettiva è quella
corretta, non va sostituita con la paga base teorica).

## Contenuto genuinamente aggiuntivo della relazione
1. **Esempio applicativo completo** (Monteleone, sett. 2024): fine attività sab 07/09 h16:30 → ripresa lun 09/09
   h06:30 ⇒ riposo fruito 38h, **non fruito 7h** ⇒ 11,56 × 7 ≈ **80,94 €** per l'episodio.
2. **Riepilogo economico esempio**: capitale (30/09/2024) 181,15 + interessi 6,06 + rivalutazione 7,31 =
   **194,52 €**.
3. **Conferma soggetto reale**: FSE/Monteleone non è più solo un nome-template (cfr. knowledge nota 4) —
   è il **lavoratore vero** della nuova azienda.
4. Refuso minore nella relazione: paga oraria scritta una volta 9,63 e una 9,62 (immateriale).

## Implicazioni per la futura sessione "azienda FSE"
- **Stesso motore, stessa metodologia**: la pratica FSE riusa `restEngine.ts` e l'area Turni & Riposi così com'è.
  Non serve una logica di calcolo nuova.
- **Serve la tariffa per anno di Monteleone/FSE**: dalle buste in `VITERBO FSE/` (2009–2024). Se contengono le
  indennità mancato-riposo → `deriveTariffePerAnno` come per Viterbo. Se NON le contengono → fallback alla base
  teorica della relazione (paga oraria × 1,20 per anno). **Da decidere quando apriamo FSE.**
- **Profilo azienda**: FSE è "operatore d'esercizio" ferroviario, non TPL bus, ma **stessa famiglia CCNL
  Autoferrotranvieri** → stesso perimetro (Reg. 561/2006 + art.14 CCNL 1997). L'azienda va aggiunta come nuova
  entità della pratica riposi (non come profilo cedolino delle Incidenze).

## Conclusione
Niente da correggere nel codice: la relazione **valida** la metodologia già costruita. È materiale di
riferimento per impostare la pratica FSE/Monteleone nella sessione futura. Il nodo aperto per quel build è uno
solo: **da dove prendere la tariffa oraria di Monteleone** (effettiva dalle buste vs teorica dalla relazione).
