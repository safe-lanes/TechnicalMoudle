/**
 * Audit Trail Viewer service (Phase 3) — READ-ONLY.
 *
 * Presents a unified BUSINESS audit trail over three clean sources:
 *   - audit_log               (component register, role-permission, rank, WO lifecycle, job actions)
 *   - running_hours_audit      (RH changes, frozen actor_label)
 *   - work_order_postponements (postpone request/approve/reject)
 *
 * sync_field_log is DELIBERATELY EXCLUDED — it is a sync mechanism (internal row UUIDs, raw
 * values), not a business audit record. Every source is mapped into ONE common row shape.
 *
 * NEVER mutates any audit table. All queries are SELECT-only.
 */
import { storage } from '../../storage';
import { getPool } from '../../db';

export type LogType =
  | 'all'
  | 'work_orders'
  | 'components'
  | 'running_hours'
  | 'permissions'
  | 'postponements';

export interface AuditFilters {
  logType?: LogType;
  startDate?: Date;
  endDate?: Date;
  actor?: string;       // free-text match against actor label / id
  entityCode?: string;  // free-text match against equipment / WO / role code
  actionType?: string;
}

export interface AuditViewRow {
  id: string;            // composite source id — NOT shown as the primary identifier
  whenTs: string;        // ISO UTC — canonical sort/filter key
  when: string;          // ISO UTC business date (display)
  who: string;           // frozen actor: name (office) / rank (ship)
  whoType: string | null;
  action: string;        // clean business action label
  entityType: string;    // 'Work Order' | 'Component' | 'Permission (Role)' | 'Rank' | 'Running Hours' | 'Postponement'
  entityRef: string;     // friendly code/id (WO no, component code, role/rank name)
  oldValue: string | null;
  newValue: string | null;
  changes: string | null; // flattened "field: old → new; ..."
  logType: Exclude<LogType, 'all'> | 'other';
  remarks: string | null;
  source: string | null;
}

const AUDIT_LOG_ENTITY_TYPES_FOR: Record<Exclude<LogType, 'all' | 'running_hours' | 'postponements'>, string[]> = {
  work_orders: ['work_order'],
  components: ['component'],
  permissions: ['role_permission', 'rank'],
};

function humanize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ── audit_log row → common shape ──────────────────────────────────────────────
function mapAuditLogRow(r: any): AuditViewRow {
  const p = (r.payload && typeof r.payload === 'object') ? r.payload : {};
  const et: string = r.entityType ?? r.entity_type;
  let entityType = 'Record';
  let logType: AuditViewRow['logType'] = 'other';
  let entityRef = r.entityId ?? r.entity_id;
  if (et === 'work_order') { entityType = 'Work Order'; logType = 'work_orders'; entityRef = p.workOrderNo || entityRef; }
  else if (et === 'component') { entityType = 'Component'; logType = 'components'; entityRef = p.componentCode || r.componentCode || r.component_code || entityRef; }
  else if (et === 'role_permission') { entityType = 'Permission (Role)'; logType = 'permissions'; entityRef = p.subject?.roleName || entityRef; }
  else if (et === 'rank') { entityType = 'Rank'; logType = 'permissions'; entityRef = p.subject?.rankName || entityRef; }
  else { entityType = humanize(et); }

  // before → new / changes
  let oldValue: string | null = toStr(r.oldValue ?? r.old_value);
  let newValue: string | null = toStr(r.newValue ?? r.new_value);
  let changes: string | null = null;
  if (p.changedFields && typeof p.changedFields === 'object') {
    const parts = Object.entries(p.changedFields).map(([f, v]: [string, any]) =>
      `${f}: ${toStr(v?.old) ?? '∅'} → ${toStr(v?.new) ?? '∅'}`);
    if (parts.length) changes = parts.join('; ');
  } else if (Array.isArray(p.changedMenus)) {
    changes = `${p.changedMenus.length} permission(s) changed`;
  } else if (p.before !== undefined || p.after !== undefined) {
    oldValue = oldValue ?? toStr(p.before?.label ?? p.before);
    newValue = newValue ?? toStr(p.after?.label ?? p.after);
  }
  // remarks: prefer explicit, else a compact snapshot for creates
  const remarks = toStr(p.rejectionComments ?? p.remarks ?? p.status ?? (p.generated ? 'system-generated' : null));

  const ts = (r.timestamp instanceof Date) ? r.timestamp.toISOString() : new Date(r.timestamp).toISOString();
  return {
    id: `audit_log:${r.id}`,
    whenTs: ts,
    when: ts,
    who: p.actorLabel || r.userId || r.user_id || 'system',
    whoType: p.actorType ?? null,
    action: humanize(r.actionType ?? r.action_type),
    entityType,
    entityRef: entityRef ?? '',
    oldValue,
    newValue,
    changes,
    logType,
    remarks,
    source: r.source ?? null,
  };
}

