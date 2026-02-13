# Work Orders Identity Restructure - Migration Guide

> Complete chronological record of every task step executed during the work orders identity migration. This migration adds `work_orders.wouuid` as the canonical UUID identity column and establishes DB-level FK constraints across all 4 child tables. Pattern follows the proven vessel migration (migrations 0008-0014, 43 tables), component migration (migrations 0016-0022, 15 tables), and jobs migration (migrations 0025-0027, 4 tables).

---

## Migration Summary

| Before | After |
|--------|-------|
| `work_orders.id` = TEXT PRIMARY KEY (WO-xxx format) | `work_orders.id` = TEXT PRIMARY KEY (unchanged — Phase 4 pending) |
| No UUID column | `work_orders.wouuid` = TEXT NOT NULL UNIQUE (canonical UUID identity) |
| No FK constraints on child tables for work order identity | 4 child tables have DB-level FK constraints to `work_orders(wouuid)` |
| Server code uses `workOrders.id` (TEXT) for lookups | Server code uses `eq(workOrders.wouuid, ...)` for all lookups (Phase 3 complete) |
| Frontend uses `workOrder.id` for navigation/keys | Frontend uses `workOrder.wouuid` for URLs, React keys, API calls (Phase 3 complete) |
| WO-xxx ID generated in creation paths | WO-xxx generation preserved (Phase 4 pending — SERIAL conversion) |

---

## Current Status: Phase 3 Complete (Code Refactoring Done)

Phases 1, 2, and 3 are complete. Phase 4 is pending:

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Add UUID column with backfill | COMPLETE | Migration 0028 — `wouuid` TEXT NOT NULL UNIQUE |
| 2. Add FK constraints to child tables | COMPLETE | Migrations 0029-0030 — 4 child tables constrained |
| 3. Refactor server/frontend code | COMPLETE | All lookups use `workOrders.wouuid`, frontend uses `wouuid` for navigation/keys |
| 4. Convert id TEXT to SERIAL | PENDING | Remove WO-xxx generation, convert to auto-increment |

---

## Chronological Task Steps (Prompt-by-Prompt)

### Task 1: Add `wouuid` Column to Work Orders Table
**Date**: 2026-02-13 ~10:10
**Migration**: `0028_auto_2026-02-13T10-10-37.sql`
**Commit**: `528d72e5` — *Add unique identifier for work orders and update database schema*
**Prompt**: *Add a `wouuid` TEXT column to the work_orders table. Populate it with UUIDs for all existing rows using `gen_random_uuid()`. Make it NOT NULL and UNIQUE. Use the safe backfill pattern (nullable -> populate -> NOT NULL -> UNIQUE).*

**What was done**:
1. Added `wouuid` column definition to `shared/schema.ts` (TEXT, NOT NULL, UNIQUE)
2. Added `wouuid` column definition to `shared/v2/work-orders/schema.ts`
3. Created migration `0028_auto_2026-02-13T10-10-37.sql` with safe backfill pattern:
   ```sql
   -- Step 1: Add column as nullable first (safe for tables with existing rows)
   ALTER TABLE "work_orders" ADD COLUMN "wouuid" text;

   -- Step 2: Backfill existing rows with generated UUIDs
   UPDATE "work_orders" SET "wouuid" = gen_random_uuid()::text WHERE "wouuid" IS NULL;

   -- Step 3: Set NOT NULL constraint after all rows have values
   ALTER TABLE "work_orders" ALTER COLUMN "wouuid" SET NOT NULL;

   -- Step 4: Add UNIQUE constraint
   ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_wouuid_unique" UNIQUE("wouuid");
   ```

**Files changed**: `shared/schema.ts`, `shared/v2/work-orders/schema.ts`, migration file + snapshot + journal

**Result**: Every existing work order row now has a unique UUID in `wouuid`. The old `id` TEXT column (WO-xxx format) still exists and is still used for all lookups at this point.

---

### Task 2: Add FK Constraints — All 4 Child Tables
**Date**: 2026-02-13 ~10:22
**Migrations**: `0029_auto_2026-02-13T10-22-09.sql`, `0030_auto_2026-02-13T10-22-29.sql`
**Commit**: `528d72e5` (same commit as Task 1 — both tasks completed in same session)
**Prompt**: *Add foreign key constraints from child tables' work order reference columns to `work_orders(wouuid)`. Cover all 4 child tables: component_maintenance_history, work_order_executions, ihm_maintenance_log, work_order_execution_details.*

