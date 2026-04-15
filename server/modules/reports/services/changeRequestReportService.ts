import ExcelJS from 'exceljs';
import * as repo from '../repositories/reportRepository';

// ═══════════════════════════════════════════════════════════════
// CHANGE REQUESTS STATUS TRACKING - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getChangeRequestsStatusTracking(
  vesselId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  status: string | undefined,
  category: string | undefined,
) {
  const allVessels = await repo.getVessels();
  const vesselMap = new Map(allVessels.map(v => [v.id, v]));

  let allRequests: any[] = [];
  if (vesselId && vesselId !== 'all') {
    allRequests = await repo.getChangeRequests(vesselId);
  } else {
    for (const v of allVessels) {
      const vReqs = await repo.getChangeRequests(v.id);
      allRequests.push(...vReqs);
    }
  }

  if (status && status !== 'all') {
    allRequests = allRequests.filter(r => r.status === status);
  }
  if (category && category !== 'all') {
    allRequests = allRequests.filter(r => r.category === category);
  }
  if (startDate) {
    const start = new Date(startDate);
    allRequests = allRequests.filter(r => {
      const d = r.submittedAt ? new Date(r.submittedAt) : new Date(r.createdAt);
      return d >= start;
    });
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    allRequests = allRequests.filter(r => {
      const d = r.submittedAt ? new Date(r.submittedAt) : new Date(r.createdAt);
      return d <= end;
    });
  }

  allRequests.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  const byStatus: Record<string, number> = { draft: 0, submitted: 0, returned: 0, approved: 0, rejected: 0 };
  const byCategory: Record<string, number> = { components: 0, work_orders: 0, spares: 0, stores: 0 };
  let totalApprovalTime = 0;
  let approvalCount = 0;

  for (const r of allRequests) {
    if (byStatus[r.status] !== undefined) byStatus[r.status]++;
    if (byCategory[r.category] !== undefined) byCategory[r.category]++;
    if (r.status === 'approved' && r.submittedAt && r.reviewedAt) {
      const diff = new Date(r.reviewedAt).getTime() - new Date(r.submittedAt).getTime();
      if (diff > 0) {
        totalApprovalTime += diff / (1000 * 60 * 60);
        approvalCount++;
      }
    }
  }

  const enrichedRequests = await Promise.all(allRequests.map(async (r) => {
    const vessel = vesselMap.get(r.vesselId);
    let targetName = '';
    try {
      if (r.targetType && r.targetId) {
        switch (r.targetType) {
          case 'component': {
            const comp = await repo.getComponent(r.targetId);
            targetName = comp?.name || comp?.componentCode || r.targetId;
            break;
          }
          case 'job': {
            const job = await repo.getJob(r.targetId);
            targetName = job?.jobTitle || (job as any)?.jobCode || r.targetId;
            break;
          }
          case 'work_order': {
            const wo = await repo.getWorkOrder(r.targetId);
            targetName = wo?.jobTitle || wo?.workOrderNo || r.targetId;
            break;
          }
          case 'spare': {
            const spare = await repo.getSpare(r.targetId);
            targetName = spare?.partName || spare?.partCode || r.targetId;
            break;
          }
          case 'store': {
            const store = await repo.getStoresItem(r.targetId);
            targetName = store?.itemName || store?.itemCode || r.targetId;
            break;
          }
        }
      }
    } catch { targetName = r.targetId || ''; }

    let fieldChanges: any[] = [];
    let changesCount = 0;
    if (r.proposedChangesJson) {
      const changes = Array.isArray(r.proposedChangesJson) ? r.proposedChangesJson : [];
      changesCount = changes.length;
      fieldChanges = changes.map((c: any) => ({
        fieldPath: c.fieldPath || c.columnName || c.field || '',
        oldValue: c.oldValue ?? c.currentValue ?? null,
        newValue: c.newValue ?? c.proposedValue ?? null,
        fieldLabel: c.displayName || c.fieldLabel || c.fieldPath || c.columnName || c.field || ''
      }));
    }

    let cycleTimeHours: number | null = null;
    if (r.submittedAt && r.reviewedAt) {
      const diff = new Date(r.reviewedAt).getTime() - new Date(r.submittedAt).getTime();
      if (diff > 0) cycleTimeHours = Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
    }

    return {
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      requestedBy: {
        userId: r.requestedByUserId,
        name: r.requestedByUserId || 'Unknown',
        rank: ''
      },
      reviewedBy: r.reviewedByUserId ? {
        userId: r.reviewedByUserId,
        name: r.reviewedByUserId || 'Unknown',
        rank: ''
      } : null,
      vessel: {
        id: r.vesselId,
        name: vessel?.name || r.vesselId
      },
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
      reason: r.reason,
      targetInfo: {
        type: r.targetType || '',
        id: r.targetId || '',
        name: targetName
      },
      changesCount,
      fieldChanges,
      cycleTimeHours,
      revisionNumber: r.revisionNumber || 0
    };
  }));

  return {
    summary: {
      totalRequests: allRequests.length,
      byStatus,
      byCategory,
      avgApprovalTimeHours: approvalCount > 0 ? Math.round((totalApprovalTime / approvalCount) * 10) / 10 : 0,
      pendingRequests: byStatus.submitted + byStatus.returned
    },
    requests: enrichedRequests
  };
}

