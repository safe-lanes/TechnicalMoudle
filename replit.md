# Maritime Planned Maintenance System (PMS)

## Overview

A full-stack maritime Technical Management System for vessel operations, maintenance, inventory, and compliance. Built with React 18 + TypeScript (Vite, Tailwind) on the frontend, Express.js backend, and PostgreSQL 16 with Drizzle ORM.

**Tech Stack:**
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI, AG Grid, wouter (routing), TanStack Query
- Backend: Express.js, TypeScript, tsx (dev runner)
- Database: PostgreSQL 16, Drizzle ORM
- UI: Shadcn/ui components, Lucide React icons

**Key Modules:**
- **PMS**: Jobs, Work Orders, Running Hours — core maintenance scheduling and execution
- **Components**: Hierarchical equipment tree with SFI coding
- **Spares & Stores**: Inventory management (consumption, receiving, location-based stock)
- **Defects**: Technical deficiency tracking with wizard-based creation
- **Certificates & Surveys**: Vessel certification and statutory survey tracking
- **Noon Report**: Daily vessel performance reporting (fuel, position, CII)
- **Access Control**: Role-based menu permissions with recursive nested menus
- **Alerts Engine**: Overdue tasks, low stock, and skipped maintenance alerts

## Migration System Standards (CRITICAL — READ FIRST)

This project has a strict migration workflow that AI agents MUST follow. The workflow was fixed in commit `54f319fa` after a race condition caused the 085_master_list_types incident.

### Rules for AI Agents (Replit Agent and Claude Code)

**When modifying `shared/schema.ts` to add or change a table/column:**

1. Edit `shared/schema.ts` with the change
2. Run `npm run db:generate` — this creates a new migration file in `migrations/` folder
3. Review the generated SQL file for correctness
4. The server will automatically apply the migration on next startup via `runDrizzleMigrations()`

**DO NOT use `db:push` for schema changes.** `db:push` is for FRESH INSTALLS ONLY (brand new laptops or forks with empty databases). Running it on an existing database causes schema drift and corrupts migration tracking.

**DO NOT expect server startup to auto-create migration files.** The old `generateDrizzleMigrations()` call was removed from the startup pipeline in commit `54f319fa`. The server now only APPLIES migrations, never creates them. If you skip the `db:generate` step, the schema change will silently fail to propagate.

### Multi-Statement Migration Execution

Drizzle-generated migration files contain multiple SQL statements separated by `--> statement-breakpoint` markers. The migration runner (`runDrizzleMigrations` in `server/migrations.ts`) splits on these markers and executes each statement INDIVIDUALLY rather than sending the whole file as one batch.

This prevents a dangerous silent-failure bug where if statement 1 of a multi-statement file failed with "already exists" (for example, because a hand-written migration already created a table the Drizzle file also tries to create), PostgreSQL would abort the entire batch. The old error handler would then mark the whole migration as complete, silently discarding statements 2, 3, 4, etc. This caused the `jobs.assigned_to_rank_id` column to be lost in production (fixed in commit `71211289`).

Current safe behavior:
- **Drizzle-generated files** (`0XXX_*.sql` with `→ statement-breakpoint`): each statement executes separately; individual statements can be skipped for idempotency errors (`42P07` duplicate_table, `42701` duplicate_column, `42704` undefined_object) without affecting subsequent statements
- **Hand-written files** (`0XX_*.sql` without breakpoint markers): still execute as single batch, relying on `IF NOT EXISTS` / `ON CONFLICT` / `DO $$` blocks for idempotency

For AI agents: If you hand-write a migration file with multiple DDL statements that need independent idempotency handling, add `--> statement-breakpoint` markers between statements to get per-statement error handling. Otherwise, wrap the whole statement in `DO $$ BEGIN...EXCEPTION WHEN duplicate_object THEN NULL; END $$` blocks.

### Database Default Values — IMPORTANT

When a column needs an auto-generated default value (UUIDs, timestamps), ALWAYS use `.default(sql\`...\`)`, NEVER use `.$defaultFn(...)`.

**Wrong (causes raw SQL inserts to fail with NOT NULL violation):**
```typescript
mltuuid: text("mltuuid").notNull().unique().$defaultFn(() => crypto.randomUUID())
```

**Right (works for both Drizzle ORM AND raw SQL migration inserts):**
```typescript
mltuuid: text("mltuuid").notNull().unique().default(sql`gen_random_uuid()::text`)
```

`$defaultFn` is JavaScript-side only — it does NOT generate a DB-level SQL DEFAULT. When a migration uses raw SQL INSERT, it bypasses Drizzle ORM and hits the database directly. Without a DB-level DEFAULT, the INSERT fails. This is what caused the migration 085 incident.

