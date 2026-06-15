CREATE TABLE IF NOT EXISTS "additional_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fleet_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_users" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"role" text,
	"designation" text,
	"user_type" text,
	"department" text,
	"email" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vessel_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"classification" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_additional_groups_name" ON "additional_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fleet_groups_name" ON "fleet_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_master_users_full_name" ON "master_users" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_master_users_email" ON "master_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ports_name" ON "ports" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vessel_types_name" ON "vessel_types" USING btree ("name");