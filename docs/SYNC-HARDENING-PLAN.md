# Ship ⇄ Shore Sync Hardening Plan — Fool-Proof Syncing

**Author:** Investigation by support@sl-sail.com · **Date:** 2026-07-23
**Trigger:** Frontier Venture — work orders completed on ship not reflecting on shore; dashboard counts mismatched.
**Status:** Analysis complete. Immediate data recovery + phased code fixes below. **No code changed yet — this is the plan for review.**

---

## 1. Executive Summary

A multi-day sync outage on Frontier Venture exposed **three real weaknesses** in the sync engine. The outage itself is fixed, but it left corrupted state on the shore and revealed design gaps that must be closed so this can never silently happen again.

| # | Issue | Impact | Status |
|---|---|---|---|
| A | **Request timeout too short (1.2s)** | Every push aborted before the shore's ACK returned → multi-day outage | ✅ **FIXED** (env `SYNC_REQUEST_TIMEOUT_MS` 1200 → 60000) |
| B | **Dead-letter falsely marks records "synced"** after 3 failed cycles | 71 work orders missing on shore; data marked synced but never delivered | 🔴 **Data recovery + code fix needed** |
| C | **Out-of-order / dropped status updates** | ~130 work orders on shore stuck at wrong status (Pending Approval instead of Completed) | 🔴 **Data recovery + code fix needed** |
| D | **Duplicate / mis-scoped rows** created shore-side (`SHORE-PROD` origin, wrong vessel_id) | Minor count skew | 🟡 **Review + cleanup** |
| E | **`is_synced` is binary** (true/false) — no "failed" state | Failed rows become invisible (marked "true") instead of retryable | 🔴 **Code fix — this is your tri-state idea** |

**The core design flaw (E):** the engine treats a record as either "not sent" or "sent," with no state for "tried and failed." When it gives up (issue B), it marks the record **synced** — indistinguishable from a real success — so the record is lost. Your instinct to add a **third state** is exactly the correct fix and is the backbone of this plan.

---

## 2. Root Causes (Confirmed in Code)

### A. Timeout too short — FIXED
- `SYNC_REQUEST_TIMEOUT_MS=1200` (1.2s) in the ship `.env`. Read at `server/modules/sync/syncEngine.ts:110/132`, applied as `AbortSignal.timeout(this.requestTimeoutMs)` at `:1138`.
- Over VSAT, a push round-trip needs far more than 1.2s. The ship aborted each push before the shore's acknowledgment returned — **even though the shore had already received and applied the data**.
- The retry wrapper (`:1184`, `MAX_RETRIES=3`, `RETRY_DELAYS=[5s,15s,45s]`) then produced the ~70s "aborted due to timeout" failures seen in the logs.
- **Fixed** by raising the timeout to 60000. This stopped the outage but did not undo the damage below.

### B. Dead-letter marks un-applied records as "synced"
- `server/modules/sync/syncEngine.ts:689`:
  ```
  const DEAD_LETTER_AFTER = 3;
  if (n >= DEAD_LETTER_AFTER) {
    // "row dropped by shore 3x in a row — marking synced to stop the loop. NEEDS MANUAL REVIEW"
  }
  ```
- Purpose: stop a genuinely bad ("poison") row from looping forever.
- **The flaw:** it cannot tell a **transient** failure (shore busy / timeout / self-heal pending) from a **permanent** one. During the outage, *good* rows were dropped for transient reasons, hit the 3-cycle threshold, and were **marked `is_synced = true` without ever landing on shore**.
- Result: **71 work orders exist on the ship but not on shore**, flagged as synced, so they never re-push. Confirmed by Nilesh's test — resetting one to `is_synced = false` and re-syncing made it appear on shore correctly.

### C. Status updates dropped / applied out of order
- Existing shore rows are stuck at an old status (e.g., WO `CWK68-424060001-2026-001`, row `91134e0c…`: the field-log history on the shore shows `Pending Approval → Completed` on 07-01, but the row is still `Pending Approval`, `updated_at` 06-30 — the Completed update was stored but never applied).
- Two contributing causes:
  1. The Completed update was dead-lettered while its row was briefly absent/unstable (issue B, at the update stage).
  2. The per-field stale-skip guard (`server/modules/sync/service.ts:337-348`) only protects against the **receiver's** newer edits — it does **not** protect against the **sender's own** older log being replayed *after* a newer one during the re-push storm. An older `Pending Approval` log could overwrite a newer `Completed` one.
- Result: **~130 work orders on shore stuck at the wrong status** — the bulk of the Pending Approval / Completed dashboard gap.

### D. Duplicate / mis-scoped rows
- The shore holds a `SHORE-PROD`-created copy of at least one WO number that the ship also owns (`805be982…`, status `Active`), under a **different vessel_id** — so it doesn't show in the Frontier Venture dashboard but pollutes the data.
- Shore is not supposed to generate work orders (scanners are ship-only); origin needs review (likely provisioning/import artifact).

### E. `is_synced` is binary — no failure state
- `sync_field_log.is_synced boolean` has only two values. "Gave up" (dead-letter) reuses `true`, making failures indistinguishable from successes and therefore invisible and unrecoverable. **This is the root design gap that made B and C silent.**

### F. Why self-heal did NOT auto-recover these (confirmed)
- Self-heal (`needsFullRows`) only fires when a field-log **arrives for an absent row** on the receiver (`service.ts` → `applyFieldLogInserts`). The 71 rows are dead-lettered `is_synced=true`, so the ship **offers nothing** → self-heal is never triggered.
- The one-time re-offer sweep (`autoSyncScheduler.ts:202`, `maybeRunSelfHealReofferSweep`) is **marker-guarded** (`sync_settings 'selfheal_reoffer_v1' === 'done' → return`). It already ran and spent its marker.
- **Gap in one line:** dead-lettered rows are invisible to *both* recovery paths — self-heal needs an offer (none exists) and the sweep is one-time-spent. Hence nothing recovered them automatically.

