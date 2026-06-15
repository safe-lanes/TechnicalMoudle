-- Migration 074: Add FK constraints for fleet_classes relationships

-- FK: fleet_classes.fleet_id -> fleets.fuuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_fleet_classes_fleet_id' AND table_name = 'fleet_classes'
  ) THEN
    ALTER TABLE fleet_classes
      ADD CONSTRAINT fk_fleet_classes_fleet_id
      FOREIGN KEY (fleet_id) REFERENCES fleets(fuuid) ON DELETE CASCADE;
  END IF;
END $$;

-- FK: vessels.class_id -> fleet_classes.fcuuid (SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_vessels_class_id' AND table_name = 'vessels'
  ) THEN
    ALTER TABLE vessels
      ADD CONSTRAINT fk_vessels_class_id
      FOREIGN KEY (class_id) REFERENCES fleet_classes(fcuuid) ON DELETE SET NULL;
  END IF;
END $$;
