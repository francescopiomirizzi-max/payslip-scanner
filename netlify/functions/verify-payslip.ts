import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_VERIFIER || process.env.GOOGLE_API_KEY || "");

// Modello Gemini centralizzato: override con la env var GEMINI_MODEL (default gemini-3.5-flash).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Cap al thinking del modello (vedi scan-payslip.ts per il razionale). Override via env.
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET) || 1024;

// Builds a context-aware verification prompt based on the company/profile
function buildVerifyPrompt(company: string, eliorType?: string, customColumns?: Array<{ id: string; label: string }>): string {
  const co = (company || "").toUpperCase();

  // ── BLOCCO REGOLE AZIENDALI ────────────────────────────────────────────────
  let companyRules: string;

  if (co === "ELIOR") {
    const ticketRule = eliorType === "magazzino"
      ? 'Cerca codice 0293 → colonna "Valore Unitario" o "Base/Dato". IGNORA la colonna Quantità e i totali.'
      : 'Cerca codice 2000 o 2001 → colonna "Valore Unitario" o "Base/Dato". IGNORA la colonna Quantità e i totali.';

    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — ELIOR ${eliorType ? `(${eliorType.toUpperCase()})` : ""}

**daysWorked — CAMPO CALCOLATO, NON VISIBILE SUL PDF:**
Il valore "daysWorked" NON è stampato esplicitamente sul cedolino ELIOR.
Viene calcolato matematicamente: daysWorked = [GG INPS] − [daysVacation].
NON cercare "giorni lavorati" come testo nel PDF — non esiste come voce autonoma.
Per verificarlo leggi:
  1. Il valore "GG INPS" dal riquadro in alto a sinistra (tipicamente 26).
  2. Il valore finale di daysVacation (già calcolato secondo la regola sotto).
  3. Verifica: daysWorked_estratto ≈ GG_INPS − daysVacation_calcolato (tolleranza ≤ 0.50).

**daysVacation — Conversione Ore/Giorni (Codice 5000):**
- Cerca la riga "5000 FERIE GODUTE" nella colonna ORE/GG/MESI.
- Se il valore letto è > 12: sono ORE → dividi per 8 e arrotonda a 2 decimali.
  Esempio: 19.20 ore → 19.20 / 8 = 2.40 giorni.
- Se il valore è ≤ 12: sono già giorni → usali direttamente.
- Se la riga 5000 è assente: daysVacation = 0.0 è corretto, non è una discrepanza.

**ticket:**
${ticketRule}

**Arretrati:** Somma voci "Arretrati", "Una Tantum", "Conguagli" nella colonna Competenze/Importo.
`;

  } else if (co === "RFI" || co === "TRENITALIA") {
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — ${co} (struttura SAP/Zucchetti ferroviaria)

**daysWorked — RIPOSI ≠ GIORNI LAVORATI (CRITICO, leggi due volte):**
La tabella presenze ha 10 colonne in quest'ordine ESATTO:
"Presenze | Riposi | Ferie | 26mi PTV | Malattie | Infortuni | Assenze retribuite | Assenze non retribuite | Ferie anno prec. | Ferie anno corrente".
daysWorked corrisponde SOLO al numero fisicamente incolonnato sotto la 1ª colonna "Presenze".
Il numero sotto la 2ª colonna "Riposi" (riposi settimanali) NON è daysWorked: MAI.

⚠️ FALSO POSITIVO #1 DA NON COMMETTERE: segnalare un errore su daysWorked perché hai
scambiato i RIPOSI per i giorni lavorati. Prima di segnalare daysWorked, fermati e rileggi.
- daysWorked = 0 NON è un "valore mancante": per i cedolini ferroviari è normalissimo
  (mese di sole ferie/permessi, sfasamento). La regola generale "valore mancante" NON si
  applica a daysWorked.
- I RIPOSI ci sono SEMPRE per un full-time (tipicamente 4-13, mai 0). Se nel JSON
  daysWorked = 0 e nella riga presenze del PDF vedi un numero piccolo (≈4-13), quel numero
  è RIPOSI, non Presenze: daysWorked = 0 è CORRETTO → NON segnalare alcuna discrepanza.
- È VIETATO proporre come "suggested" di daysWorked il numero dei Riposi, delle Malattie,
  degli Infortuni o delle ferie anno prec./corrente.

QUANDO segnalare davvero una discrepanza su daysWorked:
- SOLO se vedi con CERTEZZA ASSOLUTA un numero incolonnato ESATTAMENTE sotto "Presenze"
  (1ª colonna) diverso dal valore estratto. In caso di minimo dubbio, il valore estratto
  è corretto: NON segnalare.
- Caso opposto — CONTROLLO GEOMETRICO DELLA CELLA "PRESENZE": osserva il primo riquadro a
  sinistra della riga presenze, il rettangolo delimitato dal bordo esterno della tabella e
  dalla prima linea verticale divisoria, sotto la parola "Presenze". Se QUEL rettangolo è
  privo di cifre stampate, la cella è vuota: i giorni lavorati sono 0 e il primo numero
  visibile della riga è già la colonna "Riposi". Se daysWorked estratto è > 0 ma quella
  cella risulta vuota → l'estrazione ha sbagliato: DISCREPANZA con suggested = 0.
- Quadratura di controllo: Presenze + Riposi + Ferie + 26mi PTV + Malattie + Infortuni +
  Assenze ≈ giorni del mese. Se per far quadrare la somma i RIPOSI risultassero 0, la tua
  lettura è sbagliata.

**daysVacation — DIVIETO SCIVOLAMENTO COLONNE:**
- Leggi SOLO la colonna sotto "Ferie" (la 3ª intestazione).
- I valori sotto "Riposi" (spesso 4-13) NON sono ferie: non assegnarli a daysVacation.
- Se la colonna risulta vuota o fusa → daysVacation = 0 è CORRETTO.

**daysPaidLeave — Assenze retribuite (campo INFORMATIVO):**
- Leggi SOLO la colonna sotto l'intestazione "Assenze retribuite" (7ª colonna della tabella
  presenze, dopo "Infortuni" e prima di "Assenze non retribuite"). Sono permessi e distacco
  sindacale, congedi e simili assenze comunque pagate.
- Se la colonna è vuota → daysPaidLeave = 0 è CORRETTO.
- È un dato puramente informativo: NON entra nel divisore. Verifica solo che il valore
  estratto coincida con quello incolonnato sul PDF, esattamente come per daysVacation.

**Sfasamento Temporale Ferroviario:**
Nel settore ferroviario (RFI/Trenitalia) le indennità sono pagate il mese successivo alla maturazione.
È NORMALE e CORRETTO che daysWorked = 0 con importi di indennità > 0.
In questo caso NON segnalare discrepanza su daysWorked.

**ticket:** Codici 0E99 / 0299 / 0293 → colonna "Aliquota". IGNORA la colonna "Parametro".

**Arretrati (Ferroviario):** Somma SOLO gli importi positivi in colonna Competenze per:
3E10, 3E16, Indennità INPS, codici che iniziano per 0K, 74.., 6INT, 3105. IGNORA la colonna Trattenute.
`;

  } else if (co === "CLEAN_SERVICE") {
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — CLEAN SERVICE SRL (CCNL Multiservizi)

**Asterischi nei codici:** Le voci possono essere stampate con asterischi accanto al codice (es. "8037 * *", "** 565", "311*"). Estrai SOLO la parte numerica del codice. Gli asterischi sono marker di stampa, NON sono una discrepanza.

**Multi-pagina ("** SEGUE **"):** Se in fondo a una pagina compare "** SEGUE **" (o varianti "SEGUE", "** segue **"), la busta paga continua nelle pagine successive. I codici che si ripetono tra pagine vanno SOMMATI. Non considerare discrepanza un importo che è la somma di più occorrenze sparse.

**daysWorked:** Cerca "Presenze", "Giorni Lavorati" o "GG INPS" nel riquadro anagrafica/riepilogo in alto.
**daysVacation:** Cerca "Ferie godute", "Ferie", o codice 5000 ("FERIE GODUTE"). Se il valore è > 12 sono ORE → dividi per 8 (es. 11.37 → 1.42). Se ≤ 12 sono già giorni.

**ticket:** Codice 311 (descrizione "TICKET") → colonna "Valore Unitario" o "Base/Aliquota". IGNORA la colonna Quantità e i totali. Il codice 311 NON deve comparire nella mappa "codes" (è gestito solo come "ticketRate", come per RFI/Elior).

**Arretrati (CLEAN SERVICE):** Somma SOLO importi positivi delle voci la cui DESCRIZIONE contiene "UNA TANTUM", "ARRETRATI", "CONGUAGLIO", "ARR." (case-insensitive). Queste voci NON devono comparire in "codes" anche se il loro codice numerico coincide con uno dei codici Clean Service (la descrizione testuale prevale sul codice). Se segnali una discrepanza su un codice "codes.NNNN", verifica prima che la voce nel PDF non sia in realtà un UNA TANTUM/ARRETRATO.
`;

  } else if (co === "MERCITALIA") {
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — MERCITALIA (struttura gestionale ADP)

**MARCATORI DEL FRAMEWORK ADP:**
Questo cedolino NON usa il layout SAP/Zucchetti di RFI/Trenitalia. NON cercare la tabella
"Presenze | Riposi | Ferie | 26mi PTV" — non esiste su ADP.
Valida che il documento sia ADP verificando la presenza dei riquadri intitolati
"Informazioni Aziendali", "Informazioni Previdenziali", "Informazioni Fiscali" e
"Informazioni TFR" (tipicamente a fondo pagina / pagina 2). La tabella centrale delle voci
ha 7 colonne: "Cod. Voce | Descrizione | Valori | Numero o base di calcolo | Compenso unitario o % | Competenze | Trattenute".

**daysWorked — CAMPO CALCOLATO, non stampato esplicitamente:**
daysWorked = [GIORNI INPS] − [daysVacation]. "GIORNI INPS" (riquadro "Informazioni
Previdenziali", pagina 2, tipicamente 26; in alternativa colonna "Numero o base di
calcolo" del codice 1213 RETRIBUZ.ORDINARIA) INCLUDE le ferie: i giorni di ferie godute
vanno SOTTRATTI. Verifica: daysWorked_estratto ≈ GIORNI INPS − daysVacation (tolleranza
≤ 0.50). Es.: GIORNI INPS 26 e ferie 7 → daysWorked corretto = 19; se l'estratto resta
26 in presenza di ferie → discrepanza.

**daysVacation:** codice 3833 (FERIE GODUTE), colonna "Numero o base di calcolo". Il codice
3833 può comparire su PIÙ righe: conta SOLO le righe con valore POSITIVO nella colonna
"Valori". Una riga 3833 con valore NEGATIVO (es. "-8,00") è uno STORNO di periodi precedenti
e NON va sommata a daysVacation (va isolata nella nota del mese, non è una discrepanza).
NON usare il codice 1639 (FERIE ANNUALI = quota annua) né i contatori progressivi
"Maturati/Goduti/Saldo" della tabella ferie di pagina 2. Se il 3833 è assente → daysVacation = 0.

**ticket:** codici 3994 (VAL.CONV.TICKETS E) / 4001 (VAL.TICKETS E). Su MERCITALIA i ticket
NON hanno una colonna dedicata: compaiono solo come testo nella nota del mese
("Erogati N ticket restaurant da X€"). Non segnalare discrepanze sul ticket come colonna.

**Codici indennità (sotto-oggetto "codes"):** l'importo in euro si legge nella colonna
"Competenze" (6ª colonna), NON nella colonna "Valori" e NON in "Numero o base di calcolo".
I codici 1723, 1733, 2469, 2501, 2502, 2512 (13ma/14ma, Una Tantum, Welfare) NON sono
indennità ordinarie: sono confluiti in "arretrati". Non segnalarli come discrepanza su "codes".

**Arretrati:** somma degli importi positivi (colonna "Competenze") di 1723, 1733, 2469, 2501, 2502, 2512.
`;

  } else {
    // Custom / generico
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — ${co || "AZIENDA GENERICA"}
Applica le regole standard di lettura dei cedolini italiani.
- daysWorked: leggi "GG lavorati" o "Presenze" dal riquadro in alto.
- daysVacation: leggi "Ferie godute" dal riquadro presenze o dalla riga specifica.
- ticket: colonna "Valore Unitario" del buono pasto.
- codici indennità: l'importo in euro è nella colonna competenze/importi.
`;
  }

  // ── REGOLA GLOBALE TFR ─────────────────────────────────────────────────────
  const tfrRule = `
### REGOLA GLOBALE TFR (CRITICA)
Il campo "imponibile_tfr_mensile" DEVE essere 0.0 da Gennaio (mese 1) a Novembre (mese 11).
- Se nel JSON "monthIndex" è compreso tra 0 e 10 (cioè mese 1-11) e il valore estratto è 0.0 → CORRETTO, non segnalare.
- Se il mese è ≤ 11 e il valore estratto è > 0 → segnala discrepanza (valore suggerito: 0.0).
- Verifica il riquadro TFR SOLO se "monthIndex" = 11 (Dicembre, mese 12) o il PDF contiene "Cessazione"/"Fine Rapporto".
- Quando verifichi il TFR di dicembre, estrai ESCLUSIVAMENTE il valore della riga "Imponibile" (cifra alta, 15.000-40.000€).
  NON usare la riga "Accantonamento" o "Quota mensile" (molto più bassa, ~1.500-2.000€).
`;

  // ── CHECKLIST CODICI INDENNITÀ (per la verifica esaustiva) ─────────────────
  const codeChecklist = customColumns && customColumns.length > 0
    ? customColumns.map(c => `${c.id} (${c.label})`).join(", ")
    : "";

  // ── SEZIONE COMUNE ─────────────────────────────────────────────────────────
  const commonSection = `
### METODO DI VERIFICA — ESAUSTIVO E SCETTICO
Verifica OGNI campo del JSON estratto confrontandolo col PDF, UNO PER UNO.
Un valore è "corretto" solo DOPO che l'hai trovato e confrontato sul PDF. Non saltare nulla.

### REGOLE DI CONFRONTO NUMERICO
- Importo monetario: CORRETTO se la differenza assoluta col PDF è < 0.50€.
- Valore in giorni: CORRETTO se la differenza assoluta è ≤ 0.50.
- IGNORA esclusivamente i metadati: "aiWarning", "eventNote", "note", "isCUD", "company", "month", "year", "monthIndex", "id".

### ‼️ VALORE MANCANTE — l'errore PIÙ IMPORTANTE da intercettare
Per i CAMPI STANDARD e per i CODICI DELLA CHECKLIST (entrambi elencati sotto): se nel JSON
estratto valgono 0.0 o non compaiono, MA nel PDF quella voce ESISTE con un importo > 0 → è una
DISCREPANZA ("suggested" = importo letto dal PDF). Uno 0.0 è corretto SOLO dopo aver verificato
sul PDF che la voce è davvero assente.
⚠️ AMBITO RISTRETTO — questo controllo si applica ESCLUSIVAMENTE ai campi standard e ai codici
della checklist. Il cedolino contiene molte ALTRE voci (trattenute, addizionali IRPEF, quote
sindacali/associative, recuperi anticipi, arrotondamenti, mutui, ecc.): NON sono di competenza
di questa verifica — IGNORALE del tutto, non sono né errori né "valori mancanti".
⚠️ ECCEZIONE CONTEGGI GIORNI — i campi "daysWorked", "daysVacation", "daysPaidLeave" possono
valere LEGITTIMAMENTE 0: uno 0 su questi campi NON è di per sé un "valore mancante". Vale
SOLO la regola aziendale specifica sopra. In particolare daysWorked = 0 è normale e corretto
per i cedolini ferroviari; non segnalarlo scambiando i RIPOSI per i giorni lavorati.

### CHECKLIST CODICI INDENNITÀ (verifica obbligatoria, voce per voce)
${codeChecklist
  ? `Questa azienda prevede SOLO questi codici indennità: ${codeChecklist}.
‼️ Verifica ESCLUSIVAMENTE i codici di questa lista. Qualunque ALTRO codice presente sul
cedolino (trattenute, addizionali, quote sindacali, recuperi, ecc.) è FUORI AMBITO: ignoralo.
Per OGNUNO dei codici della lista:
  1. cercalo nel PDF, in tutte le pagine;
  2. se è PRESENTE nel PDF con un importo → leggi l'importo dalla colonna delle COMPETENZE
     (l'importo in euro effettivamente pagato; MAI dalla colonna "Trattenute", né da
     quantità/ore/parametri/aliquote) e confrontalo col valore in "codes" del JSON.
     Se in "codes" il codice manca o è 0.0 → DISCREPANZA (valore mancante);
  3. se è ASSENTE dal PDF → è corretto che nel JSON sia 0.0 o non compaia.
Un codice della lista non presente nel JSON "codes" va trattato come estratto = 0.0.`
  : `Per ogni codice nel sotto-oggetto "codes" cercalo nel PDF e confronta l'importo della colonna Competenze.`}

### MAPPATURA CAMPI STANDARD
- "daysWorked" / "daysVacation" / "daysPaidLeave" / "ticket" / "arretrati" → vedi regole aziendali sopra.
  Nota: "daysPaidLeave" esiste solo per i profili ferroviari (RFI/Trenitalia); se non compare nei dati estratti, ignoralo.
- "imponibile_tfr_mensile" → vedi Regola Globale TFR.
- "fondo_pregresso_31_12" → riquadro TFR, la riga del TFR maturato al 31/12 dell'anno precedente
  (es. "TFR 31/12 A.P." / "TFR al 31.12 A.P."). Spesso VUOTA per chi è assunto nell'anno → 0.0 è
  CORRETTO. NON confonderla con altre righe del riquadro TFR (es. "RETR.UTILE TFR", imponibili o
  quote progressive): se la riga A.P. è vuota, fondo_pregresso_31_12 = 0.0 e non va segnalata discrepanza.

### REGOLE PER STATUS
- "success": NESSUNA discrepanza — ogni valore e ogni codice della checklist coincide col PDF.
- "warning": solo 1-2 micro-scostamenti border-line (< 2€), nessun valore mancante.
- "error": almeno un VALORE MANCANTE, oppure una discrepanza ≥ 2€, oppure daysWorked errato, oppure più di 2 discrepanze.

### STRUTTURA DI OGNI DISCREPANZA (oggetto JSON, NON stringa libera)
{
  "field": "nome_campo_o_codice",
  "extracted": <numero_estratto_o_0>,
  "suggested": <numero_corretto_letto_dal_PDF>,
  "message": "stringa leggibile in italiano, concisa"
}

Esempi corretti:
{ "field": "1801", "extracted": 0, "suggested": 57.60, "message": "Cod. 1801: non estratto, ma nel PDF vale 57,60€ (valore mancante)" }
{ "field": "daysWorked", "extracted": 26, "suggested": 19, "message": "daysWorked: estratto 26, ma con 7 giorni di ferie il valore corretto è 26−7=19" }
{ "field": "imponibile_tfr_mensile", "extracted": 1850.0, "suggested": 0.0, "message": "imponibile_tfr_mensile: il mese non è Dicembre, deve essere 0.0" }

### OUTPUT (JSON puro, ZERO markdown, ZERO testo extra)
{
  "status": "success" | "warning" | "error",
  "discrepancies": []
}
`;

  return `Sei un Revisore Contabile PIGNOLO e SCETTICO, specializzato in buste paga italiane.
Azienda: ${co || "NON SPECIFICATA"}

Il tuo obiettivo PRIMARIO è SCOVARE errori e OMISSIONI nei dati estratti — soprattutto i
VALORI MANCANTI (voci presenti sul PDF ma non estratte, o estratte a 0). Dai per corretto un
dato SOLO dopo averlo confrontato voce per voce col PDF; nel dubbio, segnalalo.
Applica le regole di calcolo specifiche dell'azienda. Ragiona su formule e regole, non su un
confronto testo-testo superficiale.

Ti vengono forniti:
1. Il PDF originale della busta paga
2. Un JSON con i valori già estratti
${companyRules}
${tfrRule}
${commonSection}`;
}

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

  try {
    const { pdfUrl, monthData, company, eliorType, customColumns } = JSON.parse(event.body || "{}");
    if (!pdfUrl || !monthData) throw new Error("pdfUrl e monthData sono obbligatori");

    // 1. Fetch the file from the signed URL (may be PDF or JPEG from phone camera)
    const fileResponse = await fetch(pdfUrl);
    if (!fileResponse.ok) throw new Error(`Impossibile recuperare il file: ${fileResponse.status} ${fileResponse.statusText}`);
    const fileBuffer = await fileResponse.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString("base64");

    // Detect MIME type from response headers; fall back to PDF for legacy uploads
    const contentType = fileResponse.headers.get("content-type") || "application/pdf";
    const SUPPORTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const fileMimeType = SUPPORTED_MIME_TYPES.find(t => contentType.includes(t)) ?? "application/pdf";

    // 2. Build context-aware prompt
    const prompt = buildVerifyPrompt(company || "RFI", eliorType, customColumns);
    const monthSummary = JSON.stringify(monthData, null, 2);
    const fullPrompt = `${prompt}\n\n### DATI ESTRATTI DA VERIFICARE\n${monthSummary}`;

    // 3. Call Gemini — timeout esplicito così la Function non viene uccisa di colpo dal
    // suo limite di esecuzione. Budget ~50s in produzione (netlify.toml timeout=60) e ~26s
    // in locale (`netlify dev` gira con lambda-local a 30s). Override con AI_BUDGET_MS.
    const isLocalDev = process.env.NETLIFY_DEV === "true";
    const aiBudgetMs = Number(process.env.AI_BUDGET_MS) || (isLocalDev ? 26000 : 50000);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.0, thinkingConfig: { thinkingBudget: THINKING_BUDGET } } as any,
    });

    const result = await model.generateContent(
      [
        fullPrompt,
        { inlineData: { data: fileBase64, mimeType: fileMimeType } },
      ],
      { timeout: aiBudgetMs }
    );

    const raw = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed: { status: string; discrepancies: any[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Risposta AI non valida: " + raw.slice(0, 200));
    }

    const status = ["success", "warning", "error"].includes(parsed.status)
      ? (parsed.status as "success" | "warning" | "error")
      : "warning";

    const discrepancies = Array.isArray(parsed.discrepancies)
      ? parsed.discrepancies
          .filter((d: any) => d && typeof d === "object" && typeof d.field === "string")
          .map((d: any) => ({
            field: String(d.field),
            extracted: Number(d.extracted ?? 0),
            suggested: Number(d.suggested ?? 0),
            message: typeof d.message === "string"
              ? d.message
              : `${d.field}: estratto ${d.extracted}, suggerito ${d.suggested}`,
          }))
      : [];

    console.log(`✅ verify-payslip [${(company || "RFI").toUpperCase()}]: status=${status}, discrepancies=${discrepancies.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status, discrepancies }),
    };
  } catch (error: any) {
    console.error("❌ verify-payslip error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
