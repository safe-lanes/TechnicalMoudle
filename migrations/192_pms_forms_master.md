# Migration 192 — PMS Forms Master Stage 1

## Purpose and boundaries

Adds a separate Office-managed catalogue. It does not replace or alter
`form_definitions`, `form_versions`, `form_version_usage`, Certificates,
Jobs, Work Orders, approval workflows or scheduling.

Run the checked-in `migrations/192_pms_forms_master.sql` through the existing
`runBackupAndMigrations` → `runDrizzleMigrations` tracked SQL runner. Do not
use schema push, the legacy inline migration array, manual deployment SQL,
a new runner, or startup schema-repair DDL.

## Prerequisites

- Existing `vessels.vuuid` is unique TEXT containing canonical UUIDs.
- Existing `admn_role_master.ruid` is unique TEXT or native PostgreSQL UUID.
  The owner approved matching the **new** Approver column to that actual type.
  The SQL reads metadata and creates `approver_role_ruid` accordingly; it does
  not convert or alter existing role/vessel columns.
- Existing audit, sync-field-log and sync-instance identity infrastructure.
- A signature-verified login carrying the canonical actor UUID, role and
  Office/Ship type under the existing `SAILERP_JWT_USER_CLAIMS` mapping.
  Multi-tenant requests reuse the existing tenant-verified principal.
  Single-tenant requests require the existing `JWT_SECRET` signing-key setup.
  Forwarded identity headers must match the signed identity and cannot replace
  credentials. Configure real signing credentials through the normal secure
  deployment setup; never use fixture keys.
- The existing `admin-masters` menu/action grants must be configured for the
  intended Office roles. There is no new permission infrastructure or automatic
  permission grant, and administrators have no bypass for this catalogue.

The ORM retains the project's logical UUID-string mapping for the role
reference. Physical TEXT/UUID variations are handled only by the SQL migration.
Never generate/push a replacement schema from this logical mapping.

## Tables, fields and indexes

All three tables have generated local integer IDs, nullable unique seed keys,
default/deleted flags, timestamps and created/updated actor UUID fields.
Local integer IDs are not cross-installation references.

- `pms_form_groups`: unique `fguuid`, immutable unique `group_code`,
  `group_name`, independent `display_order`. Partial unique active
  `lower(trim(group_name))`; deleted/order list index.
- `pms_form_categories`: unique `fcuuid`, UUID-string Group FK, immutable
  `category_no`, name and independent order. Unique allocated Group/number
  including tombstones; partial unique active Group/normalized name;
  Group/deleted/order index.
- `pms_forms_master`: unique `fmuuid`, immutable unique `form_id`, immutable
  Fleet/Vessel scope, vessel UUID-string FK, Group/Category UUID-string FKs,
  required form/company names, independent pre/post booleans, optional role FK
  and label snapshot, four read-only guidance fields. Active normalized global
  form-name uniqueness, parent, category and scope/vessel/deleted indexes.

Form-name whitespace normalization uses precisely space, HT, LF, CR, FF and VT.
Repeated runs of these characters collapse to one space, outer spaces are
removed, and comparison is case-insensitive. Other Unicode whitespace is not
part of the collapse set. Company names are not unique.

There are no database enums, synced-text CHECK constraints, cascade deletes,
counter tables, destructive rebuilds or hardcoded business primary keys.
Every CREATE TABLE/INDEX is guarded. The role-type inspection is inside the
checked-in SQL file, not startup application DDL.

## Execution and repeat runs

Normal startup first runs tracked migrations. The runner records
`192_pms_forms_master`. A tracked repeat skips it. A second direct execution
of the SQL file is also safe: tables/indexes are retained and no customer row
is changed.

Verification uses `scripts/verify-pms-forms-master.ts`: isolated empty fixture
schemas with baseline references, tracked first/repeat execution and direct
repeat execution, both native-UUID and TEXT role reference variants, plus an
unrelated Form Builder sentinel. These are fixture results, not a live pilot.

## Separate default seeding

`seedPmsFormsMasterDefaults` runs in `server/index.ts` after migrations,
`initializeDatabase`, tenant-manager setup and sync-identity initialization,
before route registration. The existing master-list seeds remain in
`initializeDatabase`; they and Form Builder's seeds are not repurposed.

In multi-tenant mode, default-database startup is not sufficient. The existing
lazy tenant-pool startup invokes `initializePmsFormsMasterTenant` in the new
tenant's context. Its callback runs the existing tracked migration runners and
base initialization in their existing order; it then validates that tenant's
effective instance identity and automatically seeds defaults. The manager
marks migration complete and caches/releases the pool only after this succeeds.
Failure closes the pool under the existing retry/cooldown behavior, so no
catalogue request can use an unseeded newly initialized tenant. Tenants created
after process startup follow the same path on their first connection.

