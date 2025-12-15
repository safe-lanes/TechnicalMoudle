# PostgreSQL Migration Verification - Modules 4-7

## Overview

This document verifies the successful migration of Modules 4-7 from file-based storage (`test-data.json`) to PostgreSQL database storage.

## Migration Scope

| Module | Entity | PostgreSQL Table | Status |
|--------|--------|-----------------|--------|
| Module 4 | Jobs (Vessel & Fleet) | `jobs` | ✅ Complete |
| Module 5 | Work Orders (Vessel & Fleet) | `work_orders` | ✅ Complete |
| Module 6 | Running Hours Audit | `running_hours_audit` | ✅ Complete |
| Module 7 | Spares (Vessel & Fleet) | `spares` | ✅ Complete |
| Module 7 | Spares History | `spares_history` | ✅ Complete |

## Architecture

### HybridStorage Pattern

The `HybridStorage` class implements a routing pattern that:
1. Checks if PostgreSQL is available via `postgresAvailable` flag
2. Routes operations to `PostgresStorage` when available
3. Falls back to `PersistentFileStorage` when PostgreSQL is unavailable

```typescript
async getJobs(vesselId: string): Promise<Job[]> {
  if (this.postgresAvailable) {
    return this.postgresStorage.getJobs(vesselId);
  }
  return this.fileStorage.getJobs(vesselId);
}
```

### Key Files Modified

1. **`server/postgresStorage.ts`**
   - Module 4: Jobs methods (lines ~800-950)
   - Module 5: Work Orders methods (lines ~950-1150)
   - Module 7: Spares & SpareHistory methods (lines ~1200-1650)

2. **`server/hybridStorage.ts`**
   - Updated header comment to include Modules 4, 5, 7
   - Explicit PostgreSQL routing for all migrated entities
   - Removed old delegated method declarations for spares

3. **Migration Scripts**
   - `scripts/migrate-module4-jobs.ts`
   - `scripts/migrate-module5-workorders.ts`
   - `scripts/migrate-module7-spares.ts`

## Module 4: Jobs

### Methods Migrated

| Method | Description |
|--------|-------------|
| `getJobs(vesselId)` | Get all vessel jobs |
| `getJob(id)` | Get job by ID |
| `getJobByJobNo(jobNo, vesselId)` | Get job by job number |
| `createJob(job)` | Create new job |
| `updateJob(id, data)` | Update existing job |
| `deleteJob(id)` | Delete job |
| `getFleetJobs()` | Get all fleet jobs |
| `getFleetJob(id)` | Get fleet job by ID |
| `createFleetJob(job)` | Create fleet job |
| `updateFleetJob(id, data)` | Update fleet job |
| `deleteFleetJob(id)` | Delete fleet job |
| `getJobsByJobNos(jobNos, vesselId)` | Bulk get jobs by job numbers |

### Data Scope Support

- `dataScope = 'vessel'` - Vessel-specific jobs
- `dataScope = 'fleet'` - Fleet template jobs

## Module 5: Work Orders

### Methods Migrated

| Method | Description |
|--------|-------------|
| `getWorkOrders(vesselId)` | Get all vessel work orders |
| `getWorkOrder(id)` | Get work order by ID |
| `getWorkOrderByNumber(workOrderNo)` | Get by work order number |
| `createWorkOrder(workOrder)` | Create new work order |
| `updateWorkOrder(id, data)` | Update existing work order |
| `deleteWorkOrder(id)` | Delete work order |
| `getFleetWorkOrders()` | Get all fleet work orders |
| `getFleetWorkOrder(id)` | Get fleet work order by ID |
| `createFleetWorkOrder(workOrder)` | Create fleet work order |
| `updateFleetWorkOrder(id, data)` | Update fleet work order |
| `deleteFleetWorkOrder(id)` | Delete fleet work order |
| `getWorkOrdersByTemplateIds(templateIds)` | Bulk get by template IDs |

### Work Order Status Flow

```
Open → In Progress → Completed → Verified → Closed
              ↓
         Postponed
```

## Module 6: Running Hours Audit

### Methods (Already Migrated with Module 3)

| Method | Description |
|--------|-------------|
| `getRunningHoursAudit(componentId)` | Get audit trail for component |
| `createRunningHoursAudit(audit)` | Create audit record |
| `getRunningHoursAuditByVessel(vesselId)` | Get all audits for vessel |

### Notes

Running Hours Audit was migrated as part of Module 3 (Components). The RH delta propagation logic (`cascadeRunningHoursUpdate`) remains in file storage for complex operations.

## Module 7: Spares

### Methods Migrated

