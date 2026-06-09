import { Request, Response } from 'express';
import * as rhService from '../services/runningHoursService';
import * as rhTimelineValidation from '../services/rhTimelineValidationService';
import { ValidationError } from '../../shared/errors';

const PLACEHOLDER_USER_IDS = ['admin', 'system', 'User', 'user', ''];

function resolveUserId(req: Request): string {
  const user = (req as any).user;
  const bodyUserId = (req.body?.userId as string) || '';
  if (!bodyUserId || PLACEHOLDER_USER_IDS.includes(bodyUserId)) {
    const name = user?.fullName
      || [user?.firstname, user?.lastname].filter(Boolean).join(' ')
      || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
      || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
      || user?.username
      || bodyUserId
      || 'system';
    return name;
  }
  return bodyUserId;
}

function resolveUserUuid(req: Request): string | undefined {
  const bodyUuid = (req.body?.userUuid as string) || '';
  if (bodyUuid) return bodyUuid;
  const user = (req as any).user;
  return user?.userUuid || undefined;
}

// ── Running Hours Audits (from routes.ts) ──

export async function getAudits(req: Request, res: Response) {
  const audits = await rhService.getAuditsForComponent(req.params.componentId);
  res.json(audits);
}

export async function createAudit(req: Request, res: Response) {
  try {
    req.body.userId = resolveUserId(req);
    req.body.updatedByUuid = resolveUserUuid(req);
    const audit = await rhService.createAudit(req.body);
    res.status(201).json(audit);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    res.status(500).json({ error: "Failed to create audit" });
  }
}

// ── Cascade Update (from routes.ts) ──

export async function cascadeUpdate(req: Request, res: Response) {
  try {
    req.body.userId = resolveUserId(req);
    req.body.userUuid = resolveUserUuid(req);
    const result = await rhService.cascadeUpdate(req.body);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    console.error('Error cascading running hours update:', error);
    res.status(500).json({ error: error.message || "Failed to cascade running hours update" });
  }
}

// ── Running Hours Parents & Children (from runningHoursRoutes.ts) ──

export async function listParents(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || 'V001';
    const periodFrom = req.query.periodFrom as string | undefined;
    const periodTo = req.query.periodTo as string | undefined;
    // 'my' scope: vesselId='all' carries a vesselIds allow-list narrowing the aggregate.
    const vesselIdsRaw = typeof req.query.vesselIds === 'string' ? req.query.vesselIds : '';
    const vesselIds = vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined;

    if (periodFrom && periodTo) {
      const result = await rhService.listParents(vesselId, 'custom', new Date(periodFrom), new Date(periodTo), vesselIds);
      res.json(result);
    } else {
      const period = (req.query.period as string) || 'monthly';
      const validPeriods = ['weekly', 'monthly', 'quarterly', 'yearly'];
      const safePeriod = validPeriods.includes(period) ? period : 'monthly';
      const result = await rhService.listParents(vesselId, safePeriod, undefined, undefined, vesselIds);
      res.json(result);
    }
  } catch (error: any) {
    console.error("Error fetching running hour parents:", error);
    res.status(500).json({ error: "Failed to fetch running hour parents" });
  }
}

export async function listChildren(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || 'V001';
    const result = await rhService.listChildren(req.params.parentCode, vesselId);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching children RH:", error);
    res.status(500).json({ error: "Failed to fetch children running hours" });
  }
}

// ── Child RH Update & Reset (from runningHoursRoutes.ts) ──

