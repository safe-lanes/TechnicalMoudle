# DEPLOY NOTE — accumulated sync/PMS stack (as of 2026-07-24)

**For: Nilesh.** Everything merged since the last shore deploy, in one note.

**⚠️ This stack is on `replit_dev` (development). Production is a separate branch — nothing from
this week has reached a vessel yet.** It has to be promoted to production before any of it lands.

**Order: LOCAL PILOT → SHORE → ships (auto-pull) → VERIFY → *then* Phase 1 tri-state (mig 144).**
Tri-state is the biggest change of the programme and is deliberately NOT in this stack; building
it on top of eleven unverified migrations would mean debugging twelve things at once.

The value of this note is §1 (migrations), §2 (what to watch), §3 (behaviour changes support must
expect), §4 (verification) and §5 (the freeze condition). §0 is reminders only.

---

## 0. PRE-FLIGHT — three reminders, not instructions

1. **Run the local shore+vessel environment first.** Real vessels cannot be staged, so the local
   pair is the only pilot this stack gets. Work §4's checklist there before promoting to
   production — a fault caught locally costs nothing; the same fault reaches all three ships.
2. **Backup shore (all tenants) and all three vessel DBs.** One non-obvious gotcha:
   **the automatic startup `pg_dump` SKIPS when any file in `backup/` is under 24h old**, so on a
   deploy day it will usually not run. Take the dump manually, or clear `backup/` first.
3. **Low-usage window.** Migrations run before the app serves. **138 is the slow one** — it
   repairs real drifted ROB data, so it scales with how much drift that instance has. Progress is
   one `✅ Migration <id>` line per file; a big one going quiet is normal, so don't kill it.

---

## 0b. SCOPE AND ROLLOUT REALITY

**In scope this round — PMS/Technical is WK-only, 3 ships:**

| Instance | In scope |
|---|---|
| Shore (all tenants) | ✅ |
| Frontier Venture | ✅ |
| Pioneer Venture | ✅ |
| Gas Mia | ✅ |

**Shore first.** Shore is authoritative and sync is ship-initiated; old-ship/new-shore is a
validated-compatible skew (MT deploy-skew readiness, 2026-07-11). The reverse is not.

**⚠️ SHIPS AUTO-PULL PRODUCTION — THERE IS NO PER-SHIP HOLD.** Once this is on the production
branch, all three vessels take it on their own schedule, at different clock times, landing within
roughly a day. Consequences to plan around, because they are not optional:

- **You cannot stage vessel-by-vessel.** There is no "try it on Frontier Venture first". Promoting
  to production commits all three.
- **There is a ~1-day mixed-version window** — shore new, some ships new, some still old — and no
  control over the order. §5 depends on this.
- **The local pilot is therefore the only gate that exists.** It is doing the job that a staged
  vessel rollout would otherwise do.

---

## 0c. IF A MIGRATION FAILS — repo-specific behaviour worth knowing

Not general deploy mechanics — this is how *this* runner behaves, verified in the code:

- Benign codes are skipped and logged (`42P07` table exists, `42701` column exists, `42704`
  object missing, `42P01` undefined table, `42830` no unique constraint).
- **Any other error throws and ABORTS the whole run** — later migrations do not execute and the
  app does not start.
- The failing migration is **not** marked complete, so a restart re-runs it from statement one.
- **Half-applied state depends on the file:**

| Atomic (all-or-nothing) | Per-statement (**can half-apply**) |
|---|---|
| 137, 139, 141, 142 | 0064, 136, 138, 140, 143, 145, 146, **147** |

**Forward-fix is the default** — every migration here is idempotent, and a half-applied
per-statement file re-runs cleanly (already-applied statements hit the benign codes above).
**Restore from backup only** for an unexplained failure, or a half-applied 138 whose repair rows
you can't reason about. Never hand-edit `schema_migrations` to mark a failure complete — that
hides the half-applied state and the next deploy inherits it.

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
| 12 | `147_sync_field_log_retry_ladder` | Adds `sync_attempts` + `last_attempt_at` to `sync_field_log` (+ partial index). **Deletes the dead-letter that force-marked undelivered rows as synced — the Frontier Venture "71" loss path.** Nothing is abandoned any more; a persisted backoff ladder (1h/6h/24h/3d/7d, then every 7d forever) throttles retries instead. No backfill. |

