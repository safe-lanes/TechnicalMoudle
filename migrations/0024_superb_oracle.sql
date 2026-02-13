-- Migration 0024: Rename vessel_code → vessel_id in 12 tables + add FK constraints to vessels(vuuid)
-- Also removes vessel_code from components table (redundant with existing vessel_id FK)

-- Step 1: Remove redundant vessel_code column from components (already has vessel_id with FK)
ALTER TABLE "components" DROP COLUMN IF EXISTS "vessel_code";--> statement-breakpoint

-- Step 2: Rename vessel_code → vessel_id in all 12 tables
ALTER TABLE "audit_log" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "bulk_import_history" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "component_class_regulatory" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "component_documents" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "component_maintenance_history" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "component_requisitions" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "component_running_hours_log" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "fleet_component_mapping" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "fleet_vessel_mapping" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint
ALTER TABLE "master_data" RENAME COLUMN "vessel_code" TO "vessel_id";--> statement-breakpoint

-- Step 3: Drop old indexes on vessel_code
DROP INDEX IF EXISTS "idx_audit_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_bulk_import_vessel";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_class_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_doc_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_history_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_req_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_rh_log_vessel_code";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fleet_comp_mapping_vessel";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fleet_job_mapping_vessel";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fleet_spare_mapping_vessel";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fleet_vessel_mapping_vessel";--> statement-breakpoint

-- Step 4: Drop old unique constraints (will be recreated with vessel_id)
ALTER TABLE "fleet_component_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_component_mapping";--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_job_vessel_mapping";--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_spare_vessel_mapping";--> statement-breakpoint
ALTER TABLE "fleet_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_vessel_mapping";--> statement-breakpoint

-- Step 5: Add FK constraints on vessel_id referencing vessels(vuuid)
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_import_history" ADD CONSTRAINT "bulk_import_history_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_class_regulatory" ADD CONSTRAINT "component_class_regulatory_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_documents" ADD CONSTRAINT "component_documents_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_maintenance_history" ADD CONSTRAINT "component_maintenance_history_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_requisitions" ADD CONSTRAINT "component_requisitions_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_running_hours_log" ADD CONSTRAINT "component_running_hours_log_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_component_mapping" ADD CONSTRAINT "fleet_component_mapping_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" ADD CONSTRAINT "fleet_job_vessel_mapping_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" ADD CONSTRAINT "fleet_spare_vessel_mapping_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_vessel_mapping" ADD CONSTRAINT "fleet_vessel_mapping_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data" ADD CONSTRAINT "master_data_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 6: Create new indexes on vessel_id
CREATE INDEX "idx_audit_vessel_id" ON "audit_log" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_bulk_import_vessel_id" ON "bulk_import_history" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_class_vessel_id" ON "component_class_regulatory" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_doc_vessel_id" ON "component_documents" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_history_vessel_id" ON "component_maintenance_history" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_req_vessel_id" ON "component_requisitions" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_rh_log_vessel_id" ON "component_running_hours_log" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_comp_mapping_vessel_id" ON "fleet_component_mapping" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_job_mapping_vessel_id" ON "fleet_job_vessel_mapping" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_spare_mapping_vessel_id" ON "fleet_spare_vessel_mapping" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_vessel_mapping_vessel_id" ON "fleet_vessel_mapping" USING btree ("vessel_id");--> statement-breakpoint

-- Step 7: Recreate unique constraints with vessel_id
ALTER TABLE "fleet_component_mapping" ADD CONSTRAINT "unique_fleet_component_mapping" UNIQUE("fleet_equipment_code","vessel_id","component_code");--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" ADD CONSTRAINT "unique_fleet_job_vessel_mapping" UNIQUE("job_code","vessel_id");--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" ADD CONSTRAINT "unique_fleet_spare_vessel_mapping" UNIQUE("part_code","vessel_id");--> statement-breakpoint
ALTER TABLE "fleet_vessel_mapping" ADD CONSTRAINT "unique_fleet_vessel_mapping" UNIQUE("fleet_equipment_code","vessel_id");