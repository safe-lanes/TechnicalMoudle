# Forms Master defaults — migration 193

## Scope and rollout hold

This document supersedes startup-seeding instructions in the migration 192 notes.
Ship `193_pms_forms_master_defaults.sql` together with the two startup changes.
Do not deploy startup detachment without the seed file. The existing tracked file
runner applies it independently on **shore AND every ship/tenant database**.
There is no installation-role branch, new setting, resend or checkpoint reset.

**Do not restart the app, run migrations or mark the task complete until the
owner separately approves those actions.** Implementation verification is offline
only. No database has been inspected or migrated by this change.

### Implementation report — awaiting owner approval

Exactly these implementation files changed:

| Action | File |
|---|---|
| Add | `migrations/193_pms_forms_master_defaults.sql` |
| Add | `migrations/193_pms_forms_master_defaults.md` |
| Add | `server/modules/forms-master/__tests__/formsMasterSeedMigration.test.ts` |
| Add | `server/modules/forms-master/__tests__/formsMasterSeedStartup.test.ts` |
| Modify | `server/index.ts` |
| Modify | `server/utils/tenantConnectionManager.ts` |

Verification results:

- Only the two new explicit test paths ran: **36 tests passed, 2 files passed**.
- Project TypeScript baseline: **0 errors**; after implementation: **0 errors**.
- Separate type-check including the two normally excluded test files: **0 errors**.
- `npm run build`: **passed**. Existing non-blocking warnings reported stale
  Browserslist metadata, large chunks and mixed static/dynamic PDF imports;
  Vitest also reported the existing `__dirname` configuration warning.
- `git diff --check`: **passed**.
- No existing tests, DB-backed verifier, database connection, actual SQL/migration
  execution, server start or live sync pilot was performed.
- Workflow stopped before source/test edits and remains stopped. Task has not
  been marked complete. No schema, sync logic, original seed references,
  existing migrations, dependency files or project configuration were edited.

### Payload and preservation

- 7 Groups, 57 Categories, 64 Forms: 128 fixed UUID-v5 identities.
- Namespace: `c9030cc3-3842-54f9-8626-1af86ca72675`.
- Payload and all guidance text match the retained legacy seeder exactly.
- Same-UUID rows are never updated, including edited seed keys, labels, codes,
  ordering, company names, approval settings, metadata and soft-deleted rows.
- Missing identities are inserted parent-first. Business-key conflicts with an
  unrelated UUID abort the whole DO statement with `P0001`, identifying the table,
  seed key, expected UUID, conflicting UUID, code/number and name.
- A missing prerequisite table aborts clearly. Advisory transaction lock 764192
  is shared with application catalogue writes. The file creates no persistent
  objects, extensions, audit entries, field logs or sync logs.
- PostgreSQL still generates local integer IDs and timestamps. Approval flags
  default false; optional actors and approver references default null; deleted
  defaults false; explicitly seeded `is_default` is true.
- Existing rows/logs are not removed or rewritten. Migration history records the
  installation, **not a per-row application audit**. This deliberate difference
  replaces the legacy seeder's seed-only audit and shore field-log writes. Normal
  Office mutations still audit/log exactly as before.

### Retained references, no production calls

`seedDefaults()` in formsMasterRepository, `seedPmsFormsMasterDefaults()` and
`initializePmsFormsMasterTenant()` remain unchanged solely for legacy fixture and
parity-reference compatibility. Neither normal nor lazy tenant startup calls them.
The existing `scripts/verify-pms-forms-master.ts` exercises the old algorithm; it
is not verification of migration 193 and must not be run for this task.

Both production paths still run their existing migrations/base initialization.
Lazy tenant startup retains context, ordering, effective identity validation,
readiness/cache publication and failure/cooldown handling without recurring seed.
Sync config, provisioning and appliers are unchanged: all three tables remain
global ONE_WAY_SHORE_TO_SHIP and use fguuid/fcuuid/fmuuid, never local integer IDs.
Shore-delivered business values/tombstones update matching vessel UUIDs. Existing
watermark/delivery gaps are not repaired or replayed by this change.

## Exact migration history contract

