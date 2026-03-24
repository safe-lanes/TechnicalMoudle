-- Migration 020: Correct nr_ table FK targets from vessels(id) to vessels(vuuid)
-- vessels.id and vessels.vuuid are identical text values so no data is at risk.
-- All other tables in the codebase reference vessels(vuuid) — this aligns nr_ tables.

-- Drop the 6 vessel FKs created in migration 019 that point to vessels(id)
ALTER TABLE nr_noon_reports  DROP CONSTRAINT IF EXISTS fk_nr_noon_reports_vessel;
ALTER TABLE nr_fuel_rob      DROP CONSTRAINT IF EXISTS fk_nr_fuel_rob_vessel;
ALTER TABLE nr_voyage_legs   DROP CONSTRAINT IF EXISTS fk_nr_voyage_legs_vessel;
ALTER TABLE nr_alerts        DROP CONSTRAINT IF EXISTS fk_nr_alerts_vessel;
ALTER TABLE nr_cii_tracking  DROP CONSTRAINT IF EXISTS fk_nr_cii_tracking_vessel;
ALTER TABLE nr_bunker_records DROP CONSTRAINT IF EXISTS fk_nr_bunker_records_vessel;

-- Re-create them targeting vessels(vuuid) — matching every other table in the codebase
DO $$ BEGIN
  ALTER TABLE nr_noon_reports
    ADD CONSTRAINT fk_nr_noon_reports_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_fuel_rob
    ADD CONSTRAINT fk_nr_fuel_rob_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_voyage_legs
    ADD CONSTRAINT fk_nr_voyage_legs_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_alerts
    ADD CONSTRAINT fk_nr_alerts_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_cii_tracking
    ADD CONSTRAINT fk_nr_cii_tracking_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_bunker_records
    ADD CONSTRAINT fk_nr_bunker_records_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
