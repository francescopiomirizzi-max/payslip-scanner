-- 025 — Toggle per-pratica della TEMPESTIVITÀ del riposo settimanale (art. 8 §6
-- Reg. 561/2006, prima frase): quando attivo, il motore computa il riposo
-- settimanale iniziato oltre sei periodi di 24h dal precedente come violazione
-- con le 45 ore INTERE (criterio del documento sorgente, chiarito da Vincenzo
-- l'11/07). Default FALSE = esclusione prudenziale, dichiarata con riserva nei
-- documenti: la scelta di quantificazione spetta al legale.
ALTER TABLE public.pratiche_riposi
    ADD COLUMN IF NOT EXISTS tempestivita_settimanale boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pratiche_riposi.tempestivita_settimanale IS
    'true = il motore conta la violazione di tempestività del settimanale (45h piene oltre il termine di 144h); false = esclusione prudenziale (riserva nei documenti)';