The existing `ensureMigrationsTable()` in `server/migrations.ts` defines:

| Column | PostgreSQL type | Nullable | Default / constraint |
|---|---|---|---|
| id | character varying(255) | No | PRIMARY KEY; no default |
| name | character varying(255) | No | NOT NULL; no default |
| description | text | Yes | no explicit default (null when omitted) |
| applied_at | timestamp without time zone | Yes | now(); **not** NOT NULL |

These are code-defined expectations, not a claim about an inspected live schema.
Use the first operator query below to inspect the actual installation. No new
history column/table/index is introduced. The runner explicitly supplies NOW()
for applied_at and uses ON CONFLICT(id) DO NOTHING.

**Illustrative example row only — not observed in any database:**

```text
id          = 193_pms_forms_master_defaults
name        = Drizzle SQL migration: 193_pms_forms_master_defaults.sql
description = Auto-applied from migrations/193_pms_forms_master_defaults.sql
applied_at  = 2026-11-10 12:34:56.123456
```

The filename (without `.sql`) is the tracked ID. No manual history insertion or
Drizzle journal edit is needed. The SQL batch and subsequent history insert are
separate runner operations: after interruption between them, replay inserts no
same-UUID rows and then records history. `P0001` failures are NOT caught by the
runner's object-exists skip-and-ack policy, so they leave 193 unapplied. Unexpected
constraints fail atomically too. Existing earlier migration failures (including
0067) can still block an upgrade before 193; this change does not repair them.

## Verification limitations

Only the two new explicit Vitest paths are allowed: capture original seed output
using fakes; compare every payload field/UUID; stage preservation/conflict/replay
simulations; inspect SQL contracts; run selected actual runner source with fake
execution/history; exercise actual tenant startup with fake pools and migrations.
These checks do **not** prove PL/pgSQL syntax/execution on PostgreSQL. They never
connect to a database, execute SQL there, import/start server/index.ts or run the
historical verifier. Build the app without starting it and compare TypeScript to
the stopped-workflow baseline. Actual rollout/database checks need later approval.

## Read-only operator SQL

Run independently on shore and **every vessel and tenant database**, only after
an authorized upgrade. Every block below is SELECT/CTE only; there are no temporary
objects, writes, extensions or migration calls. Tables are explicitly in public,
matching the migration prerequisite checks. If a prerequisite is absent, stop and
investigate rather than creating it or forcing a history record. Prefer running
the checklist while catalogue writes are paused so separate query snapshots agree.

### 1. Confirm actual prerequisites and history schema

Expected: all four table names resolve; four history columns match the table above;
primary key on id. The default expression is typically reported as `now()`.

```sql
SELECT table_name, to_regclass('public.' || table_name) AS resolved_table
FROM (VALUES ('schema_migrations'), ('pms_form_groups'),
             ('pms_form_categories'), ('pms_forms_master')) AS t(table_name);

SELECT ordinal_position, column_name, data_type, character_maximum_length,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'schema_migrations';
```

### 2. Confirm migration 193 is recorded exactly once

Expected `recorded_count = 1`, `recorded_once = true`, correct name/description and
non-null applied_at. Zero means not recorded (possibly a failed/pending upgrade
or a data-committed/history-interrupted run); do not manually mark it applied.

```sql
SELECT count(*) AS recorded_count, count(*) = 1 AS recorded_once
FROM public.schema_migrations
WHERE id = '193_pms_forms_master_defaults';

SELECT id, name, description, applied_at
FROM public.schema_migrations
WHERE id = '193_pms_forms_master_defaults';
```

### 3. Count installed seed-key families, including soft-deleted rows

Expected untouched seed keys: 7 / 57 / 64. Extra custom rows do not change these
family counts unless they deliberately reuse the reserved prefixes. An Office-
edited seed key can lower a count even when the original UUID still exists;
use the full manifest query next before treating this as missing data. Do not
restore soft-deleted rows or overwrite customer edits to force counts.

