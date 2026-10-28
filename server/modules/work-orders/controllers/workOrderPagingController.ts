import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { workOrderPageQuery } from '@shared/workOrdersPagination';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import { resolveWorkOrderReadScope } from '../repositories/workOrderPagingScope';
import { queryWorkOrderPage } from '../repositories/workOrderPagingRepository';
import { readComponentJobsAvailability, readWorkOrderQueue } from '../services/workOrderPagingReadService';
import { createWorkOrderExport, type WorkOrderExportFile } from '../services/workOrderPagingExportService';

const displayInput = z.object({
  kind: z.enum(['wo-excel', 'wo-pdf', 'component-jobs']),
  vesselName: z.string().max(300),
  filename: z.string().min(1).max(500).refine(value => !/[\/\\\r\n\u0000]/.test(value), 'Invalid export filename'),
  generatedAtLabel: z.string().max(100),
  timeZone: z.string().max(100).default('UTC'),
  locale: z.string().max(100).default('en-US'),
}).superRefine((value, ctx) => {
  try { new Intl.DateTimeFormat(value.locale, { timeZone: value.timeZone }); }
  catch { ctx.addIssue({ code: 'custom', message: 'Invalid export timezone or locale' }); }
});
interface Download extends WorkOrderExportFile {
  owner: string; scope: string; filename: string; timer: ReturnType<typeof setTimeout>;
}
const downloads = new Map<string, Download>();
const scopeKey = (ids: readonly string[] | null) => ids === null ? '*' : [...ids].sort().join('\n');
const owner = (req: AuthenticatedRequest) =>
  `${getCurrentTenantContext()?.tuid ?? 'legacy'}|${req.user?.userUuid ?? ''}|${req.rbac?.userType ?? ''}|${req.rbac?.role ?? ''}`;

async function discard(token: string) {
  const entry = downloads.get(token);
  if (!entry) return;
  downloads.delete(token);
  clearTimeout(entry.timer);
  await rm(entry.directory, { recursive: true, force: true });
}
export const validateWorkOrderRead = (
  action: (req: Request, res: Response) => Promise<unknown>,
) => async (req: Request, res: Response) => {
  try { return await action(req, res); }
  catch (error: any) {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid Work Order query', details: error.issues });
    if (error.statusCode >= 400 && error.statusCode < 500)
      return res.status(error.statusCode).json({ error: error.message });
    throw error;
  }
};
async function queryContext(req: Request) {
  const q = workOrderPageQuery.parse(req.query);
  const scope = await resolveWorkOrderReadScope(req as AuthenticatedRequest, q);
  return { q, scope };
}
export const page = validateWorkOrderRead(async (req, res) => {
  const { q, scope } = await queryContext(req);
  return res.json({ success: true, data: await queryWorkOrderPage(scope, q) });
});
export const queue = validateWorkOrderRead(async (req, res) => {
  const { q, scope } = await queryContext(req);
  return res.json({ success: true, data: await readWorkOrderQueue(scope, q) });
});
export const componentJobsAvailability = validateWorkOrderRead(async (req, res) => {
  const { scope } = await queryContext(req);
  return res.json({ success: true, data: await readComponentJobsAvailability(scope) });
});
export const exportFile = validateWorkOrderRead(async (req, res) => {
  const { q, scope } = await queryContext(req);
  const display = displayInput.parse(req.body);
  const abort = new AbortController();
  const onClose = () => { if (!res.writableFinished) abort.abort(); };
  res.once('close', onClose);
  let file: WorkOrderExportFile | undefined;
  try {
    file = await createWorkOrderExport(scope, q, display.kind, display, abort.signal);
    if (abort.signal.aborted) {
      await rm(file.directory, { recursive: true, force: true });
      return;
    }
    const token = randomUUID();
    const timer = setTimeout(() => { void discard(token); }, 5 * 60_000);
    timer.unref();
    downloads.set(token, { ...file, owner: owner(req as AuthenticatedRequest), scope: scopeKey(scope.vesselIds), filename: display.filename, timer });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: { token, filename: display.filename, rowCount: file.rowCount, issues: file.issues } });
  } catch (error) {
    if (file) await rm(file.directory, { recursive: true, force: true });
    throw error;
  } finally { res.off('close', onClose); }
});
export const downloadFile = validateWorkOrderRead(async (req, res) => {
  const { scope } = await queryContext(req);
  const token = z.string().uuid().parse(req.params.token);
  const entry = downloads.get(token);
  if (!entry || entry.owner !== owner(req as AuthenticatedRequest) || entry.scope !== scopeKey(scope.vesselIds))
    return res.status(404).json({ error: 'Export is unavailable or expired. Generate it again.' });
  res.setHeader('Cache-Control', 'no-store');
  res.once('close', () => { void discard(token); });
  res.download(entry.filePath, entry.filename, error => {
    void discard(token);
    if (error && !res.headersSent && !res.destroyed) res.status(500).json({ error: 'Export download failed' });
  });
});
