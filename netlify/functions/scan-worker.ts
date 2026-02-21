import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

// MAGIA: Usa la nuova variabile d'ambiente (con fallback a quella vecchia se non l'hai ancora impostata)
const apiKey = process.env.GOOGLE_API_KEY_ONBOARDING || process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const PROMPT_ANAGRAFICA = `
  Sei un assistente HR specializzato nell'estrazione di dati anagrafici da buste paga e cedolini italiani.
  Il tuo UNICO compito è leggere il documento fornito (che può essere storto o fotografato male) ed estrarre i dati del lavoratore.
  
  Estrai esattamente questi campi:
  1. "nome": Il nome di battesimo del lavoratore.
  2. "cognome": Il cognome del lavoratore.
  3. "ruolo": La qualifica o la mansione (es. "Macchinista", "Capotreno", "Cuoco", "Operatore", "Capo Impianto").
  4. "profiloProfessionale": Il livello di inquadramento, parametro o livello contrattuale (es. "Livello B", "Parametro 130", "Livello 4", "B1").
  5. "azienda": Identifica l'azienda dalla testata o dal logo (es. "RFI", "ELIOR", "REKEEP"). Se trovi "Trenitalia" o "Ferrovie", scrivi "RFI".

  Pulisci i testi (es. metti la prima lettera maiuscola per nome e cognome).
  
  Restituisci ESATTAMENTE ED ESCLUSIVAMENTE un file JSON valido con questa struttura, senza codice markdown o testo aggiuntivo:
  {
    "nome": "Mario",
    "cognome": "Rossi",
    "ruolo": "Macchinista",
    "profiloProfessionale": "Livello B",
    "azienda": "RFI"
  }
`;

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
        const body = JSON.parse(event.body || "{}");
        const { fileData, mimeType } = body;

        if (!fileData) throw new Error("File mancante per l'autocompilazione.");

        // Pulisce il base64 se necessario
        const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

        console.log(`--- 👤 AVVIO AUTOCOMPILAZIONE ANAGRAFICA ---`);

        // Usiamo il modello veloce (flash) perché l'operazione è semplicissima
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        });

        const result = await model.generateContent([
            PROMPT_ANAGRAFICA,
            { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
        ]);

        let textResponse = result.response.text();
        // Pulizia di sicurezza nel caso l'IA metta i blocchi markdown ```json
        textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        const workerData = JSON.parse(textResponse);

        console.log(`✅ ANAGRAFICA ESTRATTA: ${workerData.nome} ${workerData.cognome} - ${workerData.azienda}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(workerData)
        };

    } catch (error: any) {
        console.error("❌ ERRORE AUTOCOMPILAZIONE:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};