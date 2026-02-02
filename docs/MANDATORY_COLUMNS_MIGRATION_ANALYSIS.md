# Maritime PMS - Mandatory Columns Migration Analysis & Strategy

## Executive Summary

This document provides the comprehensive analysis and migration strategy for enforcing mandatory columns across all 70 tables in the Maritime Planned Maintenance System (PMS) database.

**Mandatory columns to enforce:**
- `uuid` - TEXT, auto-generated using `gen_random_uuid()` (PostgreSQL 13+, no extension required)
- `is_deleted` - BOOLEAN, default `false` for soft delete support
- `created_at` - TIMESTAMP, default `now()` for auditability
- `updated_at` - TIMESTAMP, default `now()` for tracking modifications
- `updated_by` - TEXT, nullable for tracking who made changes

---

## 1. PostgreSQL UUID Generation Strategy

### Method: `gen_random_uuid()` (PostgreSQL 13+)

**Advantages:**
- Native PostgreSQL function, no extension installation required
- Works reliably in all PostgreSQL 13+ environments
- Thread-safe and cryptographically secure
- No dependency on `uuid-ossp` extension

**Implementation in Drizzle ORM:**
```typescript
uuid: text("uuid").notNull().default(sql`gen_random_uuid()`),
```

**Safety:** This method is production-ready and does not require any extension enablement or special database permissions.

---

## 2. Per-Table Analysis

### Legend
- ✅ = Column exists
- ❌ = Column missing (needs to be added)
- 🔄 = Needs standardization (e.g., `deleted` → `is_deleted`)

