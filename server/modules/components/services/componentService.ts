import * as repo from '../repositories/componentRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { Component, InsertComponent } from '@shared/schema';
import { makerList, masterLists } from '@shared/schema';
import { eq, and, ilike } from 'drizzle-orm';
import { getDb } from '../../../db';
import { validateSFICode, stripSFISuffix } from '@shared/utils/sfiCode';

const ALLOWED_DEPARTMENTS = ['Engine', 'Deck', 'Electrical', 'Galley', 'LSA', 'FFA'];

const SFI_FORMAT_HINT = 'Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc.';

/**
 * Enforce Parent Component Code rules identical to the bulk-import dry-run
 * (server/modules/bulk-upload/services/validationService.ts):
 *  - A single-digit top-level Component Code may omit the parent.
 *  - Any non-top-level code requires a parent (mandatory check already covers blank).
 *  - An explicit parent must be a valid SFI code, must not equal the component's own code,
 *    and must already exist in the same vessel's component register.
 * Throws ValidationError on the first violation. No-op when nothing to validate.
 */
async function validateParentComponentCode(
  componentCode: string | undefined | null,
  parentCode: string | undefined | null,
  vesselId: string | undefined | null,
): Promise<void> {
  const code = typeof componentCode === 'string' ? componentCode.trim() : '';
  const parent = typeof parentCode === 'string' ? parentCode.trim() : '';

  if (!parent) {
    // Blank parent is handled by the mandatory-field check (which already exempts
    // single-digit top-level codes via isParent / form rules). Nothing more to do here.
    return;
  }

  if (!validateSFICode(parent)) {
    throw new ValidationError(
      `Invalid Parent Component Code format '${parent}'. ${SFI_FORMAT_HINT}`,
    );
  }

  if (code && code.toUpperCase() === parent.toUpperCase()) {
    throw new ValidationError(
      `Component Code and Parent Component Code are both '${code}'. A component cannot be its own parent.`,
    );
  }

  if (vesselId) {
    const parentExists = await repo.findByCodeAndVessel(parent, vesselId);
    if (!parentExists) {
      throw new ValidationError(
        `Parent Component Code '${parent}' does not exist in the vessel's component register. Cannot create a component without a valid parent.`,
      );
    }
  }
}

// Audit Phase 1 — equipment/component register audit (entity_type='component').
// Register fields whose changes we record as old→new. Excludes RH counter fields
// (that is the running_hours_audit stream) and bookkeeping columns.
const AUDIT_TRACKED_FIELDS = [
  'name', 'componentCode', 'critical', 'isActive', 'parentId', 'parentComponent',
  'componentCategory', 'category', 'eqptSystemDept', 'maker', 'makerCode', 'location',
] as const;

/** Build an old→new diff over the tracked register fields. Returns {} when nothing tracked changed. */
function buildComponentChangedFields(oldRow: any, newRow: any): Record<string, { old: any; new: any }> {
  const changed: Record<string, { old: any; new: any }> = {};
  for (const f of AUDIT_TRACKED_FIELDS) {
    if (newRow == null || !(f in newRow)) continue;
    const oldVal = oldRow?.[f] ?? null;
    const newVal = newRow[f] ?? null;
    if (oldVal !== newVal) changed[f] = { old: oldVal, new: newVal };
  }
  return changed;
}

/** Best-effort register audit — never blocks or fails the mutation. Actor is frozen by Phase 0 createAuditLog. */
async function auditComponent(params: {
  actionType: string;
  component: any;
  source?: string;
  payload?: Record<string, any>;
}): Promise<void> {
  try {
    const c = params.component || {};
    await repo.createAuditLog({
      entityType: 'component',
      entityId: c.cuuid || c.id || null,
      actionType: params.actionType,
      source: params.source || 'web_ui',
      vesselCode: c.vesselId ?? null,
      componentCode: c.componentCode ?? null,
      payload: params.payload ?? {},
    });
  } catch (auditErr) {
    console.error(`[Audit] component ${params.actionType} log failed:`, auditErr);
  }
}

async function getActiveComponentCategories(): Promise<string[]> {
  const db = await getDb();
  const items = await db.select({ listValue: masterLists.listValue })
    .from(masterLists)
    .where(and(eq(masterLists.listType, 'componentCategory'), eq(masterLists.isActive, true)));
  return items.map(i => i.listValue);
}

