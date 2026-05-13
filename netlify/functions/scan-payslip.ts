import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// --- INIZIALIZZAZIONE DOPPIO MOTORE AI ---
// 1. CHIAVE PRINCIPALE E TFR (Ora usa la chiave TFR dedicata, se non la trova usa quella base)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_TFR || process.env.GOOGLE_API_KEY || "");
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
// 1. PROMPT RFI (PLATINUM EDITION - VERSIONE FINALE CON FIX RIPOSI)
// ==========================================
const PROMPT_RFI = `
  Sei un estrattore dati deterministico specializzato in Buste Paga RFI / TRENITALIA.
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile. 
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 1.000,50 diventa 1000.50). Usa sempre e solo il PUNTO (.) come separatore decimale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0", "I" al posto di "1"). Usa le descrizioni testuali tra parentesi come conferma infallibile se il codice numerico risulta sporco o illeggibile.
  
  ### 0. REGOLA DELLE MULTI-PAGINE (CRITICA)
  Il documento contiene più pagine. La tabella centrale "Cod. Voce | Descrizione | Competenze | Trattenute" continua fisicamente sulle pagine 2, 3, ecc.
  DEVI analizzare l'intero documento riga per riga, dalla prima all'ultima pagina. Chi si ferma alla prima pagina fallisce il task in modo irreversibile.
  
  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Identificali dalla testata del cedolino.
  
 ### 2. PRESENZE E FERIE (RFI) - REGOLA DELL'INCOLONNAMENTO (CRITICA)
  La tabella in alto ha questa intestazione esatta: "Presenze | Riposi | Ferie | 26mi PTV | Malattie | Infortuni ... | Ferie anno prec. | Ferie anno corrente".
  I dati si trovano nella riga sottostante. Applica questa logica TASSATIVA:
  
  - **daysWorked (Giorni Lavorati):** Guarda ESATTAMENTE sotto l'intestazione "Presenze" (è la primissima colonna a sinistra).
    [REGOLA DELLA CELLA VUOTA]: Se la colonna "Presenze" è vuota o contiene spazi, DEVI RESTITUIRE 0. NON cercare il "primo numero disponibile" spostandoti a destra.
    [DIVIETO ASSOLUTO]: È SEVERAMENTE VIETATO assegnare ai giorni lavorati i numeri presenti sotto le colonne "Malattie" o "Infortuni". (Es. se c'è 31 sotto Malattie, daysWorked è 0).
    [DIVIETO APA]: Non estrarre MAI il numero "7" se è vicino alla scritta "N° A.P.A.".
  
  - **daysVacation (Ferie godute nel mese):** Guarda ESATTAMENTE la colonna sotto l'intestazione "Ferie".
    [ANTI-SCIVOLAMENTO OCR - REGOLA SALVAVITA]: Spesso la colonna Ferie è vuota e l'OCR "unisce" i numeri. Se sotto la riga delle intestazioni leggi una sequenza come "16,00  12,00  0,00", significa che 16,00 sono le Presenze, 12,00 sono i RIPOSI, le Ferie sono ASSENTI (quindi 0), e 0,00 è 26mi PTV. 
    È SEVERAMENTE VIETATO assegnare il valore dei Riposi (che si aggira spesso tra 8,00 e 12,00) a daysVacation. Se la cella è vuota o fusa, DEVI restituire 0.
    [DIVIETO RESIDUI]: È SEVERAMENTE VIETATO pescare numeri alla fine della riga (es. 25,00 o 3,00) perché appartengono a "Ferie anno prec./corrente". Estrai SOLO le ferie del mese.
  
 ### 3. TICKET RESTAURANT (Codici 0E99 / 0299 / 0293)
  - Cerca questi codici in TUTTE le pagine. 
  - Estrai ESATTAMENTE il valore dalla colonna "Aliquota" (es. 5.29, 7.00). 
  - IGNORA TASSATIVAMENTE la colonna "Parametro". Se non trovi il codice, restituisci 0.0.
  
  ### 4. CODICI VARIABILI (MASTER LIST) E SFASAMENTO TEMPORALE
  [SFASAMENTO]: Nel settore ferroviario le indennità sono pagate il mese successivo. È perfettamente NORMALE avere daysWorked=0 ma incassare indennità > 0. Non "inventare" giorni di presenza per giustificare gli importi.
  
  Cerca i seguenti codici in TUTTE le pagine, estraendo il valore ESCLUSIVAMENTE dalla colonna "Competenze" (importi positivi).
  REGOLA D'ORO: Il JSON finale DEVE contenere TUTTE le chiavi elencate qui sotto. Se un codice non è presente nella busta paga, il suo valore DEVE essere 0.0. Non omettere mai nessuna chiave.
  
  - 0152 (Str. feriale D. non recup / Straord. Diurno)
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
 
  ### 5. ARRETRATI E NOTE
  - "arretrati": Somma SOLO gli importi POSITIVI (situati nella colonna Competenze) delle seguenti voci: 3E10, 3E16, Indennità INPS, codici che iniziano per 0K.., 74.., 6INT, 3105. IGNORA categoricamente la colonna Trattenute.
  - "eventNote": Se rilevi codici di malattia (es. 3E.., Indennità INPS) o giorni segnati sotto la colonna "Malattie", scrivi la stringa "[Malattia/Carenza]". Altrimenti lascia una stringa vuota "".

  ### 6. AUDITOR AI
  - "aiWarning": 
    * Se daysWorked > 31 -> "Anomalia: Presenze > 31"
    * Se daysWorked = 0 ma ci sono importi variabili > 0 -> "Nessuna anomalia (Conguaglio mese prec.)"
    * In tutti gli altri casi -> "Nessuna anomalia"
  
  ### 7. TFR E FONDO PREGRESSO (⚠️ REGOLA CRITICA DEL MESE DI DICEMBRE E GRANDEZZA NUMERI ⚠️)
  - "fondo_pregresso_31_12": Cerca la tabella in basso intitolata 'TFR'. Estrai il valore sotto 'TFR al 31.12 A.P.' (TFR anno precedente). Formato numero (es. 2938.55). Se non c'è, scrivi 0.0.
  - "imponibile_tfr_mensile": [DIVIETO ASSOLUTO] Cerca il riquadro TFR SOLO se la busta paga è di DICEMBRE (Mese 12) o c'è scritto "Cessazione"/"Fine Rapporto". Estrai ESCLUSIVAMENTE il valore della riga "Imponibile" (che è una cifra alta, solitamente tra 20.000 e 40.000). È SEVERAMENTE VIETATO estrarre il valore della riga "Accantonamento" o "Quota" (che è molto più basso, solitamente sui 2.000). Per tutti i mesi da Gennaio a Novembre, restituisci SEMPRE E TASSATIVAMENTE 0.0, ignorando completamente il riquadro.

  ### 8. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se il documento NON è una busta paga ma riporta diciture come "CERTIFICAZIONE UNICA" o "CUD":
  1. Imposta la chiave "isCUD": true.
  2. Imposta "month": 12.
  3. Cerca la sezione "TFR" o "Trattamento di Fine Rapporto".
  4. Estrai in "imponibile_tfr_mensile" il valore totale dell'imponibile TFR dell'intero anno.
  5. Estrai in "fondo_pregresso_31_12" il TFR maturato fino al 31/12 dell'anno precedente.
  6. Imposta tutti gli altri codici, giorni lavorati e ferie a 0.0 (se non chiaramente indicati).

  ### 9. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo. 
  È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`. 
  
  Esempio di output perfetto:
  {
    "isCUD": false, "month": 3, "year": 2019, "daysWorked": 18.0, "daysVacation": 1.0, "ticketRate": 7.0, "arretrati": 158.12, "eventNote": "[Malattia/Carenza]", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 2938.55, "imponibile_tfr_mensile": 2107.91,
    "codes": {
      "0152": 576.06, "0421": 0.0, "0423": 0.0, "0457": 140.00, "0470": 0.0, "0482": 0.0, "0496": 0.0, "0687": 0.0, "0686": 0.0, "0AA1": 0.0, "0576": 0.0, "0584": 64.00, "0919": 0.0, "0920": 0.0, "0932": 0.0, "0933": 0.0, "0995": 0.0, "0996": 0.0, "0376": 0.0
    }
  }
