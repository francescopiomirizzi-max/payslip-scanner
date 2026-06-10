import { useRef, useCallback } from 'react';

/**
 * Glow che segue il cursore (effetto Linear/Vision Pro): aggiorna le CSS custom
 * properties --mx/--my/--glow-o sul container via rAF, senza re-render React.
 * Il layer visivo è un radial-gradient che legge quelle variabili.
 */
export function useMouseGlow<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const frame = useRef(0);

    const onMouseMove = useCallback((e: React.MouseEvent<T>) => {
        const el = ref.current;
        if (!el || frame.current) return;
        const { clientX, clientY } = e;
        frame.current = requestAnimationFrame(() => {
            frame.current = 0;
            const node = ref.current;
            if (!node) return;
            const r = node.getBoundingClientRect();
            node.style.setProperty('--mx', `${clientX - r.left}px`);
            node.style.setProperty('--my', `${clientY - r.top}px`);
            node.style.setProperty('--glow-o', '1');
        });
    }, []);

    const onMouseLeave = useCallback(() => {
        ref.current?.style.setProperty('--glow-o', '0');
    }, []);

    return { ref, onMouseMove, onMouseLeave };
}
