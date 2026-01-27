# PMS Database Relationships and Foreign Key Architecture

## Document Overview

This document provides a comprehensive analysis of the Planned Maintenance System (PMS) database architecture, focusing on table relationships, foreign key constraints, data integrity patterns, and architectural observations.

**Schema File:** `shared/schema.ts`  
**Total Tables:** 65 tables  
**Database:** PostgreSQL (via Drizzle ORM)

---

## 1. Database Relationship Overview

### 1.1 Core Entity Groups

The database is organized into the following functional domains:

| Group | Tables | Purpose |
|-------|--------|---------|
| **Vessel/Fleet Management** | `vessels`, `fleets`, `users`, `pmsVesselSettings` | Core organizational hierarchy |
| **Components** | `components`, `componentDocuments`, `componentClassRegulatory`, `componentMaintenanceHistory`, `componentRequisitions`, `componentRunningHoursLog` | Equipment registry and tracking |
| **Jobs** | `jobs`, `jobComponentLinks` | Maintenance job templates |
| **Work Orders** | `workOrders`, `workOrderExecutions`, `workOrderExecutionDetails` | Maintenance execution records |
| **Spares/Inventory** | `spares`, `sparesHistory`, `spareComponentLinks`, `spareLocationStock`, `inventoryTransactions`, `locations` | Spare parts and inventory management |
| **Stores** | `storesItems`, `storesLedger` | General stores (isolated from PMS) |
| **Defects** | `defects`, `defectActions`, `defectAttachments`, `recurringDefects`, `recurringDefectLinks` | Defect tracking and resolution |
| **Running Hours** | `runningHoursAudit` | Equipment runtime tracking |
| **Certificates** | `certificates`, `surveys`, `shipCertificatesMaster`, `shipCertificatesLabelsConfig`, `vesselCertificateApplicability` | Regulatory compliance |
| **Fleet Mappings** | `fleetVesselMapping`, `fleetComponentMapping`, `fleetJobVesselMapping`, `fleetSpareVesselMapping`, `fleetEquipmentMaster`, `masterData` | Fleet-to-vessel data propagation |
| **Master Data** | `masterLists`, `makers`, `makerList`, `sfiDetails`, `equipmentCategories`, `defectCategories`, `defectTypes` | Reference/lookup data |
| **Change Management** | `changeRequest`, `changeRequestAttachment`, `changeRequestComment` | PMS modification workflow |
| **Alerts** | `alertPolicies`, `alertEvents`, `alertDeliveries`, `alertConfig` | Notification system |
| **Import/Audit** | `importHistory`, `importChangeLog`, `bulkImportHistory`, `bulkImportErrors`, `auditLog` | Data import and audit trail |
| **Forms** | `formDefinitions`, `formVersions`, `formVersionUsage` | Dynamic form management |
| **IHM** | `ihmItems`, `ihmMaintenanceLog` | Inventory of Hazardous Materials |

### 1.2 Dual-Scope Architecture Pattern

A critical design pattern in this database is the **dual-scope architecture** using the `dataScope` field:

```
dataScope: 'fleet' | 'vessel'
```

**Fleet-Level Data (`dataScope = 'fleet'`):**
- Shared templates/definitions across multiple vessels
- Acts as master data that can be "pushed" to vessels
- Examples: Fleet job templates, fleet component definitions, fleet spares

**Vessel-Level Data (`dataScope = 'vessel'`):**
- Vessel-specific operational data
- Contains actual tracking data (dates, running hours, status)
- Examples: Vessel components with actual RH readings, work orders with execution data

**Tables Using dataScope:**
- `components`
- `jobs`
- `workOrders`
- `spares`

### 1.3 Explicit Foreign Key Constraints

**CRITICAL FINDING:** The database has only **3 explicit foreign key constraints** in the entire schema (verified via grep for `.references(`):

```typescript
// recurringDefectLinks table (lines 1303-1304) - 2 FKs
recurringId: integer("recurring_id")
  .notNull()
  .references(() => recurringDefects.id, { onDelete: "cascade" })
  
defectId: text("defect_id")
  .notNull()
  .references(() => defects.id, { onDelete: "cascade" })

// importChangeLog table (line 1345) - 1 FK
importHistoryId: text("import_history_id")
  .notNull()
  .references(() => importHistory.id, { onDelete: "cascade" })
```

**Total: 3 explicit FK constraints across 2 tables.**

All other relationships (~60+ tables) are **implicit** - enforced only at the application layer through text-based references.

