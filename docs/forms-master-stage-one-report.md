# Forms Master Stage 1 — completion evidence

## Status and evidence labels

Implementation and local fixture verification are complete.

**Pilot used: NO.** No approved live shore/ship pilot session or production-data
access was supplied for this fork. No production database was queried and
nothing was published. The PostgreSQL fixtures below are deliberately **not**
labelled PROVEN: under CLAUDE.md that label requires live pilot/production
evidence. READ findings describe code; INFERRED operational conclusions remain
subject to rollout verification.

## Decisions and sign-offs

- Domain: **Jeevan Naik — 09-11-2026**.
- Synchronization: **Nilesh - Jeevan Naik — 09-11-2026**.
- Owner approved the proposed policies as written: role-based Approver source;
  global replication including vessel-specific forms; immutable saved scope;
  explicit admin-masters action grants for every Office role including admins;
  restore requires edit; no missing/mock/preview identity exemption;
  mandatory transactional audit and outbound logging; system seed attribution;
  additive schema/file migrations allowed, unrelated extraction/refactors not.
- Subsequent explicit approval: **“Approve matching reference types.”**
  The physical Approver FK matches an installation's existing TEXT/native-UUID
  role reference. Existing role/vessel columns are not converted.

Full decision record: `docs/forms-master-stage-one-decisions.md`.

## Actual implementation files

### Data, contracts, startup and backend

- `migrations/192_pms_forms_master.sql`
- `migrations/192_pms_forms_master.md`
- `shared/pmsFormsMasterContracts.ts`
- `shared/schema.ts` — only the three additive catalogue definitions.
- `server/modules/forms-master/formsMasterRoutes.ts`
- `server/modules/forms-master/controllers/formsMasterController.ts`
- `server/modules/forms-master/services/formsMasterService.ts`
- `server/modules/forms-master/services/formsMasterSyncPolicy.ts`
- `server/modules/forms-master/repositories/formsMasterRepository.ts`
- `server/modules/forms-master/defaults/pmsFormsMasterSeedData.ts`
- `server/modules/forms-master/defaults/pmsFormsMasterSeeder.ts`
- `server/storage.ts`, `server/postgresStorage.ts` — transaction contract and
  backward-compatible optional audit transaction participation.
- `server/routes.ts` — separate `/technical/api/admin/forms-master` mount.
- `server/index.ts` — separately named seed after existing migrations,
  database/tenant/sync-identity initialization and before route registration.
- `server/utils/tenantConnectionManager.ts` — additive Forms Master startup
  lifecycle within the existing lazy per-tenant migration path, before pool
  readiness is published.
- `server/middleware/requestContext.ts` — System context helper used by these
  default seeds, preventing inheritance of the first connecting Office user.

### Synchronization

- `shared/syncConfig.ts`
- `server/modules/sync/oneWayApplier.ts`
- `server/modules/sync/provisioningService.ts`
- `server/modules/sync/syncEngine.ts`
- `server/modules/sync/fieldLogger.ts` — current-tenant instance identity for
  these three catalogue tables only; existing tables retain their behavior.
- Feature-specific rules live in `formsMasterSyncPolicy.ts`, not a new engine.

### Interface

- `client/src/pages/admin/FormsMasterManagement.tsx`
- `client/src/components/admin/FormsMasterRecordDialog.tsx`
- `client/src/components/admin/FormsMasterLabelsDialog.tsx`
- `client/src/pages/admin/Admin4Dashboard.tsx`
- `client/src/pages/pms/PMSAdmin.tsx`
- `client/src/pages/TechnicalModule.tsx`
- `client/src/components/SideMenuBar.tsx`

The additional navigation files were necessary because the old Fleet Master
Data tab is Sail-Admin-only, and the parent PMS Admin menu can be denied by
existing view grants. Non-admin Fleet Master Data presents only this catalogue;
the targeted PMS shortcut remains accessible without opening other masters.
No global permission defaults were changed.

### Verification, generation and supporting documentation

- `scripts/generate-pms-forms-master-defaults.ts`
- `scripts/verify-pms-forms-master.ts`
- `server/modules/forms-master/__tests__/fixtures/forms-master-base.sql`
- `server/modules/forms-master/__tests__/fixtures/forms-master-text-role.sql`
- `docs/forms-master-stage-one-decisions.md`
- This report and the rollout document above.
- `.gitignore`, `.replitignore` — generated verification output excluded.
- `.agents/memory/MEMORY.md`, `forms-master-domain-policy.md` and
  `forms-master-migration-policy.md` — durable approved project constraints.

No package or toolchain dependency was added.

## Migration identity and reruns

**File:** `migrations/192_pms_forms_master.sql`.

The root migration number was rechecked before creation. This is a checked-in
idempotent SQL file using the existing tracked runner; no inline migration
entry, schema push, deployment SQL or startup catalogue-repair DDL was added.

Fixture evidence:

- Empty catalogue plus existing reference-table prerequisites: tracked first
  execution applies one migration.
- Tracked second execution applies zero and skips one.
- Two further direct SQL executions succeed without altering existing data.
- Native-UUID and TEXT role-reference installations both succeed, including a
  direct repeat on the TEXT variant.
