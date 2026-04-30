# Sync Apply Pipeline — Defect Report

**Source log:** `attached_assets/Pasted-2-SAIL-Technical-App-SyncEngine-Settings-loaded-from-DB_1777538943117.txt`
**Run:** Batch `424331d2-4ebf-4bcb-b190-dc269c76d9cf`, instance `SHIP-Vessel 5`, vessel `7446783c-841a-11ed-aa7c-7003bca91a86`, shore `https://dev.sl-sail.com/technical/api`, sync completed `2026-04-30T08:41:21.595Z`.
**Mode:** read-only diagnostic — no code changes made.

---

## 1. Executive summary

Five distinct defects in the sync apply path are visible in this run. Push (121 records) succeeded; pull received 4,132 records but **254 row-level applies failed**. Three of the five defects share a single root cause (the wrong predicate on one line: `server/modules/sync/oneWayApplier.ts:152`). One defect cascades from another. Two are diagnostic-pipeline issues (under-counted summary, errors not persisted).

Key new finding versus prior turns: the bug is **fully on the ship side** — direct shore-DB inspection confirms `id` values are present and non-null on the wire. The ship strips them with a too-broad rule.

| # | Defect | Severity | Rows in this run | Fix locality |
|---|---|---|---|---|
| A | `id` stripped for tables whose PK has no default | High | 50 | One predicate in `oneWayApplier.ts` |
| B | `adm_role_menu_access` FK cascade from A | High | 203 | Resolves automatically once A is fixed; +ordering hardening |
| C | `jobs` row 93 — JSON coercion gap | Med (data loss) | 1 | Same schema-aware helper as A |
| D | `apply errors during pull` counter under-reports by 13× | Low (cosmetic) | 0 | Counter logic in `executePull` |
| E | Per-row errors fail to persist (`Batch … not found`) | Med (diagnostics) | 0 | Storage call needs correct DB / row pre-create |

---

## 2. Verbatim log excerpts being explained

```
[OneWayApplier] 1 errors applying jobs:
  - row 93: invalid input syntax for type json

[OneWayApplier] 17 errors applying admn_role_master:
  - row 0..16: null value in column "id" of relation "admn_role_master" violates not-null constraint

[OneWayApplier] 33 errors applying adm_menumaster_ac:
  - row 0..32: null value in column "id" of relation "adm_menumaster_ac" violates not-null constraint

[OneWayApplier] 203 errors applying adm_role_menu_access:
  - row 0..202: insert or update on table "adm_role_menu_access" violates
    foreign key constraint "adm_role_menu_access_role_ruid_fkey"

[SyncEngine] Pulled 4132 records, 0 conflicts
[SyncEngine] 19 apply errors during pull        ← actual sum is 254
[SyncEngine] Failed to store errors in batch: Batch 424331d2-… not found
```

---

## 3. Defect A — `id` is stripped for tables whose PK has no default

### Symptom

50 rows fail with `null value in column "id" … violates not-null constraint`, split as 17 (`admn_role_master`) + 33 (`adm_menumaster_ac`).

### Direct evidence from the shore database

Queried this Repl's DB (which is the shore at `dev.sl-sail.com`):

| Table | Row count on shore | Rows with `id IS NULL` | id range |
|---|---|---|---|
| `admn_role_master` | 16 | **0** | 1 → 16 |
| `adm_menumaster_ac` | 33 | **0** | 1 → 33 |
| `adm_role_menu_access` | 203 | **0** | 2 → 549 |

The shore exports rows verbatim with `SELECT * FROM "<table>"` (`server/modules/sync/service.ts:493-509` — `gatherOneWayShoreRows`). No `id` is null on the wire.

### Schema shape (from `information_schema.columns`)

| Table | data_type | nullable | default | identity_generation |
|---|---|---|---|---|
| `admn_role_master` | integer | NO | *(none)* | *(none)* |
| `adm_menumaster_ac` | integer | NO | *(none)* | *(none)* |
| `adm_role_menu_access` | integer | NO | *(none)* | **ALWAYS** |

Cross-checked against Drizzle definitions in `shared/schema.ts`:
- `admn_role_master` line 3712: `id: integer("id").primaryKey()` — no default
- `adm_menumaster_ac` line 3737: `id: integer("id").primaryKey()` — no default
- `adm_role_menu_access` line 3763: `id: integer("id").primaryKey().generatedAlwaysAsIdentity()`

### Root cause

`server/modules/sync/oneWayApplier.ts:152` (inside `buildInsertParts`):

```typescript
if (key === 'id' && typeof value === 'number') continue;
```

Predicate is too broad. It was clearly added to fix the cancelled-Task-#132 identity error on `adm_role_menu_access` (where Postgres rejects explicit values for `GENERATED ALWAYS AS IDENTITY`), but it now fires for **every** table — including the two whose `id` has no default. Stripping the value forces the INSERT to fall back to a column default that doesn't exist → `null value in column "id"`.

### Behavioural truth table

