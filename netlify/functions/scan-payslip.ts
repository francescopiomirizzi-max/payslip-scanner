import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- INIZIALIZZAZIONE DOPPIO MOTORE AI ---
// 1. CHIAVE PRINCIPALE (Per i calcoli matematici e l'estrazione dati)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
// 2. CHIAVE EXPLAINER (Per le spiegazioni testuali dettagliate - Usa la primaria come backup)
const genAIExplainer = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_EXPLAINER || process.env.GOOGLE_API_KEY || "");

// --- HELPER PULIZIA E UNIONE JSON (V20 - Somma Automatica Pagine) ---
function cleanAndParseJSON(text: string): any {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const mergeBlocks = (blocks: any[]) => {
      if (blocks.length === 0) throw new Error("Nessun dato trovato");
      let finalData = { ...blocks[0] };
      finalData.codes = { ...blocks[0].codes };

      if (!finalData.aiWarning) finalData.aiWarning = "Nessuna anomalia";

      for (let i = 1; i < blocks.length; i++) {
        const nextPage = blocks[i];
        finalData.arretrati = (finalData.arretrati || 0) + (nextPage.arretrati || 0);

        if (nextPage.eventNote && !finalData.eventNote.includes(nextPage.eventNote)) {
          finalData.eventNote = finalData.eventNote ? `${finalData.eventNote} + ${nextPage.eventNote}` : nextPage.eventNote;
        }

        if (nextPage.aiWarning && nextPage.aiWarning !== "Nessuna anomalia") {
          finalData.aiWarning = finalData.aiWarning === "Nessuna anomalia" ? nextPage.aiWarning : `${finalData.aiWarning} | Pagina ${i + 1}: ${nextPage.aiWarning}`;
        }

        if (nextPage.codes) {
          for (const [key, val] of Object.entries(nextPage.codes)) {
            finalData.codes[key] = (finalData.codes[key] || 0) + (val as number);
          }
        }
      }
      return finalData;
    };

    if (clean.startsWith("[") && clean.endsWith("]")) {
      const arr = JSON.parse(clean);
      if (Array.isArray(arr)) return mergeBlocks(arr);
    }

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

    if (jsonBlocks.length > 0) return mergeBlocks(jsonBlocks);

    throw new Error("Formato incomprensibile");
  } catch (error: any) {
    console.error("❌ ERRORE PARSING JSON:", text);
    throw new Error(`Output AI non valido: ${error.message}`);
  }
}

// ==========================================
// 1. PROMPT RFI
// ==========================================
const PROMPT_RFI = `
  Sei un analista contabile specializzato in Buste Paga RFI / TRENITALIA.
  Estrai i dati con precisione assoluta ignorando le migliaia (es. 1.000 = 1000).
  Usa il PUNTO (.) come separatore decimale.
  
  ### 0. REGOLA DELLE MULTI-PAGINE
  - LEGGI TUTTO IL DOCUMENTO, incluse la seconda o terza pagina.
  - Se trovi codici, competenze o arretrati nelle pagine successive, DEVI assolutamente estrarli.
  - Puoi restituire un singolo JSON totale, oppure un Array JSON. Il sistema li sommerà in automatico.
  
  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Cerca nella testata.
  
  ### 2. PRESENZE E FERIE (RFI)
  Cerca la riga orizzontale in alto: "Presenze | Riposi | Ferie | 26mi PTV".
  L'estrazione del testo a volte "collassa" le colonne se sono vuote. Segui questa logica sequenziale TASSATIVA:
  1. Il PRIMO numero (es. 22,00 o 35,00) è "Presenze".
  2. Il SECONDO numero (es. 8,00 o 20,00) è "Riposi" -> IGNORALO COMPLETAMENTE. Non assegnarlo MAI a daysVacation.
  3. Il TERZO spazio è "Ferie" -> Assegnalo a **daysVacation**. Se lo spazio sotto Ferie è vuoto, imposta daysVacation a 0.0.
  REGOLA ANTI-DISTRAZIONE: IGNORA TASSATIVAMENTE i numeri presenti a fine riga sotto le voci "Ferie anno prec." e "Ferie anno corrente".
  - **daysWorked**: TRASCRIVI ESATTAMENTE il PRIMO numero ("Presenze"). ASSOLUTAMENTE NON SOTTRARRE LE FERIE. Se c'è scritto 35, scrivi 35. 
  
  ### 3. TICKET RESTAURANT (Unitario)
  - Cerca codice **0E99** o **0299** o **0293**. Estrai il valore nella colonna "Dati Base" o "Parametro". 
  
  ### 4. CODICI VARIABILI (Master List RFI COMPLETA)
  Cerca e somma in TUTTE LE PAGINE la colonna "Competenze" per questi codici:
  
  - 0152 (Str. feriale D. non recup / Straord. Diurno) <- CERCA ATTENTAMENTE AL CENTRO DELLA PAGINA
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
  - Cerca importi positivi di: 3E.., 74.., 0K../0C.., 6INT. "eventNote": scrivi una breve nota.

  ### 6. AUDITOR AI (Controllo Anomalie)
  - "aiWarning": Controlla la logica dei numeri estratti. Se i giorni lavorati (Presenze) superano i 31 giorni, scrivi "Anomalia Conguaglio: Presenze > 31. Dati estratti letteralmente". Altrimenti scrivi ESATTAMENTE "Nessuna anomalia".
  
  FORMATO JSON (Esempio):
  {
    "month": 1, "year": 2024, "daysWorked": 35.0, "daysVacation": 6.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "codes": { "0152": 771.22, "0421": 0.0 }
  }
`;

