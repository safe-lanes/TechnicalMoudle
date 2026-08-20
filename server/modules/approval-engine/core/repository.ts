/**
 * Repository contract (design v3 §A6). Engine core NEVER touches a DB directly;
 * Drizzle/Postgres (../db/drizzleRepository.ts) is the only production implementation.
 * The provider resolves a repository PER TENANT (v3 §A7) — engine tables live in each
 * tenant's own database.
 */
import type {
  PendingItem, RequestRow, RequestSlotRow, Scope, SlotUpdate,
  StoredWorkflow, StoredWorkflowSummary, WorkflowDefInput,
} from './types';

export interface ApprovalRepository {
  // ── workflows (versioned; a save supersedes the previous active) ──────────
  getActiveWorkflow(scope: Scope, classification: string): Promise<StoredWorkflow | null>;
  getWorkflow(wfuuid: string): Promise<StoredWorkflow | null>;
  listWorkflows(scope?: Scope): Promise<StoredWorkflowSummary[]>;
  /** Transactional: version = max(existing)+1, previous active → superseded, new row active. */
  saveWorkflowVersion(def: WorkflowDefInput, actor: string): Promise<StoredWorkflow>;

  // ── per-tenant scope settings (default enabled) ────────────────────────────
  getScopeEnabled(scope: Scope): Promise<boolean>;
  setScopeEnabled(scope: Scope, enabled: boolean, actor: string): Promise<void>;

  // ── requests / progress ────────────────────────────────────────────────────
  /** Transactional: request row + ALL slot rows. */
  createRequest(row: RequestRow, slots: RequestSlotRow[]): Promise<void>;
  getRequest(requuid: string): Promise<RequestRow | null>;
  findPendingBySubject(scope: Scope, subjectRef: string): Promise<RequestRow | null>;
  listBySubject(scope: Scope, subjectRef: string): Promise<RequestRow[]>;
  getSlots(requuid: string): Promise<RequestSlotRow[]>;
  /** Transactional: slot updates + optional current_node_key move, one commit. */
  applySlotUpdates(requuid: string, updates: SlotUpdate[], setCurrentNodeKey?: string | null): Promise<void>;
  /**
   * pending → terminal transition. Returns true ONLY for the call that actually
   * transitioned the row (single-fire guard for onDecision).
   */
  finalizeRequest(requuid: string, status: 'approved' | 'returned'): Promise<boolean>;
  /** Active slots whose resolved approver ids contain userId, joined to their requests. */
  pendingSlotsForUser(userId: string): Promise<PendingItem[]>;
}

export interface TenantRepositoryProvider {
  forTenant(tenantId: string): ApprovalRepository;
}