| Wire `id` | Rule fires? | INSERT shape | Postgres reaction |
|---|---|---|---|
| `1` (number), table = `admn_role_master` | yes | omits id | NOT NULL violation ✗ |
| `1` (number), table = `adm_menumaster_ac` | yes | omits id | NOT NULL violation ✗ |
| `2` (number), table = `adm_role_menu_access` | yes | omits id | identity assigns; INSERT succeeds (then FK fails — see Defect B) |

### Blast radius across the sync universe

Tables in `shared/syncConfig.ts` that are vulnerable to the same rule:

| Table | In sync config? | At risk? |
|---|---|---|
| `admn_role_master` | yes | **yes** |
| `adm_menumaster_ac` | yes | **yes** |
| `admn_role_acess` (note: typo, distinct table) | no | not synced |

Only **two** synced tables today. Adding a third such table to the sync config in future would silently break it the same way unless the rule is corrected.

### Fix scope

Replace the unconditional rule with schema-aware logic. At first touch (cached per table) read `pg_attribute.attidentity` + `information_schema.columns.column_default` and decide:

- `attidentity = 'a'` (GENERATED ALWAYS AS IDENTITY) → strip `id`, optionally append `OVERRIDING SYSTEM VALUE`.
- `column_default IS NOT NULL` (serial / sequence / explicit default) → strip is optional; both work.
- otherwise → **always pass `id` through**, including null/string values, and let real errors surface as themselves.

Touch-points:
- `server/modules/sync/oneWayApplier.ts:122-161` (`buildInsertParts` and `buildUpdatePairs`)
- New helper, e.g. `getColumnMeta(tableName): Promise<Map<columnName, { isIdentityAlways, hasDefault, dataType }>>` with module-level cache.

---

## 4. Defect B — `adm_role_menu_access` 203 FK violations (cascade from A)

### Symptom

```
- row 0..202: insert or update on table "adm_role_menu_access"
  violates foreign key constraint "adm_role_menu_access_role_ruid_fkey"
```

### Cause

`shared/schema.ts:3764`:

```typescript
roleRuid: text("role_ruid").notNull().references(() => admnRoleMaster.ruid),
```

The new `Clearing seeded RBAC data before sync apply...` step (in the deployed ship build, not yet in this workspace) wipes the ship's local `admn_role_master`. Defect A then prevents re-population — 0 of 16 rows insert. By the time `adm_role_menu_access` rows are applied, the FK target table is empty, so every `role_ruid` references a non-existent parent → 203/203 fail.

### Resolution

Fixing Defect A makes Defect B disappear deterministically: 16 ruids appear → 203 access rows resolve.

### Defence-in-depth (recommended even after A)

`server/modules/sync/syncEngine.ts:317-324` iterates `pullData.oneWayRows` in shore-return order with no FK awareness. Today shore happens to return parents before children, but nothing enforces it. Suggested:

1. Topologically sort the per-batch `oneWayRows` array using FK relationships derivable from `syncConfig` (or add an explicit `applyPriority` field to each table config).
2. Apply in dependency order so a future shore-side reorder cannot re-trigger this cascade.

---

## 5. Defect C — `jobs` row 93: invalid input syntax for type json

### Symptom

```
[OneWayApplier] 1 errors applying jobs:
  - row 93: invalid input syntax for type json
```

### Cause

`oneWayApplier.ts` builds INSERT/UPDATE values with `values.push(value ?? null)` for every column type (lines 122-161). For `json`/`jsonb` columns, Postgres requires either valid JSON literal text or a properly cast value. When shore sends a column like `attachments: ""` (empty string), or any pre-stringified scalar that isn't valid JSON, Postgres rejects the row.

Same root pattern as the cancelled Task #132 (provisioning import) and the `applyFieldLog` CMH error from the prior log. **Three** code paths now need the same JSON coercion helper:

1. `server/modules/sync/provisioningService.ts:179-301`
2. `server/modules/sync/oneWayApplier.ts:122-161`
3. `server/modules/sync/syncEngine.ts:357-393` (`applyFieldLog`)

### Fix scope

Reuse the same `getColumnMeta(tableName)` helper from Defect A. For columns where `data_type IN ('json','jsonb')`:

- If value is `null` → pass through as `NULL`.
- If value is `string` → trust it as JSON literal text and pass through (or `JSON.parse` to validate; on failure store as the SQL `null` and surface the error).
- Otherwise → `JSON.stringify(value)` and pass.

---

## 6. Defect D — Apply-error counter under-reports

### Symptom

```
[SyncEngine] 19 apply errors during pull
```

Per-table breakdown sums to **1 + 17 + 33 + 203 = 254**. Counter is off by 13× and actively misleading.

### Cause

The `19 apply errors during pull` line does not exist in this workspace's `server/modules/sync/syncEngine.ts:299-310` — it's an addition in the deployed ship build that was not merged back. Most likely it sums `console.error` (whole-table) failures only, or sums `applyFieldLog` errors, or caps at first-N-per-table — none of which include the per-row `result.errors[]` arrays returned by `applyOneWayRows`.

### Fix scope

