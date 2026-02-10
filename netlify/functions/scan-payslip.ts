import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- IL PULITORE DI JAVASCRIPT (V14 - Anti-Errore) ---
function cleanAndParseJSON(text: string): any {
  try {
    // Rimuove markdown e spazi extra
    let clean = text.replace(/```json/g, "").replace(/```/g, "");

    // Trova l'inizio e la fine dell'oggetto JSON
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Struttura JSON non trovata nel testo generato.");
    }
    return JSON.parse(clean);
  } catch (error) {
    console.error("Errore Parsing JSON Backend:", text); // Log per debug
    throw new Error(`Errore Tecnico (Parsing): ${error.message}`);
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
    console.log("--- ☢️ AVVIO ANALISI V14 (TOTAL SCAN) ---");
    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // Usiamo il modello Flash (veloce ed economico) ma con istruzioni molto rigide
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei un software OCR avanzato specializzato in Buste Paga RFI.
      Il tuo compito è scansionare il documento riga per riga e estrarre i valori numerici associati a specifici codici.

      ⚠️ ISTRUZIONI DI SCANSIONE (MOLTO IMPORTANTE):
      1. Il documento è spesso su 2 pagine.
      2. La tabella "Competenze" inizia nella PARTE ALTA della Pagina 1.
      3. NON saltare le prime righe. Scansiona dalla prima riga della tabella in giù.
      4. Se un codice è presente nel documento, DEVI estrarre il suo importo.

      🔍 MASTER LIST CODICI DA CERCARE (TUTTI):
      - 0152 (Straordinario feriale)
      - 0421 (Turno notturno)
      - 0423 (Festivo)
      - 0457 (Festivo notturno)
      - 0470 (Indennità turno - SPESSO A PAGINA 1)
      - 0482 (Domenicale - SPESSO A PAGINA 1)
      - 0AA1 (Mancata mensa)
      - 0293, 0299 (Ticket vecchi)
      - 0496, 0576, 0584
      - 0687 (Mancata mensa)
      - 0376, 0686
      - 0919, 0920, 0932, 0933, 0995, 0996 (Indennità varie)
      - 3B70, 3B71 (Produttività)

      🔍 CODICI SPECIALI (ARRETRATI/MALATTIA):
      - 3E01, 3E02, 3E10, 3E.. (Tutti i codici Malattia/Infortunio)
      - 0K.., 0C.., 0U.. (Una Tantum, Premi Risultato)
      - 74.. (Arretrati anni prec.)
      - 6INT (Arretrati contrattuali)

      🔍 CODICE TICKET RESTAURANT:
      - Cerca 0E99 (Valore 8.00 o 7.00). Se manca, cerca 0299.
      - Se trovi solo Welfare (9WLF), il ticket è 0.00.

      OUTPUT JSON RICHIESTO:
      {
        "month": 1,
        "year": 2024,
        "daysWorked": 0,
        "daysVacation": 0,
        "ticketRate": 0.00,
        "arretrati": 0.00,
        "eventNote": "",
        "codes": {
           "0470": 0.00,
           "0482": 0.00,
           "0152": 0.00,
           ... (inserisci qui TUTTI i codici trovati della Master List)
        }
      }

      REGOLE DI CALCOLO:
      - "ticketRate": Valore unitario (es. 8.00). Se assente o Welfare, metti 0.00.
      - "arretrati": Somma degli importi (Competenze) dei codici SPECIALI (3E.., 0K.., 74..).
      - "eventNote": Elenco testuale degli eventi trovati (es. "Malattia, Una Tantum").
      - "codes": Oggetto con chiave=codice e valore=importo per i codici della MASTER LIST.
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
    const rawText = response.text();

    // Pulizia finale
    const finalJson = cleanAndParseJSON(rawText);

    console.log("✅ Dati V14 Estratti:", JSON.stringify(finalJson).substring(0, 100) + "...");

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