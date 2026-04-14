import ExcelJS from 'exceljs';
import * as repo from '../repositories/reportRepository';
import {
  COLORS,
  applyStandardHeader,
  applyStandardTableHeader,
  applyStandardDataRows,
  applyStandardPageSetup,
  generateFilename,
  getLastColumnLetter,
  type ColumnDef,
  type ConditionalStyle,
} from '../../../lib/excelReportStyles';

const CONFIDENCE_THRESHOLDS = {
  HIGH_DAYS: 90,
  MEDIUM_DAYS: 30,
  LOW_DAYS: 7,
};

// ═══════════════════════════════════════════════════════════════
// CRITICAL SPARES REPORT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCriticalSparesPreview(
  vesselId: string,
  stockStatusFilter: string[] | null,
  departmentFilter: string | undefined,
) {
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

  let sparesData: any[];
  let jobsData: any[];
  let componentsData: any[];
  let jobComponentLinks: any[];
  if (vesselId === 'all') {
    sparesData = []; jobsData = []; componentsData = []; jobComponentLinks = [];
    for (const v of allVessels) {
      sparesData = sparesData.concat(await repo.getSpares(v.id));
      jobsData = jobsData.concat(await repo.getJobs(v.id));
      componentsData = componentsData.concat(await repo.getComponents(v.id));
      jobComponentLinks = jobComponentLinks.concat(await repo.getJobComponentLinks(v.id));
    }
  } else {
    sparesData = await repo.getSpares(vesselId);
    jobsData = await repo.getJobs(vesselId);
    componentsData = await repo.getComponents(vesselId);
    jobComponentLinks = await repo.getJobComponentLinks(vesselId);
  }

  const componentMap = new Map(componentsData.map(c => [c.cuuid, c]));

  const getStockStatus = (rob: number | null | undefined, min: number | null | undefined): string => {
    const robVal = rob ?? 0;
    if (robVal === 0) return 'ZERO';
    if (min === null || min === undefined || min === 0) return 'NOT_SET';
    if (robVal < min) return 'LOW';
    return 'OK';
  };

  const getShortage = (rob: number | null | undefined, min: number | null | undefined): number => {
    const robVal = rob ?? 0;
    if (min === null || min === undefined || min === 0) return 0;
    return Math.max(0, min - robVal);
  };

  const findRelatedJobs = (spare: any) => {
    const related: any[] = [];
    for (const job of jobsData) {
      let reqParts = job.requiredSpareParts;
      if (typeof reqParts === 'string') {
        try { reqParts = JSON.parse(reqParts); } catch { reqParts = []; }
      }
      if (!Array.isArray(reqParts)) continue;
      const match = reqParts.some((rp: any) =>
        (rp.partCode && spare.partCode && rp.partCode === spare.partCode) ||
        (rp.partName && spare.partName && rp.partName === spare.partName)
      );
      if (match) related.push(job);
    }
    return related;
  };

  const findCriticalComponents = (relatedJobs: any[]) => {
    const critComps: string[] = [];
    for (const job of relatedJobs) {
      const links = jobComponentLinks.filter(l => l.jobId === job.juuid);
      for (const link of links) {
        const comp = componentMap.get(link.componentId);
        if (comp && comp.critical === true) {
          const label = comp.name || comp.componentCode || comp.id;
          if (!critComps.includes(label)) critComps.push(label);
        }
      }
    }
    return critComps;
  };

  const getCriticality = (spare: any, relatedJobs: any[], criticalComponents: string[]): string => {
    if (criticalComponents.length > 0) return 'CRITICAL';
    const robVal = spare.rob ?? 0;
    const minVal = spare.min ?? 0;
    if (robVal === 0 || (minVal > 0 && robVal < minVal)) return 'ESSENTIAL';
    return 'NORMAL';
  };

  const getRemarks = (stockStatus: string, criticalityLevel: string): string => {
    if (criticalityLevel === 'CRITICAL' && stockStatus === 'ZERO') {
      return 'CRITICAL - OUT OF STOCK - Immediate procurement required for critical equipment';
    }
    if (criticalityLevel === 'CRITICAL' && stockStatus === 'LOW') {
      return 'CRITICAL - LOW STOCK - Urgent replenishment needed for critical equipment';
    }
    if (criticalityLevel === 'CRITICAL') {
      return 'CRITICAL - Linked to critical equipment - monitor closely';
    }
    if (stockStatus === 'ZERO') {
      return 'OUT OF STOCK - Procurement required';
    }
    if (stockStatus === 'LOW') {
      return 'LOW STOCK - Replenishment recommended';
    }
    if (stockStatus === 'NOT_SET') {
      return 'Minimum stock level not configured';
    }
    return 'Stock level adequate';
  };

  const allRows = sparesData.map(spare => {
    const robVal = spare.rob ?? 0;
    const minVal = spare.min ?? null;
    const stockStatus = getStockStatus(robVal, minVal);
    const shortageQty = getShortage(robVal, minVal);
    const relatedJobs = findRelatedJobs(spare);
    const critComps = findCriticalComponents(relatedJobs);
    const criticalityLevel = getCriticality(spare, relatedJobs, critComps);
    const linkedToCritical = critComps.length > 0;

    const departments = new Set<string>();
    for (const job of relatedJobs) {
      if (job.department) departments.add(job.department);
    }
    for (const compName of critComps) {
      const comp = componentsData.find(c => (c.name || c.componentCode || c.id) === compName);
      if (comp?.department) departments.add(comp.department);
    }

    return {
      sNo: 0,
      vesselName,
      partCode: spare.partCode || '-',
      partName: spare.partName || '-',
      rob: robVal,
      minStock: spare.min != null ? minVal : null,
      stockStatus,
      shortageQty,
      criticalityLevel,
      linkedToCriticalEquipment: linkedToCritical,
      criticalComponents: critComps.join(', ') || '-',
      relatedJobs: relatedJobs.map(j => j.jobNo || j.jobTitle || j.id).join(', ') || '-',
      department: Array.from(departments).join(', ') || '-',
      remarks: getRemarks(stockStatus, criticalityLevel),
    };
  });

  let reportRows = allRows.filter(r =>
    r.criticalityLevel === 'CRITICAL' || r.criticalityLevel === 'ESSENTIAL'
  );

  if (stockStatusFilter && stockStatusFilter.length > 0) {
    reportRows = reportRows.filter(r => stockStatusFilter.includes(r.stockStatus));
  }
  if (departmentFilter) {
    reportRows = reportRows.filter(r => r.department.toLowerCase().includes(departmentFilter.toLowerCase()));
  }

  const statusOrder: Record<string, number> = { 'ZERO': 0, 'LOW': 1, 'OK': 2, 'NOT_SET': 3 };
  const critOrder: Record<string, number> = { 'CRITICAL': 0, 'ESSENTIAL': 1, 'NORMAL': 2 };
  reportRows.sort((a, b) => {
    const sA = statusOrder[a.stockStatus] ?? 99;
    const sB = statusOrder[b.stockStatus] ?? 99;
    if (sA !== sB) return sA - sB;
    const cA = critOrder[a.criticalityLevel] ?? 99;
    const cB = critOrder[b.criticalityLevel] ?? 99;
    if (cA !== cB) return cA - cB;
    if (b.shortageQty !== a.shortageQty) return b.shortageQty - a.shortageQty;
    return (a.partCode || '').localeCompare(b.partCode || '');
  });

  reportRows.forEach((r, i) => { r.sNo = i + 1; });

  const totalCritical = reportRows.filter(r => r.criticalityLevel === 'CRITICAL').length;
  const totalEssential = reportRows.filter(r => r.criticalityLevel === 'ESSENTIAL').length;
  const totalLinkedCriticalEquip = reportRows.filter(r => r.linkedToCriticalEquipment === true).length;
  const totalZeroStock = reportRows.filter(r => r.stockStatus === 'ZERO').length;
  const totalLowStock = reportRows.filter(r => r.stockStatus === 'LOW').length;
  const totalShortage = reportRows.reduce((sum, r) => sum + r.shortageQty, 0);

  const byStatus: Record<string, number> = {};
  const byCriticality: Record<string, number> = {};
  reportRows.forEach(r => {
    byStatus[r.stockStatus] = (byStatus[r.stockStatus] || 0) + 1;
    byCriticality[r.criticalityLevel] = (byCriticality[r.criticalityLevel] || 0) + 1;
  });

  return {
    success: true,
    reportMeta: {
      reportType: 'CRITICAL_SPARES',
      vesselId,
      vesselName,
      generatedAt: new Date().toISOString(),
      totalSpares: reportRows.length,
      totalCritical,
      totalEssential,
      totalLinkedCriticalEquip,
      totalZeroStock,
      totalLowStock,
    },
    data: reportRows,
    summary: {
      byStatus,
      byCriticality,
      totalShortage,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL SPARES REPORT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCriticalSparesExcel(
  vesselId: string,
  stockStatusFilter: string[] | null,
  departmentFilter: string | undefined,
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  const vessel = allVessels.find(v => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

  let sparesData: any[];
  let jobsData: any[];
  let componentsData: any[];
  let jobComponentLinks: any[];
  if (vesselId === 'all') {
    sparesData = []; jobsData = []; componentsData = []; jobComponentLinks = [];
    for (const v of allVessels) {
      sparesData = sparesData.concat(await repo.getSpares(v.id));
      jobsData = jobsData.concat(await repo.getJobs(v.id));
      componentsData = componentsData.concat(await repo.getComponents(v.id));
      jobComponentLinks = jobComponentLinks.concat(await repo.getJobComponentLinks(v.id));
    }
  } else {
    sparesData = await repo.getSpares(vesselId);
    jobsData = await repo.getJobs(vesselId);
    componentsData = await repo.getComponents(vesselId);
    jobComponentLinks = await repo.getJobComponentLinks(vesselId);
  }

  const componentMap = new Map(componentsData.map(c => [c.cuuid, c]));

  const getStockStatus = (rob: number | null | undefined, min: number | null | undefined): string => {
    const robVal = rob ?? 0;
    if (robVal === 0) return 'ZERO';
    if (min === null || min === undefined || min === 0) return 'NOT_SET';
    if (robVal < min) return 'LOW';
    return 'OK';
  };

  const getShortage = (rob: number | null | undefined, min: number | null | undefined): number => {
    const robVal = rob ?? 0;
    if (min === null || min === undefined || min === 0) return 0;
    return Math.max(0, min - robVal);
  };

  const findRelatedJobs = (spare: any) => {
    const related: any[] = [];
    for (const job of jobsData) {
      let reqParts = job.requiredSpareParts;
      if (typeof reqParts === 'string') {
        try { reqParts = JSON.parse(reqParts); } catch { reqParts = []; }
      }
      if (!Array.isArray(reqParts)) continue;
      const match = reqParts.some((rp: any) =>
        (rp.partCode && spare.partCode && rp.partCode === spare.partCode) ||
        (rp.partName && spare.partName && rp.partName === spare.partName)
      );
      if (match) related.push(job);
    }
    return related;
  };

  const findCriticalComponents = (relatedJobs: any[]) => {
    const critComps: string[] = [];
    for (const job of relatedJobs) {
      const links = jobComponentLinks.filter(l => l.jobId === job.juuid);
      for (const link of links) {
        const comp = componentMap.get(link.componentId);
        if (comp && comp.critical === true) {
          const label = comp.name || comp.componentCode || comp.id;
          if (!critComps.includes(label)) critComps.push(label);
        }
      }
    }
    return critComps;
  };

  const getCriticality = (spare: any, relatedJobs: any[], criticalComponents: string[]): string => {
    if (criticalComponents.length > 0) return 'CRITICAL';
    const robVal = spare.rob ?? 0;
    const minVal = spare.min ?? 0;
    if (robVal === 0 || (minVal > 0 && robVal < minVal)) return 'ESSENTIAL';
    return 'NORMAL';
  };

  const getRemarks = (stockStatus: string, criticalityLevel: string): string => {
    if (criticalityLevel === 'CRITICAL' && stockStatus === 'ZERO') {
      return 'CRITICAL - OUT OF STOCK - Immediate procurement required for critical equipment';
    }
    if (criticalityLevel === 'CRITICAL' && stockStatus === 'LOW') {
      return 'CRITICAL - LOW STOCK - Urgent replenishment needed for critical equipment';
    }
    if (criticalityLevel === 'CRITICAL') {
      return 'CRITICAL - Linked to critical equipment - monitor closely';
    }
    if (stockStatus === 'ZERO') {
      return 'OUT OF STOCK - Procurement required';
    }
    if (stockStatus === 'LOW') {
      return 'LOW STOCK - Replenishment recommended';
    }
    if (stockStatus === 'NOT_SET') {
      return 'Minimum stock level not configured';
    }
    return 'Stock level adequate';
  };

  const allExcelRows = sparesData.map(spare => {
    const robVal = spare.rob ?? 0;
    const minVal = spare.min ?? null;
    const stockStatus = getStockStatus(robVal, minVal);
    const shortageQty = getShortage(robVal, minVal);
    const relatedJobs = findRelatedJobs(spare);
    const critComps = findCriticalComponents(relatedJobs);
    const criticalityLevel = getCriticality(spare, relatedJobs, critComps);
    const linkedToCritical = critComps.length > 0;

    const departments = new Set<string>();
    for (const job of relatedJobs) {
      if (job.department) departments.add(job.department);
    }
    for (const compName of critComps) {
      const comp = componentsData.find(c => (c.name || c.componentCode || c.id) === compName);
      if (comp?.department) departments.add(comp.department);
    }

    return {
      sNo: 0,
      vesselName,
      partCode: spare.partCode || '-',
      partName: spare.partName || '-',
      rob: robVal,
      minStock: spare.min != null ? minVal : null,
      stockStatus,
      shortageQty,
      criticalityLevel,
      criticalEquipment: linkedToCritical ? 'YES' : 'NO',
      criticalComponents: critComps.join(', ') || '-',
      relatedJobs: relatedJobs.map(j => j.jobNo || j.jobTitle || j.id).join(', ') || '-',
      department: Array.from(departments).join(', ') || '-',
      remarks: getRemarks(stockStatus, criticalityLevel),
    };
  });

  let reportRows = allExcelRows.filter(r =>
    r.criticalityLevel === 'CRITICAL' || r.criticalityLevel === 'ESSENTIAL'
  );

  if (stockStatusFilter && stockStatusFilter.length > 0) {
    reportRows = reportRows.filter(r => stockStatusFilter.includes(r.stockStatus));
  }
  if (departmentFilter) {
    reportRows = reportRows.filter(r => r.department.toLowerCase().includes(departmentFilter.toLowerCase()));
  }

  const statusOrder: Record<string, number> = { 'ZERO': 0, 'LOW': 1, 'OK': 2, 'NOT_SET': 3 };
  const critOrder: Record<string, number> = { 'CRITICAL': 0, 'ESSENTIAL': 1, 'NORMAL': 2 };
  reportRows.sort((a, b) => {
    const sA = statusOrder[a.stockStatus] ?? 99;
    const sB = statusOrder[b.stockStatus] ?? 99;
    if (sA !== sB) return sA - sB;
    const cA = critOrder[a.criticalityLevel] ?? 99;
    const cB = critOrder[b.criticalityLevel] ?? 99;
    if (cA !== cB) return cA - cB;
    if (b.shortageQty !== a.shortageQty) return b.shortageQty - a.shortageQty;
    return (a.partCode || '').localeCompare(b.partCode || '');
  });

  reportRows.forEach((r, i) => { r.sNo = i + 1; });

  const columns: ColumnDef[] = [
    { key: 'sNo', header: 'S.No', width: 6, type: 'number', align: 'center' },
    { key: 'vesselName', header: 'Vessel Name', width: 18, type: 'text' },
    { key: 'partCode', header: 'Part Code', width: 18, type: 'text' },
    { key: 'partName', header: 'Part Name', width: 35, type: 'text' },
    { key: 'rob', header: 'ROB', width: 8, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min Stock', width: 10, type: 'number', align: 'center' },
    { key: 'stockStatus', header: 'Stock Status', width: 14, type: 'text', align: 'center' },
    { key: 'shortageQty', header: 'Shortage Qty', width: 12, type: 'number', align: 'center' },
    { key: 'criticalityLevel', header: 'Criticality', width: 14, type: 'text', align: 'center' },
    { key: 'criticalEquipment', header: 'Critical Equip', width: 14, type: 'text', align: 'center' },
    { key: 'criticalComponents', header: 'Critical Components', width: 30, type: 'text' },
    { key: 'relatedJobs', header: 'Related Jobs', width: 30, type: 'text' },
    { key: 'department', header: 'Department', width: 12, type: 'text', align: 'center' },
    { key: 'remarks', header: 'Remarks', width: 40, type: 'text' },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Critical Spares Report');

  const lastCol = getLastColumnLetter(columns.length);

  applyStandardHeader(
    worksheet,
    'CRITICAL SPARES REPORT',
    'Status of Critical and Essential Spare Parts Inventory',
    vesselName,
    reportRows.length,
    lastCol
  );

  applyStandardTableHeader(worksheet, columns, 7);

  const conditionalStyles: ConditionalStyle[] = [
    {
      condition: (row: any) => row.stockStatus === 'ZERO',
      style: 'danger',
    },
    {
      condition: (row: any) => row.stockStatus === 'LOW' && row.criticalityLevel === 'CRITICAL',
      style: 'warning',
    },
    {
      condition: (row: any) => row.stockStatus === 'LOW',
      style: 'warning',
      textOnly: true,
    },
  ];

  applyStandardDataRows(worksheet, reportRows, columns, 8, conditionalStyles);

  worksheet.views = [{ state: 'frozen', ySplit: 7, xSplit: 0 }];

  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7 + reportRows.length, column: columns.length }
  };

  applyStandardPageSetup(worksheet, 7, columns.length, 6, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('Critical_Spares_Report', vesselName);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getLowStockAlert(
  vesselId: string,
  criticality: string | undefined,
  componentCategory: string | undefined,
  sortBy: string | undefined,
) {
  let allSpares: any[];
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    allSpares = [];
    for (const vessel of allVessels) {
      const vesselSpares = await repo.getSpares(vessel.id);
      allSpares = allSpares.concat(vesselSpares);
    }
  } else {
    allSpares = await repo.getSpares(vesselId);
  }
  const activeSparesRaw = allSpares.filter((s: any) => !s.deleted && s.dataScope !== 'fleet');

  let lowStockItems = activeSparesRaw.filter((s: any) => {
    const rob = s.rob || 0;
    const min = s.min || 0;
    return rob <= min;
  });

  if (criticality && criticality !== 'all') {
    lowStockItems = lowStockItems.filter((s: any) => {
      const crit = (s.critical || s.criticality || '').toLowerCase();
      if (criticality === 'critical') return crit === 'critical' || crit === 'yes';
      return crit !== 'critical' && crit !== 'yes';
    });
  }

  if (componentCategory && componentCategory !== 'all') {
    lowStockItems = lowStockItems.filter((s: any) =>
      (s.componentCode || '').startsWith(String(componentCategory)) ||
      (s.componentName || '').toLowerCase().includes(String(componentCategory).toLowerCase())
    );
  }

  const items = lowStockItems.map((s: any) => {
    const rob = s.rob || 0;
    const min = s.min || 0;
    const shortage = Math.max(0, min - rob);
    const crit = (s.critical || s.criticality || '').toLowerCase();
    const isCritical = crit === 'critical' || crit === 'yes';

    let status = 'Low';
    if (rob < min && isCritical) status = 'Critical';
    else if (rob === min) status = 'At Minimum';

    return {
      id: s.id,
      partCode: s.partCode || '-',
      partName: s.partName || '-',
      componentName: s.componentName || '-',
      currentQty: rob,
      minQty: min,
      shortage,
      status,
    };
  });

  const sortField = (sortBy as string) || 'shortage';
  items.sort((a: any, b: any) => {
    switch (sortField) {
      case 'partName': return a.partName.localeCompare(b.partName);
      default: return b.shortage - a.shortage;
    }
  });

  const criticalCount = items.filter((i: any) => i.status === 'Critical').length;
  const atMinCount = items.filter((i: any) => i.status === 'At Minimum').length;

  return {
    summary: {
      totalLowStock: items.length,
      criticalCount,
      atMinCount,
    },
    items,
  };
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - MARK ORDERED
// ═══════════════════════════════════════════════════════════════

export async function markSpareAsOrdered(spareId: number) {
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${String(now.getDate()).padStart(2,'0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
  const updated = await repo.updateSpare(spareId, { lastOrderDate: dateStr });
  return updated;
}

// ═══════════════════════════════════════════════════════════════
// LOW STOCK ALERT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportLowStockAlertExcel(
  vesselId: string,
  criticality: string | undefined,
  sortBy: string | undefined,
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  let allSpares: any[];
  if (vesselId === 'all') {
    allSpares = [];
    for (const vessel of allVessels) {
      const vesselSpares = await repo.getSpares(vessel.id);
      allSpares = allSpares.concat(vesselSpares);
    }
  } else {
    allSpares = await repo.getSpares(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

  const activeSparesRaw = allSpares.filter((s: any) => !s.deleted && s.dataScope !== 'fleet');

  let lowStockItems = activeSparesRaw.filter((s: any) => {
    const rob = s.rob || 0;
    const min = s.min || 0;
    return rob <= min;
  });

  if (criticality && criticality !== 'all') {
    lowStockItems = lowStockItems.filter((s: any) => {
      const crit = (s.critical || s.criticality || '').toLowerCase();
      if (criticality === 'critical') return crit === 'critical' || crit === 'yes';
      return crit !== 'critical' && crit !== 'yes';
    });
  }

  const items = lowStockItems.map((s: any) => {
    const rob = s.rob || 0;
    const min = s.min || 0;
    const shortage = Math.max(0, min - rob);
    const crit = (s.critical || s.criticality || '').toLowerCase();
    const isCritical = crit === 'critical' || crit === 'yes';

    let status = 'Low';
    if (rob < min && isCritical) status = 'Critical';
    else if (rob === min) status = 'At Minimum';

    return {
      partCode: s.partCode || '-', partName: s.partName || '-',
      componentName: s.componentName || '-',
      currentQty: rob, minQty: min, shortage, status,
    };
  });

  const sortField = sortBy || 'shortage';
  items.sort((a: any, b: any) => {
    switch (sortField) {
      case 'partName': return a.partName.localeCompare(b.partName);
      default: return b.shortage - a.shortage;
    }
  });

  const criticalCount = items.filter(i => i.status === 'Critical').length;
  const atMinCount = items.filter(i => i.status === 'At Minimum').length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Low Stock Alerts');

  const columns: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'partCode', header: 'Part Code', width: 18, type: 'text' },
    { key: 'partName', header: 'Part Name', width: 32, type: 'text' },
    { key: 'componentName', header: 'Component', width: 28, type: 'text' },
    { key: 'currentQty', header: 'Current Qty', width: 14, type: 'number', align: 'center' },
    { key: 'minQty', header: 'Min Qty', width: 12, type: 'number', align: 'center' },
    { key: 'shortage', header: 'Shortage', width: 12, type: 'number', align: 'center' },
    { key: 'status', header: 'Status', width: 16, type: 'text', align: 'center' },
  ];

  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);

  const subtitle = `Total Low Stock: ${items.length} | Critical: ${criticalCount} | At Minimum: ${atMinCount}`;
  applyStandardHeader(worksheet, 'LOW STOCK ALERT REPORT', subtitle, vesselName, items.length, lastColLetter);

  const headerRowNum = 7;
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  const statusBgColors: Record<string, string> = {
    'Critical': 'FFFFF1F0',
    'At Minimum': 'FFFFFBE6',
    'Low': 'FFFFFFFF',
  };
  const statusFontColors: Record<string, string> = {
    'Critical': 'FFF5222D',
    'At Minimum': 'FFFAAD14',
    'Low': 'FF5A6C7D',
  };

  items.forEach((item, idx) => {
    const rowData: (string | number)[] = [
      idx + 1,
      item.partCode, item.partName, item.componentName,
      item.currentQty, item.minQty, item.shortage, item.status,
    ];
    const row = worksheet.addRow(rowData);
    row.height = 20;

    const bgColor = statusBgColors[item.status] || 'FFFFFFFF';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? bgColor : COLORS.bgLight } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
      };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

      if (colNumber === 8) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusFontColors[item.status] || COLORS.textDark } };
      }
    });
  });

  worksheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: totalColumns }
  };

  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('LowStockAlerts', vesselName);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// SPARES CONSUMPTION ANALYSIS - DISTINCT COMPONENT NAMES