---

## 2. Table-by-Table Relationship Breakdown

**Notation Convention:** This document uses Drizzle ORM field names (camelCase, e.g., `componentCode`) which correspond to PostgreSQL column names (snake_case, e.g., `component_code`). The schema file defines both: `componentCode: text("component_code")`. References like `components.componentCode` refer to the componentCode field on the components table.

### 2.1 Core Organizational Tables

#### `users`
| Column | References | Type | Notes |
|--------|-----------|------|-------|
| `vesselId` | `vessels.id` | Implicit | Required for Ship role users |

#### `fleets`
| Column | References | Type | Notes |
|--------|-----------|------|-------|
| (none) | - | - | Root-level entity |

#### `vessels`
| Column | References | Type | Notes |
|--------|-----------|------|-------|
| `fleetId` | `fleets.id` | Implicit | Optional fleet assignment |

#### `pmsVesselSettings`
| Column | References | Type | Notes |
|--------|-----------|------|-------|
| `vesselId` | `vessels.id` | Implicit | One settings record per vessel (unique constraint) |

---

### 2.2 Component Domain

#### `components`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |
| `parentId` | `components.id` | Implicit (Self-ref) | Many:1 |
| `parentComponent` | (text description) | N/A | Free text |
| `parentFleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `rhMasterComponentId` | `components.id` | Implicit (Self-ref) | Many:1 |
| `makerCode` | `makerList.makerCode` | Implicit | Many:1 |
| `modelCode` | (composite key) | N/A | Maker+Model combination |
| `applicableVesselIds` | `vessels.code[]` | Implicit (Array) | Many:Many (stores vessel codes, not IDs) |

**Denormalized Fields:**
- `fleetEquipmentName` (duplicates `masterData.equipmentName`)
- `parentComponent` (text reference to parent component name)

#### `componentDocuments`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.code` | Denormalized | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |

#### `componentClassRegulatory`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.code` | Denormalized | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

#### `componentMaintenanceHistory`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.code` | Denormalized | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |
| `jobId` | `jobs.id` | Implicit | Many:1 |
| `jobCode` | `jobs.jobNo` | Denormalized | Many:1 |
| `workOrderId` | `workOrders.id` | Implicit | Many:1 |
| `workOrderNo` | `workOrders.workOrderNo` | Denormalized | Many:1 |

#### `componentRequisitions`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.code` | Denormalized | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |
| `relatedPartCode` | `spares.partCode` | Implicit | Many:1 (optional) |

#### `componentRunningHoursLog`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.code` | Denormalized | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

---

### 2.3 Jobs Domain

#### `jobs`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `componentId` | `components.id` | **DEPRECATED** | Many:1 |
| `componentCode` | `components.code` | **DEPRECATED** | Many:1 |
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |

**Important:** `componentId`/`componentCode`/`componentName` are marked DEPRECATED. Use `jobComponentLinks` table for many-to-many relationships.

#### `jobComponentLinks` (Junction Table)
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `jobId` | `jobs.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.componentCode` | Denormalized | - |

**Unique Constraint:** (`jobId`, `componentId`) - prevents duplicate links

**Component-Specific Tracking:** Contains per-component tracking fields (`lastDoneDate`, `nextDueDate`, `lastDoneRH`, `nextDueRH`) to prevent data mixing between components sharing the same job.

---

### 2.4 Work Orders Domain

#### `workOrders`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `component` | (text field) | N/A | Free text |
| `componentCode` | `components.componentCode` | Implicit | Many:1 |
| `jobId` | `jobs.id` | Implicit | Many:1 |
| `templateId` | `workOrders.id` | Implicit (Self-ref) | Many:1 |
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `applicableVesselIds` | `vessels.code[]` | Implicit (Array) | Many:Many (stores vessel codes) |

**JSON Arrays:** Contains `requiredSpareParts`, `consumedSpareParts`, `requiredTools`, `safetyRequirements`, `uploadedDocuments` as embedded JSON.

#### `workOrderExecutions`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `templateId` | `workOrders.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |
| `vesselId` | `vessels.id` | Implicit | Many:1 |

#### `workOrderExecutionDetails`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `workOrderId` | `workOrders.id` | Implicit | Many:1 |
| `vesselId` | `vessels.id` | Implicit | Many:1 |

---

### 2.5 Spares/Inventory Domain

