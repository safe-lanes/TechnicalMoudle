import ExcelJS from 'exceljs';
import { sql } from 'drizzle-orm';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { WorkOrderPageQuery } from '@shared/workOrdersPagination';
import { getDisplayStatus } from '@shared/utils/workOrderFilters';
import { withWorkOrderReadSnapshot, hydrateWorkOrderPageRow, workOrderOrdering } from '../repositories/workOrderPagingRepository';
import { workOrderScopePredicate, type WorkOrderReadScope } from '../repositories/workOrderPagingScope';
// Reuse existing pure report builders rather than introducing a second format.
// Their browser download methods are not called by server-side exports.
import { buildComponentJobsWorkbook } from '../../../../client/src/pages/pms/componentJobsExport';
import { PDFReportGenerator } from '../../../../client/src/lib/pdfReportGenerator';
import { formatProfessionalDate, parseDate } from '../../../../client/src/lib/dateUtils';
import { getTableColumns } from 'drizzle-orm';
import { jobs, components, vessels } from '@shared/schema';

export interface WorkOrderExportFile {
  directory: string; filePath: string; rowCount: number; issues: string[];
}
export type WorkOrderExportKind = 'wo-excel' | 'wo-pdf' | 'component-jobs';
const camelRecord = (row: any, table: any) => Object.fromEntries(
  Object.entries(getTableColumns(table)).map(([key, column]) => [key, row[(column as any).name]]),
);
const widths = [6, 30, 35, 40, 18, 14, 14, 12, 16, 14, 50, 40, 18, 25];

