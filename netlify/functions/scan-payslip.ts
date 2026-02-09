import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const handler: Handler = async (event, context) => {
  // Headers CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    console.log("--- 💎 AVVIO SCANSIONE PRECISIONE MASSIMA (No Netto / Si Ticket) ---");
    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // Usiamo Flash con configurazione JSON forzata per evitare crash
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei un Analista Paghe Senior per Ferrovie dello Stato (RFI).
      Analizza il documento ed estrai i dati con precisione chirurgica.

      ⚠️ ISTRUZIONI CRITICHE ANTI-ALLUCINAZIONE:
      1. Non inventare dati. Se un campo è illeggibile, restituisci 0 o null.
      2. Ignora intestazioni, piè di pagina promozionali o note generiche.
      3. Ignora il "Netto a pagare". Non ci serve.

      🔍 DOVE CERCARE I DATI:

      A. [HEADER/BOX PRESENZE] (Di solito in alto o centro-alto):
         - "daysWorked": Cerca "GG. Lav.", "Lavorati", "Presenze" o il codice "P". 
           ATTENZIONE: Se trovi "26" (teorico) e "22" (effettivo), prendi l'EFFETTIVO.
         - "daysVacation": Cerca "Ferie Godute", "Ferie A.C.", o codice "F". SOLO quelle godute nel mese.

      B. [CORPO CENTRALE] (Voci variabili):
         - "ticketRate": Cerca l'importo unitario del Buono Pasto/Mensa. Cerca "Valore Ticket", "Aliq. Ticket", "Mensa". 
           Esempio: Se vedi "Ticket ... 7,00", estrai 7.00.
         - "codes": Cerca ESATTAMENTE i codici voce elencati sotto nella colonna COMPETENZE (Importo).
           Ignora colonne "Ore", "Quantità", "Trattenute".

      📋 LISTA CODICI DA ESTRARRE (Solo valori positivi in Euro):
      [0152], [0421], [0470], [0482], [0496], [0687], [0AA1], [0423], [0576], 
      [0584], [0919], [0920], [0932], [0933], [0995], [0996], [0376], [0686]

      FORMATO JSON OBBLIGATORIO:
      {
        "month": (Numero 1-12),
        "year": (Numero 2024...),
        "daysWorked": (Numero o 0),
        "daysVacation": (Numero o 0),
        "ticketRate": (Numero o 0, es. 7.00),
        "codes": {
           "0152": 0.00,
           ... (altri codici trovati)
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
    let text = response.text();

    // 🧹 Pulizia JSON Estrema per evitare crash
    // Cerca la prima parentesi graffa e l'ultima
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Gemini non ha prodotto un JSON valido.");
    }

    console.log("✅ Dati Estratti:", text.substring(0, 100) + "...");

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