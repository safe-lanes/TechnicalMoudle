# Jobs Identity Restructure - Migration Guide

> Complete chronological record of every prompt-based task step executed during the jobs identity migration. This migration converted `jobs.id` from TEXT (JOB-xxx format) to SERIAL INTEGER, introduced `jobs.juuid` as the canonical UUID identity, and established DB-level FK constraints across all 4 child tables. Pattern follows the proven vessel migration (migrations 0008-0014) and component migration (migrations 0016-0022).

---

## Migration Summary

| Before | After |
|--------|-------|
| `jobs.id` = TEXT PRIMARY KEY (JOB-xxx / FJ-xxx format) | `jobs.id` = INTEGER SERIAL PRIMARY KEY (auto-increment) |
| No UUID column | `jobs.juuid` = TEXT NOT NULL UNIQUE (canonical UUID identity) |
| No FK constraints on child tables | 4 child tables have DB-level FK constraints to `jobs(juuid)` |
| Server code used `jobs.id` (TEXT) for lookups | Server code uses `eq(jobs.juuid, ...)` for all lookups |
| JOB-xxx / FJ-xxx ID generated in 4 creation paths | `id` auto-generated, JOB-xxx / FJ-xxx generation removed |
| Frontend used `job.id` for navigation, keys, API calls | Frontend uses `job.juuid` for navigation URLs, React keys, data-testid, API calls |

---

## Chronological Task Steps (Prompt-by-Prompt)

### Task 1: Add `juuid` Column to Jobs Table
**Date**: 2026-02-13 ~06:30  
**Migration**: `0025_auto_2026-02-13T06-30-46.sql`  
**Commit**: `bf8ae0db` — *Add a unique identifier column to the jobs table*  
**Prompt**: *Add a `juuid` TEXT column to the jobs table. Populate it with UUIDs for all existing rows using `gen_random_uuid()`. Make it NOT NULL and UNIQUE. Use the safe backfill pattern (nullable → populate → NOT NULL → UNIQUE).*

**What was done**:
1. Added `juuid` column definition to `shared/schema.ts` (TEXT, NOT NULL, UNIQUE)
2. Added `juuid` column definition to `shared/v2/components/schema.ts`
3. Created migration `0025_auto_2026-02-13T06-30-46.sql` with safe backfill pattern:
   ```sql
   -- Step 1: Add column as nullable first (safe for tables with existing rows)
   ALTER TABLE "jobs" ADD COLUMN "juuid" text;

   -- Step 2: Backfill existing rows with generated UUIDs
   UPDATE "jobs" SET "juuid" = gen_random_uuid()::text WHERE "juuid" IS NULL;

   -- Step 3: Set NOT NULL constraint after all rows have values
   ALTER TABLE "jobs" ALTER COLUMN "juuid" SET NOT NULL;

   -- Step 4: Add UNIQUE constraint
   ALTER TABLE "jobs" ADD CONSTRAINT "jobs_juuid_unique" UNIQUE("juuid");
   ```

**Files changed**: `shared/schema.ts`, `shared/v2/components/schema.ts`, migration file + snapshot + journal

**Result**: Every existing job row now has a unique UUID in `juuid`. The old `id` TEXT column (JOB-xxx format) still exists at this point.

---

### Task 2: Add FK Constraints — All 4 Child Tables
**Date**: 2026-02-13 ~06:40  
**Migration**: `0026_auto_2026-02-13T06-40-04.sql`  
**Commit**: `a2a1cd31` — *Add foreign key constraints linking jobs to related work order tables*  
**Prompt**: *Add foreign key constraints from child tables' `job_id` columns to `jobs(juuid)`. Cover all 4 child tables: work_orders, job_component_links, component_maintenance_history, fleet_job_vessel_mapping.*

