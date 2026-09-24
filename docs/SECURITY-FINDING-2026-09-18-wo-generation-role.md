# Potential authorization weakness — office work-order generation reads a caller-supplied role with a 'Sail Admin' fallback

Raised: 18-Sep-2026. Status: **reported, nothing changed.** No application authentication or permission code was
modified by the work that produced this note, and no production or customer installation was accessed.

Evidence class: **READ** — from source at PMS revision `origin/replit_dev` @ `44c8fccad`. Nothing here was exercised
against a running system. See "Limits" before acting on it.

This note exists because a documentation correction (assistant knowledge base, §1.1.14.6 of the Recent Updates
operational note) had to state the office work-order generation rules accurately, and stating them accurately
required separating **the policy the code intends** from **what the code actually enforces**. The gap belongs in a
security note, not in a user manual, so it is recorded here as well.

## 1. Intended policy

Office 'Generate Now' — generating a vessel's due work orders from the office in one action — is intended to be
restricted to the Sail Admin role, on top of a per-vessel switch that is off by default.

```
server/modules/work-orders/services/workOrderGenerationGate.ts
  PROVISIONING_ROLE = 'Sail Admin'
  evaluateDirectGeneration({ vesselId, role, isShip })
      → ship instance:            allowed (its own scanner is the correct writer)
      → role !== 'Sail Admin':    refused, ROLE_NOT_PERMITTED
      → switch off / unreadable:  refused, OFFICE_GENERATION_DISABLED / VESSEL_STATE_UNKNOWN (fails closed)
```

The switch half is sound: `isOfficeWoGenerationEnabled(vesselId)` reads `pms_vessel_settings` and treats a missing
row, NULL or a query error as disabled. It is a database fact and a caller cannot influence it.

## 2. What is actually enforced

The role half is resolved like this:

```
server/modules/work-orders/services/workOrderGenerationGate.ts:60
  export function resolveGateRole(user: any): string {
    return (user?.forwardedRole || user?.role || '').trim();
  }

server/modules/work-orders/controllers/workOrderController.ts:135     (the only caller of the full gate)
  role: gate.resolveGateRole((req as AuthenticatedRequest).user)
```

and the two fields it reads come from the identity middleware:

```
server/middleware/auth.ts:186   role: "Sail Admin",           // a fixed string, not derived from the request
server/middleware/auth.ts:197   if (fwdRole) (req.user as any).forwardedRole = fwdRole;   // from the x-user-role header
```

So:

| situation | role the gate tests | outcome |
|---|---|---|
| request carries `x-user-role: Sail Admin` | `Sail Admin` | allowed (switch permitting) — intended |
| request carries `x-user-role: <other>` | that role | refused — intended |
| request carries **no** `x-user-role` header | **`Sail Admin`** (the fixed fallback) | **allowed** (switch permitting) |

Two observations follow, both read from the code:

1. **The fallback is open, not closed.** Every other condition in this gate fails closed. The role condition fails
   open: absence of identity is treated as the most privileged role.
2. **The gate reads the legacy field, not the Phase-0 RBAC identity.** The same middleware already computes
   `req.rbac = { role, userType, source: 'forwarded' | 'mock' | 'none' }`, which is the field designed for
   authorization and which reports `role: null` when nothing was forwarded. The generation gate reads `req.user`
   instead. Had it read `req.rbac`, a request with no forwarded role would present a null role and be refused.
3. **The value is caller-supplied.** `x-user-role` is an ordinary request header. Within the application it is an
   attribution signal, not a verified credential; whether anything in front of the application prevents a client
   from setting it is a deployment question (see Limits).

The middleware's own header comment documents the design decision and its scope:

> "`req.user.role` is deliberately left as it was (the 'Sail Admin' mock) because ~40 call sites read it for
> business logic … Anything that wants the real role reads `req.rbac` (or the existing `forwardedRole`)."

That is consistent with what is described above: this note is not claiming the fallback is undocumented, it is
recording that one **authorization** decision reads the field the comment reserves for business logic.

`PMS_AUTH_MOCK_RBAC=1` is a separate switch. It forces `req.rbac` to the mock for every request and the code
comment says "Never set it in production". It does **not** affect this gate, because this gate does not read
`req.rbac`. It is named here only to prevent the two being confused — an earlier draft of the documentation
correction cited it here and was wrong.

## 3. Scope examined, and what was not examined

- Examined: the office work-order generation path end to end — route, controller, gate, switch, and the identity
  middleware that feeds it.
- Also observed while reading, **not investigated**: `user.role` is read in roughly a dozen other server files
  (`documentService.ts`, `subEntityService.ts`, `sparesController.ts`, `sync/middleware.ts`, the Shipskart
  controllers, …). Some of those reads look like authorization rather than business logic. Whether any of them has
  the same open fallback was **not** determined here, and no claim is made about them. That is a separate review.
- Related item already on the backlog: "mock-identity hardening (auth.ts MOCK 'Sail Admin')". This note is a
  specific instance of that family, with the gate's own resolution order as the new detail.

## 4. Limits — what has NOT been established

- **No production or customer installation was accessed**, and no request was made to one. Nothing here says the
  weakness is reachable in any live deployment.
- Whether the SAILERP shell is the only way requests reach `/technical/api`, and whether any proxy strips or
  overwrites `x-user-role` before it arrives, was **not** inspected. If every real request is proxied through a
  component that always sets a trustworthy role header, the effective behaviour matches the intent and there is no
  exposure. That is exactly the question this note cannot answer.
- The local shore+ship pilot was not used: it was not running, and by standing project rule its authentication does
  not generalise to production, so it would not have settled the question either.
- Consequence if it were reachable: an office caller who is not a Sail Admin could trigger a vessel-scoped work-order
  generation sweep — but only for a vessel whose per-vessel switch a Sail Admin has already enabled, and the sweep
  creates the same work orders the ship's own daily scan would create. This is an over-permission, not data
  disclosure or destruction. Stated as the code's consequence, not as an observed incident.

## 5. What would settle it, and what would fix it

To settle exposure (not done here, needs the owner's decision):

1. On a deployment the owner nominates, send an authenticated `POST /work-orders/generate-now` **without** an
   `x-user-role` header, as a non-Sail-Admin user, for a vessel whose switch is on, and observe whether it is
   refused. One request answers it.
2. Inspect the reverse proxy / gateway configuration in front of `/technical/api` for header handling.

Candidate fix, if the owner wants one (not written, not proposed as urgent):

- Have the gate resolve the role from `req.rbac` and refuse when `source === 'none'` or `role === null`, so the role
  condition fails closed like every other condition in the same function. This touches one function and does not
  require changing the ~40 business-logic reads of `req.user.role`.

No code change accompanies this note.
