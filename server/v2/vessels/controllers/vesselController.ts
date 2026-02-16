import { Request, Response } from 'express';
import { z } from 'zod';
import * as vesselService from '../services/vesselService';

const vuuidSchema = z.object({ vuuid: z.string().min(1, 'vuuid is required') });

export async function listAll(req: Request, res: Response) {
  try {
    const vessels = await vesselService.getAllVessels();
    res.json(vessels.map(v => ({
      id: v.id,
      vuuid: v.vuuid,
      name: v.name,
      code: v.code,
      imoNumber: v.imoNumber,
      vesselType: v.vesselType,
      flag: v.flag,
      isActive: v.isActive,
    })));
  } catch (error: any) {
    console.error("Error fetching vessels:", error);
    res.status(500).json({ error: "Failed to fetch vessels" });
  }
}

export async function listActive(req: Request, res: Response) {
  try {
    const vessels = await vesselService.getActiveVessels();
    res.json(vessels.map(v => ({
      id: v.id,
      vuuid: v.vuuid,
      name: v.name,
      code: v.code,
    })));
  } catch (error: any) {
    console.error("Error fetching active vessels:", error);
    res.status(500).json({ error: "Failed to fetch active vessels" });
  }
}

export async function getByVuuid(req: Request, res: Response) {
  try {
    const params = vuuidSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const vessel = await vesselService.getVessel(params.data.vuuid);
    if (!vessel) {
      return res.status(404).json({ error: "Vessel not found" });
    }
    res.json(vessel);
  } catch (error: any) {
    console.error("Error fetching vessel:", error);
    res.status(500).json({ error: "Failed to fetch vessel" });
  }
}

const createVesselSchema = z.object({
  vuuid: z.string().min(1, 'vuuid is required').optional(),
  id: z.string().optional(),
  name: z.string().min(1, 'name is required'),
  code: z.string().optional(),
  fleetId: z.string().nullable().optional(),
  imoNumber: z.string().nullable().optional(),
  vesselType: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function create(req: Request, res: Response) {
  try {
    const body = createVesselSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.errors[0]?.message });

    const { id: bodyId, vuuid: bodyVuuid, ...rest } = body.data;
    const resolvedVuuid = bodyVuuid || bodyId;
    if (!resolvedVuuid) {
      return res.status(400).json({ error: "Vessel vuuid (or id) is required" });
    }

    const vessel = await vesselService.createVessel({
      vuuid: resolvedVuuid,
      name: rest.name,
      code: rest.code || resolvedVuuid,
      fleetId: rest.fleetId ?? null,
      imoNumber: rest.imoNumber ?? null,
      vesselType: rest.vesselType ?? null,
      flag: rest.flag ?? null,
      isActive: rest.isActive ?? true,
    });

    res.status(201).json(vessel);
  } catch (error: any) {
    console.error("Error creating vessel:", error);
    if (error.message?.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to create vessel" });
  }
}

const updateVesselSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  fleetId: z.string().nullable().optional(),
  imoNumber: z.string().nullable().optional(),
  vesselType: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function update(req: Request, res: Response) {
  try {
    const params = vuuidSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = updateVesselSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.errors[0]?.message });

    const vessel = await vesselService.updateVessel(params.data.vuuid, body.data);
    res.json(vessel);
  } catch (error: any) {
    console.error("Error updating vessel:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to update vessel" });
  }
}

const assignFleetSchema = z.object({
  fleetId: z.string().nullable(),
});

export async function assignFleet(req: Request, res: Response) {
  try {
    const params = vuuidSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const body = assignFleetSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.errors[0]?.message });

    const vessel = await vesselService.assignVesselToFleet(params.data.vuuid, body.data.fleetId);
    res.json(vessel);
  } catch (error: any) {
    console.error("Error assigning vessel to fleet:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to assign vessel to fleet" });
  }
}

export async function listWithFleets(req: Request, res: Response) {
  try {
    const vessels = await vesselService.getVesselsWithFleets();
    res.json(vessels);
  } catch (error: any) {
    console.error("Error fetching vessels with fleets:", error);
    res.status(500).json({ error: error.message || "Failed to fetch vessels with fleets" });
  }
}

export async function listByFleet(req: Request, res: Response) {
  try {
    const fleetIdSchema = z.object({ fleetId: z.string().min(1, 'fleetId is required') });
    const params = fleetIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: params.error.errors[0]?.message });

    const vessels = await vesselService.getVesselsByFleet(params.data.fleetId);
    res.json(vessels);
  } catch (error: any) {
    console.error("Error fetching fleet vessels:", error);
    res.status(500).json({ error: error.message || "Failed to fetch fleet vessels" });
  }
}
