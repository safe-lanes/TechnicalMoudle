CREATE TABLE IF NOT EXISTS "company_standard_grace_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "singleton_key" text DEFAULT 'ACTIVE' NOT NULL,
        "grace_method" text DEFAULT 'FIXED_DAYS' NOT NULL,
        "grace_value" integer DEFAULT 7,
        "scope" text DEFAULT 'LAST_WEEK_OF_MONTH' NOT NULL,
        "fallback_grace_days" integer,
        "fallback_method" text DEFAULT 'MONTH_END',
        "updated_by" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "company_standard_grace_settings_singleton_key_unique" UNIQUE("singleton_key")
);
