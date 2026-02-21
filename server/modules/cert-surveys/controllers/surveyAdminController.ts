import { Request, Response } from 'express';
import * as surveyAdminService from '../services/surveyAdminService';

// ══════════════════════════════════════════════════════════
// Master Survey Admin
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-surveys-master ──

export async function getMasterSurveys(req: Request, res: Response) {
  try {
    const surveys = await surveyAdminService.getMasterSurveys();
    res.json(surveys);
  } catch (error: any) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching ship surveys master:", error);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
}

// ── POST /admin/ship-surveys-master ──

export async function saveMasterSurveys(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.saveMasterSurveys(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message, message: error.details });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error saving ship surveys master:", error);
    res.status(500).json({ error: "Failed to save surveys", details: error.message });
  }
}

// ── DELETE /admin/ship-surveys-master/:masterId ──

export async function deleteMasterSurvey(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.deleteMasterSurvey(req.params.masterId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error deleting ship survey master:", error);
    res.status(500).json({ error: "Failed to delete survey" });
  }
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

// ── GET /admin/ship-surveys-labels ──

export async function getSurveyLabels(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.getSurveyLabels();
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching ship surveys labels config:", error);
    res.status(500).json({ error: "Failed to fetch labels configuration" });
  }
}

// ── POST /admin/ship-surveys-labels ──

export async function saveSurveyLabels(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.saveSurveyLabels(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error saving ship surveys labels config:", error);
    res.status(500).json({ error: "Failed to save labels configuration", details: error.message });
  }
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

// ── GET /admin/vessel-survey-applicability ──

export async function getApplicability(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.getApplicability(req.query.vesselIds as string);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error fetching vessel survey applicability:", error);
    res.status(500).json({ error: "Failed to fetch vessel survey applicability", details: error.message });
  }
}

// ── POST /admin/vessel-survey-applicability/initialize ──

export async function initializeApplicability(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.initializeApplicability(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error initializing vessel survey applicability:", error);
    res.status(500).json({ error: "Failed to initialize vessel survey applicability", details: error.message });
  }
}

// ── POST /admin/vessel-survey-applicability/bulk-update ──

export async function bulkUpdateApplicability(req: Request, res: Response) {
  try {
    const result = await surveyAdminService.bulkUpdateApplicability(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Database not available" });
    }
    console.error("Error bulk updating vessel survey applicability:", error);
    res.status(500).json({ error: "Failed to bulk update vessel survey applicability", details: error.message });
  }
}
