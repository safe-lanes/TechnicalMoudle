ALTER TABLE "form_definitions" ADD COLUMN "fduuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD COLUMN "form_version_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "fvuuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN "form_definition_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "form_version_usage" ADD CONSTRAINT "form_version_usage_form_version_uuid_form_versions_fvuuid_fk" FOREIGN KEY ("form_version_uuid") REFERENCES "public"."form_versions"("fvuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_definition_uuid_form_definitions_fduuid_fk" FOREIGN KEY ("form_definition_uuid") REFERENCES "public"."form_definitions"("fduuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_fduuid_unique" UNIQUE("fduuid");--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_fvuuid_unique" UNIQUE("fvuuid");