| # | Table Name | uuid | is_deleted | created_at | updated_at | updated_by | Notes |
|---|------------|------|------------|------------|------------|------------|-------|
| 1 | users | ❌ | ❌ | ✅ | ✅ | ❌ | Core user table |
| 2 | fleets | ❌ | ❌ | ✅ | ✅ | ❌ | Fleet registry |
| 3 | vessels | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel registry |
| 4 | defectSequences | ❌ | ❌ | ❌ | ❌ | ❌ | Sequence counter - minimal columns needed |
| 5 | runningHoursAudit | ❌ | ❌ | ❌ | ❌ | ❌ | Audit table - immutable by design |
| 6 | components | ❌ | ❌ | ✅ | ✅ | ❌ | Core equipment registry |
| 7 | formDefinitions | ❌ | ❌ | ❌ | ❌ | ❌ | Form templates |
| 8 | formVersions | ❌ | ❌ | ❌ | ❌ | ❌ | Form version tracking |
| 9 | formVersionUsage | ❌ | ❌ | ❌ | ❌ | ❌ | Form usage audit |
| 10 | ihmItems | ❌ | ❌ | ✅ | ✅ | ❌ | Hazardous materials |
| 11 | ihmMaintenanceLog | ❌ | ❌ | ✅ | ❌ | ❌ | IHM maintenance log |
| 12 | spares | ❌ | 🔄 | ✅ | ✅ | ✅ | Has `deleted` instead of `is_deleted` |
| 13 | sparesHistory | ❌ | ❌ | ❌ | ❌ | ❌ | History/audit table |
| 14 | storesLedger | ❌ | ❌ | ❌ | ❌ | ❌ | Ledger/audit table |
| 15 | storesItems | ❌ | 🔄 | ✅ | ✅ | ❌ | Has `deleted` instead of `is_deleted` |
| 16 | changeRequest | ❌ | ❌ | ✅ | ✅ | ❌ | Change request workflow |
| 17 | changeRequestAttachment | ❌ | ❌ | ❌ | ❌ | ❌ | Attachments |
| 18 | changeRequestComment | ❌ | ❌ | ✅ | ❌ | ❌ | Comments |
| 19 | alertPolicies | ❌ | ❌ | ✅ | ✅ | ✅ | Has both createdBy and updatedBy |
| 20 | alertEvents | ❌ | ❌ | ✅ | ❌ | ❌ | Event log |
| 21 | alertDeliveries | ❌ | ❌ | ✅ | ❌ | ❌ | Delivery tracking |
| 22 | alertConfig | ❌ | ❌ | ✅ | ✅ | ✅ | Has updatedBy |
| 23 | jobs | ❌ | ❌ | ✅ | ✅ | ✅ | Has createdBy and updatedBy |
| 24 | workOrders | ❌ | ❌ | ✅ | ✅ | ❌ | Work order management |
| 25 | workOrderExecutions | ❌ | ❌ | ✅ | ✅ | ❌ | Execution records |
| 26 | defects | ❌ | ❌ | ✅ | ✅ | ❌ | Defect tracking |
| 27 | defectActions | ❌ | ❌ | ✅ | ✅ | ❌ | Corrective actions |
| 28 | defectAttachments | ❌ | ❌ | ❌ | ❌ | ❌ | Has uploadedAt only |
| 29 | recurringDefects | ❌ | ❌ | ❌ | ✅ | ❌ | Recurring pattern tracking |
| 30 | recurringDefectLinks | ❌ | ❌ | ❌ | ❌ | ❌ | Junction table - composite PK |
| 31 | importHistory | ❌ | ❌ | ❌ | ❌ | ❌ | Has startedAt, finishedAt |
| 32 | importChangeLog | ❌ | ❌ | ✅ | ❌ | ❌ | Change tracking |
| 33 | makers | ❌ | ❌ | ✅ | ✅ | ❌ | Manufacturer registry |
| 34 | masterLists | ❌ | ❌ | ✅ | ❌ | ❌ | Lookup data |
| 35 | fleetEquipmentMaster | ❌ | ❌ | ✅ | ✅ | ✅ | Has createdBy and updatedBy |
| 36 | componentRunningHoursLog | ❌ | ❌ | ✅ | ✅ | ❌ | Has updatedBy for RH tracking |
| 37 | auditLog | ❌ | ❌ | ❌ | ❌ | ❌ | Immutable audit trail - special handling |
| 38 | componentDocuments | ❌ | ❌ | ❌ | ❌ | ❌ | Has uploadedAt only |
| 39 | componentClassRegulatory | ❌ | ❌ | ✅ | ✅ | ✅ | Has createdBy and updatedBy |
| 40 | componentMaintenanceHistory | ❌ | ❌ | ✅ | ❌ | ❌ | Immutable - no updates allowed |
| 41 | componentRequisitions | ❌ | ❌ | ✅ | ✅ | ❌ | Purchase requisitions |
| 42 | pmsVesselSettings | ❌ | ❌ | ✅ | ✅ | ✅ | Has updatedBy |
| 43 | makerList | ❌ | ❌ | ✅ | ✅ | ❌ | Maker lookup |
| 44 | sfiDetails | ❌ | ❌ | ✅ | ✅ | ❌ | SFI code lookup |
| 45 | masterData | ❌ | ❌ | ✅ | ✅ | ❌ | Fleet equipment codes |
| 46 | fleetVesselMapping | ❌ | ❌ | ❌ | ❌ | ❌ | Has mappedAt only |
| 47 | fleetComponentMapping | ❌ | ❌ | ❌ | ❌ | ❌ | Has mappedAt only |
| 48 | fleetJobVesselMapping | ❌ | ❌ | ❌ | ❌ | ❌ | Has mappedAt only |
| 49 | fleetSpareVesselMapping | ❌ | ❌ | ❌ | ❌ | ❌ | Has mappedAt only |
| 50 | bulkImportHistory | ❌ | ❌ | ❌ | ❌ | ❌ | Has uploadedAt only |
| 51 | bulkImportErrors | ❌ | ❌ | ✅ | ❌ | ❌ | Error log |
| 52 | certificates | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel certificates |
| 53 | surveys | ❌ | ❌ | ✅ | ✅ | ❌ | Survey schedules |
| 54 | workOrderExecutionDetails | ❌ | ❌ | ✅ | ✅ | ❌ | Execution details |
| 55 | locations | ❌ | ❌ | ✅ | ❌ | ❌ | Location registry |
| 56 | spareComponentLinks | ❌ | ❌ | ❌ | ❌ | ❌ | Junction table - composite PK |
| 57 | spareLocationStock | ❌ | ❌ | ❌ | ❌ | ❌ | Stock tracking |
| 58 | inventoryTransactions | ❌ | ❌ | ❌ | ❌ | ❌ | Transaction log |
| 59 | jobComponentLinks | ❌ | ❌ | ❌ | ✅ | ❌ | Has linkedAt, updatedAt |
| 60 | equipmentCategories | ❌ | ❌ | ✅ | ✅ | ❌ | Master data |
| 61 | defectCategories | ❌ | ❌ | ✅ | ✅ | ❌ | Master data |
| 62 | defectTypes | ❌ | ❌ | ✅ | ✅ | ❌ | Master data |
| 63 | shipCertificatesMaster | ❌ | ❌ | ✅ | ✅ | ❌ | Admin config |
| 64 | shipCertificatesLabelsConfig | ❌ | ❌ | ✅ | ✅ | ❌ | Labels config |
| 65 | vesselCertificateApplicability | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel cert mapping |
| 66 | vesselCertificateData | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel cert data |
| 67 | shipSurveysMaster | ❌ | ❌ | ✅ | ✅ | ❌ | Admin config |
| 68 | shipSurveysLabelsConfig | ❌ | ❌ | ✅ | ✅ | ❌ | Labels config |
| 69 | vesselSurveyApplicability | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel survey mapping |
| 70 | vesselSurveyData | ❌ | ❌ | ✅ | ✅ | ❌ | Vessel survey data |

