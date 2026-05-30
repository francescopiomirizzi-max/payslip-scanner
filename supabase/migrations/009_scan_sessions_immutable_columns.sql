-- Migration 009: trigger BEFORE UPDATE che blocca cambi a colonne immutabili di
-- scan_sessions.
--
-- La policy scan_sessions_update_any (migration 008) permette al mobile (anon) di
-- aggiornare la sessione purché non scaduta, perché serve a scrivere
-- status/data/mode dal telefono. Postgres non offre RLS column-level: senza questo
-- trigger un attaccante che sniffi il QR potrebbe reset-are owner_id (rubare la
-- sessione) o expires_at (estendere il TTL all'infinito). Lo blocchiamo a monte.

CREATE OR REPLACE FUNCTION public.scan_sessions_block_immutable_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'scan_sessions.id is immutable';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'scan_sessions.owner_id is immutable';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'scan_sessions.created_at is immutable';
    END IF;
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'scan_sessions.expires_at is immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_sessions_block_immutable_trg ON public.scan_sessions;
CREATE TRIGGER scan_sessions_block_immutable_trg
    BEFORE UPDATE ON public.scan_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.scan_sessions_block_immutable_changes();
