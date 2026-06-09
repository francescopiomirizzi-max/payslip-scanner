import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ToastData {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    action?: ToastAction;
}

// --- COMPONENTE TOAST NOTIFICATION ---
export const Toast = ({ message, type, onClose, action }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void; action?: ToastAction }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />
    };

    const colors = {
        success: 'border-emerald-500/50 bg-emerald-50/90 text-emerald-900',
        error: 'border-red-500/50 bg-red-50/90 text-red-900',
        info: 'border-blue-500/50 bg-blue-50/90 text-blue-900'
    };

    const actionStyles = {
        success: 'text-emerald-700 hover:bg-emerald-100/80 border-emerald-300',
        error: 'text-red-700 hover:bg-red-100/80 border-red-300',
        info: 'text-blue-700 hover:bg-blue-100/80 border-blue-300'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -40, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md mb-3 ${colors[type]}`}
        >
            {icons[type]}
            <span className="font-bold text-sm pr-2">{message}</span>
            {action && (
                <button
                    onClick={() => { action.onClick(); onClose(); }}
                    className={`shrink-0 px-3 py-1 rounded-lg border font-black text-[11px] uppercase tracking-widest transition-colors ${actionStyles[type]}`}
                >
                    {action.label}
                </button>
            )}
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
        </motion.div>
    );
};
