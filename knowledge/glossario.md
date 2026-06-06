# Glossario di dominio

Termini ricorrenti nel progetto. Servono a parlare la stessa lingua di buste, Excel
dell'avvocato e UI del sito (cfr. memory `feedback-ancora-agli-artefatti-reali`: ancorarsi
ai termini che l'utente/avvocato vedono davvero, non a etichette inventate).

- **Credito (differenze su ferie)** — l'oggetto della causa. Il lavoratore, durante le ferie,
  ha percepito solo la retribuzione fissa; le **voci variabili** (indennità legate al lavoro
  effettivo) sono state escluse. Il credito è la differenza che gli spetta.

- **Voci fisse** — voci continuative percepite **sia in lavoro che in ferie** (minimo,
  superminimo, ERI, salario professionale, APA, EDR…). Sul cedolino RFI confluiscono in parte
  nel totale "RETRIBUZIONE MENSILE". Sono il **Quadro B** dell'avvocato. NON generano credito.

- **Voci variabili** — voci percepite **solo nelle giornate di lavoro** (indennità di
  reperibilità, notturno, festivo…). Sono il **Quadro C** dell'avvocato. **Generano il credito.**

- **Quadro A / B / C** — terminologia dell'**Excel dell'avvocato** (caso Palladino): A = B+C
  (denominatore, non il lordo busta), B = fisse, C = variabili. ⚠️ Da usare solo con il loro
  significato; non inventare colonne "A/B/C" diverse.

- **Divisore (della media)** — il numero per cui si divide il totale variabili dell'anno per
  ottenere la tariffa giornaliera. Vedi [`strategia-a-vs-b.md`](strategia-a-vs-b.md).

- **Giornate effettive lavorative** — i giorni realmente lavorati (al netto di ferie, riposi,
  assenze). È il divisore richiesto dal **ricorso depositato** per le variabili (= Strategia A).

- **Assenze retribuite** — giorni non lavorati ma pagati: distacco sindacale, permessi
  retribuiti (art. 23 L. 300/1970). Sul cedolino vanno dette **"assenze retribuite"**, non
  "permessi". Rilevanti per la **Strategia B** (distaccati).

- **Reperibilità / disponibilità** — istituto dell'**art. 79 CCNL Mobilità/AF**: il lavoratore
  è tenuto a essere raggiungibile per eventuali chiamate. Genera indennità (codici 0470/0482/
  0496/0584). Vedi [`ccnl-e-normativa.md`](ccnl-e-normativa.md).

- **% di incidenza** — quanto pesano le variabili sul totale retribuzione (`C×100/(B+C)`).
  Serve in tribunale per argomentare. È **additiva**: NON cambia gli euro del credito.
  Soglia critica **20%** (sotto → l'anno è più attaccabile).

- **Anno di riferimento (N-1)** — il credito di un anno usa la **media dell'anno precedente**.
  Quindi `start_claim_year − 1` deve essere un anno pieno (~12 mesi reali), altrimenti la media
  storica manca (cfr. memory `feedback-anno-riferimento-completo`).

- **Tetto 28 (giorni di ferie)** — cap sui giorni di ferie conteggiati per anno (Cass.
  20216/2022). Lo switch "32 ex-festività" è **disattivato**.

- **Già percepito (coeffPercepito)** — quanto il lavoratore ha **già** ricevuto sulle ferie,
  letto dalla busta, da sottrarre al dovuto. Per RFI si usa il valore **reale** dalla busta,
  non una detrazione fissa.

- **Strategia A / Strategia B** — due modi di costruire il divisore della media; A = giornate
  effettive (default), B = giornate + assenze retribuite (solo distaccati). Vedi
  [`strategia-a-vs-b.md`](strategia-a-vs-b.md).

- **Distacco** — il lavoratore è distaccato (es. sindacale) e ha quasi 0 presenze. Caso dei
  **2 Cataneo** (Vincenzo RFI, Pasquale Trenitalia) → Strategia B.

- **Ticket / buoni pasto** — colonna **standard** fissa per tutti i profili (non una voce
  indennità). Conteggiata come tariffa giornaliera × giorni di ferie.

- **Profilo azienda** — il CCNL/azienda di un lavoratore (RFI, TRENITALIA, ELIOR,
  CLEAN_SERVICE, MERCITALIA). Determina colonne tabella, prompt OCR, set codici.