async function validateMaker(makerName?: string, makerCode?: string) {
  const db = await getDb();
  const hasName = makerName && makerName.trim();
  const hasCode = makerCode && makerCode.trim();
  if (!hasName && !hasCode) return;

  if (hasName && hasCode) {
    const matches = await db.select().from(makerList)
      .where(and(
        ilike(makerList.makerName, makerName!.trim()),
        eq(makerList.makerCode, makerCode!.trim())
      ));
    if (matches.length === 0) {
      throw new ValidationError('Maker and Maker Code combination not found in Maker List. Please select a valid Maker.');
    }
  } else if (hasName) {
    const matches = await db.select().from(makerList)
      .where(ilike(makerList.makerName, makerName!.trim()));
    if (matches.length === 0) {
      throw new ValidationError('Maker not found in Maker List. Please select a valid Maker.');
    }
  } else if (hasCode) {
    const matches = await db.select().from(makerList)
      .where(eq(makerList.makerCode, makerCode!.trim()));
    if (matches.length === 0) {
      throw new ValidationError('Maker Code not found in Maker List.');
    }
  }
}

export async function listByVessel(vesselId: string): Promise<Component[]> {
  return repo.findByVesselId(vesselId);
}

export async function listAll(vesselId?: string, vesselIds?: string[]): Promise<Component[]> {
  if (vesselId && vesselId !== 'all') {
    return repo.findByVesselId(vesselId);
  }
  if (vesselId === 'all' && vesselIds?.length) {
    return repo.findByVesselIds(vesselIds);
  }
  if (vesselId === 'all') {
    return repo.findAll();
  }
  return repo.findAll();
}

export async function getById(id: string): Promise<Component | undefined> {
  return repo.findById(id);
}