#### `spares`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.componentCode` | Denormalized | - |
| `componentName` | `components.name` | Denormalized | - |
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `makerCode` | `makerList.makerCode` | Implicit | Many:1 |
| `applicableVesselIds` | `vessels.code[]` | Implicit (Array) | Many:Many (stores vessel codes) |

#### `sparesHistory`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `spareId` | `spares.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.componentCode` | Denormalized | - |
| `componentName` | `components.name` | Denormalized | - |

#### `spareComponentLinks` (Junction Table)
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `spareId` | `spares.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |

**Unique Constraint:** (`spareId`, `componentId`) - prevents duplicate links

#### `locations`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |

**Unique Constraint:** (`vesselId`, `locationName`) - location names unique per vessel

#### `spareLocationStock`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `spareId` | `spares.id` | Implicit | Many:1 |
| `locationId` | `locations.id` | Implicit | Many:1 |

**Unique Constraint:** (`spareId`, `locationId`) - one stock record per spare per location

#### `inventoryTransactions`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `spareId` | `spares.id` | Implicit | Many:1 |
| `locationId` | `locations.id` | Implicit | Many:1 (optional) |
| `referenceId` | (WO number, import batch) | Polymorphic | Many:1 |

---

### 2.6 Stores Domain (Isolated from PMS)

**IMPORTANT:** Per Global Business Rule Section 7.2, the Stores module has ZERO PMS linkages.

#### `storesItems`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |

**No componentId, workOrderId, or jobId** - completely isolated from Components/Jobs/Work Orders.

#### `storesLedger`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `itemId` | `storesItems.id` | Implicit | Many:1 |

---

### 2.7 Defects Domain

#### `defects`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `vesselName` | `vessels.name` | Denormalized | - |
| `componentId` | `components.id` | Implicit | Many:1 (optional) |
| `linkedDefects` | `defects.id[]` | Implicit (Array) | Many:Many |

**Embedded JSON:** Contains `notes`, `actions`, `attachments`, `auditTrail` as embedded arrays.

#### `defectActions`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `defectId` | `defects.id` | Implicit | Many:1 |

#### `defectAttachments`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `defectId` | `defects.id` | Implicit | Many:1 |

#### `recurringDefects`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `equipmentKey` | (normalized key) | N/A | Aggregation key |

#### `recurringDefectLinks` (Junction Table) - **HAS EXPLICIT FK**
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `recurringId` | `recurringDefects.id` | **EXPLICIT FK** | Many:1 |
| `defectId` | `defects.id` | **EXPLICIT FK** | Many:1 |

**Composite Primary Key:** (`recurringId`, `defectId`)
**Cascade Delete:** Both FKs have `onDelete: "cascade"`

---

### 2.8 Running Hours Domain

#### `runningHoursAudit`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |
| `componentCode` | `components.componentCode` | Denormalized | - |
| `componentName` | `components.name` | Denormalized | - |

---

### 2.9 Certificates/Surveys Domain

#### `certificates`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vessel` | `vessels.name` | Implicit (by name) | Many:1 |
| `vesselId` | `vessels.id` | Implicit | Many:1 |

#### `surveys`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vessel` | `vessels.name` | Implicit (by name) | Many:1 |
| `vesselId` | `vessels.id` | Implicit | Many:1 |

#### `shipCertificatesMaster`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| (none) | - | - | Master definition table |

#### `vesselCertificateApplicability`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `masterId` | `shipCertificatesMaster.masterId` | Implicit | Many:1 |

---

### 2.10 Fleet Mapping Domain

#### `fleetVesselMapping`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

**Unique Constraint:** (`fleetEquipmentCode`, `vesselCode`)

#### `fleetComponentMapping`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |
| `componentCode` | `components.componentCode` | Implicit | Many:1 |
| `componentId` | `components.id` | Implicit | Many:1 |

**Unique Constraint:** (`fleetEquipmentCode`, `vesselCode`, `componentCode`)

#### `fleetJobVesselMapping`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `jobCode` | `jobs.jobNo` | Implicit | Many:1 |
| `jobId` | `jobs.id` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

**Unique Constraint:** (`jobCode`, `vesselCode`)

#### `fleetSpareVesselMapping`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `fleetEquipmentCode` | `masterData.fleetEquipmentCode` | Implicit | Many:1 |
| `partCode` | `spares.partCode` | Implicit | Many:1 |
| `spareId` | `spares.id` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

**Unique Constraint:** (`partCode`, `vesselCode`)

#### `masterData`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `makerCode` | `makerList.makerCode` | Implicit | Many:1 |
| `sfiCode` | `sfiDetails.componentCode` | Implicit | Many:1 |
| `vesselCode` | `vessels.code` | Implicit | Many:1 |

