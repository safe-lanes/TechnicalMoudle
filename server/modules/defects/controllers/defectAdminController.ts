import { Request, Response } from 'express';
import * as adminService from '../services/defectAdminService';

// ── GET /defect-categories ──

export async function getCategories(req: Request, res: Response) {
  try {
    const categories = await adminService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching defect categories:", error);
    res.status(500).json({ error: "Failed to fetch defect categories" });
  }
}

// ── POST /defect-categories ──

export async function createCategory(req: Request, res: Response) {
  try {
    const category = await adminService.createCategory(req.body);
    res.status(201).json(category);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: "Category with this name already exists" });
    }
    console.error("Error creating defect category:", error);
    res.status(500).json({ error: "Failed to create defect category" });
  }
}

// ── PATCH /defect-categories/:id ──

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const category = await adminService.updateCategory(id, req.body);
    res.json(category);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: "Category with this name already exists" });
    }
    console.error("Error updating defect category:", error);
    res.status(500).json({ error: "Failed to update defect category" });
  }
}

// ── DELETE /defect-categories/:id ──

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    await adminService.deleteCategory(id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error deleting defect category:", error);
    res.status(500).json({ error: "Failed to delete defect category" });
  }
}

// ── GET /defect-types ──

export async function getTypes(req: Request, res: Response) {
  try {
    const types = await adminService.getTypes();
    res.json(types);
  } catch (error) {
    console.error("Error fetching defect types:", error);
    res.status(500).json({ error: "Failed to fetch defect types" });
  }
}

// ── POST /defect-types ──

export async function createType(req: Request, res: Response) {
  try {
    const defectType = await adminService.createType(req.body);
    res.status(201).json(defectType);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: "Defect type with this name already exists" });
    }
    console.error("Error creating defect type:", error);
    res.status(500).json({ error: "Failed to create defect type" });
  }
}

// ── PATCH /defect-types/:id ──

export async function updateType(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const defectType = await adminService.updateType(id, req.body);
    res.json(defectType);
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: "Defect type with this name already exists" });
    }
    console.error("Error updating defect type:", error);
    res.status(500).json({ error: "Failed to update defect type" });
  }
}

// ── DELETE /defect-types/:id ──

export async function deleteType(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    await adminService.deleteType(id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error deleting defect type:", error);
    res.status(500).json({ error: "Failed to delete defect type" });
  }
}
