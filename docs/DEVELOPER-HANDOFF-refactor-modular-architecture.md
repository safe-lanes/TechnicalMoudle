# Developer Handoff: `refactor/modular-architecture` Branch

**Date:** 2026-02-23
**Branch:** `refactor/modular-architecture`
**Repo:** `github.com/safe-lanes/TechnicalMoudle`
**Head Commit:** `1059c648`

---

## 1. What Changed

This branch contains two major backend changes:

### A. Backend Modularization (17 commits)

The monolithic `server/routes.ts` (21,000+ lines) has been decomposed into 18 domain modules under `server/modules/`:

| Module | Domain |
|--------|--------|
| `vessels` | Vessel CRUD, fleet assignments |
| `components` | Equipment hierarchy, documents, class regulatory |
| `jobs` | Maintenance jobs, planning, due scanning |
| `work-orders` | Work orders, execution, completion, postponement |
| `running-hours` | Running hours tracking, logs, audit |
| `spares` | Spare parts, inventory transactions, stock |
| `stores` | Stores items, transactions, ledger |
| `defects` | Defects, actions, attachments, recurring links |
| `fleet` | Fleet admin, master data, copy-vessel, bulk import |
| `cert-surveys` | Certificates, surveys, ship certificates |
| `reports` | All report generation (equipment, maintenance, spares, compliance, operations) |
| `change-requests` | Change request workflow |
| `alerts` | Alert policies, events, deliveries, config |
| `forms` | Form definitions, versions, runtime schema |
| `bulk-upload` | Bulk CSV/XLSX import processing |
| `chatbot` | AI chatbot integration |
| `misc` | Documents, admin utilities |
| `dashboard` | Dashboard metrics |

Each module follows the pattern: `controllers/` > `services/` > `repositories/`

`server/routes.ts` is now 843 lines (route registration only).

### B. FK Identity Restructure (10 migrations, FK-1 through FK-10)

All major tables now have UUID identity columns with enforced FK constraints:

| Migration | Table | UUID Column | FK Constraints |
|-----------|-------|-------------|----------------|
| FK-1 | `vessels` | `vuuid` | 33 child FKs |
| FK-2 | `components` | `cuuid` | 15 child FKs |
| FK-3 | `jobs` | `juuid` | 4 child FKs |
| FK-4 | `work_orders` | `wouuid` | 5 child FKs |
| FK-5 | `spares` | `suuid` | 4 child FKs |
| FK-6 | `stores_items` | `stuuid` | 1 child FK |
| FK-7 | `defects` | `duuid` | 3 child FKs |
| FK-8 | `alert_policies` / `alert_events` | `apuuid` / `aeuuid` | 2 child FKs |
| FK-9 | `form_definitions` / `form_versions` | `fduuid` / `fvuuid` | 2 child FKs |
| FK-10 | `bulk_import_history` | `biuuid` | 1 child FK |

**Total: 72 UUID-based FK constraints** enforced at the database level.

All UUID columns are `TEXT NOT NULL UNIQUE`. Migrations are idempotent (safe to re-run).

---

## 2. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v22.x |
| PostgreSQL | 14+ |
| npm | 10.x |

---

## 3. Setup Instructions

### Step 1: Clone and checkout

```bash
git clone https://github.com/safe-lanes/TechnicalMoudle.git
cd TechnicalMoudle
git checkout refactor/modular-architecture
git pull origin refactor/modular-architecture
npm install
```