| Method | Description |
|--------|-------------|
| `getAllSpares()` | Get all spares (all vessels) |
| `getSpares(vesselId)` | Get vessel spares |
| `getSpare(id)` | Get spare by ID |
| `createSpare(spare)` | Create new spare |
| `updateSpare(id, data)` | Update existing spare |
| `deleteSpare(id)` | Delete spare |
| `consumeSpare(id, quantity, ...)` | Record spare consumption |
| `consumeSpareFromLocation(id, location, quantity, ...)` | Consume from specific location |
| `receiveSpare(id, quantity, ...)` | Record spare receipt |
| `bulkUpdateSpares(updates)` | Bulk update spares |
| `adjustSpareQuantity(id, adjustment)` | Adjust quantity |
| `getFleetSpares()` | Get all fleet spares |
| `getFleetSpare(id)` | Get fleet spare by ID |
| `createFleetSpare(spare)` | Create fleet spare |
| `updateFleetSpare(id, data)` | Update fleet spare |
| `deleteFleetSpare(id)` | Delete fleet spare |
| `bulkCreateSpares(sparesList)` | Bulk create spares |
| `bulkUpdateSparesByROB(updates)` | Bulk update by ROB ID |
| `bulkUpsertSpares(sparesList)` | Bulk upsert spares |
| `getSpareHistory(vesselId)` | Get spare transaction history |
| `getSpareHistoryBySpareId(spareId)` | Get history for specific spare |
| `createSpareHistory(history)` | Create history record |

### Delegated Methods (Remain in File Storage)

| Method | Reason |
|--------|--------|
| `archiveSparesByIds(ids)` | Complex bulk archive operation |

### Dual Location Support

Spares support storage in two locations:
- `location1` / `quantityLocation1`
- `location2` / `quantityLocation2`
- `totalQuantity` = sum of both locations

## Migration Scripts

### Usage

```bash
# Module 4: Jobs
npx tsx scripts/migrate-module4-jobs.ts

# Module 5: Work Orders
npx tsx scripts/migrate-module5-workorders.ts

# Module 7: Spares
npx tsx scripts/migrate-module7-spares.ts
```

### Features

- **Transaction Support**: All inserts are atomic; any error triggers full rollback
- **Idempotent**: Safe to run multiple times (skips existing records)
- **Before/After Counts**: Reports accurate migration statistics
- **Field Mapping**: Handles both camelCase and snake_case field names

### Sample Output

```
============================================================
Module 7: Spares Data Migration
============================================================

Loading data from test-data.json...
Connecting to PostgreSQL...

[TRANSACTION] Starting atomic migration...
[TRANSACTION] Any error will cause full rollback.

[spares] Processing 150 records (140 vessel + 10 fleet) (0 existing)...
[spares] Done: 150 migrated, 0 skipped
[spares_history] Processing 45 records (0 existing)...
[spares_history] Done: 45 migrated, 0 skipped

[TRANSACTION] All inserts successful, committing...

============================================================
Migration Summary
============================================================

spares:
  Source records: 150
  Before: 0 → After: 150
  Migrated: 150
  Skipped (already exist): 0

spares_history:
  Source records: 45
  Before: 0 → After: 45
  Migrated: 45
  Skipped (already exist): 0

------------------------------------------------------------
TOTAL: 195 migrated, 0 skipped
============================================================

Migration completed successfully!
```

## Verification Checklist

### Pre-Migration

- [x] PostgreSQL database created and accessible
- [x] Schema tables exist (`jobs`, `work_orders`, `spares`, `spares_history`)
- [x] `DATABASE_URL` environment variable configured
- [x] `test-data.json` contains source data

### Post-Migration

- [x] All records migrated without errors
- [x] Before/After counts match expected values
- [x] Application starts without errors
- [x] CRUD operations work via PostgreSQL
- [x] File storage fallback works when PostgreSQL unavailable

## Rollback Procedure

If migration needs to be reverted:

1. **Clear PostgreSQL tables** (in order due to foreign keys):
   ```sql
   TRUNCATE spares_history CASCADE;
   TRUNCATE spares CASCADE;
   TRUNCATE work_orders CASCADE;
   TRUNCATE jobs CASCADE;
   ```

2. **Disable PostgreSQL routing**:
   - Set `postgresAvailable = false` in HybridStorage

3. **Verify file storage**:
   - Confirm `test-data.json` still contains original data
   - Test CRUD operations through file storage

## Future Considerations

### Modules Not Yet Migrated

- Module 8: Defects
- Module 9: Certificates & Surveys
- Module 10: Change Requests
- Module 11: Alerts
- Module 12: Forms
- Module 13: Stores

### Performance Optimizations

Consider adding database indexes for frequently queried fields:
- `jobs.vesselId`
- `jobs.jobNo`
- `work_orders.vesselId`
- `work_orders.status`
- `spares.vesselId`
- `spares.robId`

## Conclusion

Modules 4-7 have been successfully migrated to PostgreSQL with full CRUD support. The HybridStorage pattern ensures backward compatibility and graceful fallback to file storage when needed.
