import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_VERIFIER || process.env.GOOGLE_API_KEY || "");

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

  } else if (co === "RFI") {
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — RFI

**daysWorked — REGOLA DELL'INCOLONNAMENTO RIGIDO (CRITICA):**
La tabella presenze in alto ha questa intestazione esatta:
"Presenze | Riposi | Ferie | 26mi PTV | Malattie | Infortuni | ... | Ferie anno prec. | Ferie anno corrente"
- daysWorked = valore ESATTAMENTE sotto la colonna "Presenze" (prima colonna a sinistra).
- Se "Presenze" è vuota o assente → daysWorked = 0 è CORRETTO. NON spostarti a destra.
- VIETATO usare i valori sotto "Malattie" o "Infortuni" come giorni lavorati.
- VIETATO usare valori numerici delle ultime colonne (Ferie anno prec./corrente).

**daysVacation — DIVIETO SCIVOLAMENTO COLONNE:**
- Leggi SOLO la colonna sotto "Ferie" (la terza intestazione).
- I valori sotto "Riposi" (spesso 8-12) NON sono ferie: non assegnarli a daysVacation.
- Se la colonna risulta vuota o fusa → daysVacation = 0 è CORRETTO.

**Sfasamento Temporale RFI:**
In RFI le indennità sono pagate il mese successivo alla maturazione.
È NORMALE e CORRETTO che daysWorked = 0 con importi di indennità > 0.
In questo caso NON segnalare discrepanza su daysWorked.

**ticket:** Codici 0E99 / 0299 / 0293 → colonna "Aliquota". IGNORA la colonna "Parametro".

**Arretrati (RFI):** Somma SOLO gli importi positivi in colonna Competenze per:
3E10, 3E16, Indennità INPS, codici che iniziano per 0K, 74.., 6INT, 3105. IGNORA la colonna Trattenute.
`;

  } else {
    // Custom / generico
    const codeList = customColumns && customColumns.length > 0
      ? `\nCodici indennità attivi per questa azienda: ${customColumns.map(c => `${c.id} (${c.label})`).join(", ")}.`
      : "";
    companyRules = `
### REGOLE DI CALCOLO AZIENDALI — ${co || "AZIENDA GENERICA"}
Applica le regole standard di lettura dei cedolini italiani.${codeList}
- daysWorked: leggi "GG lavorati" o "Presenze" dal riquadro in alto.
- daysVacation: leggi "Ferie godute" dal riquadro presenze o dalla riga specifica.
- ticket: colonna "Valore Unitario" del buono pasto.
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

  // ── SEZIONE COMUNE ─────────────────────────────────────────────────────────
  const commonSection = `
### REGOLE DI CONFRONTO NUMERICO
- Considera CORRETTO un importo monetario se la differenza assoluta è < 0.50€
- Considera CORRETTO un valore in giorni se la differenza assoluta è ≤ 0.50
- IGNORA i campi con valore 0 o 0.0 — niente da verificare
- IGNORA i metadati: "aiWarning", "eventNote", "isCUD", "company", "month", "year", "monthIndex", "id"
- Per i codici indennità nel sotto-oggetto "codes" (es. "0421", "1130"), cerca il codice nel PDF
  e confronta l'importo nella colonna "Competenze". Se il codice non è presente nel PDF → il valore 0.0 è CORRETTO.

### MAPPATURA CAMPI STANDARD
- "daysWorked" → vedi regole aziendali sopra
- "daysVacation" → vedi regole aziendali sopra
- "ticket" → valore unitario del buono pasto (NON la quantità, NON il totale)
- "arretrati" → vedi regole aziendali sopra
- "imponibile_tfr_mensile" → vedi Regola Globale TFR
- "fondo_pregresso_31_12" → riquadro TFR → riga "TFR al 31.12 A.P."

### REGOLE PER STATUS
- "success": zero discrepanze → tutti i valori verificati coincidono con il PDF applicando le regole aziendali
- "warning": 1-2 piccole incongruenze (differenza < 2€) o un valore non era chiaramente leggibile
- "error": almeno una discrepanza ≥ 2€, oppure daysWorked matematicamente errato, oppure più di 2 discrepanze

### STRUTTURA DI OGNI DISCREPANZA (oggetto JSON, NON stringa libera)
{
  "field": "nome_campo_o_codice",   // es. "daysWorked", "0421", "ticket"
  "extracted": <numero_estratto>,   // dal JSON fornito
  "suggested": <numero_corretto>,   // letto/calcolato dal PDF
  "message": "stringa leggibile in italiano, concisa"
}

Esempi corretti:
{ "field": "0421", "extracted": 576.06, "suggested": 580.12, "message": "Cod. 0421: estratto 576.06€, nel PDF è 580.12€ (+4.06€)" }
{ "field": "daysWorked", "extracted": 18, "suggested": 20, "message": "daysWorked: estratto 18, calcolato dal PDF (GG INPS 26 − ferie 6) = 20" }
{ "field": "imponibile_tfr_mensile", "extracted": 1850.0, "suggested": 0.0, "message": "imponibile_tfr_mensile: il mese non è Dicembre, deve essere 0.0" }

### OUTPUT (JSON puro, ZERO markdown, ZERO testo extra)
{
  "status": "success" | "warning" | "error",
  "discrepancies": []
}
`;

  return `Sei un Revisore Contabile specializzato in buste paga italiane.
Azienda: ${co || "NON SPECIFICATA"}

Il tuo compito è verificare la CORRETTEZZA MATEMATICA e LOGICA dei dati estratti, applicando le regole di calcolo specifiche dell'azienda riportate sotto.
NON fare un semplice confronto visivo testo-testo: ragiona sulle formule e sulle regole di estrazione.

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

    // 3. Call Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.0 },
    });

    const result = await model.generateContent([
      fullPrompt,
      { inlineData: { data: fileBase64, mimeType: fileMimeType } },
    ]);

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
