import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedLogoProps {
    /** Sorgente del logo (default: simbolo Valora nudo). Usata anche come maschera dello sheen. */
    src?: string;
    alt?: string;
    /** Classi dell'<img>: dimensione + filtro neon + gestione dark (es. "neon-vo h-11 ... dark:brightness-0 dark:invert"). */
    imgClassName: string;
    /** Classi extra sul wrapper (margini, flex del contenitore ospite). */
    className?: string;
    /** Ritardo del reveal d'ingresso, in secondi. */
    delay?: number;
    /** Sheen periodico che scorre sulla forma del logo. */
    sheen?: boolean;
}

/**
 * Logo "vivo" senza video: al montaggio si accende (fade + scala che assesta, il neon compare
 * con la dissolvenza), poi ogni tanto una luce lo attraversa (sheen mascherato sulla silhouette).
 * Vettoriale/CSS: leggero, nitido, ritoccabile — e rispetta prefers-reduced-motion.
 */
export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
    src = '/logo.png',
    alt = 'Logo Valora',
    imgClassName,
    className = '',
    delay = 0,
    sheen = true,
}) => {
    const mask: React.CSSProperties = {
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
    };
    return (
        <motion.span
            className={`relative inline-flex ${className}`}
            initial={{ opacity: 0, scale: 0.86, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            <img src={src} alt={alt} className={imgClassName} draggable={false} />
            {sheen && (
                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
                    <span className="logo-sheen-band" />
                </span>
            )}
        </motion.span>
    );
};

export default AnimatedLogo;
