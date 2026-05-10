import React from 'react';
import { motion } from 'framer-motion';
import { Lock, LogIn } from 'lucide-react';

interface LoginPageProps {
    loginPassword: string;
    setLoginPassword: (password: string) => void;
    loginError: boolean;
    handleLogin: (e: React.FormEvent) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ loginPassword, setLoginPassword, loginError, handleLogin }) => {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-slate-900">
            <div className="absolute inset-0 z-0 bg-slate-900">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-50"
                >
                    <source src="/login.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/30"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-slate-900/40 backdrop-blur-2xl border border-white/[0.08] ring-1 ring-white/[0.05] p-10 rounded-[2.5rem] shadow-[0_8px_64px_rgba(0,0,0,0.5)] w-full max-w-md relative z-10 mx-4"
            >
                <div className="flex justify-center mb-8">
                    <div className="w-24 h-24 bg-linear-to-tr from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-cyan-500/30 border border-white/10">
                        <Lock className="w-10 h-10 text-white" strokeWidth={2.5} />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-4xl font-black tracking-tight mb-3 select-none">
                        <span className="text-white">Rail</span>
                        <span className="bg-linear-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                            Flow
                        </span>
                    </h2>
                    <p className="text-slate-400/80 text-sm font-medium tracking-wide">Inserisci le credenziali per accedere al sistema.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="relative group">
                        <input
                            type="password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Password di Sicurezza"
                            className={`w-full bg-black/30 border ${loginError ? 'border-red-500' : 'border-white/[0.08] group-hover:border-cyan-500/30'} rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold tracking-widest text-center`}
                        />
                    </div>

                    {loginError && (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-bold text-center bg-red-900/30 py-2 rounded-lg border border-red-500/30">
                            ⛔ Password errata. Accesso negato.
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide text-sm"
                    >
                        <LogIn className="w-5 h-5" /> Entra nel Sistema
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-500/50 uppercase tracking-[0.3em] font-bold select-none">RailFlow v2.0 • Sistema Protetto</p>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