---

### 2.11 Change Management Domain

#### `changeRequest`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |
| `targetId` | (polymorphic) | Implicit | Many:1 |

**Target Types:** `component`, `work_order`, `spare`, `store`

#### `changeRequestAttachment`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `changeRequestId` | `changeRequest.id` | Implicit | Many:1 |

#### `changeRequestComment`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `changeRequestId` | `changeRequest.id` | Implicit | Many:1 |

---

### 2.12 Alerts Domain

#### `alertPolicies`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| (none) | - | - | Configuration table |

#### `alertEvents`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `policyId` | `alertPolicies.id` | Implicit | Many:1 |
| `objectId` | (polymorphic) | Implicit | Many:1 |
| `vesselId` | `vessels.id` | Implicit | Many:1 (optional) |

**Object Types:** `work_order`, `component`, `spare`, `certificate`, `system`

#### `alertDeliveries`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `eventId` | `alertEvents.id` | Implicit | Many:1 |

#### `alertConfig`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |

---

### 2.13 Import/Audit Domain

#### `importHistory`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 (optional) |

#### `importChangeLog` - **HAS EXPLICIT FK**
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `importHistoryId` | `importHistory.id` | **EXPLICIT FK** | Many:1 |
| `entityId` | (polymorphic) | Implicit | Many:1 |

**Cascade Delete:** `onDelete: "cascade"`

#### `bulkImportHistory`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselCode` | `vessels.code` | Implicit | Many:1 (optional) |

#### `bulkImportErrors`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `importHistoryId` | `bulkImportHistory.id` | Implicit | Many:1 |

#### `auditLog`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselCode` | `vessels.code` | Implicit | Many:1 (optional) |
| `componentCode` | `components.code` | Implicit | Many:1 (optional) |
| `entityId` | (polymorphic) | Implicit | Many:1 |

---

### 2.14 Defect Sequences

#### `defectSequences`
| Column | References | Type | Cardinality |
|--------|-----------|------|-------------|
| `vesselId` | `vessels.id` | Implicit | Many:1 |

**Unique Index:** (`vesselId`, `year`) - one sequence per vessel per year

---

## 3. Relationship Usage Analysis

### 3.1 Common Join Patterns

Based on the implicit relationships, common queries would join on:

1. **Vessel-scoped queries:**
   ```sql
   WHERE table.vesselId = :vesselId
   ```

2. **Component lookups:**
   ```sql
   WHERE table.componentId = components.id
   -- OR (text-based)
   WHERE table.componentCode = components.code
   ```

3. **Fleet-to-vessel propagation:**
   ```sql
   JOIN fleetComponentMapping ON components.fleetEquipmentCode = mapping.fleetEquipmentCode
   ```

### 3.2 Enforcement Layers

| Layer | Enforcement | Coverage |
|-------|-------------|----------|
| Database (FK) | Cascade deletes, referential integrity | 2 tables only |
| Application | Validation before insert/update | All tables |
| Unique Constraints | Prevent duplicates | ~15 tables |
| Indexes | Query performance (not integrity) | All tables |

---

## 4. FK Gaps and Risks

### 4.1 Missing Critical FK Constraints

**HIGH RISK - Core Domain Relationships:**

| Source Table | Column | Should Reference | Risk |
|--------------|--------|-----------------|------|
| `components` | `vesselId` | `vessels.id` | Orphan components if vessel deleted |
| `components` | `parentId` | `components.id` | Orphan children if parent deleted |
| `jobs` | `vesselId` | `vessels.id` | Orphan jobs |
| `jobs` | `componentId` | `components.id` | Jobs referencing deleted components |
| `workOrders` | `vesselId` | `vessels.id` | Orphan work orders |
| `workOrders` | `jobId` | `jobs.id` | Work orders referencing deleted jobs |
| `spares` | `vesselId` | `vessels.id` | Orphan spares |
| `spares` | `componentId` | `components.id` | Spares referencing deleted components |
| `defects` | `vesselId` | `vessels.id` | Orphan defects |

**MEDIUM RISK - Supporting Tables:**

| Source Table | Column | Should Reference |
|--------------|--------|-----------------|
| `runningHoursAudit` | `componentId` | `components.id` |
| `sparesHistory` | `spareId` | `spares.id` |
| `defectActions` | `defectId` | `defects.id` |
| `defectAttachments` | `defectId` | `defects.id` |
| `alertEvents` | `policyId` | `alertPolicies.id` |
| `alertDeliveries` | `eventId` | `alertEvents.id` |
| `changeRequestAttachment` | `changeRequestId` | `changeRequest.id` |
| `changeRequestComment` | `changeRequestId` | `changeRequest.id` |

