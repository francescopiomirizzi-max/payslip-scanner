import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const handler: Handler = async (event, context) => {
    // Headers CORS standard
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "OK" };
    }

    try {
        console.log("--- 🕵️‍♂️ AVVIO SCANSIONE BUSTA PAGA RFI (Prompt v3.0) ---");

        const body = JSON.parse(event.body || "{}");
        const { fileData, mimeType } = body;

        if (!fileData) throw new Error("File mancante");

        // Pulizia stringa Base64
        const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

        // Usiamo il modello PRO perché legge meglio le tabelle dense dei cedolini RFI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // --- IL PROMPT OTTIMIZZATO SUL TUO CODICE ---
        const prompt = `
      Sei un Analista Paghe esperto in contratti ferroviari (RFI/Trenitalia).
      Il tuo compito è estrarre dati specifici da una busta paga e restituire UNICAMENTE un oggetto JSON.

      🔍 **OBIETTIVO**:
      Estrarre i dati per popolare una griglia di calcolo legale.
      Devi cercare codici voce specifici e i dati di presenza.

      📜 **ISTRUZIONI DI ESTRAZIONE**:

      1. **TESTATA (Periodo)**:
         - "mese": Il mese di competenza in italiano (es. "Gennaio", "Febbraio").
         - "anno": L'anno di competenza (es. 2024).

      2. **PIÈ DI PAGINA (Totali)**:
         - "netto": Il "Netto a Pagare" finale (cerca in basso a destra).

      3. **DATI PRESENZE (Molto Importante)**:
         - Cerca la tabella presenze (solitamente in alto o centro pagina).
         - "daysWorked": Giorni lavorati effettivi (colonna "Presenze", "Lavorati", o codice "P"). Se vuoto usa 26 ma preferisci il dato reale.
         - "daysVacation": Giorni di Ferie GODUTE nel mese (colonna "Ferie", "Godute" o "F"). NON le ferie residue, SOLO quelle prese nel mese.

      4. **VOCI VARIABILI (Il Cuore dell'analisi)**:
         Analizza la tabella centrale "Dettaglio Voci" o "Competenze".
         Cerca ESATTAMENTE i seguenti codici nella colonna "Codice" o "Voce".
         Per ogni codice trovato, estrai il valore dalla colonna **COMPETENZE** (o IMPORTO).
         
         ⚠️ **ATTENZIONE**:
         - Ignora la colonna "Trattenute".
         - Ignora la colonna "Quantità/Ore" (a meno che non sia l'unico dato numerico, ma preferisci sempre l'importo in Euro).
         - Se una voce non è presente, non includerla nel JSON (o mettila a 0).

         **LISTA CODICI DA CERCARE (Target List):**
         - "0152" (Straord. Feriale Diurno non recup)
         - "0421" (Ind. Lavoro Notturno)
         - "0470" (Ind. Chiamata Reperibilità)
         - "0482" (Compenso Reperibilità)
         - "0496" (Ind. Chiamata Disponibilità)
         - "0687" (Ind. Linea <= 10h)
         - "0AA1" (Trasferta Esente)
         - "0423" (Comp. Cantiere Notte)
         - "0576" (Ind. Orario Spezzato)
         - "0584" (Reperibilità Festive)
         - "0919" (Straordinario Feriale Diurno)
         - "0920" (Str. Festivo Diurno/Notturno)
         - "0932" (Str. Reperibilità Diurno)
         - "0933" (Str. Reperibilità Fest/Nott)
         - "0995" (Str. Disponibilità Diurno)
         - "0996" (Str. Disponibilità Fest/Nott)
         - "0376" (Ind. Turno A)
         - "0686" (Ind. Linea > 10 ore)

      5. **REGOLE FORMATTAZIONE**:
         - Converti tutti i numeri in formato decimale con il punto (es: "1.200,50" diventa 1200.50).
         - Restituisci SOLO il JSON valido, senza markdown o commenti.

      **STRUTTURA JSON RICHIESTA**:
      {
        "mese": "Stringa",
        "anno": Numero,
        "netto": Numero,
        "daysWorked": Numero,
        "daysVacation": Numero,
        "codes": {
          "0919": Numero,
          "0687": Numero,
          ...altri codici trovati...
        }
      }
    `;

        // Chiamata effettiva a Gemini
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
        const text = response.text();

        // Pulizia estrema per evitare errori di parsing JSON
        const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();

        console.log("✅ Dati estratti da Gemini:", jsonString.substring(0, 100) + "...");

        return {
            statusCode: 200,
            headers,
            body: jsonString,
        };

    } catch (error: any) {
        console.error("❌ ERRORE CRITICO BACKEND:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Errore sconosciuto nel server" }),
        };
    }
};