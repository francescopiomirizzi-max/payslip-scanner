import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIsland } from '../IslandContext';
import { getFormattedDate, getFormattedTime } from '../utils/formatters';
import { supabase } from '../supabaseClient';

export const useAuth = (setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats') => void) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState(false);

    const { showNotification } = useIsland();

    // Supabase ri-emette `SIGNED_IN` a ogni rientro di focus sulla scheda: ci serve
    // sapere se l'utente era GIÀ autenticato per distinguere un login vero da un re-emit.
    const wasAuthenticatedRef = useRef(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            wasAuthenticatedRef.current = !!session;
            setIsAuthenticated(!!session);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const nowAuthenticated = !!session;
            setIsAuthenticated(nowAuthenticated);

            // "Bentornato!" SOLO su un login vero (transizione non-autenticato → autenticato).
            // Supabase ri-emette `SIGNED_IN` anche quando la scheda riprende il focus: in quei
            // casi l'utente è già autenticato → niente notifica, così non viene rubata la
            // Live Activity di un upload in corso.
            if (event === 'SIGNED_IN' && nowAuthenticated && !wasAuthenticatedRef.current) {
                const now = new Date();
                setTimeout(() => {
                    showNotification(
                        'Bentornato!',
                        `Oggi è ${getFormattedDate(now)} • Ore ${getFormattedTime(now)}`,
                        'info',
                        5000
                    );
                }, 1000);
            }
            wasAuthenticatedRef.current = nowAuthenticated;
        });

        return () => subscription.unsubscribe();
    }, [showNotification]);

    const handleLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
        });
        if (error) {
            setLoginError(true);
            setTimeout(() => setLoginError(false), 2000);
        }
    }, [loginEmail, loginPassword]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        setViewMode('home');
    }, [setViewMode]);

    return {
        isAuthenticated,
        isLoading,
        loginEmail,
        setLoginEmail,
        loginPassword,
        setLoginPassword,
        loginError,
        handleLogin,
        handleLogout,
    };
};