**What was done**:
1. Updated Drizzle schema references in `shared/schema.ts` for all 4 tables
2. Updated V2 schema references in `shared/v2/components/schema.ts` and `shared/v2/work-orders/schema.ts`
3. Generated migration `0026`:
   ```sql
   ALTER TABLE "component_maintenance_history" ADD CONSTRAINT "component_maintenance_history_job_id_jobs_juuid_fk"
     FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("juuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "fleet_job_vessel_mapping" ADD CONSTRAINT "fleet_job_vessel_mapping_job_id_jobs_juuid_fk"
     FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("juuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "job_component_links" ADD CONSTRAINT "job_component_links_job_id_jobs_juuid_fk"
     FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("juuid") ON DELETE no action ON UPDATE no action;
   ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_job_id_jobs_juuid_fk"
     FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("juuid") ON DELETE no action ON UPDATE no action;
   ```

**Files changed**: `shared/schema.ts`, `shared/v2/components/schema.ts`, `shared/v2/work-orders/schema.ts`, migration file + snapshot + journal

**Child tables constrained**: component_maintenance_history, fleet_job_vessel_mapping, job_component_links, work_orders

---

### Task 3: Refactor All Server & Frontend Code — Switch from `jobs.id` to `jobs.juuid`
**Date**: 2026-02-13 ~07:00 to ~07:18  
**Commits**:
- `16c996c0` (2026-02-13 07:12) — *Update job identification to use UUIDs instead of sequential IDs*
- `83248f4e` (2026-02-13 07:18) — *Update job identifiers to use juuid format across the application*

**Prompt**: *Refactor all server-side and frontend code to use `jobs.juuid` instead of `jobs.id` for UUID-based lookups. Update all ORM queries, child table inserts, JOIN conditions, API routes, frontend navigation, React keys, and data-testid attributes. Generate `juuid` via `crypto.randomUUID()` in all job creation paths.*

**What was done** (7 server files + 7 frontend files in Commit `16c996c0`, then 2 server files in Commit `83248f4e`):

**Server-side changes (Commit `16c996c0`)**:
1. **`server/postgresStorage.ts`** — All ORM queries updated to use `eq(jobs.juuid, ...)` instead of `eq(jobs.id, ...)`. All job CRUD operations (getJob, updateJob, deleteJob, archiveJob, getFleetJob) query by `juuid`. All child table inserts store `job.juuid` in `job_id` columns. `createJob()` generates `juuid` via `crypto.randomUUID()`.
2. **`server/memStorage.ts`** — In-memory storage updated to use `juuid` for all job lookups and CRUD operations
3. **`server/routes.ts`** — Route handlers updated to pass/receive `juuid` for job identity
4. **`server/routes/bulk.ts`** — Bulk upload logic uses `juuid` for job-component links, change tracking, and auto-resolving
5. **`server/services/jobDueScanner.ts`** — Job due scanner uses `job.juuid` for WO matching and linking
6. **`server/services/workOrderService.ts`** — Work order service uses `job.juuid` for identity
7. **`server/v2/bulk/repositories/bulkRepository.ts`** — V2 bulk repository updated to use `juuid`

**Frontend changes (Commit `16c996c0`)**:
1. **`client/src/components/ComponentRegisterAddEdit.tsx`** — Uses `job.juuid` for data binding
2. **`client/src/pages/admin/FleetDataView.tsx`** — Uses `job.juuid` for React keys and navigation
3. **`client/src/pages/admin/FleetEquipmentTreeView.tsx`** — Uses `job.juuid` for tree node identity
4. **`client/src/pages/admin/FleetJobForm.tsx`** — Uses `job.juuid` for form data
5. **`client/src/pages/admin/FleetJobsManagement.tsx`** — Uses `job.juuid` for table rows and actions
6. **`client/src/pages/modify-pms/JobsSelector.tsx`** — Uses `job.juuid` for selection state
7. **`client/src/pages/pms/Components.tsx`** — Uses `job.juuid` for job list rendering

**Fix for 13 missed `.id` references (Commit `83248f4e`)**:
- **`server/routes.ts`** — 5 additional `.id` references fixed (work order auto-resolve/backfill paths)
- **`server/routes/bulk.ts`** — 8 additional `.id` references fixed (bulk upload job matching, change log tracking, auto-resolve logic)

**Result**: All server and frontend code now uses `jobs.juuid` exclusively for job identity. `jobs.id` is no longer referenced for lookups, linking, or navigation anywhere in the codebase.