### Step 2: Create `.env` file

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgres://<user>:<password>@<host>:5432/<database>"
```

Replace `<user>`, `<password>`, `<host>`, and `<database>` with your dev server PostgreSQL credentials.

### Step 3: Start the server

```bash
npm run dev
```

On first startup, the server will:
1. Connect to PostgreSQL (falls back to in-memory if `DATABASE_URL` is missing)
2. Run all pending migrations automatically (51 custom migrations tracked in `schema_migrations` table)
3. Run Drizzle auto-generated migrations (25 schema sync migrations in `migrations/` folder)
4. Start the Express server on the configured PORT

**Expected startup log (success):**

```
DATABASE_URL: FOUND
[StorageFactory] PostgreSQL connection verified
[StorageFactory] Using PostgreSQL storage
Storage initialization complete
Running database migrations...
Migrations complete: <N> applied, <M> skipped
serving on port 5000
```

### Step 4: Verify migrations applied

After startup, confirm all 51 custom migrations are tracked:

```sql
SELECT COUNT(*) FROM schema_migrations;
-- Expected: 51

SELECT id FROM schema_migrations WHERE id LIKE '050%' OR id LIKE '051%';
-- Should return:
--   050_bulk_import_history_biuuid_column
--   051_bulk_import_errors_import_uuid_and_fk
```

---

## 4. Database Migration Details

### Migration System

This project uses a **dual migration system**:

1. **Custom SQL migrations** (`server/migrations.ts`): 51 migrations (001-051), append-only, idempotent. These run first on every server startup.
2. **Drizzle auto-generated** (`migrations/*.sql`): 25 migrations generated from `shared/schema.ts` diffs. These run after custom migrations.

Both are tracked in the `schema_migrations` table. All migrations are idempotent (use `IF NOT EXISTS`, `WHERE ... IS NULL` guards).

### If migrating an existing database

If your dev database already has data from an earlier version of the branch:

- Migrations are safe to re-run (idempotent SQL with guards)
- UUID columns will be backfilled with `gen_random_uuid()` for any existing rows
- FK constraints will be created only if they don't already exist
- Zero data loss is expected (verified against production baseline of 10,107 rows across 75 tables)

### If starting with a fresh database

The server will create all tables and apply all migrations on first startup. No manual SQL is needed.

---

## 5. Verification Scripts

Run these after setup to confirm everything is working:

### Data integrity check

```bash
DATABASE_URL="postgres://..." npx tsx scripts/verify-data-integrity.ts
```

Expected output: `ALL DATA INTACT - zero data loss detected`

### FK constraint verification

```bash
DATABASE_URL="postgres://..." npx tsx scripts/fk-final-verification.ts
```

Expected output: `ALL CHECKS PASSED - FK identity restructure complete`

This script verifies:
- All 12 parent UUID columns exist
- All 72 FK constraints are active
- Zero NULL UUIDs
- All UNIQUE and NOT NULL constraints in place

---

## 6. Key Files Changed

| File | Change |
|------|--------|
| `shared/schema.ts` | Added UUID columns to 12 tables, FK references on child tables |
| `server/migrations.ts` | 25 new migrations (027-051) for UUID columns + FK constraints |
| `server/postgresStorage.ts` | All storage methods updated to use UUID identifiers |
| `server/storage.ts` | Interface signatures updated (number -> string for IDs) |
| `server/routes.ts` | Reduced from 21K to 843 lines (delegates to modules) |
| `server/modules/**` | 18 new modules with controller/service/repository layers |
| `migrations/*.sql` | 7 new Drizzle auto-generated migrations (0019-0025) |

---

## 7. API Breaking Changes

### ID parameters changed from integer to UUID string

The following API endpoints now expect UUID strings instead of integer IDs in URL params:

**Affected endpoints (representative list):**

- `GET /api/vessels/:id` — `:id` is now `vuuid` (UUID string)
- `GET /api/components/:id` — `:id` is now `cuuid`
- `GET /api/jobs/:id` — `:id` is now `juuid`
- `GET /api/work-orders/:id` — `:id` is now `wouuid`
- `GET /api/spares/:id` — `:id` is now `suuid`
- `GET /api/stores/:id` — `:id` is now `stuuid`
- `GET /api/defects/:id` — `:id` is now `duuid`
- `GET /api/bulk-import/history/:id` — `:id` is now `biuuid`
- All corresponding `PUT`, `PATCH`, `DELETE` endpoints

**Frontend impact:** Any frontend code that passes integer IDs to these endpoints must be updated to use the UUID values returned by list/create endpoints.

---

## 8. Testing Checklist

After pulling and starting the server, verify the following:

### Server startup
- [ ] Server starts without errors
- [ ] PostgreSQL connection established (not MemStorage)
- [ ] All migrations apply successfully
- [ ] No port conflicts (PORT in .env)

### Core CRUD operations
- [ ] List vessels — `GET /api/vessels`
- [ ] Get single vessel — `GET /api/vessels/:vuuid`
- [ ] List components — `GET /api/components?vesselId=<vuuid>`
- [ ] List jobs — `GET /api/jobs?vesselId=<vuuid>`
- [ ] List work orders — `GET /api/work-orders?vesselId=<vuuid>`
- [ ] List spares — `GET /api/spares?vesselId=<vuuid>`
- [ ] List stores — `GET /api/stores?vesselId=<vuuid>`
- [ ] List defects — `GET /api/defects?vesselId=<vuuid>`

### Module-specific features
- [ ] Reports generation (equipment, maintenance, spares)
- [ ] Running hours update and log
- [ ] Fleet admin — master data, mappings
- [ ] Bulk import — CSV/XLSX upload
- [ ] Alerts — policy CRUD
- [ ] Forms — definition and version management
- [ ] Dashboard metrics

### Data integrity
- [ ] Run `scripts/verify-data-integrity.ts` — should show ALL DATA INTACT
- [ ] Run `scripts/fk-final-verification.ts` — should show ALL CHECKS PASSED
- [ ] Spot-check: vessel list returns correct data with `vuuid` field present
- [ ] Spot-check: component detail includes `cuuid` field

---

## 9. Rollback Plan

If issues are found and rollback is needed:

```bash
git checkout <previous-branch-or-tag>
npm run dev
```

The database migrations are forward-only but non-destructive. Rolling back the code will not break the database — the extra UUID columns will simply be unused. No data is removed by any migration.

---

## 10. Commit History (Refactoring + FK Migrations)

```
1059c648 verify: complete FK identity restructure — all 72 FK constraints verified
09e61bcb migrate: bulk import history identity restructure — biuuid + 1 FK
9e6fb9d0 migrate: form definitions + versions — fduuid + fvuuid + 2 FKs
ab4667b6 migrate: alert policies + events — apuuid + aeuuid + 2 FKs
631162f1 migrate: defects identity restructure — duuid + 3 FKs
cb2ac1cd migrate: stores identity restructure — stuuid + 2 FKs
9816a0ca migrate: spare identity restructure — suuid + 4 FKs
063124e1 migrate: work order identity restructure — wouuid + 5 FKs
d945e0e7 migrate: job identity restructure — juuid + 4 FKs
6a20adda migrate: component identity restructure — cuuid + 15 FKs
d92543b5 migrate: vessel identity restructure — vuuid + 33 FKs
175ce864 refactor: complete backend modularization — routes.ts 21K → 843 lines
d2861ebf refactor: extract misc routes (documents, admin)
4c49d293 refactor: restructure chatbot into modular pattern
878ef2de refactor: restructure forms into modular pattern
dd7c2a63 refactor: restructure alerts into modular pattern
395f2788 refactor: extract bulk-upload module (7,620 lines)
d96a8b62 refactor: extract change-requests module
d459d4fc refactor: extract reports module
320e5445 refactor: extract fleet module
7f7bda72 refactor: extract cert-surveys module
a1e3478a refactor: extract defects module
5ec286b8 refactor: extract stores module
1ee765ff refactor: extract spares & inventory module
b8218103 refactor: extract running-hours module
e3c5dd86 refactor: extract work-orders module
eaa9280e refactor: extract jobs module
5bf60787 refactor: extract components module
3445791d refactor: extract vessels & fleets module
81e0bf19 feat: add modular architecture foundation
```

---

## 11. Contact

For questions about this branch, reach out to the team lead who initiated the refactoring work.
