import React, { useState, useEffect } from 'react';
import { motion, useAnimate } from 'framer-motion';
import { Lock, LogIn, Mail } from 'lucide-react';
import { AnimatedLogo } from '../components/ui/AnimatedLogo';

interface LoginPageProps {
    loginEmail: string;
    setLoginEmail: (email: string) => void;
    loginPassword: string;
    setLoginPassword: (password: string) => void;
    loginError: boolean;
    handleLogin: (e: React.FormEvent) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ loginEmail, setLoginEmail, loginPassword, setLoginPassword, loginError, handleLogin }) => {
    const [formScope, animateForm] = useAnimate();
    const [btnError, setBtnError] = useState(false);

    useEffect(() => {
        if (!loginError) return;
        animateForm(formScope.current, { x: [0, -14, 14, -14, 14, -7, 7, 0] }, { duration: 0.5 });
        setBtnError(true);
        const t = setTimeout(() => setBtnError(false), 1500);
        return () => clearTimeout(t);
    }, [loginError]);

    return (
        <div className="min-h-dvh flex items-center justify-center relative overflow-hidden font-sans bg-slate-900">
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
                {/* Logo Valora nudo con neon di contorno; login sempre scuro → simbolo in bianco.
                    Si accende dopo la card e ogni tanto una luce lo attraversa (sheen). */}
                <div className="flex justify-center mb-8">
                    <AnimatedLogo imgClassName="neon-vo-white h-20 w-auto object-contain select-none" delay={0.35} />
                </div>

                <div className="text-center mb-8">
                    <h2 className="neon-text text-[2.7rem] font-black tracking-tight mb-3 select-none bg-linear-to-r from-white via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                        ValOra
                    </h2>
                    <p className="text-slate-400/80 text-sm font-medium tracking-wide">Inserisci le credenziali per accedere al sistema.</p>
                </div>

                <div ref={formScope}>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-teal-300 transition-colors" />
                        <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="Indirizzo Email"
                            autoComplete="email"
                            className={`w-full bg-black/30 border ${loginError ? 'border-red-500' : 'border-white/[0.08] group-hover:border-teal-500/30'} rounded-2xl pl-11 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/50 transition-all`}
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-teal-300 transition-colors" />
                        <input
                            type="password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Password"
                            autoComplete="current-password"
                            className={`w-full bg-black/30 border ${loginError ? 'border-red-500' : 'border-white/[0.08] group-hover:border-teal-500/30'} rounded-2xl pl-11 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold tracking-widest`}
                        />
                    </div>

                    {loginError && (
                        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-bold text-center bg-red-900/30 py-2 rounded-lg border border-red-500/30">
                            Credenziali non valide. Accesso negato.
                        </motion.p>
                    )}

                    <motion.button
                        type="submit"
                        animate={btnError ? { backgroundColor: ['#dc2626', '#dc2626'] } : {}}
                        className={`w-full text-white font-black py-4 rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide text-sm mt-2 ${
                            btnError
                                ? 'bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)]'
                                : 'bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_30px_rgba(0,163,136,0.3)] hover:shadow-[0_0_40px_rgba(0,163,136,0.5)]'
                        }`}
                    >
                        <LogIn className="w-5 h-5" /> {btnError ? 'Credenziali errate' : 'Entra nel Sistema'}
                    </motion.button>
                </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-500/50 uppercase tracking-[0.3em] font-bold select-none">Valora v2.0 • Sistema Protetto</p>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
