import { Request, Response } from 'express';
import * as defectsService from '../services/defectsService';

// ── GET /defects ──

export async function getDefects(req: Request, res: Response) {
  try {
    const vesselIdsRaw = req.query.vesselIds as string | undefined;
    const vesselIds = vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined;

    const filters = {
      vesselId: req.query.vesselId as string,
      status: req.query.status as string,
      statusView: req.query.statusScope as 'active' | 'resolved' | undefined ||
                 req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
      priority: req.query.priority as string,
      critical: req.query.critical === 'true' ? true : req.query.critical === 'false' ? false : undefined,
      isCoC: req.query.is_coc === 'true' || req.query.isCoC === 'true' ? true :
             req.query.is_coc === 'false' || req.query.isCoC === 'false' ? false : undefined, // Only apply filter when explicitly set
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: req.query.search as string,
      includeClosedDefects: req.query.includeClosedDefects === 'true',
      dueOverdue: req.query.dueOverdue as string,
    };

    let defects = await defectsService.getDefects(filters);
    if (vesselIds?.length && (!filters.vesselId || filters.vesselId === 'all')) {
      defects = defects.filter((d: any) => vesselIds.includes(d.vesselId));
    }
    res.json(defects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch defects" });
  }
}

// ── GET /defects/coc ──

export async function getCocDefects(req: Request, res: Response) {
  try {
    const filters = {
      vesselId: req.query.vesselId as string,
      status: req.query.status as string,
      statusView: req.query.statusScope as 'active' | 'resolved' | undefined ||
                 req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
      priority: req.query.priority as string,
      isCoC: true, // Always filter for CoC
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: req.query.search as string,
    };

    const defects = await defectsService.getDefects(filters);
    res.json(defects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CoC defects" });
  }
}

// ── GET /defects/recurring ──

export async function getRecurringDefectsShortcut(req: Request, res: Response) {
  try {
    const filters = {
      windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths as string) : undefined,
      minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences as string) : undefined,
      hasCoc: req.query.hasCoc ? req.query.hasCoc === 'true' : undefined,
      equipmentKey: req.query.equipmentKey as string,
    };

    const recurringDefects = await defectsService.getRecurringDefectsShortcut(filters);
    res.json(recurringDefects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recurring defects" });
  }
}

// ── GET /defects/count ──

export async function getDefectsCount(req: Request, res: Response) {
  try {
    const filters: any = {
      statusView: req.query.statusScope as 'active' | 'resolved' | undefined ||
                 req.query.statusView as 'active' | 'resolved' | undefined, // Support both statusScope and statusView
      vesselId: req.query.vesselId as string,
      isCoC: req.query.isCoC !== undefined ? req.query.isCoC === 'true' : undefined,
      // Include all filter parameters to match list query filters
      category: req.query.category as string,
      search: req.query.search as string,
      period: req.query.period as string,
      fleet: req.query.fleet as string,
      group: req.query.group as string,
      dueOverdue: req.query.dueOverdue as string,
    };

    const count = await defectsService.getDefectsCount(filters);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to get defects count" });
  }
}

// ── GET /defects/count/recurring ──

export async function getRecurringDefectsCount(req: Request, res: Response) {
  try {
    const count = await defectsService.getRecurringDefectsCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to get recurring defects count" });
  }
}

// ── GET /defects/:id ──

export async function getDefect(req: Request, res: Response) {
  try {
    const defect = await defectsService.getDefect(req.params.id);
    if (!defect) {
      return res.status(404).json({ error: "Defect not found" });
    }
    res.json(defect);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch defect" });
  }
}

// ── POST /defects ──

export async function createDefect(req: Request, res: Response) {
  try {
    const defect = await defectsService.createDefect(req.body);
    res.status(201).json(defect);
  } catch (error: any) {
    console.error('[DefectRoutes] Error creating defect:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid defect data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create defect" });
  }
}

// ── PATCH /defects/:id ──

export async function updateDefect(req: Request, res: Response) {
  try {
    const defect = await defectsService.updateDefect(req.params.id, req.body);
    res.json(defect);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid defect data", details: error.errors });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update defect" });
  }
}

// ── DELETE /defects/:id ──

