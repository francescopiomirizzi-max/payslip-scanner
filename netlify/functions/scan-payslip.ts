import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// --- HELPER PULIZIA E UNIONE JSON (V20 - Somma Automatica Pagine) ---
function cleanAndParseJSON(text: string): any {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Funzione interna per unire più blocchi (es. Pagina 1 + Pagina 2)
    const mergeBlocks = (blocks: any[]) => {
      if (blocks.length === 0) throw new Error("Nessun dato trovato");

      // Prende il primo blocco come base
      let finalData = { ...blocks[0] };
      finalData.codes = { ...blocks[0].codes };

      // Somma i dati delle pagine successive
      for (let i = 1; i < blocks.length; i++) {
        const nextPage = blocks[i];

        // Somma gli arretrati
        finalData.arretrati = (finalData.arretrati || 0) + (nextPage.arretrati || 0);

        // Unisce la nota eventi se presente
        if (nextPage.eventNote && !finalData.eventNote.includes(nextPage.eventNote)) {
          finalData.eventNote = finalData.eventNote ? `${finalData.eventNote} + ${nextPage.eventNote}` : nextPage.eventNote;
        }

        // Somma TUTTI i codici variabili trovati nelle altre pagine
        if (nextPage.codes) {
          for (const [key, val] of Object.entries(nextPage.codes)) {
            finalData.codes[key] = (finalData.codes[key] || 0) + (val as number);
          }
        }
      }
      return finalData;
    };

    // CASO A: L'IA ha restituito una Lista [...]
    if (clean.startsWith("[") && clean.endsWith("]")) {
      const arr = JSON.parse(clean);
      if (Array.isArray(arr)) return mergeBlocks(arr);
    }

    // CASO B: L'IA ha restituito più blocchi separati { ... } { ... }
    const jsonBlocks = [];
    let depth = 0;
    let startIndex = -1;

    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '{') {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (clean[i] === '}') {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          jsonBlocks.push(JSON.parse(clean.substring(startIndex, i + 1)));
          startIndex = -1;
        }
      }
    }

    if (jsonBlocks.length > 0) {
      return mergeBlocks(jsonBlocks); // Somma tutte le parentesi trovate!
    }

    throw new Error("Formato incomprensibile");
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
  
  ### 0. REGOLA DELLE MULTI-PAGINE
  - LEGGI TUTTO IL DOCUMENTO, incluse la seconda o terza pagina.
  - Se trovi codici, competenze o arretrati nelle pagine successive, DEVI assolutamente estrarli.
  - Puoi restituire un singolo JSON totale, oppure un Array JSON con i dati di ogni pagina separati. Il sistema li sommerà in automatico.
  
  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Cerca nella testata.
  
  ### 2. PRESENZE E FERIE (RFI)
  Cerca la riga orizzontale in alto che contiene: "Presenze | Riposi | Ferie | 26mi PTV".
  - **daysVacation**: Valore ESATTO sotto la colonna "Ferie" (la terza colonna).
    * TASSATIVO: Se lo spazio sotto "Ferie" è VUOTO o assente, scrivi 0.0.
    * TASSATIVO: Ignora "Ferie anno prec." o "Ferie anno corrente".
  - **daysWorked**: Valore sotto "Presenze". 
    * REGOLA MATEMATICA: Se (Presenze + Ferie) > 31, allora esegui (Presenze - Ferie). Altrimenti lascia il valore esatto di Presenze.
  
  ### 3. TICKET RESTAURANT (Unitario)
  - Cerca codice **0E99** o **0299** o **0293**.
  - Estrai il valore nella colonna "Dati Base" o "Parametro". 
  
  ### 4. CODICI VARIABILI (Master List RFI COMPLETA)
  Cerca e somma in TUTTE LE PAGINE la colonna "Competenze" per questi codici:
  
  - 0152 (Straord. Diurno)
  - 0421 (Ind. Notturno)
  - 0423 (Comp. Cantiere/Festivo)
  - 0457 (Festivo Notturno)
  - 0470 (Ind. Chiamata)
  - 0482 (Ind. Reperibilità)
  - 0496 (Ind. Disp. Chiamata)
  - 0687 (Ind. Linea <= 10h)
  - 0686 (Ind. Linea > 10h)
  - 0AA1 (Trasferta - Somma tutte le occorrenze)
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
  - Cerca in TUTTE le pagine importi positivi di: 3E.. (Malattia), 74.. (Arretrati), 0K../0C.. (Una Tantum), 6INT.
  - "eventNote": scrivi una breve nota (es. "Arretrati").
  
  FORMATO JSON (Esempio):
  {
    "month": 1, "year": 2024, "daysWorked": 0.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "",
    "codes": { "0152": 0.0, "0421": 0.0 }
  }
