// ==========================================
// FILE: utils/restEngine.ts
// Motore di calcolo "mancati riposi" — area "Turni & Riposi".
// Reg. (CE) n. 561/2006: riposo giornaliero (art. 8 §§2,4) e settimanale (art. 8 §6).
//
// Modulo PURO: nessun I/O, nessuna dipendenza dall'app. Tutto è funzione
// deterministica → facile da testare e validare contro gli esempi del vademecum.
//
// PERIMETRO v1: dai soli orari inizio/termine di turno si calcolano riposo
// giornaliero e settimanale (Violazione n. 1). La pausa art. 7 (Violazione n. 2)
// richiede il dettaglio di guida intra-turno / dati cronotachigrafo → fuori scope.
//
// NOTA FORMATO: gli orari della fonte sono in formato h.mm (es. "38.50" = 38h50',
// "6.15" = 6h15'), NON decimali. parseHmm gestisce anche la virgola ("45,00").
// ==========================================

// ─── Tipi di dominio ──────────────────────────────────────────────────────────

/** Una riga giornaliera così come arriva dalla fonte (PDF "Mancati riposi" / SA20). */
export interface GiornataInput {
  data: string;        // 'DD/MM/YYYY'
  gset?: string;       // giorno della settimana (informativo)
  tipo?: string;       // informativo (es. 'CEE')
  servizio?: string;   // 'R' | 'D' | 'Festivo' | codice linea/turno
  inizio?: string;     // 'H.mm' inizio turno (vuoto nei giorni di riposo)
  termine?: string;    // 'H.mm' fine turno (vuoto nei giorni di riposo)
  /** Serie della FONTE (colonne "Mancati Riposi"/"Indennità" del PDF, criteri di
   *  chi l'ha prodotto). Solo informativi: il motore NON li usa nel calcolo. */
  mancatoRipGiorn?: string;  // 'H.mm' mancato riposo giornaliero secondo la fonte
  mancatoRipSett?: string;   // 'H.mm' mancato riposo settimanale secondo la fonte
  indennitaFonte?: number;   // € indennità del giorno come calcolata nella fonte
}

export interface RestParams {
  /** €/h indennità mancato riposo. Parametro: fonte da confermare con l'avvocato. */
  tariffaOraria: number;
  fonteTariffa?: string;
  /** Soglie in ore (decimali). I default sono quelli del Reg. (CE) 561/2006. */
  riposoGiornalieroRegolare?: number;   // default 11
  riposoGiornalieroRidotto?: number;    // default 9
  riposoSettimanaleRegolare?: number;   // default 45
  riposoSettimanaleRidotto?: number;    // default 24
  /** Numero massimo di riposi giornalieri ridotti tra due riposi settimanali. */
  maxRidottiGiornalieri?: number;       // default 3
  /** Sotto questa quota di riduzione il riposo settimanale è "grave" ai fini sanzionatori. */
  sogliaRiduzioneGrave?: number;        // default 10 (%) — gravità, NON trigger dell'illecito
}

export const DEFAULT_REST_PARAMS: Required<Omit<RestParams, 'tariffaOraria' | 'fonteTariffa'>> = {
  riposoGiornalieroRegolare: 11,
  riposoGiornalieroRidotto: 9,
  riposoSettimanaleRegolare: 45,
  riposoSettimanaleRidotto: 24,
  maxRidottiGiornalieri: 3,
  sogliaRiduzioneGrave: 10,
};

export type EsitoRiposo = 'regolare' | 'ridotto' | 'insufficiente';
export type TipoViolazione = 'riposo_giornaliero' | 'riposo_settimanale';
export type Gravita = 'lieve' | 'grave';

/** Un periodo di riposo effettivamente fruito tra due turni. */
export interface Riposo {
  inizio: Date;          // fine del turno precedente
  fine: Date;            // inizio del turno successivo
  ore: number;           // durata in ore decimali
  esito: EsitoRiposo;
}

export interface Violazione {
  tipo: TipoViolazione;
  rifNormativo: string;
  inizio: string;        // ISO datetime
  fine: string;          // ISO datetime
  ore: number;           // durata riposo fruito (decimali)
  soglia: number;        // soglia di riferimento (11 / 45)
  oreMancanti: number;   // max(0, soglia - ore)
  indennita: number;     // oreMancanti * tariffaOraria
  gravita: Gravita;
  motivo: string;
}

