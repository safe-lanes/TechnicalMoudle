-- Migration: Allow sync apply paths to bypass updated_at auto-stamp trigger
-- Purpose: The set_updated_at() trigger unconditionally sets NEW.updated_at = NOW(),
--          which defeats the sync engine's use of log.changedAt for updated_at.
--          When applying multiple field logs from the same batch, the first UPDATE
--          triggers NOW(), making subsequent same-batch UPDATEs appear stale.
-- Fix:     Check session variable sync.bypass_trigger — if set to 'true' within a
--          transaction (via SET LOCAL), the trigger returns NEW unchanged, preserving
--          the application-supplied updated_at value.
-- Safe to re-run: YES — CREATE OR REPLACE is atomic and idempotent.
-- Affects: All 108 tables that reference set_updated_at() — no trigger recreation needed.

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('sync.bypass_trigger', true) = 'true' THEN
        RETURN NEW;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
