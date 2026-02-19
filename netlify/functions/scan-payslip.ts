import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- HELPER PULIZIA JSON (V17 - Blindato) ---
function cleanAndParseJSON(text: string): any {
  try {
    // Rimuove markdown, spazi e potenziali commenti
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Cerca l'oggetto JSON puro
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
  } catch (error: any) {
    console.error("❌ ERRORE PARSING JSON:", text);
    throw new Error(`Output AI non valido: ${error.message}`);
  }
}

// ==========================================
// 1. PROMPT RFI (FERROVIE) - LISTA COMPLETA DA TYPES.TS
// ==========================================
const PROMPT_RFI = `
  Sei un analista contabile specializzato in Buste Paga RFI / TRENITALIA.
  Estrai i dati con precisione assoluta ignorando le migliaia (es. 1.000 = 1000).
  Usa il PUNTO (.) come separatore decimale.
  
  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Cerca nella testata.
  
  ### 2. PRESENZE E FERIE (RFI)
  Cerca la riga orizzontale in alto: "Presenze | Riposi | Ferie".
  - "daysWorked": 1° numero sotto Presenze (es. 21,00).
  - "daysVacation": 3° numero sotto Ferie. (Se > 26, ignora perché sono residui).
  
  ### 3. TICKET RESTAURANT (Unitario)
  - Cerca codice **0E99** o **0299** o **0293**.
  - Estrai il valore nella colonna "Dati Base" o "Parametro" (es. 7.00 o 8.00). 
  - NON prendere il totale nella colonna competenze.
  - Se trovi Welfare (9WLF) o nulla, ticketRate = 0.00.

  ### 4. CODICI VARIABILI (Master List RFI COMPLETA)
  Somma la colonna "Competenze" (importi positivi) per TUTTI questi codici esatti:
  
  - 0152 (Straord. Diurno)
  - 0421 (Ind. Notturno)
  - 0423 (Comp. Cantiere/Festivo)
  - 0457 (Festivo Notturno)
  - 0470 (Ind. Chiamata)
  - 0482 (Ind. Reperibilità)
  - 0496 (Ind. Disp. Chiamata)
  - 0687 (Ind. Linea < 10h)
  - 0686 (Ind. Linea > 10h) -- (Se presente come variante)
  - 0AA1 (Trasferta - Somma tutte le occorrenze se multiple)
  - 0576 (Ind. Orario Spezz.)
  - 0584 (Rep. Festive/Riposo)
  - 0919 (Str. Feriale Diurno)
  - 0920 (Str. Fest/Notturno)
  - 0932 (Str. Diurno Rep.)
  - 0933 (Str. Fest/Not Rep.)
  - 0995 (Str. Diurno Disp.)
  - 0996 (Str. Fest/Not Disp.)
  - 0376 (Indennità varie)
  - 3B70 (Sal. Produttività)
  - 3B71 (Prod. Incrementale)
  
  ### 5. ARRETRATI
  - Somma importi positivi di: 3E.. (Malattia), 74.. (Arretrati), 0K../0C.. (Una Tantum), 6INT.
  - "eventNote": scrivi una breve nota (es. "Malattia") se trovi questi codici.
  
  FORMATO JSON:
  {
    "month": 1, "year": 2024, "daysWorked": 0.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "",
    "codes": { "0152": 0.0, "0421": 0.0, "0AA1": 0.0, ... }
  }
`;

// ==========================================
// 2. PROMPT ELIOR (RISTORAZIONE) - CALIBRATO SU TYPES.TS
// ==========================================
const PROMPT_ELIOR = `
  Sei un analista contabile specializzato in Buste Paga ELIOR RISTORAZIONE.
  Il documento può essere una scansione cartacea.
  
  ### 1. DATI BASE
  - Cerca la data (Mese/Anno) in alto a destra (es. "21 DICEMBRE 2023").
  
  ### 2. PRESENZE E FERIE (Layout Elior)
  - **daysWorked**: Cerca la casella **"GG INPS"** (in alto a sinistra).
  - **daysVacation**: Cerca la riga "Ferie" e la colonna **"FRUITE"** o "GODUTE".
  
  ### 3. TICKET RESTAURANT (Unitario)
  - Cerca codici **2000** o **2001**.
  - Estrai il valore dalla colonna **"VALORE UNITARIO"** (es. 5,29 o 4,00).
  
  ### 4. MAPPATURA CODICI ELIOR (Master List)
  Scansiona le righe. Estrai l'importo "COMPETENZE" per questi CODICI specifici (corrispondono alle colonne del software):
  
  - "1126" (Ind. Cassa)
  - "1130" (Lav. Nott. / Magg. Notturna)
  - "1131" (Lav. Domen. / Ind. Domenica)
  - "1129" (Indennità Turno - Mappa qui se presente)
  - "2018" (Straord. 18%)
  - "2020" (Straord. 20%)
  - "2035" (Straord. 35%)
  - "2235" (Maggiorazione 35%)
  - "4133" (Funz. Diverse)
  - "4254" (RFR < 8h)
  - "4255" (Pernottamento)
  - "4256" (Pernottazione)
  - "4300" (Ass. Res. No RS)
  - "4305" (Ass. Res. RS)
  - "4301" (Fuori Sede / Trasferta RFR)
  - "4320" (Diaria Scorta)
  - "4325" (Flex Oraria)
  - "4330" (Flex Res.)
  - "4345" (Riserva Pres.)
  - "5655" (26/MI Retrib.)

  ### 5. ARRETRATI
  - Cerca voci testuali come "Arretrati", "Una Tantum", "Malattia", "Carenza".
  - Somma in "arretrati" e scrivi "eventNote".
  
  FORMATO JSON:
  {
    "month": 1, "year": 2024, "daysWorked": 0.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "",
    "codes": { 
       "1130": 0.0, 
       "4301": 0.0,
       ... (tutti i codici trovati)
    }
  }
`;

export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

  try {
    const body = JSON.parse(event.body || "{}");
    // Leggiamo 'company' che ora arriva dal Frontend
    const { fileData, mimeType, company } = body;

    if (!fileData) throw new Error("File mancante.");
    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // --- SELEZIONE INTELLIGENTE DEL PROMPT ---
    const targetPrompt = (company === 'ELIOR') ? PROMPT_ELIOR : PROMPT_RFI;

    console.log(`--- 🚀 AVVIO ANALISI PER: ${company || 'RFI'} ---`);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
    });

    const result = await model.generateContent([
      targetPrompt,
      { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
    ]);

    const finalJson = cleanAndParseJSON(await result.response.text());

    // Aggiungiamo il campo company per debug nel frontend
    finalJson.company = company || 'RFI';

    console.log(`✅ EXTR ${company}: ${finalJson.month}/${finalJson.year} - Rate: ${finalJson.ticketRate}`);

    return { statusCode: 200, headers, body: JSON.stringify(finalJson) };

  } catch (error: any) {
    console.error("❌ ERRORE BACKEND:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};