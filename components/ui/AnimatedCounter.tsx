import React, { useRef, useEffect } from 'react';
import { useSpring, useMotionValue } from 'framer-motion';

// --- COMPONENTE ANIMAZIONE NUMERI (CORRETTO CON DECIMALI) ---
export const AnimatedCounter = ({ value, isCurrency = false }: { value: number, isCurrency?: boolean }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { damping: 30, stiffness: 100 });

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        return springValue.on("change", (latest) => {
            if (ref.current) {
                ref.current.textContent = isCurrency
                    ? latest.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Math.round(latest).toString();
            }
        });
    }, [springValue, isCurrency]);

    return <span ref={ref} />;
};
