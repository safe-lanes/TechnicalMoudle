ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "was_reopened" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_reopen_remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_reopened_by_name" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "reopened_at" text;