**Prerequisite verification**: All 4 child tables were confirmed to have 0 rows, making constraint addition safe without data validation concerns.

**What was done**:
1. Updated Drizzle schema references in `shared/schema.ts` for all 4 tables — added `.references(() => workOrders.wouuid)` to the work order reference columns
2. Updated V2 schema references in `shared/v2/work-orders/schema.ts` and `shared/v2/components/schema.ts`
3. Generated migration `0029` (first 2 constraints):
   ```sql
   ALTER TABLE "component_maintenance_history" ADD CONSTRAINT
     "component_maintenance_history_work_order_id_work_orders_wouuid_fk"
     FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("wouuid")
     ON DELETE no action ON UPDATE no action;

   ALTER TABLE "work_order_executions" ADD CONSTRAINT
     "work_order_executions_template_id_work_orders_wouuid_fk"
     FOREIGN KEY ("template_id") REFERENCES "public"."work_orders"("wouuid")
     ON DELETE no action ON UPDATE no action;
   ```
4. Generated migration `0030` (remaining 2 constraints):
   ```sql
   ALTER TABLE "ihm_maintenance_log" ADD CONSTRAINT
     "ihm_maintenance_log_work_order_id_work_orders_wouuid_fk"
     FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("wouuid")
     ON DELETE no action ON UPDATE no action;

   ALTER TABLE "work_order_execution_details" ADD CONSTRAINT
     "work_order_execution_details_work_order_id_work_orders_wouuid_fk"
     FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("wouuid")
     ON DELETE no action ON UPDATE no action;
   ```

**Files changed**: `shared/schema.ts`, `shared/v2/work-orders/schema.ts`, `shared/v2/components/schema.ts`, 2 migration files + snapshots + journal

**Child tables constrained (4 total)**:

| # | Child Table | Column | References | Migration |
|---|-------------|--------|------------|-----------|
| 1 | component_maintenance_history | work_order_id | work_orders(wouuid) | 0029 |
| 2 | work_order_executions | template_id | work_orders(wouuid) | 0029 |
| 3 | ihm_maintenance_log | work_order_id | work_orders(wouuid) | 0030 |
| 4 | work_order_execution_details | work_order_id | work_orders(wouuid) | 0030 |

**Note on column naming**: `work_order_executions` uses `template_id` (not `work_order_id`) to reference the parent work order. This is because executions are instances of a work order template.

---

## Complete FK Constraint Summary (All 4 Tables)

All 4 child tables reference `work_orders(wouuid)` with ON DELETE NO ACTION, ON UPDATE NO ACTION.

| # | Child Table | Column | Constraint Name | Migration |
|---|-------------|--------|-----------------|-----------|
| 1 | component_maintenance_history | work_order_id | component_maintenance_history_work_order_id_work_orders_wouuid_fk | 0029 |
| 2 | work_order_executions | template_id | work_order_executions_template_id_work_orders_wouuid_fk | 0029 |
| 3 | ihm_maintenance_log | work_order_id | ihm_maintenance_log_work_order_id_work_orders_wouuid_fk | 0030 |
| 4 | work_order_execution_details | work_order_id | work_order_execution_details_work_order_id_work_orders_wouuid_fk | 0030 |

---

## Completed Phase 3: Code Refactoring Summary

**Date**: 2026-02-13

All server and frontend code has been refactored from `workOrders.id` to `workOrders.wouuid`:

### Server Changes

**`server/postgresStorage.ts`** (12 locations):
- `getWorkOrder(id)` — now uses `eq(workOrders.wouuid, id)`
- `updateWorkOrder(id, ...)` — now uses `eq(workOrders.wouuid, id)`
- `deleteWorkOrder(id)` — now uses `eq(workOrders.wouuid, id)`
- `createWorkOrder(wo)` — generates `wouuid` via `crypto.randomUUID()`, preserves WO-xxx `id`
- `bulkCreateWorkOrders(...)` — generates `wouuid` via `crypto.randomUUID()`
- Work order completion, status update, maintenance history — all use `wouuid`

