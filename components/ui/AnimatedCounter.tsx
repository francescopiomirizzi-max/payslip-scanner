import React, { useRef, useEffect } from 'react';
import { useSpring, useMotionValue } from 'framer-motion';
import { groupThousandsIT } from '../../utils/formatters';

// --- COMPONENTE ANIMAZIONE NUMERI (CORRETTO CON DECIMALI) ---
export const AnimatedCounter = ({ value, isCurrency = false, fractionDigits = 2 }: { value: number, isCurrency?: boolean, fractionDigits?: number }) => {
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
                    ? groupThousandsIT(latest.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }))
                    : Math.round(latest).toString();
            }
        });
    }, [springValue, isCurrency, fractionDigits]);

    return <span ref={ref} />;
};
