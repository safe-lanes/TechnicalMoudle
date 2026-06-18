/**
 * Audit Trail Excel export (Phase 3) — READ-ONLY.
 * One row per audit record; flattened "Changes" cell; UTC header. Mirrors the reports ExcelJS pattern.
 */
import ExcelJS from 'exceljs';
import type { AuditViewRow } from './service';

const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

const COLUMNS: Array<{ header: string; key: keyof AuditViewRow | 'whenLabel'; width: number }> = [
  { header: 'When (UTC)', key: 'whenLabel', width: 22 },
  { header: 'Who', key: 'who', width: 26 },
  { header: 'Actor Type', key: 'whoType', width: 12 },
  { header: 'Action', key: 'action', width: 22 },
  { header: 'Entity', key: 'entityType', width: 18 },
  { header: 'Entity Ref', key: 'entityRef', width: 24 },
  { header: 'Old Value', key: 'oldValue', width: 22 },
  { header: 'New Value', key: 'newValue', width: 22 },
  { header: 'Changes', key: 'changes', width: 50 },
  { header: 'Log Type', key: 'logType', width: 16 },
  { header: 'Remarks/Status', key: 'remarks', width: 30 },
];

export async function buildAuditTrailWorkbook(
  rows: AuditViewRow[],
  meta: { generatedAtUtc: string; filterSummary: string; capped: boolean },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Audit Trail');

  const title = ws.addRow(['SAIL PMS — Audit Trail']);
  title.font = { bold: true, size: 14 };
  ws.mergeCells(`A1:${String.fromCharCode(64 + COLUMNS.length)}1`);
  const sub = ws.addRow([`Generated (UTC): ${meta.generatedAtUtc} | ${meta.filterSummary} | Records: ${rows.length}${meta.capped ? ' (capped at 10,000 — refine filters)' : ''}`]);
  sub.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
  ws.mergeCells(`A2:${String.fromCharCode(64 + COLUMNS.length)}2`);
  ws.addRow([]);

  const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
  headerRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  for (const r of rows) {
    ws.addRow(COLUMNS.map((c) => {
      if (c.key === 'whenLabel') return r.when;
      const v = (r as any)[c.key];
      return v === null || v === undefined ? '' : String(v);
    }));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
