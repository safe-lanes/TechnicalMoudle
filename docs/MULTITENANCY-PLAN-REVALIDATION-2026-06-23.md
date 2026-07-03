# Multi-Tenant Plan — Re-Validation (2026-06-23)

> **Companion to** [`docs/multi-tenant/`](./multi-tenant/README.md) (the committed Phase 0–5 plan, last touched `b2cc1e8d0`, 2026-04-24) and [`docs/V2-Multi-Tenant-Approach.md`](./V2-Multi-Tenant-Approach.md).
>
> **Purpose.** The original plan was validated against the codebase ~2 months ago (then re-checked against `feature/replit-work @ 2752b1cba`, tsc 373). A lot has merged since. This doc re-validates the plan against **`feature/replit-work @ 7bcc060ab`** (`replit_dev @ 203f2f80d`), **tsc baseline 368**, migrations `121–130` + `0063`. **Read-only — no code changed.**
>
> **It does not replace the plan.** It records what is still true, what changed, and the **gaps to fold into specific phases** before building.

---

## TL;DR verdict

**The plan is still sound, and the codebase has moved *in its favor*.** The single hardest item in the original validation — background schedulers on shore — is **largely de-risked** because the scheduler-redesign already landed. There are **three concrete gaps** the existing plan does not cover, all fixable inside the existing phase structure:

| # | Gap | Lands in | Severity |
|---|---|---|---|
| **G1** | `getPostgresClient()` is called by **29 sites in 11 repo files** — none addressed by the plan's leak-vector list (which only covers 11 module-`db` imports). These bypass ALS. | **Phase 0 + Phase 1** | 🔴 correctness |
| **G2** | The plan makes only **`getDb()`** ALS-aware (Phase 1 §6). `getPool()` is used by the **entire sync layer (~197 calls)** and is never wrapped. | **Phase 1** | 🔴 correctness |
| **G3** | The **sync receive path (ship→shore push/pull)** is server-to-server, not a browser request — the Phase 3 frontend interceptor does **not** put `x-tenant-id` on it. No phase says how the ship's `syncEngine` declares its tenant on the wire. | **Phase 2 (or a new Phase 2.5)** | 🔴 correctness |

Plus several **refinements** (scheduler list shrank, numbers moved, a parent-token lesson from Crewing) detailed below.

---

## Part A — What is still TRUE (confirmed against current code)

| Plan claim | Original ref | Current ref | Status |
|---|---|---|---|
| Single global pool, lazy-cached, to wrap | `postgresClient.ts`, `db.ts` | `postgresClient.ts:26-60` (`resolvePostgres` → one `cachedPostgres`) | ✅ unchanged shape |
| `getDb()` async, single chokepoint | `db.ts` | `db.ts:33` | ✅ (line moved) |
| `getPool()` async | `db.ts` | `db.ts:45` | ✅ |
| Eager `pool`/`db` export = the leak path | `db.ts:11-21` | `db.ts:11-27` | ✅ (Phase 0 §3.1 / Phase 5 removal still valid) |
| `postgresStorage.ts` already funnels through `await getDb()` (the "Single Big Idea" lever) | README §4 | **581 `getDb()` calls, 422 in `postgresStorage.ts`** | ✅ confirmed — making `getDb()` ALS-aware routes them all |
| ~~Mock auth injects hardcoded `Sail Admin`~~ — **refined, see Part B6** | `auth.ts` | `auth.ts:92-135` (`mockAuthMiddleware`) | ⚠️ **Split the claim:** in deployment **identity is REAL SAILERP** (forwarded headers), but **authorization/verification is mock** (role hardcoded, no `jwt.verify`). Real *verified* auth remains the #1 prerequisite. |
| No `tenant_id` columns anywhere; soft tenancy via `vessel_id` | schema | confirmed (0 `tenant_id` refs in sync layer) | ✅ db-per-tenant model (no row-level filters) holds |
| Single API surface `/technical/api/*`, mode switch on `MASTER_DATABASE_URL` | README §6.2 | confirmed | ✅ |
| Crewing reference pattern (registry / TCM / ALS / lazy migration / JWT `domain`) | — | All 7 reuse files present & operational on `upgraded_crewing_architecture_v2` | ✅ intact |

