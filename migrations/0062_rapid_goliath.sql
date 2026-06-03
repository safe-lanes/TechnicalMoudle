ALTER TABLE "fleet_jobs" ADD COLUMN "level2_reviewer_rank_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "level2_reviewer_rank_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "reviewer_comments" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "reviewed_by_uuid" text;