# CLAUDE.md — Maritime PMS Technical Module

## Project Overview
- Maritime Planned Maintenance System (PMS) — Express + React + PostgreSQL + Drizzle ORM
- Modular architecture: 18 modules under `server/modules/`, main routes in `server/routes.ts` (~843 lines)
- Schema: 51 tables in `shared/schema.ts` — DO NOT modify during module work
- Reference doc: `docs/MODULE-ARCHITECTURE.md`

## Branches
- `replit_dev` — production/live branch. NEVER push directly
- `refactor/modular-architecture` — active refactoring branch

## Starting the Dev Server (Windows)
```bash
# Must pass env vars explicitly (dotenv not loaded before config imports)
DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms" \
EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
SYNC_INSTANCE_ID=SHORE-DEV \
NODE_ENV=development npx tsx server/index.ts
```
- Server binds to port **5000** (not the PORT in .env)
- `cross-env` removed from package.json — use bash env prefix syntax
- `EXTERNAL_MASTER_DATA_URL_DEV` is mandatory (can be dummy URL for local dev)
- **`SYNC_INSTANCE_ID` (or DB `sync_settings.instance_id`) is mandatory** — startup exits(1) without it. DB value wins over env (the field-logger and sync engine both resolve DB-first; placeholder ids are never stamped on field logs). Use `SHIP-<code>` for ship behavior, anything else = shore.

## Quick DB Queries (without server)
```bash
node -e "require('dotenv').config(); const{Pool}=require('pg'); ..."
# OR
npx tsx scripts/some-script.ts  # (needs `import 'dotenv/config'` at top)
```
- `dotenv` must be installed (`npm install dotenv` if missing)
- DB: `postgres://postgres:admin123@localhost:5432/pms`

## Migration Safety (CRITICAL)
- Dual migration system: custom SQL (001-026) + Drizzle auto-generated
- Both run on every `npm run dev` via `runBackupAndMigrations()`
- During module extraction: DO NOT touch `shared/schema.ts`, `server/migrations.ts`, or `/migrations/*.sql`
- After changes, verify: `git diff shared/schema.ts` must show NO changes

## Data Safety
- Baseline snapshot: `npx tsx scripts/data-baseline-snapshot.ts`
- Verify integrity: `npx tsx scripts/verify-data-integrity.ts` — must show "ALL DATA INTACT"
- Run verify after every module extraction

## AG Grid Version Pinning (CRITICAL — LICENSE CAP)
- AG Grid Enterprise license is **perpetual but version-capped**. Newer versions require a new license.
- **ag-grid max: 34.1.0** (community, enterprise, react)
- **ag-charts max: 12.3.0** (enterprise, react)
- Versions in package.json must be pinned EXACTLY (no `^` or `~` prefix). Never upgrade these packages.
- License key set via `VITE_AG_GRID_LICENSE_KEY` env var (see `client/src/components/AgGrid/AgGridTable.tsx`)

## Key Patterns
- Repositories use `getPostgresClient()` — returns null if DB not initialized
- All repos have `function getDb() { ... if (!postgres) return null; }` guard
- Services throw `{ statusCode: 503 }` when repo returns null
- Frontend uses `@tanstack/react-query` with `apiRequest()` from `client/src/lib/queryClient.ts`
- ag-grid used for data tables — `invalidateQueries` after mutations causes re-render issues

## Work Order Status & Scheduler Architecture (feature/scheduler-redesign — read before touching WO status/schedulers)
- **WO status is COMPUTED ON READ** (`computeWorkOrderStatus`, `shared/workOrders/status.ts`). The derived band (Active / Due / Due (Grace P) / Overdue) is **NEVER persisted**. Authored/workflow statuses (Completed, Pending Approval, Postponed, Rejected, …) ARE persisted and are passed through by `computeWorkOrderStatus`.
- **CONTRACT:** every overdue/due (derived-band) read MUST go through `getWorkOrdersWithComputedStatus(vesselId?, vesselIds?)` in `server/modules/work-orders/services/workOrderService.ts`. **NEVER** write a raw `WHERE status='Overdue'/'Due'` — it returns stale results. (Consumers already retargeted: pmsAlertEngine UC1, equipmentReportService, operationsReportService.)
- **The status recalculator scheduler is REMOVED** (ship + shore). `workOrderStatusRecalculator.runRecalculation()` is compute-only (no DB write, no `'system'` field-log) — writing `'system'` status was the documented false-sync-conflict source. `forceRecalculation()` callers still compile; their `statusesUpdated` is drift telemetry only.
- **`jobDueScanner` (WO generation) is SHIP-ONLY**, gated by `isShipInstance()`, runs DAILY (configurable `JOB_DUE_SCAN_INTERVAL_MS`, default 24h). Shore runs NO automatic scanners. Use the batch `storage.getLinkedComponentsForJobs(jobIds[])` — never per-job `getLinkedComponentsForJob` in a loop (N+1).
- **Office generates WOs on demand:** `POST /work-orders/generate-now` (vessel-scoped, 409 if a run is in progress) + the shore-only "Generate Now" button. `jobDueScanner.runScan(scopeVesselId?)` is the reusable sweep.
- **Postponement auto-revert is INTENTIONALLY DISABLED** (domain decision, Jeevan): expired postponements stay 'Postponed' until manual action. Do NOT re-enable the removed startup/hourly `checkAndRevertPostponedWorkOrders()` calls, and do NOT "fix" the `postponedDate`/`postponement_end_date` mismatch — fixing it would (wrongly) start auto-reverting.
- All schedulers must be stopped in `stopAllSchedulers()` (routes.ts) on SIGTERM/SIGINT — a missed one orphans on PM2 restart. PM2 runs in FORK mode (single instance), not cluster.

