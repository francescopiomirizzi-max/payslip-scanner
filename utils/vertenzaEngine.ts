// Motore della vertenza "indennità di assenza dalla residenza" (Elior viaggiante).
//
// Natura del calcolo, DIVERSA dai riposi: non si contano eventi, si misura un
// DELTA DI TARIFFA su una voce già pagata. Per ogni voce (4300/4305) il lavoratore
// ha preso una "misura ridotta" (es. 0,75/1,00 €/h) mentre il CCNL prevedeva una
// misura piena (es. 1,30/2,20 €/h). Il credito è la differenza, anno per anno,
// rivalutata (ISTAT FOI) e con interessi legali.
//
// Il motore è PARAMETRICO sulla voce: non c'è nulla di hard-coded su 4300/4305, così
// domani basta cambiare la config per applicarlo a una vertenza-voce diversa.

/** Una voce retributiva oggetto della vertenza, con le due tariffe a confronto. */
export interface VoceVertenza {
    codice: string;        // es. '4300'
    label: string;         // es. 'Ass. Res. No RS'
    tariffaPagata: number; // €/h effettivamente corrisposta (misura ridotta)
    tariffaDovuta: number; // €/h prevista dal CCNL (misura piena)
    /** Importo lordo PAGATO per quella voce, anno per anno ('YYYY' → €). Il numero
     *  di ore si ricava da importo/tariffaPagata, così non serve dato extra. */
    righe: { anno: string; importoPagato: number }[];
}

/** Marcatore di interruzione della prescrizione (es. comunicazione OO.SS.). */
export interface InterruzionePrescrizione {
    data: string;   // 'DD/MM/YYYY'
    nota?: string;
}

export interface PrescrizioneConfig {
    /** Anni di prescrizione (quinquennale per le retribuzioni). */
    anni?: number;
    interruzioni?: InterruzionePrescrizione[];
    /** Data di deposito/cutoff 'DD/MM/YYYY': prima di (cutoff − anni, riportata
     *  all'ultima interruzione utile) il credito è prescritto. */
    cutoff?: string;
}

export interface VertenzaParams {
    /** Coefficiente sul valore della differenza (1 = pieno; 0.20 = criterio danno). */
    coefficiente?: number;
    /** Rivalutazione ISTAT FOI: dato un importo e l'anno, restituisce la quota di
     *  rivalutazione (non l'importo rivalutato). Iniettabile per testabilità; se
     *  assente, 0 (il nucleo differenziale resta corretto). */
    rivaluta?: (importo: number, anno: string) => number;
    /** Interessi legali sull'importo per quell'anno. Iniettabile; default 0. */
    interessi?: (importo: number, anno: string) => number;
}

/** Totali per singola voce (alimenta la tabella "Pagato ↔ Dovuto"). */
export interface TotaleVoce {
    codice: string;
    label: string;
    tariffaPagata: number;
    tariffaDovuta: number;
    ore: number;
    pagato: number;
    dovuto: number;
    differenza: number;
}

/** Riga del prospetto per anno. */
export interface RigaAnnoVertenza {
    anno: string;
    pagato: number;
    dovuto: number;
    differenza: number;     // (dovuto − pagato) × coefficiente
    rivalutazione: number;
    interessi: number;
    totale: number;         // differenza + rivalutazione + interessi
}

