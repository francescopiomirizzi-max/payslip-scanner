import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_AI || process.env.GOOGLE_API_KEY || "");

const BASE_PROMPT = `Sei un esperto Consulente del Lavoro e Avvocato Giuslavorista italiano di altissimo livello.
Il tuo compito è assistere un collega nell'analisi di buste paga, calcolo di differenze retributive (Cassazione 20216/2022) e interpretazione dei CCNL.
Regole d'ingaggio: Rispondi in modo preciso, tecnico ma sintetico. Fornisci riferimenti normativi.`;

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

  try {
    const { question, workerContext } = JSON.parse(event.body || "{}");
    if (!question?.trim()) throw new Error("Domanda mancante.");

    let prompt = BASE_PROMPT;
    if (workerContext?.cognome) {
      const profilo = [workerContext.profilo, workerContext.eliorType].filter(Boolean).join(' — ');
      prompt += `\n\nContesto attivo: stai analizzando le buste paga di ${workerContext.cognome} ${workerContext.nome}, profilo contrattuale: ${profilo}. Tieni conto di questo contesto nella risposta.`;
    }
    prompt += `\n\nDomanda: `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt + question);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer: result.response.text() })
    };
  } catch (error: any) {
    console.error("❌ ERRORE ASK-AI:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Errore sconosciuto" })
    };
  }
};
