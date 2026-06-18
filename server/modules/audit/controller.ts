/**
 * Audit Trail Viewer controller (Phase 3) — READ-ONLY.
 */
import { Request, Response } from 'express';
import * as service from './service';
import { buildAuditTrailWorkbook } from './excel';
import type { AuditFilters, LogType } from './service';

const VALID_LOG_TYPES: LogType[] = ['all', 'work_orders', 'components', 'running_hours', 'permissions', 'postponements'];

function parseFilters(src: any): AuditFilters {
  const logType = VALID_LOG_TYPES.includes(src.logType) ? src.logType as LogType : 'all';
  const parseDate = (v: any): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const str = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return {
    logType,
    startDate: parseDate(src.startDate),
    endDate: parseDate(src.endDate),
    actor: str(src.actor),
    entityCode: str(src.entityCode),
    actionType: str(src.actionType),
  };
}

function filterSummary(f: AuditFilters): string {
  const parts: string[] = [`Log type: ${f.logType}`];
  if (f.startDate) parts.push(`From: ${f.startDate.toISOString().slice(0, 10)}`);
  if (f.endDate) parts.push(`To: ${f.endDate.toISOString().slice(0, 10)}`);
  if (f.actor) parts.push(`Actor: ${f.actor}`);
  if (f.entityCode) parts.push(`Entity: ${f.entityCode}`);
  if (f.actionType) parts.push(`Action: ${f.actionType}`);
  return parts.join(' | ');
}

export async function getAuditTrail(req: Request, res: Response) {
  try {
    const f = parseFilters(req.query);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const result = await service.getAuditTrail(f, { limit, offset });
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail', details: error.message });
  }
}

export async function exportAuditTrailExcel(req: Request, res: Response) {
  try {
    const f = parseFilters({ ...req.query, ...req.body });
    const { rows, capped } = await service.getAuditTrailForExport(f, 10000);
    const buffer = await buildAuditTrailWorkbook(rows, {
      generatedAtUtc: new Date().toISOString().replace('T', ' ').slice(0, 19),
      filterSummary: filterSummary(f),
      capped,
    });
    const filename = `audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting audit trail:', error);
    res.status(500).json({ error: 'Failed to export audit trail', details: error.message });
  }
}
