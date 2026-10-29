import { and, asc, desc, eq, getTableColumns, inArray, lt, gte, sql, type SQL } from 'drizzle-orm';
import { defects, type Defect } from '@shared/schema';
import { ACTIVE_STATUSES } from '@shared/defectStatus';
import { getDb } from '../../../db';
import type { LogMatchOptions } from './compatibility';

export interface DefectLogRead {
  page: number;
  pageSize: number;
  vesselId?: string;
  vesselIds?: string[];
  match: LogMatchOptions;
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
  const needsMatch = (input.match.selectedVessel && input.match.selectedVessel !== 'all')
    || input.match.selectedVesselNames?.length || input.match.search?.trim()
    || input.match.periodValue || (input.match.dueOverdue && input.match.dueOverdue !== 'all');
  if (!needsMatch) return and(...conditions)!;
  // Only scalar status/search inputs cross into V8. Full JSON actions,
  // attachments, extensions, etc. are selected only AFTER bounded page selection.
  const searchFields = input.match.search?.trim() ? sql`
    'id', ${defects.id}, 'category', ${defects.category}, 'is_coc', ${defects.is_coc},
    'componentHardwareLevel3', ${defects.componentHardwareLevel3}, 'description', ${defects.description},
    'dateCompleted', ${defects.dateCompleted}, 'verified', ${defects.verified},
    'isDeferred', ${defects.isDeferred}, 'priority', ${defects.priority},
    'hasActions', CASE WHEN json_typeof(${defects.actions}) = 'array'
      THEN json_array_length(${defects.actions}) > 0 ELSE false END,
  ` : sql``;
  conditions.push(sql`public.defect_log_matches_v1(jsonb_build_object(
    ${searchFields}
    'vesselId', ${defects.vesselId}, 'vesselName', ${defects.vesselName},
    'issueDate', ${defects.issueDate}, 'targetCloseDate', ${defects.targetCloseDate}
  ), ${JSON.stringify(input.match)}::jsonb)`);
  return and(...conditions)!;
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
  const db = await getDb();
  return db.transaction(async tx => {
    const where = logEligibility(input);
    const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(defects).where(where);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const order = [desc(defects.issueDate), asc(defects.duuid)];
    const read = (offset: number, limit: number) => {
      const selected = tx.select({ duuid: defects.duuid }).from(defects)
        .where(where).orderBy(...order).limit(limit).offset(offset).as('defect_log_page');
      return tx.select(getTableColumns(defects)).from(defects)
        .innerJoin(selected, eq(defects.duuid, selected.duuid)).orderBy(...order);
    };
    if (!exporting) {
      const rows = await read((page - 1) * input.pageSize, input.pageSize);
      return { items: rows.map(firstActionDescription), total, page, pageSize: input.pageSize, totalPages };
    }
    // Explicit export only. Every batch shares one snapshot; respond only after
    // all reads succeed so a failed batch never produces a partial export.
    const items: Defect[] = [];
    for (let offset = 0; offset < total; offset += 500) {
      items.push(...(await read(offset, 500)).map(firstActionDescription));
    }
    return { items, total, page: 1, pageSize: input.pageSize, totalPages };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
