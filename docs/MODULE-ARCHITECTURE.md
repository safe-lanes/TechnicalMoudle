# Backend Module Architecture

**Last updated:** 2026-05-10

## Overview

The backend has undergone two major restructuring phases:

1. **Modularization** — Monolithic `server/routes.ts` (21,144 lines) decomposed into 18 domain modules under `server/modules/`
2. **FK Identity Restructure** — All major tables migrated from integer PKs to UUID identifiers with 72 enforced FK constraints

## Refactoring Impact

| Metric | Before | After |
|--------|--------|-------|
| `server/routes.ts` lines | 21,144 | 843 |
| Module files | 0 | 121 |
| Total module lines | 0 | 35,116 |
| Total endpoints | 339 | 339 |
| UUID-based FK constraints | 0 | 72 |
| Custom SQL migrations | 26 | 51 |
| Parent tables with UUID identity | 0 | 12 |

---

## Part 1: Module Architecture

### Module Registry

All modules are registered in `server/modules/index.ts` and mounted at `/technical/api` via `moduleRouter`.

| # | Module | Files | Lines | Endpoints | Description |
|---|--------|-------|-------|-----------|-------------|
| 1 | vessels | 5 | 540 | 17 | Vessel CRUD, fleet registry, PMS settings |
| 2 | components | 10 | 1,474 | 31 | Component tree, sub-entities, documents |
| 3 | jobs | 6 | 1,229 | 10 | Job CRUD, maintenance planner, context |
| 4 | work-orders | 9 | 2,441 | 17 | WO lifecycle, execution, completion, bulk ops |
| 5 | running-hours | 5 | 1,055 | 13 | RH tracking, parent/child cascade, config |
| 6 | spares | 8 | 1,692 | 38 | Spare parts, inventory, location stock |
| 7 | stores | 4 | 517 | 11 | Stores requisitions and ledger |
| 8 | defects | 7 | 1,279 | 35 | Defect management, recurring analysis, admin |
| 9 | cert-surveys | 13 | 2,546 | 24 | Certificates, surveys, admin config |
| 10 | fleet | 7 | 2,965 | 31 | Fleet-wide ops, master lists, vessel mappings |
| 11 | reports | 18 | 9,797 | 43 | All report types (maintenance, spares, compliance, etc.) |
| 12 | change-requests | 4 | 419 | 12 | Change request workflow |
| 13 | bulk-upload | 9 | 7,750 | 26 | Excel/CSV import, validation, undo |
| 14 | alerts | 4 | 299 | 10 | Alert policies, events, notifications |
| 15 | forms | 4 | 299 | 10 | Form definitions, versioning, runtime |
| 16 | chatbot | 2 | 59 | 1 | AI chatbot integration |
| 17 | misc | 3 | 637 | 10 | Document storage, admin utilities |
| 18 | dashboard | - | - | - | Dashboard metrics |
| | **shared** | 2 | 77 | - | `asyncHandler` middleware, `AppError` class |

### Layer Structure

Each module follows a 4-layer architecture:

```
server/modules/<module>/
  routes.ts            # Express Router — wires HTTP verbs to controllers
  controllers/         # HTTP layer — parse req, call service, send res
  services/            # Business logic — no HTTP objects (req/res)
  repositories/        # Data access — wraps storage.* calls
```

#### Layer Rules

1. **Routes** (`routes.ts`)
   - Defines Express routes using `router.get/post/put/patch/delete`
   - Wraps controllers with `asyncHandler` for error handling
   - Applies middleware (auth, multer, etc.)
   - No business logic

2. **Controllers** (`controllers/*.ts`)
   - Accept `(req: Request, res: Response)` or `(req: AuthenticatedRequest, res: Response)`
   - Extract params/body/query from request
   - Call service methods
   - Return JSON responses with appropriate status codes
   - No direct `storage.*` calls
   - **ID params are UUID strings** — no `parseInt()` on entity IDs