### G. Why a short timeout does NOT help VSAT (the misconception behind the incident)
The request timeout is a **ceiling, not a pace-setter**. A fast response returns immediately regardless of the ceiling. Setting it to 1.2s does not make a slow satellite link faster — it **aborts pushes the shore has already received and applied**, before the acknowledgment can travel back. The ship then records a **false failure**, retries, and after 3 cycles the dead-letter marks good data "synced." A short timeout **causes** the false-failure → dead-letter → data-loss cascade; it never improves throughput.

### H. Two opposite failure modes — one fix (tri-state covers BOTH directions)
- **Push (ship→shore)** has the dead-letter (`syncEngine.ts:689`) that **gives up → marks synced → loses data** (the 71 missing). Fails by **abandoning** good data.
- **Pull (shore→ship)** uses explicit apply-ack — the shore marks synced **only** rows the ship confirms applied (`syncEngine.ts:238/740/874`, `appliedRowUuids`) — so an un-appliable pulled row is **never given up → retries forever** (the CMH "retried forever" case). Fails by **never abandoning**.
- **Same fix both ends:** `deferred` + bounded backoff replaces "give up silently" (push) *and* "retry forever" (pull). **The tri-state must apply to both directions.**

---

## 3. Immediate Data Recovery (Phase 0) — re-offer led

> Do these per affected vessel, **after backing up the DB**. They use the sync engine's own paths (safe, idempotent, re-runnable).

### 3.1 — PRIMARY: re-offer the affected records (ship-side)
The re-offer primitive already exists as the 2b sweep's SQL (`autoSyncScheduler.ts:210`). Until the admin endpoint (FIX-RO below) is built, run it by hand on the **ship** (backup first):
```sql
UPDATE sync_field_log SET is_synced=false
WHERE instance_id='SHIP-Frontier Venture' AND is_synced=true
  AND table_name='work_orders'
  AND changed_at >= NOW() - interval '30 days';   -- widen the window if needed
```
Then `Sync Now` on the ship until `found 0 unsynced` / `DRAIN COMPLETE`. **Bounded** (table + N-day window + instance), **idempotent** (setting `is_synced=false` twice is a no-op; the shore applies re-offered logs idempotently), **safe to run twice**. This recreates missing rows **and** replays stuck-status updates in order (now that the timeout is fixed). Verify shore `work_orders` count rises to match the ship (1987) and the status distribution matches.

### 3.2 — Stuck statuses: shore-side SQL FALLBACK only
Prefer 3.1 (the re-offer replays the real logs, preserving audit/history). Use this **only** if some rows can't be re-offered.

> ⚠️ **Consequences of a raw shore UPDATE** (confirmed): field-logging is app-layer (`logFieldChanges`), **not** a DB trigger — so a raw SQL `UPDATE` creates **no `sync_field_log` entry** (nothing propagates back to the ship, no effect on later conflict resolution) and **no audit-trail entry**. The `set_updated_at` BEFORE-UPDATE trigger (migs 099/100/101) **does** fire (not a sync context), bumping `updated_at` to `NOW()` — harmless for `work_orders` (BOTH_EDITABLE, field-log-driven, not `updated_at`-gathered) but it moves the timestamp. Status-only, office-local correction.

**Preview first (read-only) — review the rows and count before mutating:**
```sql
WITH latest AS (
  SELECT DISTINCT ON (row_uuid) row_uuid, new_value AS correct_status
  FROM sync_field_log
  WHERE table_name='work_orders' AND field_name='status'
  ORDER BY row_uuid, changed_at DESC )
SELECT wo.work_order_no, wo.status AS current, l.correct_status
FROM work_orders wo JOIN latest l ON l.row_uuid = wo.wouuid
WHERE wo.vessel_id='<vessel>' AND wo.is_deleted=false
  AND wo.status IS DISTINCT FROM l.correct_status;
```
**Then, in a transaction:**
```sql
BEGIN;
WITH latest AS (
  SELECT DISTINCT ON (row_uuid) row_uuid, new_value AS correct_status
  FROM sync_field_log
  WHERE table_name='work_orders' AND field_name='status'
  ORDER BY row_uuid, changed_at DESC )
UPDATE work_orders wo SET status = l.correct_status, updated_at = now()
FROM latest l
WHERE l.row_uuid = wo.wouuid
  AND wo.vessel_id = '<vessel>' AND wo.is_deleted=false
  AND wo.status IS DISTINCT FROM l.correct_status;
-- confirm the row count == preview count, then:
COMMIT;   -- or ROLLBACK; if anything looks wrong
```

