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
NODE_ENV=development npx tsx server/index.ts
```
- Server binds to port **5000** (not the PORT in .env)
- `cross-env` removed from package.json — use bash env prefix syntax
- `EXTERNAL_MASTER_DATA_URL_DEV` is mandatory (can be dummy URL for local dev)

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
  committing. If new errors appear in your diff, fix them or revert 
  the offending lines. Current baseline: 372.

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

1. `npx tsc --noEmit` — count must not exceed baseline (372).
2. If you added a migration: re-run it locally to verify 
   idempotency.
3. If you edited a file with a duplicate basename: confirm you 
   edited the one on the live path.
4. If you added an Express route: confirm no `:param` collision 
   with an earlier-registered route.
