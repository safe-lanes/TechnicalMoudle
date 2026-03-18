import { Request, Response } from 'express';
import * as documentService from '../services/documentService';
import * as subEntityService from '../services/subEntityService';
import type { AuthenticatedRequest } from '../../../middleware/auth';

function getUserInfo(req: Request) {
  const user = (req as AuthenticatedRequest).user!;
  return { username: user.username, role: user.role, vesselId: user.vesselId };
}

// ── Documents ──

export async function listDocuments(req: Request, res: Response) {
  const user = getUserInfo(req);
  const documents = await documentService.listDocuments(req.params.componentId, user);
  res.json(documents);
}

export async function createDocument(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'File upload required - cannot create document without a file' });
  }
  const user = getUserInfo(req);
  try {
    const document = await documentService.createDocument(req.body, req.file, user);
    res.json(document);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid document data', details: error.errors });
    }
    throw error;
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    const document = await documentService.updateDocument(parseInt(req.params.id), req.body);
    res.json(document);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid document data', details: error.errors });
    }
    throw error;
  }
}

export async function deleteDocument(req: Request, res: Response) {
  await documentService.deleteDocument(parseInt(req.params.id));
  res.json({ success: true });
}

export async function downloadDocument(req: Request, res: Response) {
  const user = getUserInfo(req);
  const { buffer, fileName, contentType } = await documentService.downloadDocument(parseInt(req.params.id), user);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', contentType);
  res.send(buffer);
}

// ── Class Regulatory ──

export async function listClassRegulatory(req: Request, res: Response) {
  const user = getUserInfo(req);
  const items = await subEntityService.listClassRegulatory(req.params.componentId, user);
  res.json(items);
}

export async function createClassRegulatory(req: Request, res: Response) {
  const user = getUserInfo(req);
  try {
    const item = await subEntityService.createClassRegulatory(req.body, user);
    res.json(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid class regulatory data', details: error.errors });
    }
    throw error;
  }
}

export async function updateClassRegulatory(req: Request, res: Response) {
  const user = getUserInfo(req);
  try {
    const item = await subEntityService.updateClassRegulatory(parseInt(req.params.id), req.body, user);
    res.json(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid class regulatory data', details: error.errors });
    }
    throw error;
  }
}

export async function deleteClassRegulatory(req: Request, res: Response) {
  await subEntityService.deleteClassRegulatory(parseInt(req.params.id));
  res.json({ success: true });
}

// ── Requisitions ──

export async function listRequisitions(req: Request, res: Response) {
  const user = getUserInfo(req);
  const requisitions = await subEntityService.listRequisitions(req.params.componentId, user);
  res.json(requisitions);
}

export async function listAllRequisitions(req: Request, res: Response) {
  const user = getUserInfo(req);
  const vesselCode = req.query.vesselCode as string | undefined;
  const requisitions = await subEntityService.listAllRequisitions(user, vesselCode);
  res.json(requisitions);
}

export async function getRequisition(req: Request, res: Response) {
  const user = getUserInfo(req);
  const item = await subEntityService.getRequisition(parseInt(req.params.id), user);
  res.json(item);
}

export async function createRequisition(req: Request, res: Response) {
  const user = getUserInfo(req);
  try {
    const result = await subEntityService.createRequisition(req.body, user);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid requisition data', details: error.errors });
    }
    throw error;
  }
}

export async function updateRequisition(req: Request, res: Response) {
  const user = getUserInfo(req);
  try {
    const result = await subEntityService.updateRequisition(parseInt(req.params.id), req.body, user);
    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid requisition data', details: error.errors });
    }
    throw error;
  }
}

export async function deleteRequisition(req: Request, res: Response) {
  await subEntityService.deleteRequisition(parseInt(req.params.id));
  res.json({ success: true });
}

// ── Maintenance History ──

export async function listAllMaintenanceHistory(req: Request, res: Response) {
  const history = await subEntityService.listAllMaintenanceHistory();
  res.json(history);
}

export async function listVesselMaintenanceHistory(req: Request, res: Response) {
  const { vesselId } = req.params;
  if (!vesselId) return res.status(400).json({ error: 'vesselId is required' });
  const user = getUserInfo(req);
  const history = await subEntityService.listVesselMaintenanceHistory(vesselId, user);
  res.json(history);
}

export async function listMaintenanceHistory(req: Request, res: Response) {
  const user = getUserInfo(req);
  const history = await subEntityService.listMaintenanceHistory(req.params.componentId, user);
  res.json(history);
}

export async function getMaintenanceHistoryItem(req: Request, res: Response) {
  const user = getUserInfo(req);
  const item = await subEntityService.getMaintenanceHistoryItem(parseInt(req.params.id), user);
  res.json(item);
}

// ── Equipment Categories ──

export async function listEquipmentCategories(req: Request, res: Response) {
  const categories = await subEntityService.listEquipmentCategories();
  res.json(categories);
}

export async function createEquipmentCategory(req: Request, res: Response) {
  try {
    const category = await subEntityService.createEquipmentCategory(req.body);
    res.status(201).json(category);
  } catch (error: any) {
    throw error;
  }
}

export async function updateEquipmentCategory(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }
  try {
    const category = await subEntityService.updateEquipmentCategory(id, req.body);
    res.json(category);
  } catch (error: any) {
    throw error;
  }
}

export async function deleteEquipmentCategory(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  await subEntityService.deleteEquipmentCategory(id);
  res.json({ success: true });
}