// ── running_hours_audit row → common shape ─────────────────────────────────────
function mapRhRow(r: any): AuditViewRow {
  const ts = new Date(r.entered_at_utc ?? r.created_at).toISOString();
  return {
    id: `running_hours_audit:${r.rhauuid ?? r.id}`,
    whenTs: ts,
    when: ts,
    who: r.actor_label || r.user_id || 'system',
    whoType: null,
    action: 'Running Hours Update',
    entityType: 'Running Hours',
    entityRef: r.component_name ? `${r.component_name}${r.component_code ? ` (${r.component_code})` : ''}` : (r.component_code || r.component_id || ''),
    oldValue: toStr(r.previous_rh),
    newValue: toStr(r.new_rh),
    changes: `RH: ${toStr(r.previous_rh) ?? '∅'} → ${toStr(r.new_rh) ?? '∅'}`,
    logType: 'running_hours',
    remarks: toStr(r.notes),
    source: r.source ?? null,
  };
}

// ── work_order_postponements row → common shape ────────────────────────────────
function mapPostponementRow(r: any): AuditViewRow {
  const status: string = r.status ?? '';
  let action = `Postpone ${humanize(status)}`;
  let who = r.created_by_uuid || 'Requester';
  let whenSrc = r.submitted_date || r.created_at;
  const decided = /approved/i.test(status) || /rejected/i.test(status);
  if (decided) {
    action = /approved/i.test(status) ? 'Postpone Approved' : 'Postpone Rejected';
    who = r.approved_by || r.authorized_by || r.approver || who;
    whenSrc = r.approved_date || whenSrc;
  } else {
    action = 'Postpone Requested';
  }
  // canonical sort/filter key = created_at (a real timestamp); display = business date
  const tsKey = new Date(r.created_at).toISOString();
  const displayDate = whenSrc ? new Date(whenSrc).toISOString() : tsKey;
  const remarks = [r.postponement_reason, r.postponement_remarks, r.approval_remarks].filter(Boolean).join(' — ') || null;
  return {
    id: `work_order_postponements:${r.id}`,
    whenTs: tsKey,
    when: displayDate,
    who,
    whoType: null,
    action,
    entityType: 'Postponement',
    entityRef: r.work_order_no || r.work_order_id || '',
    oldValue: toStr(r.original_due_date),
    newValue: toStr(r.new_due_date),
    changes: `Due: ${toStr(r.original_due_date) ?? '∅'} → ${toStr(r.new_due_date) ?? '∅'}`,
    logType: 'postponements',
    remarks,
    source: 'postponement',
  };
}

// ── per-source fetch (top N by recency, with filters) + count ──────────────────
async function fetchAuditLog(f: AuditFilters, take: number): Promise<{ rows: AuditViewRow[]; total: number }> {
  const entityTypes = (f.logType && f.logType !== 'all' && AUDIT_LOG_ENTITY_TYPES_FOR[f.logType as keyof typeof AUDIT_LOG_ENTITY_TYPES_FOR]) || undefined;
  const base = {
    entityTypes,
    actionType: f.actionType,
    actor: f.actor,
    entityCode: f.entityCode,
    startDate: f.startDate,
    endDate: f.endDate,
  };
  const [rows, total] = await Promise.all([
    storage.getAuditLogs({ ...base, limit: take, offset: 0 }),
    storage.countAuditLogs(base),
  ]);
  return { rows: rows.map(mapAuditLogRow), total };
}

async function fetchRunningHours(f: AuditFilters, take: number): Promise<{ rows: AuditViewRow[]; total: number }> {
  const pool = await getPool();
  const conds: string[] = ['(is_deleted IS DISTINCT FROM true)'];
  const vals: any[] = [];
  if (f.startDate) { vals.push(f.startDate.toISOString()); conds.push(`entered_at_utc >= $${vals.length}`); }
  if (f.endDate) { vals.push(f.endDate.toISOString()); conds.push(`entered_at_utc <= $${vals.length}`); }
  if (f.actor) { vals.push(`%${f.actor}%`); conds.push(`(actor_label ILIKE $${vals.length} OR user_id ILIKE $${vals.length})`); }
  if (f.entityCode) { vals.push(`%${f.entityCode}%`); conds.push(`(component_code ILIKE $${vals.length} OR component_name ILIKE $${vals.length})`); }
  if (f.actionType && !/running|rh/i.test(f.actionType)) { conds.push('1=0'); } // RH has a single action type
  const where = `WHERE ${conds.join(' AND ')}`;
  const countRes = await pool.query(`SELECT count(*)::int n FROM running_hours_audit ${where}`, vals);
  const rowsRes = await pool.query(
    `SELECT rhauuid, id, entered_at_utc, created_at, actor_label, user_id, previous_rh, new_rh, component_name, component_code, component_id, source, notes
     FROM running_hours_audit ${where} ORDER BY entered_at_utc DESC LIMIT ${take}`, vals);
  return { rows: rowsRes.rows.map(mapRhRow), total: Number(countRes.rows[0]?.n ?? 0) };
}

