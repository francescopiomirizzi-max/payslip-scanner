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
  /** €/h indennità mancato riposo. Parametro: fonte da confermare con l'avvocato.
   *  Usata come fallback per gli anni non presenti in `tariffePerAnno`. */
  tariffaOraria: number;
  fonteTariffa?: string;
  /** Tariffa €/h per anno ('YYYY'→€/h). La retribuzione cresce per anzianità di
   *  servizio, quindi ogni violazione è valorizzata alla tariffa del SUO anno.
   *  Se assente (o anno mancante) si usa `tariffaOraria`. La curva si ricava dalla
   *  fonte con `deriveTariffePerAnno`, oppure è un override confermato dall'avvocato. */
  tariffePerAnno?: Record<string, number>;
  /** Coefficiente sul valore del riposo perso (default 1 = valore pieno). Metodo
   *  dell'avvocato: il danno è il 20% del valore → `0.20`. (In alternativa una
   *  maggiorazione +20% sarebbe `1.20`.) Si applica come fattore globale, separato
   *  dalla tariffa: indennità = ore mancanti × tariffa dell'anno × coefficiente. */
  coefficiente?: number;
  /** Soglie in ore (decimali). I default sono quelli del Reg. (CE) 561/2006. */
  riposoGiornalieroRegolare?: number;   // default 11
  riposoGiornalieroRidotto?: number;    // default 9
  riposoSettimanaleRegolare?: number;   // default 45
  riposoSettimanaleRidotto?: number;    // default 24
  /** Numero massimo di riposi giornalieri ridotti tra due riposi settimanali. */
  maxRidottiGiornalieri?: number;       // default 3
  /** Sotto questa quota di riduzione il riposo settimanale è "grave" ai fini sanzionatori. */
  sogliaRiduzioneGrave?: number;        // default 10 (%) — gravità, NON trigger dell'illecito
  /** Se true, conta SOLO le violazioni attribuite a giorni marcati CEE (servizio in
   *  scope Reg. 561/2006, art. 3: linea regolare >50 km). Confermato dall'avvocato
   *  per il caso Viterbo (15/06/2026). Default false = tutti i giorni. */
  soloCEE?: boolean;
}

export const DEFAULT_REST_PARAMS: Required<Omit<RestParams, 'tariffaOraria' | 'fonteTariffa' | 'soloCEE' | 'tariffePerAnno' | 'coefficiente'>> = {
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
  /** true se il turno che PRECEDE il riposo è marcato CEE (attribuzione del filtro). */
  cee?: boolean;
  /** 'DD/MM/YYYY' del turno che precede il riposo: giorno a cui si attribuisce la violazione. */
  dataTurno?: string;
}

export interface Violazione {
  tipo: TipoViolazione;
  rifNormativo: string;
  inizio: string;        // ISO datetime
  fine: string;          // ISO datetime
  ore: number;           // durata riposo fruito (decimali)
  soglia: number;        // soglia di riferimento (11 / 45)
  oreMancanti: number;   // max(0, soglia - ore)
  valorePieno: number;   // oreMancanti × tariffa €/h dell'anno (prima del coefficiente)
  indennita: number;     // valorePieno × coefficiente danno (= valorePieno se coeff=1)
  gravita: Gravita;
  motivo: string;
  /** true se la violazione è attribuita a un giorno-turno CEE (turno che precede il riposo). */
  cee: boolean;
  /** 'DD/MM/YYYY' del turno che precede il riposo (giorno di attribuzione, come il PDF
   *  per i giornalieri). Robusto ai turni a cavallo di mezzanotte (≠ data di `inizio`). */
  dataTurno?: string;
}

