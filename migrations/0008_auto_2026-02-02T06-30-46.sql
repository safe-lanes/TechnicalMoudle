ALTER TABLE "fleets" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "updated_by" text;