export async function updateChildRH(req: Request, res: Response) {
  try {
    req.body.userId = resolveUserId(req);
    req.body.userUuid = resolveUserUuid(req);
    const result = await rhService.updateChildRH(req.params.componentId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    console.error("Error updating child RH:", error);
    res.status(500).json({ error: "Failed to update child running hours" });
  }
}

export async function resetChildRH(req: Request, res: Response) {
  try {
    req.body.userId = resolveUserId(req);
    req.body.userUuid = resolveUserUuid(req);
    const result = await rhService.resetChildRH(req.params.componentId, req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error resetting child RH:", error);
    res.status(500).json({ error: "Failed to reset child running hours" });
  }
}

// ── RH Config Endpoints (from runningHoursRoutes.ts) ──

export async function listMasterComponents(req: Request, res: Response) {
  try {
    const result = await rhService.listMasterComponents(req.params.vesselId);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching master components:", error);
    res.status(500).json({ error: "Failed to fetch master components" });
  }
}

export async function getRHConfig(req: Request, res: Response) {
  try {
    const result = await rhService.getRHConfig(req.params.componentId);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching RH config:", error);
    res.status(500).json({ error: "Failed to fetch RH configuration" });
  }
}

export async function updateRHConfig(req: Request, res: Response) {
  try {
    const result = await rhService.updateRHConfig(req.params.componentId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    console.error("Error updating RH config:", error);
    res.status(500).json({ error: error.message || "Failed to update RH configuration" });
  }
}

export async function updateMasterRH(req: Request, res: Response) {
  try {
    req.body.userId = resolveUserId(req);
    req.body.userUuid = resolveUserUuid(req);
    const result = await rhService.updateMasterRH(req.params.componentId, req.body);
    res.json(result);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, ...error.details });
    }
    console.error("Error updating master RH:", error);
    res.status(500).json({ error: error.message || "Failed to update master running hours" });
  }
}

export async function listInheritedComponents(req: Request, res: Response) {
  try {
    const result = await rhService.listInheritedComponents(req.params.masterComponentId);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching inherited components:", error);
    res.status(500).json({ error: "Failed to fetch inherited components" });
  }
}

// ── RH Timeline Validation Endpoints (Layer 7) ──

export async function getValidRange(req: Request, res: Response) {
  try {
    const machineryId = req.query.machineryId as string;
    const completionDate = req.query.completionDate as string;
    if (!machineryId || !completionDate) {
      return res.status(400).json({ error: 'machineryId and completionDate are required' });
    }
    const result = await rhTimelineValidation.getValidRange(machineryId, completionDate);
    res.json(result);
  } catch (error: any) {
    console.error('Error getting valid range:', error);
    res.status(500).json({ error: error.message || 'Failed to get valid range' });
  }
}

export async function validateRHEntry(req: Request, res: Response) {
  try {
    const { machineryId, completionDate, runningHours, previousReading } = req.body;
    if (!machineryId || !completionDate || runningHours === undefined) {
      return res.status(400).json({ error: 'machineryId, completionDate, and runningHours are required' });
    }
    const result = await rhTimelineValidation.validateRHEntry(machineryId, completionDate, Number(runningHours));

    let componentActualRH: number | null = null;
    let rhCounterType = 'MASTER';
    try {
      const currentRHData = await rhTimelineValidation.getCurrentRH(machineryId);
      componentActualRH = currentRHData.currentRH;
      rhCounterType = (currentRHData.rhCounterType || 'MASTER').toUpperCase();
    } catch {}

    // Task #245: the flat "exceeds component actual RH" ceiling is fully retired. It is applied to
    // NO counter type. MASTER (the completion reading is the source of truth and advances the
    // counter) and INHERITED (governed solely by timeline validation — see workOrderCompletionService)
    // are the RH-driven types; NOT_RH_DRIVEN treats running hours as not applicable. Timeline
    // validation (already computed in `result`) is the sole governor for RH-driven components.
    const isNotRhDriven = rhCounterType === 'NOT_RH_DRIVEN';
    const exceedsComponentRH = false;

    const prevReading = previousReading !== undefined && previousReading !== null ? Number(previousReading) : null;

    let adjustedMin = result.validRange ? result.validRange.min : 0;
    if (prevReading !== null && !isNaN(prevReading) && result.validRange && prevReading < result.validRange.min) {
      adjustedMin = prevReading;
    }

    // Never cap the displayed max at the current reading — show the true timeline range.
    // An unbounded upper limit is represented internally as Infinity, which JSON.stringify
    // silently converts to null. Emit an explicit null sentinel so the client has a stable
    // contract for "no upper bound" instead of relying on that implicit coercion.
    const adjustedMax = result.validRange && Number.isFinite(result.validRange.max)
      ? result.validRange.max
      : null;

    const cappedValidRange = result.validRange
      ? { ...result.validRange, min: adjustedMin, max: adjustedMax }
      : result.validRange;

    res.json({
      ...result,
      // NOT_RH_DRIVEN: running hours are not applicable — never block the entry.
      ...(isNotRhDriven ? { isValid: true, validationStatus: 'NOT_APPLICABLE', errorMessage: '', requiresJustification: false } : {}),
      validRange: cappedValidRange,
      componentActualRH,
      rhCounterType,
      exceedsComponentRH
    });
  } catch (error: any) {
    console.error('Error validating RH entry:', error);
    res.status(500).json({ error: error.message || 'Failed to validate RH entry' });
  }
}