```sql
SELECT 'pms_form_groups' AS entity, 7 AS expected_seed_keys,
       count(*) FILTER (WHERE seed_key LIKE 'FG-DEF-%') AS seed_family_rows,
       count(DISTINCT seed_key) FILTER (WHERE seed_key LIKE 'FG-DEF-%') AS distinct_seed_keys,
       count(*) FILTER (WHERE seed_key LIKE 'FG-DEF-%' AND is_deleted) AS deleted_seed_rows,
       count(*) AS all_rows
FROM public.pms_form_groups
UNION ALL
SELECT 'pms_form_categories', 57,
       count(*) FILTER (WHERE seed_key LIKE 'FC-DEF-%'),
       count(DISTINCT seed_key) FILTER (WHERE seed_key LIKE 'FC-DEF-%'),
       count(*) FILTER (WHERE seed_key LIKE 'FC-DEF-%' AND is_deleted), count(*)
FROM public.pms_form_categories
UNION ALL
SELECT 'pms_forms_master', 64,
       count(*) FILTER (WHERE seed_key LIKE 'FM-DEF-%'),
       count(DISTINCT seed_key) FILTER (WHERE seed_key LIKE 'FM-DEF-%'),
       count(*) FILTER (WHERE seed_key LIKE 'FM-DEF-%' AND is_deleted), count(*)
FROM public.pms_forms_master;
```

### 4. Full 128-identity manifest: count each seed key and verify UUIDs

Expected 128 result rows, each `uuid_present = true`, `seed_key_count = 1`,
`seed_key_uuid_matches = true` and `status = OK` on unmodified seed keys. Deleted
rows count as present. `UUID present; seed key edited (preserved)` is not a missing
identity and must not be auto-corrected. Missing UUIDs and keys now owned by other
UUIDs require investigation. Names, business codes, approvals and timestamps are
intentionally not compared to factory defaults because customer edits are valid.
Compare the expected_uuid/actual_uuid pairs across shore and vessel outputs;
integer IDs and locally generated timestamps need not be equal.

