# Entity-Relationship Diagram

## Overview

This document contains the complete ER diagram and relationship analysis for the application, derived from the PostgreSQL schema and business logic.

**Total Entities**: 70 PostgreSQL tables

---

## ER Diagram (Mermaid Format)

```mermaid
erDiagram
    %% ===========================================
    %% CORE ENTITIES: Fleet & Vessel Organization
    %% ===========================================
    
    fleets {
        text id PK
        text code UK
        text name
        boolean is_active
    }
    
    vessels {
        text id PK
        text name
        text code
        text fleet_id FK
        text imo_number
        text vessel_type
        integer vessel_sequence
    }
    
    users {
        integer id PK
        text username UK
        text full_name
        text role
        text vessel_id FK
        text department
    }
    
    fleets ||--o{ vessels : "groups"
    vessels ||--o{ users : "assigns Ship role"
    
    %% ===========================================
    %% COMPONENT HIERARCHY & EQUIPMENT
    %% ===========================================
    
    components {
        text id PK
        text fleet_equipment_code
        text fleet_equipment_name
        text parent_id FK
        text component_code
        text name
        text vessel_id FK
        text data_scope
        text rh_counter_type
        text rh_master_component_id FK
        decimal current_cumulative_rh
    }
    
    vessels ||--o{ components : "has vessel components"
    components ||--o{ components : "parent-child hierarchy"
    components ||--o{ components : "RH inheritance (MASTER->INHERITED)"
    
    %% ===========================================
    %% RUNNING HOURS TRACKING
    %% ===========================================
    
    runningHoursAudit {
        integer id PK
        text vessel_id FK
        text component_id FK
        decimal previous_rh
        decimal new_rh
        decimal cumulative_rh
        text source
        boolean is_renewal_reset
    }
    
    componentRunningHoursLog {
        integer id PK
        text vessel_code FK
        text component_id FK
        text component_code
        decimal delta_rh
        text update_source
    }
    
    components ||--o{ runningHoursAudit : "tracks RH changes"
    components ||--o{ componentRunningHoursLog : "logs RH updates"
    
    %% ===========================================
    %% JOBS & WORK ORDERS (PMS Core)
    %% ===========================================
    
    jobs {
        text id PK
        text job_no
        text component_id FK
        text vessel_id FK
        text data_scope
        text trigger_type
        text interval_type
        integer interval_value
        text status
    }
    
    workOrders {
        text id PK
        text work_order_no
        text job_id FK
        text component_id FK
        text vessel_id FK
        text due_type
        text due_date
        text status
    }
    
    workOrderExecutions {
        text id PK
        text template_id FK
        text component_id FK
        text vessel_id FK
        text execution_id UK
        text date_completed
        text status
    }
    
    workOrderExecutionDetails {
        integer id PK
        text execution_id FK
        text before_photo_url
        text after_photo_url
        json spare_parts_used
    }
    
    components ||--o{ jobs : "has maintenance jobs"
    jobs ||--o{ workOrders : "generates work orders"
    workOrders ||--o{ workOrderExecutions : "records executions"
    workOrderExecutions ||--|| workOrderExecutionDetails : "has details"
    vessels ||--o{ jobs : "vessel jobs"
    vessels ||--o{ workOrders : "vessel work orders"
    
    %% ===========================================
    %% JOB-COMPONENT MANY-TO-MANY LINKING
    %% ===========================================
    
    jobComponentLinks {
        integer id PK
        text vessel_id FK
        text job_id FK
        text component_id FK
        text last_done_date
        text next_due_date
    }
    
    jobs ||--o{ jobComponentLinks : "links to"
    components ||--o{ jobComponentLinks : "linked from"
    
    %% ===========================================
    %% SPARES MANAGEMENT
    %% ===========================================
    
    spares {
        integer id PK
        text part_code
        text part_name
        text component_id FK
        text vessel_id FK
        text data_scope
        text fleet_equipment_code FK
        integer rob
        integer min
    }
    
    sparesHistory {
        integer id PK
        integer spare_id FK
        text vessel_id FK
        text action_type
        integer quantity_before
        integer quantity_after
    }
    
    locations {
        integer id PK
        text vessel_id FK
        text location_name UK
    }
    
    spareLocationStock {
        integer id PK
        text vessel_id FK
        integer spare_id FK
        integer location_id FK
        integer qty
    }
    
    inventoryTransactions {
        integer id PK
        text vessel_id FK
        integer spare_id FK
        integer location_id FK
        text event_type
        integer qty_change
        text reference_type
    }
    
    spareComponentLinks {
        integer id PK
        text vessel_id FK
        integer spare_id FK
        text component_id FK
    }
    
    components ||--o{ spares : "has spares"
    vessels ||--o{ spares : "vessel spares"
    spares ||--o{ sparesHistory : "tracks history"
    vessels ||--o{ locations : "has storage locations"
    spares ||--o{ spareLocationStock : "stock per location"
    locations ||--o{ spareLocationStock : "stock at location"
    spares ||--o{ inventoryTransactions : "inventory movements"
    spares ||--o{ spareComponentLinks : "linked to components"
    components ||--o{ spareComponentLinks : "has linked spares"
    
    %% ===========================================
    %% STORES MANAGEMENT
    %% ===========================================
    
    storesItems {
        integer id PK
        text vessel_id FK
        text item_code UK
        text item_name
        text item_type
        integer quantity
    }
    
    storesLedger {
        integer id PK
        text stores_item_id FK
        text vessel_id FK
        text transaction_type
        integer quantity
    }
    
    vessels ||--o{ storesItems : "has stores"
    storesItems ||--o{ storesLedger : "ledger entries"
    
    %% ===========================================
    %% DEFECTS MODULE
    %% ===========================================
    
    defects {
        text id PK
        text vessel_id FK
        text component_id FK
        text category
        text status
        boolean is_coc
        text equipment_key
        json linked_defects
    }
    
    defectSequences {
        integer id PK
        text vessel_id FK
        integer year
        integer last_sequence
    }
    
    defectActions {
        integer id PK
        text defect_id FK
        text action_type
        text status
    }
    
    defectAttachments {
        integer id PK
        text defect_id FK
        text filename
        text attachment_type
    }
    
    recurringDefects {
        integer id PK
        text equipment_key
        integer occurrence_count
        integer vessels_affected
    }
    
    recurringDefectLinks {
        integer recurring_id FK
        text defect_id FK
    }
    
    vessels ||--o{ defects : "has defects"
    vessels ||--o{ defectSequences : "defect numbering"
    components ||--o{ defects : "defect on component"
    defects ||--o{ defectActions : "has actions"
    defects ||--o{ defectAttachments : "has attachments"
    defects }o--o{ defects : "linked defects (self-ref)"
    recurringDefects ||--o{ recurringDefectLinks : "links defects"
    defects ||--o{ recurringDefectLinks : "part of recurring group"
    
    %% ===========================================
    %% MASTER DATA CATEGORIES
    %% ===========================================
    
    equipmentCategories {
        integer id PK
        text name UK
    }
    
    defectCategories {
        integer id PK
        text name UK
    }
    
    defectTypes {
        integer id PK
        text name UK
    }
    
    %% ===========================================
    %% CHANGE REQUESTS
    %% ===========================================
    
    changeRequest {
        integer id PK
        text vessel_id FK
        text category
        text target_type
        text target_id FK
        text status
        json proposed_changes_json
    }
    
    changeRequestAttachment {
        integer id PK
        integer change_request_id FK
    }
    
    changeRequestComment {
        integer id PK
        integer change_request_id FK
        text user_id FK
    }
    
    vessels ||--o{ changeRequest : "has change requests"
    changeRequest ||--o{ changeRequestAttachment : "has attachments"
    changeRequest ||--o{ changeRequestComment : "has comments"
    
    %% ===========================================
    %% ALERTS & NOTIFICATIONS
    %% ===========================================
    
    alertPolicies {
        integer id PK
        text policy_name UK
        text alert_type
        text conditions
    }
    
    alertEvents {
        integer id PK
        integer policy_id FK
        text vessel_id FK
        text priority
        text status
    }
    
    alertDeliveries {
        integer id PK
        integer event_id FK
        text channel
        text status
    }
    
    alertConfig {
        integer id PK
        text vessel_id FK UK
    }
    
    alertPolicies ||--o{ alertEvents : "triggers events"
    alertEvents ||--o{ alertDeliveries : "has deliveries"
    vessels ||--o{ alertEvents : "vessel alerts"
    vessels ||--o| alertConfig : "vessel config"
    
    %% ===========================================
    %% CERTIFICATES & SURVEYS MODULE
    %% ===========================================
    
    certificates {
        integer id PK
        text vessel_id FK
        text certificate_type
        text certificate_number
        text issue_date
        text expiry_date
    }
    
    surveys {
        integer id PK
        text vessel_id FK
        text component_id FK
        text survey_type
        text survey_date
        text next_due_date
    }
    
    shipCertificatesMaster {
        integer id PK
        text master_id UK
        text certificate_name
        text category
        text group
    }
    
    vesselCertificateApplicability {
        integer id PK
        text vessel_id FK
        text master_id FK
    }
    
    vesselCertificateData {
        integer id PK
        text vessel_id FK
        text master_id FK
        text issue_date
        text expiry_date
    }
    
    shipCertificatesLabelsConfig {
        integer id PK
        text config_type
        text key
        text label
    }
    
    shipSurveysMaster {
        integer id PK
        text master_id UK
        text survey_name
        text category
        text group
    }
    
    vesselSurveyApplicability {
        integer id PK
        text vessel_id FK
        text master_id FK
    }
    
    vesselSurveyData {
        integer id PK
        text vessel_id FK
        text master_id FK
        text survey_date
        text due_date
    }
    
    shipSurveysLabelsConfig {
        integer id PK
        text config_type
        text key
        text label
    }
    
    vessels ||--o{ certificates : "has certificates"
    vessels ||--o{ surveys : "has surveys"
    components ||--o{ surveys : "component surveys"
    
    shipCertificatesMaster ||--o{ vesselCertificateApplicability : "applies to vessels"
    shipCertificatesMaster ||--o{ vesselCertificateData : "vessel data"
    vessels ||--o{ vesselCertificateApplicability : "certificate applicability"
    vessels ||--o{ vesselCertificateData : "certificate values"
    
    shipSurveysMaster ||--o{ vesselSurveyApplicability : "applies to vessels"
    shipSurveysMaster ||--o{ vesselSurveyData : "vessel data"
    vessels ||--o{ vesselSurveyApplicability : "survey applicability"
    vessels ||--o{ vesselSurveyData : "survey values"
    
    %% ===========================================
    %% IHM (Hazardous Materials)
    %% ===========================================
    
    ihmItems {
        integer id PK
        text component_id FK
        text spare_id FK
        text vessel_id FK
        text presence
        text materials
    }
    
    ihmMaintenanceLog {
        integer id PK
        text work_order_id FK
        text vessel_id FK
        text action
    }
    
    components ||--o{ ihmItems : "IHM on component"
    spares ||--o{ ihmItems : "IHM on spare"
    vessels ||--o{ ihmItems : "vessel IHM"
    vessels ||--o{ ihmMaintenanceLog : "IHM maintenance"
    
    %% ===========================================
    %% COMPONENT EXTENDED DATA
    %% ===========================================
    
    componentDocuments {
        integer id PK
        text component_id FK
        text component_code
        text vessel_code FK
        text file_type
    }
    
    componentClassRegulatory {
        integer id PK
        text component_id FK
        text component_code
        text vessel_code FK
        text survey_type
        text expiry_date
    }
    
    componentMaintenanceHistory {
        integer id PK
        text component_id FK
        text job_id FK
        text work_order_id FK
        text date_completed
    }
    
    componentRequisitions {
        integer id PK
        text component_id FK
        text vessel_code FK
        text related_part_code FK
        text status
    }
    
    components ||--o{ componentDocuments : "has documents"
    components ||--o{ componentClassRegulatory : "class surveys"
    components ||--o{ componentMaintenanceHistory : "maintenance history"
    components ||--o{ componentRequisitions : "purchase requisitions"
    jobs ||--o{ componentMaintenanceHistory : "job history"
    workOrders ||--o{ componentMaintenanceHistory : "WO history"
    
    %% ===========================================
    %% FLEET MASTER DATA & MAPPINGS
    %% ===========================================
    
    makerList {
        integer id PK
        text maker_code UK
        text maker_name
    }
    
    makers {
        integer id PK
        text maker_code UK
        text maker_name
    }
    
    sfiDetails {
        integer id PK
        text component_code UK
        text component_name
    }
    
    masterData {
        integer id PK
        text fleet_equipment_code UK
        text maker_code FK
        text model_code
        text sfi_code FK
    }
    
    fleetEquipmentMaster {
        integer id PK
        text fleet_equipment_code UK
        text fleet_equipment_name
        text maker_code FK
    }
    
    masterLists {
        integer id PK
        text list_type
        text list_key
        text list_value
    }
    
    fleetVesselMapping {
        integer id PK
        text fleet_equipment_code FK
        text vessel_code FK
    }
    
    fleetComponentMapping {
        integer id PK
        text fleet_equipment_code FK
        text vessel_code FK
        text component_code FK
        text component_id FK
    }
    
    fleetJobVesselMapping {
        integer id PK
        text fleet_equipment_code FK
        text job_code FK
        text job_id FK
        text vessel_code FK
    }
    
    fleetSpareVesselMapping {
        integer id PK
        text fleet_equipment_code FK
        text part_code FK
        text vessel_code FK
    }
    
    makerList ||--o{ masterData : "maker reference"
    sfiDetails ||--o{ masterData : "SFI classification"
    masterData ||--o{ fleetVesselMapping : "maps to vessels"
    masterData ||--o{ fleetComponentMapping : "maps to components"
    masterData ||--o{ fleetJobVesselMapping : "maps jobs to vessels"
    masterData ||--o{ fleetSpareVesselMapping : "maps spares to vessels"
    
    components ||--o{ fleetComponentMapping : "vessel component mapped"
    jobs ||--o{ fleetJobVesselMapping : "fleet job mapped"
    spares ||--o{ fleetSpareVesselMapping : "fleet spare mapped"
    vessels ||--o{ fleetVesselMapping : "vessel in fleet mapping"
    
    %% ===========================================
    %% FORM CONFIGURATION
    %% ===========================================
    
    formDefinitions {
        integer id PK
        text name UK
        text subgroup
    }
    
    formVersions {
        integer id PK
        integer form_id FK
        integer version_no
        text status
        text schema_json
    }
    
    formVersionUsage {
        integer id PK
        integer form_version_id FK
        text used_in_module
    }
    
    formDefinitions ||--o{ formVersions : "has versions"
    formVersions ||--o{ formVersionUsage : "usage tracking"
    
    %% ===========================================
    %% PMS VESSEL SETTINGS
    %% ===========================================
    
    pmsVesselSettings {
        integer id PK
        text vessel_id FK UK
        integer calendar_lead_days_critical
        integer rh_lead_hours_critical
    }
    
    vessels ||--o| pmsVesselSettings : "PMS config"
    
    %% ===========================================
    %% IMPORT & AUDIT TRACKING
    %% ===========================================
    
    importHistory {
        text id PK
        text type
        text mode
        text vessel_id FK
        text status
    }
    
    importChangeLog {
        text id PK
        text import_history_id FK
        text entity_type
        text entity_id
        text operation
    }
    
    bulkImportHistory {
        integer id PK
        text import_type
        text vessel_id FK
        text status
    }
    
    bulkImportErrors {
        integer id PK
        integer import_history_id FK
        integer row_number
        text error_message
    }
    
    auditLog {
        integer id PK
        text user_id FK
        text vessel_code FK
        text entity_type
        text entity_id
        text action_type
    }
    
    importHistory ||--o{ importChangeLog : "tracks changes"
    bulkImportHistory ||--o{ bulkImportErrors : "has errors"
    vessels ||--o{ importHistory : "vessel imports"
    vessels ||--o{ bulkImportHistory : "bulk imports"
    users ||--o{ auditLog : "user actions"
```