Seeds use an explicit System audit context rather than inheriting the person
who first connected. Forms Master field logs resolve the current tenant's
instance identity instead of borrowing the process's default-database cache.
No other table's field-log identity behavior is changed.

Defaults are checked-in typed data, generated offline from Forms Register and
cross-checked against Sheet1. No startup spreadsheet read is involved.

The seed and catalogue writes share a transaction-scoped catalogue advisory
lock. Missing identity conflicts are preflighted. Inserts are Groups →
Categories → Forms, with UUID-v5 conflict targets and no update path.
Existing edits, tombstones, timestamps and custom additions are preserved.
Actual inserts are system-audited. Shore inserts are field-logged in the
same transaction; ship seeds produce no outbound catalogue logs.

Fresh fixture totals: 7 Groups / 57 Categories / 64 forms. Per-Group
Categories/forms: A 5/7, B 8/8, C 11/16, D 10/10, E 9/9, F 9/9, G 5/5.
Existing installations are not forced back to these active totals.

## Shore/ship rollout and synchronization

1. Deploy the file migration and receiver-compatible code to every ship and
   shore before delivering the new tables. A receiver without the migration
   must fail delivery; it must not acknowledge missing tables.
2. Start each installation. Confirm sync instance identity and seed statistics.
3. Ensure the referenced vessel and role identities exist on receivers.
   Full provisioning includes vessel applicability references and referenced
   retired roles. Subsequent new vessel references still require the existing
   SAILERP vessel-master provisioning/refresh; PMS does not reclassify vessels
   as a synchronized table. Missing FK references produce delivery errors and
   must be supplied before retry, not silently cleared.
4. Full provisioning retains catalogue tombstones and uses UUID-aware applies,
   never sender-local integer PKs. Reprovisioning preserves roles already
   referenced by this catalogue.
5. Incremental one-way delivery is explicitly Groups → Categories → Forms
   after existing global references. Role tombstones are retained only when
   the delivered Forms Master records explicitly reference them.
6. Shore writes use mandatory transactional audit/field logging. Ship receiving
   applies do not pretend to be Office actions or emit duplicate seed audits.

Exactly three new SYNC_CONFIG entries are added:

| Table | Identity | Category | Direction | Global | Configurable | Vessel scope |
|---|---|---|---|---|---|---|
| pms_form_groups | fguuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |
| pms_form_categories | fcuuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |
| pms_forms_master | fmuuid | ONE_WAY_SHORE_TO_SHIP | shore_to_ship | true | false | null |

Each note is: “Forms Master – Office-managed; ships read-only; defaults seeded
both sides with UUID v5 identities.”

Vessel-specific records deliberately replicate to **every** ship and are
visible in the catalogue; vessel scope expresses applicability only.
No files or attachments are part of this feature.

## Troubleshooting

- **Migration FK type error:** inspect the actual reference metadata. Only
  TEXT/native-UUID role variants are approved. Do not convert existing roles.
- **Seed conflict:** startup aborts and prints conflicting identities/seed keys,
  with zero committed default inserts. Investigate the conflicting customer row
  instead of overwriting, adopting or deleting it automatically.
  For lazy tenant startup, that tenant's pool is not made ready; other tenants
  remain unaffected and the existing retry/cooldown path is retained.
- **Replit preview identity:** the fixed AuthContext default is accepted only
  when the frontend flag is exactly `VITE_APP_ENV=replit`, the server is in
  development and single-tenant mode, and the request matches that fixed
  identity. Its UUID must map to a non-deleted canonical `master_users` record;
  its effective role is read from that record and still needs an active
  `admin-masters` action grant. This is not a permission bypass or general
  header-based authentication.
- **401 outside the Replit exception:** expected without a verified integrated
  login. Header-only requests are not authenticated even if the UUID and role
  look valid. Verify signing-key setup and configured subject/role/user-type
  claims; never fix a mismatch by trusting caller-supplied headers.
- **403 for an administrator:** verify Office identity, shore identity and the
  explicit admin-masters action. Missing/unconfigured/deleted grants deny.
- **Audit or outbound-log failure:** no successful catalogue write is committed.
  Fix the underlying database/logging issue and retry.
- **Missing receiver table or parent FK:** apply this migration through the
  runner and provision references, then retry. No skip-and-ack workaround.
- **Live pilot:** fixture verification does not establish VSAT delivery,
  deployment ordering or production-data occurrence. An approved live shore/ship
  pilot is still needed before operational rollout.