### 4.2 Text-Based Reference Risks

**Problem:** Many relationships use text codes (e.g., `componentCode`, `vesselCode`, `partCode`) instead of IDs.

| Pattern | Tables Affected | Risks |
|---------|----------------|-------|
| `componentCode` references | 15+ tables | Code changes break links |
| `vesselCode` references | 10+ tables | Vessel code changes break links |
| `fleetEquipmentCode` references | 8+ tables | Code changes break fleet mappings |
| `jobNo` / `jobCode` references | 5+ tables | Job number changes break links |
| `partCode` references | 4+ tables | Part code changes break inventory links |

**Mitigation Required:**
- Application-level cascade updates when codes change
- Or: Add proper FK on ID columns, use codes only for display

### 4.3 Orphan Record Risks

**Scenario 1: Vessel Deletion**
- All vessel-scoped data (components, jobs, work orders, spares, defects, etc.) becomes orphaned
- No cascade delete exists

**Scenario 2: Component Deletion**
- `componentDocuments`, `componentClassRegulatory`, `componentMaintenanceHistory` orphaned
- `spareComponentLinks`, `jobComponentLinks` orphaned
- Running hours audit trail orphaned

**Scenario 3: Job Deletion**
- `jobComponentLinks` orphaned
- Work orders referencing the job retain stale `jobId`

### 4.4 Polymorphic Reference Risks

Several tables use polymorphic references (`objectType` + `objectId` pattern):

| Table | Type Column | ID Column | Valid Types |
|-------|-------------|-----------|-------------|
| `alertEvents` | `objectType` | `objectId` | work_order, component, spare, certificate, system |
| `auditLog` | `entityType` | `entityId` | component, job, work_order, spare, document, survey, maintenance_history |
| `changeRequest` | `targetType` | `targetId` | component, work_order, spare, store |
| `importChangeLog` | `entityType` | `entityId` | component, job, spare, store |

**Risk:** Cannot enforce FK constraints on polymorphic columns. Application must ensure referenced entity exists.

---

## 5. Redundant/Duplicated Data

### 5.1 Denormalization Summary

The database contains significant denormalization for UI convenience and performance:

| Table | Denormalized Column | Source Table | Source Column |
|-------|---------------------|--------------|---------------|
| `components` | `fleetEquipmentName` | `masterData` | `equipmentName` |
| `components` | `parentComponent` | `components` (parent) | `name` (free text) |
| `jobs` | `componentName` | `components` | `name` |
| `jobs` | `componentCode` | `components` | `componentCode` |
| `workOrders` | `component` | `components` | `name` |
| `workOrders` | `componentCode` | `components` | `componentCode` |
| `spares` | `componentCode` | `components` | `componentCode` |
| `spares` | `componentName` | `components` | `name` |
| `defects` | `vesselName` | `vessels` | `name` |
| `sparesHistory` | `componentCode` | `components` | `componentCode` |
| `sparesHistory` | `componentName` | `components` | `name` |
| `runningHoursAudit` | `componentCode` | `components` | `componentCode` |
| `runningHoursAudit` | `componentName` | `components` | `name` |
| `componentDocuments` | `componentCode` | `components` | `componentCode` |
| `componentClassRegulatory` | `componentCode` | `components` | `componentCode` |
| `componentMaintenanceHistory` | `componentCode` | `components` | `componentCode` |
| `componentMaintenanceHistory` | `workOrderNo` | `workOrders` | `workOrderNo` |
| `componentRequisitions` | `componentCode` | `components` | `componentCode` |
| `jobComponentLinks` | `componentCode` | `components` | `componentCode` |
| `fleetComponentMapping` | `componentName` | `components` | `name` |
| `fleetJobVesselMapping` | `vesselName` | `vessels` | `name` |
| `fleetSpareVesselMapping` | `vesselName` | `vessels` | `name` |
| `fleetVesselMapping` | `vesselName` | `vessels` | `name` |
| `vesselCertificateApplicability` | `vesselName` | `vessels` | `name` |

### 5.2 Data Staleness Risks

When source data changes, denormalized copies become stale unless:
1. Application performs cascade updates
2. Batch jobs periodically sync data

