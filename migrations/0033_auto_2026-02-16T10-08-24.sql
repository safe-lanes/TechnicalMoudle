ALTER TABLE "inventory_transactions" ADD COLUMN "spare_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD COLUMN "spare_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN "spare_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spares_history" ADD COLUMN "spare_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_spare_uuid_spares_suuid_fk" FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_spare_uuid_spares_suuid_fk" FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD CONSTRAINT "spare_location_stock_spare_uuid_spares_suuid_fk" FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_spare_uuid_spares_suuid_fk" FOREIGN KEY ("spare_uuid") REFERENCES "public"."spares"("suuid") ON DELETE no action ON UPDATE no action;