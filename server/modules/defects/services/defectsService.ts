import * as defectsRepo from '../repositories/defectsRepository';
import { insertDefectSchema, insertDefectActionSchema, insertDefectAttachmentSchema } from '@shared/schema';
import { generateDefectNumber } from '../../../utils/defectNumbering';
import { storage } from '../../../storage';

// ── Core Defects ──

export async function getDefects(filters: any) {
  return defectsRepo.getDefects(filters);
}

export async function getDefectsCount(filters: any) {
  return defectsRepo.getDefectsCount(filters);
}

export async function getDefectsCountSummary() {
  const activeCount = await defectsRepo.getDefectsCount({ statusView: 'active' });
  const resolvedCount = await defectsRepo.getDefectsCount({ statusView: 'resolved' });
  return { active: activeCount, resolved: resolvedCount };
}

export async function getRecurringDefectsCount() {
  const recurringDefects = await defectsRepo.getRecurringDefects({});
  return recurringDefects.length;
}

export async function getDefect(id: string) {
  return defectsRepo.getDefect(id);
}

export async function createDefect(body: any) {
  const validatedData = insertDefectSchema.parse(body);

  // Generate proper defect ID using naming convention
  const vesselId = validatedData.vesselId || 'UNKNOWN';
  const generatedId = await generateDefectNumber(storage, vesselId);

  // Create defect with generated ID
  const defectWithId = {
    ...validatedData,
    id: generatedId
  };

  console.log(`[DefectRoutes] Creating defect with generated ID: ${generatedId} for vessel: ${vesselId}`);

  return defectsRepo.createDefect(defectWithId);
}

export async function updateDefect(id: string, body: any) {
  const partialDefectSchema = insertDefectSchema.partial();
  const validatedData = partialDefectSchema.parse(body);
  return defectsRepo.updateDefect(id, validatedData);
}

export async function deleteDefect(id: string) {
  return defectsRepo.deleteDefect(id);
}

// ── Defect Actions ──

export async function getDefectActions(defectId: string) {
  return defectsRepo.getDefectActions(defectId);
}

export async function createDefectAction(defectId: string, body: any) {
  const actionData = {
    ...body,
    defectId
  };
  const validatedData = insertDefectActionSchema.parse(actionData);
  return defectsRepo.createDefectAction(validatedData);
}

export async function updateDefectAction(actionId: number, body: any) {
  const partialActionSchema = insertDefectActionSchema.partial();
  const validatedData = partialActionSchema.parse(body);
  return defectsRepo.updateDefectAction(actionId, validatedData);
}

export async function deleteDefectAction(actionId: number) {
  return defectsRepo.deleteDefectAction(actionId);
}

// ── Defect Attachments ──

export async function getDefectAttachments(defectId: string) {
  return defectsRepo.getDefectAttachments(defectId);
}

export async function createDefectAttachment(defectId: string, body: any) {
  const attachmentData = {
    ...body,
    defectId
  };
  const validatedData = insertDefectAttachmentSchema.parse(attachmentData);
  return defectsRepo.createDefectAttachment(validatedData);
}

export async function deleteDefectAttachment(attachmentId: number) {
  return defectsRepo.deleteDefectAttachment(attachmentId);
}

// ── Defect Workflow (Notes, Linking, Closure) ──

export async function addDefectNote(defectId: string, body: any) {
  const { noteText, attachments, createdBy } = body;

  if (!noteText || noteText.length < 10) {
    throw Object.assign(new Error("Note text must be at least 10 characters"), { statusCode: 400 });
  }

  const note = {
    noteId: Date.now().toString(),
    noteText,
    attachments: attachments || [],
    createdBy: createdBy || 'Anonymous',
    createdOn: new Date().toISOString()
  };

  return defectsRepo.addDefectNote(defectId, note);
}

export async function linkDefects(defectId: string, body: any) {
  const { linkedDefects } = body;

  if (!linkedDefects || !Array.isArray(linkedDefects) || linkedDefects.length === 0) {
    throw Object.assign(new Error("linkedDefects must be a non-empty array"), { statusCode: 400 });
  }

  return defectsRepo.linkDefects(defectId, linkedDefects);
}

export async function closeDefect(defectId: string, body: any) {
  const { closedBy, closureComment, closureFiles, actionTakenRequested, targetCloseDate, dateCompleted } = body;

  // Validate all required fields
  if (!closureComment || closureComment.trim().length === 0) {
    throw Object.assign(new Error("Closure comment is required"), { statusCode: 400 });
  }

  if (!actionTakenRequested || actionTakenRequested.trim().length === 0) {
    throw Object.assign(new Error("Action taken is required to close the defect"), { statusCode: 400 });
  }

  if (!targetCloseDate) {
    throw Object.assign(new Error("Target date is required"), { statusCode: 400 });
  }

  if (!dateCompleted) {
    throw Object.assign(new Error("Completion date is required"), { statusCode: 400 });
  }

  return defectsRepo.closeDefect(defectId, {
    closedBy: closedBy || 'System',
    closureComment,
    closureFiles: closureFiles || []
  });
}

// ── Defect Reports ──

