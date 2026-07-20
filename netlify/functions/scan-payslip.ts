import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { checkScanRateLimit, clientIp } from "./_rateLimit";

// --- POOL DI CHIAVI API GEMINI ---
// Più chiavi = più bucket di quota indipendenti. Si parte da una chiave casuale (così un
// batch di buste paga distribuisce il carico) e si ruota ad ogni retry: se una chiave è
// throttlata/lenta, il tentativo successivo ne prova un'altra.
const dedupKeys = (...keys: (string | undefined)[]): string[] => {
  const list = [...new Set(keys.filter((k): k is string => !!k))];
  return list.length > 0 ? list : [""];
};
const SCAN_API_KEYS = dedupKeys(
  process.env.GOOGLE_API_KEY_TFR,
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_AI
);
const EXPLAINER_API_KEYS = dedupKeys(
  process.env.GOOGLE_API_KEY_EXPLAINER,
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_AI
);

// --- MODELLO GEMINI CENTRALIZZATO ---
// Override con la env var GEMINI_MODEL (es. da Netlify) per sperimentare un modello
// diverso senza modificare il codice. Default: gemini-3.5-flash.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// --- THINKING BUDGET ---
// I modelli "thinking" (3.5-flash, 2.5-flash) di default pensano illimitatamente e su prompt
// complessi (PDF inline + regole RFI/Mercitalia) sforavano i timeout (>60s). Mettiamo un cap:
// il modello pensa fino a N token e poi è obbligato a rispondere. 1024 è sufficiente per i
// task strutturati di estrazione; alzare via env se l'accuratezza cala.
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET) || 1024;