// ═══════════════════════════════════════════════════════════════
// CHANGE REQUESTS STATUS TRACKING - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportChangeRequestsExcel(
  vesselId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  status: string | undefined,
  category: string | undefined,
  componentFilter?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const reportData = await getChangeRequestsStatusTracking(vesselId, startDate, endDate, status, category);

  if (componentFilter && componentFilter.trim()) {
    const cf = componentFilter.toLowerCase();
    reportData.requests = reportData.requests.filter((r: any) => {
      const target = (r.targetInfo?.name || '').toLowerCase();
      return target.includes(cf);
    });
    const filtered = reportData.requests;
    const byStatus: Record<string, number> = { draft: 0, submitted: 0, returned: 0, approved: 0, rejected: 0 };
    const byCategory: Record<string, number> = { components: 0, work_orders: 0, spares: 0, stores: 0 };
    let pendingRequests = 0;
    let totalCycleHours = 0;
    let cycleCount = 0;
    for (const r of filtered) {
      const st = (r.status || '').toLowerCase();
      if (byStatus[st] !== undefined) byStatus[st]++;
      if (st === 'submitted' || st === 'returned') pendingRequests++;
      const cat = r.targetInfo?.type || '';
      if (byCategory[cat] !== undefined) byCategory[cat]++;
      if (r.cycleTimeHours && r.cycleTimeHours > 0) { totalCycleHours += r.cycleTimeHours; cycleCount++; }
    }
    reportData.summary = {
      totalRequests: filtered.length,
      byStatus,
      byCategory,
      pendingRequests,
      avgApprovalTimeHours: cycleCount > 0 ? Math.round(totalCycleHours / cycleCount) : 0,
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PMS Report Generator';
  wb.created = new Date();

  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const subHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
  const summaryLabelFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    right: { style: 'thin', color: { argb: 'FFD0D5DD' } }
  };

  const catNames: Record<string, string> = { components: 'Components', work_orders: 'Work Orders', spares: 'Spares', stores: 'Stores' };
  const statusNames: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', returned: 'Returned', approved: 'Approved', rejected: 'Rejected' };

  const allVessels = await repo.getVessels();
  const resolvedVesselName = vesselId && vesselId !== 'all'
    ? allVessels.find(v => v.id === vesselId)?.name || vesselId
    : 'All Vessels';

  const ws = wb.addWorksheet('CR Status & Tracking');
  const totalColumns = 14;

  const s = reportData.summary;
  const totalReqs = s.totalRequests;
  const approvedPct = totalReqs > 0 ? Math.round((s.byStatus.approved / totalReqs) * 100) : 0;
  const rejectedPct = totalReqs > 0 ? Math.round((s.byStatus.rejected / totalReqs) * 100) : 0;

  const titleRow = ws.addRow(['Change Requests Status & Tracking']);
  ws.mergeCells(1, 1, 1, totalColumns);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E5A8E' } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  const subtitleRow = ws.addRow([`Vessel: ${resolvedVesselName} | Generated: ${new Date().toLocaleDateString()} | Total Requests: ${totalReqs}`]);
  ws.mergeCells(2, 1, 2, totalColumns);
  subtitleRow.getCell(1).font = { size: 10, italic: true };
  subtitleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  const summaryItems = [
    { label: 'Total Requests', value: s.totalRequests },
    { label: `Approved (${approvedPct}%)`, value: s.byStatus.approved },
    { label: `Rejected (${rejectedPct}%)`, value: s.byStatus.rejected },
    { label: 'Pending Review', value: s.pendingRequests },
    { label: 'Avg Approval Time (hrs)', value: s.avgApprovalTimeHours },
    { label: 'Components', value: s.byCategory.components },
    { label: 'Work Orders', value: s.byCategory.work_orders },
    { label: 'Spares', value: s.byCategory.spares },
    { label: 'Stores', value: s.byCategory.stores }
  ];

  const summaryHeaderRow = ws.addRow(['Summary']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, totalColumns);
  summaryHeaderRow.getCell(1).font = { bold: true, size: 11 };
  summaryHeaderRow.getCell(1).fill = headerFill;
  summaryHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };

  summaryItems.forEach((item) => {
    const r = ws.addRow([item.label, item.value]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(1).fill = summaryLabelFill;
    r.getCell(1).border = borderStyle;
    r.getCell(2).border = borderStyle;
    r.getCell(2).alignment = { horizontal: 'center' };
  });

  ws.addRow([]);

  const colHeaders = ['S.No', 'ID', 'Title', 'Category', 'Status', 'Requested By', 'Vessel', 'Submitted', 'Reviewed By', 'Reviewed At', 'Cycle Time (hrs)', 'Target', 'Changes', 'Reason'];
  const colWidths = [6, 10, 40, 18, 16, 20, 18, 18, 20, 18, 16, 28, 12, 30];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const tableHeaderRow = ws.addRow(colHeaders);
  tableHeaderRow.eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderStyle;
    cell.alignment = { horizontal: 'center' };
  });

  const headerRowNum = ws.rowCount;
  ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: totalColumns } };
  ws.views = [{ state: 'frozen', ySplit: headerRowNum, xSplit: 0 }];

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    const dt = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dt.getDate().toString().padStart(2,'0')} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };
  (reportData.requests || []).forEach((req: any, i: number) => {
    const r = ws.addRow([
      i + 1,
      req.id,
      req.title,
      catNames[req.category] || req.category,
      statusNames[req.status] || req.status,
      req.requestedBy?.name || '-',
      req.vessel?.name || '-',
      fmtDate(req.submittedAt || req.createdAt),
      req.reviewedBy?.name || '-',
      fmtDate(req.reviewedAt),
      req.cycleTimeHours ?? '-',
      req.targetInfo?.name ? `${catNames[req.targetInfo.type] || req.targetInfo.type} - ${req.targetInfo.name}` : '-',
      req.changesCount,
      req.reason || '-'
    ]);
    r.eachCell(cell => { cell.border = borderStyle; });
    if (i % 2 === 1) r.eachCell(cell => { cell.fill = subHeaderFill; });
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Change_Requests_Status_Tracking_${resolvedVesselName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