---

## 3. Summary Statistics

| Column | Present | Missing | Needs Standardization |
|--------|---------|---------|----------------------|
| uuid | 0 | 70 | 0 |
| is_deleted | 0 | 68 | 2 (spares, storesItems use `deleted`) |
| created_at | 53 | 17 | 0 |
| updated_at | 44 | 26 | 0 |
| updated_by | 7 | 63 | 0 |

---

## 4. Special Handling Categories

### 4.1 Immutable/Audit Tables (No is_deleted or updated_at)

These tables are designed to be immutable audit trails and should NOT have is_deleted or updatedAt:

1. **runningHoursAudit** - RH change audit trail
2. **auditLog** - System-wide audit log
3. **componentMaintenanceHistory** - Immutable maintenance records

**Recommendation:** Add `uuid` and `created_at` only. Skip `is_deleted`, `updated_at`, and `updated_by`.

### 4.2 Junction Tables with Composite Primary Keys

These tables use composite primary keys and may not need all columns:

1. **recurringDefectLinks** - Has composite PK (recurringId, defectId)
2. **spareComponentLinks** - Has composite PK (spareId, componentId)

**Recommendation:** Add `uuid`, `is_deleted`, `created_at`. Skip `updated_at` and `updated_by` unless modification tracking is needed.

### 4.3 Tables Needing Standardization

These tables use `deleted` instead of `is_deleted`:

1. **spares** - Has `deleted: boolean("deleted")`
2. **storesItems** - Has `deleted: boolean("deleted")`

**Recommendation:** Rename column to `is_deleted` for consistency. This is a non-breaking change if done via ALTER TABLE RENAME COLUMN.

### 4.4 Sequence/Counter Tables

1. **defectSequences** - Simple counter table

**Recommendation:** Add all columns for consistency.

---

## 5. Migration Strategy

### Phase 1: Schema Updates (Drizzle ORM)

1. Add `uuid` column with `sql\`gen_random_uuid()\`` default to ALL tables
2. Add `is_deleted` column with `default(false)` to applicable tables
3. Add `created_at` column with `defaultNow()` to tables missing it
4. Add `updated_at` column with `defaultNow()` to tables missing it
5. Add `updated_by` column (nullable text) to tables missing it
6. Rename `deleted` → `is_deleted` in spares and storesItems

