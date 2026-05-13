import React, { useState, useEffect, useCallback } from 'react';
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

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsAuthenticated(!!session);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session);
            if (event === 'SIGNED_IN') {
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