---

### Task 4: Convert `jobs.id` from TEXT to SERIAL INTEGER
**Date**: 2026-02-13 ~07:25  
**Migration**: `0027_auto_2026-02-13T07-25-26.sql`  
**Commit**: `6d16c6b0` — *Update job ID to use auto-incrementing integers*  
**Prompt**: *Convert `jobs.id` from TEXT to INTEGER SERIAL PRIMARY KEY. This is safe because all 4 FK constraints reference `jobs(juuid)`, not `jobs(id)`. Remove all JOB-xxx / FJ-xxx ID generation code from server creation paths. Follow the proven pattern from vessels migration 0014 and components migration 0022.*

**What was done**:
1. Updated `shared/schema.ts` — changed `id` from `text("id").primaryKey()` to `serial("id").primaryKey()`
2. Updated `shared/v2/components/schema.ts` — same change
3. Updated `shared/v2/jobs/schema.ts` — insert schema updated to omit `id` (auto-generated)
4. Generated migration `0027`:
   ```sql
   -- Phase: Convert jobs.id from TEXT to INTEGER auto-increment
   -- Safe because: All 4 FK constraints reference jobs(juuid), NOT jobs(id)
   -- All server/frontend code uses jobs.juuid for UUID lookups (juuid migration complete)
   -- Pattern follows vessels migration 0014 and components migration 0022

   -- Step 1: Drop primary key constraint on old TEXT id column
   ALTER TABLE "jobs" DROP CONSTRAINT "jobs_pkey";

   -- Step 2: Drop the old TEXT id column (no longer referenced by any FK or code)
   ALTER TABLE "jobs" DROP COLUMN "id";

   -- Step 3: Add new SERIAL id column as primary key
   ALTER TABLE "jobs" ADD COLUMN "id" SERIAL PRIMARY KEY;
   ```
5. Removed JOB-xxx / FJ-xxx ID generation from 4 server creation paths:
   - **`server/postgresStorage.ts` — `createJob()`**: Removed `id: \`JOB-${...}\`` generation, `id` now omitted from insert (auto-generated by SERIAL)
   - **`server/postgresStorage.ts` — `bulkCreateJobs()`**: Removed `id: \`JOB-${...}\`` generation from bulk insert
   - **`server/postgresStorage.ts` — `bulkUpsertJobs()`**: Removed `id: \`JOB-${...}\`` generation from upsert path
   - **`server/postgresStorage.ts` — `createFleetJob()`**: Removed `id: \`FJ-${...}\`` generation for fleet jobs
6. **`server/v2/jobs/repositories/jobRepository.ts`**: Removed unused `uuid` import (no longer needed since `id` is auto-generated)

**Files changed**: `shared/schema.ts`, `shared/v2/components/schema.ts`, `shared/v2/jobs/schema.ts`, `server/postgresStorage.ts`, `server/v2/jobs/repositories/jobRepository.ts`, `replit.md`, migration file + snapshot + journal

**Result**: `jobs.id` is now an auto-incrementing integer. Existing rows received sequential integer IDs. The old TEXT JOB-xxx / FJ-xxx values in `id` are gone. All job identity is handled via `juuid`.

---

### Task 5: Fix V2 Bulk Import — Pass UUID as `juuid`, Not `id`
**Date**: 2026-02-13 ~09:20  
**Commit**: `c29846f9` — *Correctly handle job identifiers in bulk import process*  
**Prompt**: *Fix the V2 bulk import service which was still passing a UUID string as `id` (now SERIAL integer) when creating jobs via `createJob()`. This caused all bulk job imports to fail with a type mismatch error (`invalid input syntax for type integer`) because a UUID string cannot be inserted into a SERIAL integer column.*

**What was done** (1 file: `server/v2/bulk/services/bulkImportService.ts`):

