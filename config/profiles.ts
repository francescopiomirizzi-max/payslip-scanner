// ============================================================
// config/profiles.ts
// REGISTRO CENTRALIZZATO DEI PROFILI AZIENDALI DI SISTEMA
//
// Prima di questo file la configurazione di un profilo (colori, label,
// CCNL, PEC, tema modale) era duplicata in 11+ file: aggiungere un'azienda
// significava ricordarsi di toccarli tutti (vedi tasks/lessons.md Lezione 9).
//
// Ora un profilo di sistema = UNA voce in SYSTEM_PROFILES.
// Le stringhe Tailwind restano literal (necessario per il JIT purge).
// ============================================================

import { Building2, Train, Coffee, Sparkles, Truck, TramFront } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Aziende custom: 6 famiglie cromatiche assegnate deterministicamente ──────
const CUSTOM_FAMILIES_COUNT = 6;

/**
 * Hash deterministico nome-azienda → indice palette (0..5).
 * Sostituisce 7 copie identiche dell'algoritmo sparse nel codebase.
 */
export function getCustomColorIndex(key: string): number {
  let hash = 0;
  for (let i = 0; i < (key?.length ?? 0); i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CUSTOM_FAMILIES_COUNT;
}

// ── Tipi ────────────────────────────────────────────────────────────────────

export interface ProfileFooterBadge {
  wrap: string;
  dot: string;
  name: string;
  count: string;
}

export interface ProfileModalTheme {
  color: string;
  glow: string;
  gradient: string;
  avatarBg: string;
  avatarText: string;
  lightGlow: string;
  icon: LucideIcon;
}

export interface SystemProfile {
  key: string;
  /** Label breve uppercase per i selettori (WorkerModal OPTIONS, footer). */
  label: string;
  /** Sottotitolo descrittivo nel selettore aziendale. */
  sub: string;
  /** Label "umana" per intestazioni di dettaglio (WorkerDetailPage). */
  detailLabel: string;
  /** PEC aziendale per l'invio della pratica (vuota se non disponibile). */
  pec: string;
  /** Nome CCNL per le note dei PDF di stampa. */
  ccnl: string;
  /** Riferimento CCNL nel corpus vettoriale RAG (legal_documents.ccnl_ref). */
  ccnlRef: string;
  /** Informativa CCNL breve per la scheda azienda (2-4 righe, linguaggio piano). */
  ccnlSummary: string;
  /** Punti salienti del CCNL per la scheda azienda (bullet brevi). */
  ccnlHighlights: string[];
  /** Colore identificativo esadecimale. */
  hex: string;
  /** Classi badge per ogni contesto UI. */
  badge: {
    filter: string;       // App.tsx — pill filtro attivo
    card: string;         // WorkerCard
    detail: string;       // WorkerDetailPage
    archive: string;      // ArchivePage
    pivot: string;        // IndemnityPivotTable + AnnualCalculationTable
    pivotHeader: string;  // IndemnityPivotTable — header
    statsBg: string;      // StatsDashboard — barra/avatar
  };
  /** Badge contatore del footer dashboard. */
  footer: ProfileFooterBadge;
  /** Tema ricco del selettore aziendale in WorkerModal. */
  modal: ProfileModalTheme;
}

// ── Registro ────────────────────────────────────────────────────────────────

export const SYSTEM_PROFILES: Record<string, SystemProfile> = {
  RFI: {
    key: 'RFI',
    label: 'RFI',
    sub: 'Infrastrutture',
    detailLabel: 'RFI',
    pec: 'ru.rfi@pec.rfi.it',
    ccnl: 'CCNL Mobilità',
    ccnlRef: 'Mobilità/Ferroviari',
    ccnlSummary: 'Si applica il CCNL della Mobilità / Area Attività Ferroviarie (rinnovo 22 maggio 2025, scadenza 31/12/2026), lo stesso di Trenitalia. La base giuridica delle ferie sono gli artt. 30 (Ferie) e 83 (Indennità diverse): il credito si calcola sulle effettive giornate lavorative lette dalle buste.',
    ccnlHighlights: [
      'Ferie: artt. 30 e 83 CCNL Mobilità',
      'Tetto 28 giorni/anno (Cass. 20216/2022)',
      'Reperibilità ex art. 79 (codici 0470/0482/0496/0584)',
      'Divisore 26 = solo parte fissa, non le variabili',
    ],
    hex: '#3b82f6',
    badge: {
      filter: 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-blue-400 scale-105 border-transparent',
      card: 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-cyan-400 border-blue-200 dark:border-blue-700/50',
      detail: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 border-blue-200 dark:border-blue-700/50',
      archive: 'bg-blue-100 text-blue-700 border-blue-200',
      pivot: 'text-blue-400 border-blue-600 bg-blue-900/30',
      pivotHeader: 'text-blue-700',
      statsBg: 'bg-blue-500',
    },
    footer: {
      wrap: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50',
      dot: 'bg-blue-500 dark:bg-cyan-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-blue-800 dark:text-cyan-300',
      count: 'text-blue-600 dark:text-cyan-500',
    },
    modal: {
      color: '#3b82f6',
      glow: '0 0 60px -15px rgba(59, 130, 246, 0.7)',
      gradient: 'from-blue-500 via-indigo-600 to-violet-600',
      avatarBg: 'from-blue-500 to-indigo-600',
      avatarText: 'text-white',
      lightGlow: 'rgba(59, 130, 246, 0.5)',
      icon: Train,
    },
  },

  TRENITALIA: {
    key: 'TRENITALIA',
    label: 'TRENITALIA',
    sub: 'Trasporto Ferroviario',
    detailLabel: 'Trenitalia',
    pec: '',
    ccnl: 'CCNL Mobilità',
    ccnlRef: 'Mobilità/Ferroviari',
    ccnlSummary: 'Stesso CCNL della Mobilità / Area Attività Ferroviarie di RFI (rinnovo 22 maggio 2025). Le ferie sono regolate dagli artt. 30 e 83; il credito si calcola sulle effettive giornate lavorative lette dalle buste, con il tetto di 28 giorni annui conteggiabili.',
    ccnlHighlights: [
      'CCNL Mobilità, come RFI',
      'Ferie: artt. 30 e 83',
      'Tetto 28 giorni/anno (Cass. 20216/2022)',
      'Calcolo sulle giornate effettive',
    ],
    hex: '#dc2626',
    badge: {
      filter: 'bg-red-600 text-white shadow-lg shadow-red-500/40 ring-2 ring-red-400 scale-105 border-transparent',
      card: 'bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50',
      detail: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/50',
      archive: 'bg-red-100 text-red-700 border-red-200',
      pivot: 'text-red-400 border-red-600 bg-red-900/30',
      pivotHeader: 'text-red-700',
      statsBg: 'bg-red-600',
    },
    footer: {
      wrap: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50',
      dot: 'bg-red-600 dark:bg-red-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-red-800 dark:text-red-300',
      count: 'text-red-600 dark:text-red-500',
    },
    modal: {
      color: '#dc2626',
      glow: '0 0 60px -15px rgba(220, 38, 38, 0.7)',
      gradient: 'from-red-600 via-rose-600 to-red-700',
      avatarBg: 'from-red-600 to-rose-700',
      avatarText: 'text-white',
      lightGlow: 'rgba(220, 38, 38, 0.5)',
      icon: Train,
    },
  },

  ELIOR: {
    key: 'ELIOR',
    label: 'ELIOR',
    sub: 'Ristorazione',
    detailLabel: 'ELIOR',
    pec: 'elior@legalmail.it',
    ccnl: 'CCNL Ristorazione',
    ccnlRef: 'Ristorazione Collettiva',
    ccnlSummary: 'Si applica il CCNL della Ristorazione collettiva, contratto "a divisore mensile": i "GIORNI INPS" (≈26) includono le ferie godute, che vanno quindi sottratte. Giornate lavorate = GIORNI INPS − ferie; le ore si convertono in giorni con una soglia.',
    ccnlHighlights: [
      'CCNL Ristorazione collettiva',
      'Divisore mensile (i GIORNI INPS includono le ferie)',
      'GG lavorati = GIORNI INPS − ferie',
    ],
    hex: '#f97316',
    badge: {
      filter: 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300 scale-105 border-transparent',
      card: 'bg-orange-100/50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/50',
      detail: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/50',
      archive: 'bg-orange-100 text-orange-700 border-orange-200',
      pivot: 'text-orange-400 border-orange-600 bg-orange-900/30',
      pivotHeader: 'text-orange-600',
      statsBg: 'bg-orange-500',
    },
    footer: {
      wrap: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700/50',
      dot: 'bg-orange-500 dark:bg-orange-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-orange-800 dark:text-orange-300',
      count: 'text-orange-600 dark:text-orange-500',
    },
    modal: {
      color: '#f97316',
      glow: '0 0 60px -15px rgba(249, 115, 22, 0.7)',
      gradient: 'from-orange-500 via-amber-500 to-red-500',
      avatarBg: 'from-orange-500 to-red-500',
      avatarText: 'text-white',
      lightGlow: 'rgba(249, 115, 22, 0.5)',
      icon: Coffee,
    },
  },

  CLEAN_SERVICE: {
    key: 'CLEAN_SERVICE',
    label: 'CLEAN SERVICE',
    sub: 'Multiservizi',
    detailLabel: 'Clean Service',
    pec: '',
    ccnl: 'CCNL Multiservizi',
    ccnlRef: 'Multiservizi',
    ccnlSummary: 'Clean Service S.r.l. (divisione ristorazione/catering a bordo treno) applica il CCNL Multiservizi, "a divisore mensile": il "26" della retribuzione ordinaria sono i giorni RETRIBUITI del mese (lavoro + ferie godute), non i soli lavorati. Giornate effettive = giorni retribuiti − ferie.',
    ccnlHighlights: [
      'CCNL Multiservizi',
      'Divisore mensile (26 = giorni retribuiti)',
      'GG lavorati = giorni retribuiti − ferie',
    ],
    hex: '#10b981',
    badge: {
      filter: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300 scale-105 border-transparent',
      card: 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50',
      detail: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50',
      archive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pivot: 'text-emerald-400 border-emerald-600 bg-emerald-900/30',
      pivotHeader: 'text-emerald-600',
      statsBg: 'bg-emerald-500',
    },
    footer: {
      wrap: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/50',
      dot: 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-emerald-800 dark:text-emerald-300',
      count: 'text-emerald-600 dark:text-emerald-500',
    },
    modal: {
      color: '#10b981',
      glow: '0 0 60px -15px rgba(16, 185, 129, 0.7)',
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      avatarBg: 'from-emerald-500 to-teal-500',
      avatarText: 'text-white',
      lightGlow: 'rgba(16, 185, 129, 0.5)',
      icon: Sparkles,
    },
  },

  MERCITALIA: {
    key: 'MERCITALIA',
    label: 'MERCITALIA',
    sub: 'Logistica e Shunting',
    detailLabel: 'Mercitalia',
    pec: '',
    ccnl: 'CCNL Mobilità',
    ccnlRef: 'Mobilità/Ferroviari',
    ccnlSummary: 'Inquadramento nell\'area della Mobilità (gestione ADP). Sul cedolino a 7 colonne gli importi delle indennità si leggono dalla colonna "Competenze"; le giornate lavorate derivano dai "GIORNI INPS", già al netto delle ferie (cod. 3833): nessuna sottrazione.',
    ccnlHighlights: [
      'Cedolino ADP a 7 colonne',
      'Importi indennità → colonna "Competenze"',
      'GG lavorati = GIORNI INPS (ferie già escluse)',
    ],
    hex: '#d97706',
    badge: {
      filter: 'bg-amber-600 text-white shadow-lg shadow-amber-500/40 ring-2 ring-amber-400 scale-105 border-transparent',
      card: 'bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50',
      detail: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700/50',
      archive: 'bg-amber-100 text-amber-700 border-amber-200',
      pivot: 'text-amber-400 border-amber-600 bg-amber-900/30',
      pivotHeader: 'text-amber-700',
      statsBg: 'bg-amber-600',
    },
    footer: {
      wrap: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700/50',
      dot: 'bg-amber-600 dark:bg-amber-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-amber-800 dark:text-amber-300',
      count: 'text-amber-600 dark:text-amber-500',
    },
    modal: {
      color: '#d97706',
      glow: '0 0 60px -15px rgba(217, 119, 6, 0.7)',
      gradient: 'from-amber-600 via-amber-500 to-orange-700',
      avatarBg: 'from-amber-600 to-orange-700',
      avatarText: 'text-white',
      lightGlow: 'rgba(217, 119, 6, 0.5)',
      icon: Truck,
    },
  },

  // Ferrovie del Sud Est (Gruppo FS). Famiglia cromatica UI: 'teal' (verde-adiacente, già
  // cablata ovunque), per distinguersi da Clean Service (emerald) e Trenitalia (red); il verde
  // di brand vive nel logo. Vertenza ferie ex art. 7 Dir. 2003/88/CE (Williams/Lock), metodo
  // media 12 mesi delle indennità "di incomodo" (= motore ferie esistente).
  FSE: {
    key: 'FSE',
    label: 'FSE',
    sub: 'Ferrovie Sud Est',
    detailLabel: 'Ferrovie del Sud Est',
    pec: '',
    ccnl: 'CCNL Autoferrotranvieri',
    ccnlRef: 'Autoferrotranvieri/TPL',
    ccnlSummary: 'Ferrovie del Sud Est e Servizi Automobilistici S.r.l. (Gruppo FS) applica il CCNL Autoferrotranvieri. La vertenza ferie segue l\'art. 7 Dir. 2003/88/CE (CGUE Williams/Lock): le indennità "di incomodo" (turno, domenicale, presenza, trasferte…) percepite nei 12 mesi precedenti vanno incluse nella retribuzione feriale, con media giornaliera su quel periodo. Cedolino ZUCCHETTI: importi indennità dalla colonna "Competenze".',
    ccnlHighlights: [
      'CCNL Autoferrotranvieri (Gruppo FS)',
      'Ferie ex art. 7 Dir. 2003/88/CE (Williams/Lock)',
      'Indennità di incomodo su media 12 mesi',
      'Cedolino ZUCCHETTI → importi da "Competenze"',
    ],
    hex: '#0d9488',
    badge: {
      filter: 'bg-teal-600 text-white shadow-lg shadow-teal-500/40 ring-2 ring-teal-400 scale-105 border-transparent',
      card: 'bg-teal-100/50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-700/50',
      detail: 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-700/50',
      archive: 'bg-teal-100 text-teal-700 border-teal-200',
      pivot: 'text-teal-400 border-teal-600 bg-teal-900/30',
      pivotHeader: 'text-teal-700',
      statsBg: 'bg-teal-600',
    },
    footer: {
      wrap: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700/50',
      dot: 'bg-teal-600 dark:bg-teal-400 dark:shadow-[0_0_8px_currentColor]',
      name: 'text-teal-800 dark:text-teal-300',
      count: 'text-teal-600 dark:text-teal-500',
    },
    modal: {
      color: '#0d9488',
      glow: '0 0 60px -15px rgba(13, 148, 136, 0.7)',
      gradient: 'from-teal-600 via-teal-500 to-emerald-600',
      avatarBg: 'from-teal-600 to-emerald-600',
      avatarText: 'text-white',
      lightGlow: 'rgba(13, 148, 136, 0.5)',
      icon: TramFront,
    },
  },
};

// ── Helper di accesso ───────────────────────────────────────────────────────

/** Chiavi dei profili di sistema, nell'ordine di registrazione. */
export const SYSTEM_PROFILE_KEYS = Object.keys(SYSTEM_PROFILES);

/** True se la chiave è un profilo di sistema (non un'azienda custom). */
export const isSystemProfile = (key?: string | null): boolean =>
  !!key && key in SYSTEM_PROFILES;

/** Profilo di sistema o undefined (azienda custom / non riconosciuta). */
export const getSystemProfile = (key?: string | null): SystemProfile | undefined =>
  key ? SYSTEM_PROFILES[key] : undefined;

/** Icona logistica/aziendale di default per le aziende custom. */
export const DEFAULT_PROFILE_ICON: LucideIcon = Building2;

// ── Loghi aziendali (solo UI, mai nei documenti generati) ───────────────────
// File in public/logos/. Le aziende custom non hanno logo: getCompanyLogo →
// null e la UI tiene il suo fallback colorato. Per aggiungerne uno basta il
// file + una riga qui. `scale` compensa i loghi visivamente più piccoli a
// parità di altezza (la capsula Clean Service è poco densa).
// Clean Service = Clean Service S.r.l. di Mozzagrogna (CH), P.IVA 01856200694
// (verificata sull'intestazione busta Cianci), logo da cleanservicesrl.it.
// Elior: rosa fucsia = brand dell'epoca delle buste (viaggiante); il
// magazzino usa "ELIOR SERVICES" (bisonte) per distinguersi a colpo d'occhio.

const COMPANY_LOGOS: Record<string, { file: string; scale?: number }> = {
  RFI: { file: 'rfi.svg' },
  TRENITALIA: { file: 'trenitalia.svg' },
  ELIOR: { file: 'elior.png' },
  MERCITALIA: { file: 'mercitalia.svg' },
  CLEAN_SERVICE: { file: 'cleanservice.png', scale: 1.3 },
  FSE: { file: 'fse.svg' },
};

const ELIOR_MAGAZZINO_LOGO = 'elior-services.png';

/** URL del logo aziendale (per ELIOR dipende dal tipo), o null se non c'è. */
export const getCompanyLogo = (
  profilo?: string | null,
  eliorType?: 'viaggiante' | 'magazzino'
): string | null => {
  if (profilo === 'ELIOR' && eliorType === 'magazzino')
    return `${import.meta.env.BASE_URL}logos/${ELIOR_MAGAZZINO_LOGO}`;
  const entry = profilo ? COMPANY_LOGOS[profilo] : undefined;
  return entry ? `${import.meta.env.BASE_URL}logos/${entry.file}` : null;
};

/** Fattore di resa visiva del logo a parità di altezza nominale. */
export const getCompanyLogoScale = (profilo?: string | null): number =>
  (profilo && COMPANY_LOGOS[profilo]?.scale) || 1;

// ── Colore-azienda: linguaggio cromatico unico in tutta l'app ────────────────
// La famiglia Tailwind di ogni azienda (card, header dettaglio, modali, stats):
// RFI blu, Trenitalia rosso, Elior arancio, Clean Service smeraldo, Mercitalia
// ambra; custom → famiglia deterministica (stessa palette dei badge custom).

const SYSTEM_COLOR_KEY: Record<string, string> = {
  RFI: 'blue',
  TRENITALIA: 'red',
  ELIOR: 'orange',
  CLEAN_SERVICE: 'emerald',
  MERCITALIA: 'amber',
  FSE: 'teal',
};

const CUSTOM_COLOR_KEYS = ['fuchsia', 'violet', 'cyan', 'rose', 'indigo', 'teal'];

/** Famiglia cromatica Tailwind dell'azienda (es. 'blue' per RFI). */
export const getCompanyColorKey = (profilo?: string | null): string =>
  (profilo && SYSTEM_COLOR_KEY[profilo]) || CUSTOM_COLOR_KEYS[getCustomColorIndex(profilo ?? '')];

/** Coppie [start, end] dei gradienti per famiglia (avatar, bottoni, sparkline). */
export const COMPANY_GRADIENTS: Record<string, [string, string]> = {
  blue:    ['#3b82f6', '#06b6d4'],
  red:     ['#dc2626', '#f43f5e'],
  orange:  ['#f97316', '#ef4444'],
  emerald: ['#10b981', '#14b8a6'],
  amber:   ['#d97706', '#f59e0b'],
  fuchsia: ['#d946ef', '#a855f7'],
  violet:  ['#8b5cf6', '#d946ef'],
  cyan:    ['#06b6d4', '#3b82f6'],
  rose:    ['#f43f5e', '#fb923c'],
  indigo:  ['#6366f1', '#8b5cf6'],
  teal:    ['#14b8a6', '#06b6d4'],
};

/** Gradiente [start, end] dell'azienda. */
export const getCompanyGradient = (profilo?: string | null): [string, string] =>
  COMPANY_GRADIENTS[getCompanyColorKey(profilo)];

/** Hex identificativo dell'azienda (sistema → hex canonico; custom → start del gradiente). */
export const getCompanyHex = (profilo?: string | null): string =>
  (profilo && SYSTEM_PROFILES[profilo]?.hex) || getCompanyGradient(profilo)[0];
