# Approval Engine — Integration Guide (v1, Phase 1)

For any module team (Technical, Crewing, …) wiring a product onto the engine. You should not
need to read the engine source; the demo card (`server/approval-demo/demoCard.ts`) is the
complete minimal example and `server/approval-demo/__tests__/` shows every call in use.

The engine is **shore-only**, **tenant-aware**, and owns only its own `apprv_*` tables
(migration 170). Your module keeps its own tables, screens and safety rules.

## The three wiring points

### 1. Boot — register your card and mount the engine (host app, once)

Before (host `server/routes.ts` — nothing engine-related):
```ts
app.use('/technical/api', moduleRouter);
```
After:
```ts
import { startEmbedded, DrizzlePoolProvider } from './modules/approval-engine';
import { myCard } from './my-module/approvalCard';

startEmbedded(app, {
  cards: [myCard],                                     // broken card = the process refuses to start
  provider: DrizzlePoolProvider.fromConnectionStrings({ default: process.env.DATABASE_URL! }),
  // multi-tenant hosts: resolveTenantId: (req) => resolveTenantFromALS(req) — reuse your middleware
  // hosts with their own RBAC: requireConfigWrite: requireRole(['Office','PMS Admin','Sail Admin'])
  onEvent: (evt) => notificationService.fanOut(evt),   // optional; engine sends nothing itself
});
```
Or run it as its own process: `startStandalone({ cards: [myCard] })` — same API on its own port
(`server/approval-demo/standaloneDemo.ts` is a working runner).

### 2. Submit — hand your subject to the engine AFTER your own safety checks

**Rule: every module-level safety check (locks, mandatory remarks, validation) runs in YOUR
service BEFORE calling submit.** The engine sequences approvals; it does not know your rules.

Before (module service decides everything itself):
```ts
await repo.update(id, { status: 'Pending Approval' });
```
After:
```ts
runMyModuleSafetyChecks(subject);                      // unchanged, still first
const r = await engine.submit(ctx, {
  scope: { moduleId: 'my-module', screenId: 'my-screen', actionId: '' },
  subjectRef: subject.uuid,                            // stable id — the engine never parses it
  subject,                                             // handed to your card.classify only
  vesselId: subject.vesselId,
});
switch (r.outcome) {
  case 'STARTED':        /* mark your row "pending approval", store r.requuid if you like */ break;
  case 'NO_WORKFLOW':    /* nothing configured → run your LEGACY approval path unchanged  */ break;
  case 'DISABLED':       /* tenant switched the scope off → legacy path too               */ break;
  case 'ALREADY_PENDING':/* surface to the user; do not submit twice                      */ break;
}
```
`NO_WORKFLOW` / `DISABLED` are the fallback contract: shipping the wiring does NOT change
behaviour until someone configures a workflow in the admin screen.

### 3. Decide + onDecision — approvals come in, your module applies the result once

Approvals arrive through `POST /approval-engine/requests/:requuid/decide` (or `engine.decide`)
— typically from your existing approve buttons. The engine answers 403 for a non-approver /
not-your-turn, 409 for an already-decided request.

