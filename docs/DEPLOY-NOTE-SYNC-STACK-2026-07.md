# DEPLOY NOTE — accumulated sync/PMS stack (as of 2026-07-24)

**For: Nilesh.** One deploy covering everything merged to `replit_dev` since the last shore
deploy. Nothing in this stack has been validated in the field yet — that is the point of the
verification checklist in §4.

**Order of operations: DEPLOY → VERIFY IN FIELD → *then* Phase 1 tri-state (migration 144).**
Tri-state is the largest change of the programme and is deliberately NOT in this stack. Building
it on top of eight unverified changes would mean debugging nine at once.

---

## 0. STEP ZERO — TAKE A BACKUP. NON-NEGOTIABLE.

Eleven migrations touch core tables. Do this **before** deploying anything, on **shore and on
every ship in scope**.

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl > ~/predeploy_$(hostname)_$(date +%Y%m%d_%H%M).sql
ls -lh ~/predeploy_*.sql          # confirm a non-trivial size, not 0 bytes
tail -5 ~/predeploy_*.sql          # last line should be a normal SQL statement, not a truncation
```
Keep it **off the app server's own disk** (copy to your machine or object storage). A backup on a
box you may have to rebuild is not a backup.

### ⚠️ DO NOT RELY ON THE AUTOMATIC STARTUP BACKUP
The app takes a `pg_dump` at startup — **but it SKIPS if any backup file under `backup/` is less
than 24 hours old** (that guard exists because PM2 restarts were producing ~1.25 GB per boot).
On a deploy day the app has usually restarted at least once already, so the automatic backup will
be **skipped** and the newest file may predate the day's work. To force a fresh automatic one,
delete the recent file from `backup/` first. **The manual dump above is the one to trust.**

---

## 0b. DEPLOY ORDER AND SCOPE

**SHORE FIRST, then ships.** Shore is the authoritative side and the responder; sync is always
ship-initiated. An old ship against a new shore is a validated-compatible skew (MT deploy-skew
readiness, 2026-07-11), so shore can lead safely. The reverse — new ship against old shore — is
NOT covered by that validation.

**⚠️ SCOPE MUST BE FILLED IN BEFORE THIS GOES OUT — I cannot determine it from the code:**

| Instance | In scope this round? |
|---|---|
| Shore | ☐ |
| Frontier Venture | ☐ |
| _other WK vessels_ | ☐ |
| rsms | ☐ |
| epic | ☐ |

**Open question for Ghazi/Nilesh:** migration 138's watch item names **rsms** and **epic**. State
plainly whether they are in this round or whether only the WK ships are. Getting 138's correction
counts watched on an instance nobody deployed to is a wasted check; deploying to one nobody
briefed is worse.

**Remember: the §12 recovery freeze lifts PER VESSEL** (see §5). A vessel not in this round stays
frozen.

---

## 0c. TIMING — pick a low-usage window

**Migrations run at startup, before the app serves any request.** The vessel's PMS is unavailable
for the whole run.

- Most of the eleven are sub-second (DDL, seeds, small backfills).
- **138 is the slow one** — it repairs real drifted spares/ROB data, so its duration scales with
  how much drift that instance actually has. This is the step to plan around.
- The pre-deploy `pg_dump` itself can take minutes on a large DB (~1.25 GB dumps have been seen).

**What "still working" looks like:** the log advances with one `✅ Migration <id>: N statements
applied, M skipped` line per file. Progress is per-migration, so a big one can sit quiet for a
while — that is normal.

**What "hung" looks like:** no new migration line for many minutes **and** no CPU/IO on the
Postgres process. Check for a blocking lock before assuming a hang:
```sql
SELECT pid, state, wait_event_type, wait_event, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle';
```

**Do not kill the process mid-migration.** See §0d for why that is expensive.

---

## 0d. IF A MIGRATION FAILS — rollback / recovery

**Verified behaviour of the runner:**

1. Benign errors are **skipped and logged**, not fatal: `42P07` (table exists), `42701` (column
   exists), `42704` (object missing), `42P01` (undefined table), `42830` (no unique constraint).
2. **Any other error → the runner THROWS and the entire migration run ABORTS.** Startup fails and
   the app does not serve. Later migrations in the list do **not** run.
3. The failing migration is **NOT marked complete** in `schema_migrations`, so a restart
   re-executes it **from its first statement**.
4. **Whether the DB is left half-migrated depends on the file:**

| Atomic (single batch — all-or-nothing) | Per-statement (**can half-apply**) |
|---|---|
| 137, 139, 141, 142 | 0064, 136, 138, 140, 143, 145, 146 |

**RECOVERY — forward is the default, restore is the exception:**

- **Preferred: fix the cause and restart.** Every migration in this stack is written idempotent,
  and a half-applied per-statement file re-runs cleanly from the top (already-applied statements
  hit the benign-skip codes above). This is the normal path.
- **Restore from the §0 backup only if** the failure is not understood, or a half-applied 138 has
  written repair rows you cannot reason about. Data damage — not a failed DDL — is what justifies
  a restore.
- **Do not hand-edit `schema_migrations` to mark a failed migration complete.** That hides a
  half-applied state and the next deploy inherits it.
- **Send the failing statement and error before deciding.** The runner prints
  `❌ Migration <id> failed at statement: <message>` — that line is what determines whether it is
  forward-fixable.

---

## 1. MIGRATIONS — run order

The runner keys by **full filename** and sorts **lexicographically**, so `0064…` runs before
`136…`. This is the actual execution order:

| # | Migration | What it does |
|---|---|---|
| 1 | `0064_view_mode_migration` | Creates `view_modes_master` + `role_view_mode_mapping` tables (Task #324). |
| 2 | `136_shipskart_role_mappings` | UI-configurable many-to-one SAIL role → Shipskart role. Replaces the hardcoded map. |
| 3 | `137_company_approval_settings` | Singleton company approval policy; carries the **Superintendent-lock toggle** (default TRUE = today's behaviour). Synced shore→ship. |
| 4 | `138_repair_spare_location_stock_drift` | Repairs drift between legacy spares ROB columns and `spare_location_stock`. **⚠️ Renumbered from the fork's 136** — a DB that already ran it as `136_repair_…` re-runs it under the new filename; it is predicate-guarded, so that is safe. |
| 5 | `139_wo_completion_rh_reading_date` | Adds `wo_completion_rh` + `current_reading_date` (RH accuracy, Jeevan). |
| 6 | `140_seed_role_view_mode_mapping` | Seeds the view-mode tables. Behaviour-neutral: the seed IS the old hardcoded function, verbatim. |
| 7 | `141_sync_settings_timeout_backfill` | Backfills empty `sync_request_timeout_ms` → 60000. Root-cause fix for the FV outage. |
| 8 | `142_sync_field_log_failures` | Creates the durable LOST-field-log table. Local bookkeeping, never synced. |
| 9 | `143_drift_detector_failures_kind` | Extends that table with `kind`/`field_name`/`details`/`last_seen_at` + dedupe index, so drift findings share one operator list. |
| 10 | `145_deprecate_dead_sync_settings` | Marks `request_timeout_seconds` and `local_mode` DEPRECATED in their own description. Rows kept, not deleted. |
| 11 | `146_normalise_boolean_sync_settings` | Normalises boolean setting values to lowercase. |

**144 is RESERVED for Phase 1 tri-state — do not use it.**

All are idempotent; a second run is a clean no-op.

---

## 2. WHAT TO WATCH IN THE STARTUP LOG

These go to **PM2 stdout**, not `sync-diag`. Capture the first 200 lines after restart.

### 2.1 Counts to record (not errors — evidence)
- **Migration 138** — the ROB correction count. **Nilesh: an error here means STOP and send.**
  Watch `rsms` / `epic` in particular.
- **Migration 141** — how many rows backfilled to 60000. On a correctly-provisioned ship this
  may legitimately be 0 (the key is seeded non-empty); 0 is not a failure.
- **Migration 146** — how many boolean values normalised. **Expected: 0.** Every seed path
  already writes lowercase. A non-zero count means someone hand-edited or a UI posted a
  non-canonical value — record which key.

### 2.2 New log lines to confirm
- **Auto-sync effective state** (ship only) — **this is the line that settles the Frontier
  Venture auto-sync question**:
  ```
  [AutoSync] EFFECTIVE STATE — auto_sync_enabled=ON (raw "true"), interval=180min. Next tick in 180s, then every 180min.
  ```
  If it says `OFF`, it will also say `TICKS WILL NO-OP until this is enabled.`
- **Effective sync timeout + its source**:
  ```
  [SyncEngine] Settings loaded from DB — instanceId=…, shoreUrl=… (DB|env), localMode=false, requestTimeoutMs=60000 (DB|env|default), pushBatchSize=…
  ```
  If `requestTimeoutMs` shows below 60000 there will also be a `⚠️ … clamped` warning.
- **shore_url self-heal** — fires once if the DB value was blank and env resolved:
  ```
  [SyncEngine] 🩹 CONFIG SELF-HEAL: sync_settings.shore_url was EMPTY — persisted from env: "…". The DB value is authoritative from now on; change it there, not in .env.
  ```
  **After this, edit the URL in the DB, not `.env`.**
- **Fatal config** — if it appears, sync will refuse to run every cycle (by design; the app
  still serves the PMS):
  ```
  [SyncEngine] ❌ FATAL CONFIG: shore_url is EMPTY … Refusing to run sync in silent local mode.
  ```
- **Scheduler start** (ship): `[AutoSync] Scheduler started — will run every N minutes`.
  Its absence means the scheduler never started — check `[AutoSync] Shore instance detected`.

---

## 3. FIELD-VISIBLE BEHAVIOUR CHANGES — support must expect these

These are intended, not bugs. Brief support before deploy.

1. **View-mode gate (0064 + 140) — the one most likely to generate a ticket.**
   **A role created AFTER the seed is BLOCKED at the ViewModeGate until an admin maps it.**
   Fail-closed is deliberate. Fix: Admin → map the role to a view mode. Existing roles are
   seeded and unaffected.
2. **Spares location — fail-closed error.** Spares operations against a location that does not
   resolve now raise a clear error instead of silently writing to a wrong/absent location.
3. **Approval tier counts shift on RH jobs (139).** RH-driven work orders now compute their next
   cycle from the completion RH reading and their "RH Last Updated" from the current reading
   date. Tier/day-late counts on those jobs will legitimately differ from before.
4. **Superintendent lock (137)** ships enabled by default = today's behaviour. No change unless
   an admin turns it off.
5. **Sync conflicts now recorded on the SHIP too.** Rows appear in the vessel's Conflict Review
   screen that previously only ever appeared on shore. **No notifications are sent on the ship**
   — recording only, by decision. A ship's Conflict Review being non-empty is now normal.
6. **Sync settings screen**: `request_timeout_seconds` and `local_mode` now read DEPRECATED.
   Tuning them does nothing. The live timeout key is `sync_request_timeout_ms`.

---

## 4. VERIFICATION CHECKLIST — after deploy, in this order

Each step proves one fix is live. Stop and report if a step fails.

**A. Migrations applied**

Migrations are tracked in `schema_migrations.id`, and the id is the **full filename minus
`.sql`** (e.g. `143_drift_detector_failures_kind`) — not the bare number. Verified against the
runner, which does `id = sqlFile.replace('.sql', '')`.

```sql
SELECT id, applied_at FROM schema_migrations WHERE id ~ '^(0064|13[6-9]|14[0-3]|14[5-6])_' ORDER BY id;
```
**Expect exactly 11 rows** — `0064_view_mode_migration`, `136_shipskart_role_mappings`,
`137_company_approval_settings`, `138_repair_spare_location_stock_drift`,
`139_wo_completion_rh_reading_date`, `140_seed_role_view_mode_mapping`,
`141_sync_settings_timeout_backfill`, `142_sync_field_log_failures`,
`143_drift_detector_failures_kind`, `145_deprecate_dead_sync_settings`,
`146_normalise_boolean_sync_settings`. **No 144.**

Fewer than 11 means the run aborted partway — see §0d and check the log for
`❌ Migration <id> failed at statement`.

**B. Timeout fix is live** — startup log shows `requestTimeoutMs=60000`. Then:
```sql
SELECT setting_key, setting_value FROM sync_settings WHERE setting_key = 'sync_request_timeout_ms';
```

**C. Auto-sync state is answerable from the log** — the `EFFECTIVE STATE` line is present and
reads ON with the expected interval. **This is the Frontier Venture question.**

**D. Sync actually runs** — after the boot delay plus one interval:
```sql
SELECT trigger_type, outcome, created_at FROM sync_connectivity_log ORDER BY created_at DESC LIMIT 10;
```
Expect `auto` rows. `skipped_reentrant` repeatedly ⇒ stuck in-memory lock ⇒ restart the app.

**E. Un-swallow + drift surfaces exist and are readable**
```sql
SELECT kind, resolved, count(*) FROM sync_field_log_failures GROUP BY 1,2;
```
`GET /sync/drift` returns JSON. **Expect the first drift scan to report the two known
deliberate correctives** (`workOrderContextService` stuck-rejection, `repairRhTracking`) — those
are reported on purpose, not new bugs.

**F. Skip counters are visible** — `GET /sync/status` returns `fieldLogFailures` and
`insertLogSkips`. A non-zero `insertLogSkips.session` means old logs are being re-offered
somewhere — investigate before assuming it is benign.

**G. Both guards are live** — grep `sync-diag` after the first full cycle:
- `INSERT-LOG SKIP (terminal-ack)` — re-delivered creation log refused.
- `STALE-SKIP` — older incoming edit refused.
Neither appearing is fine on a quiet vessel; their *presence* proves the guards are running.

**H. Ship conflict rows** (new behaviour)
```sql
SELECT count(*) FROM sync_conflict_log;
```
on the SHIP. Previously always 0.

**I. Data integrity** — `npx tsx scripts/verify-data-integrity.ts` must show **ALL DATA INTACT**.

---

## 5. WHEN THE §12 RECOVERY FREEZE LIFTS

**The freeze on re-offer / `is_synced` reset / checkpoint rewind / dead-letter replay lifts ONLY
when BOTH of these are DEPLOYED AND RUNNING on BOTH the shore AND the specific vessel:**

- `eec60b923` — re-delivered INSERT-origin logs cannot overwrite live data
- `07d697f12` — per-field stale-skip symmetric across both directions

**Explicitly NOT sufficient:**
- ❌ Merged to `replit_dev` — code in git protects nobody.
- ❌ Deployed to shore only — the ship's PULL path was the unguarded one. **Shore-only deployment
  leaves the exact Frontier Venture failure path open.**
- ❌ Deployed to a different vessel — the freeze lifts **per vessel**.

Confirm with checklist item **G** (`INSERT-LOG SKIP` / `STALE-SKIP` reachable in `sync-diag`) on
**both** sides before running any recovery on that vessel. Until then the 52/39 stay untouched.

---

## 6. STILL OPEN — not closed by this deploy

- **Frontier Venture's auto-sync cause.** The seed audit disproved the case-sensitivity theory
  (every seed writes lowercase). Settle it with the `EFFECTIVE STATE` boot line after restart,
  plus `pm2 logs | grep AutoSync`.
- **True affected counts.** Both spreadsheet exports were capped at exactly 1000 of ~1987 rows,
  so 39 and 20 are FLOORS. Use a COUNT query, not a re-export.
- **The 5.5h timestamp bug** (`spares_history.timestampUTC`, `spare_component_links.linkedAt`)
  — separate task; historical rows are already wrong and need a data decision first.