export async function getRHTimeline(req: Request, res: Response) {
  try {
    const machineryId = req.query.machineryId as string;
    if (!machineryId) {
      return res.status(400).json({ error: 'machineryId is required' });
    }
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const result = await rhTimelineValidation.getRHTimeline(machineryId, dateFrom, dateTo);
    res.json(result);
  } catch (error: any) {
    console.error('Error getting RH timeline:', error);
    res.status(500).json({ error: error.message || 'Failed to get RH timeline' });
  }
}

export async function getCurrentRH(req: Request, res: Response) {
  try {
    const machineryId = req.query.machineryId as string;
    if (!machineryId) {
      return res.status(400).json({ error: 'machineryId is required' });
    }
    const result = await rhTimelineValidation.getCurrentRH(machineryId);
    res.json(result);
  } catch (error: any) {
    console.error('Error getting current RH:', error);
    res.status(500).json({ error: error.message || 'Failed to get current RH' });
  }
}

// ── One-time Propagation (from runningHoursRoutes.ts) ──

export async function propagateAll(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '743ef9d1-841a-11ed-aa7c-7003bca91a86';
    const userId = resolveUserId(req);
    const result = await rhService.propagateAll(vesselId, userId);
    res.json(result);
  } catch (error: any) {
    console.error("Error propagating RH values:", error);
    res.status(500).json({ error: "Failed to propagate running hours" });
  }
}

// ── Running Hours History ──

export async function getHistory(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    const componentId = req.query.componentId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 10, 100);
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' as const : 'desc' as const;
    const search = req.query.search as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const result = await rhService.getRunningHoursHistory({
      vesselId,
      componentId,
      page,
      pageSize,
      sortOrder,
      search,
      dateFrom,
      dateTo,
    });
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching running hours history:", error);
    res.status(500).json({ error: "Failed to fetch running hours history" });
  }
}

export async function exportHistory(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '';
    const componentId = req.query.componentId as string | undefined;
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' as const : 'desc' as const;
    const search = req.query.search as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const result = await rhService.getRunningHoursHistory({
      vesselId,
      componentId,
      page: 1,
      pageSize: 10000,
      sortOrder,
      search,
      dateFrom,
      dateTo,
    });

    const headers = ['Date', 'Component Code', 'Component Name', 'Previous RH', 'New RH', 'Change (Delta)', 'Updated By', 'Source', 'Notes'];
    const rows = result.data.map(row => [
      row.updatedAt ? new Date(row.updatedAt).toISOString().split('T')[0] : '',
      row.componentCode,
      row.componentName || '',
      row.previousRh,
      row.newRh,
      row.deltaRh,
      row.updatedBy,
      row.updateSource,
      row.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="running_hours_history_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    console.error("Error exporting running hours history:", error);
    res.status(500).json({ error: "Failed to export running hours history" });
  }
}
