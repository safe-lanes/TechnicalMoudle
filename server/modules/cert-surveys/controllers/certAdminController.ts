import { Request, Response } from 'express';
import * as certAdminService from '../services/certAdminService';

// ══════════════════════════════════════════════════════════
// Master Certificate Admin
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-certificates-master ──

export async function getMasterCertificates(req: Request, res: Response) {
  try {
    const certificates = await certAdminService.getMasterCertificates();
    res.json(certificates);
  } catch (error: any) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching ship certificates master:", error);
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
}

// ── POST /admin/ship-certificates-master ──

export async function saveMasterCertificates(req: Request, res: Response) {
  try {
    const result = await certAdminService.saveMasterCertificates(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message, message: error.details });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error saving ship certificates master:", error);
    res.status(500).json({ error: "Failed to save certificates", details: error.message });
  }
}

// ── DELETE /admin/ship-certificates-master/:masterId ──

export async function deleteMasterCertificate(req: Request, res: Response) {
  try {
    const result = await certAdminService.deleteMasterCertificate(req.params.masterId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error deleting ship certificate master:", error);
    res.status(500).json({ error: "Failed to delete certificate" });
  }
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-certificates-labels ──

export async function getCertificateLabels(req: Request, res: Response) {
  try {
    const result = await certAdminService.getCertificateLabels();
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching ship certificates labels config:", error);
    res.status(500).json({ error: "Failed to fetch labels configuration" });
  }
}

// ── POST /admin/ship-certificates-labels ──

export async function saveCertificateLabels(req: Request, res: Response) {
  try {
    const result = await certAdminService.saveCertificateLabels(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error saving ship certificates labels config:", error);
    res.status(500).json({ error: "Failed to save labels configuration", details: error.message });
  }
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

// ── GET /admin/vessel-certificate-applicability ──

export async function getApplicability(req: Request, res: Response) {
  try {
    const result = await certAdminService.getApplicability(req.query.vesselIds as string);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching vessel certificate applicability:", error);
    res.status(500).json({ error: "Failed to fetch vessel certificate applicability", details: error.message });
  }
}

// ── POST /admin/vessel-certificate-applicability/initialize ──

export async function initializeApplicability(req: Request, res: Response) {
  try {
    const result = await certAdminService.initializeApplicability(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error initializing vessel certificate applicability:", error);
    res.status(500).json({ error: "Failed to initialize vessel certificate applicability", details: error.message });
  }
}

// ── PATCH /admin/vessel-certificate-applicability ──

export async function updateApplicability(req: Request, res: Response) {
  try {
    const result = await certAdminService.updateApplicability(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error updating vessel certificate applicability:", error);
    res.status(500).json({ error: "Failed to update vessel certificate applicability", details: error.message });
  }
}

// ── POST /admin/vessel-certificate-applicability/bulk-update ──

export async function bulkUpdateApplicability(req: Request, res: Response) {
  try {
    const result = await certAdminService.bulkUpdateApplicability(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error bulk updating vessel certificate applicability:", error);
    res.status(500).json({ error: "Failed to bulk update vessel certificate applicability", details: error.message });
  }
}
