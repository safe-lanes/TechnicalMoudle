ALTER TABLE "defects" ALTER COLUMN "attachments" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN IF NOT EXISTS "part_a_attachments" json DEFAULT '[]'::json;