# Module 1 Local Setup Guide

Complete setup instructions for verifying the Module 1 (Core Reference Data) migration.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database accessible (Replit provides one, or use local/Docker)
- Access to the project repository

---

## 1. Configure Environment Variables

### 1.1 Create/Edit .env file

Create a `.env` file in the project root (if not exists) or update the existing one:

```bash
# Database connection (required)
DATABASE_URL=postgresql://username:password@host:port/database

# Storage mode - controls which storage backend is used
# Options: file (default), postgres, dual
STORAGE_MODE=file

# Session secret (required for auth)
SESSION_SECRET=your-session-secret-here
```

### 1.2 For Replit Users

If using Replit's built-in PostgreSQL:
- The `DATABASE_URL` is automatically set in your environment
- You can verify it exists: `echo $DATABASE_URL`
- No manual configuration needed for database connection

### 1.3 For Local PostgreSQL

```bash
# Example for local PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seafarer_pms

# Or with Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

---

## 2. Install Node Dependencies

```bash
# Install all project dependencies
npm install
```

This installs all packages defined in `package.json`, including:
- `drizzle-orm` - Database ORM
- `drizzle-kit` - CLI for migrations and schema management
- `postgres` - PostgreSQL driver
- All frontend dependencies (React, TanStack Query, etc.)

---

## 3. Install Drizzle CLI

Drizzle CLI (`drizzle-kit`) is already included in the project's dev dependencies.

To verify it's available:

```bash
# Check drizzle-kit is installed
npx drizzle-kit --version
```

If you need to install it globally (optional):

```bash
npm install -g drizzle-kit
```

---

## 4. Push Schema to Database

This creates/updates the database tables to match the schema defined in `shared/schema.ts`.

```bash
# Push schema to PostgreSQL
npx drizzle-kit push
```

**Expected output:**
```
Reading config file '/path/to/drizzle.config.ts'
Using 'pg' driver for database querying
[✓] Pulling schema from database...
[✓] Changes applied
```

**Verify tables were created:**

```bash
# Connect to database and list tables (if using psql)
psql $DATABASE_URL -c "\dt"
```

Or run a quick check:

```bash
# Using the execute_sql tool or psql
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected tables for Module 1:
- `users`
- `fleets`
- `vessels`
- `pms_vessel_settings`

---

## 5. Run Migration Script

The migration script transfers data from `test-data.json` to PostgreSQL.

```bash
# Run Module 1 migration
npx tsx scripts/migrate-module1-core-reference.ts
```

**Expected output (first run):**
```
============================================================
Module 1: Core Reference Data Migration
============================================================

Loading data from test-data.json...
Connecting to PostgreSQL...

[TRANSACTION] Starting atomic migration...
[TRANSACTION] Any error will cause full rollback.

[fleets] Processing X records (0 existing)...
[fleets] Done: X migrated, 0 skipped

[vessels] Processing X records (0 existing)...
[vessels] Done: X migrated, 0 skipped

[users] Processing X records (0 existing)...
[users] Done: X migrated, 0 skipped

[pms_vessel_settings] Processing X records (0 existing)...
[pms_vessel_settings] Done: X migrated, 0 skipped

[TRANSACTION] All inserts successful, committing...

============================================================
Migration Summary
============================================================

fleets:
  Source records: X
  Before: 0 → After: X
  Migrated: X
  Skipped (already exist): 0

vessels:
  Source records: X
  Before: 0 → After: X
  Migrated: X
  Skipped (already exist): 0

users:
  Source records: X
  Before: 0 → After: X
  Migrated: X
  Skipped (already exist): 0

pms_vessel_settings:
  Source records: X
  Before: 0 → After: X
  Migrated: X
  Skipped (already exist): 0

------------------------------------------------------------
TOTAL: X migrated, 0 skipped
============================================================

Migration completed successfully!
```

**Check exit code:**
```bash
echo $?  # Should be 0 for success
```

---

## 6. Run Validation Script

The validation script verifies the migration was successful.

