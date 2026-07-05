/**
 * Scoping delle pratiche per organizzazione (multi-sindacato/CAF, migration 022).
 *
 * Principio FAIL-OPEN: si filtra SOLO quando l'organizzazione attiva è una riga
 * reale del DB (uuid). La sentinella client 'fast-confsal' (fallback demo/errore
 * di useSindacati), il livello organizzazione non ancora scelto (null) e le
 * pratiche legacy senza `sindacato_id` restano sempre visibili: un blip di rete
 * o un dato non ancora collegato non devono mai svuotare una vista.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);

/** true se una pratica col dato `sindacatoId` è visibile nell'organizzazione `attivo`. */
export const matchesSindacato = (
    sindacatoId: string | null | undefined,
    attivo: string | null | undefined,
): boolean => !isUuid(attivo) || sindacatoId == null || sindacatoId === attivo;

/** L'id da stampare su DB alla creazione di una pratica: solo organizzazioni reali (uuid). */
export const sindacatoIdPerScrittura = (attivo: string | null | undefined): string | undefined =>
    isUuid(attivo) ? attivo : undefined;