1. **`createJobAndLink()` function (line 392)**: Changed `this.repository.createJob({ id: jobId, ...jobData })` → `this.repository.createJob({ juuid: jobId, ...jobData })`. The generated UUID must be passed as `juuid` (the canonical UUID column), not `id` (now SERIAL auto-increment).
2. **Add mode path (lines 434, 444)**: Changed variable name from `const id = uuidv4()` → `const juuid = uuidv4()` and changed change log tracking from `entityId: id` → `entityId: created.juuid` to use the actual returned juuid from the database.
3. **Upsert mode path (lines 493, 503)**: Same fix applied — `const id = uuidv4()` → `const juuid = uuidv4()` and `entityId: id` → `entityId: created.juuid`.

**Root cause**: The V2 bulk import service (`bulkImportService.ts`) was written before the `jobs.id` column was converted from TEXT to SERIAL in migration 0027. After the conversion, the `createJob()` call was passing a UUID string as `id`, which PostgreSQL rejected because `id` is now an integer column. The fix ensures UUIDs are routed to the `juuid` column and `id` is left for auto-generation by the SERIAL sequence.

**Files changed**: `server/v2/bulk/services/bulkImportService.ts`

**Result**: V2 bulk job imports now work correctly. UUIDs go into `juuid`, `id` is auto-generated, and import change logs correctly track the `juuid` as the entity identifier.

---

## Complete FK Constraint Summary (All 4 Tables)

All 4 child tables' `job_id` columns reference `jobs(juuid)` with ON DELETE NO ACTION, ON UPDATE NO ACTION.

| #  | Child Table                    | Migration | Constraint Name                                              |
|----|--------------------------------|-----------|--------------------------------------------------------------|
| 1  | component_maintenance_history  | 0026      | component_maintenance_history_job_id_jobs_juuid_fk           |
| 2  | fleet_job_vessel_mapping       | 0026      | fleet_job_vessel_mapping_job_id_jobs_juuid_fk                |
| 3  | job_component_links            | 0026      | job_component_links_job_id_jobs_juuid_fk                     |
| 4  | work_orders                    | 0026      | work_orders_job_id_jobs_juuid_fk                             |

---

## Current Jobs Table Structure

| Column                   | Type      | Constraints                          | Description                                     |
|--------------------------|-----------|--------------------------------------|-------------------------------------------------|
| `id`                     | INTEGER   | PRIMARY KEY, SERIAL (auto-increment) | Internal database identifier (1, 2, 3...)       |
| `juuid`                  | TEXT      | NOT NULL, UNIQUE                     | Canonical UUID identity column                  |
| `vessel_id`              | TEXT      | NULLABLE, FK → vessels(vuuid)        | Vessel association                              |
| `component_id`           | TEXT      | NOT NULL                             | Component UUID reference                        |
| `component_code`         | TEXT      | NULLABLE                             | Component code (display)                        |
| `component_name`         | TEXT      | NULLABLE                             | Component name (display)                        |
| `job_no`                 | TEXT      | NOT NULL                             | Job number (display identifier)                 |
| `job_title`              | TEXT      | NOT NULL                             | Job title                                       |
| `assigned_to`            | TEXT      | NULLABLE                             | Assigned user                                   |
| `maintenance_type`       | TEXT      | NULLABLE                             | Type of maintenance                             |
| `maintenance_basis`      | TEXT      | NULLABLE                             | Basis for maintenance (calendar/RH)             |
| `frequency_type`         | TEXT      | NULLABLE                             | Frequency type                                  |
| `frequency_value`        | TEXT      | NULLABLE                             | Frequency value                                 |
| `frequency_unit`         | TEXT      | NULLABLE                             | Frequency unit                                  |
| `interval_running_hour`  | INTEGER   | NULLABLE                             | Running hour interval                           |
| `lead_time_value`        | INTEGER   | NULLABLE                             | Lead time value                                 |
| `lead_time_unit`         | TEXT      | NULLABLE                             | Lead time unit                                  |
| `initial_next_due`       | TEXT      | NULLABLE                             | Initial next due date                           |
| `last_done_date`         | TEXT      | NULLABLE                             | Last done date                                  |
| `next_due_date`          | TEXT      | NULLABLE                             | Next due date                                   |
| `last_done_rh`           | TEXT      | NULLABLE                             | Last done running hours                         |
| `next_due_rh`            | TEXT      | NULLABLE                             | Next due running hours                          |
| `job_priority`           | TEXT      | NULLABLE                             | Job priority level                              |
| `class_related`          | TEXT      | NULLABLE                             | Class-related flag                              |
| `brief_work_description` | TEXT      | NULLABLE                             | Brief description of work                       |
| `job_description`        | TEXT      | NULLABLE                             | Full job description                            |
| `approver`               | TEXT      | NULLABLE                             | Approver                                        |
| `department`             | TEXT      | NULLABLE                             | Department                                      |
| `required_spare_parts`   | JSON      | NOT NULL, DEFAULT '[]'               | Required spare parts list                       |
| `required_tools`         | JSON      | NOT NULL, DEFAULT '[]'               | Required tools list                             |
| `safety_requirements`    | JSON      | NOT NULL, DEFAULT '{...}'            | Safety requirements (PPE, permits, other)       |
| `data_scope`             | TEXT      | NOT NULL, DEFAULT 'vessel'           | Data scope (vessel/fleet)                       |
| `fleet_equipment_code`   | TEXT      | NULLABLE                             | Fleet equipment code                            |
| `fleet_job_code`         | TEXT      | NULLABLE                             | Fleet job code                                  |
| `sfi_code`               | TEXT      | NULLABLE                             | SFI classification code                         |
| `criticality`            | TEXT      | NULLABLE                             | Criticality level                               |
| `is_active`              | BOOLEAN   | DEFAULT true                         | Active status                                   |
| `estimated_man_hours`    | NUMERIC   | NULLABLE                             | Estimated man hours                             |
| `created_by`             | TEXT      | NULLABLE                             | Creator                                         |
| `created_at`             | TIMESTAMP | NOT NULL, DEFAULT now()              | Creation timestamp                              |
| `updated_by`             | TEXT      | NULLABLE                             | Last updater                                    |
| `updated_at`             | TIMESTAMP | NOT NULL, DEFAULT now()              | Last update timestamp                           |

