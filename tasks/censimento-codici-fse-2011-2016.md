# Censimento codici voce FSE — era scansioni 2010 → giu 2017 (layout fax-simile INAIL / SPA-GUIDA)

> **Scopo:** censire i codici a 2-3 cifre dell'era storica per rispondere al **quesito 2 all'avvocato**
> (le colonne del riepilogo perito 2011-2016 corrispondono a voci stampate?) e preparare l'estensione
> di `PROMPT_FSE` / `INDENNITA_FSE` a quest'era.
> **Metodo:** lettura visiva della tabella voci (colonne Ass|Voce|Descrizione) di **ogni fronte** dei
> 90 cedolini splittati oggi (2010-2016) + i 6 mesi del bundle `Gennaio-Giugno 2017 (scansione).pdf`
> = 96 fronti. Griglie di ritagli a 150 dpi (scratchpad `census.mjs`), code delle tabelle lunghe
> ricontrollate con secondo crop (`tails.mjs`). Nessun OCR AI: solo lettura diretta.
> Data: 10/07/2026. Fonte: cartella Desktop `…/CLARINO FRANCESCO/DOCUMENTI DA ANALIZZARE/Ruoli paga Clarino/`.

## 1. Esito in una riga

Nell'era scansionata le **uniche indennità "di incomodo" stampate** sono: **029 Art. 5A**,
**094 Art. 5/B** (raro), **300/301/303/306/307 Trasferte A1/A2/A4/B1/B2** e **663 Indennità
giornaliera** (= presenza, solo da ott 2012). **Non esiste alcuna voce stampata** per Percorrenze,
Nastri, Guide, Rimorchio, Disponibilità, Riserva, Flessibilità, IndAggiuntiva, Ind. domenicale
aziendale: se il riepilogo del perito valorizza quelle colonne nel 2011-2016, sono **ricostruzioni a
tariffa non stampate** (stesso pattern già dimostrato per il 2017-2020, §4 del
[report riconciliazione](riconciliazione-perito-clarino-2026-07-09.md)).

## 2. Codici candidati al numeratore (mappa proposta verso le colonne del perito)

| Codice | Descrizione cedolino | Freq. (su 82 mensili) | Periodo visto | Mappa proposta |
|---|---|---|---|---|
| **029** | Art. 5A | 81 (manca solo Set 2010) | Ott 2010 → Giu 2017 | **Ind. Turno Art5A Cnnl** (gemella di IX0002 → I85240) |
| **094** | Art. 5/B | 3 | Giu 2011 · Lug 2012 · Giu 2013 | **Ind. Domen.le Art5B Cnnl** (gemella di IX0001 → I85245) |
| **300** | Trasferta A1 24% | 24 | Gen 2011 → Mar 2014 | **Trasferte/Diarie** (gemella di IX0051) |
| **301** | Trasferta A2 9% | 72 | Nov 2010 → Mag 2017 | **Trasferte/Diarie** (gemella di IX0052) |
| **303** | Trasferta A4 13% | 6 | Dic 2010 → Ott 2013 | **Trasferte/Diarie** |
| **306** | Trasferta B1 90% | 10 | Nov 2011 → Set 2016 | **Trasferte/Diarie** (gemella di IX0057) |
| **307** | Trasferta B2 50% | 10 | Giu 2011 → Mag 2014 | **Trasferte/Diarie** (gemella di IX0058) |
| **663** | Indennità' giornaliera | 57 | **Ott 2012** → Giu 2017 | **SOLO contatore GG** (`daysWorked`), MAI importo — gemella di IX0023/I86005/I86178 |

Continuità perfetta con l'era IX (lug 2017+): stessi concetti, descrizioni quasi identiche
("Indenn. giornaliera", "Trasferta A2 9%", "Art. 5A"). Il bundle Gen-Giu 2017 chiude l'era
storica: **da lug 2017 partono i codici IX** (già mappati).

## 3. Codici esclusi dal numeratore (natura non-incomodo)