export async function deleteDefect(req: Request, res: Response) {
  try {
    await defectsService.deleteDefect(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete defect" });
  }
}

// ── DELETE /defects-clear-all ──

export async function clearAllDefects(req: Request, res: Response) {
  res.status(501).json({
    error: "Not Implemented",
    message: "The clearAllDefectsData method is not implemented in storage. This endpoint is reserved for future admin/testing functionality."
  });
}

// ── POST /defects-seed-e2e-test ──

export async function seedE2eTest(req: Request, res: Response) {
  res.status(501).json({
    error: "Not Implemented",
    message: "The seedE2ETestData method is not implemented in storage. This endpoint is reserved for future testing functionality."
  });
}

// ── GET /defects-count ──

export async function getDefectsCountSummary(req: Request, res: Response) {
  try {
    const counts = await defectsService.getDefectsCountSummary();
    res.json(counts);
  } catch (error: any) {
    console.error("Error getting defects count:", error);
    res.status(500).json({ error: "Failed to get defects count" });
  }
}

// ── GET /defects/:defectId/actions ──

export async function getDefectActions(req: Request, res: Response) {
  try {
    const actions = await defectsService.getDefectActions(req.params.defectId);
    res.json(actions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch defect actions" });
  }
}

// ── POST /defects/:defectId/actions ──

export async function createDefectAction(req: Request, res: Response) {
  try {
    const action = await defectsService.createDefectAction(req.params.defectId, req.body);
    res.status(201).json(action);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid action data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create defect action" });
  }
}

// ── PATCH /defects/actions/:actionId ──

export async function updateDefectAction(req: Request, res: Response) {
  try {
    const action = await defectsService.updateDefectAction(parseInt(req.params.actionId), req.body);
    res.json(action);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid action data", details: error.errors });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update defect action" });
  }
}

// ── DELETE /defects/actions/:actionId ──

export async function deleteDefectAction(req: Request, res: Response) {
  try {
    await defectsService.deleteDefectAction(parseInt(req.params.actionId));
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete defect action" });
  }
}

// ── GET /defects/:defectId/attachments ──

export async function getDefectAttachments(req: Request, res: Response) {
  try {
    const attachments = await defectsService.getDefectAttachments(req.params.defectId);
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch defect attachments" });
  }
}

// ── POST /defects/:defectId/attachments ──

export async function createDefectAttachment(req: Request, res: Response) {
  try {
    const attachment = await defectsService.createDefectAttachment(req.params.defectId, req.body);
    res.status(201).json(attachment);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid attachment data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create defect attachment" });
  }
}

// ── DELETE /defects/attachments/:attachmentId ──

export async function deleteDefectAttachment(req: Request, res: Response) {
  try {
    await defectsService.deleteDefectAttachment(parseInt(req.params.attachmentId));
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete defect attachment" });
  }
}

// ── POST /defects/:id/notes ──

export async function addDefectNote(req: Request, res: Response) {
  try {
    const updatedDefect = await defectsService.addDefectNote(req.params.id, req.body);
    res.json(updatedDefect);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to add note" });
  }
}

// ── PATCH /defects/:id/link ──

export async function linkDefects(req: Request, res: Response) {
  try {
    const updatedDefect = await defectsService.linkDefects(req.params.id, req.body);
    res.json(updatedDefect);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to link defects" });
  }
}

// ── PATCH /defects/:id/close ──

export async function closeDefect(req: Request, res: Response) {
  try {
    const defect = await defectsService.closeDefect(req.params.id, req.body);
    res.json(defect);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to close defect" });
  }
}

// ── POST /defects/reports/:reportKey ──

export async function generateReport(req: Request, res: Response) {
  try {
    const reportData = await defectsService.generateReport(req.params.reportKey, req.body);
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate report" });
  }
}

// ── GET /recurring-defects ──

export async function getRecurringDefects(req: Request, res: Response) {
  try {
    const filters = {
      windowMonths: req.query.windowMonths ? parseInt(req.query.windowMonths as string) : 12,
      minOccurrences: req.query.minOccurrences ? parseInt(req.query.minOccurrences as string) : 2,
      hasCoc: req.query.hasCoc === 'true' ? true : req.query.hasCoc === 'false' ? false : undefined,
      equipmentKey: req.query.equipmentKey as string
    };

    const recurringDefects = await defectsService.getRecurringDefectsWithAutoCalc(filters);
    res.json(recurringDefects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recurring defects" });
  }
}

// ── GET /recurring-defects/:id ──

export async function getRecurringDefect(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const recurringDefect = await defectsService.getRecurringDefect(id);
    if (!recurringDefect) {
      return res.status(404).json({ error: "Recurring defect not found" });
    }
    res.json(recurringDefect);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recurring defect" });
  }
}

// ── GET /recurring-defects/:id/defects ──

export async function getDefectsForRecurring(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const defects = await defectsService.getDefectsForRecurring(id);
    res.json(defects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch defects for recurring defect" });
  }
}

// ── POST /recurring-defects/recalculate ──

export async function recalculateRecurringDefects(req: Request, res: Response) {
  try {
    const { equipmentKey, windowMonths } = req.body;
    const recurringDefect = await defectsService.recalculateRecurringDefects(equipmentKey, windowMonths);
    res.json(recurringDefect);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to recalculate recurring defects" });
  }
}