export interface RestResult {
  violazioni: Violazione[];
  totOreMancanti: number;
  totIndennita: number;
  nViolazioniGiornaliere: number;
  nViolazioniSettimanali: number;
  /** Riposi giornalieri ridotti (9–11h) leciti, entro il cap dei 3 tra due settimanali. */
  nRidottiGiornalieriLeciti: number;
  /** Somma dei valori pieni (ore mancanti × tariffa €/h dell'anno), PRIMA del coefficiente.
   *  × coefficiente = totIndennita. Esposto per la trasparenza del calcolo. */
  totValorePieno: number;
  /** Tariffa €/h PIENA applicata per anno ('YYYY'→€/h), coefficiente escluso. Esatta
   *  (non recuperata dagli importi arrotondati): la fonte di verità per il display. */
  tariffePerAnnoApplicate: Record<string, number>;
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
      const valorePieno = round2(oreMancanti * rateFor(r.inizio, p));
      out.push({
        tipo: 'riposo_settimanale',
        rifNormativo: 'Reg. (CE) n. 561/2006, art. 8 §6; art. 4 lett. h',
        inizio: r.inizio.toISOString(),
        fine: r.fine.toISOString(),
        ore: round2(r.ore),
        soglia: reg,
        oreMancanti: round2(oreMancanti),
        valorePieno,
        indennita: round2(valorePieno * (p.coefficiente ?? 1)),
        gravita: grave ? 'grave' : 'lieve',
        cee: r.cee ?? false,
        dataTurno: r.dataTurno,
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
  tipo?: string;   // marcatore della giornata (es. 'CEE'), informativo per il filtro soloCEE
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
    duties.push({ start, end, data: g.data, tipo: g.tipo });
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
  let nRidottiLecitiCEE = 0;
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
      riposiSettimanali.push({ inizio, fine, ore, esito, cee: isCEE(duties[i].tipo), dataTurno: duties[i].data });
      ridottiNelPeriodo = 0; // il cap dei ridotti giornalieri si azzera ad ogni settimanale
    } else {
      // contesto RIPOSO GIORNALIERO
      const esito = classifyDailyRest(ore, p);
      if (esito === 'regolare') continue;

      if (esito === 'ridotto') {
        ridottiNelPeriodo++;
        if (ridottiNelPeriodo <= p.maxRidottiGiornalieri) {
          nRidottiLeciti++;
          if (isCEE(duties[i].tipo)) nRidottiLecitiCEE++;
          continue; // riduzione a 9–11h consentita entro il cap → lecito
        }
      }
      // insufficiente (<9h) OPPURE ridotto oltre il cap dei 3 → violazione
      const oreMancanti = Math.max(0, sogliaG - ore);
      const valorePieno = round2(oreMancanti * rateFor(inizio, p));
      violazioni.push({
        tipo: 'riposo_giornaliero',
        rifNormativo: 'Reg. (CE) n. 561/2006, art. 8 §§2,4; art. 4 lett. g',
        inizio: inizio.toISOString(),
        fine: fine.toISOString(),
        ore: round2(ore),
        soglia: sogliaG,
        oreMancanti: round2(oreMancanti),
        valorePieno,
        indennita: round2(valorePieno * (p.coefficiente ?? 1)),
        gravita: esito === 'insufficiente' ? 'grave' : 'lieve',
        cee: isCEE(duties[i].tipo),
        dataTurno: duties[i].data,
        motivo:
          esito === 'insufficiente'
            ? `Riposo giornaliero di ${formatHm(ore)} inferiore al minimo ridotto di 9h`
            : `Quarto (o successivo) riposo giornaliero ridotto (${formatHm(ore)}) oltre i 3 consentiti tra due riposi settimanali`,
      });
    }
  }

  violazioni.push(...applyTwoWeekRule(riposiSettimanali, p));

  // Filtro "solo giorni CEE" (Reg. 561/2006, art. 3: si applica al servizio di linea
  // regolare >50 km). Confermato dall'avvocato per Viterbo: ai fini del calcolo contano
  // solo le giornate marcate CEE; la violazione è attribuita al turno che PRECEDE il
  // riposo (coerente con la fonte). Il filtro NON altera l'analisi giuridica della
  // sequenza (alternanza, cap dei ridotti) — scarta solo le violazioni non-CEE dal computo.
  const claimable = p.soloCEE ? violazioni.filter((v) => v.cee) : violazioni;

  const nG = claimable.filter((v) => v.tipo === 'riposo_giornaliero').length;
  const nS = claimable.filter((v) => v.tipo === 'riposo_settimanale').length;

  // Tariffa €/h PIENA applicata a ciascun anno con violazioni (coefficiente escluso):
  // dipende solo dall'anno, quindi è esatta e basta registrarla una volta per anno.
  const tariffePerAnnoApplicate: Record<string, number> = {};
  for (const v of claimable) {
    const y = v.inizio.slice(0, 4);
    if (!(y in tariffePerAnnoApplicate)) tariffePerAnnoApplicate[y] = p.tariffePerAnno?.[y] ?? p.tariffaOraria;
  }