### Phase 2: Drizzle Migration Generation

```bash
npm run db:generate
```

### Phase 3: Apply Migrations

```bash
npm run db:push
```

### Phase 4: Verification

1. Verify all tables have the mandatory columns
2. Test that existing CRUD operations still work
3. Verify UUID generation on new inserts
4. Confirm soft delete functionality

---

## 6. Safe Defaults for Existing Data

When adding columns to tables with existing data:

| Column | Default Value | Notes |
|--------|---------------|-------|
| uuid | `gen_random_uuid()` | Existing rows get new UUIDs automatically |
| is_deleted | `false` | All existing records remain visible |
| created_at | `now()` | Existing rows get current timestamp |
| updated_at | `now()` | Existing rows get current timestamp |
| updated_by | `null` | Nullable - no default user |

---

## 7. Index Considerations

Consider adding indexes for frequently queried columns:

```sql
CREATE INDEX idx_<table>_uuid ON <table>(uuid);
CREATE INDEX idx_<table>_is_deleted ON <table>(is_deleted);
CREATE INDEX idx_<table>_created_at ON <table>(created_at);
```

---

## 8. Application Code Impact

### Insert Operations
- No changes required - default values handle uuid, is_deleted, timestamps

### Update Operations
- Add `updated_at: new Date()` and `updated_by: userId` to update operations

### Delete Operations
- Change DELETE to UPDATE with `is_deleted: true`
- Update SELECT queries to filter `WHERE is_deleted = false`

### Select Operations
- Add `is_deleted: false` filter to all queries (can be done at ORM level)

---

## 9. Rollback Plan

If migration fails:

1. Drizzle maintains migration history
2. Use `npm run db:studio` to inspect database state
3. Manual rollback:
   ```sql
   ALTER TABLE <table> DROP COLUMN IF EXISTS uuid;
   ALTER TABLE <table> DROP COLUMN IF EXISTS is_deleted;
   -- etc.
   ```

---

## 10. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Schema updates | 2-3 hours | None |
| Migration generation | 5 minutes | Schema updates |
| Apply migrations | 10-30 minutes | Migration files |
| Testing | 1-2 hours | Applied migrations |
| **Total** | **4-6 hours** | |

---

## Appendix A: Tables by Category

### Core Entity Tables (17)
users, fleets, vessels, components, jobs, workOrders, workOrderExecutions, defects, defectActions, spares, storesItems, certificates, surveys, ihmItems, locations, componentRequisitions, componentDocuments

### Audit/History Tables (8)
runningHoursAudit, auditLog, componentMaintenanceHistory, sparesHistory, storesLedger, importHistory, importChangeLog, componentRunningHoursLog

### Master Data Tables (12)
formDefinitions, formVersions, makers, makerList, masterLists, sfiDetails, masterData, fleetEquipmentMaster, equipmentCategories, defectCategories, defectTypes, shipCertificatesMaster, shipSurveysMaster

### Junction/Mapping Tables (10)
recurringDefectLinks, spareComponentLinks, jobComponentLinks, fleetVesselMapping, fleetComponentMapping, fleetJobVesselMapping, fleetSpareVesselMapping, vesselCertificateApplicability, vesselSurveyApplicability

### Configuration Tables (7)
alertPolicies, alertConfig, pmsVesselSettings, shipCertificatesLabelsConfig, shipSurveysLabelsConfig

### Event/Transaction Tables (6)
alertEvents, alertDeliveries, inventoryTransactions, bulkImportHistory, bulkImportErrors, defectSequences

### Workflow Tables (4)
changeRequest, changeRequestAttachment, changeRequestComment, recurringDefects

### Data Tables (6)
formVersionUsage, ihmMaintenanceLog, defectAttachments, spareLocationStock, workOrderExecutionDetails, vesselCertificateData, vesselSurveyData

---

**Document Version:** 1.0
**Created:** February 2026
**Author:** Replit Agent
