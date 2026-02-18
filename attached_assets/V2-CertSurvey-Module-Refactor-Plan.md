# V2 Modular Architecture Plan — Certificates & Surveys Module

## Document Purpose

This is a **planning-only** document. No code changes are to be made. It maps the current (legacy) Certificates & Surveys module architecture to a proposed V2 modular RESTful architecture with a runtime toggle for backward compatibility.

**Scope**: All Certificate & Survey entities — Operational Certificates, Operational Surveys, Certificate Admin (Master Data, Labels, Vessel Applicability), Survey Admin (Master Data, Labels, Vessel Applicability), and all associated admin management operations.

**Critical Constraint**: The V2 architecture must use 100% the same business rules, validations, calculations, and workflows as legacy. This initiative is purely an architectural re-organization, not a functional rewrite.

**Companion Document**: This plan follows the exact same conventions established in `V2-Fleet-Module-Refactor-Plan.md` (Fleet Module V2) and `V2-Component-Module-Refactor-Plan.md` (Component Module V2). All plans share identical layer rules, toggle mechanism, and enforcement policies.

---

## Canonical V2 API Prefix

All V2 cert-survey endpoints use these canonical base paths:

```
/technical/api/v2/cert-survey/certificate                          ← Operational Certificates entity
/technical/api/v2/cert-survey/survey                               ← Operational Surveys entity
/technical/api/v2/cert-survey/admin/certificate-master             ← Certificate Master Data
/technical/api/v2/cert-survey/admin/certificate-labels             ← Certificate Label Configuration
/technical/api/v2/cert-survey/admin/certificate-applicability      ← Certificate Vessel Applicability
/technical/api/v2/cert-survey/admin/survey-master                  ← Survey Master Data
/technical/api/v2/cert-survey/admin/survey-labels                  ← Survey Label Configuration
/technical/api/v2/cert-survey/admin/survey-applicability           ← Survey Vessel Applicability
```

