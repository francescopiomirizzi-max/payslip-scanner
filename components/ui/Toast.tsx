import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastData {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

// --- COMPONENTE TOAST NOTIFICATION ---
export const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
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

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md mb-3 ${colors[type]}`}
        >
            {icons[type]}
            <span className="font-bold text-sm pr-2">{message}</span>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
        </motion.div>
    );
};