`;
export const getEliorPrompt = (eliorType = 'viaggiante') => {
  const isMagazzino = eliorType === 'magazzino';

  const codiciRicerca = isMagazzino
    ? `- 1130 (Lav. Nott. / Magg. Notturna)
  - 1131 (Lav. Domenicale)
  - 2018, 2035 (Straordinari)
  - 2235 (Maggiorazione 35%)
  - 4133 (Funz. Diverse)
  - 2313 (Ind. Cella)
  - 4275 (Ind. Sottosuolo)
  - 4285 (26/MI Retribuzione)`
    : `- 1126 (Ind. Cassa)
  - 1130 (Lav. Nott. / Magg. Notturna)
  - 1131 (Lav. Domenicale)
  - 2018, 2020, 2035 (Straordinari)
  - 2235 (Maggiorazione 35%)
  - 4133 (Funz. Diverse)
  - 4254 (RFR Pasti < 8h)
  - 4255, 4256 (Pernottamento / Pernottazione)
  - 4300, 4305 (Ass. Res. No RS / RS)
  - 4301 (Fuori Sede / Trasferta)
  - 4320 (Diaria Scorta)
  - 4325, 4330 (Flex Oraria / Residenza)
  - 4345 (Riserva Pres.)
  - 5655 (26/MI Retribuzione)`;

  const codiciTicket = isMagazzino
    ? `- Individua la riga col codice 0293 (Buono pasto per giornate di ferie). Estrai ESATTAMENTE il numero presente nella colonna "Valore Unitario" o "Base/Dato" (es. 5.20, 6.00, 7.00). IGNORA i totali finali. Mettilo nella variabile ticketRate.`
    : `- Individua la riga col codice 2000 o 2001. Estrai ESATTAMENTE il numero presente nella colonna "Valore Unitario" o "Base/Dato" (es. 5.20, 6.00, 7.00). IGNORA i totali finali. Mettilo nella variabile ticketRate.`;

  return `
  Sei un estrattore dati deterministico specializzato in Buste Paga ELIOR RISTORAZIONE (${eliorType.toUpperCase()}).
  Attenzione: I documenti in input sono FOTOGRAFIE DI DOCUMENTI CARTACEI. Applica la massima tolleranza per i disallineamenti OCR.
  
  [REGOLE SUI NUMERI CRITICHE - PER EVITARE CRASH DI SISTEMA]: 
  - Nel JSON finale, TUTTI i numeri DEVONO usare ESCLUSIVAMENTE il PUNTO (.) decimale. MAI la virgola.
  - Se leggi una virgola (es. "84,48"), DEVI convertirla in punto (84.48) PRIMA di fare qualsiasi operazione.
  - Ignora i punti delle migliaia.

  ### 0. REGOLA D'ORO: MULTI-PAGINA E SOMMATORIA
  - Il documento ha spesso più pagine. Analizzale TUTTE dalla prima all'ultima.
  - Se lo stesso CODICE NUMERICO appare più volte su righe diverse, DEVI SOMMARE gli importi della colonna "Competenze" (o "Importo").

  ### 1. PERIODO E CALCOLO GIORNI
  - **month/year:** Estrai mese e anno in alto a destra.
  - **GG INPS:** Cerca "GG INPS" nel riquadro in alto a sinistra (sotto SETT.INPS e sopra Ferie). Spesso è 26.
  
  - **daysVacation (FERIE - Codice 5000):** Cerca TASSATIVAMENTE la riga "5000 FERIE GODUTE" nel corpo centrale.
    * ATTENZIONE AI MULTIPLI: Se sulla riga ci sono più numeri (es. "1,00" e "11,37"), DEVI ESTRARRE SEMPRE IL NUMERO PIÙ ALTO sotto la colonna "ORE/GG/MESI".
    * Se il numero estratto è > 12 (es. 19,20 o 11,37): convertilo in decimale col punto. Sono ORE. DEVI DIVIDERLO PER 8 (es: 11.37 / 8 = 1.42) e arrotondare a due decimali. Questo è il valore calcolato delle ferie.
    * Se il numero estratto è <= 12: consideralo GIÀ IN GIORNI e lascialo così.
    * Se la riga 5000 NON c'è, il valore è 0.0.
  
  - **daysWorked (Giorni Lavorati):** DEVI calcolare questo valore matematicamente:
    [Valore estratto di GG INPS] Meno [Valore finale calcolato di daysVacation].
    (Esempio: Se GG INPS è 26 e daysVacation è 1.42, daysWorked = 24.58).

  ### 2. TICKET RESTAURANT
  ${codiciTicket}

  ### 3. MAPPATURA CODICI SPECIFICI (Solo colonna COMPETENZE)
  Cerca l'intero documento e somma gli importi POSITIVI della colonna "COMPETENZE" per questi codici:
  ${codiciRicerca}

  ### 4. MALATTIA, SCIOPERO E ARRETRATI (CRITICO)
  - Se trovi i codici 2600, 2650, 3100, 3150, 3232, 3262 (Integrazioni o Trattenute Assenza/Malattia), aggiungi "[Malattia/Assenza]" in "eventNote".
  - Se trovi il codice 1931 (Ore Sciopero), aggiungi "[Sciopero]" in "eventNote".
  - Somma "Arretrati", "Una Tantum", "Conguagli" in "arretrati".

  ### 5. ESEMPI DI RISOLUZIONE OCR (FEW-SHOT LEARNING)
  CASO A - Ferie in Ore con più numeri sulla riga:
  Letto: "5000 FERIE GODUTE      1,00   19,20   0.00" e "GG INPS 26"
  Analisi: Il numero più alto è 19.20. Essendo > 12, faccio 19.20 diviso 8 = 2.4. Scrivo "daysVacation": 2.4. Calcolo: 26 - 2.4 = 23.6. Scrivo "daysWorked": 23.6.

  CASO B - Ferie Alte in Ore:
  Letto: "5000 FERIE GODUTE      0.00   11,37   0.00" e "GG INPS 26"
  Analisi: Il numero più alto è 11.37. Essendo > 12 -> 11.37 / 8 = 1.42. "daysVacation": 1.42. Calcolo: 26 - 1.42 = 24.58. "daysWorked": 24.58.

  CASO C - Ferie in Giorni:
  Letto: "5000 FERIE GODUTE      0.00   4,00   0.00" e "GG INPS 26"
  Analisi: 4.00 <= 12 -> lascio 4.00. "daysVacation": 4.00. Calcolo 26 - 4 = 22.0. "daysWorked": 22.00.

  CASO D - Ferie ASSENTI (MOLTO IMPORTANTE):
  Letto: Leggo tutte le righe ma la riga 5000 non c'è. Letto "GG INPS 26".
  Analisi: Non c'è il codice. Imposto tassativamente "daysVacation": 0.00. "daysWorked": 26.00.

  CASO E - Ticket e Quantità:
  Letto: "2000 TICKET PERS VIAGGIANTE   5,20   9,00"
  Analisi: 9.00 è la quantità (IGNORARE). Il ticketRate è 5.20.

  CASO F - Malattia/Assenza:
  Letto: "3262 PD1:TRATTENUTA ASSENZA   72,17   3,00"
  Analisi: Codice di assenza presente. Scrivo "[Malattia/Assenza]" in eventNote.

 ### 6. TFR E FONDO PREGRESSO (⚠️ REGOLA CRITICA DEL MESE DI DICEMBRE E GRANDEZZA NUMERI ⚠️)
  - "fondo_pregresso_31_12": Cerca "Fondo TFR al 31/12", "F.do TFR AP". Estrai il valore numerico. Se assente, 0.0.
  - "imponibile_tfr_mensile": [DIVIETO ASSOLUTO] Cerca il riquadro TFR SOLO se la busta paga è di DICEMBRE (Mese 12) o c'è scritto "Cessazione"/"Fine Rapporto". Estrai ESCLUSIVAMENTE il valore della riga "Imponibile" (che è una cifra alta, solitamente tra 15.000 e 35.000). È SEVERAMENTE VIETATO estrarre il valore della riga "Accantonamento" o "Quota" (che è molto più basso, solitamente sui 1.500-2.000). Per tutti i mesi da Gennaio a Novembre, restituisci SEMPRE E TASSATIVAMENTE 0.0, ignorando completamente il riquadro.

  ### 7. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se il documento si intitola "CERTIFICAZIONE UNICA" o "CUD":
  - Imposta "isCUD": true e "month": 12.
  - Cerca il riquadro del TFR.
  - Inserisci in "imponibile_tfr_mensile" il totale dell'imponibile TFR annuale.
  - Inserisci in "fondo_pregresso_31_12" il fondo maturato negli anni precedenti.

  ### FORMATO OUTPUT JSON STRICT
  Restituisci ESCLUSIVAMENTE un JSON crudo, valido e senza testo extra. Assicurati che TUTTI i numeri usino il PUNTO (.) e NON la virgola.
  {
    "isCUD": false,
    "month": 1,
    "year": 2022,
    "daysWorked": 24.58,
    "daysVacation": 1.42,
    "ticketRate": 5.20,
    "arretrati": 0.00,
    "eventNote": "",
    "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 1500.50,
    "imponibile_tfr_mensile": 1850.00,
    "codes": {
      "1130": 0.0,
      "4301": 0.0
    }
  }
  `;
}
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
  "RFI": PROMPT_RFI
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

    // 👇 Ora estraiamo anche customColumns per il Motore Mutaforma
    const { fileData, mimeType, company, action, customColumns, eliorType } = body;

    if (!fileData) throw new Error("File mancante.");
    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // =========================================================================
    // 🎯 MODALITÀ OCR SNIPER: estrae UN singolo valore numerico per una voce specifica
    // =========================================================================
    if (action === 'ocr') {
      const { colLabel } = body;
      if (!colLabel) throw new Error("Parametro colLabel mancante.");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { temperature: 0.0 } });
      const prompt = `Sei un estrattore dati preciso specializzato in buste paga italiane.
