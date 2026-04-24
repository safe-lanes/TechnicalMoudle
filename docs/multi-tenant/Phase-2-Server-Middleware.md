# Phase 2 — Server Middleware Chain

> **Goal:** Wire `tenantMiddleware → authMiddleware` into the existing `/technical/api` mount, gated by `MASTER_DATABASE_URL`. PMS has a single API surface — there is **no** parallel `/v2` prefix.
> **Risk:** 🟡 Medium (single mount point flips behaviour based on env)
> **Estimated effort:** 1 PR, ~1 week
> **Prerequisites:** Phase 1 complete
> **Unblocks:** Phase 4

---

## 1. Goal

After this phase, the existing `/technical/api/*` mount runs one of two middleware stacks depending on whether `MASTER_DATABASE_URL` is set at boot.

```mermaid
flowchart LR
    subgraph SingleTenant["Single-tenant mode (MASTER_DATABASE_URL unset)"]
        S1["/technical/api/*"] --> S2[mockAuthMiddleware]
        S2 --> S3[moduleRouter]
    end
    subgraph MultiTenant["Multi-tenant mode (MASTER_DATABASE_URL set)"]
        M1["/technical/api/tenant/init"] --> M2["(exempt — no middleware)"]
        M3["/technical/api/* (everything else)"] --> M4[tenantMiddleware]
        M4 --> M5[authMiddleware]
        M5 --> M6[moduleRouter]
    end
    style SingleTenant fill:#fff3e0,stroke:#e65100
    style MultiTenant fill:#e8f5e9,stroke:#2e7d32
```

**Key idea:** the same `moduleRouter` is mounted in both modes. The path stays `/technical/api/*` for every module. What changes is which auth/tenant chain runs in front of it.

The `/technical/api/tenant/init` endpoint is mounted **before** the tenant middleware so the client can resolve a `tuid` from a domain without already having one. It is the only request-time path that touches the master DB.

---

## 2. Files to create / modify

| Action | File | Purpose |
|---|---|---|
| ➕ Create | `server/middleware/tenantMiddleware.ts` | Validate `x-tenant-id`, bind ALS |
| ➕ Create | `server/middleware/authMiddleware.ts` | Verify JWT, cross-check domain |
| ➕ Create | `server/middleware/exemptPaths.ts` | Path matcher for endpoints that skip tenant/auth |
| ➕ Create | `server/modules/tenant/routes.ts` | `POST /tenant/init`, `GET /tenant/health` |
| ✏️ Modify (future Phase 2 PR) | `server/routes.ts` | Branch the mount on `MASTER_DATABASE_URL`; mount `/tenant/init` before the catch-all chain |

> **Note:** `server/middleware/auth.ts` is **not** modified by Phase 2. In multi-tenant mode `mockAuthMiddleware` is simply not registered; in single-tenant mode it continues to run unchanged.

---

## 3. Required environment variables

| Var | Required when | Notes |
|---|---|---|
| `MASTER_DATABASE_URL` | Multi-tenant mode | Presence of this var is the **only** flag that switches the mount behaviour |
| `JWT_SECRET` | Multi-tenant mode | Used by `authMiddleware` |
| `AUTH_BYPASS` | Dev only | When `=true`, both middlewares short-circuit; `req.user` is populated like `mockAuthMiddleware` does today |

**Behaviour matrix:**

