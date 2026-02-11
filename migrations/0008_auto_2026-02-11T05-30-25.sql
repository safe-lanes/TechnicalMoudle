ALTER TABLE "vessels" ADD COLUMN "vuuid" text;--> statement-breakpoint
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_vuuid_unique" UNIQUE("vuuid");