# SUPPORT RUNBOOK — Work Order recovery (script method — USE THIS ONE)

**Use this when:** a work order shows on the ship but not in the office, or the two sides show
different authored statuses (Completed / Pending Approval / Postponed / Rejected), typically
because old records were dead-lettered by the pre-July-2026 sync code or written before field
logging covered that path.

**If the script cannot be used** (no ship↔shore connectivity, or `npx tsx` broken on the
ship), fall back to `docs/SUPPORT-WO-RECOVERY-MANUAL-RUNBOOK.md`.

**Verified:** proven live on the shore+ship test pair on 2026-07-29 — scan flagged 2 planted
faults out of 300+ WOs with zero false positives; both repaired and converged in one sync.

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
4. Only touch what the scan flags. Nothing wholesale.

---

## STEP 0 — prerequisites

- Both sides run the July-2026 sync stack or later: open `GET /technical/api/sync/status` on
  each side and confirm the `build` field is present. No `build` field = old build = STOP,
  deploy first.
- The repair script `scripts/repair-wo-deadletter-reoffer.ts` exists in the ship's app
  folder. **If the deployed build doesn't carry it yet, copy the single file manually** into
  the app folder's `scripts\` directory — it is self-contained (uses only the `pg` package,
  already in the app's `node_modules`). No build step, no app restart needed.
- The ship must be able to reach the shore (same connectivity a normal sync uses) — the scan
  asks the shore for its work-order list.

---

## THE PROCEDURE — four commands, in order

All commands run **on the ship machine**, in a terminal, **from the app folder** (the folder
PM2 runs the app from — the one containing `package.json` and `scripts\`).

```bash
cd <ship app folder>
```

If `DATABASE_URL` is not already set in that terminal, set it to the same value as the
ship's `.env` first (PowerShell: `$env:DATABASE_URL = "<value from .env>"`).

**1. FIND — the ship discovers the faulty WOs itself. Changes NOTHING.**

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --scan
```

Every flagged record is printed with its class:

| Class | What it means | What `--apply` will do |
|---|---|---|
| **A** | Sync logs already pending | Nothing — the next sync delivers them |
| **B** | Logs falsely marked "synced" (dead-letter) | Re-offer them (reset to unsynced) |
| **C** | NO logs exist (never-logged write) | Generate full-row logs from the ship's record |
| **MISSING** | Row not on the ship | Nothing — escalate |

The scan also *reports* (but never repairs): shore-only WOs, and Due/Overdue-band-only
differences (computed from jobs/RH inputs — WO repair cannot and must not touch those).
The flagged list is saved to `repair-scan-list.txt` — attach it to the ticket.

**2. FIX — same scan, and repairs everything it flagged.**

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --scan --apply
```

**3. DELIVER — press Sync Now** on the ship's Sync Dashboard. Repeat until the sync diag
shows `DRAIN COMPLETE`. A large first run (up to 20 back-to-back cycles) is normal drain
behaviour, not a fault.

**4. CONFIRM — run the scan again:**

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --scan
```

Expected output: `Nothing flagged — ship and shore agree.` The Work Order dashboards now
match by themselves (computed bands recalculate on page load; no further action).

Safety built in: the script **refuses to run against a shore database**, and without
`--apply` it only prints a report.

---

## ESCALATION — send these to the development team

- Any **MISSING**-class records, and any unexpected **shore-only** WOs from the scan output.
- `retryBacklog.stuck > 0` on `GET /sync/status` after the drain.
- A record that reverts or differs again AFTER a clean drain (attach `repair-scan-list.txt`
  and the ship's sync-diag file for the day).
- Any script error output.

---

## Reference — records the scan does not cover

`running_hours_audit` rows have no direct work-order column, so the scan does not flag them.
If a specific RH audit row must travel, list it in a file (one per line) as
`running_hours_audit:<rhauuid>` and run:

```bash
npx tsx scripts/repair-wo-deadletter-reoffer.ts --file list.txt --apply
```

The same `table:uuid` form works for `component_maintenance_history` rows without their
parent work order.
