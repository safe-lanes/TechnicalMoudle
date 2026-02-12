# Vessel Identity Restructure - Migration Guide

> Complete chronological record of every prompt-based task step executed during the vessel identity migration. This migration converted `vessels.id` from TEXT (UUID format) to SERIAL INTEGER, introduced `vessels.vuuid` as the canonical UUID identity, and established DB-level FK constraints across all 31 child tables. This was the first identity restructure and became the proven pattern later followed by the component migration (migrations 0016-0022).

---

## Migration Summary

| Before | After |
|--------|-------|
| `vessels.id` = TEXT PRIMARY KEY (UUID format) | `vessels.id` = INTEGER SERIAL PRIMARY KEY (auto-increment) |
| No dedicated UUID column | `vessels.vuuid` = TEXT NOT NULL UNIQUE (canonical UUID identity) |
| No FK constraints on child tables | 31 child tables have DB-level FK constraints to `vessels(vuuid)` |
| Server code used `vessels.id` (TEXT) for lookups | Server code uses `eq(vessels.vuuid, ...)` for all lookups |
| Frontend used `vessel.id` (TEXT UUID) | Frontend maps `vuuid` to `id` (string) for backward compatibility |

---

## Chronological Task Steps (Prompt-by-Prompt)

### Task 1: Add `vuuid` Column to Vessels Table
**Date**: 2026-02-11 ~07:13  
**Migration**: `0008_daily_havok.sql`  
**Commit**: `640f5d3f` — *Update vessel identification to use unique IDs consistently*  
**Prompt**: *Add a `vuuid` TEXT column to the vessels table. Populate it by copying the existing `id` (UUID) values. Make it UNIQUE.*

**What was done**:
1. Added `vuuid` column definition to `shared/schema.ts` (TEXT, UNIQUE)
2. Created migration `0008_daily_havok.sql`:
   ```sql
   ALTER TABLE "vessels" ADD COLUMN "vuuid" text;
   ALTER TABLE "vessels" ADD CONSTRAINT "vessels_vuuid_unique" UNIQUE("vuuid");
   UPDATE "vessels" SET "vuuid" = "id" WHERE "vuuid" IS NULL;
   ```

**Result**: Every existing vessel row now has its original UUID copied into `vuuid`. The old `id` TEXT column still exists at this point.

---

### Task 2: Add FK Constraints — Batch 1 (2 Child Tables)
**Date**: 2026-02-11 ~07:13  
**Migration**: `0009_auto_2026-02-11T07-13-13.sql`  
**Commit**: `640f5d3f` — *Update vessel identification to use unique IDs consistently* (same session as Task 1)  
**Prompt**: *Add foreign key constraints from child tables' `vessel_id` columns to `vessels(vuuid)`. Start with defect_sequences and users.*

**What was done**:
1. Updated Drizzle schema references for these 2 tables
2. Generated migration `0009`:
   ```sql
   ALTER TABLE "defect_sequences" ADD CONSTRAINT "defect_sequences_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "users" ADD CONSTRAINT "users_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ```

**Child tables constrained**: defect_sequences, users

---

### Task 3: Add FK Constraints — Batch 2 (1 Child Table)
**Date**: 2026-02-11 ~07:13  
**Migration**: `0010_auto_2026-02-11T07-13-17.sql`  
**Commit**: `640f5d3f` — *Update vessel identification to use unique IDs consistently* (same session)  
**Prompt**: *Continue adding FK constraint for running_hours_audit.*

**What was done**:
1. Updated Drizzle schema reference for running_hours_audit
2. Generated migration `0010`:
   ```sql
   ALTER TABLE "running_hours_audit" ADD CONSTRAINT "running_hours_audit_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ```

**Child tables constrained**: running_hours_audit

---

### Task 4: Add FK Constraints — Batch 3 (8 Child Tables)
**Date**: 2026-02-11 ~07:13  
**Migration**: `0011_auto_2026-02-11T07-13-39.sql`  
**Commit**: `22ce2db0` — *Update vessel identification from ID to UUID across the system*  
**Prompt**: *Continue adding FK constraints for change_request, components, ihm_items, ihm_maintenance_log, spares, spares_history, stores_items, stores_ledger.*

