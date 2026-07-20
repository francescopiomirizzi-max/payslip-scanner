// Indennità "ricostruite" del perito per la vertenza FSE — tariffe dagli ACCORDI AZIENDALI/CCNL
// documentati nella Relazione Tecnico-Giuridica di Clarino (sezione 3). Non sono stampate sui
// cedolini: il perito le ricostruisce applicando una tariffa a una quantità base. Solo l'Indennità
// Aziendale ha una base ricavabile dai cedolini (giorni lavorati); le altre richiedono quantità da
// fonte aziendale (km, domeniche, giorni di riserva…) o il valore dal riepilogo del perito.
// DECISIONE 20/07: fidarsi delle ricostruzioni MA segnalare fin dove sono documentate.

export interface RicostruzioneFse {
  id: string;
  nome: string;
  /** tariffa per unità (€). */
  tariffa: number;
  /** unità della base (es. "giorno lavorato", "domenica", "km"). */
  unita: string;
  /** 'daysWorked' = base auto-calcolata dai giorni di servizio effettivo; 'manuale' = quantità da inserire. */
  base: 'daysWorked' | 'manuale';
  /** accordo/fonte da cui viene la tariffa (Relazione §3). */
  accordo: string;
  /** fin dove la tariffa è coperta da accordo documentato (trasparenza per l'avvocato). */
  documentataFinoAl: string;
  regimeTfr: string;
  /** anni di applicabilità della ricostruzione (come il perito), per le voci auto. */
  periodo?: { da: number; a: number };
  spiegazione: string;
}

export const RICOSTRUZIONI_FSE: RicostruzioneFse[] = [
  {
    id: 'ind_aziendale',
    nome: 'Indennità Aziendale',
    tariffa: 3.50,
    unita: 'giorno lavorato',
    base: 'daysWorked',
    accordo: 'Accordo Azienda 22/07/2009',
    documentataFinoAl: 'dal 2009 (il perito la ricostruisce 2011–2020)',
    regimeTfr: 'Esclusa da TFR ordinario',
    periodo: { da: 2011, a: 2020 },
    spiegazione:
      'Indennità per profilo (3,75 / 3,50 / 2,75 €). Non stampata sui cedolini: il perito la ricostruisce a 3,50 €/giorno. Base = giorni di servizio effettivo (già calcolati). È presence-linked → entra nel numeratore.',
  },
  {
    id: 'disponibilita',
    nome: 'Indennità Aggiuntiva (Disponibilità)',
    tariffa: 1.76,
    unita: 'giorno di disponibilità',
    base: 'manuale',
    accordo: 'Accordo Azienda 09/06/1998',
    documentataFinoAl: '1998',
    regimeTfr: 'Esclusa da TFR ordinario',
    spiegazione:
      'Disponibilità senza guida (3.400 lire = 1,76 €). I giorni di disponibilità non sono sui cedolini → inserisci la quantità o il valore dal riepilogo del perito.',
  },
  {
    id: 'domenicale_az',
    nome: 'Ind. Domenicale Aziendale',
    tariffa: 9.19,
    unita: 'domenica lavorata',
    base: 'manuale',
    accordo: 'Accordo Azienda 13/12/2019',
    documentataFinoAl: '2019',
    regimeTfr: 'Esclusa da TFR ordinario',
    spiegazione:
      'Per ogni domenica lavorata (9,19 €). Il numero di domeniche non è sui cedolini → quantità o valore del perito.',
  },
  {
    id: 'riserva',
    nome: 'Indennità di Riserva',
    tariffa: 18.00,
    unita: 'giorno di riserva',
    base: 'manuale',
    accordo: 'Accordo Azienda 13/12/2019',
    documentataFinoAl: '2019',
    regimeTfr: 'Inclusa in TFR dal 2020',
    spiegazione:
      'In caso di riserva assegnata (18,00 €). Giorni di riserva non sui cedolini → quantità o valore del perito.',
  },
  {
    id: 'guide',
    nome: 'Guida a Pieno e Vuoto',
    tariffa: 3.30,
    unita: 'servizio di guida',
    base: 'manuale',
    accordo: 'Accordo Azienda 13/12/2019 · 21/05/2024',
    documentataFinoAl: '2024',
    regimeTfr: 'Inclusa in TFR dal 2020',
    spiegazione:
      'Guida a pieno/vuoto (3,30 / 1,60 €, poi 4,80 € dal 2024). I servizi di guida non sono sui cedolini → quantità o valore del perito.',
  },
  {
    id: 'percorrenze',
    nome: 'Percorrenze',
    tariffa: 0.025823,
    unita: 'km percorso',
    base: 'manuale',
    accordo: 'Accordo Azienda 03/02/1990',
    documentataFinoAl: '1990',
    regimeTfr: '—',
    spiegazione:
      'Per ogni km in fasce orarie dedicate (50 lire = 0,0258 €). I km non sono sui cedolini → quantità o valore del perito.',
  },
];
