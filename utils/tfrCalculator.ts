import { AnnoDati } from '../types';

// ✨ FIX: La funzione chirurgica per l'arrotondamento contabile a 2 decimali
const roundToTwo = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

// 📊 STORICO COEFFICIENTI RIVALUTAZIONE TFR (Ufficiali ISTAT)
// Formula: 1,5% fisso + 75% dell'inflazione annua (FOI)
export const TFR_REVALUATION_RATES: Record<number, number> = {
    2008: 0.0293, 2009: 0.0204, 2010: 0.0251, 2011: 0.0352,
    2012: 0.0321, 2013: 0.0192, 2014: 0.0150, 2015: 0.0150,
    2016: 0.0180, 2017: 0.0223, 2018: 0.0242, 2019: 0.0150,
    2020: 0.0150, 2021: 0.0434, 2022: 0.0997, 2023: 0.0198,
    2024: 0.0150 // Tasso base minimo provvisorio
};

export interface TfrYearlySummary {
    year: number;
    fondoIniziale: number;
    imponibileLordo: number;
    quotaMaturataNetta: number;
    rivalutazione: number;
    fondoFinale: number;
    isPuntoZeroYear?: boolean;
    isBeforePuntoZero?: boolean;
}

export const calculateTFR = (
    monthlyInputs: AnnoDati[],
    tfrPregresso: number = 0,
    annoPregresso: number = new Date().getFullYear() - 1,
    startClaimYear: number = 2008 // Parametro mantenuto per compatibilità, ma ignorato dalla nuova logica
): TfrYearlySummary[] => {
    const summaries: TfrYearlySummary[] = [];

    // 🚀 IL VERO FIX: Ignoriamo gli anni "fantasma" della griglia frontend!
    // Consideriamo un anno "vivo" SOLO se c'è almeno un imponibile o dei giorni lavorati.
    const activeInputs = monthlyInputs.filter(d =>
        (d.imponibile_tfr_mensile || 0) > 0 ||
        Number(d.daysWorked) > 0
    );

    const dataYears = activeInputs.map(d => Number(d.year)).filter(y => !isNaN(y));

    // Se non ci sono dati reali inseriti e non c'è un Punto Zero, non mostriamo nulla.
    if (dataYears.length === 0 && tfrPregresso === 0) return [];

    // 1. Troviamo gli estremi temporali basandoci SOLO sui dati reali
    const earliestDataYear = dataYears.length > 0 ? Math.min(...dataYears) : annoPregresso;
    const ultimoAnnoAttivo = dataYears.length > 0 ? Math.max(...dataYears) : annoPregresso;

    // 2. Partenza chirurgica e dinamica (Se c'è il Punto Zero, partiamo da lì, altrimenti dal primo anno vivo)
    const firstYear = (tfrPregresso > 0 && annoPregresso < earliestDataYear) ? annoPregresso : earliestDataYear;
    const years = Array.from({ length: ultimoAnnoAttivo - firstYear + 1 }, (_, i) => firstYear + i);

    let currentFondo = 0;

    years.forEach(year => {
        const monthsInYear = monthlyInputs.filter(d => Number(d.year) === year);

        // FIX: L'imponibile TFR sulle buste paga è PROGRESSIVO. 
        // Non dobbiamo sommare i mesi, ma prendere il valore massimo raggiunto nell'anno.
        const imponibiliDelMese = monthsInYear.map(m => Number(m.imponibile_tfr_mensile || 0));
        const imponibileTfrAnno = imponibiliDelMese.length > 0 ? Math.max(...imponibiliDelMese) : 0;

        // Calcolo Quota dell'anno
        const quotaLorda = imponibileTfrAnno / 13.5;
        const trattenutaINPS = imponibileTfrAnno * 0.005;

        // ✨ FIX: Arrotondiamo la quota maturata appena nasce
        const quotaMaturataNetta = roundToTwo(quotaLorda > 0 ? quotaLorda - trattenutaINPS : 0);

        let fondoIniziale = 0;
        let rivalutazione = 0;
        let fondoFinale = 0;
        let isPuntoZeroYear = false;
        let isBeforePuntoZero = false;

        // LOGICA SDOPPIATA (Legale vs Contabile)
        if (tfrPregresso > 0) {
            if (year < annoPregresso) {
                // PRIMA DEL PUNTO ZERO (Manteniamo i dati base ma congeliamo i calcoli)
                isBeforePuntoZero = true;
            } else if (year === annoPregresso) {
                // ANNO ESATTO DEL PUNTO ZERO (Si azzera e si inserisce il malloppo)
                isPuntoZeroYear = true;
                fondoFinale = roundToTwo(tfrPregresso);
                currentFondo = fondoFinale; // Riempiamo il serbatoio pulito per il futuro
            } else {
                // DOPO IL PUNTO ZERO: Calcolo standard matematico
                fondoIniziale = currentFondo;
                const tassoRivalutazione = TFR_REVALUATION_RATES[year] || 0.015;

                // ✨ FIX: Arrotondiamo la rivalutazione
                rivalutazione = roundToTwo(currentFondo > 0 ? currentFondo * tassoRivalutazione : 0);

                // ✨ FIX: La somma finale ora è perfetta perché somma 3 valori già a 2 decimali
                fondoFinale = roundToTwo(currentFondo + quotaMaturataNetta + rivalutazione);
                currentFondo = fondoFinale;
            }
        } else {
            // Se non c'è punto zero inserito, calcola tutto normalmente dall'inizio
            fondoIniziale = currentFondo;
            const tassoRivalutazione = TFR_REVALUATION_RATES[year] || 0.015;

            // ✨ FIX: Arrotondiamo la rivalutazione
            rivalutazione = roundToTwo(currentFondo > 0 ? currentFondo * tassoRivalutazione : 0);

            // ✨ FIX: La somma finale perfetta
            fondoFinale = roundToTwo(currentFondo + quotaMaturataNetta + rivalutazione);
            currentFondo = fondoFinale;
        }

        summaries.push({
            year,
            fondoIniziale,
            imponibileLordo: imponibileTfrAnno,
            quotaMaturataNetta,
            rivalutazione,
            fondoFinale,
            isPuntoZeroYear,
            isBeforePuntoZero
        });
    });

    return summaries;
};