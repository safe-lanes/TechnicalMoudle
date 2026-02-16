# Spares Identity Restructure - Migration Guide

> Complete plan for the spares module identity migration. This migration adds `spares.suuid` as the canonical UUID identity column, establishes DB-level FK constraints from all child tables, and refactors server/frontend code to use `suuid` for all lookups. Pattern follows the proven vessel migration (0008-0014, 43 tables), component migration (0016-0022, 15 tables), jobs migration (0025-0027, 4 tables), and work orders migration (0028-0031, 4 tables).

---

## Migration Summary

| Before | After |
|--------|-------|
| `spares.id` = INTEGER PRIMARY KEY (generatedByDefaultAsIdentity) | `spares.id` = INTEGER PRIMARY KEY (unchanged — already auto-increment) |
| No UUID column | `spares.suuid` = TEXT NOT NULL UNIQUE (canonical UUID identity) |
| No FK constraints from child tables to `spares` | 4 core child tables have DB-level FK constraints to `spares(suuid)` |
| Server code uses `eq(spares.id, numericId)` for lookups | Server code uses `eq(spares.suuid, value)` for all lookups |
| Frontend uses `spare.id` (integer) for navigation/keys | Frontend uses `spare.suuid` for URLs, React keys, API calls |
| Child tables reference `spares.id` (integer) | Child tables reference `spares.suuid` (TEXT) with FK constraints |

---

## Current State Analysis

### Spares Table — `spares`

**Key columns:**
```
id              INTEGER PRIMARY KEY (generatedByDefaultAsIdentity — already auto-increment)
part_code       TEXT NOT NULL
part_name       TEXT NOT NULL
component_id    TEXT → FK to components(cuuid) — already migrated
vessel_id       TEXT → FK to vessels(vuuid) — already migrated
data_scope      TEXT DEFAULT 'vessel' — 'vessel' | 'fleet'
created_at      TIMESTAMP DEFAULT NOW() — audit column already exists
updated_at      TIMESTAMP DEFAULT NOW() — audit column already exists
created_by      TEXT — audit column already exists
updated_by      TEXT — audit column already exists
```

**Important differences from previous migrations:**
1. `spares.id` is **already INTEGER** with auto-increment — NOT TEXT like vessels/components/jobs/work orders were. **Phase 4 (id TEXT→SERIAL conversion) is NOT needed.**
2. Parent FKs to `vessels(vuuid)` and `components(cuuid)` are **already in place**.
3. Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) **already exist**.
4. Only Phases 1-3 are needed: add `suuid`, FK constraints, code refactoring.

---

## Child Tables Requiring FK Constraints

### Core Child Tables (4 tables — integer `spare_id`, no FK constraint)

| # | Child Table | Column | Current Type | Current FK | Action |
|---|-------------|--------|-------------|------------|--------|
| 1 | `spares_history` | `spare_id` | INTEGER NOT NULL | None | Add `spare_uuid` TEXT col + FK to `spares(suuid)` |
| 2 | `spare_component_links` | `spare_id` | INTEGER NOT NULL | None | Add `spare_uuid` TEXT col + FK to `spares(suuid)` |
| 3 | `spare_location_stock` | `spare_id` | INTEGER NOT NULL | None | Add `spare_uuid` TEXT col + FK to `spares(suuid)` |
| 4 | `inventory_transactions` | `spare_id` | INTEGER NOT NULL | None | Add `spare_uuid` TEXT col + FK to `spares(suuid)` |

### Other Tables Referencing Spares (2 tables — TEXT `spare_id`, loose reference)

| # | Table | Column | Current Type | Notes |
|---|-------|--------|-------------|-------|
| 5 | `ihm_items` | `spare_id` | TEXT | Loose text reference, not a true FK. Evaluate if FK is appropriate. |
| 6 | `fleet_spare_vessel_mapping` | `spare_id` | TEXT | Loose text reference for fleet spares. Evaluate if FK is appropriate. |

**Decision on tables 5-6**: These use TEXT `spare_id` which historically stored string-format IDs (or integer IDs cast to text). Mapping strategy:
- **`ihm_items.spare_id`**: Nullable TEXT field. Map via `CAST(ihm_items.spare_id AS INTEGER) = spares.id → spares.suuid` where the value is a numeric string. Non-numeric or NULL values stay NULL.
- **`fleet_spare_vessel_mapping.spare_id`**: Nullable TEXT field. Same numeric-cast mapping: `CAST(spare_id AS INTEGER) = spares.id → spares.suuid`. Rows with NULL `spare_id` remain NULL (FK column should be nullable).
- **Validation step**: Before migration, run `SELECT spare_id FROM ihm_items WHERE spare_id IS NOT NULL AND spare_id !~ '^\d+$'` to detect any non-numeric spare_id values that need manual review.

### Child Table Transition Strategy

