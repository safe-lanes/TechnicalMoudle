ALTER TABLE "defects" ADD COLUMN "confirm_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN "closed_by_name" text;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN "closed_by_rank" text;