// ═══════════════════════════════════════════════════════════════

export async function getDistinctComponentNames(vesselId: string) {
  let allItems: any[];
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    allItems = [];
    for (const vessel of allVessels) {
      allItems = allItems.concat(await repo.getSpares(vessel.id));
    }
  } else {
    allItems = await repo.getSpares(vesselId);
  }
  const nameMap = new Map<string, string>();
  for (const item of allItems) {
    if (item.componentName && !nameMap.has(item.componentName)) {
      nameMap.set(item.componentName, item.componentCode || '');
    }
  }
  const components = Array.from(nameMap.entries())
    .map(([name, code]) => ({ componentName: name, componentCode: code }))
    .sort((a, b) => a.componentName.localeCompare(b.componentName));
  return { components };
}

// ═══════════════════════════════════════════════════════════════
// SPARES CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getSparesConsumptionAnalysis(
  vesselId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  category: string | undefined,
  componentNames: string | undefined,
) {
  const allVessels = await repo.getVessels();
  let allHistory: any[];
  let allItems: any[];
  if (vesselId === 'all') {
    allHistory = []; allItems = [];
    for (const vessel of allVessels) {
      allHistory = allHistory.concat(await repo.getSpareHistory(vessel.id));
      allItems = allItems.concat(await repo.getSpares(vessel.id));
    }
  } else {
    allHistory = await repo.getSpareHistory(vesselId);
    allItems = await repo.getSpares(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
  const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

  let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
  let allLedgerEvents = allHistory;

  if (startDate) {
    const sd = new Date(startDate as string);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
    allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
  }
  if (endDate) {
    const ed = new Date(endDate as string);
    ed.setHours(23, 59, 59, 999);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
    allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
  }
  let filteredItems = allItems;
  if (componentNames) {
    const names = componentNames.split(',').map(n => n.trim()).filter(Boolean);
    if (names.length > 0) {
      const nameSet = new Set(names);
      filteredItems = allItems.filter((i: any) => nameSet.has(i.componentName));
      const compItemIds = new Set(filteredItems.map((i: any) => i.id));
      consumeEvents = consumeEvents.filter((h: any) => compItemIds.has(h.spareId));
      allLedgerEvents = allLedgerEvents.filter((h: any) => compItemIds.has(h.spareId));
    }
  } else if (category && category !== 'all') {
    filteredItems = allItems.filter((i: any) => i.partCategory === category);
    const catItemIds = new Set(filteredItems.map((i: any) => i.id));
    consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.spareId));
    allLedgerEvents = allLedgerEvents.filter((h: any) => catItemIds.has(h.spareId));
  }

  const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
  const eventSpanDays = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

  let daysOfData: number;
  if (startDate && endDate) {
    const sd = new Date(startDate as string);
    const ed = new Date(endDate as string);
    daysOfData = Math.max(1, Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  } else if (startDate) {
    const sd = new Date(startDate as string);
    daysOfData = Math.max(1, Math.ceil((new Date().getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  } else if (endDate) {
    const ed = new Date(endDate as string);
    daysOfData = Math.max(1, Math.ceil((ed.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  } else {
    daysOfData = eventSpanDays;
  }

  const distinctEventDays = new Set(dates.map((d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)).size;
  const totalConsumptionEvents = consumeEvents.length;

  let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
  if (daysOfData > CONFIDENCE_THRESHOLDS.HIGH_DAYS) confidenceLevel = 'high';
  else if (daysOfData >= CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) confidenceLevel = 'medium';

  const monthlyMap: Record<string, { totalQty: number; eventCount: number; itemIds: Set<number>; byType: Record<string, number> }> = {};
  for (const h of consumeEvents) {
    const d = new Date(h.timestampUTC);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { totalQty: 0, eventCount: 0, itemIds: new Set(), byType: {} };
    }
    const qty = Math.abs(h.qtyChange || 0);
    monthlyMap[monthKey].totalQty += qty;
    monthlyMap[monthKey].eventCount += 1;
    monthlyMap[monthKey].itemIds.add(h.spareId);
    monthlyMap[monthKey].byType['spares'] = (monthlyMap[monthKey].byType['spares'] || 0) + qty;
  }

  const consumptionTrends = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalQty: Math.round(data.totalQty * 100) / 100,
      eventCount: data.eventCount,
      itemCount: data.itemIds.size,
      byType: {
        spares: Math.round((data.byType['spares'] || 0) * 100) / 100,
      }
    }));

  const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date; robSnapshots: number[] }> = {};
  for (const h of consumeEvents) {
    const key = h.spareId;
    if (!itemGrouped[key]) {
      itemGrouped[key] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC), robSnapshots: [] };
    }
    const qty = Math.abs(h.qtyChange || 0);
    itemGrouped[key].totalConsumed += qty;
    itemGrouped[key].events += 1;
    const robAfter = h.robAfter || 0;
    itemGrouped[key].robSnapshots.push(robAfter);
    const ts = new Date(h.timestampUTC);
    if (ts > itemGrouped[key].lastConsumed) {
      itemGrouped[key].lastConsumed = ts;
    }
  }

  const topConsumedItems = Object.entries(itemGrouped)
    .map(([itemIdStr, g]) => {
      const itemId = Number(itemIdStr);
      const item = itemsMap.get(itemId);
      const currentRob = item?.rob || 0;
      const minStock = item?.min || 0;
      const rawMonthlyRate = daysOfData > 0 ? (g.totalConsumed / daysOfData) * 30 : 0;
      let confidenceMultiplier = 1.0;
      if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) confidenceMultiplier = 0.5;
      else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) confidenceMultiplier = 0.75;
      const avgMonthlyConsumption = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
      return {
        itemId,
        itemCode: item?.partCode || '',
        itemName: item?.partName || '',
        itemType: item?.critical || 'Spare Part',
        category: item?.partCategory || item?.componentName || '',
        uom: item?.uom || item?.unit || '',
        totalConsumed: Math.round(g.totalConsumed * 100) / 100,
        eventCount: g.events,
        avgMonthlyConsumption,
        rawAvgMonthlyConsumption: Math.round(rawMonthlyRate * 100) / 100,
        confidenceMultiplier,
        adjustmentNote: daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS
          ? `Adjusted estimate (\u00d7${confidenceMultiplier}) based on limited ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
          : daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS
            ? `Adjusted estimate (\u00d7${confidenceMultiplier}) based on ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
            : null,
        currentRob,
        minStock,
        lastConsumedDate: g.lastConsumed.toISOString(),
        hasSingleEvent: g.events === 1,
      };
    })
    .sort((a, b) => b.totalConsumed - a.totalConsumed);

  const categoryMap: Record<string, { totalQty: number; itemCount: Set<number>; itemType: string }> = {};
  for (const h of consumeEvents) {
    const item = itemsMap.get(h.spareId);
    const cat = item?.partCategory || item?.componentName || 'Uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalQty: 0, itemCount: new Set(), itemType: item?.critical || 'Spare Part' };
    }
    categoryMap[cat].totalQty += Math.abs(h.qtyChange || 0);
    categoryMap[cat].itemCount.add(h.spareId);
  }

  const totalConsumptionQty = Object.values(categoryMap).reduce((sum, c) => sum + c.totalQty, 0);
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([cat, data]) => ({
      category: cat,
      itemType: data.itemType,
      totalQty: Math.round(data.totalQty * 100) / 100,
      itemCount: data.itemCount.size,
      percentage: totalConsumptionQty > 0 ? Math.round((data.totalQty / totalConsumptionQty) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);

  const stockEfficiency = filteredItems
    .filter((item: any) => !item.deleted && item.isActive !== false)
    .map((item: any) => {
      const itemId = item.id;
      const consumed = itemGrouped[itemId];
      const totalConsumed = consumed?.totalConsumed || 0;
      const currentRob = item.rob || 0;
      const minStock = item.min || 0;
      const robSnapshots = consumed?.robSnapshots || [];
      const avgRob = robSnapshots.length > 0
        ? robSnapshots.reduce((s: number, v: number) => s + v, 0) / robSnapshots.length
        : currentRob;
      const stockTurnoverRatio = avgRob > 0 ? Math.round((totalConsumed / avgRob) * 100) / 100 : 0;

      const eventCount = consumed?.events || 0;
      const consumptionFrequency = daysOfData > 0 ? eventCount / daysOfData : 0;
      const stockHealthRatio = minStock > 0 ? currentRob / minStock : null;

      let movementSpeed: 'fast' | 'slow' | 'very-slow' | 'non-moving' = 'non-moving';
      let movementNote = '';
      if (totalConsumed === 0) {
        movementSpeed = 'non-moving';
        movementNote = currentRob > 0 ? 'No consumption recorded - consider stock reduction' : '';
      } else {
        const fastThreshold = daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 0.5 : 2.0;
        const slowThreshold = daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 0.05 : 0.5;
        if (stockTurnoverRatio >= fastThreshold || consumptionFrequency >= 0.5) {
          movementSpeed = 'fast';
          movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
        } else if (stockTurnoverRatio >= slowThreshold || consumptionFrequency >= 0.1) {
          movementSpeed = 'slow';
          movementNote = 'Monitor stock levels';
        } else {
          movementSpeed = 'very-slow';
          movementNote = 'Consider stock reduction';
        }
      }

      const avgDailyConsumption = daysOfData > 0 ? totalConsumed / daysOfData : 0;
      const baseStockoutDays = avgDailyConsumption > 0 ? currentRob / avgDailyConsumption : null;
      let daysUntilStockout = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
      let stockoutRange: { lower: number; upper: number } | null = null;
      let stockoutConfidence: 'low' | 'medium' | 'high' = 'high';
      if (baseStockoutDays !== null && baseStockoutDays > 0) {
        if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) {
          stockoutRange = { lower: Math.floor(baseStockoutDays * 0.5), upper: Math.ceil(baseStockoutDays * 2.0) };
          stockoutConfidence = 'low';
        } else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) {
          stockoutRange = { lower: Math.floor(baseStockoutDays * 0.75), upper: Math.ceil(baseStockoutDays * 1.5) };
          stockoutConfidence = 'medium';
        }
      }
      const belowMinStock = currentRob < minStock;
      const negativeRob = currentRob < 0;

      return {
        itemId,
        itemCode: item.partCode || '',
        itemName: item.partName || '',
        itemType: item.critical || 'Spare Part',
        uom: item.uom || item.unit || '',
        currentRob,
        minStock,
        avgRob: Math.round(avgRob * 100) / 100,
        totalConsumed: Math.round(totalConsumed * 100) / 100,
        stockTurnoverRatio,
        movementSpeed,
        movementNote,
        consumptionFrequency: Math.round(consumptionFrequency * 1000) / 1000,
        stockHealthRatio: stockHealthRatio !== null ? Math.round(stockHealthRatio * 100) / 100 : null,
        daysUntilStockout,
        stockoutRange,
        stockoutConfidence,
        belowMinStock,
        negativeRob,
        eventCount,
      };
    })
    .sort((a: any, b: any) => b.stockTurnoverRatio - a.stockTurnoverRatio);

  const forecastData = topConsumedItems.map(item => {
    const avgDaily = daysOfData > 0 ? item.totalConsumed / daysOfData : 0;
    let forecastConfidenceMultiplier = 1.0;
    if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) forecastConfidenceMultiplier = 0.5;
    else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) forecastConfidenceMultiplier = 0.75;
    const adjustedDaily = avgDaily * forecastConfidenceMultiplier;
    const projectedMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
    const monthsRemaining = adjustedDaily > 0 ? Math.round((item.currentRob / adjustedDaily / 30) * 10) / 10 : null;

    const leadTimeDays = 30;
    const safetyStock = projectedMonthly;
    const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
    const targetLevel = Math.max(item.minStock * 3, projectedMonthly * 6);
    const reorderNeeded = item.currentRob <= reorderPoint && projectedMonthly > 0;
    const suggestedReorderQty = reorderNeeded ? Math.max(0, Math.ceil(targetLevel - item.currentRob)) : 0;
    const reorderReasoning = reorderNeeded
      ? `Bring stock from ${item.currentRob} to ${Math.round(targetLevel)} (${projectedMonthly > 0 ? Math.round(targetLevel / projectedMonthly * 10) / 10 : '\u221E'} months supply at ${projectedMonthly}/month)`
      : item.currentRob > reorderPoint ? 'Stock adequate - above reorder point' : 'No consumption recorded';

    return {
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemType: item.itemType,
      uom: item.uom,
      avgMonthlyConsumption: item.avgMonthlyConsumption,
      rawAvgMonthlyConsumption: item.rawAvgMonthlyConsumption,
      projectedNextMonth: projectedMonthly,
      currentRob: item.currentRob,
      minStock: item.minStock,
      monthsOfStockRemaining: monthsRemaining,
      reorderNeeded,
      suggestedReorderQty,
      reorderPoint,
      targetLevel: Math.round(targetLevel),
      safetyStock: Math.round(safetyStock * 100) / 100,
      leadTimeDays,
      reorderReasoning,
      confidenceLevel,
    };
  });

  const nonMovingItems = stockEfficiency
    .filter((i: any) => i.movementSpeed === 'non-moving' && i.currentRob > 0)
    .slice(0, 50);

  const recentTransactions = [...consumeEvents]
    .sort((a: any, b: any) => {
      const dateA = new Date(a.timestampUTC || a.dateLocal || 0).getTime();
      const dateB = new Date(b.timestampUTC || b.dateLocal || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 100)
    .map((h: any) => ({
      id: h.id,
      date: h.timestampUTC || h.dateLocal,
      itemId: h.spareId,
      itemCode: h.partCode,
      itemName: h.partName,
      section: 'spares',
      qtyConsumed: Math.abs(h.qtyChange || 0),
      robAfter: h.robAfter || 0,
      uom: itemsMap.get(h.spareId)?.uom || itemsMap.get(h.spareId)?.unit || '',
      userId: h.userId || '',
      remarks: h.remarks || '',
    }));

  const uniqueItemsConsumed = new Set(consumeEvents.map((h: any) => h.spareId)).size;

  return {
    summary: {
      totalItemsConsumed: uniqueItemsConsumed,
      totalQuantityConsumed: Math.round(consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(h.qtyChange || 0), 0) * 100) / 100,
      totalConsumptionEvents: consumeEvents.length,
      dateRange: { start: earliestDate.toISOString(), end: latestDate.toISOString() },
      dataQuality: {
        daysOfData,
        distinctEventDays,
        totalConsumptionEvents,
        eventSpanDays,
        isLimitedData: daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS,
        confidenceLevel,
        message: daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS
          ? `Analysis covers ${daysOfData}-day period with ${totalConsumptionEvents} consumption event${totalConsumptionEvents !== 1 ? 's' : ''} across ${distinctEventDays} distinct day${distinctEventDays !== 1 ? 's' : ''}. More accurate trends will develop with more data.`
          : daysOfData < CONFIDENCE_THRESHOLDS.HIGH_DAYS
            ? `Analysis covers ${daysOfData}-day period with ${totalConsumptionEvents} event${totalConsumptionEvents !== 1 ? 's' : ''} across ${distinctEventDays} day${distinctEventDays !== 1 ? 's' : ''}. Moderate confidence in trend projections.`
            : `Analysis covers ${daysOfData}-day period with ${totalConsumptionEvents} event${totalConsumptionEvents !== 1 ? 's' : ''} across ${distinctEventDays} day${distinctEventDays !== 1 ? 's' : ''}. High confidence in trend projections.`,
      },
      totalInventoryItems: filteredItems.filter((i: any) => !i.deleted && i.isActive !== false).length,
      dataMonths: Math.max(0.1, Math.round((daysOfData / 30) * 10) / 10),
      vesselName,
    },
    consumptionTrends,
    topConsumedItems,
    categoryBreakdown,
    stockEfficiency,
    forecastData,
    nonMovingItems,
    recentTransactions,
  };
}