**Approach: Parallel Identity Columns (recommended)**

Rather than immediately replacing integer `spare_id` with UUID `spare_uuid`, use a parallel-column approach:

1. **Add `spare_uuid` TEXT column** alongside existing integer `spare_id`
2. **Populate `spare_uuid`** from join: `child.spare_id (integer) → spares.id → spares.suuid`
3. **Add FK constraint** on `spare_uuid` referencing `spares(suuid)`
4. **Keep integer `spare_id`** during transition — both columns coexist
5. **Code refactoring** (Phase 3): Update all server/frontend code to read/write `spare_uuid` instead of `spare_id`
6. **Future cleanup** (optional): Drop integer `spare_id` column once all code uses `spare_uuid`

This approach avoids breaking existing V2 code during the transition period. The V2 repository code (`sparesRepository.ts`) currently uses `v2SparesHistory.spareId`, `v2SpareLocationStock.spareId`, etc. — these will continue working during the transition while new code is written to use `spare_uuid`.

**V2 Schema updates needed** (during Phase 2):

```typescript
// shared/v2/spares/schema.ts — add spare_uuid to all child tables
export const v2SparesHistory = pgTable("spares_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  spareId: integer("spare_id").notNull(),           // KEEP during transition
  spareUuid: text("spare_uuid").notNull(),           // ADD — FK to spares(suuid)
  // ... rest
});

// Same for v2SpareComponentLinks, v2SpareLocationStock, v2InventoryTransactions
```

---

## Phase 1: Add `suuid` Column to Spares Table

### Task 1a: Add `suuid` Column with Backfill

**Schema change** (`shared/schema.ts`):
```typescript
export const spares = pgTable("spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  suuid: text("suuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),  // ADD THIS
  partCode: text("part_code").notNull(),
  // ... rest of columns
});
```

**V2 Schema change** (`shared/v2/spares/schema.ts`):
```typescript
export const v2Spares = pgTable("spares", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  suuid: text("suuid").notNull().unique().$defaultFn(() => crypto.randomUUID()),  // ADD THIS
  // ... rest of columns
});
```

**Hand-written migration SQL** (safe backfill pattern):
```sql
-- Step 1: Add column as nullable
ALTER TABLE "spares" ADD COLUMN "suuid" TEXT;

-- Step 2: Backfill existing rows with UUIDs
UPDATE "spares" SET "suuid" = gen_random_uuid()::text WHERE "suuid" IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE "spares" ALTER COLUMN "suuid" SET NOT NULL;

-- Step 4: Add UNIQUE constraint
ALTER TABLE "spares" ADD CONSTRAINT "spares_suuid_unique" UNIQUE("suuid");
```

**Verification**:
```sql
-- Confirm column exists, is NOT NULL, and UNIQUE
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'spares' AND column_name = 'suuid';

-- Confirm no NULL values
SELECT COUNT(*) FROM spares WHERE suuid IS NULL;

-- Confirm no duplicates
SELECT suuid, COUNT(*) FROM spares GROUP BY suuid HAVING COUNT(*) > 1;
```

### Task 1b: Drizzle Schema Sync

Run `drizzle-kit generate` to sync the schema constraints. This will generate a migration enforcing NOT NULL + UNIQUE at the schema level (idempotent with the hand-written migration).

---

## Phase 2: Add FK Constraints from Child Tables

### Strategy: UUID-based FK Approach

For each child table:
1. Add a `spare_uuid` TEXT column (or rename existing `spare_id` TEXT columns)
2. Populate from join: `child.spare_id (integer) → spares.id → spares.suuid`
3. Add FK constraint referencing `spares(suuid)`
4. Keep the old integer `spare_id` column during transition (remove later if desired)

### Task 2a: FK Constraints — Batch 1 (Core 4 child tables)

**Migration SQL for `spares_history`:**
```sql
-- Add spare_uuid column
ALTER TABLE "spares_history" ADD COLUMN "spare_uuid" TEXT;

-- Populate from spares table join
UPDATE "spares_history" sh 
SET "spare_uuid" = s."suuid" 
FROM "spares" s 
WHERE sh."spare_id" = s."id";

-- Make NOT NULL (only if all rows have matching spares)
ALTER TABLE "spares_history" ALTER COLUMN "spare_uuid" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "spares_history" ADD CONSTRAINT "spares_history_spare_uuid_spares_suuid_fk"
  FOREIGN KEY ("spare_uuid") REFERENCES "spares"("suuid");
```

**Repeat same pattern for:**
- `spare_component_links` — add `spare_uuid`, populate, FK
- `spare_location_stock` — add `spare_uuid`, populate, FK
- `inventory_transactions` — add `spare_uuid`, populate, FK

