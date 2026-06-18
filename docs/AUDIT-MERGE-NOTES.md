# Audit branch → `replit_dev` — REQUIRED merge-conflict resolution

**Recorded:** 2026-06-18 · **Branch:** `feature/audit-identity-phase0` · **Status:** documentation only — the merge has NOT been performed.

When `feature/audit-identity-phase0` is eventually merged into `replit_dev`, the merge **will conflict** on two files that both sides modified. **Resolve by UNION — keep BOTH sides. Never accept-one-side / "take ours" / "take theirs".** Losing either side silently breaks auth (no token / no login redirect) or audit (actions logged as the mock "Sail Admin" instead of the real user).

The two conflicting files:
1. `client/src/lib/activeRank.ts`
2. `client/src/contexts/AuthContext.tsx`

---

## 1. `client/src/lib/activeRank.ts` — the resolved file must carry ALL THREE header injections

The `window.fetch` interceptor must inject **all three** of these on `/technical/api` calls (each only if not already set by the caller):

- **(a) `x-rank`** — the original rank header (both sides have it).
- **(b) `Authorization: Bearer <token>`** — from the `replit_dev` / Replit auth work; the token comes from `getAccessToken()` (`import { getAccessToken } from "./authToken"`). This is on `replit_dev`, NOT on the audit branch.
- **(c) `x-user-id` / `x-user-name` / `x-user-email` / `x-user-type` / `x-user-role`** — the Phase 0 audit **identity-forwarding** headers (URI-encoded), driven by an `activeIdentity` holder with exported `setActiveIdentity()` / `getActiveIdentity()`. This is on the audit branch, NOT on `replit_dev`.

**Also preserve the audit-branch fix:** the interceptor must **NOT early-return when `rank` is null**. Office users have a null rank but must still forward their `x-user-*` identity headers. The guard should skip only when there is **neither** a rank, **nor** a token, **nor** any identity — i.e. fall through to `originalFetch` only if all of (rank, token, identity) are absent. (On `replit_dev` the guard is `if (!rank && !token) return originalFetch(...)`; the audit branch added the identity check. The resolved guard must consider all three: rank, token, AND identity.)

**Resolved interceptor shape (illustrative — union of both sides):**
```ts
import { getAccessToken } from "./authToken";          // (b) replit_dev
// activeIdentity holder + setActiveIdentity/getActiveIdentity  // (c) audit branch

window.fetch = (input, init) => {
  const rank = getActiveRank();                         // (a)
  const token = getAccessToken();                       // (b)
  const identity = getActiveIdentity();                 // (c)
  const hasIdentity = !!(identity.userId || identity.name || identity.email || identity.userType || identity.role);
  if (!rank && !token && !hasIdentity) return originalFetch(input, init);   // ← all three, not just rank/token
  if (!isApiUrl(url)) return originalFetch(input, init);

  const apply = (h: Headers) => {
    if (rank && !h.has("x-rank")) h.set("x-rank", rank);                                  // (a)
    if (token && !h.has("authorization")) h.set("Authorization", `Bearer ${token}`);      // (b)
    if (identity.userId && !h.has("x-user-id")) h.set("x-user-id", encodeURIComponent(identity.userId));      // (c)
    if (identity.name && !h.has("x-user-name")) h.set("x-user-name", encodeURIComponent(identity.name));
    if (identity.email && !h.has("x-user-email")) h.set("x-user-email", encodeURIComponent(identity.email));
    if (identity.userType && !h.has("x-user-type")) h.set("x-user-type", encodeURIComponent(identity.userType));
    if (identity.role && !h.has("x-user-role")) h.set("x-user-role", encodeURIComponent(identity.role));
  };
  // ...apply to both the Request-instance branch and the init.headers branch...
};
```
Keep `setActiveIdentity`/`getActiveIdentity` exported (audit branch) AND `getAccessToken` import (replit_dev). Keep `isApiUrl` exported if `replit_dev` exported it.

---

## 2. `client/src/contexts/AuthContext.tsx` — keep BOTH sets of logic

Keep **everything from both sides**:
- **From `replit_dev` (Replit auth work):** the auth/session/logout/domain/user-menu logic — full-session logout, domain-name handling, token-failure → `/login` redirect, Bearer-token plumbing, etc.
- **From the audit branch (Phase 0):** the `toActiveIdentity(user)` helper and the **`setActiveIdentity(...)` calls at all three points — hydrate, login, and logout (cleared)** — so the authenticated identity is mirrored into `activeRank.ts` for forwarding.

Note: on `replit_dev` the `DEFAULT_USER` mock role is **"Sail Admin"** — keep that.

Concretely, the resolved file must still call `setActiveIdentity(toActiveIdentity(resolvedUser))` on hydrate, `setActiveIdentity(toActiveIdentity(sanitizedUser))` on login, and `setActiveIdentity(null)` on logout — alongside the existing `setActiveRank(...)` calls and all the replit_dev session logic.

---

## 3. Verification after resolving the merge

- **`tsc --noEmit`** holds (no new errors from the merge).
- **Identity forwarding still works:** a logged action by a **real office user** records **their name** (e.g. "Rsms Admin") in the audit trail — **NOT** "Sail Administrator"/"Sail Admin" — confirming the `x-user-*` headers still flow and the request-context actor is real.
- **Auth still works:** the **`Authorization: Bearer <token>`** header is still attached to API requests, and the token-failure → `/login` redirect still fires — confirming the replit_dev auth path survived the union.
- Spot-check: office user (null rank) still forwards `x-user-*` (the no-early-return-on-null-rank fix held).

---

## Why this matters
The audit programme's entire value is that actions are attributed to the **real** SAILERP user (Office: name, Ship: rank), frozen at write time. If the merge accidentally takes `replit_dev`'s version of these files, the `x-user-*` forwarding is lost and every audit row falls back to the mock "Sail Admin" — silently defeating Phases 0–4. If it takes the audit branch's version, the Bearer-token auth and login-redirect work is lost. **Union both. Then run the §3 checks.**
