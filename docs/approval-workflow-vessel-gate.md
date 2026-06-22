# Approval Workflow — Vessel Gate Implementation Note

**Created:** 2026-06-20
**Status:** Phase 1 implemented (profile-based, frontend-only)

---

## What This Note Is For

The approval workflow has a vessel-scoping gate: an approver should only be able to approve or reject requests for vessels assigned to them. This note documents why Phase 1 was built the way it was, what its limitations are, and the exact upgrade path when a better data source becomes available.

---

## Phase 1 — Current Implementation (Profile-Based, Frontend-Only)

### Why this approach

There is only one authoritative source of vessel assignments for office users: the **external auth/profile service**, which populates `myVessels` into the user's profile on login. This data is stored in encrypted localStorage and normalised into `assignedVesselIds` by `VesselContext`.

A separate DB table for vessel assignments was ruled out because:
- It would create a **second source of truth** that could drift from the profile service
- Keeping it in sync requires a background sync process or manual admin work
- The profile service is the correct owner of "who is responsible for which vessel"

### Three locations changed — frontend only

No schema changes, no migrations, no new API calls.

| File | Variable gated | Request vessel ID |
|---|---|---|
| `client/src/components/PostponeApprovalDialog.tsx` | `userCanAct` | `workOrder?.vesselId` (prop field added) |
| `client/src/components/modifyPms/ModifyPMS.tsx` | `userCanAct` | `viewingRequest?.vesselId` |
| `client/src/pages/pms/Dashboard.tsx` | `postponeUserCanAct` | `postponeDecisionDialog.wo?.vesselId` |

### The gate pattern (identical in all three locations)

```typescript
// assignedVesselIds — from useVessel() hook (deduped profile vessel UUIDs)
// isSailAdmin — from useUIRole() hook (already present in all three files)

// Fail-closed: if profile has assignments AND request carries no vesselId → deny
const vesselIsAssigned =
  isSailAdmin                                            // Sail Admin: global scope
  || assignedVesselIds.length === 0                      // No profile assignments: global scope (safe fallback)
  || (!!requestVesselId && assignedVesselIds.includes(requestVesselId)); // Vessel explicitly assigned

const userCanAct = vesselIsAssigned && (
  (loading)
    ? false
    : (noStepsYet || noApproversConfigured)
      ? (!isVessel && !isHeadOfDept)       // fallback path also vessel-gated
      : userIsApproverForActiveStep
);
```

**Fail-closed rationale:** if `assignedVesselIds` is non-empty (profile has assignments) and the request's `vesselId` is null or missing, access is denied. This prevents malformed or incomplete data from silently bypassing the gate. Prior to this hardening, a missing `vesselId` would have fallen through to `true` (allow), which is unsafe.

### What this gives us

- Approve/Reject buttons are hidden for requests from vessels not in the approver's profile
- Sail Admin retains global access (role bypass)
- Accounts with empty `assignedVesselIds` (profile not populated) retain global access (permissive fallback — prevents total lockout for accounts where profile service does not send vessel assignments)
- The `noApproversConfigured` fallback path is also vessel-gated (intentional behaviour change)
- Missing/null request `vesselId` with a non-empty profile → deny (fail-closed)

---

## Known Limitations of Phase 1

| Limitation | Detail |
|---|---|
| **Frontend-only enforcement** | Backend `verifyApproverForLevel` does not check vessel — direct API calls bypass the gate |
| **Stale until re-login** | If the profile service changes vessel assignments, the user must log out and back in |
| **Silent empty-list fallback** | If `myVessels` is missing/null in the profile, `assignedVesselIds` is empty → global scope silently |
| **PMS Admin not explicitly bypassed** | Only Sail Admin has an explicit role bypass; PMS Admin relies on the empty-list fallback |

---

## Risk Assessment Summary

| Risk | Severity | Status |
|---|---|---|
| Frontend-only enforcement — API bypass possible | High | Accepted for Phase 1; Phase 2 adds backend check |
| Profile data missing → silent global fallback | Medium | Acceptable for Phase 1; Phase 2 uses DB as authoritative source |
| Stale assignments until next login | Medium | Acceptable — action is gated, view is not |
| Admin accounts without myVessels restricted | Low | Sail Admin explicit bypass; PMS Admin uses empty-list fallback |
| Fallback path now vessel-gated (behaviour change) | Low | Intentional — documented here |
| Missing vesselId on request → allow (old behaviour) | Low | Fixed — now fail-closed when profile has assignments |

---

## Phase 2 — Recommended Future Upgrade

**Trigger for upgrade:** When a reliable, queryable server-side source of vessel assignments exists for approvers (a DB table fed by the profile service, or a server-side profile API endpoint).

### New DB table: `moc_approver_vessel_assignments`

