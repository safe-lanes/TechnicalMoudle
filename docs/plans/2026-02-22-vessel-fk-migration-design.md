# Vessel FK Migration Design

**Date:** 2026-02-22
**Branch:** `refactor/modular-architecture`
**Scope:** Add `vuuid` column to vessels, FK constraints from 31 existing child tables

---

## Current State

- `vessels.id` = TEXT PRIMARY KEY (UUID strings like `743ef9d1-841a-11ed-aa7c-7003bca91a86`)
- No `vuuid` column exists
- No FK constraints from child tables to vessels
- 16 vessels in the database
- 31 child tables exist (13 from migration guide don't exist yet)
- Zero orphaned `vessel_id` references (FK-safe)
- Last custom migration: 026

## Target State

- `vessels.vuuid` = TEXT NOT NULL UNIQUE (canonical UUID identity)
- `vessels.id` = TEXT PRIMARY KEY (unchanged)
- 31 existing child tables have FK constraints: `vessel_id REFERENCES vessels(vuuid)`
- All server code uses `eq(vessels.vuuid, ...)` for UUID lookups
- Frontend maps `vuuid` to `id` (string) for backward compatibility

## Decision: Skip `id` → SERIAL conversion

`vessels.id` stays as TEXT. The `vuuid` column will hold the same UUID value as `id`. All FK constraints target `vuuid` (not `id`). This avoids the risky primary key type change and keeps the migration simpler.

---

## Migration Plan

### Migration 027 — Add `vuuid` column

SQL (idempotent):
```sql
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS vuuid TEXT;
UPDATE vessels SET vuuid = id WHERE vuuid IS NULL;
ALTER TABLE vessels ALTER COLUMN vuuid SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vessels_vuuid_unique') THEN
    ALTER TABLE vessels ADD CONSTRAINT vessels_vuuid_unique UNIQUE(vuuid);
  END IF;
END $$;
```

schema.ts change: Add `vuuid: text("vuuid").notNull().unique()` to vessels table.

### Migration 028 — FK Batch 1 (11 tables with data)

Tables: components, spares, stores_items, stores_ledger, jobs, work_orders, inventory_transactions, job_component_links, locations, spare_component_links, spare_location_stock

Each gets: `ADD CONSTRAINT x_vessel_id_vessels_vuuid_fk FOREIGN KEY (vessel_id) REFERENCES vessels(vuuid)`

schema.ts change: Add `.references(() => vessels.vuuid)` to each table's `vesselId` field.

### Migration 029 — FK Batch 2 (20 empty tables)

Tables: defect_sequences, users, running_hours_audit, change_request, ihm_items, ihm_maintenance_log, spares_history, alert_config, alert_events, certificates, defects, import_history, pms_vessel_settings, surveys, work_order_execution_details, work_order_executions, vessel_certificate_applicability, vessel_certificate_data, vessel_survey_applicability, vessel_survey_data

Same FK pattern.

### Migration 030 — report_snapshots FK

Add FK for report_snapshots (last existing table).

Document 13 tables that don't exist yet and will need FKs when created:
audit_log, bulk_import_history, component_class_regulatory, component_documents, component_maintenance_history, component_requisitions, component_running_hours_log, fleet_component_mapping, fleet_job_vessel_mapping, fleet_spare_vessel_mapping, fleet_vessel_mapping, master_data, postponement_history

---

## Server Code Refactor

After all migrations:
1. Change `eq(vessels.id, ...)` to `eq(vessels.vuuid, ...)` across all modules
2. Update vessel repository in `server/modules/vessels/`
3. `getVessels()` returns `{ ..., vuuid: string }` alongside existing fields
4. `insertVesselSchema` includes `vuuid`
5. Sync-masters/createVessel sets `vuuid` on insert

## Frontend Mapping

- VesselContext / useVessels maps `vuuid` to `id` (string) for backward compatibility
- All 30+ page files that use `vessel.id` continue working without changes

## Verification After Each Migration

1. `npm run dev` — migration applies successfully
2. `npx tsx scripts/verify-data-integrity.ts` — data intact
3. Spot-check: query child tables to confirm FK constraints exist

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| FK fails on orphaned data | Pre-validated: zero orphans found |
| Drizzle auto-gen creates duplicate migration | Custom migration runs first; Drizzle sees DB matches schema |
| Server code breaks after refactor | Test all vessel endpoints after refactor |
| MemStorage (worktree) unaffected | Migrations only run against PostgreSQL |