## Fleet Mapping Call Chain (4 layers — all must be updated together)
- Frontend (`FleetVesselMapping.tsx`) → Service (`fleetAdminService.ts`) → Repository (`fleetAdminRepository.ts`) → Storage (`postgresStorage.ts`)
- Repository is a thin pass-through wrapper — easy to miss when adding new params (e.g. jobId, spareId)
- Verify all 4 layers when changing DELETE/UPDATE signatures: `grep -rn "functionName" server/ --include="*.ts"`

## Known Issues (cert-surveys module)
- `certificateRepository.ts:getMasterCertificatesByIds` filters by `applicableToCompany=true` — hides valid certs
- `surveyRepository.ts:getMasterSurveysByIds` — same filter bug
- Frontend delete in admin only queues deletion in React state, doesn't call DELETE API
- ag-grid date editing breaks after multiple rapid edits due to `invalidateQueries` causing full re-render

## Engineering Standards (read before writing code)

These rules exist because we hit each of these bugs in production. 
Follow them on every change.

### Migrations

- **Never hardcode primary key ids in INSERTs.** Use 
  `INSERT...SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM <table>) 
  WHERE NOT EXISTS (SELECT 1 FROM <table> WHERE name = '...')`. 
  Auto-increment columns: omit the id entirely.

- **Never use `ON CONFLICT (id) DO NOTHING` for seed data.** It 
  silently inserts zero rows when the id is taken and gets marked 
  as "applied." Use `ON CONFLICT (name) DO NOTHING` or 
  `WHERE NOT EXISTS (name = ...)`.

- **Role/reference lookups must tolerate missing rows.** Use 
  JOIN patterns that produce zero rows when not found, not scalar 
  subqueries that return NULL into NOT NULL columns:

```sql
  -- WRONG (NULL violation if role missing):
  INSERT INTO ... SELECT (SELECT ruid FROM roles WHERE name = 'X' LIMIT 1), ...
  
  -- RIGHT (zero rows if role missing):
  INSERT INTO ... SELECT r.ruid, ... FROM <other> CROSS JOIN roles r 
    WHERE r.name = 'X' ON CONFLICT ... DO NOTHING;
```

- **Parent menu / foreign key lookups must use name-based queries**, 
  not hardcoded ids. Different DBs have different ids for the same 
  logical row.

- **Migrations must be idempotent.** Second run produces zero new 
  rows, zero errors.

- **Test migrations on a DB that already has the seed data** before 
  committing. Re-running must be a clean no-op.

### TypeScript

- **Never increase the tsc baseline.** Run `npx tsc --noEmit` before 
  committing. The count must not exceed the current baseline of 374. 
  Do not increase it. If you introduce new errors, fix them before 
  committing.

- **Don't suppress with `as any` or `@ts-ignore`** to bypass real 
  type mismatches. Fix the type or fix the value.

### Module Architecture

- **Every module follows: routes → controllers → services → 
  repositories → storage.** Don't skip layers.
  - Routes only delegate; never contain business logic.
  - Controllers parse input, call service, format response.
  - Services contain business logic.
  - Repositories own DB access.

- **Don't import across module boundaries via internal paths.** 
  If module A needs something from module B, it goes through B's 
  service layer, not directly into B's repository.

- **Don't add raw `db.insert` / `db.update` / `db.delete` calls 
  in services.** Use the repository layer. Raw calls bypass UUID 
  generation and other invariants.

