import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

// MAGIA: Usa la nuova variabile d'ambiente (con fallback a quella vecchia se non l'hai ancora impostata)
const apiKey = process.env.GOOGLE_API_KEY_ONBOARDING || process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Modello Gemini centralizzato: override con la env var GEMINI_MODEL (default gemini-3.5-flash).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const PROMPT_ANAGRAFICA = `
  Sei un assistente HR specializzato nell'estrazione di dati anagrafici da buste paga e cedolini italiani.
  Il tuo UNICO compito è leggere il documento fornito (che può essere storto o fotografato male) ed estrarre i dati del lavoratore.

  Estrai esattamente questi campi:

  1. "nome": Il nome di battesimo del lavoratore. Prima lettera maiuscola.

  2. "cognome": Il cognome del lavoratore. Prima lettera maiuscola.

  3. "ruolo" → **MANSIONE OPERATIVA SPECIFICA** (cosa fa concretamente il lavoratore).
     ✅ Esempi corretti: "Macchinista", "Capotreno", "Tecnico Manutenzione Linea", "Cuoco", "Operatore Polifunzionale", "Capo Impianto", "Addetto Pulizie", "Verificatore", "Manovratore".
     📍 Dove cercarlo nel cedolino: sezioni "Mansione", "Funzione", "Profilo", "Profilo Professionale Operativo", "Ruolo Aziendale".
     ⚠️ Se nel documento NON c'è una mansione operativa esplicita (solo il livello contrattuale), lascia "ruolo" come stringa vuota "". È PREFERIBILE lasciare vuoto piuttosto che inserire un livello.

  4. "profiloProfessionale" → **LIVELLO / CATEGORIA CONTRATTUALE** di inquadramento (struttura gerarchica del CCNL).
     ✅ Esempi corretti: "Professional", "Specialist", "Capo Tecnico", "Quadro", "Livello B", "Parametro 130", "Livello 4", "B1", "A2", "Impiegato 1° Liv.", "Operaio Comune".
     📍 Dove cercarlo nel cedolino: sezioni "Qualifica", "Q.Prof", "Q.PROF", "Categoria", "Livello", "Inquadramento", "Cat.".

  🚨 REGOLA ANTI-CONFUSIONE CRITICA (BUG STORICO):
  Sui cedolini RFI/TRENITALIA esistono DUE colonne distinte: "Q.PROF" (livello, es. "Professional") e "Mansione" (es. "Macchinista").
  È SEVERAMENTE VIETATO mettere il livello contrattuale nel campo "ruolo".
  Token che NON DEVONO MAI finire in "ruolo" (vanno SEMPRE in "profiloProfessionale"):
  - "Professional", "Specialist", "Capo Tecnico", "Quadro", "Quadro A", "Quadro B"
  - "Operaio", "Operaio Comune", "Operaio Qualificato", "Impiegato", "Impiegato 1° Liv."
  - "Livello A/B/C/D/E", "Liv. 1/2/3/4/5/6/7"
  - "Parametro 100/110/130/140/175"
  - Codici tipo "B1", "A2", "C3" da soli

  Esempi di output:
  ✅ CORRETTO  → "ruolo": "Tecnico Manutenzione Linea", "profiloProfessionale": "Professional"
  ✅ CORRETTO  → "ruolo": "Macchinista",                "profiloProfessionale": "Livello B"
  ✅ CORRETTO  → "ruolo": "",                            "profiloProfessionale": "Professional"   (mansione assente sul PDF)
  ❌ SBAGLIATO → "ruolo": "Professional",                "profiloProfessionale": ""               (livello scivolato in ruolo)
  ❌ SBAGLIATO → "ruolo": "Quadro",                      "profiloProfessionale": ""

  5. "azienda": Identifica l'azienda dalla testata o dal logo (es. "RFI", "TRENITALIA", "ELIOR", "CLEAN_SERVICE", "MERCITALIA"). Se trovi "Rete Ferroviaria Italiana" o "RFI", scrivi "RFI". Se trovi "Trenitalia", scrivi "TRENITALIA". Se trovi "Mercitalia", "Mercitalia Shunting", "Mercitalia Shunting & Terminal" oppure il framework/logo del gestionale ADP (it-adp.com), scrivi "MERCITALIA". Se trovi "Ferrovie dello Stato" o "FS" senza altra specificazione, scrivi "RFI" come fallback storico. Se trovi "Clean Service", "Clean Service SRL" o varianti, scrivi "CLEAN_SERVICE".

  Restituisci ESATTAMENTE ED ESCLUSIVAMENTE un file JSON valido con questa struttura, senza codice markdown o testo aggiuntivo:
  {
    "nome": "Mario",
    "cognome": "Rossi",
    "ruolo": "Macchinista",
    "profiloProfessionale": "Professional",
    "azienda": "TRENITALIA"
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
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
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