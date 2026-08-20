# Phase 1 — Generic Approval Engine (skeleton + demo module) — BUILD REPORT

**Branch:** `feature/approval-engine-phase1` from `feature/approval-engine-phase0` HEAD (`c3ccf454c`, = current `replit_dev`). **Date:** 2026-08-20. **Commits:** `65e697352` design v3 · `73c3c3a03` engine + demo + migration (+ this report). Not merged, not pushed.
**Baselines:** tsc **290 → 290** · vitest **144 → 176** passed (engine/demo add 32; opt-in DB suite adds 5 more under `AE_DB_TESTS=1`) · `npm run build` clean · **`dist/index.js` contains 0 references to the engine — zero runtime change to the product** (nothing imports it; the demo card is the only consumer). Golden rule intact: no Technical code, route, screen or table touched.
**Migration numbers used:** **168** (`168_approval_engine_tables.sql`) — next-free confirmed against 167 before creating; 144 stays reserved. Nothing else.

---

## 1. Design v3 (`APPROVAL-ENGINE-DESIGN-v3.md`, commit `65e697352`)

One document, committed before any code, folding all ten §A decisions with a table of exactly which v2 statements are superseded (step-list → graph; AND/OR → quorum `all|any|nOfM`; + mode field, service shape, two entry points, repository interface, tenant-awareness with per-scope enable flag, engine-emitted events, role-ids-never-names, import boundary). Unchanged v2 items (shore-only, NO_SYNC, rejection = return-to-submitter, snapshot isolation, cap 6 steps) restated.

## 2. What was built (path:line)

**Engine folder `server/modules/approval-engine/` — imports nothing outside itself (+ node_modules / node builtins):**
- `core/types.ts` — all DTOs; graph node types incl. the v1-rejected ones (`:20`), quorum (`:22`), mode (`:23`), `EngineCtx` tenant+actor (`:118`), events (`:135`), the `ApprovalCard` contract (`:158-180`).
- `core/registry.ts` — `CardRegistry.register()` boot validation (`:24-63`): missing function / duplicate module / duplicate scope / duplicate classification → `CardRegistrationError` with the exact reason; `tree()` merged registry (`:72-81`).
- `core/validateWorkflow.ts` — v1 validator: mode `advanced` rejected (`:16`), condition/fork types rejected "not yet supported" (`:56-58`), linear 1..6 approval-steps + exactly one `end`, single entry, no cycles, quorum sanity (`nOfM` bounds `:44-47`).
- `core/engine.ts` — `submit` (`:77-121`: enabled? → classify → active workflow? → ALREADY_PENDING? → snapshot → slots → activate entry with per-slot `resolveApprovers`, `step-activated` event + `onPending`), `decide` (`:145-199`: 404/409/403 → record → quorum eval → supersede-not-delete → advance or finalize), single-fire `onDecision` guarded by the repository's pending→terminal transition (`finalize` `:202-231`), `status`, `pendingForUser`, versioned `saveWorkflow`, `get/setScopeEnabled`.
- `core/repository.ts` — `ApprovalRepository` + `TenantRepositoryProvider` interfaces (engine core has zero DB knowledge).
- `db/schema.ts` + `db/drizzleRepository.ts` — the only production repository (Drizzle over node-postgres); `saveWorkflowVersion` transactional supersede+insert (`:79-107`), `finalizeRequest` = `UPDATE … WHERE status='pending' RETURNING` (`:196-202`, the exactly-once guard), `DrizzlePoolProvider` tenantId→Pool (`:236-256`).
- `http/router.ts` — zod on every body (`:44-63`); office guard on config writes with Phase-0 semantics, self-contained and injectable (`:76-80`); engine/validation errors → 4xx (`:82-91`); routes: registry, roles, workflows (GET/GET:id/POST), scopes/enabled (GET/PUT), requests (POST, :id/decide, status), pending.
- `index.ts` — `startEmbedded(app, deps)` (`:38-50`) and `startStandalone()` (`:74-97`, own Express + pg bootstrap, `/health`).
- `client/ApprovalEngineAdmin.tsx` — generic admin page (react import only): registry tree → scope → classification → Sahil's step builder (Select Approver → chips → AND/OR per row → ✓ save = new active version), mode selector with **advanced disabled ("coming soon")**, per-tenant enable toggle, versions list. No product strings.
- `INTEGRATION-GUIDE.md` — the three wiring points with before/after snippets, card how-to (demo as the example), rules (module safety checks BEFORE decide; `onDecision` idempotent; never read `apprv_*`), 9-point verification checklist, old-config migration pattern.
- `__tests__/importBoundary.test.ts` — §A10 enforcement (see §5).

