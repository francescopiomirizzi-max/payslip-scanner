import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const handler: Handler = async (event, context) => {
    // Configurazione CORS (Fondamentale)
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "OK" };
    }

    try {
        console.log("--- INIZIO ANALISI (Versione Pulizia Forzata) ---");

        if (!process.env.GOOGLE_API_KEY) {
            throw new Error("Manca la API KEY su Netlify");
        }

        // 1. Parsing del corpo
        let bodyData;
        try {
            bodyData = JSON.parse(event.body || "{}");
        } catch (e) {
            // Se fallisce il JSON, magari è ancora Multipart (vecchio frontend)?
            throw new Error("Il backend si aspettava un JSON ma ha ricevuto altro format.");
        }

        const { fileData, mimeType } = bodyData;

        if (!fileData) {
            throw new Error("Nessun fileData trovato nel JSON inviato.");
        }

        // 2. LA PULIZIA CHIRURGICA (Il fix per il tuo errore) 🧼
        // Gemini odia "data:application/pdf;base64,". Lo dobbiamo togliere.
        let cleanData = fileData;
        if (fileData.includes("base64,")) {
            cleanData = fileData.split("base64,")[1];
        }

        // 3. Forzatura MIME Type
        // Se il frontend ci manda "null" o cose strane, noi forziamo PDF se sembra un PDF.
        let finalMimeType = mimeType || "application/pdf";

        // Log di controllo (guardali nei log di Netlify se fallisce ancora)
        console.log(`Tipo inviato a Gemini: ${finalMimeType}`);
        console.log(`Primi 30 caratteri del file pulito: ${cleanData.substring(0, 30)}...`);

        // 4. Chiamata a Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Analizza questa busta paga. Estrai ESATTAMENTE questo JSON: 
    { "mese": "mese in lettere", "anno": "AAAA", "netto": "numero", "ferie_residue": "numero", "rol_residui": "numero" }. 
    Se illeggibile o assente metti null.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: cleanData,      // Stringa pulita senza "data:..."
                    mimeType: finalMimeType // "application/pdf"
                },
            },
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

        return {
            statusCode: 200,
            headers,
            body: text,
        };

    } catch (error: any) {
        console.error("❌ ERRORE CRITICO:", error);
        // Restituiamo l'errore esatto al frontend per vederlo nella console
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || error.toString() }),
        };
    }
};