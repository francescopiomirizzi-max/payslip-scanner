// ==========================================
// FILE: utils/riposiDocText.ts
// NUCLEO TESTUALE CONDIVISO dei documenti dell'area Turni & Riposi (relazione
// .docx + prospetto conteggi stampabile). Questi documenti vanno davanti al
// giudice: le parole che descrivono metodo, tariffa, valorizzazione, divario
// tra le serie e riserve devono essere UNA sola volta qui — i due renderer
// (docx e HTML) le impaginano senza riscriverle, così non possono divergere.
//
// Tutto è puro e calcolato dai dati della pratica/risultato: niente numeri
// scritti a mano nei testi.
// ==========================================

import {
    computeSerieFonte, tariffaRange, formatHm, isGiornoNonLavorato, hasCEEDays,
    type RestResult, type Violazione, type GiornataInput,
} from './restEngine';
import {
    buildRivalutazione, capitaliMensiliSerieA, capitaliMensiliSerieB,
    ultimoGiornoDelMese, ymCorrente, RACCORDO_2015_SU_2010, RACCORDO_2025_SU_2015,
    type RivalutazioneResult,
} from './rivalutazione';
import { groupThousandsIT } from './formatters';
import type { PraticaRiposi } from '../hooks/usePraticheRiposi';

// ─── Formattatori comuni ──────────────────────────────────────────────────────

export const euro = (n: number) => '€ ' + groupThousandsIT(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const intIT = (n: number) => groupThousandsIT(Math.round(n).toLocaleString('it-IT'));
/** Etichetta tariffa: valore singolo se piatta, range "€min → €max" se per-anno. */
export const tariffaLabel = (rates: Record<string, number>): string => {
    const { min, max, uniform } = tariffaRange(rates);
    return uniform ? `${euro(min)}/h` : `${euro(min)} → ${euro(max)}/h`;
};
/** Suffisso della valorizzazione accanto alla tariffa: " +20%" (maggiorazione),
 *  " × 20%" (danno), vuoto (valore pieno). */
export const coeffSuffix = (coeff: number): string =>
    coeff > 1 ? ` +${Math.round((coeff - 1) * 100)}%` : coeff < 1 ? ` × ${Math.round(coeff * 100)}%` : '';
export const dmyhm = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
};

/** Punto elenco strutturato: i renderer mettono in grassetto `lead` e impaginano `testo`. */
export interface Bullet { lead: string; testo: string }

// ─── Valorizzazione della serie B (coefficiente) ──────────────────────────────

export interface ValorizzazioneInfo {
    modo: 'pieno' | 'maggiorazione' | 'danno';
    /** riga per la tabella "dati della pratica" */
    riga: string;
    /** formula finale, per esteso */
    formula: string;
    /** frase per la sezione metodo (passo finale della catena di calcolo) */
    passo: string | null;
}

export function valorizzazioneInfo(coeff: number): ValorizzazioneInfo {
    if (coeff > 1) {
        const pctM = Math.round((coeff - 1) * 100);
        return {
            modo: 'maggiorazione',
            riga: `valore pieno maggiorato del ${pctM}% (criterio del legale)`,
            formula: `Indennità = Σ (ore mancanti × tariffa oraria dell'anno) × ${(coeff).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
            passo: `sul valore pieno si applica la maggiorazione del ${pctM}% indicata dal legale; il risultato, arrotondato al centesimo per singola violazione e poi sommato, è l'indennità.`,
        };
    }
    if (coeff < 1) {
        const pct = Math.round(coeff * 100);
        return {
            modo: 'danno',
            riga: `danno equitativo pari al ${pct}% del valore del riposo perso (criterio del legale)`,
            formula: `Indennità = Σ (ore mancanti × tariffa oraria dell'anno) × ${pct}%`,
            passo: `sul valore pieno si applica il ${pct}% (danno equitativo, criterio del legale); il risultato, arrotondato al centesimo per singola violazione e poi sommato, è l'indennità.`,
        };
    }
    return {
        modo: 'pieno',
        riga: 'valore pieno del riposo perso (nessun coefficiente riduttivo o maggiorativo)',
        formula: 'Indennità = Σ (ore mancanti × tariffa oraria dell\'anno)',
        passo: null,
    };
}