**Example:** If `components.name` changes:
- 10+ tables have stale `componentName` values
- UI may show inconsistent component names

### 5.3 Justifications for Denormalization

| Pattern | Justification |
|---------|---------------|
| `vesselName` duplication | Avoids join for every vessel-scoped query |
| `componentCode`/`componentName` | Enables queries without joining components table |
| Fleet equipment names | Reduces joins for fleet-to-vessel mapping |
| Work order display fields | Historical accuracy (name at time of WO creation) |

---

## 6. Vessel Isolation Analysis

### 6.1 Scoping Pattern

Most tables use `vesselId` (or `vesselCode`) as a scoping field:

```typescript
// Pattern in most tables
vesselId: text("vessel_id").notNull()
```

### 6.2 Tables WITHOUT Vessel Scope (Shared Data)

These tables contain data shared across vessels:

| Table | Scope | Notes |
|-------|-------|-------|
| `fleets` | Global | Fleet definitions |
| `vessels` | Global | Vessel registry |
| `users` | Global (with vesselId filter) | User accounts |
| `masterLists` | Global | Dropdown options |
| `makers` | Global | Manufacturer registry |
| `makerList` | Global | Maker master data |
| `sfiDetails` | Global | SFI codes |
| `masterData` | Global | Fleet equipment codes |
| `fleetEquipmentMaster` | Global | Fleet equipment definitions |
| `shipCertificatesMaster` | Global | Certificate definitions |
| `shipCertificatesLabelsConfig` | Global | Label configuration |
| `equipmentCategories` | Global | Equipment categories |
| `defectCategories` | Global | Defect categories |
| `defectTypes` | Global | Defect types |
| `formDefinitions` | Global | Form templates |
| `formVersions` | Global | Form versions |
| `alertPolicies` | Global | Alert configurations |
| `recurringDefects` | Cross-vessel | Aggregates defects across fleet |

### 6.3 Vessel Isolation Enforcement

**Application Layer Only:**
- No database-level row-level security (RLS)
- No database constraints enforce vessel isolation
- All isolation depends on application queries including `WHERE vesselId = :currentVessel`

**Risk Vectors:**

1. **Direct SQL Access:** Anyone with DB access can query cross-vessel data
2. **API Bugs:** Missing vessel filter in API can expose other vessels' data
3. **Joins on Shared Tables:** Joining fleet tables without vessel filtering
4. **Fleet-Level Data:** `dataScope='fleet'` records are intentionally cross-vessel

### 6.4 Cross-Vessel Contamination Risks

| Scenario | Risk Level | Mitigation |
|----------|------------|------------|
| Component created without vesselId | High | Application validation |
| Work order assigned wrong vesselId | High | Application validation |
| Fleet job "pushed" to wrong vessel | Medium | Fleet mapping tables |
| Defect linked to wrong vessel's component | Medium | UI prevents cross-vessel selection |
| Spare inventory mixed between vessels | High | vesselId on all inventory tables |

### 6.5 Recommendations for Stronger Isolation

1. **Row-Level Security (RLS):**
   ```sql
   CREATE POLICY vessel_isolation ON components
     USING (vessel_id = current_setting('app.current_vessel_id'));
   ```

2. **Not-Null Constraints:** Ensure `vesselId` is NOT NULL on vessel-scoped tables

3. **Composite Primary Keys:** Consider (`vesselId`, `id`) patterns

4. **API Middleware:** Always inject vessel context from authenticated session

---

## 7. Relationship Flow Diagrams

### 7.1 Core PMS Flow