// --- HELPER PULIZIA E UNIONE JSON (V20 - Somma Automatica Pagine) ---
export function cleanAndParseJSON(text: string): any {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const mergeBlocks = (blocks: any[]) => {
      if (blocks.length === 0) throw new Error("Nessun dato trovato");
      let finalData = { ...blocks[0] };
      finalData.codes = { ...blocks[0].codes };
      // Trasferta 0AA1: il modello TRASCRIVE ogni riga qui (una per giornata), la somma la fa il codice.
      finalData.trasferta_esente_righe = Array.isArray(blocks[0].trasferta_esente_righe)
        ? [...blocks[0].trasferta_esente_righe] : [];
      // ELIOR cartacee: le terne per la verifica aritmetica si CONCATENANO tra le pagine
      // (cedolino su 2 fogli: voci sul primo, totali sul secondo); i totali di controllo
      // si prendono dalla pagina che li stampa (primo valore non-null).
      finalData.voci = Array.isArray(blocks[0].voci) ? [...blocks[0].voci] : [];

      if (!finalData.aiWarning) finalData.aiWarning = "Nessuna anomalia";

      for (let i = 1; i < blocks.length; i++) {
        const nextPage = blocks[i];
        finalData.arretrati = (finalData.arretrati || 0) + (nextPage.arretrati || 0);

        if (Array.isArray(nextPage.voci)) finalData.voci.push(...nextPage.voci);
        for (const k of ["ggInps", "totaleRetribuzione", "totaleCompetenze", "totaleTrattenute", "netto"]) {
          if (finalData[k] === null || finalData[k] === undefined) {
            if (nextPage[k] !== null && nextPage[k] !== undefined) finalData[k] = nextPage[k];
          }
        }

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
        if (Array.isArray(nextPage.trasferta_esente_righe)) {
          finalData.trasferta_esente_righe.push(...nextPage.trasferta_esente_righe);
        }
      }

      // 0AA1 (Trasferta esente): la SOMMA la fa il CODICE, non il modello. Sui cedolini RFI la
      // trasferta è una lista di 1-14 righe giornaliere (su più pagine) e il modello la somma
      // male (test accuratezza 07/07: 0AA1 esatta solo nel ~53% dei mesi). Il modello trascrive
      // ogni riga in "trasferta_esente_righe"; qui sommiamo e sovrascriviamo codes["0AA1"].
      // Fallback sicuro: se l'array è assente/vuoto (altri profili, o nessuna trasferta) NON si tocca.
      if (Array.isArray(finalData.trasferta_esente_righe) && finalData.trasferta_esente_righe.length > 0) {
        const somma = finalData.trasferta_esente_righe.reduce((s: number, v: any) => {
          const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
          return s + (Number.isFinite(n) ? n : 0);
        }, 0);
        finalData.codes = finalData.codes || {};
        finalData.codes["0AA1"] = Math.round(somma * 100) / 100;
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

    // Riparazione graffe mancanti: con l'array "voci" in coda il modello a volte
    // chiude l'array ma NON l'oggetto esterno (finishReason STOP, "}" finali assenti,
    // osservato sulle buste Elior 13/07). Se lo scan a profondità non ha chiuso
    // l'ultimo blocco, si tenta il parse aggiungendo le graffe che mancano.
    if (startIndex !== -1 && depth > 0) {
      const repaired = clean.substring(startIndex).replace(/,\s*$/, "") + "}".repeat(depth);
      jsonBlocks.push(JSON.parse(repaired));
    }

    if (jsonBlocks.length > 0) return mergeBlocks(jsonBlocks);

    throw new Error("Formato incomprensibile");
  } catch (error: any) {
    console.error("❌ ERRORE PARSING JSON:", text);
    throw new Error(`Output AI non valido: ${error.message}`);
  }
}

// --- RETRY GEMINI BUDGET-AWARE ---
// La latenza dell'API Gemini è molto variabile (osservato 13s vs 249s sullo stesso file).
// Il budget totale è dimensionato sul timeout REALE della Function: ~50s in produzione
// (netlify.toml: timeout=60) e ~26s in locale, dove `netlify dev` gira con lambda-local
// a 30s e ignora netlify.toml. Override con la env var AI_BUDGET_MS. Logica:
//  - cap per-tentativo aggressivo (PER_ATTEMPT_CAP_MS, default 14s): se Gemini va in coda
//    lunga, fail-fast e ritenta su un'altra chiave (3 progetti GCP indipendenti = code
//    diverse) invece di bruciare tutto il budget su una singola chiave lenta. Statisticamente
//    serve che TUTTE le chiavi siano lente nello stesso istante per fallire la scansione.
//  - ritenta solo se resta budget reale, ruotando su una chiave diversa;
//  - se il budget è finito si lancia un errore pulito PRIMA del kill secco della Function.
// In dev (netlify dev) il timeout effettivo è ~30s, non 50s come in prod: con cap
// 14s si fanno 2 tentativi che bruciano l'intero budget e abortiscono entrambi
// (osservato: "Request aborted" dopo ~25s). In dev preferiamo un singolo tentativo
// con cap largo (24s) che lascia a Gemini il tempo di rispondere su prompt RFI lunghi.
const PER_ATTEMPT_CAP_MS = Number(process.env.AI_PER_ATTEMPT_CAP_MS)
    || (process.env.NETLIFY_DEV === "true" ? 24000 : 14000);

async function generateContentWithRetry(
  keys: string[],
  buildModel: (genAI: GoogleGenerativeAI) => any,
  parts: any,
  opts: { totalBudgetMs?: number; perAttemptCapMs?: number } = {}
): Promise<any> {
  const isLocalDev = process.env.NETLIFY_DEV === "true";
  const defaultBudgetMs = Number(process.env.AI_BUDGET_MS) || (isLocalDev ? 26000 : 50000);
  const totalBudgetMs = opts.totalBudgetMs ?? defaultBudgetMs;
  const perAttemptCapMs = opts.perAttemptCapMs ?? PER_ATTEMPT_CAP_MS;
  const startKey = Math.floor(Math.random() * keys.length);
  const start = Date.now();
  let lastErr: any;
  let attempt = 0;

  while (true) {
    const remaining = totalBudgetMs - (Date.now() - start);
    if (attempt > 0 && remaining < 6000) break; // niente budget per un altro tentativo serio
    attempt++;
    const perAttemptMs = Math.min(perAttemptCapMs, Math.max(remaining - 1000, 5000));
    const keyIndex = (startKey + attempt - 1) % keys.length;
    try {
      const model = buildModel(new GoogleGenerativeAI(keys[keyIndex]));
      return await model.generateContent(parts, { timeout: perAttemptMs });
    } catch (err: any) {
      lastErr = err;
      console.warn(`⏳ Tentativo Gemini ${attempt} (chiave #${keyIndex + 1}/${keys.length}) non riuscito (${err?.message || err})`);
    }
  }
  throw new Error(
    `Servizio AI non disponibile dopo ${attempt} tentativi (Gemini lento o sovraccarico). Riprova tra poco. [${lastErr?.message || lastErr}]`
  );
}

// =========================================================================
// 🔧 RICONCILIATORE RIGA PRESENZE (RFI / TRENITALIA)
//
// Problema: quando la cella "Presenze" del cedolino è VUOTA (il dipendente non ha
// lavorato quel mese: solo riposi/ferie/permessi) l'OCR prende il primo numero della
// riga — che fisicamente è la colonna RIPOSI — e lo scrive in `presenze`. daysWorked è
// il divisore dei calcoli indennità: l'errore corrompe l'intera pratica.
//
// Dai SOLI numeri il caso è IRRISOLVIBILE: una riga "presenze=8, assenze=21" è identica
// sia che l'8 siano giorni lavorati veri sia che sia un Riposi mal letto (verificato su
// cedolini reali con esito opposto: Aprile 2008 → 0, Giugno 2021 → 10). L'unico dato
// dirimente — "la cella Presenze è vuota?" — vive solo nell'immagine. Strategia a 3 livelli:
//  1. SEGNALE PRIMARIO: il prompt chiede all'IA un booleano esplicito `presenzeVuota`
//     (lettura geometrica del primo riquadro della tabella). Se c'è, comanda lui.
//  2. RETE NUMERICA: invariante asimmetrica. Una riga onesta di un mese singolo somma a
//     ~28-32; un valore-presenze FANTASMA crea sovra-conteggio. Se "presenze" è
//     compatibile con un Riposi (4-16), la riga supera la soglia e azzerare "presenze" la
//     riporta sotto → è uno slittamento → daysWorked = 0. (NB: la soglia è fissa, non i
//     giorni di calendario — febbraio può sommare 31 > 29 reali.)
//  3. SEGNALAZIONE DEL DUBBIO: se nessuno dei due è conclusivo ma "presenze" è piccolo
//     (plausibile Riposi) e il mese risulterebbe implausibilmente pieno, NON si indovina
//     in silenzio: daysWorked tiene il valore estratto e si alza un avviso esplicito di
//     verifica manuale (meglio un dubbio segnalato che un divisore sbagliato nascosto).
// =========================================================================
const SOGLIA_MESE_SINGOLO = 32.5;
const RIPOSI_MIN = 4;
const RIPOSI_MAX = 16;
// Oltre questa somma (giorni lavorati + ferie + assenze retribuite) per un mese non
// resterebbe spazio per i ~8 riposi di un full-time: un "presenze" piccolo è sospetto.
const SOGLIA_MESE_PIENO = 26;

export function reconcileRailwayAttendance(finalJson: any): void {
  const att = finalJson.attendance;

  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const z = (v: number | null): number => v ?? 0;

  if (!att || typeof att !== "object") {
    // L'IA non ha prodotto l'oggetto attendance: fallback prudente.
    if (finalJson.daysWorked === undefined) finalJson.daysWorked = 0;
    if (finalJson.daysVacation === undefined) finalJson.daysVacation = 0;
    if (finalJson.daysPaidLeave === undefined) finalJson.daysPaidLeave = 0;
    if (!finalJson.aiWarning) finalJson.aiWarning = "Nessuna anomalia";
    return;
  }

  const presenze = num(att.presenze);
  const riposi = num(att.riposi);
  const ferie = num(att.ferie);

  // daysVacation / daysPaidLeave: colonne con intestazione propria → lettura affidabile.
  const daysVacation = z(ferie);
  const daysPaidLeave = z(num(att.assenzeRetribuite));

  // 1. Segnale primario: l'IA dichiara se la cella "Presenze" è fisicamente vuota.
  const cellaPresenzeVuota =
    finalJson.presenzeVuota === true || finalJson.presenzeVuota === "true";

  // 2. Rete numerica: invariante asimmetrica del mese singolo.
  const sommaAsIs =
    z(presenze) + z(riposi) + z(ferie) + z(num(att.ptv26)) +
    z(num(att.malattie)) + z(num(att.infortuni)) +
    z(num(att.assenzeRetribuite)) + z(num(att.assenzeNonRetribuite));
  const sommaSenzaPresenze = sommaAsIs - z(riposi);
  const presenzePlausibileComeRiposi =
    presenze !== null && presenze >= RIPOSI_MIN && presenze <= RIPOSI_MAX;
  const slittamentoNumerico =
    presenzePlausibileComeRiposi &&
    sommaAsIs > SOGLIA_MESE_SINGOLO &&
    sommaSenzaPresenze <= SOGLIA_MESE_SINGOLO;

  // --- daysWorked, in ordine di affidabilità del segnale ---
  let daysWorked: number;
  let correzioneAutomatica = false;

  if (cellaPresenzeVuota) {
    // L'IA conferma: cella "Presenze" vuota → nessun giorno lavorato.
    daysWorked = 0;
    correzioneAutomatica = z(presenze) > 0; // l'IA aveva messo lì il valore dei Riposi
  } else if (slittamentoNumerico) {
    // Nessun segnale esplicito affidabile, ma i numeri tradiscono lo slittamento.
    daysWorked = 0;
    correzioneAutomatica = true;
  } else {
    daysWorked = z(presenze);
  }

  if (correzioneAutomatica) {
    console.log(
      `🔧 RICONCILIAZIONE PRESENZE: daysWorked ${z(presenze)} → 0 (cella Presenze vuota; ${z(presenze)} era il valore della colonna Riposi)`
    );
  }

  finalJson.daysWorked = daysWorked;
  finalJson.daysVacation = daysVacation;
  finalJson.daysPaidLeave = daysPaidLeave;

  // --- Messaggistica e segnalazione del dubbio ---
  const hasIndennita =
    finalJson.codes &&
    Object.values(finalJson.codes).some((v: any) => (num(v) ?? 0) > 0);

  // 3. Caso ambiguo: "presenze" piccolo (plausibile Riposi) e mese implausibilmente
  // pieno, ma daysWorked NON è stato azzerato. Non si indovina: si chiede verifica.
  const meseImplausibilmentePieno =
    presenzePlausibileComeRiposi &&
    daysWorked > 0 &&
    daysWorked + daysVacation + daysPaidLeave > SOGLIA_MESE_PIENO;

  if (correzioneAutomatica) {
    finalJson.aiWarning =
      "Conguaglio mese prec. (giorni lavorati corretti automaticamente: cella Presenze vuota)";
  } else if (meseImplausibilmentePieno) {
    finalJson.aiWarning =
      `⚠️ Giorni lavorati da verificare a mano: la cella "Presenze" è ambigua — ${daysWorked} potrebbe essere il valore della colonna "Riposi" (in tal caso i giorni lavorati sono 0)`;
  } else if (daysWorked > 31) {
    finalJson.aiWarning = `Conguaglio: periodo con più mensilità (${daysWorked} giorni lavorati)`;
  } else if (daysWorked === 0 && hasIndennita) {
    finalJson.aiWarning = "Nessuna anomalia (Conguaglio mese prec.)";
  } else {
    finalJson.aiWarning = "Nessuna anomalia";
  }
}

/**
 * Post-processing FSE: scompone la voce presenza (il "23") in servizio effettivo + ferie.
 * DECISIONE 20/07: la voce presenza (I86178/I86005/IX0023) è pagata ANCHE durante le ferie, quindi
 * la sua quantità include i giorni di ferie. Il DIVISORE delle medie deve essere il servizio
 * EFFETTIVO (giorni davvero lavorati): daysWorked = presenza − ferie; il grezzo resta in
 * daysPresence per la scomposizione in UI. Verificato su 100 mesi Clarino (invariante sempre ≥ 0).
 * Solo era moderna Zucchetti (voce presenza pagata): nell'era storica SPA-GUIDA il §5-ter del prompt
 * ricava già daysWorked dalla banda "Presenze" (= servizio effettivo) → NON si tocca.
 */
export function reconcileFsePresence(finalJson: any): void {
  const num = (v: any): number => {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const PRESENZA = ['I86178', 'I86005', 'IX0023'];
  // Era moderna solo se una voce presenza è stata effettivamente pagata (importo ≠ 0): nell'era
  // storica quei codici non esistono (c'è la 663, esclusa dal numeratore) → si lascia la banda.
  const isModern = PRESENZA.some(c => Math.abs(num(finalJson.codes?.[c])) > 0.001);
  if (!isModern) return;
  const presence = num(finalJson.daysWorked);   // quantità voce presenza estratta dall'IA (§2)
  const ferie = num(finalJson.daysVacation);
  finalJson.daysPresence = presence;
  finalJson.daysWorked = Math.max(0, Math.round((presence - ferie) * 100) / 100);
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
  
 ### 2. RIGA PRESENZE — TRASCRIZIONE INTEGRALE CELLA PER CELLA (CRITICO)
  In alto nel cedolino c'è una tabella con ESATTAMENTE 10 colonne, in quest'ordine fisso:
  1=Presenze  2=Riposi  3=Ferie  4=26mi PTV  5=Malattie  6=Infortuni
  7=Assenze retribuite  8=Assenze non retribuite  9=Ferie anno prec.  10=Ferie anno corrente
  I dati sono nell'unica riga subito sotto le intestazioni.

  ⚠️ DECISIONE CRITICA E SEPARATA — LA CELLA "PRESENZE" È VUOTA?
  Prima di ogni altra cosa, osserva SOLO il primo riquadro a sinistra della riga dati:
  il rettangolo delimitato a SINISTRA dal bordo esterno della tabella e a DESTRA dalla
  prima linea verticale divisoria, esattamente sotto la parola "Presenze".
  Guardando QUEL rettangolo e nient'altro, decidi una cosa sola:
  - se contiene una cifra stampata  → "presenzeVuota": false
  - se NON contiene alcuna cifra    → "presenzeVuota": true
  È normalissimo che sia vuota: in molti cedolini ferroviari il dipendente non ha
  lavorato quel mese (solo riposi, ferie o permessi) e la cella "Presenze" resta in
  bianco. In quel caso il primo numero visibile della riga appartiene già alla 2ª
  colonna "Riposi". NON dedurre il contenuto della cella dagli altri numeri della riga:
  fidati esclusivamente di ciò che è stampato dentro quel primo rettangolo.
  Metti "presenzeVuota" nel JSON al LIVELLO PRINCIPALE (fuori dall'oggetto "attendance").

  Poi TRASCRIVI la riga, cella per cella, nell'oggetto JSON "attendance". Per OGNI colonna:
  - se nella cella c'è un numero stampato, riportalo (punto come separatore decimale);
  - se la cella è VUOTA (nessuna cifra stampata), riporta null. NON riportare 0 per una
    cella vuota: null = cella vuota, 0 = uno zero stampato ("0,00"). Sono cose diverse.
  - NON spostare i numeri a sinistra per riempire le celle vuote: ogni numero resta sotto
    la SUA intestazione. Se la cella "Presenze" è vuota → "presenze": null, e il primo
    numero che vedi appartiene a "Riposi" (mai a "Presenze").
  - [DIVIETO APA]: non confondere mai con questa riga il numero accanto a "N° A.P.A.".

  Restituisci l'oggetto "attendance" con queste 10 chiavi (ogni valore: un numero oppure null):
  "attendance": { "presenze": ..., "riposi": ..., "ferie": ..., "ptv26": ...,
  "malattie": ..., "infortuni": ..., "assenzeRetribuite": ..., "assenzeNonRetribuite": ...,
  "ferieAnnoPrec": ..., "ferieAnnoCorrente": ... }

  NON inserire nel JSON le chiavi "daysWorked", "daysVacation" o "daysPaidLeave": vengono
  ricavate automaticamente dal sistema a partire da "attendance" e da "presenzeVuota".

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
  - 0AA1 (Trasferta esente) ⚠️ NON sommarla tu: nel campo "codes" lascia "0AA1": 0.0 e trascrivi ogni riga nell'array "trasferta_esente_righe" (vedi §TRASFERTA). La somma la fa il sistema.
  - 0576 (Ind. Orario Spezz.)
  - 0584 (Rep. Festive/Riposo)
  - 0919 (Str. Feriale Diurno)
  - 0920 (Str. Fest/Notturno)
  - 0932 (Str. Diurno Rep.)
  - 0933 (Str. Fest/Not Rep.)
  - 0995 (Str. Diurno Disp.)
  - 0996 (Str. Fest/Not Disp.)
  - 0376 (Indennità varie)

  #### §TRASFERTA — voce 0AA1 (regola speciale: NON sommare tu, trascrivi le righe)
  La voce 0AA1 "Ind.trasferta (esente)" compare su PIÙ righe (una per giornata di trasferta), spesso su più pagine.
  Trascrivi in un array "trasferta_esente_righe" l'importo della colonna Competenze di OGNI riga con codice 0AA1 e
  descrizione "Ind.trasferta (esente)", nell'ordine in cui appaiono.
  ⚠️ DUE ERRORI DA EVITARE:
  1) PAGINE: la busta RFI ha 2-3 pagine e le righe 0AA1 CONTINUANO sulle pagine successive. Scorri OGNI pagina fino
     in fondo: capita spesso che una o più righe 0AA1 stiano sulla 2ª o 3ª pagina. NON fermarti alla prima pagina.
  2) RIGHE IDENTICHE: trascrivi UNA voce per OGNI riga fisica che vedi, anche quando molte righe hanno lo STESSO
     importo (es. otto righe da 12,00 → devi scrivere 12.00 esattamente otto volte). NON fondere, NON saltare e
     NON duplicare le righe con importo uguale: conta le righe con attenzione.
  NON includere le righe 0AA2 "Ind.trasferta (Imponibile)" (è un'altra voce, non tracciata). Se non ci sono righe
  0AA1, restituisci un array vuoto []. Esempio: se vedi 3 righe 0AA1 da 12,00 / 22,16 / 37,65 → [12.00, 22.16, 37.65].

  #### VOCI FISSE CONTINUATIVE (base retributiva mensile — "Quadro B")
  [SCOPO]: servono SOLO al calcolo delle percentuali di incidenza, NON al credito ferie.
  Estrai SEMPRE dalla colonna "Competenze" (importi positivi). IGNORA TASSATIVAMENTE gli "Assorbimenti"/Trattenute (es. 2B30, 2B35) che hanno descrizione simile ma sono trattenute.
  - 3B01 (Minimo Contrattuale)
  - 3B03 (Superminimo Individuale)
  - 3B05 (ERI - Elemento Retributivo Individuale)
  - 3B10 (Salario Professionale)
  - 3B15 (Indennità di Funzione - solo Quadri/dirigenti)
  - 3B20 (APA - Aumenti Periodici Anzianità)
  - 3B30 (EDR 8.11.95)
  - 3B35 (EDR acc. 11.9.98)
  - 3B70 (Salario Produttività)
  - 3B71 (Produttività Incrementale)
 
  ### 5. ARRETRATI E NOTE
  - "arretrati": Somma SOLO gli importi POSITIVI (situati nella colonna Competenze) delle seguenti voci: 3E10, 3E16, Indennità INPS, codici che iniziano per 0K.., 74.., 6INT, 3105. IGNORA categoricamente la colonna Trattenute.
  - "eventNote": Se rilevi codici di malattia (es. 3E.., Indennità INPS) o giorni segnati sotto la colonna "Malattie", scrivi la stringa "[Malattia/Carenza]". Altrimenti lascia una stringa vuota "".

  ### 6. AUDITOR AI
  - "aiWarning": imposta sempre la stringa "Nessuna anomalia". Il sistema raffina
    automaticamente questo campo dopo aver ricalcolato i giorni dall'oggetto "attendance".
  
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
  6. Imposta tutti i codici a 0.0, ogni campo dell'oggetto "attendance" a null e "presenzeVuota" a false.

  ### 9. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo. 
  È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`. 
  
  Esempio di output perfetto:
  {
    "isCUD": false, "month": 3, "year": 2019, "ticketRate": 7.0, "arretrati": 158.12, "eventNote": "[Malattia/Carenza]", "aiWarning": "Nessuna anomalia",
    "presenzeVuota": false,
    "fondo_pregresso_31_12": 2938.55, "imponibile_tfr_mensile": 2107.91,
    "trasferta_esente_righe": [12.00, 22.16, 37.65],
    "attendance": { "presenze": 18.0, "riposi": 9.0, "ferie": 1.0, "ptv26": 0.0, "malattie": null, "infortuni": null, "assenzeRetribuite": null, "assenzeNonRetribuite": null, "ferieAnnoPrec": 12.0, "ferieAnnoCorrente": 20.0 },
    "codes": {
      "0152": 576.06, "0421": 0.0, "0423": 0.0, "0457": 140.00, "0470": 0.0, "0482": 0.0, "0496": 0.0, "0687": 0.0, "0686": 0.0, "0AA1": 0.0, "0576": 0.0, "0584": 64.00, "0919": 0.0, "0920": 0.0, "0932": 0.0, "0933": 0.0, "0995": 0.0, "0996": 0.0, "0376": 0.0,
      "3B01": 1609.30, "3B03": 1.61, "3B05": 40.38, "3B10": 89.25, "3B15": 0.0, "3B20": 179.46, "3B30": 63.01, "3B35": 57.17, "3B70": 69.49, "3B71": 52.46
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

 ### 2. RIGA PRESENZE — TRASCRIZIONE INTEGRALE CELLA PER CELLA (CRITICO)
  In alto nel cedolino c'è una tabella con ESATTAMENTE 10 colonne, in quest'ordine fisso:
  1=Presenze  2=Riposi  3=Ferie  4=26mi PTV  5=Malattie  6=Infortuni
  7=Assenze retribuite  8=Assenze non retribuite  9=Ferie anno prec.  10=Ferie anno corrente
  I dati sono nell'unica riga subito sotto le intestazioni.

  ⚠️ DECISIONE CRITICA E SEPARATA — LA CELLA "PRESENZE" È VUOTA?
  Prima di ogni altra cosa, osserva SOLO il primo riquadro a sinistra della riga dati:
  il rettangolo delimitato a SINISTRA dal bordo esterno della tabella e a DESTRA dalla
  prima linea verticale divisoria, esattamente sotto la parola "Presenze".
  Guardando QUEL rettangolo e nient'altro, decidi una cosa sola:
  - se contiene una cifra stampata  → "presenzeVuota": false
  - se NON contiene alcuna cifra    → "presenzeVuota": true
  È normalissimo che sia vuota: in molti cedolini ferroviari il dipendente non ha
  lavorato quel mese (solo riposi, ferie o permessi) e la cella "Presenze" resta in
  bianco. In quel caso il primo numero visibile della riga appartiene già alla 2ª
  colonna "Riposi". NON dedurre il contenuto della cella dagli altri numeri della riga:
  fidati esclusivamente di ciò che è stampato dentro quel primo rettangolo.
  Metti "presenzeVuota" nel JSON al LIVELLO PRINCIPALE (fuori dall'oggetto "attendance").

  Poi TRASCRIVI la riga, cella per cella, nell'oggetto JSON "attendance". Per OGNI colonna:
  - se nella cella c'è un numero stampato, riportalo (punto come separatore decimale);
  - se la cella è VUOTA (nessuna cifra stampata), riporta null. NON riportare 0 per una
    cella vuota: null = cella vuota, 0 = uno zero stampato ("0,00"). Sono cose diverse.
  - NON spostare i numeri a sinistra per riempire le celle vuote: ogni numero resta sotto
    la SUA intestazione. Se la cella "Presenze" è vuota → "presenze": null, e il primo
    numero che vedi appartiene a "Riposi" (mai a "Presenze").
  - [DIVIETO APA]: non confondere mai con questa riga il numero accanto a "N° A.P.A.".

  Restituisci l'oggetto "attendance" con queste 10 chiavi (ogni valore: un numero oppure null):
  "attendance": { "presenze": ..., "riposi": ..., "ferie": ..., "ptv26": ...,
  "malattie": ..., "infortuni": ..., "assenzeRetribuite": ..., "assenzeNonRetribuite": ...,
  "ferieAnnoPrec": ..., "ferieAnnoCorrente": ... }

  NON inserire nel JSON le chiavi "daysWorked", "daysVacation" o "daysPaidLeave": vengono
  ricavate automaticamente dal sistema a partire da "attendance" e da "presenzeVuota".

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
  - 0AA1 (Trasferta esente) ⚠️ NON sommarla tu: nel campo "codes" lascia "0AA1": 0.0 e trascrivi ogni riga nell'array "trasferta_esente_righe" (vedi §TRASFERTA). La somma la fa il sistema.
  - 0576 (Ind. Orario Spezz.)
  - 0584 (Rep. Festive/Riposo)
  - 0919 (Str. Feriale Diurno)
  - 0920 (Str. Fest/Notturno)
  - 0932 (Str. Diurno Rep.)
  - 0933 (Str. Fest/Not Rep.)
  - 0995 (Str. Diurno Disp.)
  - 0996 (Str. Fest/Not Disp.)
  - 0376 (Indennità varie)

  #### §TRASFERTA — voce 0AA1 (regola speciale: NON sommare tu, trascrivi le righe)
  La voce 0AA1 "Ind.trasferta (esente)" compare su PIÙ righe (una per giornata di trasferta), spesso su più pagine.
  Trascrivi in un array "trasferta_esente_righe" l'importo della colonna Competenze di OGNI riga con codice 0AA1 e
  descrizione "Ind.trasferta (esente)", nell'ordine in cui appaiono.
  ⚠️ DUE ERRORI DA EVITARE:
  1) PAGINE: la busta RFI ha 2-3 pagine e le righe 0AA1 CONTINUANO sulle pagine successive. Scorri OGNI pagina fino
     in fondo: capita spesso che una o più righe 0AA1 stiano sulla 2ª o 3ª pagina. NON fermarti alla prima pagina.
  2) RIGHE IDENTICHE: trascrivi UNA voce per OGNI riga fisica che vedi, anche quando molte righe hanno lo STESSO
     importo (es. otto righe da 12,00 → devi scrivere 12.00 esattamente otto volte). NON fondere, NON saltare e
     NON duplicare le righe con importo uguale: conta le righe con attenzione.
  NON includere le righe 0AA2 "Ind.trasferta (Imponibile)" (è un'altra voce, non tracciata). Se non ci sono righe
  0AA1, restituisci un array vuoto []. Esempio: se vedi 3 righe 0AA1 da 12,00 / 22,16 / 37,65 → [12.00, 22.16, 37.65].

  #### VOCI FISSE CONTINUATIVE (base retributiva mensile — "Quadro B")
  [SCOPO]: servono SOLO al calcolo delle percentuali di incidenza, NON al credito ferie.
  Estrai SEMPRE dalla colonna "Competenze" (importi positivi). IGNORA TASSATIVAMENTE gli "Assorbimenti"/Trattenute (es. 2B30, 2B35) che hanno descrizione simile ma sono trattenute.
  - 3B01 (Minimo Contrattuale)
  - 3B03 (Superminimo Individuale)
  - 3B05 (ERI - Elemento Retributivo Individuale)
  - 3B10 (Salario Professionale)
  - 3B15 (Indennità di Funzione - solo Quadri/dirigenti)
  - 3B20 (APA - Aumenti Periodici Anzianità)
  - 3B30 (EDR 8.11.95)
  - 3B35 (EDR acc. 11.9.98)
  - 3B70 (Salario Produttività)
  - 3B71 (Produttività Incrementale)

  ### 5. ARRETRATI E NOTE
  - "arretrati": Somma SOLO gli importi POSITIVI (situati nella colonna Competenze) delle seguenti voci: 3E10, 3E16, Indennità INPS, codici che iniziano per 0K.., 74.., 6INT, 3105. IGNORA categoricamente la colonna Trattenute.
  - "eventNote": Se rilevi codici di malattia (es. 3E.., Indennità INPS) o giorni segnati sotto la colonna "Malattie", scrivi la stringa "[Malattia/Carenza]". Altrimenti lascia una stringa vuota "".

  ### 6. AUDITOR AI
  - "aiWarning": imposta sempre la stringa "Nessuna anomalia". Il sistema raffina
    automaticamente questo campo dopo aver ricalcolato i giorni dall'oggetto "attendance".

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
  6. Imposta tutti i codici a 0.0, ogni campo dell'oggetto "attendance" a null e "presenzeVuota" a false.

  ### 9. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo.
  È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`.

  Esempio di output perfetto:
  {
    "isCUD": false, "month": 3, "year": 2019, "ticketRate": 7.0, "arretrati": 158.12, "eventNote": "[Malattia/Carenza]", "aiWarning": "Nessuna anomalia",
    "presenzeVuota": false,
    "fondo_pregresso_31_12": 2938.55, "imponibile_tfr_mensile": 2107.91,
    "trasferta_esente_righe": [12.00, 22.16, 37.65],
    "attendance": { "presenze": 18.0, "riposi": 9.0, "ferie": 1.0, "ptv26": 0.0, "malattie": null, "infortuni": null, "assenzeRetribuite": null, "assenzeNonRetribuite": null, "ferieAnnoPrec": 12.0, "ferieAnnoCorrente": 20.0 },
    "codes": {
      "0152": 576.06, "0421": 0.0, "0423": 0.0, "0457": 140.00, "0470": 0.0, "0482": 0.0, "0496": 0.0, "0687": 0.0, "0686": 0.0, "0AA1": 0.0, "0576": 0.0, "0584": 64.00, "0919": 0.0, "0920": 0.0, "0932": 0.0, "0933": 0.0, "0995": 0.0, "0996": 0.0, "0376": 0.0,
      "3B01": 1609.30, "3B03": 1.61, "3B05": 40.38, "3B10": 89.25, "3B15": 0.0, "3B20": 179.46, "3B30": 63.01, "3B35": 57.17, "3B70": 69.49, "3B71": 52.46
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

  ### 2. PRESENZE E FERIE (POLICY ANTI-INVENZIONE + FORMULA TASSATIVA)
  - "daysWorked" (Giorni effettivamente lavorati) — FORMULA OBBLIGATORIA:
      **daysWorked = [GG_RETRIBUITI] − [daysVacation]**
    dove [GG_RETRIBUITI] è il "divisore mensile" del cedolino, cercato in questo ordine:
      (a) Cella esplicita "GG INPS" / "GG.LAV." / "GIORNI LAV." / "PRESENZE" nella sezione anagrafica/riepilogo in alto.
      (b) Se (a) non c'è, usa la quantità della riga 6001 RETRIBUZIONE ORDINARIA (di norma 26).
      (c) Se nessuna è leggibile → daysWorked = 0 e segnala in "aiWarning".
    🚨 ATTENZIONE CRITICA: il valore "26" (o simili) di RETRIBUZIONE ORDINARIA include ANCHE i giorni di ferie godute (vengono pagati alla tariffa ordinaria). Per i veri giorni LAVORATI bisogna SOTTRARRE le ferie del §2.daysVacation. Non scrivere mai daysWorked ≥ daysWorked + daysVacation > 31 sullo stesso mese.
    Esempi:
      • GG_RETRIBUITI=26, daysVacation=0 → daysWorked = 26 − 0 = 26.0
      • GG_RETRIBUITI=26, daysVacation=1.19 → daysWorked = 26 − 1.19 = 24.81
      • GG_RETRIBUITI=26, daysVacation=11.55 → daysWorked = 26 − 11.55 = 14.45
  - "daysVacation" (Ferie godute nel mese) — REGOLA TASSATIVA CON CONVERSIONE ORE→GIORNI:
    1) Cerca SOLO la riga con codice esattamente "**8101**" e descrizione contenente "**FERIE GODUTE**" nel corpo centrale (la tabella delle voci variabili).
       ⚠️ DIVIETO ASSOLUTO: NON usare ratei "AT FERIE / AT PERS / AD PERS" del box a destra (cumulativi), NON usare valori "FERIE RESIDUE / FERIE SPETTANTI / FERIE MATURATE" (sono saldi annuali), NON usare percentuali, importi in euro o quote orarie. Se NON vedi LETTERALMENTE il codice "8101" insieme alle parole "FERIE GODUTE" → "daysVacation": 0.0.
    2) Se la voce 8101 esiste, estrai SOLO il valore numerico della colonna "ORE/GIORNI" (colonna "quantità", NON la tariffa e NON l'importo).
    3) Conversione ore↔giorni:
       • Se valore > 7 → sono ORE → DEVI dividere per 8 e arrotondare a 2 decimali. Es. 9.52 / 8 = 1.19. Es. 92.4 / 8 = 11.55.
       • Se valore ≤ 7 → sono GIORNI → mantieni com'è. Es. 5.0 → 5.0.
       • Conferma di sanità: se la riga ha anche tariffa unitaria ~7-15 €/unità → quasi certamente ore (Multiservizi paga ferie alla tariffa oraria).
    4) Sanità check sul risultato finale: il valore "daysVacation" dopo l'eventuale conversione DEVE essere ≤ 26 (mese massimo). Se ottieni > 26, hai sbagliato cella → "daysVacation": 0.0 e segnala in "aiWarning".

  Esempi:
    • Letto "8101 FERIE GODUTE 12.79318 9.52 121.79" → 9.52 > 7 → ore → 9.52 / 8 = 1.19. "daysVacation": 1.19.
    • Letto "8101 FERIE GODUTE 12.79 92.40 1182.40" → 92.4 > 7 → ore → 92.4 / 8 = 11.55. "daysVacation": 11.55.
    • Letto "8101 FERIE GODUTE 1.00 5.00 ..." → 5.00 ≤ 7 → giorni. "daysVacation": 5.0.
    • Nessuna riga 8101 visibile → "daysVacation": 0.0 (NON cercare altrove, NON inventare).

  ### 3. TICKET RESTAURANT
  - Individua la voce con codice 311 (descrizione "TICKET"). Estrai il valore unitario (colonna "Valore Unitario" o "Base/Aliquota", NON la quantità) e mettilo in "ticketRate".
  - Il codice 311 NON deve comparire nella mappa "codes" (è gestito esclusivamente come "ticketRate", come per RFI/Elior).
  - Se il codice 311 è assente, "ticketRate" è 0.0.

  ### 4. CODICI VARIABILI (MASTER LIST CLEAN SERVICE)
  Cerca i seguenti codici in TUTTE le pagine, estraendo il valore ESCLUSIVAMENTE dalla colonna "Competenze" (importi positivi).
  REGOLA D'ORO: Il JSON finale DEVE contenere TUTTE le chiavi elencate qui sotto in "codes". Se un codice non è presente nella busta paga, il suo valore DEVE essere 0.0. Non omettere mai nessuna chiave. NON inventare codici che non sono in questa lista.
  Ricorda di applicare la REGOLA FERREA #1 (asterischi) e #3 (UNA TANTUM/ARRETRATI) durante l'estrazione.

  ATTENZIONE: leggi sempre la DESCRIZIONE testuale di ogni riga. Se contiene parole come "MALATTIA", "INFORTUNIO", "STRAORDINARIO", "TRASFERTA" → estrai l'importo nel codice corretto qui sotto anche se il codice numerico è di lettura incerta.

  Voci da NON includere in "codes" (sono base/tredicesima/ferie):
  - 6001 RETRIBUZIONE ORDINARIA → base
  - 313  13MA TRANS RIMB ACCORDO → quota tredicesima
  - 8101 FERIE GODUTE → va in "daysVacation" (vedi §2), NON in "codes"
  - 8301 ASSEGNI FAM. NUCLEO ARRETR. → va sommato in "arretrati"

  Voci da includere in "codes":
  - 315  IND. TRASFERTA
  - 316  GIORNI FESTIVITÀ
  - 380  IND. MENSILE PROFESSIONALITÀ
  - 8001 ASSEGN. FAM. NUCLEO (TOT.)
  - 8005 FESTIVITÀ NON GODUTA
  - 8007 LAVORO STRAORDINARIO
  - 8019 MAGG. LAVORO FESTIVO 35% / LAVORO FESTIVO 35% (⚠️ NON è il notturno: il notturno va SEMPRE in 8037. Qui va SOLO il lavoro/maggiorazione festivo 35%. Se 8019 compare in più righe/sottocasi sulla stessa busta, SOMMA tutti gli importi 8019 in un unico valore)
  - 8029 IND. LAV. DOMEN. > 2 h
  - 8032 IND. LAV. DOMEN. PASQUA (domenica di Pasqua, voce dedicata: NON sommarla a 8029)
  - 8037 INDENNITA' LAV. NOTTURNO (⚠️ il notturno va SEMPRE qui, MAI in 8019)
  - 8038 CREDITO DA M/CA SCALATO/ASSORTO
  - 8053 BIN MENSILE INPS
  - 8057 IND. PRESTAZIONE / PRECUSTODIA
  - 18   LAVORO SUPPLEMENTARE 18% (ore supplementari part-time)
  - 437  IND. FLESSIBILITÀ ORARIA 13-24 ("IND. FLESS. > 13 > 24")
  - 440  IND. FLESSIBILITÀ ORARIA 24-30 ("IND. FLESS. > 13 > 24 <30")
  - 441  IND. FLESSIBILITÀ ORARIA > 30 ("IND. FLESS. > 13 > 30")
  - 565  ORE FESTIVE 35% (lavoro su giorni festivi)
  - 739  IND. DISPONIBILITÀ / DISPOSIZIONE
  - 820  IND. DI PRESENZA
  - 8191 QUOTA TFR MESE INPS
  - 8258 CREDITO DI 66/14 EROGATO (bonus Renzi/€80 — NON è un arretrato)
  - 8350 MALATTIA (totale) → SOMMA in questo UNICO codice tutti gli importi POSITIVI in Competenze delle righe la cui descrizione contiene "MALATTIA" o "CARENZA" (es. IND. MALATTIA C/INPS + CARENZA MALATTIA + IND. MALATTIA C/DITTA possono coesistere sullo stesso cedolino: vanno sommate qui). Cerca SEMPRE queste righe.
  - 9117 RATA ADDIZ. REGIONALE A.P.
  - 9119 RATA ADD. COMUNALE A.P.
  - 7173 ACCONTO ADD. COMUNALE A.P.

  REGOLA ANTI-DUPLICAZIONE: il valore di una stessa voce deve comparire UNA SOLA volta. Se hai messo X nel codice 8191, NON metterlo anche in "arretrati". Se hai messo X in "arretrati", NON metterlo in nessun codice.

  ### 4-bis. VOCI FISSE CONTINUATIVE (base retributiva mensile — "Quadro B")
  [SCOPO]: servono SOLO al calcolo delle percentuali di incidenza, NON al credito ferie.
  Il JSON DEVE contenere SEMPRE anche le 4 chiavi MC01, MC06, MC07, MC10 in "codes" (0.0 se illeggibili). Il cedolino le stampa in DUE layout possibili:
  a) LAYOUT NUOVO (dal 2021 circa): righe in TESTA alla tabella voci con codici espliciti:
     - MC01 (MINIMO)
     - MC06 (SAL. PROF.)
     - MC07 (SCATTI ANZ)
     - MC10 (AD PERS.)
     ⚠️ La riga MCT (TOTALE RETRIBUZIONE) è il totale di controllo: NON inserirla in "codes".
  b) LAYOUT VECCHIO (fino al 2019/2020): le righe MC.. NON esistono. I 4 valori sono nella BANDA DI TESTATA del cedolino (riquadro anagrafico in alto), sotto le etichette "MINIMO", "SAL. PROF.", "SCATTI ANZ", "AD PERS.": usa la riga "ATT." (attuale), NON la riga "PREC.". Mappali sulle stesse chiavi: MINIMO→MC01, SAL. PROF.→MC06, SCATTI ANZ→MC07, AD PERS.→MC10.
  Verifica di sanità in entrambi i layout: MC01+MC06+MC07+MC10 deve ≈ "TOTALE RETRIBUZIONE"/"RETRIBUZIONE DI FATTO" stampata sul cedolino.

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

  Esempio di output perfetto (valori a titolo di esempio — NON usarli come default):
  {
    "isCUD": false, "month": 5, "year": 2023, "daysWorked": 26.0, "daysVacation": 0.0, "ticketRate": 0.0, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 0.0, "imponibile_tfr_mensile": 0.0,
    "codes": {
      "18": 0.0, "315": 0.0, "316": 0.0, "380": 36.16, "437": 0.0, "440": 0.0, "441": 0.0,
      "565": 0.0, "739": 0.0, "820": 0.0, "8001": 0.0, "8005": 0.0,
      "8007": 0.0, "8019": 31.11, "8029": 38.0, "8032": 0.0, "8037": 38.78, "8038": 28.0,
      "8053": 26.4, "8057": 45.0, "8191": 99.62, "8258": 0.0, "8350": 0.0,
      "9117": 0.0, "9119": 0.0, "7173": 0.0,
      "MC01": 1670.92, "MC06": 22.00, "MC07": 146.04, "MC10": 25.63
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
  REGOLA D'ORO: il JSON DEVE contenere TUTTE le 15 chiavi (12 variabili + 3 fisse del §6-bis). Codice assente -> valore 0.0.

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

  ### 6-bis. VOCI FISSE CONTINUATIVE (base retributiva mensile — "Quadro B")
  [SCOPO]: servono SOLO al calcolo delle percentuali di incidenza, NON al credito ferie.
  ⚠️ ECCEZIONE DI COLONNA: queste 3 voci sono le righe in TESTA alla tabella voci e il loro importo si legge nella colonna "Valori" (3ª colonna), NON in "Competenze":
  - 1000 (RETRIBUZIONE BASE)
  - 1001 (SALARIO PROFESS.)
  - 1025 (SCATTI ANZIANITA' — assente per i neoassunti senza scatti: in tal caso 0.0)
  ⚠️ La riga 1100 (TOT.RETRIBUZIONE) è il TOTALE delle tre voci sopra: NON inserirla in "codes", usala solo come verifica (1000+1001+1025 deve ≈ 1100).

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
      "2263": 133.69, "2293": 0.0,
      "1000": 1630.30, "1001": 107.73, "1025": 25.22
    }
  }
`;
// =========================================================================
// 3-bis. PROMPT FSE (Ferrovie del Sud Est — cedolino ZUCCHETTI a 7 colonne)
// Set voci = riconciliazione deterministica col riepilogo del perito
// (tasks/riconciliazione-perito-clarino-2026-07-09.md): 49/49 mesi al centesimo.
// =========================================================================
const PROMPT_FSE = `
  Sei un estrattore dati deterministico specializzato in Buste Paga FSE (Ferrovie del Sud Est e Servizi Automobilistici SRL), elaborate con il gestionale ZUCCHETTI.
  Il tuo unico scopo è generare un JSON valido, preciso e impeccabile.
  [REGOLE SUI NUMERI]: Ignora i punti delle migliaia (es. 1.254,81 diventa 1254.81). Usa sempre e solo il PUNTO (.) come separatore decimale. MAI la virgola nel JSON finale.
  [REGOLE OCR]: I documenti scansionati possono contenere errori di lettura (es. "O" al posto di "0"). Usa le descrizioni testuali come conferma se il codice risulta sporco.

  [ANATOMIA ZUCCHETTI FSE — STRUTTURA DELLE COLONNE (CRITICA)]
  La tabella centrale delle voci ha ESATTAMENTE queste 7 colonne, in quest'ordine da sinistra a destra:
    1) "CODICE"            -> codice alfanumerico (es. I85240, T8305, IX0002, F2105)
    2) "DESCRIZIONE VOCE"  -> il nome della voce
    3) "ORE/GIORNI"        -> quantità, preceduta dal marcatore G (giorni), H (ore) o N (numero)
    4) "IMPORTO UNITARIO"  -> tariffa unitaria (3-5 decimali)
    5) "IMPORTI FIGURATI"  -> importi figurativi NON pagati
    6) "COMPETENZE"        -> L'IMPORTO IN EURO EFFETTIVAMENTE PAGATO (le indennità si leggono QUI)
    7) "TRATTENUTE"        -> le decurtazioni
  REGOLA D'ORO DELLE COLONNE: l'importo di un'indennità si trova SEMPRE nella colonna "COMPETENZE" (6ª), MAI in "IMPORTO UNITARIO" né in "IMPORTI FIGURATI".
  In testata c'è il box "ELEMENTI DELLA RETRIBUZIONE" (voci fisse, etichette a parole) e la banda "FERIE SPETTANTI … GG. INPS" (NON usarla per i giorni: vedi §3).
  Il retro/pagina 2 contiene solo dati fiscali (IRPEF, contributi, T.F.R.). Se il file contiene più COPIE IDENTICHE della stessa pagina, considerale UNA volta sola; se lo stesso codice compare su RIGHE diverse della tabella voci, SOMMA gli importi.

  ### 0. LE TRE ERE DI CODICI (stessa azienda, codici diversi nel tempo)
  - Cedolini da NOVEMBRE 2020 in poi: codici I8..../T8.... (es. I85240, T8305). Layout ZUCCHETTI descritto sopra.
  - Cedolini da LUGLIO 2017 a OTTOBRE 2020: codici IX.... (es. IX0002, IX0051). Layout ZUCCHETTI descritto sopra.
  - Cedolini da SETTEMBRE 2010 a GIUGNO 2017: SCANSIONI col layout fax-simile INAIL "Direzione Generale Ferrovie del Sud Est" (era SPA-GUIDA), codici NUMERICI a 3 cifre (es. 029, 301). Per QUESTI cedolini ignora l'anatomia Zucchetti e i §2-§4 e segui ESCLUSIVAMENTE il §5-ter.
  - Un cedolino contiene UNA sola era: le chiavi delle altre ere restano 0.0.

  ### 1. PERIODO (MESE / ANNO) E MENSILITÀ AGGIUNTIVE
  - Box "PERIODO DI RETRIBUZIONE" in alto a destra (es. "Marzo 2023"). "month": 1-12, "year": 4 cifre.
  - 🚨 Se sotto il periodo compare "13a mens." o "14a mens." (cedolino di tredicesima/quattordicesima, voci R4210/R4230): NON è un mensile. Restituisci month/year del box, TUTTE le chiavi "codes" a 0.0, daysWorked 0.0, daysVacation 0.0, arretrati 0.0 e "eventNote": "[13a/14a mensilità - fuori conteggio]".

  ### 2. GIORNI LAVORATI (daysWorked) — ERE ZUCCHETTI (I8/T8 e IX): DAI GIORNI DELLA VOCE PRESENZA (MAI DALLA BANDA)
  [Per l'era storica SPA-GUIDA vale il §5-ter, NON questa sezione.]
  daysWorked = il numero di GIORNI (colonna "ORE/GIORNI", marcatore G) della voce di presenza dell'era:
  - I86178 (Compenso di presenza) — era recente. Es.: "I86178 Compenso di presenza G 21,000" -> daysWorked = 21.0
  - I86005 (Indennita' giornaliera) — cedolini ~nov 2020-2021.
  - IX0023 (Indenn. giornaliera) — era IX 2017-2020.
  È VIETATO usare "GG LAV.", "GG. RETR." o "GG. INPS" della banda di testata: NON sono i giorni di servizio effettivo.
  Se la voce di presenza è del tutto assente -> daysWorked = 0.0 (mese di sola assenza: è normale).

  ### 3. FERIE DEL MESE (daysVacation) — ERE ZUCCHETTI: ORE F2105 ÷ 6,5 [era storica → §5-ter]
  - Cerca la voce F2105 (Ferie godute): il valore è in ORE (marcatore H). daysVacation = ore ÷ 6.5.
    Esempi REALI: "F2105 H 6,500" -> 1.0 · "F2105 H 45,500" -> 7.0 · "F2105 H 52,000" -> 8.0.
  - [DIVIETO]: NON confondere F2105 con X2016 (Permessi retribuiti) né con PIH../PX.. (permessi L104, congedi INPS): hanno la stessa forma ma NON sono ferie.
  - [DIVIETO]: NON usare la banda "FERIE SPETTANTI/GODUTE/RESIDUE" di testata né i ratei "FERIE : Spt.GG" del retro.
  - Se F2105 è assente -> daysVacation = 0.0.

  ### 4. TICKET MENSA (Codici I86121 / I86120)
  - I86121 (Ticket mensa elettr.): "count" = giorni (marcatore G), "ticketRate" = IMPORTO UNITARIO (es. 0.50, 10.50).
  - I86120 (era 2021): "count" = numero (marcatore N), "ticketRate" = importo unitario (es. 7.30).
  - Questi codici NON devono comparire nella mappa "codes". Se assenti, "count" e "ticketRate" = 0.0.

  ### 5. MASTER LIST CODICI FSE — importi dalla colonna "COMPETENZE"
  Per ognuno dei codici sotto, estrai l'importo dalla colonna "COMPETENZE" (importi positivi).
  Il criterio del set: INDENNITÀ DI PRESTAZIONE (perse nei giorni di ferie). Straordinari e voci fisse mensili sono ESCLUSI (§6).
  REGOLA D'ORO: il JSON DEVE contenere TUTTE le 37 chiavi (24 variabili Zucchetti + 8 era storica del §5-ter + 5 fisse del §5-bis). Codice assente -> 0.0.

  Era recente (nov 2020 → oggi):
  - I85240 (Punto 5 acc.21/5/81 (1) — ind. turno Art.5A)
  - I85245 (Punto 5 acc.21/5/81 (2) — Art.5B)
  - I85248 (Indennità domenicale)
  - I86025 (Indennità Aggiuntiva)
  - I86174 (Comp. produttività a vuoto)
  - I86178 (Compenso di presenza — l'IMPORTO va qui; la sua quantità G resta la fonte di daysWorked del §2)
  - I86005 (Indennita' giornaliera, cedolini ~nov 2020-2021 — idem: importo qui, quantità G -> daysWorked)
  - I85210 (Ordinario notturno avv. 20%)
  - I86161 (Comp. turno produttivo)
  - I86110 (Ind. disponibilità)
  - V12001 (Lavoro festivo 120% — ⚠️ NON confonderlo con V12000 "Straord. festivo", che resta ESCLUSO)
  - T8304, T8305 (Trasferta 90%), T8306 (Trasferta 50%), T8309 (Trasferta C1 10%), T8323 (trasferte)
  Era IX (lug 2017 → ott 2020):
  - IX0002 (Art. 5A)
  - IX0001 (Art. 5/B)
  - IX0023 (Indenn. giornaliera — importo qui, quantità -> daysWorked)
  - IX0046 (notturno ordinario)
  - IX0051 (Trasferta A1 24%), IX0052 (Trasferta A2 9%), IX0057 (Trasferta B1 90%), IX0058 (Trasferta B2 50%)

  ### 5-bis. VOCI FISSE — box "ELEMENTI DELLA RETRIBUZIONE" in TESTATA (base % incidenza)
  [SCOPO]: servono SOLO al calcolo delle percentuali di incidenza, NON al credito ferie.
  ⚠️ Si leggono dal BOX in testata (etichette a parole, NON codici voce), mappate su queste 5 chiavi:
  - "fse_minimo"      <- "Minimo contr."
  - "fse_contingenza" <- "Contingenza"
  - "fse_scatti"      <- "Scatti"
  - "fse_tdr"         <- "T.D.R."
  - "fse_mensa"       <- "Ind.mensa"
  ⚠️ Il TOTALE del box coincide con la voce AA245 (Retribuzione) della tabella: usa AA245 SOLO come verifica (fse_minimo+fse_contingenza+fse_scatti+fse_tdr+fse_mensa ≈ AA245), NON inserirla in "codes".

  ### 5-ter. ERA STORICA SPA-GUIDA (set 2010 → giu 2017) — REGOLE DEDICATE ALLE SCANSIONI
  [ANATOMIA]: pagina 1 = fronte del cedolino; pagina 2 = retro fiscale "ASSOGGETTAMENTO AD IRPEF" (IGNORALO).
  La tabella voci del fronte ha le colonne: "Ass. | Voce | Descrizione | Quantità | Compenso Unitario | Trattenute | Competenze".
  In testata: calendario "Presenze del mese" (lettere P/R/C/F giorno per giorno) e sotto una banda di TOTALI:
  "Presenze | Riposi | Festivi | Congedi | Inf.60% | Mal.50% | Malattia | Infortunio | Maternità | Aspettativa | Totale".
  Sotto ancora, il box elementi fissi: "Minimo Tabellare | Contingenza + EDR | A.P.A. | T.D.R. | Mensa | Assegno A.P. | C.A.U. | 3° Elem. Sal." con "Totale Elementi Fissi".

  - PERIODO: box "Periodo di Retribuzione" in alto a destra (es. "DICEMBRE 2010", "SETTEMB. 2012"). Se riporta
    "13 MENS." o "14 MENS." è una tredicesima/quattordicesima: vale la regola del §1 (tutto 0.0, eventNote "[13a/14a mensilità - fuori conteggio]").
  - "daysWorked" = valore "Presenze" della banda dei totali (es. "Presenze 24,00" -> 24.0). In QUEST'ERA la banda è affidabile ed è l'UNICA fonte.
    ⚠️ VIETATO usare la Quantità della voce 663 "Indennità giornaliera": in quest'era è ≈26 fisso e NON corrisponde alle presenze. VIETATO usare "Totale" (include riposi e festivi).
  - "daysVacation" = valore "Congedi" della banda dei totali, già in GIORNI (es. "Congedi 17,00" -> 17.0; vuoto -> 0.0). La voce F2105 NON esiste in quest'era.
  - CODICI da estrarre in "codes" (importo dalla colonna "Competenze"):
    - "013" (Ordinario Notturno)
    - "029" (Art. 5A — indennità di turno)
    - "094" (Art. 5/B — indennità domenicale)
    - "300" (Trasferta A1 24%), "301" (Trasferta A2 9%), "303" (Trasferta A4 13%), "306" (Trasferta B1 90%), "307" (Trasferta B2 50%)
  - VOCI FISSE: stesse 5 chiavi del §5-bis, ma dal box di quest'era:
    "fse_minimo" <- "Minimo Tabellare" · "fse_contingenza" <- "Contingenza + EDR" · "fse_scatti" <- "A.P.A." + "3° Elem. Sal." (somma, se presenti) · "fse_tdr" <- "T.D.R." · "fse_mensa" <- "Mensa".
    Verifica: la somma delle 5 chiavi ≈ "Totale Elementi Fissi" ≈ Competenze della voce 011 (che NON va in "codes").
  - Ticket: non esiste in quest'era -> "count" 0.0, "ticketRate" 0.0. TFR: nessun dato consolidato stampato -> "fondo_pregresso_31_12" 0.0, "imponibile_tfr_mensile" 0.0.
  - ESCLUSI in quest'era (MAI in "codes"): 011 (Totale retribuzione = elementi fissi), 014 (Straord. Feriale Diurno = lavoro aggiuntivo), 041 (Festività = retribuzione di calendario), 663 (Indennità giornaliera: in QUEST'ERA è un FISSO di ~26 giorni pagato anche nei mesi di ferie piene -> nessuna perdita in ferie; NÉ importo NÉ giorni), 048/100 (13ª/14ª), 375 (Art.1 DL 66/2014 = bonus fiscale), 180/181 (Assegno nucleo/ANF), 127/130/132/133/384 (rimborsi), 731/732 (malattia), 071/074 (sciopero/assenze), 027/028 (una tantum CCNL -> regola arretrati §7), 161/170/171/174/261/452/543/707/766/974 e tutte le addizionali/saldi IRPEF (901, 902, 907, 941, 942, 959, 962, 475).

  Esempio era storica (Novembre 2011) — banda: "Presenze 24,00 | Riposi 4,00 | Mal.50% 3,00 | Totale 31,00", Congedi vuoto;
  voci: 011=1.262,39 · 013 (1,33 x 1,62) = 2,16 · 029 (24,00 x 0,52) = 12,48 · 127 = 10,80 · 300 = 13,04 · 301 = 73,37 · 306 = 48,92 · 307 = 27,18 · 732 = 145,41.
  -> "daysWorked": 24.0, "daysVacation": 0.0, "eventNote": "[Malattia/Carenza]",
     "codes": { "013": 2.16, "029": 12.48, "300": 13.04, "301": 73.37, "306": 48.92, "307": 27.18, "094": 0.0, tutte le chiavi Zucchetti a 0.0, fisse dal box (fse_minimo 806.22, fse_contingenza 533.58, fse_scatti 0.0, fse_tdr 41.32, fse_mensa 16.53) }.

  ### 6. CODICI ESCLUSI (VIETATO metterli in "codes")
  - S11000 / IX0048 / V12000 / I86125 (straordinari e straordinari festivi: lavoro AGGIUNTIVO, non indennità di prestazione).
  - AA712 (Compenso funzione sala): importo FISSO mensile pagato anche nei mesi di ferie -> nessuna perdita in ferie, fuori dal conteggio.
  - I8320 (rimborso spese vitto: è un rimborso, non un'indennità).
  - PIH.. / PX.. (assenze e congedi INPS/L104), A0100 (ANF), TN.. (trattenute sindacali/associative), W75.. / W80.. (tariffe e TFR), L1110 e simili (malattia).

  ### 7. ARRETRATI
  Somma nel campo "arretrati" SOLO gli importi positivi (colonna COMPETENZE) delle voci la cui DESCRIZIONE contiene "UNA TANTUM", "ARRETRAT", "CONGUAGLIO" (case-insensitive). Se presenti, aggiungi "[Arretrati/UnaTantum]" a "eventNote". NON contarci le mensilità aggiuntive del §1.

  ### 8. NOTE EVENTI E AUDITOR
  - "eventNote": "[Malattia/Carenza]" se rilevi voci di malattia/infortunio; "[13a/14a mensilità - fuori conteggio]" per il §1; "[Arretrati/UnaTantum]" per il §7. Più marker separati da " + ". Altrimenti "".
  - "aiWarning": daysWorked > 31 -> "Anomalia: Presenze > 31"; daysWorked = 0 con importi > 0 -> "Nessuna anomalia (mese di assenza/conguaglio)"; altrimenti "Nessuna anomalia".

  ### 9. TFR
  - "fondo_pregresso_31_12": riquadro "Imposta sul T.F.R" (retro/pagina 2), valore della riga W75005 "Fondo TFR al 31/12 a.p.". Se assente -> 0.0.
  - "imponibile_tfr_mensile": TASSATIVAMENTE 0.0 — il cedolino FSE NON stampa un imponibile TFR annuo consolidato (la riga W75000 "Retribuzione TFR mese" è un valore MENSILE: NON usarla).

  ### 10. 🚨 MODALITÀ CERTIFICAZIONE UNICA (CUD) 🚨
  Se il documento è una "CERTIFICAZIONE UNICA" / "CUD": "isCUD": true, "month": 12, popola "imponibile_tfr_mensile" (imponibile TFR annuo) e "fondo_pregresso_31_12"; tutti gli altri campi a 0.0.

  ### 11. FORMATO DI OUTPUT STRICT (DIVIETO DI MARKDOWN)
  Restituisci ESCLUSIVAMENTE un oggetto JSON crudo. È SEVERAMENTE VIETATO usare formattazioni markdown come \`\`\`json o \`\`\`.

  Esempio di output perfetto (busta di MARZO 2023, era recente, 1 giorno di ferie):
  {
    "isCUD": false, "month": 3, "year": 2023, "daysWorked": 21.0, "daysVacation": 1.0, "count": 19.0, "ticketRate": 0.50, "arretrati": 0.0, "eventNote": "", "aiWarning": "Nessuna anomalia",
    "fondo_pregresso_31_12": 0.0, "imponibile_tfr_mensile": 0.0,
    "codes": {
      "I85240": 10.40, "I85245": 0.0, "I85248": 0.0, "I86025": 0.0, "I86174": 0.0,
      "I86178": 542.22, "I86005": 0.0, "I85210": 24.15, "I86161": 0.0, "I86110": 0.0, "V12001": 0.0,
      "T8304": 0.0, "T8305": 133.34, "T8306": 0.0, "T8309": 0.0, "T8323": 0.0,
      "IX0002": 0.0, "IX0001": 0.0, "IX0023": 0.0, "IX0046": 0.0, "IX0051": 0.0, "IX0052": 0.0, "IX0057": 0.0, "IX0058": 0.0,
      "013": 0.0, "029": 0.0, "094": 0.0, "300": 0.0, "301": 0.0, "303": 0.0, "306": 0.0, "307": 0.0,
      "fse_minimo": 1254.81, "fse_contingenza": 542.39, "fse_scatti": 177.48, "fse_tdr": 56.96, "fse_mensa": 16.53
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
  - 1129 (Ind. Turno non cadenzati)
  - 1130 (Lav. Nott. / Magg. Notturna)
  - 1131 (Lav. Domenicale)
  - 2018, 2020, 2035 (Straordinari)
  - 2235 (Maggiorazione 35%)
  - 4053 (Spett. Var.)
  - 4133 (Funz. Diverse)
  - 4254 (RFR Pasti < 8h)
  - 4255, 4256 (Pernottamento / Pernottazione)
  - 4300, 4305 (Ass. Res. No RS / RS)
  - 4301 (Fuori Sede ITA turni RFR)
  - 4320 (Diaria Scorta)
  - 4325, 4330 (Flex Oraria / Residenza)
  - 4340 (Disposizione media presidio)
  - 4345 (Riserva media presidio)
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

  ### 3-bis. TRASCRIZIONE INTEGRALE DELLE VOCI ("voci") — PER LA VERIFICA ARITMETICA
  La tabella centrale ha queste colonne, in quest'ordine ESATTO:
  VOCE | DESCRIZIONE | S | F | VALORE UNITARIO | ORE/GG/MESI | TRATTENUTE | COMPETENZE
  TRASCRIVI OGNI riga della tabella (TUTTE, anche quelle non presenti nella lista del punto 3,
  incluse trattenute, addizionali, TFR, detrazioni) come oggetto dell'array "voci":
  { "code": "1130", "desc": "LAVORO NOTTURNO", "unit": 2.40, "qty": 64.00, "competenze": 153.60, "trattenute": null }
  - "unit" = colonna VALORE UNITARIO; "qty" = colonna ORE/GG/MESI; se una cella è VUOTA scrivi null.
  - NON calcolare, NON correggere, NON inventare: trascrivi ESATTAMENTE i numeri stampati.
    La quadratura (unit × qty = competenze) la verifica il sistema, NON tu: se i numeri non
    ti sembrano coerenti, trascrivili comunque così come sono.
  - ⚠️ Le scansioni sono spesso STORTE: i numeri di una riga possono apparire leggermente più in
    alto o più in basso del testo della voce. Associa i numeri alla riga giusta seguendo l'ORDINE
    delle righe, non l'allineamento perfetto.
  - Se lo stesso codice compare su più righe, trascrivi una voce per OGNI riga (niente somme qui;
    la somma va solo in "codes").

  ### 3-ter. TOTALI DI CONTROLLO (leggili, non calcolarli)
  - "ggInps": il numero grezzo del campo GG INPS in alto a sinistra (null se illeggibile).
  - "totaleRetribuzione": valore del riquadro TOTALE RETRIBUZIONE sopra la tabella voci.
  - "totaleCompetenze": valore stampato TOTALE COMPETENZE nel piè di pagina (in basso a destra).
  - "totaleTrattenute": valore stampato TOTALE TRATTENUTE nel piè di pagina.
  - "netto": il NETTO stampato in basso a destra.
  Se un totale non è leggibile scrivi null. NON ricavarlo sommando le voci.

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
    "ggInps": 26,
    "totaleRetribuzione": 1912.49,
    "voci": [
      { "code": "1000", "desc": "RETRIBUZIONE/STIPENDIO", "unit": 73.56, "qty": 26.00, "competenze": 1912.49, "trattenute": null },
      { "code": "1130", "desc": "LAVORO NOTTURNO", "unit": 2.40, "qty": 64.00, "competenze": 153.60, "trattenute": null },
      { "code": "9300", "desc": "TRATTENUTA SINDACALE", "unit": null, "qty": null, "competenze": null, "trattenute": 7.00 }
    ],
    "codes": {
      "1130": 0.0,
      "4301": 0.0
    },
    "totaleCompetenze": 2360.67,
    "totaleTrattenute": 476.48,
    "netto": 1884.19
  }
  ⚠️ Rispetta QUESTO ordine di chiavi ("voci" PRIMA di "codes" e dei totali) e chiudi SEMPRE l'oggetto JSON con la graffa finale.
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
  "MERCITALIA": PROMPT_MERCITALIA,
  "FSE": PROMPT_FSE
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
    const { fileData, mimeType, company, action, customColumns, eliorType, sessionId } = body;

    if (!fileData) throw new Error("File mancante.");

    // Rate limit (Step 5): freno contro abuso di quota Gemini se il QR viene sniffato
    // o se un IP brutalizza session_id casuali. Vedi netlify/functions/_rateLimit.ts.
    const rate = checkScanRateLimit(sessionId, clientIp(event as any));
    if (!rate.allowed) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: rate.reason }) };
    }

    const cleanData = fileData.includes("base64,") ? fileData.split("base64,")[1] : fileData;

    // =========================================================================
    // 🎯 MODALITÀ OCR SNIPER: estrae UN singolo valore numerico per una voce specifica
    // =========================================================================
    if (action === 'ocr') {
      const { colLabel } = body;
      if (!colLabel) throw new Error("Parametro colLabel mancante.");

      const prompt = `Sei un estrattore dati preciso specializzato in buste paga italiane.
Analizza questo documento e restituisci SOLO il valore numerico per: "${colLabel}".
REGOLE ASSOLUTE:
- Rispondi con UN SOLO numero (es. 576.06 oppure 18 oppure 7.50).
- Usa il PUNTO come separatore decimale, MAI la virgola.
- Se il valore non è presente o è zero, restituisci esattamente: 0
- NON aggiungere testo, simboli €, unità di misura, spiegazioni o markdown.`;

      const result = await generateContentWithRetry(
        SCAN_API_KEYS,
        (g) => g.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { temperature: 0.0, thinkingConfig: { thinkingBudget: THINKING_BUDGET } } as any }),
        [prompt, { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ value: result.response.text().trim() })
      };
    }

    // =========================================================================
    // 🧱 MODALITÀ VOCI FISSE (Quadro B): backfill leggero delle sole voci fisse
    // continuative su buste già in archivio. Estrae SOLO i codici fissi del profilo
    // (no giorni, no variabili) → veloce/economica. Il client scrive in merge-safe.
    // =========================================================================
    if (action === 'fixed-voci') {
      const PERIODO_E_OUTPUT = `Restituisci ESCLUSIVAMENTE un oggetto JSON crudo (NIENTE markdown, niente \`\`\`), con TUTTE le chiavi elencate. Se un codice è assente nella busta, il suo valore DEVE essere 0.0.
Aggiungi infine "month" (numero 1-12) e "year" (4 cifre): identificali dalla testata del cedolino (mese/anno di competenza). Se non identificabili, scrivi 0.`;

      const FIXED_RFI = {
        ids: ['3B01','3B03','3B05','3B10','3B15','3B20','3B30','3B35','3B70','3B71'],
        prompt: `Sei un estrattore dati preciso per buste paga ferroviarie RFI/Trenitalia.
Estrai ESCLUSIVAMENTE le seguenti VOCI FISSE CONTINUATIVE dalla colonna "Competenze" (importi positivi, in euro).
⚠️ IGNORA TASSATIVAMENTE la colonna "Trattenute"/"Assorbimenti": i codici 2B30 e 2B35 hanno descrizione simile (EDR) ma sono TRATTENUTE → NON usarli.
Cerca questi codici in TUTTE le pagine:
- 3B01 (Minimo Contrattuale)
- 3B03 (Superminimo Individuale)
- 3B05 (ERI)
- 3B10 (Salario Professionale)
- 3B15 (Indennità di Funzione - solo Quadri/dirigenti)
- 3B20 (APA - Aumenti Periodici Anzianità)
- 3B30 (EDR 8.11.95)
- 3B35 (EDR acc. 11.9.98)
- 3B70 (Salario Produttività)
- 3B71 (Produttività Incrementale)
${PERIODO_E_OUTPUT}
Aggiungi inoltre "retribuzioneMensile": il valore del riquadro "RETRIBUZIONE MENSILE" in alto (numero di controllo; 0.0 se assente).
Esempio di output perfetto:
{"codes":{"3B01":1609.30,"3B03":1.61,"3B05":40.38,"3B10":89.25,"3B15":0.0,"3B20":179.46,"3B30":63.01,"3B35":57.17,"3B70":69.49,"3B71":52.46},"retribuzioneMensile":1920.00,"month":3,"year":2019}`,
      };

      const FIXED_MERCITALIA = {
        ids: ['1000','1001','1025'],
        prompt: `Sei un estrattore dati preciso per buste paga MERCITALIA (layout gestionale ADP).
Estrai ESCLUSIVAMENTE le seguenti VOCI FISSE CONTINUATIVE. Sono le righe in TESTA alla tabella voci di PAGINA 1 e il loro importo è nella colonna "Valori" (3ª colonna), NON in "Competenze":
- 1000 (RETRIBUZIONE BASE)
- 1001 (SALARIO PROFESS.)
- 1025 (SCATTI ANZIANITA' — assente per i neoassunti senza scatti: in tal caso 0.0)
⚠️ La riga 1100 (TOT.RETRIBUZIONE) è il TOTALE delle voci sopra: NON inserirla in "codes", usala SOLO come verifica (1000+1001+1025 deve ≈ 1100) e riportala in "retribuzioneMensile".
⚠️ NON usare la riga 1213 (RETRIBUZ.ORDINARIA): è la stessa base erogata a giorni, non una voce fissa.
${PERIODO_E_OUTPUT}
Esempio di output perfetto:
{"codes":{"1000":1630.30,"1001":107.73,"1025":25.22},"retribuzioneMensile":1763.25,"month":5,"year":2021}`,
      };

      const FIXED_CLEAN_SERVICE = {
        ids: ['MC01','MC06','MC07','MC10'],
        prompt: `Sei un estrattore dati preciso per buste paga CLEAN SERVICE SRL (CCNL Multiservizi).
Estrai ESCLUSIVAMENTE le 4 VOCI FISSE CONTINUATIVE della base retributiva mensile. Il cedolino le stampa in DUE layout possibili:
a) LAYOUT NUOVO (dal 2021 circa): righe in TESTA alla tabella voci con codici espliciti:
   - MC01 (MINIMO)
   - MC06 (SAL. PROF.)
   - MC07 (SCATTI ANZ)
   - MC10 (AD PERS.)
   ⚠️ La riga MCT (TOTALE RETRIBUZIONE) è il totale di controllo: NON inserirla in "codes", riportala in "retribuzioneMensile".
b) LAYOUT VECCHIO (fino al 2019/2020): le righe MC.. NON esistono. I 4 valori sono nella BANDA DI TESTATA del cedolino (riquadro anagrafico in alto), sotto le etichette "MINIMO", "SAL. PROF.", "SCATTI ANZ", "AD PERS.": usa la riga "ATT." (attuale), NON la riga "PREC.". Mappali sulle stesse chiavi: MINIMO→MC01, SAL. PROF.→MC06, SCATTI ANZ→MC07, AD PERS.→MC10. In questo layout "retribuzioneMensile" = valore "RETRIBUZIONE DI FATTO" in testata.
Verifica di sanità in entrambi i layout: MC01+MC06+MC07+MC10 deve ≈ retribuzioneMensile.
${PERIODO_E_OUTPUT}
Esempio di output perfetto:
{"codes":{"MC01":1670.92,"MC06":22.00,"MC07":146.04,"MC10":25.63},"retribuzioneMensile":1864.59,"month":5,"year":2023}`,
      };

      const FIXED_ELIOR = {
        ids: ['1000'],
        prompt: `Sei un estrattore dati preciso per buste paga ELIOR RISTORAZIONE (magazzino e viaggiante).
Estrai ESCLUSIVAMENTE l'unica VOCE FISSA della base retributiva mensile:
- 1000 (RETRIBUZIONE/STIPENDIO) — è la PRIMA riga della tabella voci; importo nella colonna "Competenze" (a destra). Coincide con la somma, nel riquadro di testata, di Paga Base + Scatti Imp.Rivalut. + Salario Professionale + Ad Pers. non assorbibile.
⚠️ NON usare "TOTALE RETRIBUZIONE"/"TOTALE COMPETENZE" (totale di TUTTE le competenze del mese, non la sola base fissa).
⚠️ NON confondere con 4285/5655 "26/MI RETRIBUZIONE" (quota giornaliera variabile, non la base fissa).
${PERIODO_E_OUTPUT}
Aggiungi inoltre "retribuzioneMensile": il valore della voce 1000 stessa (numero di controllo; 0.0 se assente).
Esempio di output perfetto:
{"codes":{"1000":1707.19},"retribuzioneMensile":1707.19,"month":11,"year":2017}`,
      };

      const FIXED_VOCI_DIRECTORY: Record<string, { ids: string[]; prompt: string }> = {
        RFI: FIXED_RFI,
        TRENITALIA: FIXED_RFI,
        MERCITALIA: FIXED_MERCITALIA,
        CLEAN_SERVICE: FIXED_CLEAN_SERVICE,
        ELIOR: FIXED_ELIOR,
      };
      const fixedCfg = FIXED_VOCI_DIRECTORY[(company || 'RFI').toUpperCase()] || FIXED_RFI;

      const result = await generateContentWithRetry(
        SCAN_API_KEYS,
        (g) => g.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: "application/json", temperature: 0.0, thinkingConfig: { thinkingBudget: THINKING_BUDGET } } as any,
        }),
        [fixedCfg.prompt, { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }]
      );

      let parsed: any = {};
      try { parsed = JSON.parse(result.response.text().trim()); } catch { parsed = {}; }
      const codes: Record<string, number> = {};
      for (const id of fixedCfg.ids) {
        const v = Number(parsed?.codes?.[id]);
        codes[id] = isFinite(v) ? v : 0;
      }
      const retribuzioneMensile = isFinite(Number(parsed?.retribuzioneMensile)) ? Number(parsed.retribuzioneMensile) : 0;
      // Periodo dalla testata (serve al caricamento da file, dove non c'è metadato d'archivio).
      const mRaw = Number(parsed?.month);
      const yRaw = Number(parsed?.year);
      const month = Number.isInteger(mRaw) && mRaw >= 1 && mRaw <= 12 ? mRaw : 0;
      const year = Number.isInteger(yRaw) && yRaw >= 2000 && yRaw <= 2100 ? yRaw : 0;
      return { statusCode: 200, headers, body: JSON.stringify({ codes, retribuzioneMensile, month, year }) };
    }

    // =========================================================================
    // 🧠 NUOVA MODALITÀ: AUDITOR LEGALE (SPIEGAZIONE DISCORSIVA CON GEMINI 3.1 PRO)
    // =========================================================================
    if (action === 'explain') {
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

      const result = await generateContentWithRetry(
        EXPLAINER_API_KEYS,
        (g) => g.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { thinkingConfig: { thinkingBudget: THINKING_BUDGET } } as any }),
        [explainPrompt, { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }]
      );

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
    const result = await generateContentWithRetry(
      SCAN_API_KEYS,
      (g) => g.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: "application/json", temperature: 0.0, thinkingConfig: { thinkingBudget: THINKING_BUDGET } } as any,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      }),
      [targetPrompt, { inlineData: { data: cleanData, mimeType: mimeType || "application/pdf" } }]
    );

    const finalJson = cleanAndParseJSON(await result.response.text());
    finalJson.company = companyKey;

    // RFI/TRENITALIA: l'IA restituisce la riga presenze grezza in finalJson.attendance.
    // Il riconciliatore deterministico ne ricava daysWorked/daysVacation/daysPaidLeave e
    // corregge lo slittamento di colonna (Riposi scambiati per giorni lavorati).
    if (companyKey === "RFI" || companyKey === "TRENITALIA") {
      reconcileRailwayAttendance(finalJson);
    }

    // FSE: la voce presenza è pagata anche in ferie → il divisore è il servizio effettivo
    // (presenza − ferie). Scompone daysWorked e conserva il grezzo in daysPresence (v. 20/07).
    if (companyKey === "FSE") {
      reconcileFsePresence(finalJson);
    }

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