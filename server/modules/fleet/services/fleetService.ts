import { z } from 'zod';
import * as XLSX from 'xlsx';
import {
  insertComponentSchema,
  insertFleetJobsSchema,
  insertFleetSparesSchema,
  insertMakerListSchema,
  insertMasterListSchema,
  insertMasterListTypeSchema,
} from '@shared/schema';
import * as repo from '../repositories/fleetRepository';

// ══════════════════════════════════════════════════════════
// Fleet-Scoped Components
// ══════════════════════════════════════════════════════════

export async function getFleetScopedComponents() {
  return repo.getFleetScopedComponents();
}

export async function getFleetScopedComponent(id: string) {
  const component = await repo.getFleetScopedComponent(id);
  if (!component) {
    const err: any = new Error('Fleet component not found');
    err.statusCode = 404;
    throw err;
  }
  return component;
}

export async function createFleetScopedComponent(body: any) {
  const validatedData = insertComponentSchema.parse(body);
  return repo.createFleetScopedComponent(validatedData);
}

export async function updateFleetScopedComponent(id: string, body: any) {
  const partialComponentSchema = insertComponentSchema.partial();
  const validatedData = partialComponentSchema.parse(body);
  return repo.updateFleetScopedComponent(id, validatedData);
}

export async function deleteFleetScopedComponent(id: string) {
  await repo.deleteFleetScopedComponent(id);
  return { success: true };
}

export async function updateComponentSortOrder(body: any) {
  const sortOrderSchema = z.object({
    updates: z.array(z.object({
      id: z.number(),
      sortOrder: z.number(),
    })),
  });
  const { updates } = sortOrderSchema.parse(body);
  return repo.updateComponentSortOrder(updates);
}

// ══════════════════════════════════════════════════════════
// Fleet Jobs
// ══════════════════════════════════════════════════════════

export async function getFleetJobs() {
  return repo.getFleetJobs();
}

export async function getFleetJob(id: string) {
  const job = await repo.getFleetJob(id);
  if (!job) {
    const err: any = new Error('Fleet job not found');
    err.statusCode = 404;
    throw err;
  }
  return job;
}

export async function createFleetJob(body: any) {
  const validatedData = insertFleetJobsSchema.parse(body);
  return repo.createFleetJob(validatedData);
}