```sql
WITH expected(entity, seed_key, expected_uuid) AS (
  VALUES
    ('pms_form_groups', 'FG-DEF-A', '4002e345-54db-5909-b85b-0a2b0e1b4311'),
    ('pms_form_groups', 'FG-DEF-B', '1f0032e2-deb9-510c-a936-3f65851ae283'),
    ('pms_form_groups', 'FG-DEF-C', 'd3d69b94-2c2f-59cc-a268-2b141dd3dfe1'),
    ('pms_form_groups', 'FG-DEF-D', 'aeef5cd2-5cb0-56c9-a548-1d03fb9995eb'),
    ('pms_form_groups', 'FG-DEF-E', 'ff931f5d-bfb0-5568-8c79-4417a092f257'),
    ('pms_form_groups', 'FG-DEF-F', '1d02e03c-d8ab-50d2-9562-aafadccc5bbf'),
    ('pms_form_groups', 'FG-DEF-G', '80cc6321-9936-5a31-ba40-76d90232da98'),
    ('pms_form_categories', 'FC-DEF-A-01', '11745851-dbde-5d05-a412-236122466839'),
    ('pms_form_categories', 'FC-DEF-A-02', 'c5b3883a-21e6-54ee-bfc3-21c620dd7791'),
    ('pms_form_categories', 'FC-DEF-A-03', '90c2bfde-3bb8-59da-9027-c0ac81aaf9b2'),
    ('pms_form_categories', 'FC-DEF-A-04', 'a67023f1-dd9b-574c-8ae0-aff07a5b8881'),
    ('pms_form_categories', 'FC-DEF-A-05', '80451f6c-2b92-506c-bf76-087876ce5a49'),
    ('pms_form_categories', 'FC-DEF-B-01', '5bf5cc13-be9c-565e-a0da-e0eb8c07242d'),
    ('pms_form_categories', 'FC-DEF-B-02', 'da26a47e-c724-5064-9229-f3634d0594e6'),
    ('pms_form_categories', 'FC-DEF-B-03', '68a67f93-4109-5e18-a410-b2975f568578'),
    ('pms_form_categories', 'FC-DEF-B-04', '3edd6680-1d4b-5748-b38f-a543751e0aac'),
    ('pms_form_categories', 'FC-DEF-B-05', 'abf64a51-4f35-5daf-a0cc-04abdfdc10e5'),
    ('pms_form_categories', 'FC-DEF-B-06', '15b44d71-9111-5fae-ba1f-0a135765a527'),
    ('pms_form_categories', 'FC-DEF-B-07', 'acfd1e68-bdf5-54a2-9311-8b779b648cb9'),
    ('pms_form_categories', 'FC-DEF-B-08', '0afee4b3-2c0c-58ab-b2f5-6fb012fb5001'),
    ('pms_form_categories', 'FC-DEF-C-01', 'd7de1d65-662b-5486-b758-c4553ba3987c'),
    ('pms_form_categories', 'FC-DEF-C-02', '0db9db5d-3c89-549f-8a22-c4251421d1d1'),
    ('pms_form_categories', 'FC-DEF-C-03', '5f1e88a1-7c78-5e31-97b3-28e342b64e4b'),
    ('pms_form_categories', 'FC-DEF-C-04', '5ae488f0-d8f9-584b-94e9-c143402a72b6'),
    ('pms_form_categories', 'FC-DEF-C-05', '4cb4418f-3988-5fd5-9fc6-d5bc323ce755'),
    ('pms_form_categories', 'FC-DEF-C-06', '38c8df0f-069f-53da-b2db-5135665e8266'),
    ('pms_form_categories', 'FC-DEF-C-07', '860eaa88-6bfe-5480-8ec3-ad4e43af9466'),
    ('pms_form_categories', 'FC-DEF-C-08', 'e236f6a3-8496-5bb8-8d34-33cdf1614a2c'),
    ('pms_form_categories', 'FC-DEF-C-09', 'eb409d2e-37b7-5dc6-83e4-6d4a8afe000d'),
    ('pms_form_categories', 'FC-DEF-C-10', '6e3a57b2-be19-5407-a13c-19cf07a0afc0'),
    ('pms_form_categories', 'FC-DEF-C-11', '817ecd51-c9b9-555b-99d0-4cf9e32bb211'),
    ('pms_form_categories', 'FC-DEF-D-01', '0d1c6fef-eae4-52e6-bc09-517e2c4762d4'),
    ('pms_form_categories', 'FC-DEF-D-02', '139b81a4-3083-5f7b-ab19-e7f8de80189f'),
    ('pms_form_categories', 'FC-DEF-D-03', '082cbda8-b312-580d-9373-d3778def56f7'),
    ('pms_form_categories', 'FC-DEF-D-04', 'fc381ad9-427f-5199-bb75-176e486c3400'),
    ('pms_form_categories', 'FC-DEF-D-05', '29dc6709-755d-5a67-ab57-2af6c91e3925'),
    ('pms_form_categories', 'FC-DEF-D-06', '5782bba9-0ed3-5f56-b8af-52778ff73c7a'),
    ('pms_form_categories', 'FC-DEF-D-07', 'abd51e6d-9b06-58e8-9982-c0dbfa51ced9'),
    ('pms_form_categories', 'FC-DEF-D-08', '05be694d-aec9-57ca-a40a-fca1b22b22bc'),
    ('pms_form_categories', 'FC-DEF-D-09', '560a5b0b-b349-5da4-ba67-6ae1d5804e00'),
    ('pms_form_categories', 'FC-DEF-D-10', '649f13de-793c-57b0-95eb-cee90586f3bc'),
    ('pms_form_categories', 'FC-DEF-E-01', '6b7e8f5e-3396-5440-a1a6-845ae903989b'),
    ('pms_form_categories', 'FC-DEF-E-02', '1b8d3447-db1f-5edc-9262-391cfdd7941d'),
    ('pms_form_categories', 'FC-DEF-E-03', 'abc543ab-df0c-58b0-bb56-2573b82fa4b5'),
    ('pms_form_categories', 'FC-DEF-E-04', 'b3f4b68f-7832-5b87-b966-28d7c215dddf'),
    ('pms_form_categories', 'FC-DEF-E-05', '3c1d241c-67df-54f5-8369-e650101bfc0a'),
    ('pms_form_categories', 'FC-DEF-E-06', 'fb18f8bc-45e8-5dec-81b2-a1268e83896f'),
    ('pms_form_categories', 'FC-DEF-E-07', '589e5cbf-48ba-5b73-9861-4ef6916ddcb4'),
    ('pms_form_categories', 'FC-DEF-E-08', '70ff3f04-898e-5d73-af7a-71f8706bafde'),
    ('pms_form_categories', 'FC-DEF-E-09', 'b6e10c55-bf7c-5c58-8d3c-ba7885c39aa2'),
    ('pms_form_categories', 'FC-DEF-F-01', '771e2ce4-f54c-5014-ad56-5a23f0914c1c'),
    ('pms_form_categories', 'FC-DEF-F-02', 'dd711e8a-5184-5380-9093-bfc809279986'),
    ('pms_form_categories', 'FC-DEF-F-03', 'c99609d4-bb1f-50a1-be74-f3a3f2f6ccb9'),
    ('pms_form_categories', 'FC-DEF-F-04', 'ad007d98-86f6-5059-9a56-b496d4cb2a2e'),
    ('pms_form_categories', 'FC-DEF-F-05', '3c0c3c8d-fdb2-5e4a-b4be-df1c05d0d56f'),
    ('pms_form_categories', 'FC-DEF-F-06', 'bd6b6e34-2c17-5b95-ba4a-42052e6101a7'),
    ('pms_form_categories', 'FC-DEF-F-07', 'b3351685-de22-5b94-8825-ca69871fbf29'),
    ('pms_form_categories', 'FC-DEF-F-08', '754043a4-c5cd-5c7b-9311-6f18b2027854'),
    ('pms_form_categories', 'FC-DEF-F-09', '6dcffe9a-ff03-5931-9ac9-7d67dbfce45a'),
    ('pms_form_categories', 'FC-DEF-G-01', 'c115b439-0ff8-55b2-9b8c-fc135df07a40'),
    ('pms_form_categories', 'FC-DEF-G-02', 'fc319cf9-05a1-55e4-8ee6-26f97f30d29a'),
    ('pms_form_categories', 'FC-DEF-G-03', '407dc1b3-bd24-5237-9137-94966edf6a0d'),
    ('pms_form_categories', 'FC-DEF-G-04', '684d2581-6f48-5ae9-a576-dfd54ff164ae'),
    ('pms_form_categories', 'FC-DEF-G-05', '7d26183a-2f79-5989-80fd-c2e0bd7148b9'),
    ('pms_forms_master', 'FM-DEF-001', '84a50f13-9656-5920-bc24-725ba86e7d62'),
    ('pms_forms_master', 'FM-DEF-002', 'dcabbb2d-d2d1-5ad0-b202-e414483079ef'),
    ('pms_forms_master', 'FM-DEF-003', '1c3ead75-e894-56bf-9413-6f8f8945043b'),
    ('pms_forms_master', 'FM-DEF-004', 'e743c94e-6e16-5d70-adbc-1d2fb7d0f799'),
    ('pms_forms_master', 'FM-DEF-005', '01b0fb2d-a528-58b2-995f-ca7f816c9701'),
    ('pms_forms_master', 'FM-DEF-006', '0c88ee7a-d125-5606-ad3c-43d4e0115428'),
    ('pms_forms_master', 'FM-DEF-007', '043a8e22-40b7-5fb7-8131-7074e395a8ce'),
    ('pms_forms_master', 'FM-DEF-008', '4021aedd-33de-5180-bab9-f543d879e2c6'),
    ('pms_forms_master', 'FM-DEF-009', '331e0969-3026-57c4-8e5b-f883534cffb5'),
    ('pms_forms_master', 'FM-DEF-010', 'bdbd24ee-e5e6-53c1-8046-bfd736437f04'),
    ('pms_forms_master', 'FM-DEF-011', 'c3da8616-0a4f-5a8e-ac78-0389da0897d4'),
    ('pms_forms_master', 'FM-DEF-012', '3a0336e7-f929-5408-9814-5f9b516eb5c8'),
    ('pms_forms_master', 'FM-DEF-013', 'a0b963ad-661d-5a44-afc4-167767d1d4ca'),
    ('pms_forms_master', 'FM-DEF-014', '7ae88440-a83b-53f0-ab36-86e1d39a6418'),
    ('pms_forms_master', 'FM-DEF-015', '22b670fd-d0ca-5321-b661-97762c529117'),
    ('pms_forms_master', 'FM-DEF-016', '627fdd5f-252d-5e2b-8431-839c100c69da'),
    ('pms_forms_master', 'FM-DEF-017', '60acfa9f-ac74-5ddf-832b-d05dc28fdec9'),
    ('pms_forms_master', 'FM-DEF-018', '4dbc91e6-839f-583e-bc10-88e277c8419b'),
    ('pms_forms_master', 'FM-DEF-019', 'aa19af8b-8b9d-580f-bc90-d740859244e0'),
    ('pms_forms_master', 'FM-DEF-020', 'a1cf08ad-0942-5aa1-a113-936225fd2979'),
    ('pms_forms_master', 'FM-DEF-021', '5cfbc95c-81a3-5e7a-894a-5043a2a754b2'),
    ('pms_forms_master', 'FM-DEF-022', 'dd3f0632-0314-5ae0-bd04-63d34e587063'),
    ('pms_forms_master', 'FM-DEF-023', 'b11bcc5f-9a32-56fd-9846-1cc20ef97248'),
    ('pms_forms_master', 'FM-DEF-024', 'f85e5e51-bd78-5c15-901e-da7e31397740'),
    ('pms_forms_master', 'FM-DEF-025', 'f8813c30-3405-5cb3-b124-56b4fcbce6e1'),
    ('pms_forms_master', 'FM-DEF-026', 'b05fdb1d-a9cd-5757-be98-a13df7eb78ba'),
    ('pms_forms_master', 'FM-DEF-027', '9579a7a9-ef99-5abd-9aa0-30e3013999da'),
    ('pms_forms_master', 'FM-DEF-028', '5564403c-dfb5-5461-b0f4-dff62b3e7366'),
    ('pms_forms_master', 'FM-DEF-029', 'c34811ad-3896-57ca-b9c6-0e0ffcf2bb2f'),
    ('pms_forms_master', 'FM-DEF-030', 'f949d37c-3d82-5a7b-a844-e182f7645a40'),
    ('pms_forms_master', 'FM-DEF-031', '9d40226b-05e8-5361-86e2-bcf9cd0a42ed'),
    ('pms_forms_master', 'FM-DEF-032', '43b99161-2d90-5893-90e5-1a99a5544f3f'),
    ('pms_forms_master', 'FM-DEF-033', '7ffcb679-0dbc-56fb-8992-842ce27fefea'),
    ('pms_forms_master', 'FM-DEF-034', 'cb866bd1-a5f4-526f-9955-f1174342bca1'),
    ('pms_forms_master', 'FM-DEF-035', '4a00c045-6195-5f7a-8040-23d7874fe00a'),
    ('pms_forms_master', 'FM-DEF-036', '3aafc6af-394a-50c3-8a4d-d04c2b184cdf'),
    ('pms_forms_master', 'FM-DEF-037', '0465b350-7272-5f0e-9968-07ddceb13fe2'),
    ('pms_forms_master', 'FM-DEF-038', '1d1ceaf7-40f9-56d7-a817-b009e0673f10'),
    ('pms_forms_master', 'FM-DEF-039', 'a2b2625f-1c0d-5c03-8451-1df73dee658d'),
    ('pms_forms_master', 'FM-DEF-040', '9476bf9f-b4c6-5980-b9ee-178c6bc9460a'),
    ('pms_forms_master', 'FM-DEF-041', '333d0884-0d24-5cee-8ee3-a486f21aebda'),
    ('pms_forms_master', 'FM-DEF-042', 'ebe99ccf-9982-56a9-99f9-c89a18b32802'),
    ('pms_forms_master', 'FM-DEF-043', '7b642c25-350e-55c1-a468-e5ef5bc1423e'),
    ('pms_forms_master', 'FM-DEF-044', '5146b8f8-4421-5f8c-8423-b1ddaa05ba32'),
    ('pms_forms_master', 'FM-DEF-045', 'f716cc23-a8fb-58bf-982a-16bf2080016c'),
    ('pms_forms_master', 'FM-DEF-046', '3fe7e486-448a-5749-b3e7-79ab1ed7392b'),
    ('pms_forms_master', 'FM-DEF-047', 'daac3fb3-8261-54ec-b9a3-3f0d26b31dac'),
    ('pms_forms_master', 'FM-DEF-048', '69aa197f-b8ca-5f5b-afe8-5365e78893a5'),
    ('pms_forms_master', 'FM-DEF-049', '04279b4d-c075-549a-b015-e17c3920f9b2'),
    ('pms_forms_master', 'FM-DEF-050', 'a4317e41-9731-532f-986c-2ebc372d1344'),
    ('pms_forms_master', 'FM-DEF-051', 'f46e0c73-a877-5a06-95a8-34e9724f7843'),
    ('pms_forms_master', 'FM-DEF-052', 'd9ebd253-9766-543f-85eb-f2d7936dcb85'),
    ('pms_forms_master', 'FM-DEF-053', 'bc5f6f14-a961-56e2-8001-9431f7dea542'),
    ('pms_forms_master', 'FM-DEF-054', 'adbda3bf-26bc-5cbb-acb3-d8a339f24745'),
    ('pms_forms_master', 'FM-DEF-055', 'c96ccdeb-7840-5e3c-b100-32a791167cd2'),
    ('pms_forms_master', 'FM-DEF-056', '310ac769-8994-5e25-ae32-3108cc3f9f9b'),
    ('pms_forms_master', 'FM-DEF-057', 'df57eeaf-572a-5d64-9a42-eed6009ba1e3'),
    ('pms_forms_master', 'FM-DEF-058', 'b1709d0b-7439-5459-8e49-8f9c19c1e3cd'),
    ('pms_forms_master', 'FM-DEF-059', '1a322b0f-9dfd-5d75-92f3-34ff2eed5c20'),
    ('pms_forms_master', 'FM-DEF-060', '44d3fbf2-5c27-5932-a639-45991c73600f'),
    ('pms_forms_master', 'FM-DEF-061', '52b8722d-fa30-5d3c-946c-e4c61031834d'),
    ('pms_forms_master', 'FM-DEF-062', 'f5ca95b2-24ab-5ea9-951d-a3920c5934bc'),
    ('pms_forms_master', 'FM-DEF-063', 'fed67999-9f53-59a8-86a3-4835ea0f93e1'),
    ('pms_forms_master', 'FM-DEF-064', '3267e1ed-32a0-5b37-94cf-f9603f2ded35')
), actual AS (
  SELECT 'pms_form_groups'::text AS entity, seed_key, fguuid AS identity, is_deleted
  FROM public.pms_form_groups
  UNION ALL
  SELECT 'pms_form_categories', seed_key, fcuuid, is_deleted FROM public.pms_form_categories
  UNION ALL
  SELECT 'pms_forms_master', seed_key, fmuuid, is_deleted FROM public.pms_forms_master
)
SELECT e.entity, e.seed_key AS expected_seed_key, e.expected_uuid,
       a.identity AS actual_uuid, a.seed_key AS actual_seed_key, a.is_deleted,
       a.identity IS NOT NULL AS uuid_present,
       (SELECT count(*) FROM actual k WHERE k.entity = e.entity AND k.seed_key = e.seed_key) AS seed_key_count,
       EXISTS (SELECT 1 FROM actual k WHERE k.entity = e.entity
               AND k.seed_key = e.seed_key AND k.identity = e.expected_uuid) AS seed_key_uuid_matches,
       ARRAY(SELECT k.identity FROM actual k WHERE k.entity = e.entity AND k.seed_key = e.seed_key) AS seed_key_owners,
       CASE WHEN a.identity IS NULL THEN 'MISSING EXPECTED UUID'
            WHEN a.seed_key IS DISTINCT FROM e.seed_key THEN 'UUID present; seed key edited (preserved)'
            ELSE 'OK' END AS status
FROM expected e
LEFT JOIN actual a ON a.entity = e.entity AND a.identity = e.expected_uuid
ORDER BY e.entity, e.seed_key;
```

