ALTER TABLE "components" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD COLUMN "updated_by" text;