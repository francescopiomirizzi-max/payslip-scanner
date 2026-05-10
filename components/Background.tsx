import React from 'react';

const Background: React.FC = () => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-[#020617] transition-colors duration-500">
            {/* Definizione Animazione Custom "Wide Move" per garantire il movimento visibile */}
            {/* Animazioni wide-float centralizzate in index.css */}

            {/* --- LE CORRENTI (Colori: Blu Royal, Ciano Elettrico, Verde Acqua) --- */}

            {/* 1. La Corrente Profonda (Blu) - Si muove lenta */}
            <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-blue-600/50 dark:bg-blue-800/40 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-wide-float filter saturate-200"></div>

            {/* 2. La Corrente Luminosa (Ciano) - Si muove veloce e opposta */}
            <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] rounded-full bg-cyan-400/50 dark:bg-cyan-700/40 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-wide-float-fast filter saturate-200"></div>

            {/* 3. Il Cuore (Smeraldo/Teal) - Ruota al centro */}
            <div className="absolute top-[30%] left-[30%] w-[50vw] h-[50vw] rounded-full bg-emerald-400/40 dark:bg-teal-600/30 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-wide-float-slow filter saturate-200"></div>


            {/* --- STRATI DI FINITURA (Modificati per mostrare il movimento) --- */}

            {/* VETRO PIÙ SOTTILE: Blur sceso a 50px (era 90) e Bianco sceso al 40% (era 60) */}
            {/* Questo permette di vedere le forme muoversi distintamente sotto */}
            <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/50 backdrop-blur-[50px]"></div>

            {/* TEXTURE CARTA (Mantiene l'aspetto professionale) */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
            </div>

            {/* 3. VIGNETTATURA (Scurisce i bordi per concentrare la vista al centro) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)]"></div>
        </div>
    );
};

export default Background;