export async function generateReport(reportKey: string, filters: any) {
  // Get defects based on filters
  const defects = await defectsRepo.getDefects(filters);

  // Generate report based on report key
  let reportData: any = {
    title: '',
    generatedAt: new Date().toISOString(),
    filters,
    data: []
  };

  switch(reportKey) {
    case 'status-summary':
      reportData.title = 'Defects Status Summary';
      // Group defects by status
      const statusGroups = defects.reduce((acc: any, defect) => {
        if (!acc[defect.status]) {
          acc[defect.status] = { count: 0, defects: [] };
        }
        acc[defect.status].count++;
        acc[defect.status].defects.push(defect);
        return acc;
      }, {});
      reportData.data = Object.entries(statusGroups).map(([status, data]: [string, any]) => ({
        status,
        count: data.count,
        percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
      }));
      break;

    case 'overdue':
      reportData.title = 'Overdue Defects';
      const today = new Date().toISOString().split('T')[0];
      reportData.data = defects.filter((d: any) =>
        d.status === 'Open' &&
        d.targetCloseDate &&
        new Date(d.targetCloseDate.split('-').reverse().join('-')) < new Date(today)
      );
      break;

    case 'critical':
      reportData.title = 'Critical Defects';
      reportData.data = defects.filter((d: any) => d.critical || d.is_coc);
      break;

    case 'by-vessel':
      reportData.title = 'Defects by Vessel';
      const vesselGroups = defects.reduce((acc: any, defect) => {
        if (!acc[defect.vesselName]) {
          acc[defect.vesselName] = { count: 0, open: 0, closed: 0 };
        }
        acc[defect.vesselName].count++;
        if (defect.status === 'Open') {
          acc[defect.vesselName].open++;
        } else if (defect.status === 'Closed') {
          acc[defect.vesselName].closed++;
        }
        return acc;
      }, {});
      reportData.data = Object.entries(vesselGroups).map(([vessel, stats]: [string, any]) => ({
        vessel,
        total: stats.count,
        open: stats.open,
        closed: stats.closed
      }));
      break;

    case 'by-equipment':
      reportData.title = 'Defects by Equipment';
      const equipmentGroups = defects.reduce((acc: any, defect) => {
        const equipment = defect.equipmentCategory || 'Not Specified';
        if (!acc[equipment]) {
          acc[equipment] = { count: 0, defects: [] };
        }
        acc[equipment].count++;
        acc[equipment].defects.push(defect);
        return acc;
      }, {});
      reportData.data = Object.entries(equipmentGroups).map(([equipment, data]: [string, any]) => ({
        equipment,
        count: data.count,
        percentage: ((data.count / defects.length) * 100).toFixed(1) + '%'
      }));
      break;

    case 'monthly-trend':
      reportData.title = 'Monthly Trend';
      // Group by month
      const monthGroups = defects.reduce((acc: any, defect) => {
        const dateStr = defect.issueDate; // DD-MM-YYYY
        if (!dateStr) return acc;
        const [day, month, year] = dateStr.split('-');
        const monthKey = `${year}-${month}`;
        if (!acc[monthKey]) {
          acc[monthKey] = { created: 0, closed: 0 };
        }
        acc[monthKey].created++;
        if (defect.status === 'Closed' && defect.dateCompleted) {
          const [cDay, cMonth, cYear] = defect.dateCompleted.split('-');
          const closedMonthKey = `${cYear}-${cMonth}`;
          if (!acc[closedMonthKey]) {
            acc[closedMonthKey] = { created: 0, closed: 0 };
          }
          acc[closedMonthKey].closed++;
        }
        return acc;
      }, {});
      reportData.data = Object.entries(monthGroups).map(([month, stats]: [string, any]) => ({
        month,
        created: stats.created,
        closed: stats.closed,
        net: stats.created - stats.closed
      })).sort((a, b) => a.month.localeCompare(b.month));
      break;

    default:
      reportData.title = 'Defects Report';
      reportData.data = defects;
  }

  return reportData;
}

// ── Recurring Defects ──

export async function getRecurringDefectsShortcut(filters: any) {
  return defectsRepo.getRecurringDefects(filters);
}

export async function getRecurringDefectsWithAutoCalc(filters: any) {
  // Check if ANY recurring defects exist at all (without filters)
  const allRecurringDefects = await defectsRepo.getRecurringDefects();

  // If no recurring defects have been calculated yet, calculate them for all time windows
  if (allRecurringDefects.length === 0) {
    // Get all unique equipment keys from defects
    const allDefects = await defectsRepo.getDefects({ includeClosedDefects: true });
    const equipmentKeys = new Set<string>();

    for (const defect of allDefects) {
      if ((defect as any).equipment_key) {
        equipmentKeys.add((defect as any).equipment_key);
      }
    }

    // Calculate recurring defects for multiple time windows
    const timeWindows = [6, 12, 24, 36, 48, 60]; // 6 months to 5 years

    // Use Array.from() to iterate over Set
    for (const equipmentKey of Array.from(equipmentKeys)) {
      for (const windowMonths of timeWindows) {
        await defectsRepo.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths);
      }
    }
  }

  // Now fetch the recurring defects with the requested filters
  return defectsRepo.getRecurringDefects(filters);
}

export async function getRecurringDefect(id: number) {
  return defectsRepo.getRecurringDefect(id);
}

export async function getDefectsForRecurring(recurringId: number) {
  return defectsRepo.getDefectsForRecurring(recurringId);
}

export async function recalculateRecurringDefects(equipmentKey: string, windowMonths?: number) {
  if (!equipmentKey) {
    throw Object.assign(new Error("equipmentKey is required"), { statusCode: 400 });
  }
  return defectsRepo.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths || 12);
}
