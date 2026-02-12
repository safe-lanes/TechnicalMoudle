# Component Identity Restructure - Migration Guide

> Complete chronological record of every prompt-based task step executed during the component identity migration. This migration converted `components.id` from TEXT (COMP-xxx format) to SERIAL INTEGER, introduced `components.cuuid` as the canonical UUID identity, and established DB-level FK constraints across all 15 child tables. Pattern follows the proven vessel migration (migrations 0008-0014).

---

## Migration Summary

| Before | After |
|--------|-------|
| `components.id` = TEXT PRIMARY KEY (COMP-xxx format) | `components.id` = INTEGER SERIAL PRIMARY KEY (auto-increment) |
| No UUID column | `components.cuuid` = TEXT NOT NULL UNIQUE (canonical UUID identity) |
| No FK constraints on child tables | 15 child tables have DB-level FK constraints to `components(cuuid)` |
| Server code used `components.id` (TEXT) for lookups | Server code uses `eq(components.cuuid, ...)` for all lookups |
| COMP-xxx ID generated in 4 creation paths | `id` auto-generated, COMP-xxx generation removed |

---

## Chronological Task Steps (Prompt-by-Prompt)

### Task 1: Add `cuuid` Column to Components Table
**Date**: 2026-02-11 ~10:30  
**Migration**: `0016_populate_components_cuuid.sql`  
**Commit**: `73fefdd6` — *Add a unique identifier column to the components table*  
**Prompt**: *Add a `cuuid` TEXT column to the components table. Populate it with UUIDs for all existing rows. Make it NOT NULL and UNIQUE.*

**What was done**:
1. Added `cuuid` column definition to `shared/schema.ts` (TEXT, NOT NULL, UNIQUE)
2. Added `cuuid` column definition to `shared/v2/components/schema.ts`
3. Created hand-written migration `0016_populate_components_cuuid.sql`:
   ```sql
   UPDATE "components" SET "cuuid" = gen_random_uuid()::text WHERE "cuuid" IS NULL;
   ALTER TABLE "components" ALTER COLUMN "cuuid" SET NOT NULL;
   ALTER TABLE "components" ADD CONSTRAINT "components_cuuid_unique" UNIQUE("cuuid");
   ```

**Result**: Every existing component row now has a unique UUID in `cuuid`. New inserts auto-generate `cuuid` via `gen_random_uuid()::text`.

---

### Task 1b: Drizzle Schema Sync for `cuuid` Constraints
**Date**: 2026-02-11 ~10:37  
**Migration**: `0017_auto_2026-02-11T10-37-52.sql`  
**Prompt**: *Run `drizzle-kit generate` to sync the schema changes from Task 1.*

**What was done**:
1. Ran `drizzle-kit generate` after the schema update
2. Drizzle generated migration `0017` to enforce the same constraints at the schema level:
   ```sql
   ALTER TABLE "components" ALTER COLUMN "cuuid" SET NOT NULL;
   ALTER TABLE "components" ADD CONSTRAINT "components_cuuid_unique" UNIQUE("cuuid");
   ```

**Note**: This migration is idempotent with 0016 — the constraints were already applied by the hand-written migration. Drizzle generated it to keep its own migration journal in sync with the schema definition.

---

### Task 2: Add FK Constraints — Batch 1 (3 Child Tables)
**Date**: 2026-02-11 ~11:38  
**Migration**: `0018_auto_2026-02-11T11-38-06.sql`  
**Commit**: `729cb50d` — *Complete foreign key constraints for component identity across child tables*  
**Prompt**: *Add foreign key constraints from child tables' `component_id` columns to `components(cuuid)`. Start with running_hours_audit, spares, and spares_history.*

**What was done**:
1. Updated Drizzle schema references in `shared/schema.ts` and `shared/v2/*/schema.ts` for these 3 tables
2. Generated migration `0018`:
   ```sql
   ALTER TABLE "running_hours_audit" ADD CONSTRAINT "running_hours_audit_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "spares" ADD CONSTRAINT "spares_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ```

