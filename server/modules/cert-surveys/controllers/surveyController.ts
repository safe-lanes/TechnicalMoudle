import { Request, Response } from 'express';
import * as surveyService from '../services/surveyService';

// ── GET /surveys ──

export async function getSurveys(req: Request, res: Response) {
  try {
    const filters = {
      vesselId: req.query.vesselId as string | undefined,
      vesselName: req.query.vesselName as string | undefined,
      vesselNames: req.query.vesselNames as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 100,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
    };

    const result = await surveyService.getSurveys(filters);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching surveys:", error);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
}

// ── GET /surveys/:id ──

export async function getSurvey(req: Request, res: Response) {
  try {
    const survey = await surveyService.getSurvey(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    res.json(survey);
  } catch (error: any) {
    console.error("Error fetching survey:", error);
    res.status(500).json({ error: "Failed to fetch survey" });
  }
}

// ── PATCH /surveys/:id ──

export async function updateSurvey(req: Request, res: Response) {
  try {
    const result = await surveyService.updateSurvey(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating survey:", error);
    res.status(500).json({ error: "Failed to update survey" });
  }
}

// ── POST /surveys ──

export async function createSurvey(req: Request, res: Response) {
  try {
    const newSurvey = await surveyService.createSurvey(req.body);
    res.status(201).json(newSurvey);
  } catch (error: any) {
    console.error("Error creating survey:", error);
    res.status(500).json({ error: "Failed to create survey" });
  }
}