**144 is RESERVED for Phase 1 tri-state — do not use it.**

**The build-identity marker is part of this stack** (no migration — code only). The promotion to
production must therefore include it, or §5's confirmation checks have nothing to read.

All are idempotent; a second run is a clean no-op.

---

## 2. WHAT TO WATCH IN THE STARTUP LOG

These go to **PM2 stdout**, not `sync-diag`. Capture the first 200 lines after restart.

### 2.1 Counts to record (not errors — evidence)
- **Migration 138** — the ROB correction count. **Nilesh: an error here means STOP and send.**

  🔴 **RUN THE PRE-FLIGHT FIRST — on every shore tenant DB and every ship, BEFORE deploying:**
  ```bash
  psql "$DATABASE_URL" -f migrations/preflight/138-preflight.sql
  ```
  138 treats `spares.location`/`location_2` + `rob_location_a/b` as the AUTHORITY and rebuilds
  `spare_location_stock` from them (statements 4–7). Statement 1 is the one exception: it reverses
  direction only where a ROB transaction corroborates the stock table. So where the legacy columns
  are stale and no evidence exists, 138 will overwrite correct stock with stale values.

  **Decision rule — read the `⚠_of_those_REDUCING_stock` column:**
  | Value | Action |
  |---|---|
  | **0** | Deploy freely. 138 will not reduce recorded stock on that instance. |
  | **non-zero** | **STOP for that instance.** List those spares, confirm the true ROB with the vessel, then deploy. 138 will write stock DOWN on those rows. |

  Record the per-vessel numbers — they are the before-picture for the correction counts in the log.
- **Migration 141** — how many rows backfilled to 60000. On a correctly-provisioned ship this
  may legitimately be 0 (the key is seeded non-empty); 0 is not a failure.
- **Migration 147** — after the FIRST sync, record the attempt distribution:
  ```sql
  SELECT sync_attempts, count(*) FROM sync_field_log WHERE is_synced = false GROUP BY 1 ORDER BY 1;
  ```
  **Expected: everything at 0** on a healthy vessel. Rows at 1–4 are retrying normally. Rows at
  **5+ are on the final 7-day tier — they are still being retried forever, but a human should look.**
  Also visible as `retryBacklog {total, stuck, maxAttempts}` on `GET /sync/status`.
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
- **Effective sync timeout + its source** — ⚠️ **NOT a startup line.** Pilot-verified: it is emitted
  by `loadSettings()` on the **first sync cycle**, so on a ship it appears ~3 min after boot (or
  after the first Sync Now), not in the boot banner:
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

## 3a. 🔴 SHORE AND SHIP POSTGRES MUST RUN IN UTC

**Confirmed UTC on all production instances (Ghazi, 2026-07-26) — so there is no issue today.
This is a standing constraint, not an action item.**

The ONE_WAY shore→ship gather filters `WHERE updated_at > $checkpoint`. `updated_at` is written by
the DB trigger (`NOW()`, DB clock); the checkpoint is written from JS `new Date()` through Drizzle,
which lands as UTC wall-clock. **On a UTC host those two agree exactly. On a non-UTC host they do
not** — measured on the IST pilot host: checkpoint `12:23:19` vs `started_at` `17:53:19` for the
same instant.

Direction of the failure matters:
- **UTC** → correct.
- **UTC+ (east, e.g. IST)** → checkpoint lands behind, ONE_WAY rows are **re-sent** — wasteful,
  self-correcting, no loss.
