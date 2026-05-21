import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
  /** Contenuto del pannello flottante. Se assente/falsy il tooltip non compare. */
  content: ReactNode;
  /** Elemento trigger su cui si attiva l'hover. */
  children: ReactNode;
  /** Classi Tailwind del pannello flottante (larghezza, padding, colori…). */
  panelClassName?: string;
  /** Ritardo in ms prima di mostrare il tooltip. */
  delay?: number;
  /** Se true il tooltip non viene mai mostrato. */
  disabled?: boolean;
  /** Classi extra per lo <span> wrapper inline del trigger. */
  wrapperClassName?: string;
  /**
   * Se true il pannello è cliccabile e resta aperto mentre ci si passa sopra
   * (popover interattivo). Un breve ritardo di chiusura "fa da ponte" sul gap
   * tra trigger e pannello, così è raggiungibile col mouse.
   */
  interactive?: boolean;
}

const GAP = 8;
// Ritardo di chiusura: dà il tempo di attraversare il gap trigger→pannello.
const CLOSE_DELAY = 150;

/**
 * Tooltip / popover renderizzato in un portale su `document.body` con
 * `position: fixed`.
 *
 * Risolve alla radice il problema dei tooltip `absolute` annidati dentro celle
 * `sticky`/`overflow` di una tabella: lo z-index lì è confinato in uno stacking
 * context isolato e il contenuto viene ritagliato. Vivendo su `document.body`
 * il pannello è sempre sopra ogni elemento e mai clippato.
 *
 * Con `interactive` diventa un popover cliccabile che resta aperto finché il
 * mouse è sul trigger OPPURE sul pannello.
 */
export const PortalTooltip: React.FC<PortalTooltipProps> = ({
  content,
  children,
  panelClassName = '',
  delay = 180,
  disabled = false,
  wrapperClassName = '',
  interactive = false,
}) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const clearOpenTimer = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };
  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const close = useCallback(() => {
    clearOpenTimer();
    setAnchor(null);
    setPos(null);
  }, []);

  // Mostra il pannello (con ritardo). Annulla un'eventuale chiusura pendente.
  const open = useCallback(() => {
    if (disabled || !content) return;
    clearCloseTimer();
    if (anchor || openTimer.current) return; // già aperto o in apertura
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      const el = triggerRef.current;
      if (el) setAnchor(el.getBoundingClientRect());
    }, delay);
  }, [disabled, content, delay, anchor]);

  // Chiude: subito per i tooltip display-only, con ritardo se interattivo.
  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    if (!interactive) {
      close();
      return;
    }
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      close();
    }, CLOSE_DELAY);
  }, [interactive, close]);

  useEffect(() => () => {
    clearOpenTimer();
    clearCloseTimer();
  }, []);

  // Posiziona il pannello una volta montato, prima del paint (niente flash).
  useLayoutEffect(() => {
    if (!anchor || !panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: a destra del trigger; ribalta a sinistra se sfora il viewport.
    let left = anchor.right + GAP;
    if (left + panel.width > vw - GAP) {
      left = anchor.left - panel.width - GAP;
    }
    left = Math.max(GAP, Math.min(left, vw - panel.width - GAP));

    // Allinea in alto al trigger, mantenendolo dentro il viewport.
    const top = Math.max(GAP, Math.min(anchor.top, vh - panel.height - GAP));

    setPos({ top, left });
  }, [anchor]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${wrapperClassName}`}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
      >
        {children}
      </span>
      {anchor && content && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className={`fixed z-[99999] ${interactive ? '' : 'pointer-events-none'} ${panelClassName}`}
          style={{
            top: pos ? pos.top : anchor.top,
            left: pos ? pos.left : anchor.right + GAP,
            // Nascosto finché useLayoutEffect non ha calcolato la posizione.
            visibility: pos ? 'visible' : 'hidden',
          }}
          onMouseEnter={interactive ? clearCloseTimer : undefined}
          onMouseLeave={interactive ? scheduleClose : undefined}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
};