**Child tables constrained**: running_hours_audit, spares, spares_history

---

### Task 3: Add FK Constraints — Batch 2 (9 Child Tables)
**Date**: 2026-02-11 ~11:38  
**Migration**: `0019_auto_2026-02-11T11-38-46.sql`  
**Commit**: `729cb50d` — *Complete foreign key constraints for component identity across child tables* (same session as Task 2)  
**Prompt**: *Continue adding FK constraints for the remaining child tables: component_class_regulatory, component_documents, component_maintenance_history, component_requisitions, component_running_hours_log, defects, job_component_links, spare_component_links, work_order_executions.*

**What was done**:
1. Updated Drizzle schema references for all 9 tables
2. Generated migration `0019`:
   ```sql
   ALTER TABLE "component_class_regulatory" ADD CONSTRAINT "component_class_regulatory_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "component_documents" ADD CONSTRAINT "component_documents_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "component_maintenance_history" ADD CONSTRAINT "component_maintenance_history_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "component_requisitions" ADD CONSTRAINT "component_requisitions_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "component_running_hours_log" ADD CONSTRAINT "component_running_hours_log_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "defects" ADD CONSTRAINT "defects_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "job_component_links" ADD CONSTRAINT "job_component_links_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "spare_component_links" ADD CONSTRAINT "spare_component_links_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "work_order_executions" ADD CONSTRAINT "work_order_executions_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ```

**Child tables constrained**: component_class_regulatory, component_documents, component_maintenance_history, component_requisitions, component_running_hours_log, defects, job_component_links, spare_component_links, work_order_executions

---

### Task 4: Add FK Constraint — Jobs Table (SET NOT NULL + FK)
**Date**: 2026-02-11 ~11:49  
**Migration**: `0020_auto_2026-02-11T11-49-18.sql`  
**Commit**: `4bdffd98` — *Update job component to require a non-null reference to components*  
**Prompt**: *Add FK constraint for the jobs table. The jobs.component_id column should also be set to NOT NULL since every job must reference a component.*

**What was done**:
1. Updated `jobs` schema to make `component_id` NOT NULL with FK reference to `components.cuuid`
2. Generated migration `0020`:
   ```sql
   ALTER TABLE "jobs" ALTER COLUMN "component_id" SET NOT NULL;
   ALTER TABLE "jobs" ADD CONSTRAINT "jobs_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ```

**Child tables constrained**: jobs (with NOT NULL enforcement)

---

### Task 5: Add FK Constraints — Batch 3 (Final 2 Child Tables)
**Date**: 2026-02-12 ~06:26  
**Migration**: `0021_auto_2026-02-12T06-26-18.sql`  
**Commit**: `4a62be21` — *Add foreign key constraints and non-nullable fields to database tables*  
**Prompt**: *Add FK constraints for the remaining child tables: fleet_component_mapping (with NOT NULL) and ihm_items.*

**What was done**:
1. Updated schema for `fleet_component_mapping` (NOT NULL + FK) and `ihm_items` (FK)
2. Generated migration `0021`:
   ```sql
   ALTER TABLE "fleet_component_mapping" ALTER COLUMN "component_id" SET NOT NULL;
   ALTER TABLE "fleet_component_mapping" ADD CONSTRAINT "fleet_component_mapping_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ALTER TABLE "ihm_items" ADD CONSTRAINT "ihm_items_component_id_components_cuuid_fk"
     FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE restrict ON UPDATE cascade;
   ```

**Child tables constrained**: fleet_component_mapping (with NOT NULL), ihm_items

---

### Task 6: Refactor Server Code — Switch All Lookups from `id` to `cuuid`
**Date**: 2026-02-11 ~12:00 and 2026-02-12 ~06:30  
**Commits**:
- `1afcaca2` (2026-02-11) — *Update component references to use canonical UUIDs throughout the system*
- `0661257b` (2026-02-12) — *Update component references to use canonical UUIDs*
- `17698dea` (2026-02-12) — *Update component lookups to use unique IDs consistently*

