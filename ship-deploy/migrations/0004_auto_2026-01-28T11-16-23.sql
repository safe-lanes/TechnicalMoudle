ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "confirm_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "closed_by_name" text;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "closed_by_rank" text;