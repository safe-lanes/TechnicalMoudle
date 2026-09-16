import { describe, expect, it } from "vitest";
import { formatDecidedSlotRemark, projectDiagnosticsSummary, projectExtensionHistory } from "./defectApprovalPresentation";

describe("approval history and diagnostics projections", () => {
  it("keeps three mixed extension entries oldest-first with every label", () => {
    const entries = [
      { id: "middle", status: "Rejected", requestedAt: "2026-02-01", approvalDate: "2026-02-02", electronicConfirmation: "Local confirmation", submitForApprovalToName: "Chief Officer", approverComments: "Rework required" },
      { id: "old", status: "Approved", requestedAt: "2026-01-01" },
      { id: "current", status: "Requested", requestedAt: "2026-03-01" },
    ];
    const projected = projectExtensionHistory(entries, { old: { requestUuid: "chain-old" }, middle: { requestUuid: "chain-middle" }, current: { requestUuid: "chain-current" } }, true);
    expect(projected.map((row) => row.label)).toEqual([
      "Extension 1 of 3 — APPROVED",
      "Extension 2 of 3 — REJECTED",
      "Extension 3 of 3 — REQUESTED",
    ]);
    expect(projected.map((row) => row.chainId)).toEqual(["chain-old", "chain-middle", "chain-current"]);
    expect(projected.map((row) => row.expanded)).toEqual([false, false, true]);
    expect(projected[0].permissions).toMatchObject({ canEdit: false, canDecide: false, terminal: true });
    expect(projected[1].permissions).toMatchObject({ canEdit: false, canDecide: false, terminal: true });
    expect(projected[2].permissions).toMatchObject({ canEdit: true, canDecide: true, terminal: false });
    expect(projected[1].attribution).toEqual({ approvalDate: "2026-02-02", electronicConfirmation: "Local confirmation", intendedApprover: "Chief Officer", approverComments: "Rework required" });
  });

  it("uses persisted history order when legacy timestamps are incomplete", () => {
    const entries = [
      { id: "legacy-oldest", status: "Approved" },
      { id: "dated-middle", status: "Rejected", requestedAt: "2026-02-01" },
      { id: "dated-current", status: "Requested", requestedAt: "2026-03-01" },
    ];
    const projected = projectExtensionHistory(entries, undefined, true);
    expect(projected.map((row) => row.entry.id)).toEqual(["legacy-oldest", "dated-middle", "dated-current"]);
    expect(projected.map((row) => row.expanded)).toEqual([false, false, true]);
    expect(projected.map((row) => row.permissions.current)).toEqual([false, false, true]);
  });

  it("renders remarks only for decided approved or rejected slots", () => {
    expect(formatDecidedSlotRemark("approved", "Accepted after evidence review")).toBe("Accepted after evidence review");
    expect(formatDecidedSlotRemark("rejected", "Needs a revised closeout date")).toBe("Needs a revised closeout date");
    expect(formatDecidedSlotRemark("approved", "   ")).toBe("");
    expect(formatDecidedSlotRemark("pending", "Not yet decided")).toBe("");
  });

  it("projects exactly four warning chips and a quiet healthy state", () => {
     expect(projectDiagnosticsSummary({ workflowGaps: 1, unresolvedApprovers: 0, stalledRequests: 2, orphanRequestedExtensions: 0 })).toEqual({
      healthy: false,
      chips: [
        { key: "workflowGaps", label: "Workflow gaps", count: 1 },
        { key: "unresolvedApprovers", label: "Unresolved approvers", count: 0 },
        { key: "stalledRequests", label: "Stalled requests", count: 2 },
        { key: "orphanRequestedExtensions", label: "Orphan requested extensions", count: 0 },
         { key: "returnedVerificationStillVerified", label: "Returned verifications still verified", count: 0 },
      ],
    });
    expect(projectDiagnosticsSummary({}).healthy).toBe(true);
  });
});