# Scheduler Redesign — Runtime Verification (Stages A + B + C)

Branch: `feature/scheduler-redesign` · commits `900c5b971` (A+B), `1d62d5d5d` (C).
Run this on a **live ship/dev instance** and a **shore/office instance**. This verifies
**parity** (new behaviour produces the same results), not just that the server boots.

## What changed (so you know what "correct" looks like)
- **Shore:** the two every-minute scanners (`jobDueScanner`, `workOrderStatusRecalculator`) **do not start**. WO **status is computed on read**. The office generates WOs on demand via **"Generate Now"**.
- **Ship:** `jobDueScanner` runs **daily** (configurable). Its per-job link lookups are **batched** (N+1 removed). The RH-entry generation hook is now **vessel-scoped**.
- **Everywhere:** the status **recalculator scheduler is removed**; nothing persists the derived band (Active/Due/Due (Grace P)/Overdue). The overdue-alert query and the equipment/operations report band counts were **retargeted** to the computed band via `getWorkOrdersWithComputedStatus`.

> ⚠️ **Expected divergence — NOT a fault:** if you call `forceRecalculation()` (e.g. via the vessel-settings path), its returned `statusesUpdated` is now **drift telemetry only** — it reports how many rows' persisted `status` differs from the computed band and **writes nothing**. A non-zero `statusesUpdated` is EXPECTED and benign (the persisted column is intentionally stale). Read it as "drift count", not "rows updated".

