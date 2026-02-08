import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    console.log("--- 🚄 AVVIO SCANSIONE RFI (Targeted Extraction) ---");
    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    // Pulizia Header Base64
    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // Usiamo Flash (Veloce e Stabile)
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    // --- PROMPT CHIRURGICO PER I TUOI CODICI ---
    const prompt = `
      Sei un esperto paghe RFI (Ferrovie). Analizza il testo grezzo di questa busta paga.
      Il testo potrebbe apparire disordinato o simile a un CSV (es: "Codice","Descrizione",...,"Importo").

      OBIETTIVO:
      Estrarre i valori monetari (COMPETENZE) per una lista specifica di codici voce e i dati di presenza.

      1. DATI TEMPORALI:
         - "month": Estrai il mese come NUMERO (1-12). Es: "Febbraio" -> 2.
         - "year": L'anno di riferimento (es. 2024).

      2. DATI PRESENZE (Cerca nel box in alto "Presenze"):
         - "daysWorked": Giorni lavorati/presenze (spesso colonna P o Lavorati).
         - "daysVacation": Giorni di ferie GODUTE nel mese corrente (NON il residuo anno precedente).

      3. VOCI VARIABILI (Il cuore dell'analisi):
         Cerca nella tabella centrale "Dettaglio Voci".
         Devi trovare l'importo nella colonna **COMPETENZE** (Euro) per i seguenti codici ESATTI.
         
         ⚠️ ATTENZIONE: Ignora colonne "Ore", "Quantità" o "Trattenute". Prendi solo l'importo positivo.
         
         LISTA CODICI DA CERCARE:
         - 0152 (Str. Feriale Diurno)
         - 0421 (Ind. Notturno)
         - 0470 (Ind. Chiamata Rep)
         - 0482 (Compenso Rep)
         - 0496 (Ind. Disp)
         - 0687 (Ind. Linea <=10h)
         - 0AA1 (Trasferta)
         - 0423 (Cantiere Notte)
         - 0576 (Orario Spezzato)
         - 0584 (Rep. Festive)
         - 0919 (Str. Feriale)
         - 0920 (Str. Fest/Nott)
         - 0932 (Str. Rep Diurno)
         - 0933 (Str. Rep Fest/Nott)
         - 0995 (Str. Disp Diurno)
         - 0996 (Str. Disp Fest/Nott)
         - 0376 (Ind. Turno A)
         - 0686 (Ind. Linea >10h)

      4. NETTO:
         - "netto": Il netto a pagare finale.

      Restituisci ESCLUSIVAMENTE questo JSON:
      {
        "month": 2,
        "year": 2024,
        "daysWorked": 0,
        "daysVacation": 0,
        "netto": 0.00,
        "codes": {
           "0152": 0.00,
           "0687": 0.00
           ... inserisci solo i codici trovati ...
        }
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanData,
          mimeType: mimeType || "application/pdf",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("✅ Dati estratti:", text.substring(0, 150));

    return {
      statusCode: 200,
      headers,
      body: text,
    };

  } catch (error: any) {
    console.error("❌ ERRORE:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};