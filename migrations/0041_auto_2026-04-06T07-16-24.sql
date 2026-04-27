ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "overdue_reason" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "overdue_reason_details" text;