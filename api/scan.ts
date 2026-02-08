import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export default async function handler(request: any, response: any) {
    // 1. Gestione CORS (per permettere al sito di chiamare la funzione)
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Rispondiamo subito alle richieste pre-flight del browser
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        console.log("--- 🕵️‍♂️ VERCEL: AVVIO SCANSIONE GEMINI ---");

        // Vercel fa il parsing del JSON in automatico! Non serve JSON.parse()
        const { fileData, mimeType } = request.body;

        if (!fileData) throw new Error("File mancante nel body");

        // Pulizia Base64
        const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

        // Modello
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // PROMPT (Lo stesso identico che avevamo ottimizzato)
        const prompt = `
      Sei un Analista Paghe esperto in contratti ferroviari (RFI/Trenitalia).
      Analizza la busta paga e estrai un JSON rigoroso.

      DATI DA ESTRARRE:
      1. "mese" (Stringa, es "Febbraio") e "anno" (Numero).
      2. "netto" (Numero, il netto a pagare).
      3. "daysWorked": Giorni lavorati (colonna Presenze/P).
      4. "daysVacation": Ferie GODUTE nel mese (colonna Ferie/F).

      5. VOCI VARIABILI (Dalla colonna COMPETENZE):
         Cerca questi codici e estrai l'importo in Euro:
         - 0152, 0421, 0470, 0482, 0496, 0687, 0AA1, 0423, 0576, 
         - 0584, 0919, 0920, 0932, 0933, 0995, 0996, 0376, 0686.

      FORMATO JSON:
      {
        "mese": "...", "anno": 2024, "netto": 0.00,
        "daysWorked": 0, "daysVacation": 0,
        "codes": { "0919": 0.00, ... }
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

        const text = result.response.text();
        const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Risposta Vercel
        response.status(200).json(JSON.parse(jsonString));

    } catch (error: any) {
        console.error("❌ ERRORE VERCEL:", error);
        response.status(500).json({ error: error.message });
    }
}