3. **Services** (`services/*.ts`)
   - Pure business logic functions
   - No `Request`/`Response` imports
   - Call repository methods for data access
   - Throw `AppError` for domain errors
   - May call other services within the same module

4. **Repositories** (`repositories/*.ts`)
   - Thin wrappers around `storage.*` methods
   - Import `storage` from `../../storage` (relative to module root)
   - No business logic, just data access delegation

#### Exception: Simpler Modules

Some smaller modules (chatbot, misc) skip the repository layer when the service layer directly delegates to existing services or the operations are simple enough.

### Shared Infrastructure

| File | Purpose |
|------|---------|
| `server/modules/shared/middleware.ts` | `asyncHandler` — catches errors from async controllers |
| `server/modules/shared/errors.ts` | `AppError` class with statusCode for HTTP error responses |
| `server/modules/index.ts` | Module router registry — all modules registered here |

### What Remains in routes.ts

`server/routes.ts` now contains only:

1. **Server setup** — `registerRoutes()` function
2. **Middleware** — `mockAuthMiddleware`, immutability check
3. **Module mount** — `app.use('/technical/api', moduleRouter)`
4. **Non-API endpoint** — `/download/docs/:filename` (outside `/technical/api`)
5. **Schedulers** — JobDueScanner, WorkOrderStatusRecalculator
6. **Dev seed endpoints** — `/dev/seed/recurring-defects` (development only)
7. **Startup backfill tasks** — job nextDueDate/RH, maintenance history, postponement checks
8. **Server lifecycle** — HTTP server creation, shutdown handlers

### Dependency Flow

```
routes.ts
  └── modules/index.ts (moduleRouter)
        └── <module>/routes.ts
              └── <module>/controllers/*.ts
                    └── <module>/services/*.ts
                          └── <module>/repositories/*.ts
                                └── server/storage.ts (IStorage interface)
                                      └── server/postgresStorage.ts (implementation)
```

Cross-module dependencies:
- Modules do NOT import from each other
- All data access goes through `storage` (IStorage interface)
- Shared utilities (`@shared/*`) are used for date/status calculations
- Auth middleware (`server/middleware/auth.ts`) is shared across modules

---

## Part 2: FK Identity Restructure

### Why UUIDs

All major entity tables previously used auto-incrementing integer primary keys. These were replaced with UUID-based identity columns to:

- Enable globally unique identifiers across environments
- Support future multi-tenant and cross-service architectures
- Enforce referential integrity at the database level (previously only application-level)
- Decouple identity from insertion order

### UUID Column Naming Convention

Each parent table has a dedicated UUID column following the pattern `<abbreviation>uuid`:

| Table | UUID Column | Type | Constraints |
|-------|-------------|------|-------------|
| `vessels` | `vuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `components` | `cuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `jobs` | `juuid` | `TEXT` | `NOT NULL UNIQUE` |
| `work_orders` | `wouuid` | `TEXT` | `NOT NULL UNIQUE` |
| `spares` | `suuid` | `TEXT` | `NOT NULL UNIQUE` |
| `stores_items` | `stuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `defects` | `duuid` | `TEXT` | `NOT NULL UNIQUE` |
| `alert_policies` | `apuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `alert_events` | `aeuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `form_definitions` | `fduuid` | `TEXT` | `NOT NULL UNIQUE` |
| `form_versions` | `fvuuid` | `TEXT` | `NOT NULL UNIQUE` |
| `bulk_import_history` | `biuuid` | `TEXT` | `NOT NULL UNIQUE` |

### FK Constraint Summary (72 total)

```
vessels.vuuid          ← 33 child FKs (components, jobs, work_orders, spares, stores_items,
                         defects, inventory_transactions, spare_location_stock, running_hours,
                         running_hours_log, report_snapshots, ship_certificates, drydock_projects,
                         drydock_tasks, spare_component_links, alert_config, alert_events,
                         certificates, change_request, defect_sequences, ihm_items,
                         ihm_maintenance_log, import_history, job_component_links, locations,
                         pms_vessel_settings, running_hours_audit, spares_history, stores_ledger,
                         surveys, users, vessel_certificate_*, vessel_survey_*, work_order_*)

