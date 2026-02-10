import type { Request, Response } from "express";
import { z } from "zod";
import { runningHoursService } from "../services/runningHoursService";

const updateRHConfigSchema = z.object({
  rhCounterType: z.enum(['MASTER', 'INHERITED', 'NOT_RH_DRIVEN']),
  rhMasterComponentId: z.string().nullable().optional(),
  userId: z.string().optional()
});

const updateMasterRHSchema = z.object({
  newRHValue: z.number().nonnegative("Running hours must be non-negative"),
  updateSource: z.enum(['MANUAL', 'IMPORT', 'AUTOMATION']).optional().default('MANUAL'),
  userId: z.string().optional().default('system'),
  userRole: z.string().optional().default('Ship'),
  adminOverride: z.boolean().optional().default(false),
  comments: z.string().optional(),
  dateUpdated: z.string().optional()
});

export async function getParents(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || 'V001';
    const parents = await runningHoursService.getParents(vesselId);
    res.json(parents);
  } catch (error: any) {
    console.error("[v2] Error fetching running hour parents:", error);
    res.status(500).json({ error: "Failed to fetch running hour parents" });
  }
}

export async function getChildren(req: Request, res: Response) {
  try {
    const { parentCode } = req.params;
    const vesselId = (req.query.vesselId as string) || 'V001';

    const result = await runningHoursService.getChildren(parentCode, vesselId);
    if (!result) {
      return res.status(404).json({ error: "Parent component not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error fetching children RH:", error);
    res.status(500).json({ error: "Failed to fetch children running hours" });
  }
}

export async function updateChildRH(req: Request, res: Response) {
  try {
    const { componentId } = req.params;
    const { newRHValue, comments, userId, userRole, adminOverride, dateUpdated } = req.body;

    if (typeof newRHValue !== 'number' || newRHValue < 0) {
      return res.status(400).json({ error: "newRHValue must be a non-negative number" });
    }

    const result = await runningHoursService.updateChildRH(componentId, newRHValue, comments, userId, userRole, adminOverride, dateUpdated);

    if (result.error) {
      return res.status(result.status!).json(
        result.validation
          ? { error: result.error, validation: result.validation }
          : { error: result.error }
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error updating child RH:", error);
    res.status(500).json({ error: "Failed to update child running hours" });
  }
}

export async function resetChildRH(req: Request, res: Response) {
  try {
    const { componentId } = req.params;
    const { oldMeterFinal, userId, notes } = req.body;

    const result = await runningHoursService.resetChildRH(componentId, oldMeterFinal, userId, notes);

    if (result.error) {
      return res.status(result.status!).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error resetting child RH:", error);
    res.status(500).json({ error: "Failed to reset child running hours" });
  }
}

export async function getMasterComponents(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const result = await runningHoursService.getMasterComponentsForDropdown(vesselId);
    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error fetching master components:", error);
    res.status(500).json({ error: "Failed to fetch master components" });
  }
}

export async function getRHConfig(req: Request, res: Response) {
  try {
    const { componentId } = req.params;
    const result = await runningHoursService.getRHConfig(componentId);

    if (!result) {
      return res.status(404).json({ error: "Component not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error fetching RH config:", error);
    res.status(500).json({ error: "Failed to fetch RH configuration" });
  }
}

export async function updateRHConfig(req: Request, res: Response) {
  try {
    const { componentId } = req.params;

    const parseResult = updateRHConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parseResult.error.format()
      });
    }

    const { rhCounterType, rhMasterComponentId, userId } = parseResult.data;

    const result = await runningHoursService.updateRHConfig(componentId, rhCounterType, rhMasterComponentId, userId);

    if (result.error) {
      return res.status(result.status!).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error updating RH config:", error);
    res.status(500).json({ error: error.message || "Failed to update RH configuration" });
  }
}

export async function updateMasterRH(req: Request, res: Response) {
  try {
    const { componentId } = req.params;

    const parseResult = updateMasterRHSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parseResult.error.format()
      });
    }

    const { newRHValue, updateSource, userId, userRole, adminOverride, comments, dateUpdated } = parseResult.data;

    const result = await runningHoursService.updateMasterRH(componentId, newRHValue, updateSource, userId, userRole, adminOverride, comments, dateUpdated);

    if (result.error) {
      return res.status(result.status!).json(
        result.validation
          ? { error: result.error, validation: result.validation }
          : { error: result.error }
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error updating master RH:", error);
    res.status(500).json({ error: error.message || "Failed to update master running hours" });
  }
}

export async function getInheritedComponents(req: Request, res: Response) {
  try {
    const { masterComponentId } = req.params;
    const result = await runningHoursService.getInheritedComponentsList(masterComponentId);
    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error fetching inherited components:", error);
    res.status(500).json({ error: "Failed to fetch inherited components" });
  }
}

export async function propagateAll(req: Request, res: Response) {
  try {
    const vesselId = (req.query.vesselId as string) || '743ef9d1-841a-11ed-aa7c-7003bca91a86';
    const userId = (req.body.userId as string) || 'system';

    const result = await runningHoursService.propagateAll(vesselId, userId);
    res.json(result);
  } catch (error: any) {
    console.error("[v2] Error propagating RH values:", error);
    res.status(500).json({ error: "Failed to propagate running hours" });
  }
}