```bash
# Run Module 1 validation
npx tsx scripts/validate-module1-migration.ts
```

**Expected output (success):**
```
============================================================
Module 1: Core Reference Data Validation
============================================================

Loading data from test-data.json...
Connecting to PostgreSQL...

============================================================
Validation Summary
============================================================

fleets: ✓ PASS
  File records: X
  PostgreSQL records: X
  Count match: Yes
  Sample check: Pass

vessels: ✓ PASS
  File records: X
  PostgreSQL records: X
  Count match: Yes
  Sample check: Pass

users: ✓ PASS
  File records: X
  PostgreSQL records: X
  Count match: Yes
  Sample check: Pass

pms_vessel_settings: ✓ PASS
  File records: X
  PostgreSQL records: X
  Count match: Yes
  Sample check: Pass

============================================================
VALIDATION PASSED - All checks successful

Module 1 migration is verified and ready for use.
```

**Check exit code:**
```bash
echo $?  # Should be 0 for success
```

---

## 7. Start Backend and Frontend

### 7.1 Using npm (recommended)

```bash
# Start both backend and frontend
npm run dev
```

This runs the Express server (backend) and Vite dev server (frontend) together.

**Expected output:**
```
Server running on port 5000
```

### 7.2 For Replit Users

Click the "Run" button or use the workflow:
- The `Start application` workflow runs `npm run dev`

### 7.3 Verify the server is running

Open in browser: `http://localhost:5000`

Or check via curl:
```bash
curl -s http://localhost:5000/api/fleets | head -c 200
```

---

## 8. Set STORAGE_MODE=postgres

To switch the application to use PostgreSQL instead of file storage:

### Option A: Environment Variable (Recommended)

```bash
# Set environment variable before starting
export STORAGE_MODE=postgres
npm run dev
```

### Option B: In .env file

Edit `.env`:
```
STORAGE_MODE=postgres
```

Then restart the application.

### Option C: Inline for single run

```bash
STORAGE_MODE=postgres npm run dev
```

### Verify storage mode

Check the server logs when starting. You should see:
```
[StorageFactory] Using PostgreSQL storage
```

Or for file mode:
```
[StorageFactory] Using File storage
```

---

## 9. Verify Endpoints Manually

### 9.1 Test with curl

```bash
# Get all fleets
curl -s http://localhost:5000/api/fleets | jq

# Get all vessels
curl -s http://localhost:5000/api/vessels | jq

# Get all users (may require authentication)
curl -s http://localhost:5000/api/users | jq

# Get all PMS vessel settings
curl -s http://localhost:5000/api/pms-vessel-settings | jq

# Get PMS settings for a specific vessel
curl -s http://localhost:5000/api/pms-vessel-settings/VESSEL_ID | jq
```

### 9.2 Expected Response Structure

