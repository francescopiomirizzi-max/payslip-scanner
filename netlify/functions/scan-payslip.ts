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
    console.log("--- 🚀 AVVIO ANALISI UNIVERSALE V10.0 (2008-2025) ---");
    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // Configurazione JSON Mode
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei il massimo esperto di Buste Paga Ferroviarie (RFI) in Italia. 
      Hai analizzato lo storico dal 2008 al 2025.
      Il tuo compito è estrarre dati precisi ignorando i "falsi positivi" (Welfare, Rimborsi, Statistiche).

      🔍 ISTRUZIONI DI ESTRAZIONE:

      1. DATA (CRUCIALE):
         - Trova Mese e Anno (es. "Gennaio 2024", "01/2008").
         - Restituisci "month" (numero 1-12) e "year" (numero 4 cifre).

      2. PRESENZE (BOX IN ALTO):
         - "daysWorked": Cerca "GG. Lav.", "Presenze", "Lavorati" o la colonna "P". Prendi il valore effettivo (es. 19, 21, 15).
         - "daysVacation": Cerca "Ferie Godute", "Ferie", o colonna "F".

      3. TICKET RESTAURANT (LOGICA "SEGUGIO"):
         - Devi trovare il valore unitario del buono pasto.
         - Cerca i codici in ordine di priorità: **0E99** (priorità massima), **0299**, **0293**.
         - IGNORA se l'aliquota è inferiore a 0.50€ (es. 0.30 è una quota dipendente).
         - Cerca valore "Aliquota" o "Parametro": può essere 8.00, 7.00, 5.29, 2.01, 0.91.
         - SE NON TROVI NULLA o trovi solo "Welfare"/"Mensa": Restituisci 0.00.

      4. ARRETRATI E EVENTI (COLONNA "ARRETRATI"):
         - Somma in "arretrati" gli importi positivi (Competenze) relativi a:
           - "Malattia", "Infortunio", "Carenza" (Codici che iniziano con 3E..).
           - "Una Tantum", "U.T.", "Accordo", "Premio Risultato" (Codici 0K.., 0C.., 0U..).
           - "Arretrati", "Arr. Comp." (Codici 74.., 6INT).
         - "eventNote": Scrivi una breve lista degli eventi trovati (es. "Malattia, Una Tantum").

      5. COMPETENZE VARIABILI (LISTA BIANCA):
         - Somma nelle voci specifiche (codes) SOLO i codici indennità operativa puri.
         - LISTA: [0152], [0421], [0470], [0482], [0496], [0687], [0AA1], [0423], [0576], 
           [0584], [0919], [0920], [0932], [0933], [0995], [0996], [0376], [0686], [3B70], [3B71].

      ⛔ BLACKLIST ASSOLUTA (IGNORARE SEMPRE):
         - Non sommare MAI questi codici o descrizioni, sono "falsi soldi":
         - WELFARE: 9WLF, 9UNI, 9RBM, 9POZ, 6HEA, Welfare.
         - RIMBORSI FISCALI: 6YZD (Rimb. 730), 6YR5.
         - STATISTICHE: 9DT6 (Imponibile detass.), 9564 (Recuperi), 3ITT.
         - ASSICURAZIONI: 0PA8, 0PA9, 0962, Polizza.
         - RIMBORSI SPESE: 0030 (Benzina), 0032 (Gasolio), 0341.

      FORMATO JSON OBBLIGATORIO:
      {
        "month": 1,
        "year": 2024,
        "daysWorked": 0,
        "daysVacation": 0,
        "ticketRate": 0.00,
        "arretrati": 0.00,
        "eventNote": "",
        "codes": {
           "0687": 0.00,
           ...
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

    // Pulizia JSON chirurgica
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    console.log("✅ Dati Estratti (V10):", text.substring(0, 150) + "...");

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