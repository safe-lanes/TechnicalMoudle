ALTER TABLE "fleet_spares" DROP CONSTRAINT "fleet_spares_part_code_unique";--> statement-breakpoint
DROP INDEX "idx_fleet_spares_part_code";--> statement-breakpoint
CREATE INDEX "idx_fleet_spares_part_code" ON "fleet_spares" USING btree ("part_code");