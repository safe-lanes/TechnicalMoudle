ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "meter_replaced_date" timestamp;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "meter_replaced_last_rh" numeric(10, 2);