// ─── Modello dati comune ai due documenti ────────────────────────────────────

export interface RigaAnno { y: string; g: number; s: number; oreMancanti: number; vp: number; ind: number; indFonte: number }

export interface DocModel {
    coeff: number;
    val: ValorizzazioneInfo;
    rates: Record<string, number>;
    soloCEE: boolean;
    fonte: { gg: number; ore: number; ind: number; perAnno: Record<string, number> };
    /** Split della serie A per marcatura CEE: quanta parte del documento è fuori perimetro. */
    splitCEE: { ceeInd: number; ceeGG: number; altroInd: number; altroGG: number };
    /** Giornate lavorate senza orari nel prospetto (non misurabili). */
    nSenzaOrari: number;
    /** Intervalli tra turni non valutati come riposo (dalla salvaguardia del motore). */
    nIntervalliNonValutati: number;
    /** Violazioni di tempestività del settimanale presenti nei risultati (0 = regola non applicata). */
    nTiming: number;
    violazioni: Violazione[];
    righeAnno: RigaAnno[];
    totViol: number;
}

export function buildDocModel(pratica: PraticaRiposi, result: RestResult): DocModel {
    const fonte = computeSerieFonte(pratica.giornate);
    const coeff = pratica.coefficiente ?? 1;
    const violazioni = [...result.violazioni].sort((a, b) => a.inizio.localeCompare(b.inizio));

    const splitCEE = { ceeInd: 0, ceeGG: 0, altroInd: 0, altroGG: 0 };
    let nSenzaOrari = 0;
    for (const g of pratica.giornate) {
        if ((!g.inizio || !g.termine) && !isGiornoNonLavorato(g.servizio)) nSenzaOrari++;
        const ind = g.indennitaFonte ?? 0;
        if (ind <= 0) continue;
        if ((g.tipo || '').trim().toUpperCase() === 'CEE') { splitCEE.ceeInd += ind; splitCEE.ceeGG++; }
        else { splitCEE.altroInd += ind; splitCEE.altroGG++; }
    }
    splitCEE.ceeInd = Math.round(splitCEE.ceeInd * 100) / 100;
    splitCEE.altroInd = Math.round(splitCEE.altroInd * 100) / 100;

    // La salvaguardia del motore dichiara gli intervalli scartati in un warning aggregato.
    let nIntervalliNonValutati = 0;
    for (const w of result.warnings) {
        const m = w.match(/^(\d+) intervalli tra turni NON valutati/);
        if (m) nIntervalliNonValutati = parseInt(m[1], 10);
    }

    const m: Record<string, RigaAnno> = {};
    const riga = (y: string) => (m[y] ??= { y, g: 0, s: 0, oreMancanti: 0, vp: 0, ind: 0, indFonte: 0 });
    for (const v of violazioni) {
        const r = riga(v.inizio.slice(0, 4));
        if (v.tipo === 'riposo_giornaliero') r.g++; else r.s++;
        r.oreMancanti += v.oreMancanti; r.vp += v.valorePieno; r.ind += v.indennita;
    }
    for (const [y, ind] of Object.entries(fonte.perAnno)) riga(y).indFonte = ind;

    return {
        coeff,
        val: valorizzazioneInfo(coeff),
        rates: result.tariffePerAnnoApplicate,
        soloCEE: hasCEEDays(pratica.giornate),
        fonte,
        splitCEE,
        nSenzaOrari,
        nIntervalliNonValutati,
        nTiming: violazioni.filter((v) => /oltre il termine/.test(v.motivo)).length,
        violazioni,
        righeAnno: Object.values(m).sort((a, b) => a.y.localeCompare(b.y)),
        totViol: result.nViolazioniGiornaliere + result.nViolazioniSettimanali,
    };
}

// ─── Blocchi testuali (una sola fonte della verità) ──────────────────────────

/** Perimetro CEE: base normativa completa. */
export const RIF_PERIMETRO_CEE =
    'Il Reg. (CE) n. 561/2006 si applica al trasporto di passeggeri su strada con servizi regolari di linea quando il percorso di linea supera i 50 km — artt. 2, §1, lett. b e 3, lett. a, a contrario; cfr. nota INL prot. n. 61 del 14/01/2021 per i percorsi misti. Nel prospetto turni le giornate rese in tale regime sono marcate «CEE».';