  return {
    violazioni: claimable,
    totOreMancanti: round2(claimable.reduce((s, v) => s + v.oreMancanti, 0)),
    totValorePieno: round2(claimable.reduce((s, v) => s + v.valorePieno, 0)),
    totIndennita: round2(claimable.reduce((s, v) => s + v.indennita, 0)),
    nViolazioniGiornaliere: nG,
    nViolazioniSettimanali: nS,
    nRidottiGiornalieriLeciti: p.soloCEE ? nRidottiLecitiCEE : nRidottiLeciti,
    tariffePerAnnoApplicate,
    warnings,
  };
}

/** Marca la giornata come servizio in scope Reg. 561/2006 (colonna "tipo" = CEE). */
function isCEE(tipo?: string): boolean {
  return (tipo || '').trim().toUpperCase() === 'CEE';
}

/** Tariffa €/h applicabile a un riposo, per l'anno del suo inizio: la voce di
 *  `tariffePerAnno` se presente, altrimenti la `tariffaOraria` di fallback. */
function rateFor(inizio: Date, p: RestParams): number {
  const y = String(inizio.getFullYear());
  const perAnno = p.tariffePerAnno?.[y];
  return perAnno != null ? perAnno : p.tariffaOraria;
}

/** True se almeno una giornata è marcata CEE → la pratica va calcolata in "solo CEE". */
export function hasCEEDays(giornate: GiornataInput[]): boolean {
  return giornate.some((g) => isCEE(g.tipo));
}

/** Causale sintetica per tabelle/export (il motivo esteso resta nella violazione). */
export function causaleSintetica(v: Violazione): string {
  if (v.tipo === 'riposo_giornaliero') {
    return /Quarto/.test(v.motivo) ? 'Riposo ridotto oltre i 3 consentiti' : 'Riposo inferiore al minimo ridotto (9h)';
  }
  return /Secondo/.test(v.motivo) ? 'Secondo ridotto consecutivo senza alternanza (45h)' : 'Riposo inferiore al minimo ridotto (24h)';
}

// ─── Serie della FONTE ────────────────────────────────────────────────────────

export interface SerieFonte {
  /** Giornate con indennità valorizzata nella fonte. */
  gg: number;
  /** Ore mancanti totali secondo la fonte (somma mancatoRipGiorn + mancatoRipSett). */
  ore: number;
  /** € indennità totale secondo la fonte. */
  ind: number;
  /** € indennità per anno ('YYYY'). */
  perAnno: Record<string, number>;
}

/**
 * Aggrega la serie della FONTE (colonne indennità del PDF sorgente, criteri di
 * chi l'ha prodotto). Solo lettura dei campi informativi: il motore 561/2006
 * non c'entra. Le due serie si AFFIANCANO, non si sommano.
 */
export function computeSerieFonte(giornate: GiornataInput[]): SerieFonte {
  let gg = 0, minuti = 0, ind = 0;
  const perAnno: Record<string, number> = {};
  for (const g of giornate) {
    if (g.indennitaFonte == null) continue;
    gg++; ind += g.indennitaFonte;
    for (const v of [g.mancatoRipGiorn, g.mancatoRipSett]) {
      const m = parseHmm(v);
      if (!Number.isNaN(m)) minuti += m;
    }
    const y = g.data.split('/')[2] ?? '';
    perAnno[y] = (perAnno[y] ?? 0) + g.indennitaFonte;
  }
  return { gg, ore: minuti / 60, ind: round2(ind), perAnno };
}

// ─── Confronto PDF ↔ nostro metodo ────────────────────────────────────────────

export type ConfrontoStato = 'pdf' | 'nostra' | 'entrambi';

export interface ConfrontoResult {
  /** Stato di ogni giorno con un mancato riposo (del PDF e/o nostro), 'DD/MM/YYYY'. */
  perGiorno: Record<string, ConfrontoStato>;
  /** Giorni indennizzati dal documento sorgente (PDF). */
  pdfGiorni: number;
  /** Nostre violazioni 561/2006 per tipo. */
  nostreGiorn: number;
  nostreSett: number;
  /** Nostre violazioni giornaliere che cadono su un giorno indennizzato dal PDF (allineamento). */
  concordiGiorn: number;
  /** Giorni con una nostra violazione che il PDF NON ha indennizzato. */
  soloNostro: number;
  /** Giorni indennizzati dal PDF senza una nostra violazione (sovra-conteggio del PDF). */
  soloPdf: number;
}