export async function createWorkOrderExport(
  scope: WorkOrderReadScope, query: WorkOrderPageQuery, kind: WorkOrderExportKind,
  display: { vesselName: string; generatedAtLabel: string; timeZone?: string; locale?: string },
  signal?: AbortSignal,
): Promise<WorkOrderExportFile> {
  const directory = await mkdtemp(path.join(tmpdir(), 'wo-export-'));
  const filePath = path.join(directory, kind === 'wo-pdf' ? 'report.pdf' : 'report.xlsx');
  let outputStream: { destroy: () => void } | undefined;
  const checkAbort = () => { if (signal?.aborted) throw new Error('Export request was cancelled'); };
  const displayDate = (value: string) => {
    // Date-only formats describe a calendar day. Timestamp formats describe an
    // instant and must retain the initiating browser's timezone.
    if (/^\d{4}-\d{2}-\d{2}[T ]|:\d{2}/.test(value)) {
      const parsed = parseDate(value);
      if (parsed) return new Intl.DateTimeFormat('en-GB', {
        timeZone: display.timeZone ?? 'UTC', day: '2-digit', month: 'short', year: 'numeric',
      }).format(parsed).split(' ').join('-');
    }
    return formatProfessionalDate(value);
  };
  try {
    return await withWorkOrderReadSnapshot(scope, query, async ({ tx, projection, where, reference, ranks }) => {
      let rowCount = 0;
      const issues: string[] = [];
      checkAbort();
      if (kind === 'component-jobs') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: true });
        outputStream = (workbook as any).stream;
        let sheet: ExcelJS.Worksheet | undefined;
        const compositeKeys = new Set<string>();
        const vesselRows = (await tx.execute(sql`SELECT * FROM vessels`)).rows.map(row => camelRecord(row, vessels));
        const rankRows = (await tx.execute(sql`SELECT * FROM adm_available_ranks WHERE is_deleted=false ORDER BY sort_order`)).rows;
        // Builder expects camel rank labels. name/label have no underscore.
        for (let offset = 0; ; offset += 200) {
          checkAbort();
          const batch = await tx.execute(sql`SELECT w.* FROM jobs w WHERE w.data_scope='vessel'
            AND w.is_deleted IS DISTINCT FROM TRUE AND ${workOrderScopePredicate(scope)}
            ORDER BY w.job_no,w.juuid LIMIT 200 OFFSET ${offset}`);
          const jobRows = batch.rows.map(row => camelRecord(row, jobs));
          // Fetch only components that may be resolved by this batch.
          const keys = jobRows.map(job => sql`(w.vessel_id=${job.vesselId} AND
            (w.cuuid=${job.componentId ?? ''} OR w.id=${job.componentId ?? ''} OR w.component_code=${job.componentCode ?? ''}
              OR w.component_code IN (SELECT component_code FROM job_component_links
                WHERE job_id=${job.juuid} AND vessel_id=${job.vesselId})))`);
          const componentRows = keys.length ? (await tx.execute(sql`SELECT w.* FROM components w
            WHERE w.data_scope='vessel' AND w.is_deleted IS DISTINCT FROM TRUE
            AND (${sql.join(keys, sql` OR `)}) ORDER BY w.cuuid`)).rows.map(row => camelRecord(row, components)) : [];
          // Existing Jobs JSON includes linkedComponentCodes via storage. Resolve
          // that lightweight association per batch, never by downloading all Jobs.
          if (jobRows.length) {
            const links = await tx.execute(sql`SELECT job_id,vessel_id,component_code FROM job_component_links
              WHERE job_id IN (${sql.join(jobRows.map(job => sql`${job.juuid}`), sql`,`)})
              ORDER BY id`);
            for (const job of jobRows) {
              job.linkedComponentCodes = links.rows.filter(link => link.job_id === job.juuid && link.vessel_id === job.vesselId).map(link => link.component_code);
              if (job.componentCode && !job.linkedComponentCodes.includes(job.componentCode))
                job.linkedComponentCodes.push(job.componentCode);
            }
          }
          const built = buildComponentJobsWorkbook(jobRows, componentRows, vesselRows, rankRows, {
            workbook: workbook as unknown as ExcelJS.Workbook, sheet,
            rowOffset: rowCount, compositeKeys, commitRows: true,
          });
          sheet = built.sheet;
          issues.push(...built.issues); rowCount += jobRows.length;
          if (batch.rows.length < 200) break;
        }
        await workbook.commit();
      } else {
        const postponed = query.status === 'Postponed';
        const limitedScope = postponed || query.status === 'Unplanned';
        // Preserve the old scope and lack of chosen grid sort in exports.
        const exportWhere = limitedScope ? where : sql`TRUE`;
        const order = workOrderOrdering({ ...query, sortBy: undefined });
        const workbook = kind === 'wo-excel'
          ? new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: false }) : null;
        if (workbook) outputStream = (workbook as any).stream;
        const sheet = workbook?.addWorksheet(postponed ? 'Postponed Work Orders' : 'All Work Orders');
        if (sheet) sheet.columns = widths.slice(0, postponed ? 14 : 12).map(width => ({ width }));
        const pdfRows: any[] = [];
        for (let offset = 0; ; offset += 200) {
          checkAbort();
          const batch = await tx.execute(sql`${projection} SELECT * FROM projection
            WHERE ${exportWhere} ORDER BY ${order} LIMIT 200 OFFSET ${offset}`);
          for (const source of batch.rows) {
            const wo = hydrateWorkOrderPageRow(source, reference, ranks);
            const cells: Record<string, any> = {
              'S.No': ++rowCount, Component: wo.component || '-',
              'Work Order No': wo.workOrderNo || wo.templateCode || '-', 'Job Title': wo.jobTitle || '-',
              'Assigned To': wo.assignedTo || '-',
              'Due Date': wo.maintenanceBasis === 'Running Hours'
                ? (wo.nextDueHour != null && Number.isFinite(wo.nextDueHour)
                  ? `${wo.nextDueHour.toLocaleString(display.locale)} RH` : '-')
                : (wo.dueDate ? displayDate(wo.dueDate) : '-'),
              Status: getDisplayStatus(wo), Criticality: wo.criticality || '-',
              'Maintenance Basis': wo.maintenanceBasis || '-',
              Frequency: wo.frequencyValue ? `${wo.frequencyValue} ${wo.frequencyUnit || ''}`.trim() : '-',
              'Postponement Reason': wo.postponementReason || '-', 'Postponement Remarks': wo.postponementRemarks || '-',
              ...(postponed ? {
                'Postpone Until': wo.postponementEndDate ? displayDate(wo.postponementEndDate) : '-',
                'Authorized By': wo.postponementAuthorizedBy || '-',
              } : {}),
            };
            if (sheet) {
              if (rowCount === 1) sheet.addRow(Object.keys(cells)).commit();
              sheet.addRow(Object.values(cells)).commit();
            } else {
              // jsPDF needs the printable table cells, not hydrated source rows.
              pdfRows.push(cells);
            }
          }
          if (batch.rows.length < 200) break;
        }
        if (workbook) await workbook.commit();
        else {
          checkAbort();
          const fields = postponed
            ? ['S.No', 'Component', 'Work Order No', 'Job Title', 'Assigned To', 'Due Date', 'Postpone Until', 'Postponement Reason', 'Postponement Remarks', 'Authorized By', 'Status']
            : ['S.No', 'Component', 'Work Order No', 'Job Title', 'Assigned To', 'Due Date', 'Status', 'Criticality', 'Postponement Reason', 'Postponement Remarks'];
          const bytes = new PDFReportGenerator().generateReportBytes({
            title: postponed ? 'Postponed Work Orders' : 'All Work Orders',
            subtitle: postponed ? 'Work orders currently postponed' : 'Complete work order listing',
            vessel: display.vesselName, orientation: 'landscape', generatedAtLabel: display.generatedAtLabel,
          }, fields.map(field => ({ header: field, field })), pdfRows);
          await writeFile(filePath, bytes);
        }
      }
      checkAbort();
      return { directory, filePath, rowCount, issues };
    });
  } catch (error) {
    outputStream?.destroy();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
