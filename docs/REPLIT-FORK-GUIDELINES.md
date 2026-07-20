# Replit Fork Guidelines (feature/replit-work)

Rules for all work done on the Replit fork — for the developer AND for every
prompt given to the Replit Agent. Most of the cleanup effort in fork→replit_dev
merges goes into exactly these areas; following them makes merges fast and safe.

Audience: Nilesh + anyone prompting the Replit Agent on this codebase.
Companion to `CLAUDE.md` (Engineering Standards section) — that file is the
authority; this one is the fork-specific working summary + prompt kit.

---

## 1. Migrations — numbering and naming

- Before creating ANY migration, check the highest number on **origin/replit_dev**,
  not just the fork. (As of 2026-07-20 the highest is `138_repair_spare_location_stock_drift.sql`
  — the next new migration is `139_...`.) One command:

  ```bash
  git fetch origin replit_dev && git ls-tree --name-only origin/replit_dev migrations/ | sort | tail -5
  ```

- **Never reuse an existing number or filename.** The migration runner keys by
  full filename, so collisions don't break it — but every collision creates
  rename work and confusion at merge time (the fork's ROB migration arrived as
  "136" while replit_dev already had a different 136).
- Every migration must be **idempotent**: second run = 0 rows changed, 0 errors.
  - `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
  - Seeds: `ON CONFLICT (name) DO NOTHING` or `WHERE NOT EXISTS (...)` —
    **never** `ON CONFLICT (id) DO NOTHING`, never hardcoded primary-key ids
  - Reference lookups by NAME, not id (ids differ across databases)
- A new table that will sync **must have `is_deleted BOOLEAN DEFAULT FALSE`** —
  the provisioning exporter filters `COALESCE(is_deleted,false)=false` and
  bundle generation throws without the column.
- Test the migration twice locally before committing.

## 2. Sync path — do not touch, do not regress

- **OFF LIMITS without explicit sign-off:** `server/modules/sync/`,
  `shared/syncConfig.ts`, and the field logger. Say this to the Replit Agent
  verbatim in every prompt.
- Any write to a **synced table** (work_orders, spares, spare_location_stock,
  defects, components, …) must go through the storage methods that call
  `logFieldChanges`. A raw `db.insert/update/delete` on a synced table means
  the change **silently never syncs** — the #1 regression class caught in fork
  merges. If the agent writes a raw DB call, reroute it through the existing
  storage method.
- No CHECK constraints or enums on synced text columns (they reject values
  arriving from the other side).

## 3. Surgical vs. regression changes — escalate the big ones

- **Surgical** (fine on the fork): additive, scoped to the feature's own files,
  no rewrites of existing functions, no shared-infrastructure edits.
- **Regression-risk** (STOP — send to Ghazi; it gets done on replit_dev with the
  full regression-harness suite): rewriting an existing shared function
  (postgresStorage methods, status computation, schedulers, approval-tier
  logic, anything under sync), changing existing behaviour, or "refactoring
  while here".
- Unsure which kind it is? It's a regression one — ask first.
- The Replit Agent specifically likes to rewrite whole functions when asked for
  a small fix. Always prompt: *"make the minimal change; do not restructure
  existing code."*

## 4. Standard backend practices

- **Layering: routes → controllers → services → repositories → storage.**
  Routes only delegate. Controllers parse input / format response. Services
  hold business logic. Repositories own DB access. No skipping layers; no raw
  DB calls in services.
- **No N+1 queries** — never a per-row lookup inside a loop; use or add a batch
  method (e.g. `getLinkedComponentsForJobs(ids[])`).
- **Express route ordering** — specific before `/:param`; never create
  colliding param shapes (`/things/:vesselId` vs `/things/:id` — use distinct
  paths like `/things/details/:id`).
- **No duplicate file basenames** — grep for the name before creating any file;
  dead duplicates exist (two `jobService.ts`) and have bitten us.
- **`npx tsc --noEmit` before every commit** — error count must not increase.
  No `as any` / `@ts-ignore` to silence real type errors.
- **AG Grid versions are license-capped** — ag-grid 34.1.0 / ag-charts 12.3.0,
  pinned exact. Never upgrade.
- Keep Replit junk out of commits: `attached_assets/`, exported xlsx/csv,
  one-off SQL in `exports/`. It gets stripped at merge time, but clean commits
  merge faster.

## 5. Before starting new fork work

```bash
git fetch origin
git reset --hard origin/feature/replit-work
```

Never build on a stale base — the fork and replit_dev are kept converged after
every merge; starting from an old checkout recreates already-merged history.

---

## Example Replit Agent prompt (template)

Copy this shape for every task. The GUARDRAILS block is constant — paste it
every time; the agent has no memory of previous prompts.

```
TASK #<nnn>: <one-line goal — e.g. "Add a 'Received By' field to the spares
receive dialog and persist it with the receive transaction">

