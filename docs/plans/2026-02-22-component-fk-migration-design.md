# FK-2: Component Identity Restructure — Design

**Date**: 2026-02-22
**Branch**: claude/laughing-williams
**Last migration**: 030 (from FK-1 vessel migration)

## Pre-Flight Results

- cuuid column: does NOT exist (clean slate)
- components.id: TEXT (`COMP-xxx` format) — 270 rows
- Child table orphans: **0** (safe to add FK constraints after data migration)
- Self-reference orphans: 264 parentId, 152 rhMasterComponentId (will be resolved by data migration)
- Tables with data: spares(1113), jobs(293), spare_component_links(3381), job_component_links(293)
- Empty child tables: 11 of 15

## Key Difference from FK-1

Components use `COMP-xxx` format IDs (not UUIDs). `cuuid` is populated with `gen_random_uuid()::text`.
This requires migrating all child table `component_id` values from COMP-xxx → new UUID.

## Migrations

### 031: Add cuuid column + migrate child table data
1. Add cuuid TEXT column (nullable first)
2. Populate with gen_random_uuid()::text
3. SET NOT NULL + UNIQUE constraint
4. Update ALL 15 child tables: component_id = cuuid (mapped from COMP-xxx)
5. Update self-references: parentId, rhMasterComponentId → cuuid

### 032: FK constraints batch 1 (4 tables with data)
spares, jobs, spare_component_links, job_component_links

### 033: FK constraints batch 2 (11 empty tables)
running_hours_audit, ihm_items, spares_history, work_order_executions, defects,
component_running_hours_log, component_documents, component_class_regulatory,
component_maintenance_history, component_requisitions, fleet_component_mapping

### Server Code Refactor
- eq(components.id, ...) → eq(components.cuuid, ...)
- createComponent no longer sets id manually
- Child table inserts use component.cuuid
- Schema: .references(() => components.cuuid) on all 15 child tables

### Decision: Skip id→SERIAL conversion (same as FK-1)