export function quadroNormativoBullets(): Bullet[] {
    return [
        { lead: 'Riposo giornaliero', testo: '(art. 8 §§2,4; art. 4 lett. g): almeno 11 ore consecutive nell\'arco delle 24 ore dal termine del precedente periodo di riposo; riducibile a 9 ore al massimo 3 volte tra due riposi settimanali.' },
        { lead: 'Riposo settimanale', testo: '(art. 8 §6; art. 4 lett. h): almeno 45 ore consecutive, da iniziare entro sei periodi di 24 ore dal termine del precedente riposo settimanale; riducibile a 24 ore solo in alternanza con un riposo regolare (mai due ridotti consecutivi).' },
        { lead: 'Ambito di applicazione («CEE»)', testo: RIF_PERIMETRO_CEE },
        { lead: 'Gravità', testo: 'la riduzione superiore al 10% della soglia è classificata «grave» secondo i criteri del Reg. (UE) 2016/403; è un criterio di classificazione, non il presupposto dell\'illecito.' },
    ];
}

export function quadroContrattualeBullets(): Bullet[] {
    return [
        { lead: 'Natura festiva del riposo perso', testo: '(art. 14 CCNL 25/07/1997): per chi lavora di domenica e riposa in altro giorno, il giorno fissato per il riposo periodico è considerato festivo a tutti gli effetti; ogni prestazione resa in tale giorno va trattata, in via principale, come lavoro festivo.' },
        { lead: 'Retribuzione oraria', testo: '(art. 15 CCNL 23/07/1976): la «retribuzione normale» (tabellare/minimo, contingenza, scatti, mensa, T.D.R., assegni ad personam, con i ratei di 13ª e 14ª) è rapportata al divisore 195 (39 ore settimanali su 6 giorni = 6,5 h/giorno; 6,5 × 30 = 195).' },
        { lead: 'Maggiorazioni', testo: '(cumulabili, sommate): straordinario +10%, festivo +20%, notturno +20% (combinazioni: straordinario festivo o notturno 130%, straordinario festivo notturno 150%).' },
        { lead: 'Impostazione prudenziale', testo: 'sono assunti importi minimi — non si applicano né la maggiorazione notturna (fascia 22:00–05:00) né l\'integrazione del 50% prevista per il servizio reso nel giorno di riposo in misura inferiore all\'orario giornaliero; resta ferma ogni maggiore valutazione del Giudicante.' },
    ];
}

/** Fonte dei dati: cosa contiene il prospetto e come è stato acquisito. */
export function fonteDatiBullets(model: DocModel, pratica: PraticaRiposi): Bullet[] {
    const out: Bullet[] = [
        { lead: 'Acquisizione', testo: `il prospetto turni giornaliero («Mancati riposi», ${intIT(pratica.giornate.length)} giornate dal ${pratica.periodoStart ?? '—'} al ${pratica.periodoEnd ?? '—'}) è stato acquisito con un parser deterministico — nessuna interpretazione AI/OCR — e i totali estratti quadrano al centesimo con quelli stampati nel documento stesso (riconciliazione integrale).` },
        { lead: 'Contenuto per giornata', testo: 'giorno della settimana e data; marcatura «CEE»; codice del servizio; orari di inizio e termine del turno; riposo giornaliero fruito («Rip.Gro») e settimanale fruito («Rip.Set»); mancato riposo giornaliero e settimanale; indennità liquidata dal compilatore (giorno per giorno e per mese).' },
    ];
    if (model.nSenzaOrari > 0) {
        out.push({ lead: 'Giornate lavorate senza orari', testo: `${intIT(model.nSenzaOrari)} giornate riportano il codice servizio ma non gli orari del turno: sono giornate di lavoro a tutti gli effetti, ma i riposi che le circondano non sono misurabili (v. regola di salvaguardia nel metodo).` });
    }
    return out;
}