CONTEXT
- Frontend: client/src/pages/spares/... (the receive dialog lives in <file>)
- Backend path: routes → controllers → services → repositories → storage.
  The receive flow enters at server/modules/spares/routes.ts and ends in
  storage.receiveSpareToLocation.
- The spares and spare_location_stock tables ARE SYNCED between ship and shore.

WHAT TO DO
1. <numbered, concrete steps — the smaller each step, the better the output>
2. ...

GUARDRAILS (do not violate any of these)
- Make the MINIMAL change. Do not restructure, rewrite, or "improve" existing
  functions. Do not rename or move files. If the fix seems to require
  rewriting an existing shared function, STOP and say so instead of doing it.
- Do NOT modify anything under server/modules/sync/ or shared/syncConfig.ts,
  and do not touch the field logger.
- All database writes to synced tables must go through the existing storage
  methods (they call logFieldChanges). Never write raw db.insert/db.update/
  db.delete for these tables in services or controllers.
- Follow the layering: routes only delegate; controllers parse/format;
  services hold business logic; repositories own DB access.
- No per-row queries inside loops (no N+1) — use or add a batch method.
- If a migration is needed: next free number is 139 (verify against
  origin/replit_dev first), filename must be unique, fully idempotent
  (IF NOT EXISTS / ON CONFLICT (name) DO NOTHING / WHERE NOT EXISTS; never
  hardcoded ids; never ON CONFLICT (id)). If the new table syncs, include
  is_deleted BOOLEAN DEFAULT FALSE.
- New Express routes: register specific paths before /:param routes; no
  colliding param shapes.
- Before creating any new file, check no file with the same basename exists
  anywhere in the repo.
- Do not add or upgrade dependencies. Never touch ag-grid/ag-charts versions.
- Run npx tsc --noEmit and report the error count — it must not increase.
- Do not commit attached_assets, exports, screenshots, or one-off SQL.

ACCEPTANCE
- <how to verify — exact user-visible behaviour, and what must NOT change>
- tsc error count unchanged; only the files listed in WHAT TO DO modified.
```

### Filled-in mini example

```
TASK #342: Show the supplier PO number on the Spares history tab.

CONTEXT
- spares_history already stores supplier_po (no schema change needed).
- History tab: client/src/pages/spares/SpareHistoryTab.tsx; data comes from
  GET /spares/:id/history (server/modules/spares/).

WHAT TO DO
1. Include supplierPo in the history response (service layer maps it; the
   repository query already selects the column — verify, don't rewrite).
2. Add a "Supplier PO" column to the history table in SpareHistoryTab.tsx,
   after "Qty". Show "—" when null.

GUARDRAILS
<paste the full GUARDRAILS block from above>

ACCEPTANCE
- History tab shows the PO for receive rows that have one, "—" otherwise.
- No other columns, endpoints, or files changed. tsc count unchanged.
```