/**
 * Confronto giorno-per-giorno tra il documento sorgente (PDF) e il nostro motore
 * 561/2006. Il PDF indicizza un giorno quando lo indennizza (`indennitaFonte`); noi
 * quando attribuiamo una violazione al turno di quel giorno (`dataTurno`). Onesto sui
 * limiti: i riposi GIORNALIERI si allineano (vedi `concordiGiorn`), i SETTIMANALI no
 * (il PDF li conta a scorrimento, noi per evento) → per il settimanale conta il numero/€,
 * non il singolo giorno. Funzione PURA.
 */
export function buildConfronto(giornate: GiornataInput[], result: RestResult): ConfrontoResult {
  const pdfDay = new Set<string>();
  for (const g of giornate) if (g.indennitaFonte != null && g.indennitaFonte > 0) pdfDay.add(g.data);

  const nostraDay = new Map<string, TipoViolazione>(); // giorno → tipo (il giornaliero prevale come marcatore)
  let nostreGiorn = 0, nostreSett = 0, concordiGiorn = 0;
  for (const v of result.violazioni) {
    const d = v.dataTurno;
    if (v.tipo === 'riposo_giornaliero') { nostreGiorn++; if (d && pdfDay.has(d)) concordiGiorn++; }
    else nostreSett++;
    if (!d) continue;
    if (!nostraDay.has(d) || v.tipo === 'riposo_giornaliero') nostraDay.set(d, v.tipo);
  }

  const perGiorno: Record<string, ConfrontoStato> = {};
  for (const d of pdfDay) perGiorno[d] = nostraDay.has(d) ? 'entrambi' : 'pdf';
  for (const d of nostraDay.keys()) if (!pdfDay.has(d)) perGiorno[d] = 'nostra';

  let soloNostro = 0, soloPdf = 0;
  for (const s of Object.values(perGiorno)) { if (s === 'nostra') soloNostro++; else if (s === 'pdf') soloPdf++; }

  return { perGiorno, pdfGiorni: pdfDay.size, nostreGiorn, nostreSett, concordiGiorn, soloNostro, soloPdf };
}

// ─── Tariffa per anno ─────────────────────────────────────────────────────────

/**
 * Ricava la tariffa €/h di OGNI anno dal documento sorgente: per anno
 * `Σ indennitaFonte / Σ ore mancanti fonte`. È la retribuzione oraria reale che
 * cresce per anzianità di servizio (es. Viterbo: €10,08 nel 2011 → €13,13 nel
 * 2024). Gli anni senza ore-fonte sono omessi (niente da cui dedurre la tariffa).
 */
export function deriveTariffePerAnno(giornate: GiornataInput[]): Record<string, number> {
  const acc: Record<string, { ind: number; min: number }> = {};
  for (const g of giornate) {
    if (g.indennitaFonte == null) continue;
    const y = g.data.split('/')[2] ?? '';
    if (!y) continue;
    (acc[y] ??= { ind: 0, min: 0 }).ind += g.indennitaFonte;
    for (const v of [g.mancatoRipGiorn, g.mancatoRipSett]) {
      const m = parseHmm(v);
      if (!Number.isNaN(m)) acc[y].min += m;
    }
  }
  const out: Record<string, number> = {};
  for (const [y, { ind, min }] of Object.entries(acc)) {
    if (min > 0) out[y] = round2(ind / (min / 60));
  }
  return out;
}

/**
 * Tariffa €/h per anno da passare al motore: l'override della pratica se presente,
 * altrimenti la curva ricavata dalla fonte. È il valore orario PIENO; il coefficiente
 * danno (se attivo) è un fattore separato che non altera questa tariffa.
 */
export function resolveTariffePerAnno(giornate: GiornataInput[], override?: Record<string, number>): Record<string, number> {
  return override ?? deriveTariffePerAnno(giornate);
}

/** Min/max di una curva di tariffe per il display; `uniform` se è di fatto piatta. */
export function tariffaRange(rates: Record<string, number>): { min: number; max: number; uniform: boolean } {
  const vals = Object.values(rates);
  if (vals.length === 0) return { min: 0, max: 0, uniform: true };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return { min, max, uniform: max - min < 0.005 };
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