---

## Grouped Relationship Explanation by Functional Responsibility

### 1. Fleet & Vessel Organization

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `fleets` → `vessels` | One-to-Many | Fleet groups multiple vessels via `fleet_id` |
| `vessels` → `users` | One-to-Many | Ship-role users are assigned to specific vessels via `vessel_id` |
| `vessels` → `pmsVesselSettings` | One-to-One | Each vessel has optional PMS configuration |

**Identifier Flow**: Fleet code → Vessel code → User assignment. Vessel ID is the primary scoping identifier for most operational data.

---

### 2. Equipment & Component Hierarchy

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `components` → `components` (self) | One-to-Many | Parent-child hierarchy via `parent_id` |
| `components` → `components` (RH) | One-to-Many | Running hours inheritance via `rh_master_component_id` |
| `vessels` → `components` | One-to-Many | Vessel-scoped components via `vessel_id` + `data_scope='vessel'` |
| `fleetEquipmentMaster` → `components` | Implicit | Fleet equipment codes shared across vessel components |

**Composite Relationships**:
- Components use `data_scope` ('fleet' | 'vessel') to discriminate between fleet templates and vessel instances
- RH counter type (`MASTER`, `INHERITED`, `NOT_RH_DRIVEN`) creates logical inheritance chains

---