When the request reaches a terminal state the engine calls your card's `onDecision` —
**exactly once** (guarded by the repository's pending→terminal transition):
```ts
async onDecision(ctx, notice) {
  // notice: { requuid, scope, classification, subjectRef, outcome: 'approved'|'returned', decidedBy, remarks }
  if (notice.outcome === 'approved') await myService.applyApprovedChange(notice.subjectRef);
  else await myService.returnToSubmitter(notice.subjectRef, notice.remarks);
}
```
Rules for `onDecision`:
- **Idempotent.** If your process dies mid-callback, recovery may run it again out-of-band.
  Guard with your own state ("already applied? no-op"), like the CR applies do.
- **Writes go through YOUR module's synced tables** — the engine's tables are shore-only
  NO_SYNC; the result reaches ships through your existing sync, never through engine tables.
- **Never read or write `apprv_*` tables directly.** `engine.status()` / `GET
  /approval-engine/requests/status` is the read API.

### 3b. The engine-first decide pattern (learned wiring Technical — Phase 2)

Your existing approve/reject services stay the single entry point. Inside them, AFTER your
own guards, check the engine and hand over when it owns the subject:

```ts
// in approveMyThing(id, body) — after your comment/status/instance guards:
const pending = await gw.pendingEngineRequest(screenId, subject.uuid);
if (pending) {
  const r = await engine.decide(ctx, pending.requuid, { decision: 'approve', remarks });
  return reload(id);   // non-terminal: entity unchanged; terminal: onDecision already applied
}
// … legacy path unchanged …
```
This is recursion-safe by construction: the engine FINALIZES the request before calling your
`onDecision`, so when `onDecision` re-enters `approveMyThing` there is no pending engine
request and the legacy branch applies. Your legacy branch must therefore be a valid direct
finalise when its own step/config rows are absent (the "zero-step" shape).

### 3c. Subjects that arrive by sync (shore-only engines)

If your requests are CREATED on a ship and reach shore via sync, the create-route hook never
fires on shore. Hook the ARRIVAL: a post-sync sweep (fire-and-forget, per vessel) that finds
subjects awaiting approval with no engine request and submits them — idempotent for free
(`ALREADY_PENDING` short-circuits, `NO_WORKFLOW`/`DISABLED` do nothing, the next sync retries).
Technical's `approvalArrivalSweep` (server/modules/approvals/engineGateway.ts) is the template;
it fires next to the existing post-sync reconciler trigger in the sync complete handler.

### 3d. Cutover rule when replacing an old per-module approval config

While the old config still drives step creation in your module, an active engine workflow AND
enabled old-config levels would double-gate. The rule is **workflow XOR old levels** per scope:
enable the generated workflow and disable the old level flags in the same support action (the
Technical submit hooks log a loud warning when both are active). Keep the old config table —
read-only in practice — until the module's step-creation code is retired.

## Writing a card (the demo is the template)

```ts
const myCard: ApprovalCard = {
  moduleId: 'my-module', label: 'My Module',
  scopes: [{ screenId: 'my-screen', actionId: '', label: 'My Screen',
             classifications: [{ id: 'normal', label: 'Normal' }, { id: 'critical', label: 'Critical' }] }],
  listRoles:        async (ctx, scope) => await myRoleSource.stableRoleIds(ctx.tenantId), // ids + labels, NEVER names as ids
  classify:         async (ctx, scope, subject) => (subject as MyThing).critical ? 'critical' : 'normal',
  resolveApprovers: async (ctx, scope, roleId, subjectRef) => await myUsers.holdingRole(ctx.tenantId, roleId),
  onDecision:       async (ctx, notice) => { /* see above */ },
  onPending:        async (ctx, evt) => { /* optional: notify evt.approverUserIds */ },
};
```
Registration is validated at boot — a missing function, duplicate module/scope/classification
id refuses the start with a precise message. Fix the card; never catch that error.

Classification ids should be your module's existing STABLE config keys (Technical uses the
awc variableNames like 'Critical Spares'), not display strings invented for the card — the
old-config generator and support reports then map 1:1 without a translation table.

## Verification checklist (run before calling an integration done)

1. Boot with your card registered — process starts; break a function name — process refuses.
2. `GET /approval-engine/registry` shows your module tree; the admin screen lists it.
3. With NO workflow configured: your module behaves byte-identically to before (fallback).
4. Configure a 1-step workflow in the admin screen → submit → `pendingForUser` shows the
   approver → approve → your `onDecision` ran once → your data changed → your sync carries it.
5. Reject → your `returnToSubmitter` ran once, submitter sees the remarks.
6. Replay the approve (same call twice) → 409, your data unchanged.
7. Disable the scope (admin toggle) → module falls back to legacy behaviour.
8. Second tenant (if MT): configure a different workflow → no cross-tenant leakage.
9. `npx vitest run server/modules/approval-engine server/approval-demo` still green.

## Migrating an old per-module approval config

Pattern (planned for Technical's awc matrix; write a one-off generator, not a migration of the
engine): read each old config row → build the equivalent linear workflow (one approval-step per
old level, quorum `any` for pool-style levels) → `POST /approval-engine/workflows` per scope +
classification → verify with an approver-set equality test (old config's allowed approvers ==
`resolveApprovers` of every slot) → only then point the module's submit at the engine, keeping
the old config table read-only until cutover.
