/**
 * Part A lock (Jeevan #10; decision D2, Ghazi 22-Oct-2026).
 *
 * After the first save, Part A (the original report) cannot be changed — by anyone. Only a Sail Admin may unlock
 * it, with a reason; that unlock allows ONE save that changes Part A, then the lock is back. Both the unlock and the
 * edit are recorded on the defect's own audit trail (a column of the defect, so it syncs ship ⇄ shore).
 * Saves that re-send the same Part A values (every Part B/C save does) are never refused.
 */
import { AppError } from '../../shared/errors';

/** Fields the user types or picks in Part A. Auto-filled values (vessel name, make/model from the component,
 *  derived description html/text) are left out so master-data changes can never block a save. Target Date is
 *  left out on purpose: extension approvals move it. */
export const PART_A_LOCKED_FIELDS = [
  'vesselId', 'issueDate', 'dateReportedToOffice', 'dateRegisteredInSystem',
  'description', 'defectType', 'defectCategory', 'source', 'equipmentCategory',
  'componentId', 'componentHardwareId', 'componentHardwareLevel1', 'componentHardwareLevel2', 'componentHardwareLevel3',
  'raisedById', 'raisedByName', 'raisedByRank', 'critical', 'is_coc',
  'vesselLocationType', 'vesselLocationDetail', 'portName', 'latitude', 'longitude',
  'partAAttachments',
] as const;

export const PART_A_UNLOCK_ROLE = 'Sail Admin';

type TrailEntry = { action: string; userId: string; userName: string; timestamp: string; details?: any };
const UNLOCKED = 'part-a-unlocked';
const EDITED = 'part-a-edited';

function norm(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === false) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    // attachments: compare by identity, not by (large) content
    return JSON.stringify(value.map((v: any) => (v && typeof v === 'object' ? (v.id ?? v.name ?? JSON.stringify(v)) : v)));
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
}

/** Part A fields this body would change (only fields the body actually carries). */
export function changedPartAFields(current: any, body: any): string[] {
  return PART_A_LOCKED_FIELDS.filter((f) => body?.[f] !== undefined && norm(body[f]) !== norm(current?.[f]));
}

const trailOf = (defect: any): TrailEntry[] => (Array.isArray(defect?.auditTrail) ? defect.auditTrail : []);

/** Unlocked = the latest Part A trail entry is an unlock not yet used by an edit. */
export function isPartAUnlocked(defect: any): boolean {
  const last = [...trailOf(defect)].reverse().find((e) => e?.action === UNLOCKED || e?.action === EDITED);
  return last?.action === UNLOCKED;
}

/**
 * Called on every update. Returns the body to save: refuses a Part A change while locked; after an unlock, lets it
 * through and appends the "edited" entry (which re-locks). The audit trail is server-owned — the browser's copy is
 * never saved.
 */
export function applyPartALock(current: any, body: any, actor: { userUuid?: string | null; name?: string | null }): any {
  const out = { ...body };
  delete out.auditTrail;
  const changed = changedPartAFields(current, out);
  if (changed.length === 0) return out;
  if (!isPartAUnlocked(current)) {
    throw new AppError(409, `Part A is locked after the first save and cannot be changed (${changed.join(', ')}). A Sail Admin can unlock it with a reason.`, { code: 'PART_A_LOCKED', fields: changed });
  }
  out.auditTrail = [...trailOf(current), {
    action: EDITED, userId: actor.userUuid || 'unknown', userName: actor.name || actor.userUuid || 'unknown',
    timestamp: new Date().toISOString(), details: { fields: changed },
  } satisfies TrailEntry];
  return out;
}

/** The trail after a Sail Admin unlock (reason required). */
export function unlockPartATrail(current: any, reason: string, actor: { userUuid?: string | null; name?: string | null; role?: string | null }): TrailEntry[] {
  if (actor.role !== PART_A_UNLOCK_ROLE) throw new AppError(403, 'Only a Sail Admin can unlock Part A.', { code: 'PART_A_UNLOCK_FORBIDDEN' });
  const why = (reason ?? '').trim();
  if (!why) throw new AppError(400, 'A reason is required to unlock Part A.', { code: 'PART_A_UNLOCK_REASON_REQUIRED' });
  if (isPartAUnlocked(current)) throw new AppError(409, 'Part A is already unlocked for one edit.', { code: 'PART_A_ALREADY_UNLOCKED' });
  return [...trailOf(current), {
    action: UNLOCKED, userId: actor.userUuid || 'unknown', userName: actor.name || actor.userUuid || 'unknown',
    timestamp: new Date().toISOString(), details: { reason: why },
  }];
}