```
VESSEL
  |
  +-- COMPONENT (vesselId) ---+-- COMPONENT_DOCUMENTS
  |     |                     +-- COMPONENT_CLASS_REGULATORY
  |     |                     +-- COMPONENT_MAINTENANCE_HISTORY
  |     |                     +-- COMPONENT_REQUISITIONS
  |     |                     +-- RUNNING_HOURS_AUDIT
  |     |
  |     +-- (child) COMPONENT (parentId)
  |     |
  |     +-- JOB (componentId - DEPRECATED)
  |     |     |
  |     |     +-- JOB_COMPONENT_LINKS (M:M junction)
  |     |           |
  |     |           +-- COMPONENT
  |     |
  |     +-- WORK_ORDER (componentCode)
  |     |     |
  |     |     +-- WORK_ORDER_EXECUTIONS
  |     |     +-- WORK_ORDER_EXECUTION_DETAILS
  |     |     |
  |     |     +-- JOB (jobId)
  |     |
  |     +-- SPARE (componentId)
  |           |
  |           +-- SPARE_COMPONENT_LINKS (M:M junction)
  |           +-- SPARE_LOCATION_STOCK
  |           +-- INVENTORY_TRANSACTIONS
  |           +-- SPARES_HISTORY
  |
  +-- DEFECT (vesselId)
  |     |
  |     +-- DEFECT_ACTIONS
  |     +-- DEFECT_ATTACHMENTS
  |     +-- COMPONENT (componentId - optional link)
  |     +-- RECURRING_DEFECT_LINKS --> RECURRING_DEFECTS
  |
  +-- CERTIFICATE (vesselId)
  +-- SURVEY (vesselId)
  +-- LOCATION (vesselId)
  +-- STORES_ITEM (vesselId) -- ISOLATED from PMS
  +-- PMS_VESSEL_SETTINGS (1:1)
  +-- DEFECT_SEQUENCES (vesselId, year)
  +-- ALERT_CONFIG (vesselId)
```

### 7.2 Fleet-to-Vessel Propagation Flow

```
MASTER_DATA (fleetEquipmentCode)
  |
  +-- FLEET_EQUIPMENT_MASTER
  |
  +-- FLEET_VESSEL_MAPPING
  |     |
  |     +-- VESSEL (vesselCode)
  |
  +-- FLEET_COMPONENT_MAPPING
  |     |
  |     +-- COMPONENT (componentId/componentCode)
  |     +-- VESSEL (vesselCode)
  |
  +-- FLEET_JOB_VESSEL_MAPPING
  |     |
  |     +-- JOB (jobId/jobCode)
  |     +-- VESSEL (vesselCode)
  |
  +-- FLEET_SPARE_VESSEL_MAPPING
        |
        +-- SPARE (spareId/partCode)
        +-- VESSEL (vesselCode)

COMPONENT (dataScope='fleet')
  |
  +-- Propagated to --> COMPONENT (dataScope='vessel', vesselId=X)
  
JOB (dataScope='fleet')
  |
  +-- Propagated to --> JOB (dataScope='vessel', vesselId=X)
```

### 7.3 Inventory Transaction Flow

```
SPARE
  |
  +-- SPARE_LOCATION_STOCK (current qty per location)
  |     |
  |     +-- LOCATION (locationId)
  |
  +-- INVENTORY_TRANSACTIONS (history)
  |     |
  |     +-- LOCATION (locationId, optional)
  |     +-- WORK_ORDER (referenceId when referenceType='WORK_ORDER')
  |
  +-- SPARE_COMPONENT_LINKS (M:M)
        |
        +-- COMPONENT
```

### 7.4 Change Management Flow

```
CHANGE_REQUEST
  |
  +-- VESSEL (vesselId)
  |
  +-- Target Entity (polymorphic)
  |     +-- COMPONENT (targetType='component')
  |     +-- WORK_ORDER (targetType='work_order')
  |     +-- SPARE (targetType='spare')
  |     +-- STORES_ITEM (targetType='store')
  |
  +-- CHANGE_REQUEST_ATTACHMENT
  +-- CHANGE_REQUEST_COMMENT
```

### 7.5 Alert System Flow

```
ALERT_POLICIES (configuration)
  |
  +-- ALERT_EVENTS (triggered alerts)
        |
        +-- Target Entity (polymorphic)
        |     +-- WORK_ORDER
        |     +-- COMPONENT
        |     +-- SPARE
        |     +-- CERTIFICATE
        |
        +-- VESSEL (vesselId, optional)
        |
        +-- ALERT_DELIVERIES
              |
              +-- Recipient (user, email, etc.)
              
ALERT_CONFIG (per-vessel settings)
  |
  +-- VESSEL
```

---

## 8. Summary and Architectural Observations

### 8.1 Strengths

1. **Comprehensive Coverage:** 66 tables cover all aspects of maritime maintenance management
2. **Flexible Dual-Scope Design:** Fleet/vessel pattern enables template reuse across vessels
3. **Extensive Indexing:** Well-indexed for common query patterns
4. **Audit Trail:** Strong audit logging with `runningHoursAudit`, `auditLog`, `sparesHistory`
5. **Unique Constraints:** Proper use of unique constraints on junction tables
6. **Stores Isolation:** Deliberate isolation of Stores module from PMS prevents complexity

### 8.2 Weaknesses

