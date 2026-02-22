# FK-3: Job Identity Restructure — Design

**Date**: 2026-02-22
**Branch**: claude/laughing-williams
**Last migration**: 033 (from FK-2 component migration)

## Pre-Flight Results

- juuid column: does NOT exist (clean slate)
- jobs.id: TEXT (`JOB-xxx` format) — 293 rows
- Child tables with data: work_orders(143), job_component_links(293)
- Empty child tables: component_maintenance_history(0), fleet_job_vessel_mapping(0)
- Child table orphans: **0** (safe to add FK constraints after data migration)
- Existing FK constraints on jobs: 0

## Key Difference from FK-1/FK-2

Jobs use `JOB-xxx` format IDs (not UUIDs). `juuid` is populated with `gen_random_uuid()::text`.
This requires migrating all child table `job_id` values from JOB-xxx → new UUID.

## Migrations

### 034: Add juuid column + migrate child table data
1. Add juuid TEXT column (nullable first)
2. Populate with gen_random_uuid()::text
3. SET NOT NULL + UNIQUE constraint
4. Update ALL 4 child tables: job_id = juuid (mapped from JOB-xxx)

### 035: FK constraints (4 child tables)
work_orders, job_component_links, component_maintenance_history, fleet_job_vessel_mapping

### Server Code Refactor
- eq(jobs.id, ...) → eq(jobs.juuid, ...)
- createJob generates juuid via crypto.randomUUID()
- Child table inserts use job.juuid
- Schema: .references(() => jobs.juuid) on all 4 child tables

### Decision: Skip id→SERIAL conversion (same as FK-1, FK-2)