**`server/v2/work-orders/`** (repository + 5 services):
- `workOrderRepository.ts` — all CRUD uses `eq(workOrders.wouuid, ...)`
- `workOrderMutationService.ts` — generates `wouuid`, uses for updates/deletes
- `workOrderCompletionService.ts` — maintenance history inserts use `wo.wouuid`
- `workOrderBulkService.ts` — bulk completion uses `wo.wouuid`
- `workOrderAutomationService.ts` — auto-generation creates `wouuid`
- `workOrderContextService.ts` — tracking uses `wo.wouuid`

**`server/routes.ts`** (18 locations):
- All route handlers accept `wouuid` via `req.params.id`
- Work order CRUD, completion, approval, postponement — all use `wouuid`
- Job backfill tracking uses `wo.wouuid`

**`server/routes/bulk.ts`** + **`server/services/`**:
- Bulk import tracking uses `workOrder.wouuid`
- `workOrderStatusRecalculator.ts` — status updates use `wo.wouuid`
- `workOrderService.ts` — execution fetching uses `wouuid`

### Frontend Changes (9 files)

- `WorkOrders.tsx` — React keys, navigation URLs, API calls use `wouuid`
- `Dashboard.tsx` — Chart click navigation uses `wouuid`
- `BulkApproveModal.tsx` — Approval tracking uses `wouuid`
- `ComponentRegisterFormCR.tsx` — Work order references use `wouuid`
- `PostponeWorkOrderDialog.tsx` — API calls use `wouuid`
- Report pages (OverdueWorkOrders, WorkOrderHistory, CriticalEquipment, CompletionRates) — React keys and data-testid use `wouuid`

### Verification

- Application starts cleanly with no errors
- StatusRecalculator processes 112 work orders successfully
- JobDueScanner processes 142+151 jobs successfully
- No remaining `wo.id` or `workOrder.id` references for identity lookups

---

## Pending Phase 4: Convert id TEXT to SERIAL

After Phase 3 code refactoring is complete:

1. Update `shared/schema.ts` — change `id` from `text("id").primaryKey()` to `serial("id").primaryKey()`
2. Remove all WO-xxx ID generation from server creation paths
3. Generate migration to:
   ```sql
   ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_pkey";
   ALTER TABLE "work_orders" DROP COLUMN "id";
   ALTER TABLE "work_orders" ADD COLUMN "id" SERIAL PRIMARY KEY;
   ```
4. Update insert schemas to omit `id` (auto-generated)

---

## Rules for Future Migrations Involving the Work Orders Table

1. **Always use `work_orders.wouuid`** for identity and linking. Never use `work_orders.id` for UUID-based lookups.
2. **Child table work order reference columns** must store the UUID from `work_orders.wouuid`.
3. **New child tables** that reference work orders must add FK constraint: `FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("wouuid")`.
4. **After Phase 4**: Insert operations must never set `id` — it will be auto-generated by the SERIAL sequence.
5. **After Phase 3**: Insert operations must always set `wouuid` via `crypto.randomUUID()`.
6. **After Phase 3**: ORM queries must use `eq(workOrders.wouuid, value)` for lookups.
7. **Frontend navigation** must use `workOrder.wouuid` for URLs, React keys, and API calls (after Phase 3).

---

## Migration Pattern Reference

This work orders migration follows the same proven 4-phase pattern:

| Phase | Vessel Migration | Component Migration | Jobs Migration | Work Orders Migration |
|-------|-----------------|--------------------|--------------------|----------------------|
| 1. Add UUID column with backfill | 0008 (vuuid) | 0016-0017 (cuuid) | 0025 (juuid) | 0028 (wouuid) |
| 2. Add FK constraints to child tables | 0009-0013 (31 tables) | 0018-0021 (15 tables) | 0026 (4 tables) | 0029-0030 (4 tables) |
| 3. Refactor server/frontend code | Multiple commits | Multiple commits | `16c996c0`, `83248f4e` | COMPLETE (2026-02-13) |
| 4. Convert id TEXT to SERIAL | 0014 | 0022 | 0027 | PENDING |
| Total child tables constrained | 43 (including 0024) | 15 | 4 | 4 |