**What was done**:
1. Updated Drizzle schema references for all 8 tables
2. Generated migration `0011`:
   ```sql
   ALTER TABLE "change_request" ADD CONSTRAINT "change_request_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "components" ADD CONSTRAINT "components_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "ihm_items" ADD CONSTRAINT "ihm_items_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "ihm_maintenance_log" ADD CONSTRAINT "ihm_maintenance_log_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "spares" ADD CONSTRAINT "spares_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "stores_items" ADD CONSTRAINT "stores_items_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "stores_ledger" ADD CONSTRAINT "stores_ledger_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ```

**Child tables constrained**: change_request, components, ihm_items, ihm_maintenance_log, spares, spares_history, stores_items, stores_ledger

---

### Task 5: Add FK Constraints — Batch 4 (11 Child Tables)
**Date**: 2026-02-11 ~07:14  
**Migration**: `0012_auto_2026-02-11T07-14-00.sql`  
**Commit**: `22ce2db0` — *Update vessel identification from ID to UUID across the system* (same session as Task 4)  
**Prompt**: *Continue adding FK constraints for alert_config, alert_events, certificates, defects, import_history, jobs, pms_vessel_settings, surveys, work_order_execution_details, work_order_executions, work_orders.*

**What was done**:
1. Updated Drizzle schema references for all 11 tables
2. Generated migration `0012`:
   ```sql
   ALTER TABLE "alert_config" ADD CONSTRAINT "alert_config_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "certificates" ADD CONSTRAINT "certificates_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "defects" ADD CONSTRAINT "defects_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "import_history" ADD CONSTRAINT "import_history_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "pms_vessel_settings" ADD CONSTRAINT "pms_vessel_settings_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "surveys" ADD CONSTRAINT "surveys_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "work_order_execution_details" ADD CONSTRAINT "work_order_execution_details_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "work_order_executions" ADD CONSTRAINT "work_order_executions_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ```

**Child tables constrained**: alert_config, alert_events, certificates, defects, import_history, jobs, pms_vessel_settings, surveys, work_order_execution_details, work_order_executions, work_orders

---

### Task 6: Add FK Constraints — Batch 5 (9 Child Tables)
**Date**: 2026-02-11 ~07:14  
**Migration**: `0013_auto_2026-02-11T07-14-20.sql`  
**Commits**:
- `b21cd529` — *Update vessel identification to use VUUID across the application*
- `45f2b0fc` — *Complete vessel identity restructure and server-side refactor*

**Prompt**: *Add FK constraints for the remaining child tables: inventory_transactions, job_component_links, locations, spare_component_links, spare_location_stock, vessel_certificate_applicability, vessel_certificate_data, vessel_survey_applicability, vessel_survey_data.*

**What was done**:
1. Updated Drizzle schema references for all 9 remaining tables
2. Generated migration `0013`:
   ```sql
   ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "job_component_links" ADD CONSTRAINT "job_component_links_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "locations" ADD CONSTRAINT "locations_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "spare_location_stock" ADD CONSTRAINT "spare_location_stock_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "vessel_certificate_applicability" ADD CONSTRAINT "vessel_certificate_applicability_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "vessel_certificate_data" ADD CONSTRAINT "vessel_certificate_data_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "vessel_survey_applicability" ADD CONSTRAINT "vessel_survey_applicability_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "vessel_survey_data" ADD CONSTRAINT "vessel_survey_data_vessel_id_vessels_vuuid_fk"
     FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action;
   ```

**Child tables constrained**: inventory_transactions, job_component_links, locations, spare_component_links, spare_location_stock, vessel_certificate_applicability, vessel_certificate_data, vessel_survey_applicability, vessel_survey_data

---

