ALTER TABLE "alert_config" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "change_request" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "import_history" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "pms_vessel_settings" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "spares_history" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "stores_ledger" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "work_order_executions" ADD COLUMN "vessel_id_int" integer;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "vessel_id_int" integer;