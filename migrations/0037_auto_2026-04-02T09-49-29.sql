ALTER TABLE "ship_surveys_master" ADD COLUMN "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN "is_sync" boolean DEFAULT false;