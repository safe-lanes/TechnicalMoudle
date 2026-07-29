# SUPPORT RUNBOOK — Work Order recovery (ship ↔ shore dashboard mismatch)

**Use this when:** a work order shows on the ship but not in the office, or the two sides show
different authored statuses (Completed / Pending Approval / Postponed / Rejected), typically
because old records were dead-lettered by the pre-July-2026 sync code or written before field
logging covered that path.

**Verified:** the procedure and script below were proven live on the shore+ship test pair on
2026-07-29 (both repair classes, end-to-end, one sync cycle each).

---

## RULES FIRST — read before touching anything

1. **NEVER hand-edit a work order's status in the database.** Due / Overdue / Grace are
   COMPUTED when the page loads — they are never stored, and they fix themselves the moment
   the underlying rows match. Writing `status='Overdue'` corrupts data and fixes nothing.
2. **All repair actions run on the SHIP.** The ship holds the truth; sync carries it to shore.
   Never insert or edit rows directly on the shore — that bypasses sync bookkeeping and can
   create false conflicts against the ship's next push.
3. **A standing "Still to send" number on the Sync Dashboard is NOT a defect** — records in
   retry backoff are visible on purpose (the old code silently deleted them; that is how
   Frontier Venture lost 71 work orders). Do not "clear" it, do not reset `is_synced` in bulk.
4. Only touch the specific record list you identified. Nothing wholesale.

---

## STEP 0 — prerequisites

- Both sides run the July-2026 sync stack or later: open `GET /technical/api/sync/status` on
  each side and confirm the `build` field is present. No `build` field = old build = STOP,
  deploy first.
- The repair script `scripts/repair-wo-deadletter-reoffer.ts` exists in the ship's app folder.
- You need the ship's `DATABASE_URL` (same value the app uses — see the ship's `.env`).

---

## STEP 1 — identify the mismatched work orders

### Automatic (preferred) — let the script find them

On the ship, in the app folder:

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --scan
```

The ship asks the shore (via its configured `shore_url`) for this vessel's work orders and
diffs them itself. It flags every WO that is **missing on shore** or has a **different
authored status**, prints the classification for each (nothing is changed), and writes the
list to `repair-scan-list.txt` for the record. It also *reports* — but never repairs —
shore-only WOs and Due/Overdue-band-only differences (those bands are computed from
jobs/RH inputs; re-offering the WO cannot and must not touch them).

Requires the ship to have connectivity to the shore (same as a normal sync).

### Manual (fallback) — offline, or to double-check the scan

Run on **BOTH** ship and shore DBs, save both outputs, and compare:

```sql
SELECT wouuid, work_order_no, status, updated_at::date
FROM work_orders
WHERE coalesce(is_deleted,false) = false
  AND vessel_id = '<VESSEL_ID>'
ORDER BY work_order_no;
```

(Column is `work_order_no` — there is no `wo_number` column.)

The repair list = every `wouuid` that is **missing on shore** or has a **different authored
status**. Put them one per line in a file `list.txt` on the ship.

---

## STEP 2 — classify (dry run, changes nothing)

On the ship, in the app folder:

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --file list.txt
```

Every record is printed with its class. The script refuses to run against a shore DB.

| Class | What it means | What the script will do on `--apply` |
|---|---|---|
| **A** | Sync logs already pending | Nothing — the next sync delivers them |
| **B** | Logs exist but were falsely marked "synced" (dead-letter) | Re-offer them (reset to unsynced, attempts 0) |
| **C** | NO logs exist at all (written before logging covered it) | Generate full-row logs from the ship's current record |
| **MISSING** | Record is not on the ship at all | Nothing — escalate (see below) |

Completed WOs automatically include their maintenance-history rows (a completion is a family
of records, not one row).

---

## STEP 3 — per-class actions

### Class A — nothing to repair
Run **Sync Now** on the ship. If the record still hasn't arrived after a successful sync,
check `GET /sync/status → retryBacklog`: `total > 0` = waiting out retry backoff (normal,
keep waiting); `stuck > 0` = escalate with the record ids.

### Class B and C — run the script for real

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --scan --apply     # automatic path
npx tsx scripts/repair-wo-deadletter-reoffer.ts --file list.txt --apply   # manual list
```

The output states exactly how many logs were re-offered (B) / generated (C) per record.

### MISSING — do not improvise
The record exists on neither side or only on shore. That is a different problem (possibly a
shore-only record that should flow shore→ship, or genuinely deleted data). Collect the
`wouuid` list and escalate — do not create rows by hand.

---

## STEP 4 — sync and verify

1. On the ship, press **Sync Now**. Repeat until the sync diag shows
   `DRAIN COMPLETE ... remainingPush=0, remainingPull=0`.
   A large first run (up to 20 back-to-back cycles) is normal drain behaviour, not a fault.
2. Re-run the STEP 1 query on both sides — the diff for your repair list should now be empty.
3. Open the Work Order dashboard on both sides — statuses now match by themselves
   (computed bands recalculate on page load; no further action).

---

## ESCALATION — send these to the development team

- Any **MISSING**-class records (the wouuid list).
- `retryBacklog.stuck > 0` on `GET /sync/status` after the drain.
- A record that reverts or differs again AFTER a clean drain (include both sides' STEP-1 rows
  and the ship's sync-diag file for the day).
- Any script error output.

---

## Reference — running-hours audit rows

`running_hours_audit` has no direct work-order column, so it is not auto-included. If a
specific RH audit row must travel, add it to `list.txt` explicitly as:

```
running_hours_audit:<rhauuid>
```

The same `table:uuid` form works for `component_maintenance_history` rows if one must be
re-offered without its parent work order.
