import { Request, Response } from 'express';
import * as service from './service';

export async function getRanks(req: Request, res: Response) {
  try {
    const ranks = await service.getAllRanks();
    res.json(ranks);
  } catch (error: any) {
    if (error.statusCode === 503) return res.status(503).json({ error: "Database not available" });
    console.error("Error fetching ranks:", error);
    res.status(500).json({ error: "Failed to fetch ranks" });
  }
}

export async function saveRanks(req: Request, res: Response) {
  try {
    const { ranks } = req.body;
    if (!Array.isArray(ranks)) return res.status(400).json({ error: "ranks array required" });
    const result = await service.saveRanks(ranks);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving ranks:", error);
    res.status(500).json({ error: "Failed to save ranks", details: error.message });
  }
}

export async function deleteRank(req: Request, res: Response) {
  try {
    const result = await service.deleteRank(req.params.rankId);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error deleting rank:", error);
    res.status(500).json({ error: "Failed to delete rank" });
  }
}

export async function getOrgChart(req: Request, res: Response) {
  try {
    const chart = await service.getAllOrgChart();
    res.json(chart);
  } catch (error: any) {
    if (error.statusCode === 503) return res.status(503).json({ error: "Database not available" });
    console.error("Error fetching org chart:", error);
    res.status(500).json({ error: "Failed to fetch org chart" });
  }
}

export async function saveOrgChart(req: Request, res: Response) {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: "entries array required" });
    const result = await service.saveOrgChart(entries);
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error saving org chart:", error);
    res.status(500).json({ error: "Failed to save org chart", details: error.message });
  }
}

export async function deleteOrgChartEntry(req: Request, res: Response) {
  try {
    const result = await service.deleteOrgChartEntry(parseInt(req.params.id, 10));
    res.json(result);
  } catch (error: any) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Error deleting org chart entry:", error);
    res.status(500).json({ error: "Failed to delete org chart entry" });
  }
}