---

## Rules for Future Migrations Involving the Jobs Table

1. **Never reference `jobs.id`** for identity or linking. Always use `jobs.juuid`.
2. **Child table `job_id` columns** store the UUID from `jobs.juuid`, not the integer from `jobs.id`.
3. **New child tables** that reference jobs must add FK constraint: `FOREIGN KEY ("job_id") REFERENCES "jobs"("juuid")`.
4. **Insert operations** must never set `id` — it is auto-generated by the SERIAL sequence.
5. **Insert operations** must always set `juuid` via `crypto.randomUUID()` (or `uuidv4()`).
6. **ORM queries** must use `eq(jobs.juuid, value)` for lookups, never `eq(jobs.id, value)`.
7. **Frontend navigation** must use `job.juuid` for URLs, React keys, and API calls.
8. **Bulk import / batch creation** must pass the generated UUID as `juuid` in the insert object, never as `id`. Passing a UUID string as `id` will fail because `id` is now a SERIAL integer column. (See Task 5 for the fix applied to V2 bulk import.)

---

## Migration Pattern Reference

This jobs migration followed the same proven 4-phase pattern used for vessels (0008-0014), components (0016-0022), and now work orders (0028-0030+):

| Phase | Vessel Migration | Component Migration | Jobs Migration | Work Orders Migration |
|-------|-----------------|--------------------|--------------------|----------------------|
| 1. Add UUID column with backfill | 0008 (vuuid) | 0016-0017 (cuuid) | 0025 (juuid) | 0028 (wouuid) |
| 2. Add FK constraints to child tables | 0009-0013 (31 tables) | 0018-0021 (15 tables) | 0026 (4 tables) | 0029-0030 (4 tables) |
| 3. Refactor server/frontend code | Multiple commits | Multiple commits | `16c996c0`, `83248f4e` | PENDING |
| 4. Convert id TEXT → SERIAL | 0014 | 0022 | 0027 | PENDING |
| Total child tables constrained | 43 (including 0024) | 15 | 4 | 4 |

> See `docs/work-order-migration-guide.md` for the complete work orders migration guide.