| `MASTER_DATABASE_URL` | `AUTH_BYPASS` | Stack on `/technical/api/*` |
|---|---|---|
| unset | n/a | `mockAuthMiddleware → moduleRouter` (today's behaviour, unchanged) |
| set | `true` | `tenantMiddleware (bypass) → authMiddleware (bypass) → moduleRouter` |
| set | `false`/unset | `tenantMiddleware → authMiddleware → moduleRouter` |

There is **never** a state where both `mockAuthMiddleware` and `authMiddleware` run on the same request — the boot-time branch picks one chain.

---

## 4. The exempt paths matcher

`server/middleware/exemptPaths.ts`:

```typescript
const EXEMPT_PATTERNS: RegExp[] = [
  /^\/technical\/api\/tenant\/init\/?$/,
  /^\/technical\/api\/tenant\/health\/?$/,
];

export function isExemptPath(path: string): boolean {
  return EXEMPT_PATTERNS.some(re => re.test(path));
}
```

Keep this list **tiny** and explicit. Every entry is a potential cross-tenant leak vector. Mounting `/tenant/init` as its own router before the catch-all (see §8) is a belt-and-braces measure on top of this matcher.

---

## 5. The tenant middleware

`server/middleware/tenantMiddleware.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { getTenantManager } from "../utils/tenantConnectionManager";
import { isExemptPath } from "./exemptPaths";

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (isExemptPath(req.path)) return next();

  if (process.env.AUTH_BYPASS === "true") {
    const devTuid = process.env.DEV_TENANT_TUID;
    if (!devTuid) return next();
    const tcm = getTenantManager();
    if (!tcm) return next();
    return tcm.runInTenantContext(devTuid, () => Promise.resolve(next()));
  }

  const tenantId = req.headers["x-tenant-id"];
  const tuid = Array.isArray(tenantId) ? tenantId[0] : tenantId;

  if (!tuid) {
    return res.status(400).json({ error: "Missing x-tenant-id header" });
  }

  const tcm = getTenantManager();
  if (!tcm) {
    return res.status(503).json({ error: "Multi-tenant mode not configured" });
  }

  const valid = await tcm.validateTuid(tuid);
  if (!valid) {
    return res.status(403).json({ error: "Unknown or inactive tenant" });
  }

  return tcm.runInTenantContext(tuid, () => new Promise<void>((resolve, reject) => {
    next();
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
  }));
}
```

**Critical detail:** `runInTenantContext` must wrap the **entire downstream chain**, not just the synchronous `next()` call. The Promise-wrapped pattern above keeps the ALS scope alive until the response finishes, so any `await getDb()` inside route handlers (even deep in async stacks) sees the right context.

---

## 6. The auth middleware

`server/middleware/authMiddleware.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isExemptPath } from "./exemptPaths";

export interface AuthenticatedRequest extends Request {
  user?: {
    userUuid: string;
    fullName: string;
    role: string;
    domain: string;
    rank_name?: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (isExemptPath(req.path)) return next();

  if (process.env.AUTH_BYPASS === "true") {
    req.user = {
      userUuid: "00000000-0000-0000-0000-000000000001",
      fullName: "Dev Admin",
      role: "Sail Admin",
      domain: "dev.local",
      rank_name: (req.headers["x-rank"] as string) || "Chief Engineer",
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const expectedDomain = req.headers["x-tenant-domain"];
    if (expectedDomain && payload.domain !== expectedDomain) {
      return res.status(403).json({ error: "JWT/tenant domain mismatch" });
    }

    req.user = {
      userUuid: payload.userUuid,
      fullName: payload.fullName,
      role: payload.role,
      domain: payload.domain,
      rank_name: (req.headers["x-rank"] as string) || payload.rank_name,
    };
    return next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

**Why `x-rank` still wins:** PMS's existing rank-impersonation feature (used by QA) overrides the rank claim from JWT. This preserves Q4 in the [Decision Log](./README.md#7-decision-log-open-questions) — keep `x-rank` for QA convenience.

---

## 7. The `tenant/init` endpoint

`server/modules/tenant/routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { getTenantManager } from "../../utils/tenantConnectionManager";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

const initSchema = z.object({ domain: z.string().min(1) });

router.post("/init", async (req, res) => {
  const parsed = initSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const tcm = getTenantManager();
  if (!tcm) return res.status(503).json({ error: "Multi-tenant not configured" });

  const tenant = await tcm.resolveTenant(parsed.data.domain);
  if (!tenant) return res.status(404).json({ error: "No tenant for this domain" });

  return res.json({ tenantId: tenant.tuid, companyName: tenant.companyName });
});

export default router;
```

**Note:** this router is mounted at `/technical/api/tenant` **before** the tenant/auth chain (see §8). It is the only endpoint that hits the master DB from the request path.

---

## 8. Wiring (conceptual change to `server/routes.ts`)

The boot-time route registration where the legacy mount lives today changes to a branch on `MASTER_DATABASE_URL`. The shape of the change:

```typescript
// Where the existing single-tenant mount is registered today:
//   app.use('/technical/api', mockAuthMiddleware);
//   app.use('/technical/api', moduleRouter);

if (process.env.MASTER_DATABASE_URL) {
  // Multi-tenant mode
  const tenantRoutes = (await import('./modules/tenant/routes')).default;
  const { tenantMiddleware } = await import('./middleware/tenantMiddleware');
  const { authMiddleware } = await import('./middleware/authMiddleware');

  // Exempt routes mounted FIRST, before the catch-all middleware chain
  app.use('/technical/api/tenant', tenantRoutes);

  // All other API routes go through the tenant + auth chain
  app.use('/technical/api', tenantMiddleware, authMiddleware, moduleRouter);
  console.log('🔒 Multi-tenant routes enabled at /technical/api/*');
} else {
  // Single-tenant mode (today's behaviour, unchanged)
  await initMockAuthRankId();
  app.use('/technical/api', mockAuthMiddleware);
  app.use('/technical/api', moduleRouter);
  console.log('🔒 Mock authentication enabled for /technical/api/* routes');
}
```

**Mount order is critical.** Express matches in registration order — `/technical/api/tenant` must be registered before the catch-all `/technical/api` mount, otherwise the middleware will run on `/tenant/init` and reject for missing `x-tenant-id` (the `isExemptPath` check is a backstop, not the only line of defence).

> **Reminder:** This Phase 2 PR is the one that touches `server/routes.ts` when the work is actually executed. The current documentation task (Task #128) does **not** modify `server/routes.ts` — only describes the future change conceptually.

---

## 9. Acceptance criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | Without `MASTER_DATABASE_URL`, the server boots into single-tenant mode and every existing `/technical/api/*` route works as today | Existing E2E test should still pass |
| 2 | With `MASTER_DATABASE_URL` set, `POST /technical/api/tenant/init {domain}` returns `{tenantId, companyName}` for a registered tenant | `curl` with seeded master |
| 3 | With multi-tenant mode on, `/technical/api/work-orders` without `x-tenant-id` returns 400 | `curl` |
| 4 | With multi-tenant mode on, `/technical/api/work-orders` with valid `x-tenant-id` but no `Authorization` returns 401 | `curl` |
| 5 | With multi-tenant mode on, `/technical/api/work-orders` with both headers and a valid JWT returns the tenant's data | Integration test |
| 6 | `mockAuthMiddleware` is **not** mounted when `MASTER_DATABASE_URL` is set | Trace logs at boot; grep response middleware chain |
| 7 | With `AUTH_BYPASS=true` on top of multi-tenant mode, no JWT/tenant headers are required | Dev convenience |
| 8 | `tenantMiddleware` does NOT execute on `/technical/api/tenant/init` (mount order + `isExemptPath`) | Trace logs during test |

---

## 10. Test plan

### 10.1 Unit
- `tenantMiddleware`: missing header → 400; unknown tuid → 403; valid → calls `next()` inside ALS context.
- `authMiddleware`: missing `Authorization` → 401; bad signature → 401; good token → `req.user` populated; bypass mode → mock user.
- `isExemptPath`: covers `/technical/api/tenant/init` and `/technical/api/tenant/health`, rejects everything else.

### 10.2 Integration
- Seed master DB with one tenant pointing at the dev tenant DB.
- Hit `POST /technical/api/tenant/init` with the dev domain → receive `tenantId`.
- Hit `GET /technical/api/vessels` with that `tenantId` + a self-signed JWT → receive vessel list.
- Boot the same server **without** `MASTER_DATABASE_URL` → confirm `/technical/api/vessels` works on mock auth as today.

### 10.3 Concurrency
- Fire 100 parallel requests across 5 tenants and verify no cross-contamination of returned data.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Forgotten exempt route → entire feature unreachable | All exempt paths centralised in `exemptPaths.ts`, code-reviewed line-by-line |
| Mount order wrong → `/technical/api/tenant/init` falls through middleware | Smoke test in CI hits `/technical/api/tenant/init` and asserts no `x-tenant-id` was required |
| `runInTenantContext` Promise wrapping doesn't await `res.on('finish')` properly → ALS evicted before downstream `await getDb()` resolves | Phase 1 concurrency test catches this; add a regression test that does `await new Promise(r => setTimeout(r, 50))` then `getDb()` |
| Boot-time branch mis-evaluates `MASTER_DATABASE_URL` (e.g. empty string) → wrong stack registered | Treat any falsy / empty value as "unset"; log which branch was taken at boot |
| `JWT_SECRET` mismatch with parent app → all requests 401 | Ops runbook: confirm secret value matches Crewing's deployment; smoke test on staging first |

---

## 12. Rollback plan

1. Unset `MASTER_DATABASE_URL` and restart — server boots back into single-tenant mode with mock auth.
2. Or `git revert <Phase-2 PR>` — Phase 1 stays in place, app reverts to single-tenant.

Because there is only one mount path, rollback is **all-or-nothing per environment**: an environment is either fully on multi-tenant or fully on single-tenant. There is no per-route mid-state to manage.

---

## 13. Definition of Done

- [ ] `tenantMiddleware`, `authMiddleware`, `exemptPaths` all created.
- [ ] `POST /technical/api/tenant/init` and `GET /technical/api/tenant/health` reachable in multi-tenant mode.
- [ ] `server/routes.ts` boot logic branches on `MASTER_DATABASE_URL`.
- [ ] Single-tenant boot path is byte-identical to today's behaviour.
- [ ] Acceptance criteria 1–8 green.
- [ ] Manual smoke test passed on staging with one seeded tenant.
- [ ] Concurrency test from §10.3 green.
- [ ] PR merged.
