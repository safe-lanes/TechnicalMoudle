# Seafarer Technical Management System

## Overview
This project is a full-stack Technical Module for a maritime Planned Maintenance System (PMS). Its primary purpose is to manage technical equipment maintenance, scheduling, and performance tracking within the maritime industry. Key capabilities include Certificate & Surveys management, Defect Reporting, and core PMS operations.

## User Preferences
Preferred communication style: Simple, everyday language.

---

## CRITICAL RULES — MUST FOLLOW ALWAYS

### Rule 1: NEVER Modify These Files
These files are **FROZEN** and must NEVER be modified under any circumstances:
- `shared/schema.ts` — Drizzle table definitions (shared between frontend and backend)
- `server/migrations.ts` — Contains 52 frozen code-based migrations (001-052)
- `migrations/*.sql` — Auto-generated Drizzle SQL migration files (44 files)

**Why?** These files are the backbone of the dual migration system. Any modification can corrupt database state across all deployments.

**If you need a schema change**: Update `shared/schema.ts` ONLY if you are explicitly asked to add a new table or column. Then run `drizzle-kit generate` to create a new migration SQL file. NEVER edit existing migration files.

### Rule 2: Module-Based Architecture (server/modules/)
All backend code is organized into **domain modules** under `server/modules/`:
```
server/modules/
├── alerts/          ├── fleet/           ├── spares/
├── bulk-upload/     ├── forms/           ├── stores/
├── cert-surveys/    ├── jobs/            ├── vessels/
├── change-requests/ ├── misc/            ├── work-orders/
├── chatbot/         ├── reports/
├── components/      ├── running-hours/
├── dashboard/       ├── shared/
```

**Rules:**
- New features go into the appropriate module directory
- Each module has: `routes.ts` (endpoints), optional `schemas.ts` (validation), service files
- Import shared utilities from `server/modules/shared/`
- Do NOT add new route handlers directly to `server/routes.ts` — use module routes instead
- Do NOT create new files in `server/` root — use the module structure

### Rule 3: UUID-Based Identity System (V2 Architecture)
The system uses **canonical UUID columns** as the primary identity for FK relationships:

| Table | UUID Column | Used as FK Target |
|-------|-------------|-------------------|
| `vessels` | `vuuid` | All vessel_id FKs reference `vessels.vuuid` |
| `components` | `cuuid` | All component_id FKs reference `components.cuuid` |
| `jobs` | `juuid` | All job_id FKs reference `jobs.juuid` |
| `work_orders` | `wouuid` | All work_order_id FKs reference `work_orders.wouuid` |

**Rules:**
- When creating records that reference vessels/components/jobs/work_orders, always use the UUID column (vuuid/cuuid/juuid/wouuid), NOT the old `id` column
- The old `id` columns (e.g., `COMP-xxx`, `JOB-xxx`, `WO-xxx`) are legacy and should NOT be used for new FK references
- When querying related data, join on UUID columns

### Rule 4: Immutable Tables
`component_maintenance_history` has an **immutability trigger** — it is INSERT-only. No UPDATE or DELETE operations are allowed on this table at runtime.

If you need to modify data in this table during migrations, you must:
```sql
ALTER TABLE component_maintenance_history DISABLE TRIGGER ALL;
-- your UPDATE/DELETE statements here
ALTER TABLE component_maintenance_history ENABLE TRIGGER ALL;
```

### Rule 5: Port Configuration
The server port is configured via environment variable:
```typescript
const port = parseInt(process.env.PORT || "5000", 10);
```
- **Replit**: Uses port 5000 (default)
- **External deployments**: Set `PORT` env var as needed
- **NEVER hardcode a port number** in `server/index.ts`

### Rule 6: Production vs Development Detection
```typescript
const clientIndexHtml = path.resolve(import.meta.dirname, "..", "client", "index.html");
const isDevelopment = app.get("env") === "development" && fs.existsSync(clientIndexHtml);
```
- In development: `setupVite()` runs (hot reload)
- In production: `serveStatic()` serves from `dist/public/`
- Do NOT change this detection logic

### Rule 7: API Route Prefix
All API endpoints MUST use the `/technical/api` prefix:
```typescript
app.get('/technical/api/your-endpoint', ...)
```

### Rule 8: Vessel Data Source Strategy
The `useVessels()` hook in `client/src/hooks/useVessels.ts` handles vessel data from two sources:
- **Local DB** (`/technical/api/vessels`) — returns `vuuid` field
- **External API** — returns `vuid` field

The mapping chain handles both: `entry.vuid || entry.vuuid || entry.vesselId || entry.id`
Do NOT modify this fallback chain without understanding both data sources.

---

## Dual Migration System — How It Works

### Two Migration Systems Run on Startup:
1. **Code-based migrations** (`server/migrations.ts`): 52 migrations (001-052), tracked in `schema_migrations` table
2. **Drizzle SQL migrations** (`migrations/*.sql`): 44+ auto-generated files, also tracked in `schema_migrations`

### Startup Sequence:
```
initStorage() → runBackupAndMigrations() → initializeDatabase() → registerRoutes()
```

Where `runBackupAndMigrations()` does:
1. `pg_dump` backup
2. `runMigrations()` — executes code-based migrations from `server/migrations.ts`
3. Schema change detection + `drizzle-kit generate` if needed
4. `runDrizzleMigrations()` — executes SQL files from `migrations/` folder