// ==========================================
// 2. PROMPT ELIOR
// ==========================================
const PROMPT_ELIOR = `
  Sei un analista contabile specializzato in Buste Paga ELIOR RISTORAZIONE.
  
  ### 0. REGOLA DELLE MULTI-PAGINE
  - LEGGI TUTTO IL DOCUMENTO, incluse le pagine successive per sommare codici e arretrati.
  
  ### 1. DATI BASE E FERIE
  - Cerca la data (Mese/Anno) in alto a destra.
  - Cerca **"GG INPS"** in alto a sinistra (di solito è 26).
  - Cerca **"5000 FERIE GODUTE"** ed estrai il numero (es. 47,55 o 4,00). Se non c'è, vale 0.
  
- **CONVERSIONE INTELLIGENTE:** * Se il numero delle ferie è MAGGIORE DI 12: consideralo in ORE. Dividilo per 8 e MANTIENI I DECIMALI ESATTI senza arrotondare. (Esempio: 28,35 / 8 = 3.54).
    * Se il numero è MINORE O UGUALE A 12: consideralo GIÀ IN GIORNI e lascialo così com'è.
  
  - **daysVacation**: Scrivi il numero finale dei giorni di ferie.
  - **daysWorked**: Esegui SEMPRE la sottrazione (GG INPS - daysVacation).
  
  - TASSATIVO: Ignora il riquadro in alto a sinistra con "RES. PREC", "FRUITE", ecc.
  
  ### 2. TICKET RESTAURANT E CODICI ELIOR
  - Ticket: Cerca codici **2000** o **2001** in "VALORE UNITARIO".
  
  ### 3. MAPPATURA CODICI ELIOR (Master List)
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

  ### 4. ARRETRATI
  - Somma "Arretrati", "Una Tantum", "Malattia", "Carenza" in "arretrati" e scrivi in "eventNote".

  ### 5. AUDITOR AI (Controllo Anomalie)
  - "aiWarning": Controlla i numeri estratti. Segnala in modo conciso se ci sono anomalie (es. "Giorni lavorati negativi", "Importo arretrati molto alto", "Lavoro notturno ma mancano codici associati"). Se tutto è logico e coerente, scrivi ESATTAMENTE "Nessuna anomalia".
  
  FORMATO JSON:
  {
    "month": 5, "year": 2024, "daysWorked": 20.0, "daysVacation": 6.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "codes": { "1130": 0.0, "4301": 0.0 }
  }
`;

// ==========================================
// 3. PROMPT DI EMERGENZA (UNIVERSALE)
// ==========================================
const PROMPT_GENERICO = `
  Sei un esperto contabile italiano. Questa è una busta paga di formato sconosciuto.
  Estrai i dati fondamentali nel nostro formato standard.
  
  1. "month", "year", "daysWorked" (GG INPS o Presenze), "daysVacation" (se in ore dividi per 8), "ticketRate".
  2. "arretrati" e relativa "eventNote".
  3. "codes": estrai codici numerici e importi di indennità e maggiorazioni.
  4. "aiWarning": segnala eventuali incongruenze o scrivi "Nessuna anomalia".
  
  FORMATO JSON TASSATIVO:
  {
    "month": 1, "year": 2024, "daysWorked": 26.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "codes": { "ESEMPIO": 0.0 }
  }
`;

