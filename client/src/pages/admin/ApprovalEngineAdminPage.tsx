/**
 * Phase 2 / W4 — routes the GENERIC engine admin screen (Sahil's builder) into Technical's
 * admin area. Office-only (menu hides it for vessel roles; the API refuses config writes for
 * non-office callers) and shore-only (the engine does not mount on ships). The legacy
 * ApprovalWorkflow screen stays untouched and reachable until cutover.
 */
import React from "react";
import ApprovalEngineAdmin from "../../../../server/modules/approval-engine/client/ApprovalEngineAdmin";

export default function ApprovalEngineAdminPage() {
  return <ApprovalEngineAdmin basePath="/technical/api/approval-engine" />;
}