### 3. Planned Maintenance System (PMS)

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `components` → `jobs` | One-to-Many | Jobs linked via `component_id` |
| `jobs` → `workOrders` | One-to-Many | Work orders generated from job templates via `job_id` |
| `workOrders` → `workOrderExecutions` | One-to-Many | Execution records via `template_id` |
| `workOrderExecutions` → `workOrderExecutionDetails` | One-to-One | Detailed execution data via `execution_id` |
| `jobs` ↔ `components` (M2M) | Many-to-Many | Via `jobComponentLinks` junction table |

**Implicit Logic**:
- Jobs have `trigger_type` determining scheduling logic (Calendar vs Running Hours)
- Work order generation is driven by due dates/hours crossing thresholds
- `componentMaintenanceHistory` creates immutable records on WO completion

---

### 4. Spares & Inventory Management

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `components` → `spares` | One-to-Many | Spares linked via `component_id` |
| `spares` ↔ `components` (M2M) | Many-to-Many | Via `spareComponentLinks` for multi-component linking |
| `spares` → `sparesHistory` | One-to-Many | Movement history via `spare_id` |
| `vessels` → `locations` | One-to-Many | Storage locations per vessel |
| `spares` ↔ `locations` (M2M) | Many-to-Many | Via `spareLocationStock` for location-based inventory |
| `spares` → `inventoryTransactions` | One-to-Many | Transaction ledger via `spare_id` |

