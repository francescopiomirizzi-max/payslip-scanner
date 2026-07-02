/**
 * Tema visivo dell'area "Turni & Riposi" — un'unica fonte condivisa da landing, card e detail.
 *
 * Le pratiche-riposi non hanno un'azienda di sistema (Viterbo `azienda=null`) → niente colore-brand
 * come nelle buste paga: l'area ha un'identità propria (gradiente indigo→violet, "tempo/turni").
 * Se un domani `pratica.azienda` sarà valorizzata si potrà agganciare qui il colore/logo aziendale.
 */
export const RIPOSI_THEME = {
    start: '#6366f1',   // indigo-500
    end: '#8b5cf6',     // violet-500
    glow: 'rgba(99, 102, 241, 0.45)',
    spotlight: 'rgba(99, 102, 241, 0.22)',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
} as const;

/** Fascia gradiente della testata (dal brand → trasparente), come la testata-azienda di `WorkerCard`. */
export const riposiHeaderBand =
    `linear-gradient(180deg, ${RIPOSI_THEME.start}3d 0%, ${RIPOSI_THEME.start}30 22%, ${RIPOSI_THEME.end}1f 45%, ${RIPOSI_THEME.end}10 68%, ${RIPOSI_THEME.end}06 86%, transparent 100%)`;

/** Colore (hex) per stato pratica — per la tacca-stato laterale con glow (STATO_META tiene solo classi Tailwind). */
export const STATO_HEX: Record<string, string> = {
    in_corso: '#f59e0b', // amber-500
    conclusa: '#10b981', // emerald-500
    pagata: '#0ea5e9',   // sky-500
};
