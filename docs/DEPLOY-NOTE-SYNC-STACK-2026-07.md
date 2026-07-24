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
| 137, 139, 141, 142 | 0064, 136, 138, 140, 143, 145, 146 |

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

1. **BUILD IDENTITY — the definitive one.** In the app directory on the vessel:
   ```bash
   git log -1 --oneline
   ```
   Must show **`07d697f12`** (per-field stale-skip) **or later**. Because commit order is
   `eec60b923` → `3d414f334` → `07d697f12`, a build at `07d697f12`+ necessarily contains **both**
   guards. This is the only check that positively proves the stale-skip fix is present.
2. **`[AutoSync] EFFECTIVE STATE`** present in the PM2 log after restart. Emitted unconditionally
   at every ship startup, and introduced in `3d414f334` — so its presence proves the build is at
   least `3d414f334`, hence includes `eec60b923` (the insert-origin guard). It does **not** prove
   `07d697f12`; only check 1 does.
3. **`GET /sync/status` returns both `fieldLogFailures` and `insertLogSkips`.** Confirms the
   insert-guard's counter surface is live and the app is actually serving the new build, not a
   cached one.

**KNOWN GAP, stated so nobody trips on it:** `07d697f12` adds no unconditional startup line — its
only new log output fires on a conflict. That is why check 1 is the commit hash rather than a log
grep. This is exactly the **build-version startup log / version handshake** already on the open
follow-ups list; adding one would make future rollouts confirmable from the log alone. Worth doing
before the tri-state rollout, which will need the same confirmation across the same three ships.

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