### 5. Duplicate codes, allocated category numbers, seed keys and UUIDs

Expected no rows. Checks include tombstones because allocated codes and seed keys
remain reserved. Healthy unique constraints should already prevent these cases.

```sql
SELECT group_code, count(*) AS copies, array_agg(fguuid ORDER BY fguuid) AS owners
FROM public.pms_form_groups
GROUP BY group_code HAVING count(*) > 1;

SELECT group_uuid, category_no, count(*) AS copies, array_agg(fcuuid ORDER BY fcuuid) AS owners
FROM public.pms_form_categories
GROUP BY group_uuid, category_no HAVING count(*) > 1;

SELECT form_id, count(*) AS copies, array_agg(fmuuid ORDER BY fmuuid) AS owners
FROM public.pms_forms_master
GROUP BY form_id HAVING count(*) > 1;

WITH catalogue AS (
  SELECT 'pms_form_groups'::text AS entity, seed_key, fguuid AS identity FROM public.pms_form_groups
  UNION ALL
  SELECT 'pms_form_categories', seed_key, fcuuid FROM public.pms_form_categories
  UNION ALL
  SELECT 'pms_forms_master', seed_key, fmuuid FROM public.pms_forms_master
)
SELECT entity, 'seed_key' AS key_type, seed_key AS key_value, count(*) AS copies
FROM catalogue WHERE seed_key IS NOT NULL
GROUP BY entity, seed_key HAVING count(*) > 1
UNION ALL
SELECT entity, 'uuid', identity, count(*) FROM catalogue
GROUP BY entity, identity HAVING count(*) > 1;
```

