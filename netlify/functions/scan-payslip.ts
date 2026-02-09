import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- IL PULITORE DI JAVASCRIPT (V12) ---
function cleanAndParseJSON(text: string): any {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "");
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Struttura JSON non trovata.");
    }
    return JSON.parse(clean);
  } catch (error) {
    console.error("Errore Raw Text:", text);
    throw new Error(`Errore Formattazione: ${error.message}`);
  }
}

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
    console.log("--- 🦅 AVVIO ANALISI V12 (DEEP SCAN PAGINA 1 & 2) ---");
    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei un Analista Paghe esperto in buste paga RFI multipagina.
      
      ⚠️ ATTENZIONE CRITICA: IL DOCUMENTO HA PIÙ PAGINE.
      La tabella delle competenze inizia nella PRIMA PAGINA e finisce nella SECONDA.
      DEVI LEGGERE ENTRAMBE LE PAGINE.
      Non limitarti a leggere l'ultima pagina. I codici più importanti sono spesso all'inizio.

      ESTRAI I SEGUENTI DATI JSON:

      1. **DATA**: Mese e Anno (es. 5, 2024).
      2. **PRESENZE** (Box in alto Pagina 1):
         - "daysWorked": GG. Lav. / Presenze (es. 21, 22).
         - "daysVacation": Ferie godute.
      
      3. **TICKET RESTAURANT** (Cerca ovunque):
         - "ticketRate": Cerca codici 0E99 (8.00€/7.00€), 0299, 0293.
         - Se trovi solo Welfare/Mensa/Unisalute: metti 0.00.

      4. **ARRETRATI** (Cerca ovunque):
         - "arretrati": Somma codici 3E.. (Malattia), 0K.. (Una Tantum), 74.. (Arretrati).
         - "eventNote": Lista eventi trovati.

      5. **CODICI INDENNITÀ (SCANSIONE COMPLETA)**:
         Cerca e estrai l'importo (Competenze) per TUTTI i seguenti codici.
         Se un codice è a Pagina 1, PRENDILO. Non saltarlo.
         
         *GRUPPO 1 (Spesso a Pagina 1):*
         - 0152 (Str. feriale)
         - 0421 (Turno notturno)
         - 0423 (Festivo)
         - 0457 (Festivo notturno)
         - 0470 (Indennità turno)
         - 0482 (Domenicale)
         - 0AA1 (Mancata mensa)

         *GRUPPO 2 (Spesso a Pagina 1 o 2):*
         - 0496, 0576, 0584, 0687
         - 0919, 0920, 0932, 0933
         - 0995, 0996, 0376, 0686
         - 3B70, 3B71 (Produttività)

      FORMATO JSON:
      {
        "month": 5,
        "year": 2024,
        "daysWorked": 0,
        "daysVacation": 0,
        "ticketRate": 0.00,
        "arretrati": 0.00,
        "eventNote": "",
        "codes": {
           "0152": 0.00,
           "0421": 0.00,
           ... (inserisci qui i codici trovati)
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
    const finalJson = cleanAndParseJSON(response.text());

    console.log("✅ Dati V12:", JSON.stringify(finalJson).substring(0, 100) + "...");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(finalJson),
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