ALTER TABLE "fleet_jobs" ADD COLUMN IF NOT EXISTS "level2_reviewer_rank_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "level2_reviewer_rank_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "reviewer_comments" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "reviewed_by_uuid" text;