// ==========================================
// LA CABINA DI REGIA
// ==========================================
const PROMPT_DIRECTORY: Record<string, string> = {
  "RFI": PROMPT_RFI,
  "ELIOR": PROMPT_ELIOR
};

export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

  try {
    const body = JSON.parse(event.body || "{}");

    // 👇 Ora estraiamo anche l'azione per sapere se dobbiamo Spiegare o Calcolare
    const { fileData, mimeType, company, action } = body;

    if (!fileData) throw new Error("File mancante.");
    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // =========================================================================
    // 🧠 NUOVA MODALITÀ: AUDITOR LEGALE (SPIEGAZIONE DISCORSIVA)
    // =========================================================================
    if (action === 'explain') {
      const modelExplainer = genAIExplainer.getGenerativeModel({ model: "gemini-2.5-flash" });

      const explainPrompt = `
        Sei un Senior HR e Consulente del Lavoro di altissimo livello. 
        Il tuo compito è tradurre questa complessa busta paga in un report discorsivo, rassicurante e cristallino per un lavoratore che non ha competenze contabili.
        
        Regole di stile TASSATIVE:
        - Usa il "Tu" diretto e un tono empatico e professionale.
        - Usa esattamente la formattazione Markdown richiesta qui sotto (con le emoji).
        - NON restituire mai codice JSON.
        - Non elencare le voci a 0 euro. Concentrati solo su quelle rilevanti.
        
        Struttura il tuo report esattamente in questo ordine:
        
        ### 🗓️ Sintesi del Mese
        - Saluta il lavoratore (se trovi il suo nome).
        - Indica il Mese, l'Anno e l'Azienda.
        - Indica in grassetto il **Netto in Busta** (la cifra finale che gli è entrata in tasca).
        
        ### ⏱️ Presenze e Anomalie Storiche
        - Indica i giorni lavorati e le ferie godute.
        - **REGOLA SALVAVITA (CONGUAGLI):** Se noti numeri sballati come "35 giorni lavorati" (tipico in RFI nel 2009 o anni simili), NON dire che c'è un errore! Rassicura subito il lavoratore spiegando che è un noto "conguaglio per il passaggio alla retribuzione mensile", che ha causato il pagamento di due mensilità arretrate in una sola busta.
        
        ### 💶 I tuoi Guadagni (Le Competenze)
        Elenca le 4-5 voci positive più alte (es. Paga Base, Straordinari, Notturni, Codice 0152, Arretrati). 
        Per ogni voce usa questo formato:
        - **[Nome Voce] (€ X,XX):** Spiega in mezza riga e in parole semplicissime cosa significa questa voce. Se vedi il Ticket Restaurant, menzionalo.
        
        ### 📉 Cosa ti hanno trattenuto (Tasse e Contributi)
        Spiega in modo riassuntivo le 2-3 trattenute principali (es. "IRPEF: sono le normali tasse sul reddito", "INPS: i tuoi contributi pensionistici", o eventuali trattenute sindacali se presenti).
        
        Concludi con una brevissima e calorosa frase di chiusura.
      `;

      console.log(`--- 🤖 AVVIO SPIEGAZIONE AI (EXPLAINER) ---`);

      const result = await modelExplainer.generateContent([
        explainPrompt,
        { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
      ]);

      return { statusCode: 200, headers, body: JSON.stringify({ explanation: result.response.text() }) };
    }

    // =========================================================================
    // 🧮 MODALITÀ CLASSICA: ESTRAZIONE DATI PER LA GRIGLIA (JSON)
    // =========================================================================
    const companyKey = (company || 'RFI').toUpperCase();
    const targetPrompt = PROMPT_DIRECTORY[companyKey] || PROMPT_GENERICO;

    console.log(`--- 🚀 AVVIO ANALISI NUMERICA PER: ${companyKey} ---`);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.0 }
    });

    const result = await model.generateContent([
      targetPrompt,
      { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
    ]);

    const finalJson = cleanAndParseJSON(await result.response.text());
    finalJson.company = companyKey;

    console.log(`✅ EXTR ${companyKey}: ${finalJson.month}/${finalJson.year} - Warning: ${finalJson.aiWarning}`);

    return { statusCode: 200, headers, body: JSON.stringify(finalJson) };

  } catch (error: any) {
    console.error("❌ ERRORE BACKEND:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};