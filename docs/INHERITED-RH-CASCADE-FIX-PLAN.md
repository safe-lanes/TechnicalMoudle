# Inherited-RH cascade fix — PLAN (parked 2026-07-28, build later)

**Status: APPROVED IN SHAPE, not built. Waiting on nothing to build except the go-ahead.**
Mechanism re-proven live 2026-07-28 (second full-loop test with raw values at every step —
see the proof table at the bottom). **The 2026-07-28 re-test CORRECTED the mechanism** vs the
first write-up of this plan; this version is authoritative.

## The corrected mechanism (2026-07-28 re-test)

The SHIP's cascade is CORRECT: entering RH on a master (`updateMasterRH`,
`postgresStorage.ts` cascade) writes each inherited child's
`rh_current_inherited_cached = meterReplacedLastRh + newReading` and delta-updates
`current_cumulative_rh`. Verified live: child cache = 20.00 immediately after entry.

The failure is a ROUND TRIP, not a one-way omission:

1. Ship→shore: RH travels ONLY via `running_hours_audit` (components is
   ONE_WAY_SHORE_TO_SHIP — ship component rows never push). The 3 shore apply sites
   reconstruct the child `components` row and (a) **never write
   `rh_current_inherited_cached`** and (b) **wrongly stamp `rh_current_master` on
   INHERITED rows**. Sites: `oneWayApplier.ts:866`, `service.ts:502`, `syncEngine.ts:1279`.
2. **Bounce-back (the corrected part):** the shore's reconstructed row has a fresh
   `updated_at`, so the ONE_WAY components snapshot carries it BACK to the ship, where it
   **OVERWRITES the ship's correct row** — the ship's cache is ERASED to NULL and the
   poison `rh_current_master` is copied down. Proven live: ship child cache 20.00 → NULL
   one sync cycle after entry.
3. Both sides converge to the SAME wrong row (cache NULL, poisoned master) — so there is
   NO ship-vs-office mismatch to notice.

## Why the field sees "correct" values (Jeevan's 2026-07-28 dev verification)

The Components page reads `rhCurrentInheritedCached || currentCumulativeRH || runningHours`.
After the round trip the cache is NULL on BOTH sides → both fall back to
`current_cumulative_rh`, which syncs correctly → **the displayed value is right**. Jeevan
verified exactly this on dev and his result is genuine. It is masking, not a fix:

- **NULL cache (the common post-bounce state): display correct, data model corrupted**
  (inherited rows carry a master counter; the cache column is dead).
- **NON-NULL stale cache: display FROZEN** at the old value — the cache wins over
  cumulative. This is the import-seeded case (`importService.ts:2907` writes the cache
  from the sheet) and any family whose cache predates the bounce. The freeze propagates
  to the SHIP too (same bounce-back).

Plus the pre-existing **`'NOT RH DRIVEN'` (spaces) vs `'NOT_RH_DRIVEN'` (underscores)**
mismatch (~30 dev rows, 6 wrong branches) that mis-classifies non-RH components.

## The stale-count caveat (reconciliation sizing)

The per-vessel count query (`cache IS DISTINCT FROM master.rh_current_master`) counts BOTH
states above — NULL-cache rows (display fine, model wrong) and non-null stale rows
(display frozen). Dev's 667 therefore OVER-STATES the visible problem while correctly
counting the data problem. Before migration 149 runs on production, split the count:
`cache IS NULL` vs `cache IS NOT NULL AND cache <> master` — the second number is the
user-visible one.

## The four parts

**A. Applier — ONE shared helper, branch on the target's counter type** (replaces the 3
   divergent statements). Tolerant resolution `upper(replace(...' ','_'))`.
   - MASTER audit row → update `rh_current_master` + `current_cumulative_rh` (as today) AND
     **cascade `rh_current_inherited_cached = <master total>` to its inherited children**
     (OR-key resolved). This mirrors what the ship cascade already does correctly.
   - INHERITED audit row → update `current_cumulative_rh` (as today), **STOP writing
     `rh_current_master`** (fixes the poison).
   - NOT_RH_DRIVEN → skip.
   - Order-independent (master cascade fixes cache; child branch never poisons).
   - Fixing the SHORE writer also kills the bounce-back: the row that snapshots back to
     the ship becomes correct, so the ship's cascade result is no longer overwritten
     with wrong values.