### Task 7: Refactor Server Code — Switch All Lookups from `id` to `vuuid`
**Date**: 2026-02-11 ~07:34 to ~07:44  
**Commits**:
- `640f5d3f` (2026-02-11 07:34) — *Update vessel identification to use unique IDs consistently*
- `22ce2db0` (2026-02-11 07:40) — *Update vessel identification from ID to UUID across the system*
- `b21cd529` (2026-02-11 07:42) — *Update vessel identification to use VUUID across the application*
- `45f2b0fc` (2026-02-11 07:44) — *Complete vessel identity restructure and server-side refactor*

**Prompt**: *Refactor all server-side code to use `vessels.vuuid` instead of `vessels.id` for UUID-based lookups. Update all ORM queries, child table inserts, and JOIN conditions.*

**What was done** (verified via commits above):

1. All ORM queries updated to use `eq(vessels.vuuid, ...)` instead of `eq(vessels.id, ...)`
2. `getVessels()` returns `{ id: number, vuuid: string, name, code }`
3. `createVessel()` auto-generates integer `id` (omitted from insert), accepts `vuuid` for UUID
4. Sync-masters INSERT omits `id` (auto-generated), upserts on `vuuid`
5. All child table inserts store `vessel.vuuid` as the `vessel_id` value

---

### Task 8: Convert `vessels.id` from TEXT to SERIAL INTEGER
**Date**: 2026-02-11 ~08:37  
**Migration**: `0014_auto_2026-02-11T08-37-10.sql`  
**Commit**: `e947f98b` — *Update vessel identification to use sequential integers*  
**Prompt**: *Convert vessels.id from TEXT to INTEGER SERIAL PRIMARY KEY. This is safe because all 31 FK constraints reference vessels(vuuid), not vessels(id). Also set vuuid to NOT NULL.*

**What was done**:
1. Updated `shared/schema.ts` — changed `id` from `text("id")` to `serial("id").primaryKey()`
2. Updated `shared/v2/*/schema.ts` — same change where applicable
3. Generated migration `0014`:
   ```sql
   -- Phase 4: Convert vessels.id from TEXT to INTEGER auto-increment
   -- Safe because: All 31 FK constraints reference vessels(vuuid), NOT vessels(id)
   -- All server/frontend code uses vessels.vuuid for UUID lookups (Phase 3 complete)

   -- Step 1: Drop primary key constraint on old TEXT id column
   ALTER TABLE "vessels" DROP CONSTRAINT "vessels_pkey";

   -- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
   ALTER TABLE "vessels" DROP COLUMN "id";

   -- Step 3: Add new SERIAL id column as primary key
   ALTER TABLE "vessels" ADD COLUMN "id" SERIAL PRIMARY KEY;

   -- Step 4: Make vuuid NOT NULL (it's the canonical UUID identity column)
   ALTER TABLE "vessels" ALTER COLUMN "vuuid" SET NOT NULL;
   ```

**Result**: `vessels.id` is now an auto-incrementing integer. Existing rows received sequential integer IDs. The old TEXT UUID values in `id` are gone (preserved in `vuuid`). `vuuid` is now NOT NULL.

---

### Task 9: Fix Frontend for UUID-to-String Mapping
**Date**: 2026-02-11 ~08:48  
**Commit**: `e947f98b` — *Update vessel identification to use sequential integers* (same session as Task 8)  
**Prompt**: *Update frontend VesselContext and useVessels hook to map vuuid to id (string) for backward compatibility so all 30+ page files continue working without changes.*

**What was done** (verified via commit above):

1. `VesselContext` / `useVessels` Vessel interface has `id: string` (mapped from `vuuid`) and `vuuid: string`
2. All 30+ page files using `vessel.id` work without changes since the UUID value is identical
3. Child tables' `vessel_id` columns remain TEXT referencing `vessels.vuuid` — no child table migration needed

---

### Task 10: Create Vessel Migration Guide Document
**Date**: 2026-02-11 ~09:28  
**Commit**: `d5663b42` — *Create guide for future vessel migration documentation*  
**Prompt**: *Create a reference document for anyone writing future database migrations involving the vessels table or any of the 31 child tables.*

**What was done**: Created `docs/vessel-migration-guide.md` with table structure, FK relationships, rules for future migrations, server/frontend code patterns, and migration history.

---

## Complete FK Constraint Summary

