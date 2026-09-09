# SUPPORT RUNBOOK — Work Order recovery (MANUAL method — fallback only)

**Use the script runbook first:** `docs/SUPPORT-WO-RECOVERY-RUNBOOK.md`. This manual method
exists for the cases where the script cannot do the job:

- the ship has **no connectivity to the shore** right now (the `--scan` needs it; note the
  repair itself will still only complete once sync connectivity returns), or
- `npx tsx` is broken on the ship and the single-file copy cannot be made to run, or
- you need to double-check the scan's findings by hand.

The same **RULES** apply as in the script runbook — read them there first. In particular:
never hand-edit statuses (Due/Overdue are computed, not stored), all repairs happen on the
SHIP, and only ever touch the specific record list you identified.

---

## STEP 1 — identify the mismatched work orders (by hand)

Run this on **BOTH** the ship DB and the shore DB, save both outputs, and compare:

```sql
SELECT wouuid, work_order_no, status, updated_at::date
FROM work_orders
WHERE coalesce(is_deleted,false) = false
  AND vessel_id = '<VESSEL_ID>'
ORDER BY work_order_no;
```

(The column is `work_order_no` — there is no `wo_number` column.)

The repair list = every `wouuid` that is:
- **missing on shore**, or
- showing a **different authored status** (Completed / Pending Approval / Postponed /
  Rejected / …).

⚠️ Ignore differences that are only Due vs Overdue vs Active — those bands are computed from
jobs/RH data on each side; re-offering the WO cannot fix them and they are NOT part of this
repair.

---

## STEP 2 — classify each record ON THE SHIP

For each `wouuid` in your list:

```sql
SELECT is_synced, count(*)
FROM sync_field_log
WHERE table_name = 'work_orders' AND row_uuid = '<WOUUID>'
GROUP BY is_synced;
```

| Result | Class | Meaning |
|---|---|---|
| rows with `is_synced = false` exist | **A** | Already queued — no action, just sync |
| rows exist, ALL `is_synced = true` | **B** | Dead-lettered — falsely marked delivered |
| no rows at all | **C** | Never logged — sync has nothing to send |

---

## STEP 3 — repair, per class

### Class A — nothing to do
Run **Sync Now**. If it still doesn't arrive after a successful sync, check
`GET /sync/status → retryBacklog` (waiting backoff is normal; `stuck > 0` = escalate).

### Class B — re-offer the dead-lettered logs (SQL, ship only)

```sql
UPDATE sync_field_log
SET is_synced = false, sync_attempts = 0, last_attempt_at = NULL
WHERE table_name = 'work_orders' AND row_uuid IN ('<WOUUID1>', '<WOUUID2>');
```

Also re-offer the completion's history rows (a completion is a family of records):

```sql
UPDATE sync_field_log
SET is_synced = false, sync_attempts = 0, last_attempt_at = NULL
WHERE table_name = 'component_maintenance_history'
  AND row_uuid IN (SELECT cmhuuid FROM component_maintenance_history
                    WHERE work_order_id IN ('<WOUUID1>', '<WOUUID2>'));
```

### Class C — never-logged records: DO NOT write sync logs by hand

Hand-crafting field-log rows is exactly what the script exists for (49 columns per record,
and one wrong value corrupts data on both sides). Manually, you have two safe options:

1. **Few records:** open each work order **in the ship's app UI** and re-save it. The app
   writes a fresh, correct field log, and the record syncs normally.
2. **Many records:** get the script working (single-file copy, see the script runbook) or
   escalate with the record list. Do not improvise SQL inserts into `sync_field_log`.

### MISSING (not on the ship at all) — escalate with the wouuid list. Never create rows by hand.

---

## STEP 4 — deliver and verify

1. **Sync Now** on the ship, repeat until the sync diag shows `DRAIN COMPLETE`.
2. Re-run the STEP 1 query on both sides — the diff for your list should be empty.
3. The Work Order dashboards match by themselves once the rows match.

Escalation triggers are the same as the script runbook (MISSING records, `stuck > 0`,
a record that diverges again after a clean drain, unexpected shore-only records).