// ═══════════════════════════════════════════════════════════════
// SPARES CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportSparesConsumptionExcel(
  vesselId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  category: string | undefined,
  componentNames: string | undefined,
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  let allHistory: any[];
  let allItems: any[];
  if (vesselId === 'all') {
    allHistory = []; allItems = [];
    for (const vessel of allVessels) {
      allHistory = allHistory.concat(await repo.getSpareHistory(vessel.id));
      allItems = allItems.concat(await repo.getSpares(vessel.id));
    }
  } else {
    allHistory = await repo.getSpareHistory(vesselId);
    allItems = await repo.getSpares(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
  const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

  let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
  if (startDate) {
    const sd = new Date(startDate);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
  }
  if (endDate) {
    const ed = new Date(endDate);
    ed.setHours(23, 59, 59, 999);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
  }
  let excelFilteredItems = allItems;
  if (componentNames) {
    const names = (typeof componentNames === 'string' ? componentNames : '').split(',').map(n => n.trim()).filter(Boolean);
    if (names.length > 0) {
      const nameSet = new Set(names);
      excelFilteredItems = allItems.filter((i: any) => nameSet.has(i.componentName));
      const compItemIds = new Set(excelFilteredItems.map((i: any) => i.id));
      consumeEvents = consumeEvents.filter((h: any) => compItemIds.has(h.spareId));
    }
  } else if (category && category !== 'all') {
    excelFilteredItems = allItems.filter((i: any) => i.partCategory === category);
    const catItemIds = new Set(excelFilteredItems.map((i: any) => i.id));
    consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.spareId));
  }

  const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
  const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const datePeriod = `${earliestDate.toISOString().slice(0, 10)} to ${latestDate.toISOString().slice(0, 10)}`;

  const uniqueItems = new Set(consumeEvents.map((h: any) => h.spareId)).size;
  const totalQty = consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(h.qtyChange || 0), 0);

  // Monthly Trends sheet
  const trendsSheet = workbook.addWorksheet('Monthly Trends');
  const monthlyMap: Record<string, { totalQty: number; eventCount: number }> = {};
  for (const h of consumeEvents) {
    const d = new Date(h.timestampUTC);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[mk]) monthlyMap[mk] = { totalQty: 0, eventCount: 0 };
    const qty = Math.abs(h.qtyChange || 0);
    monthlyMap[mk].totalQty += qty;
    monthlyMap[mk].eventCount += 1;
  }
  const trendsCols: ColumnDef[] = [
    { key: 'month', header: 'Month', width: 14, type: 'text' },
    { key: 'totalQty', header: 'Total Qty', width: 14, type: 'number', align: 'center' },
    { key: 'events', header: 'Events', width: 12, type: 'number', align: 'center' },
  ];
  const trendsLastCol = getLastColumnLetter(trendsCols.length);
  applyStandardHeader(trendsSheet, 'MONTHLY SPARES CONSUMPTION TRENDS', `Data Period: ${datePeriod}`, vesselName, Object.keys(monthlyMap).length, trendsLastCol, datePeriod);
  applyStandardTableHeader(trendsSheet, trendsCols, 7);

  Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data], idx) => {
    const row = trendsSheet.addRow([month, Math.round(data.totalQty * 100) / 100, data.eventCount]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = trendsCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(trendsSheet, 7, trendsCols.length, 6, vesselName);

  // Item Analysis sheet
  const itemSheet = workbook.addWorksheet('Item Analysis');
  const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date }> = {};
  for (const h of consumeEvents) {
    if (!itemGrouped[h.spareId]) itemGrouped[h.spareId] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC) };
    itemGrouped[h.spareId].totalConsumed += Math.abs(h.qtyChange || 0);
    itemGrouped[h.spareId].events += 1;
    const ts = new Date(h.timestampUTC);
    if (ts > itemGrouped[h.spareId].lastConsumed) itemGrouped[h.spareId].lastConsumed = ts;
  }
  const itemRows = Object.entries(itemGrouped).map(([id, g]) => {
    const item = itemsMap.get(Number(id));
    const rawMonthlyRate = Math.round((g.totalConsumed / daysOfData) * 30 * 100) / 100;
    let confidenceMultiplier = 1.0;
    if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) confidenceMultiplier = 0.5;
    else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) confidenceMultiplier = 0.75;
    const adjustedMonthly = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
    return {
      itemCode: item?.partCode || '', itemName: item?.partName || '', itemType: item?.critical || 'Spare Part',
      category: item?.partCategory || item?.componentName || '', component: item?.componentName || '',
      uom: item?.uom || item?.unit || '',
      totalConsumed: Math.round(g.totalConsumed * 100) / 100, events: g.events,
      avgMonthly: adjustedMonthly,
      rawRate: rawMonthlyRate !== adjustedMonthly ? rawMonthlyRate : null,
      currentRob: item?.rob || 0, minStock: item?.min || 0,
      lastConsumed: g.lastConsumed.toISOString().slice(0, 10),
    };
  }).sort((a, b) => b.totalConsumed - a.totalConsumed);

  const itemCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Part Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Part Name', width: 32, type: 'text' },
    { key: 'component', header: 'Component', width: 20, type: 'text' },
    { key: 'itemType', header: 'Criticality', width: 14, type: 'text' },
    { key: 'category', header: 'Category', width: 18, type: 'text' },
    { key: 'uom', header: 'UOM', width: 10, type: 'text', align: 'center' },
    { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
    { key: 'events', header: 'Events', width: 10, type: 'number', align: 'center' },
    { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
    { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'text', align: 'center' },
    { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
    { key: 'lastConsumed', header: 'Last Consumed', width: 14, type: 'text', align: 'center' },
  ];
  const itemLastCol = getLastColumnLetter(itemCols.length);
  applyStandardHeader(itemSheet, 'SPARE PART CONSUMPTION ANALYSIS', `Data Period: ${datePeriod} | ${itemRows.length} spares consumed`, vesselName, itemRows.length, itemLastCol, datePeriod);
  applyStandardTableHeader(itemSheet, itemCols, 7);

  itemRows.forEach((item, idx) => {
    const row = itemSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.itemType, item.category, item.uom, item.totalConsumed, item.events, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.currentRob, item.minStock, item.lastConsumed]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = itemCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(itemSheet, 7, itemCols.length, 6, vesselName);

  // Category Breakdown sheet
  const catSheet = workbook.addWorksheet('Category Breakdown');
  const catMap: Record<string, { totalQty: number; items: Set<number>; itemType: string }> = {};
  for (const h of consumeEvents) {
    const item = itemsMap.get(h.spareId);
    const cat = item?.partCategory || item?.componentName || 'Uncategorized';
    if (!catMap[cat]) catMap[cat] = { totalQty: 0, items: new Set(), itemType: item?.critical || 'Spare Part' };
    catMap[cat].totalQty += Math.abs(h.qtyChange || 0);
    catMap[cat].items.add(h.spareId);
  }
  const catTotal = Object.values(catMap).reduce((s, c) => s + c.totalQty, 0);
  const catRows = Object.entries(catMap).map(([cat, data]) => ({
    category: cat, itemType: data.itemType, totalQty: Math.round(data.totalQty * 100) / 100,
    itemCount: data.items.size, percentage: catTotal > 0 ? Math.round((data.totalQty / catTotal) * 10000) / 100 : 0,
  })).sort((a, b) => b.totalQty - a.totalQty);

  const catCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'category', header: 'Category', width: 28, type: 'text' },
    { key: 'itemType', header: 'Criticality', width: 16, type: 'text' },
    { key: 'totalQty', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
    { key: 'itemCount', header: 'Spares', width: 10, type: 'number', align: 'center' },
    { key: 'percentage', header: '% Share', width: 12, type: 'number', align: 'center' },
  ];
  const catLastCol = getLastColumnLetter(catCols.length);
  applyStandardHeader(catSheet, 'CATEGORY-WISE SPARES CONSUMPTION BREAKDOWN', `Data Period: ${datePeriod}`, vesselName, catRows.length, catLastCol, datePeriod);
  applyStandardTableHeader(catSheet, catCols, 7);

  catRows.forEach((item, idx) => {
    const row = catSheet.addRow([idx + 1, item.category, item.itemType, item.totalQty, item.itemCount, item.percentage]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = catCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(catSheet, 7, catCols.length, 6, vesselName);

  // Stock Efficiency sheet
  const effSheet = workbook.addWorksheet('Stock Efficiency');
  const effItems = excelFilteredItems.filter((i: any) => !i.deleted && i.isActive !== false).map((item: any) => {
    const consumed = itemGrouped[item.id];
    const totalConsumed = consumed?.totalConsumed || 0;
    const currentRob = item.rob || 0;
    const minStock = item.min || 0;
    const avgDaily = daysOfData > 0 ? totalConsumed / daysOfData : 0;
    const events = consumed?.events || 0;
    const consumptionFrequency = daysOfData > 0 ? events / daysOfData : 0;
    const turnover = currentRob > 0 ? Math.round((totalConsumed / currentRob) * 100) / 100 : 0;
    let speed = 'Non-Moving';
    let movementNote = '';
    if (totalConsumed === 0) {
      speed = 'Non-Moving';
      movementNote = currentRob > 0 ? 'No consumption - consider reduction' : '';
    } else {
      const fastThreshold = daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 0.5 : 2.0;
      const slowThreshold = daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 0.05 : 0.5;
      if (turnover >= fastThreshold || consumptionFrequency >= 0.5) {
        speed = 'Fast';
        movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
      } else if (turnover >= slowThreshold || consumptionFrequency >= 0.1) {
        speed = 'Slow';
        movementNote = 'Monitor stock levels';
      } else {
        speed = 'Very Slow';
        movementNote = 'Consider stock reduction';
      }
    }
    const baseStockoutDays = avgDaily > 0 ? currentRob / avgDaily : null;
    const daysToStockoutVal = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
    let stockoutRange = '-';
    if (baseStockoutDays !== null && baseStockoutDays > 0) {
      if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) stockoutRange = `${Math.floor(baseStockoutDays * 0.5)}-${Math.ceil(baseStockoutDays * 2.0)}d`;
      else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) stockoutRange = `${Math.floor(baseStockoutDays * 0.75)}-${Math.ceil(baseStockoutDays * 1.5)}d`;
    }
    return {
      itemCode: item.partCode || '', itemName: item.partName || '', itemType: item.critical || 'Spare Part',
      component: item.componentName || '',
      uom: item.uom || item.unit || '', currentRob, minStock, totalConsumed: Math.round(totalConsumed * 100) / 100,
      turnover, speed, movementNote,
      daysToStockout: daysToStockoutVal !== null ? daysToStockoutVal : '\u221E',
      stockoutRange,
      belowMin: currentRob < minStock ? 'Yes' : 'No',
    };
  }).sort((a: any, b: any) => (b.turnover || 0) - (a.turnover || 0));

  const effCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Part Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Part Name', width: 32, type: 'text' },
    { key: 'component', header: 'Component', width: 20, type: 'text' },
    { key: 'itemType', header: 'Criticality', width: 14, type: 'text' },
    { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
    { key: 'totalConsumed', header: 'Consumed', width: 14, type: 'number', align: 'center' },
    { key: 'turnover', header: 'Turnover', width: 12, type: 'number', align: 'center' },
    { key: 'speed', header: 'Movement', width: 14, type: 'text', align: 'center' },
    { key: 'daysToStockout', header: 'Days to Stockout', width: 16, type: 'text', align: 'center' },
    { key: 'stockoutRange', header: 'Stockout Range', width: 14, type: 'text', align: 'center' },
    { key: 'belowMin', header: 'Below Min', width: 12, type: 'text', align: 'center' },
    { key: 'movementNote', header: 'Note', width: 24, type: 'text' },
  ];
  const effLastCol = getLastColumnLetter(effCols.length);
  applyStandardHeader(effSheet, 'SPARES STOCK EFFICIENCY ANALYSIS', `Data Period: ${datePeriod} | Movement thresholds adjusted for ${daysOfData}-day sample`, vesselName, effItems.length, effLastCol, datePeriod);
  applyStandardTableHeader(effSheet, effCols, 7);

  effItems.forEach((item: any, idx: number) => {
    const row = effSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.itemType, item.currentRob, item.minStock, item.totalConsumed, item.turnover, item.speed, item.daysToStockout, item.stockoutRange, item.belowMin, item.movementNote]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = effCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
      if (colNum === 10 && item.speed === 'Fast') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.success } };
      }
      if (colNum === 10 && item.speed === 'Very Slow') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.warning } };
      }
      if (colNum === 13 && item.belowMin === 'Yes') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
      }
    });
  });
  applyStandardPageSetup(effSheet, 7, effCols.length, 6, vesselName);

  // Forecasting sheet
  const forecastSheet = workbook.addWorksheet('Forecasting');
  const forecastItems = Object.entries(itemGrouped).map(([id, g]) => {
    const item = itemsMap.get(Number(id));
    const avgDaily = daysOfData > 0 ? g.totalConsumed / daysOfData : 0;
    let fcMultiplier = 1.0;
    if (daysOfData < CONFIDENCE_THRESHOLDS.LOW_DAYS) fcMultiplier = 0.5;
    else if (daysOfData < CONFIDENCE_THRESHOLDS.MEDIUM_DAYS) fcMultiplier = 0.75;
    const adjustedDaily = avgDaily * fcMultiplier;
    const projMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
    const rawMonthly = Math.round(avgDaily * 30 * 100) / 100;
    const currentRob = item?.rob || 0;
    const minStock = item?.min || 0;
    const monthsRem = adjustedDaily > 0 ? Math.round((currentRob / adjustedDaily / 30) * 10) / 10 : null;
    const leadTimeDays = 30;
    const safetyStock = projMonthly;
    const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
    const targetLevel = Math.max(minStock * 3, projMonthly * 6);
    const reorder = currentRob <= reorderPoint && projMonthly > 0;
    const suggestedQty = reorder ? Math.max(0, Math.ceil(targetLevel - currentRob)) : 0;
    const reasoning = reorder
      ? `Stock ${currentRob} \u2192 ${Math.round(targetLevel)} (${projMonthly > 0 ? Math.round(targetLevel / projMonthly * 10) / 10 : '\u221E'}mo supply)`
      : currentRob > reorderPoint ? 'Stock adequate' : 'No consumption';
    return {
      itemCode: item?.partCode || '', itemName: item?.partName || '', component: item?.componentName || '',
      uom: item?.uom || item?.unit || '',
      avgMonthly: projMonthly, rawRate: rawMonthly !== projMonthly ? rawMonthly : null,
      projNextMonth: projMonthly, currentRob, minStock, reorderPoint: Math.round(reorderPoint),
      monthsRemaining: monthsRem !== null ? monthsRem : '-',
      reorderNeeded: reorder ? 'Yes' : 'No', suggestedQty, reasoning,
      confidence: daysOfData > CONFIDENCE_THRESHOLDS.HIGH_DAYS ? 'High' : daysOfData >= CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 'Medium' : 'Low',
    };
  }).sort((a, b) => (typeof b.monthsRemaining === 'number' ? b.monthsRemaining : 999) - (typeof a.monthsRemaining === 'number' ? a.monthsRemaining : 999));

  const fcCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Part Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Part Name', width: 32, type: 'text' },
    { key: 'component', header: 'Component', width: 20, type: 'text' },
    { key: 'uom', header: 'UOM', width: 10, type: 'text', align: 'center' },
    { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
    { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'text', align: 'center' },
    { key: 'projNextMonth', header: 'Projected', width: 14, type: 'number', align: 'center' },
    { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
    { key: 'reorderPoint', header: 'Reorder Pt', width: 12, type: 'number', align: 'center' },
    { key: 'monthsRemaining', header: 'Months Left', width: 14, type: 'text', align: 'center' },
    { key: 'reorderNeeded', header: 'Reorder?', width: 12, type: 'text', align: 'center' },
    { key: 'suggestedQty', header: 'Suggested Qty', width: 14, type: 'number', align: 'center' },
    { key: 'reasoning', header: 'Reasoning', width: 36, type: 'text' },
    { key: 'confidence', header: 'Confidence', width: 14, type: 'text', align: 'center' },
  ];
  const fcLastCol = getLastColumnLetter(fcCols.length);
  applyStandardHeader(forecastSheet, 'SPARES CONSUMPTION FORECAST & REORDER PROJECTIONS', `Data Period: ${datePeriod} | Confidence: ${daysOfData > CONFIDENCE_THRESHOLDS.HIGH_DAYS ? 'High' : daysOfData >= CONFIDENCE_THRESHOLDS.MEDIUM_DAYS ? 'Medium' : 'Low'}`, vesselName, forecastItems.length, fcLastCol, datePeriod);
  applyStandardTableHeader(forecastSheet, fcCols, 7);

  forecastItems.forEach((item, idx) => {
    const row = forecastSheet.addRow([idx + 1, item.itemCode, item.itemName, item.component, item.uom, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.projNextMonth, item.currentRob, item.minStock, item.reorderPoint, item.monthsRemaining, item.reorderNeeded, item.suggestedQty, item.reasoning, item.confidence]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = fcCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
      if (colNum === 13 && item.reorderNeeded === 'Yes') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
      }
      if (colNum === 16 && item.confidence === 'Low') {
        cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.warning } };
      }
    });
  });
  applyStandardPageSetup(forecastSheet, 7, fcCols.length, 6, vesselName);

  const startStr = earliestDate.toISOString().slice(0, 10);
  const endStr = latestDate.toISOString().slice(0, 10);
  const shortVessel = vesselName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `Spares_Consumption_Analysis_${shortVessel}_${startStr}_to_${endStr}_${timestamp}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
