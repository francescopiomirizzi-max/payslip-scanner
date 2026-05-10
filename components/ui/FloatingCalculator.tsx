import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, X } from 'lucide-react';

// --- COMPONENTE CALCOLATRICE FLUTTUANTE (Spostabile e con Fix Tastiera) ---
export const FloatingCalculator = ({ onClose }: { onClose: () => void }) => {
    const [display, setDisplay] = useState('');

    const handleBtn = (val: string) => setDisplay(prev => prev + val);
    const handleClear = () => setDisplay('');

    const handleEqual = () => {
        if (!display) return;
        try {
            // Parser matematico sicuro per prevenire RCE/XSS
            const sanitized = display.replace(/,/g, '.').replace(/[^0-9+\-*/.]/g, '');
            if (!sanitized) {
                setDisplay('');
                return;
            }
            // Essendo limitato ai soli caratteri matematici, il costruttore Function è blindato
            const result = new Function('return ' + sanitized)();
            setDisplay(result !== undefined && !isNaN(result) ? String(result) : '');
        } catch {
            setDisplay('Errore');
            setTimeout(() => setDisplay(''), 1000);
        }
    };

    // Listener Tastiera
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;

            // Cattura l'invio e blocca l'evento per non far cliccare bottoni in background
            if (key === 'Enter' || key === '=') {
                e.preventDefault();
                e.stopPropagation();
                handleEqual();
                return;
            }

            // Accetta numeri e operatori
            if (/[0-9+\-*/.,]/.test(key)) {
                e.preventDefault();
                handleBtn(key);
                return;
            }

            if (key === 'Backspace') setDisplay(prev => prev.slice(0, -1));
            if (key === 'Escape') onClose();
            if (key === 'Delete' || key.toLowerCase() === 'c') handleClear();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [display, onClose]);

    const btns = [
        { L: '7', v: '7' }, { L: '8', v: '8' }, { L: '9', v: '9' }, { L: '/', v: '/', c: 'text-indigo-500' },
        { L: '4', v: '4' }, { L: '5', v: '5' }, { L: '6', v: '6' }, { L: '*', v: '*', c: 'text-indigo-500' },
        { L: '1', v: '1' }, { L: '2', v: '2' }, { L: '3', v: '3' }, { L: '-', v: '-', c: 'text-indigo-500' },
        { L: 'C', v: 'C', f: handleClear, c: 'text-red-500' }, { L: '0', v: '0' }, { L: '=', v: '=', f: handleEqual, bg: 'bg-indigo-500 text-white hover:bg-indigo-600' }, { L: '+', v: '+', c: 'text-indigo-500' },
    ];

    return (
        <motion.div
            drag
            dragMomentum={false}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed bottom-24 right-8 z-[100] w-72 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden"
        >
            {/* HEADER con cursore move per trascinare */}
            <div className="p-4 bg-indigo-50/50 flex justify-between items-center border-b border-indigo-100 cursor-move">
                <span className="font-bold text-indigo-900 flex items-center gap-2 pointer-events-none">
                    <Calculator className="w-4 h-4" /> Calc
                </span>
                {/* Stop propagation sulla X per non innescare il drag */}
                <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="p-1 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-6 bg-slate-50 text-right text-3xl font-mono text-slate-700 font-bold tracking-widest overflow-hidden border-b border-slate-100 h-20 flex items-center justify-end">
                {display || '0'}
            </div>

            <div className="grid grid-cols-4 gap-2 p-4 bg-white/50">
                {btns.map((b, i) => (
                    <button key={i} onClick={() => b.f ? b.f() : handleBtn(b.v)}
                        className={`h-12 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center shadow-sm ${b.bg ? b.bg : 'bg-white hover:bg-indigo-50 text-slate-600'} ${b.c || ''}`}>
                        {b.L}
                    </button>
                ))}
            </div>
        </motion.div>
    );
};