**GET /api/fleets**
```json
[
  {
    "id": "fleet-001",
    "code": "FL01",
    "name": "Fleet Alpha",
    "description": "...",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**GET /api/vessels**
```json
[
  {
    "id": "vessel-001",
    "name": "MV Sample",
    "code": "VS01",
    "fleetId": "fleet-001",
    "imoNumber": "1234567",
    "vesselType": "Cargo",
    "flag": "Panama",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 9.3 Test CRUD Operations

```bash
# Create a new fleet
curl -X POST http://localhost:5000/api/fleets \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST01", "name": "Test Fleet"}'

# Update a fleet
curl -X PUT http://localhost:5000/api/fleets/FLEET_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Fleet Name"}'

# Delete a fleet
curl -X DELETE http://localhost:5000/api/fleets/FLEET_ID
```

### 9.4 Compare File vs Postgres Mode

```bash
# Test with file storage
export STORAGE_MODE=file
npm run dev &
curl -s http://localhost:5000/api/fleets > /tmp/fleets-file.json

# Stop server, test with postgres storage
export STORAGE_MODE=postgres
npm run dev &
curl -s http://localhost:5000/api/fleets > /tmp/fleets-postgres.json

# Compare outputs (should be identical)
diff /tmp/fleets-file.json /tmp/fleets-postgres.json
```

---

## 10. Test Affected UI Pages

### 10.1 Access the Application

Open browser: `http://localhost:5000`

### 10.2 Login (if required)

Use credentials from your test data:
- Username: `admin` (or as defined in test-data.json)
- Password: (as defined in test-data.json)

### 10.3 Pages to Test

| Page | Path | What to Verify |
|------|------|----------------|
| Admin Dashboard | `/admin` | Shows fleet/vessel/user counts |
| Fleet Management | `/admin` → Fleets | List, Create, Edit, Delete fleets |
| Vessel Management | `/admin` → Vessels | List, Create, Assign to fleet, Edit, Delete |
| User Management | `/admin` → Users | List users, roles displayed correctly |
| PMS Settings | `/admin` → PMS Settings | View/Edit settings per vessel |
| Vessel Selector | Header/Sidebar | Dropdown shows all vessels |

### 10.4 Test Checklist

**Fleet Management:**
- [ ] Fleet list loads with correct data
- [ ] Create new fleet - verify in database
- [ ] Edit fleet name - verify change persists
- [ ] Delete fleet - verify removed from database
- [ ] Duplicate fleet code shows error

**Vessel Management:**
- [ ] Vessel list loads with correct data
- [ ] Create new vessel - verify in database
- [ ] Assign vessel to fleet - verify FK updated
- [ ] Edit vessel details - verify change persists
- [ ] Delete vessel - verify removed from database

**User List:**
- [ ] User list loads correctly
- [ ] User roles display (Ship/Office/PMS Admin)
- [ ] Vessel assignments display correctly

**PMS Vessel Settings:**
- [ ] Settings load for selected vessel
- [ ] Edit calendar lead days - verify saved
- [ ] Edit running hours thresholds - verify saved
- [ ] Location names update correctly

**Verify Database After UI Changes:**
```sql
-- Check fleets after UI create/edit
SELECT * FROM fleets ORDER BY created_at DESC LIMIT 5;

-- Check vessels after UI changes
SELECT * FROM vessels ORDER BY created_at DESC LIMIT 5;

-- Check PMS settings after UI edit
SELECT * FROM pms_vessel_settings ORDER BY updated_at DESC LIMIT 5;
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `DATABASE_URL not set` | Missing env variable | Set DATABASE_URL in .env or export |
| `relation "users" does not exist` | Schema not pushed | Run `npx drizzle-kit push` |
| `Migration failed` | Database connection issue | Check DATABASE_URL, verify DB is running |
| `0 records migrated` | Already migrated | Data exists, script is idempotent |
| UI shows empty lists | Wrong STORAGE_MODE | Set `STORAGE_MODE=postgres` and restart |
| API returns 500 | Database error | Check server logs, verify schema matches |

### Check Database Connection

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Or using Node
npx tsx -e "import { getDb } from './server/db'; getDb().then(db => console.log('Connected!')).catch(e => console.error(e))"
```

### Reset and Re-run Migration

```bash
# Clear Module 1 tables (CAUTION: deletes all data)
psql $DATABASE_URL -c "
  DELETE FROM pms_vessel_settings;
  DELETE FROM users;
  DELETE FROM vessels;
  DELETE FROM fleets;
"

# Re-run migration
npx tsx scripts/migrate-module1-core-reference.ts

# Validate
npx tsx scripts/validate-module1-migration.ts
```

---

## Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Ensure DATABASE_URL is set (check with echo $DATABASE_URL)

# 3. Push schema to database
npx drizzle-kit push

# 4. Run migration
npx tsx scripts/migrate-module1-core-reference.ts

# 5. Validate migration
npx tsx scripts/validate-module1-migration.ts

# 6. Set storage mode and start app
export STORAGE_MODE=postgres
npm run dev

# 7. Open browser and test UI
# http://localhost:5000
```

---

**Module 1 Local Setup Complete - Proceed to verification using the checklist in MODULE_1_VERIFICATION_CHECKLIST.md**