### Duplicate Files

- **Never create a file with a name that already exists elsewhere 
  in the repo** (e.g., two `jobService.ts`, two `WorkOrderForm*.tsx`). 
  Before adding a new file, grep for the basename. If a duplicate 
  exists, edit the existing one or rename.

- **Before adding validation/logic to a file, confirm it's on the 
  live code path.** Routes → controllers chain must reach it. 
  Otherwise the code is dead.

### Express Routes

- **More specific routes must register before more generic ones.** 
  `/x/:specific` before `/x/:generic`. Express matches first 
  registered.

- **Avoid colliding param shapes** like `GET /things/:vesselId` and 
  `GET /things/:id`. One will silently shadow the other. Use 
  distinct paths: `GET /things/details/:id`.

### Package Versions

- **AG Grid is license-capped:**
  - `ag-charts-enterprise`: pinned to `12.3.0`
  - `ag-charts-react`: pinned to `12.3.0`
  - `ag-grid-community`: pinned to `34.1.0`
  - `ag-grid-enterprise`: pinned to `34.1.0`
  - `ag-grid-react`: pinned to `34.1.0`
  
  Do NOT upgrade. Newer versions require a new license we don't 
  have. Pin exactly (no `^` or `~`).

- **For all licensed/critical deps:** prefer exact pins. The caret 
  prefix lets npm drift on `npm install`.

### Sync Layer

- **Don't modify `shared/syncConfig.ts`, `server/modules/sync/`, 
  or the field logger without explicit instruction.** Sync is the 
  highest-risk surface. Additive column changes to synced tables 
  are usually picked up by full-row sync; ask before touching the 
  sync infrastructure itself.

- **Synced text columns must not have CHECK constraints or enums** 
  that would reject new values flowing from the other side.

### Pre-Commit Checklist

Before pushing any commit:

1. `npx tsc --noEmit` — count must not exceed baseline (374). 
   Do not increase.
2. If you added a migration: re-run it locally to verify 
   idempotency.
3. If you edited a file with a duplicate basename: confirm you 
   edited the one on the live path.
4. If you added an Express route: confirm no `:param` collision 
   with an earlier-registered route.

## Investigation Standards (added 2026-08-03 — read before reporting any finding)

These rules exist because investigations reached confident conclusions that were
wrong: an RBAC divergence the investigation itself had engineered, stale-RH counts
measured against the wrong column, an "SSO linkage bug" that was a tenant setting,
IHM usage assumed without asking the product owner. Each was caught only by the
user pushing back. The failure mode is never "didn't investigate" — it is stating
conclusions at a confidence the evidence doesn't carry.

### Label every finding with its evidence class

- **PROVEN** — tested live on the pilot (or production data), with the output shown.
- **READ** — concluded from reading code. This is a hypothesis, not a result.
- **INFERRED** — deduction from other facts. Weakest class; say what it rests on.

Never present one class in the language of a stronger one. "X happens" is reserved
for PROVEN; code-reading gets "the code says X — untested."

### Rules

1. **Pilot before conclusion — and account for it either way.** If the shore+ship
   pilot can answer the question, run it there before reporting. EVERY report states
   explicitly whether the pilot was used; if it was not, state why not (e.g.
   production-only data, WK-tenant-specific, VSAT behaviour). The reader sees the
   gap — they never have to infer it. This is not left to judgement silently.

2. **Name what would disprove you.** Every report states the untested assumptions
   its conclusion rests on. The reader must never have to discover them.

3. **Never assume product usage.** Whether a feature is used, by whom, in which
   direction — that is a question for Ghazi or the product owner (Jeevan), not for
   inference from schema or code. "I don't know — ask Jeevan" is a complete and
   acceptable answer, and better than a wrong guess stated confidently.

4. **Fixtures prove repairs, not occurrence.** A state you created to test a fix
   proves the fix handles that state. It does NOT prove the state occurs in
   production. Say which one you have.

5. **One sample is a data point, not a pattern.** One column, one vessel, one query
   result — report it as a data point and say what a second sample would need to
   show before generalising.

6. **Retract loudly.** When a conclusion falls, say plainly what was wrong and why
   the process let it through — in the report and in the memory that recorded it.

7. **Confirm the problem is real before designing the fix.** Before planning a
   repair, state what evidence shows the problem occurs in production — not that
   the mechanism exists in code, but that it has happened or can happen to a live
   vessel. If that evidence doesn't exist, say so and ask, rather than proceeding.
   A mechanism proven in code with no production evidence is a finding, not a
   justification to build.