**Prompt**: *Refactor all server-side code to use `components.cuuid` instead of `components.id` for UUID-based lookups. Update all ORM queries, child table inserts, and JOIN conditions.*

**What was done** (verified via commits above):

1. All ORM queries updated to use `eq(components.cuuid, ...)` instead of `eq(components.id, ...)`
2. All child table inserts now store `component.cuuid` as the `component_id` value
3. All JOIN conditions updated to join on `components.cuuid`
4. `createComponent()` no longer sets `id` manually — the SERIAL column auto-generates it
5. COMP-xxx ID generation removed from all 4 component creation paths
6. Upload services (bulk import) updated to map the 'Component ID' spreadsheet column to `componentCode` field (not `id`)

---

### Task 7: Convert `components.id` from TEXT to SERIAL INTEGER
**Date**: 2026-02-12 ~06:49  
**Migration**: `0022_auto_2026-02-12T06-49-00.sql`  
**Commits**:
- `911e6cd7` — *Update component IDs to use auto-incrementing integers*
- `559024be` — *Update component identification system to use auto-incrementing integers*

**Prompt**: *Convert components.id from TEXT to INTEGER SERIAL PRIMARY KEY, following the same pattern as vessels migration 0014. This is safe because all 15 FK constraints reference components(cuuid), not components(id).*

**What was done**:
1. Updated `shared/schema.ts` — changed `id` from `text("id")` to `serial("id").primaryKey()`
2. Updated `shared/v2/components/schema.ts` — same change
3. Generated migration `0022`:
   ```sql
   -- Phase: Convert components.id from TEXT to INTEGER auto-increment
   -- Safe because: All 15 FK constraints reference components(cuuid), NOT components(id)
   -- All server/frontend code uses components.cuuid for UUID lookups (cuuid migration complete)
   -- Pattern follows vessels migration 0014

   -- Step 1: Drop primary key constraint on old TEXT id column
   ALTER TABLE "components" DROP CONSTRAINT "components_pkey";

   -- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
   ALTER TABLE "components" DROP COLUMN "id";

   -- Step 3: Add new SERIAL id column as primary key
   ALTER TABLE "components" ADD COLUMN "id" SERIAL PRIMARY KEY;
   ```

**Result**: `components.id` is now an auto-incrementing integer. Existing rows received sequential integer IDs. The old COMP-xxx TEXT values are gone.

---

### Task 8: Fix Frontend for Integer `id`
**Date**: 2026-02-12 ~06:55  
**Commit**: `559024be` — *Update component identification system to use auto-incrementing integers* (same session as Task 7)  
**Prompt**: *Update frontend component interfaces and SelectItem values to handle the new integer id type.*

**What was done**:
1. `component.id` type changed from `string` to `number` across frontend interfaces
2. `SelectItem` values updated to use `String(component.id)` for string conversion
3. Both `id` and `cuuid` omitted from insert schemas (both are auto-generated)

---

### Task 9: Fix Bulk Upload Service for New Schema
**Date**: 2026-02-12 ~07:00  
**Commit**: `b52ac4c2` — *Improve bulk component uploading by using unique identifiers*  
**Prompt**: *Fix the bulk upload service — it's still using `components.id` for lookups and trying to insert UUID strings into the now-SERIAL id column.*

**What was done**:
1. **`bulkRepository.ts`**: `getComponent`, `updateComponent`, and `archiveComponent` methods switched from `eq(bulkComponents.id, ...)` to `eq(bulkComponents.cuuid, ...)`
2. **`bulkImportService.ts`**:
   - Archive and update operations now pass `comp.cuuid` / `existing.cuuid` instead of `comp.id` / `existing.id`
   - Change log entries use `cuuid` as `entityId`
   - `createComponentFromRow` no longer sets `id: uuidv4()` (removed the assignment — `id` is now auto-generated SERIAL)
   - `updateComponentFromRow` parameter renamed to `cuuid` for clarity

---

## Complete FK Constraint Summary