export async function create(data: any): Promise<Component> {
  const isParent = data.isParent === true || data.isParent === 'Yes';
  // A single-digit top-level Component Code may omit the parent (mirrors bulk-import dry-run).
  const isTopLevel = stripSFISuffix(String(data.componentCode ?? '').trim()).length === 1;

  const allMandatoryFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const optionalKeys = new Set<string>();
  if (isParent) optionalKeys.add('eqptSystemDept');
  if (isTopLevel) optionalKeys.add('parentId');
  const mandatoryFields = allMandatoryFields.filter(f => !optionalKeys.has(f.key));

  const missing = mandatoryFields.filter(f => {
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return !val || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (missing.length > 0) {
    throw new ValidationError(`Missing mandatory fields: ${missing.join(', ')}`);
  }

  if (data.eqptSystemDept && data.eqptSystemDept.toUpperCase() === 'NULL') {
    data.eqptSystemDept = null;
  }
  if (data.eqptSystemDept && !ALLOWED_DEPARTMENTS.includes(data.eqptSystemDept)) {
    throw new ValidationError(`Invalid Equipment / System Department. Allowed values are: ${ALLOWED_DEPARTMENTS.join(', ')}.`);
  }

  if (data.componentCategory) {
    const allowedCategories = await getActiveComponentCategories();
    if (allowedCategories.length > 0 && !allowedCategories.includes(data.componentCategory)) {
      throw new ValidationError(`Invalid Component Category. Allowed values are: ${allowedCategories.join(', ')}.`);
    }
  }

  await validateMaker(data.maker, data.makerCode);

  // Duplicate component code check
  if (data.componentCode && data.vesselId) {
    const existing = await repo.findByCodeAndVessel(data.componentCode, data.vesselId);
    if (existing) {
      throw new ValidationError(
        `Component Code '${data.componentCode}' already exists for this vessel. Please use a unique code.`
      );
    }
  }

  // Duplicate component name check
  if (data.name && data.vesselId) {
    const existingByName = await repo.findByNameAndVessel(data.name, data.vesselId);
    if (existingByName) {
      throw new ValidationError(
        `Component Name '${data.name}' already exists for this vessel. Please use a unique name.`
      );
    }
  }

  // Parent Component Code validation (parity with bulk-import dry-run):
  // valid SFI format, not self-referencing, and must exist in the same vessel.
  await validateParentComponentCode(data.componentCode, data.parentId, data.vesselId);

  // RH field validation (B7.B rules)
  const effectiveRhType = data.rhCounterType || 'NOT_RH_DRIVEN';

  if (data.rhCounterType || data.rhMasterComponentId) {
    if (effectiveRhType === 'MASTER') {
      if (data.rhMasterComponentId) {
        throw new ValidationError('MASTER counter type cannot have a master component reference');
      }
    } else if (effectiveRhType === 'INHERITED') {
      if (!data.rhMasterComponentId) {
        throw new ValidationError('INHERITED counter type requires rhMasterComponentId');
      }
      const masterComponent = await repo.findByIdOrCode(data.rhMasterComponentId, data.vesselId);
      if (!masterComponent) {
        throw new ValidationError('Master component not found');
      }
      if (masterComponent.vesselId !== data.vesselId) {
        throw new ValidationError('Master component must be from the same vessel');
      }
      if (masterComponent.rhCounterType !== 'MASTER') {
        throw new ValidationError('Referenced component is not a MASTER counter type');
      }
    } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
      if (data.rhMasterComponentId) {
        throw new ValidationError('NOT_RH_DRIVEN counter type cannot have a master component reference');
      }
    }
  }

  const component = await repo.create(data);
  console.log('[API_CREATE] New component:', {
    id: component.cuuid,
    code: component.componentCode,
    parentId: component.parentId,
    vesselId: component.vesselId
  });
  // Audit Phase 1 — register create.
  await auditComponent({
    actionType: 'create',
    component,
    payload: {
      componentCode: component.componentCode,
      name: component.name,
      critical: component.critical,
      parentId: component.parentId,
      eqptSystemDept: (component as any).eqptSystemDept,
      componentCategory: (component as any).componentCategory ?? (component as any).category,
      isActive: component.isActive,
    },
  });
  return component;
}

export async function update(id: string, data: any, userId: string): Promise<Component> {
  console.log(`🔧 PATCH /api/components/${id} with:`, JSON.stringify(data, null, 2).substring(0, 500));

  const existingComponent = await repo.findById(id);
  if (!existingComponent) {
    throw new NotFoundError('Component not found');
  }

  const effectiveIsParent = data.isParent !== undefined ? (data.isParent === true || data.isParent === 'Yes') : (existingComponent as any).isParent === true;
  // Effective (post-update) component code drives the single-digit top-level exemption.
  const effectiveComponentCode = data.componentCode !== undefined && data.componentCode !== null && data.componentCode !== ''
    ? data.componentCode
    : existingComponent.componentCode;
  const isTopLevel = stripSFISuffix(String(effectiveComponentCode ?? '').trim()).length === 1;

  const allMandatoryPatchFields: { key: string; label: string; isBoolean?: boolean }[] = [
    { key: 'name', label: 'Component Name' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'parentId', label: 'Parent Component Code' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active', isBoolean: true },
  ];
  const patchOptionalKeys = new Set<string>();
  if (effectiveIsParent) patchOptionalKeys.add('eqptSystemDept');
  if (isTopLevel) patchOptionalKeys.add('parentId');
  const mandatoryPatchFields = allMandatoryPatchFields.filter(f => !patchOptionalKeys.has(f.key));

  const invalidPatch = mandatoryPatchFields.filter(f => {
    if (!(f.key in data)) return false;
    const val = data[f.key];
    if (f.isBoolean) return val === undefined || val === null || val === '';
    return val === null || val === '' || (typeof val === 'string' && val.trim() === '');
  }).map(f => f.label);
  if (invalidPatch.length > 0) {
    throw new ValidationError(`Cannot set mandatory fields to empty: ${invalidPatch.join(', ')}`);
  }

  if (data.eqptSystemDept && typeof data.eqptSystemDept === 'string' && data.eqptSystemDept.toUpperCase() === 'NULL') {
    data.eqptSystemDept = null;
  }
  if (data.eqptSystemDept !== undefined && data.eqptSystemDept !== null && data.eqptSystemDept !== '' && !ALLOWED_DEPARTMENTS.includes(data.eqptSystemDept)) {
    throw new ValidationError(`Invalid Equipment / System Department. Allowed values are: ${ALLOWED_DEPARTMENTS.join(', ')}.`);
  }

  if (data.componentCategory !== undefined && data.componentCategory !== null && data.componentCategory !== '') {
    const allowedCategories = await getActiveComponentCategories();
    if (allowedCategories.length > 0 && !allowedCategories.includes(data.componentCategory)) {
      throw new ValidationError(`Invalid Component Category. Allowed values are: ${allowedCategories.join(', ')}.`);
    }
  }

  if (data.maker !== undefined || data.makerCode !== undefined) {
    await validateMaker(data.maker, data.makerCode);
  }

  // Duplicate component code check (only when code is actually changing)
  if (data.componentCode && data.componentCode !== existingComponent.componentCode) {
    const vesselId = existingComponent.vesselId ?? data.vesselId;
    if (vesselId) {
      const duplicate = await repo.findByCodeAndVessel(data.componentCode, vesselId);
      if (duplicate) {
        throw new ValidationError(
          `Component Code '${data.componentCode}' already exists for this vessel. Please use a unique code.`
        );
      }
    }
  }

  // Duplicate component name check (only when name is actually changing)
  if (data.name && data.name !== existingComponent.name) {
    const vesselId = existingComponent.vesselId ?? data.vesselId;
    if (vesselId) {
      const duplicateByName = await repo.findByNameAndVessel(data.name, vesselId, id);
      if (duplicateByName) {
        throw new ValidationError(
          `Component Name '${data.name}' already exists for this vessel. Please use a unique name.`
        );
      }
    }
  }

  // Parent Component Code validation (parity with bulk-import dry-run). Only validate when
  // the parent is part of this update; otherwise leave the existing hierarchy untouched.
  if ('parentId' in data) {
    const effectiveParent = data.parentId;
    const effectiveVesselId = existingComponent.vesselId ?? data.vesselId;
    await validateParentComponentCode(effectiveComponentCode, effectiveParent, effectiveVesselId);
  }

  // RH field validation (B7.B rules)
  const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType || 'NOT_RH_DRIVEN';
  const effectiveMasterId = data.rhMasterComponentId !== undefined
    ? data.rhMasterComponentId
    : existingComponent.rhMasterComponentId;

  if (data.rhCounterType || data.rhMasterComponentId !== undefined) {
    if (effectiveRhType === 'MASTER') {
      if (effectiveMasterId) {
        throw new ValidationError('MASTER counter type cannot have a master component reference');
      }
    } else if (effectiveRhType === 'INHERITED') {
      if (!effectiveMasterId) {
        throw new ValidationError('INHERITED counter type requires rhMasterComponentId');
      }
      if (effectiveMasterId === id) {
        throw new ValidationError('A component cannot inherit running hours from itself');
      }
      const masterComponent = await repo.findByIdOrCode(effectiveMasterId, existingComponent.vesselId);
      if (!masterComponent) {
        throw new ValidationError('Master component not found');
      }
      if (masterComponent.vesselId !== existingComponent.vesselId) {
        throw new ValidationError('Master component must be from the same vessel');
      }
      if (masterComponent.rhCounterType !== 'MASTER') {
        throw new ValidationError('Referenced component is not a MASTER counter type');
      }
    } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
      if (effectiveMasterId) {
        throw new ValidationError('NOT_RH_DRIVEN counter type cannot have a master component reference');
      }
    }

    // Downgrade protection
    if (existingComponent.rhCounterType === 'MASTER' && effectiveRhType !== 'MASTER') {
      const dependents = await repo.getInheritedComponents(id);
      if (dependents.length > 0) {
        const dependentNames = dependents.slice(0, 3).map((d: any) => d.name).join(', ');
        const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
        throw new ValidationError(
          `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
        );
      }
    }
  }

  // INTERCEPT RH UPDATES
  let component;
  if (data.currentCumulativeRH !== undefined || data.runningHours !== undefined) {
    const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || '0');
    if (!isNaN(rhValue)) {
      const result = await repo.setRunningHours({
        componentId: id,
        newRHValue: rhValue,
        updateSource: 'MANUAL',
        userId,
        lastUpdatedDate: data.lastUpdated
      });
      console.log(`🔄 RH Update: synced ${result.inheritedUpdated} inherited components`);

      const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
      if (Object.keys(otherData).length > 0) {
        component = await repo.update(id, otherData);
      } else {
        component = result.component;
      }
    } else {
      component = await repo.update(id, data);
    }
  } else {
    component = await repo.update(id, data);
  }

  console.log(`✅ Updated component:`, component.componentCode, '| vesselId:', component.vesselId, '| parentId:', component.parentId);

  // Audit Phase 1 — register edit. isActive transition → activate/deactivate; otherwise → update.
  const changedFields = buildComponentChangedFields(existingComponent, component);
  if (Object.keys(changedFields).length > 0) {
    const isActiveChange = changedFields.isActive;
    const actionType = isActiveChange
      ? (isActiveChange.new === true ? 'activate' : 'deactivate')
      : 'update';
    await auditComponent({
      actionType,
      component,
      payload: { componentCode: component.componentCode, changedFields },
    });
  }
  return component;
}

export async function updateSortOrder(body: any) {
  const { z } = await import('zod');
  const sortOrderSchema = z.object({
    updates: z.array(z.object({
      id: z.string(),
      sortOrder: z.number(),
    })),
    reparents: z.array(z.object({
      id: z.string(),
      newParentCode: z.string(),
    })).optional().default([]),
  });
  const { updates, reparents } = sortOrderSchema.parse(body);
  if (reparents.length > 0) {
    return repo.updateHierarchyAndSortOrder(updates, reparents);
  }
  return repo.updateSortOrder(updates);
}

export async function remove(id: string): Promise<void> {
  return repo.remove(id);
}

export async function inactivate(id: string, vesselId: string, userId: string) {
  const result = await repo.inactivate(id, vesselId, userId);
  // Audit Phase 1 — deactivate (the user-facing "Delete" in the register). Only on success.
  if ((result as any)?.success) {
    const comp = await repo.findById(id).catch(() => undefined);
    await auditComponent({
      actionType: 'deactivate',
      component: comp ?? { cuuid: id, vesselId },
      payload: { componentCode: (comp as any)?.componentCode, isActive: { old: true, new: false } },
    });
  }
  return result;
}