All 31 child tables' `vessel_id` columns reference `vessels(vuuid)` with ON DELETE NO ACTION, ON UPDATE NO ACTION.

| #  | Child Table                        | Migration | Constraint Name                                              |
|----|------------------------------------|-----------|--------------------------------------------------------------|
| 1  | defect_sequences                   | 0009      | defect_sequences_vessel_id_vessels_vuuid_fk                  |
| 2  | users                              | 0009      | users_vessel_id_vessels_vuuid_fk                             |
| 3  | running_hours_audit                | 0010      | running_hours_audit_vessel_id_vessels_vuuid_fk               |
| 4  | change_request                     | 0011      | change_request_vessel_id_vessels_vuuid_fk                    |
| 5  | components                         | 0011      | components_vessel_id_vessels_vuuid_fk                        |
| 6  | ihm_items                          | 0011      | ihm_items_vessel_id_vessels_vuuid_fk                         |
| 7  | ihm_maintenance_log                | 0011      | ihm_maintenance_log_vessel_id_vessels_vuuid_fk               |
| 8  | spares                             | 0011      | spares_vessel_id_vessels_vuuid_fk                            |
| 9  | spares_history                     | 0011      | spares_history_vessel_id_vessels_vuuid_fk                    |
| 10 | stores_items                       | 0011      | stores_items_vessel_id_vessels_vuuid_fk                      |
| 11 | stores_ledger                      | 0011      | stores_ledger_vessel_id_vessels_vuuid_fk                     |
| 12 | alert_config                       | 0012      | alert_config_vessel_id_vessels_vuuid_fk                      |
| 13 | alert_events                       | 0012      | alert_events_vessel_id_vessels_vuuid_fk                      |
| 14 | certificates                       | 0012      | certificates_vessel_id_vessels_vuuid_fk                      |
| 15 | defects                            | 0012      | defects_vessel_id_vessels_vuuid_fk                           |
| 16 | import_history                     | 0012      | import_history_vessel_id_vessels_vuuid_fk                    |
| 17 | jobs                               | 0012      | jobs_vessel_id_vessels_vuuid_fk                              |
| 18 | pms_vessel_settings                | 0012      | pms_vessel_settings_vessel_id_vessels_vuuid_fk               |
| 19 | surveys                            | 0012      | surveys_vessel_id_vessels_vuuid_fk                           |
| 20 | work_order_execution_details       | 0012      | work_order_execution_details_vessel_id_vessels_vuuid_fk      |
| 21 | work_order_executions              | 0012      | work_order_executions_vessel_id_vessels_vuuid_fk             |
| 22 | work_orders                        | 0012      | work_orders_vessel_id_vessels_vuuid_fk                       |
| 23 | inventory_transactions             | 0013      | inventory_transactions_vessel_id_vessels_vuuid_fk            |
| 24 | job_component_links                | 0013      | job_component_links_vessel_id_vessels_vuuid_fk               |
| 25 | locations                          | 0013      | locations_vessel_id_vessels_vuuid_fk                         |
| 26 | spare_component_links              | 0013      | spare_component_links_vessel_id_vessels_vuuid_fk             |
| 27 | spare_location_stock               | 0013      | spare_location_stock_vessel_id_vessels_vuuid_fk              |
| 28 | vessel_certificate_applicability   | 0013      | vessel_certificate_applicability_vessel_id_vessels_vuuid_fk  |
| 29 | vessel_certificate_data            | 0013      | vessel_certificate_data_vessel_id_vessels_vuuid_fk           |
| 30 | vessel_survey_applicability        | 0013      | vessel_survey_applicability_vessel_id_vessels_vuuid_fk       |
| 31 | vessel_survey_data                 | 0013      | vessel_survey_data_vessel_id_vessels_vuuid_fk                |

---

## Current Vessels Table Structure