export interface VertenzaResult {
    perVoce: TotaleVoce[];
    perAnno: RigaAnnoVertenza[];
    totPagato: number;
    totDovuto: number;
    totDifferenza: number;
    totRivalutazione: number;
    totInteressi: number;
    totCredito: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 'DD/MM/YYYY' → anno di prescrizione minimo (incluso). Tutto ciò che è prima di
 *  `cutoff − anni` è prescritto, salvo che un'interruzione lo riporti più indietro:
 *  vale l'interruzione UTILE più vecchia (più favorevole al lavoratore). */
export function annoMinimoNonPrescritto(p?: PrescrizioneConfig): number | null {
    if (!p || !p.cutoff) return null;
    const anni = p.anni ?? 5;
    const annoCutoff = Number(p.cutoff.slice(-4));
    if (!Number.isFinite(annoCutoff)) return null;
    let limite = annoCutoff - anni;
    // Un'interruzione "congela" la prescrizione: il limite arretra all'anno
    // dell'interruzione utile più vecchia (interruzione − anni).
    for (const it of p.interruzioni ?? []) {
        const annoIt = Number(it.data.slice(-4));
        if (Number.isFinite(annoIt)) limite = Math.min(limite, annoIt - anni);
    }
    return limite;
}

/**
 * Calcola il credito della vertenza-voce.
 * - ore = importoPagato / tariffaPagata
 * - dovuto = ore × tariffaDovuta
 * - differenza = (dovuto − pagato) × coefficiente
 * - + rivalutazione ISTAT + interessi legali (se forniti)
 * Le righe prescritte (anno < anno minimo non prescritto) sono escluse dai totali.
 */
export function computeVertenza(
    voci: VoceVertenza[],
    prescrizione?: PrescrizioneConfig,
    params: VertenzaParams = {},
): VertenzaResult {
    const coeff = params.coefficiente ?? 1;
    const annoMin = annoMinimoNonPrescritto(prescrizione);
    const ammesso = (anno: string) => annoMin == null || Number(anno) >= annoMin;

    // ── Totali per voce (solo righe non prescritte) ──
    const perVoce: TotaleVoce[] = voci.map((v) => {
        let ore = 0, pagato = 0, dovuto = 0;
        for (const r of v.righe) {
            if (!ammesso(r.anno)) continue;
            const oreRiga = v.tariffaPagata > 0 ? r.importoPagato / v.tariffaPagata : 0;
            ore += oreRiga;
            pagato += r.importoPagato;
            dovuto += oreRiga * v.tariffaDovuta;
        }
        return {
            codice: v.codice, label: v.label,
            tariffaPagata: v.tariffaPagata, tariffaDovuta: v.tariffaDovuta,
            ore: r2(ore), pagato: r2(pagato), dovuto: r2(dovuto),
            differenza: r2((dovuto - pagato) * coeff),
        };
    });

    // ── Prospetto per anno (aggrega tutte le voci) ──
    const anni = new Map<string, { pagato: number; dovuto: number }>();
    for (const v of voci) {
        for (const r of v.righe) {
            if (!ammesso(r.anno)) continue;
            const oreRiga = v.tariffaPagata > 0 ? r.importoPagato / v.tariffaPagata : 0;
            const acc = anni.get(r.anno) ?? { pagato: 0, dovuto: 0 };
            acc.pagato += r.importoPagato;
            acc.dovuto += oreRiga * v.tariffaDovuta;
            anni.set(r.anno, acc);
        }
    }

    const perAnno: RigaAnnoVertenza[] = [...anni.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([anno, { pagato, dovuto }]) => {
            const differenza = (dovuto - pagato) * coeff;
            const rivalutazione = params.rivaluta ? params.rivaluta(differenza, anno) : 0;
            const interessi = params.interessi ? params.interessi(differenza, anno) : 0;
            return {
                anno,
                pagato: r2(pagato),
                dovuto: r2(dovuto),
                differenza: r2(differenza),
                rivalutazione: r2(rivalutazione),
                interessi: r2(interessi),
                totale: r2(differenza + rivalutazione + interessi),
            };
        });

    const sum = (f: (r: RigaAnnoVertenza) => number) => r2(perAnno.reduce((s, r) => s + f(r), 0));
    return {
        perVoce,
        perAnno,
        totPagato: sum((r) => r.pagato),
        totDovuto: sum((r) => r.dovuto),
        totDifferenza: sum((r) => r.differenza),
        totRivalutazione: sum((r) => r.rivalutazione),
        totInteressi: sum((r) => r.interessi),
        totCredito: sum((r) => r.totale),
    };
}