- `/technical/api/` — mandatory prefix for Nginx routing (separates PMS from Crew traffic)
- `/v2/` — V2 namespace (avoids collision with legacy routes)
- `/cert-survey/` — module name
- `/{entity}` — entity name (singular for REST convention)
- `/admin/` — admin sub-namespace for master data, labels, and applicability management

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [V2 Folder Structure](#2-v2-folder-structure)
3. [Layer Mapping: Current → V2](#3-layer-mapping-current--v2)
4. [Repository Layer Rules](#4-repository-layer-rules)
5. [Service Layer Rules](#5-service-layer-rules)
6. [Controller Layer Rules](#6-controller-layer-rules)
7. [RESTful Route Patterns](#7-restful-route-patterns)
8. [Frontend API Layer Rules](#8-frontend-api-layer-rules)
9. [Toggle Mechanism](#9-toggle-mechanism)
10. [Critical Enforcement Rules](#10-critical-enforcement-rules)
11. [Phased Migration Plan](#11-phased-migration-plan)
12. [Toggle-Based Flow Diagram](#12-toggle-based-flow-diagram)
13. [Risk Points & Rollback Strategy](#13-risk-points--rollback-strategy)
14. [Validation Checklist](#14-validation-checklist)

---

## 1. Current State Analysis

### 1.1 Backend File Sizes & Responsibility Mapping

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `server/routes.ts` | 20,231 | ALL route handlers including cert/survey routes (L13350–L15039) | Monolithic — cert/survey routes mixed with every other module |
| `server/postgresStorage.ts` | 7,111+ | ALL database queries including cert/survey storage methods | Monolithic — cert/survey queries mixed with every other query |
| `server/storage.ts` | 933 | Storage interface definition | ~18 cert/survey-specific methods in a single interface |
| `shared/schema.ts` | 2,825+ | ALL Drizzle schema definitions | All cert/survey tables defined alongside all other tables |
| `client/src/pages/cert-surveys/CertificatesPage.tsx` | 965 | Main Certificates UI page | Inline API calls via `useQuery`, no API abstraction layer |
| `client/src/pages/cert-surveys/SurveysPage.tsx` | 676 | Main Surveys UI page | Inline API calls |
| `client/src/pages/admin/ShipsCertificatesAdmin.tsx` | varies | Certificate admin management (3-tab: Master, Company, Vessel) | Inline API calls |
| `client/src/pages/admin/ShipsSurveysAdmin.tsx` | varies | Survey admin management (3-tab: Master, Company, Vessel) | Inline API calls |

### 1.2 Cert/Survey Route Inventory (Legacy)

#### 1.2.1 Operational Certificates — routes.ts (L13350–L13639)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 13350 | GET | `/technical/api/certificates` | List certificates with filtering (vesselId, vesselName, pagination, sorting) | `storage.getCertificates()` + inline Drizzle join queries |
| 13563 | GET | `/technical/api/certificates/:id` | Get certificate by ID | `storage.getCertificate(id)` |
| 13639 | PATCH | `/technical/api/certificates/:id` | Update certificate | `storage.updateCertificate(id, data)` |

#### 1.2.2 Operational Surveys — routes.ts (L13827–L14131)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 13827 | GET | `/technical/api/surveys` | List surveys with filtering | `storage.getSurveys()` |
| 14018 | GET | `/technical/api/surveys/:id` | Get survey by ID | `storage.getSurvey(id)` |
| 14033 | PATCH | `/technical/api/surveys/:id` | Update survey | `storage.updateSurvey(id, data)` |
| 14131 | POST | `/technical/api/surveys` | Create survey | `storage.createSurvey(data)` |

#### 1.2.3 Certificate Admin — Master Data — routes.ts (L14146–L14364)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14146 | GET | `/technical/api/admin/ship-certificates-master` | List certificate master records | Inline Drizzle query on `shipCertificatesMaster` |
| 14164 | POST | `/technical/api/admin/ship-certificates-master` | Create/update certificate master (upsert with sequence) | Inline Drizzle upsert on `shipCertificatesMaster` |
| 14364 | DELETE | `/technical/api/admin/ship-certificates-master/:masterId` | Delete certificate master | Inline Drizzle delete on `shipCertificatesMaster` |

#### 1.2.4 Certificate Admin — Labels — routes.ts (L14400–L14427)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14400 | GET | `/technical/api/admin/ship-certificates-labels` | Get certificate label config | Inline Drizzle query on `shipCertificatesLabelsConfig` |
| 14427 | POST | `/technical/api/admin/ship-certificates-labels` | Update certificate label config | Inline Drizzle upsert on `shipCertificatesLabelsConfig` |

#### 1.2.5 Certificate Admin — Vessel Applicability — routes.ts (L14470–L14610)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14470 | GET | `/technical/api/admin/vessel-certificate-applicability` | Get vessel certificate applicability | Inline Drizzle query on `vesselCertificateApplicability` |
| 14506 | POST | `/technical/api/admin/vessel-certificate-applicability/initialize` | Initialize applicability from master | Complex inline Drizzle logic: reads master → creates vessel records |
| 14560 | PATCH | `/technical/api/admin/vessel-certificate-applicability` | Update single applicability record | Inline Drizzle update on `vesselCertificateApplicability` |
| 14610 | POST | `/technical/api/admin/vessel-certificate-applicability/bulk-update` | Bulk update applicability | Inline Drizzle batch update |

#### 1.2.6 Survey Admin — Master Data — routes.ts (L14665–L14852)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14665 | GET | `/technical/api/admin/ship-surveys-master` | List survey master records | Inline Drizzle query on `shipSurveysMaster` |
| 14683 | POST | `/technical/api/admin/ship-surveys-master` | Create/update survey master (upsert with sequence) | Inline Drizzle upsert on `shipSurveysMaster` |
| 14852 | DELETE | `/technical/api/admin/ship-surveys-master/:masterId` | Delete survey master | Inline Drizzle delete on `shipSurveysMaster` |

#### 1.2.7 Survey Admin — Labels — routes.ts (L14879–L14906)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14879 | GET | `/technical/api/admin/ship-surveys-labels` | Get survey label config | Inline Drizzle query on `shipSurveysLabelsConfig` |
| 14906 | POST | `/technical/api/admin/ship-surveys-labels` | Update survey label config | Inline Drizzle upsert on `shipSurveysLabelsConfig` |

#### 1.2.8 Survey Admin — Vessel Applicability — routes.ts (L14951–L15039)

| Line | Method | Path | Purpose | Storage Method |
|------|--------|------|---------|----------------|
| 14951 | GET | `/technical/api/admin/vessel-survey-applicability` | Get vessel survey applicability | Inline Drizzle query on `vesselSurveyApplicability` |
| 14985 | POST | `/technical/api/admin/vessel-survey-applicability/initialize` | Initialize applicability from master | Complex inline Drizzle logic: reads master → creates vessel records |
| 15039 | POST | `/technical/api/admin/vessel-survey-applicability/bulk-update` | Bulk update applicability | Inline Drizzle batch update |

**Total Legacy Cert/Survey Routes: 24 route handlers** (all in routes.ts)

### 1.3 Storage Interface Methods (Cert/Survey-Related)

From `server/storage.ts`, the cert/survey-related interface methods (~18 methods):

**Operational Certificates:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getCertificates()` | `Certificate[]` | routes.ts L13350 |
| `getCertificate(id)` | `Certificate \| undefined` | routes.ts L13563 |
| `createCertificate(certificate)` | `Certificate` | Not directly in routes (admin flow) |
| `updateCertificate(id, data)` | `Certificate` | routes.ts L13639 |
| `deleteCertificate(id)` | `void` | Admin flow |

**Operational Surveys:**
| Method | Returns | Used By |
|--------|---------|---------|
| `getSurveys()` | `Survey[]` | routes.ts L13827 |
| `getSurvey(id)` | `Survey \| undefined` | routes.ts L14018 |
| `createSurvey(survey)` | `Survey` | routes.ts L14131 |
| `updateSurvey(id, data)` | `Survey` | routes.ts L14033 |
| `deleteSurvey(id)` | `void` | Admin flow |

**Admin Operations (via inline Drizzle — not in storage interface):**
| Operation | Table | Used By |
|-----------|-------|---------|
| List/Upsert/Delete certificate master | `shipCertificatesMaster` | routes.ts L14146–L14364 |
| Get/Update certificate labels | `shipCertificatesLabelsConfig` | routes.ts L14400–L14427 |
| Get/Initialize/Update/Bulk-update certificate applicability | `vesselCertificateApplicability` | routes.ts L14470–L14610 |
| List/Upsert/Delete survey master | `shipSurveysMaster` | routes.ts L14665–L14852 |
| Get/Update survey labels | `shipSurveysLabelsConfig` | routes.ts L14879–L14906 |
| Get/Initialize/Bulk-update survey applicability | `vesselSurveyApplicability` | routes.ts L14951–L15039 |

### 1.4 Current Schema (Cert/Survey Tables)

From `shared/schema.ts`:

**`certificates` Table (L2186):** ~35 columns
- Core: `id` (integer PK, auto-gen), certificate identification fields
- Vessel: `vesselId`, `vesselCode`, `vesselName`
- Certificate Data: `certificateName`, `certificateNumber`, `issuingAuthority`, `issueDate`, `expiryDate`, `endorsementDate`
- Status: `status`, `remarks`, `conditions`
- Audit: `createdAt`, `updatedAt`

**`surveys` Table (L2221):** ~30 columns
- Core: `id` (integer PK, auto-gen), survey identification fields
- Vessel: `vesselId`, `vesselCode`, `vesselName`
- Survey Data: `surveyName`, `surveyType`, `surveyDate`, `nextDueDate`, `surveyor`, `location`
- Status: `status`, `remarks`, `findings`
- Audit: `createdAt`, `updatedAt`

**`shipCertificatesMaster` Table (L2549):** ~20 columns
- Master certificate definitions with sequence-based ordering
- Defines the template list of certificates that can be applied to vessels
- Columns: `id`, `sequence`, `certificateName`, `category`, `issuingAuthority`, `validityPeriod`, custom label fields
- Audit: `createdAt`, `updatedAt`

**`shipCertificatesLabelsConfig` Table (L2584):** ~15 columns
- Dynamic label configuration for certificate fields per organization
- Allows customizing column headers and display names
- Columns: `id`, label field mappings (label1–label10+), `isActive`

**`vesselCertificateApplicability` Table (L2603):** ~10 columns
- Maps which master certificates apply to which vessels
- Columns: `id`, `vesselId`, `vesselCode`, `masterId`, `isApplicable`, `remarks`
- Links: References `shipCertificatesMaster`

**`vesselCertificateData` Table (L2627):** ~25 columns
- Vessel-specific certificate data populated from applicability
- Stores actual certificate instances per vessel
- Columns: `id`, `vesselId`, `masterId`, certificate-specific date fields, status fields

**`shipSurveysMaster` Table (L2662):** ~20 columns
- Master survey definitions with sequence-based ordering
- Defines the template list of surveys that can be applied to vessels
- Columns: `id`, `sequence`, `surveyName`, `category`, `surveyType`, custom label fields
- Audit: `createdAt`, `updatedAt`

**`shipSurveysLabelsConfig` Table (L2695):** ~15 columns
- Dynamic label configuration for survey fields per organization
- Allows customizing column headers and display names
- Columns: `id`, label field mappings (label1–label10+), `isActive`

**`vesselSurveyApplicability` Table (L2714):** ~10 columns
- Maps which master surveys apply to which vessels
- Columns: `id`, `vesselId`, `vesselCode`, `masterId`, `isApplicable`, `remarks`
- Links: References `shipSurveysMaster`

**`vesselSurveyData` Table (L2738):** ~25 columns
- Vessel-specific survey data populated from applicability
- Stores actual survey instances per vessel
- Columns: `id`, `vesselId`, `masterId`, survey-specific date fields, status fields

### 1.5 Key Business Logic in Route Handlers

The Certificates & Surveys module has **significant inline business logic** patterns that must be preserved exactly in V2:

**Certificate List with Applicability Join (routes.ts L13350–L13563):**
1. Joins `vesselCertificateApplicability` with `vesselCertificateData` to build the certificate list
2. Supports filtering by `vesselId`, `vesselName`
3. Supports pagination (`page`, `pageSize`) and sorting (`sortField`, `sortDirection`)
4. Complex response shape includes pagination metadata (`total`, `page`, `pageSize`, `totalPages`)

**3-Tab Admin Interface Pattern (both certificates and surveys):**
1. **Master Tab**: Manages the master list of certificate/survey definitions (`shipCertificatesMaster` / `shipSurveysMaster`)
2. **Company Tab**: Manages label configuration (`shipCertificatesLabelsConfig` / `shipSurveysLabelsConfig`)
3. **Vessel Tab**: Manages vessel-specific applicability and data (`vesselCertificateApplicability` / `vesselSurveyApplicability`)

**Applicability Initialization (routes.ts L14506, L14985):**
1. Reads all master records from `shipCertificatesMaster` (or `shipSurveysMaster`)
2. For a given vessel, creates corresponding records in `vesselCertificateApplicability` (or `vesselSurveyApplicability`)
3. Skips records that already exist (idempotent initialization)
4. Complex multi-step transaction logic

**Master Data Upsert with Sequence (routes.ts L14164, L14683):**
1. If record has existing ID → update existing master record
2. If new record → create with next available sequence number
3. Preserves ordering integrity across all master records

**Bulk Applicability Update (routes.ts L14610, L15039):**
1. Receives array of applicability records
2. Updates each record individually within a transaction-like flow
3. Must preserve atomicity — all succeed or meaningful error returned

**Inline Drizzle Query Pattern (routes.ts L14146+):**
1. Many admin routes use direct `db.select().from(table)` queries instead of storage interface methods
2. V2 must extract these to repository methods while preserving exact query behavior
3. Includes table references: `shipCertificatesMaster`, `shipCertificatesLabelsConfig`, `vesselCertificateApplicability`, `vesselCertificateData`, `shipSurveysMaster`, `shipSurveysLabelsConfig`, `vesselSurveyApplicability`, `vesselSurveyData`

---

## 2. V2 Folder Structure

```
server/v2/cert-survey/
├── index.ts                                  # Module entry point — wires dependencies, exports router
├── routes.ts                                 # Maps HTTP methods + paths → controller methods
├── errors.ts                                 # Shared error types (NotFoundError, ValidationError, etc.)
├── repositories/
│   ├── certificateRepository.ts              # DB access for certificates table
│   ├── surveyRepository.ts                   # DB access for surveys table
│   ├── certificateMasterRepository.ts        # DB access for shipCertificatesMaster table
│   ├── surveyMasterRepository.ts             # DB access for shipSurveysMaster table
│   ├── certificateApplicabilityRepository.ts # DB access for vesselCertificateApplicability + vesselCertificateData
│   └── surveyApplicabilityRepository.ts      # DB access for vesselSurveyApplicability + vesselSurveyData
├── services/
│   ├── certificateService.ts                 # Business logic for operational certificates
│   ├── surveyService.ts                      # Business logic for operational surveys
│   ├── certificateAdminService.ts            # Business logic for certificate admin (master, labels, applicability)
│   └── surveyAdminService.ts                 # Business logic for survey admin (master, labels, applicability)
├── controllers/
│   ├── certificateController.ts              # HTTP layer for operational certificates
│   ├── surveyController.ts                   # HTTP layer for operational surveys
│   ├── certificateAdminController.ts         # HTTP layer for certificate admin
│   └── surveyAdminController.ts              # HTTP layer for survey admin
└── types.ts                                  # Shared types, request/response interfaces

shared/v2/cert-survey/
├── schema.ts                                 # Re-exports relevant tables from shared/schema.ts
└── types.ts                                  # Shared frontend/backend types

client/src/modules/cert-survey/
├── api/
│   ├── certificateApi.ts                     # Toggle-aware API calls for operational certificates
│   ├── surveyApi.ts                          # Toggle-aware API calls for operational surveys
│   ├── certificateAdminApi.ts                # Toggle-aware API calls for certificate admin
│   └── surveyAdminApi.ts                     # Toggle-aware API calls for survey admin
└── hooks/
    └── useCertSurveyApi.ts                   # React hooks wrapping API calls with TanStack Query
```

---

## 3. Layer Mapping: Current → V2

### 3.1 Operational Certificates

| Current Location | Current Pattern | V2 Target | V2 Layer |
|------------------|----------------|-----------|----------|
| routes.ts L13350 | `storage.getCertificates()` + inline Drizzle join | `certificateRepository.getAll(filters)` | Repository |
| routes.ts L13350 | Pagination/sorting logic | `certificateService.list(filters)` | Service |
| routes.ts L13350 | `req.query` extraction, response mapping | `certificateController.getAll(req, res)` | Controller |
| routes.ts L13563 | `storage.getCertificate(id)` | `certificateRepository.getById(id)` | Repository |
| routes.ts L13639 | `storage.updateCertificate(id, data)` | `certificateRepository.update(id, data)` | Repository |

### 3.2 Operational Surveys

| Current Location | Current Pattern | V2 Target | V2 Layer |
|------------------|----------------|-----------|----------|
| routes.ts L13827 | `storage.getSurveys()` | `surveyRepository.getAll(filters)` | Repository |
| routes.ts L14018 | `storage.getSurvey(id)` | `surveyRepository.getById(id)` | Repository |
| routes.ts L14033 | `storage.updateSurvey(id, data)` | `surveyRepository.update(id, data)` | Repository |
| routes.ts L14131 | `storage.createSurvey(data)` | `surveyRepository.create(data)` | Repository |

### 3.3 Certificate Admin

| Current Location | Current Pattern | V2 Target | V2 Layer |
|------------------|----------------|-----------|----------|
| routes.ts L14146 | Inline `db.select().from(shipCertificatesMaster)` | `certificateMasterRepository.getAll()` | Repository |
| routes.ts L14164 | Inline Drizzle upsert | `certificateMasterRepository.upsert(data)` | Repository |
| routes.ts L14364 | Inline Drizzle delete | `certificateMasterRepository.delete(id)` | Repository |
| routes.ts L14400 | Inline `db.select().from(shipCertificatesLabelsConfig)` | `certificateMasterRepository.getLabels()` | Repository |
| routes.ts L14427 | Inline Drizzle upsert | `certificateMasterRepository.updateLabels(data)` | Repository |
| routes.ts L14470 | Inline `db.select().from(vesselCertificateApplicability)` | `certificateApplicabilityRepository.getAll(filters)` | Repository |
| routes.ts L14506 | Complex initialization logic | `certificateAdminService.initializeApplicability(vesselId)` | Service |
| routes.ts L14560 | Inline Drizzle update | `certificateApplicabilityRepository.update(id, data)` | Repository |
| routes.ts L14610 | Inline Drizzle batch update | `certificateApplicabilityRepository.bulkUpdate(records)` | Repository |

### 3.4 Survey Admin

| Current Location | Current Pattern | V2 Target | V2 Layer |
|------------------|----------------|-----------|----------|
| routes.ts L14665 | Inline `db.select().from(shipSurveysMaster)` | `surveyMasterRepository.getAll()` | Repository |
| routes.ts L14683 | Inline Drizzle upsert | `surveyMasterRepository.upsert(data)` | Repository |
| routes.ts L14852 | Inline Drizzle delete | `surveyMasterRepository.delete(id)` | Repository |
| routes.ts L14879 | Inline `db.select().from(shipSurveysLabelsConfig)` | `surveyMasterRepository.getLabels()` | Repository |
| routes.ts L14906 | Inline Drizzle upsert | `surveyMasterRepository.updateLabels(data)` | Repository |
| routes.ts L14951 | Inline `db.select().from(vesselSurveyApplicability)` | `surveyApplicabilityRepository.getAll(filters)` | Repository |
| routes.ts L14985 | Complex initialization logic | `surveyAdminService.initializeApplicability(vesselId)` | Service |
| routes.ts L15039 | Inline Drizzle batch update | `surveyApplicabilityRepository.bulkUpdate(records)` | Repository |

---

## 4. Repository Layer Rules

### 4.1 Rules

| Rule | Detail |
|------|--------|
| **One repository per table (or table group)** | e.g., `certificateRepository.ts` for `certificates` table |
| **DB access only** | Only layer that imports `storage` or uses direct Drizzle queries |
| **No business logic** | No validation, no conditional branching based on business rules |
| **Returns domain types** | Returns `Certificate`, `Survey`, etc. — never raw DB rows |
| **Inline Drizzle extraction** | All inline `db.select().from(table)` in routes.ts must be extracted to repository methods |

### 4.2 Repository Pattern

```typescript
// server/v2/cert-survey/repositories/certificateRepository.ts

import { storage } from "../../../storage";

export class CertificateRepository {
  async getAll(filters?: { vesselId?: string }): Promise<Certificate[]> {
    return storage.getCertificates();
  }

  async getById(id: string): Promise<Certificate | undefined> {
    return storage.getCertificate(id);
  }

  async update(id: string, data: Partial<Certificate>): Promise<Certificate> {
    return storage.updateCertificate(id, data);
  }
}
```

```typescript
// server/v2/cert-survey/repositories/certificateMasterRepository.ts

import { getDb } from "../../../db";
import { shipCertificatesMaster, shipCertificatesLabelsConfig } from "@shared/schema";

export class CertificateMasterRepository {
  async getAll(): Promise<ShipCertificateMaster[]> {
    const db = getDb();
    return db.select().from(shipCertificatesMaster).orderBy(asc(shipCertificatesMaster.sequence));
  }

  async upsert(data: any): Promise<ShipCertificateMaster> {
    // Extract exact upsert logic from routes.ts L14164
  }

  async delete(id: number): Promise<void> {
    // Extract exact delete logic from routes.ts L14364
  }

  async getLabels(): Promise<ShipCertificatesLabelsConfig[]> {
    const db = getDb();
    return db.select().from(shipCertificatesLabelsConfig);
  }

  async updateLabels(data: any): Promise<ShipCertificatesLabelsConfig> {
    // Extract exact upsert logic from routes.ts L14427
  }
}
```

### 4.3 Inline Drizzle Extraction Mapping

| Legacy Location | Inline Query | V2 Repository Method |
|-----------------|--------------|---------------------|
| L14146 | `db.select().from(shipCertificatesMaster)` | `certificateMasterRepository.getAll()` |
| L14164 | Drizzle upsert on `shipCertificatesMaster` | `certificateMasterRepository.upsert(data)` |
| L14364 | Drizzle delete on `shipCertificatesMaster` | `certificateMasterRepository.delete(id)` |
| L14400 | `db.select().from(shipCertificatesLabelsConfig)` | `certificateMasterRepository.getLabels()` |
| L14427 | Drizzle upsert on `shipCertificatesLabelsConfig` | `certificateMasterRepository.updateLabels(data)` |
| L14470 | `db.select().from(vesselCertificateApplicability)` | `certificateApplicabilityRepository.getAll(filters)` |
| L14506 | Complex multi-step initialization | `certificateApplicabilityRepository.initialize(vesselId, masters)` |
| L14560 | Drizzle update on `vesselCertificateApplicability` | `certificateApplicabilityRepository.update(id, data)` |
| L14610 | Drizzle batch update | `certificateApplicabilityRepository.bulkUpdate(records)` |
| L14665 | `db.select().from(shipSurveysMaster)` | `surveyMasterRepository.getAll()` |
| L14683 | Drizzle upsert on `shipSurveysMaster` | `surveyMasterRepository.upsert(data)` |
| L14852 | Drizzle delete on `shipSurveysMaster` | `surveyMasterRepository.delete(id)` |
| L14879 | `db.select().from(shipSurveysLabelsConfig)` | `surveyMasterRepository.getLabels()` |
| L14906 | Drizzle upsert on `shipSurveysLabelsConfig` | `surveyMasterRepository.updateLabels(data)` |
| L14951 | `db.select().from(vesselSurveyApplicability)` | `surveyApplicabilityRepository.getAll(filters)` |
| L14985 | Complex multi-step initialization | `surveyApplicabilityRepository.initialize(vesselId, masters)` |
| L15039 | Drizzle batch update | `surveyApplicabilityRepository.bulkUpdate(records)` |

---

## 5. Service Layer Rules

### 5.1 Rules

| Rule | Detail |
|------|--------|
| **Business logic only** | Validation, transformation, orchestration |
| **No HTTP objects** | Never imports `req`, `res`, `next` |
| **No storage import** | Receives repository instances via constructor injection |
| **Throws typed errors** | `NotFoundError`, `ValidationError` — controller maps to status codes |
| **Identical logic to legacy** | Must copy exact business rules from route handlers |

### 5.2 Service Pattern

```typescript
// server/v2/cert-survey/services/certificateService.ts

export class CertificateService {
  constructor(
    private certificateRepo: CertificateRepository,
    private applicabilityRepo: CertificateApplicabilityRepository
  ) {}

  async list(filters: CertificateListFilters): Promise<PaginatedResult<Certificate>> {
    // Exact same pagination/sorting/filtering logic as routes.ts L13350
    const certificates = await this.certificateRepo.getAll(filters);
    // Apply pagination, sorting — same response shape
    return { data: certificates, total, page, pageSize, totalPages };
  }

  async getById(id: string): Promise<Certificate> {
    const cert = await this.certificateRepo.getById(id);
    if (!cert) throw new NotFoundError('Certificate', id);
    return cert;
  }

  async update(id: string, data: Partial<Certificate>): Promise<Certificate> {
    const existing = await this.certificateRepo.getById(id);
    if (!existing) throw new NotFoundError('Certificate', id);
    return this.certificateRepo.update(id, data);
  }
}
```

```typescript
// server/v2/cert-survey/services/certificateAdminService.ts

export class CertificateAdminService {
  constructor(
    private masterRepo: CertificateMasterRepository,
    private applicabilityRepo: CertificateApplicabilityRepository
  ) {}

  async listMasters(): Promise<ShipCertificateMaster[]> {
    return this.masterRepo.getAll();
  }

  async upsertMaster(data: any): Promise<ShipCertificateMaster> {
    // Exact same upsert-with-sequence logic as routes.ts L14164
    return this.masterRepo.upsert(data);
  }

  async deleteMaster(id: number): Promise<void> {
    return this.masterRepo.delete(id);
  }

  async initializeApplicability(vesselId: string): Promise<any> {
    // Exact same initialization logic as routes.ts L14506
    // 1. Read all master records
    // 2. For given vessel, create corresponding applicability records
    // 3. Skip existing records (idempotent)
    const masters = await this.masterRepo.getAll();
    return this.applicabilityRepo.initialize(vesselId, masters);
  }

  async bulkUpdateApplicability(records: any[]): Promise<any> {
    // Exact same bulk update logic as routes.ts L14610
    return this.applicabilityRepo.bulkUpdate(records);
  }
}
```

---

## 6. Controller Layer Rules

### 6.1 Rules

| Rule | Detail |
|------|--------|
| **HTTP layer only** | Extracts data from `req`, calls service, sends `res` |
| **No business logic** | No validation beyond basic request parsing |
| **Error mapping** | Catches service errors → maps to HTTP status codes |
| **Response shape preservation** | Must return identical JSON shapes as legacy routes |

### 6.2 Controller Pattern

```typescript
// server/v2/cert-survey/controllers/certificateController.ts

export class CertificateController {
  constructor(private service: CertificateService) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const filters = {
        vesselId: req.query.vesselId as string,
        vesselName: req.query.vesselName as string,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
        sortField: req.query.sortField as string,
        sortDirection: req.query.sortDirection as string,
      };
      const result = await this.service.list(filters);
      res.json(result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const cert = await this.service.getById(req.params.id);
      res.json(cert);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const cert = await this.service.update(req.params.id, req.body);
      res.json(cert);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Cert/Survey V2 error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

---

## 7. RESTful Route Patterns

### 7.1 Operational Certificates

```
GET    /technical/api/v2/cert-survey/certificate            ← List (paginated, filtered)
GET    /technical/api/v2/cert-survey/certificate/:id         ← Get by ID
PATCH  /technical/api/v2/cert-survey/certificate/:id         ← Update
```

### 7.2 Operational Surveys

```
GET    /technical/api/v2/cert-survey/survey                 ← List (paginated, filtered)
GET    /technical/api/v2/cert-survey/survey/:id              ← Get by ID
PATCH  /technical/api/v2/cert-survey/survey/:id              ← Update
POST   /technical/api/v2/cert-survey/survey                 ← Create
```

### 7.3 Certificate Admin — Master Data

```
GET    /technical/api/v2/cert-survey/admin/certificate-master           ← List master records
POST   /technical/api/v2/cert-survey/admin/certificate-master           ← Upsert master record
DELETE /technical/api/v2/cert-survey/admin/certificate-master/:id       ← Delete master record
```

### 7.4 Certificate Admin — Labels

```
GET    /technical/api/v2/cert-survey/admin/certificate-labels           ← Get label config
POST   /technical/api/v2/cert-survey/admin/certificate-labels           ← Update label config
```

### 7.5 Certificate Admin — Applicability

```
GET    /technical/api/v2/cert-survey/admin/certificate-applicability           ← Get applicability
POST   /technical/api/v2/cert-survey/admin/certificate-applicability/initialize ← Initialize from master
PATCH  /technical/api/v2/cert-survey/admin/certificate-applicability           ← Update single
POST   /technical/api/v2/cert-survey/admin/certificate-applicability/bulk-update ← Bulk update
```

### 7.6 Survey Admin — Master Data

```
GET    /technical/api/v2/cert-survey/admin/survey-master           ← List master records
POST   /technical/api/v2/cert-survey/admin/survey-master           ← Upsert master record
DELETE /technical/api/v2/cert-survey/admin/survey-master/:id       ← Delete master record
```

### 7.7 Survey Admin — Labels

```
GET    /technical/api/v2/cert-survey/admin/survey-labels           ← Get label config
POST   /technical/api/v2/cert-survey/admin/survey-labels           ← Update label config
```

### 7.8 Survey Admin — Applicability

```
GET    /technical/api/v2/cert-survey/admin/survey-applicability           ← Get applicability
POST   /technical/api/v2/cert-survey/admin/survey-applicability/initialize ← Initialize from master
POST   /technical/api/v2/cert-survey/admin/survey-applicability/bulk-update ← Bulk update
```

### 7.9 Route Response Contract Rule

**All V2 routes must return identical JSON shapes as legacy routes.** The same status codes, same error messages, same response structures.

### 7.10 Route Registration

```typescript
// server/v2/cert-survey/index.ts — Module entry point
export function createCertSurveyV2Router(): Router {
  // Wire up all dependencies (repositories → services → controllers)
  // Return combined router
}

// Registration in main app (additive only):
// app.use('/technical/api/v2/cert-survey', certSurveyV2Router);
```

---

## 8. Frontend API Layer Rules

### 8.1 Rules

| Rule | Detail |
|------|--------|
| **One API file per entity group** | e.g., `certificateApi.ts`, `certificateAdminApi.ts` |
| **Toggle decides Legacy vs V2** | `getCertSurveyApiBase()` reads `localStorage('cert_survey_api_version')` |
| **No direct fetch calls in components** | Components consume hooks, hooks consume API file |
| **UI behavior must remain unchanged** | Same data shapes, same loading states, same error handling |

### 8.2 API File Pattern

```typescript
// client/src/modules/cert-survey/api/certificateApi.ts

const getMode = () => localStorage.getItem('cert_survey_api_version') || 'legacy';

export const certificateApi = {
  getAll: (filters?: any) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/cert-survey/certificate'
      : '/technical/api/certificates';
    return fetch(url + buildQueryString(filters)).then(r => r.json());
  },
  getById: (id: string) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/cert-survey/certificate/${id}`
      : `/technical/api/certificates/${id}`;
    return fetch(url).then(r => r.json());
  },
  update: (id: string, data: any) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/cert-survey/certificate/${id}`
      : `/technical/api/certificates/${id}`;
    return fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },
};
```

```typescript
// client/src/modules/cert-survey/api/certificateAdminApi.ts

const getMode = () => localStorage.getItem('cert_survey_api_version') || 'legacy';

export const certificateAdminApi = {
  getMasters: () => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/cert-survey/admin/certificate-master'
      : '/technical/api/admin/ship-certificates-master';
    return fetch(url).then(r => r.json());
  },
  upsertMaster: (data: any) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/cert-survey/admin/certificate-master'
      : '/technical/api/admin/ship-certificates-master';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },
  deleteMaster: (id: number) => {
    const url = getMode() === 'v2'
      ? `/technical/api/v2/cert-survey/admin/certificate-master/${id}`
      : `/technical/api/admin/ship-certificates-master/${id}`;
    return fetch(url, { method: 'DELETE' }).then(r => r.json());
  },
  getLabels: () => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/cert-survey/admin/certificate-labels'
      : '/technical/api/admin/ship-certificates-labels';
    return fetch(url).then(r => r.json());
  },
  updateLabels: (data: any) => {
    const url = getMode() === 'v2'
      ? '/technical/api/v2/cert-survey/admin/certificate-labels'
      : '/technical/api/admin/ship-certificates-labels';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
  },
  // ... same pattern for applicability endpoints
};
```

### 8.3 Toggle Key

**Storage:** `localStorage` key: `cert_survey_api_version` with values `'v2'` or `'legacy'` (default: `'legacy'`).

This is a **separate toggle** from the Component module toggle (`pms_api_version`) and Fleet module toggle (`fleet_api_version`), allowing independent rollout.

---

## 9. Toggle Mechanism

### 9.1 How Legacy and V2 Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                     Express Server                       │
│                                                          │
│  Legacy Routes (always registered):                      │
│    /technical/api/certificates/*                          │
│    /technical/api/surveys/*                                │
│    /technical/api/admin/ship-certificates-master/*         │
│    /technical/api/admin/ship-certificates-labels/*         │
│    /technical/api/admin/vessel-certificate-applicability/* │
│    /technical/api/admin/ship-surveys-master/*              │
│    /technical/api/admin/ship-surveys-labels/*              │
│    /technical/api/admin/vessel-survey-applicability/*      │
│                                                          │
│  V2 Routes (always registered, additive):                │
│    /technical/api/v2/cert-survey/certificate/*             │
│    /technical/api/v2/cert-survey/survey/*                  │
│    /technical/api/v2/cert-survey/admin/certificate-master/*│
│    /technical/api/v2/cert-survey/admin/certificate-labels/*│
│    /technical/api/v2/cert-survey/admin/certificate-applicability/*│
│    /technical/api/v2/cert-survey/admin/survey-master/*     │
│    /technical/api/v2/cert-survey/admin/survey-labels/*     │
│    /technical/api/v2/cert-survey/admin/survey-applicability/*│
│                                                          │
│  BOTH route sets call the SAME storage methods / tables: │
│    storage.getCertificates()                              │
│    storage.getSurveys()                                   │
│    db.select().from(shipCertificatesMaster)                │
│    etc.                                                   │
│                                                          │
│  ONE set of database tables:                              │
│    certificates, surveys,                                 │
│    ship_certificates_master, ship_certificates_labels_config,│
│    vessel_certificate_applicability, vessel_certificate_data,│
│    ship_surveys_master, ship_surveys_labels_config,        │
│    vessel_survey_applicability, vessel_survey_data          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Instant Rollback

**Zero data loss**: Both V2 and legacy operate on the same tables. Switching modes is purely a URL routing change. No data migration, no data divergence.

---

## 10. Critical Enforcement Rules

### 10.1 Architecture Enforcement

| Rule | Detail |
|------|--------|
| **No functional or logical changes** | V2 must produce identical outputs for identical inputs as legacy |
| **No data model behavior change** | Same tables, same columns, same constraints |
| **No legacy code modification** | All V2 code in new files under `server/v2/cert-survey/`, `shared/v2/cert-survey/`, `client/src/modules/cert-survey/` |
| **No cross-module coupling** | Cert/Survey V2 must not import from Component V2, Fleet V2, or other modules |
| **Inline Drizzle consolidation** | V2 must extract all inline Drizzle queries from routes.ts to proper repository methods |

### 10.2 Layer Boundary Enforcement

| Rule | Layer |
|------|-------|
| **Repository: DB only** | Only layer that imports `storage` or uses Drizzle queries. No business logic. |
| **Service: logic only** | No HTTP objects. No `storage` import. |
| **Controller: HTTP only** | Extracts req data, calls service, maps errors to status codes. |
| **Routes: wiring only** | Maps HTTP methods + paths to controller methods. |

---

## 11. Phased Migration Plan

### Phase 1 — Operational Certificate & Survey CRUD (Backend Only) — 7 routes

**Goal:** Create V2 folder structure, repositories, services, and controllers for operational certificate and survey entities.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 1.1 | Create `server/v2/cert-survey/` directory structure | New directories | None |
| 1.2 | Create `shared/v2/cert-survey/schema.ts` + `types.ts` | New files | None |
| 1.3 | Create `errors.ts` (shared error types) | New file | None |
| 1.4 | Implement certificate repository | `certificateRepository.ts` | None |
| 1.5 | Implement certificate service | `certificateService.ts` | None |
| 1.6 | Implement certificate controller | `certificateController.ts` | None |
| 1.7 | Implement survey repository | `surveyRepository.ts` | None |
| 1.8 | Implement survey service | `surveyService.ts` | None |
| 1.9 | Implement survey controller | `surveyController.ts` | None |
| 1.10 | Create `routes.ts` with operational certificate + survey routes | New file | None |
| 1.11 | Create `index.ts` module entry point | New file | None |
| 1.12 | Register V2 cert-survey routes in Express app | Additive to server startup | Low — additive only |

**Validation:**
- [ ] GET /certificate — V2 returns identical paginated list as legacy GET /certificates
- [ ] GET /certificate/:id — V2 returns identical object as legacy GET /certificates/:id
- [ ] PATCH /certificate/:id — V2 updates identically, returns same shape
- [ ] GET /survey — V2 returns identical list as legacy GET /surveys
- [ ] GET /survey/:id — V2 returns identical object as legacy GET /surveys/:id
- [ ] PATCH /survey/:id — V2 updates identically, returns same shape
- [ ] POST /survey — V2 creates identical record as legacy POST /surveys
- [ ] Pagination/sorting produces identical results for certificates
- [ ] Legacy routes remain completely unaffected

### Phase 2 — Certificate Admin (Master + Labels + Applicability) — 9 routes

**Goal:** Add V2 routes for certificate master data, label configuration, and vessel applicability management.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 2.1 | Implement certificate master repository (extract inline Drizzle) | `certificateMasterRepository.ts` | None |
| 2.2 | Implement certificate applicability repository (extract inline Drizzle) | `certificateApplicabilityRepository.ts` | None |
| 2.3 | Implement certificate admin service | `certificateAdminService.ts` | None |
| 2.4 | Implement certificate admin controller | `certificateAdminController.ts` | None |
| 2.5 | Register certificate admin routes | `routes.ts` update | None |

**Validation:**
- [ ] GET /admin/certificate-master — identical to legacy GET /admin/ship-certificates-master
- [ ] POST /admin/certificate-master — upsert produces identical result with sequence
- [ ] DELETE /admin/certificate-master/:id — identical deletion behavior
- [ ] GET /admin/certificate-labels — identical label config response
- [ ] POST /admin/certificate-labels — identical label update behavior
- [ ] GET /admin/certificate-applicability — identical applicability list
- [ ] POST /admin/certificate-applicability/initialize — initialization creates identical records
- [ ] PATCH /admin/certificate-applicability — single update works identically
- [ ] POST /admin/certificate-applicability/bulk-update — bulk update works identically
- [ ] Response shapes match legacy exactly for all endpoints
- [ ] Legacy routes remain completely unaffected

### Phase 3 — Survey Admin (Master + Labels + Applicability) — 8 routes

**Goal:** Add V2 routes for survey master data, label configuration, and vessel applicability management.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 3.1 | Implement survey master repository (extract inline Drizzle) | `surveyMasterRepository.ts` | None |
| 3.2 | Implement survey applicability repository (extract inline Drizzle) | `surveyApplicabilityRepository.ts` | None |
| 3.3 | Implement survey admin service | `surveyAdminService.ts` | None |
| 3.4 | Implement survey admin controller | `surveyAdminController.ts` | None |
| 3.5 | Register survey admin routes | `routes.ts` update | None |

**Validation:**
- [ ] GET /admin/survey-master — identical to legacy GET /admin/ship-surveys-master
- [ ] POST /admin/survey-master — upsert produces identical result with sequence
- [ ] DELETE /admin/survey-master/:id — identical deletion behavior
- [ ] GET /admin/survey-labels — identical label config response
- [ ] POST /admin/survey-labels — identical label update behavior
- [ ] GET /admin/survey-applicability — identical applicability list
- [ ] POST /admin/survey-applicability/initialize — initialization creates identical records
- [ ] POST /admin/survey-applicability/bulk-update — bulk update works identically
- [ ] Response shapes match legacy exactly for all endpoints
- [ ] Legacy routes remain completely unaffected

### Phase 4 — Frontend Integration & Toggle — 4 pages

**Goal:** Create frontend API abstraction, hooks, and toggle for all cert/survey pages.

| Step | Task | Files | Legacy Impact |
|------|------|-------|---------------|
| 4.1 | Create all API files (`certificateApi.ts`, `surveyApi.ts`, `certificateAdminApi.ts`, `surveyAdminApi.ts`) | New files | None |
| 4.2 | Create `useCertSurveyApi.ts` hook file | New file | None |
| 4.3 | Create `CertSurveyApiToggle.tsx` toggle UI | New file | None |
| 4.4 | Add toggle to Certificates page header | `CertificatesPage.tsx` — minimal change | Low |
| 4.5 | Add toggle to Surveys page header | `SurveysPage.tsx` — minimal change | Low |
| 4.6 | Replace inline API calls with V2 hooks (toggle-aware) in CertificatesPage | `CertificatesPage.tsx` | Medium |
| 4.7 | Replace inline API calls with V2 hooks (toggle-aware) in SurveysPage | `SurveysPage.tsx` | Medium |
| 4.8 | Replace inline API calls in ShipsCertificatesAdmin | `ShipsCertificatesAdmin.tsx` | Medium |
| 4.9 | Replace inline API calls in ShipsSurveysAdmin | `ShipsSurveysAdmin.tsx` | Medium |
| 4.10 | Test toggle switching between legacy and V2 | Manual test | None |

**Validation:**
- [ ] Toggle defaults to "Legacy" mode
- [ ] Switching to V2 mode: all certificate data loads correctly
- [ ] Switching to V2 mode: all survey data loads correctly
- [ ] Switching back to Legacy mode: all data loads correctly
- [ ] No visual differences between modes
- [ ] CertificatesPage works in both modes (list, filter, paginate, sort, update)
- [ ] SurveysPage works in both modes (list, filter, create, update)
- [ ] ShipsCertificatesAdmin works in both modes (master, labels, applicability tabs)
- [ ] ShipsSurveysAdmin works in both modes (master, labels, applicability tabs)
- [ ] Toggle switch causes no data loss

---

## 12. Toggle-Based Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │ Cert/Survey      │  localStorage: 'cert_survey_api_version'   │
│  │ Toggle           │  = 'v2' | 'legacy'                        │
│  └───────┬──────────┘                                            │
│          │                                                       │
│          ▼                                                       │
│  ┌──────────────────────┐                                        │
│  │ certificateApi       │  getMode() reads toggle                │
│  │ surveyApi            │                                        │
│  │ certificateAdminApi  │                                        │
│  │ surveyAdminApi       │                                        │
│  └──────┬───────────────┘                                        │
│         │                                                        │
│    ┌────┴────┐                                                   │
│    │         │                                                   │
│    ▼         ▼                                                   │
│  Legacy    V2 URLs                                               │
│  URLs      /technical/api/v2/cert-survey/*                       │
│  /technical/api/certificates/*                                   │
│  /technical/api/surveys/*                                        │
│  /technical/api/admin/ship-certificates-*                         │
│  /technical/api/admin/ship-surveys-*                              │
│  /technical/api/admin/vessel-certificate-*                        │
│  /technical/api/admin/vessel-survey-*                             │
└────┬─────────┬───────────────────────────────────────────────────┘
     │         │
     ▼         ▼
┌────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  Legacy Handlers           V2 Handlers                           │
│  (routes.ts                (v2/cert-survey/routes.ts)            │
│   L13350–L15039)           Controller → Service → Repository    │
│  inline Drizzle queries            │                            │
│         │                           │                            │
│         └───────────┬───────────────┘                            │
│                     ▼                                            │
│           ┌─────────────────┐                                    │
│           │ storage.*()     │  SAME storage methods              │
│           │ + direct Drizzle│  SAME database tables              │
│           │ queries         │  SAME data                         │
│           └────────┬────────┘                                    │
│                    ▼                                             │
│           ┌────────────────┐                                     │
│           │  PostgreSQL    │                                     │
│           │  cert/survey   │  ← 10 tables, shared by both       │
│           │  tables        │                                     │
│           └────────────────┘                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Risk Points & Rollback Strategy

### 13.1 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Inline Drizzle queries not in storage interface | Medium | Extract to repositories, validate query outputs match exactly |
| Applicability initialization has complex multi-step logic | Medium | Line-by-line logic copy from routes.ts, test with real vessel data |
| Bulk applicability update atomicity | Medium | Preserve exact transaction behavior from legacy |
| Pagination/sorting response shape for certificates | Low | Verify identical JSON structures (total, page, pageSize, totalPages) |
| Certificate list join query with applicability tables | Medium | Extract join query to repository, compare output row-by-row |
| Sequence-based ordering for master upsert | Low | Copy exact sequence assignment logic |
| Label config upsert behavior | Low | Verify idempotent behavior matches legacy |

### 13.2 Rollback Strategy

| Scenario | Action |
|----------|--------|
| V2 returns incorrect data | User clicks toggle → "Legacy" → instant fallback |
| V2 has performance issues | Toggle to Legacy → no restart needed |
| V2 causes data corruption | Not possible — same storage methods, same tables |
| Need to remove V2 entirely | Delete V2 files, remove route registration — zero impact on legacy |

---

## 14. Validation Checklist

### 14.1 Per-Entity Validation

For **each** cert/survey entity (Certificates, Surveys):
- [ ] GET all → V2 returns identical array/paginated result as legacy
- [ ] GET by ID → V2 returns identical object as legacy
- [ ] POST create → V2 creates identical record (surveys only), returns correct status
- [ ] PATCH update → V2 updates identically, returns same shape
- [ ] Error cases → V2 returns same status codes and error messages

### 14.2 Certificate-Specific Validation

- [ ] Certificate list pagination: same `total`, `page`, `pageSize`, `totalPages` values
- [ ] Certificate list sorting: same order for each sort field
- [ ] Certificate list filtering by vesselId: identical filtered results
- [ ] Certificate list filtering by vesselName: identical filtered results
- [ ] Certificate list join with applicability tables: identical data shape

### 14.3 Survey-Specific Validation

- [ ] Survey list filtering: identical filtered results
- [ ] Survey creation: identical record created with all fields
- [ ] Survey update: identical update behavior

### 14.4 Certificate Admin Validation

- [ ] Master data list: identical records with sequence ordering
- [ ] Master data upsert (new): correct sequence assignment
- [ ] Master data upsert (existing): correct update behavior
- [ ] Master data delete: identical deletion behavior
- [ ] Label config get: identical config response
- [ ] Label config update: identical upsert behavior
- [ ] Applicability get: identical list response
- [ ] Applicability initialize: identical record creation (idempotent)
- [ ] Applicability single update: identical update behavior
- [ ] Applicability bulk update: identical batch behavior

### 14.5 Survey Admin Validation

- [ ] Master data list: identical records with sequence ordering
- [ ] Master data upsert (new): correct sequence assignment
- [ ] Master data upsert (existing): correct update behavior
- [ ] Master data delete: identical deletion behavior
- [ ] Label config get: identical config response
- [ ] Label config update: identical upsert behavior
- [ ] Applicability get: identical list response
- [ ] Applicability initialize: identical record creation (idempotent)
- [ ] Applicability bulk update: identical batch behavior

### 14.6 Frontend Validation

- [ ] Toggle defaults to Legacy
- [ ] All pages work in Legacy mode (unchanged)
- [ ] All pages work in V2 mode (identical behavior)
- [ ] Toggle switch causes no data loss
- [ ] No visual differences between modes
- [ ] CertificatesPage: list, filter, paginate, sort, update all work in both modes
- [ ] SurveysPage: list, filter, create, update all work in both modes
- [ ] ShipsCertificatesAdmin: master tab, labels tab, applicability tab all work in both modes
- [ ] ShipsSurveysAdmin: master tab, labels tab, applicability tab all work in both modes

---

## Appendix A: Inline Drizzle Query Extraction Plan

**Current Problem:** Many certificate and survey admin routes use direct Drizzle queries (`db.select().from(table)`) instead of the storage interface. This makes them harder to test and creates inconsistent data access patterns.

| Legacy Route | Drizzle Table | V2 Repository Method |
|-------------|---------------|---------------------|
| L14146 GET master | `shipCertificatesMaster` | `certificateMasterRepository.getAll()` |
| L14164 POST master | `shipCertificatesMaster` | `certificateMasterRepository.upsert(data)` |
| L14364 DELETE master | `shipCertificatesMaster` | `certificateMasterRepository.delete(id)` |
| L14400 GET labels | `shipCertificatesLabelsConfig` | `certificateMasterRepository.getLabels()` |
| L14427 POST labels | `shipCertificatesLabelsConfig` | `certificateMasterRepository.updateLabels(data)` |
| L14470 GET applicability | `vesselCertificateApplicability` | `certificateApplicabilityRepository.getAll(filters)` |
| L14506 POST initialize | `vesselCertificateApplicability` + `shipCertificatesMaster` | `certificateApplicabilityRepository.initialize(vesselId, masters)` |
| L14560 PATCH applicability | `vesselCertificateApplicability` | `certificateApplicabilityRepository.update(id, data)` |
| L14610 POST bulk-update | `vesselCertificateApplicability` | `certificateApplicabilityRepository.bulkUpdate(records)` |
| L14665 GET master | `shipSurveysMaster` | `surveyMasterRepository.getAll()` |
| L14683 POST master | `shipSurveysMaster` | `surveyMasterRepository.upsert(data)` |
| L14852 DELETE master | `shipSurveysMaster` | `surveyMasterRepository.delete(id)` |
| L14879 GET labels | `shipSurveysLabelsConfig` | `surveyMasterRepository.getLabels()` |
| L14906 POST labels | `shipSurveysLabelsConfig` | `surveyMasterRepository.updateLabels(data)` |
| L14951 GET applicability | `vesselSurveyApplicability` | `surveyApplicabilityRepository.getAll(filters)` |
| L14985 POST initialize | `vesselSurveyApplicability` + `shipSurveysMaster` | `surveyApplicabilityRepository.initialize(vesselId, masters)` |
| L15039 POST bulk-update | `vesselSurveyApplicability` | `surveyApplicabilityRepository.bulkUpdate(records)` |

**V2 Resolution:** All inline Drizzle queries are extracted into dedicated repository methods. The repository layer becomes the single source of truth for database access, while legacy routes continue to use inline queries unchanged.

---

## Appendix B: Comparison with Fleet Module V2 Plan

| Aspect | Fleet V2 | Cert/Survey V2 |
|--------|----------|----------------|
| Toggle key | `fleet_api_version` | `cert_survey_api_version` |
| Inline business logic complexity | Medium (field sanitization, auto-code, delete guards) | Medium (pagination/join, applicability initialization, bulk updates) |
| Number of entities | 12+ entities | 8 entity groups (2 operational + 6 admin) |
| Route handlers (legacy) | 78 | 24 |
| Storage methods | ~50+ | ~18 (plus inline Drizzle queries) |
| Frontend pages affected | 11+ fleet admin pages | 4 pages (CertificatesPage, SurveysPage, ShipsCertificatesAdmin, ShipsSurveysAdmin) |
| Sub-router | `fleetAdmin.ts` (1,155 lines) | None (all in routes.ts) |
| Excel export | 3 exports | None |
| Bulk upload | 3 (fleet components, jobs, spares) | None |
| Copy operation | Copy Vessel (complex multi-table) | None |
| Database tables | 10+ fleet tables | 10 cert/survey tables |
| Inline Drizzle queries | Minimal | Extensive — most admin routes use inline Drizzle |
| 3-Tab Admin pattern | Not applicable | Core pattern (Master → Company → Vessel) |

---

## Appendix C: Route Inventory Checklist (24/24 Verified)

### routes.ts — Cert/Survey Routes (24 handlers)

| # | Line | Method | Path | V2 Target | Accounted |
|---|------|--------|------|-----------|-----------|
| 1 | 13350 | GET | `/certificates` | `certificateController.getAll` | YES |
| 2 | 13563 | GET | `/certificates/:id` | `certificateController.getById` | YES |
| 3 | 13639 | PATCH | `/certificates/:id` | `certificateController.update` | YES |
| 4 | 13827 | GET | `/surveys` | `surveyController.getAll` | YES |
| 5 | 14018 | GET | `/surveys/:id` | `surveyController.getById` | YES |
| 6 | 14033 | PATCH | `/surveys/:id` | `surveyController.update` | YES |
| 7 | 14131 | POST | `/surveys` | `surveyController.create` | YES |
| 8 | 14146 | GET | `/admin/ship-certificates-master` | `certificateAdminController.getMasters` | YES |
| 9 | 14164 | POST | `/admin/ship-certificates-master` | `certificateAdminController.upsertMaster` | YES |
| 10 | 14364 | DELETE | `/admin/ship-certificates-master/:masterId` | `certificateAdminController.deleteMaster` | YES |
| 11 | 14400 | GET | `/admin/ship-certificates-labels` | `certificateAdminController.getLabels` | YES |
| 12 | 14427 | POST | `/admin/ship-certificates-labels` | `certificateAdminController.updateLabels` | YES |
| 13 | 14470 | GET | `/admin/vessel-certificate-applicability` | `certificateAdminController.getApplicability` | YES |
| 14 | 14506 | POST | `/admin/vessel-certificate-applicability/initialize` | `certificateAdminController.initializeApplicability` | YES |
| 15 | 14560 | PATCH | `/admin/vessel-certificate-applicability` | `certificateAdminController.updateApplicability` | YES |
| 16 | 14610 | POST | `/admin/vessel-certificate-applicability/bulk-update` | `certificateAdminController.bulkUpdateApplicability` | YES |
| 17 | 14665 | GET | `/admin/ship-surveys-master` | `surveyAdminController.getMasters` | YES |
| 18 | 14683 | POST | `/admin/ship-surveys-master` | `surveyAdminController.upsertMaster` | YES |
| 19 | 14852 | DELETE | `/admin/ship-surveys-master/:masterId` | `surveyAdminController.deleteMaster` | YES |
| 20 | 14879 | GET | `/admin/ship-surveys-labels` | `surveyAdminController.getLabels` | YES |
| 21 | 14906 | POST | `/admin/ship-surveys-labels` | `surveyAdminController.updateLabels` | YES |
| 22 | 14951 | GET | `/admin/vessel-survey-applicability` | `surveyAdminController.getApplicability` | YES |
| 23 | 14985 | POST | `/admin/vessel-survey-applicability/initialize` | `surveyAdminController.initializeApplicability` | YES |
| 24 | 15039 | POST | `/admin/vessel-survey-applicability/bulk-update` | `surveyAdminController.bulkUpdateApplicability` | YES |

**Total: 24/24 legacy route handlers accounted for in V2 plan.**

---

## Appendix D: Key Business Logic Patterns to Preserve

### D.1 Certificate List with Pagination & Join (routes.ts L13350)

The certificate list endpoint has the most complex query pattern in this module:
1. Joins `vesselCertificateApplicability` with `vesselCertificateData` tables
2. Supports filtering by `vesselId` and `vesselName`
3. Applies pagination (`page`, `pageSize` query params)
4. Applies sorting (`sortField`, `sortDirection` query params)
5. Returns response with pagination metadata: `{ data, total, page, pageSize, totalPages }`

**V2 must reproduce this exact query and response shape.**

### D.2 Applicability Initialization (routes.ts L14506, L14985)

The initialization endpoints follow this pattern:
1. Accept `vesselId` in request body
2. Fetch all master records from `shipCertificatesMaster` (or `shipSurveysMaster`)
3. For each master record, check if applicability record already exists for this vessel
4. If not exists → create new applicability record
5. If exists → skip (idempotent)
6. Return count of created records

**V2 must preserve the idempotent behavior and exact same response.**

### D.3 Master Data Upsert with Sequence (routes.ts L14164, L14683)

The master data upsert follows this pattern:
1. If request body contains an existing `id` → update the existing master record
2. If request body is a new record (no `id` or id=0) → assign next sequence number and create
3. Sequence numbers maintain ordering across all master records
4. Returns the created/updated master record

**V2 must preserve the exact same sequence assignment logic.**

### D.4 Bulk Applicability Update (routes.ts L14610, L15039)

The bulk update pattern:
1. Accept array of applicability records in request body
2. For each record, update the corresponding row in `vesselCertificateApplicability` (or `vesselSurveyApplicability`)
3. All updates should succeed or return meaningful errors
4. Returns updated records or success confirmation

**V2 must preserve the exact same update behavior and response.**

---

## Appendix E: Database Table Relationships

```
┌─────────────────────────┐
│ shipCertificatesMaster  │ ← Master definitions (template)
│  id, sequence, name...  │
└──────────┬──────────────┘
           │ 1:N
           ▼
┌──────────────────────────────────┐
│ vesselCertificateApplicability   │ ← Which master certs apply to which vessels
│  id, vesselId, masterId,         │
│  isApplicable...                 │
└──────────┬───────────────────────┘
           │ 1:1
           ▼
┌──────────────────────────────────┐
│ vesselCertificateData            │ ← Vessel-specific cert data
│  id, vesselId, masterId,         │
│  issueDate, expiryDate...        │
└──────────────────────────────────┘

┌─────────────────────────────────┐
│ shipCertificatesLabelsConfig    │ ← Dynamic label naming
│  id, label1, label2...          │
└─────────────────────────────────┘

┌─────────────────────────┐
│ certificates             │ ← Operational certificate records
│  id, vesselId, name...   │
└──────────────────────────┘


┌───────────────────────┐
│ shipSurveysMaster     │ ← Master definitions (template)
│  id, sequence, name...│
└──────────┬────────────┘
           │ 1:N
           ▼
┌──────────────────────────────┐
│ vesselSurveyApplicability    │ ← Which master surveys apply to which vessels
│  id, vesselId, masterId,     │
│  isApplicable...             │
└──────────┬───────────────────┘
           │ 1:1
           ▼
┌──────────────────────────────┐
│ vesselSurveyData             │ ← Vessel-specific survey data
│  id, vesselId, masterId,     │
│  surveyDate, nextDueDate...  │
└──────────────────────────────┘

┌───────────────────────────────┐
│ shipSurveysLabelsConfig       │ ← Dynamic label naming
│  id, label1, label2...        │
└───────────────────────────────┘

┌───────────────────────┐
│ surveys                │ ← Operational survey records
│  id, vesselId, name... │
└────────────────────────┘
```

---