| Column          | Type      | Constraints                        | Description                                    |
|-----------------|-----------|------------------------------------|------------------------------------------------|
| `id`            | INTEGER   | PRIMARY KEY, SERIAL (auto-increment) | Internal database identifier (1, 2, 3...)      |
| `vuuid`         | TEXT      | NOT NULL, UNIQUE                   | Canonical UUID identity column                 |
| `name`          | TEXT      | NOT NULL                           | Vessel display name                            |
| `code`          | TEXT      | NOT NULL                           | Vessel code (independent identifier)           |
| `fleet_id`      | TEXT      | NULLABLE                           | Fleet association                              |
| `imo_number`    | TEXT      | NULLABLE                           | IMO number                                     |
| `vessel_type`   | TEXT      | NULLABLE                           | Type of vessel                                 |
| `flag`          | TEXT      | NULLABLE                           | Flag state                                     |
| `is_active`     | BOOLEAN   | NOT NULL, DEFAULT true             | Active status                                  |
| `vessel_sequence` | INTEGER | NULLABLE                           | Display ordering                               |
| `created_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Creation timestamp                             |
| `updated_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Last update timestamp                          |

### Key Identity Rules

- **`id` (INTEGER SERIAL)**: Auto-generated internal identifier. Never set manually. Never referenced by any child table.
- **`vuuid` (TEXT UNIQUE)**: The canonical UUID identity. All 31 child tables reference this column via their `vessel_id` foreign key. This is the value used throughout server code and frontend for vessel identification.

---

## Critical Rules for Future Vessel Migrations

### 1. Never Change the `id` Column Type
The `vessels.id` column is now `INTEGER SERIAL PRIMARY KEY`. Do not change it back to TEXT, UUID, or any other type. Changing primary key column types generates destructive ALTER TABLE statements that break existing data.

### 2. Never Change the `vuuid` Column Type
The `vessels.vuuid` column is `TEXT NOT NULL UNIQUE`. All 31 child tables depend on it via foreign keys. Changing its type would require simultaneously migrating all 31 child tables.

### 3. Child Tables Reference `vuuid`, Not `id`
All child table `vessel_id` columns are **TEXT** and reference `vessels(vuuid)`. They do **not** reference `vessels(id)`.

When writing queries or migrations involving child tables:
- Use the UUID string value (from `vuuid`) when filtering by `vessel_id`
- Never use the integer `id` value for child table lookups

### 4. Adding a New Child Table with `vessel_id`
```sql
CREATE TABLE new_table (
    id SERIAL PRIMARY KEY,
    vessel_id TEXT NOT NULL REFERENCES vessels(vuuid),
    -- other columns...
);
```

In Drizzle schema (`shared/schema.ts` or `shared/v2/*/schema.ts`):

```typescript
export const newTable = pgTable("new_table", {
    id: serial("id").primaryKey(),
    vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
    // other columns...
});
```

### 5. Adding New Columns to the Vessels Table
Use a dedicated ALTER TABLE migration:

```sql
ALTER TABLE vessels ADD COLUMN new_column TEXT;
```

Update `shared/schema.ts` first, then run `drizzle-kit generate` to create the migration file.

### 6. Inserting New Vessels
- **Do NOT supply `id`** — it is auto-generated by the SERIAL sequence
- **Always supply `vuuid`** — it is the canonical UUID identity

```sql
INSERT INTO vessels (vuuid, name, code, is_active)
VALUES ('your-uuid-here', 'Vessel Name', 'vessel-code', true);
-- id will be auto-assigned as the next integer in sequence
```

### 7. Server-Side Query Patterns
```typescript
// Correct: use vuuid for UUID lookups
const vessel = await db.select().from(vessels).where(eq(vessels.vuuid, uuidValue));

// Wrong: never use vessels.id for UUID lookups
// const vessel = await db.select().from(vessels).where(eq(vessels.id, uuidValue));

// Correct: vessel_id in child tables contains the UUID string
const comps = await db.select().from(components)
    .where(eq(components.vesselId, vesselUuid));

// Correct: omit id (auto-generated), provide vuuid
const newVessel = await db.insert(vessels).values({
    vuuid: generatedUuid,
    name: "Vessel Name",
    code: "vessel-code",
}).returning();
// newVessel[0].id will be an auto-assigned integer
```