**Note on unique constraints:**
- `spare_component_links` has `UNIQUE(spare_id, component_id)` — after migration, create `UNIQUE(spare_uuid, component_id)`
- `spare_location_stock` has `UNIQUE(spare_id, location_id)` — after migration, create `UNIQUE(spare_uuid, location_id)`

### Task 2b: FK Constraints — Text-based References (ihm_items, fleet_spare_vessel_mapping)

These tables have TEXT `spare_id` columns. Decision:
- **Option A**: Update these to store `suuid` values and add FK constraints (preferred)
- **Option B**: Leave as-is if these are loose references that may not always map to valid spares

**If Option A (recommended):**
```sql
-- For ihm_items: rename spare_id to spare_uuid, populate from spares
-- Note: ihm_items.spare_id is TEXT and may contain old string IDs or be NULL
-- Need careful data mapping

-- For fleet_spare_vessel_mapping: similar approach
```

**Verification after Phase 2:**
```sql
-- Confirm FK constraints exist
SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'spares';
```

---

## Phase 3: Refactor Server & Frontend Code

### Server Code Locations to Update

#### Legacy Code (`server/postgresStorage.ts`)

All these locations use `eq(spares.id, numericId)` — change to `eq(spares.suuid, uuid)`:

| Line | Method | Current Code | New Code |
|------|--------|-------------|----------|
| ~1903 | `getSpare()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~1951 | `updateSpare()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~1987 | `deleteSpare()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2014 | `consumeSpare()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2098 | `receiveSpare()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2181 | `consumeSpareFromLocation()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2271 | `consumeSpareFromLocationLegacy()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2358 | `receiveSpareToLocation()` | `eq(spares.id, id)` | `eq(spares.suuid, suuid)` |
| ~2409 | `adjustSpare()` | `spareId: spare.id` | `spareId: spare.suuid` (history writes) |

**Pattern for each**: Change function parameter from `id: number` to `suuid: string`, update the `eq()` lookup, and update history/transaction writes to use `spare_uuid` instead of `spare_id`.

#### V2 Code (`server/v2/spares/`)

| File | Current | Action |
|------|---------|--------|
| `repositories/sparesRepository.ts` | Uses `spares.id` (integer) for lookups | Change to `spares.suuid` |
| `services/sparesService.ts` | `spareId: number` parameters | Change to `spareUuid: string` |
| `controllers/sparesController.ts` | `z.coerce.number()` for spare ID params | Change to `z.string().uuid()` for suuid |
| `routes.ts` | Routes use `/:id` (numeric) | Change to `/:suuid` (UUID string) |

#### Route Changes

| Current Route | New Route |
|--------------|-----------|
| `GET /:vesselId/:id` | `GET /:vesselId/:suuid` |
| `PATCH /:vesselId/:id` | `PATCH /:vesselId/:suuid` |
| `DELETE /:vesselId/:id` | `DELETE /:vesselId/:suuid` |
| `POST /:id/consume` | `POST /:suuid/consume` |
| `POST /:id/receive` | `POST /:suuid/receive` |
| `POST /:id/consume-from-location` | `POST /:suuid/consume-from-location` |
| `POST /:id/receive-to-location` | `POST /:suuid/receive-to-location` |
| `POST /:vesselId/:id/adjustment` | `POST /:vesselId/:suuid/adjustment` |
| `POST /:vesselId/:id/adjust` | `POST /:vesselId/:suuid/adjust` |

#### Batch/Bulk Endpoint Payload Changes

These endpoints accept arrays with `spareId` (integer) in request bodies — must change to `spareUuid` (string):

| Endpoint | Current Payload Field | New Payload Field |
|----------|----------------------|-------------------|
| `POST /:vesselId/batch-consume` | `items[].spareId: number` | `items[].spareUuid: string` |
| `POST /:vesselId/batch-receive` | `items[].spareId: number` | `items[].spareUuid: string` |
| `POST /bulk-update` | Spare objects with `id: number` | Spare objects with `suuid: string` |

**Controller validation schema changes** (`sparesController.ts`):
```typescript
// Before
const spareIdSchema = z.object({ id: z.coerce.number().int().positive() });

// After
const spareIdSchema = z.object({ suuid: z.string().uuid() });
```

**Batch consume/receive Zod schemas** (in controller):
```typescript
// Before
spareId: z.coerce.number().int().positive(),

// After
spareUuid: z.string().uuid(),
```

### Frontend Code Locations to Update

Search for patterns:
- `spare.id` used as React keys → change to `spare.suuid`
- `spare.id` in URL navigation → change to `spare.suuid`
- `spare.id` in API calls → change to `spare.suuid`
- `spareId` URL params parsed as number → change to string UUID

### Insert Schema Updates

```typescript
export const insertSpareSchema = createInsertSchema(spares).omit({
  id: true,    // Keep — auto-generated integer
  suuid: true, // ADD — auto-generated UUID
});
```

### History/Transaction Write Updates

When writing to `spares_history`, `spare_component_links`, `spare_location_stock`, or `inventory_transactions`, change:
```typescript
// Before
spareId: spare.id   // integer