components.cuuid       ← 15 child FKs (jobs, spares, spare_component_links, defects,
                         component_documents, component_class_regulatory,
                         component_maintenance_history, component_requisitions,
                         component_running_hours_log, fleet_component_mapping,
                         ihm_items, job_component_links, running_hours_audit,
                         spares_history, work_order_executions)

work_orders.wouuid     ←  5 child FKs
jobs.juuid             ←  4 child FKs
spares.suuid           ←  4 child FKs
defects.duuid          ←  3 child FKs
alert_policies.apuuid  ←  1 child FK
alert_events.aeuuid    ←  1 child FK
form_definitions.fduuid ← 1 child FK
form_versions.fvuuid   ←  1 child FK
stores_items.stuuid    ←  1 child FK
bulk_import_history.biuuid ← 1 child FK
```

### Two Migration Patterns Used

**Pattern A: Column Repurpose (FK-1 through FK-7)**

For core tables (vessels, components, jobs, work_orders, spares, stores_items, defects), the existing child ID columns (e.g., `vessel_id`, `component_id`) were repurposed to store UUID strings instead of integers. The FK constraint points from the same column to the parent UUID column.

```
-- Example: components.vessel_id now contains vuuid values
-- FK: components.vessel_id → vessels.vuuid
```

**Pattern B: New UUID Column + Dual Write (FK-8 through FK-10)**

For newer tables (alerts, forms, bulk_import), a new `*_uuid` column was added alongside the existing integer FK column. Both are written during inserts (dual-write pattern).

```
-- Example: alert_events has both:
--   policy_id  (integer, legacy — kept during transition)
--   policy_uuid (text, FK → alert_policies.apuuid)
```

### Storage Layer Changes

All `IStorage` interface methods and `PostgresStorage` implementations were updated:

- **Lookup methods** use UUID: `getVessel(id: string)` queries by `vuuid` instead of integer `id`
- **Create methods** generate UUID: `createVessel()` sets `vuuid: randomUUID()` automatically
- **Insert schemas** omit parent UUIDs: `insertVesselSchema.omit({ vuuid: true })` — storage layer generates them
- **Child FK columns** provided by callers: e.g., `formDefinitionUuid` is passed explicitly, not auto-generated

### Migration System

There are **three** migration tracks cohabiting in this repo, all tracked in a
single `schema_migrations` table (not Drizzle's own `__drizzle_migrations` —
that table is never used by this codebase):

1. **Legacy JS array** (`server/migrations.ts`, lines 17–2752) — **FROZEN at 081**.
   - 81 hand-coded `Migration` objects with SQL as string literals.
   - IDs run from `001_date_reported_to_office` through `081_add_rank_view_to_org_chart`.
   - Applied by `runMigrations()` at server startup.
   - Do **NOT** add new entries here. Write a new file in `migrations/` instead.

2. **Drizzle auto-generated** (`migrations/0XXX_*.sql`, 4-digit prefix) —
   ~62 files as of this writing.
   - Created by `drizzle-kit generate` against `shared/schema.ts`.
   - Applied by `runDrizzleMigrations()` at server startup.
   - **MUST be created manually**, not at runtime — see "Server startup
     behavior" below.

3. **Hand-written SQL** (`migrations/0XX_*.sql`, 3-digit prefix) — 30+ files,
   running from `001_date_reported_to_office.sql` through
   `110_sync_trigger_bypass.sql`.
   - Used for anything Drizzle can't express: data seeds, partial indexes,
     `DO $$ ... $$` constraint repairs, cross-table backfills.
   - Applied by the same `runDrizzleMigrations()` as the 4-digit files.
   - Must always use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `ON CONFLICT ... DO NOTHING`, and similar idempotency guards — every file
     must be safe to re-run.
   - First six (`001_`–`006_`) duplicate IDs from the legacy JS array. From
     `012_` onwards the 3-digit SQL files diverge into their own namespace.

**Sort order rule (load-bearing, not obvious)**: `fs.readdirSync(...).sort()`
uses byte-wise lexicographic ordering. In that ordering, **all 4-digit
`0XXX_*.sql` files sort before all 3-digit `0XX_*.sql` files** (because `"0"`
at position 1 is less than any digit at position 1 of a 3-digit name). So
`runDrizzleMigrations()` always applies the Drizzle baseline (4-digit) first,
then the hand-written layer (3-digit) on top. Hand-written migrations can
safely assume that tables already exist from the auto-generated baseline, but
must still use `IF NOT EXISTS` because `db:push` installs bypass the file
history entirely.

**Startup sequence:**
```
initStorage() → runBackupAndMigrations() → initializeDatabase() → registerRoutes()