/** Metodo del documento sorgente (serie A) — descritto per completezza e trasparenza. */
export function metodoFonteBullets(model: DocModel): Bullet[] {
    return [
        { lead: 'Riposo giornaliero', testo: 'per ogni giornata con riposo inferiore alle 11 ore, il documento espone come mancato riposo la differenza (11:00 − riposo fruito).' },
        { lead: 'Riposo settimanale', testo: 'quota mancante rispetto alle 45 ore (45:00 − riposo fruito) quando il riposo settimanale è stato fruito in misura ridotta; 45 ore INTERE quando il riposo settimanale non risulta fruito in tempo utile (casella del riposo fruito vuota nel prospetto).' },
        { lead: 'Valorizzazione', testo: 'ore mancanti × paga oraria del mese maggiorata del 20% (trattamento festivo del riposo perso); gli importi sono esposti giorno per giorno e totalizzati per mese.' },
        { lead: 'Perimetro', testo: `il documento indennizza tutte le giornate con mancato riposo, incluse quelle non marcate «CEE» (${intIT(model.splitCEE.altroGG)} giornate per ${euro(model.splitCEE.altroInd)}).` },
    ];
}

/** Catena di calcolo del motore (serie B), passo per passo. */
export function metodoMotorePassi(model: DocModel, pratica: PraticaRiposi, result: RestResult): Bullet[] {
    const passi: Bullet[] = [];
    let n = 1;
    if (model.soloCEE) {
        passi.push({ lead: `${n++}) Perimetro CEE`, testo: 'si considerano le sole giornate in regime Reg. (CE) n. 561/2006 (marcate «CEE» nel prospetto); le altre restano fuori dal conteggio.' });
    }
    passi.push({ lead: `${n++}) Ricostruzione dei riposi`, testo: 'dagli orari di inizio e termine dei turni si ricava il riposo effettivamente fruito tra turni consecutivi (i turni che superano la mezzanotte sono attribuiti correttamente al giorno di inizio).' });
    passi.push({ lead: `${n++}) Salvaguardia sulle giornate senza orari`, testo: `gli intervalli tra turni che attraversano giornate lavorate prive di orari NON sono considerati riposo: quel tempo non è misurabile e trattarlo come riposo genererebbe falsi riposi settimanali. Tali intervalli non producono violazioni né interrompono le verifiche${model.nIntervalliNonValutati ? ` (${intIT(model.nIntervalliNonValutati)} intervalli non valutati nel periodo, dichiarati in coda)` : ''}.` });
    passi.push({ lead: `${n++}) Soglie ed esclusioni`, testo: `riposo giornaliero 11h (riducibile a 9h al massimo 3 volte tra due settimanali: riduzione LECITA, non conteggiata — ${intIT(result.nRidottiGiornalieriLeciti)} nel periodo); riposo settimanale 45h (riducibile a 24h solo in alternanza con un riposo regolare). Le righe con orari non interpretabili sono segnalate, mai stimate.` });
    if (model.nTiming > 0) {
        passi.push({ lead: `${n++}) Tempestività del settimanale`, testo: `il riposo settimanale deve iniziare entro sei periodi di 24 ore dal termine del precedente (art. 8 §6): quando inizia oltre tale termine, il riposo non risulta riconosciuto in tempo utile e si computano le 45 ore intere (${intIT(model.nTiming)} casi nel periodo).` });
    }
    passi.push({ lead: `${n++}) Ore mancanti`, testo: 'per ogni violazione: soglia di legge − riposo fruito.' });
    passi.push({ lead: `${n++}) Valore pieno`, testo: `ore mancanti × tariffa oraria dell'anno della violazione (${tariffaLabel(model.rates)}${tariffaRange(model.rates).uniform ? '' : ', cresce per anzianità di servizio'}).` });
    if (model.val.passo) passi.push({ lead: `${n++}) Valorizzazione`, testo: model.val.passo });
    return passi;
}

