CREATE TABLE "report_favorites" (
        "id" serial PRIMARY KEY NOT NULL,
        "rfuuid" text DEFAULT gen_random_uuid()::text NOT NULL,
        "report_id" text NOT NULL,
        "created_by_uuid" text NOT NULL,
        "updated_by_uuid" text,
        "is_deleted" boolean DEFAULT false NOT NULL,
        "is_sync" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "report_favorites_rfuuid_unique" UNIQUE("rfuuid"),
        CONSTRAINT "unique_user_report_favorite" UNIQUE("created_by_uuid","report_id")
);
