ALTER TABLE "fleet_spares" DROP CONSTRAINT IF EXISTS "fleet_spares_part_code_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fleet_spares_part_code";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fleet_spares_part_code" ON "fleet_spares" USING btree ("part_code");