### 3.3 — Build the exact re-offer list (avoids re-sending correct records)
Because the ship keeps no durable "dead-lettered" flag today (that's fixed in §4), build the list by comparison:
1. On **shore**: export existing UUIDs — `COPY (SELECT wouuid FROM work_orders WHERE vessel_id='<vessel>') TO 'shore_wo.csv';`
2. Copy the file to the ship.
3. On **ship**: load it and reset only missing/stale records:
   ```sql
   CREATE TEMP TABLE shore_wo(wouuid text);
   COPY shore_wo FROM 'shore_wo.csv';
   -- Missing rows: not on shore at all
   UPDATE sync_field_log SET is_synced=false
   WHERE table_name='work_orders' AND vessel_id='<vessel>'
     AND row_uuid NOT IN (SELECT wouuid FROM shore_wo);
   ```
   For stuck-status rows (present on shore), prefer the §3.2 fallback, or reset their `status` field-logs specifically.
4. `Sync Now` on the ship until `found 0 unsynced` / `DRAIN COMPLETE`.

### 3.4 — Duplicates (§D)
Review the `SHORE-PROD`-origin rows separately; soft-delete confirmed spurious duplicates (`is_deleted=true`). Do **not** hard-delete. Investigate why shore created them.

---

## 4. Code Fixes — Fool-Proof Syncing

### FIX 1 — Tri-state sync status (your idea) 🟢 highest value
Replace the binary "synced / not-synced" with a state machine that can represent **failure**.

**Schema (additive, backward-compatible):** on `sync_field_log`, add:
- `sync_state text NOT NULL DEFAULT 'pending'` — `'pending' | 'synced' | 'deferred'`
- `sync_attempts int NOT NULL DEFAULT 0`
- `last_attempt_at timestamptz NULL`
- `last_error text NULL`
- (keep `is_synced` during migration; derive it as `sync_state='synced'` for old code, remove later)

**Semantics:**
- `pending` — never confirmed; eligible for the normal gather/push.
- `synced` — **confirmed applied by the receiver** (see FIX 2). Never re-sent.
- `deferred` — attempted `>= DEAD_LETTER_AFTER` times and **not confirmed applied**. Excluded from the *automatic* gather (stops the infinite loop) but **NOT counted as synced** — visible, reportable, and retryable.

**Gather query changes** from `WHERE is_synced=false` to `WHERE sync_state='pending'`.

**This directly implements your request:** a record that fails to sync is no longer silently marked "true" — it becomes `deferred`, stays visible, and can come back for retry.

### FIX 2 — Confirm-before-synced + auto-retry deferred
- **Mark `synced` only on positive receiver acknowledgment.** The shore already returns which rows it dropped (`droppedRowUuids`) and applied; the ship must mark `synced` **only** the rows the shore *confirms applied*, and set everything else back to `pending` (retry) or `deferred` (after the threshold). Today the dead-letter shortcuts this to `true`.
- **Auto-retry with backoff instead of permanent give-up.** A `deferred` row is re-attempted automatically after an increasing delay (e.g., 1h, 6h, 24h) or when connectivity is restored — so **transient** failures self-heal without any manual step. Only rows that keep failing after the full backoff ladder stay `deferred` for manual review (and remain visible, never lost).
- **Distinguish transient from permanent.** Do **not** count self-heal-pending drops (`FULL ROW requested`) toward the dead-letter threshold — those are expected and resolve on the next cycle. Only genuine apply errors count.

### FIX 3 — Out-of-order status guard on apply (shore)
- On the receiver, before applying a field-log UPDATE, skip it if a **newer `changed_at`** for the *same (table, row, field)* has already been applied — regardless of which instance authored it. This stops a replayed older `Pending Approval` log from overwriting a newer `Completed` one (issue C).
- Implementation: track the last-applied `changed_at` per (table,row,field) (or compare against the current row + a per-field applied-watermark), extending the existing guard at `service.ts:337-348` to also cover the **sender's own** ordering, not just receiver conflicts.

### FIX 4 — Self-heal completeness & post-heal replay
- When a row is self-heal-inserted, ensure any of its **deferred** field-logs are re-queued to `pending` so the row ends at its correct latest state (not the snapshot state). This closes the "row created but stuck at old status" path.

### FIX 5 — Timeout: provisioned, not env-only (partly wired already)
**Already in place:** `loadSettings()` is DB-first (`syncEngine.ts:131`, same pattern as `sync_api_key`); provisioning **seeds** `sync_request_timeout_ms = envSettings.syncRequestTimeoutMs ?? 60000 (changed from 120000 per fleet-standard 60s)` via `seedSettingIfEmpty` (`provisioningService.ts:789`); `PUT /sync/settings` writes settings and calls `engine.reloadSettings()` (`controller.ts:628`) → applies **next cycle, no restart**.
**The gap:** `seedSettingIfEmpty` is UPDATE-only, so ships provisioned before the seed logic (or never re-provisioned) have an **empty** DB row and fall through to the hand-set env `1200` — exactly what happened on Frontier Venture.
**Scope:**
- Backfill `sync_settings.sync_request_timeout_ms` on existing ships (fleet-standard **60000** (60s), uniform across all ships; provisioning default also 60000).
- Expose the timeout field in the **Sync Settings UI** (today it shows only interval + auto-sync) so ops can change it without touching `.env`.
- Log the **effective** timeout + its source (DB / env / default) at `[SyncEngine] Settings loaded` (`syncEngine.ts:141`).
- **Fleet audit** (item 1c): `SELECT setting_value FROM sync_settings WHERE setting_key='sync_request_timeout_ms';` (blank ⇒ using env) and `pm2 env <id> | grep SYNC_REQUEST_TIMEOUT_MS`. Also audit the **shore** `.env` that mints bundles — a low value there propagates into every new bundle.
- **Ship-side** (setting) + **shore-side** (bundle seed).

### FIX 6 — Duplicate / mis-scoped prevention
- Enforce that shore does **not** create work orders for a ship-owned vessel (scanners already ship-only — audit any office path that inserts `work_orders`).
- Add a natural-key guard so a WO number for a vessel can't exist twice with different UUIDs (match on `(vessel_id, work_order_no)` during apply, like the composite-key tables).

### FIX 7 — Visibility & monitoring (no more silent loss)
- **Sync Health panel / query:** count of `deferred` rows per table/vessel, with age and last_error. A non-zero deferred count is an operational alert — "N records failed to sync, needs attention."
- The `⚠️ DEAD-LETTER` / `DROPPED-ROW` alerts already log loudly; route them to the Conflict-Review / Alerts UI so operators see them without reading server logs.
- **Reconciliation check:** a periodic per-vessel row-count + status-hash comparison between ship and shore that flags divergence early (instead of a human noticing dashboard mismatches weeks later).

---

## 5. Testing / Verification (each fix needs a harness)

- **Tri-state:** simulate 3 failed applies → assert record becomes `deferred` (not `synced`), stays out of auto-gather, and is picked up by the retry sweep after backoff.
- **Confirm-before-synced:** shore drops a row → assert ship keeps it `pending`/`deferred`, never `synced`.
- **Out-of-order guard:** replay `Completed` then older `Pending Approval` → assert row stays `Completed`.
- **Self-heal replay:** absent row + later status logs → assert row created **and** ends at latest status.
- **Timeout:** low-timeout path aborts and retries without marking synced.
- **Regression:** run the full existing sync harness suite; tsc at/below baseline.
- **Live pair test:** break connectivity mid-cycle, restore, confirm zero data loss and eventual full convergence.

---

## 6. Rollout Phases (FINAL — 2026-07-23 review)

**Phase 0 — Recovery + stop re-corruption** (ops + tiny code)
- **Settings backfill migration** (§7b-1) — set non-empty defaults fleet-wide so **no ship depends on env** (`sync_request_timeout_ms`→60000, `sync_push_batch_size`→200 where empty). This is the FIX-5 *value* backfill; it is **Phase 0, not Phase 3** — a ship left at 1.2s re-corrupts under load, so recovery is pointless until every affected ship's timeout is fixed.
- **Fleet audit** (§7b-6) — identify every affected ship by ship-vs-shore row counts + dead-letter counts. Phase 0 targets that list, not guesswork.
- **Re-offer recovery** per affected ship (§3.1 sweep SQL now; FIX-RO endpoint alongside).
- **Shore duplicate review** (§D).
- **Gate to Phase 1:** all affected ships converged; no ship on a short timeout.

**Phase 1 — Tri-state + confirm-before-synced, BOTH directions** (FIX 1, 2)
- Additive columns (metadata-only) + **dual-write** + **partial index** + **batched/off-boot backfill** (§7b-2/3/4). `is_synced` stays authoritative until the fleet is upgraded.
- Deferred + backoff ladder replaces **both** the push dead-letter (gives up → data loss) **and** the pull infinite-retry (see §H).

**Phase 2 — Ordering guard** (FIX 3)
- One `applied_at` column on `sync_field_log` + guard extension — **no new table** (receiver already persists incoming logs).

**Phase 3 — Prevention + visibility** (FIX 5 UI/log, 6, 7)
- Timeout UI field + startup-log effective value; `(vessel_id, work_order_no)` dup guard + block shore-side WO creation; Sync-Health "Failed to sync (deferred)" panel + alerts; **fix `seedSettingIfEmpty` to UPDATE-then-INSERT** (ends the UPDATE-only class).

Each phase: sync-surface sign-off, harness green, tsc baseline held, single-vessel stage before fleet.

**Highest-risk surface** — every change here needs the usual sync-surface sign-off, a harness, and a staged single-vessel rollout before the fleet.

---

## 7a. Build Scoping (review answers, 2026-07-23)

Direction approved. Findings that size each item:

| Item | Finding | Size / side |
|---|---|---|
| **Timeout provisioning (FIX 5)** | DB-first + provisioning-seed + no-restart reload **already exist**; only the empty-DB backfill, UI field, and startup log are missing | Small · ship + shore |
| **Re-offer endpoint (FIX-RO)** | 2b sweep SQL is the primitive; promote to `POST /sync/re-offer {table, days}`, **not** marker-guarded, bounded/idempotent/logged | Small · ship |
| **Shore SQL fallback (§3.2)** | Raw UPDATE = no field-log, no audit, `updated_at` bumped; safe as office-local status-only fix | Ops only · shore |
| **Ordering guard (FIX 3)** | Receiver **already persists** incoming logs (`service.ts:232`); guard **already queries** `sync_field_log`. Add one column `applied_at` (stored ≠ applied) + guard extension — **no new table** | Small · both apply paths |
| **Tri-state (FIX 1)** | `sync_state` pending/synced/deferred + attempts/last_error; `synced` only on receiver ACK | Medium · both |
| **Deferred (FIX 6/retry)** | Ladder **1h→6h→24h→3d→7d**, then permanent `deferred` (never expire / never auto-synced); surface in Sync Dashboard "Failed to sync" panel + Conflict Review; alert: any deferred = warning, age>24h or count>10 = escalate | Medium · both |

**New FIX-RO — Re-runnable re-offer endpoint** (was folded into §3): `POST /sync/re-offer { table, days }` on the ship, runs the 2b sweep UPDATE with params, no marker, logged. Primary Phase-0/ops recovery tool; CSV-diff (§3.3) is the surgical fallback.

## 7b. Deep Scoping (2026-07-23 review round 2)

**1 — `seedSettingIfEmpty` audit + backfill migration.** Callers seed exactly 3 keys (`provisioningService.ts:786-791`): `sync_api_key`, `sync_push_batch_size`, `sync_request_timeout_ms`. mig 132 pre-creates all three **empty** (`… VALUES (…, '') ON CONFLICT DO NOTHING`). The helper (`repository.ts:634`) is **UPDATE-only** and runs **only at provisioning** → any ship provisioned before the bundle carried values (or never re-provisioned) stays empty → env/default. Two incidents caused by this (timeout → env 1200; the `selfheal_reoffer_v1` marker, which isn't in mig 132, forced hand-rolled UPDATE-then-INSERT at `autoSyncScheduler.ts:218`). **Fix:** one idempotent backfill migration —
```sql
UPDATE sync_settings SET setting_value='60000' WHERE setting_key='sync_request_timeout_ms' AND COALESCE(setting_value,'')='';
UPDATE sync_settings SET setting_value='200'    WHERE setting_key='sync_push_batch_size'    AND COALESCE(setting_value,'')='';
```
plus change the helper to `INSERT … ON CONFLICT (setting_key) DO UPDATE … WHERE COALESCE(existing,'')=''` (ends the class). Leave `sync_api_key` (per-tenant).

**2 — Gather index (must ship with the predicate switch).** Gather = `WHERE instance_id=$1 AND vessel_id IN (…) AND is_synced=false` (`repository.ts:113/120/145`), served by `idx_sfl_instance_synced`/`idx_sfl_vessel_synced` (mig `0056:134-135`). Switching to `sync_state='pending'` orphans them. **Replacement partial indexes (same migration):**
```sql
CREATE INDEX idx_sfl_pending      ON sync_field_log (instance_id, vessel_id) WHERE sync_state='pending';
CREATE INDEX idx_sfl_pending_pull ON sync_field_log (vessel_id, instance_id) WHERE sync_state='pending';
```
Partial = indexes only the small pending set. **Risk if missed:** the gather runs every cycle → full scan of a multi-million-row table on old ships. **Measure first:** `SELECT count(*), pg_size_pretty(pg_total_relation_size('sync_field_log'));` on the biggest ship (not yet measured — do before scheduling).

**3 — Migration cost.** PG **18** (`COMPLETE-PROJECT-CONTEXT-EXPORT.md:91`; shore pgAdmin). On PG 11+, the 4 `ADD COLUMN`s (constant/NULL defaults) are **metadata-only, no rewrite** → instant regardless of size. **The cost is the backfill** (`UPDATE … SET sync_state='synced' WHERE is_synced=true` touches nearly all rows) → would block boot on a large table. **Mitigation (mandatory):** add columns instant; keep `is_synced` gather; backfill **batched/off the boot path**; switch gather to `sync_state` + build partial index only **after** backfill completes. Measure, don't assume.

**4 — Old-ship skew.** Gather is `is_synced`-driven on both push and pull. During rollout (shore new, ships old), old ships use only `is_synced`. **`sync_state` must be a plain column with app-level dual-write** (generated column can't be written directly, and old ships write `is_synced`). Invariant: `sync_state='synced' ⟺ is_synced=true`. Old ships reading `is_synced` behave **identically to today** throughout. Retire `is_synced` only after the whole fleet runs new code + gather switched.

**5 — FIX-RO guards.** Role gate `requireOfflineAdmin` (same as `/sync/settings`, `routes.ts:58`); `{preview:true}` returns affected count without executing; hard caps (`days ≤ 90`, refuse if previewed count > ~20k); refuse while a cycle runs via `syncInProgress.get(vesselId)` / `engine.tryAcquireVessel` (`autoSyncScheduler.ts:307`) → 409. **Weak-link (Gas Mia):** a large re-offer window floods a satellite link — caps + preview are the guard; document a conservative window there.

**6 — Fleet impact list (targets Phase 0).** Per vessel, on **ship** and its **shore** tenant DB: `SELECT vessel_id, count(*) FROM work_orders WHERE is_deleted=false GROUP BY vessel_id;` — ship-count > shore-count = affected ship (magnitude = missing). Repeat for `superintendent_notifications`, `component_maintenance_history`. Dead-letter tally from ship logs: `grep -oE "DEAD-LETTER: row=[a-f0-9-]+" <logs> | sort -u | wc -l`.

## 9. Fourth Root Cause — Unlogged/Un-durable Field Logging (2026-07-23 audit)

Nilesh ruled out ops SQL on work_orders. Exhaustive write audit findings:

### 9.1 The computed-status split (check FIRST for the 52)
`shared/workOrders/status.ts:276`: stored `Due`/`Active` + `completionDateTime` present ⇒ **displays/tab-counts as Completed with NO status write ever happening** (live-proven on the RHSUG-1 fixture). Stored `'Pending Approval'` always passes through (:250/:264) and can never display Completed. Therefore:
- shore-tab PA vs ship-tab Completed → stored values MUST differ → a real write with a missing log.
- shore-tab Due/Overdue vs ship-tab Completed → stored can MATCH → **no log was ever missing; the un-synced data is the completion FIELDS.**
The discriminator query (run identically both sides on the 52): `SELECT wouuid, work_order_no, status, completion_date_time, date_completed, was_rejected, is_execution FROM work_orders WHERE wouuid IN (…) ORDER BY work_order_no;`
**The full-row-diff recovery (§3.2-redesigned) covers both classes unchanged.**

### 9.2 A4 — the swallowed-catch / non-transactional logging window (strongest recent-row explanation)
- **No work_orders site logs inside the row's transaction** — every site commits the row, then calls `logFieldChanges` separately, wrapped in `try { … } catch { console.error }` (**20 sites**). A crash between commit-and-log, or ANY logger error (notably the deliberate instance-id-resolution throw during MT registration/restart churn), silently loses the log while the row commits. Fits the MT go-live timeline for the 52.
- **Reverse phantom:** the three CR appliers (`applyWorkOrderChangesInTx` :5963, spares :6026, stores :6089) DO log — but **without `txConn`**, so the log commits on the global pool while the row-write sits in the still-open CR transaction. On CR-finalize ROLLBACK, a field log exists for changes that never applied → a false value would sync. (The ROB-merge phantom-log window, live in 3 places.)

### 9.3 Unlogged write sites (audit result)
| Site | Verdict |
|---|---|
| `workOrderContextService.ts:375` — corrective `status='Due'` on VIEW | **UNLOGGED — fix.** Once logged, the correction propagates both sides (correct — both sides should agree); note the view-triggered-write smell and the 'system' actor. |
| `adminController.ts:1068/1115` (`repairRhTracking`) — nextDueReading | **Deliberate local-only repair (mig-138 class)** — document at the site, do NOT log (each side runs its own repair; logging 'system' repairs recreates the false-conflict class). |
| `workOrderAutoService.ts:273` — jobId backfill | **UNLOGGED — fix** (trivial). |
| `archiveWorkOrder` | **Correction: it DOES log** (inside the storage method). Not a finding. |
| `applyWorkOrderChangesInTx` (A5) | **DOES log** (:5963) — not the feared live bug — but swallowed + non-tx (see 9.2). |
| Sync appliers / provisioning / migrations / repairs / harnesses | Exempt by design (applying already-logged remote data, or deliberate local repairs). |

### 9.4 Phase-0 hardening (approved): un-swallow — LOUD + DURABLE, never blocking
Design: a `logFieldChanges` failure must NEVER break the business write. Instead: (a) loud `console.error` + **syncDiag `FIELD-LOG-LOST`** line, (b) in-memory counter surfaced via `/sync/status`, (c) **durable row in new local table `sync_field_log_failures`** (table_name, row_uuid, vessel_id, failed_fields, error, occurred_at) so lost logs are *recoverable by list*, not discovered weeks later by counting. Table is local bookkeeping — NOT synced, NOT provisioned. Tx-callers (`txConn` provided) keep throwing (atomicity is the caller's contract). Until the Sync-Health panel exists, the surfaces are: the failures table, the syncDiag file, and `/sync/status`.

### 9.5 Phase 2 — transactional logging (the cure; scoped, not built)
Destination: row-write + field-log in the SAME transaction (both commit or neither). The logger already accepts `txConn`. Refactor = plumb an optional tx through repo→storage write methods and wrap each write+log pair (~20 sites, mechanical); risk = slightly longer transactions; the CR appliers just pass their existing `tx`. Belongs in **Phase 2** with the ordering guard (same apply-correctness family). Un-swallow (9.4) is the stopgap, not the cure.

### 9.6 Structural gate (FINAL — reviewed 2026-07-23)
1. **Transactional logging is the destination** (§9.5): row-write + field-log in the same transaction — the structural guarantee lives at the application layer. The 3 CR appliers are already converted (pulled forward); the remaining ~17 sites are Phase 2.
2. **Un-swallow (mig 142) is the stopgap** — lost logs are loud + durable until tx-logging lands.
3. **CI/lint gate** (with Phase 1): ban raw writes to synced tables outside the storage layer; require field-log adjacency.
4. **Non-prod runtime assertion** (with Phase 1): a synced-table write without a same-request field-log fails loudly in dev/staging.

**DB trigger: REJECTED outright — do not revisit.** Prior production experience with audit
triggers in MySQL caused performance problems, and a trigger embedded in the schema is hard to
back out once live across a fleet. The structural guarantee comes from transactional logging at
the application layer instead. (Recorded so shadow-mode proposals are not re-raised.)

### 9.7 Status of §9.3 sites (post-review build)
- CR appliers (WO/spares/stores) — **FIXED** (tx-joined logging; phantom-log-on-rollback closed).
- `workOrderAutoService` jobId backfill — **FIXED** (logged, 'auto-generation' actor).
- `repairRhTracking` — **documented at the site** as deliberate local-only (no logging, by decision).
- `workOrderContextService:375` corrective — **HOLD, documented at the site**: stays local-only
  (known bounded divergence: a stuck-rejected WO corrected on one side stays local) until the
  Phase-2 fix relocates it out of the view path and logs it with a real actor.

### 9.8 Migration numbering
141 = timeout backfill · **142 = sync_field_log_failures (consumed by the un-swallow)** · **Phase-1 tri-state = 143** (do not reuse 142).

## 8. Phase 1 — Locked Scoping (2026-07-23 review round 3, A–D)

### A. Re-send storm must be structurally impossible (transitional predicate + cutover gate)
`sync_state DEFAULT 'pending'` means every historical (already-delivered) row reads `pending` the instant the column is added. If any instance's gather switched to `sync_state='pending'` before **its own** backfill finished (mid-backfill restart, out-of-order deploy, code-without-backfill), it would re-offer its **entire history** — a self-inflicted VSAT outage identical to the one just fixed.

**MANDATED transitional gather predicate** (until an instance is verified backfilled):
```
WHERE is_synced = false AND sync_state <> 'deferred'
```
- `is_synced=false` stays the **source of truth** → no un-backfilled row can ever be re-offered under any sequencing.
- `sync_state <> 'deferred'` adds the *only* new behaviour (deferred rows drop out of the auto-gather).
- **Cutover gate:** an instance switches to the pure `sync_state='pending'` predicate + partial indexes (§7b-2) **only after** (i) its backfill completion marker is set AND (ii) verified `SELECT count(*) FROM sync_field_log WHERE is_synced=true AND sync_state<>'synced'` = 0. Not before.

### B. Backfill spec (the riskiest single operation in Phase 1)
- **Where:** a dedicated **background job** (scheduler tick or admin-triggered), **never on the boot/migration path**. Migrations only `ADD COLUMN` (metadata-only) + create the *deferred-excluding* index; they do **no** data backfill.
- **Batching/pacing:** update in bounded batches (e.g. 5k rows) by `id` range, `sync_state = CASE WHEN is_synced THEN 'synced' ELSE 'pending' END WHERE sync_state IS DISTINCT FROM (that)`, with a sleep between batches.
- **Resumable:** track a high-water `id` in `sync_settings` (`sync_state_backfill_cursor`); a mid-run restart resumes from the cursor. Idempotent (re-running a batch is a no-op via the `IS DISTINCT FROM` guard).
- **Throttled:** skip/yield a batch while `syncInProgress.get(vesselId)` is set (never compete with a live sync cycle); cap batches/minute.
- **Observable:** log progress (`backfilled N / total`, cursor) and expose a count in the Sync Health panel.
- **Completion marker:** `sync_settings 'sync_state_backfill_v1' = 'done'` — the cutover gate (A) reads this. Set only after the whole table is processed and the verify count is 0.

### C. Deployment mechanics (field-failure surface)
1. **Wire unchanged — CONFIRMED design constraint:** `sync_state` / `sync_attempts` / `last_attempt_at` / `last_error` are **LOCAL bookkeeping only**. They are **never** added to the `/sync/push`, `/sync/pull`, or `/sync/complete` payloads. An **old ship ↔ new shore** (and new ship ↔ old shore) exchange **byte-identical** messages to today. The only cross-instance signal stays `appliedRowUuids` (already exists).
2. **Per-instance independence — CONFIRMED requirement:** each instance backfills and cuts over on **its own** schedule; one side's cutover must not require the peer's. **FIX 2 (confirm-before-synced) already works this way** — it is driven entirely by the **local** interpretation of the shore's existing `droppedRowUuids`/`appliedRowUuids` response; no new peer field. Fallback if a peer is old: identical to today (the ack fields are unchanged), so an old peer simply behaves as it does now.
3. **Automatic cutover, centrally holdable:** an instance flips its gather to the new predicate **automatically** once its own `sync_state_backfill_v1='done'`, **gated by a fleet hold flag** `sync_cutover_hold` (shore-set, synced down as a global setting, **default = HOLD**). Un-hold progressively: pilot → small group → fleet by clearing the hold for a widening instance set (shore-controlled). **Rollback:** re-set the hold → instances revert to the transitional predicate (A) next cycle (safe — `is_synced` never stopped being maintained).
4. **Pilot:** a **strong-link** vessel (NOT Gas Mia — it's a satellite weak-link, per memory). Watch for one full week: sync cycles complete, `remainingPush→0`, no re-offer storm, deferred count sane, dashboard parity ship↔shore. **Go/no-go:** zero unexpected re-offers, backfill completed without boot impact, no divergence — before widening.
5. **Shore's own table:** the shore holds field logs for **every** vessel → it is likely the **largest** instance and the one whose stall affects **all** clients. Include shore in the §D measurement; its backfill may need smaller batches / a longer window / an off-peak run. The transitional predicate (A) protects it too — shore never re-offers un-backfilled history.

### D. Measure NOW (blocks scheduling, not the plan)
Run on the **largest ship** and on **shore** before committing a backfill date:
```sql
SELECT count(*) AS rows, pg_size_pretty(pg_total_relation_size('sync_field_log')) AS size FROM sync_field_log;
```

## 7. One-Line Summary for Non-Technical Stakeholders

> During a multi-day satellite outage, the sync system gave up on some records and wrongly marked them "done," so they never reached the office. We've stopped the outage (timeout fix), we're recovering the affected records, and we're rebuilding the "done" flag into three states — **done, pending, and failed** — so a record can never again be marked done unless the office actually confirms it received it. Failed records stay visible and retry automatically.

---

## §10 — MECHANISM OF THE "39" (Frontier Venture group A), 2026-07-24

### §10.1 Ruled out, with evidence
- **H1 absent-row reconstruction (`applyFieldLogInserts`)** — oneWayApplier.ts:663-700 sorts the
  log group by `changedAt` ASC and takes the LATEST value per field. Reconstruction yields
  `status='Pending Approval'`, the OPPOSITE of the observed row. It also cannot produce a mixed
  row; every field comes from one sorted set. RULED OUT.
- **H2 `applyFullRowsIfAbsent` (self-heal)** — insert-only, inserts the SENDER's row verbatim.
  Shore held no 8-Jul data before 23-Jul 11:48 and held `Pending Approval` after 11:59. Neither
  snapshot yields "8-Jul fields present AND status Active". The 23-Jul log also shows self-heal
  for work_orders running SHIP→SHORE. RULED OUT.
- **H3 provisioning / bundle import** — same snapshot logic, plus positively contradicted by
  data: `created_at` spreads across 23-Jun (791), 1-Jul (620), 3-Jul (254), 4–14 Jul. A bundle
  import stamps ONE window. RULED OUT.
- **INSERT hypothesis generally** — the `created_at` spread kills it.

### §10.2 The mechanism that fits
An `UPDATE` executed with `sync.bypass_trigger='true'` that does NOT include `updated_at` in its
SET list. Migration 110's trigger returns NEW unchanged under bypass, so `updated_at` keeps its
OLD value rather than being stamped. 33 fields land, `updated_at` stays frozen at 23-Jun, and no
INSERT is required. Only applier paths set that bypass.

### §10.3 The remaining open question (narrow)
`service.ts:330` computes `isInsertLog = (log.oldValue == null)`. INSERT-origin logs take an
**ALWAYS APPLY** branch that skips the per-field stale-skip guard entirely (`INSERT-LOG ALLOWED`),
while non-INSERT logs are guarded at :337-348. That split partitions the 8-Jul batch EXACTLY as
observed — 33 null-old_value fields vs the 3 with prior values. Note the asymmetry: the INSERT
*reconstruction* path has an IMMUTABLE-ACK guard for re-delivered insert logs (oneWayApplier:640)
but the per-field UPDATE path has NO equivalent. A re-delivered INSERT-origin log therefore
overwrites a NEWER receiver value with no staleness check at all — and re-delivery is exactly
what a dead-letter re-offer or checkpoint rewind produces. Phase 2's applied_at watermark does
NOT fix this, because the INSERT-origin branch bypasses ordering before the watermark is
consulted. The guard needs its own correction. NOT YET BUILT — decision pending.

### §10.4 Group A rows have NO creation-time field log on the ship
Q3 showed 35-36 total field logs per row, all from the 8-Jul batch. Group B rows DO have a
`(null)→Active` creation log; group A rows do not. So group A was created on SHORE and synced
down (appliers do not log). Shore therefore holds their INSERT-origin creation logs, including
`status: null→Active` — the exact payload that would revert the ship under §10.3.
CONFIRMING QUERY when ship access returns (shore side): do shore's field logs for the 39 contain
INSERT-origin status logs, and were they re-delivered (is_synced reset / new sync_batch_id) after
8-Jul?

---

## §11 — ITEM A: DRIFT DETECTOR (BUILT 2026-07-24, migration 143)

**Migration numbering: drift = 143. Phase 1 tri-state moves 143 → 144 (confirmed).**

**SCOPE — stated plainly so expectations are right.** The detector compares a row's current value
against THAT ROW'S OWN newest field log, on ONE instance. It catches the CAUSE class: a write
that logged one thing and stored another, or a later write that reverted a value without logging.
**It does NOT compare ship against shore.** A divergence where both sides are internally
consistent but disagree with each other is INVISIBLE to it. Cross-instance reconciliation needs
both databases and stays **Phase 3**.

Reports into `sync_field_log_failures` with `kind='drift'` — the SAME operator list as the
Phase-0 un-swallow lost-log records. One open row per (kind, table, row, field); repeat scans
bump `last_seen_at` instead of piling up.

**Deliberately reported, not allowlisted** (expected in every first run): the
`workOrderContextService` stuck-rejection corrective and `adminController.repairRhTracking` both
write without a field log by design. They ARE local divergence. An allowlist would hide the same
shape arriving from a path we did not intend.

**First full run against the dev DB found a previously unknown bug**: `spares_history.timestampUTC`
and `spare_component_links.linkedAt` are TEXT columns storing a JS `Date.toString()`, so the ISO
digits get relabelled as local time and the stored instant is 5.5h (IST offset) off the logged
one. Verified real, not a formatting artifact. Separate writer bug — own task.

---

## §12 — 🔴 HARD GATE: RECOVERY IS FROZEN (2026-07-24)

**NO re-offer, NO `is_synced` reset, NO checkpoint rewind, NO dead-letter replay — on ANY vessel
— until the INSERT-origin guard fix (§13) ships.**

WHY: `service.ts:330` computes `isInsertLog = (log.oldValue == null)` and INSERT-origin logs take
an **ALWAYS APPLY** branch that skips the per-field stale-skip guard entirely. A re-delivered
creation-time log therefore overwrites a NEWER receiver value with no staleness check. Re-delivery
is exactly what our recovery tooling produces. Running the "52" recovery on current code risks
corrupting correct data the same way the 39 were corrupted.

Applies to: Frontier Venture and every other vessel. Nilesh is held. Lift only when §13 is
deployed, not merely merged.

---

## §13 — GUARD FIX SCOPE (NEXT BUILD — ABOVE TRI-STATE)

### The rule
- Row **absent** on receiver → ALWAYS APPLY (unchanged; the row needs these fields to exist).
- Row **exists** + INSERT-origin log → apply **only if the receiver's column is NULL/empty**.
  A populated column is never overwritten; skip is ACK'd like IMMUTABLE-ACK.

### Why this is safe (the key insight)
An INSERT-origin log records a row's state **at creation** — by definition the OLDEST possible
state of that row. It can therefore NEVER legitimately be newer than a value already present on
an existing row. Skipping populated columns cannot discard newer truth. Filling NULL columns
preserves the legitimate "partial previous apply" repair, and filling a NULL cannot destroy data.

### Risk cases (the thing to get right)
1. **Legitimate first delivery, partially applied** — row exists, field NULL. SAFE: still applies.
2. **Receiver value set by an applier (no local log)** — this is exactly group A on the ship.
   The stale-skip alone would NOT have saved it (no local log to compare); the NULL/empty rule
   does. This is why the fix is value-based, not log-timestamp-based.
3. **Unknown row existence** — `updateLogs` has 4 producers (oneWayApplier :562 unknown table,
   :596 row-exists, :606 exist-check-failed, :644 row-exists). Two guarantee existence, two are
   error fallbacks. Fail CLOSED on the fallbacks: re-check existence at apply time, and if that
   also fails prefer the guarded path. Cost of failing closed is a delayed field, not corruption.
4. **NOT NULL columns** — no risk: the row already exists, so skipping cannot violate NOT NULL.
5. **Immutable tables** — already ACK'd earlier at :633/:592; unchanged.
6. **Operator noise** — a skipped re-delivery is NOT a conflict. It must emit a syncDiag line
   ONLY, and must NOT write sync_conflict_log or fire a conflict notification, or a single
   re-offer would flood the conflict surface.

### Implementation
`applyFieldLogInserts` returns a new `existingRowUuids` set (no mutation of shared log entries);
`service.ts` consults it plus a lazy existence re-check for the unknown cases. **No migration
required — 144 stays reserved for Phase 1 tri-state.**

### Tests (harness, untracked)
1. **FV reproduction**: row exists `status='Pending Approval'` + local 8-Jul log; deliver
   re-delivered INSERT-origin `status: null→'Active'` → **newer value SURVIVES**.
2. Partial-apply repair: row exists, `status` NULL → INSERT-origin log LANDS.
3. Absent row → unchanged ALWAYS-APPLY, row created with all fields.
4. UPDATE-origin logs → existing stale-skip behaviour unchanged (regression).
5. Immutable table → still ACK, no UPDATE issued (regression).
6. Unknown-existence fallback → fails closed.
7. Skipped re-delivery writes NO sync_conflict_log row and NO notification.

---

## §14 — SEPARATE TASK: 5.5h TIMESTAMP BUG (not part of §13)

`spares_history.timestampUTC` and `spare_component_links.linkedAt` are TEXT columns storing a JS
`Date.toString()` ("Mon Jul 20 2026 15:03:24 GMT+0530") while the field log holds the ISO form.
The digits match but the stored instant is **5.5h (IST offset) off** the logged one — verified by
arithmetic, not a formatting artifact. Found by the drift detector's first full run.

**Do NOT fix inside the guard work.** Note for whoever takes it: HISTORICAL ROWS ARE ALREADY
WRONG, so the fix needs a data question answered first — do we backfill the stored instants, and
against which source of truth (the log's ISO, or the displayed local time users have been reading)?
