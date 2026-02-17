import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- HELPER: PULITORE DI JSON (V16 - Blindato) ---
function cleanAndParseJSON(text: string): any {
  try {
    // 1. Rimuove markdown e spazi extra
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. Trova l'oggetto JSON puro
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
  } catch (error: any) {
    console.error("❌ ERRORE PARSING JSON:", text);
    // Fallback: tenta di recuperare se l'errore è banale, altrimenti lancia
    throw new Error(`Output AI non valido: ${error.message}`);
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
    console.log("--- 🚀 AVVIO ANALISI V16 (RFI PRECISION MODE) ---");

    const body = JSON.parse(event.body || "{}");
    const { fileData, mimeType } = body;

    if (!fileData) throw new Error("File mancante.");

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // Usiamo flash con temperatura 0 per massima logica e zero "allucinazioni"
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0
      }
    });

    // --- PROMPT OTTIMIZZATO SUI PDF CARICATI ---
    const prompt = `
      Sei un analista contabile esperto in buste paga RFI (Ferrovie dello Stato).
      Il tuo compito è estrarre ESATTAMENTE i dati numerici richiesti, convertendoli in formato standard JSON.

      ### 1. REGOLE DI LETTURA (FONDAMENTALE)
      - **Separatore Decimali:** Nel documento originale, la virgola (,) separa i decimali (es. 20,50). Nel JSON di output devi usare il PUNTO (.) (es. 20.50).
      - **Separatore Migliaia:** Ignora i punti che separano le migliaia (es. 1.500,00 diventa 1500.00).
      - **Numeri Negativi:** Se vedi un segno meno (es. 10,00- o -10,00), restituisci un numero negativo.

      ### 2. ESTRAZIONE DATA
      - Cerca in alto nel documento (Header). Troverai stringhe come "Gennaio 2024", "12/2023".
      - **month**: Converti il mese in numero (Gennaio=1, Febbraio=2, ... Dicembre=12).
      - **year**: Estrai l'anno a 4 cifre.

      ### 3. PRESENZE E FERIE (Box Orizzontale in Alto)
      Cerca la riga con le intestazioni esatte: **"Presenze"**, **"Riposi"**, **"Ferie"**.
      Leggi i valori numerici nella riga *immediatamente successiva*.
      
      - **daysWorked**: Prendi il valore sotto "Presenze". (Esempio tipico: 18,00 o 21,00).
      - **daysVacation**: Prendi il valore sotto "Ferie". (È il terzo numero della riga).
      
      ⚠️ *Attenzione*: Se sotto "Ferie" leggi un numero molto alto (es. > 26), stai sbagliando colonna e leggendo i residui. In quel caso restituisci 0.00.

      ### 4. TICKET RESTAURANT (Valore Unitario)
      Dobbiamo trovare quanto vale UN singolo buono pasto.
      - Cerca il codice **0E99** o **0299** o **0293**.
      - Leggi la colonna "Dati Base" o "Parametro" (solitamente la prima colonna numerica della riga).
      - Il valore deve essere piccolo (es. 7.00, 8.00, 5.29).
      - ⛔ NON LEGGERE la colonna "Competenze" (l'ultima a destra) per questa voce, perché contiene il totale.
      - Se trovi solo "Welfare" (9WLF), metti ticketRate: 0.00.

      ### 5. VOCI VARIABILI (Competenze)
      Scansiona la tabella centrale (Cod. Voce | Descrizione | ... | Competenze).
      Per i codici elencati sotto, somma gli importi della colonna **"Competenze"** (l'ultima a destra positiva).
      Se un codice appare più volte (es. 0AA1), SOMMA tutti i valori.

      🔍 **MASTER LIST DA ESTRARRE:**
      - 0152 (Str. feriale)
      - 0421 (Notturno)
      - 0423 (Festivo/Cantiere)
      - 0457 (Festivo notturno)
      - 0470 (Indennità turno)
      - 0482 (Reperibilità)
      - 0AA1 (Trasferta - Somma multipla)
      - 0293, 0299 (Ticket vecchi - solo se presenti come competenza monetaria)
      - 0496, 0576, 0584
      - 0687, 0686 (Indennità di linea)
      - 0376 (Indennità turno A)
      - 0919, 0920, 0932, 0933, 0995, 0996
      - 3B70, 3B71 (Produttività)

      ### 6. ARRETRATI E EVENTI
      - **arretrati**: Somma "Competenze" di codici che iniziano con: "3E" (Malattia), "74" (Arretrati anni prec.), "0K"/"0C" (Una tantum), "6INT".
      - **eventNote**: Se "arretrati" > 0, scrivi brevemente la causa (es. "Malattia", "Arr. A.P.").

      ### OUTPUT JSON
      {
        "month": 1,
        "year": 2024,
        "daysWorked": 21.00,
        "daysVacation": 2.00,
        "ticketRate": 7.00,
        "arretrati": 0.00,
        "eventNote": "",
        "codes": {
           "0152": 0.00,
           "0421": 150.50,
           "0AA1": 45.00,
           ... (tutti i codici trovati)
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

    console.log(`✅ EXTR: ${finalJson.month}/${finalJson.year} | GG: ${finalJson.daysWorked} | Ticket: ${finalJson.ticketRate}`);

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
      body: JSON.stringify({ error: error.message || "Errore sconosciuto." }),
    };
  }
};