DROP INDEX IF EXISTS "idx_defect_seq_vessel_year";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_defect_seq_vessel_year') THEN
    ALTER TABLE "defect_sequences" ADD CONSTRAINT "unique_defect_seq_vessel_year" UNIQUE("vessel_id","year");
  END IF;
END $$;