import React, { useState, useEffect, useCallback } from 'react';
import { useIsland } from '../IslandContext';
import { getFormattedDate, getFormattedTime } from '../utils/formatters';

/**
 * Hook per gestire autenticazione, login/logout e notifica di benvenuto.
 * Riceve setViewMode come callback per resettare la vista al logout.
 */
export const useAuth = (setViewMode: (mode: 'home' | 'simple' | 'complex' | 'stats') => void) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('is_logged_in') === 'true';
    });

    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState(false);

    const { showNotification } = useIsland();

    // Effetto saluto iniziale
    useEffect(() => {
        if (isAuthenticated) {
            const now = new Date();
            const dataFormattata = getFormattedDate(now);
            const oraFormattata = getFormattedTime(now);

            setTimeout(() => {
                showNotification(
                    `Bentornato!`,
                    `Oggi è ${dataFormattata} • Ore ${oraFormattata}`,
                    'info',
                    5000
                );
            }, 1000);
        }
    }, [isAuthenticated, showNotification]);

    const handleLogin = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const storedPassword = localStorage.getItem('app_password') || 'admin123';
        if (loginPassword === storedPassword) {
            setIsAuthenticated(true);
            localStorage.setItem('is_logged_in', 'true');
            setLoginError(false);
        } else {
            setLoginError(true);
            setTimeout(() => setLoginError(false), 2000);
        }
    }, [loginPassword]);

    const handleLogout = useCallback(() => {
        setIsAuthenticated(false);
        localStorage.removeItem('is_logged_in');
        setViewMode('home');
    }, [setViewMode]);

    return {
        isAuthenticated,
        loginPassword,
        setLoginPassword,
        loginError,
        handleLogin,
        handleLogout,
    };
};
