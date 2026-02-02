ALTER TABLE "defect_sequences" ADD COLUMN "uuid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_sequences" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_sequences" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_sequences" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_sequences" ADD COLUMN "updated_by" text;