`;

// ==========================================
// 2. PROMPT ELIOR (RISTORAZIONE) - CALIBRATO SU TYPES.TS
// ==========================================
const PROMPT_ELIOR = `
  Sei un analista contabile specializzato in Buste Paga ELIOR RISTORAZIONE.
  Il documento può essere una scansione cartacea.
  
  ### 0. REGOLA DELLE MULTI-PAGINE
  - LEGGI TUTTO IL DOCUMENTO, incluse la seconda o terza pagina.
  - Se trovi codici, competenze o arretrati nelle pagine successive, DEVI assolutamente estrarli.
  - Puoi restituire un singolo JSON totale, oppure un Array JSON con i dati di ogni pagina separati. Il sistema li sommerà in automatico.
  
  ### 1. DATI BASE
  - Cerca la data (Mese/Anno) in alto a destra.
  
  ### 2. PRESENZE E FERIE (Layout Elior) - ATTENZIONE MATEMATICA!
  - Cerca la casella **"GG INPS"** in alto a sinistra (di solito è 26).
  - Cerca nella tabella centrale la voce esatta **"5000 FERIE GODUTE"** ed estrai il numero sotto la colonna **"ORE/GG/MESI"** (es. 7,60). Se non c'è, vale 0.
  - **daysVacation**: Il valore di "5000 FERIE GODUTE" (es. 7.6).
  - **daysWorked**: ESEGUI QUESTA SOTTRAZIONE: (Valore di GG INPS) meno (Valore di FERIE GODUTE). Esempio: se GG INPS = 26 e FERIE GODUTE = 7.6, scrivi 18.4.
  - TASSATIVO: NON prendere MAI i dati dal riquadretto riassuntivo in alto a sinistra (dove c'è scritto "RES. PREC", "FRUITE", "SALDO"). Ignora totalmente quel riquadro.
  
  ### 3. TICKET RESTAURANT (Unitario)
  - Cerca codici **2000** o **2001**.
  - Estrai il valore dalla colonna **"VALORE UNITARIO"** (es. 5,29 o 4,00).
  
  ### 4. MAPPATURA CODICI ELIOR (Master List)
  Scansiona le righe in TUTTE LE PAGINE. Estrai l'importo "COMPETENZE" per questi CODICI specifici:
  
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
  - Cerca in TUTTE le pagine voci testuali come "Arretrati", "Una Tantum", "Malattia", "Carenza".
  - Somma in "arretrati" e scrivi "eventNote".
  
  FORMATO JSON:
  {
    "month": 7, "year": 2024, "daysWorked": 18.4, "daysVacation": 7.6, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "",
    "codes": { "1130": 0.0, "4301": 0.0 }
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
    const { fileData, mimeType, company } = body;

    if (!fileData) throw new Error("File mancante.");
    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

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

    finalJson.company = company || 'RFI';

    console.log(`✅ EXTR ${company}: ${finalJson.month}/${finalJson.year} - Rate: ${finalJson.ticketRate}`);

    return { statusCode: 200, headers, body: JSON.stringify(finalJson) };

  } catch (error: any) {
    console.error("❌ ERRORE BACKEND:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};