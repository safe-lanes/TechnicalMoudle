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