export interface RestResult {
  violazioni: Violazione[];
  totOreMancanti: number;
  totIndennita: number;
  nViolazioniGiornaliere: number;
  nViolazioniSettimanali: number;
  /** Riposi giornalieri ridotti (9–11h) leciti, entro il cap dei 3 tra due settimanali. */
  nRidottiGiornalieriLeciti: number;
  /** Righe non interpretabili o turni anomali → da verificare a mano (policy "segnala, non indovinare"). */
  warnings: string[];
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Converte un orario in formato h.mm in minuti.
 * "6.15" → 375, "38.50" → 2330, "45,00" → 2700, "45" → 2700.
 * Restituisce NaN se i minuti non sono 0–59 (probabile valore decimale, non h.mm).
 */
export function parseHmm(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return NaN;
  const s = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const [hPart, mPart] = s.split('.');
  const h = parseInt(hPart, 10);
  const m = mPart === undefined ? 0 : parseInt(mPart, 10);
  if (m > 59) return NaN; // h.mm valido ha minuti 0–59
  return h * 60 + m;
}

/** Costruisce un Date locale da 'DD/MM/YYYY' + 'H.mm'. */
export function parseDateTime(data: string, ora: string | number): Date {
  const [dd, mm, yyyy] = data.trim().split(/[\/\-.]/).map((x) => parseInt(x, 10));
  const min = parseHmm(ora);
  const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (!Number.isNaN(min)) d.setMinutes(min);
  return d;
}

/** Durata in ore decimali tra due istanti. */
export function durationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

// ─── Classificazione ────────────────────────────────────────────────────────

export function classifyWeeklyRest(ore: number, p: RestParams = { tariffaOraria: 0 }): EsitoRiposo {
  const reg = p.riposoSettimanaleRegolare ?? DEFAULT_REST_PARAMS.riposoSettimanaleRegolare;
  const rid = p.riposoSettimanaleRidotto ?? DEFAULT_REST_PARAMS.riposoSettimanaleRidotto;
  if (ore >= reg) return 'regolare';
  if (ore >= rid) return 'ridotto';
  return 'insufficiente';
}

export function classifyDailyRest(ore: number, p: RestParams = { tariffaOraria: 0 }): EsitoRiposo {
  const reg = p.riposoGiornalieroRegolare ?? DEFAULT_REST_PARAMS.riposoGiornalieroRegolare;
  const rid = p.riposoGiornalieroRidotto ?? DEFAULT_REST_PARAMS.riposoGiornalieroRidotto;
  if (ore >= reg) return 'regolare';
  if (ore >= rid) return 'ridotto';
  return 'insufficiente';
}

// ─── Regola delle due settimane (art. 8 §6) ───────────────────────────────────

/**
 * Applica la regola dell'art. 8 §6: nelle due settimane consecutive servono almeno
 * due riposi settimanali regolari, oppure un regolare e un ridotto (≥24h).
 * In pratica: due riposi settimanali ridotti consecutivi → il secondo è illecito.
 * La riduzione >10% rispetto alle 45h è criterio di GRAVITÀ (Reg. UE 2016/403),
 * NON il trigger dell'illecito (che è la mancata alternanza con un regolare).
 */
export function applyTwoWeekRule(riposiSettimanali: Riposo[], p: RestParams): Violazione[] {
  const out: Violazione[] = [];
  const reg = p.riposoSettimanaleRegolare ?? DEFAULT_REST_PARAMS.riposoSettimanaleRegolare;
  const sogliaGrave = (p.sogliaRiduzioneGrave ?? DEFAULT_REST_PARAMS.sogliaRiduzioneGrave) / 100;
  let prevRidotto = false;

  for (const r of riposiSettimanali) {
    if (r.esito === 'regolare') {
      prevRidotto = false;
      continue;
    }
    // ridotto o insufficiente
    const oreMancanti = Math.max(0, reg - r.ore);
    const grave = r.ore < reg * (1 - sogliaGrave) || r.esito === 'insufficiente';
    const isViolazione = r.esito === 'insufficiente' || prevRidotto;

    if (isViolazione) {
      out.push({
        tipo: 'riposo_settimanale',
        rifNormativo: 'Reg. (CE) n. 561/2006, art. 8 §6; art. 4 lett. h',
        inizio: r.inizio.toISOString(),
        fine: r.fine.toISOString(),
        ore: round2(r.ore),
        soglia: reg,
        oreMancanti: round2(oreMancanti),
        indennita: round2(oreMancanti * p.tariffaOraria),
        gravita: grave ? 'grave' : 'lieve',
        motivo:
          r.esito === 'insufficiente'
            ? `Riposo settimanale di ${formatHm(r.ore)} inferiore al minimo ridotto di 24h`
            : `Secondo riposo settimanale ridotto consecutivo (${formatHm(r.ore)}) senza alternanza con un riposo regolare di 45h`,
      });
    }
    prevRidotto = true;
  }
  return out;
}

// ─── Orchestratore ────────────────────────────────────────────────────────────

interface Duty {
  start: Date;
  end: Date;
  data: string;
}

/** Costruisce i turni (giorni con inizio E termine), gestendo i turni a cavallo di mezzanotte. */
export function buildDuties(giornate: GiornataInput[], warnings: string[] = []): Duty[] {
  const duties: Duty[] = [];
  for (const g of giornate) {
    if (!g.inizio || !g.termine) continue; // giorno di riposo / non lavorativo
    const startMin = parseHmm(g.inizio);
    const endMin = parseHmm(g.termine);
    if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
      warnings.push(`${g.data}: orario non interpretabile (inizio="${g.inizio}", termine="${g.termine}") — verificare a mano`);
      continue;
    }
    const start = parseDateTime(g.data, g.inizio);
    let end = parseDateTime(g.data, g.termine);
    if (end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 3_600_000); // turno che supera la mezzanotte
    }
    if (durationHours(start, end) > 16) {
      warnings.push(`${g.data}: turno di durata anomala (${formatHm(durationHours(start, end))}) — verificare a mano`);
    }
    duties.push({ start, end, data: g.data });
  }
  duties.sort((a, b) => a.start.getTime() - b.start.getTime());
  return duties;
}

