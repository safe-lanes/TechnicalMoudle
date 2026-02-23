ALTER TABLE "bulk_import_errors" ADD COLUMN "import_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_import_history" ADD COLUMN "biuuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_import_errors" ADD CONSTRAINT "bulk_import_errors_import_uuid_bulk_import_history_biuuid_fk" FOREIGN KEY ("import_uuid") REFERENCES "public"."bulk_import_history"("biuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_import_history" ADD CONSTRAINT "bulk_import_history_biuuid_unique" UNIQUE("biuuid");