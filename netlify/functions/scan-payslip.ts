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

    // ... (tutto il codice prima rimane uguale)

    const prompt = `
     Sei un motore OCR specializzato esclusivamente in Buste Paga RFI (Ferrovie dello Stato).
      Il tuo obiettivo è estrarre dati numerici con precisione assoluta, ignorando il "rumore" del documento.

      ### 1. ISTRUZIONI PER "PRESENZE" E "FERIE" (CRITICO)
      La tabella delle presenze è strutturata orizzontalmente. 
      Cerca la riga di testo che contiene le etichette: "Presenze", "Riposi", "Ferie".
      I dati si trovano nella riga numerica SUBITO SOTTO.

      Devi applicare questa LOGICA POSIZIONALE RIGIDA:
      - Il **1° NUMERO** (sinistra) è "daysWorked" (Giorni Lavorati). Esempio: 22,00 o 20.00.
      - Il **3° VALORE** è "daysVacation" (Ferie Godute).
      
      ⚠️ REGOLE DI SICUREZZA PER LE FERIE:
      1. Se tra il 2° numero (Riposi) e il successivo c'è un vuoto, un doppio spazio o ",,", allora daysVacation = 0.00.
      2. Se leggi un numero > 22 nella posizione delle ferie (es. 25,00 o 100), STAI SBAGLIANDO colonna (stai leggendo i residui a destra). In quel caso, usa 0.00.
      3. Ignora SEMPRE le colonne finali "Ferie anno prec." e "Ferie anno corrente".

      ### 2. ISTRUZIONI PER I CODICI (IMPORTI)
      Scansiona TUTTO il documento (spesso è su 2 colonne o 2 pagine) cercando i codici nella colonna "Cod. Voce".
      Se un codice appare più volte (es. 0AA1 o 0470), SOMMA i valori della colonna "Competenze".

      🔍 MASTER LIST (Cerca SOLO questi):
      - 0152 (Str. feriale)
      - 0421 (Notturno)
      - 0423 (Festivo/Cantiere)
      - 0457 (Festivo notturno)
      - 0470 (Indennità turno - SOMMA se multipli)
      - 0482 (Reperibilità)
      - 0AA1 (Trasferta - SOMMA se multipli)
      - 0293, 0299 (Ticket vecchi)
      - 0496, 0576, 0584
      - 0687, 0686 (Ind. linea)
      - 0376
      - 0919, 0920, 0932, 0933, 0995, 0996 (Vari straordinari)
      - 3B70, 3B71

      ### 3. ISTRUZIONI PER ARRETRATI E NOTE
      - "ticketRate": Cerca il codice 0E99. Il valore unitario è spesso sotto la colonna "Parametro" o "Dati base" (es. 7,00 o 8,00). Se non lo trovi, metti 0.00.
      - "arretrati": Somma gli importi di codici che iniziano con 3E (Malattia), 74 (Arretrati anni prec.), 0K/0C (Una tantum), 6INT.
      - "eventNote": Se trovi codici 3E.., scrivi "Malattia". Se trovi 74.., scrivi "Arretrati AP".

      ### 4. FORMATO OUTPUT JSON (RIGIDO)
      Restituisci SOLO un oggetto JSON valido.
      Usa il punto (.) come separatore decimale per tutti i numeri (es. 14.50, non 14,50).

      {
        "month": numero (1-12),
        "year": numero (4 cifre),
        "daysWorked": numero (float, es. 21.00),
        "daysVacation": numero (float, es. 3.50. Se vuoto o >22 metti 0.00),
        "ticketRate": numero (float, es. 8.00),
        "arretrati": numero (float),
        "eventNote": stringa,
        "codes": {
           "0152": numero,
           "0421": numero,
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