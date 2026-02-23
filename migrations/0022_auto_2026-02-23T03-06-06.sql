ALTER TABLE "recurring_defect_links" DROP CONSTRAINT "recurring_defect_links_defect_id_defects_id_fk";
--> statement-breakpoint
ALTER TABLE "defects" ADD COLUMN "duuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "defect_actions" ADD CONSTRAINT "defect_actions_defect_id_defects_duuid_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("duuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defect_attachments" ADD CONSTRAINT "defect_attachments_defect_id_defects_duuid_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("duuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_defect_links" ADD CONSTRAINT "recurring_defect_links_defect_id_defects_duuid_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("duuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_duuid_unique" UNIQUE("duuid");