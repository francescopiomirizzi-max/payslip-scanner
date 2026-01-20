
export interface CalculationResult {
    anno: number;
    incidenzaGiornaliera: number;
    incidenzaTotaleAnno: number;
    totaleIndennitaDaPercepire?: number;
    pastoTicket?: number;
    indennitaPercepita?: number;
}

export interface TotalResult {
    risultatiAnni: CalculationResult[];
    totaleComplessivo: number;
    totaleNettoDaPercepire: number;
    totalePasto: number;
}

export function calcolaIncidenzaGiornaliera(totaleVoci: number, divisore: number): number {
    if (divisore === 0) return 0;
    return totaleVoci / divisore;
}

export function calcolaIncidenzaTotaleAnno(incidenzaGiornaliera: number, giornateFerie: number): number {
    return incidenzaGiornaliera * giornateFerie;
}

export function processaAnno(datiAnno: { anno: number; totaleVociAccessorie: number; divisoreAnnuo: number; giornateFerieFruite: number; indennitaPercepita?: number; pastoTicket?: number }): CalculationResult {
    const incidenzaGiornaliera = calcolaIncidenzaGiornaliera(
        datiAnno.totaleVociAccessorie,
        datiAnno.divisoreAnnuo
    );

    const incidenzaTotaleAnno = calcolaIncidenzaTotaleAnno(
        incidenzaGiornaliera,
        datiAnno.giornateFerieFruite
    );

    const totaleIndennitaDaPercepire = incidenzaTotaleAnno - (datiAnno.indennitaPercepita || 0);

    return {
        anno: datiAnno.anno,
        incidenzaGiornaliera: parseFloat(incidenzaGiornaliera.toFixed(2)),
        incidenzaTotaleAnno: parseFloat(incidenzaTotaleAnno.toFixed(2)),
        totaleIndennitaDaPercepire: parseFloat(totaleIndennitaDaPercepire.toFixed(2)),
        pastoTicket: datiAnno.pastoTicket || 0,
        indennitaPercepita: datiAnno.indennitaPercepita || 0
    };
}

export function calcolaTotaleComplessivo(anni: any[]): TotalResult {
    if (!anni || anni.length === 0) {
        return { risultatiAnni: [], totaleComplessivo: 0, totaleNettoDaPercepire: 0, totalePasto: 0 };
    }

    const risultatiAnni = anni.map(anno => processaAnno(anno));

    const totaleComplessivo = risultatiAnni.reduce(
        (acc, curr) => acc + curr.incidenzaTotaleAnno,
        0
    );

    const totaleNettoDaPercepire = risultatiAnni.reduce(
        (acc, curr) => acc + (curr.totaleIndennitaDaPercepire || 0),
        0
    );

    const totalePasto = risultatiAnni.reduce(
        (acc, curr) => acc + (curr.pastoTicket || 0),
        0
    );

    return {
        risultatiAnni: risultatiAnni,
        totaleComplessivo: parseFloat(totaleComplessivo.toFixed(2)),
        totaleNettoDaPercepire: parseFloat(totaleNettoDaPercepire.toFixed(2)),
        totalePasto: parseFloat(totalePasto.toFixed(2))
    };
}