---

## Part B — What CHANGED since the plan was written

### B1. Schedulers — the original "top risk" mostly evaporated ⬇️
The **scheduler-redesign already landed** on this branch. The plan's Phase 5 §6 / Phase 4.5 "wrap every background loop in `runInTenantContext`" list is now **stale and much smaller**:

| Scheduler | Plan assumed | Reality now | Phase 4.5 action |
|---|---|---|---|
| `workOrderStatusRecalculator` | shore loop to wrap | **REMOVED** (never started; compute-on-read) | **none** ✅ |
| `jobDueScanner` | shore loop to wrap | **ship-only, daily**, `isShip()` gated | **none** ✅ |
| `syncAutoScheduler` | — | ship-only, per-vessel guard | **none** ✅ |
| `syncPruning` (24h) / `syncHealth` (6h) | — | run on both, but per-DB (each tenant DB owns its `sync_*`) | route via tenant pool; per-tenant loop |
| **`pmsAlertEngine` (5 min)** | shore loop to wrap | runs on both, **NO re-entrancy guard**, vessel-unaware queries | **the one real shore loop to wrap** + add a guard |

**Net:** Phase 4.5 shrinks from "wrap all schedulers" to "wrap `pmsAlertEngine` + `syncPruning` + `syncHealth` in a per-tenant maintenance orchestrator, and give `pmsAlertEngine` the missing re-entrancy guard." The old gate *"land scheduler perf phases before shore go-live"* is **no longer blocking** — those phases targeted the now-removed/ship-only scanners.

### B2. Leak surface is bigger than the plan's list (→ G1)
- **Module-level `db` import: 11 files** (plan lists 9). The two new ones are scripts; the 9 server files match. `pool` import: **0** ✅.
- **`getPostgresClient()` direct callers: 29 calls across 11 files** — defects (8), components (7), cert-surveys (8), ranks (4). **The plan never mentions `getPostgresClient()`.** These read the cached single client *synchronously* and would bypass ALS → wrong-tenant reads/writes. See **Part C / G1** for the fix.
- `resolvePostgres()` direct callers: 3 (`initDb`, `migrations`, `storageFactory`) — init path, handled by Phase 0's pool-arg refactor + Phase 4 per-tenant loop.

### B3. New audit-actor ALS already coexists
`requestContext.ts:32` now runs an **audit-actor `AsyncLocalStorage`** (added by the audit Phase 0 work, `resolveAuditActor`/`getAuditActor`). The tenant ALS (Phase 1) is a **separate, independent** ALS instance — they coexist cleanly. ⚠️ One ordering note: `tenantMiddleware` must wrap everything doing DB work; `requestContextMiddleware` only reads `req.user`, so order is flexible, but keep `tenantMiddleware` outermost.

### B4. Client interceptor already carries 3 header families
`activeRank.ts` now injects `x-rank` + `Authorization (Bearer)` + `x-user-*` (audit identity). The plan's Phase 3 `installApiInterceptor` (adding `x-tenant-id`) slots in as a 4th — the consolidation it describes is already half-done.

### B5. Numbers moved
- **tsc baseline 368** (plan/validation assumed 373). Phase 0/1 "byte-identical, verify tsc" gate now targets **≤ 368**.
- Migrations now `121–130` + `0063`; the runner keys by full filename and tolerates per-statement duplicate-object errors (idempotent) — consistent with the plan's migration policy.
- New per-instance sync env knobs (`SYNC_PUSH_BATCH_SIZE`, `SYNC_REQUEST_TIMEOUT_MS`, …) are **per-instance**, not per-tenant — no conflict with the plan.

