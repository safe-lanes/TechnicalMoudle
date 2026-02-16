ALTER TABLE "spares" ADD COLUMN "suuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spares" ADD CONSTRAINT "spares_suuid_unique" UNIQUE("suuid");