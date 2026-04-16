import { Request, Response } from 'express';
import * as certificateService from '../services/certificateService';

// ── GET /certificates ──

export async function getCertificates(req: Request, res: Response) {
  try {
    const vesselIdsRaw = req.query.vesselIds as string | undefined;
    const filters = {
      vesselId: req.query.vesselId as string | undefined,
      vesselIds: vesselIdsRaw ? vesselIdsRaw.split(',').filter(Boolean) : undefined,
      vesselName: req.query.vesselName as string | undefined,
      vesselNames: req.query.vesselNames as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 100,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
    };

    const result = await certificateService.getCertificates(filters);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
}

// ── GET /certificates/:id ──

export async function getCertificate(req: Request, res: Response) {
  try {
    const certificate = await certificateService.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.json(certificate);
  } catch (error: any) {
    if (error.code === 'MASTER_NOT_FOUND') {
      return res.status(404).json({ error: "Certificate master not found" });
    }
    console.error("Error fetching certificate:", error);
    res.status(500).json({ error: "Failed to fetch certificate" });
  }
}

// ── PATCH /certificates/:id ──

export async function updateCertificate(req: Request, res: Response) {
  try {
    const result = await certificateService.updateCertificate(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error updating certificate:", error);
    res.status(500).json({ error: "Failed to update certificate" });
  }
}