async function fetchPostponements(f: AuditFilters, take: number): Promise<{ rows: AuditViewRow[]; total: number }> {
  const pool = await getPool();
  const conds: string[] = ['(p.is_deleted IS DISTINCT FROM true)'];
  const vals: any[] = [];
  if (f.startDate) { vals.push(f.startDate.toISOString()); conds.push(`p.created_at >= $${vals.length}`); }
  if (f.endDate) { vals.push(f.endDate.toISOString()); conds.push(`p.created_at <= $${vals.length}`); }
  if (f.actor) { vals.push(`%${f.actor}%`); conds.push(`(p.approved_by ILIKE $${vals.length} OR p.authorized_by ILIKE $${vals.length} OR p.approver ILIKE $${vals.length} OR p.created_by_uuid ILIKE $${vals.length})`); }
  if (f.entityCode) { vals.push(`%${f.entityCode}%`); conds.push(`(w.work_order_no ILIKE $${vals.length} OR p.work_order_id ILIKE $${vals.length})`); }
  if (f.actionType && !/postpone/i.test(f.actionType)) { conds.push('1=0'); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const countRes = await pool.query(`SELECT count(*)::int n FROM work_order_postponements p LEFT JOIN work_orders w ON w.wouuid = p.work_order_id ${where}`, vals);
  const rowsRes = await pool.query(
    `SELECT p.id, p.created_at, p.submitted_date, p.approved_date, p.status, p.approver, p.approved_by, p.authorized_by,
            p.created_by_uuid, p.original_due_date, p.new_due_date, p.postponement_reason, p.postponement_remarks,
            p.approval_remarks, p.work_order_id, w.work_order_no
     FROM work_order_postponements p LEFT JOIN work_orders w ON w.wouuid = p.work_order_id
     ${where} ORDER BY p.created_at DESC LIMIT ${take}`, vals);
  return { rows: rowsRes.rows.map(mapPostponementRow), total: Number(countRes.rows[0]?.n ?? 0) };
}

function sourcesFor(logType: LogType): Array<'audit_log' | 'running_hours' | 'postponements'> {
  switch (logType) {
    case 'work_orders':
    case 'components':
    case 'permissions': return ['audit_log'];
    case 'running_hours': return ['running_hours'];
    case 'postponements': return ['postponements'];
    case 'all':
    default: return ['audit_log', 'running_hours', 'postponements'];
  }
}

/**
 * Unified, paginated business audit trail.
 * Merge strategy: fetch top (offset+limit) newest per included source (with filters) + per-source
 * count → merge → sort by whenTs desc → slice [offset, offset+limit]. total = Σ per-source counts.
 */
export async function getAuditTrail(
  f: AuditFilters,
  page: { limit: number; offset: number },
): Promise<{ rows: AuditViewRow[]; total: number; limit: number; offset: number }> {
  const logType = f.logType || 'all';
  const take = page.offset + page.limit; // enough from each source to cover this page after merge
  const sources = sourcesFor(logType);

  const results = await Promise.all(sources.map((s) => {
    if (s === 'audit_log') return fetchAuditLog(f, take);
    if (s === 'running_hours') return fetchRunningHours(f, take);
    return fetchPostponements(f, take);
  }));

  const merged = results.flatMap((r) => r.rows).sort((a, b) => (a.whenTs < b.whenTs ? 1 : a.whenTs > b.whenTs ? -1 : 0));
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const rows = merged.slice(page.offset, page.offset + page.limit);
  return { rows, total, limit: page.limit, offset: page.offset };
}

/** All matching rows for export (capped). Returns {rows, capped}. */
export async function getAuditTrailForExport(f: AuditFilters, cap = 10000): Promise<{ rows: AuditViewRow[]; capped: boolean }> {
  const sources = sourcesFor(f.logType || 'all');
  const results = await Promise.all(sources.map((s) => {
    if (s === 'audit_log') return fetchAuditLog(f, cap);
    if (s === 'running_hours') return fetchRunningHours(f, cap);
    return fetchPostponements(f, cap);
  }));
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const merged = results.flatMap((r) => r.rows).sort((a, b) => (a.whenTs < b.whenTs ? 1 : a.whenTs > b.whenTs ? -1 : 0));
  return { rows: merged.slice(0, cap), capped: total > cap };
}