All 15 child tables' `component_id` columns reference `components(cuuid)` with ON DELETE RESTRICT, ON UPDATE CASCADE.

| #  | Child Table                     | Migration | NOT NULL | Constraint Name |
|----|---------------------------------|-----------|----------|-----------------|
| 1  | running_hours_audit             | 0018      | No       | running_hours_audit_component_id_components_cuuid_fk |
| 2  | spares                          | 0018      | No       | spares_component_id_components_cuuid_fk |
| 3  | spares_history                  | 0018      | No       | spares_history_component_id_components_cuuid_fk |
| 4  | component_class_regulatory      | 0019      | No       | component_class_regulatory_component_id_components_cuuid_fk |
| 5  | component_documents             | 0019      | No       | component_documents_component_id_components_cuuid_fk |
| 6  | component_maintenance_history   | 0019      | No       | component_maintenance_history_component_id_components_cuuid_fk |
| 7  | component_requisitions          | 0019      | No       | component_requisitions_component_id_components_cuuid_fk |
| 8  | component_running_hours_log     | 0019      | No       | component_running_hours_log_component_id_components_cuuid_fk |
| 9  | defects                         | 0019      | No       | defects_component_id_components_cuuid_fk |
| 10 | job_component_links             | 0019      | No       | job_component_links_component_id_components_cuuid_fk |
| 11 | spare_component_links           | 0019      | No       | spare_component_links_component_id_components_cuuid_fk |
| 12 | work_order_executions           | 0019      | No       | work_order_executions_component_id_components_cuuid_fk |
| 13 | jobs                            | 0020      | Yes      | jobs_component_id_components_cuuid_fk |
| 14 | fleet_component_mapping         | 0021      | Yes      | fleet_component_mapping_component_id_components_cuuid_fk |
| 15 | ihm_items                       | 0021      | No       | ihm_items_component_id_components_cuuid_fk |

---

## Current Components Table Structure

| Column          | Type      | Constraints                        | Description                                    |
|-----------------|-----------|------------------------------------|------------------------------------------------|
| `id`            | INTEGER   | PRIMARY KEY, SERIAL (auto-increment) | Internal database identifier (1, 2, 3...)      |
| `cuuid`         | TEXT      | NOT NULL, UNIQUE                   | Canonical UUID identity column                 |
| `vessel_id`     | TEXT      | NOT NULL, FK → vessels(vuuid)      | Vessel association                             |
| `component_code`| TEXT      | NOT NULL                           | Component code (SFI-based identifier)          |
| `name`          | TEXT      | NOT NULL                           | Component display name                         |
| `description`   | TEXT      | NULLABLE                           | Component description                          |
| `parent_id`     | TEXT      | NULLABLE                           | Parent component cuuid (self-reference)        |
| `maker_id`      | TEXT      | NULLABLE                           | Maker association                              |
| `model`         | TEXT      | NULLABLE                           | Model information                              |
| `serial_number` | TEXT      | NULLABLE                           | Serial number                                  |
| `is_running_hours_driven` | TEXT | NULLABLE                       | Running hours tracking type                    |
| `running_hours` | NUMERIC   | NULLABLE                           | Current running hours                          |
| `is_active`     | BOOLEAN   | NOT NULL, DEFAULT true             | Active status                                  |
| `created_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Creation timestamp                             |
| `updated_at`    | TIMESTAMP | NOT NULL, DEFAULT now()            | Last update timestamp                          |

### Key Identity Rules

- **`id` (INTEGER SERIAL)**: Auto-generated internal identifier. Never set manually. Never referenced by any child table.
- **`cuuid` (TEXT UNIQUE)**: The canonical UUID identity. All 15 child tables reference this column via their `component_id` foreign key. This is the value used throughout server code for component identification.

---

## Critical Rules for Future Component Migrations

### 1. Never Change the `id` Column Type
The `components.id` column is now `INTEGER SERIAL PRIMARY KEY`. Do not change it back to TEXT or any other type. Changing primary key column types generates destructive ALTER TABLE statements that break existing data.

### 2. Never Change the `cuuid` Column Type
The `components.cuuid` column is `TEXT NOT NULL UNIQUE`. All 15 child tables depend on it via foreign keys. Changing its type would require simultaneously migrating all 15 child tables.

### 3. Child Tables Reference `cuuid`, Not `id`
All child table `component_id` columns are **TEXT** and reference `components(cuuid)`. They do **not** reference `components(id)`.

### 4. Adding a New Child Table with `component_id`
```sql
CREATE TABLE new_table (
    id SERIAL PRIMARY KEY,
    component_id TEXT NOT NULL REFERENCES components(cuuid) ON DELETE RESTRICT ON UPDATE CASCADE,
    -- other columns...
);
```

In Drizzle schema:
```typescript
export const newTable = pgTable("new_table", {
    id: serial("id").primaryKey(),
    componentId: text("component_id").notNull().references(() => components.cuuid),
    // other columns...
});
```

### 5. Inserting New Components
- **Do NOT supply `id`** — it is auto-generated by the SERIAL sequence
- **Do NOT supply `cuuid`** — it is auto-generated by `gen_random_uuid()::text`

```sql
INSERT INTO components (vessel_id, component_code, name)
VALUES ('vessel-uuid', '5.1.1', 'Main Engine');
-- id and cuuid will be auto-assigned
```

### 6. Server-Side Query Patterns
```typescript
// Correct: use cuuid for UUID lookups
const comp = await db.select().from(components).where(eq(components.cuuid, uuidValue));

