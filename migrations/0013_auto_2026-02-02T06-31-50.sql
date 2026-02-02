ALTER TABLE "form_version_usage" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "updated_by" text;