### Migration File Types

There are 3 tracks in the `migrations/` folder:

1. **Drizzle auto-generated** (4-digit `0XXX_*.sql`) — created by `npm run db:generate`, contain baseline schema (CREATE TABLE, ALTER, INDEX). Review before committing.

2. **Hand-written** (3-digit `0XX_*.sql`) — manually written for data seeds, partial indexes, idempotent repairs, anything Drizzle can't express. MUST use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$` guards.

3. **Legacy JS array** (in `server/migrations.ts`, entries 001-081) — FROZEN. Do NOT add new entries. All new migrations go in the `migrations/` folder.

### Sort Order (Important)

4-digit `0XXX_*.sql` files sort BEFORE 3-digit `0XX_*.sql` files alphabetically. This is intentional design. Auto-generated files create the baseline schema first, then hand-written files add ALTERs/seeds/repairs on top.

### Required Columns for New Tables

Every new table in `shared/schema.ts` must have:
- `{prefix}uuid` (e.g., `vuuid`, `cuuid`, `juuid`) — TEXT NOT NULL UNIQUE with `.default(sql\`gen_random_uuid()::text\`)`
- `createdAt` — TIMESTAMP NOT NULL `.defaultNow()`
- `updatedAt` — declare via the shared helper `updatedAtColumn()` from `shared/schemaHelpers.ts` (use `updatedAtColumnTz()` for the timezone-aware variant). The helper bakes in `NOT NULL`, `defaultNow()`, and `$onUpdateFn(() => new Date())` so that `updated_at` auto-advances on every ORM UPDATE. **Residual gaps not covered by the hook**: raw `db.execute(sql\`UPDATE …\`)` calls, `.onConflictDoUpdate({ set: { ... } })` clauses, and any `UPDATE` inside `server/migrations.ts` / `migrations/*.sql` files — for those paths set `updated_at` explicitly.
- `createdByUuid` — TEXT
- `updatedByUuid` — TEXT
- `isDeleted` — BOOLEAN NOT NULL `.default(false)`
- `isSync` — BOOLEAN NOT NULL `.default(false)`

These columns enable the upcoming ship-cloud bidirectional sync per the Sync Readiness Analysis.

### Workflow Applies Everywhere

This same workflow applies to Replit forks, DEV server, and PROD server. There is no environment-based gating. All environments behave identically: migrations are only applied, never generated at startup.

### Removed Migrations

Historical record of migration entries deleted from source. The corresponding rows in `schema_migrations` are intentionally left in place to preserve applied markers and prevent id collisions.

