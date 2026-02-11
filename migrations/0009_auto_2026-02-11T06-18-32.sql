ALTER TABLE "components" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "defect_sequences" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "ihm_items" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "ihm_maintenance_log" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "running_hours_audit" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "spares" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "vessels" ADD COLUMN "id_int" serial NOT NULL;