/** Spiegazione della tariffa oraria: derivazione + costruzione contrattuale + riscontro. */
export function tariffaSpiegazione(model: DocModel, pratica: PraticaRiposi): string {
    const base = `La tariffa oraria è ricavata anno per anno dal documento sorgente come rapporto tra indennità liquidate e ore mancanti (${tariffaLabel(model.rates)}${tariffaRange(model.rates).uniform ? '' : '; cresce con l\'anzianità di servizio'}). ` +
        'La costruzione sottostante è contrattuale: retribuzione oraria — elementi fissi mensili più i ratei di 13ª e 14ª mensilità, con divisore 195 (art. 15 CCNL 23/07/1976) — maggiorata del 20% quale trattamento festivo del riposo perso (art. 14 CCNL 25/07/1997). ' +
        'La tariffa così ricavata INCORPORA quindi già la valorizzazione festiva.';
    return pratica.fonteTariffa ? `${base} Riscontro documentale: ${pratica.fonteTariffa}.` : base;
}

/** Il divario tra le serie, spiegato con i numeri (la domanda che il giudice farà per prima). */
export function divarioBullets(model: DocModel, result: RestResult): Bullet[] {
    const out: Bullet[] = [];
    if (model.soloCEE && model.splitCEE.altroInd > 0) {
        out.push({ lead: 'Perimetro CEE', testo: `la serie A indennizza anche ${intIT(model.splitCEE.altroGG)} giornate non marcate «CEE» per ${euro(model.splitCEE.altroInd)}; la serie B le esclude perché fuori dal campo di applicazione del Reg. 561/2006 (la parte CEE della serie A vale ${euro(model.splitCEE.ceeInd)}).` });
    }
    out.push({ lead: 'Riduzioni lecite', testo: `il Reg. 561/2006 CONSENTE il riposo giornaliero ridotto (9–11h, al massimo 3 volte tra due settimanali) e il settimanale ridotto in alternanza: la serie B non li conteggia (${intIT(result.nRidottiGiornalieriLeciti)} riposi ridotti leciti nel periodo), mentre il documento sorgente indennizza ogni scostamento dalla soglia piena.` });
    if (model.nTiming === 0) {
        out.push({ lead: 'Tempestività del settimanale', testo: 'il documento sorgente riconosce 45 ore intere quando il riposo settimanale non risulta fruito in tempo utile; la serie B, in via prudenziale, allo stato non applica tale criterio (riserva di integrazione, v. sezione riserve).' });
    }
    out.push({ lead: 'Unità di conteggio del settimanale', testo: 'il documento sorgente conta per SETTIMANA DI CALENDARIO (una riga per ogni settimana con riposo sotto le 45 ore, attribuita a un giorno di quella settimana); la serie B conta per EVENTO (una sola violazione per il riposo che viola la norma, applicate le tolleranze di legge). Le righe del documento e le violazioni della serie B possono quindi cadere in giorni diversi pur riferendosi alla stessa settimana: per il settimanale il confronto corretto è su numero di eventi e importi, non sulla coincidenza del singolo giorno di calendario.' });
    return out;
}

/** Riserve e limiti — sempre dichiarati, mai impliciti. */
export function riserveBullets(model: DocModel, pratica: PraticaRiposi, result: RestResult): Bullet[] {
    const out: Bullet[] = [
        { lead: 'Tariffa oraria', testo: tariffaSpiegazione(model, pratica) + ' Resta salva ogni diversa determinazione del legale: alla modifica della tariffa la serie B si ricalcola integralmente, senza rielaborare i dati.' },
    ];
    if (model.val.modo === 'maggiorazione') {
        out.push({ lead: 'Valorizzazione', testo: `la serie B applica sul valore pieno una maggiorazione del ${Math.round((model.coeff - 1) * 100)}% (criterio del legale). Si segnala che la tariffa oraria derivata dal documento incorpora già la valorizzazione festiva (+20%): la maggiorazione qui applicata vi si CUMULA per scelta del legale.` });
    } else if (model.val.modo === 'danno') {
        out.push({ lead: 'Valorizzazione', testo: `la serie B è quantificata come ${Math.round(model.coeff * 100)}% del valore del riposo perso (danno equitativo ancorato ai parametri del CCNL, criterio del legale; cfr. Cass. n. 14940/2014 sul parametro del 20% nel settore autoferrotranvieri).` });
    } else {
        out.push({ lead: 'Valorizzazione', testo: 'la serie B è esposta al valore pieno (100%). Gli eventuali criteri alternativi del legale (maggiorazione +20% o danno = 20% del valore) si applicano come fattore globale, senza rielaborare i dati.' });
    }
    if (model.nTiming === 0) {
        out.push({ lead: 'Tempestività del settimanale (esclusione prudenziale)', testo: 'la serie B non computa, allo stato, la violazione di tempestività del riposo settimanale (inizio oltre sei periodi di 24 ore dal precedente, art. 8 §6), che il documento sorgente valorizza con 45 ore intere. L\'integrazione è riservata all\'esito delle determinazioni del legale sul criterio di quantificazione.' });
    }
    out.push({ lead: 'Pausa di guida (art. 7)', testo: 'richiede i dati del cronotachigrafo, non presenti nel prospetto turni; è esclusa dal perimetro di questa elaborazione.' });
    out.push({ lead: 'Codici di servizio', testo: 'le sigle di non guida sono decodificate (R = riposo; Festivo; Ferie; D = a disposizione/riserva; VM = visita medica; Malato; P.retr = permesso retribuito); i codici numerici di linea/turno richiedono la legenda aziendale, non disponibile.' });
    out.push({ lead: 'Cumulo delle serie', testo: 'le serie A e B quantificano i medesimi riposi non fruiti con criteri diversi: NON si sommano. La scelta della base di quantificazione — e la verifica che le indennità della serie A non risultino già corrisposte in busta paga — spettano al legale incaricato.' });
    return out;
}