where runBackupAndMigrations() =
  createDatabaseBackup()                  # pg_dump to backup/
  runMigrations()                         # legacy JS array (track 1)
  cleanupDuplicateFleetComponentMappings()
  runDrizzleMigrations()                  # 4-digit + 3-digit SQL files (tracks 2 + 3)
```

**Server startup only APPLIES migrations — it does NOT auto-generate.**
Prior to April 2026 the startup pipeline also ran `generateDrizzleMigrations()`
which spawned `drizzle-kit generate` as a child process on every boot. That
behavior was removed after the 085 master_list_types incident because:
- It produced duplicate-numbered files when multiple developers generated
  concurrently (the repo still has 15 duplicate-prefix collision zones from
  that era — 0043 and 0044 each have three physical files).
- It silently mutated the working tree on production servers.
- It generated shadow files that conflicted with hand-written migrations
  (the root cause of the 085 incident: an auto-generated file created
  `master_list_types` without a DB-level default for `mltuuid` because
  `$defaultFn()` doesn't translate to SQL, and the subsequent hand-written
  085 file then no-op'd its `CREATE TABLE IF NOT EXISTS` and failed on the
  seed INSERT).

This rule applies universally — Replit forks, DEV server, and PROD server
all behave identically. No environment gating.

**`$defaultFn()` vs `.default(sql\`...\`)`** — always prefer the latter:
```ts
// ❌ DON'T — $defaultFn is application-side only. Drizzle does NOT translate
//    it to a DB-level DEFAULT, so raw SQL INSERTs (including migration seeds
//    and db:push-created tables) will fail NOT NULL on the column.
someUuid: text("some_uuid").notNull().$defaultFn(() => crypto.randomUUID()),

// ✅ DO — emits a real PostgreSQL DEFAULT clause. Works for raw SQL inserts,
//    drizzle-kit generate, drizzle-kit push, and ORM-level inserts.
someUuid: text("some_uuid").notNull().default(sql`gen_random_uuid()::text`),
```
This pattern caused the 085 incident and is the reason `mltuuid` on
`master_list_types` was changed in the same commit that removed runtime
auto-generation.

**`db:push` is for fresh installs only.** `npm run db:push` runs
`drizzle-kit push` which diffs the current schema against the live DB and
applies any DDL needed to make them match. It bypasses the entire file-based
migration history — so it's safe for a brand-new empty database but **never
safe** on a database that already has application data. Use it when bringing
up a new laptop or a fresh Replit fork. Never run it on an existing DB that
has already been through the migration pipeline.

**Schema change workflow (applies to Replit, DEV, and PROD identically):**

1. Edit `shared/schema.ts`.
2. Run `npm run db:generate` manually. This invokes `drizzle-kit generate`
   and writes a new `migrations/NNNN_<name>.sql` file plus an updated
   `migrations/meta/_journal.json` and `migrations/meta/NNNN_snapshot.json`.
3. Review the generated SQL. Edit it if Drizzle missed something (e.g.,
   dynamic defaults it can't express). Drizzle never generates data seeds
   or partial indexes — you'll need step 4 for those.
4. If the change needs seed data, backfills, partial indexes, or constraint
   repairs that Drizzle can't express, hand-write a follow-up file using the
   **next 3-digit prefix** (current max is `110_`). Use idempotency guards
   (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ ... $$` blocks).
5. Commit both files together in the same PR. Reviewer verifies the generated
   SQL matches the schema change intent and the hand-written follow-up is
   idempotent.
6. On next server start (any environment), `runDrizzleMigrations()` applies
   both files in sort order and records them in `schema_migrations`.

Useful scripts:
| Command | Purpose |
|---|---|
| `npm run db:push` | **Fresh install only.** Diff-apply schema to an empty DB. |
| `npm run db:generate` | Create a new migration file from schema changes. |
| `npm run db:check` | Drizzle consistency check (snapshots ↔ journal ↔ schema). |

### Verification Scripts

| Script | Purpose |
|--------|---------|
| `scripts/verify-data-integrity.ts` | Confirms row counts match baseline (10,107 rows across 75 tables) |
| `scripts/fk-final-verification.ts` | Verifies all 72 FK constraints, UNIQUE/NOT NULL, zero NULL UUIDs |

---

## Part 3: Developer Guide

### How to Add a New Endpoint

1. **Identify the module** — which domain does this endpoint belong to?
2. **Add repository method** (if new storage call needed) in `<module>/repositories/`
3. **Add service method** with business logic in `<module>/services/`
4. **Add controller handler** in `<module>/controllers/`
5. **Add route** in `<module>/routes.ts` using `asyncHandler(controller.method)`
6. No changes needed to `routes.ts` or `modules/index.ts`

#### Example: Adding `GET /technical/api/spares/:id/history`

```typescript
// 1. repositories/sparesRepository.ts
export function getSpareHistory(spareId: string) {
  return storage.getSpareHistory(spareId);
}

// 2. services/sparesService.ts
export async function getSpareHistory(spareId: string) {
  const history = await sparesRepo.getSpareHistory(spareId);
  if (!history) throw new AppError(404, 'Spare not found');
  return history;
}

// 3. controllers/sparesController.ts
export async function getSpareHistory(req: Request, res: Response) {
  const result = await sparesService.getSpareHistory(req.params.id);
  res.json(result);
}

// 4. routes.ts
router.get('/spares/:id/history', asyncHandler(sparesCtrl.getSpareHistory));
```

### How to Add a New Database Migration

1. Add the migration to the `migrations` array in `server/migrations.ts`
2. Use the next sequential ID (e.g., `052_...`)
3. Write idempotent SQL:
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - `DO $ BEGIN ... EXCEPTION WHEN others THEN NULL; END $` for constraints
   - `WHERE ... IS NULL` for backfill updates
4. Update `shared/schema.ts` with matching Drizzle schema changes
5. Run `npm run dev` — both custom and Drizzle migrations auto-apply

#### Example: Adding a UUID column to a new table

```typescript
// In server/migrations.ts — append to migrations array:
{
  id: '052_my_table_uuid_column',
  name: 'Add myuuid column to my_table',
  description: 'Add canonical UUID identity column',
  sql: `
    ALTER TABLE my_table ADD COLUMN IF NOT EXISTS myuuid TEXT;
    UPDATE my_table SET myuuid = gen_random_uuid()::text WHERE myuuid IS NULL;
    DO $ BEGIN
      BEGIN ALTER TABLE my_table ALTER COLUMN myuuid SET NOT NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END $;
    DO $ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'my_table_myuuid_unique') THEN
        ALTER TABLE my_table ADD CONSTRAINT my_table_myuuid_unique UNIQUE(myuuid);
      END IF;
    END $
  `
}
```

### Key Rules

- **Never use `parseInt()` on entity IDs** — all IDs are UUID strings at the API layer
- **Parent UUID columns are auto-generated** — omitted from insert schemas, storage layer calls `randomUUID()`
- **Child FK UUID columns are caller-provided** — NOT omitted from insert schemas
- **Modules do NOT import from each other** — all cross-domain access goes through `storage`
- **Never modify `shared/schema.ts` without a corresponding migration** in `server/migrations.ts`