- **`061_placeholder`** — Removed from `server/migrations.ts` (Task #121). Was a no-op data seed inserting four `TEST-L5-*` work orders against a non-existent vessel UUID; flagged as Skipped in `schema_migrations` on 2026-03-12 and never produced any rows. Subsequent migrations (062+) have no dependency on the seed. The 060 → 062 gap in the source array is intentional.

## Project Structure

```
client/src/
  pages/           — Page components (pms/, stores/, spares/, defects/, admin/)
  components/      — Reusable UI components (ui/ for shadcn primitives)
  contexts/        — Global state (Auth, Vessel, Permissions, Offline)
  hooks/           — Custom hooks (useVessels, usePermissions, useToast)
  lib/             — Utilities (queryClient, utils)

server/
  index.ts         — Entry point (init DB, storage, routes, background services)
  routes.ts        — Central router mounting module-specific routers
  storage.ts       — IStorage interface
  postgresStorage.ts — PostgreSQL implementation of IStorage
  migrations.ts    — Legacy migration runner (entries 001-081, FROZEN)
  middleware/auth.ts — requireAuth, requirePMSAdmin middleware
  modules/         — Feature modules (access-control, stores, spares, etc.)

shared/
  schema.ts        — Drizzle ORM schema definitions (single source of truth)
  utils/           — Shared utilities

migrations/        — SQL migration files (auto-generated + hand-written)
```

## Access Control Pattern

- **Backend**: `requireAuth` on GET routes, `requirePMSAdmin` on write routes (POST/PUT/PATCH/DELETE)
- **Frontend**: `usePermissions()` hook provides `canCreate/canEdit/canDelete("pms-{resource}")` flags
- **Database**: `adm_menumaster_ac` (menus), `admn_role_master` (roles), `adm_role_menu_access` (role-menu permissions with can_view/can_create/can_edit/can_delete)
- **UIRole types**: `Sail_Admin | Client_Admin | Tech_Superintendent | Head_of_Dept | Vessel | External`
- **Write-capable backend roles**: "PMS Admin", "Sail Admin" (checked by `requirePMSAdmin`)

## Authentication

- Dev environment uses mock auth (always injects Sail Admin user)
- Mock auth middleware defined in `server/middleware/auth.ts`

## Purchasing

The **Purchasing** entry in the top navigation bar (`client/src/components/TopMenuBar.tsx`) is currently a **placeholder icon only**. It is reserved for a future external Purchasing system that will be reached via a JWT-based SSO browser redirect.

**Planned integration shape (NOT yet implemented):**

- The integration partner will provide a redirect URL plus a JWT (token issuance / refresh mechanism TBD).
- On click of the Purchasing top-nav entry, the app should redirect the browser to that URL carrying the JWT so the user lands logged-in on the Purchasing side.
- The exact token carrier (query param vs `Authorization` header on a server bounce vs hidden form POST) will be decided once the partner publishes their contract.
- Config (URL, secret/keys for signing if any) should live in environment variables, never hard-coded.

**Current state:**

- Top-nav button is rendered to the right of Admin using the `ShoppingCart` Lucide icon.
- Click handler shows a "Coming soon" toast — there is no route, no side menu, no API call.
- Visibility currently bypasses `hasAnyChildAccess('purchasing')` via a `bypassPermissionCheck` flag (no menu-master row exists yet). Once a `purchasing` menu row is seeded, remove that flag so role-based permissions take over.

When the integration URL and token contract become available, wire the redirect into the placeholder click handler in `TopMenuBar.tsx` — do not introduce a separate component.

## Running the Project

```bash
npm run dev          # Start Express + Vite dev server on port 5000
npm run db:generate  # Generate Drizzle migration after schema.ts changes
npm run db:push      # FRESH INSTALL ONLY — sync schema to empty database
```

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

# Repository rules for the Replit agent — TechnicalMoudle

These rules exist because past agent runs damaged the repository. Follow them exactly on every task, unless the human explicitly overrides them in the same message.

## 1. package.json and package-lock.json — DO NOT MODIFY

- Never run `npm install`, `npm update`, `npm audit fix`, or add/remove/upgrade a dependency unless the human's task explicitly says "add package X".
- Never commit changes to `package.json` or `package-lock.json` that you did not intentionally make. Before every commit run `git status`; if either file appears and the task did not ask for a dependency change, discard it:
  `git checkout -- package.json package-lock.json`
- If a dependency change IS requested, install against the public registry only:
  `npm install <package> --registry https://registry.npmjs.org`
  then verify the lockfile is clean before committing — this MUST print `0`:
  `grep -c "package-firewall.replit.local" package-lock.json`
  A lockfile containing `package-firewall.replit.local` breaks `npm install` on every machine outside Replit (dev server, production server, developer laptops). This happened on 17-Aug-2026 and had to be repaired by hand.
- Never change these pinned versions — they are license-capped and must stay EXACT (no `^` or `~`): ag-grid-community 34.1.0, ag-grid-enterprise 34.1.0, ag-grid-react 34.1.0, ag-charts-enterprise 12.3.0, ag-charts-react 12.3.0.

## 2. Files you must not create or commit

- No stray files in the repository root. Only commit files the task actually needs.
- Never commit `.env`, secrets, tokens, or API keys.
- Never commit build output (`dist/`), `node_modules/`, screenshots, or scratch files.
- The jspdf stub files (`client/src/lib/stubs/jspdf*.ts` and the matching alias in `vite.config.ts`) exist ONLY to make this workspace build. They are removed when code is merged to the main branch. Do not extend, rely on, or reference them in new code.

## 3. Migrations

- Before creating a migration, pull the latest code and list `migrations/` — take the next free number AFTER the highest existing one. Number 144 is RESERVED; do not use it.
- Migrations must be idempotent (`IF NOT EXISTS`, `ON CONFLICT ... DO NOTHING`, `CREATE OR REPLACE`) — a second run must produce zero errors and zero new rows.
- Never hardcode primary-key ids in seed inserts; look rows up by name.
- Never edit `shared/schema.ts`, `server/migrations.ts`, or existing migration files unless the task explicitly requires a schema change.

## 4. Sync layer — hands off

- Do not modify `shared/syncConfig.ts`, anything under `server/modules/sync/`, or the field logger unless the task explicitly says so. These are the highest-risk files in the codebase.
- If your change adds a column to a table that syncs between ship and shore, state that clearly in the commit message.

## 5. Before every commit

1. Run `npx tsc --noEmit` — the error count must not increase (current baseline: 290).
2. Run `git status` — confirm ONLY the files your task touched are staged. Unstage anything else, especially package files.
3. Write a commit message that states WHAT changed and WHY, and lists any migration number used.

## 6. When unsure

Do not guess and do not "fix" things you were not asked to fix. Stop and ask the human. A smaller, correct change is always better than a larger one that touches files outside the task.