- **UTC− (west, e.g. Americas)** → checkpoint lands ahead, ONE_WAY rows are **silently skipped**:
  `components`, `jobs`, `admn_role_master`, `adm_role_menu_access`, `company_approval_settings`,
  `approval_workflow_config` can drop updates with no error.

**If a shore or vessel server is ever relocated to a non-UTC region, this must be resolved BEFORE
the move.** The field-log path is unaffected (it is `is_synced`-driven, not checkpoint-gated), so
the blast radius is ONE_WAY tables only. Tracked on the timestamp task; the fix is enforce-UTC
end-to-end (store and compare in UTC, convert at display), not a per-column patch.

Verify on each instance:
```bash
psql "$DATABASE_URL" -c "SHOW timezone;"
```

---

## 3b. ⚠️ DEPLOY LANDMINES — pilot-verified 2026-07-26

**1. `shore_url` MUST end with `/technical/api`.** Not just the host:port.
```
✅ http://<shore-host>:5000/technical/api
❌ http://<shore-host>:5000
```
Get this wrong and sync fails with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` —
the ship hit the SPA catch-all and parsed HTML. **The error names neither the setting nor the
URL.** This cost time in the pilot; it will cost more on a vessel. Check it before the first sync.

**2. `instanceId` is built from `vessels.id`, NOT `vessels.vuuid`.**
`provisioningService.ts:64,93` does `SELECT name, id AS code FROM vessels WHERE vuuid = $1`, then
`SHIP-${vesselCode}`. **`MULTITENANCY-DEPLOY-STEPS.md:123` says to set `SYNC_INSTANCE_ID=SHIP-<vuuid>`
— that doc is WRONG and has been corrected.** If `vessels.id` and `vessels.vuuid` differ, the ship
registers one identity while the operator sets another, and the ship gets **403** at
`syncTenantGuard`, or two `tenant_instances` rows for one vessel.
Pilot-verified: vessel `id='WKFV'`, `vuuid='743ef9d1-…'` → shore registered **`SHIP-WKFV`**.
**Before provisioning, read the ship's identity from the code's rule:**
```sql
SELECT id AS use_this_as_ship_code, vuuid, (id = vuuid) AS safe FROM vessels WHERE vuuid = '<vuuid>';
```
`safe = false` means the doc's instruction and the code disagree for that vessel.

**3. `manifest.envSettings` is declared but NEVER populated** — the only occurrences in the whole
codebase are the type declaration and the reads. Every bundle therefore seeds the hardcoded
defaults **`sync_push_batch_size=200`** and **`sync_request_timeout_ms=60000`**, regardless of what
shore is configured with. Pilot-verified: `envSettings: undefined` on a real generated bundle.
Do not expect per-ship tuning to travel in the bundle — set it on the ship afterwards.

**4. Migration 138 has an asymmetry worth knowing** (not a bug found in the pilot — zero collateral
on 1,111 untouched spares and 2,220 stock rows). Statement 1 repairs `spares` FROM
`spare_location_stock` **only when corroborating ROB evidence matches**; statements 4–5 push
`spares.rob_location_a/b` **INTO** `spare_location_stock` with **no evidence gate**. So where the
legacy `spares` columns are stale but the stock table is correct, 138 propagates the stale values.
**This is why the correction counts must be recorded, not just glanced at.**

---

## 3d. ⚠️ A SYNC BACKLOG IS NOW VISIBLE INSTEAD OF SILENTLY DISAPPEARING

**This is the biggest behaviour change in the stack and support must expect it.**

Before: a record the shore could not apply three cycles running was marked "synced" and dropped.
The backlog looked clean because failures were being deleted, not delivered. That is exactly how
Frontier Venture lost 71 work orders.

Now: **nothing is ever abandoned.** An unconfirmed record stays unsynced and keeps retrying on a
backoff ladder forever. Consequences that will look like new problems and are not:

- **`remainingPush` may be non-zero and stay non-zero.** That is the system telling the truth about
  undelivered data. Previously the same situation showed zero because the records had been discarded.
- **A row at `sync_attempts` 5+ needs a human**, not a restart. It is being retried weekly; something
  about that specific record is being rejected by shore. Read `retryBacklog.stuck` on `/sync/status`.
- **Unconfirmed rows never prune.** Pruning only deletes `is_synced = true`, so a genuinely stuck
  record is retained rather than aged out. Right trade — but watch `retryBacklog.total` growth.

---

## 3c. TWO UI GOTCHAS SUPPORT WILL HIT — pilot-observed

**1. Two different save buttons on the work-order form.** The **top "Save"** saves a DRAFT; the
**bottom "Submit Work Order"** is the real submit. Press the top one and the toast reads
*"Draft Updated"* and the status stays `Draft` — which looks like the submit silently failed.
Expect "why is my work order still a draft" tickets. The form also decides for itself: with any
required Part B field missing it saves a draft rather than submitting.

**2. `GET /work-orders/counts` returns `{"error":"Work order not found"}`.** The `:id` route
shadows it (the `:param` collision CLAUDE.md warns about). Harmless today — nothing calls it — but
do not add a `counts` endpoint at that path without registering it before `/work-orders/:id`.

**Also worth knowing — these validations are CORRECT, not bugs.** The pilot hit all three:
- *"Risk Assessment is marked Yes but no supporting document has been uploaded"* — answer NA, or attach the document.
- *"The Head of Department (Chief Engineer) cannot both perform and approve the work"* — segregation of duties; pick a different performer.
- Blank required Part B fields → saves as draft instead of submitting.

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

Fewer than 11 means the run aborted partway — see §0c and check the log for
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

**F. Status endpoint carries the operator fields** — `GET /sync/status` returns
`fieldLogFailures`, `insertLogSkips` **and `build`** (`commit` / `branch` / `startedAt` /
`source`). `build.commit` is how a vessel is version-confirmed without shell access — see §5.
A `source` of `unknown` means the instance cannot identify itself; treat it as unconfirmed. A non-zero `insertLogSkips.session` means old logs are being re-offered
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

The freeze covers **re-offer, `is_synced` reset, checkpoint rewind, dead-letter replay** — on any
vessel. It exists because re-delivered INSERT-origin logs used to overwrite live data, and
re-delivery is exactly what recovery tooling produces.

It lifts only when **both** guard commits are **deployed and running**:

- `eec60b923` — re-delivered INSERT-origin logs cannot overwrite live data
- `07d697f12` — per-field stale-skip symmetric across both directions

**CORRECTION TO THE EARLIER PLAN: the freeze CANNOT lift per vessel.** §12 said it would. That
was written assuming vessels could be held independently. They cannot — ships auto-pull production
on their own schedule. So the real condition is:

> **The freeze lifts FLEET-WIDE, and only after ALL THREE vessels have confirmably pulled the
> build AND shore is on it. Not when the first ship updates — when the last one does.**

Confirm per vessel with checklist item **G** (`INSERT-LOG SKIP` / `STALE-SKIP` reachable in
`sync-diag`) and item **A** (migrations present). All three must pass before any recovery runs
anywhere.

**Does this weaken the protection? Yes — say so plainly rather than pretend otherwise:**

1. **No staged rollout.** A defect in either guard reaches all three vessels within about a day,
   with no opportunity to catch it on one ship and hold the rest. The local pilot is the only
   thing standing in for that, and a local pair is not a real vessel with real data volume.
2. **The mixed-version window is unguarded on the laggards.** For roughly a day, shore is new
   while some ships are still old — and **the old ships still have the unguarded PULL path**,
   which is the exact Frontier Venture failure route. **No recovery of any kind during that
   window**, including on a vessel that has already updated, because shore-side re-offers reach
   the ships that have not.
3. **"Deployed" is not observable centrally.** There is no fleet dashboard saying which vessel is
   on which build. It has to be confirmed vessel by vessel from the logs, and until that is done
   the honest status is "unknown", which for this purpose means "still frozen".

### The freeze duration is bounded by ACCESS to the vessels, not by the update

Confirmation means **reading each ship's own log/build**. Ship access is intermittent — Frontier
Venture was unreachable for days this week. So:

> **If any one of the three cannot be reached, the freeze holds on ALL THREE, for as long as that
> takes.** An unreachable vessel is not "probably fine", it is unconfirmed, and unconfirmed means
> frozen. The clock is set by access, not by the auto-pull.

Do not lift on two of three and plan to "check the third later" — a shore-side re-offer reaches
the unconfirmed ship.

### MINIMUM EVIDENCE per vessel — what actually counts as confirmed

**⚠️ Read this before checking, because the obvious check does NOT work.** The two guards emit
diag lines **only when they fire**:
`INSERT-LOG SKIP (terminal-ack)` and `STALE-SKIP`. On a quiet vessel they may never appear.
**Seeing them is positive proof; NOT seeing them proves nothing at all.** Absence must never be
read as "the guard isn't there" — nor as "it is".

Required per vessel — **all three**:

1. **BUILD IDENTITY — the definitive one. No shell access needed.** Read it either way:
   - **`GET /sync/status`** → `build: { commit, branch, startedAt, source }` — **preferred**,
     because it works when the vessel is reachable only through the app.
   - **PM2 log**, emitted unconditionally at every startup:
     `[Build] BUILD IDENTITY — commit=…, branch=…, source=git, startedAt=…`
   - **Fallback if neither is available** (e.g. an instance still on an older build that predates
     this marker): `git log -1 --oneline` in the app directory.

   The commit must be **`07d697f12`** (per-field stale-skip) **or later**. Because commit order is
   `eec60b923` → `3d414f334` → `07d697f12`, a build at `07d697f12`+ necessarily contains **both**
   guards. This is the only check that positively proves the stale-skip fix is present.

   ⚠️ If `source` reads **`unknown`**, the instance could not resolve its own identity (no git
   tree and no `BUILD_COMMIT` env). Treat that vessel as **unconfirmed** — it is not evidence of
   anything, and unconfirmed means frozen.
2. **`[AutoSync] EFFECTIVE STATE`** present in the PM2 log after restart. Emitted unconditionally
   at every ship startup, and introduced in `3d414f334` — so its presence proves the build is at
   least `3d414f334`, hence includes `eec60b923` (the insert-origin guard). It does **not** prove
   `07d697f12`; only check 1 does.
3. **`GET /sync/status` returns both `fieldLogFailures` and `insertLogSkips`.** Confirms the
   insert-guard's counter surface is live and the app is actually serving the new build, not a
   cached one.

**GAP NOW CLOSED (in this stack).** Neither guard emits an unconditional startup line — their
only new log output fires on a conflict — so proving a fix was live previously meant SSH-ing for a
commit hash, on vessels that are intermittently reachable. The build-identity marker added in this
stack removes that: identity is now unconditional at startup **and** readable from `/sync/status`
without shell access. **Still outstanding:** the ship does not yet REPORT its identity to shore, so
there is no central view of which vessel runs what — that is scoped as tri-state prep, not built.

**Practical consequence:** budget roughly two days between promoting to production and lifting the
freeze — about a day for all three to pull, plus the verification pass — **and longer if a vessel
is out of contact.** Until every vessel passes checks 1–3, the 52/39 stay untouched.

---

## 6. STILL OPEN — not closed by this deploy

- **Frontier Venture's auto-sync cause.** The seed audit disproved the case-sensitivity theory
  (every seed writes lowercase). Settle it with the `EFFECTIVE STATE` boot line after restart,
  plus `pm2 logs | grep AutoSync`.
- **True affected counts.** Both spreadsheet exports were capped at exactly 1000 of ~1987 rows,
  so 39 and 20 are FLOORS. Use a COUNT query, not a re-export.
- **The 5.5h timestamp bug** (`spares_history.timestampUTC`, `spare_component_links.linkedAt`)
  — separate task; historical rows are already wrong and need a data decision first.
