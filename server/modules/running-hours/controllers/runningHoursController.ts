import { Request, Response } from 'express';
import * as rhService from '../services/runningHoursService';
import * as rhTimelineValidation from '../services/rhTimelineValidationService';
import { ValidationError } from '../../shared/errors';

// ── Running Hours Audits (from routes.ts) ──

export async function getAudits(req: Request, res: Response) {
  const audits = await rhService.getAuditsForComponent(req.params.componentId);
  res.json(audits);
}

export async function createAudit(req: Request, res: Response) {
  try {
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
    const user = (req as any).user;
    if (!req.body.userId || req.body.userId === 'admin' || req.body.userId === 'system') {
      req.body.userId = user?.fullName || user?.username || req.body.userId || 'system';
    }
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
    const period = (req.query.period as string) || 'monthly';
    const validPeriods = ['weekly', 'monthly', 'quarterly', 'yearly'];
    const safePeriod = validPeriods.includes(period) ? period : 'monthly';
    const result = await rhService.listParents(vesselId, safePeriod);
    res.json(result);
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
    const { machineryId, completionDate, runningHours } = req.body;
    if (!machineryId || !completionDate || runningHours === undefined) {
      return res.status(400).json({ error: 'machineryId, completionDate, and runningHours are required' });
    }
    const result = await rhTimelineValidation.validateRHEntry(machineryId, completionDate, Number(runningHours));
    res.json(result);
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
    const userId = (req.body.userId as string) || 'system';
    const result = await rhService.propagateAll(vesselId, userId);
    res.json(result);
  } catch (error: any) {
    console.error("Error propagating RH values:", error);
    res.status(500).json({ error: "Failed to propagate running hours" });
  }
}