### B6. Auth & SAILERP identity — corrects "still mock auth" (2026-06-23 deep-dive)
The original validation's "auth is mock" is **too coarse** for the deployed reality. Traced on this branch (mock is local-only; deployed runs beside the real SAILERP app — same integration pattern as Shipskart). **Two things must be stated separately:**

| | Deployed reality | Evidence |
|---|---|---|
| **(i) Real SAILERP identity ARRIVES** | ✅ Yes | SAILERP login writes `userProfile`/`domain`/`credentials`(JWT) to localStorage; `AuthContext.tsx:216-332` hydrates the real user; interceptor forwards `x-rank` + `Authorization: Bearer` + `x-user-*` on every `/technical/api` call (`activeRank.ts:121-127`). Server reads `x-user-*` into `req.user` **identity** fields (`auth.ts:109-131`). |
| **(ii) Authorization ENFORCED on it** | ❌ No | `req.user.role` is hardcoded `"Sail Admin"` (`auth.ts:122`); the real role is parked in `forwardedRole` and **never read by `requireRole`** (`auth.ts:17-35`). |
| **Anything VERIFIED** | ❌ No | **No `jwt.verify` / `jsonwebtoken` / `Authorization`-read anywhere in `server/`** (grep = 0). The SAILERP Bearer is forwarded but ignored. Headers are trusted-not-verified (spoofable). |
| **Switch mock↔real** | none | `mockAuthMiddleware` is mounted **unconditionally** (`routes.ts:37`); no `MASTER_DATABASE_URL` branch. Plan's Phase 2 swap is **not built**. What differs local vs deployed is only *what the client forwards*, not the server middleware. |

**→ THE GATING FINDING — the tenant key (`domain`) already arrives, and is already in use:**
- The client already holds it: standalone encrypted `localStorage["domain"]`, read by `AuthContext.resolveDomain()` (`AuthContext.tsx:57-75`, exposed as `AuthContext.domain` :153-155). **Same `domain` mechanism Crewing keys tenants off.**
- It's **already used as a tenant key** to call SAILERP's domain-scoped master data: client passes `?domain=` → server proxies `${baseUrl}/<endpoint>?domain=…` (`routes.ts:55-69`, `83-98`; endpoints incl. `users`, `vessels`, `mocapprovers`). So **SAILERP's own API is already multi-company/domain-partitioned.**
- **Two gaps before it can route a DB:** (1) **transport** — `domain` is *not* in `ActiveIdentity`/`toActiveIdentity` (`activeRank.ts:12-18`, `AuthContext.tsx:192-203`), so it's not forwarded on normal requests, and no middleware reads it; (2) **trust** — the *localStorage* `domain` is just a forwarded value, but the **trustworthy copy is the signed `domain` claim inside the SAILERP Bearer JWT** — PMS just has to `jwt.verify` it.
- ✅ **CONFIRMED 2026-06-24:** the SAILERP token payload is **`{ id, domain, userType }`, signed** — **identical to Crewing's claim set**. So `domain` is a **trustworthy, verifiable tenant key**, not a spoofable localStorage value. The tenant key is available end-to-end; PMS only needs server-side `jwt.verify(token, JWT_SECRET)` and to read the verified `domain`. (No longer "open to confirm.")

