import { useState, useCallback } from 'react';

// Tiene la barra del browser (meta theme-color) allineata al tema attivo;
// il valore iniziale lo imposta lo script inline in index.html.
const syncThemeColor = (dark: boolean) => {
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0f172a' : '#4f46e5');
};

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
            syncThemeColor(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDarkMode(true);
            syncThemeColor(true);
        }
    }, [isDarkMode]);

    return { isDarkMode, toggleTheme };
};