- Existing Form Builder sentinel remains intact.

Development observation: the tracked record is
`192_pms_forms_master`, applied at `2026-11-09T06:50:27.614Z`.
Final startup reports zero newly applied file migrations and preserves defaults.
This is development evidence, not proof of ship deployment.

## Deterministic defaults and preservation

The offline generator read **Forms Register**, excluded **PMS Work Order / Job
Card**, and cross-checked the resulting ordered rows against Sheet1:

| Group | Categories | Forms |
|---|---:|---:|
| A | 5 | 7 |
| B | 8 | 8 |
| C | 11 | 16 |
| D | 10 | 10 |
| E | 9 | 9 |
| F | 9 | 9 |
| G | 5 | 5 |
| **Total** | **57** | **64** |

There are exactly **7 Groups**, guidance is preserved, Company Form Name equals
Form Name initially, approvals are false, Approver is empty, and initial scope
is fleet with no vessel. The excluded row consumes no application number.

Fixed namespace: `c9030cc3-3842-54f9-8626-1af86ca72675`.
Seed keys are FG-DEF-A…G, FC-DEF-<group>-<nn> and FM-DEF-001…064.
UUIDs are derived with the existing uuid-v5 dependency.

Fixture evidence: two independently initialized catalogues have the same UUIDs,
Form IDs, ordering and source guidance. Repeated seeds insert zero, preserve
Office edits, soft deletion and timestamps, leave custom records untouched and
emit no duplicate audit/log events. Conflicting missing identities are reported
before any default insertion is committed.

Final development startup:

```text
groups:     inserted 0, skipped 7
categories: inserted 0, skipped 57
forms:      inserted 0, skipped 64
conflicting: 0
```

Independent development counts were 7/57/64. Fresh fixture seeds create 128
system audit events; ship seeds create no outbound catalogue field logs.
Runtime imports static data only and does not read the workbook/attached_assets.

### Tenant startup correction

The final completion check identified that the original process-startup call
seeded only the default database. This has been corrected, not deferred.
The existing tenant manager now runs its same migration/base-initialization
sequence through the catalogue tenant-startup lifecycle in that tenant's
AsyncLocalStorage context, then automatically seeds before marking the tenant
migrated or publishing its pool. New tenants added after process startup are
covered. Seed/migration failure retains the existing pool-close/retry behavior.

Additional fixture evidence exercises that actual lifecycle hook with the
existing tracked file runner, not a manual repository seed: newly migrated shore
and ship tenant contexts both automatically receive 7/57/64, repeats preserve
an Office-edited/deleted default and timestamps, seed conflicts fail before
tenant readiness, all 128 audits are System-attributed despite an inherited
Office request, shore logs carry the tenant's own instance ID and ship logs are
empty. Fixtures use isolated PostgreSQL schemas; actual master-registry lookup,
physical database creation and connection discovery remain unverified on a pilot.

## Exact synchronization additions

| Table | Identity | Category | Direction | Global | Configurable | Vessel scope |
|---|---|---|---|---|---|---|
| pms_form_groups | fguuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |
| pms_form_categories | fcuuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |
| pms_forms_master | fmuuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |

All notes are exactly: “Forms Master – Office-managed; ships read-only; defaults
seeded both sides with UUID v5 identities.”

READ: the existing category/phase selection explicitly orders the new tables
Groups → Categories → Forms after existing references; it is not dependent on
object insertion order. Existing table order is otherwise unchanged.

Narrow compatibility changes:

1. Transactional field logging includes precisely these three new one-way
   tables, without changing other one-way tables' logging policy.
2. Provisioning exports catalogue tombstones to preserve defaults and allocated
   identifiers. It includes referenced vessel rows and historical role rows.
3. Catalogue provisioning uses the UUID-aware one-way applier rather than
   importing shore-local integer IDs.
4. Role cleanup during reprovisioning preserves roles referenced by this
   catalogue. Incremental applies retain role tombstones only when delivered
   Forms Master rows explicitly reference them.
5. Missing catalogue schema refuses provisioning before cleanup. Incremental
   table/FK failures remain errors.

Fixture evidence: default replay, new parents/children, edits, deletions,
restores and order changes converge; replays are safe; a full feature/reference
bundle imports and reimports successfully into a preseeded receiver using
different local integer ID ranges. Receiving applies create no Office audit
events. Retired role labels remain readable. Missing vessel references produce
errors until supplied; missing receiver migration is refused.

READ: the existing incremental engine records failed one-way tables and returns
them to the completion/checkpoint path rather than silently accepting failed
delivery. The network checkpoint exchange itself was not exercised on a pilot.

INFERRED: deployed matching code plus migrations and master references should
support actual shore/ship delivery. A live pilot must confirm this. Vessel
specificity intentionally does not restrict replication or catalogue visibility.
No files/attachments are synchronized by Stage 1.

## Authorization and audit evidence

READ: route-local policy requires a signature-verified login for **every**
request, including reads. On multi-tenant installations it uses the existing
tenant-verified principal with no single-tenant key fallback. On single-tenant
installations it verifies the bearer token with the existing JWT signing key.
Forwarded/req.user actor UUID, role and Office/Ship type must all match verified
claims; a valid-looking UUID or privileged role name alone never authenticates.