/**
 * Entry point del motore. Dalle giornate ricostruisce i riposi tra turni,
 * separa giornaliero (<24h) da settimanale (≥24h) e applica le regole.
 */
export function computeRestViolations(giornate: GiornataInput[], params: RestParams): RestResult {
  const p = { ...DEFAULT_REST_PARAMS, ...params };
  const warnings: string[] = [];
  const duties = buildDuties(giornate, warnings);

  const violazioni: Violazione[] = [];
  const riposiSettimanali: Riposo[] = [];
  let nRidottiLeciti = 0;
  let ridottiNelPeriodo = 0; // ridotti giornalieri dall'ultimo riposo settimanale

  const sogliaG = p.riposoGiornalieroRegolare;

  for (let i = 0; i < duties.length - 1; i++) {
    const inizio = duties[i].end;
    const fine = duties[i + 1].start;
    const ore = durationHours(inizio, fine);
    if (ore <= 0) continue; // turni sovrapposti/duplicati → ignorati

    if (ore >= p.riposoSettimanaleRidotto) {
      // contesto RIPOSO SETTIMANALE
      const esito = classifyWeeklyRest(ore, p);
      riposiSettimanali.push({ inizio, fine, ore, esito });
      ridottiNelPeriodo = 0; // il cap dei ridotti giornalieri si azzera ad ogni settimanale
    } else {
      // contesto RIPOSO GIORNALIERO
      const esito = classifyDailyRest(ore, p);
      if (esito === 'regolare') continue;

      if (esito === 'ridotto') {
        ridottiNelPeriodo++;
        if (ridottiNelPeriodo <= p.maxRidottiGiornalieri) {
          nRidottiLeciti++;
          continue; // riduzione a 9–11h consentita entro il cap → lecito
        }
      }
      // insufficiente (<9h) OPPURE ridotto oltre il cap dei 3 → violazione
      const oreMancanti = Math.max(0, sogliaG - ore);
      violazioni.push({
        tipo: 'riposo_giornaliero',
        rifNormativo: 'Reg. (CE) n. 561/2006, art. 8 §§2,4; art. 4 lett. g',
        inizio: inizio.toISOString(),
        fine: fine.toISOString(),
        ore: round2(ore),
        soglia: sogliaG,
        oreMancanti: round2(oreMancanti),
        indennita: round2(oreMancanti * p.tariffaOraria),
        gravita: esito === 'insufficiente' ? 'grave' : 'lieve',
        motivo:
          esito === 'insufficiente'
            ? `Riposo giornaliero di ${formatHm(ore)} inferiore al minimo ridotto di 9h`
            : `Quarto (o successivo) riposo giornaliero ridotto (${formatHm(ore)}) oltre i 3 consentiti tra due riposi settimanali`,
      });
    }
  }

  violazioni.push(...applyTwoWeekRule(riposiSettimanali, p));

  const nG = violazioni.filter((v) => v.tipo === 'riposo_giornaliero').length;
  const nS = violazioni.filter((v) => v.tipo === 'riposo_settimanale').length;
  return {
    violazioni,
    totOreMancanti: round2(violazioni.reduce((s, v) => s + v.oreMancanti, 0)),
    totIndennita: round2(violazioni.reduce((s, v) => s + v.indennita, 0)),
    nViolazioniGiornaliere: nG,
    nViolazioniSettimanali: nS,
    nRidottiGiornalieriLeciti: nRidottiLeciti,
    warnings,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formatta ore decimali come "Xh YY'" (es. 37.8333 → "37h50'"). */
export function formatHm(ore: number): string {
  const totMin = Math.round(ore * 60);
  const h = Math.floor(totMin / 60);
  const m = totMin % 60;
  return `${h}h${m.toString().padStart(2, '0')}'`;
}