export async function updateFleetJob(id: string, body: any) {
  const STRING_FIELDS = [
    'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
    'taskType', 'assignedTo', 'approver', 'jobPriority',
    'classRelated', 'briefWorkDescription', 'department',
    'criticality', 'ppeRequirements', 'permitRequirements',
    'otherSafetyRequirements',
  ];
  const NOTNULL_STRING_FIELDS = new Set([
    'woTitle', 'jobCode', 'taskType', 'assignedTo', 'approver',
    'jobPriority', 'classRelated', 'briefWorkDescription',
    'department', 'criticality',
  ]);
  const JSON_FIELDS = ['requiredSpareParts', 'requiredTools'];
  const BOOLEAN_FIELDS = ['isActive'];

  const sanitizedData: Record<string, any> = {};
  const errors: string[] = [];

  for (const field of STRING_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (typeof val !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }
      if (NOTNULL_STRING_FIELDS.has(field) && val.trim() === '') {
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  for (const field of JSON_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (val !== null && !Array.isArray(val) && typeof val !== 'object') {
        errors.push(`${field} must be an array or object`);
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (field in body && body[field] !== undefined) {
      const val = body[field];
      if (typeof val !== 'boolean') {
        errors.push(`${field} must be a boolean`);
        continue;
      }
      sanitizedData[field] = val;
    }
  }

  if (errors.length > 0) {
    const err: any = new Error('Invalid field types');
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }
  if (Object.keys(sanitizedData).length === 0) {
    const err: any = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  console.log(`[Fleet Jobs PATCH] id=${id}, fields: ${Object.keys(sanitizedData).join(', ')}`);
  const { updatedJob, affectedCount } = await repo.updateFleetJob(Number(id), sanitizedData);
  return { ...updatedJob, affectedCount };
}

export async function deleteFleetJob(id: string) {
  await repo.deleteFleetJob(id);
  return { success: true };
}

export async function exportFleetJobs(fleetEquipmentCode?: string) {
  let jobsList = await repo.getFleetJobs();
  if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
    jobsList = jobsList.filter((j: any) => j.fleetEquipmentCode === fleetEquipmentCode);
  }

  const headers = [
    'Job Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'WO Title',
    'Task Type', 'Assigned To', 'Approver', 'Job Priority',
    'Class Related', 'Brief Work Description', 'Department', 'Criticality',
    'Is Active', 'Maintenance Basis', 'Interval Value', 'Unit',
    'Required Spare Parts', 'Required Tools', 'PPE Requirements',
    'Permit Requirements', 'Other Safety Requirements'
  ];

  const rows = jobsList.map((j: any) => [
    j.jobCode || '',
    j.fleetEquipmentCode || '',
    j.fleetEquipmentName || '',
    j.woTitle || '',
    j.taskType || '',
    j.assignedTo || '',
    j.approver || '',
    j.jobPriority || '',
    j.classRelated || '',
    j.briefWorkDescription || '',
    j.department || '',
    j.criticality || '',
    j.isActive === false ? 'No' : 'Yes',
    j.maintenanceBasis || '',
    j.intervalValue || '',
    j.unit || '',
    Array.isArray(j.requiredSpareParts) ? j.requiredSpareParts.join(', ') : (j.requiredSpareParts || ''),
    Array.isArray(j.requiredTools) ? j.requiredTools.join(', ') : (j.requiredTools || ''),
    j.ppeRequirements || '',
    j.permitRequirements || '',
    j.otherSafetyRequirements || '',
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [18, 22, 35, 30, 15, 18, 18, 12, 12, 40, 15, 12, 10, 18, 12, 12, 30, 25, 20, 20, 25];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet Jobs');

  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    filename: `fleet-jobs-${new Date().toISOString().split('T')[0]}.xlsx`,
  };
}

// ══════════════════════════════════════════════════════════
// Fleet Spares
// ══════════════════════════════════════════════════════════

export async function getFleetSpares() {
  return repo.getFleetSpares();
}

export async function getFleetSpare(id: number) {
  const spare = await repo.getFleetSpare(id);
  if (!spare) {
    const err: any = new Error('Fleet spare not found');
    err.statusCode = 404;
    throw err;
  }
  return spare;
}

export async function createFleetSpare(body: any) {
  const validatedData = insertFleetSparesSchema.parse(body);
  return repo.createFleetSpare(validatedData);
}

export async function updateFleetSpare(id: number, body: any) {
  const partialSchema = insertFleetSparesSchema.partial();
  const validatedData = partialSchema.parse(body);
  return repo.updateFleetSpare(id, validatedData);
}

export async function deleteFleetSpare(id: number) {
  await repo.deleteFleetSpare(id);
  return { success: true };
}

export async function exportFleetSpares(fleetEquipmentCode?: string) {
  let sparesList = await repo.getFleetSpares();
  if (fleetEquipmentCode && typeof fleetEquipmentCode === 'string') {
    sparesList = sparesList.filter((s: any) => s.fleetEquipmentCode === fleetEquipmentCode);
  }

  const headers = [
    'Part Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Part Name',
    'Part Number', 'Unit Of Measurement', 'Drawing Number', 'Position Number',
    'Note', 'Specification', 'Maker', 'Maker Code',
    'Manual Name', 'Page Number', 'Criticality', 'Is Active',
    'IHM (Inventory of Hazardous Materials)', 'Evidence Type'
  ];

  const rows = sparesList.map((s: any) => [
    s.partCode || '',
    s.fleetEquipmentCode || '',
    s.fleetEquipmentName || '',
    s.partName || '',
    s.partNumber || '',
    s.unitOfMeasurement || '',
    s.drawingNumber || '',
    s.positionNumber || '',
    s.note || '',
    s.specification || '',
    s.maker || '',
    s.makerCode || '',
    s.manualName || '',
    s.pageNumber || '',
    s.criticality || '',
    s.isActive === false ? 'No' : 'Yes',
    s.ihm || '',
    s.evidenceType || '',
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [18, 22, 35, 30, 18, 18, 18, 15, 25, 25, 25, 15, 20, 12, 12, 10, 15, 15];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet Spares');

  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    filename: `fleet-spares-${new Date().toISOString().split('T')[0]}.xlsx`,
  };
}

// ══════════════════════════════════════════════════════════
// Makers
// ══════════════════════════════════════════════════════════

export async function getMakers(search?: string) {
  return repo.getMakers(search);
}

export async function getMakerById(id: number) {
  const maker = await repo.getMakerById(id);
  if (!maker) {
    const err: any = new Error('Maker not found');
    err.statusCode = 404;
    throw err;
  }
  return maker;
}

export async function createMaker(body: any) {
  const validatedData = insertMakerListSchema.parse(body);

  // Auto-generate makerCode if not provided or empty
  let makerCode = validatedData.makerCode;
  if (!makerCode || makerCode.trim() === '') {
    const existingMakers = await repo.getMakers();
    let maxNum = 0;
    for (const m of existingMakers) {
      const match = m.makerCode?.match(/MKR-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    makerCode = `MKR-${String(maxNum + 1).padStart(6, '0')}`;
  }

  return repo.createMaker({ ...validatedData, makerCode });
}

export async function updateMaker(id: number, body: any) {
  const partialMakerSchema = insertMakerListSchema.partial();
  const validatedData = partialMakerSchema.parse(body);

  // Prevent clearing makerCode - remove it from update if empty
  if (validatedData.makerCode !== undefined && validatedData.makerCode.trim() === '') {
    delete validatedData.makerCode;
  }

  return repo.updateMaker(id, validatedData);
}

export async function deleteMaker(id: number) {
  await repo.deleteMaker(id);
  return { success: true };
}

// ══════════════════════════════════════════════════════════
// Master Lists
// ══════════════════════════════════════════════════════════

export async function getMasterLists(listType?: string) {
  return repo.getMasterLists(listType);
}

export async function getMasterListById(id: number) {
  const masterList = await repo.getMasterListById(id);
  if (!masterList) {
    const err: any = new Error('Master list not found');
    err.statusCode = 404;
    throw err;
  }
  return masterList;
}

export async function createMasterList(body: any) {
  const validatedData = insertMasterListSchema.parse(body);
  // FK-style validation at the SERVICE layer (intentional — NOT a DB FK).
  //
  // WHY NOT A DB FK:
  //   A real foreign key on master_lists.list_type -> master_list_types.list_type_key
  //   would fail the migration any time an existing master_lists row referenced
  //   an orphan type. Migration 085 seeds orphans as inactive Spares entries,
  //   but we still want existing orphan items to remain readable via GET so
  //   admins can reassign them without data loss.
  //
  //   Service-level enforcement therefore:
  //     - BLOCKS creation of new items referencing unknown/inactive types
  //     - BLOCKS updates that change list_type to an unknown/inactive value
  //     - ALLOWS reads of pre-existing rows even if their list_type is inactive
  //
  // If we ever do a hard sync cleanup, this can be upgraded to a DB FK.
  const type = await repo.getMasterListTypeByKey(validatedData.listType);
  if (!type || !type.isActive) {
    const err: any = new Error(
      `Invalid listType "${validatedData.listType}" — must reference an active entry in master_list_types.`
    );
    err.statusCode = 400;
    throw err;
  }
  return repo.createMasterList(validatedData);
}

export async function updateMasterList(id: number, body: any) {
  const partialMasterListSchema = insertMasterListSchema.partial();
  const validatedData = partialMasterListSchema.parse(body);
  // If listType is being changed, validate the new value exists + is active.
  if (validatedData.listType !== undefined) {
    const type = await repo.getMasterListTypeByKey(validatedData.listType);
    if (!type || !type.isActive) {
      const err: any = new Error(
        `Invalid listType "${validatedData.listType}" — must reference an active entry in master_list_types.`
      );
      err.statusCode = 400;
      throw err;
    }
  }
  return repo.updateMasterList(id, validatedData);
}

export async function deleteMasterList(id: number) {
  await repo.deleteMasterList(id);
  return { success: true };
}

// ══════════════════════════════════════════════════════════
// Master List Types (DB-backed registry + Section mapping)
// ══════════════════════════════════════════════════════════
// Business rules:
//   - is_system=true rows cannot be deleted or have their key/section modified
//   - A type with items in use (master_lists.list_type = key) cannot be
//     deleted OR have its key renamed — the caller must reassign/delete
//     the dependent master_list items first.
//   - Only Sail Admin can mutate these rows (enforced at route level via
//     requireRole middleware; this service layer assumes the auth check
//     has already passed).

export async function getMasterListTypes(section?: string, includeInactive = false) {
  if (includeInactive) {
    return repo.getAllMasterListTypesIncludingInactive(section);
  }
  return repo.getMasterListTypes(section);
}

export async function getMasterListTypeById(id: number) {
  const type = await repo.getMasterListTypeById(id);
  if (!type) {
    const err: any = new Error('Master list type not found');
    err.statusCode = 404;
    throw err;
  }
  return type;
}

export async function createMasterListType(body: any, userUuid?: string | null) {
  const validatedData = insertMasterListTypeSchema.parse(body);

  // Block key collision (active or soft-deleted with same key is a conflict
  // because the DB column has a UNIQUE constraint on list_type_key).
  const existing = await repo.getMasterListTypeByKey(validatedData.listTypeKey);
  if (existing) {
    const err: any = new Error(
      `List type with key "${validatedData.listTypeKey}" already exists`
    );
    err.statusCode = 409;
    throw err;
  }

  return repo.createMasterListType({
    ...validatedData,
    isSystem: false, // new types are never system types
    createdByUuid: userUuid ?? null,
    updatedByUuid: userUuid ?? null,
  });
}

export async function updateMasterListType(id: number, body: any, userUuid?: string | null) {
  const partialSchema = insertMasterListTypeSchema.partial();
  const validatedData = partialSchema.parse(body);

  const existing = await repo.getMasterListTypeById(id);
  if (!existing) {
    const err: any = new Error('Master list type not found');
    err.statusCode = 404;
    throw err;
  }

  // System type protection: cannot change key or section on seeded rows
  if (existing.isSystem) {
    if (validatedData.listTypeKey !== undefined && validatedData.listTypeKey !== existing.listTypeKey) {
      const err: any = new Error('System list types cannot have their key modified');
      err.statusCode = 400;
      throw err;
    }
    if (validatedData.section !== undefined && validatedData.section !== existing.section) {
      const err: any = new Error('System list types cannot have their section modified');
      err.statusCode = 400;
      throw err;
    }
  }

  // Rename protection: if the key is being changed and items reference the
  // old key, block the rename (caller must reassign/delete items first).
  if (
    validatedData.listTypeKey !== undefined &&
    validatedData.listTypeKey !== existing.listTypeKey
  ) {
    const inUse = await repo.countMasterListItemsByType(existing.listTypeKey);
    if (inUse > 0) {
      const err: any = new Error(
        `Cannot rename — ${inUse} item(s) use this type. Please reassign or delete those items first.`
      );
      err.statusCode = 409;
      throw err;
    }
    // Also check the destination key doesn't already exist
    const collision = await repo.getMasterListTypeByKey(validatedData.listTypeKey);
    if (collision) {
      const err: any = new Error(
        `List type with key "${validatedData.listTypeKey}" already exists`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  return repo.updateMasterListType(id, {
    ...validatedData,
    updatedByUuid: userUuid ?? null,
  });
}

export async function deleteMasterListType(id: number, userUuid?: string | null) {
  const existing = await repo.getMasterListTypeById(id);
  if (!existing) {
    const err: any = new Error('Master list type not found');
    err.statusCode = 404;
    throw err;
  }

  if (existing.isSystem) {
    const err: any = new Error('System list types cannot be deleted');
    err.statusCode = 400;
    throw err;
  }

  const inUse = await repo.countMasterListItemsByType(existing.listTypeKey);
  if (inUse > 0) {
    const err: any = new Error(
      `Cannot delete — ${inUse} item(s) use this type. Please reassign or delete those items first.`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.softDeleteMasterListType(id, userUuid);
  return { success: true };
}

// ══════════════════════════════════════════════════════════
// Fleet Vessel Mappings (from routes.ts)
// ══════════════════════════════════════════════════════════

export async function getFleetVesselMappings() {
  return repo.getFleetVesselMappings();
}

export async function createFleetVesselMappings(body: any) {
  const { fleetEntityType, fleetEntityIds, vesselId, vesselEntityId, vesselEntityCode } = body;

  if (!fleetEntityType || !fleetEntityIds?.length || !vesselId) {
    const err: any = new Error('Missing required fields: fleetEntityType, fleetEntityIds, vesselId');
    err.statusCode = 400;
    throw err;
  }

  return repo.createFleetVesselMappings({
    fleetEntityType,
    fleetEntityIds,
    vesselId,
    vesselEntityId,
    vesselEntityCode,
    mappedBy: 'admin'
  });
}

export async function deleteFleetVesselMapping(id: string) {
  await repo.deleteFleetVesselMapping(id);
  return { success: true };
}
