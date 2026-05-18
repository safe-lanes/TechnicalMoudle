-- Migration: Add updated_at auto-stamp trigger to ALL tables
-- Purpose: Ensures updated_at is automatically set to NOW() on every UPDATE
-- Required for: Ship-shore sync engine (change detection via WHERE updated_at > checkpoint)
-- Safe to re-run: YES — uses IF NOT EXISTS / OR REPLACE patterns throughout
-- Performance impact: Negligible (~1 microsecond per row update)

-- Step 1: Create the trigger function (OR REPLACE makes this idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Apply trigger to every table that has an updated_at column
-- Using DO block to dynamically find all tables and create triggers
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

        -- Drop existing trigger if any (to handle re-runs cleanly)
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, tbl);

        -- Create the trigger
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
            trigger_name, tbl
        );

        RAISE NOTICE 'Created trigger % on table %', trigger_name, tbl;
    END LOOP;
END;
$$;
