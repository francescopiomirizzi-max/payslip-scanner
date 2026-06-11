// Rate limit best-effort in-memory per netlify functions.
//
// LIMITI NOTI:
// - Sopravvive solo nei warm container: un cold-start resetta i bucket.
// - Non condiviso tra istanze parallele della stessa function.
// È un FRENO, non una garanzia. Difesa in profondità contro:
//   1) il QR sniffato che usa una sessione legittima per saturare la quota Gemini
//   2) un IP che brutalizza più session_id casuali
//
// Per garanzie forti servirebbe un store esterno (Upstash/Redis). Qui basta a fermare
// l'abuso più ovvio senza aggiungere infra.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
    key: string,
    max: number,
    windowMs: number
): { allowed: boolean; resetInMs: number } {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt < now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, resetInMs: windowMs };
    }
    if (b.count >= max) {
        return { allowed: false, resetInMs: b.resetAt - now };
    }
    b.count++;
    return { allowed: true, resetInMs: b.resetAt - now };
}

export function clientIp(event: { headers: Record<string, string | undefined> }): string {
    // Netlify mette l'IP reale qui. Cadiamo su 'unknown' per non rompere il dev locale.
    const fwd = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
    if (fwd) return fwd.split(',')[0].trim();
    return event.headers['x-nf-client-connection-ip'] || event.headers['X-NF-Client-Connection-Ip'] || 'unknown';
}

/**
 * Helper per le scan functions: limita per session_id E per IP.
 * Soglie: 30 chiamate / 5 min per session_id (path QR); 300 / 5 min per IP.
 * Il bucket IP è largo apposta: l'upload massivo desktop (che non manda
 * sessionId) deve poter caricare l'intero archivio 2008-2025 in un colpo solo
 * (~216 file + retry, pool da 3 simultanee ≈ 75 req/5min) senza farsi
 * strozzare. 300/5min resta comunque un freno reale contro chi brutalizza la
 * quota Gemini da un singolo IP.
 */
export function checkScanRateLimit(sessionId: string | undefined, ip: string): { allowed: boolean; reason?: string } {
    const FIVE_MIN = 5 * 60 * 1000;
    if (sessionId) {
        const r = checkRateLimit(`scan:sess:${sessionId}`, 30, FIVE_MIN);
        if (!r.allowed) return { allowed: false, reason: `Limite sessione raggiunto. Riprova tra ${Math.ceil(r.resetInMs / 1000)}s.` };
    }
    const ipResult = checkRateLimit(`scan:ip:${ip}`, 300, FIVE_MIN);
    if (!ipResult.allowed) return { allowed: false, reason: `Troppe scansioni dallo stesso dispositivo. Riprova tra ${Math.ceil(ipResult.resetInMs / 1000)}s.` };
    return { allowed: true };
}