Mutation capabilities additionally require a known shore installation,
Office user type, active non-deleted role and explicit live admin-masters action.
There is no admin bypass; restore maps to edit. Deleted permission rows do not
authorize writes.

The legacy preview default can forward a real-looking UUID. It has no exemption:
like every other identity, it requires a verified matching login. No-token use
is refused even if the claimed role has permission. No other module's
authentication or mock-auth behavior was changed.

Fixture evidence: all 14 mutation route shapes deny ship installation, ship user
on shore, missing/mock/unconfigured identity, administrators without explicit
permission and unverified development fallback. Valid Office writes succeed;
restore fails without edit and succeeds after edit is granted.

Additional real-HTTP fixture evidence: 11 single-tenant and 12 multi-tenant
identity-context attack combinations are rejected on all 14 mutation shapes
(322 denied writes), as well as authenticated reads. Cases include unsigned
non-default UUIDs and privileged roles, signed/header subject/role/type mismatch,
missing claims, expiration, wrong signatures, malformed credentials, and a
valid single-tenant token presented without tenant verification. The test tenant
gateway verifies a different synthetic signature key before setting its trusted
principal; actual tenant database/key discovery remains a pilot limitation.
Matching signed Office requests succeed in both modes with actual actor audits;
matching signed Ship requests can read but have no mutation capabilities.
The test keys are ephemeral and restricted to the standalone fixture process.

Business mutation, audit and shore field changes use one transaction. Fault
triggers simulate audit and sync-log failures: neither leaves a successful
business mutation. Before/after values and the actual request actor are recorded.

Development read-only check found the existing active `admin-masters` mapping
and six live permission rows. No permission-data migration was necessary.

## Test and diagnostic results

Commands used the existing native Node runtime (the workspace wrapper can stall
under its loader); no package installation was needed:

```text
node node_modules/tsx/dist/cli.mjs scripts/verify-pms-forms-master.ts
FORMS MASTER FIXTURE VERIFICATION: 17 groups passed.
Pilot NOT used; these are isolated fixture results.

node node_modules/typescript/bin/tsc --noEmit --pretty false
Baseline: 0 diagnostics, exit 0
Final:    0 diagnostics, exit 0

git diff --check
Pass

node scripts/check-tracked-filenames.cjs
Tracked filenames have no trailing whitespace.
```

The 17 fixture groups cover migration reruns/type variants, deterministic seeds
and preservation, allocation/overflow/concurrency, validation/whitespace,
all-column sorting/pagination/filter totals, dependency deletion/reorder,
hierarchy races, audit/outbound failure rollback, seed conflicts, direct API
authorization, mandatory credential/claim binding in both identity modes,
ordered one-way convergence and full feature provisioning.
The tenant-startup group additionally covers automatic post-migration seeding,
System attribution, tenant-specific outbound identity and failure isolation.

These are a focused PostgreSQL/API fixture suite, not an unrestricted
project-wide regression run or a live browser mutation test.

## Startup and UI verification

Final workflow restart serves port 5000, resolves the existing shore identity,
skips preserved defaults and reports no Forms Master startup failure.
Existing AG Grid license/Browserslist notices remain unrelated.

Routes:

- Existing Fleet Master Data entry:
  `/pms/admin?pms.tab=admin-4&pms.master.view=forms-master`
- Read-access shortcut:
  `/pms/forms-master?pms.master.view=forms-master`

Screenshot verification reached the final shortcut. The capture browser has
only the legacy unverified preview identity, so the final screen intentionally
shows a 401 identity-required response and no mutation buttons. An anonymous
proxied GET also returns 401. This verifies navigation and denial rendering,
**not** a signed-in browser CRUD walkthrough. UI fields, dependent selectors,
sort/pagination queries, per-action controls, error/draft retention, label
dialogs and query invalidation were code-checked; server behavior is covered by
the fixtures. “Create Form” is toast-only and does not open Form Builder.

## Scope confirmation and rollout limitations

No existing Form Builder implementation/table definition, Certificates data or
label-saving UI, Job/Work Order forms, approval-engine behavior, scheduler,
running-hours logic, or unrelated sync configuration was modified.
The existing startup infrastructure still runs its unrelated maintenance tasks;
none was repurposed by this feature.

Before operational rollout:

- Install migration/code on shore and every receiving ship.
- Supply referenced vessels/roles through the existing master-data mechanisms.
- Use a real signed-in Office/Ship identity; the preview default is not permitted.
- Verify the existing signing-key setup and `SAILERP_JWT_USER_CLAIMS` mapping
  provide the canonical actor UUID, role and Office/Ship type. Header-only
  forwarding is deliberately insufficient.
- Conduct an approved live pilot covering actual incremental/full transport,
  checkpoint retry behavior and real master-reference availability.
- Perform a signed-in browser acceptance walkthrough on the target installation.

No remaining implementation blocker is known from local verification. The
operational items above are explicitly unverified, not claimed pilot results.
