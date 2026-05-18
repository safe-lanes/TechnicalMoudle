CREATE TABLE IF NOT EXISTS "work_order_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"execution_id" text,
	"vessel_id" text NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_key" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_backend" text DEFAULT 'object' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_documents_work_order_id_work_orders_wouuid_fk') THEN ALTER TABLE "work_order_documents" ADD CONSTRAINT "work_order_documents_work_order_id_work_orders_wouuid_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("wouuid") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_documents_vessel_id_vessels_vuuid_fk') THEN ALTER TABLE "work_order_documents" ADD CONSTRAINT "work_order_documents_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wo_docs_work_order" ON "work_order_documents" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wo_docs_vessel" ON "work_order_documents" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wo_docs_execution" ON "work_order_documents" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wo_docs_type" ON "work_order_documents" USING btree ("document_type");