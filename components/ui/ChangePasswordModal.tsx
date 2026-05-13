import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useIsland } from '../../IslandContext';
import { supabase } from '../../supabaseClient';

export const ChangePasswordModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const { showNotification } = useIsland();

    const handleSave = async () => {
        if (newPass.length < 8) {
            setError("La password deve avere almeno 8 caratteri.");
            return;
        }
        if (newPass !== confirmPass) {
            setError("Le password non coincidono.");
            return;
        }
        setIsSaving(true);
        const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
        setIsSaving(false);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        showNotification("Sicurezza", "Password aggiornata con successo!", "success", 5000);
        setNewPass('');
        setConfirmPass('');
        onClose();
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" /> Cambia Password
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nuova Password</label>
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-all" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Conferma Password</label>
                        <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-all" />
                    </div>
                </div>
                {error && <p className="text-red-500 dark:text-red-400 text-xs font-bold mt-3 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-800/50">{error}</p>}
                <div className="flex gap-3 justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Annulla</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSaving ? 'Salvataggio...' : 'Salva'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};
