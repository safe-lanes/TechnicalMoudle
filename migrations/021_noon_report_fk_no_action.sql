-- Migration 021: Remove ON DELETE CASCADE from nr_ vessel FK constraints.
-- The established pattern for every other table in the codebase is plain
-- REFERENCES vessels(vuuid) with no ON DELETE/ON UPDATE clause (NO ACTION default).
-- CASCADE would silently destroy all noon report data if a vessel is deleted.

ALTER TABLE nr_noon_reports   DROP CONSTRAINT IF EXISTS fk_nr_noon_reports_vessel;
ALTER TABLE nr_fuel_rob       DROP CONSTRAINT IF EXISTS fk_nr_fuel_rob_vessel;
ALTER TABLE nr_voyage_legs    DROP CONSTRAINT IF EXISTS fk_nr_voyage_legs_vessel;
ALTER TABLE nr_alerts         DROP CONSTRAINT IF EXISTS fk_nr_alerts_vessel;
ALTER TABLE nr_cii_tracking   DROP CONSTRAINT IF EXISTS fk_nr_cii_tracking_vessel;
ALTER TABLE nr_bunker_records DROP CONSTRAINT IF EXISTS fk_nr_bunker_records_vessel;

ALTER TABLE nr_noon_reports   ADD CONSTRAINT fk_nr_noon_reports_vessel   FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
ALTER TABLE nr_fuel_rob       ADD CONSTRAINT fk_nr_fuel_rob_vessel        FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
ALTER TABLE nr_voyage_legs    ADD CONSTRAINT fk_nr_voyage_legs_vessel     FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
ALTER TABLE nr_alerts         ADD CONSTRAINT fk_nr_alerts_vessel          FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
ALTER TABLE nr_cii_tracking   ADD CONSTRAINT fk_nr_cii_tracking_vessel    FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
ALTER TABLE nr_bunker_records ADD CONSTRAINT fk_nr_bunker_records_vessel  FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid);
