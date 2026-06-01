ALTER TABLE "work_orders" ADD COLUMN "was_reopened" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "superintendent_reopen_remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "superintendent_reopened_by_name" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "reopened_at" text;