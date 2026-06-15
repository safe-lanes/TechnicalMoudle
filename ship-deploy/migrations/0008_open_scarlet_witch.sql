ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "contact_person" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "phone" text;