**Composite Identifiers**:
- Spare ROB is split across `robLocationA` + `robLocationB` in legacy model
- New model uses `spareLocationStock` for unlimited locations
- `data_scope` discriminates fleet templates from vessel instances

---

### 5. Defect Management

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `vessels` → `defects` | One-to-Many | Defects scoped to vessel via `vessel_id` |
| `components` → `defects` | Optional One-to-Many | Equipment link via `component_id` |
| `defects` → `defectActions` | One-to-Many | Corrective/preventive actions |
| `defects` → `defectAttachments` | One-to-Many | Evidence files |
| `defects` ↔ `defects` (self) | Many-to-Many | Self-referential via JSON `linked_defects` array |
| `defects` ↔ `recurringDefects` (M2M) | Many-to-Many | Via `recurringDefectLinks` junction |
| `vessels` → `defectSequences` | One-to-Many | ID sequence tracking per vessel per year |

**Implicit Logic**:
- `equipment_key` field enables recurring defect detection across vessels
- `is_coc` flag identifies Condition of Class defects requiring special handling

---

### 6. Change Request Workflow

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `vessels` → `changeRequest` | One-to-Many | Vessel-scoped requests |
| `changeRequest` → any entity | Polymorphic | `target_type` + `target_id` reference any entity |
| `changeRequest` → `changeRequestAttachment` | One-to-Many | Supporting documents |
| `changeRequest` → `changeRequestComment` | One-to-Many | Review comments |