### Adding New Schema Changes:
1. Edit `shared/schema.ts` with your change
2. The system auto-detects changes on `npm run dev` and generates a new migration SQL file
3. The migration runs automatically on next startup
4. NEVER manually create migration files or edit existing ones

---

## Database Safety Rules

### Before Adding FK Constraints:
Always clean up orphaned references FIRST:
```sql
-- For NULLABLE columns: set orphans to NULL
UPDATE child_table SET parent_id = NULL
WHERE parent_id IS NOT NULL
AND parent_id NOT IN (SELECT uuid_col FROM parent_table);

-- For NOT NULL columns: DELETE orphaned rows
DELETE FROM child_table
WHERE parent_id IS NOT NULL
AND parent_id NOT IN (SELECT uuid_col FROM parent_table);
```

### Migration Safety Patterns:
- Always use `IF NOT EXISTS` / `IF EXISTS` guards:
  ```sql
  ALTER TABLE x ADD COLUMN IF NOT EXISTS col_name TEXT;
  ALTER TABLE x DROP CONSTRAINT IF EXISTS constraint_name;
  ```
- Wrap FK creation in DO blocks:
  ```sql
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_name') THEN
      ALTER TABLE child ADD CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES parent(uuid_col);
    END IF;
  END $$;
  ```

### Error Handling in Migrations:
Both migration runners catch and skip these non-fatal errors:
- `already exists` (42701)
- `does not exist` (42704)
- `duplicate table` (42P07)

---

## Project Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL 16
- **AI**: OpenAI GPT-4o (via Replit AI Integration)
- **Storage**: Replit Object Storage (for document uploads)

### Key Files (Read-Only Reference)
| File | Purpose |
|------|---------|
| `shared/schema.ts` | All Drizzle table definitions — single source of truth |
| `server/migrations.ts` | 52 frozen code-based migrations |
| `server/routes.ts` | Main route registration (delegates to modules) |
| `server/postgresStorage.ts` | PostgreSQL storage implementation |
| `server/storageFactory.ts` | Chooses between PostgreSQL and MemStorage |
| `server/index.ts` | Server entry point, startup sequence |
| `server/initDb.ts` | Table initialization logic |

### Key Directories
| Directory | Purpose |
|-----------|---------|
| `server/modules/` | Domain-specific backend modules |
| `server/services/` | Shared business logic services |
| `client/src/pages/` | React page components |
| `client/src/hooks/` | Custom React hooks |
| `client/src/components/` | Reusable UI components |
| `scripts/` | Utility scripts (data verification, debugging) |

### Data Baseline (Reference)
- **75+ tables** across the schema
- Key tables with data: `spare_component_links`, `spare_location_stock`, `inventory_transactions`, `spares`, `jobs`, `components`, `work_orders`
- `component_maintenance_history` — immutable audit trail

---

## Fleet Table Schema Contract
All Fleet-related tables (`fleet_*`) MUST include these mandatory columns:
```typescript
{table_name}_uuid: text("{table_name}_uuid").default(sql`gen_random_uuid()`),
sortOrder: integer("sort_order").default(0),
createdAt: timestamp("created_at").defaultNow(),
updatedAt: timestamp("updated_at").defaultNow(),
createdByUuid: text("created_by_uuid"),
updatedByUuid: text("updated_by_uuid"),
isDeleted: boolean("is_deleted").default(false),
isSync: boolean("is_sync").default(false),
```

---

## UI/UX Standards
- Mobile-first responsive design
- AG Charts React for visualizations, AG Grid Enterprise for data tables
- `p-6` padding for main content, `space-y-6` for vertical spacing
- Delta UI Pattern for mapping/selection dialogs
- Work Order forms: single-page scrollable with numbered subsections
- All dashboard charts use real database data (no hardcoded/fake data)

---

## Common Pitfalls — AVOID These

1. **Hardcoding port 5000 or 5002** — Use `process.env.PORT || "5000"`
2. **Using old ID formats** (COMP-xxx, JOB-xxx, WO-xxx) for FK references — Use UUID columns (cuuid, juuid, wouuid)
3. **UPDATE/DELETE on component_maintenance_history** without disabling triggers — Will fail silently or throw error
4. **Adding FK constraints without orphan cleanup** — Will crash on databases with stale data
5. **Modifying server/migrations.ts** — These are frozen, append-only
6. **Modifying migrations/*.sql files** — These are auto-generated and tracked
7. **Adding routes to server/routes.ts directly** — Use module routes in server/modules/
8. **Using UPDATE SET NULL on NOT NULL columns** — Use DELETE instead for orphan cleanup
9. **Ignoring IF EXISTS guards in SQL** — Always use them for idempotent migrations

---

## External Dependencies
- **Frontend**: `@radix-ui/*`, `@tanstack/react-query`, `wouter`, `tailwindcss`, `lucide-react`, `ag-grid-enterprise`, `ag-charts-react`
- **Backend**: `express`, `drizzle-orm`, `@neondatabase/serverless`, `connect-pg-simple`
- **Development**: `vite`, `typescript`, `drizzle-kit`, `tsx`
- **AI**: OpenAI GPT-4o (via Replit AI Integration)
