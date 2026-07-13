import { AnnoDati, ProfiloAzienda, getFixedColumnsByProfile } from '../types';

// Codici delle VOCI FISSE continuative (Quadro B) per RFI/Trenitalia.
// Whitelist storica, default di mergeFixedVociIntoAnni per retrocompatibilità.
export const FIXED_VOCI_IDS = [
  '3B01', '3B03', '3B05', '3B10', '3B15', '3B20', '3B30', '3B35', '3B70', '3B71',
] as const;

// Whitelist per profilo: unica fonte di verità = getFixedColumnsByProfile (types.ts).
// SOLO questi campi possono essere scritti dal backfill di quel profilo.
export const getFixedVociIds = (profilo: ProfiloAzienda): string[] =>
  getFixedColumnsByProfile(profilo).map(c => c.id);

/**
 * Esito del merge della risposta AI sull'array `anni` di un lavoratore.
 * `updated` è true solo se almeno un campo fisso è effettivamente cambiato.
 */
export interface FixedMergeResult {
  anni: AnnoDati[];
  updated: boolean;
}

/**
 * MERGE-SAFE: scrive ESCLUSIVAMENTE i codici della whitelist `fixedIds` (default: i 3B..
 * di RFI/Trenitalia; per gli altri profili passare `getFixedVociIds(profilo)`) sulla riga
 * (year, monthIndex) GIÀ esistente. Garanzie:
 *  - non crea righe nuove (se il mese non esiste, no-op);
 *  - non tocca NESSUN altro campo (giorni, indennità variabili, note, ticket…) →
 *    impossibile clobberare i dati corretti a mano;
 *  - scrive solo valori finiti e ≠ 0 (uno 0 resta implicito, non sporca la riga);
 *  - idempotente: rilanciarlo non cambia nulla se i valori coincidono.
 */
export function mergeFixedVociIntoAnni(
  anni: AnnoDati[],
  year: number,
  monthIndex: number,
  fixedCodes: Record<string, unknown> | null | undefined,
  fixedIds: readonly string[] = FIXED_VOCI_IDS
): FixedMergeResult {
  if (!Array.isArray(anni)) return { anni: [], updated: false };
  if (!fixedCodes || typeof fixedCodes !== 'object') return { anni, updated: false };

  const idx = anni.findIndex(
    r => r && Number(r.year) === year && Number(r.monthIndex) === monthIndex
  );
  if (idx < 0) return { anni, updated: false }; // nessuna riga per quel mese: non creiamo nulla

  const row: AnnoDati = { ...anni[idx] };
  let changed = false;
  for (const id of fixedIds) {
    const v = Number((fixedCodes as Record<string, unknown>)[id]);
    if (isFinite(v) && v !== 0 && row[id] !== v) {
      row[id] = v;
      changed = true;
    }
  }
  if (!changed) return { anni, updated: false };

  const next = anni.slice();
  next[idx] = row;
  return { anni: next, updated: true };
}

/**
 * Deriva (anno, indice mese 0-11) per una busta caricata da FILE (non dall'archivio, dove il
 * periodo è nei metadati). Priorità: se il NOME FILE contiene un periodo completo (mese
 * testuale + anno, es. "Gennaio 2013.PDF") vince il nome — è la stessa politica del batch
 * scan e dell'audit archivio: un nome curato è verità verificata, la testata AI può sbagliare.
 * Per i nomi non-standard (foto, export vari) vale il periodo letto dall'AI dalla testata
 * (`aiMonth` 1-12, `aiYear` 4 cifre), con fallback sui pezzi riconoscibili del nome.
 * Restituisce null se non identificabile → il chiamante salta la busta senza indovinare il mese.
 */
export function deriveFixedVociPeriod(
  aiMonth: unknown,
  aiYear: unknown,
  fileName: string
): { year: number; monthIdx: number } | null {
  const name = typeof fileName === 'string' ? fileName : '';
  const abbr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const fn = name.toLowerCase();
  const nameMonthIdx = abbr.findIndex(a => fn.includes(a));
  const nameYearMatch = name.match(/(20\d{2})/);

  // Nome file con periodo COMPLETO → vince il nome.
  if (nameMonthIdx >= 0 && nameYearMatch) {
    return { year: parseInt(nameYearMatch[1], 10), monthIdx: nameMonthIdx };
  }

  let year = parseInt(String(aiYear ?? '').replace(/[^\d]/g, ''), 10);
  if (!(year >= 2000 && year <= 2100)) {
    year = nameYearMatch ? parseInt(nameYearMatch[1], 10) : NaN;
  }
  let monthIdx = -1;
  const mNum = parseInt(String(aiMonth ?? '').replace(/[^\d]/g, ''), 10);
  if (mNum >= 1 && mNum <= 12) monthIdx = mNum - 1;
  if (monthIdx < 0) monthIdx = nameMonthIdx;
  if (!(year >= 2000 && year <= 2100) || monthIdx < 0 || monthIdx > 11) return null;
  return { year, monthIdx };
}