1. **Minimal FK Constraints:** Only 3 explicit FKs in entire schema creates orphan risk
2. **Heavy Denormalization:** 25+ denormalized columns create staleness risk
3. **Text-Based References:** Using codes instead of IDs makes refactoring dangerous
4. **No Database-Level Vessel Isolation:** All isolation is application-enforced
5. **Polymorphic Patterns:** Multiple tables use `type`+`id` pattern that can't be FK-constrained
6. **Date Format Inconsistency:** Mix of `DD-MMM-YYYY`, `YYYY-MM-DD`, ISO formats

### 8.3 Normalization Recommendations

**Priority 1 - Add Critical FKs:**
```typescript
// components -> vessels
vesselId: text("vessel_id").notNull().references(() => vessels.id)

// jobs -> vessels (when dataScope='vessel')
vesselId: text("vessel_id").references(() => vessels.id)

// workOrders -> jobs
jobId: text("job_id").references(() => jobs.id)

// All child tables -> parent tables with onDelete: "cascade" or "set null"
```

**Priority 2 - Standardize ID References:**
- Use UUID `id` columns for joins, keep `code` columns for display only
- Add proper FKs on ID columns

**Priority 3 - Consider Row-Level Security:**
- Implement PostgreSQL RLS policies for vessel isolation
- Add `SET app.current_vessel_id` at session start

**Priority 4 - Reduce Denormalization:**
- Remove `componentName`, `vesselName` duplications where not needed for history
- Keep denormalization only for immutable historical records

### 8.4 Consistency with Maritime PMS Standards

The schema aligns with common maritime PMS patterns:
- SFI code integration for equipment classification
- Running hours tracking with cascade to children
- Class/regulatory certificate management
- Defect-to-component linking
- Fleet-to-vessel data propagation

### 8.5 Technical Debt Summary

| Category | Items | Effort to Fix |
|----------|-------|---------------|
| Missing FKs | ~40 relationships | Medium (migration + app changes) |
| Denormalized data | ~25 columns | High (requires cascade updates) |
| Text-based refs | ~15 patterns | High (requires ID migration) |
| Date format inconsistency | ~10 tables | Low (standardize on ISO) |
| Polymorphic patterns | 4 tables | Medium (consider separate tables) |

---

## Appendix A: Complete Table List

1. users
2. fleets
3. vessels
4. defectSequences
5. runningHoursAudit
6. components
7. formDefinitions
8. formVersions
9. formVersionUsage
10. ihmItems
11. ihmMaintenanceLog
12. spares
13. sparesHistory
14. storesLedger
15. storesItems
16. changeRequest
17. changeRequestAttachment
18. changeRequestComment
19. alertPolicies
20. alertEvents
21. alertDeliveries
22. alertConfig
23. jobs
24. workOrders
25. workOrderExecutions
26. defects
27. defectActions
28. defectAttachments
29. recurringDefects
30. recurringDefectLinks
31. importHistory
32. importChangeLog
33. makers
34. masterLists
35. fleetEquipmentMaster
36. componentRunningHoursLog
37. auditLog
38. componentDocuments
39. componentClassRegulatory
40. componentMaintenanceHistory
41. componentRequisitions
42. pmsVesselSettings
43. makerList
44. sfiDetails
45. masterData
46. fleetVesselMapping
47. fleetComponentMapping
48. fleetJobVesselMapping
49. fleetSpareVesselMapping
50. bulkImportHistory
51. bulkImportErrors
52. certificates
53. surveys
54. workOrderExecutionDetails
55. locations
56. spareComponentLinks
57. spareLocationStock
58. inventoryTransactions
59. jobComponentLinks
60. equipmentCategories
61. defectCategories
62. defectTypes
63. shipCertificatesMaster
64. shipCertificatesLabelsConfig
65. vesselCertificateApplicability

---

## Appendix B: Explicit FK Reference

The only explicit foreign key constraints in the schema:

```typescript
// File: shared/schema.ts

// Line 1303-1304: recurringDefectLinks
recurringId: integer("recurring_id")
  .notNull()
  .references(() => recurringDefects.id, { onDelete: "cascade" })
defectId: text("defect_id")
  .notNull()
  .references(() => defects.id, { onDelete: "cascade" })

// Line 1345: importChangeLog
importHistoryId: text("import_history_id")
  .notNull()
  .references(() => importHistory.id, { onDelete: "cascade" })
```

All other relationships are implicit and enforced only at the application layer.

---

*Document generated from analysis of `shared/schema.ts` (2422 lines, 65 tables)*
*Last updated: January 2026*