**Polymorphic Relationship**: The change request system uses `target_type` (component, job, spare, etc.) and `target_id` to reference any entity type without foreign key constraints.

---

### 7. Certificates & Surveys Compliance

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `shipCertificatesMaster` → `vesselCertificateApplicability` | One-to-Many | Defines which certificates apply to which vessels |
| `shipCertificatesMaster` → `vesselCertificateData` | One-to-Many | Stores vessel-specific date/attachment data |
| `shipSurveysMaster` → `vesselSurveyApplicability` | One-to-Many | Defines survey applicability |
| `shipSurveysMaster` → `vesselSurveyData` | One-to-Many | Vessel-specific survey data |
| `vessels` → `certificates` (legacy) | One-to-Many | Direct certificate records |
| `vessels` → `surveys` (legacy) | One-to-Many | Direct survey records |
| `components` → `surveys` | One-to-Many | Component-level surveys |
| `components` → `componentClassRegulatory` | One-to-Many | Class/regulatory survey data |

---

### 8. Fleet Master Data & Vessel Mapping

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `makerList` → `masterData` | One-to-Many | Maker reference via `maker_code` |
| `sfiDetails` → `masterData` | One-to-Many | SFI classification via `sfi_code` |
| `masterData` → `fleetVesselMapping` | One-to-Many | Fleet equipment to vessel assignment |
| `masterData` → `fleetComponentMapping` | One-to-Many | Fleet equipment to vessel component mapping |
| `masterData` → `fleetJobVesselMapping` | One-to-Many | Fleet job to vessel assignment |
| `masterData` → `fleetSpareVesselMapping` | One-to-Many | Fleet spare to vessel assignment |