Analizza questo documento e restituisci SOLO il valore numerico per: "${colLabel}".
REGOLE ASSOLUTE:
- Rispondi con UN SOLO numero (es. 576.06 oppure 18 oppure 7.50).
- Usa il PUNTO come separatore decimale, MAI la virgola.
- Se il valore non è presente o è zero, restituisci esattamente: 0
- NON aggiungere testo, simboli €, unità di misura, spiegazioni o markdown.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
      ]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ value: result.response.text().trim() })
      };
    }

    // =========================================================================
    // 🧠 NUOVA MODALITÀ: AUDITOR LEGALE (SPIEGAZIONE DISCORSIVA CON GEMINI 3.1 PRO)
    // =========================================================================
    if (action === 'explain') {
      // ECCO LA MODIFICA! L'Avvocato adesso usa la massima potenza di logica!
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

      console.log(`--- 🤖 AVVIO SPIEGAZIONE AI (EXPLAINER: Gemini 3.1 Pro) ---`);

      const result = await modelExplainer.generateContent([
        explainPrompt,
        { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
      ]);

      return { statusCode: 200, headers, body: JSON.stringify({ explanation: result.response.text() }) };
    }

    // =========================================================================
    // 🧮 MODALITÀ CLASSICA: ESTRAZIONE DATI PER LA GRIGLIA (JSON VELOCE)
    // =========================================================================
    const companyKey = (company || 'RFI').toUpperCase();

    let targetPrompt = "";

    // IL MOTORE MUTAFORMA: Se il frontend ci passa le colonne create nel Company Builder,
    // creiamo un prompt perfetto, su misura, in tempo reale!
    if (customColumns && customColumns.length > 0) {
      // Crea la lista dei codici da cercare (Es: "- 1050 (Ind. Notturna)")
      const codeList = customColumns.map((c: any) => `- ${c.id} (${c.label})`).join('\n  ');
      // Crea lo scheletro del JSON atteso (Es: "1050": 0.0)
      const jsonStructure = customColumns.map((c: any) => `"${c.id}": 0.0`).join(', ');

      targetPrompt = `
  Sei un analista contabile esperto. Questa è una busta paga dell'azienda: ${companyKey}.
  
  ### 1. DATI BASE E TFR
  Estrai "month", "year", "daysWorked" (Giorni lavorati/Presenze), "daysVacation" (Ferie godute), e "ticketRate" (valore unitario del buono pasto).
  Estrai anche "fondo_pregresso_31_12" (il fondo TFR accantonato negli anni precedenti) e "imponibile_tfr_mensile" (la quota di retribuzione utile al TFR per questo mese). Se non li trovi, imposta 0.0.
  
  ### 2. ARRETRATI E NOTE
  Somma le voci di "arretrati" e scrivi una "eventNote" se rilevi assenze particolari (es. "[Malattia]").
  
  ### 3. MAPPATURA CODICI PERSONALIZZATI (FONDAMENTALE)
  Cerca ESATTAMENTE questi codici nella colonna delle Competenze/Importi:
  ${codeList}

  ### 4. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se leggi che il documento è una "CERTIFICAZIONE UNICA" o "CUD", imposta "isCUD": true e "month": 12. Estrai il TFR pregresso totale e l'imponibile TFR annuo. Tutti gli altri valori a 0.

  ### FORMATO JSON TASSATIVO (NIENTE MARKDOWN):
  {
    "isCUD": false, "month": 1, "year": 2024, "daysWorked": 20.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 0.0, "imponibile_tfr_mensile": 0.0,
    "codes": { ${jsonStructure} }
  }
      `;
    } else {
      // Se non ci sono colonne custom, usa i prompt di sistema
      if (companyKey === 'ELIOR') {
        // 🔥 MAGIA: Chiamiamo la funzione dinamica passandole il parametro!
        targetPrompt = getEliorPrompt(eliorType);
      } else {
        targetPrompt = PROMPT_DIRECTORY[companyKey] || PROMPT_GENERICO;
      }
    }

    console.log(`--- 🚀 AVVIO ANALISI NUMERICA PER: ${companyKey} ---`);
    if (customColumns && customColumns.length > 0) console.log(`🧠 Attivato Prompt Mutaforma con ${customColumns.length} codici personalizzati.`);

    // Per l'estrazione JSON teniamo il modello veloce (Flash) per processare 12 buste paga in pochi secondi
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.0 },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        }
      ]
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
    // 1. Stampiamo l'errore intero nella console del server
    console.error("❌ ERRORE BACKEND CRITICO:", error);

    // 2. FORZIAMO il server a mandare al telefono il VERO motivo del crash
    return {
      statusCode: 500, // Continua a dare 500
      headers,
      body: JSON.stringify({
        error: error.message || "Errore sconosciuto",
        dettagli: error.stack // Questo ci dirà la riga esatta in cui è morto!
      })
    };
  }
};