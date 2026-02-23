ALTER TABLE "alert_deliveries" ADD COLUMN "event_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "aeuuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "policy_uuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_policies" ADD COLUMN "apuuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_event_uuid_alert_events_aeuuid_fk" FOREIGN KEY ("event_uuid") REFERENCES "public"."alert_events"("aeuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_policy_uuid_alert_policies_apuuid_fk" FOREIGN KEY ("policy_uuid") REFERENCES "public"."alert_policies"("apuuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_aeuuid_unique" UNIQUE("aeuuid");--> statement-breakpoint
ALTER TABLE "alert_policies" ADD CONSTRAINT "alert_policies_apuuid_unique" UNIQUE("apuuid");