// ─── Rivalutazione monetaria e interessi legali (art. 429 c.p.c.) ─────────────

/** Modello della sezione rivalutazione: ENTRAMBE le serie rivalutate alla stessa
 *  scadenza (default: mese corrente, limitato all'ultimo indice FOI pubblicato).
 *  Come i capitali, le serie rivalutate si AFFIANCANO e non si sommano. */
export interface RivalutazioneDocModel {
    /** Scadenza effettiva del calcolo ('YYYY-MM') e sua etichetta 'DD/MM/YYYY'. */
    scadenzaEffettiva: string;
    scadenzaLabel: string;
    /** true = la scadenza richiesta superava l'ultimo indice FOI pubblicato. */
    scadenzaLimitata: boolean;
    serieA: RivalutazioneResult | null;
    serieB: RivalutazioneResult;
}

export function buildRivalutazioneModel(pratica: PraticaRiposi, result: RestResult, scadenza: string = ymCorrente()): RivalutazioneDocModel {
    const capA = capitaliMensiliSerieA(pratica.giornate);
    const serieA = Object.keys(capA).length > 0 ? buildRivalutazione(capA, scadenza) : null;
    const serieB = buildRivalutazione(capitaliMensiliSerieB(result.violazioni), scadenza);
    return {
        scadenzaEffettiva: serieB.scadenzaEffettiva,
        scadenzaLabel: ultimoGiornoDelMese(serieB.scadenzaEffettiva),
        scadenzaLimitata: serieB.scadenzaLimitata,
        serieA,
        serieB,
    };
}

