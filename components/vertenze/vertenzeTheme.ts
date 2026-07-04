/**
 * Tema visivo dell'area "Indennità" — RAME/ambra. Fonte unica condivisa da landing (VertenzeArea)
 * e dettaglio (VertenzaDetail). Gemello di `riposi/riposiTheme.ts` (indaco), colori propri di questa sezione.
 */
export const VERTENZE_THEME = {
    start: '#f59e0b',   // amber-500
    end: '#ea580c',     // orange-600
    glow: 'rgba(245, 158, 11, 0.45)',
    spotlight: 'rgba(245, 158, 11, 0.22)',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
} as const;

/** Fascia gradiente della testata (dal brand-area → trasparente). */
export const vertenzeHeaderBand =
    `linear-gradient(180deg, ${VERTENZE_THEME.start}3d 0%, ${VERTENZE_THEME.start}30 22%, ${VERTENZE_THEME.end}1f 45%, ${VERTENZE_THEME.end}10 68%, ${VERTENZE_THEME.end}06 86%, transparent 100%)`;

/** Colore (hex) per stato pratica — per la tacca-stato laterale con glow. */
export const STATO_HEX_VERTENZA: Record<string, string> = {
    bozza: '#94a3b8',    // slate-400
    in_corso: '#f59e0b', // amber-500
    pagata: '#10b981',   // emerald-500
};
