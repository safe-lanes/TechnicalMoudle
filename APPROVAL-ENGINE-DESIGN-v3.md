# Approval Engine — Design v3 (Phase 1 baseline)

**Status:** supersedes `APPROVAL-ENGINE-DESIGN-PLAN-DRAFT-v2.md` (on `feature/approval-engine-validation`) where they differ; everything not mentioned here carries over from v2 as amended by `VALIDATION-REPORT-APPROVAL-ENGINE.md`. Folded in: the post-validation §A decisions (Ghazi, 20-Aug-2026). Phase 0 (defect fixes + `req.rbac` server-side role) is merged on `replit_dev` and is a dependency.

## What v3 changes against v2 (summary of superseded parts)

| v2 said | v3 says | why |
|---|---|---|
| Chain definition = **ordered list of steps** (§2b) | **Graph** (nodes + edges). Node types in the schema from day one: `approval-step`, `condition`, `parallel-fork`, `parallel-join`, `end`. **v1 implements only `approval-step` + `end`** — a linear chain is approval-step nodes in a row; the validator rejects the other types ("not yet supported"). | future-proof storage without building branching now |
| Step mode `AND \| OR` (§2b) | **Quorum rule per approval-step**: `all \| any \| nOfM` (+ `n`). Sahil's AND = `all`, OR = `any`. The builder UI still shows only AND/OR buttons. | nOfM is free at the engine level; UI stays simple |
| — | **`mode` field per workflow: `simple` \| `advanced`.** v1: only `simple` creatable; `advanced` visible but disabled in the UI and refused by the API. | names the future without building it |
| Engine as services inside the app (§2a implied in-process only) | **Service-shaped**: every engine operation takes/returns plain JSON DTOs; card callbacks (`listRoles`, `classify`, `resolveApprovers`, `onDecision`, optional `onPending`) go through an **adapter interface** — v1 ships the in-process adapter only; an HTTP adapter is a later phase. No Express types, no module objects inside the engine core. | keeps the engine extractable |
| single mount | **Two entry points:** `startEmbedded(app, deps)` and `startStandalone()` (own Express + DB bootstrap). Both must boot (standalone serves /health + registry + workflows against a pilot DB). | deployment flexibility, proven not designed |
| storage sketch (§2b) | **Repository interface**: engine core talks to `ApprovalRepository`; Drizzle/Postgres is the only production implementation. No direct DB calls from core. | testability + the standalone bootstrap |
| single-tenant wording | **Tenant-aware**: every operation carries tenant context (the existing tenant resolution is reused by injection); the repository is resolved per tenant; engine tables live in each tenant DB. Registry (cards/structure) is global code. **Per-tenant enable/disable flag per (module, screen, action)** — data, default enabled. | production shore is MT |
| notifications open question | **Engine emits events** (`step-activated`, `request-completed`, `request-returned`) with resolved approver user ids; a card may expose `onPending`. The engine core sends nothing itself. | keeps transport out of the core |
| §2c roles by identifier | unchanged, restated: **chains store stable role ids (ruid-style), never names**; a display label is snapshotted alongside for rendering. | WAH-KWONG-PURCHASER lesson |
| — | **Import boundary:** `server/modules/approval-engine/**` imports NOTHING outside itself (+ node_modules). Enforced mechanically (boundary test that fails the suite) — see PHASE1-REPORT §A10 note on lint tooling. | the reuse promise is structural, not aspirational |

Unchanged from v2/validation: engine is **shore-only**; engine tables are **NO_SYNC**; ships keep their existing form-level approvals; the module callback applies changes through already-synced tables; rejection returns the request to the submitter (no mid-chain loop-back in v1); chain edits never touch in-flight snapshots; pool-step migration concern (validation finding A) is deferred to the Technical-wiring phase; hard cap 6 approval-step nodes per workflow.

## v3 data model (engine-owned tables, per tenant DB, prefix `apprv_`)

- `apprv_workflows` — workflow **version** rows: (module_id, screen_id, action_id, classification), `mode`, `version`, `status` `draft|active|superseded`, label, audit. One `active` per scope+classification (partial unique index).
- `apprv_workflow_nodes` — nodes of a workflow version: `node_key`, `type` (`approval-step|condition|parallel-fork|parallel-join|end`), `ordinal`, quorum (`rule` `all|any|nOfM`, `quorum_n`), label.
- `apprv_node_edges` — `from_key → to_key` per workflow version (the graph).
- `apprv_node_slots` — role slots per approval-step node: `role_id` (stable id), `role_label` (display snapshot), ordinal.
- `apprv_requests` — one row per submitted request: scope + classification, `subject_ref`, optional `vessel_id`, **`snapshot_json`** (the full graph + slots at submit time), `status` `pending|approved|returned`, `current_node_key`, submitted_by/at, finalized_at, workflow wfuuid+version it snapshotted. One `pending` request per scope+subject (partial unique).
- `apprv_request_slots` — live progress: per node per slot `status` `pending|active|approved|rejected|superseded` (**superseded slots are never deleted** — audit), `decided_by/at`, `remarks`, `resolved_approver_ids_json` (snapshot taken at activation; feeds pendingForUser + events).
- `apprv_scope_settings` — per (module, screen, action): `enabled` boolean, default true.

## v3 flow (unchanged semantics, restated against the graph)

submit: card.classify → scope enabled? (`DISABLED` outcome) → active workflow? (`NO_WORKFLOW` outcome — module falls back to its legacy behaviour) → already pending for subject? (`ALREADY_PENDING`) → snapshot → create request + slots → activate the entry node (resolve approvers per slot, store ids, emit `step-activated`, call `onPending`).
decide: request pending? (else **409**) → slot active and caller ∈ resolved approvers for the slot's role (else **403**) → record → quorum evaluation (`all`/`any` — supersede the unfired slots — /`nOfM`) → node satisfied → follow the single outgoing edge; `end` reached → finalize (single-fire: the repository's pending→terminal transition guards `onDecision` firing exactly once) → emit `request-completed`. reject → all remaining slots superseded, request `returned`, `onDecision(returned)` once, emit `request-returned`.
Workflow editing: a save creates a **new version** and supersedes the previous active one; in-flight requests keep their snapshot.

## Phase 1 scope statement

Phase 1 builds the engine skeleton + a **demo card only** (no Technical wiring, zero user-visible change). The demo card lives outside the engine folder and is the boundary's first proof. Technical's three real integrations (CR, postponement, re-postponement) and the pool-step matrix migration are the next phase.
