import React from 'react';

const HiddenClasses = () => {
    return (
        <div className="hidden pointer-events-none opacity-0 fixed">
            {/* QUESTO È UN TRUCCO PER LA BUILD:
        Scrivendo le classi per intero qui, Tailwind non le cancellerà mai.
      */}

            {/* --- 1. TITOLO "GESTIONE INDENNITÀ" --- */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 text-transparent bg-clip-text"></div>
            <div className="dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400"></div>

            {/* --- 2. TEMI COLORI (Indigo, Emerald, Orange, Blue) --- */}
            {/* INDIGO */}
            <div className="bg-indigo-50 bg-indigo-100 bg-indigo-500 bg-indigo-600"></div>
            <div className="text-indigo-500 text-indigo-600 text-indigo-700"></div>
            <div className="border-indigo-100 border-indigo-200 border-indigo-300 border-indigo-400 border-indigo-500"></div>
            <div className="from-indigo-400 from-indigo-500 from-indigo-600"></div>
            <div className="to-indigo-500 to-indigo-600"></div>
            <div className="shadow-indigo-500/50 hover:border-indigo-400 group-hover:text-indigo-600"></div>

            {/* EMERALD (Rekeep) */}
            <div className="bg-emerald-50 bg-emerald-100 bg-emerald-500 bg-emerald-600"></div>
            <div className="text-emerald-500 text-emerald-600 text-emerald-700"></div>
            <div className="border-emerald-100 border-emerald-200 border-emerald-300 border-emerald-400 border-emerald-500"></div>
            <div className="from-emerald-400 from-emerald-500 from-emerald-600"></div>
            <div className="to-emerald-500 to-emerald-600 to-teal-500 to-teal-600"></div>
            <div className="shadow-emerald-500/50 hover:border-emerald-400 group-hover:text-emerald-600"></div>

            {/* ORANGE (Elior) */}
            <div className="bg-orange-50 bg-orange-100 bg-orange-500 bg-orange-600"></div>
            <div className="text-orange-500 text-orange-600 text-orange-700"></div>
            <div className="border-orange-100 border-orange-200 border-orange-300 border-orange-400 border-orange-500"></div>
            <div className="from-orange-400 from-orange-500 from-orange-600"></div>
            <div className="to-orange-500 to-orange-600 to-red-500 to-red-600"></div>
            <div className="shadow-orange-500/50 hover:border-orange-400 group-hover:text-orange-600"></div>

            {/* BLUE (Standard) */}
            <div className="bg-blue-50 bg-blue-100 bg-blue-500 bg-blue-600"></div>
            <div className="text-blue-500 text-blue-600 text-blue-700"></div>
            <div className="border-blue-100 border-blue-200 border-blue-300 border-blue-400 border-blue-500"></div>
            <div className="from-blue-400 from-blue-500 from-blue-600"></div>
            <div className="to-blue-500 to-blue-600 to-cyan-500 to-cyan-600"></div>
            <div className="shadow-blue-500/50 hover:border-blue-400 group-hover:text-blue-600"></div>

            {/* --- 3. VARIANTI SPECIFICHE BOTTONI E CARD --- */}
            <div className="to-violet-500 to-violet-600 from-violet-500"></div>
            <div className="to-fuchsia-500 from-fuchsia-500"></div>

            {/* --- 4. OPACITÀ E VETRO (Cruciali per il retro card) --- */}
            <div className="bg-white/10 bg-white/20 bg-white/30 bg-white/40 bg-white/50 bg-white/60 bg-white/70 bg-white/80 bg-white/90"></div>
            <div className="bg-indigo-50/50 bg-emerald-50/50 bg-orange-50/50 bg-blue-50/50"></div>
            <div className="bg-indigo-50/90 bg-emerald-50/90 bg-orange-50/90 bg-blue-50/90"></div>
            <div className="backdrop-blur-md backdrop-blur-xl backdrop-blur-2xl backdrop-blur-3xl mix-blend-multiply"></div>
            <div className="via-white/80"></div>

            {/* --- 5. OMBRE E GLOW --- */}
            <div className="shadow-[0_0_8px_currentColor]"></div>
            <div className="shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]"></div>
        </div>
    );
};

export default HiddenClasses;