/** Metodo della rivalutazione, passo per passo (stessa fonte per docx e stampa). */
export function rivalutazioneBullets(riv: RivalutazioneDocModel): Bullet[] {
    const out: Bullet[] = [
        { lead: 'Base normativa', testo: 'art. 429, comma 3, c.p.c.: ai crediti di lavoro spettano gli interessi nella misura legale e il maggior danno da diminuzione di valore del credito (rivalutazione monetaria), dal giorno di maturazione del diritto.' },
        { lead: 'Indici', testo: `indice ISTAT FOI generale (famiglie di operai e impiegati, al netto dei tabacchi), valori MENSILI come pubblicati in Gazzetta Ufficiale; i cambi di base (2010→2015→2025) sono gestiti con i coefficienti di raccordo ufficiali ISTAT (${RACCORDO_2015_SU_2010.toLocaleString('it-IT')} e ${RACCORDO_2025_SU_2015.toLocaleString('it-IT')}).` },
        { lead: 'Decorrenza', testo: `ogni mese con danno è rivalutato autonomamente dall'ultimo giorno del mese di maturazione sino alla scadenza comune del ${riv.scadenzaLabel}.` },
        { lead: 'Rivalutazione', testo: 'concatenata per anno solare: ad ogni fine anno (e alla scadenza per l\'ultimo periodo) il capitale è moltiplicato per il coefficiente di variazione dell\'indice, arrotondato alla terza cifra decimale; la rivalutazione complessiva non è mai negativa.' },
        { lead: 'Interessi legali', testo: 'calcolati «tempo per tempo» ai tassi fissati dai decreti ministeriali annuali (art. 1284 c.c.), sul capitale via via rivalutato, in ragione dei giorni effettivi di ciascun periodo (base 365).' },
    ];
    if (riv.scadenzaLimitata) {
        out.push({ lead: 'Ultimo indice disponibile', testo: `il calcolo è aggiornato al ${riv.scadenzaLabel}, ultimo mese con indice FOI pubblicato alla data di generazione del documento: nessun indice è stimato. Gli importi maturano ulteriormente sino al soddisfo.` });
    }
    const fuori = (riv.serieA?.mesiFuoriCopertura ?? 0) + riv.serieB.mesiFuoriCopertura;
    if (fuori > 0) {
        out.push({ lead: 'Mesi fuori copertura', testo: `${intIT(fuori)} mensilità precedono la copertura della serie indici caricata: il loro capitale è incluso nei totali SENZA rivalutazione né interessi (criterio prudenziale, integrabile).` });
    }
    out.push({ lead: 'Avvertenza', testo: 'le due serie rivalutate quantificano lo stesso pregiudizio con criteri diversi e NON si sommano, al pari dei rispettivi capitali.' });
    return out;
}

/** Schema delle maggiorazioni contrattuali su base 100 (un'ora di retribuzione
 *  normale con i ratei di 13ª e 14ª = 100). Fonte: artt. 11 A.N. 12/03/1980 e
 *  14 CCNL 25/07/1997 (v. quadro contrattuale). */
export const MAGGIORAZIONI_BASE_100: Array<{ tipologia: string; trattamento: string }> = [
    { tipologia: 'Ora di retribuzione normale (con ratei 13ª e 14ª)', trattamento: '100' },
    { tipologia: 'Straordinario diurno', trattamento: '110 (+10%)' },
    { tipologia: 'Lavoro festivo e mancato riposo', trattamento: '120 (+20%)' },
    { tipologia: 'Notturno in turni avvicendati (22:00–05:00)', trattamento: '120 (+20%)' },
    { tipologia: 'Straordinario notturno', trattamento: '130 (110 + 20)' },
    { tipologia: 'Straordinario festivo', trattamento: '130 (110 + 20)' },
    { tipologia: 'Straordinario festivo notturno', trattamento: '150 (110 + 20 + 20)' },
];

/** Qualificazione giuridica delle due serie: chiude la sezione «Perché le due serie
 *  differiscono» spiegando COSA rappresenta legalmente ciascuna. Volutamente neutra:
 *  descrive la natura delle serie senza indicarne una come corretta — la scelta della
 *  base (e la prospettazione della domanda) spetta al legale. */
export const QUALIFICAZIONE_SERIE =
    'Qualificazione delle due serie: la serie B computa le sole condotte che integrano VIOLAZIONE del Reg. (CE) n. 561/2006, applicando le tolleranze che il regolamento stesso consente (riduzioni giornaliere lecite fino a 3 tra due riposi settimanali; settimanale ridotto in alternanza); la serie A quantifica integralmente la compressione del riposo rispetto alle soglie piene (11h/45h), comprese le riduzioni consentite dal regolamento e le giornate estranee al suo campo di applicazione, per le quali l\'eventuale tutela va ricercata nel D.Lgs. n. 66/2003 e nella disciplina contrattuale. La scelta della base di quantificazione — anche in funzione della prospettazione della domanda — spetta al legale incaricato.';

export const AVVERTENZA_SERIE =
    'Le due serie NON si sommano: quantificano lo stesso pregiudizio (i medesimi riposi non fruiti) con criteri diversi. La scelta della base di quantificazione, e la verifica che le indennità della serie A non risultino già corrisposte in busta paga, spettano al legale incaricato.';

export const DISCLAIMER =
    'La presente è un\'elaborazione tecnica di supporto: ogni valutazione sull\'azionabilità delle pretese spetta al professionista legale incaricato.';