```typescript
// shared/schema.ts
export const mocApproverVesselAssignments = pgTable("moc_approver_vessel_assignments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  mavauuid: text("mavauuid").notNull().unique().default(sql`gen_random_uuid()::text`),
  mocApproverUuid: text("moc_approver_uuid").notNull(),  // FK → moc_approvers.mauuid
  vesselId: text("vessel_id").notNull().references(() => vessels.vuuid),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
}, (table) => [
  unique().on(table.mocApproverUuid, table.vesselId),
]);
```

Sync config: `ONE_WAY_SHORE_TO_SHIP`, `isGlobal: true`, Phase 1.

Migration workflow: edit `shared/schema.ts` → run `npm run db:generate` → server applies on next start.

### Backend `verifyApproverForLevel` gains vessel check

```typescript
// server/postgresStorage.ts
private async verifyApproverForLevel_internal(
  reviewerId: string,
  approvalLevel: string,
  vesselId: string          // NEW parameter
): Promise<boolean> {
  const db = await getDb();
  const found = await db.select().from(mocApprovers)
    .innerJoin(
      mocApproverVesselAssignments,
      and(
        eq(mocApproverVesselAssignments.mocApproverUuid, mocApprovers.mauuid),
        eq(mocApproverVesselAssignments.vesselId, vesselId),
        eq(mocApproverVesselAssignments.isActive, 1),
        eq(mocApproverVesselAssignments.isDeleted, false)
      )
    )
    .where(and(
      eq(mocApprovers.approverLevel, approvalLevel),
      eq(mocApprovers.userUuid, reviewerId),
      eq(mocApprovers.isActive, 1),
      eq(mocApprovers.isDeleted, false),
      eq(mocApprovers.modulename, 'Technical'),
    ));
  return found.length > 0;
}
```

Both `approveChangeRequest` and `approvePostponement` already pass through `verifyApproverForLevel` — they just need to start passing the `vesselId` from the WO/CR record.

### Frontend becomes a display-only optimisation

Once the backend blocks the action, the frontend `vesselIsAssigned` check becomes a UX optimisation (hide the button early) rather than a security gate. Both can coexist.

### Admin UI

Add vessel assignment management to the approver grid in DataMasters / ApprovalWorkflow config — each approver row shows a multi-select of vessels they are assigned to, backed by the new table.

### Migration path from Phase 1 to Phase 2

1. Create `moc_approver_vessel_assignments` table via `npm run db:generate` → apply on server start
2. Populate initial data by reading `myVessels` from profile service in bulk (one-time seeding migration)
3. Add `vesselId` parameter to `verifyApproverForLevel_internal` — callers already have `vesselId` from the WO/CR record
4. Add vessel assignment UI to admin screens
5. Register table in `shared/syncConfig.ts` as `ONE_WAY_SHORE_TO_SHIP`
6. Frontend `vesselIsAssigned` now provides belt-and-suspenders UX optimisation on top of the real backend gate

---

## Files Involved

| File | Phase 1 change | Phase 2 change |
|---|---|---|
| `client/src/components/PostponeApprovalDialog.tsx` | Added `vesselId` prop, vessel gate on `userCanAct` | Update to use DB assignments if available |
| `client/src/components/modifyPms/ModifyPMS.tsx` | Vessel gate on `userCanAct` | Update to use DB assignments if available |
| `client/src/pages/pms/Dashboard.tsx` | Vessel gate on `postponeUserCanAct` | Update to use DB assignments if available |
| `server/postgresStorage.ts` | None | `verifyApproverForLevel_internal` gains `vesselId` param + JOIN |
| `server/modules/work-orders/services/` | None | Pass `vesselId` to verify call |
| `server/modules/change-requests/` | None | Pass `vesselId` to verify call |
| `shared/schema.ts` | None | New `mocApproverVesselAssignments` table |
| `shared/syncConfig.ts` | None | Register new table ONE_WAY_SHORE_TO_SHIP |
| `client/src/pages/admin/DataMasters.tsx` | None | Vessel assignment UI per approver |

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-06-20 | Phase 1: frontend-only, profile-based vessel gate | Only source of vessel-approver mapping is the external auth profile service; no DB table available |
| 2026-06-20 | Empty `assignedVesselIds` → global scope (permissive fallback) | Prevents total lockout if profile service does not populate `myVessels` |
| 2026-06-20 | Sail Admin role bypasses vessel gate explicitly | Consistent with existing backend bypass in `verifyApproverForLevel` |
| 2026-06-20 | Fallback `noApproversConfigured` path also vessel-gated | Intentional — vessel scope should apply regardless of approver config state |
| 2026-06-20 | Missing/null `requestVesselId` with non-empty profile → deny (fail-closed) | Prevents malformed data from bypassing the gate; safer than fail-open |
