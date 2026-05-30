import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkScanRateLimit, clientIp } from "./_rateLimit";

// Micro-call: indovina il "Mese Anno" (es. "Dicembre 2020") dall'intestazione di una
// busta paga. Sostituisce ~30MB di Tesseract.js scaricati sul telefono per fare la
// stessa cosa, con accuratezza nettamente migliore.
//
// Strategia: il MOBILE ritaglia il 35% superiore dell'immagine (già fatto lato client
// per Tesseract) e lo manda qui. Noi giriamo a Gemini Flash con un prompt minimale.

const apiKey = process.env.GOOGLE_API_KEY_GUESS || process.env.GOOGLE_API_KEY || "";
// Default su gemini-3.5-flash come il resto della pipeline scan, override via env per
// poter sperimentare con 2.5-flash senza rebuild.
const GUESS_MODEL = process.env.GEMINI_GUESS_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash";
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET) || 1024;

const PROMPT = `Sei un OCR specializzato in buste paga italiane.
Guarda SOLO la parte alta del documento (intestazione/testata) e identifica il periodo di paga.
Rispondi in JSON con esattamente questa struttura:
{"month": "Gennaio" | ... | "Dicembre" | null, "year": 4-cifre o null}
Regole:
- "month" è il nome italiano del mese (capitalized), oppure null se non visibile.
- "year" è un intero a 4 cifre (es. 2024), oppure null.
- Se vedi solo numeri (es. "12/2020"), traduci in nome italiano del mese.
- NON inventare: se non sei sicuro, metti null. Meglio "non lo so" che sbagliato.
- NIENTE testo fuori dal JSON, NIENTE markdown.`;

export const handler: Handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

    try {
        const body = JSON.parse(event.body || "{}");
        const { fileData, mimeType, sessionId } = body;
        if (!fileData) throw new Error("File mancante.");

        // Rate limit: usa la stessa soglia delle scan principali (questa function è
        // chiamata 1-2 volte per file, non spammabile).
        const rate = checkScanRateLimit(sessionId, clientIp(event as any));
        if (!rate.allowed) {
            return { statusCode: 429, headers, body: JSON.stringify({ error: rate.reason }) };
        }

        if (!apiKey) {
            return { statusCode: 200, headers, body: JSON.stringify({ title: null }) };
        }

        const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: GUESS_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.0,
                thinkingConfig: { thinkingBudget: THINKING_BUDGET },
            } as any,
        });

        // Cap aggressivo: questa è una micro-call, non vale la pena aspettare 14s.
        const result = await model.generateContent(
            [PROMPT, { inlineData: { data: cleanData, mimeType: mimeType || "image/jpeg" } }],
            { timeout: 8000 } as any
        );

        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(text);

        const month: string | null = parsed?.month ?? null;
        const year: number | null = parsed?.year ?? null;

        let title: string | null = null;
        if (month && year) title = `${month} ${year}`;
        else if (month) title = month;
        else if (year) title = `Anno ${year}`;

        return { statusCode: 200, headers, body: JSON.stringify({ title }) };
    } catch (err: any) {
        console.error("guess-title error:", err?.message || err);
        // Best-effort: se Gemini fallisce, restituiamo null e il client mostra il
        // campo vuoto editabile. Non bloccante.
        return { statusCode: 200, headers, body: JSON.stringify({ title: null }) };
    }
};
