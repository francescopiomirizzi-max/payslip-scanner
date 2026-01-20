
export interface ProspettoRow {
  anno: string;
  totaleVoci: string;
  divisoreAnnuo: string;
  incidenzaFerie: string;
  giornateFerie: string;
  incidenza: string;
  indennitaPercepita: string;
  totaleDaPercepire: string;
  pastoTicket: string;
}

export interface TotaleDovuto {
  label: string;
  incidenzaTotale: string;
  percepitaTotale: string;
  daPercepireTotale: string;
  pastoTotale: string;
}

export interface AnnoDati {
  anno: number;
  totaleVociAccessorie: number;
  divisoreAnnuo: number;
  giornateFerieFruite: number;
  indennitaPercepita?: number;
  totaleIndennitaDaPercepire?: number;
  pastoTicket?: number;
}

export interface Worker {
  id: number;
  nome: string;
  cognome: string;
  ruolo: string; // Optional or can be derived/static if not in dataset
  anni: AnnoDati[];
  avatarUrl?: string; // Made optional
  accentColor?: string; // Made optional
  totaleDovuto?: number; // Calculated on the fly usually, but keeping compatible
}