**Retribuzione base / mensilità:** 011 Totale retribuzione (= Totale Elementi Fissi × base, in
TUTTI gli 82 mensili) · 048 Tredicesima mensilità (solo cedolini 13ª) · 100 Quattordicesima
Mensilità (solo 14ª).

**Straordinari / notturno / festività (il perito li esclude anche nelle ere successive):**
013 Ordinario Notturno (43 mesi) · 014 Straord. Feriale Diurno (40 mesi) · 041 Festività Civ. e
Rel. (12 mesi, quasi sempre giugno) · 766 Regol. Lav. Str. Fer. Diurno (2).

**ANF / famiglia:** 180 Assegno nucleo famil. (~70 mesi) · 181 Rettifica ANF / Arretrati ANF (6).

**Rimborsi spese:** 127 Rimb. Carbur. Mezzi Propri (16) · 130 Rimborsi Debiti Vari (1) ·
132 Rimb.Spese Biglietti Grat. (1) · 133 Rimb.Spese Rinnovo Patente (1) · 384 Rimborso Congedo
A.P. (6).

**Malattia / assenze / sciopero:** 731 Malattia C/INPS (1) · 732 Malattia C/AZ (13) ·
074 Ore Assenze Varie (1) · 071 Ore sciopero (1).

**Fiscale / contributivo / una tantum:** 375 Art.1 DL 66/2014 = bonus 80 € (34 mesi, da mag 2014)
· 901/902/907 addizionali rate · 941/942/959/962 saldi IRPEF/addizionali · 475 Irpef a Tass.
Separ. su Arr. (5) · 174 Restituzione Add.Comunale (1) · 161/170/171 ctr/restituzioni Ente
Bilaterale (3) · 261 Sgrav.Contr. (1) · 452 Regol.Tratt.Priamo + 974 Iscrizione fondo PRIAMO (1) ·
543 Debiti (1) · 707 Regol. Imp. Diarie (1, gen 2016 — tocca l'imponibile delle diarie, non è
un'indennità) · 027 UT a TS CCNL (4) · 028 Arr a TS CCNL (1) — una tantum CCNL.

## 4. Punti strutturali per il prompt OCR dell'era (quando si estenderà)

1. **`daysWorked`:** la voce presenza (663) esiste SOLO da ott 2012. Prima (set 2010 → set 2012)
   l'unica fonte giorni è la **banda "Presenze del mese" di testata**, che in questo layout È
   compilata e affidabile (calendario P/R giorno per giorno + totali Presenze/Riposi/Festivi:
   es. Dic 2010 = 26,00 P + 4,00 R = 30). La regola attuale del PROMPT_FSE ("VIETATO usare la
   banda") è pensata per Zucchetti e va **differenziata per era**.
2. **Ferie:** nessuna voce ferie in tabella (niente F2105-equivalente). La banda ha la colonna
   **"Congedi"** e il calendario marca i giorni: da verificare su un mese con ferie note (agosto)
   che sia la fonte delle "GG Ferie fruite" del perito per il 2011-2016.
3. **Doppia intestazione nell'era:** 2010-2012 = "494 - SPA-GUIDA TA", poi "294 - SPA-GUIDA BARI"
   (sede diversa, stesso layout e stessi codici).
4. **Retro (pagina 2)** = solo tabelle fiscali (Assoggettamento IRPEF): nessun dato utile.
5. Le **13ª/14ª** hanno una sola voce (048/100): restano fuori conteggio come nelle ere successive.

## 5. Risposta al quesito 2 per l'avvocato — VERIFICATA A CAMPIONE (§7)

Le colonne del riepilogo perito trovano riscontro stampato SOLO per: **Turno Art5A** (029),
**Domenicale Art5B** (094), **Diarie** (= trasferte serie A: 300/301/303), **Trasferte**
(= trasferte serie B: 306/307), **GG** (banda Presenze) e **Ferie** (banda Congedi).
**Percorrenze, Nastri, Agente unico, Guide, Rimorchio, IndAggiun, Ind. Aziendale, Flessibilità,
Riserva** non esistono come voci stampate in nessuno degli 82 mensili → per il 2011-2016 sono
ricostruzioni del perito da fonte extra-cedolino; in particolare **"Ind. Aziendale" = 3,50 € × GG
esatto in tutti i campioni** — la stessa ricostruzione sistematica già dimostrata per il 2017-2020
(§4 del report riconciliazione). Sui campioni, il ricostruito pesa ~120-480 €/mese
(Mar 2015: 380,13 € su Toale 392,61 = **97% ricostruito**).

## 6. Prossimi passi (in ordine)

1. ~~Verifica quantitativa a campione~~ **FATTA 10/07** → §7: 8/8 mesi al centesimo.
2. ~~Estensione era storica~~ **FATTA 10/07 (decisione utente: si estrae il PRINTED, subito):**
   +7 colonne in `INDENNITA_FSE` (029, 094, 300, 301, 303, 306, 307), guardia sostituita dal
   blocco §5-ter del PROMPT_FSE (GG = banda Presenze, ferie = banda Congedi, 663 vietato,
   fisse dal box Minimo Tabellare/Contingenza+EDR/A.P.A.+3°El.Sal./T.D.R./Mensa, 13-14 MENS.,
   esclusioni del §3) + esempio few-shot Nov 2011 coi numeri verificati; gemello
   `verify-payslip.ts` allineato. Gate: tsc 0 · vitest 261/261 · build ok.
   Le ricostruzioni del perito NON sono colonne: restano il quesito 2 per l'avvocato.

## 7. Verifica quantitativa a campione — ESITO: 8/8 AL CENTESIMO (10/07)

**Metodo:** riepilogo perito parsato per coordinate (header decodificato: 15 colonne numeratore +
Toale + GG + Ferie + coda rivalutazioni); importi cedolino letti visivamente dai crop full-width
a 150 dpi (scratchpad `sample-grids.mjs`, `dump-riepilogo.mjs`). Campione scelto per coprire:
094 (1 solo dei 3 mesi esistenti), tutte le 5 trasferte, primo mese con 663, mese "nudo" (solo 029),
mese con 17 ferie, mese tardo-era.

| Mese | Voci stampate (importo cedolino) | Colonne perito corrispondenti | Match | Residuo perito NON stampato |
|---|---|---|---|---|
| Giu 2011 | 029=12,48 · 094=5,81 · 301=73,37 · 307=27,18 | Turno5A 12,48 · Art5B 5,81 · Diarie 73,37 · Trasferte 27,18 | ✓✓✓✓ | 325,28 (Percorr+AgUnico+Guide+IndAgg+3,50×24) |
| Nov 2011 | 029=12,48 · 300+301=86,41 · 306+307=76,10 | Turno5A · Diarie · Trasferte | ✓✓✓ | 347,10 |
| Apr 2012 | 029=11,44 · 300+301+303=73,92 · 306+307=222,84 | Turno5A · Diarie · Trasferte | ✓✓✓ | 333,93 |
| Ott 2012 | 029=12,48 · 300+301=97,69 (no serie B) | Turno5A · Diarie (Trasferte vuota ✓) | ✓✓ | 316,29 |
| Feb 2013 | 029=13,52 · 300+301+303=43,59 · 306+307=77,27 | Turno5A · Diarie · Trasferte | ✓✓✓ | 482,71 |
| Set 2013 | 029=4,68 · 306=248,36 | Turno5A · Trasferte | ✓✓ | 118,76 |
| Mar 2015 | 029=12,48 (nessuna trasferta) | Turno5A (Diarie/Trasferte vuote ✓) | ✓ | **380,13 su Toale 392,61** |
| Ott 2016 | 029=11,96 · 301=37,63 | Turno5A · Diarie | ✓✓ | 378,36 |

**Regole inchiodate per l'era (8/8 campioni):**
1. **Diarie = serie A (300 A1 24% + 301 A2 9% + 303 A4 13%) · Trasferte = serie B (306 B1 90% + 307 B2 50%)** — al centesimo.
2. **GG Effettivi Lavoro = banda "Presenze"**, NON la quantità della voce 663: in 3 campioni
   divergono (Ott 2012: 663=25 vs GG 24 · Set 2013: 663=26 vs GG 9 · Ott 2016: 663=26 vs GG 23)
   e il perito segue SEMPRE la banda. (La qty di 663 in quest'era tende al divisore ~26, non alle presenze.)
3. **Ferie Fruite = banda "Congedi"** (2 · 0 · 2 · 1 · 0 · **17** · 0 · 3 — tutti esatti, confermata
   l'ipotesi del §4.2). Nel calendario i giorni ferie sono marcati C.
4. **029 = 0,52 €/g × GG banda** in tutti i campioni (unit 0,52 costante 2010-2016) → la colonna
   Turno5A del perito coincide con la voce stampata (e con 0,52×GG).
5. Esclusioni coerenti con le ere successive: 663 importo (es. 154,08 Mar 2015), 041 festività
   (158,00 Giu 2011 ignorata dal perito), 013/014, 375 bonus, ANF, rimborsi, malattia — mai nel Toale.
6. **"Ind. Aziendale" = 3,50 × GG in 8/8** (84,00/24 · 77,00/22 · 91,00/26 · 31,50/9 · 80,50/23…):
   la ricostruzione parte da gen 2011, non da lug 2017. IndAggiun qui NON segue 1,76×gg-5A
   (valori 1,76 / 3,52 puntuali): formula sua, da chiedere se serve.

⇒ **Conclusione:** la mappa §2 è confermata al centesimo; le colonne ricostruite (Percorrenze,
Nastri, Agente unico, Guide, Rimorchio, IndAggiun, Ind. Aziendale…) sono la parte dominante del
numeratore 2011-2016 del perito e NON sono riproducibili dai cedolini. Con le sole voci stampate
l'app darà un numeratore molto inferiore per il 2011-2016: **è il quesito 2, ora con i numeri.**

---

## Appendice — codici per mese (per riconteggio)

Formato: mese: codici (esclusi 011/901/902/907 e saldi fiscali, presenti quasi ovunque — vedi §3).

- **Set 2010:** 180, 181 · **Ott 2010:** 029, 180 · **Nov 2010:** 013, 014, 029, 180, 301 ·
  **Dic 2010 (entrambe le versioni Nr 0022887/0046860, voci identiche):** 013, 029, 041, 180, 301, 303
- **2011** — Gen: 013, 014, 029, 180, 300, 301 · Feb: 013, 029, 041, 180, 301 · Mar: 013, 029, 180,
  301 · Apr: 013, 029, 180, 300, 301, 732 · Mag: 013, 014, 029, 041, 180, 301, 452, 974 ·
  Giu: 013, 029, 041, 074, 094, 180, 301, 307 · Lug: 013, 029, 041, 132, 301, 962 · Ago: 013, 029,
  130, 301 · Set: 014, 029, 180, 181, 300, 301, 384 · Ott: 013, 029, 180, 301 · Nov: 013, 029, 127,
  180, 300, 301, 306, 307, 732 · Dic: 029, 041, 174, 180, 300, 301
- **2012** — Gen: 013, 014, 029, 127, 180, 300, 301, 306 · Feb: 013, 029, 127, 180, 300, 301, 306,
  384, 731, 732 · Mar: 013, 029, 127, 180, 300, 301, 307 · Apr: 013, 029, 127, 180, 300, 301, 303,
  306, 307, 732 · Mag: 013, 014, 029, 180, 300, 301 · Giu: 013, 029, 041, 180, 300, 301 · Lug: 029,
  094, 300, 301, 962 · Ago: 013, 029, 180, 181, 301 · Set: 013, 014, 029, 180, 301 · Ott: 013, 029,
  180, 300, 301, **663 (prima occorrenza)** · Nov: 013, 029, 180, 301, 663, 732 · Dic: 013, 029,
  180, 301, 663
- **2013** — Gen: 013, 014, 029, 127, 180, 300, 301, 307, 663 · Feb: 013, 029, 127, 180, 300, 301,
  303, 306, 307, 384, 663, 766 · Mar: 013, 014, 029, 127, 180, 300, 301, 306, 384, 663 · Apr: 013,
  014, 029, 071, 180, 300, 303, 663 · Mag: 013, 014, 027, 029, 127, 180, 300, 301, 303, 307, 475,
  663 · Giu: 013, 014, 029, 041, 094, 127, 133, 180, 301, 306, 307, 663 · Lug: 013, 014, 029, 180,
  301, 384, 663, 941, 959 · Ago: 013, 014, 029, 180, 181, 301, 663, 732 · Set: 029, 127, 180, 306,
  663 · Ott: 013, 014, 027, 029, 180, 300, 301, 303, 475, 663, 732 · Nov: 014, 029, 180, 261, 300,
  301, 663 · Dic: 014, 029, 180, 300, 301, 663
- **2014** — Gen: 014, 029, 180, 300, 301, 663 · Feb: 014, 029, 180, 300, 663 · Mar: 014, 029, 180,
  300, 384, 663 · Apr: 014, 029, 127, 180, 301, 307, 543, 663 · Mag: 013, 014, 029, 127, 180, 301,
  306, 307, **375 (prima occorrenza)**, 663 · Giu: 013, 014, 029, 041, 180, 301, 375, 663 ·
  Lug: 013, 014, 029, 301, 375, 663, 732, 941, 962 · Ago: 013, 014, 029, 180, 181, 301, 375, 663 ·
  Set: 029, 180, 301, 375, 663 · Ott: 013, 014, 029, 161, 180, 301, 375, 663 · Nov: 014, 029, 170,
  171, 180, 375, 663 · Dic: 014, 029, 180, 301, 375, 663
- **2015** — Gen: 013, 014, 029, 180, 301, 375, 663 · Feb: 029, 180, 301, 375, 663, 732 · Mar: 013,
  029, 180, 375, 663 · Apr: 014, 029, 180, 301, 375, 663 · Mag: 013, 029, 180, 301, 375, 663 ·
  Giu: 029, 041, 180, 301, 375, 663, 732 · Lug: 029, 301, 375, 663, 942, 962 · Ago: 014, 029, 301,
  375, 663, 732 · Set: 029, 180, 181, 301, 375, 663, 732 · Ott: 014, 029, 180, 301, 375, 663 ·
  Nov: 029, 180, 301, 375, 663 · Dic: 014, 029, 180, 301, 375, 663
- **2016** — Gen: 027, 028, 029, 180, 301, 375, 475, 663, 707, 766 · Feb: 029, 180, 301, 375, 475,
  663 · Mar: 029, 180, 301, 375, 663 · Apr: 027, 029, 180, 301, 375, 475, 663 · Mag: 029, 180, 301,
  375, 663 · Giu: 014, 029, 041, 180, 301, 663 · Lug: 029, 180, 301, 375, 663, 962 · Ago: 013, 029,
  180, 301, 375, 663 · Set: 029, 127, 180, 301, 306, 375, 663 · Ott: 029, 180, 301, 375, 663 ·
  Nov: 029, 180, 301, 375, 663 · Dic: 014, 029, 127, 180, 301, 375, 663
- **2017 (bundle scansione, ordine crescente Gen→Giu)** — Gen: 013, 014, 029, 180, 301, 663 ·
  Feb: 014, 029, 180, 301, 663 · Mar: 014, 029, 127, 180, 375, 663 · Apr: 013, 014, 029, 180, 301,
  375, 663, 732 · Mag: 029, 180, 301, 375, 663 · Giu: 014, 029, 041, 180, 663
- **13ª (2010-2016):** solo 048 · **14ª (2011-2016):** solo 100
