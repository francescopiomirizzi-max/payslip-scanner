import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- IL PULITORE DI JAVASCRIPT ---
// Questa funzione è il "cane da guardia": non fa passare nulla che non sia JSON puro.
function cleanAndParseJSON(text: string): any {
  try {
    // 1. Rimuove Markdown (```json ... ```) se presente
    let clean = text.replace(/```json/g, "").replace(/```/g, "");

    // 2. Cerca la prima parentesi graffa aperta '{' e l'ultima chiusa '}'
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      // 3. Isola il contenuto esatto
      clean = clean.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Struttura JSON non trovata nella risposta dell'IA.");
    }

    // 4. Parsing con controllo errori
    return JSON.parse(clean);
  } catch (error) {
    console.error("Errore Raw Text:", text); // Log per debug estremo
    throw new Error(`Errore di formattazione JSON: ${error.message}`);
  }
}

export const handler: Handler = async (event, context) => {
  // Headers CORS per permettere al Frontend di chiamare il Backend
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    console.log("--- 🛡️ AVVIO ANALISI V11 ULTIMATE (JSON MODE + CLEANER) ---");

    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // CONFIGURAZIONE CRITICA: Forziamo l'uscita JSON nativa
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei un Analista Paghe esperto in buste paga RFI (Ferrovie).
      Analizza l'immagine e restituisci ESCLUSIVAMENTE un oggetto JSON.
      
      ⚠️ REGOLE DI ESTRAZIONE FERREE (2008-2025):

      1. **DATA**: Estrai Mese (numero) e Anno (numero 4 cifre).
      2. **PRESENZE**: Cerca "GG. Lav.", "Presenze" o colonna "P" nel box in alto. Usa il valore effettivo.
      3. **FERIE**: Cerca "Ferie Godute" mese corrente.
      
      4. **TICKET RESTAURANT (Cruciale)**:
         - Devi trovare l'aliquota unitaria (valore singolo buono).
         - Cerca codici: **0E99** (Priorità Assoluta, di solito 8.00 o 7.00), **0299**, **0293**.
         - IGNORA importi bassi (es. 0.30, 0.40) se trovi un importo più alto (es. 7.00, 8.00).
         - SE trovi SOLO Welfare (9WLF) o Assicurazioni (9UNI), il ticket è 0.00.
         - Restituisci il numero puro (es. 8.00).

      5. **ARRETRATI E EVENTI**:
         - Somma in 'arretrati' SOLO importi positivi (Competenze) per:
           - Malattia / Infortunio / Carenza (Codici 3E..).
           - Una Tantum / Arretrati Anni Prec. / Premi Risultato (Codici 0K.., 0C.., 74.., 6INT).
         - NON includere Rimborsi Spese o Welfare qui.
         - Crea una stringa 'eventNote' elencando cosa hai trovato (es. "Malattia, Una Tantum").

      6. **VOCI VARIABILI (Indennità)**:
         - Estrai importi per codici: 0152, 0421, 0470, 0482, 0496, 0687, 0AA1, 0423, 0576, 0584, 0919, 0920, 0932, 0933, 0995, 0996, 0376, 0686, 3B70, 3B71.

      ⛔ **BLACKLIST (DA IGNORARE SEMPRE)**:
         - 9WLF (Welfare), 9UNI/9RBM/9POZ (Sanità), 6HEA (CTR Eurofer).
         - 6YZD (Rimborso 730), 6YR5.
         - 9DT6, 9564, 3ITT (Recuperi/Statistiche).
         - 0PA8, 0PA9 (Polizze).
         - 0030, 0032 (Rimborsi Benzina/Gasolio).

      FORMATO JSON RICHIESTO:
      {
        "month": 1,
        "year": 2024,
        "daysWorked": 0,
        "daysVacation": 0,
        "ticketRate": 0.00,
        "arretrati": 0.00,
        "eventNote": "",
        "codes": {}
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
    const rawText = response.text();

    // Pulizia e Validazione
    const finalJson = cleanAndParseJSON(rawText);

    console.log("✅ JSON Valido Generato:", JSON.stringify(finalJson).substring(0, 100) + "...");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(finalJson), // Restituiamo direttamente l'oggetto pulito
    };

  } catch (error: any) {
    console.error("❌ ERRORE CRITICO:", error);
    return {
      statusCode: 500, // O 200 con un flag di errore per non far crashare il frontend
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};