// After  
spareUuid: spare.suuid  // UUID string
```

---

## Phase 4: NOT NEEDED

`spares.id` is **already INTEGER** with `generatedByDefaultAsIdentity()`. No TEXT→SERIAL conversion is required. This is the key difference from vessels/components/jobs/work orders migrations.

---

## Complete Code Refactoring Checklist

### Server Files to Modify

- [ ] `shared/schema.ts` — Add `suuid` column to `spares` table definition
- [ ] `shared/v2/spares/schema.ts` — Add `suuid` column to `v2Spares` table definition
- [ ] `server/postgresStorage.ts` — ~10 methods that lookup by `spares.id`
- [ ] `server/v2/spares/repositories/sparesRepository.ts` — All repository methods
- [ ] `server/v2/spares/services/sparesService.ts` — Service method signatures
- [ ] `server/v2/spares/controllers/sparesController.ts` — Controller param parsing
- [ ] `server/v2/spares/routes.ts` — Route parameter names
- [ ] `server/memStorage.ts` — In-memory spare operations (if applicable)

### Frontend Files to Search and Update

```bash
grep -rn "spare\.id\b" client/src/
grep -rn "spareId" client/src/
grep -rn "/spares/.*/:id" client/src/
```

### Schema Files to Update

- [ ] `shared/schema.ts` — `insertSpareSchema.omit({ suuid: true })`
- [ ] `shared/v2/spares/schema.ts` — Same omit for V2 insert schema
- [ ] `shared/schema.ts` — Child table schemas (add `spareUuid` column definitions)

---

## Verification Queries

### After Phase 1 (suuid column added):
```sql
SELECT id, suuid, part_code, vessel_id FROM spares LIMIT 10;
SELECT COUNT(*) FROM spares WHERE suuid IS NULL;
```

### After Phase 2 (FK constraints added):
```sql
-- Check all FK constraints referencing spares
SELECT tc.table_name, kcu.column_name, ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'spares';

-- Verify child table data populated correctly
SELECT COUNT(*) FROM spares_history WHERE spare_uuid IS NULL;
SELECT COUNT(*) FROM spare_component_links WHERE spare_uuid IS NULL;
SELECT COUNT(*) FROM spare_location_stock WHERE spare_uuid IS NULL;
SELECT COUNT(*) FROM inventory_transactions WHERE spare_uuid IS NULL;
```

### After Phase 3 (code refactored):
```bash
# Verify no remaining integer-based spare lookups
grep -rn "eq(spares.id," server/
grep -rn "eq(v2Spares.id," server/

# Verify no remaining spare.id usage in frontend
grep -rn "spare\.id\b" client/src/ | grep -v "suuid"
```

---

## Rules for Future Migrations Involving the Spares Table

1. **Always use `spares.suuid`** for identity and linking. Never use `spares.id` for UUID-based lookups.
2. **`spares.id` (integer)** is an internal auto-increment PK — not used for application-level identity.
3. **Child table spare reference columns** must store the UUID from `spares.suuid`.
4. **New child tables** that reference spares must add FK: `FOREIGN KEY ("spare_uuid") REFERENCES "spares"("suuid")`.
5. **Insert operations** must always set `suuid` via `crypto.randomUUID()` (handled by `$defaultFn`).
6. **ORM queries** must use `eq(spares.suuid, value)` for lookups.
7. **Frontend navigation** must use `spare.suuid` for URLs, React keys, and API calls.

---

## Migration Pattern Reference

This spares migration follows the same proven pattern but is **simpler** (only Phases 1-3):

| Phase | Vessel (0008-0014) | Component (0016-0022) | Jobs (0025-0027) | Work Orders (0028-0031) | Spares |
|-------|-------------------|----------------------|-------------------|------------------------|--------|
| 1. Add UUID column | vuuid | cuuid | juuid | wouuid | suuid |
| 2. FK constraints | 43 child tables | 15 child tables | 4 child tables | 4 child tables | 4-6 child tables |
| 3. Code refactoring | All code | All code | All code | All code | All code |
| 4. id TEXT→SERIAL | Yes (0014) | Yes (0022) | Yes (0027) | Yes (0031) | **NOT NEEDED** (already integer) |

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Phase 1: Add suuid column | 0.5 day | Low — proven pattern |
| Phase 2: FK constraints (4-6 tables) | 0.5 day | Medium — data migration for existing records |
| Phase 3: Code refactoring | 1 day | Medium-High — many server methods + frontend + V2 code |
| Testing & verification | 0.5 day | Medium — spares has complex ROB sync logic |
| **Total** | **~2.5 days** | |
