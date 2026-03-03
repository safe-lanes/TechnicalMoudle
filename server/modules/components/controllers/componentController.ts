import { Request, Response } from 'express';
import * as componentService from '../services/componentService';
import { NotFoundError, ValidationError } from '../../shared/errors';

export async function updateSortOrder(req: Request, res: Response) {
  try {
    const result = await componentService.updateSortOrder(req.body);
    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    if (error.message?.includes('Circular hierarchy')) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error updating component sort order:", error);
    res.status(500).json({ error: "Failed to update sort order" });
  }
}

// GET /components/:vesselId — list components for a vessel (Target Picker)
export async function listByVessel(req: Request, res: Response) {
  const components = await componentService.listByVessel(req.params.vesselId);
  console.log(`📋 GET /technical/api/components/${req.params.vesselId} returning ${components.length} components`);
  components.slice(0, 5).forEach(c => {
    console.log(`  - code: ${c.componentCode}, name: ${c.name?.substring(0, 30)}, parentId: ${c.parentId || 'none'}`);
  });
  res.json(components);
}

// GET /components/details/:id — single component (component details page)
export async function getDetails(req: Request, res: Response) {
  const component = await componentService.getById(req.params.id);
  if (!component) {
    return res.status(404).json({ error: 'Component not found' });
  }
  res.json(component);
}

// GET /components?vesselId= — list all components, optionally filtered
export async function listAll(req: Request, res: Response) {
  const vesselId = req.query.vesselId as string | undefined;
  const components = await componentService.listAll(vesselId);
  res.json(components);
}

// GET /components/:id — single component by ID
export async function getById(req: Request, res: Response) {
  const component = await componentService.getById(req.params.id);
  if (!component) {
    return res.status(404).json({ error: 'Component not found' });
  }
  res.json(component);
}

// POST /components — create component
export async function create(req: Request, res: Response) {
  try {
    const component = await componentService.create(req.body);
    res.status(201).json(component);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
}

// PATCH /components/:id — update component
export async function update(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.username || 'unknown';
    const component = await componentService.update(req.params.id, req.body, userId);
    res.json(component);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update component' });
  }
}

// DELETE /components/:id — delete component
export async function remove(req: Request, res: Response) {
  try {
    await componentService.remove(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete component' });
  }
}

// POST /components/:id/inactivate — inactivate component
export async function inactivate(req: Request, res: Response) {
  try {
    const { cascadeInactivate, userId } = req.body;
    const result = await componentService.inactivate(
      req.params.id,
      userId || 'system',
      cascadeInactivate === true
    );

    if (!result.success) {
      if (result.activeChildrenCount && result.activeChildrenCount > 0) {
        return res.status(400).json({
          success: false,
          error: result.message,
          code: 'ACTIVE_CHILDREN',
          activeChildrenCount: result.activeChildrenCount
        });
      }
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error inactivating component:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to inactivate component'
    });
  }
}
