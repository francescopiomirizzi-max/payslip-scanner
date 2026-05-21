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

// --- RETRY CON TIMEOUT PER LE CHIAMATE GEMINI ---
// La latenza dell'API Gemini è molto variabile (osservato 13s vs 249s sullo stesso file:
// throttling/sovraccarico lato Google). Un tentativo lento viene abortito al timeout e
// ritentato: il retry è quasi sempre veloce. Evita che la Function vada in timeout secco.
async function generateContentWithRetry(
  model: any,
  parts: any,
  attempts = 3,
  perAttemptMs = 16000
): Promise<any> {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await model.generateContent(parts, { timeout: perAttemptMs });
    } catch (err: any) {
      lastErr = err;
      console.warn(`⏳ Tentativo Gemini ${i}/${attempts} non riuscito (${err?.message || err})`);
    }
  }
  throw new Error(
    `Servizio AI non disponibile dopo ${attempts} tentativi (Gemini lento o sovraccarico). Riprova tra poco. [${lastErr?.message || lastErr}]`
  );
}

// ==========================================
// 1. PROMPT RFI (PLATINUM EDITION - VERSIONE FINALE CON FIX RIPOSI)
// ==========================================
const PROMPT_RFI = `
  Sei un estrattore dati deterministico specializzato in Buste Paga RFI.
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile. 
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 1.000,50 diventa 1000.50). Usa sempre e solo il PUNTO (.) come separatore decimale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0", "I" al posto di "1"). Usa le descrizioni testuali tra parentesi come conferma infallibile se il codice numerico risulta sporco o illeggibile.
  
  ### 0. REGOLA DELLE MULTI-PAGINE (CRITICA)
  Il documento contiene più pagine. La tabella centrale "Cod. Voce | Descrizione | Competenze | Trattenute" continua fisicamente sulle pagine 2, 3, ecc.
  DEVI analizzare l'intero documento riga per riga, dalla prima all'ultima pagina. Chi si ferma alla prima pagina fallisce il task in modo irreversibile.
  
  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Identificali dalla testata del cedolino.
  
 ### 2. PRESENZE, RIPOSI E FERIE (RFI) — ALGORITMO ANTI-CONFUSIONE (CRITICO)
  La tabella in alto ha 10 colonne in quest'ordine ESATTO:
  "Presenze | Riposi | Ferie | 26mi PTV | Malattie | Infortuni | Assenze retribuite | Assenze non retribuite | Ferie anno prec. | Ferie anno corrente".
  I dati sono nella riga immediatamente sotto le intestazioni.

  ⚠️ ERRORE PIÙ FREQUENTE E GRAVE: scambiare i RIPOSI per i giorni lavorati (daysWorked).
  Quando la colonna "Presenze" è VUOTA l'OCR produce una sequenza di numeri che PARTE da
  "Riposi": il primo numero NON è daysWorked.
  - Esempio reale (Marzo, 31 giorni): riga "9,00  22,00  0,00" con "Presenze" VUOTA significa
    Presenze = 0, RIPOSI = 9, FERIE = 22, 26mi PTV = 0  →  daysWorked = 0, daysVacation = 22.
  - Esempio opposto: riga "16,00  12,00  0,00" con "Presenze" VALORIZZATA significa
    Presenze = 16, RIPOSI = 12, FERIE = 0, 26mi PTV = 0  →  daysWorked = 16, daysVacation = 0.

  ESEGUI SEMPRE QUESTO ALGORITMO, nell'ordine:
  1. RIPOSI (2ª colonna): per un dipendente a tempo pieno i riposi settimanali sono SEMPRE
     presenti, tipicamente tra 4 e 13. RIPOSI = 0 è praticamente IMPOSSIBILE. Individua quale
     numero è Riposi: quel numero NON finirà MAI in daysWorked né in daysVacation.
  2. daysWorked = SOLO il numero fisicamente incolonnato sotto "Presenze" (1ª colonna).
     [REGOLA DELLA CELLA VUOTA]: se sotto "Presenze" non c'è alcun numero, daysWorked = 0.
     NON prendere "il primo numero disponibile" spostandoti a destra: se il primo numero è
     incolonnato sotto "Riposi", allora daysWorked = 0.
  3. daysVacation = SOLO il numero sotto "Ferie" (3ª colonna). Cella vuota → 0.
  4. daysPaidLeave = SOLO il numero sotto "Assenze retribuite" (7ª colonna, dopo "Infortuni"
     e prima di "Assenze non retribuite"): permessi/distacco sindacale, congedi e simili.
     Cella vuota → 0.
  5. 26mi PTV (4ª colonna) è quasi sempre 0,00: non è né presenze né ferie né riposi.
  6. CONTROLLO DI QUADRATURA (obbligatorio): Presenze + Riposi + Ferie + 26mi PTV + Malattie
     + Infortuni + Assenze retribuite + Assenze non retribuite ≈ giorni del mese (28-31).
     ⚠️ La somma da sola NON basta a disambiguare: "9 Presenze + 0 Riposi + 22 Ferie" e
     "0 Presenze + 9 Riposi + 22 Ferie" fanno entrambe 31. Il discriminante è il punto 1:
     se la tua lettura porta a RIPOSI = 0, è SBAGLIATA — il numero che hai messo in
     daysWorked è in realtà RIPOSI, quindi daysWorked = 0. Ricomincia dal punto 1.

  [DIVIETO ASSOLUTO]: è SEVERAMENTE VIETATO mettere in daysWorked un numero incolonnato
  sotto "Riposi", "Malattie", "Infortuni", "Ferie anno prec." o "Ferie anno corrente"
  (es. se c'è 31 sotto "Malattie", daysWorked = 0).
  [DIVIETO RESIDUI FERIE]: per daysVacation non pescare le ultime due colonne "Ferie anno
  prec./corrente": estrai SOLO le ferie del mese (3ª colonna).
  [DIVIETO APA]: non estrarre MAI il numero accanto alla scritta "N° A.P.A." (es. il "7").

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
    "isCUD": false, "month": 3, "year": 2019, "daysWorked": 18.0, "daysVacation": 1.0, "daysPaidLeave": 0.0, "ticketRate": 7.0, "arretrati": 158.12, "eventNote": "[Malattia/Carenza]", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 2938.55, "imponibile_tfr_mensile": 2107.91,
    "codes": {
      "0152": 576.06, "0421": 0.0, "0423": 0.0, "0457": 140.00, "0470": 0.0, "0482": 0.0, "0496": 0.0, "0687": 0.0, "0686": 0.0, "0AA1": 0.0, "0576": 0.0, "0584": 64.00, "0919": 0.0, "0920": 0.0, "0932": 0.0, "0933": 0.0, "0995": 0.0, "0996": 0.0, "0376": 0.0
    }
  }
`;
// ==========================================
// 1-bis. PROMPT TRENITALIA (Baseline = clone integrale RFI: stessa struttura SAP/Zucchetti)
// La Master List dei codici è la stessa di RFI finché non avremo i codici "personale viaggiante"
// (es. indennità di condotta). Mantiene tutte le regole anti-scivolamento, TFR dicembre, arretrati.
// ==========================================
const PROMPT_TRENITALIA = `
  Sei un estrattore dati deterministico specializzato in Buste Paga TRENITALIA.
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile.
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 1.000,50 diventa 1000.50). Usa sempre e solo il PUNTO (.) come separatore decimale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0", "I" al posto di "1"). Usa le descrizioni testuali tra parentesi come conferma infallibile se il codice numerico risulta sporco o illeggibile.

  ### 0. REGOLA DELLE MULTI-PAGINE (CRITICA)
  Il documento contiene più pagine. La tabella centrale "Cod. Voce | Descrizione | Competenze | Trattenute" continua fisicamente sulle pagine 2, 3, ecc.
  DEVI analizzare l'intero documento riga per riga, dalla prima all'ultima pagina. Chi si ferma alla prima pagina fallisce il task in modo irreversibile.

  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre). Identificali dalla testata del cedolino.

 ### 2. PRESENZE, RIPOSI E FERIE (TRENITALIA) — ALGORITMO ANTI-CONFUSIONE (CRITICO)
  La tabella in alto ha 10 colonne in quest'ordine ESATTO:
  "Presenze | Riposi | Ferie | 26mi PTV | Malattie | Infortuni | Assenze retribuite | Assenze non retribuite | Ferie anno prec. | Ferie anno corrente".
  I dati sono nella riga immediatamente sotto le intestazioni.

  ⚠️ ERRORE PIÙ FREQUENTE E GRAVE: scambiare i RIPOSI per i giorni lavorati (daysWorked).
  Quando la colonna "Presenze" è VUOTA l'OCR produce una sequenza di numeri che PARTE da
  "Riposi": il primo numero NON è daysWorked.
  - Esempio reale (Marzo, 31 giorni): riga "9,00  22,00  0,00" con "Presenze" VUOTA significa
    Presenze = 0, RIPOSI = 9, FERIE = 22, 26mi PTV = 0  →  daysWorked = 0, daysVacation = 22.
  - Esempio opposto: riga "16,00  12,00  0,00" con "Presenze" VALORIZZATA significa
    Presenze = 16, RIPOSI = 12, FERIE = 0, 26mi PTV = 0  →  daysWorked = 16, daysVacation = 0.

  ESEGUI SEMPRE QUESTO ALGORITMO, nell'ordine:
  1. RIPOSI (2ª colonna): per un dipendente a tempo pieno i riposi settimanali sono SEMPRE
     presenti, tipicamente tra 4 e 13. RIPOSI = 0 è praticamente IMPOSSIBILE. Individua quale
     numero è Riposi: quel numero NON finirà MAI in daysWorked né in daysVacation.
  2. daysWorked = SOLO il numero fisicamente incolonnato sotto "Presenze" (1ª colonna).
     [REGOLA DELLA CELLA VUOTA]: se sotto "Presenze" non c'è alcun numero, daysWorked = 0.
     NON prendere "il primo numero disponibile" spostandoti a destra: se il primo numero è
     incolonnato sotto "Riposi", allora daysWorked = 0.
  3. daysVacation = SOLO il numero sotto "Ferie" (3ª colonna). Cella vuota → 0.
  4. daysPaidLeave = SOLO il numero sotto "Assenze retribuite" (7ª colonna, dopo "Infortuni"
     e prima di "Assenze non retribuite"): permessi/distacco sindacale, congedi e simili.
     Cella vuota → 0.
  5. 26mi PTV (4ª colonna) è quasi sempre 0,00: non è né presenze né ferie né riposi.
  6. CONTROLLO DI QUADRATURA (obbligatorio): Presenze + Riposi + Ferie + 26mi PTV + Malattie
     + Infortuni + Assenze retribuite + Assenze non retribuite ≈ giorni del mese (28-31).
     ⚠️ La somma da sola NON basta a disambiguare: "9 Presenze + 0 Riposi + 22 Ferie" e
     "0 Presenze + 9 Riposi + 22 Ferie" fanno entrambe 31. Il discriminante è il punto 1:
     se la tua lettura porta a RIPOSI = 0, è SBAGLIATA — il numero che hai messo in
     daysWorked è in realtà RIPOSI, quindi daysWorked = 0. Ricomincia dal punto 1.

  [DIVIETO ASSOLUTO]: è SEVERAMENTE VIETATO mettere in daysWorked un numero incolonnato
  sotto "Riposi", "Malattie", "Infortuni", "Ferie anno prec." o "Ferie anno corrente"
  (es. se c'è 31 sotto "Malattie", daysWorked = 0).
  [DIVIETO RESIDUI FERIE]: per daysVacation non pescare le ultime due colonne "Ferie anno
  prec./corrente": estrai SOLO le ferie del mese (3ª colonna).
  [DIVIETO APA]: non estrarre MAI il numero accanto alla scritta "N° A.P.A." (es. il "7").

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
    "isCUD": false, "month": 3, "year": 2019, "daysWorked": 18.0, "daysVacation": 1.0, "daysPaidLeave": 0.0, "ticketRate": 7.0, "arretrati": 158.12, "eventNote": "[Malattia/Carenza]", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 2938.55, "imponibile_tfr_mensile": 2107.91,
    "codes": {
      "0152": 576.06, "0421": 0.0, "0423": 0.0, "0457": 140.00, "0470": 0.0, "0482": 0.0, "0496": 0.0, "0687": 0.0, "0686": 0.0, "0AA1": 0.0, "0576": 0.0, "0584": 64.00, "0919": 0.0, "0920": 0.0, "0932": 0.0, "0933": 0.0, "0995": 0.0, "0996": 0.0, "0376": 0.0
    }
  }
`;
// ==========================================
// 2. PROMPT CLEAN SERVICE SRL (CCNL Multiservizi - Ristorazione e Pulizie)
// ==========================================
const PROMPT_CLEAN_SERVICE = `
  Sei un estrattore dati deterministico specializzato in Buste Paga CLEAN SERVICE SRL (CCNL Multiservizi - settore Ristorazione e Pulizie).
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile.
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 1.000,50 diventa 1000.50). Usa sempre e solo il PUNTO (.) come separatore decimale. MAI la virgola nel JSON finale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0", "I" al posto di "1"). Usa le descrizioni testuali come conferma infallibile se il codice numerico risulta sporco o illeggibile.

  ### 🔴 REGOLA FERREA #1 — ASTERISCHI NEI CODICI
  Le voci Clean Service spesso vengono stampate con asterischi accanto al codice numerico (es. "8037 * *", "* 8037 *", "8037**", "8037 \\* \\*").
  Gli asterischi sono SOLO marker di stampa/note a piè pagina, NON fanno parte del codice.
  DEVI estrarre ESCLUSIVAMENTE la parte numerica del codice e ignorare ogni asterisco circostante.
  Esempio: leggi "8037 * *" → il codice è "8037". Leggi "** 565" → il codice è "565". Leggi "311*" → il codice è "311".

  ### 🔴 REGOLA FERREA #2 — MULTI-PAGINA (** SEGUE **)
  Le buste paga Clean Service hanno spesso 2 o più pagine. Se in fondo a una pagina leggi la dicitura "** SEGUE **" (o varianti: "SEGUE", "** segue **", "Segue →"), significa che la busta paga continua sulla pagina successiva.
  DEVI analizzare TUTTE le pagine dalla prima all'ultima PRIMA di produrre il JSON finale:
  - Se lo STESSO codice numerico (es. 8037) compare in più pagine, SOMMA gli importi della colonna Competenze.
  - Unifica "arretrati" sommando i contributi di ogni pagina.
  - Concatena "eventNote" se trovi marker diversi su pagine diverse.
  Chi si ferma alla prima pagina ignorando il "** SEGUE **" fallisce il task in modo irreversibile.

  ### 🔴 REGOLA FERREA #3 — UNA TANTUM / ARRETRATI
  Se la DESCRIZIONE testuale di una voce contiene le parole "UNA TANTUM" o "ARRETRATI" (case-insensitive, anche separate: "ARR. UNA TANTUM", "UNA TANTUM 2024", "ARRETRATI ANNI PREC."), DEVI:
  1. NON inserire quell'importo nella mappa "codes" delle indennità (anche se il codice numerico coincide con uno dei codici Clean Service).
  2. SOMMARE quell'importo nel campo "arretrati".
  3. Aggiungere "[Arretrati/UnaTantum]" al campo "eventNote".
  Questa regola PREVALE su tutte le mappature codici sotto: la descrizione testuale è la verità ultima.

  ### 1. DATI BASE
  - "month" (numero 1-12) e "year" (4 cifre): estraili dalla testata del cedolino (mese/anno di competenza).

  ### 2. PRESENZE E FERIE
  - "daysWorked" (Giorni Lavorati): cerca "Presenze", "Giorni Lavorati" o "GG INPS" nella sezione anagrafica/riepilogo in alto. Estrai il valore numerico.
  - "daysVacation" (Ferie godute nel mese): cerca "Ferie godute", "Ferie", o codice 5000 / descrizione "FERIE GODUTE". Se il valore è espresso in ore (> 12), dividi per 8 e arrotonda a 2 decimali. Se non trovi nulla, restituisci 0.

  ### 3. TICKET RESTAURANT
  - Individua la voce con codice 311 (descrizione "TICKET"). Estrai il valore unitario (colonna "Valore Unitario" o "Base/Aliquota", NON la quantità) e mettilo in "ticketRate".
  - Il codice 311 NON deve comparire nella mappa "codes" (è gestito esclusivamente come "ticketRate", come per RFI/Elior).
  - Se il codice 311 è assente, "ticketRate" è 0.0.

  ### 4. CODICI VARIABILI (MASTER LIST)
  Cerca i seguenti codici in TUTTE le pagine, estraendo il valore ESCLUSIVAMENTE dalla colonna "Competenze" (importi positivi).
  REGOLA D'ORO: Il JSON finale DEVE contenere TUTTE le chiavi elencate qui sotto in "codes". Se un codice non è presente nella busta paga, il suo valore DEVE essere 0.0. Non omettere mai nessuna chiave.
  Ricorda di applicare la REGOLA FERREA #1 (asterischi) e #3 (UNA TANTUM/ARRETRATI) durante l'estrazione.

  Maggiorazioni Turni e Festività:
  - 8037 (INDENNITA' LAV. NOTTURNO)
  - 8057 (IND. TURNO NON CADENZ.)
  - 8029 (IND. LAV. DOMEN. > 2 h)
  - 8019 (LAVORO FESTIVO 35%)
  - 565  (ORE FEST. LAVORATE 35%)
  - 8032 (IND. LAV. DOMEN. PASQUA > 2 h)
  - 442  (FESTIVITA' S. PASQUA)

  Lavoro Straordinario / Supplementare:
  - 8007 (LAVORO STRAORDINARIO 18%)
  - 18   (LAVORO SUPPLEM. 18%)

  Indennità Flessibilità Oraria:
  - 437  (IND. FLESS. > 13 < 24)
  - 440  (IND. FLESS. > 13 > 24 < 30)
  - 441  (IND. FLESS. > 13 > 30)

  Indennità Specifiche (Trasferte, Presenza):
  - 820  (IND. PRESENZA)
  - 739  (IND. DISPOSIZIONE)
  - 380  (IND. TRENO IN GIORNATA)
  - 315  (IND. TRASFERTA)
  - 392  (TRASFERTA ITALIA)
  - 8038 (IND. DI PERNOTTAZIONE)
  - 8053 (IND. MANEGGIO DENARO)

  ### 5. ARRETRATI E NOTE
  - "arretrati": somma SOLO gli importi POSITIVI delle voci la cui DESCRIZIONE contiene "UNA TANTUM", "ARRETRATI", "CONGUAGLIO", "ARR." (case-insensitive). IGNORA categoricamente la colonna Trattenute.
  - "eventNote":
    * Se rilevi codici di malattia/assenza (es. "MALATTIA", "INFORTUNIO", "CARENZA", indennità INPS), scrivi "[Malattia/Carenza]".
    * Se rilevi "SCIOPERO" o "ORE SCIOPERO", aggiungi "[Sciopero]".
    * Se hai applicato la REGOLA FERREA #3, aggiungi "[Arretrati/UnaTantum]".
    * Più marker possono coesistere separati da " + " (es. "[Malattia/Carenza] + [Arretrati/UnaTantum]").
    * Altrimenti lascia una stringa vuota "".

  ### 6. AUDITOR AI
  - "aiWarning":
    * Se daysWorked > 31 → "Anomalia: Presenze > 31"
    * Se daysWorked = 0 ma sono presenti importi variabili > 0 → "Nessuna anomalia (Conguaglio mese prec.)"
    * In tutti gli altri casi → "Nessuna anomalia"

  ### 7. TFR E FONDO PREGRESSO (⚠️ REGOLA CRITICA DEL MESE DI DICEMBRE E GRANDEZZA NUMERI ⚠️)
  - "fondo_pregresso_31_12": cerca la sezione "TFR" / "Fondo TFR al 31/12 A.P." / "F.do TFR AP". Estrai il valore numerico (es. 2938.55). Se assente, 0.0.
  - "imponibile_tfr_mensile": [DIVIETO ASSOLUTO] cerca il riquadro TFR SOLO se la busta paga è di DICEMBRE (Mese 12) o c'è scritto "Cessazione" / "Fine Rapporto". Estrai ESCLUSIVAMENTE il valore della riga "Imponibile" (cifra alta, di solito 15.000-35.000). È SEVERAMENTE VIETATO estrarre il valore della riga "Accantonamento" o "Quota" (cifra molto più bassa, ~1.500-2.000). Per tutti i mesi da Gennaio a Novembre, restituisci SEMPRE E TASSATIVAMENTE 0.0.

  ### 8. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se il documento NON è una busta paga ma riporta diciture come "CERTIFICAZIONE UNICA" o "CUD":
  1. Imposta "isCUD": true.
  2. Imposta "month": 12.
  3. Cerca la sezione TFR e popola "imponibile_tfr_mensile" (imponibile annuale) e "fondo_pregresso_31_12" (maturato fino al 31/12 anno precedente).
  4. Imposta tutti gli altri codici, giorni lavorati e ferie a 0.0.

  ### 9. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo. È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`.

  Esempio di output perfetto:
  {
    "isCUD": false, "month": 5, "year": 2023, "daysWorked": 22.0, "daysVacation": 2.0, "ticketRate": 5.29, "arretrati": 128.40, "eventNote": "[Arretrati/UnaTantum]", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 1850.30, "imponibile_tfr_mensile": 0.0,
    "codes": {
      "8037": 145.20, "8057": 0.0, "8029": 0.0, "8019": 0.0, "565": 0.0, "8032": 0.0, "442": 0.0,
      "8007": 88.50, "18": 0.0,
      "437": 0.0, "440": 0.0, "441": 0.0,
      "820": 25.00, "739": 0.0, "380": 0.0, "315": 0.0, "392": 0.0, "8038": 0.0, "8053": 0.0
    }
  }