**Identifier Flow**: Maker Code + Model + SFI Code → Fleet Equipment Code → Vessel Mappings

---

### 9. IHM (Inventory of Hazardous Materials)

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `components` → `ihmItems` | One-to-Many | Hazmat tracking on components |
| `spares` → `ihmItems` | One-to-Many | Hazmat tracking on spares |
| `workOrders` → `ihmMaintenanceLog` | One-to-Many | Hazmat actions during maintenance |

---

### 10. Alert & Notification System

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `alertPolicies` → `alertEvents` | One-to-Many | Policies trigger events |
| `alertEvents` → `alertDeliveries` | One-to-Many | Delivery channel tracking |
| `vessels` → `alertEvents` | One-to-Many | Vessel-scoped alerts |
| `vessels` → `alertConfig` | One-to-One | Vessel notification preferences |

---

### 11. Import & Audit Trail

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `importHistory` → `importChangeLog` | One-to-Many | Tracks individual record changes for undo |
| `bulkImportHistory` → `bulkImportErrors` | One-to-Many | Error tracking per import |
| `users` → `auditLog` | One-to-Many | User action tracking |

**Cross-entity References**: `auditLog` uses `entity_type` + `entity_id` to reference any entity (polymorphic).

---

### 12. Form Configuration System

| Entities | Relationship | Direction |
|----------|--------------|-----------|
| `formDefinitions` → `formVersions` | One-to-Many | Versioned form schemas |
| `formVersions` → `formVersionUsage` | One-to-Many | Usage tracking per module |

---

## Key Implicit Relationships (Logic-Enforced)

1. **data_scope Discrimination**: Components, jobs, and spares use `data_scope` ('fleet' | 'vessel') to partition fleet templates from vessel instances without separate tables