// Wrong: never use components.id for UUID lookups
// const comp = await db.select().from(components).where(eq(components.id, uuidValue));

// Correct: child table inserts use cuuid
await db.insert(spares).values({ componentId: component.cuuid, ... });

// Correct: JOINs use cuuid
const result = await db.select().from(jobs)
    .innerJoin(components, eq(jobs.componentId, components.cuuid));
```

---

## Migration File Reference

| Migration | Date | Description |
|-----------|------|-------------|
| `0016_populate_components_cuuid.sql` | 2026-02-11 | Populate cuuid with UUIDs, set NOT NULL + UNIQUE |
| `0017_auto_2026-02-11T10-37-52.sql` | 2026-02-11 | Drizzle-generated: enforce cuuid NOT NULL + UNIQUE |
| `0018_auto_2026-02-11T11-38-06.sql` | 2026-02-11 | FK constraints: running_hours_audit, spares, spares_history |
| `0019_auto_2026-02-11T11-38-46.sql` | 2026-02-11 | FK constraints: 9 child tables (component_*, defects, job_component_links, spare_component_links, work_order_executions) |
| `0020_auto_2026-02-11T11-49-18.sql` | 2026-02-11 | FK constraint: jobs (with NOT NULL) |
| `0021_auto_2026-02-12T06-26-18.sql` | 2026-02-12 | FK constraints: fleet_component_mapping (NOT NULL), ihm_items |
| `0022_auto_2026-02-12T06-49-00.sql` | 2026-02-12 | Convert id from TEXT to INTEGER SERIAL PRIMARY KEY |

---

## Relationship to Vessel Migration

This component migration follows the exact same pattern established by the vessel identity restructure (migrations 0008-0014):

| Step | Vessel Migration | Component Migration |
|------|-----------------|---------------------|
| Add UUID column | `vuuid` added in 0008 | `cuuid` added in 0016 |
| FK constraints to UUID | 31 child tables in 0009-0013 | 15 child tables in 0018-0021 |
| Server code refactor | All queries → `eq(vessels.vuuid, ...)` | All queries → `eq(components.cuuid, ...)` |
| Convert id to SERIAL | Migration 0014 | Migration 0022 |
| FK policy | ON DELETE NO ACTION, ON UPDATE NO ACTION | ON DELETE RESTRICT, ON UPDATE CASCADE |

The component migration used stricter FK policies (RESTRICT/CASCADE vs NO ACTION) to prevent orphaned child records and automatically propagate cuuid updates.
