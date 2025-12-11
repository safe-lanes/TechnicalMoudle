# Module 1: Core Reference Data - Verification Checklist

This document provides a structured verification checklist to confirm Module 1 migration was applied correctly before approving continuation to Module 2.

---

## Table of Contents

1. [Affected Backend Code](#1-affected-backend-code)
2. [Affected Frontend Code](#2-affected-frontend-code)
3. [Database Verification](#3-database-verification)
4. [Request/Response Validation](#4-requestresponse-validation)
5. [Migration Correctness Tests](#5-migration-correctness-tests)
6. [Screens/UI Flows to Test](#6-screensui-flows-to-test)

---

## 1. Affected Backend Code

### 1.1 Schema Definition (`shared/schema.ts`)

**What was changed:**
- Added `userRoleEnum` - PostgreSQL enum for user roles ('Ship', 'Office', 'PMS Admin')
- Added `users` table with 10 fields (id, username, password, fullName, email, role, vesselId, department, isActive, lastLoginAt)
- Added `fleets` table with 7 fields (id, code, name, description, isActive, createdAt, updatedAt)
- Added `vessels` table with 9 fields (id, name, code, fleetId, imoNumber, vesselType, flag, isActive, createdAt)
- Added `pmsVesselSettings` table with 13 fields (id, vesselId, calendarLeadDaysCritical, etc.)
- Created insert schemas using `createInsertSchema` from drizzle-zod

**Why it was changed:**
- Define PostgreSQL table structures with proper types, constraints, and relationships
- Enable type-safe database operations via Drizzle ORM

**Lines/Functions to inspect:**
```
- userRoleEnum definition
- users table definition (primary key on 'id', unique on 'username')
- fleets table definition (primary key on 'id', unique on 'code')
- vessels table definition (primary key on 'id', unique on 'code', FK to fleets)
- pmsVesselSettings table definition (primary key on 'id', unique on 'vesselId')
- insertUserSchema, insertFleetSchema, insertVesselSchema, insertPmsVesselSettingsSchema
```

---

### 1.2 PostgreSQL Storage Adapter (`server/postgresStorage.ts`)

**What was changed:**
- New file created with `PostgresStorage` class implementing `IStorage` interface
- Full CRUD methods for users, fleets, vessels, pms_vessel_settings

**Why it was changed:**
- Provide PostgreSQL-backed implementation alternative to file-based storage

**Methods to inspect:**

| Method | Purpose | Lines to Check |
|--------|---------|----------------|
| `getUser(id)` | Fetch user by ID | Returns `User \| undefined` |
| `getUserByUsername(username)` | Fetch user by username | Used for authentication |
| `createUser(user)` | Insert new user | Role normalization, vesselId handling |
| `getUsers()` | List all users | Returns array |
| `updateUser(id, updates)` | Update user fields | Partial update handling |
| `deleteUser(id)` | Remove user | Returns boolean |
| `getFleets()` | List all fleets | Returns array with createdAt/updatedAt |
| `getFleet(id)` | Fetch fleet by ID | Returns `Fleet \| undefined` |
| `getFleetByCode(code)` | Fetch fleet by code | Unique constraint lookup |
| `createFleet(fleet)` | Insert new fleet | Code uniqueness |
| `updateFleet(id, updates)` | Update fleet | updatedAt auto-set |
| `deleteFleet(id)` | Remove fleet | Cascade considerations |
| `getVessels()` | List all vessels | Returns array |
| `getVessel(id)` | Fetch vessel by ID | Returns `Vessel \| undefined` |
| `getVesselByCode(code)` | Fetch vessel by code | Unique constraint lookup |
| `getVesselIdByName(name)` | Fetch vessel by name | Fuzzy matching |
| `createVessel(vessel)` | Insert new vessel | fleetId FK handling |
| `updateVessel(id, updates)` | Update vessel | Field-level updates |
| `deleteVessel(id)` | Remove vessel | Cascade considerations |
| `getPmsVesselSettings(vesselId)` | Fetch settings by vesselId | Unique per vessel |
| `getAllPmsVesselSettings()` | List all settings | Returns array |
| `createPmsVesselSettings(settings)` | Insert settings | Default values |
| `updatePmsVesselSettings(vesselId, updates)` | Update settings | Partial updates |
| `upsertPmsVesselSettings(vesselId, settings)` | Insert or update | Idempotent operation |
| `deletePmsVesselSettings(vesselId)` | Remove settings | Returns boolean |

---

### 1.3 Storage Factory (`server/storageFactory.ts`)

**What was changed:**
- New file created with `StorageFactory` class
- Environment variable `STORAGE_MODE` controls which storage backend is used

**Why it was changed:**
- Enable switching between file/postgres/dual storage without code changes

**Modes to inspect:**

| STORAGE_MODE | Behavior |
|--------------|----------|
| `file` (default) | Uses PersistentFileStorage (test-data.json) |
| `postgres` | Uses PostgresStorage (PostgreSQL database) |
| `dual` | Uses DualWriteStorage (writes to both, reads from file) |

**Lines/Functions to inspect:**
```typescript
- getStorage() method - singleton pattern
- Mode detection from process.env.STORAGE_MODE
- Logging of which mode is active
```

---

### 1.4 Migration Script (`scripts/migrate-module1-core-reference.ts`)

**What was changed:**
- New script that migrates data from test-data.json to PostgreSQL

**Why it was changed:**
- One-time data migration from file to database

**Functions to inspect:**

| Function | Purpose | Key Behaviors |
|----------|---------|---------------|
| `loadFileData()` | Read test-data.json | Throws if file missing |
| `normalizeRole(role)` | Normalize user roles | Maps to enum values |
| `getCount(tx, table)` | Count rows in transaction | Used for BEFORE/AFTER |
| `migrateWithTransaction(db, fileData)` | Main migration logic | Single transaction, rollback on error |
| `main()` | Entry point | Exit codes 0/1 |

**Migration order (dependency-aware):**
1. fleets (no dependencies)
2. vessels (depends on fleets via fleetId FK)
3. users (depends on vessels via vesselId)
4. pms_vessel_settings (depends on vessels via vesselId)

---

### 1.5 Validation Script (`scripts/validate-module1-migration.ts`)

**What was changed:**
- New script that validates migration success

**Why it was changed:**
- Verify data integrity after migration

**Validation checks:**

| Table | Count Check | Sample Check | Empty Detection |
|-------|-------------|--------------|-----------------|
| fleets | file count = pg count | name, code match | Fails if source > 0, pg = 0 |
| vessels | file count = pg count | name, code match | Fails if source > 0, pg = 0 |
| users | file count = pg count | fullName, role match | Fails if source > 0, pg = 0 |
| pms_vessel_settings | file count = pg count | calendarLeadDaysCritical match | Fails if source > 0, pg = 0 |

---

### 1.6 Routes (`server/routes.ts`)

**What was changed:**
- No direct changes to routes.ts for Module 1
- Routes already use `storage` interface abstracted by `IStorage`

**Why no changes needed:**
- Routes call `storage.getUsers()`, `storage.getFleets()`, etc.
- When `STORAGE_MODE=postgres`, storage points to PostgresStorage
- All route logic remains unchanged

**Routes to verify still work:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/users` | GET | List all users |
| `/api/fleets` | GET | List all fleets |
| `/api/fleets/:id` | GET | Get fleet by ID |
| `/api/fleets` | POST | Create fleet |
| `/api/fleets/:id` | PUT | Update fleet |
| `/api/fleets/:id` | DELETE | Delete fleet |
| `/api/fleets/:id/vessels` | GET | Get vessels in fleet |
| `/api/vessels` | GET | List all vessels |
| `/api/vessels` | POST | Create vessel |
| `/api/vessels/:id/fleet` | PUT | Assign vessel to fleet |
| `/api/vessels-with-fleets` | GET | Vessels with fleet info |
| `/api/pms-vessel-settings` | GET | List all PMS settings |
| `/api/pms-vessel-settings/:vesselId` | GET | Get settings by vessel |
| `/api/pms-vessel-settings` | POST | Create PMS settings |
| `/api/pms-vessel-settings/:vesselId` | PUT | Update PMS settings |
| `/api/pms-vessel-settings/:vesselId` | DELETE | Delete PMS settings |

---

## 2. Affected Frontend Code

### 2.1 Files That Consume Module 1 APIs

| File | API Used | UI Area |
|------|----------|---------|
| `client/src/pages/admin/FleetDataView.tsx` | `/api/fleets`, `/api/vessels` | Admin Fleet Management |
| `client/src/pages/admin/AddEditFleetComponent.tsx` | `/api/fleets` | Fleet CRUD Forms |
| `client/src/pages/admin/FleetVesselMapping.tsx` | `/api/fleets`, `/api/vessels` | Fleet-Vessel Assignments |
| `client/src/pages/admin/FleetVesselManager.tsx` | `/api/fleets`, `/api/vessels` | Fleet-Vessel Overview |
| `client/src/pages/admin/PmsVesselSettingsManagement.tsx` | `/api/pms-vessel-settings` | PMS Settings CRUD |
| `client/src/pages/admin/Admin4Dashboard.tsx` | `/api/fleets`, `/api/vessels`, `/api/users` | Admin Dashboard |
| `client/src/pages/admin/BulkDataImport.tsx` | `/api/fleets`, `/api/vessels` | Bulk Import |
| `client/src/contexts/VesselContext.tsx` | `/api/vessels` | Vessel Selection Context |
| `client/src/hooks/useVessels.ts` | `/api/vessels` | Vessel Data Hook |
| `client/src/lib/cacheInvalidation.ts` | All APIs | Cache Invalidation Logic |

### 2.2 What Changed for Frontend

**No direct frontend code changes required for Module 1.**

The frontend uses TanStack Query to fetch data from API endpoints. The API response structure remains identical whether data comes from file or PostgreSQL.

### 2.3 How to Manually Test Frontend

1. **Set STORAGE_MODE=postgres** in environment
2. **Restart the application**
3. **Visit each admin page** and verify data loads correctly
4. **Create/Edit/Delete operations** should persist to PostgreSQL
5. **Verify TanStack Query cache invalidation** works after mutations

---

## 3. Database Verification

### 3.1 Table Existence Checks

Run these SQL queries to verify tables exist:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'fleets', 'vessels', 'pms_vessel_settings');
```

Expected: 4 rows (users, fleets, vessels, pms_vessel_settings)

### 3.2 Row Count Checks

```sql
-- Count records per table
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'fleets', COUNT(*) FROM fleets
UNION ALL
SELECT 'vessels', COUNT(*) FROM vessels
UNION ALL
SELECT 'pms_vessel_settings', COUNT(*) FROM pms_vessel_settings;
```

Compare with test-data.json counts.

### 3.3 Constraint Verification

```sql
-- Check primary keys
SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('users', 'fleets', 'vessels', 'pms_vessel_settings')
AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY');
```

### 3.4 Enum Verification

```sql
-- Check user_role enum values
SELECT unnest(enum_range(NULL::user_role));
```

Expected: 'Ship', 'Office', 'PMS Admin'

### 3.5 Sample Data Verification

```sql
-- Sample users
SELECT username, full_name, role, vessel_id, is_active FROM users LIMIT 5;

-- Sample fleets
SELECT id, code, name, is_active FROM fleets LIMIT 5;

-- Sample vessels
SELECT id, name, code, fleet_id, is_active FROM vessels LIMIT 5;

-- Sample PMS settings
SELECT vessel_id, calendar_lead_days_critical, rh_lead_hours_critical FROM pms_vessel_settings LIMIT 5;
```

### 3.6 Relationship Integrity

```sql
-- Vessels with valid fleet references
SELECT v.id, v.name, f.name as fleet_name
FROM vessels v
LEFT JOIN fleets f ON v.fleet_id = f.id
WHERE v.fleet_id IS NOT NULL;

-- Users with valid vessel references
SELECT u.username, v.name as vessel_name
FROM users u
LEFT JOIN vessels v ON u.vessel_id = v.id
WHERE u.vessel_id IS NOT NULL;
```

---

## 4. Request/Response Validation

### 4.1 API Response Comparison

#### GET /api/fleets

**Expected Response (same for file and postgres):**
```json
[
  {
    "id": "fleet-001",
    "code": "FL01",
    "name": "Fleet Alpha",
    "description": "Description here",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/vessels

**Expected Response:**
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

#### GET /api/users

**Expected Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "password": "hashed_password",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "PMS Admin",
    "vesselId": null,
    "department": "IT",
    "isActive": true,
    "lastLoginAt": null
  }
]
```

#### GET /api/pms-vessel-settings/:vesselId

**Expected Response:**
```json
{
  "id": 1,
  "vesselId": "vessel-001",
  "calendarLeadDaysCritical": 7,
  "calendarLeadDaysNonCritical": 14,
  "calendarGraceMode": "COMPANY_STANDARD",
  "calendarGraceDays": 7,
  "rhLeadHoursCritical": 50,
  "rhLeadHoursNonCritical": 100,
  "rhGraceHours": 168,
  "locationAName": "Location A",
  "locationBName": "Location B",
  "updatedBy": "admin",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 4.2 Testing with curl

```bash
# Test fleets endpoint
curl -s http://localhost:5000/api/fleets | jq

# Test vessels endpoint
curl -s http://localhost:5000/api/vessels | jq

# Test users endpoint (may require auth)
curl -s http://localhost:5000/api/users | jq

# Test PMS settings
curl -s http://localhost:5000/api/pms-vessel-settings | jq
```

### 4.3 Backward Compatibility

| Aspect | Status | Notes |
|--------|--------|-------|
| Field names | Compatible | camelCase maintained |
| Field types | Compatible | Same types (string, number, boolean) |
| Response structure | Compatible | Arrays and objects unchanged |
| Null handling | Compatible | Nulls preserved |

---

## 5. Migration Correctness Tests

### 5.1 Pass Criteria

| Test | Expected Outcome | How to Verify |
|------|------------------|---------------|
| Migration completes | Exit code 0 | `echo $?` after script |
| All records migrated | migratedCount = fileCount (first run) | Check migration output |
| Validation passes | Exit code 0 | Run validation script |
| Count match | file count = postgres count | Validation output |
| Sample data correct | sampleCheck = Pass | Validation output |
| No empty tables | All tables have records | SQL count queries |

### 5.2 Failure Indicators

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Exit code 1 from migration | Insert error, constraint violation | Check error message, fix data |
| Exit code 1 from validation | Count mismatch or empty tables | Re-run migration |
| "Transaction rolled back" | Database error during migration | Check DATABASE_URL, schema |
| "Source has X but Postgres is empty" | Migration didn't run or failed | Re-run migration |

### 5.3 Idempotency Test

```bash
# Run migration twice
npx tsx scripts/migrate-module1-core-reference.ts
npx tsx scripts/migrate-module1-core-reference.ts

# Second run should show:
# - migratedCount: 0 (all records already exist)
# - skippedCount: N (all records skipped)
```

### 5.4 Rollback Test (Advanced)

```bash
# 1. Clear tables
psql $DATABASE_URL -c "DELETE FROM pms_vessel_settings; DELETE FROM users WHERE vessel_id IS NOT NULL; DELETE FROM vessels; DELETE FROM fleets;"

# 2. Run migration
npx tsx scripts/migrate-module1-core-reference.ts

# 3. Verify restoration
npx tsx scripts/validate-module1-migration.ts
```

---

## 6. Screens/UI Flows to Test

### 6.1 Admin > Fleets

**Path:** `/admin` → Fleet Management section

**What should load from Postgres:**
- Fleet list (id, code, name, isActive)
- Fleet counts

**UI Behaviors to Confirm:**
- [ ] Fleet list displays correctly
- [ ] Create new fleet works
- [ ] Edit fleet name/code works
- [ ] Delete fleet works
- [ ] Fleet codes are unique (duplicate should fail)

**Verification:**
```sql
SELECT * FROM fleets ORDER BY created_at DESC LIMIT 1;
```

---

### 6.2 Admin > Vessels

**Path:** `/admin` → Vessel Management section

**What should load from Postgres:**
- Vessel list (id, name, code, fleetId, isActive)
- Fleet assignment dropdown

**UI Behaviors to Confirm:**
- [ ] Vessel list displays correctly
- [ ] Create new vessel works
- [ ] Assign vessel to fleet works
- [ ] Edit vessel details works
- [ ] Delete vessel works

**Verification:**
```sql
SELECT v.*, f.name as fleet_name FROM vessels v LEFT JOIN fleets f ON v.fleet_id = f.id;
```

---

### 6.3 Admin > Users

**Path:** `/admin` → User Management section

**What should load from Postgres:**
- User list (username, fullName, role, vesselId, isActive)
- Vessel assignment dropdown

**UI Behaviors to Confirm:**
- [ ] User list displays correctly
- [ ] User roles display correctly (Ship/Office/PMS Admin)
- [ ] Vessel assignments are accurate

**Verification:**
```sql
SELECT u.username, u.full_name, u.role, v.name as vessel_name 
FROM users u LEFT JOIN vessels v ON u.vessel_id = v.id;
```

---

### 6.4 Admin > PMS Vessel Settings

**Path:** `/admin` → PMS Vessel Settings section

**What should load from Postgres:**
- Settings per vessel (calendarLeadDaysCritical, rhLeadHoursCritical, etc.)

**UI Behaviors to Confirm:**
- [ ] Settings load for selected vessel
- [ ] Edit settings saves correctly
- [ ] Default values apply for new vessels
- [ ] Location names display correctly

**Verification:**
```sql
SELECT ps.*, v.name as vessel_name 
FROM pms_vessel_settings ps JOIN vessels v ON ps.vessel_id = v.id;
```

---

### 6.5 Login Flow

**Path:** Login page

**What should work:**
- User authentication (username/password lookup)

**UI Behaviors to Confirm:**
- [ ] Valid credentials allow login
- [ ] Invalid credentials show error
- [ ] User role determines access permissions

---

### 6.6 Vessel Selector (Global)

**Path:** Header/Sidebar vessel selector

**What should load from Postgres:**
- Active vessels for current user's access level

**UI Behaviors to Confirm:**
- [ ] Vessel dropdown populates correctly
- [ ] Selecting vessel updates context
- [ ] Vessel persists across page navigation

---

## Summary Checklist

### Before Migration

- [ ] DATABASE_URL environment variable is set
- [ ] PostgreSQL database is accessible
- [ ] Schema is pushed (`npx drizzle-kit push`)
- [ ] test-data.json exists and has valid data

### During Migration

- [ ] Run: `npx tsx scripts/migrate-module1-core-reference.ts`
- [ ] Exit code is 0
- [ ] Migration summary shows expected counts
- [ ] No "MIGRATION FAILED" message

### After Migration

- [ ] Run: `npx tsx scripts/validate-module1-migration.ts`
- [ ] All tables show "PASS"
- [ ] Count matches for all 4 tables
- [ ] Sample checks pass
- [ ] Set STORAGE_MODE=postgres
- [ ] Restart application
- [ ] Test all UI flows listed in Section 6

### Sign-off

| Checkpoint | Status | Verified By | Date |
|------------|--------|-------------|------|
| Migration script success | ⬜ | | |
| Validation script success | ⬜ | | |
| Database counts verified | ⬜ | | |
| Fleet UI tested | ⬜ | | |
| Vessel UI tested | ⬜ | | |
| User UI tested | ⬜ | | |
| PMS Settings UI tested | ⬜ | | |
| Login flow tested | ⬜ | | |

---

**Module 1 Verification Complete - Ready for Module 2 approval when all checkboxes are verified.**
