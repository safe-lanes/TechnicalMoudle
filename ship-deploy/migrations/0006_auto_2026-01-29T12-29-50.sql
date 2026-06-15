ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "ihm_presence" text DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "ihm_evidence_type" text DEFAULT 'None';--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "was_rejected" boolean DEFAULT false NOT NULL;