### 8. Frontend Code Patterns
```typescript
interface Vessel {
    id: string;    // Mapped from vuuid for backward compatibility
    vuuid: string; // Same UUID value
    name: string;
    code: string;
}
```

The frontend maps `vuuid` to `id` (as a string) so that all 30+ page files that reference `vessel.id` continue to work without changes. The UUID value is the same in both fields. When a vessel is selected in the UI, the UUID from `vuuid` is used as the identity value for all API calls, filtering, and child table queries.

### 9. One Logical Change Per Migration
Follow the project's Drizzle-only migration policy:
- New tables: dedicated migration file
- New columns: ALTER TABLE ADD COLUMN in its own file
- Index changes: separate migration
- Enum updates: isolated migration
- Never combine unrelated changes in one migration

---

## Migration File Reference

| Migration | Date | Description |
|-----------|------|-------------|
| `0008_daily_havok.sql` | 2026-02-11 | Add `vuuid` column, populate from existing `id`, set UNIQUE |
| `0009_auto_2026-02-11T07-13-13.sql` | 2026-02-11 | FK constraints: defect_sequences, users |
| `0010_auto_2026-02-11T07-13-17.sql` | 2026-02-11 | FK constraint: running_hours_audit |
| `0011_auto_2026-02-11T07-13-39.sql` | 2026-02-11 | FK constraints: 8 child tables (change_request, components, ihm_*, spares*, stores_*) |
| `0012_auto_2026-02-11T07-14-00.sql` | 2026-02-11 | FK constraints: 11 child tables (alert_*, certificates, defects, import_history, jobs, pms_*, surveys, work_order*) |
| `0013_auto_2026-02-11T07-14-20.sql` | 2026-02-11 | FK constraints: 9 child tables (inventory_transactions, job_component_links, locations, spare_*, vessel_certificate_*, vessel_survey_*) |
| `0014_auto_2026-02-11T08-37-10.sql` | 2026-02-11 | Convert `id` from TEXT to INTEGER SERIAL PRIMARY KEY; set `vuuid` NOT NULL |

---

## Important Notes

- **Child tables were NOT migrated during the id conversion**: The 31 child tables' `vessel_id TEXT` columns and their FK constraints to `vessels(vuuid)` remained completely unchanged. No child table migration was needed because they never referenced `vessels.id` — they always referenced `vessels.vuuid`.
- **Design choice**: Keeping child tables on TEXT UUIDs referencing `vuuid` (rather than migrating to integer FKs referencing `id`) was intentional. It avoids a massive refactor across 31 tables and 149+ files while maintaining full referential integrity.
- **The `vessels.id` integer is for internal database use only**. It is never used as a foreign key by any table. All cross-table vessel relationships use the UUID in `vuuid`.
- **Never use `db:push --force`** for vessel-related schema changes. Always use `drizzle-kit generate` to create proper migration files, following the project's Drizzle-only migration policy.
- **Migration tracking is unified in `schema_migrations`**: Both code-based migrations (001-026) and Drizzle file-based migrations (0000-0014) are tracked in the single `schema_migrations` table. Drizzle migrations are stored with a `drizzle_` prefix (e.g., `drizzle_0014_auto_2026-02-11T08-37-10`).

---

## Relationship to Component Migration

This vessel migration established the proven pattern later followed by the component identity restructure (migrations 0016-0022):

| Step | Vessel Migration | Component Migration |
|------|-----------------|---------------------|
| Add UUID column | `vuuid` added in 0008 | `cuuid` added in 0016 |
| FK constraints to UUID | 31 child tables in 0009-0013 | 15 child tables in 0018-0021 |
| Server code refactor | All queries to `eq(vessels.vuuid, ...)` | All queries to `eq(components.cuuid, ...)` |
| Convert id to SERIAL | Migration 0014 | Migration 0022 |
| FK policy | ON DELETE NO ACTION, ON UPDATE NO ACTION | ON DELETE RESTRICT, ON UPDATE CASCADE |

The component migration used stricter FK policies (RESTRICT/CASCADE vs NO ACTION) to prevent orphaned child records and automatically propagate cuuid updates.
