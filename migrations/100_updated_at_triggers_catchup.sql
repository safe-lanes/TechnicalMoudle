-- Migration: Catch-up trigger creation for tables that got updated_at after migration 099
-- Purpose: Migration 099 dynamically creates triggers on all tables with updated_at,
--          but migration 0056 added updated_at to 5 more tables AFTER 099 ran.
--          On a fresh DB, 099 runs before 0056 (by sort order), so these 5 tables
--          would be missing their triggers. This migration ensures they get created.
-- Safe to re-run: YES — DROP IF EXISTS + CREATE pattern

-- Ensure the trigger function exists (no-op if 099 already ran)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-run the dynamic trigger creation for ALL tables with updated_at
-- This is the same logic as migration 099 but catches any tables added since
DO $$
DECLARE
    tbl TEXT;
    trigger_name TEXT;
BEGIN
    FOR tbl IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
        WHERE c.column_name = 'updated_at'
        AND c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP
        trigger_name := 'trg_' || tbl || '_updated_at';
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, tbl);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
            trigger_name, tbl
        );
    END LOOP;
END;
$$;
