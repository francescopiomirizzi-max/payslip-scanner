import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multiparty from "multiparty";
import fs from "fs";
import { Readable } from "stream";

// Leggi la chiave API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// Funzione Helper: Converte file per Gemini
function fileToGenerativePart(path: string, mimeType: string) {
    return {
        inlineData: {
            data: fs.readFileSync(path).toString("base64"),
            mimeType,
        },
    };
}

// Funzione Helper: Parsing Multipart
const parseMultipartForm = (event: any): Promise<{ fields: any; files: any }> => {
    return new Promise((resolve, reject) => {
        const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
        const stream = new Readable();
        stream.push(bodyBuffer);
        stream.push(null);
        Object.assign(stream, { headers: event.headers });

        const form = new multiparty.Form();
        form.parse(stream as any, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
};

export const handler: Handler = async (event, context) => {
    // LOG PER VEDERE SE IL SERVER SI È AGGIORNATO
    console.log("🚀 BACKEND RIAVVIATO: Nuova versione caricata!");

    // Permessi CORS
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

    try {
        // Check Chiave
        if (!process.env.GOOGLE_API_KEY) throw new Error("Chiave API mancante (.env)");

        // Parsing
        const { files } = await parseMultipartForm(event);
        const file = files.file ? files.file[0] : null;
        if (!file) throw new Error("Nessun file caricato");

        // --- FIX FORZATO PER IL TIPO DI FILE ---
        const filename = file.originalFilename.toLowerCase();
        let mimeType = "application/pdf"; // Default sicuro

        // Se finisce con pdf, è UN PDF. Punto.
        if (filename.endsWith(".pdf")) {
            mimeType = "application/pdf";
        }
        // Se è un'immagine
        else if (filename.endsWith(".png")) { mimeType = "image/png"; }
        else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) { mimeType = "image/jpeg"; }

        console.log(`📎 File: ${filename}`);
        console.log(`🔒 Tipo inviato a Gemini: ${mimeType}`);

        // Configurazione Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analizza questa busta paga. Estrai JSON: { "mese": "", "anno": "", "netto": "", "ferie_residue": "", "rol_residui": "" }. Usa null se vuoto.`;

        // Invio
        const result = await model.generateContent([
            prompt,
            fileToGenerativePart(file.path, mimeType),
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

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
            body: JSON.stringify({ error: error.message || "Errore sconosciuto" }),
        };
    }
};