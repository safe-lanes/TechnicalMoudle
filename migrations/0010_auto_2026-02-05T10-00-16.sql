CREATE TABLE "work_order_postponements" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"vessel_id" text NOT NULL,
	"postponement_number" integer DEFAULT 1 NOT NULL,
	"original_due_date" text,
	"new_due_date" text,
	"postponement_reason" text,
	"authorized_by" text,
	"approval_remarks" text,
	"duration_days" integer,
	"submitted_date" text,
	"approved_date" text,
	"approved_by" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"inform_office" boolean DEFAULT false NOT NULL,
	"attachment_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_postponement_work_order" ON "work_order_postponements" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_postponement_vessel" ON "work_order_postponements" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "idx_postponement_status" ON "work_order_postponements" USING btree ("status");