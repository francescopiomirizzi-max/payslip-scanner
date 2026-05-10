import { useState, useCallback } from 'react';

/**
 * Hook per gestire il toggle del tema scuro.
 * Legge lo stato iniziale dal DOM e persiste la preferenza in localStorage.
 */
export const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return document.documentElement.classList.contains('dark');
    });

    const toggleTheme = useCallback(() => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDarkMode(true);
        }
    }, [isDarkMode]);

    return { isDarkMode, toggleTheme };
};