**Ship offline identity (1d) — CORRECTED 2026-06-24 (supersedes the earlier "no SAILERP offline" premise):**
**Architecture:** SAILERP is the main application; Technical + Crewing are MFE modules. The whole package (SAILERP + Technical + Crewing) installs as ONE unit — shore (online) **or on a ship (local install)**. So **SAILERP runs locally on the ship**, issuing/verifying tokens offline exactly as shore does against its SAILERP. The earlier claim ("ship has no SAILERP to `jwt.verify` against → offline identity unsolved") was **wrong**.
- **A ship install = one vessel = one company/domain (fixed per install).** Evidence (this repo): `SYNC_INSTANCE_ID = SHIP-<vesselCode>`, boot refuses without it (`syncRole.ts:5,31`; `start-ship.sh:45-71`); provisioning is per-vessel (`provisioningService.ts:46`); `sync_metadata` pins one `instanceId`→one `vesselId` (`provisioningService.ts:546-553`); single local Postgres; ship-deploy `.env` points `EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999` — a **local** SAILERP address (`build-ship-deploy.sh:67`). `domain` is already a value the package supplies to SAILERP's domain-scoped master data (`routes.ts:55-96`).
- **Consequence:** the ship verifies its user's SAILERP token against its **local** SAILERP (same path as shore), and its domain is **fixed/known per install** — no "cached token vs offline trust" problem. `users` being `NO_SYNC` (no domain column, server builds `req.user` from headers) is now irrelevant to identity: the local SAILERP is the authority on the ship.
- **Downgraded:** "ship offline identity" is **no longer an open gate** — it reduces to "stamp the ship's fixed domain at provisioning + verify locally." The real remaining work is **getting that fixed domain onto the sync wire so shore routes correctly (G3)**.
- ✅ **CONFIRMED 2026-06-24 (product architecture):** the package (SAILERP + Technical + Crewing, MFE) installs as ONE unit and **SAILERP runs locally on the ship** — so the ship verifies SAILERP tokens offline exactly as shore does. Ship-offline identity is **resolved, not an open gate**. (SAILERP's own packaging/auth still lives in the parent repo; this repo is consistent with it.)

**Net effect on the prerequisite:** "real auth" is precisely **server-side `jwt.verify` of the already-forwarded SAILERP Bearer + read its verified `domain` claim** (Crewing's `extractDomainFromJwt`/`authMiddleware`, reusable near-verbatim). Identity transport already exists; only verified server-side consumption is missing.

---

## Part C — Gaps to fold into the plan (the actionable part)

### G1 — `getPostgresClient()` ×29 bypasses ALS  →  Phase 0 + Phase 1
**Problem.** 29 sync calls of `const { db } = getPostgresClient()` in request-path repos (defects/components/cert-surveys/ranks) return the single cached client *synchronously*. Phase 1 only makes `getDb()` ALS-aware, so these stay single-tenant.

**Recommended fix (cheaper than migrating 29 sites).** Mirror Crewing: have `tenantMiddleware` **pre-resolve + cache the tenant pool (async) before `next()`**, then make **`getPostgresClient()` itself ALS-aware** — read the ALS tuid, return the already-cached tenant `{db,pool}`, else fall back to the single cached client. Because the pool is opened in middleware, the sync accessor can stay synchronous and all 29 sites route correctly with **zero call-site edits**.
- **Phase 0 addition:** extend the CI grep to also flag *new* `getPostgresClient()` usage (or at least inventory the 29 so none are missed).
- **Phase 1 addition:** §6 must wrap **three** accessors — `getDb()`, `getPool()`, `getPostgresClient()` — not just `getDb()`.

### G2 — `getPool()` is never made ALS-aware  →  Phase 1
**Problem.** The plan's "Single Big Idea" (README §4) and Phase 1 §6 only touch `getDb()`. But `getPool()` backs **~197 sync-layer DB calls** (and pruning/health). Without ALS-awareness, the **shore sync receive path writes to the single DB regardless of tenant.**

**Fix.** Phase 1 §6 makes `getPool()` ALS-aware identically to `getDb()` (return `ctx.pool` when in tenant context, else legacy). This single change auto-routes the entire sync layer + retention + audit-pool consumers — no per-call rewrite. (Confirmed: sync funnels 100% through `getPool()`/`getDb()`, no bypass.)

### G3 — Sync wire carries vessel but NOT domain  →  Phase 2 (new sub-section)  *(restated precisely 2026-06-24)*
**Problem (verified on the wire).** Shore must write an incoming ship sync into the correct **company/domain** DB, but the wire carries no domain:
- **Headers** (all `/sync/*` + file chunks): `Content-Type`, `X-Sync-Api-Key`, `X-Sync-Instance-Id` only (`syncEngine.ts:755-761`; `fileSyncProcessor.ts:465-472`). No domain/tenant header.
- **Bodies**: push `{batchUuid, vesselId, oneWayRows, fieldLogs, masterRecordHints}` (`syncEngine.ts:439-445`); pull `{batchUuid, vesselId, instanceId, lastCheckpoint}` (`:483-488`); initiate `{instanceId, vesselId, lastCheckpoint}` (`:147`). **No domain field.**
- **No `instanceId`/`vesselId` → domain mapping exists anywhere.** `vessels` has no company/owner/domain column (`schema.ts:77-96`); `fleets` neither (`:52-66`); `sync_settings` stores only `instance_id` + `shore_url` (`syncEngine.ts:85-89`). The vessel's owning company is simply **not recorded** where sync can use it.
- ⚠️ Core `/sync/*` endpoints are **open** today — no auth middleware, and `X-Sync-Api-Key` is sent but **not validated** server-side (`routes.ts:10-15`). So shore currently trusts whatever a caller sends.
- After cut-over, shore would funnel all ships into one DB (or fail) — the sync path is server-to-server, so the Phase 3 browser interceptor never touches it.

**Good news (from §1/B6):** a **ship's domain is FIXED per install** (one `SHIP-<code>` = one vessel = one company), and the ship's local SAILERP knows it. So the ship always knows its own domain — getting the value *onto the wire* is trivial.

**Options to make the domain resolvable on arrival:**

| Option | Domain source | Verified or trusted | Worst-case failure |
|---|---|---|---|
| **(a) Ship declares domain** on every `/sync/*` (new `X-Sync-Domain` header next to `X-Sync-Instance-Id`; value = ship's fixed domain in `sync_settings`) | Ship's own fixed local-SAILERP domain | **Trusted, not verified** today (endpoints open) | Spoofed/wrong value → shore writes into **wrong company DB = cross-tenant write** |
| **(b) Shore maps `instanceId`/`vesselId` → domain** via a shore-owned registry, populated at provision time (master `tenants` + `sync_metadata` already nearly hold this) | Shore-authoritative | **Trustworthy** (independent of ship-declared value) | Missing/stale mapping → fail-closed if coded so; misroute only if it silently defaults |
| **(c) Hybrid — RECOMMENDED** | Ship declares (a) **+** shore cross-checks against (b) | Routing uses ship value **only after** it matches the shore-owned `instanceId→domain`; mismatch → 403, no write | Cross-tenant write becomes **fail-closed**; mirrors Crewing's `verifyTenantBinding` |

**Recommendation.** "(a) is clean for transport" is true (ship knows its fixed domain) — **but not sufficient for safety**, because the worst case is a cross-tenant write. Adopt **(c)**: ship sends `X-Sync-Domain`; shore resolves it to the tenant DB **but** validates it against a provision-time `instanceId→domain` record and **refuses to write on mismatch (fail-closed)**. Couple this with finally **authenticating the sync caller** (validate `X-Sync-Api-Key` per-tenant, or verify the SAILERP token) since `/sync/*` is open today. Most of the registry already exists — the missing pieces are: record the **vessel/instance → domain** link at provisioning, add one `X-Sync-Domain` header, and enforce the cross-check on arrival. `receivePushData`/`preparePullData`/`runSync` then run inside `runInTenantContext`.
- ⚠️ `provisioningService.ts:275-300` does global `DELETE … (no WHERE)` on RBAC/rank tables — **safe only once the pool is tenant-resolved** (each delete then hits one tenant DB). Keep it strictly behind the tenant-routed import; never call cross-tenant.

### G4 — Parent-token / `JWT_SECRET` reality (Crewing lesson)  →  Phase 2 refinement
The plan (Phase 2 §317) assumes ops can **match** PMS's `JWT_SECRET` to the parent app's. This is the make-or-break setting: Crewing **hard-requires `JWT_SECRET` == the parent SAIL-Audits secret** in prod, and keys the tenant off the **verified `domain` claim** (`jwt.verify(token, JWT_SECRET)` → `decoded.domain`), cross-checking any `x-tenant-id` against it (`verifyTenantBinding` → 403 `tenant_mismatch`).

⚠️ **Discrepancy to resolve before copying verification strictness.** An earlier sweep reported Crewing had **softened** its header-path verification (only *missing* token → 401; expired/invalid fall through) because parent tokens failed against the module secret. The **fresh 2026-06-23 read of the current LOCAL Crewing tree (`87b79e43`) shows STRICT rejection** of expired/invalid — **no softening present**. The local checkout is **42 commits behind `origin/upgraded_crewing_architecture_v2`**, so the softening may live in unexamined origin commits, or the earlier read over-generalized. **Action: re-pull Crewing `origin` and confirm the actual verification policy before deciding PMS's.** The *principle* holds regardless — decide match-secret (strict, like current Crewing) vs tolerate-parent-failure (soft), and document the contingency up front.

### G5 — Gate Wah Kwong promotion on `DEF-% = 0`  →  Phase 4 addition
`initDb` is idempotent **except** the one-time `DEF-%` → `D{code}-{yy}-{seq}` defect-ID rewrite (rewrites PKs + cascades). When WK is promoted as tenant #1 and `getTenantDb` runs the full suite on first connect, that rewrite fires. **Add to Phase 4 promotion preconditions:** `SELECT count(*) FROM defects WHERE id LIKE 'DEF-%'` must be **0** on the WK DB (alongside the existing "0 pending migrations" dry-run + `verify-data-integrity.ts` INTACT check).

---

## Part D — Updated risk ranking

| # | Item | Original rank | Now | Why |
|---|---|---|---|---|
| 1a | Real *verified* auth (shore + ship) | Prerequisite | **Prerequisite (refined — B6)** | identity already real+forwarded; missing piece is server-side `jwt.verify` of SAILERP Bearer + read `domain` claim |
| 1b | Ship **offline** identity | Prerequisite (open) | **Downgraded — mostly resolved (B6/§1)** | SAILERP installs locally on the ship → verifies tokens offline like shore; domain fixed per install. Confirm co-install in parent repo. |
| 2 | Sync tenant-routing on the wire (G2+G3) | Hard | **Hard (unchanged, now precise)** | no tenant identity on push/pull; `getPool()` unwrapped |
| 3 | `getPostgresClient()` ×29 (G1) | *not identified* | **🔴 new — correctness** | bypasses ALS |
| 4 | Schedulers / background loops | **Hardest** | **Downgraded → medium** | redesign landed; only `pmsAlertEngine` + pruning/health remain |
| 5 | `DEF-%` rewrite gate (G5) | Live-data risk | **Unchanged** | still fires on first WK connect |
| 6 | Parent-token `JWT_SECRET` (G4) | noted as ops risk | **Refined** | `JWT_SECRET` must == SAILERP's; ⚠️ strict-vs-soft verification unresolved (Crewing local=strict, 42 commits behind origin — re-pull & confirm) |

---

## Part E — Must-settle-before-code (refreshed)
1. **Verified-auth (shore + ship)** — the gate (refined, B6). Server-side `jwt.verify` of the SAILERP Bearer + read the verified `domain` claim (reuse Crewing's `extractDomainFromJwt`/`authMiddleware`), then forward `domain` on normal requests (add to `ActiveIdentity`). **Ship offline identity is no longer a separate blocker** — SAILERP runs locally on the ship and verifies offline like shore; the ship's domain is fixed per install (confirm co-install in the parent/installer repo). Ties to Decision Log Q1/Q4.
2. **Sync tenant-identity wire contract** (G3) — **recommended (c) hybrid:** ship sends `X-Sync-Domain` (its fixed domain) **+** shore validates it against a provision-time `instanceId→domain` registry, **fail-closed on mismatch**; plus authenticate the sync caller (`X-Sync-Api-Key` per-tenant / verify token) since `/sync/*` is open today. Decide before Phase 2.
3. **`pmsAlertEngine` per-tenant execution + missing re-entrancy guard** (replaces the old "scheduler perf phases first" gate).
4. **WK DB preconditions** — `DEF-% = 0` + migration-current + integrity INTACT before promotion (G5).
5. **Parent-token / `JWT_SECRET` strategy** (G4) — `JWT_SECRET` must equal SAILERP's; strict-vs-soft verification still open (re-pull Crewing `origin` to confirm its current policy before copying).
6. ✅ **RESOLVED 2026-06-24** — `domain` is a **signed SAILERP JWT claim** (`{ id, domain, userType }`, same as Crewing). Verifiable tenant key; no longer open. → folded into the consolidated build plan (`docs/MULTITENANCY-CONSOLIDATED-IMPLEMENTATION-PLAN.docx`).

---

## Part F — Net effect on each phase

| Phase | Verdict | Change from re-validation |
|---|---|---|
| **0 — Foundations** | ✅ valid | List grew 9→11 module imports; **add `getPostgresClient()` inventory + CI flag (G1)**; tsc gate ≤ **368** |
| **1 — Master DB + TCM** | ✅ valid | §6 must wrap **`getDb()` + `getPool()` + `getPostgresClient()`** (G1+G2), not just `getDb()`; TCM sketch already matches Crewing |
| **2 — Server Middleware** | ✅ valid | **Real work = `jwt.verify` the already-forwarded SAILERP Bearer + read verified `domain` claim (B6)** — reuse Crewing's `extractDomainFromJwt`/`authMiddleware`; **add sync-wire tenant identity (G3)**; settle strict-vs-soft verification (G4) |
| **3 — Frontend Layer** | ✅ valid | Interceptor consolidation already half-done (3 header families present) |
| **4 — Migrations/Cut-over** | ✅ valid | Phase 4.5 background-loop list **shrinks to `pmsAlertEngine` + pruning/health**; **add `DEF-% = 0` precondition (G5)** |
| **5 — Decommission** | ✅ valid | §6 background-job list is stale — refresh to the post-redesign reality |

---

*Generated 2026-06-23 from a read-only sweep of `feature/replit-work @ 7bcc060ab` (Explore agents + direct reads of `db.ts`, `postgresClient.ts`, `auth.ts`, `requestContext.ts`, sync `routes.ts`, `docs/multi-tenant/*`). **Part B6 (auth/SAILERP-identity deep-dive) added 2026-06-23** from reads of `client/src/contexts/AuthContext.tsx`, `client/src/lib/activeRank.ts`, `client/src/lib/authToken.ts`, `server/routes.ts:37-98`, `shared/syncConfig.ts` (users=NO_SYNC), a server-wide `jwt.verify`/`Authorization` grep (0 hits), + a fresh Crewing re-exam (`crewdevnov12 @ 87b79e43`, 42 commits behind origin). No code or plan files were modified. Pairs with memory `pms-multitenancy-plan-validation` + `crewing-multitenancy-and-login-recon`.*

*Update 2026-06-24: architecture corrected — SAILERP+Technical+Crewing install as ONE unit (MFE), SAILERP runs LOCALLY on a ship. Ship-offline identity downgraded (B6/§1, risk 1b); G3 restated precisely from the verified wire (vessel-but-no-domain; headers `X-Sync-Api-Key`+`X-Sync-Instance-Id` only; no `instanceId/vesselId→domain` map; `/sync/*` open) with the (a)/(b)/(c) options and the recommended (c) hybrid. Sources: `syncEngine.ts:147/439-445/483-488/755-761`, `fileSyncProcessor.ts:465-472`, `controller.ts:22-85`, `provisioningService.ts:46/546-553`, `syncRole.ts`, `start-ship.sh`/`build-ship-deploy.sh`, `externalApi.ts`, `vessels`/`fleets`/`sync_settings` schema.*
