/**
 * Helper puri per l'editor "tariffe €/h per anno" (override CCNL) dell'area Turni & Riposi.
 *
 * L'editor lavora su un draft `{ 'YYYY': string }` (testo dei campi input); alla conferma
 * si converte in `{ 'YYYY': number }` da passare a `PraticaRiposi.tariffePerAnno`.
 *
 * ⚠️ L'override va salvato COMPLETO su tutti gli anni con violazioni: `rateFor` fa cadere
 * gli anni assenti sul fallback flat `tariffaOraria`, NON sulla curva derivata (restEngine.ts).
 * Il draft è per questo pre-popolato con tutti gli anni e `parseTariffeDraft` fallisce (null)
 * se anche un solo campo non è un importo valido.
 */

/** Formatta un importo €/h per il campo input, in stile italiano (virgola, 2 decimali). */
export function formatTariffaInput(n: number): string {
    return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte il testo di un campo in numero €/h valido (> 0), altrimenti null.
 * Accetta sia la virgola che il punto come separatore decimale: l'ULTIMO separatore
 * incontrato è il decimale, gli altri sono migliaia e vengono rimossi. Così "10,08",
 * "10.08" e "1.234,56" sono tutti interpretati correttamente (tariffe piccole, ma robusto).
 */
export function parseTariffaInput(raw: string): number | null {
    const t = raw.trim();
    if (t === '') return null;
    const decPos = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
    const s = decPos === -1
        ? t.replace(/\s/g, '')
        : t.slice(0, decPos).replace(/[.,\s]/g, '') + '.' + t.slice(decPos + 1).replace(/[.,\s]/g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Converte l'intero draft in override numerico. Ritorna null se il draft è vuoto o se
 * anche un solo campo non è valido (blocca il salvataggio → nessun anno finisce sul fallback).
 */
export function parseTariffeDraft(draft: Record<string, string>): Record<string, number> | null {
    const keys = Object.keys(draft);
    if (keys.length === 0) return null;
    const out: Record<string, number> = {};
    for (const y of keys) {
        const v = parseTariffaInput(draft[y]);
        if (v == null) return null;
        out[y] = v;
    }
    return out;
}

/** Costruisce il draft (testo) a partire dalla curva €/h applicata, anni ordinati crescenti. */
export function tariffeToDraft(rates: Record<string, number>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const y of Object.keys(rates).sort()) out[y] = formatTariffaInput(rates[y]);
    return out;
}

/** True se il draft differisce dalla curva di partenza (qualche campo modificato). */
export function draftIsDirty(draft: Record<string, string>, rates: Record<string, number>): boolean {
    const base = tariffeToDraft(rates);
    const keys = new Set([...Object.keys(base), ...Object.keys(draft)]);
    for (const y of keys) if ((draft[y] ?? '') !== (base[y] ?? '')) return true;
    return false;
}