`;
// ==========================================
// 3. PROMPT MERCITALIA (Mercitalia Shunting & Terminal — layout gestionale ADP)
// Gabbia grafica differente da RFI/Trenitalia (SAP/Zucchetti). Tabella voci a
// 7 colonne: Cod.Voce | Descrizione | Valori | Numero o base di calcolo |
// Compenso unitario o % | Competenze | Trattenute. Le indennità si leggono in
// "Competenze"; daysWorked = GIORNI INPS − ferie godute (cod. 3833).
// ==========================================
const PROMPT_MERCITALIA = `
  Sei un estrattore dati deterministico specializzato in Buste Paga MERCITALIA (Mercitalia Shunting & Terminal), elaborate con il software gestionale ADP (it-adp.com).
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile.
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 29.228,65 diventa 29228.65). Usa sempre e solo il PUNTO (.) come separatore decimale. MAI la virgola nel JSON finale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0", "I" al posto di "1"). Usa le descrizioni testuali come conferma se il codice numerico risulta sporco.

  [ANATOMIA ADP — STRUTTURA DELLE COLONNE (CRITICA)]
  Questo layout NON è il layout SAP/Zucchetti di RFI/Trenitalia.
  La tabella centrale delle voci ha ESATTAMENTE queste 7 colonne, in quest'ordine da sinistra a destra:
    1) "Cod. Voce"                  -> il codice numerico a 4 cifre
    2) "Descrizione"                -> il nome della voce
    3) "Valori"                     -> importi di base/totali (retribuzione, imponibili) — NON le indennità
    4) "Numero o base di calcolo"   -> quantità: giorni, ore, numero pezzi
    5) "Compenso unitario o %"      -> la tariffa unitaria o la percentuale
    6) "Competenze"                 -> L'IMPORTO IN EURO EFFETTIVAMENTE PAGATO (le indennità si leggono QUI)
    7) "Trattenute"                 -> le decurtazioni
  REGOLA D'ORO DELLE COLONNE: l'importo in euro di un'indennità o di una maggiorazione si trova SEMPRE nella colonna "Competenze" (6ª colonna), MAI nella colonna "Valori".
  I dati previdenziali, fiscali e TFR sono in riquadri distinti ("Informazioni Previdenziali", "Informazioni Fiscali", "Informazioni TFR"), tipicamente a PAGINA 2.

  ### 0. REGOLA DELLE MULTI-PAGINE (CRITICA)
  Il documento contiene più pagine. La tabella delle voci continua sulle pagine successive; i riquadri "Informazioni Previdenziali" e "Informazioni TFR" sono tipicamente a PAGINA 2.
  Analizza l'intero documento. Se lo STESSO codice numerico compare su righe diverse, SOMMA gli importi.

  ### 1. PERIODO (MESE / ANNO)
  - PAGINA 1, riquadro "Informazioni Aziendali": individua la voce "PERIODO" (es. "MARZO 2023", "OTTOBRE 2019").
  - "month": numero 1-12. "year": anno a 4 cifre.

  ### 2. GIORNI INPS (base di calcolo dei giorni)
  - Vai a PAGINA 2, riquadro "Informazioni Previdenziali", e individua la stringa ESATTA "GIORNI INPS": estrai il numero associato (tipicamente 26, può essere 25, 16, ecc.).
  - FONTE ALTERNATIVA (solo se "GIORNI INPS" illeggibile/assente): codice 1213 (RETRIBUZ.ORDINARIA) a pagina 1, colonna "Numero o base di calcolo".
  - ⚠️ ATTENZIONE: "GIORNI INPS" include ANCHE i giorni di ferie. NON è il valore finale di daysWorked. Tienilo da parte: serve al §4.

  ### 3. FERIE DEL MESE (daysVacation) E STORNO FERIE
  Il codice 3833 (FERIE GODUTE) può comparire su PIÙ righe nello stesso cedolino. Per OGNI
  riga 3833 guarda il SEGNO del valore nella colonna "Valori":
  - Riga con valore POSITIVO → ferie effettivamente godute nel mese.
  - Riga con valore NEGATIVO (es. "-8,00") → STORNO di ferie (correzione contabile di periodi
    PRECEDENTI): NON sono ferie godute in questo mese.
  - "daysVacation": somma SOLTANTO le righe 3833 con valore POSITIVO (prendi il valore dalla
    colonna "Numero o base di calcolo"). Le righe di storno (negative) NON entrano in daysVacation.
    Esempio: righe 3833 "+1,00" e "-8,00" → "daysVacation": 1.0 (solo la riga positiva).
  - "ferieStorno": se esiste una o più righe 3833 di storno (valore negativo), somma il loro
    valore ASSOLUTO e convertilo in GIORNI — se il valore è espresso in ore (es. 8,00) dividilo
    per 8. Esempio: storno "-8,00" → "ferieStorno": 1.0. Se non c'è alcuno storno → "ferieStorno": 0.0.
  - [DIVIETO 1]: NON usare il codice 1639 (FERIE ANNUALI): è la quota annuale spettante, NON le ferie godute nel mese.
  - [DIVIETO 2]: NON usare la tabella ferie in alto a PAGINA 2 (colonne "Maturati / Goduti / Saldo"): sono contatori PROGRESSIVI ANNUALI, non il dato del mese.
  - Se il codice 3833 è del tutto ASSENTE → "daysVacation": 0.0 e "ferieStorno": 0.0.

  ### 4. GIORNI LAVORATI (daysWorked) — VALORE CALCOLATO
  Il numero di giorni effettivamente LAVORATI NON è stampato esplicitamente: DEVI calcolarlo.
  FORMULA TASSATIVA:  daysWorked = [GIORNI INPS del §2]  −  [daysVacation del §3]
  Le ferie godute consumano giorni che INPS conteggia ma che NON sono lavoro: vanno sottratte.
  Esempi:
   - GIORNI INPS 26, FERIE GODUTE (cod. 3833) 7  ->  daysWorked = 26 − 7 = 19.0
   - GIORNI INPS 26, nessun codice 3833          ->  daysWorked = 26 − 0 = 26.0
   - GIORNI INPS 25, FERIE GODUTE 4              ->  daysWorked = 25 − 4 = 21.0
  È VIETATO restituire daysWorked = GIORNI INPS quando esiste un codice 3833 con valore > 0.

  ### 5. TICKET RESTAURANT / BUONI PASTO (Codici 3994 / 4001)
  - Cerca i codici 3994 (VAL.CONV.TICKETS E) o 4001 (VAL.TICKETS E).
  - "count": il NUMERO dei ticket, dalla colonna "Numero o base di calcolo" (es. 22, 13).
  - "ticketRate": il valore unitario, dalla colonna "Compenso unitario o %" (es. 0.30, 7.30).
  - I codici 3994/4001 NON devono comparire nella mappa "codes". Se assenti, "count" e "ticketRate" = 0.0.

  ### 6. MASTER LIST CODICI ADP — importi dalla colonna "Competenze"
  Per ognuno dei 12 codici elencati sotto, estrai l'importo in euro dalla colonna "Competenze" (6ª colonna, importi positivi).
  NON leggere la colonna "Valori" né "Numero o base di calcolo": l'importo pagato dell'indennità è in "Competenze".
  REGOLA D'ORO: il JSON DEVE contenere TUTTE le 12 chiavi. Codice assente -> valore 0.0.

  Indennità variabili di presenza:
  - 1801 (INDEN.LAV NOTTURNO)
  - 1802 (INDEN. TURNO H24)
  - 1811 (INDEN. LAV.DOMENC.)
  - 1819 (IND.LAV.FESTIVO)
  - 1879 (ORE VIAGGIO)
  - 2331 (TRASFERTA ITALIA)
  Ore di straordinario:
  - 2013 (STR. DIURNO 18%)
  - 2023 (STR.FES.DIURN.35%)
  - 2033 (STR NOTTURNO 35%)
  - 2073 (STR.FEST NOT.50%)
  Festività:
  - 2263 (FESTIVITA')
  - 2293 (FESTIVITA INFRAS.)

  ### 7. CODICI DI FILTRO / ARRETRATI
  I seguenti codici NON devono comparire in "codes". I loro importi POSITIVI (colonna "Competenze") vanno SOMMATI nel campo "arretrati":
  - 1723 (13MA MENSILITA')
  - 1733 (14MA MENSILITA')
  - 2469 / 2501 / 2502 (UNA TANTUM / Arretrati contrattuali)
  - 2512 (UT WELFARE / BUONI BENZINA)
  Se rilevi uno di questi codici, aggiungi "[Arretrati/UnaTantum]" a "eventNote".

  ### 8. NOTE EVENTI
  - "eventNote": "[Malattia/Carenza]" se rilevi voci di malattia/infortunio/carenza; "[Arretrati/UnaTantum]" se hai applicato il §7. Più marker separati da " + ". Altrimenti "".
    NON inserire qui i ticket: sono gestiti solo via "count" e "ticketRate".

  ### 9. AUDITOR AI
  - "aiWarning":
    * daysWorked > 31 -> "Anomalia: Presenze > 31"
    * daysWorked = 0 ma importi variabili > 0 -> "Nessuna anomalia (Conguaglio mese prec.)"
    * altrimenti -> "Nessuna anomalia"

  ### 10. TFR (⚠️ SOLO DICEMBRE ⚠️)
  - "imponibile_tfr_mensile": estrai SOLO se il mese del §1 è DICEMBRE. In tal caso, PAGINA 2 riquadro "Informazioni TFR", valore della stringa ESATTA "RETR.UTILE TFR" (cifra alta consolidata, es. 29228.65).
    Per TUTTI i mesi da Gennaio a Novembre restituisci TASSATIVAMENTE 0.0.
  - "fondo_pregresso_31_12": riquadro "Informazioni TFR", ESCLUSIVAMENTE il valore della riga "TFR 31/12 A.P." (TFR maturato al 31/12 dell'anno precedente). Questa riga è spesso VUOTA per chi è stato assunto nell'anno corrente: in tal caso restituisci 0.0. NON confonderla MAI con la riga "RETR.UTILE TFR" (retribuzione utile progressiva, una cifra diversa e più alta): se "TFR 31/12 A.P." è vuota, fondo_pregresso_31_12 = 0.0.

  ### 11. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se il documento è una "CERTIFICAZIONE UNICA" / "CUD": "isCUD": true, "month": 12, popola "imponibile_tfr_mensile" (imponibile TFR annuo) e "fondo_pregresso_31_12"; tutti gli altri campi a 0.0.

  ### 12. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo. È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`.

  Esempio di output perfetto (busta di LUGLIO con 7 giorni di ferie, nessuno storno):
  {
    "isCUD": false, "month": 7, "year": 2019, "daysWorked": 19.0, "daysVacation": 7.0, "ferieStorno": 0.0, "count": 13.0, "ticketRate": 0.30, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 0.0, "imponibile_tfr_mensile": 0.0,
    "codes": {
      "1801": 96.00, "1802": 34.00, "1811": 40.00, "1819": 0.0, "1879": 0.0, "2331": 0.0,
      "2013": 0.0, "2023": 0.0, "2033": 0.0, "2073": 130.35,
      "2263": 133.69, "2293": 0.0
    }
  }
`;
// =========================================================================
// 4. PROMPT GENERALE PER ELIOR
// =========================================================================
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
// 4. PROMPT DI EMERGENZA (UNIVERSALE)
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
  "TRENITALIA": PROMPT_TRENITALIA,
  "CLEAN_SERVICE": PROMPT_CLEAN_SERVICE,
  "MERCITALIA": PROMPT_MERCITALIA
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

      const result = await generateContentWithRetry(model, [
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

      const result = await generateContentWithRetry(modelExplainer, [
        explainPrompt,
        { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }
      ], 2, 26000);

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

    const result = await generateContentWithRetry(model, [
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