## Pre-requisites
- Build the branch: `npm run build` (or run dev per `CLAUDE.md`). Note the **deploy timestamp** (UTC) — you'll use it as `<DEPLOY_TS>` below.
- Identify role: ship instances have `sync_settings.instance_id` (or `SYNC_INSTANCE_ID`) starting `SHIP-`; anything else = shore.
- DB handle for SQL (dev): `psql postgres://postgres:admin123@localhost:5432/pms` (ship/shore: use that box's DB).
- Optional cadence override for testing the ship scan without waiting a day:
  `JOB_DUE_SCAN_INTERVAL_MS=120000` (2 min). Default is 24 h.

---

## T0 — Baseline capture (BEFORE, on the current production build)
Capture reference numbers from the **old** build so parity is provable.
```sql
-- Persisted-status distribution (old build keeps this fresh):
SELECT status, count(*) FROM work_orders WHERE data_scope='vessel' GROUP BY status ORDER BY 2 DESC;
```
- Record process heap/RSS (old build), see T8 for the command.
- Record the equipment-report and operations-report **Overdue / Due / Completed** counts (generate each report once, note the totals).
Keep these for side-by-side comparison after deploy.

---

## T1 — Shore does NOT auto-scan  *(shore instance)*
1. Start the shore server. In the logs, confirm **both**:
   - `[JobDueScanner] Shore instance — auto scan NOT started (office uses on-demand "Generate Now")`
   - `[StatusRecalculator]` line is **absent** (the scheduler is removed entirely).
2. Watch logs for 5–10 min: there must be **no** `[JobDueScanner] Starting job due scan` lines and **no** `[StatusRecalculator] Recalculating …` lines.
- **PASS:** no periodic scan/recalc activity on shore.

## T2 — Ship runs the scan DAILY  *(ship instance)*
1. Start with `JOB_DUE_SCAN_INTERVAL_MS=120000` (2 min) for the test.
2. Confirm log: `[JobDueScanner] Ship instance — scheduler started (interval: 0.033h)` (or `24h` in prod).
3. Wait one interval; confirm `[JobDueScanner] Starting job due scan (all vessels)…` then `Scan complete …`.
- **PASS:** the scan fires on the configured interval on the ship only.

## T3 — Generation parity (refactored scanner = same WOs)
The RH/Dual loops were refactored (batched links, vessel-scope param). Prove they generate the **same** WOs.
1. On a **dev DB snapshot**, set a job due (calendar past generate-date, or RH ≥ generate threshold).
2. Run the scan once (ship) or trigger **Generate Now** (shore) for that vessel.
3. Confirm a WO was generated for the due job/component with the expected `workOrderNo`, `status: Active`, and correct RH/calendar snapshots.
4. Re-run the scan: **no duplicate** is generated (cycle/blocking guards intact).
5. Cross-check against the old build on the same snapshot: the set of generated `(jobNo, componentCode, cycle)` must be **identical**.
- **PASS:** same WOs generated; no duplicates; multi-linked components each get their WO.

## T4 — Status parity (alert engine + all report functions match the computed band)
The computed band is now the source of truth. Get the reference, then compare every consumer.
1. **Reference** (canonical computed band):
   ```bash
   DATABASE_URL=... EXTERNAL_MASTER_DATA_URL_DEV=... npx tsx scripts/verify-scheduler-redesign.ts <vesselId> <DEPLOY_TS>
   ```
   Note the printed `Overdue`, `Due+GraceP`, `Active`, `Completed`, `Postponed`, and `UC1 overdue candidates`.
2. **Equipment report** — generate the maintenance-schedule + equipment reports for that vessel; their **Overdue / Due / Active / Completed** counts must equal the reference (these now read the computed band via `getWorkOrdersComputed`).
3. **Operations report** — generate the crew-workload report; its **jobsOverdue** total must equal the reference Overdue set (within the same date/rank filters).
4. **Alert engine** — trigger an alert scan (POST the alerts scan route, or wait one 5-min cycle), then:
   ```sql
   SELECT count(*) FROM alert_events
   WHERE alert_type='critical_job_overdue' AND state='overdue';
   ```
   New overdue events (for not-already-deduped WOs) must match the script's **UC1 overdue candidates** count.
5. **Grids/dashboard (no change expected):** open Work Orders + Dashboard; the Overdue/Due/Pending tab counts and KPI tiles must match the reference (they already use `computedStatus`).
- **PASS:** alert engine, both reports, and the grids all agree with the script's canonical band.

## T5 — Zero `'system'` status writes (the false-conflict fix)
1. Run the script (T4 step 1) — it prints the `'system' work_orders.status field-log rows since <DEPLOY_TS>` count; expect **0 → PASS**.
2. Or directly:
   ```sql
   SELECT count(*) FROM sync_field_log
   WHERE table_name='work_orders' AND field_name='status'
     AND changed_by_user_id='system' AND changed_at > '<DEPLOY_TS>';
   ```
3. Sanity: real user status changes (completion, approval) **still** field-log (their `changed_by_user_id` is a real user/rank, not `system`):
   ```sql
   SELECT changed_by_user_id, count(*) FROM sync_field_log
   WHERE table_name='work_orders' AND field_name='status' AND changed_at > '<DEPLOY_TS>'
   GROUP BY 1;
   ```
- **PASS:** zero `system` status rows; real-user status changes still logged → they still sync.

## T6 — Postponement expiry still reverts  *(authored statuses, must be unaffected)*
The hourly expired-postponement check reads **authored** statuses (`Postponed` / `Postponement Approved`), which are NOT the derived band — confirm it still works.
1. Create/seed a postponed WO whose `postponed_to` date is in the past.
2. Wait for the hourly check (or note `📅 Scheduled hourly check…` ran) — log: `[Scheduled] … expired postponed work orders`.
3. Confirm the WO reverts to `Pending`:
   ```sql
   SELECT id, status, postponed_to FROM work_orders WHERE id='<woId>';
   ```
- **PASS:** expired postponed WO reverts (no regression from dropping the recalculator).

## T7 — Office "Generate Now"  *(shore instance)*
1. As an office/admin user on shore, select a **specific vessel** in Work Orders.
2. Click **Generate Now**.
   - Toast shows generated/checked counts; due jobs produce WOs; the grid refreshes.
3. Click again immediately during a long run → expect a **409** "already in progress" (no double-generation).
4. With vessel = "All"/"My", the button is **disabled** (tooltip: select a specific vessel).
5. The endpoint is shore-facing; on ship the button is hidden (`isShore`).
- **PASS:** WOs generated on demand for the selected vessel; concurrent-click guarded; manual single-WO create still works.

## T8 — Heap / CPU before vs after  *(both roles)*
Sample steady-state memory over ~10 min, before (old build) vs after (this branch).
```bash
# PM2:
pm2 describe SAIL-PMS | grep -E "memory|cpu"
# or, inside the app process (if a health/diag route exposes it), or:
node -e "const m=process.memoryUsage();console.log('rss(MB)='+(m.rss/1048576|0),'heapUsed(MB)='+(m.heapUsed/1048576|0))"
```
- **Shore expectation:** the every-minute full-table scan/recalc is gone → steady-state heap should **stop climbing** and settle lower (target: well below the prior ~700 MB elevated / 3.8 GB peak).
- **Ship expectation:** daily (not minutely) scan + batched link queries → lower churn.
- **PASS:** shore steady-state heap clearly lower than the old build; no minute-cadence CPU spikes on shore.

## T9 — pmsAlertEngine cost capture  *(informs the deferred event/daily follow-up)*
The alert engine still runs every 5 min and **now loads + computes ALL work orders** (via `getWorkOrdersWithComputedStatus`) for UC1. Capture its cost so we can decide whether to move it to event/daily.
1. In the engine logs each cycle, note the wall-clock between `[PmsAlertEngine] Starting alert evaluation scan…` and `[PmsAlertEngine] Scan complete …`.
2. Sample process RSS just before/after a cycle (T8 command) a few times.
3. Record: cycle duration (ms), WO count, RSS delta — for 3–5 cycles.
- **Capture (not pass/fail):** if cycle time or memory delta is significant at scale, schedule the deferred **alert-engine event(low-spares)/daily(overdue,skipped)** change.

---

## Sign-off
| Test | Ship | Shore | Notes |
|---|---|---|---|
| T1 shore no auto-scan | n/a | ☐ | |
| T2 ship daily scan | ☐ | n/a | |
| T3 generation parity | ☐ | ☐ (Generate Now) | |
| T4 status parity (alerts+reports+grids) | ☐ | ☐ | |
| T5 zero 'system' status writes | ☐ | ☐ | |
| T6 postponement expiry revert | ☐ | ☐ | |
| T7 Generate Now | n/a | ☐ | |
| T8 heap before/after | ☐ | ☐ | record numbers |
| T9 alert-engine cost capture | ☐ | ☐ | record ms + RSS |

**Do not deploy partially:** A+B and C must ship together — the retargeted alert query and reports (C) depend on the persisted band being abandoned (B/C), and the persisted band goes stale the moment the recalculator stops.
