import { and, or, asc, desc, eq, getTableColumns, inArray, lt, gt, gte, isNull, isNotNull, sql, type SQL } from 'drizzle-orm';
import { defects, type Defect } from '@shared/schema';
import { ACTIVE_STATUSES } from '@shared/defectStatus';
import { getDb } from '../../../db';
import { createDefectLogMatcher, type LogMatchOptions } from './compatibility';

// Bounded scalar scans are explicitly approved instead of a database JS engine.
export const DEFECT_LOG_BATCH_SIZE = 500;

export interface DefectLogRead {
  page: number;
  pageSize: number;
  vesselId?: string;
  vesselIds?: string[];
  match: LogMatchOptions;
  signal?: AbortSignal;
}

export function logEligibility(input: DefectLogRead): SQL {
  const conditions: SQL[] = [inArray(defects.status, ACTIVE_STATUSES)];
  if (input.vesselId && input.vesselId !== 'all') {
    conditions.push(eq(defects.vesselId, input.vesselId));
  } else if (input.vesselIds?.length) {
    conditions.push(inArray(defects.vesselId, input.vesselIds));
  }
  // Preserve the old backend predicate in addition to the browser predicate.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const backendDay = today.toISOString().split('T')[0];
  if (input.match.dueOverdue === 'overdue') {
    conditions.push(lt(defects.targetCloseDate, backendDay));
    conditions.push(sql`(${defects.verified} IS NULL OR ${defects.verified} = false)`);
    conditions.push(sql`(${defects.dateCompleted} IS NULL OR ${defects.dateCompleted} = '')`);
  } else if (input.match.dueOverdue === 'due') {
    conditions.push(gte(defects.targetCloseDate, backendDay));
  }
  return and(...conditions)!;
}

export function needsLogMatching(input: DefectLogRead): boolean {
  return Boolean((input.match.selectedVessel && input.match.selectedVessel !== 'all')
    || input.match.selectedVesselNames?.length || input.match.search?.trim()
    || input.match.periodValue || (input.match.dueOverdue && input.match.dueOverdue !== 'all'));
}

/** No action/attachment arrays or full candidate records cross the scan boundary. */
export function logScanFields(input: DefectLogRead) {
  return {
    duuid: defects.duuid,
    vesselId: defects.vesselId, vesselName: defects.vesselName,
    issueDate: defects.issueDate, targetCloseDate: defects.targetCloseDate,
    ...(input.match.search?.trim() ? {
      id: defects.id, category: defects.category, is_coc: defects.is_coc,
      componentHardwareLevel3: defects.componentHardwareLevel3, description: defects.description,
      dateCompleted: defects.dateCompleted, verified: defects.verified,
      isDeferred: defects.isDeferred, priority: defects.priority,
      hasActions: sql<boolean>`CASE WHEN json_typeof(${defects.actions}) = 'array'
        THEN json_array_length(${defects.actions}) > 0 ELSE false END`,
    } : {}),
  };
}

type Cursor = { duuid: string; issueDate: string | null };

/** DESC has NULLS FIRST; compare the unique ID inside each raw issue-date tie. */
export function afterLogCursor(cursor?: Cursor): SQL | undefined {
  if (!cursor) return undefined;
  return cursor.issueDate === null
    ? or(and(isNull(defects.issueDate), gt(defects.duuid, cursor.duuid)), isNotNull(defects.issueDate))
    : or(lt(defects.issueDate, cursor.issueDate),
      and(eq(defects.issueDate, cursor.issueDate), gt(defects.duuid, cursor.duuid)));
}

export function firstActionDescription(row: Defect): Defect {
  return {
    ...row,
    actionTakenRequested: row.actions && row.actions.length > 0 && row.actions[0].actionDescription
      ? row.actions[0].actionDescription : row.actionTakenRequested || '',
  };
}

/** Explicit opt-in path; the existing storage.getDefects contract is untouched. */
export async function readDefectLog(input: DefectLogRead, exporting = false) {
  if (!Number.isInteger(input.page) || input.page < 1 ||
    !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
    throw new RangeError('Invalid Defect Log page bounds');
  }
  input.signal?.throwIfAborted();
  const db = await getDb();
  return db.transaction(async tx => {
    const where = logEligibility(input);
    const order = [desc(defects.issueDate), asc(defects.duuid)];
    const detail = (ids: string[]) => tx.select(getTableColumns(defects)).from(defects)
      .where(and(where, inArray(defects.duuid, ids))).orderBy(...order).limit(ids.length);
    const matching = needsLogMatching(input);

    // Common unfiltered navigation keeps the native count + bounded SQL page.
    if (!matching && !exporting) {
      const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(defects).where(where);
      input.signal?.throwIfAborted();
      const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
      const page = Math.min(input.page, totalPages);
      const selected = tx.select({ duuid: defects.duuid }).from(defects)
        .where(where).orderBy(...order).limit(input.pageSize).offset((page - 1) * input.pageSize).as('defect_log_page');
      const rows = await tx.select(getTableColumns(defects)).from(defects)
        .innerJoin(selected, eq(defects.duuid, selected.duuid)).orderBy(...order);
      input.signal?.throwIfAborted();
      return { items: rows.map(firstActionDescription), total, page, pageSize: input.pageSize, totalPages };
    }

    const matches = createDefectLogMatcher(input.match);
    let total = 0;
    let cursor: Cursor | undefined;
    const pageIds: string[] = [];
    let lastPageIds: string[] = [];
    let exportIds: string[] = [];
    // Only explicit export accumulates full results, as required by browser files.
    const items: Defect[] = [];
    const flushExport = async () => {
      input.signal?.throwIfAborted();
      if (exportIds.length) items.push(...(await detail(exportIds)).map(firstActionDescription));
      exportIds = [];
    };
    for (;;) {
      input.signal?.throwIfAborted();
      const batch = await tx.select(logScanFields(input)).from(defects)
        .where(and(where, afterLogCursor(cursor))).orderBy(...order).limit(DEFECT_LOG_BATCH_SIZE);
      input.signal?.throwIfAborted();
      for (const row of batch) {
        if (matching && !matches(row)) continue;
        if (exporting) {
          exportIds.push(row.duuid);
          if (exportIds.length === DEFECT_LOG_BATCH_SIZE) await flushExport();
        } else {
          if (total % input.pageSize === 0) lastPageIds = [];
          lastPageIds.push(row.duuid);
          if (Math.floor(total / input.pageSize) + 1 === input.page) pageIds.push(row.duuid);
        }
        total++;
      }
      if (batch.length < DEFECT_LOG_BATCH_SIZE) break;
      cursor = batch[batch.length - 1];
    }
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, totalPages);
    if (exporting) {
      await flushExport();
      input.signal?.throwIfAborted();
      return { items, total, page: 1, pageSize: input.pageSize, totalPages };
    }
    input.signal?.throwIfAborted();
    const selectedIds = input.page > totalPages ? lastPageIds : pageIds;
    const rows = selectedIds.length ? await detail(selectedIds) : [];
    input.signal?.throwIfAborted();
    return { items: rows.map(firstActionDescription), total, page, pageSize: input.pageSize, totalPages };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