2. **Running Hours Cascade**: When a MASTER component's RH is updated, all INHERITED components (via `rh_master_component_id`) are automatically synced by application logic

3. **Defect Linked Defects**: Self-referential many-to-many stored as JSON array (`linked_defects`) rather than junction table

4. **Work Order Auto-Generation**: Jobs with `is_pms_auto_gen=true` automatically generate work orders when due thresholds are met

5. **Vessel Isolation**: Nearly all operational tables include `vessel_id` to enforce data isolation at the query level

---

## Complete Entity List (70 Tables)

| # | Table Name | Functional Area |
|---|------------|-----------------|
| 1 | users | Core |
| 2 | fleets | Core |
| 3 | vessels | Core |
| 4 | defectSequences | Defects |
| 5 | runningHoursAudit | Running Hours |
| 6 | components | Equipment |
| 7 | formDefinitions | Forms |
| 8 | formVersions | Forms |
| 9 | formVersionUsage | Forms |
| 10 | ihmItems | IHM |
| 11 | ihmMaintenanceLog | IHM |
| 12 | spares | Spares |
| 13 | sparesHistory | Spares |
| 14 | storesLedger | Stores |
| 15 | storesItems | Stores |
| 16 | changeRequest | Change Requests |
| 17 | changeRequestAttachment | Change Requests |
| 18 | changeRequestComment | Change Requests |
| 19 | alertPolicies | Alerts |
| 20 | alertEvents | Alerts |
| 21 | alertDeliveries | Alerts |
| 22 | alertConfig | Alerts |
| 23 | jobs | PMS |
| 24 | workOrders | PMS |
| 25 | workOrderExecutions | PMS |
| 26 | defects | Defects |
| 27 | defectActions | Defects |
| 28 | defectAttachments | Defects |
| 29 | recurringDefects | Defects |
| 30 | recurringDefectLinks | Defects |
| 31 | importHistory | Import |
| 32 | importChangeLog | Import |
| 33 | makers | Master Data |
| 34 | masterLists | Master Data |
| 35 | fleetEquipmentMaster | Master Data |
| 36 | componentRunningHoursLog | Running Hours |
| 37 | auditLog | Audit |
| 38 | componentDocuments | Component Extended |
| 39 | componentClassRegulatory | Component Extended |
| 40 | componentMaintenanceHistory | Component Extended |
| 41 | componentRequisitions | Component Extended |
| 42 | pmsVesselSettings | PMS |
| 43 | makerList | Master Data |
| 44 | sfiDetails | Master Data |
| 45 | masterData | Master Data |
| 46 | fleetVesselMapping | Fleet Mapping |
| 47 | fleetComponentMapping | Fleet Mapping |
| 48 | fleetJobVesselMapping | Fleet Mapping |
| 49 | fleetSpareVesselMapping | Fleet Mapping |
| 50 | bulkImportHistory | Import |
| 51 | bulkImportErrors | Import |
| 52 | certificates | Certificates |
| 53 | surveys | Surveys |
| 54 | workOrderExecutionDetails | PMS |
| 55 | locations | Inventory |
| 56 | spareComponentLinks | Inventory |
| 57 | spareLocationStock | Inventory |
| 58 | inventoryTransactions | Inventory |
| 59 | jobComponentLinks | PMS |
| 60 | equipmentCategories | Master Data |
| 61 | defectCategories | Master Data |
| 62 | defectTypes | Master Data |
| 63 | shipCertificatesMaster | Certificates Admin |
| 64 | shipCertificatesLabelsConfig | Certificates Admin |
| 65 | vesselCertificateApplicability | Certificates Admin |
| 66 | vesselCertificateData | Certificates Admin |
| 67 | shipSurveysMaster | Surveys Admin |
| 68 | shipSurveysLabelsConfig | Surveys Admin |
| 69 | vesselSurveyApplicability | Surveys Admin |
| 70 | vesselSurveyData | Surveys Admin |