### 6. Broken/mismatched parents and active children of retired labels

Expected no rows. The first query checks structural orphans/mismatched parents;
the second diagnoses hierarchy state independently (an existing edited/deleted
row is never silently repaired by this migration). Include all rows when checking
structural links, not only active rows.

```sql
SELECT 'category_missing_group' AS issue, c.fcuuid AS child_uuid,
       c.group_uuid, NULL::text AS category_uuid
FROM public.pms_form_categories c
LEFT JOIN public.pms_form_groups g ON g.fguuid = c.group_uuid
WHERE g.fguuid IS NULL
UNION ALL
SELECT 'form_missing_group', f.fmuuid, f.group_uuid, f.category_uuid
FROM public.pms_forms_master f
LEFT JOIN public.pms_form_groups g ON g.fguuid = f.group_uuid
WHERE g.fguuid IS NULL
UNION ALL
SELECT 'form_missing_category', f.fmuuid, f.group_uuid, f.category_uuid
FROM public.pms_forms_master f
LEFT JOIN public.pms_form_categories c ON c.fcuuid = f.category_uuid
WHERE c.fcuuid IS NULL
UNION ALL
SELECT 'form_category_group_mismatch', f.fmuuid, f.group_uuid, f.category_uuid
FROM public.pms_forms_master f
JOIN public.pms_form_categories c ON c.fcuuid = f.category_uuid
WHERE c.group_uuid <> f.group_uuid;

SELECT 'active_category_deleted_group' AS issue, c.fcuuid AS child_uuid
FROM public.pms_form_categories c
JOIN public.pms_form_groups g ON g.fguuid = c.group_uuid
WHERE c.is_deleted = false AND g.is_deleted = true
UNION ALL
SELECT 'active_form_deleted_parent', f.fmuuid
FROM public.pms_forms_master f
JOIN public.pms_form_groups g ON g.fguuid = f.group_uuid
JOIN public.pms_form_categories c ON c.fcuuid = f.category_uuid
WHERE f.is_deleted = false AND (g.is_deleted = true OR c.is_deleted = true);
```

## Operator decision after checks

Save outputs per installation. Stop on prerequisites, unexpected identity owners,
duplicate keys, structural orphans or pending earlier migrations. Do not edit
historical migrations, delete rows, reset checkpoints or insert history manually.
The checklist does not itself establish absence of newly created audit/sync logs;
193's SQL contains no such writes. Compare appropriately captured pre/post logs
during a separately approved rollout if runtime evidence is required.

Owner approval is still required for migration execution, workflow restart and
marking this implementation task complete. No live shore/ship pilot was performed.
