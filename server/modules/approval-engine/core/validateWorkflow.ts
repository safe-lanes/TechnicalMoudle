/**
 * Workflow graph validator — v1 rules (design v3 §A1–§A3).
 * The schema knows condition / parallel-fork / parallel-join; v1 REJECTS them explicitly,
 * rejects mode 'advanced', and accepts only a linear chain of 1..6 approval-steps ending
 * in exactly one 'end' node.
 */
import type { WorkflowDefInput } from './types';

export class WorkflowValidationError extends Error {
  constructor(message: string) { super(message); }
}
const bad = (m: string): never => { throw new WorkflowValidationError(m); };

export const MAX_APPROVAL_STEPS = 6;

export function validateWorkflowV1(def: WorkflowDefInput): void {
  if (def.mode === 'advanced') bad(`mode 'advanced' is not yet supported`);
  if (def.mode !== 'simple') bad(`unknown mode '${def.mode}'`);
  if (!def.label?.trim()) bad('label is required');
  if (!def.classification?.trim()) bad('classification is required');
  if (!Array.isArray(def.nodes) || def.nodes.length === 0) bad('at least one node is required');
  if (!Array.isArray(def.edges)) bad('edges must be an array');

  const keys = new Set<string>();
  const steps = [] as typeof def.nodes;
  let ends = 0;
  for (const n of def.nodes) {
    if (!n.key?.trim()) bad('every node needs a key');
    if (keys.has(n.key)) bad(`duplicate node key '${n.key}'`);
    keys.add(n.key);
    if (n.type === 'approval-step') {
      steps.push(n);
      const slots = n.slots ?? [];
      if (slots.length === 0) bad(`approval-step '${n.key}' needs at least one role slot`);
      const roleIds = new Set<string>();
      for (const s of slots) {
        if (!s.roleId?.trim()) bad(`approval-step '${n.key}': slot roleId is required (stable id, never a name)`);
        if (!s.roleLabel?.trim()) bad(`approval-step '${n.key}': slot roleLabel snapshot is required`);
        if (roleIds.has(s.roleId)) bad(`approval-step '${n.key}': duplicate role '${s.roleId}'`);
        roleIds.add(s.roleId);
      }
      const q = n.quorum ?? bad(`approval-step '${n.key}' needs a quorum rule`);
      if (q.rule === 'nOfM') {
        if (!Number.isInteger(q.n) || (q.n as number) < 1 || (q.n as number) > slots.length) {
          bad(`approval-step '${n.key}': nOfM needs 1 <= n <= ${slots.length}`);
        }
      } else if (q.rule !== 'all' && q.rule !== 'any') {
        bad(`approval-step '${n.key}': unknown quorum rule '${(q as any).rule}'`);
      }
    } else if (n.type === 'end') {
      ends++;
    } else if (n.type === 'condition' || n.type === 'parallel-fork' || n.type === 'parallel-join') {
      bad(`node type '${n.type}' is not yet supported (v1 implements approval-step + end only)`);
    } else {
      bad(`unknown node type '${(n as any).type}'`);
    }
  }
  if (steps.length === 0) bad('at least one approval-step is required');
  if (steps.length > MAX_APPROVAL_STEPS) bad(`at most ${MAX_APPROVAL_STEPS} approval-steps (got ${steps.length})`);
  if (ends !== 1) bad(`exactly one 'end' node is required (got ${ends})`);

  // Linear chain: every edge endpoint exists; ≤1 outgoing per node; exactly one entry; all reachable; ends at 'end'.
  const out = new Map<string, string>();
  const hasIncoming = new Set<string>();
  for (const e of def.edges) {
    if (!keys.has(e.from)) bad(`edge from unknown node '${e.from}'`);
    if (!keys.has(e.to)) bad(`edge to unknown node '${e.to}'`);
    if (out.has(e.from)) bad(`node '${e.from}' has more than one outgoing edge (v1 is linear)`);
    out.set(e.from, e.to);
    hasIncoming.add(e.to);
  }
  const endKey = def.nodes.find((n) => n.type === 'end')!.key;
  if (out.has(endKey)) bad(`'end' node must have no outgoing edge`);
  const entries = def.nodes.filter((n) => !hasIncoming.has(n.key));
  if (entries.length !== 1) bad(`exactly one entry node is required (got ${entries.length})`);
  if (entries[0].type !== 'approval-step') bad('the entry node must be an approval-step');
  // walk
  let cur: string | undefined = entries[0].key;
  const visited = new Set<string>();
  while (cur) {
    if (visited.has(cur)) bad('cycle detected');
    visited.add(cur);
    if (cur === endKey) break;
    cur = out.get(cur);
    if (!cur) bad('chain does not reach the end node');
  }
  if (visited.size !== def.nodes.length) bad('all nodes must be on the single chain (unreachable node found)');
}

/** Entry node of a validated v1 workflow (single entry guaranteed by the validator). */
export function entryNodeKey(def: WorkflowDefInput): string {
  const hasIncoming = new Set(def.edges.map((e) => e.to));
  return def.nodes.find((n) => !hasIncoming.has(n.key))!.key;
}
export function nextNodeKey(def: WorkflowDefInput, from: string): string | null {
  return def.edges.find((e) => e.from === from)?.to ?? null;
}