**B. Migration 149 — one-time reconciliation + cleanup** (149 confirmed free; 144 stays
   reserved). Idempotent (`WHERE ... IS DISTINCT FROM ...`; 2nd run = 0 rows). Runs both
   sides — and MUST run both sides: after the bounce-back, the SHIP is as wrong as the
   shore (the original "ship is a no-op" assumption is retired with the old mechanism).
   - `rh_current_inherited_cached = <master total>` where different.
     🔴 **FROM THE MASTER, NEVER FROM CUMULATIVE** — a cumulative recompute destroys the
     legitimate master-absolute value.
     🔴 **METER-REPLACEMENT CAVEAT**: the correct cache is
     `meterReplacedLastRh + master reading`, NOT raw `rh_current_master`. Use the SAME
     formula as the live ship cascade (`postgresStorage.ts` updateMasterRH child .set()),
     offset included, or meter-replaced equipment gets "corrected" to a wrong (too-low)
     value.
   - Clear `rh_current_master` on inherited rows (poison cleanup).
   - Normalise `'NOT RH DRIVEN'` → `'NOT_RH_DRIVEN'`.
   - **Size against the SPLIT production counts first** (see caveat above); dev showed 667
     combined across 6 vessels; the pilot cannot measure this (fresh provision = 0).

**C. Importer** — add space→underscore normalisation at `importService.ts:2882` (currently
   only `.toUpperCase().trim()`), so a future "Not RH Driven" sheet value can't
   re-introduce the spacing.

**D. Tolerant branch** in applier + reconciliation (belt-and-suspenders with B+C).

## Sequencing
A + B ship in the SAME build/deploy — B cleans the past, A prevents the future. Migration
149 runs at boot with the fixed applier already in the binary. Deploy order note: until
BOTH shore and ships run the fixed build, a mixed fleet keeps re-poisoning via whichever
side still runs the old code — the reconciliation may need a re-run (or drift re-accrues)
until the fleet converges; the migration is idempotent, so re-running is safe.

## Risks / must-not-break
- MASTER-component sync stays byte-identical (master branch = today + the child cascade).
  Regress it.
- The child cascade is a set UPDATE per master audit row — confirm it doesn't balloon
  (pilot master has 49 children). RH batches are small.
- Null master → cache null → UI falls back to cumulative. Handle nulls explicitly.
- Meter-replacement offset (see B) — the one way to introduce NEW wrong data. Handle it.
- ONE_WAY reconstruction only; no field logs, no push-back; confined to `components`.

## Test plan
1. **Live pilot re-proof against the FIXED build** — repeat the 2026-07-28 loop below; the
   expected end state is cache = master total on BOTH sides after the full round trip
   (entry → sync → bounce-back), and NO `rh_current_master` on inherited rows.
2. Regression: MASTER sync unchanged; harness suite green; tsc baseline held.
3. Reconciliation: seed BOTH wrong states on shore (NULL cache; stale non-null cache), run
   149, cache = master-formula; re-run = 0 rows. Include a meter-replaced master case →
   cache = offset+reading, not raw master.
4. Spacing: a `'NOT RH DRIVEN'` component branches correctly after normalisation.
5. New harness `test-inherited-rh-cascade` (untracked).

## Open questions to confirm at build time
1. Migration 149 (144 reserved) — OK.
2. INHERITED branch belt-and-suspenders (also look up + set child cache) vs trust the
   master cascade — leaning include for robustness against a missing master audit row.

## PROOF — 2026-07-28 live re-test (matched pilot, build `c6265766b`)

Master 651.001, RH entered 0 → 20 on the ship via `PUT /rh-config/master/:id`
(real cascade, 34 children). Child rows observed raw at each step:

| Step                                 | cache             | cumulative | rh_current_master  |
|--------------------------------------|-------------------|------------|--------------------|
| Ship, after entry (before sync)      | **20.00** ✔       | 20.00 ✔    | (null) ✔           |
| Shore, after sync                    | **NULL** ✘        | 20.00 ✔    | **20.00** ✘ poison |
| Ship, after same cycle (bounce-back) | **NULL** ✘ erased | 20.00 ✔    | **20.00** ✘ copied |

Display stays correct on both sides via the NULL-cache fallback — which is exactly why
field verification (Jeevan, dev, 2026-07-28) reports the values as right while the data
model is wrong on both sides. An earlier version of this plan claimed "office shows stale,
ship shows new" — that framing was WRONG (it missed the bounce-back); this table is what
actually happens.
