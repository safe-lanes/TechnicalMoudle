import * as repo from '../repositories/componentRepository';
import { insertComponentClassRegulatorySchema, insertComponentRequisitionSchema } from '@shared/schema';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../shared/errors';

interface UserInfo {
  username: string;
  role: string;
  vesselId?: string;
}

// ── Component Class Regulatory ──

export async function listClassRegulatory(componentId: string, user: UserInfo) {
  const component = await repo.findById(componentId);
  if (!component) throw new NotFoundError('Component not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (component.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access classification data for components from other vessels');
    }
  }

  return repo.findClassRegulatory(componentId);
}

export async function createClassRegulatory(body: any, user: UserInfo) {
  const validatedData = insertComponentClassRegulatorySchema.parse({
    ...body,
    createdBy: user.username,
    updatedBy: user.username
  });
  return repo.createClassRegulatory(validatedData);
}

export async function updateClassRegulatory(id: number, body: any, user: UserInfo) {
  const validatedData = insertComponentClassRegulatorySchema.partial().parse({
    ...body,
    updatedBy: user.username
  });
  return repo.updateClassRegulatory(id, validatedData);
}

export async function deleteClassRegulatory(id: number) {
  return repo.deleteClassRegulatory(id);
}

// ── Component Requisitions ──

export async function listRequisitions(componentId: string, user: UserInfo) {
  const component = await repo.findById(componentId);
  if (!component) throw new NotFoundError('Component not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (component.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access requisitions for components from other vessels');
    }
  }

  let requisitions = await repo.findRequisitions(componentId);

  // Add dummy data for demo component 401.005
  if (component.componentCode === '401.005' && requisitions.length === 0) {
    requisitions = [
      {
        id: 1001,
        requisitionNo: 'REQ-401.005-001',
        componentId,
        itemOrService: 'Rudder Shaft Bearing (SP-00001)',
        quantity: 2,
        uom: 'PC',
        raisedOn: '2025-12-01',
        priority: 'Normal',
        status: 'PO Raised',
        requestedBy: 'Chief Engineer',
        vesselCode: component.vesselCode
      },
      {
        id: 1002,
        requisitionNo: 'REQ-401.005-002',
        componentId,
        itemOrService: 'Rudder Actuator Service',
        quantity: 1,
        uom: 'SRV',
        raisedOn: '2025-12-02',
        priority: 'Urgent',
        status: 'Delivered On Board',
        requestedBy: '2nd Engineer',
        vesselCode: component.vesselCode
      }
    ] as any;
  }

  return requisitions;
}

export async function listAllRequisitions(user: UserInfo, queryVesselCode?: string) {
  let vesselCode = queryVesselCode;
  if (user.role === 'Ship' && user.vesselId) {
    vesselCode = user.vesselId;
  }
  return repo.findAllRequisitions(vesselCode);
}

export async function getRequisition(id: number, user: UserInfo) {
  const item = await repo.findRequisitionItem(id);
  if (!item) throw new NotFoundError('Requisition not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (item.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access requisitions from other vessels');
    }
  }

  return item;
}

export async function createRequisition(body: any, user: UserInfo) {
  // Ship users can only create requisitions for their assigned vessel
  if (user.role === 'Ship' && user.vesselId) {
    if (body.vesselCode && body.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot create requisitions for other vessels');
    }
    body.vesselCode = user.vesselId;
  }

  const validatedData = insertComponentRequisitionSchema.parse({
    ...body,
    requestedBy: body.requestedBy || user.username
  });
  return repo.createRequisition(validatedData);
}

export async function updateRequisition(id: number, body: any, user: UserInfo) {
  const existing = await repo.findRequisitionItem(id);
  if (!existing) throw new NotFoundError('Requisition not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (existing.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot update requisitions from other vessels');
    }
  }

  const validatedData = insertComponentRequisitionSchema.partial().parse(body);

  // SECURITY: Prevent vesselCode/componentId modification for non-admins
  if (user.role !== 'PMS Admin') {
    delete (validatedData as any).vesselCode;
    delete (validatedData as any).componentId;
  }

  return repo.updateRequisition(id, validatedData);
}

export async function deleteRequisition(id: number) {
  return repo.deleteRequisition(id);
}

// ── Maintenance History (read-only) ──

export async function listAllMaintenanceHistory() {
  return repo.findAllMaintenanceHistory();
}

export async function listMaintenanceHistory(componentId: string, user: UserInfo) {
  const component = await repo.findById(componentId);
  if (!component) throw new NotFoundError('Component not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (component.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access maintenance history for components from other vessels');
    }
  }

  let history = await repo.findMaintenanceHistory(componentId);

  // Fallback by componentCode + vesselCode for legacy records
  if (history.length === 0 && component.componentCode && component.vesselCode) {
    history = await repo.findMaintenanceHistoryByCode(component.componentCode, component.vesselCode);
  }

  return history;
}

export async function getMaintenanceHistoryItem(id: number, user: UserInfo) {
  const item = await repo.findMaintenanceHistoryItem(id);
  if (!item) throw new NotFoundError('Maintenance history item not found');

  if (user.role === 'Ship' && user.vesselId) {
    if (item.vesselCode !== user.vesselId) {
      throw new ForbiddenError('Cannot access maintenance history from other vessels');
    }
  }

  return item;
}

// ── Equipment Categories ──

export async function listEquipmentCategories() {
  return repo.findEquipmentCategories();
}

export async function createEquipmentCategory(data: { name?: string; sortOrder?: number; isActive?: boolean }) {
  if (!data.name?.trim()) {
    throw new ValidationError('Category name is required');
  }
  if (data.sortOrder !== undefined && typeof data.sortOrder !== 'number') {
    throw new ValidationError('Sort order must be a number');
  }

  try {
    return await repo.createEquipmentCategory({ name: data.name.trim(), sortOrder: data.sortOrder, isActive: data.isActive });
  } catch (error: any) {
    if (error.code === '23505') {
      throw new ConflictError('Category with this name already exists');
    }
    throw error;
  }
}

export async function updateEquipmentCategory(id: number, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
  if (data.name !== undefined && !data.name.trim()) {
    throw new ValidationError('Category name cannot be empty');
  }
  if (data.sortOrder !== undefined && typeof data.sortOrder !== 'number') {
    throw new ValidationError('Sort order must be a number');
  }

  try {
    const result = await repo.updateEquipmentCategory(id, data);
    if (!result) throw new NotFoundError('Category not found');
    return result;
  } catch (error: any) {
    if (error.code === '23505') {
      throw new ConflictError('Category with this name already exists');
    }
    throw error;
  }
}

export async function deleteEquipmentCategory(id: number) {
  const result = await repo.deleteEquipmentCategory(id);
  if (!result) throw new NotFoundError('Category not found');
}
