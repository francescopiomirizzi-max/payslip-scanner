/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // --- 1. CLASSI PER TITOLI E GRADIENTI ---
    'bg-gradient-to-r',
    'bg-gradient-to-br', // Aggiunto per le card nuove
    'bg-gradient-to-b',
    'from-blue-600', 'via-indigo-500', 'to-violet-500',
    'dark:from-blue-400', 'dark:via-indigo-400', 'dark:to-violet-400',
    'text-transparent',
    'bg-clip-text',

    // --- 2. COLORI DEI TEMI (Indigo, Emerald, Orange, Blue, Slate, Yellow/Amber) ---

    // INDIGO
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-500', 'bg-indigo-600',
    'text-indigo-300', 'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700',
    'border-indigo-100', 'border-indigo-200', 'border-indigo-300', 'border-indigo-400', 'border-indigo-500', 'border-indigo-500/30',
    'from-indigo-400', 'from-indigo-500', 'from-indigo-600',
    'to-indigo-500', 'to-indigo-600',
    'shadow-indigo-500/30', 'shadow-indigo-500/40', 'shadow-indigo-500/50',
    'hover:border-indigo-400', 'hover:text-indigo-600', 'group-hover:text-indigo-600',

    // EMERALD (Rekeep / Success)
    'bg-emerald-50', 'bg-emerald-100', 'bg-emerald-500', 'bg-emerald-600',
    'text-emerald-400', 'text-emerald-500', 'text-emerald-600', 'text-emerald-700',
    'border-emerald-100', 'border-emerald-200', 'border-emerald-300', 'border-emerald-400', 'border-emerald-500',
    'from-emerald-400', 'from-emerald-500', 'from-emerald-600',
    'to-emerald-500', 'to-emerald-600',
    'to-teal-500', 'to-teal-400', 'to-teal-600',
    'shadow-emerald-500/30', 'shadow-emerald-500/40', 'shadow-emerald-500/50',
    'hover:border-emerald-400', 'hover:text-emerald-600', 'group-hover:text-emerald-600',

    // ORANGE (Elior)
    'bg-orange-50', 'bg-orange-100', 'bg-orange-500', 'bg-orange-600',
    'text-orange-400', 'text-orange-500', 'text-orange-600', 'text-orange-700',
    'border-orange-100', 'border-orange-200', 'border-orange-300', 'border-orange-400', 'border-orange-500',
    'from-orange-400', 'from-orange-500', 'from-orange-600',
    'to-orange-500', 'to-orange-600',
    'to-red-500', 'to-red-600',
    'shadow-orange-500/30', 'shadow-orange-500/40', 'shadow-orange-500/50',
    'hover:border-orange-400', 'hover:text-orange-600', 'group-hover:text-orange-600',

    // BLUE (RFI / Default)
    'bg-blue-50', 'bg-blue-100', 'bg-blue-500', 'bg-blue-600',
    'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700',
    'border-blue-100', 'border-blue-200', 'border-blue-300', 'border-blue-400', 'border-blue-500',
    'from-blue-400', 'from-blue-500', 'from-blue-600',
    'to-blue-500', 'to-blue-600',
    'to-cyan-500', 'to-cyan-600', 'to-indigo-600',
    'shadow-blue-500/30', 'shadow-blue-500/40', 'shadow-blue-500/50',
    'hover:border-blue-400', 'hover:text-blue-600', 'group-hover:text-blue-600',

    // YELLOW/AMBER (Gold Card)
    'bg-yellow-500/10', 'bg-amber-500/10', 'bg-amber-500/20',
    'text-yellow-300', 'text-amber-400',
    'border-yellow-500/30', 'border-amber-500/20',
    'from-yellow-200', 'to-yellow-500', 'from-yellow-300', 'via-yellow-500', 'to-yellow-700',

    // SLATE (Neutral)
    'bg-slate-50', 'bg-slate-100', 'bg-slate-800', 'bg-slate-900',
    'text-slate-300', 'text-slate-400', 'text-slate-500',
    'from-slate-700', 'to-slate-800',

    // VIOLET / FUCHSIA
    'to-violet-500', 'to-violet-600',
    'from-violet-500', 'from-violet-600',
    'to-fuchsia-500', 'to-fuchsia-600',

    // --- 3. CLASSI VETRO & STRUTTURA ---
    'bg-white/5', 'bg-white/10', 'bg-white/20', 'bg-white/30', 'bg-white/40', 'bg-white/50',
    'bg-white/60', 'bg-white/70', 'bg-white/80', 'bg-white/90', 'bg-white/95',
    'backdrop-blur-sm', 'backdrop-blur-md', 'backdrop-blur-xl', 'backdrop-blur-2xl', 'backdrop-blur-3xl',
    'shadow-xl', 'shadow-2xl', 'mix-blend-multiply', 'mix-blend-overlay',

    // --- 4. OPACITÀ SPECIFICHE ---
    'bg-indigo-50/50', 'bg-emerald-50/50', 'bg-orange-50/50', 'bg-blue-50/50',
    'bg-indigo-50/90', 'bg-emerald-50/90', 'bg-orange-50/90', 'bg-blue-50/90',
    'via-white/80', 'via-white/30', 'via-white/50'
  ],
  theme: {
    extend: {
      animation: {
        blob: "blob 7s infinite",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        }
      },
    },
  },
  plugins: [],
}