In `executePull`, sum:
```
sum_oneWay = Σ result.errors.length over all applyOneWayRows() calls
sum_fieldLog = count of applyFieldLog() throws
total = sum_oneWay + sum_fieldLog
```
Log `total`. Five-line correction.

---

## 7. Defect E — Per-row errors are not persisted

### Symptom

Final line of the run:

```
[SyncEngine] Failed to store errors in batch: Batch 424331d2-4ebf-4bcb-b190-dc269c76d9cf not found
```

### Cause

The deployed ship build added a step that tries to persist the per-row error list keyed by `batch_uuid`, but the batch row doesn't exist in the local DB. Most likely paths:

- The batch is created on the **shore** at `/sync/initiate` (`server/modules/sync/service.ts` writes to shore's `sync_batches`); the ship doesn't get a mirrored row locally.
- The persist call is using the wrong DB handle, or no local `sync_batches` row was created at sync start.

### Effect

Every console error printed in this run lands **only on the live tail**. After the shell scrollback rolls over, all 254 row-level error messages are lost. The diagnostic logging improvement only sticks if it's persisted.

### Fix scope

Either:
1. On the ship side at sync start, INSERT a local batch row with the same UUID before any apply runs (so the persist step finds something to update), and write errors to the local `sync_batches.last_errors` (or a `bulk_import_errors`-like child table).
2. Or change the persist step to push errors **back to the shore** as part of `/sync/complete`, so the shore's batch row absorbs them.

Option 1 is more defensive (errors persist even if the shore link drops mid-run); option 2 centralises forensics on shore. Either is fine; pick one and remove the dead path.

---

## 8. Cause-and-effect map

```
oneWayApplier.ts:152  predicate too broad
        │
        ├──► admn_role_master:        17 NOT-NULL errors  (Defect A)
        ├──► adm_menumaster_ac:       33 NOT-NULL errors  (Defect A)
        └──► adm_role_menu_access:    203 FK errors       (Defect B — cascade)

oneWayApplier.ts:122-161  no JSON coercion
        └──► jobs row 93:             1 JSON error        (Defect C)

executePull counter:      sums wrong things
        └──► "19 apply errors"        vs actual 254       (Defect D)

batch persistence:        local row missing
        └──► "Batch … not found"      → errors lost       (Defect E)
```

---

## 9. Recommended fix order

1. **Defect A** first — single-line predicate change unblocks RBAC (50 rows), then Defect B disappears with it (203 rows). Net 253/254 row failures resolved.
2. **Defect E** — without persistence, every future investigation costs another live capture.
3. **Defect C** — same `getColumnMeta` helper introduced for A; covers the third place the JSON gap appears (subsumes the cancelled Task #132 scope).
4. **Defect D** — five-line counter fix, opportunistic while in `executePull`.
5. **Defence-in-depth ordering** for Defect B — topological sort of `oneWayRows` per batch.

Combined diff is roughly:
- 1 helper module (~80 LOC) — `getColumnMeta` with caching.
- ~30 LOC change in `oneWayApplier.ts` (predicates + value coercion).
- ~10 LOC change in `applyFieldLog`.
- ~10 LOC change in `provisioningService.ts` (use the helper instead of its current bespoke logic).
- ~5 LOC change for the counter.
- ~20 LOC for batch row pre-create.

---

## 10. Open questions and small mysteries

1. **Shore has 16 `admn_role_master` rows but ship reports 17 errors.** Either the shore is sending one row twice in the pull payload, or the ship's per-row counter is double-counting one row. Doesn't block the fix (both interpretations resolve to zero once Defect A lands), but worth a single-row trace before closing.
2. **Workspace vs deployed ship code drift.** The strings `Clearing seeded RBAC data before sync apply...`, `RBAC cleanup complete`, `[OneWayApplier] N errors applying T:`, `... and N more`, `apply errors during pull`, and `Failed to store errors in batch:` exist in the run log but **do not appear** in this workspace's `server/modules/sync/`. Whoever holds the deployed ship branch should push it back to this repo before any of the fixes above are reviewed — otherwise we'll be patching one version and shipping another.
3. **`component_maintenance_history` BOTH_EDITABLE vs immutability trigger.** Not in this run's log, but flagged in the prior session. Once Defect C is fixed, the immutability trigger will surface as the next visible failure for any CMH field log. Worth resolving the policy contradiction (`shared/syncConfig.ts:891-902` says BOTH_EDITABLE; `server/initDb.ts ensureMaintenanceHistoryImmutability` enforces no-UPDATE) before that error appears.

---

## 11. What the log does **not** indicate

To bound the scope precisely:

- **Push is fine** — 121 records, no errors.
- **Conflict detection is fine** — 0 conflicts; no `[Conflict]` lines.
- **File sync is fine** — `0 processed, 0 failed, 0 bytes`.
- **Shore connectivity is fine** — no `[SyncApi]` retries, no timeouts.
- **3,878 records pulled successfully** (4,132 − 254). Bulk apply works.

This is purely a **data-application** problem on the ship side. Sync transport, batching, and conflict logic are all healthy.
