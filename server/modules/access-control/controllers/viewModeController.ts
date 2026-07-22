/**
 * View-mode controllers (Task #324).
 *
 * Guard order on PUT (Shipskart role-mapping pattern):
 *   1. Ship instance → 403 shore_only (editing is shore-only; ships get rows via sync)
 *   2. Editor role   → 403 forbidden (Sail Admin / Super Admin only)
 *   3. Validate ALL entries before writing ANY (service-level, no partial saves)
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import { isShipInstance } from '../../sync/syncRole';
import * as viewModeService from '../services/viewModeService';
import { ValidationError } from '../services/viewModeService';

const EDITOR_ROLES = new Set(['Sail Admin', 'Super Admin']);

export async function getViewModesHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const modes = await viewModeService.listViewModes();
    res.json(modes);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch view modes', details: error.message });
  }
}

export async function getRoleViewMappingsHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const result = await viewModeService.getRoleViewMappings();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch role view mappings', details: error.message });
  }
}

export async function putRoleViewMappingsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (await isShipInstance()) {
      return res.status(403).json({
        error: 'shore_only',
        message: 'View-mode mappings can only be edited on the shore instance. Ships receive updates via sync.',
      });
    }
    const userRole = req.user?.role || '';
    if (!EDITOR_ROLES.has(userRole)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only Sail Admin / Super Admin may edit the role view-mode mapping.',
      });
    }
    const entries = req.body?.mappings;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'mappings[] is required' });
    }

    const updatedBy = req.user?.userUuid || null;
    await viewModeService.saveMappings(entries, updatedBy);

    const result = await viewModeService.getRoleViewMappings();
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    res.status(500).json({ error: 'Failed to save role view mappings', details: error.message });
  }
}

export async function resolveViewModeHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userType = typeof req.query.userType === 'string' ? req.query.userType.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    if (!userType || !role) {
      return res.status(400).json({ error: 'userType and role query params are required' });
    }
    const result = await viewModeService.resolveViewMode(userType, role);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to resolve view mode', details: error.message });
  }
}