**Outside the engine folder (boundary proof):** `server/approval-demo/` — `demoCard.ts` (2 screens, 2 classifications each, 3 fake roles, in-memory `resolveApprovers`, call-recording `onDecision`/`onPending`), `standaloneDemo.ts` runner, `__tests__/` (in-memory repository test double + 3 suites).

**Tables (migration 168, per tenant DB, all `apprv_`):** workflows (versioned, mode, partial unique = one active per scope+classification) · workflow_nodes (type, quorum) · node_edges (the graph) · node_slots (role_id + role_label snapshot) · requests (snapshot_json, status, subject_ref, vessel, partial unique = one pending per scope+subject) · request_slots (5 statuses, decided_by/at, remarks, resolved approver ids) · scope_settings (enable flag, default true). NO_SYNC (not in syncConfig — the sync engine only touches configured tables), no FKs/CHECKs on text columns, idempotent.

## 3. Test matrix (all executed; commands in the file headers)

| area | cases | result |
|---|---|---|
| registry (B8.1) | valid card loads; missing fn refuses boot w/ precise error; dup moduleId; dup classification | 4/4 |
| submit (B8.2) | classification routing (critical→director wf); NO_WORKFLOW fallback; DISABLED then re-enabled; ALREADY_PENDING w/ same requuid; unknown scope 404 | 5/5 |
| snapshot (B8.3) | edit workflow mid-flight → in-flight request completes on the OLD graph; new submit uses the new one | 1/1 |
| quorum (B8.4) | `all` (2 slots, advances only after both); `any` (other slot SUPERSEDED, row kept); `2-of-3` | 3/3 |
| decide (B8.5) | wrong role 403; not-your-turn (later node's approver) 403; multi-step advance w/ events + onPending approvers; decided request 409 + onDecision EXACTLY once (call recorder); reject → returned, remaining superseded, onDecision(returned) once | 5/5 |
| pendingForUser (B8.6) | across the two demo scopes | 1/1 |
| tenant isolation (B8.7) | provider-level: same scope, different workflows, same subjectRef both tenants, no leakage | 1/1 |
| boundary (§A10) | every import specifier of every engine file resolves inside the folder / node_modules; banned-path spellings | 3/3 |
| HTTP + boots (§A5/B5) | embedded boot on a host express; registry; config write vessel/anonymous 403 + office 201; zod 400; mode advanced 400; condition node 400; full flow submit→pending→decide→status; scope toggle; **standalone boot** (own express, /health, close) ×2 incl. broken-card refusal | 9/9 |
| **DB suite (opt-in `AE_DB_TESTS=1`, real Postgres)** | migration applied **twice** (idempotent) on 2 scratch DBs; versioned save v1→v2 supersede under the partial unique; full flow + 409 replay + onDecision once on Postgres; pending unique index → ALREADY_PENDING; **tenant isolation on two real databases** (independent version numbering, same subjectRef, pendingForUser separation); per-tenant disable | 5/5 |

Full `npx vitest run`: **176 passed** (repo-wide), 0 failed. tsc 290.

## 4. Standalone-boot proof + admin-screen walkthrough (pilot, `pms_arch`)

- Shore restarted from the branch tree → boot log `Applying SQL migration: 168_approval_engine_tables … applied successfully`; `schema_migrations` row present; all 7 tables created. Second boot: 0 apply lines (skipped as applied). Direct re-run of the SQL file on `pms_arch`: clean no-op, still 7 tables.
- `AE_DATABASE_URL=<pilot> npx tsx server/approval-demo/standaloneDemo.ts` → `GET :5055/health` = `{"status":"ok","service":"approval-engine","mode":"standalone"}`; `GET /approval-engine/registry` = the demo tree. **Standalone boots against a pilot DB — proven, not designed.**
- Route-level walkthrough of the admin screen's exact calls (`scripts/p1-walkthrough.ts`, log `local-test-env/p1-walkthrough.log`) — **16/16**: registry tree → roles dropdown (3 demo roles) → save as vessel 403 → mode `advanced` 400 → save v1 (201 active) → save again v2 (v1 superseded) → versions list → tenant toggle off → submit `DISABLED` → toggle on → submit STARTED at step-1 → manager in `pendingForUser` → director too early 403 → manager approves (OR) → step-2 activated → director approves → **approved** → replay 409 → status shows reviewer slot `superseded` (kept). Every `apprv_*` row deleted afterwards (counts in the log).

## 5. §A items that could not be implemented as written (nothing silently deviated)

1. **§A10 "ESLint rule (or dependency-cruiser) that FAILS the build"** — the repo has **no lint infrastructure at all** (no eslint config/dependency, no lint step in `npm run build`, which is vite+esbuild only), and adding a new dev dependency would touch package.json/lockfile (a surface we keep frozen for the Replit-fork workflow). Implemented instead: `__tests__/importBoundary.test.ts` **inside the engine folder** — mechanically parses every import/require/export-from specifier of every engine file and fails vitest on any specifier that resolves outside the folder or uses an app alias, plus a banned-spelling check for Technical paths. vitest is the merge gate we actually run; if a repo-wide ESLint is ever introduced, add `no-restricted-imports` for the same paths.
2. **§A7 "reuse the existing tenant resolution"** — reused **by injection**, not by import (the boundary forbids importing `tenantMiddleware`): `startEmbedded` accepts `resolveTenantId(req)`; the host passes its ALS/JWT-based resolver at wiring time (next phase). The default (`x-tenant-id` header → `'default'`) matches the pilot's single-tenant reality. Same pattern for the office guard: Phase-0 semantics are implemented self-contained in the router and the host may inject its real `requireRole` via `requireConfigWrite`.
3. Everything else in §A implemented as specified.

## 6. Next-phase readiness (what Technical wiring needs)

1. **Mount**: one `startEmbedded(app, …)` call in `server/routes.ts` with `DrizzlePoolProvider` over the tenant connection manager, `resolveTenantId` from the ALS context, `requireConfigWrite = requireRole([...])`, `onEvent` → the notification surface (validation report: CR/postponement notifications are net-new).
2. **Technical card**: `listRoles` from the ruid-anchored role source (validation finding C — org chart cannot resolve office roles; the recommended name-join needs deciding), `classify` reusing the existing CR/postponement classification code, `resolveApprovers` per vessel/tenant, `onDecision` calling the (Phase-0-fixed) apply paths — which are already idempotent-guarded (CR decide-once, postponement one-tx).
3. **Route the admin screen**: `client/ApprovalEngineAdmin.tsx` behind an admin menu entry (first Technical client change), replacing `ApprovalWorkflow.tsx` only at cutover.
4. **Matrix migration**: the §6 generator pattern (INTEGRATION-GUIDE last section) + the pool-step decision (validation finding A) — awc rows map to 1-step workflows with quorum `any` pool slots; needs the role-source decision first.
5. **Open decisions still with Ghazi/Jeevan**: role-resolution source (C), ship mid-chain visibility (B2), superintendent-ack as step vs side-channel — none blocked Phase 1; all block Phase 2's Technical card.

## 7. Pilot records — created / deleted

Walkthrough + DB tests created rows only in `apprv_*` tables (pilot `pms_arch`) and two scratch databases (`apprv_p1_t1/t2`); all deleted (walkthrough cleanup counts logged; scratch DBs dropped in `afterAll`). The 7 empty `apprv_*` tables remain on `pms_arch` (they are the migration's product, as tables 001-167 do). No Technical/demo rows anywhere else; shore left running on the branch tree; ship container untouched (still Phase-0 build — the engine is shore-only and nothing ships-side references it).
