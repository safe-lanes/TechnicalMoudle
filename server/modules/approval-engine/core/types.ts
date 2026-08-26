/**
 * Approval Engine — core DTOs and the card (module adapter) contract. Design v3.
 *
 * RULES OF THIS FOLDER (enforced by __tests__/importBoundary.test.ts):
 *   server/modules/approval-engine/** imports NOTHING outside itself except node_modules
 *   and node builtins. No Express types in core, no module objects, plain JSON DTOs only.
 */

// ── Scope ────────────────────────────────────────────────────────────────────
/** Where in a product a workflow applies. actionId is '' when the screen has one action. */
export interface Scope {
  moduleId: string;
  screenId: string;
  actionId: string;
}
export const scopeKey = (s: Scope) => `${s.moduleId}/${s.screenId}/${s.actionId}`;

// ── Workflow graph (v3 §A1) ─────────────────────────────────────────────────
/** All node types exist in the schema from day one; v1 implements approval-step + end only. */
export type NodeType = 'approval-step' | 'condition' | 'parallel-fork' | 'parallel-join' | 'end';
/** v3 §A2 — quorum, not AND/OR booleans. AND = all, OR = any. */
export type QuorumRule = 'all' | 'any' | 'nOfM';
export type WorkflowMode = 'simple' | 'advanced';

export interface RoleSlotDef {
  /** Stable role id (ruid-style) — NEVER a display name (v3 §A9). */
  roleId: string;
  /** Display snapshot taken at save time; rendering only. */
  roleLabel: string;
}
export interface NodeDef {
  key: string;
  type: NodeType;
  label: string;
  ordinal: number;
  quorum?: { rule: QuorumRule; n?: number };
  slots?: RoleSlotDef[];
}
export interface EdgeDef { from: string; to: string; }

/** What a caller saves (version and status are assigned by the engine). */
export interface WorkflowDefInput {
  scope: Scope;
  classification: string;
  mode: WorkflowMode;
  label: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
}
export interface StoredWorkflow extends WorkflowDefInput {
  wfuuid: string;
  version: number;
  status: 'draft' | 'active' | 'superseded';
  createdBy: string;
  createdAt: string;
}
export interface StoredWorkflowSummary {
  wfuuid: string; scope: Scope; classification: string; mode: WorkflowMode;
  label: string; version: number; status: string; createdBy: string; createdAt: string;
}

// ── Requests / progress ──────────────────────────────────────────────────────
export type RequestStatus = 'pending' | 'approved' | 'returned';
export type SlotStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'superseded';

export interface RequestRow {
  requuid: string;
  scope: Scope;
  classification: string;
  subjectRef: string;
  vesselId: string | null;
  /** Full workflow snapshot at submit time — edits never touch in-flight requests. */
  snapshot: WorkflowDefInput & { wfuuid: string; version: number };
  status: RequestStatus;
  currentNodeKey: string | null;
  submittedBy: string;
  submittedAt: string;
  finalizedAt: string | null;
}
export interface RequestSlotRow {
  requuid: string;
  nodeKey: string;
  slotOrdinal: number;
  roleId: string;
  roleLabel: string;
  status: SlotStatus;
  /** Resolved at node activation (card.resolveApprovers) — feeds pendingForUser + events. */
  resolvedApproverIds: string[] | null;
  decidedBy: string | null;
  decidedAt: string | null;
  remarks: string | null;
}
export interface SlotUpdate {
  nodeKey: string;
  slotOrdinal: number;
  status: SlotStatus;
  resolvedApproverIds?: string[];
  decidedBy?: string | null;
  decidedAt?: string | null;
  remarks?: string | null;
}
export interface PendingItem {
  requuid: string; scope: Scope; classification: string; subjectRef: string;
  nodeKey: string; nodeLabel: string; roleId: string; roleLabel: string; submittedAt: string;
}

// ── Engine operation DTOs ────────────────────────────────────────────────────
/** Tenant + actor context every operation carries (v3 §A7). */
export interface EngineCtx {
  tenantId: string;
  // isAdmin (optional): the HOST marks admin actors (e.g. Sail/Super/PMS Admin) so the engine
  // can grant them a decide override — parity with the host's legacy admin bypass. The engine
  // stays host-role-agnostic; it never inspects role NAMES.
  actor: { userId: string; role: string | null; userType: 'Office' | 'Ship' | null; isAdmin?: boolean };
}
export type SubmitOutcome =
  | { outcome: 'STARTED'; requuid: string; activeNodeKey: string }
  | { outcome: 'NO_WORKFLOW' }      // module falls back to its legacy behaviour
  | { outcome: 'DISABLED' }         // scope disabled for this tenant
  | { outcome: 'ALREADY_PENDING'; requuid: string };
export interface SubmitInput {
  scope: Scope;
  subjectRef: string;
  /** Opaque subject payload handed to card.classify — the engine never interprets it. */
  subject: unknown;
  vesselId?: string | null;
}
export interface DecideInput { decision: 'approve' | 'reject'; remarks?: string; }
export interface DecideResult {
  requuid: string;
  requestStatus: RequestStatus;
  nodeKey: string;
  nodeSatisfied: boolean;
  activatedNodeKey: string | null;
  /** set when onDecision threw — the request state above is already committed. */
  callbackError?: string;
}

// ── Events (v3 §A8) — engine emits, core sends nothing itself ───────────────
export type EngineEvent =
  | { type: 'step-activated'; tenantId: string; requuid: string; scope: Scope; subjectRef: string; nodeKey: string; approverUserIds: string[] }
  | { type: 'request-completed'; tenantId: string; requuid: string; scope: Scope; subjectRef: string }
  | { type: 'request-returned'; tenantId: string; requuid: string; scope: Scope; subjectRef: string; returnedBy: string; remarks: string | null };

// ── Card contract (v3 §A4) — the module adapter ─────────────────────────────
export interface CardScope {
  screenId: string;
  actionId: string;
  label: string;
  classifications: { id: string; label: string }[];
}
export interface CardCtx { tenantId: string; }
export interface RoleOption { roleId: string; roleLabel: string; }
export interface DecisionNotice {
  requuid: string;
  scope: Scope;
  classification: string;
  subjectRef: string;
  outcome: 'approved' | 'returned';
  decidedBy: string;
  remarks: string | null;
}
export interface ApprovalCard {
  moduleId: string;
  label: string;
  scopes: CardScope[];
  /** Roles offered to the builder + resolved for slots. Stable ids, display labels. */
  listRoles(ctx: CardCtx, scope: Scope): Promise<RoleOption[]>;
  /** Maps a subject to one of the scope's classification ids. */
  classify(ctx: CardCtx, scope: Scope, subject: unknown): Promise<string>;
  /** User ids currently holding the role (per tenant / vessel as the card sees fit). */
  resolveApprovers(ctx: CardCtx, scope: Scope, roleId: string, subjectRef: string): Promise<string[]>;
  /** Fired EXACTLY once when a request reaches a terminal state. Must be idempotent. */
  onDecision(ctx: CardCtx, notice: DecisionNotice): Promise<void>;
  /** Optional notification hook on step activation. */
  onPending?(ctx: CardCtx, evt: { requuid: string; scope: Scope; subjectRef: string; nodeKey: string; approverUserIds: string[] }): Promise<void>;
}
