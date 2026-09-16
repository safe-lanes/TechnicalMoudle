import { describe, expect, it } from "vitest";
import { formatDecidedSlotRemark, formatDefectAuditTimestamp, formatInlineApprovalSlotRemark, formatMaritimeUtcDateTime, formatRejectionHeading, projectDiagnosticsSummary, projectExtensionCardPresentation, projectExtensionHistory } from "./defectApprovalPresentation";

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

  it("keeps a sole rejected current entry expanded and read-only", () => {
    const [projected] = projectExtensionHistory([{
      id: "rejected-current",
      status: "Rejected",
      requestedAt: "2026-09-16T11:50:11.473Z",
      reasonForExtension: "Insufficient evidence",
    }], {
      "rejected-current": { requestUuid: "request-rejected" },
    }, true);
    expect(projected.expanded).toBe(true);
    expect(projected.permissions).toMatchObject({
      current: true,
      terminal: true,
      canEdit: false,
      canDecide: false,
    });
    expect(projected.entry.reasonForExtension).toBe("Insufficient evidence");
    expect(projectExtensionCardPresentation({
      index: 0,
      total: 1,
      current: true,
      status: "Rejected",
      reasonForExtension: projected.entry.reasonForExtension,
    })).toEqual({
      title: "Extension — REJECTED",
      expanded: true,
      readOnly: true,
      reasonForExtension: "Insufficient evidence",
    });
  });

  it("keeps multi-entry rejected titles numbered while suppressing only 1 of 1", () => {
    expect(projectExtensionCardPresentation({
      index: 1,
      total: 2,
      current: true,
      status: "Rejected",
    }).title).toBe("Extension 2 of 2 — REJECTED");
    expect(projectExtensionCardPresentation({
      index: 0,
      total: 1,
      current: true,
      status: "Rejected",
    }).title).toBe("Extension — REJECTED");
  });

  it("formats Defects timestamps in maritime UTC without changing date-only values", () => {
    expect(formatMaritimeUtcDateTime("2026-09-16T11:50:11.473Z")).toBe("16 Sep 2026, 1150 Z");
    expect(formatMaritimeUtcDateTime("2026-09-16T23:05:00-04:00")).toBe("17 Sep 2026, 0305 Z");
    expect(formatMaritimeUtcDateTime("2026-09-16")).toBe("2026-09-16");
    expect(formatMaritimeUtcDateTime("legacy value")).toBe("legacy value");
    expect(formatMaritimeUtcDateTime(null)).toBe("");
  });

  it("keeps non-decision Defects audit timestamps on their existing locale display", () => {
    const closedOn = "2026-09-16T11:50:11.473Z";
    expect(formatDefectAuditTimestamp(closedOn, "record")).toBe(new Date(closedOn).toLocaleString());
    expect(formatDefectAuditTimestamp(closedOn, "decision")).toBe("16 Sep 2026, 1150 Z");
  });

  it("renders remarks only for decided approved or rejected slots", () => {
    expect(formatDecidedSlotRemark("approved", "Accepted after evidence review")).toBe("Accepted after evidence review");
    expect(formatDecidedSlotRemark("rejected", "Needs a revised closeout date")).toBe("Needs a revised closeout date");
    expect(formatDecidedSlotRemark("approved", "   ")).toBe("");
    expect(formatDecidedSlotRemark("pending", "Not yet decided")).toBe("");
  });

  it("keeps rejection remarks only in the step-aware summary banner", () => {
    expect(formatInlineApprovalSlotRemark("rejected", "Insufficient evidence")).toBe("");
    expect(formatInlineApprovalSlotRemark("approved", "Approved with monitoring")).toBe("Approved with monitoring");
    expect(formatRejectionHeading(1, 3, "Manager One")).toBe("Rejected at Step 2 by Manager One");
    expect(formatRejectionHeading(0, 1, "Manager One")).toBe("Rejected by Manager One");
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